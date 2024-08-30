import {DataTypes} from "sequelize";

import {sequelize} from "../index";


const DealsNodeLocations = sequelize.define("DealsNodeLocations", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    location: DataTypes.STRING,
}, {
    modelName: 'DealsNodeLocations',
    freezeTableName: true
});

export {DealsNodeLocations}