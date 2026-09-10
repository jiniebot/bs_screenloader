import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { connectMongo } from "../db/mongo.js";
import UploadJob from "../models/UploadJob.js";
import Screen from "../models/Screen.js";
import UploadLink from "../models/UploadLink.js";

const outputPath = path.resolve(process.cwd(), "upload-history.csv");
const outputDir = path.resolve(process.cwd(), "upload-history-by-month");
const icsPath = path.resolve(process.cwd(), "upload-history.ics");

function reportMonthKey(createdAt) {
  const year = createdAt.getFullYear();
  const month = createdAt.getMonth();
  const day = createdAt.getDate();
  const dayOfWeek = createdAt.getDay();

  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const isLastDayOfMonth = day === lastDayOfMonth;
  const isTuesday = dayOfWeek === 2;

  if (isTuesday && isLastDayOfMonth) {
    const nextMonthFirstDay = new Date(year, month + 1, 1);
    if (nextMonthFirstDay.getDay() === 3) {
      return `${nextMonthFirstDay.getFullYear()}-${String(
        nextMonthFirstDay.getMonth() + 1,
      ).padStart(2, "0")}`;
    }
  }

  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function sourceLabel(job) {
  const trigger = job.metadata?.trigger;
  if (trigger === "cli") return "npm test (pipeline:test)";
  if (trigger === "cli-prod") return "cli (pipeline.js)";
  if (job.uploadLink || job.metadata?.originalName || job.metadata?.mimeType) {
    return "web upload";
  }
  return "unknown";
}

function amountForScreen(screenName) {
  const name = (screenName ?? "").toLowerCase();
  if (name.includes("women")) return 825;
  if (name.includes("men")) return 500;
  return "";
}

function icsEscape(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function buildIcs(jobs) {
  const now = toIcsDateTime(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//jiniescreen//upload-history//EN",
    "CALSCALE:GREGORIAN",
  ];

  for (const job of jobs) {
    const createdAt = job.createdAt;
    if (!createdAt) continue;

    const start = toIcsDateTime(createdAt);
    const end = toIcsDateTime(new Date(createdAt.getTime() + 15 * 60 * 1000));
    const fullScreenName = job.screen?.name ?? "unknown screen";
    const screenName = fullScreenName.toLowerCase().includes("women")
      ? "Wom"
      : fullScreenName.toLowerCase().includes("men")
        ? "Men"
        : fullScreenName;
    const fileName = path.basename(job.sourcePath ?? "");
    const summary = `${screenName} - ${fileName}`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${job._id}@jiniescreen`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(summary)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function csvEscape(value) {
  const str = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  await connectMongo();

  const jobs = await UploadJob.find({})
    .sort({ createdAt: 1 })
    .populate("screen", "name")
    .populate("uploadLink", "token")
    .lean();

  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  const STATUS_RANK = { completed: 3, failed: 2, processing: 1, pending: 0 };

  const dedupeMap = new Map();
  for (const job of jobs) {
    const createdAt = job.createdAt ?? null;
    const date = createdAt ? createdAt.toISOString().slice(0, 10) : "";
    const key = `${date}::${sourceLabel(job)}::${job.sourcePath ?? ""}`;

    const existing = dedupeMap.get(key);
    if (!existing) {
      dedupeMap.set(key, job);
      continue;
    }

    const existingRank = STATUS_RANK[existing.status] ?? -1;
    const jobRank = STATUS_RANK[job.status] ?? -1;
    if (
      jobRank > existingRank ||
      (jobRank === existingRank && job.createdAt > existing.createdAt)
    ) {
      dedupeMap.set(key, job);
    }
  }

  const dedupedJobs = [...dedupeMap.values()].sort(
    (a, b) => a.createdAt - b.createdAt,
  );

  const header = [
    "date",
    "dayOfWeek",
    "time",
    "reportMonth",
    "uploadSource",
    "videoSource",
    "screen",
    "amount",
    "error",
  ];

  const rows = [header];
  const monthGroups = new Map();

  for (const job of dedupedJobs) {
    const createdAt = job.createdAt ?? null;
    const reportMonth = createdAt ? reportMonthKey(createdAt) : "";
    const row = [
      createdAt ? createdAt.toISOString().slice(0, 10) : "",
      createdAt ? DAY_NAMES[createdAt.getDay()] : "",
      createdAt ? createdAt.toTimeString().slice(0, 8) : "",
      reportMonth,
      sourceLabel(job),
      job.sourcePath ?? "",
      job.screen?.name ?? "",
      amountForScreen(job.screen?.name),
      job.error ?? "",
    ];
    rows.push(row);

    if (!monthGroups.has(reportMonth)) monthGroups.set(reportMonth, []);
    monthGroups.get(reportMonth).push(row);
  }

  const toCsv = (rowList) =>
    rowList.map((row) => row.map(csvEscape).join(",")).join("\n");

  fs.writeFileSync(outputPath, toCsv(rows));

  fs.mkdirSync(outputDir, { recursive: true });
  for (const [month, monthRows] of monthGroups) {
    const fileName = month ? `upload-history-${month}.csv` : "upload-history-unknown.csv";
    fs.writeFileSync(
      path.join(outputDir, fileName),
      toCsv([header, ...monthRows]),
    );
  }

  fs.writeFileSync(icsPath, buildIcs(dedupedJobs));

  console.log(
    `Found ${jobs.length} upload job(s) (all history), ${dedupedJobs.length} after de-duping same-source same-day entries`,
  );
  console.log(`Wrote combined CSV to ${outputPath}`);
  console.log(`Wrote ${monthGroups.size} monthly CSV(s) to ${outputDir}/`);
  console.log(`Wrote calendar to ${icsPath}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
