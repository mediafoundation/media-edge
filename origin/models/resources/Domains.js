const {sequelize} = require("../index");
const { DataTypes} = require("sequelize");

const Domains = sequelize.define("Domains",
    {
        id: {type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true},
        domain: DataTypes.STRING,
        resourceId: {
            type: DataTypes.STRING,
            references: {
                model: "Resources",
                key: "id"
            }
        },
        dealId: {
            type: DataTypes.STRING,
            references: {
                model: "Deals",
                key: "id",
                type: DataTypes.STRING
            }
        },

        txtRecord: {
            type: DataTypes.STRING,
            default: null
        },
    },
    {
        modelName: 'Domains',
        freezeTableName: true,
    }
);

module.exports = {Domains};