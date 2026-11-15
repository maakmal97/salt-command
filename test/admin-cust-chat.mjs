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
    /* 16 Nov 2026, the move to Ambient (place H): a thread is Ambient's row, the open thread Ambient's Thread with its compose box as the pane's foot */
    const sub = (c) => t(c.querySelector(".amb-row__sub"));
    /* 1 */
    const w = card("abcd-efgh"), a = card("tvwx-yz23");
    ok(!!w && !!a && w.classList.contains("amb-row") && sev("abcd-efgh") === "now" && sev("tvwx-yz23") === "watch"
      && /^Waiting \d+ d, owes RM 100 · I will pay on Friday$/.test(sub(w)) && w.querySelector(".amb-row__sub").firstElementChild.classList.contains("amb-neg")
      && /^Answered \d+ d · You: Goes out Friday morning[.]$/.test(sub(a)) && t(w.querySelector(".acode")) === "CX1-ZED"
      && !a.querySelector(".amb-row__amount") && !/owes/.test(sub(a))
      && J([...d.querySelectorAll("#makerChatList h2.amb-section")].map(t)) === J(["To do", "FYI"]) && !d.querySelector("#makerChatList .ncard"),
      "a thread is Ambient's row: Waiting under To do, Answered under FYI, the code, the state and age and the last line, and what they owe: " + J([w && sub(w), a && sub(a)]));
    /* 2 */
    const way = (c) => { const b = c.querySelector(".amb-row__trail .amb-pill"); return b ? t(b) + (b.classList.contains("amb-pill--sm") ? "/small" : "") : "none"; };
    ok(way(w) === "Reply/small" && way(a) === "none", "Reply, a small pill, for one waiting, nothing for one answered: " + J([way(w), way(a)]));
    const sec = d.querySelector(".chatgrid"), wasShut = !sec.classList.contains("open");
    await click(w.querySelector(".amb-row__main"));
    ok(!d.getElementById("makerChatOpen").hidden && d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh", "a tap anywhere on the row opens its thread");
    /* 5 */
    const opened = sec.classList.contains("open") && card("abcd-efgh").getAttribute("aria-current") === "true";
    await click([...d.querySelectorAll("#makerChatOpen button")].find((b) => t(b) === "Close"));
    ok(wasShut && opened && !sec.classList.contains("open") && d.getElementById("makerChatOpen").hidden,
      "with no thread open the list has its column; one opened stands beside it, its row marked, and Close gives the column back: " + J([wasShut, opened, sec.className]));
    await click(card("abcd-efgh").querySelector(".amb-row__main"));
    /* 3 */
    const lines = d.getElementById("makerChatLines"), bubbles = [...lines.querySelectorAll("li.amb-msg")];
    ok(lines.tagName === "OL" && lines.classList.contains("amb-thread") && lines.getAttribute("role") === "log" && J(bubbles.map((b) => b.classList.contains("amb-msg--mine") ? "mine" : "theirs")) === J(["mine", "theirs"])
      && J(bubbles.map((b) => t(b.querySelector(".amb-msg__text")))) === J(["RM 100 is past its term.", "I will pay on Friday"])
      && J(bubbles.map((b) => [...b.querySelectorAll(".amb-msg__meta > *")].map(t).join("|"))) === J(["You|10 Oct 2026|Sent", "CX1-ZED|11 Oct 2026"]),
      "the open thread is the system's Thread, his lines right and theirs left, each saying who and when and his where it is: " + J(bubbles.map(t)));
    /* 4 */
    const head = d.querySelector("#makerChatOpen .chathead");
    const foot = d.querySelector("#makerChatOpen > .amb-foot"), form = foot && foot.querySelector("form.amb-compose");
    ok(!!head && t(head.querySelector("h2.amb-section")) === "CX1-ZED" && t(head.querySelector(".ahead__fig")) === "They owe RM 100" && !!d.getElementById("makerChatStatus").closest(".amb-notice")
      && t(d.getElementById("makerChatStatus")) === "1 waits for your reply."
      && !!form && foot.children.length === 1 && form.querySelector("textarea.amb-input").getAttribute("aria-label") === "Answer them" && form.querySelector("button.amb-circle").getAttribute("data-act") === "chat.send" && d.getElementById("makerChatOpen").lastElementChild === foot,
      "the thread's head names the code and what they owe, the count waiting is the notice, and the compose box is the pane's foot, its last child: " + J([head && t(head), t(d.getElementById("makerChatStatus"))]));
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
