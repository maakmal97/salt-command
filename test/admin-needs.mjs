/* test/admin-needs.mjs: NEEDS YOU, THE RANKED INBOX (11 Oct 2026, Phase 1b; docs/STATEMENTS.md "His places").
 *
 * Every thing that waits on him is a card on the system's Action recipe, ranked Now, Soon, Watch and oldest first in each, read again every 30
 * seconds while it is showing. What is proved here, each check red under its own mutation (test/admin-needs.mutations.json):
 *   1  the cards: which kind of thing is in which severity, with its kind word, who, what, age and Open
 *   2  the ranking: Now before Soon before Watch, the oldest first; practice items apart, under their own line
 *   3  practice items: labelled, and counted nowhere, in the line under the title and on both bars
 *   4  the counts on every bar item, on the rail and on the app bar alike
 *   5  Open: each kind goes to its own place and part, and opens the thing it is about
 *   6  the one filled pill: only where the page already has that exact action as one tap, through the same function and the same question;
 *      no card in Needs you books money
 *   7  the kind chips: filters only, reading nothing
 *   8  a read that failed is said, never taken for nothing waiting
 *  10  (17 Oct 2026, Counter Admin clarity part 2) the verb first: each card's title says what to do, then who and the figure under it; the card's main
 *      button is on the card and reaches the same function as the full card's; a money tap asks once on the card and Cancel sends nothing; practice
 *      accounts are one folded line at the foot, "Practice: N"; the summary reads "12 to do now · 11 soon"
 *   9  the 30-second read: only while Needs you or Orders shows and the page is visible, no read twice at once, nothing drawn when nothing
 *      changed, a part he has begun on left alone, a tap in flight kept
 * Drawn by the maker harness (test/maker-act.mjs), whose hooks change what each read answers. */
import { richOwnerPage, byAct, cardOf } from "./maker-act.mjs";
import { SITE_RECIPES } from "../stmt/statement-css.js";
import worker from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { world } from "./maker-queue-withdrawal.mjs";
import { makerRequestFingerprint } from "../src/maker-request.js";

const U1 = "abcd-efgh", U2 = "jkmn-pqrs", U3 = "tvwx-yz23", U4 = "4567-89ab", PRACTICE = "0000-0000";
const NOW = Date.now(), ago = (h) => new Date(NOW - h * 3600000).toISOString();
/* the page says a moment today by its time and any other by its day, in Kuala Lumpur (owner.js when()), so what an age reads depends on the hour the suite runs */
const klDay = (iso) => new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 10);
const MADE_20H = klDay(ago(20)) === klDay(new Date(NOW).toISOString()) ? /^Made \d\d:\d\d$/ : /^Made \d\d \w{3} \d{4}$/;
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
      if (state.onePay) { const a1 = j.orders.find((o) => o.id === "ord-a1"); a1.payments = a1.payments.filter((x) => x.claim === "waiting").slice(0, 1); }
      j.orders.push({ id: "ex-1", u: PRACTICE, status: "placed", mode: "collect", qty: 1, total: 100, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [],
        history: [], test: true, at: ago(40) });
      if (state.newOrder) j.orders.push(state.newOrder);
      j.drafts[0].id = ago(6); j.drafts[1].id = ago(3); j.drafts[2].id = ago(1);
      j.drafts.push({ ...j.drafts[0], id: ago(0.5), entry: { type: "SELL", party: "CX1-ZED", date: "2026-10-10", claim: { id: "c-1" } } });
      j.drafts = j.drafts.filter((d) => !state.approved.has(d.id));
      j.orders.find((o) => o.id === "ord-r1").ledgerKey = "CX1-ZED|2026-09-01|200";
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
      /* a fixed day before the harness's unsent loan (stamped 10 Oct 2026 08:00Z), so the order of the two holds on any day the suite runs */
      j.accounts.find((a) => a.username === U4).issued = "2026-10-09";
      return j;
    },
    linksAnswer: (j) => { j.refs.find((r) => r.id === "w1").made = ago(20); return j; },
    /* plan 1: money owed past term on a row that is a site order (ord-r1's key), and goods paid for on a row that is none */
    inputsAnswer: (j) => { Object.assign(j.catalog, OWED); return j; }
  };
}
const OWED = { owedMoney: [{ party: "CX1-ZED", rm: 150, since: "2026-09-20", due: "2026-09-21",
  rows: [{ rid: "row-1", key: "CX1-ZED|2026-09-01|200", product: "salt", rm: 150, since: "2026-09-20", due: "2026-09-21" }] }],
owedGoods: [{ party: "CX2-ZED", rid: "row-1", key: "CX2-ZED|2026-10-05|99|oil", product: "oil", units: 1.5, date: "2026-10-05" }] };
const NOW_KEYS = ["o:ord-p3", "p:ord-a1", "c:" + U1 + ":c-1", "o:ord-p1", "m:" + U1, "o:ord-p4", "c:" + U1 + ":c-2", "o:ord-p2", "k:" + U3,
];
const PRACTICE_KEYS = ["m:" + PRACTICE, "c:" + PRACTICE + ":c-x", "o:ex-1"];
const WATCH_KEYS = ["w:hours", "w:notice"];
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
    p.keys = (sev) => p.cards().filter((c) => c.getAttribute("data-sev") === sev && !c.hasAttribute("data-practice")).map((c) => c.getAttribute("data-need"));
    /* what a card says is the words after its book's mark (the mark is a .pwith: the drawing, and the shape told to a reader), so the book is read as the mark it draws and never as a word */
    p.title = (c) => (c.querySelector(".need-head") || { textContent: "" }).textContent;
    p.words = (c) => { const w = c.querySelector(".need-what"), rest = w ? w.cloneNode(true) : null, mark = w ? w.querySelector(".pwith") : null;
      if (rest) rest.querySelectorAll(".pwith").forEach((m) => m.remove());
      return { kind: c.querySelector(".salt-action__kind").textContent, who: c.querySelector(".need-who").textContent, what: rest ? rest.textContent.trim() : "",
        mark: mark && mark.querySelector("svg.psym") ? (mark.querySelector(".sr") || { textContent: "" }).textContent : "", age: c.querySelector(".salt-action__money").textContent }; };
    p.buttons = (c) => [...c.querySelectorAll("button:not(.need-tap)")].map((b) => b.textContent);
    p.counts = (bar) => Object.fromEntries([...d.querySelectorAll(bar + " [data-count]")].map((e) => [e.getAttribute("data-count"), e.textContent]));
    p.tap = async (act, key) => { const c = byAct(d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.where = () => {
      const place = (d.querySelector('.salt-appbar .place[aria-current="page"]') || { getAttribute: () => "" }).getAttribute("data-m");
      const part = (d.querySelector('.aparts[data-place="' + place + '"] [aria-selected="true"]') || { getAttribute: () => "" }).getAttribute("data-part");
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
    ok(same(p.keys("now"), NOW_KEYS) && same(p.keys("soon").slice(0, 5), ["$:CX1-ZED", "g:row-1", "s", UNSENT, "l:w1"]) && same(p.keys("watch"), WATCH_KEYS),
      "an order placed, a payment they say they sent, a message asked and a locked account are Now, the guest link and the accounts not sent Soon, and the Desk's line, "
      + "an override and a notice Watch: " + JSON.stringify([p.keys("now"), p.keys("soon"), p.keys("watch")]));
    ok(p.cards().every((c) => c.classList.contains("salt-action") && c.classList.contains("salt-action--" + c.getAttribute("data-sev"))
      && c.querySelector(".salt-action__kind") && c.querySelector(".need-who") && c.querySelector(".salt-action__money")),
    "every card is the system's Action recipe, coloured by its severity, with its kind word, who and age");
    const order = p.words(p.card("o:ord-p3")), pay = p.words(p.card("p:ord-a1")), claim = p.words(p.card("c:" + U1 + ":c-1")), msg = p.words(p.card("m:" + U1)), lock = p.words(p.card("k:" + U3));
    ok(order.kind === "Order" && order.who === "CX1-ZED" && order.what === "1 unit · RM 100.00" && /^(Cube|Droplet|Lozenge|Capsule|Ring)$/.test(order.mark) && order.age === "26 h",
      "a placed order says Order, who by code, what (the book's mark, units, RM, and no word for the book) and its age in hours: " + JSON.stringify(order));
    ok(pay.kind === "Payment" && pay.what === "Says they paid" && p.title(p.card("p:ord-a1")) === "Confirm CX1-ZED's RM 530.00" && pay.age === "9 h" && claim.kind === "Payment" && p.title(p.card("c:" + U1 + ":c-1")) === "Confirm CX1-ZED's RM 50.00" && claim.age === "7 h",
      "a payment they say they sent, on an order (the sum, the oldest) or against the account, says Payment: " + JSON.stringify([pay, claim]));
    ok(msg.kind === "Message" && msg.who === "CX1-ZED" && msg.what === "Hello" && msg.age === "4 h" && lock.kind === "Locked" && /^Locked out until \d\d:\d\d$/.test(lock.what) && lock.age === "5 min",
      "a message asked carries their words, a locked account the addresses refused and its age: " + JSON.stringify([msg, lock]));
    const row = p.words(p.card("d:" + ago(6))), link = p.words(p.card("l:w1"));
    ok(row.kind === "Row" && row.who === "CX1-ZED" && row.what === "Sale, 1 unit, RM 100.00" && /^(Cube|Droplet|Lozenge|Capsule|Ring)$/.test(row.mark) && row.age === "6 h" && link.kind === "Link" && MADE_20H.test(link.what) && link.age === "20 h",
      "a Desk row to approve is Soon, with its party, what and age, and so is a guest link: " + JSON.stringify([row, link]));
    ok(p.card("x:0") && p.card("q:q-2") && p.card("q:q-1") === null && p.card("x:0").getAttribute("data-sev") === "soon" && /Refused for the fixture/.test(p.card("x:0").textContent)
      && p.card("q:q-2").getAttribute("data-kind") === "rows" && p.card("a:ord-a2") && p.card("a:ord-a2").getAttribute("data-sev") === "soon",
    "an entry that did not get through (the drafter's refusal, a refused server entry, not a held one) and a stage he rejected are Soon");
    ok(!p.card("w:desk") && !/The Desk shows/.test(d.getElementById("nlist").textContent) && /Closed until Fri 18:00/.test(p.card("w:hours").textContent) && /Open late/.test(p.card("w:notice").textContent),
      "Watch says \"Closed until Fri 18:00\" for the override in force and the notice set, and no card says only what the Desk counts (plan 1, part 5)");
    /* 1b. WHAT IS OWED, BOTH WAYS (plan 1, parts 3 and 4) */
    const owedM = p.words(p.card("$:CX1-ZED")), owedG = p.words(p.card("g:row-1"));
    ok(p.card("$:CX1-ZED").getAttribute("data-sev") === "soon" && p.card("$:CX1-ZED").getAttribute("data-kind") === "payments" && owedM.kind === "Owed" && owedM.who === "CX1-ZED"
      && owedM.what === "Past term" && p.title(p.card("$:CX1-ZED")) === "Collect RM 150.00 from CX1-ZED" && /Handed over 20 Sep 2026, due 21 Sep 2026[.]/.test(p.card("$:CX1-ZED").textContent) && same(p.buttons(p.card("$:CX1-ZED")), ["Record payment"]),
    "money owed past term is a Soon card: who, the Desk's figure, when it was handed over and due, and Record payment: " + JSON.stringify(owedM));
    ok(p.card("g:row-1").getAttribute("data-sev") === "soon" && p.card("g:row-1").getAttribute("data-kind") === "orders" && owedG.kind === "To hand over" && owedG.who === "CX2-ZED"
      && owedG.what === "1.5 units paid, not handed over" && /^(Cube|Droplet|Lozenge|Capsule|Ring)$/.test(owedG.mark) && same(p.buttons(p.card("g:row-1")), ["Handover"]),
    "goods paid for and not handed over are a Soon card: who, the book's mark, the units, and Handover: " + JSON.stringify(owedG));

    /* 2. THE RANKING */
    const order2 = p.cards().filter((c) => !c.hasAttribute("data-practice")).map((c) => c.getAttribute("data-sev"));
    const sevOrder = ["now", "soon", "watch"];
    ok(order2.every((s, i) => i === 0 || sevOrder.indexOf(order2[i - 1]) <= sevOrder.indexOf(s)),
      "Now comes before Soon and Soon before Watch: " + JSON.stringify(order2));
    ok(same(p.keys("now"), NOW_KEYS), "within Now the oldest comes first: " + JSON.stringify(p.keys("now")));
    ok(same(p.keys("soon"), ["$:CX1-ZED", "g:row-1", "s", UNSENT, "l:w1", "d:" + ago(6), "d:" + ago(3), "d:" + ago(0.5), "a:ord-a2", "a:ord-x1", "x:0", "q:q-2", "n:" + U2]),
      "within Soon the oldest first, and what has no age after what has one: " + JSON.stringify(p.keys("soon")));
    ok([...d.querySelectorAll("#nlist .nsev")].map((h) => h.textContent.replace(/(:| .) \d+$/, "")).join() === "Now,Soon,Watch,Practice", "each severity is headed by its word, and the practice line stands last");

    /* 3. PRACTICE (the summary reads plainly: "12 to do now · 11 soon", and says nothing of what could be read) */
    const practice = p.cards().filter((c) => c.hasAttribute("data-practice"));
    ok(same(practice.map((c) => c.getAttribute("data-need")).sort(), PRACTICE_KEYS.slice().sort())
      && practice.every((c) => /Practice/.test(c.querySelector(".need-who").parentElement.parentElement.textContent)) && !p.card("o:ord-p1").hasAttribute("data-practice"),
    "an item of a practice account is drawn, labelled Practice, and no other is");
    /* part 2: practice accounts leave Now, Soon and Watch for one folded line at the foot, which opens them in place */
    const pfold = d.querySelector('#nlist > details.nfold[data-sev="practice"]');
    ok(!!pfold && !pfold.open && pfold === d.getElementById("nlist").lastElementChild && pfold.querySelector("summary").textContent === "Practice: 3"
      && practice.every((c) => pfold.contains(c)) && d.querySelectorAll("#nlist > details.nfold:not([data-sev=practice]) [data-practice]").length === 0,
    "practice accounts are one folded line at the foot, \"Practice: 3\", and no practice card stands among Now, Soon or Watch: " + (pfold && pfold.querySelector("summary").textContent));
    pfold.open = true; pfold.dispatchEvent(new p.w.Event("toggle")); await p.tap("need.kind.all");
    ok(d.querySelector('#nlist > details[data-sev="practice"]').open && d.querySelector("#nlist > details[data-sev=practice]").querySelectorAll("[data-need]").length === 3,
      "and the line opens them in place, and stays open through a redraw");
    d.querySelector('#nlist > details[data-sev="practice"]').open = false; d.querySelector('#nlist > details[data-sev="practice"]').dispatchEvent(new p.w.Event("toggle"));
    const real = p.cards().filter((c) => !c.hasAttribute("data-practice"));
    const nowReal = real.filter((c) => c.getAttribute("data-sev") === "now").length, soonReal = real.filter((c) => c.getAttribute("data-sev") === "soon").length;
    ok(nowReal === 9 && d.getElementById("nCount").textContent === nowReal + " to do now · " + soonReal + " soon",
      "the line under the title counts the real Now and Soon and no practice item: " + d.getElementById("nCount").textContent);

    /* 4. THE COUNTS ON THE BARS */
    const rail = p.counts(".salt-rail"), bar = p.counts(".salt-appbar");
    ok(same(rail, { needs: "9", orders: "9", customers: "2", record: "", shop: "" }) && same(rail, bar),
      "Needs you counts what is Now, Orders the open orders (not ended or completed), Customers the threads asked and the links waiting, "
      + "Record and Shop none, the same on the rail and on the bar, and no practice item in any: " + JSON.stringify([rail, bar]));

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
      await open1("d:" + ago(6), "orders/approve"), await open1("x:0", "orders/approve"), await open1("l:w1", "customers/links"),
      await open1("s", "customers/accounts", () => (byAct(d, "filter.unsent") || d.querySelector('#afil [data-f="unsent"]')).getAttribute("aria-pressed") === "true" ? "" : "the Not sent filter was not set"),
      await open1("w:hours", "shop/hours"), await open1("w:notice", "shop/notice")
    ].filter(Boolean);
    ok(opens.length === 0, "Open goes to the place and part of its kind, and opens the thing it is about: " + JSON.stringify(opens));
    byAct(d, "nav.needs").click(); await p.work.quiet();
    ok(p.cards().filter((c) => !byAct(c, "need.open")).length === 0, "every card has an Open");
    /* plan 1: Record payment opens the site order's card at Money received; Handover, on a row with no site order, Record's Correct a row on that row */
    p.posts.length = 0;
    byAct(p.card("$:CX1-ZED"), "need.owed-pay", "CX1-ZED").click(); await p.work.quiet();
    const moneyHead = d.querySelector('#makerReview [data-sect="money"]');
    ok(p.where() === "orders/ready" && !!d.querySelector('#makerOrderList [data-order="ord-r1"][aria-current="true"]') && moneyHead && moneyHead.textContent === "Money received" && d.activeElement === moneyHead,
      "Record payment opens the order the row is, on Money received: " + p.where() + " " + (d.activeElement && d.activeElement.textContent));
    byAct(d, "nav.needs").click(); await p.work.quiet();
    byAct(p.card("g:row-1"), "need.owed-hand", "row-1").click(); await p.work.quiet();
    const form = d.querySelector('#makerInputs [data-form="correct-a-row"]'), pick = form && form.querySelector('[data-act="record.amend.row"]'), kind = form && form.querySelector("input:checked[value=Fulfilment]");
    const pickSend = form && form.querySelector('[data-act="record.amend.send"]');
    ok(p.where() === "record/entry" && form && !form.hidden && pick && pick.value === "row-1" && !!kind && pickSend && pickSend.disabled === false,
      "Handover on a row with no site order opens Correct a row on that row, as goods or cash moved, its Send ready: " + JSON.stringify([p.where(), form && form.hidden, pick && pick.value, !!kind, pickSend && pickSend.disabled]));
    ok(p.posts.length === 0, "and neither books anything: " + JSON.stringify(p.posts.map((x) => x.route)));

    /* 6. THE ONE FILLED PILL */
    const pills = (c) => [...c.querySelectorAll(".salt-pill")].map((b) => b.textContent);
    const money = /Agree|Accept|Received|Cash|Yes received|Pay/i;
    const owedCard = (c) => /^[$g]:/.test(c.getAttribute("data-need"));
    ok(same(pills(p.card("o:ord-p1")), ["Agree"]) && same(pills(p.card("m:" + U1)), ["Reply"]) && same(pills(p.card("p:ord-a1")), ["Review"]) && same(pills(p.card("c:" + U1 + ":c-1")), ["Received"]),
      "an order has Agree, a message Reply, a payment against the account Received, and an order with several payments Review, on the card: " + JSON.stringify([pills(p.card("o:ord-p1")), pills(p.card("m:" + U1)), pills(p.card("p:ord-a1"))]));
    /* 10. THE VERB FIRST, AND THE BUTTON ON THE CARD (17 Oct 2026, part 2) */
    const TITLES = [["o:ord-p1", "Agree CX1-ZED's order", "2 units · RM 200.00"], ["p:ord-a1", "Confirm CX1-ZED's RM 530.00", "Says they paid"], ["c:" + U1 + ":c-1", "Confirm CX1-ZED's RM 50.00", "Says they paid"],
      ["m:" + U1, "Reply to CX1-ZED", "Hello"], ["d:" + ago(6), "Approve CX1-ZED's row", null], ["k:" + U3, "Send CX3-ZED a sign-in link", null], ["a:ord-a2", "Send CX1-ZED's order again", null],
      ["$:CX1-ZED", "Collect RM 150.00 from CX1-ZED", "Past term"], ["g:row-1", "Hand over to CX2-ZED", null]];
    const got = TITLES.map(([k]) => (p.card(k) ? p.title(p.card(k)) : null)), want = TITLES.map(([, t]) => t);
    ok(got.every((t, i) => t === want[i]),
      "each card's title says what to do, verb first, then who: " + JSON.stringify(got));
    ok(p.words(p.card("o:ord-p1")).what === "2 units · RM 200.00" && !/ now| tier|level/i.test(p.card("o:ord-p1").textContent),
      "and the figure stands under it, with the book as a mark and no level or tier word: " + p.words(p.card("o:ord-p1")).what);
    ok(!p.cards().some((c) => p.buttons(c).some((t) => /Accept|Cash/.test(t))) && p.cards().filter(owedCard).every((c) => c.querySelectorAll(".salt-pill").length === 0),
      "and no card carries Accept or Cash; an owed card's one way is a ghost that opens, never a filled pill");
    ok(same(pills(p.card("d:" + ago(6))), ["Approve the sale"]) && same(pills(p.card("d:" + ago(3))), ["Approve both"]) && !p.card("d:" + ago(1)) && pills(p.card("d:" + ago(0.5))).length === 0
      && /Answer this through the payment card/.test(p.card("d:" + ago(0.5)).textContent),
    "a Desk row has its Approve, saying the result (a trip one card, Approve both), and a customer's claim row none, as on Orders > Approve");
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
    ok(same(folds.map((f) => f.getAttribute("data-sev")), ["soon", "watch", "practice"]) && folds.every((f) => !f.open && f.querySelector("summary.nsev") && /^\w+(:| .) \d+$/.test(f.querySelector("summary").textContent))
      && same(folds.map((f) => f.querySelectorAll("[data-need]").length), [p.keys("soon").length, p.keys("watch").length, 3]) && !d.querySelector("#nlist > [data-need]:not([data-sev=now])"),
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
    byAct(d, "nav.orders").click(); await p.work.quiet(); byAct(d, "part.orders.approve").click(); await p.work.quiet();
    const recordButton = [...d.querySelectorAll('#makerDrafts [data-maker-card="draft:' + id + '"] [data-act="draft.approve"]')][0];
    recordButton.click(); await p.work.quiet();
    ok(!!needAsked && same(needAsked, question()), "Orders > Approve asks the very same question: " + JSON.stringify([needAsked, question()]));
    byAct(sheet(), "ask.keep").click(); await p.work.quiet();
    byAct(d, "nav.needs").click(); await p.work.quiet();
    const release = p.hold("/all/maker/drafts/" + encodeURIComponent(id) + "/approve");
    byAct(p.card("d:" + id), "need.approve-row").click(); await p.work.quiet();
    byAct(sheet(), "ask.go").click();
    for (let i = 0; i < 100 && !p.work.inFlight(); i++) await new Promise((r) => setTimeout(r, 5));
    ok(p.posts.filter((x) => /approve$/.test(x.route)).length === 1 && p.posts.find((x) => /approve$/.test(x.route)).route === "/all/maker/drafts/" + encodeURIComponent(id) + "/approve"
      && same(p.posts.find((x) => /approve$/.test(x.route)).body, {}), "his yes sends the one request Orders > Approve sends: the same route and an empty body");
    ok(byAct(p.card("d:" + id), "need.approve-row").disabled, "while it is out the pill is off");
    byAct(p.card("d:" + id), "need.approve-row").click();
    ok(p.posts.filter((x) => /approve$/.test(x.route)).length === 1, "and a second tap sends nothing");
    st.approved.add(id); release(); await p.work.quiet();
    const done = p.card("d:" + id);
    ok(done && /Row approved[.]/.test(done.textContent) && !done.querySelector(".salt-pill") && done.getAttribute("data-sev") === "soon",
      "the answer stays on the card he tapped, though the row is no longer there: " + (done && done.textContent));
    ok(/^9 to do now · 12 soon$/.test(d.getElementById("nCount").textContent) && p.counts(".salt-rail").record === "",
      "and the row is no longer counted, and Record carries no badge: " + d.getElementById("nCount").textContent);
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
    ok(p.cards().length === 12 + 13 + 2, "All shows every card again, Watch among them: " + p.cards().length);
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
    const d = p.d, line = d.getElementById("nCount").textContent, fail = d.getElementById("nFail"), home = d.getElementById("mHome");
    /* plan 1 (15 Oct 2026): the failed read leads the page, above the title, in plain words with a Retry */
    const lead = [...home.children].find((n) => !n.hidden && !n.classList.contains("salt-eyebrow"));
    ok(fail && !fail.hidden && lead === fail && fail.getAttribute("role") === "alert" && /^Couldn't read orders and rows and messages[.]/.test(fail.textContent)
      && byAct(fail, "need.retry") && byAct(fail, "need.retry").textContent === "Retry" && !p.card("o:ord-p1") && !p.card("m:" + U1) && p.card("c:" + U1 + ":c-1") && p.card("k:" + U3),
    "a failed read is the first thing on the page, \"Couldn't read orders and rows and messages.\" with a Retry, and the cards of what could be read stand: " + (fail && fail.textContent) + " | " + line);
    ok(!/Nothing needs you/.test(line) && !/could be read/.test(line) && /^\d+ to do now/.test(line), "and the line under the title never says nothing needs him, and does not repeat what the banner says: " + line);
    p.fail.clear();
    p.reads.length = 0;
    byAct(fail, "need.retry").click(); await p.work.quiet();
    ok(fail.hidden && p.reads.includes(ROUTES.review) && p.reads.includes(ROUTES.threads) && !/could be read/.test(d.getElementById("nCount").textContent) && p.card("o:ord-p1") && p.card("m:" + U1),
      "Retry reads again, and once it gets through the cards come and the banner goes: " + d.getElementById("nCount").textContent);
  } finally { p.w.close(); }
  p = await open(state(), { failRoutes: [ROUTES.review, ROUTES.claims, ROUTES.threads, ROUTES.hours, ROUTES.bulletin, ROUTES.inputs] });
  try {
    ok(/^Couldn't read orders and rows, payments, messages, hours, the notice and what is owed[.]$/.test(p.d.getElementById("nFail").textContent.replace(/Retry$/, "")),
      "and every source that failed is named: " + p.d.getElementById("nFail").textContent);
  } finally { p.w.close(); }
  /* with nothing to show and a read failed, the page never gives the all-clear */
  const emptyDay = { review: (j) => ({ ...j, orders: [], drafts: [], refused: [], queue: [] }), claims: (j) => ({ ...j, claims: [] }), threads: (j) => ({ ...j, threads: [] }),
    bulletin: (j) => ({ ...j, lines: [] }), sheetAnswer: (j) => ({ ...j, accounts: [] }), linksAnswer: (j) => ({ ...j, refs: [] }) };
  p = await richOwnerPage({ pageWork, ...emptyDay, bare: true, failRoutes: [ROUTES.review, ROUTES.sheet] });
  try {
    await p.work.quiet();
    const d = p.d, said = d.getElementById("nCount").textContent + " | " + d.getElementById("nlist").textContent;
    ok(!d.getElementById("nFail").hidden && !/Nothing needs you/.test(said) && /^Nothing in what could be read[.]/.test(said), "a failed read on a quiet day still leads, and nothing says nothing needs him: " + said);
    p.fail.clear(); p.reads.length = 0;
    byAct(d, "need.retry").click(); await p.work.quiet();
    ok(d.getElementById("nFail").hidden && p.reads.includes(ROUTES.sheet) && p.reads.includes(ROUTES.review) && /^Nothing needs you[.]/.test(d.getElementById("nCount").textContent),
      "and Retry reads again every read that failed, the accounts among them, and the banner goes: " + JSON.stringify(p.reads));
  } finally { p.w.close(); }

  /* 8c. WHAT IS OWED IS THE DESK'S OWN READING (plan 1, parts 3 and 4): src/maker-inputs.js owedBothWays over the engine, on a fixed day */
  {
    const { owedBothWays, makerInputCatalog } = await import("../src/maker-inputs.js");
    const E = (await import("../engine/position.mjs")).default;
    const sales = [
      { rid: "r-a", customer: "CA1-ZED", date: "2026-10-01", qty: 2, total: 200, cash: 50, deliveredQty: 2, deliveredOn: "2026-10-01" },
      { rid: "r-b", customer: "CA1-ZED", date: "2026-09-28", qty: 1, total: 100, cash: 0, deliveredQty: 1, deliveredOn: "2026-09-28" },
      { rid: "r-c", customer: "CB1-ZED", date: "2026-10-04", qty: 1, total: 100, cash: 0, deliveredQty: 1, deliveredOn: "2026-10-04" },
      { rid: "r-d", customer: "CC1-ZED", date: "2026-10-01", qty: 3, total: 300, cash: 300, deliveredQty: 1, deliveredOn: "2026-10-01" },
      { rid: "r-e", customer: "CD1-ZED", date: "2026-09-01", qty: 1, total: 100, cash: 0, deliveredQty: 1, deliveredOn: "2026-09-01", defaulted: true },
      { rid: "r-f", customer: "CE1-ZED", date: "2026-10-02", qty: 2, total: 200, cash: 0, deliveredQty: 0 },
      { rid: "r-g", customer: "CF1-ZED", date: "2026-10-03", qty: 1, total: 100, cash: 100, deliveredQty: 0, cancelled: true },
      { rid: "r-h", customer: "CG1-ZED", date: "2026-10-03", qty: 2, total: 0, cash: 0, deliveredQty: 1, deliveredOn: "2026-10-03", goodwill: true }
    ];
    const book = { version: "v-fixture", state: { TERMS: { holdDays: 1 } }, sales, purchases: [] };
    const r = owedBothWays(book, "2026-10-05"), m = r.owedMoney;
    ok(m.length === 1 && m[0].party === "CA1-ZED" && m[0].rm === +(E.txAdvance(sales[0]) + E.txAdvance(sales[1])).toFixed(2) && m[0].rm === 250
      && m[0].since === "2026-09-28" && m[0].due === "2026-09-29" && same(m[0].rows.map((x) => [x.rid, x.rm]), [["r-b", 100], ["r-a", 150]]) && m[0].rows[0].key === E.ovKey(sales[1]),
    "money owed is the engine's txAdvance on goods handed over, past the term from the oldest handover, summed per party and the oldest first; "
      + "one due today, a write-off and a row with nothing handed over are not owed: " + JSON.stringify(m));
    ok(same(r.owedGoods.map((x) => [x.party, x.rid, x.units]), [["CC1-ZED", "r-d", 2]]),
      "goods owed are the units still to hand over on a row paid in full, and never on one unpaid, cancelled or a gift: " + JSON.stringify(r.owedGoods));
    const cat = makerInputCatalog(book, {}, [], [], "2026-10-05");
    ok(same(cat.owedMoney, m) && same(cat.owedGoods, r.owedGoods) && cat.today === "2026-10-05", "and the catalog Counter Admin reads carries both");
    const none = owedBothWays({ ...book, state: {} }, "2026-10-05");
    ok(!("owedMoney" in none) && /payment term/.test(none.owedError || ""), "a mirror with no term says so, never that nothing is owed: " + JSON.stringify(none));
  }
  p = await open(state(), { inputsAnswer: (j) => { delete j.catalog.owedMoney; delete j.catalog.owedGoods; return j; } });
  try {
    ok(!p.d.getElementById("nFail").hidden && /what is owed/.test(p.d.getElementById("nFail").textContent) && !p.card("$:CX1-ZED"),
      "a Desk that does not say what is owed is a failed read, never nothing owed: " + p.d.getElementById("nFail").textContent);
  } finally { p.w.close(); }

  /* 8b. ONE BAD QUEUE KEY NEVER BLANKS THE REVIEW (plan 1, part 2; 15 Oct 2026, a laptop key written without its device): the review reads every
     other key and names the bad ones; a withdrawal still refuses while one stands */
  {
    const { DatabaseSync } = await import("node:sqlite");
    const w = world(DatabaseSync, worker, handleMaker), at = "2099-10-06T02:00:00.000Z", entry = { at, date: "2099-10-06", payload: { mode: "ordinary" } };
    await w.upload("phone-A", [entry]);
    await w.kv.put("q:laptop-x", JSON.stringify({ queue: [{ at: "2099-10-06T03:00:00.000Z", date: "2099-10-06" }] }));
    await w.kv.put("q:laptop-y", "{");
    const res = await w.call("/all/maker/review"), body = await res.json(), held = (body.queue || []).find((e) => e.id === at);
    ok(res.status === 200 && held && held.device === "phone-A" && same([...(body.unreadable || [])].sort(), ["q:laptop-x", "q:laptop-y"]),
      "a queue key with no matching device, or not JSON, is skipped and named, and the review still answers with every other entry: " + JSON.stringify([res.status, body.unreadable, !!held]));
    const fp = await makerRequestFingerprint("server-queue-entry", entry);
    ok(held && held.canWithdraw === false && /could not be read/.test(held.unavailable || ""), "while one stands, no entry is offered for withdrawal: " + JSON.stringify(held && [held.canWithdraw, held.unavailable]));
    const wd = await (await w.call("/all/maker/queue/" + encodeURIComponent(at) + "/withdraw", "POST", { fingerprint: fp })).json();
    ok(wd.ok === false && wd.state === "withdrawal-pending" && /no matching owner|could not be read/.test(wd.error || "") && JSON.parse(await w.kv.get("q:phone-A")).queue.some((e) => e.at === at),
      "and the withdrawal road stays strict: it refuses rather than act on a doubtful queue: " + JSON.stringify(wd));
    await w.kv.delete("q:laptop-x"); await w.kv.delete("q:laptop-y");
    const mended = await (await w.call("/all/maker/review")).json(), again = (mended.queue || []).find((e) => e.id === at);
    const wd2 = await (await w.call("/all/maker/queue/" + encodeURIComponent(at) + "/withdraw", "POST", { fingerprint: fp })).json();
    ok(same(mended.unreadable, []) && again && again.canWithdraw === true && wd2.ok === true && wd2.state === "withdrawn",
      "once the keys are mended the review is whole and the entry is withdrawn: " + JSON.stringify(wd2));
  }
  p = await open(state(), { review: (j) => { j.unreadable = ["q:laptop-x"]; return j; } });
  try {
    const d = p.d, c = p.card("qx");
    ok(c && c.getAttribute("data-sev") === "soon" && /1 queue entry unreadable: q:laptop-x/.test(c.textContent) && p.card("o:ord-p1") && p.card("q:q-2"),
      "Needs you says \"1 queue entry unreadable: q:laptop-x\" as a Soon card, and every other card stands: " + (c && c.textContent));
    byAct(d, "nav.orders").click(); await p.work.quiet(); byAct(d, "part.orders.approve").click(); await p.work.quiet();
    const line = d.querySelector("#makerQueueReview [data-unreadable]");
    ok(line && line.textContent === "1 queue entry unreadable: q:laptop-x", "and Orders > Approve's queue names it too: " + (line && line.textContent));
  } finally { p.w.close(); }

  /* 9. THE 30-SECOND READ */
  p = await open(state());
  try {
    const d = p.d;
    ok(p.live().length === 1, "Needs you sets one read every 30 seconds: " + JSON.stringify(p.intervals.map((i) => i.ms)));
    p.reads.length = 0;
    await p.tick();
    ok(same([...p.reads].sort(), [ROUTES.review, ROUTES.claims, ROUTES.threads, ROUTES.hours, ROUTES.bulletin, ROUTES.sheet, ROUTES.links, ROUTES.inputs].sort()),
      "a tick on Needs you reads the orders and rows, the claims, the threads, the hours, the notice, the accounts, the links and what is owed, each once: " + JSON.stringify(p.reads));

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
      && /^10 to do now/.test(p.d.getElementById("nCount").textContent), "an order placed since the last read is drawn at the next tick, and counted on both bars");

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

  /* 11. THE CARD'S BUTTON REACHES THE SAME ROAD, ONCE; A MONEY TAP ASKS ONCE, ON THE CARD */
  {
    const q = await open({ ...state(), onePay: true });
    try {
      const d = q.d, pay = () => q.card("p:ord-a1"), sent = () => q.posts.filter((x) => /\/orders\/ord-a1\/received$/.test(x.route));
      const before = q.posts.length;
      ok(same(q.buttons(pay()), ["Received"]) && !!byAct(pay(), "need.received", "p:ord-a1"), "an order with one payment waiting has Received on its card");
      await q.tap("need.received", "p:ord-a1");
      ok(q.posts.length === before && /Confirm RM \d+[.]\d\d received from CX1-ZED[?]/.test(pay().textContent) && !!byAct(pay(), "need.ask-yes", "p:ord-a1") && !!byAct(pay(), "need.ask-no", "p:ord-a1"),
        "Received asks on the card first, \"Confirm RM .. received from CX1-ZED?\", and sends nothing: " + pay().textContent);
      await q.tap("need.ask-no", "p:ord-a1");
      ok(q.posts.length === before && !/received from/.test(pay().textContent) && !!byAct(pay(), "need.received", "p:ord-a1"), "Cancel sends nothing and puts the card back");
      await q.tap("need.received", "p:ord-a1");
      const yes = byAct(pay(), "need.ask-yes", "p:ord-a1"); yes.click(); yes.click(); await q.work.quiet();
      ok(sent().length === 1 && sent()[0].body && typeof sent()[0].body.rid === "string" && sent()[0].body.claim, "Yes sends the order card's own Received once, under a request id, a second tap sending nothing: " + JSON.stringify(sent()));
      /* a payment against the account: the rows are read, then the card's own request goes once */
      const cc = () => q.card("c:" + U1 + ":c-1"), cs = () => q.posts.filter((x) => /\/claims\/[^/]+\/c-1\/received$/.test(x.route)), pv = () => q.posts.filter((x) => /\/claims\/[^/]+\/c-1\/preview$/.test(x.route));
      await q.tap("need.received", "c:" + U1 + ":c-1");
      ok(pv().length === 0 && cs().length === 0 && /Confirm RM 50[.]00 received from CX1-ZED[?]/.test(cc().textContent), "a claim's Received asks before it reads or sends anything");
      await q.tap("need.ask-no", "c:" + U1 + ":c-1");
      ok(pv().length === 0 && cs().length === 0, "and Cancel reads and sends nothing");
      await q.tap("need.received", "c:" + U1 + ":c-1");
      const y2 = byAct(cc(), "need.ask-yes", "c:" + U1 + ":c-1"); y2.click(); y2.click(); await q.work.quiet();
      ok(pv().length === 1 && cs().length === 1 && cs()[0].body.hash === "c".repeat(64) && typeof cs()[0].body.rid === "string", "Yes sends the claim card's own Received once, with the rows' hash and a request id, after one read of the rows however often Yes is tapped: " + JSON.stringify(cs()));
      /* an order's Agree needs the delivery and the window: the button opens the full card, and books nothing */
      const n = q.posts.filter((x) => /\/accept$/.test(x.route)).length;
      await q.tap("need.agree", "o:ord-p1");
      ok(q.where() === "orders/placed" && q.posts.filter((x) => /\/accept$/.test(x.route)).length === n && !!q.d.querySelector('[data-act="order.agree"], .maker-card'),
        "an order's Agree opens its full card in Orders and books nothing: " + q.where());
    } finally { q.w.close(); }
  }

  /* 12. A CLAIM ANSWERED FROM THE CARD SHARES THE FULL CARD'S SEND (18 Oct 2026): one retained request per claim, whichever card asked, so money is sent once */
  {
    const C1 = U1 + ":c-1", route = "/all/maker/claims/" + U1 + "/c-1/received", nap = (ms) => new Promise((r) => setTimeout(r, ms));
    const sends = (q) => q.posts.filter((x) => x.route === route), previews = (q) => q.posts.filter((x) => x.route === "/all/maker/claims/" + U1 + "/c-1/preview");
    const yesOnCard = async (q) => { await q.tap("need.received", "c:" + C1); byAct(q.card("c:" + C1), "need.ask-yes", "c:" + C1).click(); await nap(30); };
    let q = await open(state());
    try {
      const release = q.hold(route);
      await yesOnCard(q);
      ok(sends(q).length === 1, "Yes on the Needs you card sends the claim's Received once, the answer still to come: " + sends(q).length);
      byAct(q.d, "nav.orders").click(); await nap(40); byAct(q.d, "part.orders.payments").click(); await nap(40);
      byAct(q.d, "claim.open", C1).click(); await nap(40);
      byAct(q.d, "claim.received", C1).click(); await nap(40);
      ok(sends(q).length === 1 && !q.d.getElementById("ynSheet"), "Yes on the full card while the first is unanswered sends nothing more: " + sends(q).length);
      release(); await q.work.quiet();
      ok(sends(q).length === 1 && typeof sends(q)[0].body.rid === "string", "so the claim is answered once, under one request id: " + JSON.stringify(sends(q)));
    } finally { q.w.close(); }
    q = await open(state(), { claimPreview: (j) => ({ ...j, left: 20 }) });
    try {
      await yesOnCard(q); await q.work.quiet();
      ok(q.where() === "orders/payments" && !!byAct(q.d, "claim.received", C1) && sends(q).length === 0,
        "rows that need a look open the full claim card, and send nothing: " + q.where());
    } finally { q.w.close(); }
    let refusing = true, reads = 0;
    q = await open(state(), { extra: (r) => {
      if (r === "/all/maker/claims/" + U1 + "/c-1/preview" && ++reads > 1) return { ok: true, hash: "d".repeat(64), rows: [], left: 0, booked: false };
      if (r === route && refusing) return { refuse: "The rows changed. Preview them again.", detail: { differs: true } };
      return undefined;
    } });
    try {
      await yesOnCard(q); await q.work.quiet();
      refusing = false;
      byAct(q.card("c:" + C1), "need.ask-yes", "c:" + C1).click(); await q.work.quiet();
      ok(previews(q).length === 2 && sends(q).length === 2 && sends(q)[1].body.hash === "d".repeat(64) && sends(q)[1].body.rid !== sends(q)[0].body.rid,
        "after the rows moved, the next Yes reads them again and sends the new hash under a new request id: " + JSON.stringify(sends(q)));
    } finally { q.w.close(); }
  }

}
