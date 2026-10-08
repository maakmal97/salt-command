/* Measure the rendered Counter Admin drift controls in a real browser.
 *
 * Run after `npm run build`: node tools/maker-drift-geometry.mjs
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
const content = await contentKey("4".repeat(64), "maker-drift-geometry");
const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
const context = {
  ok: true, products: ["salt", "oil"],
  catalog: {
    products: [
      { product: "salt", drift: true, tiered: false,
        driftPresets: [{ name: "Better", value: -0.3 }, { name: "Standard", value: 0 }, { name: "Higher", value: 0.3 }] },
      { product: "oil", fixed: true, drift: false, tiered: false }
    ],
    parties: ["CX1-ZED", "CX2-ZED"], associates: [],
    tierCustomers: ["CX1-ZED", "CX2-ZED"], driftCustomers: ["CX1-ZED", "CX2-ZED"],
    tierNames: [], driftCards: [
      { code: "CX1-ZED", product: "salt", held: true, value: 0, current: 0 },
      { code: "CX2-ZED", product: "salt", held: false, value: null, current: 0.35 }
    ]
  }
};
const html = landingPage("", "maker-drift-geometry", { master: "fixture-master", accounts: [] });
const server = createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  const path = new URL(req.url, "http://localhost").pathname;
  const value = path === "/open" ? adminOpen
    : path === "/all/maker/inputs" ? context
      : path === "/all/maker/review" ? { ok: true, orders: [], drafts: [] }
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

async function measureButtons(page) {
  return page.evaluate(() => {
    const section = [...document.querySelectorAll("#makerInputs .maker-input")]
      .find((item) => item.querySelector("h3")?.textContent === "Customer drift");
    if (!section) throw new Error("Customer drift section was not rendered.");
    const buttons = [...section.querySelectorAll(".maker-drift-actions button")]
      .filter((button) => ["Set drift for review", "Clear held drift"].includes(button.textContent.trim()));
    if (buttons.length !== 2) throw new Error(`Expected Set and Clear actions; got ${buttons.length}.`);
    return buttons.map((button) => {
      button.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const rect = button.getBoundingClientRect();
      const points = [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]];
      const hits = points.map(([dx, dy]) => {
        const hit = document.elementFromPoint(rect.left + rect.width / 2 + dx, rect.top + rect.height / 2 + dy);
        return !!hit && (hit === button || button.contains(hit));
      });
      const style = getComputedStyle(button);
      return {
        label: button.textContent.trim(),
        visible: !!button.offsetParent && style.visibility === "visible" && style.pointerEvents !== "none" && Number(style.opacity) > 0,
        offset: { width: button.offsetWidth, height: button.offsetHeight },
        rect: { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) },
        hitPoints: hits
      };
    });
  });
}

async function prepareAddId(page, role) {
  await page.evaluate((value) => {
    const section = [...document.querySelectorAll("#makerInputs .maker-input")]
      .find((item) => item.querySelector("h3")?.textContent === "Add ID");
    if (!section) throw new Error("Add ID section was not rendered.");
    const role = [...section.querySelectorAll(".maker-field")]
      .find((field) => field.querySelector(".lbl")?.textContent.trim() === "Role")?.querySelector("select");
    const presetField = [...section.querySelectorAll(".maker-field")]
      .find((field) => field.querySelector(".lbl")?.textContent.trim().startsWith("Starting drift,"));
    const typedField = [...section.querySelectorAll(".maker-field")]
      .find((field) => field.querySelector(".lbl")?.textContent.trim().startsWith("Typed starting drift,"));
    if (!role || !presetField || !typedField) throw new Error("Add ID drift selector or typed input was not rendered.");
    const preset = presetField.querySelector("select"), typed = typedField.querySelector("input");
    role.value = value;
    role.dispatchEvent(new Event("change", { bubbles: true }));
    preset.value = "typed";
    preset.dispatchEvent(new Event("change", { bubbles: true }));
    presetField.dataset.geometryTarget = "preset";
    typedField.dataset.geometryTarget = "typed";
  }, role);
}

async function measureAddId(page) {
  return page.evaluate(() => {
    const section = [...document.querySelectorAll("#makerInputs .maker-input")]
      .find((item) => item.querySelector("h3")?.textContent === "Add ID");
    const targets = ["preset", "typed"].map((name) => {
      const field = section.querySelector(`[data-geometry-target="${name}"]`);
      const control = field && field.querySelector(name === "preset" ? "select" : "input");
      if (!control) throw new Error(`Add ID ${name} target is missing.`);
      control.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const rect = control.getBoundingClientRect();
      const points = [[0, 0], [-21, 0], [21, 0], [0, -21], [0, 21]];
      const hits = points.map(([dx, dy]) => {
        const hit = document.elementFromPoint(rect.left + rect.width / 2 + dx, rect.top + rect.height / 2 + dy);
        return !!hit && (hit === control || control.contains(hit));
      });
      const style = getComputedStyle(control);
      return {
        name, disabled: control.disabled,
        visible: !!control.offsetParent && style.visibility === "visible" && style.pointerEvents !== "none"
          && Number(style.opacity) > 0,
        offset: { width: control.offsetWidth, height: control.offsetHeight },
        rect: { width: Number(rect.width.toFixed(2)), height: Number(rect.height.toFixed(2)) },
        hitPoints: hits
      };
    });
    return targets;
  });
}

async function mutateOne(page, target) {
  const label = target === "preset" ? "select" : "input";
  await page.addStyleTag({ content: `[data-geometry-target="${target}"] ${target === "preset" ? "select" : "input"}{box-sizing:border-box!important;width:20px!important;min-width:20px!important;height:20px!important;min-height:20px!important;padding:0!important}` });
  const measured = await measureAddId(page);
  const item = measured.find((entry) => entry.name === target);
  const red = !item.visible || item.offset.width < 44 || item.offset.height < 44 || item.hitPoints.some((hit) => !hit);
  report(red, `MUTATION RED ${label} at this viewport`, JSON.stringify(item));
  await page.locator("style").last().evaluate((style) => style.remove());
}

try {
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const page = await browser.newPage({
      viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce",
      isMobile: width < 600, hasTouch: width < 600
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.locator('button[data-m="maker"]:visible').last().click();
    await page.getByRole("heading", { name: "Customer drift" }).waitFor();
    await page.getByRole("heading", { name: "Add ID" }).waitFor();

    const buttons = await measureButtons(page);
    report(buttons.every((item) => item.visible && item.offset.width >= 44 && item.offset.height >= 44
      && item.hitPoints.every(Boolean)), `${width}px Set/Clear native center and offset finger hits`,
    JSON.stringify(buttons));
    for (const button of ["Set drift for review", "Clear held drift"]) {
      await page.addStyleTag({ content: `.maker-drift-actions button[data-geometry-test="${button}"]{box-sizing:border-box!important;width:20px!important;min-width:20px!important;height:20px!important;min-height:20px!important;padding:0!important}` });
      const red = await page.evaluate((text) => {
        const button = [...document.querySelectorAll(".maker-drift-actions button")]
          .find((item) => item.textContent.trim() === text);
        button.dataset.geometryTest = text;
        return true;
      }, button);
      const mutated = await measureButtons(page);
      const item = mutated.find((entry) => entry.label === button);
      report(red && (!item.visible || item.offset.width < 44 || item.offset.height < 44 || item.hitPoints.some((hit) => !hit)),
        `MUTATION RED ${width}px ${button} tight CSS`, JSON.stringify(item));
      await page.locator("style").last().evaluate((style) => style.remove());
      await page.locator(`.maker-drift-actions button[data-geometry-test="${button}"]`)
        .evaluate((element) => element.removeAttribute("data-geometry-test"));
    }

    for (const role of ["customer", "reseller", "referral"]) {
      await prepareAddId(page, role);
      const targets = await measureAddId(page);
      report(targets.every((item) => !item.disabled && item.visible && item.offset.width >= 44 && item.offset.height >= 44
        && item.hitPoints.every(Boolean)), `${width}px ${role} Add ID preset/typed five-point finger hits`,
      JSON.stringify(targets));
    }
    for (const role of ["supplier", "downstream", "bucket"]) {
      await prepareAddId(page, role);
      const targets = await measureAddId(page);
      report(targets.every((item) => item.disabled), `${width}px ${role} Add ID starting drift is disabled`,
        JSON.stringify(targets));
    }

    await prepareAddId(page, "customer");
    await mutateOne(page, "preset");
    await mutateOne(page, "typed");
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

if (failures) process.exitCode = 1;
