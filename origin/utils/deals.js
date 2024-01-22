const env = require('../config/env');

const generateUniqueDealId = (dealId, chainId) => {
    return dealId.toString() + "_" + chainId.toString() + "_" + env.MARKETPLACE_ID.toString();
}

const recoverOriginalDataFromUniqueDealId = (uniqueDealId) => {
    const parts = uniqueDealId.split("_");
    return {
        dealId: parts[0],
        chainId: parts[1],
        marketplaceId: parts[2]
    }
}

module.exports = {generateUniqueDealId, recoverOriginalDataFromUniqueDealId};