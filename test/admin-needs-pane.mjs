/* test/admin-needs-pane.mjs: SALT ADMIN NEEDS YOU, P6, THE OPEN CARD BESIDE THE LIST (22 Oct 2026; his canvas Needs you). What is proved here, each check
 * red under its own mutation (test/admin-needs-pane.mutations.json):
 *   1  on a phone a card's tap goes to its place, as before, and no pane is drawn
 *   2  from 860px nothing opens by itself; a tap opens that card beside the list, marked current alone: its kind and age in its group's tone, the title in
 *      words verb first, what it is with the book's typed tag, and its why
 *   3  an order's card stands under it with its terms in view (no Change terms fold): the Agree inputs two by two, Goods and Delivery, then When, and
 *      Delivery starts at Choose; the head draws no ways of its own, the order's card carries them
 *   4  any other card carries every way of its row, the second choice among them (Decline, Show a code, Open the claim), the first filled
 *   5  a poll that changes the order redraws the card under it, but never while a field of it is in use; a card gone from the list closes the pane
 *   5b (Fable's review of 22 Oct 2026) a tap in the order's card does not hold it: the next change redraws it; an answer to that card lands on its
 *      own line beside Needs you; the Offer card keeps its ask-once Withdraw in the pane, and an order's head asks nothing of its own
 *   6  the page's rules: 360px beside the list, 420px from 1440px, the shell at salt-ds's one page width (1376px, test/page-width.mjs), the pane level with the first card
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const wide = (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*960px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {} }); };

export async function run({ ok, pageWork }) {
  /* 1 */
  const ph = await richOwnerPage({ pageWork });
  try {
    await ph.work.quiet();
    byAct(ph.d, "nav.needs").click(); await ph.work.quiet();
    ph.d.querySelector('#nlist [data-need="o:ord-p1"] .need-tap').click(); await ph.work.quiet();
    const on = ph.d.querySelector('button[data-m][aria-current="page"]');
    ok(!!on && on.getAttribute("data-m") === "orders" && ph.d.getElementById("nopen").hidden && !ph.d.querySelector("#nopen .npane"),
      "on a phone a card's tap goes to its place (an order to Orders) and no pane is drawn: " + (on && on.getAttribute("data-m")));
  } finally { ph.w.close(); }

  let total = 200, st = "placed";
  const p = await richOwnerPage({ pageWork, before: wide, probe: true, review: (j) => ({ ...j, orders: (j.orders || []).map((o) => (o.id === "ord-p1" ? { ...o, mode: "deliver", at: "2026-10-10T02:00:00.000Z", total, status: st } : o)) }) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.needs"));
    const pane = () => d.getElementById("nopen"), card = (k) => d.querySelector('#nlist [data-need="' + k + '"]');
    const tick = async () => { p.intervals.filter((i) => i.ms === 5000 && !i.off).forEach((i) => i.f()); await p.work.quiet(); };
    /* 2 */
    ok(pane().hidden && !d.querySelector("#nlist [aria-current]"), "from 860px nothing opens by itself");
    await click(card("o:ord-p1").querySelector(".need-tap"));
    const head = pane().querySelector(".npane"), kind = head && head.querySelector(".npane__kind");
    ok(!pane().hidden && !!head && !!kind && kind.classList.contains("amb-task__kind") && t(head.querySelector(".amb-task__head > .amb-chip")) === "Due" && head.classList.contains("amb-task--warn") && /^Order · \d+ d$/.test(t(kind)) && t(head.querySelector(".npane__title")) === "Agree CX1-ZED's order"
      && t(head.querySelector(".npane__what .amb-chip")) === "Salt" && t(head.querySelector(".npane__what")) === "Salt 2 units · RM 200.00"
      && J([...d.querySelectorAll("#nlist [aria-current]")].map((c) => c.getAttribute("data-need"))) === J(["o:ord-p1"]),
      "a tap opens that card beside the list, alone marked current: its kind and age with the state's word, the title in words, what it is with its book's chip: " + t(head));
    /* 3 */
    const low = pane().querySelector(".npane-x"), oc = low && low.querySelector(".maker-card");
    /* 2 Nov 2026 (his Orders canvas, page 2): Goods, Delivery and When are rows of one settings list (label at the left, input at the right), then the foot line */
    const grid = oc && oc.querySelector(".oagree"), fields = grid ? [...grid.querySelectorAll("label.amb-field:not([hidden])"), ...grid.querySelectorAll(":scope > p.amb-field__hint")].map((x) => x.matches("label") ? t(x.querySelector(".amb-field__label")) : "line") : [];
    const fee = oc && byAct(oc, "order.fee");
    ok(!!oc && !oc.querySelector("details.ordfold--rowed") && !byAct(oc, "order.terms") && J(fields) === J(["Goods, RM", "Units", "Way", "Delivery, RM", "When", "line"])
      && !!fee && fee.value === "" && t(fee.options[fee.selectedIndex]) === "Choose" && !!head && !head.querySelector(".npane__go") && !!byAct(oc, "order.decline"),
      "the order's own card stands under it, its terms in view, Goods, Units and Way then Delivery and When, Delivery at Choose, and its ways are the order card's: " + J(fields));
    /* 4 */
    /* 16 Nov 2026, the move to Ambient (place F): the first filled way is the record's one main action, the foot of its column; every other way a quiet pill in the card; read main first */
    const ways = () => [...d.querySelectorAll("#nrecord > .npane__go button, #nopen .npane__acts button")];
    const goOf = async (k) => { await click(card(k).querySelector(".need-tap")); return ways().map((b) => [t(b), b.classList.contains("amb-pill--quiet") ? "ghost" : "pill"]).sort((a, b) => (a[1] === "pill" ? 0 : 1) - (b[1] === "pill" ? 0 : 1)); };
    const link = await goOf("l:w1"), lock = await goOf("k:tvwx-yz23"), claim = await goOf("c:abcd-efgh:c-1");
    ok(J(link) === J([["Approve", "pill"], ["Decline", "ghost"]]) && J(lock.map((x) => x[0])) === J(["Send", "Show a code"]) && J(claim) === J([["Received", "pill"], ["Open the claim", "ghost"]])
      && !!pane().querySelector(".npane-x .oacct") === false,
      "any other card carries every way of its row, the first the foot's one main action and the second choice a quiet pill: " + J([link, lock, claim]));
    /* 16 Nov 2026, Ambient 0.7.5 (place F): while the save bar shows, saving is the one main action and no record has a foot, so the open card's goes and comes back */
    const footN = () => d.querySelectorAll("#nrecord > .npane__go").length, had = footN();
    p.w.__owner("document.getElementById('apBar').hidden=false; drawNeedOpen(true);"); const during = footN();
    p.w.__owner("document.getElementById('apBar').hidden=true; drawNeedOpen(true);");
    ok(had === 1 && during === 0 && footN() === 1, "while the Confirm bar shows the open card has no foot, and has it again when the bar goes: " + J([had, during, footN()]));
    await click(card("k:tvwx-yz23").querySelector(".need-tap"));
    ok(!!pane().querySelector(".npane-x .oacct"), "an account's card stands under a card about that account");
    /* 5 */
    await click(card("o:ord-p1").querySelector(".need-tap"));
    const before = pane().querySelector(".npane-x .maker-card"), goods = before && byAct(before, "order.total");
    if (goods) goods.focus(); total = 210; await tick();
    ok(!!before && pane().querySelector(".npane-x .maker-card") === before, "a poll that changes the order keeps its card while a field of it is in use");
    if (goods) goods.blur(); d.body.focus(); total = 220; await tick();
    const after = pane().querySelector(".npane-x .maker-card"), got = after && byAct(after, "order.total");
    ok(!!got && after !== before && got.value === "220", "and redraws it once the field is let go: " + (got && got.value));
    /* 5b */
    const lbl = after && after.querySelector(".oagree .salt-field__label");
    if (lbl) lbl.click(); d.body.focus(); total = 230; await tick();
    const again = pane().querySelector(".npane-x .maker-card"), got2 = again && byAct(again, "order.total");
    ok(!!got2 && again !== after && got2.value === "230", "a tap in the order's card does not hold it: the next change redraws it: " + (got2 && got2.value));
    p.w.__owner("makerSay('ord-p1','Answered here.')");
    const line = pane().querySelector('.npane-x [data-maker-say="ord-p1"]');
    ok(!!line && t(line) === "Answered here.", "an answer to the order's card lands on its own line beside Needs you: " + (line && t(line)));
    const tapOn = async (k) => { const c = card(k); if (c) await click(c.querySelector(".need-tap")); };
    await tapOn("f:ord-p4");
    const wd = d.querySelector('#nrecord [data-act="need.withdraw"]');
    await click(wd);
    ok(!!wd && !!pane().querySelector(".npane .nask") && J(ways().map(t).sort()) === J(["Cancel", "Yes"]),
      "the Offer card keeps its ask-once Withdraw beside the list, Yes and Cancel under its question");
    await click(d.querySelector('#nrecord [data-act="need.ask-no"]'));
    await tapOn("p:ord-a1");
    const pc = card("p:ord-a1"); if (pc) await click(byAct(pc, "need.review") || byAct(pc, "need.received"));
    ok(!!pc && !pane().querySelector(".npane .nask") && ways().length === 0, "an order's head asks nothing of its own; its card under it holds the ways");
    await tapOn("o:ord-p1");
    p.w.__owner("makerSay('ord-p1','Agreed and sent to the Desk.')"); st = "acknowledged"; await tick();
    const said = pane().querySelector(".npane__said");
    ok(!card("o:ord-p1") && !pane().hidden && !!said && t(said) === "Agreed and sent to the Desk.", "a tap that moves its order on keeps that order's answer in the pane: " + (said && t(said)));
  } finally { p.w.close(); }

  /* 5b: a card gone from the list closes the pane */
  let threads = [{ u: "abcd-efgh", msgs: [{ by: "customer", at: "2026-10-10T02:00:00.000Z", text: "Hello" }], quiet: null }];
  const q = await richOwnerPage({ pageWork, before: wide, threads: (j) => ({ ...j, threads }) });
  try {
    await q.work.quiet();
    byAct(q.d, "nav.needs").click(); await q.work.quiet();
    q.d.querySelector('#nlist [data-need="m:abcd-efgh"] .need-tap').click(); await q.work.quiet();
    const was = !q.d.getElementById("nopen").hidden;
    threads = []; q.intervals.filter((i) => i.ms === 5000 && !i.off).forEach((i) => i.f()); await q.work.quiet();
    ok(was && q.d.getElementById("nopen").hidden && !q.d.querySelector("#nopen .npane") && !q.d.querySelector("#nrecord > .npane__go"), "a card gone from the list closes the pane, and its foot");
  } finally { q.w.close(); }

  /* 6 */
  /* 16 Nov 2026, the move to Ambient (place F): the columns are Ambient's split (two from 960px); the page says the list's stack and the record's, the record empty until a tap with its words, its one main action its foot */
  const page = (await import("../stmt/page.js")).landingPage("", "pane-nonce", { master: "", accounts: [] });
  const css = page.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
  /* 16 Nov 2026, the move to Ambient (0.7.8, nested places): the queue and the card are Ambient's panes, Stock by book closing the queue's pane.
     17 Nov 2026, the move to Ambient (Fable's review): the glance heads the queue's pane (item 3) and the empty pane is Shop's form, a head over a one-row card (item 10) */
  ok(/<div class="amb-split amb-split--panes nsplit"><div class="amb-stack"><div class="nglancebox" id="nGlanceBox" hidden><h2 class="amb-section">At a glance<\/h2><section id="nGlance" class="amb-tiles nglance" aria-label="At a glance" hidden><\/section><\/div><div id="nlist" class="nlist"><\/div><section id="nStock" class="amb-stack nstock" aria-label="Stock by book" hidden><\/section><\/div><div class="amb-stack" id="nrecord"><div id="nopen" class="nopen" aria-label="The open card" hidden><\/div><div class="amb-settings rnone panenone"><h3 class="amb-settings__head">No card open<\/h3><ul class="amb-settings__list"><li><div class="amb-setting"><span class="amb-setting__name">Choose a card to see it in full\.<\/span><\/div><\/li><\/ul><\/div><\/div><\/div>/.test(page)
    && /\.panenone \{ display: none; margin: 0; color: var\(--amb-ink-2\); \}/.test(css) && /@media \(min-width: 960px\) \{ \.panenone \{ display: block; \} #nopen:not\(\[hidden\]\) ~ \.panenone \{ display: none; \} \}/.test(css)
    && /\.ntask \.need-tap/.test(css),
    "the open card stands in the record's column of Ambient's split from 960px, the column saying Choose a card to see it in full until a tap");
}
