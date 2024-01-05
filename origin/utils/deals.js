import env from "../config/env";

function generateUniqueDealId(dealId, chainId) {
    return `${dealId}_${chainId}_${env.MARKETPLACE_ID}`;
}