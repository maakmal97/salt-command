/* test/admin-maintenance.mjs: HIS MAINTENANCE SWITCH ON SALT ADMIN (17 Nov 2026, his word: "a single control to Admin, maybe in Shop, to put it on
 * and off maintenance immediately. It asks for when it will be back up again"), re-aimed on 18 Nov 2026 to his word: "The maintenance guard is they
 * cannot sign in and notice is put outside, rather than complete block of the worker". Each check red under its own mutation
 * (test/admin-maintenance.mutations.json, run with tools/section.mjs). Every code, date and key here is invented.
 *   1  maintSet takes only a time later than now, rounded up to the minute, written without milliseconds
 *   2  /all/maker/maintenance files it on Counter KV `maint` with a lapse a day after, reads it back, lifts it on {off: true}; the hours read carries it;
 *      the test surface cannot reach it
 *   3  under the switch the Worker is NOT a block: the door pages and guest links, the service worker, manifest and icons are served as usual, the door
 *      carries the notice with its time, /all and the Desk's roads are never held nor read for the switch, a switch that cannot be read is read as on,
 *      and it lifts by itself and when turned off
 *   4  no customer signs in under it (password, link, hand-over code, remembered phone), a refused link and code are not spent, a wrong password is
 *      the door's one refusal, and an admin account signs in by each road
 *   5  a customer already signed in reads as usual, the account read and its poll carry `maint: true`, every write is refused and Log out is not; an
 *      admin account is held by none of it; with the switch off none of it applies
 *   6  MAINTENANCE_UNTIL, the deploy's complete block, still holds everything, the switch ignored
 *   7  Shop > Hours: Under maintenance is one Switch in its own group under Now; on, it asks Back at and Put it on sends {until}; filed, the Switch is on,
 *      the grey line says what it does, Change sends a new time and turning it off sends {off: true}
 *   8  filed, the bar's chip says Maintenance and Needs you carries its card
 *   9  the door page shows the notice; a refused sign-in puts it there; a page already signed in, told `maint: true`, has every control do nothing,
 *      says nothing and never reloads, and gives them back when the field is gone
 *  10  the hourly cron wakes no customer under the switch or MAINTENANCE_UNTIL */
import { webcrypto } from "node:crypto";
import { richOwnerPage, byAct } from "./maker-act.mjs";
import { Store } from "./maker-order-controls.mjs";

const t = (n) => (n ? n.textContent.replace(/\s+/g, " ").trim() : "");
const OWNER = { email: "maakmal97@icloud.com" };

export async function run({ ok, pageWork }) {
  const M = await import("../stmt/maintenance.js");
  const { handleMaker } = await import("../stmt/maker.js");
  const Worker = (await import("../stmt/worker.js")).default;
  const { mintSession } = await import("../stmt/orders.js");
  const { mintSignin, mintHandover, idOf, newSignin } = await import("../stmt/signin.js");

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

  /* ---- the Worker under the switch: accounts, sessions and roads, on a store that keeps a log of its reads ---- */
  const reads = [], store = new Store(), sget = store.get.bind(store);
  store.get = async (k, ...a) => { reads.push(k); return sget(k, ...a); };
  const C = await import("../tools/stmt-crypto.mjs");
  const password = "abcd-efgh-jkmn-pqrs", CUST = "cvsm-aaaa", ADM = "admm-aaaa";
  for (const [u, extra] of [[CUST, {}], [ADM, { admin: 1 }]]) {
    const ck = await C.contentKey("fixture-key", u);
    await store.put("u:" + u, JSON.stringify({ u, ...extra, verifier: await C.makeVerifier(password), wrap: await C.wrapKey(password, ck),
      env: await C.encryptWith(ck, JSON.stringify({ statements: [] })) }));
  }
  const wrap = { salt: "s", iv: "i", ct: "c" };
  const wenv = { STMT: store, STMT_HANDOVER_KEY: "handover-fixture-key", STMT_MASTER: "master-fixture" };
  const sCust = await mintSession(wenv, CUST, "password"), sAdm = await mintSession(wenv, ADM, "password");
  const wcall = (e, path, { method = "GET", session, body, accept, headers } = {}) => Worker.fetch(new Request("https://k7m3p2.example" + path, {
    method, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...(session ? { "X-Stmt-Session": session } : {}),
      ...(accept ? { accept } : {}), ...(headers || {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), e, { waitUntil() {} });
  const J = async (res) => { try { return await res.clone().json(); } catch (e) { return {}; } };
  const isMaint = async (res) => { const j = await J(res); return res.status === 503 && j.code === "maint" && /^Under maintenance\. Back /.test(j.error || "") && /^Back /.test((j.vars || {}).back || ""); };
  const realErr = console.error; console.error = () => {};
  const at = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(backMin));
  try {
    await store.put("maint", JSON.stringify({ until: backMin }));
    const tok = "L".repeat(32);

    /* ---- 3 ---- */
    const door = {}; for (const p of ["/", "/app", "/admin", "/s/" + tok]) door[p] = await wcall(wenv, p, { accept: "text/html" });
    const dbody = await door["/"].text();
    const noticeOn = (h) => /<div id="doorMaint"[^>]*role="status">/.test(h) && !/<div id="doorMaint"[^>]*hidden/.test(h) && h.includes("Under maintenance") && (h.includes("Back at " + at) || h.includes(" at " + at + "<"));
    const others = await Promise.all(["/g/abcdefghij", "/sw.js", "/manifest.webmanifest", "/icon.png", "/hours"].map((p) => wcall(wenv, p, { accept: "text/html" })));
    const guestOff = (await (async () => { const s2 = { STMT: new Store() }; return wcall(s2, "/g/abcdefghij", { accept: "text/html" }); })()).status;
    ok(Object.values(door).every((r) => r.status === 200) && noticeOn(dbody) && noticeOn(await door["/admin"].text()) && noticeOn(await door["/app"].text())
      && noticeOn(await door["/s/" + tok].text()) && others.every((r) => r.status !== 503) && others[0].status === guestOff && others[1].status === 200 && others[2].status === 200 && others[3].status === 200,
      "under the switch the Worker is no block: the door pages are served with the notice and its time, guest links, the service worker, manifest and icons as usual: "
      + JSON.stringify([Object.values(door).map((r) => r.status), others.map((r) => r.status), guestOff]));
    reads.length = 0;
    const machine = [await wcall(wenv, "/all", {}), await wcall(wenv, "/all/maker/hours", {}), await wcall(wenv, "/x", { headers: { "x-stmt-desk": "k" } })];
    ok(machine.every((r) => r.status !== 503) && !reads.includes("maint"),
      "Salt Admin and the Desk's roads are never held, and the switch is not read for them: " + JSON.stringify([machine.map((r) => r.status), reads.slice(0, 4)]));
    const broken = { STMT: { get: async () => { throw new Error("KV unavailable"); } } };
    const failPage = await Worker.fetch(new Request("https://k7m3p2.example/", { headers: { accept: "text/html" } }), broken, {}).catch((error) => ({ status: 0, thrown: error.message }));
    const failBody = failPage.status === 200 ? await failPage.text() : "";
    const failOpen = await Worker.fetch(new Request("https://k7m3p2.example/open", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ u: CUST, password }) }), { STMT: { ...store, get: async (k, ...a) => { if (k === "maint") throw new Error("KV"); return sget(k, ...a); }, put: store.put.bind(store), delete: store.delete.bind(store), list: store.list.bind(store) } }, {})
      .catch((error) => ({ status: 0, thrown: error.message }));
    ok(failPage.status === 200 && !/<div id="doorMaint"[^>]*hidden/.test(failBody) && /Back at \d\d:\d\d/.test(failBody) && (await isMaint(failOpen)),
      "a switch that cannot be read is read as on for a minute: the door carries the notice and a sign-in is refused, never a raw error and never open: "
      + JSON.stringify({ page: failPage.status, thrown: failPage.thrown, open: failOpen.status, openThrown: failOpen.thrown }));
    await store.put("maint", JSON.stringify({ until: new Date(Date.now() - 1000).toISOString() }));
    const lapsedDoor = await (await wcall(wenv, "/", { accept: "text/html" })).text(), lapsedOpen = await wcall(wenv, "/open", { method: "POST", body: { u: CUST, password } });
    await store.put("maint", JSON.stringify({ until: backMin }));
    await call("/all/maker/maintenance", "POST", { until: back });
    await call("/all/maker/maintenance", "POST", { off: true });
    const lifted = await call("/all/maker/maintenance", "POST", { off: true });
    ok(!noticeOn(lapsedDoor) && lapsedOpen.status === 200 && lifted.ok && lifted.maint === null && !kv.has("maint"),
      "once its time has passed the switch lifts by itself, the door's notice hidden and a customer signing in; turned off it lifts at once");
    await store.put("maint", JSON.stringify({ until: backMin }));

    /* ---- 4 ---- */
    const open = (u, pw) => wcall(wenv, "/open", { method: "POST", body: { u, password: pw } });
    const oc = await open(CUST, password), oa = await open(ADM, password), ow = await open(CUST, "wxyz-wxyz-wxyz-wxyz");
    const ja = await J(oa);
    ok(await isMaint(oc) && oa.status === 200 && !!ja.session && ja.admin === 1 && ow.status === 401 && (await J(ow)).code === "refused",
      "a customer's right password is refused for maintenance with its time, an admin account's opens a session, a wrong password is the door's one refusal: "
      + JSON.stringify([oc.status, oa.status, ow.status]));
    const lk = (u) => async () => { const k = newSignin(); await mintSignin(wenv, u, k, wrap); return k; };
    const kc = await lk(CUST)(), ka = await lk(ADM)();
    const lc = await wcall(wenv, "/open-link", { method: "POST", body: { token: kc } }), la = await wcall(wenv, "/open-link", { method: "POST", body: { token: ka } });
    const unspent = await store.get("ot:" + (await idOf(kc)), "json");
    ok(await isMaint(lc) && !!unspent && !unspent.spent && la.status === 200 && !!(await J(la)).session,
      "a customer's sign-in link is refused for maintenance and NOT spent, an admin account's link opens: " + JSON.stringify([lc.status, !!unspent && !unspent.spent, la.status]));
    const ho = async (u) => { const k = newSignin(); const m = await mintHandover(wenv, u, k, wrap); return { k, code: m.code }; };
    const hc = await ho(CUST), ha = await ho(ADM);
    const rc = await wcall(wenv, "/handover/open", { method: "POST", body: { code: hc.code } }), rk = await wcall(wenv, "/handover/open", { method: "POST", body: { token: hc.k } });
    const rcAgain = await wcall(wenv, "/handover/open", { method: "POST", body: { code: hc.code } });
    const ra = await wcall(wenv, "/handover/open", { method: "POST", body: { code: ha.code } }).catch(() => new Response("{}", { status: 500 }));
    ok(await isMaint(rc) && await isMaint(rk) && await isMaint(rcAgain) && ra.status === 200 && !!(await J(ra)).session,
      "a customer's hand-over code or key is refused for maintenance, twice over, so it was not spent; an admin account's opens: " + JSON.stringify([rc.status, rk.status, rcAgain.status, ra.status]));
    const rem = async (u, tk) => store.put("rem:" + (await idOf(tk)), JSON.stringify({ u, wrap, at: new Date().toISOString() }));
    const tc = "C".repeat(32), ta = "A".repeat(32);
    await rem(CUST, tc); await rem(ADM, ta);
    const mc = await wcall(wenv, "/remember/open", { method: "POST", body: { token: tc } }), ma = await wcall(wenv, "/remember/open", { method: "POST", body: { token: ta } });
    ok(await isMaint(mc) && !!(await store.get("rem:" + (await idOf(tc)))) && ma.status === 200 && !!(await J(ma)).session,
      "a remembered phone of a customer is refused for maintenance and stays remembered, an admin account's opens: " + JSON.stringify([mc.status, ma.status]));

    /* ---- 5 ---- */
    const acc = await wcall(wenv, "/account", { session: sCust }), stamp = await wcall(wenv, "/account/stamp", { session: sCust });
    const orders = await wcall(wenv, "/orders", { session: sCust }), thread = await wcall(wenv, "/thread", { session: sCust });
    const aj = await J(acc), sj = await J(stamp);
    ok(acc.status === 200 && aj.ok === true && aj.maint === true && stamp.status === 200 && sj.ok === true && sj.maint === true
      && orders.status !== 503 && thread.status === 200 && (await J(thread)).ok === true,
      "a customer signed in is left in: the account read and its poll answer and carry maint: true, their orders and thread read as usual: " + JSON.stringify([acc.status, aj.maint, stamp.status, sj.maint, orders.status, thread.status]));
    const writes = [["POST", "/orders", { size: 1 }], ["POST", "/account/claim", { amount: 1 }], ["POST", "/thread", { id: "m1", text: "hello" }], ["POST", "/quote", {}],
      ["POST", "/push/subscribe", {}], ["POST", "/handover", { token: newSignin(), wrap }], ["POST", "/pools/p20261101010101-ab/join", {}], ["POST", "/passkey/new", {}], ["POST", "/orders/20261101010101-ab/cancel", {}]];
    const refused = []; for (const [method, path, body] of writes) refused.push(await isMaint(await wcall(wenv, path, { method, session: sCust, body })));
    const lo = await wcall(wenv, "/logout", { method: "POST", session: sCust, body: {} });
    ok(refused.every(Boolean) && !(await isMaint(lo)) && lo.status === 200,
      "every write of a customer already in is refused for maintenance (order, claim, thread line, quote, push, hand-over, pool, passkey, withdrawal) and Log out is not: " + JSON.stringify([refused, lo.status]));
    const sCust2 = await mintSession(wenv, CUST, "password");
    const admAcc = await J(await wcall(wenv, "/account", { session: sAdm })), admW = await wcall(wenv, "/thread", { method: "POST", session: sAdm, body: { id: "m2", text: "hi" } });
    const assocRec = { u: "asam-aaaa", assoc: true }; await store.put("u:" + assocRec.u, JSON.stringify(assocRec));
    const sAssoc = await mintSession(wenv, assocRec.u, "password");
    const mine = [await wcall(wenv, "/my/refs", { method: "POST", session: sAssoc, body: {} }), await wcall(wenv, "/my/joins", { method: "POST", session: sAssoc, body: {} })];
    ok(admAcc.ok === true && admAcc.maint === undefined && !(await isMaint(admW)) && (await Promise.all(mine.map(isMaint))).every(Boolean),
      "an admin account's read carries no maint and its write is not refused for it, while an associate's own links cannot be minted under it: " + JSON.stringify([admAcc.maint, admW.status, mine.map((r) => r.status)]));
    await store.put("maint", JSON.stringify({ until: new Date(Date.now() - 1000).toISOString() }));
    const offAcc = await J(await wcall(wenv, "/account", { session: sCust2 })), offW = await wcall(wenv, "/thread", { method: "POST", session: sCust2, body: { id: "m3", text: "hello" } });
    const offOpen = await open(CUST, password);
    ok(offAcc.ok === true && offAcc.maint === undefined && !(await isMaint(offW)) && !(await isMaint(offOpen)) && offOpen.status === 200,
      "with the switch off none of it applies: no maint field, writes and sign-in as ever");
    await store.put("maint", JSON.stringify({ until: backMin }));

    /* ---- 6 ---- */
    const blockUntil = new Date(Date.now() + 5 * 3600e3).toISOString().replace(/\.\d{3}Z$/, "Z"), benv = { ...wenv, MAINTENANCE_UNTIL: blockUntil };
    await store.put("maint", "null");
    const blk = [await wcall(benv, "/", { accept: "text/html" }), await wcall(benv, "/admin", { accept: "text/html" }), await wcall(benv, "/open", { method: "POST", body: { u: ADM, password } }),
      await wcall(benv, "/account", { session: sAdm }), await wcall(benv, "/g/abcdefghij", { accept: "text/html" })];
    const jb = await blk[2].text(), allOk = await wcall(benv, "/x", { headers: { "x-stmt-desk": "k" } });
    ok(blk.every((r) => r.status === 503 && +r.headers.get("retry-after") > 5 * 3600 - 60) && jb === '{"ok":false,"error":"maintenance"}' && allOk.status !== 503
      && (await blk[0].text()).includes('<h1 class="amb-hero__title">Under maintenance</h1>'),
      "MAINTENANCE_UNTIL is still the complete block: the door, the admin door, every sign-in, a session's read and a guest link answer 503 whatever the switch, only the machine routes pass: " + JSON.stringify(blk.map((r) => r.status)));
    await store.put("maint", JSON.stringify({ until: backMin }));
  } finally { console.error = realErr; }

  /* ---- 7 ---- */
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
    ok(byAct(p.d, "maint.switch").checked === true && t(byAct(p.d, "maint.set")) === "Change"
      && /^Customers cannot sign in and see Under maintenance at the door, back .+Anyone already in can change nothing\..+Salt Admin stays open\.$/.test(foot),
      "filed, the Switch is on, the grey line says what it does and when it is back, and Change stands: " + foot);
    /* ---- 8 ---- */
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

  /* ---- 9 ---- */
  const { landingPage } = await import("../stmt/page.js");
  const CT = await import("../tools/stmt-crypto.mjs");
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const u = "abcd-efgh", pass = "fixture-pass-mt", ck = await CT.contentKey("test-secret", u), BUILD = "b".repeat(16);
  const stamped = { at: new Date(Date.now() - 3600e3).toISOString(), body: "<p>Live</p>", owed: 0, buildId: BUILD };
  const content = { ok: true, u, wrap: await CT.wrapKey(pass, ck), session: "sess-mt-abcdefghij", liveStatus: "current",
    live: Object.assign({ at: stamped.at, buildId: BUILD }, await CT.encryptWith(ck, JSON.stringify(stamped))),
    env: await CT.encryptWith(ck, JSON.stringify({ statements: [] })),
    prices: await CT.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), products: [], soon: [] })) };
  const st = { maint: false, navs: 0, refuse: false };
  const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => { if (/navigation/i.test(String(e && e.message))) st.navs++; });
  const html = (maint) => landingPage(u, "ncmt", null, undefined, undefined, maint).replace(/var POLL_MS=[0-9]+/, "var POLL_MS=60");
  const mkDom = (maint) => new JSDOM(html(maint), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      Object.defineProperty(win.document, "hidden", { configurable: true, value: false });
      win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = () => {};
      try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* none kept */ }
      win.fetch = async (path, init) => {
        const q = String(path), m = (init && init.method) || "GET";
        if (q === "/open" && st.refuse) return answer(503, { ok: false, error: "Under maintenance. Back at 14:30", code: "maint", vars: { back: "Back at 14:30" } });
        if (q === "/open" || q === "/account") return answer(200, st.maint ? { ...content, maint: true } : content);
        if (st.block) return answer(503, { ok: false, error: "maintenance" });
        if (q === "/account/stamp") return answer(200, { ok: true, liveStatus: "current", live: { at: stamped.at, buildId: BUILD }, prices: null, card: null, ...(st.maint ? { maint: true } : {}) });
        if (q === "/orders" && m === "GET") return answer(200, { ok: true, orders: [], claims: [] });
        if (m !== "GET" && st.maint) return answer(503, { ok: false, error: "Under maintenance. Back at 14:30", code: "maint", vars: { back: "Back at 14:30" } });
        return answer(404, { ok: false });
      };
    } });
  const until = async (f, n = 130) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
  let dom = mkDom("Back at 14:30");
  try {
    const d = dom.window.document, note = d.getElementById("doorMaint");
    const shownAtDoor = !!note && !note.hidden && /Under maintenance/.test(t(note)) && /Back at 14:30/.test(t(note));
    const plain = new JSDOM(html(""), { runScripts: "outside-only" }).window.document.getElementById("doorMaint");
    ok(shownAtDoor && !!plain && plain.hidden === true && !!d.getElementById("linkMaint") && !d.getElementById("linkMaint").hidden,
      "the door and the link page carry the notice with when it is back when the Worker hands it the sentence, and hold it hidden otherwise: " + t(note));
  } finally { dom.window.close(); }

  dom = mkDom("");
  try {
    const d = dom.window.document, note = d.getElementById("doorMaint");
    st.refuse = true;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    const shown = await until(() => !note.hidden);
    ok(shown && /Back at 14:30/.test(t(note)) && d.getElementById("tabs").hidden && !/Under maintenance\. Back/.test(t(d.getElementById("msg"))),
      "a sign-in refused for maintenance puts the notice at the door with its time and opens nothing: " + t(note));
  } finally { dom.window.close(); st.refuse = false; }

  dom = mkDom("");
  try {
    const d = dom.window.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    const in1 = await until(() => !d.getElementById("tabs").hidden);
    await new Promise((r) => setTimeout(r, 200));
    const tabs = [...d.querySelectorAll("#tabs .amb-tab, .amb-dock .amb-tab")], place = () => t(d.getElementById("placeT"));
    const first = place(), before = st.navs, textBefore = d.body.textContent.replace(/\s+/g, " ");
    st.maint = true;
    await new Promise((r) => setTimeout(r, 400));   /* the poll reads the stamp, which carries maint: true */
    const other = tabs.find((b) => !b.getAttribute("aria-current") && b.getAttribute("aria-selected") !== "true" && b.getAttribute("aria-pressed") !== "true") || tabs[1];
    other.click();
    await new Promise((r) => setTimeout(r, 120));
    const heldPlace = place();
    const textMaint = d.body.textContent.replace(/\s+/g, " ");
    const sheets = [...d.querySelectorAll("[role=dialog]")].filter((x) => !x.hidden).length;
    ok(in1 && tabs.length > 1 && heldPlace === first && st.navs === before && [...d.querySelectorAll(".mnote")].every((n) => n.hidden) && textMaint === textBefore && sheets === 0,
      "a page already signed in, told maint: true on its poll, makes its controls do nothing, never reloads and draws no word, banner or sheet: " + JSON.stringify({ in1, first, heldPlace, navs: st.navs - before, tabs: tabs.length }));
    st.maint = false;
    await new Promise((r) => setTimeout(r, 400));
    other.click();
    await new Promise((r) => setTimeout(r, 120));
    ok(place() !== first, "and the controls come back by themselves when the field is gone: " + first + " -> " + place());
  } finally { dom.window.close(); }

  /* ---- 9b: the COMPLETE BLOCK (MAINTENANCE_UNTIL) still opens an open page again on the maintenance page, once a minute at most ---- */
  st.block = false;
  dom = mkDom("");
  try {
    const d = dom.window.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    const in1 = await until(() => !d.getElementById("tabs").hidden);
    await new Promise((r) => setTimeout(r, 200));
    const before = st.navs;
    st.block = true;
    const reloaded = await until(() => st.navs > before);
    ok(in1 && before === 0 && reloaded, "a customer's page already open, answered maintenance by the complete block, opens again on the maintenance page: " + JSON.stringify({ in1, before, navs: st.navs }));
    /* the page here never really reloads, so it keeps asking and keeps being answered maintenance */
    await new Promise((r) => setTimeout(r, 600));
    ok(reloaded && st.navs === before + 1, "and it opens again once, not on every answer after: " + JSON.stringify({ navs: st.navs }));
  } finally { dom.window.close(); st.block = false; }

  /* ---- 10: the hourly cron wakes no customer while the Counter is under maintenance, and marks nothing, so the same slot wakes once it lifts ---- */
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
