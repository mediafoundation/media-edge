const axios = require('axios')
const config = require('../config/app')
const env = require("../config/env")
const doh = require('dohjs')
const resolver = new doh.DohResolver('https://1.1.1.1/dns-query')
// const resolver2 = new doh.DohResolver('https://dns.google.com/resolve')
// const resolver3 = new doh.DohResolver('https://dns.quad9.net/dns-query')
// const resolver4 = new doh.DohResolver('https://doh.opendns.com/dns-query')

async function updateOrCreate(model, where, newItem) {
  // First try to find the record
 const foundItem = await model.findOne({where});
 if (!foundItem) {
      // Item not found, create a new one
      const item = await model.create(newItem)
      return  {item, created: true};
  }
  // Found an item, update it
  const item = await model.update(newItem, {where});
  return {item, created: false};
}

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
  Caddy.queue = []
  Caddy.queueHourly = []
  Caddy.queueDaily = []
  Caddy.queueMonthly = []
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
    resource_id: DataTypes.INTEGER,
  })

  Caddy.checkDomain = async (host) => {
    let domain = await CaddySource.findOne({
      where: { host: host },
      raw: true 
    })
    if(env.debug) console.log('Checking if domain', host, 'is added to Caddy Database ->', domain ? true : false)
    return domain ? true : false;
  }

  Caddy.getCaddySources = async() => {
    let sources = await CaddySource.findAll({ raw: true })
    return sources
  }

  Caddy.getHostname = (resource_id)  =>{
    return resource_id + "." + env.host
  }

  Caddy.getDHostname = (resource_id)  =>{
    return resource_id + "." + env.hns
  }

  Caddy.getAlias = (a,b)  =>{
    return a + "_" + b
  }

  Caddy.getShortName = (acc)  =>{
    let accLen = acc.length / 2;
    return (
        acc.slice(0,3) + //first 3 chars
        acc.slice(accLen-1,accLen+1) + //middle two chars
        acc.slice(-3) // last 3 chars
      ).toLowerCase();
  }

  Caddy.newObject = async (res) => {
    console.log("Res in new object: ", res)
    let hostname = Caddy.getHostname(res.id)
    let dHostname = Caddy.getDHostname(res.id)
    let match = [hostname, dHostname]
    console.log("match in caddy:", match)
    let splitted = res.origin.split(':');
    let protocol = res.protocol ? res.protocol : (splitted[1] === '443' || splitted[1] === '8443' ? "https" : "http"); //old resources didn't have protocol in json
    let transport = protocol === "https" ?  { "protocol": "http", "tls": {"insecure_skip_verify": true } } : { "protocol": "http" }

    let routes = [{
      "handle": [{
        "handler": "reverse_proxy",
        "headers": { 
          "request": { 
            "set": { 
              "Host": ["{http.reverse_proxy.upstream.hostport}"] 
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
          "uri": path+"{http.request.uri}"
        }]
      })
    }
    return {
      "@id": res.id,
      "handle": [{
        "handler": "subroute",
        "routes": routes
      }],
      "match": [{
        "host": match
      }],
      "terminal": true
    }
  }

  Caddy.addRecords = async(resources, Caddyfile) => {
    let payload = []
    for(const res of resources) {
      let caddyData = await Caddy.newObject(res)
      //if res has an ID, it may confict with DB id, so we delete it before adding
      //if(res.id) delete res.id
      //add to Caddy DB
      //let caddy = await Caddy.create(res)
      //add domains to Caddy Sources DB
      console.log("Caddy data: ", caddyData.match[0].host)
      for (const domain of caddyData.match[0].host){
        console.log("Domain:", domain)
        await CaddySource.findOrCreate({
          where: {
            host: domain,
            resource_id: res.id
          }
        })
      }
      //if resource has a custom domain
      if(res.domain) {
        let host = Caddy.getHostname(res.id);
        //check if cname is pointing to the right target
        let cname_is_valid = await Caddy.checkCname(res.domain, host)
        if (cname_is_valid) {
          //find and delete cname from any other record
          await Caddy.cleanUpCname(res.account, res.domain)
          //add cname to Caddy object
          caddyData.match[0].host.push(res.domain)
          //add cnmae to CaddySources
          await CaddySource.findOrCreate({
            where: {
              host: res.domain,
              resource_id: caddy.id
            }
          })
          console.log("Added CaddySources for domain:", res.domain, res.resource_id)
        } else { //if cname is not valid
          //if it's not on any queue already, add it
          console.log("Adding domain to check queue.", res.domain, res.resource_id)
          if (!Caddy.isInQueue(res.resource_id)) {
            Caddy.queue[res.resource_id] = res
          }
        }
      }
      //if resource is not on caddyfile already, add to payload
      console.log("Res:", res)
      let fileExist = !!Caddyfile.find(o => o["@id"] === res.id);
      console.log("File exists:", fileExist)
      if(!fileExist) payload.push(caddyData)
    }
    //Add to caddy file
    try {
      await axios.post(
        Caddy.caddyRoutesUrl+"/...",
        payload,
        Caddy.caddyReqCfg
      )
      console.log('Added to caddy:', payload.length, "resources")
    } catch (e){
      console.log("axios error", e)
      return false
    }
  }

  Caddy.addRecord = async (res, fileExist=false) => {
    //check if requires update (if record present on database **OR** on caddyFile)
    let requireUpdate = caddy || fileExist ? true : false
    //create caddy object
    let caddyData = await Caddy.newObject(res)
    //if there's no db record
    if(!caddy) {
      //if res has an ID, it may confict with DB id, so we delete it before adding
      if(res.id) delete res.id
      //add to Caddy DB
      let caddy = await Caddy.create(res)
      //add domains to Caddy Sources DB
      for (const domain of caddyData.match[0].host){
        await CaddySource.create({
          host: domain,
          resource_id: caddy.id
        })
      }
    }
    //if theres no caddyFile matching the ID
    if(!fileExist){
      //Add to caddy file
      try {
        await axios.post(
          Caddy.caddyRoutesUrl,
          caddyData,
          Caddy.caddyReqCfg
        )
        console.log('Added to caddy:', res.resource_id, res.wallet, res.account)
      } catch (e){
        console.log("axios error", e)
        return false
      }
      //if caddy added succesfully, and theres a custom domain, add resource to pending queue
      if (res.domain) {
        Caddy.queue[res.resource_id] = res
      }
    }

    //update the resource in case there were previous data (db record or CaddyFile)
    if(requireUpdate) await Caddy.updateRecord(res, fileExist)

    return true
  }

  //res = new or updated resource | fileExist = caddy configuration object | caddy = caddy db record
  //we allow these parameters to be sent so we don't make n requests to the caddy configuration for checking.
  Caddy.updateRecord = async (res, fileExist=false, caddy=false) => {
    //find resource on caddy file
    fileExist = fileExist ? true : await Caddy.getRecord(res.account)
    //find record in DB
    caddy = caddy ? caddy : await Caddy.findOne({ 
      where: { account: res.account } 
    })
    //add empty string to domain or label if these are empty. (this is required because if it's not present, db won't get updated)
    res.domain = res.domain ? res.domain : ""
    res.label = res.label ? res.label : ""
    //if found in DB and in File
    if (fileExist && caddy) {
      //domain name on DB
      let prevDomain = caddy.domain;
      //prepare resource to be saved on DB
      await caddy.set(res)
      //check for modifications
      let changed = caddy.changed()
      //save resource on DB
      await caddy.save()
      //if the resource has different data than CaddyFile
      if(changed){
        //if the domain was changed, and there was a previous domain, delete it from caddy sources
        if(changed.includes("domain") && prevDomain){
          let destroyed = CaddySource.destroy({ 
            where: { 
              host: prevDomain,
              resource_id: caddy.id
            } 
          })
          if(destroyed) console.log("Removing CaddySources", prevDomain, res.domain)
          if(Caddy.isInQueue(res.resource_id)){
            await Caddy.deletefromAllQueues(res.resource_id)
          }
        }
        //create Caddy object required to be posted on caddyFile
        let caddyData = await Caddy.newObject(res)
        //if the resource has a custom cname
        if(res.domain) {
          let host = Caddy.getHostname(res.resource_id);
          let cname_is_valid = await Caddy.checkCname(res.domain, host)
          if (cname_is_valid) {
            await Caddy.cleanUpCname(res.account, res.domain)
            //add hostname to Caddy object
            caddyData.match[0].host.push(res.domain)
            //create caddy sources
            for (const domain of caddyData.match[0].host){
              await CaddySource.findOrCreate({
                where: {
                  host: domain,
                  resource_id: caddy.id
                }
              })
            }
          } else { //if cname is not valid
            //if resource is already on a queue
            if (Caddy.isInQueue(res.resource_id)) {
              //delete it, because it may have old data
              await Caddy.deletefromAllQueues(res.resource_id)
            }
            if(env.debug) console.log("Adding domain to pending queue.", res.domain, res.resource_id)
            Caddy.queue[res.resource_id] = res
          }
        }
        try {
          let url = Caddy.caddyBaseUrl+"id/"+res.account
          axios.patch(
            url,
            caddyData,
            Caddy.caddyReqCfg
          )
          console.log('Updated Caddyfile resource:', res.resource_id, res.account)
        } catch (e){
          console.log("axios error", url)
          return false
        }
      }
    } else {
      //if wasn't found on both Caddy DB **AND** Caddyfile, add it.
      await Caddy.addRecord(res, fileExist)
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

  Caddy.deleteRecord = async (caddy) => {
    try {
      await axios.delete(
        Caddy.caddyBaseUrl +'id/'+ caddy.account,
        Caddy.caddyReqCfg
      )
      await CaddySource.destroy({ where: { resource_id:caddy.id } })
      
      Caddy.deletefromAllQueues(caddy.resource_id)
      console.log('Deleted from caddy:', caddy.account)
      await Caddy.destroy({ where: { account:caddy.account }})
      return true
    } catch (e){
      console.log("axios error", e)
      return false
    }
  }

  //patches hostnames on an existing caddyfile record
  Caddy.patchRecord = async (res) => {
    
    if (res.domain) {
      let host = Caddy.getHostname(res.resource_id);
      let match = [host]
      match.push(Caddy.getDHostname(res.resource_id))
      let cname_is_valid = await Caddy.checkCname(res.domain, host)
      if (cname_is_valid) {
        await Caddy.cleanUpCname(res.account, res.domain)
        match.push(res.domain)
        for (const domain of match){
          CaddySource.findOrCreate({
            where: {
              host: domain,
              resource_id: res.resource_id
            }
          })
        }
        try{
          console.log('Patching caddy domain', match)
          axios.patch(
            Caddy.caddyBaseUrl + 'id/' + res.account + '/match/0/host',
            JSON.stringify(match),
            Caddy.caddyReqCfg
          )
          return true
        } catch(_){
          console.log("Error patching", res.account)
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
      await CaddySource.findOrCreate({
        where: {
          host: Caddy.getHostname("media-api"),
          resource_id: 0
        }
      })
      await CaddySource.findOrCreate({
        where: {
          host: Caddy.getHostname("appdev"),
          resource_id: 0
        }
      })
      console.log("Finished resetting Caddy records.", "\n\n")
      return true
    } catch (e){
      console.log(e)
      return false 
    }
  }

  Caddy.checkQueue = async(queue, current, limit) =>{
    if(Object.keys(queue).length > 0){
      console.log("Checking pending domains "+current+" started. On queue:",Object.keys(queue).length)
      for(const [res, val] of Object.entries(queue)){
        if(!queue[res]["retry"]) queue[res]["retry"] = 0
        if(queue[res]["retry"] <= limit){
          queue[res]["retry"] = queue[res]["retry"] + 1
          if(env.debug) console.log("Retrying to apply custom domain", res, queue[res]["domain"], queue[res]["retry"])
          let patched = await Caddy.patchRecord(queue[res])
          if(patched){
            console.log("Removing pending domain from queue, patch success", queue[res]["domain"])
            delete queue[res]
          } else {
            if(queue[res]["retry"] === limit){
              if(env.debug) console.log("Domain exceeded retry limits, sending to next stage.", queue[res]["domain"])
              if (current === "Minutely") {
                Caddy.queueHourly[res] = val
                Caddy.queueHourly[res]["retry"] = 0
              }
              else if(current === "Hourly") {
                Caddy.queueDaily[res] = val
                Caddy.queueDaily[res]["retry"] = 0
              }
              else if(current === "Daily") {
                Caddy.queueMonthly[res] = val
                Caddy.queueMonthly[res]["retry"] = 0
              }
              else { 
                console.log("Domain exceeded retry limits, checked for 12 months without restart, how did I get here?.", queue[res]["domain"])
              }
              delete queue[res]
            }
          }
        }
      }
      console.log("Checking pending domains "+current+" ended. On queue:",Object.keys(queue).length)
    }
  }

  Caddy.pendingQueue = async() =>{
    Caddy.checkQueue(Caddy.queue, "Minutely", 60)
  }

  Caddy.pendingQueueHourly = async() =>{
    Caddy.checkQueue(Caddy.queueHourly, "Hourly", 24)
  }

  Caddy.pendingQueueDaily = async() =>{
    Caddy.checkQueue(Caddy.queueDaily, "Daily", 30)
  }

  Caddy.pendingQueueMonthly = async() =>{
    Caddy.checkQueue(Caddy.queueMonthly, "Monthly", 12)
  }

  Caddy.isInQueue = (id) => {
    return !!(Caddy.queue[id] ||
        Caddy.queueHourly[id] ||
        Caddy.queueDaily[id] ||
        Caddy.queueMonthly[id]);
  }

  Caddy.deletefromAllQueues = async(id) => {
    delete Caddy.queue[id]
    delete Caddy.queueHourly[id]
    delete Caddy.queueDaily[id]
    delete Caddy.queueMonthly[id]
  }

  Caddy.isResourceAlreadyAdded = async(id) =>{
    try {
      let response = await axios.get(Caddy.caddyRoutesUrl)
      for (const resource of response.data) {
        if (resource["@id"] === id) {
          console.log("Resource already added: "+resource["@id"])
          return true
        }
      } 
      return false
    } catch (e){
      console.log(e)
      return false
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

  Caddy.cleanUpCname = async(resource_id, cname) =>{
    let added = await Caddy.isCnameAlreadyAdded(cname)
    if(added && added !== resource_id) await Caddy.removeCname(added, cname)
    return true
  }

  Caddy.isCnameAlreadyAdded = async(cname) =>{
    try {
      let response = await axios.get(Caddy.caddyRoutesUrl)
      for (const resource of response.data) {
        if (resource.match[0].host.includes(cname)) {
          console.log("Cname already added to another resource: "+resource["@id"])
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

  CaddySource.sync({ force: true })
  return Caddy;
}
