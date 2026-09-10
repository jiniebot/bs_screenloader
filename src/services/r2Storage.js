import fs from "fs";
import { pipeline } from "stream/promises";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import config from "../config/index.js";

let client = null;

function getClient() {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: config.r2.endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return client;
}

export function isR2Configured() {
  return Boolean(
    config.r2.endpoint && config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucket,
  );
}

export async function archiveRawSource({ localPath, key, contentType }) {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured (missing R2_* env vars)");
  }
  const body = fs.createReadStream(localPath);
  const stat = await fs.promises.stat(localPath);
  await getClient().send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: body,
      ContentLength: stat.size,
      ContentType: contentType || "video/mp4",
    }),
  );
  return key;
}

export async function objectExists(key) {
  if (!isR2Configured()) return false;
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: config.r2.bucket, Key: key }));
    return true;
  } catch (err) {
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

export async function downloadObject({ key, localPath }) {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured (missing R2_* env vars)");
  }
  const result = await getClient().send(
    new GetObjectCommand({ Bucket: config.r2.bucket, Key: key }),
  );
  await pipeline(result.Body, fs.createWriteStream(localPath));
  return localPath;
}
