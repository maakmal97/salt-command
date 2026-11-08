/* test/pay-leak.mjs: A CUSTOMER NEVER LEARNS THAT SALT QR EXISTS (his rule of 06 Nov 2026, plan draft 5 P2, P3 and P7).
 *
 * The Counter's pay sheet draws the code and the numbers itself from what its own Worker answers at GET /pay/accounts, and links nowhere. So no address, Worker
 * name or name of Salt QR may reach the page a customer is served, the script it runs (comments in CLIENT_JS are served), the words it shows or any answer a customer's
 * session gets; the sheet's own source holds no link, window or address; and the generated rails (stmt/pay.js) carry no address.
 *   1  the served pages, every word, and the generated rails
 *   2  the sheet's source: no link, no window, no address
 *   3  every answer on a customer's session, a real account's, a practice account's and one with Salt QR failing with its own name in the error
 * Each check is proved red by its own mutation (test/pay-leak.mutations.json, run with tools/section.mjs). Every value here is invented. */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIG = (...p) => p.join("");
/* the names a customer must never meet: Salt QR's two names, a Worker address, the binding, the old link and its words, and the Worker's own name, read from
   the binding's config here so this file holds no copy of it */
const cfg = readFileSync(join(REPO, "wrangler.stmt.jsonc"), "utf8");
const live = (/"binding"\s*:\s*"QRCMD"\s*,\s*"service"\s*:\s*"([^"]+)"/.exec(cfg) || [])[1] || "";
const NAMES = new RegExp(["QR Command", "Salt QR", "workers[.]dev", "payment page", "qr-command", "QRCMD", "payHref", "PAY_SITE"].concat(live ? [live] : []).join("|"), "i");

export async function run({ ok, KV }) {
  const P = await import("../stmt/page.js");
  const W = await import("../stmt/words.js");
  const TX = await import("../tools/testfix.mjs");
  const TF = await import("../stmt/testfix.js");
  const O = await import("../stmt/orders.js");
  const stmtW = (await import("../stmt/worker.js")).default;
  const { PAY_ACCOUNTS } = await import("../stmt/pay.js");
  const names = (s) => { const m = NAMES.exec(s); return m ? m[0] : null; };

  /* ---- 1: the served pages, every word, and the rails */
  const pages = {
    "the customer's page": P.landingPage("abcd-efgh", "n1", null),
    "the practice page": P.landingPage("0000-0000", "n2", null, null, true),
    "his read-only view": P.landingPage("", "n3", { master: "fixture-master", accounts: [{ code: "CX1-ZED", username: "abcd-efgh" }] })
  };
  const hit = Object.entries(pages).map(([k, h]) => [k, names(h)]).filter(([, m]) => m);
  ok(Object.values(pages).every((h) => h.length > 100000 && h.includes("payBody")) && hit.length === 0,
    "no page served to a customer names Salt QR, its Worker, its address or the payment page, scripts and comments included: " + Object.entries(pages).map(([k, h]) => k + " " + h.length).join(", ") + " " + JSON.stringify(hit));
  ok(names(JSON.stringify(W.EN)) === null && names(JSON.stringify(W.WORDS || {})) === null, "no word in the table the page shows names it either");
  const rails = readFileSync(join(REPO, "stmt", "pay.js"), "utf8"), sync = readFileSync(join(REPO, "tools", "paysync.mjs"), "utf8");
  ok(!names(rails) && !/qyts8mh72kyg|https?:/.test(rails) && !/export\s+function|payHref|PAY_SITE/.test(rails) && /export const PAY_ACCOUNTS/.test(rails) && !/paySiteUrl|WORKERS_SUBDOMAIN|PAY_HREF/.test(sync),
    "the generated rails carry names and flags only, no address and no link builder, and the tool no longer reads Salt QR's address");
  ok(live.length > 6 && NAMES.test("x " + live + " y") && NAMES.test("a QR Command b") && !NAMES.test("a pay sheet b"),
    "the scan is live: it finds the Worker's own name, read from the binding (" + live.length + " characters), and Salt QR's names, and passes a plain word");

  /* ---- 2: the sheet's source, from its comment to the claim: no link, no window, no address */
  const page = readFileSync(join(REPO, "stmt", "page.js"), "utf8");
  const a = page.indexOf("redrawn 06 Nov 2026) ---"), b = page.indexOf("async function claimSend()");
  const sheet = page.slice(a, b);
  ok(a > 0 && b > a && sheet.length > 15000 && !/window[.]open|[.]target\s*=|setAttribute\('target'|[.]rel\s*=|location[.](href|assign|replace)|https?:\/\/(?!www[.]w3[.]org\/2000\/svg)/.test(sheet),
    "the sheet's source opens no window, sets no target, moves no location and holds no address (only the SVG namespace): " + sheet.length + " characters read");
  const hrefs = sheet.match(/[.]href\s*=[^;]*;/g) || [];
  ok(hrefs.length === 1 && /^[.]href=u;$/.test(hrefs[0]) && /var u=URL[.]createObjectURL\(f\)/.test(sheet),
    "the one address the sheet sets is the blob of the PNG it has just made, for Save the code's download: " + JSON.stringify(hrefs));
  ok(!/<a[ >]/.test(sheet) && (sheet.match(/el\('a'/g) || []).length === 0, "and the sheet draws no anchor of its own");

  /* ---- 3: every answer on a customer's session */
  const text = "self.QR_CODES = " + JSON.stringify([{ key: "maybank", payload: TX.inventedPayload(DIG("8880", "0000", "0001"), "INVENTED ONE"), acct: DIG("8880", "0000", "0001"), bank: "Maybank", biller: "", ref1: "" }]) + ";\nself.QR_BUILD = \"invented\";\n";
  const mk = (answer) => ({ fetch: async (u) => { if (answer instanceof Error) throw answer; return typeof answer === "function" ? answer(String(u)) : answer; } });
  const env0 = { STMT_DESK_KEY: "desk-key" }, call = async (env, path, headers) => {
    const r = await stmtW.fetch(new Request("https://k7m3p2.example" + path, { headers }), env), raw = await r.text();
    return { status: r.status, raw, headers: [...r.headers.entries()].map((e) => e.join(": ")).join("\n") };
  };
  const sess = async (env, u) => ({ "X-Stmt-Session": await O.mintSession(env, u) });
  const E1 = Object.assign({}, env0, { STMT: new KV(), QRCMD: mk((u) => (/data[.]js$/.test(u) ? new Response(text) : new Response(JSON.stringify({ maintenance: { ambank: false }, order: [] })))) });
  const r1 = await call(E1, "/pay/accounts", await sess(E1, "abcd-efgh"));
  const E2 = Object.assign({}, env0, { STMT: new KV(), QRCMD: mk(new Error("Salt QR at jb3zkzyqguu5.qyts8mh72kyg.workers.dev refused: QR Command is down")) });
  const r2 = await call(E2, "/pay/accounts", await sess(E2, "abcd-efgh"));
  const E3 = Object.assign({}, env0, { STMT: new KV(), QRCMD: mk(new Response("Salt QR says: the payment page is down at qr-command", { status: 500 })) });
  const r3 = await call(E3, "/pay/accounts", await sess(E3, "abcd-efgh"));
  const T = TF.TEST_USER, E4 = Object.assign({}, env0, { STMT: new KV(), QRCMD: mk(new Error("QR Command")) });
  await E4.STMT.put("u:" + T, JSON.stringify({ test: true, wrap: { salt: "pl-salt" } }));
  await E4.STMT.put(TF.fixKey(T), JSON.stringify({ v: TF.FIX_VERSION, salt: "pl-salt", at: "2026-11-06T00:00:00.000Z", pay: TX.invented() }));
  const r4 = await call(E4, "/pay/accounts", await sess(E4, T));
  ok(r1.status === 200 && /"rows"/.test(r1.raw) && !names(r1.raw + r1.headers), "a real session's answer carries the code and the numbers and none of Salt QR's names, in its body or its headers");
  ok(r2.status === 200 && r3.status === 200 && !names(r2.raw + r2.headers) && !names(r3.raw + r3.headers) && !/refused|down|says/i.test(r2.raw + r3.raw),
    "with Salt QR failing, throwing an error that names it or answering a page that does, the customer's answer says nothing of it: " + r2.raw.slice(0, 60) + " " + r3.raw.slice(0, 60));
  ok(r4.status === 200 && /"rows"/.test(r4.raw) && !names(r4.raw + r4.headers), "a practice account's answer carries its invented details and no name of Salt QR");
  ok(PAY_ACCOUNTS.length > 5, "the rails the page is built on were read: " + PAY_ACCOUNTS.length);
}
