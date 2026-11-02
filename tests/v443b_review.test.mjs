// v0.44.3b (test): blind-review fixes. Made-up data only.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as W from '../js/wiring.js'; import { readFileSync } from 'node:fs';
const mk = (num, desc, extra = {}) => ({ num, desc, device: 'mcb', type: 'B', rating: '32', live: '2.5', cpc: '1.5', points: '1', ...extra });
const lay = (cs, boards = null) => W.layout(W.diagramModel({ type: 'EIC', boards: boards || [{ id: 'b', ref: 'DB1', circuits: cs }] }), { W: 380, font: 12, screen: true });
const texts = (b) => b.shapes.filter((z) => z.t === 'text').map((z) => z.txt);
const rooms = (b) => b.shapes.filter((z) => z.t === 'rect' && String(z.color) === String(W.COL.room));
test('ring room box holds every socket row; empty rooms are not drawn', () => {
  const c = mk('3', 'Ring upstairs', { points: '9', diagram: { roomList: [{ name: 'Bedroom 1', sockets: 9 }, { name: 'Landing', sockets: 0 }] } });
  const b = lay([c]).blocks.find((x) => x.kind === 'circuit' || texts(x).some((t) => /Ring upstairs/.test(t)));
  assert.ok(!texts(b).some((t) => /Landing/.test(t)), 'Landing (0 items) not drawn');
  const box = rooms(b)[0]; assert.ok(box, 'room box');
  const plates = b.shapes.filter((z) => z.t === 'rect' && z !== box && z.y > box.y && z.x > box.x);
  for (const p of plates) assert.ok(p.y + p.h <= box.y + box.h + 0.5, 'plate inside the box');
});
test('sub-main says Sub-main to DB2, not fixed appliance; DB2 draws its main switch', () => {
  const L = lay(null, [{ id: 'a', ref: 'DB1', circuits: [mk('18', 'Garage', { rating: '40', live: '10', cpc: '10' })] }, { id: 'g', ref: 'DB2', suppliedFrom: 'DB1 circuit 18', circuits: [mk('1', 'Garage sockets', { points: '2' })] }]);
  const all = L.blocks.flatMap(texts).join('\n');
  assert.match(all, /Sub-main to DB2/); assert.doesNotMatch(all, /fixed appliance/); assert.match(all, /Main switch: isolator/);
});
test('contactor contact is inline (no dashed link) on room circuits too', () => {
  const cs = [mk('14', 'Radiators lounge', { diagram: { roomList: [{ name: 'Hall', items: { heater: 1 } }] } }), mk('28', 'Control', { rating: '6', diagram: { chain: [{ k: 'hive' }, { k: 'km', circuits: ['14'] }] } })];
  const b = lay(cs).blocks.find((x) => texts(x).some((t) => /Radiators lounge/.test(t)));
  assert.ok(!b.shapes.some((z) => z.t === 'line' && z.dash && String(z.color) === String(W.COL.brand)), 'no dashed brand line');
  assert.ok(texts(b).includes('Rad') && !texts(b).includes('Rail'), 'radiators say Rad');
});
test('key has one SFCU entry', () => {
  const cs = [mk('1', 'Spur', { diagram: { items: { sfcu: 1 } } }), mk('2', 'Control', { rating: '6', diagram: { chain: [{ k: 'sfcu' }, { k: 'km', circuits: ['1'] }] } })];
  const key = lay(cs).blocks.find((b) => b.kind === 'legend'); const t = texts(key).join(' ');
  assert.equal((t.match(/Switched fused connection/g) || []).length, 1, t);
});
test('control circuit points count the coils drawn; spur toggle sits by the Spur line', () => {
  const cs = [mk('1', 'Immersion'), mk('2', 'Control', { rating: '6', diagram: { chain: [{ k: 'shelly' }, { k: 'km', circuits: ['1'] }] } })];
  assert.ok(lay(cs).blocks.flatMap(texts).some((t) => /1 \u00d7 contactor coil$/.test(t)));
  const src = readFileSync(new URL('../js/certui.js', import.meta.url), 'utf8'); assert.match(src, /spurs: h\('div', \{ class: 'spurtype'/);
});
