const { Resource } = require("../models/Resource");
class ResourcesController {
    static upsertResource = async (resource) => {
        try {
            const originalResource = await Resource.findByPk(resource.id);
            const [instance, created] = await Resource.upsert(resource);
            return {
                instance: instance,
                created: created,
                originalResource: originalResource
            };
        } catch (error) {
            throw error;
        }
    };

    static getResources = async () => {
        try {
            return await Resource.findAll({attributes: {exclude: ['createdAt', 'updatedAt', 'deletedAt']}});
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
            return resource;
        } catch (error) {
            throw error;
        }
    };
}

module.exports = {ResourcesController}