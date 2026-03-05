import express from "express";
import pool from "../db.js";
import jwt from "jsonwebtoken";
import { authenticateToken, requireRole, jwtSecret } from "../middleware/auth.js";
import { hashPassword, verifyPasswordTransitionSafe } from "../utils/password.js";

const router = express.Router();

// ===============================
// ADMIN LOGIN
// ===============================
router.post("/login", async (req, res) => {
  try {
    const { admin_id, password } = req.body;

    const [rows] = await pool.query(
      `SELECT admin_id, admin_name AS name, admin_email AS email, password
       FROM admins
       WHERE admin_id = ?`,
      [admin_id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const dbAdmin = rows[0];
    const { valid, needsUpgrade } = await verifyPasswordTransitionSafe(password, dbAdmin.password);
    if (!valid) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    if (needsUpgrade) {
      const upgradedHash = await hashPassword(password);
      await pool.query("UPDATE admins SET password = ? WHERE admin_id = ?", [upgradedHash, dbAdmin.admin_id]);
    }

    const { password: _password, ...user } = dbAdmin;
    const token = jwt.sign(
      { role: "admin", admin_id: user.admin_id },
      jwtSecret,
      { expiresIn: "8h" }
    );

    res.json({ user, token });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// ✅ ADMIN PROFILE (used by dashboard)
// ===============================
router.get("/profile/:admin_id", async (req, res) => {
  try {
    const { admin_id } = req.params;

    const [rows] = await pool.query(
      "SELECT admin_id, admin_name AS name, admin_email AS email FROM admins WHERE admin_id = ?",
      [admin_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Admin profile error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// ADMIN – ALL EXPENSES
// ===============================
router.get("/expenses", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        e.emp_id,
        emp.emp_name,
        e.expense_date,
        e.description,
        e.amount,
        e.status
      FROM expenses e
      JOIN Employees emp ON e.emp_id = emp.emp_id
      ORDER BY e.emp_id, e.expense_date DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Admin expenses error:", err);
    res.status(500).json({ message: "Failed to fetch admin expenses" });
  }
});

// ===============================
// ADMIN – ALL TICKETS
// ===============================
router.get("/tickets", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        t.emp_id,
        emp.emp_name,
        t.ticket_date,
        t.description,
        t.assigned_to,
        t.status
      FROM ticket_system t
      JOIN Employees emp ON t.emp_id = emp.emp_id
      ORDER BY t.emp_id, t.ticket_date DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Admin tickets error:", err);
    res.status(500).json({ message: "Failed to fetch admin tickets" });
  }
});

router.use(authenticateToken, requireRole("admin"));

// ===============================
// ADMIN SUMMARY
// ===============================
router.get("/summary", async (req, res) => {
  try {
    const [[approvedAmountRow]] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS approvedAmount
       FROM expenses
       WHERE LOWER(status) = 'approved'`
    );

    const [[pendingExpenseRow]] = await pool.query(
      `SELECT COUNT(*) AS pendingExpenses
       FROM expenses
       WHERE LOWER(status) = 'pending'`
    );

    const [[pendingTicketRow]] = await pool.query(
      `SELECT COUNT(*) AS pendingTickets
       FROM ticket_system
       WHERE LOWER(status) = 'pending'`
    );

    res.json({
      approvedAmount: Number(approvedAmountRow?.approvedAmount || 0),
      pendingExpenses: Number(pendingExpenseRow?.pendingExpenses || 0),
      pendingTickets: Number(pendingTicketRow?.pendingTickets || 0)
    });
  } catch (err) {
    console.error("Admin summary error:", err);
    res.status(500).json({ message: "Failed to fetch admin summary" });
  }
});

// ===============================
// ADMIN REGISTER (stores bcrypt hash)
// ===============================
router.post("/register", async (req, res) => {
  try {
    const { admin_id, admin_name, admin_email, password } = req.body;

    if (!admin_id || !admin_name || !admin_email || !password) {
      return res.status(400).json({ message: "admin_id, admin_name, admin_email and password are required" });
    }

    const [exists] = await pool.query("SELECT admin_id FROM admins WHERE admin_id = ?", [admin_id]);
    if (exists.length > 0) {
      return res.status(409).json({ message: "Admin ID already exists" });
    }

    const passwordHash = await hashPassword(password);
    await pool.query(
      `INSERT INTO admins (admin_id, admin_name, admin_email, password)
       VALUES (?, ?, ?, ?)`,
      [admin_id, admin_name, admin_email, passwordHash]
    );

    res.status(201).json({ success: true, message: "Admin registered" });
  } catch (err) {
    console.error("Admin register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===============================
// ADMIN PENDING EXPENSES
// ===============================
router.get("/expenses/pending", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, emp_id, expense_date, description, amount, voucher_path, status
       FROM expenses
       WHERE LOWER(status) = 'pending'
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Pending expenses error:", err);
    res.status(500).json({ message: "Failed to fetch pending expenses" });
  }
});

// ===============================
// ADMIN PENDING TICKETS
// ===============================
router.get("/tickets/pending", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, emp_id, ticket_date, assigned_to, description, attachment_paths, status
       FROM ticket_system
       WHERE LOWER(status) = 'pending'
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Pending tickets error:", err);
    res.status(500).json({ message: "Failed to fetch pending tickets" });
  }
});

// ===============================
// ADMIN EXPENSE APPROVAL ACTIONS
// ===============================
router.put("/expenses/:id/approve", async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE expenses
       SET status = 'approved'
       WHERE id = ? AND LOWER(status) = 'pending'`,
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Expense not found or already processed" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Expense approve error:", err);
    res.status(500).json({ message: "Failed to approve expense" });
  }
});

router.put("/expenses/:id/reject", async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE expenses
       SET status = 'rejected'
       WHERE id = ? AND LOWER(status) = 'pending'`,
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Expense not found or already processed" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Expense reject error:", err);
    res.status(500).json({ message: "Failed to reject expense" });
  }
});

// ===============================
// ADMIN TICKET APPROVAL ACTIONS
// ===============================
router.put("/tickets/:id/approve", async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE ticket_system
       SET status = 'approved'
       WHERE id = ? AND LOWER(status) = 'pending'`,
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Ticket not found or already processed" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Ticket approve error:", err);
    res.status(500).json({ message: "Failed to approve ticket" });
  }
});

router.put("/tickets/:id/reject", async (req, res) => {
  try {
    const [result] = await pool.query(
      `UPDATE ticket_system
       SET status = 'rejected'
       WHERE id = ? AND LOWER(status) = 'pending'`,
      [req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Ticket not found or already processed" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Ticket reject error:", err);
    res.status(500).json({ message: "Failed to reject ticket" });
  }
});

export default router;
