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
  const open = async ({ orders = [], assoc = false, withCard = false, toPay = 0 }) => {
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
    if (orders.length) await until(() => !!d.querySelector("#hLive[data-live]"), 120);
    await work.quiet();
    return { w: dom.window, d };
  };
  try {
    /* 16 Nov 2026, the move to Ambient: the live order is the dock's mini bar, the reward a meter row, This year Ambient's bars and a row of units
       a mark, the foot Ambient's own (one pill, the tile standing in the head); the 15 Nov geometry checks (a sticky pill by --hfoot, a banner
       from 1080px) are Ambient's to keep, so each is re-aimed at what stands on the page now. */
    /* ---- 1: the live order */
    const done = ord("o-done", "done", ago(400)), conf = ord("o-conf", "acknowledged", ago(200)),
      ready = ord("o-ready", "ready", ago(50), { point: "A2", pointAt: { lat: 3.14786, lng: 101.69369 } }), ended = ord("o-new-end", "cancelled", ago(5));
    const A = await open({ orders: [done, conf, ready, ended] });
    const live = A.d.getElementById("hLive"), pin = live && live.querySelector("a.salt-pin");
    const L = { id: live && live.getAttribute("data-live"), n: A.d.querySelectorAll("[data-live]").length, chip: t(live && live.querySelector(".amb-mini__title")),
      sub: t(live && live.querySelector(".amb-mini__sub")), pin: pin ? pin.getAttribute("href") : "", kind: !!(live && live.querySelector(".amb-thumb--mark.amb-kind-1")) };
    ok(L.id === "o-ready" && L.n === 1 && L.chip === "Ready to collect" && /^(\d\d:\d\d|\d\d \w{3} \d{4}), At Point A2$/.test(L.sub) && /3\.14786,101\.69369/.test(L.pin) && L.kind,
      "Home carries their newest order still open, ended ones passed over: its state, the moment it last moved, the point and its pin: " + JSON.stringify(L));
    live.querySelector(".hlivego").click();
    await until(() => !!A.d.querySelector('#pOrder .oscreen[data-order="o-ready"]'), 60);
    ok(!A.d.getElementById("pOrder").hidden && !!A.d.querySelector('#pOrder .oscreen[data-order="o-ready"]'), "a tap on it opens that order in Orders");
    const B = await open({ orders: [done, ended] });
    ok(!B.d.getElementById("hLive").hasChildNodes() && !B.d.querySelector("[data-live]") && B.d.getElementById("hLive").hidden, "with every order ended there is no live order on Home");

    /* ---- 2: where it stands: Ambient's mini bar, in the dock above the tabs, Home's alone */
    const C2 = await open({ orders: [conf] }), hl = C2.d.getElementById("hLive");
    const dock = C2.d.querySelector("#tabs > .amb-dock");
    ok(hl.classList.contains("amb-mini") && hl.parentElement === dock && hl.nextElementSibling === dock.querySelector(".amb-tabbar") && !hl.hidden && !C2.d.querySelector("#pHome #hLive"),
      "it is Ambient's mini bar, the dock's first child above the tabs, and Home's pay foot and heights are Ambient's own: " + JSON.stringify({ cls: hl.className, parent: hl.parentElement.className }));
    C2.d.getElementById("tOrder").click();
    const away = hl.hidden;
    C2.d.getElementById("tHome").click();
    ok(away && !C2.d.getElementById("hLive").hidden, "it shows on Home and on no other place: " + JSON.stringify({ away, back: C2.d.getElementById("hLive").hidden }));

    /* ---- 3: the pay foot is Ambient's: one pill, no height written by the page */
    const F = await open({ orders: [conf], toPay: 30 }), F0 = await open({ orders: [conf] });
    const ff = F.d.getElementById("homeFoot");
    ok(!ff.hidden && ff.classList.contains("amb-foot") && ff.children.length === 1 && ff.firstElementChild.classList.contains("amb-pill--block") && F0.d.getElementById("homeFoot").hidden
      && !F.d.getElementById("pHome").style.getPropertyValue("--hfoot"),
      "the foot shows while something is to pay, holds the one pill and nothing else, and the page writes no height for it: " + JSON.stringify({ n: ff.children.length, hidden0: F0.d.getElementById("homeFoot").hidden }));

    /* ---- 4: the reward */
    const R = await open({ orders: [conf], assoc: true, withCard: true }), rb = R.d.querySelector('#hReward [data-reward="assoc"]');
    const mp = rb && rb.querySelector("progress.amb-meter");
    const rw = { head: t(R.d.querySelector("#hReward .amb-section")), title: t(rb && rb.querySelector(".amb-row__title")), left: t(rb && rb.querySelector(".amb-row__sub")), pc: t(rb && rb.querySelector(".amb-row__amount")),
      fill: mp ? mp.value + "/" + mp.max : "", n: R.d.querySelectorAll("#hReward [data-reward]").length, kind: !!(rb && rb.querySelector(".amb-thumb--mark.amb-kind-1")) };
    const levels = SO.LEVEL_WORDS.filter((w) => new RegExp("\\b" + w + "\\b", "i").test(t(R.d.getElementById("hReward"))));
    ok(rw.head === "Your reward" && rw.title === "To your next unit" && rw.left === "Reward: 22.5 units to take. Ask on any order to take it." && rw.pc === "40%" && rw.fill === "40/100" && rw.n === 1 && rw.kind && !levels.length,
      "an associate's Home shows the reward nearest its next unit, a meter row its mark the thumb, and what is theirs to take, in the card's words and never a level: " + JSON.stringify({ rw, levels }));
    rb.click();
    ok(!R.d.getElementById("pCard").hidden, "a tap on it opens Rewards");
    const N = await open({ orders: [conf], assoc: false, withCard: true });
    ok(!N.d.getElementById("hReward").hasChildNodes(), "and a customer who is not an associate has none");

    /* ---- 5: This year */
    const y = A.d.querySelector("#hYear figure.amb-chart"), rows = y ? [...A.d.querySelectorAll("#hYear [data-year]")] : [];
    const d0 = (h) => { const x = new JSDOM(h).window.document.querySelector("path"); return x ? x.getAttribute("d") : ""; };
    const bars = y ? [...y.querySelectorAll("svg.amb-chart__marks rect")].map((b) => b.getAttribute("data-n")) : [];
    const want = Array.from({ length: +MM }, (_, i) => String((i === 0 ? 1 : 0) + (i === +MM - 1 ? 2 : 0)));
    const yv = { head: t(A.d.querySelector("#hYear .amb-section")), n: t(y && y.querySelector(".amb-chart__title")), units: rows.map((x) => t(x.querySelector(".amb-row__title"))),
      marks: rows.map((x) => x.querySelector(".amb-thumb__shape path").getAttribute("d")), bars, aria: y ? y.getAttribute("aria-label") : "",
      scale: y ? [...y.querySelectorAll(".amb-chart__scale li")].map((li) => li.textContent).join() : "", table: y ? y.querySelectorAll("details.amb-chart__figures tbody tr").length : 0 };
    ok(yv.head === "This year" && yv.n === "3 orders" && yv.units.join() === "3.5 units,3 units" && yv.marks.join() === [d0(P.psymSvg("salt", 24)), d0(P.psymSvg("oil", 24))].join()
      && bars.join() === want.join() && /^Orders: Jan \d/.test(yv.aria) && /,0$/.test(yv.scale) && yv.table === +MM,
      "This year counts this year's lines, a cancelled one and last year's not counted, each mark's units its own row, a bar a month to this one on a scale from nought, its figures one tap away: " + JSON.stringify({ yv, want }));
    const monthWords = Object.entries(W.EN).filter(([, v]) => /monthly|by month|each month/i.test(String(v)));
    ok(!monthWords.length, "no word on the Counter says monthly, by month or each month: " + JSON.stringify(monthWords));

    /* ---- 6: To pay now and the overdue gate lead */
    const stacks = [...A.d.querySelectorAll("#pHome > .amb-stack")], c1 = [...stacks[0].children].map((n) => n.id), c2 = [...stacks[1].children].map((n) => n.id);
    ok(A.d.getElementById("pHome").classList.contains("amb-split") && stacks.length === 2 && c1.slice(0, 3).join() === "today,payHead,hNeeds" && c1[c1.length - 1] === "homeFoot"
      && c2.indexOf("hComing") >= 0 && c2.indexOf("hReward") > c2.indexOf("hComing") && c2.indexOf("hYear") > c2.indexOf("hComing") && [...A.d.getElementById("pHome").children].length === 2,
      "To pay now and the overdue gate head the first stack under the Today card, Needs you after them and the foot last, and the reward and This year stand after Coming up in the second: " + JSON.stringify({ c1, c2 }));
  } catch (e) { ok(false, "counter-home stopped on an error: " + (e && e.stack)); }
  finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
