/* test/maker-act.mjs: THE OWNER PAGE'S data-act HOOKS (11 Oct 2026, docs/STATEMENTS.md).
 *
 * byAct is the one way a test finds a control on Salt Account by what it does, never by its words, so a later change of
 * label, class or layout leaves the test where it was. richOwnerPage draws the page as the Counter's maker harness draws it
 * with the richest fixture there is: orders at every stage, a claim, links waiting, an account card open, every Record form,
 * a chat, a group order, the notice, the hours, the hand-over sheet. actAudit reads every control on it. */
import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { landingPage } from "../stmt/page.js";
import * as C from "../tools/stmt-crypto.mjs";

/* what a card, or an item of a list, is told apart by */
export const ACT_KEYS = ["data-key", "data-maker-card", "data-u", "data-need", "data-link", "data-acct", "data-thread", "data-reward-holder"];

/* the control inside root that has this act, and, with a key, inside the card (or as the list item) that carries it */
/* a place and, with a part, that part of it, entered as he enters them: a tap on the place's item, then on the part's tab */
export function enter(doc, place, part) {
  byAct(doc, "nav." + place).click();
  if (part) byAct(doc, "part." + place + "." + part).click();
}
export function byAct(root, act, key) {
  const all = [...root.querySelectorAll('[data-act="' + act + '"]')];
  if (key === undefined) return all[0] || null;
  const holds = (e) => ACT_KEYS.some((k) => e.getAttribute(k) === String(key));
  return all.find((c) => { for (let e = c; e && e !== root; e = e.parentElement) if (holds(e)) return true; return false; }) || null;
}

/* ---- the audit ---- */
export const CONTROLS = 'button, input:not([type="hidden"]), select, textarea, summary, a[href], [role="button"], [role="tab"]';
/* his page: the roster shell, the ended screen, the one control of his in a customer's view, the sheet that shows a code, and the look Sheet */
export const OWNER_ROOTS = "#roster, #aEnded, #lock, .salt-sheet.ho, #lookSheet";
const CARDS = ".maker-card, .maker-input, .maker-extra-trade, .maker-reward, .maker-offer, .oacct, [data-need], .glink, .salt-sheet, nav, #afil";
const PANELS = "#mHome, #oOrders, #oCustomers, #oRecord, #oShop, #oAccts, #oLinks, #oCards, #aEnded, #lock";
const where = (c) => {
  const at = c.closest(CARDS) || c.closest(PANELS);
  const key = at && ACT_KEYS.map((k) => at.getAttribute(k)).find(Boolean);
  return at ? (at.id ? "#" + at.id : at.tagName.toLowerCase() + "." + String(at.className).split(" ")[0]) + (key ? "[" + key + "]" : "") : "page";
};
export function actAudit(doc) {
  const roots = [...doc.querySelectorAll(OWNER_ROOTS)];
  const controls = [...new Set(roots.flatMap((r) => (r.matches(CONTROLS) ? [r] : []).concat([...r.querySelectorAll(CONTROLS)])))];
  const missing = [], seen = new Map(), clashes = [], acts = new Set();
  for (const c of controls) {
    const act = c.getAttribute("data-act");
    if (!act || !act.trim()) { missing.push(c.tagName.toLowerCase() + " " + JSON.stringify((c.textContent || c.getAttribute("aria-label") || c.getAttribute("data-m") || c.id || "").trim().slice(0, 40)) + " in " + where(c)); continue; }
    acts.add(act);
    const group = c.closest(CARDS) || c.closest(PANELS) || doc.body, id = act + "|" + (c.getAttribute("data-key") || "");
    const mine = seen.get(group) || seen.set(group, new Set()).get(group);
    if (mine.has(id)) clashes.push(act + (c.getAttribute("data-key") ? " [" + c.getAttribute("data-key") + "]" : "") + " twice in " + where(c)); else mine.add(id);
  }
  return { controls: controls.length, missing, clashes, acts };
}

/* ---- the richest fixture ---- */
const ISO = "2026-10-10T08:00:00.000Z", LATER = "2099-01-01T00:00:00.000Z";
const U1 = "abcd-efgh", U2 = "jkmn-pqrs", U3 = "tvwx-yz23", U4 = "4567-89ab";
const placed = { u: U1, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [] };
const orders = () => [
  { ...placed, id: "ord-p1", status: "placed", mode: "collect", qty: 2, total: 200 },
  { ...placed, id: "ord-p2", status: "placed", mode: "deliver", qty: 1, total: 100, slot: "2099-10-12T08", slotSpan: "08:00-12:00", pin: true },
  { ...placed, id: "ord-p3", status: "placed", mode: "collect", qty: 1, total: 100 },
  { ...placed, id: "ord-p4", status: "placed", mode: "collect", qty: 1, total: 100, price: { from: "accept", state: "offered", offer: { total: 110, delivery: 0, until: LATER } } },
  { ...placed, id: "ord-a1", status: "acknowledged", mode: "collect", qty: 2, total: 200, payments: [
    { claim: "waiting", amount: 30, at: "2026-10-10T01:00:00.000Z" }, { claim: "waiting", amount: 500, at: "2026-10-10T02:00:00.000Z" }] },
  { ...placed, id: "ord-a2", status: "acknowledged", mode: "collect", qty: 1, total: 100, again: ["ack", "pay", "cash", "move", "cancel", "amend"] },
  { ...placed, id: "ord-r1", status: "ready", mode: "collect", qty: 1, total: 100 },
  { ...placed, id: "ord-r2", status: "ready", mode: "collect", qty: 1, total: 100 },
  { ...placed, id: "ord-r3", status: "ready", mode: "collect", qty: 1, total: 100 },
  { ...placed, id: "ord-x1", status: "declined", mode: "collect", qty: 1, total: 100, again: ["pay"] }
];
const draft = (id, patch = {}) => ({ id, status: "pending", collection: "sales", product: "salt", qty: 1, total: 100,
  entry: { type: "SELL", party: "CX1-ZED", date: "2026-10-10" }, row: { qty: 1, total: 100, cost: 56 },
  cost: { total: 56 }, margin: { rm: 44, pct: 44 }, flags: ["Check before deciding"], ...patch });
const catalog = () => ({
  products: [{ product: "salt", saleReady: true, purchaseReady: true, tiered: true, drift: true, driftPresets: [{ name: "Gentle", value: 0.25 }] },
    { product: "oil", saleReady: true, purchaseReady: true, tiered: false, drift: false }],
  parties: ["CX1-ZED", "CX2-ZED", "SX1-ZED", "AX1-ZED", "AX1-ZED-R"],
  associates: [{ code: "AX1-ZED", resaleReady: true }],
  tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"], tierCustomers: ["CX1-ZED"],
  tierCards: [{ code: "CX1-ZED", product: "salt", held: "Gold", proposed: "Platinum", late: { level: "Silver", why: "paid late" } }],
  driftCustomers: ["CX1-ZED"], driftCards: [{ code: "CX1-ZED", product: "salt", held: true, value: 0.5, current: 0.1 }],
  loans: [{ rid: "loan-1", party: "CX1-ZED", remaining: 5, form: "cash" }],
  rewards: [{ code: "AX1-ZED", held: 2, free: 2, associate: true, departed: false, action: "Redeem" }],
  rows: [{ rid: "row-1", party: "CX1-ZED", product: "salt", date: "2026-09-01", qty: 2, total: 200, direction: "SELL" }],
  correctionFields: [{ field: "qty", kind: "number", required: true }, { field: "cash", kind: "number", required: true }],
  revivable: [{ rid: "row-3", party: "CX1-ZED", product: "salt", date: "2026-09-02", qty: 1, total: 100, paid: 0, movedUnits: 0, cancelledOn: "2026-09-03" }],
  houseBoards: { salt: { sizes: [1, 5, 10], hidden: [] } }, tips: [{ id: "tip-1", title: "A tip", hush: null }],
  appointmentCustomers: ["CX1-ZED"], appointmentKinds: [{ kind: "reseller", stream: "R2" }]
});
const account = (u, code, patch = {}) => ({ username: u, code, account: true, t: { owed: 0, toGet: 0, refund: 0, pend: 0 }, flag: "clear",
  seen: { opens: 1, last: ISO, how: "link" }, sent: ISO, issued: "2026-10-01", ...patch });
const sheet = () => [
  account(U1, "CX1-ZED", { flag: "owes", t: { owed: 100, toGet: 0, refund: 0, pend: 0 }, alerts: true, tot: "Owes RM 100.00",
    pwMaster: { v: 1, salt: "AAAA", iv: "AAAA", ct: "AAAA" } }),
  { username: U2, code: "CX2-ZED", account: false },
  account(U3, "CX3-ZED", { locked: { from: 2, until: LATER }, seen: { opens: 0 } }),
  account(U4, "CX4-ZED", { sent: null, seen: { opens: 0 } }),
  { username: "0000-0000", code: "", account: true, test: true, state: "open", seen: { opens: 0 } }
];
const link = (id, patch) => ({ id, url: "https://example.test/g/" + id, qr: "data:image/png;base64,AAAA", made: ISO, opens: 0, ...patch });
const links = () => [
  link("s1", { standing: true, level: "Platinum" }), link("s2", { standing: true, level: "Gold" }), link("s3", { standing: true, level: "Silver" }),
  link("w1", { by: U1, approved: false, tier: 2 }), link("d1", { by: U1, approved: false, declined: true, tier: 2 }),
  link("r1", { by: U1, approved: true, revoked: true, level: "Gold", tier: 2 }), link("o1", { label: "A shop", tier: 2, opens: 2, last: ISO })
];

/* hash opens the page at an address; review, claims, threads, hours, bulletin and sheet change what each answers (each a function of the answer), for a test that wants
   other orders than the busy day's (links is the guest links). The page's intervals are kept, so a test fires the 30-second read itself; hold(route) keeps the answer to the
   next request for that route back (it is worked out when the request is made, so it is as old as the request) until the function it returns is called; fail is the routes
   that fail to be reached; lapse(true) answers every read 401, as Access does when his sign-in has ended. */
export async function richOwnerPage({ pageWork, failInputs = false, hash = "", review = null, claims = null, threads = null, hours = null, bulletin = null, sheetAnswer = null, linksAnswer = null, failRoutes = [] }) {
  const posts = [], timers = [], store = new Map(), intervals = [], gates = new Map(), fail = new Set(failRoutes), reads = [];
  const hold = (route) => { let release; gates.set(route, new Promise((r) => { release = r; })); return () => release(); };
  const via = (fn) => fn || ((j) => j);
  const ck = await C.contentKey("maker-act-secret", U1);
  const list = { at: ISO, week: { monday: "2026-10-05", label: "This week" }, soon: [], digest: "maker-act-list",
    products: [{ product: "salt", unit: "unit", basis: "tier", sizes: [{ q: 1, price: 100 }, { q: 5, price: 450 }] }] };
  const open = { ok: true, byMaster: true, session: "", assoc: true, wrapMaster: await C.wrapKey("fixture-master", ck),
    prices: Object.assign({ at: list.at, week: list.week.monday, digest: list.digest }, await C.encryptWith(ck, JSON.stringify(list))) };
  const ok200 = (value) => ({ ok: true, status: 200, json: async () => value });
  const answer = (route, init) => {
    if (route === "/open") return open;
    if (route === "/all/sheet") return via(sheetAnswer)({ ok: true, at: ISO, issue: "2026-10-01", accounts: sheet(), desk: { n: 2, at: ISO, moved: false }, stranger: "Silver" });
    if (route === "/all/refs") return via(linksAnswer)({ ok: true, refs: links(), tiers: ["Ambassador", "Platinum", "Gold", "Silver", "Bronze"] });
    if (route.startsWith("/all/account/")) return { ok: true, log: [{ how: "link", at: ISO, where: "An iPhone" }],
      devices: [{ id: "dev-1", label: "An iPhone", kept: true, at: ISO, last: ISO }] };
    if (route.startsWith("/all/signin/")) return { ok: true, msg: "Your link", url: "https://example.test/s/abc" };
    if (route === "/all/handover") return { ok: true, qr: ["101", "010", "101"], code: "ABCD-EFGH", exp: LATER };
    if (route === "/all/assoc") return { ok: true, products: [], at: ISO };
    if (route === "/all/maker/review") return (review || ((j) => j))({ ok: true, orders: orders(), drafts: [draft("d-1"),
      draft("d-2", { row: { qty: 1, total: 100, trip: "t1" } }), draft("d-3", { row: { qty: 1, total: 50, trip: "t1" }, product: "oil" })],
    refused: [{ why: "Refused for the fixture" }],
    queue: [{ id: "q-1", state: "held", canWithdraw: true, fingerprint: "f1" }, { id: "q-2", state: "refused", canRetry: true, fingerprint: "f2", why: "x" }] });
    if (route.endsWith("/preview")) return { ok: true, hash: "a".repeat(64), offerHash: "b".repeat(64), quote: 200, delivery: 10, card: 200,
      floor: 150, margin: { rm: 50, pct: 25 }, cost: { total: 150 }, usual: { rate: 100 }, flags: [], row: { qty: 2, total: 200 } };
    if (route === "/all/maker/inputs") return { ok: true, products: ["salt", "oil"], catalog: catalog() };
    if (route === "/all/maker/offsets") return { ok: true, offers: [{ code: "AX1-ZED", units: 1, rm: 100, saleDate: "2026-10-01", rid: "off-1" }] };
    if (route === "/all/maker/claims") return via(claims)({ ok: true, claims: [{ id: "c-1", u: U1, amount: 50, state: "waiting", slip: "s-1" },
      { id: "c-2", u: U1, amount: 20, state: "waiting" }] });
    if (route === "/all/maker/threads") return via(threads)({ ok: true, threads: [{ u: U1, msgs: [{ by: "customer", at: ISO, text: "Hello" }], quiet: null }] });
    if (route === "/all/maker/bulletin") return via(bulletin)({ ok: true, lines: ["Open late"] });
    if (route === "/all/maker/pools") return { ok: true, pools: [{ id: "p-1", product: "salt", q: 1, target: 10, unitsIn: 3, joins: [1], state: "open", closeLeft: [] },
      { id: "p-2", product: "salt", q: 1, target: 10, unitsIn: 10, joins: [1], state: "closed", closeLeft: [{ id: "o-9", why: "No stock" }] }] };
    if (route === "/all/maker/hours") return via(hours)({ ok: true, config: { schedule: { days: [null, { open: "09:00", close: "17:00" }, null, null, null, null, null] }, manual: null },
      status: { open: true, source: "schedule" } });
    return { ok: true, accounts: [], refs: [], tiers: [], claims: [], threads: [], pools: [], lines: [] };
  };
  let failCash = false, lapsed = false;
  const dom = new JSDOM(landingPage("", "maker-act-nonce", { master: "fixture-master", accounts: sheet().filter((a) => !a.test) }), {
    url: "https://counter.fixture.test/all" + hash, runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.scrollTo = () => {}; w.confirm = () => true;
      w.setTimeout = (f, ms) => { timers.push({ f, ms, off: false }); return timers.length; };
      w.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].off = true; };
      w.setInterval = (f, ms) => { intervals.push({ f, ms, off: false }); return intervals.length; };
      w.clearInterval = (id) => { if (intervals[id - 1]) intervals[id - 1].off = true; };
      /* a retained loan and two kept quick replies on this device, so the page draws the retained-input section and the replies */
      w.localStorage.setItem("saltMakerPending:/all/maker/inputs/loan", JSON.stringify({ path: "/all/maker/inputs/loan",
        body: { at: ISO, form: "cash", direction: "in", code: "CX1-ZED", date: "2026-10-01", amount: 5 } }));
      w.localStorage.setItem("saltQuickReplies", JSON.stringify(["On my way", "Thank you"]));
      w.fetch = async (path, init) => {
        const route = String(path);
        if (init && init.method === "POST") posts.push({ route, body: init.body ? JSON.parse(init.body) : null });
        if (failCash && route.endsWith("/cash")) throw new Error("fixture: the answer was lost");
        if (failInputs && route === "/all/maker/inputs") throw new Error("fixture: the Desk could not be reached");
        if (fail.has(route)) throw new Error("fixture: the Desk could not be reached");
        if (!(init && init.method === "POST")) reads.push(route);
        if (lapsed) return { ok: false, status: 401, type: "basic", json: async () => ({}) };
        const body = answer(route, init);
        if (gates.has(route)) { const held = gates.get(route); gates.delete(route); await held; }
        return ok200(body);
      };
    }
  });
  const w = dom.window, d = w.document, work = pageWork(w);
  const card = (key) => [...d.querySelectorAll("[data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === key);
  const click = async (control) => { control.click(); await work.quiet(); };
  const type = (control, value) => { control.value = value; control.dispatchEvent(new w.Event("input", { bubbles: true })); control.dispatchEvent(new w.Event("change", { bubbles: true })); };
  return { dom, w, d, work, posts, timers, intervals, hold, fail, reads, card, click, type, failCash: (v) => { failCash = v; }, lapse: (v) => { lapsed = v; } };
}

/* every stage, every card and every form drawn once: the page a person would have in front of them on the busiest day */
export async function drawEverything(p) {
  const { d, work, card, click, type } = p;
  await work.quiet();
  /* an extra book on Record's Entry */
  await click(byAct(d, "nav.record"));
  await click(byAct(d, "part.record.entry"));
  await click(byAct(d, "record.trade.add-book"));
  /* the chat opened, an account card, the code sheet, an order placed for them (which stands Orders up, reading the review again) */
  await click(byAct(d, "nav.customers"));
  await click(byAct(d, "part.customers.messages"));
  await click(byAct(d, "chat.open", U1));
  await click(byAct(d, "part.customers.accounts"));
  await click(byAct(d, "acct.open", U1));
  await click(byAct(d.getElementById("aopen"), "acct.show-code"));
  await click(byAct(d.getElementById("aopen"), "acct.order-for"));
  /* a stranger's link */
  await click(byAct(d, "nav.needs"));
  await click(byAct(d, "need.show-link", U2));
  /* a cash hold, and a cash tap whose answer was lost, which offers Retry. A cash tap draws every card again, so the previews
     below come after it, and Orders is entered for the last time before them: entering it reads the review again */
  await click(byAct(d, "nav.orders"));
  type(byAct(card("ord-r2"), "order.cash-amount"), "50"); await click(byAct(card("ord-r2"), "order.cash"));
  type(byAct(card("ord-r3"), "order.cash-amount"), "50"); await click(byAct(card("ord-r3"), "order.cash"));
  p.failCash(true);
  p.timers.filter((t) => t.ms === 10000 && !t.off).at(-1).f(); await work.quiet();
  p.failCash(false);
  /* an order placed, a delivery with its charge, one raised for their yes, one offered again */
  await click(byAct(card("ord-p1"), "order.preview"));
  await click(byAct(card("ord-p2"), "order.fee-10")); await click(byAct(card("ord-p2"), "order.preview"));
  type(byAct(card("ord-p3"), "order.total"), "150"); await click(byAct(card("ord-p3"), "order.preview"));
  await click(byAct(card("ord-a2"), "order.preview-again"));
  /* the group orders, the shop's three parts, the guest links and the report card */
  await click(byAct(d, "part.orders.group"));
  await click(byAct(d, "nav.shop"));
  await click(byAct(d, "part.shop.notice"));
  await click(byAct(d, "part.shop.practice"));
  await click(byAct(d, "part.shop.device"));
  await click(byAct(d, "nav.customers"));
  await click(byAct(d, "part.customers.associates"));
  await click(byAct(d, "part.customers.links"));
}

/* the states a page passes through that the busy page above is not in: sending an account its link in turn, to its end, and a Record that
   could not be read. Each is audited as it stands. */
export async function auditStates({ pageWork }) {
  const states = [];
  const p = await richOwnerPage({ pageWork });
  try {
    await drawEverything(p);
    states.push(["the busy page", actAudit(p.d)]);
    await p.click(byAct(p.d, "need.send-turn"));
    states.push(["sending in turn", actAudit(p.d)]);
    await p.click(byAct(p.d, "need.turn-skip"));
    states.push(["the turn done", actAudit(p.d)]);
  } finally { p.w.close(); }
  const q = await richOwnerPage({ pageWork, failInputs: true });
  try {
    await q.work.quiet();
    await q.click(byAct(q.d, "nav.record"));
    states.push(["a Record that could not be read", actAudit(q.d)]);
  } finally { q.w.close(); }
  return states;
}

/* the acts docs/STATEMENTS.md tabulates: the rows of the table under its data-act heading */
export function docActs() {
  const docs = readFileSync(new URL("../docs/STATEMENTS.md", import.meta.url), "utf8");
  const from = docs.indexOf("### Every Salt Account control has a stable name"), to = from < 0 ? -1 : docs.indexOf("\n## ", from);
  return from < 0 || to < 0 ? null : [...docs.slice(from, to).matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
}
/* a window is named by its starting hour, which the clock decides; the Cancel retained input beside a button is its button's act and .cancel-retained */
const tabulated = (act) => (/[.]cancel-retained$/.test(act) ? null : act.replace(/^order[.]window-\d\d$/, "order.window-<hh>"));

export async function run({ ok, pageWork }) {
  const states = await auditStates({ pageWork });
  const lacking = states.flatMap(([name, a]) => a.missing.map((m) => name + ": " + m));
  const clashing = states.flatMap(([name, a]) => a.clashes.map((m) => name + ": " + m));
  const drawn = new Set(states.flatMap(([, a]) => [...a.acts]).map(tabulated).filter(Boolean));
  ok(states[0][1].controls > 400 && states.every(([, a]) => a.controls > 100) && lacking.length === 0,
    "every control on Salt Account, drawn as the maker harness draws its busiest day, carries a non-empty data-act ("
      + states.map(([name, a]) => name + ": " + a.controls).join(", ") + ")" + (lacking.length ? ", and these do not: " + JSON.stringify(lacking) : ""));
  ok(clashing.length === 0, "no two controls in one card share an act unless they are the same control drawn twice"
    + (clashing.length ? ": " + JSON.stringify(clashing) : ""));
  const listed = docActs() || [], dupes = listed.filter((x, i) => listed.indexOf(x) !== i);
  const absent = [...drawn].filter((x) => !listed.includes(x)), stale = listed.filter((x) => !drawn.has(x));
  ok(listed.length > 200 && dupes.length === 0 && absent.length === 0 && stale.length === 0,
    "the table of acts in docs/STATEMENTS.md names exactly the acts the page draws (" + listed.length + ")"
      + (absent.length ? ", not in the table: " + JSON.stringify(absent) : "") + (stale.length ? ", in the table and not drawn: " + JSON.stringify(stale) : "")
      + (dupes.length ? ", twice: " + JSON.stringify(dupes) : ""));
}
