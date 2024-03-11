const sequelize = require("./../index").sequelize;
const DataTypes = require("sequelize");
const {DECIMALS_DIGITS} = require("../index");
const DealsBandwidthLimit = sequelize.define("DealsBandwidthLimit", {
    id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
    dealId: {
        type: DataTypes.STRING,
        references: {
            model: 'Deals',
            key: 'id',
            type: DataTypes.STRING
        }
    },
    amount: DataTypes.DECIMAL(DECIMALS_DIGITS, 0),
    period: DataTypes.STRING,
    unit: DataTypes.STRING,
}, {
    modelName: 'DealsBandwidthLimit',
    freezeTableName: true
});

module.exports = {DealsBandwidthLimit};