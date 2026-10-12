import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { landingPage } from "../stmt/page.js";
import { runDrafter } from "../src/drafter.js";
import { plan } from "../tools/fold.mjs";
import { world } from "./maker-trades.mjs";
import { answerSheets } from "./maker-act.mjs";

/* A gift sent twice books once (the admin stress triage of 11 Oct 2026, row 7). Counter Admin's Gift keeps its values after
   "Sent for review", so a second tap is a new input under a fresh request moment. Both drafts could be approved, and the
   fold refuses the second as a replay and leaves the whole batch staged until he rejects it. The Desk route now refuses the
   twin while the first is queued or waiting under Approve, and asks about it while the first is booked, as it does a trade;
   a gift he confirms as separate carries `second`, which is what the fold's replay guard reads. */
const stamp = (n) => "2099-10-05T01:00:" + String(n).padStart(2, "0") + ".000Z";
const gift = (patch = {}) => ({ at: stamp(1), product: "salt", code: "CX1-ZED", date: "2099-10-05", qty: 2, movedUnits: 2,
  handover: "collected", ...patch });
const send = (wd, body) => wd.call("/all/maker/inputs/gift", body);
/* the row a folded gift leaves on the book: the shelf's cost (RM 40 a unit in the fixture) over the units, goodwill alone */
const bookedGift = (patch = {}) => ({ rid: "s900", customer: "CX1-ZED", qty: 2, total: 80, cost: 80, cash: 0, settledRM: 80,
  goodwill: true, deliveredQty: 2, deliveredOn: "2099-10-05", date: "2099-10-05", handover: "collected", ...patch });
const holdSale = (wd, row) => wd.sqlite.prepare("INSERT INTO entry(collection,seq,hash,doc) VALUES ('sales',0,'gift-twin',?)")
  .run(JSON.stringify(row));
/* the fold's plan over the real book with the given sales and the given approved drafts */
const foldPlan = (wd, sales, drafts) => {
  const book = JSON.parse(readFileSync(new URL("../ledger/book.json", import.meta.url), "utf8"));
  book.sales = sales; book.roster = wd.b.state.roster;
  const approved = drafts.map((r) => ({ id: r.id, collection: r.collection, row: r.row, entry: r.entry }));
  return plan(book, { ok: true, count: approved.length, approved }, null);
};

const button = (root, label) => [...root.querySelectorAll("button")].find((e) => e.textContent === label);
const field = (root, label) => [...root.querySelectorAll("label")]
  .find((e) => e.firstChild.textContent === label)?.querySelector("input,select");

/* the real owner page, its Gift form, over the real Desk route; every question put on the Sheet is recorded and answered */
async function ownerGift(wd, pageWork) {
  const sent = [], asked = [];
  let work, answer = true, tick = Date.parse(stamp(0));
  const dom = new JSDOM(landingPage("", "gift-twin-nonce", { master: "fixture-master", accounts: [] }), {
    url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder; win.TextDecoder = TextDecoder; win.scrollTo = () => {};
      const NativeDate = win.Date;
      win.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [tick += 100])); } };
      win.fetch = async (path, init = {}) => {
        if (String(path).startsWith("/all/maker/inputs") || String(path).startsWith("/all/maker/drafts/")) {
          const input = init.body && JSON.parse(init.body);
          if (input) sent.push({ path: String(path), body: input });
          return wd.call(String(path), input || undefined);
        }
        return new Response(JSON.stringify(String(path) === "/all/maker/review"
          ? { ok: true, orders: [], drafts: wd.drafts(), refused: [] }
          : { ok: true, accounts: [], orders: [], drafts: [], claims: [], threads: [],
            pools: [], config: null, status: { open: true } }));
      };
      work = pageWork(win);
    }
  });
  answerSheets(dom.window, asked, () => answer);   /* a twin is put to him on the page's Sheet (Phase 2c); each is answered as it comes up */
  dom.window.document.querySelector('button[data-act="nav.record"]').click(); await work.quiet();
  const section = [...dom.window.document.querySelectorAll("#makerInputs .maker-input")]
    .find((s) => s.querySelector("h3")?.textContent === "Gift");
  const set = (label, value) => { field(section, label).value = value; };
  for (const [label, value] of Object.entries({ Who: "CX1-ZED", Book: "salt", Date: "2099-10-05", Units: "2",
    Handover: "collected" })) set(label, value);
  const tap = async () => { button(section, "Send the gift").click(); await work.quiet(); };
  return { dom, section, sent, asked, set, tap, answer: (value) => { answer = value; },
    status: () => section.querySelector('[role="status"]').textContent,
    retained: () => dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/gift"),
    cancelShown: () => { const cancel = button(section, "Discard"); return !!cancel && !cancel.hidden; } };
}

export async function run({ ok, pageWork }) {
  const wd = world();
  try {
    const first = await send(wd, gift());
    ok(first.status === 200 && wd.drafts().length === 1 && wd.drafts()[0].collection === "sales"
      && wd.drafts()[0].row.goodwill === true && wd.drafts()[0].row.total === 80 && wd.drafts()[0].status === "pending",
    "gift twin: the first gift queues one pending goodwill draft at the shelf's cost");
    const twin = await send(wd, gift({ at: stamp(2) })), twinAnswer = await twin.json();
    ok(twin.status === 409 && twinAnswer.queuedTwin?.at === stamp(1) && /already queued/.test(twinAnswer.error)
      && wd.drafts().length === 1,
    "gift twin: the same gift under a new request moment, while the first waits under Approve, is refused and books nothing");
    const retried = await send(wd, gift());
    ok(retried.status === 200 && wd.drafts().length === 1,
      "gift twin: one request retried under its own moment is answered again, never refused as its own twin");
    const other = await send(wd, gift({ at: stamp(3), qty: 3, movedUnits: 3 }));
    ok(other.status === 200 && wd.drafts().length === 2, "gift twin: a gift of other units is no twin");
    /* the fold lands the first gift: the book holds its row, its draft is committed and the queue's watermark passes it; the
       next drafter pass then lets go of its copy in the queue */
    await wd.call("/all/maker/drafts/" + encodeURIComponent(stamp(1)) + "/approve", {});
    const folded = bookedGift();
    holdSale(wd, folded);
    wd.sqlite.prepare("UPDATE draft SET committed_at=?1 WHERE id=?2").run("2099-10-05T02:00:00.000Z", stamp(1));
    wd.sqlite.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES ('QUEUE_COMMITTED',?)").run(JSON.stringify(stamp(1)));
    await runDrafter(wd.desk);
    const asked = await send(wd, gift({ at: stamp(5) })), askedAnswer = await asked.json();
    ok(asked.status === 409 && askedAnswer.twin?.second === "s900" && !askedAnswer.queuedTwin && wd.drafts().length === 2,
      "gift twin: a gift matching a booked row is asked about by the route, with the booked row's id, and queues nothing");
    const confirmed = await send(wd, gift({ at: stamp(6), second: "s900" }));
    const second = wd.drafts().at(-1);
    ok(confirmed.status === 200 && wd.drafts().length === 3 && second.entry.payload.mode === "gift"
      && second.entry.payload.second === "s900",
    "gift twin: confirmed as a separate gift, naming the booked row, it queues carrying the confirmation the fold reads");
    await wd.call("/all/maker/drafts/" + encodeURIComponent(stamp(6)) + "/approve", {});
    const approvedSecond = wd.drafts().at(-1);
    const taken = foldPlan(wd, [folded], [approvedSecond]);
    ok(taken.items.length === 1 && taken.refused.length === 0
      && taken.items[0].does.some((line) => /a second order beside s900/.test(line)),
    "gift twin fold: a confirmed second gift folds beside the booked one, marked a second order on his word");
    const bare = structuredClone(approvedSecond); delete bare.entry.payload.second;
    const refused = foldPlan(wd, [folded], [bare]);
    ok(refused.items.length === 0 && refused.refused.length === 1 && /replay/.test(refused.refused[0].why),
      "gift twin fold: the same gift without his confirmation is still refused as a replay, the fold's own last check");
  } finally { wd.sqlite.close(); }

  /* the Desk's own record of what waits, with the queue's copy gone: a pending draft counts, and so does an approved one */
  const drafted = world();
  try {
    await send(drafted, gift());
    for (const key of [...drafted.map.keys()]) if (key.startsWith("q:")) drafted.map.delete(key);
    const pendingTwin = await send(drafted, gift({ at: stamp(2) }));
    ok(pendingTwin.status === 409 && (await pendingTwin.json()).queuedTwin?.at === stamp(1) && drafted.drafts().length === 1,
      "gift twin: a first gift pending under Approve counts from its draft alone, with no copy left in the queue");
    await drafted.call("/all/maker/drafts/" + encodeURIComponent(stamp(1)) + "/approve", {});
    const approvedTwin = await send(drafted, gift({ at: stamp(3) }));
    ok(drafted.drafts()[0].status === "approved" && approvedTwin.status === 409
      && (await approvedTwin.json()).queuedTwin?.at === stamp(1) && drafted.drafts().length === 1,
    "gift twin: a first gift approved and not yet folded counts from its draft alone, with no copy left in the queue");
  } finally { drafted.sqlite.close(); }

  const owner = world(), page = await ownerGift(owner, pageWork);
  try {
    await page.tap();
    ok(/Sent[.] It waits under Approve/.test(page.status()) && owner.drafts().length === 1 && !page.retained(),
      "gift twin page: the first tap sends the gift for review and keeps no retained request");
    await page.tap();
    ok(/already queued/.test(page.status()) && owner.drafts().length === 1 && !page.cancelShown() && !page.retained(),
      "gift twin page: a second tap is refused in words, and the form is free again: no retained request, no Cancel to press");
    page.set("Units", "3"); await page.tap();
    ok(/Sent[.] It waits under Approve/.test(page.status()) && owner.drafts().length === 2 && owner.drafts()[1].row.qty === 3,
      "gift twin page: a different gift then sends at once, the refused twin not retried in its place");
  } finally { page.dom.window.close(); owner.sqlite.close(); }

  const asking = world(); holdSale(asking, bookedGift());
  const booked = await ownerGift(asking, pageWork);
  try {
    await booked.tap();
    const bodies = booked.sent.filter((s) => s.path.endsWith("/gift")).map((s) => s.body);
    ok(booked.asked.length === 1 && /already recorded/.test(booked.asked[0]) && bodies.length === 2 && bodies[0].second === undefined
      && bodies[1].second === "s900" && bodies[1].at !== bodies[0].at && asking.drafts().length === 1
      && asking.drafts()[0].entry.payload.second === "s900" && /Sent[.] It waits under Approve/.test(booked.status()),
    "gift twin page: a booked twin is put to him as a question, and his yes resends it with the booked row's id under a fresh moment");
  } finally { booked.dom.window.close(); asking.sqlite.close(); }

  const declining = world(); holdSale(declining, bookedGift());
  const refusedPage = await ownerGift(declining, pageWork);
  try {
    refusedPage.answer(false); await refusedPage.tap();
    ok(refusedPage.asked.length === 1 && refusedPage.sent.filter((s) => s.path.endsWith("/gift")).length === 1
      && declining.drafts().length === 0 && /already booked/.test(refusedPage.status()),
    "gift twin page: his no to the question sends nothing more, and the answer says why");
  } finally { refusedPage.dom.window.close(); declining.sqlite.close(); }
}
