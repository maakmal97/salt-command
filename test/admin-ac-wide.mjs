/* test/admin-ac-wide.mjs: SALT ADMIN A TO C, V39 (21 Oct 2026; his answer (a), reversing the split of 11 Oct 2026 from 1080px). What is proved
 * here, each check red under its own mutation (test/admin-ac-wide.mutations.json):
 *   1  from 1080px an open order takes the list's place, as on a phone, and the rail's Orders closes it back to the list; no order opens itself
 *   2  from 860 to 1080px the list still stands beside the card, the first order opening in it
 *   3  from 1180px the card lays out in two columns, decision beside record and insight; from 1440px in three, decision, record, insight, at
 *      the widths he gave; below 1180 the card is as drawn, part for part in its order; the foot stays under the columns
 *   4  a change of width moves the parts, never draws them again: what he typed stays */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
/* a window of a given width: each media query read against it */
function widthOf(state) {
  return (w) => {
    const subs = [];
    w.matchMedia = (q) => {
      const test = () => q.split(",").some((part) => {
        const min = /min-width:\s*([\d.]+)px/.exec(part), max = /max-width:\s*([\d.]+)px/.exec(part);
        return (!min || state.w >= +min[1]) && (!max || state.w <= +max[1]);
      });
      const m = { media: q, get matches() { return test(); }, addEventListener(t, f) { subs.push(f); }, removeEventListener() {}, addListener(f) { subs.push(f); }, removeListener() {} };
      return m;
    };
    state.fire = () => subs.forEach((f) => f());
  };
}

export async function run({ ok, pageWork }) {
  const st = { w: 1440 };
  const p = await richOwnerPage({ pageWork, before: widthOf(st) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const split = d.getElementById("oSplit");
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.ready"));
    /* 1 */
    ok(!split.classList.contains("open") && !d.querySelector("#makerReview .maker-card"), "at 1440 no order opens itself: the list is the page");
    await click(byAct(d, "order.open", "ord-r1"));
    ok(split.classList.contains("open") && /@media \(max-width:859\.98px\),\(min-width:1080px\)\{\n  \.adm #oSplit\.open \.ordlist,\.adm #oSplit:not\(\.open\) #makerReview,\.adm #oSplit\.open #makerReviewStatus\{display:none\}/.test(css)
      && /@media \(min-width:860px\) and \(max-width:1079\.98px\)\{\n  \.adm \.ordgrid\{display:grid/.test(css),
      "an order opened from 1080px takes the list's place, the list and the card side by side only from 860 to 1080");
    /* 3 */
    const card = d.querySelector("#makerReview .maker-card"), box = card && card.querySelector(":scope > .ordcols");
    const colOf = (sel) => { const x = card.querySelector(sel); return x && x.closest(".ordcol") ? x.closest(".ordcol").getAttribute("data-ocol") : "none"; };
    const map3 = { band: colOf(".ohead"), lead: colOf(".ordlead"), steps: colOf(".ordsteps"), bill: colOf(".ordmoney"), log: colOf(".undohist"), msg: colOf(".ordfold:not(.ordfold--rowed)"), foot: colOf(".maker-foot") };
    ok(!!box && box.classList.contains("ordcols--3") && box.children.length === 3 && J(map3) === J({ band: "decision", lead: "decision", steps: "record", bill: "record", log: "record", msg: "insight", foot: "none" })
      && card.lastElementChild.classList.contains("maker-foot") && /\.adm \.ordcols--3\{grid-template-columns:minmax\(0,1\.15fr\) minmax\(0,1fr\) minmax\(0,0\.9fr\)\}/.test(css)
      && /\.adm \.ordcols\{display:grid;gap:20px;/.test(css),
      "at 1440 the card is three columns, decision, record and insight, at 1.15, 1 and 0.9, gap 20px, the foot under them: " + J(map3));
    /* 3b: the render pass of 21 Oct 2026 at 1440 found the row of three and the band too wide for a column */
    ok(/\.adm \.ordcol \.ordrow3\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/.test(css) && /\.adm \.ordcol \.ordrow3>:first-child\{grid-column:1\/-1\}/.test(css)
      && /\.adm \.ordcols--3 \.ogoods\{flex-wrap:wrap\}/.test(css) && /\.adm \.ordcols--3 \.ogoods__sum\{flex:1 1 100%;/.test(css),
      "in a column Agree stands on its own line over Change terms and Decline, and three across the band's total stands under the units");
    /* 4 */
    const field = card.querySelector('[data-sect="money"]') && card.querySelector("label.maker-field input");
    if (field) field.value = "37";
    st.w = 1180; st.fire();
    const box2 = card.querySelector(":scope > .ordcols"), map2 = { band: colOf(".ohead"), steps: colOf(".ordsteps"), msg: colOf(".ordfold:not(.ordfold--rowed)") };
    ok(d.querySelector("#makerReview .maker-card") === card && !!box2 && box2.classList.contains("ordcols--2") && J(map2) === J({ band: "decision", steps: "record", msg: "record" })
      && /\.adm \.ordcols--2\{grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)\}/.test(css) && (!field || field.value === "37"),
      "at 1180 the same card is two columns, the insight under the record, and what he typed stays: " + J(map2));
    st.w = 1100; st.fire();
    const seq = (c) => [...c.children].map((x) => x.tagName + "." + x.className).join(" | ");
    const moved = seq(card);
    await click(byAct(d, "nav.orders")); await click(byAct(d, "order.open", "ord-r1"));
    const fresh = d.querySelector("#makerReview .maker-card");
    ok(!card.querySelector(".ordcols") && fresh !== card && moved === seq(fresh) && fresh.firstElementChild.classList.contains("ohead"),
      "below 1180 the card is as drawn, part for part in its order: " + moved.slice(0, 160));
    await click(byAct(d, "nav.orders"));
    ok(!split.classList.contains("open") && !d.querySelector("#makerReview .maker-card"), "and the rail's Orders closes it back to the list");
    /* 2 */
    st.w = 900;
    await click(byAct(d, "part.orders.confirmed"));
    ok(split.classList.contains("open") && !!d.querySelector("#makerReview .maker-card") && !d.querySelector("#makerReview .ordcols"),
      "from 860 to 1080px the first order opens beside the list, in one column");
  } finally { p.w.close(); }
}
