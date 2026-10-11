/* A6: Maker's printed board sizes, against the Desk's own shQueueHouse. A print setting, never a price. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";
import POSITION_ENGINE from "../engine/position.mjs";
import { makerHouseSizes, houseRungs, makerInputCatalog } from "../src/maker-inputs.js";
import { draftRow } from "../src/drafter.js";

const AT = "2026-10-05T09:00:00.000Z";
const strip = (e) => JSON.stringify({ ...e, at: null });

export async function run({ ok, KV, worker, handleMaker, REPO }) {
  /* 1. equal to the Desk: the real master's shQueueHouse is driven with ticks for the sizes, and Maker is asked for the same hide */
  const { w } = await openMaster();
  try {
    w.eval("queue=[];render=function(){};renderQueue=function(){};saveQueue=function(){return Promise.resolve(true);};applyOverlay=function(){};");
    const book = (prod) => ({ version: "fixture", sales: [], purchases: [], pricing: pricingSnapshot(w),
      state: { PRODUCTS: JSON.parse(w.eval("JSON.stringify(PRODUCTS)")), roster: [], PRICE_SET: JSON.parse(w.eval("JSON.stringify(PRICE_SET)")) } });
    const desk = (prod, hide) => JSON.parse(w.eval("(function(){queue=[];var H=" + JSON.stringify(hide) + ",P=" + JSON.stringify(prod) + ";"
      + "var keep=pxEl;pxEl=function(p,id){if(id==='shOut')return {innerHTML:'',closest:function(){return null;}};"
      + "var q=shSizes().find(function(s){return 'sh'+String(s).replace('.','_')+'s'===id;});"
      + "return q==null?null:{checked:H.every(function(h){return Math.abs(h-q)>0.009;})};};"
      + "pxProdOf=function(){return P;};try{shQueueHouse({});}finally{pxEl=keep;}"
      + "return JSON.stringify(queue.length===1?Object.assign({},queue[0],{at:null}):null);})()"));
    for (const prod of ["salt", "oil"]) {
      w.eval("PROD=" + JSON.stringify(prod) + ";recompute();");
      const rungs = JSON.parse(w.eval("JSON.stringify(shSizes())")), b = book(prod);
      ok(rungs.length > 2 && JSON.stringify(houseRungs(b, prod)) === JSON.stringify(rungs.slice().sort((a, c) => a - c)),
        "the rungs Maker offers for " + prod + " are the sizes the Desk's own board table lists");
      for (const hide of [[], [rungs[0]], [rungs[1], rungs[rungs.length - 1]]]) {
        const made = makerHouseSizes({ at: AT, product: prod, hide }, b), want = desk(prod, hide);
        ok(made.entry && want && strip(made.entry) === JSON.stringify(want),
          "Maker's board sizes for " + prod + " hiding " + JSON.stringify(hide) + " is the entry the Desk's shQueueHouse queues");
      }
    }
    /* a board that prints fewer rungs than the book carries: the Desk's shSizes cuts to boardBy, and Maker offers the same */
    w.eval("PROD='salt';PRICE_ENGINE.boardBy={salt:[1,2,3,5]};recompute();");
    const cut = JSON.parse(w.eval("JSON.stringify(shSizes())")), bc = book("salt");
    ok(JSON.stringify(cut) === "[1,2,3,5]" && JSON.stringify(houseRungs(bc, "salt")) === JSON.stringify(cut)
      && strip(makerHouseSizes({ at: AT, product: "salt", hide: [2] }, bc).entry || {}) === JSON.stringify(desk("salt", [2])),
      "with a board cut to some rungs, Maker offers exactly the Desk's shSizes and queues the Desk's entry");
    ok(!makerHouseSizes({ at: AT, product: "salt", hide: [0.5] }, bc).entry, "a rung the board does not print cannot be hidden");
    w.eval("PRICE_ENGINE.boardBy={};PROD='salt';recompute();");
    /* 2. a print setting, never a price: the drafter reads it as the Desk's entry, and a price in it is refused */
    const b = book("salt"), made = makerHouseSizes({ at: AT, product: "salt", hide: [0.5] }, b);
    ok(!!made.entry, "Maker's board sizes for salt hiding 0.5 are a proposed entry");
    const drafted = made.entry ? draftRow(made.entry, { ...b, state: { ...b.state, PRICING: b.pricing } }) : { row: { prices: { x: 1 }, hide: [] } };
    const deskDraft = draftRow({ ...desk("salt", [0.5]), at: AT }, { ...b, state: { ...b.state, PRICING: b.pricing } });
    ok(!!made.entry && Object.keys(made.entry.payload.prices).length === 0 &&made.entry.total === null && made.entry.qty === null
      && drafted.collection === "priceset" && Object.keys(drafted.row.prices).length === 0 && drafted.row.hide.length === 1
      && JSON.stringify(drafted.row) === JSON.stringify(deskDraft.row) && /sets no price either/.test(drafted.reasoning),
      "the entry carries no price figure and the drafter reads it as a hide list, as it reads the Desk's");
    const priced = draftRow({ ...desk("salt", [0.5]), at: AT, payload: { mode: "price", product: "salt", prices: { 1: 100 }, hide: [0.5], clearing: true } }, { ...b, state: { ...b.state, PRICING: b.pricing } });
    ok(!!priced.skip && /not folded/.test(priced.skip),
      "the drafter refuses a stated price in this entry, so an input that added one could not reach a draft");
  } finally { w.close(); }

  /* 3. the constructor's refusals */
  const state = { PRODUCTS: { salt: { name: "salt" }, oil: { name: "oil" }, spare: { name: "spare", retired: true } },
    roster: ["CX1-ZED"], PRICE_SET: { salt: { prices: {}, hide: [3] } } };
  const pricing = { tierNames: ["Gold"], byProduct: { salt: { sizes: [0.5, 1, 2, 4], inputs: { policy: { tierRule: { multiples: [1] } } } },
    oil: { sizes: [10, 20], inputs: { policy: { tierRule: { fixed: true } } } }, spare: { sizes: [1, 2] } } };
  const book = () => ({ version: 1, sales: [], purchases: [], state, pricing });
  const asked = (patch) => makerHouseSizes({ at: AT, product: "salt", hide: [0.5], ...patch }, book());
  ok(asked({}).entry && JSON.stringify(asked({}).entry.payload.hide) === "[0.5]"
    && JSON.stringify(asked({ hide: [3, 1, 3, 0.5] }).entry?.payload.hide) === "[0.5,1,3]",
    "sizes already hidden stay offered, repeats are dropped and the hide list is ascending");
  ok(!!asked({ prices: { 1: 100 } }).error && !!asked({ price: 100 }).error && !!asked({ total: 100 }).error
    && !!asked({ payload: {} }).error && !!asked({ prices: {} }).error,
    "no field can carry a price: any key beyond the timestamp, book and hide list is refused");
  ok(!!asked({ hide: [7] }).error && !!asked({ hide: ["1"] }).error && !!asked({ hide: [0] }).error && !!asked({ hide: [-1] }).error
    && !!asked({ hide: null }).error && !!asked({ hide: [0.5, 1, 2, 3, 4] }).error && !!asked({ product: "spare", hide: [1] }).error
    && !!asked({ product: "zzz" }).error && !!asked({ at: "now" }).error && !!asked({ hide: new Array(51).fill(1) }).error,
    "a size off the board, a non-number, hiding every size, a retired or unknown book and a loose timestamp are refused");
  ok(makerHouseSizes({ at: AT, product: "oil", hide: [] }, book()).entry?.raw === "Board sizes on oil: every size printed"
    && makerHouseSizes({ at: AT, product: "oil", hide: [20] }, book()).entry?.raw === "Board sizes on oil: hiding 20 unit",
    "putting every size back is an edit that clears the hide list, worded as the Desk words it");
  ok(JSON.stringify(makerInputCatalog(book()).houseBoards?.salt) === JSON.stringify({ sizes: [0.5, 1, 2, 3, 4], hidden: [3] }),
    "the input catalog offers each book's rungs and what is hidden now");

  /* 4. the control and its retained request */
  const owner_js = readFileSync(join(REPO, "stmt", "owner.js"), "utf8");
  ok(POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/house-sizes", body: { at: AT, product: "salt", hide: [0.5] } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/house-sizes-x", body: { at: AT } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/tier-set", body: { at: AT, hide: [1] } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/house-sizes", body: { at: AT, product: "salt", hide: [0] } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/house-sizes", body: { at: AT, product: "salt", hide: [-1] } })
    && POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/house-sizes", body: { at: AT, product: "salt", hide: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6.25] } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/house-sizes", body: { at: AT, product: "salt", hide: ["1"] } })
    && !POSITION_ENGINE.vaultPendingOk({ path: "/all/maker/inputs/house-sizes", body: { at: AT, product: "salt", hide: new Array(51).fill(1) } })
    && owner_js.includes("makerButton(houseSection,['Send board sizes for review','record.house.send']") && owner_js.includes("'/all/maker/inputs/house-sizes',body")
    && owner_js.includes("if(error.status===400&&path==='/all/maker/inputs/house-sizes'){makerClear(path);pending=null;cancel.hidden=true;}"),
    "the Counter Admin carries a Printed board sizes control whose retained request is a valid record and clears on a 400");
  ok(!/[\\`]/.test(owner_js.slice(owner_js.indexOf("A6: the Desk's Make it the house board"),
    owner_js.indexOf("makerOtherInputs(box,catalog,refreshMakerTradeCatalog);\n    }catch"))),
    "the control's source holds no backtick and no backslash, as a template literal needs");

  /* 5. the route: owner, bridge, Desk, a real queue and drafter */
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
    db.prepare("INSERT INTO snapshot(one,v,stamped) VALUES (1,'a6-fixture',NULL)").run();
    const key = "counter-maker-test-key-0123456789abcdef", owner = { email: "  MAAKMAL97@ICLOUD.COM " };
    const deskEnv = { COUNTER_MAKER_KEY: key, SALT_QUEUE: new KV(), SALT_LEDGER: d1 };
    const bridged = [];
    const counter = { COUNTER_MAKER_KEY: key, DESK_MAKER: { fetch: (request) => {
      bridged.push(new URL(request.url).pathname);
      return worker.fetch(request, deskEnv, { waitUntil() {} });
    } } };
    const call = (body, who = owner, path = "/all/maker/inputs/house-sizes") => handleMaker(new Request("https://counter.test" + path, {
      method: "POST", body: JSON.stringify(body) }), counter, path, who);
    const drafts = () => db.prepare("SELECT id,collection,status,row FROM draft").all();
    const body = { at: AT, product: "salt", hide: [0.5] };

    const denied = await call(body, { email: "other@example.com" }), none = await call(body, null);
    const wrongPath = await call(body, owner, "/all/maker/inputs/house-sizes-x");
    const noKey = await worker.fetch(new Request("https://desk.test/_internal/maker/inputs/house-sizes", { method: "POST",
      body: JSON.stringify(body) }), deskEnv, { waitUntil() {} });
    ok(denied.status === 403 && none.status === 403 && wrongPath.status === 404 && noKey.status === 404
      && bridged.length === 0 && drafts().length === 0,
      "board sizes are refused to any other identity, an unlisted path and a Desk call without the bridge key, and write nothing");

    const priced = await call({ ...body, prices: { 1: 100 } }), pricedBody = await priced.json();
    ok(priced.status === 400 && !pricedBody.ok && drafts().length === 0, "a request carrying a price is refused and queues nothing");

    const first = await call(body), firstBody = await first.json(), rows = drafts();
    ok(first.status === 200 && firstBody.ok && rows.length === 1 && rows[0].collection === "priceset" && rows[0].status === "pending"
      && firstBody.draft === AT && bridged.length === 2 && bridged[1] === "/_internal/maker/inputs/house-sizes"
      && JSON.stringify(JSON.parse(rows[0].row)) === JSON.stringify({ product: "salt", prices: {}, hide: [0.5] }),
      "the owner's board sizes cross the bridge to one pending priceset draft that hides the sizes and holds no price");
    const retry = await call(body), retryBody = await retry.json();
    ok(retry.status === 200 && retryBody.ok && retryBody.queued === false && retryBody.draft === AT && drafts().length === 1
      && db.prepare("SELECT COUNT(*) AS n FROM maker_request").get().n === 1,
      "a retry under the same request id answers the first result and makes no second draft");
    const clash = await call({ ...body, hide: [1] });
    ok(clash.status === 409 && drafts().length === 1, "the same request id for different sizes is refused, not queued");
  } finally { db.close(); }
}
