#!/usr/bin/env node
/* tools/book-load.mjs: LOAD THE FOLDED BOOK INTO THE SHADOW BOOK (S2a of the Book plan, 18 Oct 2026).
 *
 * The chain job runs this after the fold has deployed and re-seeded D1: it posts ledger/book.json and the derived PRICING
 * (ledger/ledger.json) to the Desk Worker's POST /book/load, which refills the Book object (src/book.js). The load is
 * idempotent, so a retry here, a replayed fold or a second run lands once. A Durable Object cannot be reached by wrangler or
 * the API, so the road is a route: Access's service token (the same one that reads /rev) AND the Book's own key SALT_BOOK_KEY.
 *
 * A FAILED LOAD IS SAID AND NEVER BLOCKS: exit 1 with an ::error:: line, and the workflow step is continue-on-error, so the
 * fold, the marks and the publish stand. Nothing reads the Book yet.
 *
 * PARITY (S2b of the Book plan, 20 Oct 2026). The load answers a read-back of what the Book holds, out of its own SQLite: per
 * collection a count and a digest, per document a digest (src/book.js readback). `expected` works the same out of git's files BY
 * ITS OWN HAND (node:crypto and its own canonical JSON, nothing from src/book.js, so a fault in either side shows), and `compare`
 * names every collection or document that differs: missing on either side, another count, another digest. Names and counts only,
 * never a row: the log is public. A difference is a red step (exit 1, ::error::, the run summary), and like a failed load it never
 * blocks or rolls back the fold, since git is the source until S5. Each collection is compared as a set of rows: the Book keeps
 * no row order, which stays git's until S5's event log. PRICING is compared as git carries it: tools/book.mjs mints no takenAt
 * since S2b, and the Book still strips one, so a stamp that returns on the git side is red here.
 *
 *   node tools/book-load.mjs          post the live book
 *   SALT_BASE, SALT_BOOK_KEY, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET in the environment
 */
import "./cloudflare.mjs";
import { readFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function payload(bookFile, ledgerFile, rev) {
  const book = JSON.parse(readFileSync(bookFile, "utf8"));
  const pricing = JSON.parse(readFileSync(ledgerFile, "utf8")).ledger.PRICING;
  if (!pricing) throw new Error("ledger/ledger.json carries no PRICING");
  return JSON.stringify({ rev, book, pricing });
}

/* git's side of the parity, by its own hand: the same JSON with every object's keys in order, hashed with node:crypto */
export function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v !== null && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
const h256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/* What the Book should read back for this book and PRICING: {rows: {coll: {n, digest}}, state: {k: digest}}. An empty
   collection books no row, so it is not listed (the Book cannot list what it holds none of). */
export function expected(book, pricing) {
  const rows = {}, state = {};
  for (const k of Object.keys(book)) {
    const v = book[k];
    if (!Array.isArray(v)) { state[k] = h256(canonical(v)).slice(0, 16); continue; }
    if (!v.length) continue;
    rows[k] = { n: v.length, digest: h256(v.map((r) => h256(canonical(r))).sort().join("\n")).slice(0, 16) };
  }
  if (pricing !== undefined && pricing !== null) state.PRICING = h256(canonical(pricing)).slice(0, 16);
  return { rows, state };
}

/* Git's side against the Book's read-back: {ok, rows, docs, colls, differ: [what differs, by name]} */
export function compare(want, got) {
  const differ = [];
  const gr = (got && got.rows) || {}, gs = (got && got.state) || {};
  for (const k of [...new Set([...Object.keys(want.rows), ...Object.keys(gr)])].sort()) {
    const a = want.rows[k], b = gr[k];
    if (!a) differ.push(k + " (only in the Book, " + (+b.n || 0) + " rows)");
    else if (!b) differ.push(k + " (not in the Book, git " + a.n + " rows)");
    else if (a.n !== b.n) differ.push(k + " (git " + a.n + " rows, Book " + b.n + ")");
    else if (a.digest !== b.digest) differ.push(k + " (" + a.n + " rows, other content)");
  }
  for (const k of [...new Set([...Object.keys(want.state), ...Object.keys(gs)])].sort()) {
    if (!(k in want.state)) differ.push(k + " (only in the Book)");
    else if (!(k in gs)) differ.push(k + " (not in the Book)");
    else if (want.state[k] !== gs[k]) differ.push(k + " differs");
  }
  const rows = Object.values(want.rows).reduce((n, r) => n + r.n, 0);
  return { ok: !differ.length, rows, docs: Object.keys(want.state).length, colls: Object.keys(want.rows).length, differ };
}

/* the one line the step says, to the log and the run summary: counts and names, never a row */
export function line(r, par) {
  if (!r.ok) return "Book NOT loaded: " + r.error;
  const head = `Book loaded: ${r.rows} rows and ${r.docs} documents; ${r.added} booked, ${r.revised} revised, ${r.gone} gone, ${r.returned} returned, digest ${String(r.digest).slice(0, 12)}`;
  if (!par) return head + "; parity NOT CHECKED: the Book answered no read-back";
  return par.ok ? head + `; parity: the Book agrees with git over ${par.rows} rows in ${par.colls} collections and ${par.docs} documents`
    : head + "; parity FAILED: " + par.differ.join(", ");
}

/* the step's verdict: green only on a load whose read-back agrees */
export const passed = (r, par) => !!(r.ok && par && par.ok);

/* post with up to `tries` attempts on a network fault or a 5xx; a 4xx is the route's answer and is not retried */
export async function post(base, body, env, { tries = 3, wait = 2000, fetchImpl = fetch } = {}) {
  const key = String(env.SALT_BOOK_KEY || "");
  if (!key) return { ok: false, error: "SALT_BOOK_KEY is not set, so the Book was not loaded" };
  const headers = { "content-type": "application/json", "X-Book-Key": key };
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }
  let last = "";
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetchImpl(base.replace(/\/+$/, "") + "/book/load", { method: "POST", headers, body });
      const j = await r.json().catch(() => ({}));
      if (r.status === 200 && j.ok) return j;
      last = "HTTP " + r.status + " " + String(j.error || "").slice(0, 200);
      if (r.status < 500) return { ok: false, error: last };
    } catch (e) { last = String((e && e.message) || e); }
    if (i < tries) await new Promise((res) => setTimeout(res, wait));
  }
  return { ok: false, error: last };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const base = process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev";
  let r, par = null;
  try {
    const body = payload(resolve(REPO, "ledger", "book.json"), resolve(REPO, "ledger", "ledger.json"), process.env.GITHUB_SHA || null);
    r = await post(base, body, process.env);
    if (r.ok && r.readback) { const sent = JSON.parse(body); par = compare(expected(sent.book, sent.pricing), r.readback); }
  } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
  const said = line(r, par), good = passed(r, par);
  console.log(good ? said : "::error::" + said);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n### Book (shadow)\n" + said + "\n");
  process.exit(good ? 0 : 1);
}
