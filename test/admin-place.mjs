/* test/admin-place.mjs: A PLACE FOR HIS COLLECTION POINTS (his word of 26 Oct 2026: "test it out with Google Maps, Waze and Apple Maps",
 * and "type it and the relevant recommended place from OpenStreetMap appears"; his choice of Photon and his yes to opening Apple's links).
 * Each check red under its own mutation (test/admin-place.mutations.json, run with tools/section.mjs). No network: every fetch is a fake.
 *   L1  every full link a phone shares reads its point on the device: Google (place, ?q, api=1, @view, dir, .com.my), Waze (ul ll, the
 *       app's geohash, the live map's to=ll) and Apple (the real place link of 26 Oct 2026, ?ll, ?address&ll)
 *   W1  the opener fetches nothing for a host not a maker's; it follows Google's short links by redirect, manual, a hop at a time
 *   W2  Apple's short link leads to a place page, whose place:location meta tags give the point and og:title its name
 *   W3  a hop that leads off the makers' hosts is not followed
 *   W4  the search sends only the words, held to Malaysia and Singapore, and answers five places at most, a name, where and the point,
 *       one road in pieces one choice; under three letters, a link or two figures it fetches nothing
 *   W5  the routes take a POST of the one field only, behind the owner's gate
 *   U1  typing three letters on Place, then a pause, asks the search once; the places stand as rows under Place, a listbox
 *   U2  a tap puts the place's point in Place and names it under the list, and the list shuts
 *   U3  the arrows and Enter choose too; Escape shuts the list
 *   U4  Add point with an Apple short link opens it on the Worker and adds its point
 * Drawn by the maker harness (test/maker-act.mjs). */
import fs from "fs";
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { mapsOpen, mapsKind, placeSearch } from "../stmt/place.js";
import { handleMaker } from "../stmt/maker.js";
import { MAKER_GEO_JS } from "../stmt/maker-geo.js";

const t = (n) => (n ? n.textContent.replace(/\s+/g, " ").trim() : "");
const OWNER = { email: "maakmal97@icloud.com" };
/* a fake fetch: answers by URL from a table, and keeps every URL and its options */
const fake = (table) => {
  const calls = [];
  const f = async (url, init) => {
    calls.push({ url, init });
    const a = table[url];
    if (!a) return new Response("no", { status: 404 });
    if (a.to) return new Response(null, { status: a.status || 302, headers: { location: a.to } });
    return new Response(typeof a.body === "string" ? a.body : JSON.stringify(a.body), { status: a.status || 200 });
  };
  f.calls = calls;
  return f;
};
const APPLE_PAGE = '<html><head><meta property="og:title" content="Pavilion Kuala Lumpur"><meta property="place:location:latitude" content="3.1488291">'
  + '<meta property="place:location:longitude" content="101.7134266"></head></html>';

export async function run({ ok, pageWork }) {
  /* L1 */
  const geo = (0, eval)(MAKER_GEO_JS);
  const LINKS = [
    "https://www.google.com/maps/place/Pavilion+Kuala+Lumpur/@3.1488,101.7109,17z/data=!3m1!4b1!4m6!3m5!1s0x31cc49d6b9d4d7b1:0x1!8m2!3d3.148829!4d101.713427!16s%2Fg%2F1",
    "https://maps.google.com/?q=3.148829,101.713427",
    "https://www.google.com/maps/search/?api=1&query=3.148829%2C101.713427",
    "https://www.google.com/maps/@3.148829,101.713427,17z",
    "https://www.google.com/maps/dir/?api=1&destination=3.148829,101.713427",
    "https://www.google.com.my/maps/place/@3.148829,101.713427,17z",
    "https://waze.com/ul?ll=3.148829%2C101.713427&navigate=yes&zoom=17",
    "https://www.waze.com/en-GB/live-map/directions?to=ll.3.148829%2C101.713427",
    "https://maps.apple.com/place?place-id=IC7E95FA743D2118A&address=168%2C+Jalan+Bukit+Bintang%2C+55100+Kuala+Lumpur%2C+Kuala+Lumpur%2C+Malaysia&coordinate=3.148829%2C101.713427&name=Pavilion+Kuala+Lumpur&_provider=9902",
    "https://maps.apple.com/?ll=3.148829,101.713427&q=Pavilion",
    "https://maps.apple.com/?address=Jalan+Bukit+Bintang&auid=1&ll=3.148829,101.713427&lsp=9902&q=Pavilion",
  ];
  const read = LINKS.map((u) => geo.link(u)), miss = LINKS.filter((u, i) => !read[i] || read[i].lat !== 3.148829 || read[i].lng !== 101.713427);
  const hash = geo.link("Use Waze to drive to Pavilion Kuala Lumpur: https://waze.com/ul/hw283ckpb6");
  ok(!miss.length && !!hash && Math.abs(hash.lat - 3.14) < 0.02 && Math.abs(hash.lng - 101.67) < 0.02 && hash.src === "waze",
    "every full Google, Waze and Apple link reads its point on the device, the Waze app's geohash too: " + JSON.stringify(miss));

  /* W1 */
  let f = fake({});
  let r = await mapsOpen("https://example.com/maps/x", f);
  ok(!r.ok && f.calls.length === 0 && ["https://example.com/maps/x", "https://evil.test/steal", "https://maps.apple.com.evil.test/p/x", "https://goo.gl/other"].every((x) => mapsKind(new URL(x)) === null),
    "the opener fetches nothing for a host not a maker's, and the makers' list names only theirs");
  f = fake({ "https://goo.gl/maps/Abc123": { to: "https://maps.app.goo.gl/Xyz789", status: 301 },
    "https://maps.app.goo.gl/Xyz789": { to: "https://www.google.com/maps/place/P/@3.1,101.6,17z/data=!3d3.148829!4d101.713427" } });
  r = await mapsOpen("https://goo.gl/maps/Abc123", f);
  ok(r.ok && /!3d3[.]148829!4d101[.]713427/.test(r.location) && f.calls.length === 2 && f.calls.every((c) => c.init.redirect === "manual"),
    "Google's old and new short links are followed by redirect, manual, a hop at a time, to the Maps page: " + JSON.stringify([r, f.calls.map((c) => c.url)]));
  /* W2 */
  f = fake({ "https://maps.apple/p/AbC.dEf": { to: "https://maps.apple.com/place?place-id=I1&_provider=9902" },
    "https://maps.apple.com/place?place-id=I1&_provider=9902": { body: APPLE_PAGE } });
  r = await mapsOpen("https://maps.apple/p/AbC.dEf", f);
  const ar = r.ok ? geo.link(r.location) : null;
  ok(!!ar && ar.lat === 3.148829 && ar.lng === 101.713427 && ar.addr === "Pavilion Kuala Lumpur" && f.calls.length === 2,
    "Apple's short link leads to its place page, whose meta tags give the point and the name: " + JSON.stringify(r));
  f = fake({ "https://maps.apple.com/place?place-id=I1": { body: APPLE_PAGE } });
  r = await mapsOpen("https://maps.apple.com/place?place-id=I1", f);
  ok(r.ok && /ll=3[.]1488291,101[.]7134266/.test(r.location), "an Apple link with only a place id is read from its page");
  /* W3 */
  f = fake({ "https://maps.app.goo.gl/Xyz789": { to: "https://evil.test/steal" } });
  r = await mapsOpen("https://maps.app.goo.gl/Xyz789", f);
  ok(!r.ok && f.calls.length === 1 && !f.calls.some((c) => /evil/.test(c.url)), "a hop that leads off the makers' hosts is not followed");

  /* W4 */
  const PHOTON = (w) => "https://photon.komoot.io/api/?q=" + encodeURIComponent(w) + "&limit=8&lang=en&lat=3.139&lon=101.687&bbox=99.6,0.8,119.3,7.4";
  const feat = (name, x, y, more = {}) => ({ type: "Feature", geometry: { type: "Point", coordinates: [x, y] }, properties: { name, ...more } });
  f = fake({ [PHOTON("Jalan Ipoh")]: { body: { features: [
    feat("Jalan Ipoh", 101.68115, 3.18935, { district: "Sentul", city: "Kuala Lumpur" }),
    feat("Jalan Ipoh", 101.68118, 3.18938, { district: "Sentul", city: "Kuala Lumpur" }),
    feat("Pavilion Kuala Lumpur", 101.712951, 3.149153, { street: "Jalan Bukit Bintang", housenumber: "168", district: "Bukit Bintang", city: "Kuala Lumpur" }),
    feat("A", 101.1, 3.1), feat("B", 101.2, 3.2), feat("C", 101.3, 3.3), feat("D", 101.4, 3.4) ] } } });
  r = await placeSearch("  Jalan   Ipoh ", f);
  ok(r.ok && f.calls.length === 1 && f.calls[0].url === PHOTON("Jalan Ipoh") && r.places.length === 5
    && JSON.stringify(r.places[0]) === JSON.stringify({ name: "Jalan Ipoh", where: "Sentul, Kuala Lumpur", lat: 3.18935, lng: 101.68115 })
    && JSON.stringify(r.places[1]) === JSON.stringify({ name: "Pavilion Kuala Lumpur", where: "168 Jalan Bukit Bintang, Bukit Bintang, Kuala Lumpur", lat: 3.14915, lng: 101.71295 }),
    "the search sends only the words, held to Malaysia and Singapore, and answers five places, one road in pieces one choice: " + JSON.stringify(r));
  f = fake({});
  const none = [await placeSearch("Pa", f), await placeSearch("https://maps.app.goo.gl/x", f), await placeSearch("3.1, 101.6", f)];
  ok(none.every((x) => !x.ok) && f.calls.length === 0, "under three letters, a link or two figures, it fetches nothing");
  f = fake({ [PHOTON("Kepong")]: { status: 503, body: "busy" } });
  r = await placeSearch("Kepong", f);
  ok(!r.ok && r.status === 502 && /did not answer/.test(r.error), "a search that does not answer says so");

  /* W5 */
  const real = globalThis.fetch;
  const routeCalls = [];
  globalThis.fetch = async (url) => { routeCalls.push(String(url)); return new Response(JSON.stringify({ features: [] }), { status: 200 }); };
  try {
    const call = async (path, method, body, who = OWNER) => handleMaker(new Request("https://counter.test" + path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }), {}, path, who);
    const got = await call("/all/maker/geo/search", "POST", { q: "Kepong" }), j = await got.json();
    const refused = [await call("/all/maker/geo/search", "GET"), await call("/all/maker/geo/search", "POST", { q: "Kepong", code: "CK4-SEN" }),
      await call("/all/maker/geo/open", "POST", { url: "https://maps.apple/p/x", u: "a" }), await call("/all/maker/geo/search", "POST", { q: "Kepong" }, { email: "someone@else.test" })].map((x) => x.status);
    ok(got.status === 200 && j.ok && Array.isArray(j.places) && routeCalls.length === 1 && JSON.stringify(refused) === "[405,400,400,403]",
      "the routes take a POST of the one field only, behind the owner's gate: " + JSON.stringify([got.status, refused, routeCalls.length]));
  } finally { globalThis.fetch = real; }

  /* U1 to U4: Salt Admin's Place field */
  const searched = [], opened = [];
  const p = await richOwnerPage({ pageWork, extra: (route, body) => {
    if (route === "/all/maker/points") return { ok: true, points: { v: 1, list: [] }, examples: [] };
    if (route === "/all/maker/geo/search") { searched.push(body); return { ok: true, places: [
      { name: "Pavilion Kuala Lumpur", where: "Bukit Bintang, Kuala Lumpur", lat: 3.14915, lng: 101.71295 },
      { name: "Pavilion Damansara Heights", where: "Damansara Heights, Kuala Lumpur", lat: 3.146, lng: 101.66333 }] }; }
    if (route === "/all/maker/geo/open") { opened.push(body); return { ok: true, location: "https://maps.apple.com/?ll=3.1488291,101.7134266&q=Pavilion%20Kuala%20Lumpur" }; }
    return undefined;
  } });
  try {
    await p.work.quiet();
    byAct(p.d, "nav.shop").click(); await p.work.quiet(); byAct(p.d, "part.shop.hours").click(); await p.work.quiet();
    const place = () => byAct(p.d, "points.place"), list = () => p.d.getElementById("makerPointsFound");
    /* the harness holds the page's timers: a pause is the pending 350ms timers run, so typing on before it lets the earlier one go */
    const type = (v) => { place().value = v; place().dispatchEvent(new p.w.Event("input", { bubbles: true })); };
    const pause = async () => { p.timers.filter((x) => x.ms === 350 && !x.off).forEach((x) => { x.off = true; x.f(); }); await p.work.quiet(); };
    type("Pa"); type("Pav"); type("Pavi"); await pause();
    const rows = [...list().querySelectorAll('[role="option"]')];
    ok(JSON.stringify(searched) === JSON.stringify([{ q: "Pavi" }]) && list().getAttribute("role") === "listbox" && place().getAttribute("role") === "combobox"
      && place().getAttribute("aria-expanded") === "true" && rows.length === 2 && t(rows[0].querySelector(".salt-settings__label")) === "Pavilion Kuala Lumpur"
      && t(rows[0].querySelector(".salt-settings__value")) === "Bukit Bintang, Kuala Lumpur" && list().previousElementSibling === place().closest("label"),
      "three letters and a pause ask the search once; the places stand as rows under Place: " + JSON.stringify([searched, rows.map(t)]));
    /* U2 */
    rows[0].click(); await p.work.quiet();
    ok(place().value === "3.14915, 101.71295" && t(p.d.querySelector(".apoints-picked")) === "Pavilion Kuala Lumpur, Bukit Bintang, Kuala Lumpur" && !list().children.length
      && place().getAttribute("aria-expanded") === "false", "a tap puts its point in Place, names it under the list, and shuts the list");
    /* U3 */
    type("Pavil"); await pause();
    const key = (k) => place().dispatchEvent(new p.w.KeyboardEvent("keydown", { key: k, bubbles: true }));
    key("ArrowDown"); key("ArrowDown");
    const sel = place().getAttribute("aria-activedescendant");
    key("Enter"); await p.work.quiet();
    const chose = place().value;
    type("Pavili"); await pause(); key("Escape");
    ok(sel === "makerPointsHit1" && chose === "3.14600, 101.66333" && !list().children.length, "the arrows and Enter choose too, and Escape shuts the list: " + JSON.stringify([sel, chose]));
    /* U4 */
    byAct(p.d, "points.code").value = "C4";
    place().value = "Pavilion https://maps.apple/p/AbC.dEf";
    byAct(p.d, "points.add").click(); await new Promise((d) => setTimeout(d, 30)); await p.work.quiet();
    ok(JSON.stringify(opened) === JSON.stringify([{ url: "https://maps.apple/p/AbC.dEf" }]) && [...p.d.querySelectorAll("#makerPoints [data-point]")].map(t).join() === "C4"
      && /3[.]14883, 101[.]71343/.test(t(p.d.getElementById("makerPoints"))), "Add point with an Apple short link opens it on the Worker and adds its point");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
