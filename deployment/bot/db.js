const postgres = require('postgres');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://nexus:nexus123@db:5432/nexus_panel';

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Improved wrapper to handle async DB operations while preserving API compatibility where possible
const db = {
  prepare: (query) => {
    let index = 1;
    const postgresQuery = query.replace(/\?/g, () => `$${index++}`);
    
    return {
      get: async (...args) => {
        try {
          const results = await sql.unsafe(postgresQuery, args);
          return results[0];
        } catch (err) {
          console.error(`DB GET Error: ${err.message} | Query: ${query}`);
          throw err;
        }
      },
      all: async (...args) => {
        try {
          return await sql.unsafe(postgresQuery, args);
        } catch (err) {
          console.error(`DB ALL Error: ${err.message} | Query: ${query}`);
          throw err;
        }
      },
      run: async (...args) => {
        try {
          const results = await sql.unsafe(postgresQuery, args);
          return {
            lastInsertRowid: results[0]?.id || null,
            changes: results.length
          };
        } catch (err) {
          console.error(`DB RUN Error: ${err.message} | Query: ${query}`);
          throw err;
        }
      }
    };
  },
  exec: async (query) => {
    return await sql.unsafe(query);
  },
  // Postgres doesn't have native SQLite-style transactions in this driver without a callback
  transaction: (fn) => {
    return async (...args) => {
      return await sql.begin(async (s) => {
        // This is a simplified shim; real complex transactions might need more work
        return await fn(...args);
      });
    };
  }
};

console.log(`✓ Database (Postgres) ready`);

module.exports = db;
module.exports.sql = sql;
