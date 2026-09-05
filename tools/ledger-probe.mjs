/* ledger-probe.mjs — measure the Ledger sheet's geometry in a real browser, by hand.
 *
 *   node tools/ledger-probe.mjs            measure public/desk.html at 1280 and 375
 *
 * v495: the entry is two rows; the product sits on the first with the figures, the step opens
 * the second and the act cell ends it, and the heading's Qty and Price/unit no longer overlap.
 * jsdom lays out no grid, so the suite reads the declared areas and this reads the pixels.
 * Same rig as renderdiff: Playwright from Code/salt-ds/.ds-sync, public/ served on a spare port.
 * Exits non-zero on any failed claim. Never run by CI.
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = resolve(REPO, "public");
const PW_ROOT = process.env.SALT_PW || resolve(REPO, "..", "salt-ds", ".ds-sync", "node_modules");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".css": "text/css" };

function serve() {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/" || p === "/desk") p = "/desk.html";
    const f = resolve(PUBLIC, "." + p);
    if (!f.startsWith(PUBLIC) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
    res.end(readFileSync(f));
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, port: srv.address().port })));
}

const { chromium } = createRequire(join(PW_ROOT, "x.js"))("playwright");
const { srv, port } = await serve();
const b = await chromium.launch();
let bad = 0;
const say = (okk, msg) => { console.log(`  ${okk ? "ok  " : "FAIL"}  ${msg}`); if (!okk) bad++; };
for (const [w, h] of [[1280, 900], [375, 812]]) {
  const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce", isMobile: w < 600, hasTouch: w < 600 });
  await page.goto(`http://127.0.0.1:${port}/desk`, { waitUntil: "networkidle" });
  await page.evaluate(() => { switchTab("ledger"); window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
  const g = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { t: Math.round(b.top), l: Math.round(b.left), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width) }; };
    const line = document.querySelector(".sec.on .lcard .lrow");
    const q = (s) => r(line.querySelector(s));
    const head = document.querySelector(".sec.on .lhead");
    const hq = r(head.querySelector(".cqty")), hp = r(head.querySelector(".cprc"));
    const hqText = head.querySelector(".cqty .lsb"), hpText = head.querySelector(".cprc .lsb");
    const btn = document.querySelector(".sec.on .lcard .lc-act button");
    return { e: q(".lc-e"), prod: q(".lc-prod"), party: q(".lc-party"), step: q(".lc-step"), type: q(".lc-type"), act: q(".lc-act"), state: q(".lstate"),
      hq, hp, hqTextR: r(hqText).r, hpTextL: r(hpText).l, sheetW: Math.round(document.querySelector(".sec.on .ledwrap").getBoundingClientRect().width),
      btn: btn ? r(btn) : null, btnStyle: btn ? getComputedStyle(btn).borderTopStyle + "/" + getComputedStyle(btn).textDecorationLine : null };
  });
  console.log(`${w}px: sheet ${g.sheetW}px wide`);
  if (w >= 600) {
    say(g.prod.t === g.e.t && g.party.t === g.e.t && g.state.t === g.e.t, `the product sits on the entry's first row with the party and the state (tops e ${g.e.t}, prod ${g.prod.t}, party ${g.party.t}, state ${g.state.t})`);
    /* cells of different heights centre at different tops on one row, so membership is read against the first row's foot */
    say(Math.min(g.step.t, g.type.t, g.act.t) >= g.e.b - 2 && Math.max(g.step.t, g.type.t, g.act.t) < g.step.b, `the step, the type and the act cell all sit below the first row, on the second (tops step ${g.step.t}, type ${g.type.t}, act ${g.act.t}; first row ends ${g.e.b})`);
    say(g.act.r >= g.state.r - 1, `and the act cell runs to the end of the line (act right ${g.act.r}, state right ${g.state.r})`);
    say(g.hqTextR <= g.hpTextL, `the heading's Qty ends before Price/unit begins (${g.hqTextR} <= ${g.hpTextL})`);
  }
  say(!!g.btn && g.btnStyle === "solid/none", `Update is drawn as a bordered button with no underline (${g.btnStyle})`);
  await page.close();
}
await b.close(); srv.close();
if (bad) { console.log(`  ${bad} claim(s) failed`); process.exit(1); }
