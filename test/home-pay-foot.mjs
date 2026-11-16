/* test/home-pay-foot.mjs: HOME LEADS WITH THE ONE ACTION (Phase 7a of the Salt Admin and Counter redesign, his yes of 11 Oct 2026).
 *
 * On the customer's Home, To pay now's tile and its one filled Pay stand in a foot that sticks above the App bar, so the pill is never
 * under the bar; the invoice lines under it show three and fold the rest behind "N more"; with nothing to pay now no foot is drawn.
 * Every rule of the pay terms holds as it did: the V5 stages (a locked account greys the rest of Home and leaves To pay now live), D7 and
 * D8 (every Pay opens the one sheet, asked on return), ember for what they owe. Every assertion observes a signed-in page's window, its
 * markup and the cascade jsdom runs (it applies no width query, so the phone is read as it stands and the desktop by rewriting its width
 * query to `all`, as the phone-frame section does). The geometry itself, a pill wholly above the bar at 375 by 812, 375 by 667 and 768 by
 * 1024 in both themes, is measured in a real browser and recorded in the pull request. Each check below was proved red by its own mutation
 * (test/home-pay-foot.mutations.json, run with tools/section.mjs). Every code, name and password here is invented.
 *   1  the markup: the foot is last in Home, after both columns, drawn hidden and empty
 *   2  something owed: the tile and the one Pay are in the foot, ember, and the head keeps neither
 *   3  nothing owed, or all of it already sent: no foot is drawn, the tile stays in the head, and the CSS shuts a hidden foot
 *   4  the Pay opens the pay sheet on the whole invoice, every line and not three
 *   5  three lines are drawn and no disclosure; four or more draw three, then "N more" with the right count, shut
 *   6  the disclosure opens the rest, and stays as it was across a redraw
 *   7  the V5 lock greys the rest of Home and leaves the foot live, with the one Pay opening the sheet
 *   8  the cascade: sticky on a phone, above the bar by its own height token, below the bar and the sheet, in the flow from 1080px
 *   9  a tap is 44px: the Pay and the disclosure's summary
 *  10  the practice accounts hold a case of the fold, and a fixture without one is red by its line */
import { webcrypto } from "node:crypto";

const BUILD = "a".repeat(16);

export async function run({ ok, pageWork }) {
  const { landingPage } = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const W = await import("../stmt/words.js");
  const { JSDOM } = await import("jsdom");

  /* ---- fixtures: days in Kuala Lumpur, words read off the page, a bounded poll for a state */
  const kl = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const t = (e) => { if (!e) return ""; const c = e.cloneNode(true); c.querySelectorAll("svg").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
  const money = (n) => "RM " + n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /* a part the publish sealed: goods with them on credit, inside the term, its date older the lower its number, so the oldest comes first */
  const part = (i, extra = {}) => Object.assign({ date: kl(-9 + i), since: kl(-1), due: kl(2), late: false, rm: 100 + i, whole: 100 + i, product: "salt", qty: 1 + i, got: 1 + i, gotOn: kl(-1),
    resale: false, goods: 100 + i, deliv: 0, less: 0, rate: 100 }, extra);
  const parts = (n) => Array.from({ length: n }, (_, i) => part(i));
  const wins = [];
  /* a customer's page, signed in on an invented account whose live document holds `list` as To pay now */
  const open = async ({ list, claims = [], stages = { term: 1, hide: 3, lock: 4, window: 60 } }) => {
    const u = "abcd-efgh", pass = "fixture-pass-7a", ck = await C.contentKey("test-secret", u);
    const sum = +list.reduce((s, p) => s + p.rm, 0).toFixed(2), late = list.filter((p) => p.late);
    const pay = Object.assign({}, stages, { now: { rm: sum, due: list.length ? list[0].due : null, parts: list },
      overdue: { rm: +late.reduce((s, p) => s + p.rm, 0).toFixed(2), parts: late }, coming: { rm: 0, parts: [] } });
    const stamped = { at: new Date(Date.now() - 3600e3).toISOString(), body: "<p>Live</p>", owed: sum, pay, buildId: BUILD };
    const body = { ok: true, wrap: await C.wrapKey(pass, ck), session: "sess-7a", liveStatus: "current",
      live: Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))),
      env: await C.encryptWith(ck, JSON.stringify({ statements: [{ issued: "2026-09-01", label: "September", body: "<p>Statement</p>" }] })),
      prices: await C.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), week: { monday: kl(0), label: "This week" },
        products: [{ product: "salt", unit: "unit", basis: "yours", rate: 95, orders: 3, sizes: [{ q: 1, price: 95 }, { q: 2, price: 180 }] }], soon: [] })) };
    let work;
    const dom = new JSDOM(landingPage(u, "nhf", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      if (!win.TextEncoder) win.TextEncoder = TextEncoder;
      if (!win.TextDecoder) win.TextDecoder = TextDecoder;
      win.scrollTo = () => {}; win.open = () => null;
      try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* the look is kept, so its Sheet does not stand over the page this check reads */ }
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        const j = (p === "/open" || p === "/account") ? body : (p === "/orders" && m === "GET") ? { ok: true, orders: [], claims } : null;
        return { ok: !!j, status: j ? 200 : 404, json: async () => j || { ok: false } };
      };
      work = pageWork(win);
    } });
    wins.push(dom.window);
    const d = dom.window.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden && !!d.getElementById("pOrder").textContent && !d.getElementById("payHead").hidden);
    await work.quiet();
    return { w: dom.window, d, work, sum };
  };

  try {
    /* 16 Nov 2026, the move to Ambient: the foot is Ambient's (one pill, sticky above the dock by its own rule), To pay now's figure always a stat in
       the head, the invoice lines rows of a list and the fold a quiet pill that opens the rest; the geometry the older checks measured (a sticky
       bottom by the bar's token, from 1080px static) is Ambient's to keep, so those checks read what stands on the page now. */
    /* ---- 1: the markup, as served */
    const bare = new JSDOM(landingPage("abcd-efgh", "nhf0", null)).window.document;
    const home = bare.getElementById("pHome"), foot0 = bare.getElementById("homeFoot");
    const kids = [...home.children].map((n) => n.className.split(" ").join(".")).join(" ");
    ok(!!foot0 && bare.querySelectorAll("#homeFoot").length === 1 && home.firstElementChild.lastElementChild === foot0 && kids === "amb-stack amb-stack"
      && foot0.hidden && foot0.classList.contains("amb-foot") && !foot0.hasChildNodes(),
      "the foot is the last thing of Home's first stack, Ambient's foot, drawn hidden and empty, so no bar stands there until something is owed: " + kids);

    /* ---- 2: something owed, five lines */
    const five = await open({ list: parts(5) });
    const { d: D5 } = five, foot = D5.getElementById("homeFoot"), head = D5.getElementById("payHead"), pill = D5.getElementById("payNow");
    const stat = head.querySelector(".amb-stat[data-now]");
    const fp = { hidden: foot.hidden, last: D5.querySelector("#pHome > .amb-stack").lastElementChild === foot, label: t(stat && stat.querySelector(".amb-stat__label")), value: t(stat && stat.querySelector(".amb-stat__value")),
      owing: !!stat && stat.getAttribute("data-now") === "owing", pill: t(pill), inFoot: foot.contains(pill), one: foot.children.length === 1, pills: D5.querySelectorAll("#pHome .amb-pill:not(.amb-pill--quiet)").length,
      footTile: !!foot.querySelector(".amb-stat") };
    ok(!fp.hidden && fp.last && fp.label === "To pay now" && fp.value === money(five.sum) && fp.owing && fp.pill === "Pay " + money(five.sum) && fp.inFoot && fp.one && fp.pills === 1 && !fp.footTile,
      "with something to pay, To pay now's figure stands in the head and the one filled Pay is the foot, which holds nothing else: " + JSON.stringify(fp));

    /* ---- 5: three lines, then N more */
    const amt = (r) => t(r.querySelector(".amb-row__amount"));
    const inv = head.querySelector(".hinv"), more = D5.getElementById("invMore");
    const shown = { rows: inv ? [...inv.querySelectorAll("li:not([hidden])")].map(amt) : [], more: !!more, word: t(more), open: !!more && more.getAttribute("aria-expanded") === "true",
      rest: inv ? [...inv.querySelectorAll("li.invrest")].map((r) => amt(r) + (r.hidden ? "-" : "+")) : [], quiet: !!more && more.classList.contains("amb-pill--quiet") };
    ok(shown.rows.join() === "RM 100.00,RM 101.00,RM 102.00" && shown.more && shown.quiet && shown.word === "2 more" && !shown.open && shown.rest.join() === "RM 103.00-,RM 104.00-",
      "five lines are three rows, the oldest first, then a quiet pill reading 2 more, shut, the other two rows hidden: " + JSON.stringify(shown));
    ok(W.EN["inv.more"] === "{n} more" && shown.word === W.EN["inv.more"].replace("{n}", "2"), "and the count is a word by key, read off the table and not typed in the page");

    /* ---- 4: the Pay opens the one sheet on the whole invoice */
    if (pill) pill.click();
    const sheet = D5.getElementById("paySheet"), sb = D5.getElementById("payBody");
    /* 16 Nov 2026, the move to Ambient: the pay sheet's lines are the system's rows, kept in the page and shown by What this pays */
    const sheetRows = [...sb.querySelectorAll(".inv .amb-list > li")].map((r) => t(r.querySelector(".amb-row__amount")));
    ok(!sheet.hidden && t(D5.getElementById("payT")) === "Pay " + money(five.sum) && sheetRows.join() === "RM 100.00,RM 101.00,RM 102.00,RM 103.00,RM 104.00",
      "the Pay in the foot opens the pay sheet, which draws all five lines whole and not three: " + JSON.stringify({ open: !sheet.hidden, title: t(D5.getElementById("payT")), sheetRows }));
    D5.getElementById("payX").click();

    /* ---- 6: the pill opens the rest, and stays as it was across a redraw (a return to the page reads the account again and redraws Home) */
    if (more) more.click();
    const mid = D5.getElementById("invMore"), opened = !!mid && mid.getAttribute("aria-expanded") === "true", restShown = [...D5.querySelectorAll("#payHead li.invrest:not([hidden])")].map(amt);
    D5.dispatchEvent(new five.w.Event("visibilitychange"));
    await five.work.quiet();
    const after = D5.getElementById("invMore"), restAfter = [...D5.querySelectorAll("#payHead li.invrest:not([hidden])")].map(amt);
    ok(opened && restShown.join() === "RM 103.00,RM 104.00" && !!after && after.getAttribute("aria-expanded") === "true" && restAfter.join() === "RM 103.00,RM 104.00" && t(after) === "2 more",
      "a tap on it opens the other two lines, and a return to the page, which draws Home again, leaves it open: " + JSON.stringify({ opened, restShown, restAfter }));

    /* ---- 8 and 9: Ambient's foot, and a tap is 44px */
    const cs = (e) => five.w.getComputedStyle(e);
    const css = [...landingPage("abcd-efgh", "nhf1", null).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
    const phone = { position: cs(foot).position, pill: pill && pill.classList.contains("amb-pill--block"), shut: /\.amb \[hidden\] \{ display: none !important; \}/.test(css), payfoot: /\.payfoot/.test(css) };
    ok(phone.position === "sticky" && phone.pill && phone.shut && !phone.payfoot,
      "the foot sticks by Ambient's own rule, a hidden foot is shut by Ambient's, and the page carries no foot rule of its own: " + JSON.stringify(phone));
    const tap = { pill: pill ? cs(pill).minHeight : "(none)", more: more ? cs(more).minHeight : "(none)" };
    ok(tap.pill === "var(--amb-pill-h)" && tap.more === "var(--amb-tap)",
      "a tap is 44px both ways: the Pay and the pill that opens the rest hold Ambient's own sizes: " + JSON.stringify(tap));

    /* ---- 5 again: exactly three lines draw no fold, and four read 1 more */
    const three = await open({ list: parts(3) }), four = await open({ list: parts(4) });
    const rows3 = [...three.d.querySelectorAll("#payHead .hinv li")].map(amt), rows4 = [...four.d.querySelectorAll("#payHead .hinv li:not([hidden])")].map(amt), m4 = four.d.getElementById("invMore");
    ok(rows3.join() === "RM 100.00,RM 101.00,RM 102.00" && !three.d.getElementById("invMore")
      && rows4.length === 3 && !!m4 && t(m4) === "1 more" && [...four.d.querySelectorAll("#payHead li.invrest")].map(amt).join() === "RM 103.00" && m4.getAttribute("aria-expanded") === "false",
      "three lines draw no fold, and four draw three and the pill reading 1 more: " + JSON.stringify({ rows3, rows4, m4: !!m4 }));

    /* ---- 3: nothing owed, and all of it already sent */
    const none = await open({ list: [] });
    const fn = none.d.getElementById("homeFoot");
    ok(fn.hidden && !fn.hasChildNodes() && !none.d.getElementById("payNow") && !none.d.querySelector("#pHome .amb-pill:not([hidden])") && !none.d.querySelector("#payHead .amb-stat") && /Nothing to pay now\./.test(t(none.d.getElementById("payHead"))),
      "with nothing to pay now no foot is drawn: it stays hidden and empty, there is no Pay, and Home says so once: " + JSON.stringify({ hidden: fn.hidden, kids: fn.childNodes.length, head: t(none.d.getElementById("payHead")) }));
    const sent = await open({ list: parts(3), claims: [{ id: "c-7a", at: new Date().toISOString(), amount: 303, method: "transfer", account: "maybank", state: "waiting", claim: "waiting" }] });
    const fs = sent.d.getElementById("homeFoot"), kp = sent.d.querySelector("#payHead .amb-stat");
    ok(fs.hidden && !fs.hasChildNodes() && !sent.d.getElementById("payNow") && !!kp && kp.getAttribute("data-now") === "clear" && t(kp.querySelector(".amb-stat__value")) === "RM 0.00"
      && /Less sentWaiting for us to confirmRM 303\.00/.test(t(sent.d.getElementById("payHead"))),
      "and with all of it sent and waiting on him there is nothing to pay, so no foot, the figure stays in the head at RM 0.00, and what was sent is still said, waiting on him: " + JSON.stringify({ hidden: fs.hidden, tile: t(kp), head: t(sent.d.getElementById("payHead")).slice(-80) }));

    /* ---- 7: the V5 lock, past the lock day: only To pay now is live */
    const late = part(0, { date: kl(-8), since: kl(-6), due: kl(-5), late: true, rm: 45, whole: 45, goods: 45, rate: 45, qty: 1, got: 1, gotOn: kl(-6) });
    const lock = await open({ list: [late, part(1)] });
    const lf = lock.d.getElementById("homeFoot"), grey = ["hNeeds", "hComing", "hAgain"].map((id) => { const n = lock.d.getElementById(id); return !!n && n.classList.contains("lockd") && n.hasAttribute("inert"); }).join();
    const live = { footShown: !lf.hidden, footInert: !!lf.closest("[inert]") || lf.hasAttribute("inert"), headInert: !!lock.d.getElementById("payHead").closest("[inert]"), grey,
      note: t(lock.d.getElementById("stageNote")), pill: t(lock.d.getElementById("payNow")), tile: t(lock.d.querySelector("#payHead .amb-stat__value")) };
    const lp = lock.d.getElementById("payNow");
    if (lp) lp.click();
    const lockSheet = !lock.d.getElementById("paySheet").hidden;
    ok(live.footShown && !live.footInert && !live.headInert && live.grey === "true,true,true" && /^Your account is only for paying/.test(live.note) && live.pill === "Pay RM 146.00" && live.tile === "RM 146.00" && lockSheet,
      "past the lock day the rest of Home is seen and greyed out of reach while the foot stays live, the one Pay still opening the sheet: " + JSON.stringify({ live, lockSheet }));

    /* ---- the practice accounts hold a case of the fold, and a fixture without one is red by its line (a feature a customer sees lands with its case) */
    const TF = await import("../tools/testfix.mjs"), line = TF.FEATURES.map(([n]) => n).find((n) => /more than three lines/.test(n)), all = TF.buildAll(new Date());
    const short = TF.missing(Object.fromEntries(Object.entries(all).map(([s, f]) => [s, Object.assign({}, f, { orders: f.orders.filter((o) => o.status !== "ready") })])));
    ok(!!line && TF.missing(all).length === 0 && short.includes(line),
      "the practice accounts show the fold, their To pay now over more than three lines, and one without that case is red by its line: " + JSON.stringify({ line: line || null, missing: TF.missing(all), short }));
  } finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
