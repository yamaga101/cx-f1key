#!/usr/bin/env python3
"""Trash deprecated Chrome extension folders from Google Drive."""

import os
import json
import re
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

TOKEN_PATH = os.path.expanduser("~/.config/google-api/token.json")
PARENT_FOLDER_ID = "19N3NGQundvR-gxaQsWBu71it-uVARn7B"

# Patterns to trash
DEPRECATED_PREFIXES = [
    "link-summarizer",
    "notebooklm-adder",
    "url-extractor",
]

# For link-toolkit: keep _v1.0.0 and _v1.1.0, trash the bare "link-toolkit"
LINK_TOOLKIT_KEEP = {"link-toolkit_v1.0.0", "link-toolkit_v1.1.0"}


def get_service():
    with open(TOKEN_PATH) as f:
        token_data = json.load(f)

    creds = Credentials(
        token=token_data.get("token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id"),
        client_secret=token_data.get("client_secret"),
    )
    return build("drive", "v3", credentials=creds)


def list_folders_in_parent(service, parent_id):
    folders = []
    page_token = None
    while True:
        resp = service.files().list(
            q=f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="nextPageToken, files(id, name)",
            pageToken=page_token,
        ).execute()
        folders.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return folders


def should_trash(name):
    # Deprecated prefix match (with optional version suffix)
    for prefix in DEPRECATED_PREFIXES:
        if name == prefix or name.startswith(prefix + "_"):
            return True

    # link-toolkit: trash if it's NOT in the keep set and starts with "link-toolkit"
    if name.startswith("link-toolkit"):
        if name not in LINK_TOOLKIT_KEEP:
            return True

    return False


def main():
    service = get_service()
    print(f"Listing folders in parent: {PARENT_FOLDER_ID}\n")

    folders = list_folders_in_parent(service, PARENT_FOLDER_ID)
    print(f"Found {len(folders)} folder(s) total:\n")
    for f in sorted(folders, key=lambda x: x["name"]):
        print(f"  {f['name']}  ({f['id']})")

    print()
    to_trash = [f for f in folders if should_trash(f["name"])]

    if not to_trash:
        print("No folders matched the deprecation criteria. Nothing to trash.")
        return

    print(f"Trashing {len(to_trash)} folder(s):\n")
    for f in to_trash:
        print(f"  TRASHING: {f['name']}  ({f['id']})")
        service.files().update(
            fileId=f["id"],
            body={"trashed": True},
        ).execute()
        print(f"    -> Done")

    print("\nAll targeted folders have been moved to Trash.")


if __name__ == "__main__":
    main()
