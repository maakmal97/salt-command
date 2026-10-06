/* Counter Admin: the restock date per book (KV `expected`, through the Desk's native relay) and putting a rejected plain sale back on the sale form. */
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { makerExpectedFault } from "../src/maker.js";
import { makerReenterSeed } from "../src/maker-inputs.js";
import { landingPage } from "../stmt/page.js";
import { Store } from "./maker-order-controls.mjs";

export async function run({ ok }) {
  const fault = makerExpectedFault;
  ok(fault({ product: "salt", on: "2099-01-05" }) === "" && fault({ product: "salt", on: null }) === ""
    && fault({ product: "Salt", on: null }) !== "" && fault({ product: "salt", on: "5 Jan" }) !== ""
    && fault({ product: "salt" }) !== "" && fault({ product: "salt", on: null, x: 1 }) !== "" && fault([]) !== "",
    "a restock date carries a lower-case book and a YYYY-MM-DD day or null, and nothing else");

  const sale = (payload) => ({ id: "d1", status: "pending", entry: { type: "sale", payload: { mode: "new", direction: "SELL", product: "salt", party: "CX1-AB",
    qty: 3, total: 285, cash: 100, kg: 2, handover: "collected", delivery: 5, date: "2026-10-04", ...payload } } });
  const seed = makerReenterSeed(sale({}));
  ok(seed && seed.party === "CX1-AB" && seed.qty === 3 && seed.total === 285 && seed.cash === 100 && seed.movedUnits === 2
    && seed.handover === "collected" && seed.delivery === 5 && seed.date === "2026-10-04" && !("blocked" in seed),
    "a rejected plain sale re-enters with every figure it was typed with");
  ok(makerReenterSeed(sale({ assoc: "AX1-ZED", stream: "R2" })).blocked && makerReenterSeed(sale({ note: "x" })).blocked
    && makerReenterSeed(sale({ orderCode: "O1" })).blocked,
    "a resale, a note or an order code is named blocked, never half-filled");
  ok(makerReenterSeed(sale({ mode: "amend" })) === null && makerReenterSeed(sale({ direction: "BUY" })) === null && makerReenterSeed(null) === null,
    "an amendment, a purchase or nothing offers no re-entry");

  /* the real roads: Counter Admin to the Desk's bridge to the site's store */
  const team = "maker-exp-fixture", audience = "maker-exp-audience", kid = "maker-exp-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const stmt = new Store();
  const env = { STMT: stmt, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "exp-local-master",
    STMT_DESK_KEY: "exp-desk-test-capability-0000001", COUNTER_MAKER_KEY: "exp-maker-test-capability-0000001" };
  const rejected = sale({ id: "x" });
  const d1 = { prepare(sql) {
    const st = { sql, bind() { return st; },
      async all() {
        if (/FROM draft/.test(sql)) return { results: [{ id: "d1", status: "pending", collection: "sales", entry: JSON.stringify(rejected.entry), flags: "[]" }] };
        if (/FROM state/.test(sql)) return { results: [{ key: "PRICING", doc: JSON.stringify({ byProduct: { salt: {}, oil: {} } }) }] };
        return { results: [] };
      },
      async first() { return null }, async run() { return { success: true }; } };
    return st;
  } };
  const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: d1, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY, STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => counter.fetch(new Request(url, init), env) } };
  env.DESK_MAKER = { fetch: (request) => desk.fetch(request, deskEnv, {}) };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email: "maakmal97@icloud.com",
      exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const jwt = header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
      signing.privateKey, new TextEncoder().encode(header + "." + claims))).toString("base64url");
    const call = (path, body, withJwt = true) => counter.fetch(new Request("https://counter.fixture.test" + path, {
      method: body === undefined ? "GET" : "POST", headers: { ...(withJwt ? { "cf-access-jwt-assertion": jwt } : {}), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body) }), env);
    const day = new Date(Date.now() + 8 * 36e5 + 5 * 864e5).toISOString().slice(0, 10);

    ok((await call("/all/maker/expected", { product: "salt", on: day }, false)).status === 401 || (await call("/all/maker/expected", undefined, false)).status >= 300,
      "the restock date is behind the same Access gate as every /all route");
    const set = await call("/all/maker/expected", { product: "salt", on: day });
    const setBody = await set.json();
    ok(set.status === 200 && setBody.expected && setBody.expected.salt === day && JSON.parse(await stmt.get("expected")).salt === day,
      "Counter Admin sets a book's restock date through the Desk's relay into the site's store: " + set.status + " " + JSON.stringify(setBody));
    const read = await (await call("/all/maker/expected")).json();
    ok(read.expected && read.expected.salt === day, "and reads it back");
    const again = await call("/all/maker/expected", { product: "salt", on: day });
    ok(again.status === 200 && JSON.parse(await stmt.get("expected")).salt === day, "setting the same day twice lands once: a day is absolute, so a retry changes nothing");
    const past = await call("/all/maker/expected", { product: "salt", on: "2020-01-01" });
    ok(past.status === 400 && JSON.parse(await stmt.get("expected")).salt === day, "a day in the past is refused by the site's own rule and the held day stands");
    const alien = await call("/all/maker/expected", { product: "zinc", on: day });
    ok(alien.status === 400 && !JSON.parse(await stmt.get("expected")).zinc, "a book the Desk does not hold is refused before the relay");
    const extra = await call("/all/maker/expected", { product: "salt", on: day, rid: "nope" });
    ok(extra.status === 400, "a field the route does not take is refused");
    const clear = await call("/all/maker/expected", { product: "salt", on: null });
    ok(clear.status === 200 && !JSON.parse(await stmt.get("expected")).salt, "clearing removes the day");

    const review = await (await call("/all/maker/review")).json();
    const d = (review.drafts || [])[0];
    ok(d && d.reenter && d.reenter.party === "CX1-AB" && d.reenter.total === 285,
      "the review carries each waiting sale's re-entry figures, computed by the Desk: " + JSON.stringify(review).slice(0, 200));

    /* the owner page */
    const posts = [], rejects = [];
    const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
      url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(window) {
        Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
        window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
        window.scrollTo = () => {}; window.confirm = () => true; window.HTMLElement.prototype.scrollIntoView = () => {};
        let drafts = [{ id: "d1", status: "pending", entry: rejected.entry, product: "salt", qty: 3, total: 285, reenter: seed }];
        window.fetch = async (path, init) => {
          const where = String(path);
          if (where === "/all/maker/expected") {
            if (init && init.method === "POST") { posts.push(JSON.parse(init.body)); return Response.json({ ok: true, expected: { salt: JSON.parse(init.body).on } }); }
            return Response.json({ ok: true, expected: {} });
          }
          if (where === "/all/maker/drafts/d1/reject") { rejects.push(where); drafts = []; return Response.json({ ok: true }); }
          if (where === "/all/maker/review") return Response.json({ ok: true, orders: [], drafts, refused: [] });
          if (where === "/all/maker/inputs") return Response.json({ ok: true, products: ["salt"], catalog: { parties: ["CX1-AB"], products: [{ product: "salt", saleReady: true, purchaseReady: true }], loans: [], rewards: [], correctionFields: [], rows: [] } });
          if (where === "/all/maker/claims") return Response.json({ ok: true, claims: [] });
          if (where === "/all/maker/threads") return Response.json({ ok: true, threads: [] });
          if (where === "/all/maker/bulletin") return Response.json({ ok: true, lines: [] });
          if (where === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
          return Response.json({ ok: true, accounts: [] });
        };
      }
    });
    try {
      const doc = browser.window.document;
      const until = async (p) => { for (let i = 0; i < 300 && !p(); i++) await new Promise((r) => setTimeout(r, 10)); return !!p(); };
      const btn = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent === text);
      doc.querySelector('[data-m="maker"]').click();
      const box = doc.getElementById("makerExpected");
      await until(() => box.querySelector("input[type=date]"));
      const dateField = box.querySelector("input[type=date]");
      ok(!!box.querySelector("select") && !!btn(box, "Set date") && !!btn(box, "Clear date"), "the owner page draws a book, a day, Set date and Clear date");
      btn(box, "Set date").click();
      ok(posts.length === 0 && /Choose a day/.test(doc.getElementById("makerExpectedStatus").textContent), "Set date with no day sends nothing");
      dateField.value = day; btn(box, "Set date").click();
      await until(() => posts.length === 1);
      ok(posts[0].product === "salt" && posts[0].on === day && Object.keys(posts[0]).length === 2, "Set date sends the book and the day only: " + JSON.stringify(posts));
      await until(() => /Date set/.test(doc.getElementById("makerExpectedStatus").textContent));
      btn(box, "Clear date").click();
      await until(() => posts.length === 2);
      ok(posts[1].on === null, "Clear date sends a null day");

      await until(() => btn(doc.getElementById("makerReview"), "Reject row"));
      btn(doc.getElementById("makerReview"), "Reject row").click();
      await until(() => rejects.length === 1);
      await until(() => btn(doc.getElementById("makerReview"), "Re-enter it, corrected"));
      ok(!!btn(doc.getElementById("makerReview"), "Re-enter it, corrected"), "after a reject the review offers Re-enter it, corrected");
      await until(() => doc.querySelector("#makerInputs select"));
      btn(doc.getElementById("makerReview"), "Re-enter it, corrected").click();
      const field = (label) => [...doc.querySelectorAll("#makerInputs label.maker-field")].find((l) => (l.querySelector(".lbl") || {}).textContent === label);
      ok(field("Units").querySelector("input").value === "3" && field("Goods total (RM)").querySelector("input").value === "285"
        && field("Cash recorded (RM)").querySelector("input").value === "100" && field("Units moved").querySelector("input").value === "2"
        && field("Delivery (RM)").querySelector("input").value === "5" && field("Date").querySelector("input").value === "2026-10-04"
        && [...doc.querySelectorAll("#makerInputs select")].some((s) => s.value === "CX1-AB"),
        "Re-enter it, corrected puts every figure back on the sale form");
    } finally {
      browser.window.close();
    }

  } finally { globalThis.fetch = originalFetch; }
}
