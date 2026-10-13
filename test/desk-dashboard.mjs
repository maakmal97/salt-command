import { openMaster } from "../tools/payload.mjs";

/* B5 of #62: the Desk is a dashboard. Every part is drawn with a fixture of everything that used to carry a control, every
   control on the page is pressed, and nothing may leave the page but the writes the Desk keeps: the restock date, the pin
   filing through the vault, an alert, the waiting stamp and the previews that store nothing. The recovery panel's Send is the
   only road to /queue. */
export async function run({ ok }) {
  const swallow = () => { };
  process.on("unhandledRejection", swallow);
  const { w } = await openMaster();
  try {
    w.SALT_CLOUD = true;
    w.Element.prototype.scrollIntoView = () => { }; w.open = () => null; w.confirm = () => true; w.alert = () => { }; w.prompt = () => "";
    w.localStorage.setItem("saltWriteKey", "invented-dashboard-key-32-characters");
    const posts = [];
    const NOW = "2026-10-12T02:00:00.000Z";
    const base = { u: "abcd-efgh", code: "CC9-OKR", product: "salt", qty: 2, total: 200, delivery: 0, paid: 0, moved: 0, mode: "collect", history: [], msgs: [], payments: [] };
    const o = (x) => Object.assign({}, base, x);
    const orders = [
      o({ id: "n1", status: "placed", at: NOW }),
      o({ id: "n2", status: "placed", mode: "deliver", place: "Taman Rekaan", at: NOW }),
      o({ id: "a1", status: "acknowledged", at: NOW, paid: 50, moved: 1, msgs: [{ at: NOW, by: "customer", text: "can I collect after six" }], again: ["pay", "ack"] }),
      o({ id: "r1", status: "ready", at: NOW, moved: 2, delivery: 10, mode: "deliver" }),
      o({ id: "c1", status: "acknowledged", at: NOW, payments: [{ at: NOW, amount: 50, method: "transfer", claim: "waiting" }] }),
      o({ id: "p1", status: "placed", at: NOW, price: { state: "asked", proposed: 180 }, msgs: [{ at: NOW, by: "customer", text: "can it be 180" }] }),
      o({ id: "p2", status: "placed", at: NOW, price: { state: "offered", from: "accept", offer: { total: 210, until: "2099-01-01T00:00:00.000Z" } }, msgs: [{ at: NOW, by: "customer", text: "ok" }] }),
      o({ id: "d1", status: "done", at: NOW, paid: 200, moved: 2 }),
      o({ id: "x1", status: "declined", at: NOW }),
    ];
    const drafts = [
      { id: "d-1", status: "pending", collection: "sales", row: { customer: "CC9-OKR", qty: 2, total: 200, date: "2026-10-01", product: "salt" }, entry: { orderId: "n1", status: "Pending" }, flags: ["a flag"] },
      { id: "d-2", status: "pending", collection: "sales", row: { customer: "CC9-OKR", qty: 2, total: 200, date: "2026-10-01", product: "salt" }, entry: { orderId: "c1", status: "Payment", claim: true } },
    ];
    const refused = [{ id: "2026-10-01T00:00:00.000Z", why: "Invented refusal.", entry: { raw: "Invented entry" } }, { id: "fold:1", why: "A notice.", seenAt: NOW }];
    const answer = (body, status = 200) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
    w.fetch = async (path, options = {}) => {
      path = String(path); const method = (options.method || "GET").toUpperCase();
      if (method !== "GET") { posts.push({ path, method, body: options.body || "", in: ctl.where }); return answer({ ok: true, revision: 1, entries: 1, droppedAts: [], sent: 0 }); }
      if (path.startsWith("drafts")) return answer({ ok: true, drafts, refused, clock: null });
      if (path.startsWith("orders")) return answer({ ok: true, orders, claims: [{ kind: "account", id: "k1", u: "abcd-efgh", code: "CC9-OKR", amount: 100, state: "waiting", at: NOW }], threads: [{ u: "abcd-efgh", code: "CC9-OKR", msgs: [{ by: "customer", at: NOW, text: "hello" }] }], links: 0 });
      if (path === "expected") return answer({ ok: true, expected: {} });
      if (path === "bulletin") return answer({ ok: true, lines: ["A notice"] });
      if (path === "hush") return answer({ ok: true, hush: {} });
      if (path === "push/key") return answer({ key: "" });
      return answer({ ok: false }, 404);
    };
    const ctl = { where: "" };
    const settle = () => new Promise((r) => setTimeout(r, 40));
    /* one entry this device holds and the Worker has not confirmed: the recovery panel offers it Send and Discard */
    w.eval("qSyncState='server';qReceipts=new Set();qSentThrough=qSentAtLoad='2000-01-01T00:00:00.000Z';queue=" + JSON.stringify([
      { at: "2099-01-01T00:00:01.000Z", type: "LOSS", party: null, qty: 2, total: null, status: "unpaid", raw: "Self-use 2 units", payload: { mode: "loss", date: "2026-10-01", product: "salt", kg: 2, why: "other", note: "" } }])
      + ";applyOverlay();localStorage.setItem('saltQueue',JSON.stringify(queue));");

    /* ---- draw every part, with the fixture, and press every control that is not the recovery panel's ---- */
    const D = w.document;
    const views = JSON.parse(w.eval("JSON.stringify(VIEWS.map(function(v){return [v.id,[v.lead].concat(v.parts)];}))"));
    const seen = []; const handlers = []; let pressed = 0;
    const sources = (el) => (el.getAttribute("onclick") || "") + " " + (typeof el.onclick === "function" ? el.onclick.name : "");
    for (const [, parts] of views) {
      for (const part of parts) {
        w.eval("switchTab(" + JSON.stringify(part) + ")");
        await settle(); await settle();
        if (part === "orders") { w.eval("expDraw();ordDraw();"); }
        const scope = D.body;
        const controls = [...scope.querySelectorAll("button, a[onclick], [onclick], summary")].filter((e) => !e.closest("#queueBox") && !e.closest(".rail") && !e.closest("#tabs") && !e.closest(".vnav"));
        for (const e of controls) {
          seen.push((e.textContent || "").trim().slice(0, 40));
          handlers.push(sources(e));
        }
        for (const e of controls) {
          if (e.disabled || !e.isConnected) continue;
          ctl.where = part; pressed++;
          try { e.click(); } catch (err) { /* a handler that throws is not a post */ }
        }
        await settle();
      }
    }
    await settle();
    const forbidden = /^(drafts\/|orders\/[^/]+\/(accept|handed|cash|received|notfound|again|offer|withdraw|restate|amend)|orders\/(?!waiting$)[^/]+$|claims\/[^/]+\/(received|notfound)|threads|bulletin|hush|bio|queue|inputs|draft-now)/;
    const allowed = /^(expected|orders\/waiting|orders\/[^/]+\/preview|claims\/[^/]+\/preview|geo\/expand|push\/(subscribe|unsubscribe|send)|vault(\/.*)?)$/;
    const stray = posts.filter((p) => forbidden.test(p.path) || !allowed.test(p.path));
    ok(pressed > 20 && posts.every((p) => allowed.test(p.path)) && !stray.length,
      "pressing every control on every part posts only what the Desk keeps (" + pressed + " pressed): " + (JSON.stringify(stray.slice(0, 4)) || "none"));
    ok(JSON.parse(w.eval("JSON.stringify(queue.map(function(q){return q.at;}))")).join() === "2099-01-01T00:00:01.000Z"
      && JSON.parse(w.localStorage.getItem("saltQueue") || "[]").length === 1,
      "and no control adds to, removes from or rewrites the queue this device holds");
    const deny = /(fetch\(|sendBeacon|XMLHttpRequest|apDecide|apWithdraw|ordAct|ordSheetAct|bullPost|obsAct|hushPost|wbRecord|undoEntry|undoLast|bioSave|addParty|mapPlaceFromVault|tierSet|tierAcceptAll|driftSet|driftClear|partnerMake|redeemRebate|shQueueHouse|edSubmit|updQueue|ledNew|ledMenu|ledEdit|qFlush)/;
    ok(!handlers.some((s) => deny.test(s)),
      "no control on any part names a handler of the retired writes, or posts from its own markup: " + (handlers.find((s) => deny.test(s)) || "none"));
    const dead = ["#orderbtn", "#wbRec", "#apAdd", "#vsave", "#edSave", "#updGo", "#bullSet", "#bullClear", "button[data-ord]", "button[data-ap]", "button[data-wd]", "input[data-say]"].filter((s) => D.querySelector(s));
    ok(!dead.length, "and none of the retired controls is in the page: " + (dead.join(", ") || "none"));

    /* ---- the writes the Desk keeps still work ---- */
    posts.length = 0;
    w.eval("switchTab('orders')"); await settle(); await settle();
    w.eval("expDraw()");
    const inp = D.getElementById("exp_salt");
    if (inp) inp.value = "2099-12-31";
    ctl.where = "expected";
    const set = D.querySelector('button[data-expset="salt"]');
    if (set) set.click();
    await settle();
    ok(!!set && posts.some((p) => p.path === "expected" && JSON.parse(p.body).product === "salt" && JSON.parse(p.body).on === "2099-12-31"),
      "the restock date's Set still posts the day to /expected: " + JSON.stringify(posts.map((p) => p.path)));
    posts.length = 0;
    w.eval("ORD_TOLD=null;ORD_READ=true;AP_READ=true;ORD_AT=Date.now();AP_AT=Date.now();ordUnread='';apUnread='';ordNeedKey=false;apNeedKey=false;");
    await w.eval("ordTell()");
    ok(posts.some((p) => p.path === "orders/waiting" && JSON.parse(p.body).n >= 0),
      "the waiting stamp still goes to the site on a load: " + JSON.stringify(posts.map((p) => p.path)));
    posts.length = 0;
    w.eval("ORD_PV={};ORD_OPEN=" + JSON.stringify([orders[0]]) + ";ORD_SEL='n1';");
    await w.eval("ordPreview(ORD_OPEN[0])");
    ok(posts.some((p) => /^orders\/n1\/preview$/.test(p.path)),
      "an order's preview, which stores nothing, is still drawn: " + JSON.stringify(posts.map((p) => p.path)));

    /* ---- the recovery panel is the one road to /queue ---- */
    posts.length = 0;
    w.eval("switchTab('add')"); await settle(); await settle();
    w.eval("qSyncState='server';qRecBusy=false;qReceipts=new Set();qRecMsg='';renderQueue()");
    const send = D.querySelector("#qRecovery button[onclick^=\"qRecSend\"]");
    ctl.where = "recovery";
    if (send) send.click();
    await settle(); await settle();
    ok(!!send && posts.some((p) => p.path === "queue" && p.in === "recovery"),
      "the recovery panel's Send still posts the entry it holds to /queue: " + JSON.stringify(posts.map((p) => p.path)));
    ok(w.eval("OVERLAY_UNSENT") === false,
      "unsent entries are switched out of every figure");
  } finally {
    process.off("unhandledRejection", swallow);
    w.close();
  }
}
