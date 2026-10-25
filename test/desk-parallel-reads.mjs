/* test/desk-parallel-reads.mjs: THE DESK'S SPEED FOLD (16 Oct 2026, his word: the Desk and Counter were once quick on a phone).
 *
 * Measured on the live Desk from his Chrome: GET /orders took 2.0 s on load and 0.4 to 0.8 s after, GET /drafts 0.34 s for an
 * empty answer, because each asked the statements site or the store one question after another. The reads are independent, so
 * they are asked together; what each returns is unchanged. What is proved here, each check red under its own mutation
 * (test/desk-parallel-reads.mutations.json), with invented codes only (rule 2):
 *   A  GET /orders asks the site for orders, claims and threads together (3 in flight), the rejected-row scan and the live yes
 *      together, and each order's drafts together in both walks (againOf and dropMode); the answer is what it was
 *   B  a claims read the site cannot answer still leaves the orders, with claimsUnread said
 *   C  GET /drafts asks the rows, the live yes, the refused list and the clock together (4 in flight), and with a pending sale
 *      asks the approved amendments while the book is read; each read that
 *      fails alone leaves the drafts answered
 * readBook itself is left as it was: state, then snapshot, then the collections, an order the suite pins because a seed deletes
 * the snapshot first and writes it last. */
import desk from "../src/worker.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;

/* a store of rows that answers each question after a pause and counts how many are open at once */
function fakeDb(opts = {}) {
  const live = { n: 0, max: 0 }, calls = { do: new Map() }, grp = { do1: 0, do1max: 0, do2: 0, do2max: 0, rej: 0, yes: 0, wr: 0, bk: 0, both: false, wrbk: false };
  const open = async (g, run) => {
    live.n++; live.max = Math.max(live.max, live.n);
    if (g) { grp[g]++; if (g === "do1" || g === "do2") grp[g + "max"] = Math.max(grp[g + "max"], grp[g]); }
    if (grp.rej && grp.yes) grp.both = true;
    if (grp.wr && grp.bk) grp.wrbk = true;
    try { await wait(25); return run(); } finally { live.n--; if (g) grp[g]--; }
  };
  const draftsOf = (id) => ({ results: id === "o1"
    ? [{ id: "d1", status: "rejected", decided_by: "desk", entry: J({ orderId: "o1", status: "Handover" }) }]
    : id === "o2" ? [{ id: "d2", status: "rejected", decided_by: "desk", entry: J({ orderId: "o2", status: "Pending" }) }] : [] });
  return {
    live, grp,
    prepare(sql) {
      let args = [];
      const q = {
        bind(...a) { args = a; return q; },
        all() {
          if (/FROM refused/.test(sql)) return opts.refusedFails ? Promise.reject(new Error("no such table")) : open(null, () => ({ results: [] }));
          if (/FROM preapproval WHERE status='differs'/.test(sql)) return opts.yesFails ? Promise.reject(new Error("no such table")) : open(null, () => ({ results: [] }));
          if (/FROM preapproval WHERE stage='ack'/.test(sql)) return open("yes", () => ({ results: [] }));
          if (/status='rejected' AND entry LIKE/.test(sql)) return open("rej", () => ({ results: [{ entry: J({ orderId: "o1" }) }, { entry: J({ orderId: "o2" }) }] }));
          if (/FROM draft WHERE entry LIKE/.test(sql)) {
            const id = /"orderId":"([^"]+)"/.exec(String(args[0]))[1], k = (calls.do.get(id) || 0) + 1;
            calls.do.set(id, k);
            return open(k === 1 ? "do1" : "do2", () => draftsOf(id));
          }
          if (/status='approved' AND committed_at IS NULL/.test(sql)) return open("wr", () => ({ results: [] }));
          if (/FROM draft/.test(sql)) return open(null, () => ({ results: opts.sale ? [{ id: "2026-10-16T01:00:00.000Z", status: "pending", collection: "sales", entry: "{}", row: "{}", flags: "[]" }] : [] }));
          return open(/FROM state|FROM entry/.test(sql) ? "bk" : null, () => ({ results: [] }));   /* the book's own reads */
        },
        first() {
          if (/FROM draft WHERE committed_at IS NOT NULL/.test(sql)) return open(null, () => ({ id: "d0", party: "CX9-ZED", decided_at: "a", live_at: "b", committed_at: "c" }));
          return open(/FROM snapshot/.test(sql) ? "bk" : null, () => null);
        }
      };
      return q;
    }
  };
}
const fakeSite = (opts = {}) => {
  const live = { n: 0, max: 0 };
  return { live, fetch: async (url) => {
    live.n++; live.max = Math.max(live.max, live.n);
    try {
      await wait(25);
      const path = new URL(url).pathname;
      const body = path === "/desk/orders" ? { ok: true, orders: [{ id: "o1", u: "abcd-efgh" }, { id: "o2", u: "abcd-efgh" }], links: 0 }
        : path === "/desk/claims" ? { ok: true, claims: [] } : { ok: true, threads: [] };
      if (path === "/desk/claims" && opts.claimsFail) return new Response(J({ ok: false, error: "no" }), { status: 500 });
      return new Response(J(body), { status: 200 });
    } finally { live.n--; }
  } };
};
const queue = { async get(key, type) { return key === "stmt-users" ? (type === "json" ? { "abcd-efgh": "CX9-ZED" } : J({ "abcd-efgh": "CX9-ZED" })) : null; }, async put() {}, async delete() {} };
const envOf = (db, site) => ({ SALT_QUEUE: queue, SALT_LEDGER: db, STMT_SITE: site, STMT_DESK_KEY: "k" });
/* a route that throws is a 500 here, as the platform would answer it, so a read that no longer fails alone is a failed check, not a crashed run */
const get = async (env, path) => {
  try { const r = await desk.fetch(new Request("https://desk" + path), env); return { status: r.status, j: await r.json() }; }
  catch (e) { return { status: 500, j: { error: String((e && e.message) || e) } }; }
};

export async function run({ ok }) {
  /* A. orders */
  const db = fakeDb(), site = fakeSite();
  const o = await get(envOf(db, site), "/orders");
  const by = (id) => (o.j.orders || []).find((x) => x.id === id) || {};
  ok(site.live.max === 3, "GET /orders asks the site for orders, claims and threads together: " + site.live.max + " in flight");
  ok(db.grp.both, "and the rejected-row scan and the live yes together, neither waiting on the other");
  ok(db.grp.do1max === 2, "and each order's drafts together when the stages to offer again are read: " + db.grp.do1max + " in flight");
  ok(db.grp.do2max === 2, "and together again when each is asked whether Not needed covers the whole order: " + db.grp.do2max + " in flight");
  ok(o.status === 200 && o.j.ok === true && by("o1").code === "CX9-ZED" && J(by("o1").again) === '["move"]' && J(by("o2").again) === '["ack"]'
    && !by("o1").againWhole && by("o2").againWhole === true && J(o.j.claims) === "[]" && J(o.j.threads) === "[]",
    "the answer is what it was: each order's codes, what it offers again and whether Not needed covers it whole: " + J(o.j).slice(0, 300));

  /* B. a claims read that fails alone */
  const b = await get(envOf(fakeDb(), fakeSite({ claimsFail: true })), "/orders");
  ok(b.status === 200 && (b.j.orders || []).length === 2 && J(b.j.claims) === "[]" && !!b.j.claimsUnread && !b.j.threadsUnread,
    "a claims read the site cannot answer leaves the orders, no claims and claimsUnread said: " + J([b.status, (b.j.orders || []).length, b.j.claims, b.j.claimsUnread]));

  /* C. drafts */
  const dd = fakeDb();
  const d = await get(envOf(dd), "/drafts");
  ok(dd.live.max === 4, "GET /drafts asks the rows, the live yes, the refused list and the clock together: " + dd.live.max + " in flight");
  ok(d.status === 200 && d.j.count === 0 && J(d.j.refused) === "[]" && d.j.refusedCount === 0 && !!d.j.clock && d.j.clock.id === "d0"
    && d.j.clock.committedAt === "c" && d.j.clock.liveAt === "b", "and answers as it did: " + J(d.j));
  const ds = fakeDb({ sale: true });
  const s = await get(envOf(ds), "/drafts");
  ok(s.status === 200 && s.j.count === 1 && !ds.grp.wrbk,
    "with a pending sale it reads the book first and the approved amendments after it, by that book's own bound (S3, 25 Oct 2026): " + J([s.status, s.j.count, ds.grp.wrbk]));
  const fl = await get(envOf(fakeDb({ refusedFails: true, yesFails: true })), "/drafts");
  ok(fl.status === 200 && fl.j.count === 0 && J(fl.j.refused) === "[]" && !!fl.j.clock,
    "a store lacking the refused list and the live yes still answers the drafts and the clock: " + J(fl.j));
  const nf = fakeDb();
  const na = await get(envOf(nf), "/drafts?status=approved");
  ok(na.status === 200 && nf.live.max === 2 && J(na.j.refused) === "[]" && na.j.clock === null,
    "an approved view asks the rows and the live yes only, and carries no refused list or clock: " + J([nf.live.max, na.j.refused, na.j.clock]));
}
