/* test/admin-approve-queue.mjs: THE ROWS TO APPROVE, THE QUEUE, AND NO NATIVE CONFIRM (Phase 2c of the Salt Admin redesign, 12 Oct 2026; docs/STATEMENTS.md "The rows to approve").
 *
 * A Desk row waiting for him is a card on Orders > Approve (and a pill on Needs you). His decisions of 11 Oct 2026 shape it: 4, a Sheet replaces every native confirm, and the phone leads a
 * draft with the cost and margin read off the draft and computes nothing, its flags frozen at drafting. What is proved here, each check red under its own mutation
 * (test/admin-approve-queue.mutations.json):
 *   1  the row to approve wears the system's Approve recipe: its markup carries the recipe's classes, the page restates none of the recipe's rules, the figures lead the flags, the flags are chips,
 *      Approve is the one filled pill and Reject the danger ghost, and a trip's rows stand in one card
 *   2  the queue is the system's Plan fold, shut, titled and counted, opened by a tap, and left as he set it by a redraw
 *   3  Approve, Reject, the trip's Approve, the Needs you pill, Withdraw server-held entry, Close the group order and Set and Clear the notice each ask on the page's Sheet: nothing is sent as it
 *      opens, the four ways out send nothing and give focus back, the one action sends the request the confirm let through (the same route and body), and a second tap sends nothing
 *   4  no native confirm is left in the owner's script, and none is asked on any road above
 *   5  a lapse takes a Sheet left open down with the page
 * The twin at entry, the retained cancels, the chat retry and the vault conflict are driven through the same Sheet in their own sections (test/maker-gift-twin.mjs, maker-loan-twin.mjs, maker-trades.mjs,
 * maker-communications.mjs, maker-input-receipts.mjs and the admin section of test/verify.mjs). Drawn by the maker harness (test/maker-act.mjs). */
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";

const U = "abcd-efgh";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;
const route = (verb, id) => "/all/maker/drafts/" + id + "/" + verb;
const MANY = "/all/maker/drafts/decide-many";

/* the page's own stylesheet as rules, the recipes carried ahead of it cut away */
function pageRules() {
  const html = landingPage("", "approve-nonce", { master: "fixture-master", accounts: [] });
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
  const out = [];
  const walk = (rules) => { for (const r of rules) { if (r.selectorText) out.push([r.selectorText, r.style]); if (r.cssRules) walk(r.cssRules); } };
  walk(sheet.cssRules);
  return out;
}

export async function run({ ok, pageWork }) {
  const holder = {};
  /* a row decided leaves the review's answer, as the Desk would have it */
  /* 22 Oct 2026: a card is decided by Confirm, one decide-many request; the Desk's answer names each draft decided or refused (holder.refuse[id] = the fix) */
  const sentIds = () => ((holder.p && holder.p.posts) || []).filter((q) => q.route === MANY).flatMap((q) => [...q.body.approve, ...q.body.reject]);
  const decided = (j) => ({ ...j, drafts: j.drafts.filter((x) => !sentIds().includes(x.id) || (holder.refuse || {})[x.id]) });
  const manyAnswer = (path, body) => {
    if (path !== MANY || !body) return undefined;
    const refuse = holder.refuse || {};
    const mk = (id, decision) => refuse[id] ? { id, decision, error: "The Desk would not do it for " + id, fix: refuse[id] } : null;
    return { ok: true, decided: [...body.approve.map((id) => [id, "approved"]), ...body.reject.map((id) => [id, "rejected"])].filter(([id]) => !refuse[id]).map(([id, decision]) => ({ id, decision })),
      refused: [...body.approve.map((id) => mk(id, "approve")), ...body.reject.map((id) => mk(id, "reject"))].filter(Boolean) };
  };
  const open = async (extra = {}) => {
    const { review: more, ...rest } = extra;
    holder.refuse = {};
    holder.p = null;   /* the page before this one has posts of its own, which the new page's first reads must not see */
    const p = await richOwnerPage({ pageWork, review: (j) => decided(more ? more(j) : j), extra: manyAnswer, ...rest });
    holder.p = p;
    await p.work.quiet();
    const d = p.d, w = p.w;
    p.confirms = [];
    w.confirm = (m) => { p.confirms.push(String(m)); return true; };
    p.tap = async (act, key) => { const e = byAct(d, act, key); if (e) e.click(); await p.work.quiet(); return !!e; };
    p.row = (id) => d.querySelector('#makerDrafts [data-maker-card="draft:' + id + '"]');
    p.sheet = () => d.getElementById("ynSheet");
    p.inSheet = (act, key) => (p.sheet() ? byAct(p.sheet(), act, key) : null);
    p.key = (target, k) => { const e = new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); target.dispatchEvent(e); return e; };
    p.posted = (path) => p.posts.filter((x) => x.route === path);
    p.title = () => (p.sheet() ? p.sheet().querySelector(".salt-sheet__title").textContent : "");
    /* the four ways out of a Sheet that send nothing: each is tried on a Sheet opened afresh, and focus is read going back to what asked */
    p.ways = async (reopen, asker, sent) => {
      const bad = [];
      for (const [name, close] of [["the ghost", () => p.inSheet("ask.keep").click()], ["the close control", () => p.inSheet("ask.close").click()],
        ["the scrim", () => d.getElementById("ynScrim").click()], ["Escape", () => p.key(d.body, "Escape")]]) {
        if (!p.sheet()) { reopen(); await p.work.quiet(); }
        close(); await p.work.quiet();
        if (p.sheet() || sent() !== 0 || d.activeElement !== asker()) bad.push(name + J([!!p.sheet(), sent(), d.activeElement && d.activeElement.getAttribute("data-act")]));
      }
      return bad;
    };
    return p;
  };
  const enterRecord = async (p) => { await p.tap("nav.orders"); await p.tap("part.orders.approve"); };

  /* 1. THE ROW TO APPROVE IS THE SYSTEM'S APPROVE CARD (since plan 2 of 16 Oct 2026 it says the change; test/admin-approve-card.mjs proves what it says) */
  let p = await open({ review: (j) => { j.drafts[0].reasoning = "Priced under their usual."; return j; } });
  try {
    const d = p.d;
    await enterRecord(p);
    const c = p.row("d-1");
    ok(!!c && c.tagName === "ARTICLE" && c.classList.contains("salt-approve") && c.classList.contains("maker-card") && !c.classList.contains("salt-glass-card")
      && [...d.querySelectorAll("#makerDrafts [data-maker-card]")].every((x) => x.classList.contains("salt-approve")),
    "each Desk row to approve is an article on the system's Approve recipe (salt-approve), beside the page's own card class and in place of the glass card");
    const head = c.querySelector(":scope > .salt-approve__head");
    const partyText = head && head.querySelector(".salt-approve__party").cloneNode(true);
    if (partyText) partyText.querySelectorAll(".pwith").forEach((x) => x.replaceWith("[mark]"));
    ok(!!head && partyText.textContent === "CX1-ZED · [mark]" && !head.querySelector(".salt-approve__entry") && c.querySelector(".rdet--row .salt-approve__entry").textContent === "from phone, 10 Oct 2026",
      "its head is the recipe's: the party's code and the book's mark, and where the entry came from and when sits in Details: " + (head && head.textContent));
    /* 12 Oct 2026 (Phase 5): a new row's cost and margin are the system's Metric row, a label over its figure, and not a line of the card's own */
    const facts = [...c.querySelectorAll(":scope > .maker-facts")], reason = c.querySelector(".salt-approve__reason");
    const figures = c.querySelector(":scope > .salt-metrics.salt-metrics--sm"), cells = figures ? [...figures.children].map((x) => [x.querySelector(".salt-metrics__label").textContent, x.querySelector(".salt-metrics__value").textContent]) : [];
    ok(!!figures && JSON.stringify(cells) === JSON.stringify([["Cost", "RM 56.00"], ["Your margin", "RM 44.00 · 44%"]]) && figures.textContent.replace(/\s+/g, " ") === "Cost RM 56.00 Your margin RM 44.00 · 44%" && /RM 100\.00/.test(facts[0].textContent) && !facts.some((x) => /Cost RM/.test(x.textContent)),
      "a new row's figures lead, read off the draft and computed nowhere: the row's total, then its cost and margin as the system's Metric row: " + facts.map((x) => x.textContent).join(" | ") + " / " + JSON.stringify(cells));
    const panel = c.querySelector(":scope > .rdet--row");
    ok(!c.querySelector(":scope > .salt-approve__flags") && !!panel && panel.hidden && panel.contains(reason) && reason.textContent === "Priced under their usual."
      && [...panel.querySelectorAll(".apnote")].map((x) => x.textContent).join("|") === "Check before deciding",
    "a flag that asks no decision is no chip on the card: it and the drafter's note stand in Details, shut");
    /* Details is its own control at the card's foot; the head is no longer a control, and a tap on the card opens nothing */
    const more = byAct(c, "row.proposed"), gone = p.posts.length;
    ok(!!more && more.tagName === "BUTTON" && more.textContent === "Details" && more.getAttribute("aria-expanded") === "false" && head.tagName !== "BUTTON",
      "Details is a button with its act, shut, and the head is not a control");
    c.querySelector(".apverb").click(); await p.work.quiet();
    const afterBody = panel.hidden;
    more.click(); await p.work.quiet();
    const afterMore = !panel.hidden && more.getAttribute("aria-expanded") === "true" && /Reference/.test(panel.textContent);
    more.click(); await p.work.quiet();
    ok(afterBody && afterMore && panel.hidden && p.posts.length === gone, "a tap on the card opens nothing, Details opens the row's detail and a second tap shuts it, and nothing is sent: " + [afterBody, afterMore]);
    const cells2 = [...d.querySelectorAll("#makerDrafts .apfigs")];
    ok(cells2.length >= 2 && cells2.every((f) => f.classList.contains("salt-metrics")), "every new row's cost and margin stand in one figures row of their own class, so the page can align them as columns");
    const acts = c.querySelector(":scope > .salt-approve__actions"), approve = byAct(c, "draft.approve"), reject = byAct(c, "draft.reject");
    ok(!!acts && acts.contains(approve) && acts.contains(reject) && head.contains(more) && !acts.contains(more) && approve.textContent === "Approve the sale" && reject.textContent === "Reject"
      && [...acts.children][0] === approve && approve.getAttribute("aria-pressed") === "false" && reject.getAttribute("aria-pressed") === "false" && !approve.classList.contains("salt-pill"),
    "its two choices stand in the recipe's actions, Approve first and Reject, neither chosen to begin with, and Details has moved up into the head: " + (acts && acts.textContent));
    ok(!approve.disabled && !reject.disabled, "and neither is shut on a row that is not a claim's");
    /* 22 Oct 2026: a tap CHOOSES; nothing opens and nothing is sent */
    const bar0 = d.getElementById("apBar"), sentNone = () => p.posts.filter((x) => /\/drafts\//.test(x.route)).length === 0;
    ok(bar0.hidden, "the bar is hidden until a card is chosen");
    approve.click(); await p.work.quiet();
    const ca = p.row("d-1"), pa = byAct(ca, "draft.approve");
    ok(pa.getAttribute("aria-pressed") === "true" && pa.classList.contains("salt-pill") && ca.classList.contains("ap--a") && byAct(ca, "draft.reject").getAttribute("aria-pressed") === "false"
      && !bar0.hidden && bar0.querySelector(".apbar__line").textContent === "1 approve" && !p.sheet() && sentNone() && p.confirms.length === 0,
    "a tap on Approve chooses it: pressed, the filled pill, the card lit, the bar says 1 approve, no Sheet opens and nothing is sent: " + bar0.textContent);
    byAct(ca, "draft.reject").click(); await p.work.quiet();
    const cr = p.row("d-1");
    ok(byAct(cr, "draft.reject").getAttribute("aria-pressed") === "true" && byAct(cr, "draft.approve").getAttribute("aria-pressed") === "false" && cr.classList.contains("ap--r") && !cr.classList.contains("ap--a")
      && bar0.querySelector(".apbar__line").textContent === "1 reject" && sentNone(),
    "Reject swaps the choice, a card being one or the other: " + bar0.textContent);
    byAct(cr, "draft.reject").click(); await p.work.quiet();
    ok(byAct(p.row("d-1"), "draft.reject").getAttribute("aria-pressed") === "false" && !p.row("d-1").classList.contains("ap--r") && bar0.hidden, "a second tap on the same choice clears it, and the bar goes");
    const t2 = p.row("d-2"), t3 = p.row("d-3");
    ok(!t3 && [...d.querySelectorAll("#makerDrafts [data-maker-card]")].filter((x) => /one trip/.test(x.textContent)).length === 1 && t2.querySelectorAll(".rdet--row h4").length === 2, "a trip is drawn once, in one card holding both its rows, and never again for its other row: " + d.querySelectorAll("#makerDrafts [data-maker-card]").length);
    ok(!!t2 && /Two books, one trip\. Approve decides both\./.test(t2.textContent) && byAct(t2, "draft.approve").textContent === "Approve both" && byAct(t2, "draft.reject").textContent === "Reject both"
      && t2.querySelectorAll("[data-act='draft.approve']").length === 1,
    "a trip's rows stand in one card with one Approve and one Reject: " + (t2 && t2.textContent.slice(0, 140)));
    /* a row's book is the system's Product tag holding the book's mark, and no word for it: "1 unit [tag], RM 100.00", the tag told to a reader by its shape */
    const factsOf = (card) => [...card.querySelectorAll(".maker-facts")].map((f) => { const g = f.cloneNode(true); g.querySelectorAll(".salt-producttag").forEach((x) => x.replaceWith("[tag]")); return g.textContent; });
    const tagsOf = (card) => [...card.querySelectorAll(".maker-facts .salt-producttag")].map((x) => [!!x.querySelector("svg.psym"), (x.querySelector(".sr") || { textContent: "" }).textContent]);
    ok(factsOf(t2).includes("1 unit [tag], RM 100.00") && tagsOf(t2).length === 2 && tagsOf(t2).every(([mark, said]) => mark && /^(Cube|Droplet|Lozenge|Capsule|Ring)$/.test(said)) && new Set(tagsOf(t2).map((x) => x[1])).size === 2,
      "a trip's two rows each say 1 unit then their book's Product tag, a mark told to a reader by its shape, and no word for the book: " + JSON.stringify([factsOf(t2), tagsOf(t2)]));
    /* the page's own rules for the recipe's classes restate none of what the recipe draws: no surface, edge, padding, shadow, gap or type */
    const taken = ["background", "background-color", "border", "border-radius", "padding", "box-shadow", "display", "flex-direction", "gap", "font-family", "font-size", "color", "margin"];
    const mine = pageRules().filter(([sel]) => /salt-approve/.test(sel.replace(/:not\([^)]*\)/g, "")));   /* a rule that names it only to leave it out is not a rule for it */
    const restated = mine.flatMap(([sel, style]) => taken.filter((k) => style.getPropertyValue(k) !== "" && !(k === "display" && style.getPropertyValue(k) === "none")).map((k) => sel + " " + k));
    ok(SITE_RECIPES.includes(".salt-approve {") && SITE_RECIPES.includes(".salt-approve__head") && restated.length === 0,
      "the page carries the recipe whole and restates none of it: its own rules naming it (" + mine.map((r) => r[0]).join(", ") + ") set " + (restated.length ? restated.join(", ") : "no property the recipe sets"));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  /* 18 Oct 2026 (clarity part 4): every status line has a verb and says what to do; where no verb can be built the reason's own words follow Not taken: */
  const WHYS = [["a movement with no date", "Not taken: add the date"], ["the date is not a date in YYYY-MM-DD: 5/10", "Not taken: fix the date"], ["a loss needs a reason. Without one it is shrinkage", "Not taken: add the reason"],
    ["a count needs a quantity", "Not taken: add the amount"], ["no OPEN order on the book matches X", "Not taken: check the order"], ["the entry carries no payload the desk can read", "Not taken: the entry carries no payload the desk can read"]];
  p = await open({ review: (j) => ({ ...j, refused: WHYS.map(([why]) => ({ why })) }) });
  try {
    await enterRecord(p);
    const lines = [...p.d.querySelectorAll("#makerDrafts p.salt-insight")].map((x) => x.textContent).filter((x) => /^Not taken/.test(x));
    ok(J(lines) === J(WHYS.map((x) => x[1])) && !/Entry not taken/.test(p.d.getElementById("makerDrafts").textContent),
      "a refused entry says Not taken and what to do, from its reason, or the reason's own words: " + J(lines));
    ok(!/Sent, not yet drafted/.test(p.d.getElementById("makerQueue").textContent) && /sent, waiting for the drafter/.test(p.d.getElementById("makerQueue").textContent) && !/Entry the Desk refused/.test(p.d.getElementById("makerQueueReview").textContent),
      "and the queue reads 2 sent, waiting for the drafter, and a refused entry that the Desk refused it");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 2. THE QUEUE IS A FOLD, SHUT, TITLED AND COUNTED */
  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    const fold = d.getElementById("makerQueue"), sum = fold && fold.querySelector(":scope > summary"), count = d.getElementById("makerQueueCount"), body = d.getElementById("makerQueueReview");
    ok(!!fold && fold.tagName === "DETAILS" && fold.classList.contains("salt-plan") && fold.open === false && !!sum && sum.getAttribute("data-act") === "record.queue-toggle",
      "the server-held queue is the system's Plan fold, shut until he taps it, its summary a control with its own act");
    ok(!!count && count.classList.contains("salt-plan__id") && count.textContent === "2" && d.getElementById("makerQueueTitle").textContent === "sent, waiting for the drafter"
      && sum.contains(count) && sum.contains(d.getElementById("makerQueueTitle")) && !!body && fold.contains(body),
    "it is titled and counted, though shut, the count read off the entries the server holds: " + (sum && sum.textContent));
    ok(byAct(body, "queue.withdraw", "q-1") && byAct(body, "queue.withdraw", "q-2") && fold.open === false,
      "and its two entries are drawn inside it, so a shut fold hides them from the eye and reads nothing away");
    sum.click(); await p.work.quiet();
    ok(fold.open === true, "a tap on its summary opens it");
    await p.tap("nav.record"); await p.tap("nav.orders"); await p.tap("part.orders.approve");
    ok(d.getElementById("makerQueue") === fold && fold.open === true && !!byAct(d.getElementById("makerQueueReview"), "queue.withdraw", "q-1"),
      "and a redraw of the entries leaves it open: it is the fold, not the entries, that he set");
    sum.click(); await p.work.quiet();
    ok(fold.open === false, "the next tap shuts it again");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  const cut = (j) => ({ ...j, queue: [] });
  p = await open({ review: cut });
  try {
    await enterRecord(p);
    ok(p.d.getElementById("makerQueueCount").textContent === "0" && /Nothing is waiting for the Desk/.test(p.d.getElementById("makerQueueReview").textContent) && p.d.getElementById("makerQueue").open === false,
      "with nothing held the fold is counted 0, says so inside, and stays shut");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  /* 14 Oct 2026 (his screenshot): a device's copy of an entry already committed or approved is not waiting, so it is not listed */
  const settled = (j) => ({ ...j, queue: (j.queue || []).map((e, i) => i === 0 ? { ...e, state: "committed", canWithdraw: false } : i === 1 ? { ...e, state: "approved", canWithdraw: false } : e) });
  p = await open({ review: settled });
  try {
    await enterRecord(p);
    ok(p.d.getElementById("makerQueueCount").textContent === "0" && /Nothing is waiting for the Desk/.test(p.d.getElementById("makerQueueReview").textContent),
      "a held copy of an entry already committed or approved is not counted or listed as waiting for the Desk: " + p.d.getElementById("makerQueueReview").textContent.slice(0, 120));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 3. CONFIRM ASKS ON THE SHEET (22 Oct 2026: Approve and Reject only choose; the bar's Confirm asks once for every chosen card and sends one decide-many) */
  const pickRow = (p, id, act) => byAct(p.row(id), act);
  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    const bar = () => d.getElementById("apBar"), confirm = () => byAct(bar(), "approve.confirm"), many = () => p.posted(MANY), oldRoads = () => p.posts.filter((x) => /\/drafts\/(?!decide-many)/.test(x.route)).length;
    pickRow(p, "d-1", "draft.approve").click(); await p.work.quiet();
    confirm().click(); await p.work.quiet();
    const sh = p.sheet();
    ok(!!sh && sh.getAttribute("role") === "dialog" && sh.getAttribute("aria-modal") === "true" && sh.classList.contains("salt-sheet") && many().length === 0 && p.confirms.length === 0,
      "Confirm opens the page's Sheet, a modal dialog, and sends nothing as it opens, with no native confirm asked");
    ok(p.title() === "Decide 1 card?" && /1 to approve/.test(sh.textContent) && !/to reject/.test(sh.textContent) && /CX1-ZED/.test(sh.textContent) && /RM 100\.00/.test(sh.textContent) && /New sale, 1 unit/.test(sh.textContent)
      && /Each is decided as drafted\. One that cannot go stays here with why and how to fix it; the rest go\./.test(sh.textContent) && sh.querySelectorAll(".salt-ledger__row").length === 1,
    "the Sheet is titled for the cards, lists those to approve by code, size, kind and figure, and says each is decided as drafted: " + sh.textContent);
    ok(!!p.inSheet("ask.go", "approve:confirm") && !!p.inSheet("ask.keep", "approve:confirm") && !!p.inSheet("ask.close", "approve:confirm") && !p.inSheet("ask.go").classList.contains("salt-ghost--danger")
      && sh.querySelector(".salt-sheet__foot").contains(p.inSheet("ask.go")) && p.inSheet("ask.go").textContent === "Confirm 1" && p.inSheet("ask.keep").textContent === "Not yet",
    "its controls carry their acts and the Confirm key, the action reads Confirm 1 and the way out Not yet");
    const bad = await p.ways(() => confirm().click(), confirm, () => many().length);
    ok(bad.length === 0 && !bar().hidden, "the ghost, the close control, the scrim and Escape each close it, send nothing, give focus back to Confirm and leave the choice standing: " + bad.join(" | "));
    /* a redraw behind the Sheet takes the control that asked: focus goes to the one drawn in its place, found by what it asks (its data-yn) */
    const old = confirm();
    old.click(); await p.work.quiet();
    byAct(d, "maker.refresh").click(); await p.work.quiet();
    const fresh = confirm();
    ok(!!p.sheet() && !!fresh && fresh !== old && !old.isConnected && fresh.getAttribute("data-yn") === "approve:confirm", "the list is read again while the Sheet is up and Confirm is a new control");
    p.inSheet("ask.keep").click(); await p.work.quiet();
    ok(!p.sheet() && d.activeElement === fresh && many().length === 0, "and a no gives focus to the control drawn in its place, sending nothing");
    confirm().click(); await p.work.quiet();
    const go = p.inSheet("ask.go");
    go.click(); await p.work.quiet();
    go.click(); await p.work.quiet();
    ok(many().length === 1 && same(many()[0].body, { approve: ["d-1"], reject: [] }) && !p.sheet() && oldRoads() === 0,
      "the one action sends ONE decide-many with the card's draft in approve, and a second tap on it sends nothing; no card road is used: " + J(many()));
    const done = d.querySelector("#makerDrafts .apdone");
    ok(!p.row("d-1") && !!done && /^1 decided/.test(done.textContent) && /1 approved\. They fold together, one version\./.test(done.textContent) && !done.textContent.includes("refused") && bar().hidden,
      "the card leaves the list, the status card heads it, and the bar goes: " + (done && done.textContent));

    /* a trip: one card, one choice, every row of it in the one request */
    pickRow(p, "d-2", "draft.approve").click(); await p.work.quiet();
    ok(pickRow(p, "d-2", "draft.approve").textContent === "Approve both" && byAct(p.row("d-2"), "draft.reject").textContent === "Reject both", "a trip's choices keep their words, Approve both and Reject both");
    confirm().click(); await p.work.quiet();
    ok(p.title() === "Decide 1 card?" && p.sheet().querySelectorAll(".salt-ledger__row").length === 2 && (p.sheet().textContent.match(/RM 100\.00/g) || []).length === 2 && many().length === 1,
      "a trip is one card to decide and the Sheet lists every row it decides: " + p.sheet().textContent);
    p.inSheet("ask.go").click(); await p.work.quiet();
    ok(many().length === 2 && same(many()[1].body, { approve: ["d-2", "d-3"], reject: [] }), "and the one request carries every row of the trip: " + J(many()[1]));
    ok(p.confirms.length === 0 && oldRoads() === 0, "and no native confirm was asked on the way");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    const bar = () => d.getElementById("apBar"), confirm = () => byAct(bar(), "approve.confirm"), many = () => p.posted(MANY);
    pickRow(p, "d-1", "draft.reject").click(); await p.work.quiet();
    confirm().click(); await p.work.quiet();
    ok(p.title() === "Decide 1 card?" && /1 to reject/.test(p.sheet().textContent) && !/to approve/.test(p.sheet().textContent) && /CX1-ZED/.test(p.sheet().textContent) && p.inSheet("ask.go").textContent === "Confirm 1" && many().length === 0,
      "a rejected card is listed under 1 to reject, and nothing is sent as the Sheet opens: " + (p.sheet() && p.sheet().textContent));
    p.inSheet("ask.go").click(); await p.work.quiet();
    ok(many().length === 1 && same(many()[0].body, { approve: [], reject: ["d-1"] }) && !p.sheet() && !p.row("d-1") && /1 rejected\./.test(d.querySelector("#makerDrafts .apdone").textContent)
      && !/fold together/.test(d.querySelector("#makerDrafts .apdone").textContent),
    "its yes sends the card in reject, and the status says 1 rejected with no fold promised: " + J(many()));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* the head of the list: Approve all, Clear, a mixed Confirm, and a refusal left on its card with why and how to fix it */
  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    const bar = () => d.getElementById("apBar"), confirm = () => byAct(bar(), "approve.confirm"), many = () => p.posted(MANY), head = () => d.querySelector("#makerDrafts > .aphead");
    ok(!!head() && /^2 to decide/.test(head().textContent) && !!byAct(head(), "approve.all"), "the list heads with how many cards wait and Approve all: " + (head() && head().textContent));
    byAct(head(), "approve.all").click(); await p.work.quiet();
    ok(bar().querySelector(".apbar__line").textContent === "2 approve" && ["d-1", "d-2"].every((id) => p.row(id).classList.contains("ap--a")) && many().length === 0,
      "Approve all chooses Approve on every card and sends nothing: " + bar().textContent);
    byAct(bar(), "approve.clear").click(); await p.work.quiet();
    ok(bar().hidden && !p.row("d-1").classList.contains("ap--a"), "Clear lets every choice go");
    pickRow(p, "d-1", "draft.approve").click(); await p.work.quiet();
    pickRow(p, "d-2", "draft.reject").click(); await p.work.quiet();
    ok(bar().querySelector(".apbar__line").textContent === "1 approve · 1 reject", "the bar counts both ways: " + bar().textContent);
    confirm().click(); await p.work.quiet();
    ok(p.title() === "Decide 2 cards?" && /1 to approve/.test(p.sheet().textContent) && /1 to reject/.test(p.sheet().textContent) && p.inSheet("ask.go").textContent === "Confirm 2"
      && p.sheet().querySelectorAll(".salt-ledger__row").length === 3, "the Sheet lists the cards to approve, then those to reject, every row of each: " + p.sheet().textContent);
    holder.refuse["d-1"] = "Add the date";
    p.inSheet("ask.go").click(); await p.work.quiet();
    ok(many().length === 1 && same(many()[0].body, { approve: ["d-1"], reject: ["d-2", "d-3"] }), "and one request carries both lists: " + J(many()));
    const done = d.querySelector("#makerDrafts .apdone"), left = p.row("d-1");
    ok(!!done && /^1 decided, 1 refused/.test(done.textContent) && /1 rejected\./.test(done.textContent) && !p.row("d-2") && !!left,
      "the status card counts what went and what was refused, the refused card stays and the rest leave: " + (done && done.textContent));
    const why = left && left.querySelector(".aprefused");
    ok(!!why && /Refused/.test(why.textContent) && /Why: /.test(why.textContent) && /To fix: Add the date/.test(why.textContent) && left.classList.contains("ap--r"),
      "a refused card keeps its place with Refused, why, and how to fix it: " + (why && why.textContent));
    byAct(head(), "approve.all").click(); await p.work.quiet();
    ok(bar().hidden && !p.row("d-1").classList.contains("ap--a"), "Approve all passes over a card the Desk refused");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Needs you no longer lists a row to approve (his answer, no overlaps); the glance counts the cards in a tile that opens Approve */
  p = await open();
  try {
    const d = p.d;
    const tile = d.querySelector('[data-glance="approve"]');
    ok(!d.querySelector('#nlist [data-need^="d:"]') && !d.querySelector('[data-act="need.approve-row"]'), "Needs you lists no row to approve and has no Approve pill");
    ok(!!tile && tile.querySelector(".salt-glance__label").textContent === "To approve" && tile.querySelector(".salt-glance__value").textContent === "2" && tile.querySelector(".salt-glance__note").textContent === "On Orders"
      && tile.getAttribute("href") === "#orders/approve" && tile.parentElement.lastElementChild === tile,
    "the glance's last tile reads To approve with the number of cards waiting, and opens Orders > Approve: " + (tile && tile.textContent));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Withdraw server-held entry asks on the Sheet, and Finish server withdrawal, which asked nothing, still asks nothing */
  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    const w1 = () => byAct(d.getElementById("makerQueueReview"), "queue.withdraw", "q-1"), w2 = () => byAct(d.getElementById("makerQueueReview"), "queue.withdraw", "q-2");
    const sends = (id) => p.posted("/all/maker/queue/" + id + "/withdraw");
    ok(w1().textContent === "Withdraw this entry" && w2().textContent === "Finish the withdrawal", "the held entry offers Withdraw and the refused one Finish");
    w1().click(); await p.work.quiet();
    ok(p.title() === "Withdraw this entry?" && /waiting for the Desk/.test(p.sheet().textContent) && /still unsent on a phone is not affected/.test(p.sheet().textContent)
      && p.inSheet("ask.go").classList.contains("salt-ghost--danger") && !!p.inSheet("ask.go", "queue:q-1") && sends("q-1").length === 0 && p.confirms.length === 0,
    "Withdraw opens the Sheet, restating the entry and what it does not do, and sends nothing as it opens: " + (p.sheet() && p.sheet().textContent));
    const bad = await p.ways(() => w1().click(), w1, () => sends("q-1").length);
    ok(bad.length === 0, "the four ways out send nothing and give focus back to Withdraw: " + bad.join(" | "));
    w1().click(); await p.work.quiet();
    const go = p.inSheet("ask.go");
    go.click(); go.click(); await p.work.quiet();
    ok(sends("q-1").length === 1 && same(sends("q-1")[0].body, { fingerprint: "f1" }) && !p.sheet(),
      "its one action sends the withdrawal with the entry's fingerprint, once however often it is tapped: " + J(sends("q-1")));
    ok(/did not confirm the withdrawal/.test(w1() ? w1().closest("article").textContent : "") , "and an answer that is no receipt is still refused on the entry's own line");
    w2().click(); await p.work.quiet();
    ok(!p.sheet() && sends("q-2").length === 1 && same(sends("q-2")[0].body, { fingerprint: "f2" }) && p.confirms.length === 0,
      "Finish server withdrawal asks nothing, as it did not, and sends at once");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Close the group order asks on the Sheet; Close again, on a closed one, asks nothing */
  p = await open();
  try {
    const d = p.d;
    await p.tap("nav.orders"); await p.tap("part.orders.group");
    const close = (id) => byAct(d.getElementById("makerPools"), "pool.close", id), closes = (id) => p.posted("/all/maker/pools/" + id + "/close");
    ok(close("p-1").textContent === "Close" && close("p-2").textContent === "Close again", "an open group order offers Close and one with orders left Close again");
    close("p-1").click(); await p.work.quiet();
    ok(p.title() === "Close this group order?" && /3 of 10 units/.test(p.sheet().textContent) && /1 joined/.test(p.sheet().textContent) && /every joiner is told once/.test(p.sheet().textContent)
      && !!p.inSheet("ask.go", "pool:p-1") && closes("p-1").length === 0 && p.confirms.length === 0,
    "Close opens the Sheet, restating the group order and that every joiner is told once, and sends nothing as it opens: " + (p.sheet() && p.sheet().textContent));
    const bad = await p.ways(() => close("p-1").click(), () => close("p-1"), () => closes("p-1").length);
    ok(bad.length === 0, "the four ways out send nothing and give focus back to Close: " + bad.join(" | "));
    close("p-1").click(); await p.work.quiet();
    const go = p.inSheet("ask.go");
    go.click(); go.click(); await p.work.quiet();
    ok(closes("p-1").length === 1 && same(closes("p-1")[0].body, {}), "its one action sends the close, once however often it is tapped: " + J(closes("p-1")));
    close("p-2").click(); await p.work.quiet();
    ok(!p.sheet() && closes("p-2").length === 1, "Close again asks nothing, as it did not, and sends at once");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Set and Clear the notice ask on the Sheet */
  p = await open();
  try {
    const d = p.d;
    await p.tap("nav.shop"); await p.tap("part.shop.notice");
    const text = byAct(d, "notice.text"), set = () => byAct(d, "notice.set"), clear = () => byAct(d, "notice.clear"), posts = () => p.posted("/all/maker/bulletin");
    text.value = "Closed on Monday"; text.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    set().click(); await p.work.quiet();
    ok(p.title() === "Set this notice?" && /Closed on Monday/.test(p.sheet().textContent) && /Every customer is notified/.test(p.sheet().textContent) && !p.inSheet("ask.go").classList.contains("salt-ghost--danger")
      && !!p.inSheet("ask.go", "notice:set") && posts().length === 0 && p.confirms.length === 0,
    "Set notice opens the Sheet, restating the words and that every customer is notified, and sends nothing as it opens: " + (p.sheet() && p.sheet().textContent));
    const bad = await p.ways(() => set().click(), set, () => posts().length);
    ok(bad.length === 0, "the four ways out send nothing and give focus back to Set notice: " + bad.join(" | "));
    set().click(); await p.work.quiet();
    const go = p.inSheet("ask.go");
    go.click(); go.click(); await p.work.quiet();
    ok(posts().length === 1 && same(posts()[0].body, { lines: ["Closed on Monday"], confirmed: true }) && !p.sheet(),
      "its one action sends the notice as it did, once however often it is tapped: " + J(posts()));
    clear().click(); await p.work.quiet();
    ok(p.title() === "Clear the notice?" && /No notification is sent/.test(p.sheet().textContent) && p.inSheet("ask.go").classList.contains("salt-ghost--danger") && posts().length === 1,
      "Clear notice asks on the Sheet, a danger action that says no notification is sent, and sends nothing as it opens");
    p.inSheet("ask.go").click(); await p.work.quiet();
    ok(posts().length === 2 && same(posts()[1].body, { lines: [], confirmed: true }) && p.confirms.length === 0, "and its one action clears it: " + J(posts()[1]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* a twin at entry is put to him on the Sheet: the Desk answers a gift with a booked row beside it, and his yes sends it again naming that row */
  p = await open();
  try {
    const d = p.d, gifts = [];
    const base = p.w.fetch;
    p.w.fetch = async (path, init) => {
      if (String(path) === "/all/maker/inputs/gift" && init && init.method === "POST") {
        const body = JSON.parse(init.body); gifts.push(body);
        if (!body.second) return { ok: true, status: 200, json: async () => ({ ok: false, error: "A matching gift is already booked.", twin: { second: "s900" } }) };
      }
      return base(path, init);
    };
    await p.tap("nav.record"); await p.tap("part.record.entry"); await p.tap("record.form", "gift");
    const send = () => byAct(d, "record.gift.send"), status = () => send().closest(".maker-input").querySelector("[role=status]").textContent;
    send().click(); await p.work.quiet();
    ok(p.title() === "Record this gift again?" && /You already recorded a gift like this/.test(p.sheet().textContent) && !p.inSheet("ask.go").classList.contains("salt-ghost--danger")
      && !!p.inSheet("ask.go", "twin:gift") && gifts.length === 1 && p.confirms.length === 0,
    "a gift the Desk finds booked asks on the Sheet whether to record it again, and sends nothing more as it opens: " + (p.sheet() && p.sheet().textContent));
    p.inSheet("ask.keep").click(); await p.work.quiet();
    ok(!p.sheet() && gifts.length === 1 && /already booked/.test(status()) && !send().disabled,
      "his no sends nothing more, says why on the form and leaves it free: " + status());
    send().click(); await p.work.quiet();
    const go = p.inSheet("ask.go");
    go.click(); go.click(); await p.work.quiet();
    ok(gifts.length === 3 && gifts[2].second === "s900" && gifts[2].at !== gifts[0].at && !p.sheet() && p.confirms.length === 0,
      "his yes sends it again naming the booked row under a fresh moment, once however often it is tapped: " + J(gifts.map((g) => [g.at, g.second])));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Cancel reply retry asks on the Sheet: a reply that did not get through is kept encrypted on this device, and cancelling it removes that copy and nothing the Desk holds */
  p = await open();
  try {
    const d = p.d, ROUTE = "/all/maker/threads/" + U;
    await p.tap("nav.customers"); await p.tap("part.customers.messages"); await p.tap("chat.open", U);
    p.fail.add(ROUTE);
    const reply = byAct(d, "chat.reply");
    reply.value = "Ready on Friday."; reply.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    await p.tap("chat.send");
    const cancel = () => byAct(d, "chat.cancel-retry"), kept = () => Object.keys(p.w.localStorage).filter((k) => k.indexOf("saltMakerChat:") === 0).length;
    ok(!!cancel() && !cancel().hidden && kept() === 1 && p.posted(ROUTE).length === 1, "a reply the Desk could not be reached for is kept on this device, and Cancel reply retry is offered");
    cancel().click(); await p.work.quiet();
    ok(p.title() === "Discard this unsent reply?" && /A reply already sent stays sent/.test(p.sheet().textContent) && !!p.inSheet("ask.go", "chat:" + U + ":retry") && kept() === 1 && p.confirms.length === 0,
      "Cancel reply retry opens the Sheet, saying a reply already sent is not removed, and removes nothing as it opens");
    const bad = await p.ways(() => cancel().click(), cancel, () => 1 - kept());
    ok(bad.length === 0 && kept() === 1, "the four ways out remove nothing and give focus back to Cancel reply retry: " + bad.join(" | "));
    cancel().click(); await p.work.quiet();
    p.inSheet("ask.go").click(); await p.work.quiet();
    ok(kept() === 0 && !p.sheet() && p.confirms.length === 0 && cancel().hidden, "its one action removes the copy kept on this device");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 4. NO NATIVE CONFIRM IS LEFT IN THE OWNER'S SCRIPT */
  const owner = readFileSync(new URL("../stmt/owner.js", import.meta.url), "utf8");
  const found = [...owner.matchAll(/\bconfirm\s*\(/g)].map((m) => owner.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, " "));
  ok(owner.length > 100000 && found.length === 0, "the owner's script calls no confirm, as itself or as window.confirm" + (found.length ? ": " + J(found) : ""));

  /* 5. A LAPSE TAKES A SHEET LEFT OPEN DOWN WITH THE PAGE */
  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    byAct(p.row("d-1"), "draft.approve").click(); await p.work.quiet();
    byAct(d, "approve.confirm").click(); await p.work.quiet();
    ok(!!p.sheet() && !d.body.classList.contains("ended"), "Confirm's Sheet is open over Orders, and the page has not lapsed");
    p.lapse(true);
    const tick = p.intervals.filter((i) => i.ms === 5000 && !i.off)[0];
    if (tick) tick.f();
    await p.work.quiet();
    ok(!!tick && d.body.classList.contains("ended") && !d.getElementById("aEnded").hidden && !p.sheet() && !d.getElementById("ynWrap") && p.posted(MANY).length === 0,
      "when his Access sign-in ends the page gives way to Sign in again and the Sheet goes with it, sending nothing, never left over the lapse screen");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
