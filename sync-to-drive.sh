#!/bin/bash
# Sync chrome-f1-close-tab to Google Drive (yamaga101@gmail.com)
# Local Drive sync → cloud → all devices (Mac/Windows)

set -euo pipefail
cd "$(dirname "$0")"

EXT_NAME="chrome-f1-close-tab"
EXT_FILES="manifest.json background.js content.js"
DEST="$HOME/Library/CloudStorage/GoogleDrive-yamaga101@gmail.com/マイドライブ/Chrome Extensions/$EXT_NAME"

mkdir -p "$DEST"
cp $EXT_FILES "$DEST/"
echo "Synced: $EXT_NAME v$(grep '"version"' manifest.json | head -1 | tr -d ' ",' | cut -d: -f2)"
