/* test/admin-approve-queue.mjs: THE ROWS TO APPROVE, THE QUEUE, AND NO NATIVE CONFIRM (Phase 2c of the Salt Account redesign, 12 Oct 2026; docs/STATEMENTS.md "The rows to approve").
 *
 * A Desk row waiting for him is a card on Record > Approve (and a pill on Needs you). His decisions of 11 Oct 2026 shape it: 4, a Sheet replaces every native confirm, and the phone leads a
 * draft with the cost and margin read off the draft and computes nothing, its flags frozen at drafting. What is proved here, each check red under its own mutation
 * (test/admin-approve-queue.mutations.json):
 *   3  Approve, Reject, the trip's Approve, the Needs you pill, Withdraw server-held entry, Close the group order and Set and Clear the notice each ask on the page's Sheet: nothing is sent as it
 *      opens, the four ways out send nothing and give focus back, the one action sends the request the confirm let through (the same route and body), and a second tap sends nothing
 *   4  no native confirm is left in the owner's script, and none is asked on any road above
 * The twin at entry, the retained cancels, the chat retry and the vault conflict are driven through the same Sheet in their own sections (test/maker-gift-twin.mjs, maker-loan-twin.mjs, maker-trades.mjs,
 * maker-communications.mjs, maker-input-receipts.mjs and the admin section of test/verify.mjs). Drawn by the maker harness (test/maker-act.mjs). */
import { readFileSync } from "node:fs";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const U = "abcd-efgh";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;
const route = (verb, id) => "/all/maker/drafts/" + id + "/" + verb;

export async function run({ ok, pageWork }) {
  const holder = {};
  /* a row decided leaves the review's answer, as the Desk would have it */
  const decided = (j) => ({ ...j, drafts: j.drafts.filter((x) => !((holder.p && holder.p.posts) || []).some((q) => q.route === route("approve", x.id) || q.route === route("reject", x.id))) });
  const open = async (extra = {}) => {
    const { review: more, ...rest } = extra;
    holder.p = null;   /* the page before this one has posts of its own, which the new page's first reads must not see */
    const p = await richOwnerPage({ pageWork, review: (j) => decided(more ? more(j) : j), ...rest });
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
  const enterRecord = async (p) => { await p.tap("nav.record"); await p.tap("part.record.approve"); };

  let p;
  /* 3. APPROVE AND REJECT ASK ON THE SHEET */
  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    const approve = () => byAct(p.row("d-1"), "draft.approve"), approves = () => p.posted(route("approve", "d-1")).length;
    approve().click(); await p.work.quiet();
    const sh = p.sheet();
    ok(!!sh && sh.getAttribute("role") === "dialog" && sh.getAttribute("aria-modal") === "true" && sh.classList.contains("salt-sheet") && approves() === 0 && p.confirms.length === 0,
      "Approve row opens the page's Sheet, a modal dialog, and sends nothing as it opens, with no native confirm asked");
    ok(p.title() === "Approve this row?" && /CX1-ZED/.test(sh.textContent) && /RM 100\.00/.test(sh.textContent) && /SELL, 1 unit/.test(sh.textContent) && /as drafted/.test(sh.textContent)
      && sh.querySelectorAll(".salt-ledger__row").length === 1,
    "the Sheet restates the row by its code, its size, its kind and its figure, and says it is approved as drafted: " + sh.textContent);
    ok(!!p.inSheet("ask.go", "draft:d-1:approve") && !!p.inSheet("ask.keep", "draft:d-1:approve") && !!p.inSheet("ask.close", "draft:d-1:approve")
      && !p.inSheet("ask.go").classList.contains("salt-ghost--danger") && sh.querySelector(".salt-sheet__foot").contains(p.inSheet("ask.go")) && p.inSheet("ask.go").textContent === "Approve row",
    "its controls carry their acts and the row's key, and Approve is not a danger action");
    const bad = await p.ways(() => approve().click(), approve, approves);
    ok(bad.length === 0, "the ghost, the close control, the scrim and Escape each close it, send nothing and give focus back to Approve row: " + bad.join(" | "));
    /* a redraw behind the Sheet takes the control that asked: focus goes to the one drawn in its place, found by what it asks (its data-yn) */
    const old = approve();
    old.click(); await p.work.quiet();
    byAct(d, "maker.refresh").click(); await p.work.quiet();
    const fresh = approve();
    ok(!!p.sheet() && !!fresh && fresh !== old && !old.isConnected && fresh.getAttribute("data-yn") === "draft:d-1:approve", "the list is read again while the Sheet is up and Approve row is a new control");
    p.inSheet("ask.keep").click(); await p.work.quiet();
    ok(!p.sheet() && d.activeElement === fresh && approves() === 0, "and a no gives focus to the control drawn in its place, sending nothing");
    approve().click(); await p.work.quiet();
    const go = p.inSheet("ask.go");
    go.click(); await p.work.quiet();
    go.click(); await p.work.quiet();
    const sent = p.posted(route("approve", "d-1"));
    ok(sent.length === 1 && same(sent[0].body, {}) && !p.sheet(), "the one action sends the row's approval, the same route and the same empty body as the confirm let through, and a second tap on it sends nothing: " + J(sent));
    ok(!p.row("d-1") && /Row approved\./.test(d.getElementById("makerDraftStatus").textContent), "the row leaves the list and the answer stands on the list's line: " + d.getElementById("makerDraftStatus").textContent);

    /* a trip: one Sheet for the card, every row of it listed, one request */
    byAct(p.row("d-2"), "draft.approve").click(); await p.work.quiet();
    ok(p.title() === "Approve every row of this trip?" && p.sheet().querySelectorAll(".salt-ledger__row").length === 2 && (p.sheet().textContent.match(/RM 100\.00/g) || []).length === 2
      && p.inSheet("ask.go").textContent === "Approve trip" && p.posted(route("approve", "d-2")).length === 0,
    "a trip's Approve asks once for the card and lists every row it decides: " + p.sheet().textContent);
    p.inSheet("ask.go").click(); await p.work.quiet();
    ok(p.posted(route("approve", "d-2")).length === 1 && same(p.posted(route("approve", "d-2"))[0].body, {}) && p.posted(route("approve", "d-3")).length === 0,
      "and sends the one request for the trip, under the row it was tapped on");
    ok(p.confirms.length === 0, "and no native confirm was asked on the way");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    const reject = () => byAct(p.row("d-1"), "draft.reject"), rejects = () => p.posted(route("reject", "d-1")).length;
    reject().click(); await p.work.quiet();
    ok(p.title() === "Reject this Desk row?" && p.inSheet("ask.go").classList.contains("salt-ghost--danger") && p.inSheet("ask.go").textContent === "Reject row" && /CX1-ZED/.test(p.sheet().textContent)
      && rejects() === 0 && p.confirms.length === 0 && !!p.inSheet("ask.go", "draft:d-1:reject"),
    "Reject row asks on the Sheet, a danger action naming the row, and sends nothing as it opens: " + (p.sheet() && p.sheet().textContent));
    const bad = await p.ways(() => reject().click(), reject, rejects);
    ok(bad.length === 0, "the four ways out send nothing and give focus back to Reject row: " + bad.join(" | "));
    reject().click(); await p.work.quiet();
    const go = p.inSheet("ask.go");
    go.click(); go.click(); await p.work.quiet();
    ok(rejects() === 1 && same(p.posted(route("reject", "d-1"))[0].body, {}) && !p.sheet() && !p.row("d-1") && /Row rejected\./.test(d.getElementById("makerDraftStatus").textContent),
      "its one action sends the rejection, the same route and empty body, once however often it is tapped: " + J(p.posted(route("reject", "d-1"))));
    byAct(p.row("d-3"), "draft.reject").click(); await p.work.quiet();
    ok(p.title() === "Reject every row of this trip?" && p.sheet().querySelectorAll(".salt-ledger__row").length === 2 && p.inSheet("ask.go").textContent === "Reject trip",
      "a trip's Reject asks once for the card and lists every row: " + p.title());
    p.inSheet("ask.keep").click(); await p.work.quiet();
    ok(p.posted(route("reject", "d-3")).length === 0 && p.confirms.length === 0, "and keeping it sends nothing");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* the Needs you pill asks the same question on the same Sheet, and a no leaves the card as it was */
  p = await open();
  try {
    const d = p.d;
    const card = () => d.querySelector('#nlist [data-need="d:d-1"]'), pill = () => byAct(card(), "need.approve-row");
    ok(!!card() && !!pill(), "Needs you has the row's card and its Approve pill");
    const before = pill();
    pill().click(); await p.work.quiet();
    ok(p.title() === "Approve this row?" && p.inSheet("ask.go").textContent === "Approve row" && !!p.inSheet("ask.go", "need:draft:d-1:approve") && p.posted(route("approve", "d-1")).length === 0 && p.confirms.length === 0,
      "the pill opens the very Sheet Record > Approve asks on, and sends nothing as it opens");
    p.inSheet("ask.keep").click(); await p.work.quiet();
    ok(!p.sheet() && pill() === before && !pill().disabled && d.activeElement === pill() && p.posted(route("approve", "d-1")).length === 0,
      "a no leaves the pill on, the card undrawn and the focus on the pill");
    const release = p.hold(route("approve", "d-1"));
    pill().click(); await p.work.quiet();
    p.inSheet("ask.go").click();
    for (let i = 0; i < 100 && !p.work.inFlight(); i++) await sleep(5);
    ok(p.posted(route("approve", "d-1")).length === 1 && same(p.posted(route("approve", "d-1"))[0].body, {}) && pill().disabled, "his yes sends the one request and the pill is off while it is out");
    pill().click();   /* a tap on a pill that is off opens nothing, at once: a Sheet would be up this instant */
    ok(p.posted(route("approve", "d-1")).length === 1 && !p.sheet(), "and a second tap on it sends nothing, nor opens a Sheet");
    release(); await p.work.quiet();
    ok(/Row approved\./.test(card() ? card().textContent : "") && p.confirms.length === 0, "the answer stays on the card he tapped: " + (card() && card().textContent.slice(0, 120)));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Withdraw server-held entry asks on the Sheet, and Finish server withdrawal, which asked nothing, still asks nothing */
  p = await open();
  try {
    const d = p.d;
    await enterRecord(p);
    const w1 = () => byAct(d.getElementById("makerQueueReview"), "queue.withdraw", "q-1"), w2 = () => byAct(d.getElementById("makerQueueReview"), "queue.withdraw", "q-2");
    const sends = (id) => p.posted("/all/maker/queue/" + id + "/withdraw");
    ok(w1().textContent === "Withdraw server-held entry" && w2().textContent === "Finish server withdrawal", "the held entry offers Withdraw and the refused one Finish");
    w1().click(); await p.work.quiet();
    ok(p.title() === "Withdraw this uploaded entry?" && /q-1/.test(p.sheet().textContent) && /held/.test(p.sheet().textContent) && /does not withdraw an unsent device entry/.test(p.sheet().textContent)
      && p.inSheet("ask.go").classList.contains("salt-ghost--danger") && !!p.inSheet("ask.go", "queue:q-1") && sends("q-1").length === 0 && p.confirms.length === 0,
    "Withdraw opens the Sheet, restating the entry and what it does not do, and sends nothing as it opens: " + (p.sheet() && p.sheet().textContent));
    const bad = await p.ways(() => w1().click(), w1, () => sends("q-1").length);
    ok(bad.length === 0, "the four ways out send nothing and give focus back to Withdraw: " + bad.join(" | "));
    w1().click(); await p.work.quiet();
    const go = p.inSheet("ask.go");
    go.click(); go.click(); await p.work.quiet();
    ok(sends("q-1").length === 1 && same(sends("q-1")[0].body, { fingerprint: "f1" }) && !p.sheet(),
      "its one action sends the withdrawal with the entry's fingerprint, once however often it is tapped: " + J(sends("q-1")));
    ok(/matching withdrawal receipt/.test(w1() ? w1().closest("article").textContent : "") , "and an answer that is no receipt is still refused on the entry's own line");
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
    ok(p.title() === "Record this as a separate gift?" && /A matching gift is already booked/.test(p.sheet().textContent) && !p.inSheet("ask.go").classList.contains("salt-ghost--danger")
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
    ok(p.title() === "Cancel this retry?" && /A reply already sent is not removed/.test(p.sheet().textContent) && !!p.inSheet("ask.go", "chat:" + U + ":retry") && kept() === 1 && p.confirms.length === 0,
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

}
