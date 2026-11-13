/* test/admin-market.mjs: SALT ADMIN'S MARKET PART (11 Nov 2026, the price band's version 2; his word "Always start a stranger at +30%").
 * Shop > Market is a list of settings: the market move's Switch (asked once, sent as an edit he approves next), the day's words, a form that re-anchors a Median point
 * (a size and a price in steps of RM 5; outside the band the Desk's sentence is shown, one Reason line and Let it stand send it again with his reason), and the points he
 * has set. The Desk's Act links reach it through ADMIN_TO. Each check is red under its own mutation (test/admin-market.mutations.json):
 *   1  ADMIN_TO takes market/off, market/on and anchor/<size>/<price>, and refuses a bad one
 *   2  the part: Shop has a Market tab and a section that shows only there
 *   3  the address market/off opens the part and the question about the switch; market/on likewise
 *   4  the address anchor/<size>/<price> opens the part with the form filled and sends nothing
 *   5  the switch sends marketOff (and marketOn when off), and then says it waits under Approve
 *   6  the form sends the size and the price as an anchor
 *   7  an outside refusal shows the Desk's sentence and a Reason line; Let it stand sends the same point with the reason
 *   8  the points he has set are listed, one marked outside the band with its reason
 *   9  the catalogue carries the market, its sizes, its points and the market edits waiting
 *  10  Approve names a market edit in his words, from his figures
 *  11  a New customer's Starting % is +30% on salt, with its line, and the join link's Add them keeps it
 *  12  the links card says a guest link opens the +30% list */
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { frozenBook } from "./frozen.mjs";
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };

export async function run({ ok, pageWork }) {
  /* 1: ADMIN_TO */
  const { ADMIN_TO } = await import("../src/worker.js");
  const good = ["market/off", "market/on", "anchor/1/130", "anchor/6.25/760", "anchor/12.5/995"], bad = ["market/up", "market", "anchor/1", "anchor/x/130", "anchor/1/13.5", "anchor/1/130/9", "anchor/1.234/130", "market/off/x"];
  ok(good.every((g) => ADMIN_TO.test(g)) && bad.every((b) => !ADMIN_TO.test(b)) && ADMIN_TO.test("orders/approve"),
    "the Desk's Act road takes market/off, market/on and anchor/<size>/<price> and refuses a malformed one: " + JSON.stringify([good.filter((g) => !ADMIN_TO.test(g)), bad.filter((b) => ADMIN_TO.test(b))]));

  /* the catalogue the page is told: a mutable state, so a reload after a send reads what is waiting */
  const state = { market: { day: "2026-11-20", k: 0.05, on: true, why: "Median +5: 4.2 days of cover, moving 5 a day towards +15." }, marketSizes: [0.5, 1, 6.25, 12.5], marketPoints: [], marketWaiting: [] };
  const open = async (o = {}) => {
    const p = await richOwnerPage({ pageWork, ...o, inputsAnswer: (j) => { Object.assign(j.catalog, JSON.parse(JSON.stringify(state))); return j; } });
    await p.work.quiet(); return p;
  };
  const editPosts = (p) => p.posts.filter((x) => x.route === "/all/maker/inputs/edit").map((x) => x.body);
  const inMarket = (p) => shown(p.d.getElementById("makerMarket")) && [...p.d.querySelectorAll('.aparts[data-place="shop"] button[aria-selected="true"]')].map((b) => b.getAttribute("data-part")).join() === "market";
  const sheet = (p) => p.d.getElementById("ynSheet");
  const yes = async (p) => { const go = p.d.getElementById("ynGo"); if (go) go.click(); await p.work.quiet(); };

  /* 2: the part */
  {
    const p = await open();
    const tabs = [...p.d.querySelectorAll('.aparts[data-place="shop"] button[data-part]')].map((b) => b.getAttribute("data-part") + ":" + b.firstChild.textContent);
    const tab = p.d.querySelector('[data-act="part.shop.market"]');   /* a missing tab is a red check, never a crash */
    if (tab) { enter(p.d, "shop", "market"); await p.work.quiet(); }
    const sec = p.d.getElementById("makerMarket"), other = p.d.getElementById("makerBulletin");
    const here = shown(sec), notHere = !shown(other);
    enter(p.d, "shop", "notice"); await p.work.quiet();
    ok(!!tab && tabs.join() === "hours:Hours,market:Market,calendar:Calendar,notice:Notice,practice:Practice,device:This device" && here && notHere && !shown(sec),
      "Shop has a Market tab beside Hours and Notice, and its section shows in that part alone: " + tabs.join());
  }

  /* 3: the address of the switch */
  for (const [hash, kind, on] of [["#market/off", "marketOff", true], ["#market/on", "marketOn", false]]) {
    state.market.on = on; state.marketWaiting = [];
    const p = await open({ hash });
    const asked = sheet(p) && /Switch the market move (off|on)/.test(sheet(p).textContent);
    await yes(p);
    const b = editPosts(p)[0];
    ok(inMarket(p) && asked && editPosts(p).length === 1 && b.kind === kind && b.product === "salt" && /^\d{4}-\d\d-\d\dT/.test(b.at),
      hash + " opens Shop > Market and asks once about the switch, and its yes sends " + kind + ": " + JSON.stringify(b));
  }
  state.market.on = true;

  /* 4: the address of a point */
  {
    const p = await open({ hash: "#anchor/6.25/760" });
    const sel = byAct(p.d, "market.size"), price = byAct(p.d, "market.price");
    ok(inMarket(p) && sel && price && sel.value === "6.25" && price.value === "760" && editPosts(p).length === 0 && !sheet(p),
      "anchor/6.25/760 opens the form with the size and the price filled and sends nothing: " + (sel && sel.value) + " " + (price && price.value));
  }

  /* 5: the switch */
  {
    const p = await open();
    enter(p.d, "shop", "market"); await p.work.quiet();
    const sw = byAct(p.d, "market.switch");
    const on0 = sw.getAttribute("aria-checked");
    sw.click(); await p.work.quiet();
    ok(sheet(p) && editPosts(p).length === 0, "a tap on the switch asks first and sends nothing");
    state.marketWaiting = [{ kind: "marketOff" }];
    await yes(p);
    const today = p.d.querySelector("[data-market-today]");
    ok(on0 === "true" && editPosts(p).length === 1 && editPosts(p)[0].kind === "marketOff" && /Waiting under Approve/.test(today.textContent) && byAct(p.d, "market.switch").disabled,
      "its yes sends marketOff and the row then says it waits under Approve, the switch held: " + today.textContent);
    state.marketWaiting = [];
  }

  /* 6: the form */
  {
    const p = await open();
    enter(p.d, "shop", "market"); await p.work.quiet();
    p.type(byAct(p.d, "market.size"), "1"); p.type(byAct(p.d, "market.price"), "130");
    await p.click(byAct(p.d, "market.send"));
    const b = editPosts(p)[0];
    ok(editPosts(p).length === 1 && b.kind === "anchor" && b.product === "salt" && b.q === 1 && b.price === 130 && b.why === undefined,
      "the form sends the size and the price as an anchor, with no reason: " + JSON.stringify(b));
    p.type(byAct(p.d, "market.price"), "132");
    await p.click(byAct(p.d, "market.send"));
    ok(editPosts(p).length === 1 && /steps of RM 5/.test(p.d.getElementById("makerMarket").textContent), "a price off the RM 5 steps is stopped on the page, nothing sent");
  }

  /* 7: outside the band */
  {
    const say = "RM 20 under the Floor of RM 60 at 1 unit: every stranger would be quoted under cost. Give a reason and it stands, marked on Pricing.";
    const p = await open({ extra: (route, body) => route === "/all/maker/inputs/edit" && body && body.kind === "anchor" && body.why === undefined ? { refuse: say, detail: { outside: { side: "under", by: 20, floor: 60, ceiling: 180 } } } : undefined });
    enter(p.d, "shop", "market"); await p.work.quiet();
    p.type(byAct(p.d, "market.size"), "1"); p.type(byAct(p.d, "market.price"), "40");
    await p.click(byAct(p.d, "market.send"));
    const why = byAct(p.d, "market.why"), stand = byAct(p.d, "market.stand");
    ok(why && stand && p.d.getElementById("makerMarket").textContent.includes(say) && stand.disabled && stand.textContent === "Let it stand" && byAct(p.d, "market.price").value === "40",
      "an outside refusal shows the Desk's sentence, one Reason line and Let it stand, held until there is a reason, the figures kept: " + JSON.stringify([!!why, !!stand, p.d.getElementById("makerMarket").textContent.slice(-300), stand && stand.disabled, stand && stand.textContent]));
    p.type(why, "clearance day"); await p.work.quiet();
    ok(!byAct(p.d, "market.stand").disabled, "a reason of three characters or more lets it go");
    await p.click(byAct(p.d, "market.stand"));
    const sent = editPosts(p);
    ok(sent.length === 2 && sent[1].q === 1 && sent[1].price === 40 && sent[1].why === "clearance day" && sent[1].kind === "anchor",
      "Let it stand sends the same point again with his reason: " + JSON.stringify(sent[1]));
  }

  /* 8: the points he has set */
  {
    state.marketPoints = [{ q: 1, price: 130, from: "2026-11-12" }, { q: 6.25, price: 40, from: "2026-11-13", outside: { side: "under", why: "clearance day" } }];
    const p = await open();
    enter(p.d, "shop", "market"); await p.work.quiet();
    const rows = [...p.d.querySelectorAll("[data-market-point]")].map((r) => r.textContent);
    ok(rows.length === 2 && /1 unit, RM 130\.00, from 2026-11-12$/.test(rows[0]) && /6\.25 units, RM 40\.00, from 2026-11-13\. Outside the band: clearance day/.test(rows[1]),
      "the points he has set are listed with their size, price and day, the outside one with its reason: " + JSON.stringify(rows));
    state.marketPoints = [];
  }

  /* 9: the catalogue */
  {
    const { frozenBook: fb } = { frozenBook };
    const { pricingFromBook } = await import("../engine/book-inputs.mjs");
    const MI = await import("../src/maker-inputs.js");
    const pricing = pricingFromBook(fb(), new Date("2026-11-20T04:00:00Z"));
    const anchors = [{ q: 1, x: 2.2, price: 130, from: "2026-11-12", at: "a" }, { q: 6.25, x: 0.8, price: 40, from: "2026-11-13", at: "b", outside: { side: "under", why: "clearance day" } }];
    const desk = { state: { roster: [], associates: [], MARKET: { salt: { anchors } } }, pricing, ledger: [], version: "v1502" };
    const waiting = [{ at: "2026-11-20T03:00:00.000Z", payload: { mode: "edit", kind: "anchor", product: "salt", q: 1, price: 135 } }, { at: "2026-11-20T03:01:00.000Z", payload: { mode: "edit", party: "ZZ1-AAA", since: "2031-01-01", amount: 40, kind: "refundPaid" } }];
    const cat = MI.makerInputCatalog(desk, {}, waiting, []);
    const mk = cat.market;
    ok(mk && typeof mk.day === "string" && typeof mk.k === "number" && typeof mk.on === "boolean" && typeof mk.why === "string" && mk.why.length > 0
      && Array.isArray(cat.marketSizes) && cat.marketSizes.includes(1) && cat.marketSizes.includes(12.5) && Math.max(...cat.marketSizes) === 12.5
      && cat.marketPoints.length === 2 && cat.marketPoints[0].price === 130 && (cat.marketPoints[1].outside || {}).why === "clearance day"
      && cat.marketWaiting.length === 1 && cat.marketWaiting[0].kind === "anchor" && cat.marketWaiting[0].price === 135 && Array.isArray(cat.editWaiting) && Array.isArray(cat.openRefunds),
    "the catalogue carries the market (day, move, on, why), the sizes up to 12.5, the points he set with their reasons and only the market edits waiting: " + JSON.stringify([mk, cat.marketSizes, cat.marketWaiting]));
    const none = MI.makerInputCatalog({ ...desk, state: { roster: [], associates: [] } }, {}, [], []);
    ok(Array.isArray(none.marketPoints) && none.marketPoints.length === 0 && none.marketWaiting.length === 0, "a book with no MARKET document and nothing waiting says none");
  }

  /* 10: Approve */
  {
    const mkDraft = (payload, id) => ({ id, status: "pending", collection: "edit", row: { kind: payload.kind, product: "salt" }, flags: ["The Median at 1 unit goes from RM 120 to RM 130; every size between its neighbouring points moves with it, and every customer's price rides on it.", "Outside the band: RM 20 under the Floor, his reason: clearance day. It shows on Pricing every day until he changes it."],
      reasoning: "Re-anchors the salt Median at 1 unit.", entry: { at: id, type: "EDIT", party: null, qty: null, total: null, status: "edit", payload: { mode: "edit", product: "salt", ...payload } } });
    const p = await richOwnerPage({ pageWork, review: (j) => { j.drafts = [mkDraft({ kind: "marketOff" }, "2026-11-20T03:00:00.000Z"), mkDraft({ kind: "marketOn" }, "2026-11-20T03:01:00.000Z"), mkDraft({ kind: "anchor", q: 1, price: 130 }, "2026-11-20T03:02:00.000Z")]; return j; } });
    await p.work.quiet();
    enter(p.d, "orders"); p.d.querySelector('[data-act="bar.approve"]').click(); await p.work.quiet();
    const text = [...p.d.querySelectorAll(".apcard")].map((c) => c.querySelector(".apverb").textContent + "|" + c.querySelector(".salt-approve__party").textContent.trim());
    const flags = [...p.d.querySelectorAll(".apcard .apflag")].map((f) => f.textContent);
    ok(text.length === 3 && text[0].startsWith("Market move off|Median Price") && text[1].startsWith("Market move on|") && text[2] === "Median point, 1 unit, RM 130.00|Median Price" && flags.some((f) => /Median at 1 unit goes from RM 120 to RM 130/.test(f)) && flags.some((f) => /Outside the band/.test(f)),
      "Approve names a market edit in his words, from the figures he sent, with the drafter's two flags: " + JSON.stringify([text, flags.slice(0, 2)]));
  }

  /* 11: a new customer starts at +30% */
  {
    const p = await richOwnerPage({ pageWork, inputsAnswer: (j) => { j.catalog.products = [{ product: "salt", drift: true, driftMin: -100, driftMax: 100, driftPresets: [{ name: "Median Price", value: 0 }, { name: "+20%", value: 0.2 }, { name: "+30%", value: 0.3 }] }]; return j; } });
    await p.work.quiet();
    enter(p.d, "record", "customers"); await p.work.quiet();
    const radio = (v) => p.d.querySelector('input[data-act="record.add-id.drift"][value="' + v + '"]');
    const line = p.d.querySelector(".ostart30");
    p.d.querySelector('input[data-act="record.add-id.drift"][value="0"]').click();
    const chosen = p.d.querySelector('input[data-act="record.add-id.drift"]:checked').value;
    ok(radio("0.3") && line && line.textContent === "Starts at +30%." && chosen === "0", "the Starting % is +30% unless he picks another, with the line 'Starts at +30%.', and the Median Price stays his to choose");
    const q = await richOwnerPage({ pageWork, inputsAnswer: (j) => { j.catalog.products = [{ product: "salt", drift: true, driftMin: -100, driftMax: 100, driftPresets: [{ name: "Median Price", value: 0 }, { name: "+30%", value: 0.3 }] }]; return j; } });
    await q.work.quiet(); enter(q.d, "record", "customers"); await q.work.quiet();
    ok(q.d.querySelector('input[data-act="record.add-id.drift"]:checked').value === "0.3", "the form opens on +30%: " + q.d.querySelector('input[data-act="record.add-id.drift"]:checked').value);
    /* the join link's Add them keeping +30% is drawn in test/order-stream-v7-ui.mjs (U4c), where a sealed join is opened */
  }

  /* 12: the links card, as drawn */
  {
    const p = await open();
    enter(p.d, "customers", "links"); await p.work.quiet();
    const lead = p.d.querySelector("#oLinks .lead");
    ok(shown(lead) && lead.textContent === "A guest link opens the +30% list for everybody; naming whose friend it is stays your note.",
      "the links card says a guest link opens the +30% list for everybody: " + (lead && lead.textContent));
  }
}
