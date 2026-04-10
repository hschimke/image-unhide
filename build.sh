#!/usr/bin/env bash
set -euo pipefail

OUT="image-unhider.zip"
rm -f "$OUT"

zip -r "$OUT" . \
  --exclude "*.git*" \
  --exclude "*_metadata*" \
  --exclude "test.html" \
  --exclude "screen.png" \
  --exclude "build.sh" \
  --exclude "docs/*" \
  --exclude "*.zip"

echo "Built: $OUT"
