import {Sequelize} from "sequelize";

import {env} from "../config/env";

let sequelize: Sequelize;

if (process.env.NODE_ENV === "testing") {
    sequelize = new Sequelize('sqlite::memory', {logging: false})
} else {
    sequelize = new Sequelize(env.db_name, env.db_user, env.db_password, {
        host: env.db_host,
        dialect: env.db_dialect,
        port: env.db_port,
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
