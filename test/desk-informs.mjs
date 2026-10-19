/* test/desk-informs.mjs: SALT ADMIN ACTS, SALT DESK INFORMS (19 Oct 2026, the notifications plan P3-desk, P4 and P5).
 *
 * What waits on his decision wakes Salt Admin (the Counter's POST /desk/owner-wake, over the service binding); the Desk is rung only when Admin
 * cannot be woken, and drops its own order banners once Admin holds a subscribed device (KV admin:on, the summary's adminOn). The Desk still says
 * what informs: a refund he holds, and the system's own news (a fold live or refused, a suite red, a stock light), once each. The morning digest
 * stops counting rows to approve once Admin has a device. Each check below was proved red by its own mutation (test/desk-informs.mutations.json,
 * run with tools/section.mjs). Every code, address and id here is invented.
 */
class KV {
  constructor() { this.m = new Map(); this.opts = new Map(); }
  async put(k, v, o) { this.m.set(k, v); this.opts.set(k, o || null); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}

export async function run({ ok }) {
  const { readFileSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
  const vm = await import("node:vm");
  const O = await import("../stmt/orders.js");
  const { nudgeOrders } = await import("../src/orders.js");
  const stmtW = (await import("../stmt/worker.js")).default, deskW = await import("../src/worker.js");
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const vapid = { VAPID_PUBLIC_KEY: "pub", VAPID_SUBJECT: "mailto:a@b.test", VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey("jwk", kp.privateKey)) };

  /* ---- the Desk's side of the wake: the site is the real Counter worker, with the one route the Counter's builder adds stood in ---- */
  const wakes = [];
  let reply = { status: 200, body: { ok: true, sent: 1, failed: 0, devices: 0 } };
  const world = async () => {
    const skv = new KV(), dkv = new KV(), senv = { STMT: skv, STMT_DESK_KEY: "desk-key" };
    const env = Object.assign({ SALT_QUEUE: dkv, STMT_DESK_KEY: "desk-key", REQUIRE_ACCESS: "0",
      STMT_SITE: { fetch: async (url, init) => {
        if (new URL(url).pathname === "/desk/owner-wake") { wakes.push(JSON.parse(init.body)); return new Response(JSON.stringify(reply.body), { status: reply.status }); }
        return stmtW.fetch(new Request(url, init), senv); } } }, vapid);
    await dkv.put("push:his", JSON.stringify({ endpoint: "https://push.example/his-phone", topics: ["orders", "approve", "salt"] }));
    return { skv, dkv, senv, env };
  };
  const pushes = async (fn) => {
    const realF = globalThis.fetch, hit = [];
    globalThis.fetch = async (u) => { hit.push(String(u)); return new Response("", { status: 201 }); };
    try { await fn(); } finally { globalThis.fetch = realF; }
    return hit.filter((u) => u.startsWith("https://push.example/"));
  };
  const u = "abcd-efgh";
  const place = async (w, qty = 1) => (await O.placeOrder(w.senv, u, { product: "salt", qty, mode: "collect", unit: 100, total: 100 * qty, week: "" })).order;

  /* 1. NO ADMIN DEVICE: THE DESK IS RUNG AS IT ALWAYS WAS, AND THE FLAG IS CLEAR */
  {
    const w = await world(); wakes.length = 0; reply = { status: 200, body: { ok: true, sent: 0, failed: 0, devices: 0 } };
    await w.dkv.put("admin:on", "1");
    await place(w);
    let r; const hit = await pushes(async () => { r = await nudgeOrders(w.env); });
    ok(wakes.length === 1 && wakes[0].k === "order" && hit.length === 1 && !(await w.dkv.get("admin:on")) && r.sent === 1,
      "with no Salt Admin device a new order asks the Counter to wake it and, hearing none, still rings the Desk, and the flag is cleared: " + JSON.stringify({ wakes, hit, r }));
  }

  /* 2. AN ADMIN DEVICE: ADMIN IS USED, THE DESK IS NOT RUNG, THE FLAG IS SET FOR TWO DAYS */
  {
    const w = await world(); wakes.length = 0; reply = { status: 200, body: { ok: true, sent: 2, failed: 0, devices: 2 } };
    await place(w);
    let r; const hit = await pushes(async () => { r = await nudgeOrders(w.env); });
    ok(wakes.length === 1 && wakes[0].k === "order" && hit.length === 0 && r.sent === 2,
      "with a Salt Admin device the order wakes it and the Desk's phone is not rung: " + JSON.stringify({ wakes, hit, sent: r.sent }));
    ok((await w.dkv.get("admin:on")) === "1" && w.dkv.opts.get("admin:on") && w.dkv.opts.get("admin:on").expirationTtl === 2 * 86400,
      "and admin:on is set, for two days: " + JSON.stringify(w.dkv.opts.get("admin:on")));
  }

  /* 3. A WAKE THAT DID NOT GO THROUGH LEAVES THE DESK RINGING, AND DROPS THE FLAG (a banner the Desk would strip must not be the only one) */
  {
    const w = await world(); wakes.length = 0; reply = { status: 502, body: { ok: false } };
    await w.dkv.put("admin:on", "1");
    await place(w);
    let r; const hit = await pushes(async () => { r = await nudgeOrders(w.env); });
    ok(wakes.length === 1 && hit.length === 1 && !(await w.dkv.get("admin:on")),
      "a wake the Counter refuses falls back to the Desk's push and clears the flag, so the Desk shows the order itself: " + JSON.stringify({ wakes, hit }));
    const w2 = await world(); w2.env.STMT_SITE = null; wakes.length = 0;
    await place(w2);
    const hit2 = await pushes(async () => { await nudgeOrders(Object.assign({}, w2.env, { STMT_SITE: { fetch: (url, init) => (new URL(url).pathname === "/desk/owner-wake" ? Promise.reject(new Error("down")) : stmtW.fetch(new Request(url, init), w2.senv)) } })); });
    ok(hit2.length === 1, "and a relay that throws falls back the same way: " + JSON.stringify(hit2));
  }

  /* 4. THE KIND OF ACT RIDES THE WAKE: a payment, a withdrawal and a line each name their own */
  {
    const w = await world(); wakes.length = 0; reply = { status: 200, body: { ok: true, sent: 1, failed: 0, devices: 1 } };
    const o = await place(w);
    await pushes(async () => { await nudgeOrders(w.env); });
    wakes.length = 0;
    await O.customerMove(w.senv, u, o.id, "say", { text: "is it ready yet" });
    await pushes(async () => { await nudgeOrders(w.env); });
    const kSaid = wakes.map((x) => x.k); wakes.length = 0;
    await O.deskMove(w.senv, u, o.id, { status: "acknowledged", mode: "collect" });
    await O.customerMove(w.senv, u, o.id, "method", { method: "tngbiz", account: "tngbiz" });
    await O.customerMove(w.senv, u, o.id, "pay", { amount: 100 });
    await pushes(async () => { await nudgeOrders(w.env); });
    const kPaid = wakes.map((x) => x.k); wakes.length = 0;
    const o2 = await place(w, 2);
    await pushes(async () => { await nudgeOrders(w.env); });
    wakes.length = 0;
    await O.customerMove(w.senv, u, o2.id, "cancel", {});
    await pushes(async () => { await nudgeOrders(w.env); });
    const kCancel = wakes.map((x) => x.k);
    ok(kSaid.join() === "said" && kPaid.join() === "pay" && kCancel.join() === "cancel" && [...kSaid, ...kPaid, ...kCancel].every((k) => /^(order|pay|cancel|said|rate|take|pass|approve)$/.test(k)),
      "a line, a payment and a withdrawal each wake Admin under their own kind, from the set the Counter takes: " + JSON.stringify({ kSaid, kPaid, kCancel }));
    ok(wakes.every((x) => Object.keys(x).every((k) => ["k", "o", "t"].includes(k))), "and the body is {k, o?, t?} and nothing else: " + JSON.stringify(wakes));
  }

  /* 5. A ROW TO APPROVE: Admin first, the Desk only when it cannot be; a row his own yes approved wakes nobody */
  {
    const w = await world(); wakes.length = 0; reply = { status: 200, body: { ok: true, sent: 1, failed: 0, devices: 1 } };
    const hitA = await pushes(async () => { await deskW.pushIfDrafted(w.env, { drafted: 2, approved: [] }); });
    ok(wakes.length === 1 && wakes[0].k === "approve" && hitA.length === 0, "a drafted row wakes Salt Admin as approve, and the Desk is not rung: " + JSON.stringify({ wakes, hitA }));
    wakes.length = 0; reply = { status: 200, body: { ok: true, sent: 0, failed: 0, devices: 0 } };
    const hitB = await pushes(async () => { await deskW.pushIfDrafted(w.env, { drafted: 2, approved: [] }); });
    ok(wakes.length === 1 && hitB.length === 1, "and with no Admin device the Desk's approve push goes as before: " + JSON.stringify({ wakes, hitB }));
    wakes.length = 0;
    const hitC = await pushes(async () => { await deskW.pushIfDrafted(w.env, { drafted: 1, approved: ["x"] }); });
    ok(wakes.length === 0 && hitC.length === 0, "a row his own yes approved wakes nobody, Admin included: " + JSON.stringify({ wakes, hitC }));
  }

  /* ---- the summary and the banner ---- */
  const summaryOf = async (env, qs = "") => (await (await deskW.default.fetch(new Request("https://salt-command.example/push/summary" + qs), env)).json());
  const d1 = { prepare: (q) => { const first = async () => (/COUNT\(\*\)/.test(q) ? { n: 0 } : null); const all = async () => ({ results: [] });
    return { bind: () => ({ all, first, run: async () => ({}) }), all, first, run: async () => ({}) }; } };
  const swSrc = readFileSync(join(REPO, "public", "sw.js"), "utf8");
  const push = async (summary, data) => {
    const L = {}, shown = [], urls = [];
    const cell = (fn) => { const r = {}; Promise.resolve().then(() => { fn(r); if (r.onsuccess) r.onsuccess(); }); return r; };
    const idb = { open: () => { const rq = {}; Promise.resolve().then(() => { rq.result = { createObjectStore() {}, transaction: () => ({ objectStore: () => ({
      get: (k) => cell((r) => { r.result = data[k]; }), put: (v, k) => cell((r) => { data[k] = v; }) }) }) }; if (rq.onsuccess) rq.onsuccess(); }); return rq; } };
    const ctx = { URL, console, caches: {}, indexedDB: idb,
      self: { addEventListener: (t, f) => { L[t] = f; }, location: { origin: "https://salt-command.example" },
        registration: { scope: "https://salt-command.example/", showNotification: async (t, opt) => { shown.push({ t, opt }); } } },
      clients: { matchAll: async () => [], openWindow: async () => {} },
      fetch: async (url) => { urls.push(String(url)); return { ok: true, json: async () => summary }; } };
    vm.createContext(ctx); vm.runInContext(swSrc, ctx);
    const waits = []; L.push({ waitUntil: (pr) => waits.push(pr) }); await Promise.all(waits);
    return { shown, urls };
  };
  const quiet = { ok: true, pending: 0, refused: 0, refunds: 0, orders: 0, placed: 0 };
  const LINE = { at: "2026-10-19T03:00:00.000Z", t: "can I collect on Friday" };

  /* 6. THE SUMMARY SAYS WHETHER ADMIN HOLDS A DEVICE */
  {
    const kv = new KV(), env = { SALT_QUEUE: kv, SALT_LEDGER: d1, REQUIRE_ACCESS: "0" };
    const off = await summaryOf(env); await kv.put("admin:on", "1"); const on = await summaryOf(env);
    ok(off.adminOn === undefined && on.adminOn === true, "the summary carries adminOn only while admin:on is set: " + JSON.stringify([off.adminOn, on.adminOn]));
  }

  /* 7. WITH ADMIN ON, THE DESK DROPS WHAT WAITS ON HIS DECISION AND KEEPS WHAT INFORMS */
  {
    const all = Object.assign({}, quiet, { adminOn: true, placed: 2, orders: 3, pending: 2, refused: 1, news: "A customer says they paid", lines: [LINE] });
    const a = await push(all, {});
    ok(a.shown.length === 1 && a.shown[0].t === "Salt Desk is up to date" && a.shown[0].opt.tag === "salt",
      "with Salt Admin on, a new order, a payment, a line and rows to approve are not the Desk's: it shows only a quiet line so a push still shows one: " + JSON.stringify(a.shown.map((x) => [x.t, x.opt.tag])));
    const b = await push(Object.assign({}, all, { refunds: 2 }), {});
    ok(b.shown.length === 1 && b.shown[0].t === "Waiting on you" && b.shown[0].opt.body === "Now: pay back 2 refunds.",
      "and a refund he holds stays the Desk's, Now, with nothing about orders or rows beside it: " + JSON.stringify(b.shown.map((x) => [x.t, x.opt.body])));
    const store = {};
    await push(all, store);
    ok(store.since === undefined, "and a line Admin owns is not marked seen by the Desk: " + JSON.stringify(store));
    const c = await push(Object.assign({}, quiet, { placed: 1, orders: 1 }), {});
    ok(c.shown.length === 1 && c.shown[0].t === "New order", "without adminOn the Desk shows the new order as it always did: " + JSON.stringify(c.shown.map((x) => x.t)));
  }

  /* 8. THE SYSTEM'S OWN NEWS: its words, its page, shown once */
  {
    const INF = { folded: ["Folded and live", "./desk"], "fold-refused": ["A fold was refused", "./desk"], "suite-red": ["The suite failed on the live build", "./desk"], stock: ["A stock light changed", "./desk#stock"] };
    const got = {};
    for (const k of Object.keys(INF)) { const r = await push(Object.assign({}, quiet, { adminOn: true, inform: { k, at: "2026-10-19T04:00:00.000Z" } }), {}); got[k] = [r.shown[0] && r.shown[0].t, r.shown[0] && r.shown[0].opt.data.url]; }
    ok(Object.keys(INF).every((k) => got[k][0] === INF[k][0] && got[k][1] === INF[k][1]), "each inform names itself in its words and opens its page, Stock on its own view: " + JSON.stringify(got));
    const store = {}, inform = { k: "folded", at: "2026-10-19T04:00:00.000Z" };
    const first = await push(Object.assign({}, quiet, { adminOn: true, inform }), store);
    const second = await push(Object.assign({}, quiet, { adminOn: true, inform }), store);
    ok(first.shown[0].t === "Folded and live" && second.shown.length === 1 && second.shown[0].t === "Salt Desk is up to date" && /[?&]isince=/.test(second.urls[0]),
      "an inform is shown once: the mark moves with it and the next wake sends it back and shows the quiet line: " + JSON.stringify({ a: first.shown.map((x) => x.t), b: second.shown.map((x) => x.t), urls: second.urls }));
    const third = await push(Object.assign({}, quiet, { placed: 1, orders: 1, inform: { k: "suite-red", at: "2026-10-19T05:00:00.000Z" } }), {});
    ok(third.shown.map((x) => x.t).join() === "New order,The suite failed on the live build",
      "without adminOn the news stands beside the order, and All square never stands beside it: " + JSON.stringify(third.shown.map((x) => x.t)));
    const alone = await push(Object.assign({}, quiet, { inform: { k: "folded", at: "2026-10-19T05:00:00.000Z" } }), {});
    ok(alone.shown.map((x) => x.t).join() === "Folded and live", "and a quiet desk with news shows the news alone, no All square beside it: " + JSON.stringify(alone.shown.map((x) => x.t)));
    const unknown =await push(Object.assign({}, quiet, { adminOn: true, inform: { k: "<b>x</b>", at: "2026-10-19T05:00:00.000Z" } }), {});
    ok(unknown.shown.length === 1 && unknown.shown[0].t === "Salt Desk is up to date", "and a kind the worker does not know is not shown: " + JSON.stringify(unknown.shown.map((x) => x.t)));
  }

  /* 9. POST /push/send KEEPS THE LAST INFORM A DAY; THE SUMMARY HANDS IT OVER PAST THE MARK */
  {
    const kv = new KV(), env = Object.assign({ SALT_QUEUE: kv, SALT_LEDGER: d1, REQUIRE_ACCESS: "0" }, vapid);
    const send = async (tag) => { const hit = await pushes(async () => { await deskW.default.fetch(new Request("https://salt-command.example/push/send", { method: "POST", body: JSON.stringify({ tag }) }), env); }); return hit; };
    await send("orders");
    const none = await summaryOf(env);
    await send("fold-refused");
    const kept = await summaryOf(env), stored = await kv.get("inform:last", "json");
    ok(none.inform === undefined && kept.inform && kept.inform.k === "fold-refused" && /^\d{4}-\d\d-\d\dT/.test(kept.inform.at) && kv.opts.get("inform:last").expirationTtl === 86400 && stored.k === "fold-refused",
      "folded, fold-refused, suite-red and stock are kept a day as the last inform and a plain orders push is not: " + JSON.stringify({ none: none.inform, kept: kept.inform, ttl: kv.opts.get("inform:last") }));
    const past = await summaryOf(env, "?isince=" + encodeURIComponent(kept.inform.at));
    ok(past.inform === undefined, "past the mark the banner sends as ?isince=, the summary hands nothing over: " + JSON.stringify(past.inform));
    ok(!JSON.stringify(kept).match(/\b[A-Z]{2}\d{1,2}-[A-Z]{2,4}\b|RM\s?\d/), "and the inform carries a word and a moment, no code or amount");
  }

  /* 10. THE MORNING DIGEST NO LONGER COUNTS ROWS TO APPROVE ONCE ADMIN HOLDS A DEVICE, AND STILL COUNTS A REFUND */
  {
    const digest = async (pending, refunds, adminOn) => {
      const kv = new KV(); await kv.put("push:aa11", JSON.stringify({ endpoint: "https://push.example/his-phone" }));
      if (adminOn) await kv.put("admin:on", "1");
      const db = { prepare: (q) => { const first = async () => (/status='pending'/.test(q) ? { n: pending } : null);
        const all = async () => ({ results: /customerRefunds/.test(q) ? Array.from({ length: refunds }, () => ({ doc: JSON.stringify({ party: "CZ4-MK", amount: 20, since: "2026-09-10" }) })) : [] });
        return { bind: () => ({ all, first, run: async () => ({}) }), all, first, run: async () => ({}) }; } };
      const env = Object.assign({ SALT_QUEUE: kv, SALT_LEDGER: db }, vapid), realL = console.log, logs = [];
      console.log = (...x) => logs.push(x.join(" "));
      let hit; try { hit = await pushes(async () => { const waits = []; await deskW.default.scheduled({ cron: "0 1 * * *", scheduledTime: Date.parse("2026-10-20T01:00:00Z") }, env, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); }); } finally { console.log = realL; }
      return { hit, logs };
    };
    const a = await digest(2, 0, false), b = await digest(2, 0, true), c = await digest(2, 1, true);
    ok(a.hit.length === 1 && b.hit.length === 0 && b.logs.some((l) => /nothing worth saying/.test(l)),
      "the digest wakes for rows to approve until Salt Admin holds a device, then stays quiet: " + JSON.stringify([a.hit.length, b.hit.length, b.logs]));
    ok(c.hit.length === 1, "but a refund he holds still wakes it, with Admin on: " + JSON.stringify(c.hit.length));
  }
}
