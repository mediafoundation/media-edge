import {env} from "../config/env";

export const generateUniqueItemId = (itemId: string | number, chainId: string | number): string => {
    return `${itemId}_${chainId}_${env.marketplace_id}`;
}

export const recoverOriginalDataFromUniqueDealId = (uniqueDealId: string): { dealId: string, chainId: string, marketplaceId: string } => {
    const [dealId, chainId, marketplaceId] = uniqueDealId.split("_");
    return { dealId, chainId, marketplaceId };
}