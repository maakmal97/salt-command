/* test/counter-reward.mjs: THE ASSOCIATE REWARD ON SALT COUNTER, P6 (his rules of 20 Oct 2026): one sentence and one line, no figure.
 * Each check observes the order's own screen in jsdom (test/counter-b-kit.mjs) and was proved red by its own mutation
 * (test/counter-reward.mutations.json):
 *   1  an acknowledged order still to pay that carries "cross" says it brings them over to the next reward, beside pay now
 *   2  the sentence is not drawn without the word, nor on an order paid in full; with goods out and still to pay it stands
 *   3  an order carrying "given" draws a reward line: the product's mark, one unit, no charge, and no amount and no product word
 *   4  without the word, no reward line */
import { open, ord, ago, txt, until } from "./counter-b-kit.mjs";

const CROSS = "This order brings you over to the next reward. Pay now to receive them together with your reward.";

export async function run({ ok, pageWork }) {
  const pages = [];
  const part = async (p, id, k) => {
    p.d.querySelector('button[data-t="order"]').click(); await p.settle();
    const row = () => p.d.querySelector('#pOrder [data-row="' + id + '"]');
    if (!row()) { const later = p.d.querySelector("#pOrder .olater"); if (later) later.click(); await until(row, 60); }
    if (!row()) return null;
    row().click(); await until(() => p.d.querySelector('#pOrder .oscreen[data-order="' + id + '"]'), 60);
    return p.d.querySelector('#pOrder .oscreen[data-order="' + id + '"] [data-part="' + k + '"]');
  };
  const K = ord("rw1", "acknowledged", ago(2), { rwd: "cross" }), N = ord("rw2", "acknowledged", ago(2));
  const PAID = ord("rw3", "acknowledged", ago(2), { rwd: "cross", paid: 100 }), OUT = ord("rw4", "acknowledged", ago(2), { rwd: "cross", moved: 0.5, movedOn: ago(1).slice(0, 10) });
  const G = ord("rw5", "done", ago(3), { rwd: "given", moved: 1, movedOn: ago(1).slice(0, 10), paid: 100 }), D = ord("rw6", "done", ago(3), { moved: 1, movedOn: ago(1).slice(0, 10), paid: 100 });
  try {
    const A = await (async () => { const p = await open({ ok, pageWork, assoc: true, orders: [K, N, PAID, OUT, G, D] }); pages.push(p); return p; })();
    /* 1 */
    const k = txt(await part(A, "rw1", "when"));
    ok(k.includes("Please pay now if you can. " + CROSS), "an acknowledged order still to pay with cross says so, beside pay now: " + k);
    /* 2 */
    const n = txt(await part(A, "rw2", "when")), pd = txt(await part(A, "rw3", "when")), out = txt(await part(A, "rw4", "when"));
    ok(n && pd && out && ![n, pd].some((t) => t.includes("next reward")) && out.includes(CROSS), "not without the word, nor paid in full; with goods out and owed, it stands: " + JSON.stringify([n, pd, out]));
    /* 3 */
    const m = await part(A, "rw5", "money"), line = m && m.querySelector(".orwd");
    const lt = txt(line);
    ok(!!line && lt.startsWith("Reward · 1 unit") && lt.endsWith("No charge") && !!line.querySelector("svg.psym") && !/RM|[0-9]+\.[0-9]|\bsalt\b/i.test(lt.replace("1 unit", "")),
      "a given order draws its reward line, mark, one unit, no charge, no amount or product word: " + lt);
    /* 4 */
    const dm = await part(A, "rw6", "money");
    ok(!!dm && !dm.querySelector(".orwd") && !/Reward/.test(txt(dm)), "without the word, no reward line: " + txt(dm));
  } finally { for (const p of pages) p.close(); }
}
