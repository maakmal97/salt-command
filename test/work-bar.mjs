/* test/work-bar.mjs: TABS FOR A PLACE'S PARTS, AND THE MORE LIST SPLIT UP (18 Nov 2026, Ambient 0.7.21, his answers A and D on the laptop's layout).
 * Display and where three things are reached: no route, request body, price or booking changes, and each part does what it did.
 * A: a place's parts (Orders, Customers, Record, Settings; the Counter's Orders tabs) are underlined tabs across the content from 960px, so they
 *    never read as the filter pills under them; a phone keeps the segment, and filters stay pills everywhere.
 * D: Orders' More list is gone. Ledger check is in every place's bar beside Approve (a tick while the Desk's last check found every site order
 *    matching its row, the count of differences while it did not); Group orders is a part of Settings; Payments they sent has no row on Orders
 *    and keeps its part and address, which Needs you's cards and his alerts open. Approve stands on Orders always and elsewhere while rows wait.
 * What is proved here, each check red under its own mutation (test/work-bar.mutations.json):
 *   T1  the parts of the four places and the Counter's Orders tabs ask to be tabs; the filters do not
 *   T2  the carried Ambient draws tabs only from 960px in a working shell: a hairline under the row, the pressed one underlined in the accent, 44px wide at least
 *   T3  every place's status row ends in Ledger check then Approve, on every width, Approve never hidden; the test surface carries neither
 *   T4  no More list and no row for Payments, Group or Ledger on Orders; Group orders stands in Settings, between Notice and Practice
 *   T5  the indicator says the last tie-out in every place (tick, count, or the word alone), reads it once with the page and posts nothing
 *   T6  a tap on it opens the Ledger check from any place; Approve stands on every place, with the rows that wait or a grey 0, and opens Approve
 *   T7  Group orders opens under Settings and reads its pools; its old address lands there, and Payments' address still opens its part
 * 22 Nov 2026 (the place head, his answers of 22 Nov 2026): the parts slide and never wrap, the filters are pull-down menus, Ledger and Approve end every
 * place's status row (not a hero's cluster) on every width, the + is gone. Each check below that moved says why in a dated comment.
 * Geometry is measured in Chromium (the session's shots); jsdom lays nothing out, so these read markup, rules and state. */
import { JSDOM } from "jsdom";
import { landingPage, SITE_STYLE } from "../stmt/page.js";
import { richOwnerPage, byAct } from "./maker-act.mjs";

export async function run({ ok, pageWork }) {
  const css = SITE_STYLE.replace(/\s+/g, " ");
  const owner = landingPage("", "wbar", { master: "", accounts: [] }), customer = landingPage("abcd-efgh", "wbarc", null);
  const dom0 = new JSDOM(owner), d0 = dom0.window.document;
  /* T1 */
  /* 22 Nov 2026 (the place head): Settings' parts slide on one row like the others, none wraps; the filters left the navigation and are pull-down menus, never a row of pills or tabs */
  const strips = ["orders", "customers", "record", "shop"].map((p) => d0.querySelector('#roster .aparts[data-place="' + p + '"]'));
  ok(strips.every((s) => s && s.classList.contains("amb-segment") && s.classList.contains("amb-segment--tabs") && s.classList.contains("amb-segment--slide") && !s.classList.contains("amb-segment--wrap")),
    "the parts of Orders, Customers, Record and Settings each ask to be tabs and slide on one row, none wrapping, Settings' too: " + JSON.stringify(strips.map((s) => s && s.className)));
  const filters = [d0.getElementById("nKinds"), d0.getElementById("afil")];
  ok(filters.every((f) => f && f.classList.contains("amb-filter__menu") && !f.classList.contains("amb-segment") && !f.classList.contains("amb-segment--tabs") && !f.classList.contains("amb-segment--wrap") && !f.closest(".aparts")),
    "Needs you's kinds and Customers' filters are pull-down menus, neither tabs nor a row of pills, so the two never look alike: " + JSON.stringify(filters.map((f) => f && f.className)));
  /* 22 Nov 2026 (the place head): the Counter's Orders tabs slide on one row too, never wrap, and are the head's first row (#cHead), static markup drawn once, hidden but on Orders (the reviewer's findings of the same day) */
  ok(customer.split('<div class="amb-segment amb-segment--tabs amb-segment--slide otabs" role="group"').length === 2 && !/amb-segment--wrap[^"]*otabs|otabs[^"]*amb-segment--wrap/.test(customer),
    "the Counter's Orders tabs ask to be tabs too and slide on one row, none wrapping (test/counter-orders-cards.mjs proves them standing in its head)");
  /* T2 */
  const first = css.indexOf(".amb-segment--tabs"), open = css.lastIndexOf("@container amb", first);
  ok(first > 0 && css.startsWith("@container amb (min-width: 960px) {", open) && !/(^|[ ,}])\.amb-segment--tabs/.test(css.slice(first + 1).replace(/\.amb-shell--work \.amb-segment--tabs/g, "")),
    "tabs are drawn only from 960px and only in a working shell: every rule of theirs is written under both");
  ok(css.includes(".amb-shell--work .amb-segment--tabs { flex-wrap: nowrap; gap: var(--amb-space-6); max-width: none; padding: 0; border: 0; border-bottom: 1px solid var(--amb-line); border-radius: 0; background: none; }"),
    "the row is text on one line across the content, a hairline under it, no well and no cap on its width");
  const opt = (css.match(/\.amb-shell--work \.amb-segment--tabs > \.amb-segment__opt \{ ([^}]*)\}/) || [])[1] || "";
  ok(/min-width: var\(--amb-tap\);/.test(opt) && /background: none;/.test(opt) && /border-radius: 0;/.test(opt)
    && css.includes('.amb-shell--work .amb-segment--tabs > .amb-segment__opt[aria-pressed="true"] { background: none; color: var(--amb-ink); }')
    && css.includes('.amb-shell--work .amb-segment--tabs > .amb-segment__opt[aria-pressed="true"]::after { content: ""; position: absolute; inset: auto 0 -1px 0; height: 2px; background: var(--amb-accent); }'),
    "a tab is plain text 44px wide at least, and the pressed one is the ink underlined in the accent, no pill: " + opt.slice(0, 70));
  /* T3 */
  /* 22 Nov 2026 (the place head): the pair moved out of the hero's cluster into the status row's end, on every place and every width */
  const heads = [...d0.querySelectorAll("#roster .amb-place > .amb-head")], ends = heads.map((h) => h.querySelector(":scope > .amb-status > .amb-status__end"));
  const pair = (c) => c && c.children.length === 2 && c.children[0].matches("button.amb-pill[data-ledger][data-act='bar.ledger']") && c.children[1].matches("button.amb-pill[data-approve][data-act='bar.approve']");
  ok(heads.length === 5 && ends.every(pair), "every place's status row ends in Ledger check, then Approve: " + JSON.stringify(ends.map((c) => c && c.children.length)));
  ok(!/data-wide/.test(owner) && ends.every((c) => c && !c.hasAttribute("data-wide") && !c.children[1].hidden) && !d0.querySelector("#roster .amb-hero .amb-cluster")
    && d0.querySelectorAll("#aApprove").length === 1 && !!d0.querySelector("#mHome #aApprove"),
    "on every width Approve is drawn and never hidden, nothing shows on a wide screen alone, no hero holds a cluster, and the id the bar reads is Needs you's alone");
  const led = d0.querySelector("#oOrders [data-ledger]");
  ok(led.querySelector("[data-ledger-ok][hidden] svg") && led.querySelector("span.amb-chip.amb-chip--neg[data-ledger-n][hidden]") && /Ledger/.test(led.textContent) && led.getAttribute("aria-label") === "Ledger check",
    "Ledger check is its word, with a tick and a count that are hidden until the check is read");
  const test = landingPage("", "wbart", { master: "", accounts: [] }, null, { base: "/all/test" });
  ok(!/data-ledger|data-approve|amb-status__end/.test(test.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "").replace(/<script[^>]*>[\s\S]*?<\/script>/g, "")), "the test surface carries neither, nor the end of the status row that holds them");
  /* T4 */
  ok(!d0.querySelector(".amore__list") && !/>More</.test(d0.getElementById("oOrders").innerHTML) && !d0.querySelector('#oOrders [data-part="payments"], #oOrders [data-part="group"], #oOrders [data-part="ledger"]')
    && [...d0.querySelectorAll('.aparts[data-place="orders"] [data-part]')].map((b) => b.getAttribute("data-part")).join() === "todo,open,done,ended",
    "Orders has no More list: its parts are the four stages, and no row stands for Payments, Group or Ledger");
  const sp = [...d0.querySelectorAll('.aparts[data-place="shop"] [data-part]')].map((b) => b.getAttribute("data-part"));
  const pools = d0.getElementById("makerPools");
  ok(sp.join() === "hours,market,calendar,notice,group,practice,device" && !!pools && pools.closest("[data-in]").getAttribute("data-in") === "shop.group" && !!pools.closest("#oShop") && !pools.closest("#oOrders")
    && d0.querySelector('.aparts[data-place="shop"] [data-part="group"]').textContent === "Group orders",
    "Group orders is a part of Settings, between Notice and Practice, and its section stands there: " + sp.join());
  ok(!!d0.querySelector('#oOrders section[data-in="orders.payments"] #makerClaims') && !!d0.querySelector('#oOrders #oLedger[data-in="orders.ledger"]'),
    "Payments they sent and the Ledger check keep their parts under Orders, each at its address");
  dom0.window.close();
  /* T8 (Fable's review, 18 Nov 2026): the indicator keeps one width, is a step under Approve and is pressed while its view is open; a place's tabs stand on one line */
  /* 22 Nov 2026 (the place head): the indicator lives in the status row's end, where Ambient gives each pill its tap width, so the site layer's own min-width on it is gone; it is still
     an indicator (aria-pressed) by Ambient's rule, pressed while its view is open, and the shop's state is a dot and its label with no ground */
  ok(!css.includes(".adm .aled { min-width") && css.includes(".amb-status__end > .amb-pill { min-width: var(--amb-tap); min-height: var(--amb-tap);")
    && css.includes('.amb-status__end > .amb-pill[aria-pressed="true"] { border-color: var(--amb-accent); box-shadow: inset 0 0 0 1px var(--amb-accent); color: var(--amb-ink); }')
    && /\.amb-status__state \{[^}]*background: none;/.test(css) && /<button type="button" class="amb-pill amb-pill--quiet aled" data-ledger data-act="bar\.ledger" aria-pressed="false"/.test(owner),
    "Ledger check takes the status row's tap width and no width of the site layer's, it is an indicator (aria-pressed) by Ambient's rule, and the shop's state is a dot and its label with no ground");
  /* 22 Nov 2026 (the place head): the head is the one gap under the title and over the headline, so the three margin rules that stood the tabs on one line (the tabs' foot, their stack, the unsent banner) are gone */
  ok(!/\.adm \.aparts/.test(css) && !css.includes(".adm .amb-stack:has(> .aparts)") && !css.includes(".adm #unsentBar:not([hidden]) { margin-top: 0; }")
    && css.includes(".amb-head { display: grid; grid-auto-rows: minmax(var(--amb-head-row), 1fr); gap: var(--amb-space-2);"),
    "no margin of the site layer's stands over or under the tabs: the head's own two rows are the one gap, over panes and over a page");
  /* T9 (18 Nov 2026, his word: one skeleton for every place and tab; measured in Chromium on all 21 places and parts, pinned here) */
  ok(css.includes(".amb-shell--work .amb-hero--compact { --amb-bar-l: calc(var(--amb-pane-room) - min(var(--amb-pane-room), var(--amb-inset-l)));"), "in a working shell the bar stands on the panes' edges whether panes show or not");
  /* 22 Nov 2026 (the place head): the head and the headline are blocks of a place too, so the selector lists .amb-head and .amb-lead beside the stacks, lists, tiles and forms */
  ok(css.includes(".amb-shell--work :is(.amb-screen, .amb-place) > :is(.amb-stack, .amb-list, .amb-tiles, .amb-form, .amb-head, .amb-lead):not(.amb-split) { padding-inline: calc(var(--amb-pane-room) - min(var(--amb-pane-room), var(--amb-inset-l)))"), "and so does every block of a screen, the head and the headline among them");
  ok(css.includes(".amb-shell--work .amb-hero--compact > :is(.amb-hero__title, .amb-hero__sub) { align-self: baseline; }"), "the bar's title and its line share a baseline");
  /* 22 Nov 2026 (the place head): the indicator is in the status row's end now, so its negative count's edge is Ambient's rule for that row */
  ok(css.includes(".amb-status__end > .amb-pill[aria-pressed]:has(> .amb-chip--neg:not([hidden])) { border-color: var(--amb-neg); color: var(--amb-ink); }"), "a negative count edges its indicator (the selector 0.7.24 broke), in the status row's end");
  ok(css.includes(".adm:has(.aplace) :is(.amb-screen, .amb-place) > * + :is(.amb-stack, .amb-split) { margin-top: 0; }"), "no block of a screen adds a margin of its own, so every part starts on one line");
  ok(css.includes(".adm .abody .amb-place > .amb-stack:not(:has(~ .amb-split--panes:not([hidden]))) { padding-top: calc(var(--amb-space-6) + var(--amb-space-1)); }"), "a part with no panes keeps the panes' top room");
  ok(css.includes(".adm:has(.aplace) .amb-split--panes .amb-section { padding-inline: 0; } .adm:has(.aplace) .amb-split--panes .amb-list { margin-inline: 0; }"), "a heading and a list in a pane start on the pane's edge");
  ok(css.includes(":is(.amb-field, .amb-form, .amb-settings, .amb-pill:not(.amb-pill--sm)) { max-width: 36rem; justify-self: start; }"), "a form on a part with no panes keeps one measure");
  /* 22 Nov 2026 (the place head, his word: the + is gone and no room is kept over a title): his page draws no app bar, and the title's hero keeps no room on its right for a circle either */
  ok(!d0.querySelector("#roster > .amb-appbar") && !d0.querySelector("#roster .amb-circle") && /\.amb-hero--title \{ padding-top: [^;}]*; padding-bottom: [^;}]*; \}/.test(css),
    "his page has no + to keep room for: no app bar, no circle, and the title's hero pads its top and foot alone, so every place's title stands where the others' do");
  ok(css.includes("#acct.amb-stack { padding-inline: 0; }"), "the Counter's Account stands on its bar's edges, as Home's columns do");
  /* T5 to T7, the page running */
  const swallow = () => {};
  process.on("unhandledRejection", swallow);
  let tie = { ok: true, clean: true, faults: [], waiting: [], orders: 3, v: 1544, at: "2026-11-18T08:00:00Z" };
  const led1 = { rid: "s901", date: "2026-10-01", party: "CX1-ZED", product: "salt", qty: 1, total: 100, owed: 0, paid: 100, stage: "Done" };
  const extra = (route) => route === "/all/maker/ledger" ? { ok: true, version: 1, orders: 3, open: [], pending: [], recent: [led1], ...(tie === undefined ? {} : { tieout: tie }) } : undefined;
  const p = await richOwnerPage({ pageWork, extra });
  try {
    await p.work.quiet();
    const D = p.d, leds = [...D.querySelectorAll("#roster [data-ledger]")];
    const state = () => leds.map((b) => [!b.querySelector("[data-ledger-ok]").hidden, b.querySelector("[data-ledger-n]").hidden ? "" : b.querySelector("[data-ledger-n]").textContent, b.getAttribute("aria-label")]);
    const all = (tick, n, say) => state().every((s) => s[0] === tick && s[1] === n && s[2] === say);
    /* T5 */
    ok(leds.length === 5 && all(true, "", "Ledger check: every order matches the book"), "while the last check found every site order matching its row, each bar shows the tick and no count: " + JSON.stringify(state()[2]));
    /* T6 */
    tie = { ok: true, clean: false, faults: [{ order: "o-1", rid: "s901", what: ["total"] }, { order: "o-2", rid: "s902", what: ["qty"] }], waiting: [], orders: 3, v: 1544, at: "2026-11-18T08:00:00Z" };
    await p.click(byAct(D, "nav.customers")); await p.click(byAct(D, "nav.record")); await p.click(byAct(D, "nav.customers"));
    ok(p.wire.filter((w) => w.startsWith("/all/maker/ledger GET")).length === 1 && !p.posts.some((x) => x.route === "/all/maker/ledger"),
      "it is read once with the page, not again at each change of place, and runs no check of its own: " + p.wire.filter((w) => w.startsWith("/all/maker/ledger")).length);
    await p.click(D.querySelector("#oCustomers > .amb-head [data-ledger]"));
    const cur = () => (D.querySelector('button[data-m][aria-current="page"]') || { getAttribute: () => "" }).getAttribute("data-m");
    ok(cur() === "orders" && !D.getElementById("oLedger").hidden && D.getElementById("oSplit").hidden && p.w.location.hash === "#orders/ledger" && /Order and book/.test(D.getElementById("led-tie").textContent),
      "a tap on Customers' Ledger check opens the Ledger check under Orders, at its address: " + JSON.stringify([cur(), p.w.location.hash]));
    const pressed = () => [...D.querySelectorAll("#roster [data-ledger]")].map((b) => b.getAttribute("aria-pressed"));
    ok(pressed().length === 5 && pressed().every((v) => v === "true"), "while the Ledger check is open every bar's indicator is pressed, so the bar says where he is: " + JSON.stringify(pressed()));
    ok(all(false, "2", "Ledger check: 2 differences between the orders and the book"), "and once that read finds two differences each bar shows the count and no tick: " + JSON.stringify(state()[0]));
    tie = { ok: true, clean: false, faults: [{ order: "o-1", rid: "s901", what: ["total"] }], waiting: [], orders: 3, v: 1544, at: "2026-11-18T08:00:00Z" };
    await p.click(byAct(D, "ledger.tieout"));
    ok(all(false, "1", "Ledger check: one difference between the orders and the book") && p.posts.filter((x) => x.route === "/all/maker/ledger").length === 1,
      "Check now, the one check he runs, moves every bar: " + JSON.stringify(state()[4]));
    tie = { ok: false, error: "the tie-out could not be read" };
    await p.click(byAct(D, "ledger.tieout"));
    ok(all(false, "", "Ledger check: not checked yet"), "a check that could not be read shows the word alone, never a tick: " + JSON.stringify(state()[1]));
    /* 22 Nov 2026 (the place head): Approve is never hidden, on Needs you and Orders as on the rest, and its count span says the rows that wait */
    const aps = [...D.querySelectorAll("#roster [data-approve]")];
    ok(aps.length === 5 && aps.every((a) => !a.hidden && /^Approve, \d+ to approve$/.test(a.getAttribute("aria-label")) && /^[1-9]\d*$/.test(a.querySelector("[data-approve-n]").textContent) && !a.querySelector("[data-approve-n]").hasAttribute("data-zero")),
      "with rows waiting, Approve stands in every place's status row and names their count: " + JSON.stringify(aps.map((a) => [a.hidden, a.getAttribute("aria-label"), a.querySelector("[data-approve-n]").textContent])));
    await p.click(byAct(D, "nav.record"));
    await p.click(D.querySelector("#oRecord > .amb-head [data-approve]"));
    ok(cur() === "orders" && !D.getElementById("oApprove").hidden && p.w.location.hash === "#orders/approve", "and a tap on Record's opens Approve: " + JSON.stringify([cur(), p.w.location.hash]));
    ok(pressed().length === 5 && pressed().every((v) => v === "false"), "and off the Ledger check no indicator is pressed: " + JSON.stringify(pressed()));
    /* T7 */
    await p.click(byAct(D, "nav.shop")); await p.click(byAct(D, "part.shop.group"));
    const sec = D.querySelector('#oShop [data-in="shop.group"]');
    ok(cur() === "shop" && !sec.hidden && D.querySelectorAll("#makerPools .maker-card").length === 2 && !!byAct(D, "pool.open") && p.w.location.hash === "#shop/group",
      "Group orders opens under Settings and reads its pools: " + JSON.stringify([cur(), sec.hidden, D.querySelectorAll("#makerPools .maker-card").length, p.w.location.hash]));
    await p.click(byAct(D, "nav.needs"));
    p.w.location.hash = "#orders/group"; p.w.dispatchEvent(new p.w.Event("hashchange")); await p.work.quiet();
    ok(cur() === "shop" && !sec.hidden && D.querySelector('.aparts[data-place="shop"] [data-part="group"]').getAttribute("aria-pressed") === "true", "its old address under Orders lands there: " + cur());
    p.w.location.hash = "#orders/payments"; p.w.dispatchEvent(new p.w.Event("hashchange")); await p.work.quiet();
    ok(cur() === "orders" && !D.querySelector('section[data-in="orders.payments"]').hidden && D.getElementById("oSplit").hidden, "and Payments they sent still opens at its address, as Needs you's cards and his alerts open it: " + cur());
  } finally { p.w.close(); }
  /* a quiet book: no rows wait, and Approve still stands on every place, saying a grey 0 (22 Nov 2026, the place head: it stood on Orders alone) */
  const q = await richOwnerPage({ pageWork, bare: true, review: () => ({ ok: true, orders: [], drafts: [], queue: [] }), extra: (route) => route === "/all/maker/ledger" ? { ok: true, version: 1, orders: 0, open: [], pending: [], recent: [] } : undefined });
  try {
    await q.work.quiet();
    const aps = [...q.d.querySelectorAll("#roster [data-approve]")];
    ok(aps.length === 5 && aps.every((a) => !a.hidden && a.getAttribute("aria-label") === "Approve" && a.querySelector("[data-approve-n]").textContent === "0" && a.querySelector("[data-approve-n]").hasAttribute("data-zero")),
      "with no row waiting, Approve still stands on every place, saying a grey 0: " + JSON.stringify(aps.map((a) => [a.hidden, a.querySelector("[data-approve-n]").textContent])));
    const b = q.d.querySelector("#roster [data-ledger]");
    ok(b.querySelector("[data-ledger-ok]").hidden && b.querySelector("[data-ledger-n]").hidden && b.getAttribute("aria-label") === "Ledger check: not checked yet", "and with no tie-out on file Ledger check is its word alone");
  } finally { q.w.close(); process.off("unhandledRejection", swallow); }
}
