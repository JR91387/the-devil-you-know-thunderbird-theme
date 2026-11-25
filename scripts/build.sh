#!/usr/bin/env bash
# Build both packages of the theme into dist/:
#   the-devil-you-know-<version>.xpi      self-hosted, updates from updates.json
#   the-devil-you-know-<version>-atn.xpi  for addons.thunderbird.net: no update_url (ATN
#                                         rejects it) and a strict_max_version (ATN requires
#                                         one for themes with a stylesheet)
# Each package holds theme/ plus LICENSE and AUTHOR.md. Needs only python3.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -I - <<'PY'
import json, pathlib, zipfile

root = pathlib.Path(".")
manifest = json.loads((root / "theme/manifest.json").read_text())
version = manifest["version"]
max_version = (root / "store/max-version").read_text().strip()
files = sorted(p for p in (root / "theme").iterdir() if p.is_file())
extra = [root / "LICENSE", root / "AUTHOR.md"]
dist = root / "dist"
dist.mkdir(exist_ok=True)


def write(name, man):
    out = dist / name
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            if f.name == "manifest.json":
                z.writestr("manifest.json", json.dumps(man, indent=2) + "\n")
            else:
                z.write(f, f.name)
        for f in extra:
            z.write(f, f.name)
    print(out)


write(f"the-devil-you-know-{version}.xpi", manifest)
atn = json.loads(json.dumps(manifest))
gecko = atn["browser_specific_settings"]["gecko"]
gecko.pop("update_url", None)
gecko["strict_max_version"] = max_version
write(f"the-devil-you-know-{version}-atn.xpi", atn)
PY
