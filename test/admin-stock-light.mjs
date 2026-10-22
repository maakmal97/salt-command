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
  const read = () => { const s = p.d.getElementById("nStock");
    return { s, rows: s ? [...s.querySelectorAll(".nstock__row")].map((r) => ({ book: r.getAttribute("data-book"), tag: t(r.querySelector(".salt-producttag")), st: (r.querySelector(".nstock__who .salt-status") || {}).className || "",
      word: t(r.querySelector(".nstock__who .salt-status")), cover: t(r.querySelector(".nstock__cover")), line: [...r.querySelectorAll(".salt-meter__line > span")].map(t).join(" | "), meter: r.querySelector(".salt-meter").className,
      fill: r.querySelector(".salt-meter__fill").style.getPropertyValue("--salt-fill"), lot: t(r.querySelector(".nstock__lot")), alone: r.lastElementChild === r.querySelector(".nstock__lot") && !r.querySelector(".nstock__top .nstock__lot") })) : [] }; };
  const tick = async () => { p.intervals.filter((i) => i.ms === 5000 && !i.off).forEach((i) => i.f()); await p.work.quiet(); };
  return { p, read, tick };
}

export async function run({ ok, pageWork }) {
  const first = { ok: true, today: "2026-10-22", books: { salt: book(14.89, -1.11, 16, 2.6, 8, "yellow"), oil: book(45, 42, 3, 15.1, 0, "green"),
    candy: book(0, 0, 2, null, 20, "red"), rice: book(9, 9, 0, 4, 0, "green"), spare: book(5, 5, 0, null, 0) }, by: { salt: "2026-10-25", candy: "2026-10-28", rice: "2026-10-30" } };
  const A = await page(pageWork, [first, { ok: true, today: "2026-10-22", books: { salt: book(0, 0, 16, null, 8, "red") }, by: {} }, { refuse: "down" }, { ok: true, today: "2026-10-23", books: {}, by: {} }]);
  try {
    /* 1 */
    const r = A.read();
    const before = r.s && r.s.previousElementSibling;
    ok(!!r.s && !r.s.hidden && !!before && before.classList.contains("nsplit") && t(r.s.querySelector(".nstock__head h2")) === "Stock by book" && t(r.s.querySelector(".nstock__head .salt-status")) === "Units · measured 22 Oct"
      && J(r.rows.map((x) => x.book)) === J(["candy", "salt", "rice", "oil", "spare"]) && J(r.rows.map((x) => x.tag)) === J(["Candy", "Salt", "Rice", "Oil", "Spare"])
      && r.rows.map((x) => x.word).join("|") === "Out of stock|Limited|Available|Available|"
      && ["salt-status--ember", "salt-status--brass", "salt-status--verdigris", "salt-status--verdigris"].every((c, i) => r.rows[i].st.includes(c)) && r.rows[4].st === ""
      && !r.s.querySelector("svg.psym"),
    "under the cards, every book, the worst light first then the least cover, its typed tag and the light in the Counter's words and tone, none for a book with no light: " + J(r.rows.map((x) => [x.book, x.word])));
    /* 2 */
    ok(J(r.rows.map((x) => [x.cover, x.line, x.lot])) === J([
      ["Cover 0 d", "Agreed 2 of 0 | Free 0", "Next lot 20 units · 28 Oct"],
      ["Cover 0 d", "Agreed 16 of 14.89 | Free −1.11", "Next lot 8 units · 25 Oct"],
      ["Cover 4 d", "Agreed 0 of 9 | Free 9", "Next lot None yet · 30 Oct"],
      ["Cover 15.1 d", "Agreed 3 of 45 | Free 42", "Next lot None"],
      ["Cover 4 wk+", "Agreed 0 of 5 | Free 5", "Next lot None"]])
      && r.rows.every((x) => x.alone) && J(r.rows.map((x) => [x.fill, /salt-meter--ember/.test(x.meter)])) === J([["100", true], ["100", true], ["0", false], ["7", false], ["0", false]]),
    "on a phone each row says its cover, what is agreed of the shelf and what is free over the meter (full and ember once promised past it), and its next lot alone: " + J(r.rows.map((x) => [x.cover, x.line, x.lot, x.fill])));
    /* 3 */
    const tb = r.s.querySelector(".nstock__table table");
    const heads = tb ? [...tb.querySelectorAll("thead th")].map((h) => [t(h), h.classList.contains("salt-table__left")]) : [];
    const cells = tb ? [...tb.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(t)) : [];
    const widths = tb ? [...tb.querySelectorAll("col")].map((c) => parseFloat(c.style.getPropertyValue("width"))) : [];
    ok(!!tb && tb.className === "salt-table salt-table--plain" && J(heads) === J([["Book", true], ["Light", true], ["Shelf", false], ["Agreed", false], ["Free", false], ["Of shelf", true], ["Cover", false], ["Next lot", true]])
      && J(cells[1]) === J(["Salt", "Limited", "14.89", "16", "−1.11", "", "0 d", "8 units · 25 Oct"]) && widths.length === 8 && widths.reduce((a, b) => a + b, 0) === 100
      && tb.querySelectorAll("tbody .salt-meter").length === 5 && tb.querySelector("tbody tr:nth-child(2) td:nth-child(5)").classList.contains("nfree--neg") && !tb.querySelector("tbody tr:nth-child(3) td:nth-child(5)").classList.contains("nfree--neg"),
      "from 860px a plain table: its eight columns in proportion, a book a row, the meter in its own column, a free figure under nought in ember: " + J([heads.map((h) => h[0]), cells[1], widths]));
    const css = [...A.p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/@media \(min-width:860px\)\{\.adm \.nstock__list\{display:none\}\.adm \.nstock__table\{display:block\}\}/.test(css) && /\.adm \.nstock__table\{display:none;/.test(css)
      && /\.adm \.nstock__top\{[^}]*white-space:nowrap\}/.test(css) && /\.adm \.nstock__cover,\.adm \.nstock__lot\{[^}]*white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/.test(css),
      "the rows on a phone and the table from 860px, one at a time, and nothing in them wraps");
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
