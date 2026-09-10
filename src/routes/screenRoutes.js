import express from "express";
import Screen from "../models/Screen.js";
import Group from "../models/Group.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

function screenPayload(screen) {
  return {
    id: screen._id,
    name: screen.name,
    companyName: screen.companyName,
    owner: screen.owner,
    group: screen.group,
    templateDir: screen.templateDir,
    destinationFolder: screen.destinationFolder,
    baseUrl: screen.baseUrl,
    prerequisite: screen.prerequisite,
    transform: screen.transform,
    durationMinSec: screen.durationMinSec,
    durationMaxSec: screen.durationMaxSec,
  };
}

router.get("/screens", authRequired, async (req, res, next) => {
  try {
    let screens;
    if (req.user.role === "admin") {
      screens = await Screen.find().populate("group").sort({ name: 1 });
    } else {
      const groupIds = (req.user.groups || []).map((g) => g._id);
      screens = await Screen.find({ group: { $in: groupIds } })
        .populate("group")
        .sort({ name: 1 });
    }

    return res.json({ screens: screens.map(screenPayload) });
  } catch (err) {
    return next(err);
  }
});

router.post("/screens", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const {
      name,
      companyName,
      owner,
      templateDir,
      destinationFolder,
      baseUrl,
      prerequisite,
      transform,
      groupId,
    } = req.body;

    if (
      !name ||
      !companyName ||
      !owner ||
      !templateDir ||
      !destinationFolder ||
      !baseUrl
    ) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const screen = await Screen.create({
      name,
      companyName,
      owner,
      templateDir,
      destinationFolder,
      baseUrl,
      prerequisite,
      transform,
      group: groupId || null,
    });

    if (groupId) {
      await Group.findByIdAndUpdate(groupId, { $addToSet: { screens: screen._id } });
    }

    return res.status(201).json({ id: screen._id });
  } catch (err) {
    return next(err);
  }
});

router.patch(
  "/screens/:id",
  authRequired,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const update = { ...req.body };
      if (update.groupId !== undefined) {
        update.group = update.groupId || null;
        delete update.groupId;
      }
      const screen = await Screen.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!screen) {
        return res.status(404).json({ error: "Screen not found." });
      }

      if (update.group !== undefined) {
        if (update.group) {
          await Group.findByIdAndUpdate(update.group, {
            $addToSet: { screens: screen._id },
          });
          await Group.updateMany(
            { _id: { $ne: update.group } },
            { $pull: { screens: screen._id } },
          );
        } else {
          await Group.updateMany({}, { $pull: { screens: screen._id } });
        }
      }

      return res.json({ id: screen._id });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
