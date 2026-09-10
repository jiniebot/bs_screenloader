#!/usr/bin/env node
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath, pathToFileURL } from "url";

const fsp = fs.promises;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_ITEMS = [
  "current-sync.json",
  "pool",
  "autoplugins.brs",
  "autorun.brs",
  "feedPool",
  "feed_cache",
  "brightsign-dumps",
];

function usage() {
  return [
    "Usage:",
    "  node scripts/create-brightsign-project.js <video-file> <player-name> [--out <output-dir>] [--template <template-dir>] [--base <base-url>]",
    "",
    "Example:",
    '  node scripts/create-brightsign-project.js /path/to/video.mp4 "Store 12" --out ./store12',
  ].join("\n");
}

async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

function poolPathForHash(hash) {
  const last = hash.slice(-2);
  return path.join("pool", last[0], last[1], `sha1-${hash}`);
}

function poolDirForHash(hash) {
  return path.dirname(poolPathForHash(hash));
}

async function sha1File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha1");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function sha1Buffer(buffer) {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

function findString(value, predicate) {
  if (typeof value === "string") {
    return predicate(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, predicate);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const found = findString(value[key], predicate);
      if (found) return found;
    }
  }
  return null;
}

function replaceStrings(value, replacements) {
  if (typeof value === "string") {
    let updated = value;
    for (const [from, to] of replacements) {
      if (from) {
        updated = updated.split(from).join(to);
      }
    }
    return updated;
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceStrings(item, replacements));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = replaceStrings(val, replacements);
    }
    return out;
  }
  return value;
}

function updateDownloadEntry(entry, { name, hash, size, baseUrl }) {
  const last = hash.slice(-2);
  entry.name = name;
  entry.hash = { method: "SHA1", hex: hash };
  entry.size = size;
  entry.link = `${baseUrl}/pool/${last[0]}/${last[1]}/sha1-${hash}`;
  return entry;
}

export function parseArgs(argv) {
  if (argv.length < 4) return null;
  const args = argv.slice(2);
  const outIndex = args.indexOf("--out");
  const templateIndex = args.indexOf("--template");
  const baseIndex = args.indexOf("--base");
  let outDir = null;
  let templateDir = null;
  let baseUrl = null;
  if (outIndex !== -1) {
    outDir = args[outIndex + 1];
    args.splice(outIndex, 2);
  }
  if (templateIndex !== -1) {
    templateDir = args[templateIndex + 1];
    args.splice(templateIndex, 2);
  }
  if (baseIndex !== -1) {
    baseUrl = args[baseIndex + 1];
    args.splice(baseIndex, 2);
  }
  if (args.length < 2) return null;
  return { videoPath: args[0], playerName: args[1], outDir, templateDir, baseUrl };
}

async function resolveTemplateRoot(playerName, templateDir) {
  if (templateDir) {
    return path.resolve(templateDir);
  }

  const lower = playerName.toLowerCase();
  const candidates = [];
  if (lower.includes("mens")) {
    candidates.push("source mens proj");
  }
  if (lower.includes("womens")) {
    candidates.push("source womens proj");
  }
  for (const candidate of candidates) {
    const candidatePath = path.resolve(__dirname, "..", candidate);
    if (await exists(candidatePath)) {
      return candidatePath;
    }
  }

  return path.resolve(__dirname, "..");
}

export async function createBrightsignProject({
  videoPath: inputVideoPath,
  playerName,
  outDir,
  templateDir,
  baseUrl,
}) {
  const videoPath = path.resolve(inputVideoPath);
  const normalizedPlayerName = playerName.trim();
  if (!normalizedPlayerName) {
    throw new Error("Player name is required.");
  }
  if (!(await exists(videoPath))) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const videoStat = await fsp.stat(videoPath);
  if (!videoStat.isFile()) {
    throw new Error(`Video path is not a file: ${videoPath}`);
  }

  const templateRoot = await resolveTemplateRoot(normalizedPlayerName, templateDir);
  const outputDir = outDir
    ? path.resolve(outDir)
    : path.resolve(process.cwd(), normalizedPlayerName);

  if (await exists(outputDir)) {
    throw new Error(`Output directory already exists: ${outputDir}`);
  }

  await fsp.mkdir(outputDir, { recursive: true });
  for (const item of TEMPLATE_ITEMS) {
    const src = path.join(templateRoot, item);
    if (!(await exists(src))) continue;
    const dest = path.join(outputDir, item);
    const stat = await fsp.stat(src);
    if (stat.isDirectory()) {
      await copyDir(src, dest);
    } else if (stat.isFile()) {
      await fsp.copyFile(src, dest);
    }
  }

  const currentSyncPath = path.join(outputDir, "current-sync.json");
  const currentSync = JSON.parse(await fsp.readFile(currentSyncPath, "utf8"));
  const downloads = currentSync.files && currentSync.files.download;
  if (!Array.isArray(downloads)) {
    throw new Error("current-sync.json is missing files.download");
  }

  const autoplayEntry = downloads.find(
    (entry) =>
      typeof entry.name === "string" &&
      entry.name.startsWith("autoplay-") &&
      entry.name.endsWith(".json"),
  );
  const bmlEntry = downloads.find(
    (entry) =>
      typeof entry.name === "string" && entry.name.toLowerCase().endsWith(".bml"),
  );
  const autoscheduleEntry = downloads.find((entry) => entry.name === "autoschedule.json");
  const videoEntry =
    downloads.find((entry) => entry.probe) ||
    downloads.find(
      (entry) =>
        typeof entry.name === "string" &&
        /\.(mp4|m4v|mov|mkv|avi|wmv)$/i.test(entry.name),
    );

  if (!autoplayEntry || !bmlEntry || !autoscheduleEntry || !videoEntry) {
    throw new Error("Template is missing autoplay, BML, autoschedule, or video entries.");
  }

  const oldProjectName = autoplayEntry.name
    .replace(/^autoplay-/, "")
    .replace(/\.json$/, "");
  const newProjectName = normalizedPlayerName;

  const oldVideoName = videoEntry.name;
  const newVideoName = path.basename(videoPath);

  const oldAutoplayHash = autoplayEntry.hash.hex;
  const oldBmlHash = bmlEntry.hash.hex;
  const oldAutoscheduleHash = autoscheduleEntry.hash.hex;
  const oldVideoHash = videoEntry.hash.hex;

  const autoplayPath = path.join(outputDir, poolPathForHash(oldAutoplayHash));
  const bmlPath = path.join(outputDir, poolPathForHash(oldBmlHash));
  const autoschedulePath = path.join(outputDir, poolPathForHash(oldAutoscheduleHash));

  const autoplayJson = JSON.parse(await fsp.readFile(autoplayPath, "utf8"));
  const bmlJson = JSON.parse(await fsp.readFile(bmlPath, "utf8"));
  const autoscheduleJson = JSON.parse(await fsp.readFile(autoschedulePath, "utf8"));

  const oldVideoPath =
    findString(
      autoplayJson,
      (val) =>
        val.endsWith(oldVideoName) && !val.startsWith("file://") && val.includes("/"),
    ) ||
    findString(
      bmlJson,
      (val) =>
        val.endsWith(oldVideoName) && !val.startsWith("file://") && val.includes("/"),
    ) ||
    "";

  const oldVideoFileUrl =
    findString(
      autoplayJson,
      (val) => val.startsWith("file://") && val.endsWith(oldVideoName),
    ) ||
    findString(
      bmlJson,
      (val) => val.startsWith("file://") && val.endsWith(oldVideoName),
    ) ||
    "";

  const newVideoPath = videoPath;
  const newVideoFileUrl = pathToFileURL(videoPath).toString();

  const replacements = [
    [oldProjectName, newProjectName],
    [oldVideoName, newVideoName],
    [oldVideoPath, newVideoPath],
    [oldVideoFileUrl, newVideoFileUrl],
  ];

  const updatedAutoplay = replaceStrings(autoplayJson, replacements);
  const updatedBml = replaceStrings(bmlJson, replacements);
  const updatedAutoschedule = replaceStrings(autoscheduleJson, replacements);

  const autoplayContent = Buffer.from(
    JSON.stringify(updatedAutoplay, null, 2) + "\n",
    "utf8",
  );
  const bmlContent = Buffer.from(JSON.stringify(updatedBml, null, 2) + "\n", "utf8");
  const autoscheduleContent = Buffer.from(
    JSON.stringify(updatedAutoschedule, null, 2) + "\n",
    "utf8",
  );

  const autoplayHash = sha1Buffer(autoplayContent);
  const bmlHash = sha1Buffer(bmlContent);
  const autoscheduleHash = sha1Buffer(autoscheduleContent);
  const videoHash = await sha1File(videoPath);

  const templateBaseUrl =
    currentSync.meta && currentSync.meta.client && currentSync.meta.client.base
      ? currentSync.meta.client.base
      : "";
  const baseUrlUpdated = baseUrl
    ? baseUrl
    : templateBaseUrl
      ? templateBaseUrl.replace(/\/[^/]+$/, `/${normalizedPlayerName}`)
      : "";

  updateDownloadEntry(autoplayEntry, {
    name: `autoplay-${newProjectName}.json`,
    hash: autoplayHash,
    size: autoplayContent.length,
    baseUrl: baseUrlUpdated,
  });

  updateDownloadEntry(bmlEntry, {
    name: `${newProjectName}.bml`,
    hash: bmlHash,
    size: bmlContent.length,
    baseUrl: baseUrlUpdated,
  });

  updateDownloadEntry(autoscheduleEntry, {
    name: "autoschedule.json",
    hash: autoscheduleHash,
    size: autoscheduleContent.length,
    baseUrl: baseUrlUpdated,
  });

  updateDownloadEntry(videoEntry, {
    name: newVideoName,
    hash: videoHash,
    size: videoStat.size,
    baseUrl: baseUrlUpdated,
  });

  if (currentSync.meta && currentSync.meta.client) {
    if (baseUrlUpdated) {
      currentSync.meta.client.base = baseUrlUpdated;
    }
    currentSync.meta.client.lastModifiedTime = new Date().toISOString().replace("Z", "");
  }

  await fsp.mkdir(path.join(outputDir, poolDirForHash(autoplayHash)), {
    recursive: true,
  });
  await fsp.mkdir(path.join(outputDir, poolDirForHash(bmlHash)), {
    recursive: true,
  });
  await fsp.mkdir(path.join(outputDir, poolDirForHash(autoscheduleHash)), {
    recursive: true,
  });
  await fsp.mkdir(path.join(outputDir, poolDirForHash(videoHash)), {
    recursive: true,
  });

  await fsp.writeFile(
    path.join(outputDir, poolPathForHash(autoplayHash)),
    autoplayContent,
  );
  await fsp.writeFile(path.join(outputDir, poolPathForHash(bmlHash)), bmlContent);
  await fsp.writeFile(
    path.join(outputDir, poolPathForHash(autoscheduleHash)),
    autoscheduleContent,
  );

  await new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(videoPath);
    const writeStream = fs.createWriteStream(
      path.join(outputDir, poolPathForHash(videoHash)),
    );
    readStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("close", resolve);
    readStream.pipe(writeStream);
  });

  const cleanup = [
    { path: autoplayPath, oldHash: oldAutoplayHash, newHash: autoplayHash },
    { path: bmlPath, oldHash: oldBmlHash, newHash: bmlHash },
    { path: autoschedulePath, oldHash: oldAutoscheduleHash, newHash: autoscheduleHash },
    {
      path: path.join(outputDir, poolPathForHash(oldVideoHash)),
      oldHash: oldVideoHash,
      newHash: videoHash,
    },
  ];
  for (const item of cleanup) {
    if (item.oldHash !== item.newHash && (await exists(item.path))) {
      await fsp.rm(item.path, { force: true });
    }
  }

  await fsp.writeFile(currentSyncPath, JSON.stringify(currentSync, null, 2) + "\n");

  return { outputDir, baseUrl: baseUrlUpdated };
}

async function main() {
  const parsed = parseArgs(process.argv);
  if (!parsed) {
    console.error(usage());
    process.exit(1);
  }

  try {
    const result = await createBrightsignProject({
      videoPath: parsed.videoPath,
      playerName: parsed.playerName,
      outDir: parsed.outDir,
      templateDir: parsed.templateDir,
      baseUrl: parsed.baseUrl,
    });
    console.log(`Created BrightSign project at ${result.outputDir}`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
