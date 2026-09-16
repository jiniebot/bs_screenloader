import User from "../models/User.js";
import Group from "../models/Group.js";
import { sendMail } from "./mailer.js";

async function getRecipients(screen) {
  const admins = await User.find({ role: "admin" }, "email");
  const emails = new Set(admins.map((u) => u.email.toLowerCase()));

  (screen.notifyEmails || []).forEach((e) => emails.add(e.toLowerCase()));

  if (screen.group) {
    const group = await Group.findById(screen.group);
    (group?.notifyEmails || []).forEach((e) => emails.add(e.toLowerCase()));
  }

  return Array.from(emails);
}

function dataUrlToAttachment(dataUrl, filename) {
  if (!dataUrl) return [];
  const [, base64] = dataUrl.split(",");
  return [
    {
      filename,
      content: Buffer.from(base64, "base64"),
      cid: "screenshot",
    },
  ];
}

export async function notifyContentLive(screen, { scheduleName, snapshotDataUrl } = {}) {
  const to = await getRecipients(screen);
  const attachments = dataUrlToAttachment(snapshotDataUrl, "now-playing.jpg");

  await sendMail({
    to,
    subject: `Now playing on ${screen.name}: ${scheduleName || "new content"}`,
    html: `
      <p><strong>${scheduleName || "New content"}</strong> is now live on <strong>${screen.name}</strong>.</p>
      ${attachments.length ? `<img src="cid:screenshot" style="max-width:480px;border-radius:8px" />` : ""}
    `,
    attachments,
  });
}

export async function notifyPlaybackStopped(screen) {
  const to = await getRecipients(screen);
  await sendMail({
    to,
    subject: `⚠️ ${screen.name} stopped responding`,
    html: `<p><strong>${screen.name}</strong> did not respond to a snapshot request and is being marked offline. It may have lost power, network, or crashed.</p>`,
  });
}

export async function notifyPlaybackResumed(screen) {
  const to = await getRecipients(screen);
  await sendMail({
    to,
    subject: `${screen.name} is back online`,
    html: `<p><strong>${screen.name}</strong> is responding to snapshot requests again.</p>`,
  });
}
