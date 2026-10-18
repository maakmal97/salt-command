/* test/counter-glance.mjs: THE GLANCE AT THE HEAD OF ACCOUNT (Counter Batch A, P10, his decision of 18 Oct 2026).
 *
 * To pay now, the very figure Home's tile shows, when it is due and a link to its order; the thread, a reply waiting said; the statement, up
 * to date as at its moment. Nothing in it names a roster code. Every assertion observes a signed-in page in jsdom; each was proved red by its
 * own mutation (test/counter-glance.mutations.json, run with tools/section.mjs). Every code, name and password here is invented.
 *   1  the strip heads Account, owed first: its figure equals To pay now's on Home, ember, its note the line's due word
 *   2  its link opens the order it is for
 *   3  the thread item says a reply is waiting and opens the thread; the statement item says up to date as at its moment
 *   4  nothing to pay: RM 0.00, said in words, and no link
 *   5  no roster code anywhere in it */
import { webcrypto } from "node:crypto";

const BUILD = "c".repeat(16);

export async function run({ ok, pageWork }) {
  const P = await import("../stmt/page.js");
  const C = await import("../tools/stmt-crypto.mjs");
  const { JSDOM } = await import("jsdom");
  const t = (e) => { if (!e) return ""; const c = e.cloneNode(true); c.querySelectorAll("svg").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
  const until = async (f, n = 300) => { for (let i = 0; i < n && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return f(); };
  const kl = (n) => new Date(Date.now() + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
  const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const wins = [];
  const open = async ({ toPay = 0, claims = [] }) => {
    const polls = [];
    const u = "abcd-efgh", pass = "fixture-pass-p10", ck = await C.contentKey("test-secret", u);
    const parts = toPay ? [{ date: kl(-2), since: kl(-1), due: kl(2), late: false, rm: toPay, whole: toPay, product: "salt", qty: 2, got: 2, gotOn: kl(-1), resale: false, goods: toPay, deliv: 0, less: 0, rate: toPay / 2 }] : [];
    const pay = { term: 1, hide: 3, lock: 4, window: 60, now: { rm: toPay, due: parts.length ? parts[0].due : null, parts }, overdue: { rm: 0, parts: [] }, coming: { rm: 0, parts: [] } };
    const stamped = { at: ago(1), body: "<p>Live</p>", owed: toPay, pay, buildId: BUILD };
    const order = { id: "o-owe", status: "done", at: ago(60), product: "salt", qty: 2, unit: "unit", total: toPay || 20, delivery: 0, paid: toPay ? 0 : 20, moved: 2, movedOn: kl(-1), mode: "collect", rowOn: kl(-2),
      history: [{ at: ago(60), status: "placed", by: "customer" }, { at: ago(30), status: "acknowledged", by: "desk" }], msgs: [], payments: [] };
    const thread = { at: ago(1), msgs: [{ by: "customer", text: "Is Friday fine", at: ago(3) }, { by: "desk", text: "Yes, Friday is fine", at: ago(1) }] };
    const body = { ok: true, wrap: await C.wrapKey(pass, ck), session: "sess-p10", liveStatus: "current",
      live: Object.assign({ at: stamped.at, buildId: BUILD }, await C.encryptWith(ck, JSON.stringify(stamped))),
      env: await C.encryptWith(ck, JSON.stringify({ statements: [] })),
      prices: await C.encryptWith(ck, JSON.stringify({ at: new Date().toISOString(), week: { monday: kl(0), label: "This week" },
        products: [{ product: "salt", unit: "unit", basis: "yours", rate: 10, orders: 1, sizes: [{ q: 1, price: 10 }] }], soon: [] })) };
    let work;
    const dom = new JSDOM(P.landingPage(u, "ngl", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.open = () => null; win.HTMLElement.prototype.scrollIntoView = function () {};
      const si = win.setInterval.bind(win);
      win.setInterval = (fn, ms) => { if (ms === P.POLL_MS) { polls.push(fn); return 700 + polls.length; } return si(fn, ms); };
      try { win.localStorage.setItem("salt-look", "tide"); } catch (e) { /* no look Sheet over the page */ }
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        const j = (p === "/open" || p === "/account") ? body : (p === "/orders" && m === "GET") ? { ok: true, orders: [order], claims: claims.slice(), thread } : null;
        return { ok: !!j, status: j ? 200 : 404, json: async () => j || { ok: false } };
      };
      work = pageWork(win);
    } });
    wins.push(dom.window);
    const d = dom.window.document;
    d.getElementById("un").value = u; d.getElementById("pw").value = pass;
    d.getElementById("f").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !d.getElementById("tabs").hidden && !!d.querySelector('#aGlance [data-glance="thread"]') && /lines|reply/.test(t(d.querySelector('#aGlance [data-glance="thread"]'))));
    await work.quiet();
    return { w: dom.window, d, work, claims, polls };
  };
  const sent = (rm) => ({ id: "c-p10", at: ago(0.5), amount: rm, method: "transfer", account: "maybank", state: "waiting", claim: "waiting" });

  try {
    /* ---- 1 and 2: owed */
    const A = await open({ toPay: 46 }), g = A.d.getElementById("aGlance"), owed = g && g.querySelector('[data-glance="owed"]');
    const home = t(A.d.querySelector("#homeFoot .salt-kpi__value"));
    const o = { first: A.d.getElementById("acct").firstElementChild === g, firstItem: g && g.firstElementChild === owed, label: t(owed && owed.querySelector(".salt-glance__label")),
      value: t(owed && owed.querySelector(".salt-glance__value")), home, due: !!owed && owed.classList.contains("salt-glance__item--due"), note: t(owed && owed.querySelector(".salt-glance__note")),
      href: owed ? owed.getAttribute("href") : "", recipe: !!g && g.classList.contains("salt-glance") };
    ok(o.first && o.firstItem && o.recipe && o.label === "To pay now" && o.value === "RM 46.00" && o.value === home && o.due && /^Pay by /.test(o.note) && o.href === "#o=o-owe",
      "the glance heads Account, To pay now first at the very figure Home's tile shows, in ember, with when it is due and a link to its order: " + JSON.stringify(o));
    owed.click();
    await until(() => !!A.d.querySelector('#pOrder .oscreen[data-order="o-owe"]'), 60);
    ok(!A.d.getElementById("pOrder").hidden && !!A.d.querySelector('#pOrder .oscreen[data-order="o-owe"]'), "and its link opens that order");

    /* ---- 3: the thread and the statement */
    const th = g.querySelector('[data-glance="thread"]'), st = g.querySelector('[data-glance="stmt"]');
    const s3 = { th: t(th && th.querySelector(".salt-glance__value")), thHref: th ? th.getAttribute("href") : "", st: t(st && st.querySelector(".salt-glance__value")), stNote: t(st && st.querySelector(".salt-glance__note")) };
    ok(s3.th === "A new reply" && s3.thHref === "#thread" && s3.st === "Up to date" && /^As at \d\d \w{3} \d{4}/.test(s3.stNote),
      "the thread item says a reply is waiting, and the statement item says up to date as at its moment: " + JSON.stringify(s3));
    th.click();
    ok(!A.d.getElementById("thSheet").hidden, "the thread item opens the thread");

    /* ---- 4: nothing to pay, all of it sent: the strip follows the poll that brings the claim, with no order moved */
    const S = await open({ toPay: 46 });
    S.claims.push(sent(46)); S.polls.forEach((fn) => fn()); await S.work.quiet();
    const so = S.d.querySelector('#aGlance [data-glance="owed"]');
    ok(!!so && so.tagName === "DIV" && t(so.querySelector(".salt-glance__value")) === "RM 0.00" && t(so.querySelector(".salt-glance__note")) === "Nothing to pay now.",
      "once a claim covering it comes in on the poll, with no order moved, the strip reads RM 0.00 in words and links nowhere: " + (so ? so.outerHTML.slice(0, 160) : "(none)"));
    const Z = await open({ toPay: 0 }), zo = Z.d.querySelector('#aGlance [data-glance="owed"]');
    ok(!!zo && zo.tagName === "DIV" && t(zo.querySelector(".salt-glance__value")) === "RM 0.00" && t(zo.querySelector(".salt-glance__note")) === "Nothing to pay now." && !zo.classList.contains("salt-glance__item--due"),
      "with nothing to pay it reads RM 0.00 and says so in words, not in ember and with no link: " + (zo ? zo.outerHTML.slice(0, 160) : "(none)"));

    /* ---- 5: no roster code */
    const all = g.outerHTML + Z.d.getElementById("aGlance").outerHTML;
    ok(!/\b[A-Z]{2}[0-9]{1,2}-[A-Z]{2,3}\b/.test(all) && !/\b[A-Z]{2}[0-9]{1,2}-[A-Z]{2,3}\b/i.test(t(g)), "nothing in the glance takes a roster code's shape");
  } catch (e) { ok(false, "counter-glance stopped on an error: " + (e && e.stack)); }
  finally { for (const w of wins) { try { w.close(); } catch (e) { /* jsdom */ } } }
}
