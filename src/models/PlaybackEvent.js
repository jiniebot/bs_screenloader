import mongoose from "mongoose";

const playbackEventSchema = new mongoose.Schema(
  {
    videoAsset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VideoAsset",
      required: true,
    },
    timeSlot: { type: mongoose.Schema.Types.ObjectId, ref: "TimeSlot" },
    schedule: { type: mongoose.Schema.Types.ObjectId, ref: "VideoSchedule" },
    occurrenceStart: { type: Date },
    occurrenceEnd: { type: Date },
    playedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("PlaybackEvent", playbackEventSchema);
