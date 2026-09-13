#!/usr/bin/env node
/* push-key.mjs — mint the CI push key and put it in both places it has to live.
 *
 * IT IS NEVER PRINTED. The value is generated here, piped into `wrangler secret put` for the
 * Worker and into `gh secret set` for Actions, and then dropped. It does not reach a terminal,
 * a scrollback, a session transcript or a file, which is the same discipline tools/vapid.mjs
 * follows for the VAPID private half.
 *
 * WHY A SEPARATE KEY AT ALL. CI needs to wake the phone after a fold and nothing else. Giving
 * it SALT_WRITE_KEY would hand a notification step the right to write the queue, replace the
 * vault and approve drafts, to save minting one more secret. A GitHub Actions secret is
 * readable by anyone who can land a workflow in the repo, so the difference is real.
 *
 *   node tools/push-key.mjs             mint and store in both places
 *   node tools/push-key.mjs --force     replace an existing one
 */
import "./cloudflare.mjs";
import { spawn, spawnSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";

const FORCE = process.argv.includes("--force");

const have = spawnSync("npx", ["wrangler", "secret", "list"], { shell: true, encoding: "utf8" });
if (!FORCE && /SALT_PUSH_KEY/.test(have.stdout || "")) {
  console.log("  SALT_PUSH_KEY already exists on the Worker. Pass --force to replace it,");
  console.log("  remembering that CI keeps the old value until it is updated too.");
  process.exit(1);
}

/* 32 bytes of CSPRNG, base64url. Long enough that the constant-time compare in the Worker is
   the only thing standing between this and a guess, which is how it should be. */
const key = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
  .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function pipeInto(cmd, args, value) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { shell: true, stdio: ["pipe", "inherit", "inherit"] });
    c.stdin.write(value);
    c.stdin.end();
    c.on("close", (code) => resolve(code === 0));
  });
}

const a = await pipeInto("npx", ["wrangler", "secret", "put", "SALT_PUSH_KEY"], key);
if (!a) { console.log("\n  FAILED: wrangler would not store it. Nothing else was touched."); process.exit(1); }

const b = await pipeInto("gh", ["secret", "set", "SALT_PUSH_KEY"], key);
if (!b) {
  console.log("\n  FAILED: the Worker has the key but GitHub does not, so CI cannot send yet.");
  console.log("  Re-run with --force once `gh auth status` is healthy.");
  process.exit(1);
}

console.log("\n  ok    minted, stored on the Worker and in GitHub Actions, and never printed");
console.log("  ok    it authorises POST /push/send and nothing else");
