import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import { authenticateToken, requireRole, jwtSecret } from "../middleware/auth.js";
import { hashPassword, verifyPasswordTransitionSafe } from "../utils/password.js";

const router = express.Router();

const EMPLOYEE_TABLE_PRIMARY = "Employees";
const EMPLOYEE_TABLE_FALLBACK = "employees";

const shouldRetryWithFallback = (err) => {
  return err && err.code === "ER_NO_SUCH_TABLE";
};

const queryEmployees = async (sqlBuilder, params = []) => {
  try {
    return await pool.query(sqlBuilder(EMPLOYEE_TABLE_PRIMARY), params);
  } catch (err) {
    if (!shouldRetryWithFallback(err)) throw err;
    return await pool.query(sqlBuilder(EMPLOYEE_TABLE_FALLBACK), params);
  }
};

// ===============================
// EMPLOYEE LOGIN
// ===============================
router.post("/login", async (req, res) => {
  try {
    const emp_id = String(req.body?.emp_id || "").trim();
    const password = String(req.body?.password || "");

    if (!emp_id || !password) {
      return res.status(400).json({ message: "emp_id and password are required" });
    }

    const [rows] = await queryEmployees(
      (table) => `SELECT emp_id, emp_name, email, phone, department, role, joining_date, password
       FROM ${table}
       WHERE emp_id = ?`,
      [emp_id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid employee credentials" });
    }

    const dbUser = rows[0];
    const { valid, needsUpgrade } = await verifyPasswordTransitionSafe(password, dbUser.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid employee credentials" });
    }

    if (needsUpgrade) {
      const upgradedHash = await hashPassword(password);
      await queryEmployees(
        (table) => `UPDATE ${table} SET password = ? WHERE emp_id = ?`,
        [upgradedHash, dbUser.emp_id]
      );
    }

    const { password: _password, ...user } = dbUser;
    const token = jwt.sign(
      { role: "employee", emp_id: user.emp_id },
      jwtSecret,
      { expiresIn: "8h" }
    );

    res.json({ user, token });
  } catch (err) {
    console.error("Employee login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// EMPLOYEE DIRECTORY (for assign-to dropdown)
// ===============================
router.get("/employees", authenticateToken, requireRole("employee", "admin"), async (req, res) => {
  try {
    const { exclude } = req.query;
    let query = (table) => `SELECT emp_id, emp_name FROM ${table}`;
    const params = [];

    if (exclude) {
      query = (table) => `SELECT emp_id, emp_name FROM ${table} WHERE emp_id <> ?`;
      params.push(exclude);
    }

    const [rows] = await queryEmployees(
      (table) => `${query(table)} ORDER BY emp_name ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error("Employee list error:", err);
    res.status(500).json({ message: "Failed to fetch employees" });
  }
});

// ===============================
// EMPLOYEE REGISTER (stores bcrypt hash)
// ===============================
router.post("/register", async (req, res) => {
  try {
    const {
      emp_id,
      emp_name,
      email,
      phone = null,
      department = null,
      role = "Employee",
      joining_date = null,
      password
    } = req.body;

    if (!emp_id || !emp_name || !email || !password) {
      return res.status(400).json({ message: "emp_id, emp_name, email and password are required" });
    }

    const [exists] = await queryEmployees(
      (table) => `SELECT emp_id FROM ${table} WHERE emp_id = ?`,
      [emp_id]
    );
    if (exists.length > 0) {
      return res.status(409).json({ message: "Employee ID already exists" });
    }

    const passwordHash = await hashPassword(password);
    await queryEmployees(
      (table) => `INSERT INTO ${table}
       (emp_id, emp_name, email, phone, department, role, joining_date, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [emp_id, emp_name, email, phone, department, role, joining_date, passwordHash]
    );

    res.status(201).json({ success: true, message: "Employee registered" });
  } catch (err) {
    console.error("Employee register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
