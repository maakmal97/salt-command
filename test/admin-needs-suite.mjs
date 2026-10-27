/* test/admin-needs-suite.mjs: A RED SUITE ON SALT ADMIN'S NEEDS YOU IS ONE FYI LINE (28 Oct 2026, his screenshot of four cards reading "Entry · 4 h / Desk / Fix").
 * cloud-commit writes a red suite as the refusal suite:<version>; it is the Desk informing him, not an entry of his. What is proved here, each check red
 * under its own mutation (test/admin-needs-suite.mutations.json):
 *   1  the suite rows draw one card, FYI, kind Tests, titled with the newest version, with no button
 *   2  the other refusal still draws its Entry card, To do, its reason as the title on one line, so no card reads Desk alone
 *   3  Orders > Approve lists no suite row
 *   4  from 860px the card opens beside the list with the Desk's reason in full
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, byAct } from "./maker-act.mjs";

const J = JSON.stringify;
const WHY = (v) => "The desk's own tests failed after " + v + " went live; the phone is serving " + v + " and working. The next desk session reads run 1 and fixes them.";
const REDS = [
  { id: "suite:v1296", why: WHY("v1296"), party: null, source: "fold", seenAt: new Date(Date.now() - 5 * 3600000).toISOString() },
  { id: "suite:v1297", why: WHY("v1297"), party: null, source: "fold", seenAt: new Date(Date.now() - 4 * 3600000).toISOString() },
  { id: "suite:v1295", why: WHY("v1295"), party: null, source: "fold", seenAt: new Date(Date.now() - 6 * 3600000).toISOString() },
];
const review = (j) => ({ ...j, refused: [...REDS, { id: "2026-10-27T01:00:00.000Z", why: "the entry has no date", party: "CX1-ZED", source: "cloud-drafter", seenAt: "2026-10-27T01:00:00.000Z" }] });

export async function run({ ok, pageWork }) {
  let p = await richOwnerPage({ pageWork, review });
  try {
    await p.work.quiet();
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await click(byAct(d, "nav.needs"));
    const card = (k) => d.querySelector('#nlist [data-need="' + k + '"]');
    const all = [...d.querySelectorAll("#nlist [data-need]")].map((c) => c.getAttribute("data-need"));
    /* 1 */
    const s = card("x:suite"), title = s && s.querySelector(".need-who");
    ok(!!s && all.filter((k) => k === "x:suite").length === 1 && s.getAttribute("data-sev") === "watch" && /^Tests/.test(s.querySelector(".nkind").textContent)
      && title.textContent === "Desk tests red after v1297" && s.querySelectorAll("button.salt-pill, button.nbtn").length === 0 && !s.querySelector(".need-tap")
      && !all.some((k) => /^x:[0-2]$/.test(k)),
      "the red suite is one FYI card, Tests, after its newest version, with no button and no tap on a phone, and no Entry card for any suite row: " + J([all, s && s.textContent]));
    /* 2 */
    const e = card("x:3"), et = e && e.querySelector(".need-who");
    ok(!!e && e.getAttribute("data-sev") === "now" && et.textContent === "Not taken: add the date" && e.querySelectorAll("button.nbtn").length === 1,
      "a real refusal keeps its Entry card and Fix, its reason the title, so the card never reads Desk alone: " + J(e && e.textContent));
    /* 3 */
    const root = d.getElementById("makerDrafts");
    ok(!!root && !/tests failed after/.test(root.textContent) && /add the date/.test(root.textContent), "Approve lists the real refusal and no red suite: " + J(root.textContent.slice(0, 200)));
  } finally { p.w.close(); }

  /* 4 */
  p = await richOwnerPage({ pageWork, review, before: (win) => { win.matchMedia = (mq) => ({ matches: /min-width:\s*860px/.test(mq) && !/max-width/.test(mq), media: mq, addEventListener() {}, removeEventListener() {}, addListener() {} }); } });
  try {
    await p.work.quiet();
    const d = p.d;
    byAct(d, "nav.needs").click(); await p.work.quiet();
    byAct(d, "need.open", "x:suite").click(); await p.work.quiet();
    const pane = d.querySelector("#nopen .npane");
    ok(!!pane && /tests failed after v1297 went live/.test(pane.textContent) && /Earlier red runs: 2/.test(pane.textContent) && pane.querySelectorAll(".npane__go button").length === 0,
      "from 860px the red suite opens beside the list with the Desk's reason in full and nothing to tap: " + J(pane && pane.textContent));
  } finally { p.w.close(); }
}
