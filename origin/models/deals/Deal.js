const {DataTypes} = require("sequelize");
const {sequelize, DECIMALS_DIGITS} = require("../index");

const Deal = sequelize.define("Deals",
    {
        id: {type: DataTypes.STRING, primaryKey: true},
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
        totalPayment: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        blockedBalance: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        pricePerSecond: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        minDuration: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        billFullPeriods: DataTypes.BOOLEAN,
        singlePeriodOnly: DataTypes.BOOLEAN,
        createdAt: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        acceptedAt: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        billingStart: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        active: DataTypes.BOOLEAN,
        cancelled: DataTypes.BOOLEAN,
        cancelledAt: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        network: DataTypes.STRING
    },
    {
        modelName: 'Deal',
        freezeTableName: true
    }
);

module.exports = {Deal};