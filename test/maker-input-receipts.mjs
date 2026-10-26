import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { landingPage } from "../stmt/page.js";
import { MAKER_GEO_JS } from "../stmt/maker-geo.js";
import { makerGeoText } from "../tools/maker-geosync.mjs";
import { tile, tileGroup, byAct, enter } from "./maker-act.mjs";

const context = {
  ok: true, products: ["salt"],
  catalog: {
    products: [{ product: "salt", tiered: true, drift: true }],
    parties: ["CX1-ZED"], driftCustomers: ["CX1-ZED"], partners: [], partnerWaiting: [],
    driftCards: [{ code: "CX1-ZED", product: "salt", held: false, value: null, current: 0, suggest: null, why: "" }],
    houseBoards: { salt: { sizes: [0.5, 1, 2], hidden: [] } },
    tips: [{ id: "margin:zero", title: "Review margin" }]
  }
};
/* 26 Oct 2026: Their % and Make partner live on the customer's own account card (Customers > Accounts), driven through acct.pct.send and acct.partner */
const U1 = "1111-2222";
const account = { username: U1, code: "CX1-ZED", account: true, t: { owed: 0, toGet: 0, refund: 0, pend: 0 }, flag: "clear", seen: { opens: 1, last: "2026-10-01T08:00:00.000Z", how: "link" }, sent: "2026-10-01T08:00:00.000Z", issued: "2026-10-01" };
const onCard = async (doc, work) => {
  enter(doc, "customers", "accounts"); await work.quiet();
  const card = [...doc.querySelectorAll("#rlist [data-u]")].find((c) => c.querySelector(".need-who").textContent === "CX1-ZED");
  card.click(); await work.quiet(); await work.quiet();
};
const cases = [
  { label: "Record the count", path: "stock-count",
    body: { product: "salt", date: "2026-10-01", qty: 4 },
    edit(root, changed) {
      root.querySelector('input[type="date"]').value = "2026-10-01";
      root.querySelector('input[type="number"]').value = changed ? "9" : "4";
      return root.querySelector('input[type="number"]');
    } },
  { label: "Send +20%", path: "tier-set", card: true, find: (doc) => byAct(doc.getElementById("aopen"), "acct.pct.send", "CX1-ZED"), within: ".apct",
    body: { code: "CX1-ZED", product: "salt", tier: 0.2, unit: "pct" },
    edit(root, changed) {   // a whole % by the stepper, in steps of 5
      const out = root.querySelector(".apct__val"), want = changed ? 30 : 20, now = () => parseInt(out.textContent.replace("−", "-"), 10);
      while (now() !== want) root.querySelector('[data-act="' + (now() < want ? "acct.pct.up" : "acct.pct.down") + '"]').click();
      return out;
    } },
  { label: "Make partner", path: "partner", card: true, clicks: 2, find: (doc) => byAct(doc.getElementById("aopen"), "acct.partner", "CX1-ZED"), within: ".apart",
    body: { code: "CX1-ZED" },
    edit(root) { return root.querySelector("button"); } },   // nothing to edit: the partner entry is the code alone
  { label: "Send the sizes", path: "house-sizes",
    body: { product: "salt", hide: [0.5] },
    edit(root, changed) { const field = root.querySelector('input[type="checkbox"]'); field.checked = changed; return field; } },
  { label: "Hide it", path: "hush",
    body: { id: "margin:zero", until: null },
    edit(root, changed) { tile(root, "Hide for", changed ? "30" : ""); return tileGroup(root, "Hide for"); /* 27 Oct 2026 (Record's forms as settings rows): Hide for is a Segment, which answers the input event itself */ } },
  { label: "Add", path: "offset",
    body: { code: "CX1-ZED", rid: "Tx_1", date: "2026-10-01" },
    edit(root, changed) { const field = root.querySelector('input[type="date"]'); field.value = changed ? "2026-10-02" : "2026-10-01"; return field; } }
];

export async function run({ ok, pageWork }) {
  /* 26 Oct 2026: a failed retry from an account card's Send is said in the status line inside its buttons' box; one let go unhandled is counted here and fails the check below */
  const letGo = [], onLetGo = (e) => { if (e && /^Not sent/.test(e.message)) letGo.push(e.message); else throw e; };
  process.on("unhandledRejection", onLetGo);
  const generated = await import("data:text/javascript;base64," + Buffer.from(makerGeoText(
    readFileSync(process.env.SALT_MASTER || new URL("../master/salt_command.html", import.meta.url), "utf8")
  )).toString("base64"));
  for (const item of cases) {
    const route = "/all/maker/inputs/" + item.path, calls = [];
    let answer = "confirmed", clock = Date.parse("2026-10-08T04:00:00.000Z");
    const page = landingPage("", "input-receipt-nonce", { master: "fixture-master", accounts: [account] })
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
          const data = path === "/all/sheet" ? { ok: true, at: "2026-10-01T08:00:00.000Z", issue: "2026-10-01", accounts: [account], desk: { n: 2, at: "2026-10-01T08:00:00.000Z", moved: false }, stranger: "Silver" }
            : path === "/all/maker/inputs" ? context
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
    const button = () => item.find ? item.find(doc) : [...doc.querySelectorAll("#makerInputs button")].find((node) => node.textContent === item.label);
    const root = () => item.path === "stock-count" ? doc.querySelector("#makerInputs") : item.within ? button().closest(item.within) : button().closest(".maker-input");
    const edit = (changed) => item.edit(root(), changed).dispatchEvent(new win.Event("input", { bubbles: true }));
    const tap = async () => {
      const b = button();
      for (let i = 0, n = item.clicks && !saved() ? item.clicks : 1; i < n; i++) { b.click(); if (i < n - 1) await waitFor(() => !b.disabled); }   // Make partner asks once, so a fresh send is two taps; a retained retry is one
      await waitFor(() => !b.disabled);
      await work.quiet();
    };
    const saved = () => win.localStorage.getItem("saltMakerPending:" + route);
    const values = (body) => { const copy = { ...body }; delete copy.at; return JSON.stringify(copy); };
    try {
      if (item.card) await onCard(doc, work); else doc.querySelector('button[data-act="nav.record"]').click();
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
  process.off("unhandledRejection", onLetGo);
  ok(letGo.length === 0, "a refused retry on the account card's Their % is said on the card, never let go unhandled: " + JSON.stringify(letGo));
}
