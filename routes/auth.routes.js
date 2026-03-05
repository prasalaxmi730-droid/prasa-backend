import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import { authenticateToken, requireRole, jwtSecret } from "../middleware/auth.js";
import { hashPassword, verifyPasswordTransitionSafe } from "../utils/password.js";

const router = express.Router();

// ===============================
// EMPLOYEE LOGIN
// ===============================
router.post("/login", async (req, res) => {
  try {
    const { emp_id, password } = req.body;

    const [rows] = await pool.query(
      `SELECT emp_id, emp_name, email, phone, department, role, joining_date, password
       FROM Employees
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
      await pool.query("UPDATE Employees SET password = ? WHERE emp_id = ?", [upgradedHash, dbUser.emp_id]);
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
    let query = "SELECT emp_id, emp_name FROM Employees";
    const params = [];

    if (exclude) {
      query += " WHERE emp_id <> ?";
      params.push(exclude);
    }

    query += " ORDER BY emp_name ASC";
    const [rows] = await pool.query(query, params);
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

    const [exists] = await pool.query("SELECT emp_id FROM Employees WHERE emp_id = ?", [emp_id]);
    if (exists.length > 0) {
      return res.status(409).json({ message: "Employee ID already exists" });
    }

    const passwordHash = await hashPassword(password);
    await pool.query(
      `INSERT INTO Employees
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
