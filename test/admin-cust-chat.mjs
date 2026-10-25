/* test/admin-cust-chat.mjs: SALT ADMIN CUSTOMERS, P5, MESSAGES (26 Oct 2026; canvas Salt Admin Customers). Each check is red under its own mutation
 * (test/admin-cust-chat.mutations.json):
 *   1  a thread is Needs you's card: Waiting (theirs last) under To do, Answered under FYI; the kind and age, the code, their last line, what they owe
 *   2  the way follows the thread: Reply for one waiting, Open for one answered, each filled as a card's one way is on Needs you; a tap on the card opens it
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
    const sev = (u) => card(u) && card(u).closest(".ngroup").getAttribute("data-sev");
    /* 1 */
    const w = card("abcd-efgh"), a = card("tvwx-yz23");
    ok(!!w && !!a && w.classList.contains("ncard") && sev("abcd-efgh") === "now" && sev("tvwx-yz23") === "watch" && /^Waiting · \d+ d$/.test(t(w.querySelector(".nkind")))
      && /^Answered · /.test(t(a.querySelector(".nkind"))) && t(w.querySelector(".need-who")) === "CX1-ZED" && t(w.querySelector(".need-line")) === "I will pay on Friday"
      && t(a.querySelector(".need-line")) === "You: Goes out Friday morning." && t(w.querySelector(".nfig")) === "RM 100" && t(a.querySelector(".nfig")) === ""
      && J([...d.querySelectorAll("#makerChatList .nsev")].map(t)) === J(["To do", "FYI"]),
      "a thread is Needs you's card: Waiting under To do, Answered under FYI, the code, their last line and what they owe: " + J([w && t(w), a && t(a)]));
    /* 2 */
    const way = (c) => { const b = c.querySelector(".salt-action__go button"); return t(b) + (b.classList.contains("salt-pill") ? "" : "/ghost"); };
    ok(way(w) === "Reply" && way(a) === "Open", "Reply for one waiting, Open for one answered, both filled: " + J([way(w), way(a)]));
    await click(w);
    ok(!d.getElementById("makerChatOpen").hidden && d.getElementById("makerChatOpen").getAttribute("data-key") === "abcd-efgh", "a tap on the card opens its thread");
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
}
