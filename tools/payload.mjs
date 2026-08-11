/* payload.mjs — the desk's own figures, extracted for a separate phone app.
 *
 * WHY THIS EXISTS
 * `public/index.html` is the whole laptop desk, 938 KB of it, and the phone loads all of
 * it to show three things. A separate phone app cannot simply be written against the
 * ledger, because the moment it computes a price itself there are two pricing engines and
 * they drift; that is the fault the desk spent v205 fixing when the board and the ladder
 * disagreed at 26 of 39 prices.
 *
 * So the phone app computes nothing. This runs the MASTER in jsdom, calls the master's own
 * `phonePayload()`, and writes the answers to `public/data.json`. One engine, one set of
 * figures, rendered twice.
 *
 * IT REFUSES TO WRITE A PAYLOAD THAT LEAKS.
 * `phonePayloadLeaks()` in the master is the gate: the leak_test vocabulary, every per-unit
 * cost in the book, and every real name the directory can currently see. The first payload
 * ever built carried "Chase Chris for RM 90" out of actions(), because `revealed` defaults
 * to true since v217 and ID() therefore returns names. The app this feeds is public by the
 * owner's decision, so a leak here is a leak onto the open internet. A non-empty result
 * fails the build; it does not warn.
 *
 * Usage:  node tools/payload.mjs [--out public/data.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const DEFAULT_MASTER =
  "C:\\Users\\maakm\\Claude\\Projects\\Personal\\Cow-Crm01_Salt Business\\01_Dashboard\\salt_command.html";
const MASTER = process.env.SALT_MASTER || DEFAULT_MASTER;
const OUT = resolve(REPO, "public", "data.json");

export async function buildPayload(masterPath = MASTER) {
  const html = readFileSync(masterPath, "utf8");

  /* The desk expects a real document and a few browser APIs. Storage is stubbed rather
     than left to jsdom's, so nothing this build does can persist into a later run, and
     `fetch` is refused outright: a build must never reach the network to price a lot. */
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
    beforeParse(w) {
      const store = new Map();
      const stub = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
        key: (i) => [...store.keys()][i] ?? null,
        get length() { return store.size; },
      };
      Object.defineProperty(w, "localStorage", { value: stub, configurable: true });
      Object.defineProperty(w, "sessionStorage", { value: stub, configurable: true });
      w.fetch = () => Promise.reject(new Error("no network during a payload build"));
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }));
      w.scrollTo = () => { };
      w.HTMLCanvasElement.prototype.getContext = () => null;   // charts are not needed here
    },
  });

  const w = dom.window;
  await new Promise((r) => {
    if (w.document.readyState === "complete") return r();
    w.addEventListener("load", r);
    setTimeout(r, 8000);                                  // never hang a build on a stray listener
  });

  if (typeof w.phonePayload !== "function") {
    throw new Error("the master has no phonePayload(); it is the contract this build depends on");
  }
  const leaks = typeof w.phonePayloadLeaks === "function" ? w.phonePayloadLeaks() : ["phonePayloadLeaks() missing"];
  const payload = w.phonePayload();
  dom.window.close();
  return { payload, leaks };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("payload.mjs")) {
  const { payload, leaks } = await buildPayload();
  if (leaks.length) {
    console.error("PAYLOAD REFUSED: it carries things that must never leave the desk.");
    leaks.forEach((l) => console.error("  - " + l));
    process.exit(1);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(payload);
  writeFileSync(OUT, json + "\n");
  const kb = (Buffer.byteLength(json) / 1024).toFixed(1);
  console.log(`PAYLOAD OK: public/data.json`);
  console.log(`  version: ${payload.v}  stamped ${payload.stamped}`);
  console.log(`  size:    ${kb} KB   (the built desk is about 900 KB)`);
  console.log(`  carries: ${payload.tiers.length} tiers x ${payload.sizes.length} sizes, ` +
    `${payload.parties.length} parties, ${Object.keys(payload.position).length} products, ` +
    `${payload.actions.length} actions`);
  console.log(`  leaks:   none — vocabulary, cost figures and real names all clear`);
}
