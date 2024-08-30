import {DataTypes} from "sequelize";

import {sequelize} from "./index";


const Provider = sequelize.define("Providers", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    account: DataTypes.STRING,
}, {
    modelName: 'Provider',
    freezeTableName: true
});

export {Provider}