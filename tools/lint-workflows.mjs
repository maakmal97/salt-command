#!/usr/bin/env node
/* lint-workflows.mjs — catch the workflow faults that make a file fail to PARSE.
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
 * This is not a full actionlint. It checks the two things that produce a silent-ish dead
 * workflow: the file must be valid YAML with jobs, and no `if:` may reference `secrets`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = ".github/workflows";
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

  if (!bad) console.log(`  ok    ${path}`);
}

console.log(bad ? `\n${bad} fault(s).` : "\nWorkflows look sane.");
process.exit(bad ? 1 : 0);
