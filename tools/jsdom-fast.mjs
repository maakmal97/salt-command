/* tools/jsdom-fast.mjs: one jsdom cost the browser never pays, taken out with its meaning kept (21 Oct 2026, the suite's speed).
 *
 * WHAT IT COSTS. Document is [LegacyOverrideBuiltIns], so every read of a property of `document` (getElementById, body,
 * querySelector) first asks whether a form, img, iframe, embed or object NAMES that property. jsdom answers from a map of
 * those elements, and throws the map away on EVERY insertion or removal anywhere in the tree, whatever was inserted. The
 * next read of `document.anything` then walks the whole document to rebuild it. A desk render inserts thousands of nodes
 * and reads `document` between them, so a render is a walk of the desk per read: measured on 21 Oct 2026, 70 of the 190
 * seconds of the B5 dashboard section (every control on every part) went to that rebuild alone.
 *
 * WHAT THIS CHANGES. The map is thrown away only when an element that can be in it enters or leaves the tree. The map
 * holds exactly the elements whose local name is embed, form, iframe, img or object, in tree order; inserting or removing
 * any other element moves neither the set nor the order of those, so the map it would rebuild is the map it holds. jsdom
 * runs its own per-element hook (window-properties elementAttached and elementDetached) on every element of a subtree
 * entering or leaving the document, right after the throw-away this defers, so the deferred throw-away runs there when one
 * of the five is among them. Attribute changes (an id or a name set) keep jsdom's own throw-away, untouched.
 *
 * FAILS SAFE. It patches nothing unless every internal it relies on is there in the shape it expects; jsdom is then left as
 * it ships, slower and the same. SALT_JSDOM_STOCK=1 leaves it as it ships on purpose. SALT_JSDOM_CHECK=1 answers each named
 * lookup that stock jsdom would have rebuilt for both ways, the kept map and one rebuilt from scratch, and throws on any
 * difference, writing it and its count of comparisons to SALT_JSDOM_CHECK_LOG: a full suite run under it is the proof that the
 * two never disagree. test/jsdom-fast.mjs drives every road a named element has in and out. */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { appendFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const NAMED = new Set(["embed", "form", "iframe", "img", "object"]);

export function fastNamedProperties() {
  if (process.env.SALT_JSDOM_STOCK === "1") return "stock";
  let root, Doc, props, utils;
  try {
    root = join(dirname(require.resolve("jsdom/package.json")), "lib");
    Doc = require(join(root, "jsdom", "living", "nodes", "Document-impl.js")).implementation;
    props = require(join(root, "jsdom", "living", "window-properties.js"));
    utils = require(join(root, "generated", "idl", "utils.js"));
  } catch (e) { return "absent"; }
  const P = Doc && Doc.prototype;
  if (!P || P.__saltFast || typeof P._clearNamedPropertyCache !== "function" || typeof props.elementAttached !== "function"
    || typeof props.elementDetached !== "function" || typeof P[utils.supportsPropertyName] !== "function"
    || typeof P[utils.namedGet] !== "function") return "absent";

  const clear = P._clearNamedPropertyCache, check = process.env.SALT_JSDOM_CHECK === "1", stale = new WeakSet();
  P._clearNamedPropertyCache = function () { if (check) stale.add(this); /* else deferred to the hooks below, which know what entered or left */ };
  const named = (el) => NAMED.has(el._localName);
  const attached = props.elementAttached, detached = props.elementDetached;
  props.elementAttached = (el) => { if (named(el) && el._ownerDocument) clear.call(el._ownerDocument); return attached(el); };
  props.elementDetached = (el) => { if (named(el) && el._ownerDocument) clear.call(el._ownerDocument); return detached(el); };

  /* THE CHECK compares where stock jsdom would have rebuilt, after an insertion or removal, and nowhere else: between those both
     answer from the map jsdom built last, so a comparison there cannot differ, and the check costs what stock jsdom costs.
     Each process writes how many comparisons it made, so a run that compared nothing says so. */
  if (check) {
    const has = P[utils.supportsPropertyName], get = P[utils.namedGet];
    let compared = 0;
    const note = (line) => { if (process.env.SALT_JSDOM_CHECK_LOG) appendFileSync(process.env.SALT_JSDOM_CHECK_LOG, line + "\n"); };
    process.on("exit", () => note("compared " + compared));
    /* a page may catch the throw, so each difference is also written down where a run reads it after */
    const differ = (why) => { note(why); throw new Error(why); };
    const both = (doc, read, same) => {
      if (!stale.has(doc)) return read();
      const kept = read();
      stale.delete(doc); clear.call(doc); compared++;
      const now = read();
      same(kept, now);
      return now;
    };
    P[utils.supportsPropertyName] = function (name) {
      return both(this, () => has.call(this, name), (kept, now) => {
        if (kept !== now) differ(`jsdom-fast: document named property "${name}" kept ${kept}, rebuilt ${now}`);
      });
    };
    /* a name two elements share answers one collection kept per name, so the same object either way */
    P[utils.namedGet] = function (name) {
      return both(this, () => get.call(this, name), (kept, now) => {
        if (kept !== now) differ(`jsdom-fast: document named property "${name}" kept and rebuilt values differ`);
      });
    };
    const names = Object.getOwnPropertyDescriptor(P, utils.supportedPropertyNames);
    if (names && names.get) Object.defineProperty(P, utils.supportedPropertyNames, { configurable: true, get() {
      return both(this, () => [...names.get.call(this)], (kept, now) => {
        if (kept.join("\n") !== now.join("\n")) differ("jsdom-fast: the document's named property list kept and rebuilt differ");
      }).values();
    } });
  }
  Object.defineProperty(P, "__saltFast", { value: true });
  return check ? "check" : "fast";
}
