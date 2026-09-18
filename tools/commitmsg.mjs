/* tools/commitmsg.mjs: WHAT -m MEANS, in the one place that can be driven by the suite.
 *
 * A version note runs to paragraphs, and this has now gone wrong twice in a day. First the message
 * was passed as JSON.stringify(message), so v694 to v698 each landed as ONE LINE with backslash-n
 * written out in it; the subject was still readable, so nobody saw it. Then v710 was handed a FILE
 * holding the note, because no shell here passes paragraphs without mangling them, and the tool
 * committed the PATH as the message.
 *
 * So -m takes either. A message is a message; an argument naming a file that exists and has
 * something in it is the note itself, read off disk. It lives here rather than inline in
 * tools/update.mjs because update.mjs runs its whole chain on import and cannot be driven.
 */
import { readFileSync, existsSync } from "node:fs";

/** The message behind -m in argv, or null when there is none. */
export function messageFrom(argv) {
  const i = argv.indexOf("-m");
  if (i < 0) return null;
  const a = argv[i + 1];
  if (!a || a.startsWith("-")) return null;
  try {
    if (existsSync(a)) {
      const t = readFileSync(a, "utf8").trim();
      if (t) return t;
    }
  } catch (e) { /* a directory, or a name that merely looks like a path: it is the message */ }
  return a;
}
