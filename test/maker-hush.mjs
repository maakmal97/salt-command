/* A5: one store of hushes (Desk KV `hush`), written by the Desk's obsAct and by Counter Maker, read by both. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { makerHush, makerInputCatalog, hushPut } from "../src/maker-inputs.js";

const AT = "2026-10-05T08:00:00.000Z";   // 05 Oct 2026, 16:00 MYT
const WK = "write-key-for-the-test";

export async function run({ ok, KV, worker, handleMaker, REPO }) {
  const { DatabaseSync } = await import("node:sqlite");
  const { w } = await openMaster();
  const db = new DatabaseSync(":memory:");
  try {
    w.SALT_CLOUD = true;
    w.eval("queue=[];render=function(){};renderQueue=function(){};saveQueue=function(){return Promise.resolve(true);};");
    const live = () => JSON.parse(w.eval("JSON.stringify(observations().live.map(function(o){return o.id;}))"));
    const hushed = () => JSON.parse(w.eval("JSON.stringify(observations().hushed.map(function(o){return o.id;}))"));
    const ids = live(), id = ids[0], snap = pricingSnapshot(w);

    /* 1. the snapshot's tips: the Desk's, and only id, severity and title */
    ok(ids.length > 0 && JSON.stringify(snap.obs.map((o) => o.id)) === JSON.stringify(ids)
      && snap.obs.every((o) => Object.keys(o).sort().join() === "id,sev,title" && !/[<>]/.test(o.title)),
      "the snapshot carries the Whiteboard's live tips as the Desk reads them: id, severity and title, in the same order");
    ok(ids.every((x) => POSITION_ENGINE.TIP_ID.test(x)) && POSITION_ENGINE.TIP_ID.test("dup:CS6-BS-R:2026-09-16:2026-09-19:420.5")
      && !POSITION_ENGINE.TIP_ID.test("nope") && !POSITION_ENGINE.TIP_ID.test("a:b c"),
      "every live tip id has the id shape, a dup id with a decimal total included");
    ok(POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/hush", body: { at: AT, id: "dup:CS6-BS-R:2026-09-16:2026-09-19:420.5", until: null } })
      && POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/hush", body: { at: AT, id: id, until: "2026-10-12" } })
      && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/hush-x", body: { at: AT } }),
      "a retained hush request is a valid record, decimal ids included, and only at its own path");

    /* the Desk, the Worker and a real D1 and KV, wired */
    for (const file of readdirSync(join(REPO, "migrations")).filter((f) => /^[0-9]+_.*[.]sql$/.test(f)).sort())
      db.exec(readFileSync(join(REPO, "migrations", file), "utf8"));
    const d1 = { batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const r = statements.map((s) => s.run()); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
    }, prepare(sql) {
      const st = db.prepare(sql);
      const bound = (a) => ({ run() { return { meta: { changes: Number(st.run(...a).changes) } }; },
        first() { return st.get(...a) || null; }, all() { return { results: st.all(...a) }; } });
      return Object.assign(bound([]), { bind: (...a) => bound(a) });
    } };
    for (const [k, v] of Object.entries({ PRODUCTS: { salt: { name: "salt" } }, roster: [], PRICING: snap }))
      db.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run(k, JSON.stringify(v));
    db.prepare("INSERT INTO snapshot(one,v,stamped) VALUES (1,'a5-fixture',NULL)").run();
    const key = "counter-maker-test-key-0123456789abcdef", owner = { email: "  MAAKMAL97@ICLOUD.COM " };
    const deskEnv = { COUNTER_MAKER_KEY: key, SALT_WRITE_KEY: WK, SALT_QUEUE: new KV(), SALT_LEDGER: d1 };
    const desk = (path, method = "GET", body, k = WK) => worker.fetch(new Request("https://desk.test" + path, { method,
      headers: k ? { "X-Salt-Key": k, "content-type": "application/json" } : {}, body: body === undefined ? undefined : JSON.stringify(body) }),
      deskEnv, { waitUntil() {} });
    const stored = () => JSON.parse(deskEnv.SALT_QUEUE.m.get("hush") || "{}");
    w.localStorage.setItem("saltWriteKey", WK);
    w.fetch = (url, init = {}) => desk("/" + url, init.method || "GET", init.body ? JSON.parse(init.body) : undefined, (init.headers || {})["X-Salt-Key"]);
    const bridged = [];
    const counter = { COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => {
      bridged.push(new URL(request.url).pathname);
      return worker.fetch(request, deskEnv, { waitUntil() {} });
    } } };
    const call = (body, who = owner, path = "/all/maker/inputs/hush") => handleMaker(new Request("https://counter.test" + path, {
      method: "POST", body: JSON.stringify(body) }), counter, path, who);
    const reload = async () => { w.eval("HUSH={};HUSH_READ=false;"); await w.eval("hushLoad(true)"); };

    /* 2. the keyed Desk route */
    const noKey = await desk("/hush", "GET", undefined, null), wrongKey = await desk("/hush", "POST", { id, until: null }, "wrong");
    ok(noKey.status === 401 && wrongKey.status === 401 && Object.keys(stored()).length === 0,
      "the Desk's /hush needs the write key to read or write, and an unkeyed call writes nothing");
    const bad = [await desk("/hush", "POST", { id: "nope", until: null }), await desk("/hush", "POST", { id, until: "tomorrow" }),
      await desk("/hush", "POST", { id, until: null, clear: "yes" }), await desk("/hush", "PUT", {})];
    ok(bad.map((r) => r.status).join() === "400,400,400,405" && Object.keys(stored()).length === 0,
      "a malformed id, day or clear is refused, and so is any other method");

    /* 3. a hush set in Maker hides the tip on the Desk */
    const set = await call({ at: AT, id, until: "2026-10-12" }), setBody = await set.json();
    ok(set.status === 200 && setBody.ok && setBody.hushed === id && bridged[0] === "/_internal/maker/inputs/hush"
      && stored()[id] === "2026-10-12" && db.prepare("SELECT COUNT(*) AS n FROM draft").get().n === 0 && ![...deskEnv.SALT_QUEUE.m.keys()].some((k) => k.startsWith("q:")),
      "Maker's hush writes the KV hush map through the bridge, with no queue entry and no draft");
    await reload();
    ok(!live().includes(id) && hushed().includes(id) && w.eval("obsState(" + JSON.stringify(id) + ")").until === "2026-10-12",
      "and the Desk, reading the hushes, shows that tip as hushed to that day");

    /* 4. a hush set on the Desk is read back by Maker, and Bring back clears it */
    const other = ids[1];
    w.eval("obsAct(" + JSON.stringify(other) + ",'dismiss')");
    await new Promise((r) => setTimeout(r, 50));
    const cat = makerInputCatalog({ version: 1, sales: [], purchases: [], pricing: snap, state: { PRODUCTS: { salt: { name: "salt" } }, roster: [] } }, stored());
    ok(stored()[other] === null && cat.tips.find((t) => t.id === other).hush === null && cat.tips.find((t) => t.id === id).hush === "2026-10-12"
      && cat.tips.every((t) => Object.keys(t).sort().join() === "hush,id,sev,title"),
      "the Desk's own hush reaches the same store, and Maker's list reads both back");
    w.eval("obsAct(" + JSON.stringify(other) + ",'restore')");
    await new Promise((r) => setTimeout(r, 50));
    ok(!(other in stored()) && stored()[id] === "2026-10-12", "Bring back on the Desk clears only its own tip from the store");
    const route = await handleMaker(new Request("https://counter.test/all/maker/inputs", { method: "GET" }), counter, "/all/maker/inputs", owner);
    ok(route.status === 200 && (await route.json()).catalog.tips.find((t) => t.id === id).hush === "2026-10-12",
      "Maker's input catalog carries each tip's current hush");

    /* once the cloud's hushes are read they alone decide; the device's own queue decides only before */
    w.eval("queue=[{at:'2026-10-05T01:00:00.000Z',payload:{mode:'obs',id:" + JSON.stringify(other) + ",act:'dismiss',until:null,why:''}}];HUSH_READ=false;");
    const before = w.eval("obsState(" + JSON.stringify(other) + ")");
    await reload();
    ok(before && before.act === "dismiss" && w.eval("obsState(" + JSON.stringify(other) + ")") === null,
      "a local dismissal holds until the cloud's hushes are read, then the cloud's answer decides");
    w.eval("queue=[];");

    /* 5. pruning, on the Desk's write and on Maker's */
    deskEnv.SALT_QUEUE.m.set("hush", JSON.stringify({ old: "2020-01-01", keep: "2099-01-01", dis: null }));
    const pruned = await desk("/hush", "POST", { id, until: null }), prunedBody = await pruned.json();
    ok(JSON.stringify(prunedBody.hush) === JSON.stringify({ keep: "2099-01-01", dis: null, [id]: null }) && !("old" in stored()),
      "a write drops every past day, and keeps dismissals and days to come");
    await hushPut(deskEnv.SALT_QUEUE, "x", "2026-10-09", "2026-10-05");
    deskEnv.SALT_QUEUE.m.set("hush", JSON.stringify({ gone: "2026-10-01", today: "2026-10-05", fine: "2026-10-20" }));
    await call({ at: "2026-10-05T08:30:00.000Z", id: ids[2], until: "2026-10-12" });
    ok(JSON.stringify(Object.keys(stored()).sort()) === JSON.stringify(["fine", ids[2]].sort()),
      "Maker's write prunes by the request's own day: yesterday and today go, a later day stays");

    /* 6. Maker's refusals and its auth */
    deskEnv.SALT_QUEUE.m.set("hush", "{}");
    const n0 = bridged.length;
    const denied = await call({ at: AT, id, until: null }, { email: "other@example.com" }), none = await call({ at: AT, id, until: null }, null);
    const wrongPath = await call({ at: AT, id, until: null }, owner, "/all/maker/inputs/hush-x");
    const noBridgeKey = await worker.fetch(new Request("https://desk.test/_internal/maker/inputs/hush", { method: "POST", body: JSON.stringify({ at: AT, id, until: null }) }),
      deskEnv, { waitUntil() {} });
    ok(denied.status === 403 && none.status === 403 && wrongPath.status === 404 && noBridgeKey.status === 404 && bridged.length === n0 && Object.keys(stored()).length === 0,
      "a hush is refused to any other identity, an unlisted path and a Desk call without the bridge key, and writes nothing");
    const book = { version: 1, sales: [], purchases: [], pricing: { obs: [{ id, sev: "act", title: "t" }] }, state: { PRODUCTS: { salt: { name: "salt" } }, roster: [] } };
    const refused = [{ at: AT, id: "px:unknown:salt", until: null }, { at: AT, id, until: "2026-10-05" }, { at: AT, id, until: "2025-01-01" },
      { at: AT, id, until: "2027-10-07" }, { at: AT, id, until: "tomorrow" }, { at: AT, id }, { at: AT, id, until: null, act: "restore" }, { at: "now", id, until: null }];
    ok(refused.every((b) => !!makerHush(b, book).error) && makerHush({ at: AT, id, until: "2027-10-06" }, book).until === "2027-10-06"
      && makerHush({ at: AT, id, until: null }, book).until === null,
      "an unknown tip, a snooze not after today or past a year, a missing until, an extra field and a loose timestamp are refused");

    /* 7. idempotent by request id: a retry after the Desk moved the tip does not hush it again */
    const first = await call({ at: AT, id, until: "2026-10-12" });
    await desk("/hush", "POST", { id, clear: true });
    const retry = await call({ at: AT, id, until: "2026-10-12" }), retryBody = await retry.json();
    ok(first.status === 200 && retry.status === 200 && retryBody.ok && retryBody.hushed === id && !(id in stored()) && db.prepare("SELECT COUNT(*) AS n FROM maker_request").get().n >= 1,
      "a retry under the same request id answers the first result and writes nothing again");
    const clash = await call({ at: AT, id, until: "2026-10-20" });
    ok(clash.status === 409 && !(id in stored()), "the same request id carrying other content is refused");
    const unknown = await call({ at: "2026-10-05T08:05:00.000Z", id: "px:unknown:salt", until: null });
    ok(unknown.status === 400, "a tip the Desk is not showing is refused");
  } finally { w.close(); db.close(); }

  /* the control */
  const owner_js = readFileSync(join(REPO, "stmt", "owner.js"), "utf8");
  ok(owner_js.includes("makerButton(tipSection,'Hush tip'") && owner_js.includes("send('/all/maker/inputs/hush',{at:tipAt,id:tipId.value,until:until})")
    && owner_js.includes("when it next reads the hushes")
    && owner_js.includes("tip.hush===null?' | dismissed':tip.hush?' | snoozed to '+tip.hush") && !owner_js.includes("from its queue"),
    "the Counter Admin carries a Hush tip control that says what happens: the Desk reads the hushes, not a queue");
}
