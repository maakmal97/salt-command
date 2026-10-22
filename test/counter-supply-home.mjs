/* test/counter-supply-home.mjs: THE RESTOCK LIGHT MADE PLAIN, P2, AVAILABILITY ON HOME AND THE WORD ON PRICES (22 Oct 2026; his word, docs/plan-restock-light.html).
 * What is proved here, each check red under its own mutation (test/counter-supply-home.mutations.json), on the signed-in page in jsdom
 * (test/counter-b-kit.mjs):
 *   1  Home's first column carries Availability above New order: a row a book with a light, in the list's order, its mark in the light's
 *      border and the light in words (Available, Limited, Out of stock) in the light's colour; More by DD Mon under a yellow or red with a
 *      day, never under green; no figure but the day
 *   2  a row is a button that opens Prices and brings that book's pane into view
 *   3  on Prices the word stands under the mark, the border is 3px, the status reads the light's token, a row is 44px tall
 *   4  no light sealed, no card; greyed and inert with the rest of Home on a locked account */
import { open, txt, kl, LIST } from "./counter-b-kit.mjs";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (iso) => iso.slice(8, 10) + " " + MON[+iso.slice(5, 7) - 1];

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const by = kl(5);
  const lit = () => { const L = LIST(); const sz = [{ q: 1, price: 12 }, { q: 4, price: 45 }];
    L.products[0].supply = { light: "yellow", by }; L.products[1].supply = { light: "red", by: null };
    L.products.push({ product: "candy", unit: "unit", basis: "board", sizes: sz, supply: { light: "green", by } }, { product: "rice", unit: "unit", basis: "board", sizes: sz });
    return L; };
  try {
    /* ---- 1 ---- */
    const A = await page({ list: lit() });
    const box = A.d.getElementById("hSupply"), rows = box ? [...box.querySelectorAll("button.hsup")] : [];
    const read = rows.map((r) => ({ mark: r.querySelector(".pmark").className, st: r.querySelector(".salt-status").className, word: txt(r.querySelector(".salt-status")),
      by: txt(r.querySelector(".salt-inbox-row__what")), sr: txt(r.querySelector(".sr")) || (r.querySelector(".sr") || {}).textContent, all: txt(r) }));
    const col = box && box.parentNode, order = col ? [...col.children].map((c) => c.id) : [];
    ok(!!box && txt(box.querySelector(".hlab")) === "Availability" && order.indexOf("hSupply") >= 0 && order.indexOf("hSupply") === order.indexOf("hStart") - 1
      && rows.length === 3 && read.map((r) => r.word).join("|") === "Limited|Out of stock|Available"
      && read.every((r, i) => r.mark.includes("sup-" + ["yellow", "red", "green"][i]) && r.st.includes("supst") && r.st.includes("sup-" + ["yellow", "red", "green"][i])),
    "Availability stands above New order, a row a lit book in the list's order, its mark in the light's border and the light in words in its colour: " + JSON.stringify({ order, read }));
    ok(read[0].by === "More by " + dm(by) && read[1].by === "" && read[2].by === "" && read.every((r) => !/\d/.test(r.all.replace(r.by, ""))),
      "More by DD Mon under the yellow with a day, nothing under a red with none or a green with one, and no figure but the day: " + JSON.stringify(read));

    /* ---- 2 ---- */
    let into = null; A.w.HTMLElement.prototype.scrollIntoView = function () { into = this; };
    rows[1].click(); await A.settle();
    const pr = A.d.getElementById("pPrices"), panes = [...A.d.querySelectorAll("#pPrices .pane")];
    ok(!pr.hidden && !!into && into === panes[1] && /sup-red/.test(into.querySelector(".pmark").className),
      "a row opens Prices and brings that book's pane into view: " + JSON.stringify({ shown: !pr.hidden, pane: into && into.querySelector(".pmark").className }));

    /* ---- 3 ---- */
    const lines = panes.map((p) => txt(p.querySelector(".supline")));
    const css = [...A.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(lines.join("|") === "Limited|Out of stock|Available|" && panes.slice(0, 3).every((p) => p.querySelector(".supline").getAttribute("aria-hidden") === "true")
      && /\.pmark\.sup\{[^}]*border:3px solid var\(--sup\)/.test(css) && /\.salt-status\.supst\{--salt-status-tone:var\(--sup\)\}/.test(css) && /\.hsup\{min-height:44px/.test(css),
    "on Prices the word stands under each lit mark (the heading says it once), the border is 3px, the status reads the light's token and a row is 44px: " + JSON.stringify(lines));

    /* ---- 4 ---- */
    const N = await page({ list: LIST() });
    const K = await page({ list: lit(), late: 5 });
    const k = K.d.getElementById("hSupply");
    ok(!N.d.querySelector("#hSupply .hsup") && !!k && k.querySelectorAll(".hsup").length === 3 && k.classList.contains("lockd") && k.hasAttribute("inert"),
      "no light sealed, no card; on a locked account it is greyed and inert with the rest of Home: " + JSON.stringify([!!N.d.querySelector("#hSupply .hsup"), k && k.className]));
  } catch (e) { ok(false, "counter-supply-home stopped on an error: " + (e && e.stack)); }
  finally { pages.forEach((p) => p.close()); }
}
