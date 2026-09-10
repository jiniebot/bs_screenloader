import path from "path";
import crypto from "crypto";
import { connectMongo } from "../db/mongo.js";
import Screen from "../models/Screen.js";
import UploadLink from "../models/UploadLink.js";
import UploadJob from "../models/UploadJob.js";
import { processUploadJob } from "../services/uploadProcessor.js";
import config from "../config/index.js";

// FTP sub-account home must be set to public_html/videos in cPanel.
// With that chroot, FTP "/" = "~/public_html/videos/", so remoteRoot "/" -> "~/public_html/videos/<folder>".
const PROD_REMOTE_ROOT = "/";

function usage() {
  return [
    "Usage:",
    "  node src/scripts/pipeline.js --screen <screen-name> --file <video-path>",
    "",
    "Example:",
    "  node src/scripts/pipeline.js --screen macys_cos_womens --file ./uploads/video.mp4",
    "",
    `Uploads to: ~${PROD_REMOTE_ROOT}/<screen-destination-folder>`,
    "Any existing folder at that location will be replaced (you will be warned).",
  ].join("\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const screenIndex = args.indexOf("--screen");
  const fileIndex = args.indexOf("--file");
  if (screenIndex === -1 || fileIndex === -1) return null;
  const screenName = args[screenIndex + 1];
  const filePath = args[fileIndex + 1];
  if (!screenName || !filePath) return null;
  return { screenName, filePath };
}

async function run() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    console.error(usage());
    process.exit(1);
  }

  await connectMongo();

  const screen = await Screen.findOne({ name: parsed.screenName });
  if (!screen) {
    console.error(`Screen not found: ${parsed.screenName}`);
    process.exit(1);
  }

  const token = crypto.randomBytes(16).toString("hex");
  const link = await UploadLink.create({
    token,
    screen: screen._id,
    status: "active",
    startDate: new Date(),
  });

  const sourcePath = path.resolve(parsed.filePath);
  const job = await UploadJob.create({
    uploadLink: link._id,
    screen: screen._id,
    sourcePath,
    metadata: { trigger: "cli-prod" },
  });

  console.log(`Created UploadJob ${job._id} for screen ${screen.name}`);
  console.log(`Target: ~${PROD_REMOTE_ROOT}/${screen.destinationFolder}`);

  const result = await processUploadJob(job._id, {
    remoteRoot: PROD_REMOTE_ROOT,
    ftpUser: config.ftp.userProd,
    ftpPassword: config.ftp.passwordProd,
    warnIfExists: true,
  });

  console.log("Pipeline complete:");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
