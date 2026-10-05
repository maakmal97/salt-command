/* A1: Maker's tier Accept-all, against the Desk's own tierAcceptAll. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { makerTierAcceptAll } from "../src/maker-inputs.js";

const AT = "2026-10-05T08:00:00.000Z";
const norm = (tiers) => JSON.stringify(Object.keys(tiers).sort().map((id) => [id, Object.keys(tiers[id]).sort()
  .map((p) => [p, tiers[id][p]])]));

export async function run({ ok, KV, worker, handleMaker, REPO }) {
  /* 1. equal to the Desk: the real master draws the proposals, the snapshot carries them, Maker queues the same entry */
  const { w } = await openMaster();
  try {
    w.eval("queue=[];render=function(){};renderQueue=function(){};saveQueue=function(){return Promise.resolve(true);};"
      + "Object.keys(TIER_OF).forEach(function(k){delete TIER_OF[k];});");
    const deskTiers = () => { const t = JSON.parse(w.eval("queue=[];tierAcceptAll();JSON.stringify(queue[0]?queue[0].payload.tiers:null)")); return t || {}; };
    const bookOf = () => ({ version: "fixture", sales: [], purchases: [], pricing: pricingSnapshot(w),
      state: { PRODUCTS: JSON.parse(w.eval("JSON.stringify(PRODUCTS)")), roster: JSON.parse(w.eval("JSON.stringify(roster)")),
        TIER_OF: JSON.parse(w.eval("JSON.stringify(TIER_OF)")) } });
    const everything = deskTiers();
    const madeAll = makerTierAcceptAll({ at: AT }, bookOf(), []);
    ok(Object.keys(everything).length > 0 && madeAll.entry && norm(madeAll.entry.payload.tiers) === norm(everything)
      && madeAll.entry.payload.mode === "tierset" && madeAll.entry.type === "TIER",
      "Maker's Accept all queues the proposed tiers the Desk's own tierAcceptAll queues, as one tierset entry");
    const victimId = Object.keys(everything)[0], victimProduct = Object.keys(everything[victimId])[0];
    w.eval("TIER_OF[" + JSON.stringify(victimId) + "]={" + JSON.stringify(victimProduct) + ":'Gold'};");
    const rest = deskTiers(), madeRest = makerTierAcceptAll({ at: AT }, bookOf(), []);
    const victimLeft = (t) => t[victimId] && victimProduct in t[victimId];
    ok(victimLeft(everything) && !victimLeft(rest) && !victimLeft(madeRest.entry.payload.tiers)
      && norm(madeRest.entry.payload.tiers) === norm(rest),
      "a held tier is never moved by Accept all, and what remains still equals the Desk's");
  } finally { w.close(); }

  /* the control: a retained request survives a reload only if the engine's record check names the path */
  const owner_js = readFileSync(join(REPO, "stmt", "owner.js"), "utf8");
  ok(POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/tier-accept-all", body: { at: AT } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/tier-accept-all-x", body: { at: AT } })
    && owner_js.includes("makerButton(tierSection,'Accept tier proposals'") && owner_js.includes("'/all/maker/inputs/tier-accept-all',{at:allAt}"),
    "the Counter Admin carries an Accept tier proposals control whose retained request is a valid record");

  ok(owner_js.includes("failure.status=r.status;")
    && owner_js.includes("if(error.status===400&&(path==='/all/maker/inputs/tier-accept-all'||path==='/all/maker/inputs/hush')){makerClear(path);pending=null;cancel.hidden=true;}"),
    "a 400 no-proposal answer clears the retained Accept all request and its Cancel control");

  /* 2. the fixture book for the constructor and the route */
  const state = {
    PRODUCTS: { salt: { name: "salt" }, oil: { name: "oil" }, spare: { name: "spare", retired: true } },
    roster: ["CX1-ZED", "CX2-ZED", "CX3-ZED", "CX5-ZED", "AX1-ZED", "AX1-ZED-R", "SX1-ZED"],
    TIER_OF: { "CX1-ZED": { salt: "Gold" } }
  };
  const band = { small: "Platinum", mid: "Platinum", big: "Gold" };
  const pricing = {
    tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"],
    tierOf: { "CX1-ZED": { salt: "Gold" }, "CX2-ZED": { salt: "Platinum", oil: "Silver", spare: "Gold" }, "CX3-ZED": { salt: band },
      "CX5-ZED": { salt: "Titanium" }, "AX1-ZED-R": { salt: "Gold" }, "CX9-OUT": { salt: "Gold" } },
    byProduct: { salt: { inputs: { policy: { tierRule: { multiples: [1, 2] } } } }, oil: { inputs: { policy: { tierRule: { fixed: true } } } },
      spare: { inputs: { policy: { tierRule: { multiples: [1] } } } } }
  };
  const book = (patch = {}) => ({ version: 1, sales: [], purchases: [], state: { ...state, ...(patch.state || {}) }, pricing });
  const made = makerTierAcceptAll({ at: AT }, book(), []);
  ok(made.entry && norm(made.entry.payload.tiers) === norm({ "CX2-ZED": { salt: "Platinum" }, "CX3-ZED": { salt: band }, "CX5-ZED": { salt: "Titanium" } })
    && made.entry.raw.startsWith("Set 3 customers from their proposals: CX2-ZED salt Platinum;"),
    "Accept all proposes tiered, active books to roster customers only: not held, fixed, retired, resale or off-roster");
  const allHeld = makerTierAcceptAll({ at: AT }, book({ state: { TIER_OF: { "CX1-ZED": { salt: "Gold" }, "CX2-ZED": { salt: "Gold" },
    "CX3-ZED": { salt: "Gold" }, "CX5-ZED": { salt: "Gold" } } } }), []);
  ok(!allHeld.entry && /no tier proposal/i.test(allHeld.error), "when every tier is held there is nothing to accept");
  const waiting = [
    { at: "2026-10-05T07:00:00.000Z", payload: { mode: "tierset", tiers: { "CX2-ZED": { salt: "Gold" } } } },
    { at: "2026-10-05T07:01:00.000Z", payload: { mode: "addid", code: "CX5-ZED", tiers: { salt: "Silver" } } },
    { at: AT, payload: { mode: "tierset", tiers: { "CX3-ZED": { salt: "Gold" } } } }];
  const skipped = makerTierAcceptAll({ at: AT }, book(), waiting);
  ok(skipped.entry && norm(skipped.entry.payload.tiers) === norm({ "CX3-ZED": { salt: band } }),
    "a tier already queued, by a tierset or an Add ID, is skipped, while the request's own earlier entry is not counted");
  ok(!!makerTierAcceptAll({ at: AT, code: "CX2-ZED" }, book(), []).error && !!makerTierAcceptAll({ at: "now" }, book(), []).error,
    "Accept all carries only its canonical timestamp");

  /* 3. the route: owner, bridge, Desk, a real queue and drafter */
  const { DatabaseSync } = await import("node:sqlite");
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
    for (const [k, v] of Object.entries({ ...state, PRICING: pricing }))
      db.prepare("INSERT INTO state(key,doc) VALUES (?,?)").run(k, JSON.stringify(v));
    db.prepare("INSERT INTO snapshot(one,v,stamped) VALUES (1,'a1-fixture',NULL)").run();
    const key = "counter-maker-test-key-0123456789abcdef", owner = { email: "  MAAKMAL97@ICLOUD.COM " };
    const deskEnv = { COUNTER_MAKER_KEY: key, SALT_QUEUE: new KV(), SALT_LEDGER: d1 };
    const bridged = [];
    const counter = { COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => {
      bridged.push(new URL(request.url).pathname);
      return worker.fetch(request, deskEnv, { waitUntil() {} });
    } } };
    const call = (body, who = owner, path = "/all/maker/inputs/tier-accept-all") => handleMaker(new Request("https://counter.test" + path, {
      method: "POST", body: JSON.stringify(body) }), counter, path, who);
    const drafts = () => db.prepare("SELECT id,collection,status,row FROM draft").all();

    const denied = await call({ at: AT }, { email: "other@example.com" }), none = await call({ at: AT }, null);
    const wrongPath = await call({ at: AT }, owner, "/all/maker/inputs/tier-accept-all-x");
    const noKey = await worker.fetch(new Request("https://desk.test/_internal/maker/inputs/tier-accept-all", { method: "POST",
      body: JSON.stringify({ at: AT }) }), deskEnv, { waitUntil() {} });
    ok(denied.status === 403 && none.status === 403 && wrongPath.status === 404 && noKey.status === 404
      && bridged.length === 0 && drafts().length === 0,
      "Accept all is refused to any other identity, an unlisted path and a Desk call without the bridge key, and writes nothing");

    const first = await call({ at: AT }), firstBody = await first.json();
    const rows = drafts();
    ok(first.status === 200 && firstBody.ok && rows.length === 1 && rows[0].collection === "tierset" && rows[0].status === "pending" && firstBody.draft === AT
      && bridged.length === 1 && bridged[0] === "/_internal/maker/inputs/tier-accept-all"
      && norm(JSON.parse(rows[0].row).tiers) === norm({ "CX2-ZED": { salt: "Platinum" }, "CX3-ZED": { salt: band }, "CX5-ZED": { salt: "Titanium" } }),
      "the owner's Accept all crosses the bridge to one pending tierset draft of exactly the proposed tiers");
    const retry = await call({ at: AT }), retryBody = await retry.json();
    ok(retry.status === 200 && retryBody.ok && retryBody.queued === false && retryBody.draft === AT && drafts().length === 1
      && db.prepare("SELECT COUNT(*) AS n FROM maker_request").get().n === 1,
      "a retry under the same request id answers the first result and makes no second draft");
    const again = await call({ at: "2026-10-05T08:05:00.000Z" });
    ok(again.status === 400 && drafts().length === 1,
      "tiers already waiting under Approve are not proposed again by a fresh request");
  } finally { db.close(); }
}
