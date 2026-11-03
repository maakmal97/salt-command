/* test/counter-deliver-nokey.mjs: A DELIVERY WITH A FLOOR OR UNIT IS PLACED (his report of 2 Nov 2026: "a customer ordering to deliver
 * cannot submit the order"). A spot's floor or unit is sealed to his slip key before Place sends anything (Counter Batch C). The page
 * asked for the key once a visit, so one failed read, and the practice surface whose shim answers /slip itself, refused every Place
 * with "the location could not be read" and sent nothing. Now Place asks once more, and a practice account's spot, which the Worker
 * drops anyway, is not sealed. Nothing of the spot ever travels in the clear. The real page in jsdom; every name, key and place invented.
 *   N1  a customer whose visit's first key read failed: Place asks again, seals the unit and sends one order
 *   N2  a practice account on the practice surface: the order is sent, with no spot and no /slip asked of the server
 *   N3  with no key on any ask, nothing is sent and the refusal reads as a sentence, naming no fault of their location (3 Nov 2026)
 * Each check is proved red by its own mutation (test/counter-deliver-nokey.mutations.json). */
import { startAt } from "./counter-b-kit.mjs";
import { webcrypto } from "node:crypto";
import { JSDOM, VirtualConsole } from "jsdom";
import { landingPage } from "../stmt/page.js";
import * as C from "../tools/stmt-crypto.mjs";

const kl = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
const wait = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
const txt = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const UNIT = "Unit 12A";

/* keys: what each /slip/key read answers in turn, the last repeated; 404 as a failed read, null as no key filed */
async function drive({ keys, test = false }) {
  const u = test ? "0000-0002" : "abcd-efgh", pass = test ? "0000-0000-0000-0000" : "fixture-pass-pq", ck = await C.contentKey("test-secret", u);
  const list = { at: new Date().toISOString(), week: { monday: kl(0), label: "This week" }, digest: "d".repeat(64), soon: [],
    products: [{ product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 1, sizes: [{ q: 1, price: 100 }, { q: 2.5, price: 250 }] }] };
  const stamped = { at: new Date().toISOString(), body: "<p>Live</p>", owed: 0, pay: { term: 1, hide: 3, lock: 4, window: 60, now: { rm: 0, parts: [] }, overdue: { rm: 0, parts: [] }, coming: { rm: 0, parts: [] } }, buildId: "c".repeat(16) };
  const body = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-nokey-abcdefghij", liveStatus: "current",
    live: Object.assign({ at: stamped.at, buildId: stamped.buildId }, await C.encryptWith(ck, JSON.stringify(stamped))),
    env: await C.encryptWith(ck, JSON.stringify({ statements: [] })), prices: await C.encryptWith(ck, JSON.stringify(list)) };
  const posts = [], asked = [], vc = new VirtualConsole();
  let keyAsks = 0;
  const html = test ? landingPage(u, "nnokey", null, null, { base: "/all/test/c", u }) : landingPage(u, "nnokey", null);
  const dom = new JSDOM(html, { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, beforeParse(win) {
    try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
    win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = () => {};
    win.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    win.fetch = async (path, init) => {
      const raw = String(path), p = test && raw.startsWith("/all/test/c/") ? raw.slice("/all/test/c".length) : raw, m = (init && init.method) || "GET";
      const j = (x, s = 200) => ({ ok: s < 300, status: s, type: "basic", json: async () => x });
      asked.push(m + " " + raw);
      if (p === "/open" || p === "/account") return j(body);
      if (p === "/slip/key") { const k = keys[Math.min(keyAsks++, keys.length - 1)]; return k === 404 ? j({ ok: false }, 404) : j({ ok: true, key: k }); }
      if (p === "/orders" && m === "GET") return j({ ok: true, orders: [], claims: [] });
      if (p === "/orders" && m === "POST") { const b = JSON.parse(init.body); posts.push(b);
        return j({ ok: true, order: { id: "20261102010000-nokey", product: b.product, qty: b.qty, status: "placed", mode: b.mode, at: new Date().toISOString(), total: b.total, history: [], msgs: [] } }); }
      if (p === "/pools") return j({ ok: true, pools: [] });
      if (p === "/links") return j({ ok: true, links: [], max: 3 });
      return j({ ok: false }, 404);
    };
  } });
  const w = dom.window, d = w.document;
  try {
    if (!test) { d.getElementById("un").value = u; d.getElementById("pw").value = pass;
      d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true })); }
    await wait(() => !d.getElementById("tabs").hidden && !!d.getElementById("pOrder").textContent, 1200);
    const ot = d.querySelector('button[data-t="order"]'); if (ot) ot.click();
    await wait(() => !!d.getElementById("oNew"), 600);
    await startAt(d);
    await wait(() => !!d.querySelector('#osheet [data-k="mode:1"]'));
    d.querySelector('#osheet [data-k="mode:1"]').click();
    await wait(() => !!d.getElementById("spAdd"));
    d.getElementById("spAdd").click();
    await wait(() => !!d.querySelector('#osheet [data-k="spn:0"]') && !!d.getElementById("spUnit"));
    d.querySelector('#osheet [data-k="spn:0"]').click();
    await wait(() => !!d.getElementById("spUnit"));
    const x = d.getElementById("spUnit"); x.value = UNIT; x.dispatchEvent(new w.Event("input", { bubbles: true }));
    const a = d.getElementById("oWhere"); a.value = "Veloria"; a.dispatchEvent(new w.Event("input", { bubbles: true }));
    d.getElementById("spUse").click();
    await wait(() => !d.getElementById("spUse") && d.getElementById("oGo") && !d.getElementById("oGo").disabled);
    d.getElementById("oGo").click();
    await wait(() => !!d.getElementById("oPlace"));
    d.getElementById("oPlace").click();
    const note = () => txt(d.querySelector('#osheet .salt-sheet__foot [role="status"]'));
    await wait(() => posts.length > 0 || /could not be read/i.test(note()));
    return { posts, keyAsks, said: note(), slipAsked: asked.filter((s) => /slip/.test(s)).length };
  } finally { w.close(); }
}

export async function run({ ok }) {
  const pair = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey), pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  const clear = (b) => !JSON.stringify(b).includes(UNIT);

  const r1 = await drive({ keys: [404, pub] });
  const pin1 = r1.posts[0] && r1.posts[0].pin;
  ok(r1.posts.length === 1 && !!pin1 && !!pin1.ct && !!pin1.epk && clear(r1.posts[0]) && r1.keyAsks === 2,
    "N1: after a failed key read, Place asks again, seals the unit and sends the order: " + JSON.stringify({ posts: r1.posts.length, sealed: !!(pin1 && pin1.ct), asks: r1.keyAsks, said: r1.said }));

  const r2 = await drive({ keys: [pub], test: true });
  ok(r2.posts.length === 1 && !r2.posts[0].pin && clear(r2.posts[0]) && r2.slipAsked === 0,
    "N2: a practice account's delivery with a unit is sent, with no spot and no /slip asked of the server: " + JSON.stringify({ posts: r2.posts.length, pin: !!(r2.posts[0] && r2.posts[0].pin), slip: r2.slipAsked, said: r2.said }));

  const r3 = await drive({ keys: [null] });
  ok(r3.posts.length === 0 && /^Your spot could not be sent just now, so tap Place again\.$/.test(r3.said),
    "N3: with no key on any ask nothing is sent, and the refusal says to tap Place again, not to share the location (3 Nov 2026): " + JSON.stringify({ posts: r3.posts.length, said: r3.said }));
}
