import dotenv from "dotenv";

dotenv.config();

const required = ["MONGODB_URI"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[config] Missing required env var: ${key}`);
  }
}

const DEV_JWT_SECRET = "dev-secret-change-me";
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_JWT_SECRET) {
  if (isProduction) {
    throw new Error(
      "[config] JWT_SECRET must be set to a strong random value in production. " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  console.warn(
    "[config] JWT_SECRET is missing or using the insecure default — fine for local dev only.",
  );
}

function parseDurationMs(value) {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(String(value).trim());
  if (!match) return 8 * 60 * 60 * 1000; // fall back to 8h
  const amount = Number(match[1]);
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return amount * unitMs;
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  mongodbUri: process.env.MONGODB_URI || "",
  uploadsDir: process.env.UPLOADS_DIR || "./uploads",
  outputsDir: process.env.OUTPUTS_DIR || "./outputs",
  tempDir: process.env.TEMP_DIR || "./tmp",
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  ftp: {
    host: process.env.FTP_HOST || "",
    user: process.env.FTP_USER_DEV || process.env.FTP_USER || "",
    password: process.env.FTP_PASSWORD_DEV || process.env.FTP_PASSWORD || "",
    userProd: process.env.FTP_USER_PROD || "",
    passwordProd: process.env.FTP_PASSWORD_PROD || "",
    secure: process.env.FTP_SECURE === "true",
    remoteRoot: process.env.FTP_REMOTE_ROOT || "/",
    timeoutMs: Number(process.env.FTP_TIMEOUT_MS || 120000),
    keepAliveMs: Number(process.env.FTP_KEEPALIVE_MS || 10000),
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    bucket: process.env.R2_BUCKET || "",
    endpoint: process.env.R2_ENDPOINT || "",
  },
  processing: {
    defaultCanvasWidth: Number(process.env.CANVAS_W || 1920),
    defaultCanvasHeight: Number(process.env.CANVAS_H || 1080),
  },
  templates: {
    mens: process.env.TEMPLATE_MENS || "source mens proj",
    womens: process.env.TEMPLATE_WOMENS || "source womens proj",
  },
  screenDefaults: {
    womensBaseUrl:
      process.env.SCREEN_WOMENS_BASE || "http://www.joebiber.com/videos/macys_cos_womens",
    mensBaseUrl:
      process.env.SCREEN_MENS_BASE || "http://www.joebiber.com/videos/macys_cos_mens",
  },
  jobPollMs: Number(process.env.JOB_POLL_MS || 5000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtTtl: process.env.JWT_TTL || "8h",
  jwtTtlMs: parseDurationMs(process.env.JWT_TTL || "8h"),
  durationDefaults: {
    minSec: Number(process.env.DURATION_MIN_SEC || 1),
    maxSec: process.env.DURATION_MAX_SEC ? Number(process.env.DURATION_MAX_SEC) : null,
  },
  linkExpiryDays: Number(process.env.LINK_EXPIRY_DAYS || 7),
  bsnCloud: {
    clientId: process.env.BSN_CLIENTID || "",
    clientSecret: process.env.BSN_CLIENTSECRET || "",
  },
  mail: {
    fromAddress: process.env.MAIL_FROM || "",
    smtpHost: process.env.SMTP_HOST || "127.0.0.1",
    smtpPort: Number(process.env.SMTP_PORT || 25),
  },
  monitor: {
    pollMs: Number(process.env.MONITOR_POLL_MS || 5 * 60 * 1000),
    failureThreshold: Number(process.env.MONITOR_FAILURE_THRESHOLD || 2),
  },
};

export default config;
