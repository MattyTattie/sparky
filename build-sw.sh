#!/usr/bin/env bash
# build-sw.sh — refresh the list of files the service worker keeps offline.
# Run after adding or removing files, and bump CACHE in sw.js.
cd "$(dirname "$0")"
LIST=$(find index.html styles.css manifest.json js fonts icons vendor -type f ! -name '*.txt' ! -name '*.md' ! -name 'LICENSE*' | sort | sed 's/^/  ".\//;s/$/",/')
python3 - "$LIST" <<'PY'
import re,sys
s=open('sw.js').read()
s=re.sub(r'const FILES = \[\n(.*?)\n\];', 'const FILES = [\n  "./",\n'+sys.argv[1]+'\n];', s, flags=re.S)
open('sw.js','w').write(s)
PY
echo "sw.js now lists $(grep -c '"./' sw.js) files"
