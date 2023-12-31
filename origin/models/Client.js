const { DataTypes } = require("sequelize");
const { sequelize } = require("./index");
const Client = sequelize.define("Clients", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    account: DataTypes.STRING,
}, {
    modelName: 'Client',
    freezeTableName: true
});

module.exports = {Client};