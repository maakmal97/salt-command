/* test/order-why-plain.mjs: A SHEET THAT IS NOT READY SAYS SO, AND REVIEW TAKES THEM THERE (his report of 5 Nov 2026: on an associate's
 * New order, two grey answers to Who is it for? and a grey Review said nothing of what was missing). His answer: keep asking (S4 4.7,
 * nothing chosen for them), make it plain. The real page in jsdom; every name, key and place invented.
 *   W1  an associate's sheet opens with Choose one beside Who is it for?, the only question unanswered (collect and as soon as it can
 *       are already chosen), and Review is never greyed: it says it is not ready to a reader, and the line under the total says why
 *   W2  a tap on Review before an answer opens no check and takes them to the question: in view and in focus
 *   W3  answered, the tag goes, Review is ready and a tap opens the check
 *   W4  a delivery with no spot: the tap takes them to Add a spot, and the line says why
 * Each check is proved red by its own mutation (test/order-why-plain.mutations.json). */
import { startAt } from "./counter-b-kit.mjs";
import { webcrypto } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import { landingPage } from "../stmt/page.js";
import * as C from "../tools/stmt-crypto.mjs";

const wait = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
const txt = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");

async function drive() {
  const u = "abcd-efgh", pass = "fixture-pass-why", ck = await C.contentKey("test-secret", u);
  const prices = { week: { label: "This week", monday: "2026-11-02" }, soon: [],
    products: [{ product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 1, sizes: [{ q: 1, price: 100 }, { q: 2, price: 200 }] }] };
  const body = { ok: true, assoc: true, wrap: await C.wrapKey(pass, ck), session: "sess-why-abcdefghij", prices: await C.encryptWith(ck, JSON.stringify(prices)),
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-11-01", label: "November", body: "<p>Statement</p>" }] })) };
  const seen = [];
  const dom = new JSDOM(landingPage(u, "nwhy", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole(), beforeParse(win) {
    try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
    win.scrollTo = () => {}; win.open = () => null;
    win.HTMLElement.prototype.scrollIntoView = function () { seen.push(this); };
    win.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    win.fetch = async (path, init) => {
      const p = String(path), m = (init && init.method) || "GET", j = (x, s = 200) => ({ ok: s < 300, status: s, type: "basic", json: async () => x });
      if (p === "/open" || p === "/account") return j(body);
      if (p === "/orders" && m === "GET") return j({ ok: true, orders: [], claims: [] });
      if (p === "/pools") return j({ ok: true, pools: [] });
      if (p === "/links") return j({ ok: true, links: [], max: 3 });
      return j({ ok: false }, 404);
    };
  } });
  const w = dom.window, d = w.document;
  d.getElementById("un").value = u; d.getElementById("pw").value = pass;
  d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
  await wait(() => !!d.getElementById("oNew"), 600);
  await startAt(d);
  await wait(() => !!d.querySelector('#osheet [data-k="for:0"]'));
  return { w, d, seen };
}

export async function run({ ok }) {
  const A = await drive();
  try {
    const { d, seen } = A, go = () => d.getElementById("oGo"), why = () => txt(d.querySelector("#osheet .ototal .sub2"));
    const legends = () => [...d.querySelectorAll("#osheet .salt-options__legend")];
    const tagged = () => legends().filter((l) => !!l.querySelector(".salt-status")).map((l) => txt(l));
    const pressed = (k) => [...d.querySelectorAll('#osheet [data-k^="' + k + ':"]')].map((b) => b.getAttribute("aria-pressed"));
    ok(JSON.stringify(tagged()) === '["Who is it for? Choose one"]' && JSON.stringify(pressed("mode")) === '["true","false"]'
      && JSON.stringify(pressed("when")) === '["true","false"]' && !go().disabled && go().getAttribute("aria-disabled") === "true" && why() === "Say who it is for.",
      "W1 the one unanswered question says Choose one, the way and the time are chosen, Review is not greyed but says it is not ready, and why: "
      + JSON.stringify([tagged(), pressed("mode"), pressed("when"), go().disabled, go().getAttribute("aria-disabled"), why()]));
    go().click();
    const me = d.querySelector('#osheet [data-k="for:0"]');
    ok(!d.getElementById("oPlace") && d.activeElement === me && seen.includes(me),
      "W2 Review before an answer opens no check and takes them to the question: " + JSON.stringify([!!d.getElementById("oPlace"), d.activeElement && d.activeElement.getAttribute("data-k"), seen.length]));
    me.click();
    const ready = tagged().length === 0 && !go().hasAttribute("aria-disabled");
    go().click();
    ok(ready && !!d.getElementById("oPlace"), "W3 answered, the tag goes and Review opens the check: " + JSON.stringify([tagged(), !!d.getElementById("oPlace")]));
  } finally { A.w.close(); }
  const B = await drive();
  try {
    const { d, seen } = B, go = () => d.getElementById("oGo");
    d.querySelector('#osheet [data-k="for:0"]').click();
    d.querySelector('#osheet [data-k="mode:1"]').click();
    await wait(() => !!d.getElementById("spAdd"));
    go().click();
    const add = d.getElementById("spAdd");
    ok(!d.getElementById("oPlace") && d.activeElement === add && seen.includes(add) && /Pick where it is going, or add a spot[.]/.test(txt(d.querySelector("#osheet .ototal .sub2"))),
      "W4 a delivery with no spot: Review takes them to Add a spot and says why: " + JSON.stringify([d.activeElement && d.activeElement.id, txt(d.querySelector("#osheet .ototal .sub2"))]));
  } finally { B.w.close(); }
}
