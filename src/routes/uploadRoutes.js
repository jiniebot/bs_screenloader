import express from "express";
import multer from "multer";
import UploadLink from "../models/UploadLink.js";
import UploadJob from "../models/UploadJob.js";
import VideoSchedule from "../models/VideoSchedule.js";
import Screen from "../models/Screen.js";
import VideoAsset from "../models/VideoAsset.js";
import SlotAssignment from "../models/SlotAssignment.js";
import {
  assertVideoResolution,
  readVideoDurationSeconds,
} from "../services/videoProcessor.js";
import config from "../config/index.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ dest: config.uploadsDir });

function canAccessScreen(user, screen) {
  if (user.role === "admin") return true;
  const groupIds = (user.groups || []).map((g) => g._id.toString());
  if (!screen.group) return false;
  return groupIds.includes(screen.group.toString());
}

router.post("/upload/:token", upload.single("file"), async (req, res, next) => {
  try {
    const token = req.params.token;
    const link = await UploadLink.findOne({ token, status: "active" }).populate("screen");
    if (!link) {
      return res.status(404).json({ error: "Invalid or expired link." });
    }
    if (link.expiresAt && link.expiresAt <= new Date()) {
      return res.status(410).json({ error: "Link has expired." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Missing file upload." });
    }

    try {
      await assertVideoResolution({
        inputPath: req.file.path,
        requiredWidth: link.screen?.prerequisite?.width,
        requiredHeight: link.screen?.prerequisite?.height,
      });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Invalid video resolution." });
    }

    const minSec =
      link.durationMinSec ??
      link.screen?.durationMinSec ??
      config.durationDefaults.minSec;
    const maxSec =
      link.durationMaxSec ??
      link.screen?.durationMaxSec ??
      config.durationDefaults.maxSec;
    if (minSec || maxSec) {
      const durationSeconds = await readVideoDurationSeconds(req.file.path);
      if (minSec && durationSeconds < minSec) {
        return res.status(400).json({
          error: `Video too short. Minimum ${minSec}s required.`,
        });
      }
      if (maxSec && durationSeconds > maxSec) {
        return res.status(400).json({
          error: `Video too long. Maximum ${maxSec}s allowed.`,
        });
      }
    }

    const durationSeconds = await readVideoDurationSeconds(req.file.path);
    const asset = await VideoAsset.create({
      screen: link.screen?._id,
      uploadedBy: link.issuedBy,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      durationSec: durationSeconds,
      sourcePath: req.file.path,
      notes: link.description || "",
    });

    let assignment = null;
    if (link.timeSlot && link.occurrenceStart && link.occurrenceEnd) {
      assignment = await SlotAssignment.create({
        timeSlot: link.timeSlot,
        videoAsset: asset._id,
        occurrenceStart: link.occurrenceStart,
        occurrenceEnd: link.occurrenceEnd,
        assignedBy: link.issuedBy,
      });
    }

    const schedule = await VideoSchedule.create({
      screen: link.screen?._id,
      name: link.name || "Untitled Upload",
      description: link.description || "",
      startDate: link.occurrenceStart || link.startDate,
      endDate: link.occurrenceEnd || link.endDate || undefined,
      sourcePath: req.file.path,
      status: "scheduled",
      videoAsset: asset._id,
      timeSlot: link.timeSlot || undefined,
      assignment: assignment?._id,
    });

    let job = null;
    if ((link.occurrenceStart || link.startDate) <= new Date()) {
      job = await UploadJob.create({
        uploadLink: link._id,
        screen: link.screen?._id,
        schedule: schedule._id,
        videoAsset: asset._id,
        sourcePath: req.file.path,
        metadata: {
          name: link.name || "",
          description: link.description || "",
          startDate: link.occurrenceStart || link.startDate,
          endDate: link.occurrenceEnd || link.endDate || "",
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        },
      });
      await VideoSchedule.findByIdAndUpdate(schedule._id, { status: "queued" });
    }

    await UploadLink.findByIdAndUpdate(link._id, {
      status: "used",
      expiresAt: new Date(),
    });

    return res.status(201).json({
      scheduleId: schedule._id,
      jobId: job ? job._id : null,
    });
  } catch (err) {
    return next(err);
  }
});

router.post(
  "/uploads/direct",
  authRequired,
  upload.single("file"),
  async (req, res, next) => {
    try {
      const { screenId, name, description, startDate, endDate } = req.body;
      if (!screenId) {
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

      const screen = await Screen.findById(screenId);
      if (!screen) {
        return res.status(404).json({ error: "Screen not found." });
      }
      if (!canAccessScreen(req.user, screen)) {
        return res.status(403).json({ error: "Forbidden." });
      }

      const parsedStart = new Date(startDate);
      const parsedEnd = endDate ? new Date(endDate) : null;
      if (Number.isNaN(parsedStart.getTime())) {
        return res.status(400).json({ error: "Invalid start date." });
      }
      if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ error: "Invalid end date." });
      }

      try {
        await assertVideoResolution({
          inputPath: req.file.path,
          requiredWidth: screen.prerequisite?.width,
          requiredHeight: screen.prerequisite?.height,
        });
      } catch (err) {
        return res
          .status(400)
          .json({ error: err.message || "Invalid video resolution." });
      }

      const minSec = screen.durationMinSec ?? config.durationDefaults.minSec;
      const maxSec = screen.durationMaxSec ?? config.durationDefaults.maxSec;
      const durationSeconds = await readVideoDurationSeconds(req.file.path);
      if (minSec && durationSeconds < minSec) {
        return res.status(400).json({
          error: `Video too short. Minimum ${minSec}s required.`,
        });
      }
      if (maxSec && durationSeconds > maxSec) {
        return res.status(400).json({
          error: `Video too long. Maximum ${maxSec}s allowed.`,
        });
      }

      const asset = await VideoAsset.create({
        screen: screen._id,
        uploadedBy: req.user._id,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        durationSec: durationSeconds,
        sourcePath: req.file.path,
        notes: description || "",
      });

      const schedule = await VideoSchedule.create({
        screen: screen._id,
        name,
        description: description || "",
        startDate: parsedStart,
        endDate: parsedEnd || undefined,
        sourcePath: req.file.path,
        status: "scheduled",
        videoAsset: asset._id,
      });

      let job = null;
      if (parsedStart <= new Date()) {
        job = await UploadJob.create({
          screen: screen._id,
          schedule: schedule._id,
          videoAsset: asset._id,
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
  },
);

export default router;
