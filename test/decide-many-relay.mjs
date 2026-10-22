/* test/decide-many-relay.mjs: MULTI-TICK APPROVE, P2, THE COUNTER'S RELAY (22 Oct 2026; docs/plan-approve-many.html).
 * What is proved here, each check red under its own mutation (test/decide-many-relay.mutations.json), through the real Counter maker
 * and the real Desk over SQLite (test/maker-trades.mjs world):
 *   1  his Confirm reaches the Desk's decide-many with exactly the lists he sent, and the Desk's answer comes back as it came
 *   2  only the verified owner, and by POST; the practice surface has no such road
 *   3  the body is checked before the Desk is called: lists of stamped ids, 1 to 50 in all, none twice, nothing else */
import { handleMaker } from "../stmt/maker.js";
import { world } from "./maker-trades.mjs";

const J = JSON.stringify;
const P = "/all/maker/drafts/decide-many";

export async function run({ ok }) {
  const wd = world();
  for (const [i, party] of [[0, "CX1-ZED"], [1, "AX1-ZED"]]) {
    const r = await wd.call("/all/maker/inputs/sale", { at: "2099-10-05T01:0" + i + ":00.000Z", product: "salt", party, date: "2099-10-05", qty: 1, total: 130 + 10 * i, cash: 0, movedUnits: 0 });
    await r.json();
  }
  const ids = wd.drafts().map((d) => d.id);
  /* 1 */
  const n0 = wd.calls.length;
  const res = await wd.call(P, { approve: [ids[1]], reject: [ids[0]] }), b = await res.json();
  const st = Object.fromEntries(wd.drafts().map((d) => [d.id, d.status]));
  ok(res.status === 200 && b.ok && J(b.decided.map((d) => [d.id, d.decision])) === J([[ids[0], "rejected"], [ids[1], "approved"]]) && J(b.refused) === "[]"
    && wd.calls.slice(n0).includes("/_internal/maker/drafts/decide-many") && st[ids[0]] === "rejected" && st[ids[1]] === "approved",
  "his Confirm reaches the Desk's decide-many with his lists, and its answer comes back as it came: " + J([res.status, b, wd.calls.slice(n0)]));
  /* 2 */
  const n1 = wd.calls.length;
  const stranger = await wd.call(P, { approve: [ids[0]] }, { email: "someone@example.test" });
  const get = await handleMaker(new Request("https://counter.test" + P), wd.desk.COUNTER_MAKER_KEY ? { COUNTER_MAKER_KEY: wd.desk.COUNTER_MAKER_KEY, DESK_MAKER: { fetch() { throw new Error("called"); } } } : {}, P, { email: "maakmal97@icloud.com" });
  const practice = await handleMaker(new Request("https://counter.test" + P, { method: "POST", body: J({ approve: [ids[0]] }) }), { COUNTER_MAKER_KEY: "k".repeat(40) }, P, { email: "maakmal97@icloud.com" }, { test: true });
  ok(stranger.status === 403 && get.status === 405 && practice.status === 404 && wd.calls.length === n1,
    "only the verified owner, by POST, and not on the practice surface; none reaches the Desk: " + J([stranger.status, get.status, practice.status]));
  /* 3 */
  const T = (i) => new Date(Date.UTC(2099, 9, 5, 2, 0, i)).toISOString();
  const bodies = [{}, { approve: [] }, { approve: T(1) }, { approve: [T(1)], extra: true }, { approve: [T(1)], reject: [T(1)] }, { approve: ["2099-10-05"] },
    { approve: Array.from({ length: 51 }, (_, i) => new Date(Date.UTC(2099, 9, 5, 2, 0, 0, i)).toISOString()) }];
  const n2 = wd.calls.length, said = [];
  for (const body of bodies) said.push((await wd.call(P, body)).status);
  ok(said.every((s) => s === 400) && wd.calls.length === n2, "a body that is not lists of 1 to 50 stamped ids, each once, is refused before the Desk: " + J(said));
}
