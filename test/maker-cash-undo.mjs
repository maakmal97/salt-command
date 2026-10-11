import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { landingPage } from "../stmt/page.js";
import { byAct, cardOf } from "./maker-act.mjs";

export const cashReview = { ok: true, drafts: [], orders: [
  { id: "cash-fixture-1", u: "abcd-efgh", product: "salt", qty: 1, total: 100, paid: 0,
    delivery: 0, status: "ready", mode: "collect", history: [], payments: [], msgs: [] }
] };
export const cashPage = () => landingPage("", "fixture", { master: "local-master", accounts: [] });
export function cashAnswer(path) {
  if (path === "/all/maker/review") return structuredClone(cashReview);
  if (path === "/all/maker/inputs") return { ok: true, products: [], catalog: { parties: [], rows: [], loans: [], rewards: [] } };
  return { ok: true, accounts: [], claims: [], threads: [], bulletin: { lines: [] }, config: null, status: {} };
}
export async function run({ ok }) {
  const fixture = async ({ storage = [], backend = { paid: 0, receipts: new Set(), failRead: false } } = {}) => {
    const posts = [], timers = [], intervals = [], pending = [];
    let now = 0, fail = false, defer = false;
    const dom = new JSDOM(cashPage(), {
      url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(w) {
        for (const [key, value] of storage) w.localStorage.setItem(key, value);
        Object.defineProperty(w, "crypto", { value: webcrypto });
        w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
        w.scrollTo = () => {};
        w.Date.now = () => now;
        w.setTimeout = (f, ms) => { timers.push({ f, ms, at: now + ms, off: false }); return timers.length; };
        w.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].off = true; };
        w.setInterval = (f) => { intervals.push({ f, off: false }); return intervals.length; };
        w.clearInterval = (id) => { if (intervals[id - 1]) intervals[id - 1].off = true; };
        w.fetch = async (path, init) => {
          if (init?.method === "POST") {
            posts.push({ path: String(path), body: JSON.parse(init.body), bytes: init.body, keepalive: init.keepalive });
            if (defer) await new Promise((resolve) => pending.push(resolve));
            const body = posts.at(-1).body;
            if (!backend.receipts.has(body.rid)) { backend.receipts.add(body.rid); backend.paid += body.amount; }
            if (fail) throw new Error("fixture lost answer");
            return Response.json({ ok: true, preapproval: { says: "Booked as it is drafted" } });
          }
          if (String(path) === "/all/maker/review") {
            if (backend.failRead) throw new Error("fixture failed review read");
            const answer = cashAnswer(String(path)); answer.orders[0].paid = backend.paid;
            return Response.json(answer);
          }
          return Response.json(cashAnswer(String(path)));
        };
      }
    });
    const w = dom.window, d = w.document;
    const quiet = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
    byAct(d, "nav.orders").click(); await quiet();
    const card = () => cardOf(d, "cash-fixture-1");
    /* 11 Oct 2026: Record cash, Undo and the cash field are found by what they do (test/maker-act.mjs), so a change of their words leaves
       this test where it was; Retry cash and Refresh cash are one control whose words are the behaviour under test, and keep theirs */
    const ACTS = { "Record cash": "order.cash", Undo: "order.cash-undo" };
    const button = (text) => ACTS[text] ? (card(), byAct(d, ACTS[text], "cash-fixture-1")) : [...(card()?.querySelectorAll("button") || [])].find((n) => n.textContent === text);
    const note = () => card()?.querySelector("[data-maker-cash-status]")?.textContent || "";
    const cash = () => (card(), byAct(d, "order.cash-amount", "cash-fixture-1"));
    const tap = async (amount) => {
      const input = cash(), record = button("Record cash");
      if (!input || !record) return;
      input.value = String(amount); record.click(); await quiet();
    };
    const advance = async (ms) => {
      now += ms;
      for (const timer of timers) if (!timer.off && timer.at <= now) { timer.off = true; timer.f(); }
      for (const interval of intervals) if (!interval.off) interval.f();
      await quiet();
    };
    const stored = () => Object.keys(w.localStorage).map((key) => [key, w.localStorage.getItem(key)]);
    return { w, d, posts, timers, pending, backend, stored, card, cash, button, note, tap, advance, quiet,
      failure: (v) => { fail = v; }, defer: (v) => { defer = v; } };
  };
  const f = await fixture();
  try {
    await f.tap(100);
    const heldTimer = f.timers.find((t) => t.ms === 10000);
    ok(!!heldTimer, "C1: the Counter cash window is ten seconds");
    await f.advance(9999);
    ok(f.posts.length === 0 && !!f.button("Undo"), "C2: a cash tap posts nothing before ten seconds");
    ok(f.button("Undo")?.classList.contains("salt-pill") && !f.button("Record cash")
      && f.note() === "Cash received, RM 100.00: it goes in 1 s. Undo sends nothing.",
      "C3: the card replaces Record cash with Undo and says the held amount and countdown");
    f.button("Undo")?.click(); await f.quiet();
    const cancelled = heldTimer?.off;
    f.d.dispatchEvent(new f.w.Event("visibilitychange")); f.w.dispatchEvent(new f.w.Event("pagehide"));
    await f.advance(1);
    ok(f.posts.length === 0 && cancelled && f.button("Record cash")
      && f.note() === "Undone: nothing was sent, and the order is as it was.",
      "C4: Undo cancels the timer, sends nothing later, says so and restores Record cash");
    await f.tap(40);
    ok(f.posts.length === 0 && f.button("Undo") && f.note().includes("RM 40"),
      "C5: a custom cash figure is held too");
    const field = f.cash(); if (field) field.value = "70";
    await f.advance(10000);
    ok(f.posts.length === 1 && f.posts[0].path === "/all/maker/orders/cash-fixture-1/cash"
      && f.posts[0].body.amount === 40 && f.posts[0].keepalive === true,
      "C6: expiry posts once with the tapped figure and keepalive");
    ok(f.note().startsWith("Recorded: RM 40.00 in cash."),
      "C7: the card says what cash was recorded after expiry");
    const timerCount = f.timers.length;
    await f.tap(0);
    ok(f.timers.length === timerCount && f.posts.length === 1 && f.note().startsWith("That is not a figure above RM 0"),
      "C8: an invalid amount is refused immediately, never held or posted");
    let refused = true;
    for (const invalid of ["0.001", "-1", "101", ""]) {
      await f.tap(invalid);
      refused &&= f.timers.length === timerCount && f.posts.length === 1 && !!f.button("Record cash")
        && f.note().startsWith("That is not a figure above RM 0");
    }
    ok(refused, "C16: zero, sub-sen, negative and over-owed cash never enter a hold");
  } finally { f.w.close(); }

  for (const [event, code] of [["visibilitychange", 9], ["pagehide", 11]]) {
    const f = await fixture();
    try {
      await f.tap(100);
      ok(f.posts.length === 0 && f.button("Undo"), "C" + code + ": " + event + " leaves cash held before the page event");
      Object.defineProperty(f.d, "visibilityState", { value: "hidden", configurable: true });
      if (event === "visibilitychange") f.d.dispatchEvent(new f.w.Event(event));
      else f.w.dispatchEvent(new f.w.Event(event));
      await f.quiet();
      const flushed = f.posts.length;
      f.w.dispatchEvent(new f.w.Event("pagehide")); f.d.dispatchEvent(new f.w.Event("visibilitychange"));
      await f.advance(10000);
      ok(flushed === 1 && f.posts.length === 1 && f.posts[0].path === "/all/maker/orders/cash-fixture-1/cash"
        && f.posts[0].body.amount === 100 && f.posts[0].keepalive === true,
        "C" + (code + 1) + ": " + event + " flushes once with the held figure and keepalive, never again on expiry");
    } finally { f.w.close(); }
  }
  const retry = await fixture();
  try {
    retry.failure(true); await retry.tap(60); await retry.advance(10000);
    ok(retry.posts.length === 1 && retry.button("Retry cash") && !retry.button("Undo")
      && !retry.button("Record cash") && retry.note().startsWith("Confirmation not received."),
      "C13: after a lost answer cash has Retry, never Undo or a new editable cash tap");
    retry.failure(false); retry.defer(true);
    retry.button("Retry cash")?.click(); await retry.quiet();
    const retryButton = retry.button("Retry cash"); retryButton?.click();
    retry.w.dispatchEvent(new retry.w.Event("pagehide")); await retry.advance(10000);
    ok(retry.posts.length === 2 && retry.posts[0].bytes === retry.posts[1].bytes
      && /^[0-9a-f]{32}$/.test(retry.posts[0].body.rid) && retryButton?.disabled,
      "C14: a retry keeps immutable amount and rid, with no duplicate while in flight or on leave");
    retry.defer(false); retry.pending.shift()?.(); await retry.quiet();
    await retry.tap(40); await retry.advance(10000);
    ok(retry.posts.length === 3 && retry.posts[2].body.rid !== retry.posts[0].body.rid,
      "C15: only confirmed cash frees the next tap to mint a new rid");
  } finally { retry.w.close(); }

  const refresh = await fixture();
  try {
    const staleRecord = refresh.button("Record cash");
    refresh.backend.failRead = true; await refresh.tap(40); await refresh.advance(10000);
    const kept = refresh.stored();
    staleRecord.click(); await refresh.advance(10000);
    ok(refresh.posts.length === 1 && !refresh.button("Record cash") && !refresh.button("Retry cash")
      && refresh.button("Refresh cash") && refresh.note() === "Recorded, refresh pending."
      && JSON.stringify(refresh.stored()) === JSON.stringify(kept),
      "C17: confirmed partial cash stays gated through a failed review; a stale second tap sends no new rid");
    refresh.backend.failRead = false; refresh.button("Refresh cash")?.click(); await refresh.quiet();
    const restored = !!refresh.button("Record cash") && !refresh.button("Refresh cash")
      && refresh.note().includes("RM 60.00 still owed.") && refresh.stored().length === 0;
    await refresh.tap(61);
    const refused = refresh.posts.length === 1 && refresh.note().includes("RM 60.00 owed");
    await refresh.tap(60); await refresh.advance(10000);
    ok(restored && refused && refresh.posts.length === 2 && refresh.posts[1].body.amount === 60
      && refresh.posts[1].body.rid !== refresh.posts[0].body.rid && refresh.backend.paid === 100,
      "C18: only a fresh incorporated review restores cash at the correct RM 60 remaining");
  } finally { refresh.w.close(); }

  const lost = await fixture();
  let reopened, confirmed;
  try {
    lost.failure(true); await lost.tap(40); await lost.advance(10000);
    const original = lost.posts[0].bytes, storage = lost.stored();
    lost.w.close();
    reopened = await fixture({ storage, backend: lost.backend });
    const retained = !!reopened.button("Retry cash") && !reopened.button("Undo") && !reopened.button("Record cash");
    reopened.backend.failRead = true;
    reopened.button("Retry cash")?.click(); await reopened.quiet();
    ok(retained && reopened.posts.length === 1 && reopened.posts[0].bytes === original
      && reopened.backend.paid === 40 && reopened.button("Refresh cash") && !reopened.button("Retry cash"),
      "C19: reload after an uncertain POST recovers exact bytes/rid, has no Undo, and replays cash once");
    const confirmedStorage = reopened.stored(); reopened.w.close();
    confirmed = await fixture({ storage: confirmedStorage, backend: lost.backend });
    const gated = !!confirmed.button("Refresh cash") && !confirmed.button("Retry cash") && !confirmed.button("Undo")
      && !confirmed.button("Record cash") && confirmed.note() === "Recorded, refresh pending." && confirmed.posts.length === 0;
    confirmed.backend.failRead = false; confirmed.button("Refresh cash")?.click(); await confirmed.quiet();
    ok(gated && confirmed.posts.length === 0 && confirmed.button("Record cash") && confirmed.stored().length === 0
      && confirmed.note().includes("RM 60.00 still owed."),
      "C20: confirmed receipt survives reload/failed reads; Refresh never reposts, and incorporated review releases it");
  } finally { lost.w.close(); reopened?.w.close(); confirmed?.w.close(); }
  const storageFailure = await fixture(), prototype = storageFailure.w.Storage.prototype;
  const set = prototype.setItem;
  try {
    prototype.setItem = function () { throw new Error("fixture device quota refused"); };
    await storageFailure.tap(40); await storageFailure.advance(10000);
    ok(storageFailure.posts.length === 0 && storageFailure.button("Retry cash") && !storageFailure.button("Record cash")
      && storageFailure.note().includes("fixture device quota refused"),
      "C21: a device retention failure refuses transport explicitly, never an unretained cash POST");
  } finally { prototype.setItem = set; storageFailure.w.close(); }
}
