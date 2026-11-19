#!/usr/bin/env node
/* tools/day-export.mjs: THE CHAIN'S QUESTION ON A SCHEDULED RUN (14 Nov 2026, the day-export plan's second road): is today's export
 * of the Book to git due? The rule is src/day-export.js, the one the Desk Worker reads; this is only its reader for a run of
 * cloud-commit.yml, through the run's own GITHUB_TOKEN (actions: read).
 *
 *   node tools/day-export.mjs --due      exit 0: due (no export has landed today and none is running)
 *                                        exit 1: not due (landed today, the export step failed today, or a run named for
 *                                                today's export is running)
 *                                        exit 2: cannot tell (no token, or GitHub would not answer): the caller does not export
 *
 * One line on stdout says which and why. The plan step reads only the exit code, inside its `if`, so no answer of this tool can
 * turn the step red. Environment: GH_TOKEN, GITHUB_REPOSITORY (owner/name), GITHUB_RUN_ID (the run asking, left out of the
 * running check), GITHUB_API_URL (the suite points it at a stand-in), DAY_EXPORT_NOW (an ISO time, the suite's clock). */
import { klDate, readRuns, dueVerdict } from "../src/day-export.js";

const env = process.env;
/* exit 2 is a warning on the run's page: the step stays green, so "cannot tell" would otherwise be one unread log line */
const say = (code, line) => { console.log((code === 2 ? "::warning::" : "") + "day export: " + line); process.exit(code); };

if (!process.argv.includes("--due")) say(2, "usage: node tools/day-export.mjs --due");
const token = env.GH_TOKEN || env.GITHUB_TOKEN, repo = env.GITHUB_REPOSITORY || "maakmal97/salt-command";
if (!token) say(2, "cannot tell: no GH_TOKEN");
const api = (env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "") + "/repos/" + repo + "/";
const nowMs = env.DAY_EXPORT_NOW ? Date.parse(env.DAY_EXPORT_NOW) : Date.now();
if (!Number.isFinite(nowMs)) say(2, "cannot tell: DAY_EXPORT_NOW does not parse");
const day = klDate(nowMs);

const get = async (path) => {
  const r = await fetch(api + path, { headers: { accept: "application/vnd.github+json", authorization: "Bearer " + token, "user-agent": "salt-command" } });
  if (!r.ok) throw new Error("GitHub answered " + r.status + " to " + path.split("?")[0]);
  return r.json();
};

try {
  const { runs, jobsOf } = await readRuns(get, day);
  const v = dueVerdict(runs, jobsOf, day, env.GITHUB_RUN_ID || null, nowMs);
  say(v.due ? 0 : 1, (v.due ? "due: " : "not due: ") + v.why);
} catch (e) {
  say(2, "cannot tell: " + String((e && e.message) || e));
}
