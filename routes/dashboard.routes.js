import express from "express";
import pool from "../db.js";



const router = express.Router();

/**
 * GET employee details by emp_id
 * /api/dashboard/:empId
 */
router.get("/:empId", async (req, res) => {
  try {
    const { empId } = req.params;

    const [rows] = await pool.query(
      `SELECT emp_id, emp_name, email, phone, department, role, joining_date
       FROM Employees
       WHERE emp_id = ?`,
      [empId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("DASHBOARD ERROR:", err);
    res.status(500).json({ message: "Failed to fetch employee data" });
  }
});

export default router;
