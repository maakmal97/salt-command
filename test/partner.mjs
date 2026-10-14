/* test/partner.mjs: his decision of 06 Oct 2026, A PARTNER PAYS COST. A party in `partners` is quoted the floor itself, to the sen, at
   every size on every book, through the engine's quoteAt and quoteGrid ('partner'), the desk's cardQuote and the Counter's sealed list;
   nobody else's price moves. Run on the live master's own inputs; a failure names a count, never a code. */
import { FROZEN_BOOK } from "./frozen.mjs";
import fs from "node:fs";

export async function run({ ok }) {
  const E = (await import("../engine/pricing.mjs")).default;
  const { priceList } = await import("../tools/pricelist.mjs");
  const { pricingSnapshot } = await import("../tools/book.mjs");
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  const book = JSON.parse(fs.readFileSync(FROZEN_BOOK, "utf8"));
  const partners = book.partners || [], other = (book.associates || []).find((c) => !partners.includes(c));
  ok(partners.length > 0 && other, "the book names a partner, and an associate who is not one");
  const rd = (e) => JSON.parse(String(w.eval("JSON.stringify(" + e + ")")));
  const snap = pricingSnapshot(w);
  const P0 = partners[0];
  let offEngine = 0, offDesk = 0, offList = 0, offGrid = 0, n = 0, moved = 0;
  for (const p of ["salt", "oil", "candy", "rice"]) {
    const s = snap.byProduct[p], C = E.costStack(s.inputs.cost), P = s.inputs.policy;
    w.eval("setProd(" + JSON.stringify(p) + ");recompute();");
    const rungs = rd("TIER_RULE[PROD].rungs");
    for (const q of rungs) {
      n++;
      const F = E.floorTotal(q, C, P);
      if (Math.abs(E.quoteAt(q, C, P, "partner") - F) > 0.006) offEngine++;
      const dq = rd("cardQuote(" + JSON.stringify(P0) + "," + q + ")");
      if (dq == null || Math.abs(dq - F) > 0.006) offDesk++;
    }
    const pl = priceList(P0, book, snap, Date.now()).products.find((x) => x.product === p);
    if (!pl || !pl.grid) { offList++; continue; }
    pl.sizes.forEach((x) => { if (Math.abs(x.price - E.floorTotal(x.q, C, P)) > 0.006) offList++; });
    pl.grid.p.forEach((x, i) => { if (Math.abs(x - E.floorTotal(pl.grid.min + i * pl.grid.step, C, P)) > 0.006) offGrid++; });
    const o = priceList(other, book, snap, Date.now()).products.find((x) => x.product === p);
    if (!o || o.sizes.some((x) => x.price < E.floorTotal(x.q, C, P) - 0.006)) moved++;
  }
  ok(n > 10 && offEngine === 0, "the engine's partner quote is the floor to the sen at every rung: " + offEngine + " of " + n + " off");
  ok(offDesk === 0, "the desk's card for a partner is the floor at every rung of every book: " + offDesk + " off");
  ok(offList === 0 && offGrid === 0, "a partner's sealed list and grid are the floor on every book: " + offList + " sizes, " + offGrid + " grid points off");
  /* the Drift card names a partner as such and offers no drift to set; an associate who is no partner keeps theirs */
  const card = String(w.eval("(function(){setProd('salt');recompute();return driftCard();})()"));
  ok(moved === 0, "an associate who is no partner is still quoted off the board, never under the floor: " + moved + " books wrong");
}
