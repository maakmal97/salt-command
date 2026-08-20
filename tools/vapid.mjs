#!/usr/bin/env node
/* vapid.mjs — generate the Web Push keypair, once, and put the private half where it belongs.
 *
 * THE PRIVATE KEY IS NEVER PRINTED. It goes straight down a pipe into `wrangler secret put`,
 * so it does not appear on a terminal, in a scrollback, in a session transcript or in a file.
 * The public half is printed, because it is public: the browser needs it to create a
 * subscription and it is baked into the app.
 *
 * RUN IT ONCE. Running it again mints a NEW pair, and every existing subscription was created
 * against the old public key, so every phone would go silent until it resubscribed. It refuses
 * to run if a key is already set unless you pass --force.
 *
 *   node tools/vapid.mjs            generate, store the secret, print the public key
 *   node tools/vapid.mjs --force    do it again anyway, invalidating every subscription
 */
import { spawn, spawnSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";

const FORCE = process.argv.includes("--force");
const b64url = (buf) => Buffer.from(buf).toString("base64")
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const existing = spawnSync("npx", ["wrangler", "secret", "list"], { shell: true, encoding: "utf8" });
if (!FORCE && /VAPID_PRIVATE_JWK/.test(existing.stdout || "")) {
  console.log("  VAPID_PRIVATE_JWK is already set.");
  console.log("  Generating a new pair would silence every phone already subscribed, because");
  console.log("  each subscription is bound to the public key it was created with.");
  console.log("  Pass --force if that is genuinely what you want.");
  process.exit(1);
}

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const rawPub = await crypto.subtle.exportKey("raw", pair.publicKey);   // 65 bytes, uncompressed
const pub = b64url(rawPub);

/* Down the pipe, never through a variable that gets logged. */
const put = spawn("npx", ["wrangler", "secret", "put", "VAPID_PRIVATE_JWK"], { shell: true, stdio: ["pipe", "inherit", "inherit"] });
put.stdin.write(JSON.stringify(jwk));
put.stdin.end();

put.on("close", (code) => {
  if (code !== 0) { console.log("\n  FAILED: wrangler would not store the secret."); process.exit(1); }
  console.log("\n  ok    the private key is stored as the VAPID_PRIVATE_JWK secret and was never printed");
  console.log("\n  PUBLIC KEY, which is public and belongs in wrangler.jsonc as VAPID_PUBLIC_KEY:\n");
  console.log("    " + pub + "\n");
  console.log("  Add it under `vars`, deploy, then subscribe from the phone.");
});
