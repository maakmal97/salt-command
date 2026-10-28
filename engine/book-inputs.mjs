/* engine/book-inputs.mjs: S5b OF THE BOOK PLAN, THE PRICING SNAPSHOT FROM A BOOK ALONE, PURE (28 Oct 2026; plan: docs/plan-book-s5-s6.html).
 *
 * The desk's PRICING is struck in jsdom over the master (tools/book.mjs pricingSnapshot) because the engine's \`pricing()\` (engine/snapshot.mjs) takes a context the PAGE builds
 * out of its globals (master \`snapCtx\`). Every one of those globals is a key of the book, or a one-line sum over one (the loans net, the counts the queue overlay would add),
 * so this builds the same context from a book object and calls the same \`pricing()\`: what a Worker, the Book or a test can do with no page. It is the S5 plan's "the Worker
 * recomputes PRICING" part, dormant: nothing in the Worker calls it yet, and the chain's step (tools/pricing-parity.mjs) proves each fold that it answers what the page answered.
 *
 * Reproduced from the master, line for line: \`loanLeft\`, \`loanOutUnits\`, \`loanInUnits\`, \`loanDrawUnits\` (master, "v595"), the empty \`statedStockBy\` (the page fills it only from a
 * queued count; a book carries its counts in STATED_STOCK and COUNTS), \`snapCtx\`'s getters. Not here: \`obs\` (the Whiteboard's observations, advice and no figure) and \`profileOf\`
 * (how each customer buys: the price list and the drafter READ it, so a Worker-made PRICING must keep it from the last load until it is lifted too): the page alone derives them, and a PRICING
 * made here carries \`byProduct\` and \`sizes\` only. No clock of its own: the moment is given. WHERE IT MUST NOT RUN: inside the Book's own request, where its synchronous third of a second
 * to a few seconds (customers times rows) would hold every tap, load and socket; a Worker request or an alarm. */
import SNAPSHOT_ENGINE from "./snapshot.mjs";
import PRICING_RULES from "./rules.mjs";

/* the master's `const DEFAULT_PROD='salt'` (not a book key): the book a row with no product belongs to. Left out, every salt row, which names no product, falls out of salt's walk. */
export const DEFAULT_PROD = "salt";
const loanLeft = (l) => (!l || l.status === "settled") ? 0 : +Math.max(0, (+l.valueKg || 0) - (l.repaid || []).reduce((a, x) => a + (+x.kg || 0), 0)).toFixed(2);
const loanOutUnits = (loans) => loans.reduce((a, l) => a + (l.preOpening || l.direction === "in" ? 0 : loanLeft(l)), 0);
const loanInUnits = (loans) => loans.reduce((a, l) => a + (l.direction === "in" ? loanLeft(l) : 0), 0);

/** the context the engine's pricing() takes, from a book object (ledger/book.json's shape) */
export function inputsFromBook(book) {
  const loans = Array.isArray(book.loans) ? book.loans : [];
  /* the page's render cache, fresh for each pricing: the engine keys every entry by product, customer, size and override, so one Map serves all six books. Without it every card
     and every suggestion recomputes the whole cost stack (1.6 s on today's book, growing with customers times rows); with it about a third of that, the same figures. */
  const cache = new Map();
  return {
    memo: (k, f) => { if (cache.has(k)) return cache.get(k); const v = f(); cache.set(k, v); return v; },
    sales: book.sales || [], purchases: book.purchases || [], opening: book.PROD_OPENING || {}, statedStockBy: {}, statedStock: book.STATED_STOCK,
    loanDrawUnits: () => loanOutUnits(loans) - loanInUnits(loans),
    supplierReceivable: book.supplierReceivable !== undefined ? book.supplierReceivable : null,
    counts: book.COUNTS || [], selfUseLog: book.selfUseLog || [], quotes: book.QUOTES || {}, priceSet: book.PRICE_SET !== undefined ? book.PRICE_SET : null,
    costRule: book.COST_RULE || {}, defaultProd: DEFAULT_PROD, refunds: book.customerRefunds || [],
    roster: book.roster || [], partners: book.partners || [], tierOf: book.TIER_OF || {}, prodOrder: book.PROD_ORDER || []
  };
}

/** the page's TODAY (master: `const TODAY=new Date(new Date(Date.now()+8*36e5).toISOString().slice(0,10))`): the Kuala Lumpur calendar day at midnight UTC. Lock ages, drift signals and profiles read it. */
export const klToday = (now) => new Date(new Date(+now + 8 * 36e5).toISOString().slice(0, 10));

/** PRICING's money part for a book at a moment (an instant, a Date or a number): { sizes, byProduct }. \`over\` is the desk's pxOver (null reads as none). */
export function pricingFromBook(book, now, over = null) {
  const B = inputsFromBook(book);
  const byProduct = SNAPSHOT_ENGINE.pricing(B, PRICING_RULES, klToday(now), over);
  const first = byProduct[B.defaultProd] || byProduct[(B.prodOrder || [])[0]];
  return { sizes: first ? first.sizes : null, byProduct };
}

/** the figures that decide money, named by product and key, between two PRICING.byProduct objects (rounded to 8 places as the suite compares them): [] when equal.
 *  A customer-keyed map (cards, lift, suggest) names the codes that differ, five at most; every other key names itself. */
export function pricingDiffer(a, b) {
  const r8 = (v) => JSON.stringify(v, (k, x) => (typeof x === "number" ? Math.round(x * 1e8) / 1e8 : x));
  const out = [];
  for (const p of [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].sort()) {
    const x = (a || {})[p], y = (b || {})[p];
    if (!x || !y) { out.push(p + " (missing on one side)"); continue; }
    for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
      if (r8(x[k]) === r8(y[k])) continue;
      if (["cards", "lift", "suggest"].includes(k) && x[k] && y[k] && typeof x[k] === "object" && typeof y[k] === "object") {
        const codes = [...new Set([...Object.keys(x[k]), ...Object.keys(y[k])])].filter((c) => r8(x[k][c]) !== r8(y[k][c])).sort();
        out.push(p + "." + k + " (" + codes.length + ": " + codes.slice(0, 5).join(", ") + (codes.length > 5 ? ", ..." : "") + ")");
      } else out.push(p + "." + k);
    }
  }
  return out;
}
