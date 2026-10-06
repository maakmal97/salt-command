/* test/maker-accept-again.mjs: Counter Admin's Accept again, driven in the actual owner script. An agreed order whose pending
   row he rejected offers Preview Accept again and then Accept again, in place of Ready, the handover, cash, claims and Amend,
   as the Desk's own card does; the preview sends nothing and the accept sends only the preview's digest; a done order
   whose pending row he rejected keeps its card with the same control. */
import { webcrypto } from "node:crypto";
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
      window.scrollTo = () => {}; window.confirm = () => true;
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
    const card = (id) => [...doc.querySelectorAll("#makerReview article")].find((a) => a.querySelector("h3") && a.querySelector("h3").textContent === id);
    const button = (id, text) => card(id) && [...card(id).querySelectorAll("button")].find((b) => b.textContent === text);
    const texts = (id) => card(id) ? [...card(id).querySelectorAll("button")].map((b) => b.textContent) : [];
    doc.querySelector('[data-m="maker"]').click();
    await until(() => button("20261006090001-aga", "Preview Accept again") && button("20261006090002-ack", "Ready to collect"));

    const aga = texts("20261006090001-aga");
    ok(aga.includes("Preview Accept again")
      && !aga.some((t) => /^Ready to|^Record handover|^Record cash|^Confirm received|^Amend order/.test(t))
      && !!button("20261006090002-ack", "Ready to collect") && !texts("20261006090002-ack").includes("Preview Accept again"),
      "An agreed order whose pending row he rejected offers Preview Accept again in place of Ready, the handover, cash, claims and Amend; another does not: " + JSON.stringify(aga));

    button("20261006090001-aga", "Preview Accept again").click();
    await until(() => button("20261006090001-aga", "Accept again"));
    button("20261006090001-aga", "Accept again").click();
    await until(() => posts.length >= 2);
    ok(posts.length === 2 && posts[0].path === "/all/maker/orders/20261006090001-aga/preview" && JSON.stringify(posts[0].body) === "{}"
      && posts[1].path === "/all/maker/orders/20261006090001-aga/accept" && JSON.stringify(posts[1].body) === JSON.stringify({ hash: "h-1" }),
      "Preview Accept again sends nothing priced, and Accept again sends only the preview's digest: " + JSON.stringify(posts));

    await until(() => button("20261006090003-don", "Preview Accept again"));
    ok(!!button("20261006090003-don", "Preview Accept again"),
      "A done order whose pending row he rejected keeps its card with Preview Accept again.");
  } finally { browser.window.close(); }
}
