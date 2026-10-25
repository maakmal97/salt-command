/* test/admin-cust-reads.mjs: SALT ADMIN CUSTOMERS, P4, THE TWO READINGS BY CODE (26 Oct 2026; his yes to Ask B). An account's card on Customers reads This
 * customer and the associate reward by the account's roster code, where the order card reads them by its row's key. Each check is red under its own
 * mutation (test/admin-cust-reads.mutations.json):
 *   1  This customer by code is the reading by key, less what only an order knows: the same suggestion, rates, cadence, meter and unit cost
 *   2  the associate reward by code is the walk's: an associate's step and progress, a customer none
 *   3  only a roster code names an account: a bucket (-R), a username, a code off the roster or in lower case is refused
 *   4  both readings answer only behind both locks and only to a GET: no owner, 403 at the Counter; no bridge key, 404 at the Desk; a POST 405; with the
 *      key, the reading; a path that is no code is not a route at the Desk */
const j = (x) => JSON.stringify(x);

export async function run({ ok }) {
  const { readBook } = await import("../tools/book.mjs"), M = await import("../src/maker-inputs.js");
  const desk = await readBook(), L = JSON.parse(j(desk.ledger));
  desk.dom.window.close();
  const snap = L.PRICING.byProduct.salt;
  snap.lift = { ...(snap.lift || {}), "CQ1-ZUL": 0 };
  snap.suggest = { ...(snap.suggest || {}), "CQ1-ZUL": { pct: 0.1, why: "paid late" } };
  snap.cards = { ...(snap.cards || {}), "CQ1-ZUL": snap.cards[Object.keys(snap.cards)[0]] };
  L.roster = L.roster.concat(["CQ1-ZUL"]);
  const mk = (c, rid, date, q) => ({ rid, customer: c, product: "salt", date, qty: q, total: 100 * q, cost: 58 * q, listRM: 100 * q, listQty: q,
    cash: 100 * q, paidOn: date, deliveredQty: q, deliveredOn: date, note: "test" });
  const rows = [["2031-01-01", 5], ["2031-01-06", 5], ["2031-01-11", 4], ["2031-01-16", 5]].map(([d, q], i) => mk("CQ1-ZUL", "s9" + (900 + i), d, q));
  const sales = L.sales.concat(rows);
  L.REWARD.stated.salt.loyal = { every: 20, since: "2031-01-01" };
  const book = { version: L.PRICING.v, state: { ...L, sales }, sales, purchases: L.purchases, pricing: L.PRICING };
  /* 1 */
  const byKey = M.makerCustomerReading(book, "CQ1-ZUL|2031-01-16|500", "2031-01-19"), byCode = M.makerCustomerReadingOf(book, "CQ1-ZUL", "2031-01-19");
  const same = (r) => j([r.customer, r.code, r.rates, r.unitNow, r.highest, r.cadence, r.dueIn, r.cost, r.held, r.suggest, r.gain, r.pair, r.loyal.units, r.loyal.every, r.loyal.paused]);
  ok(byCode.customer === true && byCode.code === "CQ1-ZUL" && same(byCode) === same(byKey) && byCode.rates.length === 4 && byCode.suggest.pct === 0.1,
    "This customer by code is the reading by key: " + same(byCode));
  /* 2 */
  const assoc = L.associates[0], aw = M.makerRewardReadingOf(book, assoc), cw = M.makerRewardReadingOf(book, "CQ1-ZUL");
  ok(aw.associate === true && aw.step > 0 && typeof aw.progress === "number" && aw.unit === null && cw.associate === false && M.makerCustomerReadingOf(book, assoc, "2031-01-19").customer === false,
    "the reward by code is the walk's for an associate, none for a customer; an associate is no customer here: " + j([assoc, aw.step, aw.progress, cw]));
  /* 3 */
  const refused = [assoc + "-R", "abcd-efgh", "ZZ9-NONE", "cq1-zul", "", null].map((c) => [M.makerCustomerReadingOf(book, c, "2031-01-19").error, M.makerRewardReadingOf(book, c).error]);
  ok(refused.every((x) => typeof x[0] === "string" && typeof x[1] === "string") && refused[0][0] === "Name the account by its code." && refused[2][0] === "Choose a party on the roster.",
    "only a roster code names an account: a bucket, a username, a code off the roster, lower case and nothing are refused: " + j(refused));
  /* 4 */
  const { handleMaker } = await import("../stmt/maker.js"), deskW = (await import("../src/worker.js")).default;
  const KEY = "k".repeat(40), env = { COUNTER_MAKER_KEY: KEY };
  const mirror = { prepare(q) {
    const all = async (b) => /FROM entry/.test(q) ? { results: (b === "sales" ? sales : b === "purchases" ? L.purchases : []).map((x) => ({ doc: j(x) })) }
      : /FROM state/.test(q) ? { results: Object.entries(L).map(([key, v]) => ({ key, doc: j(v) })) } : { results: [] };
    const first = async () => (/FROM snapshot/.test(q) ? { v: L.PRICING.v, stamped: null } : null);
    return { bind: (...a) => ({ all: () => all(a[0]), first, run: async () => ({ meta: { changes: 0 } }) }), all: () => all(null), first, run: async () => ({ meta: { changes: 0 } }) };
  } };
  const desk1 = (path, init = {}, e = env) => deskW.fetch(new Request("https://desk.test" + path, init), e, { waitUntil() {} });
  const got = [];
  for (const [kind, code] of [["customer-of", "CQ1-ZUL"], ["reward-of", assoc]]) {
    const r403 = await handleMaker(new Request("https://counter.test/all/maker/" + kind + "/" + code), {}, "/all/maker/" + kind + "/" + code, null);
    const r404 = await desk1("/_internal/maker/" + kind + "/" + code);
    const r405 = await desk1("/_internal/maker/" + kind + "/" + code, { method: "POST", headers: { "X-Counter-Maker-Key": KEY } });
    const r200 = await desk1("/_internal/maker/" + kind + "/" + code, { headers: { "X-Counter-Maker-Key": KEY } }, { ...env, SALT_LEDGER: mirror });
    const body = r200.status === 200 ? await r200.json() : null;
    got.push([kind, r403.status, r404.status, r405.status, r200.status, body && (kind === "customer-of" ? body.reading.code : body.reading.associate)]);
  }
  const user = await desk1("/_internal/maker/customer-of/abcd-efgh", { headers: { "X-Counter-Maker-Key": KEY } }, { ...env, SALT_LEDGER: mirror });
  ok(j(got) === j([["customer-of", 403, 404, 405, 200, "CQ1-ZUL"], ["reward-of", 403, 404, 405, 200, true]]) && user.status === 404,
    "both readings answer only behind both locks and only to a GET, and a username is no route at the Desk: " + j(got) + " " + user.status);
}
