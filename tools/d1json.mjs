/* d1json.mjs: the one reader of `wrangler d1 execute --json`, and it FAILS CLOSED (06 Oct 2026).
 *
 * Each tool sliced the text from the first "[" to the last "]" and read `results || []`. A refusal
 * from wrangler is an object, `{"error":{"text":...,"notes":[{"text":...}]}}`, so the slice found the
 * notes array and every reader answered an empty list: no approved rows to stage, "no draft behind
 * it" at --committed, a store "never seeded". An answer is read here only when the exit is 0, the
 * value is a non-empty array, and every statement in it carries `results` as an array and no
 * `success: false`. Anything else is {error}, in wrangler's words where it gave any.
 */

/* the first complete JSON value in the text, balanced so a warning line around it cannot be swallowed */
export function firstJson(text) {
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "[" && s[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === "\"") inStr = false; continue; }
      if (c === "\"") inStr = true;
      else if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") {
        if (--depth === 0) {
          try { return { value: JSON.parse(s.slice(i, j + 1)) }; } catch (e) { break; }
        }
      }
    }
  }
  return null;
}

const errorText = (v) => {
  const e = v && typeof v === "object" && !Array.isArray(v) ? v.error : null;
  if (!e) return "";
  const notes = Array.isArray(e.notes) ? e.notes.map((n) => n && n.text).filter(Boolean) : [];
  return [typeof e === "string" ? e : e.text, ...notes].filter(Boolean).join(" ");
};

/* {code, out} in; {sets} (wrangler's statement array) or {error} out */
export function d1Result({ code, out }) {
  const found = firstJson(out);
  const value = found && found.value;
  const said = errorText(value);
  const head = String(out || "").trim().split("\n").slice(0, 3).join(" ").slice(0, 160);
  if (code !== 0) return { error: "wrangler exited " + code + ": " + (said || head || "no output") };
  if (said) return { error: "D1 refused: " + said };
  if (!Array.isArray(value) || !value.length) return { error: "D1's answer could not be read: " + (head || "no output") };
  for (const set of value) {
    if (!set || typeof set !== "object" || set.success === false || !Array.isArray(set.results))
      return { error: "D1's answer carried a statement with no results: " + JSON.stringify(set).slice(0, 120) };
  }
  return { sets: value };
}

/* every row of every statement, or {error} */
export function d1Rows(r) {
  const res = d1Result(r);
  return res.error ? res : { rows: res.sets.flatMap((s) => s.results) };
}
