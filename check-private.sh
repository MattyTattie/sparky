#!/usr/bin/env bash
# check-private.sh — run before every publish.
# Fails if the folder about to be published contains customer details,
# real postcodes, personal emails, mobile numbers or your own details.
#   ./check-private.sh [folder]
# Your own details (address, surname, reg number…) are NOT written in this
# script, because it gets published too. Put them, as one regex, in a file
# kept OFF GitHub, by default ../sparky-work/private-patterns.txt
set -u
DIR="${1:-$(dirname "$0")}"
PRIV="${PRIVATE_PATTERNS:-$(dirname "$0")/../sparky-work/private-patterns.txt}"
# Generic: personal email providers, UK mobile numbers, and any UK postcode
# that isn't one of the fake ZZ ones used in the samples.
GEN='([A-Za-z0-9._%+-]+@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|btinternet|me|nhs)\.[a-z.]+|\b(\+44 ?7|07)[0-9]{3} ?[0-9]{3} ?[0-9]{3}\b|\b(?!ZZ)(?!AB12)(?!H07RN)[A-PR-UWYZ][A-HK-Y]?[0-9][0-9A-HJKMNPR-Y]? ?[0-9][ABD-HJLNP-UW-Z]{2}\b)'
fail=0
echo "Checking $DIR for private details…"
scan() { # $1 = pattern, $2 = label
  if rg -n -P "$1" "$DIR" --glob '!.git' --glob '!vendor/**' --glob '!*.pdf' --glob '!*.png' --glob '!*.woff' --glob '!js/pdffonts.js' --glob '!check-private.sh'; then echo "↑ $2"; fail=1; fi
  for f in $(find "$DIR" -name '*.pdf' -not -path '*/.git/*'); do
    if pdftotext -q "$f" - 2>/dev/null | rg -P -q "$1"; then echo "PDF: $f ($2)"; fail=1; fi
  done
}
scan "$GEN" 'personal email / mobile / real postcode'
if [ -f "$PRIV" ]; then scan "(?i)$(cat "$PRIV")" 'your own private details'; else echo "(No private-patterns file at $PRIV — only generic checks run.)"; fi
if find "$DIR" -not -path '*/.git/*' \( -name '*.jks' -o -name '*.keystore' -o -name '*.json' -path '*backup*' \) | grep -q .; then echo "Keystore or backup file found!"; fail=1; fi
if [ $fail = 0 ]; then echo "✓ No private details found."; else echo "✗ Private details found — fix before publishing."; fi
exit $fail
