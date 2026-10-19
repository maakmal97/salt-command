/* test/test-surface-fixture.mjs: P2 of the Counter test surface (his answers of 18 Oct 2026). One list of test users, and the
   third account, 0000-0002, fresh.
   1. the publish's fixture for 0000-0002 holds two open orders and room for three: three placements by the order book's own
      decidePlace go in, and the fourth is refused at the limit;
   2. it holds a cancelled and a declined order, three handed over in full (one at a size the list no longer carries), a group
      order open to join, and no claim waiting, so no gate stands;
   3. the order book takes 0000-0002 on both fixture ops and refuses a real username on each;
   4. Salt Account offers Make for each of the three: with two made it makes the third alone, with none all three;
   5. missing() is empty: every feature line still has its case, the fresh account's own line among them. */
import { JSDOM, VirtualConsole } from "jsdom";
import { webcrypto } from "node:crypto";
import * as TF from "../tools/testfix.mjs";
import * as O from "../stmt/orders.js";
import { TEST_USERS, TESTS } from "../stmt/testusers.js";
import { landingPage } from "../stmt/page.js";
import { priceSteps } from "../tools/pricelist.mjs";
import { orderBook } from "./orderbook-harness.mjs";
import { byAct } from "./maker-act.mjs";

export async function run({ ok, pageWork }) {
  const now = new Date(), all = TF.buildAll(now), f = all["0000-0002"];
  ok(JSON.stringify(TEST_USERS) === JSON.stringify(["0000-0000", "0000-0001", "0000-0002"]) && TESTS["0000-0002"] === "fresh" && f && f.state === "fresh",
    "One list names the three test accounts, the third fresh, and the publish builds its fixture: " + JSON.stringify(TEST_USERS));

  /* 1. room for three, by the order book's own rules */
  let open = f.orders.filter((o) => O.OPEN_STATES.includes(o.status));
  const placed = [];
  for (let i = 0; i < 4; i++) {
    const total = f.prices.products.find((p) => p.product === "rice").sizes[0].price;
    const d = O.decidePlace("0000-0002", { product: "rice", qty: 1, mode: "collect", total, unit: total, week: f.prices.week.monday, digest: f.prices.digest,
      place: "", forFriend: false, rid: "fresh-room-" + i + "-padded-pad" }, open, now.toISOString(), f.prices.digest, "customer", null, { steps: priceSteps(f.prices) });
    placed.push(d.error ? (d.code || d.error) : "placed");
    if (!d.error) open = open.concat([O.applyEvent(null, d.ev).order]);
  }
  ok(O.openCount(f.orders.filter((o) => O.OPEN_STATES.includes(o.status))) === 2 && JSON.stringify(placed.slice(0, 3)) === JSON.stringify(["placed", "placed", "placed"])
    && placed[3] !== "placed", "The fresh fixture holds two open orders and room for three: the fourth placement is refused at the limit: " + JSON.stringify(placed));

  /* 2. what Order again and Batch B's tiles need */
  const st = (s) => f.orders.filter((o) => o.status === s);
  const offList = st("done").filter((o) => !f.prices.products.some((p) => p.product === o.product && (p.grid || p.sizes.some((x) => x.q === o.qty))));
  ok(st("cancelled").length === 1 && st("declined").length === 1 && st("done").length === 3 && st("done").every((o) => Math.abs(+o.moved - +o.qty) < 1e-9)
    && offList.length === 1 && (f.pools || []).some((p) => p.state === "open" && !p.joins.length) && !f.claims.some((c) => c.state === "waiting") && TF.stageOf(f) === 0,
    "The fresh fixture holds one withdrawn and one declined order, three handed over in full (one at a size since off the list), a group order open to join, no claim waiting and no gate: "
    + JSON.stringify(f.orders.map((o) => o.status + ":" + o.product + ":" + o.qty)));

  /* 3. the order book's two fixture ops */
  const harness = orderBook({ ORDER_STORE: "object" });
  const gen = JSON.stringify(["salt", "2026-10-19T00:00:00.000Z", "iv"]);
  const tryRun = (op, a) => { try { return harness.book.run(op, a); } catch (e) { return { ok: false, error: e.message }; } };
  const acct = (u) => tryRun("fixture-account", { u, generation: gen, actor: "read", seed: { orders: [], claims: [], sales: [], pools: [] } });
  const thr = (u) => tryRun("fixture-thread", { u, generation: gen, actor: "read", seed: null });
  const res = [acct("0000-0002"), thr("0000-0002"), acct("abcd-efgh"), thr("abcd-efgh")];
  ok(res[0].ok === true && res[1].ok === true && res[2].ok === false && res[2].status === 400 && res[3].ok === false && res[3].status === 400,
    "The order book takes 0000-0002 on both fixture ops and refuses a real username on each: " + JSON.stringify(res.map((r) => [r.ok, r.status || 200])));

  /* 4. Salt Account offers Make for each of the three */
  const wins = [];
  const practice = async (made) => {
    const posts = [], errs = [], vc = new VirtualConsole(); vc.on("jsdomError", (e) => errs.push(String(e.message || e)));
    let work;
    const sheetJ = { ok: true, accounts: made.map((u) => ({ username: u, test: true, code: "TEST" })) };
    const dom = new JSDOM(landingPage("", "nfx", { master: "fixture-master", accounts: [] }), { url: "https://counter.fixture.test/all#shop/practice",
      runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
        Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
        w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.scrollTo = () => {}; w.confirm = () => true;
        w.setTimeout = () => 0; w.clearTimeout = () => {}; w.setInterval = () => 0; w.clearInterval = () => {};
        w.fetch = async (path, o) => {
          if (String(path) === "/all/test" && o && o.method === "POST") { const b = JSON.parse(o.body); posts.push(b.u); sheetJ.accounts.push({ username: b.u, test: true, code: "TEST" }); }
          return { ok: true, status: 200, type: "basic", json: async () => (String(path) === "/all/sheet" ? sheetJ
            : { ok: true, accounts: [], refs: [], tiers: [], claims: [], threads: [], pools: [], lines: [], orders: [], drafts: [], refused: [], queue: [] }) };
        };
        work = pageWork(w);
      } });
    wins.push(dom.window);
    await work.quiet();
    const box = dom.window.document.getElementById("mTest"), lead = box ? (box.querySelector("p") || {}).textContent || "" : "";
    const b = byAct(dom.window.document, "more.test-accounts");
    if (b) b.click();
    await work.quiet();
    return { lead, posts, errs };
  };
  const two = await practice(["0000-0000", "0000-0001"]), none = await practice([]);
  ok(/0000-0002/.test(two.lead) && JSON.stringify(two.posts) === JSON.stringify(["0000-0002"])
    && JSON.stringify(none.posts) === JSON.stringify(["0000-0000", "0000-0001", "0000-0002"]) && !two.errs.length && !none.errs.length,
    "Salt Account offers Make for each of the three: with two made it names and makes 0000-0002 alone, with none all three: " + JSON.stringify([two, none]));
  for (const w of wins) w.close();

  /* 5. every feature line keeps its case */
  ok(JSON.stringify(TF.missing(all)) === "[]" && TF.FEATURES.some(([n, t]) => /fresh account/.test(n) && t(f) && !t(all["0000-0000"])),
    "missing() is empty over the three fixtures, and the fresh account's own line is held by 0000-0002 alone: " + JSON.stringify(TF.missing(all)));
}
