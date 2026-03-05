import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const useSSL = String(process.env.DB_SSL || "false").toLowerCase() === "true";
const rejectUnauthorized =
  String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true";
const caPath = process.env.DB_SSL_CA_PATH ? path.resolve(process.env.DB_SSL_CA_PATH) : null;

let sslConfig = null;
if (useSSL) {
  sslConfig = { rejectUnauthorized };
  if (caPath && fs.existsSync(caPath)) {
    sslConfig.ca = fs.readFileSync(caPath, "utf8");
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ...(sslConfig ? { ssl: sslConfig } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then((conn) => {
    console.log("MySQL connected as:", process.env.DB_USER);
    conn.release();
  })
  .catch((err) => {
    console.error("MySQL connection failed:", err);
  });

export default pool;
