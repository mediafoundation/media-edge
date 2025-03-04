import {env} from "../config/env";

import {Encryption, MarketplaceViewer, Resources, Sdk} from "media-sdk";

import {filterDomainsMatchingDeals, resourcesNotMatchingDeal} from "../utils/resources";

import {DealsController} from "../controllers/dealsController";

import {z} from "zod";

import {DealsMetadataType} from "../models/deals/DealsMetadata";

import {ResourcesController} from "../controllers/resourcesController";

import {CaddyController} from "../controllers/caddyController";

import {generateUniqueItemId} from "../utils/deals";

import {generateTXTRecord} from "../utils/generateSubdomain";

import {getHostName} from "../utils/domains";

export const initDatabase = async function (network, sdkInstance: Sdk, address: string, privateKey: string) {

    // Fetch resources and deals
    let marketplaceViewer = new MarketplaceViewer(sdkInstance);
    let resourcesInstance = new Resources(sdkInstance);

    let resources = await resourcesInstance.getAllResourcesPaginating({address: address, start: 0, steps: 10})
    let deals = await marketplaceViewer.getAllDealsPaginating({
        marketplaceId: env.MARKETPLACE_ID,
        address: address,
        isProvider: true,
        start: 0,
        steps: 20
    })

    let resourcesToBeUpdatedInCaddy = []

    // Check deals and resources are not undefined

    if(deals === undefined || resources === undefined) return

    // Filter resources and deals

    deals = deals.filter((deal) => deal.status.active === true)

    let resourcesWithoutDeal = resourcesNotMatchingDeal(resources.map((resource) => resource.id), deals.map((deal) => deal.resourceId))

    resources = resources.filter((resource) => !resourcesWithoutDeal.includes(resource.id))

    // Upsert resources

    let filteredDomains = []

    for (const resource of resources) {
        try {
            let attr = JSON.parse(resource.encryptedData)
            let decryptedSharedKey = Encryption.ethSigDecrypt(
                resource.encryptedSharedKey,
                privateKey.substring(2)
            );

            let decrypted = Encryption.decrypt(
                decryptedSharedKey,
                attr.iv,
                attr.tag,
                attr.encryptedData
            );

            let data = JSON.parse(decrypted)

            let resourceForDb = {id: generateUniqueItemId(Number(resource.id), network.id), owner: resource.owner, ...data}

            ResourcesController.parseResource(resourceForDb)

            if(data.domains) {
                let filteredDomainsForDeal = filterDomainsMatchingDeals(data.domains, deals.map((deal) => Number(deal.id).toString()))
                filteredDomains.push({resourceId: Number(resource.id), owner: resource.owner, domains: filteredDomainsForDeal})
            }

            const upsertResult = await ResourcesController.upsertResource(resourceForDb)
            if (upsertResult.originalResource) {
                let resourceNeedsToBeUpdated = compareOldAndNewResourceOnDB(upsertResult.instance.dataValues, upsertResult.originalResource)
                if (resourceNeedsToBeUpdated) resourcesToBeUpdatedInCaddy.push(upsertResult.instance.dataValues)
            }
        } catch (e) {
            if (e instanceof z.ZodError) {
                console.error("Resource Validation failed on resource", resource.id);
            } else {
                console.error("Unknown error when upsert resource:", resource.id, e);
            }
        }
    }

    // Upsert deals

    for (const deal of deals) {
        //Parse deal metadata
        try{
            DealsController.parseDealMetadata(deal.terms.metadata)
        }catch (e) {
            if (e instanceof z.ZodError) {
                console.log("Deal Id: ", deal.id)
                console.error("Metadata Validation failed!\n", "Expected: ", DealsMetadataType.keyof()._def.values, " Got: ", deal.terms.metadata);
            } else {
                console.log("Deal Id: ", deal.id)
                console.error("Unknown error", e);
            }
        }
        let formattedDeal = DealsController.formatDeal(deal)
        if(DealsController.dealIsActive(formattedDeal)){
            try {
                await DealsController.upsertDeal(formattedDeal, network.id)
            } catch (e) {
                console.log("Deal Id: ", deal.id)
                console.error("Error when upsert to db:", e);
            }
        }
    }

    // Upsert resource domains
    for (const resource of filteredDomains) {
        for (const domain of resource.domains) {
            let existentDomain = await ResourcesController.getDomainByHost(domain.host)
            let txtRecord = null
            if(existentDomain.length !== 0){
                let dealIds = existentDomain.map((domain: any) => domain.dealId)
                if(!dealIds.includes(generateUniqueItemId(Number(domain.dealId), network.id))){
                    txtRecord = generateTXTRecord(resource.owner, getHostName(domain.host), privateKey)
                }
                //txtRecord = generateTXTRecord(env.MARKETPLACE_ID, generateUniqueItemId(Number(domain.dealId), network.id), network.id, domain.host)
            }
            await ResourcesController.upsertResourceDomain({
                resourceId: generateUniqueItemId(Number(resource.resourceId), network.id),
                domain: domain.host,
                dealId: generateUniqueItemId(Number(domain.dealId), network.id),
                txtRecord: txtRecord
            })
        }

    }

     //FOR TESTING!!!


    // Update records in caddy if needed
    
    // for (const resource of resourcesToBeUpdatedInCaddy) {
    //     for (const deal of deals) {
    //         await CaddyController.upsertRecord({resource: resource, deal: deal}, privateKey)
    //     }
    // }
}

function compareOldAndNewResourceOnDB(obj1, obj2) {
    const propertiesToCheck = ['path', 'protocol', 'origin'];

    for (const property of propertiesToCheck) {
        if (obj1[property] !== obj2[property]) {
            return true;
        }
    }

    return false;
}