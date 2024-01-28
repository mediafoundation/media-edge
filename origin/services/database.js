const env = require("../config/env")
const {Resources, MarketplaceViewer, Encryption} = require("media-sdk");
const {resourcesNotMatchingDeal, filterDomainsMatchingDeals} = require("../utils/resources");
const {DealsController} = require("../controllers/dealsController");
const {z} = require("zod");
const {DealsMetadataType} = require("../models/deals/DealsMetadata");
const {ResourcesController} = require("../controllers/resourcesController");
const {CaddyController} = require("../controllers/caddyController");
const {generateUniqueDealId} = require("../utils/deals");
const initDatabase = async function (network) {

    //fetch resources and deals
    let marketplaceViewer = new MarketplaceViewer();
    let resourcesInstance = new Resources();

    let resources = await resourcesInstance.getAllResourcesPaginating({address: env.WALLET, start: 0, steps: 10})
    let deals = await marketplaceViewer.getAllDealsPaginating({
        marketplaceId: env.MARKETPLACE_ID,
        address: env.WALLET,
        isProvider: true,
        start: 0,
        steps: 20
    })
    let resourcesToBeUpdatedInCaddy = []

    if(deals === undefined || resources === undefined) return

    deals = deals.filter((deal) => deal.status.active === true)

    let resourcesWithoutDeal = resourcesNotMatchingDeal(resources.map((resource) => resource.id), deals.map((deal) => deal.resourceId))

    resources = resources.filter((resource) => !resourcesWithoutDeal.includes(resource.id))

    let filteredDomains = []

    for (const resource of resources) {
        try {
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

            //console.log("Domains", filterDomainsMatchingDeals(data.domains, deals[0].map((deal) => Number(deal.id))))

            let resourceForDb = {id: resource.id, owner: resource.owner, ...data}

            await ResourcesController.parseResource(resourceForDb)

            if(data.domains) {
                let filteredDomainsForDeal = filterDomainsMatchingDeals(data.domains, deals.map((deal) => Number(deal.id).toString()))
                filteredDomains.push({resourceId: Number(resource.id), domains: filteredDomainsForDeal})
            }

            const upsertResult = await ResourcesController.upsertResource(resourceForDb)
            if (upsertResult.originalResource) {
                let resourceNeedsToBeUpdated = compareOldAndNewResourceOnDB(upsertResult.instance.dataValues, upsertResult.originalResource.dataValues)
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

    //Update domains in resources
    for (const resource of filteredDomains) {
        /*for(const key of Object.keys(domainObject)){
            for (const domain of domainObject[key]) {
                let dealsForDomains = deals.filter((deal) => Number(deal.id).toString() === key)
                await ResourcesController.upsertResourceDomain({resourceId: dealsForDomains[0].resourceId, domain: domain, dealId: generateUniqueDealId(Number(key), network.id)})
            }
        }*/
        for (const domain of resource.domains) {
            await ResourcesController.upsertResourceDomain({resourceId: resource.resourceId, domain: domain.host, dealId: generateUniqueDealId(Number(domain.dealId), network.id)})
        }

    }

    //Update records in caddy if needed
    for (const resource of resourcesToBeUpdatedInCaddy) {
        for (const deal of deals) {
            await CaddyController.upsertRecord({resource: resource, deal: deal}, network)
        }
    }
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

module.exports = {initDatabase}