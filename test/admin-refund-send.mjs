/* test/admin-refund-send.mjs: A REFUND'S TWO MOVES REACH THE DESK (20 Nov 2026, his word on CM4-TO's and CD4-DAM's credits: "please remove it").
 * Mark paid today and Remove as stale on an open account sent nothing from 03 Nov 2026: each tap kept the entry on the phone first, and the
 * check on a kept entry (the engine's vaultPendingOk) names no `edit` path, so it threw "This saved entry cannot be sent. Discard it." before
 * any request left. They now send as the market's edits do, straight to the Desk, which files them for his Approve.
 *   R1  Remove as stale, tapped twice, posts one edit: refundRemove with the refund's party, day and amount, and says it waits for Approve
 *   R2  Mark paid today, tapped twice, posts one edit: refundPaid with today's Kuala Lumpur day
 *   R3  one tap alone sends nothing, and nothing is kept on the phone
 * Every assertion is red under its own mutation (test/admin-refund-send.mutations.json). */
import { richOwnerPage, enter } from "./maker-act.mjs";

const J = JSON.stringify;
export async function run({ ok, pageWork }) {
  const open = async () => {
    const p = await richOwnerPage({ pageWork,
      inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog, openRefunds: [{ party: "CX1-ZED", since: "2026-10-01", amount: 40 }], editWaiting: [] } }),
      extra: (route) => route === "/all/maker/inputs/edit" ? { ok: true, queued: true } : undefined });
    await p.work.quiet();
    enter(p.d, "customers", "accounts"); await p.work.quiet();
    const row = [...p.d.querySelectorAll("#rlist [data-u]")].find((c) => (c.querySelector(".acode") || {}).textContent === "CX1-ZED");
    if (row) { row.querySelector('[data-act="acct.open"]').click(); await p.work.quiet(); await p.work.quiet(); }
    return p;
  };
  const edits = (p) => p.posts.filter((x) => x.route === "/all/maker/inputs/edit").map((x) => x.body);
  const tap = async (p, kind, n) => { for (let i = 0; i < n; i++) { const b = p.d.querySelector('[data-act="acct.refund"][data-key$=":' + kind + '"]'); if (b) b.click(); await p.work.quiet(); await p.work.quiet(); } };
  const said = (p) => { const s = p.d.querySelector("section.arefund [role=status]"); return s ? s.textContent : ""; };
  const kept = (p) => { const out = []; for (let i = 0; i < p.w.localStorage.length; i++) { const k = p.w.localStorage.key(i); if (/^saltMakerPending:.*inputs[/]edit/.test(k)) out.push(k); } return out; };

  let p = await open();
  try {
    /* R3 */
    await tap(p, "refundRemove", 1);
    ok(p.d.querySelector("section.arefund") && edits(p).length === 0 && kept(p).length === 0, "R3: one tap alone sends nothing and keeps nothing: " + J([edits(p), kept(p)]));
    /* R1 */
    await tap(p, "refundRemove", 1);
    const e = edits(p);
    ok(e.length === 1 && e[0].kind === "refundRemove" && e[0].party === "CX1-ZED" && e[0].since === "2026-10-01" && e[0].amount === 40 && typeof e[0].at === "string",
      "R1: Remove as stale, tapped twice, sends one edit naming the refund: " + J(e));
    ok(/comes off the book once you approve it/.test(said(p)) && !/cannot be sent/.test(said(p)), "R1: and says it waits for Approve, never that it cannot be sent: " + J(said(p)));
  } catch (x) { ok(false, "R1 stopped on an error: " + (x && x.stack)); } finally { p.w.close(); }

  p = await open();
  try {
    /* R2 */
    await tap(p, "refundPaid", 2);
    const e = edits(p), today = new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10);
    ok(e.length === 1 && e[0].kind === "refundPaid" && e[0].paidOn === today && e[0].amount === 40 && /marked paid once you approve it/.test(said(p)),
      "R2: Mark paid today sends one edit with today's Kuala Lumpur day: " + J([e, said(p)]));
  } catch (x) { ok(false, "R2 stopped on an error: " + (x && x.stack)); } finally { p.w.close(); }
}
