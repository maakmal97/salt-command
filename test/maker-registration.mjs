import { readFileSync } from "node:fs";
import { world } from "./maker-trades.mjs";
import { approvedRows, APPROVED_SQL, readArgs } from "../tools/drafts.mjs";
import { apply, plan } from "../tools/fold.mjs";
import { verifiedVaultRegistration } from "../src/vault-pair.js";
import { makerInputCatalog, makerTradeEntry } from "../src/maker-inputs.js";
import POSITION_ENGINE from "../engine/position.mjs";

const foldMaster = readFileSync(new URL("../master/salt_command.html", import.meta.url), "utf8");
const nextVersion = Number(/const evolution=\[\{\s*v:\s*['"]v(\d+)['"]/.exec(foldMaster)?.[1] || 0) + 1;
const seal = (text) => ({ v: 1, salt: Buffer.alloc(16, 1).toString("base64"),
  iv: Buffer.alloc(12, 2).toString("base64"), ct: Buffer.from(text.padEnd(16, ".")).toString("base64") });

function pairWorld() {
  const wd = world();
  wd.desk.VAULT_STORE = "pair";
  wd.sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
    .run(JSON.stringify(seal("base-names")), null, "2099-10-01T00:00:00.000Z");
  return wd;
}

async function register(wd, at, code, kind = "customer", expectedRevision = 1) {
  const vault = seal("encrypted-" + code + "-" + at);
  const body = { at, code, kind, parent: null, tiers: null, vault,
    pair: { expectedRevision, names: vault, places: null } };
  const response = await wd.call("/all/maker/inputs/add-id", body);
  return { body, response, result: await response.json() };
}

const tradeBody = (at, party, patch = {}) => ({ at, product: "salt", party, date: "2099-10-09",
  qty: 1, total: 130, cash: 0, movedUnits: 0, handover: null, delivery: 0, ...patch });
const draft = (wd, id) => {
  const row = wd.sqlite.prepare("SELECT * FROM draft WHERE id=?1").get(id);
  return row ? { ...row, row: JSON.parse(row.row), entry: JSON.parse(row.entry),
    flags: JSON.parse(row.flags || "[]") } : null;
};
const approve = (wd, id) => wd.call("/all/maker/drafts/" + encodeURIComponent(id) + "/approve", {});
const draftsSource = readFileSync(new URL("../tools/drafts.mjs", import.meta.url), "utf8");
const approvedCommand = draftsSource.slice(draftsSource.indexOf("function approved() {"),
  draftsSource.indexOf("\nexport function approvedRows"));
const stageApproved = (wd) => {
  let output;
  /* the statement as wrangler is handed it (readArgs), so the one line a shell sees is the one that selects */
  Function("query", "approvedRows", "APPROVED_SQL", "console", approvedCommand + "\napproved();")(
    (sql) => wd.sqlite.prepare(JSON.parse(readArgs(sql).at(-1))).all(), approvedRows, APPROVED_SQL,
    { log: (text) => { output = JSON.parse(text); } });
  return output;
};
const foldBook = (wd) => {
  const book = JSON.parse(readFileSync(new URL("../ledger/book.json", import.meta.url), "utf8"));
  book.sales = []; book.purchases = []; book.roster = wd.b.state.roster.slice();
  book.associates = wd.b.state.associates.slice(); book.PRODUCTS = wd.b.state.PRODUCTS;
  return book;
};
const notesFor = (rows) => ({ version: "v" + nextVersion, title: "TEST", notes: ["<b>TEST</b>"],
  rows: Object.fromEntries(rows.map((item) => [item.id, { note: "Invented test trade." }])) });

export async function runApprovedSelection({ ok }) {
  const wd = pairWorld();
  try {
    const registrationAt = "2099-10-10T03:00:00.000Z";
    const tradeAt = "2099-10-09T03:00:00.000Z";
    const pendingAt = "2099-10-09T03:00:01.000Z";
    const committedAt = "2099-10-09T03:00:02.000Z";
    await register(wd, registrationAt, "CX2-SEN");
    await wd.call("/all/maker/inputs/sale", tradeBody(tradeAt, "CX2-SEN"));
    await approve(wd, registrationAt);
    await approve(wd, tradeAt);
    await wd.call("/all/maker/inputs/sale", tradeBody(pendingAt, "CX1-ZED", { total: 131 }));
    await wd.call("/all/maker/inputs/sale", tradeBody(committedAt, "CX1-ZED", { total: 132 }));
    await approve(wd, committedAt);
    wd.sqlite.prepare("UPDATE draft SET committed_at=?1 WHERE id=?2")
      .run("2099-10-12T01:00:00.000Z", committedAt);
    const staged = stageApproved(wd);
    ok(draft(wd, pendingAt)?.status === "pending"
      && draft(wd, committedAt)?.status === "approved"
      && staged.count === 2 && staged.approved.some((item) => item.id === registrationAt)
      && staged.approved.some((item) => item.id === tradeAt)
      && !staged.approved.some((item) => item.id === pendingAt || item.id === committedAt),
      "actual drafts approved command over migrated SQLite selects approved uncommitted rows, excluding pending and committed rows");
  } finally { wd.sqlite.close(); }
}

export async function run({ ok }) {
  const complete = pairWorld();
  try {
    const registrationAt = "2099-10-10T01:00:00.000Z", tradeAt = "2099-10-09T01:00:00.000Z";
    const registered = await register(complete, registrationAt, "CX2-SEN");
    const catalogResponse = await complete.call("/all/maker/inputs");
    const catalog = await catalogResponse.json();
    const retry = await register(complete, registrationAt, "CX2-SEN");
    const changed = await register(complete, registrationAt, "CX3-SEN");
    ok(registered.response.status === 200 && catalog.ok && catalog.catalog.parties.includes("CX2-SEN"),
      "pair-backed Add ID route: completed immutable registration appears in the native catalog");
    ok(retry.response.status === 200 && retry.result.replay === true
      && complete.sqlite.prepare("SELECT COUNT(*) AS n FROM draft WHERE id=?1").get(registrationAt).n === 1,
      "pair-backed Add ID retry: the same request identity returns its original receipt once");
    ok(changed.response.status === 409
      && complete.sqlite.prepare("SELECT COUNT(*) AS n FROM draft WHERE id=?1").get(registrationAt).n === 1,
      "pair-backed Add ID retry: changed identity conflicts without replacing the original draft");

    const tradeResponse = await complete.call("/all/maker/inputs/sale", tradeBody(tradeAt, "CX2-SEN"));
    const tradeDraft = draft(complete, tradeAt);
    ok(tradeResponse.status === 200 && tradeDraft?.status === "pending"
      && tradeDraft.entry.registrationDependencies?.length === 1
      && tradeDraft.entry.registrationDependencies[0].id === registrationAt
      && tradeDraft.entry.registrationDependencies[0].code === "CX2-SEN"
      && !Object.hasOwn(tradeBody(tradeAt, "CX2-SEN"), "registrationDependencies"),
      "native trade route admits only the server-verified registration and stamps its dependency without a caller authorization field");

    const roleWorld = pairWorld();
    try {
      const roles = [
        ["CX8-SEN", "customer"], ["CX9-SEN", "supplier"], ["CA8-SEN", "reseller"],
        ["CA9-SEN", "referral"], ["CX7-SEN", "downstream"]
      ];
      const registeredRoles = [];
      for (const [index, [code, kind]] of roles.entries()) {
        registeredRoles.push(await register(roleWorld, `2099-10-10T02:00:0${index}.000Z`, code, kind, index + 1));
      }
      const roleCatalog = await (await roleWorld.call("/all/maker/inputs")).json();
      const registrationAt = (index) => `2099-10-10T02:00:0${index}.000Z`;
      const r3PartyAt = "2099-10-09T02:00:10.000Z";
      const r3Party = await roleWorld.call("/all/maker/inputs/sale",
        tradeBody(r3PartyAt, "CX8-SEN", { assoc: "CA9-SEN", stream: "R3", total: 135 }));
      const r3PartyDraft = draft(roleWorld, r3PartyAt);
      ok(r3Party.status === 200 && r3PartyDraft?.entry.registrationDependencies?.length === 2
        && r3PartyDraft.entry.registrationDependencies.some((item) => item.id === registrationAt(0) && item.code === "CX8-SEN")
        && r3PartyDraft.entry.registrationDependencies.some((item) => item.id === registrationAt(3) && item.code === "CA9-SEN"),
      "R3 route: an off-book customer may buy through a registered referral, with both identities stamped as dependencies");
      const purchaseAt = "2099-10-09T02:00:11.000Z";
      const purchaseBody = tradeBody(purchaseAt, "CX9-SEN");
      delete purchaseBody.delivery; purchaseBody.freight = 5;
      const purchase = await roleWorld.call("/all/maker/inputs/purchase", purchaseBody);
      const purchaseDraft = draft(roleWorld, purchaseAt);
      const customerPurchaseAt = "2099-10-09T02:00:12.000Z";
      const customerPurchaseBody = tradeBody(customerPurchaseAt, "CX8-SEN");
      delete customerPurchaseBody.delivery; customerPurchaseBody.freight = 0;
      const customerPurchase = await roleWorld.call("/all/maker/inputs/purchase", customerPurchaseBody);
      const customerPurchaseDraft = draft(roleWorld, customerPurchaseAt);
      ok(purchase.status === 200 && purchaseDraft?.entry.registrationDependencies?.length === 1
        && purchaseDraft.entry.registrationDependencies[0].id === registrationAt(1)
        && purchaseDraft.entry.registrationDependencies[0].code === "CX9-SEN",
      "purchase route: an off-book supplier can be selected and its immutable Add ID is stamped for the fold");
      ok(customerPurchase.status === 200 && customerPurchaseDraft?.entry.registrationDependencies?.length === 1
        && customerPurchaseDraft.entry.registrationDependencies[0].id === registrationAt(0)
        && customerPurchaseDraft.entry.registrationDependencies[0].code === "CX8-SEN",
      "purchase route: ordinary trade-party eligibility follows verified non-bucket membership, not a supplier-only filter");
      const ordinaryTrades = [];
      for (const [index, [code]] of roles.entries()) {
        const at = `2099-10-09T02:00:0${index}.000Z`;
        ordinaryTrades.push({ code, at, response: await roleWorld.call("/all/maker/inputs/sale",
          tradeBody(at, code)) });
      }
      const r2At = "2099-10-09T02:01:00.000Z";
      const r2 = await roleWorld.call("/all/maker/inputs/sale",
        tradeBody(r2At, "CA8-SEN", { assoc: "CA8-SEN", stream: "R2", total: 131 }));
      const r3At = "2099-10-09T02:02:00.000Z";
      const r3 = await roleWorld.call("/all/maker/inputs/sale",
        tradeBody(r3At, "CX1-ZED", { assoc: "CA9-SEN", stream: "R3", total: 132 }));
      const downstreamAt = "2099-10-09T02:03:00.000Z";
      const downstream = await roleWorld.call("/all/maker/inputs/sale",
        tradeBody(downstreamAt, "AX1-ZED", { assoc: "AX1-ZED", stream: "R2", downstream: "CX7-SEN", total: 133 }));
      const wrongRoleAt = "2099-10-09T02:04:00.000Z";
      const wrongRole = await roleWorld.call("/all/maker/inputs/sale",
        tradeBody(wrongRoleAt, "CX1-ZED", { assoc: "CX8-SEN", stream: "R3", total: 134 }));
      const wrongR2At = "2099-10-09T02:04:01.000Z";
      const wrongR2 = await roleWorld.call("/all/maker/inputs/sale",
        tradeBody(wrongR2At, "CA9-SEN", { assoc: "CA9-SEN", stream: "R2", total: 136 }));
      const wrongDownstreamAt = "2099-10-09T02:04:02.000Z";
      const wrongDownstream = await roleWorld.call("/all/maker/inputs/sale",
        tradeBody(wrongDownstreamAt, "AX1-ZED", { assoc: "AX1-ZED", stream: "R2", downstream: "CX8-SEN", total: 137 }));
      const batchAt = "2099-10-09T02:04:03.000Z";
      const batchResponse = await roleWorld.call("/all/maker/inputs/sale", tradeBody(batchAt, "CX8-SEN", {
        total: 138, extras: [{ product: "oil", qty: 2, total: 30, cash: 0, movedUnits: 2 }]
      }));
      const batchDrafts = roleWorld.drafts().filter((item) => item.id === batchAt
        || item.id === new Date(Date.parse(batchAt) + 1).toISOString());
      const bucketRegistration = { id: "2099-10-10T02:01:00.000Z", code: "CA7-SEN-R", kind: "bucket", status: "pending" };
      const bucketCatalog = makerInputCatalog(roleWorld.b, {}, [], [bucketRegistration]);
      const bucketTrade = makerTradeEntry("sale", tradeBody("2099-10-09T02:04:04.000Z", "CA7-SEN-R"),
        roleWorld.b, null, [], [bucketRegistration]);
      const unsupported = await roleWorld.call("/all/maker/inputs/gift", tradeBody("2099-10-09T02:05:00.000Z", "CX8-SEN"));
      const roleDrafts = roleWorld.drafts();
      const stamped = (at, id, code) => roleDrafts.find((item) => item.id === at)
        ?.entry.registrationDependencies?.some((item) => item.id === id && item.code === code);
      ok(registeredRoles.every((item) => item.response.status === 200)
        && roles.every(([code]) => roleCatalog.catalog.parties.includes(code))
        && roleCatalog.catalog.associates.some((item) => item.code === "CA8-SEN" && item.resaleReady)
        && roleCatalog.catalog.associates.some((item) => item.code === "CA9-SEN" && item.resaleReady)
        && !roleCatalog.catalog.associates.some((item) => item.code === "CX8-SEN")
        && roles.every(([code]) => !roleCatalog.catalog.tierCustomers.includes(code)),
      "native catalog: unique verified non-bucket registrations join only party and appointment-kind associate selectors");
      ok(ordinaryTrades.every((item, index) => item.response.status === 200
        && stamped(item.at, registrationAt(index), item.code))
        && r2.status === 200 && stamped(r2At, "2099-10-10T02:00:02.000Z", "CA8-SEN")
        && r3.status === 200 && stamped(r3At, "2099-10-10T02:00:03.000Z", "CA9-SEN")
        && downstream.status === 200 && stamped(downstreamAt, "2099-10-10T02:00:04.000Z", "CX7-SEN"),
      "native trade routes: each non-bucket Add ID may be a party, R2/R3 require their appointment kind, and downstream requires its native kind");
      ok(wrongRole.status === 400 && wrongR2.status === 400 && wrongDownstream.status === 400
        && unsupported.status === 400
        && !roleDrafts.some((item) => [wrongRoleAt, wrongR2At, wrongDownstreamAt, "2099-10-09T02:05:00.000Z"].includes(item.id)),
      "native trade routes: customer-as-referrer, referral-as-R2-owner, wrong downstream kind and unsupported modes create no draft");
      ok(batchResponse.status === 200 && batchDrafts.length === 2 && batchDrafts.every((item) =>
        item.entry.registrationDependencies?.length === 1
          && item.entry.registrationDependencies[0].id === registrationAt(0)
          && item.entry.registrationDependencies[0].code === "CX8-SEN"),
      "multi-book route: every off-book row carries the same server-verified registration dependency");
      ok(!bucketCatalog.parties.includes(bucketRegistration.code),
      "native catalog excludes the bucket-shaped registration from party choices");
      ok(!!bucketTrade.error,
      "trade constructor refuses the bucket-shaped registration when it is named as a party");
    } finally { roleWorld.sqlite.close(); }

    const rejected = pairWorld();
    try {
      const item = await register(rejected, registrationAt, "CX4-SEN");
      const pendingTrade = await rejected.call("/all/maker/inputs/sale", tradeBody(tradeAt, "CX4-SEN"));
      await rejected.call("/all/maker/drafts/" + encodeURIComponent(registrationAt) + "/reject", {});
      const noCatalog = await (await rejected.call("/all/maker/inputs")).json();
      const noTrade = await rejected.call("/all/maker/inputs/sale", tradeBody("2099-10-09T01:00:01.000Z", "CX4-SEN"));
      const blockedApproval = await approve(rejected, tradeAt);
      ok(item.response.status === 200 && !noCatalog.catalog.parties.includes("CX4-SEN"),
        "rejected Add ID route: rejection removes catalog authority");
      ok(noTrade.status === 400 && rejected.drafts().length === 2,
        "rejected Add ID route: a new trade is refused without a draft");
      ok(pendingTrade.status === 200 && blockedApproval.status === 409 && draft(rejected, tradeAt)?.status === "pending",
        "rejected Add ID route: an already-drafted dependent trade cannot be approved");
      const rejectedDraft = draft(rejected, registrationAt);
      const rejectedReceipt = rejected.sqlite.prepare("SELECT id,fingerprint,request_fingerprint,revision,operation FROM vault_receipt WHERE id=?1")
        .get(registrationAt);
      const rejectedOutbox = rejected.sqlite.prepare("SELECT id,entry,state,completed_at FROM vault_outbox WHERE id=?1")
        .get(registrationAt);
      ok(verifiedVaultRegistration(rejectedDraft, rejectedReceipt, rejectedOutbox) === null,
        "registration proof: a rejected Add ID is not a verified registration");
    } finally { rejected.sqlite.close(); }

    const uncertain = pairWorld();
    try {
      await register(uncertain, registrationAt, "CX5-SEN");
      uncertain.sqlite.prepare("UPDATE vault_outbox SET state='pending',completed_at=NULL WHERE id=?1").run(registrationAt);
      const noCatalog = await (await uncertain.call("/all/maker/inputs")).json();
      const noTrade = await uncertain.call("/all/maker/inputs/sale", tradeBody(tradeAt, "CX5-SEN"));
      ok(!noCatalog.catalog.parties.includes("CX5-SEN"),
        "uncertain pair recovery: an incomplete outbox no longer authorizes catalog selection");
      ok(noTrade.status === 400 && uncertain.drafts().length === 1,
        "uncertain pair recovery: an incomplete outbox cannot authorize trade drafting");
    } finally { uncertain.sqlite.close(); }

    const conflict = pairWorld();
    try {
      await register(conflict, registrationAt, "CX6-SEN");
      const second = await register(conflict, "2099-10-11T01:00:00.000Z", "CX6-SEN", "supplier", 2);
      const noCatalog = await (await conflict.call("/all/maker/inputs")).json();
      const noTrade = await conflict.call("/all/maker/inputs/sale", tradeBody(tradeAt, "CX6-SEN"));
      ok(second.response.status === 200 && !noCatalog.catalog.parties.includes("CX6-SEN"),
        "conflicting Add ID identities fail closed instead of choosing one receipt for the shared code");
      ok(noTrade.status === 400 && conflict.drafts().length === 2,
        "conflicting Add ID identities cannot authorize a new trade draft");
    } finally { conflict.sqlite.close(); }

    const premature = await approve(complete, tradeAt);
    ok(premature.status === 409 && draft(complete, tradeAt)?.status === "pending",
      "approval guard: a trade remains pending until its verified Add ID is approved");
    await approve(complete, registrationAt);
    const approvedTrade = await approve(complete, tradeAt);
    ok(approvedTrade.status === 200 && draft(complete, tradeAt)?.status === "approved",
      "approval guard: the trade is approvable after its receipt- and outbox-matched Add ID is approved");
    complete.sqlite.prepare("UPDATE draft SET drafted_at=?1 WHERE id=?2")
      .run("2099-10-12T00:00:00.000Z", registrationAt);
    complete.sqlite.prepare("UPDATE draft SET drafted_at=?1 WHERE id=?2")
      .run("2099-10-11T00:00:00.000Z", tradeAt);
    const staged = stageApproved(complete);
    const originalOrder = staged.approved.map((item) => item.id);
    const planned = plan(foldBook(complete), staged, null);
    ok(originalOrder[0] === tradeAt && planned.refused.length === 0
      && planned.items.map((item) => item.id).join(",") === registrationAt + "," + tradeAt,
      "fold dependency: a trade staged earlier by timestamp is planned after its approved, receipt-matched Add ID");

    const tradeOnly = { ok: true, count: 1, approved: staged.approved.filter((item) => item.id === tradeAt) };
    const book = foldBook(complete), before = JSON.stringify(book);
    const refused = apply(book, tradeOnly, notesFor(tradeOnly.approved), foldMaster);
    ok(!refused.ok && refused.problems.some((problem) => problem.includes("approved, receipt- and outbox-matched Add ID"))
      && JSON.stringify(book) === before,
      "fold refusal: a dependent trade without its approved Add ID explicitly holds the batch before any book mutation");

    const changedEvidence = structuredClone(staged);
    const registeredItem = changedEvidence.approved.find((item) => item.id === registrationAt);
    registeredItem.vaultOutbox.entry.payload.code = "CX9-SEN";
    const evidenceBook = foldBook(complete), evidenceBefore = JSON.stringify(evidenceBook);
    const badApply = apply(evidenceBook, changedEvidence, notesFor(changedEvidence.approved), foldMaster);
    ok(!badApply.ok && badApply.problems.some((problem) => problem.includes("approved, receipt- and outbox-matched Add ID"))
      && JSON.stringify(evidenceBook) === evidenceBefore,
      "fold evidence: a changed outbox identity cannot authorize the dependent trade or partially change the book");

    const nativeRefusal = pairWorld();
    try {
      const rejectedRegistrationAt = "2099-10-16T01:00:00.000Z";
      const dependentTradeAt = "2099-10-15T01:00:00.000Z";
      const registration = await register(nativeRefusal, rejectedRegistrationAt, "CA7-SEN", "reseller");
      const dependent = await nativeRefusal.call("/all/maker/inputs/sale",
        tradeBody(dependentTradeAt, "CA7-SEN", { assoc: "CA7-SEN", stream: "R2" }));
      await approve(nativeRefusal, rejectedRegistrationAt);
      await approve(nativeRefusal, dependentTradeAt);
      const stagedRefusal = stageApproved(nativeRefusal);
      const proofRow = stagedRefusal.approved.find((item) => item.id === rejectedRegistrationAt);
      const refusalBook = foldBook(nativeRefusal);
      refusalBook.associates.push("CA7-SEN");
      const refusedPlan = plan(refusalBook, stagedRefusal, null);
      const refusalBefore = JSON.stringify(refusalBook);
      const refusedApply = apply(refusalBook, stagedRefusal, notesFor(stagedRefusal.approved), foldMaster);
      ok(registration.response.status === 200 && dependent.status === 200
        && proofRow && verifiedVaultRegistration(proofRow, proofRow.vaultReceipt, proofRow.vaultOutbox)
        && refusedPlan.refused.some((item) => item.id === rejectedRegistrationAt && /already an associate/.test(item.why))
        && refusedPlan.refused.some((item) => item.id === dependentTradeAt && /refused by the native fold plan/.test(item.why))
        && !refusedPlan.items.some((item) => item.id === dependentTradeAt)
        && !refusedApply.ok && JSON.stringify(refusalBook) === refusalBefore,
      "native fold success guard: a receipt-valid approved appointment refused by the current book also refuses its dependent trade without partial application");
    } finally { nativeRefusal.sqlite.close(); }

    const staleProof = pairWorld();
    try {
      await register(staleProof, registrationAt, "CX7-SEN");
      await staleProof.call("/all/maker/inputs/sale", tradeBody(tradeAt, "CX7-SEN"));
      await approve(staleProof, registrationAt);
      staleProof.sqlite.prepare("UPDATE vault_outbox SET entry=?1 WHERE id=?2")
        .run(JSON.stringify({ at: registrationAt, payload: { mode: "addid", code: "CX8-SEN", kind: "customer" } }), registrationAt);
      const blocked = await approve(staleProof, tradeAt);
      ok(blocked.status === 409 && draft(staleProof, tradeAt)?.status === "pending",
        "approval proof: a changed outbox identity cannot authorize approval even after the Add ID draft is approved");
    } finally { staleProof.sqlite.close(); }

    const already = pairWorld();
    try {
      const knownTradeAt = "2099-10-13T01:00:00.000Z";
      const existing = await already.call("/all/maker/inputs/sale", tradeBody(knownTradeAt, "CX1-ZED"));
      const knownDraft = draft(already, knownTradeAt);
      const oldBook = foldBook(already), noDependency = plan(oldBook, { ok: true, count: 1, approved: [{
        id: knownDraft.id, collection: knownDraft.collection, row: knownDraft.row, entry: knownDraft.entry
      }] }, null);
      ok(existing.status === 200 && !knownDraft.entry.registrationDependencies
        && noDependency.items.length === 1 && noDependency.refused.length === 0,
        "existing on-book Counter trades retain their established admission and fold path");
      const manualEntry = structuredClone(knownDraft.entry);
      delete manualEntry.makerRequest; delete manualEntry.registrationDependencies;
      manualEntry.at = "2099-10-14T01:00:00.000Z";
      manualEntry.payload.party = "CX9-LEG";
      const manualRow = { ...knownDraft.row, customer: "CX9-LEG" };
      const legacy = plan(foldBook(already), { ok: true, count: 1, approved: [{
        id: manualEntry.at, collection: "sales", row: manualRow, entry: manualEntry
      }] }, null);
      ok(legacy.items.length === 1 && legacy.refused.length === 0,
        "unrelated legacy hand-fold trades for unknown codes keep their existing path without native Maker dependencies");

      const lot = { rid: "registration-payment-lot", supplier: "CX9-MUT", product: "salt",
        date: "2099-10-01", qty: 2, total: 100, cash: 0, receivedQty: 0, status: "unpaid" };
      const paymentAt = "2099-10-15T01:00:00.000Z";
      const paymentEntry = POSITION_ENGINE.ledgerAmendmentEntry({ at: paymentAt, row: lot, direction: "BUY",
        kind: "Payment", date: "2099-10-15", cash: 10, movedUnits: 0, status: "partial" });
      paymentEntry.makerRequest = "native-maker-request";
      const payment = plan({ sales: [], purchases: [lot], PRODUCTS: { salt: {} }, roster: [] }, {
        ok: true, count: 1, approved: [{ id: paymentAt, collection: "purchases", row: { ...lot, cash: 10 },
          entry: paymentEntry, amends: lot.rid, amendKind: "Payment" }]
      }, null);
      ok(payment.items.length === 1 && payment.refused.length === 0,
        "fold dependency scope: Maker purchase amendments keep their existing path and are not treated as new trades");
    } finally { already.sqlite.close(); }
  } finally { complete.sqlite.close(); }
}
