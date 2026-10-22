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
import { SITE_RECIPES } from "../stmt/statement-css.js";

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
  rice: { shelf: 6, free: -2, commit: 8, coverDays: 0, transit: 10, light: "yellow" }, candy: { shelf: 0, free: 0, commit: 0, coverDays: null, transit: 0, light: "red" } }, by: {} };
const rule = (sel) => { const m = SITE_RECIPES.match(new RegExp("(^|[}\\s])" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{([^}]*)\\}")); return m ? m[2] : ""; };

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }), extra: (r) => (r === "/all/maker/stock" ? STOCK : undefined) });
  try {
    await p.work.quiet();
    const d = p.d, w = p.w, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.needs"));
    /* 1 */
    const g = d.getElementById("nGlance"), tiles = g ? [...g.children] : [];
    const read = tiles.map((a) => [a.getAttribute("data-glance"), a.className, t(a.querySelector(".salt-kpi__label")), t(a.querySelector(".salt-kpi__value")), a.getAttribute("href")]);
    ok(!!g && !g.hidden && J(read) === J([["ready", "salt-kpi salt-kpi--line salt-kpi--brass nkpi", "Ready", "4", "#orders/ready"], ["approve", "salt-kpi salt-kpi--line salt-kpi--copper nkpi", "To approve", "2", "#orders/approve"],
      ["owed", "salt-kpi salt-kpi--line salt-kpi--verdigris nkpi nkpi--owed", "Receivables", "RM 670", "#orders"]]) && tiles.every((a) => a.tagName === "A" && !a.querySelector(".salt-kpi__note")),
      "the glance is Ready 4 (three ready and one part paid, the practice order apart), To approve 2 (a trip's two rows one card) and Receivables RM 670, goods and delivery less what is paid, three KPI tiles each a link to Orders and no note: " + J(read));
    const own = tiles[2], fill = own && own.querySelector(".salt-meter .salt-meter__fill");
    ok(!!fill && own.querySelector(".salt-meter").getAttribute("aria-hidden") === "true" && fill.style.getPropertyValue("--salt-fill") === "6"
      && own.children[1] === own.querySelector(".salt-meter") && own.getAttribute("aria-label") === "Receivables, RM 670: RM 40 paid of RM 710 agreed",
      "Receivables carries the meter of what the agreed orders have paid of what they come to, RM 40 of RM 710, between its label and its figure, and says so to a reader: " + (own && own.getAttribute("aria-label")));
    ok(!d.querySelector('#nGlance [data-glance="stock"], #nGlance [data-glance="lot"]'), "Stock cover and Next lot have left the glance (Stock by book carries them)");
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const line = (sel) => { const i = css.indexOf(sel + " {"); return i < 0 ? "" : css.slice(i, css.indexOf("}", i)); };
    ok(/display: flex/.test(line(".salt-kpi--line")) && /justify-content: space-between/.test(line(".salt-kpi--line")) && /white-space: nowrap/.test(line(".salt-kpi--line .salt-kpi__label, .salt-kpi--line .salt-kpi__value"))
      && /margin: 0/.test(line(".salt-kpi--line .salt-kpi__label, .salt-kpi--line .salt-kpi__value")) && /min-height: 56px/.test(css.slice(css.indexOf("@media (min-width: 860px) { .salt-kpi--line")))
      && /@media \(min-width:860px\)\{\s*\.adm \.nglance\{grid-template-columns:1fr 1fr 2\.4fr;gap:12px\}/.test(css) && !/\.adm \.nkpi[^{]*\{[^}]*(font-size|min-height|padding)/.test(css),
      "each tile is one centred line, the value with no top margin and nothing wrapping, and from 860px the three stand in one row, 56px tall");
    /* 1b */
    const lead = d.getElementById("nCount"), bs = lead ? [...lead.querySelectorAll("b")].map(t) : [];
    ok(!!lead && lead.className === "salt-insight salt-insight--copper nlead" && J(bs) === J(["RM 1,000", "2 books"])
      && t(lead) === "RM 1,000 waits on your tap now: RM 600 to confirm, RM 400 to agree. 2 books need stock: one is out, one is promised 2 units past its shelf.",
      "the lead is one Insight: RM 1,000 waits on his tap, RM 600 of payments to confirm and RM 400 of orders to agree (the offer waiting on their yes is theirs), and two books need stock, one out and one promised 2 units past its shelf: " + t(lead));
    w.location.hash = "#orders/approve"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    const waiting = d.querySelectorAll("#makerDrafts .apcard").length;
    ok(waiting === 2, "To approve's 2 is the cards waiting under Approve: " + waiting);
    w.location.hash = "#orders/ready"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    const lit = d.querySelector('.aparts button[data-part="ready"][aria-selected="true"]');
    ok(!!lit && !d.getElementById("oOrders").hidden, "and Ready's tile lands on Orders at the Ready stage");
    w.location.hash = "#needs"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    /* 2 */
    const pills = [...d.querySelectorAll(".nchips button")].filter((b) => !b.disabled);
    const counts = {}, shown = {};
    for (const b of pills) {
      const k = b.getAttribute("data-chip");
      counts[k] = t(b.querySelector(".nktab__n"));
      await click(b);
      shown[k] = String([...d.querySelectorAll("#nlist [data-need]")].filter((c) => !c.closest('details[data-sev="practice"]')).length);
    }
    await click(byAct(d, "need.kind.all"));
    const practice = d.querySelectorAll('#nlist details[data-sev="practice"] [data-need]').length;
    ok(pills.length >= 3 && J(counts) === J(shown) && +counts.all > 0 && practice >= 1,
      "each kind's tab says how many of it wait, the number its filter then shows, practice cards apart (" + practice + " practice): " + J([counts, shown]));
    /* 3 */
    const nav = d.querySelector("nav.nkinds"), strip = d.querySelector(".nchips"), tabs = strip ? [...strip.children] : [];
    ok(!!nav && nav.classList.contains("salt-nav") && strip.parentElement === nav && strip.classList.contains("salt-nav__links") && strip.getAttribute("role") === "tablist"
      && tabs.length === 6 && tabs.every((b) => b.classList.contains("salt-nav__link") && b.classList.contains("nktab") && b.getAttribute("role") === "tab" && b.lastElementChild.className === "nktab__n" && b.firstChild.nodeType === 3)
      && /font-family: var\(--salt-font-mono\)/.test(rule(".salt-nav__link")) && !d.getElementById("nJump") && !d.querySelector(".salt-jump, .salt-tabs--track"),
      "the kinds are one text tab row on the system's Nav bar, six tabs, each its word with the count beside it, and no Jump to: " + tabs.map(t).join(" | "));
    ok(/\.adm \.nkinds \.nchips\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css) && /@media \(min-width:860px\)\{\.adm \.nkinds \.nchips\{grid-template-columns:repeat\(6,minmax\(0,1fr\)\)\}\}/.test(css)
      && /\.adm \.nktab\{display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:48px;[^}]*white-space:nowrap/.test(css),
      "three tabs across on a phone and six wide, each 48px tall, its words on one line");
    /* 4 */
    await click(byAct(d, "need.kind.payments"));
    const sel = tabs.filter((b) => b.getAttribute("aria-selected") === "true").map((b) => b.getAttribute("data-chip"));
    const act = tabs.filter((b) => b.classList.contains("salt-nav__link--active")).map((b) => b.getAttribute("data-chip"));
    const kinds = [...new Set([...d.querySelectorAll("#nlist [data-need]")].map((c) => c.getAttribute("data-kind")))];
    ok(J(sel) === J(["payments"]) && J(act) === J(["payments"]) && J(kinds) === J(["payments"])
      && /\.adm \.nktab\[aria-selected="true"\]\{border-bottom-color:var\(--salt-brass\);background:var\(--salt-glass\)\}/.test(css),
      "a tab chooses its kind: it alone is selected, the Nav bar's active link on glass with a brass underline, and only its cards show: " + J([sel, act, kinds]));
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
    ok(!!m && m.disabled && !m.hidden && t(m.querySelector(".nktab__n")) === "0" && !o.disabled && /\.adm \.nktab:disabled\{opacity:\.5;cursor:default\}/.test(css),
      "with no message waiting the Messages tab stays in its place at 0, dimmed, and cannot be chosen, while Orders can");
  } finally { q.w.close(); }
}
