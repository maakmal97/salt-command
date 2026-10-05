/* test/pool-page.mjs: THE POOL, B2 and B4 on the page. Home's group order card, and Join through the check the page already has:
 * its request id and digest are sent, a moved list redraws, a closed pool draws no Join, and the words are the table's own.
 * Driven in jsdom with the real crypto against stubbed answers. Every assertion was proved red by its own mutation. */
const U = "abcd-efgh", PASS = "fixture-pass-pool-01";

export async function page({ ok }) {
  const { landingPage } = await import("../stmt/page.js"), C = await import("../tools/stmt-crypto.mjs"), W = await import("../stmt/words.js");
  const { webcrypto } = await import("node:crypto"), { JSDOM } = await import("jsdom");
  const ck = await C.contentKey("test-secret", U);
  const list = (digest, price) => ({ at: "2026-10-04T03:59:00Z", digest, week: { label: "5 to 11 Oct 2026", monday: "2026-10-05" }, soon: [],
    products: [{ product: "salt", unit: "unit", basis: "tier", tier: "Gold", sizes: [{ q: 1, price: 100 }, { q: 2, price }] }] });
  const sealed = async (l) => Object.assign({ at: l.at, week: l.week.monday, digest: l.digest }, await C.encryptWith(ck, JSON.stringify(l)));
  const open = (id, extra) => Object.assign({ id, kind: "pool", product: "salt", q: 2, target: 10, state: "open", unitsIn: 4, joined: null }, extra || {});
  const mine = { id: "20261004050000-aaaa", product: "salt", status: "placed", qty: 2, total: 200, paid: 0, moved: 0, mode: "collect", delivery: 0, pool: "p20261004000000-aaaa",
    at: "2026-10-04T05:00:00Z", history: [], msgs: [] };
  const drive = async ({ pools, orders, answers, assoc }) => {
    const posted = [], state = { pools };
    const body = { ok: true, wrap: await C.wrapKey(PASS, ck), session: "sess-pool", prices: await sealed(list("dp1", 200)),
      env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })) };
    const dom = new JSDOM(landingPage(U, "nspool", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        const reply = (status, b) => ({ ok: status === 200, status, json: async () => b });
        if (p === "/open") return reply(200, assoc ? Object.assign({}, body, { assoc: true }) : body);
        if (p === "/orders" && m === "GET") return reply(200, { ok: true, orders: orders || [] });
        if (p === "/pools" && m === "GET") return reply(200, { ok: true, pools: state.pools });
        if (/^\/pools\/p[0-9]{14}-[a-z0-9]+\/join$/.test(p) && m === "POST") {
          const j = JSON.parse(init.body); posted.push({ path: p, j });
          const a = (answers || [])[posted.length - 1];
          if (a) return reply(a.status, a.body);
          state.pools = state.pools.map((x) => (p.includes(x.id) ? Object.assign({}, x, { joined: "20261004050000-jjjj", unitsIn: x.unitsIn + x.q }) : x));
          return reply(200, { ok: true, order: Object.assign({}, mine, { id: "20261004050000-jjjj" }) });
        }
        return reply(404, { ok: false });
      };
    } });
    const w = dom.window, d = w.document;
    d.getElementById("un").value = U; d.getElementById("pw").value = PASS;
    d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
    for (let i = 0; i < 200 && !d.getElementById("payHead"); i++) await new Promise((r) => setTimeout(r, 25));
    for (let i = 0; i < 100 && !(state.pools.length ? d.querySelector("#hPool [data-pool]") : d.getElementById("hPool")); i++) await new Promise((r) => setTimeout(r, 25));
    return { w, d, posted, state };
  };
  const wait = async (f) => { for (let i = 0; i < 100 && !f(); i++) await new Promise((r) => setTimeout(r, 25)); return f(); };
  const text = (n) => (n ? n.textContent : "");

  /* THE CARD: one row a pool between Needs you and Coming up, its words the table's own */
  const P1 = open("p20261004000000-aaaa", { closesOn: "2026-10-12" }), P2 = open("p20261004000000-bbbb", { joined: mine.id, unitsIn: 6 }),
    P3 = open("p20261004000000-cccc", { state: "closed", joined: mine.id, unitsIn: 8 }), P4 = open("p20261004000000-dddd", { state: "closed", unitsIn: 8 });
  const A = await drive({ pools: [P1, P2, P3, P4], orders: [mine] });
  try {
    const { d } = A, rows = [...d.querySelectorAll("#hPool [data-pool]")], row = (id) => rows.find((r) => r.getAttribute("data-pool") === id);
    const order = [...d.getElementById("payHead").parentNode.children].map((x) => x.id).filter(Boolean);
    const hc = [...d.querySelectorAll("#pHome .hcol > div")].map((x) => x.id);
    ok(rows.length === 4 && hc.indexOf("hPool") >= 0 && hc.indexOf("hPool") < hc.indexOf("hComing") && order.indexOf("hNeeds") >= 0
      && text(d.querySelector("#hPool .hlab")).startsWith(W.fill(W.EN["hp.h"])),
      "Home draws a row for each group order, under its heading, after Needs you and before Coming up: " + JSON.stringify([rows.length, hc]));
    const t1 = text(row(P1.id).querySelector(".salt-inbox-row__main")), t2 = text(row(P2.id).querySelector(".salt-inbox-row__main")), t3 = text(row(P3.id).querySelector(".salt-inbox-row__main"));
    ok(t1 === W.fill(W.EN["hp.in"], { n: 4, t: "10 units" }) + W.fill(W.EN["hp.closes"], { d: "12 Oct 2026" })
      && t2 === W.fill(W.EN["hp.joined"], { q: "2 units" }) + W.fill(W.EN["hp.in"], { n: 6, t: "10 units" }) && t3 === W.EN["hp.closed"],
      "the card's text is the table's words filled, nothing else: " + JSON.stringify([t1, t2, t3]));
    ok(t1.startsWith("4 of 10 units in") && t2.endsWith("6 of 10 units in"), "the target carries the product's own unit word, once: " + JSON.stringify([t1, t2]));
    const joins = [...d.querySelectorAll("#hPool [data-pool-join]")].map((b) => b.getAttribute("data-pool-join"));
    ok(joins.join() === P1.id && text(d.querySelector('[data-pool-join]')) === W.EN["hp.join"] && !row(P2.id).querySelector("button") && !row(P3.id).querySelector("button") && !row(P4.id).querySelector("button"),
      "Join is the open pool's one action: a pool they are in, a closed one, and one they are not in that has closed draw none: " + JSON.stringify(joins));
    const all = text(d.getElementById("hPool")), bare = d.getElementById("hPool").cloneNode(true);
    ok(!/salt|oil|candy|rice|ambassador|titanium|platinum|gold|silver|bronze|desk|command/i.test(all.replace(/Cube/g, "")) && !/—/.test(all) && row(P1.id).querySelector("svg.psym"),
      "the card names no product, no level and no brand, and carries the mark: " + JSON.stringify(all.slice(0, 120)));
    row(P2.id).click();
    ok(await wait(() => !!d.querySelector('.oscreen[data-order="' + mine.id + '"]')), "a row they are in opens their order");
    void bare;
  } finally { A.w.close(); }

  /* A POOL THEY HAVE NOT JOINED, A LIST THAT DOES NOT SELL ITS SIZE: no Join */
  const odd = await drive({ pools: [open("p20261004000000-eeee", { q: 7 })], orders: [] });
  try { ok(!odd.d.querySelector("[data-pool-join]") && /units in/.test(text(odd.d.getElementById("hPool"))), "a size their list does not sell has no Join, and the row still says how many are in"); }
  finally { odd.w.close(); }

  /* JOIN: the check opens at once with the pool's own size, and Join sends its request id and its digest */
  const B = await drive({ pools: [P1], orders: [] });
  try {
    const { d, posted } = B;
    d.querySelector("[data-pool-join]").click();
    ok(await wait(() => !!d.getElementById("oPlace")), "Join opens the check, a customer who is not asked who it is for going straight to it");
    const sheet = text(d.getElementById("osheet"));
    ok(sheet.includes(W.fill(W.EN["hp.ask"], { q: "2 units" })) && d.getElementById("oPlace").textContent === W.EN["hp.join"] && !sheet.includes(W.EN["sh.wantBy"]) && !/Delivery|delivered/.test(sheet),
      "it asks Join with 2 units?, is collected, and offers no day and no delivery: " + JSON.stringify(sheet.slice(0, 200)));
    d.getElementById("oPlace").click();
    await wait(() => posted.length === 1);
    const j = posted[0];
    ok(posted.length === 1 && j.path === "/pools/" + P1.id + "/join" && j.j.q === 2 && j.j.total === 200 && j.j.unit === 100 && j.j.digest === "dp1"
      && /^[0-9a-f]{32}$/.test(j.j.rid) && j.j.forFriend === false && Object.keys(j.j).sort().join() === "digest,forFriend,q,rid,total,unit",
      "Join sends the size, their own price and unit, the list's digest, a request id and who it is for, and nothing else: " + JSON.stringify(j));
    ok(await wait(() => /Sent|sent/.test(text(d.getElementById("osheet")))) && await wait(() => !!d.querySelector('#hPool [data-pool="' + P1.id + '"] .salt-inbox-row__main') && !d.querySelector("[data-pool-join]")),
      "and Home reads the join at once: the Join is gone and the row says they are in");
  } finally { await new Promise((r) => setTimeout(r, 80)); B.w.close(); }

  /* A MOVED LIST: the 409 redraws the check at the new figure, and the next Join carries the new digest and a new request id */
  const moved = { status: 409, body: { ok: false, error: "prices moved", code: "pricesMoved", prices: await sealed(list("dp2", 220)) } };
  const D = await drive({ pools: [P1], orders: [], answers: [moved] });
  try {
    const { d, posted } = D;
    d.querySelector("[data-pool-join]").click();
    await wait(() => !!d.getElementById("oPlace")); d.getElementById("oPlace").click();
    await wait(() => posted.length === 1);
    ok(await wait(() => /RM 220.00/.test(text(d.getElementById("osheet")))) && posted.length === 1,
      "a 409 prices moved redraws the check at the new figure, and nothing more is sent until they tap: " + JSON.stringify(text(d.getElementById("osheet")).slice(0, 200)));
    d.getElementById("oPlace").click();
    await wait(() => posted.length === 2);
    ok(posted.length === 2 && posted[1].j.total === 220 && posted[1].j.digest === "dp2" && posted[1].j.rid !== posted[0].j.rid,
      "the next Join carries the new figure, the new list's digest and a new request id: " + JSON.stringify(posted.map((x) => [x.j.total, x.j.digest, x.j.rid.slice(0, 6)])));
  } finally { await new Promise((r) => setTimeout(r, 80)); D.w.close(); }

  /* A POOL THAT CLOSED UNDER THEM: the refusal is said in its words and Home reads again */
  const closedAns = { status: 409, body: { ok: false, error: "This group order has closed.", code: "poolClosed" } };
  const F = await drive({ pools: [P1], orders: [], answers: [closedAns] });
  try {
    const { d, posted, state } = F;
    d.querySelector("[data-pool-join]").click();
    await wait(() => !!d.getElementById("oPlace")); state.pools = [Object.assign({}, P1, { state: "closed" })];
    d.getElementById("oPlace").click();
    await wait(() => posted.length === 1);
    ok(await wait(() => text(d.getElementById("osheet")).includes(W.EN["e.poolClosed"])) && await wait(() => !d.querySelector("[data-pool-join]")),
      "a pool closed under them says so in its words and loses its Join on Home");
  } finally { await new Promise((r) => setTimeout(r, 80)); F.w.close(); }

  /* AN ASSOCIATE IS ASKED WHO IT IS FOR FIRST, as at Place, and the answer rides on the join */
  const G = await drive({ pools: [P1], orders: [], assoc: true });
  try {
    const { d, posted } = G;
    d.querySelector("[data-pool-join]").click();
    await wait(() => !!d.querySelector("#osheet .salt-ghost"));
    const asks = text(d.getElementById("osheet")), go = d.getElementById("oGo");
    ok(asks.includes(W.EN["sh.me"]) && asks.includes(W.EN["sh.friend"]) && !!go && go.disabled && !d.getElementById("oPlace"),
      "an associate's Join asks Me or A friend first, and Review waits for the answer: " + JSON.stringify(asks.slice(0, 120)));
    [...d.querySelectorAll("#osheet .salt-ghost")].find((b) => b.textContent === W.EN["sh.friend"]).click();
    d.getElementById("oGo").click();
    await wait(() => !!d.getElementById("oPlace")); d.getElementById("oPlace").click();
    await wait(() => posted.length === 1);
    ok(posted[0].j.forFriend === true, "and a friend's join is sent as one: " + JSON.stringify(posted[0].j));
  } finally { await new Promise((r) => setTimeout(r, 80)); G.w.close(); }
}
