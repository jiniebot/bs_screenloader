import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    details: { type: String, default: "" },
    screens: [{ type: mongoose.Schema.Types.ObjectId, ref: "Screen" }],
    notifyEmails: { type: [String], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("Group", groupSchema);
