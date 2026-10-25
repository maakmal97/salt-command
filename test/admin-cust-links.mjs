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
    const card = (id) => d.querySelector('#glist [data-glink="' + id + '"]'), panel = (id) => d.querySelector('#glist .glink[data-link="' + id + '"]');
    /* 1 */
    const heads = [...d.querySelectorAll("#glist .ngroup > .nsev")].map(t), inGroup = (id) => t(card(id).closest(".ngroup").querySelector(".nsev"));
    ok(J(heads) === J(["Waiting on you", "Standing link", "Made by associates", "Older links"]) && inGroup("w1") === "Waiting on you" && inGroup("s1") === "Standing link"
      && inGroup("r1") === "Made by associates" && inGroup("d1") === "Made by associates" && inGroup("o1") === "Older links" && card("o1").classList.contains("ncard"),
      "a link is Needs you's card under its group, waiting first: " + J(heads));
    /* 2 */
    const title = (id) => [...card(id).querySelector(".salt-action__title").children].map(t).join(" "), kind = (id) => t(card(id).querySelector(".nkind")), fig = (id) => t(card(id).querySelector(".nfig"));
    ok(/^Waiting · \d+ d$/.test(kind("w1")) && title("w1") === "Made by CX1-ZED" && title("r1") === "Via CX1-ZED" && title("d1") === "Made by CX1-ZED" && title("o1") === "A shop"
      && title("s1") === "Set Price list" && kind("o1") === "Opened · 12 Oct 2026" && kind("d1").startsWith("Declined") && kind("r1").startsWith("Withdrawn") && kind("s1").startsWith("Standing")
      && fig("o1") === "Opens2" && fig("s1") === "Opens0" && fig("w1") === "" && fig("d1") === "",
      "its kind and age, who it is for, and its opens under Opens, none for a shut link: " + J(["w1", "r1", "d1", "o1", "s1"].map((id) => [kind(id), title(id), fig(id)])));
    /* 3 */
    const way = (id) => t(card(id).querySelector(".salt-action__go button"));
    ok(way("w1") === "Approve" && way("r1") === "Restore" && way("o1") === "Copy" && way("s1") === "Copy" && card("w1").querySelectorAll(".salt-action__go button").length === 1,
      "Approve while it waits, Restore once withdrawn, Copy otherwise: " + J(["w1", "r1", "o1", "s1"].map(way)));
    p.posts.length = 0;
    await click(card("w1").querySelector(".salt-action__go button"));
    ok(p.posts.some((x) => x.route === "/all/refs/w1/approve"), "Approve moves the link: " + J(p.posts.map((x) => x.route)));
    /* 4 */
    const shut = panel("o1").hidden;
    await click(card("o1"));
    const opened = !panel("o1").hidden && !!panel("o1").querySelector("img") && /example\.test\/g\/o1/.test(t(panel("o1").querySelector(".gu"))) && card("o1").getAttribute("aria-expanded") === "true";
    await click(card("o1"));
    ok(shut && opened && panel("o1").hidden, "a tap opens its address, QR and moves under it, and a second shuts them");
  } finally { p.w.close(); }
}
