const {sequelize} = require("../index");
const { DataTypes} = require("sequelize");
const { array, boolean, number, object, string, z } = require("zod");

const Resource= sequelize.define("Resources",
    {
        id: {type: DataTypes.BIGINT, primaryKey: true},
        owner: DataTypes.STRING,
        label: DataTypes.STRING,
        protocol: DataTypes.STRING,
        origin: DataTypes.STRING,
        path: DataTypes.STRING,
        network: DataTypes.STRING,
    },
    {
        modelName: 'Resource',
        freezeTableName: true
    }
);

const ResourceType = z.object({
    label: string(),
    protocol: string(),
    origin: string(),
    path: string(),
    domains: array(object({
        "dealId": string(),
        "host": string()
    })).optional()
})

module.exports = {Resource, ResourceType};