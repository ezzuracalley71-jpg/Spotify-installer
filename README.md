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

## Deploy to Render

This repo includes a `render.yaml` Blueprint and a `Dockerfile`. On Render:

1. Push this folder to a GitHub/GitLab/Bitbucket repo.
2. In Render, create a new Blueprint from the repo.
3. Render will build the Docker image, install Node dependencies, install
   `spotdl`, install FFmpeg, and start the web service with `npm start`.

Downloaded files are stored in `downloads/` on the service filesystem. Render
service filesystems are temporary unless you attach a persistent disk, so files
can disappear after restarts or redeploys.
