/* test/admin-decide-many.mjs: MULTI-TICK APPROVE, P3, SALT ADMIN'S SCREEN (22 Oct 2026; canvas Salt Admin Approve, docs/plan-approve-many.html).
 * What is proved here, each check red under its own mutation (test/admin-decide-many.mutations.json), on the owner page in jsdom
 * (test/maker-act.mjs):
 *   1  a card's Approve and Reject choose, never send: pressed, the card lit, the other let go, a second tap clears; a claim has neither
 *   2  the head says how many wait and Approve all chooses Approve on every card that can go; the bar counts both ways, Clear empties it
 *   3  Confirm asks once, listing every card under "to approve" and "to reject", and its yes sends ONE decide-many with every draft of each
 *      card (a trip's rows together); nothing is sent before the yes
 *   4  after the answer, the decided are counted at the head, and a refused card stays with Refused, why and how to fix it
 *   5  44px targets and the light's tokens in the page's styles */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const T = (m) => "2026-10-22T0" + m + ":00:00.000Z";
const D = (id, patch = {}) => ({ id, status: "pending", collection: "sales", product: "salt", qty: 1, total: 100,
  entry: { type: "SELL", party: "CX1-ZED", date: "2026-10-22" }, row: { qty: 1, total: 100, cost: 56 }, cost: { total: 56 }, margin: { rm: 44, pct: 44 }, flags: [], ...patch });
const DRAFTS = [D(T(1)), D(T(2), { row: { qty: 1, total: 100, cost: 56, trip: "t9" } }), D(T(3), { product: "oil", row: { qty: 1, total: 50, cost: 20, trip: "t9" } }),
  D(T(4), { entry: { type: "SELL", party: "CX2-ZED", date: "2026-10-22" } }), D(T(5), { entry: { type: "SELL", party: "CX1-ZED", date: "2026-10-22", claim: true } })];

export async function run({ ok, pageWork }) {
  let answer = null;
  const p = await richOwnerPage({ pageWork, bare: true, review: (j) => ({ ...j, orders: [], drafts: DRAFTS.map((d) => JSON.parse(J(d))), queue: [], trips: [], sameDay: [], rows: [] }),
    extra: (route) => (route === "/all/maker/drafts/decide-many" ? answer : undefined) });
  try {
    await p.work.quiet();
    byAct(p.d, "nav.orders").click(); await p.work.quiet();
    const tap = async (n) => { n.click(); await p.work.quiet(); };
    const cardOf = (id) => p.d.querySelector('[data-maker-card="draft:' + id + '"]');
    const btn = (id, act) => { const c = cardOf(id); return c && c.querySelector('[data-act="' + act + '"]'); };
    const sends = () => p.posts.filter((x) => /\/all\/maker\/drafts\//.test(x.route));
    /* 1 */
    await tap(btn(T(1), "draft.approve"));
    const a1 = [btn(T(1), "draft.approve").getAttribute("aria-pressed"), cardOf(T(1)).classList.contains("ap--a")];
    await tap(btn(T(1), "draft.reject"));
    const r1 = [btn(T(1), "draft.approve").getAttribute("aria-pressed"), btn(T(1), "draft.reject").getAttribute("aria-pressed"), cardOf(T(1)).classList.contains("ap--r")];
    await tap(btn(T(1), "draft.reject"));
    const c1 = [btn(T(1), "draft.reject").getAttribute("aria-pressed"), cardOf(T(1)).classList.contains("ap--r")];
    const claim = cardOf(T(5));
    ok(J(a1) === J(["true", true]) && J(r1) === J(["false", "true", true]) && J(c1) === J(["false", false]) && sends().length === 0
      && !!claim && !claim.querySelector('[data-act="draft.approve"]') && !claim.querySelector('[data-act="draft.reject"]'),
    "a card's Approve and Reject choose and send nothing, the card lit, the other let go, a second tap clears; a claim has neither: " + J([a1, r1, c1, sends().length]));
    /* 2 */
    const head = p.d.querySelector("#makerDrafts .aphead");
    ok(/^3 to decide/.test(t(head)), "the head counts the cards that can be decided, the claim and a trip's second row not among them: " + t(head));
    await tap(byAct(p.d, "approve.all"));
    const bar = p.d.getElementById("apBar");
    const allA = [T(1), T(2), T(4)].every((id) => btn(id, "draft.approve").getAttribute("aria-pressed") === "true");
    await tap(btn(T(4), "draft.reject"));
    const line = t(bar.querySelector(".apbar__line"));
    ok(allA && !bar.hidden && line === "2 approve · 1 reject", "Approve all chooses Approve on every card that can go; the bar counts both ways: " + J([allA, line]));
    await tap(byAct(p.d, "approve.clear"));
    ok(bar.hidden && [T(1), T(2), T(4)].every((id) => btn(id, "draft.approve").getAttribute("aria-pressed") === "false"), "Clear lets every choice go and hides the bar");
    /* 3 */
    await tap(byAct(p.d, "approve.all")); await tap(btn(T(4), "draft.reject"));
    await tap(byAct(p.d, "approve.confirm"));
    const sheet = p.d.getElementById("ynSheet");
    const sheetText = t(sheet);
    ok(!!sheet && t(p.d.getElementById("ynT")) === "Decide 3 cards?" && /2 to approve.*1 to reject/.test(sheetText) && t(p.d.getElementById("ynGo")) === "Confirm 3"
      && /One that cannot go stays here with why and how to fix it; the rest go\./.test(sheetText) && sends().length === 0,
    "Confirm asks once, every card under to approve and to reject, and nothing goes before the yes: " + sheetText.slice(0, 200));
    answer = { ok: true, decided: [{ id: T(1), decision: "approved" }, { id: T(2), decision: "approved", trip: [T(3)] }, { id: T(3), decision: "approved", withTrip: true }],
      refused: [{ id: T(4), decision: "rejected", error: "already approved", fix: "It was decided on another screen. Nothing to do." }] };
    await tap(p.d.getElementById("ynGo"));
    const sent = sends();
    ok(sent.length === 1 && sent[0].route === "/all/maker/drafts/decide-many" && J(sent[0].body) === J({ approve: [T(1), T(2), T(3)], reject: [T(4)] }),
      "its yes sends one decide-many, every draft of each card, a trip's rows together: " + J(sent));
    /* 4 */
    const done = p.d.querySelector("#makerDrafts .apdone"), gone = cardOf(T(4)), why = gone && gone.querySelector(".aprefused");
    ok(!!done && /^2 decided, 1 refused/.test(t(done)) && /2 approved\. They fold together, one version\./.test(t(done))
      && !!why && /Refused/.test(t(why)) && /Why: already approved/.test(t(why)) && /To fix: It was decided on another screen/.test(t(why)) && gone.classList.contains("ap--r"),
    "the decided cards (a trip one card) are counted at the head and a refused card stays with Refused, why and how to fix it: " + J([t(done), t(why)]));
    /* 5 */
    const css = [...p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.aphead \.salt-ghost,\.adm \.apticks button,\.adm \.apbar button,\.adm \.apmore\{min-height:44px\}/.test(css)
      && /\.adm \.ap--a\{border-color:var\(--salt-verdigris\)\}\.adm \.ap--r\{border-color:var\(--salt-ember\)\}/.test(css)
      && /\.adm \.apreject--on\{color:var\(--salt-ember\);border-color:var\(--salt-ember\)\}/.test(css),
    "44px targets, and the choice lit in the system's verdigris and ember");
  } catch (e) { ok(false, "admin-decide-many stopped on an error: " + (e && e.stack)); }
  finally { p.w.close(); }
}
