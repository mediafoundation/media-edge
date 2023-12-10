const { DataTypes } = require("sequelize");
const { sequelize } = require("../index");
const DealsNodeLocations = sequelize.define("DealsNodeLocations", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    location: DataTypes.STRING,
}, {
    modelName: 'DealsNodeLocations',
    freezeTableName: true
});

module.exports = {DealsNodeLocations};