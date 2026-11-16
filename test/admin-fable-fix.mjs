/* test/admin-fable-fix.mjs: FABLE'S REVIEW OF SALT ADMIN (17 Nov 2026), the move to Ambient. Display and markup only: no route, request body, act, price or booking changes.
 * What is proved here, each check red under its own mutation (test/admin-fable-fix.mutations.json):
 *   A1  item 2: the dock's Confirm bar carries Ambient's save-bar class only while it shows (Ambient keeps a save bar's room clear even while it is hidden, which
 *       stopped every pane about 98px short of the screen's foot), and the page's old status line holds no room while it is empty (it stopped them 34px short)
 *   A2  item 1: Record is a chain of places (the place, its body and its forms), so its hero rests as Needs you's does and its forms' two panes take the screen
 *   A3  item 3: Needs you's glance heads the queue's pane under its own section head, two tiles across and Receivables across both; Customers' summary notice, find
 *       field and sent count head the accounts' first pane, and only its filters stand before the split; a draw of the list keeps that head
 *   A4  item 5: a row's move is a small quiet pill and the hero's Approve a quiet pill, so the record's foot is the one filled pill on screen
 *   A5  item 10: an empty pane is Shop's form on Needs you, Customers and Record, a head over a one-row card; nothing opens by itself
 *   A6  items 11, 15, 16 and 20: the hours chip a 44px hit area; from 960px what stands before the split takes the panes' edge and the second pane's group and foot its width;
 *       a part of his decision stands a section gap under the Steps
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import { readFileSync } from "node:fs";
import { landingPage, SITE_STYLE } from "../stmt/page.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok, pageWork }) {
  const page = landingPage("", "fable-nonce", { master: "", accounts: [] });
  const css = SITE_STYLE.replace(/\s+/g, " ");
  const open = async () => { const p = await richOwnerPage({ pageWork }); await p.work.quiet(); return p; };
  const p = await open();
  try {
    const d = p.d;
    /* A1 */
    ok(/<div id="apBar" class="apbar" hidden><\/div><nav class="amb-tabbar"/.test(page) && !/id="apBar" class="amb-savebar/.test(page) && /#rmsg:empty \{ margin: 0; min-height: 0; \}/.test(css),
      "the Confirm bar's markup does not carry the save-bar class at rest, and the page's empty status line holds no room");
    const bar = d.getElementById("apBar");
    ok(bar.hidden && !bar.classList.contains("amb-savebar"), "at rest the bar is hidden and is no save bar: Ambient would keep its room clear under every pane");
    enter(d, "orders", "approve"); await p.work.quiet();
    const tick = byAct(d, "draft.approve"); if (tick) { tick.click(); await p.work.quiet(); }
    ok(!tick || (!bar.hidden && bar.classList.contains("amb-savebar")), "once a card is chosen the bar shows and is the save bar: " + bar.className);
    if (tick) { tick.click(); await p.work.quiet(); }
    ok(bar.hidden && !bar.classList.contains("amb-savebar"), "and when the choice is cleared the bar is hidden and no save bar again: " + bar.className);

    /* A2 */
    ok(/<div id="oRecord" class="aplace amb-place" data-in="record" hidden>/.test(page) && /<div class="abody amb-place"><section id="makerInputs" class="amb-place"/.test(page),
      "Record's place, its body and its forms are each an amb-place, the chain Ambient's panes need");

    /* A3 */
    const needsSplit = d.querySelector("#mHome .nsplit"), first = needsSplit && needsSplit.children[0];
    ok(!!first && first.firstElementChild.id === "nGlanceBox" && first.children[1].id === "nlist" && !!d.querySelector("#nGlanceBox > h2.amb-section")
      && !!d.querySelector("#nGlanceBox > #nGlance.amb-tiles") && !d.querySelector("#mHome > .amb-stack #nGlance"),
    "Needs you's glance is the first group of the queue's pane, under its own section head, and no longer stands before the split");
    ok(/\.nglancebox > \.amb-tiles \{ padding-inline: 0; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/.test(css) && /\.nglancebox > \.amb-tiles > \.nkpi--owed \{ grid-column: 1 \/ -1; \}/.test(css),
      "the glance is two tiles across and Receivables spans both");
    enter(d, "customers", "accounts"); await p.work.quiet();
    const rl = d.getElementById("rlist"), find = d.getElementById("rq"), afind = d.querySelector("#oAccts .afind");
    ok(!!rl.querySelector(":scope > .afhead > #alead") && !!rl.querySelector(":scope > .afhead > .amb-search > #rq") && !!rl.querySelector(":scope > .afhead > #scount")
      && !!afind.querySelector("#afil") && !afind.querySelector("#rq, #alead, #scount"),
    "Customers' summary notice, find field and sent count head the first pane; only the filters stand before the split");
    find.value = "cx1"; find.dispatchEvent(new d.defaultView.Event("input", { bubbles: true })); await p.work.quiet();
    ok(d.getElementById("rq") === find && !!rl.querySelector(":scope > .afhead") && rl.querySelectorAll("#rlist [data-u]").length >= 1,
      "a draw of the list keeps the pane's head and the find field, and draws the groups afresh");
    find.value = ""; find.dispatchEvent(new d.defaultView.Event("input", { bubbles: true })); await p.work.quiet();

    /* A4 */
    const moves = [...d.querySelectorAll("#rlist .amb-row__trail .amb-pill")];
    ok(moves.length >= 2 && moves.every((b) => b.classList.contains("amb-pill--sm") && b.classList.contains("amb-pill--quiet")),
      "an account row's move is a small quiet pill: " + moves.map((b) => b.className).join(" | "));
    enter(d, "orders", "todo"); await p.work.quiet();
    const omoves = [...d.querySelectorAll("#makerOrderList .amb-row__trail .amb-pill")];
    ok(omoves.length >= 1 && omoves.every((b) => b.classList.contains("amb-pill--sm") && b.classList.contains("amb-pill--quiet")),
      "an order row's move is a small quiet pill: " + omoves.map((b) => b.className).join(" | "));
    ok(/<button type="button" class="amb-pill amb-pill--quiet" id="aApprove"/.test(page), "the hero's Approve is a quiet pill");

    /* A5 */
    enter(d, "record", "entry"); await p.work.quiet();
    const rec = d.querySelector("#makerFormGrid .recnone"), cardOf = (e) => e && e.querySelector(":scope > h3.amb-settings__head + ul.amb-settings__list > li > .amb-setting > .amb-setting__name");
    ok(!!rec && rec.classList.contains("amb-settings") && t(cardOf(rec)) === "Choose a form to open it here." && /<div class="amb-settings rnone panenone"><h3 class="amb-settings__head">No card open<\/h3>/.test(page)
      && /<div class="amb-settings" id="anone"><h3 class="amb-settings__head">No account open<\/h3>/.test(page),
    "Record's, Needs you's and Customers' empty panes are a head over a one-row card, as Shop's is");
    ok(!d.querySelector("#nopen:not([hidden])") && d.getElementById("aopen").hidden && !d.querySelector("#makerFormGrid.open"), "and nothing opens by itself in any of them");

    /* A6 */
    ok(/#aBarHours \{ min-height: var\(--amb-tap\); min-width: var\(--amb-tap\); \}/.test(css), "the hours chip is a 44px hit area");
    ok(/:is\(#unsentBar, \.amb-stack:has\(> #nFail\), \.amb-stack:has\(> \.aparts\), \.afind\):is\(:has\(~ \.amb-split--panes:not\(\[hidden\]\)\), :has\(~ \.amb-place:not\(\[hidden\]\) \.amb-split--panes:not\(\[hidden\]\)\)\) \{ padding-inline: 0; \}/.test(css),
      "from 960px what stands before the split takes the panes' own edge");
    ok(/\.amb-split--panes > \.amb-stack:last-child \.amb-settings, \.amb-split--panes > \.amb-stack:last-child \.amb-foot > \.amb-pill \{ max-width: none; \}/.test(css),
      "the second pane's group and the foot take the pane's width");
    ok(/\.odecide__part \{ min-width: 0; margin-top: var\(--amb-space-3\); \}/.test(css), "a part of his decision stands a section gap under the Steps");

    /* A7 (Fable's second round, A): a queue row's code never breaks at its dash, and its sub line is one line ending in an ellipsis */
    ok(/\.ordcard \.ocode \{ font-family: var\(--amb-font-mono\); white-space: nowrap; \}/.test(css) && /\.ordcard \.amb-row__sub \{ display: block; white-space: nowrap; text-overflow: ellipsis; \}/.test(css) && /\.ordcard > \.amb-row__trail \{ flex: 0 1 auto; flex-wrap: wrap;/.test(css),
      "a queue row's customer code stays whole (its trail wraps rather than cutting it) and its sub line ends in an ellipsis on one line");
    /* A8 (D): an unsent card's Resend is the small pill it is drawn as, its acts row not stretching it */
    ok(/\.unsent-card \.amb-task__acts > \.amb-pill \{ flex: none; max-width: none; \}/.test(css) && /aPill\(label,act,undefined,true\)/.test(readFileSync(new URL("../stmt/owner.js", import.meta.url), "utf8")),
      "Resend is a small filled pill (amb-pill--sm) at its own width, not a block");
  } finally { p.w.close(); }
}
