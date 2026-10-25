#!/usr/bin/env node
/* tools/book-readcheck.mjs: DO THE READERS AGREE? (S3 of the Book plan, 25 Oct 2026).
 *
 * The chain job runs this after tools/book-load.mjs. It asks the Desk Worker's GET /book/readcheck, which reads the D1 mirror's book and the
 * Book's side by side (whatever the flag says) and answers whether they agree: the names of what differs, never a row or a value, since the
 * Actions log is public. A difference is a red step with an ::error:: line and the run summary; like the load it is continue-on-error, so a fold
 * is never blocked or rolled back. The route is a CI route behind the Book's own key (SALT_BOOK_KEY) and the Access service token.
 *
 *   node tools/book-readcheck.mjs
 *   SALT_BASE, SALT_BOOK_KEY, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET in the environment
 */
import "./cloudflare.mjs";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/* the one line the step says: counts, versions and names */
export function line(r) {
  if (!r || r.error) return "Book readcheck NOT RUN: " + ((r && r.error) || "no answer");
  const head = `Book readcheck: mirror ${r.version}, Book ${r.bookVersion}, readers on ${r.mode}`;
  return r.ok ? head + `; the Book and the mirror agree over ${r.rows} sales and purchases` : head + "; DIFFER: " + (r.differ || []).join(", ");
}

export async function check(base, env, { tries = 3, wait = 2000, fetchImpl = fetch } = {}) {
  const key = String(env.SALT_BOOK_KEY || "");
  if (!key) return { error: "SALT_BOOK_KEY is not set, so the readers were not checked" };
  const headers = { "X-Book-Key": key };
  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }
  let last = "";
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetchImpl(base.replace(/\/+$/, "") + "/book/readcheck", { headers });
      const j = await r.json().catch(() => ({}));
      if (r.status === 200) return j;
      last = "HTTP " + r.status + " " + String(j.error || "").slice(0, 200);
      if (r.status < 500) return { error: last };
    } catch (e) { last = String((e && e.message) || e); }
    if (i < tries) await new Promise((res) => setTimeout(res, wait));
  }
  return { error: last };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const base = process.env.SALT_BASE || "https://salt-command.qyts8mh72kyg.workers.dev";
  const r = await check(base, process.env);
  const said = line(r), good = !!(r && !r.error && r.ok);
  console.log(good ? said : "::error::" + said);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "\n### Book (readers)\n" + said + "\n");
  process.exit(good ? 0 : 1);
}
