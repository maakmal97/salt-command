#!/usr/bin/env node
/* tools/book-pitr.mjs: THE BOOK'S POINT-IN-TIME RECOVERY, PROVED (S2c of the Book plan, 20 Oct 2026).
 *
 * The platform keeps 30 days of a SQLite Durable Object's history and restores it to a bookmark (src/book.js, RECOVERY). This
 * proves it on the TEST object of the Book's own class, never the live Book: the Worker's POST /book/pitr names the test object
 * alone, and the object answers a recovery verb only when it is that one.
 *
 *   clear; load the book at an earlier fold (A) and read it back against git at A, keeping A's bookmark; load the tip (B) and
 *   read it back against git at B; arm A's bookmark, restart, and read back until it agrees with git at A (and so not with B),
 *   with one load on record; arm the undo the platform handed back, restart, and read back until it agrees with git at B, two
 *   loads on record; clear, whatever happened. Then READ the live Book's window: is its first load still in reach.
 *
 * Git's side is book-load's own (expected, compare: node:crypto and its own canonical JSON). The line carries names, counts,
 * short shas and a verdict, never a row or a bookmark: the Actions log is public. Run by .github/workflows/book-pitr.yml, by hand.
 *
 *   node tools/book-pitr.mjs [--from <sha>]     A = <sha>, else the second newest commit that changed ledger/book.json
 *   SALT_BASE, SALT_BOOK_KEY, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET in the environment
 */
import "./cloudflare.mjs";
import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expected, compare } from "./book-load.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/* the book and its PRICING as git held them at a commit. A commit before S2b (v1173) carries PRICING.takenAt, a stamp minted per
   extract that the Book never keeps; it is dropped here, so an older fold can be A. The fold's own parity (book-load) still
   compares the tip's PRICING as it is. */
export function bookAt(sha) {
  const book = JSON.parse(git("show", sha + ":ledger/book.json"));
  const pricing = JSON.parse(git("show", sha + ":ledger/ledger.json")).ledger.PRICING;
  if (!pricing) throw new Error("ledger/ledger.json carries no PRICING at " + sha.slice(0, 8));
  const { takenAt, ...steady } = pricing;
  return { sha, book, pricing: steady };
}

/* A: the newest commit before B that changed the book into something else, so the restore has a difference to prove */
export function pickFrom(B, from) {
  if (from) return bookAt(git("rev-parse", from).trim());
  const want = JSON.stringify(expected(B.book, B.pricing));
  for (const sha of git("log", "--format=%H", "-n", "12", B.sha, "--", "ledger/book.json").split("\n").filter(Boolean)) {
    if (sha === B.sha) continue;
    const A = bookAt(sha);
    if (JSON.stringify(expected(A.book, A.pricing)) !== want) return A;
  }
  throw new Error("no earlier book differs from the tip's within twelve commits");
}

/* read back until `good` holds, the restart landing on the object's next start */
async function settle(call, good, { tries, sleep }) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    if (i) await sleep();
    last = await call({ verb: "readback" });
    if (last && last.ok && good(last)) return { ok: true, r: last };
  }
  return { ok: false, r: last };
}

/* THE TEST. `call(body)` posts one recovery verb and answers its JSON; `window()` reads the live Book's window. Answers
   {ok, error?, a, b, rows, colls, docs, live}. */
export async function recover({ call, window, A, B, tries = 10, sleep = () => new Promise((r) => setTimeout(r, 3000)) }) {
  const wantA = expected(A.book, A.pricing), wantB = expected(B.book, B.pricing);
  const out = { ok: false, a: A.sha.slice(0, 8), b: B.sha.slice(0, 8) };
  if (JSON.stringify(wantA) === JSON.stringify(wantB)) return { ...out, error: "the two books are the same, so a restore would prove nothing" };
  const fail = (why) => { throw new Error(why); };
  const agrees = (want, r) => compare(want, r.readback);
  try {
    /* a run that died between arm and restart left its arm standing, to land on the next start: restart first, so it lands now */
    if (!(await call({ verb: "restart" })).ok) fail("the test object did not restart before the test");
    if (!(await settle(call, () => true, { tries, sleep })).ok) fail("the test object did not answer after its first restart");
    if (!(await call({ verb: "clear" })).ok) fail("the test object was not cleared");
    const la = await call({ verb: "load", rev: A.sha, book: A.book, pricing: A.pricing });
    if (!la.ok || !agrees(wantA, la).ok) fail("the load of A did not read back as git at A: " + (la.error || agrees(wantA, la).differ.join(", ")));
    if (typeof la.bookmark !== "string" || !la.bookmark) fail("the load of A answered no bookmark");
    const lb = await call({ verb: "load", rev: B.sha, book: B.book, pricing: B.pricing });
    if (!lb.ok || !agrees(wantB, lb).ok) fail("the load of B did not read back as git at B: " + (lb.error || agrees(wantB, lb).differ.join(", ")));
    const armed = await call({ verb: "arm", bookmark: la.bookmark });
    if (!armed.ok || typeof armed.undo !== "string" || !armed.undo) fail("A's bookmark was not armed: " + (armed.error || "no undo"));
    if (!(await call({ verb: "restart" })).ok) fail("the test object did not restart");
    const back = await settle(call, (r) => r.loads === 1 && agrees(wantA, r).ok, { tries, sleep });
    if (!back.ok) fail("the restore to A did not land: " + (back.r ? "loads " + back.r.loads + "; " + agrees(wantA, back.r).differ.join(", ") : "no read-back"));
    if (agrees(wantB, back.r).ok) fail("the restored object still agrees with B");
    const undo = await call({ verb: "arm", bookmark: armed.undo });
    if (!undo.ok) fail("the undo was not armed: " + (undo.error || ""));
    if (!(await call({ verb: "restart" })).ok) fail("the test object did not restart for the undo");
    const fwd = await settle(call, (r) => r.loads === 2 && agrees(wantB, r).ok, { tries, sleep });
    if (!fwd.ok) fail("the undo to B did not land: " + (fwd.r ? "loads " + fwd.r.loads + "; " + agrees(wantB, fwd.r).differ.join(", ") : "no read-back"));
    const pa = agrees(wantA, back.r);
    Object.assign(out, { rows: pa.rows, colls: pa.colls, docs: pa.docs });
  } catch (e) {
    out.error = String((e && e.message) || e);
  } finally {
    try { await call({ verb: "clear" }); } catch (e) { out.error = out.error || "the test object was not cleared after"; }
  }
  if (out.error) return out;
  const w = await window();
  out.live = w && w.ok ? { loads: w.loads, first: w.first, from: w.from, reachable: !!w.reachable } : null;
  if (!out.live || !out.live.reachable) return { ...out, error: "the live Book's history is not in reach" };
  return { ...out, ok: true };
}

/* how far back the live Book can go: its first load, or the platform's 29 days once the Book is older */
const reach = (l) => l.from === l.first ? `from its first load (${l.first}, ${l.loads} loads)` : `from ${l.from}, 29 days back (${l.loads} loads; the first is older)`;

/* the one line, to the log and the run summary: names, counts, short shas */
export function line(r) {
  if (!r.ok) return "Book recovery FAILED (" + r.b + " back to " + r.a + "): " + r.error;
  return "Book recovery: the test Book restored from " + r.b + " back to " + r.a + " agrees with git there over " + r.rows + " rows in " + r.colls + " collections and " + r.docs + " documents, and forward again to " + r.b + "; the live Book's history is in reach " + reach(r.live);
}

/* post or get with the two locks: the Access service token and the Book's key */
export function caller(base, env, fetchImpl = fetch) {
  const key = String(env.SALT_BOOK_KEY || "");
  if (!key) throw new Error("SALT_BOOK_KEY is not set");
  const headers = { "content-type": "application/json", "X-Book-Key": key };
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }
  const root = base.replace(/\/+$/, "");
  const ask = async (path, init) => {
    const r = await fetchImpl(root + path, { ...init, headers });
    const j = await r.json().catch(() => ({}));
    return r.status === 200 ? j : { ok: false, error: "HTTP " + r.status + " " + String(j.error || "").slice(0, 200) };
  };
  return {
    call: async (body) => { try { return await ask("/book/pitr", { method: "POST", body: JSON.stringify(body) }); } catch (e) { return { ok: false, error: String((e && e.message) || e) }; } },
    window: () => ask("/book/window", { method: "GET" })
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const base = process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev";
  const i = process.argv.indexOf("--from"), from = i > 0 ? process.argv[i + 1] : null;
  let r;
  try {
    const B = bookAt(git("rev-parse", "HEAD").trim()), A = pickFrom(B, from);
    r = await recover({ ...caller(base, process.env), A, B });
  } catch (e) { r = { ok: false, a: "?", b: "?", error: String((e && e.message) || e) }; }
  const said = line(r);
  console.log(r.ok ? said : "::error::" + said);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n### Book recovery (test object)\n" + said + "\n");
  process.exit(r.ok ? 0 : 1);
}
