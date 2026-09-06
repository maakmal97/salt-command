#!/usr/bin/env node
/* tools/stmt-setup.mjs: THE TWO SECRETS THE ORDER BOOK NEEDS, set once, never printed.
 *
 *   1. STMT_DESK_KEY, the same random string on BOTH Workers: the desk sends it on every
 *      /desk/orders call and the site compares it. Minted here and piped straight into
 *      `wrangler secret put` twice, so it is never on a terminal, in a file or in a transcript.
 *   2. The statements site's own Web Push pair: the private half into STMT_VAPID_PRIVATE_JWK on
 *      the site, the public half written into wrangler.stmt.jsonc as STMT_VAPID_PUBLIC_KEY, which
 *      is public by definition (a browser cannot subscribe without it). The desk's pair
 *      (tools/vapid.mjs) is a different pair on purpose: a subscription is bound to the key it was
 *      made with, and the two sites must not be able to wake each other's phones.
 *
 * RUN IT ONCE. Running it again mints a NEW desk key (harmless: both sides move together) and a
 * NEW push pair (not harmless: every customer already subscribed goes silent until he taps
 * Notify me again). It refuses the second half if the site already holds a push key, unless
 * --force. Then commit wrangler.stmt.jsonc and push: the deploy carries the public key.
 *
 *   node tools/stmt-setup.mjs            both secrets, then the public key into the config
 *   node tools/stmt-setup.mjs --force    re-mint the push pair as well, silencing every phone
 */
import { spawn, spawnSync } from "node:child_process";
import { webcrypto as crypto } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STMT_CFG = join(REPO, "wrangler.stmt.jsonc");
const FORCE = process.argv.includes("--force");
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function put(name, value, cfg) {
  return new Promise((res) => {
    const args = ["wrangler", "secret", "put", name].concat(cfg ? ["-c", cfg] : []);
    const p = spawn("npx", args, { cwd: REPO, shell: true, stdio: ["pipe", "inherit", "inherit"] });
    p.stdin.write(value); p.stdin.end();
    p.on("close", (code) => res(code === 0));
  });
}

/* 1. the desk key, on both */
const deskKey = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
console.log("\nSetting STMT_DESK_KEY on the desk (salt-command) ...");
if (!(await put("STMT_DESK_KEY", deskKey, null))) { console.log("  FAILED on the desk; nothing else changed."); process.exit(1); }
console.log("Setting the same STMT_DESK_KEY on the statements site ...");
if (!(await put("STMT_DESK_KEY", deskKey, STMT_CFG))) { console.log("  FAILED on the site. The desk holds a key the site does not: run this again."); process.exit(1); }
console.log("  ok    the desk and the site share a key, and it was never printed");

/* 2. the site's push pair */
const listed = spawnSync("npx", ["wrangler", "secret", "list", "-c", STMT_CFG], { cwd: REPO, shell: true, encoding: "utf8" });
if (!FORCE && /STMT_VAPID_PRIVATE_JWK/.test(listed.stdout || "")) {
  console.log("\n  The site already holds a push key. A new pair would silence every customer already");
  console.log("  subscribed, so it is left alone. Pass --force if that is genuinely what you want.");
  process.exit(0);
}
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const pub = b64url(await crypto.subtle.exportKey("raw", pair.publicKey));
console.log("\nSetting STMT_VAPID_PRIVATE_JWK on the statements site ...");
if (!(await put("STMT_VAPID_PRIVATE_JWK", JSON.stringify(jwk), STMT_CFG))) { console.log("  FAILED; the config is unchanged."); process.exit(1); }
const cfg = readFileSync(STMT_CFG, "utf8");
const m = /"STMT_VAPID_PUBLIC_KEY"\s*:\s*"[^"]*"/.exec(cfg);
if (!m) { console.log("  wrangler.stmt.jsonc has no STMT_VAPID_PUBLIC_KEY var to fill; paste this in by hand:\n    " + pub); process.exit(1); }
writeFileSync(STMT_CFG, cfg.replace(m[0], '"STMT_VAPID_PUBLIC_KEY": "' + pub + '"'));
console.log("  ok    the private key is stored and was never printed; the public key is written into wrangler.stmt.jsonc");
console.log("\nCommit wrangler.stmt.jsonc and push. The deploy carries the public key, and customers can tap Notify me.");
