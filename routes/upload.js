import multer from "multer";
import fs from "fs";
import path from "path";

const baseDir = "/tmp/uploads";
fs.mkdirSync(baseDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(baseDir, "expenses");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/[^a-zA-Z0-9._-]/g, "");
    cb(null, safeName);
  }
});

const allowedMimes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png"
]);

const allowedExt = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

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

export default upload;
