const {sequelize} = require("./index");
const {DataTypes} = require("sequelize");

const PurgeLog = sequelize.define('PurgeLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    url: {
        type: DataTypes.STRING,
    }
}, {
    updatedAt: false,
});

export {PurgeLog}