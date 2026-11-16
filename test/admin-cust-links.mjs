/* test/admin-cust-links.mjs: SALT ADMIN CUSTOMERS, P6, GUEST LINKS (26 Oct 2026; canvas Salt Admin Customers). Each check is red under its own mutation
 * (test/admin-cust-links.mutations.json):
 *   1  a link is Needs you's card under Waiting on you, Standing link, Made by associates and Older links, in that order
 *   2  its kind and age, who it is for in words (Made by a code while it waits or once declined, Via a code once approved, the note alone), how often it
 *      was opened in the figure's place under Opens, and nothing there for a shut link
 *   3  its one way: Approve while it waits, Restore once withdrawn, Copy otherwise; Approve moves the link
 *   4  a tap on the card opens its address, QR and moves under it, and a second shuts them
 * Drawn by the maker harness (test/maker-act.mjs). */
import { richOwnerPage, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;

export async function run({ ok, pageWork }) {
  const p = await richOwnerPage({ pageWork, linksAnswer: (j) => ({ ...j, refs: j.refs.map((r) => (r.id === "o1" ? { ...r, last: "2026-10-12T08:00:00.000Z" } : r)) }) });
  try {
    const d = p.d, click = async (e) => { if (e) e.click(); await p.work.quiet(); };
    await p.work.quiet();
    enter(d, "customers", "links"); await p.work.quiet();
    /* 16 Nov 2026, the move to Ambient (place H): a link is Ambient's row under a head each, its panel the next item of the list, holding the code in the system's frame and its moves as a settings group */
    const card = (id) => d.querySelector('#glist [data-glink="' + id + '"]'), panel = (id) => d.querySelector('#glist .glpanel[data-link="' + id + '"]');
    /* 1 */
    const heads = [...d.querySelectorAll("#glist .glinks > h2.amb-section")].map(t), inGroup = (id) => t(card(id).closest(".glinks").querySelector("h2.amb-section"));
    ok(J(heads) === J(["Waiting on you", "Standing link", "Made by associates", "Older links"]) && inGroup("w1") === "Waiting on you" && inGroup("s1") === "Standing link"
      && inGroup("r1") === "Made by associates" && inGroup("d1") === "Made by associates" && inGroup("o1") === "Older links" && card("o1").classList.contains("amb-row"),
      "a link is Ambient's row under its group, waiting first: " + J(heads));
    /* 2 */
    const title = (id) => [...card(id).querySelector(".amb-row__title").children].map(t).join(" "), kind = (id) => t(card(id).querySelector(".amb-row__sub")), fig = (id) => (kind(id).match(/opened \d+ times?/) || [""])[0];
    ok(/^Waiting, \d+ d$/.test(kind("w1")) && title("w1") === "Made by CX1-ZED" && title("r1") === "Via CX1-ZED" && title("d1") === "Made by CX1-ZED" && title("o1") === "A shop"
      && title("s1") === "Median Price list" && kind("o1") === "Opened, 12 Oct 2026, opened 2 times" && kind("d1").startsWith("Declined") && kind("r1").startsWith("Withdrawn") && kind("s1").startsWith("Standing")
      && fig("o1") === "opened 2 times" && fig("s1") === "opened 0 times" && fig("w1") === "" && fig("d1") === "",
      "its state and age, who it is for, and how often it was opened, none said for a shut link: " + J(["w1", "r1", "d1", "o1", "s1"].map((id) => [kind(id), title(id), fig(id)])));
    /* 3 */
    const way = (id) => t(card(id).querySelector(".amb-row__trail button"));
    ok(way("w1") === "Approve" && way("r1") === "Restore" && way("o1") === "Copy" && way("s1") === "Copy" && card("w1").querySelectorAll(".amb-row__trail button").length === 1 && card("w1").querySelector(".amb-row__trail .amb-pill--sm"),
      "Approve while it waits, Restore once withdrawn, Copy otherwise: " + J(["w1", "r1", "o1", "s1"].map(way)));
    p.posts.length = 0;
    await click(card("w1").querySelector(".amb-row__trail button"));
    ok(p.posts.some((x) => x.route === "/all/refs/w1/approve"), "Approve moves the link: " + J(p.posts.map((x) => x.route)));
    /* 4 */
    const shut = panel("o1").hidden;
    await click(card("o1").querySelector(".amb-row__main"));
    const opened = !panel("o1").hidden && !!panel("o1").querySelector(".amb-codeframe__field > img") && /example\.test\/g\/o1/.test(t(panel("o1").querySelector(".gu"))) && card("o1").querySelector(".amb-row__main").getAttribute("aria-expanded") === "true"
      && !!panel("o1").querySelector(".amb-settings button.amb-action[data-act='link.withdraw']");
    await click(card("o1").querySelector(".amb-row__main"));
    ok(shut && opened && panel("o1").hidden, "a tap opens its address, QR and moves under it, and a second shuts them");
  } finally { p.w.close(); }
}
