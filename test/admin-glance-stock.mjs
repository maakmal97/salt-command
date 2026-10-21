/* test/admin-glance-stock.mjs: STOCK ON SALT ADMIN'S GLANCE, P4, THE TWO TILES (21 Oct 2026; docs/plan-admin-glance-stock.html, canvas V62).
 * What is proved here, each check red under its own mutation (test/admin-glance-stock.mutations.json):
 *   1  Stock cover and Next lot stand after Ready and Owed to you, not links, the book's mark by the title and no product word; four across
 *      from 1080px, two by two below
 *   2  the book shown is the one with the least cover, a book with nothing free first
 *   3  the words: the shelf; "n free · n d", "0 d" with nothing free, "over 4 wk" with stock and no cover figure; the expected day DD Mon,
 *      "n units expected", "Nothing on the way yet" with a day and none coming, a dash and "Nothing on the way" with neither; the day
 *      measured is the title
 *   4  read once a page open; a failed read draws a dash and says so; and never the word the plan bans
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");   /* a no-break space reads as a space here: \s holds it */
const J = JSON.stringify;
const book = (shelf, free, coverDays, transit) => ({ shelf, free, commit: 0, coverDays, transit });

async function page(pageWork, answer) {
  const p = await richOwnerPage({ pageWork, extra: (route) => (route === "/all/maker/stock" ? answer : undefined) });
  await p.work.quiet();
  byAct(p.d, "nav.needs").click(); await p.work.quiet();
  const tiles = [...p.d.querySelectorAll("#nGlance .salt-glance__item")];
  const read = tiles.map((a) => [a.getAttribute("data-glance"), t(a.querySelector(".salt-glance__label")), t(a.querySelector(".salt-glance__value")), t(a.querySelector(".salt-glance__note"))]);
  return { p, tiles, read, stock: tiles.find((a) => a.getAttribute("data-glance") === "stock"), lot: tiles.find((a) => a.getAttribute("data-glance") === "lot") };
}
const mark = (a) => { const s = a && a.querySelector(".salt-glance__label .pwith .sr"); return s ? t(s) : null; };

export async function run({ ok, pageWork }) {
  /* 1, 2, 3: nothing free on candy puts it first, ahead of salt's 2.6 days */
  const A = await page(pageWork, { ok: true, today: "2026-10-20", books: { salt: book(14.89, 13.39, 2.6, 8), oil: book(45, 45, 15.1, 0), candy: book(6, 0, null, 0) },
    by: { salt: "2026-10-25", candy: "2026-10-27" } });
  try {
    const css = [...A.p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(J(A.read.map((r) => r[0])) === J(["ready", "owed", "stock", "lot"]) && A.stock.tagName === "DIV" && A.lot.tagName === "DIV"
      && !A.stock.hasAttribute("data-act") && !A.stock.hasAttribute("href") && A.read[0][1] === "Ready",
      "Stock cover and Next lot stand after Ready and Owed to you, and are not links: " + J(A.read));
    ok(/\.adm \.nglance\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(css) && /@media \(min-width:1080px\)\{\.adm \.nglance\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}\}/.test(css),
      "four across from 1080px, two by two below");
    const words = t(A.p.d.getElementById("nGlance")).replace(/ /g, " ");
    ok(!!mark(A.stock) && mark(A.stock) === mark(A.lot) && !/\b(salt|oil|candy|rice)\b/i.test(words.replace(mark(A.stock), "")),
      "the book's mark stands by each title, named by its shape, and no product word is written: " + J([mark(A.stock), words]));
    /* 2 */
    ok(A.read[2][2] === "6 units" && A.read[3][2] === "27 Oct", "the book with nothing free comes first, ahead of the least cover: " + J(A.read.slice(2)));
    /* 3 */
    ok(J(A.read.slice(2)) === J([["stock", t(A.stock.querySelector(".salt-glance__label")), "6 units", "0 unit free · 0 d"],
      ["lot", t(A.lot.querySelector(".salt-glance__label")), "27 Oct", "Nothing on the way yet"]]) && /^Stock cover/.test(A.read[2][1]) && /^Next lot/.test(A.read[3][1])
      && A.stock.title === "As measured on 20 Oct",
    "nothing free reads 0 d; a day with nothing coming says Nothing on the way yet; the day measured is the title: " + J(A.read.slice(2)) + " " + A.stock.title);
    /* 4: read once, whatever redraws */
    const n0 = A.p.wire.filter((x) => x.startsWith("/all/maker/stock")).length;
    byAct(A.p.d, "nav.orders").click(); await A.p.work.quiet(); byAct(A.p.d, "nav.needs").click(); await A.p.work.quiet();
    ok(n0 === 1 && A.p.wire.filter((x) => x.startsWith("/all/maker/stock")).length === 1, "the stock is read once a page open: " + n0);
    ok(!/restock/i.test(words), "and never the word the plan bans");
  } finally { A.p.w.close(); }
  const B = await page(pageWork, { ok: true, today: "2026-10-20", books: { salt: book(14.89, 13.39, 2.6, 8), oil: book(45, 45, 15.1, 0), rice: book(9, 9, null, 0) },
    by: { salt: "2026-10-25" } });
  try {
    ok(J(B.read.slice(2)) === J([["stock", t(B.stock.querySelector(".salt-glance__label")), "14.89 units", "13.39 units free · 2.6 d"],
      ["lot", t(B.lot.querySelector(".salt-glance__label")), "25 Oct", "8 units expected"]]),
    "the least cover is shown, a book with no cover figure last; its shelf, what is free and its days, the day expected and the units coming: " + J(B.read.slice(2)));
    const raw = B.stock.querySelector(".salt-glance__note").textContent;
    ok(raw.endsWith("2.6 d") && !/2\.6 d/.test(raw), "the days never break from their figure on a narrow tile (a no-break space): " + J(raw));
  } finally { B.p.w.close(); }
  const C = await page(pageWork, { ok: true, today: "2026-10-20", books: { rice: book(9, 9, null, 0) }, by: {} });
  try {
    ok(J(C.read.slice(2).map((r) => r.slice(2))) === J([["9 units", "9 units free · over 4 wk"], ["–", "Nothing on the way"]]),
      "stock with no cover figure reads over 4 wk; no day and nothing coming is a dash and Nothing on the way: " + J(C.read.slice(2)));
  } finally { C.p.w.close(); }
  const D = await page(pageWork, { refuse: "The Desk is not updated yet." });
  try {
    ok(J(D.read.slice(2).map((r) => r.slice(2))) === J([["–", "Could not be read"], ["–", "Could not be read"]]) && D.read[0][0] === "ready",
      "a failed read draws a dash and says so, and the glance still stands: " + J(D.read));
  } finally { D.p.w.close(); }
}
