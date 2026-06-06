const postgres = require('postgres');
const path = require('path');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://nexus:nexus123@db:5432/nexus_panel';

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Wrapper to mimic better-sqlite3 fluent API roughly for easier migration
const db = {
  prepare: (query) => {
    // Replace ? with $1, $2, etc.
    let index = 1;
    const postgresQuery = query.replace(/\?/g, () => `$${index++}`);
    
    return {
      get: async (...args) => {
        const results = await sql.unsafe(postgresQuery, args);
        return results[0];
      },
      all: async (...args) => {
        return await sql.unsafe(postgresQuery, args);
      },
      run: async (...args) => {
        return await sql.unsafe(postgresQuery, args);
      }
    };
  },
  exec: async (query) => {
    return await sql.unsafe(query);
  }
};

console.log(`✓ Database (Postgres) ready`);

module.exports = db;
module.exports.sql = sql;
