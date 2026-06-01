const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 3000);
const rootDir = __dirname;
const downloadsDir = path.join(rootDir, "downloads");
const configDir = path.join(rootDir, ".config");
const cacheDir = path.join(rootDir, ".cache");
const localCookiesFile = path.join(rootDir, "cookies.txt");
const renderCookiesFile = "/etc/secrets/cookies.txt";
const ffmpegBin = path.join(configDir, "spotdl", "ffmpeg");
const localSpotdl = path.join(rootDir, ".venv", "bin", "spotdl");
const userSpotdl = path.join(rootDir, ".local", "bin", "spotdl");
const spotdlBin = fs.existsSync(localSpotdl)
  ? localSpotdl
  : fs.existsSync(userSpotdl)
    ? userSpotdl
    : "spotdl";

fs.mkdirSync(downloadsDir, { recursive: true });
fs.mkdirSync(configDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

const jobs = new Map();
const cookies = resolveCookieFile();

app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(rootDir, "public")));
app.use("/downloads", express.static(downloadsDir));

function serializeJob(job) {
  return {
    id: job.id,
    url: job.url,
    status: job.status,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    output: job.output.slice(-80),
    files: listDownloadedFiles()
  };
}

function listDownloadedFiles() {
  return fs
    .readdirSync(downloadsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.join(downloadsDir, entry.name);
      const stat = fs.statSync(filePath);
      return {
        name: entry.name,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        url: `/downloads/${encodeURIComponent(entry.name)}`
      };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

function appendOutput(job, chunk) {
  const lines = chunk
    .toString()
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  job.output.push(...lines);
  if (lines.some((line) => /AudioProviderError|YTMusicServerError|download error|Internal error|HTTP 5\d\d|JSONDecodeError|No results found|failed/i.test(line))) {
    job.hasErrorOutput = true;
  }
  if (
    !cookies.path &&
    lines.some((line) => /YT-DLP download error|youtube\.com\/watch/i.test(line))
  ) {
    job.needsCookies = true;
  }

  if (job.output.length > 160) {
    job.output.splice(0, job.output.length - 160);
  }
}

function isSpotifyUrl(value) {
  try {
    const parsed = new URL(value);
    return ["open.spotify.com", "spotify.link"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function writeRuntimeCookieFile(rawCookies) {
  const filePath = path.join(cacheDir, "youtube-cookies.txt");
  fs.writeFileSync(filePath, rawCookies.replace(/\r\n/g, "\n"), { mode: 0o600 });
  return filePath;
}

function resolveCookieFile() {
  if (process.env.YOUTUBE_COOKIES_FILE) {
    return getExistingCookieFile(process.env.YOUTUBE_COOKIES_FILE, "YOUTUBE_COOKIES_FILE");
  }

  if (process.env.YOUTUBE_COOKIES_B64) {
    return {
      path: writeRuntimeCookieFile(Buffer.from(process.env.YOUTUBE_COOKIES_B64, "base64").toString("utf8")),
      source: "YOUTUBE_COOKIES_B64"
    };
  }

  if (process.env.YOUTUBE_COOKIES) {
    return {
      path: writeRuntimeCookieFile(process.env.YOUTUBE_COOKIES),
      source: "YOUTUBE_COOKIES"
    };
  }

  const renderCookies = getExistingCookieFile(renderCookiesFile, "Render Secret File");
  if (renderCookies.path) return renderCookies;

  const localCookies = getExistingCookieFile(localCookiesFile, "cookies.txt");
  if (localCookies.path) return localCookies;

  return {
    path: null,
    source: null
  };
}

function getExistingCookieFile(filePath, source) {
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
    return {
      path: filePath,
      source
    };
  }

  return {
    path: null,
    source: null
  };
}

function getSpotdlArgs(url) {
  const args = [
    "download",
    url,
    "--audio",
    "soundcloud",
    "youtube",
    "--output",
    "{artist} - {title}.{output-ext}",
    "--threads",
    "4",
    "--print-errors",
    "--ffmpeg",
    fs.existsSync(ffmpegBin) ? ffmpegBin : "ffmpeg"
  ];

  if (cookies.path) {
    args.push("--cookie-file", cookies.path);
  }

  return args;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    spotdl: spotdlBin,
    ffmpeg: fs.existsSync(ffmpegBin) ? ffmpegBin : "ffmpeg",
    cookiesConfigured: Boolean(cookies.path),
    cookiesSource: cookies.source,
    downloadsDir
  });
});

app.get("/api/jobs", (_req, res) => {
  res.json({
    jobs: Array.from(jobs.values()).map(serializeJob).reverse(),
    files: listDownloadedFiles()
  });
});

app.post("/api/downloads", (req, res) => {
  const url = String(req.body.url || "").trim();

  if (!isSpotifyUrl(url)) {
    res.status(400).json({ error: "Enter a valid Spotify track, album, playlist, or artist URL." });
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    url,
    status: "running",
    createdAt: new Date().toISOString(),
    finishedAt: null,
    output: []
  };

  jobs.set(id, job);

  const child = spawn(
    spotdlBin,
    getSpotdlArgs(url),
    {
      cwd: downloadsDir,
      env: {
        ...process.env,
        HOME: rootDir,
        PATH: `${path.join(rootDir, ".local", "bin")}:${process.env.PATH || ""}`,
        PYTHONUNBUFFERED: "1",
        XDG_CONFIG_HOME: configDir,
        XDG_CACHE_HOME: cacheDir
      }
    }
  );

  child.stdout.on("data", (chunk) => appendOutput(job, chunk));
  child.stderr.on("data", (chunk) => appendOutput(job, chunk));

  child.on("error", (error) => {
    job.status = "failed";
    job.finishedAt = new Date().toISOString();
    appendOutput(job, `Failed to start spotdl: ${error.message}`);
  });

  child.on("close", (code) => {
    if (job.status !== "failed") {
      job.status = code === 0 && !job.hasErrorOutput ? "complete" : "failed";
      job.finishedAt = new Date().toISOString();
      if (job.needsCookies) {
        appendOutput(
          job,
          "Render/YouTube download failed without cookies. Add a Render Secret File named cookies.txt, then redeploy."
        );
      }
      appendOutput(job, `spotdl exited with code ${code}`);
    }
  });

  res.status(202).json({ job: serializeJob(job) });
});

app.listen(port, () => {
  console.log(`spotdl web app running at http://127.0.0.1:${port}`);
  console.log(
    cookies.path
      ? `YouTube cookies configured from ${cookies.source}.`
      : "YouTube cookies are not configured."
  );
});
