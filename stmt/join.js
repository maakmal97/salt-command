/* stmt/join.js: JOIN BY LINK (plan version 5; his answers E, E1 and E2 of 02 Nov 2026, docs/plan-one-order-stream.html).
 *
 * An associate asks for a join link for ONE person (E2); he approves it, as a guest link of theirs (stmt/refs.js: shut until
 * `approved === false` turns true, Decline its own state); it works ONCE. The referee's page (/j/<id>) takes a name or
 * nickname and a locality, both required, and seals them on the phone to his slip key's public half under its own label
 * (`salt-join v1`, the pin's construction, stmt/pin.js), so no name reaches this store in the clear (rule 2): the record
 * holds the ciphertext and nothing else of them. It cannot be minted there, since the code is derived from the name and
 * the name lives only in his vault: Salt Admin opens the seal behind his one unlock and adds the ID as ever.
 *
 * SIGNED IN BY ITSELF (Fable's review of draft 3, high): the page mints a nonce, keeps it, and sends only its SHA-256; once
 * the account is open his page mints a hand-over for it (/all/handover's own mint) and the key is filed here beside that
 * hash. The key answers only a request carrying the nonce, once, and then the record forgets it: the bare id never yields
 * it, and a forwarded link after the form is sent reaches nothing.
 *
 * States: open (approved, nothing sent), sent (the seal filed), added (his Add ID made, the code noted), keyed (a hand-over
 * key waiting for its page), spent (the key handed over). Every id that is not open answers the one shut page on /j/.
 *
 * NO IMPORT but a sibling; the suite holds every file under stmt/ to that rule.
 */
import { newRef, normRef, getMany, MAX_PER_ASSOC } from "./refs.js";
import { slipShape } from "./slip.js";

export const JKEY = (id) => "j:" + id;
export const JOIN_LABEL = "salt-join v1";
export const JOIN_MAX = 4096;                       /* the seal's ciphertext, base64: a name and a locality are a few dozen bytes */
export const JOIN_OPEN_MAX = MAX_PER_ASSOC;         /* links an associate holds not yet used, as their guest links */
const HASH_RE = /^[0-9a-f]{64}$/;
const NONCE_RE = /^[A-Za-z0-9_-]{32,128}$/;

export const joinShape = (s) => slipShape(s) && String(s.ct).length <= JOIN_MAX;
/* waiting on his word: the guest link's own test, `approved === false`, never `!approved` */
export const joinWaiting = (r) => !!r && r.approved === false && r.declined !== true && !r.revoked;
/* open for the referee's form: approved, not declined or withdrawn, and nothing sent yet */
export const joinOpen = (r) => !!r && r.approved === true && r.declined !== true && !r.revoked && r.state === "open";

/** A join link for an associate (`by`, their username), shut until he approves it. */
export async function mintJoin(env, by) {
  for (let i = 0; i < 5; i++) {
    const id = newRef();
    if (await env.STMT.get(JKEY(id))) continue;
    const rec = { id, by: String(by || "").toLowerCase(), made: new Date().toISOString(), approved: false, declined: false, revoked: false, state: "open" };
    await env.STMT.put(JKEY(id), JSON.stringify(rec));
    return rec;
  }
  return null;
}

/** The record, or null. Never throws on a malformed value. */
export async function readJoin(env, id) {
  const k = normRef(id);
  if (!k) return null;
  try { return await env.STMT.get(JKEY(k), "json"); } catch (e) { return null; }
}

/** Every join link, newest first, in one bulk read a page. */
export async function listJoins(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: "j:", cursor });
    const got = await getMany(env, page.keys.map((k) => k.name));
    for (const k of page.keys) { const r = got.get(k.name); if (r && r.id) out.push(r); }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => String(b.made).localeCompare(String(a.made)));
}

/** One associate's own, newest first. */
export async function joinsBy(env, username) {
  const u = String(username || "").toLowerCase();
  return u ? (await listJoins(env)).filter((r) => r.by === u) : [];
}

async function save(env, rec) { await env.STMT.put(JKEY(rec.id), JSON.stringify(rec)); return rec; }

/** His word: approve, decline or withdraw. A link already used keeps its state; only an open one changes its door. */
export async function setJoin(env, id, patch) {
  const rec = await readJoin(env, id);
  if (!rec) return null;
  if ("approved" in patch) { rec.approved = !!patch.approved; if (rec.approved) rec.declined = false; }
  if ("declined" in patch) { rec.declined = !!patch.declined; if (rec.declined) rec.approved = false; }
  if ("revoked" in patch) rec.revoked = !!patch.revoked;
  return save(env, rec);
}

/** The referee's form, once: the seal and the hash of their page's nonce. Answers { rec } or { error }. */
export async function sendJoin(env, id, body) {
  const rec = await readJoin(env, id);
  if (!joinOpen(rec)) return { error: "shut" };
  const seal = body && body.seal, nh = body && body.nonceHash;
  if (!joinShape(seal) || typeof nh !== "string" || !HASH_RE.test(nh)) return { error: "shape" };
  rec.seal = { v: seal.v, epk: seal.epk, iv: seal.iv, ct: seal.ct };
  rec.nonceHash = nh; rec.state = "sent"; rec.sentAt = new Date().toISOString();
  return { rec: await save(env, rec) };
}

/** His Add ID made for it: the code noted, never a name. */
export async function addedJoin(env, id, code) {
  const rec = await readJoin(env, id);
  if (!rec || rec.state !== "sent" || typeof code !== "string" || !/^[A-Z]{1,3}[0-9]{1,2}-[A-Z0-9]{1,6}$/.test(code)) return null;
  rec.code = code; rec.state = "added"; rec.addedAt = new Date().toISOString();
  delete rec.seal;   /* opened and filed in his vault: the ciphertext is kept no longer than it is needed */
  return save(env, rec);
}

/** The hand-over key, filed beside the nonce's hash for the page that sent the form. */
export async function keyJoin(env, id, key) {
  const rec = await readJoin(env, id);
  if (!rec || rec.state !== "added" || typeof key !== "string" || !key) return null;
  rec.key = key; rec.state = "keyed"; rec.keyAt = new Date().toISOString();
  return save(env, rec);
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const nonceHashOf = async (nonce) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(nonce))));

/** The page waiting: its state, and the key once, only to the page holding the nonce. Answers { state, key? } or null. */
export async function waitJoin(env, id, nonce) {
  const rec = await readJoin(env, id);
  if (!rec || typeof nonce !== "string" || !NONCE_RE.test(nonce) || !rec.nonceHash) return null;
  if ((await nonceHashOf(nonce)) !== rec.nonceHash) return null;
  if (rec.state !== "keyed" || !rec.key) return { state: rec.state };
  const key = rec.key;
  delete rec.key; rec.state = "spent"; rec.spentAt = new Date().toISOString();
  await save(env, rec);
  return { state: "spent", key };
}

/** What an associate sees of their own: when it was made and where it stands, in words. Never the seal, the code or a name. */
export const joinMine = (origin, r) => ({ id: r.id, made: r.made || null, url: origin + "/j/" + r.id,
  state: r.revoked ? "withdrawn" : r.declined === true ? "declined" : r.approved === false ? "waiting" : r.state === "open" ? "open" : "used" });
/** What he sees: the record less the key; the seal travels only while sent, for his one unlock to open. */
export const joinOwner = (r) => { const o = Object.assign({}, r); delete o.key; delete o.nonceHash; return o; };
