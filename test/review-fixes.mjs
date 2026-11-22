/* test/review-fixes.mjs: THE REVIEW'S CONTENT FAULTS (18 Nov 2026, his yes to fix what the laptop screenshots showed). Words and one empty state; no route,
 * request body, price or booking changes. Each check observes a signed-in page in jsdom and is red under its own mutation (test/review-fixes.mutations.json).
 *   R1  a customer whose live statement is withheld reads that on Orders, never "No orders yet"; a new customer, the statement read, still reads the none state
 *   R2  with site orders on the page and the statement withheld, the notice stands where the earlier orders would
 *   R3  the next unit's row says it once: the title and the figure, no second line repeating the meter
 *   R4  Needs you's lead counts what is under Pending when nothing waits on his tap, and never says nothing needs him over those cards
 *   R5  books in one state alone are said once ("2 books are low on stock.")
 *   R6  Receivables' line under its figure says what the paid is of: the agreed orders
 *   R7  a kind holding FYI cards alone carries no figure, never a 0 beside its cards
 *   R8  the search field's placeholder is in the page's own face, the typed code in mono
 * Every code, name and password here is invented. */
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { SITE_CSS } from "../stmt/statement-css.js";

const BUILD = "c".repeat(16);
const t = (e) => { if (!e) return ""; const c = e.cloneNode(true); c.querySelectorAll("svg").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const wins = [];
  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const counter = async ({ status = "current", orders = [], loyal = false }) => {
    const u = "abcd-efgh", pass = "fixture-pass-r1", ck = await C.contentKey("test-secret", u);
    const pay = { term: 1, hide: 3, lock: 4, window: 60, now: { rm: 0, due: null, parts: [] }, overdue: { rm: 0, parts: [] }, coming: { rm: 0, parts: [] } };
    const stamped = { at: ago(1), body: '<h2 class="amb-section">Statement of account</h2>', owed: 0, pay, buildId: BUILD };
    const body = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-r1", liveStatus: status,
      live: status === "current" ? Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))) : null,
      env: await C.encryptWith(ck, JSON.stringify({ statements: [] })),
      prices: await C.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), week: { monday: new Date().toISOString().slice(0, 10), label: "This week" },
        products: [{ product: "salt", unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }, { q: 2, price: 20 }] }], soon: [] })) };
    if (loyal) body.card = await C.encryptWith(ck, JSON.stringify({ products: [{ product: "salt", unit: "unit", summary: {}, lines: [], reward: null, loyal: { next: 0.4 } }] }));
    let work;
    const dom = new JSDOM(P.landingPage(u, "nr1", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.open = () => null;
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        const j = (p === "/open" || p === "/account") ? body : (p === "/orders" && m === "GET") ? { ok: true, orders, claims: [] } : (p === "/links" ? { ok: true, links: [], max: 3 } : null);
        return { ok: !!j, status: j ? 200 : 404, json: async () => j || { ok: false } };
      };
      work = pageWork(win);
    } });
    wins.push(dom.window);
    const d = dom.window.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden && !!d.getElementById("pOrder").textContent);
    await work.quiet();
    return d;
  };
  const one = { id: "o-r2", status: "acknowledged", at: ago(30), product: "salt", qty: 2, unit: "unit", total: 20, delivery: 0, paid: 0, moved: 0, mode: "collect",
    history: [{ at: ago(30), status: "placed", by: "customer" }, { at: ago(1), status: "acknowledged", by: "desk" }], msgs: [], payments: [] };
  try {
    /* R1 */
    const held = await counter({ status: "updating" }), fresh = await counter({});
    const hl = held.querySelector("#pOrder [data-olist]"), fl = fresh.querySelector("#pOrder [data-olist]");
    ok(!!hl && !!hl.querySelector('[data-unread="acct.updating"]') && !hl.querySelector('[data-oempty="none"]') && !/No orders yet/.test(t(hl)),
      "a statement withheld is said on Orders, never No orders yet: " + t(hl));
    ok(!!fl && !!fl.querySelector('[data-oempty="none"]') && !fl.querySelector("[data-unread]") && /^No orders yet\./.test(t(fl)),
      "and a new customer whose statement was read still reads the none state, its one way on: " + t(fl));
    /* R2 */
    const some = await counter({ status: "updating", orders: [one] }), sl = some.querySelector("#pOrder [data-olist]");
    ok(!!sl && sl.children.length > 1 && !!sl.lastElementChild && sl.lastElementChild.getAttribute("data-unread") === "acct.updating",
      "with an order on the page the notice stands last, where the earlier orders would: " + (sl && sl.lastElementChild && sl.lastElementChild.outerHTML.slice(0, 90)));
    /* R3 */
    const loyal = await counter({ loyal: true }), lr = loyal.querySelector('[data-reward="loyal"]'), meter = lr && lr.querySelector("progress.amb-meter");
    ok(!!lr && t(lr.querySelector(".amb-row__title")) === "To your next unit" && t(lr.querySelector(".amb-row__sub")) === "" && t(lr.querySelector(".amb-row__amount")) === "40%" && !!meter && meter.getAttribute("aria-label") === "40% of the way to your next unit",
      "the next unit's row says it once, the title and the figure, the meter named for a reader: " + t(lr));
  } finally { wins.forEach((w) => { try { w.close(); } catch (e) { /* closed */ } }); }

  /* R5 to R7: Salt Admin's Needs you */
  const STOCK = { ok: true, today: "2026-11-18", books: { salt: { shelf: 11, free: 8.5, commit: 2.5, coverDays: 2, transit: 0, light: "amber" },
    rice: { shelf: 6, free: 6, commit: 0, coverDays: 1, transit: 0, light: "amber" }, oil: { shelf: 9, free: 9, commit: 0, coverDays: 30, transit: 0, light: "green" } }, by: {} };
  const p = await richOwnerPage({ pageWork, extra: (r) => (r === "/all/maker/stock" ? STOCK : undefined) });
  try {
    await p.work.quiet();
    const d = p.d; byAct(d, "nav.needs").click(); await p.work.quiet();
    const lead = t(d.getElementById("nCount"));
    ok(/ 2 books are low on stock\.$/.test(lead) && !/need stock/.test(lead), "two books low and none out or promised past the shelf are said once: " + lead);
    const delta = t(d.querySelector('#nGlance [data-glance="owed"] .amb-tile__delta'));
    ok(/^RM [\d,.]+ paid of RM [\d,.]+ agreed$/.test(delta), "Receivables' line says what the paid is of, the agreed orders: " + delta);
    /* 22 Nov 2026 (the place head): the kinds are the Show pull-down's choices, counting the part shown (To do) */
    const chips = [...d.querySelectorAll("#nKinds button[data-chip]")].map((b) => [b.getAttribute("data-chip"), t(b.querySelector(".nkopt__n")), b.getAttribute("aria-disabled") === "true"]);
    ok(chips.length > 1 && chips.every((c) => (c[2] ? c[1] === "0" : c[1] !== "0")), "a kind that is not dimmed never carries a 0, and a dimmed one says 0: " + JSON.stringify(chips));
  } finally { p.w.close(); }
  /* R4: nothing on his tap, cards under Pending */
  const quiet = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: j.orders.filter((o) => o.id === "ord-p4"), drafts: [], refused: [], queue: [] }), claims: (j) => ({ ...j, claims: [] }),
    threads: (j) => ({ ...j, threads: [] }), linksAnswer: (j) => ({ ...j, refs: [] }), sheetAnswer: (j) => ({ ...j, accounts: [] }),
    extra: (r) => (r === "/all/joins" ? { ok: true, joins: [{ id: "jn-1", state: "added", code: "CX9-ZED", made: "2026-11-17T00:00:00.000Z", addedAt: "2026-11-17T01:00:00.000Z", by: "" }] } : undefined) });
  try {
    await quiet.work.quiet();
    const d = quiet.d; byAct(d, "nav.needs").click(); await quiet.work.quiet();
    const lead = t(d.getElementById("nCount")), cards = [...d.querySelectorAll("#nlist .amb-section, #nlist h2, #nlist h3")].map(t);
    ok(/^1 pending\. Nothing waits on your tap now\./.test(lead) && !/Nothing needs you/.test(lead), "with an offer waiting on their yes under Pending and nothing to do, the lead counts it: " + lead + " " + JSON.stringify(cards) + t(d.getElementById("nlist")).slice(0, 400));
    /* 22 Nov 2026 (the place head): a kind counts the part shown, so an FYI card is counted on FYI: there its kind is on, with its figure, and on To do,
       with nothing to do, every kind but All is dimmed at 0 */
    const kindsOf = () => [...d.querySelectorAll("#nKinds button[data-chip]")].map((b) => [b.getAttribute("data-chip"), t(b.querySelector(".nkopt__n")), b.getAttribute("aria-disabled") === "true"]);
    const onTodo = kindsOf();
    byAct(d, "part.needs.fyi").click(); await quiet.work.quiet();
    const onFyi = kindsOf();
    ok(onTodo.every((c) => c[0] === "all" ? !c[2] : (c[2] && c[1] === "0")) && onFyi.some((c) => !c[2] && /^[1-9]/.test(c[1]) && c[0] !== "all") && onFyi.every((c) => (c[2] ? c[1] === "0" : c[1] !== "0")),
      "and a kind holding an FYI card is on, with its figure, on FYI, while To do with nothing to do dims every kind but All: " + JSON.stringify([onTodo, onFyi]));
  } finally { quiet.w.close(); }
  /* R8 */
  const css = SITE_CSS.replace(/\s+/g, " ");
  ok(/\.amb-input\.mono::placeholder \{ font-family: var\(--amb-font\); \}/.test(css), "the search field's placeholder is in the page's own face");
}
