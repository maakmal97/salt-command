/* test/place-field.mjs: ONE PLACE FIELD (17 Nov 2026, his yes to the five answers of docs/plan-place-field.html). Each check red under its own
 * mutation (test/place-field.mutations.json, tools/section.mjs). The figures expected are worked by hand in the comments, never by the code under test.
 *   R1  a point in degrees, minutes and seconds reads in either order, and degrees with decimals and their letters read too
 *   R2  two figures apart by a space alone are a pin
 *   R3  a full plus code reads to its cell's centre, and a short one is read from Kuala Lumpur, across a degree line too
 *   R4  the Counter's reader and Salt Admin's give the Desk's reading on every case
 *   L1  a point on a listed locality files with that locality, one outside every district with none, and Salt Admin's copy agrees with the Desk
 *   A1  on Add ID a point put in Where fills Locality and says so, and a locality he typed himself stands */
import { webcrypto } from "node:crypto";
import { PLACE_LINK_JS } from "../stmt/place-link.js";
import { MAKER_GEO_JS } from "../stmt/maker-geo.js";
import { openMaster } from "../tools/payload.mjs";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const near = (r, lat, lng, tol = 1e-5) => !!r && Math.abs(r.lat - lat) <= tol && Math.abs(r.lng - lng) <= tol;
/* an Open Location Code encoder of the test's own (ten digits, the pairs at 20, 1, 0.05, 0.0025 and 0.000125 degrees), so the reader is checked against another hand */
const A = "23456789CFGHJMPQRVWX", RES = [20, 1, 0.05, 0.0025, 0.000125];
const encode = (lat, lng) => { let la = lat + 90, ln = lng + 180, c = "";
  for (const r of RES) { const a = Math.floor(la / r), b = Math.floor(ln / r); c += A[a] + A[b]; la -= a * r; ln -= b * r; }
  return c.slice(0, 8) + "+" + c.slice(8); };

export async function run({ ok, pageWork }) {
  const reader = new Function("return " + PLACE_LINK_JS)();
  const geo = new Function("crypto", "TextEncoder", "return " + MAKER_GEO_JS)(webcrypto, TextEncoder);
  const { w: desk } = await openMaster();
  try {
    Object.defineProperty(desk, "crypto", { value: webcrypto, configurable: true });
    desk.TextEncoder = TextEncoder;
    geo.configure(JSON.parse(desk.eval("JSON.stringify(PLACED)")));
    const deskRead = (s) => JSON.parse(desk.eval("JSON.stringify(mapsLink(" + J(s) + "))"));
    /* R1: 3 + 8/60 + 50/3600 = 3.147222; 101 + 41/60 + 13.2/3600 = 101.687 */
    const dms = ["3°08'50.0\"N 101°41'13.2\"E", "101°41'13.2\"E 3°08'50.0\"N", "3°08′50.0″N, 101°41′13.2″E"].map(reader);
    const dec = reader("3.1472° N, 101.6869° E"), south = reader("1°30'00.0\"S 36°49'12.0\"E");
    ok(dms.every((r) => near(r, 3.147222, 101.687, 1e-6) && r.src === "pin") && near(dec, 3.1472, 101.6869) && near(south, -1.5, 36.82)
      && reader("3°61'N 101°E") === null,
      "R1 a point in degrees, minutes and seconds reads in either order, with decimals too, and a minute of 60 or more is no point: " + J([dms, dec, south]));
    /* R2 */
    const sp = reader("3.1390 101.6869"), cm = reader("3.1390, 101.6869");
    ok(near(sp, 3.139, 101.6869) && sp.src === "pin" && near(cm, 3.139, 101.6869) && reader("3 101") === null,
      "R2 two figures apart by a space alone are a pin, as with a comma: " + J([sp, cm]));
    /* R3: 849VCWC8+R9, lat 8,9,C,C,R = 6*20+7*1+8*0.05+8*0.0025+16*0.000125 = 127.422, less 90, plus half a cell = 37.4220625;
       lng 4,V,W,8,9 = 2*20+17+18*0.05+6*0.0025+7*0.000125 = 57.915875, less 180, plus half = -122.0840625 */
    const full = reader("849VCWC8+R9");
    /* a short code with a place after it: Kuala Lumpur's own (3.1500, 101.7000) and one across the degree line south of the city (2.9300, 101.6900),
       each encoded by the test's hand, its first four characters dropped */
    const kl = encode(3.15, 101.7), south2 = encode(2.93, 101.69);
    const shortKl = reader(kl.slice(4) + " Kuala Lumpur"), shortSouth = reader(south2.slice(4));
    ok(near(full, 37.4220625, -122.0840625, 2e-6) && full.src === "pin" && near(shortKl, 3.15, 101.7, 2e-4) && shortKl.addr === "Kuala Lumpur"
      && near(shortSouth, 2.93, 101.69, 2e-4) && reader("CWC8+R") === null,
      "R3 a full plus code reads to its cell, and a short one from Kuala Lumpur, across a degree line too: " + J([full, kl, shortKl, south2, shortSouth]));
    /* R4 */
    const cases = [...["3°08'50.0\"N 101°41'13.2\"E", "3.1472° N, 101.6869° E", "3.1390 101.6869", "849VCWC8+R9", kl.slice(4) + " Kuala Lumpur", south2.slice(4)],
      "https://waze.com/ul?ll=3.123456,101.654321", "https://maps.app.goo.gl/AbC123", "Jalan Contoh 12"];
    const differ = cases.filter((s) => J(reader(s)) !== J(deskRead(s)) || J(geo.link(s)) !== J(deskRead(s)));
    ok(differ.length === 0, "R4 the Counter's reader and Salt Admin's give the Desk's reading on every case" + (differ.length ? ": " + J(differ) : ""));
    /* L1 */
    const picks = JSON.parse(desk.eval("JSON.stringify([...placePicks()])")), sample = picks.filter((x, i) => i % 17 === 3).slice(0, 8);
    const deskLocal = (lat, lng) => JSON.parse(desk.eval("JSON.stringify(localityFor(" + lat + "," + lng + "))"));
    const onPick = sample.map(([label, p]) => { const got = deskLocal(p[0], p[1]), at = picks.find((x) => x[0] === got);
      return { label, got, same: !!at && at[1][0] === p[0] && at[1][1] === p[1] }; });
    const pts = [[3.139, 101.687], [3.0738, 101.7889], [2.9927, 101.7909], [3.1579, 101.7118], [1.4927, 103.7414], [3.2, 101.5]];
    const parity = pts.filter(([a, b]) => J(geo.locality(a, b)) !== J(deskLocal(a, b)));
    ok(sample.length >= 5 && onPick.every((x) => x.same && x.got.split(",").pop().trim() === x.label.split(",").pop().trim())
      && deskLocal(10, 110) === null && deskLocal(1.4927, 103.7414) === null && geo.locality(Number.NaN, 101) === null && parity.length === 0,
      "L1 a point on a listed locality files with a locality at that very point in the same district, none outside every district nor where its district lists none, and Salt Admin agrees: "
        + J({ onPick: onPick.filter((x) => !x.same), parity }));
  } finally { desk.close(); }
  /* A1 */
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(p.d, "nav.record")); await click(byAct(p.d, "part.record.customers"));
    const where = byAct(p.d, "record.add-id.link"), locality = byAct(p.d, "record.add-id.place");
    const fire = async (kind) => { where.dispatchEvent(new p.w.Event(kind, { bubbles: true })); await p.work.quiet(); };
    where.value = "3.1579, 101.7118"; await fire("change");
    const filled = locality.value, said = (locality.closest("label").nextElementSibling || {}).textContent || "";
    /* the harness files one place (catalog.placed), so its list is the Desk's list with that one */
    const geo2 = new Function("crypto", "TextEncoder", "return " + MAKER_GEO_JS)(webcrypto, TextEncoder); geo2.configure({ "CX1-ZED": [3.1, 101.7, "Pudu"] });
    const expected = geo2.locality(3.1579, 101.7118);
    locality.value = "Pudu"; where.value = "3.0738, 101.7889"; await fire("change");
    const kept = locality.value;
    const field = [...where.closest(".maker-input").querySelectorAll("input")].map((x) => x.getAttribute("data-act"));
    ok(!!expected && filled === expected && /Worked out from Where/.test(said) && kept === "Pudu"
      && field.indexOf("record.add-id.link") < field.indexOf("record.add-id.place"),
      "A1 a point in Where fills Locality and says so, Where stands first, and a locality he typed stands: " + J([filled, said, kept, field]));
  } finally { p.w.close(); }
}
