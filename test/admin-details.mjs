/* test/admin-details.mjs: AN ID IS FOR QUOTING, NOT FOR READING, AND A ROW'S DETAILS ARE NAMES AND VALUES (Phase 4c of the Salt Admin redesign, 12 Oct 2026;
 * glossary 5.2 of the redesign review; docs/STATEMENTS.md "Unsent entries say so, and every id and row keeps its detail behind Details").
 *
 * An order's reference was a grey line down its card, a Desk row's figures were a block of JSON, and a claim's id and a held entry's id were nowhere a person could quote
 * them. Now each card keeps its reference, its moment and what else it was made from behind ONE Details control, shut, as a list of names and values (the system's plain
 * Ledger list). Nothing is sent by opening one, and no request, body or request id of any card changes. Each check is red under its own mutation
 * (test/admin-details.mutations.json, run with tools/section.mjs). What is proved here:
 *   A  an order card: no reference down the card, and from 20 Oct 2026 no Details either (canvas V36): the band carries the short reference
 *   B  a claim card: Details (claim.details) holding Reference, Sent and the slip, and the id is not read out on the card
 *   C  a Desk row: Details (row.proposed) holds the draft's reference then the row's figures in his words, a date as a day, a size in units, a sum in RM, a yes as Yes,
 *      a name the page has no word for spaced out and a nested figure on one line; never JSON; a trip's second row has its own
 *   D  a held entry: Details (queue.details) with the reference, the moment its id is and its state
 *   E  a claim row's flag that is not a sentence is worded, never JSON
 *   F  every Details is shut until it is opened and opening one sends nothing */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const ISO = "2026-10-10T08:00:00.000Z", C1 = "abcd-efgh:c-1", C2 = "abcd-efgh:c-2";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* a Details list as [name, value] pairs, in the order drawn */
const pairs = (box) => [...box.querySelectorAll(".salt-ledger__row")].map((r) => [r.querySelector(".salt-ledger__label").textContent, r.querySelector(".salt-ledger__value").textContent]);
/* the text of a card with its Details taken out: what a person reads down it */
const bare = (card) => { const c = card.cloneNode(true); [...c.querySelectorAll("details")].forEach((x) => x.remove()); return c.textContent; };
const detailsOf = (card, act, key) => { const s = byAct(card, act, key); return s && s.parentElement; };

export async function run({ ok, pageWork }) {
  const open = async (opts = {}) => {
    const p = await richOwnerPage({ pageWork, ...opts });
    await p.work.quiet();
    return p;
  };

  /* A. THE ORDER CARDS */
  let p = await open({ review: (j) => { j.orders = j.orders.map((o) => (o.id === "ord-p1" ? { ...o, at: ISO } : o)); return j; } });
  try {
    const d = p.d;
    await p.click(byAct(d, "nav.orders"));
    /* 20 Oct 2026 (canvas V36): an order's card has no Details; the band carries the short reference, the moment and the way */
    const card = p.card("ord-p1");
    ok(!!card && !detailsOf(card, "order.details", "ord-p1") && /^[A-Z0-9]{4}-[A-Z0-9]{3}$/.test((card.querySelector(".ohead .salt-band__ref") || {}).textContent || ""),
      "an order's card has no Details fold, its short reference in the band's corner");
    ok(!bare(card).includes("ord-p1") && ![...card.querySelectorAll(".maker-facts")].some((f) => /^Reference/.test(f.textContent)),
      "the card itself does not read the reference out: " + bare(card).slice(0, 160));
    ok(!detailsOf(p.card("ord-p2"), "order.details", "ord-p2") && !detailsOf(p.card("ord-x1"), "order.details", "ord-x1"), "nor a delivery's, nor a closed order's");
    ok(!bare(p.card("ord-x1")).includes("ord-x1"), "and does not read its reference out either");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* B. THE CLAIM CARD, and E. a claim row's flag that is not a sentence */
  p = await open({ claims: (j) => { j.claims[0].at = ISO; return j; }, claimPreview: (j) => { j.rows[0].flags = [{ rid: "s-9", total: 5 }, "Already counted"]; return j; } });
  try {
    const d = p.d;
    await p.click(byAct(d, "nav.orders"));
    await p.click(byAct(d, "claim.open", C1));
    const card = d.querySelector('#makerClaims [data-maker-card="claim:' + C1 + '"]'), box = card && detailsOf(card, "claim.details", C1);
    ok(!!box && !box.open && same(pairs(box), [["Reference", "c-1"], ["Sent", "10 Oct 2026, 16:00"], ["Slip", "Attached"]]),
      "a claim's card has Details, shut, with the claim's reference, when it was sent and that a slip is attached: " + JSON.stringify(box && pairs(box)));
    ok(!!card && !/(^|[^a-z])c-1([^a-z0-9]|$)/.test(bare(card)), "and the card does not read the id out: " + (card && bare(card).slice(0, 200)));
    const flags = [...card.querySelectorAll(".maker-quote .salt-insight")].map((x) => x.textContent);
    ok(flags.includes("Row reference: s-9, Price: RM 5.00") && flags.includes("Already counted") && !flags.some((t) => /[{}"]/.test(t)),
      "a flag that is not a sentence is worded as names and values, and a sentence is as it came, never JSON: " + JSON.stringify(flags));
    await p.click(byAct(d, "claim.open", C1));
    await p.click(byAct(d, "claim.open", C2));
    const second = d.querySelector('#makerClaims [data-maker-card="claim:' + C2 + '"]'), box2 = second && detailsOf(second, "claim.details", C2);
    ok(!!box2 && same(pairs(box2), [["Reference", "c-2"], ["Slip", "None"]]),
      "a claim with no slip says None, and a moment the Counter did not give is no line: " + JSON.stringify(box2 && pairs(box2)));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* C. THE DESK ROW, and D. the held entry */
  const ROW = { qty: 2.5, total: 280, cost: 150, rid: "s-77", customer: "CX1-ZED", date: "2026-10-10", cancelled: false, deliveredQty: 1, mixedKey: "x", books: ["salt", "oil"], sizes: [1, 5, 10], nested: { total: 5, qty: 1 } };
  p = await open({ review: (j) => {
    j.drafts[0].row = ROW;
    j.queue = [{ id: "2026-10-09T14:11:05.000Z", state: "held", canWithdraw: true, fingerprint: "f1" }, { id: "q-2", state: "refused", canRetry: true, fingerprint: "f2", why: "x" }];
    return j;
  } });
  try {
    const d = p.d;
    await p.click(byAct(d, "nav.orders")); await p.click(byAct(d, "part.orders.approve"));
    const row = d.querySelector('#makerDrafts [data-maker-card="draft:d-1"]'), box = row && row.querySelector(".rdet--row");
    ok(!!box && box.hidden && same(pairs(box), [["Reference", "d-1"], ["Units", "2.5 units"], ["Price", "RM 280.00"], ["Cost", "RM 150.00"], ["Row reference", "s-77"], ["Who", "CX1-ZED"],
      ["Order date", "10 Oct 2026"], ["Cancelled", "No"], ["Units delivered", "1 unit"], ["Mixed key", "x"], ["Sizes", "1, 5, 10"], ["Nested", "Price: RM 5.00, Units: 1 unit"]]),
    "a Desk row's Details is the draft's reference then the row's figures in his words (a size in units, a sum in RM, a day, a yes as Yes or No, a name with no word spaced out, a list on one line, a figure inside a figure on one line), and a field that is only a book's name is left out, since no book has a name on this page: " + JSON.stringify(box && pairs(box)));
    ok(!!box && !/\b(salt|oil|candy|rice|gas)\b/i.test(box.textContent), "and no book's name is read out in it: " + (box && box.textContent));
    ok(!!row && !row.querySelector("pre") && !/[{}[\]"]/.test(box.textContent), "never JSON: no preformatted block and no brace or quote in it: " + (box && box.textContent));
    const trip = d.querySelector('#makerDrafts [data-maker-card="draft:d-2"]');
    const tp = trip ? [...trip.querySelectorAll(".rdet--row .salt-ledger--plain")].map(pairs) : [];
    ok(!!trip && tp.length === 2 && same(tp[1], [["Reference", "d-3"], ["Units", "1 unit"], ["Price", "RM 50.00"], ["Trip", "t1"]]) && !d.querySelector('#makerDrafts [data-maker-card="draft:d-3"]'),
    "a trip's second row has its own detail, under its own reference, in the trip's one card: " + JSON.stringify(tp));
    const held = d.querySelector('#makerQueueReview [data-key="2026-10-09T14:11:05.000Z"]'), refused = d.querySelector('#makerQueueReview [data-key="q-2"]');
    const hb = held && detailsOf(held, "queue.details", "2026-10-09T14:11:05.000Z"), rb = refused && detailsOf(refused, "queue.details", "q-2");
    ok(!!hb && !hb.open && same(pairs(hb), [["Reference", "2026-10-09T14:11:05.000Z"], ["Sent", "09 Oct 2026, 22:11"], ["State", "Waiting for the Desk"]])
      && !!rb && same(pairs(rb), [["Reference", "q-2"], ["State", "Refused"]]),
    "a held entry has Details with its reference, the moment its id is (Kuala Lumpur) and its state: " + JSON.stringify([hb && pairs(hb), rb && pairs(rb)]));
    ok(!!held && !bare(held).includes("T14:11:05") && !bare(rb.closest("[data-key]")).includes("q-2"), "and the card reads neither id out: " + (held && bare(held)));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* F. SHUT UNTIL OPENED, AND NOTHING SENT */
  p = await open();
  try {
    const d = p.d;
    await p.click(byAct(d, "nav.orders")); await p.click(byAct(d, "part.orders.approve"));
    p.posts.length = 0;
    const boxes = [...d.querySelectorAll("details.rdet")], heads = [...d.querySelectorAll('#makerDrafts [data-act="row.proposed"]')];
    boxes.forEach((b) => { b.open = true; });
    heads.forEach((h) => h.click());
    await p.work.quiet();
    ok(boxes.length >= 2 && heads.length >= 2 && boxes.every((b) => b.querySelector("summary").getAttribute("data-act")) && p.posts.length === 0,
      "opening every Details on Orders > Approve sends nothing, and each is a control with an act: " + boxes.length + " " + JSON.stringify(p.posts));
    ok(boxes.every((b) => b.querySelector(".salt-ledger") && b.querySelectorAll(".salt-ledger__row").length >= 1), "each holds a list of names and values");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
