/* test/counter-quotes.mjs: BAND VERSION 2, EVERY QUOTE A CUSTOMER IS SHOWN IS RECORDED (docs/plan-salt-price-band.html). The order sheet's
 * check posts what it shows; the Counter's Worker files it by username and Kuala Lumpur day; Place marks the line placed; the Desk reads the
 * count over the relay. It prices nothing and no customer sees it. The real page in jsdom, the real Worker on a KV and the order book's own
 * harness, the Desk's Worker over a stub binding. Every username, key and figure is invented.
 *   Q1  the check posts one quote with the prices shown, once for the same lines, again for another set
 *   Q2  a practice account posts nothing
 *   Q3  Order as them posts nothing
 *   Q4  the Worker refuses a bad line, no sheet, too many lines
 *   Q5  it files under the day and the username, and answers a practice account ok and files nowhere
 *   Q6  the 31st quote of a day is refused
 *   Q7  Place marks the matching line placed, by the sheet where the order carries one, else by book and size
 *   Q8  the Desk reading sums shown and placed by book and size over the window and leaves older days out
 *   Q9  the Desk route needs X-Stmt-Desk
 *   Q10 the Desk relay needs X-Salt-Key and passes the answer; unconfigured it is a 503
 * Each proved red by its own mutation (test/counter-quotes.mutations.json). */
import { open, startAt, until } from "./counter-b-kit.mjs";
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import * as C from "../tools/stmt-crypto.mjs";
import { rig, U1, rid } from "./pool.mjs";

class KV {
  constructor() { this.m = new Map(); this.opts = new Map(); }
  async put(k, v, o) { this.m.set(k, v); this.opts.set(k, o || null); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const kl = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const SHEET = "s".repeat(32);

export async function run({ ok, pageWork }) {
  /* ---- the page: Q1 to Q3 ---- */
  const seen = [];
  const watch = (win) => {
    const orig = win.fetch;
    win.fetch = async (p, i) => {
      if (String(p) === "/quote") { seen.push({ session: (i.headers || {})["X-Stmt-Session"], body: JSON.parse(i.body) }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; }
      return orig(p, i);
    };
    return pageWork(win);
  };
  const toCheck = async (p, shape, q) => { await startAt(p, shape, q); const g = p.d.getElementById("oGo"); if (g && !p.d.getElementById("oPlace")) { g.click(); await p.settle(); } await until(() => !!p.d.getElementById("oPlace")); };
  let A = await open({ pageWork: watch });
  try {
    await toCheck(A, "salt", 1);
    const one = seen.slice();
    ok(one.length === 1 && /^[A-Za-z0-9_-]{8,64}$/.test(one[0].body.sheet) && one[0].session === "sess-bb-abcdefghij"
      && JSON.stringify(one[0].body.lines) === JSON.stringify([{ b: "salt", q: 1, p: 100 }]),
    "Q1 the check posts one quote with the book, size and price shown, on their session: " + JSON.stringify(one));
    A.d.getElementById("oBack").click(); await A.settle();
    A.d.getElementById("oGo").click(); await A.settle();
    const same = seen.length;
    A.d.getElementById("oBack").click(); await A.settle();
    A.d.querySelector('#osheet [data-k="close"]').click(); await A.settle();
    await toCheck(A, "salt", 2.5);
    ok(same === 1 && seen.length === 2 && seen[1].body.lines[0].q === 2.5 && seen[1].body.lines[0].p === 250 && seen[1].body.sheet !== one[0].body.sheet,
      "Q1 the same lines of the same sheet post once, a new sheet with other lines posts again: " + JSON.stringify([same, seen.length]));
  } finally { A.close(); }

  seen.length = 0;
  A = await open({ pageWork: watch, user: "0000-0000" });
  try {
    await toCheck(A, "salt", 1);
    ok(!!A.d.getElementById("oPlace") && seen.length === 0, "Q2 a practice account reaches the check and posts no quote: " + seen.length);
  } finally { A.close(); }

  const ck = await C.contentKey("quotes-secret", U1);
  const list = { at: "2026-11-02T00:00:00.000Z", week: { monday: "2026-10-27", label: "This week" }, soon: [], digest: "as-them-list",
    products: [{ product: "salt", unit: "unit", basis: "tier", sizes: [{ q: 1, price: 100 }, { q: 5, price: 450 }] }] };
  const opened = { ok: true, byMaster: true, session: "", assoc: false, card: null, wrapMaster: await C.wrapKey("fixture-master", ck),
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-11-01", label: "November", body: "<p>Statement</p>" }] })),
    prices: Object.assign({ at: list.at, week: list.week.monday, digest: list.digest }, await C.encryptWith(ck, JSON.stringify(list))) };
  const extra = (route) => route === "/open" ? opened : route === "/all/maker/slip/key" ? { ok: true, key: { kty: "EC", crv: "P-256", x: "eA", y: "eQ" } }
    : route === "/all/maker/inputs" ? { ok: true, catalog: { parties: ["CA5-SEN"] } } : route === "/all/orders/" + U1 ? { ok: true, orders: [], claims: [], links: [], max: 0 } : undefined;
  const P = await richOwnerPage({ pageWork, extra });
  try {
    enter(P.d, "customers", "accounts"); await P.work.quiet();
    byAct(P.d, "acct.open", U1).click(); await P.work.quiet();
    byAct(P.d.getElementById("aopen"), "acct.order-for").click(); await P.work.quiet();
    const tab = P.d.querySelector('[data-t="order"]'); if (tab) { tab.click(); await P.work.quiet(); }
    await startAt(P.d); await P.work.quiet();
    const g3 = P.d.getElementById("oGo"); if (g3 && !P.d.getElementById("oPlace")) { g3.click(); await P.work.quiet(); }
    const reached = !!P.d.getElementById("oPlace");
    ok(reached && !P.wire.some((x) => /^\/quote /.test(x)), "Q3 Order as them reaches the check and posts no quote: " + JSON.stringify([reached, P.wire.filter((x) => /quote/.test(x))]));
  } finally { P.w.close(); }

  /* ---- the Worker: Q4 to Q9 ---- */
  const stmtW = (await import("../stmt/worker.js")).default, T = await import("../stmt/testusers.js");
  const { O, env, kv, bk } = await rig(KV);
  env.STMT_DESK_KEY = "desk-key";
  const tok = await O.mintSession(env, U1), tt = await O.mintSession(env, T.TEST_USER);
  await kv.put("u:" + T.TEST_USER, JSON.stringify({ test: true, wrap: { salt: "w" } }));
  const call = async (path, body, h, e, method) => {
    const r = await stmtW.fetch(new Request("https://k7m3p2.example" + path, body === undefined && !method ? { headers: h || { "X-Stmt-Session": tok } }
      : { method: method || "POST", headers: Object.assign({ "content-type": "application/json" }, h || { "X-Stmt-Session": tok }), body: JSON.stringify(body) }), e || env);
    const text = await r.text(); let b = null; try { b = JSON.parse(text); } catch (x) { b = text; }
    return { status: r.status, b };
  };
  const keyOf = (u, day = kl(0)) => "quote:" + day + ":" + u;
  const good = { sheet: SHEET, lines: [{ b: "salt", q: 2, p: 90 }, { b: "oil", q: 1, p: 40.5 }] };
  const bads = [{ ...good, lines: [{ b: "pepper", q: 1, p: 5 }] }, { ...good, lines: [{ b: "salt", q: 0, p: 5 }] }, { ...good, lines: [{ b: "salt", q: 1, p: -1 }] },
    { ...good, lines: [{ b: "salt", q: "1", p: 5 }] }, { ...good, lines: Array.from({ length: 11 }, () => ({ b: "salt", q: 1, p: 5 })) }, { lines: good.lines }, { ...good, lines: [] }];
  const refused = [];
  for (const b of bads) refused.push((await call("/quote", b)).status);
  ok(refused.every((s) => s === 400) && !kv.m.has(keyOf(U1)), "Q4 a line with an unknown book, a size or price that is not positive, more than ten lines, no sheet or none: refused 400 and filed nowhere: " + refused);
  const nosess = await call("/quote", good, {});
  const filed = await call("/quote", good);
  const rec = JSON.parse(kv.m.get(keyOf(U1)) || "[]");
  ok(nosess.status === 401 && filed.status === 200 && rec.length === 1 && rec[0].u === U1 && rec[0].sheet === SHEET && /^\d{4}-/.test(rec[0].at)
    && JSON.stringify(rec[0].lines) === JSON.stringify(good.lines) && (kv.opts.get(keyOf(U1)) || {}).expirationTtl === 120 * 86400,
  "Q5 a quote is filed under quote:<KL day>:<username> with the time, the username, the sheet and its lines, expiring after 120 days; no session, no filing: " + JSON.stringify([nosess.status, rec]));
  const again = await call("/quote", good);
  ok(again.status === 200 && JSON.parse(kv.m.get(keyOf(U1))).length === 1, "Q5 the same sheet and lines sent again is filed once");
  const prac = await call("/quote", good, { "X-Stmt-Session": tt }), pracBad = await call("/quote", bads[0], { "X-Stmt-Session": tt });
  ok(prac.status === 200 && prac.b.ok === true && pracBad.status === 400 && ![...kv.m.keys()].some((k) => k.includes(T.TEST_USER) && k.startsWith("quote:")),
    "Q5 a practice account's quote is answered ok and filed nowhere: " + JSON.stringify([prac.status, [...kv.m.keys()].filter((k) => k.startsWith("quote:"))]));

  const many = [];
  for (let i = 1; i < 32; i++) many.push((await call("/quote", { sheet: "m".repeat(7) + String(i).padStart(2, "0"), lines: [{ b: "salt", q: 1, p: 100 }] })).status);
  ok(many.slice(0, 29).every((s) => s === 200) && many[29] === 429 && many[30] === 429 && JSON.parse(kv.m.get(keyOf(U1))).length === 30,
    "Q6 thirty quotes a Kuala Lumpur day an account are filed and the 31st is refused: " + JSON.stringify(many.slice(27)));

  /* Q7: Place marks the line placed. A fresh account, so the day's cap is clear. */
  const U3 = "wxyz-abcd", tok3 = await O.mintSession(env, U3);
  await kv.put("u:" + U3, JSON.stringify({ prices: { digest: "d1" } }));
  const h3 = { "X-Stmt-Session": tok3 };
  await call("/quote", { sheet: "a1".repeat(16), lines: [{ b: "salt", q: 2, p: 90 }, { b: "oil", q: 1, p: 40 }] }, h3);
  await call("/quote", { sheet: "b2".repeat(16), lines: [{ b: "salt", q: 2, p: 90 }] }, h3);
  const place = (b) => call("/orders", { mode: "collect", digest: "d1", unit: 45, total: 90, week: "", ...b }, h3);
  const p1 = await place({ product: "salt", qty: 2, rid: rid("p1"), sheet: "a1".repeat(16) });
  const after1 = JSON.parse(kv.m.get(keyOf(U3)));
  const p2 = await place({ product: "salt", qty: 2, rid: rid("p2") });
  const after2 = JSON.parse(kv.m.get(keyOf(U3)));
  const p3 = await place({ product: "salt", qty: 4, total: 180, rid: rid("p3") });
  const after3 = JSON.parse(kv.m.get(keyOf(U3)));
  const flag = (r) => r.map((x) => x.lines.map((l) => l.placed === true ? 1 : 0).join("")).join("/");
  ok(p1.status === 200 && flag(after1) === "10/0" && p2.status === 200 && flag(after2) === "10/1" && p3.status === 200 && flag(after3) === "10/1" && !JSON.stringify(after3).includes('"placed":false'),
    "Q7 Place marks the line of the sheet the order carries, then by book and size, never a size nobody was shown: " + JSON.stringify([p1.status, p2.status, p3.status, flag(after1), flag(after2), flag(after3), p1.b && p1.b.error]));

  /* Q8: the reading, over a window */
  const k2 = new KV(), senv = { STMT: k2, STMT_DESK_KEY: "desk-key" };
  const entry = (u, lines) => JSON.stringify([{ at: "2026-11-01T00:00:00.000Z", u, sheet: SHEET, lines }]);
  await k2.put("quote:" + kl(0) + ":aaaa-bbbb", entry("aaaa-bbbb", [{ b: "salt", q: 1, p: 100, placed: true }, { b: "oil", q: 3, p: 115 }]));
  await k2.put("quote:" + kl(-1) + ":cccc-dddd", entry("cccc-dddd", [{ b: "salt", q: 1, p: 100 }, { b: "salt", q: 2.5, p: 250 }]));
  await k2.put("quote:" + kl(-5) + ":aaaa-bbbb", entry("aaaa-bbbb", [{ b: "salt", q: 1, p: 100, placed: true }]));
  await k2.put("quote:" + kl(-100) + ":aaaa-bbbb", entry("aaaa-bbbb", [{ b: "salt", q: 1, p: 100 }]));
  await k2.put("pool:x", "{}");
  const dk = { "X-Stmt-Desk": "desk-key" };
  const r30 = await call("/desk/quotes?days=30", undefined, dk, senv), r90 = await call("/desk/quotes", undefined, dk, senv), r1 = await call("/desk/quotes?days=1", undefined, dk, senv);
  const want30 = { salt: { "1": { shown: 3, placed: 2 }, "2.5": { shown: 1, placed: 0 } }, oil: { "3": { shown: 1, placed: 0 } } };
  ok(r30.status === 200 && r30.b.ok && r30.b.days === 30 && r30.b.to === kl(0) && r30.b.from === kl(-29) && JSON.stringify(r30.b.books) === JSON.stringify(want30)
    && r90.b.days === 90 && r90.b.books.salt["1"].shown === 3 && r1.b.days === 1 && r1.b.books.salt["1"].shown === 1 && r1.b.books.salt["1"].placed === 1 && !r1.b.books.salt["2.5"],
  "Q8 the Desk reading sums shown and placed by book and size over the days asked, 90 by default, and leaves the older days out: " + JSON.stringify([r30.b, r1.b]));
  const bad0 = await call("/desk/quotes?days=0", undefined, dk, senv), bad121 = await call("/desk/quotes?days=121", undefined, dk, senv), badx = await call("/desk/quotes?days=abc", undefined, dk, senv);
  ok([bad0, bad121, badx].every((r) => r.status === 400), "Q8 days outside 1 to 120 are refused 400");

  /* Q9 */
  const nokey = await call("/desk/quotes", undefined, {}, senv), wrong = await call("/desk/quotes", undefined, { "X-Stmt-Desk": "nope" }, senv), cust = await call("/desk/quotes", undefined, undefined, senv);
  const unset = await call("/desk/quotes", undefined, dk, { STMT: k2 });
  ok(nokey.status === 401 && wrong.status === 401 && cust.status === 401 && unset.status === 401 && !JSON.stringify([nokey.b, wrong.b, cust.b]).includes("salt"),
    "Q9 the Desk route needs X-Stmt-Desk: none, a wrong one, a customer's session and an unset key all refused, no figure in the answer: " + JSON.stringify([nokey.status, wrong.status, cust.status, unset.status]));

  /* Q10: the Desk's Worker relays it */
  const deskW = (await import("../src/worker.js")).default;
  const denv = (extra) => ({ REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "wk", STMT_DESK_KEY: "desk-key", STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), senv) }, ...(extra || {}) });
  const get = async (path, headers, e) => { const r = await deskW.fetch(new Request("https://salt.test" + path, { headers }), e, { waitUntil() {} }); let b = null; try { b = await r.json(); } catch (x) { b = null; } return { status: r.status, b }; };
  const g0 = await get("/quotes?days=30", {}, denv()), g1 = await get("/quotes?days=30", { "X-Salt-Key": "nope" }, denv());
  const g2 = await get("/quotes?days=30", { "X-Salt-Key": "wk" }, denv()), g3 = await get("/quotes", { "X-Salt-Key": "wk" }, denv()), g4 = await get("/quotes?days=500", { "X-Salt-Key": "wk" }, denv());
  const g5 = await get("/quotes?days=30", { "X-Salt-Key": "wk" }, denv({ STMT_SITE: undefined }));
  ok(g0.status === 401 && g1.status === 401 && g2.status === 200 && JSON.stringify(g2.b) === JSON.stringify(r30.b) && g3.b.days === 90 && g4.status === 400 && g5.status === 503 && g5.b.ok === false && /not configured/.test(g5.b.error),
    "Q10 the Desk's /quotes needs X-Salt-Key, relays the Counter's answer as it stands, passes a refusal on, and says 503 with no relay: " + JSON.stringify([g0.status, g1.status, g2.status, g3.b && g3.b.days, g4.status, g5.status]));
}
