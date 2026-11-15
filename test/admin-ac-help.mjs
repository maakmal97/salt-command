/* test/admin-ac-help.mjs: SALT ADMIN A TO C, P8 (21 Oct 2026; docs/plan-counter-admin-ac.html). What is proved here, each check red under its
 * own mutation (test/admin-ac-help.mutations.json):
 *   1  Shop > Hours shows the customer's Help, the four questions in their order, each folded shut, its question and answer the words a
 *      customer reads (stmt/words.js help.*)
 *   2  it is read only: nothing in it but the four folds, no field and no button
 *   3  it stands on Hours alone, not on Shop's other parts, and the customer's own Help is drawn as before, never on his page twice */
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { EN } from "../stmt/words.js";
import { landingPage } from "../stmt/page.js";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.shop")); await click(byAct(d, "part.shop.hours"));
    const box = d.getElementById("mHelp"), rows = box ? [...box.querySelectorAll("details.ahelp__q")] : [];
    const want = ["pay", "deliv", "coll", "change"].map((k) => [EN["help." + k], EN["help." + k + "A"]]);
    const got = rows.map((r) => [t(r.querySelector("summary")), t(r.querySelector(".ahelp__a"))]);
    /* 1 */
    ok(!!box && !box.hidden && J(got) === J(want) && rows.every((r) => !r.open) && rows.every((r) => r.querySelector("summary").classList.contains("ahelp__sum")),
      "Shop > Hours shows the customer's Help, four questions in their order, each folded shut, in the words a customer reads: " + J(got.map((g) => g[0])));
    /* 1b, 16 Nov 2026, the move to Ambient (0.7.4): each question is Ambient's disclosure row, one group name so one opens at a time,
       its summary a settings row with the chevron that turns, its answer Ambient's text; the page's layer keeps no rule of its own for it */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("");
    ok(rows.length === 4 && rows.every((r) => r.classList.contains("amb-disclose") && r.getAttribute("name") === "shop-help"
        && r.querySelector(":scope > summary").classList.contains("amb-setting") && !!r.querySelector(":scope > summary > .amb-setting__name")
        && !!r.querySelector(":scope > summary > svg.amb-disclose__mark use[href='#amb-chevron']") && !!r.querySelector(":scope > p.amb-disclose__text"))
      && !/.ahelp-list/.test(css),
      "each question is Ambient's disclosure row in one group (shop-help), a settings row with its turning chevron over Ambient's answer text, and no rule of the page's own for it");
    /* 2 */
    ok(!!box && box.querySelectorAll("input, textarea, select, button, a, [contenteditable]").length === 0, "and it is read only: no field, button or link in it");
    /* 3 */
    await click(byAct(d, "part.shop.notice"));
    ok(!!box && box.hidden, "it stands on Hours alone, not on the Notice");
    const cust = landingPage("abcd-efgh", "nhelp", null), his = landingPage("", "nhelp", { master: "fixture-master", accounts: [] });
    ok(/id="aHelp"/.test(cust) && !/id="mHelp"/.test(cust) && (his.match(/class="ahelp[ "]/g) || []).length === 1 && !/id="aHelp"/.test(his),
      "and the customer's own Help is drawn as before, Salt Admin's page carrying it once, as his read only copy");
  } finally { p.w.close(); }
}
