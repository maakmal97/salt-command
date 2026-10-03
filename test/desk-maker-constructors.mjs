import { openMaster } from "../tools/payload.mjs";
import E from "../engine/position.mjs";

export async function run({ ok }) {
  const lot = { rid: "fixture-lot", supplier: "SX1-ZED", date: "2026-10-01", qty: 2, total: 100 };
  const payment = E.ledgerAmendmentEntry({ at: "2026-10-02T00:00:00.000Z", row: lot, direction: "BUY",
    kind: "Payment", date: "2026-10-02", cash: 50 });
  const receipt = E.ledgerAmendmentEntry({ at: "2026-10-02T00:01:00.000Z", row: lot, direction: "BUY",
    kind: "Receipt", date: "2026-10-02", movedUnits: 1 });
  ok(payment.payload.kind === "Payment" && payment.payload.cash === 50 && payment.payload.kg === 0
    && receipt.payload.kind === "Receipt" && receipt.payload.cash === 0 && receipt.payload.kg === 1,
    "the shared amendment constructor retains incumbent purchase Payment and Receipt as distinct supported movements");
  let refused = 0;
  for (const kind of ["Linked", "Rewarded", "Payment", "Receipt", "unknown"]) {
    try { E.ledgerAmendmentEntry({ row: lot, direction: "SELL", kind, date: "2026-10-02" }); }
    catch (error) { if (error.message === "This amendment kind is retired or unsupported.") refused++; else throw error; }
  }
  ok(refused === 5, "shared amendment construction refuses Linked, Rewarded, unknown kinds and purchase-only movements on sales");
  const { w } = await openMaster();
  try {
    const entries = JSON.parse(w.eval(`(function(){
      queue=[];apPersist=function(){return '';};apDone=function(){};apSaved=function(){};
      var field=function(id,tag){var e=document.getElementById(id);if(!e){e=document.createElement(tag||'input');e.id=id;document.body.appendChild(e);}return e;};
      field('apKind','select').innerHTML='<option value="customer">Customer</option><option value="bucket">Bucket</option>';
      field('apParent','select').innerHTML='<option value="CX9-FIK">CX9-FIK</option>';
      field('apName').value='Zeno';field('apLoc').value='Invented Vale';field('apMsg','div');
      ['CZ4-IV','CX9-FIK-Gen'].forEach(function(code){var at=roster.indexOf(code);if(at>=0)roster.splice(at,1);});
      field('apKind').value='customer';addParty();
      field('apKind').value='bucket';addParty();
      return JSON.stringify(queue);
    })()`));
    ok(entries.length === 2 && entries[0].type === "ADDID" && entries[0].payload.code === "CZ4-IV"
      && entries[0].payload.kind === "customer" && entries[0].payload.rev === null
      && !JSON.stringify(entries).includes("Zeno") && !JSON.stringify(entries).includes("Invented Vale"),
      "legacy named Add ID uses the shared cloud-safe constructor without putting its device-only name/place in the queue");
    ok(entries[1]?.payload.code === "CX9-FIK-Gen" && entries[1].payload.kind === "bucket"
      && entries[1].payload.parent === "CX9-FIK" && entries[1].payload.rev === null
      && entries[1].payload.note === null,
      "legacy nameless Add ID preserves its bucket identity and parent through the shared constructor");
    const movement = JSON.parse(w.eval(`(function(){
      queue=[];edRid='fixture-editor';edType='SELL';updMode='move';
      var row={rid:edRid,customer:'CX9-FIK',date:'2026-10-01',qty:2,total:200,cash:0,deliveredQty:0};
      edRowOf=function(){return row;};edClose=function(){};applyOverlay=function(){};render=function(){};
      saveQueue=function(){return Promise.resolve(true);};
      var field=function(id,value){var e=document.getElementById(id);if(!e){e=document.createElement('input');e.id=id;document.body.appendChild(e);}e.value=value;};
      field('updDate','2026-10-02');field('updCash','100');field('updUnit','1');
      updQueue();return JSON.stringify(queue[0]);
    })()`));
    ok(movement?.payload.kind === "Fulfilment" && movement.payload.rid === "fixture-editor"
      && movement.payload.cash === 100 && movement.payload.kg === 1
      && movement.payload.direction === "SELL" && movement.payload.sameDay === false
      && movement.raw.includes("100") && movement.raw.includes("recorded"),
      "incumbent ledger movement keeps its RID, money, units, dates and copy through the shared amendment constructor");
  } finally { w.close(); }
}
