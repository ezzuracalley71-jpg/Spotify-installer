# spotDL Web App

A small Express web app for queueing Spotify downloads through the local `spotdl`
CLI. Downloaded audio files are served from `downloads/`.

## Run

```sh
npm start
```

Open http://127.0.0.1:3000 and paste a Spotify track, album, playlist, or artist
URL.

## Installed Dependencies

- Node packages are installed with `npm install`.
- Python `spotdl` is installed in `.venv/`.
- For local use, FFmpeg can be installed at `.config/spotdl/ffmpeg` with
  `HOME=$PWD .venv/bin/spotdl --download-ffmpeg`.
- For Render, FFmpeg is installed by the Docker image.

The server sets `HOME`, `XDG_CONFIG_HOME`, and `XDG_CACHE_HOME` to project-local
paths before running `spotdl`, which keeps all spotDL config and cache files
inside this folder.

## YouTube Cookies

For local runs, place a Netscape-format cookie jar at `cookies.txt` in the
project root. The server automatically passes it to `spotdl` with
`--cookie-file`. Treat this file as a secret; it is ignored by git and Docker.

## Deploy to Render

This repo includes a `render.yaml` Blueprint and a `Dockerfile`. On Render:

1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In Render, create a new Blueprint from the repo.
3. Render will build the Docker image, install Node dependencies, install
   `spotdl`, install FFmpeg, and start the web service with `npm start`.

Downloaded files are stored in `downloads/` on the service filesystem. Render
service filesystems are temporary unless you attach a persistent disk, so files
can disappear after restarts or redeploys.

### YouTube/yt-dlp failures on Render

If downloads fail with `AudioProviderError: YT-DLP download error`, YouTube is
often blocking anonymous cloud traffic. Use a Render Secret File for your
Netscape-format cookie jar:

1. In your Render service, open Environment.
2. Under Secret Files, add a file named `cookies.txt`.
3. Paste the contents of your local `cookies.txt`.
4. Save changes and redeploy.

At runtime, Render mounts that file at `/etc/secrets/cookies.txt`, and the app
passes it to `spotdl` with `--cookie-file`.

If YouTube still says `Sign in to confirm you're not a bot` while
`/api/health` reports `"cookiesConfigured": true`, replace the Secret File with
a fresh browser export. Export the full YouTube/Google login cookie jar, not
only a few `.youtube.com` rows.

The app also supports these optional env vars:

- `YOUTUBE_COOKIES`: raw Netscape-format cookies.txt content.
- `YOUTUBE_COOKIES_B64`: base64-encoded Netscape-format cookies.txt content.
- `YOUTUBE_COOKIES_FILE`: custom path to a Netscape-format cookie file.

Environment variables take priority over Render's `/etc/secrets/cookies.txt`
and the local `cookies.txt` file.

The default provider order is SoundCloud, YouTube Music, then YouTube. The
Piped provider is intentionally not enabled by default because public Piped
instances often return invalid or blocked API responses from hosted platforms.
