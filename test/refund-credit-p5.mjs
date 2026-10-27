/* test/refund-credit-p5.mjs: THEIR CREDIT ON SALT ADMIN (27 Oct 2026, docs/plan-refund-credit.html P5). The Accept card says "Less RM 25.00 credit" off
 * the Desk's own preview, and nothing when the Desk spends none; an order's open refund reads as their credit, spent at his next Accept. Driven in
 * the actual owner script (the maker-placed-preview harness); each check proved red by its own mutation (test/refund-credit-p5.mutations.json). */
import { webcrypto } from "node:crypto";
import { cardOf } from "./maker-act.mjs";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

export async function run({ ok }) {
  const orderOf = (id, patch = {}) => ({ id, u: "abcd-efgh", product: "salt", qty: 2, total: 200, status: "placed", mode: "collect", history: [], ...patch });
  const ids = ["20261027090001-crd", "20261027090002-crd"];
  const reviewBody = { ok: true, drafts: [], orders: ids.map((id) => orderOf(id)) };
  const preview = (path, body) => Object.assign({ cost: { unit: 80, total: 160, source: "purchase" }, ok: true, quote: 200, delivery: 0, hash: "h-" + path.length,
    row: { qty: 2, total: 200 }, card: 200, floor: { rm: 150, at: 2, exact: true }, margin: { rm: 40, pct: 20 }, usual: null, flags: [], prepay: false, owedWith: 175, ceiling: 500 },
    path.includes(ids[0]) ? { credit: 25 } : {});
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder; window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).endsWith("/preview")) return Response.json(preview(String(path), JSON.parse(init.body)));
        if (path === "/all/maker/review") return Response.json(reviewBody);
        if (path === "/all/maker/claims") return Response.json({ ok: true, claims: [] });
        if (path === "/all/maker/threads") return Response.json({ ok: true, threads: [] });
        if (path === "/all/maker/bulletin") return Response.json({ ok: true, bulletin: { lines: [] } });
        if (path === "/all/maker/inputs") return Response.json({ ok: true, catalog: { products: [], parties: [], loans: [], rewards: [], ledger: [] } });
        if (path === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
        return Response.json({ ok: true, accounts: [] });
      };
    }
  });
  try {
    const doc = browser.window.document;
    const until = async (p) => { for (let i = 0; i < 200 && !p(); i++) await new Promise((r) => setTimeout(r, 10)); return !!p(); };
    doc.querySelector('[data-act="nav.orders"]').click();
    await until(() => doc.querySelector('[data-act="order.open"]'));
    const opened = async (id) => {
      const row = [...doc.querySelectorAll('[data-act="order.open"]')].find((b) => (b.getAttribute("data-key") || "").includes(id) || (b.closest("[data-order]") && b.closest("[data-order]").getAttribute("data-order") === id));
      if (row && !cardOf(doc, id)) row.click();
      await until(() => cardOf(doc, id) && cardOf(doc, id).querySelector("[data-accept]"));
      return cardOf(doc, id);
    };
    const c1 = await opened(ids[0]);
    const line = c1 && c1.querySelector("[data-credit]");
    ok(!!line && /^Less RM 25\.00 credit: their open refunds, paid on this order now and closed when it folds\.$/.test(line.textContent),
      "the Accept card says Less RM 25.00 credit, the Desk's own figure: " + (line ? line.textContent : c1 ? c1.textContent.slice(0, 300) : "no card"));
    const c2 = await opened(ids[1]);
    ok(!!c2 && !c2.querySelector("[data-credit]"), "and nothing on an order the Desk spends no credit on");
  } finally { browser.window.close(); }
}
