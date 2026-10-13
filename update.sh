#!/usr/bin/env bash
# Pull the latest Thermo Quest from GitHub:  bash /opt/thermo-quest/update.sh
# Restarts the server only when server/ changed (a restart ends a live lecture).
set -euo pipefail
cd "$(dirname "$0")"
before=$(git rev-parse HEAD)
git pull --ff-only
if [ "$before" = "$(git rev-parse HEAD)" ]; then
  echo "Already up to date."
  exit 0
fi
git log --oneline "$before..HEAD"
if git diff --quiet "$before" HEAD -- server/; then
  echo "Game files updated. Students get them when they reload the page."
else
  (cd server && npm install --no-audit --no-fund)
  sudo systemctl restart thermo-quest
  echo "Server updated and restarted."
fi
