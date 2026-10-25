/* test/admin-needs-cards.mjs: SALT ADMIN NEEDS YOU, P5, THE CARD (22 Oct 2026; his canvas Needs you and his comments on the card). What is proved here, each
 * check red under its own mutation (test/admin-needs-cards.mutations.json):
 *   1  every card is one shape on fixed columns: the kind and the age on line one, the title on line two, one pill, the figure last; no why line, no
 *      chip, no what line and no clock on the card
 *   2  the title is the code in the mono face, a book's typed Product tag before it (SALT, its hue), never the drawn mark
 *   3  the figure is the card's sum, RM and whole ringgit where there are no sen; a card with no sum leaves its column empty
 *   4  the age is in ember when late: an order waited past his usual, money owed past its term (its age how late it is)
 *   5  the resting card shows its first action alone, a filled pill of one size; the second choice stands in the opened card; a money tap grows the
 *      card to ask, both answers under the body
 *   6  the page's rules: one height (76px, 80px from 860px), the pill 72 or 120 by 48, the columns fixed, nothing wraps
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
/* the page's ageOf, so a fixed fixture date ages with the clock */
const ageOf = (iso) => { const m = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000)); return m < 60 ? m + " min" : m < 2880 ? Math.floor(m / 60) + " h" : Math.floor(m / 1440) + " d"; };
const OWED2 = { party: "CX7-ZED", rm: 40, since: "2026-10-01", due: "2026-10-08", rows: [{ rid: "s-owed-2", key: "k2", product: "salt" }] };
const OWED = { party: "CX1-ZED", rm: 120, since: "2026-10-01", due: "2026-10-08", rows: [{ rid: "s-owed-1", key: "k1", product: "salt" }] };

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, review: (j) => ({ ...j, orders: (j.orders || []).map((o) => (o.id === "ord-p1" ? { ...o, at: "2026-10-10T02:00:00.000Z" } : o)) }), hours: (j) => ({ ...j, confirm: { at: new Date().toISOString(), n: 12, mins: 20 } }),
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, owedMoney: [OWED, OWED2], owedGoods: [] } }) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.needs"));
    const card = (k) => d.querySelector('#nlist [data-need="' + k + '"]');
    const cards = [...d.querySelectorAll("#nlist section [data-need]")];
    /* 1 */
    const shape = (c) => [...c.children].map((x) => x.classList.contains("nkind") ? "kind" : x.classList.contains("salt-action__body") ? "body" : x.classList.contains("salt-action__go") ? "go" : x.classList.contains("nfig") ? "fig" : x.className);
    const bad = cards.filter((c) => J(shape(c)) !== J(["kind", "body", "go", "fig"]) || c.querySelector(".salt-action__why, .salt-status, .need-what, .need-clock, [data-clock]")).map((c) => c.getAttribute("data-need"));
    ok(cards.length >= 15 && bad.length === 0 && t(card("p:ord-a1").querySelector(".nkind")) === "Payment · " + ageOf("2026-10-10T01:00:00.000Z"),
      "every card is the kind and age, the title, the pill and the figure, and no why, chip, what or clock: " + cards.length + " cards; " + J(bad));
    /* 2 */
    const o1 = card("o:ord-p1"), tt = o1.querySelector(".need-tap"), tag = tt.querySelector(".salt-producttag"), who = tt.querySelector(".need-who");
    ok(!!tag && tag.classList.contains("salt-producttag--salt") && t(tag) === "Salt" && !!tag.querySelector(".salt-producttag__dot") && tag.nextElementSibling === who
      && who.classList.contains("need-who--code") && t(who) === "CX1-ZED" && !d.querySelector("#nlist section svg.psym, #nlist section .pwith")
      && /^Order: Agree CX1-ZED's order, 2 units/.test(tt.getAttribute("aria-label") || ""),
      "an order's title is its book's typed Product tag (Salt) and the code in the mono face, no drawn mark, and a reader hears the whole: " + t(tt) + " | " + tt.getAttribute("aria-label"));
    /* 3 */
    const fig = (k) => t(card(k).querySelector(".nfig"));
    ok(J(["p:ord-a1", "o:ord-p1", "c:abcd-efgh:c-1", "m:abcd-efgh", "$:CX1-ZED"].map(fig)) === J(["RM 530", "RM 200", "RM 50", "", "RM 120"]),
      "the figure is the card's sum in whole ringgit, and a card with no sum leaves its column empty: " + J(["p:ord-a1", "o:ord-p1", "c:abcd-efgh:c-1", "m:abcd-efgh", "$:CX1-ZED"].map(fig)));
    /* 4 */
    const age = (k) => card(k).querySelector(".nage") || d.createElement("i");
    ok(age("o:ord-p1").classList.contains("nage--late") && !age("m:abcd-efgh").classList.contains("nage--late") && /^\d+ d late$/.test(t(age("$:CX1-ZED"))) && age("$:CX1-ZED").classList.contains("nage--late"),
      "the age is in ember when late: an order past his usual 20 min, money owed past its term, its age how late it is: " + J([t(age("o:ord-p1")), t(age("$:CX1-ZED"))]));
    /* 5 */
    const btns = (k) => [...card(k).querySelectorAll(".salt-action__go button")];
    const one = ["l:w1", "k:tvwx-yz23", "$:CX1-ZED", "p:ord-a1", "o:ord-p1", "w:notice", "x:0", "$:CX7-ZED"].map((k) => [k, btns(k).length, btns(k).every((b) => b.classList.contains("salt-pill") && b.classList.contains("salt-pill--sm") && b.classList.contains("nbtn") && !b.classList.contains("salt-ghost"))]);
    ok(one.every((x) => x[1] === 1 && x[2]) && t(btns("l:w1")[0]) === "Approve" && t(btns("k:tvwx-yz23")[0]) === "Send" && btns("k:tvwx-yz23")[0].getAttribute("aria-label") === "Send a sign-in link"
      && t(btns("$:CX1-ZED")[0]) === "Message" && t(btns("w:notice")[0]) === "Change" && t(btns("$:CX7-ZED")[0]) === "Record" && btns("$:CX7-ZED")[0].getAttribute("aria-label") === "Record payment",
      "a resting card shows one filled pill of one size, its second choice (Decline, Show a code, Record payment) left to the opened card, and a card whose one way was a ghost (Record payment, for a customer with no account to message) shows it filled: " + J(one));
    await click(btns("c:abcd-efgh:c-1")[0]);
    const asking = card("c:abcd-efgh:c-1");
    ok(asking.classList.contains("need--grow") && !!asking.querySelector(".salt-action__body .nask") && J(btns("c:abcd-efgh:c-1").map(t)) === J(["Yes", "Cancel"]),
      "a money tap grows its card to ask once, Yes and Cancel both under the body: " + J(btns("c:abcd-efgh:c-1").map(t)));
    await click(byAct(asking, "need.ask-no"));
    ok(!card("c:abcd-efgh:c-1").classList.contains("need--grow") && btns("c:abcd-efgh:c-1").length === 1, "and Cancel puts it back to its one height and one pill");
    /* 6 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.ncard\{grid-template-columns:minmax\(0,1fr\) 72px 88px;[^}]*height:76px\}/.test(css) && /\.adm \.ncard \.nbtn\{[^}]*width:72px;[^}]*height:48px;[^}]*white-space:nowrap/.test(css)
      && /\.adm \.ncard\{grid-template-columns:minmax\(0,1fr\) 120px 116px;[^}]*height:80px\}/.test(css) && /\.adm \.ncard \.nbtn\{width:120px;/.test(css)
      && /\.adm \.ncard \.need-who\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/.test(css) && /\.adm \.ncard>\.nkind\{[^}]*white-space:nowrap/.test(css),
      "one height, 76px and 80px from 860px, on fixed columns, the pill 72 or 120 by 48, and nothing on the card wraps");
  } finally { p.w.close(); }
}
