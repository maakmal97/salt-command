/* test/bundled-page.mjs: 11 NOV 2026, HIS REPORT "It is impossible to add a spot on the map or place for delivery to a customer. The word
 * order ready for review will literally not appear." On Order for them a delivery's sheet stopped under Where to: no When, an empty foot.
 * The page carries some Worker functions as their own source (slotSpan, slotNext and openParts for a delivery's windows; haversineKm on
 * his page), and wrangler bundles the Worker with esbuild's keepNames, which writes __name(f, "f") inside each of them. The page had no
 * __name, so every delivery sheet threw at its windows, a customer's on Salt Counter as much as his. Every other check draws the page
 * from stmt/page.js as written, where no __name is ever written, so none could see it: these draw it from the bundle as wrangler builds it.
 *   1  the bundle does write __name inside the windows' functions (the premise; without it the checks below prove nothing)
 *   2  on the bundled page a customer's delivery, a spot added, draws When you want it and a Review that goes
 *   3  on his bundled page the one distance measures
 * Proved red by mutation (test/bundled-page.mutations.json, tools/section.mjs). */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { open, addSpot, txt, basketAdd, toSheet, SHAPE } from "./counter-b-kit.mjs";
import { richOwnerPage } from "./maker-act.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/* the Counter's hours as the live Worker answers them (open all day, every day), so the sheet offers windows */
const HOURS = { ok: true, open: true, source: "schedule", nextChange: null, nextOpen: null,
  config: { schedule: { days: Array.from({ length: 7 }, () => ({ open: "00:00", close: "24:00" })) }, manual: null } };

/* stmt/page.js bundled as wrangler bundles the Worker: esbuild, ESM, keepNames on (wrangler's default) */
async function bundled() {
  const dir = mkdtempSync(join(tmpdir(), "salt-bundle-")), out = join(dir, "page.mjs");
  await build({ stdin: { contents: 'export * from "./stmt/page.js";', resolveDir: REPO, loader: "js" }, bundle: true, format: "esm",
    platform: "neutral", target: "es2022", keepNames: true, outfile: out, logLevel: "silent" });
  return { P: await import(pathToFileURL(out).href), done: () => rmSync(dir, { recursive: true, force: true }) };
}

export async function run({ ok, pageWork }) {
  const B = await bundled();
  /* what the page throws is caught for the length of these checks and read by them, so a page that throws fails a check rather than the run */
  const errs = [], onErr = (e) => errs.push(String((e && e.message) || e));
  process.on("unhandledRejection", onErr); process.on("uncaughtException", onErr);
  try {
    /* ---- 1 ---- */
    const html = B.P.landingPage("abcd-efgh", "n", null);
    ok(/__name\(spanTake, "spanTake"\)/.test(html) && /__name\(nextHm, "nextHm"\)/.test(html),
      "1 the bundle writes __name inside the windows' functions, so the page must answer it");

    /* ---- 2 ---- */
    const p = await open({ ok, pageWork, hours: HOURS, page: B.P });
    try {
      await basketAdd(p, SHAPE.salt, 1); await toSheet(p);
      const deliver = p.d.querySelector('#osheet [data-k="mode:1"]'); if (deliver) { deliver.click(); await p.settle(); }
      let err = "";
      try { addSpot(p.d, p.w, "Veloria"); await p.settle(); } catch (e) { err = e && e.message; }
      const go = p.d.getElementById("oGo"), body = txt(p.d.querySelector("#osheet .salt-sheet__body"));
      ok(!err && !errs.length && !!go && go.getAttribute("aria-disabled") !== "true" && /When you want it/.test(body) && /ASAP/.test(body),
        "2 on the bundled page a delivery with a spot added draws When you want it and a Review that goes: "
        + JSON.stringify([err, errs.slice(0, 2), !!go, go && go.getAttribute("aria-disabled"), body.slice(-160)]));
    } finally { p.close(); }

    /* ---- 3 ---- */
    const o = await richOwnerPage({ pageWork, probe: true, landing: B.P.landingPage });
    try {
      let km = null, err = "";
      try { km = o.w.__owner("haversineKm({lat:3.1,lng:101.7},{lat:3.2,lng:101.8})"); } catch (e) { err = e && e.message; }
      ok(typeof km === "number" && km > 15 && km < 16, "3 on his bundled page the one distance measures: " + JSON.stringify([km, err]));
    } finally { o.w.close(); }
  } catch (e) { ok(false, "the bundled page stopped on an error: " + (e && e.stack)); }
  finally { B.done(); process.off("unhandledRejection", onErr); process.off("uncaughtException", onErr); }
}
