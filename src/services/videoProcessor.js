import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readProcessOutput(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

export async function assertVideoResolution({
  inputPath,
  requiredWidth,
  requiredHeight,
}) {
  if (!requiredWidth || !requiredHeight) {
    return;
  }
  const args = [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=s=x:p=0",
    inputPath,
  ];
  const { stdout } = await readProcessOutput("ffprobe", args);
  const [widthRaw, heightRaw] = stdout.trim().split("x");
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (width !== requiredWidth || height !== requiredHeight) {
    const srcAspect = width / height;
    const reqAspect = requiredWidth / requiredHeight;
    if (Math.abs(srcAspect - reqAspect) > 0.01) {
      throw new Error(
        `Invalid resolution ${width}x${height}; expected ${requiredWidth}x${requiredHeight}`,
      );
    }
    console.warn(
      `[video] Source is ${width}x${height}; scaling to ${requiredWidth}x${requiredHeight}`,
    );
  }
}

export async function readVideoDurationSeconds(inputPath) {
  const args = [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nk=1:nw=1",
    inputPath,
  ];
  const { stdout } = await readProcessOutput("ffprobe", args);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Unable to determine source duration via ffprobe");
  }
  return duration;
}

export async function processScreenVideo({
  inputPath,
  outputPath,
  transform,
  requiredInputWidth,
  requiredInputHeight,
}) {
  await ensureDir(path.dirname(outputPath));

  const canvasWidth = transform?.canvasWidth ?? 1920;
  const canvasHeight = transform?.canvasHeight ?? 1080;
  const offsetX = transform?.offsetX ?? 0;
  const offsetY = transform?.offsetY ?? 0;
  const rotation = transform?.rotation ?? 0;
  const scale = transform?.scale ?? 1;

  const rotateFilter =
    rotation === -90
      ? "transpose=2"
      : rotation === 90
        ? "transpose=1"
        : rotation === 180 || rotation === -180
          ? "transpose=2,transpose=2"
          : "null";

  const scaleFilter = scale !== 1 ? `scale=iw*${scale}:ih*${scale}` : "null";

  const inputScaleFilter =
    requiredInputWidth && requiredInputHeight
      ? `scale=${requiredInputWidth}:${requiredInputHeight}`
      : "null";

  const filter = [
    `[0:v]${inputScaleFilter},${rotateFilter},${scaleFilter}[vid]`,
    `color=size=${canvasWidth}x${canvasHeight}:c=black[base]`,
    `[base][vid]overlay=${offsetX}:${offsetY}:format=auto[comp]`,
  ].join(";");

  const durationSeconds = await readVideoDurationSeconds(inputPath);

  const args = [
    "-y",
    "-i",
    inputPath,
    "-filter_complex",
    filter,
    "-map",
    "[comp]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-f",
    "mp4",
    "-movflags",
    "+faststart",
    "-t",
    durationSeconds.toFixed(3),
    `${outputPath}.tmp`,
  ];

  await fs.rm(outputPath, { force: true }).catch(() => {});
  await fs.rm(`${outputPath}.tmp`, { force: true }).catch(() => {});
  await runCommand("ffmpeg", args);
  await fs.rename(`${outputPath}.tmp`, outputPath);
}
