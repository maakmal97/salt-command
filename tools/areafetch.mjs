#!/usr/bin/env node
/* tools/areafetch.mjs — FETCH THE DISTRICTS AND THE MUKIM, ONCE, AND COMMIT THEM (v630, 14 Sep 2026).
 *
 * HIS INSTRUCTION OF 14 SEP 2026: the map shades areas the way a council map does, named, with the
 * districts first and the finer areas a tap away. geofetch.mjs brought four state outlines and no
 * names; this brings the areas a heat map is drawn in.
 *
 * TWO LEVELS FROM THE SAME PINNED geoBoundaries RELEASE AS THE BASEMAP:
 *   districts  ADM2, every district of Peninsular Malaysia (geoBoundaries from citypopulation.de,
 *              CC BY 3.0), thinned hard outside the core states, where they are context.
 *   areas      ADM3 inside the core states: the official mukim, bandar and pekan (Wikimedia Commons
 *              via geoBoundaries, CC BY 4.0), each nested under the district that holds its centre.
 * Both licences ask for attribution where the data is shown, and /desk is public, so the credit is
 * printed under the map. The names are kept, on his decision of 14 Sep 2026 that area names show.
 *
 * KUALA LUMPUR BY ITS ELEVEN CONSTITUENCIES (v678, his decision of 17 Sep 2026). ADM3 gives the territory
 * ten coarse areas where thirty of the desk's parties stand, so a tap on it said nothing. Its areas are the
 * federal constituencies of the 2018 delimitation instead, in force since GE14, from the Malaysian Election
 * Corpus (Thevananthan and Chacko), CC0, pinned to a commit. The same names the city's own map prints.
 *
 * Run by hand when the source moves; never by CI and never by the build. The desk still loads
 * nothing at runtime: tools/geosync.mjs inlines geo/areas.json into the master.
 *
 *   node tools/areafetch.mjs              fetch the three files and write geo/areas.json
 *   node tools/areafetch.mjs --from DIR   read MYS-ADM1.geojson, MYS-ADM2.geojson, MYS-ADM3.geojson and
 *                                         peninsular_2018_parlimen.geojson from DIR
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PIN = "9469f09";                                   // the basemap's release, so the levels agree
const url = (L) => `https://github.com/wmgeolab/geoBoundaries/raw/${PIN}/releaseData/gbOpen/MYS/${L}/geoBoundaries-MYS-${L}.geojson`;
const SEATS_PIN = "2a720dd0c8839fb58756a4c6028ff42cd7b85734";
const SEATS = "peninsular_2018_parlimen.geojson";
const seatsUrl = `https://raw.githubusercontent.com/Thevesh/paper-meco-maps/${SEATS_PIN}/data/geojson/delimitations/${SEATS}`;
const CORE = ["Selangor", "Kuala Lumpur", "Putrajaya", "Negeri Sembilan"];
const ISLANDS = ["Sabah", "Sarawak", "Labuan"];          // not Peninsular Malaysia
const TOL = { core: 0.002, context: 0.006, area: 0.0012 }; // degrees; 0.001 is about 110 m
const Q = 5e3;                                           // stored to 2e-4 degrees, about 22 m: finer than a pixel at any zoom the desk draws

const argv = process.argv.slice(2), from = argv.includes("--from") ? argv[argv.indexOf("--from") + 1] : null;
async function load(L) {
  if (from) return JSON.parse(readFileSync(join(from, L === "SEATS" ? SEATS : `MYS-${L}.geojson`), "utf8")).features;
  const u = L === "SEATS" ? seatsUrl : url(L), r = await fetch(u);
  if (!r.ok) { console.error(`  FAIL  ${r.status} fetching ${u}`); process.exit(1); }
  return (await r.json()).features;
}

const polys = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);
function inRing(pt, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const inPolys = (pt, ps) => ps.some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
function largestRing(ps) { let best = ps[0][0]; for (const p of ps) if (p[0].length > best.length) best = p[0]; return best; }
function centroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[i], k = x0 * y1 - x1 * y0;
    a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : ring[0];
}
/* Douglas-Peucker, as geofetch.mjs */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1, best = tol;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = len > 0 ? Math.abs(dy * px - dx * py + bx * ay - by * ax) / len : Math.hypot(px - ax, py - ay);
      if (d > best) { best = d; far = i; }
    }
    if (far > 0) { keep[far] = true; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/* A RING IS AN ENCODED POLYLINE, the published algorithm maps use: each step from the point before, in 2e-4
   degrees, zigzagged and written five bits a character from "?". A step is a character or two, so 19,000
   points cost about 60 KB where coordinates cost 400. decodeRing in the master reads it back, longitude first. */
function encodeRing(pts) {
  let out = "", px = 0, py = 0;
  const num = (v) => { let s = v < 0 ? ~(v << 1) : v << 1; while (s >= 0x20) { out += String.fromCharCode((0x20 | (s & 0x1f)) + 63); s >>= 5; } out += String.fromCharCode(s + 63); };
  for (const [x, y] of pts) { const qx = Math.round(x * Q), qy = Math.round(y * Q); num(qx - px); num(qy - py); px = qx; py = qy; }
  return out;
}
const spanOf = (r) => { const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); };
function rings(f, tol, minSpan) {
  const out = [];
  for (const p of polys(f)) for (const r of p) { const s = simplify(r, tol); if (s.length >= 4 && spanOf(s) >= minSpan) out.push(encodeRing(s)); }
  return out;
}
/* WHERE A NAME SITS: the inside point furthest from the edge, found on a grid and refined once, so a label
   never lands outside a crescent-shaped area the way a centroid can */
function labelPoint(f) {
  const ps = polys(f), ring = largestRing(ps);
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const edge = (pt) => { let m = Infinity; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / L2)) : 0;
    m = Math.min(m, Math.hypot(pt[0] - ax - t * dx, pt[1] - ay - t * dy)); } return m; };
  let best = centroid(ring), bestD = inPolys(best, ps) ? edge(best) : -1;
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let pass = 0; pass < 2; pass++) {
    const nx = 24, ny = 24;
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      const pt = [x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny];
      if (!inPolys(pt, ps)) continue;
      const d = edge(pt); if (d > bestD) { bestD = d; best = pt; }
    }
    const wx = (x1 - x0) / nx, wy = (y1 - y0) / ny;
    x0 = best[0] - wx; x1 = best[0] + wx; y0 = best[1] - wy; y1 = best[1] + wy;
  }
  return [Math.round(best[0] * Q) / Q, Math.round(best[1] * Q) / Q];
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const title = (s) => String(s).toLowerCase().replace(/(^|[\s,(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const KINDS = { mukim: "mukim", bandar: "bandar", pekan: "pekan" };

const [A1, A2, A3, SEAT] = [await load("ADM1"), await load("ADM2"), await load("ADM3"), await load("SEATS")];
const stateOf = (pt) => { const s = A1.find((f) => inPolys(pt, polys(f))); return s ? s.properties.shapeName : null; };
const districts = [];
for (const f of A2) {
  const state = stateOf(centroid(largestRing(polys(f))));
  if (!state || ISLANDS.some((x) => state.includes(x))) continue;
  const core = CORE.some((x) => state.includes(x));
  districts.push({ id: slug(f.properties.shapeName), name: f.properties.shapeName, state, core, label: labelPoint(f),
    rings: rings(f, core ? TOL.core : TOL.context, core ? 0.004 : 0.02), _f: f });
}
const ids = new Set(); for (const d of districts) { if (ids.has(d.id)) { console.error(`  FAIL  two districts slug to ${d.id}`); process.exit(1); } ids.add(d.id); }
const coreStates = A1.filter((f) => CORE.some((x) => f.properties.shapeName.includes(x)));
const areas = [];
for (const f of A3) {
  const c = centroid(largestRing(polys(f)));
  if (!coreStates.some((s) => inPolys(c, polys(s)))) continue;
  const d = districts.find((x) => x.core && inPolys(c, polys(x._f)));
  if (!d) { console.error(`  FAIL  no core district holds ${f.properties.shapeName}`); process.exit(1); }
  if (d.id === "kuala-lumpur") continue;                  // its areas are its constituencies, below
  const raw = String(f.properties.shapeName).trim(), first = raw.split(/\s+/)[0].toLowerCase();
  const kind = KINDS[first] || "", short = KINDS[first] ? title(raw.slice(first.length).trim()) : title(raw);   // the full name is the kind and the short one
  const rs = rings(f, TOL.area, 0.0005);
  if (!rs.length) continue;                               // smaller than a pixel when zoomed in
  areas.push({ id: d.id + "/" + (areas.filter((a) => a.district === d.id).length + 1), short, kind, district: d.id, label: labelPoint(f), rings: rs });
}
const kl = SEAT.filter((f) => f.properties.state === "W.P. Kuala Lumpur");
if (kl.length !== 11) { console.error(`  FAIL  ${kl.length} Kuala Lumpur constituencies in the source, not 11`); process.exit(1); }
for (const f of kl) {
  const short = String(f.properties.parlimen).replace(/^P\.\d+\s+/, "").trim();
  areas.push({ id: "kuala-lumpur/" + (areas.filter((a) => a.district === "kuala-lumpur").length + 1), short, kind: "", district: "kuala-lumpur", label: labelPoint(f), rings: rings(f, TOL.area, 0.0005) });
}
for (const d of districts) delete d._f;

const out = {
  what: "The districts of Peninsular Malaysia, and the mukim, bandar and pekan of the core states with Kuala Lumpur by its constituencies, for the desk's Coverage page.",
  sources: [
    { level: "district", source: "geoBoundaries gbOpen MYS ADM2, from citypopulation.de", url: url("ADM2"), licence: "CC BY 3.0", attribution: "Districts: geoBoundaries, citypopulation.de, CC BY 3.0" },
    { level: "area", source: "geoBoundaries gbOpen MYS ADM3, from Wikimedia Commons", url: url("ADM3"), licence: "CC BY 4.0", attribution: "Mukim, bandar and pekan: geoBoundaries, Wikimedia Commons, CC BY 4.0" },
    { level: "area", source: "Malaysian Election Corpus, the 2018 federal delimitation, Kuala Lumpur", url: seatsUrl, licence: "CC0 1.0", attribution: "Kuala Lumpur constituencies: MECo, Thevananthan and Chacko, CC0" },
  ],
  pinnedRelease: PIN,
  fetchedOn: new Date().toISOString().slice(0, 10),
  encoding: "each ring is an encoded polyline at 2e-4 degrees, longitude before latitude",
  tolerances: TOL,
  core: CORE,
  districts,
  areas,
};
const path = resolve(REPO, "geo", "areas.json");
writeFileSync(path, JSON.stringify(out) + "\n");
const pts = (xs) => xs.reduce((t, x) => t + x.rings.reduce((s, r) => s + decodeRing(r).length, 0), 0);
function decodeRing(s) {
  const out = []; let i = 0, x = 0, y = 0;
  const num = () => { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < s.length) { x += num(); y += num(); out.push([x / Q, y / Q]); }
  return out;
}
console.log(`  ok    ${districts.length} districts (${districts.filter((d) => d.core).length} core), ${pts(districts)} points`);
console.log(`  ok    ${areas.length} areas in the core states, ${pts(areas)} points`);
console.log(`\nAREAS OK: ${(JSON.stringify(out).length / 1024).toFixed(1)} KB -> geo/areas.json`);
