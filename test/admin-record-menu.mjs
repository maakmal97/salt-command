/* test/admin-record-menu.mjs: SALT ADMIN RECORD, P1, THE PARTS AND THE MENU (25 Oct 2026; his canvas Salt Admin Record and his Asks A and B). What is proved here,
 * each check red under its own mutation (test/admin-record-menu.mutations.json):
 *   1  Record's parts are the system's Nav bar, a text tab row of three (Entry, Customers, Pricing), never a slider or pills; the part open is the selected tab
 *   2  beside a part's word, the count of the entries waiting unsent on this phone in that part, and none beside a part with none
 *   3  a form's row is its name and one line saying what it is for, then a count where the read that drew the menu holds one (the loans to repay, the rewards held,
 *      the cancelled orders that can come back, the offsets once their own read lands), then the way in; a row with nothing to count is bare
 *   4  the page's rules: the parts three equal columns, a row one height (68px), its name and line one line each, nothing on it wraps
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
    const read = (slug) => { const r = row(slug); return r ? [t(r.querySelector(".salt-inbox-row__title")), t(r.querySelector(".salt-inbox-row__what")), t(r.querySelector(".salt-inbox-row__side .mfig")), !!r.querySelector(".salt-inbox-row__side svg.mgo")] : null; };
    const want = { "sale-or-purchase": ["Sale or purchase", "Goods and delivery are entered separately.", "", true], "repayment": ["Repayment", "Part or all of a loan, paid back.", "2", true],
      "rewards": ["Rewards", "Settles what they owe first, else goods.", "1", true], "offsets": ["Offsets", "Units off an order they already have.", "1", true],
      "reopen-a-cancelled-order": ["Reopen a cancelled order", "Only if nothing was paid or handed over.", "1", true], "gift": ["Gift", "A gift leaves stock at cost.", "", true] };
    const got = Object.keys(want).map((k) => [k, read(k)]);
    ok(got.every(([k, v]) => J(v) === J(want[k])), "a form's row is its name, its one line, a count where its read holds one (2 loans, 1 reward to give, 1 offset, 1 order to reopen) and the way in: " + J(got));
    const rows = [...d.querySelectorAll('#makerMenu [data-act="record.form"]')];
    ok(rows.length >= 15 && rows.every((r) => r.querySelector(".salt-inbox-row__main") && r.lastElementChild.classList.contains("salt-inbox-row__side") && t(r.querySelector(".salt-inbox-row__what"))),
      "every form's row, on all three parts, carries its line and its side: " + rows.length + " rows");
    /* 4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.rparts>\.aparts\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css) && /\.adm \.formrow\{box-sizing:border-box;height:68px;flex-wrap:nowrap/.test(css)
      && /\.adm \.formrow \.salt-inbox-row__title>span,\.adm \.formrow \.salt-inbox-row__what\{[^}]*overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/.test(css),
      "the parts are three equal columns, a row is one height, 68px, and its name and line are one line each, an ellipsis at most");
  } finally { p.w.close(); }
}
