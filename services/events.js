const models = require("../models");
let checkEvents = async (MarketplaceInstance, ResourcesInstance, lastReadBlock, CURRENT_NETWORK) => {

    let blockNumber = await web3.eth.getBlockNumber()

    let updatedResources = await ResourcesInstance.getPastEvents('UpdatedResource', {
        fromBlock: lastReadBlock + 1,
        toBlock: blockNumber
    })

    let removedResources = await ResourcesInstance.getPastEvents('RemovedResource', {
        fromBlock: lastReadBlock + 1,
        toBlock: blockNumber
    })

    let createdDeals = await MarketplaceInstance.getPastEvents('DealCreated', {
        fromBlock: lastReadBlock + 1,
        toBlock: blockNumber
    })

    let cancelledDeals = await MarketplaceInstance.getPastEvents('DealCancelled', {
        fromBlock: lastReadBlock + 1,
        toBlock: blockNumber
    })

    let acceptedDeals = await MarketplaceInstance.getPastEvents('DealAccepted', {
        fromBlock: lastReadBlock + 1,
        toBlock: blockNumber
    })

    if (typeof updatedResources !== "undefined" && updatedResources.length > 0) {
        for (const event of updatedResources) {
            let deals = await models.Deals.dealsThatHasResource(event.returnValues._id)
            if(deals.length > 0){
                let resource = await models.Evm.getResource(ResourcesInstance, event.returnValues._id)
                let formattedResource = await models.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK.name)
                await models.Evm.addRecord(formattedResource)

                for (const deal of deals) {
                    //Check if cname is added or deleted
                    let caddyRecords = await models.Caddy.getRecord(deal.id)
                    let dbRecords = []
                    if(formattedResource.domain){
                        dbRecords.push(formattedResource.domain)
                    }
                    dbRecords.push(...(await models.Caddy.getHostname(deal)))

                    if(!models.Caddy.areArraysEqual(dbRecords, caddyRecords)){
                        await models.Caddy.updateRecord({resource: formattedResource, deal: deal.dataValues}, caddyRecords)
                    }
                }
            }
        }
    }

    if (typeof removedResources !== "undefined" && removedResources.length > 0) {
        for (const event of removedResources) {
            await models.Evm.deleteRecords(event.returnValues._id)
        }
    }

    if (typeof createdDeals !== "undefined" && createdDeals.length > 0) {
        await manageDealCreatedOrAccepted(MarketplaceInstance, ResourcesInstance, events, CURRENT_NETWORK)
    }

    if(typeof cancelledDeals !== "undefined" && cancelledDeals.length > 0){
        //console.log(events)
        //await models.Caddy.deleteRecord()
        for (const event of events) {
            //delete deal from caddy and db
            await models.Caddy.deleteRecord(event.returnValues._dealId)
            await models.Deals.deleteRecords(event.returnValues._dealId)

            //Check if the resource associated to that deal has any other deals or need to be removed
            let deal = await models.Deals.getDeal(MarketplaceInstance, event.returnValues._dealId)
            let dealsOfResource = await models.Deals.dealsThatHasResource(deal.resourceId)

            if(dealsOfResource.length === 0){
                console.log("Resource Id", deal.resourceId)
                await models.Evm.deleteRecords(deal.resourceId)
            }
        }
    }

    if (typeof acceptedDeals !== "undefined" && acceptedDeals.length > 0) {
        await manageDealCreatedOrAccepted(MarketplaceInstance, ResourcesInstance, events, CURRENT_NETWORK)
    }
    
    return blockNumber
}

let manageDealCreatedOrAccepted = async (MarketplaceInstance, ResourcesInstance, events, CURRENT_NETWORK) => {
    for (const event of events) {
        let deal = await models.Deals.getDeal(MarketplaceInstance, event.returnValues._dealId)
        let resource = await models.Evm.getResource(ResourcesInstance, deal.resourceId)
        if (await models.Deals.dealIsActive(deal) !== false && deal.active !== false) {
            let dealFormatted = models.Deals.formatDataToDb(deal)
            let resourceFormatted = models.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK.name)

            //console.log(dealFormatted, resourceFormatted)
            await models.Deals.addRecord(dealFormatted)
            await models.Evm.addRecord(resourceFormatted)
            await models.Caddy.addRecord({resource: resourceFormatted, deal: dealFormatted})
        }
    }
}

module.exports = {checkEvents}