/* 12 Oct 2026: EVERY MUTATION NEEDLE STILL FINDS ITS LINE, EXACTLY ONCE.
 *
 * A mutation manifest (test/*.mutations.json) is a list of {name, file?, find, replace}. tools/section.mjs refuses a needle that
 * occurs nowhere or twice, but only when someone runs that manifest, and a manifest is run once, on the day its section lands.
 * After that the code moves under it: a second copy of a line makes the needle ambiguous, a reworded comment makes it match
 * nothing, and the check it proved red can no longer be proved red, with no suite run noticing. Six needles had gone stale
 * that way by 12 Oct 2026. This reads every manifest and puts each entry through the tool's own `mutate`, so the rule is the
 * tool's and not a copy of it: the needle exactly once in its file (the master when it names none), a change, a name of its own.
 * test/mutation-needles.mutations.json plants each kind of stale needle in a real manifest, one at a time. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mutate } from "../tools/section.mjs";
import { TIDE_OFF } from "./tide-off.mjs";

const MASTER = "master/salt_command.html";

/* the faults of one manifest's list, each said as the tool would refuse it; `read` returns a file's text or throws */
export function manifestFaults(list, read, skipParked = false) {
  if (!Array.isArray(list) || !list.length) return ["holds no list of mutations"];
  const names = new Set(), faults = [];
  for (const m of list) {
    /* 19 Oct 2026: an entry marked `parked` belongs to a section parked behind TIDE_OFF (test/tide-off.mjs), and its line was rewritten
       to turn Tide off; it is passed over while the section is, and read like any other when Tide returns */
    if (skipParked && m && typeof m.parked === "string") continue;
    if (!m || typeof m.name !== "string" || !m.name || names.has(m.name)) { faults.push("every mutation needs a name of its own: " + JSON.stringify(m && m.name)); continue; }
    names.add(m.name);
    let text;
    try { text = read(m.file || MASTER); } catch (e) { faults.push(m.name + ": " + (m.file || MASTER) + " is not a file in this checkout"); continue; }
    try { mutate(text, m); } catch (e) { faults.push(e.message); }
  }
  return faults;
}

export async function run({ ok, REPO }) {
  const cache = new Map();
  const read = (file) => {
    if (!cache.has(file)) cache.set(file, readFileSync(join(REPO, file), "utf8"));
    return cache.get(file);
  };
  /* this check's own manifest is left out: its mutations edit the other manifests this reads, so under each one its own entry is
     stale by construction and would turn the check red whether or not the stale needle it planted elsewhere was seen (a vacuous
     red). tools/section.mjs refuses a stale needle of it when it runs it. */
  const SELF = "mutation-needles.mutations.json";
  const manifests = readdirSync(join(REPO, "test")).filter((f) => /mutations?[.]json$/.test(f) && f !== SELF).sort();
  const faults = [];
  for (const f of manifests) {
    let list = null;
    try { list = JSON.parse(readFileSync(join(REPO, "test", f), "utf8")); } catch (e) { faults.push(f + ": " + e.message); continue; }
    for (const why of manifestFaults(list, read, TIDE_OFF)) faults.push(f + ": " + why);
  }
  ok(manifests.length >= 30 && !faults.length,
    "every mutation needle finds its line once, in " + manifests.length + " manifests: " + (faults.join(" | ") || "none"));

  /* the rule itself, on a file of three lines: a stale needle, a doubled one, a no-op, a missing file, an unnamed entry and a repeated name */
  const fake = (file) => { if (file === "f.js") return "one\ntwo\ntwo\n"; throw new Error("no such file"); };
  const bad = manifestFaults([
    { name: "stale", file: "f.js", find: "three", replace: "3" }, { name: "doubled", file: "f.js", find: "two", replace: "2" },
    { name: "noop", file: "f.js", find: "one", replace: "one" }, { name: "gone", file: "g.js", find: "one", replace: "1" },
    { find: "one", replace: "1" }, { name: "stale", file: "f.js", find: "one", replace: "1" }], fake);
  const good = manifestFaults([{ name: "once", file: "f.js", find: "one", replace: "1" }, { name: "once too", file: "f.js", find: "two\ntwo", replace: "2" }], fake);
  ok(bad.length === 6 && /stale: the needle occurs nowhere/.test(bad[0]) && /doubled: the needle occurs more than once/.test(bad[1])
    && /noop: the replacement changes nothing/.test(bad[2]) && /gone: g[.]js is not a file/.test(bad[3]) && /name of its own: undefined/.test(bad[4])
    && /name of its own: "stale"/.test(bad[5]) && !good.length && manifestFaults([], fake).length === 1 && manifestFaults(null, fake).length === 1,
    "the rule names a needle found nowhere or twice, one that changes nothing, a file that is not there and an entry with no name or a repeated one, and passes a sound list: "
    + JSON.stringify({ bad, good }));

  /* a parked entry (19 Oct 2026): passed over only while its section is parked, and a stale needle all the same once Tide returns */
  const parked = [{ name: "parked", file: "f.js", find: "three", replace: "3", parked: "Tide is off" }];
  const whileOff = manifestFaults(parked, fake, true), whenBack = manifestFaults(parked, fake, false);
  const unmarked = manifestFaults([{ name: "stale", file: "f.js", find: "three", replace: "3" }], fake, true);
  ok(whileOff.length === 0 && whenBack.length === 1 && /parked: the needle occurs nowhere/.test(whenBack[0]) && unmarked.length === 1,
    "an entry marked parked is passed over while Tide is off and is a stale needle once it is back, and an unmarked stale needle is a fault either way: " + JSON.stringify({ whileOff, whenBack, unmarked }));
}
