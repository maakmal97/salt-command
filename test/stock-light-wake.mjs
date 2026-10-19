/* test/stock-light-wake.mjs: A STOCK LIGHT TURNING WAKES THE DESK, ONCE (19 Oct 2026, the notifications plan: Salt Desk informs).
 *
 * The publish keeps the lights it sealed in the site's store (`stocklights`) and compares the next publish's with them: a book turning
 * yellow or red from a better colour posts {"tag":"stock"} to the Desk's /push/send once, and a light that holds, gets better, or was
 * never lit before posts nothing. `run` drives the helpers; `wiring` drives the whole publish through main against the stub store of
 * the statements publish section, which hands its harness in. Each check was proved red by its own mutation
 * (test/stock-light-wake.mutations.json, run with tools/section.mjs). Every key and address here is invented.
 */
export async function run({ ok }) {
  const P = await import("../tools/stmt-publish.mjs");
  const env = { PUSH_KEY: "push-key", CF_ACCESS_CLIENT_ID: "id.access", CF_ACCESS_CLIENT_SECRET: "secret" };
  const wake = async (prev, now, e = env, fail = false) => {
    const calls = [], log = console.log;
    const post = async (url, init) => { calls.push({ url, init }); if (fail) throw new Error("network down"); return { status: 200 }; };
    console.log = () => {};
    let r, threw = false;
    try { r = await P.stockWake(prev, now, e, post); } catch (x) { threw = true; } finally { console.log = log; }
    return { calls, r, threw };
  };

  /* 1. GREEN TO YELLOW POSTS THE STOCK TAG ONCE, AND NOTHING ELSE */
  {
    const w = await wake({ salt: "green", oil: "green" }, { salt: "yellow", oil: "green" });
    const c = w.calls[0], h = c && c.init.headers;
    ok(w.calls.length === 1 && c.url === P.PUSH_URL && c.init.method === "POST" && c.init.body === '{"tag":"stock"}'
      && h["X-Push-Key"] === "push-key" && h["CF-Access-Client-Id"] === "id.access" && h["CF-Access-Client-Secret"] === "secret" && w.r === 200,
      "a book turning green to yellow posts {\"tag\":\"stock\"} once to /push/send with the push key and the Access headers: " + JSON.stringify(w.calls));
  }
  /* 2. A LIGHT THAT HOLDS POSTS NOTHING */
  ok((await wake({ salt: "yellow", oil: "red" }, { salt: "yellow", oil: "red" })).calls.length === 0,
    "a publish that keeps a light yellow, or red, posts nothing");
  /* 3. YELLOW TO RED IS A TURN FOR THE WORSE */
  ok((await wake({ salt: "yellow" }, { salt: "red" })).calls.length === 1, "a book turning yellow to red posts the stock tag");
  /* 4. A LIGHT GETTING BETTER POSTS NOTHING */
  ok((await wake({ salt: "red", oil: "yellow" }, { salt: "yellow", oil: "green" })).calls.length === 0,
    "a light getting better (red to yellow, yellow to green) posts nothing");
  /* 5. A BOOK THE LAST PUBLISH DID NOT LIGHT IS NOT A TURN */
  ok((await wake(null, { salt: "red" })).calls.length === 0 && (await wake({ salt: "green" }, { salt: "green", rice: "yellow" })).calls.length === 0,
    "with no last lights, or a book the last publish did not light, nothing is posted");
  /* 6. SEVERAL BOOKS TURNING AT ONCE POST ONCE */
  ok((await wake({ salt: "green", oil: "green", rice: "yellow" }, { salt: "yellow", oil: "red", rice: "red" })).calls.length === 1,
    "three books turning in one publish post the stock tag once");
  /* 7. NO PUSH KEY, NO POST */
  ok((await wake({ salt: "green" }, { salt: "red" }, {})).calls.length === 0, "with no PUSH_KEY nothing is posted");
  /* 8. A POST THAT FAILS NEVER FAILS THE PUBLISH */
  {
    const w = await wake({ salt: "green" }, { salt: "red" }, env, true);
    ok(w.calls.length === 1 && !w.threw && w.r === null, "a post that throws is swallowed and the publish goes on: " + JSON.stringify({ threw: w.threw, r: w.r }));
  }
  /* 9. WHAT IS KEPT IS THE LIGHT WORD ALONE, PER BOOK */
  ok(JSON.stringify(P.stockLights({ salt: { light: "yellow", by: "2026-10-25" }, oil: { light: "green", by: null }, odd: { light: "blue" } }))
    === '{"salt":"yellow","oil":"green"}', "the kept lights are the light words alone, no date, and an unknown word is dropped");
  /* 10. THE LAST LIGHTS ARE READ FROM THE SITE'S STORE, AND A MISSING KEY IS NULL */
  {
    const seen = [];
    const store = (v) => (cmd, argv) => { seen.push(argv.join(" ")); if (v === null) throw Object.assign(new Error("get failed - 404: key not found"), { status: 1 }); return v; };
    const log = console.log; console.log = () => {};
    let got, none;
    try { got = P.readStockLights(store('banner\n{"salt":"red"}')); none = P.readStockLights(store(null)); } finally { console.log = log; }
    ok(JSON.stringify(got) === '{"salt":"red"}' && none === null && seen.every((a) => /kv key get --remote --binding STMT stocklights/.test(a)),
      "the last lights are read from the site's store under stocklights, and a missing key reads as none: " + JSON.stringify({ got, none, seen }));
  }
}

/* THROUGH THE WHOLE PUBLISH: the statements publish section's harness (main against a stub store), priced three times */
export async function wiring({ ok, run55, wr55, site0, K55 }) {
  const realF = globalThis.fetch, was = process.env.PUSH_KEY, posts = [];
  globalThis.fetch = async (url, init) => { posts.push({ url: String(url), body: init && init.body }); return new Response("", { status: 200 }); };
  process.env.PUSH_KEY = "push-key";
  try {
    /* a first publish: no last lights, so it writes them and posts nothing */
    const s1 = site0(), c1 = [];
    const said1 = await run55(["--no-retire"], wr55(s1, new Map(), c1), K55);
    const lights = (() => { try { return JSON.parse(s1.get("stocklights")); } catch (e) { return null; } })();
    ok(said1.includes("returned") && c1.includes("kv key get stocklights") && lights && Object.keys(lights).length > 0
      && Object.values(lights).every((l) => ["green", "yellow", "red"].includes(l)) && posts.length === 0,
      "a first priced publish reads the last lights, finds none, writes this run's under stocklights and posts nothing: " + JSON.stringify({ lights, posts, said: said1.slice(-1) }));

    /* the publish that turns one: the frozen book may be green throughout, so this run reads its first book yellow (main's `lit`),
       over last lights holding that book green */
    const first = Object.keys(lights || {})[0], turn = { lit: (s) => Object.assign({}, s, { [first]: { light: "yellow", by: null } }) };
    const turned = JSON.stringify(Object.assign({}, lights, { [first]: "yellow" }));
    const s2 = site0(); s2.set("stocklights", JSON.stringify(Object.assign({}, lights, { [first]: "green" })));
    posts.length = 0;
    const said2 = await run55(["--no-retire"], wr55(s2, new Map(), []), K55, undefined, turn);
    ok(said2.includes("returned") && posts.length === 1 && posts[0].body === '{"tag":"stock"}' && /\/push\/send$/.test(posts[0].url)
      && s2.get("stocklights") === turned,
      "a publish that turns a light green to yellow posts the stock tag once and keeps the new lights: " + JSON.stringify({ posts, kept: s2.get("stocklights") }));

    /* and the publish after it, the light held yellow */
    posts.length = 0;
    const said3 = await run55(["--no-retire"], wr55(s2, new Map(), []), K55, undefined, turn);
    ok(said3.includes("returned") && posts.length === 0, "the publish after, the light held yellow, posts nothing: " + JSON.stringify(posts));
  } finally {
    globalThis.fetch = realF;
    if (was === undefined) delete process.env.PUSH_KEY; else process.env.PUSH_KEY = was;
  }
}
