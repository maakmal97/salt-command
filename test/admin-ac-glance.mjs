/* test/admin-ac-glance.mjs: SALT ADMIN A TO C, P7 (21 Oct 2026; docs/plan-counter-admin-ac.html; canvas V56 and V62). What is proved here, each
 * check red under its own mutation (test/admin-ac-glance.mutations.json):
 *   1  the glance heads Needs you (22 Oct 2026, canvas Needs you): three single-line KPI tiles, Ready (brass), To approve (copper) and Receivables
 *      (verdigris, was Owed to you): the orders ready with goods still to hand over, the cards waiting under Approve, and what the agreed orders still
 *      owe, goods and delivery less what is paid, with a meter of what is paid of what they come to; a practice order counts in none; each opens Orders.
 *      Stock cover and Next lot have left it. The tiles are one line, the value with no top margin; from 860px one row of three, 56px tall
 *   1b the lead is one Insight: what waits on his tap in money (payments to confirm, orders to agree), then the books that need stock off STOCK's lights
 *   2  each kind's tab says how many of it wait, practice apart, the same number its filter then shows
 *   3  22 Oct 2026 (canvas Needs you): the kinds are a text tab row on the system's Nav bar, six tabs three across on a phone and six wide, each
 *      48px tall with its count beside the word; Jump to is gone
 *   4  a tab chooses its kind: it alone is selected, on glass with a brass underline, and only its cards show; a kind with nothing waiting is
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
    ok(!!meter && meter.getAttribute("aria-hidden") === "true" && meter.value === 6 && meter.max === 100 && t(own.querySelector(".amb-tile__delta")) === "RM 40 paid of RM 710"
      && own.getAttribute("aria-label") === "Receivables, RM 670: RM 40 paid of RM 710 agreed",
      "Receivables carries the meter of what the agreed orders have paid of what they come to, RM 40 of RM 710, under its figure, and says so to a reader: " + (own && own.getAttribute("aria-label")));
    ok(!d.querySelector('#nGlance [data-glance="stock"], #nGlance [data-glance="lot"]'), "Stock cover and Next lot have left the glance (Stock by book carries them)");
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.amb-tiles \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(150px, 1fr\)\)/.test(AMB_CSS) && /\.amb-stack > \.amb-tiles \{ padding-inline: 0; \}/.test(css) && /a\.amb-tile \{ color: inherit; text-decoration: none; \}/.test(css)
      && !/\.adm \.nkpi/.test(css) && !/\.adm \.nglance/.test(css),
      "the tiles lie in Ambient's grid inside the head's stack, no gutter twice, a link in the ink with no underline, and no rule of the old KPI tile is left");
    /* 1b */
    const lead = d.getElementById("nCount"), bs = lead ? [...lead.querySelectorAll("b")].map(t) : [];
    /* 15 Nov 2026, the move to Ambient: the lead is the line under Needs you's title in its hero */
    ok(!!lead && lead.className === "amb-hero__sub" && !!lead.closest("#mHome > header.amb-hero") && J(bs) === J(["RM 1,000", "2 books"])
      && t(lead) === "RM 1,000 waits on your tap now: RM 600 to confirm, RM 400 to agree. 2 books need stock: one is out, one is promised 2 units past its shelf.",
      "the lead is one Insight: RM 1,000 waits on his tap, RM 600 of payments to confirm and RM 400 of orders to agree (the offer waiting on their yes is theirs), and two books need stock, one out and one promised 2 units past its shelf: " + t(lead));
    w.location.hash = "#orders/approve"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    const waiting = d.querySelectorAll("#makerDrafts .apcard").length;
    ok(waiting === 2, "To approve's 2 is the cards waiting under Approve: " + waiting);
    w.location.hash = "#orders/open"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    /* 16 Nov 2026, the move to Ambient (the red fix): the parts are Ambient's Segment, the chosen option pressed */
    const lit = d.querySelector('.aparts button[data-part="open"][aria-pressed="true"]');
    ok(!!lit && !d.getElementById("oOrders").hidden, "and Ready's tile lands on Orders at Open, which holds the ready orders");
    w.location.hash = "#needs"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    /* 2 */
    const pills = [...d.querySelectorAll(".nchips button")].filter((b) => b.getAttribute("aria-disabled") !== "true");
    const counts = {}, shown = {};
    for (const b of pills) {
      const k = b.getAttribute("data-chip");
      counts[k] = t(b.querySelector(".nkopt__n"));
      await click(b);
      shown[k] = String([...d.querySelectorAll("#nlist [data-need]")].filter((c) => !c.closest('details[data-sev="practice"]') && c.getAttribute("data-sev") !== "watch").length);
    }
    await click(byAct(d, "need.kind.all"));
    const practice = d.querySelectorAll('#nlist details[data-sev="practice"] [data-need]').length;
    ok(pills.length >= 3 && J(counts) === J(shown) && +counts.all > 0 && practice >= 1,
      "each kind's tab says how many of it wait, the number its filter then shows, practice cards apart (" + practice + " practice): " + J([counts, shown]));
    /* 3 */
    const strip = d.querySelector(".nchips"), tabs = strip ? [...strip.children] : [];
    ok(!!strip && strip.classList.contains("amb-segment") && strip.classList.contains("amb-segment--wrap") && strip.getAttribute("role") === "group" && strip.tagName === "DIV"
      && tabs.length === 6 && tabs.every((b) => b.classList.contains("amb-segment__opt") && b.classList.contains("nkopt") && b.lastElementChild.className === "amb-segment__count nkopt__n" && b.firstChild.nodeType === 3)
      && !d.getElementById("nJump") && !d.querySelector(".salt-jump, .salt-tabs--track, nav.nkinds .nchips"),
      "the kinds are Ambient's counted filters, six options in a wrapped Segment, each its word with the count beside it, and no Jump to: " + tabs.map(t).join(" | "));
    ok(/\.amb-segment--wrap \{ flex-wrap: wrap;/.test(AMB_CSS) && !/\.adm \.nkinds \.nchips/.test(css) && !/\.adm \.nktab\{display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:48px;[^}]*\}\s*\.adm \.nktab\[aria-selected/.test(css),
      "the filters wrap in rows by Ambient's own rule, and the old grid of tabs is gone");
    /* 4 */
    await click(byAct(d, "need.kind.payments"));
    const sel = tabs.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-chip"));
    const act = tabs.filter((b) => b.matches('.amb-segment--wrap > .amb-segment__opt[aria-pressed="true"]')).map((b) => b.getAttribute("data-chip"));
    const kinds = [...new Set([...d.querySelectorAll("#nlist [data-need]")].map((c) => c.getAttribute("data-kind")))];
    ok(J(sel) === J(["payments"]) && J(act) === J(["payments"]) && J(kinds) === J(["payments"])
      && /\.amb-segment--wrap > \.amb-segment__opt\[aria-pressed="true"\] \{ border-color: var\(--amb-pill\); color: var\(--amb-on-pill\); \}/.test(AMB_CSS),
      "a filter chooses its kind: it alone is pressed, drawn as Ambient's chosen filter, and only its cards show: " + J([sel, act, kinds]));
    await click(byAct(d, "need.kind.all"));
  } finally { p.w.close(); }

  /* 4b: a kind with nothing waiting is dimmed and cannot be chosen */
  const q = await richOwnerPage({ pageWork, threads: (j) => ({ ...j, threads: [] }) });
  try {
    await q.work.quiet();
    const d = q.d;
    byAct(d, "nav.needs").click(); await q.work.quiet();
    const m = d.querySelector('.nchips button[data-chip="messages"]'), o = d.querySelector('.nchips button[data-chip="orders"]');
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(!!m && m.getAttribute("aria-disabled") === "true" && !m.disabled && !m.hidden && t(m.querySelector(".nkopt__n")) === "0" && o.getAttribute("aria-disabled") !== "true" && !/\.nchips > \.amb-segment__opt:disabled/.test(css),
      "with no message waiting the Messages tab stays in its place at 0, aria-disabled (Ambient 0.7.5 draws it dimmed, no dimming rule of ours), and cannot be chosen, while Orders can");
  } finally { q.w.close(); }
}
