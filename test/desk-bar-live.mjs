import { openMaster } from "../tools/payload.mjs";
import { adminRedirect } from "../src/worker.js";

/* 21 Oct 2026, his word: the Desk's bar is complete and persists on every view: every book's Now, what waits on you, this
   device's alerts, and Approve, which opens Salt Admin's Approve through the Worker's /admin so the site's address is never in
   the public desk. Where you are (the destination, the page under it) left the bar on his word of 23 Oct 2026. */
export async function run({ ok }) {
  const { w } = await openMaster();
  try {
    const D = w.document;
    const bar = D.getElementById("deskbar"), live = D.getElementById("deskLive");
    ok(!!live && bar.contains(live) && !live.closest(".sec"),
      "the bar holds what is live, outside every view, so it persists over all of them");
    /* 23 Oct 2026, his word: the Desk's bar no longer says where you are, as Salt Admin's has not since 22 Oct */
    const noWhere = () => !D.getElementById("deskWhere") && !D.getElementById("dwView") && !D.getElementById("dwPage") && !bar.querySelector(".salt-deskbar__where");
    ok(noWhere(), "and no where-you-are");
    w.eval("switchTab('financials')");
    ok(noWhere(), "nor does a move to another view draw one");

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
