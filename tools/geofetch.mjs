#!/usr/bin/env node
/* tools/geofetch.mjs — FETCH THE BASEMAP, ONCE, AND COMMIT IT (v349, 24 Aug 2026).
 *
 * WHY THIS EXISTS. The map had no outline at all, by a decision taken at v149: the desk loads
 * nothing at runtime, so there was no basemap to be had, and a coastline drawn from memory
 * would have been a fabricated fact on a page whose whole claim is that its figures are
 * checked. That reasoning was right about INVENTING geometry and wrong about the conclusion.
 * Real geometry can be fetched ONCE, here, checked, simplified, committed with its provenance
 * and then inlined like everything else. The runtime rule is untouched: the desk still fetches
 * nothing. This tool is run by hand when the source moves, never by CI and never by the build.
 *
 * THE SOURCE IS OPENSTREETMAP, VIA geoBoundaries, UNDER ODbL 1.0. That licence asks for
 * attribution wherever the data is shown, and /desk is served publicly, so the credit is
 * printed under the map rather than buried here. DOSM Malaysia publishes the same boundaries
 * and was the first choice, but its repository carries no licence file at all and GitHub reads
 * it as NOASSERTION, so it is not committed into a private ledger on a guess.
 *
 * WHAT IT KEEPS. Four features and no more: Kuala Lumpur, which IS the frame; Selangor, which
 * wraps it and carries the Strait coastline on its western edge for a wider view; Putrajaya,
 * just south; and Negeri Sembilan, because CY2-NIL sits in it at Nilai.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PIN = "9469f09";                       // pinned release, so a re-run is reproducible
const URL = `https://github.com/wmgeolab/geoBoundaries/raw/${PIN}/releaseData/gbOpen/MYS/ADM1/geoBoundaries-MYS-ADM1.geojson`;

/* what to keep, and how hard to simplify each. KL is the outline the eye reads, so it keeps
   its detail; the rest are context and are thinned until they are cheap. Tolerance is in
   degrees: 0.0005 is about 55m here, 0.004 about 440m. */
const KEEP = [
  { match: "Kuala Lumpur",    name: "Kuala Lumpur",    kind: "territory", tol: 0.0005 },
  { match: "Putrajaya",       name: "Putrajaya",       kind: "territory", tol: 0.0008 },
  { match: "Selangor",        name: "Selangor",        kind: "state",     tol: 0.0040 },
  { match: "Negeri Sembilan", name: "Negeri Sembilan", kind: "state",     tol: 0.0040 },
];
const DP = 4;                                 // 4 decimal places is about 11m; the canvas is coarser

/* Douglas-Peucker. Plain perpendicular distance in degrees, which is fine three degrees off
   the equator where a degree of longitude is within 0.2% of a degree of latitude. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = -1, best = tol;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = len > 0 ? Math.abs(dy * px - dx * py + bx * ay - by * ax) / len : Math.hypot(px - ax, py - ay);
      if (d > best) { best = d; far = i; }
    }
    if (far > 0) { keep[far] = true; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const round = (pts) => pts.map(([x, y]) => [+x.toFixed(DP), +y.toFixed(DP)]);
/* a ring too small to be a pixel on an 820px canvas is dropped rather than drawn as a dot */
const spanOf = (r) => {
  const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};

const res = await fetch(URL);
if (!res.ok) { console.error(`  FAIL  ${res.status} fetching ${URL}`); process.exit(1); }
const gj = await res.json();

const features = [];
for (const k of KEEP) {
  const f = gj.features.find((x) => String(x.properties.shapeName || "").includes(k.match));
  if (!f) { console.error(`  FAIL  ${k.match} is not in the source`); process.exit(1); }
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const poly of polys) for (const ring of poly) {
    const s = round(simplify(ring, k.tol));
    if (s.length >= 4 && spanOf(s) >= 0.003) rings.push(s);
  }
  const before = polys.reduce((a, p) => a + p.reduce((b, r) => b + r.length, 0), 0);
  const after = rings.reduce((a, r) => a + r.length, 0);
  console.log(`  ok    ${k.name.padEnd(16)} ${String(after).padStart(5)} points from ${before}, ${rings.length} ring(s)`);
  features.push({ name: k.name, kind: k.kind, tolerance: k.tol, rings });
}

const out = {
  what: "Administrative outlines for the Klang Valley and its neighbours, for the desk's Map tab.",
  source: "geoBoundaries gbOpen MYS ADM1, derived from OpenStreetMap",
  sourceUrl: URL,
  pinnedRelease: PIN,
  yearRepresented: 2017,
  licence: "ODbL 1.0",
  attribution: "Boundaries © OpenStreetMap contributors, ODbL 1.0",
  attributionUrl: "https://www.openstreetmap.org/copyright",
  fetchedOn: new Date().toISOString().slice(0, 10),
  precisionDp: DP,
  note: "Simplified per feature by Douglas-Peucker at the stated tolerance in degrees, then rounded. Rings spanning under 0.003 degrees are dropped: they are smaller than a pixel on the drawn canvas. Re-fetch with `node tools/geofetch.mjs`; it is never run by CI or by the build.",
  features,
};
const path = resolve(REPO, "geo", "basemap.json");
writeFileSync(path, JSON.stringify(out, null, 1) + "\n");
const kb = (JSON.stringify(out).length / 1024).toFixed(1);
console.log(`\nBASEMAP OK: ${features.length} features, ${kb} KB -> geo/basemap.json`);
