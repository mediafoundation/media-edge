const {sequelize} = require("../index");
const {Resource} = require("../resources/Resource");
const {Deal} = require("../deals/Deal");
const { DataTypes } = require("sequelize");

const DealsResources = sequelize.define("DealsResources", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    dealId: {
        type: DataTypes.STRING,
        references: {
            model: 'Deals',
            key: 'id',
            type: DataTypes.STRING
        }
    },
    resourceId: {
        type: DataTypes.STRING,
        references: {
            model: 'Resources',
            key: 'id'
        }
    },
}, {
    modelName: 'DealsResources',
    freezeTableName: true
})

module.exports = {DealsResources};

Resource.belongsToMany(Deal, {through: DealsResources, foreignKey: 'resourceId'})
Deal.belongsToMany(Resource, {through: DealsResources, foreignKey: "dealId"});
