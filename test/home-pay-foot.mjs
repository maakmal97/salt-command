/* test/home-pay-foot.mjs: HOME LEADS WITH THE ONE ACTION (Phase 7a of the Salt Account and Counter redesign, his yes of 11 Oct 2026).
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
    /* ---- 1: the markup, as served */
    const bare = new JSDOM(landingPage("abcd-efgh", "nhf0", null)).window.document;
    const home = bare.getElementById("pHome"), foot0 = bare.getElementById("homeFoot");
    const kids = [...home.children].map((n) => n.id || n.className.split(" ")[0]).join(" ");
    ok(!!foot0 && bare.querySelectorAll("#homeFoot").length === 1 && home.lastElementChild === foot0 && kids === "hcol hcol hLive homeFoot"
      && foot0.hidden && foot0.classList.contains("payfoot") && !foot0.hasChildNodes(),
      "the foot is Home's last child, after both columns and the live order, drawn hidden and empty, so no bar stands there until something is owed: " + kids);

    /* ---- 2: something owed, five lines */
    const five = await open({ list: parts(5) });
    const { d: D5 } = five, foot = D5.getElementById("homeFoot"), head = D5.getElementById("payHead"), pill = D5.getElementById("payNow");
    const fp = { hidden: foot.hidden, last: D5.getElementById("pHome").lastElementChild === foot, label: t(foot.querySelector(".salt-kpi__label")), value: t(foot.querySelector(".salt-kpi__value")),
      ember: !!foot.querySelector(".salt-kpi--ember"), pill: t(pill), inFoot: foot.contains(pill), pills: D5.querySelectorAll("#pHome .salt-pill").length,
      headHolds: !!head.querySelector(".salt-kpi, .salt-pill, #payNow") };
    ok(!fp.hidden && fp.last && fp.label === "To pay now" && fp.value === money(five.sum) && fp.ember && fp.pill === "Pay " + money(five.sum) && fp.inFoot && fp.pills === 1 && !fp.headHolds,
      "with something to pay, To pay now's tile, in ember for what they owe, and the one filled Pay stand in the foot, and the head keeps neither: " + JSON.stringify(fp));

    /* ---- 5: three lines, then N more */
    const rowsOf = (box) => [...box.querySelectorAll(":scope > .salt-ledger__row")].map((r) => t(r.querySelector(".salt-ledger__value")));
    const inv = head.querySelector(":scope > .inv"), more = D5.getElementById("invMore"), sm = more && more.querySelector("summary");
    const shown = { rows: inv ? rowsOf(inv) : [], more: !!more, word: t(sm), open: !!more && more.open, rest: more ? rowsOf(more.querySelector(".inv")) : [], parent: more ? more.parentElement === inv : false };
    ok(shown.rows.join() === "RM 100.00,RM 101.00,RM 102.00" && shown.more && shown.parent && shown.word === "2 more" && !shown.open && shown.rest.join() === "RM 103.00,RM 104.00",
      "five lines are three in the list, the oldest first, then the fold reading 2 more, shut, with the other two inside it: " + JSON.stringify(shown));
    ok(W.EN["inv.more"] === "{n} more" && shown.word === W.EN["inv.more"].replace("{n}", "2"), "and the count is a word by key, read off the table and not typed in the page");

    /* ---- 4: the Pay opens the one sheet on the whole invoice */
    if (pill) pill.click();
    const sheet = D5.getElementById("paySheet"), sb = D5.getElementById("payBody");
    const sheetRows = [...sb.querySelectorAll(".inv > .salt-ledger__row:not(.invt):not(.invtot)")].map((r) => t(r.querySelector(".salt-ledger__value")));
    ok(!sheet.hidden && t(D5.getElementById("payT")) === "Pay " + money(five.sum) && sheetRows.join() === "RM 100.00,RM 101.00,RM 102.00,RM 103.00,RM 104.00",
      "the Pay in the foot opens the pay sheet, which draws all five lines whole and not three: " + JSON.stringify({ open: !sheet.hidden, title: t(D5.getElementById("payT")), sheetRows }));
    D5.getElementById("payX").click();

    /* ---- 6: the fold opens, and stays as it was across a redraw (a return to the page reads the account again and redraws Home) */
    let toggled = false;
    if (more) more.addEventListener("toggle", () => { toggled = true; });
    if (sm) sm.click();
    await until(() => toggled, 60);
    const mid = D5.getElementById("invMore"), opened = !!mid && mid.open, restShown = mid ? [...mid.querySelectorAll(".salt-ledger__row")].map((r) => t(r.querySelector(".salt-ledger__value"))) : [];
    D5.dispatchEvent(new five.w.Event("visibilitychange"));
    await five.work.quiet();
    const after = D5.getElementById("invMore");
    ok(opened && restShown.join() === "RM 103.00,RM 104.00" && !!after && after.open && t(after.querySelector("summary")) === "2 more",
      "a tap on it opens the other two lines, and a return to the page, which draws Home again, leaves it open: " + JSON.stringify({ opened, restShown, after: !!after && after.open }));

    /* ---- 8 and 9: the cascade a phone reads, and the desktop's by its width query made to hold */
    const cs = (e) => five.w.getComputedStyle(e);
    const bar = D5.querySelector("nav.salt-appbar"), z = (e) => +cs(e).zIndex;
    const phone = { position: cs(foot).position, bottom: cs(foot).bottom, zFoot: z(foot), zBar: z(bar), display: cs(foot).display };
    ok(phone.position === "sticky" && /var\(--salt-bar-h\)/.test(phone.bottom) && /safe-area-inset-bottom/.test(phone.bottom) && phone.zFoot > 0 && phone.zFoot < phone.zBar && phone.zBar < 70 && phone.display === "flex",
      "on a phone the foot sticks, its bottom edge the App bar's own height token and the safe area above the screen's edge, in front of the page and behind the bar, which stays behind the sheet: " + JSON.stringify(phone));
    const holds = (q, px) => q.split(",").some((one) => { const fs = one.split(/\band\b/).map((s) => s.trim()).filter(Boolean);
      return fs.length > 0 && fs.every((f) => { const x = /^\(\s*(min|max)-width\s*:\s*([\d.]+)px\s*\)$/.exec(f); return !!x && (x[1] === "min" ? px >= +x[2] : px <= +x[2]); }); });
    const at = (html, px) => html.replace(/@media\s*([^{]+)\{/g, (m, q) => (holds(q, px) ? "@media all{" : m));
    const wide = new JSDOM(at(landingPage("abcd-efgh", "nhf1", null), 1280)), wf = wide.window.document.getElementById("homeFoot");
    const wideCs = wide.window.getComputedStyle(wf);
    ok(wideCs.position === "static" && wide.window.getComputedStyle(wide.window.document.querySelector("nav.salt-appbar")).display === "none",
      "from 1080px, where the rail stands for the bar, the foot is in the flow and not stuck: " + JSON.stringify({ position: wideCs.position }));
    wide.window.close();
    /* jsdom lets .payfoot's display beat the attribute's, which no browser does, so the rule that shuts a hidden foot is read off the sheet the page carries */
    const rules = [...D5.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => r.selectorText === ".payfoot[hidden]");
    ok(rules.length === 1 && rules[0].style.getPropertyValue("display") === "none",
      "a foot drawn hidden is shut by the page's own rule, since its display would otherwise keep an empty bar on show: " + JSON.stringify(rules.map((r) => r.cssText)));
    const tap = { pill: pill ? cs(pill).minHeight : "(none)", summary: sm ? cs(sm).minHeight : "(none)" };
    ok(tap.pill === "var(--salt-tap)" && tap.summary === "var(--salt-tap)",
      "a tap is 44px both ways: the Pay and the fold's summary hold the design system's tap size: " + JSON.stringify(tap));

    /* ---- 5 again: exactly three lines draw no fold, and four read 1 more */
    const three = await open({ list: parts(3) }), four = await open({ list: parts(4) });
    const rows3 = rowsOf(three.d.querySelector("#payHead > .inv")), rows4 = rowsOf(four.d.querySelector("#payHead > .inv")), m4 = four.d.getElementById("invMore");
    ok(rows3.join() === "RM 100.00,RM 101.00,RM 102.00" && !three.d.getElementById("invMore") && !three.d.querySelector("#payHead details")
      && rows4.length === 3 && !!m4 && t(m4.querySelector("summary")) === "1 more" && rowsOf(m4.querySelector(".inv")).join() === "RM 103.00" && !m4.open,
      "three lines draw no fold, and four draw three and the fold reading 1 more: " + JSON.stringify({ rows3, rows4, m4: !!m4 }));

    /* ---- 3: nothing owed, and all of it already sent */
    const none = await open({ list: [] });
    const fn = none.d.getElementById("homeFoot");
    ok(fn.hidden && !fn.hasChildNodes() && !none.d.getElementById("payNow") && !none.d.querySelector("#pHome .salt-pill") && !none.d.querySelector("#payHead .salt-kpi") && /Nothing to pay now\./.test(t(none.d.getElementById("payHead"))),
      "with nothing to pay now no foot is drawn: it stays hidden and empty, there is no Pay, and Home says so once: " + JSON.stringify({ hidden: fn.hidden, kids: fn.childNodes.length, head: t(none.d.getElementById("payHead")) }));
    const sent = await open({ list: parts(3), claims: [{ id: "c-7a", at: new Date().toISOString(), amount: 303, method: "transfer", account: "maybank", state: "waiting", claim: "waiting" }] });
    const fs = sent.d.getElementById("homeFoot"), kp = sent.d.querySelector("#payHead .salt-kpi");
    ok(fs.hidden && !fs.hasChildNodes() && !sent.d.getElementById("payNow") && !!kp && !!kp.classList.contains("salt-kpi--verdigris") && t(kp.querySelector(".salt-kpi__value")) === "RM 0.00"
      && /Less sentRM 303\.00Waiting for us to confirm/.test(t(sent.d.getElementById("payHead"))),
      "and with all of it sent and waiting on him there is nothing to pay, so no foot, the tile stays in the head at RM 0.00, and what was sent is still said, waiting on him: " + JSON.stringify({ hidden: fs.hidden, tile: t(kp), head: t(sent.d.getElementById("payHead")).slice(-80) }));

    /* ---- 7: the V5 lock, past the lock day: only To pay now is live */
    const late = part(0, { date: kl(-8), since: kl(-6), due: kl(-5), late: true, rm: 45, whole: 45, goods: 45, rate: 45, qty: 1, got: 1, gotOn: kl(-6) });
    const lock = await open({ list: [late, part(1)] });
    const lf = lock.d.getElementById("homeFoot"), grey = ["hNeeds", "hComing", "hAgain"].map((id) => { const n = lock.d.getElementById(id); return !!n && n.classList.contains("lockd") && n.hasAttribute("inert"); }).join();
    const live = { footShown: !lf.hidden, footInert: !!lf.closest("[inert]") || lf.hasAttribute("inert"), headInert: !!lock.d.getElementById("payHead").closest("[inert]"), grey,
      note: t(lock.d.getElementById("stageNote")), pill: t(lock.d.getElementById("payNow")), tile: t(lf.querySelector(".salt-kpi__value")) };
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
