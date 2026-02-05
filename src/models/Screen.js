import mongoose from "mongoose";

const screenSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    companyName: { type: String, required: true },
    owner: { type: String, required: true },
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
  },
  { timestamps: true }
);

export default mongoose.model("Screen", screenSchema);
