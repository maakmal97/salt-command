/* test/admin-one-unlock.mjs: ONE UNLOCK OPENS NAMES, PLACES AND THE SLIP KEY, EVERY PLACE READS IT, AND HIDING THE PAGE LOCKS THEM ALL (Phase 4b of the Salt Account
 * redesign, 12 Oct 2026, his decision 3 of 11 Oct; docs/STATEMENTS.md "The one unlock").
 *
 * Add ID, Amend ID, Place on the map, an unsent entry and a claim's slip each asked for the vault's password in a field of its own. Now one Sheet, one field,
 * opens the names, the places and the slip key together, held on this device only; each of those places says Locked and offers the same Unlock until then, and
 * the lock lets every key, name, place and picture go on a page hidden, on ended(), on a lapse and on Lock. Each check is red under its own mutation
 * (test/admin-one-unlock.mutations.json, run with tools/section.mjs). What is proved here:
 *   A  locked: no form has a passphrase field of its own; Add ID, Amend ID, Place on the map, the unsent entry and the claim's slip say Locked with the one Unlock;
 *      a send from any of them is refused with no request; the Sheet refuses an empty password, closes on Escape, its close control and Not now, and keeps Tab inside
 *   B  unlock: a wrong password leaves the page locked with its field empty; the right one reads the names, the places and the key once each, closes the Sheet,
 *      clears the field, puts the name beside the code (and nothing beside a code with none), says whether a place is filed, draws the slip with no further prompt,
 *      and what Add ID, Amend ID, Place on the map and the unsent entry then send is only ciphertext and the short code, built from the held keys
 *   C  lock: a page hidden, ended(), a lapse and Lock each drop the names, the places, the keys and the picture (its blob URL revoked), read Locked everywhere, and
 *      leave nothing to send with; a lock closes a Sheet with a half-typed password and clears it
 *   D  what leaves or stays: no request carries the password or a plaintext name or place; nothing is written to localStorage, sessionStorage, a cookie or
 *      IndexedDB by the unlock or the lock, and what a send keeps for a retry is ciphertext and codes; every key is imported or derived non-extractable and none is exported
 * Drawn by the maker harness (test/maker-act.mjs), which seals the invented names, places and slip key under one invented password. */
import { webcrypto } from "node:crypto";
import { richOwnerPage, byAct, slipFixture, unlockPage } from "./maker-act.mjs";

const U1 = "abcd-efgh", CLAIM = U1 + ":c-1", WRONG = "invented-wrong-pass", AT = "2026-10-11T09:00:00.000Z";
const PLAIN = ["Invented Person", "Invented Lane", "Invented base", "Zed Tester", "Amended Tester"];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const gateText = (form) => { const g = form && form.querySelector("[data-vault-gate]"); return g ? g.textContent : ""; };
const isVault = (w) => /^\/all\/maker\/vault/.test(w);
const readsOf = (p, path) => p.wire.filter((w) => w.startsWith(path + " GET")).length;
const shape = (e) => !!e && same(Object.keys(e).sort(), ["ct", "iv", "salt", "v"]);

/* an envelope opened as the vault opens it, null when it will not open */
async function openEnvelope(env, pass) {
  try {
    const base = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    const key = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt: Buffer.from(env.salt, "base64"), iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(env.iv, "base64") }, key, Buffer.from(env.ct, "base64"))));
  } catch (error) { return null; }
}

/* the page's crypto, watched: every key imported (how, and whether it may be taken back out), every key derived, every export */
function spyCrypto() {
  const log = { imports: [], derives: [], exports: [] };
  const subtle = new Proxy(webcrypto.subtle, { get(target, name) {
    if (name === "importKey") return (...a) => { log.imports.push({ format: a[0], alg: typeof a[2] === "string" ? a[2] : a[2].name, extractable: a[3], usages: a[4], priv: a[0] === "jwk" && !!(a[1] && a[1].d) }); return target.importKey(...a); };
    if (name === "deriveKey") return (...a) => { log.derives.push({ extractable: a[3] }); return target.deriveKey(...a); };
    if (name === "exportKey") return (...a) => { log.exports.push(a[0]); return target.exportKey(...a); };
    const value = target[name];
    return typeof value === "function" ? value.bind(target) : value;
  } });
  return { log, impl: { subtle, getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID() } };
}

/* the page's storage, watched: every localStorage and sessionStorage write, every cookie write, every call to IndexedDB, and a dump of what both hold now */
function spyStorage(p) {
  const w = p.w, writes = [], cookies = [], idb = [], proto = w.Storage.prototype, setItem = proto.setItem;
  proto.setItem = function (key, value) { writes.push({ key: String(key), value: String(value) }); return setItem.call(this, key, value); };
  Object.defineProperty(w.document, "cookie", { configurable: true, get: () => "", set: (v) => { cookies.push(String(v)); } });
  w.indexedDB = { open: (...a) => { idb.push(a); throw new Error("fixture: IndexedDB is not to be used"); } };
  const of = (s) => [...Array(s.length).keys()].map((i) => s.key(i)).sort().map((k) => [k, s.getItem(k)]);
  return { writes, cookies, idb, dump: () => JSON.stringify([of(w.localStorage), of(w.sessionStorage)]) };
}

export async function run({ ok, pageWork }) {
  const fix = await slipFixture(), PASS = fix.pass;
  const open = async (extra = {}) => {
    const p = await richOwnerPage({ pageWork, slip: true, probe: true, ...extra });
    /* a page whose lock fails to let the key go can ask for a slip again every time its sign-in ends, with no end: the fixture cuts such a loop off, so a mutation of the lock is a failed check and not a hang */
    const send = p.w.fetch; let sent = 0;
    p.w.fetch = (...a) => (++sent > 800 ? Promise.reject(new Error("fixture: a loop of requests was cut off")) : send.apply(p.w, a));
    await p.work.quiet();
    p.tap = async (act, key) => { const c = byAct(p.d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.form = (title) => [...p.d.querySelectorAll("#makerInputs section.maker-input")].find((s) => s.querySelector("h3").textContent === title) || null;
    p.unsent = () => [...p.d.querySelectorAll("#makerInputs section.maker-input")].find((s) => s.getAttribute("data-key") === "place") || null;
    p.claim = () => p.d.querySelector('[data-maker-card="claim:' + CLAIM + '"]');
    p.send = async (form, act) => { byAct(form, act).click(); await p.work.quiet(); };
    p.unlockFrom = async (button, pass) => { button.click(); byAct(p.d, "vault.passphrase").value = pass; byAct(p.d, "vault.open").click(); return p.work.quiet(); };
    p.ask = (root) => (root ? byAct(root, "vault.unlock") : null) || p.d.getElementById("vaultOn");
    p.names = () => [...p.d.querySelectorAll(".maker-name")];
    p.nameless = (code) => [...p.d.querySelectorAll('[data-who="' + code + '"]')];
    p.gates = () => [...p.d.querySelectorAll("[data-vault-gate]")];
    p.state = () => p.d.getElementById("vaultState").textContent;
    return p;
  };
  /* a field that asks for a password, other than the Sheet's one: a password input, or any control whose act says passphrase */
  const ownFields = (d) => [...d.querySelectorAll("input")].filter((i) => (i.type === "password" && i.id !== "pw" && i.id !== "vaultPass")
    || (/passphrase/.test(i.getAttribute("data-act") || "") && i.getAttribute("data-act") !== "vault.passphrase"));

  /* ---- ONE PAGE, FROM LOCKED TO SENT: the crypto, the storage and the wire watched throughout ---- */
  const spy = spyCrypto();
  const record = { path: "/all/maker/inputs/place", body: { at: AT, places: { "CX1-ZED": [3.1, 101.7, "Pudu"] }, addrVault: fix.places } };
  const p = await open({ retained: [["saltMakerPending:" + record.path, JSON.stringify(record)]], cryptoImpl: spy.impl });
  const d = p.d, store = spyStorage(p), stored = store.dump();
  spy.log.imports.length = 0; spy.log.derives.length = 0; spy.log.exports.length = 0;

  /* A. LOCKED */
  await p.tap("nav.orders");
  await p.tap("claim.open", CLAIM);
  let card = p.claim();
  ok(!!card && /Locked/.test(card.textContent) && card.querySelectorAll('[data-act="vault.unlock"]').length === 1 && !card.querySelector('[data-act="claim.slip"]')
    && ownFields(d).length === 0 && !card.querySelector("input[type=password]") && readsOf(p, "/all/maker/vault/key") === 0 && !p.wire.some((w) => w.startsWith("/all/maker/slips/")),
    "locked, a claim's slip says Locked and offers the one Unlock, with no field of its own, and asks the Counter for neither the key nor the slip: " + (card && card.textContent.slice(-120)));
  await p.tap("nav.record"); await p.tap("part.record.customers");
  const forms = { "Add ID": p.form("New customer"), "Amend ID": p.form("Change a name or place"), "Place on the map": p.form("Place on the map"), "An unsent entry": p.unsent() };
  ok(ownFields(d).length === 0 && [...d.querySelectorAll("#roster input[type=password]")].length === 0 && d.querySelectorAll("#vaultSheet input[type=password]").length === 1
    && [...d.querySelectorAll('[data-act$=".passphrase"]')].map((c) => c.getAttribute("data-act")).join() === "vault.passphrase",
    "no form on the page asks for a passphrase of its own: the Sheet's is the only password field, and the only control whose act says passphrase");
  for (const [title, form] of Object.entries(forms)) {
    const gates = form ? form.querySelectorAll("[data-vault-gate]") : [];
    ok(gates.length === 1 && /^Locked/.test(gates[0].textContent) && gates[0].querySelectorAll('[data-act="vault.unlock"]').length === 1 && !form.querySelector("input[type=password]"),
      title + " says Locked and offers the one Unlock, and has no password field of its own: " + (form ? form.textContent.slice(0, 120) : "no form"));
  }
  /* a send from a locked page is refused where it stands, before any request */
  const add = forms["Add ID"], amend = forms["Amend ID"], place = forms["Place on the map"], unsent = forms["An unsent entry"];
  const type = (c, v) => p.type(c, v);
  type(byAct(add, "record.add-id.name"), "Zed Tester");
  await p.send(add, "record.add-id.send");
  const addSaid = add.textContent;
  type(byAct(amend, "record.amend-id.party"), "CX1-ZED"); type(byAct(amend, "record.amend-id.name"), "Amended Tester"); type(byAct(amend, "record.amend-id.place"), "Pudu");
  await p.send(amend, "record.amend-id.send");
  const amendSaid = amend.textContent;
  type(byAct(place, "record.place.party"), "CX1-ZED");
  await p.send(place, "record.place.send");
  const placeSaid = place.textContent;
  await p.send(unsent, "record.retained.retry");
  const unsentSaid = unsent.textContent;
  const refused = /Unlock names and places first[.]/;
  ok(refused.test(addSaid) && !p.posts.some((x) => /add-id$/.test(x.route)), "a locked Add ID is refused with 'Unlock names and places first.' and sends nothing");
  ok(refused.test(amendSaid) && !p.posts.some((x) => /amend-id$/.test(x.route)), "a locked Amend ID is refused with 'Unlock names and places first.' and sends nothing");
  ok(refused.test(placeSaid) && !p.posts.some((x) => /[/]place$/.test(x.route) && x.body.at !== AT), "a locked Place on the map is refused with 'Unlock names and places first.' and sends nothing");
  ok(refused.test(unsentSaid) && !p.posts.some((x) => x.route === record.path) && p.w.localStorage.getItem("saltMakerPending:" + record.path) === JSON.stringify(record),
    "a locked unsent entry is refused with 'Unlock names and places first.', sends nothing and keeps its ciphertext");
  ok(p.wire.filter(isVault).length === 0, "a locked page reads the vault for none of these: " + p.wire.filter(isVault).join(" | "));

  /* the Sheet: an empty password sends nothing, and it closes, clearing the field, on Escape, its close control and Not now; Tab stays inside it */
  const sheet = d.getElementById("vaultSheet"), field = () => byAct(d, "vault.passphrase"), say = () => d.getElementById("vaultSay").textContent;
  p.ask(add).click();
  const shown = !sheet.hidden && sheet.getAttribute("role") === "dialog" && sheet.getAttribute("aria-modal") === "true";
  byAct(d, "vault.open").click(); await p.work.quiet();
  ok(shown && !sheet.hidden && /Enter the password/.test(say()) && p.wire.filter(isVault).length === 0,
    "the Sheet is a dialog, and an empty password sends nothing and says so: " + say());
  ok(field().type === "password" && field().getAttribute("autocomplete") === "off" && field().getAttribute("data-act") === "vault.passphrase",
    "the Sheet's field hides what is typed and tells the browser not to keep it");
  field().value = "half-typed";
  d.dispatchEvent(new p.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  ok(sheet.hidden && field().value === "" && d.getElementById("vaultScrim").hidden, "Escape closes the Sheet and clears what was typed in it");
  p.ask(add).click(); field().value = "half-typed"; byAct(d, "vault.close").click();
  const closedByOrb = sheet.hidden && field().value === "";
  p.ask(add).click(); field().value = "half-typed"; byAct(d, "vault.cancel").click();
  ok(closedByOrb && sheet.hidden && field().value === "" && p.wire.filter(isVault).length === 0, "the close control and Not now each close the Sheet, clear the field and send nothing");
  p.ask(add).click();
  const tabbable = [...sheet.querySelectorAll("button,input")].filter((c) => !c.disabled);
  tabbable.at(-1).focus();
  const tab = new p.w.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  tabbable.at(-1).dispatchEvent(tab);
  ok(tabbable.length >= 3 && tab.defaultPrevented && d.activeElement === tabbable[0], "Tab from the last control of the Sheet goes to the first, so focus stays inside it");

  /* B. UNLOCK. A wrong password first, from Add ID's own gate */
  const reads0 = { names: readsOf(p, "/all/maker/vault"), addr: readsOf(p, "/all/maker/vault/addr"), key: readsOf(p, "/all/maker/vault/key") };
  await unlockPage(p.w, p.work, WRONG);
  ok(!sheet.hidden && field().value === "" && /did not open/.test(say()) && p.state() === "Locked" && p.names().length === 0 && p.gates().every((g) => /^Locked/.test(g.textContent))
    && p.urls.made.length === 0 && ownFields(d).length === 0,
    "a wrong password leaves every place locked, shows no name, clears the field and says it did not open: " + say());
  ok(readsOf(p, "/all/maker/vault/key") === reads0.key, "a wrong password opens nothing, so the slip key is not even asked for");
  byAct(d, "vault.cancel").click();

  /* the right one, from the claim's card in Orders */
  await p.tap("nav.orders");
  await p.tap("claim.open", CLAIM);
  card = p.claim();
  const reads1 = { names: readsOf(p, "/all/maker/vault"), addr: readsOf(p, "/all/maker/vault/addr"), key: readsOf(p, "/all/maker/vault/key") };
  ok(/Locked/.test(card?.textContent) && p.names().length === 0, "after a wrong password the claim's slip still says Locked");
  await p.unlockFrom(p.ask(card), PASS);
  ok(readsOf(p, "/all/maker/vault") - reads1.names === 1 && readsOf(p, "/all/maker/vault/addr") - reads1.addr === 1 && readsOf(p, "/all/maker/vault/key") - reads1.key === 1,
    "one password reads the names, the places and the slip key from the Counter, once each");
  ok(sheet.hidden && field().value === "" && d.getElementById("vaultScrim").hidden && p.state() === "Open on this phone" && d.getElementById("vaultOn").hidden && !d.getElementById("vaultOff").hidden
    && [...d.querySelectorAll("input,textarea")].every((i) => i.value !== PASS) && !d.documentElement.outerHTML.includes(PASS),
    "the right password closes the Sheet, empties its field, shows the page open and is held in no field and no markup");
  ok(!!p.claim()?.querySelector('[data-act="claim.slip"]') && p.urls.made.length === 1 && p.wire.filter((w) => w.startsWith("/all/maker/slips/" + U1 + "/s-1")).length === 1
    && !byAct(p.claim(), "vault.unlock"),
    "the same unlock draws the claim's slip at once, with no prompt of its own and one fetch of the sealed picture");
  const named = p.names(), alone = p.nameless("CX3-ZED");
  ok(named.length > 0 && named.every((n) => n.textContent === fix.nameOf["CX1-ZED"] && n.parentElement.getAttribute("data-who") === "CX1-ZED")
    && p.nameless("CX1-ZED").every((n) => n.querySelector(".maker-name")) && alone.length > 0 && alone.every((n) => !n.querySelector(".maker-name")),
    "the name stands beside its code wherever the code is drawn, and a code the vault holds no name for shows alone: " + named.length + " named, " + alone.length + " alone");
  ok(store.dump() === stored && store.writes.length === 0 && store.cookies.length === 0 && store.idb.length === 0,
    "a wrong password and the right one write nothing to localStorage, sessionStorage, a cookie or IndexedDB: " + JSON.stringify([store.writes, store.cookies, store.idb.length]));

  /* Lock, in the Shop row, then the unlock again (the unsent entry and the forms below are driven on the second) */
  d.getElementById("vaultOff").click(); await p.work.quiet();
  ok(p.state() === "Locked" && p.names().length === 0 && p.urls.made.every((u) => p.urls.revoked.includes(u)) && !d.querySelector("[data-maker-slip]") && /Locked/.test(p.claim()?.textContent)
    && store.dump() === stored && store.writes.length === 0,
    "Lock in Shop drops the names, the slip and its blob URL, reads Locked on the card, and writes nothing");
  await p.unlockFrom(p.ask(p.claim()), PASS);
  ok(p.state() === "Open on this phone" && p.names().length > 0, "the page unlocks again after a lock");

  /* Record: every place now reads the one unlock */
  await p.tap("nav.record"); await p.tap("part.record.customers");
  const f2 = { add: p.form("New customer"), amend: p.form("Change a name or place"), place: p.form("Place on the map"), unsent: p.unsent() };
  ok(p.gates().length >= 4 && p.gates().every((g) => /^Names and places are open/.test(g.textContent) && !g.querySelector('[data-act="vault.unlock"]')),
    "every place that asked for a password reads the one unlock: each gate says so and none offers an Unlock");
  const partyOf = byAct(f2.place, "record.place.party");
  type(partyOf, "CX1-ZED");
  const filed = gateText(f2.place);
  type(partyOf, "CX2-ZED");
  const unfiled = gateText(f2.place);
  ok(/A place is filed for them/.test(filed) && /No place is filed for them yet/.test(unfiled) && !filed.includes("Invented Lane"),
    "Place on the map reads the held places, saying whether one is filed for the party and never where: " + filed + " | " + unfiled);
  ok(/with its point, from Waze, filed 04 Oct 2026[.] Filing a new link replaces it[.]/.test(filed) && !/replaces it/.test(unfiled) && !filed.includes("101.7"),
    "Place on the map discloses before filing that a point is held, its source, the Kuala Lumpur day it was filed and that filing replaces it, and never the address or figures: " + filed);

  /* the unsent entry, sent from the unlock */
  await p.send(f2.unsent, "record.retained.retry");
  const resent = p.posts.filter((x) => x.route === record.path);
  ok(resent.length === 1 && same(resent[0].body, record.body) && p.w.localStorage.getItem("saltMakerPending:" + record.path) === null && !p.unsent(),
    "an unsent entry opens on the one unlock, is sent exactly as it was kept and is cleared only once the Desk confirms");

  /* Add ID: the name is sealed on the device under the held key, and only the short code and the envelope travel */
  type(byAct(f2.add, "record.add-id.name"), "Zed Tester");
  await p.send(f2.add, "record.add-id.send");
  const sentAdd = p.posts.find((x) => /add-id$/.test(x.route)), addNames = sentAdd && await openEnvelope(sentAdd.body.vault, PASS);
  ok(!!sentAdd && same(Object.keys(sentAdd.body), ["at", "code", "kind", "parent", "tiers", "vault"]) && sentAdd.body.code === "CZ10-TBC" && shape(sentAdd.body.vault)
    && !!addNames && addNames["CZ10-TBC"] === "Zed Tester (to be confirmed)" && addNames["CX1-ZED"] === fix.nameOf["CX1-ZED"] && !JSON.stringify(sentAdd.body).includes("Zed Tester"),
    "Add ID, on the held key, sends the short code and a sealed name map that opens to the held names and the new one, and no plaintext name: " + (sentAdd && Object.keys(sentAdd.body)));

  /* Place on the map: the rounded point comes out of the held places */
  type(partyOf, "CX1-ZED");
  await p.send(f2.place, "record.place.send");
  const sentPlace = p.posts.filter((x) => /[/]place$/.test(x.route)).at(-1);
  ok(!!sentPlace && sentPlace.body.at !== AT && same(Object.keys(sentPlace.body), ["at", "places"]) && same(sentPlace.body.places, { "CX1-ZED": [3.1, 101.7, "Pudu"] }) && !JSON.stringify(sentPlace.body).includes("Invented Lane"),
    "Place on the map, on the held places, sends only the rounded point of the party: " + JSON.stringify(sentPlace && sentPlace.body));

  /* Amend ID: the held names and places are re-keyed and sealed again on the device */
  type(byAct(f2.amend, "record.amend-id.party"), "CX1-ZED"); type(byAct(f2.amend, "record.amend-id.name"), "Amended Tester"); type(byAct(f2.amend, "record.amend-id.place"), "Pudu");
  await p.send(f2.amend, "record.amend-id.send");
  const sentAmend = p.posts.find((x) => /amend-id$/.test(x.route)), to = sentAmend && sentAmend.body.to;
  const amendNames = sentAmend && await openEnvelope(sentAmend.body.vault, PASS), amendPlaces = sentAmend && sentAmend.body.addrVault && await openEnvelope(sentAmend.body.addrVault, PASS);
  ok(!!sentAmend && sentAmend.body.from === "CX1-ZED" && /^C[A-Z0-9]+-PUD$/.test(to) && shape(sentAmend.body.vault) && shape(sentAmend.body.addrVault)
    && !!amendNames && amendNames[to] === "Amended Tester (Pudu)" && !Object.hasOwn(amendNames, "CX1-ZED")
    && !!amendPlaces && same(amendPlaces[to], fix.placeOf["CX1-ZED"]) && same(amendPlaces._base, fix.placeOf._base) && !Object.hasOwn(amendPlaces, "CX1-ZED")
    && !JSON.stringify(sentAmend.body).includes("Amended Tester") && !JSON.stringify(sentAmend.body).includes("Invented"),
    "Amend ID, on the held keys, re-keys the names and the places and seals them again on the device, sending no plaintext: " + (sentAmend && Object.keys(sentAmend.body)));

  /* D. WHAT LEAVES, WHAT STAYS, HOW THE KEYS ARE MADE */
  const leaks = p.wire.filter((line) => [PASS, WRONG, ...PLAIN].some((s) => line.includes(s)));
  ok(leaks.length === 0, "no request, by address, method, header or body, carries the password, a wrong one, a typed name or a place: " + leaks.map((l) => l.slice(0, 80)).join(" | "));
  ok(p.wire.filter(isVault).length > 0 && p.wire.filter((w) => isVault(w) && !/ GET /.test(w)).length === 0,
    "the unlock and the lock only read the Counter's ciphertext: no write goes to a vault address");
  const kept = store.writes.filter((x) => !/^saltMakerPending:\/all\/maker\/inputs\/(add-id|amend-id|place)$/.test(x.key));
  ok(kept.length === 0 && store.writes.every((x) => [PASS, WRONG, ...PLAIN].every((s) => !x.value.includes(s)) && !/"name"|"locality"/.test(x.value))
    && store.cookies.length === 0 && store.idb.length === 0 && p.w.sessionStorage.length === 0,
    "across the unlock, the lock and the sends, the only thing kept on the device is the ciphertext a send holds for a retry: " + JSON.stringify(kept.map((x) => x.key)));
  const L = spy.log, pbkdf2 = L.imports.filter((x) => x.alg === "PBKDF2"), slipKeys = L.imports.filter((x) => x.priv);
  ok(pbkdf2.length >= 2 && pbkdf2.every((x) => x.format === "raw" && x.extractable === false) && slipKeys.length >= 2 && slipKeys.every((x) => x.extractable === false && same(x.usages, ["deriveBits"]))
    && L.imports.every((x) => x.extractable === false) && L.derives.length > 6 && L.derives.every((x) => x.extractable === false) && L.exports.length === 0,
    "the password is a non-extractable PBKDF2 key, the slip key a non-extractable deriveBits key, every derived key non-extractable, and none is ever exported: "
    + JSON.stringify({ imports: L.imports.length, derives: L.derives.length, exports: L.exports.length }));

  /* C. LOCK. A page hidden, ended(), a lapse and Lock each, on a page open on a name, a place, the key and a picture */
  const locked = async (name, trigger) => {
    const q = await open();
    await q.tap("nav.record"); await q.tap("part.record.customers");
    await q.tap("nav.orders"); await q.tap("claim.open", CLAIM);
    await q.unlockFrom(q.ask(q.claim()), PASS);
    const was = q.names().length > 0 && !!q.claim()?.querySelector('[data-act="claim.slip"]') && q.urls.made.length === 1 && q.urls.revoked.length === 0 && q.state() === "Open on this phone"
      && q.gates().every((g) => /^Names and places are open/.test(g.textContent));
    await trigger(q);
    await q.work.quiet();
    const card2 = q.claim(), form = q.form("New customer"), before = q.wire.filter(isVault).length, postsBefore = q.posts.length;
    ok(was, name + ": the page is open on a name, a place, the key and a picture before the lock, so what follows is not vacuous");
    ok(q.names().length === 0 && q.d.querySelectorAll(".maker-name").length === 0, name + ": no name is left beside a code");
    ok(!q.d.querySelector("[data-maker-slip]") && q.urls.made.length === 1 && q.urls.revoked.length === 1 && q.urls.revoked[0] === q.urls.made[0],
      name + ": the slip picture is removed and its blob URL revoked");
    ok(q.state() === "Locked" && !q.d.getElementById("vaultOn").hidden && q.d.getElementById("vaultOff").hidden && q.gates().length >= 3 && q.gates().every((g) => /^Locked/.test(g.textContent) && g.querySelectorAll('[data-act="vault.unlock"]').length === 1)
      && !!card2 && /Locked/.test(card2.textContent) && card2.querySelectorAll('[data-act="vault.unlock"]').length === 1,
      name + ": the Shop row, every gate and the claim's slip read Locked with the one Unlock");
    q.type(byAct(form, "record.add-id.name"), "Zed Tester");
    await q.send(form, "record.add-id.send");
    ok(/Unlock names and places first[.]/.test(form.textContent) && q.wire.filter(isVault).length === before && q.posts.length === postsBefore,
      name + ": no key is left, so a send is refused and the vault is not read");
    q.w.close();
  };
  await locked("a page hidden", async (q) => { Object.defineProperty(q.d, "hidden", { configurable: true, get: () => true }); q.d.dispatchEvent(new q.w.Event("visibilitychange")); });
  await locked("ended()", async (q) => { q.lapse(true); await q.w.__owner("refs('/all/maker/bulletin')").catch(() => {}); });
  await locked("a lapse", async (q) => { q.w.__owner("lapsed()"); });
  await locked("Lock", async (q) => { q.d.getElementById("vaultOff").click(); });

  /* a lock closes a Sheet with a half-typed password in it, and clears the field */
  const h = await open();
  h.d.getElementById("vaultOn").click();
  byAct(h.d, "vault.passphrase").value = "half-typed";
  const sheetOpen = !h.d.getElementById("vaultSheet").hidden;
  Object.defineProperty(h.d, "hidden", { configurable: true, get: () => true });
  h.d.dispatchEvent(new h.w.Event("visibilitychange"));
  ok(sheetOpen && h.d.getElementById("vaultSheet").hidden && h.d.getElementById("vaultScrim").hidden && h.d.getElementById("vaultPass").value === "" && h.d.getElementById("vaultSay").textContent === "",
    "a page hidden while the Sheet is open closes it and clears the half-typed password");
  h.w.close();

  /* a vault with names and places but no slip key filed: the same unlock opens what there is, and the card says so */
  const n = await open({ noKey: true });
  await n.tap("nav.orders"); await n.tap("claim.open", CLAIM);
  await n.unlockFrom(n.ask(n.claim()), PASS);
  ok(n.state() === "Open on this phone" && n.names().length > 0 && /No slip key is filed, so this slip cannot be opened/.test(n.claim()?.textContent) && !n.d.querySelector("[data-maker-slip]")
    && !n.claim()?.querySelector('[data-act="vault.unlock"]') && !n.wire.some((w) => w.startsWith("/all/maker/slips/")),
    "with no slip key filed the unlock still opens the names and places, and the card says no key is filed and asks for no slip: " + (n.claim()?.textContent || "").slice(-90));
  n.w.close();
  p.w.close();
}
