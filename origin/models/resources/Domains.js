const {sequelize} = require("../index");
const { DataTypes} = require("sequelize");

const Domains = sequelize.define("Domains",
    {
        id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
        domain: DataTypes.STRING,
        resourceId: {
            type: DataTypes.BIGINT,
            references: {
                model: "Resources",
                key: "id"
            }
        },
        dealId: {
            type: DataTypes.BIGINT,
            references: {
                model: "Deals",
                key: "id"
            }
        },
    },
    {
        modelName: 'Domains',
        freezeTableName: true,
    }
);

module.exports = {Domains};