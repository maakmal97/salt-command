import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { landingPage } from "../stmt/page.js";

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
  const fixture = async () => {
    const posts = [], timers = [], intervals = [], pending = [];
    let now = 0, fail = false, defer = false;
    const dom = new JSDOM(cashPage(), {
      url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(w) {
        Object.defineProperty(w, "crypto", { value: webcrypto });
        w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
        w.scrollTo = () => {}; w.confirm = () => true;
        w.Date.now = () => now;
        w.setTimeout = (f, ms) => { timers.push({ f, ms, at: now + ms, off: false }); return timers.length; };
        w.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].off = true; };
        w.setInterval = (f) => { intervals.push({ f, off: false }); return intervals.length; };
        w.clearInterval = (id) => { if (intervals[id - 1]) intervals[id - 1].off = true; };
        w.fetch = async (path, init) => {
          if (init?.method === "POST") {
            posts.push({ path: String(path), body: JSON.parse(init.body), bytes: init.body, keepalive: init.keepalive });
            if (defer) await new Promise((resolve) => pending.push(resolve));
            if (fail) throw new Error("fixture lost answer");
            return Response.json({ ok: true, preapproval: { says: "Booked as it is drafted" } });
          }
          return Response.json(cashAnswer(String(path)));
        };
      }
    });
    const w = dom.window, d = w.document;
    const quiet = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
    d.querySelector('[data-m="maker"]').click(); await quiet();
    const card = () => [...d.querySelectorAll("#makerReview article")].find((n) => n.querySelector("h3")?.textContent === "cash-fixture-1");
    const button = (text) => [...card().querySelectorAll("button")].find((n) => n.textContent === text);
    const note = () => card().querySelector("[data-maker-cash-status]").textContent;
    const cash = () => [...card().querySelectorAll("label")].find((n) => n.querySelector(".lbl")?.textContent === "Cash received (RM)")?.querySelector("input");
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
    return { w, d, posts, timers, pending, card, cash, button, note, tap, advance, quiet,
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
    await retry.tap(60); await retry.advance(10000);
    ok(retry.posts.length === 3 && retry.posts[2].body.rid !== retry.posts[0].body.rid,
      "C15: only confirmed cash frees the next tap to mint a new rid");
  } finally { retry.w.close(); }
}
