import dotenv from "dotenv";

dotenv.config();

const required = ["MONGODB_URI"];

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[config] Missing required env var: ${key}`);
  }
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
    user: process.env.FTP_USER || "",
    password: process.env.FTP_PASSWORD || "",
    secure: process.env.FTP_SECURE === "true",
    remoteRoot: process.env.FTP_REMOTE_ROOT || "/",
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
      process.env.SCREEN_WOMENS_BASE ||
      "http://www.joebiber.com/videos/macys_cos_womens",
    mensBaseUrl:
      process.env.SCREEN_MENS_BASE ||
      "http://www.joebiber.com/videos/macys_cos_mens",
  },
  jobPollMs: Number(process.env.JOB_POLL_MS || 5000),
};

export default config;
