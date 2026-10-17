/* test/admin-places.mjs: SALT ACCOUNT'S FIVE PLACES (11 Oct 2026, his decision; docs/STATEMENTS.md "His places").
 *
 * Needs you, Orders, Customers, Record and Shop; "Maker" is retired on screen. Every place but Needs you has a strip of parts, and
 * the page shows only the part he is in. What is proved here, each check red under its own mutation (test/admin-places.mutations.json):
 *   1  the five places, in both bars, in his words
 *   2  the strips: which parts, in which order, as the system's tabs, each with its act; none on Needs you
 *   3  the tabs follow him: the place and the part he is in are the ones marked
 *   4  what each part shows: the sections and the forms it names, and nothing of another part
 *   5  Orders by stage: a row in the stage the order stands at, a closed order a row in Closed, an empty part saying so
 *   6  the old addresses, an address opening the page, the new ones, and Back and Forward between places
 *   7  what each place and part reads when he enters it: each route once, nothing of another place
 *   8  every rule of his page in PAGE_CSS sits under .adm, so the customer's page and a guest's are drawn as they were
 * Drawn by the maker harness (test/maker-act.mjs), with a log of every read the page makes. */
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { FONT_FACE_CSS, STATEMENT_CSS, SITE_RECIPES } from "../stmt/statement-css.js";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const PLACES = ["needs", "orders", "customers", "record", "shop"];
const LABELS = ["Needs you", "Orders", "Customers", "Record", "Shop"];
const PARTS = {
  orders: [["placed", "Received"], ["confirmed", "Agreed"], ["ready", "Ready"], ["paid", "Delivered or paid"], ["done", "Completed"], ["ended", "Ended"], ["approve", "Approve"], ["payments", "Payments"], ["group", "Group"], ["ledger", "Ledger"]],
  customers: [["accounts", "Accounts"], ["messages", "Messages"], ["links", "Links"], ["associates", "Associates"]],
  record: [["entry", "Entry"], ["customers", "Customers"], ["pricing", "Pricing"]],
  shop: [["hours", "Hours"], ["notice", "Notice"], ["practice", "Practice"], ["device", "This device"]]
};
/* the sections that stand for a place or a part, and so show or do not */
const IDS = ["mHome", "oOrders", "oCustomers", "oRecord", "oShop", "makerOrderList", "makerReview", "makerClaims", "makerPools", "oAccts", "makerChatList", "oLinks",
  "oCards", "oLedger", "makerDrafts", "makerQueueReview", "makerInputs", "makerSchedule", "makerBulletin", "mTest", "oLook"];
const SHOWS = {
  needs: "mHome",
  "orders/placed": "oOrders makerOrderList makerReview", "orders/confirmed": "oOrders makerOrderList makerReview", "orders/ready": "oOrders makerOrderList makerReview",
  "orders/done": "oOrders makerOrderList makerReview", "orders/ended": "oOrders makerOrderList makerReview", "orders/payments": "oOrders makerClaims",
  "orders/group": "oOrders makerPools", "orders/approve": "oOrders makerDrafts makerQueueReview", "orders/ledger": "oOrders oLedger",
  "customers/accounts": "oCustomers oAccts", "customers/messages": "oCustomers makerChatList", "customers/links": "oCustomers oLinks",
  "customers/associates": "oCustomers oCards",
  "record/entry": "oRecord makerInputs", "record/customers": "oRecord makerInputs",
  "record/pricing": "oRecord makerInputs",
  "shop/hours": "oShop makerSchedule", "shop/notice": "oShop makerBulletin", "shop/practice": "oShop mTest", "shop/device": "oShop oLook"
};
/* the forms of Record, by the part each belongs to (the page also draws an Unsent entry for the loan this device kept) */
const FORMS = {
  entry: ["Unsent entry", "Sale or purchase", "Repayment", "Stock count", "Gift", "Loan", "Rewards", "Offsets", "Correct a row", "Reopen a cancelled order"],
  customers: ["New customer", "Make an associate", "Change a name or place", "Place on the map"],
  pricing: ["Price level", "Desk reminders", "Price drift", "Partner", "Printed sizes"]
};
/* what each entry reads, by route: the place on tapping its item, the part on tapping its tab */
const ROUTES = { review: "/all/maker/review", claims: "/all/maker/claims", pools: "/all/maker/pools", inputs: "/all/maker/inputs", offsets: "/all/maker/offsets",
  hours: "/all/maker/hours", ledger: "/all/maker/ledger", bulletin: "/all/maker/bulletin", threads: "/all/maker/threads", assoc: "/all/assoc" };
const reads = (...names) => names.map((n) => ROUTES[n]).sort();

const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };
/* the next time the window fires this event; the page listened first, so it has answered by the time this does */
const fires = (win, type) => new Promise((r) => win.addEventListener(type, r, { once: true }));

/* the page, with a log of what it reads: every fetch it makes after it has opened */
async function drawn(opts) {
  const p = await richOwnerPage(opts);
  const log = [], inner = p.w.fetch;
  p.w.fetch = async (path, init) => { log.push(((init && init.method) || "GET") + " " + String(path)); return inner(path, init); };
  await p.work.quiet(); log.length = 0;
  const gets = () => log.filter((l) => l.startsWith("GET ")).map((l) => l.slice(4)).sort();
  /* tap an item or a tab, let the page finish, and say what it read */
  /* a control that is not there is a failed check, never a crash */
  const tap = async (act) => { log.length = 0; const c = byAct(p.d, act); if (!c) return ["MISSING " + act]; c.click(); await p.work.quiet(); return gets(); };
  const where = () => {
    const place = [...p.d.querySelectorAll(".place[aria-current='page']")].map((b) => b.getAttribute("data-m"));
    const part = [...p.d.querySelectorAll(".aparts button[aria-selected='true']")].map((b) => b.parentNode.getAttribute("data-place") + "/" + b.getAttribute("data-part"));
    return [...new Set(place)].join() + (part.length ? " " + part.join() : "");
  };
  return { ...p, log, gets, tap, where, visible: () => IDS.filter((id) => shown(p.d.getElementById(id))).join(" ") };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function run({ ok, pageWork }) {
  /* the busy day, with two orders that are over: a cancelled and a declined one */
  const over = (j) => { const o = { u: "abcd-efgh", product: "salt", delivery: 0, paid: 0, msgs: [], payments: [], history: [], mode: "collect", qty: 1, total: 100 };
    j.orders.push({ ...o, id: "ord-c1", status: "cancelled" }, { ...o, id: "ord-c2", status: "declined" }); return j; };
  const p = await drawn({ pageWork, review: over });
  const { d, w } = p;
  try {
    /* 1. THE FIVE PLACES */
    const bar = (sel) => [...d.querySelectorAll(sel + " .place[data-m]")].map((b) => b.getAttribute("data-m") + ":" + b.textContent.replace(/\d+$/, "").trim());
    const want = PLACES.map((m, i) => m + ":" + LABELS[i]);
    ok(same(bar(".salt-appbar"), want) && same(bar(".salt-rail"), want),
      "Salt Account has five places, Needs you, Orders, Customers, Record and Shop, in the App bar and the Desk rail: " + JSON.stringify([bar(".salt-appbar"), bar(".salt-rail")]));
    ok(!/Maker/.test([...d.querySelectorAll(".place, #roster h1, #roster h2, #roster .eyebrow")].map((e) => e.textContent).join(" ")),
      "and none of its items, headings or eyebrows says Maker, a name that is retired on screen");

    /* 2. THE STRIPS */
    const strips = [...d.querySelectorAll(".aparts")];
    const stripsOf = (place) => strips.filter((s) => s.getAttribute("data-place") === place);
    const form = (place) => { const s = stripsOf(place); return s.length ? s.flatMap((x) => [...x.querySelectorAll("button")]).map((b) => b.getAttribute("data-part") + ":" + b.firstChild.textContent + ":" + b.getAttribute("data-act")) : null; };
    const wantParts = (place) => PARTS[place].map(([k, t]) => k + ":" + t + ":part." + place + "." + k);
    ok(strips.length === 5 && ["orders", "customers", "record", "shop"].every((m) => same(form(m), wantParts(m))),
      "Orders, Customers, Record and Shop each have their parts in order, each tab with its act: " + JSON.stringify(["orders", "customers", "record", "shop"].map(form)));
    ok(strips.every((s) => s.classList.contains("salt-tabs") && s.getAttribute("role") === "tablist" && s.getAttribute("aria-label")
      && [...s.querySelectorAll("button")].every((b) => b.classList.contains("salt-tabs__pill") && b.getAttribute("role") === "tab"))
      && !d.querySelector("#mHome .aparts"),
    "a strip is the system's tabs, a tablist of tab pills, and Needs you has none");

    /* 3. THE TABS FOLLOW HIM */
    ok(p.where() === "needs", "the page opens on Needs you: " + p.where());
    await p.tap("nav.orders");
    ok(p.where() === "orders orders/placed", "a place opens on its first part, marked in the bars and in its strip: " + p.where());
    await p.tap("part.orders.ready");
    const pills = stripsOf("orders").flatMap((x) => [...x.querySelectorAll("button")]).map((b) => b.getAttribute("aria-selected")).join();
    ok(p.where() === "orders orders/ready" && pills === "false,false,true,false,false,false,false,false,false,false", "a part he taps is the one marked, and only that one: " + p.where() + " " + pills);
    await p.tap("nav.customers"); await p.tap("nav.orders");
    ok(p.where() === "orders orders/placed", "and a place he comes back to opens on its first part again: " + p.where());
    const counts = [...d.querySelectorAll(".salt-rail [data-count]")].map((e) => e.getAttribute("data-count") + "=" + e.textContent).filter((x) => !/=$/.test(x));
    ok(counts.some((c) => c === "customers=2") && !counts.some((c) => /^shop=/.test(c)),
      "Customers carries the threads asked and the guest links waiting, and Shop has none (the counts are proved in test/admin-needs.mjs): " + JSON.stringify(counts));

    /* 4. WHAT EACH PART SHOWS */
    const seen = {};
    seen.needs = (await p.tap("nav.needs"), p.visible());
    for (const place of PLACES.slice(1)) {
      await p.tap("nav." + place);
      for (const [part] of PARTS[place]) { await p.tap("part." + place + "." + part); seen[place + "/" + part] = p.visible(); }
    }
    const wrong = Object.keys(SHOWS).filter((k) => seen[k] !== SHOWS[k]);
    ok(wrong.length === 0, "each part shows its own sections and no other, and only its own place's: " + JSON.stringify(wrong.map((k) => [k, seen[k]])));
    /* a part shows a menu of its forms by name, and a retained input above it; a form is shown when its row is tapped (test/admin-orders.mjs) */
    const formsIn = (part) => {
      const kept = [...d.querySelectorAll("#makerInputs .maker-input")].filter(shown).map((f) => (f.querySelector("h3") || {}).textContent);
      const rows = [...d.querySelectorAll('#makerMenu [data-act="record.form"]')].filter(shown).map((r) => r.querySelector(".salt-inbox-row__title").textContent);
      return kept.concat(rows);
    };
    const byPart = {};
    await p.tap("nav.record");
    for (const part of ["entry", "customers", "pricing"]) { await p.tap("part.record." + part); byPart[part] = formsIn(part); }
    const every = [...d.querySelectorAll("#makerInputs .maker-input")].length;
    ok(same(byPart, FORMS) && Object.values(byPart).flat().length === every,
      "each form of Record is named in the menu of one part, Entry, Customers or Pricing, and in no other, a retained input above it: " + JSON.stringify(byPart) + " of " + every);

    /* 5. ORDERS BY STAGE */
    await p.tap("nav.orders");
    const rows = () => [...d.querySelectorAll("#makerOrderList .ordrow")].filter(shown).map((r) => r.getAttribute("data-order")).join();
    const stage = {};
    for (const [part] of PARTS.orders) { await p.tap("part.orders." + part); stage[part] = rows(); }
    ok(stage.placed === "ord-p1,ord-p2,ord-p3,ord-p4" && stage.confirmed === "ord-a1,ord-a2" && stage.ready === "ord-r1,ord-r2,ord-r3"
      && stage.paid === "" && stage.done === "" && stage.ended === "ord-x1,ord-c1,ord-c2" && stage.payments === "" && stage.group === "",
    "an order is a row in the one stage it stands at, a declined or cancelled one in Ended, and none in two: " + JSON.stringify(stage));
    const empty = await drawn({ pageWork, review: () => ({ ok: true, orders: [], drafts: [], refused: [], queue: [] }) });
    try {
      await empty.tap("nav.orders");
      const none = {};
      for (const [part] of PARTS.orders.filter(([k]) => !["group", "payments", "ledger", "approve"].includes(k))) {
        await empty.tap("part.orders." + part);
        none[part] = [...empty.d.querySelectorAll("#makerOrderList .rnone")].filter(shown).map((e) => e.textContent).join();
      }
      await empty.tap("part.orders.approve");
      none.rows = [...empty.d.querySelectorAll("#makerDrafts .rnone")].filter(shown).map((e) => e.textContent).join();
      ok(none.placed === "No orders received." && none.confirmed === "No agreed orders." && none.ready === "No orders ready." && none.paid === "No orders delivered or paid." && none.done === "No completed orders." && none.ended === "No ended orders."
        && none.rows === "Nothing waits for your approval.",
      "a part with nothing in it says so, and a part with something says nothing: " + JSON.stringify(none));
    } finally { empty.w.close(); }

    /* 6. ADDRESSES */
    const go = async (hash) => { const e = fires(w, "hashchange"); w.location.hash = hash; await e; await p.work.quiet(); return p.where(); };
    await p.tap("nav.shop");
    const addresses = { "#maker": "orders orders/placed", "#more": "shop shop/hours", "#accounts": "customers customers/accounts",
      "#links": "customers customers/links", "#cards": "customers customers/associates", "#needs": "needs", "#orders/ready": "orders orders/ready",
      "#record/pricing": "record record/pricing", "#record/approve": "orders orders/approve", "#customers/messages": "customers customers/messages", "#orders/nowhere": "orders orders/placed" };
    const got = {};
    for (const hash of Object.keys(addresses)) got[hash] = await go(hash);
    const badAddr = Object.keys(addresses).filter((h) => got[h] !== addresses[h]);
    ok(badAddr.length === 0, "the old addresses still open where their sections went, the new ones open a place and a part, an unknown part opens the first: "
      + JSON.stringify(badAddr.map((h) => [h, got[h]])));
    await go("#shop"); const stay = await go("#nowhere");
    ok(stay === "shop shop/hours", "and an address that names no place leaves him where he is: " + stay);
    /* each event moves him on its own: the address is set without one, then the one event is fired by hand */
    w.history.replaceState(null, "", "#record/pricing"); w.dispatchEvent(new w.PopStateEvent("popstate")); await p.work.quiet(); const viaPop = p.where();
    w.history.replaceState(null, "", "#shop"); w.dispatchEvent(new w.HashChangeEvent("hashchange")); await p.work.quiet(); const viaHash = p.where();
    ok(viaPop === "record record/pricing" && viaHash === "shop shop/hours", "Back and Forward (popstate) and an address typed in (hashchange) each move him on their own: " + JSON.stringify([viaPop, viaHash]));
    const at = async (hash) => { const q = await drawn({ pageWork, hash }); try { return [q.where(), q.w.location.hash, q.gets()]; } finally { q.w.close(); } };
    const [a1, a2, a3, a4] = [await at("#maker"), await at("#record/pricing"), await at("#cards"), await at("#record/approve")];
    ok(a1[0] === "orders orders/placed" && a1[1] === "#orders" && a2[0] === "record record/pricing" && a2[1] === "#record/pricing"
      && a3[0] === "customers customers/associates" && a3[1] === "#customers/associates" && a4[0] === "orders orders/approve" && a4[1] === "#orders/approve",
    "a page opened on an address is on the place and part it names, and its address is the new one; the old #record/approve is Orders > Approve: " + JSON.stringify([a1, a2, a3, a4]));

    /* BACK AND FORWARD */
    const q = await drawn({ pageWork });
    try {
      const step = async (act) => { const c = byAct(q.d, act); if (c) c.click(); await q.work.quiet(); return q.w.location.hash; };
      const trail = [await step("nav.orders"), await step("part.orders.group"), await step("nav.shop")];
      /* the window leaves the address when it has gone, or never if there was nowhere to go: a bounded poll, then what stands */
      const travel = async (dir) => { const from = q.w.location.href; q.w.history[dir](); for (let i = 0; i < 300 && q.w.location.href === from; i++) await new Promise((r) => setTimeout(r, 10)); await q.work.quiet(); return q.where() + " " + q.w.location.hash; };
      const back1 = await travel("back"), back2 = await travel("back"), back3 = await travel("back"), fwd = await travel("forward");
      ok(same(trail, ["#orders", "#orders/group", "#shop"]) && back1 === "orders orders/group #orders/group" && back2 === "orders orders/placed #orders"
        && back3 === "needs " && fwd === "orders orders/placed #orders",
      "a tap writes the place's address, and Back and Forward move between places: " + JSON.stringify([trail, back1, back2, back3, fwd]));
    } finally { q.w.close(); }

    /* 7. WHAT IT READS */
    const r = await drawn({ pageWork });
    try {
      const entry = [];
      const step = async (act, want) => { const got = await r.tap(act); entry.push([act, got, want]); return got; };
      await step("nav.needs", reads());
      await step("nav.shop", reads("hours"));
      await step("part.shop.notice", reads("bulletin"));
      await step("part.shop.practice", reads());
      await step("part.shop.device", reads());
      await step("part.shop.hours", reads("hours"));
      await step("nav.orders", reads("review", "claims"));
      for (const part of ["confirmed", "ready", "done", "ended", "payments", "placed"]) await step("part.orders." + part, reads());
      await step("part.orders.group", reads("pools"));
      await step("nav.orders", reads("review", "claims", "pools"));
      await step("part.orders.ledger", reads("ledger"));
      await step("nav.customers", reads());
      await step("part.customers.messages", reads("threads"));
      await step("part.customers.links", reads());
      await step("part.customers.associates", reads("assoc"));
      await step("part.customers.accounts", reads());
      await step("part.customers.associates", reads());
      await step("nav.record", reads("inputs", "offsets"));
      for (const part of ["entry", "customers", "pricing"]) await step("part.record." + part, reads());
      await step("nav.orders", reads("review", "claims"));
      await step("part.orders.approve", reads("review"));
      const off = entry.filter(([, got, want]) => !same(got, want));
      ok(off.length === 0, "each place reads what it shows when he enters it, each part what it shows, each route once and nothing of another place: "
        + JSON.stringify(off.map(([act, got, want]) => [act, got, want])));
      const first = await drawn({ pageWork });
      try {
        await first.tap("nav.shop");
        const none = ["review", "claims", "inputs", "offsets", "threads", "pools", "bulletin", "assoc"].map((n) => ROUTES[n]);
        ok(!first.log.some((l) => none.some((n) => l.endsWith(n))), "entering Shop reads no order, no form and no thread: " + JSON.stringify(first.log));
        first.log.length = 0; await first.tap("nav.orders");
        ok(!first.log.some((l) => [ROUTES.inputs, ROUTES.offsets, ROUTES.hours, ROUTES.bulletin, ROUTES.threads, ROUTES.pools].some((n) => l.endsWith(n))),
          "and entering Orders reads no form, no hours, no notice and no thread: " + JSON.stringify(first.log));
      } finally { first.w.close(); }
    } finally { r.w.close(); }

    /* 8. HIS RULES SIT UNDER .adm */
    const html = (o) => landingPage("", "places-nonce", o), ownerHtml = html({ master: "fixture-master", accounts: [] }), customerHtml = html(undefined);
    const style = (h) => (h.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1];
    const body = (h) => h.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
    const css = style(ownerHtml).slice((FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES).length);
    const sheet = new JSDOM("<style>" + css + "</style>").window.document.styleSheets[0];
    const rules = [];
    const walk = (list) => { for (const rule of list) { if (rule.selectorText) rules.push(rule.selectorText); else if (rule.cssRules) walk(rule.cssRules); } };
    walk(sheet.cssRules);
    const tokens = (sel) => [...sel.matchAll(/[#.]([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
    const inPage = (h, name) => new RegExp("(^|[^\\w-])" + name.replace(/-/g, "[-]") + "($|[^\\w-])").test(h);
    const ownerOnly = (name) => inPage(body(ownerHtml), name) && !inPage(body(customerHtml), name);
    const split = (sel) => { const out = []; let depth = 0, from = 0; for (let i = 0; i < sel.length; i++) { const c = sel[i]; if (c === "(") depth++; else if (c === ")") depth--; else if (c === "," && !depth) { out.push(sel.slice(from, i).trim()); from = i + 1; } } out.push(sel.slice(from).trim()); return out; };
    /* the view-as-them bar and the ended screen stand outside #roster, so .adm cannot reach them; .quote is a rule neither page draws */
    const OUTSIDE = ["vbar", "quote", "ended", "aEnded"];
    const his = rules.flatMap(split).filter((sel) => tokens(sel).some((t) => t !== "adm" && !OUTSIDE.includes(t) && ownerOnly(t)));
    const loose = his.filter((sel) => !/^[.]adm[\s.#:\[>+~]|^[.]adm$/.test(sel));
    ok(rules.length > 100 && his.length > 40 && loose.length === 0 && /\bclass="[^"]*\badm\b/.test(body(ownerHtml)),
      "every rule of PAGE_CSS that styles something only his page draws sits under .adm, so the customer's page and a guest's are drawn as they were ("
        + his.length + " of " + rules.length + " rules)" + (loose.length ? ", and these do not: " + JSON.stringify(loose) : ""));
    /* and the other way (Phase 1b, the reviewer's instrument): a rule under .adm that names nothing only his page draws is a shared rule moved under it, and the
       customer's page and a guest's would lose it. Every rule under .adm carries a class or an id that his page draws and the customer's page and its script do not. */
    const under = rules.flatMap(split).filter((sel) => /^[.]adm([\s.#:\[>+~]|$)/.test(sel));
    const moved = under.filter((sel) => !tokens(sel).some((t) => t !== "adm" && ownerOnly(t)));
    ok(under.length > 60 && moved.length === 0,
      "every rule under .adm names a class or an id only his page draws, so none is a shared rule moved under it (" + under.length + " rules)"
        + (moved.length ? ", and these name none: " + JSON.stringify(moved) : ""));
  } finally { w.close(); }
}
