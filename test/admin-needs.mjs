/* test/admin-needs.mjs: NEEDS YOU, THE RANKED INBOX (11 Oct 2026, Phase 1b; docs/STATEMENTS.md "His places").
 *
 * Every thing that waits on him is a card on the system's Action recipe, ranked Now, Soon, Watch and oldest first in each, read again every 30
 * seconds while it is showing. What is proved here, each check red under its own mutation (test/admin-needs.mutations.json):
 *   1  the cards: which kind of thing is in which severity, with its kind word, who, what, age and Open
 *   2  the ranking: Now before Soon before Watch, the oldest first, a practice item after the real ones
 *   3  practice items: labelled, and counted nowhere, in the line under the title and on both bars
 *   4  the counts on every bar item, on the rail and on the app bar alike
 *   5  Open: each kind goes to its own place and part, and opens the thing it is about
 *   6  the one filled pill: only where the page already has that exact action as one tap, through the same function and the same question;
 *      no card in Needs you books money
 *   7  the kind chips: filters only, reading nothing
 *   8  a read that failed is said, never taken for nothing waiting
 *   9  the 30-second read: only while Needs you or Orders shows and the page is visible, no read twice at once, nothing drawn when nothing
 *      changed, a part he has begun on left alone, a tap in flight kept
 * Drawn by the maker harness (test/maker-act.mjs), whose hooks change what each read answers. */
import { richOwnerPage, byAct, cardOf } from "./maker-act.mjs";
import { SITE_RECIPES } from "../stmt/statement-css.js";

const U1 = "abcd-efgh", U2 = "jkmn-pqrs", U3 = "tvwx-yz23", U4 = "4567-89ab", PRACTICE = "0000-0000";
const NOW = Date.now(), ago = (h) => new Date(NOW - h * 3600000).toISOString();
/* the page says a moment today by its time and any other by its day, in Kuala Lumpur (owner.js when()), so what an age reads depends on the hour the suite runs */
const klDay = (iso) => new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 10);
const MADE_20H = klDay(ago(20)) === klDay(new Date(NOW).toISOString()) ? /^guest link, made \d\d:\d\d$/ : /^guest link, made \d\d \w{3} \d{4}$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ROUTES = { review: "/all/maker/review", claims: "/all/maker/claims", threads: "/all/maker/threads", hours: "/all/maker/hours", bulletin: "/all/maker/bulletin",
  sheet: "/all/sheet", links: "/all/refs", pools: "/all/maker/pools", inputs: "/all/maker/inputs" };

/* a busy day, with ages: what the harness would answer, given an age to each thing and a practice account's orders, claim and thread as well */
function busyDay(state) {
  return {
    review: (j) => {
      const age = { "ord-p1": 5, "ord-p2": 1, "ord-p3": 26, "ord-p4": 3 };
      for (const o of j.orders) if (age[o.id]) o.at = ago(age[o.id]);
      j.orders.find((o) => o.id === "ord-a1").payments.forEach((x, i) => { x.at = ago(9 - i); });
      j.orders.push({ id: "ex-1", u: PRACTICE, status: "placed", mode: "collect", qty: 1, total: 100, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [],
        history: [], test: true, at: ago(40) });
      if (state.newOrder) j.orders.push(state.newOrder);
      j.drafts[0].id = ago(6); j.drafts[1].id = ago(3); j.drafts[2].id = ago(1);
      j.drafts.push({ ...j.drafts[0], id: ago(0.5), entry: { type: "SELL", party: "CX1-ZED", date: "2026-10-10", claim: { id: "c-1" } } });
      j.drafts = j.drafts.filter((d) => !state.approved.has(d.id));
      return j;
    },
    claims: (j) => {
      j.claims[0].at = ago(7); j.claims[1].at = ago(2);
      j.claims.push({ id: "c-x", u: PRACTICE, amount: 10, state: "waiting", test: true, at: ago(50) });
      return j;
    },
    threads: (j) => {
      j.threads[0].msgs[0].at = ago(4);
      j.threads.push({ u: PRACTICE, test: true, quiet: null, msgs: [{ by: "customer", at: ago(60), text: "Practice hello" }] });
      return j;
    },
    hours: (j) => { j.config.manual = { open: false, until: "2026-10-16T10:00:00.000Z" }; j.status = { open: false, source: "manual" }; return j; },
    sheetAnswer: (j) => {
      j.accounts.find((a) => a.username === U3).locked = { from: 2, until: new Date(NOW + 10 * 60000).toISOString() };
      j.accounts.find((a) => a.username === U4).issued = ago(100).slice(0, 10);
      return j;
    },
    linksAnswer: (j) => { j.refs.find((r) => r.id === "w1").made = ago(20); return j; }
  };
}
const NOW_KEYS = ["o:ord-p3", "p:ord-a1", "c:" + U1 + ":c-1", "o:ord-p1", "m:" + U1, "o:ord-p4", "c:" + U1 + ":c-2", "o:ord-p2", "k:" + U3,
  "m:" + PRACTICE, "c:" + PRACTICE + ":c-x", "o:ex-1"];
const WATCH_KEYS = ["w:desk", "w:hours", "w:notice"];
/* the loan the harness keeps unsent on this phone is a Soon card too (Phase 4c), between the accounts not sent and the guest link by its age */
const UNSENT = "u:/all/maker/inputs/loan";

const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };

export async function run({ ok, pageWork }) {
  const open = async (state, extra = {}) => {
    const p = await richOwnerPage({ pageWork, ...busyDay(state), ...extra });
    await p.work.quiet();
    const d = p.d;
    p.cards = () => [...d.querySelectorAll("#nlist [data-need]")];
    p.card = (k) => d.querySelector('#nlist [data-need="' + k + '"]');
    p.keys = (sev) => p.cards().filter((c) => c.getAttribute("data-sev") === sev).map((c) => c.getAttribute("data-need"));
    /* what a card says is the words after its book's mark (the mark is a .pwith: the drawing, and the shape told to a reader), so the book is read as the mark it draws and never as a word */
    p.words = (c) => { const w = c.querySelector(".need-what"), rest = w ? w.cloneNode(true) : null, mark = w ? w.querySelector(".pwith") : null;
      if (rest) rest.querySelectorAll(".pwith").forEach((m) => m.remove());
      return { kind: c.querySelector(".salt-action__kind").textContent, who: c.querySelector(".need-who").textContent, what: rest ? rest.textContent.trim() : "",
        mark: mark && mark.querySelector("svg.psym") ? (mark.querySelector(".sr") || { textContent: "" }).textContent : "", age: c.querySelector(".salt-action__money").textContent }; };
    p.buttons = (c) => [...c.querySelectorAll("button:not(.need-tap)")].map((b) => b.textContent);
    p.counts = (bar) => Object.fromEntries([...d.querySelectorAll(bar + " [data-count]")].map((e) => [e.getAttribute("data-count"), e.textContent]));
    p.tap = async (act, key) => { const c = byAct(d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.where = () => {
      const place = (d.querySelector('.salt-appbar .place[aria-current="page"]') || { getAttribute: () => "" }).getAttribute("data-m");
      const strip = d.querySelector('.aparts[data-place="' + place + '"]');
      const part = strip && (strip.querySelector('[aria-selected="true"]') || { getAttribute: () => "" }).getAttribute("data-part");
      return place + (part ? "/" + part : "");
    };
    /* the 30-second read, as the page set it: the one live interval of that length */
    p.live = () => p.intervals.filter((i) => i.ms === 30000 && !i.off);
    p.tick = async () => { const t = p.live()[0]; if (t) t.f(); await p.work.quiet(); return !!t; };
    p.hide = (on) => { Object.defineProperty(d, "hidden", { configurable: true, get: () => on }); d.dispatchEvent(new p.w.Event("visibilitychange")); };
    return p;
  };
  const state = () => ({ approved: new Set(), newOrder: null });

  /* 1. THE CARDS */
  let p = await open(state());
  try {
    const d = p.d;
    ok(same(p.keys("now"), NOW_KEYS) && same(p.keys("soon").slice(0, 3), ["s", UNSENT, "l:w1"]) && same(p.keys("watch"), WATCH_KEYS),
      "an order placed, a payment they say they sent, a message asked and a locked account are Now, the guest link and the accounts not sent Soon, and the Desk's line, "
      + "an override and a notice Watch: " + JSON.stringify([p.keys("now"), p.keys("soon"), p.keys("watch")]));
    ok(p.cards().every((c) => c.classList.contains("salt-action") && c.classList.contains("salt-action--" + c.getAttribute("data-sev"))
      && c.querySelector(".salt-action__kind") && c.querySelector(".need-who") && c.querySelector(".salt-action__money")),
    "every card is the system's Action recipe, coloured by its severity, with its kind word, who and age");
    const order = p.words(p.card("o:ord-p3")), pay = p.words(p.card("p:ord-a1")), claim = p.words(p.card("c:" + U1 + ":c-1")), msg = p.words(p.card("m:" + U1)), lock = p.words(p.card("k:" + U3));
    ok(order.kind === "Order" && order.who === "CX1-ZED" && order.what === "1 unit, RM 100.00" && /^(Cube|Droplet|Lozenge|Capsule|Ring)$/.test(order.mark) && order.age === "26 h",
      "a placed order says Order, who by code, what (the book's mark, units, RM, and no word for the book) and its age in hours: " + JSON.stringify(order));
    ok(pay.kind === "Payment" && pay.what === "says they paid RM 530.00" && pay.age === "9 h" && claim.kind === "Payment" && claim.what === "says they paid RM 50.00" && claim.age === "7 h",
      "a payment they say they sent, on an order (the sum, the oldest) or against the account, says Payment: " + JSON.stringify([pay, claim]));
    ok(msg.kind === "Message" && msg.who === "CX1-ZED" && msg.what === "Hello" && msg.age === "4 h" && lock.kind === "Locked" && /^locked out until \d\d:\d\d$/.test(lock.what) && lock.age === "5 min",
      "a message asked carries their words, a locked account the addresses refused and its age: " + JSON.stringify([msg, lock]));
    const row = p.words(p.card("d:" + ago(6))), link = p.words(p.card("l:w1"));
    ok(row.kind === "Row" && row.who === "CX1-ZED" && row.what === "Sale, 1 unit, RM 100.00" && /^(Cube|Droplet|Lozenge|Capsule|Ring)$/.test(row.mark) && row.age === "6 h" && link.kind === "Link" && MADE_20H.test(link.what) && link.age === "20 h",
      "a Desk row to approve is Soon, with its party, what and age, and so is a guest link: " + JSON.stringify([row, link]));
    ok(p.card("x:0") && p.card("q:q-2") && p.card("q:q-1") === null && p.card("x:0").getAttribute("data-sev") === "soon" && /Refused for the fixture/.test(p.card("x:0").textContent)
      && p.card("q:q-2").getAttribute("data-kind") === "rows" && p.card("a:ord-a2") && p.card("a:ord-a2").getAttribute("data-sev") === "soon",
    "an entry that did not get through (the drafter's refusal, a refused server entry, not a held one) and a stage he rejected are Soon");
    ok(/The Desk shows 2 for you, as of/.test(p.card("w:desk").textContent) && /Closed until Fri 18:00/.test(p.card("w:hours").textContent) && /Open late/.test(p.card("w:notice").textContent),
      "Watch says what the Desk counts, \"Closed until Fri 18:00\" for the override in force, and the notice set");

    /* 2. THE RANKING */
    const order2 = p.cards().map((c) => c.getAttribute("data-sev"));
    const sevOrder = ["now", "soon", "watch"];
    ok(order2.every((s, i) => i === 0 || sevOrder.indexOf(order2[i - 1]) <= sevOrder.indexOf(s)),
      "Now comes before Soon and Soon before Watch: " + JSON.stringify(order2));
    ok(same(p.keys("now"), NOW_KEYS), "within Now the oldest comes first, and the practice items after the real ones: " + JSON.stringify(p.keys("now")));
    ok(same(p.keys("soon"), ["s", UNSENT, "l:w1", "d:" + ago(6), "d:" + ago(3), "d:" + ago(1), "d:" + ago(0.5), "a:ord-a2", "a:ord-x1", "x:0", "q:q-2", "n:" + U2]),
      "within Soon the oldest first, and what has no age after what has one: " + JSON.stringify(p.keys("soon")));
    ok([...d.querySelectorAll("#nlist .nsev")].map((h) => h.textContent.replace(/ . \d+$/, "")).join() === "Now,Soon,Watch", "each severity is headed by its word");

    /* 3. PRACTICE */
    const practice = p.cards().filter((c) => c.hasAttribute("data-practice"));
    ok(same(practice.map((c) => c.getAttribute("data-need")), ["m:" + PRACTICE, "c:" + PRACTICE + ":c-x", "o:ex-1"])
      && practice.every((c) => /Practice/.test(c.querySelector(".need-who").parentElement.textContent)) && !p.card("o:ord-p1").hasAttribute("data-practice"),
    "an item of a practice account is drawn, labelled Practice, and no other is");
    const real = p.cards().filter((c) => !c.hasAttribute("data-practice"));
    const nowReal = real.filter((c) => c.getAttribute("data-sev") === "now").length, soonReal = real.filter((c) => c.getAttribute("data-sev") === "soon").length;
    ok(nowReal === 9 && new RegExp("^" + nowReal + " now, " + soonReal + " soon, as at [0-9]{2}:[0-9]{2}[.]$").test(d.getElementById("nCount").textContent),
      "the line under the title counts the real Now and Soon and no practice item: " + d.getElementById("nCount").textContent);

    /* 4. THE COUNTS ON THE BARS */
    const rail = p.counts(".salt-rail"), bar = p.counts(".salt-appbar");
    ok(same(rail, { needs: "9", orders: "9", customers: "2", record: "4", shop: "" }) && same(rail, bar),
      "Needs you counts what is Now, Orders what waits on him there (orders and claims), Customers the threads asked and the links waiting, Record the rows waiting, "
      + "Shop none, the same on the rail and on the bar, and no practice item in any: " + JSON.stringify([rail, bar]));

    /* 5. OPEN */
    const open1 = async (key, where, then) => {
      const was = byAct(d, "nav.needs"); was.click(); await p.work.quiet();
      const b = byAct(d, "need.open", key);
      if (!b) return "no Open on " + key;
      b.click(); await p.work.quiet();
      const got = p.where(); if (got !== where) return key + " went to " + got + " not " + where;
      return then ? then() : "";
    };
    const opens = [
      await open1("o:ord-p1", "orders/placed"), await open1("p:ord-a1", "orders/confirmed"), await open1("c:" + U1 + ":c-1", "orders/payments"),
      await open1("m:" + U1, "customers/messages", () => (shown(d.getElementById("makerChatOpen")) && d.getElementById("makerChatOpen").getAttribute("data-key") === U1 ? "" : "the thread was not opened")),
      await open1("k:" + U3, "customers/accounts", () => (shown(d.getElementById("aopen")) && /CX3-ZED/.test(d.getElementById("aopen").textContent) ? "" : "the account was not opened")),
      await open1("d:" + ago(6), "record/approve"), await open1("x:0", "record/approve"), await open1("l:w1", "customers/links"),
      await open1("s", "customers/accounts", () => (byAct(d, "filter.unsent") || d.querySelector('#afil [data-f="unsent"]')).getAttribute("aria-pressed") === "true" ? "" : "the Not sent filter was not set"),
      await open1("w:hours", "shop/hours"), await open1("w:notice", "shop/notice")
    ].filter(Boolean);
    ok(opens.length === 0, "Open goes to the place and part of its kind, and opens the thing it is about: " + JSON.stringify(opens));
    byAct(d, "nav.needs").click(); await p.work.quiet();
    ok(p.cards().filter((c) => !byAct(c, "need.open")).map((c) => c.getAttribute("data-need")).join() === "w:desk",
      "every card but the Desk's own line has an Open");

    /* 6. THE ONE FILLED PILL */
    const pills = (c) => [...c.querySelectorAll(".salt-pill")].map((b) => b.textContent);
    const money = /Agree|Accept|Received|Cash|Yes received|Pay/i;
    ok(p.cards().filter((c) => ["orders", "payments", "messages"].includes(c.getAttribute("data-kind"))).every((c) => same(p.buttons(c), [])),
      "no order, payment or message card has any control of its own, only the tap, so nothing is booked from Needs you");
    ok(!p.cards().some((c) => p.buttons(c).some((t) => money.test(t))), "and no card of any kind carries Agree, Accept, Received or Cash");
    ok(same(pills(p.card("d:" + ago(6))), ["Approve"]) && same(pills(p.card("d:" + ago(3))), ["Approve both"]) && pills(p.card("d:" + ago(0.5))).length === 0
      && /Answer this through the payment card/.test(p.card("d:" + ago(0.5)).textContent),
    "a Desk row has Approve row (Approve trip when it rides one) and a customer's claim row none, as on Record > Approve");
    ok(same(pills(p.card("l:w1")), ["Approve"]) && same(pills(p.card("k:" + U3)), ["Send a sign-in link"]) && same(pills(p.card("s")), ["Send sign-in links one by one"]),
      "the guest link, the refused account and the accounts not sent keep the one filled action they had");
    ok(p.cards().every((c) => pills(c).length <= 1), "no card has more than one filled pill");
    ok(p.cards().every((c) => c.classList.contains("need--act") === (p.buttons(c).length > 0)),
      "a card with an action of its own sets its ways on a row under the body (need--act), and one with none has no go row");
    /* 14 Oct 2026: THE CARD IS THE TAP, Soon and Watch are folded, the chips are the kinds present */
    ok(p.cards().every((c) => !p.buttons(c).includes("Open") && !c.querySelector(".salt-action__go .salt-ghost--open")) && !d.querySelector("#nlist button[data-act='need.open']:not(.need-tap)")
      && p.cards().filter((c) => byAct(c, "need.open")).every((c) => c.querySelector("button.need-tap.salt-action__title") && c.querySelector(".need-tap .need-who")),
    "a card has no Open button: its title is the one tap (data-act need.open), and the card's own actions stay beside it");
    const folds = [...d.querySelectorAll("#nlist > details.nfold")];
    ok(same(folds.map((f) => f.getAttribute("data-sev")), ["soon", "watch"]) && folds.every((f) => !f.open && f.querySelector("summary.nsev") && /^\w+ . \d+$/.test(f.querySelector("summary").textContent))
      && same(folds.map((f) => f.querySelectorAll("[data-need]").length), [p.keys("soon").length, p.keys("watch").length]) && !d.querySelector("#nlist > [data-need]:not([data-sev=now])"),
    "Soon and Watch are folded by default behind a heading with their count, Now stands open: " + JSON.stringify(folds.map((f) => [f.open, f.querySelector("summary").textContent])));
    folds[0].open = true; folds[0].dispatchEvent(new p.w.Event("toggle")); await p.tap("need.kind.all");
    ok(d.querySelector('#nlist > details[data-sev="soon"]').open, "a fold he opened stays open through a redraw");
  } finally { p.w.close(); }

  /* 6b. THE PILL IS THE RECORD BUTTON'S, THE SAME QUESTION AND THE SAME REQUEST */
  const st = state();
  p = await open(st);
  try {
    /* 12 Oct 2026 (Phase 2c, his decision 4 of 11 Oct): the question is the page's Sheet, not a native confirm, and it is the same Sheet from either control */
    const d = p.d, id = ago(6), sheet = () => d.getElementById("ynSheet");
    const question = () => (sheet() ? sheet().querySelector(".salt-sheet__title").textContent + " | " + [...sheet().querySelectorAll(".salt-sheet__body > *")].map((e) => e.textContent).join(" | ") : null);
    byAct(p.card("d:" + id), "need.approve-row").click(); await p.work.quiet();
    const needAsked = question();
    ok(!!needAsked && /^Approve this row?/.test(needAsked) && p.posts.filter((x) => /approve$/.test(x.route)).length === 0, "he is asked first, on the page's Sheet, and nothing is sent as it opens: " + needAsked);
    byAct(sheet(), "ask.keep").click(); await p.work.quiet();
    ok(!sheet() && p.posts.filter((x) => /approve$/.test(x.route)).length === 0, "declining sends nothing");
    byAct(d, "nav.record").click(); await p.work.quiet();
    const recordButton = [...d.querySelectorAll('#makerDrafts [data-maker-card="draft:' + id + '"] [data-act="draft.approve"]')][0];
    recordButton.click(); await p.work.quiet();
    ok(!!needAsked && same(needAsked, question()), "Record > Approve asks the very same question: " + JSON.stringify([needAsked, question()]));
    byAct(sheet(), "ask.keep").click(); await p.work.quiet();
    byAct(d, "nav.needs").click(); await p.work.quiet();
    const release = p.hold("/all/maker/drafts/" + encodeURIComponent(id) + "/approve");
    byAct(p.card("d:" + id), "need.approve-row").click(); await p.work.quiet();
    byAct(sheet(), "ask.go").click();
    for (let i = 0; i < 100 && !p.work.inFlight(); i++) await new Promise((r) => setTimeout(r, 5));
    ok(p.posts.filter((x) => /approve$/.test(x.route)).length === 1 && p.posts.find((x) => /approve$/.test(x.route)).route === "/all/maker/drafts/" + encodeURIComponent(id) + "/approve"
      && same(p.posts.find((x) => /approve$/.test(x.route)).body, {}), "his yes sends the one request Record > Approve sends: the same route and an empty body");
    ok(byAct(p.card("d:" + id), "need.approve-row").disabled, "while it is out the pill is off");
    byAct(p.card("d:" + id), "need.approve-row").click();
    ok(p.posts.filter((x) => /approve$/.test(x.route)).length === 1, "and a second tap sends nothing");
    st.approved.add(id); release(); await p.work.quiet();
    const done = p.card("d:" + id);
    ok(done && /Row approved[.]/.test(done.textContent) && !done.querySelector(".salt-pill") && done.getAttribute("data-sev") === "soon",
      "the answer stays on the card he tapped, though the row is no longer there: " + (done && done.textContent));
    ok(/^9 now, 11 soon/.test(d.getElementById("nCount").textContent) && p.counts(".salt-rail").record === "3",
      "and the row is no longer counted: " + d.getElementById("nCount").textContent);
    byAct(d, "nav.customers").click(); await p.work.quiet();
    byAct(d, "nav.needs").click(); await p.work.quiet();
    ok(!p.card("d:" + id), "the answer goes when he leaves Needs you");
  } finally { p.w.close(); }

  /* 7. THE KIND CHIPS */
  p = await open(state());
  try {
    const d = p.d, chips = [...d.querySelectorAll(".nchips button")];
    ok(chips.map((b) => b.textContent).join() === "All,Orders,Payments,Messages,Rows,Accounts" && chips.every((b) => b.getAttribute("data-act") && b.classList.contains("salt-tabs__pill") && b.getAttribute("role") === "tab")
      && chips[0].getAttribute("aria-selected") === "true" && d.querySelector(".nchips").classList.contains("salt-tabs") && d.querySelector(".nchips").getAttribute("role") === "tablist",
    "the chips are All, Orders, Payments, Messages, Rows and Accounts, drawn as the parts strip is, a tablist of tabs of the system's pill, each with its act, All selected");
    p.reads.length = 0;
    const KO = ["all", "orders", "payments", "messages", "rows", "accounts"], visible = (dd) => [...dd.querySelectorAll(".nchips button")].filter((b) => !b.hidden).map((b) => b.getAttribute("data-chip"));
    ok(same(visible(d), KO), "with a card of every kind, every chip is drawn: " + visible(d));
    const kinds = {};
    for (const k of ["orders", "payments", "messages", "rows", "accounts"]) {
      await p.tap("need.kind." + k);
      kinds[k] = [...new Set(p.cards().map((c) => c.getAttribute("data-kind")))].join();
      if (kinds[k] !== k) kinds[k] = "BAD " + kinds[k];
    }
    ok(Object.values(kinds).every((v) => !v.startsWith("BAD")), "each chip shows its own kind of card and no other: " + JSON.stringify(kinds));
    ok(p.reads.length === 0 && p.posts.length === 0, "and filtering reads and sends nothing: " + JSON.stringify(p.reads));
    await p.tap("need.kind.rows");
    ok([...d.querySelectorAll(".nchips button")].map((b) => b.getAttribute("aria-selected")).join() === "false,false,false,false,true,false", "the chip he tapped is the one marked");
    /* the recipe draws a selected pill from aria-selected alone (aria-pressed is a ghost's), so the mark is only as good as that selector */
    const SELECTED = '.salt-tabs__pill[aria-selected="true"]';
    ok(SITE_RECIPES.includes(SELECTED + " {") && same([...d.querySelectorAll(".nchips button")].filter((b) => b.matches(SELECTED)).map((b) => b.getAttribute("data-chip")), ["rows"]),
      "and it alone matches the selector the system's tabs are drawn selected by, so it looks different from the other five");
    await p.tap("need.kind.all");
    ok(p.cards().length === 12 + 12 + 3, "All shows every card again, Watch among them: " + p.cards().length);
    await p.tap("need.kind.orders");
    ok(!p.cards().some((c) => c.getAttribute("data-sev") === "watch") && same(p.counts(".salt-rail").needs, "9"), "Watch shows under All only, and a filter changes no count");
  } finally { p.w.close(); }

  /* 7b. A CHIP IS DRAWN ONLY FOR A KIND THAT IS PRESENT */
  p = await open(state(), { threads: (j) => { j.threads = []; return j; } });
  try {
    const d = p.d, kinds = new Set(p.cards().map((c) => c.getAttribute("data-kind")));
    ok(!kinds.has("messages") && same(visible2(d), ["all", ...["orders", "payments", "messages", "rows", "accounts"].filter((k) => kinds.has(k))]) && !visible2(d).includes("messages"),
      "with no message waiting there is no Messages chip, and each other kind present keeps its own: " + visible2(d));
  } finally { p.w.close(); }
  function visible2(dd) { return [...dd.querySelectorAll(".nchips button")].filter((b) => !b.hidden).map((b) => b.getAttribute("data-chip")); }

  /* 8. A READ THAT FAILED IS SAID */
  p = await open(state(), { failRoutes: [ROUTES.review, ROUTES.threads] });
  try {
    const d = p.d, line = d.getElementById("nCount").textContent;
    ok(/ Not read: orders and rows and messages[.]$/.test(line) && !p.card("o:ord-p1") && !p.card("m:" + U1) && p.card("c:" + U1 + ":c-1") && p.card("k:" + U3),
      "what could not be read is named under the title, and the cards of what could be read stand: " + line);
    ok(!/^Nothing needs you/.test(line), "and it never says nothing needs him");
    p.fail.clear();
    await p.tick();
    ok(!/Not read/.test(d.getElementById("nCount").textContent) && p.card("o:ord-p1") && p.card("m:" + U1), "once the next read gets through, the cards come and the note goes: " + d.getElementById("nCount").textContent);
  } finally { p.w.close(); }
  p = await open(state(), { failRoutes: [ROUTES.review, ROUTES.claims, ROUTES.threads, ROUTES.hours, ROUTES.bulletin] });
  try {
    ok(/Not read: orders and rows, payments, messages, hours and the notice[.]$/.test(p.d.getElementById("nCount").textContent),
      "and every source that failed is named: " + p.d.getElementById("nCount").textContent);
  } finally { p.w.close(); }

  /* 9. THE 30-SECOND READ */
  p = await open(state());
  try {
    const d = p.d;
    ok(p.live().length === 1, "Needs you sets one read every 30 seconds: " + JSON.stringify(p.intervals.map((i) => i.ms)));
    p.reads.length = 0;
    await p.tick();
    ok(same([...p.reads].sort(), [ROUTES.review, ROUTES.claims, ROUTES.threads, ROUTES.hours, ROUTES.bulletin, ROUTES.sheet, ROUTES.links].sort()),
      "a tick on Needs you reads the orders and rows, the claims, the threads, the hours, the notice, the accounts and the links, each once: " + JSON.stringify(p.reads));

    /* nothing drawn when nothing changed */
    const kept = { c: p.card("o:ord-p1"), s: p.card("l:w1"), r: d.querySelector("#makerOrderList .ordrow"), status: d.getElementById("makerReviewStatus").textContent };
    const seen = [];
    const watch = new p.w.MutationObserver((rs) => seen.push(...rs));
    for (const id of ["nlist", "makerOrderList", "makerReview", "makerClaims", "makerDrafts", "makerChatList", "makerQueueReview", "oLinks", "glist"]) {
      const n = d.getElementById(id); if (n) watch.observe(n, { childList: true, subtree: true, characterData: true, attributes: true });
    }
    await p.tick(); await p.tick();
    seen.push(...watch.takeRecords());
    ok(seen.length === 0 && p.card("o:ord-p1") === kept.c && p.card("l:w1") === kept.s && d.querySelector("#makerOrderList .ordrow") === kept.r
      && d.getElementById("makerReviewStatus").textContent === kept.status,
    "a tick that finds what it found last time draws nothing: no card, no list and no line of status is touched (" + seen.length + " changes)");
    watch.disconnect();

    /* a change is drawn and counted */
    const s2 = state();
    p.w.close();
    p = await open(s2);
    ok(!p.card("o:ord-new") && p.counts(".salt-rail").needs === "9", "(a day without the order)");
    s2.newOrder = { id: "ord-new", u: U1, status: "placed", mode: "collect", qty: 3, total: 300, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], at: ago(0.1) };
    await p.tick();
    ok(p.card("o:ord-new") && p.card("o:ord-new").getAttribute("data-sev") === "now" && p.counts(".salt-rail").needs === "10" && p.counts(".salt-appbar").orders === "10"
      && /^10 now/.test(p.d.getElementById("nCount").textContent), "an order placed since the last read is drawn at the next tick, and counted on both bars");

    /* only while it shows, and the page is visible */
    byAct(p.d, "nav.customers").click(); await p.work.quiet();
    ok(p.live().length === 0, "entering Customers stops it");
    byAct(p.d, "nav.shop").click(); await p.work.quiet();
    ok(p.live().length === 0, "and Shop and Record are no different");
    byAct(p.d, "nav.orders").click(); await p.work.quiet();
    ok(p.live().length === 1, "Orders reads every 30 seconds too");
    p.reads.length = 0; await p.tick();
    ok(same([...p.reads].sort(), [ROUTES.claims, ROUTES.review].sort()), "and what it reads is the orders and the claims, nothing of the rest: " + JSON.stringify(p.reads));
    byAct(p.d, "nav.needs").click(); await p.work.quiet();
    p.hide(true);
    ok(p.live().length === 0, "a hidden page stops it");
    p.reads.length = 0;
    const ghost = p.intervals.filter((i) => i.ms === 30000).pop();
    if (ghost) ghost.f();
    await p.work.quiet();
    ok(p.reads.length === 0, "and a tick that still arrives while the page is hidden reads nothing");
    p.hide(false);
    await p.work.quiet();
    ok(p.live().length === 1 && p.reads.includes(ROUTES.review), "a page that comes back reads at once and sets it again: " + JSON.stringify(p.reads));
  } finally { p.w.close(); }

  /* no read twice at once */
  p = await open(state());
  try {
    const release = p.hold(ROUTES.review);
    p.reads.length = 0;
    const t = p.live()[0];
    t.f(); t.f();
    await new Promise((r) => setTimeout(r, 30));
    t.f();
    await new Promise((r) => setTimeout(r, 30));
    ok(p.reads.filter((r) => r === ROUTES.review).length === 1 && p.reads.filter((r) => r === ROUTES.claims).length === 1,
      "a tick while the last read is still out starts none: " + JSON.stringify(p.reads));
    release(); await p.work.quiet();
    p.reads.length = 0; await p.tick();
    ok(p.reads.filter((r) => r === ROUTES.review).length === 1, "and once it has landed the next tick reads again");
  } finally { p.w.close(); }

  /* the newest read wins: a slow read that lands after a newer one never draws over it */
  const s4 = state();
  p = await open(s4);
  try {
    const d = p.d, waitFor = async (f) => { for (let i = 0; i < 400 && !f(); i++) await new Promise((r) => setTimeout(r, 10)); return !!f(); };
    const release = p.hold(ROUTES.review);
    p.reads.length = 0;
    p.live()[0].f();
    await waitFor(() => p.reads.includes(ROUTES.review));
    s4.newOrder = { id: "ord-new", u: U1, status: "placed", mode: "collect", qty: 3, total: 300, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], at: ago(0.1) };
    byAct(d, "nav.orders").click();
    ok(await waitFor(() => d.querySelector('#makerOrderList [data-order="ord-new"]')), "a read he asks for lands while the slow one is still out, and draws what came");
    release(); await p.work.quiet();
    byAct(d, "nav.needs").click(); await p.work.quiet();
    ok(!!d.querySelector('#makerOrderList [data-order="ord-new"]') && !!p.card("o:ord-new"), "and the slow one, landing last with the older answer, draws over nothing");
  } finally { p.w.close(); }

  /* a part he has begun on is left alone, a tap in flight kept */
  const s3 = state();
  p = await open(s3);
  try {
    const d = p.d;
    byAct(d, "nav.orders").click(); await p.work.quiet();
    cardOf(d, "ord-p1");
    const field = d.querySelector('#makerReview [data-maker-card="ord-p1"] [data-act="order.total"]');
    field.value = "250"; field.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    s3.newOrder = { id: "ord-new", u: U1, status: "placed", mode: "collect", qty: 3, total: 300, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], at: ago(0.1) };
    p.reads.length = 0; await p.tick();
    ok(!p.reads.includes(ROUTES.review) && d.querySelector('#makerReview [data-maker-card="ord-p1"] [data-act="order.total"]').value === "250" && !d.querySelector('#makerOrderList [data-order="ord-new"]'),
      "a tick finds the order card he has typed in and leaves the part as it is: nothing read, his 250 kept");
    byAct(d, "maker.refresh").click(); await p.work.quiet();
    ok(!!d.querySelector('#makerOrderList [data-order="ord-new"]'), "his own Refresh draws what came meanwhile");
    p.reads.length = 0; await p.tick();
    ok(p.reads.includes(ROUTES.review) && p.reads.includes(ROUTES.claims), "and the next tick reads again, he having finished");
    /* 12 Oct 2026 (Phase 2b): the rows are read when the claim is opened, so a claim open is the claim he is reading */
    byAct(d, "claim.open").click(); await p.work.quiet();
    const note = () => (d.querySelector("#makerClaims .maker-quote") || { textContent: "" }).textContent;
    const before = note();
    p.reads.length = 0; await p.tick();
    ok(before !== "" && note() === before && !p.reads.includes(ROUTES.claims), "a claim whose rows he is reading is left alone: " + JSON.stringify(p.reads));
  } finally { p.w.close(); }

  /* 9c. WHEN HIS ACCESS SIGN-IN ENDS MID-POLL, THE POLL ENDS WITH IT */
  p = await open(state());
  try {
    const d = p.d;
    ok(p.live().length === 1, "the 30-second read is running before the lapse");
    p.lapse(true);
    p.reads.length = 0;
    await p.tick();
    const during = p.reads.length;
    ok(d.body.classList.contains("ended") && !d.getElementById("aEnded").hidden && during > 0 && p.live().length === 0,
      "a lapse met by a poll gives the page way to Sign in again and clears the 30-second read: " + JSON.stringify([d.body.className, during, p.live().length]));
    p.reads.length = 0;
    p.hide(true); p.hide(false); await p.work.quiet();
    for (const i of p.live()) i.f();   /* the next 30 seconds, for any read still set */
    await p.work.quiet();
    ok(p.reads.length === 0 && p.live().length === 0,
      "and a page hidden then shown again, or any later 30 seconds, sends nothing and sets nothing again: " + JSON.stringify([p.reads, p.live().length]));
  } finally { p.w.close(); }
}
