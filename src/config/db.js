const sql = require('mssql');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname,'../../.env')})

// console.log("dsf",process.env.DB_USER);

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: true,
        trustServerCertificate: true,
    }
};
let pool; // cache the pool 
const poolPromise = async () => {
    if (!pool) {
        try {
            pool = await sql.connect(config);
            console.log("DB connected");
        } catch (err) {
            console.log("Database error", err);
            process.exit(1);
        }
    }
    return pool;
};


module.exports = { poolPromise,sql }