const env = require("../config/env")
const {Blockchain, EventHandler, Resources, Encryption, Marketplace} = require("media-sdk");
const {DealsController} = require("../controllers/dealsController");
const {ResourcesController} = require("../controllers/resourcesController");
const {CaddyController} = require("../controllers/caddyController");
const {z} = require("zod");
const {DealsMetadataType} = require("../models/deals/DealsMetadata");
const {BandwidthController} = require("../controllers/bandwidthController");

let checkEvents = async (MarketplaceInstance, ResourcesInstance, lastReadBlock, CURRENT_NETWORK, web3) => {
    let blockNumber = lastReadBlock + 1
    let updatedResources = undefined
    let removedResources = undefined
    let createdDeals = undefined
    let cancelledDeals = undefined
    let acceptedDeals = undefined

    try {
        let blockchain = new Blockchain()
        let eventsHandler = new EventHandler()
        blockNumber = await blockchain.getBlockNumber()

        if(env.debug && blockNumber !== lastReadBlock) {
            console.log("Last readed block", lastReadBlock)
            console.log("Current block", blockNumber)
        }
        updatedResources = await eventsHandler.getResourcesPastEvents({eventName: 'UpdatedResource',
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

        removedResources = await eventsHandler.getResourcesPastEvents({eventName: 'RemovedResource',
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

        createdDeals = await eventsHandler.getMarketplacePastEvents({eventName: 'DealCreated',
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

        cancelledDeals = await eventsHandler.getMarketplacePastEvents({eventName: 'DealCancelled',
            fromBlock: lastReadBlock + 1,
            toBlock: blockNumber
        })

        acceptedDeals = await eventsHandler.getMarketplacePastEvents({eventName: 'DealAccepted',
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
            let dealIds = await ResourcesController.getNumberOfMatchingDeals(
                event.args._id,
            )
            if(dealIds.length > 0){
                let resource = await ResourcesController.getResourceById(event.args._id)
                if(resource !== false){
                    /*let formattedResource = await ResourcesController.(
                        resource.resource_id, 
                        resource.owner, 
                        resource.data, 
                        CURRENT_NETWORK
                    )*/

                    let resources = new Resources()
                    let resourceFromEvm = resources.getResourceById({id: event.args._id, address: env.WALLET})

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

                    let upsertResourceResult = await ResourcesController.upsertResource({id: resourceFromEvm.id, owner: resourceFromEvm.owner, ...data})

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
        await manageDealCreatedOrAccepted(MarketplaceInstance, ResourcesInstance, createdDeals, CURRENT_NETWORK)
    }

    if(typeof cancelledDeals !== "undefined" && cancelledDeals.length > 0){
        //console.log(events)
        //await models.Caddy.deleteRecord()
        for (const event of cancelledDeals) {
            //delete deal from caddy and db

            await CaddyController.deleteRecord(getId(event.args._dealId, CURRENT_NETWORK))
            await DealsController.deleteDealById([getId(event.args._dealId, CURRENT_NETWORK)])
            await BandwidthController.deleteRecords([getId(event.args._dealId, CURRENT_NETWORK)])

            //Check if the resource associated to that deal has any other deals or need to be removed
            let marketplace = new Marketplace()
            let deal = await marketplace.getDealById({marketplaceId: env.MARKETPLACE_ID, dealId: event.args._dealId})
            let dealsOfResource = await ResourcesController.getNumberOfMatchingDeals(deal.resourceId)

            if(dealsOfResource.length === 0){
                console.log("Resource Id", deal.resourceId)
                await ResourcesController.deleteResourceById(deal.resourceId)
            }
        }
    }

    if (typeof acceptedDeals !== "undefined" && acceptedDeals.length > 0) {
        await manageDealCreatedOrAccepted(MarketplaceInstance, ResourcesInstance, acceptedDeals, CURRENT_NETWORK)
    }
    
    return blockNumber
}

let manageDealCreatedOrAccepted = async (events, CURRENT_NETWORK) => {
    for (const event of events) {
        let marketplace = new Marketplace()
        let resourceInstance = new Resources()
        let deal = await marketplace.getDealById({marketplaceId: env.MARKETPLACE_ID, dealId: event.args._id})
        let resource = resourceInstance.getResourceById({id: deal.resourceId, address: env.WALLET})
        if(resource !== false){
            if (DealsController.dealIsActive(deal) !== false && deal.active !== false) {
                try{
                    DealsController.parseDealMetadata(deal.metadata)
                    await DealsController.upsertDeal(DealsController.formatDeal(deal))
                } catch (e) {
                    if (e instanceof z.ZodError) {
                        console.log("Deal Id: ", deal.id)
                        console.error("Metadata Validation failed!\n", "Expected: ", DealsMetadataType.keyof()._def.values, " Got: ", deal.metadata);
                    } else {
                        console.log("Deal Id: ", deal.id)
                        console.error("Unknown error", e);
                    }
                }

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

                await ResourcesController.upsertResource({id: resource.id, owner: resource.owner, ...data})

                let caddyFile = await CaddyController.getRecords()
                await CaddyController.addRecords([{
                    resource: ResourcesController.getResourceById(deal.resourceId),
                    deal: await DealsController.getDealById(event.args._id)
                }], caddyFile, CURRENT_NETWORK)
                let dealForBandwidth = await BandwidthController.formatDataToDb(deal)
                await BandwidthController.upsertRecord(dealForBandwidth)
            }
        }
    }
}

let getId = (id, network) => {
    return id + "_" + network.network_id + "_" + network.chain_id + "_" + env.MARKETPLACE_ID
}

module.exports = {checkEvents}
