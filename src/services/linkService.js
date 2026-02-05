import crypto from "crypto";
import UploadLink from "../models/UploadLink.js";

export function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function createUploadLink({ playerId, timeSlotId, issuedById, expiresAt }) {
  const token = generateToken();
  const link = await UploadLink.create({
    token,
    player: playerId,
    timeSlot: timeSlotId,
    issuedBy: issuedById,
    expiresAt,
  });

  return link;
}
