#!/usr/bin/env node
/* tools/freenames.mjs: EVERY NAME THE PAGE CALLS IS DEFINED (28 Sep 2026, his instruction, after v925).
 *
 * A name the page never declares throws only when a path reaches it. wbState called a bare poStat, which lives
 * inside the engine block, so every lot Payment, Receipt or Default on the Workbench threw from v492 to v925 while
 * the suite, which never drove that path, stayed green. Two passes find such a name without driving any path:
 *
 *   undeclared    TypeScript's checker over the master's inline script, read as one global script with the DOM
 *                 library, keeps every "Cannot find name". Each is then asked of the loaded page (`typeof`), since a
 *                 name set on window at load is reachable; what the page cannot reach is reported, less LOADED_LATER.
 *   handlerCalls  every `name(` inside an inline handler string (on...="..."), which no checker reads, must be a
 *                 function on the loaded page.
 *
 *   node tools/freenames.mjs [master]   prints what each pass found; exit 1 on any
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { openMaster, opened } from "./payload.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/* reachable only once something has loaded it: the page guards each use */
export const LOADED_LATER = { Chart: "public/assets/chart.umd.js, loaded by ensureChart when a chart is first drawn" };

/* the page's classic inline scripts, and the master line each starts on: the head's theme script (11 Oct 2026) and the page's own */
export function inlineScripts(html) {
  const found = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    const type = (m[1].match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || "";
    if (type && !/javascript/i.test(type)) continue;
    found.push({ code: m[2], line0: html.slice(0, m.index + m[0].indexOf(">") + 1).split("\n").length });
  }
  if (!found.length || found.length > 2) throw new Error("expected the head script and the page's own, found " + found.length + " classic inline scripts");
  return found;
}

/* every name the checker cannot find, with the master lines it is used on. Each script is read as its own global script, and a name the other
   one declares (the head's saltLook) is asked of the loaded page like any other, where it is reachable. */
export function undeclared(html) {
  const dir = mkdtempSync(join(tmpdir(), "freenames-")), out = new Map();
  try {
    inlineScripts(html).forEach(({ code, line0 }, i) => {
      const file = join(dir, "page" + i + ".js");
      writeFileSync(file, code);
      const prog = ts.createProgram([file], {
        allowJs: true, checkJs: true, noEmit: true, noResolve: true, skipLibCheck: true, types: [],
        target: ts.ScriptTarget.ES2022, lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
      });
      const sf = prog.getSourceFile(file);
      for (const d of prog.getSemanticDiagnostics(sf)) {
        const m = /^Cannot find name '([^']+)'/.exec(ts.flattenDiagnosticMessageText(d.messageText, " "));
        if (!m) continue;
        if (!out.has(m[1])) out.set(m[1], []);
        out.get(m[1]).push(line0 + sf.getLineAndCharacterOfPosition(d.start).line);
      }
    });
    return out;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

/* every name an inline handler string calls, with its master lines; `count` is how many handlers were read */
export function handlerCalls(html) {
  const out = new Map();
  let count = 0;
  for (const m of html.matchAll(/\bon[a-z]+=(\\?["'])/g)) {
    const start = m.index + m[0].length, end = html.indexOf(m[1], start);
    if (end < 0 || end - start > 2000) continue;
    count++;
    const line = html.slice(0, m.index).split("\n").length;
    for (const c of html.slice(start, end).matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
      if (/^(if|for|while|switch|return|typeof|function|catch|new|void|delete|in|of|do|else|try)$/.test(c[1])) continue;
      if (!out.has(c[1])) out.set(c[1], []);
      out.get(c[1]).push(line);
    }
  }
  return { out, count };
}

/* both passes over one master: what the loaded page cannot reach */
export async function freeNames(masterPath = process.env.SALT_MASTER || join(REPO, "master", "salt_command.html")) {
  const html = readFileSync(masterPath, "utf8");
  const found = undeclared(html), h = handlerCalls(html);
  const { w } = await openMaster(masterPath);
  try {
    const kind = (n) => { try { return w.eval("typeof " + n); } catch (e) { return "throws"; } };
    return {
      names: [...found].filter(([n]) => !LOADED_LATER[n] && kind(n) === "undefined").map(([n, lines]) => ({ name: n, lines })),
      calls: [...h.out].filter(([n]) => kind(n) !== "function").map(([n, lines]) => ({ name: n, lines })),
      checked: found.size, handlers: h.count,
    };
  } finally { opened.delete(w); try { w.close(); } catch (e) { /* closed already */ } }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const r = await freeNames(process.argv[2] ? resolve(process.argv[2]) : undefined);
  for (const x of r.names) console.log("  FAIL  used, never defined: " + x.name + " (line " + x.lines.join(", ") + ")");
  for (const x of r.calls) console.log("  FAIL  a handler calls what is not a function: " + x.name + " (line " + x.lines.join(", ") + ")");
  console.log(`  ${r.names.length + r.calls.length ? "FAIL" : "ok  "}  the checker cannot find ${r.checked} name(s), ${r.handlers} handler(s) read; `
    + `out of reach: ${r.names.length}, not a function: ${r.calls.length}; loaded later: ${Object.keys(LOADED_LATER).join(", ")}`);
  process.exit(r.names.length + r.calls.length ? 1 : 0);
}
