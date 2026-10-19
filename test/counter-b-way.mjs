/* test/counter-b-way.mjs: THE WAY ON PRICES (Counter Batch B, P1, item 11; his answers 10 and 11 of 18 Oct 2026).
 *
 * Under the Prices stamp one line says how the next order reaches them, "Delivering to {place}" or "Collecting", read by wayNow(), the
 * same read the order sheet opens on, with Change opening the sheet at How it reaches you. Every assertion observes the signed-in page in
 * jsdom (test/counter-b-kit.mjs); each was proved red by its own mutation (test/counter-b-way.mutations.json, tools/section.mjs).
 *   1  the newest order sets it: collect, deliver, collect reads Collecting; a newest delivery reads Delivering to its place
 *   2  a way chosen in a sheet and closed shows, as the next sheet will open on it
 *   3  a place shows as text, never markup
 *   4  Change opens the sheet with focus on the way chosen
 *   5  no line with no order; no Change under the overdue gate; nothing at all while prices are hidden */
import { open, ord, txt, ago } from "./counter-b-kit.mjs";

export async function run({ ok, pageWork }) {
  const pages = [];
  const page = async (o) => { const p = await open(Object.assign({ pageWork }, o)); pages.push(p); return p; };
  const line = (p) => { const w = p.d.getElementById("pWay"); return w && !w.hidden ? txt(w.querySelector(".pway__t")) : null; };
  try {
    /* ---- 1 ---- */
    const A = await page({ orders: [ord("o1", "done", ago(300)), ord("o2", "done", ago(200), { mode: "deliver", place: "Veloria" }), ord("o3", "acknowledged", ago(100))] });
    const B = await page({ orders: [ord("o1", "done", ago(300)), ord("o2", "acknowledged", ago(100), { mode: "deliver", place: "Veloria" })] });
    ok(line(A) === "Collecting" && line(B) === "Delivering to Veloria" && !!A.d.querySelector("#pPrices > #pWay"),
      "the way on Prices is the newest order's: a newest collection reads Collecting, a newest delivery its place: " + JSON.stringify([line(A), line(B)]));

    /* ---- 2 ---- */
    const go = A.d.getElementById("pWayGo"); go.click(); await A.settle();
    const deliv = A.d.querySelector('#osheet [data-k="mode:1"]'); deliv.click(); await A.settle();
    const where = A.d.getElementById("oWhere"); where.value = "Zarvo"; where.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    A.d.querySelector('#osheet [data-k="close"]').click(); await A.settle();
    ok(!A.d.getElementById("osheet") && line(A) === "Delivering to Zarvo",
      "a way chosen in a sheet and closed is the line on Prices, as the next sheet opens on it: " + line(A));

    /* ---- 3 ---- */
    const H = await page({ orders: [ord("o1", "placed", ago(10), { mode: "deliver", place: "<b>Kelvo</b>" })] });
    ok(line(H) === "Delivering to <b>Kelvo</b>" && !H.d.querySelector("#pWay b"), "a place is shown as its own text, never read as markup: " + line(H));

    /* ---- 4 ---- */
    B.d.getElementById("pWayGo").click(); await B.settle();
    const ae = B.d.activeElement;
    ok(!!B.d.getElementById("osheet") && !!ae && ae.getAttribute("data-k") === "mode:1" && ae.getAttribute("aria-pressed") === "true" && B.d.getElementById("oWhere").value === "Veloria",
      "Change opens the order sheet with focus on How it reaches you, the way chosen, and the place filled: " + (ae && ae.getAttribute("data-k")));

    /* ---- 5 ---- */
    const N = await page({ orders: [] });
    const Hd = await page({ orders: [ord("o1", "done", ago(300))], late: 1 });
    const Hi = await page({ orders: [ord("o1", "done", ago(300))], late: 3 });
    ok(line(N) === null && line(Hd) === "Collecting" && !Hd.d.getElementById("pWayGo") && !Hi.d.getElementById("pWay") && !!N.d.querySelector("#pPrices .szrow"),
      "no way line before a first order; under the overdue gate the line without Change; with prices hidden, none at all: " + JSON.stringify([line(N), line(Hd), !!Hd.d.getElementById("pWayGo"), !!Hi.d.getElementById("pWay")]));
  } catch (e) { ok(false, "counter-b-way stopped on an error: " + (e && e.stack)); }
  finally { pages.forEach((p) => p.close()); }
}
