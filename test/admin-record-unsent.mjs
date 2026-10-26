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
    const shape = (s) => { const c = s && s.querySelector("article.ncard"); return c ? [...c.children].map((x) => x.classList.contains("nkind") ? "kind" : x.classList.contains("salt-action__body") ? "body" : x.classList.contains("salt-action__go") ? "go" : x.classList.contains("nfig") ? "fig" : x.className) : null; };
    /* 1 */
    const heads = [...d.querySelectorAll("#makerInputs .unsent-head")].map((h) => [h.getAttribute("data-in"), t(h)]);
    const saleCard = sec("sale") && sec("sale").querySelector("article.ncard");
    const tag = saleCard && saleCard.querySelector(".need-tap .salt-producttag");
    ok(J(heads) === J([["record.entry", "Unsent"]])   /* 27 Oct 2026: the head is one word, the tab says where */ && ["sale", "stock-count", "loan"].every((k) => J(shape(sec(k))) === J(["kind", "body", "go", "fig"]))
      && saleCard.classList.contains("salt-action--now") && /^Sale · \d+ (min|h|d)$/.test(t(saleCard.querySelector(".nkind")))
      && !!tag && tag.classList.contains("salt-producttag--salt") && t(saleCard.querySelector(".need-who--code")) === "CX2-ZED" && t(saleCard.querySelector(".nfig")) === "RM 58"
      && t(sec("stock-count").querySelector(".need-who")) === "Unsent stock count" && t(sec("stock-count").querySelector(".nfig")) === "",
      "under one Unsent, each entry is the one shape, kind and age, the typed book and the code (the word where there is none), the pill and the figure: " + J([heads, t(saleCard)]));
    /* 2 */
    const go = [...saleCard.querySelectorAll(".salt-action__go button")];
    const open = sec("sale").querySelector(".unsent-open"), ways = [...open.querySelectorAll(".unsent-ways button")];
    ok(go.length === 1 && t(go[0]) === "Resend" && go[0].getAttribute("aria-label") === "Send again" && go[0].classList.contains("salt-pill") && go[0].classList.contains("nbtn") && go[0].getAttribute("data-act") === "record.retained.retry"
      && open.hidden && J(ways.map((b) => [t(b), b.getAttribute("data-act"), b.classList.contains("salt-ghost"), b.classList.contains("salt-ghost--danger")]))
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
    ok(/\.adm \.reclist \.ncard\{grid-template-columns:minmax\(0,1fr\) 72px 88px;[^}]*height:76px\}/.test(css) && /\.adm \.reclist \.ncard \.nbtn\{width:72px;/.test(css)
      && /\.adm \.unsent-ways\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(css)
      && /\.adm \.unsent-card \.need-tap::after\{content:"";position:absolute;inset:0\}/.test(css) && /\.adm \.unsent-card>\.salt-action__go\{position:relative;z-index:1\}/.test(css),
      "beside the menu the card keeps the phone's columns and its 72px pill at every width, its second choices lie two up, and the whole card is the tap, its pill above it");
  } finally { p.w.close(); }
}
