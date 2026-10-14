/* book-invariants.mjs: every rule a VALID book must obey, as one function over a parsed book (S0 split). The suite runs it on the live
   book (a bad fold turns it red) and on the frozen fixture (a control); test/verify.mjs plants each fault to prove the rule names it. */
export const bookFaults = (b) => {
  const out = [], roster = new Set(b.roster || []);
  for (const [c, g] of Object.entries(b.PLACED || {})) {
    if (!(Array.isArray(g) && g.length === 3 && typeof g[2] === "string" && g[2].trim())) out.push("PLACED " + c + " has no locality");
    if (!roster.has(c)) out.push("PLACED " + c + " is not on the roster");
  }
  if (roster.size !== (b.roster || []).length) out.push("the roster repeats a code");
  for (const k of ["sales", "purchases"]) {
    const rids = (b[k] || []).map((r) => r.rid);
    if (rids.some((r) => !r)) out.push(k + " holds a row with no rid");
    if (new Set(rids).size !== rids.length) out.push(k + " repeats a rid");
  }
  for (const s of b.sales || []) if (s.customer && !roster.has(s.customer)) out.push("a sale names " + s.customer + ", not on the roster");
  for (const r of b.customerRefunds || []) if (!(r.party && roster.has(r.party) && r.amount > 0 && r.since)) out.push("a refund row is incomplete: " + JSON.stringify(r.party));
  for (const p of b.partners || []) if (!roster.has(p)) out.push("partner " + p + " is not on the roster");
  return out;
};
