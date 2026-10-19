#!/usr/bin/env node
/* perf-baseline.mjs: how fast the Desk, the Counter and QR Command answer, measured in Chromium on this PC.
 *
 * Each surface is served on 127.0.0.1 from this checkout (the Desk's public/, the Counter's real stmt/page.js with
 * the heaviest account's real live statement sealed under a fixture key, as the counter-render skill does, and QR
 * Command's public/ from its own checkout), then opened at three profiles:
 *   laptop  1440x900,  no throttling
 *   tablet  820x1180,  touch, CPU 2x slower, 30 Mbps / 20 ms
 *   phone   390x844,   touch and mobile, CPU 4x slower, 9 Mbps down / 1.5 up / 60 ms (DevTools' Fast 4G)
 * and measured: a cold open (no cache, no service worker), a warm open (the service worker installed, as the
 * saved app opens), and every tap between places, each tap timed from the trusted input to the next painted
 * frame (Event Timing) and, where no control is on screen, from the call to the next frame.
 * The Desk's freshness is measured too: /rev starts answering a new id and the clock runs until the new page draws.
 *
 * LAB FIGURES, NOT FIELD ONES. Throttling scales this PC's CPU; a real phone's is its own. Nothing here signs in to
 * a live site or touches KV: the live round trips are read by curl in the report's own step. Roster codes only.
 *
 *   node tools/perf-baseline.mjs [--label base] [--runs 3] [--only desk,counter,qr] [--profiles laptop,tablet,phone]
 *        [--qr <qr-command checkout>]   (default ../qr-command beside this repo, or QR_REPO)
 * Writes test/_perf/<label>/results.json and prints one line a measure. Exit 0 done, 2 could not run. */
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join, extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { gzipSync, brotliCompressSync } from "node:zlib";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i < 0 ? d : args[i + 1]; };
const LABEL = opt("label", "base"), RUNS = +opt("runs", 3);
const ONLY = String(opt("only", "desk,counter,qr")).split(",");
const QR = resolve(opt("qr", process.env.QR_REPO || resolve(REPO, "..", "qr-command")));
const PW_ROOT = process.env.SALT_PW || "C:/Users/maakm/Claude/Code/salt-ds/.ds-sync/node_modules";
const die = (m) => { console.error("perf-baseline: " + m); process.exit(2); };
let chromium; try { chromium = createRequire(join(PW_ROOT, "x.js"))("playwright").chromium; } catch { die("no playwright under " + PW_ROOT); }

const ALL_PROFILES = {
  laptop: { w: 1440, h: 900, cpu: 1, net: null, touch: false, mobile: false },
  tablet: { w: 820, h: 1180, cpu: 2, net: { latency: 20, down: 30e6 / 8, up: 15e6 / 8 }, touch: true, mobile: false },
  phone: { w: 390, h: 844, cpu: 4, net: { latency: 60, down: 9e6 / 8, up: 1.5e6 / 8 }, touch: true, mobile: true },
};
const PROFILES = String(opt("profiles", "laptop,tablet,phone")).split(",").map((k) => [k, ALL_PROFILES[k]]);
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".css": "text/css",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

/* ---------- the page-side recorder, installed before any script of the page ---------- */
const RECORDER = () => {
  const P = (window.__perf = { lcp: 0, cls: 0, long: [], events: [], fcp: 0 });
  const on = (type, fn, extra) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe(Object.assign({ type, buffered: true }, extra || {})); } catch {} };
  on("paint", (e) => { if (e.name === "first-contentful-paint") P.fcp = e.startTime; });
  on("largest-contentful-paint", (e) => { P.lcp = e.startTime; });
  on("layout-shift", (e) => { if (!e.hadRecentInput) P.cls += e.value; });
  on("longtask", (e) => { P.long.push([Math.round(e.startTime), Math.round(e.duration)]); });
  on("event", (e) => { P.events.push({ n: e.name, t: e.startTime, d: e.duration, id: e.interactionId || 0,
    delay: e.processingStart - e.startTime, work: e.processingEnd - e.processingStart }); }, { durationThreshold: 16 });
};
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/* ---------- static servers ---------- */
/* Text goes brotli-compressed when the browser asks, as Cloudflare sends it from both Workers (read back live 19 Oct 2026:
   the Counter's door answers Content-Encoding: br), so the throttled profiles carry what a phone really downloads. */
const BR = new Map();
function send(req, res, status, headers, body) {
  body = typeof body === "string" ? Buffer.from(body) : body;
  if (/^(text\/|application\/(json|manifest))/.test(headers["content-type"] || "") && /\bbr\b/.test(req.headers["accept-encoding"] || "") && body.length > 1024) {
    const k = body.length + ":" + body.subarray(0, 64).toString("hex") + body.subarray(-64).toString("hex");
    if (!BR.has(k)) BR.set(k, brotliCompressSync(body));
    body = BR.get(k); headers = Object.assign({}, headers, { "content-encoding": "br", vary: "accept-encoding" });
  }
  res.writeHead(status, headers); res.end(body);
}
function serveDir(root, routes) {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    req.resume();
    const hit = routes && routes(p, req);
    if (hit) return send(req, res, hit.status || 200, Object.assign({ "content-type": hit.type || "application/json", "cache-control": "no-store" }, hit.headers || {}), hit.body);
    if (p.endsWith("/")) p += "index.html";
    const f = resolve(root, "." + p);
    if (!f.startsWith(root) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    send(req, res, 200, { "content-type": MIME[extname(f)] || "application/octet-stream" }, readFileSync(f));
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, origin: "http://127.0.0.1:" + srv.address().port })));
}

/* ---------- the surfaces ---------- */
async function deskSurface() {
  const PUB = resolve(REPO, "public");
  const id = JSON.parse(readFileSync(join(PUB, "rev.json"), "utf8")).id;
  const state = { rev: id };
  const API = /^\/(queue|vault|bio|bye|menu|qr|drafts|push|orders|stmt-users|draft-now|bulletin|slips|pins|threads|ledger|hush|expected|geo)(\/|$)/;
  const s = await serveDir(PUB, (p) => {
    if (p === "/" || p === "/desk") return { type: "text/html", body: readFileSync(join(PUB, "desk.html")) };
    if (p === "/rev" || p === "/rev.json") return { body: JSON.stringify({ id: state.rev }) };
    if (p === "/queue/ping") return { body: '{"ok":true,"cloud":true}' };   /* the cloud desk: its /rev poll runs */
    if (API.test(p)) return { status: 401, body: '{"error":"locked"}' };   /* no write key here, as a phone before its key is set */
    return null;
  });
  return { name: "desk", ...s, state, url: s.origin + "/", bytes: readFileSync(join(PUB, "desk.html")),
    look: "tide",
    ready: () => !!document.querySelector(".rail .tab[data-s]") && typeof window.switchTab === "function",
    places: () => {
      const views = (typeof VIEWS !== "undefined" ? VIEWS : []);
      const out = []; views.forEach((v) => { out.push({ k: v.id, sel: '.rail .tab[data-s="' + v.id + '"]', call: v.lead }); v.parts.forEach((p) => out.push({ k: p, call: p })); });
      return out;
    },
    go: (call) => { switchTab(call); },
  };
}

async function counterSurface() {
  const R = (p) => import(pathToFileURL(join(REPO, p)).href);
  const MS = await R("tools/make_statements.mjs"), { landingPage } = await R("stmt/page.js"), { FONTS } = await R("stmt/fonts.js");
  const CS = await R("tools/stmt-crypto.mjs");
  const users = JSON.parse(readFileSync(join(REPO, "statements", "_users.json"), "utf8"));
  const codes = Object.keys(users.users || users).filter((c) => !c.startsWith("_"));
  const AT = new Date(), u = "abcd-efgh", pass = "abcd-efgh-jkmn-pqrs";
  /* the heaviest live statement: the worst case a customer's phone opens */
  let doc = null, code = null;
  for (const c of codes) { let d; try { d = MS.liveStatement(c, AT, u); } catch { continue; } if (d && (!doc || d.body.length > doc.body.length)) { doc = d; code = c; } }
  if (!doc) die("no live statement to draw");
  const ck = await CS.contentKey("perf-baseline-fixture", u);
  const prices = { at: AT.toISOString(), week: { label: "fixture week", monday: AT.toISOString().slice(0, 10) }, soon: [],
    products: [{ product: "salt", unit: "unit", basis: "tier", tier: null, sizes: [{ q: 0.5, price: 60 }, { q: 1, price: 110 }, { q: 2.5, price: 250 }] },
      { product: "oil", unit: "unit", basis: "board", tier: null, sizes: [{ q: 1, price: 45 }] }] };
  const open = { ok: true, u, wrap: await CS.wrapKey(pass, ck), session: "sess-fixture",
    env: await CS.encryptWith(ck, JSON.stringify({ v: 1, issued: "2026-09-01", statements: [] })), liveStatus: "fixture",
    live: Object.assign({ at: doc.at }, await CS.encryptWith(ck, JSON.stringify(doc))),
    prices: Object.assign({ at: prices.at, week: prices.week.monday }, await CS.encryptWith(ck, JSON.stringify(prices))) };
  const html = landingPage(u, "n0", null, null);
  const s = await serveDir(join(REPO, "test", "_perf", "_none"), (p, req) => {   /* every path is answered below: no file of the repo is served */
    if (req.method === "GET" && (p === "/" || p === "/app")) return { type: "text/html", body: html };
    if (p.startsWith("/fonts/") && Object.prototype.hasOwnProperty.call(FONTS, p.slice(7))) return { type: "font/woff2", body: Buffer.from(FONTS[p.slice(7)], "base64"), headers: { "cache-control": "max-age=31536000" } };
    if (p.startsWith("/open")) return { body: JSON.stringify(open) };
    if (p === "/orders") return { body: JSON.stringify({ ok: true, orders: [], claims: [] }) };
    if (p === "/account") return { body: JSON.stringify({ ok: true, devices: [] }) };
    return { body: '{"ok":true}' };
  });
  return { name: "counter", ...s, url: s.origin + "/", bytes: Buffer.from(html), code, docBytes: doc.body.length,
    signin: { u, pass },
    ready: () => [...document.querySelectorAll('button[data-t="stmt"]')].some((x) => x.getBoundingClientRect().width > 0),
    places: () => [...new Set([...document.querySelectorAll("button[data-t]")].map((b) => b.getAttribute("data-t")))]
      .map((t) => ({ k: t, sel: 'button[data-t="' + t + '"]' })),
    go: null,
  };
}

async function qrSurface() {
  const PUB = join(QR, "public");
  if (!existsSync(join(PUB, "index.html"))) die("no QR Command public/ under " + QR + " (pass --qr)");
  const s = await serveDir(PUB, (p) => (p === "/state.json" ? { body: "{}" } : null));
  const js = ["index.html", "app.js", "app.css", "data.js", "marks.js", "qr-art.js", "qrcode.js"].map((f) => readFileSync(join(PUB, f)));
  return { name: "qr", ...s, url: s.origin + "/", bytes: Buffer.concat(js),
    ready: () => document.querySelectorAll("#grid > *").length > 0,
    places: () => [...document.querySelectorAll("#grid > *")].slice(0, 4).map((e, i) => ({ k: "tile" + (i + 1), sel: "#grid > *:nth-child(" + (i + 1) + ")", back: "#back" })),
    go: null,
  };
}

/* ---------- one open ---------- */
async function cdpThrottle(page, prof) {
  const c = await page.context().newCDPSession(page);
  await c.send("Emulation.setCPUThrottlingRate", { rate: prof.cpu });
  await c.send("Network.enable");
  if (prof.net) await c.send("Network.emulateNetworkConditions", { offline: false, latency: prof.net.latency, downloadThroughput: prof.net.down, uploadThroughput: prof.net.up });
  return c;
}

async function metrics(page, t0ready) {
  return page.evaluate((ready) => {
    const P = window.__perf, n = performance.getEntriesByType("navigation")[0] || {};
    const res = performance.getEntriesByType("resource");
    const tbt = P.long.filter(([s]) => s >= P.fcp).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    return { ttfb: Math.round(n.responseStart || 0), fcp: Math.round(P.fcp), lcp: Math.round(P.lcp), dcl: Math.round(n.domContentLoadedEventEnd || 0),
      load: Math.round(n.loadEventEnd || 0), ready: Math.round(ready), tbt: Math.round(tbt), longTasks: P.long.length,
      longest: P.long.reduce((a, [, d]) => Math.max(a, d), 0), cls: +P.cls.toFixed(3),
      wire: Math.round(((n.transferSize || 0) + res.reduce((a, r) => a + (r.transferSize || 0), 0)) / 1024),
      docKB: Math.round((n.decodedBodySize || 0) / 1024), requests: res.length + 1,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      nodes: document.getElementsByTagName("*").length, scrollW: document.documentElement.scrollWidth, viewW: innerWidth };
  }, t0ready);
}

async function waitReady(page, S) {
  await page.waitForFunction(S.ready, null, { timeout: 120000, polling: "raf" });
  return page.evaluate(() => performance.now());
}

async function signIn(page, S) {
  if (!S.signin) return null;
  await page.waitForSelector("#un", { timeout: 60000 });
  await page.fill("#un", S.signin.u); await page.fill("#pw", S.signin.pass);
  const t = await page.evaluate(() => performance.now());
  await page.locator("#f").evaluate((f) => f.requestSubmit());
  await page.waitForFunction(S.ready, null, { timeout: 60000, polling: "raf" });
  return Math.round((await page.evaluate(() => performance.now())) - t);
}

async function taps(page, S) {
  const out = [];
  const list = await page.evaluate(S.places);
  for (const pl of list) {
    let r = null;
    const visible = pl.sel ? await page.evaluate((sel) => { const e = [...document.querySelectorAll(sel)].find((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(x).visibility !== "hidden"; }); return !!e; }, pl.sel) : false;
    if (visible) {
      const mark = await page.evaluate(() => performance.now());
      await page.locator(pl.sel).filter({ visible: true }).first().click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      r = await page.evaluate((m) => {
        const ev = window.__perf.events.filter((e) => e.t >= m - 1 && /^(pointerdown|pointerup|click|mousedown|mouseup)$/.test(e.n));
        if (!ev.length) return { inp: 16, delay: 0, work: 0, via: "click" };   /* under the 16 ms threshold: one frame */
        const w = ev.reduce((a, e) => (e.d > a.d ? e : a));
        return { inp: Math.round(w.d), delay: Math.round(w.delay), work: Math.round(ev.reduce((a, e) => a + e.work, 0)), via: "click" };
      }, mark);
      const lt = await page.evaluate((m) => window.__perf.long.filter(([s]) => s >= m).reduce((a, [, d]) => Math.max(a, d), 0), mark);
      r.longest = lt;
      if (pl.back) { await page.locator(pl.back).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); }
    } else if (pl.call && S.go) {
      r = await page.evaluate(async ([go, call]) => {
        const f = new Function("call", "return (" + go + ")(call)");
        const t = performance.now(); f(call);
        await new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));
        return { inp: Math.round(performance.now() - t), delay: 0, work: null, via: "call" };
      }, [S.go.toString(), pl.call]);
      await page.waitForTimeout(300);
    }
    if (r) out.push(Object.assign({ place: pl.k }, r));
  }
  return out;
}

async function openOnce(browser, S, [pk, prof], warm) {
  if (process.env.PERF_TRACE) console.log("  open " + S.name + " " + pk + (warm ? " warm" : " cold"));
  const ctx = await browser.newContext({ viewport: { width: prof.w, height: prof.h }, deviceScaleFactor: prof.mobile ? 3 : prof.touch ? 2 : 1,
    hasTouch: prof.touch, isMobile: prof.mobile, userAgent: prof.mobile ? IPHONE : undefined, serviceWorkers: "allow" });
  await ctx.addInitScript(RECORDER);
  if (S.look) await ctx.addInitScript((t) => { try { localStorage.setItem("salt-look", t); } catch {} }, S.look);
  else await ctx.addInitScript(() => { try { localStorage.setItem("salt-look", "tide"); } catch {} });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  if (warm) {   /* install the service worker on a first, unmeasured open, then measure the next */
    await page.goto(S.url, { waitUntil: "load", timeout: 120000 });
    /* a page with no service worker on this road (the Counter registers one only for alerts) never resolves ready: give it 5 s */
    await page.evaluate(() => Promise.race([new Promise((r) => setTimeout(r, 5000)),
      navigator.serviceWorker ? navigator.serviceWorker.ready.then(() => new Promise((r) => setTimeout(r, 500))) : null].filter(Boolean))).catch(() => {});
  }
  await cdpThrottle(page, prof);
  await page.goto(S.url, { waitUntil: "load", timeout: 180000 });
  const sw = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
  if (process.env.PERF_TRACE) console.log("  loaded");
  const signinMs = await signIn(page, S);
  const readyAt = await waitReady(page, S);
  await page.waitForTimeout(1500);
  const m = await metrics(page, readyAt);
  return { ctx, page, m: Object.assign(m, { signinMs, sw, errors: errors.length }) };
}

const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const medObj = (list) => { const o = {}; for (const k of Object.keys(list[0])) o[k] = typeof list[0][k] === "number" ? med(list.map((x) => x[k])) : list[0][k]; return o; };

async function deskFreshness(browser, S, prof) {
  const { ctx, page } = await openOnce(browser, S, prof, false);
  const T0 = Date.now(); S.state.rev = "f".repeat(16);
  const nav = page.waitForEvent("framenavigated", { timeout: 40000 }).then(() => Date.now()).catch(() => null);
  const seen = await nav;
  let drawn = null;
  if (seen) { await page.waitForFunction(S.ready, null, { timeout: 120000, polling: "raf" }).catch(() => {}); drawn = Date.now(); }
  S.state.rev = JSON.parse(readFileSync(join(REPO, "public", "rev.json"), "utf8")).id;
  await ctx.close();
  return { reloadAfterMs: seen && seen - T0, drawnAfterMs: drawn && drawn - T0 };
}

/* ---------- run ---------- */
const OUT = resolve(REPO, "test", "_perf", LABEL); mkdirSync(OUT, { recursive: true });
const results = { label: LABEL, at: new Date().toISOString(), commit: null, runs: RUNS, profiles: Object.fromEntries(PROFILES), surfaces: {} };
try { results.commit = execSync("git rev-parse --short HEAD", { cwd: REPO, encoding: "utf8" }).trim(); } catch {}
const browser = await chromium.launch();
try {
  for (const name of ONLY) {
    const S = name === "desk" ? await deskSurface() : name === "counter" ? await counterSurface() : name === "qr" ? await qrSurface() : die("unknown surface " + name);
    const R = results.surfaces[name] = { payload: { rawKB: Math.round(S.bytes.length / 1024), gzipKB: Math.round(gzipSync(S.bytes).length / 1024), brotliKB: Math.round(brotliCompressSync(S.bytes).length / 1024) }, profiles: {} };
    if (S.code) R.account = { code: S.code, statementKB: Math.round(S.docBytes / 1024) };
    for (const P of PROFILES) {
      const cold = [], warm = []; let tapList = null;
      for (let i = 0; i < RUNS; i++) {
        const c = await openOnce(browser, S, P, false); cold.push(c.m);
        if (i === 0) tapList = await taps(c.page, S);
        await c.ctx.close();
        const w = await openOnce(browser, S, P, true); warm.push(w.m); await w.ctx.close();
      }
      const row = R.profiles[P[0]] = { cold: medObj(cold), warm: medObj(warm), taps: tapList };
      if (name === "desk") row.freshness = await deskFreshness(browser, S, P);
      const c = row.cold, w = row.warm, worst = tapList.reduce((a, t) => (t.inp > a.inp ? t : a), { inp: 0 });
      console.log(`${name.padEnd(8)}${P[0].padEnd(7)} cold fcp ${c.fcp} lcp ${c.lcp} ready ${c.ready} tbt ${c.tbt} ${c.signinMs != null ? "signin " + c.signinMs + " " : ""}| warm ready ${w.ready} sw ${w.sw} | taps ${tapList.length}, median ${med(tapList.map((t) => t.inp))} ms, worst ${worst.inp} ms (${worst.place || "-"})${row.freshness ? " | rev seen " + row.freshness.reloadAfterMs + " drawn " + row.freshness.drawnAfterMs : ""} | width ${c.scrollW}/${c.viewW} | errors ${c.errors}`);
    }
    S.srv.close();
  }
} finally { await browser.close(); }
writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log("wrote " + join(OUT, "results.json"));
