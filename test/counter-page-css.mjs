/* test/counter-page-css.mjs: THE PAGE'S OWN CSS WEARS THE SYSTEM'S RECIPES AND RESTATES NONE, ON BOTH THEMES (Phase 5 of the Salt Admin redesign, 12 Oct 2026).
 *
 * PAGE_CSS (stmt/page.js) is what the customer's page and Salt Admin add to the recipes SITE_RECIPES carries. Rule 6 is that a recipe is used and never restated: the
 * markup carries the system's class beside the page's own, and what the page's CSS keeps is placement. This module reads the CSS the page is served and the owner page's
 * markup, so a deleted restatement cannot come back, a control cannot go under 44px, a text colour cannot fall under 4.5:1 on either theme's ground, and type cannot go
 * under the system's 11px. Every assertion observes the generated stylesheet or a window, and each was proved red by its own mutation (test/counter-page-css.mutations.json,
 * run with tools/section.mjs). Every code, name and amount here is invented.
 * 15 Nov 2026, THE MOVE TO AMBIENT: the page is served Ambient (its tokens and parts, then the site's layer) and then PAGE_CSS, which shrinks as each
 * place is redrawn; the salt-ds recipes, the faces and the statement's stylesheet are no longer served. The page's own layer is cut after Ambient's;
 * the Aurora is gone for Ambient's mesh, a hero's; and the head of each place is that hero, the Desk bar, the rail and the customer's header gone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { byAct, richOwnerPage, drawEverything } from "./maker-act.mjs";

const REPO = join(import.meta.dirname, "..");
const strip = (c) => c.replace(/\/\*[\s\S]*?\*\//g, "");
const squash = (c) => strip(c).replace(/\s+/g, " ").trim();

/* a stylesheet as [selector, body, media] triples, descending into @media */
function rulesOf(css, media = "") {
  const out = []; let i = 0; css = strip(css);
  while (i < css.length) {
    const open = css.indexOf("{", i); if (open < 0) break;
    const head = css.slice(i, open).trim();
    let d = 1, j = open + 1; while (j < css.length && d) { if (css[j] === "{") d++; else if (css[j] === "}") d--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (/^@(media|supports|container)/.test(head)) out.push(...rulesOf(body, head));
    else if (!head.startsWith("@")) out.push([head, body, media]);
    i = j;
  }
  return out;
}
const decl = (body, prop) => { const m = new RegExp("(?:^|;)\\s*" + prop + "\\s*:\\s*([^;]+)", "i").exec(";" + body); return m ? m[1].trim() : ""; };
const subjects = (sel) => sel.split(",").map((s) => s.trim()).filter(Boolean).map((s) => ({ sel: s, last: (s.split(/\s+|>|\+|~/).filter(Boolean).pop() || "") }));

export async function run({ ok, pageWork }) {
  const { landingPage } = await import("../stmt/page.js");
  const { STATEMENT_CSS, SITE_RECIPES, AMB_CSS } = await import("../stmt/statement-css.js");
  const { SITE_STYLE, AMB_STYLE } = await import("../stmt/page.js");
  const { SITE_CSS } = await import("../stmt/statement-css.js");
  const { RECIPE_HEADS } = await import("../tools/stmt-style.mjs");
  const OWNER_SRC = readFileSync(join(REPO, "stmt", "owner.js"), "utf8"), PAGE_SRC = readFileSync(join(REPO, "stmt", "page.js"), "utf8");
  const ds = strip(readFileSync(join(REPO, "design", "salt-ds.css"), "utf8"));

  /* ---- the page's own layer, cut from the style it is served in: Ambient's tokens and parts, the site's layer, then PAGE_CSS (15 Nov 2026) ---- */
  const allCss = (landingPage("abcd-efgh", "nct", null).match(/<style[^>]*>([\s\S]*?)<\/style>/) || ["", ""])[1];
  /* 16 Nov 2026, the move to Ambient (end pass): PAGE_CSS is empty, so nothing is served after Ambient's tokens and parts and the site's layer, and the page's own layer is the end pass of
     design/site.css (what the older layer left that something still draws), cut from SITE_CSS by its head; every rule of the site's layer is read where a check says the site's layer */
  const END = SITE_CSS.indexOf("/* ---- The end pass"), pageCss = END >= 0 ? SITE_CSS.slice(END) : "", R = rulesOf(pageCss), SITE_ALL = rulesOf(SITE_CSS);
  ok(END > 0 && R.length >= 60 && pageCss.includes(".adm .rnone") && allCss === SITE_STYLE && !allCss.includes(SITE_RECIPES.slice(0, 300)) && !allCss.includes(STATEMENT_CSS.slice(0, 300)),
    `the page's own layer is the end pass of the site's (${R.length} rules), nothing is served after the site's layer, and no salt-ds recipe or statement stylesheet is served before it`);

  /* ---- 1. the three recipes Salt Admin was drawing by hand are carried whole, every rule of them as the system holds it ---- */
  const heads = ["/* ---- Metric row ---- */", "/* ---- Table (synced to the desk", "/* ---- Product tag:"];
  const carried = squash(SITE_RECIPES), wanted = rulesOf(ds).filter(([sel]) => /\.salt-(metrics|table|producttag)\b/.test(sel));
  const missing = wanted.filter(([sel, body, media]) => !carried.includes(squash(media ? "" : sel + " {" + body + "}"))).map((r) => r[0]);
  ok(heads.every((h) => RECIPE_HEADS.includes(h)) && new Set(RECIPE_HEADS).size === RECIPE_HEADS.length && wanted.length >= 18 && missing.length === 0 && !SITE_RECIPES.includes("/*"),
    `Table, Product tag and Metric row are in the recipes the page carries, ${wanted.length} rules whole and in the system's words, with none of its notes (missing: ${missing.join(" ") || "none"})`);
  /* 16 Nov 2026, the move to Ambient (place G): the typed tag is Ambient's chip now, so neither script names the older tag */
  ok(!/salt-producttag/.test(PAGE_SRC.replace(/\/\*[\s\S]*?\*\//g, "")) && !/salt-producttag/.test(OWNER_SRC.replace(/\/\*[\s\S]*?\*\//g, "")),
    "and the Product tag is Ambient's chip: neither script draws the older tag, and a customer's page still shows a mark and never a word");

  /* ---- 1a. Counter Batch A's recipes (salt-ds 1.7.0, 18 Oct 2026): each new head is carried once, every rule of it whole as the system holds it, @media
     ones included, so the batch's markup wears them and the page restates none ---- */
  {
    const key = ([sel, body, media]) => squash(media) + "|" + squash(sel) + "{" + squash(body) + "}", have = new Set(rulesOf(SITE_RECIPES).map(key));
    const batch = ["/* ---- Root ---- */", "/* ---- Brand title ---- */", "/* ---- Status glyph:", "/* ---- Steps, marked:", "/* ---- Notice:", "/* ---- Ledger list, receipt:",
      "/* ---- Band:", "/* ---- Empty state:", "/* ---- Glass card, link:", "/* ---- Pin:", "/* ---- Glance:"];
    const once = batch.filter((h) => RECIPE_HEADS.filter((x) => x === h).length === 1);
    const want = rulesOf(ds).filter(([sel]) => /\.salt-(status__glyph|steps--marks|steps__mark|steps__time|steps__step--next|notice|ledger__sub|ledger__row--due|band|empty|glass-card--link|pin|glance)(?![a-z])/.test(sel));
    const lost = want.filter((r) => !have.has(key(r))).map((r) => (r[2] ? r[2] + " " : "") + r[0]);
    const restated = R.filter(([sel]) => /\.salt-(status__glyph|steps__mark|notice|band|empty|pin|glance)(?![a-z])/.test(sel) && !/^\.[\w-]+ \.salt-/.test(sel)).map((r) => r[0]);
    ok(once.length === batch.length && want.length >= 60 && want.filter((r) => r[2]).length >= 8 && lost.length === 0 && restated.length === 0,
      `Batch A's ${batch.length} heads are carried once each (${once.length}), ${want.length} rules whole (${want.filter((r) => r[2]).length} under @media or @container), the reduced-motion and container ones among them (missing: ${lost.slice(0, 4).join(", ") || "none"}), and the page restates none (${restated.join(" ") || "none"})`);
  }

  /* ---- 1b. THE LIGHT. From 18 Oct 2026 the system's Aurora, as the Desk draws it, was the first thing in both bodies. 15 Nov 2026, the move to
     Ambient: the light is the mood's mesh, each place's hero's, and the Aurora is gone: no Aurora drawn and no light of the page's own ---- */
  {
    const { JSDOM } = await import("jsdom");
    const pages = [["the customer's", landingPage("abcd-efgh", "nct", null)], ["Salt Admin's", landingPage("", "nct", { master: "fixture-master", accounts: [] })]];
    const drawn = pages.map(([w, h]) => { const d = new JSDOM(h).window.document;
      return [w, !d.querySelector(".salt-aurora") && d.body.firstElementChild.matches("svg.amb-sprite") && d.querySelectorAll("header.amb-hero.amb-mesh").length >= 1]; });
    ok(drawn.every(([, y]) => y), "neither page draws an Aurora: the body opens on Ambient's icons, and the light is each hero's mesh: " + drawn.map(([w, y]) => w + " " + (y ? "yes" : "no")).join(", "));
    const layer = rulesOf(pageCss), hand = layer.filter(([, body]) => /radial-gradient/.test(body) && /(^|;)\s*background(-image)?\s*:/.test(body)).map((r) => r[0]);
    ok(hand.filter((x) => /^(html|body)\b/.test(x)).length === 0 && !layer.some(([sel]) => /salt-aurora/.test(sel)) && /\.amb-mesh \{/.test(AMB_CSS),
      `the page lays no Aurora and draws no light of its own on the ground; the mesh is Ambient's (${hand.join(" ") || "none"})`);
  }

  /* ---- 1c. THE TYPE AND THE HEAD OF A PLACE. From 18 Oct 2026 the Desk's type, gutter and shell (the display face, the 22px gutter, the Desk bar over his
     page, the rail's brand). 15 Nov 2026, the move to Ambient: the face is the device's own and the scale Ambient's; each place opens with its hero, its
     name the title; the body is Ambient's; the bar, the rail and the customer's header are gone. What the page's layer still sets is the door's and the
     places' own, until each is redrawn ---- */
  {
    const { JSDOM } = await import("jsdom");
    const own = rulesOf(pageCss), heavy = own.filter(([, b]) => /^(600|700|bold|bolder)$/.test(decl(b, "font-weight"))).map((r) => r[0]);
    ok(heavy.length === 0, `the page's own layer sets no weight over 500 (heavier: ${heavy.slice(0, 6).join(" | ") || "none"})`);
    const h1 = own.filter(([sel]) => sel.split(",").some((x) => /(^|\s)h1\b/.test(x.trim()))).map((r) => r[0]);
    /* 16 Nov 2026, the move to Ambient (place E): the door, the link page, the code screen and the guest pages are Ambient shells with heroes, so the page's layer
       styles no h1 at all and nothing of the hero */
    ok(h1.length === 0 && !own.some(([sel]) => /amb-hero/.test(sel)),
      "a place's heading is Ambient's hero title: the page's layer styles no h1, and nothing of the hero: " + JSON.stringify(h1));
    const body = own.filter(([sel]) => sel === "body" || sel === "html");
    ok(body.length === 0 && !own.some(([sel]) => /\.gate\.adm|\.amain\b/.test(sel)), "the body is Ambient's: the page pads no body and sizes no frame of his");
    ok(!own.some(([sel]) => /\.abar\b|\.salt-deskbar|\.cbar\b|\.chead\b|\.crtitle|\.crbrand|\.salt-rail|\.salt-appbar/.test(sel)), "and none of the old bar, rail or header is styled");
    const od = new JSDOM(landingPage("", "nct", { master: "fixture-master", accounts: [] })).window.document;
    const heroes = [...od.querySelectorAll("#roster > main > [data-in] > header.amb-hero")].map((h) => h.querySelector(".amb-hero__title").textContent);
    ok(JSON.stringify(heroes) === JSON.stringify(["Needs you", "Orders", "Customers", "Record", "Shop"]) && !od.querySelector("#roster .salt-deskbar, #roster .salt-rail")
      && ![...od.querySelectorAll("#roster .amb-hero")].some((e) => /Salt Admin/.test(e.textContent)) && od.querySelectorAll("#roster h1.sr").length === 0,
      "each of his places opens with its hero, the place's name its title, and no bar, rail or brand repeated over each: " + JSON.stringify(heroes));
    const cd = new JSDOM(landingPage("abcd-efgh", "nct", null)).window.document, hero = cd.querySelector("#tabs > main > header.amb-hero");
    ok(!!hero && hero.querySelector("h1.amb-hero__title#placeT") && !/Salt Counter/.test(hero.textContent) && !cd.querySelector(".crtitle, .salt-rail, .chead"),
      "the customer's place is named by its hero's title, which names no app, and no rail carries a name over it");
    ok(cd.querySelectorAll("#tabs [data-whoas]").length === 1 && !!cd.querySelector("#tabs > main > header.amb-hero > .amb-hero__sub[data-wholine] [data-whoas]") && !cd.querySelector("[data-whorail]"),
      "whose account it is stands once, the line under the place's title, at every width");
    ok(!own.some(([s]) => /\.oplace|\.olistcol|\.oscreen/.test(s)) && landingPage("abcd-efgh", "nct", null).includes('id="oPanes" class="amb-split amb-split--panes"'),
      "and Orders is the system's split of panes, the page writing no rule for the list or the open order (16 Nov 2026, the move to Ambient: the second pane holds New order while none is open)");
  }

  /* ---- 2. what PAGE_CSS keeps is placement: no rule under .adm sets a recipe's material, nor one of the page's classes that wear a recipe ---- */
  const MATERIAL = /(^|;)\s*(background(-color|-image)?|border(-[a-z]+)*|border-radius|box-shadow|font-family|font-size|font-weight|letter-spacing|text-transform|color)\s*:/;
  const WEARS = /(^|\.)(lbl|pane|acard|glink|ghead|gt|mos|maker-hours|grow|look-tile)(\.|:|$|\[)/;
  const restated = [];
  for (const [sel, body] of R) for (const s of subjects(sel)) {
    const last = s.last.replace(/::?[\w-]+(\([^)]*\))?/g, "");
    const recipe = /\.salt-[\w-]+/.test(last), wears = WEARS.test(last);
    if (((recipe && /^\.adm\b/.test(s.sel)) || wears) && MATERIAL.test(";" + body) && !(wears && /\.look-/.test(last))) restated.push(s.sel + " {" + body.trim().slice(0, 60) + "}");
  }
  ok(restated.length === 0, `no rule of the page's restates a recipe it wears: a label, pane, report card, guest link, month strip, hours grid or ghost keeps placement only (restated: ${restated.join(" | ") || "none"})`);
  const gone = [".mos button", ".grow button", ".acell b", ".acell .l", ".ynsheet .salt-ghost--danger", ".maker-hours th.lbl", "--look-"].filter((g) => pageCss.includes(g));
  ok(gone.length === 0 && !pageCss.split("}").some((r) => /(^|[\s,])\.salt-ghost--danger\s*[{,]/.test(r)),
    `and the rules deleted in Phase 5 have not come back, nor has the danger tone been stated again beside the system's (back: ${gone.join(" ") || "none"})`);

  /* ---- the generated stylesheet's two themes ---- */
  /* ---- 3. text colour (16 Nov 2026, the move to Ambient): every colour the page's layer sets as text is one of Ambient's tokens, whose 4.5:1 on its grounds is Ambient's own check; no literal and no salt- token ---- */
  const colours = SITE_ALL.map(([, body]) => decl(body, "color")).filter(Boolean), used = new Set(colours.map((v) => (/^var\(--amb-([\w-]+)\)$/.exec(v) || [])[1]).filter(Boolean));
  const stray = colours.filter((v) => !/^(var\(--amb-[\w-]+\)|inherit|currentColor)$/.test(v));
  ok(["ink", "ink-2", "neg", "pos", "accent"].every((k) => used.has(k)) && R.some(([, b]) => /^var\(--amb-ink-2\)$/.test(decl(b, "color"))), `the colours the site's layer sets as text are read off it (${used.size}: ${[...used].sort().join(" ")})`);
  ok(stray.length === 0 && !/--salt-/.test(pageCss) && !/salt-/.test(R.map((r) => r[0]).join(" ")),
    `and each is an Ambient token, never a literal or a salt- token, so each holds the contrast Ambient's tokens hold on both themes (stray: ${stray.join(", ") || "none"})`);
  /* the danger tone is Ambient's alarm: stated once by the system, and the page restates none */
  ok(!/\.salt-ghost/.test(allCss) && /\.amb-action--danger \{ color: var\(--amb-neg\); \}/.test(AMB_CSS) && !R.some(([sel]) => /danger/.test(sel)),
    "a move that refuses rests in Ambient's alarm, from the system's own rule, and the page's layer states no danger tone of its own");

  /* ---- 4. the type floor (16 Nov 2026, the move to Ambient): nothing the site's layer sets is under Ambient's 12px floor ---- */
  const AMBTOK = Object.fromEntries([...AMB_STYLE.matchAll(/--amb-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const px = (v) => { const t = /^var\(--amb-([\w-]+)\)$/.exec(v); if (t) v = AMBTOK[t[1]] || ""; if (/^max\(/.test(v)) return 16; const m = /^([\d.]+)(px|rem)$/.exec(v); return m ? parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1) : null; };
  const sizes = SITE_ALL.map(([sel, body]) => [sel, decl(body, "font-size")]).filter(([, v]) => v && !/^(inherit|[\d.]+(em|%))$/.test(v));
  const small = sizes.filter(([, v]) => !(px(v) >= 12));
  ok(sizes.length > 25 && small.length === 0, `no font size the site's layer sets is under 12px (${sizes.length} read; under: ${small.map((s) => s[0].slice(0, 40) + " " + s[1]).join(" | ") || "none"})`);

  /* ---- 5. the taps: a control the page sizes is 44px both ways, and a native box smaller than that sits in a label that is ---- */
  const CONTROL = /^(button|input|select|textarea|a)(\.|:|\[|$)|\[type=|\.amb-(pill|circle|action|input|switch|segment__opt|tab)\b|\.(btn|fld|szrow)\b/;
  const under = [];
  for (const [sel, body] of SITE_ALL) for (const s of subjects(sel)) {
    if (!CONTROL.test(s.last.replace(/::?[\w-]+(\([^)]*\))?/g, ""))) continue;
    for (const p of ["min-height", "min-width", "height", "width"]) { const v = decl(body, p); if (!v) continue; const n = px(v); if (n !== null && n < 44) under.push(s.sel + " " + p + " " + v); }
  }
  /* 16 Nov 2026, the move to Ambient (place D): the native boxes that stood in a label (Keep me signed in, the pay radios) are the system's Switch and Options now, so the page sizes no control under 44px */
  ok(under.length === 0,
    `no control the page sizes is under 44px either way (${under.length} under: ${under.join(" | ") || "none"})`);
  /* 16 Nov 2026, the move to Ambient (end pass): the month filter is Ambient's select and every strip of parts its Segment, so the page sets no tab pill of its own and the kind tabs (.nktab) are gone; the 44px is Ambient's token, which its tab, segment option and small pill all carry */
  const AMBR = rulesOf(AMB_CSS), tap44 = (sel) => AMBR.some(([s, b]) => s.split(",").map((x) => x.trim()).includes(sel) && /min-height:\s*var\(--amb-tap\)/.test(b));
  ok(!SITE_ALL.some(([sel]) => /salt-tabs|nktab/.test(sel)) && AMBTOK.tap === "44px" && [".amb-pill--sm", ".amb-segment__opt", ".amb-tab"].every(tap44),
    "and no tab strip's pill is sized by the page: the strips are Ambient's Segment and select, whose options, tabs and small pills carry the 44px token, which is 44px");
  ok(!/\.nktab|salt-nav/.test(OWNER_SRC.replace(/\/\*[\s\S]*?\*\//g, "") + PAGE_SRC.replace(/\/\*[\s\S]*?\*\//g, "")), "and Needs you's kind tabs are not drawn: nothing names the older tab (nktab) or its Nav bar");

  /* ---- 6. the markup wears the recipes: Salt Admin, drawn on its busiest day, and read for every label, every guest link, the report card, the hours and a book named on a row ---- */
  const labelsBad = (d) => [...d.querySelectorAll(".lbl, label.amb-field > span:not([class])")].map((n) => n.tagName + " " + n.textContent.slice(0, 24));
  const row = { id: "AX1-ZED", bought: 100, soldFor: 50, introduced: 20, onward: 1, referred: 2, share: 12, rank: 1, stars: 2, founder: true, reward: { earned: 2, taken: 1, left: 1, next: 0.4 } };
  const p = await richOwnerPage({ pageWork, assocAnswer: (j) => ({ ...j, products: [{ product: "salt", name: "salt", rows: [row] }] }) });
  try {
    const { d, work, click } = p;
    await work.quiet();
    let bad = [], seen = 0, sels = 0, selBad = [];
    const audit = () => { seen += d.querySelectorAll(".lbl, .amb-field__label").length; bad.push(...labelsBad(d));
      for (const x of d.querySelectorAll("select")) { sels++; if (!x.classList.contains("salt-field__select") && !x.classList.contains("amb-input")) selBad.push(x.getAttribute("data-act") || x.className); } };
    await click(byAct(d, "nav.record")); await click(byAct(d, "part.record.entry"));
    const forms = [...d.querySelectorAll('[data-act="record.form"]')].length;
    for (let i = 0; i < forms; i++) {
      const back = d.getElementById("makerFormBack"); if (back && !back.hidden) back.click();
      const r = [...d.querySelectorAll('[data-act="record.form"]')][i]; if (r) { await click(r); audit(); }
    }
    ok(forms >= 10 && seen >= 25 && bad.length === 0, `every label on Record's ${forms} forms is the system's Field label, and every legend its label modifier (${seen} read; bare: ${bad.slice(0, 3).join(" | ") || "none"})`);
    /* 18 Oct 2026: a select is the system's, so its open list is the Desk's slate under salt ink (.salt-field__select option) and never the well this page once set */
    ok(sels >= 10 && selBad.length === 0 && !SITE_ALL.some(([sel]) => /(^|[\s>+~,])option\b/.test(sel)),
      `every select on Record's forms wears Ambient's input, whose open list is the device's own, and the page sets no list colour of its own (${sels} read; bare: ${selBad.slice(0, 3).join(" ") || "none"})`);

    /* a book on a row wears the Product tag, the book's mark in it and no word for the book (his word of 12 Oct 2026), its hue the book's own accent token, and no style attribute (the Counter's policy refuses one) */
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.approve"));
    const bare = (x) => { const g = x.cloneNode(true); g.querySelectorAll(".amb-chip").forEach((t) => t.replaceWith("[tag]")); return g.textContent.trim(); };
    const line = [...d.querySelectorAll("#makerDrafts .apline")].find((x) => x.querySelector(".amb-chip.amb-kind-2"));
    const tag = line && line.querySelector(".amb-chip");
    /* 16 Nov 2026 (place G): on Orders a book is its chip, its name in ink and its hue on the dot, and no mark */
    ok(!!tag && /amb-kind-[1-6]/.test(tag.className) && !tag.querySelector("svg.psym") && tag.textContent.trim() === "Oil"
      && /^1 unit \[tag\], RM 100\.00$/.test(bare(line))
      && !!tag.querySelector(".amb-chip__dot") && !tag.hasAttribute("style") && !tag.querySelector("[style]"),
    "a book on a row to approve wears the book's chip with its dot, its name in ink and no mark: " + (line ? line.textContent : "no line"));
    const figs = d.querySelector("#makerDrafts article.amb-task .apfigs");
    ok(!!figs && [...figs.children].every((c) => c.querySelector(".amb-stat__label") && c.querySelector(".amb-stat__value")) && figs.children.length === 2,
      "and the cost and margin under it are Ambient's stats, a label over its figure");
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.group"));
    const pool = [...d.querySelectorAll("#makerPools .amb-task")].find((x) => x.querySelector(".amb-task__head .amb-kind-1"));
    ok(!!pool && pool.querySelector(".amb-task__head .amb-chip.amb-kind-1").textContent.trim() === "Salt" && /^1 unit each$/.test(pool.querySelector(".amb-task__title").textContent) && /3 of 10 units/.test(pool.textContent) && /Joined1/.test(pool.textContent.replace(/\s+/g, "")),
      "a group order is a task headed by its book's chip, and no word for it beside the chip: " + (pool ? pool.textContent.slice(0, 80) : "no row"));

    /* the hours are the week chart (20 Oct 2026, canvas V63), a button a day; the table is gone */
    await click(byAct(d, "nav.shop")); await click(byAct(d, "part.shop.hours")); audit();
    const week = d.querySelector("#makerSchedule ol.amb-week");   /* 16 Nov 2026, the move to Ambient (place I): Ambient's week of spans */
    ok(!!week && !d.querySelector("table.maker-hours") && week.querySelectorAll("button.amb-week__day").length === 7,
      "the weekly hours are the week of spans, a button a day, and the table is gone");

    /* the guest links and the report card, on Customers */
    await click(byAct(d, "nav.customers")); await click(byAct(d, "part.customers.links")); audit();
    /* 16 Nov 2026, the move to Ambient (place H): a link is Ambient's row, its panel (the .glpanel) the next item of the list, holding the code in the system's frame and its moves as action rows, Withdraw and Decline in ember */
    const links = [...d.querySelectorAll("#glist .glpanel")];
    const moves = links.flatMap((l) => [...l.querySelectorAll(".amb-settings button.amb-action")]);
    ok(links.length >= 2 && links.every((l) => !!l.querySelector("p.gwho") && !!l.querySelector("figure.amb-codeframe"))
      && ["link.copy", "link.withdraw", "link.restore", "link.approve", "link.decline"].every((a) => moves.some((b) => b.getAttribute("data-act") === a))
      && moves.filter((b) => /^link\.(withdraw|decline)$/.test(b.getAttribute("data-act"))).every((b) => b.classList.contains("amb-action--danger"))
      && moves.filter((b) => /^link\.(copy|restore|approve)$/.test(b.getAttribute("data-act"))).every((b) => !b.classList.contains("amb-action--danger")),
    `a guest link's panel is the system's code frame over a settings group, its moves action rows, Withdraw and Decline in ember (${links.length} links, ${moves.length} moves)`);
    const heads = [...d.querySelectorAll("#glist .ghead")], picks = [...d.querySelectorAll(".glpanel select")];
    ok(heads.length >= 1 && heads.every((h) => h.tagName === "H2" && h.classList.contains("amb-section")) && picks.length === 0 && ["gintro", "glabel"].every((id) => !!d.getElementById(id) && d.getElementById(id).classList.contains("amb-input") && !!d.getElementById(id).closest("label.amb-field")),
      `the heads over the links are the system's section head (${heads.length}), its two fields are Ambient's, and no level picker is drawn (${picks.length})`);
    await click(byAct(d, "part.customers.associates"));
    const trow = d.querySelector("#clist table.amb-table tbody tr"), tcells = trow ? [...trow.children] : [];
    ok(!!trow && d.querySelector("#clist table.amb-table").classList.contains("amb-table--stack") && JSON.stringify(tcells.slice(2, 5).map((c) => [c.getAttribute("data-label"), c.textContent])) === JSON.stringify([["Bought", "RM 100.00"], ["Sold", "RM 50.00"], ["Introduced", "RM 20.00"]]),
    "the report card is the system's stacking table, its three figures cells labelled for the stack");
    /* 16 Nov 2026 (place H): the thread's box is Ambient's compose, no longer a labelled field, so four are read, not five */
    /* 27 Oct 2026 (Record's forms as settings rows): Record's forms now name a field with the settings row's label, so the Field label class is read where a field keeps its label above it, the cards and sheets drawn on their busiest day */
    const every = await richOwnerPage({ pageWork, slip: true, probe: true });
    try {
      await drawEverything(every);
      const above = [...every.d.querySelectorAll("label.amb-field > .amb-field__label")];
      ok(above.length >= 4 && labelsBad(every.d).length === 0,
        `every field that keeps its label above it wears the system's Field label (${above.length} read; bare: ${labelsBad(every.d).slice(0, 3).join(" | ") || "none"})`);
    } finally { every.w.close(); }
  } finally { p.w.close(); }
}
