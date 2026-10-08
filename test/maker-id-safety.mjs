import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { landingPage } from "../stmt/page.js";
import { vaultEncrypt, vaultDecrypt } from "../tools/seed-vault.mjs";

export async function run({ ok }) {
  const pass = "invented-id-safety-pass";
  const initialNames = { "CX1-AB": "Invented base" };
  const names = await vaultEncrypt(pass, initialNames);
  const places = await vaultEncrypt(pass, {});
  const cases = [
    { kind: "no-name", name: "", secret: pass },
    { kind: "no-pass", name: "Zora", secret: "" },
    { kind: "wrong-pass", name: "Zora", secret: "wrong-pass" },
    { kind: "read-refused", name: "Zora", secret: pass },
    { kind: "read-offline", name: "Zora", secret: pass },
    { kind: "write-refused", name: "Zora", secret: pass },
    { kind: "fresh-read", name: "Zora", secret: pass }
  ];
  for (const fixture of cases) {
    const writes = [];
    let filed = names;
    const browser = new JSDOM(landingPage("", "id-safety-fixture", { master: "fixture-master", accounts: [] }), {
      url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(window) {
        Object.defineProperty(window, "crypto", { value: webcrypto, configurable: true });
        window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
        window.scrollTo = () => {};
        window.fetch = async (path, init) => {
          const route = String(path);
          if (route === "/all/maker/vault") {
            if (fixture.kind === "read-offline") throw new Error("invented offline read");
            if (fixture.kind === "read-refused") return Response.json({ ok: false, error: "invented refused read" }, { status: 503 });
            return Response.json({ ok: true, vault: filed, revision: 1 });
          }
          if (route === "/all/maker/vault/pair") return Response.json({ ok: true, revision: 1, names: filed, places });
          if (route === "/all/maker/inputs/add-id" && init?.method === "POST") {
            const body = JSON.parse(init.body);
            writes.push(body);
            if (fixture.kind === "write-refused") return Response.json({ ok: false, error: "invented refused save" }, { status: 503 });
            filed = body.pair.names;
            return Response.json({ ok: true, revision: 2, queued: true });
          }
          if (route === "/all/maker/inputs") return Response.json({ ok: true, products: ["salt"], catalog: {
            products: [{ product: "salt", saleReady: true, purchaseReady: true, tiered: false }],
            parties: ["CX1-AB"], associates: [], loans: [], rows: [], tierCustomers: [], tierNames: [], correctionFields: []
          } });
          if (route === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
          return Response.json({ ok: true, orders: [], drafts: [], claims: [], threads: [], bulletin: { lines: [] }, accounts: [] });
        };
      }
    });
    try {
      const document = browser.window.document;
      const section = () => [...document.querySelectorAll("#makerInputs .maker-input")]
        .find((node) => node.querySelector("h3")?.textContent === "Add ID");
      const until = async (predicate) => {
        for (let count = 0; count < 300 && !predicate(); count++) await new Promise((resolve) => setTimeout(resolve, 10));
        if (!predicate()) throw new Error("Add ID fixture did not settle: " + fixture.kind);
      };
      document.querySelector('[data-m="maker"]').click();
      await until(section);
      const form = section(), fields = form.querySelectorAll("input");
      if (fixture.kind === "fresh-read") {
        filed = await vaultEncrypt(pass, { ...initialNames, "CX9-RSD": "Invented reseed" });
      }
      fields[0].value = fixture.name; fields[1].value = "Pudu"; fields[2].value = fixture.secret;
      form.querySelector("button").click();
      await until(() => !form.querySelector('[role="status"]').textContent.includes("Preparing"));
      const status = form.querySelector('[role="status"]').textContent;
      if (fixture.kind === "write-refused") {
        ok(writes.length === 1 && filed === names && fields[0].value === fixture.name
          && /invented refused save/.test(status) && !/queued for review/.test(status),
          "a refused Counter Add ID pair save preserves the identity draft and original vault without claiming registration");
      } else if (fixture.kind === "fresh-read") {
        const opened = await vaultDecrypt(pass, filed);
        ok(writes.length === 1 && writes[0].pair.expectedRevision === 1
          && opened["CX1-AB"] === initialNames["CX1-AB"] && opened["CZ4-PUD"] === "Zora (Pudu)"
          && opened["CX9-RSD"] === "Invented reseed"
          && !JSON.stringify(writes).includes("Zora") && !JSON.stringify(writes).includes("Invented base"),
          "Counter Add ID rereads the paired vault and preserves an unrelated filed name beside the encrypted new identity");
      } else {
        ok(writes.length === 0 && filed === names && !/queued for review/.test(status),
          "Counter Add ID " + fixture.kind + " submits no identity or vault write");
      }
    } finally { browser.window.close(); }
  }
}
