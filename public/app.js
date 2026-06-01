const form = document.querySelector("#download-form");
const input = document.querySelector("#spotify-url");
const message = document.querySelector("#message");
const jobsEl = document.querySelector("#jobs");
const filesEl = document.querySelector("#files");
const jobCount = document.querySelector("#job-count");
const fileCount = document.querySelector("#file-count");

let pollTimer = null;

function setMessage(text, tone = "") {
  message.textContent = text;
  message.dataset.tone = tone;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderJobs(jobs) {
  jobCount.textContent = String(jobs.length);

  if (!jobs.length) {
    jobsEl.className = "stack empty";
    jobsEl.textContent = "No downloads queued.";
    return;
  }

  jobsEl.className = "stack";
  jobsEl.innerHTML = jobs
    .map((job) => {
      const output = job.output.length
        ? `<pre>${escapeHtml(job.output.slice(-8).join("\n"))}</pre>`
        : "<p class=\"muted\">Waiting for spotDL output.</p>";

      return `
        <article class="job">
          <div class="job-top">
            <span class="status ${job.status}">${job.status}</span>
            <time>${new Date(job.createdAt).toLocaleString()}</time>
          </div>
          <a href="${escapeAttr(job.url)}" target="_blank" rel="noreferrer">${escapeHtml(job.url)}</a>
          ${output}
        </article>
      `;
    })
    .join("");
}

function renderFiles(files) {
  fileCount.textContent = String(files.length);

  if (!files.length) {
    filesEl.className = "stack empty";
    filesEl.textContent = "No files downloaded yet.";
    return;
  }

  filesEl.className = "stack";
  filesEl.innerHTML = files
    .map(
      (file) => `
        <a class="file" href="${file.url}" download>
          <span>${escapeHtml(file.name)}</span>
          <small>${formatSize(file.size)}</small>
        </a>
      `
    )
    .join("");
}

async function refresh() {
  const response = await fetch("/api/jobs");
  const data = await response.json();
  renderJobs(data.jobs);
  renderFiles(data.files);
}

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(refresh, 2000);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char];
  });
}

function escapeAttr(value) {
  return escapeHtml(value);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = input.value.trim();

  if (!url) return;

  setMessage("Starting download...");
  form.querySelector("button").disabled = true;

  try {
    const response = await fetch("/api/downloads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Download request failed.");
    }

    input.value = "";
    setMessage("Download queued.", "success");
    await refresh();
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    form.querySelector("button").disabled = false;
    input.focus();
  }
});

refresh().catch((error) => setMessage(error.message, "error"));
startPolling();
