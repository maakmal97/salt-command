#!/usr/bin/env node
/* tools/gazfetch.mjs — THE PLACE LIST, FETCHED ONCE AND COMMITTED HASHED (v633, 14 Sep 2026).
 *
 * HIS DECISION OF 14 SEP 2026: a party's place reaches the map automatically from what is typed at Add ID and Amend ID,
 * from a Malaysian place list built into the desk and stored hashed, and a place it cannot find is tapped on the map.
 *
 * THE SOURCE IS GEONAMES (CC BY 4.0): every populated place and locality it lists in Selangor, Kuala Lumpur, Negeri
 * Sembilan and Putrajaya, under each of its Latin spellings. The official area names are not needed here: they are on
 * the map already, public, and the phone tries them first.
 *
 * STORED HASHED, AND WHY. The public desk may carry no place from the directory, and a list of every place in the core
 * states holds most of them in plain text. So each name is kept as the first seven hex characters of SHA-256 over its
 * placeKey (engine/position.mjs, the rule the phone applies to what is typed), beside its point to 0.01 degrees, about
 * a kilometre. A name that stands for places more than 3 km apart is kept as ambiguous, and the phone asks for a tap.
 * THIS LIST IS BUILT FROM GEONAMES ALONE, NEVER FROM THE DIRECTORY: hard rule 3 forbids committing the directory in any
 * form, hashed included.
 *
 * Run by hand when the source moves; never by CI and never by the build.
 *   node tools/gazfetch.mjs              fetch MY.zip from GeoNames and write geo/gazetteer.json
 *   node tools/gazfetch.mjs --from FILE  read MY.zip or MY.txt from disk instead
 *   --out FILE                            write there instead of geo/gazetteer.json, as the suite does with a fixture
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import E from "../engine/position.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const URL = "https://download.geonames.org/export/dump/MY.zip";
const ADMIN1 = { "12": "Selangor", "14": "Kuala Lumpur", "05": "Negeri Sembilan", "17": "Putrajaya" };   // GeoNames' own codes
const APART = 0.03;                                  // degrees, about 3 km: further apart than this, a name is ambiguous
const HEX = 7;

const argv = process.argv.slice(2), opt = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null);
const from = opt("--from"), OUT = opt("--out") || resolve(REPO, "geo", "gazetteer.json");
/* the one file wanted out of the archive, read through its central directory */
function unzip(buf, name) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip archive");
  let p = buf.readUInt32LE(e + 16);
  for (let n = buf.readUInt16LE(e + 10); n > 0; n--) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const fname = buf.toString("utf8", p + 46, p + 46 + nl);
    if (fname === name) {
      const data = buf.subarray(off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28) + size);
      return method === 8 ? inflateRawSync(data) : data;
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error(`${name} is not in the archive`);
}
let text;
if (from && /\.txt$/i.test(from)) text = readFileSync(from, "utf8");
else {
  let buf;
  if (from) buf = readFileSync(from);
  else { const r = await fetch(URL); if (!r.ok) { console.error(`  FAIL  ${r.status} fetching ${URL}`); process.exit(1); } buf = Buffer.from(await r.arrayBuffer()); }
  text = unzip(buf, "MY.txt").toString("utf8");
}

const points = new Map();   // key -> [lat, lng], or 0 when it names places far apart
const add = (key, lat, lng) => {
  if (!key || key.length < 3 || !/[a-z]/.test(key)) return;
  const pt = [Math.round(lat * 100) / 100, Math.round(lng * 100) / 100], cur = points.get(key);
  if (cur === undefined) points.set(key, pt);
  else if (cur && Math.hypot(cur[0] - pt[0], cur[1] - pt[1]) > APART) points.set(key, 0);
};
let places = 0;
for (const line of text.split("\n")) {
  const c = line.split("\t");
  if (c.length < 11 || !ADMIN1[c[10]] || !(c[6] === "P" || c[7] === "LCTY")) continue;
  places++;
  const lat = +c[4], lng = +c[5];
  for (const nm of [c[1], c[2], ...(c[3] ? c[3].split(",") : [])]) {
    if (!/^[\x20-\x7e]+$/.test(nm)) continue;           // Latin spellings only: what is typed on the form
    const k = E.placeKey(nm);
    add(k, lat, lng); add(E.placeBare(k), lat, lng);
  }
}
/* PACKED: seven hex characters of the hash, then the point as two base-36 pairs, latitude less 1.00 and longitude less
   99.00 in hundredths; "zzzz" is a name that stands for more than one place. Two names sharing a hash are ambiguous too. */
const byHash = new Map();
for (const [k, pt] of points) {
  const h = createHash("sha256").update(k).digest("hex").slice(0, HEX), cur = byHash.get(h);
  byHash.set(h, cur === undefined ? pt : (cur && pt && Math.hypot(cur[0] - pt[0], cur[1] - pt[1]) <= APART ? cur : 0));
}
const b36 = (v) => Math.max(0, Math.min(1295, v)).toString(36).padStart(2, "0");
const packed = [...byHash.keys()].sort().map((h) => { const pt = byHash.get(h); return h + (pt ? b36(Math.round(pt[0] * 100) - 100) + b36(Math.round(pt[1] * 100) - 9900) : "zzzz"); }).join("");
const ambiguous = [...byHash.values()].filter((v) => v === 0).length;
const out = {
  what: "Where a typed place is: GeoNames' populated places and localities in the core states, hashed, for Add ID and Amend ID.",
  source: "GeoNames, the Malaysia extract",
  url: URL,
  licence: "CC BY 4.0",
  attribution: "Places: GeoNames, CC BY 4.0",
  fetchedOn: new Date().toISOString().slice(0, 10),
  states: Object.values(ADMIN1),
  places,
  names: byHash.size,
  ambiguous,
  packing: `${HEX} hex characters of SHA-256 over placeKey, then latitude less 1.00 and longitude less 99.00 in hundredths as two base-36 pairs; zzzz is ambiguous`,
  packed,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`  ok    ${places} places, ${byHash.size} names (${ambiguous} ambiguous), ${(packed.length / 1024).toFixed(1)} KB packed -> ${OUT}`);
