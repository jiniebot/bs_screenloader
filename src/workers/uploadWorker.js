import config from "../config/index.js";
import { connectMongo } from "../db/mongo.js";
import UploadJob from "../models/UploadJob.js";
import VideoSchedule from "../models/VideoSchedule.js";
import { processUploadJob, failUploadJob } from "../services/uploadProcessor.js";

async function claimNextJob() {
  return UploadJob.findOneAndUpdate(
    { status: "pending" },
    { status: "processing" },
    { sort: { createdAt: 1 }, new: true }
  ).populate("screen");
}

async function claimDueSchedule() {
  return VideoSchedule.findOneAndUpdate(
    { status: "scheduled", startDate: { $lte: new Date() } },
    { status: "queued" },
    { sort: { startDate: 1 }, new: true }
  ).populate("screen");
}

async function promoteScheduleToJob(schedule) {
  return UploadJob.create({
    screen: schedule.screen?._id,
    schedule: schedule._id,
    sourcePath: schedule.sourcePath,
    metadata: {
      name: schedule.name,
      description: schedule.description || "",
      startDate: schedule.startDate,
      endDate: schedule.endDate || "",
    },
  });
}

async function workLoop() {
  const schedule = await claimDueSchedule();
  if (schedule) {
    try {
      const job = await promoteScheduleToJob(schedule);
      await processUploadJob(job._id);
    } catch (err) {
      const job = await UploadJob.findOne({ schedule: schedule._id });
      if (job) {
        await failUploadJob(job._id, err);
      } else {
        await VideoSchedule.findByIdAndUpdate(schedule._id, {
          status: "failed",
          error: err?.message || String(err),
        });
      }
    }
    return;
  }

  const job = await claimNextJob();
  if (!job) {
    return;
  }

  try {
    await processUploadJob(job._id);
  } catch (err) {
    await failUploadJob(job._id, err);
  }
}

async function start() {
  await connectMongo();
  console.log("[worker] Upload worker started");
  setInterval(() => {
    workLoop().catch((err) => console.error("[worker]", err));
  }, config.jobPollMs);
}

start().catch((err) => {
  console.error("[worker] Failed to start", err);
  process.exit(1);
});
