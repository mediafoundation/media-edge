import {sequelize} from "../index";
import {DataTypes} from "sequelize";

export const DealsResources = sequelize.define("DealsResources", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    dealId: {
        type: DataTypes.STRING,
    },
    resourceId: {
        type: DataTypes.STRING,
    },
}, {
    modelName: 'DealsResources',
    freezeTableName: true
})