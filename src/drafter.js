/* drafter.js — turn a queued entry into a proposed ledger ROW, in the cloud.
 *
 * This is the piece that removes the laptop from the loop. It reads the queue from KV and the
 * book from D1, writes a proposed row per entry into the `draft` table, and stops. It never
 * writes to `entry`, never touches the master, and never decides anything: the phone does that.
 *
 * IT IS ARITHMETIC, NOT A LANGUAGE MODEL, AND THAT IS A DESIGN DECISION RATHER THAN A LIMIT.
 * Everything an approval screen is read for is a number: the cost the row draws, the margin it
 * makes, whether the price sits on the party's own ladder. Those come from the book and from
 * the desk's own pricing snapshot. Putting a model on that path would add nondeterminism to
 * precisely the figures that have to be right, in a repo whose whole discipline is one engine
 * and no drift. What a model could usefully write is the ROW NOTE, which is prose, and which
 * nobody approves; that is left for later and kept off this path deliberately.
 *
 * WHAT IT REFUSES TO DRAFT is as important as what it drafts. An entry naming a party that is
 * not on the roster, or carrying a shape the desk has no row for, is left alone with a reason
 * recorded. A drafter that guessed would be worse than one that declines, which is the same
 * refusal tools/update.mjs makes for the same reason.
 *
 * THE FLAGS ARE THE POINT. A row that is merely correct tells you nothing you did not type.
 * The value is in the comparisons an entry cannot make against itself: this rate against every
 * rate that party has paid, against the product's whole observed range, against the live floor.
 * The RM115 oil unit of 14 Aug would have tripped two of them.
 */

const round = (n, dp = 2) => Math.round((n + Number.EPSILON) * 10 ** dp) / 10 ** dp;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const prodOf = (r) => (r && r.product) || "salt";

/* ---- reading the book out of the mirror ------------------------------------------- */
/* One query per collection, plus the state singletons. The mirror is kept level by the same
 * pass that commits, so a snapshot older than the master means the run should flag, not
 * proceed: pricing off a stale shelf is how a wrong cost reaches an approval screen looking
 * authoritative. */
export async function readBook(db) {
  const rows = async (c) => {
    const rs = await db.prepare("SELECT doc FROM entry WHERE collection=?1 ORDER BY seq").bind(c).all();
    return (rs.results || []).map((r) => { try { return JSON.parse(r.doc); } catch (e) { return null; } }).filter(Boolean);
  };
  const state = {};
  const rs = await db.prepare("SELECT key,doc FROM state").all();
  for (const r of (rs.results || [])) { try { state[r.key] = JSON.parse(r.doc); } catch (e) { /* skip */ } }
  const snap = await db.prepare("SELECT v,stamped FROM snapshot WHERE one=1").first();
  return {
    sales: await rows("sales"),
    purchases: await rows("purchases"),
    state,
    version: snap ? snap.v : null,
    pricing: state.PRICING || null
  };
}

/* ---- the lot the row draws --------------------------------------------------------- */
/* THE DESK'S OWN ANSWER FIRST. stockCost is what the master says the shelf is carried at, and
 * it is the number every recent row has used. It is preferred over anything computed here for
 * the reason the whole file exists: two engines drift.
 *
 * The FIFO walk below is a CHECK on that, not a replacement. Where the shelf spans two lots the
 * single figure is an average and the true cost of the next unit out depends on which lot it
 * comes off; that is exactly the case that produced the RM54.20 blend on 14 Aug, and it is
 * flagged rather than silently averaged. */
export function costFor(book, product) {
  const p = product || "salt";
  const snap = book.pricing && book.pricing.byProduct && book.pricing.byProduct[p];
  const deskCost = snap && isNum(snap.stockCost) ? snap.stockCost : null;

  const lots = (book.purchases || [])
    .filter((x) => prodOf(x) === p && isNum(x.qty) && x.qty > 0 && isNum(x.total))
    .map((x) => ({ date: x.receivedOn || x.date, qty: x.qty, rate: round(x.total / x.qty, 4), defaulted: !!x.defaulted }))
    .filter((l) => !l.defaulted)
    .sort((a, b) => (a.date || "") < (b.date || "") ? -1 : 1);
  const latest = lots.length ? lots[lots.length - 1] : null;

  /* IS THE SHELF ONE LOT OR A BLEND? The desk already answers this and the answer is the pair
     of numbers, not the purchase history. STOCK_COST equal to the newest lot rate means every
     unit standing there came off that lot; different means it is an average across two rates
     and the true cost of the next unit out depends which one it draws.
     The first version of this compared the last few PURCHASE rates instead, which was wrong in
     the way that matters: it would have flagged a blend on every row for ever after any rate
     change, including now, when the shelf is a single RM56 lot and the RM47 remnant is gone.
     A flag that fires when nothing is wrong is worse than no flag, because it teaches the
     reader to tap through. */
  const blend = (deskCost != null && latest != null) ? Math.abs(deskCost - latest.rate) > 0.005 : false;

  return {
    cost: deskCost != null ? deskCost : (latest ? latest.rate : null),
    source: deskCost != null ? "the desk's own shelf cost" : (latest ? "the newest received lot" : null),
    latestRate: latest ? latest.rate : null,
    mayBlend: blend
  };
}

/* ---- what the desk would refuse ---------------------------------------------------- */
export function floorFor(book, product, qty) {
  const snap = book.pricing && book.pricing.byProduct && book.pricing.byProduct[product || "salt"];
  if (!snap || !snap.floors) return null;
  /* the carded sizes are what the snapshot holds; an odd size takes the nearest carded one
     BELOW it, because rounding up would report a floor the desk never quoted */
  const sizes = Object.keys(snap.floors).map(Number).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sizes.length) return null;
  const exact = snap.floors[String(qty)];
  if (exact && isNum(exact.delivered)) return { ...exact, at: qty, exact: true };
  let pick = sizes[0];
  for (const s of sizes) if (s <= qty) pick = s;
  const f = snap.floors[String(pick)];
  return f && isNum(f.delivered) ? { ...f, at: pick, exact: false } : null;
}

/* ---- the comparisons an entry cannot make against itself --------------------------- */
export function flagsFor(entry, row, book, priced) {
  const flags = [];
  const p = prodOf(row);
  const qty = row.qty, total = row.total;
  const rate = (isNum(total) && isNum(qty) && qty > 0) ? total / qty : null;
  /* A PURCHASE IS NOT A SALE and most of what follows is meaningless on one. The floor is a
     SELLING floor, "below cost" is circular when the row IS the cost, and a supplier has no
     buying history to compare against. The first version ran all of it on both and told me a
     RM700 restock was RM300 under floor, which is the kind of flag that teaches a reader to
     stop reading them. */
  const isSale = !row.supplier;
  /* Only rows that actually MOVED count as history. A pending row is an intention: nothing was
     paid and nothing went out, so it is not evidence of what a party pays. This matters here
     and not in theory: CC5-OKR's pending RM80 sits on the book undated, and counting it made
     his four RM90 orders look like a party with no standing rate at all. */
  const committed = (book.sales || []).filter((s) => !s.cancelled && s.date);

  /* 1. THE RATE AGAINST THE PRODUCT'S WHOLE OBSERVED RANGE. This is the RM115 oil check, and
        it is first because it is the one that would have caught it: RM115 against a book whose
        oil had never left the RM6 to RM13 band. A factor rather than a fixed band, so it
        scales with whatever the product actually trades at. */
  const seen = committed.filter((s) => prodOf(s) === p && isNum(s.total) && isNum(s.qty) && s.qty > 0)
    .map((s) => s.total / s.qty);
  if (rate != null && seen.length >= 3) {
    const lo = Math.min(...seen), hi = Math.max(...seen);
    if (rate > hi * 2) flags.push(`RM ${round(rate)}/unit is more than double the highest ${p} rate this book has ever carried (RM ${round(hi)}). Check the figure before approving.`);
    else if (rate < lo / 2) flags.push(`RM ${round(rate)}/unit is less than half the lowest ${p} rate on the book (RM ${round(lo)}).`);
  }

  /* 2. THE RATE AGAINST THIS PARTY'S OWN HISTORY. The CC5-OKR case: RM80 against a party who
        had paid RM90 every time.
        MEASURED AGAINST THE MEDIAN, NOT AGAINST PERFECT UNIFORMITY. The first version fired
        only when every prior rate was identical, which meant one odd order switched the check
        off for that party for ever. A median with a tolerance keeps working, and says plainly
        that it is a typical rate rather than a rule. */
  const party = row.customer || row.supplier;
  const theirs = isSale
    ? committed.filter((s) => s.customer === party && prodOf(s) === p && isNum(s.total) && isNum(s.qty) && s.qty > 0)
      .map((s) => s.total / s.qty).sort((a, b) => a - b)
    : [];
  if (rate != null && theirs.length >= 2) {
    const mid = theirs.length % 2 ? theirs[(theirs.length - 1) / 2] : (theirs[theirs.length / 2 - 1] + theirs[theirs.length / 2]) / 2;
    if (mid > 0 && Math.abs(rate - mid) / mid >= 0.10) {
      const uniform = theirs.every((r) => Math.abs(r - theirs[0]) < 0.005);
      flags.push(uniform
        ? `${party} has paid RM ${round(mid)}/unit on every one of their ${theirs.length} orders of ${p}; this one is RM ${round(rate)}.`
        : `${party} typically pays about RM ${round(mid)}/unit for ${p} across ${theirs.length} orders; this one is RM ${round(rate)}, ${round(Math.abs(rate - mid) / mid * 100, 1)}% ${rate > mid ? "above" : "below"} that.`);
    }
  }

  /* 3. AGAINST THE LIVE FLOOR, which moves with the cost and is the reason a printed floor is
        refused anywhere on this desk. Sales only: there is no floor on what you pay a supplier. */
  const fl = isSale ? floorFor(book, p, qty) : null;
  if (fl && isNum(total)) {
    if (total < fl.delivered - 0.005) {
      const collected = isNum(fl.collected) && total >= fl.collected - 0.005;
      flags.push(`RM ${round(total)} is under the delivered floor of RM ${round(fl.delivered)}${fl.exact ? "" : ` (read at ${fl.at} unit, the nearest carded size)`}`
        + (collected ? `, though it clears the collected floor of RM ${round(fl.collected)}.` : `, and under the collected floor of RM ${round(fl.collected)} too.`));
    }
  }

  /* 4. BELOW COST. Separate from the floor because it is a different fact and the book has
        actually done it: the RM6 oil resell of 11 Aug. */
  if (isSale && isNum(priced.cost) && rate != null && rate < priced.cost) {
    flags.push(`This sells at RM ${round(rate)}/unit against a lot that cost RM ${round(priced.cost)}: it loses money on every unit.`);
  }

  /* 5. A BLENDED SHELF. The cost given is an average and the row may in truth draw two lots. */
  if (priced.mayBlend) {
    flags.push(`The shelf spans more than one lot rate, so RM ${round(priced.cost)}/unit is the shelf average rather than the lot this row draws. Check the blend before approving.`);
  }

  /* 6. A PARTY THIS BOOK DOES NOT KNOW. Checked against the right list for the direction: the
        roster names customers, and a supplier is known by having supplied before. Getting this
        wrong told me SA5-BTR, who has sold the desk almost everything on the shelf, had "no
        committed salt order", which is true and completely beside the point. */
  if (party) {
    if (isSale) {
      const roster = (book.state && book.state.roster) || [];
      if (!roster.includes(party)) flags.push(`${party} is not on the roster. A new party needs a code and a directory entry before this row is committed.`);
      else if (!theirs.length) flags.push(`${party} has no committed ${p} order on the book, so there is no rate of theirs to compare this against.`);
    } else {
      const suppliers = new Set((book.purchases || []).map((x) => x.supplier).filter(Boolean));
      if (!suppliers.has(party)) flags.push(`${party} has never supplied this desk before. Check the code before approving.`);
    }
  }

  /* 7. AN ADVANCE, and whether it sits at the retail credit cap. Reported rather than judged:
        the cap lives in the master's RULES, which is configuration and not mirrored here. */
  if (isNum(row.cash) && isNum(total) && row.cash < total - 0.005 && isNum(row.deliveredQty) && row.deliveredQty > 0) {
    flags.push(`This is an ADVANCE: ${row.deliveredQty} unit goes out with RM ${round(total - row.cash)} unpaid. Check it against ${party}'s credit cap.`);
  }

  /* 8. A STALE SNAPSHOT prices the row off a shelf that has since moved. */
  if (book.pricing && book.version && book.pricing.v && book.pricing.v !== book.version) {
    flags.push(`The pricing snapshot was taken at ${book.pricing.v} but the mirror is at ${book.version}, so the cost and floors here may be stale.`);
  }

  return flags;
}

/* ---- the row ----------------------------------------------------------------------- */
/* Built to the shape the master's own arrays use, because the commit run folds it in verbatim.
 * A PENDING order carries NO DATE, which is the desk's standing rule and not a nicety: an
 * agreed date is an intention, a dated row draws stock and books revenue, and a row that did
 * neither would put both on the book before anything moved. */
export function draftRow(entry, book) {
  const pay = entry && entry.payload;
  if (!pay || typeof pay !== "object") return { skip: "the entry carries no payload the desk can read" };
  if (pay.mode && pay.mode !== "new") return { skip: `this entry amends an existing row (mode "${pay.mode}"), which is a judgement about WHICH row and is left for a person` };

  const dir = String(pay.direction || "").toUpperCase();
  if (dir !== "SELL" && dir !== "BUY") return { skip: "the entry names no direction" };
  const party = pay.party;
  if (!party) return { skip: "the entry names no counterparty" };
  if (pay.assoc || pay.stream || pay.downstream || pay.linkTo || pay.orderCode) {
    return { skip: "the entry carries associate, stream or link fields, which decide whose bucket the row books to and is left for a person" };
  }

  const product = pay.product || "salt";
  const qty = isNum(pay.qty) ? pay.qty : null;
  const total = isNum(pay.total) ? pay.total : null;
  if (qty == null || total == null) return { skip: "the entry has no quantity or no total" };

  const cash = isNum(pay.cash) ? pay.cash : 0;
  const moved = isNum(pay.kg) ? pay.kg : 0;
  const priced = costFor(book, product);
  if (priced.cost == null) return { skip: `nothing on the book says what ${product} costs, so the row cannot be priced` };

  const paidInFull = cash >= total - 0.005;
  const deliveredInFull = moved >= qty - 0.005;
  const nothingMoved = cash < 0.005 && moved < 0.005;

  const row = { customer: party, qty, total, cost: round(priced.cost), cash: round(cash) };
  if (dir === "BUY") { delete row.customer; delete row.cost; row.supplier = party; row.status = paidInFull ? "paid" : "part"; }
  if (product !== "salt") row.product = product;

  /* THE DATE, and the rule it follows. Nothing moved means nothing happened, so the row is
     pending and undated and counts nowhere until it does. */
  if (!nothingMoved) {
    row.date = pay.date || null;
    if (!row.date) return { skip: "something moved on this entry but it carries no date, and dating it is a judgement" };
    if (dir === "SELL") {
      row.deliveredQty = moved;
      if (moved > 0.005) row.deliveredOn = row.date;
      if (paidInFull) row.paidOn = row.date;
    } else {
      if (moved > 0.005) { row.receivedOn = row.date; row.receivedQty = moved; }
      if (paidInFull) row.paidOn = row.date;
    }
  } else if (dir === "SELL") {
    row.deliveredQty = 0;
  }
  if (pay.note) row.note = String(pay.note);

  const rate = qty > 0 ? total / qty : null;
  const margin = (dir === "SELL" && rate != null) ? ((total - priced.cost * qty) / total) * 100 : null;
  const bits = [
    `${dir === "BUY" ? "Bought" : "Sold"} ${qty} unit of ${product} ${dir === "BUY" ? "from" : "to"} ${party} for RM ${round(total)}, RM ${round(rate)}/unit.`,
    dir === "SELL" ? `Costed at RM ${round(priced.cost)}/unit from ${priced.source}, so ${margin == null ? "no margin could be computed" : `RM ${round(total - priced.cost * qty)} on the order at ${round(margin, 1)}%`}.` : "",
    nothingMoved
      ? "Nothing was paid and nothing moved, so the row is PENDING and carries NO DATE: it draws no stock and books no revenue until it does."
      : `${paidInFull ? "Paid in full" : `RM ${round(cash)} of RM ${round(total)} paid`} and ${deliveredInFull ? "delivered in full" : `${moved} of ${qty} unit moved`} on ${row.date}.`,
    "Drafted from the queued entry; the figures come from the mirror and the desk's own pricing snapshot, and nothing is committed until this is approved."
  ].filter(Boolean);

  return {
    collection: dir === "BUY" ? "purchases" : "sales",
    row,
    reasoning: bits.join(" "),
    flags: flagsFor(entry, row, book, priced)
  };
}

/* ---- reading the queue -------------------------------------------------------------- */
async function queueEntries(env) {
  const entries = [];
  let cursor;
  do {
    const list = await env.SALT_QUEUE.list({ prefix: "q:", cursor });
    for (const k of list.keys) {
      const raw = await env.SALT_QUEUE.get(k.name);
      if (!raw) continue;
      try { for (const e of (JSON.parse(raw).queue || [])) entries.push(e); } catch (e) { /* skip a corrupt key */ }
    }
    cursor = list.list_complete ? null : list.cursor;
  } while (cursor);
  const byAt = new Map();
  for (const e of entries) if (e && e.at) byAt.set(e.at, e);
  return byAt;
}

/* ---- a dry run ----------------------------------------------------------------------- */
/* The same decisions, stored nowhere. This is how the drafter is proved against the real book
 * without putting a row in front of anyone: it returns exactly what it WOULD write. */
export async function dryRunDrafter(env) {
  if (!env.SALT_LEDGER) return { ok: false, error: "no ledger binding" };
  if (!env.SALT_QUEUE) return { ok: false, error: "no queue binding" };
  const byAt = await queueEntries(env);
  const book = await readBook(env.SALT_LEDGER);
  const mark = book.state && book.state.QUEUE_COMMITTED;
  const seen = await env.SALT_LEDGER.prepare("SELECT id FROM draft").all();
  const already = new Set((seen.results || []).map((r) => r.id));
  const out = { ok: true, dry: true, mirror: book.version, pricingAt: book.pricing && book.pricing.v, would: [], skipped: [], already: 0, committed: 0 };
  for (const at of [...byAt.keys()].sort()) {
    if (mark && at <= mark) { out.committed++; continue; }
    if (already.has(at)) { out.already++; continue; }
    const d = draftRow(byAt.get(at), book);
    if (d.skip) out.skipped.push({ at, why: d.skip });
    else out.would.push({ at, collection: d.collection, row: d.row, reasoning: d.reasoning, flags: d.flags });
  }
  return out;
}

/* ---- the run ------------------------------------------------------------------------ */
/* Idempotent by construction: a draft's id IS the entry's own `at`, and the insert is
 * INSERT OR IGNORE, so a cron that fires while the last one is still finishing cannot double
 * anything. Entries at or below the watermark are already in the master and are skipped. */
export async function runDrafter(env, { now = () => new Date().toISOString() } = {}) {
  if (!env.SALT_LEDGER) return { ok: false, error: "no ledger binding" };
  if (!env.SALT_QUEUE) return { ok: false, error: "no queue binding" };

  const byAt = await queueEntries(env);
  const book = await readBook(env.SALT_LEDGER);
  const mark = book.state && book.state.QUEUE_COMMITTED;
  const seen = await env.SALT_LEDGER.prepare("SELECT id FROM draft").all();
  const already = new Set((seen.results || []).map((r) => r.id));

  const out = { ok: true, at: now(), considered: 0, drafted: 0, skipped: [], already: 0, committed: 0 };
  for (const at of [...byAt.keys()].sort()) {
    const entry = byAt.get(at);
    if (mark && at <= mark) { out.committed++; continue; }
    out.considered++;
    if (already.has(at)) { out.already++; continue; }
    const d = draftRow(entry, book);
    if (d.skip) { out.skipped.push({ at, why: d.skip }); continue; }
    await env.SALT_LEDGER.prepare(
      `INSERT OR IGNORE INTO draft
         (id,status,collection,entry,row,reasoning,flags,party,product,date,qty,total,cost,drafter,drafted_at)
       VALUES (?1,'pending',?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)`
    ).bind(
      at, d.collection, JSON.stringify(entry), JSON.stringify(d.row), d.reasoning,
      JSON.stringify(d.flags), d.row.customer || d.row.supplier || null,
      d.row.product || (d.collection === "sales" ? "salt" : null),
      d.row.date || null, d.row.qty ?? null, d.row.total ?? null, d.row.cost ?? null,
      "cloud-drafter", now()
    ).run();
    out.drafted++;
  }
  return out;
}
