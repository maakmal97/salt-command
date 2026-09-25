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

/* WHETHER A RUN HAS ANYTHING TO SHIP (26 Sep 2026). An update run on a tree that had nothing new
 * still built, ran the whole suite and committed public/rev.json for its fresh `built` stamp alone:
 * 12 of 60 laptop commits changed nothing else, and each push started CI, a cloud-commit run (the
 * re-seed, the publish, the Counter's deploy and the suite) and a Workers Build, about ten runner
 * minutes for nothing shipped. build.mjs now keeps the stamp while the id stands, so an idle build
 * leaves the tree clean, and this says when the run may stop at the build.
 * IDLE ONLY WHEN EVERY SURFACE AGREES AND NOTHING WAITS: the build on disk, the deploy on record and
 * the phone carry one id, the tree is clean, nothing is ahead of origin and nothing is queued. A
 * count or an id this could not read is never taken as agreement; such a run ships as it always did. */
export function idleVerdict({ revId, deployedId, liveId, dirty, ahead, pending } = {}) {
  const why = [];
  const id = typeof revId === "string" && revId ? revId : null;
  if (!id) why.push("no build id on disk");
  else {
    if (deployedId !== id) why.push("the deploy on record is " + (deployedId || "none") + ", the build is " + id);
    if (liveId !== id) why.push("the phone serves " + (liveId || "nothing readable") + ", the build is " + id);
  }
  const d = dirty == null ? null : String(dirty).trim();
  if (d === null) why.push("the tree's state is unknown");
  else if (d) why.push(d.split("\n").length + " file(s) changed in the tree");
  const a = String(ahead ?? "").trim();
  if (!/^\d+$/.test(a)) why.push("the count ahead of origin is unknown");
  else if (+a > 0) why.push(+a + " commit(s) ahead of origin");
  const p = Array.isArray(pending) ? pending.length : pending;
  if (typeof p !== "number" || !(p >= 0)) why.push("the queue's count is unknown");
  else if (p > 0) why.push(p + " entr" + (p === 1 ? "y" : "ies") + " queued");
  return why.length
    ? { idle: false, text: why.join("; ") }
    : { idle: true, text: id + " is built, deployed and live; the tree is clean and level with origin, and nothing is queued" };
}
