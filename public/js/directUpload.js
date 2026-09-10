import { combineDateTime, addDaysToDateString, DEFAULT_DURATION_DAYS } from "./utils.js";
import { loadSchedules } from "./schedules.js";
import { loadHistory } from "./history.js";
import { loadCalendar } from "./calendar.js";

const directUploadForm = document.getElementById("directUploadForm");
const directStatus = document.getElementById("directStatus");
const directProgress = document.getElementById("directProgress");

directUploadForm?.startDate?.addEventListener("change", () => {
  if (!directUploadForm.startDate.value || directUploadForm.endDate.value) return;
  directUploadForm.endDate.value = addDaysToDateString(
    directUploadForm.startDate.value,
    DEFAULT_DURATION_DAYS,
  );
  directUploadForm.endTime.value = directUploadForm.startTime.value || "00:00";
});

directUploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  directStatus.textContent = "Uploading...";
  if (directProgress) directProgress.style.width = "0%";
  try {
    const startDate = combineDateTime(
      directUploadForm.startDate.value,
      directUploadForm.startTime.value,
    );
    const endDate = directUploadForm.endDate.value
      ? combineDateTime(directUploadForm.endDate.value, directUploadForm.endTime.value)
      : undefined;
    const formData = new FormData(directUploadForm);
    formData.set("startDate", startDate);
    if (endDate) {
      formData.set("endDate", endDate);
    } else {
      formData.delete("endDate");
    }

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads/direct");
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && directProgress) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          directProgress.style.width = `${pct}%`;
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
    directStatus.textContent = "Upload received.";
    if (directProgress) directProgress.style.width = "100%";
    directUploadForm.reset();
    await loadSchedules();
    await loadHistory();
    await loadCalendar();
  } catch (err) {
    directStatus.textContent = err.message;
    if (directProgress) directProgress.style.width = "0%";
  }
});
