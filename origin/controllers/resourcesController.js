const {Resource} = require("../models/resources/Resource");
const {Domains} = require("../models/resources/Domains");

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
                    //domain: resourceDomain.domain
                },
                defaults: resourceDomain
            });

            let originalDomain = null;

            if (!created) {
                // If the record already existed, update it
                originalDomain = {...domain.get({plain: true})};
                await domain.update(resourceDomain);
                domain = await Domains.findOne({
                    where: {
                        resourceId: resourceDomain.resourceId,
                        dealId: resourceDomain.dealId
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
            //todo: should be a find All
            return await Domains.findOne({
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

    static deleteResourceDomain = async (resourceId, dealId) => {
        try {
            const domain = await Domains.findOne({
                where: {
                    resourceId: resourceId,
                    dealId: dealId
                }
            });
            if (!domain) {
                return null;
            }
            await domain.destroy();
            return domain.get({plain: true});
        } catch (error) {
            throw error;
        }
    }

    static getNumberOfMatchingDeals = async (resourceId) => {
        const resource = await Resource.findByPk(resourceId);

        if (resource) {
            return await resource.getDeals()
        } else {
            throw new Error("Resource not found")
        }
    }
}

module.exports = {ResourcesController}