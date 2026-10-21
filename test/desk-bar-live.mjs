import { openMaster } from "../tools/payload.mjs";
import { adminRedirect } from "../src/worker.js";

/* 21 Oct 2026, his word: the Desk's bar is complete and persists on every view: where you are (the destination, the page under
   it), every book's Now, what waits on you, this device's alerts, and Approve, which opens Salt Admin's Approve through the
   Worker's /admin so the site's address is never in the public desk. */
export async function run({ ok }) {
  const { w } = await openMaster();
  try {
    const D = w.document, txt = (id) => (D.getElementById(id) || {}).textContent;
    const bar = D.getElementById("deskbar"), where = D.getElementById("deskWhere"), live = D.getElementById("deskLive");
    ok(!!where && !!live && bar.contains(where) && bar.contains(live) && !where.closest(".sec") && !live.closest(".sec"),
      "the bar holds where you are and what is live, outside every view, so it persists over all of them");
    w.eval("switchTab('pricing')");
    ok(txt("dwView") === "Pricing" && txt("dwPage") === w.eval("TAB_LABEL.pricing"),
      "on Pricing the bar names the destination and its page: " + JSON.stringify([txt("dwView"), txt("dwPage")]));
    w.eval("switchTab('overview')");
    ok(txt("dwView") === "Pricing" && txt("dwPage") === w.eval("TAB_LABEL.overview"), "and follows the page within it: " + JSON.stringify(txt("dwPage")));
    w.eval("switchTab('financials')");
    ok(txt("dwView") === "Money" && txt("dwPage") === w.eval("TAB_LABEL.financials"), "and the destination: " + JSON.stringify([txt("dwView"), txt("dwPage")]));
    w.eval("switchTab('today')");
    ok(txt("dwView") === "Today" && txt("dwPage") === "", "a destination of one page names no page: " + JSON.stringify([txt("dwView"), txt("dwPage")]));

    const now = live.querySelector('[data-dl="now"]'), want = w.eval("railCounts().today") || 0;
    ok(!!now && now.querySelector(".salt-deskbar__n").textContent === String(want),
      "the Now chip carries every book's Now, the rail's figure: " + JSON.stringify([now && now.textContent, want]));
    ok(!live.querySelector('[data-dl="wait"]') && !live.querySelector(".salt-deskbar__act"), "off the cloud the bar draws no Waiting and no Approve");

    w.eval("window.SALT_CLOUD=true; AP_DRAFTS=[{id:'d1'},{id:'d2'},{id:'d3'}]; deskLiveDraw()");
    const act = live.querySelector(".salt-deskbar__act");
    ok(!!act && act.getAttribute("href") === "admin" && act.querySelector(".salt-deskbar__badge").textContent === "3" && !act.classList.contains("is-zero"),
      "on the cloud Approve opens /admin with the rows to approve on its badge: " + JSON.stringify(act && [act.getAttribute("href"), act.textContent]));
    ok(!/workers\.dev|k7m3p2/.test(D.getElementById("deskbar").outerHTML), "and the bar carries no site address");
    ok(!!live.querySelector('[data-dl="wait"]'), "Waiting is drawn on the cloud");
    w.eval("AP_DRAFTS=[]; deskLiveDraw()");
    ok(live.querySelector(".salt-deskbar__act").classList.contains("is-zero"), "with nothing to approve Approve goes quiet");
    D.getElementById("ordAlert").dataset.state = "on"; w.eval("deskLiveDraw()");
    const al = live.querySelector('[data-dl="alerts"]');
    ok(!!al && /Alerts on/.test(al.textContent) && al.classList.contains("salt-deskbar__chip--on"), "this device's alerts read on the bar: " + (al && al.textContent));

    w.eval("switchTab('ledger')"); live.querySelector('[data-dl="now"]').click();
    ok(w.eval("curTab") === "today", "a tap on Now goes to To do: " + w.eval("curTab"));
    w.eval("window.SALT_CLOUD=false");
  } finally { try { w.close(); } catch (e) { } }

  const r = adminRedirect({ ADMIN_URL: "https://site.test/all" });
  ok(r.status === 302 && r.headers.get("location") === "https://site.test/all#orders/approve", "/admin sends the bar's Approve to Salt Admin's Approve: " + r.headers.get("location"));
  ok(adminRedirect({}).status === 404 && adminRedirect({ ADMIN_URL: "http://site.test/all" }).status === 404, "and, unset or not https, answers 404 rather than guess");
}
