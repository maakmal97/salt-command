/* test/glance-stock-snapshot.mjs: STOCK ON SALT ADMIN'S GLANCE, P1, THE SNAPSHOT (20 Oct 2026; docs/plan-admin-glance-stock.html, canvas V62).
 * What is proved here, each check red under its own mutation (test/glance-stock-snapshot.mutations.json):
 *   1  the book read carries STOCK: every book of PROD_IDS with its shelf, free, commit, days of cover and units expected, the desk's own
 *      figures (free the shelf less what is owed out), the desk's day, the version, and the desk put back on its book
 *   2  units expected: a pending lot counts whole, a part-received lot its balance, a cancelled or written-off lot nothing
 *   3  the seed hash leaves STOCK out, so a day's drift seeds nothing, and the seed still writes STOCK into state */
import { readBook, stockSnapshot } from "../tools/book.mjs";
import { seedHash, buildSeed } from "../tools/d1.mjs";

export async function run({ ok }) {
  const { w, ledger, version } = await readBook();
  try {
    /* 1 */
    const S = ledger.STOCK, ids = w.eval("PROD_IDS.slice()"), left = w.eval("PROD");
    w.eval("setProd('salt');");
    const salt = S && S.books && S.books.salt, two = (n) => +(+n).toFixed(2);
    ok(!!salt && ids.every((p) => S.books[p] && ["shelf", "free", "commit", "transit"].every((k) => typeof S.books[p][k] === "number")
      && (S.books[p].coverDays === null || typeof S.books[p].coverDays === "number")) && Object.keys(S.books).length === ids.length
      && salt.shelf === two(w.eval("currentStock")) && salt.free === two(w.eval("currentStock-defUnits")) && salt.commit === two(w.eval("forecast().commitUnits"))
      && salt.coverDays === w.eval("restockFor('salt').coverDays") && S.today === w.eval("TODAY.toISOString().slice(0,10)") && S.v === version
      && left === "salt",
    "the book read carries STOCK, every book with the desk's own shelf, free, commit and cover, its day and version, the desk put back: " + JSON.stringify(S));
    ok(salt.free !== salt.shelf || w.eval("defUnits") === 0, "free is the shelf less what is owed out, not the shelf: " + JSON.stringify(salt));
    /* 2 */
    const before = stockSnapshot(w).books.salt.transit;
    w.eval("purchases.push({rid:'zGS1',supplier:'SZ9-GLS',date:'2099-12-28',qty:10,total:100,pending:true},"
      + "{rid:'zGS2',supplier:'SZ9-GLS',date:'2099-12-29',qty:8,total:80,cash:80,status:'paid',receivedQty:3,inTransit:true},"
      + "{rid:'zGS3',supplier:'SZ9-GLS',date:'2099-12-30',qty:5,total:50,cancelled:true,receivedQty:0,inTransit:true},"
      + "{rid:'zGS4',supplier:'SZ9-GLS',date:'2099-12-31',qty:4,total:40,defaulted:true,receivedQty:0,inTransit:true});recompute();");
    const after = stockSnapshot(w).books.salt.transit;
    w.eval("for(var i=purchases.length-1;i>=0;i--){if(/^zGS/.test(purchases[i].rid))purchases.splice(i,1);}recompute();");
    ok(two(after - before) === 15, "units expected: a pending lot whole (10), a part-received lot its balance (5), a cancelled or written-off lot nothing: " + [before, after]);
    /* 3 */
    const body = { v: version, stamped: "x", ledger: { sales: [], PRICING: { a: 1 }, STOCK: S } };
    const drift = { ...body, ledger: { ...body.ledger, STOCK: { ...S, today: "2099-01-01", books: { ...S.books, salt: { ...salt, coverDays: 99 } } } } };
    const moved = { ...body, ledger: { ...body.ledger, PRICING: { a: 2 } } };
    ok(seedHash(body) === seedHash(drift) && seedHash(body) !== seedHash(moved),
      "the seed hash leaves STOCK out, so a day's drift seeds nothing, while any other key still moves it");
    ok(/INSERT INTO state \(key,doc\) VALUES \('STOCK',/.test(buildSeed(body).sql), "and the seed still writes STOCK into the mirror's state");
  } finally { w.close(); }
}
