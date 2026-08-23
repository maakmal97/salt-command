/* booksync.mjs — THE BOOK IS DATA, AND THE DESK CARRIES A GENERATED COPY OF IT (move 2, v339).
 *
 * ledger/book.json is the source of the book: the twenty-six ledger declarations the desk used
 * to hold as JavaScript (sales, purchases, the opening, the stated stock, the count dates, the
 * roster, the quotes, the watermark and the rest), plus NOTES, the prose that used to sit in
 * comments beside them. The desk cannot load a file, so this tool writes the book into
 * master/salt_command.html between two markers as plain declarations, and CI fails if that
 * block is not what book.json renders to. Same rule, same reason as tools/engine.mjs.
 *
 *   node tools/booksync.mjs --sync        render ledger/book.json into the master between the markers
 *   node tools/booksync.mjs --check       exit 1 if the block in the master is not the book
 *   node tools/booksync.mjs --normalise   rewrite ledger/book.json in the canonical layout (one row per line)
 *
 * EDIT THE JSON, NEVER THE BLOCK. The fold writes book.json and runs --sync; a hand edit inside
 * the markers is overwritten by the next --sync and fails --check in CI until then.
 *
 * WHAT IS RENDERED. Every key of book.json except NOTES becomes `const KEY=<json>;`. JSON is
 * valid JavaScript for these values, and the extract has proved since 12 Aug that every value in
 * the book survives JSON, so nothing is lost in the rendering. NOTES[KEY] is an array of prose
 * blocks rendered as comments above the declaration: the history that used to live in the
 * comments beside the data (the roll of the stated stock, the oil counts, the 07 Aug orders)
 * is kept as data now, where the fold can add to it. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = resolve(REPO, "master", "salt_command.html");
const BOOK = resolve(REPO, "ledger", "book.json");

export const BEGIN = "/* ==== BOOK: generated from ledger/book.json by tools/booksync.mjs. Edit the JSON, never this block. ==== */";
export const END = "/* ==== END BOOK ==== */";

/* one row per line for a list of records, so a diff of the master reads as a diff of rows */
export function renderValue(v) {
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    if (v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
      return "[\n" + v.map((x) => "  " + JSON.stringify(x)).join(",\n") + "\n]";
    }
    return JSON.stringify(v);
  }
  if (v && typeof v === "object") return JSON.stringify(v, null, 2);
  return JSON.stringify(v);
}

function safeComment(t) { return String(t).replace(/\*\//g, "* /"); }

export function renderBlock(book) {
  const notes = book.NOTES || {};
  const out = [BEGIN];
  for (const k of Object.keys(book)) {
    if (k === "NOTES") continue;
    for (const n of (notes[k] || [])) out.push("/* " + safeComment(n) + " */");
    out.push("const " + k + "=" + renderValue(book[k]) + ";");
  }
  out.push(END);
  return out.join("\n");
}

/* the canonical file layout: two-space objects, one record per line inside collections */
export function renderBook(book) {
  const lines = ["{"];
  const keys = Object.keys(book);
  keys.forEach((k, i) => {
    const v = book[k], last = i === keys.length - 1;
    let body;
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
      body = "[\n" + v.map((x) => "    " + JSON.stringify(x)).join(",\n") + "\n  ]";
    } else if (k === "NOTES" && v && typeof v === "object") {
      body = JSON.stringify(v, null, 2).split("\n").map((l, j) => (j ? "  " + l : l)).join("\n");
    } else {
      body = JSON.stringify(v, null, 2).split("\n").map((l, j) => (j ? "  " + l : l)).join("\n");
    }
    lines.push("  " + JSON.stringify(k) + ": " + body + (last ? "" : ","));
  });
  lines.push("}");
  return lines.join("\n") + "\n";
}

export function readBookFile() { return JSON.parse(readFileSync(BOOK, "utf8")); }

function locate(master) {
  const b = master.indexOf(BEGIN), e = master.indexOf(END);
  if (b < 0 && e < 0) return null;
  if (b < 0 || e < b) throw new Error("the BOOK markers in the master are damaged");
  if (master.indexOf(BEGIN, b + 1) >= 0) throw new Error("the BOOK begin marker appears twice");
  return { start: b, end: e + END.length };
}

const mode = process.argv[2];
if (mode === "--normalise") {
  const book = readBookFile();
  writeFileSync(BOOK, renderBook(book));
  console.log(`  ok    ledger/book.json rewritten in the canonical layout (${Object.keys(book).length} keys)`);
} else if (mode === "--sync" || mode === "--check") {
  const book = readBookFile();
  const want = renderBlock(book);
  let master = readFileSync(MASTER, "utf8");
  const at = locate(master);
  if (mode === "--sync") {
    if (at) master = master.slice(0, at.start) + want + master.slice(at.end);
    else {
      /* first time: after the last inlined engine, so the engines exist before the book and
         the book exists before anything that reads it */
      const eng = master.lastIndexOf("/* ==== END ENGINE ");
      let i = eng >= 0 ? master.indexOf("\n", eng) + 1 : -1;
      if (i <= 0) { const anchor = "\n<script>\n"; const j = master.indexOf(anchor); if (j < 0) throw new Error("no <script> to insert after"); i = j + anchor.length; }
      master = master.slice(0, i) + want + "\n" + master.slice(i);
    }
    writeFileSync(MASTER, master);
    console.log(`  ok    the book is in the master: ${Object.keys(book).length - (book.NOTES ? 1 : 0)} declarations, ${want.split("\n").length} lines`);
  } else {
    if (!at) { console.log("  FAIL  the master carries no BOOK block. Run: node tools/booksync.mjs --sync"); process.exit(1); }
    if (master.slice(at.start, at.end) !== want) { console.log("  FAIL  the BOOK block in the master is not ledger/book.json. Run: node tools/booksync.mjs --sync"); process.exit(1); }
    console.log("  ok    the master's BOOK block is ledger/book.json, byte for byte");
  }
} else if (mode) {
  console.log("usage: node tools/booksync.mjs --sync | --check | --normalise");
  process.exit(2);
}
