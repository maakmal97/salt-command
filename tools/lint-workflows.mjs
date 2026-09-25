#!/usr/bin/env node
/* lint-workflows.mjs: catch the workflow faults that make a file fail to PARSE, or a job run unbounded.
 *
 * WHY THIS EXISTS. On 20 Aug a step was added with `if: ${{ secrets.X != '' }}`. The `secrets`
 * context is not available in an if condition, so GitHub rejected the WHOLE FILE: the run had
 * zero jobs, no logs, and was named by its file path instead of the workflow's name. Between
 * adding it and fixing it, the stage and deploy jobs were dead and their cron did not fire.
 *
 * AND CI WAS GREEN THROUGHOUT, which is the part worth fixing. ci.yml only tests the repo; it
 * had nothing to say about another workflow being unparseable. A broken OPTIONAL step took the
 * whole file with it and the only signal was an email.
 *
 * This is not a full actionlint. It checks the things that produce a silent-ish dead workflow:
 * the file must be valid YAML with jobs, and no `if:` may reference `secrets`. And since 26 Sep
 * 2026 every job must carry `timeout-minutes`: GitHub's default is six hours, and the chain holds
 * one concurrency slot with every later approval queued behind it.
 *
 *   node tools/lint-workflows.mjs [dir]     dir defaults to .github/workflows
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/* The jobs under `jobs:`, each with its timeout-minutes, null when it has none in whole minutes.
   Read by indentation, not by a YAML parser: a job is a key one level under `jobs:`, and its own
   keys sit one level under that, so a step's timeout-minutes, deeper, does not count for the job. */
export function jobTimeouts(text) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => /^jobs:\s*(#.*)?$/.test(l));
  if (at < 0) return [];
  const ind = (l) => l.length - l.trimStart().length;
  const jobs = [];
  let jobIndent = null, keyIndent = null, cur = null;
  for (let i = at + 1; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || /^\s*#/.test(l)) continue;
    const n = ind(l);
    if (n === 0) break;                                  /* the next top-level key ends `jobs:` */
    if (jobIndent == null) jobIndent = n;
    if (n <= jobIndent) {
      const m = /^\s*([A-Za-z0-9_-]+):\s*(#.*)?$/.exec(l);
      cur = { job: m ? m[1] : l.trim(), line: i + 1, minutes: null }; jobs.push(cur); keyIndent = null; continue;
    }
    if (keyIndent == null) keyIndent = n;
    if (n === keyIndent) { const m = /^\s*timeout-minutes:\s*(\d+)\s*(#.*)?$/.exec(l); if (m) cur.minutes = +m[1]; }
  }
  return jobs;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const DIR = process.argv[2] || ".github/workflows";
  let bad = 0;

  for (const f of readdirSync(DIR).filter((n) => /\.ya?ml$/.test(n))) {
    const path = join(DIR, f);
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/);

    /* 1. `secrets` in an if condition. GitHub rejects the file outright. */
    lines.forEach((l, i) => {
      if (/^\s*if:/.test(l) && /\bsecrets\./.test(l)) {
        console.log(`  FAIL  ${path}:${i + 1}  \`secrets\` is not available in an \`if:\` condition.`);
        console.log(`          ${l.trim()}`);
        console.log(`          Pass it through \`env:\` and test the variable in the shell instead.`);
        bad++;
      }
    });

    /* 2. It must at least look like a workflow: a name, a trigger and some jobs. A file that
          parses but declares nothing runs nothing, and says so just as quietly. */
    for (const [key, re] of [["on:", /^on:/m], ["jobs:", /^jobs:/m], ["name:", /^name:/m]]) {
      if (!re.test(text)) { console.log(`  FAIL  ${path}  has no top-level \`${key}\``); bad++; }
    }

    /* 3. Tabs are not legal YAML indentation and the error it gives is unhelpful. */
    lines.forEach((l, i) => {
      if (/^\t/.test(l)) { console.log(`  FAIL  ${path}:${i + 1}  indented with a TAB; YAML forbids it`); bad++; }
    });

    /* 4. Every job is bounded. A job with no `timeout-minutes` runs for GitHub's six hours. */
    for (const j of jobTimeouts(text)) {
      if (!(j.minutes > 0)) { console.log(`  FAIL  ${path}:${j.line}  job \`${j.job}\` has no \`timeout-minutes\` in whole minutes; GitHub's default is six hours`); bad++; }
    }

    if (!bad) console.log(`  ok    ${path}`);
  }

  console.log(bad ? `\n${bad} fault(s).` : "\nWorkflows look sane.");
  process.exit(bad ? 1 : 0);
}
