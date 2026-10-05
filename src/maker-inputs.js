import POSITION_ENGINE from "../engine/position.mjs";
import PRICING_ENGINE from "../engine/pricing.mjs";
import { costFor, draftRow, findRow, checkCorrection } from "./drafter.js";
import { rowRoom } from "./orders.js";

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
export function makerTradeEntry(operation, body, book) {
  if (!["sale", "purchase"].includes(operation)) return { error: "Choose sale or purchase." };
  const sale = operation === "sale";
  const fields = ["at", "product", "party", "date", "qty", "total", "cash", "movedUnits", "handover", "second"]
    .concat(sale ? ["delivery", "assoc", "stream", "downstream"] : ["freight"]);
  if (!object(body) || Object.keys(body).some((key) => !fields.includes(key)))
    return { error: "Unsupported trade input fields." };
  if (!timestamp(body.at)) return { error: "A trade needs its canonical request timestamp." };
  if (!date(body.date)) return { error: "A trade needs a real date in YYYY-MM-DD." };
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!active(body.product, book)) return { error: "Choose an active product." };
  const roster = book.state.roster || [];
  if (!code(body.party, roster)) return { error: "Choose a party on the roster." };
  for (const key of ["qty", "total", "cash", "movedUnits"])
    if (!figure(body[key])) return { error: "Trade figures must be finite, non-negative numbers." };
  if (!(body.qty > 0)) return { error: "Units must be above zero." };
  const carry = sale ? "delivery" : "freight";
  if (body[carry] !== undefined && !figure(body[carry]))
    return { error: "Carriage must be a finite, non-negative number." };
  if (body.handover !== undefined && body.handover !== null && !POSITION_ENGINE.HANDOVER.includes(body.handover))
    return { error: "Handover is delivered, collected or not stated." };
  const assoc = body.assoc || null, stream = body.stream || null, downstream = body.downstream || null;
  for (const key of ["assoc", "downstream"])
    if (body[key] !== undefined && body[key] !== null && !code(body[key], roster))
      return { error: "Choose an associate and end buyer from the roster." };
  if (body.stream !== undefined && body.stream !== null && !["R2", "R3"].includes(body.stream))
    return { error: "Choose R2 or R3." };
  if (assoc ? !["R2", "R3"].includes(stream) : stream || downstream)
    return { error: "An attribution needs an associate and its stream." };
  if (downstream && stream !== "R2") return { error: "An end buyer belongs to an R2 sale." };
  if (stream === "R2") {
    const bucket = POSITION_ENGINE.ownerCode(assoc) + POSITION_ENGINE.BUCKET_SFX;
    if (!roster.includes(bucket)) return { error: "Register the associate's resale account first." };
    if (body.party !== assoc) return { error: "An R2 sale names its associate as the party." };
  }
  if (sale && !(costFor(book, body.product).cost > 0))
    return { error: "This product has no inventory cost yet. Record the lot first." };
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
  return proposed(POSITION_ENGINE.tradeEntry({
    at: body.at, product: body.product, direction: sale ? "SELL" : "BUY", party: body.party,
    date: body.date, qty: body.qty, total: body.total, cash: body.cash, movedUnits: body.movedUnits,
    delivery: sale ? body.delivery ?? 0 : 0, freight: sale ? 0 : body.freight ?? 0,
    handover: body.handover ?? null, assoc, stream, downstream, second: body.second ?? null
  }), book);
}

export function makerQueuedTradeCheck(entry, queue) {
  const p = entry.payload;
  const entries = queue || [];
  const sameStamp = entries.find((queued) => queued && queued.at === entry.at);
  if (sameStamp) {
    if (sameStamp.raw === entry.raw && JSON.stringify(sameStamp.payload) === JSON.stringify(entry.payload))
      return { retry: true, at: sameStamp.at };
    return { error: "This request timestamp already carries another entry. Read its draft instead.",
      queuedTwin: { at: sameStamp.at } };
  }
  const twin = entries.find((queued) => {
    const q = queued && queued.payload;
    return q && q.mode === "new" && q.direction === p.direction && (q.product || "salt") === p.product
      && q.party === p.party && q.date === p.date && +q.qty === p.qty && +q.total === p.total;
  });
  return twin ? { error: "The same order is already queued. Read its draft instead.",
    queuedTwin: { at: twin.at } } : {};
}

export function makerQueuedTradeFault(entry, queue) {
  return makerQueuedTradeCheck(entry, queue).error || "";
}

export function makerInputCatalog(book) {
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  const roster = (book.state.roster || []).filter((value) => code(value, book.state.roster || []));
  const products = Object.keys(book.state.PRODUCTS || {}).filter((product) => active(product, book)).map((product) => {
    const snapshot = book.pricing && book.pricing.byProduct && book.pricing.byProduct[product];
    const rule = snapshot && snapshot.inputs && snapshot.inputs.policy && snapshot.inputs.policy.tierRule;
    const cost = costFor(book, product).cost;
    return { product, tiered: !!rule && !rule.fixed && !rule.drift, fixed: !!(rule && rule.fixed), drift: !!(rule && rule.drift),
      saleReady: cost > 0, purchaseReady: cost !== null };
  });
  return {
    version: book.version, products, parties: roster,
    placed: Object.fromEntries(Object.entries(book.state.PLACED || {})
      .filter(([id, point]) => roster.includes(id) && Array.isArray(point) && safeGeo(point.slice(0, 2)))),
    associates: (book.state.associates || []).filter((value) => code(value, roster) && !POSITION_ENGINE.isBucket(value))
      .map((value) => ({ code: value, resaleReady: roster.includes(value + POSITION_ENGINE.BUCKET_SFX) })),
    tierCustomers: roster.filter((value) => !POSITION_ENGINE.isBucket(value)),
    tierNames: ((book.pricing && book.pricing.tierNames) || []).filter((value) => typeof value === "string"),
    handovers: POSITION_ENGINE.HANDOVER.slice(), streams: ["R2", "R3"],
    correctionFields: POSITION_ENGINE.CORRECTABLE.filter((field) => !["note", "orderCode", "settle"].includes(field))
      .map((field) => ({ field, required: POSITION_ENGINE.CORRECT_REQUIRED.includes(field),
        kind: POSITION_ENGINE.CORRECT_BOOL.includes(field) ? "boolean"
          : POSITION_ENGINE.CORRECT_DATE.includes(field) ? "date"
            : POSITION_ENGINE.CORRECT_CODE.includes(field) ? "code"
              : field === "product" ? "product" : field === "stream" ? "stream"
                : field === "handover" ? "handover" : "number" })),
    rows: ["sales", "purchases"].flatMap((collection) => (book[collection] || [])
      .filter((row) => row && row.rid && !row.cancelled && !row.defaulted).map((row) => {
        const sale = collection === "sales";
        return { rid: row.rid, direction: sale ? "SELL" : "BUY", party: row[sale ? "customer" : "supplier"],
          product: row.product || "salt", date: row.date || null, qty: row.qty, total: row.total,
          cash: sale ? POSITION_ENGINE.txPaid(row) : POSITION_ENGINE.poCash(row),
          movedUnits: sale ? POSITION_ENGINE.txEffDeliv(row) : POSITION_ENGINE.poRecvUnits(row),
          open: POSITION_ENGINE.openable(POSITION_ENGINE.ledgerRow(row, sale ? "S" : "B", "salt")) };
      })),
    loans: (book.state.loans || []).filter((row) => row && row.status !== "settled").map((row) => {
      const cash = row.form === "cash";
      const paid = (row.repaid || []).reduce((sum, part) => sum + (+((cash ? part.rm : part.kg)) || 0), 0);
      return { rid: row.rid, party: row.party, date: row.date, product: row.product || "salt",
        form: cash ? "cash" : "salt",
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

/** One customer, one product; null clears the held tier, bands use the pricing engine's shape check. */
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
  if (rule.drift) return { error: "This product prices by each customer's drift, set on the desk." };
  const names = (book.pricing && book.pricing.tierNames) || [];
  if (body.tier !== null && !PRICING_ENGINE.levelShapeOk(body.tier, names))
    return { error: "Choose a tier or a set of small, mid and big tiers." };
  return proposed(POSITION_ENGINE.tierSetEntry({
    at: body.at, tiers: { [body.code]: { [body.product]: body.tier } }
  }), book);
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

const safeGeo = (value) => {
  if (!Array.isArray(value) || value.length !== 2
    || !value.slice(0, 2).every((n) => typeof n === "number" && Number.isFinite(n))
    || value[0] < 0.8 || value[0] > 7.5 || value[1] < 99.5 || value[1] > 120)
    return false;
  return true;
};
const exact = (body, fields) => object(body) && !Object.keys(body).some((key) => !fields.includes(key));
const realCode = (value, roster) => code(value, roster);

export function makerLedgerAmendment(body, book) {
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  if (!exact(body, ["at", "rid", "kind", "date", "cash", "movedUnits", "fields"])
    || !timestamp(body.at) || !date(body.date) || typeof body.rid !== "string"
    || !/^[A-Za-z0-9_-]{1,64}$/.test(body.rid)
    || !["Correction", "Fulfilment", "Cancellation", "Payment", "Receipt", "Default"].includes(body.kind))
    return { error: "Choose a ledger row, amendment kind and real date; identity and raw prose are not input fields." };
  const found = findRow(book, body.rid);
  if (found.err) return { error: found.err };
  const row = found.row, sale = found.collection === "sales";
  if (row.cancelled || row.defaulted) return { error: "A cancelled or defaulted row needs a Desk judgement." };
  const lotKind = ["Payment", "Receipt", "Default"].includes(body.kind);
  if (lotKind && sale) return { error: "Payment, Receipt and Default are purchase-lot movements." };
  if (body.kind === "Correction") {
    if (body.cash !== undefined || body.movedUnits !== undefined || !object(body.fields)
      || !Object.keys(body.fields).length || Object.keys(body.fields).length > POSITION_ENGINE.CORRECTABLE.length
      || Object.keys(body.fields).some((field) => !POSITION_ENGINE.CORRECTABLE.includes(field)
        || ["note", "orderCode", "settle"].includes(field)))
      return { error: "Choose correctable typed fields; notes, order codes and settlement prose stay on Desk." };
    for (const [field, value] of Object.entries(body.fields)) {
      if (value == null) continue;
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
    kind: body.kind, date: body.date, cash: body.cash, movedUnits: body.movedUnits, fields: body.fields }), book);
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
  const stops = p.kind === "Cancellation" || p.kind === "Default";
  if (!(cash > 0.004) && !stops) return "";
  const room = await rowRoom(db, sale ? "SELL" : "BUY");
  if (!room.version || room.version !== book.version) return "The mirror changed or could not be read. Read the row again.";
  const reading = room(POSITION_ENGINE.ovKey(row), entry);
  if (!reading) return "The row's remaining money could not be confirmed.";
  if (stops && reading.on > 0.004)
    return "Money is already on its way to this row. Decide it before " + (p.kind === "Default" ? "defaulting it." : "cancelling.");
  const changedTotal = p.kind === "Correction" && p.fields.total != null ? p.fields.total - (+row.total || 0) : 0;
  const changedDelivery = sale && p.kind === "Correction" && p.fields.delivery != null
    ? p.fields.delivery - (+row.delivery || 0) : 0;
  return cash > Math.max(0, reading.left + changedTotal + changedDelivery) + 0.004
    ? "This row can still take RM " + reading.left.toFixed(2) + "; money already on its way is reserved."
    : "";
}

export function makerLedgerInput(operation, body, book) {
  if (!ready(book)) return { error: "The Desk mirror is being seeded." };
  const roster = book.state.roster || [];
  if (!timestamp(body && body.at)) return { error: "The input needs its canonical request timestamp." };
  let entry;
  if (operation === "loan") {
    if (!exact(body, ["at", "form", "direction", "product", "code", "date", "amount"]))
      return { error: "A loan carries only its timestamp, form, direction, product, code, date and amount." };
    if (!date(body.date) || !realCode(body.code, roster) || !["in", "out"].includes(body.direction)
      || !["cash", "salt"].includes(body.form) || !figure(body.amount) || !(body.amount > 0))
      return { error: "Choose a roster party, direction, real date and positive amount." };
    if (body.form === "salt" && !active(body.product, book)) return { error: "Choose an active book for an in-kind loan." };
    if (body.form === "cash" && body.product != null) return { error: "A cash loan has no book." };
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
    if (!exact(body, ["at", "product", "code", "date", "qty", "movedUnits", "handover"]))
      return { error: "A gift carries only its timestamp, book, code, date, units and handover." };
    if (!active(body.product, book) || !realCode(body.code, roster) || !date(body.date)
      || !figure(body.qty) || !(body.qty > 0)
      || (body.movedUnits !== undefined && (!figure(body.movedUnits) || body.movedUnits > body.qty))
      || (body.handover != null && !POSITION_ENGINE.HANDOVER.includes(body.handover)))
      return { error: "Choose a valid book, roster party, date, amount and handover." };
    if (!(costFor(book, body.product).cost > 0)) return { error: "This book has no inventory cost yet." };
    entry = POSITION_ENGINE.giftEntry({ at: body.at, product: body.product, party: body.code,
      date: body.date, qty: body.qty, movedUnits: body.movedUnits, handover: body.handover });
  } else if (operation === "redeem") {
    if (!exact(body, ["at", "code", "date"]) || !realCode(body.code, roster) || POSITION_ENGINE.isBucket(body.code)
      || !date(body.date)) return { error: "A redemption carries only its timestamp, party code and date." };
    const state = POSITION_ENGINE.rewardAccount(book, body.code);
    if (state.error) return state;
    const free = state.associate ? state.held : state.held >= 1 - 1e-9 ? 1 : 0;
    if (!(free > 0.009)) return { error: "There is no whole reward unit available to redeem." };
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
      if (!body.geo || JSON.stringify(current?.slice(0, 2)) === JSON.stringify(body.geo))
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
