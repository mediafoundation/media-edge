const env = require("../config/env")
const { EventHandler, Resources, Encryption, Marketplace, Blockchain} = require("media-sdk");
const { DealsController } = require("../controllers/dealsController");
const { ResourcesController } = require("../controllers/resourcesController");
const { CaddyController } = require("../controllers/caddyController");
const { z } = require("zod");
const { DealsMetadataType } = require("../models/deals/DealsMetadata");
const { BandwidthController } = require("../controllers/bandwidthController");
const {filterDomainsMatchingDeals} = require("../utils/resources");
const {generateUniqueDealId} = require("../utils/deals");

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
        for (const event of updatedResources) {
            try {
                let filteredDomains = {}

                let domainsFromDb = await ResourcesController.getAllResourcesDomains(event.args._id)

                let domainsFromDbNotInFilteredDomains = []

                let deals = await ResourcesController.getResourcesDeals(
                    event.args._id,
                )
                if (deals.length > 0) {
                    let resource = await ResourcesController.getResourceById(event.args._id)
                    if (resource !== false) {

                        let resources = new Resources()
                        let resourceFromEvm = await resources.getResource({ id: event.args._id, address: env.WALLET })

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

                        let resourceForDb = { id: resourceFromEvm.id, owner: resourceFromEvm.owner, ...data }

                        if(data.domains) {
                            let filteredDomainsForDeal = filterDomainsMatchingDeals(data.domains, deals.map((deal) => Number(deal.id).toString()))
                            filteredDomains = ({resourceId: Number(resource.id), domains: filteredDomainsForDeal})
                        }

                        console.log("Domains from db before filter", domainsFromDb)

                        if(domainsFromDb.length > 0){
                            domainsFromDbNotInFilteredDomains = domainsFromDb.filter(dbDomain => {
                                return !filteredDomains.some(filteredDomain =>
                                    filteredDomain.host === dbDomain.domain && filteredDomain.dealId === dbDomain.dealId
                                );
                            });
                        }

                        console.log("Domains from db after filter", domainsFromDbNotInFilteredDomains)

                        await ResourcesController.parseResource(resourceForDb)

                        let upsertResourceResult = await ResourcesController.upsertResource({ id: resourceFromEvm.id, owner: resourceFromEvm.owner, ...data })

                        for (const resource of filteredDomains) {
                            for (const domain of resource.domains) {
                                await ResourcesController.upsertResourceDomain({resourceId: resource.resourceId, domain: domain.host, dealId: generateUniqueDealId(Number(domain.dealId), CURRENT_NETWORK.id)})
                            }
                        }

                        for (const domainToBeDeleted of domainsFromDbNotInFilteredDomains) {
                            await ResourcesController.deleteResourceDomain(domainToBeDeleted.id)
                        }

                        for (const deal of deals) {
                            let dealFromDB = await DealsController.getDealById(deal.id)
                            await CaddyController.upsertRecord(
                                {
                                    resource: upsertResourceResult.instance,
                                    deal: dealFromDB,
                                    domains: filteredDomains.domains
                                },
                                CURRENT_NETWORK
                            )
                        }
                    }
                }
            } catch (e) {
                if (e instanceof z.ZodError) {
                    console.error("Resource Validation failed on resource", event.args._id);
                } else {
                    console.error("Unknown error when upsert resource:", event.args._id, e);
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
        for (const createdDeal of createdDeals) {
            await manageDealCreatedOrAccepted(createdDeal.args._marketplaceId, createdDeal.args._dealId, CURRENT_NETWORK)
        }
    }

    if (typeof cancelledDeals !== "undefined" && cancelledDeals.length > 0) {
        //console.log(events)
        //await models.Caddy.deleteRecord()
        for (const event of cancelledDeals) {
            try{
                const uniqueId = generateUniqueDealId(Number(event.args._dealId), CURRENT_NETWORK.id);
                let deal = await DealsController.getDealById(uniqueId)
                console.log("Deal cancelled", event.args._dealId, uniqueId, deal)


                //Check if the resource associated to that deal has any other deals or need to be removed
                let dealResource = await DealsController.getDealResource(uniqueId)
                console.log("DealResource", dealResource)
                let dealsOfResource = await ResourcesController.getResourcesDeals(dealResource.resourceId)

                await CaddyController.deleteRecord(uniqueId)
                await DealsController.deleteDealById(uniqueId)

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
        //await manageDealCreatedOrAccepted(acceptedDeals, CURRENT_NETWORK)
        for (const acceptedDeal of acceptedDeals) {
            await manageDealCreatedOrAccepted(acceptedDeal.args._marketplaceId, acceptedDeal.args._dealId, CURRENT_NETWORK)
        }
    }

    return blockNumber
}

let manageDealCreatedOrAccepted = async (marketplaceId, dealId, CURRENT_NETWORK) => {

    if(Number(marketplaceId) !== env.MARKETPLACE_ID) return
    let marketplace = new Marketplace()
    let resourceInstance = new Resources()
    const deal = await marketplace.getDealById({ marketplaceId: env.MARKETPLACE_ID, dealId: Number(dealId) })

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
            return
        }
    }

    //Check if deal is active
    let formattedDeal = DealsController.formatDeal(deal)
    if (DealsController.dealIsActive(formattedDeal) === false || formattedDeal.active === false){
        console.log("Deal is not active: ", formattedDeal.id)
        return
    }

    const resource = await resourceInstance.getResource({ id: deal.resourceId, address: env.WALLET })

    console.log("Resource on event", resource)

    if(!resource){
        console.log("Resource not found for deal: ", deal.resourceId)
        return
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
        return
    }

    //Upsert deal
    if(env.debug) console.log("Deal", formattedDeal)

    try {
        //DealsController.parseDealMetadata(deal.metadata)
        await DealsController.upsertDeal(formattedDeal, CURRENT_NETWORK.id)
    } catch (e) {
        console.log("Deal Id: ", deal.id)
        console.error("Error", e);
        await ResourcesController.deleteResourceById(Number(resource.id))
        return
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
        return
    }

    //Upsert caddy

    try{
        let caddyFile = await CaddyController.getRecords()
        console.log("UniqueId",generateUniqueDealId(Number(dealId), CURRENT_NETWORK.id), dealId, CURRENT_NETWORK.id )
        let deal = await DealsController.getDealById(generateUniqueDealId(Number(dealId), CURRENT_NETWORK.id))
        let dealResource = await DealsController.getDealResource(generateUniqueDealId(Number(dealId), CURRENT_NETWORK.id))
        let resource = await ResourcesController.getResourceById(dealResource.resourceId)
        console.log("Resource", resource)
        console.log("Deal", deal)
        let domainsForCaddy = await ResourcesController.getResourceDomain(dealResource.id, deal.id)
        await CaddyController.addRecords([{
            resource: resource.dataValues,
            deal: deal,
            domains: domainsForCaddy
        }], caddyFile, CURRENT_NETWORK)
    }catch (e) {
        console.log("Error upserting caddy", e)
        return
    }

    //Upsert bandwidth
    try {
        let dealFromDb = await DealsController.getDealById(generateUniqueDealId(Number(dealId), CURRENT_NETWORK.id))
        let dealForBandwidth = await BandwidthController.formatDataToDb(dealFromDb)
        await BandwidthController.upsertRecord(dealForBandwidth)
    }catch (e) {
        console.log("Error upserting bandwidth", e)
    }
}

/*let getId = (id, network) => {
    return id + "_" + network.network_id + "_" + network.chain_id + "_" + env.MARKETPLACE_ID
}*/

module.exports = { checkEvents, manageDealCreatedOrAccepted }
