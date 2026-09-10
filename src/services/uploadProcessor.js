import path from "path";
import fs from "fs/promises";
import UploadJob from "../models/UploadJob.js";
import VideoSchedule from "../models/VideoSchedule.js";
import config from "../config/index.js";
import {
  processScreenVideo,
  ensureDir,
  assertVideoResolution,
} from "./videoProcessor.js";
import { generateBrightsignBundle } from "./brightsignGenerator.js";
import { uploadToFtp } from "./ftpUploader.js";
import PlaybackEvent from "../models/PlaybackEvent.js";

export async function processUploadJob(
  jobId,
  { remoteRoot, ftpUser, ftpPassword, warnIfExists = false } = {},
) {
  const job = await UploadJob.findById(jobId).populate("screen");
  if (!job) {
    throw new Error(`UploadJob not found: ${jobId}`);
  }
  if (!job.screen) {
    throw new Error(`UploadJob missing screen: ${jobId}`);
  }

  await UploadJob.findByIdAndUpdate(jobId, { status: "processing", error: null });
  if (job.schedule) {
    await VideoSchedule.findByIdAndUpdate(job.schedule, {
      status: "processing",
      error: null,
    });
  }

  const screen = job.screen;
  const screenName = screen.name;
  const processedDir = path.join(config.tempDir, screenName, job._id.toString());
  const processedPath = path.join(processedDir, `${screenName}.mp4`);

  await ensureDir(processedDir);

  await assertVideoResolution({
    inputPath: job.sourcePath,
    requiredWidth: screen.prerequisite?.width,
    requiredHeight: screen.prerequisite?.height,
  });

  await processScreenVideo({
    inputPath: job.sourcePath,
    outputPath: processedPath,
    transform: screen.transform,
    requiredInputWidth: screen.prerequisite?.width,
    requiredInputHeight: screen.prerequisite?.height,
  });

  const templateDir = screen.templateDir;
  const bundleOutputRoot = path.join(config.outputsDir, screen.destinationFolder);

  await fs.rm(bundleOutputRoot, { recursive: true, force: true });

  const bundleResult = await generateBrightsignBundle({
    videoPath: processedPath,
    playerName: screen.destinationFolder,
    outputRoot: bundleOutputRoot,
    templateDir,
    baseUrl: screen.baseUrl,
  });

  const remoteDir = screen.destinationFolder;
  const ftpPath = await uploadToFtp({
    localDir: bundleResult.outputDir,
    remoteDir,
    remoteRoot,
    ftpUser,
    ftpPassword,
    warnIfExists,
  });

  await UploadJob.findByIdAndUpdate(jobId, {
    status: "completed",
    processedPath,
    outputDir: bundleResult.outputDir,
    ftpPath,
  });
  if (job.schedule) {
    await VideoSchedule.findByIdAndUpdate(job.schedule, {
      status: "completed",
      completedAt: new Date(),
    });
    const schedule = await VideoSchedule.findById(job.schedule);
    if (schedule?.videoAsset) {
      await PlaybackEvent.create({
        videoAsset: schedule.videoAsset,
        timeSlot: schedule.timeSlot,
        schedule: schedule._id,
        occurrenceStart: schedule.startDate,
        occurrenceEnd: schedule.endDate,
        playedAt: new Date(),
      });
    }
  }

  return { processedPath, bundleDir: bundleResult.outputDir, ftpPath };
}

export async function failUploadJob(jobId, error) {
  await UploadJob.findByIdAndUpdate(jobId, {
    status: "failed",
    error: error?.message || String(error),
  });
  const job = await UploadJob.findById(jobId);
  if (job?.schedule) {
    await VideoSchedule.findByIdAndUpdate(job.schedule, {
      status: "failed",
      error: error?.message || String(error),
    });
  }
}
