/* test/pay-number.mjs: THE PAY SHEET ASKS THE BANK FIRST AND SHOWS THE NUMBER TO COPY (Phase 7b of the Salt Admin and Counter
 * redesign, his yes of 11 Oct 2026, the account number shown with the reference).
 *
 * The sheet puts his banks first, as Option tiles with none chosen; then the figure, All or Part, and "What this pays" folded away;
 * then the way, Transfer or Scan a code. With a bank chosen and Transfer, the sheet shows that bank's account number in groups of
 * four with Copy (digits only to the clipboard) above the reference. The number is NEVER in git (rule 3, the repo is public): it is
 * read by the Counter's Worker from Salt QR (stmt/paycodes.js; the old KV `paynum` and its laptop writer retired 06 Nov 2026), and served on a customer's session
 * at GET /pay/accounts. A bank with no number there keeps the link into the pay page, and an "I am back" ghost moves the sheet to
 * Did you send, so the question no longer waits on the page losing and regaining focus.
 *
 * EVERY NUMBER, NAME AND CODE HERE IS INVENTED. The source holds no run of ten digits: a number is joined from parts at run time, so
 * the source scan (below) can hold this file to the same rule as the rest.
 *   (1, 2 and 4, the writer, the route and the practice accounts' number, retired 06 Nov 2026: the route is test/pay-codes.mjs)
 *   5  the leak scan and the source scan, each on invented data, then 6 a guest board with the numbers filed, then 7 both on the repository
 *   3  the sheet, in jsdom
 *   (each check below was proved red by its own mutation: test/pay-number.mutations.json, run with tools/section.mjs) */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
/* an invented number, joined at run time */
const DIG = (...p) => p.join("");

/* ---- THE SCANS (rule 3: the repo is public). Both answer paths, lines and counts, never a value, so a failing run leaks nothing.
   leakScan holds every private value of the pay store absent from every tracked file; longRuns holds the source free of a number. */
const BINARY = /[.](woff2?|ttf|otf|png|jpe?g|gif|webp|ico|pdf|zip|gz|wasm)$/i;
export const trackedTexts = (only, except) => execFileSync("git", ["ls-files", "-z"], { cwd: REPO, maxBuffer: 1 << 28 }).toString().split("\0")
  .filter((p) => p && !BINARY.test(p) && (!only || only.test(p)) && !(except && except.test(p)))
  .map((p) => { try { return { path: p, text: readFileSync(join(REPO, p), "utf8") }; } catch (e) { return null; } }).filter(Boolean);

/* the source scan reads every tracked text file but the generated desk, its build and the book (master/, public/, ledger/) and the facts file */
export const NOT_SCANNED = /^(master|public|ledger|test\/fixtures|test\/vendor)\/|^MEMORY\.md$/;

/* Every leaf of the pay store is private (an unknown field is searched for too) but the fields that are no identity: what stmt/pay.js ships on
   purpose (each account's key, name and bank) and what only draws the tile in QR Command (its brand and ring colours, the ids of its traced
   marks, a purpose label, the group an account sits in and the group names), and the store's own bookkeeping. A generic word of those is in half
   the repository. */
const PUBLIC_FIELDS = ["accounts[].key", "accounts[].name", "accounts[].bank", "accounts[].brand", "accounts[].ring", "accounts[].bankMark", "accounts[].holderMark",
  "accounts[].tag", "accounts[].group", "accounts[].maintenance", "rev", "updated"];
const publicField = (path) => PUBLIC_FIELDS.includes(path) || path === "groups" || path.startsWith("groups.") || path.startsWith("groups[");
export function leavesOf(doc) {
  const out = [];
  const walk = (v, path) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, path + "[]"));
    else if (v && typeof v === "object") Object.keys(v).forEach((k) => walk(v[k], path ? path + "." + k : k));
    else if ((typeof v === "string" || typeof v === "number") && !publicField(path)) {
      const s = String(v).trim(); if (s.length >= 4 && !(/^[0-9 -]+$/.test(s) && s.replace(/[^0-9]/g, "").length < 5)) out.push({ path, s });   /* four digits is no identity */
    }
  };
  walk(doc, "");
  return out;
}
export function leakScan(doc, files) {
  const leaves = leavesOf(doc), low = files.map((f) => f.text.toLowerCase());
  const closed = low.map((t) => t.replace(/([0-9])[ -](?=[0-9])/g, "$1"));   /* a number written in groups or with dashes, closed up */
  const seen = new Map();
  for (const { path, s } of leaves) {
    const d = s.replace(/[^0-9]/g, ""), isNumber = /^[0-9 -]+$/.test(s), raw = s.toLowerCase();
    const bound = isNumber && d.length < 10 ? new RegExp("(?<![0-9])" + d + "(?![0-9])") : null;   /* a short code counts only as a whole number */
    let n = 0;
    low.forEach((t, i) => { if (isNumber ? (bound ? bound.test(closed[i]) : closed[i].includes(d)) : t.includes(raw)) n++; });
    if (n) seen.set(path, (seen.get(path) || 0) + n);
  }
  return { checked: leaves.length, hits: [...seen].map(([path, files]) => ({ path, files })) };
}

/* a run of ten digits or more is not allowed in the source, but for what is plainly no number, each exception holding only its own case
   (none may admit a 10 to 15 digit account number): a run of zeros alone, which holds no number, or eight zeros then up to four more digits;
   an order id's stamp, fourteen digits that are a date and a time and the dash after them (the shape stmt/sw.js pins,
   ^[0-9]{14}-[a-z0-9]{1,8}$); a run id named in prose; a binary literal (0 and 1 only, after 0b: engine/qr.mjs, generated into the desk and
   stmt/qr.js, which cannot change without a version); a UUID (36 characters, 8-4-4-4-12 hex with dashes, as a whole token: a Cloudflare id
   in the docs); four constants, the fourth the floating point residue the engine's comment prints (engine/pricing.mjs, the same). A run
   touching a letter is read unless it is a hex digest (a hex token of 32 characters or more), a token with a letter on BOTH sides (a blob)
   or a 13-digit epoch (^1[6-8][0-9]{11}$). */
const CONSTANTS = new Set(["0123456789", "2166136261", "2147483647", "00000000000001"]);
const STAMP = /^20[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[0-9]{6}$/;
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const isLetter = (c) => /[A-Za-z]/.test(c || "");
const hexToken = (text, from, to) => { let a = from, b = to; while (a > 0 && /[0-9a-fA-F]/.test(text[a - 1])) a--; while (b < text.length && /[0-9a-fA-F]/.test(text[b])) b++; return b - a; };
const tokenAt = (text, from, to) => { let a = from, b = to; while (a > 0 && /[0-9A-Za-z-]/.test(text[a - 1])) a--; while (b < text.length && /[0-9A-Za-z-]/.test(text[b])) b++; return text.slice(a, b); };
const plainRun = (text, at, s) => {
  const before = text.slice(Math.max(0, at - 12), at), prev = text[at - 1], next = text[at + s.length];
  if (/^0+$/.test(s)) return true;   /* a run of zeros holds no number */
  if (/^0{8}[0-9]{0,4}$/.test(s) || CONSTANTS.has(s) || /\brun\s+(id\s+)?$/i.test(before) || (STAMP.test(s) && next === "-")) return true;
  if (/^[01]+$/.test(s) && /(^|[^0-9A-Za-z_])0b$/.test(before)) return true;
  if (UUID.test(tokenAt(text, at, at + s.length))) return true;
  if (!isLetter(prev) && !isLetter(next)) return false;
  return (isLetter(prev) && isLetter(next)) || hexToken(text, at, at + s.length) >= 32 || /^1[6-8][0-9]{11}$/.test(s);
};
export function longRuns(files) {
  const out = [];
  for (const f of files) {
    const re = /[0-9]{10,}/g; let m;
    while ((m = re.exec(f.text))) {
      if (plainRun(f.text, m.index, m[0])) continue;
      out.push({ path: f.path, line: f.text.slice(0, m.index).split("\n").length, len: m[0].length });
    }
  }
  return out;
}

export async function run({ ok, okOff, pageWork, KV }) {
  /* 06 Nov 2026: the writer (`paysync --numbers`), KV `paynum` and the route's old checks are retired with the road (his rule: the Counter's Worker reads
     Salt QR itself). The route, the reader and the practice accounts' invented details are test/pay-codes.mjs. What stays here is the sheet in jsdom, the
     leak scan and the source scan, below. Invented numbers, joined at run time. */
  const PS = await import("../tools/paysync.mjs"), CR = await import("../tools/stmt-crypto.mjs");
  const n1 = DIG("5550", "1234", "5678"), n2 = DIG("5550", "9999", "0001", "2");
  const stmtW = (await import("../stmt/worker.js")).default;
  const kv = new KV();
  const env = { STMT: kv, STMT_DESK_KEY: "desk-key" };

  /* ---- 5: the leak scan, on an invented pay store: a number as stored, closed up, regrouped, dashed or inside a longer run; a payload;
          a name in any case; a short code only as a whole number; and a report that names a field and a count, never a value */
  const store5 = { payee: "Invented Payee Sdn Bhd", owners: [{ name: "Invented Owner" }], accounts: [
    { key: "maybank", name: "Maybank", bank: "Maybank", sub: n1.slice(0, 4) + " " + n1.slice(4, 8) + " " + n1.slice(8), payload: "000201INVENTED", mid: "99911", holder: "Invented Holder" },
    { key: "ambank", name: "AmBank", bank: "AmBank", sub: n2, group: "Invented Group", tag: "Invented Tag", bankMark: "invmark", brand: "#123abc", maintenance: false }], groups: { biz: "Invented Group Label" }, seq: 5550, rev: 3, updated: "2026-10-11T04:00:00Z" };
  const scan = (text) => leakScan(store5, [{ path: "doc.md", text }]), fields = (r) => r.hits.map((h) => h.path).sort().join();
  const calm = scan("Maybank and AmBank are named, in the keys maybank and ambank; a figure of 1999112 and a count of 5550. The labels Invented Group, Invented Tag,"
    + " invmark and Invented Group Label, and the colour #123abc, only draw a tile. Written 2026-10-11T04:00:00Z.");
  ok(calm.checked === 7 && calm.hits.length === 0,
    "the scan reads the seven private values of an invented store, and finds none in a file that names only the banks, their keys, the labels that draw a tile and figures that merely look alike: " + JSON.stringify(calm));
  const forms = { stored: scan("pay into " + store5.accounts[0].sub + " today"), plain: scan("pay " + n1 + " today"), regrouped: scan("pay " + n1.slice(0, 4) + " " + n1.slice(4) + " today"),
    dashed: scan("pay " + n1.slice(0, 6) + "-" + n1.slice(6)), inside: scan("x9" + n1 + "9"), other: scan("and " + n2) };
  ok(Object.values(forms).every((r) => fields(r) === "accounts[].sub"),
    "a number is found as stored in groups, closed up, regrouped, with a dash, inside a longer run and for the other account too: " + JSON.stringify(Object.fromEntries(Object.entries(forms).map(([k, r]) => [k, fields(r)]))));
  const names = { owner: scan("Prepared by INVENTED OWNER Sdn."), payee: scan("invented payee sdn bhd"), holder: scan("the Invented Holder"), payload: scan("qr 000201invented"), code: scan("merchant 99911 at") };
  ok(fields(names.owner) === "owners[].name" && fields(names.payee) === "payee" && fields(names.holder) === "accounts[].holder" && fields(names.payload) === "accounts[].payload" && fields(names.code) === "accounts[].mid",
    "a name is found in any case, an owner, a payee and a holder each under its own field, with a payload and a short code as it stands: " + JSON.stringify(Object.fromEntries(Object.entries(names).map(([k, r]) => [k, fields(r)]))));
  const said = JSON.stringify([forms.stored, names.owner, names.payload, names.code]);
  ok(Object.keys(forms.stored.hits[0]).join() === "path,files" && Object.keys(forms.stored).join() === "checked,hits" && !said.includes(n1) && !/nvented|99911|000201|5550/.test(said),
    "and what it reports is a field and a count of files, never a value: " + said.replace(/[0-9]{5,}/g, "#"));

  /* the source scan: ten digits or more are no number only where the rule says so, and each exception holds only its own case */
  const runs = (text) => longRuns([{ path: "x.mjs", text }]);
  const N12 = DIG("5550", "1234", "5678"), E13 = DIG("1760", "1234", "5678", "9");   /* an invented 12-digit number; a 13-digit run led as an epoch is */
  const UU = "1ea7ed86-00d5-4e4e-8967-";   /* an invented UUID's first four groups */
  const allowed = { zeros: "0".repeat(12), zerosLong: "0".repeat(13), zerosForty: "0".repeat(40), zeroLed: DIG("00000000", "1234"), uuid: UU + DIG("8074", "0612", "64") + "b4", uuidDigits: UU + N12, stamp: DIG("2026", "1011", "123456") + "-k3f9", runId: "(run " + DIG("3604", "1951", "078") + ")",
    wrapped: "(run\n       " + DIG("3604", "1951", "078") + ")", digits: "0123456789", fnv: DIG("2166", "136261"), int: DIG("2147", "483647"), residue: DIG("0000", "0000", "0000", "01"),
    binary: "0b" + "10".repeat(6), epoch: "t" + E13, digest: N12 + "a".repeat(20), hexBoth: "a" + N12 + "f", blob: "q" + N12 + "z" };
  const refused = { odd: N12, longer: DIG("5550", "1234", "5678", "9012", "34"), stampLong: DIG("2026", "1011", "1234567"), badMonth: DIG("2026", "1311", "123456") + "-k3f9", rerun: "rerun " + DIG("3604", "1951", "078"),
    stop: "see." + N12, fraction: "3." + DIG("1415", "9265", "3589"), stampBare: DIG("2026", "1011", "123456"), stampSemi: DIG("2026", "1011", "123456") + "_k3f9", stampShort: DIG("2026", "1006", "080") + "-a1",
    stamp13: DIG("2026", "1011", "12345") + "-k3f9", letterBefore: "x" + N12, letterAfter: N12 + "x", hexBefore: "a" + N12, hexAfter: N12 + "f", hexShort: N12 + "a".repeat(19), epochBare: E13,
    epochOther: "t" + DIG("2760", "1234", "5678", "9"), epoch12: "t" + DIG("1760", "1234", "5678"), uuidLong: UU + N12 + "b4", uuidShortFirst: "1ea7ed8-00d5-4e4e-8967-" + N12, uuidPrefixed: "x" + UU + N12, uuidSuffixed: UU + N12 + "-1",
    uuidNonHex: UU + DIG("5550", "1234", "56") + "g8", onesLong: "1".repeat(40), zeroLedLong: DIG("00000000", "12345"), zeroLedLonger: DIG("00000000", "1234", "5678"),
    residueOther: DIG("0000", "0000", "0000", "02"), ones: "1".repeat(11), binaryNot: "0b" + "1".repeat(10) + "2", binaryBare: "b" + "1".repeat(11), binaryAfterWord: "x0b" + "1".repeat(11) };
  ok(Object.entries(allowed).every(([k, t]) => runs("n = " + t + ";").length === 0),
    "a run of ten digits is let through when it is all zeros or eight zeros and up to four digits, an order id's fourteen-digit stamp with its dash, a run id in prose, a binary literal, a UUID, one of four constants, or a hex digest, a blob with a letter each side or a 13-digit epoch: "
    + JSON.stringify(Object.entries(allowed).filter(([k, t]) => runs("n = " + t + ";").length).map(([k]) => k)));
  ok(Object.entries(refused).every(([k, t]) => runs("n = " + t + ";").length === 1),
    "and any other is refused: a stamp not fourteen digits, not a date or not followed by the dash, a run id that is no run id, a run after a full stop, a run beside one letter or a short hex token, an epoch with no letter or led otherwise, zeros that end in another digit past twelve, a run of ones, a near constant, a binary literal that is not one and an id that is not a whole UUID: "
    + JSON.stringify(Object.entries(refused).filter(([k, t]) => runs("n = " + t + ";").length !== 1).map(([k]) => k)));
  const where = longRuns([{ path: "dir/x.mjs", text: "a\nb\nn = " + refused.odd }]);
  ok(where.length === 1 && Object.keys(where[0]).join() === "path,line,len" && where[0].path === "dir/x.mjs" && where[0].line === 3 && where[0].len === 12,
    "a refused run is reported by its file, its line and its length, never its digits: " + JSON.stringify(where));

  /* ---- 6: a guest board is a page of prices that forbids script outright, and no filed number reaches it, nor the shut page */
  await kv.put("paycodes", JSON.stringify({ v: 1, at: Date.now(), accounts: [{ key: "maybank", acct: n1 }] }));
  await kv.put("g:aaaa-bbbb", JSON.stringify({ id: "aaaa-bbbb" }));
  await kv.put("guestboard", JSON.stringify({ week: { label: "Week of 05 Oct 2026" }, products: [{ product: "salt", unit: "unit", fellBack: false, sizes: [{ q: 1, price: 12.5 }, { q: 5, price: 55 }] }] }));
  const board = await stmtW.fetch(new Request("https://k7m3p2.example/g/aaaa-bbbb"), env), boardHtml = await board.text();
  const shutRes = await stmtW.fetch(new Request("https://k7m3p2.example/g/zzzz-zzzz"), env), shutHtml = await shutRes.text();
  ok(board.status === 200 && /RM 12\.50/.test(boardHtml) && /script-src 'none'/.test(board.headers.get("content-security-policy") || "") && !/<script/.test(boardHtml)
    && !/[0-9]{8}/.test(boardHtml) && !boardHtml.includes(n1.slice(0, 6)) && !boardHtml.includes("/pay/accounts"),
    "a guest board, with the numbers filed, still draws its prices, forbids script outright and carries no run of eight digits nor any of the filed number: " + board.status);
  ok(shutRes.status === 404 && /script-src 'none'/.test(shutRes.headers.get("content-security-policy") || "") && !/[0-9]{8}/.test(shutHtml) && !shutHtml.includes(n1.slice(0, 6)),
    "and the page every shut link answers is the same: no script, no run of eight digits, no filed number: " + shutRes.status);

  /* ---- 7: the scans on the repository itself */
  const srcFiles = trackedTexts(null, NOT_SCANNED), srcPaths = new Set(srcFiles.map((f) => f.path));
  const dirty = longRuns(srcFiles);
  ok(["stmt/page.js", "stmt/pay.js", "src/maker-inputs.js", "engine/pricing.mjs", "tools/paysync.mjs", "tools/testfix.mjs", "test/pay-number.mjs", "test/pay-number.mutations.json", "docs/STATEMENTS.md",
    ".github/workflows/ci.yml", "package.json"].every((p) => srcPaths.has(p)) && !["master/salt_command.html", "public/desk.html", "ledger/book.json", "MEMORY.md"].some((p) => srcPaths.has(p))
    && srcFiles.length > 300 && dirty.length === 0,
    "every tracked text file but master/, public/, ledger/, test/fixtures/ and MEMORY.md holds no run of ten digits that could be a number: " + srcFiles.length + " files read, " + dirty.length + " runs refused "
    + JSON.stringify(dirty.slice(0, 6)));
  if (PS.mastersPresent()) {
    const doc = JSON.parse(readFileSync(join(PS.PAY_MASTER, "accounts.json"), "utf8").replace(/^\uFEFF/, "")), tracked = trackedTexts(), found = leakScan(doc, tracked);
    ok(found.checked >= 5 && tracked.length > 100 && found.hits.length === 0,
      "no private value of the pay store, a number, member number, biller, reference, payload, holder, payee or owner, is in any tracked file, closed up or grouped: "
      + found.checked + " values read in " + tracked.length + " files, " + found.hits.length + " found " + JSON.stringify(found.hits));
  } else okOff(true, "the pay store is not on this machine, so no tracked file is checked against it");

  /* ---- 3: the sheet, through the generated page in jsdom with a stubbed fetch */
  const { landingPage } = await import("../stmt/page.js");
  const { PAY_ACCOUNTS } = await import("../stmt/pay.js");
  const PC = await import("../stmt/paycodes.js"), TXF = await import("../tools/testfix.mjs"), QRW = (await import("../stmt/qr.js")).default, CRCM = await import("../stmt/paycrc.js");
  const { JSDOM } = await import("jsdom");
  const { webcrypto } = await import("node:crypto");
  const BUILD = "a".repeat(16), UN = "abcd-efgh", NUMBER = DIG("5550", "1234", "5678", "9"), GROUPED = "5550 1234 5678 9";
  /* what GET /pay/accounts answers for the invented accounts (stmt/paycodes.js shapeAccounts), maybank with a number of this test's own */
  const INVD = TXF.invented(), SHAPED = PC.shapeAccounts(INVD.accounts, PAY_ACCOUNTS);
  const BASE = { maybank: Object.assign({}, SHAPED.maybank, { number: NUMBER }), instapay: SHAPED.instapay, ambank: { number: DIG("5550", "9999", "0001") } };
  const kl = (k) => new Date(Date.now() + 8 * 3600e3 + k * 864e5).toISOString().slice(0, 10);
  const tx = (e) => { if (!e) return ""; const c = e.cloneNode(true); c.querySelectorAll("svg").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
  const part = (i) => ({ date: kl(-9 + i), since: kl(-1), due: kl(2), late: false, rm: 100 + i, whole: 100 + i, product: "salt", qty: 1 + i, got: 1 + i, gotOn: kl(-1),
    resale: false, goods: 100 + i, deliv: 0, less: 0, rate: 100 });
  const wins = [];
  /* a customer's page signed in on an invented account owing three parts, 303 in all; `numbers` is what GET /pay/accounts answers, `down`
     a Worker that cannot be reached for it. `calls` is every request the page made, `copied` every string put on the clipboard. */
  const openPage = async ({ numbers = {}, down = false, live = null, canvas = false, share = null } = {}) => {
    const pass = "fixture-pass-7b", ck = await CR.contentKey("test-secret", UN), list = [part(0), part(1), part(2)], sum = 303;
    const pay = { term: 1, hide: 3, lock: 4, window: 60, now: { rm: sum, due: list[0].due, parts: list }, overdue: { rm: 0, parts: [] }, coming: { rm: 0, parts: [] } };
    const stamped = { at: new Date(Date.now() - 3600e3).toISOString(), body: "<p>Live</p>", owed: sum, pay, buildId: BUILD };
    const body = { ok: true, wrap: await CR.wrapKey(pass, ck), session: "sess-7b", liveStatus: "current",
      live: Object.assign({ at: stamped.at, buildId: BUILD }, await CR.encryptWith(ck, JSON.stringify(stamped))),
      env: await CR.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
    const calls = [], copied = [], fillRects = [], shares = [], downloads = []; let work, isDown = down, liveDown = live, hold = null;
    const dom = new JSDOM(landingPage(UN, "n7b", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.open = () => null;
      /* a canvas, drawn into a list of the rectangles painted; the share sheet and a download, recorded */
      win.HTMLCanvasElement.prototype.getContext = () => null;
      if (canvas) {
        win.HTMLCanvasElement.prototype.getContext = function () { const c = this; return { fillStyle: "", fillRect: (x, y, w, h) => { fillRects.push({ x, y, w, h, cw: c.width }); } }; };
        win.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,iVBORw0KGgo=";
        win.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new win.Blob(["png"], { type: "image/png" })); };
      }
      win.URL.createObjectURL = () => "blob:https://site.test/pay-code"; win.URL.revokeObjectURL = () => {};
      win.HTMLAnchorElement.prototype.click = function () { downloads.push({ href: this.getAttribute("href"), download: this.getAttribute("download") }); };
      if (share === "ok" || share === "abort") {
        Object.defineProperty(win.navigator, "canShare", { value: () => true, configurable: true });
        Object.defineProperty(win.navigator, "share", { value: async (d) => { shares.push(d); if (share === "abort") { const e = new Error("closed"); e.name = "AbortError"; throw e; } }, configurable: true });
      }
      Object.defineProperty(win.navigator, "clipboard", { value: { writeText: async (s) => { copied.push(String(s)); } }, configurable: true });
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET", b = init && init.body ? JSON.parse(init.body) : null;
        calls.push({ p, m, b });
        const res = (status, j) => ({ ok: status === 200, status, json: async () => j });
        if (p === "/open" || p === "/account") return res(200, body);
        if (p === "/orders" && m === "GET") return res(200, { ok: true, orders: [], claims: [] });
        if (p === "/pay/accounts") { if (hold) await hold.p; return isDown ? res(500, { ok: false }) : res(200, liveDown ? { ok: true, accounts: numbers, down: liveDown } : { ok: true, accounts: numbers }); }
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
    return { w, d, work, calls, copied, shares, downloads, fills: () => fillRects, sum, pick, way, go, up: () => { isDown = false; }, setLive: (x) => { liveDown = x; }, holdAsk: () => { let r; hold = { p: new Promise((y) => { r = y; }) }; return () => { const h = hold; hold = null; r(); return h; }; }, open: () => d.getElementById("payNow").click(), asked: () => calls.filter((c) => c.p === "/pay/accounts").length,
      posts: () => calls.filter((c) => c.m === "POST" && c.p === "/account/claim"), q: () => { try { return JSON.parse(w.localStorage.getItem("salt-stmt-payq") || "null"); } catch (e) { return null; } } };
  };
  const kind = (e) => (e ? e.tagName + (e.disabled ? " disabled" : "") : "(none)");
  try {
    /* the order of the sheet, none chosen, the pill waiting, What this pays shut */
    const A = await openPage({ numbers: BASE });
    A.open();
    const body = A.d.getElementById("payBody"), kids = [...body.children], at = (sel) => kids.findIndex((n) => n.matches(sel));
    const idx = ["#payInto", ".salt-kpi", ".payseg", "#payWhat", ".payhow", ".payref"].map(at);
    const tiles = [...body.querySelectorAll('#payInto input[name="payInto"]')], what = A.d.getElementById("payWhat");
    const offered = (rail, nums) => PAY_ACCOUNTS.filter((a) => a[rail] && !a.maintenance && nums[a.key] && (rail === "qr" ? nums[a.key].rows : rail === "transfer" ? nums[a.key].number : nums[a.key].biller)).map((a) => a.key);
    ok(idx.every((i) => i >= 0) && idx.every((i, k) => k === 0 || i > idx[k - 1]),
      "the sheet runs in this order: his banks, the figure, All or Part, What this pays, the way, then the details: " + JSON.stringify(idx));
    ok(tiles.map((r) => r.value).join() === offered("transfer", BASE).join() && tiles.length === 3 && tiles.every((r) => !r.checked) && kind(A.go()) === "BUTTON disabled" && tx(A.go()) === "I have paid",
      "his banks stand first as tiles, only those with a number to show and none suspended, none chosen, and the pill waits as I have paid: " + JSON.stringify([tiles.map((r) => r.value), kind(A.go()), tx(A.go())]));
    ok(!!what && !what.open && what.tagName === "DETAILS" && what.classList.contains("salt-plan") && tx(what.querySelector("summary")) === "What this pays"
      && what.querySelectorAll(".inv > .salt-ledger__row:not(.invt):not(.invtot)").length === 3,
      "What this pays is the Plan recipe's fold, shut, and holds the invoice's three lines: " + JSON.stringify([!!what, what && what.open]));
    const hows = [...A.d.querySelectorAll('#payBody input[name="payHow"]')].map((r) => r.value);
    ok(hows.join() === "transfer,qr,jompay", "the ways are Transfer, Scan a code and JomPAY, JomPAY because an account gives its biller code and Ref-1 (no cash on To pay now): " + hows.join());

    /* Transfer: the number in fours, the figure and the reference, each with Copy; the pill lights as I have paid */
    A.pick("maybank");
    const row = A.d.getElementById("payAcctNo"), rows = [...A.d.querySelectorAll("#payBody .payref > .salt-ledger__row")];
    const copyNo = row && row.querySelector("button"), copyAmt = rows[1] && rows[1].querySelector("button"), copyRef = rows[2] && rows[2].querySelector("button");
    ok(kind(A.go()) === "BUTTON" && tx(A.go()) === "I have paid" && A.go().classList.contains("salt-pill") && !!row && rows.length === 3 && rows[0] === row
      && tx(row.querySelector(".salt-ledger__label")) === "Account number" && tx(row.querySelector(".salt-ledger__value")) === GROUPED && tx(row.querySelector(".salt-ledger__flag")) === "Maybank"
      && tx(rows[1].querySelector(".salt-ledger__label")) === "Amount" && tx(rows[1].querySelector(".salt-ledger__value")) === "RM 303.00"
      && tx(rows[2].querySelector(".salt-ledger__label")) === "Reference" && tx(rows[2].querySelector(".salt-ledger__value")) === UN && /with the reference/.test(tx(A.d.querySelector("#payFoot .paycap"))),
      "choosing a bank lights the pill as I have paid, and Transfer shows three rows: the account number in groups of four with the bank's name, the amount, then the reference: "
      + JSON.stringify([kind(A.go()), tx(A.go()), row && tx(row.querySelector(".salt-ledger__value")), rows.length]));
    if (copyNo) copyNo.click();
    await until(() => A.copied.length >= 1 && !!tx(A.d.querySelector("#payBody .payref + .msg")), 40);
    const afterNo = A.copied.slice();
    if (copyAmt) copyAmt.click();
    await until(() => A.copied.length >= 2, 40);
    if (copyRef) copyRef.click();
    await until(() => A.copied.length >= 3, 40);
    ok(afterNo.join() === NUMBER && !/\s/.test(afterNo[0] || " ") && A.copied.join() === [NUMBER, "303.00", UN].join() && copyNo.getAttribute("aria-label") === "Copy the account number"
      && copyAmt.getAttribute("aria-label") === "Copy the amount" && tx(A.d.querySelector("#payBody .payref + .msg")) === "Copied.",
      "Copy puts the digits alone, the figure to the sen and the username on the clipboard, and the sheet says Copied: " + JSON.stringify(A.copied).replace(/[0-9]{9,}/g, "#"));
    ok(A.d.querySelectorAll("#paySheet a[href], #paySheet [target]").length === 0, "nothing on the sheet is a link: no anchor with an address and nothing that opens another window");

    /* a tap is 44px both ways: the tiles, Copy, the pill, Save and the fold's summary hold the design system's tap size */
    const cs = (e) => A.w.getComputedStyle(e);
    const tap = { tile: cs(A.d.querySelector("#payInto .salt-option__face")).minHeight, copy: cs(copyNo).minHeight + "|" + cs(copyNo).minWidth, pill: cs(A.go()).minHeight, summary: cs(what.querySelector("summary")).minHeight };
    ok(tap.tile === "var(--salt-tap)" && tap.copy === "var(--salt-tap)|var(--salt-tap)" && tap.pill === "var(--salt-tap)" && tap.summary === "var(--salt-tap)",
      "a tap is 44px both ways on the bank tiles, the Copy buttons, the pill and the fold's summary: " + JSON.stringify(tap));

    /* copying the number is leaving for the banking app (18 Oct 2026): the visit is kept for a reload, and coming back asks */
    const keptCopy = A.q();
    A.w.dispatchEvent(new A.w.Event("blur")); A.w.dispatchEvent(new A.w.Event("focus"));
    const backQ = tx(A.d.querySelector("#payBody .paycheck h3")), backSlipOrYes = !!A.d.getElementById("paySent");
    ok(!!keptCopy && keptCopy.away.amt === 303 && keptCopy.away.acct === "maybank" && keptCopy.away.rail === "transfer" && backQ === "Did you send RM 303.00?" && backSlipOrYes && A.posts().length === 0,
      "Copy on the account number keeps the visit, so back from the banking app the sheet asks Did you send, with nothing posted: " + JSON.stringify([keptCopy, backQ]));
    /* Show again is a button on the sheet, never a link: it brings back the same details, and Not yet goes back to the sheet */
    const again = A.d.getElementById("payAgain");
    ok(!!again && again.tagName === "BUTTON" && !again.getAttribute("href") && tx(again) === "Show account number again" && A.d.querySelectorAll("#paySheet a[href]").length === 0,
      "the check step's Show again is a button with no address, worded for the account number: " + JSON.stringify([again && again.tagName, again && tx(again)]));
    again.click();
    ok(!A.d.getElementById("paySent") && tx(A.d.getElementById("payAcctNo").querySelector(".salt-ledger__value")) === GROUPED && A.d.querySelector('#payBody input[name="payInto"]:checked').value === "maybank"
      && tx(A.go()) === "I have paid",
      "Show again redraws the sheet with the same account and number, the pill ready: " + JSON.stringify([!!A.d.getElementById("paySent"), !!A.d.getElementById("payAcctNo")]));

    /* I have paid goes straight to the question: asked once, with nothing posted, the claim posted on Yes (the visit Copy kept is dropped first, so what is kept is I have paid's own) */
    A.w.localStorage.removeItem("salt-stmt-payq");
    A.go().click();
    const asked = { q: tx(A.d.querySelector("#payBody .paycheck h3")), yes: tx(A.d.getElementById("paySent")), posted: A.posts().length, sheet: !A.d.getElementById("paySheet").hidden, q1: A.q() };
    ok(asked.q === "Did you send RM 303.00?" && asked.yes === "Yes, I sent RM 303.00" && asked.posted === 0 && asked.sheet,
      "I have paid goes straight to Did you send, asked once and with nothing posted: " + JSON.stringify(asked));
    const kept = asked.q1;
    ok(!!kept && Object.keys(kept).join() === "who,at,kind,id,away" && Object.keys(kept.away).join() === "amt,rail,acct" && kept.away.amt === 303 && kept.away.rail === "transfer" && kept.away.acct === "maybank"
      && !JSON.stringify(kept).includes(UN),
      "and the question is kept on the device, the way, the bank and the figure, never the username: " + JSON.stringify(kept));
    [...A.d.querySelectorAll("#payFoot button")].find((b) => tx(b) === "Not yet").click();
    ok(A.q() === null && tx(A.go()) === "I have paid" && !!A.d.getElementById("payAcctNo") && A.posts().length === 0,
      "Not yet goes back to the sheet with the number still there and nothing recorded, and the kept question is dropped");
    A.go().click();
    A.d.getElementById("paySent").click();
    await until(() => A.posts().length === 1 && A.d.getElementById("paySheet").hidden);
    const claim = A.posts()[0] && A.posts()[0].b;
    ok(A.posts().length === 1 && !!claim && Object.keys(claim).sort().join() === "account,amount,method,rid" && claim.amount === 303 && claim.method === "transfer" && claim.account === "maybank" && !!claim.rid,
      "Yes posts the claim as it always did, the figure, the way, the bank and an id, to the account: " + JSON.stringify(claim));

    /* Part of it: the figure typed is the figure the amount row shows and copies, the question asks and the claim carries */
    A.open(); A.pick("maybank");
    [...A.d.querySelectorAll("#payBody .payseg button")].find((b) => tx(b) === "Part of it").click();
    const amt = A.d.getElementById("payAmt"); amt.value = "40"; amt.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    const partRow = tx(A.d.querySelector("#payAmtRow .salt-ledger__value"));
    A.copied.length = 0; A.d.querySelector("#payAmtRow button").click(); await until(() => A.copied.length >= 1, 40);
    A.go().click();
    const partQ = tx(A.d.querySelector("#payBody .paycheck h3"));
    A.d.getElementById("paySent").click();
    await until(() => A.posts().length === 2);
    ok(partRow === "RM 40.00" && A.copied.join() === "40.00" && partQ === "Did you send RM 40.00?" && A.posts()[1].b.amount === 40,
      "Part of it: the amount row reads and copies the part typed, and the question and the claim ask for it: " + JSON.stringify([partRow, A.copied, partQ, A.posts()[1] && A.posts()[1].b.amount]));

    /* Show again keeps a part: the part typed is the figure on the sheet again, in the box and in the amount row */
    A.open(); A.pick("maybank");
    [...A.d.querySelectorAll("#payBody .payseg button")].find((b) => tx(b) === "Part of it").click();
    const amt2 = A.d.getElementById("payAmt"); amt2.value = "25"; amt2.dispatchEvent(new A.w.Event("input", { bubbles: true }));
    A.d.querySelector("#payAcctNo button").click(); await until(() => !!A.q(), 40);
    A.w.dispatchEvent(new A.w.Event("blur")); A.w.dispatchEvent(new A.w.Event("focus"));
    const partAsk = tx(A.d.querySelector("#payBody .paycheck h3"));
    A.d.getElementById("payAgain").click();
    ok(partAsk === "Did you send RM 25.00?" && tx(A.d.querySelector("#payAmtRow .salt-ledger__value")) === "RM 25.00" && A.d.getElementById("payAmt") && A.d.getElementById("payAmt").value === "25.00",
      "Show again after a part brings the part back, in the box and in the amount row: " + JSON.stringify([partAsk, tx(A.d.querySelector("#payAmtRow .salt-ledger__value"))]));
    A.d.getElementById("payX").click();

    /* a bank with no number to show is not offered on Transfer, and with the Worker unreachable the sheet says so and offers none */
    const tilesOf = (X) => [...X.d.querySelectorAll('#payBody input[name="payInto"]')].map((r) => r.value);
    const E = await openPage({ numbers: { maybank: { number: "12345678" }, ambank: { number: NUMBER } } }), D = await openPage({ down: true, numbers: BASE });
    E.open(); D.open(); await D.work.quiet(); await until(() => !!D.d.getElementById("payNone"), 60);
    ok(tilesOf(E).join() === "ambank" && tilesOf(D).length === 0 && kind(D.go()) === "BUTTON disabled" && tx(D.d.getElementById("payNone")) === "We cannot show our accounts right now. Close this and try again in a moment.",
      "a number the page will not draw is not offered, and with the Worker unreachable the sheet offers no account, says so in one line and keeps the pill dark: " + JSON.stringify([tilesOf(E), tilesOf(D)]));
    const askedDown = D.asked();
    D.d.getElementById("payX").click(); E.d.getElementById("payX").click();
    /* and an answer that did not come is asked for again at the next open, so the number appears once the Worker is back */
    D.up(); D.open(); await until(() => D.asked() > askedDown, 60); await D.work.quiet(); D.pick("maybank");
    ok(askedDown >= 1 && D.asked() === askedDown + 1 && !!D.d.getElementById("payAcctNo") && tx(D.go()) === "I have paid",
      "a failed ask is made again at the next open, and the number shows once the Worker answers: " + JSON.stringify([askedDown, D.asked(), !!D.d.getElementById("payAcctNo")]));
    D.d.getElementById("payX").click();

    /* SCAN A CODE: the code drawn on the sheet from its modules. Without a canvas the same rects stand as an svg; with one, a PNG picture */
    const runsOf = (rws) => { let n = 0; rws.forEach((r) => { n += (r.match(/1+/g) || []).length; }); return n; };
    const MAYROWS = BASE.maybank.rows, wantRuns = runsOf(MAYROWS);
    const F = await openPage({ numbers: BASE });
    F.open(); F.way("qr");
    const scanTiles = tilesOf(F);
    ok(scanTiles.join() === offered("qr", BASE).join() && !scanTiles.includes("wise") && scanTiles.includes("maybank") && !F.d.querySelector(".paycode") && kind(F.go()) === "BUTTON disabled",
      "on Scan a code the tiles are the accounts that gave a code and no code is drawn until one is chosen: " + JSON.stringify(scanTiles));
    F.pick("maybank");
    const panel = F.d.querySelector("#payBody .paycode"), svg = panel && panel.querySelector(".salt-qr__code svg"), nrow = MAYROWS.length + 8;
    ok(!!panel && panel.classList.contains("salt-qr") && !!svg && svg.getAttribute("viewBox") === "0 0 " + nrow + " " + nrow && svg.querySelectorAll("g rect").length === wantRuns
      && tx(panel.querySelector(".salt-qr__title")) === "Maybank" && tx(panel.querySelector(".salt-qr__caption")) === "DuitNow QR" && svg.getAttribute("aria-label") === "The DuitNow QR code for Maybank",
      "the code is the QR panel with one rect a run of dark modules and four modules of quiet round it, titled with the account: " + JSON.stringify([!!panel, svg && svg.querySelectorAll("g rect").length, wantRuns]));
    const scanRows = [...F.d.querySelectorAll("#payBody .payref > .salt-ledger__row")].map((r) => tx(r.querySelector(".salt-ledger__label")));
    ok(scanRows.join() === "Amount,Reference" && !F.d.getElementById("payAcctNo") && !new RegExp(NUMBER.slice(0, 8)).test(F.d.getElementById("paySheet").textContent.replace(/\s/g, "")) && tx(F.go()) === "I have paid" && kind(F.go()) === "BUTTON"
      && /^Pay it from your banking app[.]/.test(tx(F.d.querySelector("#payFoot .paycap"))) && tx(F.d.getElementById("paySave")) === "Save the code" && /cannot scan its own screen/.test(tx(F.d.querySelector("#paySave + p"))),
      "a code shows the amount and the reference, no account number, Save the code and its one-sentence hint, and the pill is I have paid: " + JSON.stringify(scanRows));
    ok(F.d.querySelectorAll("#paySheet a[href], #paySheet [target]").length === 0 && F.d.querySelectorAll("#paySheet img").length === 0, "and no link, and with no canvas no picture, only the drawn rects");
    F.d.getElementById("payX").click();
    /* a code the Worker sends malformed is not drawn: ragged rows, a character that is no module, too few rows, an account not in the list */
    const ragged = MAYROWS.slice(); ragged[3] = ragged[3].slice(1);
    const bad = await openPage({ numbers: { maybank: Object.assign({}, BASE.maybank, { rows: ragged }), instapay: Object.assign({}, BASE.instapay, { rows: BASE.instapay.rows.map((r, i) => i === 0 ? r.replace(/./, "x") : r) }),
      ambank: Object.assign({}, BASE.maybank, { rows: Array(10).fill("10".repeat(5)) }), gx: Object.assign({}, BASE.maybank, { rows: Array(74).fill("10".repeat(37)) }), boostbank: { number: NUMBER } } });
    bad.open(); bad.way("qr");
    ok(tilesOf(bad).length === 0, "rows that are ragged, hold a character that is no module or are too few are not drawn, and the account is not offered on the code: " + JSON.stringify(tilesOf(bad)));
    bad.d.getElementById("payX").click();

    /* with a canvas the same modules are painted onto it and the code stands as a PNG picture a long press can save; Save offers the file */
    const C1 = await openPage({ numbers: BASE, canvas: true, share: "ok" });
    C1.open(); C1.way("qr"); C1.pick("maybank");
    const img = C1.d.querySelector("#payBody .paycode .salt-qr__code img"), fills = C1.fills();
    ok(!!img && /^data:image[/]png;base64,/.test(img.getAttribute("src")) && !C1.d.querySelector(".paycode svg") && img.getAttribute("alt") === "The DuitNow QR code for Maybank"
      && fills.length === 1 + wantRuns && fills[0].w === (nrow) * 8 && fills.slice(1).every((f) => f.h === 8 && f.w % 8 === 0) && fills.slice(1).reduce((n, f) => n + f.w / 8, 0) === MAYROWS.join("").split("1").length - 1,
      "with a canvas the code is a data: PNG picture, never a blob, painted from the same runs, eight pixels a module: " + JSON.stringify([!!img, fills.length, wantRuns]));
    C1.d.getElementById("paySave").click(); await until(() => C1.shares.length >= 1 && !!C1.d.querySelector("#payBody .payref + .msg"), 60);
    const sh = C1.shares[0], saved = C1.q();
    ok(C1.shares.length === 1 && sh.files.length === 1 && sh.files[0].type === "image/png" && /[.]png$/.test(sh.files[0].name) && !/[0-9]{4}/.test(sh.files[0].name) && C1.downloads.length === 0
      && tx(C1.d.querySelector("#payBody .payref + .msg")) === "Saved." && !!saved && saved.away.rail === "qr" && saved.away.acct === "maybank",
      "Save the code offers the picture through the phone's share sheet as a PNG file, says Saved, and marks the visit away as Copy does: " + JSON.stringify([C1.shares.length, sh && sh.files.map((f) => f.type + ":" + f.name), saved && saved.away]));
    C1.d.getElementById("payX").click();
    const C2 = await openPage({ numbers: BASE, canvas: true, share: "none" });
    C2.open(); C2.way("qr"); C2.pick("maybank"); C2.d.getElementById("paySave").click(); await until(() => C2.downloads.length >= 1, 60);
    ok(C2.downloads.length === 1 && C2.downloads[0].download === "pay-code.png" && /^blob:/.test(C2.downloads[0].href) && C2.shares.length === 0 && C2.q() && C2.q().away.rail === "qr",
      "where the phone cannot share a file, Save the code downloads the PNG from a blob address, and marks the visit away: " + JSON.stringify(C2.downloads));
    C2.d.getElementById("payX").click();
    const C3 = await openPage({ numbers: BASE, canvas: true, share: "abort" });
    C3.open(); C3.way("qr"); C3.pick("maybank"); C3.d.getElementById("paySave").click(); await until(() => C3.shares.length >= 1, 60); await C3.work.quiet();
    ok(C3.shares.length === 1 && C3.downloads.length === 0 && C3.q() === null && !tx(C3.d.querySelector("#payBody .payref + .msg")),
      "a share sheet they close saves nothing, downloads nothing, marks nothing and says nothing");
    C3.d.getElementById("payX").click();

    /* THE DRAWN CODE DECODES, at the size the sheet shows on a 390px phone (the sheet's gutters and the panel's padding leave 314px). The page's own rects
       (the svg where there is no canvas, the canvas's fills where there is) are laid onto a pixel buffer at that size and read by jsQR, vendored for the
       suite alone (test/vendor, never shipped); what comes back must be the invented payload to the byte. A real browser's own picture is read in the
       Browser pane (docs/WORKING.md). */
    const JSQR = await (async () => { const g = {}; new Function("self", readFileSync(join(REPO, "test", "vendor", "jsqr.js"), "utf8"))(g); return g.jsQR; })();
    const SHEET_PX = 390 - 2 * 16 - 2 * 22;
    const raster = (rects, span, px) => {   /* rects in module units over a span-square canvas, drawn dark on white at px by px */
      const data = new Uint8ClampedArray(px * px * 4).fill(255), e = (v) => Math.round(v * px / span);
      for (const r of rects) for (let y = e(r.y); y < e(r.y + r.h); y++) for (let x = e(r.x); x < e(r.x + r.w); x++) { const i = (y * px + x) * 4; data[i] = 11; data[i + 1] = 18; data[i + 2] = 21; }
      return { data, width: px, height: px };
    };
    const svgRects = (svgEl) => [...svgEl.querySelectorAll("g rect")].map((r) => ({ x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height") }));
    const Q1 = await openPage({ numbers: BASE });
    Q1.open(); Q1.way("qr"); Q1.pick("maybank");
    const dec1 = JSQR(raster(svgRects(Q1.d.querySelector("#payBody .paycode svg")), nrow, SHEET_PX).data, SHEET_PX, SHEET_PX);
    ok(!!dec1 && dec1.data === INVD.accounts[0].payload, "the code the sheet draws without a canvas decodes at 314px, the width it has on a 390px phone, to the account's payload: " + (dec1 ? dec1.data.length + " bytes" : "no code read"));
    Q1.d.getElementById("payX").click();
    const Q2 = await openPage({ numbers: BASE, canvas: true });
    Q2.open(); Q2.way("qr"); Q2.pick("maybank");
    const cf = Q2.fills(), dec2 = JSQR(raster(cf.slice(1).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h })), cf[0].w, SHEET_PX).data, SHEET_PX, SHEET_PX);
    ok(!!dec2 && dec2.data === INVD.accounts[0].payload, "and the picture painted on the canvas decodes at that width too: " + (dec2 ? dec2.data.length + " bytes" : "no code read"));
    Q2.d.getElementById("payX").click();
    /* the longest payload Salt QR holds is 216 bytes (version 11): at 314px a module is 4.5px, and it still decodes */
    const big = (() => { const tl = (g, v) => g + String(v.length).padStart(2, "0") + v, f = "INVENTED-FILLER-FOR-A-LONG-CODE-".repeat(3);
      const body = tl("00", "01") + tl("01", "12") + tl("26", tl("00", "com.example.invented") + tl("01", DIG("9990", "0000", "0001"))) + tl("27", f) + tl("28", f) + tl("52", "5499") + tl("53", "458")
        + tl("58", "MY") + tl("59", "INVENTED LONG") + tl("60", "KUALA LUMPUR") + "6304"; return body + CRCM.crc16(body); })();
    const bigRows = QRW.qrMatrix(big).map((r) => r.join("")), bigSpan = bigRows.length + 8;
    const bigRects = []; bigRows.forEach((r, y) => { for (let x = 0; x < r.length;) { if (r[x] !== "1") { x++; continue; } let w = 1; while (r[x + w] === "1") w++; bigRects.push({ x: x + 4, y: y + 4, w, h: 1 }); x += w; } });
    const dec3 = JSQR(raster(bigRects, bigSpan, SHEET_PX).data, SHEET_PX, SHEET_PX);
    ok(big.length >= 200 && !!dec3 && dec3.data === big, "a payload of " + big.length + " bytes (about the longest Salt QR holds), " + bigSpan + " modules across, decodes at 314px: " + (dec3 ? "read" : "not read"));

    /* A PRACTICE ACCOUNT'S SHEET: the route answers its invented details from its fixture (stmt/testfix.js examplePay), and the sheet draws the maybank code and
       shows instapay's JomPAY details, every value invented */
    const P = await openPage({ numbers: PC.shapeAccounts(INVD.accounts, PAY_ACCOUNTS), live: INVD.down });
    P.open(); P.way("qr"); P.pick("maybank");
    const pd = JSQR(raster(svgRects(P.d.querySelector("#payBody .paycode svg")), nrow, SHEET_PX).data, SHEET_PX, SHEET_PX);
    P.way("jompay"); P.pick("instapay");
    const pj = [...P.d.querySelectorAll("#payBody .payref .salt-ledger__value")].map((v) => tx(v));
    ok(!!pd && /INVENTED SHOP/.test(pd.data) && pj[0] === INVD.accounts[1].biller && pj[1] === INVD.accounts[1].ref1 && pj[2] === "Leave it empty" && tilesOf(P).join() === "instapay",
      "a practice account's sheet draws maybank's invented code, which reads back as the invented shop, and shows instapay's invented biller code and Ref-1: " + JSON.stringify([pd && pd.data.length, tilesOf(P)]));
    P.d.getElementById("payX").click();

    /* JOMPAY: the biller code and Ref-1 with Copy, Ref-2 left empty, the figure, and no username anywhere beside it */
    const J = await openPage({ numbers: BASE });
    J.open(); J.way("jompay");
    ok(tilesOf(J).join() === "instapay" && !J.d.getElementById("payBiller") && kind(J.go()) === "BUTTON disabled", "JomPAY offers the accounts that gave a biller code and Ref-1, and shows nothing until one is chosen: " + JSON.stringify(tilesOf(J)));
    J.pick("instapay");
    const jr = [...J.d.querySelectorAll("#payBody .payref > .salt-ledger__row")], JB = BASE.instapay.biller, J1 = BASE.instapay.ref1;
    ok(jr.map((r) => tx(r.querySelector(".salt-ledger__label"))).join() === "Biller code,Ref-1,Ref-2,Amount" && tx(jr[0].querySelector(".salt-ledger__value")) === JB && tx(jr[1].querySelector(".salt-ledger__value")) === J1
      && tx(jr[2].querySelector(".salt-ledger__value")) === "Leave it empty" && !jr[2].querySelector("button") && !!jr[0].querySelector("button") && !!jr[1].querySelector("button") && !!jr[3].querySelector("button")
      && !J.d.getElementById("payRef") && /biller code and Ref-1/.test(tx(J.d.querySelector("#payFoot .paycap"))) && !J.d.getElementById("paySheet").textContent.includes(UN) && tx(J.go()) === "I have paid" && kind(J.go()) === "BUTTON" && !J.d.querySelector(".paycode"),
      "JomPAY shows Biller code and Ref-1 with Copy, Ref-2 as Leave it empty, then the amount, with no reference and no username on the sheet, and the pill is I have paid: " + JSON.stringify(jr.map((r) => tx(r))));
    J.copied.length = 0;
    for (const i of [0, 1, 3]) { jr[i].querySelector("button").click(); await until(() => J.copied.length >= (i === 0 ? 1 : i === 1 ? 2 : 3), 40); }
    ok(J.copied.join() === [JB, J1, "303.00"].join() && jr[0].querySelector("button").getAttribute("aria-label") === "Copy the biller code" && jr[1].querySelector("button").getAttribute("aria-label") === "Copy Ref-1",
      "Copy puts the biller code, Ref-1 and the figure on the clipboard: " + JSON.stringify(J.copied).replace(/[0-9]{9,}/g, "#"));
    J.go().click();
    const jq = { q: tx(J.d.querySelector("#payBody .paycheck h3")), line: tx(J.d.querySelector("#payBody .paycheck .sub2")), again: tx(J.d.getElementById("payAgain")), kept: J.q() };
    ok(jq.q === "Did you send RM 303.00?" && jq.line === "By JomPAY to Instapay." && jq.again === "Show the JomPAY details again" && jq.kept && jq.kept.away.rail === "jompay" && !J.d.querySelector("#paySheet a[href]"),
      "the question after JomPAY says it was by JomPAY, without the username, and its Show again is its own words: " + JSON.stringify(jq));
    J.d.getElementById("payAgain").click();
    ok(!!J.d.getElementById("payBiller") && tx(J.d.getElementById("payBiller").querySelector(".salt-ledger__value")) === JB && J.d.querySelector('#payBody input[name="payHow"]:checked').value === "jompay"
      && J.d.querySelector('#payBody input[name="payInto"]:checked').value === "instapay", "Show again brings back the JomPAY details with the way and the account as they were");
    J.go().click(); J.d.getElementById("paySent").click(); await until(() => J.posts().length === 1);
    ok(J.posts()[0].b.method === "jompay" && J.posts()[0].b.account === "instapay" && J.posts()[0].b.amount === 303 && !JSON.stringify(J.posts()[0].b).includes(UN), "and Yes claims it by jompay at that account");
    /* JomPAY is not offered with no account giving its pair, and falls back to Transfer if the pair goes while it is chosen */
    const NJ = await openPage({ numbers: { maybank: BASE.maybank, instapay: { rows: BASE.instapay.rows, number: BASE.instapay.number, biller: JB } } });
    NJ.open();
    ok([...NJ.d.querySelectorAll('#payBody input[name="payHow"]')].map((r) => r.value).join() === "transfer,qr", "JomPAY is not offered when no account gives both its biller code and Ref-1");
    J.d.getElementById("payX").click();
    const K = await openPage({ numbers: BASE });
    const realNow = K.w.Date.now.bind(K.w.Date); K.w.Date.now = () => realNow() + 61000;
    K.open(); await K.work.quiet(); K.way("jompay"); K.pick("instapay"); K.setLive({ instapay: true });
    const k0 = K.asked(); K.d.getElementById("payX").click(); K.w.Date.now = () => realNow() + 122000; K.open(); K.way("jompay");
    await until(() => K.asked() > k0, 60); await K.work.quiet(); await until(() => !K.d.querySelector('#payBody input[name="payHow"][value="jompay"]'), 60);
    ok(!K.d.querySelector('#payBody input[name="payHow"][value="jompay"]') && (K.d.querySelector('#payBody input[name="payHow"]:checked') || {}).value === "transfer" && !K.d.getElementById("payBiller"),
      "when the JomPAY account goes down while JomPAY is chosen, the option goes and the sheet falls back to Transfer, showing none of its details: " + JSON.stringify([k0, K.asked(), [...K.d.querySelectorAll('#payBody input[name="payHow"]')].map((r) => r.value + (r.checked ? "*" : ""))]));
    K.d.getElementById("payX").click();

    /* What this pays stays as they left it across a redraw, and the numbers are asked once a visit */
    const G = await openPage({ numbers: BASE });
    G.open();
    let toggled = false; G.d.getElementById("payWhat").addEventListener("toggle", () => { toggled = true; });
    G.d.getElementById("payWhat").querySelector("summary").click();
    await until(() => toggled, 60);
    G.pick("maybank");
    const kept2 = G.d.getElementById("payWhat");
    G.d.getElementById("payX").click(); G.open(); G.d.getElementById("payX").click(); G.open();
    ok(!!kept2 && kept2.open && !G.d.getElementById("payWhat").open && G.asked() === 1,
      "What this pays stays open across a redraw of the sheet and opens shut with the sheet, and across three openings the numbers were asked once: " + JSON.stringify([kept2 && kept2.open, G.d.getElementById("payWhat").open, G.asked()]));

    /* THE LIVE STATE ON THE SHEET (17 Oct 2026): an account the Worker says is down is not offered, one it has back up is, and a bank chosen
       before the answer came is unchosen when it turns out to be down; a minute on, the next open asks again */
    const H = await openPage({ numbers: BASE, live: { maybank: true, spay: false } });
    H.open(); await H.work.quiet(); await until(() => !tilesOf(H).includes("maybank"), 60);
    ok(!tilesOf(H).includes("maybank") && tilesOf(H).includes("instapay") && tilesOf(H).includes("ambank"),
      "an account the Worker has down now is not offered, and one it has back up is: " + JSON.stringify(tilesOf(H)));
    H.d.getElementById("payX").click();
    const I = await openPage({ numbers: BASE });
    const realNow2 = I.w.Date.now.bind(I.w.Date), asked0 = I.asked(); I.w.Date.now = () => realNow2() + 61000;
    const let_go = I.holdAsk(); I.open(); I.pick("maybank"); I.setLive({ maybank: true }); const held = I.asked() === asked0 + 1 && tilesOf(I).includes("maybank");
    await let_go().p; await I.work.quiet();
    await until(() => !tilesOf(I).includes("maybank"), 60);
    ok(held && !tilesOf(I).includes("maybank") && !I.d.querySelector('#payBody input[name="payInto"]:checked') && !I.d.getElementById("payAcctNo") && kind(I.go()) === "BUTTON disabled",
      "a bank chosen before the answer came, which the Worker has down, is no longer offered, none of its details is drawn and the pill goes dark: " + JSON.stringify([tilesOf(I), kind(I.go()), held]));
    I.d.getElementById("payX").click(); const before = I.asked();
    I.setLive({ maybank: false }); I.w.Date.now = () => realNow2() + 122000;
    I.open(); await until(() => I.asked() > before, 60); await I.work.quiet(); await until(() => tilesOf(I).includes("maybank"), 60);
    ok(I.asked() === before + 1 && tilesOf(I).includes("maybank"), "a minute on, the next open asks again and an account back up is offered again: " + JSON.stringify([before, I.asked(), tilesOf(I)]));
    I.d.getElementById("payX").click();

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
