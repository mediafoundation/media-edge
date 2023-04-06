const models = require("../models")
const env = require("../config/env")

let checkEvents = async (MarketplaceInstance, ResourcesInstance, lastReadBlock, CURRENT_NETWORK, web3) => {
    let blockNumber = lastReadBlock + 1
    let updatedResources = undefined
    let removedResources = undefined
    let createdDeals = undefined
    let cancelledDeals = undefined
    let acceptedDeals = undefined

    try {

        blockNumber = await web3.eth.getBlockNumber()
        
        if(env.debug) console.log("Last readed block", lastReadBlock)
        if(env.debug) console.log("Current block", blockNumber)

        updatedResources = await ResourcesInstance.getPastEvents('UpdatedResource', {
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

        removedResources = await ResourcesInstance.getPastEvents('RemovedResource', {
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

        createdDeals = await MarketplaceInstance.getPastEvents('DealCreated', {
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

        cancelledDeals = await MarketplaceInstance.getPastEvents('DealCancelled', {
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

        acceptedDeals = await MarketplaceInstance.getPastEvents('DealAccepted', {
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

    } catch(e){
        console.log(e)
        return false
    }

    if (typeof updatedResources !== "undefined" && updatedResources.length > 0) {
        console.log("Update resource");
        for (const event of updatedResources) {
            let deals = await models.Deals.dealsThatHasResource(formatIdForDB(event.returnValues._id, CURRENT_NETWORK))
            if(deals.length > 0){
                let resource = await models.Evm.getResource(ResourcesInstance, event.returnValues._id)
                if(resource !== false){
                    let formattedResource = await models.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK)
                    let evmRecord = await models.Evm.addRecord(formattedResource)

                    for (const deal of deals) {
                        //Check if cname is added or deleted
                        let caddyRecords = await models.Caddy.getRecord(deal.id, CURRENT_NETWORK)
                        let dbRecords = []
                        if(formattedResource.domain){
                            dbRecords.push(formattedResource.domain)
                        }
                        dbRecords.push(...(await models.Caddy.getHostname(deal)))

                        //Check change of domain
                        if(!models.Caddy.areArraysEqual(dbRecords, caddyRecords)){
                            await models.Caddy.updateRecord({resource: formattedResource, deal: deal.dataValues}, caddyRecords, CURRENT_NETWORK)
                        }
                        
                        //Check change of resource data
                        if(evmRecord.length > 0){
                            if (evmRecord.includes('origin') || evmRecord.includes('protocol') || evmRecord.includes('path')) {
                                let caddyHosts = await models.Caddy.getRecord(deal.id)
                                await models.Caddy.updateRecord({resource: formattedResource, deal: deal}, caddyHosts)
                            }
                        }
                    }
                }
            }
        }
    }

    if (typeof removedResources !== "undefined" && removedResources.length > 0) {
        for (const event of removedResources) {
            await models.Evm.deleteRecords(formatIdForDB(event.returnValues._id, CURRENT_NETWORK))
        }
    }

    if (typeof createdDeals !== "undefined" && createdDeals.length > 0) {
        await manageDealCreatedOrAccepted(MarketplaceInstance, ResourcesInstance, createdDeals, CURRENT_NETWORK)
    }

    if(typeof cancelledDeals !== "undefined" && cancelledDeals.length > 0){
        //console.log(events)
        //await models.Caddy.deleteRecord()
        for (const event of cancelledDeals) {
            //delete deal from caddy and db

            await models.Caddy.deleteRecord(formatIdForDB(event.returnValues._dealId, CURRENT_NETWORK))
            await models.Deals.deleteRecords([formatIdForDB(event.returnValues._dealId, CURRENT_NETWORK)])

            //Check if the resource associated to that deal has any other deals or need to be removed
            let deal = await models.Deals.getDeal(MarketplaceInstance, event.returnValues._dealId)
            let dealsOfResource = await models.Deals.dealsThatHasResource(formatIdForDB(deal.resourceId, CURRENT_NETWORK))

            if(dealsOfResource.length === 0){
                console.log("Resource Id", deal.resourceId)
                await models.Evm.deleteRecords([formatIdForDB(deal.resourceId, CURRENT_NETWORK)])
            }
        }
    }

    if (typeof acceptedDeals !== "undefined" && acceptedDeals.length > 0) {
        await manageDealCreatedOrAccepted(MarketplaceInstance, ResourcesInstance, acceptedDeals, CURRENT_NETWORK)
    }
    
    return blockNumber
}

let manageDealCreatedOrAccepted = async (MarketplaceInstance, ResourcesInstance, events, CURRENT_NETWORK) => {
    for (const event of events) {
        let deal = await models.Deals.getDeal(MarketplaceInstance, event.returnValues._dealId)
        let resource = await models.Evm.getResource(ResourcesInstance, deal.resourceId)
        if(resource !== false){
            if (await models.Deals.dealIsActive(deal) !== false && deal.active !== false) {
                let dealFormatted = models.Deals.formatDataToDb(deal, CURRENT_NETWORK)
                let resourceFormatted = models.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK)
    
                //console.log(dealFormatted, resourceFormatted)
                await models.Deals.addRecord(dealFormatted)
                await models.Evm.addRecord(resourceFormatted)
                await models.Caddy.addRecord({resource: resourceFormatted, deal: dealFormatted}, CURRENT_NETWORK)
            }
        }
    }
}

let formatIdForDB = (id, network) => {
    return id + "_" + network.network_id + "_" + network.chain_id
}

module.exports = {checkEvents}