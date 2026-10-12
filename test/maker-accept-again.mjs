/* test/maker-accept-again.mjs: Counter Admin's Accept again, driven in the actual owner script. An agreed order whose pending
   row he rejected reads its preview when it is opened (his decision 6 of 11 Oct 2026: there is no Preview button) and then offers
   Accept again, in place of Ready, the handover, cash, claims and Amend, as the Desk's own card does; the preview sends nothing and the
   accept sends only the preview's digest; a row of the list reads nothing; a done order whose pending row he rejected keeps its card
   with the same control. */
import { webcrypto } from "node:crypto";
import { cardOf } from "./maker-act.mjs";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";

export async function run({ ok }) {
  const posts = [];
  const orderOf = (id, status, patch = {}) => ({ id, u: "abcd-efgh", product: "salt", qty: 3, total: 285, delivery: 15, status, mode: "collect", history: [], ...patch });
  const reviewBody = { ok: true, drafts: [], orders: [
    orderOf("20261006090001-aga", "acknowledged", { again: ["ack"] }),
    orderOf("20261006090002-ack", "acknowledged"),
    orderOf("20261006090003-don", "done", { again: ["ack"] })] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {};
      window.fetch = async (path, init) => {
        if (init && init.method === "POST" && String(path).startsWith("/all/maker/orders/")) {
          posts.push({ path: String(path), body: JSON.parse(init.body) });
          if (String(path).endsWith("/preview")) return Response.json({ ok: true, again: true, hash: "h-" + posts.length, total: 285, delivery: 15 });
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
    const texts = (id) => card(id) ? [...card(id).querySelectorAll("button")].map((b) => b.textContent) : [];
    doc.querySelector('[data-act="nav.orders"]').click();
    await until(() => doc.querySelector('[data-act="order.open"]'));
    ok(posts.length === 0, "Listing the orders reads no preview: a row has none.");
    await until(() => button("20261006090002-ack", "Ready to collect"));
    const ack = texts("20261006090002-ack");
    ok(posts.length === 0, "and an order with nothing rejected reads none when it is opened.");

    await until(() => button("20261006090001-aga", "Check and agree again"));
    const aga = texts("20261006090001-aga");
    ok(aga.includes("Check and agree again") && !aga.some((t) => /Preview/.test(t))
      && !aga.some((t) => /^Ready to|^Handed over|^Record cash|^Record payment|^Change the order/.test(t))
      && !ack.includes("Check and agree again"),
      "An agreed order whose pending row he rejected reads its preview when opened, with no Preview button, and offers Accept again in place of Ready, the handover, cash, claims and Amend; another does not: " + JSON.stringify(aga));

    button("20261006090001-aga", "Check and agree again").click();
    await until(() => posts.length >= 2);
    ok(posts.length === 2 && posts[0].path === "/all/maker/orders/20261006090001-aga/preview" && JSON.stringify(posts[0].body) === "{}"
      && posts[1].path === "/all/maker/orders/20261006090001-aga/accept" && JSON.stringify(posts[1].body) === JSON.stringify({ hash: "h-1" }),
      "Opening it sent one preview with nothing priced, and Accept again sends only the preview's digest: " + JSON.stringify(posts));

    await until(() => button("20261006090003-don", "Check and agree again"));
    ok(!!button("20261006090003-don", "Check and agree again"),
      "A done order whose pending row he rejected keeps its card with Accept again, read when it is opened.");
  } finally { browser.window.close(); }
}
