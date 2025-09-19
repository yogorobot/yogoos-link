#!/usr/bin/env bash
set -euo pipefail

# Generate icons for yolink using ImageMagick and iconutil (macOS)
# Requires: magick (ImageMagick 7+) and iconutil on macOS
#
# Note about visual size on macOS Launchpad:
# If the glyph looks too “big” compared to other apps, add internal padding so the
# artwork doesn’t touch the edges. We add a default 10% padding on each side
# (effective content scale ~80%) which aligns better with App Icon safe areas.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
# Allow passing a custom SVG path as the first argument
SVG_INPUT="${1:-}"
# Padding percent per side (integer 0-30). Default 10 => content is 80% of canvas.
PADDING_PERCENT=${PADDING_PERCENT:-10}
if ! [[ "$PADDING_PERCENT" =~ ^[0-9]+$ ]] || [ "$PADDING_PERCENT" -gt 30 ]; then
  echo "Error: PADDING_PERCENT must be an integer between 0 and 30" >&2
  exit 1
fi
if [[ -n "$SVG_INPUT" ]]; then
  if [[ -f "$SVG_INPUT" ]]; then
    SVG=$(cd "$(dirname "$SVG_INPUT")" && pwd)/$(basename "$SVG_INPUT")
  else
    echo "Error: Provided SVG not found: $SVG_INPUT" >&2
    exit 1
  fi
else
  SVG="$ROOT_DIR/assets/yolink_icon.svg"
fi

OUT_DIR="$ROOT_DIR/assets/icons/yolink"
ICONSET_DIR="$OUT_DIR/yolink.iconset"

SIZES=(16 32 48 64 128 256 512 1024)

if ! command -v magick >/dev/null 2>&1; then
  echo "Error: ImageMagick (magick) not found. Install via: brew install imagemagick" >&2
  exit 1
fi

# Prefer rsvg-convert if available (better SVG fidelity), otherwise use magick
HAS_RSVG=0
if command -v rsvg-convert >/dev/null 2>&1; then
  HAS_RSVG=1
fi

mkdir -p "$OUT_DIR" "$ICONSET_DIR"

# Export PNGs with internal padding by resizing the glyph to an inner size and
# then placing it centered on a transparent canvas of the target size.
for size in "${SIZES[@]}"; do
  inner_size=$(( size * (100 - 2*PADDING_PERCENT) / 100 ))
  if [ "$inner_size" -lt 1 ]; then inner_size=1; fi
  if [[ $HAS_RSVG -eq 1 ]]; then
    # Render glyph at inner size, then extend to full size with transparent padding
    rsvg-convert -w ${inner_size} -h ${inner_size} "$SVG" -o "$OUT_DIR/${size}x${size}.png"
    magick "$OUT_DIR/${size}x${size}.png" \
      -alpha on -background none -gravity center \
      -extent ${size}x${size} PNG32:"$OUT_DIR/${size}x${size}.png"
  else
    magick -density 1024 "$SVG" \
      -resize ${inner_size}x${inner_size} \
      -background none -gravity center \
      -extent ${size}x${size} PNG32:"$OUT_DIR/${size}x${size}.png"
  fi
  # Fill iconset common names
  case "$size" in
    16)  cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_16x16.png" ;;
    32)  cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_16x16@2x.png" ; cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_32x32.png" ;;
    64)  cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_32x32@2x.png" ;;
    128) cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_128x128.png" ;;
    256) cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_128x128@2x.png" ; cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_256x256.png" ;;
    512) cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_256x256@2x.png" ; cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_512x512.png" ;;
    1024) cp "$OUT_DIR/${size}x${size}.png" "$ICONSET_DIR/icon_512x512@2x.png" ;;
  esac
done

# Generate ICO (Windows)
# Generate ICO using magick (IM7)
magick \
  "$OUT_DIR/16x16.png" \
  "$OUT_DIR/32x32.png" \
  "$OUT_DIR/48x48.png" \
  "$OUT_DIR/64x64.png" \
  "$OUT_DIR/128x128.png" \
  "$OUT_DIR/256x256.png" \
  "$OUT_DIR/512x512.png" \
  "$OUT_DIR/1024x1024.png" \
  "$ROOT_DIR/assets/icon.ico"

# Generate ICNS (macOS)
if [[ "$(uname)" == "Darwin" ]] && command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns "$ICONSET_DIR" -o "$ROOT_DIR/assets/icon.icns"
else
  echo "Warning: iconutil not available, skipping ICNS generation" >&2
fi

# Provide default PNG for Linux
cp "$OUT_DIR/512x512.png" "$ROOT_DIR/assets/icon.png"

echo "Icons generated under $OUT_DIR and copied to assets/icon.icns, assets/icon.ico, assets/icon.png"
