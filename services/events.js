const models = require("../models");
let checkEvents = async (MarketplaceInstance, ResourcesInstance, lastReadBlock, CURRENT_NETWORK) => {
    //Resources events
    await ResourcesInstance.getPastEvents('UpdatedResource', {
        fromBlock: lastReadBlock + 1,
        toBlock: 'latest'
    }, async (error, events) => {
        //console.log("Updated resource:", events, events.length > 0)
        if (events.length > 0) {
            for (const event of events) {
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
    })

    await ResourcesInstance.getPastEvents('RemovedResource', {
        fromBlock: lastReadBlock + 1,
        toBlock: 'latest'
    }, async (error, events) => {
        //console.log("Updated resource:", events, events.length > 0)
        if (events.length > 0) {
            for (const event of events) {
                await models.Evm.deleteRecords(event.returnValues._id)
            }
        }
    })

    //Marketplace events
    await MarketplaceInstance.getPastEvents('DealCreated', {
        fromBlock: lastReadBlock + 1,
        toBlock: 'latest'
    }, async (error, events) => {
        //console.log("Deal created", events, events.length > 0)
        if (events.length > 0) {
            await manageDealCreatedOrAccepted(MarketplaceInstance, ResourcesInstance, events, CURRENT_NETWORK)
        }
    })

    await MarketplaceInstance.getPastEvents('DealCancelled', {
        fromBlock: lastReadBlock + 1,
        toBlock: 'latest'
    }, async (error, events) => {
        //console.log("Cancelled deal:", events, events.length > 0)
        if(events.length > 0){
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
    })

    await MarketplaceInstance.getPastEvents('DealAccepted', {
        fromBlock: lastReadBlock + 1,
        toBlock: 'latest'
    }, async (error, events) => {
        //console.log("Deal created", events, events.length > 0)
        if (events.length > 0) {
            await manageDealCreatedOrAccepted(MarketplaceInstance, ResourcesInstance, events, CURRENT_NETWORK)
        }
    })
    
    return true
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