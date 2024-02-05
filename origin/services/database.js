const env = require("../config/env")
const {Resources, MarketplaceViewer, Encryption} = require("media-sdk");
const {resourcesNotMatchingDeal, filterDomainsMatchingDeals} = require("../utils/resources");
const {DealsController} = require("../controllers/dealsController");
const {z} = require("zod");
const {DealsMetadataType} = require("../models/deals/DealsMetadata");
const {ResourcesController} = require("../controllers/resourcesController");
const {CaddyController} = require("../controllers/caddyController");
const {generateUniqueDealId} = require("../utils/deals");
const {generateTXTRecord} = require("../utils/generateSubdomain");
const initDatabase = async function (network) {

    // Fetch resources and deals
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
            let existentDomain = await ResourcesController.doesResourceExist(domain.host)
            let txtRecord = null
            if(existentDomain.length !== 0){
                let dealIds = existentDomain.map((domain) => domain.dealId)
                if(!dealIds.includes(generateUniqueDealId(Number(domain.dealId), network.id))){
                    txtRecord = generateTXTRecord(env.MARKETPLACE_ID, generateUniqueDealId(Number(domain.dealId), network.id), network.id, domain.host)
                }
                //txtRecord = generateTXTRecord(env.MARKETPLACE_ID, generateUniqueDealId(Number(domain.dealId), network.id), network.id, domain.host)
            }
            await ResourcesController.upsertResourceDomain({
                resourceId: resource.resourceId,
                domain: domain.host,
                dealId: generateUniqueDealId(Number(domain.dealId), network.id),
                txtRecord: txtRecord
            })
        }

    }

     //FOR TESTING!!!

    let txtRecord = generateTXTRecord(env.MARKETPLACE_ID, generateUniqueDealId(Number(106), network.id), network.id, "globalsysadmin.com")

    await ResourcesController.upsertResourceDomain({
        resourceId: 61,
        domain: "globalsysadmin.com",
        dealId: generateUniqueDealId(Number(106), network.id)
    })

    await ResourcesController.upsertResourceDomain({
        resourceId: 61,
        domain: "globalsysadmin.com",
        dealId: generateUniqueDealId(Number(107), network.id),
        txtRecord: txtRecord
    })


    // Update records in caddy if needed
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