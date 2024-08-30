import {DataTypes} from "sequelize";

import {sequelize} from "./index";

const Client = sequelize.define("Clients", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    account: DataTypes.STRING,
}, {
    modelName: 'Client',
    freezeTableName: true
});

export {Client}