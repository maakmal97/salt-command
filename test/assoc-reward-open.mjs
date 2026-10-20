/* test/assoc-reward-open.mjs: THE ASSOCIATE REWARD, P2: THE OPENINGS (his answer to Ask 3, 20 Oct 2026). Each check red under its own
 * mutation (test/assoc-reward-open.mutations.json):
 *   1  on the real book, openings taken now leave every associate's held and the whole % of their next unit as they were (the engine)
 *   2  and the Desk's own Network figures (left, and the whole % the card reads) are the same either side of the switch, in the master
 *   3  the committed REWARD_OPEN states every associate with a row the switch read, each {earned, share, upTo, on} in shape
 *   4  an opening is the count's earned (never what they hold) and a share never under nought; a row Pending then is listed in pend
 *   5  an associate with no opening shows no figure on the Desk (no unit, no next), never nought
 *   6  the rule says the step: times units' landed cost at today's lot
 *   7  the extract carries REWARD_OPEN to the mirror, so every Worker road reads the same openings */
import { readBookFile } from "../tools/booksync.mjs";
import { readBook } from "../tools/book.mjs";
import { openings, associatesOf } from "../tools/reward-open.mjs";
import E from "../engine/position.mjs";

export async function run({ ok }) {
  const book = readBookFile();
  const desk = await readBook(), w = desk.w;
  try {
    const stated = desk.ledger.REWARD.stated, since = stated.salt.associate.since, extracted = JSON.stringify(desk.ledger.REWARD_OPEN || null);
    /* 1 */
    const { open, table } = openings(book, stated, since);
    const moved = table.filter((r) => r.heldBefore !== r.heldAfter || r.pctBefore !== r.pctAfter);
    const codes = JSON.stringify(table.map((r) => r.code).sort()) === JSON.stringify(Object.keys(book.REWARD_OPEN || {}).sort());
    ok(table.length >= 5 && codes && !moved.length, "openings taken now cover every associate and move no one's held or whole %: "
      + JSON.stringify(moved.length ? moved : [table.length, codes]));
    /* 2: the window's openings are the ones taken now, so the comparison holds on whatever the book is */
    w.eval("Object.keys(REWARD_OPEN).forEach(k=>delete REWARD_OPEN[k]);Object.assign(REWARD_OPEN," + JSON.stringify(open) + ")");
    const read = () => JSON.parse(w.eval("PROD='salt';recompute();JSON.stringify(networkStats().map(r=>({id:r.id,left:+((r.earned||0)-rebateApplied(r.id)).toFixed(2),"
      + "next:r.unit&&r.toNext!=null?Math.round(Math.max(0,Math.min(1,1-r.toNext/r.unit))*100):null})))"));
    const after = read();
    w.eval("delete REWARD.stated.salt.associate.since");
    const before = read();
    w.eval("REWARD.stated.salt.associate.since=" + JSON.stringify(since) + ";PROD='salt';recompute();");
    const diff = after.filter((a) => JSON.stringify(a) !== JSON.stringify(before.find((b) => b.id === a.id)));
    ok(after.length >= 5 && after.every((a) => a.next != null) && !diff.length,
      "the Desk's Network figures are the same either side of the switch: " + JSON.stringify(diff.length ? { diff, before } : after.length));
    /* 3 */
    const R = book.REWARD_OPEN || {}, upTo = (Object.values(R)[0] || {}).upTo;
    const read0 = associatesOf(book, { stated: { ...stated, salt: { ...stated.salt, associate: { ...stated.salt.associate, since: undefined } } } })
      .filter((c) => (book.sales || []).some((s) => E.ownerCode(s.customer) === c && E.rewardRid(s.rid) <= E.rewardRid(upTo)));
    const shapeOk = Object.values(R).every((o) => Number.isInteger(o.earned) && o.earned >= 0 && o.share >= 0 && o.share <= 1
      && /^s\d+$/.test(o.upTo) && o.on === since);
    ok(read0.length >= 5 && read0.every((c) => R[c]) && shapeOk, "REWARD_OPEN states every associate the switch read, in shape: "
      + JSON.stringify(read0.filter((c) => !R[c])));
    /* 4: an associate who has taken more than the count earned opens on the count's earned, and a row Pending then is listed */
    const fx = { sales: [{ rid: "s9", customer: "AX1-ZED", product: "salt", date: "2026-10-01", qty: 10, total: 1000, cost: 500, cash: 1000, deliveredQty: 10 },
      { rid: "s10", customer: "AX1-ZED", product: "salt", date: "2026-10-02", qty: 2, total: 100, cost: 100, cash: 100, settledRM: 100, rebate: true, rebateKg: 2, goodwill: true, deliveredQty: 2 },
      { rid: "s11", customer: "AX1-ZED-R", product: "salt", date: "2026-10-03", qty: 1, total: 100, cash: 0, deliveredQty: 0 }],
      purchases: [], state: { REWARD: { stated: { salt: { margin: 500, associate: { margin: 200, r3Hurdle: 1.2, times: 10 } } } },
        associates: ["AX1-ZED"], INTRODUCTIONS: [], PEOPLE: { departed: [] }, PRODUCTS: { salt: {} }, PROD_OPENING: { salt: { qty: 0, costPerKg: null } } } };
    const o = E.rewardOpening(fx, "AX1-ZED", "2026-10-20"), neg = E.rewardOpening({ ...fx, sales: [{ ...fx.sales[0], total: 100, cash: 100 }] }, "AX1-ZED", "2026-10-20");
    ok(o.earned === 2 && o.share === 0.5 && o.upTo === "s11" && JSON.stringify(o.pend) === '["s11"]' && neg.share === 0 && neg.earned === 0,
      "an opening is the count's earned and its share, never under nought, with the row Pending then: " + JSON.stringify([o, neg]));
    /* 5 */
    const code = Object.keys(open)[0];
    w.eval("delete REWARD_OPEN[" + JSON.stringify(code) + "];PROD='salt';recompute();");
    const gone = JSON.parse(w.eval("JSON.stringify(networkStats().find(r=>r.id===" + JSON.stringify(code) + "))"));
    ok(gone && gone.unit === null && gone.toNext === null && gone.earned === null, "an associate with no opening shows no figure, never nought: " + JSON.stringify(gone && [gone.unit, gone.earned]));
    /* 6 */
    const step = E.rewardStep(book.purchases.filter((p) => (p.product || "salt") === "salt"), null, stated.salt.associate.times).step;
    const txt = w.eval("rewardRuleTxt('salt','associate')");
    ok(txt.includes(stated.salt.associate.times + " units’ landed cost") && txt.includes(w.eval("fmt0(" + step + ")")),
      "the rule says the step at today's lot: " + txt);
    /* 7 */
    ok(extracted === JSON.stringify(book.REWARD_OPEN) && Object.keys(book.REWARD_OPEN || {}).length >= 5,
      "the extract carries REWARD_OPEN to the mirror: " + extracted.slice(0, 60));
  } finally { desk.dom.window.close(); }
}
