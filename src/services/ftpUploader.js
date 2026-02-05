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

export async function uploadToFtp({ localDir, remoteDir }) {
  const client = new Client();
  client.ftp.verbose = false;
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
      user: config.ftp.user,
      password: config.ftp.password,
      secure: config.ftp.secure,
    });

    const root = config.ftp.remoteRoot || "/";
    const targetDir = path.posix.join(root, remoteDir);
    try {
      await client.removeDir(targetDir);
    } catch (err) {
      // Ignore if it doesn't exist.
    }
    await uploadDir(client, localDir, targetDir);
    process.stdout.write("\rFTP upload complete.                    \n");

    return targetDir;
  } finally {
    client.close();
  }
}
