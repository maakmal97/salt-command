/* test/admin-order-card.mjs: THE ORDER CARD (Phase 2a of the Salt Account redesign, 12 Oct 2026; docs/STATEMENTS.md "The order card").
 *
 * An order opened in Orders is a card (stmt/owner.js orderCard), and his decisions of 11 Oct 2026 shape it: 6, the card reads its own preview
 * when the order is opened and the Preview button is retired; 4, sheets replace every native confirm; 8, cash keeps its ten seconds and its Undo
 * and sends on leaving, said on the card. What is proved here, each check red under its own mutation (test/admin-order-card.mutations.json):
 *   1  the preview: read once on opening the detail, never by a row or by listing, read afresh on each opening, kept by a redraw, waited on
 *      while it is out, nothing read for a delivery with no charge chosen, no Preview button, and Accept again read on opening too
 * Drawn by the maker harness (test/maker-act.mjs), whose hold(route) keeps an answer back until it is let go. */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const previews = (p, id) => p.posts.filter((x) => /[/]preview$/.test(x.route) && (!id || x.route.includes("/" + id + "/")));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function run({ ok, pageWork }) {
  const open = async () => {
    const p = await richOwnerPage({ pageWork });
    await p.work.quiet();
    p.enter = async () => { byAct(p.d, "nav.orders").click(); await p.work.quiet(); };
    p.tapRow = async (id) => { const r = byAct(p.d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    p.cardOf = (id) => [...p.d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    p.accept = () => p.d.querySelector("#makerReview [data-accept]");
    p.say = () => (p.d.querySelector("#makerReview .salt-insight[role=status]") || { textContent: "" }).textContent;
    return p;
  };

  /* 1. THE PREVIEW IS READ ON OPENING THE DETAIL */
  let p = await open();
  try {
    const d = p.d;
    await p.enter();
    ok(d.querySelectorAll('[data-act="order.open"]').length > 4 && previews(p).length === 0 && !p.reads.some((r) => /preview/.test(r)),
      "entering Orders and listing its rows asks the Desk for no preview: a row of the list reads nothing");
    await p.tapRow("ord-p1");
    const one = previews(p, "ord-p1");
    ok(one.length === 1 && one[0].route === "/all/maker/orders/ord-p1/preview" && same(one[0].body, { total: 200, delivery: 0 }) && !!p.accept(),
      "opening a placed order reads its preview once, at its own total, and Accept follows: " + JSON.stringify(one));
    const acts = [...d.querySelectorAll("#makerReview [data-act]")].map((e) => e.getAttribute("data-act"));
    ok(!acts.includes("order.preview") && ![...d.querySelectorAll("#makerReview button")].some((b) => /^Preview/.test(b.textContent)),
      "and the card has no Preview button");
    await p.tapRow("ord-p3");
    ok(previews(p, "ord-p3").length === 1 && previews(p, "ord-p1").length === 1 && previews(p).length === 2,
      "another order opened reads its own preview and the first is not read again: " + previews(p).map((x) => x.route).join());
    await p.tapRow("ord-p2");
    ok(previews(p, "ord-p2").length === 0 && !p.accept() && /Choose the delivery charge/.test(p.cardOf("ord-p2").textContent),
      "a delivery with no charge chosen reads nothing, says to choose one, and offers no Accept");
    await p.tapRow("ord-p1");
    ok(previews(p, "ord-p1").length === 2 && !!p.accept(), "an order opened again reads its figures afresh: " + previews(p, "ord-p1").length);
    const seen = previews(p).length;
    byAct(d, "maker.refresh").click(); await p.work.quiet();
    ok(previews(p).length === seen && !!p.accept() && p.cardOf("ord-p1") && /Figures read/.test(p.say()),
      "a redraw of the card keeps its figures and its Accept and reads nothing again: " + previews(p).length + " of " + seen);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* a read that is still out when the card is drawn again is waited on, never asked for twice */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    const release = p.hold("/all/maker/orders/ord-p3/preview");
    byAct(d, "order.open", "ord-p3").click();
    const before = p.cardOf("ord-p3");
    byAct(d, "maker.refresh").click();
    for (let i = 0; i < 400 && (!p.cardOf("ord-p3") || p.cardOf("ord-p3") === before); i++) await new Promise((r) => setTimeout(r, 5));
    const redrawn = p.cardOf("ord-p3") !== before && !!p.cardOf("ord-p3");
    release(); await p.work.quiet();
    ok(redrawn && previews(p, "ord-p3").length === 1 && !!p.accept() && p.accept().isConnected && p.cardOf("ord-p3").contains(p.accept()),
      "a card drawn again while its read is out waits on that read, asks the Desk once, and lands Accept on the card now standing: " + previews(p, "ord-p3").length);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* an agreed order whose pending row he rejected reads its Accept again on opening, with no Preview button */
  p = await open();
  try {
    const d = p.d;
    await p.enter();
    await p.tapRow("ord-a2");
    const a2 = previews(p, "ord-a2");
    ok(a2.length === 1 && same(a2[0].body, {}) && !!byAct(d, "order.accept-again", "ord-a2") && !byAct(d, "order.preview-again", "ord-a2"),
      "an order with a rejected pending row reads its preview on opening, sends nothing priced, and offers Accept again with no Preview Accept again: " + JSON.stringify(a2));
    await p.tapRow("ord-a1");
    ok(previews(p, "ord-a1").length === 0, "an agreed order with nothing rejected reads no preview");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
