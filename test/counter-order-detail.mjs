/* test/counter-order-detail.mjs: AN ORDER'S OWN SCREEN, AS HE CHOSE IT (Counter Batch A, P7, his decisions of 18 Oct 2026).
 *
 * The head is a band: the order's short reference, its state as the heading, what it is, and while it waits at one of his points, the point and a
 * pin that opens their maps app. The track is drawn marks with the moment of each step and Next on the step to come. The money reads like a
 * receipt, each payment with its way and its day, what is still to pay apart in ember. Message stands beside Pay on every order, every stage.
 * Details, folded, holds when, the way, the point and the reference, and no note. Salt Admin shows the same reference on the order's card.
 * Every assertion observes the generated page in jsdom; each was proved red by its own mutation (test/counter-order-detail.mutations.json, run with
 * tools/section.mjs). Every code, name and password is invented.
 *   1  the reference: seven of the site's symbols, four then three, stable, never the id, never a roster code's shape; Salt Admin's card the same
 *   2  the band: the state as its heading, the point while it waits there, and the pin to it, named by its code, carrying its place alone
 *   3  the steps: a mark each, the moment each happened, Next on the one to come
 *   4  the money: each payment with its way and its day, still to pay apart
 *   5  Message on every stage, taking them to the composer; Details with no note */
import { webcrypto } from "node:crypto";
import { richOwnerPage } from "./maker-act.mjs";

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");
  const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  const iso = (m) => new Date(Date.now() - m * 60e3).toISOString();
  const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  const ord = (id, x) => Object.assign({ id, product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "placed",
    at: iso(300), history: [{ at: iso(300), status: "placed", by: "customer" }], msgs: [] }, x);
  const hs = (...l) => l.map(([m, status, by, extra]) => Object.assign({ at: iso(m), status, by }, extra || {}));
  const ALPHA = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
  const ROSTER = /^[A-Z]{2}[0-9]-[A-Z]{2,3}(-R)?$/;

  /* waiting at Z9, part paid by transfer and in cash */
  const R = ord("ord-a1", { qty: 2.5, unit: 38, total: 95, paid: 40, status: "ready", point: "Z9", pointAt: { lat: 3.14786, lng: 101.69369 },
    history: hs([300, "placed", "customer"], [280, "acknowledged", "desk"], [200, "ready", "desk", { point: "Z9" }]),
    payments: [{ at: iso(250), amount: 30, method: "transfer", account: null }, { at: iso(240), amount: 10, method: "cod", account: null, by: "desk" },
      { at: iso(100), amount: 5, method: "transfer", account: null, claim: "notfound" }] });
  const B = ord("20261010090002-od02", { status: "acknowledged", at: iso(2), history: hs([2, "placed", "customer"], [1, "acknowledged", "desk"]) });
  const D = ord("20261010090003-od03", { status: "done", paid: 100, moved: 1, movedOn: "2026-10-10", point: "Z8",
    history: hs([4000, "placed", "customer"], [3900, "acknowledged", "desk"], [3800, "ready", "desk", { point: "Z8" }], [3000, "done", "site"]) });
  const X = ord("20261010090004-od04", { status: "cancelled", history: hs([3500, "placed", "customer"], [3400, "cancelled", "customer"]) });
  const A = ord("20261010090005-od05");
  const ALL = [R, B, D, X, A];

  const u = "abcd-efgh", pass = "fixture-pass-p7", ck = await C.contentKey("test-secret", u);
  const prices = { at: new Date().toISOString(), week: { monday: "2026-10-12", label: "12 to 18 Oct 2026" }, soon: [], products: ["salt"].map((p) =>
    ({ product: p, unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }] })) };
  const opened = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-p7-abcdefghij",
    env: await C.encryptWith(ck, JSON.stringify({ statements: [] })), prices: await C.encryptWith(ck, JSON.stringify(prices)) };
  const wins = [];
  const open = async (ua) => {
    const dom = new JSDOM(P.landingPage(u, "np7", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (ua) Object.defineProperty(win.navigator, "userAgent", { value: ua, configurable: true });
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, opened);
        if (p === "/orders" && m === "GET") return answer(200, { ok: true, orders: JSON.parse(JSON.stringify(ALL)), claims: [] });
        return answer(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => d.querySelector("#pPrices .pmark"));
    d.querySelector('button[data-t="order"]').click();
    await until(() => d.querySelector("#pOrder [data-row], #pOrder .olater"));
    const later = d.querySelector("#pOrder .olater"); if (later) { later.click(); await until(() => d.querySelector('#pOrder [data-row="' + D.id + '"]')); }
    return { w, d };
  };
  const screen = async (pg, o) => {
    pg.d.querySelector('#pOrder [data-row="' + o.id + '"]').click();
    await until(() => pg.d.querySelector('#pOrder .oscreen[data-order="' + o.id + '"]'));
    return pg.d.querySelector('#pOrder .oscreen[data-order="' + o.id + '"]');
  };
  const part = (s, k) => s && s.querySelector('[data-part="' + k + '"]');

  try {
    const S = await open("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
    const sR = await screen(S, R), sB = await screen(S, B), sD = await screen(S, D);

    /* ---- 1: the reference ---- */
    const refR = t(part(sR, "head").querySelector("[data-ref]")), refB = t(part(sB, "head").querySelector("[data-ref]"));
    const shape = (r) => /^[A-Z0-9]{4}-[A-Z0-9]{3}$/.test(r) && [...r.replace("-", "")].every((c) => ALPHA.includes(c)) && !ROSTER.test(r);
    const S2 = await open(null), refR2 = t(part(await screen(S2, R), "head").querySelector("[data-ref]"));
    ok(shape(refR) && shape(refB) && refR !== refB && refR === refR2 && !refR.includes(R.id) && refR.toLowerCase() !== R.id,
      "each order has a short reference of seven of the site's symbols, four then three, the same on every open, its own, never its id or a roster code's shape: " + JSON.stringify([refR, refB, refR2]));
    const own = await richOwnerPage({ pageWork });
    try {
      await own.work.quiet(); own.d.querySelector('[data-act="nav.orders"]').click(); await own.work.quiet();
      const card = own.card("ord-a1"), oref = card && card.querySelector("[data-ref]");
      ok(!!oref && t(oref) === "· Ref " + refR, "Salt Admin's card for the same order shows the same reference, so one they quote finds it: " + (oref && t(oref)));
    } finally { own.w.close(); }

    /* ---- 2: the band, the point and its pin ---- */
    const hR = part(sR, "head"), pin = hR && hR.querySelector("a.salt-pin");
    ok(!!hR && hR.classList.contains("salt-band") && t(hR.querySelector("h3.state")) === "Ready to collect" && t(hR.querySelector(".oband__point")) === "At Point Z9",
      "the head is a band, its state the heading and the point it waits at under what it is: " + t(hR));
    ok(!!pin && pin.getAttribute("href") === "https://maps.apple.com/?ll=3.14786,101.69369&q=Point%20Z9" && pin.getAttribute("aria-label") === "Directions to Point Z9, opens your maps app"
      && !!pin.querySelector('svg[aria-hidden="true"]') && pin.target === "_blank" && /noopener/.test(pin.rel),
      "the pin opens their maps app at the point's place, named by its code alone: " + (pin && pin.getAttribute("href")));
    const A2 = await open("Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36");
    const pinA = part(await screen(A2, R), "head").querySelector("a.salt-pin");
    const G = await open("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36");
    const pinG = part(await screen(G, R), "head").querySelector("a.salt-pin");
    ok(!!pinA && pinA.getAttribute("href") === "geo:3.14786,101.69369?q=3.14786,101.69369(Point%20Z9)" && !!pinG && pinG.getAttribute("href") === "https://www.google.com/maps/search/?api=1&query=3.14786,101.69369",
      "on Android the pin is the geo: link its maps app takes, anywhere else Google Maps at the place: " + JSON.stringify([pinA && pinA.getAttribute("href"), pinG && pinG.getAttribute("href")]));
    ok(!part(sD, "head").querySelector("a.salt-pin") && !part(sD, "head").querySelector(".oband__point") && !part(sB, "head").querySelector("a.salt-pin"),
      "once collected, or before it is ready, there is no point line and no pin in the band");

    /* ---- 3: the steps ---- */
    const steps = [...part(sR, "steps").querySelectorAll("li")];
    const view = steps.map((li) => [t(li.querySelector(".salt-steps__name")), !!li.querySelector(".salt-steps__mark svg"), t(li.querySelector(".salt-steps__time")),
      li.classList.contains("salt-steps__step--done") ? "done" : li.classList.contains("salt-steps__step--now") ? "now" : li.classList.contains("salt-steps__step--next") ? "next" : ""]);
    const hm = (m) => { const k = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23", day: "2-digit" }).formatToParts(new Date(Date.now() - m * 60e3));
      const g = (ty) => k.find((x) => x.type === ty).value; return g("hour") + ":" + g("minute"); };
    const today = (m) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(Date.now() - m * 60e3)) === new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
    const wantT = [300, 280, 200].map((m) => (today(m) ? hm(m) : null));
    ok(part(sR, "steps").querySelector("ol").classList.contains("salt-steps--marks") && view.every((v) => v[1]) && view.map((v) => v[0]).join("|") === "Placed|Confirmed|Ready|Collected"
      && view.map((v) => v[3]).join("|") === "done|done|now|next" && view[3][2] === "Next"
      && view.slice(0, 3).every((v, i) => (wantT[i] ? v[2] === wantT[i] : /^\d\d \w{3} \d{4}$/.test(v[2]))),
      "each step is a drawn mark with the moment it happened, and Next on the step to come: " + JSON.stringify(view));

    const stB = [...part(sB, "steps").querySelectorAll("li")].map((li) => t(li.querySelector(".salt-steps__time")));
    const hmAt = (s) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(s));
    const dayIs = (s) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date(s)) === new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
    const at = (s, v) => (dayIs(s) ? v === hmAt(s) : /^dd w{3} d{4}$/.test(v));
    ok(at(B.history[0].at, stB[0]) && at(B.history[1].at, stB[1]) && stB[2] === "Next" && stB[3] === "",
      "a step that happened today shows its time of day, an earlier one its day, and only the step to come says Next: " + JSON.stringify(stB));
    /* ---- 4: the money ---- */
    const rows = [...part(sR, "money").querySelectorAll(".salt-ledger__row")].map((r) => [t(r.querySelector(".salt-ledger__label")), t(r.querySelector(".salt-ledger__value")), r.classList.contains("salt-ledger__row--due")]);
    const paidRows = rows.filter((r) => /^Paid/.test(r[0]));
    ok(paidRows.length === 2 && /^PaidBy DuitNow Transfer, \d\d \w{3} \d{4}$/.test(paidRows[0][0]) && paidRows[0][1] === "RM 30.00" && /^PaidBy cash on handover, \d\d \w{3} \d{4}$/.test(paidRows[1][0]) && paidRows[1][1] === "RM 10.00",
      "each payment we have stands on its own line with its way and its day: " + JSON.stringify(paidRows));
    const due = rows.find((r) => r[0] === "Still to pay");
    ok(!!due && due[1] === "RM 55.00" && due[2] === true && rows[rows.length - 1] === due, "and what is still to pay stands last, apart, as the receipt's due line: " + JSON.stringify(rows));

    /* ---- 5: Message on every stage, Details with no note ---- */
    const sX = await screen(S, X), sA = await screen(S, A);
    const msgs = [sA, sB, sR, sD, sX].map((s) => { const b = part(s, "act").querySelector("[data-msg]"); return b ? t(b) : null; });
    ok(msgs.every((m) => m === "Message"), "Message stands on the order's screen at every stage, placed, confirmed, ready, done and cancelled: " + JSON.stringify(msgs));
    const sR2 = await screen(S, R);
    part(sR2, "act").querySelector("[data-msg]").click();
    ok(S.d.activeElement === sR2.querySelector("input[data-say]"), "and a tap on it takes them to the order's composer");
    const det = part(sR2, "details").querySelector("details"), dl = [...det.querySelectorAll(".salt-ledger__row")].map((r) => t(r.querySelector(".salt-ledger__label")) + "=" + t(r.querySelector(".salt-ledger__value")));
    ok(!!det && dl.length === 4 && /^Ordered at=\d\d \w{3} \d{4}, \d\d:\d\d$/.test(dl[0]) && dl[1] === "Way=Collect" && dl[2] === "Point=Point Z9" && dl[3] === "Reference=" + refR && !/Note/.test(t(det)),
      "Details holds when it was ordered, the way, the point and the reference, and no note: " + JSON.stringify(dl));
    const dD = [...part(await screen(S, D), "details").querySelectorAll(".salt-ledger__row")].map((r) => t(r));
    ok(dD.some((x) => x === "PointCollected at Point Z8"), "an order collected says where it was collected: " + JSON.stringify(dD));
  } catch (e) { ok(false, "counter-order-detail stopped on an error: " + (e && e.stack)); }
  finally { wins.forEach((w) => w.close()); }
}
