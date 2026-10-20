/* tools/reward-open.mjs: THE SWITCH TO THE STEP AT LANDED COST (his rules of 20 Oct 2026; his answer to Ask 3).
 *
 * A straight recount of the whole ledger at 10 units' landed cost would take back units three associates have already taken, so
 * each associate opens on a STATED position, as cash opens on a count: the units the count before the switch had earned, the
 * share of the next one, the newest sales rid it read and their salt rows Pending then (the engine's rewardOpening). It writes
 * REWARD_OPEN into ledger/book.json ONCE, through writeBookFile, and refuses a book that already states one; then run
 * `node tools/booksync.mjs --sync`, `npm run build` and `node tools/ledger.mjs`. Customers open nothing: they redeem nothing from
 * the switch (his answer to the loyalty plan's Ask 4), and what they hold stays as it stands.
 *
 *   node tools/reward-open.mjs --since 2026-10-20 [--dry]
 *
 * The scheme is the master's own REWARD (read from the desk's runtime, as the extract reads it) with its since taken off, so the
 * figures are the count's before the switch. It prints, per associate, what they hold and the whole % of their next unit on both
 * sides, which must be the same. */
import { pathToFileURL } from "node:url";
import { readBookFile, writeBookFile, BOOK } from "./booksync.mjs";
import { readBook } from "./book.mjs";
import E from "../engine/position.mjs";

/* every associate on the book, by the engine's own test (rewardAccount's flag), buckets left out */
export function associatesOf(book, scheme) {
  const eb = engineBook(book, scheme);
  return [...new Set((book.roster || []).filter((c) => typeof c === "string" && !E.isBucket(c)))]
    .filter((c) => { const a = E.rewardAccount(eb, c, "salt", { old: true }); return a.associate; }).sort();
}
export function engineBook(book, scheme, open) {
  return { sales: book.sales || [], purchases: book.purchases || [],
    state: { ...book, REWARD: scheme, ...(open ? { REWARD_OPEN: open } : {}) } };
}
/* the openings, and per associate both sides of the switch: held, and the whole % of the next unit */
export function openings(book, stated, since) {
  const before = JSON.parse(JSON.stringify(stated));
  if (before.salt && before.salt.associate) delete before.salt.associate.since;
  const after = JSON.parse(JSON.stringify(stated));
  after.salt.associate.since = since;
  const old = { stated: before }, now = { stated: after };
  const open = {}, table = [];
  for (const code of associatesOf(book, old)) {
    const o = E.rewardOpening(engineBook(book, old), code, since);
    if (o.error) throw new Error(code + ": " + o.error);
    open[code] = o;
  }
  for (const code of Object.keys(open)) {
    const a = E.rewardAccount(engineBook(book, old), code, "salt", { old: true });
    const b = E.rewardAccount(engineBook(book, now, open), code);
    const w = E.rewardWalk(engineBook(book, now, open), code, since);
    const pct = (x) => Math.round(x * 100);
    table.push({ code, heldBefore: a.held, heldAfter: b.held, pctBefore: pct(open[code].share), pctAfter: pct(w.next) });
  }
  return { open, table };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2), i = argv.indexOf("--since"), since = i >= 0 ? argv[i + 1] : null, dry = argv.includes("--dry");
  if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error("usage: node tools/reward-open.mjs --since YYYY-MM-DD [--dry]"); process.exit(2); }
  const book = readBookFile();
  if (book.REWARD_OPEN && !dry) { console.error("refused: ledger/book.json already states REWARD_OPEN; the openings are written once"); process.exit(1); }
  const desk = await readBook(), stated = desk.ledger.REWARD && desk.ledger.REWARD.stated;
  desk.dom.window.close();
  if (!stated || !stated.salt || !stated.salt.associate || !(+stated.salt.associate.times > 0)) {
    console.error("refused: the master's REWARD names no times"); process.exit(1);
  }
  const { open, table } = openings(book, stated, since);
  for (const r of table) console.log(`${r.code.padEnd(10)} held ${r.heldBefore} -> ${r.heldAfter}   next ${r.pctBefore}% -> ${r.pctAfter}%`);
  const moved = table.filter((r) => r.heldBefore !== r.heldAfter || r.pctBefore !== r.pctAfter);
  if (moved.length) { console.error("refused: the switch would move " + moved.map((r) => r.code).join(", ")); process.exit(1); }
  if (dry) { console.log("dry: nothing written"); process.exit(0); }
  book.REWARD_OPEN = open;
  book.NOTES = book.NOTES || {};
  book.NOTES.REWARD_OPEN = [`THE SWITCH TO THE STEP AT LANDED COST, ${since} (his rules of 20 Oct 2026, his answer to Ask 3). Each associate opens on the units the count before the switch had earned and the share of the next one, so nothing they hold or see moves; from here a unit is 10 units' landed cost of margin on their own buying and resale, counted once paid in full. Written once by tools/reward-open.mjs; the fold adds one the day a customer becomes an associate.`]
    .concat(book.NOTES.REWARD_OPEN || []);
  writeBookFile(book, BOOK);
  console.log(`wrote REWARD_OPEN for ${Object.keys(open).length} associates into ${BOOK}`);
}
