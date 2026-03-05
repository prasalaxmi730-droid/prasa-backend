import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import db from "../db.js";
import { authenticateToken, canAccessEmployee } from "../middleware/auth.js";

const router = express.Router();
const allowedStatuses = new Set(["pending", "approved", "rejected"]);

router.use(authenticateToken);

const uploadPath = path.join("/tmp", "uploads", "ticket-system");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const allowedMimes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png"
]);
const allowedExt = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (allowedMimes.has(file.mimetype) && allowedExt.has(ext)) {
      return cb(null, true);
    }
    return cb(new Error("Only PDF/JPEG/PNG files are allowed"));
  }
});

router.post("/", upload.array("attachments"), async (req, res) => {
  try {
    const { emp_id, ticket_date, assigned_to, description } = req.body;
    const effectiveEmpId = req.user.role === "admin" ? emp_id : req.user.emp_id;

    if (!effectiveEmpId) {
      return res.status(400).json({ message: "emp_id is required" });
    }

    const attachment_paths =
      req.files && req.files.length
        ? req.files.map((f) => `uploads/ticket-system/${f.filename}`).join(",")
        : null;

    await db.query(
      `INSERT INTO ticket_system (emp_id, ticket_date, assigned_to, description, attachment_paths, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [effectiveEmpId, ticket_date, assigned_to || null, description, attachment_paths]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to create ticket" });
  }
});

router.get("/pending/:emp_id", async (req, res) => {
  const { emp_id } = req.params;
  if (!canAccessEmployee(req, emp_id)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const [rows] = await db.query(
    "SELECT * FROM ticket_system WHERE emp_id=? AND LOWER(status)='pending' ORDER BY id DESC",
    [emp_id]
  );
  res.json(rows);
});

router.get("/history/:emp_id", async (req, res) => {
  const { emp_id } = req.params;
  if (!canAccessEmployee(req, emp_id)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const [rows] = await db.query(
    "SELECT * FROM ticket_system WHERE emp_id=? AND LOWER(status)!='pending' ORDER BY id DESC",
    [emp_id]
  );
  res.json(rows);
});

router.put("/:id", upload.array("attachments"), async (req, res) => {
  try {
    const { ticket_date, assigned_to, description } = req.body;
    const { id } = req.params;

    const [existingRows] = await db.query(
      "SELECT id, emp_id, status FROM ticket_system WHERE id=?",
      [id]
    );

    if (!existingRows.length) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const current = existingRows[0];
    const status = String(current.status || "").toLowerCase();

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: "Invalid current status" });
    }
    if (status !== "pending") {
      return res.status(400).json({ message: "Only pending tickets can be edited" });
    }
    if (!canAccessEmployee(req, current.emp_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const attachment_paths =
      req.files && req.files.length
        ? req.files.map((f) => `uploads/ticket-system/${f.filename}`).join(",")
        : null;

    await db.query(
      `UPDATE ticket_system
       SET ticket_date=?, assigned_to=?, description=?, attachment_paths=COALESCE(?, attachment_paths)
       WHERE id=?`,
      [ticket_date, assigned_to || null, description, attachment_paths, id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/employee/summary/:emp_id", async (req, res) => {
  try {
    const { emp_id } = req.params;
    if (!canAccessEmployee(req, emp_id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [rows] = await db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END), 0) AS completed,
         COALESCE(SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END), 0) AS wip,
         COALESCE(SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END), 0) AS pending
       FROM ticket_system
       WHERE emp_id = ?`,
      [emp_id]
    );

    res.json(rows[0] || { completed: 0, wip: 0, pending: 0 });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch ticket summary" });
  }
});

export default router;
