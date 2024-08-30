import {Sequelize} from "sequelize";

const env = require("../config/env")
//Instance of sequelize according to the data in env.js

let sequelize: Sequelize;

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

export const DECIMALS_DIGITS = 50

sequelize.authenticate().then(() => {
    console.log('[+] Database connection has been established successfully.')
}).catch( _ => {
    console.error('[-] Unable to connect to the database.')
});

export {sequelize}
