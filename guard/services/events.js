const models = require("../models");
const env = require("../config/env");

const checkEvents = async (MarketplaceInstance, ResourcesInstance, lastReadBlock, CURRENT_NETWORK, web3) => {
    const blockNumber = await web3.eth.getBlockNumber();

    if (env.debug && blockNumber !== lastReadBlock) {
        console.log("Last readed block", lastReadBlock);
        console.log("Current block", blockNumber);
    }

    try {
        const [updatedResources, removedResources, createdDeals, cancelledDeals, acceptedDeals] = await Promise.all([
            fetchPastEvents(ResourcesInstance, 'UpdatedResource', lastReadBlock, blockNumber),
            fetchPastEvents(ResourcesInstance, 'RemovedResource', lastReadBlock, blockNumber),
            fetchPastEvents(MarketplaceInstance, 'DealCreated', lastReadBlock, blockNumber),
            fetchPastEvents(MarketplaceInstance, 'DealAccepted', lastReadBlock, blockNumber),
            fetchPastEvents(MarketplaceInstance, 'DealCancelled', lastReadBlock, blockNumber)
        ]);

        await handleUpdatedResources(updatedResources, ResourcesInstance, CURRENT_NETWORK);
        await handleRemovedResources(removedResources, CURRENT_NETWORK);
        await handleCreatedOrAcceptedDeals(createdDeals, MarketplaceInstance, ResourcesInstance, CURRENT_NETWORK);
        await handleCreatedOrAcceptedDeals(acceptedDeals, MarketplaceInstance, ResourcesInstance, CURRENT_NETWORK);
        await handleCancelledDeals(cancelledDeals, MarketplaceInstance, CURRENT_NETWORK);

    } catch (e) {
        console.log(e);
        return false;
    }

    return blockNumber;
};

const fetchPastEvents = async (instance, eventName, fromBlock, toBlock) => {
    return instance.getPastEvents(eventName, {
        fromBlock: fromBlock + 1,
        toBlock: toBlock
    });
};

const handleUpdatedResources = async (updatedResources, ResourcesInstance, CURRENT_NETWORK) => {
    for (const event of updatedResources) {
        const resourceId = formatIdForDB(event.returnValues._id, CURRENT_NETWORK);
        const deals = await models.Deals.dealsThatHasResource(resourceId);
        if (deals.length > 0) {
            const resource = await models.Evm.getResource(ResourcesInstance, event.returnValues._id);
            if (resource !== false) {
                const formattedResource = await models.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK);
                const evmRecord = await models.Evm.addRecord(formattedResource);

                for (const deal of deals) {
                    await updateResourceInDeal(formattedResource, deal, CURRENT_NETWORK, evmRecord);
                }
            }
        }
    }
};

const handleRemovedResources = async (removedResources, CURRENT_NETWORK) => {
    for (const event of removedResources) {
        await models.Evm.deleteRecords(formatIdForDB(event.returnValues._id, CURRENT_NETWORK));
    }
};

const handleCreatedOrAcceptedDeals = async (events, MarketplaceInstance, ResourcesInstance, CURRENT_NETWORK) => {
    for (const event of events) {
        const deal = await models.Deals.getDeal(MarketplaceInstance, event.returnValues._dealId);
        const resource = await models.Evm.getResource(ResourcesInstance, deal.resourceId);
        if (resource !== false) {
            if (await models.Deals.dealIsActive(deal) !== false && deal.active !== false) {
                const dealFormatted = models.Deals.formatDataToDb(deal, CURRENT_NETWORK);
                const resourceFormatted = models.Evm.formatDataToDb(resource.resource_id, resource.owner, resource.data, CURRENT_NETWORK);

                await models.Deals.addRecord(dealFormatted);
                await models.Evm.addRecord(resourceFormatted);
                await models.Caddy.addRecord({resource: resourceFormatted, deal: dealFormatted}, CURRENT_NETWORK);
            }
        }
    }
};

const handleCancelledDeals = async (cancelledDeals, MarketplaceInstance, CURRENT_NETWORK) => {
    for (const event of cancelledDeals) {
        const dealId = formatIdForDB(event.returnValues._dealId, CURRENT_NETWORK);
        await models.Caddy.deleteRecord(dealId);
        await models.Deals.deleteRecords([dealId]);

        const deal = await models.Deals.getDeal(MarketplaceInstance, event.returnValues._dealId);
        const resourceId = formatIdForDB(deal.resourceId, CURRENT_NETWORK);
        const dealsOfResource = await models.Deals.dealsThatHasResource(resourceId);

        if (dealsOfResource.length === 0) {
            console.log("Resource Id", deal.resourceId);
            await models.Evm.deleteRecords([resourceId]);
        }
    }
};

const updateResourceInDeal = async (formattedResource, deal, CURRENT_NETWORK, evmRecord) => {
    const caddyRecords = await models.Caddy.getRecord(deal.id, CURRENT_NETWORK);
    const dbRecords = [];
    if (formattedResource.domain) {
        dbRecords.push(formattedResource.domain);
    }
    dbRecords.push(...(await models.Caddy.getHostname(deal)));

    if (!models.Caddy.areArraysEqual(dbRecords, caddyRecords)) {
        await models.Caddy.updateRecord({resource: formattedResource, deal: deal.dataValues}, caddyRecords, CURRENT_NETWORK);
    }

    if (evmRecord.length > 0) {
        if (evmRecord.includes('origin') || evmRecord.includes('protocol') || evmRecord.includes('path')) {
            const caddyHosts = await models.Caddy.getRecord(deal.id);
            await models.Caddy.updateRecord({resource: formattedResource, deal: deal}, caddyHosts);
        }
    }
};

const formatIdForDB = (id, network) => {
    return id + "_" + network.network_id + "_" + network.chain_id;
};

module.exports = { checkEvents };