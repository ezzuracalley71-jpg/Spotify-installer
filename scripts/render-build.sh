#!/usr/bin/env bash
set -euo pipefail

export HOME="$PWD"
export XDG_CONFIG_HOME="$PWD/.config"
export XDG_CACHE_HOME="$PWD/.cache"
export PIP_CACHE_DIR="$PWD/.cache/pip"

python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

.venv/bin/spotdl --version
