import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import config from "./config/index.js";
import { connectMongo } from "./db/mongo.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import publicUploadRoutes from "./routes/publicUploadRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import screenRoutes from "./routes/screenRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import linkRoutes from "./routes/linkRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import timeSlotRoutes from "./routes/timeSlotRoutes.js";
import libraryRoutes from "./routes/libraryRoutes.js";

async function start() {
  await connectMongo();

  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      // The vendor calendar bundle and inline progress-bar styles haven't been
      // audited against a strict CSP yet; leave it off rather than ship a
      // silently broken policy. The other helmet protections still apply.
      contentSecurityPolicy: false,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static("public"));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again later." },
  });

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/bootstrap", authLimiter);
  app.use("/api", uploadRoutes);
  app.use("/api", publicUploadRoutes);
  app.use("/api", authRoutes);
  app.use("/api", screenRoutes);
  app.use("/api", groupRoutes);
  app.use("/api", linkRoutes);
  app.use("/api", scheduleRoutes);
  app.use("/api", timeSlotRoutes);
  app.use("/api", libraryRoutes);

  app.use((err, req, res, _next) => {
    console.error("[api]", err);
    res.status(500).json({ error: "Internal server error" });
  });

  app.listen(config.port, () => {
    console.log(`[api] Listening on :${config.port}`);
  });
}

start().catch((err) => {
  console.error("[api] Failed to start", err);
  process.exit(1);
});
