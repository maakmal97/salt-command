/* test/admin-claim-card.mjs: THE CLAIM CARD (Phase 2b of the Salt Account redesign, 12 Oct 2026; docs/STATEMENTS.md "The claim card").
 *
 * A payment a customer says they sent is a row in Orders > Waiting on you, and the row opened is its card (stmt/owner.js makerClaimCard). His decisions of
 * 11 Oct 2026 shape it: 6, the card reads its own rows when it is opened and never on a row, with no Preview rows button; 3, the slip key is the one unlock the
 * page holds, device only, cleared on hide, so a slip is a thumbnail drawn only once the key is held; 4, Received and Not found ask on the page's Sheet, never a
 * native confirm, on an order's claim as on an account's. What is proved here, each check red under its own mutation (test/admin-claim-card.mutations.json):
 *   1  the rows: read once on opening the card, never by a row or by listing, read afresh each opening, Received waiting on them, and Read the rows again
 *   2  the slip: sealed with nothing fetched until the key is held, a thumbnail once it is, drawn from the key with no second passphrase, its blob: URL revoked
 *      on the lock, on hide and when the card closes, a control of 44px that a tap enlarges
 *   3  the sheet an account claim asks on: who, how much and the rows, nothing sent as it opens, one action sending the body and the request id the confirm let
 *      through, the four ways out sending nothing, a retry sent at once under its id, a second tap sending nothing
 *   4  the sheet an order's claim asks on, the same, with the order restated
 * The slip's crypto order (a read held across a lock) is test/maker-claims.mjs, which draws the page with the real ECDH and HKDF. Drawn by the maker harness
 * (test/maker-act.mjs), whose hold(route) keeps an answer back until it is let go and whose slip: true gives the page the vault's slip key. */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const U = "abcd-efgh", C1 = U + ":c-1", C2 = U + ":c-2";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const previews = (p, id) => p.posts.filter((x) => /[/]claims[/][^/]+[/][^/]+[/]preview$/.test(x.route) && (!id || x.route.includes("/" + id + "/")));
const answers = (p, id, kind) => p.posts.filter((x) => x.route === "/all/maker/claims/" + U + "/" + id + "/" + kind);
const cssRules = (w) => {
  const rules = [];
  for (const sheetCss of w.document.styleSheets) for (const r of sheetCss.cssRules) if (r.selectorText) rules.push([r.selectorText, r.style]);
  return (sel) => rules.filter((r) => r[0] === sel).map((r) => r[1]);
};

export async function run({ ok, pageWork }) {
  const open = async (extra = {}) => {
    const p = await richOwnerPage({ pageWork, slip: true, ...extra });
    await p.work.quiet();
    p.enter = async () => { byAct(p.d, "nav.orders").click(); await p.work.quiet(); };
    p.tap = async (act, key) => { const e = byAct(p.d, act, key); if (e) e.click(); await p.work.quiet(); return !!e; };
    p.card = (key) => [...p.d.querySelectorAll("#makerClaims [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === "claim:" + key) || null;
    p.in = (act, key) => byAct(p.d.getElementById("makerClaims"), act, key);
    p.say = () => (p.d.querySelector("#makerClaims .salt-insight[role=status]") || { textContent: "" }).textContent;
    return p;
  };

  /* 1. THE ROWS ARE READ ON OPENING THE CARD */
  let p = await open();
  try {
    const d = p.d;
    await p.enter();
    ok(!!byAct(d, "claim.open", C1) && !!byAct(d, "claim.open", C2) && [...d.querySelectorAll("#makerClaims [data-act]")].every((e) => e.getAttribute("data-act") === "claim.open")
      && previews(p).length === 0 && !p.reads.some((r) => /preview/.test(r)),
      "entering Orders lists each waiting claim as a row, with no control on it, and asks the Desk for no rows: a row reads nothing");
    await p.tap("claim.open", C1);
    const one = previews(p, "c-1");
    ok(one.length === 1 && one[0].route === "/all/maker/claims/" + U + "/c-1/preview" && same(one[0].body, {}) && !!p.card(C1) && !p.card(C2)
      && byAct(d, "claim.open", C1).getAttribute("aria-expanded") === "true" && byAct(d, "claim.open", C2).getAttribute("aria-expanded") === "false",
      "opening a claim reads its rows once, at their own route, and its card stands under its row: " + JSON.stringify(one));
    ok(/08 Oct 2026: RM 50\.00 of RM 60\.00/.test(p.card(C1).textContent) && /These rows are settled together/.test(p.card(C1).textContent)
      && !p.in("claim.received").disabled && p.in("claim.received-booked").disabled,
      "its rows are listed with what they settle, and Received is live: " + p.card(C1).textContent.slice(0, 160));
    ok(!p.in("claim.preview") && ![...d.querySelectorAll("#makerClaims button")].some((b) => /^Preview/.test(b.textContent)),
      "and the card has no Preview rows button");
    await p.tap("claim.open", C2);
    ok(previews(p, "c-2").length === 1 && previews(p, "c-1").length === 1 && previews(p).length === 2 && !p.card(C1) && !!p.card(C2),
      "another claim opened reads its own rows, the first is not read again, and only one card is open: " + previews(p).map((x) => x.route).join());
    await p.tap("claim.open", C2);
    ok(!p.card(C2) && previews(p).length === 2 && byAct(d, "claim.open", C2).getAttribute("aria-expanded") === "false",
      "a tap on the row open closes its card and reads nothing");
    await p.tap("claim.open", C1);
    ok(previews(p, "c-1").length === 2, "a claim opened again reads its rows afresh: " + previews(p, "c-1").length);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Received waits for the rows, and Not found does not */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    const release = p.hold("/all/maker/claims/" + U + "/c-1/preview");
    byAct(d, "claim.open", C1).click(); await sleep(30);
    ok(!!p.card(C1) && p.in("claim.received").disabled && p.in("claim.received-booked").disabled && !p.in("claim.not-found").disabled && /Reading the rows/.test(p.say()),
      "while the rows are being read Received is shut and says so, and Not found is not held up by it");
    release(); await p.work.quiet();
    ok(!p.in("claim.received").disabled && /Rows read/.test(p.say()), "and Received opens once they are read");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* a read that fails says why, leaves Received shut, and offers the rows again */
  p = await open({ failRoutes: ["/all/maker/claims/" + U + "/c-2/preview"] });
  try {
    const d = p.d;
    await p.enter();
    await p.tap("claim.open", C2);
    ok(p.in("claim.received").disabled && p.in("claim.received-booked").disabled && !p.in("claim.not-found").disabled && !!p.in("claim.reread") && /Not sent/.test(p.card(C2).textContent),
      "a read that fails leaves Received shut, keeps Not found, says why and offers Read the rows again");
    p.fail.delete("/all/maker/claims/" + U + "/c-2/preview");
    await p.tap("claim.reread", C2);
    ok(previews(p, "c-2").length === 2 && !p.in("claim.received").disabled && !p.in("claim.reread"), "Read the rows again reads them, and Received opens: " + previews(p, "c-2").length);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 2. THE SLIP IS A THUMBNAIL, DRAWN ONLY FROM THE KEY THE PAGE HOLDS */
  const slipReads = (q) => q.reads.filter((r) => r.startsWith("/all/maker/slips/")).length;
  const keyReads = (q) => q.reads.filter((r) => r === "/all/maker/vault/key").length;
  p = await open({ claims: (j) => { j.claims[1].slip = "s-2"; return j; } });
  try {
    const d = p.d;
    let hidden = false;
    Object.defineProperty(d, "hidden", { get: () => hidden, configurable: true });
    const lockByHide = async () => { hidden = true; d.dispatchEvent(new p.w.Event("visibilitychange")); hidden = false; await p.work.quiet(); };
    const thumb = () => p.in("claim.slip");
    await p.enter();
    ok(slipReads(p) === 0 && keyReads(p) === 0, "listing the claims asks for no slip and no key");
    await p.tap("claim.open", C1);
    ok(!thumb() && !!p.in("claim.passphrase") && !!p.in("claim.view-slip") && /locked/.test(p.card(C1).textContent) && slipReads(p) === 0 && keyReads(p) === 0 && p.urls.made.length === 0,
      "a claim with a slip, opened with no key held, says the slip is sealed and offers the unlock, and fetches no ciphertext it cannot open");
    p.type(p.in("claim.passphrase"), p.slipPass); await p.click(p.in("claim.view-slip"));
    ok(!!thumb() && thumb().tagName === "BUTTON" && !!thumb().querySelector("img") && /^blob:/.test(thumb().querySelector("img").src) && p.urls.made.length === 1
      && slipReads(p) === 1 && keyReads(p) === 1 && !p.in("claim.passphrase"),
      "the passphrase opens the slip key and the slip is drawn as a thumbnail that is a control, from a blob: URL, asking for the key once and the slip once");
    const box = () => p.card(C1).querySelector(".maker-slipbox");
    ok(thumb().getAttribute("aria-expanded") === "false" && !box().classList.contains("open"), "the thumbnail begins small");
    thumb().click();
    ok(thumb().getAttribute("aria-expanded") === "true" && box().classList.contains("open") && p.urls.made.length === 1, "a tap on it opens the full slip in place, from the same picture");
    thumb().click();
    ok(thumb().getAttribute("aria-expanded") === "false" && !box().classList.contains("open"), "and the next tap shrinks it");
    await p.tap("claim.open", C2);
    ok(p.urls.revoked.includes("blob:fixture-1") && !p.card(C1) && !!p.in("claim.slip") && !p.in("claim.passphrase") && p.urls.made.length === 2 && slipReads(p) === 2 && keyReads(p) === 1,
      "another claim opened draws its slip from the key the page holds, with no passphrase asked and the key not fetched again, and the picture of the card closed is revoked: "
      + JSON.stringify(p.urls));
    const before = p.urls.revoked.length;
    await lockByHide();
    ok(p.urls.revoked.length === before + 1 && p.urls.revoked.includes("blob:fixture-2") && !p.in("claim.slip") && !!p.in("claim.passphrase") && /locked/.test(p.card(C2).textContent),
      "a page hidden revokes the picture and drops the key: the card says the slip is sealed again");
    const reads = slipReads(p);
    await p.tap("claim.open", C2); await p.tap("claim.open", C2);
    ok(!p.in("claim.slip") && !!p.in("claim.passphrase") && slipReads(p) === reads, "and a card opened after that asks for the unlock again and fetches nothing");
    p.type(p.in("claim.passphrase"), p.slipPass); await p.click(p.in("claim.view-slip"));
    const shut = p.urls.revoked.length;
    await p.tap("claim.lock-slip", C2);
    ok(p.urls.revoked.length === shut + 1 && !p.in("claim.slip") && !!p.in("claim.passphrase"), "Close and lock slip revokes the picture and seals the card again");
    p.type(p.in("claim.passphrase"), p.slipPass); await p.click(p.in("claim.view-slip"));
    const open1 = p.urls.revoked.length;
    await p.tap("claim.open", C2);
    ok(p.urls.revoked.length === open1 + 1 && !p.card(C2) && !d.querySelector("[data-maker-slip]"), "closing the card revokes its picture and leaves no image on the page");
    /* the thumbnail is the control, and it measures the tap: 44px at least both ways, a button of the page's own CSS */
    const rule = cssRules(p.w)(".adm .maker-slip-open")[0], bigger = cssRules(p.w)(".adm .maker-slipbox.open .maker-slip-open .maker-slip")[0];
    ok(!!rule && rule.getPropertyValue("min-width") === "var(--salt-tap)" && rule.getPropertyValue("min-height") === "var(--salt-tap)" && !!bigger && bigger.getPropertyValue("max-height") === "none",
      "the thumbnail's control is the 44px token both ways, and opened it lifts its height limit: " + (rule && rule.cssText));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 3. AN ACCOUNT CLAIM'S RECEIVED AND NOT FOUND ASK ON THE PAGE'S SHEET */
  const calls = [], holder = {};
  const gone = (j) => ({ ...j, claims: j.claims.filter((c) => !((holder.p && holder.p.posts) || []).some((x) => /[/](received|notfound)$/.test(x.route) && x.route.includes("/" + c.id + "/"))) });
  p = await open({ claims: gone, failRoutes: [] });
  holder.p = p;
  try {
    const d = p.d, w = p.w;
    w.confirm = () => { calls.push("confirm"); return true; };
    w.alert = () => { calls.push("alert"); };
    w.prompt = () => { calls.push("prompt"); return ""; };
    const sheet = () => d.getElementById("ynSheet");
    const inSheet = (act, key) => (sheet() ? byAct(sheet(), act, key) : null);
    const key = (target, k) => { const e = new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }); target.dispatchEvent(e); return e; };
    await p.enter();
    await p.tap("claim.open", C1);
    p.in("claim.received", C1).click(); await p.work.quiet();
    const sh = sheet();
    ok(!!sh && sh.getAttribute("role") === "dialog" && sh.getAttribute("aria-modal") === "true" && sh.classList.contains("salt-sheet") && answers(p, "c-1", "received").length === 0 && calls.length === 0,
      "Received opens the page's Sheet, a modal dialog, and sends nothing as it opens, with no native confirm asked");
    ok(/Received RM 50\.00 from CX1-ZED\?/.test(sh.querySelector(".salt-sheet__title").textContent) && /CX1-ZED/.test(sh.textContent) && /RM 50\.00/.test(sh.textContent)
      && /08 Oct 2026: RM 50\.00 of RM 60\.00/.test(sh.textContent) && /recorded against the rows below/.test(sh.textContent),
      "the Sheet says who and how much, lists the rows and says what follows: " + sh.textContent);
    const lineOf = sh.querySelector(".salt-ledger__line");
    ok(!!lineOf && /CX1-ZED/.test(lineOf.querySelector(".salt-ledger__label").textContent) && lineOf.querySelector(".salt-ledger__value").textContent === "RM 50.00"
      && /Says they paid it/.test(sh.querySelector(".salt-ledger__flag").textContent),
      "and restates the claim as a line of its own: the code, the figure, and that they say they sent it");
    ok(!!inSheet("claim.ask-go", C1) && !!inSheet("claim.ask-keep", C1) && !!inSheet("claim.ask-close", C1) && !inSheet("claim.ask-go").classList.contains("salt-ghost--danger")
      && sh.querySelector(".salt-sheet__foot").contains(inSheet("claim.ask-go")),
      "its controls carry their acts, and Received is not a danger action");
    for (const [name, close] of [["Not yet", () => inSheet("claim.ask-keep").click()], ["the close control", () => inSheet("claim.ask-close").click()],
      ["the scrim", () => d.getElementById("ynScrim").click()], ["Escape", () => key(d.body, "Escape")]]) {
      if (!sheet()) { p.in("claim.received", C1).click(); await p.work.quiet(); }
      close(); await p.work.quiet();
      ok(!sheet() && answers(p, "c-1", "received").length === 0 && d.activeElement === p.in("claim.received", C1), name + " closes the sheet, sends nothing, and gives focus back to Received");
    }
    p.in("claim.received", C1).click(); await p.work.quiet();
    inSheet("claim.ask-go").click(); await p.work.quiet();
    const sent = answers(p, "c-1", "received");
    ok(sent.length === 1 && same(Object.keys(sent[0].body).sort(), ["hash", "rid"]) && sent[0].body.hash === "c".repeat(64) && /^[0-9a-f-]{36}$/.test(sent[0].body.rid) && !sheet(),
      "the one action sends the claim's Received, the same route and body as the confirm let through, under a request id: " + JSON.stringify(sent));
    ok(!p.card(C1) && !byAct(d, "claim.open", C1) && !!byAct(d, "claim.open", C2) && /Recorded\. CX1-ZED is told\./.test(p.say()),
      "the claim leaves the list and the answer stands in its place: " + p.say());
    ok(calls.length === 0, "and no native confirm, alert or prompt was asked on the way");

    /* Not found: a danger action, sending the amount and a request id */
    await p.tap("claim.open", C2);
    p.in("claim.not-found", C2).click(); await p.work.quiet();
    ok(/Not found RM 20\.00 from CX1-ZED\?/.test(sheet().querySelector(".salt-sheet__title").textContent) && inSheet("claim.ask-go", C2).classList.contains("salt-ghost--danger")
      && answers(p, "c-2", "notfound").length === 0, "Not found asks on the Sheet, a danger action, and sends nothing as it opens");
    /* a second tap on the action of a sheet already closed sends nothing, whether or not the first answer has landed: the sheet is shut before the request goes */
    p.fail.add("/all/maker/claims/" + U + "/c-2/notfound");
    const goNode = inSheet("claim.ask-go");
    goNode.click(); await p.work.quiet();
    goNode.click(); await p.work.quiet();
    const nf = answers(p, "c-2", "notfound");
    ok(nf.length === 1 && same(Object.keys(nf[0].body).sort(), ["amount", "rid"]) && nf[0].body.amount === 20 && /^[0-9a-f-]{36}$/.test(nf[0].body.rid) && !sheet(),
      "a second tap on the action of a sheet that has closed sends nothing, so a double tap sends once: " + JSON.stringify(nf));
    ok(/Not confirmed/.test(byAct(p.card(C2), "claim.not-found").closest("article").querySelector(".maker-say").textContent) && !p.in("claim.not-found", C2).disabled,
      "an answer that was not received says so on the card and leaves Not found live");
    /* a retry after a lost answer goes at once, with no second question, under the request id it had */
    p.fail.delete("/all/maker/claims/" + U + "/c-2/notfound");
    p.in("claim.not-found", C2).click(); await p.work.quiet();
    const nf2 = answers(p, "c-2", "notfound");
    ok(nf2.length === 2 && nf2[1].body.rid === nf2[0].body.rid && !sheet() && calls.length === 0, "the same answer again is sent at once under the request id it had: " + JSON.stringify(nf2.map((x) => x.body.rid)));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* a retry tapped twice while its answer is out is sent once: the in-flight guard, with the buttons' own disabled state set aside by calling the handler */
  const holder2 = {};
  p = await open({ claims: (j) => ({ ...j, claims: j.claims.filter((c) => !((holder2.p && holder2.p.posts) || []).some((x) => /[/]received$/.test(x.route) && x.route.includes("/" + c.id + "/") && holder2.done)) }) });
  holder2.p = p;
  try {
    const d = p.d;
    await p.enter();
    await p.tap("claim.open", C1);
    p.fail.add("/all/maker/claims/" + U + "/c-1/received");
    p.in("claim.received", C1).click(); await p.work.quiet();
    byAct(d, "claim.ask-go").click(); await p.work.quiet();
    p.fail.delete("/all/maker/claims/" + U + "/c-1/received");
    const release = p.hold("/all/maker/claims/" + U + "/c-1/received");
    const button = p.in("claim.received", C1);
    button.onclick(); button.onclick(); await sleep(30);
    release(); holder2.done = true; await p.work.quiet();
    ok(answers(p, "c-1", "received").length === 2 && answers(p, "c-1", "received")[1].body.rid === answers(p, "c-1", "received")[0].body.rid,
      "a retry tapped twice while its answer is out sends once, under the same request id: " + answers(p, "c-1", "received").length);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Received, on the book already: the preview says the claim is more than the rows, and the sheet says nothing more is booked */
  const over = (j) => ({ ...j, rows: [{ date: "2026-10-08", rm: 30, owed: 40, rid: "s-fixture-1" }], left: 20 });
  p = await open({ claimPreview: over });
  try {
    const d = p.d;
    await p.enter();
    await p.tap("claim.open", C1);
    ok(p.in("claim.received").disabled && !p.in("claim.received-booked").disabled && /RM 20\.00 more than the rows/.test(p.card(C1).textContent),
      "a claim above its rows shuts Received and opens Received, on the book already");
    p.in("claim.received-booked", C1).click(); await p.work.quiet();
    ok(/Already recorded\?/.test(d.getElementById("ynSheet").querySelector(".salt-sheet__title").textContent) && /Nothing more is recorded/.test(d.getElementById("ynSheet").textContent)
      && answers(p, "c-1", "received").length === 0, "its Sheet says nothing more is booked, and sends nothing as it opens");
    byAct(d, "claim.ask-go").click(); await p.work.quiet();
    const sent = answers(p, "c-1", "received");
    ok(sent.length === 1 && sent[0].body.covered === true && sent[0].body.hash === "c".repeat(64) && /^[0-9a-f-]{36}$/.test(sent[0].body.rid), "and sends covered with the hash and a request id: " + JSON.stringify(sent));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 4. AN ORDER'S CLAIM ASKS ON THE SHEET TOO */
  const ACLAIM = "2026-10-10T01:00:00.000Z", BCLAIM = "2026-10-10T02:00:00.000Z";
  p = await open();
  try {
    const d = p.d, w = p.w;
    const asked = [];
    w.confirm = () => { asked.push("confirm"); return true; };
    const sheet = () => d.getElementById("ynSheet");
    const sends = (suffix) => p.posts.filter((x) => x.route === "/all/maker/orders/ord-a1/" + suffix);
    await p.enter();
    byAct(d, "part.orders.agreed").click(); await p.work.quiet();
    byAct(d, "order.open", "ord-a1").click(); await p.work.quiet();
    const card = () => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === "ord-a1");
    byAct(card(), "order.claim-received", ACLAIM).click(); await p.work.quiet();
    ok(!!sheet() && /Received RM 30\.00 from CX1-ZED\?/.test(sheet().querySelector(".salt-sheet__title").textContent) && /CX1-ZED/.test(sheet().textContent) && /records RM 30\.00 against this order/.test(sheet().textContent)
      && !byAct(sheet(), "order.ask-go").classList.contains("salt-ghost--danger") && sends("received").length === 0 && asked.length === 0,
      "an order's Receive claimed asks on the Sheet, naming the amount and who, and sends nothing as it opens: " + (sheet() && sheet().textContent));
    byAct(sheet(), "order.ask-keep").click(); await p.work.quiet();
    ok(!sheet() && sends("received").length === 0, "Not yet sends nothing");
    byAct(card(), "order.claim-received", ACLAIM).click(); await p.work.quiet();
    byAct(sheet(), "order.ask-go").click(); await p.work.quiet();
    const got = sends("received");
    ok(got.length === 1 && got[0].body.amount === 30 && got[0].body.claim === ACLAIM && !Object.hasOwn(got[0].body, "covered") && /^[0-9a-f]{32}$/.test(got[0].body.rid),
      "its one action sends the claim's amount and moment under a request id, as the tap did: " + JSON.stringify(got));
    byAct(card(), "order.claim-received", BCLAIM).click(); await p.work.quiet();
    ok(/Already recorded, RM 500\.00\?/.test(sheet().querySelector(".salt-sheet__title").textContent) && /Nothing more is recorded/.test(sheet().textContent), "a claim above what the order owes asks as Received, on the book already");
    byAct(sheet(), "order.ask-go").click(); await p.work.quiet();
    ok(sends("received").length === 2 && sends("received")[1].body.covered === true && sends("received")[1].body.claim === BCLAIM, "and sends covered: " + JSON.stringify(sends("received")[1]));
    byAct(card(), "order.claim-not-found", ACLAIM).click(); await p.work.quiet();
    ok(/Not found RM 30\.00 from CX1-ZED\?/.test(sheet().querySelector(".salt-sheet__title").textContent) && byAct(sheet(), "order.ask-go").classList.contains("salt-ghost--danger") && sends("notfound").length === 0,
      "Not found on an order's claim asks on the Sheet, a danger action, and sends nothing as it opens");
    byAct(sheet(), "order.ask-go").click(); await p.work.quiet();
    const lost = sends("notfound");
    ok(lost.length === 1 && same(Object.keys(lost[0].body).sort(), ["amount", "claim", "rid"]) && lost[0].body.claim === ACLAIM && lost[0].body.amount === 30,
      "and sends the answer it sent, the same route and body: " + JSON.stringify(lost));
    ok(asked.length === 0, "no native confirm was asked on any claim of an order");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
