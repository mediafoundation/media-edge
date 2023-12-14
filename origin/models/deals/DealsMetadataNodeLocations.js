const { DataTypes } = require("sequelize");
const { sequelize } = require("../index");
const {DealsMetadata} = require("./DealsMetadata");
const {DealsNodeLocations} = require("./DealsNodeLocations");
const DealsMetadataNodeLocations = sequelize.define("DealsMetadataNodeLocations", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    metadataId: {
        type: DataTypes.BIGINT,
        references: {
            model: 'DealsMetadata',
            key: 'id'
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
    modelName: 'DealsMetadataNodeLocations',
    freezeTableName: true
});

DealsNodeLocations.belongsToMany(DealsMetadata, {through: DealsMetadataNodeLocations, foreignKey: 'nodeId'})
DealsMetadata.belongsToMany(DealsNodeLocations, {through: DealsMetadataNodeLocations, foreignKey: "metadataId"});

module.exports = {DealsMetadataNodeLocations};