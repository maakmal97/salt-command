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
 *   node tools/book-load.mjs          post the live book
 *   SALT_BASE, SALT_BOOK_KEY, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET in the environment
 */
import "./cloudflare.mjs";
import { readFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function payload(bookFile, ledgerFile, rev) {
  const book = JSON.parse(readFileSync(bookFile, "utf8"));
  const pricing = JSON.parse(readFileSync(ledgerFile, "utf8")).ledger.PRICING;
  if (!pricing) throw new Error("ledger/ledger.json carries no PRICING");
  return JSON.stringify({ rev, book, pricing });
}

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
  let r;
  try {
    const body = payload(resolve(REPO, "ledger", "book.json"), resolve(REPO, "ledger", "ledger.json"), process.env.GITHUB_SHA || null);
    r = await post(base, body, process.env);
  } catch (e) { r = { ok: false, error: String((e && e.message) || e) }; }
  const line = r.ok ? `Book loaded: ${r.rows} rows, ${r.added} booked, ${r.revised} revised, ${r.gone} gone, ${r.returned} returned, digest ${r.digest.slice(0, 12)}`
    : `Book NOT loaded: ${r.error}`;
  console.log(r.ok ? line : "::error::" + line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n### Book (shadow)\n" + line + "\n");
  process.exit(r.ok ? 0 : 1);
}
