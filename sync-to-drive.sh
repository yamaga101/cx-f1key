#!/bin/bash
# Upload chrome-f1-close-tab to Google Drive via API (instant, no sync lag)
set -euo pipefail
cd "$(dirname "$0")"
python3 upload-to-drive.py
echo "v$(grep '"version"' manifest.json | head -1 | tr -d ' ",' | cut -d: -f2)"
