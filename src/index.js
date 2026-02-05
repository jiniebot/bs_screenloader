import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config/index.js";
import { connectMongo } from "./db/mongo.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import publicUploadRoutes from "./routes/publicUploadRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  await connectMongo();

  const app = express();
  app.use(express.json());
  app.use(express.static("public"));

  app.get("/health", (req, res) => res.json({ ok: true }));
  app.use("/api", uploadRoutes);
  app.use("/api", publicUploadRoutes);

  app.use((err, req, res, next) => {
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
