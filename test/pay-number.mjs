/* test/pay-number.mjs: THE PAY SHEET ASKS THE BANK FIRST AND SHOWS THE NUMBER TO COPY (Phase 7b of the Salt Account and Counter
 * redesign, his yes of 11 Oct 2026, the account number shown with the reference).
 *
 * The sheet puts his banks first, as Option tiles with none chosen; then the figure, All or Part, and "What this pays" folded away;
 * then the way, Transfer or Scan a code. With a bank chosen and Transfer, the sheet shows that bank's account number in groups of
 * four with Copy (digits only to the clipboard) above the reference. The number is NEVER in git (rule 3, the repo is public): it is
 * written from the laptop into the Counter's KV `paynum` by `node tools/paysync.mjs --numbers`, and served on a customer's session
 * at GET /pay/accounts. A bank with no number there keeps the link into the pay page, and an "I am back" ghost moves the sheet to
 * Did you send, so the question no longer waits on the page losing and regaining focus.
 *
 * EVERY NUMBER, NAME AND CODE HERE IS INVENTED. The source holds no run of ten digits: a number is joined from parts at run time, so
 * the source scan (below) can hold this file to the same rule as the rest.
 *   1  the writer: the picker, its refusals, the whitelist, the last four digits alone on screen, the wrangler arguments
 *   2  the route GET /pay/accounts: the session gate, the whitelist, no-store, the empty answer, a failed read, the test accounts' overlay
 *   (each check below was proved red by its own mutation: test/pay-number.mutations.json, run with tools/section.mjs) */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
/* an invented number, joined at run time */
const DIG = (...p) => p.join("");

export async function run({ ok, pageWork, KV }) {
  const PS = await import("../tools/paysync.mjs");

  /* ---- 1: the writer, on an invented pay store */
  const n1 = DIG("5550", "1234", "5678"), n2 = DIG("5550", "9999", "0001", "2"), nSusp = DIG("5550", "0000", "1111"), nNoBank = DIG("5550", "2222", "3333");
  const store = { payee: "Invented Payee Sdn Bhd", owners: [{ name: "Invented Owner", legal: "Invented Owner Legal" }], accounts: [
    { key: "maybank", name: "Maybank", bank: "Maybank", sub: n1.slice(0, 4) + " " + n1.slice(4, 8) + " " + n1.slice(8), payload: "000201INVENTED", mid: "999111", biller: "", holder: "Invented Holder", owner: "Invented Owner" },
    { key: "ambank", name: "AmBank", bank: "AmBank", sub: n2, payload: "000201OTHER", mid: "999222", holder: "Another Invented Holder" },
    { key: "spay", name: "ShopeePay", bank: "ShopeePay", sub: nSusp, maintenance: true },
    { key: "codeonly", name: "Code only", bank: "", sub: nNoBank, payload: "000201CODE" }] };
  const known = new Set(["maybank", "ambank", "spay", "codeonly"]);
  const got = PS.pickNumbers(store, known);
  ok(Object.keys(got.accounts).join() === "maybank,ambank" && got.accounts.maybank.number === n1 && got.accounts.ambank.number === n2 && !got.refused.length,
    "the picker takes the accounts that offer a transfer and are not suspended, with the spaces of the store's number stripped, and passes over a suspended account and one with no bank: "
    + JSON.stringify({ keys: Object.keys(got.accounts), refused: got.refused }));
  const rec = PS.numbersRecord(got.accounts, "2026-10-11T00:00:00.000Z"), txt = JSON.stringify(rec);
  ok(Object.keys(rec).join() === "v,at,accounts" && rec.v === 1 && Object.values(rec.accounts).every((a) => Object.keys(a).join() === "number")
    && !/Invented|INVENTED|OTHER|CODE|999111|999222/.test(txt),
    "the record is the version, the day and a number a key, and holds no holder, owner, payee, bank, member number or payload: " + txt.replace(/[0-9]{6,}/g, "#"));

  /* the refusals: a number outside 10 to 15 digits, with a letter or a dash, an absent one; a key pay.js lacks */
  const bad = (sub) => PS.pickNumbers({ accounts: [{ key: "maybank", name: "M", bank: "Maybank", sub }] }, known);
  const refusals = { short: bad(n1.slice(0, 9)), long: bad(n1 + n2.slice(0, 4)), letter: bad(n1.slice(0, 9) + "x"), dash: bad(n1.slice(0, 5) + "-" + n1.slice(5)), none: bad(undefined), blank: bad("   ") };
  ok(Object.values(refusals).every((r) => r.refused.length === 1 && !Object.keys(r.accounts).length) && bad(n1.slice(0, 10)).refused.length === 0 && bad(n1.slice(0, 10) + n2.slice(0, 5)).refused.length === 0,
    "a number of nine digits, sixteen, one with a letter, one with a dash, none at all and a blank are each refused, and ten and fifteen digits pass: " + JSON.stringify(Object.fromEntries(Object.entries(refusals).map(([k, r]) => [k, r.refused.length]))));
  const lack = PS.pickNumbers(store, new Set(["maybank"]));
  ok(lack.refused.length === 1 && /^ambank: /.test(lack.refused[0]) && Object.keys(lack.accounts).join() === "maybank",
    "an account stmt/pay.js lacks is refused by its key, saying to run --sync first: " + JSON.stringify(lack.refused));
  ok(PS.pickNumbers({ accounts: [{ key: "spay", name: "S", bank: "S", maintenance: true, sub: nSusp }] }, known).refused.join() === "no account offers a transfer with a number",
    "and a store with nothing to serve is refused too, never written as an empty record");

  /* what the tool says: a key and the last four digits, never a whole number, in a refusal, the table or a difference */
  const allSaid = [].concat(PS.numbersTable(got.accounts), PS.numbersDiff(rec, { v: 1, accounts: { maybank: { number: n2 }, zz: { number: n1 } } }), Object.values(refusals).flatMap((r) => r.refused), lack.refused).join("\n");
  ok(PS.lastFour(n1) === n1.slice(-4) && /\.\.\.\.\.5678/.test(allSaid) && !/[0-9]{5}/.test(allSaid)
    && PS.numbersDiff(rec, { v: 1, accounts: { maybank: { number: n1 } } }).join().includes("ambank"),
    "the table, the difference and every refusal name a key and the last four digits, and no run of five digits: " + allSaid.replace(/[0-9]{5,}/g, "#"));
  const same = PS.numbersDiff(rec, { v: 1, accounts: { maybank: { number: n1 }, ambank: { number: n2 } } });
  const unlike = PS.numbersDiff(rec, { v: 1, accounts: { maybank: { number: n1 }, ambank: { number: n1 }, extra: { number: n2 } } });
  ok(same.length === 0 && unlike.length === 2 && /ambank.*differs/.test(unlike[0]) && /extra.*not in the store/.test(unlike[1]),
    "the readback compares number by number: equal is no difference, a different number and one only on the Counter are each named: " + JSON.stringify(unlike));

  /* the wrangler calls, with a stub: the Counter's own KV, binding STMT, the key paynum, from a file, never the value on the line */
  let put = null, get = null;
  PS.wrPutNumbers("x.json", (cmd, args, opts) => { put = { cmd, args, opts }; return ""; });
  PS.wrGetNumbers((cmd, args, opts) => { get = { cmd, args, opts }; return "{}"; });
  ok(!!put && put.args.join(" ") === "wrangler kv key put paynum --path x.json --binding STMT --remote -c wrangler.stmt.jsonc" && put.opts.cwd === REPO && put.opts.shell === (process.platform === "win32")
    && !!get && get.args.join(" ") === "wrangler kv key get paynum --binding STMT --remote -c wrangler.stmt.jsonc",
    "the write is wrangler kv key put on the Counter's STMT binding, key paynum, from a file, and the readback is the get of the same: " + JSON.stringify([put && put.args, get && get.args]));

  /* ---- 2: the route, GET /pay/accounts, through the real Worker on a stand-in KV */
  const stmtW = (await import("../stmt/worker.js")).default;
  const O = await import("../stmt/orders.js");
  const TF = await import("../stmt/testfix.js");
  const PN = await import("../stmt/paynum.js");
  const kv = new KV();
  const env = { STMT: kv, STMT_DESK_KEY: "desk-key" };
  const asker = async (u) => ({ "X-Stmt-Session": await O.mintSession(env, u) });
  const call = async (path, headers = {}, method = "GET", e = env) => {
    let r; try { r = await stmtW.fetch(new Request("https://k7m3p2.example" + path, { method, headers }), e); } catch (err) { return { status: 0, cc: null, b: {}, raw: "{}", threw: String(err.message) }; }
    let b = null; try { b = await r.json(); } catch (err) { b = null; }
    return { status: r.status, cc: r.headers.get("cache-control"), b: b || {}, raw: JSON.stringify(b || {}) };
  };
  const hide = (s) => s.replace(/[0-9]{6,}/g, "#");
  const S = await asker("abcd-efgh");
  const none = await call("/pay/accounts", S);
  ok(none.status === 200 && none.b.ok === true && JSON.stringify(none.b.accounts) === "{}" && none.cc === "no-store",
    "with no paynum filed the route answers an empty list, never an error, and is no-store: " + JSON.stringify([none.status, none.b, none.cc]));
  const anon = await call("/pay/accounts", {});
  ok(anon.status === 401 && !("accounts" in anon.b), "without a session it is the site's usual refusal and carries no accounts: " + JSON.stringify([anon.status, anon.b]));

  const record = () => JSON.stringify({ v: 1, at: "2026-10-11T00:00:00.000Z", payee: "Invented Payee Sdn Bhd", accounts: {
    maybank: { number: n1, holder: "Invented Holder", owner: "Invented Owner", mid: "999111", payload: "000201INVENTED", bank: "Maybank" },
    ambank: { number: n2 }, spay: { number: nSusp }, nokey: { number: n1 }, gx: { number: "12345678" }, wise: { number: n1.slice(0, 9) + "x" }, ryt: "not an object" } });
  await kv.put("paynum", record());
  const some = await call("/pay/accounts", S);
  ok(some.status === 200 && some.b.ok === true && Object.keys(some.b.accounts).join() === "maybank,ambank"
    && Object.values(some.b.accounts).every((a) => Object.keys(a).join() === "number") && some.b.accounts.maybank.number === n1 && some.b.accounts.ambank.number === n2,
    "the route serves the accounts the page offers for a transfer, a well-formed number each, and passes over a suspended account, a key the rails lack, a short number, one with a letter and a malformed entry: " + hide(some.raw));
  ok(!/Invented|INVENTED|holder|owner|payee|payload|mid|999111/i.test(some.raw.replace(/maybank|ambank/g, "")),
    "and a field added to the record by mistake, a holder, owner, payee, member number or payload, never leaves: " + hide(some.raw));
  const post = await call("/pay/accounts", { ...S, "content-type": "application/json" }, "POST");
  ok(post.status === 405 && !("accounts" in post.b), "only a read is answered: " + post.status);
  await kv.put("paynum", JSON.stringify({ ...JSON.parse(record()), v: 2 }));
  ok(JSON.stringify((await call("/pay/accounts", S)).b.accounts) === "{}", "a record of another version is not served");
  await kv.put("paynum", record());
  const lame = { STMT: { get: async (k, t) => { if (k === "paynum") throw new Error("KV is down"); return kv.get(k, t); }, put: (k, v, o) => kv.put(k, v, o), delete: (k) => kv.delete(k) }, STMT_DESK_KEY: "desk-key" };
  const down = await call("/pay/accounts", S, "GET", lame);
  ok(down.status === 200 && JSON.stringify(down.b.accounts) === "{}", "and a KV read that fails answers an empty list, so the sheet falls back to the link: " + down.status);

  /* the whitelist alone, on an invented list: only a transfer account that is not suspended, only its own key, never an inherited one */
  const list = [{ key: "a", transfer: true, maintenance: false }, { key: "b", transfer: false, maintenance: false }, { key: "c", transfer: true, maintenance: true }, { key: "e", transfer: true, maintenance: false }];
  const picked = PN.numbersOf({ v: 1, accounts: Object.assign(Object.create({ e: { number: n2 } }), { a: { number: n1, holder: "x" }, b: { number: n1 }, c: { number: n1 }, d: { number: n1 } }) }, list);
  ok(JSON.stringify(picked) === JSON.stringify({ a: { number: n1 } }),
    "and the picker serves a, which offers a transfer and is open, and not b (no transfer rail), c (suspended), d (not on the list) or e (inherited, not the record's own): " + hide(JSON.stringify(picked)));

  /* a test account is answered its fixture's invented number, and the real record is never read for it */
  const ZERO = "0000000000000", T = TF.TEST_USER;
  await kv.put("u:" + T, JSON.stringify({ test: true, wrap: { salt: "pn-salt" } }));
  const TS = await asker(T);
  const noFix = await call("/pay/accounts", TS);
  await kv.put(TF.fixKey(T), JSON.stringify({ v: TF.FIX_VERSION, salt: "pn-salt", at: "2026-10-11T00:00:00.000Z", paynum: { maybank: { number: ZERO, holder: "Invented Holder" }, nokey: { number: ZERO } } }));
  const fixed = await call("/pay/accounts", TS);
  ok(noFix.status === 200 && JSON.stringify(noFix.b.accounts) === "{}", "a test account with no fixture sealed yet is answered an empty list, though the real record is filed: " + hide(noFix.raw));
  ok(fixed.status === 200 && JSON.stringify(fixed.b.accounts) === JSON.stringify({ maybank: { number: ZERO } }) && !fixed.raw.includes(n1) && !fixed.raw.includes(n2),
    "with its fixture it is answered the fixture's invented number through the same whitelist, and none of the real record's: " + hide(fixed.raw));

  /* ---- 4: the practice accounts hold an invented number, sealed with the fixture, and a fixture sealed before is not served */
  const TX = await import("../tools/testfix.mjs"), CR = await import("../tools/stmt-crypto.mjs");
  const all = TX.buildAll(new Date("2026-10-11T04:00:00Z")), line = TX.FEATURES.map(([nm]) => nm).find((nm) => /bank account number beside the reference/.test(nm));
  ok(Object.values(all).length === 2 && Object.values(all).every((f) => JSON.stringify(f.paynum) === JSON.stringify({ maybank: { number: ZERO } })) && !!line && !TX.missing(all).includes(line),
    "each practice account carries the invented all-zero number for one bank, and the fixture's line for it is met: " + JSON.stringify(Object.values(all).map((f) => f.paynum)));
  const bare = Object.fromEntries(Object.entries(all).map(([s, f]) => [s, Object.assign({}, f, { paynum: undefined })]));
  const real = Object.fromEntries(Object.entries(all).map(([s, f]) => [s, Object.assign({}, f, { paynum: { maybank: { number: n1 } } })]));
  ok(TX.missing(bare).includes(line) && TX.missing(real).includes(line),
    "and a fixture without a number, or with one that is not all zeros, is red by its line: " + JSON.stringify([TX.missing(bare).includes(line), TX.missing(real).includes(line)]));
  const ckT = await CR.contentKey("test-secret", T), recT = { test: true, wrap: await CR.wrapKey(TF.TEST_PASS, ckT) };
  const sealed = await TX.sealFixture(all[T], recT, TF.TEST_PASS);
  ok(JSON.stringify(sealed.paynum) === JSON.stringify({ maybank: { number: ZERO } }) && sealed.v === TF.FIX_VERSION && TF.FIX_VERSION >= 9,
    "the sealed fixture carries it, at a fixture version past the one that held none, so the next publish seals every practice account afresh: " + JSON.stringify([sealed.v, TF.FIX_VERSION]));
  await kv.put("u:" + T, JSON.stringify(recT)); await kv.put(TF.fixKey(T), JSON.stringify(sealed));
  const sealedAns = await call("/pay/accounts", TS);
  await kv.put(TF.fixKey(T), JSON.stringify(Object.assign({}, sealed, { v: TF.FIX_VERSION - 1 })));
  const older = await call("/pay/accounts", TS);
  ok(JSON.stringify(sealedAns.b.accounts) === JSON.stringify({ maybank: { number: ZERO } }) && JSON.stringify(older.b.accounts) === "{}",
    "the Worker answers the sealed fixture's number, and a fixture sealed at an earlier version is not served until the publish seals it again: " + hide(JSON.stringify([sealedAns.b, older.b])));

  /* ---- 3: the sheet, through the generated page in jsdom with a stubbed fetch */
  const { landingPage } = await import("../stmt/page.js");
  const { payHref, PAY_ACCOUNTS } = await import("../stmt/pay.js");
  const { JSDOM } = await import("jsdom");
  const { webcrypto } = await import("node:crypto");
  const BUILD = "a".repeat(16), UN = "abcd-efgh", NUMBER = DIG("5550", "1234", "5678", "9"), GROUPED = "5550 1234 5678 9";
  const kl = (k) => new Date(Date.now() + 8 * 3600e3 + k * 864e5).toISOString().slice(0, 10);
  const tx = (e) => { if (!e) return ""; const c = e.cloneNode(true); c.querySelectorAll("svg").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
  const part = (i) => ({ date: kl(-9 + i), since: kl(-1), due: kl(2), late: false, rm: 100 + i, whole: 100 + i, product: "salt", qty: 1 + i, got: 1 + i, gotOn: kl(-1),
    resale: false, goods: 100 + i, deliv: 0, less: 0, rate: 100 });
  const wins = [];
  /* a customer's page signed in on an invented account owing three parts, 303 in all; `numbers` is what GET /pay/accounts answers, `down`
     a Worker that cannot be reached for it. `calls` is every request the page made, `copied` every string put on the clipboard. */
  const openPage = async ({ numbers = {}, down = false } = {}) => {
    const pass = "fixture-pass-7b", ck = await CR.contentKey("test-secret", UN), list = [part(0), part(1), part(2)], sum = 303;
    const pay = { term: 1, hide: 3, lock: 4, window: 60, now: { rm: sum, due: list[0].due, parts: list }, overdue: { rm: 0, parts: [] }, coming: { rm: 0, parts: [] } };
    const stamped = { at: new Date(Date.now() - 3600e3).toISOString(), body: "<p>Live</p>", owed: sum, pay, buildId: BUILD };
    const body = { ok: true, wrap: await CR.wrapKey(pass, ck), session: "sess-7b", liveStatus: "current",
      live: Object.assign({ at: stamped.at, buildId: BUILD }, await CR.encryptWith(ck, JSON.stringify(stamped))),
      env: await CR.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
    const calls = [], copied = []; let work, isDown = down;
    const dom = new JSDOM(landingPage(UN, "n7b", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.open = () => null;
      Object.defineProperty(win.navigator, "clipboard", { value: { writeText: async (s) => { copied.push(String(s)); } }, configurable: true });
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET", b = init && init.body ? JSON.parse(init.body) : null;
        calls.push({ p, m, b });
        const res = (status, j) => ({ ok: status === 200, status, json: async () => j });
        if (p === "/open" || p === "/account") return res(200, body);
        if (p === "/orders" && m === "GET") return res(200, { ok: true, orders: [], claims: [] });
        if (p === "/pay/accounts") return isDown ? res(500, { ok: false }) : res(200, { ok: true, accounts: numbers });
        if (p === "/account/claim" && m === "POST") return res(200, { ok: true, claim: { id: "c1" } });
        return res(404, { ok: false });
      };
      work = pageWork(win);
    } });
    wins.push(dom.window);
    const d = dom.window.document;
    d.getElementById("un").value = UN; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden && !!d.getElementById("payNow"));
    await work.quiet();
    const w = dom.window;
    const pick = (key) => { const r = d.querySelector('#payBody input[name="payInto"][value="' + key + '"]'); r.checked = true; r.dispatchEvent(new w.Event("change", { bubbles: true })); };
    const way = (v) => { const r = d.querySelector('#payBody input[name="payHow"][value="' + v + '"]'); r.checked = true; r.dispatchEvent(new w.Event("change", { bubbles: true })); };
    const go = () => d.getElementById("payGo");
    return { w, d, work, calls, copied, sum, pick, way, go, up: () => { isDown = false; }, open: () => d.getElementById("payNow").click(), asked: () => calls.filter((c) => c.p === "/pay/accounts").length,
      posts: () => calls.filter((c) => c.m === "POST" && c.p === "/account/claim"), q: () => { try { return JSON.parse(w.localStorage.getItem("salt-stmt-payq") || "null"); } catch (e) { return null; } } };
  };
  const kind = (e) => (e ? e.tagName + (e.disabled ? " disabled" : "") : "(none)");
  try {
    /* the order of the sheet, none chosen, the pill waiting, What this pays shut */
    const A = await openPage({ numbers: { maybank: { number: NUMBER } } });
    A.open();
    const body = A.d.getElementById("payBody"), kids = [...body.children], at = (sel) => kids.findIndex((n) => n.matches(sel));
    const idx = ["#payInto", ".salt-kpi", ".payseg", "#payWhat", ".payhow", ".payref"].map(at);
    const tiles = [...body.querySelectorAll('#payInto input[name="payInto"]')], what = A.d.getElementById("payWhat");
    ok(idx.every((i) => i >= 0) && idx.every((i, k) => k === 0 || i > idx[k - 1]),
      "the sheet runs in this order: his banks, the figure, All or Part, What this pays, the way, then the reference: " + JSON.stringify(idx));
    ok(tiles.length === PAY_ACCOUNTS.filter((a) => payHref(a.key, "transfer", A.sum, UN)).length && tiles.length > 5 && tiles.every((r) => !r.checked) && kind(A.go()) === "BUTTON disabled" && tx(A.go()) === "Show the account number",
      "his banks stand first as tiles, every one the link would open and none chosen, and the pill waits: " + JSON.stringify([tiles.length, kind(A.go()), tx(A.go())]));
    ok(!!what && !what.open && what.tagName === "DETAILS" && what.classList.contains("salt-plan") && tx(what.querySelector("summary")) === "What this pays"
      && what.querySelectorAll(".inv > .salt-ledger__row:not(.invt):not(.invtot)").length === 3,
      "What this pays is the Plan recipe's fold, shut, and holds the invoice's three lines: " + JSON.stringify([!!what, what && what.open]));

    /* the pill lights as soon as a bank is chosen, and with its number the sheet shows it grouped, with Copy for digits alone */
    A.pick("maybank");
    const row = A.d.getElementById("payAcctNo"), rows = [...A.d.querySelectorAll("#payBody .payref > .salt-ledger__row")];
    const copyNo = row && row.querySelector("button"), copyRef = rows[1] && rows[1].querySelector("button");
    ok(kind(A.go()) === "BUTTON" && tx(A.go()) === "I have paid" && A.go().classList.contains("salt-pill") && !!row && rows.length === 2 && rows[0] === row
      && tx(row.querySelector(".salt-ledger__label")) === "Account number" && tx(row.querySelector(".salt-ledger__value")) === GROUPED && tx(row.querySelector(".salt-ledger__flag")) === "Maybank"
      && tx(rows[1].querySelector(".salt-ledger__label")) === "Reference" && tx(rows[1].querySelector(".salt-ledger__value")) === UN,
      "choosing a bank lights the pill as I have paid, and Transfer shows two rows: the account number in groups of four with the bank's name, then the reference: "
      + JSON.stringify([kind(A.go()), tx(A.go()), row && tx(row.querySelector(".salt-ledger__value")), rows.length]));
    if (copyNo) copyNo.click();
    await until(() => A.copied.length >= 1 && !!tx(A.d.querySelector("#payBody .payref + .msg")), 40);
    const afterNo = A.copied.slice();
    if (copyRef) copyRef.click();
    await until(() => A.copied.length >= 2, 40);
    ok(afterNo.join() === NUMBER && !/\s/.test(afterNo[0] || " ") && A.copied.join() === NUMBER + "," + UN && copyNo.getAttribute("aria-label") === "Copy the account number" && tx(A.d.querySelector("#payBody .payref + .msg")) === "Copied.",
      "Copy puts the digits alone on the clipboard, with no space, the reference's Copy puts the username, and the sheet says Copied: " + JSON.stringify(A.copied).replace(/[0-9]{6,}/g, "#"));

    /* a tap is 44px both ways: the tiles, Copy, the pill and the ghosts hold the design system's tap size */
    const cs = (e) => A.w.getComputedStyle(e);
    const opn = A.d.getElementById("payOpen");
    const tap = { tile: cs(A.d.querySelector("#payInto .salt-option__face")).minHeight, copy: cs(copyNo).minHeight + "|" + cs(copyNo).minWidth, pill: cs(A.go()).minHeight,
      open: opn ? cs(opn).minHeight : "(none)", summary: cs(what.querySelector("summary")).minHeight };
    ok(tap.tile === "var(--salt-tap)" && tap.copy === "var(--salt-tap)|var(--salt-tap)" && tap.pill === "var(--salt-tap)" && tap.open === "var(--salt-tap)" && tap.summary === "var(--salt-tap)",
      "a tap is 44px both ways on the bank tiles, both Copy buttons, the pill, the ghost link and the fold's summary: " + JSON.stringify(tap));

    /* with the number: the ghost link stays (D8), the claim is asked at I have paid (D7) with no blur or focus, and posts the same body */
    const openLink = A.d.getElementById("payOpen");
    ok(!!openLink && openLink.tagName === "A" && tx(openLink) === "Open the payment page" && openLink.classList.contains("salt-ghost") && openLink.getAttribute("href") === payHref("maybank", "transfer", 303, UN)
      && openLink.target === "_blank" && !A.d.getElementById("payReturn"),
      "beside I have paid a ghost keeps the link into the pay page, at that bank, way and figure, and there is no I am back: " + JSON.stringify([!!openLink, openLink && openLink.getAttribute("href")]));
    A.go().click();
    const asked = { q: tx(A.d.querySelector("#payBody .paycheck h3")), yes: tx(A.d.getElementById("paySent")), posted: A.posts().length, sheet: !A.d.getElementById("paySheet").hidden, q1: A.q() };
    ok(asked.q === "Did you send RM 303.00?" && asked.yes === "Yes, I sent RM 303.00" && asked.posted === 0 && asked.sheet,
      "I have paid goes straight to Did you send, asked once and with nothing posted, though the window never lost or regained focus: " + JSON.stringify(asked));
    const kept = asked.q1;
    ok(!!kept && Object.keys(kept).join() === "who,at,kind,id,away" && Object.keys(kept.away).join() === "amt,rail,acct" && kept.away.amt === 303 && kept.away.rail === "transfer" && kept.away.acct === "maybank"
      && !JSON.stringify(kept).includes(UN),
      "and the question is kept on the device as it always was, the way, the bank and the figure, never the username: " + JSON.stringify(kept));
    [...A.d.querySelectorAll("#payFoot button")].find((b) => tx(b) === "Not yet").click();
    ok(A.q() === null && tx(A.go()) === "I have paid" && !!A.d.getElementById("payAcctNo") && A.posts().length === 0,
      "Not yet goes back to the sheet with the number still there and nothing recorded, and the kept question is dropped");
    A.go().click();
    A.d.getElementById("paySent").click();
    await until(() => A.posts().length === 1 && A.d.getElementById("paySheet").hidden);
    const claim = A.posts()[0] && A.posts()[0].b;
    ok(A.posts().length === 1 && !!claim && Object.keys(claim).sort().join() === "account,amount,method,rid" && claim.amount === 303 && claim.method === "transfer" && claim.account === "maybank" && !!claim.rid,
      "Yes posts the claim as it always did, the figure, the way, the bank and an id, to the account: " + JSON.stringify(claim));

    /* Part of it: the figure typed is the figure the question asks and the claim carries */
    A.open(); A.pick("maybank");
    [...A.d.querySelectorAll("#payBody .payseg button")].find((b) => tx(b) === "Part of it").click();
    const amt = A.d.getElementById("payAmt"); amt.value = "40"; amt.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    A.go().click();
    const partQ = tx(A.d.querySelector("#payBody .paycheck h3"));
    A.d.getElementById("paySent").click();
    await until(() => A.posts().length === 2);
    ok(partQ === "Did you send RM 40.00?" && A.posts()[1].b.amount === 40, "Part of it asks for the part and claims it: " + JSON.stringify([partQ, A.posts()[1] && A.posts()[1].b.amount]));

    /* the link, as before, still works on its own: Open the payment page, then back through the window's own blur and focus */
    A.open(); A.pick("maybank");
    A.d.getElementById("payOpen").click();
    A.w.dispatchEvent(new A.w.Event("blur")); A.w.dispatchEvent(new A.w.Event("focus"));
    ok(!!A.d.getElementById("paySent"), "and the ghost link, then the window losing and regaining focus, still turns the sheet to the question");
    A.d.getElementById("payX").click();

    /* a bank with no number filed: the filled pill is the link as today, and I am back moves to the question without waiting on focus */
    const B = await openPage({ numbers: { maybank: { number: NUMBER } } });
    B.open(); B.pick("ambank");
    const back = B.d.getElementById("payReturn");
    ok(!B.d.getElementById("payAcctNo") && kind(B.go()) === "A" && tx(B.go()) === "Show the account number" && B.go().getAttribute("href") === payHref("ambank", "transfer", 303, UN)
      && !!back && back.tagName === "BUTTON" && back.classList.contains("salt-ghost") && tx(back) === "I am back" && !B.d.getElementById("payOpen")
      && tx(B.d.querySelector("#payBody .payref .salt-ledger__label")) === "Reference",
      "a bank with no number filed shows the reference alone, the filled pill is the link as before, and a ghost reads I am back: " + JSON.stringify([kind(B.go()), tx(B.go()), !!back]));
    /* the link as it always worked: followed, then the window loses and regains focus; Not yet goes back to the sheet */
    B.go().click(); B.w.dispatchEvent(new B.w.Event("blur")); B.w.dispatchEvent(new B.w.Event("focus"));
    const viaFocus = !!B.d.getElementById("paySent") && !!B.q();
    if (B.d.getElementById("paySent")) [...B.d.querySelectorAll("#payFoot button")].find((b) => tx(b) === "Not yet").click();
    ok(viaFocus && !B.d.getElementById("paySent") && kind(B.go()) === "A", "the link pill, followed and then the window losing and regaining focus, still turns the sheet to the question, and Not yet comes back to it");
    B.d.getElementById("payReturn").click();
    ok(tx(B.d.querySelector("#payBody .paycheck h3")) === "Did you send RM 303.00?" && B.posts().length === 0, "I am back goes to the question at once, with nothing posted and no blur or focus");
    B.d.getElementById("paySent").click();
    await until(() => B.posts().length === 1);
    ok(JSON.stringify(Object.keys(B.posts()[0].b).sort()) === '["account","amount","method","rid"]' && B.posts()[0].b.account === "ambank" && B.posts()[0].b.amount === 303,
      "and Yes posts the same claim for that bank: " + JSON.stringify(B.posts()[0] && B.posts()[0].b));
    B.d.getElementById("payX").click();

    /* the Worker cannot be reached, or sends a number that is not 10 to 15 digits: the same, no number */
    const D = await openPage({ down: true, numbers: { maybank: { number: NUMBER } } }), E = await openPage({ numbers: { maybank: { number: "12345678" } } });
    D.open(); D.pick("maybank"); E.open(); E.pick("maybank");
    ok(!D.d.getElementById("payAcctNo") && kind(D.go()) === "A" && !!D.d.getElementById("payReturn") && !E.d.getElementById("payAcctNo") && kind(E.go()) === "A" && !!E.d.getElementById("payReturn"),
      "with the Worker unreachable, or a number the page will not draw, the sheet shows no number and falls back to the link and I am back: " + JSON.stringify([kind(D.go()), kind(E.go())]));
    await D.work.quiet();
    const askedDown = D.asked();
    D.d.getElementById("payX").click(); E.d.getElementById("payX").click();
    /* and an answer that did not come is asked for again at the next open, so the number appears once the Worker is back */
    D.up(); D.open(); await until(() => D.asked() > askedDown, 60); await D.work.quiet(); D.pick("maybank");
    ok(askedDown >= 1 && D.asked() === askedDown + 1 && !!D.d.getElementById("payAcctNo") && tx(D.go()) === "I have paid",
      "a failed ask is made again at the next open, and the number shows once the Worker answers: " + JSON.stringify([askedDown, D.asked(), !!D.d.getElementById("payAcctNo")]));
    D.d.getElementById("payX").click();

    /* Scan a code: the bank's number is not shown, whatever is filed */
    const F = await openPage({ numbers: { maybank: { number: NUMBER } } });
    F.open(); F.way("qr"); F.pick("maybank");
    const scanTiles = [...F.d.querySelectorAll('#payInto input[name="payInto"]')].map((r) => r.value);
    ok(!F.d.getElementById("payAcctNo") && !new RegExp(NUMBER.slice(0, 8)).test(F.d.getElementById("paySheet").textContent.replace(/\s/g, "")) && kind(F.go()) === "A" && tx(F.go()) === "Show the code"
      && F.go().getAttribute("href") === payHref("maybank", "qr", 303, UN) && !!F.d.getElementById("payReturn") && !scanTiles.includes("wise") && scanTiles.includes("maybank"),
      "on Scan a code the tiles are the accounts with a code, no number is shown, and the filled pill is the link with I am back beside it: " + JSON.stringify([kind(F.go()), tx(F.go()), scanTiles.length]));
    F.d.getElementById("payReturn").click();
    ok(tx(F.d.querySelector("#payBody .paycheck h3")) === "Did you send RM 303.00?" && F.d.getElementById("payBody").textContent.indexOf("code") >= 0, "and I am back asks the question there too");
    F.d.getElementById("payX").click();

    /* What this pays stays as they left it across a redraw, and the numbers are asked once a visit */
    const G = await openPage({ numbers: { maybank: { number: NUMBER } } });
    G.open();
    let toggled = false; G.d.getElementById("payWhat").addEventListener("toggle", () => { toggled = true; });
    G.d.getElementById("payWhat").querySelector("summary").click();
    await until(() => toggled, 60);
    G.pick("maybank");
    const kept2 = G.d.getElementById("payWhat");
    G.d.getElementById("payX").click(); G.open(); G.d.getElementById("payX").click(); G.open();
    ok(!!kept2 && kept2.open && !G.d.getElementById("payWhat").open && G.asked() === 1,
      "What this pays stays open across a redraw of the sheet and opens shut with the sheet, and across three openings the numbers were asked once: " + JSON.stringify([kept2 && kept2.open, G.d.getElementById("payWhat").open, G.asked()]));

    /* his read-only view of an account asks nothing, on the page his route spliced in */
    const ow = await ownerView();
    ok(ow.opened && ow.calls.some((c) => /^GET \/all\/orders\//.test(c)) && !ow.calls.some((c) => c.includes("/pay/accounts")) && !ow.payNow,
      "his read-only view signs in with no session and asks for no account numbers, and has no Pay: " + JSON.stringify(ow.calls));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }

  /* the owner's page: a master sign-in is a view, no session, the orders from his own route */
  async function ownerView() {
    const ck = await CR.contentKey("probe-secret", UN), calls = [];
    const body = { ok: true, byMaster: true, session: "", assoc: false, wrapMaster: await CR.wrapKey("fixture-master", ck),
      env: await CR.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>S</p>" }] })) };
    const dom = new JSDOM(landingPage("", "n7b-owner", { master: "fixture-master", accounts: [{ code: "CX1-ZED", username: UN }] }), {
      url: "https://counter.fixture.test/all", runScripts: "dangerously", pretendToBeVisual: true,
      beforeParse(w) {
        Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
        w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.scrollTo = () => {};
        w.fetch = async (p, init) => { calls.push(((init && init.method) || "GET") + " " + p); const j = p === "/open" ? body : { ok: true, orders: [], claims: [], refs: [] }; return { ok: true, status: 200, json: async () => j }; };
      } });
    try {
      const d = dom.window.document, work = pageWork(dom.window);
      d.getElementById("un").value = UN; d.getElementById("pw").value = "fixture-master";
      d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await until(() => calls.some((c) => /^GET \/all\/orders\//.test(c)));
      await work.quiet();
      return { calls, opened: calls.includes("POST /open"), payNow: !!d.getElementById("payNow") };
    } finally { dom.window.close(); }
  }
}
