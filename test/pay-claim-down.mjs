/* 9 Nov 2026: A CLAIM NAMES NO ACCOUNT SALT QR HAS SUSPENDED NOW.
 * Before this, the order book checked only the flag baked in at the last paysync, so a customer could claim a payment to an
 * account he had suspended live in Salt QR's /admin. The Worker now reads the same flags the pay sheet draws by (stmt/paystate.js
 * payDownKept: the fresh /state.json, else the baked flags OR the last fresh word kept in KV `paydown`) and refuses, before the
 * move, a rail choice or a claim whose body names a suspended account, on the account road and on an order's method and pay.
 * Each check is proved red by its own mutation (test/pay-claim-down.mutations.json, run with tools/section.mjs). */
export async function run({ ok, KV }) {
  const PS = await import("../stmt/paystate.js");
  const O = await import("../stmt/orders.js");
  const TF = await import("../stmt/testfix.js");
  const stmtW = (await import("../stmt/worker.js")).default;

  /* ---- 1: the pure check */
  const eff = { maybank: true, wise: false, instapay: true, tngbiz: true };
  ok(PS.railDownKey({ method: "qr", account: "maybank" }, eff) === "maybank" && PS.railDownKey({ method: "transfer", account: "maybank" }, eff) === "maybank",
    "a code or a transfer naming a suspended account is named");
  ok(PS.railDownKey({ method: "jompay", account: "instapay" }, eff) === "instapay", "and so is JomPAY on a suspended biller account");
  ok(PS.railDownKey({ method: "tngbiz" }, eff) === "tngbiz", "the Touch 'n Go Business code is read by its own key, its body naming no account");
  ok(PS.railDownKey({ method: "transfer", account: "wise" }, eff) === null && PS.railDownKey({ method: "cod" }, eff) === null && PS.railDownKey({ amount: 5 }, eff) === null,
    "an account up, cash, or a body naming no method is not refused");
  ok(PS.railDownKey({ method: "qr", account: "maybank" }, null) === null, "with no flags read at all the check stands down, pickRail's baked flags standing");

  /* ---- 2: the Worker's two roads */
  const call = async (env, path, headers, body) => {
    const r = await stmtW.fetch(new Request("https://k7m3p2.example" + path, { method: "POST", headers: Object.assign({ "content-type": "application/json" }, headers), body: JSON.stringify(body) }), env);
    let b = null; try { b = await r.json(); } catch (e) { b = null; }
    return { status: r.status, b: b || {} };
  };
  const stateOf = (m) => new Response(JSON.stringify({ maintenance: m, order: [] }));
  const mkEnv = (state) => {
    const calls = [];
    return { calls, env: { STMT_DESK_KEY: "desk-key", STMT: new KV(), QRCMD: { fetch: async (u) => { calls.push(String(u)); if (state instanceof Error) throw state; return /state\.json$/.test(String(u)) ? stateOf(state) : new Response("", { status: 404 }); } } } };
  };
  const U = "abcd-efgh";
  const claimOf = (method, account, n) => Object.assign({ amount: 12, method, rid: "r" + n }, account ? { account } : {});
  const filed = async (env) => (await env.STMT.list({ prefix: "aclaim:" })).keys.length;

  const D = mkEnv({ maybank: true, instapay: true, tngbiz: true });
  const SD = { "X-Stmt-Session": await O.mintSession(D.env, U) };
  const r1 = await call(D.env, "/account/claim", SD, claimOf("transfer", "maybank", 1));
  ok(r1.status === 409 && r1.b.code === "railDown" && (await filed(D.env)) === 0, "a claim on the account naming a suspended account is refused railDown and nothing is filed: " + r1.status + " " + r1.b.code);
  const r1j = await call(D.env, "/account/claim", SD, claimOf("jompay", "instapay", 2));
  ok(r1j.status === 409 && r1j.b.code === "railDown", "and so is a JomPAY claim on a suspended biller: " + r1j.status + " " + r1j.b.code);
  const r1t = await call(D.env, "/account/claim", SD, claimOf("tngbiz", null, 3));
  ok(r1t.status === 409 && r1t.b.code === "railDown", "and a Touch 'n Go Business claim while that code is suspended: " + r1t.status + " " + r1t.b.code);

  const UP = mkEnv({ maybank: false });
  const SU = { "X-Stmt-Session": await O.mintSession(UP.env, U) };
  const r2 = await call(UP.env, "/account/claim", SU, claimOf("transfer", "maybank", 4));
  ok(r2.status === 200 && r2.b.ok === true && (await filed(UP.env)) === 1 && UP.calls.some((u) => /state\.json$/.test(u)),
    "with the account up in Salt QR the same claim is recorded, its state read fresh: " + r2.status + " " + (r2.b.code || ""));

  /* the state unreadable: the last fresh word kept in KV still holds his suspension */
  const K = mkEnv(new Error("state down"));
  await K.env.STMT.put(PS.PAYDOWN_KEY, JSON.stringify({ v: 1, at: Date.now() - 36e5, down: { maybank: true } }));
  const SK = { "X-Stmt-Session": await O.mintSession(K.env, U) };
  const r3 = await call(K.env, "/account/claim", SK, claimOf("qr", "maybank", 5));
  ok(r3.status === 409 && r3.b.code === "railDown", "with Salt QR's state unreadable, the last fresh word still refuses a claim on the account he suspended: " + r3.status + " " + r3.b.code);
  const r3w = await call(K.env, "/account/claim", SK, claimOf("transfer", "wise", 6));
  ok(r3w.status === 200 && r3w.b.ok === true, "while an account the word left up is still taken: " + r3w.status + " " + (r3w.b.code || ""));

  /* an order's moves: the check runs ahead of the move, so an order that does not exist shows where it stands */
  const OID = "20261109120000-abc";
  const p1 = await call(D.env, "/orders/" + OID + "/pay", SD, claimOf("transfer", "maybank", 7));
  ok(p1.status === 409 && p1.b.code === "railDown", "a claim on an order naming a suspended account is refused before the order is read: " + p1.status + " " + p1.b.code);
  const m1 = await call(D.env, "/orders/" + OID + "/method", SD, { method: "qr", account: "maybank" });
  ok(m1.status === 409 && m1.b.code === "railDown", "and so is choosing that account as the order's way to pay: " + m1.status + " " + m1.b.code);
  const p2 = await call(UP.env, "/orders/" + OID + "/pay", SU, claimOf("transfer", "maybank", 8));
  ok(p2.b.code === "noOrder", "with the account up the same claim reaches the order (which does not exist): " + p2.status + " " + (p2.b.code || p2.b.error || ""));
  const p3 = await call(D.env, "/orders/" + OID + "/pay", SD, { amount: 12, rid: "r9" });
  ok(p3.b.code !== "railDown", "a claim naming no way to pay is not refused by the check (the order's own way stands, as before): " + p3.status + " " + (p3.b.code || ""));
  const say = mkEnv({ maybank: true });
  const SS = { "X-Stmt-Session": await O.mintSession(say.env, U) };
  await call(say.env, "/orders/" + OID + "/say", SS, { text: "hello", method: "qr", account: "maybank", rid: "r10" });
  ok(!say.calls.some((u) => /state\.json$/.test(u)), "a move that books no money never reads Salt QR's state");

  /* a practice account answers off its fixture first and never reads Salt QR */
  const T = mkEnv({ maybank: true });
  const ST = { "X-Stmt-Session": await O.mintSession(T.env, TF.TEST_USER) };
  const t1 = await call(T.env, "/account/claim", ST, claimOf("transfer", "maybank", 11));
  ok(t1.b.code !== "railDown" && !T.calls.some((u) => /state\.json$/.test(u)), "a practice account's claim never reads Salt QR: " + t1.status + " " + (t1.b.code || ""));
  await call(T.env, "/orders/" + OID + "/pay", ST, claimOf("transfer", "maybank", 12));
  ok(!T.calls.some((u) => /state\.json$/.test(u)), "nor does a practice account's move on an order its fixture lacks");
}
