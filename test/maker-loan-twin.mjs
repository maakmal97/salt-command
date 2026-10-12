import { JSDOM } from "jsdom";
import { webcrypto } from "node:crypto";
import { landingPage } from "../stmt/page.js";
import { runDrafter } from "../src/drafter.js";
import { world } from "./maker-trades.mjs";
import { answerSheets } from "./maker-act.mjs";

/* A loan sent twice books once (the admin stress triage of 11 Oct 2026, row 6). Counter Admin's Borrow or lend keeps its
   values after "Sent for review", so a second tap is a new input under a fresh request moment; the Desk route now refuses
   it while the first is queued or waiting under Approve, and asks about it while the first is booked, as it does a trade. */
const stamp = (n) => "2099-10-05T01:00:" + String(n).padStart(2, "0") + ".000Z";
const loan = (patch = {}) => ({ at: stamp(1), form: "salt", direction: "out", product: "salt", code: "CX1-ZED",
  date: "2099-10-05", amount: 2, ...patch });
const bookedLoan = (patch = {}) => ({ rid: "l007", party: "CX1-ZED", direction: "out", form: "salt", product: "salt",
  valueKg: 2, valueRM: null, date: "2099-10-05", status: "open", ...patch });
const holdLoans = (wd, rows) => wd.sqlite.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES ('loans',?)").run(JSON.stringify(rows));
const send = (wd, body) => wd.call("/all/maker/inputs/loan", body);

const button = (root, label) => [...root.querySelectorAll("button")].find((e) => e.textContent === label);
const field = (root, label) => [...root.querySelectorAll("label")]
  .find((e) => e.firstChild.textContent === label)?.querySelector("input,select");

/* the real owner page, its Borrow or lend form, over the real Desk route; every question put on the Sheet is recorded and answered */
async function ownerLoan(wd, pageWork) {
  const sent = [], asked = [];
  let work, answer = true, tick = Date.parse(stamp(0));
  const dom = new JSDOM(landingPage("", "loan-twin-nonce", { master: "fixture-master", accounts: [] }), {
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
    .find((s) => s.querySelector("h3")?.textContent === "Loan");
  const set = (label, value) => { field(section, label).value = value; };
  for (const [label, value] of Object.entries({ "Goods or cash": "salt", Direction: "out", Who: "CX1-ZED", Book: "salt",
    Date: "2099-10-05", "Units": "2" })) set(label, value);
  const tap = async () => { button(section, "Send the loan").click(); await work.quiet(); };
  return { dom, section, sent, asked, set, tap, answer: (value) => { answer = value; },
    status: () => section.querySelector('[role="status"]').textContent,
    retained: () => dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/loan"),
    cancelShown: () => { const cancel = button(section, "Discard"); return !!cancel && !cancel.hidden; } };
}

export async function run({ ok, pageWork }) {
  const wd = world();
  try {
    const first = await send(wd, loan());
    ok(first.status === 200 && wd.drafts().length === 1 && wd.drafts()[0].collection === "loan" && wd.drafts()[0].status === "pending",
      "loan twin: the first loan queues one pending loan draft");
    const twin = await send(wd, loan({ at: stamp(2) })), twinAnswer = await twin.json();
    ok(twin.status === 409 && twinAnswer.queuedTwin?.at === stamp(1) && /already queued/.test(twinAnswer.error)
      && wd.drafts().length === 1,
      "loan twin: the same loan under a new request moment, while the first waits under Approve, is refused and books nothing");
    const retried = await send(wd, loan());
    ok(retried.status === 200 && wd.drafts().length === 1,
      "loan twin: one request retried under its own moment is answered again, never refused as its own twin");
    const other = await send(wd, loan({ at: stamp(3), amount: 3 }));
    ok(other.status === 200 && wd.drafts().length === 2, "loan twin: a loan of another amount is no twin");
    /* the fold lands the first loan: the book holds it, its draft is committed and the queue's watermark passes it; the next
       drafter pass then lets go of its copy in the queue */
    await wd.call("/all/maker/drafts/" + encodeURIComponent(stamp(1)) + "/approve", {});
    holdLoans(wd, [bookedLoan()]);
    wd.sqlite.prepare("UPDATE draft SET committed_at=?1 WHERE id=?2").run("2099-10-05T02:00:00.000Z", stamp(1));
    wd.sqlite.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES ('QUEUE_COMMITTED',?)").run(JSON.stringify(stamp(1)));
    await runDrafter(wd.desk);
    const asked = await send(wd, loan({ at: stamp(5) })), askedAnswer = await asked.json();
    ok(asked.status === 409 && askedAnswer.twin?.second === "l007" && !askedAnswer.queuedTwin && wd.drafts().length === 2,
      "loan twin: a loan matching a booked one is asked about by the route, with the booked row's id, and queues nothing");
    const confirmed = await send(wd, loan({ at: stamp(6), second: "l007" }));
    ok(confirmed.status === 200 && wd.drafts().length === 3 && wd.drafts().at(-1).entry.payload.mode === "loan",
      "loan twin: confirmed as a separate loan, naming the booked row, it queues as any loan");
  } finally { wd.sqlite.close(); }

  /* the Desk's own record of what waits, with the queue's copy gone: a pending draft counts, and so does an approved one */
  const drafted = world();
  try {
    await send(drafted, loan());
    for (const key of [...drafted.map.keys()]) if (key.startsWith("q:")) drafted.map.delete(key);
    const pendingTwin = await send(drafted, loan({ at: stamp(2) }));
    ok(pendingTwin.status === 409 && (await pendingTwin.json()).queuedTwin?.at === stamp(1) && drafted.drafts().length === 1,
      "loan twin: a first loan pending under Approve counts from its draft alone, with no copy left in the queue");
    await drafted.call("/all/maker/drafts/" + encodeURIComponent(stamp(1)) + "/approve", {});
    const approvedTwin = await send(drafted, loan({ at: stamp(3) }));
    ok(drafted.drafts()[0].status === "approved" && approvedTwin.status === 409
      && (await approvedTwin.json()).queuedTwin?.at === stamp(1) && drafted.drafts().length === 1,
      "loan twin: a first loan approved and not yet folded counts from its draft alone, with no copy left in the queue");
  } finally { drafted.sqlite.close(); }

  const owner = world(), page = await ownerLoan(owner, pageWork);
  try {
    await page.tap();
    ok(/Sent[.] It waits under Approve/.test(page.status()) && owner.drafts().length === 1 && !page.retained(),
      "loan twin page: the first tap sends the loan for review and keeps no retained request");
    await page.tap();
    ok(/already queued/.test(page.status()) && owner.drafts().length === 1 && !page.cancelShown() && !page.retained(),
      "loan twin page: a second tap is refused in words, and the form is free again: no retained request, no Cancel to press");
    page.set("Units", "3"); await page.tap();
    ok(/Sent[.] It waits under Approve/.test(page.status()) && owner.drafts().length === 2 && owner.drafts()[1].row.valueKg === 3,
      "loan twin page: a different loan then sends at once, the refused twin not retried in its place");
  } finally { page.dom.window.close(); owner.sqlite.close(); }

  const asking = world(); holdLoans(asking, [bookedLoan()]);
  const booked = await ownerLoan(asking, pageWork);
  try {
    await booked.tap();
    const bodies = booked.sent.filter((s) => s.path.endsWith("/loan")).map((s) => s.body);
    ok(booked.asked.length === 1 && /already recorded/.test(booked.asked[0]) && bodies.length === 2 && bodies[0].second === undefined
      && bodies[1].second === "l007" && bodies[1].at !== bodies[0].at && asking.drafts().length === 1
      && /Sent[.] It waits under Approve/.test(booked.status()),
      "loan twin page: a booked twin is put to him as a question, and his yes resends it with the booked row's id under a fresh moment");
  } finally { booked.dom.window.close(); asking.sqlite.close(); }

  const declining = world(); holdLoans(declining, [bookedLoan()]);
  const refused = await ownerLoan(declining, pageWork);
  try {
    refused.answer(false); await refused.tap();
    ok(refused.asked.length === 1 && refused.sent.filter((s) => s.path.endsWith("/loan")).length === 1
      && declining.drafts().length === 0 && /already booked/.test(refused.status()),
      "loan twin page: his no to the question sends nothing more, and the answer says why");
  } finally { refused.dom.window.close(); declining.sqlite.close(); }
}
