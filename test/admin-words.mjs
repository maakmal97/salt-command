/* test/admin-words.mjs: SALT ADMIN SPEAKS PLAINLY (Phase 3 of the Salt Admin redesign, 12 Oct 2026; docs/STATEMENTS.md "Salt Admin speaks plainly").
 *
 * The words on the master's page are the redesign glossary's (3a), a refused move is a plain sentence with the server's own words under Details (3b), and a book
 * has no name at all (his word of 12 Oct 2026): its mark stands alone, named to a reader by its shape. Every word lives in stmt/owner.js and the owner-only strings of stmt/page.js, outside stmt/words.js, so
 * the customer's page is untouched. What is proved here, each check red under its own mutation (test/admin-words.mutations.json, run with tools/section.mjs):
 *   1  the glossary's old words are gone from the page the owner is served (comments left out: a comment is not drawn)
 *   2  the helpers print as specified: a day, a moment, a size and a sum
 *   3  the refusal map: each message of the map's source list (Appendix B of the admin map) becomes a plain sentence, or the general one for the plumbing a
 *      person cannot act on, with the server's own words behind Details and the words of the Desk and the Counter beside a figure read as they are composed
 *   4  an unmapped message, and an answer with no reason, still say a sentence and carry Details; a failure of the connection or a sign-in that ended carry none
 *   5  end to end: a read the Desk refused, drawn by the page's own order card, shows the sentence and a Details control that opens the words
 *   6  a tile, a sheet row and a report card heading are the book's mark with a size at most, the shape told to a reader and no word for the book drawn
 *   7  the whole page drawn: no book of ledger/book.json PRODUCTS is named in any word, aria name or title, and no shape word is drawn
 * Drawn by the maker harness (test/maker-act.mjs), whose refuse[route] answers a route as the Counter refuses and whose probe: true leaves window.__owner(code),
 * a test seam that evaluates inside the page script's own scope, so the helpers are called as the page calls them. */
import { FROZEN_BOOK } from "./frozen.mjs";
import { readFileSync } from "node:fs";
import { richOwnerPage, byAct, cardOf, drawEverything } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { OWNER_JS } from "../stmt/owner.js";

/* the glossary's old words, as the page used to say them (a phrase each, none of them a word the glossary kept) */
const OLD_WORDS = [
  "Retained input", "Retained request", "Server-held device entry", "Withdraw server-held entry", "Finish server withdrawal", "Approve trip", "Reject trip", "Reject row",
  "Reject this Desk row?", "Withdraw this uploaded entry?", "Cancel this retry?", "Cancel reply retry", "Open retained reply", "Customer tier", "Customer drift",
  "Printed board sizes", "Appoint existing customer", "Appointment role", "Amend a ledger row", "Revive a cancelled row", "Reward redemption", "Automatic offsets",
  "Borrow or lend", "Cash received (RM)", "Cash recorded (RM)", "Order total (RM)", "Goods total (RM)", "Other payment received (RM)", "Amend goods price (RM)",
  "Amend delivery (RM)", "Amend units", "Amend order", "Close at these units", "Close this order at ", "Decline order", "Confirm received", "Says they sent it",
  "Received, on the book already", "Send trade for review", "Send gift for review", "Send loan for review", "Send repayment for review", "Send offset for review",
  "Send board sizes for review", "Send appointment for review", "Send tier for review", "Send revival for review", "Send amendment for review", "Set temporary override",
  "Clear temporary override", "Save weekly hours", "Read current notice", "Snooze 30 days", "Snooze 7 days", "No Desk rows waiting.", "No open Counter orders.",
  "No account claims waiting.", "No account conversations.", "Refusal source ", "Refused server entry", "Proposed row", "Units moved", "Unlock and view slip",
  "Keep as a quick reply", "Delete the test accounts", "Make the test accounts", "Reading orders…", "Reading rows…", "Reading account claims…", "Sending to the Desk…",
  "The row is rejected and nothing is booked.", "Refused at ", "Ten wrong ", "How they got in", "Code, scanned", "Code, typed", "Code, copied across",
  "Your admin sign-in has ended.", "Order sent to the Desk for acknowledgement.", "Claim confirmation sent to the Desk."
];

/* Appendix B of the admin map, the messages the Counter and the Desk send a refused move: the ones the map turns into a plain sentence, and the plumbing a
   person cannot act on (a shape the page never forms, a timestamp it always sends), which is answered by the general sentence */
const MAPPED = [
  "Say which figure changes.",
  "A size and a price are above nothing.",
  "A reply is 1 to 200 characters.",
  "A reason goes only with Decline or Cancel, up to 140 characters.",
  "Collected or delivered goes only with Ready.",
  "Atomic order storage is unavailable.",
  "The amendment could not be recorded.",
  "Set a weekly schedule, a temporary open/closed override, or clear the override.",
  "Admin access required",
  "The Desk claim list was unreadable.",
  "The Desk claim preview was unreadable.",
  "That claim amount has changed.",
  "The acceptance rows changed. Preview them again.",
  "Their rows owe all of it.",
  "Part of this claim exceeds what the rows owe.",
  "Send only the short map link.",
  "The server-held queue was unreadable.",
  "Not available on an example order.",
  "That claim is not waiting any more.",
  "The order book could not be read.",
  "That request id already names different content.",
  "A trade needs a real date in YYYY-MM-DD.",
  "The Desk mirror is being seeded.",
  "Choose an active product.",
  "Trade figures must be finite, non-negative numbers.",
  "Units must be above zero.",
  "Carriage must be a finite, non-negative number.",
  "Handover is delivered, collected or not stated.",
  "Choose an end buyer on the roster, or leave End customer as Not named. Register a new end buyer under Salt Admin > Add ID first, then pick the code.",
  "Choose a referrer on the roster. Register a new referrer under Salt Admin > Add ID first, then pick the code.",
  "Choose an associate on the roster. Register a new associate under Salt Admin > Add ID first, then pick the code.",
  "Choose R2 or R3.",
  "An attribution needs an associate and its stream.",
  "Register the associate's resale account first.",
  "An R2 sale names its associate as the party.",
  "This product has no inventory cost yet. Record the lot first.",
  "Cover is a choice, never a typed reward figure.",
  "No reward cover is available for this sale. Read the offer again.",
  "A row with this party, date, units and total is already booked. Confirm a separate order.",
  "The booked twin has changed. Read the trade again.",
  "The party's confirmed Add ID is no longer available. Read the catalog again.",
  "Choose one or more extra books, at most one row per book.",
  "Choose each book once.",
  "This request timestamp already carries another entry. Read its draft instead.",
  "The same order is already queued. Read its draft instead.",
  "Choose an associate on the roster.",
  "That offset is not on offer: the reward is spent or held, the order is settled, or it already has a correction waiting.",
  "Choose a customer on the roster, not a resale account.",
  "This book has no Set Price to put a % on.",
  "A supplier has no % on the Set Price.",
  "Choose a % from -30% to +30% (-0.3 to 0.3), or clear it.",
  "Choose an active book.",
  "Choose the sizes to hide from the board.",
  "A size to hide must be one of this book's board sizes.",
  "Every size is unticked, so there is no board to make.",
  "A snooze is a real day, or null to dismiss.",
  "A snooze ends after today and within a year.",
  "Choose a tip the Desk is showing.",
  "Choose a ledger row, amendment kind and real date; identity and raw prose are not input fields.",
  "A cancelled row takes only its revival: cancelled off and its date cleared.",
  "Payment, Receipt and Default are purchase-lot movements.",
  "Choose correctable typed fields; notes and settlement prose stay on Desk.",
  "An order code is up to 16 letters, digits and hyphens.",
  "Correction dates must be real dates.",
  "Correction figures must be finite, non-negative numbers.",
  "Choose a roster code; names and places are not correction values.",
  "Choose a listed stream or handover.",
  "A movement or cancellation carries no row patch.",
  "This row is no longer open.",
  "A payment is cash only, and above zero.",
  "A receipt is units only, and above zero.",
  "A default moves nothing, and a lot that has received units cannot default.",
  "A cancellation moves nothing and cannot cancel goods already handed over.",
  "A fulfilment needs non-negative cash and units, with at least one movement.",
  "The open-order snapshot is unavailable. Reseed the mirror before amending.",
  "The mirror changed or could not be read. Read the row again.",
  "The row's remaining money could not be confirmed.",
  "Choose a roster party, direction, real date and positive amount.",
  "Choose an open loan, real date and positive amount.",
  "That loan is settled or the amount exceeds what remains owing.",
  "Choose a valid book, roster party, date, amount and handover.",
  "This book has no inventory cost yet.",
  "The reward is already spent or reserved by another input awaiting its fold.",
  "There is no whole reward unit available to redeem.",
  "The available reward cannot offset this order.",
  "File the encrypted vault on this device before adding the ID.",
  "That code is already on the roster.",
  "Choose a parent already on the roster.",
  "The map point is outside Malaysia or has invalid locality text.",
  "Only a customer, reseller or referral holds a starting %.",
  "A starting % must name an active book with a Set Price.",
  "A starting % is a number from -0.3 to 0.3 (-30% to +30%).",
  "Each map point must belong to a roster party and remain inside Malaysia.",
  "Set hours or mark closed for each day of the week.",
  "Each day must be closed or have opening and closing times.",
  "Use valid 24-hour times.",
  "A day cannot open and close at the same time.",
  "A day's hours cannot run for more than 24 hours.",
  "Each date must be closed or have opening and closing times.",
  "Keep to 40 dates at a time.",
  "Use a real date for each dated day.",
  "Set dates from today to 90 days ahead.",
  "Choose whether the Counter is open or closed.",
  "Set an end time within the next 14 days.",
];
const GENERAL = [
  "Unsupported order action fields.",
  "Send the action's immutable request id.",
  "Name the claim and its amount.",
  "Send one move: a status, a reply, or No reply needed.",
  "No reply needed is true or absent.",
  "The Desk maker operation failed.",
  "The private Desk maker bridge is not configured.",
  "Send only the replacement order fields.",
  "Close takes an empty object.",
  "Send the claim preview and its immutable action id.",
  "Send a quoted order and its request id, without private fields.",
  "Send only the server-held entry fingerprint.",
  "Invalid queue timestamp.",
  "Draft decisions take an empty object.",
  "Invalid draft timestamp.",
  "Unsupported trade input fields.",
  "A trade needs its canonical request timestamp.",
  "A second order names its booked twin.",
  "An extra book carries only its book, units, goods, cash, movement and booked-twin confirmation.",
  "An offset carries only its timestamp, party code, order row and date.",
  "A tier input carries only its timestamp, code, product and tier.",
  "A tier input needs its canonical request timestamp.",
  "A board input needs its canonical request timestamp.",
  "Hushing carries a tip, its request timestamp and a date or null.",
  "A hush needs its canonical request timestamp.",
  "Correction flags are true or false.",
  "The input needs its canonical request timestamp.",
  "A loan carries only its timestamp, form, direction, product, code, date and amount.",
  "A repayment carries only its timestamp, loan id, date and amount.",
  "A gift carries only its timestamp, book, code, date, units and handover.",
  "A redemption carries only its timestamp, party code and date.",
  "An ID entry carries only codes, role, point, tiers and the encrypted vault envelope.",
  "A resale account has a parent code and no name vault.",
  "A filed address needs an encrypted envelope for a named party.",
  "Amend ID needs its existing code, a free matching code, a point and the encrypted vault envelope.",
  "A placement carries a timestamp and a bounded map of code to point.",
  "File a new address only as the encrypted places envelope.",
  "That input operation is not available.",
];
const GENERAL_SENTENCE = "The Counter could not do that. Try again.";
/* words a person does not say: nothing a mapped sentence says may carry one (19 Oct 2026: patch and finite start a word, so
   "dispatched" and "definitely" are plain English) */
const JARGON = /roster|timestamp|mirror|envelope|canonical|fingerprint|snapshot|immutable|\btier|\bfold|\bseed|\bpatch|vault|\bstream|\bfinite|\bR[23]\b|Add ID|Salt Admin|payload|input\b/i;

/* the sentences the redesign glossary names, and the ones people meet most, exactly */
const NAMED = [
  ["A row with this party, date, units and total is already booked. Confirm a separate order.", "The same sale is already on the book."],
  ["Trade figures must be finite, non-negative numbers.", "Figures cannot be negative."],
  ["Correction figures must be finite, non-negative numbers.", "Figures cannot be negative."],
  ["The acceptance rows changed. Preview them again.", "The rows changed; check them again."],
  ["That claim is not waiting any more.", "That claim is not waiting any more."],
  ["Atomic order storage is unavailable.", "The order book is not available just now. Try again shortly."],
  ["That claim amount has changed.", "That payment changed. Read it again."],
  ["Admin access required", "Only you can do this. Sign in again."],
  ["no such slip", "That slip is no longer held. Slips are kept for 30 days."],
  ["Money is already on its way to this row. Decide it before cancelling.", "Money is already on its way to this row. Decide that first."],
  ["Money is already on its way to this row. Decide it before defaulting it.", "Money is already on its way to this row. Decide that first."],
  ["This row can still take RM 40.00; money already on its way is reserved.", "This row can only take RM 40.00 more."],
  ["This row can still take RM 1,250.50; money already on its way is reserved.", "This row can only take RM 1,250.50 more."]
];

const strip = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/<!--[\s\S]*?-->/g, "");

export async function run({ ok, pageWork }) {
  /* 1. THE OLD WORDS ARE GONE FROM THE PAGE THE OWNER IS SERVED */
  const served = strip(landingPage("", "words-nonce", { master: "fixture-master", accounts: [] }));
  const stillThere = OLD_WORDS.filter((w) => served.includes(w));
  ok(OLD_WORDS.length > 60 && stillThere.length === 0,
    "the glossary's old words are gone from the page the owner is served, " + OLD_WORDS.length + " phrases looked for: " + JSON.stringify(stillThere));

  const p = await richOwnerPage({ pageWork, probe: true });
  try {
    await p.work.quiet();
    const probe = p.w.__owner;
    ok(typeof probe === "function", "the page leaves its test seam, window.__owner, for the helpers and the map");
    const call = (name, ...args) => probe(name)(...args);

    /* 2. THE HELPERS PRINT AS SPECIFIED */
    const fmtWhen = (v) => call("fmtWhen", v), units = (n) => call("units", n), rm = (n) => call("rm", n);
    ok(fmtWhen("2026-10-10") === "10 Oct 2026" && fmtWhen("2026-01-05") === "05 Jan 2026" && fmtWhen("2026-12-31") === "31 Dec 2026",
      "fmtWhen prints a day as DD Mon YYYY and never as the ISO date: " + JSON.stringify([fmtWhen("2026-10-10"), fmtWhen("2026-01-05"), fmtWhen("2026-12-31")]));
    ok(fmtWhen("2026-10-10T07:45:12.000Z") === "10 Oct 2026, 15:45" && fmtWhen("2026-10-10T17:00:00.000Z") === "11 Oct 2026, 01:00",
      "fmtWhen prints a moment in Kuala Lumpur, 24 hours, the day as it falls there (UTC 17:00 is 01:00 the next day): "
      + JSON.stringify([fmtWhen("2026-10-10T07:45:12.000Z"), fmtWhen("2026-10-10T17:00:00.000Z")]));
    ok(fmtWhen("") === "" && fmtWhen(null) === "" && fmtWhen(undefined) === "", "fmtWhen prints nothing for nothing, never a date from zero or the word undefined");
    ok(units(1) === "1 unit" && units(0.5) === "0.5 unit" && units(2.5) === "2.5 units" && units("3") === "3 units" && units(12.5) === "12.5 units" && units(100) === "100 units",
      "units say one unit up to one and units above it (the page's one rule), with the figure first: " + JSON.stringify([units(1), units(0.5), units(2.5), units("3"), units(12.5), units(100)]));
    ok(rm(1234.5) === "RM 1,234.50" && rm(100) === "RM 100.00" && rm(0) === "RM 0.00" && rm(0.5) === "RM 0.50",
      "rm prints the currency first, thousands separated, two places: " + JSON.stringify([rm(1234.5), rm(100), rm(0), rm(0.5)]));

    /* 3. THE REFUSAL MAP */
    const plain = (raw) => call("plainRefusal", raw);
    const bad = [];
    for (const m of MAPPED) { const s = plain(m); if (!s || s === GENERAL_SENTENCE || JARGON.test(s) || /\s$/.test(s) || !/[.?]$/.test(s)) bad.push([m, s]); }
    ok(MAPPED.length > 90 && bad.length === 0,
      "each of the " + MAPPED.length + " messages the map answers becomes a plain sentence of its own, no jargon in it: " + JSON.stringify(bad.slice(0, 3)));
    const general = GENERAL.filter((m) => plain(m) !== GENERAL_SENTENCE);
    ok(GENERAL.length > 30 && general.length === 0,
      "each of the " + GENERAL.length + " plumbing messages a person cannot act on becomes the general sentence, " + JSON.stringify(GENERAL_SENTENCE) + ": " + JSON.stringify(general.slice(0, 3)));
    const wrong = NAMED.filter(([raw, sentence]) => plain(raw) !== sentence).map(([raw]) => [raw, plain(raw)]);
    ok(wrong.length === 0, "the sentences the glossary names, and the ones the Desk composes around a figure, are exactly as written: " + JSON.stringify(wrong));
    /* a refused move is raised as an Error: the plain sentence its message, the server's words .raw, the answer and the status kept */
    const refuseWith = async (answer, status) => {
      const was = p.w.fetch;
      p.w.fetch = async () => ({ ok: false, status, type: "basic", json: async () => answer });
      try { await probe("refs")("/all/maker/orders/x/move", { rid: "r" }); return null; } catch (e) { return e; } finally { p.w.fetch = was; }
    };
    const e1 = await refuseWith({ ok: false, error: "A row with this party, date, units and total is already booked. Confirm a separate order.", twin: { second: "s9" } }, 409);
    ok(!!e1 && e1.message === "The same sale is already on the book." && e1.raw === "A row with this party, date, units and total is already booked. Confirm a separate order."
      && e1.status === 409 && e1.detail && e1.detail.twin && e1.detail.twin.second === "s9",
    "a refused move reaches the code as a plain sentence, with the server's words, the status and the whole answer kept: " + (e1 && JSON.stringify([e1.message, e1.raw, e1.status])));
    const draw = (error) => {
      const node = p.d.createElement("p"); p.d.body.appendChild(node);
      probe("refusal")(node, error);
      return node;
    };
    const n1 = draw(e1), sum = n1.querySelector("details > summary"), raw = n1.querySelector("details > .rraw");
    ok(n1.firstChild.textContent === "The same sale is already on the book." && !!sum && sum.textContent === "Details" && sum.getAttribute("data-act") === "refusal.details"
      && sum.classList.contains("salt-ghost") && !!raw && raw.textContent === e1.raw && n1.querySelector("details").open === false,
    "the sentence is drawn first, then a Details control, shut, that holds the server's own words: " + n1.textContent);
    let every = [];
    for (const m of [...MAPPED, ...GENERAL]) {
      const e = await refuseWith({ ok: false, error: m }, 400), n = draw(e), r = n.querySelector("details > .rraw");
      if (!e || e.message !== plain(m) || e.raw !== m || !r || r.textContent !== m || n.firstChild.textContent !== plain(m) || n.querySelectorAll("details").length !== 1) every.push(m);
    }
    ok(every.length === 0, "all " + (MAPPED.length + GENERAL.length) + " messages are drawn as their sentence with Details holding the original, once each: " + JSON.stringify(every.slice(0, 3)));
    const lead = p.d.createElement("p"); p.d.body.appendChild(lead);
    probe("refusal")(lead, e1, "Not confirmed. ", " Read it again.");
    ok(lead.firstChild.textContent === "Not confirmed. The same sale is already on the book. Read it again." && lead.querySelectorAll("details").length === 1,
      "a line may lead and tail the sentence, and Details still follows it: " + lead.textContent);

    /* 4. AN UNMAPPED MESSAGE, AN ANSWER WITH NO REASON, AND A FAILURE THAT IS NOT A REFUSAL */
    const e2 = await refuseWith({ ok: false, error: "the drafter would not draft it: no floor is known at 12.5 units" }, 409), n2 = draw(e2);
    ok(!!e2 && e2.message === GENERAL_SENTENCE && n2.firstChild.textContent === GENERAL_SENTENCE && n2.querySelector(".rraw").textContent === "the drafter would not draft it: no floor is known at 12.5 units",
      "a message nobody mapped is the general sentence with the server's words behind Details, never nothing: " + n2.textContent);
    const e3 = await refuseWith({}, 500), n3 = draw(e3);
    ok(!!e3 && e3.message === GENERAL_SENTENCE && e3.status === 500 && n3.querySelectorAll("details > .rraw").length === 1 && /500/.test(n3.querySelector(".rraw").textContent),
      "an answer with no reason is still a sentence with Details, saying what the Counter answered: " + n3.textContent);
    const e4 = await refuseWith({ ok: false, error: "" }, 502), e5 = await refuseWith({ ok: false, error: "x" }, 401);
    ok(!!e4 && e4.message === GENERAL_SENTENCE && /502/.test(e4.raw), "an empty reason counts as none");
    const lost = await (async () => {
      const was = p.w.fetch; p.w.fetch = async () => { throw new Error("offline"); };
      try { await probe("refs")("/all/maker/hours"); return null; } catch (e) { return e; } finally { p.w.fetch = was; }
    })();
    const n4 = draw(lost);
    ok(!!lost && /^Not sent[.]/.test(lost.message) && lost.raw === undefined && n4.querySelector("details") === null && n4.textContent === lost.message,
      "a connection that failed is the page's own sentence, with no Details to open: " + n4.textContent);
    ok(!!e5 && e5.message !== "x" && p.d.getElementById("aEnded") && !p.d.getElementById("aEnded").hidden,
      "an ended sign-in is the page's own screen and not a refusal");
  } finally { p.w.close(); }

  /* 5. END TO END: A READ THE DESK REFUSED, ON THE ORDER CARD */
  const q = await richOwnerPage({ pageWork });
  try {
    const { d, work } = q, card = (key) => cardOf(d, key);
    await work.quiet();
    byAct(d, "nav.orders").click(); await work.quiet();
    const type = (control, value) => { control.value = value; control.dispatchEvent(new q.w.Event("input", { bubbles: true })); control.dispatchEvent(new q.w.Event("change", { bubbles: true })); };
    const shown = () => { const s = card("ord-p3").querySelector("[role=status] > details"); return s ? s.parentNode : null; };
    q.refuse["/all/maker/orders/ord-p3/preview"] = "The order book could not be read.";
    type(byAct(card("ord-p3"), "order.total"), "160"); await work.quiet();
    const line = shown();
    ok(!!line && line.firstChild.textContent === "The order book could not be read. Try again." && line.querySelector("[data-act='refusal.details']").textContent === "Details"
      && line.querySelector(".rraw").textContent === "The order book could not be read.",
    "a read the Desk refused is drawn on the order card as the plain sentence with its Details: " + (line ? line.textContent : "nothing drawn"));
    q.refuse["/all/maker/orders/ord-p3/preview"] = "nobody mapped this one";
    type(byAct(card("ord-p3"), "order.total"), "170"); await work.quiet();
    const other = shown();
    ok(!!other && other.firstChild.textContent === GENERAL_SENTENCE && other.querySelector(".rraw").textContent === "nobody mapped this one",
      "an unmapped refusal on the same card is the general sentence with the words under Details: " + (other ? other.textContent : "nothing drawn"));
  } finally { q.w.close(); }

  /* 5b. A NOTE HELD IN STATE (a link that could not be made) IS DRAWN WITH ITS DETAILS TOO, and a fresh tap clears them with the note */
  const s = await richOwnerPage({ pageWork });
  try {
    const { d, work } = s, aopen = () => d.getElementById("aopen");
    await work.quiet();
    byAct(d, "nav.customers").click(); await work.quiet();
    byAct(d, "part.customers.accounts").click(); await work.quiet();
    byAct(d, "acct.open", "abcd-efgh").click(); await work.quiet();
    s.refuse["/all/signin/abcd-efgh"] = "the link maker would not start";
    byAct(aopen(), "acct.signin-link").click(); await work.quiet();
    const made = aopen().querySelector(".anote");
    ok(!!made && made.firstChild.textContent === "Could not make a link: " + GENERAL_SENTENCE && made.querySelectorAll("details > .rraw").length === 1
      && made.querySelector(".rraw").textContent === "the link maker would not start",
    "a link that could not be made says so in a plain sentence on the account card, the server's words under Details: " + (made ? made.textContent : "nothing drawn"));
    delete s.refuse["/all/signin/abcd-efgh"];
    byAct(aopen(), "acct.signin-link").click(); await work.quiet();
    ok(aopen().querySelectorAll(".anote .rraw").length === 0 && byAct(aopen(), "acct.signin-link").textContent === "Share the link",
      "a tap after the refusal makes the link and the old Details go with the old note: " + aopen().querySelector(".anote").textContent);
  } finally { s.w.close(); }

  /* 6. NO BOOK HAS A NAME ON THIS PAGE: A MARK, NAMED TO A READER BY ITS SHAPE (his word of 12 Oct 2026, "and even the name of the product", which took back decision 5 of 11 Oct) */
  const SHAPES = ["Cube", "Droplet", "Lozenge", "Capsule", "Ring"];
  const SHAPE_WORD = new RegExp("\\b(" + SHAPES.join("|") + ")\\b");
  const SIZE = /^[\d.,]+ units?$/, SHAPE_SIZE = new RegExp("^(" + SHAPES.join("|") + ") [\\d.,]+ units?$");
  ok(!SHAPE_WORD.test(strip(OWNER_JS)) && !/\bbook(Name|Head)\b/.test(strip(OWNER_JS)),
    "Salt Admin's own script holds none of the shape words and none of the helpers that named a book (bookName, bookHead)");
  const customerPage = strip(landingPage("", "words-nonce")), mtileSrc = customerPage.match(/function mtile[\s\S]*?\n  \}/);
  ok(!!mtileSrc && !customerPage.includes("function bookTile") && !/pshape\(product\)\+', '/.test(mtileSrc[0]),
    "the customer's page carries none of Salt Admin's book helpers, and its tile caption is the size alone");
  const b = await richOwnerPage({ pageWork, assocAnswer: (j) => ({ ...j, products: [{ product: "oil", name: "oil", rows: [] }, { product: "salt", name: "salt", rows: [] }] }) });
  try {
    const { d, work } = b;
    await work.quiet();
    byAct(d, "nav.orders").click(); await work.quiet();
    const tiles = [...d.querySelectorAll(".mtile")];
    const seen = (t) => t.textContent.replace(t.querySelector(".sr")?.textContent || "", "");
    /* 18 Oct 2026 (clarity, part 3): a ROW's tile says the size once, in its caption, so its reader line is the shape alone and the caption is not hidden from a reader */
    const rowTile = (t) => !!t.closest(".ordrow"), SHAPE_ONLY = new RegExp("^(" + SHAPES.join("|") + ")$");
    const wrong = tiles.filter((t) => !SIZE.test(t.querySelector(".mq")?.textContent || "") || !(rowTile(t) ? SHAPE_ONLY : SHAPE_SIZE).test(t.querySelector(".sr")?.textContent || "") || !t.querySelector("svg.psym")
      || t.querySelector(".mq")?.getAttribute("aria-hidden") !== (rowTile(t) ? null : "true") || SHAPE_WORD.test(seen(t)) || /[a-z]{3,}/i.test(seen(t).replace(/units?/g, ""))).map((t) => t.textContent);
    ok(tiles.length >= 4 && wrong.length === 0,
      "each order tile on Orders is the book's mark with its size beneath, 2 units, no word for the book and no shape word, and a reader is told the shape and the size: " + tiles.length + " tiles; " + JSON.stringify(wrong.slice(0, 2)));
    byAct(d, "nav.orders").click(); await work.quiet();
    byAct(d, "part.orders.approve").click(); await work.quiet();
    byAct(d.querySelector('#makerDrafts [data-maker-card="draft:d-2"]'), "draft.approve").click(); await work.quiet();
    const sheet = [...d.querySelectorAll(".salt-sheet .mtile")].map((t) => [t.querySelector(".mq")?.textContent, (t.querySelector(".sr")?.textContent || "").split(" ")[0]]);
    ok(sheet.length === 2 && sheet.every((s) => s[0] === "1 unit" && SHAPES.includes(s[1])) && new Set(sheet.map((s) => s[1])).size === 2,
      "the sheet that asks on a trip draws each of its rows as a mark with 1 unit beneath, and a reader hears a different shape for each: " + JSON.stringify(sheet));
    byAct(d, "ask.keep").click(); await work.quiet();
    byAct(d, "nav.customers").click(); await work.quiet();
    byAct(d, "part.customers.associates").click(); await work.quiet();
    const heads = [...d.querySelectorAll("#clist h2")].map((h) => [h.className, SHAPES.includes(h.getAttribute("aria-label")), h.querySelector("svg.psym") ? "mark" : "", h.textContent, h.querySelector(".pshape") ? "word" : ""]);
    ok(heads.length === 2 && heads.every((h) => h[0] === "pmark" && h[1] && h[2] === "mark" && h[3].replace(/[^a-z]/gi, "").length <= 1 && h[4] === "")
      && new Set([...d.querySelectorAll("#clist h2")].map((h) => h.getAttribute("aria-label"))).size === 2,
    "the report card's book headings are the mark alone, named by their shape to a reader and by no word for the book: " + JSON.stringify(heads));
  } finally { b.w.close(); }

  /* 7. THE WHOLE PAGE, DRAWN: NO BOOK NAME IN ANY WORD, ARIA NAME OR TITLE, AND NO SHAPE WORD DRAWN (his word of 12 Oct 2026). The names are read off the book (ledger/book.json PRODUCTS),
     so a sixth book is held to it unasked; "Salt Admin", "Salt Counter" and the like are the apps' own names and are let through */
  const BOOKS_OF = JSON.parse(readFileSync(FROZEN_BOOK, "utf8")).PRODUCTS;
  const BOOK_NAMES = [...new Set(Object.entries(BOOKS_OF).flatMap(([k, v]) => [k, v.name]))].filter(Boolean);
  const BOOK_NAMED = new RegExp("\\b(" + BOOK_NAMES.join("|") + ")\\b(?!\\s+(?:account|admin|counter|command|desk)\\b)", "i");
  const drawnWords = (root) => {
    const out = [], walk = root.ownerDocument.createTreeWalker(root, 4);
    while (walk.nextNode()) { const n = walk.currentNode, par = n.parentElement; if (par && !/^(SCRIPT|STYLE)$/.test(par.nodeName) && !par.closest("svg") && n.nodeValue.trim()) out.push([n.nodeValue.trim(), !!par.closest(".sr")]); }
    root.querySelectorAll("[aria-label],[title],[placeholder],[alt]").forEach((e) => ["aria-label", "title", "placeholder", "alt"].forEach((a) => { if (e.getAttribute(a)) out.push([e.getAttribute(a), a === "aria-label"]); }));
    return out;
  };
  /* the Desk's own sentences name a book (src/drafter.js composes them, and the Desk keeps its words): a flag, a reason and a refusal here do, as they arrive */
  const deskSpeaks = (j) => ({ ...j, drafts: j.drafts.map((x) => ({ ...x, flags: ["Salt is cheaper than its floor.", "Check the rice and the oil rows. The row carries RM 5/unit of cost from its old product. candy costs RM 46/unit, quoted."],
    reasoning: "A sale of Candy, priced like salt." })), refused: [{ why: "Rice has no cost on the book." }] });
  const all = await richOwnerPage({ pageWork, slip: true, probe: true, review: deskSpeaks, assocAnswer: (j) => ({ ...j, products: Object.keys(BOOKS_OF).map((k) => ({ product: k, name: BOOKS_OF[k].name, rows: [] })) }) });
  try {
    await drawEverything(all);
    const seenWords = drawnWords(all.d.body);
    const named = seenWords.filter(([t]) => BOOK_NAMED.test(t)).map(([t]) => t.slice(0, 80));
    const shaped = seenWords.filter(([t, hidden]) => !hidden && SHAPE_WORD.test(t)).map(([t]) => t.slice(0, 80));
    ok(seenWords.length > 400 && named.length === 0,
      "no book is named anywhere on Salt Admin, drawn text, aria names and titles included (" + BOOK_NAMES.join(", ") + "): " + seenWords.length + " words read; " + JSON.stringify(named.slice(0, 5)));
    /* the Sheets that ask restate a row with its book's tile, and they go when they are answered, so each is read while it is open: an order's Cancel and a trip's Approve */
    const sheets = [];
    const asked = async (open, keep) => { open(); await all.work.quiet(); const sh = all.d.getElementById("ynSheet"); sheets.push([sh.querySelectorAll(".mtile").length, drawnWords(sh)]); byAct(all.d, keep).click(); await all.work.quiet(); };
    byAct(all.d, "nav.orders").click(); await all.work.quiet();
    await asked(() => byAct(cardOf(all.d, "ord-r1"), "order.cancel").click(), "order.ask-keep");
    byAct(all.d, "nav.orders").click(); byAct(all.d, "part.orders.approve").click(); await all.work.quiet();
    await asked(() => byAct(all.d.querySelector('#makerDrafts [data-maker-card="draft:d-2"]'), "draft.approve").click(), "ask.keep");
    ok(sheets.length === 2 && sheets.every(([tiles, said]) => tiles >= 1 && said.length > 3 && !said.some(([t]) => BOOK_NAMED.test(t))) && !sheets.flatMap(([, said]) => said).some(([t, hidden]) => !hidden && SHAPE_WORD.test(t)),
      "the Sheets that ask draw a tile for the order or the rows they restate, and name no book and draw no shape word while they are open: " + JSON.stringify(sheets.map(([tiles, said]) => [tiles, said.length])));
    const noBook = all.w.__owner("noBook");
    ok(noBook("Salt is cheaper than its floor.") === "The book is cheaper than its floor." && noBook("old product. candy costs RM 46/unit") === "old product. The book costs RM 46/unit"
      && noBook("Check the rice and the OIL rows") === "Check the book and the book rows" && noBook("Salt Admin and the Salt Counter") === "Salt Admin and the Salt Counter" && noBook("price, spared, ricer") === "price, spared, ricer"
      && seenWords.some(([t]) => / old product[.] The book costs RM 46[/]unit, quoted[.]$/.test(t)) && seenWords.some(([t]) => /^A sale of the book, priced like the book[.]$/.test(t)),
    "a sentence the Desk wrote names its book as 'the book', whole words only, the apps' own names left alone, and the Approve card draws it so: " + JSON.stringify(seenWords.map(([t]) => t).filter((t) => /book/.test(t) && /cost|sale of|cheaper/.test(t)).slice(0, 4)));
    ok(shaped.length === 0 && all.d.querySelectorAll(".mtile").length > 0 && seenWords.some(([t, hidden]) => hidden && SHAPE_WORD.test(t)),
      "no shape word is drawn on Salt Admin, while a reader is still told the shape: " + JSON.stringify(shaped.slice(0, 5)));
    ok(BOOK_NAMES.length >= 5 && BOOK_NAMED.test("Candy, 2 units") && BOOK_NAMED.test("the rice") && !BOOK_NAMED.test("Salt Admin") && !BOOK_NAMED.test("a price of 5"),
      "the scan itself reads the book's names as whole words and lets the apps' own names through: " + BOOK_NAMES.join(", "));
  } finally { all.w.close(); }
}
