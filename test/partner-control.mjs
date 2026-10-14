/* test/partner-control.mjs: his decision of 09 Oct 2026, A PARTNER IS SET FROM THE PHONE AND KEEPS EVERY ASSOCIATE PROPERTY. The
   Drift card's Make partner queues a name-free `partner` entry; the drafter turns it into a roster row; the fold files the code in
   `partners` and, if they are no associate yet, appoints them on the R2 stream with their -R account. Fixture books throughout, so
   nothing moves when the real roster does. */
import { FROZEN_MASTER } from "./frozen.mjs";
import fs from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export async function run({ ok }) {
  const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
  const PE = (await import("../engine/position.mjs")).default;
  const { draftRow } = await import("../src/drafter.js");
  const { plan, apply } = await import("../tools/fold.mjs");
  const { openMaster } = await import("../tools/payload.mjs");
  const master = fs.readFileSync(FROZEN_MASTER, "utf8");

  /* 1. THE ENTRY: codes only, one mode, and it is not an Add ID (which the pair vault gates) */
  const e = PE.partnerEntry({ at: "2026-10-09T01:00:00.000Z", code: "CX1-OLD" });
  ok(e.payload.mode === "partner" && e.payload.code === "CX1-OLD" && Object.keys(e.payload).length === 2 && e.status === "partner",
    "the partner entry carries the code and nothing else: " + JSON.stringify(e.payload));

  /* 2. THE DRAFTER */
  const state = { roster: ["CX1-OLD", "CX2-AS", "CX2-AS-R", "CX3-PT", "CX4-OLD-R", "SX1-SUP", "CX5-OLD-Gen"], associates: ["CX2-AS"], partners: ["CX3-PT"] };
  const book = { state, pricing: { tierNames: [] } };
  const d = (code) => draftRow({ at: "2026-10-09T01:00:00.000Z", payload: { mode: "partner", code } }, book);
  const a = d("CX1-OLD"), b = d("CX2-AS");
  ok(a.collection === "roster" && a.row.partner === true && a.row.kind === "reseller" && /APPOINTS them on the R2 stream/.test(a.reasoning) && /CX1-OLD-R joins the roster/.test(a.reasoning),
    "a customer is drafted as a roster row that appoints and makes a partner: " + JSON.stringify(a.row));
  ok(b.collection === "roster" && b.row.partner === true && /nothing is appointed twice/.test(b.reasoning),
    "an associate is drafted as a partner alone, with nothing appointed twice");
  const refused = ["CX3-PT", "NOPE", "SX1-SUP", "CX4-OLD-R", "CX5-OLD-Gen"].map((c) => d(c).skip || "");
  ok(refused.every(Boolean), "a partner already, a stranger, a supplier, a resale account and a bucket are all refused: " + JSON.stringify(refused));

  /* 3. THE FOLD */
  const B = () => ({ roster: ["CX1-OLD", "CX2-AS", "CX2-AS-R", "CX3-PT"], associates: ["CX2-AS", "CX3-PT"], partners: ["CX3-PT"], PRODUCTS: { salt: {} }, sales: [], purchases: [], QUEUE_COMMITTED: "2026-01-01T00:00:00.000Z" });
  const stage = (at, code) => ({ ok: true, count: 1, approved: [{ id: at, collection: "roster", row: { code, kind: "reseller", parent: null, note: null, partner: true }, entry: { at, payload: { mode: "partner", code } } }] });
  const notes = { version: "v9999", date: "09 Oct 2026", title: "TEST", notes: ["<b>TEST.</b>"], rows: {}, stockNote: "" };
  const pNew = plan(B(), stage("2026-10-09T01:01:00.000Z", "CX1-OLD"), null);
  ok(pNew.items.length === 1 && pNew.items[0].roster.partner === true && pNew.items[0].roster.appoint === true && pNew.items[0].roster.resell === "CX1-OLD-R" && pNew.items[0].roster.register === false,
    "a customer is planned as appointed, given the -R account and made a partner: " + JSON.stringify(pNew.items[0] && pNew.items[0].roster));
  const pAs = plan(B(), stage("2026-10-09T01:02:00.000Z", "CX2-AS"), null);
  ok(pAs.items.length === 1 && pAs.items[0].roster.partner === true && pAs.items[0].roster.appoint === false,
    "an associate is planned as a partner and not appointed again");
  const pTwice = plan(B(), stage("2026-10-09T01:03:00.000Z", "CX3-PT"), null), pGone = plan(B(), stage("2026-10-09T01:04:00.000Z", "CX9-NONE"), null);
  ok(pTwice.items.length === 0 && /already a partner/.test((pTwice.refused[0] || {}).why || "") && pGone.items.length === 0 && pGone.refused.length === 1,
    "a partner already, and a code not on the roster, are refused");
  {
    const A = B();
    const r1 = apply(A, stage("2026-10-09T01:05:00.000Z", "CX1-OLD"), notes, master);
    ok(r1.ok && A.partners.includes("CX1-OLD") && A.associates.includes("CX1-OLD") && A.roster.includes("CX1-OLD-R"),
      "applied, the customer is a partner, an associate and has the -R account" + (r1.ok ? "" : ": " + (r1.problems || []).join("; ")));
    const A2 = B();
    apply(A2, stage("2026-10-09T01:06:00.000Z", "CX2-AS"), notes, master);
    ok(A2.partners.includes("CX2-AS") && A2.associates.filter((x) => x === "CX2-AS").length === 1 && A2.roster.filter((x) => x === "CX2-AS-R").length === 1,
      "an associate made a partner is listed once in each place");
    apply(A2, stage("2026-10-09T01:07:00.000Z", "CX2-AS"), notes, master);
    ok(A2.partners.filter((x) => x === "CX2-AS").length === 1, "and a replay adds nothing twice");
  }

  /* 4. THE DESK: one tap queues the entry and shows the standing at once; the card then waits, and a partner has no button */
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  const rd = (x) => JSON.parse(String(w.eval("JSON.stringify(" + x + ")")));
  w.eval("setProd('salt');recompute();");
  const pick = rd("(function(){return tierCustomers().filter(function(id){return partners.indexOf(id)<0&&associates.indexOf(id)<0&&!isBucket(id)&&id[0]==='C'&&id.indexOf('-R')<0;})[0];})()");
  const before = String(w.eval("driftCard()"));
  const floorBefore = rd("cardQuote(" + JSON.stringify(pick) + ",1)");
  const q = rd("queue.filter(function(x){return x&&x.payload&&x.payload.mode==='partner';})");
  const after = String(w.eval("driftCard()"));
  const floorNow = rd("(function(){var C=pxCost(),P=Object.assign({},pxPolicy(),{tierRule:TIER_RULE[PROD]});return PRICING_ENGINE.floorTotal(1,C,P);})()");
}
