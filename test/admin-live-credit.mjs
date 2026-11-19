/* test/admin-live-credit.mjs: AN ACCOUNT'S CREDIT ON SALT ADMIN IS THE DESK'S, NOT THE SEALED STATEMENT'S (20 Nov 2026, his yes after CM4-TO's
 * and CD4-DAM's credits stood four minutes past his Approve, waiting on the publish). The account list reads each credit off the Desk's open
 * refunds (/all/maker/inputs, catalog.openRefunds), the sealed figure standing only while the Desk names none.
 *   L1  a refund the statement still carries but the Desk has closed: the card says no Credit and no sum
 *   L2  a refund the Desk holds that the statement has not sealed yet: the card says Credit and its sum, matched by the exact code
 *   L3  a Desk answer that names no refunds: the sealed credit stands
 *   L4  an account that owes and holds a credit says Owed first, as the publish's own order does
 *   L5  the Desk's read alone, with no new sheet, takes a closed credit off the card
 * Every assertion is red under its own mutation (test/admin-live-credit.mutations.json). */
import { richOwnerPage, enter } from "./maker-act.mjs";

const J = JSON.stringify;
export async function run({ ok, pageWork }) {
  const acct = (u, code, t, flag) => ({ username: u, code, account: true, t: Object.assign({ owed: 0, toGet: 0, refund: 0, pend: 0 }, t), flag,
    seen: { opens: 1, last: "2026-10-10T02:00:00.000Z", how: "link" }, sent: "2026-10-10T02:00:00.000Z", issued: "2026-10-01" });
  const open = async (refunds) => {
    const now = { refunds };
    const p = await richOwnerPage({ pageWork, probe: true,
      sheetAnswer: (j) => ({ ...j, accounts: [
        acct("1111-0001", "CL1-AAA", { refund: 800 }, "refund"),
        acct("1111-0002", "CL2-BBB", {}, "clear"),
        acct("1111-0003", "CL3-CCC", { owed: 70, refund: 20 }, "owes")] }),
      inputsAnswer: (j) => { const c = { ...j.catalog }; if (now.refunds === undefined) delete c.openRefunds; else c.openRefunds = now.refunds; return { ...j, catalog: c }; } });
    p.now = now;
    await p.work.quiet(); enter(p.d, "customers", "accounts"); await p.work.quiet(); await p.work.quiet();
    return p;
  };
  const card = (p, code) => { const r = [...p.d.querySelectorAll("#rlist [data-u]")].find((c) => (c.querySelector(".acode") || {}).textContent === code); return r ? r.textContent.replace(/\s+/g, " ") : ""; };

  let p = await open([{ party: "CL2-BBB", since: "2026-11-19", amount: 40 }, { party: "CL2-BBB-R", since: "2026-11-19", amount: 5 }, { party: "CL3-CCC", since: "2026-11-01", amount: 20 }]);
  try {
    const a = card(p, "CL1-AAA"), b = card(p, "CL2-BBB"), c = card(p, "CL3-CCC");
    ok(a && !/Credit/.test(a) && !/800/.test(a), "L1: a refund the Desk has closed leaves the card: " + J(a));
    ok(/Credit/.test(b) && /RM 40(?![\d.])/.test(b), "L2: a refund the Desk holds shows at once, by the exact code: " + J(b));
    ok(/Owed/.test(c) && !/Credit/.test(c), "L4: an account that owes says Owed before its credit: " + J(c));
    /* L5: the Desk's read alone, the sheet unchanged, takes a credit off the card at once */
    p.now.refunds = [{ party: "CL3-CCC", since: "2026-11-01", amount: 20 }];
    p.w.__owner("loadOwed()"); await p.work.quiet(); await p.work.quiet();
    const b2 = card(p, "CL2-BBB");
    ok(b2 && !/Credit/.test(b2), "L5: a refund closed on the Desk leaves the card at the Desk's next read, the sheet unread: " + J(b2));
  } catch (x) { ok(false, "L1 stopped on an error: " + (x && x.stack)); } finally { p.w.close(); }

  p = await open(undefined);
  try {
    const a = card(p, "CL1-AAA");
    ok(/Credit/.test(a) && /800/.test(a), "L3: with no refunds named by the Desk, the sealed credit stands: " + J(a));
  } catch (x) { ok(false, "L3 stopped on an error: " + (x && x.stack)); } finally { p.w.close(); }
}
