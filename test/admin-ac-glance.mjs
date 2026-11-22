/* test/admin-ac-glance.mjs: SALT ADMIN A TO C, P7 (21 Oct 2026; docs/plan-counter-admin-ac.html; canvas V56 and V62). What is proved here, each
 * check red under its own mutation (test/admin-ac-glance.mutations.json):
 *   1  the glance heads Needs you (22 Oct 2026, canvas Needs you): three single-line KPI tiles, Ready (brass), To approve (copper) and Receivables
 *      (verdigris, was Owed to you): the orders ready with goods still to hand over, the cards waiting under Approve, and what the agreed orders still
 *      owe, goods and delivery less what is paid, with a meter of what is paid of what they come to; a practice order counts in none; each opens Orders.
 *      Stock cover and Next lot have left it. The tiles are one line, the value with no top margin; from 860px one row of three, 56px tall
 *   1b the lead is one Insight: what waits on his tap in money (payments to confirm, orders to agree), then the books that need stock off STOCK's lights
 *   2  each kind's choice says how many of it wait in the part he is in, practice apart, the same number its filter then shows
 *   3  22 Nov 2026 (the place head): the kinds are a pull-down menu at the head of the list (Ambient's filter), a pill reading Show and the kind chosen,
 *      its six choices each a tick, its word and its count; no strip of tabs and no Jump to
 *   4  a choice chooses its kind: it alone is pressed, ticked, named on the pill, and only its cards show; a kind with nothing waiting is
 *      dimmed and cannot be chosen
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { AMB_CSS, SITE_CSS } from "../stmt/statement-css.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const base = { u: "abcd-efgh", product: "salt", msgs: [], history: [], payments: [], paid: 0, delivery: 0, qty: 1, mode: "collect", at: "2026-10-10T02:00:00.000Z" };
const extra = [
  /* ready, part paid, with a delivery: RM 110 less RM 40 */
  { ...base, id: "ord-r9", status: "ready", mode: "deliver", total: 100, delivery: 10, paid: 40 },
  /* a practice order ready and owing, and one placed: neither counts */
  { ...base, id: "ord-t1", status: "ready", total: 100, test: true },
  { ...base, id: "ord-t2", status: "placed", total: 100, test: true }
];
const STOCK = { ok: true, today: "2026-10-22", books: { salt: { shelf: 11, free: 8.5, commit: 2.5, coverDays: 4, transit: 20, light: "green" },
  rice: { shelf: 6, free: 6, commit: 8, coverDays: 0, transit: 10, light: "amber" }, candy: { shelf: 0, free: 0, commit: 0, coverDays: null, transit: 0, light: "red" } }, by: {} };

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }), extra: (r) => (r === "/all/maker/stock" ? STOCK : undefined) });
  try {
    await p.work.quiet();
    const d = p.d, w = p.w, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.needs"));
    /* 1 */
    const g = d.getElementById("nGlance"), tiles = g ? [...g.children] : [];
    const read = tiles.map((a) => [a.getAttribute("data-glance"), a.className, t(a.querySelector(".amb-tile__label")), t(a.querySelector(".amb-tile__figure")), a.getAttribute("href")]);
    /* 16 Nov 2026, the move to Ambient (place F): the tiles are Ambient's, each a link to Orders; the hue of a book is on a mark alone, so a tile has no tone */
    ok(!!g && !g.hidden && g.classList.contains("amb-tiles") && J(read) === J([["ready", "amb-tile nkpi", "Ready", "4", "#orders/ready"], ["approve", "amb-tile nkpi", "To approve", "2", "#orders/approve"],
      ["owed", "amb-tile nkpi nkpi--owed", "Receivables", "RM 670", "#orders"]]) && tiles.every((a) => a.tagName === "A" && !/salt-/.test(a.outerHTML)),
      "the glance is Ready 4 (three ready and one part paid, the practice order apart), To approve 2 (a trip's two rows one card) and Receivables RM 670, goods and delivery less what is paid, three of Ambient's tiles each a link to Orders: " + J(read));
    const own = tiles[2], meter = own && own.querySelector("progress.amb-meter");
    ok(!!meter && meter.getAttribute("aria-hidden") === "true" && meter.value === 6 && meter.max === 100 && t(own.querySelector(".amb-tile__delta")) === "RM 40 paid of RM 710 agreed"
      && own.getAttribute("aria-label") === "Receivables, RM 670: RM 40 paid of RM 710 agreed",
      "Receivables carries the meter of what the agreed orders have paid of what they come to, RM 40 of RM 710, under its figure, and says so to a reader: " + (own && own.getAttribute("aria-label")));
    ok(!d.querySelector('#nGlance [data-glance="stock"], #nGlance [data-glance="lot"]'), "Stock cover and Next lot have left the glance (Stock by book carries them)");
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.amb-tiles \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(150px, 1fr\)\)/.test(AMB_CSS) && /\.amb-stack > \.amb-tiles \{ padding-inline: 0; \}/.test(css) && /a\.amb-tile \{ color: inherit; text-decoration: none; \}/.test(css)
      && !/\.adm \.nkpi/.test(css) && !/\.adm \.nglance/.test(css),
      "the tiles lie in Ambient's grid inside the head's stack, no gutter twice, a link in the ink with no underline, and no rule of the old KPI tile is left");
    /* 1b */
    const lead = d.getElementById("nCount"), bs = lead ? [...lead.querySelectorAll("b")].map(t) : [];
    /* 22 Nov 2026 (the place head): the lead is the headline under Needs you's head (its parts, then its status), no longer the hero's line; the hero holds the title alone */
    const hero = d.querySelector("#mHome > header.amb-hero");
    ok(!!lead && lead.tagName === "P" && lead.className === "amb-lead" && !!hero && J([...hero.children].map((e) => e.className)) === J(["amb-hero__title"])
      && !!lead.previousElementSibling && lead.previousElementSibling.matches("div.amb-head") && lead.previousElementSibling.previousElementSibling === hero && J(bs) === J(["RM 1,000", "2 books"])
      && t(lead) === "RM 1,000 waits on your tap now: RM 600 to confirm, RM 400 to agree. 2 books need stock: one is out, one is promised 2 units past its shelf.",
      "the lead is one Insight, the headline under the head: RM 1,000 waits on his tap, RM 600 of payments to confirm and RM 400 of orders to agree (the offer waiting on their yes is theirs), and two books need stock, one out and one promised 2 units past its shelf: " + t(lead));
    w.location.hash = "#orders/approve"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    const waiting = d.querySelectorAll("#makerDrafts .apcard").length;
    ok(waiting === 2, "To approve's 2 is the cards waiting under Approve: " + waiting);
    w.location.hash = "#orders/open"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    /* 16 Nov 2026, the move to Ambient (the red fix): the parts are Ambient's Segment, the chosen option pressed */
    const lit = d.querySelector('.aparts button[data-part="open"][aria-pressed="true"]');
    ok(!!lit && !d.getElementById("oOrders").hidden, "and Ready's tile lands on Orders at Open, which holds the ready orders");
    w.location.hash = "#needs"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    /* 2 */
    /* 22 Nov 2026 (the place head): the kinds are the choices of the menu at the list's head, and they count the cards of the part he is in (To do on entering), so a card shown is
       one in the group that is not hidden; the same is read again on FYI, where the cards of Watch are counted on their own part */
    const pills = [...d.querySelectorAll("#nKinds button[data-chip]")].filter((b) => b.getAttribute("aria-disabled") !== "true");
    const counts = {}, shown = {};
    const showing = () => String([...d.querySelectorAll("#nlist .ngroup:not([hidden]) [data-need]")].filter((c) => !c.closest('details[data-sev="practice"]')).length);
    for (const b of pills) {
      const k = b.getAttribute("data-chip");
      counts[k] = t(b.querySelector(".nkopt__n"));
      await click(b);
      shown[k] = showing();
    }
    await click(byAct(d, "need.kind.all"));
    const practice = d.querySelectorAll('#nlist details[data-sev="practice"] [data-need]').length;
    ok(pills.length >= 3 && J(counts) === J(shown) && +counts.all > 0 && practice >= 1,
      "each kind's choice says how many of it wait in To do, the number its filter then shows, practice cards apart (" + practice + " practice): " + J([counts, shown]));
    w.location.hash = "#needs/fyi"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    const fyi = [...d.querySelectorAll("#nKinds button[data-chip]")].filter((b) => b.getAttribute("aria-disabled") !== "true" && t(b.querySelector(".nkopt__n")) !== ""), fyiCounts = {}, fyiShown = {};
    for (const b of fyi) { const k = b.getAttribute("data-chip"); fyiCounts[k] = t(b.querySelector(".nkopt__n")); await click(b); fyiShown[k] = showing(); }
    await click(byAct(d, "need.kind.all"));
    const fyiCards = d.querySelectorAll('#nlist .ngroup[data-sev="watch"]:not([hidden]) [data-need]').length;
    ok(fyiCards > 0 && J(fyiCounts) === J(fyiShown) && fyiCounts.all === String(fyiCards) && fyiCounts.all !== counts.all,
      "and on FYI each kind counts the cards of FYI, which are not To do's: " + J([fyiCounts, fyiShown]));
    w.location.hash = "#needs"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    /* 3 */
    /* 22 Nov 2026 (the place head): the kinds are Ambient's pull-down filter, in a div.nkinds directly before the list, inside the queue's pane after the glance; no strip of tabs remains */
    const box = d.querySelector("div.nkinds > div.amb-filter"), fbtn = box && box.querySelector("button.amb-filter__btn"), menu = d.getElementById("nKinds"), tabs = menu ? [...menu.children] : [];
    ok(!!box && box.parentElement.nextElementSibling === d.getElementById("nlist") && !!box.closest(".amb-split--panes") && !!fbtn && fbtn.classList.contains("amb-pill") && fbtn.classList.contains("amb-pill--quiet") && fbtn.classList.contains("amb-pill--sm")
      && fbtn.getAttribute("aria-controls") === "nKinds" && fbtn.getAttribute("aria-expanded") === "false" && fbtn.getAttribute("data-act") === "need.kind.menu" && t(fbtn) === "Show All" && t(fbtn.querySelector(".amb-filter__value")) === "All"
      && !!fbtn.querySelector("svg") && menu.tagName === "DIV" && menu.classList.contains("amb-filter__menu") && menu.getAttribute("role") === "group" && menu.hidden
      && tabs.length === 6 && tabs.every((b) => b.tagName === "BUTTON" && b.classList.contains("amb-filter__opt") && b.classList.contains("nkopt") && b.hasAttribute("data-chip") && b.hasAttribute("aria-pressed") && /^need\.kind\./.test(b.getAttribute("data-act"))
        && b.firstElementChild.tagName.toLowerCase() === "svg" && b.children[1].className === "amb-filter__word" && b.lastElementChild.className === "amb-segment__count nkopt__n")
      && !d.getElementById("nJump") && !d.querySelector(".nchips, .salt-jump, .salt-tabs--track, nav.nkinds .nchips"),
      "the kinds are Ambient's pull-down filter at the head of the list: a pill reading Show and the kind chosen, a menu of six choices each a tick, its word and its count, and no strip of tabs and no Jump to: " + tabs.map(t).join(" | "));
    ok(/\.amb-filter__menu\[hidden\] \{ display: none; \}/.test(AMB_CSS) && /\.amb-filter__opt > \.amb-segment__count \{ margin-left: auto;/.test(AMB_CSS) && !/\.nchips/.test(css)
      && !/\.adm \.nkinds \.nchips/.test(css) && !/\.adm \.nktab\{display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:48px;[^}]*\}\s*\.adm \.nktab\[aria-selected/.test(css),
      "the menu opens and shuts by Ambient's own rule, the count stands at the end of its choice, and the old rules of the kinds' tabs and of their wrapped strip are gone");
    /* 4 */
    await click(fbtn); const opened = !menu.hidden && fbtn.getAttribute("aria-expanded") === "true";
    await click(byAct(d, "need.kind.payments"));
    const sel = tabs.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-chip"));
    const act = tabs.filter((b) => b.matches('.amb-filter__opt[aria-pressed="true"]')).map((b) => b.getAttribute("data-chip"));
    const kinds = [...new Set([...d.querySelectorAll("#nlist .ngroup:not([hidden]) [data-need]")].map((c) => c.getAttribute("data-kind")))];
    ok(opened && menu.hidden && J(sel) === J(["payments"]) && J(act) === J(["payments"]) && J(kinds) === J(["payments"]) && t(fbtn.querySelector(".amb-filter__value")) === "Payments"
      && /\.amb-filter__opt\[aria-pressed="true"\] > \.amb-icon \{ visibility: visible; \}/.test(AMB_CSS),
      "a choice chooses its kind: the pill opens the menu, the choice alone is pressed and ticked, the menu shuts, the pill names it, and only its cards show: " + J([opened, sel, act, kinds, t(fbtn)]));
    await click(byAct(d, "need.kind.all"));
  } finally { p.w.close(); }

  /* 4b: a kind with nothing waiting is dimmed and cannot be chosen */
  const q = await richOwnerPage({ pageWork, threads: (j) => ({ ...j, threads: [] }) });
  try {
    await q.work.quiet();
    const d = q.d;
    byAct(d, "nav.needs").click(); await q.work.quiet();
    const m = d.querySelector('#nKinds button[data-chip="messages"]'), o = d.querySelector('#nKinds button[data-chip="orders"]');
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(!!m && m.getAttribute("aria-disabled") === "true" && !m.disabled && !m.hidden && t(m.querySelector(".nkopt__n")) === "0" && o.getAttribute("aria-disabled") !== "true" && !/\.nkopt:disabled/.test(css)
      && /\.amb-filter__opt\[aria-disabled="true"\] \{ color: var\(--amb-ink-3\)/.test(AMB_CSS),
      "with no message waiting the Messages choice stays in its place at 0, aria-disabled (Ambient's filter draws it dimmed, no dimming rule of ours), and cannot be chosen, while Orders can");
    m.click(); await q.work.quiet();
    ok(m.getAttribute("aria-pressed") !== "true" && d.querySelector('#nKinds button[data-chip="all"]').getAttribute("aria-pressed") === "true", "and a tap on the dimmed Messages choice leaves him on All");
  } finally { q.w.close(); }
}
