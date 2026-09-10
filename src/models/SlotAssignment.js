import mongoose from "mongoose";

const slotAssignmentSchema = new mongoose.Schema(
  {
    timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot", required: true },
    videoAsset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VideoAsset",
      required: true,
    },
    occurrenceStart: { type: Date, required: true },
    occurrenceEnd: { type: Date, required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "assigned" },
  },
  { timestamps: true },
);

export default mongoose.model("SlotAssignment", slotAssignmentSchema);
