const env = require("../config/env");
const {generateSubdomain} = require("../utils/generateSubdomain");
const axios = require("axios");
const {obtainAndRenewCertificate} = require("../utils/certs");
const doh = require('dohjs')
const resolver = new doh.DohResolver('https://1.1.1.1/dns-query')
const config = require("../config/app");
const {CaddySource} = require("../models/caddy");

class CaddyController {

    queues = {
        Minutely: [],
        Hourly: [],
        Daily: [],
        Monthly: []
    };

    caddyBaseUrl = env.caddyUrl
    caddyRoutesUrl = this.caddyBaseUrl+'config/apps/http/servers/srv0/routes'
    caddyReqCfg = {
        headers: {
            'Content-Type': 'application/json'
        }
    }
    static async checkDomain(host){
        let domain = await CaddySource.findOne({
            where: { host: host },
            raw: true
        })
        if(env.debug==="requests") console.log(`Checking if domain ${host} is added to Caddy Database -> ${!!domain}`)
        return !!domain;
    }

    static async getCaddySources (attributes=null) {
        return await CaddySource.findAll({
            attributes: attributes,
            raw: true
        })
    }

    static async newObject(res, deal, network){
        let hosts = []

        for(const host of env.hosts){
            hosts.push(`${generateSubdomain(env.MARKETPLACE_ID, deal.id, network.network_id, network.chain_id)}.${host}`)
        }

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
                "host": hosts
            }],
            "terminal": true
        }
    }

    static async addRecords (dealsResources, Caddyfile, network){
        let payload = []
        for(const item of dealsResources) {
            let caddyData = await this.newObject(item.resource, item.deal, network)
            let dealInFile = Caddyfile.find(o => o["@id"] === item.deal.id);
            //if resource is not on caddyfile already, add to payload
            if(!dealInFile) {
                if(item.resource.domain) {
                    this.addToQueue(this.queues.Minutely, item.deal.id, item);
                }
                payload.push(caddyData)
            } else {
                await this.upsertRecord(item, /* dealInFile, */ network)
            }
        }
        //Add to caddy file
        try {
            await axios.post(
                this.caddyRoutesUrl+"/...",
                payload,
                this.caddyReqCfg
            )
            if (env.debug) console.log('Added to caddy:', payload.length, "deals")
        } catch (e){
            console.log("axios error", e)
            return false
        }
    }

    static async upsertRecord(item, network){

        //Destroy previous custom cnames records associated to deal id
        let destroyed = await CaddySource.destroy({
            where: {
                deal_id: item.deal.id
            }
        })
        if (env.debug) if(destroyed) console.log("Removing CaddySources for:", item.deal.id)

        //Remove deal from queue
        await this.deletefromAllQueues(item.deal.id)

        //create Caddy object required to be posted on caddyFile
        let newCaddyData = await this.newObject(item.resource, item.deal, network)

        //if the resource has a custom cname
        if(item.resource.domain) {
            if (env.debug) console.log("Deal has domain:", item.resource.domain)
            await this.manageDomain(newCaddyData, item)
        }

        let recordId = this.caddyBaseUrl+"id/"+item.deal.id
        try {
            await axios.patch(
                recordId,
                newCaddyData,
                this.caddyReqCfg
            )
            if (env.debug) console.log('Updated Caddyfile resource:', item.deal.id)
        } catch (e){
            console.log("axios error", e)
            return false
        }

        return true
    }

    static async getRecords(){
        try {
            let resp = await axios.get(
                this.caddyRoutesUrl,
                this.caddyReqCfg
            )
            return resp.data
        } catch(e){
            //console.log("Axios error, status: " + e.response.status + " on " + url);
            console.log(e)
            return false;
        }
    }

    static async getResource(id){
        let url = this.caddyBaseUrl + 'id/' + id;
        try {
            let resp = await axios.get(
                url,
                this.caddyReqCfg
            )
            return resp.data
        } catch(e){
            if(e.response.status === 500){
                if (env.debug) console.log(`Record id ${id} not found on Caddyfile.`);
            } else {
                console.log("Axios error, status: " + e.response.status + " on " + url);
            }
            return false;
        }
    }

    static async getHosts(id){
        let url = this.caddyBaseUrl + 'id/' + id + '/match/0/host';
        try {
            let resp = await axios.get(
                url,
                this.caddyReqCfg
            )
            return resp.data
        } catch(e){
            if(e.response.status === 500){
                if (env.debug) console.log(`Record id ${id} not found on Caddyfile.`);
            } else {
                console.log("Axios error, status: " + e.response.status + " on " + url);
            }
            return false;
        }
    }

    static async deleteRecord(dealId){
        try {
            await CaddySource.destroy({ where: { deal_id: dealId } })

            await this.deletefromAllQueues(dealId)

            await axios.delete(
                this.caddyBaseUrl +'id/'+ dealId,
                this.caddyReqCfg
            )

            if (env.debug) console.log('Deleted from caddy:', dealId)
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
        }
    }


    static async updateCaddyHost(host, item){
        let cname_is_valid = await this.checkCname(item.resource.domain, host[0]);
        if (cname_is_valid) {
            await this.cleanUpCname(item.deal.id, item.resource.domain);
            host.push(item.resource.domain);
            await CaddySource.findOrCreate({
                where: {
                    host: item.resource.domain,
                    deal_id: item.deal.id
                }
            });
            obtainAndRenewCertificate({ host: item.resource.domain });
            return true;
        }
        return false;
    }

    static async manageDomain(caddyData, item){
        let host = caddyData.match[0].host;
        let hostUpdated = await this.updateCaddyHost(host, item);
        if (hostUpdated) {
            if (env.debug) console.log("Added CaddySources for domain:", item.resource.domain, item.resource.id);
        } else {
            if (env.debug) console.log("Adding domain to check queue.", item.resource.domain, item.resource.id);
            this.addToQueue(this.queues.Minutely, item.deal.id, item);
        }
    }

    static async patchRecord(item){
        if (item.resource.domain) {
            let host = await this.getHosts(item.deal.id);
            let hostUpdated = await this.updateCaddyHost(host, item);
            if (hostUpdated) {
                try {
                    if (env.debug) console.log('Patching caddy domain', host);
                    axios.patch(
                        this.caddyBaseUrl + 'id/' + item.deal.id + '/match/0/host',
                        JSON.stringify(host),
                        this.caddyReqCfg
                    );
                    return true;
                } catch(_) {
                    console.log("Error patching", item.deal.id);
                    return false;
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    }


    static async initApps(){
        try {
            await axios.post(
                this.caddyBaseUrl+"config/apps",
                config.caddyInitialApps,
                this.caddyReqCfg
            )
            await CaddySource.destroy({where: {}})
            console.log("Finished resetting Caddy records.", "\n")
            return true
        } catch (e){
            console.log(e)
            return false
        }
    }

    static async checkQueue(queue, current, limit){
        if (queue.length > 0) {
            if (env.debug) console.log(`Checking pending domains ${current} started. On queue: ${queue.length}`);
            for (let i = queue.length - 1; i >= 0; i--) {
                const item = queue[i];
                if (!item.retry) item.retry = 0;
                if (item.retry <= limit) {
                    item.retry++;
                    if (env.debug) console.log(`Retrying to apply custom domain ${item.resource.domain} (${item.retry})`);
                    const patched = await this.patchRecord(item);
                    if (patched) {
                        if (env.debug) console.log(`Removing pending domain from queue, patch success: ${item.resource.domain}`);
                        queue.splice(i, 1);
                    } else if (item.retry === limit) {
                        if (env.debug) console.log(`Domain exceeded retry limits, sending to next stage: ${item.resource.domain}`);
                        if (current === "Minutely") this.queues.Hourly.push(item);
                        else if (current === "Hourly") this.queues.Daily.push(item);
                        else if (current === "Daily") this.queues.Monthly.push(item);
                        else console.log(`Domain exceeded retry limits, checked for 12 months without restart: ${item.resource.domain}`);
                        queue.splice(i, 1);
                    }
                }
            }
            if (env.debug) console.log(`Checking pending domains ${current} ended. On queue: ${queue.length}`);
        }
    }

    static async isInQueue(id){
        return Object.values(this.queues).some(queue => queue.some(item => item.id === id));
    }

    static async deletefromAllQueues(id){
        for (const queue of Object.values(this.queues)) {
            const index = queue.findIndex(item => item.id === id);
            if (index !== -1) queue.splice(index, 1);
        }
    }

    static async addToQueue(queue, id, item){
        if (!this.isInQueue(id)) {
            queue.push({...item, id});
        }
    }

    static async checkCname(targetDomain,expectedDomain){
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

    static async cleanUpCname(deal_id, cname){
        let added = await this.isCnameAlreadyAdded(cname)
        if(added && added !== deal_id) await this.removeCname(added, cname)
        return true
    }

    static async isCnameAlreadyAdded(cname){
        try {
            let response = await axios.get(this.caddyRoutesUrl)
            for (const resource of response.data) {
                if (resource.match[0].host.includes(cname)) {
                    if (env.debug) console.log("Cname already added to another deal: "+resource["@id"])
                    return resource["@id"]
                }
            }
            return false
        } catch (e){
            console.log(e)
            return false
        }
    }

    static async removeCname(id, cname){
        try {
            //get all current domains for a given resource
            const hosts = await this.getHosts(id)
            const hostToRemove = hosts.indexOf(cname)
            //remove cname from resource
            hosts.splice(hostToRemove, 1)
            axios.patch(
                this.caddyBaseUrl + 'id/' + id + '/match/0/host',
                JSON.stringify(hosts),
                this.caddyReqCfg
            )
            //remove cname from CaddySources
            await CaddySource.destroy({ where: { host:cname } })
            return true
        } catch (e){
            console.log(e)
            return false
        }

    }

    static async areArraysEqual(array1, array2){
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

    static async compareDbAndCaddyData(dbDealIds, caddyDealIds){
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
}

module.exports = {CaddyController}