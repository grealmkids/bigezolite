#!/usr/bin/env node
// Simple DB connection check script. Run from repository root with:
//   node .\backend\scripts\check-db-connection.js

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { Pool } = require("pg");

// Prefer backend/.env, fall back to env in process
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(path.resolve(__dirname, ".env"))) {
  dotenv.config({ path: path.resolve(__dirname, ".env") });
} else {
  // default dotenv behavior
  dotenv.config();
}

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
  connectionTimeoutMillis: 5000,
});

(async () => {
  console.log("== DB Connectivity Check ==");
  console.log(`Host: ${process.env.DB_HOST || "<unset>"}`);
  console.log(`Database: ${process.env.DB_DATABASE || "<unset>"}`);
  console.log(`User: ${process.env.DB_USER || "<unset>"}`);

  if (!process.env.DB_PASSWORD) {
    console.warn(
      "Warning: DB_PASSWORD is empty. Provide a password in backend/.env or as an env var."
    );
  }

  try {
    const client = await pool.connect();
    try {
      const res = await client.query("SELECT 1 AS ok");
      console.log("Query result:", res.rows);
      console.log("✅ DB connection successful");
      process.exitCode = 0;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("❌ DB connection failed:");
    // Print useful error details but avoid leaking secrets
    if (err && err.message) console.error(err.message);
    else console.error(err);
    process.exitCode = 2;
  } finally {
    try {
      await pool.end();
    } catch (e) {}
  }
})();
