/* Counter Maker: a reward spend books. REWARD reaches the mirror through the seed; Counter Admin's Redeem, through the verified
   owner and the private capability, builds the entry the Desk's own redeemRebate queues on the same book (an offset against the
   oldest advance, else a free unit), the drafter drafts it pending with a row, the fold writes that row onto the book, and with no
   reward scheme in the mirror the spend is refused and nothing is queued. Then Accept tier proposals, driven in the actual owner
   script: one request id kept across a failure, a fresh one after it lands, and a refusal with nothing to accept let go. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { JSDOM } from "jsdom";
import desk from "../src/worker.js";
import { handleMaker } from "../stmt/maker.js";
import { landingPage } from "../stmt/page.js";
import { readBook } from "../tools/book.mjs";
import { buildSeed } from "../tools/d1.mjs";
import { apply } from "../tools/fold.mjs";

class Store {
  values = new Map();
  async get(key, type) { const v = this.values.get(key) ?? null; return v === null || type !== "json" ? v : JSON.parse(v); }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = "" } = {}) {
    return { keys: [...this.values.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

const row = (rid, customer, date, qty, total, more = {}) => ({ rid, customer, date, qty, total, cost: 48, cash: total, paidOn: date,
  handover: "collected", delivery: 0, deliveredOn: date, deliveredQty: qty, ...more });
const unpaid = { cash: 0, paidOn: undefined };
/* CM4-TO, an associate, earns and owes on tx2 (the older advance); CS6-PER, an associate, earns and owes nothing; CK4-SEN, a
   customer, earns whole units and owes nothing */
const SCENARIO = [
  row("rs1", "CM4-TO", "2026-08-20", 20, 3000),
  row("rs2", "CM4-TO", "2026-09-01", 2, 220, unpaid),
  row("rs3", "CM4-TO", "2026-09-20", 1, 110, unpaid),
  row("rs4", "CS6-PER", "2026-08-20", 20, 3000),
  row("rs5", "CK4-SEN", "2026-08-21", 20, 3000)
].map((r) => JSON.parse(JSON.stringify(r)));
const REPO = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

export async function run({ ok }) {
  const source = await readBook();
  const { w, version } = source;
  const ledger = JSON.parse(JSON.stringify(source.ledger));
  try {
    w.eval(`(function(){var rows=${JSON.stringify(SCENARIO)};rows.forEach(function(r){sales.push(JSON.parse(JSON.stringify(r)));
      BASE_SALES.push(JSON.parse(JSON.stringify(r)));});recompute();})()`);
    const today = w.eval("TODAY.toISOString().slice(0,10)");
    /* what the Desk's own Redeem queues for a party on this book */
    const deskRedeem = (code) => JSON.parse(w.eval(`(function(){queue=[];saveQueue=function(){};switchTab=function(){};
      qPost=function(){return Promise.resolve(false);};redeemRebate(${JSON.stringify(code)});return JSON.stringify(queue[0]||null);})()`));

    /* the road: the seeded mirror, the verified owner, the bridge, the drafter */
    const migrations = new URL("../migrations/", import.meta.url), db = new DatabaseSync(":memory:");
    for (const f of readdirSync(migrations).filter((x) => /^\d+_.*\.sql$/.test(x)).sort())
      db.exec(readFileSync(new URL(f, migrations), "utf8"));
    const live = JSON.parse(JSON.stringify(ledger)); live.sales = live.sales.concat(JSON.parse(JSON.stringify(SCENARIO)));
    db.exec(buildSeed({ v: version, stamped: ledger.stamped || null, ledger: live }).sql);
    const seeded = db.prepare("SELECT doc FROM state WHERE key='REWARD'").get();
    ok(!!seeded && JSON.stringify(JSON.parse(seeded.doc)) === JSON.stringify(ledger.REWARD) && ledger.REWARD.stated.salt.margin > 0,
      "the seed carries the master's reward scheme into the mirror byte for byte: " + (seeded ? seeded.doc : "none"));
    const D1 = { batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try { const out = statements.map((s) => s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; }
    }, prepare(sql) {
      const st = db.prepare(sql);
      const mk = (a) => ({ run() { return { meta: { changes: Number(st.run(...a).changes || 0) } }; },
        first() { const r = st.get(...a); return r === undefined ? null : r; }, all() { return { results: st.all(...a) }; } });
      const self = mk([]); self.bind = (...a) => mk(a); return self;
    } };
    const makerKey = "maker-reward-local-capability-0123456789";
    const deskEnv = { SALT_QUEUE: new Store(), SALT_LEDGER: D1, COUNTER_MAKER_KEY: makerKey };
    const counterEnv = { STMT: new Store(), COUNTER_MAKER_KEY: makerKey,
      DESK_MAKER: { fetch: (request) => desk.fetch(request, deskEnv, { waitUntil() {} }) } };
    const call = (path, body, identity = { email: "maakmal97@icloud.com" }) => handleMaker(new Request("https://counter.test" + path,
      { method: "POST", body: JSON.stringify(body) }), counterEnv, path, identity);
    const drafts = () => db.prepare("SELECT id,status,entry,row FROM draft ORDER BY id").all();
    const draftOf = (at) => drafts().find((d) => d.id === at) || null;

    const book = JSON.parse(readFileSync(join(REPO, "ledger", "book.json"), "utf8"));
    book.sales.push(...JSON.parse(JSON.stringify(SCENARIO)));
    book.QUEUE_COMMITTED = "2026-01-01T00:00:00.000Z";
    const master = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
    const cases = [
      { code: "CM4-TO", at: "2026-10-06T01:00:00.000Z", what: "an associate holding an advance: the oldest advance is offset",
        expect: (e) => e.payload.mode === "amend" && e.payload.kind === "Correction" && e.payload.rid === "rs2" },
      { code: "CS6-PER", at: "2026-10-06T01:01:00.000Z", what: "an associate owing nothing: every held unit is redeemed",
        expect: (e) => e.payload.mode === "redeem" && e.payload.qty > 1 },
      { code: "CK4-SEN", at: "2026-10-06T01:02:00.000Z", what: "a customer owing nothing: one whole unit is redeemed",
        expect: (e) => e.payload.mode === "redeem" && e.payload.qty === 1 }
    ];
    for (const c of cases) {
      const res = await call("/all/maker/inputs/redeem", { at: c.at, code: c.code, date: today });
      const body = await res.json();
      const d = draftOf(c.at), mine = d && JSON.parse(d.entry);
      const drafted = d && d.row && JSON.parse(d.row);
      const amends = mine && mine.payload.mode === "amend" ? "rs2" : null;
      ok(!!(d && d.status === "pending" && drafted && (amends || drafted.customer === c.code)),
        "and the drafter drafts it pending with its row, never refused: " + JSON.stringify(d && { status: d.status, row: drafted }));
      /* the fold writes the drafted row onto the book */
      const staged = { ok: true, count: 1, approved: [{ id: c.at, collection: "sales", amends, amendKind: amends ? "Correction" : null,
        row: drafted, entry: mine }] };
      const B = JSON.parse(JSON.stringify(book)), before = B.sales.length;
      const folded = drafted ? apply(B, staged, { version: "v9999", date: "06 Oct 2026", title: "A TEST REWARD SPEND",
        notes: ["<b>TEST.</b> Nothing real."], rows: { [c.at]: { note: "A reward spend." } }, stockNote: "" }, master) : { ok: false, problems: ["no row"] };
      const target = amends ? B.sales.find((s) => s.rid === "rs2") : B.sales[B.sales.length - 1];
      ok(folded.ok && (amends ? B.sales.length === before && target && +target.settledRM > 0 && +target.rebateKg > 0
        : B.sales.length === before + 1 && target.customer === c.code && target.rebate === true && target.cash === 0 && target.qty === mine.payload.qty),
        "and the fold books it: " + (folded.ok ? JSON.stringify(target) : folded.problems.join("; ")));
    }

    /* once spent and waiting, the same reward is not spent again; a retry of the same request is answered from its receipt */
    const count = drafts().length;
    const retry = await call("/all/maker/inputs/redeem", { at: cases[1].at, code: "CS6-PER", date: today });
    const twice = await call("/all/maker/inputs/redeem", { at: "2026-10-06T01:10:00.000Z", code: "CS6-PER", date: today });
    const twiceBody = await twice.json();
    ok(retry.status === 200 && twice.status >= 400 && /already spent or reserved by another input/.test(twiceBody.error || "") && drafts().length === count,
      "a retry under the same request id queues nothing more, and a second spend while the first waits is refused as reserved: "
      + retry.status + " " + twice.status + " " + JSON.stringify(twiceBody));
    ok((await call("/all/maker/inputs/redeem", { at: "2026-10-06T01:11:00.000Z", code: "CK4-SEN", date: today },
      { email: "other@example.test" })).status === 403 && drafts().length === count, "another identity cannot spend a reward");

    /* with no reward scheme in the mirror, a spend is refused and nothing is queued */
    db.prepare("DELETE FROM state WHERE key='REWARD'").run();
    const none = await call("/all/maker/inputs/redeem", { at: "2026-10-06T01:20:00.000Z", code: "CE4-AD", date: today });
    const noneBody = await none.json();
    ok(none.status >= 400 && /no configured reward/.test(noneBody.error || "") && drafts().length === count,
      "with no REWARD in the mirror the spend is refused as unconfigured and nothing is queued: " + none.status + " " + JSON.stringify(noneBody));
  } finally { w.close(); }

  /* ---- Accept tier proposals in the actual owner script ---- */
  const posts = [];
  const answers = [];
  const catalog = { parties: [], loans: [], rewards: [], correctionFields: [], rows: [], tierCustomers: ["CX1-AB"],
    tierNames: ["Titanium", "Silver"], products: [{ product: "salt", tiered: true }] };
  const browser = new JSDOM(landingPage("", "fixture", { master: "local-master", accounts: [] }), {
    url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(window) {
      Object.defineProperty(window, "crypto", { value: { getRandomValues: (a) => webcrypto.getRandomValues(a), randomUUID: () => webcrypto.randomUUID(), subtle: webcrypto.subtle } });
      window.TextEncoder = TextEncoder; window.TextDecoder = TextDecoder;
      window.scrollTo = () => {}; window.confirm = () => true;
      window.fetch = async (path, init) => {
        const where = String(path);
        if (init && init.method === "POST" && where === "/all/maker/inputs/tier-accept-all") {
          posts.push(JSON.parse(init.body));
          const [status, body] = answers.shift() || [200, { ok: true }];
          return Response.json(body, { status });
        }
        if (where === "/all/maker/review") return Response.json({ ok: true, drafts: [], orders: [] });
        if (where === "/all/maker/claims") return Response.json({ ok: true, claims: [] });
        if (where === "/all/maker/threads") return Response.json({ ok: true, threads: [] });
        if (where === "/all/maker/bulletin") return Response.json({ ok: true, bulletin: { lines: [] } });
        if (where === "/all/maker/inputs") return Response.json({ ok: true, products: ["salt"], catalog });
        if (where === "/all/maker/hours") return Response.json({ ok: true, config: null, status: {} });
        return Response.json({ ok: true, accounts: [] });
      };
    }
  });
  try {
    const window = browser.window, doc = window.document;
    const until = async (predicate) => {
      for (let i = 0; i < 200 && !predicate(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
      return !!predicate();
    };
    const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
    const section = () => [...doc.querySelectorAll("#makerInputs .maker-input")].find((s) => s.querySelector("h3") && s.querySelector("h3").textContent === "Price level");
    const accept = () => section() && [...section().querySelectorAll("button")].find((b) => b.textContent === "Accept every suggestion");
    const retained = () => Object.keys(window.localStorage).filter((k) => k.includes("tier-accept-all"));
    const press = async (n) => { await until(() => accept() && !accept().disabled); accept().click(); await until(() => posts.length >= n); await pause(); };
    doc.querySelector('[data-act="nav.record"]').click();
    await until(() => accept());
    const isAt = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));

    answers.push([503, { ok: false, error: "The Desk did not answer." }]);
    await press(1);
    await press(2);
    ok(posts.length === 2 && isAt(posts[0].at) && Object.keys(posts[0]).join() === "at" && posts[1].at === posts[0].at,
      "Accept tier proposals sends its request id alone, and the retry after a failure keeps it: " + JSON.stringify(posts));
    await press(3);
    ok(isAt(posts[2].at) && posts[2].at !== posts[0].at, "once the proposals have landed, the next Accept is a new request: " + JSON.stringify(posts[2]));

    answers.push([400, { ok: false, error: "There is no tier proposal to accept." }]);
    await press(4);
    await until(() => accept() && !accept().disabled);
    const visibleCancels = [...section().querySelectorAll("button")].filter((b) => b.textContent === "Discard" && !b.hidden);
    ok(retained().length === 0 && visibleCancels.length === 0 && /no tier proposal/.test(section().textContent),
      "a refusal with nothing to accept lets the request go, hides Cancel and says why: " + JSON.stringify({ retained: retained(), cancels: visibleCancels.length }));
    await press(5);
    ok(isAt(posts[4].at) && posts[4].at !== posts[3].at, "and the next Accept after that refusal is a new request: " + JSON.stringify(posts.slice(3)));
  } finally { browser.window.close(); }
}
