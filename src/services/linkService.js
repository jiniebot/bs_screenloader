import crypto from "crypto";
import UploadLink from "../models/UploadLink.js";

export function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function createUploadLink({
  screenId,
  timeSlotId,
  issuedById,
  expiresAt,
  name,
  description,
  startDate,
  endDate,
  durationMinSec,
  durationMaxSec,
  occurrenceStart,
  occurrenceEnd,
}) {
  const token = generateToken();
  const link = await UploadLink.create({
    token,
    screen: screenId,
    timeSlot: timeSlotId,
    issuedBy: issuedById,
    expiresAt,
    name,
    description,
    startDate,
    endDate,
    durationMinSec,
    durationMaxSec,
    occurrenceStart,
    occurrenceEnd,
  });

  return link;
}
