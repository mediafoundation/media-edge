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

function filterDomainsMatchingDeals(domainsKeys, dealIds) {
    const newObj = {};

    for (const key of Object.keys(domainsKeys)) {
        if (dealIds.includes(parseInt(key))) {
            newObj[key] = domainsKeys[key];
        } else {
            delete domainsKeys[key];
        }
    }

    return newObj;
}

module.exports = {resourcesNotMatchingDeal, filterDomainsMatchingDeals}