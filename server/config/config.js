import mysql from "mysql2";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFile = process.env.NODE_ENV || "development";
const envPath = path.resolve(__dirname, `../envs/.env.${envFile}`);
const defaultEnvPath = path.resolve(__dirname, "../envs/.env");

// Try environment-specific file first, then fall back to .env
dotenv.config({ path: fs.existsSync(envPath) ? envPath : defaultEnvPath });

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST,
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER,
  password: process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  database: process.env.DB_NAME || process.env.MYSQLDATABASE,
  charset: "utf8mb4",
});
const db = pool.promise();

// `GROUPS` is a reserved keyword in some MySQL/MariaDB versions. Quote it
// whenever legacy SQL refers to the table without backticks (FROM/JOIN/etc.).
const originalQuery = db.query.bind(db);
db.query = (sql, ...args) => {
  if (typeof sql !== "string") {
    return originalQuery(sql, ...args);
  }

  const compatibleSql = sql.replace(
    /\b(FROM|JOIN|UPDATE|INTO|TABLE)\s+groups\b/gi,
    "$1 `groups`"
  );
  return originalQuery(compatibleSql, ...args);
};

const config = {
  port: process.env.PORT || 5000,
};

export { db, config };
