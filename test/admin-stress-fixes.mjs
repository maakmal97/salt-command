/* test/admin-stress-fixes.mjs: SALT ACCOUNT, THE STRESS RUN'S FINDINGS (13 Oct 2026, his yes: "Fix all six, one build"; the three that are Salt Account's).
 *
 * The AFTER stress run of Salt Account (341 controls, 8,909 runs, repo 1548e0d8) found, among others, a delivery charge shown as chosen after its
 * read failed, answers a screen or more from the control that caused them, and a tap target of 102 x 19. What is proved here, each check red under
 * its own mutation (test/admin-stress-fixes.mutations.json) and red on 1548e0d8:
 *   1  a delivery charge, or a time, that did not save is not shown as chosen: the radio goes back to the choice the last good read stood on, and
 *      the card's line says which did not save; the read and Accept are unchanged
 *   2  an answer stands beside the control that asked, and is brought into reach: Save on Shop's weekly hours, Make a link (and the new link), Refresh,
 *      and the order card, whose figures stand under the charge and not a screen below it, and whose answer, when its card has gone, scrolls the list's line
 * Drawn by the maker harness (test/maker-act.mjs). Every name, code and figure is invented. */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const previews = (p, id) => p.posts.filter((x) => /[/]preview$/.test(x.route) && x.route.includes("/" + id + "/"));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ROUTE = "/all/maker/orders/ord-p2/preview";
/* what stands beside a control: the next element after it and its retained-send Discard (hidden until an entry is half sent) */
const beside = (btn) => { let n = btn && btn.nextElementSibling; while (n && n.hidden) n = n.nextElementSibling; return n; };

export async function run({ ok, pageWork }) {
  const open = async (extra = {}) => {
    const p = await richOwnerPage({ pageWork, ...extra });
    await p.work.quiet();
    p.enter = async () => { byAct(p.d, "nav.orders").click(); await p.work.quiet(); };
    p.tapRow = async (id) => { const r = byAct(p.d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    p.card = (id) => [...p.d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    p.accept = () => p.d.querySelector("#makerReview [data-accept]");
    /* the preview's own line on the card: the one status that is not the foot's */
    p.line = () => { const c = p.card("ord-p2"); const l = c && [...c.querySelectorAll("[role=status]")].find((x) => !x.hasAttribute("data-maker-say")); return l ? l.textContent : ""; };
    p.fee = (v) => byAct(p.d, "order.fee-" + v, "ord-p2");
    p.fees = () => ["0", "10", "15", "other"].filter((v) => p.fee(v) && p.fee(v).checked);
    p.reread = () => p.d.querySelector('#makerReview [data-act="order.reread"]');
    return p;
  };

  /* 1. A CHARGE THAT DID NOT SAVE IS NOT SHOWN AS CHOSEN */
  let p = await open();
  try {
    await p.enter(); await p.tapRow("ord-p2");
    ok(p.fees().length === 0 && !p.accept(), "a delivery with no charge chosen starts with no radio ticked and no Accept");
    /* no read has ever stood: the read fails (no connection), and the radio is not left ticked */
    p.fail.add(ROUTE);
    p.fee("10").click(); await p.work.quiet();
    ok(p.fees().length === 0 && !p.accept() && /That charge did not save\. No charge is chosen\./.test(p.line()) && /Not sent/.test(p.line()) && !p.reread(),
      "a charge pressed when the read cannot be made goes back to none, and the card's line says it did not save and why: " + JSON.stringify([p.fees(), p.line()]));
    /* the same on a 500: wrap the page's fetch so the one route answers 500 with no words, as the Counter does when the Desk fails */
    p.fail.delete(ROUTE);
    const real = p.w.fetch; let down = true;
    p.w.fetch = async (path, init) => (down && String(path) === ROUTE ? { ok: false, status: 500, type: "basic", json: async () => ({}) } : real(path, init));
    p.fee("15").click(); await p.work.quiet();
    ok(p.fees().length === 0 && !p.accept() && /That charge did not save\. No charge is chosen\./.test(p.line()) && /could not do that/i.test(p.line()),
      "and on a 500 the same: no radio ticked, the line says it did not save: " + JSON.stringify([p.fees(), p.line()]));
    /* a read that works ticks it and offers Accept; the choice is now the one the server stood on */
    down = false;
    p.fee("10").click(); await p.work.quiet();
    ok(same(p.fees(), ["10"]) && !!p.accept() && same(previews(p, "ord-p2").slice(-1)[0].body, { total: 100, delivery: 10 }),
      "a charge whose read works stays ticked and Accept follows: " + JSON.stringify([p.fees(), previews(p, "ord-p2").map((x) => x.body)]));
    /* another charge whose read fails goes back to the one that stood, not to none, and the card offers the read again for it */
    down = true;
    p.fee("15").click(); await p.work.quiet();
    ok(same(p.fees(), ["10"]) && !p.accept() && /That charge did not save\. RM 10 is still chosen\./.test(p.line()) && !!p.reread(),
      "a charge that fails goes back to the one the last good read stood on (RM 10), with Accept away and Read the figures again offered: " + JSON.stringify([p.fees(), p.line()]));
    down = false;
    p.reread().click(); await p.work.quiet();
    const last = previews(p, "ord-p2").slice(-1)[0];
    ok(same(p.fees(), ["10"]) && !!p.accept() && same(last.body, { total: 100, delivery: 10 }) && !p.reread() && /Figures read/.test(p.line()),
      "and that read is for the charge put back (RM 10), not the one that failed, and brings Accept back: " + JSON.stringify([p.fees(), last && last.body]));
    /* the read itself is unchanged: one POST of the total and the charge, the Accept's hash is the one the read answered */
    ok(previews(p, "ord-p2").every((x) => same(Object.keys(x.body).sort(), ["delivery", "total"])), "the read still sends the total and the charge and nothing else");

    /* Other: the figure typed goes back with its radio */
    p.fee("other").click(); await p.work.quiet();
    const amount = byAct(p.d, "order.fee-other-amount", "ord-p2");
    p.type(amount, "12"); await p.work.quiet();
    ok(same(p.fees(), ["other"]) && !!p.accept() && same(previews(p, "ord-p2").slice(-1)[0].body, { total: 100, delivery: 12 }), "Other with a figure typed is read and stands: " + JSON.stringify(p.fees()));
    down = true;
    p.type(amount, "20"); await p.work.quiet();
    ok(same(p.fees(), ["other"]) && amount.value === "12" && /RM 12 is still chosen/.test(p.line()) && !amount.closest("label").hidden,
      "an Other figure that fails goes back to the figure that stood, with its radio: " + JSON.stringify([p.fees(), amount.value, p.line()]));
    p.fee("0").click(); await p.work.quiet();
    ok(same(p.fees(), ["other"]) && amount.value === "12" && /RM 12 is still chosen/.test(p.line()),
      "and a plain charge pressed over it, failing, puts Other and its figure back whole");
    down = false;

    /* the time: a window pressed and not read goes back to the one before it */
    const win = (v) => [...p.d.querySelectorAll('#makerReview input[name="makerWin-ord-p2"]')].find((r) => r.value === v);
    const wins = () => [...p.d.querySelectorAll('#makerReview input[name="makerWin-ord-p2"]')];
    const pick = wins().find((r) => r.value !== "");
    ok(!!pick && wins().filter((r) => r.checked).map((r) => r.value).join() === "", "the time starts on the customer's own, the first tile");
    p.fee("10").click(); await p.work.quiet();
    down = true;
    win(pick.value).click(); await p.work.quiet();
    ok(wins().filter((r) => r.checked).map((r) => r.value).join() === "" && /That time did not save\./.test(p.line()) && !p.accept(),
      "a time that fails goes back to the one before it, and the line says so: " + JSON.stringify([wins().filter((r) => r.checked).map((r) => r.value), p.line()]));
    down = false;
    win(pick.value).click(); await p.work.quiet();
    ok(wins().filter((r) => r.checked).map((r) => r.value).join() === pick.value && !!p.accept(), "and the same time, read, stands");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* 2. AN ANSWER STANDS BESIDE THE CONTROL THAT ASKED, AND IS BROUGHT INTO REACH */
  const hook = (pg) => { pg.scrolled = []; pg.w.HTMLElement.prototype.scrollIntoView = function () { pg.scrolled.push(this); }; };
  const at = (pg, id) => pg.d.getElementById(id);

  /* Shop's weekly hours: Save answers under Save, the shop held for now under Set it, and one line at a time */
  p = await open();
  try {
    hook(p); enter(p.d, "shop", "hours"); await p.work.quiet();
    const root = at(p, "makerSchedule"), save = () => byAct(root, "hours.save");
    save().click(); await p.work.quiet();
    let said = beside(save());
    ok(!!said && said.id === "makerHoursSaved" && said.getAttribute("role") === "status" && root.contains(said) && said.textContent === "Weekly hours saved." && at(p, "makerHoursMessage").textContent === "",
      "Save answers on a line right under itself, inside the hours, and the line below the shop-for-now controls stays empty: " + JSON.stringify([said && said.id, said && said.textContent]));
    ok(p.scrolled.includes(said), "and the answer is brought into reach");
    p.fail.add("/all/maker/hours");
    save().click(); await p.work.quiet();
    said = beside(save());
    ok(!!said && said.id === "makerHoursSaved" && /Not sent/.test(said.textContent) && at(p, "makerHoursMessage").textContent === "",
      "a Save that cannot be made says so on the same line, under Save: " + JSON.stringify(said && said.textContent));
    p.fail.delete("/all/maker/hours");
    byAct(root, "hours.override-set").click(); await p.work.quiet();
    ok(/Choose an end time/.test(at(p, "makerHoursMessage").textContent) && beside(root) === at(p, "makerHoursMessage") && at(p, "makerHoursSaved").textContent === "",
      "the shop held for now answers on its own line, right below Set it and Back, and the Save line is cleared so one answer is on screen: " + JSON.stringify([at(p, "makerHoursMessage").textContent, at(p, "makerHoursSaved").textContent]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Customers > Links: Make a link answers under its button, and the new link is brought into view */
  const NEW = { id: "new1", url: "https://example.test/g/new1", qr: "data:image/png;base64,AAAA", made: "2026-10-13T00:00:00.000Z", opens: 0, label: "A new shop", tier: 2 };
  p = await open({ linksAnswer: (j) => ({ ...j, ref: NEW }) });
  try {
    hook(p); enter(p.d, "customers", "links"); await p.work.quiet();
    const make = byAct(p.d, "link.make"), gmsg = at(p, "gmsg");
    ok(!!make && !!gmsg && beside(make) === gmsg && gmsg.getAttribute("role") === "status", "Make a link has a status line right under it");
    make.click(); await p.work.quiet();
    ok(/Name the customer whose friend/.test(gmsg.textContent) && gmsg.classList.contains("bad") && at(p, "rmsg").textContent === "",
      "with no one named it says so under the button, not on the page's one line at the foot: " + JSON.stringify([gmsg.textContent, at(p, "rmsg").textContent]));
    p.type(byAct(p.d, "link.introducer"), "abcd-efgh");
    make.click(); await p.work.quiet();
    const fresh = p.d.querySelector('#glist [data-link="new1"]');
    ok(gmsg.textContent === "Made. The QR opens it." && !gmsg.classList.contains("bad") && at(p, "rmsg").textContent === "" && !!fresh && p.scrolled.includes(fresh),
      "a link made says so under the button, and the new link, drawn among the older ones, is brought into view: " + JSON.stringify([gmsg.textContent, !!fresh, p.scrolled.length]));
    p.fail.add("/all/refs");
    p.type(byAct(p.d, "link.introducer"), "abcd-efgh");
    make.click(); await p.work.quiet();
    ok(/Not sent/.test(gmsg.textContent) && gmsg.classList.contains("bad") && at(p, "rmsg").textContent === "", "and a link that could not be made says so under the button: " + JSON.stringify(gmsg.textContent));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* Orders: Refresh answers under itself when the read fails */
  p = await open();
  try {
    hook(p); await p.enter();
    p.fail.add("/all/maker/review");
    byAct(p.d, "maker.refresh").click(); await p.work.quiet();
    const rs = at(p, "makerRefreshSaid");
    ok(!!rs && beside(byAct(p.d, "maker.refresh")) === rs && rs.getAttribute("role") === "status" && /Not sent/.test(rs.textContent) && p.scrolled.includes(rs),
      "a Refresh whose read fails says so on a line right under Refresh, in reach: " + JSON.stringify(rs && rs.textContent));
    ok(/Not sent/.test(at(p, "makerReviewStatus").textContent), "and the list's own line at the head still carries the refusal");
    p.fail.delete("/all/maker/review");
    byAct(p.d, "maker.refresh").click(); await p.work.quiet();
    ok(at(p, "makerRefreshSaid").textContent === "", "a Refresh that works leaves the line empty");
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* the order card: the figures stand under the charge, and an answer for a card that has gone is brought into reach */
  const moved = { on: false };
  p = await open({ review: (j) => { if (moved.on) j.orders.find((o) => o.id === "ord-p1").status = "acknowledged"; return j; } });
  try {
    hook(p); await p.enter();
    await p.tapRow("ord-p2");
    const card2 = p.card("ord-p2"), set = (t) => [...card2.querySelectorAll("fieldset.salt-options")].find((f) => f.querySelector("legend").textContent === t);
    const later = (a, b) => !!(a.compareDocumentPosition(b) & 4);
    const status = [...card2.querySelectorAll("[role=status]")].find((x) => !x.hasAttribute("data-maker-say")), figs = card2.querySelector(".maker-quote");
    ok(!!set("Delivery") && !!set("Delivery time") && later(set("Delivery"), status) && later(status, figs) && later(figs, set("Delivery time")),
      "on a delivery the figures' line and the figures stand under the charge and above the time, not a time's height below it");
    await p.tapRow("ord-p1");
    const card1 = p.card("ord-p1"), s1 = [...card1.querySelectorAll("[role=status]")].find((x) => !x.hasAttribute("data-maker-say"));
    ok(later(byAct(p.d, "order.total", "ord-p1"), s1) && later(s1, p.d.querySelector("#makerReview .maker-foot")), "and on a collection they stand under the price and above the foot");
    p.scrolled.length = 0;
    moved.on = true;
    p.accept().click(); await p.work.quiet();
    const list = at(p, "makerReviewStatus");
    ok(!p.card("ord-p1") && list.textContent === "Agreed and sent to the Desk." && p.scrolled.includes(list),
      "an answer whose card has gone (the order moved on) lands on the list's line and that line is brought into reach: " + JSON.stringify([list.textContent, p.scrolled.length]));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
