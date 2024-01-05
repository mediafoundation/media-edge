const { DataTypes } = require("sequelize");
const { sequelize } = require("../index");
const {DealsNodeLocations} = require("./DealsNodeLocations");
const {Deal} = require("./Deal");
const DealsLocations = sequelize.define("DealsLocations", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    dealId: {
        type: DataTypes.STRING,
        references: {
            model: 'Deal',
            key: 'id',
            type: DataTypes.STRING
        }
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

DealsNodeLocations.belongsToMany(Deal, {through: DealsLocations, foreignKey: 'nodeId'})
Deal.belongsToMany(DealsNodeLocations, {through: DealsLocations, foreignKey: "dealId"});

module.exports = {DealsLocations};