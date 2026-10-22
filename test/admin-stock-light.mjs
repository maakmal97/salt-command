/* test/admin-stock-light.mjs: THE RESTOCK LIGHT MADE PLAIN, P3, STOCK BY BOOK ON SALT ADMIN'S NEEDS YOU (22 Oct 2026; his word, docs/plan-restock-light.html).
 * What is proved here, each check red under its own mutation (test/admin-stock-light.mutations.json):
 *   1  under the glance, every book, the worst light first and then the least cover; each its mark (no product word) and the light in the
 *      Counter's words in the light's colour, as the Desk measured it; a book with no light draws no word
 *   2  its figures: the shelf, what is agreed, what is free, the days of cover, the next lot's units and day; the day measured is the title
 *   3  each tick of the Needs you poll reads the stock again and the card follows; a failed read keeps what was read, and none read hides it
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
    return { s, rows: s ? [...s.querySelectorAll(".nstock__row")].map((r) => ({ mark: t(r.querySelector(".pwith .sr")), st: (r.querySelector(".salt-status") || {}).className || "",
      word: t(r.querySelector(".salt-status")), fig: t(r.querySelector(".nstock__fig")) })) : [] }; };
  const tick = async () => { p.intervals.filter((i) => i.ms === 5000 && !i.off).forEach((i) => i.f()); await p.work.quiet(); };
  return { p, read, tick };
}

export async function run({ ok, pageWork }) {
  const first = { ok: true, today: "2026-10-22", books: { salt: book(14.89, 13.39, 16, 2.6, 8, "yellow"), oil: book(45, 45, 3, 15.1, 0, "green"),
    candy: book(0, 0, 2, null, 20, "red"), rice: book(9, 9, 0, 4, 0, "green"), spare: book(5, 5, 0, null, 0) }, by: { salt: "2026-10-25", candy: "2026-10-28", rice: "2026-10-30" } };
  const A = await page(pageWork, [first, { ok: true, today: "2026-10-22", books: { salt: book(0, 0, 16, null, 8, "red") }, by: {} }, { refuse: "down" }, { ok: true, today: "2026-10-23", books: {}, by: {} }]);
  try {
    /* 1 */
    const r = A.read(), marks = r.rows.map((x) => x.mark);
    const after = r.s && r.s.previousElementSibling && r.s.previousElementSibling.id;
    ok(!!r.s && !r.s.hidden && after === "nGlance" && t(r.s.querySelector("h2")) === "Stock by book" && r.rows.length === 5
      && r.rows.map((x) => x.word).join("|") === "Out of stock|Limited|Available|Available|"
      && ["sup-red", "sup-yellow", "sup-green", "sup-green"].every((c, i) => r.rows[i].st.includes("supst") && r.rows[i].st.includes(c)) && r.rows[4].st === ""
      && marks.every(Boolean) && new Set(marks).size === 5 && !/\b(salt|oil|candy|rice|spare)\b/i.test(t(r.s).replace(/Shelf/g, "")),
    "under the glance, every book, the worst light first then the least cover, its mark and the light in the Counter's words and colour, none for a book with no light: " + J(r.rows));
    /* 2 */
    const nb = (s) => s.replace(/ /g, " ");
    ok(J(r.rows.map((x) => nb(x.fig))) === J([
      "Shelf 0 unit · agreed 2 units · 0 unit free · 0 d cover · Next lot 20 units, 28 Oct",
      "Shelf 14.89 units · agreed 16 units · 13.39 units free · 2.6 d cover · Next lot 8 units, 25 Oct",
      "Shelf 9 units · agreed 0 unit · 9 units free · 4 d cover · Next lot nothing on the way yet, 30 Oct",
      "Shelf 45 units · agreed 3 units · 45 units free · 15.1 d cover · Next lot nothing on the way",
      "Shelf 5 units · agreed 0 unit · 5 units free · over 4 wk cover · Next lot nothing on the way"]) && r.s.querySelector("h2").title === "As measured on 22 Oct",
    "each book's shelf, agreed, free, days of cover, and the next lot's units and day; the day measured is the title: " + J(r.rows.map((x) => x.fig)));
    /* 3 */
    const n0 = A.p.wire.filter((x) => x.startsWith("/all/maker/stock")).length;
    await A.tick();
    const r2 = A.read(), n1 = A.p.wire.filter((x) => x.startsWith("/all/maker/stock")).length;
    ok(n0 === 1 && n1 === 2 && r2.rows.length === 1 && r2.rows[0].word === "Out of stock", "a tick of the Needs you poll reads the stock again and the card follows it: " + J([n0, n1, r2.rows]));
    await A.tick();
    const r3 = A.read();
    ok(A.p.wire.filter((x) => x.startsWith("/all/maker/stock")).length === 3 && J(r3.rows) === J(r2.rows) && !r3.s.hidden, "a failed read keeps what was read: " + J(r3.rows));
    await A.tick();
    const r4 = A.read();
    ok(r4.s.hidden && r4.rows.length === 0, "and a read with no book hides the card: " + J(r4.rows));
  } finally { A.p.w.close(); }
  const D = await page(pageWork, [{ refuse: "The Desk is not updated yet." }]);
  try {
    const r = D.read();
    ok(!!r.s && r.s.hidden && r.rows.length === 0, "with nothing read the card is hidden, and the tiles say it could not be read");
  } finally { D.p.w.close(); }
}
