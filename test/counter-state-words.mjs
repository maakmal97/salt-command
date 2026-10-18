/* test/counter-state-words.mjs: ONE WORD PER STATE, AND THE MARK ALONE (Phase 7c of the Salt Account and Counter redesign, his decision 10
 * of 11 Oct 2026: Confirmed for acknowledged, Placed for Sent, Declined for Not taken; and his word of 12 Oct 2026, "Remove the shapes names
 * in the Order page, and anywhere", which took back the shape word that 7c drew beside the mark).
 *
 * The customer's page named one step four ways (Sent, Acknowledged, agreed, your yes). Now an order is Placed, Confirmed, Ready,
 * Collected or Delivered, Complete, or Declined; a claim of theirs is Waiting for us to confirm; the acknowledgement family is gone from
 * every word the customer reads, the banners included; and a mark stands alone: no shape word (Cube, Droplet, Lozenge, Capsule, Ring) is
 * drawn on any screen, beside a mark or under it, while the screen reader is still told the shape (the name of a heading, a tile, a legend
 * and a line), and no shape word is a product's. Every assertion observes the generated page in jsdom (the text it renders after each
 * state is driven, the banners the service worker builds from the real wake of each move) or the server's own markup; the table sweep
 * below is only the net under what cannot be driven. Each check was proved red by its own mutation
 * (test/counter-state-words.mutations.json, run with tools/section.mjs). Every code, name and password is invented.
 *   1  every state of an order, its list row, its own screen, its steps and the sentence under it: the one word of the table
 *   2  a claim of theirs waiting reads Waiting for us to confirm, and a placed order is waiting on the same words, on Orders and Home
 *   3  no word of the acknowledgement family, and no Not taken, in the text any screen renders, the order sheet and Place included
 *   4  the banner of each move, built by the service worker from the wake the move sends: its title and its body
 *   5  every word the page is served, swept for the family (the net under 3 and 4), and the keys all still there
 *   6  supply reads More by 20 Oct under a yellow mark, nothing under red or green, and never Expected by
 *   7  a mark stands alone: no screen draws a shape word, and every mark on every screen still has its shape as the reader's name
 *   8  the tile's caption is the size in words alone, the same on the statement's server markup, and the page carries no rule for a shape word
 *   9  no shape word is a product's: what the reader is told, scanned as the product words and the level words, on every screen
 *  10  his answers and his reasons that use the new words pass siteWords, and the locks still refuse
 *  11  what the order's card says they see follows: Placed, Confirmed, Declined, off the page's own words
 *  12  the practice accounts show the new words on their orders, and their feature names carry none of the old */
import { webcrypto } from "node:crypto";
import vm from "node:vm";

export async function run({ ok }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const W = await import("../stmt/words.js");
  const O = await import("../stmt/orders.js");
  const SW = await import("../stmt/sw.js");
  const SO = await import("../src/orders.js");
  const TF = await import("../tools/testfix.mjs");
  const { JSDOM } = await import("jsdom");

  const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  const iso = (m) => new Date(Date.now() - m * 60e3).toISOString();
  const day = (m) => iso(m).slice(0, 10);
  const wins = [];
  const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  /* every text node the user can read: the page's script and style are not text */
  const words = (root) => { const out = [], tw = root.ownerDocument.createTreeWalker(root, 4);
    while (tw.nextNode()) { const n = tw.currentNode; if (!/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) out.push(n.nodeValue); }
    return out.join(" ").replace(/\s+/g, " "); };
  const FAMILY = /acknowledg|not taken|expected by/i;
  const PRODUCTS = SO.PRODUCT_WORDS.concat(SO.LEVEL_WORDS);
  const SHAPES = Object.values(P.PSHAPE);

  const ord = (id, x) => Object.assign({ id, product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "placed",
    at: iso(300), history: [{ at: iso(300), status: "placed", by: "customer" }], msgs: [] }, x);
  const hs = (...l) => l.map(([m, status, by, note]) => Object.assign({ at: iso(m), status, by }, note ? { note } : {}));
  /* one order in each state the page words, each of a different book so every shape is drawn */
  const A = ord("20261010090001-sw01", { product: "salt", qty: 2.5, unit: 108, total: 270 });
  const B = ord("20261010090002-sw02", { product: "oil", qty: 1, unit: 40, total: 40, status: "acknowledged", history: hs([290, "placed", "customer"], [280, "acknowledged", "desk"]) });
  const H = ord("20261010090003-sw03", { product: "candy", qty: 2, unit: 12, total: 24, status: "acknowledged", claimed: 20,
    history: hs([290, "placed", "customer"], [280, "acknowledged", "desk"]),
    payments: [{ at: iso(60), by: "customer", amount: 20, method: "transfer", claim: "waiting" }] });
  const R = ord("20261010090004-sw04", { product: "rice", qty: 1, unit: 9, total: 9, delivery: 3, mode: "deliver", place: "Taman Contoh", status: "ready",
    history: hs([290, "placed", "customer"], [280, "acknowledged", "desk"], [200, "ready", "desk"]) });
  const D1 = ord("20261010090005-sw05", { product: "salt", qty: 1, status: "ready", moved: 1, movedOn: day(100),
    history: hs([290, "placed", "customer"], [280, "acknowledged", "desk"], [200, "ready", "desk"]) });
  const D2 = ord("20261010090006-sw06", { product: "oil", qty: 3, unit: 38, total: 115, delivery: 5, mode: "deliver", place: "Taman Contoh", status: "ready", moved: 3, movedOn: day(90),
    history: hs([290, "placed", "customer"], [280, "acknowledged", "desk"], [200, "ready", "desk"]) });
  const N = ord("20261009090007-sw07", { product: "candy", qty: 1, unit: 12, total: 12, status: "done", moved: 1, paid: 12, movedOn: day(3000),
    history: hs([4000, "placed", "customer"], [3900, "acknowledged", "desk"], [3000, "done", "site"]) });
  const E = ord("20261009090008-sw08", { product: "rice", qty: 1, unit: 9, total: 9, status: "declined",
    history: hs([3500, "placed", "customer"], [3400, "declined", "desk", "Out of stock this week"]) });
  const F = ord("20261009090009-sw09", { product: "salt", qty: 1, status: "cancelled",
    history: hs([3500, "placed", "customer"], [3400, "cancelled", "desk", "The road was shut that day"]) });
  const G = ord("20261009090010-sw10", { product: "oil", qty: 1, unit: 40, total: 40, status: "cancelled",
    history: hs([3500, "placed", "customer"], [3400, "cancelled", "customer"]) });
  const ALL = [A, B, H, R, D1, D2, N, E, F, G];

  const u = "abcd-efgh", pass = "fixture-pass-7c1", ck = await C.contentKey("test-secret", u);
  const prices = { at: new Date().toISOString(), week: { monday: "2026-10-05", label: "5 to 11 Oct 2026" }, soon: [], products: [
    { product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 3, sizes: [{ q: 1, price: 100 }, { q: 2.5, price: 250 }], supply: { light: "yellow", by: "2026-10-20" } },
    { product: "oil", unit: "unit", basis: "yours", rate: 40, orders: 2, sizes: [{ q: 1, price: 44 }], supply: { light: "red" } },
    { product: "candy", unit: "unit", basis: "yours", rate: 12, orders: 2, sizes: [{ q: 1, price: 13 }], supply: { light: "green", by: "2026-10-21" } },
    { product: "rice", unit: "unit", basis: "yours", rate: 9, orders: 1, sizes: [{ q: 1, price: 10 }] }] };
  const body = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-7c1-abcdefghij",
    env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })),
    prices: await C.encryptWith(ck, JSON.stringify(prices)) };
  /* a customer's page, signed in, on an invented account holding `orders`; Place answers with `placed` */
  const open = async ({ orders = [], placed = null, open: bodyOf = body, post = null }) => {
    const st = { orders: orders.map((o) => ({ ...o })), log: [] };
    const dom = new JSDOM(P.landingPage(u, "n7c1", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, bodyOf);
        if (p === "/orders" && m === "GET") return answer(200, { ok: true, orders: JSON.parse(JSON.stringify(st.orders)), claims: [] });
        if (p === "/orders" && m === "POST" && post) return post(init);
        if (p === "/orders" && m === "POST" && placed) { st.log.push(p); st.orders = [{ ...placed }]; return answer(200, { ok: true, order: placed }); }
        return answer(404, { ok: false });
      };
    } });
    wins.push(dom.window);
    const w = dom.window, d = w.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => d.querySelector("#pPrices .pmark") && (!orders.length || d.querySelector("#pOrder [data-row]")));
    return { w, d, st };
  };
  const tab = (pg, k) => pg.d.querySelector('button[data-t="' + k + '"]').click();
  /* what is DRAWN: every text node a person can see, which leaves out what the reader alone is told (.sr), a mark's own letter (it is in the svg)
     and the page's script and style */
  const drawnText = (root) => { const out = [], tw = root.ownerDocument.createTreeWalker(root, 4);
    while (tw.nextNode()) { const n = tw.currentNode; if (!/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) && !n.parentNode.closest(".sr, svg")) out.push(n.nodeValue); }
    return out.join(" ").replace(/\s+/g, " "); };
  /* the shape words drawn under root, each as many times as it stands (a mark whose shape word is drawn is a mark that is not alone) */
  const shapesDrawn = (root) => { const s = drawnText(root); return SHAPES.flatMap((w) => s.match(new RegExp("\\b" + w + "\\b", "g")) || []); };
  /* a mark with no name: the reader is told its shape by the heading's own label, by the .sr that follows it, or by its tile's .sr. A nameless mark is a hole. */
  const nameless = (d) => [...d.querySelectorAll("svg.psym:not(.glyph)")].filter((s) => {
    const host = s.closest("[aria-label]"), nx = s.nextElementSibling, tile = s.closest(".mtile, .mstack"), tsr = tile && tile.querySelector(".sr");
    return !((host && SHAPES.some((x) => host.getAttribute("aria-label").startsWith(x)))
      || (nx && nx.classList.contains("sr") && SHAPES.includes(t(nx))) || (tsr && SHAPES.some((x) => t(tsr).startsWith(x))));
  });
  const seen = { marks: 0 };
  const marks = (d) => { seen.marks = Math.max(seen.marks, d.querySelectorAll("svg.psym:not(.glyph)").length); return nameless(d); };

  try {
    /* ---- 1 and 2: every state, on the list and on the order's own screen */
    const S = await open({ orders: ALL });
    const rows = (pg) => Object.fromEntries([...pg.d.querySelectorAll("#pOrder [data-row]")].map((r) => [r.getAttribute("data-row"), r]));
    tab(S, "order");
    S.d.querySelector("#pOrder .olater").click();
    await until(() => S.d.querySelector('#pOrder [data-row="' + G.id + '"]'));
    const R0 = rows(S);
    const chip = (id) => t(R0[id].querySelector(".salt-status"));
    const want = { [A.id]: "Placed", [B.id]: "Confirmed", [H.id]: "Confirmed", [R.id]: "Ready to deliver", [D1.id]: "Collected", [D2.id]: "Delivered",
      [N.id]: "Complete", [E.id]: "Declined", [F.id]: "Cancelled by us", [G.id]: "Cancelled by you" };
    const got = Object.fromEntries(ALL.map((o) => [o.id, R0[o.id] ? chip(o.id) : null]));
    ok(JSON.stringify(got) === JSON.stringify(want),
      "each state is one word on its row under Your orders: Placed, Confirmed, Ready to deliver, Collected, Delivered, Complete, Declined and the two cancellations: " + JSON.stringify(got));
    /* Counter Batch A (18 Oct 2026): one glyph before each word, aria-hidden, so the word above is still all the chip says */
    const glyph = (id) => { const c = R0[id] && R0[id].querySelector(".salt-status"), g = c ? [...c.querySelectorAll("svg")] : [];
      return g.length === 1 && c.firstChild === g[0] && g[0].getAttribute("aria-hidden") === "true" && g[0].classList.contains("salt-status__glyph") ? g[0].getAttribute("data-g") : null; };
    const wantG = { [A.id]: "dot", [B.id]: "tick", [H.id]: "tick", [R.id]: "tick", [D1.id]: "ticks", [D2.id]: "ticks", [N.id]: "ticks", [E.id]: "cross", [F.id]: "cross", [G.id]: "cross" };
    const gotG = Object.fromEntries(ALL.map((o) => [o.id, glyph(o.id)]));
    ok(JSON.stringify(gotG) === JSON.stringify(wantG),
      "each chip leads with one aria-hidden glyph: a dot while placed, a tick once confirmed or ready, a double tick once handed over or complete, a cross once ended: " + JSON.stringify(gotG));

    const screen = async (o) => { R0[o.id].click(); await until(() => S.d.querySelector('#pOrder .oscreen[data-order="' + o.id + '"]')); return S.d.querySelector('#pOrder .oscreen[data-order="' + o.id + '"]'); };
    const parts = (s) => ({ head: t(s.querySelector('[data-part="head"] .state')), when: t(s.querySelector('[data-part="when"]')),
      steps: [...s.querySelectorAll('[data-part="steps"] li')].map(t).join("|"), money: t(s.querySelector('[data-part="money"]')), hist: t(s.querySelector('[data-part="hist"]')) });
    const sA = parts(await screen(A)), sB = parts(await screen(B)), sH = parts(await screen(H)), sD2 = parts(await screen(D2)), sE = parts(await screen(E)), sN = parts(await screen(N));
    ok(sA.head === "Placed" && /^Waiting for us to confirm\. You will see it change here\./.test(sA.when) && sA.steps === "Placed|Confirmed|Ready|Collected",
      "a placed order's own screen reads Placed, Waiting for us to confirm, and its steps run Placed, Confirmed, Ready, Collected: " + JSON.stringify(sA));
    ok(sB.head === "Confirmed" && /^Confirmed on \d\d \w{3} \d{4}, and being prepared\./.test(sB.when) && sB.steps === "Placed|Confirmed|Ready|Collected",
      "a confirmed order reads Confirmed, and the day it was confirmed: " + JSON.stringify(sB.when));
    ok(sD2.head === "Delivered" && sD2.steps === "Placed|Confirmed|Ready|Delivered" && sN.head === "Complete" && /^Your order is now complete\./.test(sN.when),
      "a delivered order's steps end on Delivered, and a finished one reads Complete: " + JSON.stringify([sD2.head, sD2.steps, sN.head]));
    ok(sE.head === "Declined" && /^We could not take this order\. Out of stock this week\. Nothing is owed\./.test(sE.when) && /Declined: Out of stock this week/.test(sE.hist) && sE.steps === "",
      "a declined order reads Declined, then his reason, and its history says Declined: " + JSON.stringify([sE.head, sE.when, sE.hist]));
    ok(/Sent by you/.test(sH.money) && /Waiting for us to confirm/.test(sH.money) && !/Sent, waiting/.test(sH.money.replace(/Sent, waiting for us to confirm/, "")),
      "a claim of theirs waiting is Waiting for us to confirm beside what they sent: " + JSON.stringify(sH.money));
    const whyA = t(R0[A.id].querySelector(".salt-inbox-row__what"));
    tab(S, "home");
    await until(() => /Waiting for us to confirm/.test(t(S.d.getElementById("hComing"))));
    ok(whyA === "Waiting for us to confirm" && /Waiting for us to confirm/.test(t(S.d.getElementById("hComing"))),
      "a placed order is waiting on the same words in the list's reason and on Home's Coming up: " + JSON.stringify([whyA, t(S.d.getElementById("hComing")).slice(0, 80)]));

    /* ---- 3: no word of the family in any text the page renders; Place and the order sheet driven too */
    tab(S, "prices");
    const priceText = words(S.d.getElementById("pPrices"));
    S.d.getElementById("oNew") && S.d.getElementById("oNew").click();
    const textAll = () => words(S.d.body);
    const sweepA = textAll();
    ok(!FAMILY.test(sweepA), "no acknowledged, no Not taken and no Expected by in anything the page shows with every screen drawn: " + JSON.stringify((sweepA.match(/.{0,30}(acknowledg|not taken|expected by).{0,30}/i) || [""])[0]));
    const L = await open({ placed: ord("20261010090011-sw11", { qty: 1, total: 100 }) });
    tab(L, "order");
    await until(() => L.d.getElementById("oNew"));
    L.d.getElementById("oNew").click();
    [...L.d.querySelectorAll("#osheet button")].find((b) => b.textContent === "Deliver to me").click();
    const wh = L.d.getElementById("oWhere"); wh.value = "Old market"; wh.dispatchEvent(new L.w.Event("input", { bubbles: true }));
    const formText = t(L.d.getElementById("osheet"));
    L.d.getElementById("oGo").click();
    const checkText = t(L.d.getElementById("osheet")), delRow = [...L.d.querySelectorAll("#osheet .salt-ledger__row")].find((r) => t(r.querySelector(".salt-ledger__label")) === "Delivery");
    ok(!FAMILY.test(formText + checkText) && /confirm your order, before you pay/.test(checkText) && t(delRow.querySelector(".salt-ledger__value")) === "Set when we confirm it" && /set when we confirm it/.test(formText),
      "the order sheet and its check say confirm where they said acknowledge: the delivery sentence, the line and the form: " + JSON.stringify(t(delRow)));
    [...L.d.querySelectorAll("#osheet button")].find((b) => b.textContent === "Change").click();
    [...L.d.querySelectorAll("#osheet button")].find((b) => b.textContent === "I will collect").click();
    L.d.getElementById("oGo").click();
    L.d.getElementById("oPlace").click();
    await until(() => /Order placed/.test(t(L.d.getElementById("osheet"))));
    const sentText = t(L.d.getElementById("osheet"));
    ok(sentText.startsWith("Order placed") && sentText.includes("We confirm it there, and you pay once it is confirmed.") && !FAMILY.test(sentText),
      "Place answers Order placed, and that we confirm it there: " + JSON.stringify(sentText.slice(0, 120)));
    ok(marks(L.d).length === 0 && marks(S.d).length === 0 && shapesDrawn(L.d.body).length === 0 && shapesDrawn(S.d.body).length === 0,
      "and no screen of either page draws a shape word, nor leaves a mark without its name (see 7)");

    /* ---- 4: the banner of each move, off the real wake and the service worker's own builder */
    const shown = [], handlers = {};
    const ctx = { URL, Promise, fetch: async () => ({ ok: false }), setTimeout, clients: {},
      self: { location: { href: "https://x.test/sw.js?u=" + u }, registration: { scope: "https://x.test/", showNotification: (title, o) => { shown.push([title, o.body]); return Promise.resolve(); } },
        addEventListener: (e, f) => { handlers[e] = f; }, skipWaiting() {}, clients: { claim() {} } } };
    vm.runInNewContext(SW.swScript(), ctx);
    const banner = async (wake) => { let p; shown.length = 0; handlers.push({ data: { json: () => wake }, waitUntil: (x) => { p = x; } }); await p; return shown[0]; };
    const oid = "20261010090001-sw01";
    const move = (ev, order) => O.wakes(ev, Object.assign({ id: oid, mode: "collect", total: 100, delivery: 0, paid: 0, moved: 0 }, order || {}), false);
    const asked = {
      "his confirm, paid in advance": [move({ kind: "status", by: "desk", status: "acknowledged" }, { prepay: true }), ["Order confirmed", "Please make your payment now."]],
      "his confirm, on credit": [move({ kind: "status", by: "desk", status: "acknowledged" }), ["Order confirmed", "Please pay now if you can. Payment is due when it is ready to collect or on its way, or when you receive it."]],
      "his decline, no reason": [move({ kind: "status", by: "desk", status: "declined" }), ["Order declined", "Open Salt Counter to see it."]],
      "his decline, with a reason": [move({ kind: "status", by: "desk", status: "declined", note: "Out of stock this week" }), ["Order declined", "Out of stock this week"]],
      "a group order closing": [{ k: "pool-closed", o: oid }, ["Group order closed", "Your order is in. We confirm it next."]],
      "ready to collect": [move({ kind: "status", by: "desk", status: "ready" }), ["Order ready to collect", "Please make your payment now."]],
      "all of it collected": [move({ kind: "handover" }, { moved: 1, qty: 1, mode: "collect" }), ["Order collected", "Payment is due."]]
    };
    const gotB = {};
    for (const [k, [wake]] of Object.entries(asked)) gotB[k] = wake ? await banner(wake) : null;
    ok(Object.entries(asked).every(([k, [, exp]]) => gotB[k] && gotB[k][0] === exp[0] && gotB[k][1] === exp[1]),
      "each move's banner is its one word: Order confirmed (paid in advance and on credit), Order declined (with and without his reason), the group order's We confirm it next: " + JSON.stringify(gotB));
    const every = [];
    for (const k of Object.keys(W.EN).filter((x) => x.startsWith("news.")).map((x) => x.slice(5).split(".")[0]).filter((x, i, a) => a.indexOf(x) === i)) {
      if (!Object.prototype.hasOwnProperty.call(SW.NEWS, k)) continue;
      for (const v of [undefined, "owed", "waiting", "paid"]) { const b = await banner(v ? { k, o: oid, v } : { k, o: oid }); if (b) every.push(b.join(" | ")); }
    }
    ok(every.length > 30 && !every.some((b) => FAMILY.test(b)), "and no banner of any kind or case carries the family: " + every.length + " built, " + JSON.stringify(every.filter((b) => FAMILY.test(b))));

    /* ---- 5: the net, every word the page is served */
    const served = P.landingPage(u, "n7c2", null), keys = Object.keys(W.EN);
    /* the page's markup outside its script and style, and any quoted string in its script that starts with a capital: the record's own state name, lower case, is code */
    const markup = served.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " "), literal = /['"][^'"\n]*(Acknowledg|Not taken|Expected by)[^'"\n]*['"]/.exec(served);
    ok(!FAMILY.test(Object.values(W.EN).join("\n")) && !FAMILY.test(markup) && !literal,
      "no value of the table, no markup the page serves and no quoted string in its script holds acknowledged, Not taken or Expected by: " + JSON.stringify((Object.values(W.EN).join("\n").match(/.{0,30}(acknowledg|not taken|expected by).{0,30}/i) || [""])[0]));
    ok(["st.placed", "st.acknowledged", "st.declined", "ow.placed", "ow.confirmed", "ow.declined", "ow.declinedWhy", "hc.placed", "why.placed", "news.confirmed", "news.confirmed-credit", "news.declined", "sup.by", "sh.sent", "sh.lineSent"]
      .every((k) => keys.includes(k)) && W.EN["st.placed"] === "Placed" && W.EN["st.acknowledged"] === "Confirmed" && W.EN["st.declined"] === "Declined" && W.EN["sh.lineSent"] === "Placed",
      "the keys stay and their values move: S13 13.3 reads the table by key, the record's own state is still acknowledged");

    /* ---- 6: supply */
    tab(S, "prices");
    const panes = [...S.d.querySelectorAll("#pPrices .pane")].map((p) => ({ aria: p.querySelector(".pmark").getAttribute("aria-label"), by: t(p.querySelector("p.sub2")) }));
    ok(panes[0].aria === "Cube, Limited" && panes[0].by === "More by 20 Oct" && panes[1].aria === "Droplet, Out for now" && panes[1].by === "" && panes[2].aria === "Lozenge, Available" && panes[2].by === "" && !/Expected by/.test(priceText),
      "yellow with a day reads More by 20 Oct, red with none and green with one read nothing under the mark, and it never reads Expected by: " + JSON.stringify(panes));

    /* ---- 7: a mark stands alone (his word of 12 Oct 2026): no shape word is drawn, and the reader is still told the shape */
    const nameP = marks(S.d), nameL = marks(L.d);
    const heads = [...S.d.querySelectorAll("#pPrices h2.pmark")].map((h) => [h.getAttribute("aria-label").split(",")[0], drawnText(h).trim()]);
    ok(seen.marks >= 25 && shapesDrawn(S.d.body).length === 0 && shapesDrawn(L.d.body).length === 0 && nameP.length === 0 && nameL.length === 0
      && heads.length === 4 && heads.every(([a, b]) => SHAPES.includes(a) && b === ""),
      "no shape word is drawn across Prices, Home, Your orders, each order's screen and the order sheet, every mark is still named by its shape for the reader, and a heading is its mark alone: " + JSON.stringify({ marks: seen.marks, drawn: shapesDrawn(S.d.body).concat(shapesDrawn(L.d.body)), nameless: nameP.length + nameL.length, heads }));
    const checkL = await open({ orders: [] });
    tab(checkL, "order"); await until(() => checkL.d.getElementById("oNew")); checkL.d.getElementById("oNew").click();
    const legsAll = [...checkL.d.querySelectorAll("#osheet fieldset.salt-options")].filter((f) => f.querySelector("legend svg.psym"));
    const legs = legsAll.map((f) => [t(f.querySelector("legend .sr")), drawnText(f.querySelector("legend")).trim()]);
    const more = legsAll.filter((f) => !f.querySelector("input:checked"));
    more.forEach((f) => f.querySelector("input").click());
    checkL.d.getElementById("oGo").click();
    const lines = [...checkL.d.querySelectorAll("#osheet .pwith")].map((x) => [t(x.querySelector(".sr")), drawnText(x).trim()]);
    ok(legs.length === 4 && legs.every(([said, drawn]) => SHAPES.includes(said) && drawn === "") && lines.length >= 2 && lines.every(([said, drawn]) => SHAPES.includes(said) && /^\d+(\.\d+)? units?$/.test(drawn))
      && marks(checkL.d).length === 0 && shapesDrawn(checkL.d.body).length === 0,
      "the order sheet names each book by its shape for the reader only, in its legend (the mark alone) and in each line of the check (the size, then the mark): " + JSON.stringify({ legs, lines }));

    /* 7b: a sheet of two books whose list moved at Place: each line that moved leads with its mark, named by its shape for the reader only */
    const list2 = (digest, oil10) => ({ at: new Date().toISOString(), digest, week: { monday: "2026-10-05", label: "5 to 11 Oct 2026" }, soon: [],
      products: [{ product: "salt", unit: "unit", basis: "tier", tier: "Gold", sizes: [{ q: 1, price: 100 }, { q: 2, price: 190 }] },
        { product: "oil", unit: "unit", basis: "fixed", sizes: [{ q: 5, price: 50 }, { q: 10, price: oil10 }] }] });
    const sealed2 = async (l) => Object.assign({ at: l.at, week: l.week.monday, digest: l.digest }, await C.encryptWith(ck, JSON.stringify(l)));
    const body2 = Object.assign({}, body, { prices: await sealed2(list2("d1", 95)) });
    const moved2 = { status: 409, j: { ok: false, error: "prices moved", code: "pricesMoved", prices: await sealed2(list2("d2", 99)) } };
    const M = await open({ open: body2, post: async () => ({ ok: false, status: moved2.status, json: async () => moved2.j }) });
    tab(M, "order"); await until(() => M.d.getElementById("oNew")); M.d.getElementById("oNew").click();
    const radio = (k) => M.d.querySelector('#osheet input[data-k="' + k + '"]');
    radio("size:2").click(); radio("size1:10").click();
    M.d.getElementById("oGo").click(); M.d.getElementById("oPlace").click();
    await until(() => M.d.querySelector("#osheet .salt-insight--copper"));
    const mv = M.d.querySelector("#osheet .salt-insight--copper"), mvKid = mv && mv.firstElementChild, mvNext = mvKid && mvKid.nextElementSibling;
    ok(!!mv && /Now RM 99\.00 \(was RM 95\.00\)/.test(t(mv)) && !!mvKid && mvKid.classList.contains("psym") && !!mvNext && mvNext.classList.contains("sr") && t(mvNext) === "Droplet"
      && shapesDrawn(mv).length === 0 && marks(M.d).length === 0,
      "a line of the check whose price moved at Place leads with its mark, named by its shape for the reader and drawn with no shape word: " + JSON.stringify(mv && drawnText(mv)));

    /* ---- 8: the tile's caption is the size alone */
    const tile = S.d.querySelector('#pOrder [data-row="' + A.id + '"] .mtile');
    const capOf = (tl) => t(tl.querySelector(".mq")), srOf = (tl) => t(tl.querySelector(".sr"));
    const tiles = [...S.d.querySelectorAll(".mtile")];
    ok(!!tile && capOf(tile) === "2.5 units" && srOf(tile) === "Cube 2.5 units" && tile.querySelector(".mq").getAttribute("aria-hidden") === "true" && !tile.querySelector(".mq .nb")
      && tiles.length > 10 && tiles.every((tl) => srOf(tl) === SHAPES.find((s) => srOf(tl).startsWith(s + " ")) + " " + capOf(tl)),
      "a tile's caption is the size in words, 2.5 units, with no shape word, and a reader hears the shape and the size once; on every tile the reader's name is the shape, then the caption: " + JSON.stringify([capOf(tile), srOf(tile)]));
    const sv = new JSDOM("<body>" + P.mtileSvg("salt", "2.5 units") + P.mtileSvg("spare", "1 unit") + "</body>").window.document;
    const [t1, t2] = [...sv.querySelectorAll(".mtile")];
    ok(!!t1 && !!t2 && capOf(t1) === "2.5 units" && srOf(t1) === "Cube 2.5 units" && capOf(t2) === "1 unit" && srOf(t2) === "Ring 1 unit" && t1.querySelector(".mq").getAttribute("aria-hidden") === "true"
      && t1.querySelectorAll("svg.psym").length === 1 && t1.querySelector("svg text.plet").textContent === P.PLET.salt && shapesDrawn(sv.body).length === 0,
      "the statement's server markup draws the same caption, the size alone, the Ring's name for a book with no mark, and keeps its letter: " + JSON.stringify([capOf(t1), capOf(t2)]));
    const served8 = P.landingPage(u, "n7c4", null), css8 = (served8.match(/<style[^>]*>[\s\S]*?<\/style>/) || [""])[0];
    ok(css8.includes(".mtile{") && !/\.pshape|\.mq \.nb|max-width:11ch/.test(css8), "and the page carries no rule for a shape word, nor for the caption's comma break");
    const board = new JSDOM(P.boardPage({ prices: { week: { label: "5 to 11 Oct 2026" }, products: [
      { product: "salt", unit: "unit", sizes: [{ q: 1, price: 130 }] }, { product: "oil", unit: "unit", sizes: [{ q: 1, price: 44 }] }, { product: "tin", unit: "unit", sizes: [{ q: 1, price: 9 }] }] } }, "n7c3")).window.document;
    const bh = [...board.querySelectorAll("h2.pmark")].map((h) => [h.getAttribute("aria-label"), drawnText(h).trim(), !!h.querySelector("svg.psym")]);
    ok(JSON.stringify(bh) === JSON.stringify([["Cube", "", true], ["Droplet", "", true], ["Ring", "", true]]) && shapesDrawn(board.body).length === 0,
      "a guest's board is each mark alone, named by its shape for the reader, the Ring for a book with none: " + JSON.stringify(bh));

    /* ---- 9: no shape word is a product's, wherever the reader is told it */
    /* the signed-in screens: the door and Account say the app's own name, Salt Counter, the one name the site may write (v704) */
    const screens = (d) => ["pHome", "pPrices", "pOrder", "pCard", "osheet", "ynSheet", "paySheet"].map((id) => d.getElementById(id)).filter(Boolean).map(words).join(" ");
    const bits9 = { page: screens(S.d), placed: screens(L.d), sheet: screens(checkL.d), board: words(board.body), tiles: t(sv.body) }, everyText = Object.values(bits9).join(" ");
    const where9 = Object.entries(bits9).filter(([, v]) => SO.wordsIn(v, PRODUCTS).length).map(([k, v]) => [k, (v.match(/.{0,30}\b(salt|oil|candy|rice|spare)\b.{0,30}/i) || [""])[0]]);
    ok(SO.wordsIn(everyText, PRODUCTS).length === 0 && !SHAPES.some((s) => SO.wordsIn(s, PRODUCTS).length) && !PRODUCTS.some((w) => new RegExp("(^|[^a-z])" + w, "i").test(SHAPES.join(" "))) && SHAPES.length === 5,
      "no product word and no level word in the captions, headings and lines of any screen, what the reader is told included, and none among the five shape words: " + JSON.stringify(where9));

    /* ---- 10: his words, through the Worker's lock */
    const newWords = ["Placed", "Confirmed", "Declined", "Waiting for us to confirm", "Order confirmed", "Order declined", "More by 20 Oct", "We could not take this order."]
      .concat(SHAPES, ["st.placed", "st.acknowledged", "st.declined", "ow.placed", "ow.confirmed", "ow.declined", "ow.declinedWhy", "hc.placed", "why.placed", "news.confirmed", "news.declined", "sup.by"].map((k) => W.EN[k]));
    const bad = newWords.filter((x) => SO.siteWords(x) !== "" || SO.wordsIn(x, PRODUCTS).length);
    ok(bad.length === 0 && newWords.length > 20, "every new word, and his answers and reasons made of them, pass siteWords on the Worker: " + JSON.stringify(bad));
    ok(SO.siteWords("you are Gold") !== "" && SO.siteWords("Placed at CX7-LUM") !== "" && SO.wordsIn("Confirmed: your oil", PRODUCTS).length > 0,
      "and the Worker's lock still refuses a level and a code, and finds a product's word beside them, so the pass above is not a lock that opened");

    /* ---- 11: what the order's card says they see */
    const told = ["placed", "acknowledged", "declined"].map((s) => SO.toldOf({ status: s, history: [{ status: s, by: "desk" }] }));
    ok(JSON.stringify(told) === JSON.stringify(["They see Placed: Waiting for us to confirm.", "They see Confirmed.", "They see Declined: We could not take this order."]) && !FAMILY.test(Object.values(SO.CUSTOMER_SEES).flat().join(" ")),
      "the card tells him what they see in the page's own words: " + JSON.stringify(told));


    /* ---- 12: the practice accounts */
    const all = TF.buildAll(new Date()), fixOrders = Object.values(all).flatMap((f) => f.orders);
    const FX = await open({ orders: fixOrders.slice(0, 40) });
    tab(FX, "order");
    const fxChips = [...FX.d.querySelectorAll("#pOrder [data-row] .salt-status")].map(t);
    const fxStates = new Set(fixOrders.map((o) => o.status));
    const KNOWN = new Set(["Placed", "Confirmed", "Ready to collect", "Ready to deliver", "Collected", "Delivered", "Part collected", "Part delivered", "Complete", "Declined", "Cancelled by us", "Cancelled by you"]);
    ok(["placed", "acknowledged", "ready", "done", "declined", "cancelled"].every((s) => fxStates.has(s)) && fxChips.length > 5 && fxChips.every((c) => KNOWN.has(c)) && fxChips.includes("Placed") && fxChips.includes("Confirmed")
      && !TF.FEATURES.some(([n]) => /acknowledg|not taken/i.test(n)) && TF.missing(all).length === 0,
      "the practice accounts' orders read in the new words on the page, every state of them is held, and no feature name carries the old: " + JSON.stringify([...new Set(fxChips)]));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
