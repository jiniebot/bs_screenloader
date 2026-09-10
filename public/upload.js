const form = document.getElementById("publicUploadForm");
const statusEl = document.getElementById("publicStatus");
const screenLabel = document.getElementById("screenLabel");
const startLabel = document.getElementById("startLabel");
const endLabel = document.getElementById("endLabel");
const reqLabel = document.getElementById("reqLabel");
const uploadTitle = document.getElementById("uploadTitle");
const uploadSubtitle = document.getElementById("uploadSubtitle");
const durationLabel = document.getElementById("durationLabel");
const publicProgress = document.getElementById("publicProgress");
const submitBtn = form?.querySelector('button[type="submit"]');

const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const disableUpload = () => {
  if (submitBtn) submitBtn.disabled = true;
};

const loadDetails = async () => {
  if (!token) {
    statusEl.textContent = "Missing upload token.";
    disableUpload();
    return;
  }

  try {
    const response = await fetch(`/api/public/link/${token}`);
    const data = await response.json();
    if (!response.ok) {
      disableUpload();
      throw new Error(data.error || "Invalid link");
    }

    screenLabel.textContent = data.screen?.name || "Unknown";
    startLabel.textContent = formatDateTime(data.startDate);
    endLabel.textContent = formatDateTime(data.endDate);
    reqLabel.textContent = data.screen?.prerequisite
      ? `${data.screen.prerequisite.width}x${data.screen.prerequisite.height}`
      : "—";
    if (durationLabel) {
      const min = data.durationMinSec ?? data.screen?.durationMinSec;
      const max = data.durationMaxSec ?? data.screen?.durationMaxSec;
      durationLabel.textContent =
        min || max ? `${min || 0}s - ${max || "∞"}s` : "No limit";
    }
    uploadTitle.textContent = data.name || "Upload link";
    uploadSubtitle.textContent =
      data.description || "Upload the video file for this schedule.";
  } catch (err) {
    statusEl.textContent = err.message;
    disableUpload();
  }
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Uploading...";
  if (publicProgress) publicProgress.style.width = "0%";

  if (!token) {
    statusEl.textContent = "Missing upload token.";
    return;
  }

  const formData = new FormData(form);

  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/public/upload/${token}`);
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && publicProgress) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          publicProgress.style.width = `${pct}%`;
        }
      };
      xhr.onload = () => {
        try {
          const parsed = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error || "Upload failed"));
          }
        } catch {
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(formData);
    });

    statusEl.textContent = "Upload received. Thank you.";
    if (publicProgress) publicProgress.style.width = "100%";
    form.reset();
  } catch (err) {
    statusEl.textContent = err.message;
    if (publicProgress) publicProgress.style.width = "0%";
  }
});

loadDetails();
