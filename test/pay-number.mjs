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
 *   (each check below was proved red by its own mutation: test/pay-number.mutations.json, run with tools/section.mjs) */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
/* an invented number, joined at run time */
const DIG = (...p) => p.join("");

export async function run({ ok, pageWork }) {
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
}
