const { DataTypes } = require("sequelize");
const { sequelize } = require("../index");
const {DealsMetadata} = require("./DealsMetadata");

const Deal = sequelize.define("Deals",
    {
        id: {type: DataTypes.BIGINT, primaryKey: true},
        offerId: DataTypes.BIGINT,
        clientId: {
            type: DataTypes.BIGINT,
            references: {
                model: 'Clients',
                key: 'id'
            }
        },
        providerId: {
            type: DataTypes.BIGINT,
            references: {
                model: 'Providers',
                key: 'id'
            }
        },
        resourceId: {
            type: DataTypes.BIGINT,
            references: {
                model: 'Resources',
                key: 'id'
            }
        },
        totalPayment: DataTypes.BIGINT,
        blockedBalance: DataTypes.BIGINT,
        pricePerSecond: DataTypes.BIGINT,
        minDuration: DataTypes.BIGINT,
        billFullPeriods: DataTypes.BOOLEAN,
        singlePeriodOnly: DataTypes.BOOLEAN,
        createdAt: DataTypes.BIGINT,
        acceptedAt: DataTypes.BIGINT,
        billingStart: DataTypes.BIGINT,
        active: DataTypes.BOOLEAN,
        cancelled: DataTypes.BOOLEAN,
        cancelledAt: DataTypes.BIGINT,
        metadataId: {
            type: DataTypes.BIGINT,
            references: {
                model: 'DealsMetadata',
                key: 'id'
            },
            allowNull: false,
        },
        network: DataTypes.STRING
    },
    {
        modelName: 'Deal',
        freezeTableName: true
    }
);

Deal.belongsTo(DealsMetadata, {
    foreignKey: 'metadataId',
    as: "Metadata"
});

module.exports = {Deal};