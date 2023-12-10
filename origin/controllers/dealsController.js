const { Deal } = require("../models/deals/Deal");
const { DealsMetadata, DealsMetadataType } = require("../models/deals/DealsMetadata");
const { Resource } = require("../models/Resource");
const { Provider } = require("../models/Provider");
const { Client } = require("../models/Client");
const { DealsBandwidthLimit } = require("../models/deals/DealsBandwidthLimit");
const { DealsNodeLocations } = require("../models/deals/DealsNodeLocations");
const { DealsMetadataNodeLocations } = require("../models/deals/DealsMetadataNodeLocations");

module.exports = class DealsController {
    constructor() {}


    static async upsertDeal(deal) {
        const [client] = await Client.findOrCreate({
            where: {account: deal.client},
            defaults: {account: deal.client}
        });

        // Ensure the provider exists
        const [provider] = await Provider.findOrCreate({
            where: {account: deal.provider},
            defaults: {account: deal.provider}
        });

        // Find the resource or fail
        const resource = await Resource.findOne({
            where: {id: deal.resourceId}
        });

        if (!resource) {
            throw new Error('Resource not found');
        }

        // Ensure the metadata exists
        // Parse the metadata from the deal
        let rawMetadata = JSON.parse(deal.metadata);

        // Ensure the bandwidth limit exists
        const [bandwidthLimit] = await DealsBandwidthLimit.upsert(rawMetadata.bandwidthLimit);

        rawMetadata.bandwidthLimitId = bandwidthLimit.get('id');

        // Create or update the metadata
        const [metadata] = await DealsMetadata.upsert(rawMetadata);

        // Handle the node locations
        for (const location of rawMetadata.nodeLocations) {
            const [nodeLocation] = await DealsNodeLocations.findOrCreate({
                where: { location },
                defaults: { location }
            });

            const metadataId = await metadata.get('id');
            const nodeId = await nodeLocation.get('id');

            await DealsMetadataNodeLocations.findOrCreate({
                where: { metadataId, nodeId },
                defaults: { metadataId, nodeId }
            });
        }

        deal.clientId = client.get('id');
        deal.providerId = provider.get('id');
        deal.resourceId = resource.get('id');
        deal.metadataId = metadata.get('id');

        const [instance, created] = await Deal.upsert(deal);
        return [instance, created];

    };

    static async getDeals() {
        try {
            return await Deal.findAll({attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']}});
        } catch (error) {
            throw error;
        }
    }

    static async getDealById(id) {
        try {
            return await Deal.findByPk(id, {attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']}});
        } catch (error) {
            throw error;
        }
    };

    static async deleteDealById(id) {
        try {
            const deal = await Deal.findByPk(id);
            if (!deal) {
                return null;
            }
            await deal.destroy();
            return deal;
        } catch (error) {
            throw error;
        }
    };

    static formatDeal(deal) {

        // Create a new object to hold the result
        let result = {};

        // Iterate over the properties of the object
        for (const key in deal) {
            // If the property is an object, merge its properties with the result
            if (typeof deal[key] === 'object' && deal[key] !== null) {
                result = {...result, ...DealsController.formatDeal(deal[key])};
            } else if (typeof deal[key] === 'bigint') {
                // If the property is a bigint, parse it to a number
                result[key] = Number(deal[key]);
            } else {
                // Otherwise, just copy the property to the result
                result[key] = deal[key];
            }
        }
        return result;
    }

    static parseDealMetadata(metadata){
        DealsMetadataType.parse(JSON.parse(metadata));
    }
}