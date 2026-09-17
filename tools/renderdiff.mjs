#!/usr/bin/env node
/* renderdiff.mjs — render every part of the built desk at two widths, and compare two renders.
 *
 * The instrument for a fold that claims to change nothing visible: retiring a dead rule, moving
 * a declaration between layers, deleting a colour nothing reads. "Nothing changed" is a claim
 * about pixels, so it is measured in pixels: sixteen parts, 1280 and 375 wide, animation and
 * motion off, the stamp and the version hidden (they move on every build), compared shot for
 * shot. A retirement fold ships when every shot reads 0.
 *
 *   node tools/renderdiff.mjs --shoot <label> [--parts a,b]   render public/desk.html into test/_render/<label>/
 *   node tools/renderdiff.mjs --compare <a> <b>         differing pixels per shot, exit 1 if any differ
 *
 * Playwright is taken from Code/salt-ds/.ds-sync/node_modules (set SALT_PW to another root) and
 * the compare step uses python with PIL, so this runs BY HAND on this machine, never in CI, like
 * geofetch. It serves public/ itself on a spare port, so no wrangler is needed.
 *
 * PROVED RED before it was trusted (v473): a one-line colour change to a live rule (brass to
 * red) read as differing on all 34 shots; two renders of the same build read identical on 32
 * and 3 pixels apart on one hairline row of two chart shots, which is the noise floor. A shot
 * within 16 pixels reads as the same; a retirement fold that moves more than that has moved
 * something. A pixel counts only when a channel moves by more than 2 of 255: moving a field's
 * fill between layers shifted 112,000 near-black pixels by exactly one unit (v475), which no
 * eye can see and which is compositing rounding, not a change of material. */
import { createServer } from "node:http";
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = resolve(REPO, "public");
const OUT = resolve(REPO, "test", "_render");
const PW_ROOT = process.env.SALT_PW || resolve(REPO, "..", "salt-ds", ".ds-sync", "node_modules");
const PARTS = ["today", "overview", "forward", "receivables", "financials", "inventory", "sourcing", "pricing",
  "concentration", "network", "map", "ledger", "journal", "analysis", "add", "approve", "plans"];
const WIDTHS = [[1280, 900], [375, 812]];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".css": "text/css" };

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

async function shoot(label, only) {
  const { chromium } = createRequire(join(PW_ROOT, "x.js"))("playwright");
  const dir = join(OUT, label); mkdirSync(dir, { recursive: true });
  const { srv, port } = await serve();
  const b = await chromium.launch();
  for (const [w, h] of WIDTHS) {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce", isMobile: w < 600, hasTouch: w < 600 });
    await page.goto(`http://127.0.0.1:${port}/desk`, { waitUntil: "networkidle" });
    /* the stamp, the version chip, the entry counts and the version entries move on every build; nothing else may */
    await page.addStyleTag({ content: "#meta,#verChip,.ledct{visibility:hidden!important}.evo{display:none!important}*{caret-color:transparent!important}" });
    await page.waitForTimeout(800);
    for (const part of PARTS.filter((p) => !only || only.includes(p))) {
      await page.evaluate((p) => { switchTab(p); window.scrollTo(0, 0);
        /* the journal lists every version entry; they move on every build, so they are not compared */
        document.querySelectorAll(".jent").forEach((e) => { const k = e.querySelector(".jkind"); if (k && k.textContent === "Version") e.remove(); }); }, part);
      await page.waitForTimeout(700);
      /* v684: a full-page capture under touch emulation turns (pointer:coarse) off, during the capture and after it,
         and the phone's menu keys on it since v684, so every phone shot drew the desktop's standing rail. A phone
         shot grows the viewport to the page instead, which keeps the pointer. */
      const touch = w < 600;
      if (touch) { await page.setViewportSize({ width: w, height: await page.evaluate(() => document.documentElement.scrollHeight) }); await page.waitForTimeout(300); }
      await page.screenshot({ path: join(dir, `${part}-${w}.png`), fullPage: !touch, animations: "disabled", timeout: 180000 });
      if (touch) await page.setViewportSize({ width: w, height: h });
    }
    await page.close();
  }
  await b.close(); srv.close();
  console.log(`  ok    ${PARTS.length * WIDTHS.length} shots in test/_render/${label}/`);
}

function compare(a, b) {
  const A = join(OUT, a), B = join(OUT, b);
  const shots = readdirSync(A).filter((f) => f.endsWith(".png")).sort();
  const py = `
import sys
from PIL import Image, ImageChops
bad = 0
for name in sys.argv[3:]:
    a = Image.open(sys.argv[1] + '/' + name).convert('RGB'); b = Image.open(sys.argv[2] + '/' + name).convert('RGB')
    if a.size != b.size:
        print('  DIFF  %-22s size %s vs %s' % (name, a.size, b.size)); bad += 1; continue
    box = ImageChops.difference(a, b).getbbox()
    if box is None: print('  same  %-22s' % name); continue
    n = sum(1 for p in ImageChops.difference(a, b).getdata() if max(p) > 2)
    if n <= 16: print('  same  %-22s (%d px of noise in %s)' % (name, n, box)); continue
    print('  DIFF  %-22s %d px in %s' % (name, n, box)); bad += 1
sys.exit(1 if bad else 0)`;
  const r = spawnSync("python", ["-c", py, A, B, ...shots], { encoding: "utf8" });
  process.stdout.write(r.stdout); process.stderr.write(r.stderr);
  process.exit(r.status);
}

const mode = process.argv[2];
if (mode === "--shoot" && process.argv[3]) await shoot(process.argv[3], process.argv[4] === "--parts" ? process.argv[5].split(",") : null);
else if (mode === "--compare" && process.argv[4]) compare(process.argv[3], process.argv[4]);
else { console.log("usage: node tools/renderdiff.mjs --shoot <label> | --compare <a> <b>"); process.exit(2); }
