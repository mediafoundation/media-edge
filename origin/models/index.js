const Sequelize = require('sequelize')
const env = require("../config/env")

//Instance of sequelize according to the data in env.js

let sequelize;

if (process.env.NODE_ENV === "testing") {
    sequelize = new Sequelize('sqlite::memory', {logging: false})
} else {
    sequelize = new Sequelize(env.dbName, env.dbUser, env.dbPassword, {
        host: env.dbHost,
        dialect: env.dbDialect,
        port: parseInt(env.dbPort),
        logging: false
    });
}

sequelize.authenticate().then(() => {
    console.log('[+] Database connection has been established successfully.')
}).catch(err => {
    console.error('[-] Unable to connect to the database.')
});

module.exports = {sequelize}
