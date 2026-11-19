/* test/received-stranded.mjs: HIS RECEIVED NEVER STRANDS ON HOW OLD A SNAPSHOT WAS (20 Nov 2026).
 *
 * CZ5-TM's claim of RM 205 (18 Nov 2026): the payment was drafted at book@573 with no flags; a handover folded, and his Received a minute
 * later was previewed at book@574 with "The open-order snapshot was taken at book@573 but the mirror is at book@574, ...". Equal figures,
 * unequal digests: his yes was filed as differing and the row stranded. Proved here, each check red under its own mutation
 * (test/received-stranded.mutations.json):
 *   R1  an amendment's digest leaves out the two snapshot-age flags, pricing and open-order
 *   R2  every other flag, and every figure, still moves it
 *   R3  the pending row's digest (ack) is as it was: the age flags count there
 *   R4  only a flag that IS a snapshot-age flag is left out, never one that quotes the words
 *   R5  his yes, as it stood on 18 Nov, is spent on that row: applyPre answers applied, not differs */
import { stageDigest, rowFlags, applyPre } from "../src/drafter.js";

const J = JSON.stringify;
const OPEN = "The open-order snapshot was taken at book@573 but the mirror is at book@574, so what is outstanding here may be stale.";
const PRICE = "The pricing snapshot was taken at book@572 but the mirror is at book@573, so the cost and floors here may be stale.";
const ADV = "This is an ADVANCE: 2 unit goes out with RM 205 unpaid. Check it against CZ5-TM's credit cap.";
/* the claim's entry as the reconcile queued it, the stored draft beside it */
const entry = () => ({ at: "2026-11-18T17:33:49.425Z", orderId: "20261118172025-jz3hqg", status: "Payment", claim: { at: "2026-11-18T17:33:49.425Z" },
  payload: { mode: "amend", kind: "Fulfilment", direction: "SELL", party: "CZ5-TM", orderKey: "k-fixture", date: "2026-11-19", cash: 205, kg: 0 } });
const draft = (flags) => ({ id: "2026-11-18T17:33:49.425Z", collection: "sales", row: { qty: 2, total: 190, cash: 0 }, flags, amendKind: "Fulfilment" });

export async function run({ ok }) {
  const e = entry();
  const bare = await stageDigest("pay", e, draft([]));
  /* R1 */
  const withOpen = await stageDigest("pay", e, draft([OPEN])), withPrice = await stageDigest("pay", e, draft([PRICE])), both = await stageDigest("pay", e, draft([PRICE, OPEN]));
  ok(bare === withOpen && bare === withPrice && bare === both && J(rowFlags([PRICE, ADV, OPEN])) === J([ADV]),
    "an amendment's digest leaves out how old the pricing and open-order snapshots were, so his Received is not sent to Approve by a fold between the draft and his tap: "
    + J([bare === withOpen, bare === withPrice, bare === both, rowFlags([PRICE, ADV, OPEN]).length]));
  /* R2 */
  const withAdv = await stageDigest("pay", e, draft([ADV, OPEN])), cash200 = await stageDigest("pay", { ...e, payload: { ...e.payload, cash: 200 } }, draft([]));
  ok(withAdv !== bare && withAdv === await stageDigest("pay", e, draft([ADV])) && cash200 !== bare,
    "every other flag and every figure still moves it, so a row that truly changed under him still waits under Approve: " + J([withAdv !== bare, cash200 !== bare]));
  /* R3 */
  const ackRow = { collection: "sales", row: { customer: "CZ5-TM", qty: 2, total: 205, cash: 0 } };
  const ack0 = await stageDigest("ack", { prepay: false }, { ...ackRow, flags: [] }, { v: "book@573", digest: "d" });
  const ack1 = await stageDigest("ack", { prepay: false }, { ...ackRow, flags: [PRICE] }, { v: "book@573", digest: "d" });
  ok(ack0 !== ack1, "the pending row's digest is as it was: its pricing snapshot's age still counts there");
  /* R4 */
  const quoted = "Note: " + OPEN;
  ok(J(rowFlags([quoted])) === J([quoted]) && await stageDigest("pay", e, draft([quoted])) !== bare,
    "only a flag that is a snapshot-age flag is left out, never one that quotes its words: " + J(rowFlags([quoted])));
  /* R5: the yes of 18 Nov 2026 against its row, on a store that records what applyPre writes */
  const runs = [];
  const fake = { prepare: (sql) => ({ bind: (...x) => ({ run: async () => { runs.push(sql.slice(0, 60)); return { meta: { changes: 1 } }; },
    first: async () => null, all: async () => ({ results: [] }) }), first: async () => null, all: async () => ({ results: [] }) }) };
  const yes = { id: "20261118172025-jz3hqg|pay|2026-11-18T17:36:45.927Z", stage: "pay", hash: withOpen, entry_at: e.at,
    shown: J({ from: "ready", figures: { amount: 205, claim: e.at }, flags: [OPEN], waits: false }) };
  const got = await applyPre(fake, yes, { ...draft([]), entry: e }, {});
  ok(got === "applied" && runs.some((s) => /UPDATE draft SET status='approved'/.test(s)) && runs.some((s) => /status='applied'/.test(s)),
    "his Received as it stood on 18 Nov 2026 is spent on its row, approved where it is drafted, not filed as differing: " + J([got, runs.length]));
}
