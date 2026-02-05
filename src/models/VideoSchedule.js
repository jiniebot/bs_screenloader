import mongoose from "mongoose";

const videoScheduleSchema = new mongoose.Schema(
  {
    screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen", required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    sourcePath: { type: String, required: true },
    status: {
      type: String,
      enum: ["scheduled", "queued", "processing", "completed", "failed"],
      default: "scheduled",
    },
    error: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("VideoSchedule", videoScheduleSchema);
