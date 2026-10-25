/* test/admin-unsent.mjs: AN ENTRY THAT WAITS UNCONFIRMED ON THIS PHONE SAYS SO, ON EVERY PLACE AND ON NEEDS YOU (Phase 4c of the Salt Admin redesign, 12 Oct 2026;
 * the plan's retained-send words; docs/STATEMENTS.md "Unsent entries").
 *
 * An entry sent from this phone that the Desk has not confirmed is kept whole on the phone (saltMakerPending:<route>) until it is sent again, updated or discarded. It was
 * found only by opening Record. Now one banner over every place says how many and opens them, and each is a To do card on Needs you (his own work, since 22 Oct 2026, so it is
 * counted among the To do cards, which the rail and the lead count); both read the phone's own storage and
 * send nothing, and Send again, Update and send and Discard stay on the entry's own section in Record, in the plan's words. Each check is red under its own mutation
 * (test/admin-unsent.mutations.json, run with tools/section.mjs). What is proved here:
 *   A  the banner: one entry says "1 unsent entry" in the plan's sentence, on every place, on the Action recipe at Soon, with one Open; sending and reading nothing
 *   B  several: it counts them, and Open goes to Record on the part of the oldest, where that entry's section stands; a record that will not read is still one
 *   C  Discard from Record lowers the count and, with the last, takes the banner away, at once
 *   D  the To do cards: a card for each, oldest first, under the Rows chip, counted among the To do cards, each Open going to its own part; the card is the one shape (kind,
 *      who by code, the full sentence to a reader) and the plan's sentence stands in the opened card beside the list from 860px
 *   E  the words: the section in Record says the same sentence, and nothing says retained, immutable, vault or drafter
 * Drawn by the maker harness (test/maker-act.mjs), which keeps one loan unsent on the phone. */
import { richOwnerPage, byAct, slipFixture, answerSheets } from "./maker-act.mjs";

const AT_LOAN = "2026-10-10T08:00:00.000Z", AT_PLACE = "2026-10-08T03:30:00.000Z", AT_COUNT = "2026-10-09T05:00:00.000Z";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const t = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
const wide = (w) => { w.matchMedia = (q) => ({ matches: /min-width:\s*860px/.test(q) && !/max-width/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {} }); };
const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };

export async function run({ ok, pageWork }) {
  const fix = await slipFixture();
  const KEEP = "saltMakerPending:";
  /* two more kept entries beside the harness's loan: a map placement (the oldest, on Customers) and a stock count (on Entry) */
  const place = { path: "/all/maker/inputs/place", body: { at: AT_PLACE, places: { "CX1-ZED": [3.1, 101.7, "Pudu"] }, addrVault: fix.places } };
  const count = { path: "/all/maker/inputs/stock-count", body: { at: AT_COUNT, product: "salt", date: "2026-10-09", qty: 12 } };
  const more = [[KEEP + place.path, JSON.stringify(place)], [KEEP + count.path, JSON.stringify(count)]];
  const open = async (retained = [], before) => {
    const p = await richOwnerPage({ pageWork, slip: true, retained, before });
    await p.work.quiet();
    const d = p.d;
    p.tap = async (act, key) => { const c = byAct(d, act, key); if (c) c.click(); await p.work.quiet(); return !!c; };
    p.bar = () => d.getElementById("unsentBar");
    p.where = () => {
      const place = (d.querySelector('.salt-appbar .place[aria-current="page"]') || { getAttribute: () => "" }).getAttribute("data-m");
      const strip = d.querySelector('.aparts[data-place="' + place + '"]');
      const part = strip && (strip.querySelector('[aria-selected="true"]') || { getAttribute: () => "" }).getAttribute("data-part");
      return place + (part ? "/" + part : "");
    };
    p.kept = () => Object.keys(p.w.localStorage).filter((k) => k.startsWith(KEEP)).sort();
    p.cards = () => [...d.querySelectorAll('#nlist [data-need^="u:"]')];
    p.sections = () => [...d.querySelectorAll("#makerInputs section[data-formmenu]")].filter(shown).map((s) => s.getAttribute("data-key"));
    return p;
  };

  /* A. ONE ENTRY: the banner */
  let p = await open();
  try {
    const d = p.d, bar = p.bar(), card = bar && bar.querySelector(".salt-action");
    const kept = p.kept(), store = kept.map((k) => p.w.localStorage.getItem(k));
    ok(!!bar && shown(bar) && !!card && card.classList.contains("salt-action--soon") && card.querySelector(".salt-action__kind").textContent === "Unsent"
      && card.querySelector(".need-who").textContent === "1 unsent entry" && /^A loan you sent on 10 Oct 2026, 16:00 was not confirmed[.] /.test(card.querySelector(".salt-action__why").textContent),
    "one entry waiting on the phone is a banner on the Action recipe at Soon: the kind Unsent, '1 unsent entry', and the plan's sentence with its day: " + (card && card.textContent));
    const open1 = byAct(bar, "unsent.open");
    ok(bar.querySelectorAll("button").length === 1 && !!open1 && open1.textContent === "Open" && open1.classList.contains("salt-ghost"),
      "with one control, Open, the system's quiet button, named by its act: " + bar.querySelectorAll("button").length);
    const seen = [];
    for (const place of ["needs", "orders", "customers", "record", "shop"]) { await p.tap("nav." + place); seen.push(shown(p.bar()) && !p.bar().hidden); }
    ok(seen.length === 5 && seen.every(Boolean), "it stands on every place: Needs you, Orders, Customers, Record and Shop: " + seen.join());
    ok(p.posts.length === 0 && same(p.kept(), kept) && same(p.kept().map((k) => p.w.localStorage.getItem(k)), store),
      "and reading the phone's storage sends nothing and changes none of what is kept: " + JSON.stringify(p.posts));
    await p.tap("nav.needs");
    p.posts.length = 0;
    await p.tap("unsent.open");
    ok(p.where() === "record/entry" && same(p.sections(), ["loan"]) && p.posts.length === 0 && same(p.kept(), kept),
      "Open goes to Record, on the part the loan belongs to, where its Unsent entry section stands, and sends nothing: " + p.where() + " " + JSON.stringify(p.sections()));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* B. SEVERAL: the count, the oldest, and a record that will not read */
  const broken = [KEEP + "/all/maker/inputs/gift", "{not a record"];
  p = await open(more.concat([broken]));
  try {
    const d = p.d, bar = p.bar(), card = bar.querySelector(".salt-action");
    ok(shown(bar) && card.querySelector(".need-who").textContent === "4 unsent entries" && /^They were sent from this phone and not confirmed[.]/.test(card.querySelector(".salt-action__why").textContent),
      "four kept on the phone (a record that will not read among them) are '4 unsent entries': " + (card && card.textContent));
    await p.tap("unsent.open");
    ok(p.where() === "record/customers" && same(p.sections(), ["place"]),
      "Open goes to the part of the oldest, the map placement, on Customers, and the section shown there is that entry's: " + p.where() + " " + JSON.stringify(p.sections()));
    await p.tap("part.record.entry");
    ok(same(p.sections().sort(), ["gift", "loan", "stock-count"]), "and the others stand on Entry, the broken one among them: " + JSON.stringify(p.sections()));
    const gift = d.querySelector('#makerInputs section[data-key="gift"]');
    ok(!!gift && /^Unsent entry/.test(gift.textContent) && byAct(gift, "record.retained.cancel") && /cannot be sent|Unexpected|JSON/.test(gift.textContent),
      "a record that will not read is still an entry he can see and discard: " + (gift && gift.textContent.slice(0, 120)));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* C. DISCARD lowers the count and takes the banner away with the last, at once */
  p = await open(more);
  try {
    const d = p.d, asked = [];
    answerSheets(p.w, asked, () => true);
    const text = () => (p.bar().hidden ? "" : p.bar().querySelector(".need-who").textContent);
    ok(text() === "3 unsent entries", "three kept: " + text());
    await p.tap("nav.record"); await p.tap("part.record.customers");
    byAct(d.querySelector('#makerInputs section[data-key="place"]'), "record.retained.cancel").click(); await p.work.quiet();
    ok(text() === "2 unsent entries" && !p.kept().some((k) => /place$/.test(k)), "discarding one on Record lowers the banner's count at once: " + text() + " " + JSON.stringify(p.kept()));
    await p.tap("part.record.entry");
    for (const k of ["loan", "stock-count"]) { const s = d.querySelector('#makerInputs section[data-key="' + k + '"]'); if (s) { byAct(s, "record.retained.cancel").click(); await p.work.quiet(); } }
    ok(p.kept().length === 0 && p.bar().hidden && p.bar().childElementCount === 0 && asked.length === 3 && asked.every((a) => /Discard this unsent entry/.test(a)),
      "and discarding the last takes the banner away, each discard asked on the page's Sheet: " + JSON.stringify([p.kept(), p.bar().hidden, asked.length]));
    await p.tap("nav.needs");
    ok(p.cards().length === 0 && p.bar().hidden, "Needs you has no unsent card left: " + p.cards().length);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* D. THE TO DO CARDS */
  const todo = (p) => [...p.d.querySelectorAll('#nlist section[data-sev="now"] [data-need]')].filter((c) => !c.hasAttribute("data-practice")).length;
  p = await open();
  const base = todo(p);
  p.w.close();
  p = await open(more);
  try {
    const d = p.d, keys = p.cards().map((c) => c.getAttribute("data-need"));
    ok(same(keys, ["u:" + place.path, "u:" + count.path, "u:/all/maker/inputs/loan"]),
      "each kept entry is a To do card, the oldest first (the placement, the count, the loan), in the order of the day it was sent: " + JSON.stringify(keys));
    const words = (c) => ({ sev: c.getAttribute("data-sev"), kind: c.getAttribute("data-kind"), group: (c.closest("section.ngroup") || { getAttribute: () => "" }).getAttribute("data-sev"),
      word: c.querySelector(".nkind").firstChild.textContent, who: t(c.querySelector(".need-who")), code: c.querySelector(".need-who").classList.contains("need-who--code"),
      said: (c.querySelector(".need-tap") || { getAttribute: () => "" }).getAttribute("aria-label"), go: [...c.querySelectorAll(".salt-action__go button")].map(t).join(), why: !!c.querySelector(".salt-action__why, .need-what") });
    const w = p.cards().map(words);
    ok(w.every((x) => x.sev === "now" && x.group === "now" && x.kind === "rows" && x.word === "Unsent" && x.go === "Open" && !x.why)
      && w[0].who === "This phone" && !w[0].code && w[0].said === "Unsent: This phone, Map placement"
      && w[1].who === "This phone" && w[1].said === "Unsent: This phone, Stock count"
      && w[2].who === "CX1-ZED" && w[2].code && w[2].said === "Unsent: CX1-ZED, Loan",
    "a card is To do, under Rows, the kind Unsent, who by code when the entry names one, what it is read in full to a reader, one Open and no why line: " + JSON.stringify(w));
    const now = todo(p);
    ok(now === base + 2, "they are counted among the To do cards (two more than with the loan alone): " + base + " then " + now);
    ok(+t(d.querySelector('[data-count="needs"]')) === now, "and the rail counts the same: " + t(d.querySelector('[data-count="needs"]')) + " " + now);
    await p.tap("need.kind.orders");
    const underOrders = p.cards().length;
    await p.tap("need.kind.rows");
    ok(underOrders === 0 && p.cards().length === 3, "the Orders chip shows none of them and the Rows chip all three: " + underOrders + " " + p.cards().length);
    await p.tap("need.open", "u:" + place.path);
    ok(p.where() === "record/customers" && same(p.sections(), ["place"]), "a card's tap goes to Record, on its own entry's part: " + p.where() + " " + JSON.stringify(p.sections()));
    await p.tap("nav.needs");
    await p.tap("need.unsent", "u:" + count.path);
    ok(p.where() === "record/entry" && p.sections().includes("stock-count") && p.posts.length === 0, "and the count's Open goes to Entry, sending nothing: " + p.where() + " " + JSON.stringify(p.sections()));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
  /* D2. from 860px the plan's sentence stands in the opened card, the card itself carrying none */
  p = await open(more, wide);
  try {
    const d = p.d;
    await p.tap("need.open", "u:" + place.path);
    const head = d.querySelector("#nopen .npane");
    ok(!!head && /^A map placement you sent on 08 Oct 2026, 11:30 was not confirmed[.] Open it to send it again, update it or discard it[.]$/.test(t(head.querySelector(".npane__why")))
      && t(head.querySelector(".npane__title")) === "This phone" && !!byAct(head, "need.unsent", "u:" + place.path) && p.where() !== "record/customers" && p.posts.length === 0,
    "from 860px a tap opens the card beside the list with the plan's sentence and its Open, going nowhere and sending nothing: " + t(head));
    await p.tap("need.open", "u:" + count.path);
    ok(/^A stock count you sent on 09 Oct 2026, 13:00 was not confirmed[.]/.test(t(d.querySelector("#nopen .npane__why"))), "each card's own sentence: " + t(d.querySelector("#nopen .npane__why")));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* E. THE WORDS */
  p = await open();
  try {
    const d = p.d, bar = p.bar();
    await p.tap("nav.record");
    const loan = d.querySelector('#makerInputs section[data-key="loan"]');
    ok(!!loan && loan.querySelector("h3").textContent === "Unsent entry" && /^A loan you sent on 10 Oct 2026, 16:00 was not confirmed[.] Send it again, or update it first[.]/.test(loan.querySelector("p").textContent)
      && ["record.retained.retry", "record.retained.review", "record.retained.cancel"].map((a) => byAct(loan, a).textContent).join() === "Resend,Update and send,Discard" && byAct(loan, "record.retained.retry").getAttribute("aria-label") === "Send again",
    "the entry's own section says the same sentence and keeps Resend (spoken Send again, 25 Oct 2026), Update and send and Discard: " + (loan && loan.textContent));
    await p.tap("nav.needs");
    const text = bar.textContent + p.cards().map((c) => c.textContent).join(" ");
    ok(text.length > 40 && !/retain|immutable|vault|drafter|canonical|envelope|ciphertext|Worker/i.test(text), "and the banner and the card use none of the page's inner words: " + text);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* F. AN ENTRY WHOSE NAME STARTS WITH A VOWEL IS 'An', and one that names nobody is read to this phone */
  const offset = { path: "/all/maker/inputs/offset", body: { at: "2026-10-11T01:00:00.000Z", note: "x" } };
  p = await open([[KEEP + offset.path, JSON.stringify(offset)]], wide);
  try {
    const c = p.d.querySelector('#nlist [data-need="u:' + offset.path + '"]');
    if (c) c.querySelector(".need-tap").click(); await p.work.quiet();
    const why = t(p.d.querySelector("#nopen .npane__why"));
    ok(!!c && /^An offset you sent on 11 Oct 2026, 09:00 was not confirmed[.]/.test(why) && t(c.querySelector(".need-who")) === "This phone",
      "'An' before a word that starts with a vowel, and 'This phone' for an entry that names nobody: " + (c && t(c)) + " | " + why);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
