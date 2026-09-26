#!/usr/bin/env node
/* foldcall.mjs — the fold as one call (v521, Part A step 3 of his instruction of 08 Sep 2026:
 * everything within a minute of a tap on Approve).
 *
 * WHAT IT REPLACES. The Fold step booted a whole Claude Code session: it read the docs, explored
 * the repo, ran the planner, wrote the notes, ran the suite and pushed, in about five minutes.
 * Everything it gathered, the tools can compute: the plan, the party's history, the floor and
 * the ask from the desk's own ladder, the drafter's flags, the inventory position. This sends
 * that dossier to Claude once and gets the notes back as JSON, then folds with the same tool
 * the agent used. The judgement is still a model's, on the same facts, in a fraction of the
 * time. Every refusal rule stays in fold.mjs, so the model cannot fold what it should not.
 *
 *   node tools/foldcall.mjs            plan, dossier, call, notes, apply
 *   node tools/foldcall.mjs --dry      print the dossier and the request; call nothing
 *   node tools/foldcall.mjs --probe    one cheap call with the key, to prove it where it is used
 *   node tools/foldcall.mjs --no-model write the notes with the tool and never call at all
 *   SALT_FOLD_FAKE=<notes.json>        use this reply instead of calling (the suite)
 *   SALT_FOLD_NOMODEL=1                as --no-model, for a runner that cannot add a flag
 *   SALT_FOLD_MODEL                    default claude-opus-5
 *   --staged --book --master --notes --folded --today   as fold.mjs takes them, passed through
 *
 * WHAT IT WRITES. master/_fold_notes.json, then everything fold.mjs --apply writes. It does
 * not build, test, commit or push: the workflow step does those, as the agent did.
 *
 * WHAT IT NEEDS: NOTHING (his instruction of 22 Sep 2026). ANTHROPIC_API_KEY buys the judgement
 * and nothing else. Without it, and on any refusal the call comes back with, tools/foldnotes.mjs
 * writes the same notes object off the same dossier and the fold lands anyway, saying in the
 * version entry and in every row note that no judgement is recorded in it. This used to exit 1
 * three ways, and on 22 Sep 2026 a credit balance of nothing left two approved rows staged with
 * the deploy, the marks, the mirror, the statements and the suite all behind them. A judgement is
 * worth a model; a chain that stops dead without one is not.
 *
 * Nothing else leaves the machine: codes, figures and the drafter's own sentences, never a name
 * (the book carries none).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";
import { plan } from "./fold.mjs";
import { toolNotes, phoneLine } from "./foldnotes.mjs";
import { readBookFile } from "./booksync.mjs";
import { readBook } from "./book.mjs";
import E from "../engine/position.mjs";   /* v738: what a customer owes is read off the engine, never as total less cash */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const MASTER = opt("--master", resolve(REPO, "master", "salt_command.html"));
const BOOK = opt("--book", resolve(REPO, "ledger", "book.json"));
const STAGED = opt("--staged", resolve(dirname(MASTER), "_to_fold.json"));
const NOTES = opt("--notes", resolve(dirname(MASTER), "_fold_notes.json"));
const FOLDED = opt("--folded", resolve(dirname(MASTER), "_folded.json"));
const TODAY = opt("--today", new Date(Date.now() + 8 * 36e5).toISOString().slice(0, 10));
const MODEL = process.env.SALT_FOLD_MODEL || "claude-opus-5";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayOf = (iso) => { const [y, m, d] = iso.split("-"); return `${d} ${MON[+m - 1]} ${y}`; };
const r2 = (v) => v == null ? null : +(+v).toFixed(2);

/* ---- the dossier: what a person auditing the row would have looked up ------------------- */
const pick = (r) => ({ rid: r.rid, date: r.date || null, qty: r.qty, total: r.total, cash: r.cash || 0, delivery: r.delivery || null,
  moved: r.deliveredQty != null ? r.deliveredQty : (r.receivedQty != null ? r.receivedQty : null), handover: r.handover || null,
  paidOn: r.paidOn || null, defaulted: !!r.defaulted, cancelled: !!r.cancelled, rebate: !!r.rebate, pending: !!r.pending,
  note: r.note ? String(r.note).replace(/<[^>]+>/g, "").slice(0, 240) : null });

function partyDossier(book, key, party) {
  const rows = (book[key === "customer" ? "sales" : "purchases"] || []).filter((r) => r[key] === party);
  const live = rows.filter((r) => !r.cancelled && !r.defaulted && !r.rebate && r.date);
  const rates = live.filter((r) => +r.qty > 0 && +r.total > 0).map((r) => (r.total) / r.qty).sort((a, b) => a - b);
  return {
    orders: rows.length,
    lastRows: rows.slice(-8).map(pick),
    medianRate: rates.length ? r2(rates[Math.floor(rates.length / 2)]) : null,
    rateRange: rates.length ? [r2(rates[0]), r2(rates[rates.length - 1])] : null,
    /* v738 on a sale: the goods and the delivery together. ON A LOT IT IS THE ENGINE'S OWN READER
       (22 Sep 2026): total less the row's cash counted a lot that carries no cash field at all as
       wholly unpaid, so SA5-BTR read RM3,260 outstanding where poOwed reads RM160, and the notes
       written off this dossier had been repeating the larger figure. poCash reads the trail. */
    outstandingBefore: r2(live.reduce((a, r) => a + (key === "customer" ? Math.max(0, E.txOwed(r) - (+r.cash || 0)) : E.poOwed(r)), 0)),
    unitsOnCreditBefore: key === "customer" ? r2(live.reduce((a, r) => { const p = +r.qty > 0 ? r.total / r.qty : 0; return a + Math.max(0, (+r.deliveredQty || 0) - (p > 0 ? (+r.cash || 0) / p : 0)); }, 0)) : null,
    defaultedRM: r2(rows.filter((r) => r.defaulted).reduce((a, r) => a + (E.txOwed(r) - (+r.cash || 0)), 0)),
    associate: (book.associates || []).includes(party),
    onRoster: (book.roster || []).includes(party),
  };
}

const evalJSON = (w, expr) => JSON.parse(w.eval("JSON.stringify(" + expr + ")"));

export function dossier(book, staged, p, w) {
  const items = [];
  for (const it of p.items) {
    const src = staged.approved.find((x) => x.id === it.id) || {};
    const row = src.row || {};
    const prod = row.product || "salt";
    const d = { id: it.id, what: it.what, does: it.does, collection: src.collection, amendKind: src.amendKind || null, amends: src.amends || null,
      row, entry: src.entry && src.entry.payload ? src.entry.payload : null, entryRaw: src.entry && src.entry.raw ? src.entry.raw : null,
      drafterReasoning: src.reasoning || null, drafterFlags: src.flags || [], decidedAt: src.decidedAt || null, decidedBy: src.decidedBy || null };
    try { w.eval(`setProd(${JSON.stringify(prod)});`); } catch (e) { /* a product the desk cannot set keeps the current one */ }
    if (src.amends) {
      const key = (src.collection === "purchases") ? "supplier" : "customer";
      const coll = book[src.collection === "purchases" ? "purchases" : "sales"] || [];
      const target = coll.find((r) => r.rid === src.amends) || null;
      d.target = target ? Object.assign(pick(target), { trail: (target.amend || []).map((a) => ({ date: a.date, kind: a.kind, cash: a.cash, kg: a.kg })) }) : null;
      if (target && target[key]) d.party = Object.assign({ code: target[key] }, partyDossier(book, key, target[key]));
    } else if (src.collection === "sales" || src.collection === "purchases") {
      const key = src.collection === "sales" ? "customer" : "supplier";
      const code = row[key];
      d.party = Object.assign({ code }, partyDossier(book, key, code));
      if (src.collection === "sales" && +row.qty > 0) {
        try {
          const L = evalJSON(w, `priceLadder(${+row.qty})`);
          d.ladder = { size: +row.qty, floor: r2(L.floor && L.floor.total), ask: r2(L.ask && L.ask.total), ceiling: r2(L.ceiling && L.ceiling.total) };
          d.goods = r2((+row.total || 0) - (+row.delivery || 0));
          d.creditCap = evalJSON(w, `creditCapFor(${JSON.stringify(prod)}, ${d.party.associate ? "'associate'" : "'retail'"})`);
        } catch (e) { d.ladder = null; }
      }
      if (src.collection === "purchases") {
        /* 09 Sep 2026: THE BOOK HOLDS ONE LIVE QUOTE PER PRODUCT. This filtered the salt quote
           as an array and threw on the first lot staged since v521, and the hourly net threw again
           every hour with the lot left unfolded. The quote's date is quotedOn.
           v776: the book's own QUOTES map, read by key. It was a literal two-entry object over
           supplierQuote and oilQuote, so a product registered in PRODUCTS but absent from that
           object yielded undefined, fell to null, and its lot folded with no quote in the dossier
           while nothing errored. A product with no quote still reads null; the difference is that
           the map now answers for every product the book carries rather than for two by name. */
        const q = (book.QUOTES || {})[prod] || null;
        d.quote = q ? { date: q.quotedOn || q.date || null, supplier: q.supplier, tiers: q.tiers } : null;
      }
    } else if (src.collection === "loan" && row.party) {
      d.party = Object.assign({ code: row.party }, partyDossier(book, "customer", row.party));
    } else if (src.collection === "count") {
      try {
        const before = evalJSON(w, "({floor1:floorTotal(1),floor2:floorTotal(2),floor125:floorTotal(12.5),ask1:priceLadder(1).ask.total,selfUse:selfUse})");
        w.eval(`COUNTS.push(${JSON.stringify({ product: prod, date: row.date, qty: row.qty, was: row.was, drift: row.drift })});COUNT_ON[${JSON.stringify(prod)}]=${JSON.stringify(row.date)};statedStockBy[${JSON.stringify(prod)}]=${+row.qty};recompute();`);
        const after = evalJSON(w, "({floor1:floorTotal(1),floor2:floorTotal(2),floor125:floorTotal(12.5),ask1:priceLadder(1).ask.total,selfUse:selfUse})");
        d.floors = { before, after };
      } catch (e) { d.floors = null; }
    }
    items.push(d);
  }
  let position = null;
  try { w.eval("setProd('salt');"); position = evalJSON(w, "({stock:currentStock,ledger:ledgerStock,selfUse:selfUse,stockCost:stockCostFor('salt'),replCost:replCost(),reorderAt:reorderFor('salt'),owedOut:POSITION_ENGINE.commitments(sales,currentStock).owedUnits,promised:POSITION_ENGINE.commitments(sales,currentStock).promUnits})"); } catch (e) { /* the notes say what they can */ }
  /* the style sample is the newest audited row's own note, which is the register wanted, and the
     newest fold's title; a version entry about the chain itself would teach the wrong voice */
  const ev = (book.__evolution || []).find((e) => e && Array.isArray(e.n) && /RM \d/.test(String(e.n[0] || ""))) || null;
  const lastSale = (book.sales || []).filter((r) => r.note && r.date).slice(-1)[0] || null;
  return {
    today: TODAY, todayKL: dayOf(TODAY),
    version: { last: book.__version, next: nextVersion(book.__version) },
    inventory: { stated: book.STATED_STOCK, countOn: book.COUNT_ON, position, loansOpen: (book.loans || []).filter((l) => l.status !== "settled" && !l.preOpening).map((l) => ({ party: l.party, direction: l.direction || "out", units: l.valueKg, date: l.date })) },
    moves: p.moves,
    styleSample: { lastFoldTitle: ev ? ev.t : null, lastRowNote: lastSale ? String(lastSale.note).slice(0, 900) : null },
    items,
  };
}

export function nextVersion(v) { const n = parseInt(String(v || "").replace(/^v/, ""), 10); return Number.isFinite(n) ? "v" + (n + 1) : null; }

/* ---- the contract: what the reply must look like ----------------------------------------- */
/* THE SCHEMA IS THE SAME FOR EVERY BATCH (26 Sep 2026). It named each row's id as a property with
   rowNote and cost each ["x", "null"], so it grew with the batch, and the API refused it twice: at 14
   rows for 29 union-typed parameters (run 36180354574, the fold landed on the tool's notes), and at
   40 rows, unions cut, for a compiled grammar too large (probe run 36204519170). Now rows is an array
   of {id, note, rowNote, cost}, with rowNote and cost empty strings when none: stockCost is the one
   union, and no batch size changes the grammar. The ids are held to the batch by checkNotes, as they
   always were after the call; fromReply makes the reply the object checkNotes and fold.mjs read. */
export function schemaFor() {
  return { type: "object", additionalProperties: false,
    required: ["version", "title", "notes", "rows", "stockNote", "stockCost", "stockCostNote"],
    properties: {
      version: { type: "string" }, title: { type: "string" },
      notes: { type: "array", items: { type: "string" }, minItems: 1 },
      rows: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "note", "rowNote", "cost"],
        properties: { id: { type: "string" }, note: { type: "string" }, rowNote: { type: "string" }, cost: { type: "string" } } } },
      stockNote: { type: "string" }, stockCost: { type: ["number", "null"] }, stockCostNote: { type: "string" },
    } };
}

/* The reply as checkNotes reads it: rows keyed by id, an empty rowNote or cost null, a cost in digits
   the number. Anything else is left as sent, so checkNotes refuses it exactly as it always has; an id
   given twice is keyed "<id> (twice)", which checkNotes refuses as a row not in the batch. Rows
   already keyed by id, as a fake reply may carry them, are read the same way. */
export function fromReply(reply) {
  if (!reply || typeof reply !== "object" || !reply.rows || typeof reply.rows !== "object") return reply;
  const list = Array.isArray(reply.rows) ? reply.rows : Object.entries(reply.rows).map(([id, r]) => (r && typeof r === "object" ? { ...r, id } : { id }));
  const blank = (v) => typeof v === "string" && !v.trim();
  const rows = {};
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const { id, ...rest } = r;
    rows[Object.prototype.hasOwnProperty.call(rows, String(id)) ? id + " (twice)" : String(id)] = { ...rest, rowNote: blank(rest.rowNote) ? null : rest.rowNote,
      cost: blank(rest.cost) ? null : (typeof rest.cost === "string" && /^\s*\d+(\.\d+)?\s*$/.test(rest.cost) ? +rest.cost : rest.cost) };
  }
  return { ...reply, rows };
}

export function checkNotes(notes, expectVersion, ids) {
  const bad = [];
  if (!notes || typeof notes !== "object") return ["the reply is not an object"];
  if (notes.version !== expectVersion) bad.push(`version must be ${expectVersion}, got ${notes.version}`);
  if (typeof notes.title !== "string" || notes.title.length < 8 || notes.title !== notes.title.toUpperCase()) bad.push("the title is written in capitals, as every entry before it");
  if (!Array.isArray(notes.notes) || !notes.notes.length || !notes.notes.every((n) => typeof n === "string" && n.length >= 40)) bad.push("notes is an array of at least one HTML string, each a paragraph");
  const rows = notes.rows || {};
  for (const id of ids) {
    const r = rows[id];
    if (!r || typeof r.note !== "string" || r.note.length < 40) bad.push(`rows.${id}.note must be a paragraph a person auditing the row would need`);
    if (r && r.cost != null && !(Number.isFinite(+r.cost) && +r.cost > 0)) bad.push(`rows.${id}.cost is RM for the whole order or null`);
  }
  for (const k of Object.keys(rows)) if (!ids.includes(k)) bad.push(`rows carries ${k}, which is not in the batch`);
  const text = JSON.stringify(notes);
  if (/[—–]/.test(text)) bad.push("no em-dashes or en-dashes: use a comma, a colon or a full stop");
  if (/\b(kg|kilo|kilos|kilogram|kilograms)\b/i.test(text)) bad.push("RM and unit only: never kg or kilo");
  if (/\bd\u0065ar(?:er|est|ly)?\b/i.test(text)) bad.push("never the word d\u0065ar in any form: write expensive, costly, higher, or the figure");
  if (/<script|javascript:/i.test(text)) bad.push("no script in a note");
  if (/[a-z]+ (?:said|told) (?:me|us)|\bMr\.? |\bMrs\.? |\bEn\.? |\bPuan |\bEncik /.test(text)) bad.push("codes only, never a name or a title");
  return bad;
}

/* ---- the call ------------------------------------------------------------------------------- */
const SYSTEM = `You write the audit notes for a fold of the Salt Command trading book: a small salt trade in Malaysia, kept as a ledger of rows, each with a note a person auditing it would need. The fold tool has already decided what each row DOES; you supply the prose and the version entry, and nothing else.

House style, not optional: plain British English; no em-dashes or en-dashes (use a comma, a colon or a full stop); RM and "unit" only, never kg or kilo; never the word d\u0065ar in any form (write expensive, costly, higher, or the figure); party CODES only (like CJ4-BJ, SA5-BTR), never a name, a title or a place; figures only from the dossier, never computed by hand, and quoted exactly (a floor, an ask, a rate, a margin); each note opens with a bold lead in capitals inside <b></b>, then the facts. A note names what happened, the terms, how the rate stands against the desk's own floor and ask for that size, the party's own history (median rate, range, outstanding, credit against the cap), the cost the row carries and whether it is the inventory's own, what the drafter flagged and whether the figures answer the flag, and what is left outstanding. For an amendment: what moved, when, and what it leaves. For a count: what was counted against what the book said, where the gap sits, and how the floors move. Never invent a row or a reason for a gap: say what the dossier says and no more. Say "on his word" for a fact the dossier marks as decided by him.

LENGTH, and it is a rule: a row note is 60 to 120 words; each version note is one paragraph of 50 to 90 words; two version notes for a batch of one or two rows, three at most for a larger batch. Say each fact once. The first live fold wrote 4,700 tokens in 60 seconds, and the chain is measured in seconds.

The version entry: "version" is exactly the next version given; "title" in CAPITALS, a short line; "notes" an array of HTML paragraphs, each opening with a bold lead, saying what was folded, what was unusual, and what the inventory did. "stockNote" is one or two sentences appended to the roll sentence the tool writes (empty string when nothing moved). "stockCost" is null unless a lot landed and the cost basis moves, then RM per unit with "stockCostNote" saying why. "rows" holds one entry for each id in the batch, its "id" copied exactly and "note" the row's note. Its "rowNote" is an empty string unless a short bold line should be prepended to an amended row's own note. Its "cost" is an empty string unless the dossier shows the draft's cost is not the inventory's own rate, then the RM for the whole order in digits alone, like 312.50.`;

export function requestFor(d, ids) {
  const user = `Today is ${d.todayKL} (Kuala Lumpur). The master stands at ${d.version.last}; this fold is ${d.version.next}.

THE DOSSIER, as JSON. Everything you may cite is in it.
${JSON.stringify(d, null, 1)}

Reply with the notes JSON only: version "${d.version.next}", the title, the notes array, rows for exactly these ids ${JSON.stringify(ids)}, stockNote, stockCost, stockCostNote.`;
  return { model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: user }], output_config: { effort: "medium", format: { type: "json_schema", schema: schemaFor() } } };
}

/* THE CALL IS BOUNDED, SO THE FOLD NEVER WAITS ON IT (26 Sep 2026). The client used to keep the
   SDK's ten-minute wait an attempt with six retries: seven attempts, two calls, about 2 h 20 min
   holding the chain's one concurrency slot. Measured fold calls took 13.4 to 33.0 s over 18 folds,
   so 90 s an attempt is about three times the slowest. The SDK retries a timeout as it does 429,
   529 and 5xx, backing off from 0.5 s doubling to 8 s, so three retries sleep at most 3.5 s: a call
   is bounded at 4 x 90 s + 3.5 s, about 6.1 min, and the call with its one correction at about
   12.2 min, under the chain job's 30 minutes. Six retries (08 Sep 2026, after three runs failed on
   http 529 inside twenty seconds) slept at most 23.5 s, not the two minutes once written here; a
   529 burst now costs the judgement more often, never the fold, which lands on the tool's notes.
   SALT_FOLD_RETRIES and SALT_FOLD_TIMEOUT_MS override both; the suite drives them. */
export function sdkOptions(env = process.env) {
  const num = (v) => (v == null || String(v).trim() === "" ? NaN : +v);
  const r = num(env.SALT_FOLD_RETRIES), t = num(env.SALT_FOLD_TIMEOUT_MS);
  return { maxRetries: Number.isInteger(r) && r >= 0 ? r : 3, timeout: t > 0 ? t : 90_000 };
}

async function callClaude(req) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic(sdkOptions());
  const res = await client.messages.create(req);
  if (res.stop_reason === "refusal") throw new Error("the model declined: " + JSON.stringify(res.stop_details || null));
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  /* v540: an empty reply used to surface as "Unexpected end of JSON input", which names the parser
     and not the cause; say what came back and why it stopped. */
  if (!text.trim()) throw new Error(`the model returned no text (stop_reason ${res.stop_reason}, ${res.content.length} block(s), ${res.usage && res.usage.output_tokens} tokens out)`);
  return { notes: fromReply(JSON.parse(text)), raw: text, usage: res.usage, stop: res.stop_reason };
}

/* ---- main ----------------------------------------------------------------------------------- */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (argv.includes("--probe")) {
    /* THE KEY, PROVED WHERE IT IS USED. A secret set from a laptop is a claim until a run has
       spent it; this asks the API for the fold's model and nothing else. */
    if (!process.env.ANTHROPIC_API_KEY) { console.log("  FAIL  ANTHROPIC_API_KEY is not set"); process.exit(1); }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const t0 = Date.now();
    /* THE BALANCE, NOT ONLY THE KEY (08 Sep 2026). models.retrieve needs no credit and answered on an
       account with none; the first real fold then failed with "credit balance is too low". One
       five-token message proves what the fold will actually need. */
    /* AND THE SCHEMA (26 Sep 2026). A bare message proved the key while the fold's own schema was
       refused (run 36180354574), so the message carries that schema, the same for every batch: a
       schema the API will not compile fails here, not on a fold. */
    try {
      const client = new Anthropic(sdkOptions());   /* the fold's bound, so a silent API fails the probe too */
      const m = await client.models.retrieve(MODEL);
      const r = await client.messages.create({ model: MODEL, max_tokens: 5, messages: [{ role: "user", content: "Reply with the notes JSON." }],
        output_config: { format: { type: "json_schema", schema: schemaFor() } } });
      console.log(`  ok    the key answers, the account is funded and the fold's schema compiles: ${m.id} (${m.display_name}), ${r.usage.input_tokens} in, ${r.usage.output_tokens} out, ${((Date.now() - t0) / 1000).toFixed(1)} s`); process.exit(0);
    }
    catch (e) { console.log("  FAIL  the call was refused: " + (e && e.status ? "http " + e.status + " " : "") + String((e && e.message) || e).slice(0, 220)); process.exit(1); }
  }
  const dry = argv.includes("--dry");
  const passthrough = [];
  for (const k of ["--staged", "--book", "--master", "--notes", "--folded", "--today"]) { const v = opt(k, null); if (v) passthrough.push(k, v); }
  if (!existsSync(STAGED)) { console.log("  nothing to fold: no staged batch. Stop here; do not bump a version."); process.exit(0); }
  if (existsSync(FOLDED)) { console.log("  the last batch is folded and waiting for its deploy (" + FOLDED + " is present). Stop here."); process.exit(0); }
  const staged = JSON.parse(readFileSync(STAGED, "utf8"));
  if (!staged.ok || !staged.count) { console.log("  nothing to fold: the staged batch is empty. Stop here; do not bump a version."); process.exit(0); }
  const book = readBookFile(BOOK);
  const p = plan(book, staged, null);
  for (const it of p.items) console.log(`  FOLD     ${it.id}  ${it.what}\n           -> ${it.does.join("; ")}`);
  for (const x of p.refused) console.log(`  REFUSE   ${x.id}  ${x.why}`);
  if (p.refused.length) {
    /* A REFUSAL FOLDS NOTHING. It is recorded where the phone shows refusals when the run holds
       the credential to do so; the batch stays staged and a person resolves it. */
    if (process.env.CLOUDFLARE_API_TOKEN) {
      for (const x of p.refused) {
        const r = spawnSync(process.execPath, [resolve(REPO, "tools", "drafts.mjs"), "--refused-note", x.id, "The fold refused this: " + x.why], { cwd: REPO, encoding: "utf8" });
        console.log("  " + (r.status === 0 ? "noted" : "could not note") + "  " + x.id);
      }
    }
    console.log("\n  A refusal folds nothing. Resolve it or take the row out of the batch."); process.exit(1);
  }
  const rb = await readBook(MASTER);
  /* v803: the master carries only the current entry, so the style sample is read off the record */
  book.__version = rb.version;
  try { book.__evolution = JSON.parse(readFileSync(resolve(REPO, "master", "changelog.json"), "utf8")); } catch (e) { book.__evolution = rb.meta.evolution || []; }
  const ids = p.items.map((it) => it.id);
  const d = dossier(book, staged, p, rb.w);
  try { rb.w.close(); } catch (e) { /* jsdom */ }
  const req = requestFor(d, ids);
  if (dry) { console.log(JSON.stringify({ model: req.model, system: req.system, user: req.messages[0].content, schema: req.output_config.format.schema }, null, 1)); process.exit(0); }
  let notes, problems = [], why = null;
  /* WHY, AND NOT A BOOLEAN. Every road to the tool's own notes ends here carrying the reason in
     words, because that reason is what the version entry and the run's log have to say: a fold
     that quietly reads differently from the one before it is worse than one that stopped. */
  const noModel = argv.includes("--no-model") || process.env.SALT_FOLD_NOMODEL === "1";
  if (process.env.SALT_FOLD_FAKE) {
    /* THE FAKE IS AN INSTRUMENT AND STAYS STRICT. It says use this reply, so a reply against the
       house rules folds nothing and the suite can still prove the checker gates the model. */
    notes = fromReply(JSON.parse(readFileSync(process.env.SALT_FOLD_FAKE, "utf8")));
    problems = checkNotes(notes, d.version.next, ids);
  } else if (noModel) {
    why = "The tool's own notes were asked for outright, with --no-model.";
  } else if (!process.env.ANTHROPIC_API_KEY) {
    why = "No ANTHROPIC_API_KEY was set, so the model was never called.";
  } else {
    const t0 = Date.now();
    /* A CALL THAT FAILS IS SAID ON THE PHONE (08 Sep 2026). The first live fold failed on an
       unfunded account and nothing outside the run's log said so; the batch sat staged. The
       failure is recorded where the phone shows refusals, under an id above the watermark, so
       the Approve view carries it until the next fold clears it. It is still said, and since
       22 Sep 2026 the batch no longer waits on it: the fold lands on the tool's own notes. */
    const said = async (line) => {
      if (!process.env.CLOUDFLARE_API_TOKEN) return;
      const r = spawnSync(process.execPath, [resolve(REPO, "tools", "drafts.mjs"), "--refused-note", "fold:" + ids[0], line], { cwd: REPO, encoding: "utf8" });
      console.log("  " + (r.status === 0 ? "noted" : "could not note") + "  on the phone: " + line.slice(0, 120));
    };
    let got = null;
    try { got = await callClaude(req); }
    catch (e) {
      why = "The model could not be called: " + (e && e.status ? "http " + e.status + ", " : "") + String((e && e.message) || e).replace(/\s+/g, " ").slice(0, 200) + ". The tool wrote these notes instead, so the fold lands.";
      console.log("  WARN  " + why);
      await said(phoneLine(why, d.version.next));   /* v809: plain words on the phone; the raw error stays in `why` */
    }
    if (got) {
      console.log(`  call  ${MODEL}: ${got.usage.input_tokens} in, ${got.usage.output_tokens} out, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      notes = got.notes; problems = checkNotes(notes, d.version.next, ids);
      if (problems.length) {
        /* ONE RETRY, with the problems named. A second failure takes the tool's own notes. */
        console.log("  retry " + problems.join("; "));
        const again = { ...req, messages: req.messages.concat([{ role: "assistant", content: got.raw },{ role: "user", content: "That reply was refused for these reasons; send the corrected notes JSON:\n- " + problems.join("\n- ") }]) };
        try { got = await callClaude(again); notes = got.notes; problems = checkNotes(notes, d.version.next, ids); }
        catch (e) { problems = ["the retry could not be sent: " + String((e && e.message) || e).replace(/\s+/g, " ").slice(0, 120)]; }
        if (problems.length) { why = "The model answered twice against the house rules: " + problems.join("; ") + ". The tool wrote these notes instead."; console.log("  WARN  " + why); problems = []; }
      }
    }
  }
  /* THE ONE PLACE THE TOOL'S NOTES ARE MADE, whichever road reached it. They are checked like any
     other reply: notes that could not pass would leave the batch staged for the very reason this
     road exists to remove, so the check is the proof and not a formality. */
  if (why) {
    notes = toolNotes(d, ids, why);
    problems = checkNotes(notes, d.version.next, ids);
    console.log("  notes written by the tool, no model: " + why.slice(0, 160));
  }
  if (problems.length) { console.log("  FAIL  the notes were refused:\n        " + problems.join("\n        ")); process.exit(1); }
  const out = { version: notes.version, date: dayOf(TODAY), title: notes.title, notes: notes.notes, rows: {}, stockNote: notes.stockNote || "", stockCost: notes.stockCost == null ? null : notes.stockCost, stockCostNote: notes.stockCostNote || "" };
  for (const id of ids) { const r = notes.rows[id]; out.rows[id] = { what: (p.items.find((it) => it.id === id) || {}).what, note: r.note }; if (r.rowNote) out.rows[id].rowNote = r.rowNote; if (r.cost != null) out.rows[id].cost = r.cost; }
  writeFileSync(NOTES, JSON.stringify(out, null, 2) + "\n");
  console.log(`  ok    wrote ${NOTES} for ${out.version}: ${out.title}`);
  const a = spawnSync(process.execPath, [resolve(REPO, "tools", "fold.mjs"), "--apply", ...passthrough], { cwd: REPO, encoding: "utf8" });
  process.stdout.write(a.stdout || ""); process.stderr.write(a.stderr || "");
  process.exit(a.status === 0 ? 0 : 1);
}
