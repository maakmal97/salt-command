/* test/loyalty-counter.mjs: THE LOYALTY UNIT ON SALT COUNTER, P5 (his rule of 20 Oct 2026, docs/plan-loyalty-unit.html): a customer sees a share of
 * one unit on Home and nothing else, and 0000-0002 is a plain customer who shows it. Each check red under its own mutation
 * (test/loyalty-counter.mutations.json):
 *   1  a customer whose card carries loyal sees Your next reward on Home: the mark, the share as words and on the meter, no figure, no
 *      See your card, and nothing to tap; there is no Rewards tab for them
 *   2  a customer whose card carries no loyal share sees no reward card
 *   3  0000-0002 is a plain customer with a share of 0.7 and an order that brings the next unit; 0000-0000 and 0000-0001 stay associates
 *   4  the sealed fixture and the Worker's record read the fixture's own flag, so 0000-0002 signs in as a customer */
import { open, ord, ago } from "./counter-b-kit.mjs";

class KV {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(k, v); }
  async get(k, type) { if (!this.m.has(k)) return null; const raw = this.m.get(k); return type === "json" ? JSON.parse(raw) : raw; }
  async delete(k) { this.m.delete(k); }
}

const t = (n) => (n ? n.textContent.replace(/\s+/g, " ").trim() : "");

export async function run({ ok, pageWork }) {
  const pages = [];
  try {
    /* 1 */
    const C = await open({ ok, pageWork, orders: [ord("ly1", "acknowledged", ago(2))], card: { at: ago(1), products: [{ product: "salt", loyal: { next: 0.7 } }] } });
    pages.push(C);
    const box = C.d.querySelector("#hReward"), rc = box && box.querySelector(".hreward");
    const tab = C.d.querySelector('button[data-t="card"]');
    const rw = { head: t(box && box.querySelector(".hlab")), left: t(rc && rc.querySelector(".hreward__left")), pc: t(rc && rc.querySelector(".salt-meter__line b")),
      fill: rc ? rc.querySelector(".salt-meter").style.getPropertyValue("--salt-fill") : "", n: box ? box.querySelectorAll(".hreward").length : 0,
      mark: !!(rc && rc.querySelector("svg.psym")), tag: rc && rc.tagName, taps: rc ? rc.querySelectorAll("button,a,[tabindex]").length : -1, see: t(rc).includes("See your card"),
      tab: !!tab && (tab.hidden || tab.closest("[hidden]") !== null) };
    ok(rw.head === "Your next reward" && rw.left === "70% of the way to your next unit" && rw.pc === "70%" && rw.fill === "70" && rw.n === 1 && rw.mark
      && rw.tag === "DIV" && rw.taps === 0 && !rw.see && !/RM|unit[s]? to|[0-9]+\.[0-9]/.test(t(rc).replace("70%", "")) && rw.tab,
      "a customer sees the share of their next unit on Home, nothing to tap and no Rewards tab: " + JSON.stringify(rw));
    /* 2 */
    const N = await open({ ok, pageWork, orders: [ord("ly2", "acknowledged", ago(2))], card: { at: ago(1), products: [{ product: "salt" }] } });
    pages.push(N);
    ok(!N.d.querySelector("#hReward .hreward"), "no loyal share, no reward card");
  } finally { for (const p of pages) p.close(); }
  /* 3 */
  const TF = await import("../tools/testfix.mjs"), all = TF.buildAll(new Date());
  const f2 = all["0000-0002"], f0 = all["0000-0000"], f1 = all["0000-0001"];
  ok(f2.assoc === false && f2.card.products.length === 1 && f2.card.products[0].product === "salt" && f2.card.products[0].loyal.next === 0.7 && !f2.card.products[0].reward
    && f2.orders.some((o) => o.rwd === "cross" && o.product === "salt" && ["acknowledged", "ready"].includes(o.status)) && f0.assoc === true && f1.assoc === true
    && JSON.stringify(TF.missing(all)) === "[]",
    "0000-0002 is a plain customer with a share and an order that brings the next unit; the other two stay associates: " + JSON.stringify([f2.assoc, f2.card, f0.assoc, f1.assoc, TF.missing(all)]));
  /* 4 */
  const C2 = await import("../tools/stmt-crypto.mjs"), TW = await import("../stmt/testfix.js");
  const pass = "0000-0000-0000-0000", ck = await C2.contentKey("test-secret", "0000-0002"), wrap = await C2.wrapKey(pass, ck);
  const rec = { u: "0000-0002", test: true, wrap, verifier: "v", env: "e" };
  const sealed2 = await TF.sealFixture(f2, rec, pass), sealed0 = await TF.sealFixture(f0, { ...rec, u: "0000-0000" }, pass);
  const kv = new KV(); await kv.put("u:0000-0002", JSON.stringify(rec)); await kv.put("testfix:0000-0002", JSON.stringify(sealed2));
  const got = await TW.accountRecord({ STMT: kv }, "0000-0002");
  await kv.put("testfix:0000-0002", JSON.stringify(sealed0)); const got0 = await TW.accountRecord({ STMT: kv }, "0000-0002");
  ok(sealed2.assoc === false && sealed0.assoc === true && got && got.assoc === false && !!got.card && got0.assoc === true,
    "the sealed fixture and the Worker's record read the fixture's own flag: " + JSON.stringify([sealed2.assoc, sealed0.assoc, got && got.assoc, got0 && got0.assoc]));
}
