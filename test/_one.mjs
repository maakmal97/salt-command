/* verify.mjs — smoke tests for the new cloud surface.
 *
 * Covers the risky new code: the Worker's queue contract against a KV mock, the build's
 * patch integrity and script validity, and the drain's pure helpers. The desk's own
 * rendering is tested by the daily run's jsdom pass; this suite guards the cloud plumbing.
 * No network, no browser: `npm test` runs it in a couple of seconds.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { DATA_DIR, PROJECT_DIR } from "../tools/book.mjs";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/worker.js";
import stmtWorker, { normUser } from "../stmt/worker.js";
import { unionByAt, pruneCommitted } from "../tools/drain.mjs";
import { NAME_STOPWORDS, NAME_COLLISIONS, areaNameSet, publishedLocalities } from "../tools/book.mjs";
import { opened } from "../tools/payload.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("  FAIL: " + m); } };
/* AN ASSERTION THAT CANNOT RUN ON EVERY MACHINE IS NOT PART OF THE FLOOR (v437). Two blocks read
   files that live outside this repo and can never enter it: the plaintext directory (hard rule 3)
   and serve_desk.py. So the laptop runs ten checks CI cannot, the floor was raised to the laptop's
   count at v434, and CI has failed on that one line ever since -- through v434, v435 and v436, each
   of which was reported as shipped and green. Nothing substantive failed; the instrument did. Both
   halves of that are the round-ten lesson: a floor calibrated on one machine and enforced on
   another is not a floor, and a red run nobody reads is the same as no run.
   okOff counts as a pass or a fail exactly as ok does. It is subtracted from the FLOOR only, so
   the floor measures what every machine reaches and CI and the laptop can agree on it. */
let offMachine = 0;
const okOff = (c, m) => { offMachine++; ok(c, m); };
const skipOff = (m) => { console.log("  SKIP: " + m); };
/* A SKIP IS NOT A PASS (v442). Nine assertions were written as ok(true, "... (skipped)") for a
   state the book happens not to carry. Each was counted as proof, and each is an assertion that
   CANNOT FAIL, which is the fault this whole round is about: a green tick for a check that never
   ran. None of them is firing today, so nothing was actually being covered up, and that is
   exactly why it was worth fixing now rather than after a book change made one fire silently.
   skipData prints and counts NOTHING, so a section that goes quiet takes the assertion floor
   down with it and CI says so. It is deliberately NOT okOff: okOff is for a check this MACHINE
   cannot run, which is a property of where you are, and this is a check the BOOK cannot feed,
   which is a property of the data and can change under you.
   The floor keeps a margin for these, and the margin is not room for a section to fall out. */
const skipData = (m) => { console.log("  SKIP (no data): " + m); };
let sections = 0;
/* EACH SECTION'S BODY IS ITS OWN ASYNC FUNCTION, `await (async () => { ... })();` (17 Sep 2026). A block at
   the top level of this module is never freed: the module body is suspended at every await, and V8 keeps what
   its blocks held for as long as it runs, closed jsdom window or not. So every desk window stayed alive to the
   end, 4,031 MB of them after a forced GC at v682, and the Linux runner died of heap exhaustion in the v678
   sections while the laptop scraped through. One wrapper around the whole suite does not help, since that
   function is suspended just the same; each section has to return. The last section checks the shape.
   AND EVERY WINDOW openMaster OPENED IS CLOSED HERE, WHEN THE NEXT SECTION STARTS. Most sections never closed
   theirs, and a window left open is held by its own pending timers. Those timers do not fire between sections:
   most sections never yield to the event loop, so a timer waits for the next one that does file or crypto work,
   and a close put on a timer would wait with them. So the close is immediate. */
const section = (s) => {
  for (const w of opened) { try { w.close(); } catch (e) { /* closed already */ } }
  opened.clear();
  sections++; console.log("\n" + s);
};

/* ---- KV + env mocks ------------------------------------------------------------- */
class KV {
  constructor() { this.m = new Map(); this.opts = new Map(); }
  /* v688: the options are kept as well as the value. Real KV expires a key by them, and a route
     that means to write something short-lived (a sent tick, a one-time link) is only doing that
     if the expiry is really passed; ignoring them here would pass either way. */
  async put(k, v, o) { this.m.set(k, v); this.opts.set(k, o || null); }
  /* Real KV takes a type argument and "json" parses for you. The statement route uses it, so
     the stand-in has to as well, or a call that works here fails in production. */
  async get(k, type) {
    if (!this.m.has(k)) return null;
    const raw = this.m.get(k);
    return type === "json" ? JSON.parse(raw) : raw;
  }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.m.keys()].filter(k => k.startsWith(prefix)).map(name => ({ name })), list_complete: true };
  }
}
const assets = {
  async fetch(req) {
    const p = new URL(req.url).pathname;
    if (p === "/missing") return new Response("nope", { status: 404 });
    /* v387: THE FILES THAT ARE GONE 404 HERE TOO, or the harness cannot see the fallback.
       public/index.html and public/data.json are retired with the app, so the asset store
       has neither, and /app is no longer a route: all three land on the SPA fallback. */
    if (p === "/index.html" || p === "/data.json" || p === "/app") return new Response("nope", { status: 404 });
    if (p === "/") return new Response("nope", { status: 404 });
    return new Response("ASSET:" + p, { status: 200 });
  }
};
const mkEnv = (kv, requireAccess = "0") => ({ SALT_QUEUE: kv, ASSETS: assets, REQUIRE_ACCESS: requireAccess });
const req = (path, opts = {}) => new Request("https://salt-command.example" + path, opts);
const postQ = (body, extraHeaders = {}) => req("/queue", {
  method: "POST", headers: { "content-type": "application/json", ...extraHeaders }, body: JSON.stringify(body)
});

/* ---- 1. Worker: the queue contract --------------------------------------------- */
section("v733: a free unit is a tap, and the reward shrinks with the gift");
await (async () => {
  /* HIS DECISION OF 19 SEP 2026, asked as a question and answered "Yes -- the reward shrinks with
     the gift": a free unit handed over alongside an order cost the shelf real salt and was charged
     against the reward nowhere, so a customer earned on the full margin of what they paid for and
     kept what they were given as well. And his instruction that a gift should be a TAP: four are on
     the book and every one was typed at the laptop, because the only route that minted a goodwill
     row was Redeem, which settles against a balance the customer earned. */
  const { openMaster } = await import("../tools/payload.mjs");
  const { w } = await openMaster();
  const rd = (x) => JSON.parse(String(w.eval("JSON.stringify(" + x + ")")));
  const msrc = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");

  /* ---- WHY IT IS A SECOND WALK AND NOT A WIDER FILTER ----
     The tempting one-line fix is to stop dropping goodwill rows from pricedSales. It shrinks
     nothing, and this is the assertion that says so before somebody tries it. */
  const s176 = rd("sales.find(function(s){return s.rid==='s176';})");
  ok(!!s176 && s176.goodwill === true && !s176.rebate && s176.total === s176.cost,
    "a gift's total IS its cost, by the convention every gift row has carried since s031");
  ok(Math.abs((s176.total || 0) - (s176.qty || 0) * (s176.cost / s176.qty)) < 0.005,
    "so its MARGIN is exactly zero: letting gifts back into pricedSales would take nothing off the "
    + "reward at all, and s056, whose total is the price it was first written at, would ADD to it. "
    + "The rule needs the gift's COST subtracted, which membership can never produce");

  /* ---- THE SPLIT IS ONE FLAG, AND IT IS ALREADY ON EVERY ROW ---- */
  const gifts = rd("pSales(PROD).filter(function(s){return s.goodwill&&!s.rebate;}).map(function(s){return s.rid;})");
  const redeems = rd("pSales(PROD).filter(function(s){return s.goodwill&&s.rebate;}).map(function(s){return s.rid;})");
  ok(["s031", "s056", "s176", "s181"].every((r) => gifts.includes(r)) && redeems.length >= 3
    && !gifts.some((r) => redeems.includes(r)),
    "the gifts and the redemptions are told apart by rebate alone, and no row is both (v758: the "
    + "four and the three are the ones that were here, not a ceiling): " + JSON.stringify({ gifts, redeems }));

  /* ---- THE CHARGE, ON A FIXTURE WHERE EVERY FIGURE IS KNOWN ---- */
  const before = rd("rewardMargin('CZ9-GIFT',[])");
  w.eval("sales.push({rid:'zg1',customer:'CZ9-GIFT',qty:2,total:200,cost:96,cash:200,deliveredQty:2,deliveredOn:'2026-09-01',date:'2026-09-01',product:'salt'});"
    + "recompute();"   /* recompute ALONE: applyOverlay rebuilds sales from the committed base and would wipe the pushed row */);
  const paid = rd("rewardMargin('CZ9-GIFT',[])");
  ok(before.mine.margin === 0 && Math.abs(paid.mine.margin - 104) < 0.005 && paid.mine.n === 1,
    "a paid order of RM200 costing RM96 earns on RM104 of margin: " + JSON.stringify(paid.mine));

  w.eval("sales.push({rid:'zg2',customer:'CZ9-GIFT',qty:1,total:48,cost:48,cash:0,settledRM:48,goodwill:true,deliveredQty:1,deliveredOn:'2026-09-02',date:'2026-09-02',product:'salt'});"
    + "recompute();"   /* recompute ALONE: applyOverlay rebuilds sales from the committed base and would wipe the pushed row */);
  const gifted = rd("rewardMargin('CZ9-GIFT',[])");
  ok(Math.abs(gifted.mine.margin - 56) < 0.005 && gifted.mine.n === 1,
    "THE GIFT TAKES ITS COST OFF: RM104 less the RM48 the free unit cost is RM56, and the count of "
    + "PRICED orders does not move, because a gift is not one: " + JSON.stringify(gifted.mine));

  w.eval("sales.push({rid:'zg3',customer:'CZ9-GIFT',qty:1,total:48,cost:48,cash:0,settledRM:48,goodwill:true,rebate:true,rebateKg:1,deliveredQty:1,deliveredOn:'2026-09-03',date:'2026-09-03',product:'salt'});"
    + "recompute();"   /* recompute ALONE: applyOverlay rebuilds sales from the committed base and would wipe the pushed row */);
  const redeemed = rd("rewardMargin('CZ9-GIFT',[])");
  ok(Math.abs(redeemed.mine.margin - 56) < 0.005,
    "A REDEMPTION DOES NOT: it is a unit they EARNED, netted at the reader through rebateApplied, so "
    + "charging it here would take the same unit twice: " + JSON.stringify(redeemed.mine));

  w.eval("sales.push({rid:'zg4',customer:'CZ9-GIFT',qty:1,total:48,cost:48,cash:0,settledRM:48,goodwill:true,cancelled:true,cancelledOn:'2026-09-04',deliveredQty:0,date:'2026-09-04',product:'salt'});"
    + "recompute();"   /* recompute ALONE: applyOverlay rebuilds sales from the committed base and would wipe the pushed row */);
  ok(Math.abs(rd("rewardMargin('CZ9-GIFT',[])").mine.margin - 56) < 0.005,
    "and a cancelled gift does not, because the guards pricedSales carried are restated on the new walk");

  /* ---- WHAT IT DOES TO THE LIVE BOOK, STATED RATHER THAN DISCOVERED ----
     THE GUARD IS PROVED HERE AND NOT ONLY ON A FIXTURE. This version was written against a book on
     which CE4-CHE held a gift, s181, and the charge took them from two free units to one. v730
     WITHDREW that gift while this was being built: the unit never left the shelf, so the row is
     cancelled, and the customer keeps both units. Nothing in the rule changed; the guard did its
     work on a row that moved under it, which is the case a fixture can only imitate. */
  const che = rd("customerRewards().find(function(r){return r.id==='CE4-CHE';})");
  const s181 = rd("sales.find(function(s){return s.rid==='s181';})");
  ok(!!s181 && s181.goodwill === true && !s181.rebate && s181.cancelled === true,
    "s181 is a gift that was withdrawn: goodwill, no rebate, cancelled");
  ok(!!che && che.taken === 0 && Math.abs(che.free - che.earned) < 1e-9 && che.earned >= 2,
    "so CE4-CHE keeps EVERY unit they earned and has taken none: " + JSON.stringify(che));
  ok(!!s181 && s181.cost == null,
    "and it carries no cost of its own, so were it live it would be charged at the book's weighted "
    + "average, which is what costOf does for every uncosted row: the fallback is stated, not hidden");
  /* the two that DO bite: read here, and proved by TAKING THE GIFT AWAY at the foot of this
     section rather than by pinning a pool figure their next order moves (v758) */
  const okr = rd("customerRewards().find(function(r){return r.id==='CC5-OKR';})");
  const wm = rd("networkStats().find(function(r){return r.id==='CN6-WM';})");
  ok(!!okr && !!wm && typeof okr.margin === "number" && typeof wm.marginTotal === "number",
    "CC5-OKR holds a customer's pool and CN6-WM an associate's: " + JSON.stringify({ okr: okr.margin, wm: wm.marginTotal }));
  /* real codes only: the CZ9 fixtures above include a redemption against nothing earned, which is a
     negative holding by design (the engine carries one and the next unit absorbs it). */
  const negHold = rd("customerRewards().filter(function(r){return r.free<-0.005&&!/^CZ9/.test(r.id);}).map(function(r){return {id:r.id,margin:r.margin,earned:r.earned,taken:r.taken,free:r.free};})");
  ok(negHold.length === 0,
    "and no holding anywhere on the book goes negative: nobody has taken more than the new figure earns: " + JSON.stringify(negHold));

  /* ---- THE CHARGE IS PROVED BY TAKING THE GIFT AWAY (v758) ----------------------------------
     This section pinned three live pool figures: CE4-CHE at RM1,017, CC5-OKR at RM163 and CN6-WM
     at RM1,009.20. They are facts about a book that keeps moving, and his sales of 19 September
     took CE4-CHE to RM1,147, so a version that had changed nothing went red at the last step of a
     live run. A CHARGE IS A DIFFERENCE, so it is measured as one: drop the row, recompute, and
     what the pool does is the whole of the rule. A withdrawn gift must move it not at all; a live
     one must give back exactly its cost, which is the book's weighted average where the row
     carries none of its own and therefore is not a figure to pin either. */
  const drop = (rids) => w.eval("(function(){['" + rids.join("','")
    + "'].forEach(function(r){var i=sales.findIndex(function(s){return s.rid===r;});if(i>=0)sales.splice(i,1);});})();recompute();");
  const pool = (id) => rd("(customerRewards().find(function(r){return r.id==='" + id + "';})||{}).margin");
  const net = (id) => rd("(networkStats().find(function(x){return x.id==='" + id + "';})||{}).marginTotal");
  const costOf = (rids) => rd("(function(){return +['" + rids.join("','")
    + "'].reduce(function(a,r){var s=sales.find(function(x){return x.rid===r;});return a+(s?(s.qty||0)*txUnitCost(s,wavgBuy):0);},0).toFixed(2);})()");
  const cheWas = pool("CE4-CHE");
  drop(["s181"]);
  ok(Math.abs(pool("CE4-CHE") - cheWas) < 0.005,
    "the withdrawn gift charges CE4-CHE nothing: dropping s181 leaves their pool where it stood, at RM" + cheWas);
  const okrWas = pool("CC5-OKR"), okrCost = costOf(["s176"]);
  drop(["s176"]);
  ok(okrCost > 0.009 && Math.abs((pool("CC5-OKR") - okrWas) - okrCost) < 0.011,
    "and a LIVE gift charges its cost: dropping s176 gives CC5-OKR back RM" + (pool("CC5-OKR") - okrWas).toFixed(2)
    + ", which is s176's own RM" + okrCost);
  const wmWas = net("CN6-WM"), wmCost = costOf(["s031", "s056"]);
  drop(["s031", "s056"]);
  ok(wmCost > 0.009 && Math.abs((net("CN6-WM") - wmWas) - wmCost) < 0.011,
    "and it reaches an ASSOCIATE'S pooled figure and not only a customer table: dropping s031 and s056 "
    + "gives CN6-WM back RM" + (net("CN6-WM") - wmWas).toFixed(2) + ", their own RM" + wmCost);

  /* ---- THE TAP, IN A WINDOW OF ITS OWN ----
     The fixture rows above are pushed straight onto `sales` with a party that is on no roster, which
     is fine for the reward arithmetic and is not a book the entry form can be driven against. */
  w.close();
  const { w: w2 } = await openMaster();
  const $ = (id) => w2.document.getElementById(id);
  w2.eval("switchTab('add');wbMode='new';wbDir='SELL';wbApply();");
  ok(!!$("wbGift") && $("wbGiftWrap").style.display !== "none", "a sale offers the gift tick");
  $("wbTotal").value = "90"; $("wbCash").value = "90"; $("wbDelivery").value = "15";
  $("wbGift").checked = true; $("wbGift").onchange();
  ok($("wbTotal").disabled && $("wbTotal").value === "" && $("wbCash").disabled && $("wbCash").value === "0"
    && $("wbDelivery").disabled && $("wbDelivery").value === "0",
    "the tick shuts the three money boxes AND clears them: a gift has no price, takes no cash and "
    + "carries no carriage, and none of the three may be left behind for the payload to read");
  ok($("wbTotalLbl").textContent === "Goods (RM), booked at cost",
    "and the label says where the figure comes from instead: " + $("wbTotalLbl").textContent);
  $("wbGift").checked = false; $("wbGift").onchange();
  ok($("wbTotal").disabled === false && $("wbCash").disabled === false, "unticking re-opens all three");
  w2.eval("wbDir='BUY';wbApply();");
  ok($("wbGiftWrap").style.display === "none" && $("wbGift").checked === false,
    "a lot is not given away, so the tick is neither offered nor left ticked on the buy pane");

  /* the entry it queues */
  const party = String(w2.eval("roster.find(function(c){return c[0]==='C'&&!/-R$/.test(c);})"));
  const q = JSON.parse(String(w2.eval("(function(){try{queue=[];saveQueue=function(){return Promise.resolve(true);};qPost=function(){return Promise.resolve(true);};"
    + "switchTab('add');wbMode='new';wbDir='SELL';wbFillParty();wbApply();"
    + "var set=function(id,v){var e=document.getElementById(id);if(e)e.value=v;};"
    + "set('wbParty','" + party + "');set('wbQty','1');set('wbDate','2026-09-20');set('wbNote','a thank you');"
    + "var g=document.getElementById('wbGift');g.checked=true;g.onchange();wbRecord();"
    + "var e=queue[queue.length-1]||null;return JSON.stringify({e:e,tick:g.checked,qty:document.getElementById('wbQty').value});"
    + "}catch(e){return JSON.stringify({no:String(e&&e.message)});}})()")));
  ok(!q.no && !!q.e && q.e.type === "GIFT" && q.e.payload.mode === "gift" && q.e.payload.qty === 1
    && q.e.payload.total === undefined && q.e.payload.cash === undefined && /^Give 1 unit/.test(q.e.raw),
    "the tap queues a GIFT carrying the party, the units and the day and NO money figure, because the "
    + "cost is the shelf's and is the one number this desk never lets a person type over: " + JSON.stringify(q.e && q.e.payload));
  ok(q.tick === false && q.qty === "",
    "and the tick is cleared after, as the cover tick is: a gift is decided for each entry, never inherited");

  /* ---- THE DRAFTER MINTS THE CONVENTION, AND NOT THE OTHER ONE ---- */
  const { draftRow } = await import("../src/drafter.js");
  const bk = {
    version: "v729",
    pricing: { v: "v729", byProduct: { salt: { stockCost: 48, replCost: 48, floors: { "1": { floor: 54 } } } } },
    purchases: [{ date: "2026-08-13", qty: 50, total: 2400, receivedOn: "2026-08-13" }],
    sales: [], state: { roster: ["CZ9-GF"], QUEUE_COMMITTED: "2026-08-14T00:00:00.000Z" },
  };
  const gift = (pay) => draftRow({ at: "2026-09-20T01:00:00.000Z", payload: Object.assign({ mode: "gift", product: "salt", party: "CZ9-GF", qty: 1, date: "2026-09-20" }, pay) }, bk);
  const g1 = gift({ kg: 1, handover: "collected", note: "a thank you" });
  ok(!g1.skip && g1.collection === "sales" && g1.row.total === 48 && g1.row.cost === 48 && g1.row.cash === 0
    && g1.row.settledRM === 48 && g1.row.goodwill === true && g1.row.deliveredQty === 1 && g1.row.deliveredOn === "2026-09-20",
    "the drafted row is the convention s176 carries, priced at the shelf's own figure: " + JSON.stringify(g1.row));
  ok(!g1.skip && g1.row.rebate === undefined,
    "AND IT CARRIES NO rebate, which is the whole distinction: a gift with that flag would be read as "
    + "a redemption and escape the very charge this version adds");
  ok(/charged against their reward/.test(g1.reasoning) && /not a redemption/.test(g1.flags.join(" ")),
    "and the card says both what it costs and what it is not");
  ok(!!gift({ party: null }).skip && !!gift({ qty: 0 }).skip && !!gift({ date: null }).skip
    && /handover is delivered or collected/.test(String(gift({ handover: "banana" }).skip || "")),
    "a gift with no party, no units, no date or a handover outside the closed list is refused");

  /* A GIFT IS BOOKED AT COST WHATEVER THE ENTRY SAYS, which is the one figure this desk never lets
     a person type over: the cost of the shelf decides what leaving it costs, not the tap. */
  const g2 = gift({ total: 999, cash: 500 });
  ok(!g2.skip && g2.row.total === 48 && g2.row.settledRM === 48 && g2.row.cash === 0,
    "a gift entry carrying a price and a payment is still booked at the shelf's RM48 with nothing paid: " + JSON.stringify(g2.row));

  /* the Approve card tells the two apart, DRIVEN, because approving them is the same tap and a pin
     on the source text would stay green through a branch that never runs */
  const card = (row) => String(w2.eval("apCard(" + JSON.stringify({ collection: "sales", row }) + ")"));
  const giftCard = card({ customer: "CZ9-GF", qty: 1, total: 48, cost: 48, cash: 0, settledRM: 48, goodwill: true, date: "2026-09-20" });
  const redCard = card({ customer: "CZ9-GF", qty: 1, total: 48, cost: 48, cash: 0, settledRM: 48, goodwill: true, rebate: true, rebateKg: 1, date: "2026-09-20" });
  ok(/a gift and not a sale/.test(giftCard) && /Off their reward/.test(giftCard) && !/settled by the reward/.test(giftCard),
    "the card for a gift says it is one, and names what it costs their reward");
  ok(/settled by the reward/.test(redCard) && !/a gift and not a sale/.test(redCard),
    "and the card for a redemption still says the opposite thing, which is what it is");
  w2.close();
})();

section("v750: the three orders of 16, 18 and 19 September each read 5 unit, RM420 and RM15 of carriage, completed");
await (async () => {
  /* his word of 20 Sep 2026. The 16th's row had its carriage zeroed by a correction that day and took RM420
     where RM435 was owed; the 18th's said nothing about who moved the goods. The 19th already read right. */
  const E = (await import("../engine/position.mjs")).default;
  const bk = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
  const three = ["s168", "s173", "s183"].map((id) => bk.sales.find((r) => r.rid === id));
  ok(three.every(Boolean), "the three rows are on the book: " + JSON.stringify(three.map((r) => r && r.rid)));
  const shape = three.map((r) => ({ rid: r.rid, date: r.date, qty: r.qty, goods: E.txGoods(r), carriage: +r.delivery || 0,
    owed: E.txOwed(r), paid: E.txPaid(r), moved: E.txEffDeliv(r), handover: r.handover || null, state: E.txStat(r).order }));
  ok(JSON.stringify(shape.map((s) => s.date)) === JSON.stringify(["2026-09-16", "2026-09-18", "2026-09-19"]),
    "one on each of the three days: " + JSON.stringify(shape.map((s) => s.date)));
  const wrong = shape.filter((s) => !(s.qty === 5 && s.goods === 420 && s.carriage === 15 && s.owed === 435 && s.paid === 435 && s.moved === 5));
  ok(!wrong.length, "each is 5 unit, RM420 of goods with RM15 of carriage, RM435 owed and RM435 in: " + JSON.stringify(wrong.length ? wrong : shape.map((s) => s.rid + " ok")));
  ok(shape.every((s) => s.state === "Completed"), "and each reads Completed: " + JSON.stringify(shape.map((s) => s.rid + " " + s.state)));
  /* A CARRIAGE MEANS HE DROVE, and the book has a word for that which is not the absence of one */
  ok(shape.every((s) => s.handover === "delivered"), "each says the goods were delivered, which is what a carriage means: " + JSON.stringify(shape.map((s) => s.rid + " " + s.handover)));

  /* ---- AND THE SHELF DOES NOT MOVE. The salt left it before the count, so the count already holds it ---- */
  /* v758: A COUNT THAT COVERS THEM, not the count that happened to be the newest the day this was
     written. It asked for 19 September and for the 22.65 unit v744 left, and his hand count of 21
     September moved both, turning a version that had changed nothing red. What is being proved is
     that these three rows may not roll the stated figure, and what proves it is a count on or after
     the last of their days, plus a note trail carrying no roll of this version's. */
  const counts = (bk.COUNTS || []).filter((c) => c.product === "salt");
  const lastDay = shape.map((s) => s.date).sort().slice(-1)[0];
  const cnt = counts.find((c) => c.date >= lastDay);
  ok(!!cnt, "a salt count covers the last of the three days: " + JSON.stringify(cnt && { date: cnt.date, qty: cnt.qty }));
  ok(!!cnt && three.every((r) => r.date <= cnt.date),
    "and all three days fall on or before that count, so nothing here may roll the stated figure");
  const rolls = (bk.NOTES && bk.NOTES.STATED_STOCK) || [];
  ok(!rolls.some((n) => /^ROLLED AT v750\b/.test(String(n))),
    "and no roll in the trail is this version's: " + rolls.length + " note(s), none of them v750's");
})();


console.log(`\n${pass} passed, ${fail} failed, across ${sections} sections`);
process.exit(fail ? 1 : 0);
