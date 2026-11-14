/* test/ambient-carry.mjs: THE MOVE TO AMBIENT, PART 1, NOTHING DRAWN YET (14 Nov 2026; docs/plan-ambient-move.html, his answers of 14 Nov 2026).
   What is proved here, each check red under its own mutation (test/ambient-carry.mutations.json):
   1. The statements Worker's generated module carries Ambient whole: the token block, ambient.css, ambient.js and the icon sprite, each
      hashing to tools/ambient.lock.json, so what the Worker would serve is what was pulled, never a copy edited or trimmed here.
   2. tools/ambientsync.mjs --check passes on the copy as pulled and fails on a carried file edited by hand, on an edited token block and on a
      lock written by a preview pull (run on a scratch copy of the three, so nothing in the tree is touched).
   3. Salt Admin's own layer, design/admin.css, may read tokens but never name a colour: the generator refuses one.
   4. The heat reads the day's SUPPLY STEP, never the move: tight at two days of cover, soft past 14, neutral between, and soft on the day a
      big lot lands while the move is still stepping down from +15; neutral when switched off, before the rule's since and on a book with no
      market. It prices nothing.
   5. The stock document Salt Admin polls carries each book's heat, the engine's own reading in the desk's window. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sha = (s) => createHash("sha256").update(s).digest("hex");

export async function run({ ok }) {
  /* 1 */
  const lock = JSON.parse(readFileSync(join(REPO, "tools", "ambient.lock.json"), "utf8"));
  const { ambientParts } = await import(pathToFileURL(join(REPO, "tools", "stmt-style.mjs")).href);
  const A = ambientParts();
  ok(sha(A.tokens) === lock.tokens && sha(A.css) === lock.files["ambient.css"] && sha(A.js) === lock.files["ambient.js"] && sha(A.icons) === lock.files["icons.svg"]
    && !lock.preview && /^\d+\.\d+\.\d+$/.test(lock.version),
    "the Worker's module carries Ambient " + lock.version + " whole: the tokens, ambient.css, ambient.js and the icons each hash to the lock");
  const mod = await import(pathToFileURL(join(REPO, "stmt", "statement-css.js")).href);
  ok(mod.AMB_TOKENS === A.tokens && mod.AMB_CSS === A.css && mod.AMB_JS === A.js && mod.AMB_ICONS === A.icons && mod.ADMIN_CSS === A.admin,
    "and stmt/statement-css.js holds them as the generator writes them, as JSON strings the page interpolates");

  /* 2: a scratch copy of the tool, its lock and the carried files, laid out as the repo lays them out */
  const tmp = mkdtempSync(join(tmpdir(), "amb-carry-"));
  try {
    const lay = (rel) => { mkdirSync(dirname(join(tmp, rel)), { recursive: true }); cpSync(join(REPO, rel), join(tmp, rel), { recursive: true }); };
    ["tools/ambientsync.mjs", "tools/ambient.lock.json", "design/ambient"].forEach(lay);
    const check = () => spawnSync(process.execPath, [join(tmp, "tools", "ambientsync.mjs"), "--check"],
      { encoding: "utf8", env: { ...process.env, AMBIENT_DS: join(tmp, "no-design-system-here") } });
    const clean = check();
    const css = join(tmp, "design", "ambient", "ambient.css"), was = readFileSync(css, "utf8");
    writeFileSync(css, was + "\n.amb-pill { color: red; }\n");
    const edited = check();
    writeFileSync(css, was);
    const app = join(tmp, "design", "ambient", "app.css"), appWas = readFileSync(app, "utf8");
    writeFileSync(app, appWas.replace("--amb-tap: 44px;", "--amb-tap: 40px;"));
    const tokens = check();
    writeFileSync(app, appWas);
    const lk = join(tmp, "tools", "ambient.lock.json");
    writeFileSync(lk, JSON.stringify({ ...lock, preview: true }, null, 2) + "\n");
    const preview = check();
    ok(clean.status === 0 && /level with Ambient/.test(clean.stdout)
      && edited.status === 1 && /ambient\.css is not what was pulled/.test(edited.stdout)
      && tokens.status === 1 && /tokens .* are not what was pulled/.test(tokens.stdout)
      && preview.status === 1 && /preview/.test(preview.stdout),
      "the lock check passes the copy as pulled and fails a hand-edited ambient.css, an edited token block and a preview pull: "
      + [clean.status, edited.status, tokens.status, preview.status].join(","));
  } finally { rmSync(tmp, { recursive: true, force: true }); }

  /* 3: the generator refuses a colour in Salt Admin's own layer (a scratch copy of the generator, the sync tool and design/) */
  const t3 = mkdtempSync(join(tmpdir(), "amb-admin-"));
  try {
    for (const rel of ["tools/stmt-style.mjs", "tools/ambientsync.mjs", "tools/ambient.lock.json", "design/ambient"]) {
      mkdirSync(dirname(join(t3, rel)), { recursive: true }); cpSync(join(REPO, rel), join(t3, rel), { recursive: true });
    }
    writeFileSync(join(t3, "design", "admin.css"), "/* a note may say #fff */\n.adm-x { padding: var(--amb-space-2); color: var(--amb-ink-2); }\n");
    const ok1 = (await import(pathToFileURL(join(t3, "tools", "stmt-style.mjs")).href + "?a")).ambientParts();
    writeFileSync(join(t3, "design", "admin.css"), ".adm-x { color: #ffffff; }\n");
    let refused = "";
    try { (await import(pathToFileURL(join(t3, "tools", "stmt-style.mjs")).href + "?b")).ambientParts(); } catch (e) { refused = e.message; }
    ok(/var\(--amb-ink-2\)/.test(ok1.admin) && /names a colour/.test(refused),
      "Salt Admin's own layer reads tokens and may mention a colour in a note, but a colour it draws is refused by the generator: " + refused);
  } finally { rmSync(t3, { recursive: true, force: true }); }

  /* 4: the heat, on small books of their own (the market test's harness) */
  const S = (await import("../engine/snapshot.mjs")).default;
  const RULES = (await import("../engine/rules.mjs")).default;
  const { inputsFromBook } = await import("../engine/book-inputs.mjs");
  const Rm = JSON.parse(JSON.stringify(RULES)); Rm.TIER_RULE.salt.market.since = "2026-10-01";
  const sale = (i, date, qty, total) => ({ rid: "s9" + String(i).padStart(3, "0"), date, customer: "CX" + (i % 7) + "-AA", qty, total, cash: total, deliveredQty: qty, deliveredOn: date, cost: qty * 50 });
  const baseSales = []; for (let i = 0; i < 30; i++) baseSales.push(sale(i, "2026-09-" + String(2 + i % 27).padStart(2, "0"), 1, 120));
  const book = (lots, extra = {}) => Object.assign({ sales: baseSales.slice(), purchases: lots, PROD_OPENING: { salt: { qty: 0, costPerKg: 50 } }, STATED_STOCK: 30, COUNTS: [],
    selfUseLog: [], QUOTES: {}, COST_RULE: { salt: { kind: "latestCogs" } }, customerRefunds: [], roster: [], partners: [], TIER_OF: {}, PROD_ORDER: ["salt"], loans: [] }, extra);
  const lot = (qty, date = "2026-09-01") => ({ rid: "p9" + qty, date, receivedOn: date, qty, total: qty * 50, supplier: "SUP" });
  const ctx = (b, day, rules = Rm) => { const B = inputsFromBook(b); return { B, R: rules, today: new Date(day + "T00:00:00Z"), over: null, memo: B.memo, W: { buyUnits: 0, selfUse: 0, wavgBuy: 0, stockCost: null } }; };
  const heat = (b, day, rules) => S.marketHeat(ctx(b, day, rules), "salt");
  /* on 2026-10-06 two units left read 3.3 days of cover, six read 10.6 and four hundred read past the forecast */
  const tight = book([lot(32)]), mid = book([lot(36)]), soft = book([lot(400)]);
  /* tight from 2026-10-01, then 400 units land on 2026-10-04 and count from the next day's start: on 2026-10-05 the move is still +10, the supply step already -10 */
  const landed = book([lot(32), lot(400, "2026-10-04")]);
  const wl = S.marketWalk(ctx(landed, "2026-10-05"), "salt", "2026-10-05");
  const off = book([lot(32)], { MARKET: { salt: { switch: [{ on: false, from: "2026-10-01", at: "2026-10-01T00:00:00Z" }] } } });
  const Rnone = JSON.parse(JSON.stringify(Rm)); delete Rnone.TIER_RULE.salt.market;
  ok(heat(tight, "2026-10-06") === "tight" && heat(soft, "2026-10-06") === "soft" && heat(mid, "2026-10-06") === "neutral"
    && wl.k > 0 && wl.supply < 0 && heat(landed, "2026-10-05") === "soft",
    "the heat reads the supply step, never the move: tight at two days of cover, soft past 14, neutral between, and soft the day a big lot lands while the move is still +" + Math.round(wl.k * 100));
  ok(heat(off, "2026-10-06") === "neutral" && heat(tight, "2026-09-20") === "neutral" && heat(tight, "2026-10-06", Rnone) === "neutral"
    && S.marketHeat(ctx(tight, "2026-10-06"), "oil") === "neutral",
    "and neutral when switched off, before the rule's since, with no market rule, and on a book with no market");

  /* 5 */
  const { readBook } = await import("../tools/book.mjs");
  const { w, ledger } = await readBook();
  try {
    const books = (ledger.STOCK && ledger.STOCK.books) || {}, ids = w.eval("PROD_IDS.slice()");
    const want = Object.fromEntries(ids.map((p) => [p, w.eval("SNAPSHOT_ENGINE.marketHeat(snapCtx()," + JSON.stringify(p) + ")")]));
    ok(ids.length > 0 && ids.every((p) => books[p] && ["tight", "soft", "neutral"].includes(books[p].heat) && books[p].heat === want[p]),
      "the stock document Salt Admin polls carries each book's heat, the engine's own reading in the desk's window: " + JSON.stringify(want));
  } finally { w.close(); }
}
