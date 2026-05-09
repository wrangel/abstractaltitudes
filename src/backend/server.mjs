import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./utils/logger.mjs";
import { connectDB, closeDB } from "./utils/mongodbConnection.mjs";
import combinedDataRoute from "./routes/combinedDataRoute.mjs";
import bunnySignRoute from "./routes/bunnySignRoute.mjs";
import expressStaticGzip from "express-static-gzip";

const requiredEnvVars = [
  "MONGODB_DB_USER",
  "MONGODB_DB_PASSWORD",
  "MONGODB_SERVER",
  "MONGODB_DB",
  "CORS_ORIGINS",
];

requiredEnvVars.forEach((v) => {
  if (!process.env[v]) {
    logger.error(`Missing required environment variable: ${v}`);
    process.exit(1);
  }
});

const corsOrigins = process.env.CORS_ORIGINS.split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const app = express();
const PORT = process.env.PORT || 8081;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS BLOCKED: origin "${origin}" not in whitelist`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
};

// 1. GLOBAL RATE LIMITER (General protection for static files and fallback)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // Slightly higher for static assets
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

app.use(cors(corsOptions));
app.use(express.json());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    frameguard: { action: "deny" },
  }),
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(
  "/",
  expressStaticGzip(path.join(__dirname, "../../build"), {
    enableBrotli: true,
    orderPreference: ["br", "gz"],
    maxAge: "1d",
  }),
);

app.use(compression({ level: 6, threshold: 1024 }));

// 2. API RATE LIMITER (Stricter protection for database routes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/healthz" || req.path === "/ready",
});

app.use("/api", apiLimiter);

// Endpoints
app.get("/healthz", (_, res) => res.status(200).send("ok"));
app.use("/api", combinedDataRoute);
app.use("/api", bunnySignRoute);

app.get("/api/test-mongo", async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ message: "MongoDB connection successful" });
  } catch (error) {
    res.status(500).json({ error: "MongoDB connection test failed" });
  }
});

// SPA Fallback - Now covered by globalLimiter
app.get("/*path", (req, res) => {
  res.sendFile(path.join(__dirname, "../../build", "index.html"));
});

// Error handling
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

mongoose.set("strictQuery", false);
connectDB().then(() => {
  const server = app.listen(PORT, () => logger.info(`Server on port ${PORT}`));
  process.on("SIGTERM", async () => {
    await closeDB();
    server.close(() => process.exit(0));
  });
});

export { closeDB };
