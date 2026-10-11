/* Measure the rendered Counter server-queue withdrawal control, then prove a tight target fails.
 *
 * Run after `npm run build`: node tools/maker-queue-geometry.mjs
 * Playwright is loaded from SALT_PW or the local Salt DS tool environment.
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { landingPage } from "../stmt/page.js";
import { contentKey, wrapKey } from "./stmt-crypto.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PW_ROOT = process.env.SALT_PW || resolve(REPO, "..", "..", "..", "salt-ds", ".ds-sync", "node_modules");
const { chromium } = createRequire(join(PW_ROOT, "x.js"))("playwright");
const content = await contentKey("4".repeat(64), "maker-queue-geometry");
const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
const entry = { id: "2099-10-05T02:07:00.000Z", date: "2099-10-05", state: "queued",
  device: "phone-geometry", fingerprint: "a".repeat(64), canWithdraw: true, canRetry: false };
const html = landingPage("", "maker-queue-geometry", { master: "fixture-master", accounts: [] });
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  const value = path === "/open" ? adminOpen
    : path === "/all/maker/review" ? { ok: true, orders: [], drafts: [], refused: [], queue: [entry] }
      : path === "/all/maker/inputs" ? { ok: true, products: [], catalog: { products: [], parties: [] } }
        : path === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
          : { ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [], pools: [], config: null };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
});
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const { port } = server.address();
const browser = await chromium.launch(process.env.SALT_BROWSER ? { executablePath: process.env.SALT_BROWSER } : {});
let failures = 0;
const report = (condition, label, detail = "") => {
  console.log(`  ${condition ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
};

async function measure(page) {
  return page.evaluate(() => {
    const button = document.querySelector("#makerQueueReview .maker-queue-action");
    if (!button) throw new Error("The server-held entry has no withdrawal control.");
    button.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const rect = button.getBoundingClientRect();
    const points = [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]];
    const hits = points.map(([dx, dy]) => {
      const hit = document.elementFromPoint(rect.left + rect.width / 2 + dx, rect.top + rect.height / 2 + dy);
      return !!hit && (hit === button || button.contains(hit));
    });
    const style = getComputedStyle(button);
    return {
      visible: !!button.offsetParent && style.visibility === "visible" && style.pointerEvents !== "none" && Number(style.opacity) > 0,
      offset: { width: button.offsetWidth, height: button.offsetHeight },
      rect: { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) },
      hitPoints: hits
    };
  });
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const page = await browser.newPage({
      viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce",
      isMobile: width < 600, hasTouch: width < 600
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-act="nav.record"]:visible').last().click();
    await page.locator('[data-act="part.record.approve"]:visible').click();
    await page.locator("#makerQueueReview .maker-queue-action").waitFor();
    const baseline = await measure(page);
    const baselineOk = baseline.visible && baseline.offset.width >= 44 && baseline.offset.height >= 44
      && baseline.hitPoints.every(Boolean);
    report(baselineOk, `${width}px withdrawal center and four 21px offset hits`, JSON.stringify(baseline));

    await page.addStyleTag({ content: "#makerQueueReview .maker-queue-action{box-sizing:border-box!important;width:20px!important;min-width:20px!important;height:20px!important;min-height:20px!important;padding:0!important}" });
    const tight = await measure(page);
    report(tight.offset.width < 44 || tight.offset.height < 44 || tight.hitPoints.some((hit) => !hit),
      `${width}px independent 20x20 tight-target mutation fails`, JSON.stringify(tight));
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

if (failures) process.exitCode = 1;
