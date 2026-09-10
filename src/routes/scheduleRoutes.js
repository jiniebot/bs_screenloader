import express from "express";
import VideoSchedule from "../models/VideoSchedule.js";
import UploadJob from "../models/UploadJob.js";
import Screen from "../models/Screen.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

function canAccessScreen(user, screen) {
  if (user.role === "admin") return true;
  const groupIds = (user.groups || []).map((g) => g._id.toString());
  if (!screen.group) return false;
  return groupIds.includes(screen.group.toString());
}

router.get("/schedules", authRequired, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.screenId) {
      filter.screen = req.query.screenId;
    }
    if (req.user.role !== "admin") {
      const groupIds = (req.user.groups || []).map((g) => g._id);
      const screenIds = await Screen.find({ group: { $in: groupIds } }).distinct("_id");
      if (filter.screen) {
        const allowed = screenIds.map((id) => id.toString());
        if (!allowed.includes(filter.screen.toString())) {
          return res.status(403).json({ error: "Forbidden." });
        }
      } else {
        filter.screen = { $in: screenIds };
      }
    }

    const schedules = await VideoSchedule.find(filter)
      .populate("screen")
      .sort({ startDate: 1 })
      .limit(100);

    return res.json({
      schedules: schedules.map((schedule) => ({
        id: schedule._id,
        screen: schedule.screen?.name || "Unknown",
        screenId: schedule.screen?._id,
        screenName: schedule.screen?.name || "Unknown",
        name: schedule.name,
        description: schedule.description || "",
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        status: schedule.status,
        completedAt: schedule.completedAt,
        canceledAt: schedule.canceledAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/schedules/history", authRequired, async (req, res, next) => {
  try {
    const filter = { status: { $in: ["completed", "failed", "canceled"] } };
    if (req.user.role !== "admin") {
      const groupIds = (req.user.groups || []).map((g) => g._id);
      const screenIds = await Screen.find({ group: { $in: groupIds } }).distinct("_id");
      filter.screen = { $in: screenIds };
    }

    const schedules = await VideoSchedule.find(filter)
      .populate("screen")
      .sort({ updatedAt: -1 })
      .limit(200);

    return res.json({
      history: schedules.map((schedule) => ({
        id: schedule._id,
        screen: schedule.screen?.name || "Unknown",
        screenId: schedule.screen?._id,
        screenName: schedule.screen?.name || "Unknown",
        name: schedule.name,
        description: schedule.description || "",
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        status: schedule.status,
        completedAt: schedule.completedAt,
        canceledAt: schedule.canceledAt,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.patch("/schedules/:id", authRequired, async (req, res, next) => {
  try {
    const schedule = await VideoSchedule.findById(req.params.id).populate("screen");
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found." });
    }
    if (!schedule.screen || !canAccessScreen(req.user, schedule.screen)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (schedule.status !== "scheduled") {
      return res.status(400).json({ error: "Only scheduled items can be edited." });
    }

    const { startDate, endDate } = req.body;
    const parsedStart = new Date(startDate);
    const parsedEnd = endDate ? new Date(endDate) : null;
    if (Number.isNaN(parsedStart.getTime())) {
      return res.status(400).json({ error: "Invalid start date." });
    }
    if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ error: "Invalid end date." });
    }

    schedule.startDate = parsedStart;
    schedule.endDate = parsedEnd || undefined;
    await schedule.save();

    return res.json({ id: schedule._id });
  } catch (err) {
    return next(err);
  }
});

router.post("/schedules/:id/reschedule", authRequired, async (req, res, next) => {
  try {
    const schedule = await VideoSchedule.findById(req.params.id).populate("screen");
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found." });
    }
    if (!schedule.screen || !canAccessScreen(req.user, schedule.screen)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const { startDate, endDate } = req.body;
    const parsedStart = new Date(startDate);
    const parsedEnd = endDate ? new Date(endDate) : null;
    if (Number.isNaN(parsedStart.getTime())) {
      return res.status(400).json({ error: "Invalid start date." });
    }
    if (parsedEnd && Number.isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ error: "Invalid end date." });
    }

    const newSchedule = await VideoSchedule.create({
      screen: schedule.screen?._id,
      name: schedule.name,
      description: schedule.description || "",
      startDate: parsedStart,
      endDate: parsedEnd || undefined,
      sourcePath: schedule.sourcePath,
      status: "scheduled",
    });

    return res.status(201).json({ id: newSchedule._id });
  } catch (err) {
    return next(err);
  }
});

router.delete("/schedules/:id", authRequired, async (req, res, next) => {
  try {
    const schedule = await VideoSchedule.findById(req.params.id).populate("screen");
    if (!schedule) {
      return res.status(404).json({ error: "Schedule not found." });
    }
    if (!schedule.screen || !canAccessScreen(req.user, schedule.screen)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (["processing", "completed"].includes(schedule.status)) {
      return res.status(400).json({ error: "This schedule can no longer be canceled." });
    }

    schedule.status = "canceled";
    schedule.canceledAt = new Date();
    await schedule.save();

    await UploadJob.deleteMany({ schedule: schedule._id, status: "pending" });

    return res.json({ id: schedule._id });
  } catch (err) {
    return next(err);
  }
});

router.post("/schedules/tick", authRequired, async (req, res, next) => {
  try {
    const now = new Date();
    const due = await VideoSchedule.find({
      status: "scheduled",
      startDate: { $lte: now },
    }).populate("screen");

    const createdJobs = [];
    for (const schedule of due) {
      if (!schedule.screen || !canAccessScreen(req.user, schedule.screen)) {
        continue;
      }
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
