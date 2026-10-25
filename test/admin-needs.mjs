/* test/admin-needs.mjs: NEEDS YOU, THE RANKED INBOX (11 Oct 2026, Phase 1b; docs/STATEMENTS.md "His places"; re-aimed 22 Oct 2026 to the redesigned page, his canvas Needs you).
 *
 * Every thing that waits on him is one card of the system's Action recipe, in a group under one word (To do, Pending, FYI; never folded, no count), money first and then
 * the oldest, read again every 5 seconds while it is showing. What is proved here, each check red under its own mutation (test/admin-needs.mutations.json):
 *   1  the cards: which kind of thing is in which group (his own work is To do; Pending is money owed past term and an offer waiting on their yes; FYI the hours and the
 *      notice), with its kind word and age, who by code, the book's typed tag, the figure and the one pill; what the card says in full is its title's aria-label
 *   2  the ranking: To do before Pending before FYI, the cards with money first and the largest sum first, then the rest oldest first and no age last; practice items apart
 *   3  practice items: one folded line "Practice: N", no chip on the card, counted nowhere, in the lead and on both bars; the lead is one Insight of what waits on his tap
 *   4  the counts on every bar item, on the rail and on the app bar alike: Needs you counts the To do cards
 *   5  Open: each kind goes to its own place and part, and opens the thing it is about
 *   6  the one filled pill: only where the page already has that exact action as one tap, through the same function and the same question; no card in Needs you books
 *      money; a second choice (Record payment) stands in the opened card from 860px, not on the resting card
 *   7  the kind tabs: filters only, reading nothing, a kind with nothing disabled and never hidden, each with its count
 *   8  a read that failed is said, never taken for nothing waiting
 *  10  the verb first: each card's title says what to do, then who, in full to a reader; the card's main button is on the card and reaches the same function as the
 *      full card's; a money tap asks once on the card and Cancel sends nothing; practice accounts are one folded line at the foot, "Practice: N"
 *   9  the 5-second read: only while Needs you or Orders shows and the page is visible, no read twice at once, nothing drawn when nothing
 *      changed, a part he has begun on left alone, a tap in flight kept
 * Drawn by the maker harness (test/maker-act.mjs), whose hooks change what each read answers. */
import { richOwnerPage, byAct, cardOf } from "./maker-act.mjs";
import { SITE_RECIPES } from "../stmt/statement-css.js";
import worker from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { world } from "./maker-queue-withdrawal.mjs";
import { makerRequestFingerprint } from "../src/maker-request.js";

const U1 = "abcd-efgh", U2 = "jkmn-pqrs", U3 = "tvwx-yz23", U4 = "4567-89ab", PRACTICE = "0000-0000";
/* the page's ageOf, so a fixed fixture date ages with the clock */
const ageOf = (iso) => { const m = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? m + " min" : m < 2880 ? Math.floor(m / 60) + " h" : Math.floor(m / 1440) + " d"; };
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
/* To do (22 Oct 2026, his own work now among it): the cards with money first, the largest sum first (an order's total, a payment's sum; the two RM 100 orders by age), then the rest
   oldest first, the cards with no age last in the order they are built */
const NOW_KEYS = ["p:ord-a1", "o:ord-p1", "o:ord-p3", "o:ord-p2", "c:" + U1 + ":c-1", "c:" + U1 + ":c-2", "g:row-1", "s", "u:/all/maker/inputs/loan", "l:w1", "m:" + U1, "k:" + U3,
  "a:ord-a2", "a:ord-x1", "x:0", "q:q-2", "n:" + U2];
/* Pending: money owed past term (RM 150) and his offer waiting on their yes (RM 110) */
const SOON_KEYS = ["$:CX1-ZED", "f:ord-p4"];
const PRACTICE_KEYS = ["m:" + PRACTICE, "c:" + PRACTICE + ":c-x", "o:ex-1"];
const WATCH_KEYS = ["w:hours", "w:notice"];
/* the loan the harness keeps unsent on this phone is a To do card too (Phase 4c), among those with an age */
const UNSENT = "u:/all/maker/inputs/loan";
/* from 860px the tests stub matchMedia as the page asks it, so a tap opens the card beside the list */
const wide = (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*860px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {} }); };

const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };

export async function run({ ok, pageWork }) {
  const open = async (state, extra = {}) => {
    const p = await richOwnerPage({ pageWork, ...busyDay(state), ...extra });
    await p.work.quiet();
    const d = p.d;
    p.cards = () => [...d.querySelectorAll("#nlist [data-need]")];
    p.card = (k) => d.querySelector('#nlist [data-need="' + k + '"]');
    p.keys = (sev) => p.cards().filter((c) => c.getAttribute("data-sev") === sev && !c.hasAttribute("data-practice")).map((c) => c.getAttribute("data-need"));
    /* a card since 22 Oct 2026: the kind word (then its age), who, the book's typed tag, the figure last, and what it says in full to a reader (its title's aria-label) */
    p.said = (c) => { const b = c && c.querySelector(".need-tap"); return b ? b.getAttribute("aria-label") : ""; };
    p.words = (c) => ({ kind: c.querySelector(".nkind").firstChild.textContent, who: c.querySelector(".need-who").textContent, said: p.said(c), age: (c.querySelector(".nage") || { textContent: "" }).textContent,
      fig: c.querySelector(".nfig").textContent, tag: (c.querySelector(".ntag") || { textContent: "" }).textContent });
    p.buttons = (c) => [...c.querySelectorAll("button:not(.need-tap)")].map((b) => b.textContent);
    p.todo = () => p.cards().filter((c) => c.getAttribute("data-sev") === "now" && !c.hasAttribute("data-practice")).length;
    p.counts = (bar) => Object.fromEntries([...d.querySelectorAll(bar + " [data-count]")].map((e) => [e.getAttribute("data-count"), e.textContent]));
    p.tap = async (act, key) => { const c = byAct(d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.where = () => {
      const place = (d.querySelector('.salt-appbar .place[aria-current="page"]') || { getAttribute: () => "" }).getAttribute("data-m");
      const part = (d.querySelector('.aparts[data-place="' + place + '"] [aria-selected="true"]') || { getAttribute: () => "" }).getAttribute("data-part");
      return place + (part ? "/" + part : "");
    };
    /* the 5-second read, as the page set it: the one live interval of that length */
    p.live = () => p.intervals.filter((i) => i.ms === 5000 && !i.off);
    p.tick = async () => { const t = p.live()[0]; if (t) t.f(); await p.work.quiet(); return !!t; };
    p.hide = (on) => { Object.defineProperty(d, "hidden", { configurable: true, get: () => on }); d.dispatchEvent(new p.w.Event("visibilitychange")); };
    return p;
  };
  const state = () => ({ approved: new Set(), newOrder: null });
  const pills = (c) => [...c.querySelectorAll(".salt-pill")].map((b) => b.textContent);

  /* 1. THE CARDS */
  let p = await open(state());
  try {
    const d = p.d;
    ok(same(p.keys("now"), NOW_KEYS) && same(p.keys("soon"), SOON_KEYS) && same(p.keys("watch"), WATCH_KEYS),
      "an order placed, a payment they say they sent, a message asked, a locked account and (his own work) the guest link, an ID with no account, the accounts not sent, a refused or unsent entry, "
      + "goods paid and not handed over and a step to send again are To do; money owed past term and his offer waiting on their yes are Pending; the override and the notice are FYI: "
      + JSON.stringify([p.keys("now"), p.keys("soon"), p.keys("watch")]));
    const SHAPE = ["salt-action__kind", "salt-action__body", "salt-action__go", "salt-action__money"];
    ok(p.cards().every((c) => c.classList.contains("salt-action") && c.classList.contains("salt-action--" + c.getAttribute("data-sev")) && c.classList.contains("ncard")
      && same([...c.children].map((x) => x.classList[0]), SHAPE) && c.querySelector(".nkind") && c.querySelector(".need-who") && c.querySelector(".nfig.salt-action__money--lg")
      && !c.querySelector(".salt-action__why, .need-what, .need-clock")),
    "every card is the system's Action recipe, coloured by its severity, of one shape: kind and age, the body, the go row and the figure, with no why line, no what line and no clock");
    const order = p.words(p.card("o:ord-p3")), pay = p.words(p.card("p:ord-a1")), claim = p.words(p.card("c:" + U1 + ":c-1")), msg = p.words(p.card("m:" + U1)), lock = p.words(p.card("k:" + U3));
    ok(order.kind === "Order" && order.who === "CX1-ZED" && order.said === "Order: Agree CX1-ZED's order, 1 unit · RM 100.00" && order.tag === "Salt" && order.fig === "RM 100" && order.age === "26 h",
      "a placed order says Order and its age in hours, who by code, the book as its typed tag, the figure last, and its sentence in full to a reader: " + JSON.stringify(order));
    ok(pay.kind === "Payment" && pay.said === "Payment: Confirm CX1-ZED's RM 530.00, Says they paid" && pay.age === "9 h" && pay.fig === "RM 530"
      && claim.kind === "Payment" && claim.said === "Payment: Confirm CX1-ZED's RM 50.00, Says they paid" && claim.age === "7 h" && claim.fig === "RM 50",
    "a payment they say they sent, on an order (the sum, the oldest) or against the account, says Payment, its sum as the figure: " + JSON.stringify([pay, claim]));
    ok(msg.kind === "Message" && msg.who === "CX1-ZED" && msg.said === "Message: Reply to CX1-ZED, Hello" && msg.age === "4 h" && msg.fig === ""
      && lock.kind === "Locked" && /^Locked: Send CX3-ZED a sign-in link, Locked out until \d\d:\d\d$/.test(lock.said) && lock.age === "5 min",
    "a message asked carries their words, a locked account the addresses refused and its age, neither a figure: " + JSON.stringify([msg, lock]));
    const link = p.words(p.card("l:w1"));
    ok(link.kind === "Link" && MADE_20H.test(link.said.replace(/^.*, (Made [^,]*)$/, "$1")) && link.age === "20 h" && p.card("l:w1").getAttribute("data-sev") === "now",
      "a guest link is To do, with its kind, when it was made and its age: " + JSON.stringify(link));
    /* 22 Oct 2026 (multi-tick Approve, his answer "no overlaps"): a Desk row to approve is no card here; Orders > Approve decides it, and the glance counts it */
    ok(p.cards().every((c) => !/^d:/.test(c.getAttribute("data-need"))) && !d.querySelector("#nlist [data-act='need.approve-row']"),
      "a Desk row waiting to be approved is no card in Needs you, and has no Approve pill there");
    ok(p.card("x:0") && p.card("q:q-2") && p.card("q:q-1") === null && p.card("x:0").getAttribute("data-sev") === "now" && p.card("q:q-2").getAttribute("data-sev") === "now"
      && p.words(p.card("x:0")).said === "Entry: Fix Desk's entry, Did not get through" && p.card("q:q-2").getAttribute("data-kind") === "rows"
      && p.card("a:ord-a2") && p.card("a:ord-a2").getAttribute("data-sev") === "now" && p.card("a:ord-a2").getAttribute("data-kind") === "orders",
    "an entry that did not get through (the drafter's refusal, a refused server entry, not a held one) and a stage he rejected are To do, his own work");
    ok(!p.card("w:desk") && !/The Desk shows/.test(d.getElementById("nlist").textContent) && p.words(p.card("w:hours")).said === "Hours: Shop, Paused until Fri 18:00" && p.words(p.card("w:notice")).said === "Notice: Shop, Open late"
      && p.card("w:hours").getAttribute("data-sev") === "watch",
    "FYI says \"Paused until Fri 18:00\" for the override in force and the notice set, and no card says only what the Desk counts (plan 1, part 5)");
    /* 1b. WHAT IS OWED, BOTH WAYS (plan 1, parts 3 and 4) */
    const owedM = p.words(p.card("$:CX1-ZED")), owedG = p.words(p.card("g:row-1"));
    ok(p.card("$:CX1-ZED").getAttribute("data-sev") === "soon" && p.card("$:CX1-ZED").getAttribute("data-kind") === "payments" && owedM.kind === "Owed" && owedM.who === "CX1-ZED"
      && owedM.said === "Owed: Collect RM 150.00 from CX1-ZED, Past term" && owedM.fig === "RM 150" && owedM.age === ageOf("2026-09-21") + " late" && !!p.card("$:CX1-ZED").querySelector(".nage--late") && same(p.buttons(p.card("$:CX1-ZED")), ["Message"]),
    "money owed past term is a Pending card: who, the Desk's figure as the figure, how late in ember, and one way, Message (their thread; Record payment stands in the opened card): " + JSON.stringify(owedM));
    ok(p.card("g:row-1").getAttribute("data-sev") === "now" && p.card("g:row-1").getAttribute("data-kind") === "orders" && owedG.kind === "To hand over" && owedG.who === "CX2-ZED"
      && owedG.said === "To hand over: Hand over to CX2-ZED, 1.5 units paid, not handed over" && owedG.tag === "Oil" && same(p.buttons(p.card("g:row-1")), ["Handover"]),
    "goods paid for and not handed over are a To do card: who, the book's typed tag, the units, and Handover: " + JSON.stringify(owedG));
    const offer = p.words(p.card("f:ord-p4"));
    ok(p.card("f:ord-p4").getAttribute("data-sev") === "soon" && p.card("f:ord-p4").getAttribute("data-kind") === "orders" && offer.kind === "Offer" && offer.tag === "Salt" && offer.fig === "RM 110"
      && /^Offer: Offer to CX1-ZED, Waits on their yes until /.test(offer.said) && same(p.buttons(p.card("f:ord-p4")), ["Withdraw"]) && !p.card("o:ord-p4"),
    "his offer waiting on their yes is a Pending card, kind Offer, the offer's sum as the figure, and its one button Withdraw, the order drawn no second time as an order to agree: " + JSON.stringify(offer));
    p.posts.length = 0;
    await p.tap("need.withdraw", "f:ord-p4");
    const wc = p.card("f:ord-p4");
    ok(!!wc && !!byAct(wc, "need.ask-yes", "f:ord-p4") && !!byAct(wc, "need.ask-no", "f:ord-p4") && !!wc.querySelector("p.nask") && wc.classList.contains("need--grow") && p.posts.length === 0,
      "Withdraw asks once on the card (Yes and Cancel, the card grown) and sends nothing: " + p.posts.length);
    await p.tap("need.ask-no", "f:ord-p4");
    ok(p.posts.length === 0 && !p.card("f:ord-p4").querySelector("p.nask") && !p.card("f:ord-p4").classList.contains("need--grow"), "and Cancel puts the card back, sending nothing");

    /* 2. THE RANKING */
    const order2 = p.cards().filter((c) => !c.hasAttribute("data-practice")).map((c) => c.getAttribute("data-sev"));
    const sevOrder = ["now", "soon", "watch"];
    ok(order2.every((s, i) => i === 0 || sevOrder.indexOf(order2[i - 1]) <= sevOrder.indexOf(s)),
      "To do comes before Pending and Pending before FYI: " + JSON.stringify(order2));
    ok(same(p.keys("now"), NOW_KEYS), "within To do the cards with money come first, the largest sum first (the two RM 100 orders by age), then the rest oldest first, none with no age before one with: " + JSON.stringify(p.keys("now")));
    ok(same(p.keys("soon"), SOON_KEYS), "within Pending the larger sum first: " + JSON.stringify(p.keys("soon")));
    const heads = [...d.querySelectorAll("#nlist .nsev")];
    ok(heads.map((h) => h.textContent).join() === "To do,Pending,FYI,Practice: 3" && heads.slice(0, 3).every((h) => h.tagName === "H2" && !/[0-9]/.test(h.textContent) && h.getAttribute("data-sev"))
      && same([...d.querySelectorAll("#nlist > section.ngroup")].map((g) => [g.getAttribute("data-sev"), g.getAttribute("aria-label"), g.firstElementChild === g.querySelector("h2.nsev")]), [["now", "To do", true], ["soon", "Pending", true], ["watch", "FYI", true]])
      && same([...d.querySelectorAll("#nlist > details")].map((x) => x.getAttribute("data-sev")), ["practice"]) && !d.querySelector("#nlist [data-act='need.fold.soon'], #nlist [data-act='need.fold.watch']"),
    "each group is a section headed by its one word, To do, Pending, FYI, with no count and never folded, and the practice line stands last: " + heads.map((h) => h.textContent).join());

    /* 3. PRACTICE (the lead is one Insight of what waits on his tap, and says nothing of practice) */
    const practice = p.cards().filter((c) => c.hasAttribute("data-practice"));
    ok(same(practice.map((c) => c.getAttribute("data-need")).sort(), PRACTICE_KEYS.slice().sort())
      && practice.every((c) => !/Practice/.test(c.textContent)) && !p.card("o:ord-p1").hasAttribute("data-practice"),
    "an item of a practice account is drawn, with no Practice chip on the card (the fold is its label), and no other is");
    /* part 2: practice accounts leave To do, Pending and FYI for one folded line at the foot, which opens them in place */
    const pfold = d.querySelector('#nlist > details.nfold[data-sev="practice"]');
    ok(!!pfold && !pfold.open && pfold === d.getElementById("nlist").lastElementChild && pfold.querySelector("summary").textContent === "Practice: 3"
      && practice.every((c) => pfold.contains(c)) && d.querySelectorAll("#nlist > details.nfold:not([data-sev=practice]) [data-practice]").length === 0,
    "practice accounts are one folded line at the foot, \"Practice: 3\", and no practice card stands among To do, Pending or FYI: " + (pfold && pfold.querySelector("summary").textContent));
    pfold.open = true; pfold.dispatchEvent(new p.w.Event("toggle")); await p.tap("need.kind.all");
    ok(d.querySelector('#nlist > details[data-sev="practice"]').open && d.querySelector("#nlist > details[data-sev=practice]").querySelectorAll("[data-need]").length === 3,
      "and the line opens them in place, and stays open through a redraw");
    d.querySelector('#nlist > details[data-sev="practice"]').open = false; d.querySelector('#nlist > details[data-sev="practice"]').dispatchEvent(new p.w.Event("toggle"));
    const lead = d.getElementById("nCount");
    ok(p.todo() === 17 && lead.classList.contains("salt-insight") && lead.classList.contains("salt-insight--copper") && lead.classList.contains("nlead")
      && lead.textContent.startsWith("RM 1,000 waits on your tap now: RM 600 to confirm, RM 400 to agree.") && !/to do now|soon/.test(lead.textContent),
    "the lead is one Insight of the money that waits on his tap now, summed off the payment and the placed-order cards of To do (RM 530 + 50 + 20 to confirm, RM 200 + 100 + 100 to agree), no practice item in it: " + lead.textContent);

    /* 4. THE COUNTS ON THE BARS */
    const rail = p.counts(".salt-rail"), bar = p.counts(".salt-appbar");
    ok(same(rail, { needs: "17", orders: "9", customers: "2", record: "", shop: "" }) && same(rail, bar) && +rail.needs === p.todo(),
      "Needs you counts the To do cards (his own work among them), Orders the open orders (not ended or completed), Customers the threads asked and the links waiting, "
      + "Record and Shop none, the same on the rail and on the bar, and no practice item in any: " + JSON.stringify([rail, bar]));
    ok(same([...d.querySelectorAll("#nGlance .nkpi")].map((k) => [k.getAttribute("data-glance"), k.querySelector(".salt-kpi__label").textContent]), [["ready", "Ready"], ["approve", "To approve"], ["owed", "Receivables"]])
      && [...d.querySelectorAll("#nGlance a.salt-kpi.salt-kpi--line")].length === 3 && d.querySelector('[data-glance="owed"] .salt-kpi__value').textContent === "RM 600" && !d.querySelector("#nGlance .salt-kpi__note, #nGlance [data-glance=stock], #nGlance [data-glance=lot]"),
    "the glance is three one-line tiles, Ready, To approve (the second) and Receivables, with no note and no stock tile");

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
      await open1("x:0", "orders/approve"), await open1("l:w1", "customers/links"),
      await open1("s", "customers/accounts", () => (byAct(d, "filter.unsent") || d.querySelector('#afil [data-f="unsent"]')).getAttribute("aria-pressed") === "true" ? "" : "the Not sent filter was not set"),
      await open1("w:hours", "shop/hours"), await open1("w:notice", "shop/notice")
    ].filter(Boolean);
    ok(opens.length === 0, "Open goes to the place and part of its kind, and opens the thing it is about: " + JSON.stringify(opens));
    byAct(d, "nav.needs").click(); await p.work.quiet();
    ok(p.cards().filter((c) => !byAct(c, "need.open")).length === 0, "every card has an Open");
    /* plan 1: Handover, on a row with no site order, opens Record's Correct a row on that row, as goods or cash moved */
    p.posts.length = 0;
    byAct(p.card("g:row-1"), "need.owed-hand", "row-1").click(); await p.work.quiet();
    const form = d.querySelector('#makerInputs [data-form="correct-a-row"]'), pick = form && form.querySelector('[data-act="record.amend.row"]'), kind = form && form.querySelector("input:checked[value=Fulfilment]");
    const pickSend = form && form.querySelector('[data-act="record.amend.send"]');
    ok(p.where() === "record/entry" && form && !form.hidden && pick && pick.value === "row-1" && !!kind && pickSend && pickSend.disabled === false,
      "Handover on a row with no site order opens Correct a row on that row, as goods or cash moved, its Send ready: " + JSON.stringify([p.where(), form && form.hidden, pick && pick.value, !!kind, pickSend && pickSend.disabled]));
    ok(p.posts.length === 0, "and it books nothing: " + JSON.stringify(p.posts.map((x) => x.route)));
    /* the card's one way on money owed is Message: it opens their thread and sends nothing */
    byAct(d, "nav.needs").click(); await p.work.quiet();
    byAct(p.card("$:CX1-ZED"), "need.owed-message", "CX1-ZED").click(); await p.work.quiet();
    ok(p.where() === "customers/messages" && shown(d.getElementById("makerChatOpen")) && p.posts.length === 0, "and Message on money owed opens their thread, sending nothing: " + p.where());

    /* 6. THE ONE FILLED PILL */
    byAct(d, "nav.needs").click(); await p.work.quiet();
    ok(same(pills(p.card("o:ord-p1")), ["Agree"]) && same(pills(p.card("m:" + U1)), ["Reply"]) && same(pills(p.card("p:ord-a1")), ["Review"]) && same(pills(p.card("c:" + U1 + ":c-1")), ["Received"]),
      "an order has Agree, a message Reply, a payment against the account Received, and an order with several payments Review, on the card: " + JSON.stringify([pills(p.card("o:ord-p1")), pills(p.card("m:" + U1)), pills(p.card("p:ord-a1"))]));
    /* 10. THE VERB FIRST, AND THE BUTTON ON THE CARD (17 Oct 2026, part 2; the sentence is the title's aria-label since 22 Oct 2026) */
    const TITLES = [["o:ord-p1", "Order: Agree CX1-ZED's order, 2 units · RM 200.00"], ["p:ord-a1", "Payment: Confirm CX1-ZED's RM 530.00, Says they paid"], ["c:" + U1 + ":c-1", "Payment: Confirm CX1-ZED's RM 50.00, Says they paid"],
      ["m:" + U1, "Message: Reply to CX1-ZED, Hello"], ["k:" + U3, "Locked: Send CX3-ZED a sign-in link, Locked out until "], ["a:ord-a2", "Order: Send CX1-ZED's order again, 1 unit · RM 100.00"],
      ["$:CX1-ZED", "Owed: Collect RM 150.00 from CX1-ZED, Past term"], ["g:row-1", "To hand over: Hand over to CX2-ZED, 1.5 units paid, not handed over"]];
    const got = TITLES.map(([k]) => (p.card(k) ? p.said(p.card(k)) : null));
    ok(got.every((t, i) => t !== null && t.startsWith(TITLES[i][1]) && (TITLES[i][1].endsWith(" ") || t === TITLES[i][1])),
      "each card's title says what to do, verb first, then who, in full to a reader: " + JSON.stringify(got));
    ok(p.words(p.card("o:ord-p1")).fig === "RM 200" && p.words(p.card("o:ord-p1")).tag === "Salt" && !/\b(now|tiers?|levels?)\b/i.test(p.card("o:ord-p1").innerHTML.replace(/<[^>]*>/g, " ")),   /* 19 Oct 2026: whole words, spaced at every tag */
      "and the figure is the card's last column, the book is its typed tag, and no level or tier word shows: " + JSON.stringify(p.words(p.card("o:ord-p1"))));
    ok(!p.cards().some((c) => p.buttons(c).some((t) => /Accept|Cash/.test(t))) && same(pills(p.card("g:row-1")), ["Handover"]) && same(pills(p.card("$:CX1-ZED")), ["Message"]),
      "no card carries Accept or Cash; goods owed has Handover filled and money owed Message, never Record payment on a card that has Message");
    ok(same(pills(p.card("l:w1")), ["Approve"]) && same(pills(p.card("k:" + U3)), ["Send"]) && same(pills(p.card("s")), ["Send"]) && same(pills(p.card("n:" + U2)), ["Show"])
      && byAct(p.card("k:" + U3), "need.signin-link").getAttribute("aria-label") === "Send a sign-in link" && byAct(p.card("s"), "need.send-turn").getAttribute("aria-label") === "Send sign-in links one by one"
      && byAct(p.card("n:" + U2), "need.show-link").getAttribute("aria-label") === "Show the guest price list",
    "the guest link, the refused account, the accounts not sent and the ID with no account keep the one filled action they had, shortened to Approve, Send, Send and Show, the long form kept for a reader");
    ok(p.cards().every((c) => pills(c).length <= 1), "no card has more than one filled pill");
    ok(p.cards().every((c) => c.querySelectorAll(".salt-action__go .nbtn").length === 1 && c.querySelector(".salt-action__go .nbtn").classList.contains("salt-pill--sm") && !c.classList.contains("need--act")),
      "a resting card has exactly one action, a small filled pill in its go row, the second choice (Decline, Show a code, Record payment) kept for the opened card");
    ok(p.cards().every((c) => !p.buttons(c).includes("Open") || c.getAttribute("data-need").startsWith("u:")) && !d.querySelector("#nlist button[data-act='need.open']:not(.need-tap)")
      && p.cards().filter((c) => byAct(c, "need.open")).every((c) => c.querySelector("button.need-tap.salt-action__title") && c.querySelector(".need-tap .need-who")),
    "a card has no Open button of its own (the unsent entry's pill is named Open, its act need.unsent): its title is the one tap (data-act need.open), and the card's own action stays beside it");
    ok(!d.querySelector("#nlist details[data-sev=soon], #nlist details[data-sev=watch]") && !d.querySelector("#nlist h2.nsev[data-act]"),
      "Pending and FYI are never folded, and no group heading has a tap");
  } finally { p.w.close(); }

  /* 1c. THE SECOND CHOICE AND THE WHY STAND IN THE OPENED CARD, from 860px: a tap opens it beside the list */
  p = await open(state(), { before: wide });
  try {
    const d = p.d, pane = () => d.querySelector("#nopen .npane");
    await p.tap("need.open", "$:CX1-ZED");
    const goes = () => [...d.querySelectorAll("#nopen .npane__go button")].map((b) => b.textContent + "/" + (b.getAttribute("aria-label") || ""));
    ok(!!pane() && /Handed over 20 Sep 2026, due 21 Sep 2026[.]/.test(pane().textContent) && same(goes(), ["Message/", "Record/Record payment"]) && same(p.buttons(p.card("$:CX1-ZED")), ["Message"]),
      "the opened card of money owed has the why (handed over, due) and both ways, Message and Record payment, while the resting card keeps Message alone: " + JSON.stringify(goes()));
    p.posts.length = 0;
    byAct(d, "need.owed-pay", "CX1-ZED").click(); await p.work.quiet();
    const moneyHead = d.querySelector('#makerReview [data-sect="money"]');
    ok(p.where() === "orders/ready" && !!d.querySelector('#makerOrderList [data-order="ord-r1"][aria-current="true"]') && moneyHead && moneyHead.textContent === "Money received" && d.activeElement === moneyHead && p.posts.length === 0,
      "Record payment opens the order the row is, on Money received, and books nothing: " + p.where() + " " + (d.activeElement && d.activeElement.textContent));
    byAct(d, "nav.needs").click(); await p.work.quiet();
    await p.tap("need.open", "x:0");
    ok(/Refused for the fixture/.test((pane() || { textContent: "" }).textContent) && !/Refused for the fixture/.test(p.card("x:0").textContent),
      "an entry's reason it did not get through stands in the opened card, and not on the resting card");
    await p.tap("need.open", "w:hours");
    ok(!!pane() && /Paused until Fri 18:00/.test(pane().querySelector(".npane__title").textContent) && /overridden for now/.test(pane().textContent), "the hours card opens its title in words and its why");
  } finally { p.w.close(); }

  /* 7. THE KIND CHIPS */
  p = await open(state());
  try {
    const d = p.d, chips = [...d.querySelectorAll(".nchips button")];
    ok(chips.map((b) => b.firstChild.textContent).join() === "All,Orders,Payments,Messages,Rows,Accounts" && chips.every((b) => /^need[.]kind[.]/.test(b.getAttribute("data-act")) && b.classList.contains("salt-nav__link") && b.classList.contains("nktab") && b.getAttribute("role") === "tab")
      && chips[0].getAttribute("aria-selected") === "true" && chips[0].classList.contains("salt-nav__link--active") && d.querySelector("nav.salt-nav.nkinds > .salt-nav__links.nchips").getAttribute("role") === "tablist" && !d.getElementById("nJump") && !d.getElementById("nJumpMenu") && !d.querySelector("[data-act^='need.jump']"),
    "the kinds are All, Orders, Payments, Messages, Rows and Accounts, a tablist of the system's Nav links, each with its act, All selected, and no Jump to beside them");
    ok(same(chips.map((b) => b.querySelector(".nktab__n").textContent), ["21", "7", "4", "1", "3", "4"]) && !chips.some((b) => b.querySelector(".salt-tabs__count")),
      "each kind carries its count of cards, practice apart (21 in all: 17 To do, 2 Pending, 2 FYI): " + chips.map((b) => b.textContent).join());
    p.reads.length = 0;
    const KO = ["all", "orders", "payments", "messages", "rows", "accounts"], visible = (dd) => [...dd.querySelectorAll(".nchips button")].filter((b) => !b.disabled).map((b) => b.getAttribute("data-chip"));
    ok(same(visible(d), KO), "with a card of every kind, every kind is on: " + visible(d));
    const kinds = {};
    for (const k of ["orders", "payments", "messages", "rows", "accounts"]) {
      await p.tap("need.kind." + k);
      kinds[k] = [...new Set(p.cards().map((c) => c.getAttribute("data-kind")))].join();
      if (kinds[k] !== k) kinds[k] = "BAD " + kinds[k];
    }
    ok(Object.values(kinds).every((v) => !v.startsWith("BAD")), "each chip shows its own kind of card and no other: " + JSON.stringify(kinds));
    ok(p.reads.length === 0 && p.posts.length === 0, "and filtering reads and sends nothing: " + JSON.stringify(p.reads));
    await p.tap("need.kind.rows");
    ok([...d.querySelectorAll(".nchips button")].map((b) => b.getAttribute("aria-selected")).join() === "false,false,false,false,true,false", "the kind he tapped is the one marked");
    /* the recipe draws the chosen Nav link from its --active class (the page sets it with aria-selected), so the mark is only as good as that selector */
    const SELECTED = ".salt-nav__link--active";
    ok(SITE_RECIPES.includes(SELECTED) && same([...d.querySelectorAll(".nchips button")].filter((b) => b.matches(SELECTED + '[aria-selected="true"]')).map((b) => b.getAttribute("data-chip")), ["rows"]),
      "and it alone is the one the system's Nav draws as the chosen link, so it looks different from the other five");
    await p.tap("need.kind.all");
    ok(p.cards().length === 12 + 10 + 2, "All shows every card again, Watch among them: " + p.cards().length);
    await p.tap("need.kind.orders");
    ok(!p.cards().some((c) => c.getAttribute("data-sev") === "watch") && same(p.counts(".salt-rail").needs, "17"), "FYI shows under All only, and a filter changes no count");
  } finally { p.w.close(); }

  /* 7b. A KIND WITH NOTHING IN IT IS OFF, NEVER HIDDEN */
  p = await open(state(), { threads: (j) => { j.threads = []; return j; } });
  try {
    const d = p.d, kinds = new Set(p.cards().map((c) => c.getAttribute("data-kind")));
    const tabs = [...d.querySelectorAll(".nchips button")];
    ok(!kinds.has("messages") && same(visible2(d), ["all", ...["orders", "payments", "messages", "rows", "accounts"].filter((k) => kinds.has(k))]) && !visible2(d).includes("messages")
      && tabs.length === 6 && tabs.every((b) => !b.hidden) && tabs.find((b) => b.getAttribute("data-chip") === "messages").disabled,
    "with no message waiting the Messages tab is disabled and still drawn, and each other kind present stays on: " + visible2(d));
  } finally { p.w.close(); }
  function visible2(dd) { return [...dd.querySelectorAll(".nchips button")].filter((b) => !b.disabled).map((b) => b.getAttribute("data-chip")); }

  /* 8. A READ THAT FAILED IS SAID */
  p = await open(state(), { failRoutes: [ROUTES.review, ROUTES.threads] });
  try {
    const d = p.d, line = d.getElementById("nCount").textContent, fail = d.getElementById("nFail"), home = d.getElementById("mHome");
    /* plan 1 (15 Oct 2026): the failed read leads the page, above the title, in plain words with a Retry */
    const lead = [...home.children].find((n) => !n.hidden && !n.classList.contains("salt-eyebrow"));
    ok(fail && !fail.hidden && lead === fail && fail.getAttribute("role") === "alert" && /^Couldn't read orders and rows and messages[.]/.test(fail.textContent)
      && byAct(fail, "need.retry") && byAct(fail, "need.retry").textContent === "Retry" && !p.card("o:ord-p1") && !p.card("m:" + U1) && p.card("c:" + U1 + ":c-1") && p.card("k:" + U3),
    "a failed read is the first thing on the page, \"Couldn't read orders and rows and messages.\" with a Retry, and the cards of what could be read stand: " + (fail && fail.textContent) + " | " + line);
    ok(!/Nothing needs you/.test(line) && !/could be read/.test(line) && /on your tap now/.test(line), "and the lead never says nothing needs him, and does not repeat what the banner says: " + line);
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
    ok(same(cat.owedMoney, m) && same(cat.owedGoods, r.owedGoods) && cat.today === "2026-10-05", "and the catalog Salt Admin reads carries both");
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
    ok(c && c.getAttribute("data-sev") === "now" && /1 queue entry unreadable: q:laptop-x/.test(p.said(c)) && p.card("o:ord-p1") && p.card("q:q-2"),
      "Needs you says \"1 queue entry unreadable: q:laptop-x\" as a To do card, and every other card stands: " + (c && c.textContent));
    byAct(d, "nav.orders").click(); await p.work.quiet(); byAct(d, "part.orders.approve").click(); await p.work.quiet();
    const line = d.querySelector("#makerQueueReview [data-unreadable]");
    ok(line && line.textContent === "1 queue entry unreadable: q:laptop-x", "and Orders > Approve's queue names it too: " + (line && line.textContent));
  } finally { p.w.close(); }

  /* 9. THE 5-SECOND READ */
  p = await open(state());
  try {
    const d = p.d;
    ok(p.live().length === 1, "Needs you sets one read every 5 seconds: " + JSON.stringify(p.intervals.map((i) => i.ms)));
    p.reads.length = 0;
    await p.tick();
    ok(same([...p.reads].sort(), [ROUTES.review, ROUTES.claims, ROUTES.threads, ROUTES.hours, ROUTES.bulletin, ROUTES.sheet, ROUTES.links, ROUTES.inputs, "/all/maker/stock"].sort()),
      "a tick on Needs you reads the orders and rows, the claims, the threads, the hours, the notice, the accounts, the links, what is owed and (22 Oct 2026, Stock by book) the stock, each once: " + JSON.stringify(p.reads));

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
    ok(!p.card("o:ord-new") && p.counts(".salt-rail").needs === "17", "(a day without the order)");
    s2.newOrder = { id: "ord-new", u: U1, status: "placed", mode: "collect", qty: 3, total: 300, product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], at: ago(0.1) };
    await p.tick();
    ok(p.card("o:ord-new") && p.card("o:ord-new").getAttribute("data-sev") === "now" && p.counts(".salt-rail").needs === "18" && p.counts(".salt-appbar").needs === "18" && p.counts(".salt-appbar").orders === "10"
      && p.todo() === 18 && p.d.getElementById("nCount").textContent.startsWith("RM 1,300 waits on your tap now: RM 600 to confirm, RM 700 to agree."),
    "an order placed since the last read is drawn at the next tick, counted on both bars and in the lead: " + p.d.getElementById("nCount").textContent);

    /* only while it shows, and the page is visible */
    byAct(p.d, "nav.customers").click(); await p.work.quiet();
    ok(p.live().length === 0, "entering Customers stops it");
    byAct(p.d, "nav.shop").click(); await p.work.quiet();
    ok(p.live().length === 0, "and Shop and Record are no different");
    byAct(p.d, "nav.orders").click(); await p.work.quiet();
    ok(p.live().length === 1, "Orders reads every 5 seconds too");
    p.reads.length = 0; await p.tick();
    ok(same([...p.reads].sort(), [ROUTES.claims, ROUTES.review].sort()), "and what it reads is the orders and the claims, nothing of the rest: " + JSON.stringify(p.reads));
    byAct(p.d, "nav.needs").click(); await p.work.quiet();
    p.hide(true);
    ok(p.live().length === 0, "a hidden page stops it");
    p.reads.length = 0;
    const ghost = p.intervals.filter((i) => i.ms === 5000).pop();
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
    ok(p.live().length === 1, "the 5-second read is running before the lapse");
    p.lapse(true);
    p.reads.length = 0;
    await p.tick();
    const during = p.reads.length;
    ok(d.body.classList.contains("ended") && !d.getElementById("aEnded").hidden && during > 0 && p.live().length === 0,
      "a lapse met by a poll gives the page way to Sign in again and clears the 5-second read: " + JSON.stringify([d.body.className, during, p.live().length]));
    p.reads.length = 0;
    p.hide(true); p.hide(false); await p.work.quiet();
    for (const i of p.live()) i.f();   /* the next 5 seconds, for any read still set */
    await p.work.quiet();
    ok(p.reads.length === 0 && p.live().length === 0,
      "and a page hidden then shown again, or any later 5 seconds, sends nothing and sets nothing again: " + JSON.stringify([p.reads, p.live().length]));
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
