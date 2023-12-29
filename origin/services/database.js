const env = require("../config/env")
const {Resources, MarketplaceViewer, Encryption} = require("media-sdk");
const {resourcesNotMatchingDeal} = require("../utils/resources");
const {DealsController} = require("../controllers/dealsController");
const {z} = require("zod");
const {DealsMetadataType} = require("../models/deals/DealsMetadata");
const {ResourcesController} = require("../controllers/resourcesController");
const {CaddyController} = require("../controllers/caddyController");
const initDatabase = async function (network) {
    //fetch resources and deals
    let marketplaceViewer = new MarketplaceViewer();
    let resourcesInstance = new Resources();

    let resources = await resourcesInstance.getPaginatedResources({address: env.WALLET, start: 0, steps: 10})
    let deals = await marketplaceViewer.getPaginatedDeals({
        marketplaceId: env.MARKETPLACE_ID,
        address: env.WALLET,
        isProvider: true,
        start: 0,
        steps: 10
    })
    let resourcesToBeUpdatedInCaddy = []

    if(deals[0].length === 0 || resources[0].length === 0) return

    deals[0] = deals[0].filter((deal) => deal.status.active === true)

    let resourcesWithoutDeal = resourcesNotMatchingDeal(resources.map((resource) => resource.id), deals.map((deal) => deal.resourceId))

    resources[0] = resources[0].filter((resource) => !resourcesWithoutDeal.includes(resource.id))

    let filteredDomains = []

    for (const resource of resources[0]) {
        let attr = JSON.parse(resource.encryptedData)
        let decryptedSharedKey = await Encryption.ethSigDecrypt(
            resource.encryptedSharedKey,
            env.PRIVATE_KEY
        );

        let decrypted = await Encryption.decrypt(
            decryptedSharedKey,
            attr.iv,
            attr.tag,
            attr.encryptedData
        );

        let data = JSON.parse(decrypted)

        //console.log("Domains", )

        filteredDomains = filterDomainsMatchingDeals(data.domains, deals[0].map((deal) => Number(deal.id)))

        const upsertResult = await ResourcesController.upsertResource({id: resource.id, owner: resource.owner, ...data})
        if (upsertResult.originalResource) {
            let resourceNeedsToBeUpdated = compareOldAndNewResourceOnDB(upsertResult.instance.dataValues, upsertResult.originalResource.dataValues)
            if (resourceNeedsToBeUpdated) resourcesToBeUpdatedInCaddy.push(upsertResult.instance.dataValues)
        }
    }

    for (const deal of deals[0]) {
        try {
            DealsController.parseDealMetadata(deal.terms.metadata)
            await DealsController.upsertDeal(DealsController.formatDeal(deal))
        } catch (e) {
            if (e instanceof z.ZodError) {
                console.log("Deal Id: ", deal.id)
                console.error("Metadata Validation failed!\n", "Expected: ", DealsMetadataType.keyof()._def.values, " Got: ", deal.terms.metadata);
            } else {
                console.log("Deal Id: ", deal.id)
                console.error("Unknown error", e);
            }
        }
    }

    console.log("Filtered domains", filteredDomains)

    for(const key of Object.keys(filteredDomains)){
        console.log("Key", key, filteredDomains[key])
        for (const domain of filteredDomains[key]) {
            let dealsForDomains = deals[0].filter((deal) => Number(deal.id).toString() === key)
            console.log("Some", dealsForDomains[0].resourceId)
            await ResourcesController.upsertResourceDomain({resourceId: dealsForDomains[0].resourceId, domain: domain, dealId: parseInt(key)})
        }
    }

    //Update records in caddy if needed
    for (const resource of resourcesToBeUpdatedInCaddy) {
        for (const deal of deals) {
            await CaddyController.upsertRecord({resource: resource, deal: deal}, network)
        }
    }
}

function filterDomainsMatchingDeals(domainsKeys, dealIds) {
    const newObj = {};

    console.log("Keys", Object.keys(domainsKeys))

    for (const key of Object.keys(domainsKeys)) {
        console.log("Key", key, dealIds, domainsKeys)
        if (dealIds.includes(parseInt(key))) {
            newObj[key] = domainsKeys[key];
        } else {
            delete domainsKeys[key];
        }
    }

    return newObj;
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