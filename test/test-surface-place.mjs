/* test/test-surface-place.mjs: P3 of the Counter test surface (his answers of 18 Oct 2026, Asks 4 and 5). Every Place by a test
   account goes to its fixture, on every road, and the Worker counts open orders as the page does.
   1. a plain Place by 0000-0002 lands in its fixture and leaves the order book's events and orders as they were;
   2. no last-placement mark is stamped, so the Desk rings nothing and counts nothing;
   3. three more fit and the next is refused at the limit, the one count the page's own GET /orders gives it (five open);
   4. a delivery window wholly outside the Counter's hours is refused in the fixture as on the real road;
   5. 0000-0000, seeded at the limit, can no longer place or join a group order on the Worker either;
   6. Salt Admin placing for a test account writes to its fixture too, never the book. */
import { surface } from "./test-surface-harness.mjs";
import * as TF from "../tools/testfix.mjs";
import * as O from "../stmt/orders.js";
import { priceSteps } from "../tools/pricelist.mjs";
import { exampleAccount } from "../stmt/testfix.js";
import { HOURS_KEY } from "../stmt/hours.js";

export async function run({ ok }) {
  const s = await surface();
  try {
    const now = new Date(), all = TF.buildAll(now);
    for (const u of ["0000-0000", "0000-0002"]) {
      const f = all[u];
      await s.putFixture(u, { prices: { digest: f.prices.digest, steps: priceSteps(f.prices) }, makerOrders: f.orders, orders: f.orders, pools: f.pools,
        claims: f.claims, makerBook: f.book });
    }
    const f2 = all["0000-0002"], digest = f2.prices.digest, week = f2.prices.week.monday;
    const counts = () => ({ ev: s.harness.db.prepare("SELECT COUNT(*) AS n FROM ev").get().n, ord: s.harness.db.prepare("SELECT COUNT(*) AS n FROM ord").get().n,
      mark: (s.harness.db.prepare("SELECT v FROM meta WHERE k=?").get(O.LAST_PLACED) || {}).v || null });
    const session = async (u) => O.mintSession(s.env, u);
    const call = async (u, path, body, method = "POST") => {
      const r = await s.counter.fetch(new Request("https://counter.fixture.test" + path, { method,
        headers: { "X-Stmt-Session": await session(u), "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }), s.env);
      return { status: r.status, body: await r.json() };
    };
    let n = 0;
    const rice = (extra = {}) => ({ product: "rice", qty: 1, mode: "collect", total: 9, unit: 9, week, digest, place: "", forFriend: false, rid: "surface-place-" + (++n) + "-padded", ...extra });

    /* 1 and 2 */
    const before = counts();
    const first = await call("0000-0002", "/orders", rice());
    const fix = await exampleAccount(s.env, "0000-0002"), after = counts();
    ok(first.status === 200 && first.body.ok && fix.ok && fix.orders.some((o) => o.id === (first.body.order || {}).id && o.status === "placed")
      && after.ev === before.ev && after.ord === before.ord,
      "A plain Place by 0000-0002 lands in its fixture and the order book's events and orders stay as they were: " + JSON.stringify([first.status, first.body.error, before, after]));
    ok(after.mark === before.mark && before.mark === null, "No last-placement mark is stamped by a test account's Place: " + JSON.stringify([before.mark, after.mark]));

    /* 3. one count: the page's GET /orders reads five open when the Worker refuses the sixth */
    const more = [await call("0000-0002", "/orders", rice({ product: "candy", qty: 4, total: 45, unit: 11.25 })), await call("0000-0002", "/orders", rice({ qty: 2, total: 17, unit: 8.5 }))];
    const listed = await call("0000-0002", "/orders", null, "GET");
    const openN = O.openCount(listed.body.orders.filter((o) => O.OPEN_STATES.includes(o.status)));
    const sixth = await call("0000-0002", "/orders", rice({ product: "oil", total: 40, unit: 40 }));
    ok(more.every((r) => r.status === 200) && openN === 5 && sixth.status !== 200 && sixth.body.code === "openMax",
      "Three more fit and the sixth open order is refused at the limit, the five open the page's own GET /orders counts: " + JSON.stringify([more.map((r) => r.status), openN, sixth]));

    /* 4. a window the Counter's hours leave none of */
    await s.store.put(HOURS_KEY, JSON.stringify({ schedule: { days: Array.from({ length: 7 }, () => ({ open: "09:00", close: "10:00" })) } }));
    const day = new Date(Date.now() + 8 * 3600e3 + 2 * 86400e3).toISOString().slice(0, 10);
    const s2 = await (async () => { /* a fresh fixture row of room: Reset is P4's, so a second fixture account is not needed; cancel one first */
      const lst = (await exampleAccount(s.env, "0000-0002")).orders.find((o) => o.status === "placed" && /-ex[0-9a-f]{6}$/.test(o.id));
      return lst ? call("0000-0002", "/orders/" + lst.id + "/cancel", { action: "cancel", rid: "surface-cancel-0001-padded" }) : { status: 0, body: {} };
    })();
    const late = await call("0000-0002", "/orders", rice({ mode: "deliver", place: "Taman Rekaan", slot: day + "T20" }));
    const fine = await call("0000-0002", "/orders", rice({ mode: "deliver", place: "Taman Rekaan", slot: day + "T08" }));
    ok(s2.status === 200 && late.status !== 200 && late.body.code === "slot" && fine.status === 200 && (fine.body.order || {}).slotSpan === "09:00-10:00",
      "A delivery window wholly outside the Counter's hours is refused in the fixture and one they leave part of is taken with its span: " + JSON.stringify([s2.status, late, fine.status, fine.body.order && fine.body.order.slotSpan]));
    await s.store.delete(HOURS_KEY);

    /* 5. 0000-0000 at the limit */
    const f0 = all["0000-0000"], pool = f0.pools.find((p) => p.state === "open");
    const p0 = await call("0000-0000", "/orders", { ...rice(), digest: f0.prices.digest, week: f0.prices.week.monday });
    const j0 = await call("0000-0000", "/pools/" + pool.id + "/join", { qty: pool.q, total: 270, unit: 108, digest: f0.prices.digest, rid: "surface-join-0001-padded", week: f0.prices.week.monday });
    ok(p0.body.code === "openMax" && j0.status !== 200, "0000-0000, seeded at the limit, can no longer place or join a group order on the Worker: " + JSON.stringify([p0, j0]));

    /* 6. Salt Admin's Place for a test account */
    const b6 = counts();
    const room = (await exampleAccount(s.env, "0000-0002")).orders.find((o) => o.status === "placed" && /-ex[0-9a-f]{6}$/.test(o.id));
    if (room) await call("0000-0002", "/orders/" + room.id + "/cancel", { action: "cancel", rid: "surface-cancel-0002-padded" });
    const admin = await s.owner("/all/maker/customers/0000-0002/orders", rice());
    const ab = await admin.json(), a6 = counts();
    ok(admin.status === 200 && (await exampleAccount(s.env, "0000-0002")).orders.some((o) => o.id === (ab.order || {}).id) && a6.ev === b6.ev && a6.ord === b6.ord && a6.mark === null,
      "Salt Admin placing for a test account writes to its fixture too, and the book is untouched: " + JSON.stringify([admin.status, ab.error, b6, a6]));
  } finally { s.close(); }
}
