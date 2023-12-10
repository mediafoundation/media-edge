const { DataTypes } = require("sequelize");
const { sequelize } = require("./index");

const Provider = sequelize.define("Providers", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    account: DataTypes.STRING,
}, {
    modelName: 'Provider',
    freezeTableName: true
});

module.exports = {Provider};