#!/bin/bash
# Sync chrome-f1-close-tab to Google Drive (yamaga101@gmail.com)
# 1. Local Drive sync folder (Chrome loads from here)
# 2. Zip upload to Chrome Extensions folder (distribution)

set -euo pipefail
cd "$(dirname "$0")"

EXT_FILES="manifest.json background.js content.js"
LOCAL_DRIVE="$HOME/Library/CloudStorage/GoogleDrive-yamaga101@gmail.com/マイドライブ/chrome-f1-close-tab"
FOLDER_ID="19N3NGQundvR-gxaQsWBu71it-uVARn7B"
ZIP_NAME="chrome-f1-close-tab.zip"

# 1. Sync to local Drive folder (Chrome extension source)
mkdir -p "$LOCAL_DRIVE"
cp $EXT_FILES "$LOCAL_DRIVE/"
echo "Local Drive synced: $(grep '"version"' manifest.json | head -1 | tr -d ' ",')"

# 2. Zip upload to Drive for distribution
zip -r "$ZIP_NAME" $EXT_FILES

ACCESS_TOKEN=$(python3 refresh-token.py)

EXISTING=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://www.googleapis.com/drive/v3/files?q=name%3D'${ZIP_NAME}'+and+'${FOLDER_ID}'+in+parents+and+trashed%3Dfalse&fields=files(id)")
FILE_ID=$(echo "$EXISTING" | python3 -c "import sys,json; files=json.load(sys.stdin).get('files',[]); print(files[0]['id'] if files else '')")

if [ -n "$FILE_ID" ]; then
    curl -s -X PATCH \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -H "Content-Type: application/zip" \
      --data-binary "@$ZIP_NAME" \
      "https://www.googleapis.com/upload/drive/v3/files/${FILE_ID}?uploadType=media" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Drive zip updated: {d.get(\"name\")} (id: {d.get(\"id\")})')"
else
    curl -s -X POST \
      -H "Authorization: Bearer $ACCESS_TOKEN" \
      -F "metadata={\"name\":\"${ZIP_NAME}\",\"parents\":[\"${FOLDER_ID}\"]};type=application/json;charset=UTF-8" \
      -F "file=@${ZIP_NAME};type=application/zip" \
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Drive zip uploaded: {d.get(\"name\")} (id: {d.get(\"id\")})')"
fi

rm "$ZIP_NAME"
echo "Done."
