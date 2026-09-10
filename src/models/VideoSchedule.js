import mongoose from "mongoose";

const videoScheduleSchema = new mongoose.Schema(
  {
    screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen", required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    sourcePath: { type: String, required: true },
    videoAsset: { type: mongoose.Schema.Types.ObjectId, ref: "VideoAsset" },
    timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot" },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "SlotAssignment" },
    status: {
      type: String,
      enum: ["scheduled", "queued", "processing", "completed", "failed", "canceled"],
      default: "scheduled",
    },
    error: { type: String },
    completedAt: { type: Date },
    canceledAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.model("VideoSchedule", videoScheduleSchema);
