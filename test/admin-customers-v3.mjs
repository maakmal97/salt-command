/* test/admin-customers-v3.mjs: SALT ADMIN'S SIDE OF THE PRICE BAND'S VERSION 3, THE CUSTOMERS (13 Nov 2026; the engine's habits, size warning, win-back, new buyers and
 * calendar, commits 5350401d and f7acfb3a). Each check is red under its own mutation (test/admin-customers-v3.mutations.json); invented codes only (rule 2).
 *   1  the catalogue carries the regulars who need a word (due, late, lapsed; lapsed then late then due, the larger margin a month first) and the newest week's buyers
 *   2  Needs you: one card for them, To do while one has lapsed and FYI while they are only due or late, the first named, the rest in its why
 *   3  its tap opens the first one's account
 *   4  one FYI line says the week's new buyers (how many, through an associate, came back; thin said); nothing is said for a quiet, not thin, week
 *   5  This customer: their habit and the size warning (a bigger lot, ten points off), each in words
 *   6  the Desk's customer reading carries the snapshot's habit
 *   7  Accept: a lapsed regular's preview offers a win-back line and Use fills Goods, sending nothing; no line without one
 *   8  Shop > Calendar lists his marks; Add sends the mark, Remove sends its id, neither asks nor waits under Approve
 *   9  Add refuses a short name, a last day before the first, and days over a year out, sending nothing
 *   10 the Counter's calendar: only the verified owner reads or writes it, a mark is validated, added and removed, stored at KV calendar
 *   11 the Desk reads it: the Counter's /desk/calendar needs X-Stmt-Desk and the Desk's /calendar needs X-Salt-Key and relays it
 *   12 the Desk's Act road takes shop/calendar */
import { webcrypto } from "node:crypto";
import { frozenBook } from "./frozen.mjs";
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import { Store } from "./maker-order-controls.mjs";

const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };
const HABITS = [
  { code: "CX4-ZED", state: "lapsed", since: 35, gap: 7, usual: 1, margin30: 80, owes: 0 },
  { code: "CX1-ZED", state: "late", since: 14, gap: 7, usual: 2, margin30: 60, owes: 100 },
  { code: "CX3-ZED", state: "due", since: 8, gap: 7, usual: 1, margin30: 20, owes: 0 }];

export async function run({ ok, pageWork }) {
  /* 1: the catalogue */
  {
    const { pricingFromBook } = await import("../engine/book-inputs.mjs");
    const MI = await import("../src/maker-inputs.js");
    const base = pricingFromBook(frozenBook(), new Date("2026-11-20T04:00:00Z"));
    const hb = (state, margin30, extra) => ({ state, gap: 7, usual: 1, last: "2026-11-01", since: 10, next: "2026-11-08", margin30, owes: 0, ...extra });
    const habits = { "AA1-AAA": hb("early", 99), "AA2-AAA": hb("due", 10), "AA3-AAA": hb("late", 20), "AA4-AAA": hb("lapsed", 5), "AA5-AAA": hb("late", 40, { warn: { perUnit: 20, units30: 4 } }), "AA6-AAA": hb("lapsed", 50) };
    const weeks = [{ from: "a", to: "b", count: 9, introduced: 9, back: 9 }, { from: "b", to: "c", count: 3, introduced: 1, back: 2 }];
    const pricing = { ...base, byProduct: { ...base.byProduct, salt: { ...base.byProduct.salt, habits, buyers: { weeks, mean: 6, thin: true } } } };
    const desk = { state: { roster: [], associates: [] }, pricing, ledger: [], version: "v1514" };
    const cat = MI.makerInputCatalog(desk, {}, [], []);
    const order = (cat.habits || []).map((h) => h.code + ":" + h.state).join();
    ok(order === "AA6-AAA:lapsed,AA4-AAA:lapsed,AA5-AAA:late,AA3-AAA:late,AA2-AAA:due" && JSON.stringify(Object.keys((cat.habits || [])[0] || {}).sort()) === JSON.stringify(["code", "gap", "margin30", "owes", "since", "state", "usual"])
      && cat.buyers && cat.buyers.count === 3 && cat.buyers.introduced === 1 && cat.buyers.back === 2 && cat.buyers.thin === true,
    "the catalogue lists the regulars due, late or lapsed, lapsed first then late then due, the larger margin first, early left out, and the newest week of new buyers: " + JSON.stringify([order, cat.buyers]));
    const bare = { ...base, byProduct: { ...base.byProduct, salt: { ...base.byProduct.salt, habits: undefined, buyers: undefined } } };
    const none = MI.makerInputCatalog({ ...desk, pricing: bare }, {}, [], []);
    ok(Array.isArray(none.habits) && none.habits.length === 0 && none.buyers === null, "a book whose snapshot holds no habits says none and no buyers");
  }

  const habitsAnswer = (habits, buyers) => (j) => { j.catalog.habits = habits; j.catalog.buyers = buyers; return j; };
  const open = async (o = {}) => { const p = await richOwnerPage({ pageWork, ...o }); await p.work.quiet(); await p.work.quiet(); return p; };
  const need = (p, key) => p.d.querySelector('[data-need="' + key + '"]');

  /* 2: Needs you's card */
  {
    const p = await open({ before: (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*860px/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {} }); }, inputsAnswer: habitsAnswer(HABITS, { count: 3, introduced: 1, back: 2, thin: false }) });
    const c = need(p, "x:habits"), grp = c && c.closest(".ngroup");
    const t = c ? c.querySelector(".salt-action__title").textContent : "";
    ok(!!c && grp.getAttribute("data-sev") === "now" && /CX4-ZED lapsed, 35 d, usual 1 unit/.test(t) && !!c.querySelector(".salt-producttag") && p.d.querySelectorAll('[data-need="x:habits"]').length === 1
      && /3 regulars are past their usual gap/.test(c.querySelector(".need-tap").getAttribute("aria-label")),
    "Needs you has one To do card for the regulars when one has lapsed, naming the first and counting the rest, with the book's tag: " + (grp && grp.getAttribute("data-sev")) + " " + t);
    const q = await open({ inputsAnswer: habitsAnswer(HABITS.slice(1), null) });
    const c2 = need(q, "x:habits");
    ok(!!c2 && c2.closest(".ngroup").getAttribute("data-sev") === "watch" && /CX1-ZED late, 14 d, usual 2 units/.test(c2.textContent) && !need(q, "x:buyers"),
      "with none lapsed the card is FYI and the first is the late one: " + (c2 && c2.closest(".ngroup").getAttribute("data-sev")));
    const r = await open({ inputsAnswer: habitsAnswer([], null) });
    ok(!need(r, "x:habits"), "with nobody to name there is no card");
    /* the card lists them in its why, in the opened card beside the list */
    const wide = need(p, "x:habits") && need(p, "x:habits").querySelector(".need-tap");
    if (wide) { wide.click(); await p.work.quiet(); }
    const pane = p.d.querySelector('[data-pane="x:habits"]');
    ok(!!pane && /CX4-ZED lapsed, 35 d, usual 1 unit; CX1-ZED late, 14 d, usual 2 units; CX3-ZED due, 8 d, usual 1 unit\./.test(pane.textContent),
      "the opened card lists every regular in the Desk's order: " + (pane && pane.textContent.slice(0, 200)));
  }

  /* 3: its tap opens the account */
  {
    const p = await open({ inputsAnswer: habitsAnswer(HABITS, null), extra: (route) => route === "/all/maker/customer-of/CX4-ZED" ? { ok: true, reading: { customer: false } } : undefined });
    const go = byAct(p.d, "need.habit", "x:habits");
    if (go) { go.click(); await p.work.quiet(); await p.work.quiet(); }
    const a = p.d.querySelector("#aopen [data-u]") || p.d.querySelector("#aopen .oacct"), shownAcct = p.d.getElementById("aopen") && shown(p.d.getElementById("aopen"));
    ok(!!go && shownAcct && /CX4-ZED/.test(p.d.getElementById("aopen").textContent), "the card's Open goes to the first regular's account, CX4-ZED: " + (a && a.textContent.slice(0, 80)));
  }

  /* 4: the new buyers */
  {
    const look = async (b) => { const p = await open({ inputsAnswer: habitsAnswer([], b) }); const c = need(p, "x:buyers"); return c ? { t: c.querySelector(".salt-action__title").textContent.replace(/^Salt/, ""), sev: c.closest(".ngroup").getAttribute("data-sev") } : null; };
    const a = await look({ count: 3, introduced: 1, back: 2, thin: false }), b = await look({ count: 0, introduced: 0, back: 0, thin: true }), c = await look({ count: 0, introduced: 0, back: 0, thin: false }), d = await look({ count: 2, introduced: 0, back: 0, thin: true });
    ok(a && a.sev === "watch" && a.t === "3 new this week, 1 through an associate, 2 came back" && b && b.t === "No new buyers this week. Thin against the weeks before" && c === null
      && d && d.t === "2 new this week. Thin against the weeks before",
    "one FYI line says the week's new buyers with the introduced and the came back, says thin, and says nothing of a quiet week that is not thin: " + JSON.stringify([a, b, c, d]));
  }

  /* 5: This customer */
  const reading = (habit) => ({ customer: true, code: "CX1-ZED", rates: [{ date: "2026-10-01", rate: 100 }, { date: "2026-10-08", rate: 110 }], unitNow: 110, highest: 110, cadence: { every: 7, orders: 2, last: "2026-10-08" }, dueIn: 1,
    loyal: { units: 3, every: 20, earned: 0, paused: false, why: null, order: null, unit: null }, cost: 58, held: 0, suggest: null, gain: null, pair: false, habit });
  const thisCustomer = async (habit) => {
    const p = await open({ extra: (route) => route === "/all/maker/customer-of/CX1-ZED" ? { ok: true, reading: reading(habit) } : route === "/all/maker/reward-of/CX1-ZED" ? { ok: true, reading: { associate: false } } : undefined });
    enter(p.d, "customers", "accounts"); await p.work.quiet();
    const row = [...p.d.querySelectorAll("#rlist [data-u]")].find((c) => /CX1-ZED/.test(c.textContent));
    if (row) { byAct(row, "acct.open").click(); await p.work.quiet(); await p.work.quiet(); }
    const box = p.d.querySelector("#aopen .acust");
    return { p, box, text: box ? box.textContent : "" };
  };
  {
    const r = await thisCustomer({ state: "late", gap: 7, usual: 1, last: "2026-10-01", since: 12, next: "2026-10-08", margin30: 60, units30: 4, owes: 0,
      warn: { perUnit: 40, units30: 4, bigger: { q: 3, perUnit: 10, less30: 120 }, tenOff: { less30: 45 } } });
    const t = r.text.replace(/\s+/g, " ");
    ok(!!r.box && /Habit\s*Every 7 d, usually 1 unit; late 5 d/.test(t) && /A 3-unit lot earns RM 120 less a month/.test(t) && /10% off costs RM 45 a month/.test(t) && !!r.box.querySelector('[data-warn="bigger"]') && !!r.box.querySelector('[data-warn="tenOff"]'),
    "This customer says their habit (every 7 d, usually 1 unit, late 5 d) and the size warning (a 3-unit lot, ten points off) in words: " + t.slice(0, 400));
    const e = await thisCustomer({ state: "early", gap: 7, usual: 2, last: "2026-10-08", since: 3, next: "2026-10-15", margin30: 60, units30: 4, owes: 0, warn: { perUnit: 40, units30: 4, bigger: null, tenOff: { less30: 0 } } });
    const et = e.text.replace(/\s+/g, " ");
    ok(/Habit\s*Every 7 d, usually 2 units(?!; late)/.test(et) && !/lot earns/.test(et) && !/10% off costs/.test(et), "an early regular reads no lateness, and a warning of nothing is left out: " + et.slice(0, 300));
    const n = await thisCustomer(null);
    ok(!!n.box && !/Habit/.test(n.text) && /Orders every/.test(n.text), "a customer with no habit reads as before, with no Habit line");
  }

  /* 6: the Desk's reading carries the habit */
  {
    const { readBook } = await import("../tools/book.mjs"), M = await import("../src/maker-inputs.js");
    const desk = await readBook(), L = JSON.parse(JSON.stringify(desk.ledger));
    desk.dom.window.close();
    const snap = L.PRICING.byProduct.salt;
    snap.lift = { ...(snap.lift || {}), "CQ1-ZUL": 0 };
    snap.cards = { ...(snap.cards || {}), "CQ1-ZUL": snap.cards[Object.keys(snap.cards)[0]] };
    L.roster = L.roster.concat(["CQ1-ZUL"]);
    const mk = (c, rid, date, q) => ({ rid, customer: c, product: "salt", date, qty: q, total: 100 * q, cost: 58 * q, listRM: 100 * q, listQty: q, cash: 100 * q, paidOn: date, deliveredQty: q, deliveredOn: date, note: "test" });
    const sales = L.sales.concat([["2031-01-01", 5], ["2031-01-06", 5], ["2031-01-11", 4], ["2031-01-16", 5]].map(([d, q], i) => mk("CQ1-ZUL", "s9" + (900 + i), d, q)));
    L.REWARD.stated.salt.loyal = { every: 20, since: "2031-01-01" };
    const h = { state: "late", gap: 7, usual: 1, last: "2031-01-01", since: 12, next: "2031-01-08", margin30: 60, units30: 4, owes: 0 };
    const at = (habits) => { snap.habits = habits; return M.makerCustomerReadingOf({ version: L.PRICING.v, state: { ...L, sales }, sales, purchases: L.purchases, pricing: L.PRICING }, "CQ1-ZUL", "2031-01-19"); };
    const r1 = at({ "CQ1-ZUL": h }), r0 = at({});
    ok(r1.customer === true && JSON.stringify(r1.habit) === JSON.stringify(h) && r0.customer === true && r0.habit === null,
      "the customer reading carries the snapshot's habit for that customer and null where it holds none: " + JSON.stringify([r1.customer, r1.habit, r0.habit]));
  }

  /* 7: Accept's win-back */
  {
    const D = "2026-11-13", ord = (id) => ({ id, u: "u-wb-" + id, product: "salt", qty: 1, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", at: D + "T08:59:58.000Z", payments: [], msgs: [], history: [], status: "placed", ledgerKey: "k" + id });
    const winBack = { from: 0.2, to: 0.1, price: 90, now: 100, since: 35, gap: 7 };
    const pv = (j) => ({ ok: true, hash: "a".repeat(64), offerHash: "b".repeat(64), quote: j.total, delivery: 0, card: 100, floor: 50, margin: { rm: 40, pct: 40 }, cost: { total: 50 }, usual: { rate: 100 }, flags: [], row: { qty: 1, total: j.total }, ...(j.wb ? { winBack } : {}) });
    const go = async (withWb) => {
      const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: [ord("wb-a")] }), extra: (route, body) => route === "/all/maker/orders/wb-a/preview" ? pv({ total: (body && body.total) || 100, wb: withWb }) : undefined });
      await p.work.quiet();
      byAct(p.d, "nav.orders").click(); await p.work.quiet();
      const r = byAct(p.d, "order.open", "wb-a"); if (r) r.click(); await p.work.quiet(); await p.work.quiet();
      return p;
    };
    const p = await go(true);
    const line = p.d.querySelector("[data-winback]"), use = line && byAct(line, "order.winback", "wb-a");
    const before = p.posts.length;
    if (use) { use.click(); await p.work.quiet(); await p.work.quiet(); }
    const goods = byAct(p.d, "order.total"), sent = p.posts.filter((x) => /\/(accept|offer)$/.test(x.route)), reread = p.posts.filter((x) => x.route === "/all/maker/orders/wb-a/preview" && x.body && x.body.total === 90);
    ok(!!line && /^Lapsed 35 d: win back at RM 90\.00, 10% under their price\./.test(line.textContent) && !!use && goods && goods.value === "90" && sent.length === 0 && reread.length >= 1 && p.posts.length > before,
      "a lapsed regular's preview offers a win-back line, Use fills Goods with its price and the figures are read again, nothing is sent: " + (line && line.textContent) + " " + (goods && goods.value) + " " + JSON.stringify(sent));
    const foot = p.d.querySelector("[data-winback-foot]");
    ok(!!foot && /reads under their price/.test(foot.textContent) && /no loyalty unit/.test(foot.textContent) && /associate.s reward/.test(foot.textContent),
      "the win-back line says the order then reads under their price: no loyalty unit, and as given on an associate's reward: " + (foot && foot.textContent));
    const q = await go(false);
    ok(!q.d.querySelector("[data-winback]") && !!byAct(q.d, "order.total"), "no win-back line when the preview carries none");
  }

  /* 8 and 9: Shop > Calendar */
  {
    let list = [{ id: "a1b2c3d4e5f6", name: "Hari Raya", from: "2027-03-10", to: "2027-03-14" }];
    const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10), day = (n) => new Date(Date.parse(today + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
    const extra = (route, body) => {
      if (route !== "/all/maker/calendar") return undefined;
      if (body && body.add) list = list.concat([{ id: "f0e1d2c3b4a5", ...body.add }]);
      if (body && body.remove) list = list.filter((m) => m.id !== body.remove);
      return { ok: true, calendar: { v: 1, list } };
    };
    const p = await open({ extra });
    const tab = p.d.querySelector('[data-act="part.shop.calendar"]');
    if (tab) { enter(p.d, "shop", "calendar"); await p.work.quiet(); }
    const sec = p.d.getElementById("makerCalendar"), row = p.d.querySelector('[data-cal-mark="a1b2c3d4e5f6"]');
    ok(!!tab && shown(sec) && !shown(p.d.getElementById("makerMarket")) && !!row && /Hari Raya/.test(row.textContent) && /10 Mar 2027 to 14 Mar 2027/.test(row.textContent) && p.wire.some((w) => w.startsWith("/all/maker/calendar GET")),
      "Shop has a Calendar part that reads his marks and lists each with its name and days: " + (row && row.textContent));
    const posts = () => p.posts.filter((x) => x.route === "/all/maker/calendar").map((x) => x.body);
    const set = (act, v) => { const f = byAct(p.d, act); if (f) p.type(f, v); };
    const add = () => byAct(p.d, "calendar.add");
    /* 9 first: refusals send nothing */
    const say = () => (p.d.querySelector("#makerCalendar .aanswer") || {}).textContent;
    set("calendar.name", "X"); set("calendar.from", day(5)); set("calendar.to", day(6)); add().click(); await p.work.quiet(); const s1 = say();
    set("calendar.name", "School break"); set("calendar.from", day(9)); set("calendar.to", day(8)); add().click(); await p.work.quiet(); const s2 = say();
    set("calendar.from", day(5)); set("calendar.to", day(366)); add().click(); await p.work.quiet(); const s3 = say();
    set("calendar.from", day(-400)); set("calendar.to", day(5)); add().click(); await p.work.quiet(); const s4 = say();
    ok(posts().length === 0 && /2 to 30/.test(s1) && /on or after/.test(s2) && /within a year/.test(s3) && /within a year/.test(s4),
      "Add refuses a one-letter name, a last day before the first and days over a year from today, sending nothing: " + JSON.stringify([posts().length, s1, s2, s3, s4]));
    /* 8: a good Add */
    set("calendar.name", "  School break "); set("calendar.from", day(30)); set("calendar.to", day(40)); add().click(); await p.work.quiet(); await p.work.quiet();
    const got = posts();
    ok(got.length === 1 && JSON.stringify(got[0]) === JSON.stringify({ add: { name: "School break", from: day(30), to: day(40) } }) && !p.d.getElementById("ynSheet")
      && !!p.d.querySelector('[data-cal-mark="f0e1d2c3b4a5"]') && p.posts.every((x) => !/inputs\/edit|drafts/.test(x.route)),
    "a good Add sends the trimmed name and the days at once, asks nothing, waits under no Approve and the list shows it: " + JSON.stringify(got));
    const rm1 = p.d.querySelector('[data-cal-mark="a1b2c3d4e5f6"] [data-act="calendar.remove"]');
    if (rm1) { rm1.click(); await p.work.quiet(); await p.work.quiet(); }
    const got2 = posts();
    ok(got2.length === 2 && JSON.stringify(got2[1]) === JSON.stringify({ remove: "a1b2c3d4e5f6" }) && !p.d.getElementById("ynSheet") && !p.d.querySelector('[data-cal-mark="a1b2c3d4e5f6"]'),
      "Remove sends the mark's id at once and the list drops it: " + JSON.stringify(got2[1]));
  }

  /* 10: the Counter's route */
  const team = "cal-fixture", audience = "cal-audience", kid = "cal-key";
  const stmtW = (await import("../stmt/worker.js")).default;
  const CAL = await import("../stmt/calendar.js");
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const store = new Store(), env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "cal-local-master", STMT_DESK_KEY: "cal-desk-test-capability-000001", COUNTER_MAKER_KEY: "cal-maker-test-capability-000001", ORDER_STORE: "object" };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected calendar fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const jwtOf = async (email) => { const c = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
      return header + "." + c + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", signing.privateKey, new TextEncoder().encode(header + "." + c))).toString("base64url"); };
    const jwt = await jwtOf("maakmal97@icloud.com"), stranger = await jwtOf("someone@example.test");
    const as = (token) => (path, body, method = "POST") => stmtW.fetch(new Request("https://counter.fixture.test" + path, { method, headers: { ...(token ? { "cf-access-jwt-assertion": token } : {}), "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
    const owner = as(jwt), today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10), day = (n) => new Date(Date.parse(today + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
    const none = await as(null)("/all/maker/calendar", undefined, "GET"), other = await as(stranger)("/all/maker/calendar", { add: { name: "Hari Raya", from: day(5), to: day(6) } });
    const a1 = await (await owner("/all/maker/calendar", { add: { name: "Hari Raya", from: day(5), to: day(9) } })).json();
    const bad = [{ add: { name: "X", from: day(5), to: day(6) } }, { add: { name: "Ok name", from: day(6), to: day(5) } }, { add: { name: "Ok name", from: day(5), to: day(400) } }, { add: { name: "Ok name", from: "2027-02-30", to: "2027-03-01" } },
      { add: { name: "Ok name", from: day(5), to: day(6), id: "x" } }, { add: { name: "A<b>", from: day(5), to: day(6) } }, { remove: "nothere" }, {}, { add: { name: "Ok name", from: day(5), to: day(6) }, remove: "x" }];
    const refused = []; for (const b of bad) refused.push((await owner("/all/maker/calendar", b)).status);
    const id = a1.calendar && a1.calendar.list[0] && a1.calendar.list[0].id;
    const read = await (await owner("/all/maker/calendar", undefined, "GET")).json();
    const stored = JSON.parse(await store.get("calendar"));
    const rem = await (await owner("/all/maker/calendar", { remove: id })).json();
    ok([401, 403].includes(none.status) && [401, 403].includes(other.status) && a1.ok && /^[0-9a-f]{12}$/.test(id || "") && refused.every((s) => s === 400) && read.calendar.list.length === 1 && read.calendar.list[0].name === "Hari Raya"
      && stored.v === 1 && stored.list.length === 1 && stored.list[0].from === day(5) && rem.calendar.list.length === 0 && JSON.parse(await store.get("calendar")).list.length === 0,
    "the Counter's calendar is read and written by the verified owner alone, a mark is validated (name, real days, order, a year), added with an id at KV calendar and removed by it: " + JSON.stringify([none.status, other.status, refused, read.calendar]));
    const many = { v: 1, list: Array.from({ length: 60 }, (_, i) => ({ id: String(i).padStart(12, "0"), name: "Mark " + i, from: day(5), to: day(6) })) };
    await store.put("calendar", JSON.stringify(many));
    const over = await owner("/all/maker/calendar", { add: { name: "One more", from: day(5), to: day(6) } });
    const capped = CAL.applyCalendar(CAL.calendarOf(many), { add: { name: "One more", from: day(5), to: day(6) } }, today, () => "ffffffffffff");
    ok(over.status === 400 && /Sixty/.test((await over.json()).error) && !!capped.error && JSON.parse(await store.get("calendar")).list.length === 60, "sixty marks at most: the sixty-first is refused and the list is left as it was");

    /* 11: the Desk reads it */
    await store.put("calendar", JSON.stringify({ v: 1, list: [{ id: "a1b2c3d4e5f6", name: "Hari Raya", from: day(5), to: day(9) }] }));
    const call = async (path, h) => { const r = await stmtW.fetch(new Request("https://counter.fixture.test" + path, { headers: h || {} }), env); let b = null; try { b = await r.json(); } catch (x) { b = null; } return { status: r.status, b }; };
    const d0 = await call("/desk/calendar"), d1 = await call("/desk/calendar", { "X-Stmt-Desk": "nope" }), d2 = await call("/desk/calendar", { "X-Stmt-Desk": env.STMT_DESK_KEY });
    ok(d0.status === 401 && d1.status === 401 && d2.status === 200 && d2.b.ok && d2.b.calendar.list.length === 1 && d2.b.calendar.list[0].name === "Hari Raya",
      "the Counter's /desk/calendar needs X-Stmt-Desk and answers his list: " + JSON.stringify([d0.status, d1.status, d2.status]));
    const deskW = (await import("../src/worker.js")).default;
    const denv = (extra) => ({ REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "wk", STMT_DESK_KEY: env.STMT_DESK_KEY, STMT_SITE: { fetch: (url, init) => stmtW.fetch(new Request(url, init), env) }, ...(extra || {}) });
    const get = async (path, headers, e) => { const r = await deskW.fetch(new Request("https://salt.test" + path, { headers }), e, { waitUntil() {} }); let b = null; try { b = await r.json(); } catch (x) { b = null; } return { status: r.status, b }; };
    const g0 = await get("/calendar", {}, denv()), g1 = await get("/calendar", { "X-Salt-Key": "wk" }, denv()), g2 = await get("/calendar", { "X-Salt-Key": "wk" }, denv({ STMT_SITE: undefined }));
    const g3 = await deskW.fetch(new Request("https://salt.test/calendar", { method: "POST", headers: { "X-Salt-Key": "wk" }, body: "{}" }), denv(), { waitUntil() {} });
    ok(g0.status === 401 && g1.status === 200 && JSON.stringify(g1.b) === JSON.stringify(d2.b) && g2.status === 503 && g2.b.ok === false && g3.status === 405,
      "the Desk's /calendar needs X-Salt-Key, relays the Counter's answer as it stands, says 503 with no relay and takes no write: " + JSON.stringify([g0.status, g1.status, g2.status, g3.status]));
  } finally { globalThis.fetch = originalFetch; }

  /* 12b: the price test is said under the move on Shop > Market, and the catalogue passes it through */
  {
    const { pricingFromBook } = await import("../engine/book-inputs.mjs");
    const MI = await import("../src/maker-inputs.js");
    const base = pricingFromBook(frozenBook(), new Date("2026-11-20T04:00:00Z"));
    const withTest = (t) => ({ state: { roster: [], associates: [] }, ledger: [], version: "v1514", pricing: { ...base, byProduct: { ...base.byProduct, salt: { ...base.byProduct.salt, test: t } } } });
    const t = { q: 1, rm: 5, week: 1, weeks: 8, from: "2026-11-16" }, c1 = MI.makerInputCatalog(withTest(t), {}, [], []), c0 = MI.makerInputCatalog(withTest(undefined), {}, [], []);
    ok(JSON.stringify(c1.test) === JSON.stringify(t) && c0.test === null, "the catalogue passes the day's price test through and says null on a day it does not run: " + JSON.stringify([c1.test, c0.test]));
    const lineOf = async (test) => {
      const p = await richOwnerPage({ pageWork, inputsAnswer: (j) => { j.catalog.market = { day: "2026-11-20", k: 0.05, on: true, why: "Median +5." }; j.catalog.marketSizes = [1]; j.catalog.test = test; return j; } });
      await p.work.quiet(); enter(p.d, "shop", "market"); await p.work.quiet();
      const l = p.d.querySelector("[data-market-test]"); return l ? l.textContent : null;
    };
    const up = await lineOf(t), down = await lineOf({ q: 1, rm: -5, week: 2, weeks: 8, from: "2026-11-16" }), no = await lineOf(null);
    ok(up === "Price test: RM 5 up at 1 unit, week 1 of 8" && down === "Price test: RM 5 down at 1 unit, week 2 of 8" && no === null,
      "Shop > Market says the price test under the day's move, up in the first week and down in the second, and nothing when none runs: " + JSON.stringify([up, down, no]));
  }

  /* 12: the Act road */
  {
    const { ADMIN_TO } = await import("../src/worker.js");
    ok(ADMIN_TO.test("shop/calendar") && !ADMIN_TO.test("shop/calendars") && !ADMIN_TO.test("shop") && !ADMIN_TO.test("calendar") && !ADMIN_TO.test("shop/calendar/x"), "the Desk's Act road takes shop/calendar and refuses a near miss");
    const p = await open({ hash: "#shop/calendar" });
    const here = [...p.d.querySelectorAll('.aparts[data-place="shop"] button[aria-selected="true"]')].map((b) => b.getAttribute("data-part")).join();
    ok(here === "calendar" && shown(p.d.getElementById("makerCalendar")), "the address #shop/calendar opens Shop's Calendar part: " + here);
  }
}
