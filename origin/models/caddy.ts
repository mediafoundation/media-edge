import {sequelize} from "./index";

import {DataTypes} from "sequelize";

const CaddySource = sequelize.define('CaddySource', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        allowNull: false,
        autoIncrement: true
    },
    host: {
        type: DataTypes.STRING,
        unique: true
    },
    deal_id: {
        type: DataTypes.STRING,
        /*references: {
            model: 'Deals',
            key: 'id',
            type: DataTypes.STRING
        }*/
    }
})

export {CaddySource}