import config from "../config/index.js";
import { connectMongo } from "../db/mongo.js";
import Screen from "../models/Screen.js";
import { captureScreenSnapshot } from "../services/brightSignService.js";
import { notifyPlaybackStopped, notifyPlaybackResumed } from "../services/notificationService.js";

async function checkScreen(screen) {
  let reachable = true;
  try {
    await captureScreenSnapshot(screen.brightSignSerial);
  } catch (err) {
    reachable = false;
    console.warn(`[playbackMonitor] Snapshot failed for ${screen.name}:`, err.message);
  }

  const now = new Date();

  if (reachable) {
    const wasOffline = screen.playbackStatus === "offline";
    await Screen.findByIdAndUpdate(screen._id, {
      playbackStatus: "online",
      playbackCheckedAt: now,
      playbackStatusChangedAt: screen.playbackStatus === "online" ? screen.playbackStatusChangedAt : now,
      playbackConsecutiveFailures: 0,
    });
    if (wasOffline) {
      await notifyPlaybackResumed(screen);
    }
    return;
  }

  const consecutiveFailures = (screen.playbackConsecutiveFailures || 0) + 1;
  const shouldMarkOffline =
    screen.playbackStatus !== "offline" && consecutiveFailures >= config.monitor.failureThreshold;

  await Screen.findByIdAndUpdate(screen._id, {
    playbackCheckedAt: now,
    playbackConsecutiveFailures: consecutiveFailures,
    ...(shouldMarkOffline
      ? { playbackStatus: "offline", playbackStatusChangedAt: now }
      : {}),
  });

  if (shouldMarkOffline) {
    await notifyPlaybackStopped(screen);
  }
}

async function workLoop() {
  const screens = await Screen.find({
    brightSignSerial: { $exists: true, $nin: [null, ""] },
  });
  for (const screen of screens) {
    try {
      await checkScreen(screen);
    } catch (err) {
      console.error(`[playbackMonitor] Error checking screen ${screen.name}:`, err);
    }
  }
}

async function start() {
  await connectMongo();
  console.log("[playbackMonitor] Started, polling every", config.monitor.pollMs, "ms");
  setInterval(() => {
    workLoop().catch((err) => console.error("[playbackMonitor]", err));
  }, config.monitor.pollMs);
}

start().catch((err) => {
  console.error("[playbackMonitor] Failed to start", err);
  process.exit(1);
});
