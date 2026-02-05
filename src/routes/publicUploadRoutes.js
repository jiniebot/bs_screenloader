import express from "express";
import multer from "multer";
import config from "../config/index.js";
import Screen from "../models/Screen.js";
import UploadJob from "../models/UploadJob.js";
import VideoSchedule from "../models/VideoSchedule.js";

const router = express.Router();
const upload = multer({ dest: config.uploadsDir });

router.post("/public/upload", upload.single("file"), async (req, res, next) => {
  try {
    const { screen, name, description, startDate, endDate } = req.body;
    if (!screen) {
      return res.status(400).json({ error: "Screen is required." });
    }
    if (!name) {
      return res.status(400).json({ error: "Name is required." });
    }
    if (!startDate) {
      return res.status(400).json({ error: "Start date is required." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Missing file upload." });
    }

    const screenDoc = await Screen.findOne({ name: screen });
    if (!screenDoc) {
      return res.status(404).json({ error: "Screen not found." });
    }

    const parsedStart = new Date(startDate);
    const parsedEnd = endDate ? new Date(endDate) : null;
    if (Number.isNaN(parsedStart.getTime())) {
      return res.status(400).json({ error: "Invalid start date." });
    }
    if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ error: "Invalid end date." });
    }

    const schedule = await VideoSchedule.create({
      screen: screenDoc._id,
      name,
      description: description || "",
      startDate: parsedStart,
      endDate: parsedEnd || undefined,
      sourcePath: req.file.path,
      status: "scheduled",
    });

    let job = null;
    if (parsedStart <= new Date()) {
      job = await UploadJob.create({
        screen: screenDoc._id,
        schedule: schedule._id,
        sourcePath: req.file.path,
        metadata: {
          name,
          description: description || "",
          startDate,
          endDate: endDate || "",
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        },
      });
      await VideoSchedule.findByIdAndUpdate(schedule._id, { status: "queued" });
    }

    return res.status(201).json({
      scheduleId: schedule._id,
      jobId: job ? job._id : null,
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/public/schedules", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.screen) {
      const screenDoc = await Screen.findOne({ name: req.query.screen });
      if (screenDoc) {
        filter.screen = screenDoc._id;
      }
    }

    const schedules = await VideoSchedule.find(filter)
      .populate("screen")
      .sort({ startDate: 1 })
      .limit(50);

    const payload = schedules.map((schedule) => ({
      id: schedule._id,
      screen: schedule.screen?.name || "Unknown",
      name: schedule.name,
      description: schedule.description || "",
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      status: schedule.status,
    }));

    return res.json({ schedules: payload });
  } catch (err) {
    return next(err);
  }
});

router.post("/public/schedules/tick", async (req, res, next) => {
  try {
    const now = new Date();
    const due = await VideoSchedule.find({
      status: "scheduled",
      startDate: { $lte: now },
    }).populate("screen");

    const createdJobs = [];
    for (const schedule of due) {
      await VideoSchedule.findByIdAndUpdate(schedule._id, { status: "queued" });
      const job = await UploadJob.create({
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
      createdJobs.push(job._id);
    }

    return res.json({ promoted: createdJobs.length, jobs: createdJobs });
  } catch (err) {
    return next(err);
  }
});

export default router;
