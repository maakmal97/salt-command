/* test/clip-text.mjs: A CLIPPED LINE NEVER ENDS ON HALF A CHARACTER. A customer's line, a delivery place and his reason are cut
   to a length in UTF-16 units; cut between the two halves of an emoji, the line carried a lone surrogate, which every
   encoder (the push payload, the order book's text column, a ledger tool) turns into a replacement mark. Invented words only. */
export async function run({ ok }) {
  const O = await import("../stmt/orders.js");
  const P = await import("../stmt/push.js");
  const W = await import("../stmt/words.js");
  const lone = (s) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
  const smile = String.fromCodePoint(0x1F600);
  const line = (n) => "a".repeat(n - 1) + smile + "tail";

  /* 1. the line a customer types, on an order or the account's thread, and his own */
  const said = O.cleanMsg(line(200), O.MSG_MAX);
  ok(!lone(said) && said === "a".repeat(199), "a customer's line cut at 200 drops the half of an emoji the cut would leave: " + JSON.stringify(said.slice(-3)));
  ok(O.cleanMsg("a".repeat(198) + smile, 200) === "a".repeat(198) + smile, "an emoji that fits whole is kept");
  ok(O.cleanMsg(smile.repeat(150), 200) === smile.repeat(100), "a line of emoji is cut on a whole one, 100 of them in 200 units");

  /* 2. the delivery place and the week, which the order checks by hand */
  const base = { product: "salt", qty: 1, mode: "deliver", total: 100, unit: 100 };
  const placed = O.checkPlacement(Object.assign({}, base, { place: line(60), week: line(40) }), [], "2026-10-06T02:00:00.000Z");
  ok(placed.order && !lone(placed.order.place) && !lone(placed.order.week), "the place and the week of an order are cut on a whole character: " + JSON.stringify(placed.order && [placed.order.place.slice(-2), placed.order.week.slice(-2)]));

  /* 3. his line and his reason as a banner carries them */
  const banner = P.sealedNews({ k: "reply", t: line(200), m: "2026-10-06T02:00:00.000Z" }, "o1");
  ok(banner.t && !lone(banner.t), "a banner's text is cut on a whole character: " + JSON.stringify(banner.t && banner.t.slice(-2)));

  /* 3b. the notice every phone shows is a line of his as well; checked through the worker's own bulletin route */
  const { checkBulletin } = await import("../stmt/worker.js");
  ok(typeof checkBulletin === "function" && !lone(checkBulletin({ lines: [line(120)] }).lines[0]), "a notice line is cut on a whole character");

  /* 4. the helper itself */
  ok(W.clip("abc", 2) === "ab" && W.clip("", 5) === "" && W.clip(smile, 1) === "" && W.clip(smile, 2) === smile, "clip: plain cuts, empty and a lone half");
}
