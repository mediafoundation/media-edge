const sequelize = require("./../index").sequelize;
const DataTypes = require("sequelize");
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
    amount: DataTypes.BIGINT,
    period: DataTypes.STRING,
    unit: DataTypes.STRING,
}, {
    modelName: 'DealsBandwidthLimit',
    freezeTableName: true
});

module.exports = {DealsBandwidthLimit};