/* test/admin-unsent.mjs: AN ENTRY THAT WAITS UNCONFIRMED ON THIS PHONE SAYS SO, ON EVERY PLACE AND ON NEEDS YOU (Phase 4c of the Salt Account redesign, 12 Oct 2026;
 * the plan's retained-send words; docs/STATEMENTS.md "Unsent entries").
 *
 * An entry sent from this phone that the Desk has not confirmed is kept whole on the phone (saltMakerPending:<route>) until it is sent again, updated or discarded. It was
 * found only by opening Record. Now one banner over every place says how many and opens them, and each is a Soon card on Needs you; both read the phone's own storage and
 * send nothing, and Send again, Update and send and Discard stay on the entry's own section in Record, in the plan's words. Each check is red under its own mutation
 * (test/admin-unsent.mutations.json, run with tools/section.mjs). What is proved here:
 *   A  the banner: one entry says "1 unsent entry" in the plan's sentence, on every place, on the Action recipe at Soon, with one Open; sending and reading nothing
 *   B  several: it counts them, and Open goes to Record on the part of the oldest, where that entry's section stands; a record that will not read is still one
 *   C  Discard from Record lowers the count and, with the last, takes the banner away, at once
 *   D  the Soon cards: a card for each, oldest first, under the Rows chip, counted among the Soon in the line under the title, each Open going to its own part
 *   E  the words: the section in Record says the same sentence, and nothing says retained, immutable, vault or drafter
 * Drawn by the maker harness (test/maker-act.mjs), which keeps one loan unsent on the phone. */
import { richOwnerPage, byAct, slipFixture, answerSheets } from "./maker-act.mjs";

const AT_LOAN = "2026-10-10T08:00:00.000Z", AT_PLACE = "2026-10-08T03:30:00.000Z", AT_COUNT = "2026-10-09T05:00:00.000Z";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const shown = (el) => { for (let e = el; e && e.id !== "roster"; e = e.parentElement) if (e.hidden) return false; return !!el; };

export async function run({ ok, pageWork }) {
  const fix = await slipFixture();
  const KEEP = "saltMakerPending:";
  /* two more kept entries beside the harness's loan: a map placement (the oldest, on Customers) and a stock count (on Entry) */
  const place = { path: "/all/maker/inputs/place", body: { at: AT_PLACE, places: { "CX1-ZED": [3.1, 101.7] }, addrVault: fix.places } };
  const count = { path: "/all/maker/inputs/stock-count", body: { at: AT_COUNT, product: "salt", date: "2026-10-09", qty: 12 } };
  const more = [[KEEP + place.path, JSON.stringify(place)], [KEEP + count.path, JSON.stringify(count)]];
  const open = async (retained = []) => {
    const p = await richOwnerPage({ pageWork, slip: true, retained });
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

  /* D. THE SOON CARDS */
  p = await open();
  const base = +(/([0-9]+) soon/.exec(p.d.getElementById("nCount").textContent) || [])[1];
  p.w.close();
  p = await open(more);
  try {
    const d = p.d, keys = p.cards().map((c) => c.getAttribute("data-need"));
    ok(same(keys, ["u:" + place.path, "u:" + count.path, "u:/all/maker/inputs/loan"]),
      "each kept entry is a Soon card, the oldest first (the placement, the count, the loan), in the order of the day it was sent: " + JSON.stringify(keys));
    const words = (c) => ({ sev: c.getAttribute("data-sev"), kind: c.getAttribute("data-kind"), word: c.querySelector(".salt-action__kind").textContent, who: c.querySelector(".need-who").textContent,
      what: (c.querySelector(".need-what") || {}).textContent, why: c.querySelector(".salt-action__why").textContent });
    const w = p.cards().map(words);
    ok(w.every((x) => x.sev === "soon" && x.kind === "rows" && x.word === "Unsent")
      && w[0].who === "This phone" && w[0].what === "Map placement" && /^A map placement you sent on 08 Oct 2026, 11:30 was not confirmed[.] Open it to send it again, update it or discard it[.]$/.test(w[0].why)
      && w[1].who === "This phone" && w[1].what === "Stock count" && /^A stock count you sent on 09 Oct 2026, 13:00 was not confirmed[.]/.test(w[1].why)
      && w[2].who === "CX1-ZED" && w[2].what === "Loan" && /^A loan you sent on 10 Oct 2026, 16:00 was not confirmed[.]/.test(w[2].why),
    "a card is Soon, under Rows, the kind Unsent, who by code when the entry names one, what it is and the plan's sentence: " + JSON.stringify(w));
    const soon = +(/([0-9]+) soon/.exec(d.getElementById("nCount").textContent) || [])[1];
    ok(soon === base + 2, "the line under the title counts them among the Soon (two more than with the loan alone): " + base + " then " + soon);
    await p.tap("need.kind.orders");
    const underOrders = p.cards().length;
    await p.tap("need.kind.rows");
    ok(underOrders === 0 && p.cards().length === 3, "the Orders chip shows none of them and the Rows chip all three: " + underOrders + " " + p.cards().length);
    await p.tap("need.open", "u:" + place.path);
    ok(p.where() === "record/customers" && same(p.sections(), ["place"]), "a card's Open goes to Record, on its own entry's part: " + p.where() + " " + JSON.stringify(p.sections()));
    await p.tap("nav.needs");
    await p.tap("need.open", "u:" + count.path);
    ok(p.where() === "record/entry" && p.sections().includes("stock-count"), "and the count's to Entry: " + p.where() + " " + JSON.stringify(p.sections()));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* E. THE WORDS */
  p = await open();
  try {
    const d = p.d, bar = p.bar();
    await p.tap("nav.record");
    const loan = d.querySelector('#makerInputs section[data-key="loan"]');
    ok(!!loan && loan.querySelector("h3").textContent === "Unsent entry" && /^A loan you sent on 10 Oct 2026, 16:00 was not confirmed[.] Send it again, or update it first[.]/.test(loan.querySelector("p").textContent)
      && ["record.retained.retry", "record.retained.review", "record.retained.cancel"].map((a) => byAct(loan, a).textContent).join() === "Send again,Update and send,Discard",
    "the entry's own section says the same sentence and keeps Send again, Update and send and Discard: " + (loan && loan.textContent));
    await p.tap("nav.needs");
    const text = bar.textContent + p.cards().map((c) => c.textContent).join(" ");
    ok(text.length > 40 && !/retain|immutable|vault|drafter|canonical|envelope|ciphertext|Worker/i.test(text), "and the banner and the card use none of the page's inner words: " + text);
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }

  /* F. AN ENTRY WHOSE NAME STARTS WITH A VOWEL IS 'An', and one that names nobody is read to this phone */
  const offset = { path: "/all/maker/inputs/offset", body: { at: "2026-10-11T01:00:00.000Z", note: "x" } };
  p = await open([[KEEP + offset.path, JSON.stringify(offset)]]);
  try {
    const c = p.d.querySelector('#nlist [data-need="u:' + offset.path + '"]');
    ok(!!c && /^An offset you sent on 11 Oct 2026, 09:00 was not confirmed[.]/.test(c.querySelector(".salt-action__why").textContent) && c.querySelector(".need-who").textContent === "This phone",
      "'An' before a word that starts with a vowel, and 'This phone' for an entry that names nobody: " + (c && c.textContent));
  } catch (e) { ok(false, "a section stopped on an error: " + (e && e.message)); } finally { p.w.close(); }
}
