/* test/admin-approve-card.mjs: THE APPROVE CARD, FOR A PERSON (plan 2 of docs/plans-counter-admin.html, 16 Oct 2026).
 *
 * Prompted 15 Oct 2026 by the s267 card: "no code" in its head, the order not the change, two flags in capitals, a paragraph for a developer, and s262's two drafts on
 * two cards. What is proved here, each check red under its own mutation (test/admin-approve-card.mutations.json):
 *   A  the Desk's Now and After (src/approve-figures.js), off the mirror and the engine: a Correction sets what it names, a Fulfilment adds its cash and units, the
 *      moves on one row read in the order entered after those approved and not yet folded, and what the customer (the bucket's owner) owes against the ceiling
 *   B  the head: the row, the code (read off the draft, never "no code" for a correction), the book's mark, where it came from and when
 *   C  one plain verb (Take back a payment, Close the order: RM 540.00, collected, paid cash), never Correction or Fulfilment on the card
 *   D  Now and After as the Desk sent them, only what changes marked
 *   E  at most two lines, in sentence case, and only those asking a decision; every flag, the note and the row in Details
 *   F  one card per order, its Approve each draft's own approval in the order entered, stopping at the first refusal and saying which; a half-approved order said
 *   G  the button says the result, and Needs you holds the same one card per order
 * Drawn by the maker harness (test/maker-act.mjs), the drafts shaped as the live store held s267 and s262 on 15 Oct 2026. */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { approveFigures, moveRow, rowFigures } from "../src/approve-figures.js";
import POSITION_ENGINE from "../engine/position.mjs";

const J = JSON.stringify;
const route = (verb, id) => "/all/maker/drafts/" + encodeURIComponent(id) + "/" + verb;
const DAY = "2026-10-15";
/* the mirror as it stood: s267 paid and handed over, s262 agreed and untouched, CS6-BS owing RM 20 on a row of its own */
const book = () => ({ sales: [
  { rid: "s267", customer: "CS6-BS-R", qty: 2, total: 220, cash: 220, deliveredQty: 2, date: DAY, paidOn: DAY, amend: [{}, {}, {}] },
  { rid: "s262", customer: "CC9-OKR", qty: 6.25, total: 575, cash: 0, deliveredQty: 0, date: DAY },
  { rid: "s250", customer: "CS6-BS", qty: 1, total: 110, cash: 90, deliveredQty: 1, date: "2026-10-12" }
], purchases: [], state: { TERMS: { ceiling: 250 } } });
const TAKE_BACK = () => ({ id: "2026-10-15T12:48:33.817Z", status: "pending", collection: "sales", party: "CS6-BS-R", product: "salt", qty: 2, total: 220, cost: null,
  amends: "s267", amendKind: "Correction",
  entry: { at: "2026-10-15T12:48:33.817Z", payload: { mode: "amend", kind: "Correction", direction: "SELL", party: "CS6-BS-R", rid: "s267", date: DAY, qty: 0, total: 0, cash: 0, kg: 0, fields: { cash: 0, paidOn: null } } },
  row: { rid: "s267", qty: 2, total: 220, cash: 220, date: DAY, product: "salt", changes: [{ field: "cash", from: 220, to: 0 }, { field: "paidOn", from: DAY, to: null }], customer: "CS6-BS-R" },
  reasoning: "Correction against CS6-BS-R's order of 2 unit for RM 220 dated 2026-10-15 (s267). Sets cash from 220 to 0.",
  flags: ["This row carries a trail of 3 steps. Setting the figure directly does not rewrite them.", "This is an ADVANCE: 2 unit goes out with RM 220 unpaid. Check it against CS6-BS's credit cap."] });
const CLOSE = () => ({ id: "2026-10-15T12:52:26.992Z", status: "pending", collection: "sales", party: "CC9-OKR", product: "salt", qty: 6.25, total: 575, cost: null,
  amends: "s262", amendKind: "Correction",
  entry: { at: "2026-10-15T12:52:26.992Z", payload: { mode: "amend", direction: "SELL", party: "CC9-OKR", rid: "s262", date: DAY, qty: 0, total: 0, kind: "Correction", cash: 0, kg: 0,
    fields: { total: 540, deliveredQty: 6.25, deliveredOn: DAY, handover: "collected" } } },
  row: { rid: "s262", qty: 6.25, total: 575, cash: 0, date: DAY, product: "salt", changes: [{ field: "total", from: 575, to: 540 }, { field: "deliveredQty", from: 0, to: 6.25 }], customer: "CC9-OKR" },
  reasoning: "Correction against CC9-OKR's order.", flags: ["This is an ADVANCE: 6.25 unit goes out with RM 540 unpaid. Check it against CC9-OKR's credit cap."] });
const CASH = () => ({ id: "2026-10-15T12:52:27.992Z", status: "pending", collection: "sales", party: "CC9-OKR", product: "salt", qty: 6.25, total: 575, cost: null,
  amends: "s262", amendKind: "Fulfilment",
  entry: { at: "2026-10-15T12:52:27.992Z", payload: { mode: "amend", direction: "SELL", party: "CC9-OKR", rid: "s262", date: DAY, qty: 0, total: 0, kind: "Fulfilment", cash: 540, kg: 0 } },
  row: { qty: 6.25, total: 575, cash: 0, date: DAY, customer: "CC9-OKR" },
  reasoning: "Fulfilment against CC9-OKR's order. Leaves RM 35 and 6.25 unit outstanding.", flags: [] });
/* a new sale with three flags that ask (the twin's in capitals), one that does not, and no figures of the Desk's: two lines are drawn, in sentence case */
const FLAGGED = () => ({ id: "2026-10-15T13:10:00.000Z", status: "pending", collection: "sales", party: "CX1-ZED", product: "salt", qty: 1, total: 80,
  entry: { at: "2026-10-15T13:10:00.000Z", type: "SELL", party: "CX1-ZED", makerRequest: "f".repeat(64) }, row: { qty: 1, total: 80 }, cost: { total: 56 }, margin: { rm: 24, pct: 30 },
  flags: ["RM 80 for the goods is RM 10 under the floor of RM 90, which is what the order costs to take out: COGS times the size.",
    "Booked to CX1-ZED as R2: CX1 buys it to sell on.",
    "This matches s9 on the book by party, date, size and total and is not marked a SECOND order, so the fold will refuse it as a replay.",
    "RM 120 is recorded as paid against a row worth RM 80, so it would be RM 40 overpaid."] });
/* a site order's handover, its figures as the Desk would send them, raising what is owed over the ceiling */
const OVER = () => ({ id: "2026-10-15T14:00:00.000Z", status: "pending", collection: "sales", party: "CN3-WM", product: "oil", qty: 3, total: 155, amends: "s270", amendKind: "Correction",
  entry: { at: "2026-10-15T14:00:00.000Z", type: "SELL", orderId: "20261015140000-abcdef", payload: { mode: "amend", kind: "Correction", fields: { deliveredQty: 3, deliveredOn: DAY, handover: "delivered" } } },
  row: { rid: "s270", qty: 3, total: 155, cash: 0, product: "oil", changes: [{ field: "deliveredQty", from: 0, to: 3 }], customer: "CN3-WM" }, flags: [],
  figures: { rid: "s270", now: { paid: 0, owed: 155, handed: 0, qty: 3, total: 155, delivery: 0 }, after: { paid: 0, owed: 155, handed: 3, qty: 3, total: 155, delivery: 0 },
    party: "CN3-WM", owedNow: 100, owedAfter: 255, ceiling: 250 } });

export async function run({ ok, pageWork }) {
  /* A. THE DESK'S NOW AND AFTER */
  {
    const b = book(), one = [TAKE_BACK()];
    approveFigures(b, one, []);
    const f = one[0].figures || {};
    ok(J(f.now) === J({ paid: 220, owed: 0, handed: 2, qty: 2, total: 220, delivery: 0 }) && J(f.after) === J({ paid: 0, owed: 220, handed: 2, qty: 2, total: 220, delivery: 0 }),
      "a Correction that takes the cash back reads Paid RM 220 to 0 and Owed 0 to RM 220, Handed over 2 of 2 unchanged, off the mirror's row and the engine: " + J(f));
    ok(f.party === "CS6-BS" && f.owedNow === 20 && f.owedAfter === 240 && f.ceiling === 250 && f.rid === "s267",
      "and what the customer owes is read for the bucket's owner across the book, before and after, against the ceiling in TERMS: " + J([f.party, f.owedNow, f.owedAfter, f.ceiling]));
    const two = [CASH(), CLOSE()];
    approveFigures(book(), two, []);
    const [cash, close] = two;
    ok(J(close.figures.now) === J({ paid: 0, owed: 575, handed: 0, qty: 6.25, total: 575, delivery: 0 }) && J(close.figures.after) === J({ paid: 0, owed: 540, handed: 6.25, qty: 6.25, total: 540, delivery: 0 })
      && J(cash.figures.now) === J(close.figures.after) && J(cash.figures.after) === J({ paid: 540, owed: 0, handed: 6.25, qty: 6.25, total: 540, delivery: 0 }),
    "two moves on one row read in the order entered, whatever order they arrive in: the correction from the mirror, the payment from what the correction leaves: " + J([close.figures, cash.figures]));
    const half = [CASH()];
    approveFigures(book(), half, [CLOSE()]);
    ok(half[0].figures.approvedBefore === 1 && J(half[0].figures.now) === J(close.figures.after),
      "a move approved and not yet folded on the same row is read first, and counted, so the move left reads from it: " + J(half[0].figures));
    const keyed = [Object.assign(CLOSE(), { amends: POSITION_ENGINE.ovKey(book().sales[1]) })];
    approveFigures(book(), keyed, []);
    ok(!!keyed[0].figures && keyed[0].figures.rid === "s262" && J(keyed[0].figures.after) === J(close.figures.after),
      "a move that names its row by the order key, as the drafter does before a row has a rid, finds it as ovAmend does: " + J(keyed[0].figures));
    const lost = [Object.assign(TAKE_BACK(), { amends: "s999" })];
    approveFigures(book(), lost, []);
    ok(!lost[0].figures && J(rowFigures({ qty: 2, total: 100, cash: 30, cancelled: true })) === J({ paid: 30, owed: 0, handed: 0, qty: 2, total: 100, delivery: 0, cancelled: true })
      && J(moveRow({ qty: 2, total: 100, cash: 10, deliveredQty: 1 }, { amendKind: "Fulfilment", entry: { payload: { cash: 20, kg: 1 } } })) === J({ qty: 2, total: 100, cash: 30, deliveredQty: 2 }),
    "a row the mirror lacks carries no figures, a cancelled row owes nothing, and a Fulfilment adds its cash and units");
  }

  /* B to G: the card, drawn from the Desk's figures */
  /* a customer's claim on s267, which is answered on its order's card: it stands alone and never shuts his own move on the row */
  const CLAIM = () => ({ ...CASH(), id: "2026-10-15T12:50:00.000Z", party: "CS6-BS-R", amends: "s267", entry: { at: "2026-10-15T12:50:00.000Z", type: "SELL", orderId: "20261014233900-iqpmgg", claim: { id: "c-9" },
    payload: { mode: "amend", kind: "Fulfilment", cash: 220, kg: 0 } }, row: { qty: 2, total: 220, cash: 0, customer: "CS6-BS-R" } });
  const make = () => { const b = book(), drafts = [CASH(), TAKE_BACK(), CLAIM(), CLOSE(), FLAGGED(), OVER()]; approveFigures(b, drafts.filter((x) => !x.figures), []); return drafts; };
  const holder = {};
  const decided = (j) => ({ ...j, drafts: j.drafts.filter((x) => !((holder.p && holder.p.posts) || []).some((q) => q.route === route("approve", x.id) || q.route === route("reject", x.id))) });
  const open = async (drafts) => {
    holder.p = null;
    const p = await richOwnerPage({ pageWork, review: (j) => decided({ ...j, drafts: drafts(), queue: [] }) });
    holder.p = p;
    await p.work.quiet();
    p.tap = async (act, key) => { const e = byAct(p.d, act, key); if (e) e.click(); await p.work.quiet(); return !!e; };
    p.card = (id) => p.d.querySelector('#makerDrafts [data-maker-card="draft:' + id + '"]');
    p.sheet = () => p.d.getElementById("ynSheet");
    p.go = async () => { p.d.getElementById("ynGo").click(); await p.work.quiet(); };
    p.approves = () => p.posts.filter((x) => /\/approve$/.test(x.route)).map((x) => decodeURIComponent(x.route.split("/")[4]));
    return p;
  };
  const markless = (n) => { const c = n.cloneNode(true); c.querySelectorAll(".pwith").forEach((x) => x.replaceWith("[mark]")); return c.textContent; };
  const said = (p, key) => (p.d.querySelector('[data-maker-say="' + key + '"]') || {}).textContent || p.d.getElementById("makerDraftStatus").textContent;

  let p = await open(make);
  try {
    const d = p.d;
    await p.tap("nav.orders"); await p.tap("part.orders.approve");
    const s267 = p.card("2026-10-15T12:48:33.817Z"), s262 = p.card("2026-10-15T12:52:26.992Z");
    /* B. the head */
    const head = s267 && s267.querySelector(".salt-approve__head");
    ok(!!head && markless(head.querySelector(".salt-approve__party")) === "s267 · CS6-BS-R · [mark]" && head.querySelector(".salt-approve__party svg.psym")
      && head.querySelector(".salt-approve__entry").textContent === "from laptop, 15 Oct 2026, 20:48" && !/no code/.test(d.getElementById("makerDrafts").textContent),
    "the head is the row, the customer's code read off the draft (no \"no code\" for a correction), the book's mark, and from where and when: " + (head && head.textContent));
    const claimCard = p.card("2026-10-15T12:50:00.000Z");
    ok(!!claimCard && byAct(claimCard, "draft.approve").disabled && !byAct(s267, "draft.approve").disabled && s267.querySelectorAll(".rdet--row .salt-approve__reason").length === 1,
      "a customer's claim on the same row stands on a card of its own, shut, and his take-back on that row stays his to approve");
    const heads = [...d.querySelectorAll("#makerDrafts .salt-approve__entry")].map((x) => x.textContent.replace(/, .*/, ""));
    ok(J(heads) === J(["from laptop", "from the site", "from laptop", "from Counter Admin", "from the site"]), "each card says where its entry came from: laptop, Counter Admin, the site: " + J(heads));
    /* C. one verb */
    const verbs = [...d.querySelectorAll("#makerDrafts .apverb")].map((x) => x.textContent);
    ok(J(verbs) === J(["Take back a payment", "Payment received", "Close the order: RM 540.00, collected, paid cash", "New sale", "Handover"])
      && !/Correction|Fulfilment/.test([...d.querySelectorAll("#makerDrafts [data-maker-card]")].map((c) => [...c.children].filter((x) => !x.classList.contains("rdet")).map((x) => x.textContent).join(" ")).join(" ")),
    "one plain verb a card, and the book's words Correction and Fulfilment nowhere outside Details: " + J(verbs));
    /* D. Now and After */
    const table = (card) => [...card.querySelectorAll(".apnow tbody tr")].map((tr) => [...tr.children].map((x) => (x.classList.contains("apchg") && x.querySelector("strong") ? "*" : "") + x.textContent));
    ok(J(table(s267)) === J([["Paid", "RM 220.00", "*RM 0.00"], ["Owed", "RM 0.00", "*RM 220.00"], ["Handed over", "2 of 2 units", "2 of 2 units"]])
      && J([...s267.querySelectorAll(".apnow thead th")].map((x) => x.textContent)) === J(["", "Now", "After"]),
    "Now and After read Paid, Owed and Handed over as the Desk sent them, only the changed figures marked: " + J(table(s267)));
    ok(J(table(s262)) === J([["Paid", "RM 0.00", "*RM 540.00"], ["Owed", "RM 575.00", "*RM 0.00"], ["Handed over", "0 of 6.25 units", "*6.25 of 6.25 units"]]),
      "a card of two moves reads the first move's Now and the last move's After: " + J(table(s262)));
    /* E. the lines that ask */
    const lines = (card) => [...card.querySelectorAll(":scope > .apflag")].map((x) => x.textContent.trim());
    ok(J(lines(s267)) === J(["! CS6-BS will owe RM 240.00 (under the RM 250.00 ceiling)."]) && J(lines(s262)) === J([]),
      "the take-back asks one thing, what the customer will owe against the ceiling; the trail and the advance it means to make ask nothing; a close that lowers what is owed says nothing: " + J([lines(s267), lines(s262)]));
    const fl = p.card(FLAGGED().id), over = p.card(OVER().id);
    ok(J(lines(fl)) === J(["! RM 80 for the goods is RM 10 under the floor of RM 90.", "! This matches s9 on the book by party, date, size and total and is not marked a second order, so the fold will refuse it as a replay."])
      && lines(fl).every((t) => !/\b(?!RM\b)[A-Z]{2,}\b/.test(t.replace(/CX1-ZED/g, ""))) && !fl.querySelector(".salt-approve__flags, .salt-status"),
    "two lines at most, those that ask a decision, in sentence case and no capitals, and no pill: " + J(lines(fl)));
    ok(J(lines(over)) === J(["! CN3-WM will owe RM 255.00, over the RM 250.00 ceiling."]), "over the ceiling is said as over: " + J(lines(over)));
    /* the rest is under Details: the drafter's note, every flag and the row */
    const det = s267.querySelector(":scope > .rdet--row");
    ok(!!det && det.hidden && /Sets cash from 220 to 0/.test(det.textContent) && det.querySelectorAll(".apnote").length === 2 && /trail of 3 steps/.test(det.textContent) && /advance/i.test(det.textContent)
      && /Rowreferences267/.test(det.textContent.replace(/\s+/g, "")) && det.querySelectorAll(".apnote").length + lines(s267).length === 3,
    "Details keeps the drafter's note, every flag and the row's id: " + (det && det.textContent.slice(0, 200)));
    ok(fl.querySelectorAll(".rdet--row .apnote").length === 4, "a card that shows two lines still keeps all four flags in Details");
    /* F and G: one card for s262, its button the result */
    ok(!p.card(CASH().id) && s262.querySelectorAll("[data-act='draft.approve']").length === 1 && s262.querySelectorAll(".rdet--row h4").length === 2,
      "s262's two drafts are one card with one Approve, both moves in its Details");
    ok((s262.querySelector(".rdet--row").textContent.replace(/\s+/g, "").match(/Rowreferences262/g) || []).length === 2,
      "and each move's Details names the row, the payment's too, whose drafted row leaves its id off");
    const btn = (card) => byAct(card, "draft.approve").textContent;
    ok(btn(s267) === "Approve: s267 owes RM 220.00" && btn(s262) === "Approve: s262 closed" && btn(over) === "Approve: s270 handed over" && btn(fl) === "Approve the sale",
      "the button says the result: " + J([btn(s267), btn(s262), btn(over), btn(fl)]));
    const needs = [...d.querySelectorAll('#nlist [data-need^="d:"]')];
    ok(needs.length === 5 && needs.some((n) => byAct(n, "need.approve-row") && byAct(n, "need.approve-row").textContent === "Approve: s262 closed"),
      "Needs you holds the same one card per order, its pill the same result: " + needs.map((n) => n.getAttribute("data-need")).join(" "));
    byAct(s262, "draft.approve").click(); await p.work.quiet();
    ok(p.sheet() && p.sheet().querySelector(".salt-sheet__title").textContent === "Approve every move on this order?" && p.sheet().querySelectorAll(".salt-ledger__row").length === 2
      && p.approves().length === 0, "the merged Approve asks once, listing both moves, and sends nothing as it opens");
    await p.go();
    ok(J(p.approves()) === J(["2026-10-15T12:52:26.992Z", "2026-10-15T12:52:27.992Z"]) && p.posts.filter((x) => /\/approve$/.test(x.route)).every((x) => J(x.body) === "{}"),
      "his yes sends each draft's own approval, the same route and empty body, in the order entered: " + J(p.approves()));
    ok(/Both moves approved\./.test(said(p, "draft:2026-10-15T12:52:26.992Z")) && !p.card("2026-10-15T12:52:26.992Z"), "and says both were approved: " + said(p, "draft:2026-10-15T12:52:26.992Z"));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* the first refusal stops the rest, and says which */
  p = await open(make);
  try {
    p.refuse[route("approve", "2026-10-15T12:52:27.992Z")] = "already approved";
    await p.tap("nav.orders"); await p.tap("part.orders.approve");
    byAct(p.card("2026-10-15T12:52:26.992Z"), "draft.approve").click(); await p.work.quiet(); await p.go();
    ok(J(p.approves()) === J(["2026-10-15T12:52:26.992Z", "2026-10-15T12:52:27.992Z"]) && /^1 of 2 approved\. Move 2, payment received, was not approved: The Counter could not do that\. Try again\.Details/.test(said(p, "draft:2026-10-15T12:52:26.992Z")) && /already approved/.test(said(p, "draft:2026-10-15T12:52:26.992Z")),
      "a refusal of the second move is named, with the first approved: " + said(p, "draft:2026-10-15T12:52:26.992Z"));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  p = await open(make);
  try {
    p.refuse[route("approve", "2026-10-15T12:52:26.992Z")] = "the row moved";
    await p.tap("nav.orders"); await p.tap("part.orders.approve");
    byAct(p.card("2026-10-15T12:52:26.992Z"), "draft.approve").click(); await p.work.quiet(); await p.go();
    ok(J(p.approves()) === J(["2026-10-15T12:52:26.992Z"]) && /^Move 1, close the order, was not approved: The Counter could not do that\. Try again\. The moves after it wait under Approve\./.test(said(p, "draft:2026-10-15T12:52:26.992Z")) && /the row moved/.test(said(p, "draft:2026-10-15T12:52:26.992Z")),
      "a refusal of the first move sends nothing after it, and says the rest wait: " + J(p.approves()) + " " + said(p, "draft:2026-10-15T12:52:26.992Z"));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  /* a half-approved order: the move left reads from the one approved, and says so */
  p = await open(() => { const left = [CASH()]; approveFigures(book(), left, [CLOSE()]); return left; });
  try {
    await p.tap("nav.orders"); await p.tap("part.orders.approve");
    const c = p.card(CASH().id);
    ok(!!c && /^Half approved: one move on this row approved before, waiting to be booked; this one waits for you\.$/.test((c.querySelector(".aphalf") || {}).textContent || "")
      && c.querySelector(".apverb").textContent === "Payment received" && byAct(c, "draft.approve").textContent === "Approve: s262 paid",
    "a half-approved order says so, and the move left reads from the one approved: " + (c && c.textContent.slice(0, 200)));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
