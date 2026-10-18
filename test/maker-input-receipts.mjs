import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { landingPage } from "../stmt/page.js";
import { MAKER_GEO_JS } from "../stmt/maker-geo.js";
import { makerGeoText } from "../tools/maker-geosync.mjs";
import { tile, tileGroup } from "./maker-act.mjs";

const context = {
  ok: true, products: ["salt"],
  catalog: {
    products: [{ product: "salt", tiered: true, drift: true }],
    parties: ["CX1-ZED"], driftCustomers: ["CX1-ZED"], driftCards: [],
    houseBoards: { salt: { sizes: [0.5, 1, 2], hidden: [] } },
    tips: [{ id: "margin:zero", title: "Review margin" }]
  }
};
const cases = [
  { label: "Record the count", path: "stock-count",
    body: { product: "salt", date: "2026-10-01", qty: 4 },
    edit(root, changed) {
      root.querySelector('input[type="date"]').value = "2026-10-01";
      root.querySelector('input[type="number"]').value = changed ? "9" : "4";
      return root.querySelector('input[type="number"]');
    } },
  { label: "Send their %", path: "tier-set",
    body: { code: "CX1-ZED", product: "salt", tier: 0.2 },
    edit(root, changed) { const field = root.querySelector('input[type="number"]'); field.value = changed ? "0.3" : "0.2"; return field; } },
  { label: "Send the sizes", path: "house-sizes",
    body: { product: "salt", hide: [0.5] },
    edit(root, changed) { const field = root.querySelector('input[type="checkbox"]'); field.checked = changed; return field; } },
  { label: "Hide it", path: "hush",
    body: { id: "margin:zero", until: null },
    edit(root, changed) { tile(root, "Hide for", changed ? "30" : ""); return tileGroup(root, "Hide for").querySelector("input:checked"); } },
  { label: "Add", path: "offset",
    body: { code: "CX1-ZED", rid: "Tx_1", date: "2026-10-01" },
    edit(root, changed) { const field = root.querySelector('input[type="date"]'); field.value = changed ? "2026-10-02" : "2026-10-01"; return field; } }
];

export async function run({ ok, pageWork }) {
  const generated = await import("data:text/javascript;base64," + Buffer.from(makerGeoText(
    readFileSync(process.env.SALT_MASTER || new URL("../master/salt_command.html", import.meta.url), "utf8")
  )).toString("base64"));
  for (const item of cases) {
    const route = "/all/maker/inputs/" + item.path, calls = [];
    let answer = "confirmed", clock = Date.parse("2026-10-08T04:00:00.000Z");
    const page = landingPage("", "input-receipt-nonce", { master: "fixture-master", accounts: [] })
      .replace("var makerGeo=" + MAKER_GEO_JS, "var makerGeo=" + generated.MAKER_GEO_JS);
    const dom = new JSDOM(page, {
      url: "https://site.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(win) {
        Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
        win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
        const RealDate = win.Date;
        win.Date = class extends RealDate {
          constructor(...args) { super(...(args.length ? args : [clock++])); }
          static now() { return clock++; }
        };
        win.fetch = async (path, init) => {
          path = String(path);
          if (path === route && init?.method === "POST") {
            calls.push({ bytes: init.body, body: JSON.parse(init.body),
              retained: win.localStorage.getItem("saltMakerPending:" + route) });
            if (answer === "lost") throw new TypeError("Lost answer");
            return { ok: true, status: 200, json: async () =>
              answer === "unknown" ? { ok: "uncertain" } : answer === "empty" ? {} : { ok: true } };
          }
          const data = path === "/all/maker/inputs" ? context
            : path === "/all/maker/offsets" ? { ok: true, offers: [
              { code: "CX1-ZED", rid: "Tx_1", units: 1, rm: 100, saleDate: "2026-10-01" }
            ] }
              : path === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
                : { ok: true, accounts: [], orders: [], drafts: [], refs: [], tiers: [] };
          return { ok: true, status: 200, json: async () => data };
        };
      }
    });
    const win = dom.window, doc = win.document, work = pageWork(win);
    const waitFor = async (predicate) => {
      for (let i = 0; i < 500 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
      if (!predicate()) throw new Error(item.label + ": page did not finish its action: " + root()?.textContent);
    };
    const button = () => [...doc.querySelectorAll("#makerInputs button")].find((node) => node.textContent === item.label);
    const root = () => item.path === "stock-count" ? doc.querySelector("#makerInputs") : button().closest(".maker-input");
    const edit = (changed) => item.edit(root(), changed).dispatchEvent(new win.Event("input", { bubbles: true }));
    const tap = async () => {
      const b = button();
      b.click();
      await waitFor(() => !b.disabled);
      await work.quiet();
    };
    const saved = () => win.localStorage.getItem("saltMakerPending:" + route);
    const values = (body) => { const copy = { ...body }; delete copy.at; return JSON.stringify(copy); };
    try {
      doc.querySelector('button[data-act="nav.record"]').click();
      await waitFor(() => !!button());
      await work.quiet();
      edit(false);
      await tap();
      ok(!!calls[0] && values(calls[0].body) === JSON.stringify(item.body) && Number.isFinite(Date.parse(calls[0].body.at)),
        item.label + ": generated owner page sends the exact endpoint fields and an ISO timestamp");
      if (!calls[0]) continue;
      ok(!!calls[0].retained && JSON.stringify(JSON.parse(calls[0].retained).body) === JSON.stringify(calls[0].body),
        item.label + ": full exact request is stored before transport");
      await tap();
      ok(calls[1].body.at !== calls[0].body.at && values(calls[1].body) === values(calls[0].body) && !saved(),
        item.label + ": confirmed same-value intentional action gets a fresh request");

      answer = "lost";
      await tap();
      const uncertain = calls[2];
      ok(!!saved() && JSON.stringify(JSON.parse(saved()).body) === JSON.stringify(uncertain.body),
        item.label + ": lost answer retains the full exact body on the device");
      await tap();
      ok(calls[3].bytes === uncertain.bytes && !!saved(),
        item.label + ": repeated lost-answer retry preserves the full exact body");
      edit(true);
      answer = "confirmed";
      await tap();
      ok(calls[4].bytes === uncertain.bytes && !saved(),
        item.label + ": changed fields cannot mutate an uncertain request and confirmed retry releases it");
      edit(false);
      await tap();
      ok(calls[5].body.at !== uncertain.body.at && values(calls[5].body) === values(uncertain.body),
        item.label + ": successful retry releases the timestamp before the next same-value action");

      answer = "unknown";
      await tap();
      const unknown = calls[6];
      ok(!!saved() && JSON.stringify(JSON.parse(saved()).body) === JSON.stringify(unknown.body),
        item.label + ": a 200 without confirmed completion retains its exact request");
      edit(true);
      answer = "confirmed";
      await tap();
      ok(calls[7].bytes === unknown.bytes && !saved(),
        item.label + ": unconfirmed 200 retries unchanged despite edits, then releases on confirmation");
      answer = "empty";
      await tap();
      const empty = calls[8];
      ok(!!saved() && JSON.stringify(JSON.parse(saved()).body) === JSON.stringify(empty.body),
        item.label + ": an empty 200 retains its exact request");
      edit(false);
      answer = "confirmed";
      await tap();
      ok(calls[9].bytes === empty.bytes && !saved(),
        item.label + ": an empty 200 retries unchanged despite edits, then releases on confirmation");
      if (item.path === "hush") {
        const field = root().querySelector("select"), option = doc.createElement("option");
        option.value = "bad tip"; field.appendChild(option); field.value = option.value;
        field.dispatchEvent(new win.Event("input", { bubbles: true }));
        const before = calls.length;
        await tap();
        ok(calls.length === before && root().textContent.includes("This saved entry cannot be sent"),
          item.label + ": the generated TIP_ID dependency refuses an invalid tip before transport");
      }
      if (item.path === "offset") {
        const refused = [];
        for (const patch of [{ qty: 1 }, { notes: "invented" }, { rid: "bad rid" }, { at: "now" }, { date: null }]) {
          win.localStorage.setItem("saltMakerPending:" + route, JSON.stringify({
            path: route, body: { ...unknown.body, ...patch }
          }));
          const b = button(), before = calls.length;
          b.click();
          await waitFor(() => !b.disabled);
          await work.quiet();
          refused.push(calls.length === before && root().textContent.includes("This saved entry cannot be sent"));
        }
        ok(refused.every(Boolean), item.label + ": unsupported figures, prose, row id, timestamp and date are refused before transport");
      }
    } finally {
      win.close();
    }
  }
}
