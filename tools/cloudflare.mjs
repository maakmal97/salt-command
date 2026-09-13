/* cloudflare.mjs: what every tool needs to reach Cloudflare from the laptop (13 Sep 2026).
 *
 * IPV4 FIRST. Over IPv6 the laptop's route to Cloudflare can hang: wrangler gives up with "The
 * request to Cloudflare's API timed out", which failed seed-vault twice running on 13 Sep, and
 * the same push looked up over IPv4 first went straight through. Importing this module sets that
 * order for the tool's own fetch, and NODE_OPTIONS carries it into every wrangler the tool
 * starts, since no tool here hands a child its own env. The suite fails any tool that starts
 * wrangler or fetches the Worker without importing it.
 */
import dns from "node:dns";

const FLAG = "--dns-result-order=ipv4first";
dns.setDefaultResultOrder("ipv4first");
if (!(process.env.NODE_OPTIONS || "").includes(FLAG))   // once, even when a tool starts a tool
  process.env.NODE_OPTIONS = ((process.env.NODE_OPTIONS || "") + " " + FLAG).trim();

/* WRANGLER'S OWN WORDS. A failed execFileSync says "Command failed: npx wrangler ...", which names
   the command and hides the cause. The cause is wrangler's [ERROR] line; with none, the old line.
   Wrangler colours that line even into a pipe, splitting "[ERROR]" with escape codes, so they go
   first. */
export function wranglerSaid(e) {
  const out = (String(e.stderr || "") + "\n" + String(e.stdout || "")).replace(/\x1b\[[0-9;]*m/g, "");
  const line = out.split(/\r?\n/).find((l) => l.includes("[ERROR]"));
  return line ? line.slice(line.indexOf("[ERROR]") + 7).trim() : String(e.message || e).split("\n")[0];
}
