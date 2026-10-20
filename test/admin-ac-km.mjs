/* test/admin-ac-km.mjs: SALT ADMIN, THE DISTANCE AND THE WAITED METER IN COUNTER HOURS (20 Oct 2026, his answers: option a, and the meter counts
 * opening hours only). What is proved here, each check red under its own mutation (test/admin-ac-km.mutations.json):
 *   1  the one distance (engine/geo.mjs, carried as stmt/geo.js) is the great-circle km
 *   2  openMinutes counts only the minutes the weekly hours are open (an order placed while closed counts from opening); with none filed, all
 *   3  the review's waited figure is set on real placed orders only, never a practice order or another stage
 *   4  (in test/admin-trips.mjs) the Desk's drafts answer carries RULES.delivery.roadFactor, the figure the fee is measured with
 *   5  on his order card, after the one unlock, Delivery cost says the distance from his base to their filed point times the factor; locked,
 *      or with no factor read, nothing
 *   6  the meter says "Waited in hours" and reads the review's waited figure
 * Drawn by the maker harness (test/maker-act.mjs). */
import GEO from "../engine/geo.mjs";
import SITE_GEO from "../stmt/geo.js";
import { openMinutes } from "../stmt/hours.js";
import { withWaited } from "../stmt/maker.js";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok, pageWork }) {
  /* 1 */
  const a = { lat: 3.1, lng: 101.6 }, b = { lat: 3.1, lng: 101.7 }, km = GEO.haversineKm(a, b);
  ok(Math.abs(km - 11.10) < 0.05 && SITE_GEO.haversineKm(a, b) === km, "the one distance is the great-circle km, and the site's copy is it: " + km);
  /* 2: Monday to Saturday 09:00 to 17:00 in Kuala Lumpur, Sunday closed */
  const day = { open: "09:00", close: "17:00" }, cfg = { schedule: { days: [null, day, day, day, day, day, day] } };
  const kl = (s) => Date.parse(s + "+08:00");
  ok(openMinutes(cfg, kl("2026-10-17T18:00:00"), kl("2026-10-19T10:00:00")) === 60 && openMinutes(cfg, kl("2026-10-19T09:30:00"), kl("2026-10-19T09:50:00")) === 20
    && openMinutes(null, kl("2026-10-19T09:30:00"), kl("2026-10-19T09:50:00")) === 20 && openMinutes(cfg, kl("2026-10-18T10:00:00"), kl("2026-10-18T12:00:00")) === 0,
    "openMinutes counts the hours open only: placed Saturday after closing, an hour by Monday 10:00; with no hours filed, every minute");
  /* 3 */
  const os = withWaited([{ id: "a", status: "placed", at: "2026-10-19T01:30:00.000Z" }, { id: "b", status: "placed", test: true, at: "2026-10-19T01:30:00.000Z" },
    { id: "c", status: "acknowledged", at: "2026-10-19T01:30:00.000Z" }], cfg, kl("2026-10-19T10:00:00"));
  ok(os[0].waitedOpen === 30 && !("waitedOpen" in os[1]) && !("waitedOpen" in os[2]), "the review sets the waited figure on a real placed order alone: " + JSON.stringify(os.map((o) => o.waitedOpen)));

  /* 5 and 6 */
  const base = { u: "abcd-efgh", product: "salt", msgs: [], history: [], payments: [], paid: 0, qty: 1, total: 100, at: "2026-10-10T02:00:00.000Z" };
  const extra = [{ ...base, id: "ord-k1", status: "acknowledged", mode: "deliver", place: "Pudu", delivery: 10 },
    { ...base, id: "ord-k2", status: "placed", mode: "collect", delivery: 0, waitedOpen: 30 }];
  const draw = async (factor) => {
    const p = await richOwnerPage({ pageWork, slip: true, review: (j) => ({ ...j, roadFactor: factor, orders: (j.orders || []).concat(extra) }) });
    await p.work.quiet();
    return p;
  };
  let p = await draw(1.3);
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.confirmed")); await click(byAct(d, "order.open", "ord-k1"));
    const kmOf = () => t(p.card("ord-k1") && p.card("ord-k1").querySelector("[data-km]"));
    ok(kmOf() === "", "locked, Delivery cost says no distance: " + kmOf());
    await click(byAct(d, "vault.unlock") || byAct(d, "vault.unlock", "spot:ord-k1"));
    const f = byAct(d, "vault.passphrase"); if (f) f.value = p.slipPass; await click(byAct(d, "vault.open"));
    ok(kmOf() === "Distance 14.4 km", "unlocked, Delivery cost says the distance from his base to their filed point times the factor: " + kmOf());
    await click(byAct(d, "part.orders.placed")); await click(byAct(d, "order.open", "ord-k2"));
    const m = p.card("ord-k2") && p.card("ord-k2").querySelector("[data-clock]");
    ok(!!m && /^Waited in hours 30 min/.test(t(m)), "the meter says Waited in hours and reads the review's figure: " + t(m));
    await click(byAct(d, "part.orders.confirmed")); await click(byAct(d, "order.open", "ord-k1"));
    ok(kmOf() === "Distance 14.4 km", "and a card drawn while unlocked says it from the start: " + kmOf());
  } finally { p.w.close(); }
  p = await draw(null);
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.confirmed")); await click(byAct(d, "order.open", "ord-k1"));
    await click(byAct(d, "vault.unlock")); const f = byAct(d, "vault.passphrase"); if (f) f.value = p.slipPass; await click(byAct(d, "vault.open"));
    ok(t(p.card("ord-k1").querySelector("[data-km]")) === "", "with no factor read, no distance");
  } finally { p.w.close(); }
}
