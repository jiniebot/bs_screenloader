import path from "path";
import crypto from "crypto";
import { connectMongo } from "../db/mongo.js";
import Screen from "../models/Screen.js";
import UploadLink from "../models/UploadLink.js";
import UploadJob from "../models/UploadJob.js";
import { processUploadJob } from "../services/uploadProcessor.js";

function usage() {
  return [
    "Usage:",
    "  node src/scripts/pipelineTest.js --screen <screen-name> --file <video-path>",
    "",
    "Example:",
    "  node src/scripts/pipelineTest.js --screen macys_cos_womens --file ./uploads/test.mp4",
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
  });

  const sourcePath = path.resolve(parsed.filePath);
  const job = await UploadJob.create({
    uploadLink: link._id,
    screen: screen._id,
    sourcePath,
    metadata: { trigger: "cli" },
  });

  console.log(`Created UploadJob ${job._id} for screen ${screen.name}`);
  const result = await processUploadJob(job._id);
  console.log("Pipeline complete:");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
