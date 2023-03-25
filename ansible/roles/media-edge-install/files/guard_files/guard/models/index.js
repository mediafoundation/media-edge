const fs = require('fs')
const path = require('path')
const Sequelize = require('sequelize')
const state = require('./state')
const env = require("../config/env")
const Op = Sequelize.Op;
const basename = path.basename(__filename)
const db = {};

//database SQLITE on memory
const sequelize = new Sequelize(env.dbstring, { logging: false })

//const sequelize = new Sequelize({
  //dialect: 'postgres',
  //storage: '/tmp/mediaNetwork.sqlite',
  //logging: false
//});

fs.readdirSync(__dirname).filter(file => {
  return (file !== 'state.js') && (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js')
}).forEach(file => {
  const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes)
  db[model.name] = model
})

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

sequelize.authenticate() .then(() => {
  console.log('[+] Database connection has been established successfully.')
}).catch(err => {
  console.error('[-] Unable to connect to the database.')
});

db.sequelize = sequelize
db.Sequelize = Sequelize
db.state = state
db.Op = Op
module.exports = db
