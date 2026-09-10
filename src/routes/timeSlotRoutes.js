import express from "express";
import rrulePkg from "rrule";
const { RRule } = rrulePkg;
import TimeSlot from "../models/TimeSlot.js";
import Screen from "../models/Screen.js";
import SlotAssignment from "../models/SlotAssignment.js";
import VideoSchedule from "../models/VideoSchedule.js";
import { authRequired } from "../middleware/auth.js";
import { createUploadLink } from "../services/linkService.js";
import config from "../config/index.js";

const router = express.Router();

function canAccessScreen(user, screen) {
  if (user.role === "admin") return true;
  const groupIds = (user.groups || []).map((g) => g._id.toString());
  if (!screen.group) return false;
  return groupIds.includes(screen.group.toString());
}

function buildRrule({ startDate, frequency, interval, byWeekday, until }) {
  const freqMap = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY,
  };
  const freq = freqMap[String(frequency || "weekly").toLowerCase()] || RRule.WEEKLY;
  const ruleOptions = {
    freq,
    interval: Number(interval || 1),
    dtstart: startDate,
  };
  if (Array.isArray(byWeekday) && byWeekday.length) {
    ruleOptions.byweekday = byWeekday.map((d) => RRule.weekdays[Number(d)]);
  }
  if (until) {
    ruleOptions.until = until;
  }
  return new RRule(ruleOptions);
}

router.get("/timeslots", authRequired, async (req, res, next) => {
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

    const slots = await TimeSlot.find(filter).populate("screen").sort({ createdAt: -1 });
    return res.json({
      timeslots: slots.map((slot) => ({
        id: slot._id,
        name: slot.name,
        screenId: slot.screen?._id,
        screenName: slot.screen?.name,
        startDate: slot.startDate,
        endDate: slot.endDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        rrule: slot.rrule,
        exceptions: slot.exceptions || [],
        status: slot.status,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/timeslots", authRequired, async (req, res, next) => {
  try {
    const {
      screenId,
      name,
      startDate,
      endDate,
      startTime,
      endTime,
      frequency,
      interval,
      byWeekday,
      until,
      exceptions,
    } = req.body;
    if (!screenId || !name || !startDate || !startTime || !endTime) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const screen = await Screen.findById(screenId);
    if (!screen) {
      return res.status(404).json({ error: "Screen not found." });
    }
    if (!canAccessScreen(req.user, screen)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const start = new Date(`${startDate}T${startTime}`);
    const end = endDate ? new Date(endDate) : null;
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ error: "Invalid start date." });
    }

    const untilDate = until ? new Date(until) : null;
    const rule = buildRrule({
      startDate: start,
      frequency,
      interval,
      byWeekday,
      until: untilDate || undefined,
    });

    const exceptionDates = Array.isArray(exceptions)
      ? exceptions.map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime()))
      : [];

    const slot = await TimeSlot.create({
      screen: screen._id,
      name,
      startDate: start,
      endDate: end || undefined,
      startTime,
      endTime,
      rrule: rule.toString(),
      exceptions: exceptionDates,
      createdBy: req.user._id,
    });

    return res.status(201).json({ id: slot._id });
  } catch (err) {
    return next(err);
  }
});

router.get("/timeslots/occurrences", authRequired, async (req, res, next) => {
  try {
    const { start, end, screenId } = req.query;
    const rangeStart = new Date(start);
    const rangeEnd = new Date(end);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      return res.status(400).json({ error: "Invalid range." });
    }

    const filter = {};
    if (screenId) filter.screen = screenId;
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

    const slots = await TimeSlot.find(filter).populate("screen");
    const assignments = await SlotAssignment.find({
      occurrenceStart: { $gte: rangeStart, $lte: rangeEnd },
    });
    const assignmentMap = new Map();
    assignments.forEach((a) => {
      assignmentMap.set(`${a.timeSlot.toString()}|${a.occurrenceStart.toISOString()}`, a);
    });

    const occurrences = [];
    for (const slot of slots) {
      const rule = RRule.fromString(slot.rrule);
      const ex = (slot.exceptions || []).map((d) => new Date(d));
      const dates = rule.between(rangeStart, rangeEnd, true);
      dates.forEach((date) => {
        const startDt = new Date(date);
        const endDt = new Date(date);
        const [endH, endM] = slot.endTime.split(":").map(Number);
        endDt.setHours(endH || 0, endM || 0, 0, 0);
        const excluded = ex.some(
          (exDate) => exDate.toDateString() === startDt.toDateString(),
        );
        if (excluded) return;
        const key = `${slot._id.toString()}|${startDt.toISOString()}`;
        const assignment = assignmentMap.get(key);
        occurrences.push({
          id: key,
          timeSlotId: slot._id,
          name: slot.name,
          screenId: slot.screen?._id,
          screenName: slot.screen?.name,
          start: startDt,
          end: endDt,
          assigned: Boolean(assignment),
          assignmentId: assignment?._id,
        });
      });
    }

    return res.json({ occurrences });
  } catch (err) {
    return next(err);
  }
});

router.post("/timeslots/:id/link", authRequired, async (req, res, next) => {
  try {
    const slot = await TimeSlot.findById(req.params.id).populate("screen");
    if (!slot) {
      return res.status(404).json({ error: "TimeSlot not found." });
    }
    if (!slot.screen || !canAccessScreen(req.user, slot.screen)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const { occurrenceStart, occurrenceEnd } = req.body;
    const occStart = new Date(occurrenceStart);
    const occEnd = new Date(occurrenceEnd);
    if (Number.isNaN(occStart.getTime()) || Number.isNaN(occEnd.getTime())) {
      return res.status(400).json({ error: "Invalid occurrence times." });
    }

    const link = await createUploadLink({
      screenId: slot.screen._id,
      timeSlotId: slot._id,
      issuedById: req.user._id,
      expiresAt: new Date(Date.now() + config.linkExpiryDays * 24 * 60 * 60 * 1000),
      name: slot.name,
      description: "",
      startDate: occStart,
      endDate: occEnd,
      occurrenceStart: occStart,
      occurrenceEnd: occEnd,
    });

    return res.status(201).json({ token: link.token, id: link._id });
  } catch (err) {
    return next(err);
  }
});

router.delete("/timeslots/:id/occurrence", authRequired, async (req, res, next) => {
  try {
    const slot = await TimeSlot.findById(req.params.id).populate("screen");
    if (!slot) {
      return res.status(404).json({ error: "TimeSlot not found." });
    }
    if (!slot.screen || !canAccessScreen(req.user, slot.screen)) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const occStart = new Date(req.query.occurrenceStart);
    if (Number.isNaN(occStart.getTime())) {
      return res.status(400).json({ error: "Invalid occurrence." });
    }

    await SlotAssignment.updateMany(
      { timeSlot: slot._id, occurrenceStart: occStart },
      { $set: { status: "canceled" } },
    );

    const schedule = await VideoSchedule.findOne({
      timeSlot: slot._id,
      startDate: occStart,
      status: { $in: ["scheduled", "queued"] },
    });
    if (schedule) {
      schedule.status = "canceled";
      schedule.canceledAt = new Date();
      await schedule.save();
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
