import express from "express";
import db from "../db.js";
import { authenticateToken, canAccessEmployee } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/bills", async (req, res) => {
  try {
    const expenseWhere = ["status = 'approved'", "voucher_path IS NOT NULL"];
    const expenseParams = [];
    const ticketWhere = ["status = 'approved'", "attachment_paths IS NOT NULL"];
    const ticketParams = [];

    if (req.user.role !== "admin") {
      expenseWhere.push("emp_id = ?");
      expenseParams.push(req.user.emp_id);
      ticketWhere.push("emp_id = ?");
      ticketParams.push(req.user.emp_id);
    }

    const [expenses] = await db.query(
      `SELECT voucher_path AS file_path
       FROM expenses
       WHERE ${expenseWhere.join(" AND ")}`,
      expenseParams
    );

    const [tickets] = await db.query(
      `SELECT attachment_paths AS file_path
       FROM ticket_system
       WHERE ${ticketWhere.join(" AND ")}`,
      ticketParams
    );

    const files = [];

    [...expenses, ...tickets].forEach((row) => {
      if (!row.file_path) return;
      row.file_path
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
        .forEach((f) => files.push(f.replace(/^\/+/, "")));
    });

    res.json([{ id: "bills", voucher_files: files }]);
  } catch (err) {
    console.error("Bills fetch error:", err);
    res.status(500).json([]);
  }
});

router.get("/expenses", async (req, res) => {
  try {
    const { emp_id, from, to } = req.query;
    const effectiveEmpId = req.user.role === "admin" ? emp_id : req.user.emp_id;

    if (req.user.role !== "admin" && emp_id && !canAccessEmployee(req, emp_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const where = ["LOWER(status) IN ('approved', 'rejected')"];
    const params = [];

    if (effectiveEmpId) {
      where.push("emp_id = ?");
      params.push(effectiveEmpId);
    }
    if (from) {
      where.push("expense_date >= ?");
      params.push(from);
    }
    if (to) {
      where.push("expense_date <= ?");
      params.push(to);
    }

    const [rows] = await db.query(
      `SELECT id, emp_id, expense_date, description, amount, status, voucher_path
       FROM expenses
       WHERE ${where.join(" AND ")}
       ORDER BY id DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Expense history error:", err);
    res.status(500).json([]);
  }
});

router.get("/ticket-system", async (req, res) => {
  try {
    const { emp_id, from, to } = req.query;
    const effectiveEmpId = req.user.role === "admin" ? emp_id : req.user.emp_id;

    if (req.user.role !== "admin" && emp_id && !canAccessEmployee(req, emp_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const where = ["LOWER(status) IN ('approved', 'rejected')"];
    const params = [];

    if (effectiveEmpId) {
      where.push("emp_id = ?");
      params.push(effectiveEmpId);
    }
    if (from) {
      where.push("ticket_date >= ?");
      params.push(from);
    }
    if (to) {
      where.push("ticket_date <= ?");
      params.push(to);
    }

    const [rows] = await db.query(
      `SELECT id, emp_id, ticket_date, assigned_to, description, status, attachment_paths
       FROM ticket_system
       WHERE ${where.join(" AND ")}
       ORDER BY id DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Ticket history error:", err);
    res.status(500).json([]);
  }
});

export default router;
