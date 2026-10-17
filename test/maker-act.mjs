/* test/maker-act.mjs: THE OWNER PAGE'S data-act HOOKS (11 Oct 2026, docs/STATEMENTS.md).
 *
 * byAct is the one way a test finds a control on Salt Account by what it does, never by its words, so a later change of
 * label, class or layout leaves the test where it was. richOwnerPage draws the page as the Counter's maker harness draws it
 * with the richest fixture there is: orders at every stage, a claim, links waiting, an account card open, every Record form,
 * a chat, a group order, the notice, the hours, the hand-over sheet. actAudit reads every control on it. */
import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { landingPage, PSHAPE } from "../stmt/page.js";
import * as C from "../tools/stmt-crypto.mjs";
import { slipSeal } from "../tools/seed-vault.mjs";

/* ONE SLIP KEY, as the vault holds it (12 Oct 2026, Phase 2b): an ECDH P-256 pair whose private half is sealed under an invented passphrase exactly as the vault seals
   it (PBKDF2 150,000 rounds, AES-GCM), and a four-byte JPEG sealed to its public half by the laptop's own slipSeal. Made once and kept, since the key takes a moment. */
let slipFix = null;
export async function slipFixture() {
  if (slipFix) return slipFix;
  const keys = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pass = "invented-local-pass", jwk = await webcrypto.subtle.exportKey("jwk", keys.privateKey);
  const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const b64 = (v) => Buffer.from(v).toString("base64");
  const seal = async (value) => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16)), iv = webcrypto.getRandomValues(new Uint8Array(12));
    const aes = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const ct = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(value)));
    return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  };
  const sealed = await slipSeal(await webcrypto.subtle.exportKey("jwk", keys.publicKey), new Uint8Array([255, 216, 255, 217]));
  /* the vault's other two envelopes, under the same password: an invented name and an invented place for the first customer's code (CX1-ZED) and nothing for the others */
  const nameOf = { "CX1-ZED": "Invented Person (Pudu)" }, placeOf = { "CX1-ZED": { addr: "Invented Lane", lat: 3.1, lng: 101.7, src: "waze", at: "2026-10-03T16:30:00.000Z" }, _base: { addr: "Invented base", lat: 3.1, lng: 101.6 } };
  return (slipFix = { pass, envelope: await seal(jwk), sealed, names: await seal(nameOf), places: await seal(placeOf), nameOf, placeOf });
}

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

/* THE OPTION TILES OF A FORM (Phase 4a, 12 Oct 2026): a group is a fieldset.maker-tiles whose legend is the field's label, and a tile a radio in it. tile() taps
   one as he does and says whether there was one to tap; tileValue() is the value chosen ('' when none is), tileValues() the values offered, and tileGroup() the
   fieldset, which answers .value as the select it replaced did. A form is told its choice by the radio's change, so a test drives the tile and not the group. */
export function tileGroup(root, label) { return [...root.querySelectorAll("fieldset.maker-tiles")].find((f) => legendLabel(f.querySelector("legend")) === label) || null; }
/* A LEGEND ABOUT A BOOK ENDS IN THE BOOK'S MARK AND NO WORD (his word of 12 Oct 2026). legendLabel is the legend's words, then ", " and the code of the book that its mark stands for (read off the shape the
   mark tells a reader), so a test names a group "Starting level, salt" as it always did while the page draws the mark alone. A legend with no mark is just its words. */
export function legendLabel(legend) {
  const g = legend.cloneNode(true), mark = g.querySelector(".pwith"), shape = mark ? (mark.querySelector(".sr") || { textContent: "" }).textContent : "";
  if (mark) mark.remove();
  const book = shape && Object.keys(PSHAPE).find((k) => k !== "_" && PSHAPE[k] === shape);
  return g.textContent.trim() + (book ? ", " + book : "");
}
export function tileValues(root, label) { const g = tileGroup(root, label); return g ? [...g.querySelectorAll("input")].map((r) => r.value) : null; }
export function tileValue(root, label) { const g = tileGroup(root, label); return g ? (g.querySelector("input:checked") || { value: "" }).value : null; }
export function tile(root, label, value) {
  const g = tileGroup(root, label), r = g && [...g.querySelectorAll("input")].find((x) => x.value === String(value));
  if (r) r.click();
  return !!r;
}

/* THE ONE UNLOCK (Phase 4b, 12 Oct 2026, his decision 3 of 11 Oct): one Sheet with one password field opens names, places and the slip key for the whole page. The Unlock in Shop > This device
   (vault.unlock, which is in the page whichever place shows) opens it, the password is typed into vault.passphrase and vault.open sends it. unlockPage does that and says whether the page settled;
   a form that used to take its own password field is now driven by calling this once, before it. */
export async function unlockPage(win, work, pass) {
  const doc = win.document;
  byAct(doc, "vault.unlock").click();
  byAct(doc, "vault.passphrase").value = pass;
  byAct(doc, "vault.open").click();
  return work.quiet();
}

/* A YES OR NO ON SALT ACCOUNT IS A SHEET (Phase 2c, 12 Oct 2026, his decision 4 of 11 Oct), never a native confirm. A section that once stubbed window.confirm to say yes or no to whatever the page asked has each
   Sheet answered as it comes up instead: what it said (its title and its words) is put in asked, and answer() is read at that moment, true taking the one action and false the ghost, so a flow that
   awaits the question carries on as the stub's return would have sent it. The page's own ynGo and ynKeep are what is tapped. */
export function answerSheets(win, asked, answer = () => true) {
  const doc = win.document;
  new win.MutationObserver(() => {
    const sheet = doc.getElementById("ynSheet");
    if (!sheet || sheet.hasAttribute("data-answered")) return;
    sheet.setAttribute("data-answered", "");
    asked.push(sheet.querySelector(".salt-sheet__title").textContent + " " + sheet.textContent);
    doc.getElementById(answer() ? "ynGo" : "ynKeep").click();
  }).observe(doc.body, { childList: true });
}

/* THE CARD OF AN ORDER, as he gets it (Phase 1c of 11 Oct 2026): a card is drawn for the order opened and for no other, so a test that wants
   an order's card gets the card standing for it, else enters the part its row is in (when that part is not showing) and taps the row. A
   card already standing is the same card, so a field typed in it is kept; asking for another order's closes this one, as it does for him. */
export function cardOf(doc, id) {
  const find = () => [...doc.querySelectorAll("[data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === String(id)) || null;
  const there = find();
  if (there) return there;
  const row = [...doc.querySelectorAll('[data-act="order.open"]')].find((r) => r.getAttribute("data-key") === String(id));
  if (!row) return null;
  const parts = row.getAttribute("data-in").split(" ").map((t) => t.replace(/^orders[.]/, ""));
  const here = doc.querySelector('.place[data-m="orders"][aria-current="page"]'), now = doc.querySelector('.aparts[data-place="orders"] [aria-selected="true"]');
  if (!here || !now || !parts.includes(now.getAttribute("data-part"))) { const tab = doc.querySelector('[data-act="part.orders.' + parts[0] + '"]'); if (tab) tab.click(); }
  row.click();
  return find();
}

/* ---- the audit ---- */
export const CONTROLS = 'button, input:not([type="hidden"]), select, textarea, summary, a[href], [role="button"], [role="tab"]';
/* his page: the roster shell, the ended screen, the one control of his in a customer's view, the sheet that shows a code, the look Sheet, the
   yes or no Sheet an order card asks on, and the Sheet of the one unlock */
export const OWNER_ROOTS = "#roster, #aEnded, #lock, .salt-sheet.ho, #lookSheet, #ynSheet, #vaultSheet";
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
  placed: { "CX1-ZED": [3.1, 101.7, "Pudu"] }, parties: ["CX1-ZED", "CX2-ZED", "SX1-ZED", "AX1-ZED", "AX1-ZED-R"],
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
  appointmentCustomers: ["CX1-ZED"], appointmentKinds: [{ kind: "reseller", stream: "R2" }],
  /* plan 1 (15 Oct 2026): what is owed both ways, as the Desk serves it (src/maker-inputs.js owedBothWays); none on the richest day, a test adds its own */
  today: "2026-10-10", owedMoney: [], owedGoods: []
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
   that fail to be reached; refuse[route] = "the server's words" answers that route as a refusal (409, ok false, those words), as the Counter does; lapse(true) answers every read 401, as Access does when his
   sign-in has ended. probe: true leaves window.__owner(code) in the page, which evaluates code inside the page script's own scope (a test seam, the page is otherwise as served). assocAnswer changes the associates' report card, and inputsAnswer what Record's forms are told (the books, the customers, the rows, the tips), as the others change theirs. */
export async function richOwnerPage({ pageWork, failInputs = false, hash = "", review = null, claims = null, claimPreview = null, slip = false, threads = null, hours = null, bulletin = null, sheetAnswer = null, linksAnswer = null, failRoutes = [], probe = false, assocAnswer = null, inputsAnswer = null, retained = [], cryptoImpl = webcrypto, noKey = false, bare = false, extra = null }) {
  const posts = [], timers = [], store = new Map(), intervals = [], gates = new Map(), fail = new Set(failRoutes), reads = [], refuse = {}, wire = [];
  /* slip: true gives the page the vault's slip key (the passphrase is p.slipPass) and a sealed picture for any slip asked; the blob: URLs it draws are counted in p.urls; noKey: true files the names and places but no slip key; retained is extra [key, value] pairs kept in localStorage; cryptoImpl is the page's crypto; p.wire is every request that left the page */
  const fix = slip ? await slipFixture() : null, urls = { made: [], revoked: [] };
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
    if (route === "/all/assoc") return via(assocAnswer)({ ok: true, products: [], at: ISO });
    if (route === "/all/maker/review") return (review || ((j) => j))({ ok: true, orders: orders(), drafts: [draft("d-1"),
      draft("d-2", { row: { qty: 1, total: 100, trip: "t1" } }), draft("d-3", { row: { qty: 1, total: 50, trip: "t1" }, product: "oil" })],
    refused: [{ why: "Refused for the fixture" }],
    queue: [{ id: "q-1", state: "held", canWithdraw: true, fingerprint: "f1" }, { id: "q-2", state: "refused", canRetry: true, fingerprint: "f2", why: "x" }] });
    /* a claim's rows, as the Desk's preview answers them: the rows its amount would settle, and what is left over */
    if (/^\/all\/maker\/claims\/[^/]+\/[^/]+\/preview$/.test(route)) return via(claimPreview)({ ok: true, hash: "c".repeat(64), rows: [{ date: "2026-10-08", rm: 50, owed: 60, rid: "s-fixture-1" }], left: 0, booked: false });
    if (fix && route === "/all/maker/vault/key") return { ok: true, vault: noKey ? null : fix.envelope };
    if (fix && route === "/all/maker/vault") return { ok: true, vault: fix.names };
    if (fix && route === "/all/maker/vault/addr") return { ok: true, vault: fix.places };
    if (fix && route.startsWith("/all/maker/slips/")) return { ok: true, slip: fix.sealed };
    if (route.endsWith("/preview")) return { ok: true, hash: "a".repeat(64), offerHash: "b".repeat(64), quote: 200, delivery: 10, card: 200,
      floor: 150, margin: { rm: 50, pct: 25 }, cost: { total: 150 }, usual: { rate: 100 }, flags: [], row: { qty: 2, total: 200 } };
    if (route === "/all/maker/inputs") return via(inputsAnswer)({ ok: true, products: ["salt", "oil"], catalog: catalog() });
    if (route === "/all/maker/ledger") return { ok: true, version: 1, orders: 0, open: [], pending: [], recent: [] };
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
  const html = landingPage("", "maker-act-nonce", { master: "fixture-master", accounts: sheet().filter((a) => !a.test) });
  const dom = new JSDOM(probe ? html.replace("  function fmtWhen(v){", "  window.__owner=function(s){return eval(s);};\n  function fmtWhen(v){") : html, {
    url: "https://counter.fixture.test/all" + hash, runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, "crypto", { value: cryptoImpl, configurable: true });
      w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.scrollTo = () => {}; w.confirm = () => true;
      w.URL.createObjectURL = () => { const u = "blob:fixture-" + (urls.made.length + 1); urls.made.push(u); return u; };
      w.URL.revokeObjectURL = (u) => { urls.revoked.push(u); };
      w.setTimeout = (f, ms) => { timers.push({ f, ms, off: false }); return timers.length; };
      w.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].off = true; };
      w.setInterval = (f, ms) => { intervals.push({ f, ms, off: false }); return intervals.length; };
      w.clearInterval = (id) => { if (intervals[id - 1]) intervals[id - 1].off = true; };
      /* a retained loan and two kept quick replies on this device, so the page draws the retained-input section and the replies */
      /* bare: true keeps no retained loan, so a quiet day can be wholly quiet */
      if (!bare) w.localStorage.setItem("saltMakerPending:/all/maker/inputs/loan", JSON.stringify({ path: "/all/maker/inputs/loan",
        body: { at: ISO, form: "cash", direction: "in", code: "CX1-ZED", date: "2026-10-01", amount: 5 } }));
      w.localStorage.setItem("saltQuickReplies", JSON.stringify(["On my way", "Thank you"]));
      retained.forEach(([k, v]) => w.localStorage.setItem(k, v));
      w.fetch = async (path, init) => {
        const route = String(path);
        /* everything that leaves the page: the address, the method, the headers and the body, as a test reads them back */
        wire.push(String(path) + " " + ((init && init.method) || "GET") + " " + JSON.stringify((init && init.headers) || {}) + " " + ((init && init.body) || ""));
        if (init && init.method === "POST") posts.push({ route, body: init.body ? JSON.parse(init.body) : null });
        if (failCash && route.endsWith("/cash")) throw new Error("fixture: the answer was lost");
        if (failInputs && route === "/all/maker/inputs") throw new Error("fixture: the Desk could not be reached");
        if (fail.has(route)) throw new Error("fixture: the Desk could not be reached");
        if (Object.prototype.hasOwnProperty.call(refuse, route)) return { ok: false, status: 409, type: "basic", json: async () => ({ ok: false, error: refuse[route] }) };
        /* extra(route, body) answers a route of a test's own: undefined falls through, { refuse: words, detail } answers it as the Counter's refusal (409), detail's fields beside the words */
        const own = extra ? extra(route, init && init.body ? JSON.parse(init.body) : null) : undefined;
        if (own && own.refuse) return { ok: false, status: 409, type: "basic", json: async () => ({ ...(own.detail || {}), ok: false, error: own.refuse }) };
        if (own) return ok200(own);
        if (!(init && init.method === "POST")) reads.push(route);
        if (lapsed) return { ok: false, status: 401, type: "basic", json: async () => ({}) };
        const body = answer(route, init);
        if (gates.has(route)) { const held = gates.get(route); gates.delete(route); await held; }
        return ok200(body);
      };
    }
  });
  const w = dom.window, d = w.document, work = pageWork(w);
  const card = (key) => cardOf(d, key);
  const snaps = [], snap = (name) => { snaps.push([name, actAudit(d)]); };
  const click = async (control) => { control.click(); await work.quiet(); };
  const type = (control, value) => { control.value = value; control.dispatchEvent(new w.Event("input", { bubbles: true })); control.dispatchEvent(new w.Event("change", { bubbles: true })); };
  return { dom, w, d, work, posts, wire, timers, intervals, hold, fail, refuse, reads, card, snaps, snap, click, type, urls, slipPass: fix && fix.pass, failCash: (v) => { failCash = v; }, lapse: (v) => { lapsed = v; } };
}

/* every stage, every card and every form drawn once: the page a person would have in front of them on the busiest day */
export async function drawEverything(p) {
  const { d, work, card, click, type } = p;
  await work.quiet();
  /* an extra book on Record's Entry */
  await click(byAct(d, "nav.record"));
  await click(byAct(d, "part.record.entry"));
  await click(byAct(d, "record.trade.add-book"));
  /* Orders > Approve (Phase 2c): the Desk's rows are the Approve card and the queue is a fold, shut and counted; Approve, Reject and a held entry's Withdraw each ask on the page's Sheet, let go with Keep.
     The group order's Close and the notice's Set and Clear ask on it too, each below where its own part is entered. */
  await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.approve"));
  const row = d.querySelector('#makerDrafts [data-maker-card="draft:d-1"]');
  p.snap("the rows to approve, the queue shut");
  await click(byAct(row, "draft.approve")); p.snap("a Desk row's Approve, asking on the sheet"); await click(byAct(d, "ask.keep"));
  await click(byAct(row, "draft.reject")); p.snap("a Desk row's Reject, asking on the sheet"); await click(byAct(d, "ask.keep"));
  await click(byAct(d, "record.queue-toggle")); p.snap("the queue opened");
  await click(byAct(d, "queue.withdraw", "q-1")); p.snap("a held entry's Withdraw, asking on the sheet"); await click(byAct(d, "ask.keep"));
  await click(byAct(d, "record.queue-toggle"));
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
  /* a cash hold, and a cash tap whose answer was lost, which offers Retry. A cash tap draws the card again, and a card is drawn for the order
     opened alone (Phase 1c), so each is audited as it stands. Orders is entered for the last time before the previews: entering it reads the review again */
  await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.payments"));
  /* the account claims (Phase 2b): a row each, and the one opened is its card, which reads its rows, keeps its slip sealed until the passphrase opens the slip key and then draws
     it as a thumbnail, and asks on the Sheet; a claim whose rows could not be read offers them again */
  const c1 = "abcd-efgh:c-1", c2 = "abcd-efgh:c-2";
  p.snap("the account claims, a row each");
  await click(byAct(d, "claim.open", c1)); p.snap("a claim opened, its slip sealed");
  /* the one unlock (Phase 4b): the Sheet opened from the card's Unlock, then the password sent; a slip that could not be read offers to be opened again; Lock seals it */
  await click(byAct(d, "vault.unlock", c1)); p.snap("the one unlock, asking for the password");
  type(byAct(d, "vault.passphrase"), "not-the-password"); await click(byAct(d, "vault.open")); p.snap("the one unlock, refused");
  type(byAct(d, "vault.passphrase"), p.slipPass); await click(byAct(d, "vault.open")); p.snap("a claim opened, its slip drawn");
  await click(byAct(d, "claim.open", c1));
  p.fail.add("/all/maker/slips/abcd-efgh/s-1");
  await click(byAct(d, "claim.open", c1)); p.snap("a slip that could not be read, offering to open it again");
  p.fail.delete("/all/maker/slips/abcd-efgh/s-1");
  await click(byAct(d, "claim.view-slip", c1));
  await click(byAct(d, "vault.lock", c1)); p.snap("a claim opened, its slip locked again");
  await click(byAct(d, "claim.received", c1)); p.snap("a claim's Received, asking on the sheet"); await click(byAct(d, "claim.ask-keep"));
  await click(byAct(d, "claim.not-found", c1)); p.snap("a claim's Not found, asking on the sheet"); await click(byAct(d, "claim.ask-keep"));
  p.fail.add("/all/maker/claims/abcd-efgh/c-2/preview");
  await click(byAct(d, "claim.open", c2)); p.snap("a claim whose rows could not be read");
  p.fail.delete("/all/maker/claims/abcd-efgh/c-2/preview");
  await click(byAct(d, "claim.open", c2));
  type(byAct(card("ord-r2"), "order.pay-amount"), "50"); await click(byAct(card("ord-r2"), "order.pay-by", "cash")); await click(byAct(card("ord-r2"), "order.pay"));
  p.snap("a cash hold, with its Undo");
  type(byAct(card("ord-r3"), "order.pay-amount"), "50"); await click(byAct(card("ord-r3"), "order.pay-by", "cash")); await click(byAct(card("ord-r3"), "order.pay"));
  p.failCash(true);
  p.timers.filter((t) => t.ms === 10000 && !t.off).at(-1).f(); await work.quiet();
  p.failCash(false);
  p.snap("a cash tap whose answer was lost");
  card("ord-r1"); p.snap("a ready order");
  /* the sheets an order card asks on (his decision 4 of 11 Oct 2026): a Cancel, a Decline with the place line, and a stage offered again; each is let go with Keep */
  await click(byAct(card("ord-r1"), "order.cancel")); p.snap("a Cancel, asking on the sheet"); await click(byAct(d, "order.ask-keep"));
  /* an order placed, a delivery with its charge, one raised for their yes, one offered again, one waiting on an offer, one with claims, a closed one */
  /* a card reads its own preview when its order is opened, and again when an input is changed (his decision 6 of 11 Oct 2026) */
  card("ord-p1"); await work.quiet(); p.snap("a placed order, previewed");
  await click(byAct(card("ord-p2"), "order.fee-10")); p.snap("a delivery, previewed");
  await click(byAct(card("ord-p2"), "order.decline")); p.snap("a Decline, asking on the sheet with its reason tiles"); await click(byAct(d, "order.ask-keep"));
  p.fail.add("/all/maker/orders/ord-p3/preview");
  type(byAct(card("ord-p3"), "order.total"), "150"); await work.quiet(); p.snap("a read that could not be made");
  p.fail.delete("/all/maker/orders/ord-p3/preview");
  await click(byAct(card("ord-p3"), "order.reread")); p.snap("a raise, previewed");
  p.refuse["/all/maker/orders/ord-p3/preview"] = "The order book could not be read.";
  type(byAct(card("ord-p3"), "order.total"), "160"); await work.quiet(); p.snap("a read the Desk refused, with its Details");
  delete p.refuse["/all/maker/orders/ord-p3/preview"];
  await click(byAct(card("ord-p3"), "order.reread"));
  card("ord-p4"); p.snap("an offer sent for their yes");
  card("ord-a1"); p.snap("an agreed order with claims waiting");
  /* Change the order (Phase 4c, glossary 5.2) is a Sheet of Units, Price (goods) and Delivery, let go with Not now */
  await click(byAct(card("ord-a1"), "order.amend")); p.snap("a Change the order, asking on the sheet with its figures"); await click(byAct(d, "order.ask-keep"));
  card("ord-a2"); await work.quiet(); p.snap("an agreed order offered again");
  card("ord-x1"); p.snap("a closed order with a stage he rejected");
  await click(byAct(card("ord-x1"), "order.again-pay")); p.snap("a stage offered again, asking on the sheet"); await click(byAct(d, "order.ask-keep"));
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
  const p = await richOwnerPage({ pageWork, slip: true });
  try {
    await drawEverything(p);
    states.push(...p.snaps);   /* the order cards, each as it stood when opened: a card is drawn for the order opened alone */
    states.push(["the busy page", actAudit(p.d)]);
    await p.click(byAct(p.d, "need.send-turn"));
    states.push(["sending in turn", actAudit(p.d)]);
    await p.click(byAct(p.d, "need.turn-skip"));
    states.push(["the turn done", actAudit(p.d)]);
  } finally { p.w.close(); }
  /* an order with no row on the book, its rejected steps covered by one Not needed: a card of its own, so the busy page's lists stay as they were */
  const w = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: [{ ...placed, id: "ord-w1", status: "declined", mode: "collect", qty: 1, total: 100, again: ["ack", "move"], againWhole: true }] }) });
  try {
    await w.work.quiet(); w.card("ord-w1"); await w.work.quiet();
    states.push(["an order with no row, Not needed covering all", actAudit(w.d)]);
  } finally { w.w.close(); }
  /* plan 1: a day with money owed past term and goods to hand over, each a Needs you card of its own, so the busy page's lists stay as they were */
  const o = await richOwnerPage({ pageWork, inputsAnswer: (j) => { Object.assign(j.catalog, { owedMoney: [{ party: "CX1-ZED", rm: 150, since: "2026-09-20", due: "2026-09-21",
    rows: [{ rid: "row-1", key: "CX1-ZED|2026-09-01|200", product: "salt", rm: 150, since: "2026-09-20", due: "2026-09-21" }] }],
  owedGoods: [{ party: "CX2-ZED", rid: "row-1", key: "CX2-ZED|2026-10-05|99|oil", product: "oil", units: 1.5, date: "2026-10-05" }] }); return j; } });
  try {
    await o.work.quiet();
    states.push(["a day with money and goods owed", actAudit(o.d)]);
  } finally { o.w.close(); }
  /* 17 Oct 2026 (Counter Admin clarity, part 2): a payment on the card asking once, and a practice account folded at the foot */
  const k = await richOwnerPage({ pageWork, review: (j) => { const a = j.orders.find((x) => x.id === "ord-a1"); a.payments = a.payments.filter((x) => x.claim === "waiting").slice(0, 1); return j; },
    claims: (j) => { j.claims.push({ id: "c-x", u: "u-practice", amount: 10, state: "waiting", test: true, at: new Date().toISOString() }); return j; } });
  try {
    await k.work.quiet();
    await k.click(byAct(k.d, "need.received", "p:ord-a1"));
    states.push(["a payment asking once on its Needs you card, a practice account folded", actAudit(k.d)]);
  } finally { k.w.close(); }
  const q = await richOwnerPage({ pageWork, failInputs: true });
  try {
    await q.work.quiet();
    await q.click(byAct(q.d, "nav.record"));
    states.push(["a Record that could not be read", actAudit(q.d)]);
  } finally { q.w.close(); }
  /* plan 3 (16 Oct 2026): an order of several books, its split read, and a buyer's same-day rows offered as one (test/admin-trips.mjs proves what each does) */
  const line = (rid, product, qty, total) => ({ rid, product, qty, total, delivery: 0, paid: 0, owed: total, handed: 0, left: qty, waiting: 0, open: true });
  const trip = { trip: "t1791900000000", party: "CX1-ZED", date: "2026-10-10", owed: 300, paid: 0, handedLines: 0, waiting: 0, lines: [line("tr-1", "salt", 1, 200), line("tr-2", "oil", 2, 100)] };
  const day = { ...trip, trip: undefined, rids: ["dy-1", "dy-2"], party: "CX2-ZED", lines: [line("dy-1", "salt", 1, 200), line("dy-2", "oil", 2, 100)] };
  /* his flow (17 Oct 2026): a row of the book as an order, and Completed paged (test/admin-flow.mjs proves what each does) */
  const bookRow = (rid, stage, f) => ({ rid, party: "CX3-ZED", product: "salt", date: "2026-10-10", key: "CX3-ZED|2026-10-10|200|" + rid, qty: 1, total: 200, delivery: 10, paid: 0, owed: 210, handed: 0, left: 1, waiting: 0, stage, ...f });
  const rows = [bookRow("rw-1", "confirmed"), bookRow("rw-2", "confirmed", { qty: 2, total: 400, owed: 410, handed: 1, left: 1, closeAt: 200 })].concat(Array.from({ length: 51 }, (_, i) => bookRow("rd-" + i, "done", { paid: 210, owed: 0, handed: 1, left: 0 })));
  const part = { id: "20261010010000-actprt", u: "u-act-part", status: "ready", qty: 2, total: 200, delivery: 0, paid: 0, moved: 1, product: "salt", mode: "collect", at: "2026-10-10T01:00:00.000Z", payments: [], msgs: [], history: [] };
  const t = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat([part]), trips: [trip], sameDay: [day], rows }),
    extra: (route) => route === "/all/maker/trip-split" ? { ok: true, split: { trip: trip.trip, amount: 50, shares: [{ rid: "tr-1", product: "salt", rm: 50, owed: 200 }] } } : undefined });
  try {
    await t.work.quiet();
    await t.click(byAct(t.d, "nav.orders"));
    const tc = t.card("trip:" + trip.trip);
    t.type(byAct(tc, "trip.pay-amount", trip.trip), "50");
    await t.click(byAct(tc, "trip.pay-split", trip.trip));
    states.push(["an order of several books, its split read", actAudit(t.d)]);
    t.card("day:dy-1+dy-2"); await t.work.quiet();
    states.push(["a buyer's same-day rows offered as one order", actAudit(t.d)]);
    t.card("row:rw-1"); await t.work.quiet();
    states.push(["a row of the book as an order", actAudit(t.d)]);
    t.card("row:rw-2"); await t.work.quiet();
    states.push(["a row of the book with goods out", actAudit(t.d)]);
    await t.click(byAct(t.d, "part.orders.ready")); t.card(part.id); await t.work.quiet();
    states.push(["a site order with goods out", actAudit(t.d)]);
    await t.click(byAct(t.d, "part.orders.ledger")); await t.work.quiet();
    states.push(["the Ledger with its tie-out", actAudit(t.d)]);
    await t.click(byAct(t.d, "part.orders.done"));
    states.push(["Completed, paged", actAudit(t.d)]);
  } finally { t.w.close(); }
  /* a customer's claim among the rows to approve: its link to the payment card (clarity part 4) */
  const cl = await richOwnerPage({ pageWork, review: (j) => ({ ...j, drafts: [draft("d-c", { entry: { type: "SELL", party: "CX1-ZED", date: "2026-10-10", claim: { id: "c-1" } } })] }) });
  try {
    await cl.work.quiet();
    await t.click(byAct(cl.d, "nav.orders")); await t.click(byAct(cl.d, "part.orders.approve"));
    states.push(["a claim's row to approve", actAudit(cl.d)]);
  } finally { cl.w.close(); }
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
  const busiest = states.find(([name]) => name === "the busy page")[1].controls;
  ok(busiest > 300 && states.every(([, a]) => a.controls > 100) && lacking.length === 0,
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
