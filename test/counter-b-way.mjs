/* test/counter-b-way.mjs: THE WAY ON PRICES (Counter Batch B, P1, item 11; his answers 10 and 11 of 18 Oct 2026).
 *
 * Under the Order stamp (Prices until plan version 8) one line says how the next order reaches them, "Delivering to {place}" or "Collecting", read by wayNow(), the
 * same read the order sheet opens on, with Change opening the sheet at How it reaches you. Every assertion observes the signed-in page in
 * jsdom (test/counter-b-kit.mjs); each was proved red by its own mutation (test/counter-b-way.mutations.json, tools/section.mjs).
 *   1  11 NOV 2026, HIS ANSWER "Always ask": no order sets it any more; with none chosen on this page there is no line, a way chosen on Home reads on it
 *   2  a way chosen in a sheet and closed shows, as the next sheet will open on it
 *   3  a place shows as text, never markup
 *   4  Change opens the sheet with focus on the way chosen
 *   5  no line before a way is chosen, with or without an order; nothing at all while prices are hidden (the gate's Change check is retired: a way cannot be chosen under the gate) */
import { open, ord, txt, ago, addSpot, basketAdd, toSheet, SHAPE } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const line = (p) => { const w = p.d.getElementById("pWay"); return w && !w.hidden ? txt(w.querySelector(".pway__t")) : null; };
  const tile = async (p, way) => { const t = p.d.querySelector('[data-start="' + way + '"]'); t.click(); await p.settle(); const c = p.d.querySelector('#osheet [data-k="close"]'); if (c) { c.click(); await p.settle(); } };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [ord("o1", "done", ago(300)), ord("o2", "done", ago(200), { mode: "deliver", place: "Veloria" })] });
    const none = line(A);
    await tile(A, "collect");
    const coll = line(A);
    ok(none === null && coll === "Collecting" && !!A.d.querySelector("#pPrices > #pWay"),
      "no order sets the way: a newest delivery leaves no line until one is chosen, and Home's collect tile reads Collecting: " + JSON.stringify([none, coll]));

    /* ---- 2 ---- */
    const B = await page({ orders: [ord("o1", "done", ago(300))] });
    await basketAdd(B, SHAPE.salt, 1); await toSheet(B);
    B.d.querySelector('#osheet [data-k="mode:1"]').click(); await B.settle();
    addSpot(B.d, B.w, "Zarvo"); await B.settle();
    B.d.querySelector('#osheet [data-k="close"]').click(); await B.settle();
    ok(!B.d.getElementById("osheet") && line(B) === "Delivering to Zarvo",
      "a way chosen in a sheet and closed is the line on Prices, as the next sheet opens on it: " + line(B));

    /* ---- 3 ---- */
    const H = await page({ orders: [] });
    await basketAdd(H, SHAPE.salt, 1); await toSheet(H);
    H.d.querySelector('#osheet [data-k="mode:1"]').click(); await H.settle();
    addSpot(H.d, H.w, "<b>Kelvo</b>"); await H.settle();
    H.d.querySelector('#osheet [data-k="close"]').click(); await H.settle();
    ok(line(H) === "Delivering to <b>Kelvo</b>" && !H.d.querySelector("#pWay b"), "a place is shown as its own text, never read as markup: " + line(H));

    /* ---- 4 ---- */
    B.d.getElementById("pWayGo").click(); await B.settle();
    const ae = B.d.activeElement;
    ok(!!B.d.getElementById("osheet") && !!ae && ae.getAttribute("data-k") === "mode:1" && ae.getAttribute("aria-pressed") === "true" && !B.d.getElementById("oWhere"),
      "Change opens the order sheet with focus on How it reaches you, the way chosen: " + (ae && ae.getAttribute("data-k")));

    /* ---- 5 ---- */
    const N = await page({ orders: [] });
    const Hd = await page({ orders: [ord("o1", "done", ago(300))], late: 1 });
    const Hi = await page({ orders: [ord("o1", "done", ago(300))], late: 3 });
    ok(line(N) === null && line(Hd) === null && !Hi.d.getElementById("pWay") && !!N.d.querySelector("#pPrices .szrow"),
      "no way line before a way is chosen, an order or none; with prices hidden, none at all: " + JSON.stringify([line(N), line(Hd), !!Hi.d.getElementById("pWay")]));
  } catch (e) { ok(false, "counter-b-way stopped on an error: " + (e && e.stack)); }
  finally { pages.forEach((p) => p.close()); }
}
