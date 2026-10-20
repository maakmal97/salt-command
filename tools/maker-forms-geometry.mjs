/* Measure Record's forms in a real browser (Phase 4a, 12 Oct 2026): the pane beside the menu from 860px and the form in the menu's place below it, the option tiles,
 * the printed-size grid and the hours table; and prove a tight tile fails. Then (12 Oct 2026, his iPhone report that the bar of places was not at the foot on Record)
 * the bar of five places on every place, Record's four parts and each of its forms, at 375 and 768, Night and Tide: its bottom is the visible screen's bottom, it
 * spans the screen, the page does not scroll sideways and the last control clears it; each proved red under a rule that breaks it.
 *
 * Run: node tools/maker-forms-geometry.mjs   (no build needed: the page is served from stmt/page.js)
 * Playwright is loaded from SALT_PW or the local Salt DS tool environment; from a worktree, SALT_PW=C:/Users/maakm/Claude/Code/salt-ds/.ds-sync/node_modules.
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { landingPage } from "../stmt/page.js";
import { contentKey, wrapKey } from "./stmt-crypto.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PW_ROOT = process.env.SALT_PW || resolve(REPO, "..", "salt-ds", ".ds-sync", "node_modules");
const { chromium } = createRequire(join(PW_ROOT, "x.js"))("playwright");
const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", await contentKey("4".repeat(64), "maker-forms-geometry")) };
const catalog = {
  products: [{ product: "salt", saleReady: true, purchaseReady: true, tiered: true, drift: true, driftPresets: [{ name: "Gentle", value: 0.25 }] },
    { product: "oil", saleReady: true, purchaseReady: true, tiered: false, drift: false }],
  parties: ["CX1-ZED", "CX2-ZED", "SX1-ZED", "CA1-ZED"], associates: [{ code: "CA1-ZED", resaleReady: true }], tierNames: ["Ambassador", "Titanium", "Platinum", "Gold", "Silver"],
  tierCustomers: ["CX1-ZED"], tierCards: [], driftCustomers: ["CX1-ZED"], driftCards: [{ code: "CX1-ZED", product: "salt", held: true, value: 0.5, current: 0.1 }],
  loans: [{ rid: "loan-1", party: "CX1-ZED", remaining: 5, form: "cash" }],
  rows: [{ rid: "row-1", party: "CX1-ZED", product: "salt", date: "2026-09-01", qty: 2, total: 200, direction: "SELL" }],
  correctionFields: [{ field: "qty", kind: "number", required: true }, { field: "unpriced", kind: "boolean", required: true }, { field: "stream", kind: "stream", required: false }],
  appointmentCustomers: ["CX1-ZED"], appointmentKinds: [{ kind: "reseller", stream: "R2" }, { kind: "referral", stream: "R3" }],
  tips: [{ id: "dup:tip1", title: "A tip", hush: null }],
  houseBoards: { salt: { sizes: [0.5, 1, 2.5, 5, 10, 12.5], hidden: [2.5] }, oil: { sizes: [1, 5], hidden: [] } }
};
const hours = { ok: true, config: { schedule: { days: [null, { open: "09:00", close: "17:00" }, { open: "09:00", close: "17:00" }, null, null, null, null] }, manual: null }, status: { open: true, source: "schedule" } };
const html = landingPage("", "maker-forms-geometry", { master: "fixture-master", accounts: [] });
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  if (path === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); return; }
  const value = path === "/open" ? adminOpen : path === "/all/maker/inputs" ? { ok: true, products: ["salt", "oil"], catalog }
    : path === "/all/maker/review" ? { ok: true, orders: [], drafts: [], refused: [] } : path === "/all/maker/hours" ? hours
      : { ok: true, accounts: [], orders: [], drafts: [], refs: [], tiers: [] };
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
});
await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const { port } = server.address();
const browser = await chromium.launch(process.env.SALT_BROWSER ? { executablePath: process.env.SALT_BROWSER } : {});
let failures = 0;
const report = (condition, label, detail = "") => {
  console.log(`  ${condition ? "PASS" : "FAIL"} ${label}${detail ? ` | ${detail}` : ""}`);
  if (!condition) failures++;
};

/* the tiles of a form: each face at least 44px both ways, and the radio (or tick) over the whole tile so a tap anywhere on it lands on the control */
const tiles = (page, title, scope = "") => page.evaluate(([title, scope]) => {
  const form = [...document.querySelectorAll("#makerInputs .maker-input")].find((s) => s.querySelector("h3")?.textContent === title);
  if (!form || form.hidden || !form.offsetParent) return { error: "the form " + title + " is not showing" };
  const all = [...form.querySelectorAll(scope + " label.salt-option")].filter((n) => n.offsetParent);   /* a group a choice has not opened (the bands) is not on show */
  const bad = [];
  for (const t of all) {
    t.scrollIntoView({ block: "center", behavior: "instant" });
    const r = t.getBoundingClientRect(), face = t.querySelector(".salt-option__face").getBoundingClientRect(), input = t.querySelector("input");
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), edge = document.elementFromPoint(r.left + 4, r.top + 4);
    if (r.width < 44 || face.height < 44 || hit !== input || edge !== input) bad.push({ t: t.textContent, box: [Math.round(r.width), Math.round(face.height)], hit: hit && hit.tagName });
  }
  return { count: all.length, bad, overflow: document.documentElement.scrollWidth > innerWidth };
}, [title, scope]);

async function openForm(page, part, title) {
  await page.locator(`[data-act="${part}"]:visible`).first().click();
  if (await page.locator("#makerFormBack:visible").count()) await page.locator("#makerFormBack:visible").click();   /* below 860px a form open stands in the menu's place */
  const row = page.locator('[data-act="record.form"]:visible', { hasText: title }).first();
  await row.click();
  await page.waitForTimeout(150);
}

try {
  for (const [width, height] of [[1280, 900], [375, 812]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", isMobile: width < 600, hasTouch: width < 600 });
    await page.addInitScript(() => localStorage.setItem("salt-look", "tide"));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-act="nav.record"]:visible').last().click();
    await page.locator('[data-act="part.record.entry"]:visible').first().click();
    await page.waitForSelector('[data-act="record.form"]');
    const wide = width >= 860;

    /* the form opens in a pane beside the menu from 860px and in the menu's place below it */
    await openForm(page, "part.record.entry", "Sale or purchase");
    const layout = await page.evaluate(() => {
      const r = (s) => { const n = document.querySelector(s); if (!n || n.hidden) return null; const b = n.getBoundingClientRect(); return b.width ? { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right } : null; };
      const form = [...document.querySelectorAll("#makerInputs .maker-input")].find((s) => s.querySelector("h3")?.textContent === "Sale or purchase");
      const fr = form.getBoundingClientRect();
      return { list: r("#makerFormGrid .reclist"), pane: r("#makerFormGrid .recpane"), back: r("#makerFormBack"), form: { x: fr.x, w: fr.width, r: fr.right }, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    report(wide ? !!layout.list && !!layout.pane && layout.list.r <= layout.pane.x + 1 && !layout.back && layout.form.x >= layout.pane.x - 1 && layout.form.r <= layout.pane.r + 1
      : !layout.list && !!layout.pane && !!layout.back && layout.back.h >= 44 && layout.form.r <= width + 1 && layout.form.x >= -1,
    `${width}px the form open ${wide ? "stands in a pane beside the menu, with no way back" : "takes the menu's place, with a way back of 44px"}`, JSON.stringify(layout));
    report(!layout.overflow, `${width}px the page does not scroll sideways with the form open`);

    let t = await tiles(page, "Sale or purchase");
    report(!t.error && t.count >= 7 && t.bad.length === 0 && !t.overflow, `${width}px the sale's ${t.count} tiles are 44px and the radio covers each`, JSON.stringify(t));

    /* a tile that is too tight is found: the same measure under a 20px face is red */
    await page.addStyleTag({ content: ".salt-option__face{min-height:20px!important;height:20px!important;padding:0!important}" });
    t = await tiles(page, "Sale or purchase");
    report(t.error || t.bad.length > 0, `${width}px independent 20px tile mutation is red`, JSON.stringify(t.bad && t.bad.slice(0, 1)));
    await page.locator("style").last().evaluate((s) => s.remove());

    /* the printed sizes: a grid of tiles */
    await openForm(page, "part.record.pricing", "Printed sizes");
    t = await tiles(page, "Printed sizes", ".maker-sizes");
    const grid = await page.evaluate(() => {
      const g = document.querySelector(".maker-sizes .salt-options__grid"), tl = [...g.children].map((c) => c.getBoundingClientRect());
      const cols = new Set(tl.map((b) => Math.round(b.left))).size, pane = g.closest(".maker-input").getBoundingClientRect();
      return { cols, rows: new Set(tl.map((b) => Math.round(b.top))).size, inside: tl.every((b) => b.left >= pane.left - 1 && b.right <= pane.right + 1), n: tl.length };
    });
    report(!t.error && t.count === 6 && t.bad.length === 0 && !t.overflow && grid.cols >= 2 && grid.rows < grid.n && grid.inside,
      `${width}px the six printed sizes are a grid of 44px tiles in ${grid.cols} columns, inside the form`, JSON.stringify({ t, grid }));

    /* every form with choices to make: each of its tiles 44px and the radio over it */
    for (const [part, title, want] of [["part.record.entry", "Stock count", 2], ["part.record.entry", "Loan", 6], ["part.record.entry", "Gift", 5], ["part.record.entry", "Correct a row", 3],
      ["part.record.customers", "New customer", 8], ["part.record.customers", "Make an associate", 2], ["part.record.pricing", "Their %", 1], ["part.record.pricing", "Desk reminders", 3]]) {
      await openForm(page, part, title);
      const f = await tiles(page, title);
      report(!f.error && f.count >= want && f.bad.length === 0 && !f.overflow, `${width}px ${title}: its ${f.count} tiles are 44px with the radio over each`, JSON.stringify(f.error ? f : { count: f.count, bad: f.bad.slice(0, 2), overflow: f.overflow }));
    }

    /* the hours: the week chart (20 Oct 2026, canvas V63), a 44px row a day and, a day opened, its pickers and quick buttons, all inside the page */
    await page.locator('[data-act="nav.shop"]:visible').last().click();
    await page.locator('[data-act="part.shop.hours"]:visible').first().click();
    await page.waitForSelector("#makerSchedule .maker-week button.maker-day");
    await page.locator('#makerSchedule [data-act="hours.day"]').first().click();
    await page.waitForSelector("#makerSchedule .maker-dayedit select");
    const table = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll("#makerSchedule .maker-day, #makerSchedule .maker-dayedit select, #makerSchedule .maker-dayedit-acts button:not([hidden])")].map((n) => n.getBoundingClientRect());
      return { n: boxes.length, sizes: boxes.map((b) => [Math.round(b.width), Math.round(b.height)]), inside: boxes.every((b) => b.left >= 0 && b.right <= innerWidth),
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    report(table.n >= 13 && table.inside && !table.overflow && table.sizes.every(([w, h]) => w >= 44 && h >= 44),
      `${width}px the week chart's rows, pickers and quick buttons are 44px, inside the page`, JSON.stringify(table));
    const override = await page.evaluate(() => {
      const f = [...document.querySelectorAll("#makerSchedule fieldset.maker-tiles")][0], faces = [...f.querySelectorAll(".salt-option__face")].map((n) => Math.round(n.getBoundingClientRect().height));
      const u = document.querySelector('#makerSchedule input[type="datetime-local"]').getBoundingClientRect();
      return { faces, until: [Math.round(u.width), Math.round(u.height)], overflow: document.documentElement.scrollWidth > innerWidth };
    });
    report(override.faces.length === 2 && override.faces.every((h) => h >= 44) && override.until[1] >= 44 && !override.overflow, `${width}px the shop's two tiles and its Closed until field are 44px`, JSON.stringify(override));
    await page.close();
  }

  /* THE BAR AT THE FOOT. A fixed bar is laid out against the LAYOUT viewport and drawn on the VISIBLE one; they part when something is wider than the phone (the
     layout viewport grows to hold it, and the bar then stands off the foot), so the bar's bottom is read against both. Mobile and touch, or that never shows. */
  const foot = (page) => page.evaluate(() => {
    const bar = [...document.querySelectorAll("nav.salt-appbar")].find((b) => b.getBoundingClientRect().height > 0);
    if (!bar) return { error: "no bar is showing" };
    window.scrollTo(0, document.documentElement.scrollHeight);
    const r = bar.getBoundingClientRect(), v = window.visualViewport;
    let low = 0;
    for (const n of document.querySelectorAll("#roster button, #roster input, #roster select, #roster textarea, #roster a")) {
      if (bar.contains(n) || n.closest("[hidden], #oAdd") || !n.getClientRects().length) continue;
      low = Math.max(low, n.getBoundingClientRect().bottom);
    }
    return { bottom: r.bottom, left: r.left, right: r.right, seen: v.offsetTop + v.height, ih: innerHeight, iw: innerWidth, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, html: document.documentElement.getBoundingClientRect().height, clear: r.top - low };
  });
  /* IN THE SAVED APP (his iPhone, 12 Oct 2026: a fixed bar stood 20pt and 55pt above the foot on short places, never on a long one, never in Safari) the document is the
     whole screen tall at least, and a short place scrolls by no more than a pixel. The page marks itself from navigator.standalone, which is set here as the phone sets it. */
  const SHORT = ["start", "needs", "orders", "customers", "record", "record/approve"];
  const atFoot = (m, app = false, label = "") => !m.error && Math.abs(m.bottom - m.seen) <= 1 && Math.abs(m.bottom - m.ih) <= 1 && Math.abs(m.left) <= 1 && Math.abs(m.right - m.iw) <= 1 && m.sw <= m.iw && m.clear >= 0
    && (!app || (m.html >= m.ih - 1 && (!SHORT.includes(label) || m.sh - m.ih <= 1)));
  for (const app of [false, true]) for (const theme of ["night", "tide"]) for (const [width, height] of [[375, 812], [768, 1024]]) {
    const where = `${app ? "saved app " : ""}${theme} ${width}x${height}`;
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", isMobile: true, hasTouch: true });
    await page.addInitScript((t) => localStorage.setItem("salt-look", t), theme);
    if (app) await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true, configurable: true }));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    const views = [], look = async (label) => { await page.waitForTimeout(120); views.push([label, await foot(page)]); };
    await look("start");
    for (const place of ["needs", "orders", "customers", "record", "shop"]) {
      await page.locator(`[data-act="nav.${place}"]:visible`).last().click();
      await look(place);
    }
    await page.locator('[data-act="nav.record"]:visible').last().click();
    for (const part of ["approve", "entry", "customers", "pricing"]) {
      await page.locator(`[data-act="part.record.${part}"]:visible`).first().click();
      await look(`record/${part}`);
      const rows = page.locator('[data-act="record.form"]:visible');
      for (let i = 0, n = await rows.count(); i < n; i++) {
        if (await page.locator("#makerFormBack:visible").count()) await page.locator("#makerFormBack:visible").click();   /* a form open stands in the menu's place */
        const row = rows.nth(i), title = (await row.textContent()).replace(/Open$/, "").trim();
        await row.click();
        await look(`record/${part}/${title}`);
      }
    }
    const off = views.filter(([label, m]) => !atFoot(m, app, label));
    report(views.length >= 27 && off.length === 0, `${where}: the bar's bottom is the screen's bottom on all ${views.length} views, and nothing covers it or scrolls past it${app ? "; the document is the screen tall and a short place does not scroll" : ""}`,
      JSON.stringify(off.length ? off.slice(0, 2) : views.find(([label]) => label === "record")[1]));
    /* the same measure under a rule that breaks it is red: the bar lifted off the foot, and a page wider than the phone */
    for (const [name, css, place] of [["a lifted bar", ".salt-appbar{bottom:24px!important}", "record"], ["a page wider than the phone", "#oRecord{min-width:1200px!important}", "record"],
      ...(app ? [["a document shorter than the screen", "html[data-app] body{min-height:0!important}", "needs"]] : [])]) {
      await page.locator(`[data-act="nav.${place}"]:visible`).last().click();
      const style = await page.addStyleTag({ content: css });
      await page.waitForTimeout(250);
      const m = await foot(page);
      report(!atFoot(m, app, place), `${where} independent mutation (${name}) is red`, JSON.stringify(m));
      await style.evaluate((s) => s.remove());
    }
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
}

if (failures) process.exitCode = 1;
