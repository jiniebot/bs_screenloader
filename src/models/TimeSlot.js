import mongoose from "mongoose";

const timeSlotSchema = new mongoose.Schema(
  {
    screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen", required: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    rrule: { type: String, required: true },
    exceptions: [{ type: Date }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "active" },
  },
  { timestamps: true },
);

export default mongoose.model("TimeSlot", timeSlotSchema);
