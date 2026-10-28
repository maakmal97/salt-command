/* test/book-page.mjs: S5d OF THE BOOK PLAN, THE DESK PAGE READS THE BOOK AT REQUEST TIME (28 Oct 2026). Dormant: the D1 flag book_page ships off. Each check red under its own mutation
 * (test/book-page.mutations.json):
 *   1  the flag and the shape: pageMode reads on only when D1 says on; servedBook is the book as ledger/book.json holds it (no NOTES, no derived document) with the version, the revision and the booked ids
 *   2  GET /book/page: keyed, read only, 404 with the flag off, the Book's view with the open entries replayed and their draft ids named, never cached, the revision read before the view
 *   3  GET /rev: the build manifest alone with the flag off (or no Book, or a manifest that is not JSON), and the Book's revision beside it with the flag on
 *   4  the page: bookApply takes a whole served book in place (every list, document, the two primitives, the overlay's own base copies, the product list) and refuses one that is not whole, or older than the page
 *      was built with, changing nothing; a queued entry the served view holds is skipped by the overlay and stays in the queue; the page's table is the book's keys
 *   5  bookFetch: needs the write key, asks /book/page keyed and uncached, sets the revision it read, and after a failure waits a minute; the poll in the cloud script asks for it when the revision moves;
 *      sw.js never caches /book */
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { objectState } from "./orderbook-harness.mjs";
import { frozenBook } from "./frozen.mjs";
import { Book, canon } from "../src/book.js";
import { openMaster } from "../tools/payload.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V = "v1252", AT_STAMP = "28 Oct 2026, 10:00 KL";
const IDN = (n) => "2031-01-02T0" + n + ":00:00.000Z";

export async function run({ ok }) {
  const worker = (await import("../src/worker.js")).default;
  const { pageMode, servedBook } = await import("../src/book-page.js");
  const fb = () => { const b = frozenBook(); b.roster.push("ZZ1-AAA", "ZZ2-BBB"); b.STATED_STOCK = 10; return b; };
  const derived = { OPEN: { v: V, at: "2026-10-28T01:00:00.000Z", count: 0, byKey: {} }, TERMS: { creditDays: 7 }, REWARD: { stated: {} }, STOCK: { today: "2026-10-28", books: {} } };
  const pricing = { v: V, floors: { salt: { 1: 60 } }, sizes: [0.5, 1] };
  const sale = (id, qty) => ({ id, status: "approved", collection: "sales", row: { customer: "ZZ1-AAA", date: "2031-01-02", qty, total: qty * 100, cash: qty * 100, deliveredQty: qty, product: "salt" } });

  /* 1: the flag and the shape */
  const fake = (row) => ({ prepare: () => ({ first: async () => row }) });
  ok(await pageMode(fake({ mode: "on" })) === "on" && await pageMode(fake({ mode: "off" })) === "off" && await pageMode(fake(null)) === "off" && await pageMode({ prepare: () => { throw new Error("no table"); } }) === "off", "the flag reads on only when D1 says on; a missing table, an empty row or an error read off");
  const mig = readFileSync(join(REPO, "migrations", "0022_book_page.sql"), "utf8");
  ok(/CREATE TABLE IF NOT EXISTS book_page/.test(mig) && /VALUES \(1, 'off'\)/.test(mig) && !/DROP|DELETE|ALTER/i.test(mig.replace(/--[^\n]*/g, "")), "migration 0022 creates the one-row flag shipped off and touches nothing else");
  const os = objectState(), book = new Book(os, {}); let t = 0;
  book.clock = () => "2026-10-28T10:00:" + String(10 + t++).padStart(2, "0") + ".000Z";
  const order = [];
  const ns = { idFromName: (n) => n, get: () => ({ fetch: (r) => { order.push(new URL(r.url).pathname); return book.fetch(r); } }) };
  await book.fetch(new Request("https://book/load", { method: "POST", body: JSON.stringify({ rev: "r", book: fb(), pricing, derived, v: V, stamped: AT_STAMP }) }));
  const tapped = await (await book.fetch(new Request("https://book/tap", { method: "POST", body: JSON.stringify({ items: [sale(IDN(1), 2)], day: "2031-01-02", v: V }) }))).json();
  const view = await (await book.fetch(new Request("https://book/read"))).json();
  const sv = servedBook(view, 7);
  ok(tapped.ok && sv.ok && sv.v === V && sv.rev === 7 && sv.booked.join() === IDN(1) && !("NOTES" in sv.book) && !("OPEN" in sv.book) && !("PRICING" in sv.book) && sv.book.sales.length === fb().sales.length + 1 && Array.isArray(sv.book.roster) && sv.book.STATED_STOCK === 8,
    "the served book is the view as ledger/book.json holds it, with the version, the revision and the booked ids, and no NOTES or derived document: " + JSON.stringify([tapped.ok, sv && sv.ok, sv && sv.v, sv && sv.rev, sv && sv.booked, sv && sv.book.sales.length, fb().sales.length, sv && sv.book.STATED_STOCK]));
  ok(servedBook(null, 1) === null && servedBook({ ok: true }, 1) === null && servedBook(view, undefined).rev === null && servedBook(view, 1.5).rev === null, "a Book that holds nothing serves nothing, and a revision that is not a whole number is none");
  const base = servedBook(await (await book.fetch(new Request("https://book/read?base=1"))).json(), 7);
  ok(base.booked.length === 0 && base.book.sales.length === fb().sales.length, "with no entry open the served book is the base and names no draft");

  /* 2: the route */
  const state = { mode: "on" };
  const db = { prepare: (s) => ({ first: async () => (/book_page/.test(s) ? { mode: state.mode } : null) }) };
  const env = (extra = {}) => ({ REQUIRE_ACCESS: "0", SALT_WRITE_KEY: "wk", SALT_LEDGER: db, BOOK: ns, ASSETS: { fetch: async () => new Response(JSON.stringify({ ok: true, v: "v1252", id: "0123456789abcdef", built: "x" }), { status: 200 }) }, ...extra });
  const get = async (path, headers, e, method = "GET") => { const r = await worker.fetch(new Request("https://salt.test" + path, { method, headers }), e, { waitUntil() { } }); const text = await r.text(); return { status: r.status, cache: r.headers.get("cache-control"), text, body: (() => { try { return JSON.parse(text); } catch (x) { return null; } })() }; };
  const key = { "X-Salt-Key": "wk" };
  order.length = 0;
  const g1 = await get("/book/page", key, env());
  ok(g1.status === 200 && g1.body.ok && g1.body.booked.join() === IDN(1) && Number.isInteger(g1.body.rev) && g1.body.book.sales.length === fb().sales.length + 1 && !("NOTES" in g1.body.book) && /no-store/.test(g1.cache || ""), "with the flag on it answers the Book's view, the booked ids and the revision, never cached: " + g1.text.slice(0, 120));
  ok(order.indexOf("/revno") >= 0 && order.indexOf("/revno") < order.indexOf("/read") && !order.includes("/at"), "the revision is read (by its own cheap verb, no view built) before the view, so a move between the two reads can only make the page fetch again, never miss: " + order.join());
  state.mode = "off";
  const g2 = await get("/book/page", key, env());
  ok(g2.status === 404 && g2.body.off === true && !/sales/.test(g2.text), "with the flag off it answers 404 and no book");
  state.mode = "on";
  ok((await get("/book/page", {}, env())).status === 401 && (await get("/book/page", { "X-Salt-Key": "wrong" }, env())).status === 401, "no key, or the wrong one, is refused: the view carries cost and margin");
  ok((await get("/book/page", key, env(), "POST")).status === 405 && (await get("/book/page", key, env({ BOOK: undefined }))).status === 503, "it is read only (a POST is 405) and a Worker with no Book bound is 503");
  const empty = new Book(objectState(), {});
  ok((await get("/book/page", key, env({ BOOK: { idFromName: (n) => n, get: () => ({ fetch: (r) => empty.fetch(r) }) } }))).status === 503, "a Book that holds nothing yet is 503, never an empty book the page would swap in");

  /* 3: /rev */
  order.length = 0;
  const r1 = await get("/rev", {}, env());
  const revOrder = order.slice();
  ok(revOrder.join() === "/revno", "/rev asks the Book for its revision by the cheap verb alone, never the view: " + revOrder.join());
  ok(r1.status === 200 && r1.body.id === "0123456789abcdef" && r1.body.v === "v1252" && Number.isInteger(r1.body.rev) && /no-store/.test(r1.cache || ""), "with the flag on /rev answers the build manifest and the Book's revision, still never cached: " + r1.text);
  state.mode = "off";
  const r2 = await get("/rev", {}, env());
  ok(r2.status === 200 && r2.body.id === "0123456789abcdef" && !("rev" in r2.body), "with the flag off /rev is the build manifest alone");
  state.mode = "on";
  const r3 = await get("/rev", {}, env({ BOOK: undefined }));
  ok(r3.status === 200 && r3.body.id === "0123456789abcdef" && !("rev" in r3.body), "with no Book bound, or one that does not answer, /rev is still the manifest and never an error");
  const r3b = await get("/rev", {}, env({ BOOK: { idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error("down"); } }) } }));
  ok(r3b.status === 200 && r3b.body.id === "0123456789abcdef" && !("rev" in r3b.body), "a Book that throws is no reason for /rev to fail: the manifest alone");
  const t0 = Date.now();
  const hung = await get("/rev", {}, env({ BOOK: { idFromName: (n) => n, get: () => ({ fetch: () => new Promise((done) => setTimeout(() => done(Response.json({ ok: true, rev: 3 })), 6000)) }) } }));
  ok(hung.status === 200 && hung.body.id === "0123456789abcdef" && !("rev" in hung.body) && Date.now() - t0 < 4000, "a Book that does not answer holds the build poll for a moment only, then /rev answers the manifest alone: " + (Date.now() - t0) + " ms");
  const rn = await (await book.fetch(new Request("https://book/revno"))).json(), rnEmpty = await new Book(objectState(), {}).fetch(new Request("https://book/revno"));
  ok(rn.ok && Number.isInteger(rn.rev) && rn.rev >= 1 && Object.keys(rn).sort().join() === "ok,rev" && rnEmpty.status === 503, "the Book's revision verb answers the revision alone, and 503 while it holds nothing");
  const r4 = await get("/rev", {}, env({ ASSETS: { fetch: async () => new Response("not json", { status: 200 }) } }));
  ok(r4.status === 200 && r4.text === "not json", "a manifest that is not JSON is passed through untouched");
  const r5 = await get("/rev", {}, env({ SALT_LEDGER: undefined }));
  ok(r5.status === 200 && !("rev" in r5.body), "and with no ledger binding there is no flag to read, so no revision");

  /* 4: the page */
  const { w } = await openMaster();
  try {
    const evalJ = (code) => JSON.parse(w.eval("JSON.stringify(" + code + ")"));
    const blockKeys = (() => { const src = readFileSync(join(REPO, "master", "salt_command.html"), "utf8"), a = src.indexOf("/* ==== BOOK:"), z = src.indexOf("/* ==== END BOOK ==== */"); return [...src.slice(a, z).matchAll(/^const ([A-Za-z_]+)=/gm)].map((m) => m[1]).filter((k) => k !== "NOTES").sort(); })();
    const tableKeys = [...evalJ("Object.keys(BOOK_LISTS)"), ...evalJ("Object.keys(BOOK_DOCS)"), "STATED_STOCK", "QUEUE_COMMITTED"].sort();
    ok(blockKeys.length >= 25 && canon(blockKeys) === canon(tableKeys), "the page's table of lists and documents is the baked book's own keys less NOTES, so a new key cannot be forgotten: " + JSON.stringify(blockKeys.filter((k) => !tableKeys.includes(k)).concat(tableKeys.filter((k) => !blockKeys.includes(k)))));
    const mine = () => {
      const b = {}; for (const k of evalJ("Object.keys(BOOK_LISTS)")) b[k] = evalJ(k);
      for (const k of evalJ("Object.keys(BOOK_DOCS)")) b[k] = evalJ(k);
      b.STATED_STOCK = w.eval("STATED_STOCK"); b.QUEUE_COMMITTED = w.eval("QUEUE_COMMITTED");
      return b;
    };
    const baked = mine(), nSales = w.eval("sales.length"), nBase = w.eval("BASE_SALES.length"), stock0 = w.eval("snapCtx().B.statedStock");
    const served = JSON.parse(JSON.stringify(baked));
    served.sales.push({ ...served.sales[served.sales.length - 1], rid: "s9999", note: "served" });
    served.roster.push("ZZ9-NEW"); served.STATED_STOCK = baked.STATED_STOCK + 1; served.QUEUE_COMMITTED = baked.QUEUE_COMMITTED + "x";
    served.PRICE_SET.zzprobe = { prices: {}, hide: [] };
    served.PRODUCTS.zzp = { ...JSON.parse(JSON.stringify(Object.values(served.PRODUCTS)[0])), name: "ZZ probe", retired: false };
    const why = w.eval("(j=>bookApply(j))").call(w, JSON.parse(JSON.stringify({ ok: true, v: "v9999", rev: 3, booked: ["abc"], book: served })));
    w.eval("applyOverlay()");
    ok(why === null && w.eval("sales.length") === nSales + 1 && w.eval("BASE_SALES.length") === nBase + 1 && w.eval("sales.some(s=>s.rid==='s9999')") && w.eval("roster.includes('ZZ9-NEW')") && w.eval("snapCtx().B.statedStock") === stock0 + 1 && w.eval("BOOK_MARK") === served.QUEUE_COMMITTED && w.eval("PRICE_SET.zzprobe!==undefined"),
      "a whole served book is taken in place: the sale, the roster, the stock, the mark and the board are the served ones, and the overlay's own base copy holds the sale: " + JSON.stringify({ why, sales: w.eval("sales.length"), stock: w.eval("snapCtx().B.statedStock") }));
    ok(w.eval("PROD_IDS.includes('zzp')") && w.eval("PROD_IDS.every(p=>!!PRODUCTS[p])") && w.eval("BOOKED_IDS.has('abc')"), "the product list is rebuilt from the served products, and the drafts the view holds are kept");
    /* a refusal changes nothing */
    const snapshot = () => w.eval("JSON.stringify([sales.length,roster.length,BASE_SALES.length,BOOK_STATED,BOOK_MARK,Object.keys(PRICE_SET).length])");
    const before = snapshot();
    const lacking = JSON.parse(JSON.stringify(served)); delete lacking.sales;
    const stale = JSON.parse(JSON.stringify(served)); stale.QUEUE_COMMITTED = "2000-01-01T00:00:00.000Z"; stale.roster.push("ZZ8-OLD");
    const badStock = JSON.parse(JSON.stringify(served)); badStock.STATED_STOCK = "9"; badStock.roster.push("ZZ7-BAD");
    const badDoc = JSON.parse(JSON.stringify(served)); badDoc.QUOTES = []; badDoc.roster.push("ZZ6-DOC");
    const refused = [["not ok", { ok: false, book: served }], ["no book", { ok: true }], ["a list missing", { ok: true, book: lacking }], ["older than the page", { ok: true, book: stale }], ["a stock that is not a number", { ok: true, book: badStock }], ["a document that is a list", { ok: true, book: badDoc }]]
      .map(([n, j]) => { try { return [n, w.eval("(j=>bookApply(j))").call(w, JSON.parse(JSON.stringify(j)))]; } catch (e) { return [n, null]; } });
    ok(refused.find(([n]) => n === "a list missing")[1] === "no list sales" && refused.find(([n]) => n === "a document that is a list")[1] === "no document QUOTES" && refused.find(([n]) => n === "older than the page")[1] === "older than this page", "each refusal says its own reason: " + JSON.stringify(refused.map(([n, r]) => r)));
    ok(refused.every(([, r]) => typeof r === "string" && r.length) && snapshot() === before && !w.eval("roster.includes('ZZ8-OLD')||roster.includes('ZZ7-BAD')||roster.includes('ZZ6-DOC')"), "an answer that is not a whole book, a Book older than the page, a stock that is no number and a document that is a list are each refused with a reason and change nothing: " + JSON.stringify(refused));
    /* the overlay skips a queued entry the served view holds */
    w.eval("OVERLAY_UNSENT=true;queue=[{at:'2999-01-01T00:00:00Z',raw:'probe',payload:{mode:'count',qty:3,date:'2026-10-28'}}];BOOKED_IDS=new Set();applyOverlay()");
    const counted = w.eval("statedStockBy.salt");
    w.eval("BOOKED_IDS=new Set(['2999-01-01T00:00:00Z']);applyOverlay()");
    const skipped = w.eval("statedStockBy.salt"), kept = w.eval("queue.length");
    ok(counted === 3 && skipped === undefined && kept === 1, "a queued entry counts once: the overlay applies it, and skips it when the served view already holds its draft, the entry staying in the queue: " + JSON.stringify([counted, skipped, kept]));
    w.eval("queue=[];BOOKED_IDS=new Set();applyOverlay()");

    /* 5: bookFetch */
    const calls = []; let answer = { ok: true, status: 200, json: async () => ({ ok: true, rev: 5, booked: [], book: served }) };
    w.fetch = async (u, o) => { calls.push({ u, o }); return answer; };
    w.eval("BOOK_REV=null;bookBusy=false;bookFailAt=0;localStorage.removeItem('saltWriteKey')");
    const noKey = await w.eval("bookFetch(5)");
    ok(noKey === false && calls.length === 0, "a desk with no write key does not ask: the view is the whole ledger");
    w.eval("localStorage.setItem('saltWriteKey','wk')");
    /* a swap that moves the mark judges the queue as the load does: an entry at or under the new mark the device saw acknowledged is in the Book (dropped), a newer one stays */
    w.eval("queue=[{at:'2000-01-01T00:00:00.000Z',raw:'old',payload:{mode:'count',qty:1,date:'2026-10-28'}},{at:'2999-01-01T00:00:00.000Z',raw:'new',payload:{mode:'count',qty:1,date:'2026-10-28'}}];qSentThrough='2999-12-31T00:00:00.000Z';queueCleared=0");
    const done = await w.eval("bookFetch(5)");
    ok(done === true && calls.length === 1 && calls[0].u === "book/page" && calls[0].o.cache === "no-store" && (calls[0].o.headers || {})["X-Salt-Key"] === "wk" && w.eval("BOOK_REV") === 5, "it asks /book/page with the write key and no cache, takes the answer, and records the revision it read: " + JSON.stringify(calls[0]));
    ok(w.eval("queue.length") === 1 && w.eval("queue[0].raw") === "new" && w.eval("queueCleared") === 1 && w.eval("localStorage.getItem('saltQueue')").includes('"new"') && !w.eval("localStorage.getItem('saltQueue')").includes('"old"'), "and the queue is judged against the served mark as at load: the acknowledged entry the Book now holds is dropped (and kept off the device), the newer one stays, so a folded sale is not counted twice");
    answer = { ok: false, status: 503, json: async () => ({}) };
    const failed = await w.eval("bookFetch(6)"), again = await w.eval("bookFetch(6)");
    ok(failed === false && w.eval("BOOK_REV") === 5 && again === false && calls.length === 2, "a failure keeps the book it had and the revision it had, and the next ask waits a minute: " + calls.length + " calls");
    w.eval("bookFailAt=0;bookBusy=false");
    answer = { ok: true, status: 200, json: async () => ({ ok: true, rev: 9, booked: [], book: stale }) };
    const nBefore = calls.length;
    const refusedFetch = await w.eval("bookFetch(9)");
    ok(refusedFetch === false && w.eval("BOOK_REV") === 5 && w.eval("bookRefusedRev") === 9 && calls.length === nBefore + 1, "a book the page refuses leaves the revision it had and remembers the revision it was refused at");
    w.eval("bookFailAt=0;bookBusy=false");
    const again9 = await w.eval("bookFetch(9)");
    ok(again9 === false && calls.length === nBefore + 1, "and is not downloaded again at that revision, however long it waits: the same answer is not worth fetching again a minute later");
    answer = { ok: true, status: 200, json: async () => ({ ok: true, rev: 10, booked: [], book: served }) };
    const moved = await w.eval("bookFetch(10)");
    ok(moved === true && calls.length === nBefore + 2 && w.eval("BOOK_REV") === 10 && w.eval("bookRefusedRev") === null, "when the revision moves it is asked for again, and a taken book forgets the refusal");
    /* whole or nothing, to the end: a value the copy cannot make (a loop) is refused before a list is emptied */
    const loopy = JSON.parse(JSON.stringify(served));
    const before2 = snapshot();
    let loopWhy; try { loopWhy = w.eval("(j=>{j.book.QUOTES.loop=j.book.QUOTES;return bookApply(j);})").call(w, { ok: true, v: "v9999", rev: 11, booked: [], book: loopy }); } catch (e) { loopWhy = "threw"; }
    ok(loopWhy === "a value that is not JSON" && snapshot() === before2, "a served value the copy cannot make is refused before anything is emptied: " + JSON.stringify(loopWhy));
  } finally { try { w.close(); } catch (e) { } }

  /* the poll and the shell */
  const bsrc = readFileSync(join(REPO, "tools", "build.mjs"), "utf8");
  ok(/try\{if\(j&&j\.rev!==undefined&&typeof bookFetch==='function'&&j\.rev!==BOOK_REV\)bookFetch\(j\.rev\);\}catch\(e\)\{\}/.test(bsrc) && bsrc.indexOf("bookFetch(j.rev)") < bsrc.indexOf("j.id===SALT_BUILD_ID)return"), "the cloud script's poll asks for the Book when /rev's revision is one this page has not read, before it judges the build, and a throw there (a page that failed before its lets existed) never keeps it from judging the build");
  const swsrc = readFileSync(join(REPO, "public", "sw.js"), "utf8"), API = new Function("return " + /const API = (\/.*\/);/.exec(swsrc)[1])();
  ok(API.test("/book/page") && API.test("/rev") && !API.test("/desk") && !API.test("/booking"), "the service worker never caches /book (and still not /desk or a path that merely begins with the word)");
}
