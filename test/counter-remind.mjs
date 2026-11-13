/* test/counter-remind.mjs: THE REMINDER TO A LATE REGULAR, the price band's version 3 (his answers of 13 Nov 2026: one automatic reminder a cycle to a
 * late regular, never while they owe; the words "Time for more? Your usual is one tap away."; its tap opens Order at their usual; a cycle is their last
 * order day, reminded once until they order again). The publish writes the list, the hourly cron sends once a day at 10:00 Kuala Lumpur, the banner's
 * tap opens Order. The real publish plan, the real Worker on a KV of its own with real phone keys, the service worker's own script and the real page in
 * jsdom. Every username and code here is invented or a code the book already shows. Each check is proved red by its own mutation
 * (test/counter-remind.mutations.json).
 *   R1  who goes into `remind`: late and lapsed, owing nothing, each by their last order day; early and due, an owing habit, an owing statement, a partner,
 *       a bucket, a code with no username, a practice account, a habit with no last day, a written-off party, a banned or departed one, one with an order open on the book and a code the sheet does not read stay out
 *   R3  the publish reads the banned and departed off the book
 *   R2  the real plan: planPublish puts `remind` from the snapshot's habits and the sheet's owed, and puts none without a snapshot
 *   W1  the cron at 10:00 sends one wake of kind remind, sealed {k, o} and nothing else, and files `reminded:<username>` as the cycle day for 120 days
 *   W2  a second tick in the same hour sends nothing
 *   W3  no wake at any other hour
 *   W4  a new order day is a new cycle and is reminded again; the same cycle the next day is not
 *   W5  a practice account is never reminded, nor marked
 *   W6  a customer the chase is waking this hour hears the chase alone, and is not marked
 *   W8  never to a customer with an order open on the Counter, checked at the send
 *   W7  the words are his, with no product word, figure or name
 *   S1  the service worker shows the words under the kind's own tag and a tap address that names Order
 *   S2  its tap opens the page at that address, or tells an open page to open Order
 *   P1  the page opened at that address lands on Order once they are in, and clears the address
 *   P2  with no such address it stays on Home
 *   P3  where nothing can be ordered (the overdue gate) it stays off Order
 *   P4  a page already open, told by the service worker, opens Order */
import vm from "node:vm";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { open, done, ord, until, kl, ago } from "./counter-b-kit.mjs";
import { endpointId } from "../stmt/push.js";

const b64u = (a) => Buffer.from(a).toString("base64url");
const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const te = new TextEncoder();
const hk = async (salt, ikm, info, n) => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info },
  await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), n * 8));
async function phone() {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  const read = async (msg) => {
    const salt = msg.slice(0, 16), idlen = msg[20], asPub = msg.slice(21, 21 + idlen), ct = msg.slice(21 + idlen);
    const asKey = await crypto.subtle.importKey("raw", asPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey }, kp.privateKey, 256));
    const ikm = await hk(auth, secret, cat(te.encode("WebPush: info"), [0], pub, asPub), 32);
    const cek = await hk(salt, ikm, cat(te.encode("Content-Encoding: aes128gcm"), [0]), 16), nonce = await hk(salt, ikm, cat(te.encode("Content-Encoding: nonce"), [0]), 12);
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]), ct));
    let end = pt.length - 1; while (end > 0 && pt[end] === 0) end--;
    return JSON.parse(new TextDecoder().decode(pt.slice(0, end)));
  };
  return { keys: { p256dh: b64u(pub), auth: b64u(auth) }, read };
}

class KV {
  constructor() { this.m = new Map(); this.opts = new Map(); }
  async put(k, v, o) { this.m.set(k, v); this.opts.set(k, o || null); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) { return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}
const J = JSON.stringify;
/* his words of 11 Nov 2026, the title a question and the body the rest, as every banner is built (the banner rule: a title is one phrase) */
const WORDS_EXACT = "Time for more?", BODY_EXACT = "Your usual is one tap away.";

export async function run({ ok, pageWork }) {
  const { remindMap, planPublish } = await import("../tools/stmt-publish.mjs");

  /* ---- R1: who goes in ---- */
  const UA = "abcd-efgh", UB = "jkmn-pqrs", UC = "wxyz-abcd", UD = "cdef-ghjk", UE = "mnpq-rstv", UF = "wxyz-bcde", UG = "bcde-fghj", UT = "0000-0000";
  const hab = (state, last, owes = 0) => ({ state, gap: 7, usual: 2.5, last, since: 20, next: last, margin30: 100, owes });
  const sheet = ["LA1-AA", "LB1-BB", "EA1-EA", "DA1-DA", "OH1-OH", "OS1-OS", "PA1-PP", "LU1-UU", "TT1-TT", "LR1-RR-R", "BD1-BD", "WO1-WO", "BN1-BN", "OP1-OP"].map((code) => ({ code, t: { owed: code === "OS1-OS" ? 40 : 0, pend: code === "OP1-OP" ? 120 : 0, toGet: 0 } }));
  /* username to code, as the publish holds it (usersMap) */
  const users = { [UA]: "LA1-AA", [UB]: "LB1-BB", [UC]: "EA1-EA", [UD]: "DA1-DA", [UE]: "OH1-OH", [UF]: "OS1-OS", [UG]: "PA1-PP", [UT]: "TT1-TT", "hjkm-npqr": "LR1-RR-R", "pqrs-tvwx": "NS1-NS", "bcde-2345": "BD1-BD", "cdef-2345": "WO1-WO", "dfgh-2345": "BN1-BN", "efgh-2345": "OP1-OP" };
  const pricing = { byProduct: { salt: { partners: ["PA1-PP"], habits: {
    "LA1-AA": hab("late", "2026-10-01"), "LB1-BB": hab("lapsed", "2026-09-10"), "EA1-EA": hab("early", "2026-11-10"), "DA1-DA": hab("due", "2026-11-05"),
    "OH1-OH": hab("late", "2026-10-02", 25), "OS1-OS": hab("late", "2026-10-03"), "PA1-PP": hab("late", "2026-10-04"), "LU1-UU": hab("late", "2026-10-05"),
    "TT1-TT": hab("late", "2026-10-06"), "LR1-RR-R": hab("late", "2026-10-07"), "NS1-NS": hab("late", "2026-10-08"), "NR1-NR": hab("late", "2026-10-09"), "BD1-BD": hab("late", ""),
    "WO1-WO": Object.assign(hab("lapsed", "2026-09-01"), { writeOff: true }), "BN1-BN": hab("lapsed", "2026-09-02"), "OP1-OP": hab("late", "2026-10-11") } } } };
  const sheetOut = sheet.concat([]);
  const got = remindMap(pricing, sheetOut, users, new Set(["BN1-BN"]));
  ok(J(got) === J({ [UA]: "2026-10-01", [UB]: "2026-09-10" }),
    "R1 only a late or lapsed regular who owes nothing is listed, by their last order day; early, due, an owing habit, an owing statement, a partner, a bucket, no username, a practice account and a code the sheet does not read stay out: " + J(got));

  /* ---- R3: banned and departed, read off the book ---- */
  const { peopleOut } = await import("../tools/stmt-publish.mjs");
  const pbook = join(mkdtempSync(join(tmpdir(), "remind-pe-")), "book.json");
  writeFileSync(pbook, J({ state: { PEOPLE: { banned: [{ id: "BN1-BN" }, { id: "LF1-LF", lifted: "2026-10-01" }], departed: [{ id: "DP1-DP" }] } } }));
  const was = process.env.SALT_BOOK; process.env.SALT_BOOK = pbook;
  let pe; try { pe = [...peopleOut()].sort(); } finally { if (was === undefined) delete process.env.SALT_BOOK; else process.env.SALT_BOOK = was; }
  ok(J(pe) === J(["BN1-BN", "DP1-DP"]), "R3 the publish reads the codes the book holds banned (a lifted ban is not) or departed: " + J(pe));

  /* ---- R2: the real plan ---- */
  const root = mkdtempSync(join(tmpdir(), "remind-"));
  try {
    const bk = (await import("./frozen.mjs")).frozenBook();   /* the suite's frozen book, never the live one */
    const { partyTotals, klToday } = await import("../tools/make_statements.mjs");
    const day = klToday(new Date("2026-11-14T00:00:00Z"));
    const pool = [...new Set((bk.sales || []).filter((s) => s.customer && !/-R$/.test(s.customer)).map((s) => s.customer))];
    let clean = null, owing = null;
    for (const c of pool) { const o = partyTotals(c, day).owed; if (o <= 0.009 && !clean) clean = c; if (o > 0.009 && !owing) owing = c; if (clean && owing) break; }
    if (!clean || !owing) { ok(true, "R2 skipped: the book holds no clean and owing pair"); }
    else {
      mkdirSync(join(root, "2026-09", "_kv"), { recursive: true });
      const names = { [clean]: UA, [owing]: UB };
      writeFileSync(join(root, "_users.json"), J(names));
      for (const u of [UA, UB]) writeFileSync(join(root, "2026-09", "_kv", u + ".json"), J({ u, issued: "2026-09-01", wrap: { salt: "w" }, env: { iv: "i", ct: "c" } }));
      const px = (state) => ({ byProduct: { salt: { partners: [], habits: { [clean]: hab(state, "2026-10-01"), [owing]: hab(state, "2026-10-02") } } } });
      const plan = await planPublish(root, "", new Date("2026-11-14T00:00:00Z"), [], null, px("late"), null, { noRetire: true });
      const put = plan.puts.find((x) => x.key === "remind"), plan0 = await planPublish(root, "", new Date("2026-11-14T00:00:00Z"), [], null, null, null, { noRetire: true });
      const plan1 = await planPublish(root, "", new Date("2026-11-14T00:00:00Z"), [], null, px("early"), null, { noRetire: true });
      ok(put && J(JSON.parse(put.value)) === J({ [UA]: "2026-10-01" }) && !plan0.puts.some((x) => x.key === "remind") && J(JSON.parse(plan1.puts.find((x) => x.key === "remind").value)) === "{}",
        "R2 the publish plan puts the list off the snapshot's habits and the sheet's owed, an empty one when nobody qualifies, and none with no snapshot: " + J([put && put.value, plan0.puts.map((x) => x.key)]));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }

  /* ---- the Worker ---- */
  const stmtW = (await import("../stmt/worker.js")).default, WD = await import("../stmt/words.js"), SW = await import("../stmt/sw.js");
  const vp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const kv = new KV();
  const env = { STMT: kv, STMT_VAPID_PUBLIC_KEY: "remind-public", STMT_VAPID_SUBJECT: "mailto:a@b.test", STMT_VAPID_PRIVATE_JWK: J(await crypto.subtle.exportKey("jwk", vp.privateKey)) };
  const phones = {}, ownerOf = {}, hits = [], logs = [];
  const subscribe = async (u) => { const ph = await phone(), ep = "https://push.example/" + u; phones[u] = ph; ownerOf[ep] = u; await kv.put("push:" + u + ":" + await endpointId(ep), J({ endpoint: ep, keys: ph.keys, at: new Date().toISOString() })); };
  for (const u of [UA, UB, UT, UC]) await subscribe(u);
  const realFetch = globalThis.fetch, realLog = console.log;
  globalThis.fetch = async (url, init) => { const s = String(url); if (s.startsWith("https://push.example/")) { hits.push({ u: ownerOf[s], body: init.body }); return new Response("", { status: 201 }); } return realFetch(url, init); };
  const D = (n) => kl(n), at = (n, hh) => D(n) + "T" + hh + ":00:00Z";   /* 02:00Z is 10:00 in Kuala Lumpur */
  const tick = async (iso) => {
    const w = []; hits.length = 0; logs.length = 0;
    console.log = (...x) => { logs.push(x.join(" ")); };
    try { await stmtW.scheduled({ cron: "0 * * * *", scheduledTime: Date.parse(iso) }, env, { waitUntil: (p) => w.push(p) }); await Promise.all(w); } finally { console.log = realLog; }
    const read = []; for (const h of hits) read.push([h.u, await phones[h.u].read(h.body)]);
    return read;
  };
  const kinds = (r, u) => r.filter((x) => x[0] === u).map((x) => x[1].k);
  try {
    await kv.put("remind", J({ [UA]: D(-14) }));
    const t1 = await tick(at(0, "02"));
    const mark = await kv.get("reminded:" + UA);
    ok(J(t1) === J([[UA, { k: "remind", o: "" }]]) && mark === D(-14) && (kv.opts.get("reminded:" + UA) || {}).expirationTtl === 120 * 86400,
      "W1 the 10:00 tick sends one wake of kind remind, sealed {k, o} and nothing else, and files reminded:<username> as the cycle day for 120 days: " + J([t1, mark, kv.opts.get("reminded:" + UA)]));
    const t2 = await tick(at(0, "02"));
    ok(t2.length === 0 && await kv.get("reminded:" + UA) === D(-14), "W2 a second tick in the same hour sends nothing: " + J(t2));
    await kv.put("remind", J({ [UA]: D(-14), [UB]: D(-20) }));
    const t3 = [await tick(at(0, "03")), await tick(at(0, "01")), await tick(at(-1, "17")), await tick(at(0, "14"))];
    ok(t3.every((r) => r.length === 0) && await kv.get("reminded:" + UB) === null,
      "W3 no wake at 09:00, 11:00 or any other hour, and a customer not yet reminded is left unmarked: " + J(t3));
    const t3b = await tick(at(0, "02"));
    ok(J(t3b) === J([[UB, { k: "remind", o: "" }]]) && await kv.get("reminded:" + UB) === D(-20),
      "W3 at 10:00 the next customer is reminded and the one already reminded for that cycle is not: " + J(t3b));
    await kv.put("remind", J({ [UA]: D(-14), [UB]: D(-20) }));
    const same = await tick(at(1, "02"));
    await kv.put("remind", J({ [UA]: D(-3), [UB]: D(-20) }));
    const fresh = await tick(at(1, "02"));
    ok(same.length === 0 && J(fresh) === J([[UA, { k: "remind", o: "" }]]) && await kv.get("reminded:" + UA) === D(-3),
      "W4 the same cycle the next day is not reminded again, a new order day is a new cycle and is: " + J([same, fresh]));

    /* W5, W6: a practice account, and a customer the chase is waking */
    await kv.put("remind", J({ [UT]: D(-9), [UC]: D(-9) }));
    await kv.put("order:" + UC + ":20261101010101-wc1", J(done("20261101010101-wc1", ago(24 * 3), { u: UC, moved: 1, movedOn: D(-3), paid: 0, total: 100 })));
    const t5 = await tick(at(2, "02"));
    ok(kinds(t5, UT).length === 0 && await kv.get("reminded:" + UT) === null, "W5 a practice account in the list is never woken and never marked: " + J(t5));
    ok(J(kinds(t5, UC)) === J(["due"]) && await kv.get("reminded:" + UC) === null,
      "W6 a customer holding goods unpaid hears the chase alone this hour, and is not marked as reminded: " + J(t5));
    /* W8: an order of theirs open on the Counter */
    await subscribe(UD);
    await kv.put("remind", J({ [UD]: D(-9) }));
    await kv.put("order:" + UD + ":20261101010102-wd1", J(ord("20261101010102-wd1", "placed", ago(5), { u: UD })));
    const t8 = await tick(at(3, "02"));
    ok(kinds(t8, UD).length === 0 && await kv.get("reminded:" + UD) === null, "W8 a customer with an order open on the Counter is not reminded at the send, and not marked: " + J(t8));
  } finally { globalThis.fetch = realFetch; console.log = realLog; }

  /* ---- W7, S1, S2 ---- */
  const wd = WD.WORDS.en["news.remind"];
  ok(wd === WORDS_EXACT && WD.WORDS.en["news.remind.b"] === BODY_EXACT && !/[0-9]|salt|oil|candy|rice|gas|RM/i.test(wd + BODY_EXACT) && SW.NEWS.remind === WORDS_EXACT,
    "W7 the words are his, with no product word, figure or name, and the service worker's table has them: " + wd);
  const shown = [], handlers = {}, opened = [], posted = [], focused = [];
  let clients = [];
  const ctx = { URL, Promise, fetch: async () => ({ ok: false }), setTimeout,
    self: { location: { href: "https://x.test/sw.js?u=" + UA }, registration: { scope: "https://x.test/", showNotification: (title, o) => { shown.push([title, o.body, o.tag, o.data]); return Promise.resolve(); } },
      addEventListener: (e, f) => { handlers[e] = f; }, skipWaiting() {}, clients: { claim() {}, matchAll: async () => clients, openWindow: (u) => { opened.push(u); return Promise.resolve(); } } } };
  vm.runInNewContext(SW.swScript(), ctx);
  let pr; shown.length = 0;
  handlers.push({ data: { json: () => ({ k: "remind", o: "" }) }, waitUntil: (x) => { pr = x; } }); await pr;
  const sh = shown[0] || [];
  ok(sh[0] === WORDS_EXACT && sh[1] === BODY_EXACT && sh[2] === "remind" && /#again$/.test((sh[3] || {}).url || "") && (sh[3] || {}).again === true && !(sh[3] || {}).order,
    "S1 the service worker shows his words under the kind's own tag, its tap naming Order and no order: " + J(sh));
  const click = async () => { let p; handlers.notificationclick({ notification: { close() {}, data: sh[3] }, waitUntil: (x) => { p = x; } }); await p; };
  await click();
  const o1 = opened.slice();
  clients = [{ url: "https://x.test/", focus() { focused.push(1); }, postMessage(m) { posted.push(m); } }];
  await click();
  ok(o1.length === 1 && /#again$/.test(o1[0]) && posted.length === 1 && posted[0].again === true && posted[0].salt === "news" && focused.length === 1 && opened.length === 1,
    "S2 a tap with no page open opens the Counter at that address, and with one open tells it to open Order: " + J([o1, posted]));

  /* ---- the page ---- */
  const orders = [done("20260901000000-aa1", ago(24 * 40), { qty: 2.5, total: 250 }), done("20260910000000-aa2", ago(24 * 30), { qty: 2.5, total: 250 }),
    done("20260920000000-aa3", ago(24 * 20), { qty: 1, total: 100 })];
  const seen = async (o) => {
    const p = await open(Object.assign({ pageWork, orders }, o));
    try {
      await p.settle();
      const prices = p.d.getElementById("pPrices"), pane = [...p.d.querySelectorAll("#pPrices .pane")][0], val = pane && pane.querySelector('[data-st="val"]');
      return { order: !!prices && !prices.hidden, hash: p.w.location.hash, val: val ? val.textContent.trim() : "" };
    } finally { p.close(); }
  };
  const a = await seen({ hash: "#again" }), b = await seen({}), c = await seen({ hash: "#again", late: 5 });
  /* P4: a page already open is told by the service worker */
  let sink = null; const swStub = { addEventListener: (e, f) => { if (e === "message") sink = f; } };
  const pp = await open({ pageWork, orders, sw: swStub });
  let d4 = null;
  try {
    await pp.settle();
    const before = !pp.d.getElementById("pPrices").hidden;
    if (sink) { await sink({ data: { salt: "news", order: "", thread: false, again: true } }); await pp.settle(); await until(() => !pp.d.getElementById("pPrices").hidden, 60); }
    d4 = { before, after: !pp.d.getElementById("pPrices").hidden, listening: !!sink };
  } finally { pp.close(); }
  ok(d4 && d4.listening && d4.before === false && d4.after === true, "P4 a page already open that is told again by the service worker opens Order: " + J(d4));
  ok(a.order && a.hash === "#prices" && /2\.5/.test(a.val), "P1 the page opened at #again lands on Order once they are in, at their usual size, and the address becomes the place's own, never #again: " + J(a));
  ok(!b.order, "P2 with no such address the page stays on Home: " + J(b));
  ok(!c.order, "P3 where nothing can be ordered (the overdue gate) the address opens no Order: " + J(c));
}
