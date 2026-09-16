import nodemailer from "nodemailer";
import config from "../config/index.js";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.smtpHost,
      port: config.mail.smtpPort,
      secure: false,
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, html, attachments }) {
  if (!to.length) return;
  if (!config.mail.fromAddress) {
    console.warn("[mailer] MAIL_FROM is not configured — skipping email:", subject);
    return;
  }

  await getTransporter().sendMail({
    from: config.mail.fromAddress,
    to,
    subject,
    html,
    attachments,
  });
}
