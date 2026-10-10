import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { landingPage } from "../stmt/page.js";
import { contentKey, wrapKey } from "./stmt-crypto.mjs";
import { world } from "../test/maker-trades.mjs";

const root = process.env.SALT_PW || resolve("..", "..", "..", "salt-ds", ".ds-sync", "node_modules");
const { chromium } = createRequire(join(root, "x.js"))("playwright");
const wd = world(), html = landingPage("", "registration-geometry", { master: "fixture-master", accounts: [] });
const envelope = (text) => ({ v: 1, salt: Buffer.alloc(16, 1).toString("base64"),
  iv: Buffer.alloc(12, 2).toString("base64"), ct: Buffer.from(text.padEnd(16, ".")).toString("base64") });
wd.desk.VAULT_STORE = "pair";
const vault = envelope("encrypted-CX8-SEN");
wd.sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
  .run(JSON.stringify(envelope("base-names")), null, "2099-10-05T01:30:00.000Z");
const registration = await wd.call("/all/maker/inputs/add-id", { at: "2099-10-05T02:00:00.000Z",
  code: "CX8-SEN", kind: "customer", parent: null, tiers: null, vault,
  pair: { expectedRevision: 1, names: vault, places: null } });
if (registration.status !== 200) throw new Error("The native pair-backed Add ID fixture did not complete.");
const content = await contentKey("4".repeat(64), "registration-geometry");
const open = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); return; }
    let body = "";
    for await (const chunk of req) body += chunk;
    const response = path === "/open" ? Response.json(open)
      : /^\/all\/maker\/(inputs|trade-cover)/.test(path)
        ? await wd.call(path, body ? JSON.parse(body) : undefined)
        : Response.json({ ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
          pools: [], offers: [], config: null, status: {}, bulletin: { lines: [] } });
    res.writeHead(response.status, { "content-type": "application/json" }); res.end(await response.text());
  } catch (error) { res.writeHead(500); res.end(JSON.stringify({ ok: false, error: error.message })); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
let browser, failures = 0;
const report = (condition, label, detail) => {
  console.log(`  ${condition ? "PASS" : "FAIL"} ${label} — ${JSON.stringify(detail)}`);
  if (!condition) failures++;
};
try {
  browser = await chromium.launch(process.env.SALT_BROWSER ? { executablePath: process.env.SALT_BROWSER } : {});
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1,
      reducedMotion: "reduce", isMobile: width < 600, hasTouch: width < 600 });
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.locator('button[data-m="maker"]:visible').last().click();
    const trade = page.locator(".maker-input").filter({
      has: page.getByRole("heading", { name: "Sale or purchase", exact: true })
    });
    const party = trade.getByLabel(/^Party/);
    try { await party.waitFor({ timeout: 5000 }); }
    catch (error) { throw new Error("Party selector did not load: " + JSON.stringify({
      inputs: await trade.innerText().catch(() => ""),
      selects: await trade.locator("select").evaluateAll((nodes) => nodes.map((node) => ({
        html: node.outerHTML.slice(0, 300),
        label: node.labels?.[0]?.innerText,
        rect: (() => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })(),
        display: getComputedStyle(node).display,
        visibility: getComputedStyle(node).visibility
      }))),
      page: (await page.locator("body").innerText()).slice(0, 800)
    }) + " " + error.message); }
    await party.selectOption("CX8-SEN");
    const measure = () => party.evaluate((node) => {
      node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const rect = node.getBoundingClientRect();
      const points = [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]];
      return { value: node.value, width: node.offsetWidth, height: node.offsetHeight,
        hits: points.map(([dx, dy]) => {
          const hit = document.elementFromPoint(rect.left + rect.width / 2 + dx, rect.top + rect.height / 2 + dy);
          return hit === node || node.contains(hit);
        }) };
    });
    const base = await measure();
    report(base.value === "CX8-SEN" && base.width >= 44 && base.height >= 44 && base.hits.every(Boolean),
      `${width}px confirmed Add ID party selector center and four 21px offset hits`, base);
    await party.evaluate((node) => node.setAttribute("data-geometry-party", ""));
    await page.addStyleTag({ content: '#makerInputs select[data-geometry-party]{box-sizing:border-box!important;width:20px!important;min-width:20px!important;max-width:20px!important;height:20px!important;min-height:20px!important;max-height:20px!important;padding:0!important}' });
    const tight = await measure();
    report(tight.width < 44 || tight.height < 44 || tight.hits.some((hit) => !hit),
      `${width}px independent 20x20 selector mutation is detected`, tight);
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
  wd.sqlite.close();
}
if (failures) process.exitCode = 1;
