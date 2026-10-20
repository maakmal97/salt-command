/* test/admin-ac-glance.mjs: SALT ADMIN A TO C, P7 (21 Oct 2026; docs/plan-counter-admin-ac.html; canvas V56 and V62). What is proved here, each
 * check red under its own mutation (test/admin-ac-glance.mutations.json):
 *   1  the glance heads Needs you: Ready, the orders ready with goods still to hand over, and Owed to you, what the agreed orders still owe,
 *      goods and delivery less what is paid, summed; a practice order counts in neither; each tile opens Orders
 *   2  each kind's pill says how many of it wait, practice apart, the same number its filter then shows
 *   3  the kinds are one row that slides: the system's track, never wrapping, beside a fixed Jump to, each a 44px target
 *   4  Jump to opens a menu of every kind with its count, the current one marked; a kind with nothing cannot be chosen; a line chooses its kind as
 *      the pill does; Escape and a tap outside close it, the focus going back to the button; the arrow keys move between the lines
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
const rule = (sel) => { const m = SITE_RECIPES.match(new RegExp("(^|[}\\s])" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{([^}]*)\\}")); return m ? m[2] : ""; };

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).concat(extra) }) });
  try {
    await p.work.quiet();
    const d = p.d, w = p.w, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.needs"));
    /* 1 */
    const g = d.getElementById("nGlance"), tiles = g ? [...g.querySelectorAll(".salt-glance__item")] : [];
    const read = tiles.map((a) => [a.getAttribute("data-glance"), t(a.querySelector(".salt-glance__label")), t(a.querySelector(".salt-glance__value")), t(a.querySelector(".salt-glance__note")), a.getAttribute("href")]);
    ok(!!g && !g.hidden && g.classList.contains("salt-glance") && J(read) === J([["ready", "Ready", "4", "To hand over", "#orders/ready"], ["owed", "Owed to you", "RM 670.00", "6 agreed orders", "#orders"]])
      && tiles.every((a) => a.tagName === "A"),
      "the glance reads Ready 4 (three ready and one part paid, the practice order apart) and Owed to you RM 670.00 over six agreed orders, goods and delivery less what is paid, each tile a link to Orders: " + J(read));
    w.location.hash = "#orders/ready"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    const lit = d.querySelector('.aparts button[data-part="ready"][aria-selected="true"]');
    ok(!!lit && !d.getElementById("oOrders").hidden, "and Ready's tile lands on Orders at the Ready stage");
    w.location.hash = "#needs"; await new Promise((r) => setTimeout(r, 20)); await p.work.quiet();
    /* 2 */
    const pills = [...d.querySelectorAll(".nchips button")].filter((b) => !b.hidden);
    const counts = {}, shown = {};
    for (const b of pills) {
      const k = b.getAttribute("data-chip");
      counts[k] = t(b.querySelector(".salt-tabs__count"));
      await click(b);
      shown[k] = String([...d.querySelectorAll("#nlist [data-need]")].filter((c) => !c.closest('details[data-sev="practice"]')).length);
    }
    await click(byAct(d, "need.kind.all"));
    const practice = d.querySelectorAll('#nlist details[data-sev="practice"] [data-need]').length;
    ok(pills.length >= 3 && J(counts) === J(shown) && +counts.all > 0 && practice >= 1,
      "each kind's pill says how many of it wait, the number its filter then shows, practice cards apart (" + practice + " practice): " + J([counts, shown]));
    /* 3 */
    const strip = d.querySelector(".nchips"), row = strip && strip.parentElement, jump = d.getElementById("nJump");
    const track = rule(".salt-tabs--track");
    ok(!!row && row.classList.contains("salt-tabs-row") && strip.classList.contains("salt-tabs--track") && !!jump && jump.closest(".salt-jump").parentElement === row
      && /flex-wrap: nowrap/.test(track) && /overflow-x: auto/.test(track) && /scroll-snap-type: x proximity/.test(track) && /mask-image: linear-gradient\(90deg, #000 85%, transparent\)/.test(track),
      "the kinds are one row of the system's track, which never wraps, slides, snaps and fades at its right edge, beside a fixed Jump to: " + track.slice(0, 120));
    const tap = (s) => /min-height: var\(--salt-tap\)/.test(rule(s));
    ok(tap(".salt-jump__btn") && /min-width: var\(--salt-tap\)/.test(rule(".salt-jump__btn")) && tap(".salt-jump__item") && tap(".salt-tabs--track .salt-tabs__pill")
      && !/font-weight: [6-9]00/.test(rule(".salt-tabs--track .salt-tabs__pill")) && /font-weight: 500/.test(rule(".salt-tabs__pill")),
      "Jump to, its lines and the pills are each 44px, the pills at weight 500");
    /* 4 */
    const menu = d.getElementById("nJumpMenu");
    ok(menu.hidden && jump.getAttribute("aria-expanded") === "false" && jump.getAttribute("aria-haspopup") === "menu", "Jump to starts shut");
    await click(jump);
    const lines = [...menu.querySelectorAll("button[data-jump]")], lc = {};
    lines.forEach((b) => { lc[b.getAttribute("data-jump")] = t(b.querySelector(".salt-jump__count")); });
    const pc = {}; [...d.querySelectorAll(".nchips button")].forEach((b) => { pc[b.getAttribute("data-chip")] = t(b.querySelector(".salt-tabs__count")); });
    ok(!menu.hidden && jump.getAttribute("aria-expanded") === "true" && lines.length === 6 && J(lc) === J(pc) && d.activeElement === lines[0] && lines[0].getAttribute("aria-current") === "true",
      "Jump to opens a menu of all six kinds, each with the count its pill carries, the current kind marked and focused: " + J(lc));
    menu.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    const second = d.activeElement;
    ok(second === lines.find((b) => !b.disabled && b !== lines[0]), "the down arrow moves to the next line that can be chosen: " + (second && second.getAttribute("data-jump")));
    menu.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    ok(menu.hidden && jump.getAttribute("aria-expanded") === "false" && d.activeElement === jump, "Escape shuts it and gives Jump to back its focus");
    await click(jump);
    await click(byAct(d, "need.jump.payments"));
    const sel = [...d.querySelectorAll(".nchips button")].filter((b) => b.getAttribute("aria-selected") === "true").map((b) => b.getAttribute("data-chip"));
    const kinds = [...new Set([...d.querySelectorAll("#nlist [data-need]")].map((c) => c.getAttribute("data-kind")))];
    ok(menu.hidden && J(sel) === J(["payments"]) && J(kinds) === J(["payments"]) && d.activeElement === jump,
      "a line chooses its kind as the pill does, and the menu shuts: " + J([sel, kinds]));
    await click(jump);
    await click(d.getElementById("nCount"));
    ok(menu.hidden && jump.getAttribute("aria-expanded") === "false", "a tap outside shuts it");
    await click(byAct(d, "need.kind.all"));
  } finally { p.w.close(); }

  /* 4b: a kind with nothing waiting cannot be chosen from the menu */
  const q = await richOwnerPage({ pageWork, threads: (j) => ({ ...j, threads: [] }) });
  try {
    await q.work.quiet();
    const d = q.d;
    byAct(d, "nav.needs").click(); await q.work.quiet();
    const m = d.querySelector('#nJumpMenu button[data-jump="messages"]'), o = d.querySelector('#nJumpMenu button[data-jump="orders"]');
    ok(!!m && m.disabled && m.classList.contains("salt-jump__item--none") && t(m.querySelector(".salt-jump__count")) === "0" && !o.disabled && !o.classList.contains("salt-jump__item--none"),
      "with no message waiting the Messages line stands in mist at 0 and cannot be chosen, while Orders can");
  } finally { q.w.close(); }
}
