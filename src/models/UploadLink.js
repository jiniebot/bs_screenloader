import mongoose from "mongoose";

const uploadLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    screen: { type: mongoose.Schema.Types.ObjectId, ref: "Screen" },
    timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot" },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: { type: String, default: "active" },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("UploadLink", uploadLinkSchema);
