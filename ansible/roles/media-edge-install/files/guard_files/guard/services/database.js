const db = require("../models");
const initDatabase = async function (ResourcesContract, MarketplaceContract, network, web3Instance) {
    //fetch resources and deals
    let resources = await db.Evm.getPaginatedResources(ResourcesContract, 0, 2);


    let deals = await db.Deals.getPaginatedDeals(MarketplaceContract, 0, 2)

    if(resources === undefined || deals === undefined){
        throw "Error fetching deals and resources"
    }

    let dealsToDelete = []

    //add to an array all the deal's id to delete
    for (let i = 0; i < deals.length; i++) {
        if (await db.Deals.dealIsActive(deals[i]) === false || deals[i].active === false) {
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
    let resourcesToDelete = await db.Evm.compareDealsResourcesWithResources(dealResourcesIds, resourcesIds)

    //delete resource from the array of resources
    for (let i = 0; i < resourcesToDelete.length; i++) {
        let indexToDelete = resources.map(deal => deal.resource_id).indexOf(resourcesToDelete[i])
        resources.splice(indexToDelete, 1)
    }

    //upsert records in db
    for (const resource of resources) {
        let resourceFormatted = db.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, network)
        //store formated resources to be use in caddy
        //formattedResources.push(resourceFormatted)
        await db.Evm.addRecord(resourceFormatted)
    }

    for (const deal of deals) {
        let dealFormatted = db.Deals.formatDataToDb(deal, network)
        await db.Deals.addRecord(dealFormatted)
    }

    //delete records that are in db but not in blockchain
    resourcesIds = resources.map(obj => obj.resource_id + "_" + network.network_id + "_" + network.chain_id)
    let notCompatibleResources = await db.Evm.compareBlockchainAndDbData(resourcesIds)

    if (notCompatibleResources.length > 0) {
        await db.Evm.deleteRecords(notCompatibleResources)
    }

    let dealsIds = deals.map(obj => obj.id + "_" + network.network_id + "_" + network.chain_id)
    let notCompatibleDeals = await db.Deals.compareBlockchainAndDbData(dealsIds)

    if (notCompatibleDeals.length > 0) {
        await db.Deals.deleteRecords(notCompatibleDeals)
    }
}

module.exports = {initDatabase}