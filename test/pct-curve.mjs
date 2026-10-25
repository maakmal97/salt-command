/* test/pct-curve.mjs: his decisions of 22 Oct 2026. THEIR % RUNS ON HIS CURVE, ON EVERY BOOK, AND SALT ADMIN SHOWS IT LIVE.
   1. Salt's ends: -30% is 2.00 times the Floor at 0.5 unit and 1.20 at 12.5, +30% is 3.00 and 1.45, the Set Price 2.50 and 1.33; each end keeps
      the Set Price's shape, a % is an equal share of the way at every size (every 5% step the same size of step), flat above 12.5, and a rule
      with no `ends` keeps the multiple times (1 + %).
   2. The walk on that curve: at half a unit (nothing smaller walked) -30% is the Floor times 2 down to the RM 5; no price under the Floor or over
      the Ceiling; 0% is the Set Price board to the ringgit; quoteGrid and quoteAt walk one path.
   3. Oil, candy and rice take a % (`pct`): his board at 0%, -30% 80% of it at the smallest rung and 90% at the largest, +30% 120% and 109%, down to
      the book's step, held between the Floor and the Ceiling, the rate never rising with size; quoteGrid equals quoteAt; a partner the Floor.
   4. The gates follow: pctBook names all four books; the catalog offers every book; Add ID and the tier-set road take a % on oil; the price list
      quotes a held % on a board as a card and nought as the board.
   5. The live preview: makerDriftPreview reads now at their held % and at the typed one, both the engine's quoteAt on the snapshot, with the
      Floor; refuses a partner, a supplier, a bucket, a book with no % and a figure out of range; the Desk route takes only a whole % in steps
      of 5; the Counter relays it under /all only; the Salt Admin form takes a whole % in steps of 5, draws the table off the read, drops a late
      reply, and sends the fraction.
   Mutations: test/pct-curve.mutations.json. */
import RULES_MOD from "../engine/rules.mjs";
import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { contentKey, wrapKey } from "../tools/stmt-crypto.mjs";
import { byAct, enter } from "./maker-act.mjs";

export async function run({ ok }) {
  const check = ok || ((c, m) => { if (!c) throw new Error(m); });
  const E = (await import("../engine/pricing.mjs")).default;
  const MI = await import("../src/maker-inputs.js");
  const PL = await import("../tools/pricelist.mjs");
  const { handleMaker } = await import("../stmt/maker.js");
  const { landingPage } = await import("../stmt/page.js");
  const TR = RULES_MOD.TIER_RULE, salt = TR.salt;
  const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
  const PCTS = [-0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3];

  /* 1. the curve */
  const M = (q, k) => E.driftMultiple(q, salt, k);
  check(near(M(0.5, -0.3), 2) && near(M(0.5, 0), 2.5) && near(M(0.5, 0.3), 3) && near(M(12.5, -0.3), 1.2) && near(M(12.5, 0), 1.33)
    && near(M(12.5, 0.3), 1.45) && near(M(25, -0.3), 1.2) && near(M(25, 0.3), 1.45) && near(M(0.25, -0.3), 2),
  "his ends: -30% 2.00 at 0.5 and 1.20 at 12.5, +30% 3.00 and 1.45, the Set Price between, flat beyond the first and last points: "
    + JSON.stringify([0.5, 12.5, 25].map((q) => [M(q, -0.3), M(q, 0), M(q, 0.3)])));
  const steps = [1, 3, 6.25].every((q) => { const d = PCTS.slice(1).map((k, i) => M(q, k) - M(q, PCTS[i]));
    return d.slice(0, 6).every((x) => near(x, d[0], 1e-9)) && d.slice(6).every((x) => near(x, d[6], 1e-9)) && d[0] > 0 && d[6] > 0; });
  check(steps, "every 5% step is an equal share of the way from the Set Price to its end, below and above, at every size");
  const s6 = (salt.points[2][1] - 1.33) / (2.5 - 1.33);
  check(near(M(6.25, -0.3), 1.2 + s6 * 0.8, 1e-9) && near(M(6.25, 0.3), 1.45 + s6 * 1.55, 1e-9),
    "each end keeps the Set Price's shape: at 6.25 the end sits the same share between its two multiples as the Set Price sits between 2.5 and 1.33");
  const noEnds = { ...salt }; delete noEnds.ends;
  check(near(E.driftMultiple(6.25, noEnds, -0.2), 1.67 * 0.8) && near(E.driftMultiple(1, noEnds, 0.3), 2 * 1.3),
    "a rule with no ends keeps the multiple times (1 + %)");

  /* 2. the walk on salt */
  const P = { LADDER: RULES_MOD.LADDER, floorTo: RULES_MOD.RULES.floorTo, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, tierRule: salt };
  const K = { eff: 58, effEx: 58, landed: 58 }, down5 = (v) => Math.floor(v / 5 + 1e-9) * 5;
  const F = (q) => E.floorTotal(q, K, P), Q = (q, k) => E.quoteAt(q, K, P, k);
  check(Q(0.5, -0.3) === Math.max(F(0.5), down5(F(0.5) * 2)) && Q(0.5, 0.3) === Math.min(down5(3 * F(0.5)), down5(F(0.5) * 3)),
    "half a unit at -30% is the Floor times 2 and at +30% times 3, down to the RM 5: " + [F(0.5), Q(0.5, -0.3), Q(0.5, 0.3)].join(", "));
  const qs = E.gridSizes(E.gridOf(salt));
  const banded = PCTS.every((k) => qs.every((q) => { const p = Q(q, k); return p >= F(q) - 0.009 && p <= 3 * F(q) + 0.009; }));
  check(banded, "on the curve no price is under the Floor or over the Ceiling, at every % and every quarter");
  const set = E.driftWalk(E.walkSizes(salt, qs), K, P, 0);
  check(qs.every((q, i) => Q(q, 0) === set[i].set), "0% is the Set Price board to the ringgit");
  check(PCTS.every((k) => { const g = E.quoteGrid(K, P, k); return g && g.p.every((p, i) => p === Q(qs[i], k)); }),
    "quoteGrid and quoteAt walk one path at every % on the curve");
  check(Q(12.5, -0.3) < Q(12.5, 0) && Q(12.5, -0.3) >= down5(F(12.5) * 1.2),
    "12.5 units at -30% comes under the Set Price and no lower than his 1.20 multiple (the margin lift may hold it higher)");

  /* 3. the stated boards */
  const boardP = (b, cost) => ({ P: { LADDER: { ...RULES_MOD.LADDER, ...(RULES_MOD.LADDER_BY[b] || {}) }, floorTo: RULES_MOD.RULES.floorTo, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, tierRule: TR[b] },
    K: { eff: cost, effEx: cost, landed: cost } });
  for (const [b, cost] of [["oil", 7], ["candy", 40], ["rice", 3]]) {
    const R = TR[b], { P: Pb, K: Kb } = boardP(b, cost), to = Pb.LADDER.round.to, dn = (v) => Math.floor(v / to + 1e-9) * to;
    const r0 = R.rungs[0], rN = R.rungs[R.rungs.length - 1], Qb = (q, k) => E.quoteAt(q, Kb, Pb, k), Fb = (q) => E.floorTotal(q, Kb, Pb);
    check(E.pctBook(R) && near(E.shareAt(r0, R, -0.3), 0.8) && near(E.shareAt(rN, R, -0.3), 0.9) && near(E.shareAt(r0, R, 0.3), 1.2)
      && near(E.shareAt(rN, R, 0.3), 1.09) && near(E.shareAt(r0, R, -0.15), 0.9) && E.shareAt(r0, R, 0) === 1,
    b + " takes a %: his board at 0%, -30% 80% of it at the smallest rung and 90% at the largest, +30% 120% and 109%, half way at -15%");
    const board = Qb(r0, 0);
    check(Qb(r0, -0.3) === Math.max(Math.ceil(Fb(r0) / to - 1e-9) * to, dn(board * 0.8)) && Qb(r0, 0.3) === Math.min(dn(board * 1.2), dn(3 * Fb(r0))),
      b + " at its smallest rung: -30% is 80% of the board and +30% 120%, down to its step, between the Floor and the Ceiling: " + [Fb(r0), board, Qb(r0, -0.3), Qb(r0, 0.3)].join(", "));
    const gs = E.gridSizes(E.gridOf(R));
    check(PCTS.every((k) => { const g = E.quoteGrid(Kb, Pb, k); return g && g.p.every((p, i) => p === Qb(gs[i], k)); }),
      b + ": quoteGrid and quoteAt walk one path at every %");
    check(PCTS.every((k) => gs.every((q, i) => { const p = Qb(q, k); return p >= Fb(q) - 0.009 && p <= 3 * Fb(q) + 0.009 && (!i || p / q <= Qb(gs[i - 1], k) / gs[i - 1] + 1e-9); })),
      b + ": never under the Floor or over the Ceiling, and the rate never rises with size, at every %");
    check(gs.every((q) => Qb(q, "partner") === Fb(q)), b + ": a partner pays the Floor whatever the %");
  }
  { const { P: Ph, K: Kh } = boardP("oil", 11), Fh = E.floorTotal(10, Kh, Ph);
    check(E.quoteAt(10, Kh, Ph, 0) === 130 && E.quoteAt(10, Kh, Ph, -0.3) === Math.ceil(Fh / 10 - 1e-9) * 10 && Fh > 104,
      "on oil at RM 11 a unit, -30% of the RM 130 board (104) is under the Floor, so it is held at the Floor up to its ten: " + [Fh, E.quoteAt(10, Kh, Ph, -0.3)].join(", ")); }
  check(!E.pctBook({ fixed: { 1: 5 }, rungs: [1] }) && !E.pctBook(null) && E.pctBook(salt),
    "a stated board without `pct` takes no %, and a Set Price always does");

  /* 4 and 5: the Worker's road, on a mirror */
  const costIn = (c) => ({ prod: "x", lockOn: false, lockState: { state: "none", lock: null }, lockBase: null, over: { cost: null, shrink: null },
    lot: { qty: 10, total: c * 10, rate: c, date: "2026-10-01" }, quoteRate: c, repl: c, freightRate: 0, meanLot: 10, leak: null,
    costBasis: { freightPerTrip: { rm: 0 }, txnPerDelivery: { rm: 0 }, deliveredShare: { v: 0 } }, attrib: 1, shrinkRate: 0, avgDel: { n: 0, mean: 0 },
    costRule: { kind: "latestCogs" }, latest: { quote: c * 10, freight: 0, units: 10, rate: c } });
  const mirror = () => {
    const pol = (b) => ({ LADDER: { ...RULES_MOD.LADDER, ...(RULES_MOD.LADDER_BY[b] || {}) }, floorTo: RULES_MOD.RULES.floorTo, minPerUnit: 0, timePerOrder: 0, lotFloor: {}, tierRule: TR[b] });
    return { version: 9, purchases: [],
      sales: [{ rid: "s1", customer: "CX1-ZED", product: "salt", date: "2026-10-01", qty: 6.25, total: 600 }, { rid: "s2", customer: "CX1-ZED", product: "salt", date: "2026-10-05", qty: 6.25, total: 600 },
        { rid: "s3", customer: "CX1-ZED", product: "salt", date: "2026-10-09", qty: 2, total: 200 }],
      state: { PRODUCTS: { salt: { name: "Salt" }, oil: { name: "Oil" } }, roster: ["CX1-ZED", "CX2-ZED", "AX1-ZED", "AX1-ZED-R", "SP1-ZED", "CP1-ZED"],
        TIER_OF: { "CX1-ZED": { salt: -0.1 } }, partners: ["CP1-ZED"], PROD_OPENING: { salt: { qty: 0, costPerKg: null }, oil: { qty: 0, costPerKg: null } }, PEOPLE: { departed: [] } },
      pricing: { byProduct: {
        salt: { stockCost: 58, rungs: [1, 6.25, 12.5], lift: { "CX1-ZED": -0.1, "CX2-ZED": 0, "CP1-ZED": "partner" }, suggest: {}, inputs: { cost: costIn(58), policy: pol("salt") } },
        oil: { stockCost: 7, rungs: [10, 30, 50], lift: { "CX1-ZED": 0, "CX2-ZED": -0.3 }, inputs: { cost: costIn(7), policy: pol("oil") } } } } };
  };
  const book = mirror(), cat = MI.makerInputCatalog(book);
  check(cat.products.find((x) => x.product === "oil").drift && cat.products.find((x) => x.product === "oil").driftPresets.length === 11
    && cat.driftCards.some((c) => c.product === "oil"), "the catalog offers Their % and its presets on oil, a stated board carrying pct");
  const at = "2026-10-22T02:00:00.000Z";
  check(!MI.makerTierSet({ at, code: "CX2-ZED", product: "oil", tier: -0.15, unit: "pct" }, book).error,
    "the tier-set road takes a % on oil: " + JSON.stringify(MI.makerTierSet({ at, code: "CX2-ZED", product: "oil", tier: -0.15, unit: "pct" }, book).error));
  const Kc = E.costStack(book.pricing.byProduct.salt.inputs.cost), Pc = book.pricing.byProduct.salt.inputs.policy;
  const pv = MI.makerDriftPreview(book, "CX1-ZED", "salt", -0.3);
  check(!pv.error && pv.held === -0.1 && pv.rows.length >= 3 && pv.rows.every((r) => r.now === E.quoteAt(r.q, Kc, Pc, -0.1) && r.at === E.quoteAt(r.q, Kc, Pc, -0.3)
    && r.floor === E.floorTotal(r.q, Kc, Pc)) && pv.rows.some((r) => r.usual && r.q === 6.25),
  "the preview reads now at their held % and at the typed one, the engine's own quoteAt, beside the Floor, at the board's sizes and their usual: " + JSON.stringify(pv));
  const atCard = E.cardAt({ byProduct: { salt: { ...book.pricing.byProduct.salt, cards: { "CX1-ZED": [] }, ladder: [] } } }, "CX1-ZED", "salt", 6.25).card;
  check(pv.rows.find((r) => r.q === 6.25).now === atCard, "now is what the snapshot already quotes them at that size (cardAt): " + atCard);
  const oilPv = MI.makerDriftPreview(book, "CX2-ZED", "oil", 0);
  check(!oilPv.error && oilPv.held === -0.3 && oilPv.rows.every((r) => r.at <= Math.max(r.now, r.at) && r.now <= r.at),
    "on oil the preview reads their -30% now against the board at 0%");
  check(!!MI.makerDriftPreview(book, "CP1-ZED", "salt", 0.1).error && !!MI.makerDriftPreview(book, "SP1-ZED", "salt", 0.1).error
    && !!MI.makerDriftPreview(book, "AX1-ZED-R", "salt", 0.1).error && !!MI.makerDriftPreview(book, "CX1-ZED", "salt", 0.35).error
    && !!MI.makerDriftPreview(book, "CX1-ZED", "candy", 0.1).error,
  "the preview refuses a partner, a supplier, a bucket, a figure past 30% and a book that is not on the mirror");
  const listOf = (code) => PL.priceList(code, { PRODUCTS: book.state.PRODUCTS, PROD_ORDER: ["oil"], sales: [] },
    { sizes: [], byProduct: { oil: { ...book.pricing.byProduct.oil, sizes: [10, 30, 50], ladder: [10, 30, 50].map((q) => ({ q, fixed: true, prices: [E.quoteAt(q, E.costStack(book.pricing.byProduct.oil.inputs.cost), book.pricing.byProduct.oil.inputs.policy, 0)] })), partners: [] } } },
    new Date(at)).products[0];
  const Ko = E.costStack(book.pricing.byProduct.oil.inputs.cost), Po = book.pricing.byProduct.oil.inputs.policy;
  const held = listOf("CX2-ZED"), none = listOf("CX1-ZED");
  check(held && held.basis === "card" && held.sizes.every((r) => r.price === E.quoteAt(r.q, Ko, Po, -0.3)) && held.grid.p[0] === E.quoteAt(10, Ko, Po, -0.3)
    && none && none.basis === "board" && none.sizes.every((r) => r.price === E.quoteAt(r.q, Ko, Po, 0)),
  "the price list quotes a held % on a stated board as their card and nought as the board: " + JSON.stringify([held, none].map((x) => x && [x.basis, x.sizes])));

  const oilSnap = { byProduct: { oil: { ...book.pricing.byProduct.oil, ladder: [{ q: 10, fixed: true, prices: [130] }], cards: { "CX2-ZED": [[10, 100]], "CX1-ZED": [[10, 130]] } } } };
  check(E.cardAt(oilSnap, "CX2-ZED", "oil", 10).cardNote === "their price at 10 unit" && E.cardAt(oilSnap, "CX1-ZED", "oil", 10).cardNote === "their price at 10 unit",
    "every customer is separate (his word of 22 Oct 2026): the note is their price, never a description of it: " + E.cardAt(oilSnap, "CX2-ZED", "oil", 10).cardNote);

  /* the Desk route and the Counter relay */
  const { default: worker } = await import("../src/worker.js");
  const deskReq = (pct) => new Request("https://desk.test/_internal/maker/drift-preview/CX1-ZED/salt/" + pct, { headers: { "X-Counter-Maker-Key": "k".repeat(40) } });
  const env = { COUNTER_MAKER_KEY: "k".repeat(40) };
  const shape = async (pct) => { try { const r = await worker.fetch(deskReq(pct), env, {}); return r.status; } catch (e) { return "throw:" + e.message; } };
  const [s7, s35, s15] = [await shape("7"), await shape("35"), await shape("-15")];
  check(s7 === 400 && s35 === 400 && s15 !== 404, "the Desk route takes only a whole % in steps of 5 from -30 to +30: " + [s7, s35, s15].join(", "));
  const forwarded = [];
  const cenv = { DESK_MAKER: { fetch: async (req) => { forwarded.push(new URL(req.url).pathname); return new Response(JSON.stringify({ ok: true, preview: { rows: [] } }), { headers: { "content-type": "application/json" } }); } }, COUNTER_MAKER_KEY: "counter-maker-test-key-0123456789abcdef" };
  const ident = { email: "maakmal97@icloud.com" };
  const relay = await handleMaker(new Request("https://counter.test/all/maker/drift-preview/CX1-ZED/oil/-20"), cenv, "/all/maker/drift-preview/CX1-ZED/oil/-20", ident);
  const post = await handleMaker(new Request("https://counter.test/all/maker/drift-preview/CX1-ZED/oil/-20", { method: "POST" }), cenv, "/all/maker/drift-preview/CX1-ZED/oil/-20", ident);
  const stranger = await handleMaker(new Request("https://counter.test/all/maker/drift-preview/CX1-ZED/oil/-20"), cenv, "/all/maker/drift-preview/CX1-ZED/oil/-20", { email: "someone@example.test" });
  check(relay.status === 200 && forwarded[0] === "/_internal/maker/drift-preview/CX1-ZED/oil/-20" && post.status === 405 && stranger.status === 403 && forwarded.length === 1,
    "the Counter relays the preview to the Desk unchanged, GET only, and only for the owner: " + JSON.stringify([relay.status, forwarded, post.status, stranger.status]));

  /* the Salt Admin form: since 26 Oct 2026 a stepper on the customer's own account card (Customers > Accounts) */
  const content = await contentKey("4".repeat(64), "pct-curve");
  const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
  const calls = [], reads = []; let slow = null;
  const context = { ok: true, products: ["salt", "oil"], catalog: {
    products: [{ product: "salt", drift: true }, { product: "oil", fixed: true, drift: true }],
    parties: ["CX1-ZED"], tierCustomers: ["CX1-ZED"], driftCustomers: ["CX1-ZED"], partners: [], partnerWaiting: [],
    driftCards: [{ code: "CX1-ZED", product: "salt", held: false, value: null, current: 0, suggest: -0.15, why: "good record" }] } };
  const answer = (key) => { const pct = +key.split("/").pop(); return { ok: true, preview: { code: "CX1-ZED", product: key.split("/")[1], held: 0, pct: pct / 100,
    rows: [{ q: 1, now: 120, at: 120 + pct, floor: 60, ceiling: 180, usual: false, edge: null }, { q: 6.25, now: 605, at: 605 + pct, floor: 365, ceiling: 1095, usual: true, edge: null }] } }; };
  const stamp = "2026-10-01T08:00:00.000Z";
  const accounts = [{ username: "1111-0001", code: "CX1-ZED", account: true, t: { owed: 0, toGet: 0, refund: 0, pend: 0 }, flag: "clear", seen: { opens: 1, last: stamp, how: "link" }, sent: stamp, issued: "2026-10-01" }];
  const dom = new JSDOM(landingPage("", "pct-curve-nonce", { master: "fixture-master", accounts }), {
    url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
      win.fetch = async (path, init) => {
        const route = String(path), body = init?.body ? JSON.parse(init.body) : null;
        if (route.startsWith("/all/maker/drift-preview/")) {
          const key = route.slice("/all/maker/drift-preview/".length); reads.push(key);
          if (slow && key === slow.key) await slow.wait;
          return { ok: true, status: 200, json: async () => answer(key) };
        }
        if (route === "/all/maker/inputs/tier-set") calls.push(body);
        const data = route === "/open" ? adminOpen : route === "/all/maker/inputs" ? context
          : route === "/all/maker/review" ? { ok: true, orders: [], drafts: [] }
            : route === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
              : route === "/all/sheet" ? { ok: true, at: stamp, issue: "2026-10-01", accounts, desk: { n: 2, at: stamp, moved: false }, stranger: "Silver" }
              : { ok: true, accounts: [], orders: [], drafts: [], refs: [], tiers: [] };
        return { ok: true, status: 200, json: async () => data };
      };
    }
  });
  const waitFor = async (pred, n = 150) => { for (let i = 0; i < n && !pred(); i++) await new Promise((r) => setTimeout(r, 10)); return pred(); };
  try {
    const doc = dom.window.document, text = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
    enter(doc, "customers", "accounts");
    await waitFor(() => [...doc.querySelectorAll("#rlist [data-u]")].some((c) => text(c.querySelector(".need-who")) === "CX1-ZED"));
    [...doc.querySelectorAll("#rlist [data-u]")].find((c) => text(c.querySelector(".need-who")) === "CX1-ZED").click();
    await waitFor(() => !!doc.querySelector("#aopen .apct .apct__table"));
    const form = () => doc.querySelector("#aopen .apct"), act = (name, key) => byAct(form(), name, key), table = () => form().querySelector(".apct__table");
    const val = () => text(form().querySelector(".apct__val")), step = async (name, n) => { for (let i = 0; i < n; i++) act(name).click(); await new Promise((r) => setTimeout(r, 5)); };
    check(!form().querySelector("input") && val() === "0%" && [...form().querySelectorAll('[data-act="acct.pct.book"]')].map((b) => b.getAttribute("data-key")).join() === "salt,oil",
      "the account card takes a whole % by a stepper (no typed field), on every book that takes a % (salt and oil)");
    await step("acct.pct.down", 2);
    const drawn = await waitFor(() => !!table() && val() === "\u221210%" && reads.at(-1) === "CX1-ZED/salt/-10" && table().querySelectorAll("tbody tr").length === 2);
    const cells = drawn ? [...table().querySelectorAll("tbody tr")[1].children].map(text) : [];
    check(drawn && cells[1].includes("605") && cells[2].includes("595") && cells[3].includes("365") && form().textContent.includes("Their usual is") && calls.length === 0,
      "two steps down draw now, at -10% and the Floor off the Desk's read, name their usual, and send nothing: " + JSON.stringify([reads, cells]));
    check(text(table().querySelector("thead")).includes("At \u221210%"), "the table's heading names the % it prices at");
    let release; slow = { key: "CX1-ZED/salt/-20", wait: new Promise((r) => { release = r; }) };
    await step("acct.pct.down", 2); await waitFor(() => reads.includes("CX1-ZED/salt/-20"));
    await step("acct.pct.up", 7); await waitFor(() => val() === "+15%" && !!table() && table().textContent.includes("+15%"));
    release(); await new Promise((r) => setTimeout(r, 50));
    check(table().textContent.includes("+15%") && !table().textContent.includes("−20%") && text(table().querySelectorAll("tbody tr")[1].children[2]).includes("620"),
      "a reply that lands after a newer ask is dropped: the rows stay the +15% read (RM 620 at 6.25 units), not the late -20% one (RM 585)");
    const n = reads.length; await step("acct.pct.down", 5); await new Promise((r) => setTimeout(r, 400));
    check(reads.length === n && val() === "\u221210%" && table().textContent.includes("\u221210%"), "going back to a figure already read draws it again with no new read");
    act("acct.pct.suggest").click();
    check(val() === "\u221215%", "Use the suggestion fills the whole %: -15");
    act("acct.pct.send", "CX1-ZED").click();
    await waitFor(() => calls.length === 1);
    check(calls.length === 1 && calls[0].tier === -0.15 && calls[0].unit === "pct", "Send carries the fraction the drafter reads, -0.15: " + JSON.stringify(calls));
  } finally { dom.window.close(); }
}
