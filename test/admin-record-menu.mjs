/* test/admin-record-menu.mjs: SALT ADMIN RECORD, P1, THE PARTS AND THE MENU (25 Oct 2026; his canvas Salt Admin Record and his Asks A and B). What is proved here,
 * each check red under its own mutation (test/admin-record-menu.mutations.json):
 *   1  Record's parts are the system's Nav bar, a text tab row of three (Entry, Customers, Pricing), never a slider or pills; the part open is the selected tab
 *      (22 Nov 2026, the place head: the row is a sliding segment, the head's first row, and never wraps)
 *   2  beside a part's word, the count of the entries waiting unsent on this phone in that part, and none beside a part with none
 *   3  (27 Oct 2026, his answers: forms, menus and words in the language of Shop's This device) a form's row is a settings row in a settings list: its name, three
 *      words at most, then a count where the read that drew the menu holds one (the loans to repay, the rewards held, the cancelled orders that can come back, the
 *      offsets once their own read lands), then the chevron; a row with nothing to count is bare; the line saying what a form is for stands once in the form
 *   4  Entry's groups are settings heads, each over its own list; the parts three equal columns, and the page adds no rule of its own to a row
 * Drawn by the maker harness (test/maker-act.mjs), which keeps one loan unsent on the phone. */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const KEEP = "saltMakerPending:";

export async function run({ ok, pageWork }) {
  const count = { path: "/all/maker/inputs/stock-count", body: { at: "2026-10-09T05:00:00.000Z", product: "salt", date: "2026-10-09", qty: 12 } };
  const p = await richOwnerPage({ pageWork, retained: [[KEEP + count.path, J(count)]],
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, loans: [...j.catalog.loans, { rid: "loan-2", party: "CX2-ZED", remaining: 2, form: "salt", direction: "in" }],
      rewards: [...j.catalog.rewards, { code: "CX1-ZED", held: 1, free: 1, associate: false, departed: true, action: null }] } }) });
  try {
    await p.work.quiet();
    const d = p.d, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    /* 1 */
    /* 16 Nov 2026, the move to Ambient (place I): Record's parts are Ambient's Segment of three, a part pressed, the unsent count its segment count */
    /* 22 Nov 2026 (the place head): the segment stands in the place's head (div.amb-head), its first row, and slides on one row where it was a stack's child that could wrap */
    const strip = d.querySelector('.aparts[data-place="record"]'), nav = strip && strip.parentElement;
    const tabs = strip ? [...strip.querySelectorAll("button[data-part]")] : [];
    ok(!!nav && nav.classList.contains("amb-head") && strip.classList.contains("amb-segment") && strip.classList.contains("amb-segment--slide") && !strip.classList.contains("amb-segment--wrap") && strip.getAttribute("role") === "group"
      && J(tabs.map((b) => b.firstChild.textContent)) === J(["Entry", "Customers", "Pricing"])
      && tabs.every((b) => b.classList.contains("amb-segment__opt") && !b.hasAttribute("role") && !/salt-/.test(b.className)),
      "Record's parts are Ambient's Segment of three, sliding on one row in the head, never a slider, wrapping pills or a stack's child: " + J(tabs.map(t)));
    byAct(d, "part.record.pricing").click(); await quiet();
    const pressed1 = tabs.map((b) => b.getAttribute("aria-pressed"));
    byAct(d, "nav.needs").click(); await quiet(); byAct(d, "nav.record").click(); await quiet();   /* back to Record opens its first part: the page presses it, Ambient's script only presses what is tapped */
    const pressed2 = tabs.map((b) => b.getAttribute("aria-pressed"));
    ok(J(pressed1) === J(["false", "false", "true"]) && J(pressed2) === J(["true", "false", "false"]) && tabs.every((b) => !b.hasAttribute("aria-selected")), "the part he taps is the one pressed, and the first when he comes back: " + J([pressed1, pressed2]));
    byAct(d, "part.record.entry").click(); await quiet();
    /* 2 */
    const n = tabs.map((b) => t(b.querySelector(".amb-segment__count")));
    ok(J(n) === J(["2", "", ""]), "beside Entry the two entries unsent on this phone (a loan and a stock count), and nothing beside Customers or Pricing: " + J(n));
    /* 3 */
    const row = (slug) => d.querySelector('#makerMenu [data-act="record.form"][data-key="' + slug + '"]');
    const read = (slug) => { const r = row(slug); return r ? [t(r.querySelector(".amb-setting__name")), t(r.querySelector(".amb-setting__value.mfig")), !!r.querySelector('svg.amb-icon use[href="#amb-next"]')] : null; };
    const want = { "sale-or-purchase": ["Sale or purchase", "", true], "repayment": ["Repayment", "2", true], "rewards": ["Rewards", "1", true], "offsets": ["Offsets", "1", true],
      "reopen-a-cancelled-order": null, "correct-a-row": null, "gift": ["Gift", "", true],   /* 27 Oct 2026, his word: Fixing's two forms are no rows of the menu */ "change-a-name-or-place": ["Name or place", "", true], "place-on-the-map": ["Map point", "", true] };
    const got = Object.keys(want).map((k) => [k, read(k)]);
    ok(got.every(([k, v]) => J(v) === J(want[k])), "a form's row is its name, a count where its read holds one (2 loans, 1 reward to give, 1 offset) and the chevron, and Correct a row and Reopen have none: " + J(got));
    const rows = [...d.querySelectorAll('#makerMenu [data-act="record.form"]')];
    ok(rows.length >= 13 && rows.every((r) => r.classList.contains("amb-setting") && r.tagName === "BUTTON" && r.parentElement.tagName === "LI" && r.parentElement.parentElement.classList.contains("amb-settings__list")
      && t(r.querySelector(".amb-setting__name")).split(" ").length <= 3 && !r.querySelector(".amb-row__sub")),
      "every form's row, on all three parts, is a settings row in a settings list, named in three words at most, with no second line: " + rows.map((r) => t(r.querySelector(".amb-setting__name"))).join(", "));
    const form = (slug) => d.querySelector('#makerInputs section.maker-input[data-form="' + slug + '"]');
    const line = (slug, words) => { const f = form(slug); return f ? [...f.querySelectorAll("p")].filter((x) => t(x) === words).length : -1; };
    const lines = [["stock-count", "Units on the shelf, by book."], ["offsets", "Units off an order they already have."], ["gift", "A gift leaves stock at cost."], ["correct-a-row", "Restate, record what moved, or cancel."]].map(([k, w]) => [k, line(k, w)]);
    const own = ["new-customer", "rewards", "change-a-name-or-place"].map((k) => [k, form(k).querySelectorAll(".formwhat").length]);
    ok(lines.every(([, n]) => n === 1) && t(form("stock-count").querySelector("h3").nextElementSibling) === "Units on the shelf, by book." && own.every(([, n]) => n === 0),
      "the line saying what a form is for stands once in the form, under its heading, whether the form had it or the menu did, and a form with a line of its own takes no second: " + J([lines, own]));
    /* 4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const entry = d.querySelector('#makerMenu [data-in="record.entry"]'), kids = entry ? [...entry.children].map((n) => n.classList.contains("amb-settings") && n.firstElementChild.classList.contains("amb-settings__head") && n.lastElementChild.classList.contains("amb-settings__list") ? "group" : n.className) : [];
    ok(!/\.formrow[^a-z-]/.test(css) && !/\.formlist[^a-z-]/.test(css)
      && J(kids) === J(["group", "group"])   /* 27 Oct 2026: two groups, Fixing gone */ && entry.querySelector(".amb-settings__head").tagName === "H3",
      "Entry is two settings groups, each its head over its own list, and the page adds no rule to a row or a list: " + J(kids));
  } finally { p.w.close(); }
}
