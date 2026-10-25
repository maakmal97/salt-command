/* test/admin-cust-assoc.mjs: SALT ADMIN CUSTOMERS, P7, ASSOCIATES (26 Oct 2026; canvas Salt Admin Customers). Each check is red under its own mutation
 * (test/admin-cust-assoc.mutations.json):
 *   1  a book is its typed tag and how many associates, no other word for it
 *   2  an associate's card: Bought, Sold and Introduced right-aligned, the reward on a tiered book the system's Meter (units left, the way to the next)
 *   3  the same book as one plain table, shown from 860px with the cards hidden, a row an associate
 *   4  the code opens the associate's account under Accounts
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, enter } from "./maker-act.mjs";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";
import { JSDOM } from "jsdom";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

function pageRules() {
  const html = landingPage("", "assoc-nonce", { master: "fixture-master", accounts: [] });
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1].slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
  const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
  const out = [];
  const walk = (rules, media) => { for (const r of rules) { if (r.selectorText) out.push([media + r.selectorText, r.style]); if (r.cssRules) walk(r.cssRules, r.conditionText ? "@" + r.conditionText + " " : media); } };
  walk(sheet.cssRules, "");
  return out;
}

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, assocAnswer: (j) => ({ ...j, products: [
    { product: "salt", rows: [{ id: "CX1-ZED", founder: true, rank: 1, stars: 3, bought: 2480, soldFor: 1150, introduced: 640, onward: 3, reward: { earned: 3, taken: 1, left: 1.4, next: 0.8 } }] },
    { product: "oil", rows: [{ id: "CX9-NOAC", rank: 2, bought: 360, soldFor: 96, introduced: 0 }] }] }) });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "associates"); await p.work.quiet();
    /* 1 */
    const heads = [...d.querySelectorAll("#clist .aprodhead")];
    ok(heads.length === 2 && J(heads.map((h) => [t(h.querySelector("h2 .salt-producttag")), t(h.querySelector(".salt-status"))])) === J([["Salt", "1 associate"], ["Oil", "1 associate"]])
      && heads.every((h) => t(h.querySelector("h2")) === t(h.querySelector("h2 .salt-producttag"))),
      "a book is its typed tag and how many: " + J(heads.map(t)));
    /* 2 */
    const card = d.querySelector("#clist .aclist .acard"), cells = [...card.querySelectorAll(".acell")].map(t), m = card.querySelector(".salt-meter");
    ok(J(cells) === J(["BoughtRM 2,480.00", "SoldRM 1,150.00", "IntroducedRM 640.00"]) && !!m && t(m.querySelector(".salt-meter__line")) === "Reward 1.4 left80% to next"
      && m.style.getPropertyValue("--salt-fill") === "80" && !card.querySelector(".pbar") && !d.querySelectorAll("#clist .aclist .acard")[1].querySelector(".salt-meter"),
      "a card's figures and the reward as a Meter on salt alone: " + J([cells, m && t(m)]));
    /* 3 */
    const tables = [...d.querySelectorAll("#clist .atable table.salt-table--plain")];
    const row = tables[0] && [...tables[0].querySelectorAll("tbody tr")[0].children].map(t);
    const R = pageRules(), rule = (sel) => (R.find((x) => x[0] === sel) || [, null])[1];
    const wide = rule("@(min-width:860px) .adm .atable"), list = rule("@(min-width:860px) .adm .aclist"), base = rule(".adm .atable");
    ok(tables.length === 2 && J(row) === J(["CX1-ZED", "founder · #1 · ★★★", "RM 2,480.00", "RM 1,150.00", "RM 640.00", "Reward 1.4 left80% to next"])
      && J([...tables[0].querySelectorAll("thead th")].map(t)) === J(["Associate", "Standing", "Bought", "Sold", "Introduced", "Reward, units"])
      && !!base && base.getPropertyValue("display") === "none" && !!wide && wide.getPropertyValue("display") === "block" && !!list && list.getPropertyValue("display") === "none",
      "the same book is one plain table from 860px, the cards hidden there: " + J(row));
    /* 4 */
    await click(d.querySelector('#clist .aclist [data-act="assoc.open"]'));
    ok(!d.getElementById("oAccts").hidden && !!d.querySelector('#aopen [data-acct="abcd-efgh"]'), "the code opens the associate's account");
  } finally { p.w.close(); }
}
