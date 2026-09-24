/* stmt/refs.js: THE GUEST REFERRAL LINKS.
 *
 * His instruction of 10 Sep 2026: he hands out links, each carrying a unique referral ID he can
 * tell apart, and each opening a landing page that shows ONE BOARD'S PRICES AND NOTHING ELSE. No
 * statement, no order, no account.
 *
 * SINCE v696 THERE IS ONE STANDING LINK PER TIER (his instruction, 18 Sep 2026: "for the
 * guest links, produce exactly 5 links, for the five tier pricing"). Since 23 Sep 2026 the tiers are
 * four, Titanium, Platinum, Gold and Silver; Ambassador is the floor and never a guest's. Bronze's
 * link was kept, because an id already handed out must keep opening something: it names a level the
 * book no longer has, so it opens the stranger's board, which is Silver's. Each standing link carries its LEVEL, is minted once and kept for good, so an id already
 * handed out never changes what it opens, and he picks which of the five to give a stranger.
 *
 * SINCE v658 A LINK MAY INSTEAD NAME ITS INTRODUCER. The board is the ladder, so a guest's
 * level is derived: two above the introducer's where there is room, else one, capped at the last.
 * The level is NOT stored here. It is computed by the publish from the introducer's tier at that
 * moment and written as the link's own board, so a link follows its introducer up when he moves
 * them, and a level frozen into a record can never fall out of step with the book.
 *
 * THE ID IS THE CREDENTIAL, and that is the whole gate. There is no password, because there is
 * nothing here worth a password: a board price is a thing he prints and hands to strangers, and the
 * link exists to tell him WHICH stranger, not to keep a secret. Eight symbols of the username
 * alphabet is about thirty-nine bits, which is far past guessing at the rate a Worker will answer,
 * and an unknown id is answered exactly as a revoked one is, so the space cannot be walked either.
 *
 * WHAT IS DELIBERATELY NOT SEALED. Every other document on this site is AES-GCM ciphertext at rest,
 * because every other document is a customer's own account. A board is not: it is his own price
 * list, the same one he prints. Encrypting it under a key that travels in the same URL would be
 * ceremony, not security, and it would hide from him what he is handing out. Stated here so nobody
 * later reads the difference as an oversight.
 *
 * THE LABEL IS FOR HIM AND NEVER LEAVES. It is how he knows who he gave a link to, and it is
 * returned only on the Access-gated route; the guest page never carries it. A label may be a
 * person or a shop, so it is treated as his own note, not as anything to publish.
 *
 * NO IMPORT but a sibling; the suite holds every file under stmt/ to that rule.
 */

/* ---- AN ASSOCIATE MAY MINT ONE, AND HE APPROVES IT (v709, his instruction of 18 Sep 2026) ------
 * "If they want to refer to a customer, they will be able to mint their own link, just like how I'd
 * choose a customer and generate the link. It will need to be approved by me, and I can choose to
 * change price tier if need be."
 *
 * PENDING MEANS THE DOOR IS SHUT, from the moment the record exists. The id IS the credential, so an
 * associate could hand it out the second they made it; a link that is created openable and gated
 * later is a link that was open. `approved: false` is written at mint and the guest door refuses it
 * exactly as it refuses a withdrawn one, with the same 404 an id that never existed gets.
 *
 * THE TEST IS `approved === false`, NEVER `!approved`. readRef hands back the stored JSON untouched
 * and not one link already in the store carries the field, so the loose test would shut every link
 * he has ever handed out, and shut it SILENTLY: an unknown, a withdrawn and a pending one all answer
 * the same 404 by design, so nobody would report it.
 *
 * DECLINED IS ITS OWN STATE (his decision D13, 24 Sep 2026): `declined: true` beside `approved: false`,
 * so the door stays shut by the very test above and nothing that reads only `approved` can open it,
 * while every reader that says "waiting" leaves it out. Approving it later clears the mark.
 *
 * "IF NEED BE" MEANS IT WORKS WITHOUT HIM. An approved link with no level follows the v658 rule, the
 * associate being the introducer, so the guest is quoted two levels above theirs. He may pin a level
 * instead, and then it reads that level's board and needs nothing published for it (v699).
 *
 * NO LABEL FROM AN ASSOCIATE. A label is HIS note (below), and a note typed by a customer would be
 * the first plaintext anybody but him has ever put into this store. He can label one when he
 * approves it.
 */
export const MAX_PER_ASSOC = 10;

/* the username alphabet: no 0/1/i/l/o/u, because these are read off a screen and typed on a phone */
const ALPHA = "23456789abcdefghjkmnpqrstvwxyz";
export const REF_RE = /^[23456789abcdefghjkmnpqrstvwxyz]{4}-[23456789abcdefghjkmnpqrstvwxyz]{4}$/;
const RKEY = (id) => "g:" + id;
export const MAX_LABEL = 60;

/** Case and punctuation forgiven, exactly as a username is; anything else is "". */
export function normRef(s) {
  s = String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (s.length !== 8) return "";
  s = s.slice(0, 4) + "-" + s.slice(4);
  return REF_RE.test(s) ? s : "";
}

/* REJECTION SAMPLING, not a modulo. The alphabet is thirty characters and a byte is 256 values, so
   `byte % 30` would make the first sixteen symbols about 12% likelier than the rest. It costs
   nothing to draw again, and a biased id is a smaller id than it looks. */
export function newRef(rand) {
  const draw = rand || ((n) => crypto.getRandomValues(new Uint8Array(n)));
  let out = "";
  while (out.length < 8) {
    for (const b of draw(16)) {
      if (b >= 240) continue;                 // 240 = 8 * 30, the largest clean multiple
      out += ALPHA[b % ALPHA.length];
      if (out.length === 8) break;
    }
  }
  return out.slice(0, 4) + "-" + out.slice(4);
}

/** A label as it will be stored: trimmed, capped, and stripped of the control characters that
 *  would let a note break the JSON it is read back out of. */
export function cleanLabel(s) {
  return String(s == null ? "" : s).replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, MAX_LABEL);
}

/** Mint one. Collides at about one in 10^11 for forty links, and is checked anyway because the
 *  cost is one read and the failure would silently re-point a link already handed out. */
export async function mintRef(env, { introducer, tier, label, by, level }) {
  /* v658: `tier` is kept on the record for the links minted before the introducer rule, so an old
     one still opens; nothing reads it to price any more. A new link carries its introducer instead.
     v696: or its LEVEL, which is what the five standing links carry. */
  const t = Number(tier) === 1 ? 1 : 2;
  for (let i = 0; i < 5; i++) {
    const id = newRef();
    if (await env.STMT.get(RKEY(id))) continue;
    /* v709: `by` is who minted it. Empty or "standing" is him, and his links are open at once; an
       associate's username means it waits. `standing` stays FALSE for an associate's link, or
       ensureStanding would adopt it as one of the five he hands to strangers. */
    const mintedBy = String(by || "");
    const mine = !mintedBy || mintedBy === "standing";
    const rec = { id, tier: t, introducer: String(introducer || "").toLowerCase() || null,
      level: level || null, standing: mine && !!level,
      approved: mine,
      label: cleanLabel(label), made: new Date().toISOString(),
      by: mintedBy, opens: 0, first: null, last: null, revoked: false };
    await env.STMT.put(RKEY(id), JSON.stringify(rec));
    return rec;
  }
  return null;
}

/* ONE FOR EACH TIER, ALWAYS (v696). Ensured rather than minted on a tap, so the answer to "what
 * are my links" is always one a tier and he never has to remember to make them. It is idempotent:
 * a level that already has a standing link keeps the id it was given, because an id handed to a
 * stranger must never change what it opens. Ambassador is not among them; it is the floor.
 *
 * The names come from the book, through the roster the publish writes, so the desk decides what the
 * levels are called and this file never states them. With no names to hand it makes none, rather
 * than inventing five. */
export async function ensureStanding(env, names) {
  const want = Array.isArray(names) ? names.slice(1).filter((x) => typeof x === "string" && x) : [];
  if (!want.length) return [];
  const have = await listRefs(env);
  const out = [];
  for (const level of want) {
    const found = have.find((r) => r.standing && r.level === level);
    out.push(found || await mintRef(env, { level, label: level, by: "standing" }));
  }
  return out.filter(Boolean);
}

/** The record, or null when there is none. Never throws on a malformed value. */
export async function readRef(env, id) {
  const k = normRef(id);
  if (!k) return null;
  try { return await env.STMT.get(RKEY(k), "json"); } catch (e) { return null; }
}

/** Every link, newest first. Forty of these at most, so one list and one read each is the whole
 *  cost and there is no index to keep in step with the records. */
export async function listRefs(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.STMT.list({ prefix: "g:", cursor });
    for (const k of page.keys) {
      const r = await env.STMT.get(k.name, "json");
      if (r && r.id) out.push(r);
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  return out.sort((a, b) => String(b.made).localeCompare(String(a.made)));
}

/** Every link one username minted, newest first. Their own and nobody else's. */
export async function refsBy(env, username) {
  const u = String(username || "").toLowerCase();
  if (!u) return [];
  return (await listRefs(env)).filter((r) => String(r.by || "").toLowerCase() === u);
}

/** One field at a time, read-modify-put, so nothing else in the record is lost. */
export async function setRef(env, id, patch) {
  const rec = await readRef(env, id);
  if (!rec) return null;
  for (const k of ["approved", "revoked", "declined"]) if (k in (patch || {})) rec[k] = !!patch[k];
  if (patch && "level" in patch) rec.level = patch.level || null;
  if (patch && typeof patch.label === "string") rec.label = cleanLabel(patch.label);
  await env.STMT.put(RKEY(rec.id), JSON.stringify(rec));
  return rec;
}

/** Mark a link revoked. It is kept rather than deleted, so the count of what it did survives it
 *  and the id can never be minted onto a second party. */
export async function revokeRef(env, id, on = true) {
  const rec = await readRef(env, id);
  if (!rec) return null;
  rec.revoked = !!on;
  await env.STMT.put(RKEY(rec.id), JSON.stringify(rec));
  return rec;
}

/** Count an open. This is the answer to "which of the two links did he actually use", which is the
 *  question the whole feature exists for, so it is written before the page is served rather than
 *  after, and a failure to write it is not allowed to fail the page. */
export async function markOpen(env, rec) {
  try {
    const now = new Date().toISOString();
    rec.opens = (rec.opens || 0) + 1;
    rec.first = rec.first || now;
    rec.last = now;
    await env.STMT.put(RKEY(rec.id), JSON.stringify(rec));
  } catch (e) { /* a board still opens; the count is the only thing lost */ }
  return rec;
}
