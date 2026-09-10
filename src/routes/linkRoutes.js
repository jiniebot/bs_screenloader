import express from "express";
import Screen from "../models/Screen.js";
import UploadLink from "../models/UploadLink.js";
import { createUploadLink } from "../services/linkService.js";
import config from "../config/index.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

function canAccessScreen(user, screen) {
  if (user.role === "admin") return true;
  const groupIds = (user.groups || []).map((g) => g._id.toString());
  if (!screen.group) return false;
  return groupIds.includes(screen.group.toString());
}

router.post("/links", authRequired, async (req, res, next) => {
  try {
    const {
      screenId,
      name,
      description,
      startDate,
      endDate,
      expiresAt,
      durationMinSec,
      durationMaxSec,
    } = req.body;
    if (!screenId || !startDate) {
      return res.status(400).json({ error: "Screen and start date are required." });
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

    const parsedExpires = expiresAt ? new Date(expiresAt) : null;
    const defaultExpiry = new Date(
      Date.now() + config.linkExpiryDays * 24 * 60 * 60 * 1000,
    );
    const link = await createUploadLink({
      screenId: screen._id,
      issuedById: req.user._id,
      expiresAt: parsedExpires || defaultExpiry,
      name: name || "",
      description: description || "",
      startDate: parsedStart,
      endDate: parsedEnd || undefined,
      durationMinSec:
        durationMinSec !== undefined && durationMinSec !== ""
          ? Number(durationMinSec)
          : (screen.durationMinSec ?? config.durationDefaults.minSec),
      durationMaxSec:
        durationMaxSec !== undefined && durationMaxSec !== ""
          ? Number(durationMaxSec)
          : (screen.durationMaxSec ?? config.durationDefaults.maxSec),
    });

    return res.status(201).json({ token: link.token, id: link._id });
  } catch (err) {
    return next(err);
  }
});

router.get("/links", authRequired, async (req, res, next) => {
  try {
    const filter = req.user.role === "admin" ? {} : { issuedBy: req.user._id };
    const links = await UploadLink.find(filter)
      .populate("screen")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({
      links: links.map((link) => ({
        id: link._id,
        token: link.token,
        screen: link.screen?.name || "Unknown",
        name: link.name || "",
        description: link.description || "",
        startDate: link.startDate,
        endDate: link.endDate,
        durationMinSec: link.durationMinSec,
        durationMaxSec: link.durationMaxSec,
        status: link.status,
        expiresAt: link.expiresAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.delete("/links/:id", authRequired, async (req, res, next) => {
  try {
    const link = await UploadLink.findById(req.params.id).populate("screen");
    if (!link) {
      return res.status(404).json({ error: "Link not found." });
    }
    if (req.user.role !== "admin" && link.issuedBy?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Forbidden." });
    }

    await UploadLink.findByIdAndDelete(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
