/* foldnotes.mjs — THE FOLD'S PROSE WITHOUT A MODEL (his instruction of 22 Sep 2026: remove the
 * need for the Anthropic API).
 *
 * WHY IT EXISTS. tools/foldcall.mjs asks Claude once for the prose a fold cannot compute: the note
 * on every row, the version entry, the sentence on the roll. On 22 Sep 2026 the account ran out of
 * credit, the Fold step exited 1 twice inside a minute, and two approved rows sat staged with the
 * whole tail of the chain behind them: no deploy, no marks, no mirror re-seed, no statements, no
 * suite. A judgement is worth a model. A chain that stops dead without one is not, and this is the
 * difference between the two: the same notes object, composed from the dossier the tools already
 * compute, so the fold always lands.
 *
 * WHAT IT IS NOT, AND EVERY NOTE IT WRITES SAYS SO. It states facts and records no judgement. A
 * model reads the drafter's flag against the figures and says whether the figures answer it; this
 * names the flag and stops. A reader must be able to tell one kind of note from the other, so the
 * line is in the row note, not only in the version entry where it would be one search away.
 *
 * THE MODEL IS STILL FIRST. foldcall calls it wherever a key answers; this is what happens instead
 * of stopping, and `--no-model` asks for it outright.
 */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/* Node's en-GB writes "Sept", which is not how this book dates anything: build it from parts. */
const dayOf = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "")); return m ? `${+m[3]} ${MON[+m[2] - 1]} ${m[1]}` : String(iso || ""); };
const rm = (v) => Number.isFinite(+v) ? "RM" + (+v).toLocaleString("en-GB", { maximumFractionDigits: 2 }) : null;
const cap = (s) => { const t = String(s || "").trim(); return t ? t[0].toUpperCase() + t.slice(1) : ""; };
const join = (parts) => parts.filter(Boolean).join(" ");

/* THE ONE UNTRUSTED STRING. `why` carries an API error verbatim, so it can hold an em-dash, the
 * word this house does not write, a unit this house does not use, or markup. It is scrubbed rather
 * than trusted: notes that fail checkNotes would leave the batch staged for the reason the fallback
 * exists to remove. */
export const scrub = (s) => String(s == null ? "" : s)
  .replace(/<[^>]*>/g, " ")
  .replace(/[\u2014\u2013]/g, ",")
  .replace(/\b(kg|kilos?|kilograms?)\b/gi, "unit")
  .replace(new RegExp("\\bd\u0065ar(er|est|ly)?\\b", "gi"), "costly")
  .replace(/javascript:/gi, " ")
  .replace(/\s+/g, " ").trim().slice(0, 220);

/* what a row is worth saying about itself: the terms, then the party, then the flags */
function rowNoteFor(it) {
  const r = it.row || {};
  const qty = +r.qty, total = +r.total;
  const terms = [];
  if (qty > 0 && Number.isFinite(total)) terms.push(`${qty} unit for ${rm(total)}, ${rm(+(total / qty).toFixed(2))} a unit`);
  if (Number.isFinite(+r.cash) && +r.cash > 0) terms.push(`${rm(+r.cash)} paid`);
  if (Number.isFinite(+r.delivery) && +r.delivery > 0) terms.push(`${rm(+r.delivery)} delivery`);
  if (r.date) terms.push(`dated ${dayOf(r.date)}`);

  const lad = it.ladder && Number.isFinite(it.ladder.floor)
    ? `The desk's own floor for ${it.ladder.size} unit is ${rm(it.ladder.floor)} and the ask ${rm(it.ladder.ask)}.`
    : "";

  const p = it.party;
  const party = p ? join([
    `${p.code}:`,
    `${p.orders} order${p.orders === 1 ? "" : "s"} on the book`,
    Number.isFinite(p.medianRate) && p.medianRate ? `, median ${rm(p.medianRate)} a unit` : "",
    Array.isArray(p.rateRange) && p.rateRange.length === 2 ? `, range ${rm(p.rateRange[0])} to ${rm(p.rateRange[1])}` : "",
    Number.isFinite(p.outstandingBefore) ? `, ${rm(p.outstandingBefore)} outstanding before this row` : "",
    p.defaultedRM ? `, ${rm(p.defaultedRM)} written off` : "",
    ".",
  ]).replace(/ ,/g, ",").replace(/ \./g, ".") : "";

  const t = it.target;
  const target = t ? `It applies to ${t.rid}, ${t.qty} unit for ${rm(t.total)} with ${rm(t.cash || 0)} paid${t.date ? " on " + dayOf(t.date) : ""}.` : "";

  const flags = (it.drafterFlags || []).length
    ? `The drafter flagged: ${it.drafterFlags.map((f) => scrub(f)).join(" ").replace(/\.?$/, ".")}`
    : "The drafter raised no flag.";

  return join([
    `<b>${String(it.what || it.collection || "A ROW").toUpperCase()}.</b>`,
    it.does && it.does.length ? cap(it.does.join("; ")) + "." : "",
    /* an amendment's own row IS the target, so the terms would be said twice */
    !t && terms.length ? cap(terms.join(", ")) + "." : "",
    target, lad, party, flags,
    "Written by the tool, so the facts stand as the dossier gives them and no judgement is recorded on them.",
  ]);
}

/* THE WHOLE NOTES OBJECT, in the shape schemaFor() names and checkNotes() enforces. */
export function toolNotes(d, ids, why) {
  const items = ids.map((id) => (d.items || []).find((it) => it.id === id) || { id });
  const rows = {};
  for (const it of items) rows[it.id] = { note: rowNoteFor(it), rowNote: null, cost: null };

  const what = items.map((it) => String(it.what || "a row")).join("; ");
  const title = (items.length === 1 ? String(items[0].what || "ONE ROW FOLDED") : `${items.length} ROWS FOLDED, ${d.todayKL || ""}`).toUpperCase().trim();

  const pos = (d.inventory && d.inventory.position) || null;
  const shelf = pos && Number.isFinite(pos.stock)
    ? ` The stated salt shelf stands at ${pos.stock} unit${d.inventory.countOn && d.inventory.countOn.salt ? ", counted " + dayOf(d.inventory.countOn.salt) : ""}, and this fold rolls it only for what physically moved.`
    : "";

  return {
    version: d.version && d.version.next,
    title: title.length >= 8 ? title : "ROWS FOLDED FROM THE PHONE",
    notes: [
      `<b>${items.length} ROW${items.length === 1 ? "" : "S"} FOLDED FROM THE PHONE.</b> ${cap(what)}.${shelf}`,
      `<b>WRITTEN BY THE TOOL, NOT A MODEL.</b> ${scrub(why) || "The model was not called."} The figures are the dossier's own and the prose is tools/foldnotes.mjs, so every row here carries its terms, its party's history and the drafter's flags, and none of them carries a judgement on those flags. Each row note says as much on its own line, because a reader holding one row should not have to come here to learn it.`,
    ],
    rows,
    stockNote: "",
    stockCost: null,
    stockCostNote: "",
  };
}

export default { toolNotes, scrub };
