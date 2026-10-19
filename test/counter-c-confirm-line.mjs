/* test/counter-c-confirm-line.mjs: THE CONFIRM LINE ON A PLACED ORDER (Counter Batch C, P4, item 19; his answers of 18 and 20 Oct 2026).
 *
 * A placed order waiting on his Accept reads, off GET /hours: open with ten to thirty measured, "Usually confirmed within {d}" and
 * "Measured from our last {n} orders, not a promise."; closed, "We confirm when the Counter opens" and when it opens, no figure; under
 * ten, the hours not read, or an ask on it, today's line. Every check observes the order's own screen in jsdom (test/counter-b-kit.mjs,
 * /hours stubbed); each was proved red by its own mutation (test/counter-c-confirm-line.mutations.json, tools/section.mjs).
 *   1  open with 30 measured: the figure and the count
 *   2  the figure in words: 75 minutes is 1 hour 15 minutes, 60 is 1 hour, 150 is 2 hours 30 minutes
 *   3  open with 9: today's line, no figure
 *   4  closed: the opening line with its time and day, no figure
 *   5  the hours not read: today's line
 *   6  a confirmed order draws none of them, and a placed order with an ask on it keeps today's line */
import { open, ord, ago, txt, until } from "./counter-b-kit.mjs";

const PLACED = "Waiting for us to confirm. You will see it change here.";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  /* the order's own screen, its when line */
  const when = async (p, id) => {
    p.d.querySelector('button[data-t="order"]').click(); await p.settle();
    const row = () => p.d.querySelector('#pOrder [data-row="' + id + '"]');
    if (!row()) { const later = p.d.querySelector("#pOrder .olater"); if (later) later.click(); await until(row, 60); }
    if (!row()) return null;
    row().click(); await until(() => p.d.querySelector('#pOrder .oscreen[data-order="' + id + '"]'), 60);
    return txt(p.d.querySelector('#pOrder .oscreen[data-order="' + id + '"] [data-part="when"]'));
  };
  const opened = (confirm) => ({ ok: true, open: true, source: "schedule", nextChange: new Date(Date.now() + 3 * 3600e3).toISOString(), nextOpen: null,
    config: { schedule: null, manual: null }, ...(confirm ? { confirm } : {}) });
  const P1 = ord("cl1", "placed", ago(1)), K1 = ord("ck1", "acknowledged", ago(2));
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [P1, K1], hours: opened({ mins: 45, n: 30 }) });
    const a = await when(A, "cl1");
    ok(a === "Usually confirmed within 45 minutes. Measured from our last 30 orders, not a promise.", "open with 30 measured, the figure and the count: " + a);
    /* ---- 2 ---- */
    const ds = [];
    for (const m of [75, 60, 150]) { const B = await page({ orders: [P1], hours: opened({ mins: m, n: 12 }) }); ds.push(await when(B, "cl1")); }
    ok(ds.join("|") === ["1 hour 15 minutes", "1 hour", "2 hours 30 minutes"].map((d) => "Usually confirmed within " + d + ". Measured from our last 12 orders, not a promise.").join("|"),
      "the figure in words, hours and minutes: " + ds.join(" | "));
    /* ---- 3 ---- */
    const C = await page({ orders: [P1], hours: opened({ mins: 45, n: 9 }) });
    const c = await when(C, "cl1");
    ok(c === PLACED, "under ten measured, today's line: " + c);
    /* ---- 4 ---- */
    const at = "2026-10-21T01:00:00.000Z";   /* 09:00 on 21 Oct 2026 in Kuala Lumpur */
    const D = await page({ orders: [P1], hours: { ok: true, open: false, source: "schedule", nextChange: at, nextOpen: at, config: { schedule: null, manual: null }, confirm: { mins: 45, n: 30 } } });
    const dd = await when(D, "cl1");
    ok(dd === "We confirm when the Counter opens. Opens at 09:00, 21 Oct 2026.", "closed, the opening and no figure: " + dd);
    /* ---- 5 ---- */
    const E = await page({ orders: [P1] });
    const e = await when(E, "cl1");
    ok(e === PLACED, "the hours not read, today's line: " + e);
    /* ---- 6 ---- */
    const k = await when(A, "ck1");
    const asked = ord("ca1", "placed", ago(1), { price: { state: "asked" } });
    const F = await page({ orders: [asked], hours: opened({ mins: 45, n: 30 }) });
    const f = await when(F, "ca1");
    ok(k !== null && !/confirmed within|Measured from|Counter opens/.test(k) && f !== null && !/confirmed within/.test(f),
      "a confirmed order draws none of it, and an ask keeps today's: " + JSON.stringify([k, f]));
  } finally { for (const p of pages) p.close(); }
}
