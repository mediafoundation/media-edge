import {env} from "../config/env";

import {generateSubdomain, generateTXTRecord} from "../utils/generateSubdomain";

import axios from "axios";

import {CertStatus, obtainAndRenewCertificate} from "../utils/certs";

import doh from "dohjs";

import {CaddySource} from "../models/caddy";

import {getHostName, isARecord} from "../utils/domains";
import {appConfig} from "../config/app"
import {providerData} from "../models/providerState"

const resolver = new doh.DohResolver('https://1.1.1.1/dns-query')




export const queues = {
    Minutely: [],
    Hourly: [],
    Daily: [],
    Monthly: []
};

const caddyBaseUrl = env.caddyUrl
const caddyRoutesUrl = caddyBaseUrl+'config/apps/http/servers/srv0/routes'
const caddyReqCfg = {
    headers: {
        'Content-Type': 'application/json'
    }
}

export class CaddyController {
    static async checkDomain(host){
        let domain = await CaddySource.findOne({
            where: { host: host },
            raw: true
        })
        if(env.debug) console.log(`Checking if domain ${host} is added to Caddy Database -> ${!!domain}`)
        return !!domain;
    }

    static async getCaddySources (attributes=null) {
        return await CaddySource.findAll({
            attributes: attributes,
            raw: true
        })
    }

    static async newObject(res, deal, network, privateKey: string){
        let hosts = []

        for(const host of env.hosts){
            hosts.push(`${generateSubdomain(env.MARKETPLACE_ID, deal.id, privateKey)}.${host}`)
        }

        let transport = res.protocol === "https" ?
            {
                "protocol": "http",
                "tls": { "insecure_skip_verify": true }
            } : {
                "protocol": "http"
            }

        let routes: {[index:string]: any}[] = [{
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

    static async addRecords (dealsResources, caddyFile, network, privateKey: string){
        let payload = []
        //let domains = []
        for(const item of dealsResources) {
            let caddyData = await this.newObject(item.resource, item.deal, network, privateKey)
            let dealInFile = caddyFile.find(o => o["@id"] === item.deal.id);
            //if resource is not on caddyfile already, add to payload
            if(!dealInFile) {
                //console.log("Item", item)
                if(item.domains && item.domains.length !== 0) {
                    for (const domain of item.domains) {
                      console.log("Domain", domain)
                      await this.addToQueue(queues.Minutely, domain.id, domain, item.resource.owner);
                    }
                }
                payload.push(caddyData)
            } else {
                await this.upsertRecord(item, /* dealInFile, */ network, privateKey)
            }
        }

        //Add to caddy file
        //console.log("Payload", payload.length, payload)
        //console.log("Domains", domains.length, domains)
        try {
            await axios.post(
                caddyRoutesUrl+"/...",
                payload,
                caddyReqCfg
            )
            if (env.debug) console.log('Added to caddy:', payload.length, "deals")
            /*for (const domain of domains) {
                await this.patchRecord(domain)
            }*/
        } catch (e){
            console.log("axios error", e)
            return false
        }


    }

    static async upsertRecord(item, network, privateKey){

        //console.log("Item on upsert record", item)

        //Destroy previous custom domains records associated to deal id
        let destroyed = await CaddySource.destroy({
            where: {
                deal_id: item.deal.id
            }
        })
        if (env.debug) if(destroyed) console.log("Removing CaddySources for:", item.deal.id)

        //Remove deal from queue
        await this.deleteFromAllQueuesByDeal(item.deal.id)

        //create Caddy object required to be posted on caddyFile
        let newCaddyData = await this.newObject(item.resource, item.deal, network, privateKey)

        //if the resource has a custom cname
        if(item.domains.length !== 0) {
            if (env.debug) console.log("Deal has domains:", item.domains)
            for (const domain of item.domains) {
                await this.addToQueue(queues.Minutely, domain.id, domain, item.resource.owner);
            }
        }

        let recordId = caddyBaseUrl+"id/"+item.deal.id
        try {
            await axios.patch(
                recordId,
                newCaddyData,
                caddyReqCfg
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
                caddyRoutesUrl,
                caddyReqCfg
            )
            return resp.data
        } catch(e){
            //console.log("Axios error, status: " + e.response.status + " on " + url);
            console.log(e)
            return false;
        }
    }

    static async getResource(id){
        let url = caddyBaseUrl + 'id/' + id;
        try {
            let resp = await axios.get(
                url,
                caddyReqCfg
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
        let url = caddyBaseUrl + 'id/' + id + '/match/0/host';
        try {
            let resp = await axios.get(
                url,
                caddyReqCfg
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

            await this.deleteFromAllQueuesByDeal(dealId)

            await axios.delete(
                caddyBaseUrl +'id/'+ dealId,
                caddyReqCfg
            )

            if (env.debug) console.log('Deleted from caddy:', dealId)
            //await Caddy.destroy({ where: { account:caddy.account }})
            return true
        } catch (e){
            console.log("Error when deleting from caddy:", e)
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
        //let cname_is_valid = await this.checkCname(item.domains.domain, host[0]);
        try {
            console.log("Update caddy host", host, item)
            await this.cleanUpCustomDomain(item.dealId, item.domain);

            //this modifies the host array that is passed by reference
            host.push(item.domain);

            await CaddySource.findOrCreate({
                where: {
                    host: item.domain,
                    deal_id: item.dealId
                }
            });
            //await obtainAndRenewCertificate({host: item.domains.domain});
            return true;
        } catch (e) {
            console.log("Error updating caddy host", e)
            return false
        }
    }

    static async manageDomain(caddyData, item){
        let host = caddyData.match[0].host;
        let hostUpdated = await this.updateCaddyHost(host, item);
        if (hostUpdated) {
            if (env.debug) console.log("Added CaddySources for domain:", item);
        } else {
            if (env.debug) console.log("Adding domain to check queue.", item);
            await this.addToQueue(queues.Minutely, item.id, item.item, item.owner);
        }
    }

    static async patchRecord(item){
        console.log("Item on patch record", item)
        /*if (item.domains.length !== 0) {

        } else {
            return false;
        }*/

        let host = await this.getHosts(item.item.dealId);
        let hostUpdated = await this.updateCaddyHost(host, item.item);
        if (hostUpdated) {
            try {
                if (env.debug) console.log('Patching caddy domain', host);
                await axios.patch(
                    caddyBaseUrl + 'id/' + item.item.dealId + '/match/0/host',
                    JSON.stringify(host),
                    caddyReqCfg
                );
                return true;
            } catch(_) {
                console.log("Error patching", item.item.dealId);
                return false;
            }
        } else {
            return false;
        }
    }


    static async initApps(){
        try {
            await axios.post(
                caddyBaseUrl+"config/apps",
                appConfig.caddyInitialApps,
                caddyReqCfg
            )
            await CaddySource.destroy({where: {}})
            console.log("Finished resetting Caddy records.", "\n")
            return true
        } catch (e){
            console.log(e)
            return false
        }
    }

    static async checkQueue(queue, current, limit, privateKey: string){
        console.log("Queue", queue)
        if (queue.length > 0) {
            if (env.debug) console.log(`Checking pending domains ${current} started. On queue: ${queue.length}`);
            for (let i = queue.length - 1; i >= 0; i--) {
                const item = queue[i];
                if (!item.retry) item.retry = 0;
                if (item.retry <= limit) {
                    item.retry++;
                    console.log("Item on check queue", item)
                    if (env.debug) console.log(`Retrying to apply custom domain ${item.item.domain} (${item.retry})`, item);
                    try{
                        const providerMetadata = providerData[privateKey]
                        let hostValid = await this.isRecordPointingCorrectly(item.item.domain, providerMetadata.a_record, providerMetadata.cname);
 /*                        let isA = isARecord(item.item.domain)

                        let hostValid = false

                        if(isA) {
                            for (const aElement of env.a_record) {
                                hostValid = await this.checkARecord(item.item.domain, aElement)
                                if(hostValid) break;
                            }
                        } else {
                            hostValid = await this.checkCname(item.item.domain, env.cname)
                        }*/

                        console.log("Host valid item", item)

                        let targetDomain = getHostName(item.item.domain)
                        let expectedValue = generateTXTRecord(item.owner, getHostName(item.item.domain), privateKey)

                        console.log("Params on generate txt record", item.owner, getHostName(item.item.domain))
                        console.log(`checking txt record for ${getHostName(item.item.domain)}`)
                        console.log("Expected value", expectedValue)
                        hostValid = await this.checkTxtRecord(
                          targetDomain,
                          expectedValue
                        )

                        console.log("Host valid", hostValid)

                        if(hostValid){

                            await this.patchRecord(item);
                            //todo: following function should return a boolean
                            let certificateObtainedStatus = await obtainAndRenewCertificate({host: item.item.domain});

                            if (certificateObtainedStatus === CertStatus.OBTAINED || certificateObtainedStatus === CertStatus.VALID) {
                                if (env.debug) console.log(`Removing pending domain from queue, patch success: ${item.item.domain}`);
                                //queue.splice(i, 1);
                                await this.deleteFromAllQueues(item.item.domain)
                                console.log("Queue after clean", queue)
                            } else if (item.retry === limit) {
                                if (env.debug) console.log(`Domain exceeded retry limits, sending to next stage: ${item.item}`);
                                if (current === "Minutely") queues.Hourly.push(item);
                                else if (current === "Hourly") queues.Daily.push(item);
                                else if (current === "Daily") queues.Monthly.push(item);
                                else console.log(`Domain exceeded retry limits, checked for 12 months without restart: ${item.item}`);
                                queue.splice(i, 1);
                            }
                        }
                    } catch (e) {
                        console.log("Error checking queue for item:", item, e)
                    }
                }
            }
            if (env.debug) console.log(`Checking pending domains ${current} ended. On queue: ${queue.length}`);
        }
    }

    static async isInQueue(id){
        return Object.values(queues).some(queue => queue.some(item => item.id === id));
    }

    static async deleteFromAllQueues(domain){
        for (const queue of Object.values(queues)) {
            const index = queue.findIndex(item => item.item.domain === domain);
            if (index !== -1) queue.splice(index, 1);
        }
    }

    static async deleteFromAllQueuesByDeal(dealId){
        for (const queue of Object.values(queues)) {
            const index = queue.findIndex(item => item.item.dealId === dealId);
            if (index !== -1) {
                queue.splice(index, 1);
                console.log("Deleted from queue dealId:", dealId)
            }

        }
    }

    static async addToQueue(queue, id, item, owner){
        if (!await this.isInQueue(id)) {
            queue.push({id, item, owner});
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

    static async checkARecord(targetDomain,expectedDomain){
        try {
            let response = await resolver.query(targetDomain, 'A')
            if(response.answers.length > 0){
                let answers = [];
                response.answers.forEach(ans => answers.push(ans.data))
                return answers.includes(expectedDomain);
            }
            return false
        } catch (e) {
            console.log(e)
            return false
        }
    }

    static async checkTxtRecord(targetDomain, expectedTxtRecord){
        try {
            let response = await resolver.query("_medianetwork."+targetDomain, 'TXT')
            console.log(`checking txt record for _medianetwork.${targetDomain}`)
            if(response.answers.length > 0){
                let answers = [];
                for (const answer of response.answers) {
                  answers.push(answer.data.toString())
                }
                console.log(`Answers for _medianetwork.${targetDomain}`, answers)
                return answers.includes(expectedTxtRecord);
            }
            return false
        } catch (e) {
            console.log(e)
            return false
        }
    }

    static async isRecordPointingCorrectly(targetDomain, a_record, cname){
      let isA = isARecord(targetDomain)

      let hostValid = false

      if(isA) {
          for (const aElement of a_record) {
              hostValid = await this.checkARecord(targetDomain, aElement)
              if(hostValid) break;
          }
      } else {
          hostValid = await this.checkCname(targetDomain, cname)
      }

      return hostValid;
    }

    static async cleanUpCustomDomain(deal_id, cname){
        let added = await this.isCustomDomainAlreadyAdded(cname)
        if(added && added !== deal_id) await this.removeCustomDomain(added, cname)
        return true
    }

    static async isCustomDomainAlreadyAdded(host){
        try {
            let response = await axios.get(caddyRoutesUrl)
            for (const resource of response.data) {
                //console.log("Response for cnameAlreadyAdded", resource)
                if (resource.match[0].host.includes(host)) {
                    if (env.debug) console.log(`Domain ${host} already added to another deal: ${resource["@id"]}`)
                    return resource["@id"]
                }
            }
            return false
        } catch (e){
            console.log(e)
            return false
        }
    }

    static async removeCustomDomain(id, host){
        try {
            //get all current domains for a given resource
            const hosts = await this.getHosts(id)
            const hostToRemove = hosts.indexOf(host)
            //remove host from resource
            hosts.splice(hostToRemove, 1)
            axios.patch(
                caddyBaseUrl + 'id/' + id + '/match/0/host',
                JSON.stringify(hosts),
                caddyReqCfg
            )
            //remove host from CaddySources
            await CaddySource.destroy({ where: { host } })
            if (env.debug) console.log(`Removed domain ${host} from deal ${id}`)
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

//module.exports = {CaddyController, queues}