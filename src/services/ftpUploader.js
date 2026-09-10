import path from "path";
import fs from "fs/promises";
import { Client } from "basic-ftp";
import config from "../config/index.js";

async function uploadDir(client, localDir, remoteDir) {
  await client.ensureDir(remoteDir);
  const entries = await fs.readdir(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = path.join(localDir, entry.name);
    const remotePath = path.posix.join(remoteDir, entry.name);
    if (entry.isDirectory()) {
      await uploadDir(client, localPath, remotePath);
    } else if (entry.isFile()) {
      await client.uploadFrom(localPath, remotePath);
    }
  }
}

export async function uploadToFtp({
  localDir,
  remoteDir,
  remoteRoot,
  ftpUser,
  ftpPassword,
  warnIfExists = false,
}) {
  const client = new Client();
  client.ftp.verbose = false;
  client.ftp.timeout = config.ftp.timeoutMs;
  client.ftp.keepAlive = config.ftp.keepAliveMs;
  client.trackProgress((info) => {
    const name = info.name || "upload";
    const transferred = Math.round(info.bytes / (1024 * 1024));
    const total = info.bytesOverall
      ? Math.round(info.bytesOverall / (1024 * 1024))
      : null;
    const line = total
      ? `FTP ${name}: ${transferred}MB / ${total}MB`
      : `FTP ${name}: ${transferred}MB`;
    process.stdout.write(`\r${line}`);
  });

  try {
    await client.access({
      host: config.ftp.host,
      user: ftpUser !== undefined ? ftpUser : config.ftp.user,
      password: ftpPassword !== undefined ? ftpPassword : config.ftp.password,
      secure: config.ftp.secure,
    });

    const root = remoteRoot !== undefined ? remoteRoot : config.ftp.remoteRoot || "/";
    const targetDir = path.posix.join(root, remoteDir);

    let folderReplaced = false;
    try {
      await client.removeDir(targetDir);
      folderReplaced = true;
    } catch {
      // Ignore if it doesn't exist.
    }
    if (folderReplaced && warnIfExists) {
      console.warn(`\n[WARNING] Existing remote folder was replaced: ${targetDir}`);
    }

    await uploadDir(client, localDir, targetDir);
    process.stdout.write("\rFTP upload complete.                    \n");

    return targetDir;
  } finally {
    client.close();
  }
}
