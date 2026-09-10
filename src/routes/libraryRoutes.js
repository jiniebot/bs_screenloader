import express from "express";
import VideoAsset from "../models/VideoAsset.js";
import PlaybackEvent from "../models/PlaybackEvent.js";
import Screen from "../models/Screen.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

router.get("/library", authRequired, async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role !== "admin") {
      const groupIds = (req.user.groups || []).map((g) => g._id);
      const screenIds = await Screen.find({ group: { $in: groupIds } }).distinct("_id");
      filter.screen = { $in: screenIds };
    }

    const assets = await VideoAsset.find(filter).sort({ createdAt: -1 }).limit(200);
    const assetIds = assets.map((a) => a._id);
    const events = await PlaybackEvent.find({ videoAsset: { $in: assetIds } }).sort({
      playedAt: -1,
    });

    const historyMap = new Map();
    events.forEach((evt) => {
      const key = evt.videoAsset.toString();
      if (!historyMap.has(key)) historyMap.set(key, []);
      historyMap.get(key).push(evt.playedAt);
    });

    return res.json({
      assets: assets.map((asset) => ({
        id: asset._id,
        screen: asset.screen,
        originalName: asset.originalName,
        durationSec: asset.durationSec,
        createdAt: asset.createdAt,
        thumbnailPath: asset.thumbnailPath,
        playHistory: historyMap.get(asset._id.toString()) || [],
      })),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
