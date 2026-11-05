/* test/admin-cust-chat.mjs: SALT ADMIN CUSTOMERS, P5, MESSAGES (26 Oct 2026; canvas Salt Admin Customers). Each check is red under its own mutation
 * (test/admin-cust-chat.mutations.json):
 *   1  a thread is a settings row (5 Nov 2026, his screenshot of cards running into each other): Waiting (theirs last) under To do, Answered under
 *      FYI, each a head over one list; the code, then the state, its age and the last line on one line, and what they owe
 *   2  Reply, a lit ghost, only on one waiting, a chevron on one answered; a tap anywhere on the row opens it
 *   5  with no thread open the list has its own column; a thread opened stands beside it with its row marked, and Close gives the column back
 *   3  the open thread is the system's Thread: their lines left, his right, each saying who and when
 *   4  its head names the code and what they owe; the count waiting is the Insight
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const ISO = "2026-10-10T08:00:00.000Z", LATER = "2026-10-11T08:00:00.000Z";

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, threads: () => ({ ok: true, threads: [
    { u: "tvwx-yz23", msgs: [{ by: "customer", at: ISO, text: "Before noon please" }, { by: "desk", at: LATER, text: "Goes out Friday morning." }], quiet: null },
    { u: "abcd-efgh", msgs: [{ by: "desk", at: ISO, text: "RM 100 is past its term." }, { by: "customer", at: LATER, text: "I will pay on Friday" }], quiet: null }
  ] }) });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "messages"); await p.work.quiet(); await p.work.quiet();
    const card = (u) => d.querySelector('#makerChatList [data-thread="' + u + '"]');
    const sev = (u) => card(u) && card(u).closest("section").getAttribute("data-sev");
    const sub = (c) => t(c.querySelector(".salt-settings__sub"));
    /* 1 */
    const w = card("abcd-efgh"), a = card("tvwx-yz23");
    ok(!!w && !!a && w.classList.contains("salt-settings__row") && sev("abcd-efgh") === "now" && sev("tvwx-yz23") === "watch"
      && /^Waiting \d+ d · I will pay on Friday$/.test(sub(w)) && w.querySelector(".salt-settings__sub").classList.contains("salt-settings__sub--why")
      && /^Answered \d+ d · You: Goes out Friday morning[.]$/.test(sub(a)) && t(w.querySelector(".acode")) === "CX1-ZED"
      && t(w.querySelector(".salt-settings__value")) === "RM 100" && !a.querySelector(".salt-settings__value")
      && J([...d.querySelectorAll("#makerChatList .salt-settings__head")].map(t)) === J(["To do", "FYI"]) && !d.querySelector("#makerChatList .ncard"),
      "a thread is a settings row: Waiting under To do, Answered under FYI, the code, the state and age and the last line, and what they owe: " + J([w && sub(w), a && sub(a)]));
    /* 2 */
    const way = (c) => { const b = c.querySelector("button"); return b ? t(b) + (b.classList.contains("salt-ghost--lit") ? "/lit" : "") : c.querySelector(".salt-settings__mark") ? "chevron" : "none"; };
    ok(way(w) === "Reply/lit" && way(a) === "chevron", "Reply, a lit ghost, for one waiting, a chevron for one answered: " + J([way(w), way(a)]));
    const sec = d.querySelector(".chatgrid"), wasShut = !sec.classList.contains("open");
    await click(w);
    ok(!d.getElementById("makerChatOpen").hidden && d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh", "a tap anywhere on the row opens its thread");
    /* 5 */
    const opened = sec.classList.contains("open") && card("abcd-efgh").getAttribute("aria-current") === "true";
    await click([...d.querySelectorAll("#makerChatOpen button")].find((b) => t(b) === "Close"));
    ok(wasShut && opened && !sec.classList.contains("open") && d.getElementById("makerChatOpen").hidden,
      "with no thread open the list has its column; one opened stands beside it, its row marked, and Close gives the column back: " + J([wasShut, opened, sec.className]));
    await click(card("abcd-efgh"));
    /* 3 */
    const lines = d.getElementById("makerChatLines"), bubbles = [...lines.querySelectorAll(".salt-bubble")];
    ok(lines.classList.contains("salt-thread__lines") && lines.getAttribute("role") === "log" && J(bubbles.map((b) => b.classList.contains("salt-bubble--mine") ? "mine" : b.classList.contains("salt-bubble--theirs") ? "theirs" : "?")) === J(["mine", "theirs"])
      && J(bubbles.map((b) => t(b.querySelector(".salt-bubble__text")))) === J(["RM 100 is past its term.", "I will pay on Friday"])
      && J(bubbles.map((b) => t(b.querySelector(".salt-bubble__meta")))) === J(["You, 10 Oct 2026", "CX1-ZED, 11 Oct 2026"]),
      "the open thread is the system's Thread, his lines right and theirs left, each saying who and when: " + J(bubbles.map(t)));
    /* 4 */
    const head = d.querySelector("#makerChatOpen .chathead");
    ok(!!head && t(head.querySelector("h3")) === "CX1-ZED" && t(head.querySelector(".ahead__rm")) === "RM 100" && d.getElementById("makerChatStatus").classList.contains("salt-insight")
      && t(d.getElementById("makerChatStatus")) === "1 waits for your reply.",
      "the thread's head names the code and what they owe, and the count waiting is the Insight: " + J([head && t(head), t(d.getElementById("makerChatStatus"))]));
  } finally { p.w.close(); }
  /* 6 (5 Nov 2026, his screenshot read "0 wait for your reply."): with every thread answered the Insight says so in words */
  const q = await richOwnerPage({ pageWork, threads: () => ({ ok: true, threads: [
    { u: "tvwx-yz23", msgs: [{ by: "customer", at: ISO, text: "Before noon please" }, { by: "desk", at: LATER, text: "Goes out Friday morning." }], quiet: null }
  ] }) });
  try {
    await q.work.quiet(); enter(q.d, "customers", "messages"); await q.work.quiet(); await q.work.quiet();
    const said = t(q.d.getElementById("makerChatStatus"));
    ok(said === "Nothing waits for your reply.", "with every thread answered the Insight says nothing waits, never a nought: " + said);
  } finally { q.w.close(); }
}
