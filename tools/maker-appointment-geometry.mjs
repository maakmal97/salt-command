/* Measure the rendered existing-customer appointment controls and prove tight targets fail.
 *
 * Run after `npm run build`: node tools/maker-appointment-geometry.mjs
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
const adminOpen = { ok: true, byMaster: true, session: "",
  wrapMaster: await wrapKey("fixture-master", await contentKey("4".repeat(64), "maker-appointment-geometry")) };
const catalog = {
  products: [{ product: "salt", drift: true, tiered: false }],
  parties: ["AJ4-RED", "SZ4-CUS"], associates: [],
  appointmentCustomers: ["AJ4-RED", "SZ4-CUS"],
  appointmentKinds: [{ kind: "reseller", stream: "R2" }, { kind: "referral", stream: "R3" }]
};
const html = landingPage("", "maker-appointment-geometry", { master: "fixture-master", accounts: [] });
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  const value = path === "/open" ? adminOpen
    : path === "/all/maker/inputs" ? { ok: true, products: ["salt"], catalog }
      : path === "/all/maker/review" ? { ok: true, orders: [], drafts: [], refused: [] }
        : path === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
          : { ok: true, accounts: [], orders: [], drafts: [], refs: [], tiers: [] };
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
const TARGETS = [
  { key: "existing-customer", label: "Existing customer", selector: "select" },
  { key: "appointment-role", label: "Appointment role", selector: "select" },
  { key: "submit", label: "Send appointment for review", selector: "button" }
];

async function measure(page, target) {
  return page.evaluate(({ key, label, selector }) => {
    const section = [...document.querySelectorAll("#makerInputs .maker-input")]
      .find((item) => item.querySelector("h3")?.textContent === "Appoint existing customer");
    if (!section) throw new Error("Existing-customer appointment section was not rendered.");
    let control;
    if (key === "submit") {
      control = [...section.querySelectorAll("button")].find((item) => item.textContent.trim() === label);
    } else {
      const field = [...section.querySelectorAll(".maker-field")]
        .find((item) => item.querySelector(".lbl")?.textContent.trim() === label);
      control = field?.querySelector(selector);
    }
    if (!control) throw new Error(`Appointment target is missing: ${label}`);
    control.dataset.geometryTarget = key;
    control.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    const rect = control.getBoundingClientRect();
    const points = [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]];
    const hitPoints = points.map(([dx, dy]) => {
      const hit = document.elementFromPoint(rect.left + rect.width / 2 + dx, rect.top + rect.height / 2 + dy);
      return !!hit && (hit === control || control.contains(hit));
    });
    const style = getComputedStyle(control);
    return {
      label, disabled: control.disabled,
      visible: !!control.offsetParent && style.visibility === "visible"
        && style.pointerEvents !== "none" && Number(style.opacity) > 0,
      offset: { width: control.offsetWidth, height: control.offsetHeight },
      rect: { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) },
      hitPoints
    };
  }, target);
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const page = await browser.newPage({
      viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce",
      isMobile: width < 600, hasTouch: width < 600
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.locator('button[data-m="maker"]:visible').last().click();
    await page.getByRole("heading", { name: "Appoint existing customer" }).waitFor();

    for (const target of TARGETS) {
      const item = await measure(page, target);
      report(!item.disabled && item.visible && item.offset.width >= 44 && item.offset.height >= 44
        && item.hitPoints.every(Boolean), `${width}px ${target.label}: 44px and five hit points`, JSON.stringify(item));
      await page.addStyleTag({ content: `[data-geometry-target="${target.key}"]{box-sizing:border-box!important;width:20px!important;min-width:20px!important;height:20px!important;min-height:20px!important;padding:0!important}` });
      const tight = await measure(page, target);
      report(tight.offset.width < 44 || tight.offset.height < 44 || tight.hitPoints.some((hit) => !hit),
        `${width}px ${target.label}: independent 20x20 tight-target mutation is red`, JSON.stringify(tight));
      await page.locator("style").last().evaluate((style) => style.remove());
      await page.locator(`[data-geometry-target="${target.key}"]`)
        .evaluate((element) => element.removeAttribute("data-geometry-target"));
    }
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

if (failures) process.exitCode = 1;
