import POSITION_ENGINE from "../engine/position.mjs";
import PRICING_ENGINE from "../engine/pricing.mjs";
import { costFor, cogsFor, floorFor, theirRates, recentRates, draftRow, findRow, checkCorrection, reviving, undoNotes } from "./drafter.js";
import { cardAt, rowRoom, siteWords } from "./orders.js";
import { rowFigures, moveRow } from "./approve-figures.js";
import { AGREED_ON_SITE } from "../engine/stages.mjs";

/* note and settle are free prose a row carries about itself, so they stay on the Desk */
const DESK_ONLY_FIELDS = ["note", "settle"];
/* a trip is set by These are one order alone (makerTripJoin), which holds the whole trip together; Correct a row never offers it */
const JOIN_ONLY_FIELDS = ["trip"];

const object = (body) => !!body && typeof body === "object" && !Array.isArray(body);
const timestamp = (at) => typeof at === "string" && Number.isFinite(Date.parse(at))
  && new Date(at).toISOString() === at;
const date = (value) => typeof value === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const figure = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1000000;
const code = (value, roster) => typeof value === "string" && /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(value)
  && roster.includes(value);
const active = (product, book) => typeof product === "string" && /^[a-z]{1,20}$/.test(product)
  && Object.hasOwn(book.state.PRODUCTS || {}, product) && !book.state.PRODUCTS[product].retired;
const ready = (book) => !!(book && object(book.state) && book.version);
const proposed = (entry, book) => {
  const draft = draftRow(entry, book);
  return draft.skip ? { error: draft.skip } : { entry, draft };
};

/** Dedicated trade inputs, not a queue-entry or row-patch forwarding road. */
export function makerTradeEntry(operation, body, book, trip = null, pending = [], registrations = []) {
  if (!["sale", "purchase"].includes(operation)) return { error: "Choose sale or purchase." };
  const sale = operation === "sale";
  const fields = ["at", "product", "party", "date", "qty", "total", "cash", "movedUnits", "handover", "second"]
    .concat(sale ? ["delivery", "assoc", "stream", "downstream", "cover"] : ["freight"]);
  if (!object(body) || Object.keys(body).some((key) => !fields.includes(key)))
    return { error: "Unsupported trade input fields." };
  if (!timestamp(body.at)) return { error: "A trade needs its canonical request timestamp." };
  if (!date(body.date)) return { error: "A trade needs a real date in YYYY-MM-DD." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!active(body.product, book)) return { error: "Choose an active product." };
  const roster = book.state.roster || [];
  const verified = registrations.filter((item) => item && code(item.code, [item.code])
    && ["customer", "supplier", "reseller", "referral", "downstream", "bucket"].includes(item.kind)
    && ["pending", "approved"].includes(item.status));
  const partyKind = sale ? body.stream === "R2" ? "associate" : "buyer" : "supplier";
  const partyKinds = sale && body.stream === "R2"
    ? ["reseller"] : ["customer", "supplier", "reseller", "referral", "downstream"];
  const partyRegistered = verified.some((item) => item.code === body.party && partyKinds.includes(item.kind));
  if (!code(body.party, roster) && !partyRegistered) return { error:
    `Choose ${partyKind === "associate" ? "an" : "a"} ${partyKind} on the roster. Register a new ${partyKind} under Counter Admin > Add ID first, then pick the code.` };
  for (const key of ["qty", "total", "cash", "movedUnits"])
    if (!figure(body[key])) return { error: "Trade figures must be finite, non-negative numbers." };
  if (!(body.qty > 0)) return { error: "Units must be above zero." };
  const carry = sale ? "delivery" : "freight";
  if (body[carry] !== undefined && !figure(body[carry]))
    return { error: "Carriage must be a finite, non-negative number." };
  if (body.handover !== undefined && body.handover !== null && !POSITION_ENGINE.HANDOVER.includes(body.handover))
    return { error: "Handover is delivered, collected or not stated." };
  const assoc = body.assoc || null, stream = body.stream || null, downstream = body.downstream || null;
  const assocKind = stream === "R2" ? "reseller" : "referral";
  for (const key of ["assoc", "downstream"])
    if (body[key] !== undefined && body[key] !== null
      && !code(body[key], roster) && !verified.some((item) => item.code === body[key]
        && (key === "downstream" ? item.kind === "downstream" : item.kind === assocKind)))
      return { error: key === "downstream"
        ? "Choose an end buyer on the roster, or leave End customer as Not named. Register a new end buyer under Counter Admin > Add ID first, then pick the code."
        : body.stream === "R3"
          ? "Choose a referrer on the roster. Register a new referrer under Counter Admin > Add ID first, then pick the code."
          : "Choose an associate on the roster. Register a new associate under Counter Admin > Add ID first, then pick the code." };
  if (body.stream !== undefined && body.stream !== null && !["R2", "R3"].includes(body.stream))
    return { error: "Choose R2 or R3." };
  if (assoc ? !["R2", "R3"].includes(stream) : stream || downstream)
    return { error: "An attribution needs an associate and its stream." };
  if (downstream && stream !== "R2") return { error: "An end buyer belongs to an R2 sale." };
  if (stream === "R2") {
    const bucket = POSITION_ENGINE.ownerCode(assoc) + POSITION_ENGINE.BUCKET_SFX;
    const appointed = verified.some((item) => item.code === assoc && POSITION_ENGINE.ADDID_APPOINTS[item.kind]);
    if (!roster.includes(bucket) && !appointed) return { error: "Register the associate's resale account first." };
    if (body.party !== assoc) return { error: "An R2 sale names its associate as the party." };
  }
  if (sale && !(costFor(book, body.product).cost > 0))
    return { error: "This product has no inventory cost yet. Record the lot first." };
  if (body.cover !== undefined && typeof body.cover !== "boolean")
    return { error: "Cover is a choice, never a typed reward figure." };
  const cover = body.cover ? makerCoverPlan(body, book, pending) : null;
  if (body.cover && !cover) return { error: "No reward cover is available for this sale. Read the offer again." };
  if (body.second !== undefined && body.second !== null && body.second !== true
    && (typeof body.second !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(body.second)))
    return { error: "A second order names its booked twin." };
  const booked = stream === "R2" ? POSITION_ENGINE.ownerCode(assoc) + POSITION_ENGINE.BUCKET_SFX : body.party;
  const twin = (book[sale ? "sales" : "purchases"] || []).find((row) =>
    row[sale ? "customer" : "supplier"] === booked && (row.product || "salt") === body.product
    && row.date === body.date && +row.qty === body.qty && +row.total === body.total);
  const second = twin ? twin.rid || true : null;
  if (twin && body.second !== second)
    return { error: "A row with this party, date, units and total is already booked. Confirm a separate order.", twin: { second } };
  if (!twin && body.second != null) return { error: "The booked twin has changed. Read the trade again." };
  const entry = POSITION_ENGINE.tradeEntry({
    at: body.at, product: body.product, direction: sale ? "SELL" : "BUY", party: body.party,
    date: body.date, qty: body.qty, total: body.total, cash: body.cash, movedUnits: body.movedUnits,
    delivery: sale ? body.delivery ?? 0 : 0, freight: sale ? 0 : body.freight ?? 0,
    handover: body.handover ?? null, assoc, stream, downstream, second: body.second ?? null, trip,
    ...(cover ? { more: { coverUnits: cover.units, coverRM: cover.rm }, coverFree: cover.free } : {})
  });
  const roles = [
    [body.party, partyKinds],
    [assoc, [assocKind]],
    [downstream, ["downstream"]]
  ];
  const required = [...new Set(roles.filter(([value]) => value && !roster.includes(value)).map(([value]) => value))];
  const dependencies = required.map((value) => {
    const kinds = roles.filter(([candidate]) => candidate === value).flatMap(([, allowed]) => allowed);
    const registration = verified.find((item) => item.code === value && kinds.includes(item.kind));
    return registration && { id: registration.id, code: registration.code };
  }).filter(Boolean);
  if (required.length !== dependencies.length)
    return { error: "The party's confirmed Add ID is no longer available. Read the catalog again." };
  if (dependencies.length) entry.registrationDependencies = dependencies;
  return proposed(entry, book);
}

/** The Workbench's extra books: validate all before queueing any; carriage belongs to the first row alone. */
export function makerTradeBatch(operation, body, book, pending = [], registrations = []) {
  if (!object(body)) return { error: "Unsupported trade input fields." };
  const { extras, ...first } = body;
  if (extras === undefined) return makerTradeEntry(operation, first, book, null, pending, registrations);
  if (!timestamp(first.at) || Math.abs(Date.parse(first.at)) > 8.64e15 - 20)
    return { error: "A trade needs its canonical request timestamp." };
  if (!Array.isArray(extras) || !extras.length || extras.length > 19)
    return { error: "Choose one or more extra books, at most one row per book." };
  const products = [first.product];
  const inputs = [first];
  const start = Date.parse(first.at);
  for (const [i, extra] of extras.entries()) {
    if (!object(extra) || Object.keys(extra).some((key) =>
      !["product", "qty", "total", "cash", "movedUnits", "second", "cover"].includes(key)))
      return { error: "An extra book carries only its book, units, goods, cash, movement and booked-twin confirmation." };
    if (products.includes(extra.product)) return { error: "Choose each book once." };
    products.push(extra.product);
    if (!Number.isFinite(start + i + 1)) return { error: "A trade needs its canonical request timestamp." };
    const r2 = first.stream === "R2";
    inputs.push({
      at: new Date(start + i + 1).toISOString(), product: extra.product, party: first.party, date: first.date,
      qty: extra.qty, total: extra.total, cash: extra.cash, movedUnits: extra.movedUnits,
      handover: first.handover ?? null, [operation === "sale" ? "delivery" : "freight"]: 0,
      ...(extra.cover === undefined ? {} : { cover: extra.cover }),
      ...(r2 ? { assoc: first.assoc, stream: "R2", downstream: first.downstream ?? null } : {}),
      ...(extra.second == null ? {} : { second: extra.second })
    });
  }
  const trip = operation === "sale" && first.delivery > 0.005 ? "t" + start : null;
  const entries = [], drafts = [];
  for (const [i, input] of inputs.entries()) {
    const made = makerTradeEntry(operation, input, book, trip, pending.concat(entries), registrations);
    if (made.error) return { ...made, ...(made.twin ? { twin: { ...made.twin, index: i } } : {}) };
    entries.push(made.entry); drafts.push(made.draft);
  }
  const fault = trip && POSITION_ENGINE.tripFault(drafts.map((draft) => draft.row));
  return fault ? { error: fault } : { entries, drafts, trip };
}

/** An input already queued or waiting under Approve with the same content (a double tap, or a second device) is refused;
    the same request moment with the same content is one request retried, and passes. */
function queuedTwinCheck(entry, queue, same, words) {
  const entries = queue || [];
  const sameStamp = entries.find((queued) => queued && queued.at === entry.at);
  if (sameStamp) {
    if (sameStamp.raw === entry.raw && JSON.stringify(sameStamp.payload) === JSON.stringify(entry.payload))
      return { retry: true, at: sameStamp.at };
    return { error: "This request timestamp already carries another entry. Read its draft instead.",
      queuedTwin: { at: sameStamp.at } };
  }
  const twin = entries.find((queued) => queued && queued.payload && same(queued.payload));
  return twin ? { error: words, queuedTwin: { at: twin.at } } : {};
}

/** A gift with the same party, book, date and units, queued or waiting under Approve. */
export function makerQueuedGiftCheck(entry, queue) {
  const p = entry.payload;
  return queuedTwinCheck(entry, queue, (q) => q.mode === "gift" && q.party === p.party && q.product === p.product
    && q.date === p.date && +q.qty === +p.qty, "The same gift is already queued. Read its draft instead.");
}

export function makerQueuedTradeCheck(entry, queue) {
  const p = entry.payload;
  return queuedTwinCheck(entry, queue, (q) => q.mode === "new" && q.direction === p.direction
    && (q.product || "salt") === p.product && q.party === p.party && q.date === p.date
    && +q.qty === p.qty && +q.total === p.total, "The same order is already queued. Read its draft instead.");
}

/** A loan with the same party, direction, book, amount and date (units or ringgit), queued or waiting under Approve. */
export function makerQueuedLoanCheck(entry, queue) {
  const p = entry.payload;
  return queuedTwinCheck(entry, queue, (q) => q.mode === "loan" && q.party === p.party && q.direction === p.direction
    && q.date === p.date && (q.product || null) === (p.product || null)
    && +q.qty === +p.qty && +q.total === +p.total, "The same loan is already queued. Read its draft instead.");
}

export function makerQueuedTradeFault(entry, queue) {
  return makerQueuedTradeCheck(entry, queue).error || "";
}

/** What the Desk's Tiers card shows beside each customer and level-named book: the level held, the proposal (a level or small, mid and
    big bands) and the late-payer offer one level down. Read from the snapshot; it moves nothing and prices nothing. */
function tierCards(book, roster, products) {
  const tiered = products.filter((item) => item.tiered).map((item) => item.product);
  const names = (book.pricing && book.pricing.tierNames) || [];
  const proposals = object(book.pricing && book.pricing.tierOf) ? book.pricing.tierOf : {};
  const late = object(book.pricing && book.pricing.lateOffers) ? book.pricing.lateOffers : {};
  const held = object(book.state.TIER_OF) ? book.state.TIER_OF : {};
  const shape = (level) => PRICING_ENGINE.levelShapeOk(level, names) ? level : null;
  const cards = [];
  for (const id of roster.filter((value) => !POSITION_ENGINE.isBucket(value))) {
    for (const product of tiered) {
      const own = shape((object(held[id]) ? held[id] : {})[product]);
      const proposed = own ? null : shape((object(proposals[id]) ? proposals[id] : {})[product]);
      const offer = object(late[id]) && object(late[id].down) && typeof late[id].down[product] === "string" && names.includes(late[id].down[product])
        ? { level: late[id].down[product], why: typeof late[id].why === "string" ? late[id].why.slice(0, 160) : "" } : null;
      if (own || proposed || offer) cards.push({ code: id, product, held: own, proposed, late: offer });
    }
  }
  return cards;
}

function driftCustomerCode(id) {
  return typeof id === "string" && !id.startsWith("S") && !POSITION_ENGINE.isBucket(id);
}

/** The held override or effective record drift the Desk's drift card reads; no pricing is computed here. */
function driftCards(book, roster, products) {
  const driftProducts = products.filter((item) => item.drift).map((item) => item.product);
  const held = object(book.state.TIER_OF) ? book.state.TIER_OF : {};
  const cards = [];
  for (const id of roster.filter(driftCustomerCode)) {
    for (const product of driftProducts) {
      const set = object(held[id]) && Object.hasOwn(held[id], product)
        && PRICING_ENGINE.driftOk(held[id][product]);
      const drift = book.pricing.byProduct[product].drift;
      const current = object(drift) && PRICING_ENGINE.driftOk(drift[id]) ? drift[id] : null;
      cards.push({ code: id, product, held: !!set, value: set ? held[id][product] : null, current });
    }
  }
  return cards;
}

function rewardFree(book, code, product, pending) {
  const account = POSITION_ENGINE.rewardAccount(book, code, product);
  const resource = "reward:" + product + ":" + code;
  const reserved = pending.reduce((sum, entry) => {
    const claim = POSITION_ENGINE.inputResource(entry, book);
    return claim?.resource === resource ? sum + claim.amount : sum;
  }, 0);
  return { ...account, free: +Math.max(0, (account.held || 0) - reserved).toFixed(2) };
}

export function makerCoverPlan(body, book, pending = []) {
  if (body.product !== "salt" || body.stream === "R2" || !(body.qty > 0)
    || !code(body.party, book.state.roster || [])) return null;
  const reward = rewardFree(book, body.party, body.product, pending.filter((entry) => entry.at !== body.at));
  const snapshot = book.pricing?.byProduct?.[body.product], inputs = snapshot?.inputs;
  if (reward.error || reward.associate || !inputs || inputs.policy?.tierRule?.fixed) return null;
  const ask = cardAt(book.pricing, body.party, body.product, body.qty).card;
  return POSITION_ENGINE.coverPlan({ qty: body.qty, free: reward.free, ask, goods: body.total, cost: snapshot.stockCost });
}

/* B1 of #62: what the Workbench shows before Record, read before Send. A read, never a price: COGS is the engine's latestCogs
   (the drafter's cogsFor), the floor is the drafter's floorFor, the history is the drafter's own. A sale gets COGS, the goods,
   the margin over COGS, the floor with a refusal-style line when the goods are under it, and the party's recent prices on
   this book. A purchase is never measured with a seller's ruler: its cost a unit sits against the current COGS, no margin. */
export function makerTradeReading(body, book) {
  const keys = ["direction", "product", "party", "qty", "total", "freight", "date"];
  if (!object(body) || Object.keys(body).some((key) => !keys.includes(key))) return { error: "Unsupported reading fields." };
  if (!["sale", "purchase"].includes(body.direction)) return { error: "Choose sale or purchase." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!active(body.product, book)) return { error: "Choose an active product." };
  if (!(figure(body.qty) && body.qty > 0) || !figure(body.total)) return { error: "Send units and a goods total." };
  if (body.freight !== undefined && body.freight !== null && !figure(body.freight)) return { error: "Send a freight figure." };
  if (body.date !== undefined && body.date !== null && body.date !== "" && !date(body.date)) return { error: "Send a real date in YYYY-MM-DD." };
  const sale = body.direction === "sale", qty = body.qty, goods = POSITION_ENGINE.txGoods({ total: body.total });
  /* a sale is costed at the latest purchase on or before its date, as the drafter does (drafter.js, cogsFor with pay.date) */
  const c = cogsFor(book, body.product, body.date || null);
  const rate = c.cost > 0 ? +c.cost.toFixed(2) : null;
  const cogs = { rate, source: c.basis ? "the latest purchase" : c.source, basis: c.basis || null };
  const price = +(goods / qty).toFixed(2);
  if (!sale) {
    const perUnit = +((goods + (body.freight || 0)) / qty).toFixed(2);
    return { direction: "purchase", product: body.product, qty, goods, cogs,
      purchase: { perUnit, versusCogs: rate == null ? null : +(perUnit - rate).toFixed(2) } };
  }
  const reading = { direction: "sale", product: body.product, qty, goods, price, cogs, margin: null, floor: null, history: null };
  if (rate != null) {
    /* struck on the unrounded rate, as the drafter's row cost and flag 4 are; only the display is rounded */
    reading.margin = { rm: +(goods - Math.round(c.cost * qty * 100) / 100).toFixed(2),
      pct: price > 0 ? +((goods / qty - c.cost) / (goods / qty) * 100).toFixed(4) : null,
      belowCost: qty > 0 && goods / qty < c.cost };
  }
  const fl = floorFor(book, body.product, qty);
  if (fl) {
    const under = goods < fl.floor - 0.005;
    reading.floor = { rm: fl.floor, at: fl.at, exact: fl.exact, under,
      short: under ? +(fl.floor - goods).toFixed(2) : 0,
      warn: under ? "RM " + (+goods.toFixed(2)) + " for the goods is RM " + (+(fl.floor - goods).toFixed(2)) + " under the floor of RM "
        + fl.floor + ", which is COGS times the size and nothing else." : null };
  }
  if (typeof body.party === "string" && code(body.party, book.state.roster || [])) {
    const who = POSITION_ENGINE.ownerCode(body.party), rates = theirRates(book, who, body.product);
    if (rates.length) {
      const mid = rates.length % 2 ? rates[(rates.length - 1) / 2] : (rates[rates.length / 2 - 1] + rates[rates.length / 2]) / 2;
      reading.history = { count: rates.length, median: +mid.toFixed(2), low: +rates[0].toFixed(2), high: +rates[rates.length - 1].toFixed(2),
        offMedianPct: price > 0 && mid > 0 ? +((price - mid) / mid * 100).toFixed(1) : null,
        recent: recentRates(book, who, body.product, 5) };
    }
  }
  return reading;
}

/* 15 Oct 2026 (plan 1, parts 3 and 4): WHAT IS OWED, BOTH WAYS, as Salt Account's Needs you shows it, read off the engine so the Counter computes
   nothing. Money: a sale's txAdvance (goods handed over and not paid for), from txUnpaidSince, due that day plus TERMS.holdDays, and past term
   once that day is behind today in Kuala Lumpur; summed per party, the oldest first. Goods: a sale paid in full (txStat) with units still to
   hand over, the oldest first. Each row carries its ovKey, so the page finds the site order it belongs to. Codes and figures only (rule 2). */
const dayAfter = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
export function owedBothWays(book, today) {
  const E = POSITION_ENGINE, terms = (book.state && book.state.TERMS) || {};
  const hold = typeof terms.holdDays === "number" && Number.isFinite(terms.holdDays) ? terms.holdDays : null;
  if (hold == null) return { today, owedError: "The Desk has no payment term (TERMS.holdDays), so what is owed cannot be read." };
  const money = new Map(), goods = [];
  for (const row of book.sales || []) {
    if (!row || !row.rid || row.cancelled || row.goodwill || !code(row.customer, [row.customer])) continue;
    const rm = +E.txAdvance(row).toFixed(2), since = rm > 0.009 ? E.txUnpaidSince(row) : null;
    const due = since && date(since) && hold != null ? dayAfter(since, hold) : null;
    if (due && due < today) {
      const m = money.get(row.customer) || { party: row.customer, rm: 0, since, due, rows: [] };
      m.rm = +(m.rm + rm).toFixed(2);
      if (since < m.since) { m.since = since; m.due = due; }
      m.rows.push({ rid: row.rid, key: E.ovKey(row), product: row.product || "salt", rm, since, due });
      money.set(row.customer, m);
    }
    const left = +(row.qty - E.txEffDeliv(row)).toFixed(4);
    if (!row.defaulted && left > 0.0001 && E.txStat(row).pay === "Paid")
      goods.push({ party: row.customer, rid: row.rid, key: E.ovKey(row), product: row.product || "salt", units: left, date: row.date || null });
  }
  const byOld = (a, b) => String(a || "9999").localeCompare(String(b || "9999"));
  const owedMoney = [...money.values()].sort((a, b) => byOld(a.since, b.since));
  owedMoney.forEach((m) => m.rows.sort((a, b) => byOld(a.since, b.since)));
  return { today, owedMoney, owedGoods: goods.sort((a, b) => byOld(a.date, b.date)) };
}

/* 16 Oct 2026, PLAN 3 OF docs/plans-counter-admin.html: ORDERS ACROSS SEVERAL BOOKS, Counter Admin's half. CS6-PER's salt, oil and rice
   of 14 Oct were three cards, each handed over and paid on its own. A trip already ties a buyer's rows of one day (one delivery on one
   row, tripFault); what follows reads and writes it for Counter Admin, and the Counter computes no money:
   - makerTrips: each open trip as one card, the head (owed, paid, lines handed in full) and one line a book off the engine's figures
     (rowFigures, the approve card's own reading), and a buyer's same-day rows with no trip that could be one (sameDay);
   - makerTripSplit: one payment for the order split across its lines oldest first by the engine's claimAlloc, every line owing all
     that is left on it (each line's key in `ready`), read before anything is sent;
   - makerTripPay: that split as one Fulfilment a line, refused whole unless the split is the one he read; the Worker then holds each
     share to rowRoom before any is queued (worker.js), so one refused share refuses the batch;
   - makerTripJoin: These are one order, a Correction a row setting one new trip, refused unless the rows make a trip tripFault passes.
   Nothing here reprices a line: a payment moves cash, a join moves the trip id, and the delivery stays on the one row that has it. */
const r2 = (n) => +(+n || 0).toFixed(2);
/* each row as it will stand once the moves waiting on it are approved and folded (`held`: entries queued or drafted, pending or approved and
   not folded), read in the order entered by the approve card's own moveRow, so a second Handover all or payment never counts a move twice.
   A move names its row as rowRoom reads it: by rid, else by the order key it was queued under (a claim against the account) */
const heldMoves = (row, held) => (held || []).filter((e) => e && e.payload && e.payload.mode === "amend" && e.payload.direction !== "BUY"
  && (e.payload.rid ? e.payload.rid === row.rid : e.payload.orderKey === POSITION_ENGINE.ovKey(row)))
  .sort((a, b) => String(a.at).localeCompare(String(b.at)));
const standing = (rows, held) => rows.map((row) => {
  const moves = heldMoves(row, held);
  let s = row;
  for (const e of moves) s = moveRow(s, { entry: e });
  return { row: s, waiting: moves.length };
});
const tripLine = ({ row, waiting }) => {
  const f = rowFigures(row);
  return { rid: row.rid, product: row.product || "salt", qty: f.qty, total: f.total, delivery: f.delivery, paid: f.paid, owed: f.owed,
    handed: f.handed, left: +Math.max(0, f.qty - f.handed).toFixed(3), waiting,
    open: POSITION_ENGINE.openable(POSITION_ENGINE.ledgerRow(row, "S", "salt")) };
};
const tripCard = (rows, held) => {
  const lines = standing(rows, held).map(tripLine);
  return { party: rows[0].customer, date: rows[0].date || null,
    owed: r2(lines.reduce((a, l) => a + l.owed, 0)), paid: r2(lines.reduce((a, l) => a + l.paid, 0)),
    handedLines: lines.filter((l) => l.left <= 0.0005).length, waiting: lines.reduce((a, l) => a + l.waiting, 0), lines };
};
const joiningRids = (held) => new Set((held || []).filter((e) => e && e.payload && e.payload.mode === "amend"
  && e.payload.kind === "Correction" && e.payload.fields && e.payload.fields.trip != null).map((e) => e.payload.rid));
export function makerTrips(book, held = []) {
  const E = POSITION_ENGINE, byTrip = new Map(), byDay = new Map();
  const open = (s) => E.openable(E.ledgerRow(s, "S", "salt"));
  for (const s of (book && book.sales) || []) {
    if (!s || !s.rid || s.cancelled || !code(s.customer, [s.customer])) continue;
    if (s.trip) { if (!byTrip.has(s.trip)) byTrip.set(s.trip, []); byTrip.get(s.trip).push(s); continue; }
    if (s.goodwill || s.defaulted || !date(s.date)) continue;
    const k = s.customer + "|" + s.date;
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(s);
  }
  const joining = joiningRids(held);
  /* a buyer's day that already has one open trip offers its untripped rows as joining that trip (a join that landed in part) */
  const tripOfDay = new Map();
  for (const [trip, rows] of byTrip) { if (!E.TRIP_RE.test(trip)) continue; const k = rows[0].customer + "|" + rows[0].date; tripOfDay.set(k, tripOfDay.has(k) ? null : trip); }
  const withTrip = (rows) => { const t = tripOfDay.get(rows[0].customer + "|" + rows[0].date); return t ? byTrip.get(t).filter((s) => !s.cancelled).concat(rows) : rows; };
  const byDate = (a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")) || String(a.party).localeCompare(String(b.party));
  const trips = [...byTrip].filter(([trip, rows]) => E.TRIP_RE.test(trip) && rows.length > 1 && rows.some(open) && !E.tripFault(rows))
    .map(([trip, rows]) => ({ trip, ...tripCard(rows, held) })).sort(byDate);
  const sameDay = [...byDay.values()].map(withTrip).filter((rows) => rows.length > 1 && rows.some(open)
    && new Set(rows.map((s) => s.product || "salt")).size === rows.length
    && rows.filter((s) => +s.delivery > 0.005).length <= 1 && !rows.some((s) => joining.has(s.rid)))
    .map((rows) => ({ rids: rows.map((s) => s.rid), ...tripCard(rows, held) })).sort(byDate);
  return { trips, sameDay };
}
const tripRowsOf = (book, trip) => ((book && book.sales) || []).filter((s) => s && s.rid && s.trip === trip && !s.cancelled);
export function makerTripSplit(body, book, held = []) {
  const E = POSITION_ENGINE;
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!object(body) || typeof body.trip !== "string" || !E.TRIP_RE.test(body.trip)
    || !figure(body.amount) || !(body.amount > 0.004) || r2(body.amount) !== body.amount)
    return { error: "Choose an order of several books and an amount above zero, to the sen." };
  const booked = tripRowsOf(book, body.trip);
  if (booked.length < 2) return { error: "That order of several books is not on the book. Read the orders again." };
  const fault = E.tripFault(booked);
  if (fault) return { error: "That order does not hold together: " + fault + "." };
  /* the rows as they will stand, so money already waiting under Approve is not asked for twice; the allocator is the engine's */
  const rows = standing(booked, held).map((x) => x.row);
  const alloc = E.claimAlloc(rows, rows[0].customer, body.amount, rows.map(E.ovKey));
  const owed = r2(alloc.rows.reduce((a, s) => a + s.owed, 0));
  if (alloc.left > 0.004) return { error: "RM " + body.amount.toFixed(2) + " is more than this order still owes (RM " + owed.toFixed(2) + ")." };
  return { trip: body.trip, party: rows[0].customer, amount: body.amount,
    shares: alloc.rows.map((a) => ({ rid: a.rid, product: (rows.find((s) => s.rid === a.rid) || {}).product || "salt", rm: a.rm, owed: a.owed })) };
}
export function makerTripPay(body, book, held = []) {
  if (!exact(body, ["at", "trip", "date", "amount", "shares"]) || !timestamp(body.at) || !date(body.date))
    return { error: "A payment for the order carries its moment, the order, the day, the amount and the split you read." };
  const split = makerTripSplit({ trip: body.trip, amount: body.amount }, book, held);
  if (split.error) return split;
  const seen = Array.isArray(body.shares) ? body.shares.map((s) => [s && s.rid, s && s.rm]) : null;
  if (!seen || JSON.stringify(seen) !== JSON.stringify(split.shares.map((s) => [s.rid, s.rm])))
    return { error: "The split changed since you read it. Read it again before you send.", stale: true };
  const rows = tripRowsOf(book, body.trip), start = Date.parse(body.at), entries = [], drafts = [];
  for (const [i, share] of split.shares.entries()) {
    const row = rows.find((s) => s.rid === share.rid);
    const made = proposed(POSITION_ENGINE.ledgerAmendmentEntry({ at: new Date(start + i).toISOString(), row, direction: "SELL",
      kind: "Fulfilment", date: body.date, cash: share.rm, movedUnits: 0 }), book);
    if (made.error) return { error: share.rid + ": " + made.error };
    entries.push(made.entry); drafts.push(made.draft);
  }
  return { entries, drafts, shares: split.shares, amendBatch: true };
}
export function makerTripJoin(body, book) {
  const E = POSITION_ENGINE;
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!exact(body, ["at", "date", "rids"]) || !timestamp(body.at) || !date(body.date) || !Array.isArray(body.rids)
    || body.rids.length < 2 || body.rids.length > 20 || new Set(body.rids).size !== body.rids.length
    || body.rids.some((rid) => typeof rid !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(rid)))
    return { error: "Choose two or more rows of one buyer and one day." };
  const rows = [];
  for (const rid of body.rids) {
    const found = findRow(book, rid);
    if (found.err) return { error: found.err };
    if (found.collection !== "sales" || found.row.cancelled) return { error: rid + " is not an open sale." };
    rows.push(found.row);
  }
  if (new Set(rows.map((s) => s.customer)).size > 1 || new Set(rows.map((s) => s.date || null)).size > 1 || !rows[0].date)
    return { error: "These rows are not one buyer's on one day." };
  /* Fable's review of 16 Oct 2026: a join that landed in part leaves rows on a trip and one beside it; naming them together extends that trip,
     so the order can always be made whole. Rows on two trips are never one order. */
  const on = [...new Set(rows.filter((s) => s.trip).map((s) => s.trip))];
  if (on.length > 1) return { error: "These rows are on two orders of several books already." };
  const joining = rows.filter((s) => !s.trip);
  if (!joining.length) return { error: "These rows are one order already." };
  const trip = on[0] || "t" + Date.parse(body.at);
  if (!on.length && tripRowsOf(book, trip).length) return { error: "That moment already names an order of several books. Start again." };
  const fault = E.tripFault(tripRowsOf(book, trip).filter((s) => !rows.includes(s)).concat(rows.map((s) => ({ ...s, trip }))));
  if (fault) return { error: "These rows cannot be one order: " + fault + "." };
  const start = Date.parse(body.at), entries = [], drafts = [];
  for (const [i, row] of joining.entries()) {
    const made = proposed(E.ledgerAmendmentEntry({ at: new Date(start + i).toISOString(), row, direction: "SELL",
      kind: "Correction", date: body.date, fields: { trip } }), book);
    if (made.error) return { error: row.rid + ": " + made.error };
    entries.push(made.entry); drafts.push(made.draft);
  }
  return { entries, drafts, trip, amendBatch: true };
}

/* 16 Oct 2026, PLAN 4 OF docs/plans-counter-admin.html: EASY REVERT, the Desk's half (his answers: the newest move only; a site order's
   customer is told by a banner). makerUndo reads one sale's History, its moves newest first off the engine's rowMoves, and the newest
   move's undo off the engine's undoOf: the figures it sets, Now and After off the approve card's own reading (rowFigures), and what he must
   know (undoNotes: a refund the undo would strand, a handover undone after a count). Nothing is undone while anything is on its way to the
   row (Fable's review: an undo sets absolute figures, and the checks on money only measure it going up), nor while the site order the row
   belongs to has a move the book has not heard. The road it takes: a restatement of a site order's terms goes through restateOrder, so the
   order keeps its row; every other undo is a Correction through ledger-amend, the site order following by the fix event once it folds.
   ctx: { held: the moves waiting (makerHeldMoves), onWay: money on its way to the row (rowRoom's `on`), order: the site order whose row
   this is, or null, siteError: the site's orders could not be read }. */
const UNDO_TERMS = ["qty", "total", "delivery", "cost", "unpriced"];
export function makerUndo(book, rid, ctx = {}) {
  const E = POSITION_ENGINE;
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (typeof rid !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(rid)) return { error: "Choose a row." };
  const found = findRow(book, rid);
  if (found.err) return { error: found.err };
  if (found.collection !== "sales") return { error: "A lot's moves are undone by hand." };
  const row = found.row, order = ctx.order || null;
  const moves = E.rowMoves(row).reverse().map((m) => ({ i: m.i, date: m.date, kind: m.kind, cash: m.cash, kg: m.kg, undone: m.undone,
    changed: m.was ? Object.keys(m.was) : null }));
  const out = { rid: row.rid, party: row.customer, product: row.product || "salt", handover: row.handover || null, moves, undo: null,
    order: order ? order.id : null };
  const u = E.undoOf(row);
  if (u.fault) return { ...out, why: u.fault };
  const after = Object.assign({}, row);
  for (const [k, v] of Object.entries(u.fields)) { if (v === null) delete after[k]; else after[k] = v; }
  const restate = !!order && u.kind === "terms";
  const blocked = heldMoves(row, ctx.held).length ? "A move on this row waits under Approve or on its way to the Desk. Decide it first."
    : (+ctx.onWay || 0) > 0.004 ? "Money is already on its way to this row. Decide it before undoing a move."
      : ctx.siteError ? "The site's orders could not be read, so nothing is undone until they can be."
        : order && (order.payments || []).some((p) => p && p.claim === "waiting") ? "A payment they say they sent waits on the order. Answer it first."
          : order && ((+order.paid || 0) - (+((order.queued || {}).paid) || 0) > 0.004 || Math.abs((+order.moved || 0) - (+((order.queued || {}).moved) || 0)) > 0.0004)
            ? "The order has a move on the site the book has not heard yet. Wait for it to land."
            : restate && Object.keys(u.fields).some((k) => !UNDO_TERMS.includes(k)) ? "That change on a site order is undone by hand."
              : restate && !["acknowledged", "ready", "done"].includes(order.status) ? "The order is " + order.status + ", so its terms are not changed." : null;
  out.undo = { i: u.i, kind: u.kind, date: u.move.date, cash: u.move.cash, kg: u.move.kg, fields: u.fields,
    now: rowFigures(row), after: rowFigures(after), notes: undoNotes(book, row, u), route: restate ? "restate" : "ledger",
    ...(restate ? { restate: { qty: +after.qty, total: +(+after.total).toFixed(2), delivery: +(+(after.delivery || 0)).toFixed(2) } } : {}),
    ...(blocked ? { blocked } : {}) };
  return out;
}

export function makerInputCatalog(book, hush = {}, pending = [], registrations = [], today = mytDay(new Date().toISOString())) {
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  const bookRoster = (book.state.roster || []).filter((value) => code(value, book.state.roster || []));
  const verified = registrations.filter((item) => item && code(item.code, [item.code])
    && ["customer", "supplier", "reseller", "referral", "downstream", "bucket"].includes(item.kind)
    && ["pending", "approved"].includes(item.status));
  const parties = [...new Set(bookRoster.concat(
    verified.filter((item) => item.kind !== "bucket").map((item) => item.code)))];
  const products = Object.keys(book.state.PRODUCTS || {}).filter((product) => active(product, book)).map((product) => {
    const snapshot = book.pricing && book.pricing.byProduct && book.pricing.byProduct[product];
    const rule = snapshot && snapshot.inputs && snapshot.inputs.policy && snapshot.inputs.policy.tierRule;
    const cost = costFor(book, product).cost;
    const driftPresets = rule && rule.drift && object(rule.presets)
      ? Object.entries(rule.presets).filter(([name, value]) => typeof name === "string" && name
        && PRICING_ENGINE.driftOk(value)).map(([name, value]) => ({ name, value }))
      : [];
    return { product, tiered: !!rule && !rule.fixed && !rule.drift, fixed: !!(rule && rule.fixed), drift: !!(rule && rule.drift),
      ...(rule && rule.drift ? { driftPresets } : {}), saleReady: cost > 0, purchaseReady: cost !== null };
  });
  return {
    version: book.version, products, parties, ...owedBothWays(book, today),
    rewards: bookRoster.filter((id) => !POSITION_ENGINE.isBucket(id)).flatMap((id) => {
      const reward = rewardFree(book, id, "salt", pending);
      if (reward.earned == null || !(reward.earned || reward.applied)) return [];
      const free = reward.associate ? reward.free : reward.free >= 1 - 1e-9 ? 1 : 0;
      const sale = book.sales.filter((row) => row.customer === id && (row.product || "salt") === "salt"
        && POSITION_ENGINE.txAdvance(row) > 0.009).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))[0];
      return [{ code: id, held: reward.held, free: reward.free, associate: reward.associate, departed: !!reward.departed,
        action: !reward.error && free > 0.009 ? sale ? "Offset" : "Redeem" : null }];
    }),
    placed: Object.fromEntries(Object.entries(book.state.PLACED || {})
      .filter(([id, point]) => bookRoster.includes(id) && Array.isArray(point) && safePoint(point))),
    associates: [...new Set(associateCodes(book).concat(verified.filter((item) =>
      item.kind === "reseller" || item.kind === "referral")
      .map((item) => item.code)))].filter((value) => code(value, parties) && !POSITION_ENGINE.isBucket(value))
      .map((value) => ({ code: value, resaleReady: bookRoster.includes(value + POSITION_ENGINE.BUCKET_SFX)
        || verified.some((item) => item.code === value && POSITION_ENGINE.ADDID_APPOINTS[item.kind]) })),
    tierCustomers: bookRoster.filter((value) => !POSITION_ENGINE.isBucket(value)),
    driftCustomers: bookRoster.filter(driftCustomerCode),
    houseBoards: Object.fromEntries(products.map((item) => [item.product, { sizes: houseRungs(book, item.product),
      hidden: ((book.state.PRICE_SET || {})[item.product] || {}).hide || [] }])),
    tips: ((book.pricing && book.pricing.obs) || []).filter((tip) => tip && typeof tip.id === "string" && typeof tip.title === "string")
      .map((tip) => ({ id: tip.id, sev: tip.sev, title: tip.title, hush: Object.hasOwn(hush, tip.id) ? hush[tip.id] : undefined })),
    tierNames: ((book.pricing && book.pricing.tierNames) || []).filter((value) => typeof value === "string"),
    tierCards: tierCards(book, bookRoster, products),
    driftCards: driftCards(book, bookRoster, products),
    partners: (book.state.partners || []).filter((value) => code(value, bookRoster)),
    partnerWaiting: (pending || []).filter((entry) => entry && entry.payload && entry.payload.mode === "partner")
      .map((entry) => entry.payload.code),
    handovers: POSITION_ENGINE.HANDOVER.slice(), streams: ["R2", "R3"],
    correctionFields: POSITION_ENGINE.CORRECTABLE.filter((field) => !DESK_ONLY_FIELDS.includes(field) && !JOIN_ONLY_FIELDS.includes(field))
      .map((field) => ({ field, required: POSITION_ENGINE.CORRECT_REQUIRED.includes(field),
        kind: field === "orderCode" ? "text" : POSITION_ENGINE.CORRECT_BOOL.includes(field) ? "boolean"
          : POSITION_ENGINE.CORRECT_DATE.includes(field) ? "date"
            : POSITION_ENGINE.CORRECT_CODE.includes(field) ? "code"
              : field === "product" ? "product" : field === "stream" ? "stream"
                : field === "handover" ? "handover" : "number" })),
    rows: ["sales", "purchases"].flatMap((collection) => (book[collection] || [])
      .filter((row) => row && row.rid && !row.cancelled).map((row) => {
        const sale = collection === "sales";
        const open = POSITION_ENGINE.openable(POSITION_ENGINE.ledgerRow(row, sale ? "S" : "B", "salt"));
        const movedUnits = sale ? POSITION_ENGINE.txEffDeliv(row) : POSITION_ENGINE.poRecvUnits(row);
        const cancelled = { ...row, cancelled: true };
        const after = sale ? POSITION_ENGINE.txStat(cancelled) : POSITION_ENGINE.poStat(cancelled);
        const refund = sale ? POSITION_ENGINE.refundOnCancel([], cancelled) : null;
        return { rid: row.rid, direction: sale ? "SELL" : "BUY", party: row[sale ? "customer" : "supplier"],
          ...(row.defaulted ? { defaulted: true } : {}),
          product: row.product || "salt", date: row.date || null, qty: row.qty, total: row.total,
          cash: sale ? POSITION_ENGINE.txPaid(row) : POSITION_ENGINE.poCash(row),
          movedUnits, open,
          cancellation: open && !row.defaulted && movedUnits <= 0.009
            ? { pay: after.pay, deliv: after.deliv, order: after.order, refundRM: refund ? refund.amount : null } : null };
      })),
    revivable: ["sales", "purchases"].flatMap((collection) => (book[collection] || [])
      .filter((row) => row && row.rid && row.cancelled).map((row) => {
        const sale = collection === "sales";
        return { rid: row.rid, direction: sale ? "SELL" : "BUY", party: row[sale ? "customer" : "supplier"],
          product: row.product || "salt", date: row.date || null, cancelledOn: row.cancelledOn || null, qty: row.qty, total: row.total,
          paid: sale ? POSITION_ENGINE.txPaid(row) : POSITION_ENGINE.poCash(row),
          movedUnits: sale ? POSITION_ENGINE.txEffDeliv(row) : POSITION_ENGINE.poRecvUnits(row) };
      })),
    loans: (book.state.loans || []).filter((row) => row && row.status !== "settled").map((row) => {
      const cash = row.form === "cash";
      const paid = (row.repaid || []).reduce((sum, part) => sum + (+((cash ? part.rm : part.kg)) || 0), 0);
      return { rid: row.rid, party: row.party, date: row.date, product: row.product || "salt",
        form: cash ? "cash" : "salt", value: +(cash ? +row.valueRM : +row.valueKg).toFixed(2) || 0, repaid: +paid.toFixed(2),
        remaining: +Math.max(0, (cash ? +row.valueRM : +row.valueKg) - paid).toFixed(2),
        direction: row.direction };
    })
  };
}


/** The parties the Desk's associateIds names: the bench, R2 owners, referrers, introducers and the R0 reseller, less a standing ban. */
function associateCodes(book) {
  const state = book.state, ids = new Set(state.associates || []);
  for (const sale of book.sales || []) {
    if (sale && sale.rev === "R2") ids.add(POSITION_ENGINE.ownerCode(sale.customer));
    if (sale && sale.ref) ids.add(sale.ref);
  }
  for (const entry of state.INTRODUCTIONS || []) if (entry && entry.by) ids.add(entry.by);
  if (state.R0_NETWORK && state.R0_NETWORK.reseller) ids.add(state.R0_NETWORK.reseller);
  const banned = ((state.PEOPLE || {}).banned || []).filter((row) => row && !row.lifted).map((row) => row.id);
  return [...ids].filter((id) => typeof id === "string" && !banned.includes(id)).sort();
}

/** Counter Maker A2: what the Desk's autoOffsets would propose, from the mirror alone. A departed holder has no reward account
    (rewardAccount refuses them), so nothing here offsets them. `held` is the three lists the Desk's own `offered` reads, the same
    way: `queued` (a Correction naming the rid), `pending` (a Correction naming the rid or the row's key) and `refused` (any entry
    naming the rid, whatever it was). */
export function makerOffsetOffers(book, held = {}) {
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  const pay = (entry) => entry && entry.payload || {};
  const offered = (sale) => (held.queued || []).some((e) => pay(e).mode === "amend" && pay(e).kind === "Correction" && pay(e).rid === sale.rid)
    || (held.pending || []).some((e) => pay(e).kind === "Correction"
      && (pay(e).rid === sale.rid || pay(e).orderKey === POSITION_ENGINE.ovKey(sale)))
    || (held.refused || []).some((e) => pay(e).rid === sale.rid);
  const offers = [];
  for (const code of associateCodes(book)) {
    const reward = POSITION_ENGINE.rewardAccount(book, code);
    if (reward.error || !(reward.held > 0.009)) continue;
    const sale = (book.sales || []).filter((row) => row && row.customer === code && (row.product || "salt") === "salt"
      && POSITION_ENGINE.txAdvance(row) > 0.009)
      .sort((a, b) => !a.date ? (b.date ? 1 : 0) : !b.date ? -1 : a.date < b.date ? -1 : a.date > b.date ? 1 : 0)[0];
    if (!sale || !sale.rid || offered(sale)) continue;
    const { offUnits: units, offRM: rm } = POSITION_ENGINE.offsetFor(sale, reward.held, 1);
    if (units > 0.009) offers.push({ code, rid: sale.rid, saleDate: sale.date || null, units, rm,
      owed: +POSITION_ENGINE.txAdvance(sale).toFixed(2), held: reward.held });
  }
  return { offers };
}

/** Counter Admin's mini ledger: the customer sales orders of every book, read off the mirror by the engine's own rules (txStat, txOwed,
    txPaid, txAdvance, txEffDeliv) and never a status or pricing rule of its own. Open is every txStat order word that begins Open (Open,
    Advance and Deferred), Pending is the word Pending, and the latest are by date then order id, newest first, a row with no date last. */
export function makerLedgerMini(book, recent = 20) {
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  const P = POSITION_ENGINE, two = (n) => +(+n || 0).toFixed(2);
  const rows = (book.sales || []).filter((s) => s && s.rid && s.customer).map((s) => {
    const stat = P.txStat(s);
    return { rid: s.rid, date: s.date || null, customer: s.customer, product: s.product || "salt", qty: two(s.qty), total: two(s.total),
      paid: two(P.txPaid(s)), owed: s.cancelled || s.defaulted ? 0 : two(Math.max(0, P.txOwed(s) - P.txPaid(s))), advance: two(P.txAdvance(s)),
      moved: +(+P.txEffDeliv(s) || 0).toFixed(3), stage: stat.order, pay: stat.pay, deliv: stat.deliv };
  });
  const newest = (a, b) => (a.date === b.date ? 0 : !a.date ? 1 : !b.date ? -1 : a.date < b.date ? 1 : -1)
    || b.rid.localeCompare(a.rid, "en", { numeric: true });
  rows.sort(newest);
  return { open: rows.filter((r) => r.stage.startsWith("Open")), pending: rows.filter((r) => r.stage === "Pending"),
    recent: rows.slice(0, recent), orders: rows.length };
}

/** One owner tap on one offer. The figures are the mirror's, never the request's: the body names only the holder, the row and a date. */
export function makerOffset(body, book, held) {
  if (!exact(body, ["at", "code", "rid", "date"]) || !timestamp(body.at) || !date(body.date)
    || typeof body.rid !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(body.rid))
    return { error: "An offset carries only its timestamp, party code, order row and date." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!realCode(body.code, book.state.roster || []) || POSITION_ENGINE.isBucket(body.code))
    return { error: "Choose an associate on the roster." };
  const offer = (makerOffsetOffers(book, held).offers || []).find((item) => item.code === body.code && item.rid === body.rid);
  if (!offer) return { error: "That offset is not on offer: the reward is spent or held, the order is settled, or it already has a correction waiting." };
  const sale = book.sales.find((row) => row && row.rid === offer.rid);
  return proposed(POSITION_ENGINE.rebateOffsetEntry({ at: body.at, party: body.code, date: body.date, sale,
    units: offer.units, rm: offer.rm, auto: true,
    raw: "Automatic offset: " + body.code + " reward, " + offer.units + " unit, against the " + (sale.date || "undated")
      + " order, RM" + offer.rm + " settled in kind" }), book);
}

/** One customer, one product; null clears its held level or drift through the same tierset road. */
export function makerTierSet(body, book) {
  if (!object(body) || Object.keys(body).some((key) => !["at", "code", "product", "tier"].includes(key)))
    return { error: "A tier input carries only its timestamp, code, product and tier." };
  if (!timestamp(body.at)) return { error: "A tier input needs its canonical request timestamp." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!active(body.product, book)) return { error: "Choose an active product." };
  if (!code(body.code, book.state.roster || []) || POSITION_ENGINE.isBucket(body.code))
    return { error: "Choose a customer on the roster, not a resale account." };
  const snapshot = book.pricing && book.pricing.byProduct && book.pricing.byProduct[body.product];
  const rule = snapshot && snapshot.inputs && snapshot.inputs.policy && snapshot.inputs.policy.tierRule;
  if (!rule || rule.fixed) return { error: "This product has no customer tiers." };
  if (rule.drift) {
    if (!driftCustomerCode(body.code)) return { error: "A supplier cannot hold customer drift." };
    if (body.tier !== null && !PRICING_ENGINE.driftOk(body.tier))
      return { error: "Choose a drift from -1 to +1, or clear it." };
  } else {
    const names = (book.pricing && book.pricing.tierNames) || [];
    if (body.tier !== null && !PRICING_ENGINE.levelShapeOk(body.tier, names))
      return { error: "Choose a tier or a set of small, mid and big tiers." };
  }
  return proposed(POSITION_ENGINE.tierSetEntry({
    at: body.at, tiers: { [body.code]: { [body.product]: body.tier } }
  }), book);
}

/** Make partner, the Desk's partnerMake: a name-free `partner` entry for a customer already on the roster, on a drift book only.
    The raw line is the Desk's word for word; the drafter and the fold are the Desk's own. */
export function makerPartner(body, book, pending = []) {
  if (!object(body) || Object.keys(body).some((key) => !["at", "code"].includes(key)))
    return { error: "A partner input carries only its timestamp and code." };
  if (!timestamp(body.at)) return { error: "A partner input needs its canonical request timestamp." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  const driftBook = Object.keys(book.state.PRODUCTS || {}).some((product) => {
    if (!active(product, book)) return false;
    const rule = book.pricing && book.pricing.byProduct && book.pricing.byProduct[product]
      && book.pricing.byProduct[product].inputs && book.pricing.byProduct[product].inputs.policy
      && book.pricing.byProduct[product].inputs.policy.tierRule;
    return !!rule && !!rule.drift && !rule.fixed;
  });
  if (!driftBook) return { error: "A partner is made on a book with price drift." };
  if (!code(body.code, book.state.roster || []) || POSITION_ENGINE.isBucket(body.code))
    return { error: "Choose a customer on the roster, not a resale account." };
  if ((book.state.partners || []).includes(body.code)) return { error: body.code + " is already a partner." };
  if (pending.some((entry) => entry && entry.at !== body.at && entry.payload && entry.payload.mode === "partner" && entry.payload.code === body.code))
    return { error: body.code + " is already waiting under Approve as a partner.", twin: true };
  const bucket = POSITION_ENGINE.appointBucket("reseller", body.code);
  return proposed(POSITION_ENGINE.partnerEntry({ at: body.at, code: body.code,
    raw: "Make " + body.code + " a partner: pays cost, keeps every associate property"
      + ((book.state.associates || []).includes(body.code) ? "" : ", appointed an associate on the R2 stream with " + bucket + " as their resell account") }), book);
}

/* What the Desk's tierQueued reads: tiers waiting in a queued tierset or an Add ID, code to product to level. */
function waitingTiers(entries, at) {
  const waiting = {};
  for (const queued of entries || []) {
    const q = queued && queued.payload;
    if (!q || queued.at === at) continue;
    const tiers = q.mode === "tierset" ? q.tiers : q.mode === "addid" && q.tiers ? { [q.code]: q.tiers } : null;
    for (const [id, set] of Object.entries(object(tiers) ? tiers : {}))
      waiting[id] = Object.assign(waiting[id] || {}, set);
  }
  return waiting;
}
const levelWords = (v) => v == null ? "not set" : typeof v === "string" ? v
  : ["small", "mid", "big"].filter((k) => v[k]).map((k) => k + " " + v[k]).join(", ");

/** The Desk's tierAcceptAll over the snapshot: the proposals its own ruleProposal drew (PRICING.tierOf, held or proposed),
    less the tiers held and those already waiting. Nothing is priced here. */
export function makerTierAcceptAll(body, book, queued) {
  if (!exact(body, ["at"])) return { error: "Accepting proposals carries only its timestamp." };
  if (!timestamp(body.at)) return { error: "A tier input needs its canonical request timestamp." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  const names = (book.pricing && book.pricing.tierNames) || [], proposals = (book.pricing && book.pricing.tierOf) || {};
  const held = book.state.TIER_OF || {}, waiting = waitingTiers(queued, body.at), roster = book.state.roster || [];
  const tiers = {};
  for (const [id, set] of Object.entries(object(proposals) ? proposals : {})) {
    if (!roster.includes(id) || POSITION_ENGINE.isBucket(id)) continue;
    for (const [product, level] of Object.entries(object(set) ? set : {})) {
      const rule = book.pricing.byProduct?.[product]?.inputs?.policy?.tierRule;
      if (!active(product, book) || !rule || rule.fixed || rule.drift) continue;
      if ((object(held[id]) ? held[id] : {})[product] || (waiting[id] && product in waiting[id])) continue;
      if (!PRICING_ENGINE.levelShapeOk(level, names)) continue;
      (tiers[id] = tiers[id] || {})[product] = level;
    }
  }
  const codes = Object.keys(tiers);
  if (!codes.length) return { error: "There is no tier proposal to accept." };
  const say = (set) => Object.keys(set).map((product) => (book.state.PRODUCTS[product].name || product) + " " + levelWords(set[product])).join(", ");
  return proposed(POSITION_ENGINE.tierSetEntry({ at: body.at, tiers,
    raw: codes.length === 1 ? "Set " + codes[0] + ": " + say(tiers[codes[0]])
      : "Set " + codes.length + " customers from their proposals: " + codes.map((c) => c + " " + say(tiers[c])).join("; ") }), book);
}

/* A6: the sizes the printed board shows. The Desk's shQueueHouse queues the sizes he unticks as a hide list and no price:
   this is that entry, over the rungs the snapshot carries (sizes now on the board plus those already hidden). A price is
   never an input here, and the entry's own prices stay empty. */
export function houseRungs(book, product) {
  const snap = book.pricing && book.pricing.byProduct && book.pricing.byProduct[product];
  const hidden = book.state.PRICE_SET && book.state.PRICE_SET[product] && book.state.PRICE_SET[product].hide;
  /* the Desk's shSizes travels in the snapshot as `rungs`; a snapshot from before it falls back to the sizes on the board */
  const base = snap && Array.isArray(snap.rungs) ? snap.rungs : snap && Array.isArray(snap.sizes) ? snap.sizes : [];
  const all = [].concat(base, snap && Array.isArray(snap.rungs) || !Array.isArray(hidden) ? [] : hidden)
    .filter((n) => typeof n === "number" && Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  return all.filter((n, i) => !i || n - all[i - 1] > 0.009);
}
export function makerHouseSizes(body, book) {
  if (!exact(body, ["at", "product", "hide"])) return { error: "Printed sizes carry only a timestamp, a book and the sizes to hide; a price is never an input." };
  if (!timestamp(body.at)) return { error: "A board input needs its canonical request timestamp." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!active(body.product, book)) return { error: "Choose an active book." };
  if (!Array.isArray(body.hide) || body.hide.length > 50 || !body.hide.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0))
    return { error: "Choose the sizes to hide from the board." };
  const rungs = houseRungs(book, body.product), hide = [];
  for (const n of body.hide) {
    const rung = rungs.find((r) => Math.abs(r - n) < 0.009);
    if (rung === undefined) return { error: "A size to hide must be one of this book's board sizes." };
    if (!hide.includes(rung)) hide.push(rung);
  }
  hide.sort((a, b) => a - b);
  if (hide.length >= rungs.length) return { error: "Every size is unticked, so there is no board to make." };
  const say = (n) => Number(n).toLocaleString("en-MY", { maximumFractionDigits: 2 }) + " unit";
  return proposed({ at: body.at, type: "PRICE", party: null, qty: null, total: null, status: "price",
    raw: "Board sizes on " + body.product + ": " + (hide.length ? "hiding " + hide.map(say).join(", ") : "every size printed"),
    payload: { mode: "price", product: body.product, prices: {}, hide, clearing: true } }, book);
}
/* THE HUSHES: one KV key, {tip id: snooze day, or null for dismissed}, read by the Desk on load and written by the Desk
   and by Counter Maker, never a queue entry, a draft or a fold. A past day is dropped on every write. */
export const HUSH_KEY = "hush";
const mytDay = (at) => new Date(Date.parse(at) + 8 * 3600000).toISOString().slice(0, 10);
export async function hushGet(kv) {
  let map = null;
  try { map = await kv.get(HUSH_KEY, "json"); } catch { map = null; }
  return object(map) ? map : {};
}
/** until: a day to snooze to, null to dismiss; clear removes the tip's hush. today is MYT, from the request. */
export async function hushPut(kv, id, until, today, clear = false) {
  const map = await hushGet(kv), next = {};
  for (const [tip, day] of Object.entries(map)) if (day === null || (typeof day === "string" && day > today)) next[tip] = day;
  if (clear) delete next[id]; else next[id] = until;
  await kv.put(HUSH_KEY, JSON.stringify(next));
  return next;
}
/** The one check of a hush, for Maker and for the Desk's own route: a tip id, and a day after today and within a year, or null. */
export function hushFault(id, until, today) {
  if (typeof id !== "string" || !POSITION_ENGINE.TIP_ID.test(id)) return "That is not a tip id.";
  if (until !== null && !date(until)) return "A snooze is a real day, or null to dismiss.";
  if (until !== null && (until <= today || until > new Date(Date.parse(today) + 366 * 86400000).toISOString().slice(0, 10)))
    return "A snooze ends after today and within a year.";
  return null;
}
/** Maker's hush over the snapshot's tips (the Desk's own observations). It moves no figure. */
export function makerHush(body, book) {
  if (!exact(body, ["at", "id", "until"]) || typeof body.id !== "string" || body.until === undefined)
    return { error: "Hushing carries a tip, its request timestamp and a date or null." };
  if (!timestamp(body.at)) return { error: "A hush needs its canonical request timestamp." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!((book.pricing && book.pricing.obs) || []).some((tip) => tip && tip.id === body.id))
    return { error: "Choose a tip the Desk is showing." };
  const today = mytDay(body.at), fault = hushFault(body.id, body.until, today);
  if (fault) return { error: fault };
  return { id: body.id, until: body.until, today };
}

const safePoint = (value) => value.length >= 2
  && value.slice(0, 2).every((n) => typeof n === "number" && Number.isFinite(n))
  && value[0] >= 0.8 && value[0] <= 7.5 && value[1] >= 99.5 && value[1] <= 120;
/* a point filed is [lat, lng, locality]: never without the locality beside it (the Desk's geoWhere) */
const safeGeo = (value) => Array.isArray(value) && value.length === 3 && safePoint(value)
  && typeof value[2] === "string" && /^[^<>\u0000-\u001f]{1,60}$/.test(value[2].trim());
const exact = (body, fields) => object(body) && !Object.keys(body).some((key) => !fields.includes(key));
const realCode = (value, roster) => code(value, roster);

export function makerLedgerAmendment(body, book, undoCtx = null) {
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!exact(body, ["at", "rid", "kind", "date", "cash", "movedUnits", "fields", "undo"])
    || !timestamp(body.at) || !date(body.date) || typeof body.rid !== "string"
    || !/^[A-Za-z0-9_-]{1,64}$/.test(body.rid)
    || !["Correction", "Fulfilment", "Cancellation", "Payment", "Receipt", "Default"].includes(body.kind))
    return { error: "Choose a ledger row, amendment kind and real date; identity and raw prose are not input fields." };
  const found = findRow(book, body.rid);
  if (found.err) return { error: found.err };
  const row = found.row, sale = found.collection === "sales";
  /* plan 4: an undo is the newest move's, exactly as the History read it, by the ledger's road, and refused while it is blocked */
  if (body.undo !== undefined) {
    if (body.kind !== "Correction" || !Number.isInteger(body.undo) || !object(body.fields)) return { error: "An undo is a Correction naming the move it undoes." };
    const read = makerUndo(book, body.rid, undoCtx || { siteError: true });
    const u = read.undo;
    if (read.error || !u) return { error: read.error || "Nothing on this row can be undone: " + (read.why || "read it again") + "." };
    if (u.i !== body.undo) return { error: "Only the newest move on a row is undone, and that is no longer the move you read. Read it again.", stale: true };
    if (u.blocked) return { error: u.blocked };
    if (u.route !== "ledger") return { error: "A change of a site order's terms is undone on its order card, so the order keeps its row." };
    if (!POSITION_ENGINE.undoSame(u.fields, body.fields)) return { error: "The undo changed since you read it. Read it again.", stale: true };
  }
  /* 16 Oct 2026, his word on CR3-DAM's s263: A CUSTOMER'S AGREED ORDER AND ITS ROW CHANGE TOGETHER. A Correction of the row's units, price or
     delivery reached the book alone and the order kept its old figure, so it is refused here, naming the order, and Counter Admin sends it
     as the order's Amend (restateOrder): the floor, the refund and the customer's page follow, as from the order card */
  const terms = ["qty", "total", "delivery"], fields = object(body.fields) ? Object.keys(body.fields) : [];
  if (sale && body.kind === "Correction" && body.undo === undefined && fields.some((k) => terms.includes(k))) {
    const ctx = undoCtx || { siteError: true }, order = ctx.order;
    if (ctx.siteError) return { error: "The site's orders could not be read, so a change of units, price or delivery waits until they can be." };
    if (order && AGREED_ON_SITE.includes(order.status)) {
      if (fields.some((k) => !terms.includes(k)))
        return { error: "This row is a customer's order: send its units, price or delivery on their own, so the order changes with the row." };
      const f = body.fields;
      if (f.qty === null || f.total === null) return { error: "A customer's order keeps a size and a price." };
      return { error: "This row is a customer's order, so its units, price or delivery change on the order and the row together.",
        restate: { order: order.id, qty: f.qty !== undefined ? +f.qty : +order.qty, total: f.total !== undefined ? +f.total : +order.total,
          delivery: f.delivery !== undefined ? +(f.delivery || 0) : +(order.delivery || 0) } };
    }
  }
  /* the drafter's own rule: a cancelled row takes its revival and nothing else, the drafter judging what is paid or moved */
  if (row.cancelled && (body.kind !== "Correction" || !object(body.fields) || !reviving(body.fields)))
    return { error: "A cancelled row takes only its revival: cancelled off and its date cleared." };
  if (row.defaulted && body.kind !== "Correction") return { error: "A defaulted row takes a Correction only." };
  const lotKind = ["Payment", "Receipt", "Default"].includes(body.kind);
  if (lotKind && sale) return { error: "Payment, Receipt and Default are purchase-lot movements." };
  if (body.kind === "Correction") {
    if (body.cash !== undefined || body.movedUnits !== undefined || !object(body.fields)
      || !Object.keys(body.fields).length || Object.keys(body.fields).length > POSITION_ENGINE.CORRECTABLE.length
      || Object.keys(body.fields).some((field) => !POSITION_ENGINE.CORRECTABLE.includes(field)
        || DESK_ONLY_FIELDS.includes(field) || JOIN_ONLY_FIELDS.includes(field)))
      return { error: "Choose correctable typed fields; notes and settlement prose stay on Desk." };
    for (const [field, value] of Object.entries(body.fields)) {
      if (value == null) continue;
      if (field === "orderCode") {
        if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,15}$/.test(value))
          return { error: "An order code is up to 16 letters, digits and hyphens." };
        const why = siteWords(value);
        if (why) return { error: "Not sent: " + why + "." };
      }
      if (POSITION_ENGINE.CORRECT_DATE.includes(field) && !date(value))
        return { error: "Correction dates must be real dates." };
      if ((POSITION_ENGINE.CORRECT_NUM_POS.includes(field) || POSITION_ENGINE.CORRECT_NUM_NN.includes(field)) && !figure(value))
        return { error: "Correction figures must be finite, non-negative numbers." };
      if (POSITION_ENGINE.CORRECT_CODE.includes(field) && !code(value, book.state.roster || []))
        return { error: "Choose a roster code; names and places are not correction values." };
      if (field === "product" && !active(value, book))
        return { error: "Choose an active book." };
      if (POSITION_ENGINE.CORRECT_BOOL.includes(field) && typeof value !== "boolean")
        return { error: "Correction flags are true or false." };
      if (field === "stream" && !["R2", "R3"].includes(value)
        || field === "handover" && !POSITION_ENGINE.HANDOVER.includes(value))
        return { error: "Choose a listed stream or handover." };
    }
    const checked = checkCorrection(body.fields, book, row, sale);
    if (checked.errs.length) return { error: checked.errs.join("; ") };
  } else {
    if (body.fields !== undefined) return { error: "A movement or cancellation carries no row patch." };
    if (!POSITION_ENGINE.openable(POSITION_ENGINE.ledgerRow(row, sale ? "S" : "B", "salt")))
      return { error: "This row is no longer open." };
    if (lotKind) {
      const paid = POSITION_ENGINE.poCash(row), got = POSITION_ENGINE.poRecvUnits(row);
      if (body.kind === "Payment") {
        if (body.movedUnits !== undefined || !figure(body.cash) || !(body.cash > 0.004))
          return { error: "A payment is cash only, and above zero." };
        if (body.cash > (+row.total || 0) - paid + 0.009)
          return { error: "Only RM " + Math.max(0, (+row.total || 0) - paid).toFixed(2) + " is outstanding on this lot." };
      } else if (body.kind === "Receipt") {
        if (body.cash !== undefined || !figure(body.movedUnits) || !(body.movedUnits > 0.004))
          return { error: "A receipt is units only, and above zero." };
        if (body.movedUnits > (+row.qty || 0) - got + 0.009)
          return { error: "Only " + Math.max(0, (+row.qty || 0) - got).toFixed(2) + " unit is still to arrive on this lot." };
      } else if (body.cash !== undefined || body.movedUnits !== undefined || got > 0.009)
        return { error: "A default moves nothing, and a lot that has received units cannot default." };
    } else if (body.kind === "Cancellation") {
      if (body.cash !== undefined || body.movedUnits !== undefined
        || (sale ? POSITION_ENGINE.txEffDeliv(row) : POSITION_ENGINE.poRecvUnits(row)) > 0.009)
        return { error: "A cancellation moves nothing and cannot cancel goods already handed over." };
    } else if (!figure(body.cash) || !figure(body.movedUnits)
      || !(body.cash > 0.004 || body.movedUnits > 0.004))
      return { error: "A fulfilment needs non-negative cash and units, with at least one movement." };
  }
  if (!book.state.OPEN) return { error: "The open-order snapshot is unavailable. Reseed the mirror before amending." };
  if (lotKind) {
    /* the Workbench's own status and line for a lot, read through the engine's poStat */
    const cash = body.cash || 0, units = body.movedUnits || 0;
    const next = POSITION_ENGINE.poStat({ ...row, total: row.total, qty: row.qty, status: undefined, settledRM: 0, settledKg: 0,
      ...(body.kind === "Default" ? { defaulted: true } : {}),
      cash: POSITION_ENGINE.poCash(row) + cash, receivedQty: POSITION_ENGINE.poRecvUnits(row) + units });
    const status = body.kind === "Default" ? "defaulted" : next.pay === "Paid" ? "paid" : next.pay === "Unpaid" ? "unpaid" : "partial";
    const raw = body.kind + " on " + row.rid + " · lot from " + row.supplier + ", RM " + cash + " paid and " + units
      + " unit received on " + body.date + (body.kind === "Default"
        ? " → supplier default; cash already paid becomes a recoverable" : " → " + next.order);
    return proposed(POSITION_ENGINE.ledgerAmendmentEntry({ at: body.at, row, direction: "BUY", party: row.supplier,
      kind: body.kind, date: body.date, cash, movedUnits: units, status, raw }), book);
  }
  return proposed(POSITION_ENGINE.ledgerAmendmentEntry({ at: body.at, row, direction: sale ? "SELL" : "BUY",
    kind: body.kind, date: body.date, cash: body.cash, movedUnits: body.movedUnits, fields: body.fields,
    ...(body.undo !== undefined ? { undo: body.undo } : {}) }), book);
}

export async function makerAmendmentRoom(db, entry, book) {
  const p = entry.payload;
  const found = findRow(book, p.rid);
  if (found.err) return found.err;
  const sale = found.collection === "sales", row = found.row;
  const after = p.kind === "Correction" ? { ...row, ...p.fields } : row;
  const paid = (value) => sale ? POSITION_ENGINE.txPaid(value) : POSITION_ENGINE.poCash(value);
  const cash = p.kind === "Fulfilment" || p.kind === "Payment" ? +p.cash || 0
    : p.kind === "Correction" ? Math.max(0, paid(after) - paid(row)) : 0;
  const stops = p.kind === "Cancellation" || p.kind === "Default" || p.undo != null;
  if (!(cash > 0.004) && !stops) return "";
  const room = await rowRoom(db, sale ? "SELL" : "BUY");
  if (!room.version || room.version !== book.version) return "The mirror changed or could not be read. Read the row again.";
  const reading = room(POSITION_ENGINE.ovKey(row), entry);
  if (!reading) return "The row's remaining money could not be confirmed.";
  if (stops && reading.on > 0.004)
    return "Money is already on its way to this row. Decide it before " + (p.undo != null ? "undoing a move." : p.kind === "Default" ? "defaulting it." : "cancelling.");
  const changedTotal = p.kind === "Correction" && p.fields.total != null ? p.fields.total - (+row.total || 0) : 0;
  const changedDelivery = sale && p.kind === "Correction" && p.fields.delivery != null
    ? p.fields.delivery - (+row.delivery || 0) : 0;
  return cash > Math.max(0, reading.left + changedTotal + changedDelivery) + 0.004
    ? "This row can still take RM " + reading.left.toFixed(2) + "; money already on its way is reserved."
    : "";
}

export function makerLedgerInput(operation, body, book, pending = []) {
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  const roster = book.state.roster || [];
  if (!timestamp(body && body.at)) return { error: "The input needs its canonical request timestamp." };
  let entry;
  if (operation === "loan") {
    if (!exact(body, ["at", "form", "direction", "product", "code", "date", "amount", "second"]))
      return { error: "A loan carries only its timestamp, form, direction, product, code, date, amount and booked-twin confirmation." };
    if (!date(body.date) || !realCode(body.code, roster) || !["in", "out"].includes(body.direction)
      || !["cash", "salt"].includes(body.form) || !figure(body.amount) || !(body.amount > 0))
      return { error: "Choose a roster party, direction, real date and positive amount." };
    if (body.form === "salt" && !active(body.product, book)) return { error: "Choose an active book for an in-kind loan." };
    if (body.form === "cash" && body.product != null) return { error: "A cash loan has no book." };
    /* a loan already on the book with this party, direction, book, amount and date is asked about, as a booked trade is */
    const twin = (book.state.loans || []).find((row) => row && row.party === body.code && row.direction === body.direction
      && row.date === body.date && (body.form === "cash" ? Math.abs((+row.valueRM || 0) - body.amount) < 0.005
        : Math.abs((+row.valueKg || 0) - body.amount) < 0.005 && (row.product || "salt") === (body.product || "salt")));
    const second = twin ? twin.rid || true : null;
    if (twin && body.second !== second)
      return { error: "A loan with this party, book, amount and date is already booked. Confirm a separate loan.", twin: { second } };
    if (!twin && body.second != null) return { error: "The booked twin has changed. Read the loan again." };
    entry = POSITION_ENGINE.loanEntry({ at: body.at, product: body.product || "salt", direction: body.direction,
      party: body.code, date: body.date, form: body.form, amount: body.amount });
  } else if (operation === "repay") {
    if (!exact(body, ["at", "loan", "date", "amount"]))
      return { error: "A repayment carries only its timestamp, loan id, date and amount." };
    const loan = (book.state.loans || []).find((row) => row && row.rid === body.loan);
    if (!loan || !date(body.date) || !figure(body.amount) || !(body.amount > 0))
      return { error: "Choose an open loan, real date and positive amount." };
    const cash = loan.form === "cash", paid = (loan.repaid || []).reduce((sum, row) => sum + (+((cash ? row.rm : row.kg)) || 0), 0);
    const owed = +((cash ? +loan.valueRM : +loan.valueKg) - paid).toFixed(2);
    if (loan.status === "settled" || body.amount > owed + 0.005)
      return { error: "That loan is settled or the amount exceeds what remains owing." };
    entry = POSITION_ENGINE.repaymentEntry({ at: body.at, loan, party: loan.party, date: body.date,
      form: cash ? "cash" : "salt", product: loan.product || "salt", amount: body.amount });
  } else if (operation === "gift") {
    if (!exact(body, ["at", "product", "code", "date", "qty", "movedUnits", "handover", "second"]))
      return { error: "A gift carries only its timestamp, book, code, date, units, handover and booked-twin confirmation." };
    if (!active(body.product, book) || !realCode(body.code, roster) || !date(body.date)
      || !figure(body.qty) || !(body.qty > 0)
      || (body.movedUnits !== undefined && (!figure(body.movedUnits) || body.movedUnits > body.qty))
      || (body.handover != null && !POSITION_ENGINE.HANDOVER.includes(body.handover)))
      return { error: "Choose a valid book, roster party, date, amount and handover." };
    if (!(costFor(book, body.product).cost > 0)) return { error: "This book has no inventory cost yet." };
    entry = POSITION_ENGINE.giftEntry({ at: body.at, product: body.product, party: body.code,
      date: body.date, qty: body.qty, movedUnits: body.movedUnits, handover: body.handover });
    /* a gift already on the book as the fold reads it (party, book, date, units and cost) is asked about, as a booked trade is.
       The one he confirms carries `second`, which is what the fold's replay guard looks for. */
    const made = proposed(entry, book);
    if (made.error) return made;
    const row = made.draft.row;
    const twin = (book.sales || []).find((sale) => sale && sale.customer === row.customer
      && (sale.product || "salt") === (row.product || "salt") && (sale.date || null) === (row.date || null)
      && +sale.total === +row.total && +sale.qty === +row.qty);
    const second = twin ? twin.rid || true : null;
    if (twin && body.second !== second)
      return { error: "A gift with this party, book, units and date is already booked. Confirm a separate gift.", twin: { second } };
    if (!twin && body.second != null) return { error: "The booked twin has changed. Read the gift again." };
    if (twin) entry.payload.second = second;
    return made;
  } else if (operation === "redeem") {
    if (!exact(body, ["at", "code", "date"]) || !realCode(body.code, roster) || POSITION_ENGINE.isBucket(body.code)
      || !date(body.date)) return { error: "A redemption carries only its timestamp, party code and date." };
    const state = rewardFree(book, body.code, "salt", pending.filter((entry) => entry.at !== body.at));
    if (state.error) return state;
    const free = state.associate ? state.free : state.free >= 1 - 1e-9 ? 1 : 0;
    if (!(free > 0.009)) return { error: state.held >= 1 - 1e-9
      ? "The reward is already spent or reserved by another input awaiting its fold."
      : "There is no whole reward unit available to redeem." };
    const advances = (book.sales || []).filter((sale) => sale && sale.customer === body.code
      && (sale.product || "salt") === "salt" && POSITION_ENGINE.txAdvance(sale) > 0.009)
      .sort((a, b) => !a.date ? (b.date ? 1 : 0) : !b.date ? -1 : a.date.localeCompare(b.date));
    if (advances.length) {
      const sale = advances[0], { offUnits: units, offRM: rm } = POSITION_ENGINE.offsetFor(sale, free, free);
      if (!(units > 0.009) || !(rm > 0.009)) return { error: "The available reward cannot offset this order." };
      entry = POSITION_ENGINE.rebateOffsetEntry({ at: body.at, party: body.code, date: body.date, sale, units, rm });
    } else {
      entry = POSITION_ENGINE.redeemEntry({ at: body.at, product: "salt", party: body.code, date: body.date,
        qty: free, earned: state.earned, applied: state.applied, balance: state.held });
    }
  } else if (operation === "add-id") {
    if (!exact(body, ["at", "code", "kind", "parent", "geo", "tiers", "vault", "addrVault"])
      || !/^[A-Z]{1,3}[0-9]{0,2}[A-Z0-9-]*$/.test(body.code) || !["customer", "supplier", "reseller", "referral", "downstream", "bucket"].includes(body.kind))
      return { error: "An ID entry carries only codes, role, point, tiers and the encrypted vault envelope." };
    if (body.kind === "bucket") {
      if (!realCode(body.parent, roster) || body.vault !== null || body.geo != null || body.tiers != null)
        return { error: "A resale account has a parent code and no name vault." };
    } else if (!isSealedEnvelope(body.vault)) return { error: "File the encrypted vault on this device before adding the ID." };
    if (body.addrVault !== undefined && (!isSealedEnvelope(body.addrVault) || body.kind === "bucket"))
      return { error: "A filed address needs an encrypted envelope for a named party." };
    if (roster.includes(body.code)) return { error: "That code is already on the roster." };
    if (body.parent != null && !realCode(body.parent, roster)) return { error: "Choose a parent already on the roster." };
    if (body.geo != null && !safeGeo(body.geo)) return { error: "The map point is outside Malaysia or has invalid locality text." };
    const tiers = body.tiers == null ? null : body.tiers;
    if (tiers != null) {
      if (!["customer", "reseller", "referral"].includes(body.kind))
        return { error: "Only a customer, reseller or referral holds a starting tier." };
      if (!object(tiers) || !Object.keys(tiers).length) return { error: "Starting tiers must name active tiered books." };
      for (const [product, tier] of Object.entries(tiers)) {
        const snapshot = book.pricing?.byProduct?.[product], rule = snapshot?.inputs?.policy?.tierRule;
        if (active(product, book) && rule && rule.drift && !PRICING_ENGINE.driftOk(tier))
          return { error: "A starting drift is a number from -1 to +1, never a level." };
        if (!active(product, book) || !rule || rule.fixed
          || (!rule.drift && !PRICING_ENGINE.levelShapeOk(tier, book.pricing.tierNames || [])))
          return { error: "Starting tiers must use active tiered books and current level names." };
      }
    }
    entry = POSITION_ENGINE.addIdEntry({ at: body.at, code: body.code, kind: body.kind,
      parent: body.parent || null, rev: body.kind === "reseller" ? "R2" : body.kind === "referral" ? "R3" : null,
      geo: body.geo || null, tiers });
  } else if (operation === "amend-id") {
    if (!exact(body, ["at", "from", "to", "geo", "vault", "addrVault"])
      || !realCode(body.from, roster) || POSITION_ENGINE.isBucket(body.from)
      || !/^[A-Z]{1,3}[0-9]{0,2}[A-Z0-9-]*$/.test(body.to)
      || body.to[0] !== body.from[0] || (body.to !== body.from && roster.includes(body.to))
      || !isSealedEnvelope(body.vault) || (body.addrVault !== undefined && !isSealedEnvelope(body.addrVault))
      || (body.geo != null && !safeGeo(body.geo)))
      return { error: "Amend ID needs its existing code, a free matching code, a point and the encrypted vault envelope." };
    if (body.to === body.from) {
      const current = (book.state.PLACED || {})[body.from];
      if (!body.geo || JSON.stringify(current) === JSON.stringify(body.geo))
        return { vaultOnly: true, vault: body.vault };
      entry = POSITION_ENGINE.placeEntry({ at: body.at, party: body.from, places: { [body.from]: body.geo } });
    } else entry = POSITION_ENGINE.renameEntry({ at: body.at, from: body.from, to: body.to, geo: body.geo || null });
  } else if (operation === "place") {
    if (!exact(body, ["at", "places", "addrVault"]) || !object(body.places) || !Object.keys(body.places).length
      || Object.keys(body.places).length > 100)
      return { error: "A placement carries a timestamp and a bounded map of code to point." };
    if (body.addrVault !== undefined && !isSealedEnvelope(body.addrVault))
      return { error: "File a new address only as the encrypted places envelope." };
    for (const [party, point] of Object.entries(body.places))
      if (!realCode(party, roster) || POSITION_ENGINE.isBucket(party) || !safeGeo(point))
        return { error: "Each map point must belong to a roster party and remain inside Malaysia." };
    entry = POSITION_ENGINE.placeEntry({ at: body.at, places: body.places });
  } else {
    return { error: "That input operation is not available." };
  }
  return proposed(entry, book);
}

function isSealedEnvelope(value) {
  return object(value) && Object.keys(value).sort().join(",") === "ct,iv,salt,v" && value.v === 1
    && ["salt", "iv", "ct"].every((key) => typeof value[key] === "string"
      && /^[A-Za-z0-9+/]+={0,2}$/.test(value[key]) && value[key].length > 0);
}
