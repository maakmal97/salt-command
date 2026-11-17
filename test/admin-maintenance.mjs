/* test/admin-maintenance.mjs: HIS MAINTENANCE SWITCH ON SALT ADMIN (17 Nov 2026, his word: "a single control to Admin, maybe in Shop, to put it on
 * and off maintenance immediately. It asks for when it will be back up again"). Each check red under its own mutation
 * (test/admin-maintenance.mutations.json, run with tools/section.mjs). Every code, date and key here is invented.
 *   1  maintSet takes only a time later than now, rounded up to the minute, written without milliseconds
 *   2  /all/maker/maintenance files it on Counter KV `maint` with a lapse a day after, reads it back, lifts it on {off: true}; the hours read carries it;
 *      the test surface cannot reach it
 *   3  the Counter Worker holds a customer's page and a customer's request on the switch alone, says its time, never holds /all or reads the switch for it,
 *      takes the later of the switch and MAINTENANCE_UNTIL, and lifts by itself once the time has passed
 *   4  Shop > Hours: Under maintenance is one Switch in its own group under Now; on, it asks Back at and Put it on sends {until}; filed, the Switch is on,
 *      the grey line says when, Change sends a new time and turning it off sends {off: true}
 *   5  filed, the bar's chip says Maintenance and Needs you carries its card
 *   6  a customer's page already open, answered maintenance, opens again (on the maintenance page) */
import { webcrypto } from "node:crypto";
import { richOwnerPage, byAct } from "./maker-act.mjs";

const t = (n) => (n ? n.textContent.replace(/\s+/g, " ").trim() : "");
const OWNER = { email: "maakmal97@icloud.com" };

export async function run({ ok, pageWork }) {
  const M = await import("../stmt/maintenance.js");
  const { handleMaker } = await import("../stmt/maker.js");
  const Worker = (await import("../stmt/worker.js")).default;

  /* ---- 1 ---- */
  const now = Date.parse("2026-11-17T03:00:00Z");
  const set = (until, extra) => M.maintSet(extra ? { until, ...extra } : { until }, now);
  ok(set("2026-11-17T06:30:00.000Z").until === "2026-11-17T06:30:00Z" && set("2026-11-17T14:30:20+08:00").until === "2026-11-17T06:31:00Z"
    && set("2026-11-17T03:00:30Z").until === "2026-11-17T03:01:00Z" && !!set("2026-11-17T03:00:00Z").error && !!set("2026-11-17T02:00:00Z").error && !set("2027-11-17T03:00:00Z").error
    && !!set("soon").error && !!set("2026-11-17").error && !!set("2026-11-17T06:30:00Z", { x: 1 }).error && !!M.maintSet({ until: 5 }, now).error,
    "the switch takes only a time later than now, rounded up to the minute, with no milliseconds: "
    + JSON.stringify([set("2026-11-17T06:30:00.000Z"), set("2026-11-17T14:30:20+08:00"), set("2026-11-17T03:00:30Z"), set("2027-11-17T03:00:00Z")]));

  /* ---- 2 ---- */
  const kv = new Map(), opts = new Map(), log = [];
  const STMT = { get: async (k, type) => { log.push(k); const v = kv.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; },
    put: async (k, v, o) => { kv.set(k, v); opts.set(k, o || null); }, delete: async (k) => { kv.delete(k); } };
  const env = { STMT };
  const call = async (path, method, body, test) => (await handleMaker(new Request("https://counter.test" + path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }),
    env, path, OWNER, test ? { test: true } : {})).json();
  const back = new Date(Date.now() + 2 * 3600e3 + 20e3).toISOString(), backMin = new Date(Math.ceil(Date.parse(back) / 60000) * 60000).toISOString().replace(".000Z", "Z");
  const off0 = await call("/all/maker/maintenance", "GET");
  const put = await call("/all/maker/maintenance", "POST", { until: back });
  const lapse = opts.get("maint") && opts.get("maint").expiration;
  const read = await call("/all/maker/maintenance", "GET"), hours = await call("/all/maker/hours", "GET");
  const bad = await call("/all/maker/maintenance", "POST", { until: new Date(Date.now() - 60e3).toISOString() });
  const viaTest = await call("/all/maker/maintenance", "POST", { until: back }, true);
  ok(off0.ok && off0.maint === null && put.ok && put.maint.until === backMin && JSON.parse(kv.get("maint")).until === backMin
    && lapse === Math.ceil(Date.parse(backMin) / 1000) + 86400 && read.maint.until === backMin && hours.ok && hours.maint && hours.maint.until === backMin
    && bad.ok === false && /later than now/.test(bad.error) && viaTest.ok === false,
    "Put it on files {until} on Counter KV maint, lapsing a day after, read back by the switch and the hours; a past time is refused, the test surface reaches nothing: "
    + JSON.stringify({ put, read, hours: hours.maint, bad, viaTest }));

  /* ---- 3 ---- */
  const req = (p, h) => new Request("https://k7m3p2.example" + p, { headers: h || {} });
  const go = (p, h, e) => Worker.fetch(req(p, h), e || env, {});
  const held = async (p, h, e) => { try { const x = await go(p, h, e); return x.status === 503 && x.headers.has("retry-after"); } catch (err) { return false; } };
  const pg = await go("/", { accept: "text/html" }), body = await pg.text(), js = await go("/orders", { accept: "application/json" });
  const at = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(backMin));
  ok(pg.status === 503 && +pg.headers.get("retry-after") > 7000 && pg.headers.get("cache-control") === "no-store" && body.includes('<h1 class="amb-hero__title">Under maintenance</h1>')
    && (body.includes('<p class="amb-hero__sub">Back at ' + at + "</p>") || body.includes(" at " + at + "</p>"))
    && js.status === 503 && (await js.text()) === '{"ok":false,"error":"maintenance"}',
    "on the switch alone the Worker holds a customer's page, saying when it is back, and a customer's request: " + JSON.stringify(body.replace(/<style>[\s\S]*?<\/style>/, "").slice(-120)));
  const opening = await go("/open", { accept: "application/json" });
  ok(opening.status === 503 && (await opening.text()) === '{"ok":false,"error":"maintenance"}',
    "the switch also holds the customer's sign-in and statement road");
  log.length = 0;
  const adminHeld = await held("/all", {}) || await held("/all/maker/hours", {}) || await held("/x", { "x-stmt-desk": "k" });
  ok(!adminHeld && !log.includes("maint"), "Salt Admin and the Desk's roads are never held, and the switch is not read for them: " + JSON.stringify(log));
  const broken = { STMT: { get: async () => { throw new Error("KV unavailable"); } } };
  const failPage = await Worker.fetch(req("/", { accept: "text/html" }), broken, {}).catch((error) => ({ status: 0, thrown: error.message }));
  const failBody = failPage.status === 503 ? await failPage.text() : "";
  const failRetry = failPage.status === 503 ? +failPage.headers.get("retry-after") : -1;
  ok(failPage.status === 503 && failRetry >= 1 && failRetry <= 60 && failBody.includes('<h1 class="amb-hero__title">Under maintenance</h1>'),
    "a switch that cannot be read holds the request for a minute on the maintenance page, never a raw error and never open: "
    + JSON.stringify({ status: failPage.status, thrown: failPage.thrown, retry: failRetry }));
  const envLater = { STMT, MAINTENANCE_UNTIL: new Date(Date.now() + 5 * 3600e3).toISOString().replace(/\.\d{3}Z$/, "Z") };
  const envSooner = { STMT, MAINTENANCE_UNTIL: new Date(Date.now() + 600e3).toISOString().replace(/\.\d{3}Z$/, "Z") };
  const later = await go("/orders", { accept: "application/json" }, envLater), sooner = await go("/orders", { accept: "application/json" }, envSooner);
  ok(+later.headers.get("retry-after") > 5 * 3600 - 60 && +sooner.headers.get("retry-after") > 7000,
    "where both stand, the later holds: " + JSON.stringify([later.headers.get("retry-after"), sooner.headers.get("retry-after")]));
  kv.set("maint", JSON.stringify({ until: new Date(Date.now() - 1000).toISOString() }));
  ok(!await held("/", { accept: "text/html" }), "once its time has passed the switch lifts by itself");
  await call("/all/maker/maintenance", "POST", { until: back });
  const lifted = await call("/all/maker/maintenance", "POST", { off: true });
  ok(lifted.ok && lifted.maint === null && !kv.has("maint") && !await held("/", { accept: "text/html" }), "turned off, it lifts at once");

  /* ---- 4 ---- */
  const LATER = new Date(Date.now() + 3 * 3600e3).toISOString().replace(/\.\d{3}Z$/, "Z");
  const open = async (maint) => {
    const p = await richOwnerPage({ pageWork, hours: (j) => ({ ...j, maint }),
      extra: (route, b) => (route !== "/all/maker/maintenance" ? undefined : { ok: true, maint: b && b.until ? { until: b.until.replace(/\.\d{3}Z$/, "Z") } : null }) });
    await p.work.quiet();
    p.tap = async (act, key) => { const c = byAct(p.d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    return p;
  };
  let p = await open(null);
  try {
    await p.tap("nav.shop"); await p.tap("part.shop.hours");
    const card = p.d.getElementById("makerNowCard"), groups = card ? [...card.querySelectorAll(".amb-settings")] : [];
    const mg = groups.find((g) => t(g.querySelector("h3.amb-settings__head")) === "Maintenance"), sw = byAct(p.d, "maint.switch");
    ok(!!mg && groups.indexOf(mg) === 1 && t(groups[0].querySelector("h3.amb-settings__head")) === "Now" && !!sw && mg.contains(sw) && sw.classList.contains("amb-switch")
      && sw.getAttribute("role") === "switch" && sw.checked === false && !byAct(p.d, "maint.until") && !byAct(p.d, "maint.set") && /Customers can use the Counter/.test(t(mg.querySelector(".amb-settings__foot"))),
      "Under maintenance is one Switch, off, in its own group under Now, with nothing under it: " + groups.map((g) => t(g.querySelector("h3"))).join(" | "));
    await p.tap("maint.switch");
    const until = byAct(p.d, "maint.until"), go1 = byAct(p.d, "maint.set");
    ok(byAct(p.d, "maint.switch").checked === true && !!until && until.type === "datetime-local" && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(until.value)
      && t(until.closest(".amb-setting").querySelector(".amb-setting__name")) === "Back at" && t(go1) === "Put it on" && go1.classList.contains("amb-pill")
      && !p.posts.some((y) => y.route === "/all/maker/maintenance"),
      "turned on, it asks Back at, a day and a time, and Put it on, sending nothing yet");
    until.value = "2099-03-04T14:30"; until.dispatchEvent(new p.w.Event("change", { bubbles: true }));
    await p.tap("maint.set");
    const sent = p.posts.filter((y) => y.route === "/all/maker/maintenance");
    ok(sent.length === 1 && JSON.stringify(sent[0].body) === JSON.stringify({ until: "2099-03-04T06:30:00.000Z" }) && byAct(p.d, "maint.switch").checked === true
      && t(byAct(p.d, "maint.set")) === "Change" && /Under maintenance until/.test(t(p.d.getElementById("makerHoursMessage"))),
      "Put it on sends when it is back, read in Kuala Lumpur, and the Switch stands on: " + JSON.stringify(sent.map((y) => y.body)) + " " + t(p.d.getElementById("makerHoursMessage")));
  } finally { p.dom.window.close(); }

  p = await open({ until: LATER });
  try {
    await p.tap("nav.shop"); await p.tap("part.shop.hours");
    const foot = t([...p.d.querySelectorAll("#makerNowCard .amaint .amb-settings__foot")][0]);
    ok(byAct(p.d, "maint.switch").checked === true && t(byAct(p.d, "maint.set")) === "Change" && /^Customers see Under maintenance, back .+Salt Admin stays open\.$/.test(foot),
      "filed, the Switch is on, the grey line says when it is back, and Change stands: " + foot);
    /* ---- 5 ---- */
    const chip = p.d.getElementById("aBarHours");
    await p.tap("nav.needs");
    const need = p.d.querySelector('[data-need="w:maint"]');
    ok(!!chip && !chip.hidden && /^Maintenance to /.test(t(chip)) && !!need && /Under maintenance until/.test(t(need)),
      "filed, the bar's chip says Maintenance and Needs you carries its card: " + t(chip) + " | " + t(need));
    await p.tap("nav.shop"); await p.tap("part.shop.hours");
    await p.tap("maint.switch");
    const offs = p.posts.filter((y) => y.route === "/all/maker/maintenance");
    ok(offs.length === 1 && JSON.stringify(offs[0].body) === JSON.stringify({ off: true }) && byAct(p.d, "maint.switch").checked === false && !byAct(p.d, "maint.until")
      && /Maintenance off/.test(t(p.d.getElementById("makerHoursMessage"))),
      "turning the Switch off sends {off: true} at once and folds it: " + JSON.stringify(offs.map((y) => y.body)));
  } finally { p.dom.window.close(); }

  /* ---- 6 ---- */
  const { landingPage } = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const u = "abcd-efgh", pass = "fixture-pass-mt", ck = await C.contentKey("test-secret", u), BUILD = "b".repeat(16);
  const stamped = { at: new Date(Date.now() - 3600e3).toISOString(), body: "<p>Live</p>", owed: 0, buildId: BUILD };
  const content = { ok: true, u, wrap: await C.wrapKey(pass, ck), session: "sess-mt-abcdefghij", liveStatus: "current",
    live: Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))),
    env: await C.encryptWith(ck, JSON.stringify({ statements: [] })),
    prices: await C.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), products: [], soon: [] })) };
  const st = { maint: false, navs: 0 };
  const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { if (/navigation/i.test(String(e && e.message))) st.navs++; });
  const dom = new JSDOM(landingPage(u, "ncmt", null).replace(/var POLL_MS=[0-9]+/, "var POLL_MS=60"), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      Object.defineProperty(win.document, "hidden", { configurable: true, value: false });
      win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = () => {};
      try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* none kept */ }
      win.fetch = async (path, init) => {
        const q = String(path), m = (init && init.method) || "GET";
        if (q === "/open" || q === "/account") return answer(200, content);
        if (st.maint) return answer(503, { ok: false, error: "maintenance" });
        if (q === "/orders" && m === "GET") return answer(200, { ok: true, orders: [], claims: [] });
        return answer(404, { ok: false });
      };
    } });
  const until = async (f, n = 130) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  try {
    const d = dom.window.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    const in1 = await until(() => !d.getElementById("tabs").hidden);
    await new Promise((r) => setTimeout(r, 200));
    const before = st.navs;
    st.maint = true;
    const reloaded = await until(() => st.navs > before);
    ok(in1 && before === 0 && reloaded, "a customer's page already open, answered maintenance, opens again on the maintenance page: " + JSON.stringify({ in1, before, navs: st.navs }));
    /* the page here never really reloads, so it keeps asking and keeps being answered maintenance */
    await new Promise((r) => setTimeout(r, 600));
    ok(reloaded && st.navs === before + 1, "and it opens again once, not on every answer after: " + JSON.stringify({ navs: st.navs }));
  } finally { dom.window.close(); }

  /* ---- 7: the hourly cron wakes no customer while the Counter is held, and marks nothing, so the same slot wakes once it lifts ---- */
  const { done, ago, kl } = await import("./counter-b-kit.mjs");
  const { endpointId } = await import("../stmt/push.js");
  const vp = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const ckv = new Map();
  const CSTMT = { get: async (k, type) => { const v = ckv.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; },
    put: async (k, v) => { ckv.set(k, v); }, delete: async (k) => { ckv.delete(k); },
    list: async ({ prefix = "" } = {}) => ({ keys: [...ckv.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
  const cenv = { STMT: CSTMT, STMT_VAPID_PUBLIC_KEY: "maint-public", STMT_VAPID_SUBJECT: "mailto:a@b.test",
    STMT_VAPID_PRIVATE_JWK: JSON.stringify(await webcrypto.subtle.exportKey("jwk", vp.privateKey)) };
  const CU = "wxyz-abcd", ep = "https://push.example/" + CU;
  ckv.set("push:" + CU + ":" + await endpointId(ep), JSON.stringify({ endpoint: ep, at: new Date().toISOString() }));
  ckv.set("order:" + CU + ":20261101010101-mt1", JSON.stringify(done("20261101010101-mt1", ago(24 * 3), { u: CU, moved: 1, movedOn: kl(-3), paid: 0, total: 100 })));
  const slotAt = Date.parse(kl(2) + "T02:00:00Z"), ahead = new Date(slotAt + 3600e3).toISOString().replace(/\.\d{3}Z$/, "Z");   /* 10:00 in Kuala Lumpur */
  const realFetch = globalThis.fetch, realLog = console.log;
  let wakes = 0;
  const tick = async (e) => {
    const w = []; wakes = 0;
    await Worker.scheduled({ cron: "0 * * * *", scheduledTime: slotAt }, e, { waitUntil: (p) => w.push(p) }); await Promise.all(w);
    return wakes;
  };
  globalThis.fetch = async (url, init) => (String(url).startsWith("https://push.example/") ? (wakes++, new Response("", { status: 201 })) : realFetch(url, init));
  console.log = () => {};
  try {
    ckv.set("maint", JSON.stringify({ until: ahead }));
    const underSwitch = await tick(cenv);
    ckv.delete("maint");
    const underEnv = await tick({ ...cenv, MAINTENANCE_UNTIL: ahead });
    const lifted7 = await tick(cenv);
    console.log = realLog;
    ok(underSwitch === 0 && lifted7 === 1, "under his switch the cron wakes no customer and marks nothing, so the same slot wakes once it lifts: " + JSON.stringify({ underSwitch, lifted7 }));
    ok(underEnv === 0 && lifted7 === 1, "and under MAINTENANCE_UNTIL the same: " + JSON.stringify({ underEnv, lifted7 }));
  } finally { globalThis.fetch = realFetch; console.log = realLog; }
}
