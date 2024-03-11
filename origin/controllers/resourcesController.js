const {Resource, ResourceType} = require("../models/resources/Resource");
const {Domains} = require("../models/resources/Domains");
const {DealsResources} = require("../models/associations/DealsResources");
const {DealsController} = require("./dealsController");

class ResourcesController {
    static upsertResource = async (resource) => {
        try {
            const originalResource = await Resource.findByPk(resource.id, {
                raw: true,
                attributes: {
                    exclude: ['createdAt', 'updatedAt', 'deletedAt']
                }
            });

            const [instance, created] = await Resource.upsert(resource, {
                returning: true
            });

            return {
                originalResource,
                instance,
                created
            };
        } catch (error) {
            throw error;
        }
    };

    static async upsertResourceDomain(resourceDomain) {
        try {
            let [domain, created] = await Domains.findOrCreate({
                where: {
                    resourceId: resourceDomain.resourceId,
                    dealId: resourceDomain.dealId,
                    domain: resourceDomain.domain,
                    //txtRecord: resourceDomain.txtRecord || null
                },
                defaults: resourceDomain
            });

            let originalDomain = null;

            // todo: record might be always created, so originalDomain will be always null

            if (!created) {
                // If the record already existed, update it
                originalDomain = {...domain.get({plain: true})};
                await domain.update(resourceDomain);
                domain = await Domains.findOne({
                    where: {
                        resourceId: resourceDomain.resourceId,
                        dealId: resourceDomain.dealId,
                        domain: resourceDomain.domain
                    },
                    attributes: {
                        exclude: ['createdAt', 'updatedAt', 'deletedAt']
                    },
                    raw: true
                });
            }

            return {
                created,
                originalDomain,
                domain
            };
        } catch (error) {
            throw error;
        }
    }

    static async getResourceDomain(resourceId, dealId) {
        try {
            return await Domains.findAll({
                where: {
                    resourceId: resourceId,
                    dealId: dealId
                },
                attributes: {
                    exclude: ['createdAt', 'updatedAt', 'deletedAt']
                },
                raw: true
            });
        } catch (error) {
            throw error;
        }
    }

    static async getAllResourcesDomains(resourceId) {
        try {
            return await Domains.findAll({
                where: {
                    resourceId: resourceId
                },
                attributes: {
                    exclude: ['createdAt', 'updatedAt', 'deletedAt']
                },
                raw: true
            });
        } catch (error) {
            throw error;
        }
    }

    static async getDomainByHost(domain) {
        try {
            return await Domains.findAll({
                where: {
                    domain: domain
                }
            });
        }
        catch (error) {
            throw error;
        }
    }

    static getResources = async () => {
        try {
            return await Resource.findAll({attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']}, raw: true});
        } catch (error) {
            throw error;
        }
    }

    static getResourceById = async (id) => {
        try {
            return await Resource.findByPk(id, {attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']}});
        } catch (error) {
            throw error;
        }
    };

    static deleteResourceById = async (id) => {
        try {
            const resource = await Resource.findByPk(id);
            if (!resource) {
                return null;
            }
            await resource.destroy();
            return resource.get({plain: true});
        } catch (error) {
            throw error;
        }
    };

    static deleteResourceDomain = async (domainId) => {
        try {
            const domain = await Domains.findByPk(domainId)
            if (!domain) {
                return null;
            }
            await domain.destroy();
            return domain.get({plain: true});
        } catch (error) {
            throw error;
        }
    }

    static getResourcesDeals = async (resourceId) => {
        const dealsResources = await DealsResources.findAll({where: {resourceId: resourceId}, raw: true});

        let deals = []

        if (dealsResources) {
            //return await dealsResources.getDeals()
            for (const dealsResource of dealsResources) {
                let deal = await DealsController.getDealById(dealsResource.dealId)
                deals.push(deal)
            }
            return deals
        } else {
            throw new Error("Resource not found")
        }
    }

    static parseResource = (resource) => {
        ResourceType.parse(resource)
    }
}

module.exports = {ResourcesController}