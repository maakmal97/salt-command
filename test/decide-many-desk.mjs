/* test/decide-many-desk.mjs: MULTI-TICK APPROVE, P1, THE DESK'S DECIDE-MANY (22 Oct 2026; docs/plan-approve-many.html, his answers).
 * What is proved here, each check red under its own mutation (test/decide-many-desk.mutations.json), on the Desk Worker over a real
 * SQLite D1 (test/maker-trades.mjs world):
 *   1  approvals and rejections in one call, decided in the order entered, each as one tap decides it; one fold dispatch for the batch
 *   2  a card already decided is refused with why and how to fix it, and the rest still go
 *   3  a batch of rejections alone sends no dispatch
 *   4  a trip's rows go with the card that names one, counted decided, never refused
 *   5  a payment they say they sent is refused, answered on its order
 *   6  the body is checked: lists of stamped draft ids, 1 to 50, none twice, nothing else; and the route takes the bridge key alone
 *   7  one tap on one draft is as it was: decided, and one dispatch */
import desk, { decideManyFault } from "../src/worker.js";
import { world } from "./maker-trades.mjs";

const J = JSON.stringify;
const DAY = "2099-10-05";
const sale = (at, party, total) => ({ at, product: "salt", party, date: DAY, qty: 1, total, cash: 0, movedUnits: 0 });

async function setup(n) {
  const wd = world();
  wd.desk.SALT_GITHUB_TOKEN = "fixture-token";
  for (let i = 0; i < n; i++) { const r = await wd.call("/all/maker/inputs/sale", sale("2099-10-05T01:0" + i + ":00.000Z", ["CX1-ZED", "AX1-ZED"][i % 2], 130 + 10 * i)); await r.json(); }
  const ids = wd.drafts().map((d) => d.id);
  const status = () => Object.fromEntries(wd.drafts().map((d) => [d.id, d.status]));
  const many = async (body, key = wd.desk.COUNTER_MAKER_KEY) => {
    const waits = [];
    const res = await desk.fetch(new Request("https://desk.test/_internal/maker/drafts/decide-many", { method: "POST",
      headers: Object.assign({ "content-type": "application/json" }, key ? { "X-Counter-Maker-Key": key } : {}), body: J(body) }), wd.desk, { waitUntil(p) { waits.push(p); } });
    await Promise.all(waits);
    return { status: res.status, body: await res.json() };
  };
  return { wd, ids, status, many };
}

export async function run({ ok }) {
  const realFetch = globalThis.fetch, hits = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (/api[.]github[.]com/.test(u)) { hits.push(u); return new Response(null, { status: 204 }); }
    return realFetch(url, init);
  };
  const dispatches = () => hits.filter((u) => /cloud-commit[.]yml[/]dispatches/.test(u)).length;
  try {
    /* 1 */
    {
      const { ids, status, many } = await setup(3);
      const h0 = dispatches();
      const r = await many({ approve: [ids[2], ids[0]], reject: [ids[1]] });
      const st = status();
      ok(r.status === 200 && r.body.ok && J(r.body.decided.map((d) => [d.id, d.decision])) === J([[ids[0], "approved"], [ids[1], "rejected"], [ids[2], "approved"]])
        && r.body.refused.length === 0 && st[ids[0]] === "approved" && st[ids[1]] === "rejected" && st[ids[2]] === "approved",
      "approvals and rejections in one call, decided in the order entered: " + J([r.status, r.body, st]));
      ok(dispatches() - h0 === 1, "one fold dispatch for the whole batch: " + (dispatches() - h0));
    }
    /* 2 */
    {
      const { wd, ids, status, many } = await setup(2);
      wd.sqlite.prepare("UPDATE draft SET status='approved' WHERE id=?").run(ids[0]);
      const r = await many({ approve: [ids[0], ids[1]] });
      const ref = r.body.refused[0] || {};
      ok(r.status === 200 && r.body.decided.length === 1 && r.body.decided[0].id === ids[1] && status()[ids[1]] === "approved"
        && r.body.refused.length === 1 && ref.id === ids[0] && /already approved/.test(ref.error) && /another screen/.test(ref.fix),
      "a card already decided is refused with why and how to fix it, and the rest still go: " + J(r.body));
    }
    /* 3 */
    {
      const { ids, status, many } = await setup(2);
      const h0 = dispatches();
      const r = await many({ reject: ids });
      ok(r.body.decided.length === 2 && ids.every((id) => status()[id] === "rejected") && dispatches() - h0 === 0,
        "a batch of rejections alone is decided and sends no dispatch: " + J([r.body, dispatches() - h0]));
    }
    /* 4 */
    {
      const { wd, ids, status, many } = await setup(2);
      wd.sqlite.prepare("UPDATE draft SET row=json_set(row,'$.trip','t4099') WHERE id IN (?,?)").run(ids[0], ids[1]);
      const r = await many({ approve: [ids[0], ids[1]] });
      ok(r.body.refused.length === 0 && r.body.decided.length === 2 && J(r.body.decided[0].trip) === J([ids[1]]) && r.body.decided[1].withTrip === true
        && status()[ids[1]] === "approved", "a trip's rows go with the card that names one, counted decided, never refused: " + J(r.body));
    }
    {
      const { wd, ids, status, many } = await setup(2);
      wd.sqlite.prepare("UPDATE draft SET row=json_set(row,'$.trip','t4098') WHERE id IN (?,?)").run(ids[0], ids[1]);
      const r = await many({ approve: [ids[0]], reject: [ids[1]] });
      const ref = r.body.refused[0] || {};
      ok(ref.id === ids[1] && /its trip was approved in this batch/.test(ref.error) && /one way/.test(ref.fix) && status()[ids[1]] === "approved",
        "a trip's row ticked the other way is refused as its trip's, with the fix: " + J(r.body));
    }
    /* 5 */
    {
      const { wd, ids, status, many } = await setup(2);
      wd.sqlite.prepare("UPDATE draft SET entry=json_set(entry,'$.claim',json('true')) WHERE id=?").run(ids[0]);
      const r = await many({ approve: ids });
      const ref = r.body.refused[0] || {};
      ok(ref.id === ids[0] && /on its order/.test(ref.fix) && status()[ids[0]] === "pending" && status()[ids[1]] === "approved",
        "a payment they say they sent is refused, answered on its order, and the other card goes: " + J(r.body));
    }
    /* 6 */
    {
      const T = (i) => new Date(Date.UTC(2099, 9, 5, 1, 0, i)).toISOString();
      const many51 = Array.from({ length: 51 }, (_, i) => new Date(Date.UTC(2099, 9, 5, 1, 0, 0, i)).toISOString());
      const faults = [null, {}, [], { approve: [] }, { approve: T(1) }, { approve: [T(1)], extra: 1 }, { approve: [T(1)], reject: [T(1)] }, { approve: ["2099-10-05"] }, { approve: many51 }];
      const said = faults.map((b) => decideManyFault(b));
      ok(said.every(Boolean) && decideManyFault({ approve: [T(1)], reject: [T(2)] }) === null && decideManyFault({ reject: many51.slice(0, 50) }) === null,
        "the body is lists of stamped draft ids, 1 to 50, none twice, nothing else: " + J(said));
      const { ids, status, many } = await setup(1);
      const bad = await many({ approve: [ids[0], ids[0]] }), nokey = await many({ approve: [ids[0]] }, "");
      ok(bad.status === 400 && nokey.status !== 200 && !nokey.body.ok && status()[ids[0]] === "pending",
        "a bad body is a 400 and no bridge key is turned away, and neither decides anything: " + J([bad.status, nokey.status]));
    }
    /* 7 */
    {
      const { wd, ids, status } = await setup(1);
      const h0 = dispatches(), waits = [];
      const res = await desk.fetch(new Request("https://desk.test/_internal/maker/drafts/" + encodeURIComponent(ids[0]) + "/approve", { method: "POST",
        headers: { "content-type": "application/json", "X-Counter-Maker-Key": wd.desk.COUNTER_MAKER_KEY }, body: "{}" }), wd.desk, { waitUntil(p) { waits.push(p); } });
      await Promise.all(waits);
      const b = await res.json();
      ok(res.status === 200 && b.ok && b.draft && b.draft.status === "approved" && status()[ids[0]] === "approved" && dispatches() - h0 === 1,
        "one tap on one draft is as it was: decided, and one dispatch: " + J([res.status, b.ok, dispatches() - h0]));
    }
  } catch (e) { ok(false, "decide-many-desk stopped on an error: " + (e && e.stack)); }
  finally { globalThis.fetch = realFetch; }
}
