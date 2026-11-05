/* test/admin-order-card.mjs: THE ORDER CARD (Phase 2a of the Salt Admin redesign, 12 Oct 2026; docs/STATEMENTS.md "The order card").
 *
 * An order opened in Orders is a card (stmt/owner.js orderCard), and his decisions of 11 Oct 2026 shape it: 6, the card reads its own preview
 * when the order is opened and the Preview button is retired; 4, sheets replace every native confirm; 8, cash keeps its ten seconds and its Undo
 * and sends on leaving, said on the card. What is proved here, each check red under its own mutation (test/admin-order-card.mutations.json):
 *   1  the preview: read once on opening the detail, never by a row or by listing, read afresh on each opening, kept by a redraw, waited on
 *      while it is out, nothing read for a delivery with no charge chosen, no Preview button, and Accept again read on opening too
 *   2  the stage foot: the moves of the card's stage stand together at its foot, the filled one first, the answer line under them, shut while cash
 *      is held for the order, and standing along the card's foot as it scrolls
 *   3  the sheets: Decline, Cancel order, Close at these units and Offer again each ask on the page's Sheet with a native confirm never asked, the reason
 *      on option tiles, one action sending the request the confirm let through, the four ways out sending nothing, and Tab kept inside
 *   4  the tick: the Sent checkbox is gone from an account card (25 Oct 2026, his decision), Mark as sent is a ghost button of the 44px token; the page's
 *      tick rules (still the For a friend tick's) keep the input over the box drawn beside it at the token both ways (settled in Chromium by a hit test,
 *      the four corners of the input each toggling it; jsdom has no layout, so this reads the page's own CSS rules)
 * Drawn by the maker harness (test/maker-act.mjs), whose hold(route) keeps an answer back until it is let go. */
import { richOwnerPage, byAct, PART_OF } from "./maker-act.mjs";

const previews = (p, id) => p.posts.filter((x) => /[/]preview$/.test(x.route) && (!id || x.route.includes("/" + id + "/")));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* the page's own CSS as jsdom parsed it: ruleOf(selector, media) is the declarations of each rule with exactly that selector (and media, with no spaces) */
const cssRules = (w) => {
  const rules = [];
  for (const sheetCss of w.document.styleSheets) for (const r of sheetCss.cssRules) {
    if (r.selectorText) rules.push(["", r.selectorText, r.style]);
    else if (r.media) for (const x of r.cssRules) if (x.selectorText) rules.push([r.media.mediaText.replace(/\s+/g, ""), x.selectorText, x.style]);
  }
  return (sel, media = "") => rules.filter((r) => r[0] === media && r[1] === sel).map((r) => r[2]);
};

export async function run({ ok, pageWork }) {
  const open = async () => {
    /* 2 Nov 2026 (Orders on the canvas): the list has no Refresh, so a read that finds a change elsewhere (a field on an order he is not in) is what redraws the list and the card */
    let bump = 0;
    const p = await richOwnerPage({ pageWork, review: (j) => { const x = (j.orders || []).find((o) => o.id === "ord-x1"); if (x) x.bumped = bump; return j; } });
    await p.work.quiet();
    p.bumpRead = () => { bump++; const t = p.intervals.filter((i) => i.ms === 5000 && !i.off)[0]; if (t) t.f(); };
    p.enter = async () => { byAct(p.d, "nav.orders").click(); await p.work.quiet(); };
    p.tapRow = async (id) => { const r = byAct(p.d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    p.cardOf = (id) => [...p.d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    p.accept = () => p.d.querySelector("#makerReview [data-accept]");
    p.say = () => (p.d.querySelector("#makerReview .salt-insight[role=status]") || { textContent: "" }).textContent;
    return p;
  };

  /* 1. THE PREVIEW IS READ ON OPENING THE DETAIL */
  let p = await open();
  try {
    const d = p.d;
    await p.enter();
    ok(d.querySelectorAll('[data-act="order.open"]').length > 4 && previews(p).length === 0 && !p.reads.some((r) => /preview/.test(r)),
      "entering Orders and listing its rows asks the Desk for no preview: a row of the list reads nothing");
    await p.tapRow("ord-p1");
    const one = previews(p, "ord-p1");
    ok(one.length === 1 && one[0].route === "/all/maker/orders/ord-p1/preview" && same(one[0].body, { total: 200, delivery: 0 }) && !!p.accept(),
      "opening a placed order reads its preview once, at its own total, and Accept follows: " + JSON.stringify(one));
    const acts = [...d.querySelectorAll("#makerReview [data-act]")].map((e) => e.getAttribute("data-act"));
    ok(!acts.includes("order.preview") && ![...d.querySelectorAll("#makerReview button")].some((b) => /^Preview/.test(b.textContent)),
      "and the card has no Preview button");
    await p.tapRow("ord-p3");
    ok(previews(p, "ord-p3").length === 1 && previews(p, "ord-p1").length === 1 && previews(p).length === 2,
      "another order opened reads its own preview and the first is not read again: " + previews(p).map((x) => x.route).join());
    await p.tapRow("ord-p2");
    ok(previews(p, "ord-p2").length === 0 && !p.accept() && /Choose the delivery charge/.test(p.cardOf("ord-p2").textContent),
      "a delivery with no charge chosen reads nothing, says to choose one, and offers no Accept");
    await p.tapRow("ord-p1");
    ok(previews(p, "ord-p1").length === 2 && !!p.accept(), "an order opened again reads its figures afresh: " + previews(p, "ord-p1").length);
    const seen = previews(p).length;
    p.bumpRead(); await p.work.quiet();
    ok(previews(p).length === seen && !!p.accept() && p.cardOf("ord-p1") && /Figures read/.test(p.say()),
      "a redraw of the card keeps its figures and its Accept and reads nothing again: " + previews(p).length + " of " + seen);
    /* an edit put back to what it was fires no change, and the read it waits for would never come: the card offers it (12 Oct 2026, Phase 2b) */
    const total = byAct(d, "order.total", "ord-p1"), typed = (v) => { total.value = v; total.dispatchEvent(new p.w.Event("input", { bubbles: true })); };
    const reread = () => d.querySelector('#makerReview [data-act="order.reread"]');
    typed("250"); typed("200");
    ok(!p.accept() && /read again when you finish/.test(p.say()) && !!reread() && previews(p, "ord-p1").length === 2,
      "a total edited and put back before it is finished takes Accept away and offers Read the figures again, reading nothing by itself: " + p.say());
    reread().click(); await p.work.quiet();
    const again = previews(p, "ord-p1");
    ok(again.length === 3 && same(again[2].body, { total: 200, delivery: 0 }) && !!p.accept() && !reread() && /Figures read/.test(p.say()),
      "and that control reads the figures as they stand, Accept comes back, and the control goes: " + JSON.stringify(again[2]));
    typed("250");
    ok(!!reread(), "a total edited again offers it again");
    total.dispatchEvent(new p.w.Event("change", { bubbles: true })); await p.work.quiet();
    ok(previews(p, "ord-p1").length === 4 && !reread() && !!p.accept(), "and finishing the edit as it always did reads at once, with the control gone");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* a read that is still out when the card is drawn again is waited on, never asked for twice */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    const release = p.hold("/all/maker/orders/ord-p3/preview");
    byAct(d, "order.open", "ord-p3").click();
    const before = p.cardOf("ord-p3");
    p.bumpRead();
    for (let i = 0; i < 400 && (!p.cardOf("ord-p3") || p.cardOf("ord-p3") === before); i++) await new Promise((r) => setTimeout(r, 5));
    const redrawn = p.cardOf("ord-p3") !== before && !!p.cardOf("ord-p3");
    release(); await p.work.quiet();
    ok(redrawn && previews(p, "ord-p3").length === 1 && !!p.accept() && p.accept().isConnected && p.cardOf("ord-p3").contains(p.accept()),
      "a card drawn again while its read is out waits on that read, asks the Desk once, and lands Accept on the card now standing: " + previews(p, "ord-p3").length);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* an agreed order whose pending row he rejected reads its Accept again on opening, with no Preview button */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    byAct(d, "part.orders.todo").click(); await p.work.quiet();
    await p.tapRow("ord-a2");
    const a2 = previews(p, "ord-a2");
    ok(a2.length === 1 && same(a2[0].body, {}) && !!byAct(d, "order.accept-again", "ord-a2") && !byAct(d, "order.preview-again", "ord-a2"),
      "an order with a rejected pending row reads its preview on opening, sends nothing priced, and offers Accept again with no Preview Accept again: " + JSON.stringify(a2));
    await p.tapRow("ord-a1");
    ok(previews(p, "ord-a1").length === 0, "an agreed order with nothing rejected reads no preview");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 2. THE STAGE FOOT (Phase 2a): the moves of the card's stage at its foot */
  const closedDone = { id: "ord-c1", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0, paid: 0, msgs: [], payments: [], history: [], mode: "collect", status: "done" };
  p = await richOwnerPage({ pageWork, review: (j) => { j.orders.push({ ...closedDone }); return j; } });
  try {
    const d = p.d;
    await p.work.quiet();
    p.tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    p.cardOf = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    const part = async (name) => { byAct(d, "part.orders." + (PART_OF[name] || name)).click(); await p.work.quiet(); };
    const foot = () => d.querySelector("#makerReview .maker-foot");
    const moves = () => foot() ? [...foot().querySelectorAll(".maker-foot__acts [data-act]")].map((e) => e.getAttribute("data-act")).filter((a) => !/[.]cancel-retained$/.test(a)) : null;
    byAct(d, "nav.orders").click(); await p.work.quiet();
    await p.tapRow("ord-p1");
    /* Counter Batch A (18 Oct 2026): the order's chip carries the customer page's glyph before its word, aria-hidden */
    const chipP1 = p.cardOf("ord-p1").querySelector(".ohead .salt-status"), gP1 = chipP1 ? [...chipP1.querySelectorAll("svg")] : [];
    ok(!!chipP1 && chipP1.textContent === "To agree" && gP1.length === 1 && chipP1.firstChild === gP1[0] && gP1[0].getAttribute("aria-hidden") === "true"
      && gP1[0].getAttribute("data-g") === "dot" && gP1[0].classList.contains("salt-status__glyph"),
      "a placed order's chip on Salt Admin leads with the dot, aria-hidden, its word unchanged: " + (chipP1 ? chipP1.outerHTML.slice(0, 160) : "none"));
    /* 25 Oct 2026 (canvas Salt Admin Orders): the band names the book by its typed tag beside the code and draws no mark; the reply's fold says Answer */
    /* 2 Nov 2026 (his Orders canvas, page 2): the band's foot holds the typed tag and the code; the Answer fold is gone, its composer stands in view under Messages */
    const bandP1 = p.cardOf("ord-p1").querySelector(".ohead"), footP1 = bandP1.querySelector(".salt-band__foot"), compP1 = p.cardOf("ord-p1").querySelector('.omsgs form.salt-composer [data-act="order.reply-text"]');
    ok(!!footP1.querySelector(".salt-producttag--salt") && !bandP1.querySelector(".ogoods__tile, svg.psym") && /CX1-ZED/.test(footP1.textContent)
      && !!compP1 && !compP1.closest("details") && !p.cardOf("ord-p1").querySelector('details[data-fold="answer"]') && !byAct(d, "order.answer"),
      "the band names the book by its typed tag beside the code, no mark, and the reply's box stands in view under Messages, no Answer fold: " + (compP1 ? "composer" : "none"));
    /* 18 Oct 2026 (clarity, part 3): the answer leads the card, Agree at the top with its terms beside it; the foot keeps Decline alone, a ghost danger button */
    const leadOf = (id) => p.cardOf(id).querySelector(".ordlead"), termsOf = (id) => (leadOf(id).querySelector(".ordterms") || { textContent: "" }).textContent;
    const tail = (id) => [...p.cardOf(id).querySelectorAll(".ordend [data-act]")].map((e) => e.getAttribute("data-act")).filter((a) => !/[.]cancel-retained$/.test(a));
    /* 2 Nov 2026 (his Orders canvas, page 2): the lead holds the stage's ONE filled pill; every other move is an action row of its stage part (.ostagerows, .oagainrows), and the card's end is an ember row */
    const leadActs = (id) => [...leadOf(id).querySelectorAll("[data-act]")].filter((e) => !e.hidden).map((e) => e.getAttribute("data-act")).filter((a) => !/[.]cancel-retained$/.test(a));
    const isRow = (e) => !!e && e.matches(".salt-settings__row.salt-settings__row--action") && !e.matches(".salt-ghost, .salt-pill, .btn");
    const pillsOf = (id) => [...p.cardOf(id).querySelectorAll(".salt-pill")].filter((b) => !b.hidden);
    const rowOf = (id) => leadOf(id), rowActs = (id) => leadActs(id);
    const decl = byAct(d, "order.decline", "ord-p1");
    ok(same(moves(), []) && !foot().classList.contains("has") && same(rowActs("ord-p1"), ["order.accept"]) && same(pillsOf("ord-p1").map((b) => b.getAttribute("data-act")), ["order.accept"])
      && isRow(decl) && decl.classList.contains("salt-settings__row--danger") && !decl.closest(".maker-foot") && same(tail("ord-p1"), ["order.decline"]) && decl.parentElement.classList.contains("ordend")
      /* 5 Nov 2026 (the pane): the card ends with its feet (the maker foot, then the pinned foot holding the lead), so the ends' list is the last thing before them, and Decline is never in either */
      && [...p.cardOf("ord-p1").children].filter((x) => !x.matches(".maker-foot, .ofoot")).pop() === decl.parentElement && !decl.closest(".ofoot") && !leadOf("ord-p1").querySelector(".ordterms"),
      "a placed order's Agree is the card's one filled pill and Decline the order its last row, an ember action row, never in a sticky foot, and no terms line restates the band: " + JSON.stringify([moves(), rowActs("ord-p1"), tail("ord-p1")]));
    const terms = p.cardOf("ord-p1").querySelector(".oagreesec > .oagree");
    ok(!byAct(d, "order.terms", "ord-p1") && !p.cardOf("ord-p1").querySelector('details[data-fold="terms"]') && !!terms && !!terms.querySelector('label.salt-settings__row > .salt-settings__label + [data-act="order.total"]'),
      "and the terms are in view, no Change terms and no fold: the goods' price is a settings row of the card, its input at the right");
    const oDec = terms.closest(".odecide");
    /* 5 Nov 2026 (the pane, his answer B): Agree is no longer drawn under the terms but pinned in the card's foot, its last child, so the terms stand under the head and the track and the lead is the foot's */
    ok(leadOf("ord-p1").parentElement === p.cardOf("ord-p1").lastElementChild && leadOf("ord-p1").parentElement.matches(".salt-pane__foot.ofoot") && !!terms.closest(".oagreesec") && !terms.closest(".oagreesec").contains(leadOf("ord-p1"))
      && oDec.previousElementSibling.classList.contains("salt-steps") && p.cardOf("ord-p1").querySelector(".salt-steps").previousElementSibling.classList.contains("ohead") && oDec.nextElementSibling.classList.contains("obill"),
      "and the terms stand under the card's head and its track, Agree under them, ahead of the Bill");
    /* 19 Oct 2026 (his word): the track is the Counter's marked steps, a drawn mark on each of the four, Next on the step to come */
    const trackP1 = p.cardOf("ord-p1").querySelector("ol.salt-steps"), stepsP1 = trackP1 ? [...trackP1.children] : [];
    /* 20 Oct 2026 (canvas V17, V30): his five, Paid fourth */
    ok(!!trackP1 && trackP1.classList.contains("salt-steps--marks") && trackP1.getAttribute("aria-label") === "Where the goods are" && stepsP1.length === 5
      && stepsP1.every((s) => s.querySelector(".salt-steps__mark svg path[d]") && s.querySelector(".salt-steps__name"))
      && JSON.stringify(stepsP1.map((s) => s.querySelector(".salt-steps__name").textContent)) === JSON.stringify(["Placed", "Agreed", "Ready", "Paid", "Collected"])
      && stepsP1[0].classList.contains("salt-steps__step--now") && stepsP1[1].classList.contains("salt-steps__step--next") && /Next/.test(stepsP1[1].querySelector(".salt-steps__time").textContent),
      "the card's track is the marked steps, five with Paid fourth, Placed now and Next on Agreed: " + (trackP1 ? trackP1.className + " | " + trackP1.textContent : "none"));
    ok(!foot().contains(byAct(d, "order.accept")) && leadOf("ord-p1").contains(byAct(d, "order.accept")) && rowOf("ord-p1").firstElementChild === byAct(d, "order.accept") && byAct(d, "order.accept").classList.contains("salt-pill")
      && !!(leadOf("ord-p1").compareDocumentPosition(p.cardOf("ord-p1").querySelector(".oagree")) & 2),
      "Agree is the filled pill first in its lead, under the rows it sends, and not in the foot");
    await p.tapRow("ord-p2");
    ok(same(moves(), []) && same(tail("ord-p2"), ["order.decline"]) && isRow(byAct(d, "order.decline", "ord-p2")) && !byAct(d, "order.accept"),
      "a delivery with no charge chosen has Decline the order as the card's last row and no Agree: " + JSON.stringify([moves(), rowActs("ord-p2"), tail("ord-p2")]));
    const wait = () => leadOf("ord-p2").querySelector("[data-accept-wait]");
    /* 5 Nov 2026 (the pane): the lead is the card's pinned foot, not a part of his decision */
    ok(!!wait() && wait().textContent === "Choose the delivery charge" && !wait().disabled && !!leadOf("ord-p2").closest(".ofoot") && p.cardOf("ord-p2").contains(leadOf("ord-p2")),
      "and the lead says Choose the delivery charge, as a button that sends nothing, never a half-filled Agree: " + (wait() || {}).textContent);
    const fold = (id, k) => p.cardOf(id).querySelector('details[data-fold="' + k + '"]');
    const compP2 = p.cardOf("ord-p2").querySelector('.omsgs form.salt-composer [data-act="order.reply-text"]');
    ok(!fold("ord-p2", "terms") && !fold("ord-p2", "answer") && !!compP2 && !compP2.closest("details"), "the reply's box stands in view with no Answer fold (2 Nov 2026), and the terms are in view, never folded");
    const postsBefore = p.posts.length; wait().click(); await p.work.quiet();
    ok(d.activeElement === byAct(d, "order.fee", "ord-p2") && p.posts.length === postsBefore, "and the stand-in takes him to the charge, and sends nothing");
    const pickFee = async (v) => { const sel = byAct(d, "order.fee", "ord-p2"); sel.value = v; sel.dispatchEvent(new d.defaultView.Event("change", { bubbles: true })); await p.work.quiet(); };
    await pickFee("10");
    ok(same(moves(), []) && rowOf("ord-p2").firstElementChild === byAct(d, "order.accept") && !wait(), "and Agree takes its place at the top once the charge is chosen and the figures are read: " + JSON.stringify(moves()));
    await pickFee("15");
    await pickFee("10");
    await p.tapRow("ord-p4");
    /* 2 Nov 2026: Take back the offer is a row of the stage part (.ostagerows), not of a foot */
    const wd = byAct(d, "order.withdraw-offer", "ord-p4");
    ok(same(moves(), []) && isRow(wd) && !!wd.closest(".ostagerows") && !wd.closest(".maker-foot") && same(tail("ord-p4"), ["order.decline"]) && !byAct(d, "order.accept"),
      "an order with an offer out has Take back the offer as a row of its stage, Decline the order at the card's end, and no Accept: " + JSON.stringify([moves(), tail("ord-p4")]));
    await part("todo");
    await p.tapRow("ord-a1");
    /* 2 Nov 2026: the lead holds the one pill, their way's Ready; the other Ready is a row beside Change the order; their claims are rows of Money received; Cancel the order is the last row */
    const a1rows = [...p.cardOf("ord-a1").querySelectorAll(".ostagerows > [data-act], .oclaims > [data-act]")].map((e) => e.getAttribute("data-act")).filter((a) => /^order\.(ready|claim)/.test(a) && !/cancel-retained$/.test(a));
    ok(same(moves(), []) && same(tail("ord-a1"), ["order.cancel"]) && isRow(byAct(d, "order.cancel", "ord-a1")) && same(leadActs("ord-a1"), ["order.ready-collect"]) && byAct(d, "order.ready-collect").classList.contains("salt-pill")
      && same(a1rows, ["order.ready-deliver", "order.claim-received", "order.claim-not-found", "order.claim-received", "order.claim-not-found"]),
      "an agreed order's one main action, Ready to collect, is the filled pill at the top, Ready to deliver a row beside it, their claim's answer rows of Money received, and Cancel the order its last row: " + JSON.stringify([moves(), leadActs("ord-a1"), a1rows]));
    ok(!foot().contains(byAct(d, "order.received")) && !foot().contains(byAct(d, "order.amend")) && !foot().contains(byAct(d, "order.claim-received")) && !!byAct(d, "order.amend").closest(".ostagerows") && !!byAct(d, "order.claim-received").closest(".oclaims"),
      "while its claims, Received and Amend stay in the body of the card, rows of its parts");
    await p.tapRow("ord-a2");
    /* 2 Nov 2026: Agree again's pill stays in the foot; the stages he rejected, offered again, and Not needed are rows of .oagainrows in his decision */
    const again2 = [...p.cardOf("ord-a2").querySelectorAll(".odecide > .oagainrows > [data-act]")].map((e) => e.getAttribute("data-act")).filter((a) => !/[.]cancel-retained$/.test(a));
    ok(same(moves(), ["order.accept-again"]) && again2.includes("order.again-pay") && again2.includes("order.again-drop-cancel") && again2.includes("order.again-drop-move") && again2.includes("order.again-drop-amend") && !again2.includes("order.again-drop") && !again2.includes("order.again-drop-pay")
      && [...p.cardOf("ord-a2").querySelectorAll(".oagainrows > [data-act]")].filter((e) => !/cancel-retained/.test(e.getAttribute("data-act"))).every(isRow) && tail("ord-a2").includes("order.cancel") && !byAct(d, "order.ready-collect") && foot().classList.contains("has"),
      "an order with a rejected pending row has Accept again first in its foot, which stands along the card, with the stages he rejected offered again as rows of his decision: " + JSON.stringify([moves(), again2]));
    await part("ready");
    await p.tapRow("ord-r1");
    /* 2 Nov 2026: the Handover part holds the units (a settings row, Handed over) and the tiles that make it a close, then the one pill; Cancel the order is the last row */
    const hp = byAct(d, "order.handed-units", "ord-r1").closest(".odecide__part");
    /* 5 Nov 2026 (the pane): Handed over, the one pill, is the card's pinned foot; its units and the tiles stay in the Handover part */
    ok(same(moves(), []) && same(tail("ord-r1"), ["order.cancel"]) && [byAct(d, "order.handed-units"), byAct(d, "order.handed-rest")].every((e) => !!e && hp.contains(e)) && !!byAct(d, "order.handed") && leadOf("ord-r1").contains(byAct(d, "order.handed")) && !!byAct(d, "order.handed").closest(".ofoot")
      && byAct(d, "order.handed-units", "ord-r1").closest("label.salt-settings__row") && !!(byAct(d, "order.handed-units").compareDocumentPosition(byAct(d, "order.handed")) & 4),
      "a ready order's Cancel the order is its last row, and Handed over with its units and the tiles that make it a close stand at the top, the units first: " + JSON.stringify(moves()));
    byAct(d, "order.pay", "ord-r1").click(); await p.work.quiet();
    ok(!!foot().querySelector("[data-maker-say]") && /Choose Bank or Cash first/.test(foot().querySelector("[data-maker-say]").textContent) && foot().lastElementChild === foot().querySelector("[data-maker-say]"),
      "the card's answer lands in its foot, under its moves: " + (foot().querySelector("[data-maker-say]") || {}).textContent);
    /* cash held for the order shuts every control of the card, the foot's too, and Undo opens them again */
    await p.tapRow("ord-r2");
    const cash = byAct(d, "order.pay-amount", "ord-r2"); cash.value = "50"; cash.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    byAct(p.cardOf("ord-r2"), "order.pay-by", "cash").click(); byAct(d, "order.pay", "ord-r2").click(); await p.work.quiet();
    ok(!!byAct(d, "order.cash-undo") && !byAct(d, "order.cash-undo").disabled && [...p.cardOf("ord-r2").querySelectorAll(".ordend button")].every((b) => b.disabled) && p.cardOf("ord-r2").querySelectorAll(".ordend button").length >= 1,
      "while cash is held, every move in the foot is shut and only Undo is live");
    byAct(d, "order.cash-undo").click(); await p.work.quiet();
    ok(!byAct(d, "order.handed").disabled && !byAct(d, "order.cancel").disabled, "and Undo opens them again");
    await part("done");
    await p.tapRow("ord-c1");
    ok(!!foot() && !foot().classList.contains("has") && moves().length === 0, "a closed order has no moves, and its foot does not stand along the card: " + JSON.stringify(moves()));
    /* the foot stands along the card's foot as the card scrolls: the page's, clear of the App bar, and from 860px the card's own */
    const ruleOf = cssRules(p.w);
    const base =ruleOf(".adm .maker-foot.has")[0], wide = ruleOf(".adm #makerReview .maker-foot.has", "(min-width:860px)")[0];
    ok(!!base && base.getPropertyValue("position") === "sticky" && /--salt-bar-h/.test(base.getPropertyValue("bottom")) && !!wide && wide.getPropertyValue("bottom") === "0px",
      "the foot of a card with moves is sticky, clear of the App bar, and from 860px sticks to the card's own foot: " + (base && base.cssText));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 3. THE CARD ASKS ON THE PAGE'S SHEET, NEVER A NATIVE CONFIRM (his decision 4 of 11 Oct 2026) */
  const calls = [];
  const PAID = { "ord-r1": { paid: 40, qty: 3 } };
  p = await richOwnerPage({ pageWork, review: (j) => { for (const o of j.orders) Object.assign(o, PAID[o.id] || {}); return j; } });
  try {
    const d = p.d, w = p.w;
    w.confirm = () => { calls.push("confirm"); return true; };
    w.alert = () => { calls.push("alert"); };
    w.prompt = () => { calls.push("prompt"); return ""; };
    await p.work.quiet();
    const sheetOf = () => d.getElementById("ynSheet");
    const inSheet = (act, key) => (sheetOf() ? byAct(sheetOf(), act, key) : null);
    const tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    const part = async (name) => { byAct(d, "part.orders." + (PART_OF[name] || name)).click(); await p.work.quiet(); };
    const sends = (suffix) => p.posts.filter((x) => x.route.endsWith(suffix));
    const key = (target, k, extra = {}) => { const e = new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...extra }); target.dispatchEvent(e); return e; };
    byAct(d, "nav.orders").click(); await p.work.quiet();

    /* Decline: the sheet restates the order, asks the reason on tiles, and sends only on its one action */
    await tapRow("ord-p1");
    byAct(d, "order.decline", "ord-p1").click(); await p.work.quiet();
    const sh = sheetOf();
    ok(!!sh && sh.getAttribute("role") === "dialog" && sh.getAttribute("aria-modal") === "true" && sh.classList.contains("salt-sheet") && sends("/move").length === 0 && calls.length === 0,
      "Decline opens the page's Sheet, a modal dialog, and sends nothing as it opens, with no native confirm asked");
    ok(/Decline this order/.test(sh.querySelector(".salt-sheet__title").textContent) && /CX1-ZED/.test(sh.textContent) && /2 units/.test(sh.textContent) && /RM 200\.00/.test(sh.textContent) && !!sh.querySelector(".mtile"),
      "the Sheet restates the order, by its code, its mark, its size and its figure: " + sh.textContent);
    const tiles = [...sh.querySelectorAll(".salt-option input[type=radio]")].map((r) => r.getAttribute("data-act"));
    ok(same(tiles, ["order.reason-stock", "order.reason-price"]) && !!inSheet("order.reason", "ord-p1") && !!inSheet("order.ask-go", "ord-p1") && !!inSheet("order.ask-keep", "ord-p1") && !!inSheet("order.ask-close", "ord-p1"),
      "the reason is asked on the system's option tiles, the place line only on an order to be delivered, and the sheet's controls carry their acts: " + JSON.stringify(tiles));
    inSheet("order.reason-stock", "ord-p1").click();
    const reason = inSheet("order.reason", "ord-p1");
    ok(reason.value === "We do not have enough in hand this week." && inSheet("order.reason-stock").checked, "a tile fills the reason with the Desk's line: " + reason.value);
    reason.value = "Sold out until Friday."; reason.dispatchEvent(new w.Event("input", { bubbles: true }));
    ok([...sh.querySelectorAll(".salt-option input[type=radio]")].every((r) => !r.checked), "and typing his own words clears the tile");
    ok(!!sh.querySelector("fieldset.salt-options .salt-options__legend") && sh.querySelector(".salt-sheet__foot").contains(inSheet("order.ask-go")) && inSheet("order.ask-go").classList.contains("salt-ghost--danger"),
      "Decline order is the one danger action, in the Sheet's foot");

    /* Tab stays inside the sheet, across its tiles and its field */
    const focusables = [...sh.querySelectorAll("button, input")].filter((x) => !(x.type === "radio" && !x.checked && [...sh.querySelectorAll("input[type=radio]")].some((r) => r.checked && r.name === x.name)));
    const first = sh.querySelector("#ynX"), last = sh.querySelector("#ynKeep");
    last.focus(); const tabOut = key(last, "Tab");
    ok(tabOut.defaultPrevented && d.activeElement === first, "Tab from the last control wraps to the first");
    first.focus(); const shiftBack = key(first, "Tab", { shiftKey: true });
    ok(shiftBack.defaultPrevented && d.activeElement === last, "Shift+Tab from the first wraps to the last");
    inSheet("order.reason", "ord-p1").focus(); const inner = key(inSheet("order.reason"), "Tab", { shiftKey: true });
    ok(!inner.defaultPrevented, "and Shift+Tab inside the sheet, from its field, is left to the browser, which goes to the tiles: " + focusables.length);

    /* the four ways out send nothing, and focus returns to the control that opened it */
    for (const [name, close] of [["Keep the order", () => inSheet("order.ask-keep").click()], ["the close control", () => inSheet("order.ask-close").click()],
      ["the scrim", () => d.getElementById("ynScrim").click()], ["Escape", () => key(d.body, "Escape")]]) {
      if (!sheetOf()) { byAct(d, "order.decline", "ord-p1").click(); await p.work.quiet(); }
      close(); await p.work.quiet();
      ok(!sheetOf() && sends("/move").length === 0 && d.activeElement === byAct(d, "order.decline", "ord-p1"), name + " closes the sheet, sends nothing, and gives focus back to Decline");
    }
    /* a card redrawn while its sheet is open (a read that changed) takes the control that asked away: focus goes to the one that replaced it */
    byAct(d, "order.decline", "ord-p1").click(); await p.work.quiet();
    const asker = byAct(d, "order.decline", "ord-p1");
    byAct(d, "order.open", "ord-p1").click(); await p.work.quiet();
    const asker2 = byAct(d, "order.decline", "ord-p1");
    inSheet("order.ask-keep").click(); await p.work.quiet();
    ok(!!asker2 && asker2 !== asker && !asker.isConnected && d.activeElement === asker2 && sends("/move").length === 0,
      "a card redrawn while its sheet is open still gets focus back, on the control that replaced the one that asked");
    /* the one action sends the request the confirm let through: the same route and body, under one request id */
    byAct(d, "order.decline", "ord-p1").click(); await p.work.quiet();
    inSheet("order.reason-price").click(); inSheet("order.ask-go").click(); await p.work.quiet();
    const dec = sends("/move");
    ok(dec.length === 1 && dec[0].route === "/all/maker/orders/ord-p1/move" && same(Object.keys(dec[0].body).sort(), ["note", "rid", "status"]) && dec[0].body.status === "declined"
      && dec[0].body.note === "Our prices have changed." && /^[0-9a-f]{32}$/.test(dec[0].body.rid) && !sheetOf(),
      "the one action sends the Decline, the same route and body with the reason picked, and closes the sheet: " + JSON.stringify(dec));
    ok(calls.length === 0, "and no native confirm, alert or prompt was asked on the way");

    /* a delivery's reasons include the place line; no reason sends no note */
    await tapRow("ord-p2");
    byAct(d, "order.decline", "ord-p2").click(); await p.work.quiet();
    ok(same([...sheetOf().querySelectorAll(".salt-option input[type=radio]")].map((r) => r.getAttribute("data-act")), ["order.reason-stock", "order.reason-place", "order.reason-price"]),
      "an order to be delivered is also offered the place line");
    inSheet("order.ask-go").click(); await p.work.quiet();
    ok(sends("/move").length === 2 && same(Object.keys(sends("/move")[1].body).sort(), ["rid", "status"]), "and a Decline with no reason sends none: " + JSON.stringify(sends("/move")[1] && sends("/move")[1].body));

    /* Cancel: what is lost and what becomes of the money is said, and a retry carries the request id it had */
    await part("todo"); await tapRow("ord-a1");
    byAct(d, "order.cancel", "ord-a1").click(); await p.work.quiet();
    ok(/Cancel this order/.test(sheetOf().querySelector(".salt-sheet__title").textContent) && /Nothing is paid on it/.test(sheetOf().textContent) && sends("/move").length === 2,
      "Cancel on an unpaid order says nothing is paid on it, and sends nothing as it opens");
    inSheet("order.ask-keep").click(); await p.work.quiet();
    await part("ready"); await tapRow("ord-r1");
    byAct(d, "order.cancel", "ord-r1").click(); await p.work.quiet();
    ok(/RM 40\.00 is paid on it, so a refund to the customer opens for you to return/.test(sheetOf().textContent), "and on a paid one says what the refund is: " + sheetOf().textContent);
    p.fail.add("/all/maker/orders/ord-r1/move");
    inSheet("order.reason-price").click(); inSheet("order.ask-go").click(); await p.work.quiet();
    p.fail.delete("/all/maker/orders/ord-r1/move");
    byAct(d, "order.cancel", "ord-r1").click(); await p.work.quiet();
    inSheet("order.reason-price").click(); inSheet("order.ask-go").click(); await p.work.quiet();
    const can = sends("/move").filter((x) => x.route.includes("ord-r1"));
    ok(can.length === 2 && can[0].body.status === "cancelled" && can[1].body.rid === can[0].body.rid && can[1].body.status === "cancelled",
      "a Cancel that failed is sent again from the sheet under the request id it had: " + JSON.stringify(can));
    ok(can.every((x) => x.body.note === "Our prices have changed."), "and a Cancel carries the reason picked on its sheet, as a Decline does: " + JSON.stringify(can.map((x) => x.body.note)));

    /* Close at these units (plan 5, 16 Oct 2026: That is all under the units, the one button): the full size offers no close, fewer asks on the sheet */
    await tapRow("ord-r1");
    const units = byAct(d, "order.handed-units", "ord-r1");
    units.value = "3"; units.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    ok(!sheetOf() && d.querySelector("#makerReview fieldset[data-close]").hidden && byAct(d, "order.handed", "ord-r1").textContent === "Handed over, 3 units", "at the full size the close is not offered: its tiles are hidden and the one button is the handover");
    units.value = "2"; units.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    byAct(d, "order.handed-rest", "all").click(); byAct(d, "order.handed", "ord-r1").click(); await p.work.quiet();
    ok(/Finish this order at 2 of 3 units/.test(sheetOf().querySelector(".salt-sheet__title").textContent) && !inSheet("order.ask-go").classList.contains("salt-ghost--danger") && sends("/handed").length === 0,
      "a close asks on the sheet, naming the units, and sends nothing as it opens");
    inSheet("order.ask-go").click(); await p.work.quiet();
    const closed = sends("/handed");
    ok(closed.length === 1 && closed[0].route === "/all/maker/orders/ord-r1/handed" && closed[0].body.qty === 2 && closed[0].body.close === true && /^[0-9a-f]{32}$/.test(closed[0].body.rid),
      "and sends the close it sent, the same route and body: " + JSON.stringify(closed));

    /* Offer again: a stage he rejected, asked on the sheet, sent under a request id */
    await part("todo"); await tapRow("ord-x1");
    byAct(d, "order.again-pay", "ord-x1").click(); await p.work.quiet();
    ok(/Send the payment again/.test(sheetOf().querySelector(".salt-sheet__title").textContent) && sends("/again").length === 0 && !inSheet("order.ask-go").classList.contains("salt-ghost--danger"),
      "offering a stage again asks on the sheet and sends nothing as it opens");
    inSheet("order.ask-go").click(); await p.work.quiet();
    const again = sends("/again");
    ok(again.length === 1 && again[0].route === "/all/maker/orders/ord-x1/again" && again[0].body.stage === "pay" && /^[0-9a-f]{32}$/.test(again[0].body.rid),
      "and sends the offer, the same route and body: " + JSON.stringify(again));

    /* the money taps are guarded once, as they were: no sheet */
    await part("ready"); await tapRow("ord-r1");
    const before = sends("/handed").length;
    byAct(d, "order.handed", "ord-r1").click(); await p.work.quiet();
    ok(sends("/handed").length === before + 1 && !sheetOf(), "Record handover sends at once, with no sheet: it is a money tap guarded once, as it was");
    ok(calls.length === 0, "and no native confirm, alert or prompt was asked on any order card: " + JSON.stringify(calls));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 4. THE TICK IS A 44px TARGET (his rule 6: a tap target is 44px in both dimensions, measured on the control, which is what a hit test reads) */
  p = await richOwnerPage({ pageWork });
  try {
    const d = p.d;
    await p.work.quiet();
    byAct(d, "nav.customers").click(); await p.work.quiet();
    byAct(d, "part.customers.accounts").click(); await p.work.quiet();
    byAct(d, "acct.open", "4567-89ab").click(); await p.work.quiet();
    const sent = byAct(d.getElementById("aopen"), "acct.sent");
    const ruleOf = cssRules(p.w), prop = (r, name) => (r ? r.getPropertyValue(name) : "");
    /* 2 Nov 2026 (his Orders canvas, page 2): Mark as sent is a row of the account's Sign-in list, the whole row its button, the system's 56px row (over the 44px target) */
    const rowRule = ruleOf(".salt-settings__row")[0];
    ok(!!sent && sent.tagName === "BUTTON" && sent.textContent === "Mark as sent" && !sent.hidden && sent.matches(".salt-settings__row.salt-settings__row--action") && !sent.matches(".salt-ghost, .salt-pill") && !sent.closest("label.tick")
      && !d.querySelector("#aopen input[type=checkbox]") && !!rowRule && parseFloat(prop(rowRule, "min-height")) >= 44 && sent.parentElement.classList.contains("salt-settings"),
      "Sent is no checkbox: Mark as sent is an action row of at least 44px while it is not sent: " + (sent && sent.outerHTML));
    /* v1377: the tick rules styled only Order for them's own box, gone with it */
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 5. THE HEAD IS PROGRESS AND MONEY RECEIVED IS ONE BLOCK (15 Oct 2026): an agreed order's head reads Owed, Paid, Handed and Says sent; Money received holds the
     claims, Bank and Cash in that order with the reply and their last line below it; each road names itself on its button once a figure is typed; cash held shuts the reply */
  const patch = { "ord-r1": { paid: 40, moved: 0.5, claimed: 20, msgs: [{ by: "customer", at: "2026-10-10T08:00:00.000Z", text: "Can you come after five?" }] } };
  p = await richOwnerPage({ pageWork, review: (j) => { for (const o of j.orders) Object.assign(o, patch[o.id] || {}); return j; } });
  try {
    const d = p.d, w = p.w;
    await p.work.quiet();
    const tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    const part = async (name) => { byAct(d, "part.orders." + (PART_OF[name] || name)).click(); await p.work.quiet(); };
    const cardOf = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    const before = (a, b) => !!a && !!b && !!(a.compareDocumentPosition(b) & w.Node.DOCUMENT_POSITION_FOLLOWING);
    const typed = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("input", { bubbles: true })); };
    /* 18 Oct 2026: the head's money is the customer's lines, a label and its figure a row */
    /* 2 Nov 2026 (his Orders canvas, page 2): the Bill is a settings list, a row a label (its second line apart) and its figure at the right; Money received's head is an h2 */
    const head = (id) => [...cardOf(id).querySelectorAll(".ordmoney > .salt-settings__row")].map((l) => [l.querySelector(".salt-settings__label"), l.querySelector(".salt-settings__value")].map((c) => (c ? c.textContent : "")).join(" ")).join(" ");
    const money = (c) => c.querySelector('h2.salt-settings__head[data-sect="money"]');
    byAct(d, "nav.orders").click(); await p.work.quiet();
    await tapRow("ord-p1");
    ok(/^Goods RM 200\.00 Total RM 200\.00$/.test(head("ord-p1")) && /At the list price/.test(cardOf("ord-p1").querySelector(".ordmoney .ocost").textContent) && !/Owed/.test(head("ord-p1")) && !cardOf("ord-p1").querySelector(".rdet"),
      "a placed order's Bill is Goods at the list price and the Total, with no figure owed: " + head("ord-p1"));
    await part("todo"); await tapRow("ord-r1");
    const r1 = cardOf("ord-r1");
    ok(/Owed RM 60\.00/.test(head("ord-r1")) && /Paid RM 40\.00/.test(head("ord-r1")) && /Handed 0\.5 of 1/.test(head("ord-r1")) && /Says sent RM 20\.00/.test(head("ord-r1")) && /^Goods RM 100\.00 /.test(head("ord-r1")),
      "a ready order's head is its goods, what is paid, what they say they sent, what it owes and what is handed over: " + head("ord-r1"));
    ok(!r1.querySelector(".rdet") && r1.querySelectorAll(".salt-steps__step--done").length === 2 && /Ready/.test(r1.querySelector(".salt-steps__step--now").textContent),
      "so no Details repeats them, and the track stands at Ready, Paid not yet done while something is owed");
    await part("open"); await tapRow("ord-r2");
    ok(!/Says sent/.test(head("ord-r2")) && /Owed RM 100\.00/.test(head("ord-r2")) && /Handed 0 of 1/.test(head("ord-r2")), "an order with no claim says none: " + head("ord-r2"));
    /* plan 5 (16 Oct 2026): Bank and Cash are two tiles over one amount; the one button says the figure and the road (test/admin-card5.mjs proves the rest) */
    const r2 = cardOf("ord-r2"), cashIn = byAct(r2, "order.pay-amount");
    ok(!!money(r2) && before(money(r2), cashIn) && before(cashIn, byAct(r2, "order.pay-by", "bank")) && before(byAct(r2, "order.pay-by", "bank"), byAct(r2, "order.pay-by", "cash")) && before(byAct(r2, "order.pay"), byAct(r2, "order.reply-text")),
      "a ready order's Money received holds the amount, then Bank and Cash, and the reply stands below them");
    ok(byAct(r2, "order.pay").textContent === "Record payment", "the button says Record payment with no figure typed");
    typed(cashIn, "50"); byAct(r2, "order.pay-by", "cash").click();
    ok(byAct(r2, "order.pay").textContent === "Record RM 50.00, cash", "and the figure and the road once both are there: " + byAct(r2, "order.pay").textContent);
    typed(cashIn, "");
    ok(byAct(r2, "order.pay").textContent === "Record payment", "a figure cleared takes the figure off the button");
    /* 2 Nov 2026: their last line is a bubble of the Messages thread (theirs on the left), no longer a facts line above the Answer fold */
    ok(!r2.querySelector(".omsgs .salt-bubble--theirs"), "an order with no message of theirs draws no line of theirs");
    const said = r1.querySelector(".omsgs .salt-bubble--theirs");
    ok(!!said && /Can you come after five\?/.test(said.textContent) && before(byAct(r1, "order.pay-amount"), said) && before(said, byAct(r1, "order.reply-text")),
      "their last line stands above the reply, below the money: " + (said && said.textContent));
    typed(cashIn, "50");
    byAct(r2, "order.pay").click(); await p.work.quiet();
    const held = cardOf("ord-r2"), live = [...held.querySelectorAll("button,input,select")].filter((n) => !n.disabled).map((n) => n.getAttribute("data-act") || n.tagName);
    ok(!!byAct(held, "order.cash-undo") && same(live, ["order.cash-undo"]),
      "cash held shuts the reply and every other control of the card, and only Undo is live: " + JSON.stringify(live));
    byAct(d, "order.cash-undo").click(); await p.work.quiet();
    await part("todo"); await tapRow("ord-a1");
    const a1 = cardOf("ord-a1");
    ok(!byAct(a1, "order.pay-by", "cash") && !!byAct(a1, "order.claim-received") && before(money(a1), byAct(a1, "order.claim-received")) && !!byAct(a1, "order.claim-received").closest(".oclaims") && before(byAct(a1, "order.claim-received"), byAct(a1, "order.pay-amount")) && before(byAct(a1, "order.pay"), byAct(a1, "order.reply-text")),
      "an agreed order's Money received answers their claim in rows under its head, then holds Bank and no cash, with the reply below (2 Nov 2026: the claim rows are of the part, no longer above it)");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
