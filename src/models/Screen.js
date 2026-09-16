import mongoose from "mongoose";

const screenSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    owner: { type: String, required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    templateDir: { type: String, required: true },
    destinationFolder: { type: String, required: true },
    baseUrl: { type: String, required: true },
    prerequisite: {
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    transform: {
      offsetX: { type: Number, default: 0 },
      offsetY: { type: Number, default: 0 },
      scale: { type: Number, default: 1 },
      rotation: { type: Number, default: 0 },
      canvasWidth: { type: Number, default: 1920 },
      canvasHeight: { type: Number, default: 1080 },
    },
    durationMinSec: { type: Number },
    durationMaxSec: { type: Number },
    brightSignSerial: { type: String },
    notifyEmails: { type: [String], default: [] },
    playbackStatus: {
      type: String,
      enum: ["unknown", "online", "offline"],
      default: "unknown",
    },
    playbackStatusChangedAt: { type: Date },
    playbackCheckedAt: { type: Date },
    playbackConsecutiveFailures: { type: Number, default: 0 },
    pendingContentFilename: { type: String },
    pendingContentScheduleName: { type: String },
    pendingContentSetAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.model("Screen", screenSchema);
