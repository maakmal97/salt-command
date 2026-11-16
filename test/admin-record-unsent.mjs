/* test/admin-record-unsent.mjs: SALT ADMIN RECORD, P2, AN UNSENT ENTRY IS A CARD (25 Oct 2026; his canvas Salt Admin Record and his Ask C). What is proved here, each
 * check red under its own mutation (test/admin-record-unsent.mutations.json):
 *   1  under Unsent on this phone, once in each part that holds one, an entry is Needs you's one shape: its kind and age, the book's typed tag and the code (or,
 *      with no code, the entry's word), one pill and the figure last
 *   2  the one pill is Resend, spoken Send again; the second choices, Update and send and Discard (the refusing one), wait in the card opened, with the sentence
 *   3  a tap on the card opens it and a second shuts it, its state spoken
 *   4  the page's rules: beside the menu the card keeps the phone's columns and pill at every width, and opened its second choices lie two up
 * Drawn by the maker harness (test/maker-act.mjs), which keeps one loan unsent on the phone. */
import { richOwnerPage, byAct, enter } from "./maker-act.mjs";

const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const J = JSON.stringify;
const KEEP = "saltMakerPending:";

export async function run({ ok, pageWork }) {
  const count = { path: "/all/maker/inputs/stock-count", body: { at: "2026-10-09T05:00:00.000Z", product: "salt", date: "2026-10-09", qty: 12 } };
  const sale = { path: "/all/maker/inputs/sale", body: { at: "2026-10-09T06:00:00.000Z", product: "salt", party: "CX2-ZED", date: "2026-10-09", qty: 5, total: 58, cash: 0, movedUnits: 0, handover: null, delivery: 0 } };
  const p = await richOwnerPage({ pageWork, retained: [[KEEP + count.path, J(count)], [KEEP + sale.path, J(sale)]] });
  try {
    await p.work.quiet();
    const d = p.d, quiet = () => p.work.quiet();
    enter(d, "record"); await quiet();
    const sec = (k) => d.querySelector('#makerInputs section.unsent[data-key="' + k + '"]');
    /* 16 Nov 2026, the move to Ambient (end pass): the card is Ambient's task, as Needs you's is: a head (kind, age, chip), the title, the figure, the way on */
    const shape = (s) => { const c = s && s.querySelector("article.unsent-card"); return c ? [...c.children].map((x) => x.classList.contains("amb-task__head") ? "head" : x.classList.contains("amb-task__title") ? "title" : x.classList.contains("amb-task__figures") ? "fig" : x.classList.contains("amb-task__acts") ? "go" : x.className) : null; };
    /* 1 */
    const heads = [...d.querySelectorAll("#makerInputs .unsent-head")].map((h) => [h.getAttribute("data-in"), t(h)]);
    const saleCard = sec("sale") && sec("sale").querySelector("article.unsent-card");
    const tag = saleCard && saleCard.querySelector(".need-tap .amb-chip");
    ok(J(heads) === J([["record.entry", "Unsent"]]) && !!d.querySelector("#makerInputs h2.amb-section.unsent-head")   /* 27 Oct 2026: the head is one word, the tab says where */ && ["sale", "stock-count"].every((k) => J(shape(sec(k))) === J(k === "sale" ? ["head", "title", "fig", "go"] : ["head", "title", "go"])) && J(shape(sec("loan"))).includes("head")
      && saleCard.classList.contains("amb-task") && saleCard.classList.contains("amb-task--warn") && /^Sale · \d+ (min|h|d)$/.test(t(saleCard.querySelector(".nkind"))) && t(saleCard.querySelector(".amb-chip--warn")) === "Unsent"
      && !!tag && /\bamb-kind-1\b/.test(tag.className) && t(saleCard.querySelector(".need-who--code")) === "CX2-ZED" && /RM 58/.test(t(saleCard.querySelector(".nfig")))
      && t(sec("stock-count").querySelector(".need-who")) === "Unsent stock count" && !sec("stock-count").querySelector(".nfig"),
      "under one Unsent, each entry is the one shape, kind and age, the typed book and the code (the word where there is none), the pill and the figure: " + J([heads, t(saleCard)]));
    /* 2 */
    const go = [...saleCard.querySelectorAll(".amb-task__acts button")];
    const open = sec("sale").querySelector(".unsent-open"), ways = [...open.querySelectorAll(".unsent-ways li button")];
    ok(go.length === 1 && t(go[0]) === "Resend" && go[0].getAttribute("aria-label") === "Send again" && go[0].classList.contains("amb-pill") && !go[0].classList.contains("amb-pill--quiet") && go[0].getAttribute("data-act") === "record.retained.retry"
      && open.hidden && J(ways.map((b) => [t(b), b.getAttribute("data-act"), b.classList.contains("amb-action"), b.classList.contains("amb-action--danger")]))
        === J([["Update and send", "record.retained.review", true, false], ["Discard", "record.retained.cancel", true, true]])
      && /^A sale you sent on .* was not confirmed[.] Send it again, or update it first[.]$/.test(t(open.querySelector('[role="status"]'))),
      "one pill, Resend (spoken Send again); Update and send and Discard, the refusing one, wait in the opened card with the sentence: " + J([go.map(t), ways.map(t), t(open)]));
    /* 3 */
    const tap = saleCard.querySelector(".need-tap");
    tap.click(); await quiet();
    const on = [open.hidden, tap.getAttribute("aria-expanded")];
    tap.click(); await quiet();
    ok(J(on) === J([false, "true"]) && open.hidden && tap.getAttribute("aria-expanded") === "false" && tap.getAttribute("data-act") === "record.retained.open",
      "a tap on the card opens it and a second shuts it, its state spoken: " + J([on, open.hidden]));
    /* 4 */
    const css = [...d.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    /* 16 Nov 2026, the move to Ambient (place I): the menu's column is Ambient's stack, so the page's 72px card columns beside it went; the card itself is Needs you's (builder F draws it) */
    /* 16 Nov 2026, the move to Ambient (end pass): the card is Needs you's task (.ntask), so the whole card is the tap and its ways stand above it by the rules the list's card has; the second choices are a settings list */
    const flat = css.replace(/\s+/g, " ");
    ok(!/\.adm \.reclist/.test(css) && /\.ntask \.need-tap::after \{ content: ""; position: absolute; inset: 0; \}/.test(flat) && /\.ntask \.amb-task__acts, \.ntask \.nbody \{ position: relative; z-index: 1; \}/.test(flat)
      && saleCard.classList.contains("ntask") && !!open.querySelector(".amb-settings.unsent-ways > ul.amb-settings__list"),
      "the card is the list's task, so the whole card is the tap and its pill stands above it, and its second choices are a settings list");
  } finally { p.w.close(); }
}
