/* test/record-fresh.mjs: SALT ADMIN'S RECORD READS ITS ROWS AGAIN (25 Nov 2026, his answer "Re-read rows"). Record's rows were read once a page open, so a
 * payment or a receipt folded while the page stayed open left Record and Correct a row on the old figures: a lowered cash was refused on every tap, and a
 * Cash paid typed as the new total sent its difference from the old one, the payment booked twice, which nothing at the Desk could see. Each check red
 * under its own mutation (test/record-fresh.mutations.json), invented codes only (rule 2):
 *   D1  the Desk refuses Record's movement on a row whose paid or moved figures are not the ones it was worked out on, a kept retry included, and drafts
 *       it carrying nothing more when they are; a movement naming them in another shape is refused, and one naming none goes as before
 *   R1  a row opened on Record is read again, and one that moved since the page opened is filled with its new figures, saying so
 *   R2  Record reads the row again before it sends: one that moved since it was opened sends nothing and is filled again; the next tap sends the
 *       difference from the new figure, naming the figures it was worked out on, so a payment folded meanwhile is not booked twice
 *   R3  a lowering the Desk refuses as moved reads the row again and fills it, so the next tap asks on the cash the lot now holds
 *   R4  a row that cannot be read again before sending sends nothing, and says so
 *   R5  a late answer to the read as a row opened never fills over what he typed, nor over a send under way (the review: it dropped the movement)
 *   R7  a row cancelled or closed since it was opened sends nothing, and says so
 *   R8  a change that went while its movement was refused as moved says the change waits and what moved was not sent, so it is not sent twice
 *   C1  Correct a row reads its row again when one is chosen, so a lot's units received go with the units it now holds
 *   C2  and when Record's Other fields opens it on a row
 *   R6  Correct a row's refusal as moved never writes into the row Record has open, so Record's check before sending still sees the row moved
 * Drawn by the maker harness (test/maker-act.mjs), whose rows answer from `stage`, as the Desk's would after a fold. */
import { richOwnerPage, byAct, answerSheets } from "./maker-act.mjs";
import { makerLedgerAmendment } from "../src/maker-inputs.js";
import { readBook } from "../tools/book.mjs";

const J = JSON.stringify, AMEND = "/all/maker/inputs/ledger-amend", INPUTS = "/all/maker/inputs", D = "2026-11-20";
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run({ ok, pageWork }) {
  /* D1, on the Desk's road over the live book with invented rows */
  const source = await readBook();
  try {
    const copy = JSON.parse(JSON.stringify(source.ledger));
    copy.sales = copy.sales.concat([{ rid: "zd1", customer: "CX9-ZED", date: D, qty: 2, total: 200, cost: 90, cash: 50, deliveredQty: 1, handover: "collected", delivery: 0 }]);
    copy.purchases = copy.purchases.concat([{ rid: "zd2", supplier: "SX9-ZED", product: "salt", qty: 4, total: 200, cash: 100, status: "partial", date: D, receivedOn: D, receivedQty: 2, inTransit: true }]);
    const book = { sales: copy.sales, purchases: copy.purchases, state: copy, version: source.version, pricing: copy.PRICING };
    const today = source.w.eval("TODAY.toISOString().slice(0,10)");
    let n = 0;
    const move = (rid, extra) => makerLedgerAmendment({ at: "2026-11-25T05:00:" + String(n++).padStart(2, "0") + ".000Z", rid, kind: "Fulfilment", date: today, ...extra }, book);
    const good = move("zd1", { cash: 20, movedUnits: 0, expect: { cash: 50, movedUnits: 1 } }), lot = move("zd2", { cash: 0, movedUnits: 1, expect: { cash: 100, movedUnits: 2 } });
    const paid = move("zd1", { cash: 20, movedUnits: 0, expect: { cash: 30, movedUnits: 1 } }), moved = move("zd2", { cash: 0, movedUnits: 1, expect: { cash: 100, movedUnits: 1 } });
    const shape = move("zd1", { cash: 20, movedUnits: 0, expect: { cash: 50 } }), none = move("zd1", { cash: 20, movedUnits: 0 });
    ok(good.entry && good.entry.payload.expect === undefined && lot.entry && lot.entry.payload.expect === undefined
      && !paid.entry && paid.stale === true && /moved since Record read it \(paid RM 50\.00 and 1 unit moved, not RM 30\.00 and 1\), so nothing was sent/.test(paid.error || "")
      && !moved.entry && moved.stale === true && /2 unit moved, not RM 100\.00 and 1\)/.test(moved.error || "")
      && !shape.entry && /names the paid and moved figures it was worked out on/.test(shape.error || "") && none.entry,
      "D1: the Desk refuses Record's movement on a row whose figures moved since it was worked out, drafts it carrying nothing more when they hold, refuses another shape, and takes one naming none: "
      + J([good.error, lot.error, paid.error, moved.error, shape.error, none.error]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { source.w.close(); }

  /* the lot as the Desk holds it at each stage: 0 as the page opened, 1 after a payment of RM 20 and a receipt of 1 folded, 2 after a payment of RM 10,
     3 after another receipt of 1 */
  let stage = 0, broken = false, gone = false;
  const cash = () => [100, 120, 130, 130][stage], units = () => [2, 3, 3, 4][stage];
  const p = await richOwnerPage({ pageWork, probe: true,
    extra: (route, body) => {
      /* R3: the Desk refuses a lowering measured on RM 120 as moved, the lot now holding RM 130 */
      if (route === AMEND && body.kind === "Correction" && body.expect && body.expect.cash === 120 && stage === 1) {
        stage = 2;
        return { refuse: "The lot's cash moved since it was read (RM 130.00, not RM 120.00). Read the row again.", detail: { stale: true } };
      }
      /* R8: the movement refused as moved after its change went */
      if (route === AMEND && body.kind === "Fulfilment" && body.cash === 77)
        return { refuse: "This row moved since Record read it (paid RM 120.00 and 2 unit moved, not RM 100.00 and 2), so nothing was sent. Open it again.", detail: { stale: true } };
      /* R6: Correct a row's units refused as moved, the Desk naming 4 */
      if (route === AMEND && body.fields && body.fields.receivedQty === 3.6)
        return { refuse: "The lot's units received moved since it was read (4 unit, not 3). Send it again to set them from 4.", detail: { stale: true, received: 4 } };
      return undefined;
    },
    inputsAnswer: (j) => {
      if (broken) { delete j.catalog; return j; }
      j.catalog.rows = [
        ...(gone ? [] : [{ rid: "zf1", party: "SX1-ZED", product: "salt", date: D, qty: 4, total: 200, direction: "BUY", cash: cash(), movedUnits: units(), freight: 0, handover: null }]),
        { rid: "zf2", party: "CX1-ZED", product: "salt", date: D, qty: 2, total: 200, direction: "SELL", cash: 50, movedUnits: 1, delivery: 0, handover: "collected" }];
      j.catalog.correctionFields = [{ field: "total", kind: "number", required: true }, { field: "receivedQty", kind: "number" }];
      j.catalog.revivable = [];
      return j;
    } });
  const d = p.d, w = p.w, quiet = () => p.work.quiet();
  const fire = (c, type) => c.dispatchEvent(new w.Event(type, { bubbles: true }));
  const set = (c, v) => { c.value = v; fire(c, "input"); fire(c, "change"); return c; };
  let f = null;
  const A = (a) => byAct(f, a);
  const put = (act, v) => set(A(act), v);
  const amends = (from) => p.posts.slice(from).filter((x) => x.route === AMEND).map((x) => x.body);
  const pick = (rid) => set(A("record.trade.edit"), rid);
  const choose = async (rid) => { pick(rid); await quiet(); };
  const status = () => t(f.querySelector(":scope > p[role=status]"));
  try {
    await quiet();
    byAct(d, "nav.record").click(); await quiet();
    f = d.querySelector('#makerInputs section.maker-input[data-form="sale-or-purchase"]');
    const asked = []; answerSheets(w, asked, () => true);

    /* R1: the page read the lot at RM 100; a payment of RM 20 folds; opening the row reads it again */
    stage = 1;
    await choose("zf1");
    const r1 = [A("record.trade.cash").value, status()];
    ok(r1[0] === "120" && /moved since the page opened/.test(r1[1]),
      "R1: a row opened on Record is read again, and one that moved since the page opened is filled with its new figures: " + J(r1));

    /* R2: opened at RM 120, a payment of RM 10 folds before he sends Cash paid RM 150 */
    await choose(""); stage = 1; await choose("zf1");
    stage = 2;
    put("record.trade.cash", "150");
    const s0 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const stopped = [amends(s0).length, A("record.trade.cash").value, status()];
    put("record.trade.cash", "150");
    const s1 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const sent = amends(s1);
    ok(stopped[0] === 0 && stopped[1] === "130" && /moved since you opened it, so nothing was sent/.test(stopped[2])
      && sent.length === 1 && sent[0].kind === "Fulfilment" && sent[0].cash === 20 && J(sent[0].expect) === J({ cash: 130, movedUnits: 3 }),
      "R2: Record reads the row again before it sends, sends nothing on one that moved, and the next tap sends the difference from the new figure, naming it: " + J([stopped, sent]));

    /* R3: opened at RM 120, the Desk refuses a lowering to RM 90 as moved (the lot now RM 130); the row is read again and filled */
    stage = 1; await choose(""); await choose("zf1");
    put("record.trade.cash", "90");
    const s2 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const tried = amends(s2), r3 = [A("record.trade.cash").value, status()];
    ok(tried.length === 1 && J(tried[0].expect) === J({ cash: 120 }) && r3[0] === "130" && /moved since it was read/.test(r3[1]),
      "R3: a lowering the Desk refuses as moved reads the row again and fills it: " + J([tried, r3]));

    /* R4: the row cannot be read again as he sends */
    await choose(""); await choose("zf1");
    broken = true; put("record.trade.cash", "150");
    const s3 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    broken = false;
    const r4 = [amends(s3).length, status()];
    ok(r4[0] === 0 && /could not be read again, so nothing was sent/.test(r4[1]),
      "R4: a row that cannot be read again before sending sends nothing, and says so: " + J(r4));

    /* R5: the read as the row opens answers late, over what he typed, and over a send under way */
    await choose("");
    stage = 3;
    const late = p.hold(INPUTS);
    pick("zf1"); await sleep(30);
    put("record.trade.cash", "150");
    late(); await sleep(30);
    const typed = [A("record.trade.cash").value, status()];
    await quiet();
    await choose("");
    stage = 0;
    const late2 = p.hold(INPUTS);
    pick("zf1"); await sleep(30);
    const atSend = p.hold(INPUTS);
    A("record.trade.send").click(); await sleep(30);
    late2(); await sleep(30);
    const sending = status();
    atSend(); await quiet();
    ok(typed[0] === "150" && !/moved since the page opened/.test(typed[1]) && !/moved since the page opened/.test(sending),
      "R5: a late answer to the read as a row opened fills over neither what he typed nor a send under way: " + J([typed, sending]));

    /* R7: the row leaves the list (cancelled or closed) after he opened it */
    await choose(""); await choose("zf1");
    gone = true; put("record.trade.cash", "160");
    const s5 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    gone = false;
    const r7 = [amends(s5).length, status(), A("record.trade.edit").value];
    ok(r7[0] === 0 && /cancelled or closed since you opened it, so nothing was sent/.test(r7[1]) && r7[2] === "",
      "R7: a row cancelled or closed since it was opened sends nothing, and says so: " + J(r7));

    /* R8: a new price and RM 77 more paid on zf1 (RM 100): the price change goes, the movement is refused as moved */
    stage = 0; await choose(""); await choose("zf2"); await choose(""); await choose("zf1");   /* zf2 opened reads back the zf1 R7 took out of the list; New lists it */
    put("record.trade.total", "210"); put("record.trade.cash", "177");
    const s6 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const r8 = [amends(s6).map((b) => b.kind), status()];
    ok(J(r8[0]) === J(["Correction", "Fulfilment"]) && /^The change waits under Approve, but what moved was not sent: /.test(r8[1]),
      "R8: a change that went while its movement was refused as moved says the change waits and what moved was not sent: " + J(r8));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); }

  /* C1, C2, R6: Correct a row */
  try {
    const ed = [...d.querySelectorAll("#makerInputs section.maker-input")].find((x) => x.querySelector("h3") && x.querySelector("h3").textContent === "Correct a row");
    const E = (a) => byAct(ed, a);
    const sendUnits = async (v) => {
      set(E("record.amend.field"), "receivedQty"); set(E("record.amend.value"), v);
      E("record.amend.add-change").click(); await quiet();
      const from = p.posts.length;
      E("record.amend.send").click(); await quiet();
      return p.posts.slice(from).filter((x) => x.route === AMEND).map((x) => x.body);
    };
    /* C1: the shared list read back to 2 units through Record, so only Correct a row's own read brings 3 */
    stage = 0;
    set(E("record.amend.row"), ""); await quiet();
    await choose(""); await choose("zf2");
    stage = 1;
    set(E("record.amend.row"), "zf1"); await quiet();
    const c1 = await sendUnits("3.5");
    ok(c1.length === 1 && J(c1[0].expect) === J({ receivedQty: 3 }),
      "C1: Correct a row reads its row again when one is chosen, so a lot's units received go with the units it now holds: " + J(c1));

    /* C2: Record's Other fields opens Correct a row on zf1, the list back at 2 units and a receipt folded since */
    stage = 0; await choose(""); await choose("zf2");
    stage = 1;
    w.__owner("amendPick('zf1','Correction')"); await quiet();
    const c2 = await sendUnits("3.5");
    ok(c2.length === 1 && J(c2[0].expect) === J({ receivedQty: 3 }),
      "C2: Other fields opening Correct a row on a row reads it again: " + J(c2));

    /* R6: Record opens zf1 and fills it again (moved since: RM 130, 3 units); Correct a row's units are refused as moved, the Desk naming 4; a receipt
       folds (4 units); Record's send must still see its row moved */
    stage = 1; await choose(""); stage = 2; await choose("zf1");
    const opened = [A("record.trade.cash").value, A("record.trade.moved").value];
    await sendUnits("3.6");
    stage = 3;
    put("record.trade.cash", "140");
    const s4 = p.posts.length;
    A("record.trade.send").click(); await quiet();
    const r6 = [amends(s4).length, A("record.trade.moved").value, status()];
    ok(J(opened) === J(["130", "3"]) && r6[0] === 0 && r6[1] === "4" && /moved since you opened it/.test(r6[2]),
      "R6: Correct a row's refusal as moved never writes into the row Record has open, so Record's check still sees it moved: " + J([opened, r6]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
