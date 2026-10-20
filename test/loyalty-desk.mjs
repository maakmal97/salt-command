/* test/loyalty-desk.mjs: THE LOYALTY UNIT ON THE DESK, P7 (his rule of 20 Oct 2026, docs/plan-loyalty-unit.html): what counts for a customer, in
 * his words, and each customer's walk beside what they held. On the desk's own window; each check red under its own mutation
 * (test/loyalty-desk.mutations.json):
 *   1  a customer's rule is the loyalty unit's, an associate's and oil's are as they were
 *   2  the Customer rewards card says it in its heading and its note, and lists each customer's walk, "6 of 20" for an invented one, paused
 *      when they are, an associate never
 *   3  before the switch (no loyal scheme) a customer's rule is what it was */
const t = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const RULE = "a unit at cost per 20 units at their price, paused by a late payment or a write-off";

export async function run({ ok }) {
  const { readBook } = await import("../tools/book.mjs");
  const desk = await readBook();
  try {
    const w = desk.w;
    /* 1 */
    const salt = w.eval("rewardRuleTxt('salt')"), assoc = w.eval("rewardRuleTxt('salt','associate')"), oil = w.eval("PROD='oil';recompute();rewardRuleTxt('oil')");
    w.eval("PROD='salt';recompute();");
    ok(salt === RULE && /^a free unit per 10 units/.test(assoc) && oil === "no reward on this book", "a customer's rule is the loyalty unit's: " + JSON.stringify([salt, assoc, oil]));
    /* 2: an invented customer with 6 units at their price, paid today; another paused by goods out ten days and unpaid */
    const day = w.eval("TODAY.toISOString().slice(0,10)"), back = w.eval("new Date(TODAY.getTime()-10*864e5).toISOString().slice(0,10)"),
      back2 = w.eval("new Date(TODAY.getTime()-11*864e5).toISOString().slice(0,10)");
    /* the switch taken a month back in this window, so a paid order before the late one counts and the pause keeps it */
    w.eval("REWARD.stated.salt.loyal.since=new Date(TODAY.getTime()-30*864e5).toISOString().slice(0,10);");
    const row = (rid, c, q, more) => JSON.stringify({ rid, customer: c, product: "salt", date: day, qty: q, total: 100 * q, cost: 58 * q, listRM: 100 * q, listQty: q,
      cash: 100 * q, paidOn: day, deliveredQty: q, deliveredOn: day, note: "test", ...more });
    w.eval("roster.push('CQ1-ZUL','CQ2-ZUL');sales.push(" + row("s99901", "CQ1-ZUL", 6) + ");sales.push(" + row("s99902", "CQ2-ZUL", 2, { date: back2, deliveredOn: back2, paidOn: back2 }) + ");"
      + "sales.push(" + row("s99903", "CQ2-ZUL", 1, { date: back, deliveredOn: back, cash: 0, paidOn: undefined }) + ");BASE_SALES.length=0;sales.forEach(function(s){BASE_SALES.push(JSON.parse(JSON.stringify(s)));});recompute();");
    const cr = JSON.parse(w.eval("JSON.stringify(customerRewards())"));
    const html = w.eval("tabConcentration()"), i = html.indexOf("Customer rewards"), card = t(html.slice(i, html.indexOf("</table>", i) + 600));
    const mine = cr.find((r) => r.id === "CQ1-ZUL"), late = cr.find((r) => r.id === "CQ2-ZUL"), A = JSON.parse(w.eval("JSON.stringify(associateIds())"));
    ok(mine && mine.loyal && mine.loyal.units === 6 && late && late.loyal && late.loyal.paused === true && !cr.some((r) => A.includes(r.id))
      && card.includes("Customer rewards " + RULE) && !card.includes(RULE + ", whole ledger") && card.includes("Loyalty") 
      && /CQ1-ZUL(?:(?!C[A-Z][0-9]-).)*6 of 20/.test(card) && /CQ2-ZUL(?:(?!C[A-Z][0-9]-).)*paused at 2 of 20/.test(card) && card.includes("Their reward is the loyalty unit: " + RULE),
      "the card says the rule and lists each customer's walk: " + JSON.stringify([mine && mine.loyal, late && late.loyal && late.loyal.paused, card.slice(0, 300)]));
    /* 3 */
    const before = w.eval("var keep=REWARD.stated.salt.loyal;delete REWARD.stated.salt.loyal;var r=rewardRuleTxt('salt');REWARD.stated.salt.loyal=keep;r");
    ok(/^held as it stood on /.test(before), "before the switch a customer's rule is what it was: " + before);
  } finally { desk.dom.window.close(); }
}
