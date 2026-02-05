const form = document.getElementById("uploadForm");
const statusEl = document.getElementById("status");
const fileInput = document.getElementById("file");
const fileName = document.getElementById("fileName");
const modal = document.getElementById("uploadModal");
const screenField = document.getElementById("screen");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const scheduleRows = document.getElementById("scheduleRows");

const openModal = (screenName) => {
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  screenField.value = screenName;
  modalTitle.textContent = `Upload to ${screenName.replace(/_/g, " ")}`;
  modalSubtitle.textContent = "Select a file and schedule dates.";
  statusEl.textContent = "";
};

const closeModal = () => {
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  form.reset();
  fileName.textContent = "No file selected";
  statusEl.textContent = "";
};

document.querySelectorAll(".upload-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const screenName = button.dataset.screen;
    openModal(screenName);
  });
});

document.querySelectorAll("[data-close=\"true\"]").forEach((button) => {
  button.addEventListener("click", closeModal);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileName.textContent = file ? file.name : "No file selected";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Uploading...";

  const formData = new FormData(form);

  try {
    const response = await fetch("/api/public/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Upload failed");
    }

    statusEl.textContent = `Upload received. Job ID: ${data.jobId}`;
    await loadSchedules();
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
});

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const renderSchedules = (schedules) => {
  if (!scheduleRows) return;
  scheduleRows.innerHTML = "";
  if (!schedules.length) {
    scheduleRows.innerHTML = `<div class="table-row"><span>No schedules yet.</span></div>`;
    return;
  }

  schedules.forEach((schedule) => {
    const row = document.createElement("div");
    row.className = "table-row";
    row.innerHTML = `
      <span>${schedule.screen}</span>
      <span>${schedule.name}</span>
      <span>${formatDate(schedule.startDate)}</span>
      <span>${formatDate(schedule.endDate)}</span>
      <span>${schedule.status}</span>
    `;
    scheduleRows.appendChild(row);
  });
};

const loadSchedules = async () => {
  try {
    const response = await fetch("/api/public/schedules");
    const data = await response.json();
    renderSchedules(data.schedules || []);
  } catch (err) {
    renderSchedules([]);
  }
};

loadSchedules();
