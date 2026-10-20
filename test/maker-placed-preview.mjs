/* test/maker-placed-preview.mjs: Salt Admin's placed-order preview, driven in the actual owner script. THE CARD READS ITS OWN PREVIEW
   (his decision 6 of 11 Oct 2026): opening the order reads it once, a changed input reads it again, a row of the list reads nothing, and
   there is no Preview button. A delivery order chooses none of RM 0, 10, 15 or Other by default and reads nothing until he chooses one; a
   successful read shows the native card/margin/floor/usual comparison, not raw row JSON, and Accept is labelled with the server's quote and
   delivery; any failed or in-flight read, or any changed input, clears the usable quote and takes Accept away; a redraw keeps what was read
   and asks the Desk nothing more; and a retried Accept, unchanged since its read, sends the same body twice over. */
import { webcrypto } from "node:crypto";
import { cardOf } from "./maker-act.mjs";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

export async function run({ ok }) {
  const posts = [];
  let previewFail = 0, acceptFail = 0;
  const orderOf = (id, patch = {}) => ({ id, u: "abcd-efgh", product: "salt", qty: 2, total: 200, status: "placed", mode: "deliver", history: [], ...patch });
  const reviewBody = { ok: true, drafts: [], orders: [orderOf("20261007090001-dlv", { sheet: "sh1" }), orderOf("20261007090002-dlv", { sheet: "sh1" })] };
  const preview = (body) => ({ cost: { unit: 80, total: 160, source: "purchase" },
    ok: true, quote: body.total, delivery: body.delivery, hash: "h-" + (posts.filter((p) => p.kind === "preview").length), row: { qty: 2, total: body.total },
    card: 190, cardNote: null, floor: { rm: 150, at: 2, exact: true }, margin: { rm: 40, pct: 21 },
    usual: { who: "CX1-AB", rate: 95, orders: 4, uniform: true, off: false, dir: 0, far: false }, flags: ["Check the quantity"], prepay: true, owedWith: 300, ceiling: 250, late: { run: 1, need: 3 } });
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {};
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
    const card = (id) => cardOf(doc, id);
    const button = (id, text) => card(id) && [...card(id).querySelectorAll("button")].find((b) => b.textContent === text);
    const accept = (id) => card(id) && card(id).querySelector("[data-accept]");
    const radio = (id, label) => {
      const opt = card(id) && [...card(id).querySelectorAll(".salt-option, .ofee .salt-segment__opt")].find((o) => (o.querySelector(".salt-option__label") || o).textContent === label);
      return opt && opt.querySelector('input[type="radio"]');
    };
    const total = (id) => card(id).querySelector(".maker-fields input[type=\"number\"]");
    const tile = (id, label) => [...card(id).querySelectorAll(".salt-kpi")].find((k) => k.querySelector(".salt-kpi__label") && k.querySelector(".salt-kpi__label").textContent === label);
    const previews = (id) => posts.filter((p) => p.kind === "preview" && (!id || p.path.includes(id)));
    const fire = (node, type) => node.dispatchEvent(new browser.window.Event(type, { bubbles: true }));
    const id = "20261007090001-dlv";
    doc.querySelector('[data-act="nav.orders"]').click();
    await until(() => doc.querySelector('[data-act="order.open"]'));

    /* his decision 6 of 11 Oct 2026: a row of the list reads nothing, and the Preview button is retired */
    ok(previews().length === 0, "Listing the orders asks the Desk for no preview: a row has none, and only the order opened has a card.");
    ok(card(id) && !button(id, "Preview") && !card(id).querySelector('[data-act="order.preview"]'), "An order's card has no Preview button.");

    /* no default delivery approval: none of RM 0, 10, 15 or Other is chosen, and nothing is read until he chooses one */
    ok(!radio(id, "RM 0").checked && !radio(id, "RM 10").checked && !radio(id, "RM 15").checked && !radio(id, "Other").checked
      && !accept(id) && previews().length === 0 && /Choose the delivery charge/.test(card(id).textContent),
      "A delivery order chooses none of RM 0, 10, 15 or Other by default, reads no figures until he chooses one, and says so: " + card(id).textContent);

    radio(id, "RM 10").checked = true;
    fire(radio(id, "RM 10"), "change");
    await until(() => accept(id));
    ok(previews(id).length === 1 && previews(id)[0].body.delivery === 10 && previews(id)[0].body.total === 200,
      "Choosing a delivery charge reads the figures by itself, once, at that charge: " + JSON.stringify(previews(id)));

    /* displayed comparison fields: the native card/margin/floor/usual tiles, not raw row JSON */
    ok(tile(id, "Their price") && tile(id, "Their price").querySelector(".salt-kpi__value").textContent === "RM 190.00"
      && /the quote is RM 200\.00/.test(tile(id, "Their price").querySelector(".salt-kpi__note").textContent)
      && tile(id, "Your margin") && tile(id, "Your margin").querySelector(".salt-kpi__value").textContent === "RM 40.00"
      && tile(id, "Your margin").querySelector(".salt-kpi__note").textContent === "on RM 160.00 cost · 21%"
      && tile(id, "Floor") && tile(id, "Floor").querySelector(".salt-kpi__value").textContent === "RM 150.00"
      && /the quote clears it/.test(tile(id, "Floor").querySelector(".salt-kpi__note").textContent)
      && tile(id, "Their usual") && tile(id, "Their usual").querySelector(".salt-kpi__value").textContent === "RM 95.00"
      && !card(id).querySelector("pre.maker-row"),
      "A successful preview shows the native card, margin, floor and usual tiles, not raw row JSON: " + card(id).textContent);
    ok(/They pay first: paid late before, 1 of 3 on time since; RM 300\.00 owed and this takes them past RM 250\.00\./.test(card(id).textContent),
      "The prepay line carries the late-payer clause from the server's late run and need: " + card(id).textContent);
    ok(accept(id).textContent === "Agree, RM 200.00 + RM 10.00", "Accept is labelled with the server's quote and delivery: " + accept(id).textContent);

    /* a redraw of the card keeps what it read, and asks the Desk for nothing more */
    const seen = previews().length;
    doc.querySelector('[data-act="maker.refresh"]').click();
    await new Promise((resolve) => setTimeout(resolve, 60));
    ok(!!accept(id) && previews().length === seen, "A redraw of the card (a read that finds the order the same) keeps its figures and Accept, and reads nothing again: " + previews().length + " of " + seen);

    /* changed input invalidates the preview, and finishing the change reads it again */
    total(id).value = "250"; fire(total(id), "input");
    ok(!accept(id) && previews().length === seen, "Editing the goods total takes Accept away at once, and reads nothing until he finishes.");
    fire(total(id), "change");
    await until(() => accept(id));
    ok(previews().length === seen + 1 && previews()[seen].body.total === 250 && accept(id).textContent === "Ask them, RM 250.00 + RM 10.00",
      "Finishing the edit reads the figures again at the new total, and a raise goes for their yes: " + JSON.stringify(previews().slice(seen)) + accept(id).textContent);
    total(id).value = "200"; fire(total(id), "input"); fire(total(id), "change");
    await until(() => accept(id) && accept(id).textContent === "Agree, RM 200.00 + RM 10.00");
    radio(id, "RM 15").checked = true;
    fire(radio(id, "RM 15"), "change");
    ok(!accept(id), "Choosing a different delivery charge takes Accept away at once.");
    await until(() => accept(id));
    ok(/\+ RM 15\.00/.test(accept(id).textContent), "and reads the figures again at the new charge: " + accept(id).textContent);

    /* success -> failed refresh: a later preview failing clears what the earlier success left usable, at once */
    previewFail = 1;
    const beforeFail = previews().length;
    radio(id, "RM 10").checked = true;
    fire(radio(id, "RM 10"), "change");
    ok(!accept(id), "A preview on its way leaves no Accept, not only once the failure is confirmed.");
    await until(() => previews().length > beforeFail);
    await until(() => /The Desk did not answer/.test(card(id).textContent));
    ok(!accept(id) && /The Desk did not answer/.test(card(id).textContent) && !!button(id, "Read the figures again"),
      "A failed preview leaves no Accept, reports why and offers to read again: " + card(id).textContent);

    /* immutable Accept retry: a preview succeeding again, then an Accept retried after a failure, sends the same body twice */
    button(id, "Read the figures again").click();
    await until(() => accept(id));
    ok(!!accept(id), "Reading the figures again restores Accept.");
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

    /* a sheet asks for the delivery charge once, on its first order: the second hides the chips, reads at nought on opening and sends nought */
    const later = "20261007090002-dlv";
    const beforeLater = previews().length;
    ok(!!card(later) && !radio(later, "RM 10") && !button(later, "Preview"), "Only the sheet's first order asks for a delivery charge; the others show no chips and no Preview.");
    await until(() => previews(later).length > 0);
    ok(previews().length === beforeLater + 1 && previews(later)[0].body.delivery === 0 && previews(later)[0].body.total === 200,
      "A later order on a sheet reads its figures on opening, at delivery 0, and the Desk is asked once: " + JSON.stringify(previews(later)));
  } finally { browser.window.close(); }
}
