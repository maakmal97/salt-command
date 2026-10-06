import { openMaster } from "../tools/payload.mjs";

export async function run({ ok }) {
  const { w } = await openMaster();
  const rd = (e) => JSON.parse(w.eval("JSON.stringify(" + e + ")"));
  const J = JSON.stringify;
  const count = (h, n) => h.split(n).length - 1;

  const mk = (sev, kind, title, rm, why) => ({ sev, kind, title, rm, why, tab: "x", books: [] });
  const merged = rd(`mergeActs(${J([
    mk("now", "collect", "Chase AB3-XY for RM 100", 100, "late"),
    mk("now", "rule", "AB3-XY breaks 1 rule", 5, "cap"),
    mk("now", "collect", "Chase CD4-ZZZ for RM 50", 50, "late"),
    mk("soon", "collect", "Chase AB3-XY for RM 7", 7, "late"),
    mk("now", "buy", "Buy: short", 900, "stock"),
  ])})`);
  const ab = merged.filter((x) => x.sev === "now" && (x.title.includes("AB3-XY")));
  ok(ab.length === 1 && ab[0].parts.length === 2 && ab[0].rm === 105, "one party's items in one severity read as one row with the sum: " + J(merged.map((x) => x.title)));
  ok(merged.some((x) => x.sev === "soon" && x.title.includes("AB3-XY")), "and the same party in another severity stays a row of its own");
  ok(merged.some((x) => x.title === "Buy: short"), "an item naming no party is never merged");
  ok(rd(`allActionsNow().filter(x=>x.kind==='multi').every(x=>x.parts.length>=2&&Math.abs(x.rm-x.parts.reduce((t,p)=>t+p.rm,0))<0.01)`),
    "a merged row's figure is the sum of its parts");

  const same = rd(`mergeActs(${J([
    mk("watch", "reconnect", "Revive AB3-XY", 10, "same words"),
    mk("watch", "reconnect", "Revive CD4-ZZ", 20, "same words"),
  ])})`);
  ok(same.length === 1 && same[0].parts.length === 2 && same[0].rm === 30, "the same warning on two parties is one row, its figure the sum: " + J(same.map((x) => x.title)));

  const b = rd(`mergeBoundaryRows(${J([
    { sev: "breach", who: "AB3-XY", rule: "Credit cap", what: "over" },
    { sev: "breach", who: "AB3-XY", rule: "Credit age", what: "old" },
    { sev: "breach", who: "CD4-ZZ", rule: "Credit cap", what: "over" },
    { sev: "breach", who: "AB3-XY", rule: "Credit age", what: "old" },
    { sev: "breach", who: "EF5-QQ", rule: "Credit cap", what: "over" },
    { sev: "breach", who: "stock", rule: "Free to sell", what: "none" },
  ])})`);
  ok(b.length === 3 && b.some((r) => r.who === "CD4-ZZ, EF5-QQ") && b.filter((r) => r.who.includes("AB3-XY")).length === 1 && b[0].rules.includes("Credit cap") && b[0].rules.includes("Credit age"),
    "a party's boundary rows are one row listing each rule once: " + J(b));
  ok(b.some((r) => r.rules === "Free to sell"), "a row naming no party keeps its own row");

  const rec = () => String(w.eval("tabReceivables()"));
  const before = count(rec(), "CR3-DAM");
  const base = rd("arList.filter(s=>s.customer==='CR3-DAM').length");
  ok(base >= 2, "the book has a customer on several open rows: " + base);
  const cash = rec().split(/<details class="obsec"/).find((s) => /^ open><summary>Cash owed to you/.test(s)) || "";
  ok(count(cash, "CR3-DAM") === 1 && count(cash, "CN3-WM") === 1, "the Order book lists each customer once in Cash owed to you");
  const grossNum = rd("arList.filter(s=>s.customer==='CR3-DAM').reduce((t,s)=>t+outstandingOf(s),0)");
  ok(cash.includes(String(Math.round(grossNum))) || cash.replace(/,/g, "").includes(String(Math.round(grossNum))), "that row carries the sum of the customer's rows: " + grossNum);
  ok(before >= 1, "the customer still appears");
}
