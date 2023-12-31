const {sequelize} = require("./index");
const { DataTypes } = require("sequelize");
const {Deal} = require("./deals/Deal");

const BandwidthsLog = sequelize.define('BandwidthsLogs', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    dealId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'Deals',
            key: 'id'
        }
    },
    bytes_sent: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
    },
    last_read: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    period_end: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    is_limited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    periods: {
        type: DataTypes.BIGINT,
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