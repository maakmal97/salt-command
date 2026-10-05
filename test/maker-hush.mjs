/* A5: Maker's hush of a Whiteboard tip, against the Desk's own obsAct. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { makerHush, makerInputCatalog } from "../src/maker-inputs.js";

const AT = "2026-10-05T08:00:00.000Z";   // 05 Oct 2026, 16:00 MYT

export async function run({ ok, KV, worker, handleMaker, REPO }) {
  /* 1. equal to the Desk: the real master draws the tips, the snapshot carries them, Maker queues the same entry */
  const { w } = await openMaster();
  try {
    w.eval("queue=[];render=function(){};renderQueue=function(){};saveQueue=function(){return Promise.resolve(true);};");
    const live = JSON.parse(w.eval("JSON.stringify(observations().live.map(function(o){return o.id;}))"));
    const snap = pricingSnapshot(w);
    ok(live.length > 0 && JSON.stringify(snap.obs.map((o) => o.id)) === JSON.stringify(live)
      && snap.obs.every((o) => typeof o.title === "string" && !/[<>]/.test(o.title)),
      "the snapshot carries the Whiteboard's live tips as the Desk reads them, ids in the same order, titles as plain words");
    const book = { version: "fixture", sales: [], purchases: [], pricing: snap, state: { PRODUCTS: { salt: { name: "salt" } }, roster: [] } };
    const id = live[0], deskQueues = (what) => JSON.parse(w.eval("queue=[];obsAct(" + JSON.stringify(id) + "," + JSON.stringify(what)
      + ");JSON.stringify(queue[0])"));
    for (const what of ["dismiss", "snooze7", "snooze30"]) {
      const desk = deskQueues(what), made = makerHush({ at: desk.at, id, until: desk.payload.until }, book);
      /* the Desk dates a snooze from its own clock and Maker from the request's, so equality holds on the day and is refused only off it */
      ok(made.entry ? JSON.stringify(made.entry) === JSON.stringify(desk) : what !== "dismiss",
        "Maker's " + what + " is the entry the Desk's obsAct queues, every field");
    }
    const asked = deskQueues("dismiss"), dismissed = makerHush({ at: asked.at, id, until: null }, book);
    ok(dismissed.entry && JSON.stringify(dismissed.entry) === JSON.stringify(asked),
      "Maker's dismiss is the Desk's dismiss entry exactly");
    const card = w.eval("queue=[];obsCard(observations().live[0])");
    ok(card.includes(">" + id + " &middot; Hush in Maker<") && card.includes("obsAct('" + id + "','dismiss')"),
      "the Desk's tip card shows the tip's id and Hush in Maker beside its own controls");
  } finally { w.close(); }

  /* the constructor, over a fixture */
  const tips = [{ id: "rhythm:restock:salt", sev: "act", fam: "rhythm", title: "Restock salt", rm: 120 }];
  const book = { version: 1, sales: [], purchases: [], pricing: { obs: tips }, state: { PRODUCTS: { salt: { name: "salt" } }, roster: [] } };
  const good = makerHush({ at: AT, id: tips[0].id, until: "2026-10-12" }, book);
  ok(good.entry && good.entry.payload.act === "snooze" && good.entry.payload.until === "2026-10-12"
    && JSON.stringify(good.entry) === JSON.stringify(POSITION_ENGINE.obsEntry({ at: AT, id: tips[0].id, act: "snooze", until: "2026-10-12" }))
    && makerHush({ at: AT, id: tips[0].id, until: null }, book).entry.payload.act === "dismiss",
    "a date snoozes and null dismisses, through the shared constructor");
  const refused = [{ at: AT, id: "nope", until: null }, { at: AT, id: tips[0].id, until: "2026-10-05" }, { at: AT, id: tips[0].id, until: "2025-01-01" },
    { at: AT, id: tips[0].id, until: "2027-10-07" }, { at: AT, id: tips[0].id, until: "tomorrow" }, { at: AT, id: tips[0].id },
    { at: AT, id: tips[0].id, until: null, act: "restore" }, { at: "now", id: tips[0].id, until: null }];
  ok(refused.every((b) => !!makerHush(b, book).error) && !makerHush({ at: AT, id: tips[0].id, until: "2027-10-06" }, book).error,
    "an unknown tip, a snooze not after today or past a year, a missing until, an extra field and a loose timestamp are refused");
  ok(JSON.stringify(makerInputCatalog(book).tips) === JSON.stringify([{ id: tips[0].id, sev: "act", title: "Restock salt" }]),
    "Maker lists the snapshot's tips and nothing more");

  /* the control */
  const owner_js = readFileSync(join(REPO, "stmt", "owner.js"), "utf8");
  ok(POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/hush", body: { at: AT, id: "px:headroom:salt", until: null } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/hush-x", body: { at: AT } })
    && owner_js.includes("makerButton(tipSection,'Hush tip'") && owner_js.includes("send('/all/maker/inputs/hush',{at:tipAt,id:tipId.value,until:until})"),
    "the Counter Admin carries a Hush tip control whose retained request is a valid record");

  /* 2. the route: owner, bridge, Desk, a real queue and drafter */
  const { DatabaseSync } = await import("node:sqlite");
  const { runDrafter } = await import("../src/drafter.js");
  const db = new DatabaseSync(":memory:");
  try {
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
    for (const [k, v] of Object.entries({ PRODUCTS: book.state.PRODUCTS, roster: [], PRICING: book.pricing }))
      db.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run(k, JSON.stringify(v));
    db.prepare("INSERT INTO snapshot(one,v,stamped) VALUES (1,'a5-fixture',NULL)").run();
    const key = "counter-maker-test-key-0123456789abcdef", owner = { email: "  MAAKMAL97@ICLOUD.COM " };
    const deskEnv = { COUNTER_MAKER_KEY: key, SALT_QUEUE: new KV(), SALT_LEDGER: d1 };
    const bridged = [];
    const counter = { COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => {
      bridged.push(new URL(request.url).pathname);
      return worker.fetch(request, deskEnv, { waitUntil() {} });
    } } };
    const call = (body, who = owner, path = "/all/maker/inputs/hush") => handleMaker(new Request("https://counter.test" + path, {
      method: "POST", body: JSON.stringify(body) }), counter, path, who);
    const queued = () => [...deskEnv.SALT_QUEUE.m.keys()].filter((k) => k.startsWith("q:") && k.endsWith(AT));
    const count = (table) => db.prepare("SELECT COUNT(*) AS n FROM " + table).get().n;
    const body = { at: AT, id: tips[0].id, until: "2026-10-12" };

    const denied = await call(body, { email: "other@example.com" }), none = await call(body, null);
    const wrongPath = await call(body, owner, "/all/maker/inputs/hush-x");
    const noKey = await worker.fetch(new Request("https://desk.test/_internal/maker/inputs/hush", { method: "POST", body: JSON.stringify(body) }),
      deskEnv, { waitUntil() {} });
    ok(denied.status === 403 && none.status === 403 && wrongPath.status === 404 && noKey.status === 404
      && bridged.length === 0 && queued().length === 0,
      "a hush is refused to any other identity, an unlisted path and a Desk call without the bridge key, and queues nothing");

    const first = await call(body), firstBody = await first.json();
    const stored = queued().length === 1 ? JSON.parse(deskEnv.SALT_QUEUE.m.get(queued()[0])).queue[0] : null;
    ok(first.status === 200 && firstBody.ok && firstBody.hushed === tips[0].id && bridged[0] === "/_internal/maker/inputs/hush"
      && stored && stored.payload.mode === "obs" && stored.payload.until === "2026-10-12" && stored.type === "OBS" && count("draft") === 0,
      "the owner's hush crosses the bridge and queues the OBS entry, with no draft");
    const retry = await call(body), retryBody = await retry.json();
    ok(retry.status === 200 && retryBody.ok && queued().length === 1 && count("maker_request") === 1,
      "a retry under the same request id answers the first result and queues nothing more");
    const other = await call({ ...body, until: "2026-10-20" });
    ok(other.status === 409 && queued().length === 1, "the same request id carrying other content is refused");
    const unknown = await call({ at: "2026-10-05T08:05:00.000Z", id: "no-such-tip", until: null });
    ok(unknown.status === 400, "a tip the Desk is not showing is refused");
    const pass = await runDrafter(deskEnv);
    ok(pass.hushes === 1 && count("refused") === 0 && count("draft") === 0,
      "the drafter sets a Maker hush aside: neither drafted nor refused");
  } finally { db.close(); }
}
