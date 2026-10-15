/* test/engine-stages.mjs: S1b of the Book plan. THE ORDER STAGES' ENTRIES MOVE TO engine/stages.mjs, WHAT A TAP QUEUES DOES NOT. src/orders.js as it
   stood before the lift (OLD_ORDERS, read with git show into a temp dir, its engine copies with it) and the working src/orders.js are driven
   side by side over the same frozen book, one world each, the clock pinned: for every open order in the frozen book the handovers (full, part,
   close, the same again, the early one that redates its row), the payment they recorded, a claim of theirs (Received, not found, on the book
   already), cash, an amendment (above, under the floor), and the reconcile's job for each stage; Accept at the placed total and at a total he
   sets, and under the floor; and a claim against the account row by row. What each returns, every preapproval, draft, queued entry and post to
   the site must be byte-equal. The pure functions are also called on frozen inputs, and the module's boundaries are asserted. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { readBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";

export const OLD_ORDERS = "f61c5504";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 });
const at = (p) => pathToFileURL(join(REPO, p)).href;

/* src/orders.js as it was, its relative imports made absolute; the two engine files it reads are the old copies, so a change to
   engine/position.mjs shows up as a difference rather than moving both sides */
function oldFiles(dir) {
  const eng = (f) => { const p = join(dir, "old-" + f); writeFileSync(p, git("show", OLD_ORDERS + ":engine/" + f)); return pathToFileURL(p).href; };
  const pos = eng("position.mjs"), pri = eng("pricing.mjs");
  const text = git("show", OLD_ORDERS + ":src/orders.js")
    .replace(/from "\.\.\/engine\/position\.mjs"/g, `from "${pos}"`).replace(/from "\.\.\/engine\/pricing\.mjs"/g, `from "${pri}"`)
    .replace(/from "\.\/([^"]+)"/g, (_, p) => `from "${at("src/" + p)}"`);
  const file = join(dir, "orders-old.mjs");
  writeFileSync(file, text);
  return pathToFileURL(file).href;
}

class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) { return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}

/* the clock: every `new Date()` and Date.now() reads CLOCK, which a step moves on by a minute */
const RealDate = Date;
let CLOCK = RealDate.UTC(2026, 9, 16, 3, 0, 0);
class FixedDate extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(CLOCK); }
  static now() { return CLOCK; }
}

/* the statements site, as far as the desk talks to it: the orders and claims it lists, and every post recorded */
function mockSite(orders, claims) {
  const posts = [];
  const state = { orders: orders.map((o) => structuredClone(o)), claims: (claims || []).map((c) => structuredClone(c)) };
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  return { posts, state,
    fetch: async (url, init) => {
      const u = new URL(url), p = u.pathname, method = (init && init.method) || "GET";
      if (method === "GET" && p === "/desk/orders") return json({ ok: true, orders: state.orders });
      if (method === "GET" && p === "/desk/claims") return json({ ok: true, claims: state.claims });
      const body = JSON.parse((init && init.body) || "{}");
      const m = /^\/desk\/(orders|claims)\/([^/]+)\/([^/]+)$/.exec(p);
      if (method === "POST" && m) {
        posts.push({ p, body });
        if (m[1] === "orders") {
          const o = state.orders.find((x) => x.id === decodeURIComponent(m[3])) || { u: decodeURIComponent(m[2]) };
          const next = Object.assign({}, o);
          if (body.handover) { next.moved = body.handover.units; if (body.handover.close) next.total = body.handover.total; }
          if (body.cash) next.paid = +((+o.paid || 0) + body.cash.amount).toFixed(2);
          if (body.status) next.status = body.status;
          if (body.mark && body.mark.ledgerKey) next.ledgerKey = body.mark.ledgerKey;
          return json({ ok: true, order: next, push: null });
        }
        const c = state.claims.find((x) => x.id === decodeURIComponent(m[3])) || { u: decodeURIComponent(m[2]) };
        return json({ ok: true, claim: Object.assign({}, c, { state: "answered" }), push: null });
      }
      return json({ ok: false, error: "unmocked " + method + " " + p }, 404);
    } };
}

const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };

export async function run({ ok }) {
  if (git("rev-parse", "--is-shallow-repository").trim() === "true") { ok(true, "S1b: no history in this clone (shallow): the lift is proved on the laptop"); return; }
  const dir = mkdtempSync(join(tmpdir(), "engstages-"));
  const realDate = globalThis.Date;
  try {
    const OLD = await import(oldFiles(dir));
    const NEW = await import(at("src/orders.js") + "?stages");
    const S = await import(at("engine/stages.mjs") + "?direct");
    const D = await import(at("src/drafter.js"));
    const E = (await import(at("engine/position.mjs"))).default;
    const src = await readBook();
    const ledger = JSON.parse(JSON.stringify(src.ledger));
    const seedSql = buildSeed({ v: src.version, stamped: ledger.stamped || null, ledger }).sql;
    const migrations = join(REPO, "migrations");
    const migSql = readdirSync(migrations).filter((x) => /^\d+_.*\.sql$/.test(x)).sort().map((f) => readFileSync(join(migrations, f), "utf8"));

    /* ---- the orders: one for every open sale in the frozen book ---- */
    const open = Object.values(ledger.OPEN.byKey).filter((r) => r.dir === "S");
    const rows = open.map((r) => ledger.sales.find((s) => s.rid === r.rid)).filter(Boolean);
    const pad = (n) => String(n).padStart(3, "0");
    const mkOrder = (r, i, extra = {}) => {
      const t0 = (r.date || "2026-10-01") + "T02:00:00.000Z";
      return Object.assign({ id: "2026101500" + pad(i) + "-" + r.rid, u: "u" + pad(i) + "-aaaa", code: r.customer, status: "acknowledged", product: r.product || "salt",
        qty: r.qty, total: r.total, delivery: r.delivery || 0, mode: "collect", forFriend: false, ledgerKey: E.ovKey(r), moved: r.deliveredQty || 0, movedOn: null,
        paid: r.cash || 0, claimed: 0, payments: [], at: t0, history: [{ at: t0, status: "acknowledged", by: "desk" }],
        queued: { ack: t0, paid: r.cash || 0, moved: r.deliveredQty || 0 } }, extra);
    };
    const orders = rows.map((r, i) => mkOrder(r, i));

    /* one world: the mirror seeded from the frozen book, a queue, a site that lists what it is given */
    const world = (list, claims) => {
      const db = new DatabaseSync(":memory:");
      for (const m of migSql) db.exec(m);
      db.exec(seedSql);
      const D1 = { batch(sts) { db.exec("BEGIN IMMEDIATE"); try { const out = sts.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; } },
        prepare(sql) { const st = db.prepare(sql);
          const mk = (a) => ({ async run() { return { meta: { changes: Number(st.run(...a).changes || 0) } }; }, async first() { const r = st.get(...a); return r === undefined ? null : r; }, async all() { return { results: st.all(...a) }; } });
          const self = mk([]); self.bind = (...a) => mk(a); return self; } };
      const queue = new Store(), site = mockSite(list, claims);
      const users = {}; for (const o of list) users[o.u] = o.code; for (const c of claims || []) users[c.u] = c.code;
      queue.values.set("stmt-users", JSON.stringify(users));
      const env = { SALT_LEDGER: D1, SALT_QUEUE: queue, STMT_SITE: { fetch: site.fetch }, STMT_DESK_KEY: "engine-stages-fixture-key" };
      const dump = () => JSON.stringify({ draft: db.prepare("SELECT * FROM draft ORDER BY id").all(), pre: db.prepare("SELECT * FROM preapproval ORDER BY id").all(),
        queue: [...queue.values.entries()].filter(([k]) => k !== "stmt-users").sort(), posts: site.posts });
      return { env, site, db, dump };
    };
    /* one step: the clock moves on, the call is made, and what it returned and left behind is kept */
    const stepper = (M, w, log) => async (tag, f) => {
      CLOCK += 60000;
      let res; try { res = await f(M, w.env, new Date()); } catch (e) { res = { threw: String(e && e.message || e) }; }
      log.push({ tag, res: JSON.stringify(res), dump: w.dump() });
    };

    /* the steps on one open order, the same for the old module and the new */
    async function onOrder(M, o, row) {
      const w = world([o], []), log = [], step = stepper(M, w, log);
      const set = (patch) => { Object.assign(w.site.state.orders[0], patch); };
      const owed = +((+o.total + (+o.delivery || 0)) - (+o.paid || 0)).toFixed(2);
      const half = +(Math.round(o.qty / 2 * 100) / 100).toFixed(2);
      await step("handed full", (m, env, now) => m.handedOrder(env, o.id, { qty: o.qty }, "desk", now));
      await step("handed part", (m, env, now) => m.handedOrder(env, o.id, { qty: half }, "desk", now));
      await step("handed close", (m, env, now) => m.handedOrder(env, o.id, { qty: o.moved > 0 ? o.moved : half, close: true }, "desk", now));
      await step("handed same", (m, env, now) => m.handedOrder(env, o.id, { qty: o.moved }, "desk", now));
      await step("handed bad", (m, env, now) => m.handedOrder(env, o.id, { qty: o.qty + 5 }, "desk", now));
      set({ paid: o.paid + 10 });
      await step("received their payment", (m, env, now) => m.receivedOrder(env, o.id, { amount: 10 }, "desk", now));
      set({ paid: o.paid, claimed: 12, payments: [{ at: "2026-10-16T01:00:00.000Z", amount: 12, claim: "waiting", method: "transfer", account: "maybank" }] });
      await step("received their claim", (m, env, now) => m.receivedOrder(env, o.id, { amount: 12 }, "desk", now));
      await step("claim wrong amount", (m, env, now) => m.receivedOrder(env, o.id, { amount: 13 }, "desk", now));
      await step("claim not found", (m, env, now) => m.notFoundOrder(env, o.id, { amount: 12 }, now));
      await step("claim on the book already", (m, env, now) => m.receivedOrder(env, o.id, { amount: 12, covered: true }, "desk", now));
      set({ claimed: 0, payments: [] });
      await step("cash", (m, env, now) => m.cashOrder(env, o.id, { amount: Math.max(1, Math.min(50, owed)) }, "desk", now));
      await step("cash over", (m, env, now) => m.cashOrder(env, o.id, { amount: owed + 100 }, "desk", now));
      await step("restate under the floor", (m, env, now) => m.restateOrder(env, o.id, { total: 1 }, "desk", now));
      await step("restate same", (m, env, now) => m.restateOrder(env, o.id, {}, "desk", now));
      await step("restate size", (m, env, now) => m.restateOrder(env, o.id, { qty: o.qty + 0.5, total: o.total + 80 }, "desk", now));
      await step("restate above", (m, env, now) => m.restateOrder(env, o.id, { total: o.total + 10 }, "desk", now));
      const read = (extra) => ({ ok: true, owing: [Object.assign({}, o, extra)] });
      await step("reconcile move", (m, env) => m.reconcileOrders(env, read({ work: ["move"], moved: half, movedOn: "2026-10-16", movedAt: "2026-10-16T02:30:00.000Z" })));
      /* a handover he rejects under Approve is offered again: the drafter drafts the queue, he rejects the row, the same move goes round once more */
      set({ moved: half });
      await step("draft the queue", (m, env) => D.runDrafter(env));
      await step("reject the handover", () => w.db.prepare("UPDATE draft SET status='rejected', decided_by='he' WHERE entry LIKE ?").run('%"status":"Handover"%').changes);
      await step("again handover", (m, env, now) => m.againOrder(env, o.id, { stage: "move" }, "desk", now));
      await step("reconcile pay", (m, env) => m.reconcileOrders(env, read({ work: ["pay"], paid: o.paid + 7, payments: [{ at: "2026-10-16T02:00:00.000Z", amount: 7, method: "cash" }], method: "cash" })));
      await step("reconcile close", (m, env) => m.reconcileOrders(env, read({ work: ["close"], qty: half, moved: half, total: +(o.total / 2).toFixed(2), closed: { at: "2026-10-16T02:40:00.000Z", qty: o.qty, total: o.total } })));
      await step("reconcile claim", (m, env) => m.reconcileOrders(env, read({ work: ["claim"], tell: { claims: [{ at: "2026-10-16T01:00:00.000Z", amount: 12, method: "transfer", account: "maybank" }] } })));
      await step("reconcile withdrawn by them", (m, env) => m.reconcileOrders(env, read({ work: ["cancel"], status: "cancelled",
        history: o.history.concat([{ at: "2026-10-16T02:50:00.000Z", status: "cancelled", by: "customer" }]) })));
      await step("reconcile declined by him", (m, env) => m.reconcileOrders(env, read({ work: ["cancel"], status: "declined",
        history: o.history.concat([{ at: "2026-10-16T02:55:00.000Z", status: "declined", by: "desk" }]) })));
      await step("reconcile friend", (m, env) => m.reconcileOrders(env, read({ work: ["move"], forFriend: true, moved: half, movedOn: "2026-10-16" })));
      return { log, w };
    }

    /* the early handover: a wanted-day order whose row is dated its acknowledgement, handed over on a later day */
    async function redate(M, o) {
      const w = world([o], []), log = [], step = stepper(M, w, log);
      await step("redate handed", (m, env, now) => m.handedOrder(env, o.id, { qty: o.qty }, "desk", now));
      await step("redate handed part", (m, env, now) => m.handedOrder(env, o.id, { qty: +(o.qty / 2).toFixed(2) }, "desk", now));
      await step("redate close", (m, env, now) => m.handedOrder(env, o.id, { qty: +(o.qty / 2).toFixed(2), close: true }, "desk", now));
      await step("redate reconcile", (m, env) => m.reconcileOrders(env, { ok: true, owing: [Object.assign({}, o, { work: ["move"], moved: o.qty, movedOn: "2026-10-16", movedAt: "2026-10-16T02:30:00.000Z" })] }));
      const queued = [...w.env.SALT_QUEUE.values.entries()].filter(([k]) => k.startsWith("q:orders:")).map(([, v]) => JSON.parse(v).queue[0]);
      const re = queued.find((e) => e.redate);
      /* the redate in flight: the order names the row's new key and the redate entry's id, then a later stage is previewed against it */
      if (re) {
        w.site.state.orders[0].queued = Object.assign({}, o.queued, { redate: re.at, moved: 0 });
        w.site.state.orders[0].ledgerKey = S.keyAfter(o, re);
        w.site.state.orders[0].paid = o.paid + 10;
        await step("redate then a payment", (m, env, now) => m.receivedOrder(env, o.id, { amount: 10 }, "desk", now));
        await step("redate rejected, key given back", (m, env, now) => m.rejectedOnOrder(env, re, now.toISOString()));
      }
      return { log, w };
    }

    /* Accept, on placed orders, at the placed total and at a total he sets */
    async function accept(M) {
      const sizes = [["salt", 1, "collect"], ["salt", 6.25, "deliver"], ["oil", 10, "collect"], ["rice", 5, "deliver"]];
      const mkPlaced = (p, i) => {
        const fl = D.floorFor({ pricing: ledger.PRICING }, p[0], p[1]);
        const placed = +(fl.floor * 1.6).toFixed(2);
        return { floor: fl.floor, o: { id: "2026101600" + pad(i) + "-acc" + i, u: "p" + pad(i) + "-aaaa", code: "CN3-WM", status: "placed", product: p[0], qty: p[1], total: placed, delivery: 0,
          mode: p[2], forFriend: false, at: "2026-10-16T01:00:00.000Z", history: [{ at: "2026-10-16T01:00:00.000Z", status: "placed", by: "customer" }], queued: {}, unit: placed / p[1] } };
      };
      const ps = sizes.flatMap((s, i) => [mkPlaced(s, 2 * i), mkPlaced(s, 2 * i + 1)]);
      const w = world(ps.map((x) => x.o), []), log = [], step = stepper(M, w, log);
      for (let k = 0; k < ps.length; k++) {
        const { floor, o } = ps[k], dv = o.mode === "deliver" ? 10 : 0, label = o.product + " " + o.qty, hashes = {};
        const total = +(floor + 5).toFixed(2), prev = (name, body) => step("preview " + name + " " + label,
          async (m, env, now) => { const r = await m.previewOrder(env, o.id, body, now); hashes[name] = r.hash; return r; });
        if (k % 2 === 0) {   /* at the placed total */
          await prev("placed", { delivery: dv });
          await prev("set under", { delivery: dv, total: +(floor - 3).toFixed(2) });
          await prev("set bad", { delivery: dv, total: -4 });
          await prev("raise", { delivery: dv, total: o.total + 20 });
          await step("accept placed " + label, (m, env, now) => m.acceptOrder(env, o.id, { delivery: dv, hash: hashes.placed }, "desk", now));
          if (k === 0) await step("accept again", (m, env, now) => m.acceptOrder(env, o.id, { delivery: dv, hash: hashes.placed }, "desk", now));
        } else {   /* at a total he sets */
          await prev("set", { delivery: dv, total });
          await step("accept under " + label, (m, env, now) => m.acceptOrder(env, o.id, { delivery: dv, total: +(floor - 3).toFixed(2), hash: hashes.set }, "desk", now));
          await step("accept raise " + label, (m, env, now) => m.acceptOrder(env, o.id, { delivery: dv, total: o.total + 20, hash: hashes.set }, "desk", now));
          await step("accept set " + label, (m, env, now) => m.acceptOrder(env, o.id, { delivery: dv, total, hash: hashes.set }, "desk", now));
        }
      }
      return { log, w };
    }

    /* a claim against the account, row by row: the preview, the tap, its retry and the claim not found */
    async function claims(M) {
      const mine = orders.filter((o) => ["CN3-WM", "CA4-DAM"].includes(o.code));
      const U = { "CN3-WM": "cn3w-aaaa", "CA4-DAM": "ca4d-aaaa" };
      const cl = (id, code, amount) => ({ id, u: U[code], code, amount, method: "transfer", account: "maybank", at: "2026-10-16T01:00:00.000Z", state: "waiting" });
      const cs = [cl("k1", "CN3-WM", 200), cl("k2", "CA4-DAM", 5000), cl("k3", "CN3-WM", 60), cl("k4", "CA4-DAM", 90)];
      const w = world(mine.map((o) => Object.assign({}, o, { u: U[o.code] })), cs), log = [], step = stepper(M, w, log);
      const hashes = {};
      for (const c of cs) await step("claim preview " + c.id, async (m, env) => { const r = await m.claimPreview(env, c.id); hashes[c.id] = r.hash; return r; });
      await step("claim received k1", (m, env, now) => m.claimReceived(env, "k1", { hash: hashes.k1 }, "desk", now));
      await step("claim received k1 again", (m, env, now) => m.claimReceived(env, "k1", { hash: hashes.k1 }, "desk", now));
      await step("claim received k2 over", (m, env, now) => m.claimReceived(env, "k2", { hash: hashes.k2 }, "desk", now));
      await step("claim received k2 covered", (m, env, now) => m.claimReceived(env, "k2", { covered: true }, "desk", now));
      await step("claim received k3 wrong hash", (m, env, now) => m.claimReceived(env, "k3", { hash: "0".repeat(64) }, "desk", now));
      await step("claim not found k4", (m, env) => m.notFoundClaim(env, "k4", { amount: 90 }));
      await step("fixture claim preview", (m) => m.fixtureClaimPreview({ prepared: true, account: { sales: rows.filter((r) => r.customer === "CN3-WM"), claims: [{ id: "fx1", u: "0000-0000", amount: 300, state: "waiting" }], revision: 3 },
        orders: mine.map((o) => Object.assign({}, o, { u: "0000-0000" })) }, "0000-0000", "fx1", 7));
      return { log, w };
    }

    /* ---- the early-handover order: a wanted-day order dated its acknowledgement, on a row not yet moved ---- */
    const rIdx = rows.findIndex((r) => r.customer === "CC9-OKR" && !(r.deliveredQty > 0));
    const redateOrder = rIdx >= 0 ? mkOrder(rows[rIdx], 90, { wantBy: "2026-10-20" }) : null;

    globalThis.Date = FixedDate;
    const results = { old: [], neu: [] };
    for (const [key, M] of [["old", OLD], ["neu", NEW]]) {
      CLOCK = RealDate.UTC(2026, 9, 16, 3, 0, 0);
      const out = [];
      for (let i = 0; i < orders.length; i++) out.push({ name: "order " + rows[i].rid, ...(await onOrder(M, orders[i], rows[i])) });
      if (redateOrder) out.push({ name: "redate", ...(await redate(M, redateOrder)) });
      out.push({ name: "accept", ...(await accept(M)) });
      out.push({ name: "claims", ...(await claims(M)) });
      results[key] = out;
    }
    globalThis.Date = realDate;

    /* ---- byte-equal, step by step ---- */
    let steps = 0, equal = 0;
    const bad = [];
    for (let i = 0; i < results.old.length; i++) {
      const a = results.old[i], b = results.neu[i];
      for (let j = 0; j < Math.max(a.log.length, b.log.length); j++) {
        steps++;
        const x = a.log[j], y = b.log[j];
        if (x && y && x.tag === y.tag && x.res === y.res && x.dump === y.dump) equal++;
        else if (bad.length < 5) bad.push(a.name + " / " + (x && x.tag));
      }
    }
    ok(steps > 300 && equal === steps, `S1b: ${equal} of ${steps} stage steps return and queue byte-equal to src/orders.js before the lift (${results.old.length} worlds)${bad.length ? ": " + bad.join(", ") : ""}`);

    /* the proof is not vacuous: the stages did make the entries, on the new side */
    const all = results.neu.flatMap((r) => r.log.map((s) => ({ ...s, world: r.name })));
    const said = (tag, re) => all.some((s) => s.tag.startsWith(tag) && re.test(s.dump.replace(/\\"/g, '"')));
    const saidRes = (tag, re) => all.some((s) => s.tag.startsWith(tag) && re.test(s.res));
    const kinds = [["handed full", /"figures":\{"units":\d/], ["handed close", /"close":true/], ["received their payment", /"figures":\{"amount":10\}/], ["reconcile move", /"status":"Handover"/], ["reconcile close", /"status":"Close"/], ["cash", /"counter":true/],
      ["restate size", /"status":"Amendment"/], ["reconcile withdrawn", /"status":"Cancellation"/]];
    const missing = kinds.filter(([tag, re]) => !said(tag, re)).map(([tag]) => tag);
    ok(all.some((s) => s.tag === "again handover" && /"again":"/.test(s.res)), "S1b: a handover he rejected is offered again under a fresh moment");
    ok(!missing.length, "S1b: a handover, a close, a payment, cash, an amendment and a cancellation each reach the queue or the pre-approvals" + (missing.length ? " (missing: " + missing.join(", ") + ")" : ""));
    ok(said("redate reconcile", /"redate":true/) && said("redate reconcile", /"mark":\{[^}]*"redate":"/) && said("redate rejected", /"mark":\{"sync":\{"state":"rejected"[^}]*\},"ledgerKey":"CC9-OKR\|2026-10-15\|575"\}/),
      "S1b: an early handover redates its row, marks the new key and, rejected, gives the old key back");
    ok(said("redate then a payment", /"waits":true/), "S1b: a stage after a redate waits against the redated row");
    const fl1 = D.floorFor({ pricing: ledger.PRICING }, "salt", 1).floor;
    ok(said("accept set salt 1", new RegExp('"total":' + (fl1 + 5) + ',"status":"Pending"')) && !said("accept placed salt 1", new RegExp('"total":' + (fl1 + 5) + ',"status":"Pending"'))
      && saidRes("accept under salt 1", /"underFloor":true/) && saidRes("preview set bad", /the price has to be a figure above nothing/) && saidRes("accept raise", /their price or changes their window/),
      "S1b: Accept drafts the pending row at the total he sets (and the placed one at the placed total), and refuses one under the floor, not a figure, or a raise");
    ok(JSON.parse(all.find((s) => s.tag === "preview set salt 1").res).quote === fl1 + 5 && JSON.parse(all.find((s) => s.tag === "preview placed salt 1").res).quote === +(fl1 * 1.6).toFixed(2),
      "S1b: the preview at a total he sets quotes that total, the placed one the placed total");
    const k1 = JSON.parse(all.find((s) => s.tag === "claim preview k1").res);
    const dates = (k1.rows || []).map((r) => r.date);
    ok(dates.length >= 2 && dates.every((d, i) => i === 0 || dates[i - 1] <= d) && JSON.parse(all.find((s) => s.tag === "claim received k1").res).approved !== undefined,
      "S1b: a claim against the account settles the oldest row first, and its one tap books those rows: " + dates.join(","));

    /* ---- the functions are pure: frozen inputs, and the same answers as unfrozen ---- */
    const o0 = orders.find((o) => o.moved > 0) || orders[0];
    const book = { sales: ledger.sales, state: { OPEN: ledger.OPEN }, pricing: ledger.PRICING, version: src.version };
    const when = new RealDate("2026-10-16T03:00:00.000Z");
    const calls = [
      (f) => S.handoverTap(f(o0), { qty: o0.qty }, when, null), (f) => S.handoverTap(f(o0), { qty: o0.moved + 0.5, close: true }, when, null),
      (f) => S.receivedTap(f(Object.assign({}, o0, { paid: o0.paid + 10 })), when, { amount: 10 }, { queued: [], shut: new Set(), onRows: {}, rej: null, room: null }),
      (f) => S.cashTap(f(o0), when, { amount: 1 }, { rej: null, room: null }),
      (f) => S.restateTap(f(o0), when, { total: o0.total + 5 }, { book: f(book), room: null, earlier: [], live: null }),
      (f) => S.acceptEntry(f(Object.assign({}, o0, { status: "placed", mode: "deliver" })), "CN3-WM", 10, 120, when), (f) => S.floorRefusal(1, { floor: 50, at: 1, exact: true }, 1),
      (f) => S.stageAgainst(f(book), { payload: { orderKey: "x|y|1" } }, null, { row: JSON.stringify({ customer: "CN3-WM", date: "2026-10-16", qty: 1, total: 1 }), status: "pending" }),
      (f) => S.jobEntry("move", f(o0), "CN3-WM", 0, when), (f) => S.jobEntry("close", f(Object.assign({}, o0, { closed: { qty: 1 } })), "CN3-WM", 0, when),
      (f) => S.claimRows(f(book), { id: "k", code: "CN3-WM", amount: 100, at: "2026-10-16T01:00:00.000Z", method: "t" }, f({ by: {}, ready: [] })),
      (f) => S.claimOrderFlight(f(ledger.sales.slice(0, 20)), f(orders), o0.u), (f) => S.againEntry(f({ payload: { orderKey: E.ovKey(ledger.sales[0]) }, status: "Handover" }), f(o0), when)
    ];
    let pure = 0, same = 0;
    for (const call of calls) {
      pure++;
      try { const a = JSON.stringify(call((x) => deepFreeze(structuredClone(x)))), b = JSON.stringify(call((x) => structuredClone(x))); if (a === b && a !== undefined) same++; } catch (e) { /* a mutation of an input throws on a frozen one */ }
    }
    ok(same === pure, `S1b: ${same} of ${pure} stage functions leave frozen inputs alone and answer as on thawed ones`);

    /* ---- boundaries ---- */
    const text = readFileSync(join(REPO, "engine", "stages.mjs"), "utf8");
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "");
    ok(!/\b(env|fetch|SALT_QUEUE|SALT_LEDGER|crypto|localStorage)\b/.test(code) && !/Date\.now\(\)/.test(code.replace(/new Date\(now \|\| Date\.now\(\)\)/g, "")),
      "S1b: engine/stages.mjs touches no env, store, fetch or crypto, and reads the clock only as the moment it is handed");
    const stmt = readdirSync(join(REPO, "stmt")).filter((f) => /\.js$/.test(f)).filter((f) => /stages\.mjs/.test(readFileSync(join(REPO, "stmt", f), "utf8")));
    const eng = readFileSync(join(REPO, "tools", "engine.mjs"), "utf8");
    ok(!stmt.length && !/stages\.mjs/.test(eng), "S1b: nothing under stmt/ imports engine/stages.mjs and tools/engine.mjs does not carry it into the master");
  } finally { globalThis.Date = realDate; rmSync(dir, { recursive: true, force: true }); }
}
