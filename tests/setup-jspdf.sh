#!/usr/bin/env bash
# v0.45: installs jsPDF's Node build (with its own dependencies) into tests/.jspdf for the PDF tests.
# The app doesn't use this; it ships vendor/jspdf. Safe to run again. Needs npm and the internet.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .jspdf && cd .jspdf
[ -f package.json ] || echo '{ "name": "zspro-test-jspdf", "private": true }' > package.json
npm install --no-audit --no-fund --omit=optional --omit=dev --no-save jspdf@4.2.1 >/dev/null
node -e "require('./node_modules/jspdf/dist/jspdf.node.min.js'); console.log('jsPDF test copy ready: tests/.jspdf')"
