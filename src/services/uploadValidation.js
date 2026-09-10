import path from "path";

export const ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".avi", ".mkv", ".webm"];

export const ALLOWED_VIDEO_MIMETYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
];

export function videoFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mimetypeOk = ALLOWED_VIDEO_MIMETYPES.includes(file.mimetype);
  const extensionOk = ALLOWED_VIDEO_EXTENSIONS.includes(ext);

  if (!mimetypeOk && !extensionOk) {
    const err = new Error(
      `Unsupported file type. Allowed formats: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}`,
    );
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}
