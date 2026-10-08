import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { JSDOM } from "jsdom";
import { landingPage } from "../stmt/page.js";
import { handleMaker } from "../stmt/maker.js";
import worker from "../src/worker.js";
import E from "../engine/position.mjs";
import { apply, mintUsernames, plan } from "../tools/fold.mjs";
import { makerAppointmentClaim } from "../src/maker-request.js";
import { world } from "./maker-trades.mjs";
import { contentKey, wrapKey } from "../tools/stmt-crypto.mjs";

const OWNER = { email: "maakmal97@icloud.com" };
const AT_START = Date.parse("2099-10-05T01:00:00.000Z");
let ownerPageCount = 0;

function fixture() {
  const wd = world();
  const roster = [...new Set([...wd.b.state.roster, "CJ4-RED", "CJ4-BLU", "SZ4-CUS", "CJ4-DWN", "DJ4-GON",
    "EJ4-BAN", "HJ4-NOS", "SJ4-SUP", "FJ4-ASS", "FJ4-ASS-R"])];
  const associates = [...new Set([...wd.b.state.associates, "FJ4-ASS"])];
  const people = { departed: [{ id: "DJ4-GON" }], banned: [{ id: "EJ4-BAN", lifted: false }] };
  const placed = { "CJ4-RED": [3.14, 101.7], "CJ4-BLU": [3.15, 101.71] };
  for (const [key, value] of Object.entries({ roster, associates, PEOPLE: people, PLACED: placed }))
    wd.sqlite.prepare("INSERT OR REPLACE INTO state(key,doc) VALUES (?1,?2)").run(key, JSON.stringify(value));
  const sales = [
    { rid: "s-fixture-a", customer: "CJ4-RED", product: "salt", date: "2099-10-01", qty: 1, total: 100, cash: 100, deliveredQty: 1 },
    { rid: "s-fixture-b", customer: "CJ4-BLU", product: "salt", date: "2099-10-01", qty: 1, total: 100, cash: 100, deliveredQty: 1 },
    { rid: "s-fixture-s", customer: "SZ4-CUS", product: "salt", date: "2099-10-01", qty: 1, total: 100, cash: 100, deliveredQty: 1 },
    { rid: "s-fixture-supplier", customer: "SJ4-SUP", product: "salt", date: "2099-10-01", qty: 1, total: 100, cash: 100, deliveredQty: 1 },
    { rid: "s-fixture-d", customer: "DJ4-GON", product: "salt", date: "2099-10-01", qty: 1, total: 100, cash: 100, deliveredQty: 1 },
    { rid: "s-fixture-e", customer: "EJ4-BAN", product: "salt", date: "2099-10-01", qty: 1, total: 100, cash: 100, deliveredQty: 1 },
    { rid: "s-fixture-f", customer: "FJ4-ASS", product: "salt", date: "2099-10-01", qty: 1, total: 100, cash: 100, deliveredQty: 1 },
    { rid: "s-fixture-down", customer: "AX1-ZED-R", downstream: "CJ4-DWN", product: "salt",
      date: "2099-10-01", qty: 1, total: 100, cash: 100, deliveredQty: 1 }
  ];
  for (const [seq, row] of sales.entries())
    wd.sqlite.prepare("INSERT INTO entry(collection,seq,hash,doc) VALUES ('sales',?1,?2,?3)")
      .run(seq, row.rid, JSON.stringify(row));
  wd.sqlite.prepare("INSERT INTO entry(collection,seq,hash,doc) VALUES ('purchases',0,'p-fixture-supplier',?1)")
    .run(JSON.stringify({ rid: "p-fixture-supplier", supplier: "SJ4-SUP", product: "salt", date: "2099-10-01", qty: 1, total: 40, receivedQty: 1 }));
  const envelope = { v: 1, salt: Buffer.alloc(16).toString("base64"),
    iv: Buffer.alloc(12).toString("base64"), ct: Buffer.alloc(16).toString("base64") };
  wd.sqlite.prepare("INSERT INTO vault_pair(one,revision,names,places,updated) VALUES (1,1,?,?,?)")
    .run(JSON.stringify(envelope), JSON.stringify(envelope), "2099-10-01T00:00:00.000Z");
  wd.desk.VAULT_STORE = "pair";
  return { ...wd, roster, associates, people, placed, sales, envelope };
}

async function ownerPage(wd, { loseAppointmentAnswer = false, retained = [] } = {}) {
  const pass = "appointment-fixture-pass";
  const content = await contentKey("4".repeat(64), "maker-existing-appointment");
  const adminOpen = { ok: true, byMaster: true, session: "", wrapMaster: await wrapKey("fixture-master", content) };
  const requests = [];
  let catalog = null;
  let tick = AT_START + ownerPageCount++ * 10000, lose = loseAppointmentAnswer;
  const dom = new JSDOM(landingPage("", "maker-existing-appointment", { master: "fixture-master", accounts: [] }), {
    url: "https://counter.test/all", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true });
      win.TextEncoder = TextEncoder;
      win.TextDecoder = TextDecoder;
      win.scrollTo = () => {};
      win.confirm = () => true;
      const NativeDate = win.Date;
      win.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [tick += 100])); }
        static now() { return tick += 100; }
      };
      for (const [key, value] of retained) win.localStorage.setItem(key, value);
      win.fetch = async (path, init = {}) => {
        const pathname = new URL(String(path), "https://counter.test").pathname;
        if (pathname.startsWith("/all/maker/inputs") || pathname.startsWith("/all/maker/drafts/")) {
          const body = init.body == null ? undefined : JSON.parse(init.body);
          const record = body !== undefined ? { path: pathname, bytes: init.body, body } : null;
          if (record) requests.push(record);
          const response = await wd.call(pathname, body, OWNER);
          if (pathname === "/all/maker/inputs" && response.ok) catalog = (await response.clone().json()).catalog;
          if (record) {
            record.status = response.status;
            record.answer = await response.clone().json();
          }
          if (lose && pathname === "/all/maker/inputs/appoint-existing" && response.ok) {
            lose = false;
            throw new Error("The fixture lost the completed response.");
          }
          return response;
        }
        const value = pathname === "/open" ? adminOpen
          : pathname === "/all/sheet" ? { ok: true, accounts: [] }
            : pathname === "/all/maker/review" ? { ok: true, orders: [], drafts: wd.drafts(), refused: [] }
              : pathname === "/all/maker/hours" ? { ok: true, config: null, status: { open: true, source: "default" } }
                : { ok: true, accounts: [], orders: [], drafts: [], refs: [], tiers: [] };
        return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
      };
    }
  });
  const waitFor = async (predicate) => {
    for (let index = 0; index < 400 && !predicate(); index++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    return predicate();
  };
  dom.window.document.querySelector('button[data-m="maker"]').click();
  const loaded = await waitFor(() => [...dom.window.document.querySelectorAll("#makerInputs .maker-input h3")]
    .some((heading) => heading.textContent === "Appoint existing customer"));
  return { dom, requests, waitFor, loaded, pass, get catalog(){return catalog;} };
}

const sectionOf = (doc, heading) => [...doc.querySelectorAll("#makerInputs .maker-input")]
  .find((section) => section.querySelector("h3")?.textContent === heading);
const field = (section, label) => section && [...section.querySelectorAll("label")]
  .find((node) => node.querySelector(".lbl")?.textContent.trim() === label)?.querySelector("input,select");
const button = (section, text) => section && [...section.querySelectorAll("button")]
  .find((node) => node.textContent.trim() === text);

export async function run({ ok }) {
  const check = ok || ((condition, message) => { if (!condition) throw new Error(message); });
  const appointmentPath = "/all/maker/inputs/appoint-existing";
  const appointmentBody = { at: "2099-10-05T01:00:00.000Z", code: "SZ4-CUS", kind: "reseller" };
  const appointmentRecord = { path: appointmentPath, body: appointmentBody };
  const envelope = { v: 1, salt: "AAAAAAAAAAAAAAAAAAAAAA==", iv: "AAAAAAAAAAAAAAAA", ct: "AAAAAAAAAAAAAAAAAAAAAA==" };
  check(E.vaultPendingOk(appointmentRecord),
    "the retained-input validator accepts the exact appointment shape for an on-roster S-prefixed customer");
  for (const [label, extra] of [
    ["base", { base: { names: envelope, places: null } }],
    ["desired", { desired: { names: envelope, places: null } }],
    ["input", { input: { operation: "add-id", body: appointmentBody } }]
  ]) {
    check(!E.vaultPendingOk({ ...appointmentRecord, ...extra }),
      "the retained appointment whitelist rejects extra top-level " + label);
  }
  check(!E.vaultPendingOk({ path: appointmentPath, body: { ...appointmentBody, parent: null } }),
    "the retained appointment whitelist rejects extra body fields");
  check(!E.vaultPendingOk({ path: appointmentPath,
    body: { ...appointmentBody, at: "2099-02-31" } }),
  "the retained appointment whitelist rejects a non-canonical timestamp");
  check(!E.vaultPendingOk({ path: appointmentPath, body: { ...appointmentBody, kind: "downstream" } }),
    "the retained appointment whitelist rejects an unsupported appointment kind");
  check(!E.vaultPendingOk({ path: appointmentPath, body: { ...appointmentBody, code: "AJ4-RED" } })
    && E.vaultPendingOk({ path: appointmentPath, body: { ...appointmentBody, code: "CJ4-RED" } }),
  "the retained appointment code follows the same [CS] prefix rule as every other retained input");

  const wd = fixture();
  const page = await ownerPage(wd, { loseAppointmentAnswer: true });
  try {
    check(page.loaded, "the generated owner page renders the separate existing-customer appointment form");
    if (!page.loaded) return;
    const doc = page.dom.window.document, section = sectionOf(doc, "Appoint existing customer");
    const customer = field(section, "Existing customer"), role = field(section, "Appointment role");
    const submit = button(section, "Send appointment for review");
    const visibleCodes = customer ? [...customer.options].map((option) => option.value).filter(Boolean) : [];
    const roleValues = role ? [...role.options].map((option) => option.value).filter(Boolean) : [];
    const selectorReady = !!customer && !!role && visibleCodes.includes("CJ4-RED") && visibleCodes.includes("CJ4-BLU")
      && visibleCodes.includes("SZ4-CUS") && visibleCodes.includes("HJ4-NOS") && !visibleCodes.includes("SJ4-SUP")
      && [...customer.options].filter((option) => option.value).every((option) => option.textContent.trim() === option.value)
      && !["DJ4-GON", "EJ4-BAN", "FJ4-ASS", "FJ4-ASS-R"].some((code) => visibleCodes.includes(code));
    check(selectorReady,
      "the server-backed selector lists every eligible roster customer, including S-prefixed ones and one with no sales row, as the Desk's Add ID does; codes: "
        + JSON.stringify(visibleCodes) + "; roles: " + JSON.stringify(role ? [...role.options].map((option) => option.value) : [])
        + "; people: " + wd.sqlite.prepare("SELECT doc FROM state WHERE key='PEOPLE'").get()?.doc
        + "; candidates: " + JSON.stringify(page.catalog?.appointmentCustomers));
    const roleReady = roleValues.join() === "reseller,referral";
    check(roleReady,
      "the appointment role selector offers the engine's reseller and referral kinds only");
    if (!selectorReady || !roleReady || !submit) return;

    const originalNames = wd.sqlite.prepare("SELECT names,places,revision FROM vault_pair WHERE one=1").get();
    const originalSales = wd.sqlite.prepare("SELECT COUNT(*) AS n FROM entry WHERE collection='sales'").get().n;
    wd.desk.VAULT_STORE = "kv";
    const generic = await wd.call("/all/maker/inputs/add-id", {
      at: "2099-10-05T00:59:00.000Z", code: "CJ4-RED", kind: "customer",
      parent: null, geo: null, tiers: null, vault: wd.envelope
    }, OWNER);
    wd.desk.VAULT_STORE = "pair";
    const genericRefused = generic.status === 400 && wd.drafts().length === 0
      && wd.sqlite.prepare("SELECT COUNT(*) AS n FROM maker_request").get().n === 0;
    check(genericRefused,
      "generic Add ID still refuses a roster duplicate before making a draft or receipt");
    if (!genericRefused) return;

    for (const [code, kind, at] of [
      ["CX8-UNKNOWN", "reseller", "2099-10-05T00:58:00.000Z"],
      ["SJ4-SUP", "referral", "2099-10-05T00:58:01.000Z"],
      ["FJ4-ASS-R", "reseller", "2099-10-05T00:58:02.000Z"],
      ["FJ4-ASS", "referral", "2099-10-05T00:58:03.000Z"],
      ["CJ4-RED", null, "2099-10-05T00:58:04.000Z"],
      ["CJ4-RED", "reseller", "2099-10-05T00:58:05.000Z"]
    ]) {
      const body = { at, code, ...(kind ? { kind } : {}) };
      if (at.endsWith("05.000Z")) body.name = "Invented";
      const response = await wd.call("/all/maker/inputs/appoint-existing", body, OWNER);
      check([400, 409].includes(response.status) && wd.drafts().length === 0
        && wd.sqlite.prepare("SELECT COUNT(*) AS n FROM maker_request").get().n === 0,
        "ineligible or widened appointment input is refused without a receipt or draft: " + code + " " + response.status);
    }

    customer.value = "CJ4-RED";
    role.value = "reseller";
    submit.click();
    await page.waitFor(() => page.requests.some((request) => request.path === "/all/maker/inputs/appoint-existing")
      && wd.drafts().length === 1 && !!page.dom.window.localStorage.getItem("saltMakerPending:/all/maker/inputs/appoint-existing"));
    const first = page.requests.find((request) => request.path === "/all/maker/inputs/appoint-existing");
    const retainedKey = "saltMakerPending:/all/maker/inputs/appoint-existing";
    const retained = page.dom.window.localStorage.getItem(retainedKey);
    if (!first) {
      check(false, "the appointment form submits through its dedicated bridge route");
      return;
    }
    const firstDraft = wd.drafts().find((draft) => draft.id === first.body.at);
    check(first.body.code === "CJ4-RED" && first.body.kind === "reseller"
      && Object.keys(first.body).sort().join() === "at,code,kind"
      && !!retained && firstDraft?.status === "pending"
      && firstDraft.entry.payload.mode === "addid" && firstDraft.entry.payload.code === "CJ4-RED"
      && firstDraft.entry.payload.kind === "reseller" && firstDraft.entry.payload.tiers === null
      && firstDraft.entry.payload.geo === null
      && wd.sqlite.prepare("SELECT revision FROM vault_pair WHERE one=1").get().revision === originalNames.revision
      && wd.sqlite.prepare("SELECT COUNT(*) AS n FROM vault_outbox").get().n === 0,
      "the actual UI sends only code, role and timestamp; the native draft appoints without changing the pair or filing location/tier data");

    const retryPage = await ownerPage(wd, { retained: [[retainedKey, retained]] });
    try {
      const hasRecovery = await retryPage.waitFor(() => !!sectionOf(retryPage.dom.window.document, "Retained input"));
      const recovery = sectionOf(retryPage.dom.window.document, "Retained input");
      check(retryPage.loaded && hasRecovery && !!recovery, "a lost appointment answer reloads as a retained input");
      const retry = button(recovery, "Retry unchanged");
      retry.click();
      await retryPage.waitFor(() => !sectionOf(retryPage.dom.window.document, "Retained input"));
      const attempts = retryPage.requests.filter((request) => request.path === "/all/maker/inputs/appoint-existing");
      check(attempts.length === 1 && attempts[0].bytes === JSON.stringify(first.body)
        && wd.drafts().filter((draft) => draft.entry.payload.code === "CJ4-RED").length === 1
        && wd.sqlite.prepare("SELECT COUNT(*) AS n FROM maker_request").get().n === 1,
        "retry after an uncertain answer resends identical bytes and the server answers the same single draft");
      const refreshed = sectionOf(retryPage.dom.window.document, "Appoint existing customer");
      check(![...field(refreshed, "Existing customer").options].some((option) => option.value === "CJ4-RED"),
        "the accepted appointment disappears from the live selector while it waits for approval");
    } finally {
      retryPage.dom.window.close();
    }

    const changed = await wd.call("/all/maker/inputs/appoint-existing",
      { ...first.body, kind: "referral" }, OWNER);
    const duplicate = await wd.call("/all/maker/inputs/appoint-existing",
      { at: "2099-10-05T01:00:05.000Z", code: "CJ4-RED", kind: "referral" }, OWNER);
    check(changed.status === 409 && duplicate.status === 409
      && wd.drafts().filter((draft) => draft.entry.payload.code === "CJ4-RED").length === 1,
      "changed content and a distinct request id cannot queue a second appointment: "
        + changed.status + ", " + duplicate.status + ", drafts " + wd.drafts().length);

    const secondPage = await ownerPage(wd);
    try {
      const secondForm = sectionOf(secondPage.dom.window.document, "Appoint existing customer");
      const secondCustomer = field(secondForm, "Existing customer"), secondRole = field(secondForm, "Appointment role");
      if (!secondCustomer || !secondRole) {
        check(false, "a fresh owner page renders the appointment selectors");
        return;
      }
      secondCustomer.value = "CJ4-BLU";
      secondRole.value = "referral";
      button(secondForm, "Send appointment for review").click();
      await secondPage.waitFor(() => secondPage.requests.some((request) =>
        request.path === "/all/maker/inputs/appoint-existing" && request.status !== undefined));
      const secondRequest = secondPage.requests.find((request) => request.path === "/all/maker/inputs/appoint-existing");
      const secondDraft = wd.drafts().find((draft) => draft.entry.payload.code === "CJ4-BLU");
      check(!!secondRequest && !!secondDraft && secondRequest.body.code === "CJ4-BLU" && secondRequest.body.kind === "referral"
        && secondDraft?.entry.payload.rev === "R3" && secondDraft?.entry.payload.tiers === null
        && secondDraft.entry.payload.geo === null && secondDraft.entry.payload.parent === null
        && wd.drafts().filter((draft) => draft.status === "pending").length === 2,
        "the generated selector submits a referral appointment through its own pending draft: "
          + JSON.stringify(secondRequest) + ", drafts " + wd.drafts().length
          + ", status " + secondForm.querySelector('[role="status"]')?.textContent);
    } finally {
      secondPage.dom.window.close();
    }

    const approved = [];
    for (const draft of wd.drafts()) {
      const decision = await wd.call("/all/maker/drafts/" + encodeURIComponent(draft.id) + "/approve", {}, OWNER);
      check(decision.status === 200, "the actual Admin draft route approves the appointment: " + draft.id);
      approved.push(wd.drafts().find((row) => row.id === draft.id));
    }
    check(approved.length === 2 && approved.every((draft) => draft.status === "approved"),
      "both appointment requests reach the native approved state");
    const foldBook = {
      sales: wd.sqlite.prepare("SELECT doc FROM entry WHERE collection='sales' ORDER BY seq").all().map((row) => JSON.parse(row.doc)),
      purchases: wd.sqlite.prepare("SELECT doc FROM entry WHERE collection='purchases' ORDER BY seq").all().map((row) => JSON.parse(row.doc)),
      roster: [...wd.roster], associates: [...wd.associates], PEOPLE: structuredClone(wd.people),
      PLACED: structuredClone(wd.placed), PRODUCTS: { salt: {} }
    };
    const identityBefore = JSON.stringify(foldBook.PEOPLE);
    const placedBefore = JSON.stringify(foldBook.PLACED);
    const staged = { ok: true, approved: approved.map((draft) => ({
      id: draft.id, collection: draft.collection, entry: draft.entry, row: draft.row
    })) };
    const masterText = readFileSync(new URL("../master/salt_command.html", import.meta.url), "utf8");
    const currentVersion = Number((masterText.match(/const evolution=\[\{\s*"?v"?\s*:\s*['"]v(\d+)/) || [])[1]);
    const folded = apply(foldBook, staged, { version: "v" + (currentVersion + 1), title: "Appointment fixture",
      notes: ["Appointment fixture"], rows: {} }, masterText);
    const users = { "CJ4-RED": "existing-account", "CJ4-BLU": "existing-account-b" };
    const minted = mintUsernames(users, staged, folded.folded, ["2345-6789"]);
    const planResult = plan({ ...foldBook, roster: [...wd.roster], associates: [...wd.associates] }, staged, null);
    check(folded.ok && planResult.items.length === 2 && planResult.refused.length === 0
      && foldBook.roster.filter((code) => code === "CJ4-RED").length === 1
      && foldBook.roster.filter((code) => code === "CJ4-BLU").length === 1
      && foldBook.roster.filter((code) => code === "CJ4-RED-R").length === 1
      && foldBook.roster.filter((code) => code === "CJ4-BLU-R").length === 1
      && foldBook.associates.includes("CJ4-RED") && foldBook.associates.includes("CJ4-BLU"),
      "the approved native appointment fold elevates each existing customer once and adds each -R bucket");
    check(foldBook.sales.length === originalSales,
      "folding existing-customer appointments creates no downstream sales or money rows");
    const namesAfterFold = wd.sqlite.prepare("SELECT names,places,revision FROM vault_pair WHERE one=1").get();
    check(JSON.stringify(foldBook.PEOPLE) === identityBefore && JSON.stringify(foldBook.PLACED) === placedBefore
      && minted.length === 0 && users["CJ4-RED"] === "existing-account" && users["CJ4-BLU"] === "existing-account-b"
      && namesAfterFold.names === originalNames.names && namesAfterFold.places === originalNames.places
      && namesAfterFold.revision === originalNames.revision,
      "folding appointments preserves names, places, identity and existing account usernames without minting accounts");
  } finally {
    page.dom.window.close();
    wd.sqlite.close();
  }
  const unreadable = fixture();
  try {
    unreadable.map.set("q:broken-device", "{not json");
    const answer = await unreadable.call("/all/maker/inputs");
    const read = await answer.json();
    check(answer.status === 200 && read.ok === true && read.catalog.parties.length > 0
      && Array.isArray(read.catalog.products) && Array.isArray(read.catalog.appointmentCustomers)
      && read.catalog.appointmentCustomers.length === 0 && typeof read.catalog.appointmentNotice === "string",
    "one unreadable queue key withholds the appointment list with a notice and leaves the trade catalogue whole: "
      + answer.status);
  } finally {
    unreadable.sqlite.close();
  }
  const claimRace = fixture();
  try {
    const at = ["2099-10-05T02:00:00.000Z", "2099-10-05T02:00:01.000Z"];
    const claims = await Promise.all(at.map((timestamp, index) => {
      const entry = E.addIdEntry({ at: timestamp, code: "CJ4-RED", kind: "reseller",
        parent: null, rev: "R2", geo: null, tiers: null });
      return makerAppointmentClaim(claimRace.desk.SALT_LEDGER, timestamp,
        String(index + 1).repeat(64), entry, "CJ4-RED");
    }));
    check(claims.filter((claim) => claim.claimed).length === 1
      && claimRace.sqlite.prepare("SELECT COUNT(*) AS n FROM maker_request WHERE operation='appoint-existing'").get().n === 1,
      "the atomic receipt admits one of two simultaneous distinct appointment ids for the same customer");
  } finally {
    claimRace.sqlite.close();
  }
  const raced = fixture();
  try {
    const body = (at) => ({ at, code: "CJ4-RED", kind: "reseller" });
    const answers = await Promise.all([
      raced.call("/all/maker/inputs/appoint-existing", body("2099-10-05T02:00:00.000Z"), OWNER),
      raced.call("/all/maker/inputs/appoint-existing", body("2099-10-05T02:00:01.000Z"), OWNER)
    ]);
    check(answers.map((response) => response.status).sort().join() === "200,409"
      && raced.drafts().filter((draft) => draft.entry.payload.code === "CJ4-RED").length === 1,
      "concurrent distinct request ids reserve one existing-customer appointment and refuse the other");
  } finally {
    raced.sqlite.close();
  }
}
