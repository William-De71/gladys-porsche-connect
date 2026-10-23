#!/usr/bin/env bash
# Builds cover.jpg (800 x 534, < 150 KB, as the store requires) from
# docs/assets/cover.svg. Needs Inkscape, or Chrome / Chromium (CHROME=…, or
# the Playwright one), and ImageMagick (6 or 7).
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v magick >/dev/null; then im() { magick "$@"; }; else im() { convert "$@"; }; fi
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if command -v inkscape >/dev/null; then
  inkscape docs/assets/cover.svg --export-type=png --export-filename="$tmp/cover.png" -w 800 -h 534 >/dev/null 2>&1
else
  chrome="${CHROME:-$(ls -d "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome /opt/pw-browsers/chromium-*/chrome-linux*/chrome 2>/dev/null | tail -n1 || true)}"
  [ -x "$chrome" ] || { echo "Inkscape or Chrome needed: set CHROME=/path/to/chrome" >&2; exit 1; }
  printf '<html><body style="margin:0"><img src="%s" width="800" height="534"></body></html>' \
    "file://$PWD/docs/assets/cover.svg" >"$tmp/cover.html"
  "$chrome" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --allow-file-access-from-files --window-size=800,800 \
    --screenshot="$tmp/cover.png" "file://$tmp/cover.html" >/dev/null 2>&1
fi
im "$tmp/cover.png" -crop 800x534+0+0 +repage -strip -quality 85 -sampling-factor 4:2:0 cover.jpg
size="$(stat -c %s cover.jpg)"
dims="$(im identify -format '%wx%h' cover.jpg 2>/dev/null || identify -format '%wx%h' cover.jpg)"
echo "cover.jpg: ${dims}, ${size} bytes"
[ "$dims" = "800x534" ] || { echo "wrong dimensions" >&2; exit 1; }
[ "$size" -lt $((150 * 1024)) ] || { echo "too heavy" >&2; exit 1; }
