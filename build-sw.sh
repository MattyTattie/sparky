#!/usr/bin/env bash
# build-sw.sh — refresh the lists of files the service worker keeps offline.
# Run after adding or removing files, and bump CACHE in sw.js.
# v0.50.0: two lists. FILES (the app) is re-downloaded on every release; VENDOR (vendor/ and fonts/, the big
# libraries) lives in its own cache. If you change anything under vendor/ or fonts/, bump VENDOR_CACHE too.
cd "$(dirname "$0")"
APP=$(find index.html styles.css dark.css desktop.css manifest.json js icons -type f ! -name '*.txt' ! -name '*.md' ! -name 'LICENSE*' | sort | sed 's/^/  ".\//;s/$/",/')
VEN=$(find fonts vendor -type f ! -name '*.txt' ! -name '*.md' ! -name 'LICENSE*' | sort | sed 's/^/  ".\//;s/$/",/')
python3 - "$APP" "$VEN" <<'PY'
import re,sys
s=open('sw.js').read()
s=re.sub(r'const FILES = \[\n(.*?)\n\];', lambda m: 'const FILES = [\n  "./",\n'+sys.argv[1]+'\n];', s, count=1, flags=re.S)
s=re.sub(r'const VENDOR = \[\n(.*?)\];', lambda m: 'const VENDOR = [\n'+sys.argv[2]+'\n];', s, count=1, flags=re.S)
open('sw.js','w').write(s)
PY
echo "sw.js now lists $(sed -n '/^const FILES/,/^];/p' sw.js | grep -c '"./') app files and $(sed -n '/^const VENDOR = \[/,/^];/p' sw.js | grep -c '"./') vendor files"
