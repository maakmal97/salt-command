/* payload.mjs: open the master in jsdom, for anything that needs to RUN the desk.
 *
 * WHAT IT WAS, AND WHY THE REST OF IT IS GONE (v387). This file used to build the phone
 * app's payload: it ran the master, called its phonePayload(), refused to write anything
 * that tripped phonePayloadLeaks(), and produced public/data.json. The app it fed is
 * retired on his instruction, and the desk is the sole and only cloud copy of this book,
 * so the payload had no reader and data.json was a second public copy of the position
 * with nobody looking at it.
 *
 * THE LEAK GATE WENT WITH IT, AND THAT IS A REDUCTION WORTH STATING PLAINLY.
 * phonePayloadLeaks() banned the leak_test vocabulary, every per-unit cost on the book and
 * every real name, and it earned its keep: the first payload ever built carried a real
 * name out of actions(), because `revealed` defaults to true since v217. It was the
 * difference between a code and a name on the open web FOR THE APP. It never guarded the
 * desk, which serves cost, margin and the whole P&L at the same public URL, so removing it
 * removes a gate on a road nobody travels rather than a gate on the book. The function is
 * still in the master and still tested; nothing calls it in the build.
 *
 * WHAT IS LEFT is openMaster(), which is the shared jsdom harness. tools/ledger.mjs reads
 * the ledger declarations out of the global scope through it, the suite runs the desk
 * through it, and two copies of it would drift.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const DEFAULT_MASTER =
  resolve(REPO, "master", "salt_command.html");
const MASTER = process.env.SALT_MASTER || DEFAULT_MASTER;

/* OPEN THE MASTER IN A BROWSER THAT IS NOT A BROWSER. Exported because more than one thing
   needs the desk's own runtime: tools/ledger.mjs reads the ledger declarations straight out
   of the global scope, and the suite renders every part through it. Two copies of this
   harness would drift, and a build that priced a lot against a subtly different DOM is
   exactly the class of fault this repo keeps writing tests about. */
export const opened = new Set();   // every window opened here; the suite closes a section's when it ends
export async function openMaster(masterPath = MASTER) {
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
  opened.add(w);
  /* resolved with nothing, and the fallback cleared: resolved with the load event, the eight-second
     timer held the event, the event its window, and so a closed window for eight seconds (17 Sep 2026) */
  await new Promise((r) => {
    if (w.document.readyState === "complete") return r();
    const t = setTimeout(r, 8000);                        // never hang a build on a stray listener
    w.addEventListener("load", () => { clearTimeout(t); r(); });
  });
  return { dom, w };
}
