import { webcrypto } from "node:crypto";
import { openMaster } from "../tools/payload.mjs";
import { vaultEncrypt } from "../tools/seed-vault.mjs";

/* B3 of #62: entries left in a Desk device's queue are listed, sent by their own road or discarded, and the overlay can be switched. */
export async function run({ ok, KV, worker }) {
  const pass = "invented-recovery-pass", key = "invented-recovery-key-32-characters";
  const { w } = await openMaster();
  const BOOK = "2099-01-01T00:00:01.000Z", VAULT = "2099-01-01T00:00:02.000Z", NOTE = "2099-01-01T00:00:03.000Z";
  const loss = (at, kg) => ({ at, type: "LOSS", party: null, qty: kg, total: null, status: "unpaid", raw: "Self-use " + kg + " units",
    payload: { mode: "loss", date: "2026-10-01", product: "salt", kg, why: "other", note: "" } });
  const addId = (at, note) => ({ at, type: "ADDID", party: "CX9-TST", qty: null, total: null, status: "addid", raw: "Add CX9-TST to the roster as: customer",
    payload: { mode: "addid", code: "CX9-TST", kind: "customer", parent: null, rev: null, note: note || null, geo: null, tiers: null } });
  try {
    Object.defineProperty(w, "crypto", { value: webcrypto, configurable: true });
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    w.prompt = () => pass; let confirmed = true; w.confirm = () => confirmed;
    w.localStorage.setItem("saltWriteKey", key);
    const box = w.document.createElement("div"); box.id = "queueBox"; w.document.body.appendChild(box);   // the Record tab's queue box, on its own
    const names = await vaultEncrypt(pass, { "CX1-ZED": "Invented name" });
    const queuePosts = [], vaultPosts = []; let queueMode = "ok", vaultMode = "ok";
    const answer = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
    w.fetch = async (path, options = {}) => {
      path = String(path);
      if (path === "queue" && options.method === "POST") {
        const sent = JSON.parse(options.body); queuePosts.push(sent.queue.map((e) => e.at));
        if (queueMode === "fail") return answer({ ok: false }, 500);
        if (queueMode === "short") return answer({ ok: true, entries: sent.queue.length + 1, droppedAts: [] });
        return answer({ ok: true, entries: sent.queue.length, droppedAts: [] });
      }
      if (path === "vault") return answer({ ok: true, revision: 1 });
      if (path === "vault/pair") return answer({ ok: true, revision: 1, names, places: null });
      if (path.startsWith("vault/inputs/")) {
        vaultPosts.push({ path, body: JSON.parse(options.body) });
        return vaultMode === "fail" ? answer({ ok: false, error: "the pair refused" }, 500) : answer({ ok: true, revision: 2 });
      }
      return answer({ ok: false }, 404);
    };
    const setup = (entries) => {
      w.localStorage.removeItem("saltQueueReceipts");
      w.eval("qReceipts=new Set();qRecMsg='';OVERLAY_UNSENT=true;qSyncState='server';vaultPairVersion=1;render=function(){};renderReveal=function(){};"
        + "qSentThrough=qSentAtLoad='2000-01-01T00:00:00.000Z';queue=" + JSON.stringify(entries) + ";applyOverlay();"
        + "localStorage.setItem('saltQueue',JSON.stringify(queue));renderQueue();");
    };
    const stored = () => JSON.parse(w.localStorage.getItem("saltQueue") || "[]").map((e) => e.at);
    const panel = () => w.document.getElementById("queueBox").innerHTML;
    const q = (at) => JSON.stringify(at);
    /* the master drops to its download road after a failed post; the built desk (P6b) does not, so each send starts on the server road */
    const send = (at) => w.eval("qSyncState='server';qRecSend(" + q(at) + ")");

    /* ---- the panel lists each unsent entry with its road ---- */
    setup([loss(BOOK, 2), addId(VAULT), addId(NOTE, "a note")]);
    const html = panel();
    ok(/Unsent on this device \(3\)/.test(html) && html.includes("qRecSend('" + BOOK + "')") && html.includes("qRecDiscard('" + BOOK + "')"),
      "the recovery panel lists every unsent entry, each with Send and Discard");
    ok(!html.includes("qRecSend('" + NOTE + "')") && html.includes("qRecDiscard('" + NOTE + "')") && /Cannot be sent/.test(html),
      "an entry that cannot go by either road says so and offers only Discard");
    ok(w.eval("qRoad(queue[0])") === "book" && w.eval("qRoad(queue[1])") === "vault" && w.eval("qRoad(queue[2])") === "none",
      "a trade-kind entry takes the book road, a non-bucket Add ID the vault pair");

    /* ---- the book road: kept until the Worker's receipt, listed no more after ---- */
    queueMode = "fail";
    await send(BOOK);
    ok(stored().includes(BOOK) && w.eval("qIsUnsent(queue[0])") === true && panel().includes("qRecSend('" + BOOK + "')"),
      "a refused post leaves the entry in localStorage and in the panel");
    queueMode = "short";
    await send(BOOK);
    ok(w.eval("qIsUnsent(queue[0])") === true && w.eval("qReceipts.has(" + q(BOOK) + ")") === false,
      "an answer whose count is not what was posted is no receipt");
    queueMode = "ok";
    await send(BOOK);
    ok(w.eval("qReceipts.has(" + q(BOOK) + ")") === true && w.eval("qIsUnsent(queue[0])") === false
      && !panel().includes("qRecSend('" + BOOK + "')") && stored().includes(BOOK),
      "the Worker's receipt takes the entry off the unsent list and the book entry's bytes stay for the fold to clear");
    ok(queuePosts.length >= 3 && queuePosts.every((p) => !p.includes(VAULT) && !p.includes(NOTE)),
      "no /queue post ever carried a vault-kind entry, which the Worker refuses whole in pair mode");

    /* ---- the vault road ---- */
    vaultMode = "fail";
    await send(VAULT);
    ok(stored().includes(VAULT) && w.eval("queue.some(q=>q.at===" + q(VAULT) + ")"),
      "a refused vault input leaves the entry where it was");
    vaultMode = "ok";
    const beforePosts = queuePosts.length;
    await send(VAULT);
    const sent = vaultPosts.at(-1);
    ok(sent && sent.path === "vault/inputs/add-id" && sent.body.at === VAULT && sent.body.code === "CX9-TST" && queuePosts.length === beforePosts,
      "a vault-kind entry goes by the pair under its own stamp and never through /queue");
    ok(!stored().includes(VAULT) && w.eval("qReceipts.has(" + q(VAULT) + ")") === true,
      "and leaves the device only once the pair has answered");

    /* ---- discard asks first ---- */
    confirmed = false;
    w.eval("qRecDiscard(" + q(NOTE) + ")");
    ok(stored().includes(NOTE), "Discard declined at the confirm keeps the entry");
    confirmed = true;
    w.eval("qRecDiscard(" + q(NOTE) + ")");
    ok(!stored().includes(NOTE), "Discard confirmed removes it");

    /* ---- the overlay switch and the marks ---- */
    const U = "2099-01-01T00:00:09.000Z", R = "2099-01-01T00:00:08.000Z";
    setup([loss(U, 3), loss(R, 4)]);
    w.eval("qReceipts.add(" + q(R) + ")");
    const base = w.eval("BASE_SELFUSE.length");
    w.eval("applyOverlay();renderProvBar();");
    ok(w.eval("selfUseLog.length") === base + 2 && w.eval("provUnsent") === 1 && w.eval("unsentAts.has(" + q(U) + ")") === true,
      "switch on: an unsent entry folds into the figures and is counted as unsent, a receipted one is not");
    ok(/<b>1<\/b> is <b>unsent<\/b>/.test(w.document.getElementById("provBar").innerHTML),
      "and the bar over every figure says how many are unsent");
    w.eval("OVERLAY_UNSENT=false;applyOverlay();renderProvBar();");
    ok(w.eval("selfUseLog.length") === base + 1 && w.eval("provUnsent") === 0 && w.eval("provCount") === 1,
      "switch off: the unsent entry leaves every figure and the receipted one stays");
    ok(/None counts in any figure/.test(w.eval("renderRecovery()")), "and the panel says so");

    /* ---- the Worker: in pair mode a post omitting a vault-kind entry the device still holds does not withdraw it ---- */
    const kv = new KV(), env = { SALT_QUEUE: kv, VAULT_STORE: "pair", REQUIRE_ACCESS: "0" };
    const held = addId(VAULT), keep = loss(BOOK, 2);
    const reset = () => kv.put("q:dev1", JSON.stringify({ device: "dev1", queue: [keep, held] }));
    const post = async (vaultHeld) => (await worker.fetch(new Request("https://desk.test/queue", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ device: "dev1", queue: [keep], vaultHeld }) }), env, { waitUntil() {} })).json();
    const inKv = async () => JSON.parse(await kv.get("q:dev1")).queue.map((e) => e.at);
    await reset();
    const r = await post([VAULT]);
    ok(r.ok && (await inKv()).includes(VAULT) && r.entries === 1 && r.carried === 1,
      "a post that omits a vault-kind entry the device still holds leaves it in KV, carried and not counted as posted");
    await post([]);
    ok(!(await inKv()).includes(VAULT) && (await inKv()).includes(BOOK), "a discarded vault entry (no longer held) leaves KV on the next post");
    const rejDb = { prepare: (sql) => { const st = { bind: () => st, first: async () => /FROM draft/.test(sql) ? { status: "rejected" } : null,
      all: async () => ({ results: [] }), run: async () => ({ meta: { changes: 1 }, success: true }) }; return st; } };
    await reset();
    const rr = await (await worker.fetch(new Request("https://desk.test/queue", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ device: "dev1", queue: [keep], vaultHeld: [VAULT] }) }), { ...env, SALT_LEDGER: rejDb }, { waitUntil() {} })).json();
    ok(rr.carried === undefined || rr.carried === 0 ? !(await inKv()).includes(VAULT) : false, "a vault entry whose draft was rejected is not carried back");
  } finally { w.close(); }
}
