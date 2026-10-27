/* test/admin-record-menu.mjs: SALT ADMIN RECORD, P1, THE PARTS AND THE MENU (25 Oct 2026; his canvas Salt Admin Record and his Asks A and B). What is proved here,
 * each check red under its own mutation (test/admin-record-menu.mutations.json):
 *   1  Record's parts are the system's Nav bar, a text tab row of three (Entry, Customers, Pricing), never a slider or pills; the part open is the selected tab
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
    const strip = d.querySelector('.aparts[data-place="record"]'), nav = strip && strip.parentElement;
    const tabs = strip ? [...strip.querySelectorAll("button[data-part]")] : [];
    ok(!!nav && nav.tagName === "NAV" && nav.classList.contains("salt-nav") && nav.classList.contains("rparts") && strip.classList.contains("salt-nav__links")
      && !strip.classList.contains("salt-segment") && !strip.classList.contains("salt-tabs") && strip.getAttribute("role") === "tablist"
      && J(tabs.map((b) => b.firstChild.textContent)) === J(["Entry", "Customers", "Pricing"])
      && tabs.every((b) => b.classList.contains("salt-nav__link") && b.classList.contains("nktab") && b.getAttribute("role") === "tab" && !b.classList.contains("salt-segment__opt") && !b.classList.contains("salt-tabs__pill")),
      "Record's parts are the Nav bar's text tab row of three, never a slider or pills: " + J(tabs.map(t)));
    byAct(d, "part.record.pricing").click(); await quiet();
    ok(J(tabs.map((b) => b.getAttribute("aria-selected"))) === J(["false", "false", "true"]), "the part he taps is the tab selected: " + J(tabs.map((b) => b.getAttribute("aria-selected"))));
    byAct(d, "part.record.entry").click(); await quiet();
    /* 2 */
    const n = tabs.map((b) => t(b.querySelector(".nktab__n")));
    ok(J(n) === J(["2", "", ""]), "beside Entry the two entries unsent on this phone (a loan and a stock count), and nothing beside Customers or Pricing: " + J(n));
    /* 3 */
    const row = (slug) => d.querySelector('#makerMenu [data-act="record.form"][data-key="' + slug + '"]');
    const read = (slug) => { const r = row(slug); return r ? [t(r.querySelector(".salt-settings__label")), t(r.querySelector(".salt-settings__value.mfig")), !!r.querySelector(".salt-settings__mark svg.mgo")] : null; };
    const want = { "sale-or-purchase": ["Sale or purchase", "", true], "repayment": ["Repayment", "2", true], "rewards": ["Rewards", "1", true], "offsets": ["Offsets", "1", true],
      "reopen-a-cancelled-order": null, "correct-a-row": null, "gift": ["Gift", "", true],   /* 27 Oct 2026, his word: Fixing's two forms are no rows of the menu */ "change-a-name-or-place": ["Name or place", "", true], "place-on-the-map": ["Map point", "", true] };
    const got = Object.keys(want).map((k) => [k, read(k)]);
    ok(got.every(([k, v]) => J(v) === J(want[k])), "a form's row is its name, a count where its read holds one (2 loans, 1 reward to give, 1 offset) and the chevron, and Correct a row and Reopen have none: " + J(got));
    const rows = [...d.querySelectorAll('#makerMenu [data-act="record.form"]')];
    ok(rows.length >= 13 && rows.every((r) => r.classList.contains("salt-settings__row") && r.classList.contains("salt-settings__row--action") && r.parentElement.classList.contains("salt-settings")
      && t(r.querySelector(".salt-settings__label")).split(" ").length <= 3 && !r.querySelector(".salt-inbox-row__what")),
      "every form's row, on all three parts, is a settings row in a settings list, named in three words at most, with no second line: " + rows.map((r) => t(r.querySelector(".salt-settings__label"))).join(", "));
    const form = (slug) => d.querySelector('#makerInputs section.maker-input[data-form="' + slug + '"]');
    const line = (slug, words) => { const f = form(slug); return f ? [...f.querySelectorAll("p")].filter((x) => t(x) === words).length : -1; };
    const lines = [["stock-count", "Units on the shelf, by book."], ["offsets", "Units off an order they already have."], ["gift", "A gift leaves stock at cost."], ["correct-a-row", "Restate, record what moved, or cancel."]].map(([k, w]) => [k, line(k, w)]);
    const own = ["new-customer", "rewards", "change-a-name-or-place"].map((k) => [k, form(k).querySelectorAll(".formwhat").length]);
    ok(lines.every(([, n]) => n === 1) && t(form("stock-count").querySelector("h3").nextElementSibling) === "Units on the shelf, by book." && own.every(([, n]) => n === 0),
      "the line saying what a form is for stands once in the form, under its heading, whether the form had it or the menu did, and a form with a line of its own takes no second: " + J([lines, own]));
    /* 4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const entry = d.querySelector('#makerMenu [data-in="record.entry"]'), kids = entry ? [...entry.children].map((n) => n.classList.contains("salt-settings__head") ? "head" : n.classList.contains("salt-settings") ? "list" : n.className) : [];
    ok(/\.adm \.rparts>\.aparts\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css) && !/\.formrow[^a-z-]/.test(css) && !/\.formlist[^a-z-]/.test(css)
      && J(kids) === J(["head", "list", "head", "list"])   /* 27 Oct 2026: two groups, Fixing gone */ && entry.querySelector(".salt-settings__head").tagName === "H2",
      "Entry is three settings heads, each over its own list, the parts three equal columns, and the page adds no rule to a row or a list: " + J(kids));
  } finally { p.w.close(); }
}
