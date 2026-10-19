/* test/counter-stamp-route.mjs: GET /account/stamp, WHAT TELLS THAT AN ACCOUNT MOVED (R1, the Live and fast plan, 19 Oct 2026).
 *
 * The Counter's open page asks this on its poll and re-reads /account only when the answer differs from the one it opened with. So it
 * answers the moments the publish stamped in the clear (the live document's at and build id, the price list's at and digest, the
 * associate card's at, the issue) and the live verdict (current, updating, unavailable, or the fixture's), on the same session check as
 * /account, and nothing else: no ciphertext, no figure, no name. A test account is answered the same way, from its fixture, on the
 * plain road and under /all/test/c. Each assertion was proved red by its own mutation (test/counter-stamp-route.mutations.json,
 * run with tools/section.mjs). Every username, key and digest here is invented. */
import { surface } from "./test-surface-harness.mjs";
import * as O from "../stmt/orders.js";

export async function run({ ok }) {
  const s = await surface();
  try {
    const BUILD = "a".repeat(16), U = "abcd-efgh", T = "0000-0002", host = "https://counter.fixture.test";
    let desk = async () => Response.json({ ok: true, id: BUILD });
    s.env.DESK = { fetch: (r) => desk(r) };
    const sealed = (extra) => Object.assign({ iv: "iv-secret", ct: "ct-secret-" + U }, extra);
    const rec = (over) => ({ issued: "2026-10-01", assoc: false, env: sealed(), live: sealed({ at: "2026-10-19T02:00:00.000Z", buildId: BUILD }),
      prices: sealed({ at: "2026-10-19T01:00:00.000Z", week: "2026-10-19", digest: "list-1" }), card: sealed({ at: "2026-10-19T01:30:00.000Z" }), ...over });
    await s.store.put("u:" + U, JSON.stringify(rec()));
    const tok = await O.mintSession(s.env, U);
    const stamp = async (path, session, method = "GET") => {
      const r = await s.counter.fetch(new Request(host + path, { method, headers: session ? { "X-Stmt-Session": session } : {} }), s.env);
      const text = await r.text(); let j = null; try { j = JSON.parse(text); } catch (e) { /* not json */ }
      return { status: r.status, text, j };
    };

    /* 1. a real account: the stamp, and only the stamp */
    const a = await stamp("/account/stamp", tok);
    ok(a.status === 200 && a.j && a.j.ok === true && a.j.liveStatus === "current" && a.j.issued === "2026-10-01"
      && JSON.stringify(a.j.live) === JSON.stringify({ at: "2026-10-19T02:00:00.000Z", buildId: BUILD })
      && JSON.stringify(a.j.prices) === JSON.stringify({ at: "2026-10-19T01:00:00.000Z", digest: "list-1" })
      && JSON.stringify(a.j.card) === JSON.stringify({ at: "2026-10-19T01:30:00.000Z" }),
    "GET /account/stamp answers the live document's at and build id, the price list's at and digest, the card's at, the issue and the verdict: " + a.text);
    ok(!/ct-secret|iv-secret|"(ct|iv|env|wrap|week)"/.test(a.text) && !a.text.includes(U),
      "and no ciphertext, no sealed field and no username: " + a.text);
    const full = await stamp("/account", tok);
    ok(full.status === 200 && full.text.length > a.text.length && /ct-secret/.test(full.text), "(the account itself still carries what the stamp leaves out)");

    /* 2. the same session check as /account */
    const none = await stamp("/account/stamp", ""), lost = await stamp("/account/stamp", "no-such-session"), post = await stamp("/account/stamp", tok, "POST");
    ok(none.status === 401 && lost.status === 401 && none.text === (await stamp("/account", "")).text,
      "with no session, or one that is not there, it is the same 401 as /account: " + [none.status, lost.status]);
    ok(post.status === 405, "and a POST is refused: " + post.status);

    /* 3. it moves when the publish does, and the verdict is the same one /account gives */
    await s.store.put("u:" + U, JSON.stringify(rec({ live: sealed({ at: "2026-10-19T03:00:00.000Z", buildId: BUILD }) })));
    const b = await stamp("/account/stamp", tok);
    ok(b.j.live.at === "2026-10-19T03:00:00.000Z" && b.text !== a.text, "a republished statement moves the stamp: " + JSON.stringify(b.j.live));
    await s.store.put("u:" + U, JSON.stringify(rec({ prices: sealed({ at: "2026-10-19T04:00:00.000Z", week: "2026-10-19", digest: "list-2" }) })));
    const c = await stamp("/account/stamp", tok);
    ok(c.j.prices.digest === "list-2" && c.j.prices.at === "2026-10-19T04:00:00.000Z", "and so does a republished price list: " + JSON.stringify(c.j.prices));
    await s.store.put("u:" + U, JSON.stringify(rec()));
    desk = async () => Response.json({ ok: true, id: "b".repeat(16) });
    const upd = await stamp("/account/stamp", tok);
    ok(upd.j.liveStatus === "updating" && upd.j.live === null, "a live document sealed for another build reads updating, and gives no moment: " + upd.text);
    desk = async () => { throw new Error("fixture: the Desk could not be reached"); };
    const unav = await stamp("/account/stamp", tok);
    ok(unav.j.liveStatus === "unavailable" && unav.j.live === null, "a Desk that cannot be reached reads unavailable: " + unav.text);
    desk = async () => Response.json({ ok: true, id: BUILD });
    await s.store.put("u:" + U, JSON.stringify({ issued: "2026-10-01", env: sealed() }));
    const bare = await stamp("/account/stamp", tok);
    ok(bare.status === 200 && bare.j.prices === null && bare.j.card === null && bare.j.live === null, "an account with no list, no card and no live document gives null for each: " + bare.text);

    /* 4. a test account is answered the same way, from its fixture, on the plain road and on the test surface's */
    await s.putFixture(T, { live: { at: "2026-10-19T05:00:00.000Z", buildId: "f".repeat(16), iv: "x", ct: "y" }, prices: { at: "2026-10-19T05:30:00.000Z", digest: "fixture-list", iv: "x", ct: "y" } });
    const tt = await O.mintSession(s.env, T);
    const plain = await stamp("/account/stamp", tt), onSurface = await s.owner("/all/test/c/account/stamp", undefined, s.jwt, "GET", { "X-Stmt-Session": tt });
    const sj = await onSurface.json().catch(() => null);
    ok(plain.status === 200 && plain.j.liveStatus === "fixture" && plain.j.live.at === "2026-10-19T05:00:00.000Z" && plain.j.prices.digest === "fixture-list",
      "a test account's stamp is its fixture's, with the verdict fixture, and needs no Desk: " + plain.text);
    ok(onSurface.status === 200 && JSON.stringify(sj) === JSON.stringify(plain.j), "and it is the same under the test surface's own road: " + JSON.stringify(sj));
    await s.putFixture(T, { live: { at: "2026-10-19T06:00:00.000Z", buildId: "f".repeat(16), iv: "x", ct: "y" }, prices: { at: "2026-10-19T05:30:00.000Z", digest: "fixture-list", iv: "x", ct: "y" } });
    const moved = await stamp("/account/stamp", tt);
    ok(moved.j.live.at === "2026-10-19T06:00:00.000Z", "a fixture sealed afresh moves it: " + JSON.stringify(moved.j.live));
    const realOnSurface = await s.owner("/all/test/c/account/stamp", undefined, s.jwt, "GET", { "X-Stmt-Session": tok });
    ok(realOnSurface.status === 403, "under /all/test/c a real customer's session is refused: " + realOnSurface.status);
  } finally { s.close(); }
}
