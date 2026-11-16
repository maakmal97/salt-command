/* test/admin-ac-wide.mjs: SALT ADMIN A TO C, V39 (21 Oct 2026; his answer (a), reversing the split of 11 Oct 2026 from 1080px). What is proved
 * here, each check red under its own mutation (test/admin-ac-wide.mutations.json):
 *   1  from 1080px an open order takes the list's place, as on a phone, and the rail's Orders closes it back to the list; no order opens itself
 *   2  from 860 to 1080px the list still stands beside the card, the first order opening in it
 *   3  from 1180px the card lays out in two columns, decision beside record and insight; from 1440px in three, decision, record, insight, at
 *      the widths he gave; below 1180 the card is as drawn, part for part in its order; the foot stays under the columns.
 *      2 Nov 2026 (his Orders canvas, page 2): from 1180px TWO columns, 24px apart, at 1440 too: the decision (the band, the Steps, his decision) left
 *      and the record (the Bill, the messages, This customer and the Order log, the end) right; three columns are retired
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
  /* 16 Nov 2026, the move to Ambient (place G): the open order is the second pane of the orders' split, side by side from 960px and in the list's place below it; the
     older grid, the columns and the first order opening by itself are gone, and a change of width moves and draws nothing */
  const st = { w: 1440 };
  const p = await richOwnerPage({ pageWork, before: widthOf(st) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    const split = d.getElementById("oSplit");
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.open"));
    /* 1 */
    ok(!split.classList.contains("open") && !d.querySelector("#makerReview .maker-card") && !d.getElementById("ordnone").hidden, "at 1440 no order opens itself: the queue stands and the second pane says Choose an order");
    await click(byAct(d, "order.open", "ord-r1"));
    ok(split.classList.contains("open") && d.getElementById("ordnone").hidden && split.matches(".amb-split.amb-split--panes") && split.children[1].contains(d.querySelector("#makerReview .maker-card"))
      && /#oSplit\.open \.ordqueue, #oSplit:not\(\.open\) \.ordrecord/.test(css) && !/ordgrid|ordcols/.test(css),
      "an order opened stands in the second pane, and below 960px it takes the queue's place");
    /* 3 */
    const card = d.querySelector("#makerReview .maker-card");
    ok(!card.querySelector(".ordcols") && card.firstElementChild.classList.contains("ohead") && !!card.querySelector(".ordsteps") && !!card.querySelector(".ordmoney") && !!card.querySelector(".omsgs") && !!card.querySelector(".undohist")
      && card.lastElementChild.matches(".amb-foot.ofoot") && /#makerReview, #makerReview > \.maker-card \{ display: contents; \}/.test(css),
      "the card is the record's own stack, its band first and its foot last, the wrappers standing aside");
    /* 4 */
    const field = card.querySelector('.omoney [data-act="order.pay-amount"]');
    if (field) field.value = "37";
    for (const w of [1180, 1100, 900, 390]) { st.w = w; st.fire(); }
    ok(d.querySelector("#makerReview .maker-card") === card && split.classList.contains("open") && (!field || field.value === "37"),
      "a change of width moves and draws nothing: the same card stands, and what he typed stays");
    await click(byAct(d, "nav.orders"));
    ok(!split.classList.contains("open") && !d.querySelector("#makerReview .maker-card"), "and the rail's Orders closes it back to the list");
    /* 2 */
    st.w = 900;
    await click(byAct(d, "part.orders.todo"));
    ok(!split.classList.contains("open") && !d.querySelector("#makerReview .maker-card"), "below 960px no order opens itself either");
  } finally { p.w.close(); }
}
