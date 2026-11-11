import { readFileSync } from "node:fs";
import { openMaster } from "../tools/payload.mjs";

/* 18 Oct 2026 (Part 4 of the pricing basis): every surface he or a customer reads says Floor, Set Price and Ceiling, and his figure
   per customer is "Their %". No tier, level or drift word is visible on the Desk, Salt Admin or the Counter, nor in a refusal or flag
   the phone shows. What stays is the supplier's quote tiers (a lot size a supplier prices), a plain "level with", and the stock count's
   own difference. Identifiers (TIER_OF, tierset, fiveTiers) are code, not words, and are not read here. */
const FORBID = /\bdrift|\btier (?:i{1,3}|[0-9])\b|\b(?:ambassador|titanium|platinum|silver|bronze)\b|\bprice (?:levels?|tiers?)\b|\b(?:customer|pricing|guest|standing|starting) (?:levels?|tiers?)\b|\bstarting tiers?\b|\btiers? (?:entry|input|set|board)\b/i;
const BS = String.fromCharCode(92);
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(new RegExp("(^|[^:\"'`" + BS + BS + "])//[^\\n]*", "g"), "$1");
const QUOTED = new RegExp("'((?:[^'" + BS + BS + "\\n]|" + BS + BS + ".)*)'|\"((?:[^\"" + BS + BS + "\\n]|" + BS + BS + ".)*)\"", "g");
const TICKED = new RegExp("`((?:[^`" + BS + BS + "]|" + BS + BS + "[^])*)`", "g");
const noCode = (x) => { let y = x; for (let i = 0; i < 4; i++) y = y.replace(/[$][{][^{}]*[}]/g, " "); return y; };
const literals = (t) => { const c = stripComments(t); return [...c.matchAll(QUOTED)].map((m) => m[1] ?? m[2]).concat([...c.matchAll(TICKED)].map((m) => noCode(m[1]))).filter((x) => / /.test(x)); };

export async function run({ ok }) {
  /* ---- the Desk, drawn: every part of every book, text nodes only ---- */
  const { w } = await openMaster(process.env.SALT_MASTER || undefined);
  try {
    w.Element.prototype.scrollIntoView = () => { }; w.open = () => null;
    const D = w.document, seen = new Set(), found = [];
    let drawn = 0;
    for (const prod of ["salt", "oil", "candy", "rice"]) {
      w.eval("setProd(" + JSON.stringify(prod) + ");recompute();");
      const views = JSON.parse(w.eval("JSON.stringify(VIEWS.map(function(v){return [v.id,[v.lead].concat(v.parts)];}))"));
      for (const [, parts] of views) for (const part of parts) {
        try { w.eval("switchTab(" + JSON.stringify(part) + ")"); } catch (e) { continue; }
        await new Promise((r) => setTimeout(r, 25));
        const root = D.body.cloneNode(true);
        root.querySelectorAll("script,style,svg").forEach((n) => n.remove());
        const text = root.textContent.replace(/\s+/g, " ");
        drawn++;
        const re = new RegExp(FORBID.source, "gi");
        let m;
        while ((m = re.exec(text))) { const k = text.slice(Math.max(0, m.index - 40), m.index + 50); if (!seen.has(k)) { seen.add(k); found.push(k); } }
      }
    }
    ok(drawn > 48 && found.length === 0, "no part of the Desk, on any book, draws a level name, a tier number or the word drift: " + drawn + " parts read " + JSON.stringify(found.slice(0, 4)));

    /* 11 Nov 2026, his answer "off the Desk": the Their % card left Clients for Salt Admin's account card; Clients says one line for the book in view */
    w.eval("setProd('salt');recompute();");
    const card = String(w.eval("pctLine()")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    ok(/^ ?On salt, \d+ of \d+ hold a % you set and \d+ (is|are) suggested another\. Set it on Salt Admin/.test(card) && !FORBID.test(card),
      "Clients' Their % line counts who holds a % and who is suggested one, points to Salt Admin, and names no level or drift: " + card.slice(0, 200));
    /* cards the parts draw only on a condition are read by their own function */
    const pb = String(w.eval("pbCard()")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    ok(/Median Price lifted by their %, set on Salt Admin/.test(pb) && !FORBID.test(pb) && !/drift/i.test(pb), "and the printed board's card says the Median Price lifted by their %: " + pb.slice(200, 420));
  } finally { w.close(); }

  /* ---- Salt Admin, the Worker's refusals and the drafter's flags: every sentence in the source ---- */
  const { OWNER_JS } = await import("../stmt/owner.js");
  const files = { "stmt/owner.js": OWNER_JS };
  for (const f of ["src/maker-inputs.js", "src/drafter.js", "engine/apply.mjs", "stmt/words.js"]) files[f] = readFileSync(new URL("../" + f, import.meta.url), "utf8");
  const bad = [];
  for (const [f, text] of Object.entries(files)) for (const lit of literals(text)) {
    if (FORBID.test(lit)) bad.push(f + ": " + lit.slice(0, 90));
  }
  ok(bad.length === 0, "no sentence in Salt Admin, the Counter's words, the Worker's refusals, the drafter's flags or the fold's notes names a level or drift: " + JSON.stringify(bad.slice(0, 4)));
  const WD = await import("../stmt/words.js");
  ok(Object.values(WD.EN).every((v) => !FORBID.test(String(v)) && !/\blevels?\b|\btiers?\b/i.test(String(v)))
    && WD.EN["board.none"] === "Prices are being updated. Please check back shortly." && !("board.only" in WD.EN),
    "and the Counter's table holds no level or tier word, says the board is being updated when there is none, and keeps no only-price note");

  /* ---- the guest page between a deploy and the next publish: prices are being updated, and nothing else is drawn ---- */
  const { boardPage } = await import("../stmt/page.js");
  const words = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const empty = [boardPage({ prices: null }, "n"), boardPage({ prices: { week: { label: "x" }, products: [] } }, "n"), boardPage({ prices: undefined }, "n")];
  ok(empty.every((h) => /Prices are being updated/.test(words(h)) && !/<table/.test(h) && !/<h2/.test(h) && !/The price is for the goods/.test(words(h))),
    "a guest page handed no board, or a board with no product, says prices are being updated and draws no list, size or note");
}
