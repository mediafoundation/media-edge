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

module.exports = {resourcesNotMatchingDeal}