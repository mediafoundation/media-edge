const {sequelize, DECIMALS_DIGITS} = require("./index");
const { DataTypes } = require("sequelize");
const {Deal} = require("./deals/Deal");

const BandwidthsLog = sequelize.define('BandwidthsLogs', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    dealId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'Deals',
            key: 'id',
            type: DataTypes.STRING
        }
    },
    bytes_sent: {
        type: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        allowNull: false,
        defaultValue: 0,
    },
    last_read: {
        type: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        allowNull: false,
    },
    period_end: {
        type: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        allowNull: false
    },
    is_limited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    periods: {
        type: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
        allowNull: false,
        defaultValue: 1
    }
}, {
    modelName: "BandwidthsLog",
    freezeTableName: true,
    updatedAt: false,
});

BandwidthsLog.belongsTo(Deal, {
    foreignKey: 'dealId',
    as: "Deal"
})

module.exports = {BandwidthsLog};