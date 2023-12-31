const {sequelize} = require("./index");
const {DataTypes} = require("sequelize");

const CaddySource = sequelize.define('CaddySource', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
    autoIncrement: true
  },
  host: {
    type: DataTypes.STRING,
    unique: true
  },
  deal_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Deals',
      key: 'id',
    }
  }
})

module.exports = {CaddySource};