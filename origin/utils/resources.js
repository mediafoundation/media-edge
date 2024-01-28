const {DealsResources} = require("../models/associations/DealsResources");
const {recoverOriginalDataFromUniqueDealId} = require("./deals");
const resourcesNotMatchingDeal = (resourcesIds, dealsIds) => {
    let difference = [];
    let set1 = new Set(dealsIds);
    for (let i = 0; i < resourcesIds.length; i++) {
        if (!set1.has(resourcesIds[i])) {
            difference.push(resourcesIds[i]);
        }
    }
    return difference;
}

function filterDomainsMatchingDeals(domains, dealIds) {
    return domains.filter(domain => dealIds.includes(domain.dealId.toNumber()));
}

async function filterResourceDomains(resourceId, resourceDomains) {
    let filteredDomains = {}
    let dealsResources = await DealsResources.findAll({where: {resourceId: resourceId}, raw: true})
    let dealIds = dealsResources.map(deal => deal.dealId)
    let formattedDealIds = []

    for (const dealId of dealIds) {
        formattedDealIds.push(recoverOriginalDataFromUniqueDealId(dealId))
    }

    filteredDomains = await filterDomainsMatchingDeals(resourceDomains, formattedDealIds)
    return filteredDomains
}

module.exports = {resourcesNotMatchingDeal, filterDomainsMatchingDeals, filterResourceDomains}