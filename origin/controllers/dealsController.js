const { Deal } = require("../models/deals/Deal");
const { DealsMetadata, DealsMetadataType } = require("../models/deals/DealsMetadata");
const { Resource } = require("../models/resources/Resource");
const { Provider } = require("../models/Provider");
const { Client } = require("../models/Client");
const { DealsBandwidthLimit } = require("../models/deals/DealsBandwidthLimit");
const { DealsLocations} = require("../models/deals/DealsLocations");
const {DealsResources} = require("../models/associations/DealsResources");
const {DealsNodeLocations} = require("../models/deals/DealsNodeLocations");
const {Domains} = require("../models/resources/Domains");
const {BandwidthsLog} = require("../models/BandwidthsLog");
const {generateUniqueItemId} = require("../utils/deals");
class DealsController {
    constructor() {}


    static async upsertDeal(deal, chainId) {
        deal.id = generateUniqueItemId(deal.id, chainId)
        const resource = await Resource.findOne({
            where: {id: generateUniqueItemId(Number(deal.resourceId), chainId)}
        });

        if (!resource) {
            throw new Error('Resource not found');
        }

        const [client] = await Client.findOrCreate({
            where: {account: deal.client},
            defaults: {account: deal.client}
        });
        // Ensure the provider exists

        const [provider] = await Provider.findOrCreate({
            where: {account: deal.provider},
            defaults: {account: deal.provider}
        });

        deal.clientId = client.get('id');
        deal.providerId = provider.get('id');
        deal.resourceId = resource.get('id');

        const [instance, created] = await Deal.upsert(deal);

        let rawMetadata = JSON.parse(deal.metadata);
        let rawBandwidthLimit = rawMetadata.bandwidthLimit;

        rawMetadata.dealId = instance.get('id');
        rawBandwidthLimit.dealId = instance.get('id');

        // Ensure the bandwidth limit exists
        await DealsBandwidthLimit.upsert(rawBandwidthLimit);



        // Create or update the metadata
        await DealsMetadata.upsert(rawMetadata);

        for (const location of rawMetadata.nodeLocations) {
            const [nodeLocation] = await DealsNodeLocations.findOrCreate({
                where: { location },
                defaults: { location }
            });

            const dealId = instance.get('id');
            const nodeId = nodeLocation.get('id');

            await DealsLocations.findOrCreate({
                where: { dealId, nodeId },
                defaults: { dealId, nodeId }
            });
        }

        await DealsResources.findOrCreate({
            where: { dealId: deal.id, resourceId: deal.resourceId },
            defaults: { dealId: deal.id, resourceId: deal.resourceId }

        })
        return [instance, created];

    };

    static async getDeals() {
        try {
            return await Deal.findAll({
                attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']},
                include: [
                    {
                        model: DealsMetadata,
                        as: "Metadata",
                        attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']},
                    },
                    {
                        model: DealsBandwidthLimit,
                        as: "BandwidthLimit",
                        attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']},
                    }
                ],
                raw: true,
                nest: true,
            });
        } catch (error) {
            throw error;
        }
    }

    static async getDealById(id) {
        try {
            return await Deal.findByPk(id, {attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']}, include: [
                    {
                        model: DealsMetadata,
                        as: "Metadata",
                        attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']},
                    },
                    {
                        model: DealsBandwidthLimit,
                        as: "BandwidthLimit",
                        attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']},
                    }
            ], raw: true, nest: true});
        } catch (error) {
            throw error;
        }
    };

    static async getDealOwner(id) {

        try {
            const deal = await Deal.findByPk(id, {attributes: ['clientId'], raw: true});
            if (!deal) {
                return null;
            }
            const client = await Client.findByPk(deal.clientId, {attributes: ['account'], raw: true});
            return client.account;
        } catch (error) {
            throw error;
        }
    };
    

    static async getDealResource(dealId){
        try {
            return await DealsResources.findOne({
                where: {dealId: dealId},
                attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']},
                raw: true
            });
        } catch (error) {
            throw error;
        }
    }

    static async deleteDealById(id) {
        try {
            const deal = await Deal.findByPk(id);
            if (!deal) {
                return null;
            }
            await DealsResources.destroy({where: {dealId: id}})
            await DealsLocations.destroy({where: {dealId: id}})
            await DealsMetadata.destroy({where: {dealId: id}})
            await DealsBandwidthLimit.destroy({where: {dealId: id}})
            await BandwidthsLog.destroy({where: {dealId: id}})
            await Domains.destroy({where: {dealId: id}})

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
        /*result['dealId'] = result['id']
        delete result['id']*/
        return result;
    }

    static parseDealMetadata(metadata){
        DealsMetadataType.parse(JSON.parse(metadata));
    }

    static dealIsActive(deal) {
        let totalTime = deal.blockedBalance / deal.pricePerSecond;
        let calculatedEnd = deal.billingStart + totalTime;
        if(Number(calculatedEnd) * 1000 > 8640000000000000) return true
        let d = new Date(Number(calculatedEnd) * 1000);
        const pad2 = (n) => {
            return (n < 10 ? "0" : "") + n;
        };
        let formattedCalculatedEnd = `${pad2(
            d.getMonth() + 1
        )}/${pad2(d.getDate())}/${pad2(d.getFullYear())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`

        return Date.parse(formattedCalculatedEnd) > Date.now()
    }
}

module.exports = {DealsController}