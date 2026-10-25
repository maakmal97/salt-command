/* test/admin-ac-confirm.mjs: SALT ADMIN A TO C, P3 (20 Oct 2026; docs/plan-counter-admin-ac.html). The confirm figure on his side.
 * What is proved here, each check red under its own mutation (test/admin-ac-confirm.mutations.json):
 *   1  the Worker's hours answer carries the cron's filed figure, raw, on the GET and on a save, so a save keeps the band
 *   2  Shop > Hours draws the figure and how many are measured; under ten it says so, and draws no figure, even one filed beside the count
 *   3  a placed order's card says the minutes it has waited beside his usual; past his usual the clock is marked late
 *   4  no clock on a practice order or one with a price, which the measure leaves out
 *   5  its Needs card says the minutes waiting and his usual, marked late past it
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { handleMaker } from "../stmt/maker.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const ago = (m) => new Date(Date.now() - m * 60000).toISOString();
const base = { u: "abcd-efgh", product: "salt", delivery: 0, msgs: [], history: [], payments: [], paid: 0, mode: "collect", qty: 1, total: 50, status: "placed" };

export async function run({ ok, pageWork }) {
  /* 1 */
  const kv = new Map([["confirm:within", JSON.stringify({ mins: 45, n: 30, at: ago(10) })]]);
  const env = { STMT: { get: async (k, type) => { const v = kv.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, v); } } };
  const call = async (method, body) => (await handleMaker(new Request("https://counter.test/all/maker/hours", { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    env, "/all/maker/hours", { email: "maakmal97@icloud.com" })).json();
  const got = await call("GET"), saved = await call("POST", { schedule: { days: [null, { open: "09:00", close: "17:00" }, null, null, null, null, null] } });
  ok(got.confirm && got.confirm.mins === 45 && got.confirm.n === 30 && !!got.confirm.at && saved.ok && saved.confirm && saved.confirm.mins === 45,
    "the hours answer carries the filed confirm figure, on the read and on a save: " + JSON.stringify([got.confirm, saved.confirm]));

  const hoursWith = (confirm) => (j) => ({ ...j, confirm });
  const orders = [
    { ...base, id: "ord-late", at: ago(52) },
    { ...base, id: "ord-soon", at: ago(20) },
    { ...base, id: "ord-prac", at: ago(30), test: true },
    { ...base, id: "ord-priced", at: ago(30), price: { from: "ask", state: "offered" } }
  ];
  const p = await richOwnerPage({ pageWork, hours: hoursWith({ mins: 45, n: 30, at: ago(10) }), review: (j) => ({ ...j, orders: (j.orders || []).concat(orders) }) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (act, key) => { byAct(d, act, key).click(); await p.work.quiet(); };
    /* 5 */
    await click("nav.needs");
    /* 22 Oct 2026 (canvas Needs you): the card marks its age in ember once late; the minutes and his usual stand in the open card beside the list from 860px */
    const ageOf = (k) => d.querySelector('#nlist [data-need="' + k + '"] .nage');
    p.w.matchMedia = (q) => ({ matches: /min-width:s*860px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {} });
    const clockIn = async (k) => { d.querySelector('#nlist [data-need="' + k + '"] .need-tap').click(); await p.work.quiet(); return d.querySelector("#nopen .npane [data-clock]"); };
    const nl = await clockIn("o:ord-late"), ns = await clockIn("o:ord-soon");
    delete p.w.matchMedia;
    ok(!!nl && /^5[23] min waiting, usually 45$/.test(t(nl)) && nl.classList.contains("need-clock--late") && !!ns && !ns.classList.contains("need-clock--late")
      && ageOf("o:ord-late").classList.contains("nage--late") && !ageOf("o:ord-soon").classList.contains("nage--late"),
      "a placed order's card marks its age late past his usual, and its open card says the minutes waiting and his usual: " + t(nl) + " / " + t(ns));
    /* 3 */
    await click("nav.orders"); await click("part.orders.placed");
    const open = async (id) => { await click("order.open", id); return p.card(id); };
    const L = (await open("ord-late")).querySelector(".ohead [data-clock]");
    ok(!!L && /^Waited in hours 5[23] min/.test(t(L)) && /Usually 45 min/.test(t(L)) && L.classList.contains("salt-meter--ember") && L.style.getPropertyValue("--salt-fill") === "100",
      "a placed order past his usual says how long it has waited and that it is past his usual: " + t(L));
    const H = p.card("ord-late").querySelector(".ohead"), mo = t(H && H.querySelector(".omoment"));
    ok(!!H && H.classList.contains("ohead--placed") && /^[0-9]{2}:[0-9]{2}, [0-9]{1,2} [A-Z][a-z]{2}$/.test(mo),
      "a placed card carries the copper edge, and its band says when it was placed, the time and the day: " + mo);
    const S = (await open("ord-soon")).querySelector(".ohead [data-clock]");
    ok(!!S && /^Waited in hours 2[01] min/.test(t(S)) && /Usually 45 min/.test(t(S)) && !S.classList.contains("salt-meter--ember") && /^4[4-7]$/.test(S.style.getPropertyValue("--salt-fill")),
      "one inside his usual says his usual and is not marked late: " + t(S));
    /* 4 */
    const P = await open("ord-prac"), Q = await open("ord-priced");
    ok(!!P && !!Q && !P.querySelector("[data-clock]") && !Q.querySelector("[data-clock]"), "no clock on a practice order or one with a price");
    /* 2 */
    await click("nav.shop"); await click("part.shop.hours");
    /* 25 Oct 2026 (Salt Admin Shop): the band became a one-line KPI tile on the glance, its state in one line under the tiles */
    const band = d.getElementById("makerConfirm"), fig = band && band.querySelector('[data-glance="confirm"]');
    ok(!!fig && fig.getAttribute("data-confirm") === "45" && t(fig) === "45 min" && /^30 measured/.test(t(band.querySelector(".shglance-note"))),
      "Shop hours draws his confirm time and how many are measured: " + t(band));
  } finally { p.w.close(); }

  const q = await richOwnerPage({ pageWork, hours: hoursWith({ mins: 45, n: 7, at: ago(10) }) });
  try {
    await q.work.quiet();
    byAct(q.d, "nav.shop").click(); await q.work.quiet(); byAct(q.d, "part.shop.hours").click(); await q.work.quiet();
    const band = q.d.getElementById("makerConfirm"), fig = band && band.querySelector('[data-glance="confirm"]');
    ok(!!fig && t(fig) === "Not yet" && /^7 measured · customers see a figure from 10$/.test(t(band.querySelector(".shglance-note"))) && !band.querySelector("[data-confirm]"),
      "under ten measured, it says so and draws no figure: " + t(band));
  } finally { q.w.close(); }
}
