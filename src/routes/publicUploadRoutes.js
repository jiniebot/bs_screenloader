import express from "express";
import multer from "multer";
import config from "../config/index.js";
import UploadJob from "../models/UploadJob.js";
import UploadLink from "../models/UploadLink.js";
import VideoSchedule from "../models/VideoSchedule.js";
import VideoAsset from "../models/VideoAsset.js";
import SlotAssignment from "../models/SlotAssignment.js";
import {
  assertVideoResolution,
  readVideoDurationSeconds,
} from "../services/videoProcessor.js";
import { videoFileFilter } from "../services/uploadValidation.js";

const router = express.Router();
const upload = multer({ dest: config.uploadsDir, fileFilter: videoFileFilter });

router.get("/public/link/:token", async (req, res, next) => {
  try {
    const token = req.params.token;
    const link = await UploadLink.findOne({ token, status: "active" }).populate("screen");
    if (!link) {
      return res.status(404).json({ error: "Invalid or expired link." });
    }
    if (link.expiresAt && link.expiresAt <= new Date()) {
      return res.status(410).json({ error: "Link has expired." });
    }

    return res.json({
      screen: {
        id: link.screen?._id,
        name: link.screen?.name,
        prerequisite: link.screen?.prerequisite,
        durationMinSec:
          link.durationMinSec ??
          link.screen?.durationMinSec ??
          config.durationDefaults.minSec,
        durationMaxSec:
          link.durationMaxSec ??
          link.screen?.durationMaxSec ??
          config.durationDefaults.maxSec,
      },
      name: link.name || "",
      description: link.description || "",
      startDate: link.startDate,
      endDate: link.endDate,
      durationMinSec:
        link.durationMinSec ??
        link.screen?.durationMinSec ??
        config.durationDefaults.minSec,
      durationMaxSec:
        link.durationMaxSec ??
        link.screen?.durationMaxSec ??
        config.durationDefaults.maxSec,
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/public/upload/:token", upload.single("file"), async (req, res, next) => {
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

export default router;
