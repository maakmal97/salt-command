/* THE DAY'S EXPORT, ASKED FOR AND PROVED (14 Nov 2026, his answers to the day-export plan). With the Book as the source git holds an
 * export of it once a Kuala Lumpur day, written by the chain's step EXPORT_STEP. GitHub starts its scheduled runs two to six hours
 * late, so the old rule (a scheduled run that starts before 06:00) missed 12, 13 and 14 Nov 2026. This file is the ONE RULE both
 * roads read: the Desk Worker's minute cron (src/worker.js exportAsk), which asks for the export from 00:05, and the chain's plan step
 * on a scheduled run (tools/day-export.mjs --due). It is also the 09:00 digest's question (exportAlarm).
 *
 * THE EVIDENCE, NOT A COUNT: today's export has landed when the chain job's step named EXPORT_STEP finished with success and its
 * completed_at falls on today's Kuala Lumpur date, in ANY attempt of ANY run (jobs read with filter=all), whatever road asked for it.
 * Runs are listed from six hours before the Kuala Lumpur day began, so a run created before midnight that exported after it counts:
 * a chain job is bounded at 30 minutes and waits for the lock behind one other at most, so six hours is ample.
 * GitHub names a step and gives its times; it gives no step id, so the suite pins EXPORT_STEP to the workflow's own step.
 * Pure but for `readRuns`, which is handed its `get` (a function from an API path to parsed JSON that throws on any refusal), so the
 * Worker passes its App token and the CLI the run's GITHUB_TOKEN. Nothing here dispatches. */

export const EXPORT_STEP = "Export the Book to git (the day's record)";
export const CHAIN_JOB = "chain";
export const exportReason = (day) => "export: the day " + day;
export const exportTitle = (day) => "Cloud commit: " + exportReason(day);   /* the run-name cloud-commit.yml gives a dispatch's reason */

const KL_MS = 8 * 3600000, DAY_MS = 86400000;   /* Kuala Lumpur keeps no summer time */
/* the Kuala Lumpur date of a moment (ms or an ISO string), YYYY-MM-DD; null for one that does not parse */
export function klDay(t) {
  const ms = typeof t === "number" ? t : Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms + KL_MS).toISOString().slice(0, 10) : null;
}
/* the UTC moment a Kuala Lumpur date begins */
export const klDayStart = (day) => Date.parse(day + "T00:00:00Z") - KL_MS;
/* minutes into the Kuala Lumpur day */
export const klMinutes = (ms) => ((ms + KL_MS) % DAY_MS) / 60000;

/* runs whose jobs can hold the export: a push run never exports (the plan sets export only on a dispatch or the clock) */
export const mayExport = (run) => !!run && (run.event === "schedule" || run.event === "workflow_dispatch");

/* { done, run } : the newest run (by the step's own completion) whose chain job finished EXPORT_STEP with success on `day` */
export function exportLanded(runs, jobsOf, day) {
  let best = null;
  for (const run of runs || []) {
    for (const job of jobsOf(run.id) || []) {
      if (!job || job.name !== CHAIN_JOB) continue;
      for (const step of job.steps || []) {
        if (!step || step.name !== EXPORT_STEP || step.conclusion !== "success" || klDay(step.completed_at) !== day) continue;
        if (!best || Date.parse(step.completed_at) > Date.parse(best.at)) best = { run: run.id, at: step.completed_at };
      }
    }
  }
  return best ? { done: true, run: best.run, at: best.at } : { done: false, run: null, at: null };
}

/* GitHub's words for a run or job that has not started or not finished */
const OPEN = new Set(["queued", "pending", "waiting", "requested", "in_progress"]);
/* A RUN GITHUB NEVER STARTED COVERS NOTHING (the Worker's cloudCommitWaiting learnt it on 16 Nov 2026: a dispatch sat `queued` with no
   job for 35 minutes, and a newer dispatch ran at once beside it). A run still `queued` at its own level, with no chain job listed,
   more than STUCK_MIN after it was made has not reached the lock: it is neither busy nor in hand. A chain job listed, waiting
   included, is never this. With no clock handed in (`nowMs`) nothing is. */
export const STUCK_MIN = 10;
export const neverStarted = (run, jobsOf, nowMs) => !!run && run.status === "queued" && Number.isFinite(nowMs)
  && nowMs - Date.parse(run.created_at) > STUCK_MIN * 60000
  && !(jobsOf(run.id) || []).some((j) => j && j.name === CHAIN_JOB);

/* the id of a run whose chain job is waiting or running, 0 for none. A run with no jobs listed yet counts by its own status, so a
   dispatch never goes over a run GitHub has created and not yet started. `except` is the run asking (the chain's own plan step). */
export function chainBusy(runs, jobsOf, except = null, nowMs = NaN) {
  for (const run of runs || []) {
    if (!run || run.status === "completed" || String(run.id) === String(except) || neverStarted(run, jobsOf, nowMs)) continue;
    const chain = (jobsOf(run.id) || []).filter((j) => j && j.name === CHAIN_JOB);
    if (!chain.length ? OPEN.has(run.status) : chain.some((j) => OPEN.has(j.status))) return run.id;
  }
  return 0;
}

/* the id of a run named for `day`'s export that has not finished, 0 for none: a scheduled run leaves the export to it */
export function exportInHand(runs, day, except = null, jobsOf = () => [], nowMs = NaN) {
  for (const run of runs || []) {
    if (run && run.status !== "completed" && String(run.id) !== String(except) && run.display_title === exportTitle(day)
      && !neverStarted(run, jobsOf, nowMs)) return run.id;
  }
  return 0;
}

/* Read the evidence for `day`: every cloud-commit run created from LOOKBACK_MS before the Kuala Lumpur day began, page by page, and
   the jobs (every attempt) of each run that may export or is still open. Throws when GitHub will not answer, so a caller never reads
   silence as "no export". */
export const LOOKBACK_MS = 6 * 3600000;
export async function readRuns(get, day, { perPage = 100, maxPages = 5 } = {}) {
  const since = new Date(klDayStart(day) - LOOKBACK_MS).toISOString().replace(/\.\d{3}Z$/, "Z");
  const runs = [];
  for (let page = 1; page <= maxPages; page++) {
    const j = await get("actions/workflows/cloud-commit.yml/runs?created=%3E%3D" + encodeURIComponent(since) + "&per_page=" + perPage + "&page=" + page);
    if (!j || !Array.isArray(j.workflow_runs)) throw new Error("GitHub's run list had no workflow_runs");
    runs.push(...j.workflow_runs);
    if (j.workflow_runs.length < perPage) break;
  }
  const jobs = new Map();
  for (const run of runs) {
    if (!mayExport(run) && run.status === "completed") continue;
    const j = await get("actions/runs/" + run.id + "/jobs?filter=all&per_page=100");
    if (!j || !Array.isArray(j.jobs)) throw new Error("GitHub's jobs for run " + run.id + " had no jobs");
    jobs.set(run.id, j.jobs);
  }
  return { runs, jobsOf: (id) => jobs.get(id) || [] };
}

/* THE CHAIN'S QUESTION on a scheduled run: is the export due? Due when nothing has landed today and no run named for today's export
   is waiting or running (one GitHub never started aside). { due, why } */
export function dueVerdict(runs, jobsOf, day, self = null, nowMs = NaN) {
  const landed = exportLanded(runs, jobsOf, day);
  if (landed.done) return { due: false, why: "landed today in run " + landed.run };
  const hand = exportInHand(runs, day, self, jobsOf, nowMs);
  if (hand) return { due: false, why: "run " + hand + " is exporting today" };
  return { due: true, why: "no export has landed on " + day };
}

/* THE WORKER'S PACE (his answers: from 00:05 to 06:00 Kuala Lumpur, a try at most every 30 minutes, four a night; the evidence read at
   most every 10 minutes). `mark` is the night's KV record {day, done, tries, tried, read}. What to do this minute, before any read. */
export const ASK = { fromMin: 5, untilMin: 360, readEveryMin: 10, tryEveryMin: 30, tries: 4 };
export function askPace(nowMs, mark) {
  const into = klMinutes(nowMs), day = klDay(nowMs);
  if (into < ASK.fromMin || into >= ASK.untilMin) return { act: "rest", day };
  const m = mark && mark.day === day ? mark : { day, done: false, tries: 0, tried: null, read: null };
  if (m.done) return { act: "rest", day, mark: m };
  if (m.read && nowMs - Date.parse(m.read) < ASK.readEveryMin * 60000) return { act: "rest", day, mark: m };
  return { act: "read", day, mark: m };
}
/* after a read: dispatch, or why not */
export function askVerdict(nowMs, mark, landed, busy) {
  if (landed.done) return { act: "done" };
  if (busy) return { act: "busy", run: busy };
  if (mark.tries >= ASK.tries) return { act: "spent" };
  if (mark.tried && nowMs - Date.parse(mark.tried) < ASK.tryEveryMin * 60000) return { act: "spaced" };
  return { act: "dispatch" };
}
