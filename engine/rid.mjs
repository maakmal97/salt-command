/* engine/rid.mjs: THE RID MINTER, PURE (S4a of the Book plan, 27 Oct 2026). Lifted out of tools/rid.mjs with no change so the Book can mint on
   the same rule as the fold; tools/rid.mjs re-exports it. */
/* Parsed rather than matched with a regex, deliberately. The first version built the pattern
   with a template literal, where a lone backslash-d is just "d", so it read as ^s(d+)$ and
   matched nothing: max stayed at zero and it handed out s001 every single time. It looked
   right in a diff, and the FIRST assignment was correct by luck, because that one counts up
   from zero anyway. The collision would only have shown up on the first fold after it, on a
   real row. A parse has no escaping to get wrong.

   Found by a test asserting a folded row gets an unused id, which is the only reason it was
   not shipped: nothing else on this road would have noticed until two rows shared a name. */
export function nextRid(rows, prefix) {
  let max = 0;
  for (const r of rows) {
    if (!r || typeof r.rid !== "string" || !r.rid.startsWith(prefix)) continue;
    const tail = r.rid.slice(prefix.length);
    if (!tail.length || [...tail].some((c) => c < "0" || c > "9")) continue;
    max = Math.max(max, Number(tail));
  }
  return (n) => `${prefix}${String(max + n).padStart(3, "0")}`;
}

/* S4b: THE RIDS A BATCH ALREADY HOLDS. A row the tap booked carries the rids it minted (row.rids) and the fold copies them; a row it did not book is minted by the
   fold. So the fold's mint counts every staged rid as taken, or an un-booked row beside a booked one (or a held batch) could be given a rid a booked row already holds. */
export function reservedRids(staged) {
  return ((staged && staged.approved) || []).flatMap((a) => (a && a.row && Array.isArray(a.row.rids) ? a.row.rids : [])).filter((x) => typeof x === "string");
}
export function nextRidReserving(mint, staged) {
  const held = reservedRids(staged).map((rid) => ({ rid }));
  return (rows, prefix) => mint((rows || []).concat(held), prefix);
}
