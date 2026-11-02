/* test/admin-acct-grid.mjs: SALT ADMIN'S OPEN ACCOUNT ON SHOP'S GRID (3 Nov 2026, the account's leftovers after v1378). Each check is red under its own
 * mutation (test/admin-acct-grid.mutations.json):
 *   G1  every group of the open account (Their %, This customer, the reward, Partner, Refunds, Loans and reward, Sign-ins) is a section with no glass card
 *   G2  every group is headed by the mist settings head, and no copper eyebrow heads anything on the card
 *   G3  no ghost stands on the card: Make partner, a loan, a refund's two moves and a device's Sign out are rows of their lists, what ends or removes in ember
 *   G4  the grid: the groups 24px apart on a phone (the card and its more) and in columns from 1080px (24px under each, 24px between the columns)
 *   G5  a device's second line is short enough for one line at 390: kept since the day, used when, no sentence
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const cust = { customer: true, code: "CX1-ZED", rates: [{ rate: 120 }, { rate: 110 }], unitNow: 110, highest: 120, cadence: { every: 9, orders: 4 }, dueIn: 2,
    loyal: { units: 7, every: 20, paused: false }, cost: 56 };
  const rwd = { associate: true, times: 10, rate: 56, step: 560, progress: 380, given: 15, net: 41, unit: null };
  const p = await richOwnerPage({ pageWork,
    inputsAnswer: (j) => ({ ...j, catalog: { ...j.catalog,
      products: [{ product: "salt", drift: true, saleReady: true }], driftCustomers: ["CX1-ZED"], partners: [], partnerWaiting: [],
      driftCards: [{ code: "CX1-ZED", product: "salt", held: false, value: null, current: 0, suggest: null, why: "" }],
      openRefunds: [{ party: "CX1-ZED", since: "2026-10-01", amount: 40 }], editWaiting: [] } }),
    extra: (route) => {
      if (/^\/all\/maker\/drift-preview\//.test(route)) return { ok: true, preview: { rows: [] } };
      if (route === "/all/maker/customer-of/CX1-ZED") return { ok: true, reading: cust };
      if (route === "/all/maker/reward-of/CX1-ZED") return { ok: true, reading: rwd };
      return undefined;
    } });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "accounts"); await p.work.quiet();
    await click([...d.querySelectorAll("#rlist [data-u]")].find((c) => t(c.querySelector(".acode")) === "CX1-ZED").querySelector('[data-act="acct.open"]'));
    const a = d.querySelector("#aopen .oacct");
    if (!a) { ok(false, "the account opens"); return; }
    const want = ["apct", "acust", "arwd", "apart", "arefund", "abooks", "astory"];
    const groups = want.map((k) => a.querySelector(".asec." + k));
    /* G1 */
    ok(groups.every((g) => g && !g.hidden && g.tagName === "SECTION" && !g.className.includes("glass")) && !a.querySelector(".asec:not(.ahead).salt-glass-card"),
      "G1: every group of the open account is a section with no glass card: " + J(want.map((k, i) => groups[i] ? groups[i].tagName + "." + groups[i].className : null)));
    /* G2 */
    const heads = groups.map((g) => g && g.firstElementChild);
    ok(heads.every((h) => h && h.tagName === "H2" && h.classList.contains("salt-settings__head")) && !a.querySelector(".asec:not(.ahead) h3, .asec:not(.ahead) .salt-eyebrow--copper"),
      "G2: each group is headed by the mist settings head and no copper eyebrow heads any: " + J(heads.map((h) => h && h.tagName + "." + h.className + ":" + t(h))));
    /* G3 */
    const row = (e) => !!e && e.classList.contains("salt-settings__row--action") && !!e.closest(".salt-settings");
    const ember = (e) => row(e) && e.classList.contains("salt-settings__row--danger");
    const mk = a.querySelector('[data-act="acct.partner"]'), loan = a.querySelector('[data-act="acct.repay"]'), dev = a.querySelector('[data-act="acct.device-signout"]');
    const paid = a.querySelector('[data-act="acct.refund"][data-key$=":refundPaid"]'), stale = a.querySelector('[data-act="acct.refund"][data-key$=":refundRemove"]');
    const ghosts = [...a.querySelectorAll(".salt-ghost")].filter((g) => !g.hidden).map(t);
    ok(!ghosts.length && row(mk) && row(loan) && row(paid) && !ember(paid) && ember(stale) && ember(dev),
      "G3: no ghost on the card; Make partner, a loan and a refund's moves are rows, Remove as stale and a device's Sign out in ember: " + J({ ghosts, mk: !!mk && mk.className, loan: !!loan && loan.className, stale: !!stale && stale.className, dev: !!dev && dev.className }));
    /* G4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    ok(/\.adm \.oacct\{display:flex;flex-direction:column;gap:24px\}/.test(css) && /\.adm \.amore\{display:flex;flex-direction:column;gap:24px\}/.test(css)
      && /\.adm #aopen \.oacct\{display:block;column-count:2;column-gap:24px\}/.test(css)
      && /\.adm #aopen \.oacct>\*,\.adm #aopen \.oacct \.amore>\*\{break-inside:avoid;margin:0 0 24px\}/.test(css),
      "G4: the groups stand 24px apart in one column and in two, 24px between the columns");
    /* G5 */
    const sub = t(dev && dev.previousElementSibling && dev.previousElementSibling.querySelector(".salt-settings__sub"));
    ok(/^(Kept since [0-9]{2} [A-Z][a-z]{2} [0-9]{4}, used |Not kept, signed in )/.test(sub) && sub.length <= 40 && !/[.]$/.test(sub),
      "G5: a device's second line is its kept day and last use, short, no sentence: " + J(sub));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.stack)); } finally { p.w.close(); }
}
