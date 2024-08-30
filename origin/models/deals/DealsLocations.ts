import {DataTypes} from "sequelize";

import {sequelize} from "../index";

const DealsLocations = sequelize.define("DealsLocations", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    dealId: {
        type: DataTypes.STRING,
        /*references: {
            model: 'Deal',
            key: 'id',
            type: DataTypes.STRING
        }*/
    },
    nodeId: {
        type: DataTypes.BIGINT,
        references: {
            model: 'DealsNodeLocations',
            key: 'id'
        }
    },
}, {
    modelName: 'DealsLocations',
    freezeTableName: true
});

export {DealsLocations}