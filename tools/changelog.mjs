#!/usr/bin/env node
/* changelog.mjs — keep 00_Config/changelog.json in step with the master's evolution[0].
 *
 * evolution[0] in the master is the current version, and several places read evolution[0].v for
 * the version chip, the menu payload and the downloaded price sheets. SINCE v803 THE ARRAY IS ONE
 * ENTRY, the current version, on his word of 23 Sep 2026: it held the window the Journal read until
 * v802 took the Journal off the desk, and a bump now REPLACES it. So this tool is the only road by
 * which an entry reaches the record, and it must run at every bump, before the next one replaces
 * the entry; the gate refuses a master whose version changelog.json lacks. changelog.json carries
 * every entry ever written and is the record; the two
 * are kept in step by hand, which is the drift this tool closes, because the current entry is
 * ~6 KB of prose and copying it across by hand is exactly how a version ends up recorded in one
 * place and not the other.
 *
 * This reads evolution[0] out of the master and prepends it to changelog.json if that version
 * is not already there. It NEVER rewrites an entry that exists: a changelog whose past can be
 * edited is not a record.
 *
 *   node tools/changelog.mjs           sync, report
 *   node tools/changelog.mjs --check   report only, exit 1 if the current version is missing
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_MASTER =
  resolve(REPO, "master", "salt_command.html");
const MASTER = process.env.SALT_MASTER || DEFAULT_MASTER;
const LOG = resolve(dirname(MASTER), "changelog.json");
const CHECK = process.argv.includes("--check");

const src = readFileSync(MASTER, "utf8");
const open = src.indexOf("const evolution=[");
if (open < 0) { console.log("  FAIL  no evolution array in the master"); process.exit(1); }
const end = src.indexOf("}];", open);
if (end < 0) { console.log("  FAIL  the evolution array is never closed"); process.exit(1); }

/* The master is local, hand-written and already executed by the build in jsdom, so evaluating
   its own literal is no wider a trust than the build already takes. */
const entry = new Function("return " + src.slice(open + "const evolution=".length, end + 2))()[0];
if (!entry || !entry.v) { console.log("  FAIL  evolution[0] carries no version"); process.exit(1); }

if (!existsSync(LOG)) { console.log(`  FAIL  no changelog at ${LOG}`); process.exit(1); }
const log = JSON.parse(readFileSync(LOG, "utf8"));
if (log.some((e) => e.v === entry.v)) {
  console.log(`  ok    ${entry.v} is already in changelog.json (${log.length} entries)`);
  process.exit(0);
}
if (CHECK) {
  console.log(`  FAIL  ${entry.v} is in the master but not in changelog.json. Run: node tools/changelog.mjs`);
  process.exit(1);
}
log.unshift(entry);
writeFileSync(LOG, JSON.stringify(log, null, 1) + "\n", "utf8");
console.log(`  ok    ${entry.v} prepended to changelog.json (${log.length} entries)`);
