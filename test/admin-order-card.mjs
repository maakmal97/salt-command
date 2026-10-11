/* test/admin-order-card.mjs: THE ORDER CARD (Phase 2a of the Salt Account redesign, 12 Oct 2026; docs/STATEMENTS.md "The order card").
 *
 * An order opened in Orders is a card (stmt/owner.js orderCard), and his decisions of 11 Oct 2026 shape it: 6, the card reads its own preview
 * when the order is opened and the Preview button is retired; 4, sheets replace every native confirm; 8, cash keeps its ten seconds and its Undo
 * and sends on leaving, said on the card. What is proved here, each check red under its own mutation (test/admin-order-card.mutations.json):
 *   1  the preview: read once on opening the detail, never by a row or by listing, read afresh on each opening, kept by a redraw, waited on
 *      while it is out, nothing read for a delivery with no charge chosen, no Preview button, and Accept again read on opening too
 *   2  the stage foot: the moves of the card's stage stand together at its foot, the filled one first, the answer line under them, shut while cash
 *      is held for the order, and standing along the card's foot as it scrolls
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

  /* 2. THE STAGE FOOT (Phase 2a): the moves of the card's stage at its foot */
  const closedDone = { id: "ord-c1", u: "abcd-efgh", product: "salt", qty: 1, total: 100, delivery: 0, paid: 0, msgs: [], payments: [], history: [], mode: "collect", status: "done" };
  p = await richOwnerPage({ pageWork, review: (j) => { j.orders.push({ ...closedDone }); return j; } });
  try {
    const d = p.d;
    await p.work.quiet();
    p.tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    p.cardOf = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    const part = async (name) => { byAct(d, "part.orders." + name).click(); await p.work.quiet(); };
    const foot = () => d.querySelector("#makerReview .maker-foot");
    const moves = () => foot() ? [...foot().querySelectorAll(".maker-foot__acts [data-act]")].map((e) => e.getAttribute("data-act")).filter((a) => !/[.]cancel-retained$/.test(a)) : null;
    byAct(d, "nav.orders").click(); await p.work.quiet();
    await p.tapRow("ord-p1");
    ok(same(moves(), ["order.accept", "order.decline"]) && foot().classList.contains("has") && p.cardOf("ord-p1").lastElementChild === foot(),
      "a placed order's foot holds Accept first and Decline beside it, and is the last part of the card: " + JSON.stringify(moves()));
    ok(["order.accept", "order.decline"].every((a) => [...d.querySelectorAll('#makerReview [data-act="' + a + '"]')].every((e) => foot().contains(e))),
      "and neither stands anywhere else on the card");
    await p.tapRow("ord-p2");
    ok(same(moves(), ["order.decline"]) && !!foot().classList.contains("has"), "a delivery with no charge chosen has Decline alone in its foot: " + JSON.stringify(moves()));
    byAct(d, "order.fee-10", "ord-p2").click(); await p.work.quiet();
    ok(same(moves(), ["order.accept", "order.decline"]), "and Accept joins it, first, once the charge is chosen and the figures are read: " + JSON.stringify(moves()));
    await p.tapRow("ord-p4");
    ok(same(moves(), ["order.withdraw-offer", "order.decline"]), "an order with an offer out has Withdraw the offer in its foot, with Decline, and no Accept: " + JSON.stringify(moves()));
    await part("agreed");
    await p.tapRow("ord-a1");
    ok(same(moves(), ["order.ready-collect", "order.ready-deliver", "order.cancel"]), "an agreed order's foot holds Ready to collect and Ready to deliver, and Cancel order: " + JSON.stringify(moves()));
    ok(!foot().contains(byAct(d, "order.received")) && !foot().contains(byAct(d, "order.amend")) && !foot().contains(byAct(d, "order.claim-received")),
      "while its claims, Received and Amend stay in the body of the card");
    await p.tapRow("ord-a2");
    ok(moves()[0] === "order.accept-again" && moves().includes("order.again-pay") && moves().includes("order.cancel") && !moves().includes("order.ready-collect"),
      "an order with a rejected pending row has Accept again first in its foot, with the stages he rejected offered again: " + JSON.stringify(moves()));
    await part("ready");
    await p.tapRow("ord-r1");
    ok(same(moves(), ["order.handed", "order.cancel"]) && !foot().contains(byAct(d, "order.handed-units")) && !foot().contains(byAct(d, "order.close")),
      "a ready order's foot holds Record handover and Cancel order, the units and the close staying in the body: " + JSON.stringify(moves()));
    byAct(d, "order.close", "ord-r1").click(); await p.work.quiet();
    ok(!!foot().querySelector("[data-maker-say]") && /A close is above 0/.test(foot().querySelector("[data-maker-say]").textContent) && foot().lastElementChild === foot().querySelector("[data-maker-say]"),
      "the card's answer lands in its foot, under its moves: " + (foot().querySelector("[data-maker-say]") || {}).textContent);
    /* cash held for the order shuts every control of the card, the foot's too, and Undo opens them again */
    await p.tapRow("ord-r2");
    const cash = byAct(d, "order.cash-amount", "ord-r2"); cash.value = "50"; cash.dispatchEvent(new p.w.Event("input", { bubbles: true }));
    byAct(d, "order.cash", "ord-r2").click(); await p.work.quiet();
    ok(!!byAct(d, "order.cash-undo") && !byAct(d, "order.cash-undo").disabled && [...foot().querySelectorAll("button")].every((b) => b.disabled) && foot().querySelectorAll("button").length >= 2,
      "while cash is held, every move in the foot is shut and only Undo is live");
    byAct(d, "order.cash-undo").click(); await p.work.quiet();
    ok(!byAct(d, "order.handed").disabled && !byAct(d, "order.cancel").disabled, "and Undo opens them again");
    await part("closed");
    await p.tapRow("ord-c1");
    ok(!!foot() && !foot().classList.contains("has") && moves().length === 0, "a closed order has no moves, and its foot does not stand along the card: " + JSON.stringify(moves()));
    /* the foot stands along the card's foot as the card scrolls: the page's, clear of the App bar, and from 860px the card's own */
    const rules = [];
    for (const sheetCss of p.w.document.styleSheets) for (const r of sheetCss.cssRules) {
      if (r.selectorText) rules.push(["", r.selectorText, r.style]);
      else if (r.media) for (const x of r.cssRules) if (x.selectorText) rules.push([r.media.mediaText.replace(/\s+/g, ""), x.selectorText, x.style]);
    }
    const ruleOf = (sel, media = "") => rules.filter((r) => r[0] === media && r[1] === sel).map((r) => r[2]);
    const base = ruleOf(".adm .maker-foot.has")[0], wide = ruleOf(".adm #makerReview .maker-foot.has", "(min-width:860px)")[0];
    ok(!!base && base.getPropertyValue("position") === "sticky" && /--salt-bar-h/.test(base.getPropertyValue("bottom")) && !!wide && wide.getPropertyValue("bottom") === "0px",
      "the foot of a card with moves is sticky, clear of the App bar, and from 860px sticks to the card's own foot: " + (base && base.cssText));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
