/* test/order-stream-v7-ui.mjs: plan version 5, JOIN BY LINK, the two pages (his answers E to E2 of 02 Nov 2026; stmt/join.js, stmt/owner.js, stmt/page.js).
 * Salt Admin: join links beside the guest links with Approve and Decline on a waiting one and Withdraw on an open one; a join in state sent is a To do card,
 * Add them; the one unlock opens its seal under 'salt-join v1' and fills Record's New customer (name, place, kind Customer); his Add ID tells the join its
 * code and nothing of the name; once the code has an account on the sheet his page mints the hand-over once and files it. The associate's Counter page:
 * Ask for a join link, and each link in words, never a name or a code. The owner page is drawn by the maker harness (test/maker-act.mjs), the
 * associate's by the real Counter Worker; every name, code and key is invented. Mutations: test/order-stream-v7-ui.mutations.json. */
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { richOwnerPage, byAct, slipFixture, tileValue } from "./maker-act.mjs";
import { Store } from "./maker-order-controls.mjs";
import counter from "../stmt/worker.js";
import { landingPage } from "../stmt/page.js";
import { mintJoin, setJoin } from "../stmt/join.js";
import * as C from "../tools/stmt-crypto.mjs";

const J = JSON.stringify;
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const b64 = (v) => Buffer.from(v).toString("base64");
const U1 = "abcd-efgh", U4 = "4567-89ab", AT = "2026-11-03T02:00:00.000Z";
const NAME = "Zed Tester", PLACE = "Bandar Sungai Long, Mahkota Cheras";

/* a form sealed as the referee's page seals it: an ephemeral pair, ECDH with his public half, HKDF under 'salt-join v1', AES-GCM */
async function joinSeal(pubJwk, value) {
  const S = webcrypto.subtle, E = { name: "ECDH", namedCurve: "P-256" };
  const eph = await S.generateKey(E, true, ["deriveBits"]), pub = await S.importKey("jwk", { kty: pubJwk.kty, crv: pubJwk.crv, x: pubJwk.x, y: pubJwk.y }, E, false, []);
  const hk = await S.importKey("raw", await S.deriveBits({ name: "ECDH", public: pub }, eph.privateKey, 256), "HKDF", false, ["deriveKey"]);
  const aes = await S.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: new TextEncoder().encode("salt-join v1") }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12)), ct = await S.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(J(value)));
  return { v: 1, epk: b64(await S.exportKey("raw", eph.publicKey)), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

/* a map sealed under the vault's password as the vault seals it: PBKDF2 150,000 rounds, AES-GCM */
async function sealMap(pass, value) {
  const S = webcrypto.subtle, base = await S.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  const salt = webcrypto.getRandomValues(new Uint8Array(16)), iv = webcrypto.getRandomValues(new Uint8Array(12));
  const aes = await S.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(await S.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(J(value))))) };
}

export async function run({ ok, pageWork }) {
  const fix = await slipFixture();
  const rec = (id, patch) => ({ id, by: U1, made: AT, approved: true, declined: false, revoked: false, state: "open", ...patch });
  const answers = (state) => (route, body) => {
    if (route === "/all/joins") return { ok: true, joins: Object.values(state) };
    const m = /^\/all\/joins\/([^/]+)\/(approve|decline|revoke|added|handover)$/.exec(route);
    if (!m || !state[m[1]]) return undefined;
    const r = state[m[1]];
    if (m[2] === "approve") state[m[1]] = { ...r, approved: true, declined: false };
    else if (m[2] === "decline") state[m[1]] = { ...r, declined: true, approved: false };
    else if (m[2] === "revoke") state[m[1]] = { ...r, revoked: true };
    else if (m[2] === "added") { state[m[1]] = { ...r, state: "added", code: body && body.code }; delete state[m[1]].seal; }
    else state[m[1]] = { ...r, state: "keyed" };
    return { ok: true, join: state[m[1]] };
  };
  const seal = await joinSeal(fix.pub, { v: 1, name: NAME, place: PLACE, at: AT });

  /* ---- Salt Admin: the list, Approve, Decline, Withdraw ---- */
  const state = {
    jwaiting1: rec("jwaiting1", { approved: false }), jwaiting2: rec("jwaiting2", { approved: false }), jdeclin01: rec("jdeclin01", { approved: false, declined: true }),
    jopen0001: rec("jopen0001"), jsent0001: rec("jsent0001", { state: "sent", seal, sentAt: AT }),
    jspent001: rec("jspent001", { state: "spent" }), jaddedw01: rec("jaddedw01", { state: "added", code: "CX2-ZED", addedAt: AT }), jsentw001: rec("jsentw001", { state: "sent", seal, sentAt: AT })
  };
  const p = await richOwnerPage({ pageWork, slip: true, extra: answers(state) });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); }, posts = (re) => p.posts.filter((x) => re.test(x.route));
    await click(byAct(d, "nav.customers")); await click(byAct(d, "part.customers.links"));
    const jc = (id) => d.querySelector('#jlist [data-join="' + id + '"]'), act = (a, id) => byAct(d, a, "jl:" + id);
    const word = (id) => t(jc(id) && jc(id).querySelector(".nkind")).split(" · ")[0];
    ok(Object.keys(state).every((id) => !!jc(id)) && word("jwaiting1") === "Waiting" && word("jdeclin01") === "Declined" && word("jopen0001") === "Open" && word("jsent0001") === "Sent"
      && /Join link from CX1-ZED/.test(t(jc("jwaiting1"))),
      "A1 the Links part lists every join link beside the guest links, who asked (their code) and where it stands: " + J(Object.keys(state).map(word)));
    ok(!!act("join.approve", "jwaiting1") && !!act("join.decline", "jwaiting1") && !act("join.approve", "jdeclin01") && !act("join.decline", "jdeclin01") && !act("join.approve", "jopen0001")
      && !act("join.approve", "jsent0001") && !!act("join.withdraw", "jopen0001") && !act("join.withdraw", "jwaiting1") && !act("join.withdraw", "jdeclin01")
      && !!act("join.withdraw", "jsent0001") && !!act("join.withdraw", "jaddedw01") && !act("join.withdraw", "jspent001") && word("jspent001") === "Used",
      "A2 Approve and Decline are on a waiting link alone; Withdraw on an approved link in any state but used, so an added link whose account never comes can be shut; a declined one has none");
    await click(act("join.approve", "jwaiting1"));
    ok(posts(/\/all\/joins\/jwaiting1\/approve$/).length === 1 && word("jwaiting1") === "Open" && /^Approved, and it opens now[.]/.test(t(jc("jwaiting1")).replace(/^.*?(Approved)/, "$1")) && !!act("join.withdraw", "jwaiting1") && !act("join.approve", "jwaiting1"),
      "A3 Approve posts its own route once, the link reads Open and offers Withdraw: " + J(p.posts.map((x) => x.route)));
    await click(act("join.decline", "jwaiting2"));
    ok(posts(/\/all\/joins\/jwaiting2\/decline$/).length === 1 && word("jwaiting2") === "Declined" && /stays shut/.test(t(jc("jwaiting2"))) && !act("join.approve", "jwaiting2"),
      "A4 Decline posts its own route and the link reads Declined, shut");
    await click(act("join.withdraw", "jopen0001"));
    ok(posts(/\/all\/joins\/jopen0001\/revoke$/).length === 1 && word("jopen0001") === "Withdrawn" && !act("join.withdraw", "jopen0001"),
      "A5 Withdraw posts the revoke route and the link reads Withdrawn");
    await click(byAct(d, "nav.needs"));
    const inNeeds = (key) => !!d.querySelector('#nlist [data-need="' + key + '"]');
    ok(inNeeds("js:jaddedw01") && inNeeds("j:jsentw001"), "A6a an added and a sent join stand in Needs you before they are withdrawn");
    await click(byAct(d, "nav.customers")); await click(byAct(d, "part.customers.links"));
    await click(act("join.withdraw", "jaddedw01")); await click(act("join.withdraw", "jsentw001"));
    await click(byAct(d, "nav.needs"));
    ok(posts(/\/all\/joins\/jaddedw01\/revoke$/).length === 1 && posts(/\/all\/joins\/jsentw001\/revoke$/).length === 1 && !inNeeds("js:jaddedw01") && !inNeeds("j:jsentw001"),
      "A6 a sent or an added join is withdrawn through the same route and leaves Needs you: " + J(p.posts.map((x) => x.route).slice(-3)));
    await click(byAct(d, "nav.customers")); await click(byAct(d, "part.customers.links"));
    ok(/^Withdrawn, so they need a new link[.]/.test(t(jc("jaddedw01")).replace(/^.*?(Withdrawn, so)/, "$1")) && /need a new link/.test(t(jc("jsentw001"))) && /Withdrawn[.]$/.test(t(jc("jopen0001"))) && !/need a new link/.test(t(jc("jopen0001"))),
      "A7 withdrawing a link already used says a new one is needed: " + t(jc("jaddedw01")));
    await click(byAct(d, "nav.needs"));

    /* ---- Needs you: a join in state sent is To do, Add them; no other state is ---- */
    await click(byAct(d, "nav.needs"));
    const need = d.querySelector('#nlist [data-need="j:jsent0001"]');
    ok(!!need && need.getAttribute("data-sev") === "now" && /^Customer/.test(t(need.querySelector(".nkind"))) && /New customer from CX1-ZED/.test(t(need)) && !!byAct(need, "need.join-add", "j:jsent0001")
      && t(byAct(need, "need.join-add", "j:jsent0001")) === "Add them" && !d.querySelector('#nlist [data-need="j:jopen0001"]') && !d.querySelector('#nlist [data-need="j:jwaiting1"]'),
      "N1 a join in state sent is a To do card, Customer, New customer from their associate's code, with Add them; a link merely open or waiting is not: " + t(need));

    /* ---- Add them: locked asks for the one unlock; unlocked it opens the seal and fills New customer ---- */
    const before = p.posts.length;
    await click(byAct(need, "need.join-add", "j:jsent0001"));
    ok(!d.getElementById("vaultSheet").hidden && p.posts.length === before,
      "U1 locked, Add them asks for the one unlock and sends nothing");
    byAct(d, "vault.passphrase").value = p.slipPass; await click(byAct(d, "vault.open"));
    const form = d.querySelector('#makerInputs [data-form="new-customer"]');
    ok(!!form && !form.hidden && byAct(form, "record.add-id.name").value === NAME && byAct(form, "record.add-id.place").value === PLACE && tileValue(form, "Role") === "customer",
      "U2 unlocked, the seal opens under 'salt-join v1' and Record's New customer is open with the name, the place and the kind Customer filled: "
      + J(form && [byAct(form, "record.add-id.name").value, byAct(form, "record.add-id.place").value, tileValue(form, "Role"), form.hidden]));
    ok(posts(/\/all\/joins\/jsent0001\/added$/).length === 0 && !p.posts.some((x) => /add-id$/.test(x.route)), "U3 nothing is sent until he adds the customer");
    await click(byAct(form, "record.add-id.send"));
    const addId = p.posts.find((x) => /add-id$/.test(x.route)), told = posts(/\/all\/joins\/jsent0001\/added$/);
    ok(!!addId && told.length === 1 && told[0].body && J(Object.keys(told[0].body)) === J(["code"]) && told[0].body.code === addId.body.code && /^[A-Z]{1,3}[0-9]{1,2}-[A-Z0-9]{1,6}$/.test(addId.body.code),
      "U4 when the Add ID is sent the join is told its code and nothing else: " + J([addId && addId.body.code, told.map((x) => x.body)]));
    ok(!!addId && addId.body.introducer === "CX1-ZED", "U4b (plan version 6, R3) the join's Add ID names the associate whose link brought them, by code: " + J(addId && addId.body.introducer));
    ok(!p.wire.some((w) => w.includes(NAME)) && !J(told).includes("Zed") && state.jsent0001.state === "added" && !d.querySelector('#nlist [data-need="j:jsent0001"]'),
      "U5 no request carries the plaintext name, and the card leaves To do once the join is added");
    ok(!!d.querySelector('#nlist [data-need="js:jsent0001"]') && d.querySelector('#nlist [data-need="js:jsent0001"]').getAttribute("data-sev") === "watch",
      "U6 an added join waiting on its account is one FYI card, Signing in");
  } finally { p.w.close(); }

  /* ---- a cancelled unlock; a place or a name edited over the filled form still tells the join, an emptied name does not; the lock lets the filled name go ---- */
  const state2 = { jsent0002: rec("jsent0002", { state: "sent", seal, sentAt: AT }), jsent0003: rec("jsent0003", { state: "sent", seal, sentAt: AT }), jsent0004: rec("jsent0004", { state: "sent", seal, sentAt: AT }) };
  const q = await richOwnerPage({ pageWork, slip: true, extra: answers(state2) });
  try {
    await q.work.quiet();
    const d = q.d, click = async (e) => { if (e) e.click(); await q.work.quiet(); };
    const fill = async (id) => { await click(byAct(d, "nav.needs")); await click(byAct(d, "need.join-add", "j:" + id)); };
    const formOf = () => d.querySelector('#makerInputs [data-form="new-customer"]');
    await fill("jsent0002");
    await click(d.getElementById("vaultX"));
    await click(d.getElementById("vaultSwitch")); byAct(d, "vault.passphrase").value = q.slipPass; await click(byAct(d, "vault.open"));
    ok(!d.getElementById("makerInputs").hasAttribute("data-read") && !formOf(), "U0 an unlock he cancelled and then makes another way does not carry him to Record unasked");
    await fill("jsent0002");
    let form = formOf();
    const fillLine = form && [...form.querySelectorAll('[role="status"]')].map(t).find((x) => /^Filled/.test(x));
    ok(!!form && byAct(form, "record.add-id.name").value === NAME && /^Filled from the join link of CX1-ZED, their first week counting for them; check them, then add[.]$/.test(fillLine || ""),
      "U6a Add them after the unlock fills the form, and its line is one sentence: " + fillLine);
    q.type(byAct(form, "record.add-id.place"), "Pudu");
    await click(byAct(form, "record.add-id.send"));
    ok(q.posts.some((x) => /add-id$/.test(x.route)) && q.posts.filter((x) => /\/jsent0002\/added$/.test(x.route)).length === 1,
      "U7 a place corrected over the filled form still goes in as that join's Add ID, and the join is told its code: " + J(q.posts.map((x) => x.route)));
    await fill("jsent0003");
    form = formOf();
    q.type(byAct(form, "record.add-id.name"), "Third Person");
    await click(byAct(form, "record.add-id.send"));
    ok(q.posts.filter((x) => /add-id$/.test(x.route)).length === 2 && !q.posts.some((x) => /\/jsent0003\/added$/.test(x.route)),
      "U7c a different name typed straight over the filled one is another customer: the Add ID goes in and the join is never told (Fable's re-check)");
    ok(q.posts.filter((x) => /add-id$/.test(x.route))[0].body.introducer === "CX1-ZED" && !("introducer" in q.posts.filter((x) => /add-id$/.test(x.route))[1].body),
      "U7d (R3) and that other customer names no introducer, while the join's own Add ID does");
    await fill("jsent0003");
    form = formOf();
    q.type(byAct(form, "record.add-id.name"), ""); q.type(byAct(form, "record.add-id.name"), "Fourth Person");
    await click(byAct(form, "record.add-id.send"));
    ok(q.posts.filter((x) => /add-id$/.test(x.route)).length === 3 && !q.posts.some((x) => /\/jsent0003\/added$/.test(x.route)),
      "U7b a name emptied and typed over is another customer: the Add ID goes in and the join is not told");
    await fill("jsent0004");
    form = formOf();
    ok(byAct(form, "record.add-id.name").value === NAME, "U8 Add them again fills the form afresh");
    Object.defineProperty(d, "hidden", { configurable: true, get: () => true });
    d.dispatchEvent(new q.w.Event("visibilitychange"));
    await q.work.quiet();
    ok(byAct(form, "record.add-id.name").value === "" && byAct(form, "record.add-id.place").value === "" && !q.d.body.textContent.includes(NAME),
      "U9 the lock lets the filled name and place go from the form and the page");
  } finally { q.w.close(); }

  /* ---- an Add ID that went in by another road, or a word to the link that was lost: Send its code once the unlocked vault names the code ---- */
  const named = { on: false }, namesSealed = await sealMap(fix.pass, { ...fix.nameOf, "CZ10-BSL": NAME + " (" + PLACE + ")" });
  const retellPage = async (st) => {
    const own = answers(st);
    return richOwnerPage({ pageWork, slip: true, extra: (route, body) => {
      if (route === "/all/maker/inputs/add-id" && !named.on) named.on = true;
      if (route === "/all/maker/vault" && named.on) return { ok: true, vault: namesSealed };
      return own(route, body);
    } });
  };
  const stR = { jretell05: rec("jretell05", { state: "sent", seal, sentAt: AT }) };
  named.on = false;
  const r5 = await retellPage(stR);
  try {
    await r5.work.quiet();
    const d = r5.d, click = async (e) => { if (e) e.click(); await r5.work.quiet(); }, told = () => r5.posts.filter((x) => /\/jretell05\/added$/.test(x.route));
    r5.refuse["/all/maker/inputs/add-id"] = "The Desk is busy.";
    await click(byAct(d, "nav.needs")); await click(byAct(d, "need.join-add", "j:jretell05"));
    byAct(d, "vault.passphrase").value = r5.slipPass; await click(byAct(d, "vault.open"));
    await click(byAct(d.querySelector('#makerInputs [data-form="new-customer"]'), "record.add-id.send"));
    await click(byAct(d, "nav.needs"));
    const card = () => d.querySelector('#nlist [data-need="j:jretell05"]');
    ok(!named.on && told().length === 0 && !!byAct(card(), "need.join-add", "j:jretell05") && !byAct(card(), "need.join-told", "j:jretell05"),
      "R1 an Add ID that did not go in tells the join nothing, and the card still offers Add them");
    delete r5.refuse["/all/maker/inputs/add-id"]; named.on = true;
    let hid = true; Object.defineProperty(d, "hidden", { configurable: true, get: () => hid });
    d.dispatchEvent(new r5.w.Event("visibilitychange")); await r5.work.quiet(); hid = false;
    await click(d.getElementById("vaultSwitch")); byAct(d, "vault.passphrase").value = r5.slipPass; await click(byAct(d, "vault.open"));
    ok(!!byAct(card(), "need.join-told", "j:jretell05") && !byAct(card(), "need.join-add", "j:jretell05") && t(byAct(card(), "need.join-told", "j:jretell05")) === "Send its code",
      "R2 once the Add ID is in and the unlocked vault names its code, the card offers Send its code in place of Add them: " + t(card()));
    await click(byAct(card(), "need.join-told", "j:jretell05"));
    ok(told().length === 1 && J(told()[0].body) === J({ code: "CZ10-BSL" }) && stR.jretell05.state === "added" && !card(),
      "R3 Send its code tells the join the code named in the vault and nothing else: " + J(told().map((x) => x.body)));
  } finally { r5.w.close(); }
  const stS = { jretell06: rec("jretell06", { state: "sent", seal, sentAt: AT }) };
  named.on = false;
  const r6 = await retellPage(stS);
  try {
    await r6.work.quiet();
    const d = r6.d, click = async (e) => { if (e) e.click(); await r6.work.quiet(); }, told = () => r6.posts.filter((x) => /\/jretell06\/added$/.test(x.route));
    r6.refuse["/all/joins/jretell06/added"] = "The Counter is busy.";
    await click(byAct(d, "nav.needs")); await click(byAct(d, "need.join-add", "j:jretell06"));
    byAct(d, "vault.passphrase").value = r6.slipPass; await click(byAct(d, "vault.open"));
    await click(byAct(d.querySelector('#makerInputs [data-form="new-customer"]'), "record.add-id.send"));
    await click(byAct(d, "nav.needs"));
    const card = () => d.querySelector('#nlist [data-need="j:jretell06"]');
    ok(told().length === 1 && /was not told/.test(t(card())) && !!byAct(card(), "need.join-told", "j:jretell06") && !byAct(card(), "need.join-add", "j:jretell06"),
      "R4 a word to the link that was lost is said on its card, which offers Send its code and no second Add ID: " + t(card()));
    delete r6.refuse["/all/joins/jretell06/added"];
    await click(byAct(card(), "need.join-told", "j:jretell06"));
    ok(told().length === 2 && J(told()[1].body) === J({ code: "CZ10-BSL" }) && stS.jretell06.state === "added", "R5 and Send its code tells it again: " + told().length);
  } finally { r6.w.close(); }

  /* ---- the hand-over by itself: once, only for a code with an account ---- */
  const state3 = { jadded001: rec("jadded001", { state: "added", code: "CX4-ZED", addedAt: AT }), jnoacct01: rec("jnoacct01", { state: "added", code: "CX2-ZED", addedAt: AT }),
    jrevoked1: rec("jrevoked1", { state: "added", code: "CX1-ZED", addedAt: AT, revoked: true }), jdeclined: rec("jdeclined", { state: "added", code: "CX3-ZED", addedAt: AT, approved: false, declined: true }) };
  const h = await richOwnerPage({ pageWork, extra: answers(state3) });
  try {
    await h.work.quiet();
    const d = h.d, click = async (e) => { if (e) e.click(); await h.work.quiet(); };
    const hos = () => h.posts.filter((x) => /\/all\/joins\/[^/]+\/handover$/.test(x.route));
    const one = hos()[0];
    ok(hos().length === 1 && one.route === "/all/joins/jadded001/handover" && one.body.u === U4 && typeof one.body.token === "string" && one.body.token.length > 20 && !!one.body.wrap && !!one.body.wrap.ct,
      "H1 the account of an added join is on the sheet: his page mints the hand-over for its username and posts the key and wrap to the join's own route, and for no other: " + J(hos().map((x) => [x.route, x.body && x.body.u])));
    await click(byAct(d, "nav.customers")); await click(byAct(d, "part.customers.links")); await click(byAct(d, "nav.needs")); await click(byAct(d, "nav.customers")); await click(byAct(d, "part.customers.accounts"));
    ok(hos().length === 1 && state3.jadded001.state === "keyed" && state3.jnoacct01.state === "added" && state3.jrevoked1.state === "added" && state3.jdeclined.state === "added",
      "H2 once a join a load: later reads of the sheet and the links send it no more, and a code with no account yet, a withdrawn link and a declined one are left alone: " + hos().length);
  } finally { h.w.close(); }

  /* a hand-over the Counter refused is said on the join's card and is never tried in a loop, though the reads go on and the join changes under them */
  const state4 = { jadded002: rec("jadded002", { state: "added", code: "CX4-ZED", addedAt: AT }) };
  let tick = 0;
  const own4 = answers(state4);
  const g = await richOwnerPage({ pageWork, extra: (route, body) => (route === "/all/joins" ? { ok: true, joins: [{ ...state4.jadded002, tick: ++tick }] } : own4(route, body)) });
  try {
    g.refuse["/all/joins/jadded002/handover"] = "Its account is not ready yet.";
    await g.work.quiet();
    const first = g.posts.filter((x) => /\/handover$/.test(x.route)).length;
    for (let i = 0; i < 3; i++) { for (const iv of g.intervals) if (!iv.off) iv.f(); await g.work.quiet(); }
    const handed = g.posts.filter((x) => /\/handover$/.test(x.route)).length;
    ok(first === 1 && handed === 1 && tick > 2, "H3 the reads go on and the join changes, yet a hand-over is minted once a join and never retried in a loop: " + J([first, handed, tick]));
  } finally { g.w.close(); }

  /* ---- the associate's Counter page ---- */
  const store = new Store();
  const one1 = store.get.bind(store);
  store.get = async (k, type) => Array.isArray(k) ? new Map(await Promise.all(k.map(async (x) => [x, await one1(x, "json")]))) : one1(k, type);
  const env = { STMT: store, STMT_HANDOVER_KEY: "join-ui-handover-capability-0001" };
  const u = C.newUsername(), pw = C.newPassword(), ck = await C.contentKey("v7-ui", u);
  await store.put("u:" + u, J({ u, assoc: true, issued: "2026-09-01", verifier: await C.makeVerifier(pw), wrap: await C.wrapKey(pw, ck),
    env: await C.encryptWith(ck, J({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>x</p>" }] })) }));
  const mine = async (patch) => { const r = await mintJoin(env, u); await setJoin(env, r.id, patch.set || {}); if (patch.rec) await store.put("j:" + r.id, J({ ...(await store.get("j:" + r.id, "json")), ...patch.rec })); return r.id; };
  const idWait = await mine({}), idOpen = await mine({ set: { approved: true } }), idUsed = await mine({ set: { approved: true }, rec: { state: "sent", code: "CZ9-XYZ", sentAt: AT } });
  const idNo = await mine({ set: { declined: true } }), idGone = await mine({ set: { approved: true, revoked: true } });
  const copied = [];
  let win = null, failJoins = false;
  const until = async (f) => { for (let i = 0; i < 300 && !(await f()); i++) await new Promise((r) => setTimeout(r, 20)); return !!(await f()); };
  try {
    const site = (path, o) => counter.fetch(new Request("https://k7m3p2.example" + path, o), env);
    win = new JSDOM(landingPage(u, "v7ui", null), { url: "https://k7m3p2.example/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(w) {
      try { Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true }); } catch (e) { w.crypto = webcrypto; }
      w.fetch = async (q, o) => { o = o || {}; if (failJoins && String(q) === "/my/joins") return { ok: false, status: 500, json: async () => ({ ok: false }) }; return site(String(q), { method: o.method || "GET", headers: o.headers, body: o.body }); };
      Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async (x) => { copied.push(x); } }, configurable: true });
    } }).window;
    const D = win.document;
    D.getElementById("un").value = u; D.getElementById("pw").value = pw;
    D.getElementById("f").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !D.getElementById("tabs").hidden);
    D.getElementById("tCard").click();
    const box = () => D.querySelector("#pCard [data-joins]"), row = (id) => box() && box().querySelector('[data-join="' + id + '"]');
    ok(await until(() => box() && row(idWait)), "B0 an associate's links card draws their join links");
    const state1 = (id) => t(row(id) && row(id).querySelector(".gstate"));
    ok(state1(idWait) === "Waiting for us" && state1(idOpen) === "Ready to share" && state1(idUsed) === "Used" && state1(idNo) === "Not approved" && state1(idGone) === "Withdrawn",
      "B1 each join link says where it stands: waiting for us, ready to share, used, not approved, withdrawn: " + J([idWait, idOpen, idUsed, idNo, idGone].map(state1)));
    const copies = (id) => [...row(id).querySelectorAll("button")].filter((b) => b.textContent === "Copy link");
    ok(copies(idOpen).length === 1 && [idWait, idUsed, idNo, idGone].every((id) => copies(id).length === 0), "B2 Copy link is on the ready link alone");
    copies(idOpen)[0].click();
    ok(await until(() => copied.length === 1) && copied[0] === "https://k7m3p2.example/j/" + idOpen, "B3 Copy link puts the join's address on the clipboard: " + J(copied));
    ok(/A join link is for one person/.test(t(box())) && [...box().querySelectorAll("button")].some((b) => b.textContent === "Ask for a join link"),
      "B4 the card says a join link is for one person and offers Ask for a join link");
    ok(!box().textContent.includes("CZ9-XYZ") && !/Zed|Tester|Mahkota/.test(box().textContent) && ![idWait, idOpen, idUsed, idNo, idGone].some((id) => box().textContent.includes(id)),
      "B5 no code, name or link id is shown in the card: " + t(box()).slice(0, 200));
    const asked = [...box().querySelectorAll("button")].find((b) => b.textContent === "Ask for a join link"), count0 = (await store.list({ prefix: "j:" })).keys.length;
    asked.click();
    const count1 = async () => (await store.list({ prefix: "j:" })).keys.length;
    ok(await until(async () => (await count1()) === count0 + 1) && await until(() => box() && box().querySelectorAll('[data-join]').length === 6),
      "B6 Ask for a join link mints one and lists it: " + J([count0, await count1()]));
    const newest = [...box().querySelectorAll("[data-join]")].find((r) => ![idWait, idOpen, idUsed, idNo, idGone].includes(r.getAttribute("data-join")));
    ok(!!newest && t(newest.querySelector(".gstate")) === "Waiting for us" && !newest.querySelector("button"), "B7 the new link waits for us and cannot be copied yet");
    /* B8: Log out lets the previous associate's join links go, so a read that fails for the next never shows them */
    failJoins = true;
    const lock = D.getElementById("lock"); lock.click(); lock.click();
    await until(() => D.getElementById("tabs").hidden);
    D.getElementById("un").value = u; D.getElementById("pw").value = pw;
    D.getElementById("f").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !D.getElementById("tabs").hidden);
    D.getElementById("tCard").click();
    ok(await until(() => D.querySelector("#pCard .rlinks")) && !D.querySelector("#pCard [data-joins]") && !D.querySelector("#pCard [data-join]"),
      "B8 after Log out the next sign-in shows none of the previous join links while its own read is out: " + t(D.getElementById("pCard")).slice(0, 120));
  } finally { try { if (win) win.close(); } catch (e) { /* best effort */ } }
}
