/* Salt Admin: a salt customer's % (-0.3 to 0.3, his decision of 21 Oct 2026; it was 0 to 2) set/clear through the existing tier-set road, a held zero distinct from none held, and the
   engine's suggestion beside it (18 Oct 2026: nothing automatic prices). */
import { makerInputCatalog, makerTierSet } from "../src/maker-inputs.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { JSDOM } from "jsdom";
import { byAct, enter } from "./maker-act.mjs";
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
      salt: { stockCost: 40, lift: { "CX1-ZED": 0, "CX2-ZED": 0 }, suggest: { "CX1-ZED": { pct: 0, why: "" }, "CX2-ZED": { pct: 0.25, why: "paid 20% over, paid late" }, "AX1-ZED": { pct: 0.1, why: "CX9-NAME paid RM 12 margin" } },
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
  check(driftCard("CX2-ZED").why === "paid 20% over, paid late" && driftCard("CX1-ZED").why === ""
    && driftCard("AX1-ZED").suggest === 0.1 && driftCard("AX1-ZED").why === "",
  "the suggestion carries its reason, the engine's few words, and a reason that is anything else (a name, a figure) is left behind: " + JSON.stringify(catalog.driftCards.map((item) => [item.code, item.suggest, item.why])));

  const set = (tier, unit = "pct") => makerTierSet({ at, code: "CX2-ZED", product: "salt", tier, unit }, mirror);
  for (const value of [-0.3, -0.05, 0, 0.05, 0.25, 0.3]) {
    const result = set(value);
    check(result.entry?.type === "TIER" && result.entry.payload.mode === "tierset"
      && result.draft?.collection === "tierset" && result.draft.row.tiers["CX2-ZED"].salt === value,
    "the existing tier-set constructor and drafter preserve a % lift of " + value);
  }
  const cleared = set(null);
  check(cleared.entry?.payload.mode === "tierset" && cleared.draft?.row.tiers["CX2-ZED"].salt === null,
    "null uses the existing tierset draft to clear the held override");
  check([-1, -0.31, 0.31, 2.01, 3, "0", "Gold", undefined].every((value) => !!set(value).error)
    && !!makerTierSet({ at, code: "CX2-ZED", product: "oil", tier: 0.25 }, mirror).error,
  "out-of-range (under -0.3 or past 0.3), nonnumeric, level, missing and fixed-book inputs are refused");
  /* 19 Oct 2026: the unit is the gate. A Salt Admin page cached from before the % lift sends the old field's 0.3 with no unit, and it is refused here by unit, not by time. */
  const unitless = makerTierSet({ at, code: "CX2-ZED", product: "salt", tier: 0.3 }, mirror), oldUnit = set(0.3, "drift");
  check(/Reload Salt Admin/.test(unitless.error || "") && !unitless.entry && !!oldUnit.error && !oldUnit.entry && !set(null, undefined).error
    && !makerTierSet({ at, code: "CX2-ZED", product: "salt", tier: null }, mirror).error
    && set(0.3).entry.payload.unit === "pct" && set(null).entry.payload.unit === undefined,
  "a salt figure with no unit pct is refused with a plain message to reload Salt Admin, a clear needs no unit, and a figure sent with it carries unit pct in the entry: " + JSON.stringify([unitless.error, oldUnit.error]));
  check(!!makerTierSet({ at, code: "SP1-ZED", product: "salt", tier: 0.25 }, mirror).error,
    "supplier codes cannot receive customer drift");
  check(set(0.31).error === "Choose a % from -30% to +30% (-0.3 to 0.3), or clear it." && set(-0.31).error === set(0.31).error && !set(0.3).error && !set(-0.3).error && !set(0).error,
    "the Maker validates the % bounds, -0.3 to 0.3, with the shared pricing engine before constructing an entry");
  /* 18 Oct 2026: the levels are gone, so a book with neither a Set Price nor a fixed board takes no figure of his at all */
  const tierBook = book();
  tierBook.pricing.byProduct.salt.inputs.policy.tierRule = { multiples: [1, 2] };
  check(!!makerTierSet({ at, code: "CX2-ZED", product: "salt", tier: 0.25, unit: "pct" }, tierBook).error
    && !!makerTierSet({ at, code: "CX2-ZED", product: "salt", tier: "Gold", unit: "pct" }, tierBook).error,
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
      body: JSON.stringify({ at, code: "CX2-ZED", product: "salt", tier, unit: "pct" })
    }), env, "/all/maker/inputs/tier-set", identity);
    check(response.status === 200 && forwarded.at(-1).path === "/_internal/maker/inputs/tier-set"
      && forwarded.at(-1).key === key && forwarded.at(-1).body.tier === tier,
    "the authenticated Counter route preserves " + (tier === null ? "the clear" : "held zero") + " on the named Desk bridge");
  }

  /* 26 Oct 2026: Their % is set from the customer's own account card (Customers > Accounts): a stepper in whole steps of 5 between -30 and +30, Send, Use the suggestion, Set back to 0 */
  const content = await contentKey("4".repeat(64), "maker-drift");
  const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
  const calls = []; let failDriftOnce = true;
  const stamp = "2026-10-01T08:00:00.000Z";
  const account = (username, code) => ({ username, code, account: true, t: { owed: 0, toGet: 0, refund: 0, pend: 0 }, flag: "clear", seen: { opens: 1, last: stamp, how: "link" }, sent: stamp, issued: "2026-10-01" });
  const accounts = [account("1111-0001", "CX1-ZED"), account("1111-0002", "CX2-ZED"), account("1111-0003", "SP1-ZED")];
  const context = {
    ok: true, products: ["salt", "oil"],
    catalog: {
      products: [{ product: "salt", drift: true, tiered: false }, { product: "oil", fixed: true, drift: false, tiered: false }],
      parties: ["CX1-ZED", "CX2-ZED", "SP1-ZED"],
      tierCustomers: ["CX1-ZED", "CX2-ZED", "SP1-ZED"],
      driftCustomers: ["CX1-ZED", "CX2-ZED"], partners: [], partnerWaiting: [],
      driftCards: [{ code: "CX1-ZED", product: "salt", held: true, value: 0, current: 0, suggest: 0, why: "" },
        { code: "CX2-ZED", product: "salt", held: false, value: null, current: 0, suggest: 0.25, why: "paid late" }]
    }
  };
  const dom = new JSDOM(landingPage("", "maker-drift-nonce", { master: "fixture-master", accounts }), {
    url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
      win.fetch = async (path, init) => {
        const route = String(path), body = init?.body ? JSON.parse(init.body) : null;
        if (route === "/all/maker/inputs/tier-set") {
          calls.push({ route, body, bytes: init.body });
          if (failDriftOnce) {
            failDriftOnce = false;
            return { ok: false, status: 503, json: async () => ({ ok: false, error: "Retry this retained input." }) };
          }
        }
        const data = route === "/open" ? adminOpen
          : route === "/all/maker/inputs" ? context
            : route === "/all/maker/review" ? { ok: true, orders: [], drafts: [] }
              : route === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
                : route === "/all/sheet" ? { ok: true, at: stamp, issue: "2026-10-01", accounts, desk: { n: 2, at: stamp, moved: false }, stranger: "Silver" }
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
    const doc = dom.window.document, text = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
    enter(doc, "customers", "accounts");
    const open = async (code) => {
      await waitFor(() => [...doc.querySelectorAll("#rlist [data-u]")].some((c) => text(c.querySelector(".need-who")) === code));
      [...doc.querySelectorAll("#rlist [data-u]")].find((c) => text(c.querySelector(".need-who")) === code).click();
      return waitFor(() => !!doc.querySelector("#aopen .acust") && doc.querySelector("#aopen .need-who, #aopen h2, #aopen .oacct") !== null);
    };
    const pct = () => doc.querySelector("#aopen .apct"), act = (name, key) => byAct(pct(), name, key);
    const val = () => text(pct().querySelector(".apct__val"));
    const steps = async (name, n) => { for (let i = 0; i < n; i++) act(name).click(); await new Promise((resolve) => setTimeout(resolve, 5)); };
    const send = async () => {
      const before = calls.length, b = act("acct.pct.send", "CX1-ZED");
      b.click();
      await waitFor(() => calls.length === before + 1 && !b.disabled);
      await new Promise((resolve) => setTimeout(resolve, 20));
    };
    check(await open("CX1-ZED") && !!(await waitFor(() => !!pct())), "the owner page renders the Counter customer drift controls on the customer's account card");
    const tabs = [...pct().querySelectorAll('[data-act="acct.pct.book"]')];
    check(tabs.length === 1 && tabs[0].getAttribute("data-key") === "salt" && !pct().querySelector("select"),
      "the UI offers salt and omits fixed books from its drift tabs, and has no customer selector");
    check(!pct().querySelector("input") && val() === "0%" && !!act("acct.pct.clear", "CX1-ZED") && act("acct.pct.send", "CX1-ZED").disabled,
      "the account card has no typed % field, a stepper at the held zero, Send off while nothing changes and Set back to 0 for the held zero");
    await steps("acct.pct.up", 7);
    check(val() === "+30%" && act("acct.pct.up").disabled && !act("acct.pct.down").disabled, "the stepper moves a whole 5 at a time and stops at +30: " + val());
    await steps("acct.pct.down", 13);
    check(val() === "−30%" && act("acct.pct.down").disabled, "and stops at -30: " + val());
    await steps("acct.pct.up", 6);
    check(val() === "0%" && calls.length === 0, "and sends nothing while it moves");
    await open("SP1-ZED");
    check(!doc.querySelector("#aopen .apct") && !doc.querySelector("#aopen .apart"), "a supplier's account, outside the drift customers, has no Their % and no Make partner");
    await open("CX2-ZED");
    check(!!pct() && text(pct().querySelector(".salt-ledger__row")) === "Suggested+25%Paid late" && !act("acct.pct.clear", "CX2-ZED") && !act("acct.pct.suggest").disabled && text(act("acct.pct.suggest")) === "Use +25%",
      "none held reads as the Set Price with the suggestion and its reason beside it, and Set back to 0 is unavailable when nothing is held: " + text(pct() && pct().querySelector(".salt-ledger__row")));
    act("acct.pct.suggest").click();
    check(val() === "+25%" && calls.length === 0, "Use the suggestion fills the stepper with the suggested % and sends nothing");
    await open("CX1-ZED");
    await steps("acct.pct.up", 3);
    await send();
    const pending = dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/tier-set");
    check(calls.length === 1 && pending && JSON.parse(pending).body.tier === 0.15,
      "a % is retained unchanged when its first send is not confirmed: " + JSON.stringify({ pending, calls: calls.length }));
    await steps("acct.pct.up", 1);
    await send();
    check(calls.length === 2 && calls[0].bytes === calls[1].bytes,
      "an uncertain retry sends its entire retained drift request unchanged even if the stepper is moved");
    await send();
    check(calls.length === 3 && calls[2].body.tier === 0.2 && calls[2].body.at !== calls[1].body.at,
      "after a confirmed send, the stepper's own value goes with a fresh request timestamp");
    await send();
    check(calls.length === 4 && calls[3].body.tier === 0.2 && calls[3].body.at !== calls[2].body.at,
      "a successful same-value Send gets a fresh request timestamp on the next intentional tap");
    await steps("acct.pct.down", 7);
    await send();
    check(calls.length === 5 && calls[4].body.tier === -0.15 && calls.slice(0, 5).every((call) => call.body.unit === "pct" && call.body.product === "salt" && call.body.code === "CX1-ZED"),
      "a whole % is sent as its fraction to two decimals (-15 as -0.15), and every figure it sends carries unit pct: " + JSON.stringify(calls.map((c) => c.body.tier)));
    act("acct.pct.clear", "CX1-ZED").click();
    const clearSent = await waitFor(() => calls.length === 6);
    check(clearSent && calls[5].body.tier === null && calls[5].body.product === "salt",
      "Set back to 0 sends null through the same endpoint so the record resumes");
    const css = [...doc.querySelectorAll("style")].map((style) => style.textContent).join("\n");
    check(/\.adm \.apct__btn\{[^}]*min-width:48px[^}]*height:48px/.test(css) && /\.adm \.apct__acts \.salt-pill,[^{]*\{[^}]*min-height:48px/.test(css),
      "the stepper's buttons and the actions keep a 48px minimum under the 44px tap size on desktop and phone");
    check(/--salt-tap:\s*44px/.test(css),
      "the shared tap token resolves to the hard 44px minimum");
  } finally {
    dom.window.close();
  }
}
