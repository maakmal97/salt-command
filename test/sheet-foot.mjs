/* test/sheet-foot.mjs: 19 NOV 2026, HIS WORD "pin the Send button on the phone sheet". On a phone Salt Admin's Change sheet drew Send the change
 * under its fields, reached only by scrolling the sheet (open since v1529). Ambient 0.7.30 has a sheet foot, sticky at the sheet's foot, and
 * the sheets draw their answers in it:
 *   F1  Salt Admin's Change sheet (the yes or no sheet every ask shares) ends in Ambient's sheet foot, Send the change then Not now in it, the body
 *       holding neither
 *   F2  Salt Counter's order sheet ends in the same foot, its Review in it
 *   F3  the stylesheet the two pages carry pins the foot: sticky at the sheet's foot, taps through its fade to what shows there
 * What jsdom cannot lay out was measured in a browser at 390, 1180, 1440 and 1920. Invented codes only (rule 2). Every assertion is red under its
 * own mutation (test/sheet-foot.mutations.json). */
import { readFileSync } from "node:fs";
import { richOwnerPage, byAct, changeSheet } from "./maker-act.mjs";
import { open, basketAdd, toSheet, SHAPE } from "./counter-b-kit.mjs";

const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  /* F1 */
  const base = { u: "abcd-efgh", product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [] };
  const review = (j) => { j.orders.push({ ...base, id: "ord-f1", status: "acknowledged", mode: "collect", qty: 1, total: 100 }); return j; };
  const P = await richOwnerPage({ pageWork, review });
  try {
    const d = P.d;
    byAct(d, "nav.orders").click(); await P.work.quiet();
    const cardOf = () => [...d.querySelectorAll("#makerReview [data-maker-card]")].find((c) => c.getAttribute("data-maker-card") === "ord-f1") || null;
    for (const pt of ["open", "todo"]) { if (cardOf()) break; byAct(d, "part.orders." + pt).click(); await P.work.quiet(); const r = byAct(d, "order.open", "ord-f1"); if (r) { r.click(); await P.work.quiet(); } }
    const card = cardOf();
    const sh = card ? await changeSheet(P, card, { go: false }) : null;
    const foot = sh && sh.lastElementChild, body = sh && sh.querySelector(".amb-sheet__body");
    const go = d.getElementById("ynGo"), keep = d.getElementById("ynKeep");
    const kids = foot ? [...foot.children].map((x) => x.id) : [];
    ok(!!sh && !!foot && foot.classList.contains("amb-sheet__foot") && J(kids) === J(["ynGo", "ynKeep"]) && go.textContent === "Send the change"
      && !!body && !body.contains(go) && !body.contains(keep),
      "F1: the Change sheet ends in Ambient's sheet foot, Send the change then Not now in it, the body holding neither: " + J([foot && foot.className, kids, go && go.textContent]));
  } catch (e) { ok(false, "F1 stopped on an error: " + (e && e.stack)); } finally { P.w.close(); }

  /* F2 */
  const A = await open({ pageWork });
  try {
    A.d.querySelector('button[data-t="prices"]').click(); await A.settle();
    await basketAdd(A, SHAPE.salt, 1); await toSheet(A);
    const os = A.d.getElementById("osheet"), last = os && os.lastElementChild, rv = A.d.getElementById("oGo");
    ok(!!last && last.classList.contains("amb-sheet__foot") && !last.classList.contains("amb-sheet__body") && !!rv && last.contains(rv),
      "F2: the Counter's order sheet ends in the same foot, its Review in it: " + J([last && last.className, !!rv]));
  } catch (e) { ok(false, "F2 stopped on an error: " + (e && e.stack)); } finally { try { A.close(); } catch (e) { /* closed */ } }

  /* F3: what each page is served (the statement's stylesheet carries Ambient whole) */
  const css = readFileSync(new URL("../stmt/statement-css.js", import.meta.url), "utf8");
  const rule = (css.match(/\.amb-sheet__foot \{[^}]*\}/) || [""])[0];
  ok(/position: sticky/.test(rule) && /bottom: calc\(-1 \* var\(--amb-sheet-end\)\)/.test(rule) && /pointer-events: none/.test(rule)
    && /\.amb-sheet__foot > \* \{ pointer-events: auto; \}/.test(css) && /\.amb-sheet \{ --amb-sheet-end: calc\(var\(--amb-space-5\) \+ var\(--amb-safe-bottom\)\); \}/.test(css),
    "F3: the stylesheet both pages carry pins the sheet foot at the sheet's foot and lets taps through its fade: " + J(rule.slice(0, 120)));
}
