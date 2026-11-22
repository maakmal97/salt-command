/* test/place-head.mjs: ONE HEAD FOR EVERY PLACE (22 Nov 2026, his answers of 22 Nov 2026, docs/plan-place-head.html; Ambient 0.7.32).
 * Display only: no route, request body, price or booking changes. Every act a control had is kept; nav.add (the +) is retired.
 * Every place of Salt Admin opens the same way on every screen: its title alone, with no room kept over it for a button; then its head,
 * row 1 its parts as a sliding segment and row 2 its status, the same on every place (live, the time, the shop's state, Supply tight,
 * Ledger, Approve); then its headline. Filters leave the navigation: a list's filter is a pull-down menu at the head of that list.
 * Needs you's parts are its groups, To do, Pending and FYI (his answer 1); many parts slide (answer 2).
 * What is proved here, each check red under its own mutation (test/place-head.mutations.json):
 *   H1  every place's hero is its title alone, and the head stands next to it: nothing between
 *   H2  every head is the parts then the status; each segment slides and none wraps; Needs you's parts are To do, Pending, FYI
 *   H3  the status is the same on every place, Ledger and Approve at its end, and nothing carries a wide-only mark
 *   H4  no app bar and no + on his page; nav.add is gone and Record is in the dock
 *   H5  the kinds and the accounts' filters are pull-down menus at the head of their lists, outside every head, each choice keeping its act
 *   H6  the carried Ambient: two rows of one height, the title's hero with no room kept, the one sideways scroll, the words a phone does without
 *   H7  the page running: a part of Needs you draws its group alone and its tab counts; Approve is said on every place, never hidden;
 *       Ledger keeps its word until a tick or a count says it; the kinds' menu narrows the list
 * Geometry is measured in Chromium (the session's shots: every place at 360, 390, 430, 768, 1180, 1536 and 1920, rows at one height and top);
 * jsdom lays nothing out, so these read markup, rules and state. */
import { JSDOM } from "jsdom";
import { landingPage, SITE_STYLE } from "../stmt/page.js";
import { richOwnerPage, byAct } from "./maker-act.mjs";

export async function run({ ok, pageWork }) {
  const css = SITE_STYLE.replace(/\s+/g, " ");
  const owner = landingPage("", "phead", { master: "", accounts: [] });
  const dom = new JSDOM(owner), d = dom.window.document;
  const places = ["mHome", "oOrders", "oCustomers", "oRecord", "oShop"].map((id) => d.getElementById(id));
  /* H1 */
  const heroes = places.map((p) => p && p.querySelector(":scope > header.amb-hero"));
  ok(heroes.every((h) => h && h.classList.contains("amb-hero--title") && h.children.length === 1 && h.children[0].matches("h1.amb-hero__title")),
    "every place's hero is its title alone: " + JSON.stringify(heroes.map((h) => h && h.children.length)));
  ok(heroes.every((h) => h.nextElementSibling && h.nextElementSibling.classList.contains("amb-head")), "and its head stands next to it, nothing between the title and the parts");
  /* H2 */
  const heads = places.map((p) => p.querySelector(":scope > .amb-head"));
  ok(heads.every((h) => h.children.length === 2 && h.children[0].matches(".amb-segment.aparts") && h.children[1].matches(".amb-status")),
    "every head is row 1 the parts, then row 2 the status: " + JSON.stringify(heads.map((h) => [...h.children].map((c) => c.className.split(" ")[0]))));
  const segs = heads.map((h) => h.children[0]);
  ok(segs.every((s) => s.classList.contains("amb-segment--slide") && !s.classList.contains("amb-segment--wrap")),
    "each place's parts slide on one row and none wraps: " + JSON.stringify(segs.map((s) => s.className)));
  ok([...segs[0].querySelectorAll("[data-part]")].map((b) => b.getAttribute("data-part") + ":" + b.textContent).join() === "todo:To do,pending:Pending,fyi:FYI"
    && [...segs[0].querySelectorAll("[data-part]")].every((b) => b.getAttribute("data-act") === "part.needs." + b.getAttribute("data-part")),
    "Needs you's parts are its groups, To do, Pending and FYI, each with its act");
  ok([...d.querySelectorAll("#roster [data-part]")].every((b) => b.closest(".amb-head")), "no part is reached from anywhere but a head");
  /* H3 */
  const sig = (st) => [...st.querySelectorAll("*")].map((e) => e.tagName + "." + [...e.classList].sort().join(".") + (e.getAttribute("data-act") ? "@" + e.getAttribute("data-act") : "")).join(" ");
  const sts = heads.map((h) => h.children[1]);
  ok(sts.every((s) => sig(s) === sig(sts[0])), "the status is the same on every place: " + sig(sts[0]).slice(0, 160));
  const end = sts[1].querySelector(":scope > .amb-status__end");
  ok(sts[1].firstElementChild.matches("span.amb-status__live[data-barlive]") && sts[1].children[1].matches("span.amb-status__time[data-clock]")
    && sts[1].children[2].matches("button.amb-status__state[data-barhours][data-act='bar.hours']") && sts[1].children[3].matches("span.amb-status__flag[data-heat]") && !!sts[1].children[3].querySelector(".amb-status__word")
    && end && end.children.length === 2 && end.children[0].matches("button[data-ledger][data-act='bar.ledger']") && end.children[1].matches("button[data-approve][data-act='bar.approve']")
    && !end.children[1].hidden && end.children[1].querySelector("[data-approve-n]"),
    "in this order: live, the time, the shop's state, Supply tight, then Ledger and Approve at its end, Approve never drawn hidden");
  ok(!/data-wide/.test(owner), "nothing on his page is shown on a wide screen alone");
  ok(d.querySelectorAll("#aBarLive, #aBarHours, #aApprove").length === 3 && d.getElementById("mHome").contains(d.getElementById("aBarLive")), "the ids the bar reads are Needs you's, once each");
  /* H4 */
  ok(!d.querySelector("#roster > .amb-appbar") && !d.getElementById("oAdd") && !/nav\.add/.test(owner), "his page has no app bar and no +: Record is one tap in the dock");
  ok(!!d.querySelector('#roster .place[data-m="record"][data-act="nav.record"]'), "and Record stands in the dock and the rail");
  /* H5 */
  const kinds = d.getElementById("nKinds"), afil = d.getElementById("afil");
  ok(kinds && afil && [kinds, afil].every((m) => m.matches(".amb-filter__menu[hidden]") && !m.closest(".amb-head") && m.parentNode.matches(".amb-filter")
    && m.parentNode.querySelector(":scope > button.amb-filter__btn[aria-expanded='false'][aria-controls='" + m.id + "']")),
    "the kinds and the accounts' filters are pull-down menus, shut, outside every head");
  ok(kinds.closest(".nsplit") && kinds.closest(".amb-filter").parentNode.nextElementSibling === d.getElementById("nlist"), "the kinds' menu stands at the head of the list it narrows");
  ok(afil.closest("#rlist") && afil.closest(".afind") && afil.closest(".afind").querySelector(".amb-search #rq"), "the accounts' menu stands beside the find field, at the head of the accounts");
  ok(afil.parentNode.classList.contains("amb-filter--end") && !kinds.parentNode.classList.contains("amb-filter--end"), "the accounts' menu, at the end of its row, opens toward the start so it stays on the screen");
  ok([...kinds.querySelectorAll("button")].map((b) => b.getAttribute("data-act")).join() === "need.kind.all,need.kind.orders,need.kind.payments,need.kind.messages,need.kind.rows,need.kind.accounts"
    && [...afil.querySelectorAll("button")].map((b) => b.getAttribute("data-act")).join() === "acct.filter-all,acct.filter-unsent,acct.filter-unopened,acct.filter-owes,acct.filter-locked,acct.filter-none"
    && [kinds, afil].every((m) => m.querySelectorAll('[aria-pressed="true"]').length === 1 && m.querySelector('[aria-pressed="true"] .amb-filter__word').textContent === "All"),
    "each choice keeps its act, one is pressed, and its word is the pill's");
  ok(!d.querySelector(".amb-segment--wrap[data-place], .amb-segment--wrap .aparts, .nchips"), "no filter is drawn as a row of pills where parts stand");
  dom.window.close();
  /* H6 */
  ok(css.includes(".amb-head { display: grid; grid-auto-rows: minmax(var(--amb-head-row), 1fr); gap: var(--amb-space-2);") && /--amb-head-row: calc\(var\(--amb-tap\) \+ 8px\);/.test(css),
    "the head's two rows are one height, a segment's, and grow together");
  ok(css.includes(".nlist > .ngroup[hidden] { display: none; }"), "a group of a part not shown stands in the page, hidden");
  ok(css.includes(".amb-hero--title { padding-top: calc(var(--amb-safe-top) + var(--amb-space-4)); padding-bottom: var(--amb-space-4); }"), "the title's hero keeps no room for an app bar's circles");
  ok(css.includes(".amb-segment--slide { flex-wrap: nowrap; overflow-x: auto;") && (css.match(/overflow-x:\s*(auto|scroll)/g) || []).length === 1,
    "a sliding segment is the one box that scrolls sideways");
  ok(css.includes(".amb-status__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }") && css.includes(".amb-status__time { flex: none;"), "the state's label is the one thing in the row that gives way, the time never does (the worst case fits 360px, measured)");
  ok(css.includes("@container amb (max-width: 479.98px) { .amb-status .amb-status__word { position: absolute;") && css.includes(".amb-head > .amb-segment { max-width: none; }"),
    "under 480px the words a phone does without are kept for a reader and not drawn, and the parts run the head's width");
  /* H7 */
  const swallow = () => {};
  process.on("unhandledRejection", swallow);
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const D = p.d, list = D.getElementById("nlist");
    const sevs = () => [...new Set([...list.querySelectorAll(":scope > .ngroup:not([hidden])")].map((g) => g.getAttribute("data-sev")))].join();
    const counts = () => [...D.querySelectorAll('.aparts[data-place="needs"] [data-part]')].map((b) => b.querySelector(".amb-segment__count").textContent);
    ok(sevs() === "now" && D.querySelector('.aparts[data-place="needs"] [data-part="todo"]').getAttribute("aria-pressed") === "true" && !list.querySelector("h2.nsev"),
      "Needs you opens on To do, its group alone with no head of its own: " + sevs());
    ok(counts().every((c) => /^\d*$/.test(c)) && counts()[0] !== "", "each part says how many of its cards wait: " + JSON.stringify(counts()));
    await p.click(byAct(D, "part.needs.pending"));
    ok(sevs() === "soon" && p.w.location.hash === "#needs/pending" && D.querySelector('.aparts[data-place="needs"] [data-part="pending"]').getAttribute("aria-pressed") === "true",
      "Pending draws its own group alone, at its address: " + JSON.stringify([sevs(), p.w.location.hash]));
    await p.click(byAct(D, "part.needs.todo"));
    const before = list.querySelectorAll(".ntask").length;
    await p.click(byAct(D, "need.kind.payments"));
    const after = [...list.querySelectorAll(".ntask")];
    ok(after.length > 0 && after.length < before && after.every((t) => /payment/i.test(t.textContent)) && D.querySelector("#nKinds [data-chip='payments']").getAttribute("aria-pressed") === "true",
      "the kinds' menu narrows the list within the part: " + before + " to " + after.length);
    /* a kind held by both To do and Pending, chosen on To do, then Pending taken: All again, not the kind carried over */
    await p.click(byAct(D, "need.kind.all"));
    const both = [...list.querySelectorAll(":scope > .ngroup[data-sev='soon'] .ntask[data-kind]")].map((t) => t.getAttribute("data-kind")).find((k) => list.querySelector(":scope > .ngroup[data-sev='now'] .ntask[data-kind='" + k + "']"));
    if (both) { await p.click(byAct(D, "need.kind." + both)); }
    await p.click(byAct(D, "part.needs.pending"));
    ok(!!both && D.querySelector("#nKinds [data-chip='all']").getAttribute("aria-pressed") === "true" && list.querySelectorAll(":scope > .ngroup[data-sev='soon']:not([hidden]) .ntask").length === list.querySelectorAll(":scope > .ngroup[data-sev='soon'] .ntask").length,
      "taking another part shows All again, so a kind chosen on To do never narrows Pending: " + both);
    await p.click(byAct(D, "part.needs.todo"));
    const aps = [...D.querySelectorAll("#roster [data-approve]")];
    ok(aps.length === 5 && aps.every((a) => !a.hidden && /^Approve, \d+ to approve$/.test(a.getAttribute("aria-label")) && !a.querySelector("[data-approve-n]").hidden && /^\d+$/.test(a.querySelector("[data-approve-n]").textContent)),
      "Approve is said on every place with the rows that wait, never hidden: " + JSON.stringify(aps.map((a) => [a.hidden, a.querySelector("[data-approve-n]").textContent])));
    const words = () => [...D.querySelectorAll("#roster [data-ledger] .aled__word")].map((w) => w.classList.contains("amb-status__word"));
    ok(words().length === 5 && words().every((w) => w === false), "until a check is read Ledger keeps its word on a phone too: " + JSON.stringify(words()));
    const live = D.getElementById("aBarLive");
    ok(live.matches(".amb-status__live") && live.querySelector(".amb-chip__dot") && live.textContent === "Live" && !live.querySelector(".amb-status__word"), "Live is a dot and its word, which every phone draws: " + live.outerHTML.slice(0, 120));
    const hb = D.getElementById("aBarHours"), lab = hb.querySelector(".amb-status__label");
    ok(hb.matches(".amb-status__state") && lab && /^(Open|Closed|Paused)/.test(lab.textContent) && (!lab.querySelector(".amb-status__word") || /^ to /.test(lab.querySelector(".amb-status__word").textContent)),
      "the state is a dot and its label, when it next changes a word a phone does without: " + hb.outerHTML.slice(0, 160));
  } finally { p.w.close(); }
  const tie = { ok: true, clean: true, faults: [], waiting: [], orders: 3, v: 1544, at: "2026-11-22T08:00:00Z" };
  const q = await richOwnerPage({ pageWork, extra: (route) => route === "/all/maker/ledger" ? { ok: true, version: 1, orders: 3, open: [], pending: [], recent: [], tieout: tie } : route === "/all/maker/stock" ? { ok: true, books: { salt: { heat: "tight" } } } : undefined });
  try {
    await q.work.quiet();
    const words = [...q.d.querySelectorAll("#roster [data-ledger] .aled__word")].map((w) => w.classList.contains("amb-status__word"));
    ok(words.length === 5 && words.every(Boolean), "once the tick says it, Ledger's word is one a phone does without: " + JSON.stringify(words));
    await q.click(byAct(q.d, "nav.shop"));
    ok(!q.d.querySelector("#oShop [data-heat]").hidden && [...q.d.querySelectorAll("#roster [data-heat]")].every((c) => !c.hidden), "while salt's supply is tight every place says so, Settings too");
  } finally { q.w.close(); }
  const z = await richOwnerPage({ pageWork, bare: true, review: () => ({ ok: true, orders: [], drafts: [], queue: [] }) });
  try {
    await z.work.quiet();
    const ns = [...z.d.querySelectorAll("#roster [data-approve-n]")];
    ok(ns.length === 5 && ns.every((n) => n.textContent === "0" && n.hasAttribute("data-zero") && !n.closest("[data-approve]").hidden), "with nothing waiting Approve says 0, greyed, on every place: " + JSON.stringify(ns.map((n) => n.textContent)));
  } finally { z.w.close(); }
  process.off("unhandledRejection", swallow);
}
