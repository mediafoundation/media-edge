const { DataTypes } = require("sequelize");
const { sequelize } = require("../index");
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

module.exports = {DealsMetadataNodeLocations};