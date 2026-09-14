#!/usr/bin/env node
/* tools/geosync.mjs — THE GEOGRAPHY IS DATA, AND THE MASTER CARRIES A COPY (v349, 24 Aug 2026).
 *
 * The third of these, after tools/engine.mjs and tools/booksync.mjs, and it works the same way
 * for the same reason. The desk is one self-contained page that must open from disk and load
 * nothing, so it cannot import a module or fetch a file. What it can do is carry a copy that is
 * PROVED to be the file rather than trusted to be: --sync writes it, --check fails if the block
 * in the master is not what these two files say, and CI runs --check.
 *
 *   geo/basemap.json   the drawn outlines, fetched once by tools/geofetch.mjs, with provenance
 *   geo/places.json    the gazetteer: PLACES, METRO, NON_PLACE, PLACEHOLDER, LOCS, and NOTES
 *   geo/areas.json     v630: the districts and the mukim, bandar and pekan, named, fetched once by
 *                      tools/areafetch.mjs
 *
 * NOTES comes back as comments above its declaration, the same trick booksync uses, so the prose
 * that explains a decision sits where a reader meets it and still lives in the data file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = process.env.SALT_MASTER || resolve(REPO, "master", "salt_command.html");
const OPEN = "/* ==== GEO: generated from geo/basemap.json, geo/places.json and geo/areas.json by tools/geosync.mjs. Edit those, never this block. ==== */";
const SHUT = "/* ==== END GEO ==== */";
const KEYS = ["PLACES", "METRO", "NON_PLACE", "PLACEHOLDER", "LOCS"];

const read = (p) => JSON.parse(readFileSync(resolve(REPO, p), "utf8"));

/* one record per line for the rings, so a diff on a boundary is readable and a stray point is
   visible. Everything else is compact: it is a lookup, not a series. */
function renderBasemap(b) {
  const feats = b.features.map((f) => {
    const rings = f.rings.map((r) => "    [" + r.map(([x, y]) => `[${x},${y}]`).join(",") + "]").join(",\n");
    /* NO NAME REACHES THE MASTER. geo/basemap.json keeps it, for whoever maintains the file.
       public/desk.html is served publicly and the map draws no label, so a territory name in
       the inlined block would be a string nobody renders sitting on a public page, and one of
       them could collide with a locality in the directory. The desk draws by kind. */
    return `  {kind:${JSON.stringify(f.kind)},rings:[\n${rings}\n  ]}`;
  }).join(",\n");
  return `/* ============ THE BASEMAP (v349) ============
   ${b.what}
   Source: ${b.source}, ${b.yearRepresented}, pinned at ${b.pinnedRelease}, fetched ${b.fetchedOn}.
   Licence: ${b.licence}. ${b.attribution}. The credit is printed under the map, which is what
   that licence asks for and where a reader can see it.
   ${b.note}
   FETCHED ONCE AND COMMITTED, so the runtime rule is untouched: the desk still loads nothing.
   Re-fetch with \`node tools/geofetch.mjs\`; it is never run by CI or by the build. */
const BASEMAP_META=${JSON.stringify({ source: b.source, licence: b.licence, attribution: b.attribution, attributionUrl: b.attributionUrl, year: b.yearRepresented, fetchedOn: b.fetchedOn })};
const BASEMAP=[
${feats}
];`;
}
function renderPlaces(p) {
  return KEYS.map((k) => {
    const notes = (p.NOTES && p.NOTES[k]) || [];
    const cmt = notes.length ? notes.map((n) => `/* ${n} */`).join("\n") + "\n" : "";
    return cmt + `const ${k}=${JSON.stringify(p[k])};`;
  }).join("\n");
}
/* v630: one area a line, so a re-fetch diffs by area. NAMED, unlike the basemap, on his decision of 14 Sep
   2026 that area names show on the map; a party's name still never does. */
function renderAreas(a) {
  return `/* ============ THE AREAS (v630) ============
   ${a.what}
   ${a.sources.map((s) => `${s.source}, ${s.licence}.`).join("\n   ")}
   Pinned at ${a.pinnedRelease}, fetched ${a.fetchedOn}; ${a.encoding}. Re-fetch with
   \`node tools/areafetch.mjs\`, by hand; it is never run by CI or by the build. */
const AREAS_META=${JSON.stringify({ attribution: a.sources.map((s) => s.attribution), fetchedOn: a.fetchedOn })};
const DISTRICTS=[
${a.districts.map(({ state, ...d }) => "  " + JSON.stringify(d)).join(",\n")}
];
const AREAS=[
${a.areas.map((x) => "  " + JSON.stringify(x)).join(",\n")}
];`;
}
/* a district's state stays in geo/areas.json and is not rendered: the map draws the states from BASEMAP and names none */
function block() {
  return [OPEN, renderBasemap(read("geo/basemap.json")), renderPlaces(read("geo/places.json")), renderAreas(read("geo/areas.json")), SHUT].join("\n");
}
export function checkText(src) {
  const a = src.indexOf(OPEN), b = src.indexOf(SHUT);
  if (a < 0 || b < 0) return "the master has no GEO block";
  const have = src.slice(a, b + SHUT.length);
  return have === block() ? null : "the master's GEO block is not geo/basemap.json + geo/places.json";
}

const mode = process.argv[2] || "--check";
const src = readFileSync(MASTER, "utf8");
if (mode === "--sync") {
  const a = src.indexOf(OPEN), b = src.indexOf(SHUT);
  if (a < 0 || b < 0) { console.error("  FAIL  the master has no GEO block; add the two markers first"); process.exit(1); }
  const next = src.slice(0, a) + block() + src.slice(b + SHUT.length);
  writeFileSync(MASTER, next);
  const bm = read("geo/basemap.json");
  const pts = bm.features.reduce((t, f) => t + f.rings.reduce((s, r) => s + r.length, 0), 0);
  console.log(`  ok    the geography is in the master: ${bm.features.length} outlines, ${pts} points, ${KEYS.length} gazetteer keys`);
} else {
  const why = checkText(src);
  if (why) { console.error(`  FAIL  ${why}. Run \`node tools/geosync.mjs --sync\`.`); process.exit(1); }
  console.log("  ok    the master's GEO block is geo/basemap.json and geo/places.json, byte for byte");
}
