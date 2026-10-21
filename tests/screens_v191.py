# tests/screens_v191.py OUTDIR — v0.19.1 dark shots: H07RN-F (corrected ratings, no 'typical' note),
# H07RN-F 3-phase, 3183Y flex (60 °C), tri-rated, 4-core SWA 95 mm². FAKE data. Server :8765.
import asyncio, sys, os
sys.argv = [sys.argv[0], sys.argv[1] if len(sys.argv) > 1 else '/workspace/sparky-shots/v0.19.1']
import importlib.util
spec = importlib.util.spec_from_file_location('s19', os.path.join(os.path.dirname(__file__), 'screens_v19.py'))
src = open(spec.origin).read().replace('asyncio.run(main())', '')
g = {'__file__': spec.origin}; exec(src, g)
SIZE = [
  ('v191-01-h07rnf-16A', {'phase': '1', 'loadType': 'general', 'load': '16', 'unit': 'A', 'length': '25', 'cable': 'h07', 'method': 'C', 'device': 'mcb', 'type': 'auto'}, None),
  ('v191-02-h07rnf-3ph-63A', {'phase': '3', 'loadType': 'general', 'load': '63', 'unit': 'A', 'length': '20', 'cable': 'h073', 'method': 'C', 'device': 'mcb', 'type': 'auto'}, None),
  ('v191-03-flex-13A', {'phase': '1', 'loadType': 'general', 'load': '13', 'unit': 'A', 'length': '3', 'cable': 'flex', 'method': 'C', 'device': 'bs1362'}, None),
  ('v191-04-tri-rated', {'phase': '1', 'loadType': 'general', 'load': '10', 'unit': 'A', 'length': '4', 'cable': 'tri', 'method': 'bunch', 'grouped': '6', 'device': 'mcb'}, None),
  ('v191-05-swa4-160A', {'phase': '3', 'loadType': 'general', 'load': '160', 'unit': 'A', 'length': '40', 'cable': 'swa4X', 'method': 'C', 'device': 'mccb', 'ze': '0.2'}, None),
]
async def main():
    os.makedirs(g['OUT'], exist_ok=True)
    async with g['async_playwright']() as p:
        e = await g['run'](p, 'dark', SIZE, [], None)
    print('errors:', e)
asyncio.run(main())
