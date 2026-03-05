import express from "express";
import pool from "../db.js";
import upload from "./upload.js";
import { authenticateToken, canAccessEmployee } from "../middleware/auth.js";

const router = express.Router();
const allowedStatuses = new Set(["pending", "approved", "rejected"]);

router.use(authenticateToken);

router.post("/", upload.array("attachments"), async (req, res) => {
  try {
    const { emp_id, expense_date, description, amount } = req.body;
    const effectiveEmpId = req.user.role === "admin" ? emp_id : req.user.emp_id;

    if (!effectiveEmpId) {
      return res.status(400).json({ message: "emp_id is required" });
    }

    const voucher_path =
      req.files && req.files.length
        ? req.files.map((f) => `uploads/expenses/${f.filename}`).join(",")
        : null;

    await pool.query(
      `INSERT INTO expenses
       (emp_id, expense_date, description, amount, voucher_path, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [effectiveEmpId, expense_date, description, amount, voucher_path]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("EXPENSE SAVE ERROR:", err);
    res.status(500).json({ message: "Expense save failed" });
  }
});

router.put("/:id", upload.array("attachments"), async (req, res) => {
  try {
    const { expense_date, description, amount } = req.body;
    const { id } = req.params;

    const voucher_path =
      req.files && req.files.length
        ? req.files.map((f) => `uploads/expenses/${f.filename}`).join(",")
        : null;

    const [existingRows] = await pool.query(
      "SELECT id, emp_id, status FROM expenses WHERE id=?",
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: "Expense not found" });
    }

    const current = existingRows[0];
    const status = String(current.status || "").toLowerCase();

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: "Invalid current status" });
    }
    if (status !== "pending") {
      return res.status(400).json({ message: "Only pending expenses can be edited" });
    }
    if (!canAccessEmployee(req, current.emp_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await pool.query(
      `UPDATE expenses
       SET expense_date=?, description=?, amount=?,
           voucher_path=COALESCE(?, voucher_path)
       WHERE id=?`,
      [expense_date, description, amount, voucher_path, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("EXPENSE UPDATE ERROR:", err);
    res.status(500).json({ message: "Expense update failed" });
  }
});

router.get("/active", async (req, res) => {
  try {
    const { emp_id } = req.query;
    if (!emp_id) {
      return res.status(400).json({ message: "emp_id is required" });
    }
    if (!canAccessEmployee(req, emp_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [rows] = await pool.query(
      `SELECT *
       FROM expenses
       WHERE emp_id = ?
         AND LOWER(status) IN ('pending', 'rejected')
       ORDER BY id DESC`,
      [emp_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("EXPENSE ACTIVE FETCH ERROR:", err);
    res.status(500).json({ message: "Failed to fetch active expenses" });
  }
});

router.get("/employee/summary/:emp_id", async (req, res) => {
  try {
    const { emp_id } = req.params;
    if (!canAccessEmployee(req, emp_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [rows] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN amount ELSE 0 END), 0) AS approved,
         COALESCE(SUM(CASE WHEN LOWER(status) = 'pending' THEN amount ELSE 0 END), 0) AS pending,
         COALESCE(SUM(CASE WHEN LOWER(status) = 'rejected' THEN amount ELSE 0 END), 0) AS rejected
       FROM expenses
       WHERE emp_id = ?`,
      [emp_id]
    );

    res.json(rows[0] || { approved: 0, pending: 0, rejected: 0 });
  } catch (err) {
    console.error("EXPENSE SUMMARY ERROR:", err);
    res.status(500).json({ message: "Failed to fetch expense summary" });
  }
});

export default router;
