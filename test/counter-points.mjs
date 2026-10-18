/* test/counter-points.mjs: COUNTER BATCH A'S COLLECTION POINT (his decisions of 18 Oct 2026; docs/plan-counter-batch-a.html, parts 2 and 3).
 *
 * His points are Counter KV maker:points, a code and a place each, written by Counter Admin alone. Ready to collect names one and the
 * order keeps a snapshot of its place (pointAt); Change point moves one order on purpose. The customer reads the place only while the
 * order waits at the point; the Desk never reads it, on any of the five roads the raw order leaves the Counter by. Driven on the real
 * roads (the Counter Worker, the Desk Worker and the order book in node), the owner's page in jsdom, and the fixture's builder. Every
 * code, name and place here is invented. Each check was proved red by its own mutation (test/counter-points.mutations.json).
 */
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import desk from "../src/worker.js";
import counter from "../stmt/worker.js";
import { orderBook } from "./orderbook-harness.mjs";
import { Store, ledger } from "./maker-order-controls.mjs";
import { richOwnerPage, byAct } from "./maker-act.mjs";
import * as O from "../stmt/orders.js";
import { validatePoints, resolvePoint, POINTS_KEY } from "../stmt/points.js";
import { TEST_USER, FIX_VERSION, fixKey, exampleAccount, EXAMPLE_POINTS } from "../stmt/testfix.js";
import { sealedNews } from "../stmt/push.js";
import { NEWS } from "../stmt/sw.js";
import { WORDS } from "../stmt/words.js";

const REPO = join(import.meta.dirname, "..");
const A2 = { code: "A2", lat: 3.11111, lng: 101.22222 }, C3 = { code: "C3", lat: 3.33333, lng: 101.44444 };
const coords = (x) => [x.lat, x.lng].map(String);
const holds = (v, p) => coords(p).some((c) => JSON.stringify(v).includes(c));

export async function run({ ok, pageWork }) {
  /* ---- 1. the list: its shape, and nothing free-text ---- */
  {
    const good = validatePoints({ list: [{ code: "A2", lat: 3.111114, lng: 101.222226 }] });
    const bad = [["a roster-shaped code", { list: [{ code: "CX1-AB", lat: 3, lng: 101 }] }], ["a label", { list: [{ code: "A2", lat: 3, lng: 101, label: "by the gate" }] }],
      ["21 points", { list: Array.from({ length: 21 }, (_, i) => ({ code: "A" + (i + 1), lat: 3, lng: 101 })) }], ["a place outside Malaysia", { list: [{ code: "A2", lat: 51.5, lng: -0.12 }] }],
      ["two of one code", { list: [{ code: "A2", lat: 3, lng: 101 }, { code: "A2", lat: 4, lng: 102 }] }]];
    const refused = bad.filter(([, v]) => validatePoints(v).error);
    ok(!good.error && good.list[0].lat === 3.11111 && good.list[0].lng === 101.22223 && refused.length === bad.length,
      `a point is a code of one letter and one or two digits and its place to five places; a roster-shaped code, a label, 21 points, a place outside Malaysia and a code twice are refused (${refused.map((b) => b[0]).join(", ")})`);
    ok(resolvePoint([A2], "A2").lat === A2.lat && resolvePoint([A2], "B7") === null && resolvePoint([A2], "CX1-AB") === null,
      "the one resolver gives a listed code's place and nothing for a code the list lacks");
  }

  /* ---- the real roads ---- */
  const store = new Store(), queue = new Store(), team = "points-fixture", audience = "points-audience", kid = "points-key";
  const signing = await webcrypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const publicKey = await webcrypto.subtle.exportKey("jwk", signing.publicKey);
  const env = { STMT: store, ACCESS_TEAM: team, ACCESS_AUD: audience, STMT_MASTER: "points-local-master",
    STMT_DESK_KEY: "points-desk-test-capability-000001", COUNTER_MAKER_KEY: "points-maker-test-capability-000001", ORDER_STORE: "object" };
  const harness = orderBook(env);
  /* the replace road hands back an order from the book's receipt: the fixture answers one carrying a place, so its strip is measured */
  let replaceAnswer = null;
  env.ORDERBOOK = { idFromName: (n) => harness.ns.idFromName(n), get: (id) => ({ fetch: async (url, init) => {
    if (replaceAnswer && String(url) === "https://orderbook/replacement") return Response.json({ ok: true, order: replaceAnswer });
    return harness.ns.get(id).fetch(url, init);
  } }) };
  const L = ledger();
  const deskEnv = { SALT_QUEUE: queue, SALT_LEDGER: L.db, COUNTER_MAKER_KEY: env.COUNTER_MAKER_KEY, STMT_DESK_KEY: env.STMT_DESK_KEY,
    STMT_SITE: { fetch: (url, init) => { calls.site++; return counter.fetch(new Request(url, init), env); } } };
  /* each layer refuses on its own: a refusal at Counter Admin reaches no Desk, and one at the Desk reaches no Counter */
  const calls = { desk: 0, site: 0 };
  env.DESK_MAKER = { fetch: (request) => { calls.desk++; return desk.fetch(request, deskEnv, {}); } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url) === "https://" + team + ".cloudflareaccess.com/cdn-cgi/access/certs") return Response.json({ keys: [{ ...publicKey, kid }] });
    throw new Error("Unexpected points fixture request: " + url);
  };
  try {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
    const claimsOf = (email) => Buffer.from(JSON.stringify({ iss: "https://" + team + ".cloudflareaccess.com", aud: [audience], email,
      exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const jwtOf = async (email) => { const c = claimsOf(email); return header + "." + c + "." + Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",
      signing.privateKey, new TextEncoder().encode(header + "." + c))).toString("base64url"); };
    const jwt = await jwtOf("maakmal97@icloud.com"), stranger = await jwtOf("someone@example.test");
    const as = (token) => (path, body, method = "POST") => counter.fetch(new Request("https://counter.fixture.test" + path, {
      method, headers: { ...(token ? { "cf-access-jwt-assertion": token } : {}), "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
    const owner = as(jwt);
    const deskDirect = (id, body) => desk.fetch(new Request("https://desk.fixture.test/_internal/maker/orders/" + id + "/move", {
      method: "POST", headers: { "X-Counter-Maker-Key": env.COUNTER_MAKER_KEY, "content-type": "application/json" }, body: JSON.stringify(body) }), deskEnv, {});
    const deskRead = async (path, body) => (await counter.fetch(new Request("https://counter.fixture.test" + path, { method: body ? "POST" : "GET",
      headers: { "X-Stmt-Desk": env.STMT_DESK_KEY, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }), env)).json();

    /* ---- 2. the points route: the verified owner alone, the whole list a POST, the test accounts' own beside it ---- */
    const none = await as(null)("/all/maker/points", undefined, "GET"), other = await as(stranger)("/all/maker/points", { list: [A2] });
    const saved = await owner("/all/maker/points", { list: [A2, C3] }), read = await (await owner("/all/maker/points", undefined, "GET")).json();
    const badSave = await owner("/all/maker/points", { list: [{ code: "A2", lat: 3, lng: 101, note: "x" }] });
    ok([401, 403].includes(none.status) && [401, 403].includes(other.status) && saved.status === 200 && badSave.status === 400 && read.ok && JSON.stringify(read.points.list) === JSON.stringify([A2, C3])
      && JSON.stringify(read.examples) === JSON.stringify(EXAMPLE_POINTS) && JSON.parse(await store.get(POINTS_KEY)).list.length === 2,
      `his points are read and written only by the verified owner (${none.status}, ${other.status}), stored whole at maker:points, a list with a note refused (${badSave.status}), the test accounts' own answered beside them`);

    const u = "abcd-efgh", at = new Date().toISOString(), digest = "points-list";
    await queue.put("stmt-users", JSON.stringify({ [u]: "CX1-AB" }));
    const base = { product: "salt", qty: 3, total: 285, unit: 95, mode: "collect", place: "", forFriend: false, week: "", digest };
    let serial = 10;
    const make = (state = "acknowledged") => {
      const order = O.decidePlace(u, { ...base, rid: "points-fixture-" + (++serial) + "-pad-pad" }, [], at, digest).ev.order;
      order.id = "2026" + "1018" + "080" + String(serial).padStart(3, "0") + "-p" + serial;
      harness.book.append(null, u, order.id, { kind: "place", at, order }, null);
      if (state !== "placed") harness.book.run("desk", { u, id: order.id, body: { status: "acknowledged", mode: "collect" } });
      return order.id;
    };
    const book = (id) => harness.book.order(u, id);
    const rid = (n) => "points-request-" + n + "-padded-0";
    const move = (id, body) => owner("/all/maker/orders/" + id + "/move", body);

    /* ---- 3. a collect Ready needs a point, at the maker, the Desk and the order book; never on a delivery, a Decline or a Cancel ---- */
    const idA = make();
    const c0 = { ...calls }, makerNo = await move(idA, { status: "ready", mode: "collect", rid: rid(1) }), c1 = { ...calls };
    const deskNo = await deskDirect(idA, { status: "ready", mode: "collect", rid: rid(2) }), c2 = { ...calls };
    const noPoint = [makerNo, deskNo];
    ok(makerNo.status === 400 && c1.desk === c0.desk && deskNo.status === 400 && c2.site === c1.site,
      "Counter Admin refuses a collect Ready with no point before any Desk is asked, and the Desk before any Counter is: " + JSON.stringify([c0, c1, c2]));
    const bookNo = harness.book.run("desk", { u, id: idA, body: { status: "ready", mode: "collect" } });
    ok(noPoint.every((r) => r.status === 400) && bookNo.ok === false && bookNo.code === "pointNeeded" && book(idA).status === "acknowledged",
      `Ready to collect with no point is refused by Counter Admin, by the Desk and by the order book (${noPoint.map((r) => r.status).join(",")}, ${bookNo.code})`);
    const misplaced = [{ status: "ready", mode: "deliver", point: "A2", rid: rid(3) }, { status: "declined", point: "A2", note: "No.", rid: rid(4) },
      { status: "cancelled", point: "A2", rid: rid(5) }];
    const c3 = { ...calls }, atMaker = await Promise.all(misplaced.map((b) => move(idA, b))), c4 = { ...calls };
    const atDesk = await Promise.all(misplaced.map((b) => deskDirect(idA, b))), c5 = { ...calls };
    ok(c4.desk === c3.desk && c5.site === c4.site, "and a point on a delivery, a Decline or a Cancel the same, each layer on its own: " + JSON.stringify([c3, c4, c5]));
    const atBook = harness.book.run("desk", { u, id: idA, body: { status: "ready", mode: "deliver", point: "A2" }, pointAt: { lat: A2.lat, lng: A2.lng } });
    ok(atMaker.every((r) => r.status === 400) && atDesk.every((r) => r.status === 400) && atBook.ok === false && book(idA).status === "acknowledged" && !book(idA).point,
      `a point beside a delivery, a Decline or a Cancel is refused at Counter Admin, the Desk and the order book (${atMaker.map((r) => r.status)}/${atDesk.map((r) => r.status)}/${atBook.ok})`);
    const unknown = await move(idA, { status: "ready", mode: "collect", point: "B7", rid: rid(6) }), unknownBody = await unknown.json();
    ok(unknown.status === 400 && unknownBody.error === WORDS.en["e.pointUnknown"] && book(idA).status === "acknowledged",
      "a code his list lacks is refused in the Counter's words, and the order does not move: " + unknown.status + " " + unknownBody.error);

    /* ---- 4. Ready at A2: once, its place a snapshot; a retry answered from its id, whatever has become of A2 since ---- */
    const ready = { status: "ready", mode: "collect", point: "A2", rid: rid(7) };
    const r1 = await move(idA, ready), r1b = await r1.json();
    const after = book(idA);
    ok(r1.status === 200 && after.status === "ready" && after.point === "A2" && after.pointAt?.lat === A2.lat && after.pointAt?.lng === A2.lng,
      "Ready to collect at A2 moves the order to ready at A2, its place copied from his list: " + JSON.stringify([r1.status, after.point, after.pointAt]));
    const line = after.history[after.history.length - 1];
    ok(line.status === "ready" && line.point === "A2" && !holds(after.history, A2), "and its history line names the code and never the place: " + JSON.stringify(line));
    ok(!holds(r1b, A2) && r1b.order && r1b.order.point === "A2", "the answer the Desk relays to his page carries the code and not the place");
    await owner("/all/maker/points", { list: [{ code: "A2", lat: 4.5, lng: 102.5 }, C3] });
    const again = await move(idA, ready), againBody = await again.json();
    ok(again.status === 200 && againBody.again === true && book(idA).pointAt?.lat === A2.lat,
      "A2 moved on his list, the order waiting there keeps its own copy, and the same tap again is answered from its id: " + JSON.stringify([again.status, againBody.again, book(idA).pointAt]));
    const direct = harness.book.run("desk", { u, id: idA, body: { ...ready, maker: true }, pointAt: { lat: 4.5, lng: 102.5 } });
    ok(direct.ok && direct.again === true && book(idA).pointAt?.lat === A2.lat && book(idA).pointAt?.lng === A2.lng,
      "the order book answers the retry from its id before the place it carries is read, so a new place on a retry moves nothing: " + JSON.stringify([direct.ok, direct.again, book(idA).pointAt]));
    await owner("/all/maker/points", { list: [C3] });
    const gone = await move(idA, ready), goneBody = await gone.json();
    ok(gone.status === 200 && goneBody.again === true, "with A2 off the list, a retry of the Ready that landed is still answered again, never refused: " + gone.status);
    const otherCode = await move(idA, { ...ready, point: "C3" });
    ok(otherCode.status === 409 && book(idA).point === "A2", "the same request id with another code is refused: " + otherCode.status);
    await owner("/all/maker/points", { list: [A2, C3] });

    /* ---- 5. what the customer reads, and when ---- */
    const view = O.customerView(book(idA));
    ok(view.point === "A2" && view.pointAt && view.pointAt?.lat === A2.lat, "the customer reads the code and the place while the order waits at the point");
    harness.book.run("desk", { u, id: idA, body: { handover: { units: 1 } } });
    const part = book(idA);
    ok(part.point === "A2" && part.pointAt?.lat === A2.lat && O.customerView(part).pointAt, "a part handed over leaves the point and its place where they were, still read");
    const moved = await move(idA, { point: "C3", rid: rid(8) }), m1 = book(idA), mline = m1.history[m1.history.length - 1];
    ok(moved.status === 200 && m1.point === "C3" && m1.pointAt?.lat === C3.lat && mline.point === "C3" && mline.note === "point moved to C3" && mline.status === "ready" && !holds(m1.history, C3) && !holds(m1.history, A2),
      "Change point moves the order to C3, its history line the code alone: " + JSON.stringify(mline));
    const sameAgain = await move(idA, { point: "C3", rid: rid(8) });
    ok(sameAgain.status === 200 && (await sameAgain.json()).again === true, "and Change point is a move under its own id, answered once");
    harness.book.run("desk", { u, id: idA, body: { handover: { units: 3 } } });
    const handed = book(idA), noMore = await move(idA, { point: "A2", rid: rid(9) });
    ok(handed.point === "C3" && !O.customerView(handed).pointAt && O.customerView(handed).point === "C3" && noMore.status === 409,
      "all handed over, the code stays and the place leaves what they read, and Change point is refused: " + JSON.stringify([O.customerView(handed).pointAt, noMore.status]));
    /* an order set ready again by a fix undo or an amendment, owing only money, is not waiting at the point */
    const owing = Object.assign(JSON.parse(JSON.stringify(handed)), { status: "ready", paid: 0 });
    const idC = make(); harness.book.run("desk", { u, id: idC, body: { status: "cancelled" } });
    const cancelled = Object.assign(JSON.parse(JSON.stringify(book(idA))), { status: "cancelled", moved: 0 });
    ok(!O.customerView(owing).pointAt && !O.customerView(cancelled).pointAt && O.customerView(cancelled).point === "C3",
      "an order at Ready owing only money, or cancelled, carries the code and never the place");

    /* ---- 6. the Desk never reads a place: the five roads the raw order leaves the Counter by ---- */
    const idB = make(); await move(idB, { status: "ready", mode: "collect", point: "A2", rid: rid(10) });
    const roads = { all: await deskRead("/desk/orders?all=1"), open: await deskRead("/desk/orders"), work: await deskRead("/desk/orders?work=1"), last: await deskRead("/desk/orders/last?work=1") };
    replaceAnswer = Object.assign(JSON.parse(JSON.stringify(book(idB))));
    roads.replace = await deskRead("/desk/orders/" + u + "/" + idB + "/replace", { rid: rid(11), buildId: "0".repeat(16) });
    replaceAnswer = null;
    roads.move = await deskRead("/desk/orders/" + u + "/" + idB, { message: "See you there.", rid: rid(12) });
    const shown = Object.entries(roads).map(([k, v]) => [k, v.ok === true && JSON.stringify(v).includes('"point":"A2"'), holds(v, A2) || JSON.stringify(v).includes("pointAt")]);
    ok(shown.every(([, has, leak]) => has && !leak),
      "none of the Desk's five roads (the orders, the open ones, the two work reads, a replacement's answer, a move's answer) carries the place, each carries the code: " + JSON.stringify(shown));
    /* a point makes no ledger stage: the stages the Desk owes this order are the same with its point and its place taken off, so no
       entry, and no note, is ever made of one */
    const atB = book(idB), bare = Object.assign(JSON.parse(JSON.stringify(atB)), { queued: { ack: "x" } }), told = Object.assign(JSON.parse(JSON.stringify(bare)));
    delete told.point; delete told.pointAt;
    ok(atB.point === "A2" && JSON.stringify(O.orderWork(bare)) === JSON.stringify(O.orderWork(told)) && !O.orderWork(bare).length,
      "a point makes no ledger stage: the stages owed with it are the stages owed without it, none: " + JSON.stringify([O.orderWork(bare), O.orderWork(told)]));

    /* ---- 7. an example order: the test accounts' points alone, the place kept out of the request ---- */
    const exId = "20261018080000-expt1";
    const exOrder = { ...O.decidePlace(TEST_USER, { ...base, rid: "points-fixture-ex-pad-pad" }, [], at, digest).ev.order,
      id: exId, status: "acknowledged", history: [{ at, status: "placed", by: "customer" }, { at, status: "acknowledged", by: "desk" }] };
    await store.put("u:" + TEST_USER, JSON.stringify({ test: true, wrap: { salt: "points-wrap" } }));
    await store.put(fixKey(TEST_USER), JSON.stringify({ v: FIX_VERSION, salt: "points-wrap", at: "2026-10-18T08:00:00.000Z",
      env: { iv: "points-iv" }, claims: [], orders: [], makerBook: { sales: [] }, makerOrders: [exOrder] }));
    const exReal = await move(exId, { status: "ready", mode: "collect", point: "A2", rid: rid(13) });
    const exMove = await move(exId, { status: "ready", mode: "collect", point: "Z9", rid: rid(14) });
    const exNow = (await exampleAccount(env, TEST_USER)).orders.find((o) => o.id === exId), z9 = EXAMPLE_POINTS.find((p) => p.code === "Z9");
    const receipts = harness.db.prepare("SELECT receipts FROM fixture_account WHERE u=?").get(TEST_USER).receipts;
    ok(exReal.status === 400 && exMove.status === 200 && exNow.point === "Z9" && exNow.pointAt?.lat === z9.lat && !holds(exNow, A2)
      && receipts.includes("Z9") && !holds(receipts, z9) && !receipts.includes("pointAt"),
      "an example order is ready at the test accounts' Z9 alone, its place from their list, his A2 refused there, and the request it keeps names no place: " + JSON.stringify([exReal.status, exMove.status, exNow.point]));
  } finally { globalThis.fetch = originalFetch; }

  /* ---- 8. the banner: fixed words, no code ---- */
  {
    const w = O.wakes({ kind: "point", at: "2026-10-18T08:00:00.000Z", point: "C3", pointAt: { lat: C3.lat, lng: C3.lng } }, { id: "x1" }, false);
    const sealed = sealedNews(Object.assign({ t: "C3" }, w), "x1");
    ok(w && w.k === "point-moved" && JSON.stringify(sealed) === JSON.stringify({ k: "point-moved", o: "x1" }) && /collection point has changed/.test(NEWS["point-moved"])
      && !/\{/.test(WORDS.en["news.point-moved"] + WORDS.en["news.point-moved.b"]),
      "Change point wakes them as point-moved, in fixed words, the banner carrying no code: " + JSON.stringify(sealed));
  }

  /* ---- 9. the public desk and the master carry no point, no list key and no place ---- */
  {
    const pub = readFileSync(join(REPO, "public", "desk.html"), "utf8"), master = readFileSync(join(REPO, "master", "salt_command.html"), "utf8");
    const leaks = [["maker:points", (t) => t.includes("maker:points")], ["pointAt", (t) => t.includes("pointAt")], ["a test point's place", (t) => EXAMPLE_POINTS.some((p) => holds(t, p))]];
    const found = leaks.filter(([, f]) => f(pub) || f(master)).map(([n]) => n);
    ok(found.length === 0, "the public desk and the master carry no list key, no point's place and no test point (found: " + (found.join(", ") || "none") + ")");
  }

  /* ---- 10. his page: the Points card draws his list, and Ready to collect asks which point ---- */
  {
    const examples = EXAMPLE_POINTS;
    const p = await richOwnerPage({ pageWork, extra: (route) => route === "/all/maker/points" ? { ok: true, points: { v: 1, list: [A2] }, examples } : undefined });
    try {
      await p.work.quiet();
      await p.click(byAct(p.d, "nav.shop")); await p.click(byAct(p.d, "part.shop.hours"));
      const card = p.d.getElementById("makerPoints"), text = card ? card.textContent : "";
      ok(!!card && /Point A2/.test(text) && !/Point Z/.test(text) && /3\.11111, 101\.22222/.test(text), "the Points card lists his points and never the test accounts': " + text.slice(0, 80));
      p.type(byAct(card, "points.code"), "d4"); p.type(byAct(card, "points.place"), "3.5, 101.5");
      await p.click(byAct(card, "points.add")); await p.click(byAct(p.d.getElementById("makerPoints"), "points.save"));
      const sent = p.posts.filter((x) => x.route === "/all/maker/points").map((x) => x.body);
      ok(sent.length === 1 && JSON.stringify(sent[0]) === JSON.stringify({ list: [A2, { code: "D4", lat: 3.5, lng: 101.5 }] }),
        "Add then Save sends the whole list, the new code in capitals with its place: " + JSON.stringify(sent));
      /* Ready to collect asks which point on the page's Sheet, a 44px ghost a point, and sends the code beside Ready */
      await p.click(byAct(p.d, "nav.orders"));
      const ack = p.card("ord-a1");
      await p.click(byAct(ack, "order.ready-collect"));
      const sheet = p.d.getElementById("ynSheet"), picks = sheet ? [...sheet.querySelectorAll('[data-act="order.point"]')] : [];
      ok(!!sheet && picks.length === 1 && picks[0].textContent === "Point A2" && picks[0].classList.contains("salt-ghost") && p.d.getElementById("ynGo").hidden,
        "Ready to collect opens the Sheet over his points, one ghost a point and no other action: " + picks.map((b) => b.textContent).join());
      await p.click(picks[0]);
      const mv = p.posts.filter((x) => x.route === "/all/maker/orders/ord-a1/move").map((x) => x.body);
      ok(mv.length === 1 && mv[0].status === "ready" && mv[0].mode === "collect" && mv[0].point === "A2" && /^[0-9a-f]{32}$/.test(mv[0].rid) && !p.d.getElementById("ynSheet"),
        "and a tap on a point sends Ready to collect at it under a request id, the Sheet down: " + JSON.stringify(mv));
    } finally { p.w.close(); }
  }

  /* ---- 10b. their page: a Change point is a line of its own in what happened, never a second Ready ---- */
  {
    const { landingPage } = await import("../stmt/page.js");
    const C = await import("../tools/stmt-crypto.mjs");
    const { JSDOM } = await import("jsdom");
    const u = "abcd-efgh", pass = "fixture-pass-p3", ck = await C.contentKey("test-secret", u);
    const iso = (m) => new Date(Date.now() - m * 60e3).toISOString();
    const prices = { at: new Date().toISOString(), week: { monday: "2026-10-12", label: "12 to 18 Oct 2026" }, soon: [], products: [
      { product: "salt", unit: "unit", basis: "yours", rate: 100, orders: 1, sizes: [{ q: 1, price: 100 }] }] };
    const opened = { ok: true, assoc: false, wrap: await C.wrapKey(pass, ck), session: "sess-p3-abcdefghij",
      env: await C.encryptWith(ck, JSON.stringify({ statements: [] })), prices: await C.encryptWith(ck, JSON.stringify(prices)) };
    const order = { id: "20261018090001-pt01", product: "salt", qty: 1, unit: 100, total: 100, delivery: 0, paid: 0, moved: 0, mode: "collect", status: "ready",
      at: iso(300), point: "Z9", pointAt: { lat: 3.14786, lng: 101.69369 }, msgs: [], history: [{ at: iso(300), status: "placed", by: "customer" },
        { at: iso(280), status: "acknowledged", by: "desk" }, { at: iso(200), status: "ready", by: "desk", point: "Z8" },
        { at: iso(100), status: "ready", by: "desk", point: "Z9", note: "point moved to Z9" }] };
    const answer = (status, j) => ({ ok: status < 300, status, json: async () => j });
    const dom = new JSDOM(landingPage(u, "np3", null), { url: "https://site.test/", runScripts: "dangerously", pretendToBeVisual: true, beforeParse(win) {
      try { Object.defineProperty(win, "crypto", { value: webcrypto, configurable: true }); } catch (e) { win.crypto = webcrypto; }
      win.scrollTo = () => {}; win.HTMLElement.prototype.scrollIntoView = () => {};
      win.fetch = async (path, init) => {
        const p = String(path), m = (init && init.method) || "GET";
        if (p === "/open" || p === "/account") return answer(200, opened);
        if (p === "/orders" && m === "GET") return answer(200, { ok: true, orders: [O.customerView(order)], claims: [] });
        return answer(404, { ok: false });
      };
    } });
    const w = dom.window, d = w.document;
    const until = async (f) => { for (let i = 0; i < 300 && !f(); i++) await new Promise((r) => setTimeout(r, 15)); return !!f(); };
    try {
      d.getElementById("un").value = u; d.getElementById("pw").value = pass;
      d.getElementById("f").dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true }));
      await until(() => d.querySelector('#pOrder [data-row="' + order.id + '"]'));
      d.querySelector('#pOrder [data-row="' + order.id + '"]').click();
      await until(() => d.querySelector('#pOrder .oscreen[data-order="' + order.id + '"]'));
      const scr = d.querySelector('#pOrder .oscreen[data-order="' + order.id + '"]');
      const h = scr ? [...scr.querySelectorAll('[data-part="hist"] li')].map((li) => li.textContent.replace(/\s+/g, " ").trim()) : [];
      ok(h.length >= 4 && /We moved your collection point to Point Z9$/.test(h[h.length - 1]) && !h.some((x) => /point moved to/.test(x)),
        "their page words his Change point as a line of its own, in their words, never the desk's note: " + JSON.stringify(h));
    } finally { w.close(); }
  }

  /* ---- 11. the fixture shows both, as every feature a customer sees must ---- */
  {
    const { FEATURES, build } = await import("../tools/testfix.mjs");
    const f = build(new Date("2026-10-18T06:00:00.000Z"), "open");
    const want = ["ready at a collection point (Counter Batch A)", "collection point changed (Counter Batch A)"];
    const lines = want.map((n) => FEATURES.find(([name]) => name === n));
    ok(lines.every((l) => l && l[1](f)) && FIX_VERSION === 10, "the test accounts carry an order ready at a point and one whose point was changed: " + want.map((n, i) => n + " " + !!(lines[i] && lines[i][1](f))).join(", "));
  }
}
