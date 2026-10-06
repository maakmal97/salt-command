/* D1 reads fail closed. Every tool read `wrangler d1 execute --json` by slicing the first "[" to the last "]" and taking
   `results || []`, so wrangler's refusal, an object whose notes are an array, read as an empty answer: --approved staged
   nothing as ok, --committed called a live draft "no draft behind it", and readSnapshot called a refused store never seeded.
   The reader (tools/d1json.mjs) is driven directly, then drafts.mjs is run as cloud-commit runs it, with a stand-in `npx`
   first on PATH that prints a chosen answer and exits with a chosen code. */
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { d1Result, d1Rows } from "../tools/d1json.mjs";
import { readSnapshot } from "../tools/d1.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REFUSED = JSON.stringify({ error: { text: "A request to the Cloudflare API failed.", notes: [{ text: "Authentication error [code: 7403]" }], kind: "error", name: "APIError", code: 7403 } }, null, 2);
const answer = (rows, extra = {}) => JSON.stringify([{ results: rows, success: true, meta: { duration: 1 }, ...extra }], null, 2);

export async function run({ ok }) {
  /* ---- the reader ---- */
  const refused = d1Rows({ code: 1, out: REFUSED });
  ok(refused.error && /7403/.test(refused.error), "wrangler's refusal is an error in its own words, never an empty list: " + JSON.stringify(refused));
  const refusedZero = d1Rows({ code: 0, out: REFUSED });
  ok(refusedZero.error && /D1 refused: .*7403/.test(refusedZero.error), "a refusal is read as one even when the exit says 0: " + JSON.stringify(refusedZero));
  ok(d1Rows({ code: 1, out: answer([{ id: "a" }]) }).error, "a non-zero exit is an error even when rows were printed");
  ok(d1Rows({ code: 0, out: answer([], { success: false }) }).error, "a statement marked unsuccessful is an error");
  ok(d1Rows({ code: 0, out: JSON.stringify([{ text: "no results here" }]) }).error, "a statement with no results array is an error");
  ok(d1Rows({ code: 0, out: "[]" }).error, "an answer with no statement is an error");
  const warned = d1Rows({ code: 0, out: "▲ [WARNING] a newer wrangler is out\n" + answer([{ id: "x" }]) + "\n[done]" });
  ok(Array.isArray(warned.rows) && warned.rows.length === 1 && warned.rows[0].id === "x",
    "a warning line around the answer is not read as the answer: " + JSON.stringify(warned));
  const none = d1Rows({ code: 0, out: answer([]) });
  ok(Array.isArray(none.rows) && none.rows.length === 0 && !none.error, "a readable answer with no rows is the empty list it says");
  ok(Array.isArray(d1Result({ code: 0, out: answer([{ v: 1 }]) }).sets), "and a good answer comes back as wrangler's statements");

  /* ---- readSnapshot: a refusal is unknown, never "never seeded" ---- */
  const said = (code, out) => () => ({ code, out });
  ok(readSnapshot(said(1, REFUSED)) === undefined, "readSnapshot reads a refusal as not answered, not as a store never seeded");
  ok(readSnapshot(said(0, answer([]))) === null, "and a readable empty snapshot as never seeded");
  const snap = readSnapshot(said(0, answer([{ v: "v1", rows: 3, sha: "abc" }])));
  ok(snap && snap.v === "v1" && snap.rows === 3 && snap.sha === "abc", "and a row as the snapshot it is");

  /* ---- drafts.mjs, run as the commit run runs it ---- */
  const bin = mkdtempSync(join(tmpdir(), "salt-npx-"));
  try {
    writeFileSync(join(bin, "shim.mjs"), "import{readFileSync}from'node:fs';process.stdout.write(readFileSync(process.env.SHIM_OUT,'utf8'));process.exit(+process.env.SHIM_CODE||0);\n");
    writeFileSync(join(bin, "npx.cmd"), "@node \"%~dp0shim.mjs\" %*\r\n");
    writeFileSync(join(bin, "npx"), "#!/bin/sh\nexec node \"$(dirname \"$0\")/shim.mjs\" \"$@\"\n");
    chmodSync(join(bin, "npx"), 0o755);
    const drafts = (args, out, code) => {
      const file = join(bin, "out.txt");
      writeFileSync(file, out);
      const r = spawnSync(process.execPath, [join(REPO, "tools", "drafts.mjs"), ...args], {
        cwd: REPO, encoding: "utf8",
        env: { ...process.env, PATH: bin + delimiter + process.env.PATH, Path: bin + delimiter + (process.env.Path || process.env.PATH), SHIM_OUT: file, SHIM_CODE: String(code) }
      });
      return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
    };
    const empty = drafts(["--approved"], answer([]), 0);
    ok(empty.status === 0 && /"ok": true/.test(empty.out) && /"count": 0/.test(empty.out),
      "--approved over a readable empty answer stages nothing, as ok (the stand-in is what it reads): " + empty.status + " " + empty.out.slice(0, 120));
    const a = drafts(["--approved"], REFUSED, 1);
    ok(a.status !== 0 && !/"ok": true/.test(a.out) && /7403/.test(a.out),
      "--approved over a refusal exits non-zero with the reason and never prints ok: " + a.status + " " + a.out.slice(0, 160));
    const c = drafts(["--committed", "2026-10-06T01:00:00.000Z"], REFUSED, 1);
    ok(c.status !== 0 && !/no draft behind it/.test(c.out),
      "--committed over a refusal fails and never calls the draft one stated directly: " + c.status + " " + c.out.slice(0, 160));
    const l = drafts(["--list"], REFUSED, 0);
    ok(l.status !== 0 && !/nothing is waiting/.test(l.out),
      "--list over a refusal fails and never says nothing is waiting: " + l.status + " " + l.out.slice(0, 160));
  } finally { rmSync(bin, { recursive: true, force: true }); }
}
