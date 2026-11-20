/* test/order-import-book.mjs: THE ORDER BOOK TAKES AN OLDER SALE'S ORDER, QUIETLY, ONCE (20 Nov 2026, docs/plan-order-import.html, Part 2).
 *   B1 an order lands as built; B2 a retry lands once; B3 each refusal, the batch going on; B4 the batch's own limits
 *   B5 no wake, no ring, no nudge, no mark moved; B6 unimport takes back an untouched order and refuses a touched one
 *   B7 the KV road refuses both; B8 the customer reads no rid, imported or key, and no rating, chase or confirm time reads it
 *   B9 the Desk's route answers per order, and only on its key
 * Every group is red under its own mutation (test/order-import-book.mutations.json). */
import { orderBook } from "./orderbook-harness.mjs";
import { decideCustomer, customerView, rateAskable, rateDue, isAdvance, wakes, marksOf, importOrders, unimportOrders } from "../stmt/orders.js";
import { confirmWithin } from "../stmt/confirm.js";
import { readFileSync } from "node:fs";

const J = JSON.stringify;
const KEY = "import-book-bridge-key-0123456789abcdef";
const AT = "2026-11-09T16:00:00.000Z";
const mk = (o) => Object.assign({ id: "20261110000000-i401", u: "abcd-efgh", status: "done", product: "salt", qty: 2, total: 190, delivery: 15, mode: "deliver", forFriend: false,
  credit: 0, movedOn: "2026-11-11", at: AT, imported: true, rid: "s401", ledgerKey: "CQ4-ZEN|2026-11-10|205", rateAsk: AT, payments: [], msgs: [], claimed: 0,
  history: [{ at: AT, status: "done", by: "import" }], paid: 205, moved: 2, queued: { ack: AT, paid: 205, moved: 2 } }, o || {});
const Q = (o) => Object.assign({}, o);

export async function run({ ok, skip }) {
  let sqlite = null;
  try { sqlite = await import("node:sqlite"); } catch (e) { /* older runtime */ }
  if (!sqlite) { if (skip) skip("node:sqlite is unavailable here, so the order book was not driven"); return; }
  const nudges = [];
  const env = { ORDER_STORE: "object", COUNTER_MAKER_KEY: KEY, DESK_MAKER: { fetch: async (r) => { nudges.push(r.url); return new Response("{}", { status: 202 }); } } };
  const h = orderBook(env);
  const call = async (op, body) => (await h.book.fetch(new Request("https://orderbook/" + op, { method: "POST", body: J(body || {}) }))).json();
  const evCount = (u, id) => h.db.prepare("SELECT COUNT(*) n FROM ev WHERE u = ? AND oid = ?").get(u, id).n;
  const mine = (u) => h.book.ordersOf(u);

  /* B1 */
  const marks0 = J(await call("last"));
  const r1 = await call("import", { orders: [mk()] });
  ok(r1.ok && J(r1.results) === J([{ id: "20261110000000-i401", ok: true }]), "B1: an order lands: " + J(r1));
  ok(J(h.book.order("abcd-efgh", "20261110000000-i401")) === J(mk()), "B1: and is stored exactly as built");
  /* B5 */
  await Promise.all([...(h.book.rings || [])]);
  ok(!("wake" in r1) && !(r1.results || []).some((x) => x.wake), "B5: the answer carries no wake");
  ok(wakes({ kind: "import", at: AT, order: mk() }, mk(), false) === null && J(marksOf({ kind: "import", at: AT, order: mk() }, mk())) === "[]", "B5: an import's event wakes nobody and moves no mark");
  ok(J(await call("last")) === marks0, "B5: no shared mark moved, so the Desk's pass is not asked and no ring is read from one");
  ok(!nudges.length && !(h.book.rings && h.book.rings.size) && !h.book.nudging, "B5: nothing rang Salt Admin and nothing nudged the Desk: " + J(nudges));

  /* B2 */
  const r2 = await call("import", { orders: [mk()] });
  ok(r2.ok && J(r2.results) === J([{ id: "20261110000000-i401", ok: true, again: true }]) && evCount("abcd-efgh", "20261110000000-i401") === 1 && mine("abcd-efgh").length === 1,
    "B2: a retry lands once: " + J(r2));

  /* B3 */
  const why = async (o) => { const r = await call("import", { orders: [o] }); return (r.results && r.results[0] && !r.results[0].ok && r.results[0].why) || "LANDED " + J(r); };
  const R = async (re, o, what) => { const w = await why(o); ok(re.test(w), "B3: " + what + ": " + w); };
  /* an id held by an order that was not imported (no import event under it), so the retry check cannot answer it */
  h.book.append(null, "abcd-efgh", "20261110000000-p000", { kind: "place", at: AT, order: { id: "20261110000000-p000", u: "abcd-efgh", status: "placed", product: "salt", qty: 1, total: 1, delivery: 0, mode: "collect", at: AT, payments: [], msgs: [], history: [] } }, null);
  await R(/^an order already has its id/, mk({ id: "20261110000000-p000", rid: "s999", ledgerKey: "OTHER|2026-11-10|1" }), "an id that already exists");
  await R(/names its row/, mk({ id: "20261110000000-i402", rid: "s999" }), "a key an order already holds");
  await R(/names its row/, mk({ id: "20261110000000-i403", ledgerKey: "ZZZ|2026-11-10|9" }), "a rid an order already holds");
  /* the untailed key counts: an order from before V4a holds `X|d|n`, and an oil order for the same row carries `|oil` */
  ok((await call("import", { orders: [mk({ id: "20261110000000-i404", rid: "s404", product: "oil", ledgerKey: "OIL-A|2026-11-10|190" })] })).results[0].ok, "B3: an oil order with an untailed key lands");
  await R(/names its row/, mk({ id: "20261110000000-i405", rid: "s405", product: "oil", ledgerKey: "OIL-A|2026-11-10|190|oil" }), "a tailed key against an untailed one");
  ok((await call("import", { orders: [mk({ id: "20261110000000-i406", rid: "s406", product: "oil", ledgerKey: "OIL-B|2026-11-10|190|oil" })] })).results[0].ok, "B3: an oil order with a tailed key lands");
  await R(/names its row/, mk({ id: "20261110000000-i407", rid: "s407", product: "oil", ledgerKey: "OIL-B|2026-11-10|190" }), "an untailed key against a tailed one");
  await R(/names its row/, mk({ id: "20261110000000-i408", u: "other-user", rid: "s408", ledgerKey: "CQ4-ZEN|2026-11-10|205" }), "a key another account's order holds");
  const base = (id, extra) => Object.assign({ id, rid: "r" + id.slice(-3), ledgerKey: "K|2026-11-10|" + id.slice(-3) }, extra);
  await R(/imported/, mk(base("20261110000000-i410", { imported: undefined })), "no imported mark");
  await R(/done/, mk(base("20261110000000-i411", { status: "ready" })), "not done");
  await R(/acknowledgement/, mk(base("20261110000000-i412", { queued: { paid: 205, moved: 2 } })), "no acknowledgement");
  await R(/ledger was told/, mk(base("20261110000000-i418", { queued: { ack: AT, paid: 0, moved: 2 } })), "queued.paid not the order's paid");
  await R(/ledger was told/, mk(base("20261110000000-i419", { queued: { ack: AT, paid: 205, moved: 0 } })), "queued.moved not the order's moved");
  await R(/close/, mk(base("20261110000000-i413", { closed: { total: 1 } })), "closed");
  await R(/close/, mk(base("20261110000000-i414", { queued: { ack: AT, close: "x" } })), "queued.close");
  await R(/close/, mk(base("20261110000000-i415", { queued: { ack: AT, redate: "x" } })), "queued.redate");
  await R(/close/, mk(base("20261110000000-i416", { queued: { ack: AT, cancel: "x" } })), "queued.cancel");
  await R(/test/, mk(base("20261110000000-i417", { u: "0000-0000" })), "a test account");
  await R(/shape/, mk(base("bad-id")), "an id not of the site's shape");
  ok(mine("0000-0000").length === 0, "B3: nothing of a refused order was written");
  /* B4 */
  const two = await call("import", { orders: [mk(base("20261110000000-i420", { status: "ready" })), mk(base("20261110000000-i421"))] });
  ok(two.results.length === 2 && !two.results[0].ok && two.results[1].ok && !!h.book.order("abcd-efgh", "20261110000000-i421"), "B4: a refused order never stops the batch: " + J(two));
  const many = await call("import", { orders: Array.from({ length: 21 }, (_, i) => mk(base("20261110" + "00000" + String(i % 10) + "-i5" + String(i).padStart(2, "0")))) });
  ok(many.ok === false && many.status === 400 && !mine("abcd-efgh").some((o) => /-i5/.test(o.id)), "B4: more than 20 is refused whole: " + J(many));

  /* B6 */
  ok(J((await call("unimport", { ids: ["20261110000000-i421"] })).results) === J([{ id: "20261110000000-i421", ok: true }]) && !h.book.order("abcd-efgh", "20261110000000-i421") && evCount("abcd-efgh", "20261110000000-i421") === 0,
    "B6: an untouched imported order is taken back, its event with it");
  ok((await call("import", { orders: [mk(base("20261110000000-i421"))] })).results[0].ok, "B6: and may then be imported again");
  const o421 = h.book.order("abcd-efgh", "20261110000000-i421");
  h.book.append("d:abcd-efgh:x:rid:touch000000000000", "abcd-efgh", "20261110000000-i421", { kind: "say", at: AT, by: "desk", text: "hi" }, o421);
  const un = await call("unimport", { ids: ["20261110000000-i421", "no-such-id", "20261110000000-i401"] });
  ok(!un.results[0].ok && /touched/.test(un.results[0].why) && !!h.book.order("abcd-efgh", "20261110000000-i421"), "B6: a touched order is refused, with its reason: " + J(un.results[0]));
  ok(!un.results[1].ok && /no such/.test(un.results[1].why) && un.results[2].ok && !h.book.order("abcd-efgh", "20261110000000-i401"), "B6: an unknown id is refused and the batch goes on: " + J(un));
  /* the pass's own reward word is bookkeeping and goes with the order; any other move is refused, and says which */
  ok((await call("import", { orders: [mk(base("20261110000000-i430"))] })).results[0].ok, "B6: a second order lands for the mark case");
  h.book.append("d:abcd-efgh:x:rid:mark0000000000000", "abcd-efgh", "20261110000000-i430", { kind: "mark", at: AT, mark: { rwd: "given" } }, h.book.order("abcd-efgh", "20261110000000-i430"));
  ok(evCount("abcd-efgh", "20261110000000-i430") === 2 && h.book.order("abcd-efgh", "20261110000000-i430").rwd === "given", "B6: the pass marked it with the reward word");
  const um = await call("unimport", { ids: ["20261110000000-i430"] });
  ok(um.results[0].ok && !h.book.order("abcd-efgh", "20261110000000-i430") && evCount("abcd-efgh", "20261110000000-i430") === 0, "B6: an order the pass only marked is taken back, marks and all: " + J(um));
  ok((await call("import", { orders: [mk(base("20261110000000-i431"))] })).results[0].ok, "B6: a third order lands for the refusal words");
  const word = async (id, n, ev) => { h.book.append("d:abcd-efgh:x:rid:" + n, "abcd-efgh", id, ev, h.book.order("abcd-efgh", id)); return (await call("unimport", { ids: [id] })).results[0]; };
  const rs = await word("20261110000000-i431", "rate00000000000000", { kind: "rate", at: AT, stars: 4 });
  ok(!rs.ok && /a rating/.test(rs.why), "B6: a rating is named in the refusal: " + J(rs));
  ok(!un.results[0].ok && /a message/.test(un.results[0].why), "B6: and a message is named in the refusal: " + J(un.results[0]));
  h.book.append(null, "abcd-efgh", "20261110000000-p001", { kind: "place", at: AT, order: { id: "20261110000000-p001", u: "abcd-efgh", status: "placed", product: "salt", qty: 1, total: 1, delivery: 0, mode: "collect", at: AT, payments: [], msgs: [], history: [] } }, null);
  ok(!(await call("unimport", { ids: ["20261110000000-p001"] })).results[0].ok && !!h.book.order("abcd-efgh", "20261110000000-p001"), "B6: an order that was never imported is never taken");

  /* B7 */
  for (const road of ["kv", undefined]) {
    const e2 = Object.assign({}, env); if (road) e2.ORDER_STORE = road; else delete e2.ORDER_STORE;
    const h2 = orderBook(e2), c2 = async (op, b) => (await h2.book.fetch(new Request("https://orderbook/" + op, { method: "POST", body: J(b) }))).json();
    const a = await c2("import", { orders: [mk()] }), b = await c2("unimport", { ids: ["x"] });
    ok(a.ok === false && a.status === 503 && b.ok === false && b.status === 503 && h2.book.all().length === 0, "B7: the " + (road || "unset") + " road refuses both: " + J([a, b]));
  }
  const kvEnv = { ORDER_STORE: "kv", ORDERBOOK: h.ns };
  const ka = await importOrders(kvEnv, [mk()]), kb = await unimportOrders(kvEnv, ["x"]);
  ok(ka.status === 503 && kb.status === 503 && !ka.results, "B7: and the Counter's own call answers 503 on the kv road: " + J([ka, kb]));

  /* B8 */
  const o = h.book.order("abcd-efgh", "20261110000000-i421"), v = customerView(o);
  ok(!("rid" in v) && !("imported" in v) && !("ledgerKey" in v) && !("queued" in v) && !("rateAsk" in v) && v.rowOn === "2026-11-10", "B8: a customer reads no rid, imported mark, key or queue: " + J(Object.keys(v)));
  ok(!rateAskable(mk()) && !rateDue(mk(), new Date("2026-11-20T09:00:00Z")), "B8: no rating is ever asked of it");
  /* the page's own rating test, lifted from its source and run on the order as the customer is sent it */
  const src = readFileSync(new URL("../stmt/page.js", import.meta.url), "utf8");
  const fn = (n) => { const i = src.indexOf("function " + n + "(o)"); return i < 0 ? "" : src.slice(i, src.indexOf("\n", i) + 1); };
  const pageDue = new Function("view", "movedAll", "dayMinus", fn("rateOpen") + fn("rateDue") + fn("rateHome") + "return { due: rateDue, home: rateHome };")(false, (x) => (+x.moved || 0) >= (+x.qty || 0), () => "2026-11-18");
  ok(v.norate === true && !pageDue.due(v) && !pageDue.home(v), "B8: the page asks no rating of it (norate): " + J(v));
  ok(pageDue.due(Object.assign({}, v, { norate: undefined })) === true, "B8: and the page's test does ask of an order without the flag");
  ok(decideCustomer(o, "rate", { stars: 5 }, [], AT).status === 409, "B8: a rating of it is refused");
  ok(!isAdvance(mk()), "B8: it is never chased");
  ok(confirmWithin([mk(), mk({ id: "20261110000000-i499" })], { schedule: null }) === null, "B8: the confirm time never measures it");

  /* B9 */
  const W = (await import("../stmt/worker.js")).default;
  const wenv = { ORDER_STORE: "object", STMT_DESK_KEY: "desk-key", STMT: { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) } };
  wenv.ORDERBOOK = h.ns;
  const post = (path, body, key) => W.fetch(new Request("https://stmt.example" + path, { method: "POST", headers: Object.assign({ "content-type": "application/json" }, key ? { "X-Stmt-Desk": key } : {}), body: J(body) }), wenv, {});
  const noKey = await post("/desk/import", { orders: [mk({ id: "20261110000000-i601", rid: "s601", ledgerKey: "R|2026-11-10|1" })] });
  ok(noKey.status === 401 && !h.book.order("abcd-efgh", "20261110000000-i601"), "B9: the route needs the Desk's key");
  const viaR = await (await post("/desk/import", { orders: [mk({ id: "20261110000000-i601", rid: "s601", ledgerKey: "R|2026-11-10|1" }), mk({ id: "20261110000000-i602", status: "ready" })] }, "desk-key")).json();
  ok(viaR.ok && (viaR.results || []).length === 2 && viaR.results[0].ok && !viaR.results[1].ok && !!viaR.results[1].why, "B9: POST /desk/import answers per order: " + J(viaR));
  const viaU = await (await post("/desk/unimport", { ids: ["20261110000000-i601"] }, "desk-key")).json();
  ok(viaU.ok && (viaU.results || [])[0] && viaU.results[0].ok && !h.book.order("abcd-efgh", "20261110000000-i601"), "B9: POST /desk/unimport answers per id: " + J(viaU));
  const bad = await post("/desk/import", { orders: "x" }, "desk-key");
  ok(bad.status === 400, "B9: a body with no list is refused");
}
