/* test/kvsim.mjs: WORKERS KV WITH LOCATIONS AND A VIRTUAL CLOCK, for the suite (S10 10.2). Lifted from the
 * concurrency study of 24 Sep 2026 (study/concurrency/kvsim.mjs), whose six erasures the suite now replays.
 *
 * The model, each rule the documented behaviour of Workers KV stated as a model, not a measurement:
 *   - One global store holds the truth.
 *   - Each location keeps a read cache: a get() where an entry younger than CACHE_MS (60 s, the default
 *     cacheTtl) is cached returns it, stale or not; otherwise it reads the store and caches what it got,
 *     a miss included.
 *   - A put() or delete() goes to the store AND refreshes the writer's own location, so a location reads
 *     its own writes; other locations keep their copy until it ages out.
 *   - One write a second per key: a second inside WRITE_GAP_MS throws "KV PUT failed: 429 Too Many Requests".
 *   - list() reads the store (kept fresh on purpose; a lagging list would only widen every window).
 * THE CLOCK IS INSTALLED AND TAKEN DOWN BY THE CALLER (clock.install, clock.uninstall), never on import:
 * a suite section replaces Date for its own run and puts it back in a finally.
 */
export const CACHE_MS = 60000;
export const WRITE_GAP_MS = 1000;

const RealDate = Date;
let NOW = RealDate.UTC(2026, 8, 24, 2, 0, 0);   /* 10:00:00 in Kuala Lumpur */
class VDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
export const clock = {
  install: () => { globalThis.Date = VDate; },
  uninstall: () => { globalThis.Date = RealDate; },
  now: () => NOW,
  set: (ms) => { NOW = ms; },
  add: (ms) => { NOW += ms; }
};

export class World {
  constructor() { this.store = new Map(); this.lastWrite = new Map(); this.caches = new Map(); this.rateLimit = true; }
  at(loc) { return new LocKV(this, loc); }
  cache(loc) { if (!this.caches.has(loc)) this.caches.set(loc, new Map()); return this.caches.get(loc); }
  raw(k) { const v = this.store.get(k); return v == null ? null : JSON.parse(v); }
}

class LocKV {
  constructor(w, loc) { this.w = w; this.loc = loc; }
  async get(k, type) {
    const c = this.w.cache(this.loc), e = c.get(k), now = clock.now();
    let v;
    if (e && now - e.t < CACHE_MS) v = e.v;
    else { v = this.w.store.has(k) ? this.w.store.get(k) : null; c.set(k, { v, t: now }); }
    if (v == null) return null;
    return type === "json" ? JSON.parse(v) : v;
  }
  async put(k, v) {
    const now = clock.now(), last = this.w.lastWrite.get(k);
    if (this.w.rateLimit && last != null && now - last < WRITE_GAP_MS) throw new Error("KV PUT failed: 429 Too Many Requests");
    this.w.store.set(k, String(v)); this.w.lastWrite.set(k, now);
    this.w.cache(this.loc).set(k, { v: String(v), t: now });
  }
  async delete(k) {
    const now = clock.now(), last = this.w.lastWrite.get(k);
    if (this.w.rateLimit && last != null && now - last < WRITE_GAP_MS) throw new Error("KV DELETE failed: 429 Too Many Requests");
    this.w.store.delete(k); this.w.lastWrite.set(k, now);
    this.w.cache(this.loc).set(k, { v: null, t: now });
  }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.w.store.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true };
  }
}
