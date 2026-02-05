import mongoose from "mongoose";

const timeSlotSchema = new mongoose.Schema(
  {
    screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen" },
    label: { type: String, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, default: "open" },
  },
  { timestamps: true }
);

export default mongoose.model("TimeSlot", timeSlotSchema);
