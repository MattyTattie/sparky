# tests/scan_photo.py - run the on-device CU scanner headlessly on a photo path (photo stays on the box).
# Usage: python3 tests/scan_photo.py /path/photo.jpg [more.jpg] [--truth truth.json]
#   needs the dev server: python3 -m http.server 8765 (in the app folder)
# truth.json: {"photo.jpg": {"labels": ["Downstairs lights", "", ...], "ratings": ["B6", ...]}}
import asyncio, sys, os, json, time
from playwright.async_api import async_playwright
URL = 'http://localhost:8765/index.html'
args = [a for a in sys.argv[1:] if not a.startswith('--')]
truth = {}
if '--truth' in sys.argv: tp = sys.argv[sys.argv.index('--truth') + 1]; truth = json.load(open(tp)); args = [a for a in args if a != tp]
def norm(s): return ''.join(ch for ch in (s or '').lower() if ch.isalnum())
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(service_workers='block')).new_page()
        pg.on('console', lambda m: print('  [console]', m.text) if m.type in ('error', 'warning') or m.text.startswith('[scan]') else None)
        await pg.goto(URL + '#/'); await pg.wait_for_timeout(500)
        for path in args:
            data = open(path, 'rb').read()
            await pg.unroute_all(); await pg.route(URL.rsplit('/', 1)[0] + '/__photo', (lambda d: (lambda r, *_: r.fulfill(body=d, content_type='image/jpeg')))(data))
            t = time.time()
            res = await pg.evaluate('''async () => { const o = await import('/js/ocr.js'); const bl = await (await fetch('/__photo')).blob();
              const t0 = performance.now(); const prog = []; const rows = await o.readBoard([{ file: bl }], (f, m) => prog.push(m));
              return { ms: Math.round(performance.now() - t0), stats: o.stats ? o.stats() : null, prog: [...new Set(prog)].slice(0, 12),
                rows: rows.map((r) => ({ rect: r.rect, ways: r.ways.map((w) => ({ t: (w.type || '') + (w.rating || ''), idn: w.idn, desc: w.desc || '', sure: w.sure })), board: r.board.map((x) => x.kind + (x.rating || '')) })) }; }''')
            name = os.path.basename(path); ways = [w for r in res['rows'] for w in r['ways']]
            print(f'== {name}: {res["ms"]} ms (wall {time.time()-t:.1f}s) stats={res["stats"]}')
            for r in res['rows']: print('  row', r['rect'], 'board:', r['board'])
            for i, w in enumerate(ways): print(f'  {i+1:2} {w["t"]:5} {w["idn"] or "":3} sure={str(w["sure"])[0]} {w["desc"]}')
            tr = truth.get(name)
            if tr:
                L, R = tr.get('labels', []), tr.get('ratings', [])
                okR = sum(1 for i, x in enumerate(R) if i < len(ways) and ways[i]['t'] == x)
                okL = sum(1 for i, x in enumerate(L) if norm((ways[i]['desc'] if i < len(ways) else '')) == norm(x))
                hitL = sum(1 for i, x in enumerate(L) if x and i < len(ways) and norm(ways[i]['desc']) == norm(x))
                print(f'  SCORE ways found {len(ways)}/{len(R)}; ratings {okR}/{len(R)}; label columns right {okL}/{len(L)} (stickers read {hitL}/{sum(1 for x in L if x)})')
        await b.close()
asyncio.run(main())
