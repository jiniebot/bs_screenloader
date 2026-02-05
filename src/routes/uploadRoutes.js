import express from "express";
import multer from "multer";
import path from "path";
import config from "../config/index.js";
import UploadLink from "../models/UploadLink.js";
import UploadJob from "../models/UploadJob.js";

const router = express.Router();
const upload = multer({ dest: config.uploadsDir });

router.post("/upload/:token", upload.single("file"), async (req, res, next) => {
  try {
    const token = req.params.token;
    const link = await UploadLink.findOne({ token, status: "active" }).populate("screen");
    if (!link) {
      return res.status(404).json({ error: "Invalid or expired link." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Missing file upload." });
    }

    const job = await UploadJob.create({
      uploadLink: link._id,
      screen: link.screen,
      sourcePath: req.file.path,
      metadata: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      },
    });

    return res.status(201).json({ jobId: job._id });
  } catch (err) {
    return next(err);
  }
});

export default router;
