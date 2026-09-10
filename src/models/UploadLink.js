import mongoose from "mongoose";

const uploadLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen" },
    timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot" },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
    description: { type: String, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    durationMinSec: { type: Number },
    durationMaxSec: { type: Number },
    occurrenceStart: { type: Date },
    occurrenceEnd: { type: Date },
    status: { type: String, default: "active" },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

export default mongoose.model("UploadLink", uploadLinkSchema);
