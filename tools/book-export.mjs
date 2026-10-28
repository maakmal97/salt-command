#!/usr/bin/env node
/* tools/book-export.mjs: S5f-6 OF THE BOOK PLAN, THE EXPORT THE CHAIN RUNS WITH THE BOOK AS THE SOURCE (29 Oct 2026; his answer to Ask C). Dormant: the chain runs it only when D1 `book_source` reads book.
 *
 * With the Book as the source an approval is not a version and the fold does not run, so git's ledger/book.json is an EXPORT of the Book, and the publish (which reads git's files) must read a current one. Every chain
 * run in that world does the first four steps; the daily run (the 00:23 Kuala Lumpur net, or a dispatch with `export`) does all of them and the workflow commits the result:
 *   1  the Book is COMPACTED (--day only: POST /book/compact marks the drafts it closes committed and writes the watermark; docs/DESK.md "S5f-3")
 *   2  the Book's view (the base with every open entry, or the base itself after a compaction) is fetched (GET /book/ledger) and written as ledger/book.json, one row a line, never into a version
 *   3  the master's baked book is brought level (booksync --sync) and the derived documents are computed over it (ledger.mjs: PRICING, OPEN, TERMS, REWARD, STOCK, by the page's own jsdom) and sent back to the Book
 *      for the revision they were computed at (POST /book/derived, which moves no revision), so the drafters' staleness flags clear
 *   4  SALT_BOOK_REV is written to $GITHUB_ENV, so the publish seals <build id>.<revision> as the Desk's /stmt/rev answers
 *   5  a row with no note gets one (POST /book/notes): the day's tapped rows carry blank notes. NOT BUILT: the model's own note (his D7); what is written is the tool's deterministic line, which says no model wrote
 *      it, exactly as tools/foldnotes.mjs does for a fold with no model. A follow-up replaces it where the model key lives.
 * The log says counts and codes only, never a figure or a row (the log is public). Any step that fails fails the run before the publish, so a statement is never sealed from a half export.
 *
 *   node tools/book-export.mjs [--day]     SALT_BASE, SALT_BOOK_KEY, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, GITHUB_ENV in the environment */
import "./cloudflare.mjs";
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchBookSource } from "./book-source.mjs";
import { writeBookFile } from "./booksync.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DERIVED_KEYS = ["PRICING", "OPEN", "TERMS", "REWARD", "STOCK"];
const COLLS = ["sales", "purchases", "loans"];

const headersOf = (env) => {
  const h = { "content-type": "application/json", "X-Book-Key": String(env.SALT_BOOK_KEY || "") };
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) { h["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID; h["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET; }
  return h;
};
/** POST a body to one of the Book's keyed routes; {ok, status, body}. A 5xx or a network failure is tried again; a 4xx is the route's answer. */
export async function postBook(base, env, path, body, { tries = 3, wait = 2000, fetchImpl = fetch } = {}) {
  if (!env.SALT_BOOK_KEY) return { ok: false, status: 0, body: { error: "SALT_BOOK_KEY is not set" } };
  let last = { ok: false, status: 0, body: { error: "no answer" } };
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetchImpl(base.replace(/\/+$/, "") + path, { method: "POST", headers: headersOf(env), body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({}));
      last = { ok: r.status === 200 && !!j && j.ok === true, status: r.status, body: j };
      if (r.status < 500) return last;
    } catch (e) { last = { ok: false, status: 0, body: { error: String((e && e.message) || e) } }; }
    if (i < tries) await new Promise((res) => setTimeout(res, wait));
  }
  return last;
}

/** the notes the tool writes for rows the tap booked that carry none (`tapped`: their rids): one line, saying no model wrote it. With no list, every row with a rid and no note. */
export function blankNotes(book, day, tapped) {
  const notes = {}, only = tapped ? new Set(tapped) : null;
  for (const c of COLLS) for (const r of (book && book[c]) || []) if (r && typeof r.rid === "string" && /^[a-z]\d{3,6}$/.test(r.rid) && (!only || only.has(r.rid)) && !(typeof r.note === "string" && r.note.trim()))
    notes[r.rid] = `Booked when it was approved and written into this book by the export of ${day}. Written by the tool, not a model: the figures are the row's own.`;
  return notes;
}
const chunk = (o, n) => { const k = Object.keys(o), out = []; for (let i = 0; i < k.length; i += n) out.push(Object.fromEntries(k.slice(i, i + n).map((x) => [x, o[x]]))); return out; };

/** The export. `run(cmd, args)` runs a laptop tool in the checkout (replaced by the suite); `root` is the checkout. Answers {ok, rev, rows, notes, derived, steps[]} or {ok: false, step, error}. */
export async function exportBook({ base, env, root = REPO, day = false, fetchImpl = fetch, run = (cmd, args) => execFileSync(process.execPath, [join(root, "tools", cmd), ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), now = new Date(), tries = 3, wait = 2000 } = {}) {
  const steps = [], fail = (step, error) => ({ ok: false, step, error: String(error).slice(0, 300), steps });
  const kl = new Date(now.getTime() + 8 * 36e5).toISOString().slice(0, 10);
  if (day) {
    const c = await postBook(base, env, "/book/compact", {}, { fetchImpl, tries, wait });
    if (!c.ok) return fail("compact", c.body && c.body.error || "HTTP " + c.status);
    steps.push("compacted " + (c.body.compacted || 0) + ", marked " + (c.body.closed || 0));
  }
  let got = await fetchBookSource(base, env, { view: true, fetchImpl, tries, wait });
  if (got.error) return fail("fetch", got.error);
  /* the notes first: they move the revision once, and the documents below are computed for the revision the export leaves */
  /* only on the day's run: a row an open entry holds is not in the base yet, and a note can be written only into the base (after the compaction above) */
  const notes = day ? blankNotes(got.book, kl, got.tapped || []) : {};
  let written = 0;
  for (const p of chunk(notes, 200)) {
    const n = await postBook(base, env, "/book/notes", { notes: p }, { fetchImpl, tries, wait });
    if (!n.ok) return fail("notes", n.body && n.body.error || "HTTP " + n.status);
    written += n.body.written || 0;
  }
  steps.push("notes written for " + written + " rows");
  if (written) { got = await fetchBookSource(base, env, { view: true, fetchImpl, tries, wait }); if (got.error) return fail("fetch", got.error); }
  if (!Number.isInteger(got.rev)) return fail("fetch", "the Book answered no revision");
  const bookFile = join(root, "ledger", "book.json");
  writeBookFile(got.book, bookFile);
  steps.push("wrote the book at revision " + got.rev + " (" + (got.book.sales || []).length + " sales, " + (got.book.purchases || []).length + " purchases)");
  try { run("booksync.mjs", ["--sync"]); run("ledger.mjs", []); } catch (e) { return fail("derive", (e && e.stderr) || (e && e.message) || e); }
  const ledgerFile = join(root, "ledger", "ledger.json");
  if (!existsSync(ledgerFile)) return fail("derive", "ledger.mjs wrote no ledger/ledger.json");
  const ext = JSON.parse(readFileSync(ledgerFile, "utf8")), derived = {};
  for (const k of DERIVED_KEYS) if (ext.ledger && ext.ledger[k] !== undefined && ext.ledger[k] !== null) derived[k] = ext.ledger[k];
  if (!derived.PRICING) return fail("derive", "ledger/ledger.json carries no PRICING");
  const d = await postBook(base, env, "/book/derived", { derived, forRev: got.rev }, { fetchImpl, tries, wait });
  if (!d.ok && !(d.status === 409 && d.body && d.body.stale)) return fail("derived", d.body && d.body.error || "HTTP " + d.status);
  steps.push(d.ok ? "the derived documents are for revision " + got.rev + " (" + d.body.changed + " changed)" : "the Book already holds newer derived documents");
  if (env.GITHUB_ENV) appendFileSync(env.GITHUB_ENV, "SALT_BOOK_REV=" + got.rev + "\n");
  return { ok: true, day, rev: got.rev, rows: (got.book.sales || []).length + (got.book.purchases || []).length, notes: written, derived: Object.keys(derived).length, steps };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const base = process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev";
  const r = await exportBook({ base, env: process.env, day: process.argv.includes("--day") });
  const said = r.ok ? "Book export: rev " + r.rev + ", " + r.rows + " rows, " + r.notes + " notes, " + r.derived + " documents; " + r.steps.join("; ") : "Book export FAILED at " + r.step + ": " + r.error;
  console.log(r.ok ? said : "::error::" + said);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n### Book export\n" + said + "\n");
  process.exit(r.ok ? 0 : 1);
}
