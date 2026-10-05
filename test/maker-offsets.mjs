/* Counter Maker A2: the automatic offsets. The list the Worker derives from the mirror must equal what the Desk's own autoOffsets
   queues on the same book, in the master's runtime; a departed or banned holder is never offered; one owner tap queues one offset
   through the shared constructor, checked for room, once per request id, and only for the verified owner. */
import { readdirSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { makerOffsetOffers, makerOffset } from "../src/maker-inputs.js";
import { readBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";

class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

const row = (rid, customer, date, qty, total, more = {}) => ({ rid, customer, date, qty, total, cost: 48, cash: 0,
  handover: "collected", delivery: 0, deliveredOn: date, deliveredQty: qty, ...more });
/* CM4-TO earns several units and has two unpaid orders (the older goes first); CE4-AD has one; CJ4-OKR is departed with an
   unpaid order; CS6-BS has an unpaid order and nothing free */
const SCENARIO = [
  row("tx1", "CM4-TO", "2026-08-20", 20, 3000, { cash: 3000, paidOn: "2026-08-20" }),
  row("tx2", "CM4-TO", "2026-09-01", 2, 220),
  row("tx3", "CM4-TO", "2026-09-20", 1, 110),
  row("tx4", "CE4-AD", "2026-09-10", 1, 110),
  row("tx5", "CJ4-OKR", "2026-09-05", 1, 110),
  row("tx6", "CS6-BS", "2026-09-06", 1, 110)
];

const key = (o) => o.code + "|" + o.rid;
const sorted = (list) => list.map((o) => ({ code: o.code, rid: o.rid, units: o.units, rm: o.rm })).sort((a, b) => key(a) < key(b) ? -1 : 1);

export async function run({ ok }) {
  const source = await readBook();
  const { w, version } = source;
  const ledger = JSON.parse(JSON.stringify(source.ledger));   /* the reads are live objects of the window; the scenario is laid over a copy */
  try {
    const mirror = (extra = []) => {
      const copy = JSON.parse(JSON.stringify(ledger));
      copy.sales = copy.sales.concat(JSON.parse(JSON.stringify(extra)));
      return { sales: copy.sales, purchases: copy.purchases, state: copy, version, pricing: copy.PRICING };
    };
    const desked = (held = {}) => {
      const drafted = (held.pending || []).map((e) => ({ amendKind: e.payload.kind, amends: e.payload.rid || e.payload.orderKey }));
      const refused = (held.refused || []).map((entry) => ({ entry }));
      const made = JSON.parse(w.eval(`(function(){queue=${JSON.stringify(held.queued || [])};AP_DRAFTS=${JSON.stringify(drafted)};AP_REFUSED=${JSON.stringify(refused)};
        saveQueue=function(){};qPost=function(){return Promise.resolve(true);};apMsg='';autoOffsets();
        return JSON.stringify(queue.filter(function(q){return q&&q.payload&&q.payload.auto;}));})()`));
      return made.map((entry) => ({ code: entry.party, rid: entry.payload.rid, units: entry.payload.fields.rebateKg,
        rm: entry.payload.fields.settledRM, entry }));
    };
    const today = w.eval("TODAY.toISOString().slice(0,10)");
    const worked = (book, held = {}) => makerOffsetOffers(book, held).offers;

    ok(ledger.REWARD && ledger.REWARD.stated && ledger.REWARD.stated.salt && ledger.REWARD.stated.salt.margin === 500,
      "the extract carries the master's reward scheme, so the Worker's reward account is not refused as unconfigured");

    /* the live master first, then the scenario that makes the question real */
    ok(JSON.stringify(sorted(worked(mirror()))) === JSON.stringify(sorted(desked())),
      "the list on the live master equals the Desk's autoOffsets: " + JSON.stringify(sorted(desked())));

    w.eval(`(function(){var rows=${JSON.stringify(SCENARIO)};rows.forEach(function(r){sales.push(JSON.parse(JSON.stringify(r)));
      BASE_SALES.push(JSON.parse(JSON.stringify(r)));});recompute();})()`);
    const book = mirror(SCENARIO);
    const deskList = desked(), workerList = worked(book);
    ok(JSON.stringify(sorted(workerList)) === JSON.stringify(sorted(deskList)) && workerList.length >= 2,
      "the list equals the Desk's autoOffsets over unpaid orders: " + JSON.stringify(sorted(workerList)) + " against " + JSON.stringify(sorted(deskList)));
    const toOffer = workerList.find((o) => o.code === "CM4-TO");
    ok(toOffer && toOffer.rid === "tx2" && toOffer.units === 1 && toOffer.held > 1,
      "the oldest unpaid order is offered, one unit though more is held: " + JSON.stringify(toOffer));
    ok(!workerList.some((o) => o.code === "CJ4-OKR") && !deskList.some((o) => o.code === "CJ4-OKR")
      && makerOffsetOffers(book).offers.length === workerList.length,
      "a departed holder is never offered, here or on the Desk");
    const mine = makerOffset({ at: "2026-10-05T01:00:00.000Z", code: "CE4-AD", rid: "tx4", date: today }, book, []);
    const theirs = deskList.find((o) => o.code === "CE4-AD");
    ok(mine.entry && theirs && JSON.stringify(mine.entry.payload) === JSON.stringify(theirs.entry.payload)
      && mine.entry.type === theirs.entry.type && mine.draft && !mine.draft.skip,
      "the tap builds the Desk's own entry, drafted without refusal: " + JSON.stringify(mine.error || ""));
    const departed = makerOffset({ at: "2026-10-05T01:01:00.000Z", code: "CJ4-OKR", rid: "tx5", date: today }, book, []);
    ok(!!departed.error && !departed.entry, "a tap on a departed holder is refused");
    ok(!!makerOffset({ at: "2026-10-05T01:02:00.000Z", code: "CE4-AD", rid: "tx4", date: today, units: 5 }, book, []).error
      && !!makerOffset({ at: "2026-10-05T01:02:00.000Z", code: "CE4-AD", rid: "nope", date: today }, book, []).error,
      "an offset carries no figures of its own and names a row that is on offer");

    /* a standing ban leaves the bench on the Desk, and here */
    const banned = JSON.parse(JSON.stringify(book)); banned.state.PEOPLE.banned.push({ id: "CM4-TO", since: "2026-10-01" });
    w.eval("PEOPLE.banned.push({id:'CM4-TO',since:'2026-10-01'});recompute();");
    ok(JSON.stringify(sorted(worked(banned))) === JSON.stringify(sorted(desked())) && !worked(banned).some((o) => o.code === "CM4-TO"),
      "a banned party is not offered, as on the Desk");
    w.eval("PEOPLE.banned.pop();recompute();");

    /* a correction already waiting on the row withdraws the offer, as the Desk's offered check does */
    const waiting = { at: "2026-10-05T00:30:00.000Z", payload: { mode: "amend", kind: "Correction", rid: "tx4", fields: { notes: 1 } } };
    const queuedHeld = { queued: [waiting] }, pendingHeld = { pending: [waiting] };
    ok(!worked(book, queuedHeld).some((o) => o.rid === "tx4") && !desked(queuedHeld).some((o) => o.rid === "tx4")
      && !worked(book, pendingHeld).some((o) => o.rid === "tx4") && !desked(pendingHeld).some((o) => o.rid === "tx4")
      && worked(book, queuedHeld).some((o) => o.rid === "tx2"),
      "a row with a correction already queued or pending is not offered again, on either side");
    /* the Desk blocks on ANY refusal naming the row, a payment's included, and on a queued entry only if it is a correction */
    const refusedPayment = { payload: { mode: "amend", kind: "Fulfilment", rid: "tx4", cash: 5 } };
    const refusedHeld = { refused: [refusedPayment] }, queuedPayment = { queued: [refusedPayment] };
    ok(!worked(book, refusedHeld).some((o) => o.rid === "tx4") && !desked(refusedHeld).some((o) => o.rid === "tx4")
      && worked(book, queuedPayment).some((o) => o.rid === "tx4") && desked(queuedPayment).some((o) => o.rid === "tx4"),
      "any refusal naming the row withdraws the offer, as on the Desk, while a queued payment does not");

    /* the road: the verified owner, the bridge, the queue, the drafter, once */
    const migrations = new URL("../migrations/", import.meta.url), db = new DatabaseSync(":memory:");
    for (const f of readdirSync(migrations).filter((x) => /^\d+_.*\.sql$/.test(x)).sort())
      db.exec(readFileSync(new URL(f, migrations), "utf8"));
    const live = JSON.parse(JSON.stringify(ledger)); live.sales = live.sales.concat(JSON.parse(JSON.stringify(SCENARIO)));
    const bodyOf = { v: version, stamped: ledger.stamped || null, ledger: live };
    db.exec(buildSeed(bodyOf).sql);
    const D1 = { batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const out = statements.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; }
    }, prepare(sql) {
      const st = db.prepare(sql);
      const mk = (a) => ({ run() { return { meta: { changes: Number(st.run(...a).changes || 0) } }; },
        first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
      const self = mk([]); self.bind = (...a) => mk(a); return self;
    } };
    const makerKey = "maker-offsets-local-capability-0123456789";
    const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: makerKey };
    const counterEnv = { STMT: new Store(), COUNTER_MAKER_KEY: makerKey,
      DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
    const owner = { email: "maakmal97@icloud.com" };
    const call = (path, body, identity = owner) => handleMaker(new Request("https://counter.test" + path, body === undefined ? {}
      : { method: "POST", body: JSON.stringify(body) }), counterEnv, path, identity);
    const drafts = () => db.prepare("SELECT id,status,entry FROM draft ORDER BY id").all();

    const read = await call("/all/maker/offsets"), readBody = await read.json();
    ok(read.status === 200 && JSON.stringify(sorted(readBody.offers)) === JSON.stringify(sorted(workerList)),
      "the owner's read lists the same offers over the real bridge and mirror: " + read.status + " " + JSON.stringify(readBody).slice(0, 200));
    ok((await call("/all/maker/offsets", undefined, { email: "other@example.test" })).status === 403
      && (await call("/all/maker/inputs/offset", { at: "2026-10-05T02:00:00.000Z", code: "CE4-AD", rid: "tx4", date: today },
        { email: "other@example.test" })).status === 403 && drafts().length === 0,
      "another identity is refused on the offsets read and the offset tap, and nothing is queued");
    const wrongKey = await desk.fetch(new Request("https://desk.test/_internal/maker/offsets", { headers: { "X-Counter-Maker-Key": "x".repeat(40) } }),
      deskEnv, { waitUntil() {} });
    ok(wrongKey.status === 404, "the Desk end of the bridge answers the offsets read only to its capability");

    const tap = { at: "2026-10-05T02:10:00.000Z", code: "CE4-AD", rid: "tx4", date: today };
    const first = await call("/all/maker/inputs/offset", tap), firstBody = await first.json();
    const queuedDrafts = drafts();
    ok(first.status === 200 && firstBody.ok && queuedDrafts.length === 1 && queuedDrafts[0].id === tap.at
      && JSON.parse(queuedDrafts[0].entry).payload.auto === true && JSON.parse(queuedDrafts[0].entry).payload.fields.rebateKg === 1,
      "one tap queues one offset through the shared entry and the drafter: " + first.status + " " + JSON.stringify(firstBody));
    const retry = await call("/all/maker/inputs/offset", tap);
    ok(retry.status === 200 && drafts().length === 1,
      "the same request id again is answered from its receipt and queues nothing more: " + retry.status);
    const again = await call("/all/maker/inputs/offset", { ...tap, at: "2026-10-05T02:11:00.000Z" });
    ok(again.status >= 400 && drafts().length === 1,
      "a new request for the same offer is refused while its offset waits: " + again.status);
    const gone = await call("/all/maker/inputs/offset", { at: "2026-10-05T02:12:00.000Z", code: "CJ4-OKR", rid: "tx5", date: today });
    ok(gone.status >= 400 && drafts().length === 1, "the road refuses a departed holder: " + gone.status);

    /* two taps at once under different request ids: one lands, the other is told why */
    const racing = [{ at: "2026-10-05T02:15:00.000Z", code: "CM4-TO", rid: "tx2", date: today },
      { at: "2026-10-05T02:15:01.000Z", code: "CM4-TO", rid: "tx2", date: today }];
    const raced = await Promise.all(racing.map((body) => call("/all/maker/inputs/offset", body)));
    const landed = drafts().filter((d) => d.id.startsWith("2026-10-05T02:15:"));
    ok(landed.length === 1 && raced.filter((r) => r.status === 200).length === 1 && raced.filter((r) => r.status >= 400).length === 1,
      "two concurrent taps on one row under different request ids queue exactly one offset: " + raced.map((r) => r.status) + " " + landed.length);
    db.prepare("DELETE FROM draft WHERE id LIKE '2026-10-05T02:15:%'").run();
    db.prepare("DELETE FROM maker_request WHERE id LIKE '2026-10-05T02:15:%'").run();
    for (const body of racing) await deskEnv.SALT_QUEUE.delete("q:orders:" + body.at);
    ok(db.prepare("SELECT COUNT(*) AS n FROM maker_request WHERE operation='offset-lock'").get().n === 0,
      "the row's lock is let go once the tap is answered");
    /* an unreadable queue answers a message on the read, never a failed request */
    await deskEnv.SALT_QUEUE.put("q:broken", "{not json");
    const unreadable = await call("/all/maker/offsets");
    const unreadableBody = await unreadable.json();
    ok(unreadable.status === 503 && /unreadable/.test(unreadableBody.error || ""),
      "an unreadable Desk queue answers the offsets read with a message: " + unreadable.status + " " + JSON.stringify(unreadableBody));
    let deskAnswer = null;
    try {
      const direct = await desk.fetch(new Request("https://desk.test/_internal/maker/offsets", { headers: { "X-Counter-Maker-Key": makerKey } }),
        deskEnv, { waitUntil() {} });
      deskAnswer = { status: direct.status, body: await direct.json() };
    } catch (error) { deskAnswer = { thrown: String(error) }; }
    ok(deskAnswer.status === 503 && deskAnswer.body.ok === false && /unreadable/.test(deskAnswer.body.error),
      "the Desk itself answers an unreadable queue with a 503 message, never an unhandled failure: " + JSON.stringify(deskAnswer));
    await deskEnv.SALT_QUEUE.delete("q:broken");

    /* room: cash already on its way leaves the row too little for the offset */
    const pay = await call("/all/maker/inputs/ledger-amend", { at: "2026-10-05T02:20:00.000Z", rid: "tx2", kind: "Fulfilment",
      date: today, cash: 150, movedUnits: 0 });
    const over = await call("/all/maker/inputs/offset", { at: "2026-10-05T02:21:00.000Z", code: "CM4-TO", rid: "tx2", date: today });
    const overBody = await over.json();
    ok(pay.status === 200 && over.status === 409 && /can still take RM 70/.test(overBody.error || "")
      && drafts().length === 2,
      "an offset past what the row can still take, with money already on its way, is refused: " + pay.status + " " + over.status + " " + JSON.stringify(overBody));
  } finally { w.close(); }
}
