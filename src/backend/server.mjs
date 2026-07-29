import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import rateLimit from "express-rate-limit";
import compression from "compression";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./utils/logger.mjs";
import {
  connectWithRetry,
  closeDB,
  isDatabaseConnected,
} from "./utils/mongodbConnection.mjs";
import combinedDataRoute from "./routes/combinedDataRoute.mjs";
import clickRoute from "./routes/clickRoute.mjs";
import expressStaticGzip from "express-static-gzip";

const requiredEnvVars = [
  "MONGODB_DB_USER",
  "MONGODB_DB_PASSWORD",
  "MONGODB_SERVER",
  "MONGODB_DB",
  "CORS_ORIGINS",
  "VITE_BUNNYCDN_BASE_URL",
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

app.set("trust proxy", 1);

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

// Mirrors nginx/conf.d/default.conf, which is the policy that actually governs
// the site — in production nginx serves the HTML and this process only answers
// /api/, where a CSP has nothing to act on. Kept in step so that running the
// backend standalone (pnpm dev) behaves like production rather than more
// loosely. Change both together.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        fontSrc: ["'self'", "data:"],
        frameSrc: ["www.google.com"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        workerSrc: ["blob:"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    frameguard: { action: "sameorigin" },
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

// Liveness: the process is up and serving. Deliberately independent of the
// database — a container that is running should not be killed and restarted
// because a downstream service is briefly unreachable.
app.get("/healthz", (_, res) => res.status(200).send("ok"));

// Readiness: can this instance actually serve data? Referenced by the rate
// limiter's skip list above but never implemented until now, so it fell
// through to the SPA fallback and tried to send a build/index.html that does
// not exist in the backend image.
app.get("/ready", (_, res) => {
  const connected = isDatabaseConnected();
  res
    .status(connected ? 200 : 503)
    .json({ ready: connected, database: connected ? "connected" : "connecting" });
});
app.use("/api", combinedDataRoute);
app.use("/api", clickRoute);

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

// Listen first, connect second. The database is not a precondition for being
// able to answer /healthz and /ready, and gating app.listen() on it meant one
// failed connect took the whole process down before it could report anything.
const server = app.listen(PORT, () => logger.info(`Server on port ${PORT}`));

// Fire and forget: retries with backoff internally and never rejects.
connectWithRetry();

const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down`);
  await closeDB();
  server.close(() => process.exit(0));
  // Don't hang forever on lingering keep-alive sockets.
  setTimeout(() => process.exit(0), 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { closeDB };
