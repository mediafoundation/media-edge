const axios = require('axios')
const config = require('../config/app')
const env = require("../config/env")
const doh = require('dohjs')
const { obtainAndRenewCertificate } = require('../utils/certs')
const resolver = new doh.DohResolver('https://1.1.1.1/dns-query')
// const resolver2 = new doh.DohResolver('https://dns.google.com/resolve')
// const resolver3 = new doh.DohResolver('https://dns.quad9.net/dns-query')
// const resolver4 = new doh.DohResolver('https://doh.opendns.com/dns-query')

module.exports = (sequelize, DataTypes) => {
  const Caddy = sequelize.define('Caddy', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true
    },
    account: {
      type: DataTypes.STRING,
      unique: true
    },
    resource_id: DataTypes.STRING,
    origin: DataTypes.STRING,
    wallet: DataTypes.STRING,
    domain: DataTypes.STRING,
    path: DataTypes.STRING,
    protocol: DataTypes.STRING,
    label: DataTypes.STRING,
    network: DataTypes.STRING
  }, { freezeTableName: true })

  //Caddy globals
  Caddy.queues = {
    Minutely: [],
    Hourly: [],
    Daily: [],
    Monthly: []
  };
  
  Caddy.caddyBaseUrl = env.caddyUrl
  Caddy.caddyRoutesUrl = Caddy.caddyBaseUrl+'config/apps/http/servers/srv0/routes'
  Caddy.caddyReqCfg = {
    headers: {
      'Content-Type': 'application/json'
    }
  }

  const CaddySource = sequelize.define('CaddySource', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true
    },
    host: {
      type: DataTypes.STRING,
      unique: true
    },
    deal_id: DataTypes.STRING,
  })

  Caddy.checkDomain = async (host) => {
    let domain = await CaddySource.findOne({
      where: { host: host },
      raw: true 
    })
    if(env.debug) console.log(`Checking if domain ${host} is added to Caddy Database -> ${!!domain}`)
    return !!domain;
  }

  Caddy.getCaddySources = async(attributes=null) => {
    return await CaddySource.findAll({ 
      attributes: attributes, 
      raw: true
    })
  }

  Caddy.getHostnames = (deal)  =>{
    let hostnames = []
    for (const domain of JSON.parse(deal.domains)) {
      hostnames.push(deal.id + "." + domain[1])
    }
    return hostnames
  }

  /*Caddy.getDHostname = (resource_id)  =>{
    return resource_id + "." + env.hns
  }*/

  /*Caddy.getAlias = (a,b)  =>{
    return a + "_" + b
  }*/

  /*Caddy.getShortName = (acc)  =>{
    let accLen = acc.length / 2;
    return (
        acc.slice(0,3) + //first 3 chars
        acc.slice(accLen-1,accLen+1) + //middle two chars
        acc.slice(-3) // last 3 chars
      ).toLowerCase();
  }*/

  Caddy.newObject = async (res, deal) => {
    let hostname = Caddy.getHostnames(deal)
    let transport = res.protocol === "https" ? 
    { 
      "protocol": "http", 
      "tls": { "insecure_skip_verify": true } 
    } : { 
      "protocol": "http" 
    }

    let routes = [{
      "handle": [{
        "handler": "reverse_proxy",
        "headers": { 
          "request": { 
            "set": { 
              "Host": ["{http.reverse_proxy.upstream.hostport}"],
            } 
          },
          "response": {
            "set": {
              "X-Deal-ID": [deal.id],
            }
          }
        },
        "transport": transport,
        "upstreams": [{
          "dial": res.origin
        }],
      }]
    }]
    
    if (res.path && res.path !== "/") {
      let path = res.path.endsWith("/") ? res.path.slice(0, -1) : res.path
      routes.unshift({
        "handle": [{
          "handler": "rewrite",
          "uri": path + "{http.request.uri}"
        }]
      })
    }
    return {
      "@id": deal.id,
      "handle": [{
        "handler": "subroute",
        "routes": routes
      }],
      "match": [{
        "host": hostname
      }],
      "terminal": true
    }
  }

  Caddy.addRecords = async(dealsResources, Caddyfile) => {
    let payload = []
    for(const item of dealsResources) {
      let caddyData = await Caddy.newObject(item.resource, item.deal)
      let dealInFile = Caddyfile.find(o => o["@id"] === item.deal.id);
      //if resource is not on caddyfile already, add to payload
      if(!dealInFile) {
        if(item.resource.domain) {
          Caddy.addToQueue(Caddy.queues.Minutely, item.deal.id, item);
        }
        payload.push(caddyData)
      } else {
        await Caddy.upsertRecord(item, dealInFile)
      }
    }
    //Add to caddy file
    try {
      await axios.post(
        Caddy.caddyRoutesUrl+"/...",
        payload,
        Caddy.caddyReqCfg
      )
      console.log('Added to caddy:', payload.length, "deals")
    } catch (e){
      console.log("axios error", e)
      return false
    }
  }

  Caddy.manageDomain = async (caddyData, item) => {
    let host = caddyData.match[0].host
    //check if cname is pointing to the right target
    //TODO: make the web2 domains dynamic, cause there can be mutiple
    let cname_is_valid = await Caddy.checkCname(item.resource.domain, host[0])
    if (cname_is_valid) {
      //find and delete cname from any other record
      await Caddy.cleanUpCname(item.deal.id, item.resource.domain)
      //add cname to Caddy object
      caddyData.match[0].host.push(item.resource.domain)
      //add cnmae to CaddySources
      await CaddySource.findOrCreate({
        where: {
          host: item.resource.domain,
          deal_id: item.deal.id
        }
      })

      await obtainAndRenewCertificate({host: item.resource.domain})
      console.log("Added CaddySources for domain:", item.resource.domain, item.resource.id)
    } else { //if cname is not valid
      //if it's not on any queue already, add it
      console.log("Adding domain to check queue.", item.resource.domain, item.resource.id)
      Caddy.addToQueue(Caddy.queues.Minutely, item.deal.id, item);
    }
  }

  Caddy.upsertRecord = async (item) => {

    //Destroy previous custom cnames records associated to deal id
    let destroyed = await CaddySource.destroy({
      where: {
        deal_id: item.deal.id
      }
    })
    if(destroyed) console.log("Removing CaddySources for:", item.deal.id)

    //Remove deal from queue
    await Caddy.deletefromAllQueues(item.deal.id)

    //create Caddy object required to be posted on caddyFile
    let newCaddyData = await Caddy.newObject(item.resource, item.deal)
    
    //if the resource has a custom cname
    if(item.resource.domain) {
      console.log("Deal has domain:", item.resource.domain)
      await Caddy.manageDomain(newCaddyData, item)
    }

    let recordId = Caddy.caddyBaseUrl+"id/"+item.deal.id
    try {
      await axios.patch(
          recordId,
          newCaddyData,
          Caddy.caddyReqCfg
      )
      console.log('Updated Caddyfile resource:', item.deal.id)
    } catch (e){
      console.log("axios error", e)
      return false
    }

    return true
  }

  Caddy.getRecords = async () => {
    try { 
      let resp = await axios.get(
        Caddy.caddyRoutesUrl,
        Caddy.caddyReqCfg
      )        
      return resp.data
    } catch(e){
      //console.log("Axios error, status: " + e.response.status + " on " + url);
      console.log(e)
      return false;
    }
  }

  Caddy.getResource = async (id) => {s
    let url = Caddy.caddyBaseUrl + 'id/' + id;
    try { 
      let resp = await axios.get(
        url,
        Caddy.caddyReqCfg
      )        
      return resp.data
    } catch(e){
      if(e.response.status === 500){
        console.log(`Record id ${id} not found on Caddyfile.`);
      } else {
        console.log("Axios error, status: " + e.response.status + " on " + url);
      }
      return false;
    }
  }

  Caddy.getRecord = async (id) => {
    let url = Caddy.caddyBaseUrl + 'id/' + id + '/match/0/host';
    try { 
      let resp = await axios.get(
        url,
        Caddy.caddyReqCfg
      )        
      return resp.data
    } catch(e){
      if(e.response.status === 500){
        console.log(`Record id ${id} not found on Caddyfile.`);
      } else {
        console.log("Axios error, status: " + e.response.status + " on " + url);
      }
      return false;
    }
  }

  Caddy.deleteRecord = async (dealId) => {
    try {
      await CaddySource.destroy({ where: { deal_id: dealId } })
      
      await Caddy.deletefromAllQueues(dealId)

      await axios.delete(
          Caddy.caddyBaseUrl +'id/'+ dealId,
          Caddy.caddyReqCfg
      )

      console.log('Deleted from caddy:', dealId)
      //await Caddy.destroy({ where: { account:caddy.account }})
      return true
    } catch (e){
      let data = e?.response?.data?.error;
      if(data.includes("unknown object")){
        if(env.debug) console.log('Deal already deleted:', dealId)
        return true
      } else {
        console.log("axios error", e)
        return false
      }
      return false
    }
  }

  //patches hostnames on an existing caddyfile record
  Caddy.patchRecord = async (item) => {
    if (item.resource.domain) {
      let host = Caddy.getHostnames(item.deal);
      //let match = [host]
      //match.push(Caddy.getDHostname(item.resource_id))
      let cname_is_valid = await Caddy.checkCname(item.resource.domain, host[0])
      if (cname_is_valid) {
        await Caddy.cleanUpCname(item.deal.id, item.resource.domain)
        host.push(item.resource.domain)
        CaddySource.findOrCreate({
          where: {
            host: item.resource.domain,
            deal_id: item.deal.id
          }
        })
        try{
          console.log('Patching caddy domain', host)
          axios.patch(
            Caddy.caddyBaseUrl + 'id/' + item.deal.id + '/match/0/host',
            JSON.stringify(host),
            Caddy.caddyReqCfg
          )
          return true
        } catch(_){
          console.log("Error patching", item.deal.id)
          return false
        }
      } else {
        return false
      }
    } else { // si no existe el recurso en la DB de caddy o no tiene custom dominio
      return false
    }
  }

  Caddy.initApps = async() => {
    try {
      await axios.post(
        Caddy.caddyBaseUrl+"config/apps",
        config.caddyInitialApps,
        Caddy.caddyReqCfg
      )
      await CaddySource.destroy({where: {}})
      /*await CaddySource.findOrCreate({
        where: {
          host: Caddy.getHostnames("media-api"),
          resource_id: 0
        }
      })
      await CaddySource.findOrCreate({
        where: {
          host: Caddy.getHostnames("appdev"),
          resource_id: 0
        }
      })*/
      console.log("Finished resetting Caddy records.", "\n")
      return true
    } catch (e){
      console.log(e)
      return false 
    }
  }

  Caddy.checkQueue = async(queue, current, limit) =>{
    if (queue.length > 0) {
      console.log(`Checking pending domains ${current} started. On queue: ${queue.length}`);
      for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i];
        if (!item.retry) item.retry = 0;
        if (item.retry <= limit) {
          item.retry++;
          if (env.debug) console.log(`Retrying to apply custom domain ${item.resource.domain} (${item.retry})`);
          const patched = await Caddy.patchRecord(item);
          if (patched) {
            console.log(`Removing pending domain from queue, patch success: ${item.resource.domain}`);
            queue.splice(i, 1);
          } else if (item.retry === limit) {
            if (env.debug) console.log(`Domain exceeded retry limits, sending to next stage: ${item.resource.domain}`);
            if (current === "Minutely") Caddy.queues.Hourly.push(item);
            else if (current === "Hourly") Caddy.queues.Daily.push(item);
            else if (current === "Daily") Caddy.queues.Monthly.push(item);
            else console.log(`Domain exceeded retry limits, checked for 12 months without restart: ${item.resource.domain}`);
            queue.splice(i, 1);
          }
        }
      }
      console.log(`Checking pending domains ${current} ended. On queue: ${queue.length}`);
    }
  }

  Caddy.isInQueue = (id) => {
    return Object.values(Caddy.queues).some(queue => queue.some(item => item.id === id));
  }

  Caddy.deletefromAllQueues = async(id) => {
    for (const queue of Object.values(Caddy.queues)) {
      const index = queue.findIndex(item => item.id === id);
      if (index !== -1) queue.splice(index, 1);
    }
  }

  Caddy.addToQueue = async(queue, id, item) =>{
    if (!Caddy.isInQueue(id)) {
      queue.push({...item, id});
    }
  }

  Caddy.checkCname = async(targetDomain,expectedDomain) => {
    try {
      let response = await resolver.query(targetDomain, 'CNAME')
      if(response.answers.length > 0){
        let answers = []; 
        response.answers.forEach(ans => answers.push(ans.data))
        return answers.includes(expectedDomain);
      } else {
        return false
      }
    } catch (e) {
      console.log(e)
      return false
    }
  }

  Caddy.cleanUpCname = async(deal_id, cname) =>{
    let added = await Caddy.isCnameAlreadyAdded(cname)
    if(added && added !== deal_id) await Caddy.removeCname(added, cname)
    return true
  }

  Caddy.isCnameAlreadyAdded = async(cname) =>{
    try {
      let response = await axios.get(Caddy.caddyRoutesUrl)
      for (const resource of response.data) {
        if (resource.match[0].host.includes(cname)) {
          console.log("Cname already added to another deal: "+resource["@id"])
          return resource["@id"]
        }
      }
      return false
    } catch (e){
      console.log(e)
      return false
    }
  }

  Caddy.removeCname = async(id, cname) =>{
    try {
      //get all current domains for a given resource
      const matches = await Caddy.getRecord(id)
      const match = matches.indexOf(cname)
      //remove cname from resource
      matches.splice(match, 1)
      axios.patch(
        Caddy.caddyBaseUrl + 'id/' + id + '/match/0/host',
        JSON.stringify(matches),
        Caddy.caddyReqCfg
      )
      //remove cname from CaddySources
      await CaddySource.destroy({ where: { host:cname } })
      return true
    } catch (e){
      console.log(e)
      return false
    }

  }

  Caddy.areArraysEqual = (array1, array2) => {
    // Check if the arrays have the same length
    if (array1.length !== array2.length) {
      return false;
    }

    // Sort the arrays
    array1 = array1.sort();
    array2 = array2.sort();

    // Compare the elements of the arrays
    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i]) {
        return false;
      }
    }

    return true;
  }

  Caddy.compareDbAndCaddyData = (dbDealIds, caddyDealIds) => {
    let difference = [];
    let set1 = new Set(dbDealIds);
    if(caddyDealIds !== undefined){
      for (let i = 0; i < caddyDealIds.length; i++) {
        if (!set1.has(caddyDealIds[i])) {
          difference.push(caddyDealIds[i]);
        }
      }
    }
    return difference;
  }

  Caddy.syncCaddySources = async (props) => {
    await CaddySource.sync(props)
  }
  
  return Caddy;
}
