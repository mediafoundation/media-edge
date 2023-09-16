const db = require("../models");
const env = require("../config/env")
const initDatabase = async function (ResourcesContract, MarketplaceContract, network, web3Instance) {
    //fetch resources and deals
    let resources = await db.Resources.getPaginatedResources(ResourcesContract, 0, 2);


    let deals = await db.Deals.getPaginatedDeals(MarketplaceContract, 0, 2)

    if(resources === undefined || deals === undefined){
        throw "Error fetching deals and resources"
    }

    let dealsToDelete = []

    //add to an array all the deal's id to delete
    for (let i = 0; i < deals.length; i++) {
        let dealFormatted = db.Deals.formatDataToDb(deals[i], network)
        if (await db.Deals.dealIsActive(dealFormatted) === false || dealFormatted.active === false) {
            dealsToDelete.push(deals[i].id)
        }
    }

    //delete deal from the array of deals
    for (let i = 0; i < dealsToDelete.length; i++) {
        let indexToDelete = deals.map(deal => deal.id).indexOf(dealsToDelete[i])
        deals.splice(indexToDelete, 1)
    }

    //check which resources are not in an active deal
    let resourcesIds = resources.map(obj => obj.resource_id)
    let dealResourcesIds = deals.map(obj => obj.resourceId)
    let resourcesToDelete = await db.Resources.compareDealsResourcesWithResources(dealResourcesIds, resourcesIds)
    let resourcesToBeUpdatedInCaddy = []

    //delete resource from the array of resources
    for (let i = 0; i < resourcesToDelete.length; i++) {
        let indexToDelete = resources.map(deal => deal.resource_id).indexOf(resourcesToDelete[i])
        resources.splice(indexToDelete, 1)
    }

    //upsert records in db
    for (const resource of resources) {
        let resourceFormatted = db.Resources.formatDataToDb(resource.resource_id, resource.owner, resource.data, network)
        //store formated resources to be use in caddy
        //formattedResources.push(resourceFormatted)
        let evmRecord = await db.Resources.addRecord(resourceFormatted)
        //console.log(evmRecord);
        if(evmRecord.length > 0){
            if (evmRecord.includes('origin') || evmRecord.includes('protocol') || evmRecord.includes('path')) {
                resourcesToBeUpdatedInCaddy.push(resourceFormatted)
            }
        }
    }

    for (const deal of deals) {
        let dealFormatted = db.Deals.formatDataToDb(deal, network)
        await db.Deals.addRecord(dealFormatted)
    }

    //delete records that are in db but not in blockchain
    resourcesIds = resources.map(obj => obj.resource_id + "_" + network.network_id + "_" + network.chain_id + "_" + env.MARKETPLACE_ID)
    let notCompatibleResources = await db.Resources.compareBlockchainAndDbData(resourcesIds)

    if (notCompatibleResources.length > 0) {
        await db.Resources.deleteRecords(notCompatibleResources)
    }

    let dealsIds = deals.map(obj => obj.id + "_" + network.network_id + "_" + network.chain_id + "_" + env.MARKETPLACE_ID)
    let notCompatibleDeals = await db.Deals.compareBlockchainAndDbData(dealsIds)

    if (notCompatibleDeals.length > 0) {
        await db.Deals.deleteRecords(notCompatibleDeals)
        await db.DealsBandwidth.deleteRecords(notCompatibleDeals)
    }

    //Update records in caddy if needed
    for (const resource of resourcesToBeUpdatedInCaddy) {
        let deals = await db.Deals.dealsThatHasResource(resource.id)
        for (const deal of deals) {
            let caddyHosts = await db.Caddy.getHosts(deal.id)
            await db.Caddy.upsertRecord({resource: resource, deal: deal}, /* caddyHosts,  */network)
        }
    }
}

module.exports = {initDatabase}