/* test/delivery-window.mjs: A DELIVERY'S TIME WINDOW (his decisions of 10 Oct 2026). As soon as it can, or one of six
 * four-hour windows, each its next occurrence inside the Counter's hours (Salt Admin's weekly schedule and manual
 * override), a closed day rolling it to its next open one; a window partly inside says the part inside. The Worker takes
 * what the page offers (one rule, stmt/window.js, carried to the page as text), the order keeps the window and its span,
 * Salt Admin's card says it, and no ledger entry carries it. Every assertion was proved red by its own mutation. */
const U = "wrnd-zwse", PASS = "fixture-pass-window-01";

export async function run({ ok }) {
  const Wn = await import("../stmt/window.js"), O = await import("../stmt/orders.js"), H = await import("../stmt/hours.js");
  const W = await import("../stmt/words.js");
  const HR = 3600000;
  const week = (open, close, shut = []) => ({ schedule: { days: [0, 1, 2, 3, 4, 5, 6].map((d) => (shut.includes(d) ? null : { open, close })) }, manual: null });
  /* Saturday 10 Oct 2026, 13:30 in Kuala Lumpur */
  const at = Date.parse("2026-10-10T05:30:00Z");

  /* 1. THE RULE */
  const nine = week("09:00", "21:00", [0]);
  const got = Object.fromEntries(Wn.WINDOWS.map((w) => [w, Wn.slotNext(w, nine, at)]));
  ok(got[0] === null && got[4] === null, "a window wholly outside the hours on every day is not offered: " + JSON.stringify([got[0], got[4]]));
  ok(got[16].slot === "2026-10-10T16" && got[16].span === "16:00-20:00" && got[20].slot === "2026-10-10T20" && got[20].span === "20:00-21:00",
    "a window still to start today is today's, and one partly inside says the part inside: " + JSON.stringify([got[16], got[20]]));
  ok(got[8].slot === "2026-10-12T08" && got[8].span === "09:00-12:00" && got[12].slot === "2026-10-12T12",
    "a window already begun is not offered today, and Sunday being closed rolls it to Monday (his Q6): " + JSON.stringify([got[8], got[12]]));
  ok(Wn.slotNext(8, null, at).slot === "2026-10-11T08" && Wn.slotNext(0, null, at).span === "00:00-04:00",
    "with no hours set, every window is open at its next occurrence");
  const shut = { schedule: nine.schedule, manual: { open: false, until: "2026-10-12T02:00:00.000Z" } };
  ok(Wn.slotNext(8, shut, at).span === "10:00-12:00" && Wn.slotNext(20, shut, at).slot === "2026-10-12T20",
    "a manual close cuts the windows it covers to the part after it: " + JSON.stringify([Wn.slotNext(8, shut, at), Wn.slotNext(20, shut, at)]));
  ok(Wn.slotNext(8, week("09:00", "21:00", [0, 1, 2, 3, 4, 5, 6]), at) === null, "a week closed every day offers no window");
  ok(Wn.slotTake("2026-10-10T12", nine, at).span === "12:00-16:00" && Wn.slotTake("2026-10-10T08", nine, at).error === "slot"
    && Wn.slotTake("2026-10-11T08", nine, at).error === "slot" && Wn.slotTake("2026-10-19T08", nine, at).error === "slot"
    && Wn.slotTake("2026-10-10T13", nine, at).error === "slot" && Wn.slotTake("2026-02-30T08", null, at).error === "slot",
    "the Worker takes a window begun but not ended, and refuses one ended, one wholly outside the hours, one past eight days, an hour not a window's, a day that is not one");

  /* 2. ONE RULE ON BOTH SIDES: the page carries the Worker's own source, ES5, and computes the same over a grid of times */
  const src = [Wn.slotSpan, Wn.slotNext].map(String).join("\n");
  ok(!/[\\`]|=>|\blet\b|\bconst\b/.test(src), "the window rule the page carries is ES5 with no backslash or backtick, so it rides in the template literal as it is");
  const { landingPage } = await import("../stmt/page.js");
  const html = landingPage("", "nw", null, null), script = html.slice(html.lastIndexOf('<script nonce="nw">') + 19, html.lastIndexOf("</script>"));
  ok(script.includes(Wn.slotNext.toString()) && script.includes(Wn.slotSpan.toString()) && !script.includes("__WINDOW"),
    "the page's script carries both functions as the Worker has them");
  /* the functions as the page's own script holds them, never the Worker's source again: a page carrying anything else differs */
  const s0 = script.indexOf("function slotSpan("), s1 = script.indexOf("var WINS=");
  let paged = { slotNext: () => "missing" };
  try { if (s0 >= 0 && s1 > s0) paged = new Function(script.slice(s0, s1) + "\nreturn {slotNext: slotNext};")(); } catch (e) { paged = { slotNext: () => "throws" }; }
  let differ = 0, n = 0;
  for (const cfg of [null, nine, shut, week("06:30", "10:15", [3, 6])]) for (let t = at; t < at + 9 * 24 * HR; t += 97 * 60000)
    for (const w of Wn.WINDOWS) { n++; if (JSON.stringify(paged.slotNext(w, cfg, t)) !== JSON.stringify(Wn.slotNext(w, cfg, t))) differ++; }
  ok(n > 3000 && differ === 0, "the page's copy offers what the Worker's offers at every point of nine days: " + differ + " of " + n);

  /* 3. THE HOURS AS STORED: a fault reads as none set, never as closed */
  ok(JSON.stringify(H.windowHours(null)) === JSON.stringify({ schedule: null, manual: null })
    && H.windowHours({ schedule: { days: [1] } }).schedule === null
    && H.windowHours({ schedule: nine.schedule, manual: { open: true, until: "nope" } }).manual === null
    && H.windowHours({ schedule: nine.schedule }).schedule.days[1].open === "09:00",
    "the hours a window reads are Salt Admin's, a schedule or override that does not validate reading as none set");
  const stored = await H.hoursConfig({ STMT: { get: async () => { throw new Error("down"); } } });
  ok(stored.schedule === null && stored.manual === null, "a store that cannot be read offers every window rather than refusing an order");

  /* 4. THE WORKER AT PLACE */
  const iso = new Date(at).toISOString();
  const base = { product: "salt", qty: 1, mode: "deliver", unit: 100, total: 100, place: "Taman Contoh", forFriend: false, rid: "a".repeat(32), digest: "d" };
  const placed = O.decidePlace(U, Object.assign({ slot: "2026-10-12T08" }, base), [], iso, "d", "customer", null, { hours: nine });
  ok(placed.ev && placed.ev.order.slot === "2026-10-12T08" && placed.ev.order.slotSpan === "09:00-12:00",
    "a delivery placed with a window keeps it and the span the hours give it: " + JSON.stringify(placed.ev && [placed.ev.order.slot, placed.ev.order.slotSpan]));
  const outside = O.decidePlace(U, Object.assign({ slot: "2026-10-11T04" }, base), [], iso, "d", "customer", null, { hours: nine });
  ok(outside.code === "slot" && outside.error === W.EN["e.slot"], "a window the hours close is refused in the customer's words: " + JSON.stringify(outside));
  const open = O.decidePlace(U, Object.assign({ slot: "2026-10-11T04" }, base), [], iso, "d", "customer", null, {});
  ok(open.ev && open.ev.order.slotSpan === "04:00-08:00", "with no hours set the same window is taken whole");
  const collect = O.decidePlace(U, Object.assign({}, base, { mode: "collect", slot: "2026-10-12T08" }), [], iso, "d", "customer", null, { hours: nine });
  const both = O.decidePlace(U, Object.assign({}, base, { slot: "2026-10-12T08", wantBy: "2026-10-14" }), [], iso, "d", "customer", null, { hours: nine });
  ok(!!collect.error && !collect.ev && !!both.error && !both.ev, "a window is a delivery's, and never beside a day: " + JSON.stringify([collect.error, both.error]));
  const asap = O.decidePlace(U, base, [], iso, "d", "customer", null, { hours: nine });
  ok(asap.ev && !("slot" in asap.ev.order) && !("slotSpan" in asap.ev.order), "a delivery with none is as soon as it can, and carries no window");
  const view = O.customerView(placed.ev.order);
  ok(view.slot === "2026-10-12T08" && view.slotSpan === "09:00-12:00", "the customer's view carries the window and its span");

  /* the review is reserved on the window too, so a window changed under the card is never accepted unseen */
  const o = Object.assign({}, placed.ev.order);
  const terms = Object.fromEntries(["status", "product", "qty", "total", "mode", "place", "forFriend", "wantBy", "slot"].map((k) => [k, o[k] ?? null]));
  ok(!!O.decideDesk(o, { reserveReview: terms }, iso).ev, "the review is reserved on the order as the card read it, its window included");
  ok(O.decideDesk(Object.assign({}, o, { slot: "2026-10-12T12" }), { reserveReview: terms }, iso).status === 409,
    "and refused when the window moved since the card read it");
  /* an amendment carries a window: decideReplace takes it and checks it as Place does */
  const rep = O.decideReplace(o, { product: "salt", qty: 2, mode: "deliver", unit: 100, total: 200, place: "Taman Contoh", forFriend: false, rid: "b".repeat(32),
    week: "", digest: "d", slot: "2026-10-12T12" }, [o], iso, "d", { hours: nine });
  ok(rep.place && rep.place.order.slot === "2026-10-12T12" && rep.place.order.slotSpan === "12:00-16:00", "an amendment before Accept may change the window, checked as Place checks it");
  const { makerOrderFault } = await import("../src/maker.js");
  ok(makerOrderFault("amend", { u: "ab", product: "salt", qty: 1, mode: "deliver", forFriend: false, rid: "c".repeat(32), digest: "d", slot: "2026-10-12T08" }) === ""
    && /window/.test(makerOrderFault("amend", { u: "ab", product: "salt", qty: 1, mode: "deliver", forFriend: false, rid: "c".repeat(32), digest: "d", slot: "2026-10-12T09" }) || ""),
    "the Desk's bridge takes a window in the shape the Counter writes it and nothing else");

  /* 5. NO LEDGER ENTRY CARRIES IT: the row is dated and priced as before, the window being the site's and the cards' */
  const { pendingEntry } = await import("../src/orders.js");
  const pe = pendingEntry(Object.assign({}, o, { history: [{ at: iso, status: "acknowledged", by: "desk" }] }), "CX0-AA", iso);
  ok(pe && !/2026-10-12T08|09:00-12:00|slot/.test(JSON.stringify(pe)), "the pending row carries neither the window nor its span");

  /* 6. THE CARD: Salt Admin's order card says the part of the window inside the hours (the Desk draws no order card since 18 Oct 2026) */
  const { OWNER_JS } = await import("../stmt/owner.js");
  ok(/Wanted '\+String\(order\.slotSpan\)\.replace\('-',' to '\)/.test(OWNER_JS), "Salt Admin's order card says the span too");

  /* 7. THE SHEET: a delivery asks As soon as it can or a window open now, the span said, and Place sends the window */
  const C = await import("../tools/stmt-crypto.mjs"), { webcrypto } = await import("node:crypto"), { JSDOM } = await import("jsdom");
  const ck = await C.contentKey("test-secret", U);
  const list = { at: "2026-10-10T03:59:00Z", digest: "dw1", week: { label: "5 to 11 Oct 2026", monday: "2026-10-05" }, soon: [],
    products: [{ product: "salt", unit: "unit", basis: "tier", tier: "Gold", sizes: [{ q: 1, price: 100 }, { q: 2, price: 190 }] }] };
  const prices = Object.assign({ at: list.at, week: list.week.monday, digest: list.digest }, await C.encryptWith(ck, JSON.stringify(list)));
  /* every day 09:00 to 10:00: one window is ever open, 08-12, at 09:00 to 10:00, whatever the clock */
  const narrow = week("09:00", "10:00");
  const drive = async (hours, opt = {}) => {
    const posted = [];
    const body = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-win", prices,
      env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
    const dom = new JSDOM(landingPage(U, "nwin", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      /* the page's ten-second poll, kept so a test can run it at once */
      if (opt.poll) { const si = win.setInterval.bind(win); win.setInterval = (f, ms, ...a) => { if (ms === 10000) opt.poll.fn = f; return si(f, ms, ...a); }; }
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        const reply = (status, b) => ({ ok: status === 200, status, type: "basic", json: async () => b });
        if (p === "/open") return reply(200, body);
        if (p === "/hours") { if (opt.failFirst && !opt.failed) { opt.failed = true; return reply(503, { ok: false }); } return reply(200, Object.assign({ open: true, source: "schedule", nextChange: null, nextOpen: null }, { config: hours })); }
        if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: opt.orders || [] });
        if (p === "/orders" && m === "POST") { const j = JSON.parse(init.body); posted.push(j);
          return reply(200, { ok: true, order: { id: "20261010050000-wwww", product: "salt", qty: j.qty, status: "placed", mode: j.mode, at: "2026-10-10T05:00:00Z", total: j.total, history: [], msgs: [] } }); }
        return reply(404, { ok: false });
      };
    } });
    const w = dom.window, d = w.document;
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    for (let i = 0; i < 200 && !d.getElementById("oNew"); i++) await new Promise((r) => setTimeout(r, 25));
    return { w, d, posted };
  };
  const wait = async (f) => { for (let i = 0; i < 160 && !f(); i++) await new Promise((r) => setTimeout(r, 25)); return f(); };
  const S = await drive(narrow);
  try {
    const { w, d, posted } = S;
    await wait(() => true);
    await new Promise((r) => setTimeout(r, 120));   /* the hours read, which the page makes on its own */
    d.getElementById("oNew").click();
    d.querySelector('#osheet [data-k="mode:1"]').click();
    const wins = () => [...d.querySelectorAll('#osheet [data-k^="win:"]')];
    ok(await wait(() => wins().length === 2), "a delivery's When offers As soon as it can and the one window the hours leave open: " + wins().map((b) => b.textContent).join(" | "));
    const opt = wins()[1], nx = Wn.slotNext(8, narrow, Date.now());
    ok(wins()[0].textContent === W.EN["sh.soon"] && wins()[0].getAttribute("aria-pressed") === "true" && /, 08:00 to 12:00$/.test(opt.textContent),
      "as soon as it can is chosen to start with, and the window reads its day and its four hours: " + opt.textContent);
    ok(!d.getElementById("oWant") && !d.querySelector('#osheet [data-k^="when:"]'), "a delivery is never asked for a day");
    opt.click();
    const hint = [...d.querySelectorAll("#osheet .salt-field__hint")].map((x) => x.textContent).join(" | ");
    ok(/Delivery will be between 09:00 and 10:00 on /.test(hint), "a window partly inside the hours says the part inside: " + hint);
    /* Counter Batch C, his answer 4 of 20 Oct 2026: the area lives in a spot, picked through Add a spot, so the window is chosen first and the spot after */
    d.getElementById("spAdd").click(); await new Promise((r) => setTimeout(r, 60));
    d.querySelector('#osheet [data-k="spn:0"]').click(); await new Promise((r) => setTimeout(r, 60));
    d.getElementById("oWhere").value = "Taman Contoh"; d.getElementById("oWhere").dispatchEvent(new w.Event("input", { bubbles: true }));
    d.getElementById("spUse").click(); await new Promise((r) => setTimeout(r, 60));
    d.getElementById("oGo").click();
    const check = d.getElementById("osheet").textContent;
    ok(check.includes(W.EN["sh.winRow"]) && /between 09:00 and 10:00/.test(check), "the check says the delivery time and its span: " + check.slice(0, 240));
    d.getElementById("oPlace").click();
    ok(await wait(() => posted.length === 1) && posted[0].slot === nx.slot && !("wantBy" in posted[0]),
      "Place sends the window the sheet offered, and no day: " + JSON.stringify(posted[0] && [posted[0].slot, posted[0].wantBy]));
  } finally { await new Promise((r) => setTimeout(r, 80)); S.w.close(); }

  /* 8. A SHEET OPENED WHILE THE HOURS COULD NOT BE READ is drawn again when a later read lands, so it offers only the windows
     they leave */
  const poll = {};
  const S2 = await drive(narrow, { failFirst: true, poll });
  try {
    const { d } = S2;
    d.getElementById("oNew").click();
    d.querySelector('#osheet [data-k="mode:1"]').click();
    const wins = () => [...d.querySelectorAll('#osheet [data-k^="win:"]')];
    const early = wins().length;
    if (poll.fn) poll.fn();
    ok(early === 7 && await wait(() => wins().length === 2), "a sheet opened before the hours were read offers every window, then only those the hours leave once they land: "
      + JSON.stringify([early, wins().length]));
  } finally { await new Promise((r) => setTimeout(r, 80)); S2.w.close(); }

  /* 9. AN AMENDMENT KEEPS THE ORDER'S OWN WINDOW while it is still to end, begun or not */
  const klNow = new Date(Date.now() + 8 * 3600e3), wNow = Math.floor(klNow.getUTCHours() / 4) * 4;
  const running = klNow.toISOString().slice(0, 10) + "T" + String(wNow).padStart(2, "0"), runSpan = String(wNow).padStart(2, "0") + ":00-" + String(wNow + 4).padStart(2, "0") + ":00";
  const mine = { id: "20261010050000-amnd", at: new Date(Date.now() - 600000).toISOString(), product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, mode: "deliver",
    place: "Taman Contoh", slot: running, slotSpan: runSpan, paid: 0, moved: 0, status: "placed", history: [{ at: new Date(Date.now() - 600000).toISOString(), status: "placed", by: "customer" }], msgs: [] };
  const S3 = await drive(null, { orders: [mine] });
  try {
    const { d } = S3;
    await wait(() => d.querySelector('#pOrder [data-row="' + mine.id + '"]'));
    d.querySelector('#pOrder [data-row="' + mine.id + '"]').click();
    const amendBtn = () => [...d.querySelectorAll("#pOrder button")].find((b) => b.textContent === W.EN["ord.amend"]);
    await wait(() => amendBtn());
    amendBtn().click();
    const opts = () => [...d.querySelectorAll('#osheet [data-k^="win:"]')], own = () => opts().find((b) => b.getAttribute("aria-pressed") === "true");
    ok(await wait(() => opts().length === 8) && own() && own().getAttribute("data-k") !== "win:0" && new RegExp(", " + String(wNow).padStart(2, "0") + ":00 to ").test(own().textContent),
      "amending an order whose window has begun keeps that window chosen, never silently As soon as it can: " + JSON.stringify([running, [...d.querySelectorAll('#osheet [data-k^="win:"]')].map((b) => b.getAttribute("data-k") + "=" + b.getAttribute("aria-pressed"))]));
    d.getElementById("oGo").click();
    const check = (d.getElementById("osheet") || {}).textContent || "";
    ok(check.includes(W.EN["sh.winRow"]) && new RegExp("between " + String(wNow).padStart(2, "0") + ":00 and ").test(check),
      "and the check screen says that window, as Place sends it: " + check.slice(0, 300));
  } finally { await new Promise((r) => setTimeout(r, 80)); S3.w.close(); }
}
