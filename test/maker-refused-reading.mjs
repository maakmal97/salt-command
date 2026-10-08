import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { landingPage } from "../stmt/page.js";

export async function run({ ok }) {
  const browser = new JSDOM(landingPage("", "refused-reading", { master: "fixture-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        if (init?.method === "POST") throw new Error("A read-only refusal attempted a write.");
        if (String(path) === "/all/maker/review") return Response.json({ ok: true, orders: [], drafts: [{
          id: "d1", status: "pending", product: "salt", qty: 1, total: 100, entry: {},
          row: { customer: "CX1-AB", qty: 1, total: 100, cost: 50 }, flags: []
        }], refused: [{
          id: "2026-08-29T02:00:00.000Z", why: "A Linked amendment needs a figure.",
          source: "cloud-drafter", seenAt: "2026-08-29T02:00:01.000Z"
        }] });
        if (String(path) === "/all/maker/inputs") return Response.json({ ok: true, products: ["salt"], catalog: {
          products: [{ product: "salt", tiered: false }], parties: [], associates: [], loans: [], rows: [], tierNames: [],
          tierCustomers: [], correctionFields: []
        } });
        if (String(path) === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
        return Response.json({ ok: true, claims: [], threads: [], bulletin: { lines: [] }, accounts: [] });
      };
    }
  });
  try {
    const document = browser.window.document;
    document.querySelector('[data-m="maker"]').click();
    const cards = () => [...document.querySelectorAll("#makerReview .maker-card")];
    for (let count = 0; count < 200 && cards().length < 2; count++) await new Promise((resolve) => setTimeout(resolve, 10));
    const refused = cards().filter((card) => card.querySelector("h3")?.textContent === "Refused entry");
    const card = refused[0];
    ok(refused.length === 1, "Counter review draws one card for each refused entry");
    ok(card?.textContent.includes("A Linked amendment needs a figure."),
      "Counter refusal reading states the drafter's reason");
    ok(card?.textContent.includes("cloud-drafter"),
      "Counter refusal reading names the drafter that saw the entry");
    ok(card?.textContent.includes("29 Aug 2026") && !card.textContent.includes("T02:00:01"),
      "Counter refusal reading shows the seen day rather than its timestamp");
    ok(card && card.querySelectorAll('button,input,select,textarea,a,[tabindex]:not([tabindex="-1"])').length === 0,
      "Counter refusal reading has no write control or keyboard decision target");
    const draft = cards().find((item) => item.querySelector("h3")?.textContent === "d1");
    const decisions = draft && [...draft.querySelectorAll("button")].map((button) => button.textContent);
    ok(decisions?.includes("Approve row") && decisions.includes("Reject row"),
      "the draft beside the refusal retains both decisions while the refusal has none");
  } finally { browser.window.close(); }
}
