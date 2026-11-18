/* test/admin-door.mjs: THE WAY INTO SALT ADMIN IS THE COUNTER'S OWN DOOR (his word of 17 Nov 2026; stmt/admins.js).
 *
 * An admin is an ordinary Counter account whose code is an admin code and whose tier (1 the owner, 2 staff) is filed in
 * statements/_admins.json. Each check observes the real roads (the Counter Worker in node, the publish's plan, the customer's page
 * in jsdom) and was proved red by its own mutation (test/admin-door.mutations.json). Every code, username and password is invented.
 *   1  the admins file is checked: an admin code's shape, a tier of 1 or 2, one owner at most
 *   2  the publish marks an admin account's tier on its record in the clear, and no other account's
 *   3  /admin/enter: no session 401, a customer 403, staff 403 "not set up", the owner a key for this browser, set as an HttpOnly
 *      cookie on /all alone and filed only as its hash, with a pointer under the account so Sign out everywhere ends it
 *   4  ADMIN_DOOR off: /all opens on Access alone, as before
 *   5  ADMIN_DOOR on: Access alone is sent to the Counter's door (/all) or refused (every road under it); the key alone is refused;
 *      both open; an account no longer the owner's loses the door
 *   6  an admin account trades nothing: Place, a claim and a quote are refused it, and a customer's are not
 *   7  Leave ends the key and clears the cookie
 *   8  the page: This device carries Salt Admin for an admin account and not for a customer; at /admin an admin account goes on by
 *      itself, and staff are told it is not set up yet */
import { webcrypto } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import counter from "../stmt/worker.js";
import { Store } from "./maker-order-controls.mjs";
import { mintSession } from "../stmt/orders.js";
import { adminMap, ADMIN_COOKIE, ADMIN_CODE_RE } from "../stmt/admins.js";
import { idOf, devPrefix } from "../stmt/signin.js";

const BUILD = "d".repeat(16);

export async function run({ ok, pageWork }) {
  /* ---- 1 ---- */
  {
    const bad = [["a customer code", { "CA10-KUL": 1 }], ["tier 3", { "AA10-KUL": 3 }], ["a tier as text", { "AA10-KUL": "1" }],
      ["two owners", { "AA10-KUL": 1, "AB7-PJ": 1 }], ["a list", ["AA10-KUL"]]];
    const refused = bad.filter(([, v]) => { try { adminMap(v); return false; } catch (e) { return true; } });
    const good = adminMap({ "AA10-KUL": 1, "AB7-PJ": 2, "AC4-SEN": 2 });
    ok(refused.length === bad.length && good["AA10-KUL"] === 1 && good["AB7-PJ"] === 2,
      "the admins file takes admin codes at tier 1 or 2 with one owner, and refuses " + refused.map((b) => b[0]).join(", "));
  }

  /* ---- 2 ---- */
  {
    const { planPublish } = await import("../tools/stmt-publish.mjs");
    const root = mkdtempSync(join(tmpdir(), "admin-door-"));
    try {
      mkdirSync(join(root, "2026-09", "_kv"), { recursive: true });
      const rec = (u) => ({ u, issued: "2026-09-01", wrap: { salt: "s", iv: "i", ct: "c" }, env: { iv: "i", ct: "c" } });
      for (const u of ["aaaa-bbbb", "cccc-dddd", "eeee-ffff"]) writeFileSync(join(root, "2026-09", "_kv", u + ".json"), JSON.stringify(rec(u)));
      writeFileSync(join(root, "_users.json"), JSON.stringify({ "AX9-ZZZ": "aaaa-bbbb", "AY3-QQ": "cccc-dddd", "CX9-ZZZ": "eeee-ffff" }));
      writeFileSync(join(root, "_admins.json"), JSON.stringify({ "AX9-ZZZ": 1, "AY3-QQ": 2 }));
      const plan = await planPublish(root, null, new Date(), [], null, null, null, {});
      const put = (u) => JSON.parse((plan.puts.find((x) => x.key === "u:" + u) || { value: "{}" }).value);
      ok(put("aaaa-bbbb").admin === 1 && put("cccc-dddd").admin === 2 && put("eeee-ffff").admin === undefined,
        "the publish marks the owner's record tier 1 and staff's tier 2, and a customer's not at all: " + JSON.stringify([put("aaaa-bbbb").admin, put("cccc-dddd").admin, put("eeee-ffff").admin]));
      writeFileSync(join(root, "_admins.json"), JSON.stringify({ "AY3-QQ": 2 }));
      let missingTier = false;
      try { await planPublish(root, null, new Date(), [], null, null, null, {}); } catch (e) { missingTier = /has no tier/.test(e.message); }
      writeFileSync(join(root, "_admins.json"), JSON.stringify({ "AX9-ZZZ": 1, "AY3-QQ": 2, "AZ2-QQ": 2 }));
      let missingUser = false;
      try { await planPublish(root, null, new Date(), [], null, null, null, {}); } catch (e) { missingUser = /has no account/.test(e.message); }
      writeFileSync(join(root, "_admins.json"), JSON.stringify({ "AX9-ZZZ": 1, "AY3-QQ": 2 }));
      rmSync(join(root, "2026-09", "_kv", "aaaa-bbbb.json"));
      let missingRecord = false;
      try { await planPublish(root, null, new Date(), [], null, null, null, {}); } catch (e) { missingRecord = /no publishable account record/.test(e.message); }
      ok(missingTier && missingUser && missingRecord,
        "publish refuses an admin code without a tier, a tier without an account, and an account without a publishable record");
    } finally { rmSync(root, { recursive: true, force: true }); }
  }

  /* ---- 2b: the keyed publish, as CI runs it (sealed under an invented key), seals nothing of the book for an admin code ---- */
  {
    const { planPublish } = await import("../tools/stmt-publish.mjs");
    const { pricingSnapshot } = await import("../tools/book.mjs");
    const { openMaster } = await import("../tools/payload.mjs");
    const C = await import("../tools/stmt-crypto.mjs");
    const { w } = await openMaster();
    const snap = pricingSnapshot(w);
    const realUsers = JSON.parse(readFileSync(new URL("../statements/_users.json", import.meta.url), "utf8"));
    const cust = Object.keys(realUsers).find((c) => !ADMIN_CODE_RE.test(c) && snap.byProduct.salt.cards && snap.byProduct.salt.cards[c]);
    const ADM = "AA10-KUL", admU = "awna-aaaa", custU = realUsers[cust], pw = "abcd-efgh-jkmn-pqrs", fixKey = "fixture-key-2b";
    const build = async (withAdmin) => {
      const root = mkdtempSync(join(tmpdir(), "admin-door-k-"));
      try {
        mkdirSync(join(root, "2026-09", "_kv"), { recursive: true });
        const users = { [cust]: custU }; if (withAdmin) users[ADM] = admU;
        writeFileSync(join(root, "_users.json"), JSON.stringify(users));
        if (withAdmin) writeFileSync(join(root, "_admins.json"), JSON.stringify({ [ADM]: 1 }));
        for (const u of Object.values(users)) {
          const ck = await C.contentKey(fixKey, u);
          writeFileSync(join(root, "2026-09", "_kv", u + ".json"), JSON.stringify({ u, issued: "2026-09-01", verifier: await C.makeVerifier(pw),
            wrap: await C.wrapKey(pw, ck), env: await C.encryptWith(ck, JSON.stringify({ statements: [] })) }));
        }
        const cards = { [cust]: { at: "x", rows: [] }, [ADM]: { at: "x", rows: [] } };
        const plan = await planPublish(root, fixKey, new Date("2026-09-03T06:20:00Z"), [], null, snap, null, { buildId: "d".repeat(16), cards });
        const rec = async (u) => {
          const p = plan.puts.find((x) => x.key === "u:" + u); if (!p) return null;
          const v = JSON.parse(p.value), ck = await C.contentKey(fixKey, u), open = async (x) => (x ? JSON.parse(await C.decryptWith(ck, x)) : null);
          return { v, live: await open(v.live), prices: await open(v.prices), card: await open(v.card) };
        };
        return { admin: withAdmin ? await rec(admU) : null, cust: await rec(custU) };
      } finally { rmSync(root, { recursive: true, force: true }); }
    };
    const [a, b] = [await build(true), await build(false)];
    const strip = (r) => JSON.stringify({ k: Object.keys(r.v).sort(), live: r.live, prices: r.prices, card: r.card });
    ok(!!a.admin && a.admin.v.admin === 1 && !a.admin.v.prices && !a.admin.v.card && !a.admin.v.live && !!a.admin.v.env && !!a.admin.v.wrap,
      "the keyed publish carries an admin code's account bundle and tier 1, and seals it no price list, card or live statement: " + (a.admin ? Object.keys(a.admin.v).join(",") : "no record"));
    ok(!!a.cust.prices && !!a.cust.card && strip(a.cust) === strip(b.cust),
      "and a customer's sealed live statement, price list and card in the same keyed run read the same with the admin there as without it");
  }

  /* ---- the Worker ---- */
  const store = new Store(), team = "door-fixture", audience = "door-audience", kid = "door-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const envOff = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "door-local-master", ADMIN_DOOR: "" };
  const envOn = Object.assign({}, envOff, { ADMIN_DOOR: "1" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected door fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email: "maakmal97@icloud.com",
      exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const jwt = header + "." + claims + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", signing.privateKey,
      new TextEncoder().encode(header + "." + claims))).toString("base64url");
    const call = (env, path, { method = "GET", session, access, cookie, body } = {}) => counter.fetch(new Request("https://counter.fixture.test" + path, {
      method, redirect: "manual", headers: { "content-type": "application/json", ...(session ? { "X-Stmt-Session": session } : {}), ...(access ? { "cf-access-jwt-assertion": jwt } : {}),
        ...(cookie ? { cookie: ADMIN_COOKIE + "=" + cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env, { waitUntil() {} });
    const OWNER = "awna-aaaa", STAFF = "stfa-aaaa", CUST = "cusa-aaaa";
    const cryptoTools = await import("../tools/stmt-crypto.mjs");
    const password = "abcd-efgh-jkmn-pqrs", content = await cryptoTools.contentKey("fixture-key", OWNER);
    const ownerRecord = { u: OWNER, admin: 1, verifier: await cryptoTools.makeVerifier(password),
      wrap: await cryptoTools.wrapKey(password, content), env: await cryptoTools.encryptWith(content, JSON.stringify({ statements: [] })) };
    await store.put("u:" + OWNER, JSON.stringify(ownerRecord));
    await store.put("u:" + STAFF, JSON.stringify({ u: STAFF, admin: 2 }));
    await store.put("u:" + CUST, JSON.stringify({ u: CUST }));
    const open = await call(envOff, "/open", { method: "POST", body: { u: OWNER, password } });
    const opened = await open.json();
    let sOwner = opened.session;
    const sStaff = await mintSession(envOff, STAFF, "password"), sCust = await mintSession(envOff, CUST, "password");

    /* ---- 3 ---- */
    const enter = (session) => call(envOff, "/admin/enter", { method: "POST", session, body: {} });
    const [none, cust, staff, own] = [await enter(null), await enter(sCust), await enter(sStaff), await enter(sOwner)];
    const [jc, js] = [await cust.json(), await staff.json()];
    const set = own.headers.get("set-cookie") || "", key = (/^salt_adm=([A-Za-z0-9_-]{32});/.exec(set) || [])[1] || "";
    const filed = key ? await store.get("adm:" + (await idOf(key)), "json") : null;
    const raw = [...store.values.keys()].some((k) => key && k.includes(key)) || [...store.values.values()].some((v) => key && String(v).includes(key));
    const ptr = [...store.values.keys()].filter((k) => k.startsWith(devPrefix(OWNER))).map((k) => JSON.parse(store.values.get(k))).find((p) => /^adm:/.test(p.key));
    ok(none.status === 401 && cust.status === 403 && jc.code === "adminNot" && staff.status === 403 && js.code === "adminStaff" && own.status === 200
      && /; Path=\/all;/.test(set) && /HttpOnly/.test(set) && /Secure/.test(set) && /SameSite=Lax/.test(set) && !!filed && filed.u === OWNER && filed.tier === 1 && !raw && !!ptr,
      "/admin/enter gives the owner's session alone a key, an HttpOnly cookie on /all filed only as its hash with a pointer under the account; no session, a customer and staff are refused: "
      + JSON.stringify([none.status, cust.status, jc.code, staff.status, js.code, own.status, set.replace(key, "<key>"), !!filed, raw, !!ptr]));
    const otherWays = [];
    for (const how of ["remembered", "link", "passkey", "handover"]) {
      const session = await mintSession(envOff, OWNER, how);
      otherWays.push((await enter(session)).status);
    }
    ok(open.status === 200 && !!sOwner && opened.adminLabel === "Salt Admin" && otherWays.every((status) => status === 401),
      "only the owner's password open can mint an admin key, not remembered, link, passkey or handover sessions: " + JSON.stringify(otherWays));
    const failing = new Store(), envFail = Object.assign({}, envOff, { STMT: failing });
    await failing.put("u:" + OWNER, JSON.stringify({ u: OWNER, admin: 1 }));
    const failSession = await mintSession(envFail, OWNER, "password");
    const put = failing.put.bind(failing);
    failing.put = async (k, ...args) => { if (k.startsWith(devPrefix(OWNER))) throw new Error("pointer unavailable"); return put(k, ...args); };
    let pointerFailed = false;
    try { await call(envFail, "/admin/enter", { method: "POST", session: failSession, body: {} }); } catch (e) { pointerFailed = true; }
    ok(pointerFailed && ![...failing.values.keys()].some((k) => k.startsWith("adm:")),
      "a failed revocation pointer cannot issue an admin key");

    /* ---- 4 ---- */
    const offPage = await call(envOff, "/all", { access: true });
    ok(offPage.status === 200 && /text\/html/.test(offPage.headers.get("content-type") || ""), "with ADMIN_DOOR off, /all opens on Access alone as before: " + offPage.status);

    /* ---- 5 ---- */
    const accessOnly = await call(envOn, "/all", { access: true }), keyOnly = await call(envOn, "/all", { cookie: key }), both = await call(envOn, "/all", { access: true, cookie: key });
    const retry = await call(envOn, "/all?from=admin", { access: true });
    const subAccess = await call(envOn, "/all/test/admin", { access: true }), subBoth = await call(envOn, "/all/test/admin", { access: true, cookie: key });
    const staffKey = "S".repeat(32);
    await store.put("adm:" + (await idOf(staffKey)), JSON.stringify({ u: STAFF, tier: 2 }));
    const staffDoor = await call(envOn, "/all", { access: true, cookie: staffKey });
    ok(accessOnly.status === 302 && accessOnly.headers.get("location") === "/admin" && keyOnly.status === 401 && both.status === 200
      && subAccess.status === 401 && subBoth.status === 200 && staffDoor.status === 302,
      "with ADMIN_DOOR on, Access alone goes to the Counter's door or is refused under /all, the key alone is refused, both open, and staff's key opens nothing: "
      + JSON.stringify([accessOnly.status, accessOnly.headers.get("location"), keyOnly.status, both.status, subAccess.status, subBoth.status, staffDoor.status]));
    ok(retry.status === 302 && retry.headers.get("location") === "/admin?retry=1",
      "a return from a failed admin entry reaches a retry page instead of looping");
    await store.put("u:" + OWNER, JSON.stringify({ u: OWNER }));
    const demoted = await call(envOn, "/all", { access: true, cookie: key });
    await store.put("u:" + OWNER, JSON.stringify(ownerRecord));
    ok(demoted.status === 302, "an account taken off the owner's tier loses the door at once, its key still filed: " + demoted.status);
    const everywhere = await call(envOn, "/all/signout", { method: "POST", access: true, cookie: key, body: { u: OWNER } });
    const afterEverywhere = await call(envOn, "/all", { access: true, cookie: key });
    ok(everywhere.status === 200 && afterEverywhere.status === 302 && !(await store.get("adm:" + (await idOf(key)))),
      "Sign out everywhere removes the admin grant as well as the password session");
    const reopen = await call(envOff, "/open", { method: "POST", body: { u: OWNER, password } });
    sOwner = (await reopen.json()).session;
    const fresh = await enter(sOwner);
    const freshKey = (/^salt_adm=([A-Za-z0-9_-]{32});/.exec(fresh.headers.get("set-cookie") || "") || [])[1];

    /* ---- 6 ---- */
    const trade = async (s) => Promise.all(["/orders", "/account/claim", "/quote"].map(async (p) => {
      const r = await call(envOff, p, { method: "POST", session: s, body: {} }); return [r.status, (await r.json()).code];
    }));
    const tOwn = await trade(sOwner), tCust = await trade(sCust);
    ok(tOwn.every(([st, c]) => st === 403 && c === "adminTrade") && tCust.every(([, c]) => c !== "adminTrade"),
      "an admin account places, claims and quotes nothing, and a customer's same requests are not refused for it: " + JSON.stringify([tOwn, tCust]));

    /* ---- 7 ---- */
    const left = await call(envOn, "/all/leave", { method: "POST", cookie: freshKey });
    const after = await call(envOn, "/all", { access: true, cookie: freshKey });
    ok(left.status === 200 && /Max-Age=0/.test(left.headers.get("set-cookie") || "") && !(await store.get("adm:" + (await idOf(freshKey)))) && after.status === 302
      && ![...store.values.keys()].some((k) => k.startsWith(devPrefix(OWNER)) && /^adm:/.test(JSON.parse(store.values.get(k)).key)),
      "Leave ends the key, its pointer and the cookie, and /all sends him back to the door: " + JSON.stringify([left.status, after.status]));
    /* ---- 9: twelve hours on one sign-in (his word of 18 Nov 2026) ---- */
    const mint = async () => {
      const o = await call(envOff, "/open", { method: "POST", body: { u: OWNER, password } });
      const s = (await o.json()).session, e = await enter(s);
      return { s, key: (/^salt_adm=([A-Za-z0-9_-]{32});/.exec(e.headers.get("set-cookie") || "") || [])[1] };
    };
    const A1 = await mint();
    const before = await call(envOn, "/all", { access: true, cookie: A1.key });
    await store.delete("sess:" + (await idOf(A1.s)));
    const noSession = await call(envOn, "/all", { access: true, cookie: A1.key });
    ok(before.status === 200 && noSession.status === 200,
      "the door stays open after the fifteen-minute password session has gone: " + JSON.stringify([before.status, noSession.status]));
    const A2 = await mint();
    const logout = await call(envOn, "/logout", { method: "POST", session: A2.s, body: {} });
    const afterLogout = await call(envOn, "/all", { access: true, cookie: A2.key });
    const afterLogoutOther = await call(envOn, "/all", { access: true, cookie: A1.key });
    ok(logout.status === 200 && afterLogout.status === 302 && afterLogoutOther.status === 302 && !(await store.get("adm:" + (await idOf(A2.key)))),
      "the Counter's Log out closes Salt Admin at once, on every browser of the account: " + JSON.stringify([logout.status, afterLogout.status, afterLogoutOther.status]));
    const A3 = await mint(), A3b = await mint();
    const left3 = await call(envOn, "/all/leave", { method: "POST", cookie: A3.key });
    const afterLeave = await call(envOn, "/all", { access: true, cookie: A3.key }), otherLeave = await call(envOn, "/all", { access: true, cookie: A3b.key });
    ok(left3.status === 200 && afterLeave.status === 302 && otherLeave.status === 200, "Leave shuts this browser's door and leaves another's: " + JSON.stringify([afterLeave.status, otherLeave.status]));
    const so = await call(envOn, "/all/signout", { method: "POST", access: true, cookie: A3b.key, body: { u: OWNER } });
    const afterSo = await call(envOn, "/all", { access: true, cookie: A3b.key });
    ok(so.status === 200 && afterSo.status === 302, "Sign out everywhere shuts the door: " + JSON.stringify([so.status, afterSo.status]));
    const A4 = await mint();
    await store.delete("adm:" + (await idOf(A4.key)));
    const expired = await call(envOn, "/all", { access: true, cookie: A4.key });
    ok(expired.status === 302, "with the admin record gone (its twelve hours up) the door is shut: " + expired.status);
    const nonOwner = {};
    for (const [name, rec] of [["staff", { u: STAFF, tier: 2 }], ["customer", { u: CUST, tier: 0 }], ["no tier", { u: CUST }]]) {
      const k = (name[0] + "Z").repeat(16);
      await store.put("adm:" + (await idOf(k)), JSON.stringify(rec));
      nonOwner[name] = (await call(envOn, "/all", { access: true, cookie: k })).status;
    }
    ok(Object.values(nonOwner).every((st) => st === 302), "a key of a tier 2 or non-admin account opens nothing: " + JSON.stringify(nonOwner));
    const A5 = await mint();
    await store.put("u:" + OWNER, JSON.stringify({ u: OWNER }));
    const untiered = await call(envOn, "/all", { access: true, cookie: A5.key });
    await store.put("u:" + OWNER, JSON.stringify(ownerRecord));
    ok(untiered.status === 302, "with the account's tier taken off its record the door shuts: " + untiered.status);
  } finally { globalThis.fetch = originalFetch; }

  /* ---- 8: the page ---- */
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");
  const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
  const wins = [];
  const open = async ({ admin, at = "/", remembered = false, enter = { ok: true, go: "/all" } }) => {
    const u = "abcd-efgh", pass = "fixture-pass-door", ck = await C.contentKey("test-secret", u), asked = [], rememberAsked = [];
    const stamped = { at: new Date().toISOString(), body: "<p>Live</p>", owed: 0, pay: null, buildId: BUILD };
    const body = Object.assign({ ok: true, wrap: await C.wrapKey(pass, ck), session: "sess-door", liveStatus: "current",
      live: Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))),
      env: await C.encryptWith(ck, JSON.stringify({ statements: [] })), prices: null }, admin === undefined ? {} : { admin, adminLabel: "Salt Admin" });
    let work;
    const dom = new JSDOM(P.landingPage(u, "ndr", null), { url: "https://site.test" + at, runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (remembered) win.localStorage.setItem("salt-stmt-remember", JSON.stringify({ u, t: "a".repeat(32), k: "a".repeat(32) }));
      win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = function () {};
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/remember/open") rememberAsked.push(p);
        if (p === "/admin/enter") asked.push((init.headers || {})["X-Stmt-Session"] || "");
        const j = (p === "/open" || p === "/account") ? body : (p === "/orders" && m === "GET") ? { ok: true, orders: [], claims: [] } : p === "/admin/enter" ? enter : null;
        return { ok: !!(j && j.ok), status: j ? (j.ok ? 200 : 403) : 404, json: async () => j || { ok: false } };
      };
      work = pageWork(win);
    } });
    wins.push(dom.window);
    const d = dom.window.document;
    await work.quiet();
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden);
    await work.quiet();
    const rowNow = () => [...d.querySelectorAll("#devRows > li")].find((li) => t(li.querySelector(".amb-setting__name")) === "Salt Admin"), row = rowNow();
    return { d, row, asked, rememberAsked, note: () => t(rowNow() && rowNow().querySelector(".amb-setting__value")), place: () => d.getElementById("tabs").getAttribute("data-place") };
  };
  try {
    const A = await open({ admin: 1 }), Cu = await open({});
    ok(!!A.row && t(A.row.querySelector("button")) === "Open" && !Cu.row && A.asked.length === 0,
      "This device carries Salt Admin and its Open for an admin account, none for a customer, and away from /admin nothing is asked by itself");
    const G = await open({ admin: 1, at: "/admin" });
    const S = await open({ admin: 2, at: "/admin", enter: { ok: false, error: "Staff access is not set up yet.", code: "adminStaff" } });
    ok(G.asked.length === 1 && G.asked[0] === "sess-door" && S.asked.length === 1 && S.note() === "Staff access is not set up yet." && S.place() === "stmt",
      "at /admin an admin account asks for its key once on its own session, and staff are told it is not set up yet on This device: " + JSON.stringify([G.asked, S.note(), S.place()]));
    const R = await open({ admin: 1, at: "/admin", remembered: true });
    ok(R.rememberAsked.length === 0 && R.asked.length === 1,
      "the admin door asks for a password instead of opening the remembered account");
    const retryPage = await open({ admin: 1, at: "/admin?retry=1" });
    ok(retryPage.asked.length === 0 && retryPage.note() === "Could not open. Try again."
      && !!retryPage.row.querySelector("button"), "a failed return shows the reason and a retry without opening again");
  } finally { for (const w of wins) w.close(); }
}
