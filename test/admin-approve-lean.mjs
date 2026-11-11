/* test/admin-approve-lean.mjs: SALT ADMIN'S APPROVE, LEANER (12 Nov 2026, his review of the Approve card and his "Yes, build all six").
 * What is proved here, each check red under its own mutation (test/admin-approve-lean.mutations.json), on the owner page in jsdom (test/maker-act.mjs):
 *   L1  a Their % card says what it sets: the book's tag and the figure as the stepper says it, what it was where the drafter's flag says it moves,
 *       the verb Their %, no RM 0.00, and its Approve names the figure
 *   L2  an entry with no size and no sum draws the first sentence of the drafter's reading, never RM 0.00
 *   L3  approvals alone go on Confirm: no Sheet, one decide-many; a Reject among the picks still asks on the Sheet, whose row for a Their % card
 *       says the figure and no RM 0.00
 *   L4  Approve all stands from two cards, not beside one, and passes over a card the Desk refused
 *   L5  the list's lead counts nothing beside the head and is not drawn while empty; the queue fold is not drawn while nothing is sent
 *   L6  the bar counts "to approve" and "to reject" */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const TIER = { id: "2026-11-12T01:00:00.000Z", status: "pending", collection: "tierset", party: "CJ4-BJ",
  entry: { type: "TIER", party: "CJ4-BJ", date: "2026-11-12" }, row: { tiers: { "CJ4-BJ": { salt: -0.2 } }, unit: "band" },
  flags: ["CJ4-BJ's Salt moves from 10% off to 20% off."],
  reasoning: "Sets their % for 1 customer: CJ4-BJ Salt 20% off. It moves no cash and no stock; a % lift moves that customer's own price and never the board." };
const NOTE = { id: "2026-11-12T02:00:00.000Z", status: "pending", collection: "places", party: "CX1-ZED",
  entry: { type: "PLACE", party: "CX1-ZED", date: "2026-11-12" }, row: { code: "CX1-ZED" }, flags: [],
  reasoning: "Files CX1-ZED's place on the map. Nothing else moves." };

export async function run({ ok, pageWork }) {
  const open = (drafts, queue) => richOwnerPage({ pageWork, bare: true,
    review: (j) => ({ ...j, orders: [], drafts: drafts.map((d) => JSON.parse(J(d))), queue, trips: [], sameDay: [], rows: [] }),
    extra: (route) => (route === "/all/maker/drafts/decide-many" ? { ok: true, decided: [], refused: [] } : undefined) });
  const go = async (p, n) => { n.click(); await p.work.quiet(); };
  const cardOf = (p, id) => p.d.querySelector('[data-maker-card="draft:' + id + '"]');
  const many = (p) => p.posts.filter((x) => x.route === "/all/maker/drafts/decide-many");
  const sheet = (p) => p.d.getElementById("ynSheet");

  /* one Their % card alone, nothing sent */
  let p = await open([TIER], []);
  try {
    await p.work.quiet();
    await go(p, byAct(p.d, "nav.orders")); await go(p, byAct(p.d, "part.orders.approve"));
    const c = cardOf(p, TIER.id), line = c && c.querySelector(".aptier");
    /* L1 */
    ok(!!line && !!line.querySelector(".salt-producttag--salt") && t(line) === "Salt −20%, was −10%" && t(c.querySelector(".apverb")) === "Their %" && !/RM 0\.00/.test(t(c)),
      "L1 a Their % card says the book and the figure as the stepper says it, what it was, the verb Their %, and no RM 0.00: " + J([t(line), t(c && c.querySelector(".apverb"))]));
    ok(t(byAct(c, "draft.approve")) === "Approve −20%", "L1 and its Approve names the figure: " + t(byAct(c, "draft.approve")));
    /* L4 */
    const head = p.d.querySelector("#makerDrafts > .aphead");
    ok(!!head && /^1 to decide/.test(t(head)) && !byAct(head, "approve.all"), "L4 with one card the head counts it and offers no Approve all: " + t(head));
    /* L5 */
    const lead = p.d.getElementById("makerDraftStatus"), fold = p.d.getElementById("makerQueue");
    const css = [...p.d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(t(lead) === "" && /\.adm #makerDraftStatus:empty\{display:none\}/.test(css), "L5 the lead says no row count beside the head and is not drawn while empty: " + J(t(lead)));
    ok(!!fold && fold.hidden === true, "L5 with nothing sent the queue fold is not drawn");
    /* L3, L6 */
    await go(p, byAct(c, "draft.approve"));
    ok(t(p.d.querySelector("#apBar .apbar__line")) === "1 to approve", "L6 the bar counts to approve: " + t(p.d.querySelector("#apBar .apbar__line")));
    await go(p, byAct(p.d.getElementById("apBar"), "approve.confirm"));
    ok(!sheet(p) && many(p).length === 1 && J(many(p)[0].body) === J({ approve: [TIER.id], reject: [] }),
      "L3 an approval alone goes on Confirm with no Sheet, one decide-many: " + J(many(p)));
  } catch (e) { ok(false, "admin-approve-lean stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* two cards, a held entry, a Reject among the picks */
  p = await open([TIER, NOTE], [{ id: "q-1", state: "held", canWithdraw: true, fingerprint: "f1" }]);
  try {
    await p.work.quiet();
    await go(p, byAct(p.d, "nav.orders")); await go(p, byAct(p.d, "part.orders.approve"));
    const n = cardOf(p, NOTE.id);
    /* L2 */
    ok(!!n && t(n.querySelector(".apsays")) === "Files CX1-ZED's place on the map." && !/RM 0\.00/.test(t(n)),
      "L2 an entry with no size and no sum says the first sentence of its reading, never RM 0.00: " + t(n && n.querySelector(".apsays")));
    /* L4, L5 */
    ok(!!byAct(p.d.querySelector("#makerDrafts > .aphead"), "approve.all"), "L4 with two cards Approve all stands");
    ok(p.d.getElementById("makerQueue").hidden === false && t(p.d.getElementById("makerQueueCount")) === "1", "L5 with an entry sent the queue fold is drawn and counted");
    /* L3, L6 */
    await go(p, byAct(cardOf(p, TIER.id), "draft.reject")); await go(p, byAct(n, "draft.approve"));
    ok(t(p.d.querySelector("#apBar .apbar__line")) === "1 to approve · 1 to reject", "L6 the bar counts both ways: " + t(p.d.querySelector("#apBar .apbar__line")));
    await go(p, byAct(p.d.getElementById("apBar"), "approve.confirm"));
    const sh = sheet(p);
    ok(!!sh && t(p.d.getElementById("ynT")) === "Decide 2 cards?" && many(p).length === 0, "L3 a Reject among the picks asks on the Sheet, sending nothing as it opens");
    ok(!!sh && /Their %, salt −20%/.test(t(sh)) && !/RM 0\.00/.test(t(sh)), "L3 the Sheet's row for a Their % card says the figure and no RM 0.00: " + t(sh).slice(0, 240));
  } catch (e) { ok(false, "admin-approve-lean stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }

  /* three cards, one refused by the Desk: Approve all stands and passes over it */
  const NOTE2 = { ...NOTE, id: "2026-11-12T03:00:00.000Z", party: "CX2-ZED", entry: { ...NOTE.entry, party: "CX2-ZED" } };
  p = await richOwnerPage({ pageWork, bare: true,
    review: (j) => ({ ...j, orders: [], drafts: [TIER, NOTE, NOTE2].map((d) => JSON.parse(J(d))), queue: [], trips: [], sameDay: [], rows: [] }),
    extra: (route) => (route === "/all/maker/drafts/decide-many" ? { ok: true, decided: [], refused: [{ id: TIER.id, decision: "approved", error: "the book moved", fix: "Look again." }] } : undefined) });
  try {
    await p.work.quiet();
    await go(p, byAct(p.d, "nav.orders")); await go(p, byAct(p.d, "part.orders.approve"));
    await go(p, byAct(cardOf(p, TIER.id), "draft.approve")); await go(p, byAct(p.d.getElementById("apBar"), "approve.confirm"));
    const all = byAct(p.d.querySelector("#makerDrafts > .aphead"), "approve.all");
    if (all) await go(p, all);
    ok(!!all && !cardOf(p, TIER.id).classList.contains("ap--a") && cardOf(p, NOTE.id).classList.contains("ap--a") && cardOf(p, NOTE2.id).classList.contains("ap--a"),
      "L4 with three cards Approve all stands and chooses every card but the one the Desk refused");
  } catch (e) { ok(false, "admin-approve-lean stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
