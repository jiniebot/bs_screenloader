import express from "express";
import Group from "../models/Group.js";
import Screen from "../models/Screen.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/groups", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const groups = await Group.find().populate("screens").sort({ createdAt: -1 });
    return res.json({
      groups: groups.map((g) => ({
        id: g._id,
        name: g.name,
        description: g.description || "",
        details: g.details || "",
        screens: g.screens || [],
      })),
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/groups", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const { name, description, details, screenIds } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Name is required." });
    }
    const group = await Group.create({
      name,
      description: description || "",
      details: details || "",
      screens: Array.isArray(screenIds) ? screenIds : [],
    });
    return res.status(201).json({ id: group._id });
  } catch (err) {
    return next(err);
  }
});

router.patch(
  "/groups/:id",
  authRequired,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { name, description, details, screenIds } = req.body;
      const update = {};
      if (name !== undefined) update.name = name;
      if (description !== undefined) update.description = description;
      if (details !== undefined) update.details = details;
      if (screenIds !== undefined)
        update.screens = Array.isArray(screenIds) ? screenIds : [];

      const group = await Group.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!group) {
        return res.status(404).json({ error: "Group not found." });
      }

      if (screenIds) {
        await Screen.updateMany({ group: group._id }, { $set: { group: null } });
        await Screen.updateMany(
          { _id: { $in: screenIds } },
          { $set: { group: group._id } },
        );
      }

      return res.json({ id: group._id });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
