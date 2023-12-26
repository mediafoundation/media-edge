const env = require("../config/env")
const http = require('http');
const {CaddyController, queues} = require("../controllers/caddyController");
const {DealsController} = require("../controllers/dealsController");
const {ResourcesController} = require("../controllers/resourcesController");

let caddyNeedsUpdate = false

let initCaddy = async function(network){
    let caddyRecords = await CaddyController.getRecords()
    if(!caddyRecords){
        await CaddyController.initApps()
        caddyRecords = await CaddyController.getRecords()
    }

    let dealsFromDB = await DealsController.getDeals()
    let resourcesFromDB = await ResourcesController.getResources()

    let matchDealResources = []

    for (const deal of dealsFromDB) {
        let matchDealResource = {}
        matchDealResource.deal = deal
        let dealsResource = await DealsController.getDealResource(deal.id)
        matchDealResource.resource = resourcesFromDB.find(resource => resource.id === dealsResource.resourceId)
        matchDealResources.push(matchDealResource)
    }

    await CaddyController.addRecords(matchDealResources, caddyRecords, network)

    let caddyFile = await CaddyController.getRecords()

    let difference = await CaddyController.compareDbAndCaddyData(
        dealsFromDB.map(deal => deal.id),
	    caddyFile.map(obj => obj['@id']).filter(id => id)
    )
    
    for (const deal of difference) {
        await CaddyController.deleteRecord(deal)
    }

    await CaddyController.checkQueue(queues.Minutely, "Minutely", 60)
}

let checkDealsShouldBeActive = async function(){
    //get all deals
    //console.log("Checking deal")
    let deals = await DealsController.getDeals()
    let dealsToDelete = []
    let resourcesToDelete = []
    for (const deal of deals) {
        let dealIsActive = deal.active === true
        if(!dealIsActive){
            dealsToDelete.push(deal.id)
            //Check if deleted deal's resource has another deals or need to be removed
            let dealsOfResource = await ResourcesController.getNumberOfMatchingDeals(deal.resourceId)
            if(dealsOfResource.length === 1){
                if(env.debug) console.log("deals of resource", dealsOfResource)
                //remove resource too
                //await models.Resources.deleteRecords(deal.resourceId)
                resourcesToDelete.push(deal.resourceId)
            }
        }
    }

    //Delete deals from db

    if(dealsToDelete.length > 0){
        console.log("Deals id to delete:", dealsToDelete)
        /*await models.Deals.deleteRecords(dealsToDelete)
        await models.Resources.deleteRecords(resourcesToDelete)*/

        //Delete deals from caddy
        for (const dealToDelete of dealsToDelete) {
            await CaddyController.deleteRecord(dealToDelete)
            await DealsController.deleteDealById(dealToDelete.id)
        }

        for (const resource of resourcesToDelete) {
            await ResourcesController.deleteResourceById(resource.id)
        }
    }
}

let checkQueue = () => {
    setInterval(() => CaddyController.checkQueue(queues.Minutely, "Minutely", 60), 60000);
    setInterval(() => CaddyController.checkQueue(queues.Hourly, "Hourly", 24), 3600000);
    setInterval(() => CaddyController.checkQueue(queues.Daily, "Daily", 30), 86400*1000);
    setInterval(() => CaddyController.checkQueue(queues.Monthly, "Monthly", 12), 259200*1000);
}

let checkCaddy = async () => {
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
