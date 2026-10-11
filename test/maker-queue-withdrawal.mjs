import { readFileSync, readdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { landingPage } from "../stmt/page.js";

const OWNER = { email: "maakmal97@icloud.com" };
const KEY = "counter-queue-withdrawal-test-key-0123456789";

function world(DatabaseSync, worker, handleMaker) {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => /^\d+_.*[.]sql$/.test(name)).sort())
    db.exec(readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"));
  db.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run("PRODUCTS", JSON.stringify({ salt: {} }));
  db.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run("roster", JSON.stringify(["CX1-ZED"]));
  db.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run("QUEUE_COMMITTED", JSON.stringify("2026-09-01T00:00:00.000Z"));
  db.prepare("INSERT INTO snapshot(one,v,stamped) VALUES (1,'queue-fixture',NULL)").run();
  const bound = (statement, args) => ({
    run() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
    first() { return statement.get(...args) || null; },
    all() { return { results: statement.all(...args) }; }
  });
  const d1 = {
    prepare(sql) {
      const statement = db.prepare(sql);
      return Object.assign(bound(statement, []), { bind: (...args) => bound(statement, args) });
    },
    batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((statement) => statement.run());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
  const memory = new Map();
  const kv = {
    async get(key) { return memory.get(key) ?? null; },
    async put(key, value) { memory.set(key, value); },
    async delete(key) { memory.delete(key); },
    async list({ prefix = "" } = {}) {
      return { keys: [...memory.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
    }
  };
  const deskEnv = { SALT_LEDGER: d1, SALT_QUEUE: kv, COUNTER_MAKER_KEY: KEY };
  const counterEnv = { STMT: kv, COUNTER_MAKER_KEY: KEY,
    DESK_MAKER: { fetch: (request) => worker.fetch(request, deskEnv, { waitUntil() {} }) } };
  const call = (path, method = "GET", body) => handleMaker(new Request("https://counter.test" + path, {
    method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  }), counterEnv, path, OWNER);
  const upload = (device, queue) => worker.fetch(new Request("https://desk.test/queue", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ device, queue })
  }), deskEnv, { waitUntil() {} });
  const recover = (at, device, fingerprint) => worker.fetch(new Request(
    "https://desk.test/queue/" + encodeURIComponent(at) + "/withdraw", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ device, fingerprint })
    }), deskEnv, { waitUntil() {} });
  return { db, d1, kv, memory, deskEnv, counterEnv, call, upload, recover };
}

export async function run({ ok, worker, handleMaker }) {
  const { DatabaseSync } = await import("node:sqlite");
  const w = world(DatabaseSync, worker, handleMaker);
  const at = "2099-10-05T02:00:00.000Z";
  const refusedEntry = { at, date: "2099-10-05", payload: { mode: "unsupported" } };
  const uploaded = await w.upload("phone-A", [refusedEntry]);
  const { runDrafter: drafter } = await import("../src/drafter.js");
  await drafter({ SALT_LEDGER: w.d1, SALT_QUEUE: w.kv });

  const reviewResponse = await w.call("/all/maker/review");
  const review = await reviewResponse.json();
  const refused = review.queue?.find((entry) => entry.id === at);
  ok(uploaded.status === 200 && w.db.prepare("SELECT operation FROM maker_request WHERE id=?")
      .get("queue-owner:" + at)?.operation === "queue-owner"
    && reviewResponse.status === 200 && refused?.state === "refused"
    && refused.why && refused.refusalSource === "cloud-drafter" && refused.seenAt
    && refused.date === refusedEntry.date && refused.device === "phone-A",
  "Counter Admin sees the drafter's authoritative refusal, source and date for the uniquely server-held device entry");

  const withdrawPath = "/all/maker/queue/" + encodeURIComponent(at) + "/withdraw";
  const first = await w.call(withdrawPath, "POST", { fingerprint: refused?.fingerprint });
  const firstBody = await first.json();
  const receipt = w.db.prepare("SELECT operation,fingerprint,entry,response FROM maker_request WHERE id=?")
    .get("queue-withdraw:" + at);
  const afterFirst = JSON.parse((await w.kv.get("q:phone-A")));
  const retry = await w.call(withdrawPath, "POST", { fingerprint: refused?.fingerprint });
  const retryBody = await retry.json();
  ok(first.status === 200 && firstBody.state === "withdrawn" && firstBody.withdrawn === at && receipt?.operation === "queue-withdraw"
    && JSON.parse(receipt.entry).device === "phone-A" && receipt.response
    && !afterFirst.queue.some((entry) => entry.at === at)
    && retry.status === 200 && retryBody.again === true,
  "the owner withdraws only the immutable, uniquely owned server entry and a retry returns its saved receipt");

  const stalePost = await w.upload("phone-A", [refusedEntry]);
  const staleBody = await stalePost.json();
  const drained = await worker.fetch(new Request("https://desk.test/queue"), w.deskEnv);
  const drainedBody = await drained.json();
  await drafter({ SALT_LEDGER: w.d1, SALT_QUEUE: w.kv });
  ok(stalePost.status === 200 && staleBody.withdrawnAts.includes(at)
    && !JSON.parse(await w.kv.get("q:phone-A")).queue.some((entry) => entry.at === at)
    && !drainedBody.queue.some((entry) => entry.at === at)
    && !w.db.prepare("SELECT id FROM draft WHERE id=?").get(at)
    && !w.db.prepare("SELECT id FROM refused WHERE id=?").get(at),
  "a stale upload cannot restore a withdrawn refusal to the drain or drafter, and the next pass retires its cloud refusal");

  const publicAt = "2099-10-05T02:00:30.000Z";
  const publicEntry = { at: publicAt, date: "2099-10-05", payload: { mode: "ordinary" } };
  await w.upload("phone-C", [publicEntry]);
  const { makerRequestFingerprint } = await import("../src/maker-request.js");
  const publicFingerprint = await makerRequestFingerprint("server-queue-entry", publicEntry);
  const originalPut = w.kv.put;
  w.kv.put = async (key, value) => {
    if (key === "q:phone-C") throw new Error("injected KV write uncertainty");
    return originalPut.call(w.kv, key, value);
  };
  const uncertain = await w.recover(publicAt, "phone-C", publicFingerprint);
  w.kv.put = originalPut;
  const pendingReceipt = w.db.prepare("SELECT operation,response FROM maker_request WHERE id=?")
    .get("queue-withdraw:" + publicAt);
  const recovered = await w.recover(publicAt, "phone-C", publicFingerprint);
  const recoveredBody = await recovered.json();
  const repeated = await w.recover(publicAt, "phone-C", publicFingerprint);
  const repeatedBody = await repeated.json();
  const stalePublicUpload = await w.upload("phone-C", [publicEntry]);
  const stalePublicBody = await stalePublicUpload.json();
  ok(uncertain.status === 503 && (await uncertain.json()).state === "withdrawal-pending"
    && pendingReceipt?.operation === "queue-withdraw" && !pendingReceipt.response
    && recovered.status === 200 && recoveredBody.state === "withdrawn" && recoveredBody.withdrawn === publicAt
    && repeated.status === 200 && repeatedBody.again === true && stalePublicBody.withdrawnAts.includes(publicAt)
    && !JSON.parse(await w.kv.get("q:phone-C")).queue.some((entry) => entry.at === publicAt),
  "same-origin withdrawal persists before an uncertain KV write, retries its immutable receipt, and fences a delayed upload");

  const stuckAt = "2099-10-05T02:00:45.000Z";
  const serverEntry = { at: stuckAt, date: "2099-10-05", payload: { mode: "ordinary" } };
  await w.upload("phone-C", [serverEntry]);
  const serverFingerprint = await makerRequestFingerprint("server-queue-entry", serverEntry);
  const localFingerprint = await makerRequestFingerprint("server-queue-entry", { ...serverEntry, stuck: true });
  const mismatchRecovery = await w.recover(stuckAt, "phone-C", localFingerprint);
  const mismatchRecoveryBody = await mismatchRecovery.json();
  const stillHeld = JSON.parse(await w.kv.get("q:phone-C")).queue.some((entry) => entry.at === stuckAt);
  const noReceiptYet = !w.db.prepare("SELECT id FROM maker_request WHERE id=?").get("queue-withdraw:" + stuckAt);
  const confirmedRecovery = await w.recover(stuckAt, "phone-C", mismatchRecoveryBody.serverFingerprint);
  const confirmedRecoveryBody = await confirmedRecovery.json();
  ok(mismatchRecovery.status === 409 && mismatchRecoveryBody.state === "entry-changed"
    && mismatchRecoveryBody.serverFingerprint === serverFingerprint && stillHeld && noReceiptYet
    && confirmedRecovery.status === 200 && confirmedRecoveryBody.state === "withdrawn"
    && !JSON.parse(await w.kv.get("q:phone-C")).queue.some((entry) => entry.at === stuckAt),
  "local-only queue metadata gets a non-mutating server fingerprint, then requires a second exact-identity withdrawal request");

  const lostAnswerAt = "2099-10-05T02:00:50.000Z";
  const lostAnswerEntry = { at: lostAnswerAt, date: "2099-10-05", payload: { mode: "ordinary" } };
  await w.upload("phone-C", [lostAnswerEntry]);
  const lostAnswerFingerprint = await makerRequestFingerprint("server-queue-entry", lostAnswerEntry);
  await w.recover(lostAnswerAt, "phone-C", lostAnswerFingerprint);
  const changedRetryFingerprint = await makerRequestFingerprint("server-queue-entry", { ...lostAnswerEntry, stuck: true });
  const lostAnswerRetry = await w.recover(lostAnswerAt, "phone-C", changedRetryFingerprint);
  const lostAnswerRetryBody = await lostAnswerRetry.json();
  ok(lostAnswerRetry.status === 409 && lostAnswerRetryBody.state === "entry-changed"
    && !Object.hasOwn(lostAnswerRetryBody, "serverFingerprint"),
  "a changed local retry cannot use a terminal receipt as a queue-readback challenge after the queue copy is gone");

  const pendingAt = "2099-10-05T02:01:00.000Z";
  const pendingEntry = { at: pendingAt, date: "2099-10-05", payload: { mode: "unsupported" } };
  w.db.prepare("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES (?,'pending','sales',?,'{}','fixture','fixture',?)")
    .run(pendingAt, JSON.stringify(pendingEntry), pendingAt);
  await w.upload("phone-A", [pendingEntry]);
  const pendingList = await w.call("/all/maker/queue");
  const pendingQueue = await pendingList.json();
  const pendingCard = pendingQueue.entries?.find((entry) => entry.id === pendingAt);
  const pendingWithdraw = await w.call("/all/maker/queue/" + encodeURIComponent(pendingAt) + "/withdraw",
    "POST", { fingerprint: pendingCard?.fingerprint });
  ok(pendingCard?.state === "drafted" && !pendingCard.canWithdraw
    && pendingWithdraw.status === 409 && (await pendingWithdraw.json()).state === "drafted"
    && JSON.parse(await w.kv.get("q:phone-A")).queue.some((entry) => entry.at === pendingAt),
  "a row that reached pending drafts cannot be withdrawn through the queue road and remains for native Reject");
  const rejected = await w.call("/all/maker/drafts/" + encodeURIComponent(pendingAt) + "/reject", "POST", {});
  const rejectedRecovery = await w.recover(pendingAt, "phone-A",
    await makerRequestFingerprint("server-queue-entry", pendingEntry));
  const rejectedRecoveryBody = await rejectedRecovery.json();
  ok(rejected.status === 200 && rejectedRecovery.status === 200 && rejectedRecoveryBody.state === "rejected"
    && rejectedRecoveryBody.confirmedAbsent === true && rejectedRecoveryBody.withdrawn === pendingAt
    && w.db.prepare("SELECT status FROM draft WHERE id=?").get(pendingAt)?.status === "rejected"
    && !JSON.parse(await w.kv.get("q:phone-A")).queue.some((entry) => entry.at === pendingAt),
  "after native Reject drops the uploaded copy, only its matching device receipt and rejected draft confirm absence");

  const mismatchAt = "2099-10-05T02:01:30.000Z";
  const mismatchEntry = { at: mismatchAt, date: "2099-10-05", payload: { mode: "ordinary" } };
  await w.upload("phone-A", [mismatchEntry]);
  const mismatchFingerprint = await makerRequestFingerprint("server-queue-entry", mismatchEntry);
  const foreignDevice = await w.recover(mismatchAt, "phone-B", mismatchFingerprint);
  const changedEntry = await w.recover(mismatchAt, "phone-A", "b".repeat(64));
  const changedEntryBody = await changedEntry.json();
  ok(foreignDevice.status === 409 && (await foreignDevice.json()).state === "ownership-conflict"
    && changedEntry.status === 409 && changedEntryBody.state === "entry-changed"
    && changedEntryBody.serverFingerprint === mismatchFingerprint
    && JSON.parse(await w.kv.get("q:phone-A")).queue.some((entry) => entry.at === mismatchAt),
  "same-origin recovery rejects a foreign device and returns a changed fingerprint only while the exact owned queue row remains held");

  const approvedAt = "2099-10-05T02:02:00.000Z";
  const approvedEntry = { at: approvedAt, date: "2099-10-05", payload: { mode: "unsupported" } };
  w.db.prepare("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES (?,'approved','sales',?,'{}','fixture','fixture',?)")
    .run(approvedAt, JSON.stringify(approvedEntry), approvedAt);
  await w.upload("phone-A", [approvedEntry]);
  const approvedReview = await (await w.call("/all/maker/queue")).json();
  const approvedCard = approvedReview.entries?.find((entry) => entry.id === approvedAt);
  const approvedWithdraw = await w.call("/all/maker/queue/" + encodeURIComponent(approvedAt) + "/withdraw",
    "POST", { fingerprint: approvedCard?.fingerprint });
  ok(approvedCard?.state === "approved" && !approvedCard.canWithdraw && approvedWithdraw.status === 409
    && (await approvedWithdraw.json()).state === "approved"
    && JSON.parse(await w.kv.get("q:phone-A")).queue.some((entry) => entry.at === approvedAt),
  "an approved row is never withdrawn or removed from its owning queue");

  const committedAt = "2099-10-05T02:02:30.000Z";
  const committedEntry = { at: committedAt, date: "2099-10-05", payload: { mode: "unsupported" } };
  w.db.prepare("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at,committed_at) VALUES (?,'approved','sales',?,'{}','fixture','fixture',?,?)")
    .run(committedAt, JSON.stringify(committedEntry), committedAt, "2099-10-05T02:03:00.000Z");
  await w.upload("phone-A", [committedEntry]);
  const committedCard = (await w.call("/all/maker/queue").then((response) => response.json()))
    .entries?.find((entry) => entry.id === committedAt);
  const committedWithdraw = await w.call("/all/maker/queue/" + encodeURIComponent(committedAt) + "/withdraw",
    "POST", { fingerprint: committedCard?.fingerprint });
  ok(committedCard?.state === "committed" && committedWithdraw.status === 409
    && (await committedWithdraw.json()).state === "committed"
    && JSON.parse(await w.kv.get("q:phone-A")).queue.some((entry) => entry.at === committedAt),
  "a committed row is never withdrawn or removed from its owning queue");

  const approvalRaceAt = "2099-10-05T02:03:30.000Z";
  const approvalRaceEntry = { at: approvalRaceAt, date: "2099-10-05", payload: { mode: "ordinary" } };
  await w.upload("phone-D", [approvalRaceEntry]);
  const approvalRaceFingerprint = await makerRequestFingerprint("server-queue-entry", approvalRaceEntry);
  const ledger = w.deskEnv.SALT_LEDGER;
  w.deskEnv.SALT_LEDGER = {
    prepare(sql) { return ledger.prepare(sql); },
    batch(statements) {
      w.db.prepare("INSERT INTO draft(id,status,collection,entry,row,reasoning,drafter,drafted_at) VALUES (?,'approved','sales',?,'{}','fixture','fixture',?)")
        .run(approvalRaceAt, JSON.stringify(approvalRaceEntry), approvalRaceAt);
      return ledger.batch(statements);
    }
  };
  const approvalRace = await w.recover(approvalRaceAt, "phone-D", approvalRaceFingerprint);
  w.deskEnv.SALT_LEDGER = ledger;
  ok(approvalRace.status === 409 && (await approvalRace.json()).state === "approved"
    && !w.db.prepare("SELECT id FROM maker_request WHERE id=?").get("queue-withdraw:" + approvalRaceAt)
    && JSON.parse(await w.kv.get("q:phone-D")).queue.some((entry) => entry.at === approvalRaceAt),
  "a draft appearing approved between the precheck and atomic withdrawal claim wins without a tombstone or queue deletion");

  const duplicateAt = "2099-10-05T02:04:00.000Z";
  const duplicateEntry = { at: duplicateAt, date: "2099-10-05", payload: { mode: "unsupported" } };
  await w.kv.put("q:phone-A", JSON.stringify({ device: "phone-A", queue: [duplicateEntry] }));
  await w.kv.put("q:phone-B", JSON.stringify({ device: "phone-B", queue: [duplicateEntry] }));
  const duplicateReview = await (await w.call("/all/maker/queue")).json();
  const duplicateCard = duplicateReview.entries?.find((entry) => entry.id === duplicateAt);
  const duplicateWithdraw = await w.call("/all/maker/queue/" + encodeURIComponent(duplicateAt) + "/withdraw",
    "POST", { fingerprint: duplicateCard?.fingerprint || "a".repeat(64) });
  ok(duplicateCard?.devices?.length === 2 && !duplicateCard.canWithdraw && duplicateWithdraw.status === 409
    && JSON.parse(await w.kv.get("q:phone-A")).queue.some((entry) => entry.at === duplicateAt)
    && JSON.parse(await w.kv.get("q:phone-B")).queue.some((entry) => entry.at === duplicateAt),
  "a timestamp present on two devices has no inferred owner and fails closed without deleting either copy");

  const foreignAt = "2099-10-05T02:05:00.000Z";
  const foreignEntry = { at: foreignAt, date: "2099-10-05", payload: { mode: "unsupported" } };
  await w.kv.put("q:phone-A", JSON.stringify({ device: "phone-A", queue: [foreignEntry] }));
  w.db.prepare("INSERT INTO input_admission(id,fingerprint,resource,amount,snapshot,entry,state) VALUES (?,?,?,?,?,?,?)")
    .run(foreignAt, "foreign-admission", "loan:loan-1", 1, "queue-fixture", JSON.stringify(foreignEntry), "accepted");
  w.db.prepare("INSERT INTO input_admission_source(id,source) VALUES (?,?)").run(foreignAt, "orders");
  const foreignReview = await (await w.call("/all/maker/queue")).json();
  const foreignCard = foreignReview.entries?.find((entry) => entry.id === foreignAt);
  const foreignWithdraw = await w.call("/all/maker/queue/" + encodeURIComponent(foreignAt) + "/withdraw",
    "POST", { fingerprint: foreignCard?.fingerprint });
  ok(!foreignCard?.canWithdraw && foreignWithdraw.status === 409
    && JSON.parse(await w.kv.get("q:phone-A")).queue.some((entry) => entry.at === foreignAt)
    && w.db.prepare("SELECT state FROM input_admission WHERE id=?").get(foreignAt).state === "accepted",
  "an orders-owned resource admission cannot be withdrawn through a device queue even when its timestamp appears there");

  const resourceAt = "2099-10-05T02:05:30.000Z";
  const E = (await import("../engine/position.mjs")).default;
  const { admitInput, claimDeviceQueueWithdrawal } = await import("../src/input-admission.js");
  const loan = { rid: "loan-withdrawal-fence", party: "CX1-ZED", form: "cash", direction: "in",
    valueRM: 5, status: "open", date: "2099-10-01", repaid: [] };
  const resourceEntry = E.repaymentEntry({ at: resourceAt, loan, party: loan.party, date: "2099-10-05",
    form: "cash", product: "salt", amount: 1 });
  w.db.prepare("INSERT INTO maker_request(id,operation,fingerprint,entry) VALUES (?,'queue-withdraw','fence','{}')")
    .run("queue-withdraw:" + resourceAt);
  const resourceAdmission = await admitInput(w.d1, resourceEntry,
    { version: "queue-fixture", state: { loans: [loan] }, sales: [], purchases: [] }, "device:phone-A");
  ok(!!resourceAdmission.error && !w.db.prepare("SELECT id FROM input_admission WHERE id=?").get(resourceAt),
  "a durable withdrawal tombstone also blocks resource admission before a claim or source can be written");

  const conflictAt = "2099-10-05T02:05:45.000Z";
  w.db.prepare("INSERT INTO input_admission(id,fingerprint,resource,amount,snapshot,entry,state) VALUES (?,?,?,?,?,?,?)")
    .run(conflictAt, "admission-fingerprint", "loan:loan-1", 1, "queue-fixture", "{}", "accepted");
  w.db.prepare("INSERT INTO maker_request(id,operation,fingerprint,entry) VALUES (?,'queue-withdraw','existing','{}')")
    .run("queue-withdraw:" + conflictAt);
  const conflictingClaim = await claimDeviceQueueWithdrawal(w.d1, conflictAt, "phone-A", "c".repeat(64));
  ok(!!conflictingClaim.error
    && w.db.prepare("SELECT state FROM input_admission WHERE id=?").get(conflictAt).state === "accepted",
  "a conflicting withdrawal receipt cannot mutate an admission when its atomic claim does not match");

  const raceAt = "2099-10-05T02:06:00.000Z";
  const sale = { at: raceAt, payload: { mode: "new", direction: "SELL", party: "CX1-ZED",
    product: "salt", qty: 1, total: 90, cash: 90, kg: 1, date: "2099-10-05" } };
  await w.kv.put("q:race-phone", JSON.stringify({ device: "race-phone", queue: [sale] }));
  w.db.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run("PRICING",
    JSON.stringify({ v: "queue-fixture", byProduct: { salt: { stockCost: 40, replCost: 40, floors: { "1": { floor: 40 } } } } }));
  const raceD1 = {
    prepare(sql) {
      const statement = w.db.prepare(sql);
      const bound = (args) => ({
        run() {
          if (sql.startsWith("INSERT OR IGNORE INTO draft")) {
            w.db.prepare("INSERT INTO maker_request(id,operation,fingerprint,entry) VALUES (?,'queue-withdraw','race',?)")
              .run("queue-withdraw:" + raceAt, JSON.stringify({ device: "race-phone", fingerprint: "race" }));
          }
          return { meta: { changes: Number(statement.run(...args).changes) } };
        },
        first() { return statement.get(...args) || null; },
        all() { return { results: statement.all(...args) }; }
      });
      return Object.assign(bound([]), { bind: (...args) => bound(args) });
    },
    batch(statements) { return w.d1.batch(statements); }
  };
  const raced = await drafter({ SALT_LEDGER: raceD1, SALT_QUEUE: w.kv });
  ok(raced.ok && !w.db.prepare("SELECT id FROM draft WHERE id=?").get(raceAt),
  "a tombstone injected between the drafter's read and draft insert wins atomically and leaves no actionable draft");

  const sourceAt = "2099-10-05T02:06:30.000Z";
  w.db.prepare("INSERT INTO input_admission(id,fingerprint,resource,amount,snapshot,entry,state) VALUES (?,?,?,?,?,?,?)")
    .run(sourceAt, "held-resource", "loan:held", 0.4, "queue-fixture",
      JSON.stringify({ at: sourceAt, payload: { mode: "repay" } }), "accepted");
  for (const source of ["orders", "drafter"])
    w.db.prepare("INSERT INTO input_admission_source(id,source) VALUES (?,?)").run(sourceAt, source);
  const sourcesRemain = () => {
    const admission = w.db.prepare("SELECT state FROM input_admission WHERE id=?").get(sourceAt);
    const owners = w.db.prepare("SELECT source FROM input_admission_source WHERE id=? ORDER BY source").all(sourceAt)
      .map((row) => row.source);
    return admission?.state === "accepted" && JSON.stringify(owners) === JSON.stringify(["drafter", "orders"]);
  };
  const pause = () => {
    let enter, open;
    const entered = new Promise((resolve) => { enter = resolve; });
    const held = new Promise((resolve) => { open = resolve; });
    return { entered, enter, held, open };
  };
  const uploadDevice = "phone-upload-race";
  const uploadOther = { at: "2099-10-05T02:06:45.000Z", date: "2099-10-05", payload: { mode: "ordinary" } };
  ok((await w.upload(uploadDevice, [uploadOther])).status === 200,
    "the upload-lock interleaving starts with an unrelated held queue row");
  const uploadRace = { at: "2099-10-05T02:06:50.000Z", date: "2099-10-05", payload: { mode: "ordinary" } };
  const uploadFingerprint = await makerRequestFingerprint("server-queue-entry", uploadRace);
  const uploadPause = pause();
  const raceOriginalPut = w.kv.put;
  let uploadPaused = false;
  w.kv.put = async (key, value) => {
    if (!uploadPaused && key === "q:" + uploadDevice
      && JSON.parse(value).queue.some((entry) => entry.at === uploadRace.at)) {
      uploadPaused = true;
      w.memory.set(key, value);
      uploadPause.enter();
      await uploadPause.held;
      return;
    }
    return raceOriginalPut.call(w.kv, key, value);
  };
  let uploading, uploadBlockedWithdrawal;
  try {
    uploading = w.upload(uploadDevice, [uploadOther, uploadRace]);
    await uploadPause.entered;
    uploadBlockedWithdrawal = await w.recover(uploadRace.at, uploadDevice, uploadFingerprint);
  } finally {
    w.kv.put = raceOriginalPut;
    uploadPause.open();
  }
  const uploadBlockedBody = await uploadBlockedWithdrawal.json();
  const queueWhileUploadHeld = JSON.parse(await w.kv.get("q:" + uploadDevice));
  const noUploadRaceReceipt = !w.db.prepare("SELECT id FROM maker_request WHERE id=?")
    .get("queue-withdraw:" + uploadRace.at);
  const uploadResult = await uploading;
  const uploadRetry = await w.recover(uploadRace.at, uploadDevice, uploadFingerprint);
  const uploadRetryBody = await uploadRetry.json();
  const queueAfterUploadRace = JSON.parse(await w.kv.get("q:" + uploadDevice));
  ok(uploadBlockedWithdrawal.status === 409 && uploadBlockedBody.state === "withdrawal-pending"
    && noUploadRaceReceipt && queueWhileUploadHeld.queue.some((entry) => entry.at === uploadRace.at)
    && queueWhileUploadHeld.queue.some((entry) => entry.at === uploadOther.at)
    && uploadResult.status === 200 && uploadRetry.status === 200 && uploadRetryBody.state === "withdrawn"
    && !queueAfterUploadRace.queue.some((entry) => entry.at === uploadRace.at)
    && queueAfterUploadRace.queue.some((entry) => entry.at === uploadOther.at)
    && !w.db.prepare("SELECT id FROM draft WHERE id=?").get(uploadRace.at) && sourcesRemain(),
  "withdrawal cannot delete an upload while its device lock spans owner receipt and KV write, then retries the recorded identity without losing other queue/resource owners");

  const withdrawalDevice = "phone-withdraw-race";
  const withdrawalOther = { at: "2099-10-05T02:07:00.000Z", date: "2099-10-05", payload: { mode: "ordinary" } };
  const withdrawalRace = { at: "2099-10-05T02:07:15.000Z", date: "2099-10-05", payload: { mode: "ordinary" } };
  ok((await w.upload(withdrawalDevice, [withdrawalOther, withdrawalRace])).status === 200,
    "the withdrawal-lock interleaving starts with its target and an unrelated held queue row");
  const withdrawalFingerprint = await makerRequestFingerprint("server-queue-entry", withdrawalRace);
  const withdrawalPause = pause();
  let withdrawalPaused = false;
  w.kv.put = async (key, value) => {
    if (!withdrawalPaused && key === "q:" + withdrawalDevice
      && !JSON.parse(value).queue.some((entry) => entry.at === withdrawalRace.at)) {
      withdrawalPaused = true;
      w.memory.set(key, value);
      withdrawalPause.enter();
      await withdrawalPause.held;
      return;
    }
    return raceOriginalPut.call(w.kv, key, value);
  };
  let withdrawing, uploadDuringWithdrawal;
  try {
    withdrawing = w.recover(withdrawalRace.at, withdrawalDevice, withdrawalFingerprint);
    await withdrawalPause.entered;
    uploadDuringWithdrawal = await w.upload(withdrawalDevice, [withdrawalOther, withdrawalRace]);
  } finally {
    w.kv.put = raceOriginalPut;
    withdrawalPause.open();
  }
  const withdrawalInFlight = await w.db.prepare("SELECT operation,response FROM maker_request WHERE id=?")
    .get("queue-withdraw:" + withdrawalRace.at);
  const queueDuringWithdrawal = JSON.parse(await w.kv.get("q:" + withdrawalDevice));
  const inFlightWithdrawBody = await withdrawing.then((response) => response.json());
  const staleUploadAfterWithdrawal = await w.upload(withdrawalDevice, [withdrawalOther, withdrawalRace]);
  const staleUploadBody = await staleUploadAfterWithdrawal.json();
  const queueAfterWithdrawal = JSON.parse(await w.kv.get("q:" + withdrawalDevice));
  ok(uploadDuringWithdrawal.status === 409 && withdrawalInFlight?.operation === "queue-withdraw"
    && !withdrawalInFlight.response && inFlightWithdrawBody.state === "withdrawn"
    && !queueDuringWithdrawal.queue.some((entry) => entry.at === withdrawalRace.at)
    && queueDuringWithdrawal.queue.some((entry) => entry.at === withdrawalOther.at)
    && staleUploadAfterWithdrawal.status === 200 && staleUploadBody.withdrawnAts.includes(withdrawalRace.at)
    && !queueAfterWithdrawal.queue.some((entry) => entry.at === withdrawalRace.at)
    && queueAfterWithdrawal.queue.some((entry) => entry.at === withdrawalOther.at)
    && !w.db.prepare("SELECT id FROM draft WHERE id=?").get(withdrawalRace.at)
    && !w.db.prepare("SELECT id FROM input_admission WHERE id=?").get(withdrawalRace.at)
    && sourcesRemain(),
  "withdrawal fences a concurrent and delayed upload, preserving unrelated queue rows and existing resource owners without drafting the withdrawn identity");

  const sent = [];
  const uiEntry = { id: "2099-10-05T02:07:00.000Z", date: "2099-10-05", state: "queued",
    device: "phone-UI", fingerprint: "a".repeat(64), canWithdraw: true, canRetry: false };
  for (const width of [1280, 390]) {
    let dom;
    let withdrawalResponse = { ok: true, state: "withdrawn", withdrawn: uiEntry.id };
    dom = new JSDOM(landingPage("", "queue-ui", { master: "fixture-master", accounts: [] }), {
      url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(window) {
        Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
        window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder; window.scrollTo = () => {};
        window.confirm = () => true;
        Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
        window.fetch = async (path, init = {}) => {
          const route = String(path);
          if (route === "/all/maker/review") return Response.json({ ok: true, orders: [], drafts: [], refused: [], queue: [uiEntry] });
          if (route === "/all/maker/queue/" + encodeURIComponent(uiEntry.id) + "/withdraw") {
            sent.push({ width, body: JSON.parse(init.body) });
            return Response.json(withdrawalResponse);
          }
          return Response.json({ ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
            pools: [], config: null, status: { open: true } });
        };
      }
    });
    try {
      const doc = dom.window.document;
      doc.querySelector('[data-act="nav.record"]').click();
      for (let i = 0; i < 100 && !doc.querySelector("#makerQueueReview .maker-queue-action"); i++)
        await new Promise((resolve) => setTimeout(resolve, 5));
      const action = doc.querySelector("#makerQueueReview .maker-queue-action");
      const emptyUi = !doc.querySelector("#makerReview .maker-card button, #makerDrafts .maker-card button") && !action;
      if (width === 1280) ok(!emptyUi && doc.querySelector("#makerQueueReview").textContent.includes("Server-held device entry")
        && doc.querySelector("#oRecord").textContent.includes("cannot read a device’s unsent queue"),
      "the desktop Counter review names the origin boundary and draws an uploaded device entry, not an unsent local entry");
      const styles = [...doc.querySelectorAll("style")].map((style) => style.textContent).join("\n");
      const target = styles.match(/\.maker-queue-action\{([^}]+)\}/)?.[1] || "";
      const tapToken = /--salt-tap:\s*44px/.test(styles);
      if (width === 1280) ok(/min-width:var\(--salt-tap\)/.test(target) && /min-height:var\(--salt-tap\)/.test(target) && tapToken,
        "the desktop withdrawal control has an independently declared 44-by-44-pixel target");
      else ok(/min-width:var\(--salt-tap\)/.test(target) && /min-height:var\(--salt-tap\)/.test(target) && tapToken,
        "the phone withdrawal control retains its independent 44-by-44-pixel target");
      if (action) action.click();
      for (let i = 0; i < 100 && !sent.some((item) => item.width === width); i++)
        await new Promise((resolve) => setTimeout(resolve, 5));
      ok(sent.some((item) => item.width === width && item.body.fingerprint === uiEntry.fingerprint),
        `the ${width}px owner UI sends only the displayed immutable fingerprint on an explicit withdrawal tap`);
        if (width === 390) {
          withdrawalResponse = { ok: true, withdrawn: uiEntry.id };
          for (let i = 0; i < 100 && doc.querySelector("#makerQueueReview .maker-queue-action") === action; i++)
            await new Promise((resolve) => setTimeout(resolve, 5));
          const retryAction = doc.querySelector("#makerQueueReview .maker-queue-action");
          retryAction.click();
          for (let i = 0; i < 100 && retryAction.disabled; i++)
            await new Promise((resolve) => setTimeout(resolve, 5));
          ok(!retryAction.disabled && retryAction.textContent.includes("Withdraw")
            && retryAction.parentNode.textContent.includes("matching withdrawal receipt"),
          "the phone UI retains the row and refuses a success-shaped response without the matching withdrawal receipt");
        }
    } finally {
      dom.window.close();
    }
  }

  const emptyDom = new JSDOM(landingPage("", "queue-empty", { master: "fixture-master", accounts: [] }), {
    url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder; window.scrollTo = () => {};
      window.fetch = async (path) => String(path) === "/all/maker/review"
        ? Response.json({ ok: true, orders: [], drafts: [], refused: [], queue: [] })
        : Response.json({ ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
          pools: [], config: null, status: { open: true } });
    }
  });
  try {
    const doc = emptyDom.window.document;
    doc.querySelector('[data-act="nav.record"]').click();
    for (let i = 0; i < 100 && !doc.querySelector("#makerQueueReview .rnone"); i++)
      await new Promise((resolve) => setTimeout(resolve, 5));
    ok(doc.querySelector("#makerQueueReview .rnone")?.textContent === "No server-held device entries or cloud refusals."
      && !doc.querySelector("#makerQueueReview .maker-queue-action"),
    "an empty server review states that no server-held entries or cloud refusals exist and exposes no withdrawal control");
  } finally {
    emptyDom.window.close();
  }
}
