import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { landingPage } from "../stmt/page.js";
import { contentKey, wrapKey } from "./stmt-crypto.mjs";
import { fixture } from "../test/maker-reward-parity.mjs";

const root = process.env.SALT_PW || resolve("..", "..", "..", "salt-ds", ".ds-sync", "node_modules");
const { chromium } = createRequire(join(root, "x.js"))("playwright");
const wd = await fixture(), html = landingPage("", "reward-geometry", { master: "fixture-master", accounts: [] });
const content = await contentKey("4".repeat(64), "reward-geometry");
const open = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); return; }
    const path = new URL(req.url, "http://localhost").pathname;
    let chunks = "";
    for await (const chunk of req) chunks += chunk;
    const response = /^\/all\/maker\/(inputs|trade-cover)/.test(path)
      ? await wd.call(path, chunks ? JSON.parse(chunks) : undefined)
      : Response.json(path === "/open" ? open : { ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
        pools: [], offers: [], config: null, status: {}, bulletin: { lines: [] } });
    res.writeHead(response.status, { "content-type": "application/json" });res.end(await response.text());
  } catch (error) { res.writeHead(500);res.end(JSON.stringify({ ok: false, error: error.message })); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser, failures = 0;
try {
  browser = await chromium.launch(process.env.SALT_BROWSER ? { executablePath: process.env.SALT_BROWSER } : {});
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.locator('button[data-m="maker"]:visible').last().click();
    const trade = page.locator(".maker-input").filter({ has: page.getByRole("heading", { name: "Sale or purchase", exact: true }) });
    await trade.getByLabel("Goods total (RM)", { exact: true }).fill(String(wd.ask - 30));
    await trade.locator(".maker-cover:visible").waitFor();
    const selector = ".maker-reward button:not([hidden]), .maker-cover:visible input";
    const controls = page.locator(selector);
    const n = await controls.count();
    if (n < 2) throw new Error("Missing generated reward/cover controls.");
    const measure = async () => {
      const rows = [];
      for (let i = 0; i < n; i++) {
        const control = controls.nth(i);await control.scrollIntoViewIfNeeded();
        rows.push(await control.evaluate((node) => {
          const r = node.getBoundingClientRect();
          return { label: node.textContent || node.parentNode.textContent, w: r.width, h: r.height,
            hits: [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]].map(([x, y]) => {
              const hit = document.elementFromPoint(r.left + r.width / 2 + x, r.top + r.height / 2 + y);
              return hit === node || node.contains(hit);
            }) };
        }));
      }
      return rows;
    };
    const base = await measure();
    const green = base.every((r) => r.w >= 44 && r.h >= 44 && r.hits.every(Boolean));
    console.log(JSON.stringify({ width, controls: base, green }));
    if (!green) failures++;
    const style = await page.addStyleTag({ content: ".maker-reward button,.maker-cover input{box-sizing:border-box!important;width:20px!important;height:20px!important;min-width:20px!important;min-height:20px!important;max-width:20px!important;max-height:20px!important;padding:0!important}" });
    const red = await measure();
    const detected = red.every((r) => r.w === 20 && r.h === 20 && !r.hits.every(Boolean));
    console.log(JSON.stringify({ width, mutationDetected: detected, controls: red }));
    if (!detected) failures++;
    await style.evaluate((node) => node.remove());await page.close();
  }
} finally {
  await browser?.close();await new Promise((done) => server.close(done));
  wd.source.w.close();wd.sqlite.close();
}
if (failures) process.exitCode = 1;
