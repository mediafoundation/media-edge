import {sequelize} from "../index";

import {DataTypes} from "sequelize";

//Todo: check defaults

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
            /*references: {
                model: "Deals",
                key: "id",
                type: DataTypes.STRING
            }*/
        },

        txtRecord: {
            type: DataTypes.STRING,
            allowNull: true,
            //default: null
        },
    },
    {
        modelName: 'Domains',
        freezeTableName: true,
    }
);

export {Domains}