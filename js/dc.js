// =====================================================================
// dc.js — DC sums for solar PV strings and battery leads. Plain JS,
// tested by tests/dc.test.mjs.
// =====================================================================
// ⚠ Rules of thumb here are from the IET Code of Practice for Grid-connected
// Solar PV and for Electrical Energy Storage Systems, and BS 7671 Section 712,
// written in from memory: check them against your copies and the makers' data
// (panel, inverter, battery, fuse) before relying on them.

export const RHO20 = 0.017241;   // Ω·mm²/m, annealed copper at 20 °C (IEC 60228 basis)
export const ALPHA = 0.00393;    // per °C, copper
export const DC_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
// Current ratings for two single-core cables clipped direct (d.c.), amps, 30 °C.
// 70 °C PVC: BS 7671 Table 4D1A col 6; 90 °C thermosetting: Table 4E1A col 6 (both checked
// against published copies of the tables, Oct 2026).
// (PV cable H1Z2Z2-K and tri-rated are 90 °C+: makers' ratings are often higher).
export const DC_AMPS = {
  pvc70: { label: '70 °C PVC singles (Table 4D1A, clipped direct)', amps: { 1.5: 20, 2.5: 27, 4: 37, 6: 47, 10: 65, 16: 87, 25: 114, 35: 141, 50: 182, 70: 234, 95: 284, 120: 330 } },
  xlpe90: { label: '90 °C XLPE / PV cable singles (Table 4E1A, clipped direct)', amps: { 1.5: 25, 2.5: 34, 4: 46, 6: 59, 10: 81, 16: 109, 25: 143, 35: 176, 50: 228, 70: 293, 95: 355, 120: 413 } },
};
// gPV string fuse sizes (A) and common battery fuse sizes (A).
export const PV_FUSES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 16, 20, 25, 30, 32];
export const BATT_FUSES = [32, 40, 50, 63, 80, 100, 125, 150, 160, 200, 250, 300, 315, 350, 400, 500];

const r2 = (n) => Math.round(n * 100) / 100;
export const rhoAt = (tC) => RHO20 * (1 + ALPHA * (Number(tC) - 20));

// Two-way (out and back) volt drop for a run of `length` m one way.
export function dcVoltDrop({ current, length, csa, temp = 70, volts }) {
  const I = Number(current), L = Number(length), A = Number(csa);
  if (!(I > 0 && L > 0 && A > 0)) return null;
  const r = (2 * L * rhoAt(temp)) / A; const v = I * r;
  return { mohm: r2(r * 1000), volts: r2(v), pct: volts ? r2((v / Number(volts)) * 100) : null, watts: r2(I * I * r) };
}
// Smallest standard size passing volt drop (and the cable current rating, if a rating table is given).
export function dcCableSize({ current, length, volts, targetPct = 1, temp = 70, needAmps = 0, cable = 'xlpe90', minSize = 0 }) {
  const tbl = DC_AMPS[cable] || DC_AMPS.xlpe90;
  const rows = DC_SIZES.filter((s) => s >= minSize).map((s) => {
    const vd = dcVoltDrop({ current, length, csa: s, temp, volts });
    const amps = tbl.amps[s] ?? null;
    const curOk = !needAmps || (amps != null && amps >= needAmps - 1e-9);
    return { size: s, vd, amps, curOk, vdOk: vd && vd.pct != null ? vd.pct <= Number(targetPct) + 1e-9 : false };
  });
  const pick = rows.find((r) => r.curOk && r.vdOk) || null;
  const why = [];
  for (const r of rows) { if (r === pick) break; const w = []; if (!r.curOk) w.push(`${r.size} mm² is only rated ${r.amps ?? '?'} A (needs ${r2(needAmps)} A)`); if (!r.vdOk && r.vd) w.push(`${r.size} mm² drops ${r.vd.pct}% (target ${targetPct}%)`); why.push(w.join('; ')); }
  return { rows, pick, why: why.filter(Boolean), table: tbl.label };
}

// Cold-morning string voltage: n × Voc × (1 + coef% × (Tmin − 25)).
export function coldVoc({ n, voc, coefPct = -0.27, tmin = -10 }) {
  const N = Number(n), V = Number(voc), c = Number(coefPct) / 100;
  if (!(N > 0 && V > 0)) return null;
  return r2(N * V * (1 + c * (Number(tmin) - 25)));
}
// Hot string voltage at max power (for the MPPT lower limit): n × Vmp × (1 + coef × (Tcell − 25)).
export function hotVmp({ n, vmp, coefPct = -0.35, tcell = 70 }) {
  const N = Number(n), V = Number(vmp); if (!(N > 0 && V > 0)) return null;
  return r2(N * V * (1 + (Number(coefPct) / 100) * (Number(tcell) - 25)));
}

// PV string fuse: needed when 3 or more strings are in parallel (or 2+ where the panels'
// reverse current rating would be exceeded). Rating 1.5–2.4 × Isc and ≤ the panel's max series fuse.
export function pvStringFuse({ isc, strings = 1, maxSeriesFuse = null }) {
  const I = Number(isc), S = Number(strings) || 1; const mx = Number(maxSeriesFuse) || null;
  if (!(I > 0)) return null;
  const lo = 1.5 * I, hi = 2.4 * I;
  const reverse = (S - 1) * I;
  const needed = S >= 3 || (mx && reverse > mx);
  const fuse = PV_FUSES.find((f) => f >= lo - 1e-9 && f <= hi + 1e-9 && (!mx || f <= mx)) || null;
  return { needed: !!needed, lo: r2(lo), hi: r2(hi), fuse, reverse: r2(reverse), maxSeriesFuse: mx,
    why: needed ? `${S} strings in parallel: a faulty string could be fed ${r2(reverse)} A back from the others${mx ? ` (panel max series fuse ${mx} A)` : ''}, so each string needs a gPV fuse.` : `${S === 1 ? 'One string' : S + ' strings'}: no string fuse needed${mx ? ` (reverse current ${r2(reverse)} A is within the panel\u2019s ${mx} A)` : ''}.` };
}
// Battery fuse: above the max continuous current (× 1.25 margin), and the cable must carry the fuse rating.
export function batteryFuse({ current, margin = 1.25 }) {
  const I = Number(current); if (!(I > 0)) return null;
  const need = I * Number(margin || 1.25);
  return { need: r2(need), fuse: BATT_FUSES.find((f) => f >= need - 1e-9) || null };
}

// Whole PV string check.
export function pvString(o) {
  const { n, voc, vmp, isc, imp, coefPct = -0.27, tmin = -10, invMax, mpptMax, length, targetPct = 1, temp = 70, strings = 1, maxSeriesFuse, cable = 'xlpe90' } = o;
  const cold = coldVoc({ n, voc, coefPct, tmin });
  const stc = n && voc ? r2(Number(n) * Number(voc)) : null;
  const vstring = n && vmp ? r2(Number(n) * Number(vmp)) : null;
  const vocOk = cold != null && invMax ? cold <= Number(invMax) : null;
  const near = cold != null && invMax ? cold > 0.95 * Number(invMax) && cold <= Number(invMax) : false;
  const cableAmps = isc ? r2(1.25 * Number(isc)) : 0; // 712.433.101 style: Iz ≥ 1.25 × Isc STC (no string fuse)
  const fuse = pvStringFuse({ isc, strings, maxSeriesFuse });
  const needAmps = fuse && fuse.needed && fuse.fuse ? Math.max(cableAmps, fuse.fuse) : cableAmps;
  const size = vstring && (imp || isc) && length ? dcCableSize({ current: imp || isc, length, volts: vstring, targetPct, temp, needAmps, cable, minSize: 4 }) : null;
  return { cold, stc, vstring, vocOk, near, invMax: Number(invMax) || null, mpptMax: Number(mpptMax) || null, mpptOk: cold != null && mpptMax ? cold <= Number(mpptMax) : null, cableAmps, needAmps, fuse, size };
}
// Battery ↔ inverter leads.
export function batteryLeads(o) {
  const { volts = 51.2, current, kw, eff = 0.95, length, targetPct = 1, temp = 70, cable = 'xlpe90' } = o;
  const I = Number(current) > 0 ? Number(current) : Number(kw) > 0 ? (Number(kw) * 1000) / (Number(volts) * (Number(eff) || 1)) : null;
  if (!I) return { ok: false, error: 'Enter the max continuous current, or the inverter power in kW.' };
  const fuse = batteryFuse({ current: I });
  const size = length ? dcCableSize({ current: I, length, volts, targetPct, temp, needAmps: fuse && fuse.fuse ? fuse.fuse : I * 1.25, cable }) : null;
  return { ok: true, current: r2(I), fuse, size, fromKw: !(Number(current) > 0) };
}
