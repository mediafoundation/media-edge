const env = require('../config/env');

const generateUniqueDealId = (dealId, chainId) => {
    return dealId.toString() + "_" + chainId.toString() + "_" + env.MARKETPLACE_ID.toString();
}

module.exports = {generateUniqueDealId};