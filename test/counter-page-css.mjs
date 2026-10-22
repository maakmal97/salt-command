/* test/counter-page-css.mjs: THE PAGE'S OWN CSS WEARS THE SYSTEM'S RECIPES AND RESTATES NONE, ON BOTH THEMES (Phase 5 of the Salt Admin redesign, 12 Oct 2026).
 *
 * PAGE_CSS (stmt/page.js) is what the customer's page and Salt Admin add to the recipes SITE_RECIPES carries. Rule 6 is that a recipe is used and never restated: the
 * markup carries the system's class beside the page's own, and what the page's CSS keeps is placement. This module reads the CSS the page is served and the owner page's
 * markup, so a deleted restatement cannot come back, a control cannot go under 44px, a text colour cannot fall under 4.5:1 on either theme's ground, and type cannot go
 * under the system's 11px. Every assertion observes the generated stylesheet or a window, and each was proved red by its own mutation (test/counter-page-css.mutations.json,
 * run with tools/section.mjs). Every code, name and amount here is invented.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { byAct, richOwnerPage } from "./maker-act.mjs";

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
  const { STATEMENT_CSS, SITE_RECIPES } = await import("../stmt/statement-css.js");
  const { RECIPE_HEADS } = await import("../tools/stmt-style.mjs");
  const OWNER_SRC = readFileSync(join(REPO, "stmt", "owner.js"), "utf8"), PAGE_SRC = readFileSync(join(REPO, "stmt", "page.js"), "utf8");
  const ds = strip(readFileSync(join(REPO, "design", "salt-ds.css"), "utf8"));

  /* ---- the page's own layer, cut from the style it is served in: the faces, the statement's stylesheet, the recipes, then PAGE_CSS ---- */
  const allCss = (landingPage("abcd-efgh", "nct", null).match(/<style[^>]*>([\s\S]*?)<\/style>/) || ["", ""])[1];
  const cutAt = allCss.indexOf(SITE_RECIPES), pageCss = cutAt >= 0 ? allCss.slice(cutAt + SITE_RECIPES.length) : "";
  const R = rulesOf(pageCss);
  ok(cutAt > 0 && R.length > 300 && pageCss.includes(".look-tile"), `the page's own layer is read off the style it is served in (${R.length} rules after the recipes)`);

  /* ---- 1. the three recipes Salt Admin was drawing by hand are carried whole, every rule of them as the system holds it ---- */
  const heads = ["/* ---- Metric row ---- */", "/* ---- Table (synced to the desk", "/* ---- Product tag:"];
  const carried = squash(SITE_RECIPES), wanted = rulesOf(ds).filter(([sel]) => /\.salt-(metrics|table|producttag)\b/.test(sel));
  const missing = wanted.filter(([sel, body, media]) => !carried.includes(squash(media ? "" : sel + " {" + body + "}"))).map((r) => r[0]);
  ok(heads.every((h) => RECIPE_HEADS.includes(h)) && new Set(RECIPE_HEADS).size === RECIPE_HEADS.length && wanted.length >= 18 && missing.length === 0 && !SITE_RECIPES.includes("/*"),
    `Table, Product tag and Metric row are in the recipes the page carries, ${wanted.length} rules whole and in the system's words, with none of its notes (missing: ${missing.join(" ") || "none"})`);
  ok(!/salt-producttag/.test(PAGE_SRC.replace(/\/\*[\s\S]*?\*\//g, "")) && /salt-producttag/.test(OWNER_SRC),
    "and the Product tag is drawn by Salt Admin's script alone: nothing a customer's page draws names it, so a book is still a mark there and never a word");

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

  /* ---- 1b. the light is the system's Aurora, as the Desk draws it (18 Oct 2026): carried whole, the first thing in both bodies, laid under the content, and no light of the
     page's own. The ground was two radial gradients at a fraction of the orbs' strength, so the glass rail read flat black on the Counter and warm on the Desk ---- */
  {
    const { JSDOM } = await import("jsdom");
    const key = ([sel, body, media]) => squash(media) + "|" + squash(sel) + "{" + squash(body) + "}", have = new Set(rulesOf(SITE_RECIPES).map(key));
    const aur = rulesOf(ds).filter(([sel]) => /\.salt-aurora/.test(sel)), lost = aur.filter((r) => !have.has(key(r))).map((r) => (r[2] ? r[2] + " " : "") + r[0]);
    ok(aur.length >= 16 && aur.filter((r) => r[2]).length === 2 && lost.length === 0,
      `the Aurora is in the recipes the page carries, ${aur.length} rules whole, Tide's blobs and the system's own no-Aurora under reduced transparency and in print among them (missing: ${lost.join(", ") || "none"})`);
    const pages = [["the customer's", landingPage("abcd-efgh", "nct", null)], ["Salt Admin's", landingPage("", "nct", { master: "fixture-master", accounts: [] })]];
    const drawn = pages.map(([w, h]) => { const a = new JSDOM(h).window.document.body.firstElementChild;
      return [w, !!a && a.matches(".salt-aurora.salt-aurora--page.salt-aurora--fixed[aria-hidden=true]") && a.querySelectorAll(":scope > .salt-aurora__blob--copper, :scope > .salt-aurora__blob--brass").length === 2]; });
    ok(drawn.every(([, y]) => y), "both pages draw the page Aurora, fixed and hidden from a reader, as the first thing in the body with its copper and brass blobs: " + drawn.map(([w, y]) => w + " " + (y ? "yes" : "no")).join(", "));
    const layer = rulesOf(STATEMENT_CSS + pageCss), under = layer.filter(([sel, body, media]) => !media && sel === "body>.salt-aurora" && decl(body, "z-index") === "-1");
    const hand = layer.filter(([, body]) => /radial-gradient/.test(body) && /(^|;)\s*background(-image)?\s*:/.test(body)).map((r) => r[0]);
    ok(under.length === 1 && hand.filter((s) => /^(html|body)\b/.test(s)).length === 0,
      `the page lays the Aurora under its content by a selector that outweighs the recipe's own z-index (${under.length}), and draws no light of its own on the ground (${hand.join(" ") || "none"})`);
  }

  /* ---- 1c. the Desk's type, gutter and shell, from salt-ds (18 Oct 2026, his word that the Desk's aesthetic is the one): no weight over the system's 500 in
     the page's own layers (the system keeps 700 for its one filled pill), a heading at the display face's 300 and the Desk's 28px, the page 22px from the top,
     and Salt Admin headed by the system's Desk bar, which carries its name and the clock the rail and every place once carried ---- */
  {
    const { JSDOM } = await import("jsdom");
    const own = rulesOf(STATEMENT_CSS + pageCss), heavy = own.filter(([, b]) => /^(600|700|bold|bolder)$/.test(decl(b, "font-weight"))).map((r) => r[0]);
    ok(heavy.length === 0, `the page's own layers set no weight over the system's 500 (heavier: ${heavy.slice(0, 6).join(" | ") || "none"})`);
    const h1 = own.filter(([sel, , m]) => !m && sel.split(",").includes("h1")), gateH1 = own.filter(([sel, , m]) => !m && /^\.(gate|chead) h1$/.test(sel));
    ok(h1.length === 1 && decl(h1[0][1], "font-weight") === "300" && decl(h1[0][1], "letter-spacing") === ".04em" && gateH1.length === 2 && gateH1.every(([, b]) => decl(b, "font-size") === "1.75rem"),
      "a heading is the display face at 300 with the Desk's tracking, at the Desk's 28px on the door, Salt Admin and the customer's places");
    const body = own.filter(([sel, , m]) => !m && sel === "body");
    ok(body.length === 1 && /^22px\b/.test(decl(body[0][1], "padding")) && own.some(([sel, b, m]) => /min-width:\s*1080px/.test(m) && sel === ".gate.adm" && decl(b, "margin-top") === "0" && decl(b, "gap") === "20px"),
      "the page starts 22px from the top, and from 1080px Salt Admin's rail and column stand 20px apart with no margin above, as the Desk's do");
    /* 20 Oct 2026 (canvas V32): from 1080px the bar heads the shell, spanning the rail's column and the content's */
    ok(own.some(([sel, b, m]) => /min-width:\s*1080px/.test(m) && sel === ".adm .abar" && decl(b, "grid-column") === "1/-1"), "from 1080px Salt Admin's bar spans the rail and the column under it");
    const heads = RECIPE_HEADS.filter((h) => h.startsWith("/* ---- Desk bar"));
    const od = new JSDOM(landingPage("", "nct", { master: "fixture-master", accounts: [] })).window.document, bar = od.querySelector("#roster > .salt-deskbar:first-child");
    ok(heads.length === 1 && SITE_RECIPES.includes(".salt-deskbar__name {") && !!bar && bar.querySelector(".salt-deskbar__brand .salt-deskbar__name").textContent === "Salt Admin"
      && bar.querySelectorAll(".salt-deskbar__meta [data-clock]").length === 1 && od.querySelectorAll("#roster [data-clock]").length === 1 && !od.querySelector("#roster .salt-rail__brand")
      && ![...od.querySelectorAll("#roster .salt-eyebrow")].some((e) => /Salt Admin/.test(e.textContent)),
      "Salt Admin is headed by the system's Desk bar, carried whole: its name, the one clock under it, and no brand in the rail nor a name repeated over each place");
    /* the customer's page (Counter Batch A, his decisions of 18 Oct 2026): from 1080px the app's name stands over the rail as the one brand, and the
       rail's brand slot says whose account it is, which the header then leaves to it; the Desk bar of 18 Oct went, and came back as the header on 21 Oct; a section head at the system's
       500, not the browser's bold; and Orders' list the whole width while no order stands open beside it */
    const cd = new JSDOM(landingPage("abcd-efgh", "nct", null)).window.document, rail = cd.querySelector(".cshell .salt-rail");
    const wide = (sel, prop, v) => own.some(([s, b, m]) => /min-width:\s*1080px/.test(m) && s === sel && decl(b, prop) === v);
    const title = rail && rail.querySelector(".crtitle"), brand = rail && rail.querySelector(".salt-rail__brand");
    /* 21 Oct 2026, his word: the header is the bar again, the place and what waits on them, and still no name on it */
    const cbar = cd.querySelectorAll(".cshell .salt-deskbar");
    ok(cbar.length === 1 && cbar[0].tagName === "HEADER" && cbar[0].classList.contains("chead") && !cbar[0].querySelector(".salt-deskbar__name") && !/Salt Counter/.test(cbar[0].textContent)
      && !!title && title.classList.contains("salt-title") && title.textContent === "Salt Counter" && rail.firstElementChild === title && wide(".chead .cclock", "display", "none"),
      "the customer's header is the one Desk bar and names no app: from 1080px the app's name, Salt Counter, stands over the rail in the system's title, the header's clock left to the phone");
    ok(!!brand && /^Signed in as$/.test((brand.querySelector(".salt-eyebrow") || {}).textContent || "") && brand.querySelectorAll("[data-whorail]").length === 1 && brand.hasAttribute("data-wholine")
      && !rail.querySelector(".salt-rail__foot") && cd.querySelectorAll(".chead [data-whoas]").length === 1 && wide(".chead [data-whoas]", "display", "none"),
      "the rail's brand slot says Signed in as over the username, and from 1080px the header leaves it to the rail, so it stands once at each width");
    ok(own.some(([s, b, m]) => !m && s === "h2,h3,h4" && decl(b, "font-weight") === "500")
      && own.some(([s, b, m]) => /min-width:\s*860px/.test(m) && s === ".oplace.oplace--one" && decl(b, "grid-template-columns") === "minmax(0,1fr)"),
      "a section head is at the system's 500, and from 860px Orders' list takes the width while no order stands open beside it");
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
  const toks = (css, re) => Object.fromEntries([...((strip(css).match(re) || ["", ""])[1]).matchAll(/--salt-([\w-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]));
  const NIGHT = toks(STATEMENT_CSS, /:root\s*\{([^}]*)\}/), TIDE = { ...NIGHT, ...toks(STATEMENT_CSS, /:root\[data-theme="tide"\]\s*\{([^}]*)\}/) };
  const lum = (hx) => { const c = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const HEX = /^#[0-9a-f]{6}$/i, hex2 = (n) => Math.round(n).toString(16).padStart(2, "0");
  const resolve = (T, k) => { let v = T[k]; for (let i = 0; i < 6 && /^var\(--salt-([\w-]+)\)$/.test(v || ""); i++) v = T[/^var\(--salt-([\w-]+)\)$/.exec(v)[1]]; return v; };
  /* the glass of a card over the slate is the lightest ground a text colour sits on (white at 3 or 4.5 per cent) */
  const glassOver = (T) => { const m = /rgba\(\s*255,\s*255,\s*255,\s*([\d.]+)\)/.exec(T.glass || ""), g = resolve(T, "slate"); if (!m || !HEX.test(g || "")) return null;
    const a = +m[1], ch = [1, 3, 5].map((i) => parseInt(g.slice(i, i + 2), 16) * (1 - a) + 255 * a); return "#" + ch.map(hex2).join(""); };

  /* ---- 3. text contrast, PAGE_CSS alone: every colour it sets as text, on each theme's ground, slate and glass ---- */
  const used = new Set();
  for (const [, body] of R) {
    const c = /^var\(--salt-([\w-]+)\)$/.exec(decl(body, "color")); if (c) used.add(c[1]);
    for (const tone of ["status-tone", "ghost-tone", "sev"]) { const t = /^var\(--salt-([\w-]+)\)$/.exec(decl(body, "--salt-" + tone)); if (t) used.add(t[1]); }
  }
  used.delete("ink-on-accent"); used.delete("slate");
  const lowest = (T) => {
    const grounds = [T.obsidian, T.slate, glassOver(T)].filter(Boolean);
    const rows = [...used].map((k) => { const h = resolve(T, k); return [k, HEX.test(h || "") ? Math.min(...grounds.map((g) => ratio(h, g))) : 0]; });
    return { weak: rows.filter((r) => r[1] < 4.5).map((r) => r[0] + " " + (r[1] ? r[1].toFixed(2) : "unresolved")), low: rows.sort((a, b) => a[1] - b[1])[0], n: grounds.length };
  };
  const ln = lowest(NIGHT), lt = lowest(TIDE);
  ok(used.size >= 6 && ["brass", "ember", "verdigris", "text-muted"].every((k) => used.has(k)) && ln.n === 3, `the colours PAGE_CSS sets as text are read off it (${used.size}: ${[...used].sort().join(" ")})`);
  ok(ln.weak.length === 0 && lt.weak.length === 0,
    `and each holds 4.5:1 on obsidian, slate and a card's glass over it, on Night (lowest ${ln.low[0]} ${ln.low[1].toFixed(2)}) and on Tide (lowest ${lt.low[0]} ${lt.low[1].toFixed(2)}); short: ${ln.weak.concat(lt.weak).join(", ") || "none"}`);
  /* the danger ghost's tone is the system's alarm: stated once in the recipes, and the alarm holds the same measure on both themes */
  const danger = rulesOf(SITE_RECIPES).filter(([sel]) => sel === ".salt-ghost--danger");
  const alarm = [NIGHT, TIDE].map((T) => Math.min(...[T.obsidian, T.slate, glassOver(T)].map((g) => ratio(resolve(T, "alarm"), g))));
  ok(danger.length === 1 && /--salt-ghost-tone:\s*var\(--salt-alarm\)/.test(danger[0][1]) && alarm.every((r) => r >= 4.5),
    `a ghost that refuses rests in the alarm, from the system's own recipe, which holds 4.5:1 on both themes (Night ${alarm[0].toFixed(2)}, Tide ${alarm[1].toFixed(2)})`);

  /* ---- 4. the type floor: nothing the page or its statement layer sets is under the system's 11px ---- */
  const px = (v, T) => { const t = /^var\(--salt-([\w-]+)\)$/.exec(v); if (t) v = resolve(T, t[1]) || ""; const m = /^([\d.]+)(px|rem)$/.exec(v); return m ? parseFloat(m[1]) * (m[2] === "rem" ? 16 : 1) : null; };
  const sizes = [...R, ...rulesOf(STATEMENT_CSS)].map(([sel, body]) => [sel, decl(body, "font-size")]).filter(([, v]) => v && !/^(inherit|[\d.]+(em|%))$/.test(v));
  const small = sizes.filter(([, v]) => !(px(v, NIGHT) >= 11));
  ok(sizes.length > 40 && small.length === 0, `no font size is under 11px (${sizes.length} read; under: ${small.map((s) => s[0].slice(0, 40) + " " + s[1]).join(" | ") || "none"})`);

  /* ---- 5. the taps: a control the page sizes is 44px both ways, and a native box smaller than that sits in a label that is ---- */
  const CONTROL = /^(button|input|select|textarea|a)(\.|:|\[|$)|\[type=|\.salt-(ghost|pill|tabs__pill|orb|field__input|option__face)\b|\.(btn|fld|szrow)\b/;
  const under = [];
  for (const [sel, body] of R) for (const s of subjects(sel)) {
    if (!CONTROL.test(s.last.replace(/::?[\w-]+(\([^)]*\))?/g, ""))) continue;
    for (const p of ["min-height", "min-width", "height", "width"]) { const v = decl(body, p); if (!v) continue; const n = px(v, NIGHT); if (n !== null && n < 44) under.push(s.sel + " " + p + " " + v); }
  }
  const LABELLED = [".rem input", ".pay input[type=radio]", ".spsave input"], tapped = (sel) => R.some(([s, b]) => s.split(",").map((x) => x.trim()).includes(sel) && /min-height:\s*var\(--salt-tap\)/.test(b));
  ok(under.every((u) => LABELLED.some((l) => u.startsWith(l + " "))) && tapped(".rem") && tapped(".pay label") && tapped(".spsave"),
    `no control the page sizes is under 44px either way, bar the three native boxes whose label is the tap (Save on this phone, Counter Batch C) (${under.length} under: ${under.join(" | ") || "none"})`);
  /* 22 Oct 2026 (canvas Needs you): Needs you's kinds are tabs of the Nav bar, 48px tall and a third or a sixth of the row wide, no longer pills */
  const strips = [".mos .salt-tabs__pill", ".mfil .salt-tabs__pill", ".adm .aparts .salt-tabs__pill"];
  ok(strips.every((s) => R.some(([sel, b]) => sel === s && /min-height:\s*var\(--salt-tap\)/.test(b) && /min-width:\s*var\(--salt-tap\)/.test(b))) && /--salt-tap:\s*44px/.test(ds)
    && R.some(([sel, b]) => sel === ".adm .nktab" && /min-height:\s*48px/.test(b)),
    "and every tab strip the page draws sets its pills to the system's 44px token both ways, which is 44px, and Needs you's kind tabs are 48px tall");
  const recipeTap = [".salt-ghost", ".salt-pill", ".salt-field__input"].filter((c) => !rulesOf(SITE_RECIPES).some(([sel, b]) => sel.split(",").map((x) => x.trim()).includes(c) && /min-height:\s*var\(--salt-tap\)/.test(b)));
  ok(recipeTap.length === 0, `the ghost, the pill and the field carry the 44px in the recipes themselves (without: ${recipeTap.join(" ") || "none"})`);

  /* ---- 6. the markup wears the recipes: Salt Admin, drawn on its busiest day, and read for every label, every guest link, the report card, the hours and a book named on a row ---- */
  const labelsBad = (d) => [...d.querySelectorAll(".lbl")].filter((n) => !(n.tagName === "LEGEND" ? n.classList.contains("salt-options__legend--label") && n.classList.contains("salt-options__legend") : n.classList.contains("salt-field__label"))).map((n) => n.tagName + " " + n.textContent.slice(0, 24));
  const row = { id: "AX1-ZED", bought: 100, soldFor: 50, introduced: 20, onward: 1, referred: 2, share: 12, rank: 1, stars: 2, founder: true, reward: { earned: 2, taken: 1, left: 1, next: 0.4 } };
  const p = await richOwnerPage({ pageWork, assocAnswer: (j) => ({ ...j, products: [{ product: "salt", name: "salt", rows: [row] }] }) });
  try {
    const { d, work, click } = p;
    await work.quiet();
    let bad = [], seen = 0, sels = 0, selBad = [];
    const audit = () => { seen += d.querySelectorAll(".lbl").length; bad.push(...labelsBad(d));
      for (const x of d.querySelectorAll("select")) { sels++; if (!x.classList.contains("salt-field__select")) selBad.push(x.getAttribute("data-act") || x.className); } };
    await click(byAct(d, "nav.record")); await click(byAct(d, "part.record.entry"));
    const forms = [...d.querySelectorAll('[data-act="record.form"]')].length;
    for (let i = 0; i < forms; i++) {
      const back = d.getElementById("makerFormBack"); if (back && !back.hidden) back.click();
      const r = [...d.querySelectorAll('[data-act="record.form"]')][i]; if (r) { await click(r); audit(); }
    }
    ok(forms >= 10 && seen >= 25 && bad.length === 0, `every label on Record's ${forms} forms is the system's Field label, and every legend its label modifier (${seen} read; bare: ${bad.slice(0, 3).join(" | ") || "none"})`);
    /* 18 Oct 2026: a select is the system's, so its open list is the Desk's slate under salt ink (.salt-field__select option) and never the well this page once set */
    ok(sels >= 10 && selBad.length === 0 && rulesOf(SITE_RECIPES).some(([sel, b, m]) => !m && sel === ".salt-field__select option" && decl(b, "background") === "var(--salt-slate)" && decl(b, "color") === "var(--salt-salt)")
      && !R.some(([sel]) => /(^|[\s>+~,])option\b/.test(sel)),
      `every select on Record's forms wears the system's select, whose open list is slate under salt ink as on the Desk, and the page sets no list colour of its own (${sels} read; bare: ${selBad.slice(0, 3).join(" ") || "none"})`);

    /* a book on a row wears the Product tag, the book's mark in it and no word for the book (his word of 12 Oct 2026), its hue the book's own accent token, and no style attribute (the Counter's policy refuses one) */
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.approve"));
    const bare = (x) => { const g = x.cloneNode(true); g.querySelectorAll(".salt-producttag").forEach((t) => t.replaceWith("[tag]")); return g.textContent.trim(); };
    const line = [...d.querySelectorAll("#makerDrafts .maker-facts")].find((x) => x.querySelector(".salt-producttag--oil"));
    const tag = line && line.querySelector(".salt-producttag");
    ok(!!tag && tag.classList.contains("salt-producttag--oil") && !!tag.querySelector("svg.psym") && /^(Cube|Droplet|Lozenge|Capsule|Ring)$/.test(tag.querySelector(".sr").textContent) && !/oil/i.test(tag.textContent)
      && /^1 unit \[tag\], RM 100\.00$/.test(bare(line))
      && !!tag.querySelector(".salt-producttag__dot[aria-hidden='true']") && !tag.hasAttribute("style") && !tag.querySelector("[style]"),
    "a book on a row to approve wears the Product tag with its dot and its mark, told to a reader by its shape and by no word for the book: " + (line ? line.textContent : "no line"));
    const figs = d.querySelector("#makerDrafts article.salt-approve > .salt-metrics.salt-metrics--sm");
    ok(!!figs && [...figs.children].every((c) => c.querySelector(".salt-metrics__label") && c.querySelector(".salt-metrics__value")) && figs.children.length === 2,
      "and the cost and margin under it are the Metric row, a label over its figure");
    await click(byAct(d, "nav.orders")); await click(byAct(d, "part.orders.group"));
    const pool = [...d.querySelectorAll("#makerPools .maker-row")].find((x) => x.querySelector(".salt-producttag"));
    ok(!!pool && pool.querySelector(".salt-producttag").classList.contains("salt-producttag--salt") && /^\[tag\], 1 unit each\. 3 of 10 units in, 1 joined\./.test(bare(pool)) && !/salt/i.test(pool.textContent),
      "a group order's row shows its book on the Product tag too, as a mark and no word: " + (pool ? bare(pool).slice(0, 60) : "no row"));

    /* the hours are the week chart (20 Oct 2026, canvas V63), a button a day; the table is gone */
    await click(byAct(d, "nav.shop")); await click(byAct(d, "part.shop.hours")); audit();
    const week = d.querySelector("#makerSchedule .maker-week");
    ok(!!week && !d.querySelector("table.maker-hours") && week.querySelectorAll("button.maker-day").length === 7,
      "the weekly hours are the week chart, a button a day, and the table is gone");

    /* the guest links and the report card, on Customers */
    await click(byAct(d, "nav.customers")); await click(byAct(d, "part.customers.links")); audit();
    const links = [...d.querySelectorAll(".glink")];
    const moves = links.flatMap((l) => [...l.querySelectorAll(".grow > button")]);
    ok(links.length >= 2 && links.every((l) => l.classList.contains("salt-glass-card") && l.classList.contains("salt-glass-card--radius-md") && l.querySelector(".gt.salt-field__label"))
      && ["link.copy", "link.withdraw", "link.restore", "link.approve", "link.decline"].every((a) => moves.some((b) => b.getAttribute("data-act") === a))
      && moves.every((b) => b.classList.contains("salt-ghost")) && moves.filter((b) => /^link\.(withdraw|decline)$/.test(b.getAttribute("data-act"))).every((b) => b.classList.contains("salt-ghost--danger"))
      && moves.filter((b) => /^link\.(copy|restore|approve)$/.test(b.getAttribute("data-act"))).every((b) => !b.classList.contains("salt-ghost--danger")),
    `a guest link is the system's glass card, its label the Field label and its moves ghosts, Withdraw and Decline the danger ghost (${links.length} links, ${moves.length} moves)`);
    const heads = [...d.querySelectorAll("#oLinks .ghead")], picks = [...d.querySelectorAll(".glink select")];
    ok(heads.length >= 1 && heads.every((h) => h.classList.contains("salt-eyebrow") && h.classList.contains("salt-eyebrow--copper")) && picks.length === 0,
      `the heads over the links are the system's copper eyebrow (${heads.length}) and no level picker is drawn (${picks.length})`);
    await click(byAct(d, "part.customers.associates"));
    const card = d.querySelector("#clist .acard"), cells = card ? [...card.querySelectorAll(".agrid > .acell")] : [];
    ok(!!card && card.classList.contains("salt-glass-card") && card.querySelector(".agrid").classList.contains("salt-metrics") && card.querySelector(".agrid").classList.contains("salt-metrics--sm")
      && JSON.stringify(cells.map((c) => [c.querySelector(".salt-metrics__label").textContent, c.querySelector(".salt-metrics__value").textContent])) === JSON.stringify([["Bought from you", "RM 100.00"], ["Sold for you", "RM 50.00"], ["Introduced", "RM 20.00"]]),
    "the report card is the system's glass card and its three figures its Metric row, label over figure");
  } finally { p.w.close(); }
}
