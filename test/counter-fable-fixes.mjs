/* test/counter-fable-fixes.mjs: THE COUNTER'S FIXES FROM FABLE'S DESIGN REVIEW (17 Nov 2026, the move to Ambient). Home's Pay is the last thing of its last stack in one column and
 * the first stack's foot from 960px, Home stands in a place so Ambient's ground follows the foot, the mini bar's coin is the shape alone, Home's two stacks stand one measure in one
 * column, Account says Messages with us once and "nothing yet" only of an account with nothing owed and nothing ordered, This device is one group with Sign out last, no hero of the
 * Counter carries a bare clock, no text of the site's own layer is under 12px, and the open order's foot is its last part with the message box before it.
 * The geometry (the box clear of the Pay at the end of the scroll, the last row clear of the dock and the mini bar, one left and right edge on Home at 860) is measured in Chromium and
 * recorded in the report; jsdom reads the markup and the cascade here. Each check below is proved red by its own mutation (test/counter-fable-fixes.mutations.json, run with
 * tools/section.mjs). Every code, name and password is invented. */
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";

export async function run({ ok }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const W = await import("../stmt/words.js");
  const { SITE_CSS } = await import("../stmt/statement-css.js");
  const { JSDOM } = await import("jsdom");
  const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  const NOW = Date.UTC(2026, 10, 17, 4, 0, 0);
  const iso = (m) => new Date(NOW - m * 60e3).toISOString();
  const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  const ord = (id, x) => Object.assign({ id, product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "placed",
    at: iso(300), history: [{ at: iso(300), status: "placed", by: "customer" }], msgs: [] }, x);
  const READY = ord("20261114090003-aa03", { qty: 2.5, unit: 38, total: 95, paid: 40, status: "ready", at: iso(1500), mode: "deliver", delivery: 10, place: "Taman Example",
    history: [{ at: iso(1500), status: "placed", by: "customer" }, { at: iso(1000), status: "acknowledged", by: "desk" }, { at: iso(600), status: "ready", by: "desk" }],
    payments: [{ at: iso(500), amount: 40, method: "transfer" }] });
  const u = "abcd-efgh", pass = "fixture-pass-17n", ck = await C.contentKey("test-secret", u);
  const prices = { at: new Date().toISOString(), week: { monday: "2026-11-16", label: "16 to 22 Nov 2026" }, soon: [], products: ["salt"].map((p) =>
    ({ product: p, unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }] })) };
  const opened = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-17n-abcdefghij", env: await C.encryptWith(ck, JSON.stringify({ statements: [] })),
    prices: await C.encryptWith(ck, JSON.stringify(prices)) };
  const wins = [];
  const open = async ({ orders, width }) => {
    const dom = new JSDOM(P.landingPage(u, "n17", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      const NativeDate = win.Date;
      win.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [NOW])); }
        static now() { return NOW; }
      };
      Object.defineProperty(win, "innerWidth", { value: width, configurable: true, writable: true });
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, opened);
        if (p === "/orders" && m === "GET") return answer(200, { ok: true, orders: JSON.parse(JSON.stringify(orders)), claims: [] });
        return answer(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => d.querySelector("#pPrices .pmark") || d.getElementById("hStart").childNodes.length);
    await new Promise((r) => setTimeout(r, 120));
    return { w, d };
  };
  const tab = (pg, n) => pg.d.querySelector('button[data-t="' + n + '"]').click();

  try {
    /* ---- 6 and 7: Home's Pay is the last thing of the last stack in one column, the first stack's foot from 960px; Home stands in a place; the mini bar's coin is the shape alone */
    const narrow = await open({ orders: [READY], width: 390 });
    await until(() => !narrow.d.getElementById("homeFoot").hidden);
    const stacks = (pg) => [...pg.d.querySelectorAll("#pHome > .amb-stack")], foot = (pg) => pg.d.getElementById("homeFoot");
    const nS = stacks(narrow), ids = (e) => [...e.children].map((c) => c.id).join(" ");
    const ALL = "today payHead hNeeds hRate hThread hSupply hStart hPool hComing hAgain hReward hYear homeFoot";
    ok(!foot(narrow).hidden && nS.length === 2 && foot(narrow).parentNode === nS[1] && nS[1].lastElementChild === foot(narrow) && nS[0].children.length === 0 && ids(nS[1]) === ALL,
      "in one column Home is one stack, the last, with the Pay its last thing, so the Pay stays pinned over the dock from the top of Home to its end and never stands mid-page: " + ids(nS[1]));
    const wide = await open({ orders: [READY], width: 1280 });
    await until(() => !foot(wide).hidden);
    const wS = stacks(wide);
    ok(!foot(wide).hidden && foot(wide).parentNode === wS[0] && ids(wS[0]) === "today payHead hNeeds hRate hThread hSupply hStart homeFoot" && ids(wS[1]) === "hPool hComing hAgain hReward hYear",
      "from 960px Home is two columns again and the Pay is the first stack's foot: " + ids(wS[0]));
    wide.w.innerWidth = 390; wide.w.dispatchEvent(new wide.w.Event("resize"));
    const back = ids(stacks(wide)[1]) === ALL && stacks(wide)[0].children.length === 0;
    wide.w.innerWidth = 1280; wide.w.dispatchEvent(new wide.w.Event("resize"));
    ok(back && ids(stacks(wide)[0]) === "today payHead hNeeds hRate hThread hSupply hStart homeFoot" && ids(stacks(wide)[1]) === "hPool hComing hAgain hReward hYear",
      "and a window resized across 960px moves the parts and the Pay, in both directions, each part in its own order");
    const place = narrow.d.getElementById("pHome").parentNode;
    ok(place.classList.contains("amb-place") && place.children.length === 1 && place.parentNode.classList.contains("amb-screen"),
      "Home's split stands in a place of its own, straight in the screen, so Ambient's ground under the dock follows the foot");
    const live = narrow.d.querySelector("#hLive, [data-live].amb-mini") || narrow.d.querySelector(".amb-mini[data-live]");
    const mini = narrow.d.querySelector(".amb-mini[data-live]"), th = mini && mini.querySelector(".amb-thumb");
    ok(!!live && !!th && th.classList.contains("amb-thumb--md") && !th.classList.contains("amb-thumb--sm"),
      "the mini bar's coin is the 44px thumb, never the 36px (22 Nov 2026: its letter stands inside the shape, so none is cut at the coin's edge)");

    /* ---- 9: one measure in one column, and a list takes the stack's edge */
    const at = SITE_CSS.indexOf("@container amb (max-width: 959px) {" + String.fromCharCode(10) + "  #pHome > .amb-stack"), narrowCss = at < 0 ? "" : SITE_CSS.slice(at, SITE_CSS.indexOf(String.fromCharCode(10) + "}", at));
    ok(/#pHome > \.amb-stack \{ width: 100%; max-width: calc\(36rem \+ 2 \* var\(--amb-space-4\)\); justify-self: center; \}/.test(narrowCss),
      "in one column Home's stack stands one measure, 36rem and the stack's inset, centred: the tile, the rows, the card and the Pay share their two edges");
    ok(/#pHome > \.amb-stack:not\(:has\(\*\)\) \{ display: none; \}/.test(narrowCss) && /#pHome > \.amb-stack \+ \.amb-stack \{ margin-top: 0; \}/.test(narrowCss),
      "and the first stack, empty in one column, draws nothing and leaves no gap above the last");
    ok(/#pHome \.amb-stack \.amb-list \{ margin-inline: 0; \}/.test(SITE_CSS), "and a list inside one of Home's boxes takes the stack's edge, not a second inset");

    /* ---- 12: Account says Messages with us once, and nothing yet only of an account with nothing owed and nothing ordered */
    tab(narrow, "stmt"); await new Promise((r) => setTimeout(r, 200));
    const gone = place.hidden; tab(narrow, "home"); const back2 = !place.hidden; tab(narrow, "stmt");
    ok(gone && back2 && [...narrow.d.querySelectorAll("#tabs > .amb-screen > .amb-place:not([hidden])")].length === 0, "Home's place is hidden with Home, so the shown place is always the one that is open");
    const nm = W.EN["th.row"], names = [...narrow.d.querySelectorAll("#pStmt .amb-setting__name, #pStmt .amb-row__title")].map(t).filter((x) => x === nm);
    ok(names.length === 1 && narrow.d.querySelectorAll('#pStmt [data-glance="thread"]').length === 1 && narrow.d.querySelectorAll("#pStmt [data-thread]").length === 0 && !narrow.d.getElementById("aThread"),
      "Account says " + JSON.stringify(nm) + " once, as the glance's row, and draws no second row for the thread: " + names.length);
    ok(!t(narrow.d.getElementById("out")).includes(W.EN["acct.nothing"]), "an account with an order on it never says there is nothing on it");
    const empty = await open({ orders: [], width: 390 });
    tab(empty, "stmt"); await new Promise((r) => setTimeout(r, 200));
    ok(t(empty.d.getElementById("out")).includes(W.EN["acct.nothing"]), "and one with nothing owed and nothing ordered says so, once: " + JSON.stringify(t(empty.d.getElementById("out"))));

    /* ---- 21: This device is one group, one list: the settings, the other devices and the ways in, Sign out last as the danger action */
    await until(() => [...narrow.d.querySelectorAll("#devRows button")].some((b) => /^Sign in another device/.test(t(b))));
    const grp = narrow.d.querySelector("#thisDevice > .amb-settings"), rows = [...narrow.d.querySelectorAll("#devRows > li")], lock = narrow.d.getElementById("lock");
    ok(!!grp && grp.querySelectorAll("ul").length === 1 && grp.querySelector("ul") === narrow.d.getElementById("devRows") && rows.length >= 3
      && /^Notifications/.test(t(rows[0])) && rows.some((r) => /^Sign in another device/.test(t(r))) && rows[rows.length - 1].contains(lock) && lock.classList.contains("amb-action--danger") && lock.closest("li") === rows[rows.length - 1],
      "This device is one group of one list: Notifications first, the other devices and the ways in, and Sign out last as the danger action: " + JSON.stringify(rows.map((r) => t(r).slice(0, 24))));
    ok(narrow.d.querySelectorAll("#devSlot button, #devSlot li").length === 0, "and nothing loose stands under it: the line under the group is the only thing in the slot");

    /* ---- 22 (B): the mini bar's moment says its day: "Today, 00:01" on the Kuala Lumpur day, the date on any other */
    const NEW = ord("20261117090004-aa04", { at: iso(1), history: [{ at: iso(1), status: "placed", by: "customer" }] });
    const OLD = ord("20261110090005-aa05", { at: iso(4320), history: [{ at: iso(4320), status: "placed", by: "customer" }] });
    const subOf = async (o) => { const w = await open({ orders: [o] }); await until(() => w.d.querySelector(".amb-mini[data-live] .amb-mini__sub")); const m = w.d.querySelector(".amb-mini[data-live] .amb-mini__sub"); return m ? t(m) : ""; };
    const sNew = await subOf(NEW), sOld = await subOf(OLD);
    ok(/^Today, [0-9]{2}:[0-9]{2}$/.test(sNew) && /^[0-9]{2} [A-Z][a-z]{2} 2026$/.test(sOld),
      "the mini bar reads Today, 00:01 for a move today and the date for another day, never a bare time: " + JSON.stringify([sNew, sOld]));

    /* ---- 23 (C): the mini bar's room is reserved over the foot only while it shows. 17 Nov 2026, the move to Ambient (Ambient 0.7.15, R27b): Ambient does it, so the
       check pins Ambient's carried rule and that the site layer holds no override of the bleed or the mini bar's room (its 36px stand-in left with the pull) */
    const { AMB_CSS } = await import("../stmt/statement-css.js");
    ok(AMB_CSS.includes(".amb-shell:has(> .amb-dock > .amb-mini:not([hidden])) { --amb-foot-mini: calc(var(--amb-mini-h) + var(--amb-peek)); }")
      && AMB_CSS.includes(".amb-shell { --amb-foot-mini: 0px;") && !/--amb-bleed\s*:|--amb-foot-mini\s*:/.test(SITE_CSS),
      "an open order's screen and foot reserve no bleed room for a mini bar that is not shown");

    /* ---- 18: no hero of the Counter carries a bare clock */
    ok(narrow.d.querySelectorAll("#tabs header.amb-hero").length === 1 && narrow.d.querySelectorAll("#tabs .amb-hero__time, #tabs [data-clock]").length === 0,
      "the Counter's hero carries no bare clock: the time is not drawn there");
    const own = new JSDOM(P.landingPage("", "n17b", { master: "", accounts: [] })).window.document;
    /* 22 Nov 2026 (the place head): Salt Admin's clock is the time of each place's status row, after its live line; a hero holds the title alone */
    ok(own.querySelectorAll('.amb-head > .amb-status > .amb-status__live + .amb-status__time[data-clock]').length >= 5 && own.querySelectorAll('header.amb-hero [data-clock], .amb-hero__time').length === 0,
      "Salt Admin's places keep theirs, in the status row beside the live line, and no hero holds a time line");

    /* ---- 4: the open order's Pay is its one foot and its last part; the message box stands in the flow before it */
    tab(narrow, "order"); await until(() => narrow.d.querySelector('#pOrder [data-row="' + READY.id + '"]'));
    narrow.d.querySelector('#pOrder [data-row="' + READY.id + '"]').click();
    await until(() => narrow.d.querySelector(".oscreen[data-order]"));
    const sc = narrow.d.querySelector(".oscreen[data-order]"), kids = [...sc.children], fts = kids.filter((k) => k.classList.contains("amb-foot")), comp = sc.querySelector(".amb-compose");
    ok(fts.length === 1 && kids[kids.length - 1] === fts[0] && !!fts[0].querySelector("button") && !!comp && !fts[0].contains(comp) && !!comp.closest('[data-part="say"]')
      && kids.indexOf(comp.closest('[data-part="say"]')) < kids.indexOf(fts[0]) && !!sc.querySelector('[data-part="thread"] .amb-thread'),
      "the open order's Pay is its one foot and its last part, and the message box stands in the flow, after the thread and before the foot");

    /* ---- 17: Prices by size, Details and What happened are Ambient's fold (0.7.12): details, a head of title and chevron, a body, in a stack, none in a settings group or another fold, no More stand-in */
    const isFold = (f) => !!f && f.matches("details.amb-disclose.amb-disclose--fold") && !!f.querySelector(":scope > summary.amb-disclose__head > .amb-disclose__title:is(h2,h3,h4)")
      && !!f.querySelector(":scope > summary.amb-disclose__head > svg.amb-disclose__mark") && f.querySelectorAll(":scope > .amb-disclose__body").length === 1
      && !f.closest(".amb-settings") && !f.parentNode.closest(".amb-disclose") && f.parentNode.classList.contains("amb-stack") && !f.classList.contains("amb-stack") && !f.querySelector("summary button, summary a, summary input");
    const det = sc.querySelector('[data-part="details"]'), hst = sc.querySelector('[data-part="hist"] > details');
    ok(isFold(det) && isFold(hst) && !det.open && !hst.open && !sc.querySelector(".amb-more") && det.querySelectorAll(".amb-disclose__body p.amb-disclose__text").length >= 3
      && hst.querySelectorAll(".amb-disclose__body p[data-hist]").length >= 1,
      "Details and What happened are Ambient's fold in the record's stack, shut, their body words: no More stand-in remains");
    tab(narrow, "prices"); await until(() => narrow.d.querySelector("#pPrices .sfold"));
    const sf = narrow.d.querySelector("#pPrices .pane > details.sfold");
    ok(!!sf && sf.matches("details.amb-disclose.amb-disclose--fold") && !!sf.querySelector(":scope > summary.amb-disclose__head > h3.amb-disclose__title") && !!sf.querySelector(":scope > summary > svg.amb-disclose__mark")
      && sf.querySelectorAll(":scope > .amb-disclose__body > ul.amb-list--ruled.amb-list--full > li > button.amb-row[data-q]").length >= 1 && !sf.closest(".amb-settings") && !narrow.d.querySelector("#pPrices .amb-more"),
      "Prices by size is Ambient's fold, its body a ruled list of the sizes to tap, and no More stand-in stands in Shop");

    /* ---- 19: no text of the site's own layer is set under 12px */
    const css = readFileSync(new URL("../design/site.css", import.meta.url), "utf8"), small = [];
    for (const m of css.matchAll(/font-size:\s*([0-9.]+)(px|rem|em)/g)) { const px = m[2] === "px" ? +m[1] : +m[1] * 16; if (px < 12) small.push(m[0]); }
    ok(small.length === 0, "no text of the site layer is set under 12px: " + JSON.stringify(small));
  } finally { wins.forEach((w) => { try { w.close(); } catch (e) { /* closed */ } }); }
}
