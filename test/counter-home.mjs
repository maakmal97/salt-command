/* test/counter-home.mjs: HOME'S THREE NEW PARTS (Counter Batch A, P9, his decisions of 18 Oct 2026).
 *
 * Their latest open order, one element that is a pill sticking above the App bar and the pay foot on a phone and a banner under To pay now
 * from 1080px; the nearest reward, an associate's alone, never a level; This year, off the live statement's own lines. To pay now and the
 * overdue gate still lead Home. Every assertion observes a signed-in page in jsdom, the desktop by rewriting its width queries to `all` (as
 * home-pay-foot.mjs does); the geometry itself is measured in a real browser at the render pass. Each was proved red by its own mutation
 * (test/counter-home.mutations.json, run with tools/section.mjs). Every code, name and password here is invented.
 *   1  the live order: the newest open one, its state, its point and pin; a tap opens it; nothing when every order has ended
 *   2  the cascade: one element, sticky on a phone over the bar and the foot by --hfoot, in the grid under To pay now from 1080px
 *   3  --hfoot is the pay foot's own height, and nothing when there is nothing to pay
 *   4  the reward: the nearest across the books, its meter and the card's words, a tap to Rewards; never a level; nobody else's
 *   5  This year: the orders and each mark's units off this year's lines, a cancelled line not counted, a bar each month; no month words
 *   6  To pay now and the overdue gate lead Home; the new parts stand after Needs you and Coming up */
import { webcrypto } from "node:crypto";

const BUILD = "b".repeat(16);

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const W = await import("../stmt/words.js");
  const SO = await import("../src/orders.js");
  const { JSDOM } = await import("jsdom");
  const t = (e) => { if (!e) return ""; const c = e.cloneNode(true); c.querySelectorAll("svg").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
  const klNow = new Date(Date.now() + 8 * 3600e3), Y = String(klNow.getUTCFullYear()), MM = ("0" + (klNow.getUTCMonth() + 1)).slice(-2);
  const kl = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  /* a line of the live statement, as tools/make_statements.mjs writes one */
  const line = (m, product, said, extra = "") => '<div class="salt-lines__row' + extra + '" role="row" data-m="' + m + '"><div class="salt-lines__date" role="cell">1 Jan</div>'
    + '<div class="salt-lines__what" role="cell">' + P.mtileSvg(product, said) + '</div><div class="salt-lines__amount" role="cell">RM 10.00</div>'
    + '<div class="salt-lines__state salt-lines__state--verdigris" role="cell">settled</div></div>';
  const liveBody = '<h2 class="stmth">Statement of account</h2><div class="salt-lines" role="table" aria-label="Your orders">'
    + line(Y + "-01", "salt", "2.5 units") + line(Y + "-" + MM, "salt", "1 unit") + line(Y + "-" + MM, "oil", "3 units")
    + line(Y + "-" + MM, "salt", "4 units", " salt-lines__row--cancelled") + line(String(+Y - 1) + "-12", "salt", "7 units") + "</div>"
    + '<h3 class="whol gap2">Refunds</h3><div class="salt-lines" role="table" aria-label="Refunds"><div class="salt-lines__row" role="row" data-m="' + Y + "-" + MM + '">'
    + '<div class="salt-lines__date" role="cell">1 Jan</div><div class="salt-lines__what" role="cell">Overpayment returned to you</div></div></div>';
  const card = { products: [
    { product: "salt", unit: "unit", summary: {}, lines: [], reward: { earned: 42.5, taken: 20, left: 22.5, next: 0.4, held: false } },
    { product: "oil", unit: "unit", summary: {}, lines: [], reward: { earned: 1, taken: 0, left: 1, next: 0.25, held: false } },
    { product: "rice", unit: "unit", summary: {}, lines: [], reward: null }] };
  const ord = (id, status, at, extra = {}) => Object.assign({ id, status, at, product: "salt", qty: 2, unit: "unit", total: 20, delivery: 0, paid: 0, moved: 0, mode: "collect",
    history: [{ at, status: "placed", by: "customer" }].concat(status === "placed" ? [] : [{ at: ago(1), status, by: "desk" }]), msgs: [], payments: [] }, extra);
  const wins = [];
  const open = async ({ orders = [], assoc = false, withCard = false, toPay = 0, footPx = 0 }) => {
    const u = "abcd-efgh", pass = "fixture-pass-p9", ck = await C.contentKey("test-secret", u);
    const parts = toPay ? [{ date: kl(-2), since: kl(-1), due: kl(2), late: false, rm: toPay, whole: toPay, product: "salt", qty: 1, got: 1, gotOn: kl(-1), resale: false, goods: toPay, deliv: 0, less: 0, rate: toPay }] : [];
    const pay = { term: 1, hide: 3, lock: 4, window: 60, now: { rm: toPay, due: parts.length ? parts[0].due : null, parts }, overdue: { rm: 0, parts: [] }, coming: { rm: 0, parts: [] } };
    const stamped = { at: ago(1), body: liveBody, owed: toPay, pay, buildId: BUILD };
    const body = { ok: true, assoc, wrap: await C.wrapKey(pass, ck), session: "sess-p9", liveStatus: "current",
      live: Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))),
      env: await C.encryptWith(ck, JSON.stringify({ statements: [] })),
      prices: await C.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), week: { monday: kl(0), label: "This week" },
        products: [{ product: "salt", unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }, { q: 2, price: 20 }] }], soon: [] })) };
    if (withCard) body.card = await C.encryptWith(ck, JSON.stringify(card));
    let work;
    const dom = new JSDOM(P.landingPage(u, "nh9", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.open = () => null;
      try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* no look Sheet over the page */ }
      if (footPx) Object.defineProperty(win.HTMLElement.prototype, "offsetHeight", { configurable: true, get() { return this.id === "homeFoot" ? footPx : 0; } });
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        const j = (p === "/open" || p === "/account") ? body : (p === "/orders" && m === "GET") ? { ok: true, orders, claims: [] } : (p === "/links" ? { ok: true, links: [], max: 3 } : null);
        return { ok: !!j, status: j ? 200 : 404, json: async () => j || { ok: false } };
      };
      work = pageWork(win);
    } });
    wins.push(dom.window);
    const d = dom.window.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden && !!d.getElementById("pOrder").textContent);
    if (orders.length) await until(() => !!d.querySelector("#hLive.hlive"), 120);
    await work.quiet();
    return { w: dom.window, d };
  };
  const holds = (q, px) => q.split(",").some((one) => { const fs = one.split(/\band\b/).map((s) => s.trim()).filter(Boolean);
    return fs.length > 0 && fs.every((f) => { const x = /^\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)$/.exec(f); return !!x && (x[1] === "min" ? px >= +x[2] : px <= +x[2]); }); });
  const at = (html, px) => html.replace(/@media\s*([^{]+)\{/g, (m, q) => (holds(q, px) ? "@media all{" : m));

  try {
    /* ---- 1: the live order */
    const done = ord("o-done", "done", ago(400)), conf = ord("o-conf", "acknowledged", ago(200)),
      ready = ord("o-ready", "ready", ago(50), { point: "A2", pointAt: { lat: 3.14786, lng: 101.69369 } }), ended = ord("o-new-end", "cancelled", ago(5));
    const A = await open({ orders: [done, conf, ready, ended] });
    const live = A.d.getElementById("hLive"), chip = live && live.querySelector(".hlive__state"), pin = live && live.querySelector("a.salt-pin");
    const L = { id: live && live.getAttribute("data-live"), n: A.d.querySelectorAll(".hlive").length, chip: t(chip), glyph: !!(chip && chip.querySelector(".salt-status__glyph")),
      point: t(live && live.querySelector(".hlive__point")), pin: pin ? pin.getAttribute("href") : "", when: t(live && live.querySelector(".hlive__when")) };
    ok(L.id === "o-ready" && L.n === 1 && L.chip === "Ready to collect" && L.glyph && L.point === "At Point A2" && /3\.14786,101\.69369/.test(L.pin) && /^\d\d:\d\d$|^\d\d \w{3} \d{4}$/.test(L.when),
      "Home carries their newest order still open, ended ones passed over: its state with its glyph, the moment it last moved, the point and its pin: " + JSON.stringify(L));
    live.querySelector(".hlive__go").click();
    await until(() => !!A.d.querySelector('#pOrder .oscreen[data-order="o-ready"]'), 60);
    ok(!A.d.getElementById("pOrder").hidden && !!A.d.querySelector('#pOrder .oscreen[data-order="o-ready"]'), "a tap on it opens that order in Orders");
    const B = await open({ orders: [done, ended] });
    ok(!B.d.getElementById("hLive").hasChildNodes() && !B.d.querySelector(".hlive"), "with every order ended there is no live order on Home");

    /* ---- 2: the cascade */
    const cs = (e) => A.w.getComputedStyle(e), hl = A.d.getElementById("hLive"), bar = A.d.querySelector("nav.salt-appbar");
    const ph = { position: cs(hl).position, bottom: cs(hl).bottom, z: +cs(hl).zIndex, zBar: +cs(bar).zIndex, next: hl.nextElementSibling && hl.nextElementSibling.id, head: cs(hl.querySelector(".hlive__h")).display, tap: cs(hl.querySelector(".hlive__go")).minHeight };
    ok(ph.position === "sticky" && /var\(--salt-bar-h\)/.test(ph.bottom) && /var\(--hfoot/.test(ph.bottom) && ph.z > 0 && ph.z < ph.zBar && ph.next === "homeFoot" && ph.head === "none" && ph.tap === "var(--salt-tap)",
      "on a phone it is a pill sticking above the App bar and above the pay foot by the foot's height, behind the bar, with no heading, 44px tall: " + JSON.stringify(ph));
    const wide = new JSDOM(at(P.landingPage("abcd-efgh", "nh9w", null), 1280), { pretendToBeVisual: true }), wd = wide.window.document;
    wd.getElementById("hLive").className = "hlive"; wd.getElementById("hLive").innerHTML = '<button class="hlive__go"><span class="hlive__h">x</span></button>';
    const wcs = (e) => wide.window.getComputedStyle(e), rule = (sel) => [...wd.styleSheets].flatMap((s) => [...s.cssRules]).flatMap((r) => r.cssRules ? [...r.cssRules] : [r]).filter((r) => r.selectorText === sel).pop();
    const wv = { position: wcs(wd.getElementById("hLive")).position, row: rule(".hlive") && rule(".hlive").style.getPropertyValue("grid-row"), foot: rule(".payfoot") && rule(".payfoot").style.getPropertyValue("grid-row"),
      head: wcs(wd.querySelector(".hlive__h")).display, n: wd.querySelectorAll("#hLive").length };
    ok(wv.position === "static" && wv.row === "2" && wv.foot === "1" && wv.head === "block" && wv.n === 1,
      "from 1080px the same element is a banner in the flow, its heading shown, in the row under To pay now's: one element, so never both: " + JSON.stringify(wv));
    wide.window.close();

    /* ---- 3: --hfoot */
    const F = await open({ orders: [conf], toPay: 30, footPx: 96 }), F0 = await open({ orders: [conf], footPx: 96 });
    const hf = F.d.getElementById("pHome").style.getPropertyValue("--hfoot"), hf0 = F0.d.getElementById("pHome").style.getPropertyValue("--hfoot");
    ok(!F.d.getElementById("homeFoot").hidden && hf === "96px" && F0.d.getElementById("homeFoot").hidden && hf0 === "0px",
      "the pill's offset is the pay foot's own height while the foot shows, and nothing when there is nothing to pay: " + JSON.stringify({ hf, hf0 }));

    /* ---- 4: the reward */
    const R = await open({ orders: [conf], assoc: true, withCard: true }), rb = R.d.querySelector("#hReward .hreward");
    const rw = { head: t(R.d.querySelector("#hReward .hlab")), left: t(rb && rb.querySelector(".hreward__left")), pc: t(rb && rb.querySelector(".salt-meter__line b")),
      fill: rb ? rb.querySelector(".salt-meter").style.getPropertyValue("--salt-fill") : "", n: R.d.querySelectorAll("#hReward .hreward").length };
    const levels = SO.LEVEL_WORDS.filter((w) => new RegExp("\\b" + w + "\\b", "i").test(t(R.d.getElementById("hReward"))));
    ok(rw.head === "Your reward" && rw.left === "Reward: 22.5 units to take. Ask on any order to take it." && rw.pc === "40%" && rw.fill === "40" && rw.n === 1 && !levels.length,
      "an associate's Home shows the reward nearest its next unit, its meter and what is theirs to take, in the card's words and never a level: " + JSON.stringify({ rw, levels }));
    rb.click();
    ok(!R.d.getElementById("pCard").hidden, "a tap on it opens Rewards");
    const N = await open({ orders: [conf], assoc: false, withCard: true });
    ok(!N.d.getElementById("hReward").hasChildNodes(), "and a customer who is not an associate has none");

    /* ---- 5: This year */
    const y = A.d.querySelector("#hYear .hyear"), tiles = y ? [...y.querySelectorAll(".hyear__units .mtile")] : [];
    const d0 = (h) => { const x = new JSDOM(h).window.document.querySelector("path"); return x ? x.getAttribute("d") : ""; };
    const bars = y ? [...y.querySelectorAll(".hyear__bar")].map((b) => b.getAttribute("data-n")) : [];
    const want = Array.from({ length: +MM }, (_, i) => String((i === 0 ? 1 : 0) + (i === +MM - 1 ? 2 : 0)));
    const yv = { head: t(A.d.querySelector("#hYear .hlab")), n: t(y && y.querySelector(".hyear__n")), units: tiles.map((x) => t(x.querySelector(".mq"))),
      marks: tiles.map((x) => x.querySelector("svg path").getAttribute("d")), bars, aria: y ? y.querySelector(".hyear__bars").getAttribute("aria-label") : "" };
    ok(yv.head === "This year" && yv.n === "3 orders" && yv.units.join() === "3.5 units,3 units" && yv.marks.join() === [d0(P.psymSvg("salt", 24)), d0(P.psymSvg("oil", 24))].join()
      && bars.join() === want.join() && /^Orders: Jan \d/.test(yv.aria),
      "This year counts this year's lines, a cancelled one and last year's not counted, each mark's units its own, and a bar a month to this one: " + JSON.stringify({ yv, want }));
    const monthWords = Object.entries(W.EN).filter(([, v]) => /monthly|by month|each month/i.test(String(v)));
    ok(!monthWords.length, "no word on the Counter says monthly, by month or each month: " + JSON.stringify(monthWords));

    /* ---- 6: To pay now and the overdue gate lead */
    const c1 = [...A.d.querySelectorAll("#pHome > .hcol")[0].children].map((n) => n.id), c2 = [...A.d.querySelectorAll("#pHome > .hcol")[1].children].map((n) => n.id);
    ok(c1.slice(0, 3).join() === "today,payHead,hNeeds" && c2.indexOf("hComing") >= 0 && c2.indexOf("hReward") > c2.indexOf("hComing") && c2.indexOf("hYear") > c2.indexOf("hComing")
      && [...A.d.getElementById("pHome").children].map((n) => n.id || n.className.split(" ")[0]).join(" ") === "hcol hcol hLive homeFoot",
      "To pay now and the overdue gate head the first column under the Today card, Needs you after them, and the reward and This year stand after Coming up: " + JSON.stringify({ c1, c2 }));
  } catch (e) { ok(false, "counter-home stopped on an error: " + (e && e.stack)); }
  finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
