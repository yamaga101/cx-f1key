#!/usr/bin/env python3
"""Upload extension files to Google Drive via API."""
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

TOKEN_PATH = os.path.expanduser("~/.config/google-api/token.json")
PARENT_FOLDER = "19N3NGQundvR-gxaQsWBu71it-uVARn7B"
EXT_DIR = os.path.dirname(os.path.abspath(__file__))
EXT_NAME = "chrome-f1-close-tab"
FILES = ["manifest.json", "background.js", "content.js", "popup.html"]

creds = Credentials.from_authorized_user_file(TOKEN_PATH)
drive = build("drive", "v3", credentials=creds)

# Find or create subfolder
q = f"name='{EXT_NAME}' and '{PARENT_FOLDER}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
results = drive.files().list(q=q, fields="files(id,name)").execute()
folders = results.get("files", [])

if folders:
    folder_id = folders[0]["id"]
    print(f"Folder exists: {folder_id}")
else:
    meta = {"name": EXT_NAME, "mimeType": "application/vnd.google-apps.folder", "parents": [PARENT_FOLDER]}
    folder = drive.files().create(body=meta, fields="id").execute()
    folder_id = folder["id"]
    print(f"Folder created: {folder_id}")

for fname in FILES:
    fpath = os.path.join(EXT_DIR, fname)
    mime = "application/json" if fname.endswith(".json") else "text/html" if fname.endswith(".html") else "application/javascript"

    q = f"name='{fname}' and '{folder_id}' in parents and trashed=false"
    existing = drive.files().list(q=q, fields="files(id)").execute().get("files", [])

    media = MediaFileUpload(fpath, mimetype=mime)
    if existing:
        drive.files().update(fileId=existing[0]["id"], media_body=media).execute()
        print(f"  Updated: {fname}")
    else:
        meta = {"name": fname, "parents": [folder_id]}
        drive.files().create(body=meta, media_body=media, fields="id").execute()
        print(f"  Created: {fname}")

print("Done")
