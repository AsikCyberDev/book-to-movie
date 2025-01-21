const { Pool } = require('pg');

// For local development, we pull from .env
// For AWS, environment variables will be set in the Lambda or via Secrets Manager
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};
