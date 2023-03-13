const models = require("../models");
let checkEvents = async (MarketplaceInstance, ResourcesInstance, lastReadBlock) => {
    //Marketplace events
    await MarketplaceInstance.getPastEvents('DealCreated', {
        fromBlock: lastReadBlock + 1,
        toBlock: 'latest'
    }, async (error, events) => {
        if (events !== undefined) {
            for (const event of events) {
                let deal = await models.Deals.getDeal(MarketplaceInstance, event.returnValues._dealId)
                let resource = await models.Evm.getResource(ResourcesInstance, deal.resourceId)
                if (await models.Deals.dealIsActive(deal) !== false && deal.active !== false) {
                    let dealFormatted = models.Deals.formatDataToDb(deal)
                    let resourceFormatted = models.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK.name)

                    console.log(dealFormatted, resourceFormatted)
                    await models.Deals.addRecord(dealFormatted)
                    await models.Evm.addRecord(resourceFormatted)
                    await models.Caddy.addRecord({resource: resourceFormatted, deal: dealFormatted})
                }
            }
        }
    })

    //Resources events
    await ResourcesInstance.getPastEvents('UpdatedResource', {
        fromBlock: lastReadBlock + 1,
        toBlock: 'latest'
    }, async (error, events) => {
        if (events !== undefined) {
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

    //todo: check if add resource is not useful for the events
    /*await ResourcesInstance.getPastEvents('AddedResource', {
        fromBlock: lastReadBlock + 1,
        toBlock: 'latest'
    }, async (error, events) => {
        if(events !== undefined){
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
    })*/


}

module.exports = checkEvents