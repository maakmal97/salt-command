/* test/counter-shut-404.mjs: THE SHUT PAGE AND THE SITE'S 404 STAND ON THE COUNTER'S FRAME WITH THE RING (his yes of 11 Oct 2026, the plan's customer item 10).
 *
 * A shut link and an address the site does not have each answer one styled page: the app's ring over a heading and a line, Tide, under the guest
 * board's policy (no script, no image request, styles by nonce). Every shut id still answers ONE page, byte for byte the same apart from its
 * nonce, status 404. The 404 says one thing and echoes nothing of the path or the query; it is the page only where a page was asked for (an
 * Accept naming text/html), and a page's own fetch, a machine and a route that answers JSON keep what they had. Neither page names the app, a
 * product, a shape or a level. Each check below was proved red by its own mutation (test/counter-shut-404.mutations.json, run with
 * tools/section.mjs). Every address and id here is invented.
 */
export async function run({ ok }) {
  const PG = await import("../stmt/page.js"), W = await import("../stmt/words.js"), O = await import("../src/orders.js");
  const Worker = (await import("../stmt/worker.js")).default;
  const { JSDOM } = await import("jsdom");

  const ringOf = (h) => (/<path d="[^"]*"[^>]*\/>/.exec(h) || [""])[0];
  const RING = ringOf(PG.glyphSvg("ring", 40)), RING_D = (/<path d="([^"]*)"/.exec(RING) || [])[1] || "";
  const nonceOf = (x) => (/<style nonce="([A-Za-z0-9]+)">/.exec(x) || [])[1] || "";
  const bare = (body, csp) => { const n = nonceOf(body); return (body + "\n" + (csp || "")).split(n).join("NONCE"); };
  const visible = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  /* ---- the words ---- */
  ok(W.EN["nf.h"] === "This page is not here" && W.EN["nf.p"] === "Check the address and try again." && W.EN["nf.title"] === "Page not found"
    && W.EN["shut.h"] === "This link is not open" && W.EN["shut.title"] === "Link not open",
    "the 404's three words and the shut page's are keys of the table: " + JSON.stringify(["nf.h", "nf.p", "nf.title"].map((k) => W.EN[k])));

  /* ---- the two pages, as the page module draws them ---- */
  for (const [name, html, h, p, title] of [["the shut page", PG.shutPage("nA"), "shut.h", "shut.p", "shut.title"], ["the 404", PG.notFoundPage("nB"), "nf.h", "nf.p", "nf.title"]]) {
    const dom = new JSDOM(html), d = dom.window.document, hs = [...d.querySelectorAll("h1,h2,h3")].map((x) => x.tagName.toLowerCase());
    const mark = d.querySelector(".panel > .appmark");
    ok(RING_D !== "" && !!mark && mark.querySelector("path") && mark.querySelector("path").getAttribute("d") === RING_D && mark.querySelector("svg").getAttribute("aria-hidden") === "true"
      && d.querySelector(".panel").firstElementChild === mark
      && hs.join() === "h1" && d.querySelector("h1").textContent === W.EN[h] && d.querySelector("p.lead").textContent === W.EN[p] && d.title === W.EN[title],
      `${name} is the app's ring over its one heading and its line, with its own tab title: ` + JSON.stringify([hs, d.title]));
    ok(/<html[^>]* data-theme="tide"/.test(html) && /translate="no"/.test(html) && /name="viewport"/.test(html) && /name="robots" content="noindex/.test(html) && !/<script/i.test(html)
      && /[.]appmark\{display:block/.test(html) && /url\(\/fonts\//.test(html) && !/https?:\/\//.test(html),
      `${name} is Tide, kept from the translator and from search, with a viewport, the frame's own faces and spacing for the ring, no script and no address`);
    const words = visible(html), src = html.replace(/<style[\s\S]*?<\/style>/g, " ");
    ok(!O.wordsIn(words, O.PRODUCT_WORDS.concat(O.LEVEL_WORDS)).length && !O.siteWords(words) && !/salt|command|counter|desk/i.test(src)
      && !Object.values(PG.PSHAPE).some((s) => new RegExp("\\b" + s + "\\b", "i").test(words)),
      `${name} names no brand, product, shape or level, in what it says or in its source: ` + JSON.stringify(words));
    dom.window.close();
  }

  /* ---- the shut link: every kind answers one page ---- */
  const kv = { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) };
  const go = (path, headers, env) => Worker.fetch(new Request("https://k7m3p2.example" + path, { headers: headers || {} }), env || { STMT: kv }, {});
  const shutKinds = [["an id nobody holds", "/g/zzzz-zzzz", { STMT: kv }], ["a malformed id", "/g/nope", { STMT: kv }], ["a link with more after it", "/g/zzzz-zzzz/x", { STMT: kv }],
    ["a site with no store", "/g/zzzz-zzzz", {}]];
  const shuts = [];
  for (const [what, path, env] of shutKinds) { const r = await go(path, {}, env); shuts.push({ what, r, csp: r.headers.get("content-security-policy") || "", body: await r.text() }); }
  const shutBad = shuts.filter((x) => !(x.r.status === 404 && /^text\/html/.test(x.r.headers.get("content-type")) && /script-src 'none'/.test(x.csp) && /default-src 'none'/.test(x.csp)
    && !/img-src (?!'self' data:)/.test(x.csp) && nonceOf(x.body) && x.csp.includes("'nonce-" + nonceOf(x.body) + "'") && x.r.headers.get("cache-control") === "no-store"));
  ok(!shutBad.length, "every shut kind is a 404 page under the board's policy, its style by nonce, never cached: " + JSON.stringify(shutBad.map((x) => [x.what, x.r.status])));
  const shutSame = new Set(shuts.map((x) => bare(x.body, x.csp)));
  ok(shutSame.size === 1 && [...shutSame][0].includes(RING) && /This link is not open/.test([...shutSame][0]),
    "and it is ONE page with the ring, byte for byte but its nonce, the policy's included: " + JSON.stringify(shuts.map((x) => [x.what, bare(x.body, x.csp).length])));
  ok(new Set(shuts.map((x) => nonceOf(x.body))).size === shuts.length, "each answer has a nonce of its own");

  /* ---- the 404: the page where a page was asked for, and nothing of what was asked ---- */
  const ask = { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
  const a = await go("/zq7path/zq7deeper?zq7key=zq7secret&u=abcd-efgh", ask), b = await go("/zq7other%3Cb%3E/x%20y?z=1", ask);
  const abody = await a.text(), bbody = await b.text(), acsp = a.headers.get("content-security-policy") || "", bcsp = b.headers.get("content-security-policy") || "";
  ok(a.status === 404 && /^text\/html/.test(a.headers.get("content-type")) && /script-src 'none'/.test(acsp) && /default-src 'none'/.test(acsp) && acsp.includes("'nonce-" + nonceOf(abody) + "'")
    && !/img-src (?!'self' data:)/.test(acsp) && a.headers.get("cache-control") === "no-store" && /noindex/.test(a.headers.get("x-robots-tag") || ""),
    "an address the site does not have, asked for as a page, answers 404 as the styled page under the board's policy, never cached");
  ok(abody.includes(RING) && abody.includes("<h1 class=\"gh\">This page is not here</h1>") && abody.includes("Check the address and try again.") && abody.includes("<title>Page not found</title>"),
    "its ring, its heading, its line and its tab title are the table's");
  ok(!/zq7|abcd-efgh|x%20y/.test(abody + bbody + JSON.stringify([...a.headers]) + JSON.stringify([...b.headers])) && bare(abody, acsp) === bare(bbody, bcsp) && bare(abody, acsp).length > 1000,
    "it echoes nothing of the path or the query, in the page or in a header: two different addresses with the same Accept answer byte for byte the same but their nonce");
  ok(nonceOf(abody) !== nonceOf(bbody) && nonceOf(abody).length >= 16, "and each has a nonce of its own");

  /* ---- everything that did not ask for a page keeps what it had ---- */
  const plain = [await go("/nope"), await go("/nope", { accept: "*/*" }), await go("/nope", { accept: "application/json" })];
  const pt = await Promise.all(plain.map((x) => x.text()));
  ok(plain.every((x, i) => x.status === 404 && /^text\/plain/.test(x.headers.get("content-type")) && pt[i] === "Not found" && !x.headers.get("content-security-policy")),
    "a request that does not ask for a page, a page's own fetch or a machine, keeps the plain Not found: " + JSON.stringify(pt));
  const key = "desk-key-404", env2 = { STMT: kv, STMT_DESK_KEY: key };
  const slip = await go("/desk/slips/abcd-efgh/" + "0".repeat(32), { "x-stmt-desk": key, accept: "text/html" }, env2);
  const slipBody = await slip.text();
  ok(slip.status === 404 && /^application\/json/.test(slip.headers.get("content-type")) && /that slip is not kept/.test(slipBody),
    "a route that answers a 404 of its own in JSON keeps it, whatever the Accept: " + slipBody.slice(0, 80));
  const reply404 = await go("/desk/slips/not-a-user/" + "0".repeat(32), { "x-stmt-desk": key, accept: "text/html" }, env2);
  ok(reply404.status === 404 && /^text\/html/.test(reply404.headers.get("content-type")) && (await reply404.text()).includes("This page is not here"),
    "and a route whose refusal is the site's plain 404, asked for as a page, answers the same styled page");
  ok(typeof Worker.fetch === "function" && typeof Worker.scheduled === "function", "the Worker still exports its fetch and the cron's scheduled handler");
}
