/* tools/preflight.mjs: WHETHER A RUN MAY SHIP AT ALL, in the one place the suite can drive it.
 *
 * WHY THIS FILE EXISTS, and it is not a matter of taste: tools/update.mjs runs its whole chain on
 * import, so nothing inside it can be put under an assertion. tools/commitmsg.mjs was carved out
 * for the same reason and says so.
 *
 * WHAT IT COST TO LEARN. The origin-ahead check has been in the preflight since 10 Sep 2026,
 * written precisely to stop a stale tree from taking a version, and it called fail(), which on this
 * tool records a problem, prints it, and RETURNS. The run then carried on. On 21 Sep 2026 a checkout
 * sitting on the previous morning's v733 built, DEPLOYED over v768, committed a version master
 * already carried, and only failed at the push; the desk served yesterday's build until it was put
 * back by hand. FAIL was printed at the top of that run and nothing read it.
 *
 * AND THE LINE MOVED, from "not going to push" to "not going to touch anything". The old gate
 * excused a run with --no-push, which still DEPLOYS, and the deploy is the half that reached him.
 * Only --dry, which writes nothing anywhere, may carry on and report.
 */

/** What a tree behind origin may do. `behind` is how many commits origin has that this tree does
 *  not, as git prints it; `dry` is a run that touches nothing. */
export function aheadVerdict(behind, opts = {}) {
  const n = +behind || 0;
  if (n <= 0) return { level: "ok", stop: false, text: "origin is level with this tree" };
  const text = "origin is " + n + " commit(s) AHEAD of this tree. The chain has folded since you started.\n"
    + "        Pull first: git pull --ff-only origin master, then rebuild.\n"
    + "        Nothing here may deploy or take a version while this tree is behind.";
  return opts.dry ? { level: "warn", stop: false, text } : { level: "fail", stop: true, text };
}
