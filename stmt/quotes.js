/* stmt/quotes.js: EVERY QUOTE A CUSTOMER IS SHOWN IS RECORDED (salt price band version 2, docs/plan-salt-price-band.html).
 * Today the book keeps only what sold; a quote that did not become an order is the record that turns a cautious estimate into a
 * measured demand curve. It prices nothing and is never shown to a customer. Usernames only, never a name or a roster code.
 *
 * KV `quote:<KL day>:<username>`: a list `[{at, u, sheet, lines: [{b, q, p, placed?}]}]`, the last 30 a day an account, expiring after
 * 120 days. A leaf: it imports nothing, so the Counter keeps no tie to src/ or tools/. */
export const QUOTE_BOOKS = Object.freeze(["salt", "oil", "candy", "rice", "gas"]);
export const QUOTE_LINES = 10, QUOTE_DAY_CAP = 30, QUOTE_TTL = 120 * 86400, QUOTE_DAYS_MAX = 120, QUOTE_DAYS_DEFAULT = 90;
const SHEET_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const klDay = (ms = Date.now()) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
export const quoteKey = (day, u) => "quote:" + day + ":" + u;

/** A quote's body checked: a sheet id, one to ten lines, each a known book, a positive size and a positive price. */
export function checkQuote(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "send JSON" };
  if (typeof body.sheet !== "string" || !SHEET_RE.test(body.sheet)) return { error: "a quote names its sheet" };
  const ls = body.lines;
  if (!Array.isArray(ls) || !ls.length || ls.length > QUOTE_LINES) return { error: "a quote has one to " + QUOTE_LINES + " lines" };
  const lines = [];
  for (const l of ls) {
    if (!l || typeof l !== "object" || !QUOTE_BOOKS.includes(l.b)) return { error: "a line names a book we sell" };
    if (typeof l.q !== "number" || !Number.isFinite(l.q) || l.q <= 0 || l.q > 100000) return { error: "a line's size is a positive number" };
    if (typeof l.p !== "number" || !Number.isFinite(l.p) || l.p <= 0 || l.p > 1e7) return { error: "a line's price is a positive number" };
    lines.push({ b: l.b, q: +l.q.toFixed(4), p: +l.p.toFixed(2) });
  }
  return { sheet: body.sheet, lines };
}
const sig = (lines) => lines.map((l) => l.b + "|" + l.q + "|" + l.p).join(",");
const listOf = async (env, key) => { const l = await env.STMT.get(key, "json").catch(() => null); return Array.isArray(l) ? l : []; };

/** Files one quote under the day and the account; the same sheet with the same lines is filed once. A 31st quote of a day is refused. */
export async function fileQuote(env, u, body, now = Date.now()) {
  const c = checkQuote(body);
  if (c.error) return { error: c.error, status: 400 };
  const key = quoteKey(klDay(now), u), list = await listOf(env, key);
  if (list.some((x) => x.sheet === c.sheet && sig(x.lines) === sig(c.lines))) return { ok: true, again: true };
  if (list.length >= QUOTE_DAY_CAP) return { error: "that is enough quotes for one day", status: 429 };
  list.push({ at: new Date(now).toISOString(), u, sheet: c.sheet, lines: c.lines });
  await env.STMT.put(key, JSON.stringify(list.slice(-QUOTE_DAY_CAP)), { expirationTtl: QUOTE_TTL });
  return { ok: true };
}

/** An order was placed: the matching line of today's quotes is marked placed. The sheet id where the order carries one, else the book
 *  and size; a line already placed is never marked twice. Never throws: a quote is a record, not a step of Place. */
export async function markPlaced(env, u, order, now = Date.now()) {
  try {
    const b = order && order.product, q = order && +order.qty, sheet = order && order.sheet;
    if (!b || !(q > 0)) return false;
    const key = quoteKey(klDay(now), u), list = await listOf(env, key);
    const open = (x) => x.lines.find((l) => l.b === b && l.q === +q.toFixed(4) && !l.placed);
    let hit = sheet ? list.find((x) => x.sheet === sheet && open(x)) : null;
    if (!hit) for (let i = list.length - 1; i >= 0 && !hit; i--) if (open(list[i])) hit = list[i];
    if (!hit) return false;
    open(hit).placed = true;
    await env.STMT.put(key, JSON.stringify(list), { expirationTtl: QUOTE_TTL });
    return true;
  } catch (e) { return false; }
}

/** The days asked for: an integer from 1 to 120, 90 when absent; null for anything else. */
export function daysOf(raw) {
  if (raw == null || raw === "") return QUOTE_DAYS_DEFAULT;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= QUOTE_DAYS_MAX ? n : null;
}

/** The Desk's reading: shown and placed by book and size over the last `days` Kuala Lumpur days, today included. */
export async function quoteSummary(env, days, now = Date.now()) {
  const to = klDay(now), from = klDay(now - (days - 1) * 864e5), books = {};
  let cursor;
  do {
    const r = await env.STMT.list({ prefix: "quote:", cursor });
    for (const k of r.keys) {
      const day = k.name.split(":")[1];
      if (!(day >= from && day <= to)) continue;
      for (const x of await listOf(env, k.name)) for (const l of x.lines || []) {
        const bk = (books[l.b] = books[l.b] || {}), e = (bk[String(l.q)] = bk[String(l.q)] || { shown: 0, placed: 0 });
        e.shown++; if (l.placed) e.placed++;
      }
    }
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return { ok: true, days, from, to, books };
}
