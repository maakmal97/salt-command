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
}
