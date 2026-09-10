import mongoose from "mongoose";

const videoAssetSchema = new mongoose.Schema(
  {
    screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    originalName: { type: String, required: true },
    mimeType: { type: String, default: "" },
    durationSec: { type: Number },
    sourcePath: { type: String, required: true },
    thumbnailPath: { type: String },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("VideoAsset", videoAssetSchema);
