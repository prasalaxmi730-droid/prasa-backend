import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const useSSL = String(process.env.DB_SSL || "false").toLowerCase() === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ...(useSSL
    ? {
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {}),
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
