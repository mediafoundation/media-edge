import {DealsResources} from "../models/associations/DealsResources";

import {recoverOriginalDataFromUniqueDealId} from "./deals";

export const resourcesNotMatchingDeal = (resourcesIds, dealsIds) => {
    let difference = [];
    let set1 = new Set(dealsIds);
    for (let i = 0; i < resourcesIds.length; i++) {
        if (!set1.has(resourcesIds[i])) {
            difference.push(resourcesIds[i]);
        }
    }
    return difference;
}

export function filterDomainsMatchingDeals(domains, dealIds) {
    return domains.filter(domain => dealIds.includes(domain.dealId));
}

export async function filterResourceDomains(resourceId, resourceDomains) {
    let filteredDomains = {}
    let dealsResources: any = await DealsResources.findAll({where: {resourceId: resourceId}, raw: true})
    let dealIds = dealsResources.map((deal: any) => deal.dealId)
    let formattedDealIds = []

    for (const dealId of dealIds) {
        formattedDealIds.push(recoverOriginalDataFromUniqueDealId(dealId))
    }

    filteredDomains = await filterDomainsMatchingDeals(resourceDomains, formattedDealIds)
    return filteredDomains
}