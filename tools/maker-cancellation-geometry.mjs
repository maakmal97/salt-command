import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fixture } from "../test/maker-cancellation.mjs";
import { contentKey, wrapKey } from "./stmt-crypto.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PW_ROOT = process.env.SALT_PW || resolve(REPO, "..", "..", "..", "salt-ds", ".ds-sync", "node_modules");
const { chromium } = createRequire(join(PW_ROOT, "x.js"))("playwright");
const f = await fixture();
const adminOpen = { ok: true, byMaster: true, session: "",
  wrapMaster: await wrapKey("fixture-master", await contentKey("4".repeat(64), "cancellation-geometry")) };
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(f.html); return;
  }
  const path = new URL(req.url, "http://localhost").pathname;
  const value = path === "/open" ? adminOpen : path === "/all/maker/inputs" ? f.context
    : { ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [], bulletin: { lines: [] },
      config: null, status: {}, refs: [], tiers: [] };
  res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(value));
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const browser = await chromium.launch(process.env.SALT_BROWSER ? { executablePath: process.env.SALT_BROWSER } : {});
let failures = 0;
const report = (pass, label, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}: ${JSON.stringify(detail)}`);
  if (!pass) failures++;
};
async function measure(page) {
  return page.evaluate(() => {
    const section = [...document.querySelectorAll("#makerInputs .maker-input")]
      .find((s) => s.querySelector("h3")?.textContent === "Amend a ledger row");
    const controls = [...section.querySelectorAll("input,select,button")].filter((node) =>
      !node.disabled && node.offsetParent && getComputedStyle(node).visibility === "visible");
    return controls.map((node) => {
      node.scrollIntoView({ block: "center", behavior: "instant" });
      const r = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { label: node.closest("label")?.querySelector(".lbl")?.textContent || node.textContent,
        width: node.offsetWidth, height: node.offsetHeight,
        visible: style.pointerEvents !== "none" && Number(style.opacity) > 0,
        hits: [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]].map(([x, y]) => {
          const hit = document.elementFromPoint(r.left + r.width / 2 + x, r.top + r.height / 2 + y);
          return !!hit && (hit === node || node.contains(hit));
        }) };
    });
  });
}
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce",
      deviceScaleFactor: 1, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-act="nav.record"]:visible').last().click();
    await page.locator('[data-act="part.record.entry"]:visible').click();
    const editor = page.locator(".maker-input").filter({ has: page.getByRole("heading", { name: "Amend a ledger row", exact: true }) });
    await editor.waitFor();
    const field = (label) => editor.locator("label").filter({ has: page.locator(".lbl").filter({ hasText: new RegExp("^" + label + "$") }) }).locator("input,select");
    await field("Ledger row").selectOption("f18");
    await field("Amendment").selectOption("Cancellation");
    const disclosure = await editor.locator(".maker-cancellation").innerText();
    report(/Refund due.*Undelivered.*Cancelled/.test(disclosure) && /RM 450 already paid becomes a refund payable/.test(disclosure),
      `${width}px actual paid disclosure`, disclosure);
    report(await field("RM moved").isDisabled()
      && !await field("RM moved").isVisible()
      && await field("Units moved").isDisabled()
      && !await field("Units moved").isVisible(),
    `${width}px unused fields disabled and hidden`, true);
    const normal = await measure(page);
    report(normal.length === 4 && normal.every((n) => n.visible && n.width >= 44 && n.height >= 44 && n.hits.every(Boolean)),
      `${width}px control finger hits`, normal);
    await field("Ledger row").selectOption("f19");
    const pending = await editor.locator(".maker-cancellation").innerText();
    report(/Unpaid.*Cancelled/.test(pending) && !/refund payable/.test(pending), `${width}px pending disclosure`, pending);
    await page.addStyleTag({ content: ".maker-input:has(.maker-cancellation) input,.maker-input:has(.maker-cancellation) select,.maker-input:has(.maker-cancellation) button{box-sizing:border-box!important;width:20px!important;min-width:20px!important;height:20px!important;min-height:20px!important;padding:0!important;overflow:hidden!important}.maker-input:has(.maker-cancellation) button::before,.maker-input:has(.maker-cancellation) button::after{display:none!important}" });
    const tight = await measure(page);
    report(tight.length === 4 && tight.every((n) => n.width === 20 && n.height === 20 && n.hits.some((hit) => !hit)),
      `${width}px independent 20x20 mutation rejected`, tight);
    await page.close();
  }
} finally {
  await browser.close(); f.db.close();
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
if (failures) process.exitCode = 1;
