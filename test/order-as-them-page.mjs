/* test/order-as-them-page.mjs: v1377, ORDER AS THEM ON THE PAGE (his answers A and D of 02 Nov 2026, plan parts 1b and 1c). Salt Admin's
 * Order for them opens the customer's own page by the master, as View as them does, with ordering live: Orders says he is ordering for
 * them and offers New order; the sheet has no note and no Negotiate; Place goes to /all/maker/customers/<u>/orders with their list's own
 * total and stamp, never to their /orders; Pay stays off. View as them stays read only. The old box of his own is gone. Every username
 * and figure is invented. */
import { startAt } from "./counter-b-kit.mjs";
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";
import * as C from "../tools/stmt-crypto.mjs";

const U1 = "abcd-efgh";

export async function run({ ok, pageWork }) {
  const placed = { id: "20261102120000-oath", u: U1, at: "2026-11-02T04:00:00.000Z", status: "placed", product: "salt", qty: 1, mode: "collect", total: 100,
    unit: 100, paid: 0, payments: [], moved: 0, history: [{ at: "2026-11-02T04:00:00.000Z", status: "placed", by: "desk" }], msgs: [] };
  /* their account as /open answers his master: the statement, their sealed list and the master's wrap */
  const ck = await C.contentKey("order-as-them-secret", U1);
  const list = { at: "2026-11-02T00:00:00.000Z", week: { monday: "2026-10-27", label: "This week" }, soon: [], digest: "as-them-list",
    products: [{ product: "salt", unit: "unit", basis: "tier", sizes: [{ q: 1, price: 100 }, { q: 5, price: 450 }] }] };
  const opened = { ok: true, byMaster: true, session: "", assoc: false, card: null, wrapMaster: await C.wrapKey("fixture-master", ck),
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-11-01", label: "November", body: "<p>Statement</p>" }] })),
    prices: Object.assign({ at: list.at, week: list.week.monday, digest: list.digest }, await C.encryptWith(ck, JSON.stringify(list))) };
  let refuseOpen = 0, agreed = { accepted: true };
  const extra = (route) => route === "/open" && refuseOpen > 0 ? (refuseOpen--, { refuse: "Busy, try again." }) : route === "/open" ? opened
    : route === "/all/maker/slip/key" ? { ok: true, key: { kty: "EC", crv: "P-256", x: "eA", y: "eQ" } }
    : route === "/all/maker/inputs" ? { ok: true, catalog: { parties: ["CA5-SEN", "CS6-BS-R", "CB1-XY"] } }
    : route === "/all/maker/geo/search" ? { ok: true, places: [{ name: "Taman Ulvar", where: "Cheras", lat: 3.0811, lng: 101.7402 }] }
    : route === "/all/maker/customers/" + U1 + "/orders" ? { ok: true, order: placed, agreed }
    : route === "/all/orders/" + U1 ? { ok: true, orders: [placed], claims: [], links: [], max: 0 } : undefined;
  const openAs = async (p, act) => {
    enter(p.d, "customers", "accounts"); await p.work.quiet();
    byAct(p.d, "acct.open", U1).click(); await p.work.quiet();
    byAct(p.d.getElementById("aopen"), act).click(); await p.work.quiet();
    const tab = p.d.querySelector('[data-t="order"]'); if (tab) { tab.click(); await p.work.quiet(); }
  };
  const lead = (p) => [...p.d.querySelectorAll("#pOrder .lead")].map((n) => n.textContent).join(" | ");

  /* B1 to B4: Order for them */
  let p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    const nb = p.d.getElementById("oNew");
    ok(/Placed for you/.test(p.d.getElementById("pOrder").textContent),
      "B6 an order he placed says Placed for you on its card, on their own page");
    ok(!!nb && /ordering for them/.test(lead(p)) && !p.d.getElementById("makerFor"),
      "B1 Order for them opens their own page with New order and says he is ordering for them; the old box is gone: " + JSON.stringify([!!nb, lead(p)]));
    await startAt(p.d); await p.work.quiet();   /* plan version 8: New order lands on Order; the sheet opens at a size tapped there */
    ok(!p.d.getElementById("oAddNote") && !p.d.getElementById("oSay"), "B2 the sheet has no note on Order as them");
    const way = p.d.querySelector("[data-k='mode:1']");
    if (way) { way.click(); await p.work.quiet(); }
    const slips = p.wire.map((x) => x.split(" ")[0]).filter((r) => /slip/.test(r));
    ok(slips.includes("/all/maker/slip/key") && !slips.includes("/slip/key") && !!p.d.querySelector(".opin") && !p.d.getElementById("spAdd"),
      "B8 on Deliver the exact spot is offered, its key read through his route, and no saved spot of theirs is read or kept on his device: " + JSON.stringify([slips, !!p.d.querySelector(".opin")]));
    const back = p.d.querySelector("[data-k='mode:0']");
    if (back) { back.click(); await p.work.quiet(); }
    const go = p.d.getElementById("oGo");
    go.click(); await p.work.quiet();
    ok(!p.d.getElementById("oAskGo") && !!p.d.getElementById("oPlace"), "B3 the check offers Place and no Negotiate");
    const before = p.posts.length;
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const sent = p.posts.slice(before);
    const mine = sent.filter((x) => x.route === "/all/maker/customers/" + U1 + "/orders"), theirs = sent.filter((x) => x.route === "/orders");
    const b = mine[0] && mine[0].body;
    ok(mine.length === 1 && !theirs.length && !!b && !("note" in b) && b.digest === "as-them-list" && b.product === "salt" && b.total > 0 && /^[A-Za-z0-9_-]{16,}$/.test(b.rid || ""),
      "B4 Place goes through his route with their list's total and stamp and no note, never their /orders: " + JSON.stringify(sent.map((x) => [x.route, x.body])));
    const said = p.d.getElementById("oActSaid");
    ok(!!said && said.textContent === "Agreed for them at the price shown.", "B10 v2: Sent says his Place was agreed for them: " + (said && said.textContent));
  } catch (e) { ok(false, "Order as them stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B11 (3 Nov 2026, his report of a delivery that would not go): on Order as them a delivery with an area typed reaches Review and Place,
     since his sheet draws no saved spot of theirs to pick; the order goes as a delivery to that area */
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    /* B12 (4 Nov 2026, his report that the order of taps seemed to matter): a browser puts an emptied body back at its top, which jsdom does not,
       so the body here is given a scroll position that emptying resets; a choice keeps the sheet where it was, and a new step starts at its top */
    const sb = p.d.querySelector("#osheet .salt-sheet__body"), tc = Object.getOwnPropertyDescriptor(p.w.Node.prototype, "textContent");
    let y = 0;
    Object.defineProperty(sb, "scrollTop", { configurable: true, get: () => y, set: (v) => { y = Math.max(0, +v || 0); } });
    Object.defineProperty(sb, "textContent", { configurable: true, get() { return tc.get.call(this); }, set(v) { y = 0; tc.set.call(this, v); } });
    sb.scrollTop = 300;
    p.d.querySelector("[data-k='mode:1']").click(); await p.work.quiet();
    ok(sb.scrollTop === 300, "B12 a choice tapped on the sheet keeps it where it was scrolled, never back at its top: " + sb.scrollTop);
    const wi = p.d.getElementById("oWhere");
    wi.value = "Orlen"; wi.dispatchEvent(new p.w.Event("input", { bubbles: true })); await p.work.quiet();
    const go = p.d.getElementById("oGo"), foot = p.d.querySelector("#osheet .ototal");
    ok(!!go && !go.disabled && !/Pick where it is going/.test(foot ? foot.textContent : ""),
      "B11 a delivery with an area typed reaches Review on Order as them: " + JSON.stringify([!!go && go.disabled, foot && foot.textContent]));
    sb.scrollTop = 300;
    go.click(); await p.work.quiet();
    ok(sb.scrollTop === 0, "B12 and Review's check, a new step, opens at its top: " + sb.scrollTop);
    const before = p.posts.length;
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const b = (p.posts.slice(before).find((x) => x.route === "/all/maker/customers/" + U1 + "/orders") || {}).body;
    ok(!!b && b.mode === "deliver" && b.place === "Orlen", "B11 and Place sends it as a delivery to that area: " + JSON.stringify(b));
  } catch (e) { ok(false, "Order as them's delivery stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B13 (4 Nov 2026, one convention on every surface): on Order as them their spot's place search goes through his own road, never theirs */
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    p.d.querySelector("[data-k='mode:1']").click(); await p.work.quiet();
    const pu = p.d.getElementById("oPinUrl");
    if (pu) { pu.value = "Taman Ulv"; pu.dispatchEvent(new p.w.Event("input", { bubbles: true })); }
    let hit = null;
    /* the harness holds the page's timers: the search's pause (350 ms) is run by hand, as Shop's points' check does */
    await p.work.quiet(); p.timers.filter((x) => x.ms === 350 && !x.off).forEach((x) => { x.off = true; x.f(); }); await p.work.quiet();
    hit = p.d.querySelector("#osheet [data-k='pinhit:0']");
    if (hit) { hit.click(); await p.work.quiet(); }
    const routes = p.posts.map((x) => x.route);
    ok(!!pu && !!hit && routes.includes("/all/maker/geo/search") && !routes.includes("/place/search") && !!p.d.getElementById("oPinOff"),
      "B13 their spot's place search on Order as them asks his own road and a place found becomes the spot: " + JSON.stringify([routes, !!pu, !!hit]));
  } catch (e) { ok(false, "Order as them's place search stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B5: View as them stays read only */
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.view-as");
    ok(!p.d.getElementById("oNew") && /Read only/.test(lead(p)), "B5 View as them stays read only: no New order, the read-only line: " + lead(p));
  } catch (e) { ok(false, "View as them stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B9: an Order for them whose open was refused leaves nothing behind: an account then opened at the door is read only */
  p = await richOwnerPage({ pageWork, extra });
  try {
    refuseOpen = 1;
    enter(p.d, "customers", "accounts"); await p.work.quiet();
    byAct(p.d, "acct.open", U1).click(); await p.work.quiet();
    byAct(p.d.getElementById("aopen"), "acct.order-for").click(); await p.work.quiet();
    const f = p.d.getElementById("f"), un = p.d.getElementById("un"), pw = p.d.getElementById("pw");
    un.value = U1; pw.value = "fixture-master";
    f.dispatchEvent(new p.w.Event("submit", { bubbles: true, cancelable: true })); await p.work.quiet();
    ok(!p.d.getElementById("oNew") && /Read only/.test(lead(p)), "B9 a refused Order for them leaves no ordering for the next open at the door: " + lead(p));
  } catch (e) { ok(false, "the refused open stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B13 to B15, plan version 3: Handed over and paid now on his sheet */
  agreed = { accepted: true, handed: true, paid: true };
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    const sw = p.d.getElementById("oNow");
    ok(!!sw && sw.getAttribute("role") === "switch" && sw.getAttribute("aria-checked") === "false" && p.d.getElementById("oNowH").textContent === "Handed over and paid now",
      "B13 his sheet offers Handed over and paid now as a switch, off until he turns it on: " + (sw && sw.outerHTML));
    sw.click(); await p.work.quiet();
    const on = p.d.getElementById("oNow");
    p.d.querySelector("[data-k='mode:1']").click(); await p.work.quiet();
    const onDeliver = p.d.getElementById("oNow");
    p.d.querySelector("[data-k='mode:0']").click(); await p.work.quiet();
    ok(on && on.getAttribute("aria-checked") === "true" && !onDeliver, "B14 it turns on, and a delivery offers none: " + [on && on.getAttribute("aria-checked"), !!onDeliver]);
    p.d.getElementById("oGo").click(); await p.work.quiet();
    const sheetBox = p.d.querySelector('[aria-labelledby="oshT"]'), told = !!sheetBox && /Handed over and paid as soon as it is placed\./.test(sheetBox.textContent);
    const before = p.posts.length;
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const b = (p.posts.slice(before).find((x) => x.route === "/all/maker/customers/" + U1 + "/orders") || {}).body;
    const said = p.d.getElementById("oActSaid");
    ok(told && b && b.now === true && !!said && said.textContent === "Agreed, paid and handed over.",
      "B15 the check says it before Place, Place carries now, and Sent says agreed, paid and handed over: " + JSON.stringify([told, b && b.now, said && said.textContent]));
  } catch (e) { ok(false, "handed and paid now stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B16: agreed but not handed over says the Desk's reason */
  agreed = { accepted: true, handed: false, why: "a payment they say they sent waits on this order." };
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    p.d.getElementById("oNow").click(); await p.work.quiet();
    p.d.getElementById("oGo").click(); await p.work.quiet();
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const said = p.d.getElementById("oActSaid");
    ok(!!said && said.textContent === "Agreed for them, not yet paid and handed over: a payment they say they sent waits on this order.",
      "B16 agreed but not paid and handed over says the Desk's reason on Sent: " + (said && said.textContent));
  } catch (e) { ok(false, "the unhanded Place stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B17: paid but not handed over says so; B18: the switch is asked afresh on every sheet */
  agreed = { accepted: true, handed: false, paid: true, why: "the Desk did not answer in time." };
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    p.d.getElementById("oNow").click(); await p.work.quiet();
    p.d.querySelector("[data-k='close']").click(); await p.work.quiet();
    await startAt(p.d); await p.work.quiet();
    const fresh = p.d.getElementById("oNow");
    ok(!!fresh && fresh.getAttribute("aria-checked") === "false", "B18 a sheet closed with the switch on opens again with it off: " + (fresh && fresh.getAttribute("aria-checked")));
    fresh.click(); await p.work.quiet();
    p.d.getElementById("oGo").click(); await p.work.quiet();
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const said = p.d.getElementById("oActSaid");
    ok(!!said && said.textContent === "Agreed and paid, not yet handed over: the Desk did not answer in time.", "B17 paid but not handed over says so on Sent: " + (said && said.textContent));
  } catch (e) { ok(false, "the paid Place stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B12 v2: agreed paid in advance says so on Sent */
  agreed = { accepted: true, prepay: true };
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    p.d.getElementById("oGo").click(); await p.work.quiet();
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const said = p.d.getElementById("oActSaid");
    ok(!!said && said.textContent === "Agreed for them at the price shown, to be paid before handover.", "B12 v2: agreed paid in advance says so on Sent: " + (said && said.textContent));
  } catch (e) { ok(false, "the prepay Place stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B11 v2: a Place that was not agreed says why on Sent */
  agreed = { accepted: false, why: "Set its delivery charge under Orders to agree it." };
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    p.d.getElementById("oGo").click(); await p.work.quiet();
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const said = p.d.getElementById("oActSaid");
    ok(!!said && said.textContent === "Placed for them, not yet agreed: Set its delivery charge under Orders to agree it.",
      "B11 v2: a Place not agreed says so on Sent, with the Desk's reason: " + (said && said.textContent));
  } catch (e) { ok(false, "the waiting Place stopped on an error: " + (e && e.stack)); } finally { p.w.close(); agreed = { accepted: true }; }

  /* B7: Salt Admin's Orders row of an order he placed, still placed, says You placed */
  p = await richOwnerPage({ pageWork, extra, review: (j) => Object.assign({}, j, { orders: j.orders.concat([placed]) }) });
  try {
    enter(p.d, "orders", "todo"); await p.work.quiet();
    ok(/You placed/.test(p.d.getElementById("oSplit").textContent), "B7 his Orders row of an order he placed says You placed");
  } catch (e) { ok(false, "his Orders stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* B19 to B22, plan version 4: the day of the sale under Handed over and paid now, and their customer on an associate's order for a friend */
  const klNow = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
  const yday = (() => { const d = new Date(klNow + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
  const floorDay = (() => { const d = new Date(klNow + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 30); const b = d.toISOString().slice(0, 10); return b > "2026-10-21" ? b : "2026-10-21"; })();
  agreed = { accepted: true, handed: true, paid: true };
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    const off = p.d.getElementById("oOn");
    p.d.getElementById("oNow").click(); await p.work.quiet();
    const day = p.d.getElementById("oOn");
    ok(!off && !!day && day.type === "date" && day.value === klNow && day.max === klNow && day.min === floorDay && /Day of the sale/.test(p.d.querySelector('label[for="oOn"]').textContent),
      "B19 the day of the sale is asked only with Handed over and paid now on: today by default, back 30 days and to 21 Oct 2026 at most: " + JSON.stringify([!!off, day && [day.value, day.min, day.max]]));
    day.value = yday; day.dispatchEvent(new p.w.Event("change")); await p.work.quiet();
    p.d.getElementById("oGo").click(); await p.work.quiet();
    const sheetBox = p.d.querySelector('[aria-labelledby="oshT"]'), said = !!sheetBox && /Day of the sale/.test(sheetBox.textContent);
    const before = p.posts.length;
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const b = (p.posts.slice(before).find((x) => x.route === "/all/maker/customers/" + U1 + "/orders") || {}).body;
    ok(said && b && b.now === true && b.on === yday, "B20 a day back is said on the check and Place carries it with now: " + JSON.stringify([said, b && b.now, b && b.on]));
  } catch (e) { ok(false, "the day of the sale stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    p.d.getElementById("oNow").click(); await p.work.quiet();
    p.d.getElementById("oGo").click(); await p.work.quiet();
    const before = p.posts.length;
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const b = (p.posts.slice(before).find((x) => x.route === "/all/maker/customers/" + U1 + "/orders") || {}).body;
    ok(b && b.now === true && b.on === undefined, "B21 today, left as it is, sends no day: the sale is dated as it is agreed: " + JSON.stringify(b));
  } catch (e) { ok(false, "today's sale stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
  opened.assoc = true;
  p = await richOwnerPage({ pageWork, extra });
  try {
    await openAs(p, "acct.order-for");
    await startAt(p.d); await p.work.quiet();
    p.d.querySelector('#osheet button[data-k="for:0"]').click(); await p.work.quiet();
    const mine = p.d.getElementById("oBuyer");
    p.d.querySelector('#osheet button[data-k="for:1"]').click(); await p.work.quiet();
    const sel = p.d.getElementById("oBuyer"), opts = sel ? [...sel.options].map((x) => x.value) : [];
    ok(!mine && !!sel && JSON.stringify(opts) === JSON.stringify(["", "CA5-SEN", "CB1-XY"]) && sel.options[0].textContent === "Not named",
      "B22 on an associate's order for a friend he names their customer from the roster, the resale accounts left out, or Not named; for themselves none is asked: " + JSON.stringify([!!mine, opts]));
    sel.value = "CB1-XY"; sel.dispatchEvent(new p.w.Event("change")); await p.work.quiet();
    p.d.getElementById("oGo").click(); await p.work.quiet();
    const sheetBox = p.d.querySelector('[aria-labelledby="oshT"]'), said = !!sheetBox && /Their customer\s*CB1-XY/.test(sheetBox.textContent);
    const before = p.posts.length;
    p.d.getElementById("oPlace").click(); await p.work.quiet();
    const b = (p.posts.slice(before).find((x) => x.route === "/all/maker/customers/" + U1 + "/orders") || {}).body;
    ok(said && b && b.forFriend === true && b.buyer === "CB1-XY", "B23 their customer is said on the check and Place carries it: " + JSON.stringify([said, b && b.forFriend, b && b.buyer]));
  } catch (e) { ok(false, "their customer stopped on an error: " + (e && e.stack)); } finally { p.w.close(); opened.assoc = false; }
}
