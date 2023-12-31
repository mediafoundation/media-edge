const env = require("../config/env")
const { EventHandler, Resources, Encryption, Marketplace, Blockchain} = require("media-sdk");
const { DealsController } = require("../controllers/dealsController");
const { ResourcesController } = require("../controllers/resourcesController");
const { CaddyController } = require("../controllers/caddyController");
const { z } = require("zod");
const { DealsMetadataType } = require("../models/deals/DealsMetadata");
const { BandwidthController } = require("../controllers/bandwidthController");
const {filterDomainsMatchingDeals} = require("../utils/resources");

let checkEvents = async (lastReadBlock, CURRENT_NETWORK) => {
    //let blockNumber = lastReadBlock + 1
    let updatedResources = undefined
    let removedResources = undefined
    let createdDeals = undefined
    let cancelledDeals = undefined
    let acceptedDeals = undefined
    let blockchain = new Blockchain()
    let blockNumber = await blockchain.getBlockNumber()
    let toNumber = Number(blockNumber)

    try {
        let eventsHandler = new EventHandler()

        if (env.debug && blockNumber !== lastReadBlock) {
            console.log("Last read block", lastReadBlock)
            console.log("Current block", blockNumber)
        }
        updatedResources = await eventsHandler.getResourcesPastEvents({
            eventName: 'UpdatedResource',
            fromBlock: lastReadBlock,
            toBlock: toNumber
        })

        removedResources = await eventsHandler.getResourcesPastEvents({
            eventName: 'RemovedResource',
            fromBlock: lastReadBlock,
            toBlock: toNumber
        })

        createdDeals = await eventsHandler.getMarketplacePastEvents({
            eventName: 'DealCreated',
            fromBlock: lastReadBlock,
            toBlock: toNumber
        })

        cancelledDeals = await eventsHandler.getMarketplacePastEvents({
            eventName: 'DealCancelled',
            fromBlock: lastReadBlock,
            toBlock: toNumber
        })

        acceptedDeals = await eventsHandler.getMarketplacePastEvents({
            eventName: 'DealAccepted',
            fromBlock: lastReadBlock,
            toBlock: toNumber
        })

        console.log("Updated resources", updatedResources.length)
        console.log("Removed resources", removedResources.length)
        console.log("Created deals", createdDeals.length)
        console.log("Cancelled deals", cancelledDeals.length)
        console.log("Accepted deals", acceptedDeals.length)

    } catch (e) {
        console.log(e)
        return false
    }

    if (typeof updatedResources !== "undefined" && updatedResources.length > 0) {
        console.log("Update resource");
        for (const event of updatedResources) {
            let dealIds = await ResourcesController.getNumberOfMatchingDeals(
                event.args._id,
            )
            if (dealIds.length > 0) {
                let resource = await ResourcesController.getResourceById(event.args._id)
                if (resource !== false) {
                    /*let formattedResource = await ResourcesController.(
                        resource.resource_id, 
                        resource.owner, 
                        resource.data, 
                        CURRENT_NETWORK
                    )*/

                    let resources = new Resources()
                    let resourceFromEvm = resources.getResource({ id: event.args._id, address: env.WALLET })

                    let attr = JSON.parse(resourceFromEvm.encryptedData)
                    let decryptedSharedKey = await Encryption.ethSigDecrypt(
                        resourceFromEvm.encryptedSharedKey,
                        env.PRIVATE_KEY
                    );

                    let decrypted = Encryption.decrypt(
                        decryptedSharedKey,
                        attr.iv,
                        attr.tag,
                        attr.encryptedData
                    );

                    let data = JSON.parse(decrypted)

                    let upsertResourceResult = await ResourcesController.upsertResource({ id: resourceFromEvm.id, owner: resourceFromEvm.owner, ...data })

                    for (const id of dealIds) {
                        let deal = await DealsController.getDealById(id)
                        await CaddyController.upsertRecord(
                            {
                                resource: upsertResourceResult.instance,
                                deal: deal
                            },
                            CURRENT_NETWORK
                        )

                        /*                         //Check if cname is added or deleted
                                                let caddyRecords = await models.Caddy.getHosts(deal.id, CURRENT_NETWORK)
                                                let dbRecords = []
                                                if(formattedResource.domain){
                                                    dbRecords.push(formattedResource.domain)
                                                }
                                                dbRecords.push(...(await models.Caddy.getHosts(deal)))
                        
                                                //Check change of domain
                                                if(!models.Caddy.areArraysEqual(dbRecords, caddyRecords)){
                                                    await models.Caddy.upsertRecord({
                                                        resource: formattedResource, 
                                                        deal: deal.dataValues
                                                    })
                                                }
                                                
                                                //Check change of resource data
                                                if(evmRecord.length > 0){
                                                    if (
                                                        evmRecord.includes('origin') || 
                                                        evmRecord.includes('protocol') || 
                                                        evmRecord.includes('path')
                                                    ) {
                                                        await models.Caddy.upsertRecord({
                                                            resource: formattedResource, 
                                                            deal: deal
                                                        })
                                                    }
                                                } */
                    }
                }
            }
        }
    }

    if (typeof removedResources !== "undefined" && removedResources.length > 0) {
        for (const event of removedResources) {
            await ResourcesController.deleteResourceById(event.args._id)
        }
    }

    if (typeof createdDeals !== "undefined" && createdDeals.length > 0) {
        await manageDealCreatedOrAccepted(createdDeals, CURRENT_NETWORK)
    }

    if (typeof cancelledDeals !== "undefined" && cancelledDeals.length > 0) {
        //console.log(events)
        //await models.Caddy.deleteRecord()
        for (const event of cancelledDeals) {
            try{
                let deal = await DealsController.getDealById(event.args._dealId)

                //Check if the resource associated to that deal has any other deals or need to be removed
                let dealResource = await DealsController.getDealResource(deal.id)
                console.log("DealResource", dealResource)
                let dealsOfResource = await ResourcesController.getNumberOfMatchingDeals(dealResource.resourceId)

                await CaddyController.deleteRecord(deal.id)
                await DealsController.deleteDealById(event.args._dealId)

                if (dealsOfResource.length === 0) {
                    console.log("Resource Id", deal.resourceId)
                    await ResourcesController.deleteResourceById(deal.resourceId)
                }
            } catch (e) {
                console.log("Error when deleting deal", e)
            }
            //delete deal from caddy and db


        }
    }

    if (typeof acceptedDeals !== "undefined" && acceptedDeals.length > 0) {
        await manageDealCreatedOrAccepted(acceptedDeals, CURRENT_NETWORK)
    }

    return blockNumber
}

let manageDealCreatedOrAccepted = async (events, CURRENT_NETWORK) => {
    for (const event of events) {
        if(Number(event.args._marketplaceId) !== env.MARKETPLACE_ID) continue
        let marketplace = new Marketplace()
        let resourceInstance = new Resources()
        const deal = await marketplace.getDealById({ marketplaceId: env.MARKETPLACE_ID, dealId: Number(event.args._dealId) })

        //Parse deal metadata
        try{
            DealsController.parseDealMetadata(deal.terms.metadata)
        } catch (e) {
            if (e instanceof z.ZodError) {
                console.log("Deal Id: ", deal.id)
                console.error("Metadata Validation failed!\n", "Expected: ", DealsMetadataType.keyof()._def.values, " Got: ", deal.metadata);
            }

            else {
                console.log("Deal Id: ", deal.id)
                console.error("Error", e);
                continue
            }
        }

        //Check if deal is active
        let formattedDeal = DealsController.formatDeal(deal)
        if (DealsController.dealIsActive(formattedDeal) === false || formattedDeal.active === false){
            console.log("Deal is not active: ", formattedDeal.id)
            continue
        }

        const resource = await resourceInstance.getResource({ id: deal.resourceId, address: env.WALLET })

        if(!resource){
            console.log("Resource not found for deal: ", deal.resourceId)
            continue
        }

        let filteredDomains = []
        //parse deal metadata

            //Upsert resource

        try{
            let attr = JSON.parse(resource.encryptedData)
            let decryptedSharedKey = await Encryption.ethSigDecrypt(
                resource.encryptedSharedKey,
                env.PRIVATE_KEY
            );

            let decrypted = Encryption.decrypt(
                decryptedSharedKey,
                attr.iv,
                attr.tag,
                attr.encryptedData
            );

            let data = JSON.parse(decrypted)
            await ResourcesController.upsertResource({ id: resource.id, owner: resource.owner, ...data })

            if(data.domains) filteredDomains = filterDomainsMatchingDeals(data.domains, [Number(deal.id)])

            console.log("Filtered domains", filteredDomains)
        }catch (e) {
            console.log("Error when upsertResource resource and its domains", e)
            continue
        }

        //Upsert deal
        console.log("Deal", formattedDeal)

        try {
            //DealsController.parseDealMetadata(deal.metadata)
            await DealsController.upsertDeal(formattedDeal)
        } catch (e) {
            console.log("Deal Id: ", deal.id)
            console.error("Error", e);
            await ResourcesController.deleteResourceById(Number(resource.id))
            continue
        }

        let domains = filteredDomains[Number(formattedDeal.id)]

        try{
            if(domains && Object.keys(domains).length > 0){
                let resourceId = formattedDeal.resourceId
                let dealId = formattedDeal.id
                for (const domain of domains) {
                    await ResourcesController.upsertResourceDomain({resourceId: resourceId, domain: domain, dealId: Number(dealId)})
                }
            }
        }catch (e) {
            console.log("Error upserting domains", e)
            continue
        }

        //Upsert caddy

        try{
            let caddyFile = await CaddyController.getRecords()
            let deal = await DealsController.getDealById(Number(event.args._dealId))
            let resource = await DealsController.getDealResource(Number(event.args._dealId))
            console.log("Resource", resource)
            console.log("Deal", deal)
            let domainsForCaddy = domains = await ResourcesController.getResourceDomain(resource.id, deal.id)
            await CaddyController.addRecords([{
                resource: resource,
                deal: deal,
                domains: domainsForCaddy
            }], caddyFile, CURRENT_NETWORK)
        }catch (e) {
            console.log("Error upserting caddy", e)
            continue
        }

        //Upsert bandwidth
        try {
            let dealFromDb = await DealsController.getDealById(event.args._dealId)
            let dealForBandwidth = await BandwidthController.formatDataToDb(dealFromDb)
            await BandwidthController.upsertRecord(dealForBandwidth)
        }catch (e) {
            console.log("Error upserting bandwidth", e)
        }

    }
}

/*let getId = (id, network) => {
    return id + "_" + network.network_id + "_" + network.chain_id + "_" + env.MARKETPLACE_ID
}*/

module.exports = { checkEvents }
