/* tools/suite-proved.mjs: WHETHER CI HAS ALREADY RUN THE WHOLE SUITE ON THE TREE CHAIN PROVED LIVE.
 *
 * WHY (10 Oct 2026, his yes: "Yes, skip duplicate run"). A code change ran the suite three times: on the
 * laptop before the number is taken, in ci.yml on the pull request (verify and three test parts), and in
 * cloud-commit.yml's job `suite` after the merge deployed. A pull request merges only level with master,
 * so the squash commit's tree is the head's, and the third run repeated the second, three runners each time.
 *
 * WHAT COUNTS AS PROVED, AND NOTHING LOOSER. A ci.yml run concluded success whose jobs `verify`, `tests (1)`,
 * `tests (2)` and `tests (3)` each concluded success (a run whose tests stood down is green but proves
 * nothing), on a commit H whose tree is the tree of the commit C chain proved. H is C itself or the head of
 * a pull request into master that C came from. A pull request's run tests the merge of H into master as it
 * stood then, not H, so H must also hold every parent of C: master before C landed then lies inside H, and
 * so does every older master, and that merge's tree is H's own. That holds only if the run's base was master:
 * a run's own `pull_requests` comes back empty here, so the branch's every pull request must be into master and
 * this one never retargeted (a `base_ref_changed` event), or the run is not counted (review of 10 Oct 2026).
 *
 * FAIL CLOSED. Any answer the API does not give, any field missing, any doubt: not proved, and the suite runs.
 * The CLI exits 0 either way and writes `proved=<run id>` to GITHUB_OUTPUT only when proved, so a crash
 * leaves the output empty, which is "run the suite".
 */
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CI_JOBS = ["verify", "tests (1)", "tests (2)", "tests (3)"];
const SHA = /^[0-9a-f]{40}$/;

/** `get(path)` answers the parsed JSON of a GitHub REST path or throws. Resolves to
 *  { proved: true, run, url, head, event, text } or { proved: false, text }. Never throws. */
export async function proveTree({ repo, sha, get }) {
  const no = (text) => ({ proved: false, text });
  try {
    if (!/^[\w.-]+\/[\w.-]+$/.test(String(repo || "")) || !SHA.test(String(sha || ""))) return no("no repository or commit to ask about");
    const c = await get(`repos/${repo}/commits/${sha}`);
    const tree = c?.commit?.tree?.sha, parents = (c?.parents || []).map((p) => p?.sha);
    if (!SHA.test(tree || "") || !parents.length || !parents.every((p) => SHA.test(p || ""))) return no("commit " + sha + " has no readable tree or parents");

    /* the candidates: C itself, and the head of every pull request into master that C came from */
    const pulls = await get(`repos/${repo}/commits/${sha}/pulls?per_page=100`);
    if (!Array.isArray(pulls)) return no("the pull requests of " + sha + " could not be read");
    const prs = pulls.filter((p) => p?.base?.ref === "master" && SHA.test(p?.head?.sha || ""));
    const heads = [sha, ...prs.map((p) => p.head.sha).filter((h) => h !== sha)].filter((h, i, a) => a.indexOf(h) === i);

    const why = [];
    for (const h of heads) {
      if (h !== sha) {
        const hc = await get(`repos/${repo}/commits/${h}`);
        if (hc?.commit?.tree?.sha !== tree) { why.push(h.slice(0, 8) + "'s tree is not " + tree.slice(0, 8)); continue; }
        let holds = true;
        for (const p of parents) {
          const cmp = await get(`repos/${repo}/compare/${p}...${h}`);
          if (!(cmp?.status === "ahead" || cmp?.status === "identical")) holds = false;
        }
        if (!holds) { why.push(h.slice(0, 8) + " does not hold every parent of " + sha.slice(0, 8)); continue; }
      }
      const runs = await get(`repos/${repo}/actions/workflows/ci.yml/runs?head_sha=${h}&status=success&per_page=30`);
      if (!Array.isArray(runs?.workflow_runs)) return no("the CI runs of " + h + " could not be read");
      for (const r of runs.workflow_runs) {
        if (r?.head_sha !== h || r?.status !== "completed" || r?.conclusion !== "success" || !Number.isInteger(r?.id)) continue;
        if (r.event === "pull_request") {
          const pr = prs.find((p) => p.head.sha === h && p.head.ref === r.head_branch && Number.isInteger(p.number));
          if (!pr || (r.pull_requests || []).some((p) => p?.base?.ref !== "master")) continue;
          const owner = repo.split("/")[0];
          const all = await get(`repos/${repo}/pulls?state=all&head=${owner}:${encodeURIComponent(pr.head.ref)}&per_page=100`);
          const events = await get(`repos/${repo}/issues/${pr.number}/events?per_page=100`);
          if (!Array.isArray(all) || all.length >= 100 || !all.some((p) => p?.number === pr.number) || all.some((p) => p?.base?.ref !== "master")
              || !Array.isArray(events) || events.length >= 100 || events.some((e) => e?.event === "base_ref_changed")) {
            why.push("CI run " + r.id + " may have tested a base other than master"); continue;
          }
        } else if (r.event !== "push" && r.event !== "workflow_dispatch") continue;
        const jobs = await get(`repos/${repo}/actions/runs/${r.id}/jobs?per_page=100`);
        if (!Array.isArray(jobs?.jobs)) return no("the jobs of CI run " + r.id + " could not be read");
        const short = CI_JOBS.filter((n) => !jobs.jobs.some((j) => j?.name === n && j?.conclusion === "success"));
        if (short.length) { why.push("CI run " + r.id + " did not pass " + short.join(", ")); continue; }
        return {
          proved: true, run: r.id, url: r.html_url || "", head: h, event: r.event,
          text: "CI run " + r.id + " (" + r.event + ") passed verify and all three test parts on " + h + ", whose tree " + tree + " is the tree of " + sha,
        };
      }
      if (!runs.workflow_runs.length) why.push("no green CI run on " + h.slice(0, 8));
    }
    return no(why.length ? why.join("; ") : "nothing to compare");
  } catch (e) {
    return no("the GitHub API did not answer: " + String(e && e.message || e).slice(0, 200));
  }
}

/** The REST reader the CLI uses: the run's own token, read only, bounded; `base` is the runner's GITHUB_API_URL. */
export function githubGet(token, base = "https://api.github.com", fetchImpl = fetch) {
  return async (path) => {
    const res = await fetchImpl(base.replace(/\/+$/, "") + "/" + path, {
      headers: { authorization: "Bearer " + token, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("GET " + path.split("?")[0] + " answered " + res.status);
    return res.json();
  };
}

async function main() {
  const at = process.argv.indexOf("--sha"), sha = at > 0 ? process.argv[at + 1] : "";
  const token = process.env.GH_TOKEN || "", repo = process.env.REPO || process.env.GITHUB_REPOSITORY || "";
  const v = token ? await proveTree({ repo, sha, get: githubGet(token, process.env.GITHUB_API_URL || undefined) }) : { proved: false, text: "no token" };
  if (v.proved) {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "proved=" + v.run + "\n");
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      "### The suite was not run again\n\n" + v.text + ".\n\n" + (v.url ? "Proved by " + v.url + "\n" : ""));
    console.log("proved: " + v.text + "; job suite stands down");
  } else {
    console.log("not proved (" + v.text + "); job suite runs");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await main();
