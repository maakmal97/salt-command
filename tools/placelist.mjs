#!/usr/bin/env node
/* tools/placelist.mjs — THE LOCATIONS TO CHOOSE FROM AT ADD ID AND AMEND ID (v682, his instruction of 17 Sep 2026).
 *
 * "I want all the location listed as a list, so I can choose the location." His choice of what the list holds: his own
 * areas. This file is two of its sources, stated as he gave them: the 42 neighbourhoods printed on his map of Kuala Lumpur
 * (shared 17 Sep 2026), and the sub-districts of Selangor's districts from the list he pasted the same day. The desk adds
 * the localities already filed and every constituency, which it holds already.
 *
 * EACH NAME IS PLACED FROM GEONAMES' MALAYSIA FILE (MY.txt out of MY.zip, CC BY 4.0), downloaded by hand on his word and
 * never committed: the rows whose name, ASCII name or any alternate name reads the same, inside the district it was listed
 * under, else inside its state, by the boundaries in geo/areas.json rather than GeoNames' own state codes (which file
 * Setapak under Selangor). A populated place is preferred, then a locality, then anything else; a bigger population breaks
 * a tie; rows of the top kind spread over more than about five kilometres with nothing to choose between them leave the
 * name ambiguous. A constituency or district of the same name in that state gives its label point. A name placed by none
 * of these is left off and named in `unresolved`, never guessed. A name already placed in another state is not placed
 * twice (he listed Setapak and Sungai Besi under Selangor, and both lie in Kuala Lumpur). Points to 0.01 degrees.
 *
 *   node tools/placelist.mjs --from <MY.txt>   write geo/placelist.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import POSITION from "../engine/position.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(REPO, "geo", "placelist.json");
const FROM = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : null;
if (!FROM) { console.error("  FAIL  --from <MY.txt> is required: GeoNames' Malaysia file, unzipped"); process.exit(1); }

/* his map of Kuala Lumpur, the grey neighbourhood names, as printed ("Kentonmen" is the map's spelling) */
const KUALA_LUMPUR = [
  "Kepong Baru", "Jinjang", "Taman Wahyu", "Batu Muda", "Taman Melati", "Danau Kota", "Setapak", "Sri Rampai", "Ayer Panas", "Semarak", "Kentonmen", "Sentul",
  "Manjalara", "Mont Kiara", "Duta", "Bukit Tunku", "Sungai Penchala", "Bukit Damansara", "TTDI",
  "Chow Kit", "Kampung Baru", "Datuk Keramat", "KLCC", "Ampang Hilir", "Pandan", "Pudu", "Maluri", "Shamelin",
  "Bangsar", "Brickfields", "Bandar Malaysia", "Taman Desa", "Kuchai", "Salak",
  "Sri Permaisuri", "Taman Midah", "Connaught", "Sungai Besi", "Alam Damai",
  "Taman OUG", "Sri Petaling", "Bukit Jalil",
];
/* his list of Selangor's sub-districts, district by district as he pasted it; the survey spells two districts Ulu */
const SELANGOR = {
  Gombak: ["Ulu Klang", "Ampang", "Setapak", "Batu Caves", "Selayang", "Rawang", "Taman Templer", "Sungai Buloh", "Kundang", "Batu 20", "Kampung Sungai Pusu"],
  "Ulu Langat": ["Kajang", "Beranang", "Cheras", "Hulu Langat", "Hulu Semenyih", "Kelanang", "Tanjong 12", "Tarun", "Sungai Makau", "Sungai Lui", "Sungai Kembong Beranang",
    "Sri Nanding", "Simpang Balak", "Rumah Murah Sungai Lui", "Kampung Sungai Tangkas", "Kacau", "Kampung Pasir Batu 14 Semenyih", "Desa Raya", "Sungai Raya", "Batu 26", "Batu 23"],
  "Ulu Selangor": ["Kuala Kubu Bharu", "Sungai Chick", "Ulu Yam", "Ulu Yam Baru", "Kerling", "Kuala Kalumpang", "Sungai Gumut", "Serendah", "Peretak", "Sungai Choh", "Bukit Beruntung", "Bukit Sentosa"],
  Klang: ["Klang", "Kapar", "Bukit Raja", "Port Klang", "Pandamaran", "Telok Menegun", "Taman Sri Muda", "Kota Kemuning", "Bukit Kemuning", "Batu 4"],
  "Kuala Langat": ["Bandar Saujana Putra", "Jenjarom", "Kanchong Darat", "Sijangkang", "Tongkah", "Teluk Datok", "Telok", "Sungai Raba", "Morib", "Permatang Pasir", "Kelanang Batu 6",
    "Kanchong", "Chodoi", "Bukit Changgang", "Batu", "Jugra"],
  "Kuala Selangor": ["Api-api", "Kuala Selangor", "Bukit Melawati", "Ijok", "Kampung Kuantan", "Kuala Sungai Buloh", "Pasangan", "Ulu Tinggi", "Ujong Permatang", "Tambak Jawa", "Taman PKNS",
    "Sungai Sembilang", "Simpang 3 Ijok", "Pasir Penambang", "Simpang 3", "Parit Mahang", "Kampung Baru Hulu Tiram Buruk", "Bukit Talang", "Bukit Belimbing"],
  Petaling: ["Petaling Jaya", "Subang Jaya", "Shah Alam", "Damansara", "Bandar Sri Damansara", "Country Heights", "Puchong", "Puchong Jaya", "Puchong Perdana", "Batu Tiga", "Sungai Besi",
    "Serdang", "Glenmarie", "Penaga", "Merbau Sempak", "Kayu Ara", "Desa Puchong"],
  "Sabak Bernam": ["Sabak", "Sungai Besar", "Sekinchan"],
  Sepang: ["Puchong", "Bukit Puchong 2", "16 Sierra", "Taman Putra Prima", "Taman Mas", "Taman Putra Perdana", "Taman Meranti Jaya", "Pulau Meranti", "Cyberjaya", "Dengkil", "Beranang", "Salak Tinggi"],
};

const A = JSON.parse(readFileSync(resolve(REPO, "geo", "areas.json"), "utf8"));
function decodeRing(s) {
  const out = []; let i = 0, x = 0, y = 0;
  const num = () => { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < s.length) { x += num(); y += num(); out.push([x / 5e3, y / 5e3]); }
  return out;
}
function inRing(pt, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const RINGS = new Map(A.districts.map((d) => [d.id, d.rings.map(decodeRing)]));
const inDistrict = (d, lat, lng) => RINGS.get(d.id).reduce((c, r) => (inRing([lng, lat], r) ? !c : c), false);
const r2 = (v) => Math.round(v * 100) / 100;
const keys = (n) => { const k = POSITION.placeKey(n); return [k, POSITION.placeBare(k)]; };

/* GeoNames, indexed by every Latin-script name a row answers to */
const RANK = { P: 0, L: 1 };
const byKey = new Map();
for (const line of readFileSync(FROM, "utf8").split("\n")) {
  const c = line.split("\t");
  if (c.length < 15) continue;
  const row = { lat: +c[4], lng: +c[5], cls: c[6], pop: +c[14] || 0 };
  const names = new Set([c[1], c[2], ...String(c[3] || "").split(",")].filter((x) => x && /^[\x20-\x7e]+$/.test(x)));
  for (const n of names) for (const k of keys(n)) { if (!k) continue; if (!byKey.has(k)) byKey.set(k, new Set()); byKey.get(k).add(row); }
}

function place(name, state, districtName) {
  const rows = [...new Set(keys(name).flatMap((k) => [...(byKey.get(k) || [])]))];
  const inState = A.districts.filter((d) => d.state === state), listed = inState.find((d) => d.name === districtName);
  for (const pool of [listed ? [listed] : null, inState].filter(Boolean)) {
    const here = rows.filter((r) => pool.some((d) => inDistrict(d, r2(r.lat), r2(r.lng))));   // the point as the desk will hold it
    if (!here.length) continue;
    const best = Math.min(...here.map((r) => RANK[r.cls] ?? 2));
    const top = here.filter((r) => (RANK[r.cls] ?? 2) === best).sort((p, q) => q.pop - p.pop);
    if (top[0].pop > 0 && top[0].pop > (top[1] ? top[1].pop : 0)) return [r2(top[0].lat), r2(top[0].lng)];
    const lats = top.map((r) => r.lat), lngs = top.map((r) => r.lng);
    if (Math.max(...lats) - Math.min(...lats) <= 0.05 && Math.max(...lngs) - Math.min(...lngs) <= 0.05) {
      return [r2(lats.reduce((a, b) => a + b, 0) / lats.length), r2(lngs.reduce((a, b) => a + b, 0) / lngs.length)];
    }
    return "ambiguous";
  }
  const own = (x) => POSITION.placeKey(x) === POSITION.placeKey(name);
  const seat = A.areas.find((a) => own(a.short) && A.districts.find((d) => d.id === a.district).state === state);
  if (seat) return [r2(seat.label[1]), r2(seat.label[0])];
  const dist = inState.find((d) => own(d.name));
  return dist ? [r2(dist.label[1]), r2(dist.label[0])] : null;
}

const names = [], unresolved = [], placedKeys = new Set();
const take = (n, state, district) => {
  const k = POSITION.placeKey(n);
  if (placedKeys.has(k)) return;
  const p = place(n, state, district);
  if (Array.isArray(p)) { names.push({ n, p }); placedKeys.add(k); }
  else unresolved.push(`${n} (${district || state}${p === "ambiguous" ? ", more than one" : ""})`);
};
KUALA_LUMPUR.forEach((n) => take(n, "Kuala Lumpur", "Kuala Lumpur"));
for (const [district, list] of Object.entries(SELANGOR)) list.forEach((n) => take(n, "Selangor", district));

const out = {
  what: "Locations to choose from at Add ID and Amend ID: his map of Kuala Lumpur's neighbourhoods and his list of Selangor's sub-districts, each placed from GeoNames inside the district it was listed under.",
  sources: ["His map of Kuala Lumpur, shared 17 Sep 2026", "His list of Selangor's sub-districts, 17 Sep 2026", "GeoNames, CC BY 4.0, MY.zip fetched 17 Sep 2026"],
  names,
  unresolved,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`  ok    ${names.length} locations placed, ${unresolved.length} left off: ${unresolved.join(", ") || "none"}`);
