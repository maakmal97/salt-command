/* test/engine-rules.mjs: S1c-i of the Book plan. THE PRICING RULE TABLES LIVE IN engine/rules.mjs, AND NOTHING THEY PRICE MOVED.
   1. Each table, read out of the built page, deep-equals the engine export, key order included, and the master's own script holds no
      second literal of it (the one definition is inside the ENGINE rules block).
   2. pricingSnapshot() on the frozen book is the snapshot the master gave at 35ebb39e, before the lift (test/fixtures/pricing-before-s1c.json,
      numbers rounded to 8 places, takenAt left out). Mutations: test/engine-rules.mutations.json. */
import { readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { openMaster } from "../tools/payload.mjs";
import { pricingSnapshot } from "../tools/book.mjs";
import RULES_MOD from "../engine/rules.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAMES = ["RULES", "PRICE_ENGINE", "LADDER_BY", "TIER_RULE", "SHRINK_ATTRIB", "COST_BASIS", "PRICE_LOCK", "PROFILE_RULE", "PRICE", "LADDER", "PRICE_LOCK_ON"];
const round = (s) => JSON.stringify(s, (k, v) => typeof v === "number" ? Math.round(v * 1e8) / 1e8 : v);

/* the fixture was taken on 16 Oct 2026 MYT, and the snapshot reads the page's TODAY (lock ages, profiles, drift), so the page opens on that day */
const FIXTURE_NOW = Date.parse("2026-10-16T04:00:00Z");
const pinClock = (w) => { w.Date.now = () => FIXTURE_NOW; };

export async function run({ ok }) {
  const { w } = await openMaster(undefined, { before: pinClock });
  const src = readFileSync(process.env.SALT_MASTER || join(REPO, "master", "salt_command.html"), "utf8");
  const a = src.indexOf("/* ==== ENGINE rules:"), b = src.indexOf("/* ==== END ENGINE rules ==== */");
  const outside = src.slice(0, a) + src.slice(b);
  ok(Object.keys(RULES_MOD).join() === NAMES.join(), "S1c-i: engine/rules.mjs exports exactly the eight tables and PRICE, LADDER and PRICE_LOCK_ON (S1e), in order");
  for (const n of NAMES) {
    const page = JSON.parse(w.eval("JSON.stringify(" + n + ")"));
    const mod = JSON.parse(JSON.stringify(RULES_MOD[n]));
    ok(isDeepStrictEqual(page, mod) && JSON.stringify(page) === JSON.stringify(mod), `S1c-i: ${n} read out of the page is the engine export, key order and all`);
    ok(!new RegExp("\\n(const|let|var)\\s+" + n + "\\s*=").test(outside), `S1c-i: the master's own script holds no second definition of ${n}`);
  }
  ok(w.eval("PRICING_RULES.RULES===RULES&&PRICING_RULES.TIER_RULE===TIER_RULE&&PRICING_RULES.PRICE_ENGINE===PRICE_ENGINE&&PRICING_RULES.PRICE===PRICE&&PRICING_RULES.LADDER===LADDER"),
    "S1c-i: the page's names are the engine object's own tables, not copies");
  ok(w.eval("PRICE_LOCK_ON===false&&PRICING_RULES.PRICE_LOCK_ON===false&&typeof PRICE_LOCK_ON==='boolean'"), "S1e: PRICE_LOCK_ON is the engine's switch, still off");
  const snap = pricingSnapshot(w); delete snap.takenAt;
  const before = readFileSync(join(REPO, "test", "fixtures", "pricing-before-s1c.json"), "utf8");
  ok(round(snap) === before, "S1c-i: pricingSnapshot() on the frozen book is the one the master gave before the tables moved");
}
