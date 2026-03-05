import express from "express";
import pool from "../db.js";

import multer from "multer";

const router = express.Router();

/* =========================
   TRAVEL EXPENSE
========================= */
router.post("/travel-expense", async (req, res) => {
  const { emp_id, date, purpose, from_place, to_place, amount } = req.body;

  try {
    await pool.query(
      `INSERT INTO TravelExpenses 
       (emp_id, date, purpose, from_place, to_place, amount)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [emp_id, date, purpose, from_place, to_place, amount]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Travel expense failed" });
  }
});

/* =========================
   TICKET EXPENSE
========================= */
router.post("/ticket-expense", async (req, res) => {
  const { emp_id, date, purpose, assigned_to, amount } = req.body;

  try {
    await pool.query(
      `INSERT INTO TicketExpenses
       (emp_id, date, purpose, assigned_to, amount)
       VALUES (?, ?, ?, ?, ?)`,
      [emp_id, date, purpose, assigned_to, amount]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Ticket expense failed" });
  }
});

/* =========================
   BILL UPLOAD
========================= */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  }
});
const upload = multer({ storage });

router.post("/upload-bill", upload.single("bill"), async (req, res) => {
  const { emp_id, expense_type } = req.body;

  try {
    await pool.query(
      `INSERT INTO Bills (emp_id, expense_type, file_path)
       VALUES (?, ?, ?)`,
      [emp_id, expense_type, req.file.path]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Upload failed" });
  }
});

export default router;
