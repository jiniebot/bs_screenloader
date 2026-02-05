import mongoose from "mongoose";

const uploadJobSchema = new mongoose.Schema(
  {
    uploadLink: { type: mongoose.Schema.Types.ObjectId, ref: "UploadLink" },
    screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen" },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "VideoSchedule" },
    sourcePath: { type: String, required: true },
    processedPath: { type: String },
    outputDir: { type: String },
    ftpPath: { type: String },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    error: { type: String },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("UploadJob", uploadJobSchema);
