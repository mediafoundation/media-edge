const models = require("../models");
const env = require("../config/env")
const http = require('http');

let caddyNeedsUpdate = false

let initCaddy = async function(network){
    let caddyRecords = await models.Caddy.getRecords()
    if(!caddyRecords){
        await models.Caddy.initApps()
        caddyRecords = await models.Caddy.getRecords()
    }

    let dealsFromDB = await models.Deals.getDealsFromDb()
    let resourcesFromDB = await models.Resources.getResources()

    let matchDealResources = []

    dealsFromDB.forEach(deal => {
        let matchDealResource = {}
        matchDealResource.deal = deal
        matchDealResource.resource = resourcesFromDB.find(resource => resource.id === deal.resourceId)
        matchDealResources.push(matchDealResource)
    })

    await models.Caddy.addRecords(matchDealResources, caddyRecords, network)

    let caddyFile = await models.Caddy.getRecords()

    let difference = await models.Caddy.compareDbAndCaddyData(
        dealsFromDB.map(deal => deal.id),
	    caddyFile.map(obj => obj['@id']).filter(id => id)
    )
    
    for (const deal of difference) {
        await models.Caddy.deleteRecord(deal)
    }

    await models.Caddy.checkQueue(models.Caddy.queues.Minutely, "Minutely", 60)
}

let checkDealsShouldBeActive = async function(network){
    //get all deals
    //console.log("Checking deal")
    let deals = await models.Deals.getDealsFromDb()
    let dealsToDelete = []
    let resourcesToDelete = []
    for (const deal of deals) {
        let dealIsActive = await models.Deals.dealIsActive(deal)
        if(!dealIsActive){
            dealsToDelete.push(deal.id)
            //Check if deleted deal's resource has another deals or need to be removed
            let dealsOfResource = await models.Deals.dealsThatHasResource(deal.resourceId)
            if(dealsOfResource.length === 1){
                //remove resource too
                //await models.Resources.deleteRecords(deal.resourceId)
                resourcesToDelete.push(deal.resourceId)
            }
        }
    }

    //Delete deals from db

    if(dealsToDelete.length > 0){
        console.log("Deals id to delete:", dealsToDelete)
        await models.Deals.deleteRecords(dealsToDelete)
        await models.Resources.deleteRecords(resourcesToDelete)

        //Delete deals from caddy
        for (const dealToDelete of dealsToDelete) {
            models.Caddy.deleteRecord(dealToDelete, network)
        }
    }
}

let checkQueue = () => {
    setInterval(() => models.Caddy.checkQueue(models.Caddy.queues.Minutely, "Minutely", 60), 60000);
    setInterval(() => models.Caddy.checkQueue(models.Caddy.queues.Hourly, "Hourly", 24), 3600000);
    setInterval(() => models.Caddy.checkQueue(models.Caddy.queues.Daily, "Daily", 30), 86400*1000);
    setInterval(() => models.Caddy.checkQueue(models.Caddy.queues.Monthly, "Monthly", 12), 259200*1000);
}

let checkCaddy = async (network) => {
    let url = new URL(env.caddyUrl)
    let host = url.hostname
    let port = url.port
    const options = {
        host: host,
        port: port,
        path: '/config'
    };


    try {
        const request = http.request(options);
        await new Promise((resolve, reject) => {
            request.on('response', (response) => {
                resolve(response.statusCode === 200);
            });
            request.on('error', (error) => {
                reject(error);
            });
            request.end();
        });
        if(caddyNeedsUpdate){
            try{
                console.log("Caddy failed, trying to restart")
                await initCaddy()
                caddyNeedsUpdate = false
            }catch (e) {
                console.log("Error restarting caddy:", e)
                caddyNeedsUpdate = true
            }
        }
    } catch (error) {
        console.error('Error checking Caddy server:', error);
        caddyNeedsUpdate = true

    }
}

module.exports = {initCaddy, checkDealsShouldBeActive, checkQueue, checkCaddy}
