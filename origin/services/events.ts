import {env} from "../config/env";


import {DealsController} from "../controllers/dealsController";

import {ResourcesController} from "../controllers/resourcesController";

import {CaddyController} from "../controllers/caddyController";

import {z} from "zod";

import {DealsMetadataType} from "../models/deals/DealsMetadata";

import {BandwidthController} from "../controllers/bandwidthController";

import {filterDomainsMatchingDeals} from "../utils/resources";

import {generateUniqueItemId, recoverOriginalDataFromUniqueDealId} from "../utils/deals";

import {toHex} from "viem";

import {sleep} from "../utils/sleep";

import {Domains} from "../models/resources/Domains";
import {networks} from "../config/networks";

const { Resources, Encryption, validChains, Marketplace, Blockchain, Sdk, EventsHandler} = require("media-sdk");


export const checkEvents = async (lastReadBlock, CURRENT_NETWORK) => {
    //let blockNumber = lastReadBlock + 1
    let updatedResources = undefined
    let removedResources = undefined
    let createdDeals = undefined
    let cancelledDeals = undefined
    let acceptedDeals = undefined
    let addedBalance = undefined
    const network = networks.find(network => network.id === CURRENT_NETWORK.id)

    let sdk = new Sdk({privateKey: env.PRIVATE_KEY, chain: validChains[network.id]})

    let blockchain = new Blockchain(sdk)
    let blockNumber = toHex(await blockchain.getBlockNumber())
    let toNumber = toHex(Number(blockNumber))

    try {
        let eventsHandler = new EventsHandler(sdk)

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

        addedBalance = await eventsHandler.getMarketplacePastEvents({
            eventName: 'AddedBalance',
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
                await manageResourceUpdated(event.args._id, CURRENT_NETWORK)
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
            await Domains.destroy({where:{resourceId: Number(event.args._id)}})
            await ResourcesController.deleteResourceById(Number(event.args._id))
        }
    }

    if (typeof createdDeals !== "undefined" && createdDeals.length > 0) {
        for (const createdDeal of createdDeals) {
            await manageDealCreatedOrAccepted(createdDeal.args._dealId, CURRENT_NETWORK)
        }
    }

    if (typeof cancelledDeals !== "undefined" && cancelledDeals.length > 0) {
        //console.log(events)
        //await models.Caddy.deleteRecord()
        for (const event of cancelledDeals) {
            try{
                await manageCancelledDeal(event.args._dealId, CURRENT_NETWORK)
            } catch (e) {
                console.log("Error when deleting deal", e)
            }
            //delete deal from caddy and db


        }
    }

    if (typeof acceptedDeals !== "undefined" && acceptedDeals.length > 0) {
        //await manageDealCreatedOrAccepted(acceptedDeals, CURRENT_NETWORK)
        for (const acceptedDeal of acceptedDeals) {
            await manageDealCreatedOrAccepted(acceptedDeal.args._dealId, CURRENT_NETWORK)
        }
    }

    if(typeof addedBalance !== "undefined" && addedBalance.length > 0){
        for (const event of addedBalance) {
            try{
                await manageAddedBalance(event.args._dealId, CURRENT_NETWORK.id)
            }catch (e) {
                if (e instanceof z.ZodError) {
                    console.error("Zod Metadata Validation failed on deal", event.args._dealId);
                } else {
                    console.error("Unknown error when upsert deal:", event.args._dealId, e);
                }
            }

        }
    }

    return blockNumber
}

export const manageDealCreatedOrAccepted = async (dealId, CURRENT_NETWORK) => {

    console.log("Data from event", dealId, CURRENT_NETWORK)

    const network = networks.find(network => network.id === CURRENT_NETWORK.id)

    let sdk = new Sdk({privateKey: env.PRIVATE_KEY, transport: network.URL !== "undefined" ? network.URL : undefined, chain: validChains[network.id]})

    let marketplace = new Marketplace(sdk)
    let resourceInstance = new Resources(sdk)
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
    let formattedDeal: {[index: string | number]: any} = DealsController.formatDeal(deal)
    if (DealsController.dealIsActive(formattedDeal) === false || formattedDeal.active === false){
        console.log("Deal is not active: ", formattedDeal.id)
        return
    }

    console.log("Deal", deal)

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
        await ResourcesController.upsertResource({ id: generateUniqueItemId(Number(resource.id), CURRENT_NETWORK.id), owner: deal.client, ...data })

        if(data.domains) filteredDomains = filterDomainsMatchingDeals(data.domains, [Number(deal.id)])

        console.log("Filtered domains", filteredDomains)
    }catch (e) {
        console.log("Error when upsertResource resource and its domains", e)
        return
    }

    await sleep(1000)

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
    await sleep(1000)

    let domains = filteredDomains[Number(formattedDeal.id)]

    try{
        if(domains && Object.keys(domains).length > 0){
            let resourceId = formattedDeal.resourceId
            let dealId = formattedDeal.id
            for (const domain of domains) {
                await ResourcesController.upsertResourceDomain({resourceId: generateUniqueItemId(resourceId, CURRENT_NETWORK.id), domain: domain, dealId: Number(dealId)})
            }
        }
    }catch (e) {
        console.log("Error upserting domains", e)
        return
    }

    //Upsert caddy

    await sleep(1000)

    try{
        let caddyFile = await CaddyController.getRecords()
        console.log("UniqueId",generateUniqueItemId(Number(dealId), CURRENT_NETWORK.id), dealId, CURRENT_NETWORK.id )
        let deal = await DealsController.getDealById(generateUniqueItemId(Number(dealId), CURRENT_NETWORK.id))
        let dealResource: any = await DealsController.getDealResource(generateUniqueItemId(Number(dealId), CURRENT_NETWORK.id))
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
        let dealFromDb = await DealsController.getDealById(generateUniqueItemId(Number(dealId), CURRENT_NETWORK.id))
        let dealForBandwidth = await BandwidthController.formatDataToDb(dealFromDb)
        await BandwidthController.upsertRecord(dealForBandwidth)
    }catch (e) {
        console.log("Error upserting bandwidth", e)
    }
}

export const manageResourceUpdated = async(resourceId, CURRENT_NETWORK) => {

    console.log("Resource updated", resourceId, CURRENT_NETWORK.id)

    let filteredDomains = []

    let domainsFromDb = await ResourcesController.getAllResourcesDomains(generateUniqueItemId(Number(resourceId), CURRENT_NETWORK.id))

    let domainsFromDbNotInFilteredDomains = []

    let deals = await ResourcesController.getResourcesDeals(
      generateUniqueItemId(Number(resourceId), CURRENT_NETWORK.id),
    )
    if (deals.length > 0) {
        let resource: any = await ResourcesController.getResourceById(generateUniqueItemId(Number(resourceId), CURRENT_NETWORK.id))
        if (resource !== false) {

            const network = networks.find(network => network.id === CURRENT_NETWORK.id)

            let sdk = new Sdk({privateKey: env.PRIVATE_KEY, transport: network.URL !== "undefined" ? network.URL : undefined, chain: validChains[network.id]})

            let resources = new Resources(sdk)
            let resourceFromEvm = await resources.getResource({ id: resourceId, address: env.WALLET })

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

            let resourceForDb = { id: generateUniqueItemId(Number(resourceFromEvm.id), network.id), owner: deals[0].client, ...data }

            if(data.domains) {
                console.log("Domains from evm", data.domains, deals.map(deal => recoverOriginalDataFromUniqueDealId(deal.id).dealId.toString()))
                let filteredDomainsForDeal = filterDomainsMatchingDeals(data.domains, deals.map((deal) => recoverOriginalDataFromUniqueDealId(deal.id).dealId.toString()))
                console.log("Filtered domains", filteredDomainsForDeal)
                filteredDomains.push({resourceId: generateUniqueItemId(Number(resource.id), network.id), domains: filteredDomainsForDeal})
            }

            console.log("Domains from db before filter", domainsFromDb)

            if(domainsFromDb.length > 0){
                domainsFromDbNotInFilteredDomains = domainsFromDb.filter((dbDomain: any )=> {
                    return !filteredDomains.some(filteredDomain =>
                        filteredDomain.host === dbDomain.domain && filteredDomain.dealId === dbDomain.dealId
                    );
                });
            }

            console.log("Domains from db after filter", domainsFromDbNotInFilteredDomains)

            await ResourcesController.parseResource(resourceForDb)

            for (const domainToBeDeleted of domainsFromDbNotInFilteredDomains) {
                await ResourcesController.deleteResourceDomain(domainToBeDeleted.id)
            }

            let upsertResourceResult = await ResourcesController.upsertResource({ id: generateUniqueItemId(Number(resourceFromEvm.id), CURRENT_NETWORK.id), owner: deals[0].client, ...data })

            for (const resource of filteredDomains) {
                for (const domain of resource.domains) {
                    await ResourcesController.upsertResourceDomain({resourceId: generateUniqueItemId(Number(resource.resourceId), CURRENT_NETWORK.id), domain: domain.host, dealId: generateUniqueItemId(Number(domain.dealId), CURRENT_NETWORK.id)})
                }

            }

            for (const deal of deals) {
                let dealFromDB = await DealsController.getDealById(deal.id)
                let caddyDomain = await ResourcesController.getResourceDomain(generateUniqueItemId(Number(resourceId), CURRENT_NETWORK.id), dealFromDB.id)
                console.log("Caddy domain", caddyDomain)
                await CaddyController.upsertRecord(
                    {
                        resource: upsertResourceResult.instance,
                        deal: dealFromDB,
                        domains: caddyDomain
                    },CURRENT_NETWORK
                )
            }
        }
    }
}

export const manageCancelledDeal = async (dealId, CURRENT_NETWORK) => {
    const uniqueId = generateUniqueItemId(Number(dealId), CURRENT_NETWORK.id);
    let deal = await DealsController.getDealById(uniqueId)
    console.log("Deal cancelled", dealId, uniqueId, deal)


    //Check if the resource associated to that deal has any other deals or need to be removed
    let dealResource: any = await DealsController.getDealResource(uniqueId)
    console.log("DealResource", dealResource)
    let dealsOfResource = await ResourcesController.getResourcesDeals(dealResource.resourceId)

    await CaddyController.deleteRecord(uniqueId)
    await DealsController.deleteDealById(uniqueId)

    if (dealsOfResource.length === 0) {
        console.log("Resource Id", deal.resourceId)
        await ResourcesController.deleteResourceById(deal.resourceId)
    }
}

export const manageAddedBalance = async (dealId, chainId) => {
    const network = networks.find(network => network.id === chainId)

    let sdk = new Sdk({privateKey: env.PRIVATE_KEY, transport: network.URL !== "undefined" ? network.URL : undefined, chain: validChains[network.id]})

    let marketplace = new Marketplace(sdk)
    let deal = await marketplace.getDealById({marketplaceId: env.MARKETPLACE_ID, dealId: dealId})
    await DealsController.parseDealMetadata(deal.terms.metadata)
    let formattedDeal = DealsController.formatDeal(deal)
    await DealsController.upsertDeal(formattedDeal, chainId)
}

/*let getId = (id, network) => {
    return id + "_" + network.network_id + "_" + network.chain_id + "_" + env.MARKETPLACE_ID
}*/
