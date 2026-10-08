/* test/maker-placed-preview.mjs: Counter Admin's placed-order preview, driven in the actual owner script. A delivery order
   chooses none of RM 0, 10, 15 or Other by default, and Preview stays off until he chooses one; a successful preview shows
   the native card/margin/floor/usual comparison, not raw row JSON, and Accept is labelled with the server's quote and delivery; any
   failed or in-flight preview, or any changed input, clears the usable quote and takes Accept away; and a retried Accept,
   unchanged since its preview, sends the same body twice over. */
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

export async function run({ ok }) {
  const posts = [];
  let previewFail = 0, acceptFail = 0;
  const orderOf = (id, patch = {}) => ({ id, u: "abcd-efgh", product: "salt", qty: 2, total: 200, status: "placed", mode: "deliver", history: [], ...patch });
  const reviewBody = { ok: true, drafts: [], orders: [orderOf("20261007090001-dlv")] };
  const preview = (body) => ({ cost: { unit: 80, total: 160, source: "purchase" },
    ok: true, quote: body.total, delivery: body.delivery, hash: "h-" + (posts.filter((p) => p.kind === "preview").length), row: { qty: 2, total: body.total },
    card: 190, cardNote: null, floor: { rm: 150, at: 2, exact: true }, margin: { rm: 40, pct: 21 },
    usual: { who: "CX1-AB", rate: 95, orders: 4, uniform: true, off: false, dir: 0, far: false }, flags: ["Check the quantity"] });
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {}; window.confirm = () => true;
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).startsWith("/all/maker/orders/")) {
          const body = JSON.parse(init.body);
          if (String(path).endsWith("/preview")) {
            posts.push({ kind: "preview", path: String(path), body });
            if (previewFail > 0) { previewFail--; return new Response(JSON.stringify({ ok: false, error: "The Desk did not answer." }), { status: 503 }); }
            return Response.json(preview(body));
          }
          posts.push({ kind: "accept", path: String(path), body });
          if (acceptFail > 0) { acceptFail--; return new Response(JSON.stringify({ ok: false, error: "The Desk did not confirm." }), { status: 503 }); }
          return Response.json({ ok: true });
        }
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
    const until = async (predicate) => {
      for (let i = 0; i < 200 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
      return !!predicate();
    };
    const card = (id) => [...doc.querySelectorAll("#makerReview article")].find((a) => a.querySelector("h3") && a.querySelector("h3").textContent === id);
    const button = (id, text) => card(id) && [...card(id).querySelectorAll("button")].find((b) => b.textContent === text);
    const accept = (id) => card(id) && card(id).querySelector("[data-accept]");
    const radio = (id, label) => {
      const opt = card(id) && [...card(id).querySelectorAll(".salt-option")].find((o) => o.querySelector(".salt-option__label") && o.querySelector(".salt-option__label").textContent === label);
      return opt && opt.querySelector('input[type="radio"]');
    };
    const total = (id) => card(id).querySelector(".maker-fields input[type=\"number\"]");
    const tile = (id, label) => [...card(id).querySelectorAll(".salt-kpi")].find((k) => k.querySelector(".salt-kpi__label") && k.querySelector(".salt-kpi__label").textContent === label);
    const id = "20261007090001-dlv";
    doc.querySelector('[data-m="maker"]').click();
    await until(() => button(id, "Preview"));

    /* no default delivery approval: none of RM 0, 10, 15 or Other is chosen, and Preview waits for a choice */
    ok(!radio(id, "RM 0").checked && !radio(id, "RM 10").checked && !radio(id, "RM 15").checked && !radio(id, "Other").checked
      && button(id, "Preview").disabled && !accept(id),
      "A delivery order chooses none of RM 0, 10, 15 or Other by default, and Preview stays off until he chooses one.");

    radio(id, "RM 10").checked = true;
    radio(id, "RM 10").dispatchEvent(new browser.window.Event("change", { bubbles: true }));
    ok(!button(id, "Preview").disabled, "Choosing a delivery charge lets Preview run.");

    button(id, "Preview").click();
    await until(() => accept(id));

    /* displayed comparison fields: the native card/margin/floor/usual tiles, not raw row JSON */
    ok(tile(id, "Their card today") && tile(id, "Their card today").querySelector(".salt-kpi__value").textContent === "RM 190.00"
      && /the quote is RM 200\.00/.test(tile(id, "Their card today").querySelector(".salt-kpi__note").textContent)
      && tile(id, "Margin") && tile(id, "Margin").querySelector(".salt-kpi__value").textContent === "RM 40.00"
      && tile(id, "Margin").querySelector(".salt-kpi__note").textContent === "on RM 160.00 cost · 21%"
      && tile(id, "Floor") && tile(id, "Floor").querySelector(".salt-kpi__value").textContent === "RM 150.00"
      && /the quote clears it/.test(tile(id, "Floor").querySelector(".salt-kpi__note").textContent)
      && tile(id, "Their usual") && tile(id, "Their usual").querySelector(".salt-kpi__value").textContent === "RM 95.00"
      && !card(id).querySelector("pre.maker-row"),
      "A successful preview shows the native card, margin, floor and usual tiles, not raw row JSON: " + card(id).textContent);
    ok(accept(id).textContent === "Accept order at RM 200.00, delivery RM 10.00", "Accept is labelled with the server's quote and delivery: " + accept(id).textContent);

    /* changed input invalidates the preview */
    total(id).value = "250"; total(id).dispatchEvent(new browser.window.Event("input", { bubbles: true }));
    ok(!accept(id) && button(id, "Preview").disabled === false, "Editing the goods total invalidates the preview and removes Accept.");
    total(id).value = "200"; total(id).dispatchEvent(new browser.window.Event("input", { bubbles: true }));
    button(id, "Preview").click();
    await until(() => accept(id));
    radio(id, "RM 15").checked = true;
    radio(id, "RM 15").dispatchEvent(new browser.window.Event("change", { bubbles: true }));
    ok(!accept(id), "Choosing a different delivery charge invalidates the preview and removes Accept.");

    /* success -> failed refresh: a later preview failing clears what the earlier success left usable, at once */
    radio(id, "RM 10").checked = true;
    radio(id, "RM 10").dispatchEvent(new browser.window.Event("change", { bubbles: true }));
    button(id, "Preview").click();
    await until(() => accept(id));
    ok(!!accept(id), "A successful preview restores Accept after it was invalidated.");
    previewFail = 1;
    const beforeFail = posts.filter((p) => p.kind === "preview").length;
    button(id, "Preview").click();
    ok(!accept(id), "A failed preview clears Accept at once, not only once the failure is confirmed.");
    await until(() => posts.filter((p) => p.kind === "preview").length > beforeFail);
    await new Promise((resolve) => setTimeout(resolve, 30));
    ok(!accept(id) && /The Desk did not answer/.test(card(id).textContent), "A failed preview leaves no Accept and reports why: " + card(id).textContent);

    /* immutable Accept retry: a preview succeeding again, then an Accept retried after a failure, sends the same body twice */
    button(id, "Preview").click();
    await until(() => accept(id));
    const acceptBody = () => posts.filter((p) => p.kind === "accept");
    acceptFail = 1;
    accept(id).click();
    await until(() => acceptBody().length >= 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    accept(id).click();
    await until(() => acceptBody().length >= 2);
    const [first, second] = acceptBody();
    ok(JSON.stringify(first.body) === JSON.stringify(second.body) && first.path === second.path,
      "A retried Accept, unchanged since its preview, sends the same body twice over: " + JSON.stringify(acceptBody()));
  } finally { browser.window.close(); }
}
