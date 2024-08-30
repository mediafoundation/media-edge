import {sequelize} from "../index";

import {DataTypes} from "sequelize";

import {array, object, string, z} from "zod";

const Resource= sequelize.define("Resources",
    {
        id: {type: DataTypes.STRING, primaryKey: true},
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

export {Resource}