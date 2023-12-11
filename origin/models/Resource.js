const {sequelize} = require("./index");
const { DataTypes} = require("sequelize");
const Resource= sequelize.define("Resources",
    {
        id: {type: DataTypes.BIGINT, primaryKey: true},
        owner: DataTypes.STRING,
        label: DataTypes.STRING,
        protocol: DataTypes.STRING,
        origin: DataTypes.STRING,
        path: DataTypes.STRING,
        domain: DataTypes.STRING,
        network: DataTypes.STRING,
    },
    {
        modelName: 'Resource',
        freezeTableName: true
    }
);

module.exports = {Resource};