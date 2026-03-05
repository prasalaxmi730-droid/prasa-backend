import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

import authRoutes from "./routes/auth.routes.js";
import expensesRoutes from "./routes/expenses.routes.js";
import ticketSystemRoutes from "./routes/ticketSystem.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import historyRoutes from "./routes/history.routes.js";

dotenv.config();

const app = express();

const defaultOrigins = [
  "http://localhost:3000",
  "http://localhost:3003",
  "http://localhost",
  "capacitor://localhost",
  "ionic://localhost"
];

const envOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowPagesDev = String(process.env.CORS_ALLOW_PAGES_DEV || "false").toLowerCase() === "true";
const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    if (allowPagesDev && origin.endsWith(".pages.dev")) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: false
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join("/tmp", "uploads")));

app.get("/", (req, res) => {
  res.send("PRASA Backend Running");
});

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/ticket-system", ticketSystemRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/history", historyRoutes);

app.use((err, req, res, next) => {
  if (!err) return next();

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Origin not allowed" });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "File too large. Max size is 50MB." });
  }

  if (err.message && err.message.includes("Only PDF/JPEG/PNG")) {
    return res.status(400).json({ message: err.message });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({ message: "Server error" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port", PORT));
