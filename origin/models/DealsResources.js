const {sequelize} = require("./index");
const {DataTypes} = require("sequelize");
const {Deal} = require("./deals/Deal");
const {Resource} = require("./Resource");
const DealsResources = sequelize.define("DealsResources", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    resourceId: {
        type: DataTypes.BIGINT,
        references: {
            model: 'Resource',
            key: 'id'
        }
    },
    DealId: {
        type: DataTypes.BIGINT,
        references: {
            model: 'Deal',
            key: 'id'
        }
    },
}, {
    modelName: 'DealsResources',
    freezeTableName: true
});

Deal.belongsToMany(Resource, {through: DealsResources, foreignKey: 'DealId'})
Resource.belongsToMany(Deal, {through: DealsResources, foreignKey: 'ResourceId'})