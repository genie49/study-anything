#!/usr/bin/env python3
"""Pack a validated .soul/{track} bundle into an uploadable .zip.

The study-anything frontend now adds tracks by uploading a .soul bundle as a
zip (트랙 추가 → ZIP 업로드). This is the LAST step of the soul-structuring
skill: after the bundle validates, zip it so the user can drop it into the app.

Guardrail: this script re-runs validate_soul.py first and REFUSES to pack an
invalid bundle — an uploadable zip is, by construction, a validated one.

Zip layout (zip root == bundle root, so the server unzips straight into the
import contract { manifest, decks }):
    manifest.json
    decks/{deckSlug}.json
    ...

The archive is deterministic (sorted entries, fixed timestamps) so re-packing
an unchanged bundle yields a byte-identical zip.

Usage:
    pack_soul.py <path-to-.soul/{trackName}> [-o OUTPUT.zip]

Default output: <parent>/{trackSlug}.zip  (sibling of the bundle dir)
Exit code 0 = packed, 1 = validation failed or bad input.
"""
import argparse
import subprocess
import sys
import zipfile
from pathlib import Path

# Fixed timestamp for reproducible archives (1980-01-01, the zip epoch floor).
_ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)


def main():
    ap = argparse.ArgumentParser(description="Validate then pack a .soul/{track} bundle into a zip.")
    ap.add_argument("track_dir", help="path to .soul/{trackName}")
    ap.add_argument("-o", "--output", help="output zip path (default: <parent>/{trackSlug}.zip)")
    args = ap.parse_args()

    root = Path(args.track_dir).resolve()
    if not root.is_dir():
        print(f"[{root}] not a directory", file=sys.stderr)
        sys.exit(1)
    if not (root / "manifest.json").is_file():
        print(f"[{root}] manifest.json missing — is this a .soul/{{track}} dir?", file=sys.stderr)
        sys.exit(1)

    # 1) Validate first — never pack a broken bundle.
    validator = Path(__file__).with_name("validate_soul.py")
    result = subprocess.run([sys.executable, str(validator), str(root)])
    if result.returncode != 0:
        print("\n✗ validation failed — fix the errors above, then pack again.", file=sys.stderr)
        sys.exit(1)

    # 2) Collect files: manifest.json + decks/*.json, relative to the bundle root.
    members = [root / "manifest.json"]
    members += sorted((root / "decks").glob("*.json"))
    members = [m for m in members if m.is_file()]

    out = Path(args.output) if args.output else root.with_suffix(".zip")
    out.parent.mkdir(parents=True, exist_ok=True)

    # 3) Write a deterministic zip (sorted entries, fixed timestamps).
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for m in members:
            arcname = m.relative_to(root).as_posix()
            info = zipfile.ZipInfo(arcname, date_time=_ZIP_EPOCH)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, m.read_bytes())

    size_kb = out.stat().st_size / 1024
    print(f"📦 packed {len(members)} file(s) → {out}  ({size_kb:.1f} KB)")
    print("   업로드: 앱 → 트랙 추가 → ZIP 업로드")


if __name__ == "__main__":
    main()
