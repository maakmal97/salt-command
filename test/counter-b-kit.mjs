/* test/counter-b-kit.mjs: ONE SIGNED-IN COUNTER PAGE FOR COUNTER BATCH B'S CHECKS (docs/plan-counter-batch-b.html).
 *
 * open() signs an invented account in on the real page in jsdom: its list (salt on a grid of quarters, oil on a board), its orders, an
 * associate or not, and a late part `late` days past its handover (1 the hold, 3 prices hidden, 5 locked; 0 none). Every POST to /orders
 * is kept in `posts` and answered as the Worker would, its order joining the list, so Place, Sent and the re-read run their own roads.
 * The poll's timer is captured by its interval and fired by the check, never waited for. Every code, name and place here is invented. */
import { webcrypto } from "node:crypto";

const BUILD = "c".repeat(16);
export const kl = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
export const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
export const txt = (e) => { if (!e) return ""; const c = e.cloneNode(true); c.querySelectorAll("svg,.sr").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
export const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };

/* salt on a grid from 0.5 to 25 in quarters, a unit at RM 100 to 5 units and RM 98 above, its board on it; oil on a board alone */
export function grid() { const p = []; for (let i = 0; i <= 98; i++) { const q = 0.5 + i * 0.25; p.push(+(q * (q <= 5 ? 100 : 98)).toFixed(2)); } return { min: 0.5, step: 0.25, max: 25, p }; }
export const LIST = () => ({ at: new Date().toISOString(), week: { monday: kl(0), label: "This week" }, digest: "d".repeat(64), soon: [],
  products: [{ product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 1, sizes: [{ q: 1, price: 100 }, { q: 2.5, price: 250 }, { q: 5, price: 500 }, { q: 10, price: 980 }], grid: grid() },
    { product: "oil", unit: "unit", basis: "board", sizes: [{ q: 1, price: 40 }, { q: 3, price: 115 }] }] });

export const ord = (id, status, at, extra = {}) => Object.assign({ id, status, at, product: "salt", qty: 1, unit: "unit", total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect",
  history: [{ at, status: "placed", by: "customer" }].concat(status === "placed" ? [] : [{ at, status, by: "desk" }]), msgs: [], payments: [] }, extra);
/* handed over in full: moved is the size, done */
export const done = (id, at, extra = {}) => ord(id, "done", at, Object.assign({ moved: extra.qty || 1, movedOn: at.slice(0, 10), paid: extra.total || 100 }, extra));

export async function open({ ok, pageWork, orders = [], assoc = false, late = 0, list = LIST(), poll = true, width = 0 } = {}) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");
  const u = "abcd-efgh", pass = "fixture-pass-bb", ck = await C.contentKey("test-secret", u);
  const parts = late ? [{ date: kl(-late), since: kl(-late), gotOn: kl(-late), due: kl(-late + 1), late: true, rm: 50, whole: 50, product: "salt", qty: 0.5, got: 0.5, resale: false, goods: 50, deliv: 0, less: 0, rate: 100 }] : [];
  const pay = { term: 1, hide: 3, lock: 4, window: 60, now: { rm: late ? 50 : 0, due: parts.length ? parts[0].due : null, parts }, overdue: { rm: late ? 50 : 0, parts }, coming: { rm: 0, parts: [] } };
  const stamped = { at: ago(1), body: "<p>Live</p>", owed: late ? 50 : 0, pay, buildId: BUILD };
  const body = { ok: true, assoc, wrap: await C.wrapKey(pass, ck), session: "sess-bb-abcdefghij", liveStatus: "current",
    live: Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))),
    env: await C.encryptWith(ck, JSON.stringify({ statements: [] })), prices: await C.encryptWith(ck, JSON.stringify(list)) };
  /* refuse: the products whose Place answers as a dropped request (503), until the check lifts it */
  const st = { orders: orders.map((o) => JSON.parse(JSON.stringify(o))), posts: [], polls: [], n: 0, refuse: new Set() };
  let work;
  const dom = new JSDOM(P.landingPage(u, "nbb", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
    try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
    win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = () => {};
    win.matchMedia = (q) => { const m = /min-width:\s*(\d+)px/.exec(q); return { matches: !!(m && width >= +m[1]), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }; };
    try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* no look Sheet over the page */ }
    const si = win.setInterval.bind(win);
    win.setInterval = (f, ms) => { if (ms === P.POLL_MS && poll) { st.polls.push(f); return 700 + st.polls.length; } return si(f, ms); };
    win.fetch = async (path, init) => {
      const p = String(path), m = (init && init.method) || "GET", j = (x, s = 200) => ({ ok: s < 300, status: s, json: async () => x });
      if (p === "/open" || p === "/account") return j(body);
      if (p === "/orders" && m === "GET") return j({ ok: true, orders: JSON.parse(JSON.stringify(st.orders)), claims: [] });
      if (p === "/orders" && m === "POST") {
        const b = JSON.parse(init.body);
        if (st.refuse.has(b.product)) return j({ ok: false }, 503);
        st.posts.push(b);
        const o = ord("bbnew-" + String(++st.n).padStart(3, "0"), "placed", new Date().toISOString(),
          { product: b.product, qty: b.qty, total: b.total, mode: b.mode, place: b.place || "", sheet: b.sheet || undefined });
        st.orders.push(o);
        return j({ ok: true, order: { id: o.id } });
      }
      if (p === "/links") return j({ ok: true, links: [], max: 3 });
      if (p === "/pools") return j({ ok: true, pools: [] });
      return j({ ok: false }, 404);
    };
    work = pageWork(win);
  } });
  const d = dom.window.document;
  d.getElementById("un").value = u; d.getElementById("pw").value = pass;
  d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await until(() => !d.getElementById("tabs").hidden && !!d.getElementById("pOrder").textContent);
  await work.quiet();
  const settle = () => work.quiet();
  /* one turn of the poll, its re-read awaited */
  const tick = async () => { for (const f of st.polls) f(); await work.quiet(); };
  return { w: dom.window, d, st, settle, tick, close: () => dom.window.close() };
}
