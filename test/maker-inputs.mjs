import { pathToFileURL } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";
import { makerTradeEntry, makerTierSet, makerQueuedTradeFault, makerQueuedLoanCheck, makerQueuedGiftCheck, makerLedgerInput } from "../src/maker-inputs.js";

export async function run({ ok, KV } = {}) {
  const check = ok || ((condition, message) => { if (!condition) throw new Error(message); });
  const at = "2026-10-01T08:00:00.000Z";
  const book = () => ({
    version: 1, sales: [], purchases: [],
    state: {
      PRODUCTS: { salt: { name: "salt" }, oil: { name: "oil" }, spare: { retired: true } },
      roster: ["CX1-ZED", "CX2-ZED", "AX1-ZED", "AX1-ZED-R", "SX1-ZED"],
      associates: ["AX1-ZED"], TIER_OF: { "CX1-ZED": { salt: 1 } },
      REWARD: { stated: { salt: { margin: 500, associate: { margin: 470, r3Hurdle: 1.2 } } } },
      PROD_OPENING: { salt: { qty: 0, costPerKg: null } },
      loans: [{ rid: "loan-test-1", party: "CX1-ZED", direction: "in", form: "salt", product: "salt",
        valueKg: 5, status: "open", repaid: [] }],
      PEOPLE: { departed: [] }
    },
    pricing: {
      byProduct: {
        salt: { stockCost: 40, inputs: { policy: { tierRule: { drift: true } } } },
        oil: { stockCost: 8, inputs: { policy: { tierRule: { fixed: true } } } }
      }
    }
  });
  const trade = (patch = {}) => ({
    at, product: "salt", party: "CX1-ZED", date: "2026-10-01", qty: 2, total: 120,
    cash: 130, movedUnits: 2, delivery: 10, handover: "delivered", ...patch
  });
  const sale = (patch = {}, b = book()) => makerTradeEntry("sale", trade(patch), b);
  const purchase = (patch = {}, b = book()) => makerTradeEntry("purchase", {
    at, product: "salt", party: "SX1-ZED", date: "2026-10-01", qty: 4, total: 160,
    cash: 160, movedUnits: 4, freight: 12, handover: "collected", ...patch
  }, b);
  const tier = (patch = {}, b = book()) => makerTierSet({ at, code: "CX1-ZED", product: "salt", tier: 0.25, unit: "pct", ...patch }, b);

  const s = sale();
  check(s.draft?.collection === "sales", "Sale uses the existing sales drafter.");
  check(s.entry?.type === "SELL" && s.entry.status === "paid", "Sale queue metadata is paid with carriage covered.");
  check(s.entry?.payload.mode === "new" && s.entry.payload.kg === 2 && s.entry.payload.note === null,
    "Sale emits the normal new-entry shape, moved units and no note.");
  check(s.draft?.row.customer === "CX1-ZED" && s.draft.row.total === 120 && s.draft.row.delivery === 10,
    "Goods and delivery remain separate.");
  check(s.draft?.row.cost === 80 && s.draft.row.cash === 130 && s.draft.row.deliveredQty === 2,
    "The drafter costs the order and records the stated cash and units.");
  check(s.draft?.row.paidOn === "2026-10-01" && s.draft.row.deliveredOn === "2026-10-01",
    "Completed sale dates come from the trade date.");
  check(!Object.hasOwn(s.draft.row, "product"), "Salt keeps its absent-product storage convention.");
  check(sale({ cash: 120 }).entry?.status === "partial", "Goods paid without delivery is partial, not paid.");
  const pending = sale({ cash: 0, movedUnits: 0 });
  check(pending.draft?.row.deliveredQty === 0 && !Object.hasOwn(pending.draft.row, "cost"),
    "A pending sale carries no cost and no units handed over.");
  const other = sale({ product: "oil", total: 30, cash: 40 });
  check(other.draft?.row.product === "oil" && other.draft.row.cost === 16,
    "A nondefault product keeps its own explicit product and cost.");
  check(s.entry?.raw.includes("CX1-ZED") && !s.entry.raw.includes("undefined"),
    "Maker raw text is constructed from figures and encoded codes.");
  check(sale({ total: 1 }).draft?.flags.some((flag) => flag.includes("cost")),
    "Unusual prices remain the drafter's flagged judgement, not a second pricing rule.");

  const p = purchase();
  check(p.draft?.collection === "purchases" && p.draft.row.supplier === "SX1-ZED",
    "Purchase uses the existing purchases drafter.");
  check(p.draft?.row.total === 160 && p.draft.row.freight === 12 && !Object.hasOwn(p.draft.row, "cost"),
    "A lot carries goods and freight separately and no sale cost.");
  check(p.draft?.row.receivedQty === 4 && p.draft.row.receivedOn === "2026-10-01",
    "Received purchase units and date survive construction.");
  const transit = purchase({ movedUnits: 0 });
  check(transit.draft?.row.receivedQty === 0 && transit.draft.row.inTransit === true,
    "A paid lot that has not arrived stays in transit.");
  check(purchase({ cash: 0, movedUnits: 0 }).draft?.row.pending === true,
    "Nothing moved on a purchase is a pending lot.");
  check(purchase({ handover: "delivered", freight: 0 }).draft?.row.handover === "delivered",
    "A supplier-delivered lot has no freight.");
  check(!!sale({ handover: "collected" }).error, "Collected sales cannot charge delivery.");
  check(!!purchase({ handover: "delivered" }).error, "Supplier-delivered lots cannot charge freight.");
  check(!!purchase({ freight: 0 }).error, "Collected lots need freight.");

  const r2 = sale({ party: "AX1-ZED", assoc: "AX1-ZED", stream: "R2", downstream: "CX2-ZED" });
  check(r2.entry?.party === "AX1-ZED-R" && r2.entry.payload.party === "AX1-ZED",
    "R2 queue metadata books the bucket while its payload names the associate.");
  check(r2.draft?.row.customer === "AX1-ZED-R" && r2.draft.row.downstream === "CX2-ZED" && r2.draft.row.rev === "R2",
    "R2 uses bookR2 and keeps its named buyer separate.");
  check(r2.entry?.raw.includes("end buyer CX2-ZED"), "The idempotent queue's raw line distinguishes named R2 buyers.");
  check(sale({ party: "AX1-ZED", assoc: "AX1-ZED", stream: "R2" }).draft?.row.customer === "AX1-ZED-R",
    "An unnamed R2 buyer still books the resale account.");
  const r3 = sale({ assoc: "AX1-ZED", stream: "R3" });
  check(r3.draft?.row.customer === "CX1-ZED" && r3.draft.row.ref === "AX1-ZED" && r3.draft.row.refKg === 2,
    "R3 leaves the buyer on the row and credits the introduction.");
  const noBucket = book(); noBucket.state.roster = noBucket.state.roster.filter((c) => c !== "AX1-ZED-R");
  check(!!sale({ party: "AX1-ZED", assoc: "AX1-ZED", stream: "R2" }, noBucket).error,
    "R2 cannot invent a resale bucket.");
  for (const patch of [
    { assoc: "AX1-ZED" }, { stream: "R2" }, { downstream: "CX2-ZED" },
    { assoc: "AX1-ZED", stream: "R3", downstream: "CX2-ZED" },
    { assoc: "AX1-ZED", stream: "R2" }, { assoc: "AX9-ZED", stream: "R3" }
  ]) check(!!sale(patch).error, "Incomplete or contradictory attribution is refused: " + JSON.stringify(patch));

  for (const key of ["raw", "note", "payload", "more", "direction", "kind", "orderCode", "linkTo", "newId", "coverFree"])
    check(!!sale({ [key]: "invented prose" }).error, "Trade does not forward " + key + ".");
  for (const key of ["qty", "total", "cash", "movedUnits", "delivery"])
    for (const value of [-1, NaN, Infinity, "2", null, 1000001])
      check(!!sale({ [key]: value }).error, key + " refuses an invalid figure.");
  check(!!sale({ qty: 0 }).error, "Zero units are refused.");
  check(!!sale({ party: "CX9-ZED" }).error && !!sale({ party: "Invented Person" }).error,
    "Unknown codes and plaintext parties are refused.");
  check(!!sale({ product: "spare" }).error && !!sale({ product: "unknown" }).error,
    "Retired and unknown products are refused.");
  for (const value of ["", "2026-02-30", "2026-10-01T00:00:00Z", null])
    check(!!sale({ date: value }).error, "Trade dates must be real calendar dates.");
  for (const value of ["2026-10-01", "2026-10-01T08:00:00Z", "not-a-time", null])
    check(!!sale({ at: value }).error, "Trade timestamps must be canonical.");
  check(!!sale({ handover: "elsewhere" }).error, "Handover is a closed list.");
  check(!!purchase({ delivery: 2 }).error && !!purchase({ assoc: "AX1-ZED", stream: "R3" }).error,
    "Purchases cannot carry sale-only fields.");
  check(!!sale({ freight: 2 }).error, "Sales cannot carry purchase freight.");
  const noCost = book(); noCost.pricing.byProduct.salt.stockCost = null;
  check(!!sale({}, noCost).error && !!purchase({}, noCost).error, "Products with no cost still require their first lot by hand.");
  check(!!makerTradeEntry("trade", trade(), book()).error, "No generic trade operation exists.");
  check(!!makerTradeEntry("sale", [], book()).error && !!sale({}, { state: {}, version: null }).error,
    "Malformed bodies and a seeding mirror fail closed.");

  const twinBook = book();
  twinBook.sales.push({ customer: "CX1-ZED", date: "2026-10-01", qty: 2, total: 120, rid: "s100" });
  check(sale({}, twinBook).twin?.second === "s100", "A booked twin requires its exact separate-order confirmation.");
  check(!!sale({ second: "s100" }, twinBook).entry, "A confirmed second order names its booked twin.");
  check(!!sale({ second: "s999" }, twinBook).error && !!sale({ second: "s100" }).error,
    "Stale twin confirmations are refused.");
  check(makerQueuedTradeFault(s.entry, [{ ...s.entry, at: "2026-10-01T08:00:01.000Z" }]) !== "",
    "The same trade already queued is refused.");
  check(makerQueuedTradeFault(s.entry, [s.entry]) === "", "An identical timestamp remains an idempotent queue retry.");
  check(makerQueuedTradeFault(s.entry, [{ ...s.entry, payload: { ...s.entry.payload, cash: 10 } }]) !== "",
    "A changed body with the same timestamp is not an idempotent retry.");
  check(makerQueuedTradeFault(s.entry, [{ ...s.entry, at: "2026-10-01T08:00:01.000Z", payload: { ...s.entry.payload, product: "oil" } }]) === "",
    "A different book at the same figures is not a queued twin.");

  const set = tier();
  check(set.entry?.type === "TIER" && set.entry.payload.mode === "tierset" && set.entry.party === "CX1-ZED",
    "Tier input emits the normal tier queue contract.");
  check(set.draft?.collection === "tierset" && set.draft.row.tiers["CX1-ZED"].salt === 0.25,
    "Tier changes use the existing tier drafter.");
  check(set.draft?.flags.length === 1, "The drafter flags movement from the held tier.");
  check(tier({ tier: null }).draft?.row.tiers["CX1-ZED"].salt === null, "Null clears a product's held tier.");
  for (const value of [undefined, "", "Unknown", {}, [], { tiny: "Gold" }, { small: "Unknown" }, { mid: null }])
    check(!!tier({ tier: value }).error, "An invalid tier shape is refused.");
  check(!!tier({ code: "AX1-ZED-R" }).error, "Resale accounts hold their associate's tier, never one of their own.");
  check(!!tier({ code: "CX9-ZED" }).error && !!tier({ code: "Invented Person" }).error,
    "Tier input refuses unknown and plaintext codes.");
  check(!!tier({ product: "oil" }).error, "Fixed boards have no customer tier input.");
  check(!!tier({ product: "spare" }).error && !!tier({ product: "unknown" }).error,
    "Tier input refuses retired and unknown products.");
  check(!!tier({ raw: "invented prose" }).error && !!tier({ tiers: {} }).error,
    "Tier input cannot forward prose or arbitrary tier maps.");
  const noRule = book(); delete noRule.pricing.byProduct.salt.inputs;
  check(!!tier({}, noRule).error, "Missing tier policy fails closed.");
  /* 05 Oct 2026: on a drift book a customer's price is their held figure (21 Oct 2026: a % from -0.3 to 0.3) or the Set Price */
  const driftBook = book(); driftBook.pricing.byProduct.salt.inputs.policy.tierRule = { drift: true };
  check(tier({ tier: 0.3 }, driftBook).draft?.row.tiers["CX1-ZED"].salt === 0.3
    && tier({ tier: null }, driftBook).draft?.row.tiers["CX1-ZED"].salt === null
    && !!tier({ tier: "Gold" }, driftBook).error,
    "On a drift book the existing tier-set road accepts a % lift and null clear, and refuses a level.");
  const addDrift = (tiers) => makerLedgerInput("add-id", { at, code: "CZ4-TST", kind: "customer", parent: null, geo: null, tiers, unit: "pct",
    vault: { v: 1, salt: "cw==", iv: "aXY=", ct: "Y3Q=" } }, driftBook);
  check(addDrift({ salt: 0.3 }).entry?.payload.tiers.salt === 0.3 && addDrift({ salt: 0.3 }).draft?.collection === "roster"
    && addDrift({ salt: -0.3 }).entry?.payload.tiers.salt === -0.3
    && /from -0\.3 to 0\.3 \(-30% to \+30%\)[.]/.test(addDrift({ salt: "Gold" }).error || "") && /from -0\.3 to 0\.3 \(-30% to \+30%\)[.]/.test(addDrift({ salt: 2.5 }).error || "")
    && /from -0\.3 to 0\.3 \(-30% to \+30%\)[.]/.test(addDrift({ salt: -0.31 }).error || "") && /from -0\.3 to 0\.3 \(-30% to \+30%\)[.]/.test(addDrift({ salt: 0.31 }).error || ""),
    "Add ID on a drift book starts the customer on a % from -0.3 to 0.3 (a discount too) and refuses a level, -0.31, 0.31 and a % past that.");

  const loan = makerLedgerInput("loan", { at, form: "salt", direction: "out", product: "salt",
    code: "CX1-ZED", date: "2026-10-01", amount: 2 }, book());
  check(loan.draft?.collection === "loan" && loan.entry.payload.mode === "loan"
    && loan.entry.payload.note === null && loan.entry.payload.kg === 2,
    "in-kind lending uses the existing loan draft without accepting a note.");
  const cashLoan = makerLedgerInput("loan", { at, form: "cash", direction: "in",
    code: "CX1-ZED", date: "2026-10-01", amount: 120 }, book());
  check(cashLoan.draft?.row.form === "cash" && cashLoan.draft.row.product === null
    && cashLoan.entry.payload.rm === 120,
    "cash borrowing keeps its cash-only ledger shape.");
  check(!!makerLedgerInput("loan", { at, form: "cash", direction: "in", code: "CX1-ZED",
    date: "2026-10-01", amount: 5, note: "unchecked text" }, book()).error,
    "loan inputs reject arbitrary notes and unknown fields.");
  /* a loan sent twice books once (the admin stress triage of 11 Oct 2026, row 6): a booked twin is asked about, a queued one refused */
  const loanIn = { at, form: "salt", direction: "out", product: "salt", code: "CX1-ZED", date: "2026-10-01", amount: 2 };
  const withLoan = (patch = {}) => { const b = book(); b.state.loans.push({ rid: "l002", party: "CX1-ZED", direction: "out",
    form: "salt", product: "salt", valueKg: 2, valueRM: null, date: "2026-10-01", status: "open", ...patch }); return b; };
  const queues = (patch = {}, b = book()) => makerLedgerInput("loan", { ...loanIn, ...patch }, b).entry?.payload.mode === "loan";
  const askedLoan = makerLedgerInput("loan", loanIn, withLoan());
  check(!askedLoan.entry && askedLoan.twin?.second === "l002" && /already booked/.test(askedLoan.error),
    "a loan matching a booked one by party, direction, book, amount and date is asked about with the booked row's id, never queued silently.");
  check(queues({ second: "l002" }, withLoan()), "a booked twin confirmed with its own id is a separate loan and queues as any loan.");
  check(!queues({ second: "l003" }, withLoan()) && !queues({ second: true }, withLoan()),
    "a confirmation naming another row than the booked twin is refused.");
  check(queues({ second: true }, withLoan({ rid: undefined })), "a booked twin that carries no id is confirmed with true.");
  check(!queues({ second: "l002" }, book()), "a confirmation with no booked twin is refused: the twin has changed.");
  for (const [what, patch] of [["party", { code: "CX2-ZED" }], ["direction", { direction: "in" }], ["date", { date: "2026-10-02" }],
    ["amount", { amount: 3 }], ["book", { product: "oil" }], ["form", { form: "cash", product: undefined }]])
    check(queues(patch, withLoan()), "a loan differing from a booked one in its " + what + " is no twin and queues at once.");
  check(!queues({ amount: 120, form: "cash", product: undefined }, withLoan({ form: "cash", product: null, valueKg: null, valueRM: 120 })),
    "a cash loan is matched to a booked cash loan by its ringgit.");
  check(queues({ amount: 130, form: "cash", product: undefined }, withLoan({ form: "cash", product: null, valueKg: null, valueRM: 120 })),
    "a cash loan of other ringgit than a booked cash loan is no twin.");
  const loanA = makerLedgerInput("loan", loanIn, book()).entry;
  const loanB = (patch = {}) => makerLedgerInput("loan", { ...loanIn, at: "2026-10-01T08:00:07.000Z", ...patch }, book()).entry;
  check(makerQueuedLoanCheck(loanB(), [loanA]).queuedTwin?.at === at && /already queued/.test(makerQueuedLoanCheck(loanB(), [loanA]).error),
    "a loan queued or waiting under Approve is refused when the same one comes under a new request moment.");
  check(makerQueuedLoanCheck(loanA, [loanA]).retry === true && !makerQueuedLoanCheck(loanA, [loanA]).error,
    "one request retried under its own moment is no twin of itself.");
  for (const [what, patch] of [["party", { code: "CX2-ZED" }], ["direction", { direction: "in" }], ["date", { date: "2026-10-02" }],
    ["amount", { amount: 3 }], ["book", { product: "oil" }], ["form", { form: "cash", product: undefined }]])
    check(!makerQueuedLoanCheck(loanB(patch), [loanA]).error, "a loan differing from a queued one in its " + what + " is no twin.");
  const cashA = makerLedgerInput("loan", { ...loanIn, form: "cash", product: undefined, amount: 120 }, book()).entry;
  check(makerQueuedLoanCheck(loanB({ form: "cash", product: undefined, amount: 120 }), [cashA]).queuedTwin?.at === at
    && !makerQueuedLoanCheck(loanB({ form: "cash", product: undefined, amount: 130 }), [cashA]).error,
  "queued cash loans are twins by their ringgit, and a loan of other ringgit is none.");
  const repayment = makerLedgerInput("repay", { at, loan: "loan-test-1", date: "2026-10-01", amount: 2 }, book());
  check(repayment.draft?.collection === "repayment" && repayment.entry.payload.loan === "loan-test-1"
    && repayment.entry.payload.kg === 2,
    "repayment is tied to an open loan and retains its existing row shape.");
  check(!!makerLedgerInput("repay", { at, loan: "loan-test-1", date: "2026-10-01", amount: 6 }, book()).error,
    "repayment cannot exceed the remaining principal.");
  const gift = makerLedgerInput("gift", { at, product: "salt", code: "CX1-ZED",
    date: "2026-10-01", qty: 1, movedUnits: 1, handover: "collected" }, book());
  check(gift.draft?.collection === "sales" && gift.draft.row.goodwill && !gift.draft.row.rebate
    && gift.entry.payload.note === null,
    "a gift is goodwill without rebate, costed by the existing drafter.");
  const rewardBook = book();
  rewardBook.sales.push({ customer: "CX1-ZED", qty: 1, total: 1000, cost: 40, cash: 1000,
    deliveredQty: 1, date: "2026-09-01" });
  const redeemed = makerLedgerInput("redeem", { at, code: "CX1-ZED", date: "2026-10-01" }, rewardBook);
  check(redeemed.draft?.collection === "sales" && redeemed.entry.payload.mode === "redeem"
    && redeemed.entry.payload.balance === 1,
    "redemption derives its available balance from the Desk's recorded reward rules.");
  const advanceBook = book();
  advanceBook.sales.push({ customer: "CX1-ZED", qty: 1, total: 1000, cost: 40, cash: 1000,
      deliveredQty: 1, date: "2026-09-01" },
    { customer: "CX1-ZED", qty: 2, total: 120, cost: 80, cash: 0, deliveredQty: 1, date: "2026-09-02", rid: "sale-advance" });
  const offset = makerLedgerInput("redeem", { at, code: "CX1-ZED", date: "2026-10-01" }, advanceBook);
  check(offset.entry?.payload.mode === "amend" && offset.entry.payload.kind === "Correction"
    && offset.entry.payload.rid === "sale-advance" && offset.entry.payload.fields.rebateKg === 1,
    "an available reward offsets the oldest advance through its existing Correction.");

  const envelope = { v: 1, salt: "cw==", iv: "aXY=", ct: "Y3Q=" };
  const added = makerLedgerInput("add-id", { at, code: "CZ4-TST", kind: "customer",
    parent: null, geo: null, tiers: null, vault: envelope }, book());
  check(added.draft?.collection === "roster" && added.entry.payload.mode === "addid"
    && added.entry.payload.code === "CZ4-TST" && added.entry.payload.note === null,
    "Add ID queues only the derived code and already-encrypted vault envelope.");
  check(!!makerLedgerInput("add-id", { at, code: "CZ4-TST", kind: "customer",
    parent: null, geo: null, tiers: null, vault: null }, book()).error,
    "Add ID cannot enter the queue before its device vault is sealed.");
  const renamed = makerLedgerInput("amend-id", { at, from: "CX1-ZED", to: "CX1-YAK",
    geo: null, vault: envelope }, book());
  check(renamed.draft?.collection === "rename" && renamed.entry.payload.from === "CX1-ZED"
    && renamed.entry.payload.to === "CX1-YAK",
    "Amend ID queues a code-only rename after receiving the encrypted envelope.");
  const vaultOnly = makerLedgerInput("amend-id", { at, from: "CX1-ZED", to: "CX1-ZED",
    geo: null, vault: envelope }, book());
  check(vaultOnly.vaultOnly === true && !vaultOnly.entry,
    "a same-code name correction updates only the encrypted vault.");
  const placed = makerLedgerInput("place", { at, places: { "CX1-ZED": [3.13, 101.68, "Pudu"] } }, book());
  check(placed.draft?.collection === "place" && placed.entry.payload.places["CX1-ZED"].length === 3,
    "map placement writes only the approximate coordinates and their locality for a roster code.");
  check(!!makerLedgerInput("place", { at, places: { "CX1-ZED": [3.13, 101.68, "4 <Example> Road"] } }, book()).error,
    "placement locality rejects street-address detail before it can reach the Desk queue.");
  /* a point is filed only with its locality: the Counter's input and the drafter, the last check, both refuse a bare one */
  const bareAdd = makerLedgerInput("add-id", { at, code: "CZ4-TST", kind: "customer", parent: null, geo: [3.1, 101.7], tiers: null, vault: envelope }, book());
  const fullAdd = makerLedgerInput("add-id", { at, code: "CZ4-TST", kind: "customer", parent: null, geo: [3.1, 101.7, "Pudu"], tiers: null, vault: envelope }, book());
  check(!fullAdd.error && !!bareAdd.error, "an Add ID with a point and no locality is refused by the Counter input, the same with one is not: " + (fullAdd.error || ""));
  check(!!makerLedgerInput("place", { at, places: { "CX1-ZED": [3.13, 101.68] } }, book()).error,
    "a placement with a point and no locality is refused by the Counter input.");
  const { draftRow } = await import("../src/drafter.js");
  const bareEntry = (geo) => POSITION_ENGINE.addIdEntry({ at, code: "CZ4-TST", kind: "customer", parent: null, rev: null, geo, tiers: null });
  check(!!draftRow(bareEntry([3.1, 101.7]), book()).skip && !draftRow(bareEntry([3.1, 101.7, "Pudu"]), book()).skip,
    "the drafter refuses a roster entry whose point has no locality and drafts the same with one.");
  const barePlace = (g) => POSITION_ENGINE.placeEntry({ at, places: { "CX1-ZED": g } });
  check(!!draftRow(barePlace([3.1, 101.7]), book()).skip && !draftRow(barePlace([3.1, 101.7, "Pudu"]), book()).skip,
    "the drafter refuses a place entry whose point has no locality and drafts the same with one.");
  check(!!makerLedgerInput("gift", { at, product: "salt", code: "CX1-ZED", date: "2026-10-01",
    qty: 1, movedUnits: 1, handover: "collected", note: "unchecked text" }, book()).error,
    "gift inputs reject arbitrary notes.");
  /* a gift sent twice books once (the admin stress triage of 11 Oct 2026, row 7): a booked twin is asked about, a queued one refused */
  const giftIn = { at, product: "salt", code: "CX1-ZED", date: "2026-10-01", qty: 1, movedUnits: 1, handover: "collected" };
  const withGift = (patch = {}) => { const b = book(); b.sales.push({ rid: "s300", customer: "CX1-ZED", qty: 1, total: 40, cost: 40,
    cash: 0, settledRM: 40, goodwill: true, deliveredQty: 1, date: "2026-10-01", ...patch }); return b; };
  const gives = (patch = {}, b = book()) => makerLedgerInput("gift", { ...giftIn, ...patch }, b).entry?.payload.mode === "gift";
  const askedGift = makerLedgerInput("gift", giftIn, withGift());
  check(!askedGift.entry && askedGift.twin?.second === "s300" && /already booked/.test(askedGift.error),
    "a gift the fold would read as a booked row's replay is asked about with the booked row's id, never queued silently.");
  const confirmedGift = makerLedgerInput("gift", { ...giftIn, second: "s300" }, withGift());
  check(confirmedGift.entry?.payload.mode === "gift" && confirmedGift.entry.payload.second === "s300",
    "a booked twin confirmed with its own id is a separate gift, and the entry carries the confirmation the fold's replay guard reads.");
  check(!gives({ second: "s301" }, withGift()) && !gives({ second: true }, withGift()),
    "a confirmation naming another row than the booked twin is refused.");
  check(makerLedgerInput("gift", { ...giftIn, second: true }, withGift({ rid: undefined })).entry?.payload.second === true,
    "a booked twin that carries no id is confirmed with true.");
  check(!gives({ second: "s300" }), "a confirmation with no booked twin is refused: the twin has changed.");
  check(!Object.hasOwn(makerLedgerInput("gift", giftIn, book()).entry.payload, "second"),
    "a gift with no booked twin carries no confirmation.");
  for (const [what, patch, row] of [["party", { code: "CX2-ZED" }, {}], ["date", { date: "2026-10-02" }, {}], ["units", { qty: 2, movedUnits: 2 }, {}],
    ["book", {}, { product: "oil" }], ["cost", {}, { total: 50 }], ["units at one total", {}, { qty: 2 }]])
    check(gives(patch, withGift(row)), "a gift differing from a booked row in its " + what + " is no twin and queues at once.");
  check(!gives({}, withGift({ goodwill: undefined, settledRM: undefined, cost: undefined })),
    "the booked row is matched as the fold matches it, by party, book, date, units and total, whatever it is.");
  const giftA = makerLedgerInput("gift", giftIn, book()).entry;
  const giftB = (patch = {}) => makerLedgerInput("gift", { ...giftIn, at: "2026-10-01T08:00:07.000Z", ...patch }, book()).entry;
  check(makerQueuedGiftCheck(giftB(), [giftA]).queuedTwin?.at === at && /already queued/.test(makerQueuedGiftCheck(giftB(), [giftA]).error),
    "a gift queued or waiting under Approve is refused when the same one comes under a new request moment.");
  check(makerQueuedGiftCheck(giftA, [giftA]).retry === true && !makerQueuedGiftCheck(giftA, [giftA]).error,
    "one request retried under its own moment is no twin of itself.");
  for (const [what, patch] of [["party", { code: "CX2-ZED" }], ["date", { date: "2026-10-02" }],
    ["units", { qty: 2, movedUnits: 2 }], ["book", { product: "oil" }]])
    check(!makerQueuedGiftCheck(giftB(patch), [giftA]).error, "a gift differing from a queued one in its " + what + " is no twin.");

  const internal = POSITION_ENGINE.tradeEntry({
    at, product: "salt", direction: "SELL", party: "CX1-ZED", date: "2026-10-01", qty: 2, total: 120,
    cash: 40, movedUnits: 1, raw: "Desk supplied line", note: "Invented note",
    more: { coverUnits: 0.5, coverRM: 20 }, coverFree: 1, second: "s100"
  });
  check(internal.raw === "Desk supplied line" && internal.payload.note === "Invented note",
    "The shared constructor preserves Desk raw and note semantics internally.");
  check(internal.status === "partial" && internal.payload.more.coverRM === 20 && internal.payload.coverFree === 1
    && internal.payload.second === "s100", "Desk-only reward and second-order fields remain intact.");
  check(internal.payload.newId === null && internal.payload.kind === null && internal.payload.orderCode === null
    && internal.payload.linkTo === null && internal.payload.kg === 1, "Desk constructor keeps the persisted payload shape.");
  const batch = POSITION_ENGINE.tierSetEntry({ at, tiers: { "CX1-ZED": { salt: "Gold" }, "CX2-ZED": { salt: null } }, raw: "Desk tier line" });
  check(batch.party === null && batch.raw === "Desk tier line" && batch.payload.tiers["CX2-ZED"].salt === null,
    "The shared tier constructor also preserves Desk batch semantics.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let count = 0;
  await run({ ok(condition, message) { count++; if (!condition) throw new Error(message); } });
  console.log("maker inputs: " + count + " checks passed");
}
