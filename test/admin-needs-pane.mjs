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
 *   6  the page's rules: 360px beside the list, 420px from 1440px where the shell widens to 1376px, the pane level with the first card
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const wide = (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*860px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {} }); };

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
    ok(!pane().hidden && !!head && !!kind && kind.classList.contains("salt-eyebrow--copper") && /^Order · \d+ d$/.test(t(kind)) && t(head.querySelector(".npane__title")) === "Agree CX1-ZED's order"
      && t(head.querySelector(".npane__what .salt-producttag")) === "Salt" && t(head.querySelector(".npane__what")) === "Salt2 units · RM 200.00"
      && J([...d.querySelectorAll("#nlist [aria-current]")].map((c) => c.getAttribute("data-need"))) === J(["o:ord-p1"]),
      "a tap opens that card beside the list, alone marked current: its kind and age in To do's copper, the title in words, what it is with its typed tag: " + t(head));
    /* 3 */
    const low = pane().querySelector(".npane-x"), oc = low && low.querySelector(".maker-card");
    const grid = oc && oc.querySelector(".oagree"), fields = grid ? [...grid.children].filter((x) => !x.hidden).map((x) => t(x.querySelector(".salt-field__label")) || "line") : [];
    const fee = oc && byAct(oc, "order.fee");
    ok(!!oc && !oc.querySelector("details.ordfold--rowed") && !byAct(oc, "order.terms") && J(fields) === J(["Goods, RM", "Delivery, RM", "When", "line"])
      && !!fee && fee.value === "" && t(fee.options[fee.selectedIndex]) === "Choose" && !!head && !head.querySelector(".npane__go") && !!byAct(oc, "order.decline"),
      "the order's own card stands under it, its terms in view, Goods and Delivery then When, Delivery at Choose, and its ways are the order card's: " + J(fields));
    /* 4 */
    const goOf = async (k) => { await click(card(k).querySelector(".need-tap")); return [...pane().querySelectorAll(".npane__go button")].map((b) => [t(b), b.classList.contains("salt-pill") ? "pill" : b.classList.contains("salt-ghost") ? "ghost" : "?"]); };
    const link = await goOf("l:w1"), lock = await goOf("k:tvwx-yz23"), claim = await goOf("c:abcd-efgh:c-1");
    ok(J(link) === J([["Approve", "pill"], ["Decline", "ghost"]]) && J(lock.map((x) => x[0])) === J(["Send", "Show a code"]) && J(claim) === J([["Received", "pill"], ["Open the claim", "ghost"]])
      && !!pane().querySelector(".npane-x .oacct") === false,
      "any other card carries every way of its row, the first filled and the second choice a ghost: " + J([link, lock, claim]));
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
    const wd = pane().querySelector('.npane__go [data-act="need.withdraw"]');
    await click(wd);
    ok(!!wd && !!pane().querySelector(".npane .nask") && J([...pane().querySelectorAll(".npane__go button")].map(t)) === J(["Yes", "Cancel"]),
      "the Offer card keeps its ask-once Withdraw beside the list, Yes and Cancel under its question");
    await click(pane().querySelector('.npane__go [data-act="need.ask-no"]'));
    await tapOn("p:ord-a1");
    const pc = card("p:ord-a1"); if (pc) await click(byAct(pc, "need.review") || byAct(pc, "need.received"));
    ok(!!pc && !pane().querySelector(".npane .nask, .npane .npane__go"), "an order's head asks nothing of its own; its card under it holds the ways");
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
    ok(was && q.d.getElementById("nopen").hidden && !q.d.querySelector("#nopen .npane"), "a card gone from the list closes the pane");
  } finally { q.w.close(); }

  /* 6 */
  const css = (await import("../stmt/page.js")).landingPage("", "pane-nonce", { master: "", accounts: [] }).match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
  ok(/\.adm \.nsplit\{grid-template-columns:minmax\(0,1fr\) 360px\}/.test(css) && /@media \(min-width:1440px\)\{\.gate\.adm\{max-width:1376px\}\.adm \.nsplit\{grid-template-columns:minmax\(0,1fr\) 420px\}\}/.test(css)
    && /\.adm #nopen\{margin-top:calc\(0\.75rem \* 1\.4 \+ 10px\)/.test(css) && /\.adm \.ngroup\{display:flex;flex-direction:column;gap:10px\}/.test(css) && /\.adm #mHome \.nlist \.nsev\{margin:0;line-height:1\.4\}/.test(css)
    && css.indexOf("@media (min-width:1440px){.gate.adm{max-width:1376px}") > css.indexOf(".gate.adm{max-width:1180px;"),
    "the pane is 360px beside the list and 420px from 1440px, where the shell widens to 1376px, and starts level with the first card, under its group's 1.4-line heading and the 10px gap");
}
