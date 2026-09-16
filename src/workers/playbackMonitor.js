import config from "../config/index.js";
import { connectMongo } from "../db/mongo.js";
import Screen from "../models/Screen.js";
import {
  captureScreenSnapshot,
  fetchPlayerLogText,
  parsePlaybackLogEntries,
} from "../services/brightSignService.js";
import {
  notifyPlaybackStopped,
  notifyPlaybackResumed,
  notifyContentLive,
} from "../services/notificationService.js";

const PENDING_CONTENT_TIMEOUT_MS = 60 * 60 * 1000; // give up watching after 1h

async function checkPendingContent(screen) {
  if (!screen.pendingContentFilename) return;

  if (Date.now() - new Date(screen.pendingContentSetAt).getTime() > PENDING_CONTENT_TIMEOUT_MS) {
    console.warn(
      `[playbackMonitor] Gave up waiting for ${screen.pendingContentFilename} to appear in ${screen.name}'s playback log.`,
    );
    await Screen.findByIdAndUpdate(screen._id, {
      pendingContentFilename: null,
      pendingContentScheduleName: null,
      pendingContentSetAt: null,
    });
    return;
  }

  let logText;
  try {
    logText = await fetchPlayerLogText(screen.brightSignSerial);
  } catch (err) {
    console.warn(`[playbackMonitor] Failed to fetch logs for ${screen.name}:`, err.message);
    return;
  }

  const entries = parsePlaybackLogEntries(logText);
  const confirmed = entries.some((entry) => entry.filename === screen.pendingContentFilename);
  if (!confirmed) return;

  let snapshotDataUrl;
  try {
    snapshotDataUrl = (await captureScreenSnapshot(screen.brightSignSerial)).dataUrl;
  } catch {
    snapshotDataUrl = undefined;
  }

  await notifyContentLive(screen, {
    scheduleName: screen.pendingContentScheduleName,
    snapshotDataUrl,
  });

  await Screen.findByIdAndUpdate(screen._id, {
    pendingContentFilename: null,
    pendingContentScheduleName: null,
    pendingContentSetAt: null,
  });
}

async function checkScreen(screen) {
  await checkPendingContent(screen);

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
