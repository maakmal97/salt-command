/* Counter Admin: a salt customer's % lift (0 to 2) set/clear through the existing tier-set road, a held zero distinct from none held, and the
   engine's suggestion beside it (18 Oct 2026: nothing automatic prices). */
import { makerInputCatalog, makerTierSet } from "../src/maker-inputs.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { JSDOM } from "jsdom";
import { tileValues } from "./maker-act.mjs";
import { webcrypto } from "node:crypto";
import { contentKey, wrapKey } from "../tools/stmt-crypto.mjs";

const at = "2026-10-01T08:00:00.000Z";
const book = () => ({
  version: 1, sales: [], purchases: [],
  state: {
    PRODUCTS: { salt: { name: "salt" }, oil: { name: "oil" } },
    roster: ["CX1-ZED", "CX2-ZED", "AX1-ZED", "AX1-ZED-R", "SP1-ZED"],
    TIER_OF: { "CX1-ZED": { salt: 0 }, "CX2-ZED": {} },
    PROD_OPENING: { salt: { qty: 0, costPerKg: null }, oil: { qty: 0, costPerKg: null } },
    PEOPLE: { departed: [] }
  },
  pricing: {
    byProduct: {
      salt: { stockCost: 40, lift: { "CX1-ZED": 0, "CX2-ZED": 0 }, suggest: { "CX1-ZED": 0, "CX2-ZED": 0.25 },
        inputs: { policy: { tierRule: { drift: true } } } },
      oil: { stockCost: 8, inputs: { policy: { tierRule: { fixed: true } } } }
    }
  }
});

export async function run({ ok } = {}) {
  const check = ok || ((condition, message) => { if (!condition) throw new Error(message); });
  const mirror = book();
  const catalog = makerInputCatalog(mirror);
  const driftCard = (code, product = "salt") => catalog.driftCards.find((item) => item.code === code && item.product === product);
  check(catalog.products.find((item) => item.product === "salt").drift
    && catalog.products.find((item) => item.product === "oil").fixed,
  "the catalog carries drift and fixed book policy flags from the pricing snapshot");
  check(catalog.driftCards.length === 3 && catalog.driftCards.every((item) => item.product === "salt")
    && !driftCard("AX1-ZED-R") && !driftCard("SP1-ZED"),
  "drift cards are limited to drift books and exclude resale buckets and suppliers");
  check(catalog.driftCustomers.join() === "CX1-ZED,CX2-ZED,AX1-ZED",
    "the drift selector includes non-supplier customers and omits suppliers and resale buckets");
  check(driftCard("CX1-ZED").held === true && driftCard("CX1-ZED").value === 0 && driftCard("CX1-ZED").current === 0,
    "a held zero is represented as an override rather than automatic drift");
  check(driftCard("CX2-ZED").held === false && driftCard("CX2-ZED").value === null && driftCard("CX2-ZED").current === 0
    && driftCard("CX2-ZED").suggest === 0.25 && driftCard("CX1-ZED").suggest === 0,
  "an unheld customer is the Set Price (nought) with the engine's suggestion beside it, and a held zero carries its own");

  const set = (tier) => makerTierSet({ at, code: "CX2-ZED", product: "salt", tier }, mirror);
  for (const value of [0, 0.05, 0.35, 1, 2]) {
    const result = set(value);
    check(result.entry?.type === "TIER" && result.entry.payload.mode === "tierset"
      && result.draft?.collection === "tierset" && result.draft.row.tiers["CX2-ZED"].salt === value,
    "the existing tier-set constructor and drafter preserve a % lift of " + value);
  }
  const cleared = set(null);
  check(cleared.entry?.payload.mode === "tierset" && cleared.draft?.row.tiers["CX2-ZED"].salt === null,
    "null uses the existing tierset draft to clear the held override");
  check([-1, -0.01, 2.01, 3, "0", "Gold", undefined].every((value) => !!set(value).error)
    && !!makerTierSet({ at, code: "CX2-ZED", product: "oil", tier: 0.25 }, mirror).error,
  "out-of-range (a negative, or past 2), nonnumeric, level, missing and fixed-book inputs are refused");
  check(!!makerTierSet({ at, code: "SP1-ZED", product: "salt", tier: 0.25 }, mirror).error,
    "supplier codes cannot receive customer drift");
  check(set(2.01).error === "Choose a % lift from 0 to 200% (0 to 2), or clear it." && !set(2).error && !set(0).error,
    "the Maker validates the % lift bounds, 0 to 2, with the shared pricing engine before constructing an entry");
  /* 18 Oct 2026: the levels are gone, so a book with neither a Set Price nor a fixed board takes no figure of his at all */
  const tierBook = book();
  tierBook.pricing.byProduct.salt.inputs.policy.tierRule = { multiples: [1, 2] };
  check(!!makerTierSet({ at, code: "CX2-ZED", product: "salt", tier: 0.25 }, tierBook).error
    && !!makerTierSet({ at, code: "CX2-ZED", product: "salt", tier: "Gold" }, tierBook).error,
  "a book with no Set Price takes neither a numeric lift nor a level word");

  const forwarded = [];
  const key = "counter-maker-test-key-0123456789abcdef";
  const env = {
    COUNTER_MAKER_KEY: key,
    DESK_MAKER: { fetch: async (request) => {
      forwarded.push({ path: new URL(request.url).pathname, key: request.headers.get("X-Counter-Maker-Key"),
        body: request.method === "POST" ? await request.json() : null });
      return new Response(JSON.stringify({ ok: true, queued: true, status: "pending" }),
        { headers: { "content-type": "application/json" } });
    } }
  };
  const identity = { email: "maakmal97@icloud.com" };
  for (const tier of [0, null]) {
    const response = await handleMaker(new Request("https://counter.test/all/maker/inputs/tier-set", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ at, code: "CX2-ZED", product: "salt", tier })
    }), env, "/all/maker/inputs/tier-set", identity);
    check(response.status === 200 && forwarded.at(-1).path === "/_internal/maker/inputs/tier-set"
      && forwarded.at(-1).key === key && forwarded.at(-1).body.tier === tier,
    "the authenticated Counter route preserves " + (tier === null ? "the clear" : "held zero") + " on the named Desk bridge");
  }

  const content = await contentKey("4".repeat(64), "maker-drift");
  const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
  const calls = []; let failDriftOnce = true;
  const context = {
    ok: true, products: ["salt", "oil"],
    catalog: {
      products: [{ product: "salt", drift: true, tiered: false }, { product: "oil", fixed: true, drift: false, tiered: false }],
      parties: ["CX1-ZED", "CX2-ZED", "SP1-ZED"],
      tierCustomers: ["CX1-ZED", "CX2-ZED", "SP1-ZED"],
      driftCustomers: ["CX1-ZED", "CX2-ZED"],
      driftCards: [{ code: "CX1-ZED", product: "salt", held: true, value: 0, current: 0, suggest: 0 },
        { code: "CX2-ZED", product: "salt", held: false, value: null, current: 0, suggest: 0.25 }]
    }
  };
  const dom = new JSDOM(landingPage("", "maker-drift-nonce", { master: "fixture-master", accounts: [] }), {
    url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
      win.fetch = async (path, init) => {
        const route = String(path), body = init?.body ? JSON.parse(init.body) : null;
        if (route === "/all/maker/inputs/tier-set") {
          calls.push({ route, body });
          if (failDriftOnce && body.tier === 0) {
            failDriftOnce = false;
            return { ok: false, status: 503, json: async () => ({ ok: false, error: "Retry this retained input." }) };
          }
        }
        const data = route === "/open" ? adminOpen
          : route === "/all/maker/inputs" ? context
            : route === "/all/maker/review" ? { ok: true, orders: [], drafts: [] }
              : route === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
                : route === "/all/sheet" ? { ok: true, accounts: [] }
                  : { ok: true, accounts: [], orders: [], drafts: [], refs: [], tiers: [] };
        return { ok: true, status: 200, json: async () => data };
      };
    }
  });
  const waitFor = async (predicate) => {
    for (let i = 0; i < 100 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
    return predicate();
  };
  try {
    const doc = dom.window.document;
    doc.querySelector('button[data-act="nav.record"]').click();
    const loaded = await waitFor(() => [...doc.querySelectorAll("#makerInputs .maker-input h3")]
      .some((heading) => heading.textContent === "Their %"));
    check(loaded, "the owner page renders the Counter customer drift controls");
    const drift = [...doc.querySelectorAll("#makerInputs .maker-input")]
      .find((section) => section.querySelector("h3")?.textContent === "Their %");
    const selects = drift.querySelectorAll("select"), value = drift.querySelector('input[type="number"]');
    const setButton = [...drift.querySelectorAll("button")].find((button) => button.textContent === "Send their %");
    const clearButton = [...drift.querySelectorAll("button")].find((button) => button.textContent === "Set back to 0");
    const useButton = [...drift.querySelectorAll("button")].find((button) => button.textContent === "Use the suggestion");
    check([...selects[0].options].map((option) => option.value).join() === "CX1-ZED,CX2-ZED",
      "the Counter drift selector uses the customer-only catalog and excludes suppliers");
    check(selects.length === 1 && tileValues(drift, "Book").join() === "salt",
      "the UI offers salt and omits fixed books from its drift tiles");
    check(value.min === "0" && value.max === "2" && value.step === "0.05",
      "the UI bounds the numeric input to the % lift range, 0 to 2");
    check(drift.textContent.includes("Set by you: 0%."),
      "the UI labels a held zero as set by him");
    selects[0].value = "CX2-ZED"; selects[0].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    check(drift.textContent.includes("No % set: the Set Price. Suggested +25%.") && clearButton.hidden && !useButton.hidden,
      "none held reads as the Set Price with the suggestion beside it, and Clear is unavailable when nothing is held");
    useButton.click();
    check(value.value === "0.25" && calls.length === 0,
      "Use the suggestion fills the box with the suggested % and sends nothing");
    selects[0].value = "CX1-ZED"; selects[0].dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    value.value = "2.01"; value.dispatchEvent(new dom.window.Event("input", { bubbles: true })); setButton.click();
    check(drift.textContent.includes("Enter a % from 0 to 2 (0.2 is 20%).") && calls.length === 0,
      "the Counter rejects a % past 2 before sending an input");
    value.value = "-0.1"; value.dispatchEvent(new dom.window.Event("input", { bubbles: true })); setButton.click();
    check(drift.textContent.includes("Enter a % from 0 to 2 (0.2 is 20%).") && calls.length === 0,
      "and a negative one");
    await waitFor(() => !setButton.disabled);
    value.value = "0"; value.dispatchEvent(new dom.window.Event("input", { bubbles: true })); setButton.click();
    const retained = await waitFor(() => calls.length === 1 && !setButton.disabled && !clearButton.disabled);
    const pending = dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/tier-set");
    check(retained && pending && JSON.parse(pending).body.tier === 0,
      "a zero override is retained unchanged when its first send is not confirmed: " + JSON.stringify({
        retained, pending, keys: Object.keys(dom.window.localStorage), answer: drift.textContent, disabled: [setButton.disabled, clearButton.disabled]
      }));
    value.value = "0.75"; value.dispatchEvent(new dom.window.Event("input", { bubbles: true })); setButton.click();
    const retried = await waitFor(() => calls.length === 2 && !setButton.disabled && !clearButton.disabled);
    check(retried && JSON.stringify(calls[0].body) === JSON.stringify(calls[1].body),
      "an uncertain retry sends its entire retained drift request unchanged even if the form is edited");
    const confirmedAt = calls[1].body.at;
    value.value = "0"; value.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    setButton.click();
    const repeated = await waitFor(() => calls.length === 3 && !setButton.disabled);
    check(repeated && calls[2].body.tier === 0 && calls[2].body.at !== confirmedAt,
      "a successful same-value Set gets a fresh request timestamp on the next intentional tap");
    value.value = "0.125"; value.dispatchEvent(new dom.window.Event("input", { bubbles: true })); setButton.click();
    const rounded = await waitFor(() => calls.length === 4 && !setButton.disabled);
    check(rounded && calls[3].body.tier === 0.13,
      "Counter drift rounds to two decimals exactly like the incumbent Desk driftSet");
    clearButton.click();
    const clearSent = await waitFor(() => calls.length === 5);
    check(clearSent && calls[4].body.tier === null && calls[4].body.product === "salt",
      "Clear sends null through the same endpoint so the record resumes");
    const css = [...doc.querySelectorAll("style")].map((style) => style.textContent).join("\n");
    check(/\.maker-drift-actions button\{[^}]*min-width:var\(--salt-tap\)/.test(css),
      "both drift actions keep a 44px minimum width under the shared tap token on desktop and phone");
    check(/\.maker-drift-actions button\{[^}]*min-height:var\(--salt-tap\)/.test(css),
      "both drift actions keep a 44px minimum height under the shared tap token on desktop and phone");
    check(/--salt-tap:\s*44px/.test(css),
      "the shared tap token resolves to the hard 44px minimum");
  } finally {
    dom.window.close();
  }
}
