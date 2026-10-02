import POSITION_ENGINE from "../engine/position.mjs";
import PRICING_ENGINE from "../engine/pricing.mjs";
import { costFor, draftRow } from "./drafter.js";

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
    return { product, tiered: !!rule && !rule.fixed, fixed: !!(rule && rule.fixed),
      saleReady: cost > 0, purchaseReady: cost !== null };
  });
  return {
    version: book.version, products, parties: roster,
    associates: (book.state.associates || []).filter((value) => code(value, roster) && !POSITION_ENGINE.isBucket(value))
      .map((value) => ({ code: value, resaleReady: roster.includes(value + POSITION_ENGINE.BUCKET_SFX) })),
    tierCustomers: roster.filter((value) => !POSITION_ENGINE.isBucket(value)),
    tierNames: ((book.pricing && book.pricing.tierNames) || []).filter((value) => typeof value === "string"),
    handovers: POSITION_ENGINE.HANDOVER.slice(), streams: ["R2", "R3"],
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
  const names = (book.pricing && book.pricing.tierNames) || [];
  if (body.tier !== null && !PRICING_ENGINE.levelShapeOk(body.tier, names))
    return { error: "Choose a tier or a set of small, mid and big tiers." };
  return proposed(POSITION_ENGINE.tierSetEntry({
    at: body.at, tiers: { [body.code]: { [body.product]: body.tier } }
  }), book);
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

function rewardState(book, id) {
  const state = book.state || {}, scheme = state.REWARD && state.REWARD.stated && state.REWARD.stated.salt;
  if (!scheme || !Number.isFinite(+scheme.margin) || +scheme.margin <= 0) return { error: "Salt has no configured reward." };
  const sales = (book.sales || []).filter((row) => row && (row.product || "salt") === "salt");
  const associates = new Set(state.associates || []);
  const associate = associates.has(id) || sales.some((row) => row.rev === "R2" && POSITION_ENGINE.ownerCode(row.customer) === id)
    || sales.some((row) => row.ref === id) || (state.INTRODUCTIONS || []).some((item) => item && item.by === id);
  const refs = new Set();
  if (associate) {
    sales.forEach((row) => { if (row.ref === id && row.customer) refs.add(POSITION_ENGINE.ownerCode(row.customer)); });
    (state.INTRODUCTIONS || []).forEach((item) => {
      if (item && item.by === id && item.customer) refs.add(POSITION_ENGINE.ownerCode(item.customer));
    });
  }
  const opening = state.PROD_OPENING && state.PROD_OPENING.salt || { qty: 0, costPerKg: null };
  const lots = (book.purchases || []).filter((row) => (row.product || "salt") === "salt"
    && !row.defaulted && !row.cancelled && !row.pending && !row.inTransit
    && POSITION_ENGINE.poRecvUnits(row) > 0.0001);
  const buyUnits = lots.reduce((sum, row) => sum + POSITION_ENGINE.poRecvUnits(row), 0);
  const buyRM = lots.reduce((sum, row) => sum + POSITION_ENGINE.poRecvUnits(row) * POSITION_ENGINE.poRate(row), 0);
  const openingUnits = opening.costPerKg != null ? (+opening.qty || 0) : 0;
  const averageCost = buyUnits + openingUnits > 0
    ? (buyRM + openingUnits * (+opening.costPerKg || 0)) / (buyUnits + openingUnits)
    : 0;
  const margin = { own: 0, referred: 0 };
  const assigned = (row) => {
    const owner = POSITION_ENGINE.ownerCode(row.customer);
    return owner === id ? "own" : associate && refs.has(owner) ? "referred" : null;
  };
  for (const row of sales) {
    const stateName = POSITION_ENGINE.txStat(row).order;
    if (stateName === "Default" || stateName === "Pending" || stateName === "Cancelled" || row.goodwill) continue;
    const bucket = assigned(row);
    if (!bucket) continue;
    let goods = +row.total || 0, qty = +row.qty || 0;
    if (row.rebate) {
      goods = Math.max(0, goods - (+row.settledRM || 0));
      qty = Math.max(0, qty - (row.rebateKg != null ? +row.rebateKg : (+row.qty || 0)));
      if (goods < 0.009 && qty < 1e-9) continue;
    }
    margin[bucket] += goods - qty * POSITION_ENGINE.txUnitCost(row, averageCost);
  }
  for (const row of sales) {
    if (!row.goodwill || row.rebate || row.cancelled) continue;
    const stateName = POSITION_ENGINE.txStat(row).order;
    if (stateName === "Pending" || stateName === "Cancelled" || stateName === "Default") continue;
    const bucket = assigned(row);
    if (bucket) margin[bucket] -= (+row.qty || 0) * POSITION_ENGINE.txUnitCost(row, averageCost);
  }
  const hurdle = associate ? (+scheme.associate?.margin || +scheme.margin) : +scheme.margin;
  const pooled = associate
    ? margin.own + margin.referred / (+scheme.associate?.r3Hurdle || 1)
    : margin.own;
  const earned = Math.max(0, Math.floor(+pooled.toFixed(2) / hurdle));
  const applied = sales.reduce((sum, row) => {
    if (POSITION_ENGINE.ownerCode(row.customer) !== id) return sum;
    const rebate = row.rebate ? (row.rebateKg != null ? +row.rebateKg : (+row.qty || 0)) : 0;
    return sum + rebate + Math.max(0, +row.coverUnits || 0);
  }, 0);
  const held = +(earned - applied).toFixed(2);
  const people = state.PEOPLE || {};
  if ((people.departed || []).some((person) => person && person.id === id))
    return { error: "A departed party's reward waits until they return." };
  return { earned, applied: +applied.toFixed(2), held, associate, margin: +pooled.toFixed(2) };
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
    const state = rewardState(book, body.code);
    if (state.error) return state;
    const free = state.associate ? state.held : state.held >= 1 - 1e-9 ? 1 : 0;
    if (!(free > 0.009)) return { error: "There is no whole reward unit available to redeem." };
    const advances = (book.sales || []).filter((sale) => sale && sale.customer === body.code
      && (sale.product || "salt") === "salt" && POSITION_ENGINE.txAdvance(sale) > 0.009)
      .sort((a, b) => !a.date ? (b.date ? 1 : 0) : !b.date ? -1 : a.date.localeCompare(b.date));
    if (advances.length) {
      const sale = advances[0], qty = +sale.qty || 0, rate = qty > 0 ? POSITION_ENGINE.txGoods(sale) / qty : 0;
      const units = +Math.min(free, free, qty, rate > 0 ? POSITION_ENGINE.txAdvance(sale) / rate : 0).toFixed(2);
      const rm = +Math.min(POSITION_ENGINE.txAdvance(sale), rate * units).toFixed(2);
      if (!(units > 0.009) || !(rm > 0.009)) return { error: "The available reward cannot offset this order." };
      entry = POSITION_ENGINE.rebateOffsetEntry({ at: body.at, party: body.code, date: body.date, sale, units, rm });
    } else {
      entry = POSITION_ENGINE.redeemEntry({ at: body.at, product: "salt", party: body.code, date: body.date,
        qty: free, earned: state.earned, applied: state.applied, balance: state.held });
    }
  } else if (operation === "add-id") {
    if (!exact(body, ["at", "code", "kind", "parent", "geo", "tiers", "vault"])
      || !/^[A-Z]{1,3}[0-9]{0,2}[A-Z0-9-]*$/.test(body.code) || !["customer", "supplier", "reseller", "referral", "downstream", "bucket"].includes(body.kind))
      return { error: "An ID entry carries only codes, role, point, tiers and the encrypted vault envelope." };
    if (body.kind === "bucket") {
      if (!realCode(body.parent, roster) || body.vault !== null || body.geo != null || body.tiers != null)
        return { error: "A resale account has a parent code and no name vault." };
    } else if (!isSealedEnvelope(body.vault)) return { error: "File the encrypted vault on this device before adding the ID." };
    if (roster.includes(body.code)) return { error: "That code is already on the roster." };
    if (body.parent != null && !realCode(body.parent, roster)) return { error: "Choose a parent already on the roster." };
    if (body.geo != null && !safeGeo(body.geo)) return { error: "The map point is outside Malaysia or has invalid locality text." };
    const tiers = body.tiers == null ? null : body.tiers;
    if (tiers != null) {
      if (!object(tiers) || !Object.keys(tiers).length) return { error: "Starting tiers must name active tiered books." };
      for (const [product, tier] of Object.entries(tiers)) {
        const snapshot = book.pricing?.byProduct?.[product], rule = snapshot?.inputs?.policy?.tierRule;
        if (!active(product, book) || !rule || rule.fixed
          || !PRICING_ENGINE.levelShapeOk(tier, book.pricing.tierNames || []))
          return { error: "Starting tiers must use active tiered books and current level names." };
      }
    }
    entry = POSITION_ENGINE.addIdEntry({ at: body.at, code: body.code, kind: body.kind,
      parent: body.parent || null, rev: body.kind === "reseller" ? "R2" : body.kind === "referral" ? "R3" : null,
      geo: body.geo || null, tiers });
  } else if (operation === "amend-id") {
    if (!exact(body, ["at", "from", "to", "geo", "vault"])
      || !realCode(body.from, roster) || POSITION_ENGINE.isBucket(body.from)
      || !/^[A-Z]{1,3}[0-9]{0,2}[A-Z0-9-]*$/.test(body.to)
      || body.to[0] !== body.from[0] || (body.to !== body.from && roster.includes(body.to))
      || !isSealedEnvelope(body.vault) || (body.geo != null && !safeGeo(body.geo)))
      return { error: "Amend ID needs its existing code, a free matching code, a point and the encrypted vault envelope." };
    if (body.to === body.from) return { vaultOnly: true, vault: body.vault };
    entry = POSITION_ENGINE.renameEntry({ at: body.at, from: body.from, to: body.to, geo: body.geo || null });
  } else if (operation === "place") {
    if (!exact(body, ["at", "places"]) || !object(body.places) || !Object.keys(body.places).length
      || Object.keys(body.places).length > 100)
      return { error: "A placement carries a timestamp and a bounded map of code to point." };
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
