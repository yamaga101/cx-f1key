import json, requests, sys

token_file = sys.argv[1] if len(sys.argv) > 1 else f"{__import__('os').path.expanduser('~')}/.config/google-api/token.json"

with open(token_file) as f:
    data = json.load(f)

resp = requests.post("https://oauth2.googleapis.com/token", data={
    "client_id": data["client_id"],
    "client_secret": data["client_secret"],
    "refresh_token": data["refresh_token"],
    "grant_type": "refresh_token"
})
result = resp.json()

if "access_token" not in result:
    print(f"Error: {result}", file=sys.stderr)
    sys.exit(1)

data["token"] = result["access_token"]
data["access_token"] = result["access_token"]

with open(token_file, "w") as f:
    json.dump(data, f)

print(result["access_token"])
