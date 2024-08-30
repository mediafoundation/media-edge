import {DECIMALS_DIGITS, sequelize} from "../index";

import {array, boolean, number, object, string, z} from "zod";

import {DataTypes} from "sequelize";


const DealsMetadata = sequelize.define("DealsMetadata", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    dealId: {
        type: DataTypes.STRING,
        /*references: {
            model: 'Deals',
            key: 'id',
            type: DataTypes.STRING
        }*/
    },
    label: DataTypes.STRING,
    autoSsl: DataTypes.BOOLEAN,
    burstSpeed: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
    apiEndpoint: DataTypes.STRING,
    customCnames: DataTypes.STRING,
}, {
    modelName: 'DealsMetadata',
    freezeTableName: true
});

const DealsMetadataType = z.object({
    label: string(),
    bandwidthLimit: object({
        amount: number(),
        period: string(),
        unit: string()
    }),
    autoSsl: boolean(),
    burstSpeed: number(),
    nodeLocations: array(string()),
    apiEndpoint: string(),
    customCnames: boolean()
})

export {DealsMetadata}
export {DealsMetadataType}