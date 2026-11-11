/* test/admin-price-ask.mjs: 11 Nov 2026 (his report: a customer's order of 12.5 units at RM 880 would not agree, "The Counter could not do that. Try again."
 * seven times). The customer had asked for a price (the Counter's Negotiate, price.state asked); the Desk agrees such an order only by an offer they take
 * (src/orders.js acceptOrder), and Salt Admin never read an ask, so its card offered Agree and fell to the general refusal. Each check red under its own
 * mutation (test/admin-price-ask.mutations.json); invented codes only (rule 2).
 *   1  an asked order's card says their ask and the list price, starts Goods at their figure, and its one pill offers it (POST offer on the preview's
 *      offer digest, no window, never accept)
 *   2  an offer of his to their ask holds the card as his Accept for their yes does: waiting for their yes, Take back the offer, no Agree, no charge invented
 *   3  an asked delivery draws no When (Negotiate's offer carries no window); an ask with no list price says so; the row's move says Offer
 *   4  every sentence the Desk's Accept, offer and Withdraw can refuse with is in the refusal table, so none falls to "could not do that" */
import { readFileSync } from "node:fs";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const D = "2026-11-11", LATER = "2099-01-01T00:00:00.000Z";
const order = (id, patch = {}) => ({ id, u: "u-ask-" + id, product: "salt", qty: 12.5, total: 880, delivery: 0, paid: 0, moved: 0, mode: "collect",
  at: D + "T08:59:58.000Z", payments: [], msgs: [], history: [], status: "placed", ...patch });
const ORDERS = [
  order("ask-a", { price: { state: "asked", at: D + "T08:59:58.000Z", proposed: 800 } }),
  order("ask-b", { price: { state: "offered", at: D + "T08:59:58.000Z", proposed: 800, offer: { id: "f-ask-b-0000000000", total: 875, until: LATER } } }),
  order("ask-c", { mode: "deliver", qty: 5, total: 500, price: { state: "asked", at: D + "T08:59:58.000Z", proposed: 440 } }),
  order("ask-z", { qty: 40, total: 0, price: { state: "asked", at: D + "T08:59:58.000Z" } })];

/* the refusal table as data, between its markers, and every error literal of a function in src/orders.js */
const table = (src) => { const m = /\/\*REFUSALS\*\/\s*var REFUSALS=(\{[\s\S]*?\});\s*\/\*END REFUSALS\*\//.exec(src); return m ? Function("return " + m[1])() : {}; };
const errorsOf = (src, name) => {
  const at = src.indexOf("export async function " + name + "("); if (at < 0) return null;
  const end = src.indexOf("\nexport ", at + 10), body = src.slice(at, end < 0 ? undefined : end), out = [];
  for (const m of body.matchAll(/error: "((?:[^"\\]|\\.)*)"/g)) out.push(m[1]);
  for (const m of body.matchAll(/\? "((?:[^"\\]|\\.)*)"\s*(?::|\n)/g)) out.push(m[1]);
  /* and the last branch of a chosen sentence: cond ? "a" : "b" } */
  for (const m of body.matchAll(/: "((?:[^"\\]|\\.)*)" \}/g)) out.push(m[1]);
  return out;
};

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: ORDERS }) });
  try {
    await p.work.quiet();
    const d = p.d, card = (id) => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === id) || null;
    const tapRow = async (id) => { const r = byAct(d, "order.open", id); if (r) r.click(); await p.work.quiet(); return !!r; };
    byAct(d, "nav.orders").click(); await p.work.quiet();
    /* 1 */
    await tapRow("ask-a");
    const c = card("ask-a"), ask = c && c.querySelector("[data-ask]"), pv = p.posts.filter((x) => x.route === "/all/maker/orders/ask-a/preview");
    ok(!!ask && /They asked for RM 800/.test(ask.textContent) && /list price is RM 880/.test(ask.textContent),
      "an asked order's card says what they asked and the list price: " + (ask && ask.textContent));
    ok(pv.length === 1 && pv[0].body.total === 800, "and its Goods start at their figure, which the preview reads: " + JSON.stringify(pv.map((x) => x.body)));
    const pill = d.querySelector("#makerReview [data-accept]");
    ok(!!pill && /^Offer them/.test(pill.textContent), "the one pill offers it, never Agree: " + (pill && pill.textContent));
    if (pill) pill.click(); await p.work.quiet();
    const sent = p.posts.filter((x) => /\/all\/maker\/orders\/ask-a\/(offer|accept)$/.test(x.route));
    ok(sent.length === 1 && sent[0].route.endsWith("/offer") && sent[0].body.total === 800 && sent[0].body.hash === "b".repeat(64) && !("slot" in sent[0].body),
      "and it sends one offer on the preview's offer digest with no window, never Accept: " + JSON.stringify(sent));
    /* 2 */
    await tapRow("ask-b");
    const b = card("ask-b"), bt = b ? b.textContent : "";
    ok(/Waiting for their yes to RM 875(.00)?,/.test(bt) && !!b.querySelector("[data-withdraw]") && !d.querySelector('#makerReview [data-maker-card="ask-b"] [data-accept]'),
      "his offer to their ask holds the card: waiting for their yes, Take back the offer, no Agree, no charge invented: " + bt.slice(0, 200));
    /* 3 */
    await tapRow("ask-c");
    const cc = card("ask-c");
    ok(!!cc && !!cc.querySelector("[data-ask]") && !cc.querySelector("[data-when]"), "an asked delivery draws no When, which its offer could not carry");
    await tapRow("ask-z");
    const z = card("ask-z"), za = z && z.querySelector("[data-ask]");
    ok(!!za && /no list price/.test(za.textContent) && !/RM 0/.test(za.textContent), "an ask with no list price says so: " + (za && za.textContent));
    const row = byAct(d, "order.open", "ask-a"), rowText = row ? (row.closest("tr,li,.salt-settings__row") || row).textContent : "";
    ok(/Offer/.test(rowText) && !/Agree/.test(rowText), "the asked order's row says Offer, not Agree: " + rowText.slice(0, 160));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  /* 4 */
  const owner = readFileSync(new URL("../stmt/owner.js", import.meta.url), "utf8"), orders = readFileSync(new URL("../src/orders.js", import.meta.url), "utf8");
  const R = table(owner), missing = [];
  for (const fn of ["acceptOrder", "offerOrder", "withdrawOffer"]) { const e = errorsOf(orders, fn); if (!e) missing.push(fn + " not found"); else for (const s of e) if (s.endsWith(" ") ? !owner.includes("s.indexOf('" + s + "')===0") : !Object.hasOwn(R, s)) missing.push(s); }
  ok(Object.keys(R).length > 50 && missing.length === 0, "every sentence Accept, offer and Withdraw refuse with is in Salt Admin's refusal table: missing " + JSON.stringify(missing));
}
