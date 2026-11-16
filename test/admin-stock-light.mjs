/* test/admin-stock-light.mjs: THE RESTOCK LIGHT MADE PLAIN, STOCK BY BOOK ON SALT ADMIN'S NEEDS YOU (22 Oct 2026; his word, docs/plan-restock-light.html; and his
 * canvas Needs you of the same day, which put it under the cards). What is proved here, each check red under its own mutation (test/admin-stock-light.mutations.json):
 *   1  under the cards, every book, the worst light first and then the least cover, under the head Stock by book and the day measured; each book its
 *      typed Product tag (on Salt Admin a book is its name) and the light in the Counter's words, in the light's tone, as the Desk measured it; a book
 *      with no light draws no word
 *   2  on a phone a row a book: Cover at the right of the tag and the light, the meter of what is agreed of the shelf (full and ember once promised past it),
 *      what is free, and Next lot alone on its line
 *   3  from 860px a plain table: Book, Light, Shelf, Agreed, Free, Of shelf, Cover and Next lot, the columns in proportion, a free figure under nought in ember
 *   4  each tick of the Needs you poll reads the stock again and the rows follow; a failed read keeps what was read, and none read hides it
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const book = (shelf, free, commit, coverDays, transit, light) => ({ shelf, free, commit, coverDays, transit, ...(light ? { light } : {}) });

async function page(pageWork, answers) {
  let n = 0;
  const p = await richOwnerPage({ pageWork, extra: (route) => (route === "/all/maker/stock" ? answers[Math.min(n++, answers.length - 1)] : undefined) });
  await p.work.quiet();
  byAct(p.d, "nav.needs").click(); await p.work.quiet();
  /* 16 Nov 2026, the move to Ambient (place F): one table, a row a book (tr[data-book]); the light a chip, the meter a progress, the figures cells with their labels */
  const read = () => { const s = p.d.getElementById("nStock");
    const none = { textContent: "", classList: { contains: () => false }, querySelector: () => null, getAttribute: () => "", value: -1 };
    const cell = (r, l) => r.querySelector('td[data-label="' + l + '"]') || none;
    return { s, rows: s ? [...s.querySelectorAll("tbody tr[data-book]")].map((r) => ({ book: r.getAttribute("data-book"), tag: t(cell(r, "Book")), st: (cell(r, "Light").querySelector(".amb-chip") || {}).className || "",
      word: t(cell(r, "Light")), cover: t(cell(r, "Cover")), agreed: t(cell(r, "Agreed")), free: t(cell(r, "Free")), shelf: t(cell(r, "Shelf")), meter: (r.querySelector("progress.amb-meter") || none).getAttribute("aria-label"),
      fill: (r.querySelector("progress.amb-meter") || none).value, lot: t(cell(r, "Next lot")), ember: cell(r, "Agreed").classList.contains("amb-neg"), negfree: cell(r, "Free").classList.contains("amb-neg") })) : [] }; };
  const tick = async () => { p.intervals.filter((i) => i.ms === 5000 && !i.off).forEach((i) => i.f()); await p.work.quiet(); };
  return { p, read, tick };
}

export async function run({ ok, pageWork }) {
  const first = { ok: true, today: "2026-10-22", books: { salt: book(14.89, -1.11, 16, 2.6, 8, "yellow"), oil: book(45, 42, 3, 15.1, 0, "green"),
    candy: book(0, 0, 2, null, 20, "red"), rice: book(9, 9, 0, 4, 0, "green"), gas: book(5, 5, 0, null, 0) }, by: { salt: "2026-10-25", candy: "2026-10-28", rice: "2026-10-30" } };
  const A = await page(pageWork, [first, { ok: true, today: "2026-10-22", books: { salt: book(0, 0, 16, null, 8, "red") }, by: {} }, { refuse: "down" }, { ok: true, today: "2026-10-23", books: {}, by: {} }]);
  try {
    /* 1 */
    const r = A.read();
    const before = r.s && r.s.previousElementSibling;
    /* 16 Nov 2026, the move to Ambient (0.7.8, nested places): Stock by book closes the queue pane, under the cards, since only hidden places may follow a split */
    ok(!!r.s && !r.s.hidden && !!before && before.id === "nlist" && !!r.s.closest(".nsplit") && r.s.querySelector("h2.amb-section").firstChild.textContent === "Stock by book" && t(r.s.querySelector("h2 .amb-section__note")) === "Units · measured 22 Oct"
      && J(r.rows.map((x) => x.book)) === J(["candy", "salt", "rice", "oil", "gas"]) && J(r.rows.map((x) => x.tag)) === J(["Candy", "Salt", "Rice", "Oil", "Gas"])
      && r.rows.map((x) => x.word).join("|") === "Out of stock|Selling fast|Available|Available|"
      && ["amb-chip--neg", "amb-chip", "amb-chip--pos", "amb-chip--pos"].every((c, i) => r.rows[i].st.split(" ").includes(c)) && !/amb-chip--(pos|neg|warn)/.test(r.rows[1].st) && r.rows[4].st === "" && r.rows.every((x) => x.st === "" || /amb-chip__dot/.test(x.st) === false)
      && [...r.s.querySelectorAll("td[data-label=Light] .amb-chip")].every((c) => !!c.querySelector(".amb-chip__dot"))
      && !r.s.querySelector("svg.psym"),
    "under the cards, every book, the worst light first then the least cover, its book's chip and the light in the Counter's words and tone (Selling fast plain), none for a book with no light: " + J(r.rows.map((x) => [x.book, x.word])));
    /* 2 */
    ok(J(r.rows.map((x) => [x.cover, x.meter, x.free, x.lot])) === J([
      ["0 d", "Agreed 2 of 0", "0", "20 units · 28 Oct"],
      ["0 d", "Agreed 16 of 14.89", "−1.11", "8 units · 25 Oct"],
      ["4 d", "Agreed 0 of 9", "9", "None yet · 30 Oct"],
      ["15.1 d", "Agreed 3 of 45", "42", "None"],
      ["4 wk+", "Agreed 0 of 5", "5", "None"]])
      && J(r.rows.map((x) => [x.fill, x.ember])) === J([[100, true], [100, true], [0, false], [7, false], [0, false]]),
    "each row says its cover, what is agreed of the shelf (the meter, full and negative once promised past it), what is free and its next lot: " + J(r.rows.map((x) => [x.cover, x.meter, x.free, x.lot, x.fill])));
    /* 3 */
    const tb = r.s.querySelector("table");
    const heads = tb ? [...tb.querySelectorAll("thead th")].map((h) => [t(h), h.classList.contains("is-num")]) : [];
    const cells = tb ? [...tb.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(t)) : [];
    ok(!!tb && tb.className === "amb-table amb-table--stack" && J(heads) === J([["Book", false], ["Light", false], ["Shelf", true], ["Agreed", true], ["Free", true], ["Of shelf", false], ["Cover", true], ["Next lot", false]])
      && J(cells[1]) === J(["Salt", "Selling fast", "14.89", "16", "−1.11", "", "0 d", "8 units · 25 Oct"]) && [...tb.querySelectorAll("tbody td")].every((td) => td.hasAttribute("data-label"))
      && tb.querySelectorAll("tbody progress.amb-meter").length === 5 && tb.querySelector("tbody tr:nth-child(2) td:nth-child(5)").classList.contains("amb-neg") && !tb.querySelector("tbody tr:nth-child(3) td:nth-child(5)").classList.contains("amb-neg"),
      "one table, Ambient's stack table: its eight columns, a book a row, every cell labelled for the phone's stack, the meter in its own column, a free figure under nought in the negative tone: " + J([heads.map((h) => h[0]), cells[1]]));
    const css = [...A.p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.amb-table--stack thead \{ position: absolute;/.test(css) && !/\.adm \.nstock/.test(css) && /\.nstock \.amb-meter \{ min-width: 4rem; \}/.test(css),
      "the rows stand as labelled lines on a phone and in columns wide by Ambient's own rule, and no rule of the old rows and table is left");
    /* 4 */
    const n0 = A.p.wire.filter((x) => x.startsWith("/all/maker/stock")).length;
    await A.tick();
    const r2 = A.read(), n1 = A.p.wire.filter((x) => x.startsWith("/all/maker/stock")).length;
    ok(n0 === 1 && n1 === 2 && r2.rows.length === 1 && r2.rows[0].word === "Out of stock", "a tick of the Needs you poll reads the stock again and the rows follow it: " + J([n0, n1, r2.rows.map((x) => x.word)]));
    await A.tick();
    const r3 = A.read();
    ok(A.p.wire.filter((x) => x.startsWith("/all/maker/stock")).length === 3 && J(r3.rows) === J(r2.rows) && !r3.s.hidden, "a failed read keeps what was read: " + J(r3.rows.map((x) => x.word)));
    await A.tick();
    const r4 = A.read();
    ok(r4.s.hidden && r4.rows.length === 0, "and a read with no book hides it: " + J(r4.rows));
  } finally { A.p.w.close(); }
  const D = await page(pageWork, [{ refuse: "The Desk is not updated yet." }]);
  try {
    const r = D.read();
    ok(!!r.s && r.s.hidden && r.rows.length === 0, "with nothing read it is hidden");
  } finally { D.p.w.close(); }
}
