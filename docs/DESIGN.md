# The desk in the Salt identity: the concept

Written 02 Sep 2026 for v472, the version that put the Salt design system (`Code\salt-ds`)
onto the desk. The ethos it applies is `salt-ds/DESIGN.md`; this is how the ethos meets a
16,000-line page that already has 1,187 assertions on it and a phone reading it at a market.

## The concept in one paragraph

The desk is a ledger read for its figures, so the figures are the light. Everything else
recedes into one dark material lit by a copper and brass aurora: glass panes with a brass
hairline, mono figures in salt, sentences in the display face, one accent, and three words of
colour that mean something (verdigris, ember, steel). A view is known by its name and its
numbers, not by a hue. The phone is the same desk, smaller. Nothing is designed twice.

## How it is built: a layer, not a rewrite

The desk's stylesheet is three last-wins layers already (the base, v108 glass, v213 Liquid
Glass, v281 interaction). v472 is a fourth, and the first that is generated:

| Block | File | What it is |
|---|---|---|
| `DESIGN base` | `design/salt-ds.css` | The design system's `src/styles.css`, vendored by `node tools/designsync.mjs --pull`. Tokens and the `salt-` recipes. |
| `DESIGN desk` | `design/desk.css` | The desk's own layer: binds `--ink`, `--gold`, `.kpi`, `.tab`, `.vpill` and the rest to the tokens. |

Both sit at the foot of the master's `<style>`, so they win; `--sync` renders them and
`--check` in CI proves the copy is the file, exactly as the engine, the book and the geography
are proved. Not one class is renamed, not one figure moves, and every geometry rule the phone
depends on (44px taps, 16px fields, tables in their own scrollers, safe areas) stands
untouched underneath.

**Why a layer.** The old material layers carry hundreds of load-bearing structural rules that
1,187 assertions already prove. Rewriting 1,600 lines of CSS to change the material would have
been a second desk to audit. A layer changes the material and the light and leaves the
geometry to the rules that own it. Retiring the older material layers is a later fold, and a
smaller one, once this one has been read for a while.

## The five decisions

1. **One accent.** Brass leads: hairlines, the active tab, the rule under a heading, the
   version chip. Copper is the label colour and the one thing on a view that needs the eye.
   The seven view hues (`body[data-sec]`) are retired by one rule.
2. **Three semantic words, and no others.** Verdigris for settled and owed to you; ember for
   what you owe, defaulted or breached; steel for pending. These are the only colours that
   carry meaning. Copper is attention, so there is no fourth.
3. **Figures in mono, sentences in the display face.** The whole figure vocabulary of the
   desk (tabs, chips, tags, tables, KPI values, codes, dates, fields, buttons) is listed once in
   `desk.css` section 3. Sentences inherit the display face from `body`.
4. **Glass once.** Panes are white 3% with a brass hairline; wells (fields, meter tracks) are
   black 28%; veils (sticky heads, menus) are obsidian 86%. A pane inside a pane is flat.
5. **Tone rides a hairline or a word.** A state is a mono word in its colour with a one-pixel
   border. The one filled control is the brass-to-copper pill, kept for what books or produces
   (`.vbtn`); every navigator and filter is a ghost.

## Fonts, self-hosted since v785

The CSP is self-only and the build fails on any external load, so the faces arrive as files each
surface serves itself. They are Google Fonts' own latin subsets, fetched once on his yes of 22 Sep
2026 and kept in `Code\salt-ds\fonts\` with their OFL licences (`fonts/README.md` holds the
request): Newsreader, variable over optical size (6 to 72) and weight (200 to 800), and Geist Mono,
variable over weight (100 to 900), his choice of 18 Oct 2026 (Fraunces and JetBrains Mono before).
The files are `newsreader-latin.woff2` (129 KB) and `geist-mono-latin.woff2` (23 KB). `src/fonts-local.css` declares them relative to the page. Each surface carries them by its
own sync: the desk's `designsync --pull` (`design/fonts.css` and `design/fonts/`, a generated block
before the base, the files copied to `public/fonts/` and precached by `sw.js`); the Counter's
`tools/stmt-fonts.mjs` (bytes in `stmt/fonts.js`, served at `/fonts/`, `font-src 'self'`); QR
Command's own `designsync --pull`, whose suite recomputes the build id and must hash any new input
in the same order. The vendored stylesheet carries no `@import`, and the pull refuses one that
does. Georgia and Consolas remain the fallbacks.

**Proving a face renders:** on the served page, after `document.fonts.ready`, every entry's
`status` is `loaded`, `document.fonts.check('16px Newsreader')` is true, and a hidden span measures
wider in the face than in its fallback.

## The colour mapping

Every colour literal in the desk's own CSS and JS was mapped once (252 hex, 180 rgba), the
generated blocks held out. The table, for anyone reading an old diff:

| Retired | Family | Now |
|---|---|---|
| `#7fd7e8` ice, `#8fe9ff`, `#63e6e0`, `#bff0ee` | first series, the salt book | `#e4e9ec` salt |
| `#5ad1c8`, `#3fb8b2` | map quiet, cyan | `#8ea2b6` steel |
| `#e8c66b` gold, `#f5c451` | second series, oil, attention | `#c5a059` brass |
| `#ffe08a`, `#f0dca6`, `#e8dcae`, `#f5c98a` | pale gold, tier two | `#d8c79c` brass soft |
| `#b3a6f5`, `#b07cff`, `#8aa0ff`, `#cdb6f6`, `#c7a4ff`, `#d8c4ff`, `#8ab8ff`, `#9d8cc4` | violet, pending | `#8ea2b6` steel |
| `#9a6fe8`, `#8a55d6`, `#6377d6`, `#5f86e8`, `#7d55c9`, `#7b6aa5`, `#6b58a8`, `#7c6aa0` | deep violet | `#6f8398` |
| `#6ee7a8`, `#5fd6a0`, `#9ee6c8`, `#bfe6d4`, `#9ff0be` | green, settled | `#6fae97` verdigris |
| `#3fae82` | deep green | `#4f8f7a` |
| `#ff7a8a`, `#ff5d73`, `#ff7a5a`, `#ff6f9c`, `#f078c4` | crimson, rose | `#d4694c` ember |
| `#ff9db0`, `#ffc1d6` | pale crimson | `#e08a72` |
| `#d14e79`, `#c4539b` | deep rose | `#b4563d` |
| `#ffcf7a`, `#ffd27a`, `#f0932b`, `#ffb454` | amber, orange | `#b87333` copper |
| `#caa53f`, `#c46f14` | dark gold, dark orange | `#b87333`, `#9a5f2a` |
| `#1a1030`, `#0c1420`, `#06301c` | ink on a filled control | `#05080a` obsidian |
| `#f4f5f7`, `#b6a6d6`, `#9689b8`, `#dcd3ef` | ink, muted, dim, prose | `#f2f4f5`, `#a6afb5`, `#7a8690`, `#e4e9ec` |
| `#100a1c`, `#0b0614`, `#180f2c`, `#0f1115`, `#140c26`, `#160c28`, `#140b26`, `#0c1018`, `#0a0d14` | violet-slate grounds | `#05080a` obsidian |
| `#1c1434`, `#201142`, `#171029`, `#191030`, `#1c1338`, `#150e2b`, `#1b2740`, `#241b2f`, `#0f3a4a`, `#2a1650`, `#3a1440` | violet-slate panels | `#0b1215` slate |
| `#231a40`, `#241a3d`, `#382a58`, `#271b45` | panel two, hairlines | `#0e171b`, `#16211f`, `#2a3a3a`, `#1c2628` |

The rgba fills follow the same table by triplet: `99,230,224` and `127,215,232` to
`228,233,236`; `232,198,107` and `245,196,81` to `197,160,89`; `176,124,255` and `179,166,245`
to `142,162,182`; `95,214,160` and `110,231,168` to `111,174,151`; `255,93,115`, `255,122,138`
and `255,111,156` to `212,105,76`; `240,147,43` and `255,207,122` to `184,115,51`; the slate
triplets to `5,8,10` or `11,18,21`.

The two books' hues are declared in the book (`PRODUCTS.accent` in `ledger/book.json`) as
`var(--salt-product-salt)` and `var(--salt-product-oil)`, because that block is generated and
the extract reads it there; an edit in the master's copy fails `booksync --check`.

## What the desk borrows from the design system, by surface

| Surface | Recipe |
|---|---|
| Rail | `GlassCard` material; `CrystalMark` beside a `Wordmark` ("Salt" / COMMAND); tabs as `DeskRail` tabs, mono caps, active in glass |
| Bar | `DeskBar`: a veil, the version chip, the two orbs |
| Parts strip | `TabStrip` pills |
| KPI tiles | `KpiTile`: copper label, mono figure, display-face note, tone on the left rule |
| Today's actions | `ActionCard`: severity on the left edge, rules as `StatusChip`s, share as a meter |
| Tables | `StatementTable`: mist caps heads over a brass rule, salt figures |
| Ledger, journal | `LedgerList` and `JournalEntry` material |
| States | `StatusChip` tones, `TierPill`, `ProductTag`, `QueueChip` |
| Insights and notes | `Insight`: one sentence, a brass or copper rule to the left |
| Buttons | `PillButton` for `.vbtn`; `GhostButton` for everything else |
| Fields | `TextField` and `SelectField` wells, brass focus |
| Charts | `CHART_THEME` and `CHART_SERIES` from `tokens.ts`, applied in `chartTheme()` |

## What was measured before it shipped

Rendered at 1280 and at 375 with the rail floated out of its button; no page error; every
rail tab, pill and orb measures at least 44 in both directions; the page never scrolls
sideways at 375. The suite gained a section that proves the two blocks are their files, that
no retired hex or rgba survives outside the generated blocks, that the crystal is in the rail
and the bar, that the favicon is brass on obsidian, that the books carry the identity's hues
through the book, that Chart.js is told once about mono and brass, and that the built desk,
the manifest and the icons carry the same. Every one of those regexes was run against the v471
master first and read red.

## 22 Sep 2026: the recipes, not only the tokens

His instruction: the desk, the Counter and QR Command are to use the design system and make full
use of it. Until then the master used none of the system's 252 classes: the layer above re-stated
each recipe against the desk's own class names, and it had grown two colours of its own, a true
alarm (v557) and the opaque warm panel (v567). Four things changed.

**The system was fixed first**, in `Code\salt-ds` at v1.1.0. Its root clipped (`overflow: hidden`
to contain an aurora that already clips itself), which made it the scroll ancestor of every sticky
element inside it, so its own DeskBar and DeskRail never stuck; measured in the browser, the bar sat
at -1200 after a 1200px scroll and holds at 0 now, the rail at its 22px. Nineteen rules set type
under its own smallest token; every one reads `--salt-text-xs` now. The field recipe was 15px on
glass against its own principles 4 and 7; it is a well, 16px and 44px tall. The two desk colours
became identity tokens, with three words for alphas the layer wrote by hand, and the desk set's
values were synced to what the desk had measured since v472 (the tile at 24px and 20px on a phone,
the note at 13.5px, the pill at the desk's size, the parts strip at 11.5px, the version bare).

**The desk adopted the recipes where a class-for-class swap was mechanical.** The markup carries
both names (`class="kpi salt-kpi"`, `salt-kpi__label`, `salt-insight`, `salt-pill salt-pill--sm`,
`salt-tabs__pill`, `salt-version`, and the aurora as `salt-aurora--fixed`), the layer's rules for
those are gone, and the base layer's tile rules, which outranked the recipe on specificity, are
retired. Two mechanisms carry the desk's own state into the recipe without a second rule: the
tile's tone letters set `--salt-kpi-tone`, and the parts strip's open pill is read off
`aria-selected`, which the recipe now honours beside its own modifier class. The rail, the bar and its orbs and the tags followed the same day on his instruction, one fold at a time,
each recipe first synced to the desk's measured values. Ghosts, fields, tables, tiers, product bands and
tags, actions and journal entries stay on the layer: each carries measured geometry the recipe does not
yet match, and moving them is a fold each.

**The Counter takes the recipes it uses.** `tools/stmt-style.mjs` slices the pill, the ghost, the
field, the tab strip and the state chip out of the vendored stylesheet into `SITE_RECIPES`, the
page carries them beside the tokens, and its own layer keeps geometry only: a button runs the width
of the form, the tabs share a row. The open tab is glass with a hairline now and not a filled brass
badge, which decision 5 had always reserved for the one button.

**QR Command takes the tokens by sync.** Its `app.css` carries the system's `:root` between markers,
written by its own `tools/designsync.mjs --pull`, and its build refuses to ship on drift.

What was not done that day: the brand fonts. They followed as v785, above.

**What the migration taught, for the folds still to come.**
- A recipe wins only where nothing outranks it. The DESIGN base block and the desk layer both sit
  at the foot, so a recipe at (0,1,0) loses to any older rule of higher specificity (`.kpi.r::before`,
  `.kpi .l`, the layer's generic `.chip`). Delete the base rules for a migrated component, and drop a
  generic class from an element that becomes a recipe.
- Bind state through what the recipe already reads: the tile's tone letters set `--salt-kpi-tone`;
  `aria-selected`, `aria-current="page"` and `aria-pressed` carry the open pill, tab and held chip.
  A generic layer rule on a shared class is scoped with `:not(...)` rather than split.
- Sync the recipe to the desk, not the desk to the recipe: the desk's measured values are the truth.
- Markup carries both names, so the suite's old selectors keep working; only literal old strings in
  the suite need updating.
- Land one component group per version, report, and wait for his word on the next.

**The fields group (06 Oct 2026, unbumped, for his word).** The body carries `.salt-fields`, the recipe's scope
for a page that draws its own forms: every input, select and textarea takes the well, the hairline
(`--salt-edge-field`), the ink, the brass focus ring, the placeholder at full strength and the option colours from
`design/salt-ds.css`, and the desk keeps size, face and padding (the recipe says so). Deleted: the material of
`.qfield`, `.ledbar` and bare `select` in the older layers, section 8 of `design/desk.css`, the `box`/`bx` field
styles and the inline borders and fills on the editor, the update box, the vault and Add ID boxes, the Journal
note and the price book's customer select. Visible at Night: the resting edge is brass-toned where it was a
6% white hairline, the focus ring is the system's 2px outline where it was a 3px glow, the placeholder is not
dimmed; inline fields under 16px (Add ID, vault, editor, price book) are 16px. Not touched: the date field's
Today button, `.qask`, labels. The suite section "Fields: the system" proves it.

**The tier pill group (09 Oct 2026, unbumped, for his word).** `tierPill()` carries the system's `.salt-tier`
recipe (`salt-tier salt-tier--1` to `--3`, the dot `salt-tier__dot`) beside the desk's `tierpill`, which keeps only the margin
beside the name. Deleted: the v245 pill, its three tier rules and the `tierglow` keyframes in the older layer, the desk's
four restatements in `design/desk.css` and the pill's entry in the mono list. The recipe was changed to the desk, not the desk to the
recipe: the three tints the desk drew (10, 9 and 7% of the tier's colour, which the old section-10 `background:transparent`
never beat, as `.tierpill.t1` outranks it), tabular figures, and the glow as a token mix. Measured: 34 of 34 shots the same;
the first run differed on Concentration's customer column until the tint was in the recipe. Left on the layer: `.tierpill{font-size:10.5px}`,
because the system's floor is its 11px `--salt-text-xs` (the suite reads it) and the desk's measured face is half a pixel under;
moving to 11px would widen every pill by about 4px and is his call. The suite section "Tier pill" proves it.

**The product bands and tags group (09 Oct 2026, unbumped, for his word).** The heading that says which book a block
draws is the system's `.salt-product` (`__dot`, `__sub`, `__rule`) and the stamp on a row its `.salt-producttag`
(`__dot`), beside `prodhd` and `prodtag`, which the suite and the parts still query. The book's accent reaches both as
`--salt-hue` on the element, never a colour written in the desk. Deleted: the band's and the stamp's older-layer rules
(the 800-weight embossed stamp, its inset highlights, the `pd` and `gl` dots), their entries in the face lists and
`design/desk.css`'s two override blocks. The recipe was synced to the desk, not the desk to it: no glow on the band's
dot, 3px 9px on the stamp, and the stamp's name takes `--salt-hue` as its dot does. Measured: a probe of every
`.prodhd`, `.prodtag` and child on all 17 parts at 1280 and 375 (1,374 elements, 35 computed properties each) reads
no difference, and `renderdiff` reads 34 of 34 the same. Left on the layer: the stamp's 10px (the system's tag is its
smallest token, 11px, and the suite forbids type under it), and the ledger's bare stamp (no frame, no padding), both
scoped to the stamp in `design/desk.css` with the reason beside them. The consolidated band's hollow ring is inline,
a token. The product switch (`.prodsw`) is another group. The suite section "Product bands" proves it.

**The actions group (09 Oct 2026, unbumped, for his word).** The Today action card carries the system's `.salt-action`
beside the desk's names (`salt-action__kind`, `__title`, `__why`, `__money` and `--nil`, `__go`, `__bar`, and the body),
in the action list's row and in the shelf call. The row sets the recipe's `--salt-sev` where it set `--sev`, and the
rule chips in its why read `--salt-sev` too (they went uncoloured in the first shot, which the suite now catches). The
recipe was synced to the desk first: radius `--salt-radius-sm` (12px, was md), the why's gap 5px, the bar 4px with a 10px
gap, a new `__go` cell for the way there (`align-self: center`; `ActionCard` takes a `go` prop), and the narrow layout at
860 and 560 (money beside the kind, body and way there across, gaps 6px 12px then 8px 10px), which was the desk's own.
Deleted: the card's rules in the older layer and in section 11 of `design/desk.css`, its two media rules, `.actk` from
the 11px list and the actk, actm, actt and actw names from the font lists. Left: `.acts` (the list's gap), the bar's
settle animation (motion the recipe does not carry), `.sevh` and the observations. Measured: 34 of 34 shots the same, and
a computed-style census of all 18 cards and their parts at 375, 800, 1000 and 1280 differing in one property only, the
money's `font-variant-numeric` (tabular, which the mono face already is). The Journal has had no desk markup since v802, so
`.salt-journal` has nothing to carry; the suite section "Actions: the system" says so and proves the rest.

**The ghosts group (09 Oct 2026, unbumped, for his word).** `.navlink`, `.ubtn`, `.obsbtn` and `.updchip` carry
`.salt-ghost` beside their own name in every producer (19 class attributes), so the edge, the ink, the 11px mono
uppercase face, the 44px tap both ways, the hover and the pressed state are the recipe's. Deleted: those classes'
material in the older layers and in section 7 of `design/desk.css`, the `.updchip.on` rule (the chip now sets
`aria-pressed` beside `.on`, which the recipe reads), and every `.lqb` and `.lquick` rule, a pair of classes no
markup has made since v495. Kept on the layer, because the recipe draws one padding: each placement's own padding
(navlink 6/11, ubtn 3/9, obsbtn 5/10, updchip 6/13), the hush row's 10.5px, and `.ubtn{--salt-ghost-tone}` bound to
brass, as a tile's tone is bound. The recipe was not changed, so the Counter's `stmt/statement-css.js` did not move.
Measured in a browser at 375 and 1280: all 386 live ghosts across the 17 parts are 44px by 44px or more, and read
the recipe's type, case, weight, radius and padding as before. What moved: the resting edge is the recipe's
brass-toned `--salt-edge-field` where it was a 6% white hairline (1.1:1), and a chip that is chosen has a brass edge
where it had a faint one; an Undo's 50% brass edge becomes the same brass tone. Buttons narrower than 44px (a one
word "Go") grow to 44px wide, which no live button was. `.exitbtn` stays on the layer: a fixed corner control with
its own 22%-opacity shape, under 44px, which the group did not take. The suite section "Ghosts: the system" proves it.

**The tables group (09 Oct 2026, unbumped, for his word).** Every data table carries the recipe's `salt-table` beside
its own classes (60 tables) and every label cell `salt-table__label` beside `l` (231 cells); the two key-and-value
lists in the calendar popover are not data tables and stay off it. The mist caps head, the salt figures, the faint
hairline, the opaque warm panel under the sticky head and label column and the total row's wash layered over it (v567)
are the recipe's, and the desk's copies are deleted: section 9 of `design/desk.css` bar the statements, and the generic
`table`, `th`, `td`, `tbody td`, `tr.tot td` and `th.l,td.l` rules, the `fintab` head rules, the phone's `table`,
`th,td` and `th{font-size:11px !important}` rules and the label wrap rules of the older layers. The recipe in
`Codesalt-ds` was synced to the desk, not the other way: a label cell wraps (`white-space: normal`) and a phone
closes the gutters to 7px 8px. A recipe at (0,1,1) loses to nothing earlier at the same weight, because the DESIGN base
block sits after the older layer, so the older `.fintab`, `.istmt` and `.pxboard` gutters and the board's wrapping
heads moved into `design/desk.css`, which sits after it. Left on the layer, scoped, because the recipe has no word for
them: the sticky head and pinned label column (`thead th`, `th.l,td.l`, in the master's older layer), the statements'
gutters (7px 9px, 6px 9px), their brass hairline and 13px figures, the year column, the group rows and the total rule,
the pivot grid's 6px and 4px gutters, a code cell's salt-product ink (`.mono`), and a statement's first head in mist
where every other label head is mist-light. Measured: the computed style of every cell, 27 properties, before and after,
on 2,922 table instances and 87,702 cells over both widths and every view button: identical but for two properties of the
<table> element itself (the popover lists' font size and the recipe's tabular figures), which no cell reads; the page never scrolls sideways at 375px on any part; the 34
renderdiff shots read 0 pixels apart. The suite section "Tables: the system" proves it, and v567's sticky-fill checks now
read the recipe.

## Traps in the layer

- A last-wins layer beats a media query: a bare selector in `design/desk.css` overrides an earlier
  `@media` rule of the same specificity. Scope a layer width, position or display on a class the
  narrow breakpoints also style with its own `@media(min-width:861px)`.
- The product hues, `PRODUCTS.accent`, sit inside the generated BOOK block: edit `ledger/book.json`,
  never the master, then `node tools/ledger.mjs`.
- The recolour regex `#[0-9a-f]{6}\b` misses 8-digit hex: sweep for the 6-digit prefix without the
  boundary. A regex over the whole master also matches the rendered DESIGN block: edit only above
  the `DESIGN base` marker.
- Retirement folds are proved with `tools/renderdiff.mjs` (baseline from the committed build, edit,
  build, shoot, compare; `--parts a,b` to re-shoot two). The compare ignores deltas of two or less,
  which is compositing rounding. After any type change probe `document.documentElement.scrollWidth`
  per part at 375px.

## 11 Oct 2026: two themes, Night and Tide, chosen on each device

His word: two themes on every surface, **Night** and **Tide**, kept per device, **Tide until one is chosen**. This is the
Desk; the Counter follows in the next section (11 Oct 2026), and Salt Admin has its own choice (below). Night is the design system's `:root`, the identity as drawn.
Tide is `:root[data-theme="tide"]` in `design/salt-ds.css`, pulled from `Code\salt-ds` (acf486e): a teal and blue register
of the same identity, colour tokens only, so every recipe follows. The four times of day, `salt-time.js` and the clock's
picker stay retired (the suite fails if any returns): nothing keys on a clock, there is no cross-fade.

- **The choice.** localStorage `salt-look`, `night` or `tide`; Tide when it is unset, unreadable or throwing, every read and
  write in a try. A head script, before the stylesheet, sets `data-theme` on `<html>` and the `theme-color` meta to the
  theme's ground (Night `#05080a`, Tide `#03141a`), so the first paint is the right one. `saltLook()` there is the one writer
  of both; `lookSet()` in the page calls it, stores the choice, marks the switch and draws the part showing again. The master
  owns the one `theme-color` meta: `tools/build.mjs` no longer injects its own and checks the master's (`P1b`).
  The installed app's manifest colour stays obsidian, being static.
- **The choice sheet.** Over a device's first open (the store readable and holding no choice): the system's Sheet, its two
  tiles the Option face as a tap, each with a swatch of its own ground and accent (`--desk-look-*` in `design/desk.css`, held
  equal to the system's obsidian and brass by the suite, since the tile must read true under the other theme). Choosing
  stores, applies at once and closes. Escape, Close and the scrim keep Tide and store nothing, so the next open asks again.
  A store that cannot be read is never asked, because the answer could not be kept. Focus goes in, Tab wraps, and the
  sheet lies over the desk's floating buttons (z-index 120 and 121; they sit at 96 and 97).
- **The switch.** The rail's foot, where the times-of-day picker sat: two `salt-ghost` buttons, Night and Tide, the held one
  `aria-pressed`, 44px both ways (measured at 1280 and 375). On a phone it sits at the foot of the rail the menu button
  floats out. It applies at once, stores, and needs no reload.
- **The desk's own colours.** Every colour `design/desk.css` holds for Night has its Tide value in the same file: the chart
  gridline, the map's steps, state outline, district edge and area name (4.6:1 on the lighter step, as Night's is 4.7:1), and
  the select's chevron, a data URL that cannot read a token. The inline tints in the script templates (the warning pills, the
  Names and IDs notes, the scrim) are `color-mix` of the system's tokens, which is the pixel they were at Night.
- **Charts and the map.** `tcol()` reads the tokens when it draws, so Tide draws Tide's hexes (`TIDE_COLOURS`); the tooltip's
  edge reads `--salt-line-strong` (`TIDE_CHART_THEME`). A switch renders the part showing again, as the clock's change used to;
  a part with no chart and no map is left alone, because rendering Enter's forms would lose what is typed. Oil stays brass
  at Tide, as every book hue is shared.
- **The suite.** The section `two themes: Night and Tide, chosen per device` holds the contrast of both themes off the files
  themselves, Tide restating every colour token, the choice, the sheet, the switch and a store that throws; the charts section
  repeats its Night checks at Tide. `openMaster` opens as a device that has chosen Night unless it is given `{ fresh: true }`,
  so the sections written against Night keep measuring it and no sheet is asked.
- **Contrast** (WCAG 2.x, every text token on the ground and the slate): Night's lowest is copper, 5.30 and 4.98; Tide's is a
  book hue it shares with Night, rice, 5.47 and 4.91, and of Tide's own tokens mist, 6.03 and 5.41. The lit slate and the
  aurora's core stay advice, as in `Code\salt-ds` (`DESIGN.md`, `npm run contrast`).

## 18 Oct 2026: Counter Batch A, the recipes salt-ds 1.7.0 added

salt-ds#13 (1.7.0) added, for both themes: `salt-status__glyph` (the mark before a state word), `salt-steps--marks` with
`__mark`, `__name`, `__time` and the done, now and next states, `salt-notice` (lines one at a time, `__pause` at 44px, dots), `salt-ledger__sub`
and `__row--due`, `salt-band` (an order's head with its reference), `salt-empty`, `salt-glass-card--link` (a whole card that is one control),
`salt-pin` and `salt-glance`. The Counter uses them as they are; its own CSS only lays them out. Ember and verdigris became text colours, so
both joined the Counter's measured contrast list. **Under reduced motion** the notice stacks every line with no dots, Pause or timer, a card link
does not lift and the steps do not animate.

## 11 Oct 2026: the Counter wears Night or Tide, chosen on each device

His decision, final: the same two themes on the customer's site (`stmt/`), the same rule as the Desk. Night is the design system's
`:root` and Tide its `:root[data-theme="tide"]`, kept per device in localStorage `salt-look`, Tide until a device chooses. Salt
Account (the owner's `/all`) takes the head script below and so opens in the stored theme; since the same day it also has the choice
Sheet on a first open and a Look row in Shop > This device, drawn by the same `lookSheet(true)` and `lookRow(true)` and kept in the Counter
origin's `salt-look`, shared with the Counter's pages on that device and apart from the Desk's (`docs/STATEMENTS.md`, "His look"). How a
customer chooses is there too ("The customer's look").

- **Tokens.** `tools/stmt-style.mjs` `saltTokens()` returns the design system's `:root` and `:root[data-theme="tide"]` blocks, and
  `--sync` writes both into `stmt/statement-css.js`; `--check` is in the gate. The Counter carries no Tide-only rule beyond the
  tokens (the aurora's are not used there). **The statement layer holds no colour that is not a token (12 Oct 2026, Phase 5b), the print
  block included**: the body's two corner glows are a `color-mix` of `--salt-copper` and `--salt-brass` into transparent, which Tide
  restates, and the review page's row tints and warning are a mix of the ember, verdigris and steel tokens; the print block is drawn in
  the system's `--salt-paper*` inks (a sheet is not a theme, so Tide restates none), each text ink 4.5:1 on the sheet and its panels.
  `stmt/page.js` holds none either: a choice tile must show the other theme's ground, which no token that follows the theme can, so the
  system has four `--salt-swatch-*` tokens (its obsidian and brass at Night and at Tide) and the tile reads those. The recipes the
  layer carries are the system's own and are held to it in its repo (`npm run contrast`); the suite (`test/counter-two-themes.mjs`) reads
  the statement layer and `PAGE_CSS` for a literal and measures the paper inks. Sealed issues and his sheets carry the Tide block and
  never set the attribute.
- **Before paint.** Every page that runs script carries `LOOK_HEAD`, a nonce'd script at the top of the head, before the stylesheet:
  it sets `data-theme` on `<html>` and the `theme-color` meta from `salt-look` (`night` or `tide`), Tide when it is unset, holds
  anything else or cannot be read (every access in a try). The door, the signed-in page, `/app` and Salt Admin all come from
  `landingPage`. A page with `script-src 'none'` (a guest board, the shut page) is served `data-theme="tide"` and Tide's ground in the
  meta, since no device's choice can be read there; the maintenance page does the same and writes Tide's ground, salt, mist-light and brass and its two corner glows into its own
  inline style, with the app's ring inline over the heading (held equal to the system's by the suite); the closed policy admits no
  face, so it falls back to the system's serif. The installed app's manifest colour stays obsidian, being static, and the
  QR's ink and field stay fixed so that a code scans.
- **Left in the system, for `Code\salt-ds` (rule 6).** The recipes the Counter carries hold three literals that are Night's, not
  tokens: the dashed edge of a drop area and `.salt-kpi--mist`'s tone, both `rgba(122,134,144,...)` (Night's mist, where Tide's is
  `#7f969c`, a difference of a few counts), and the QR panel's `#ffffff`. The shadows are black and the white tints shared by design.
  Nothing on the Counter's pages depends on them.
- **Contrast** (WCAG 2.x, measured by the suite off the generated stylesheet: the 13 tokens the customer page sets as text, on the
  ground and the slate): Night's lowest is copper, 4.98:1 on the slate; Tide's is mist, 5.41:1 on the slate. The ink on a filled
  control holds 5.30:1 at Night and 6.49:1 at Tide on the ends of the accent gradient, and the QR panel's title 17.12:1 and 15.26:1 on
  the panel's paper.
- **The suite.** The section `the Counter wears Night or Tide, chosen per device (11 Oct 2026)` (`test/counter-two-themes.mjs`, its
  mutations in `test/counter-two-themes.mutations.json`) drives the door, the signed-in page, Salt Admin, a guest board, the shut
  page and the maintenance page in a window, with a store that holds nothing, either theme, a value that is not a theme, and one that
  throws. The Counter's other sections open with nothing stored, as a device that has not chosen, and are unaffected by the Sheet:
  none of them measures a colour.

## 09 Oct 2026: one theme, Night (two themes since 11 Oct 2026, above)

His word: remove the four themes and keep one default. Night is the design system's `:root`, the identity as
drawn. Retired in `Code\salt-ds`: the Dawn, Day and Dusk blocks (the desk bar's Day tokens with them), the
cross-fade, `salt-time.js`, `SALT_THEMES`, `SALT_TIME_HOURS` and `timeOf`. Retired here: the `DESIGN time` block
(`designsync --check` now fails if its marker is left in the master), the rail's picker, the redraw on a theme
change, the Day, Dawn and Dusk values of the `--desk-*` tokens, and Day's product switch rule. The tokens stay:
every colour in the desk's own CSS is still a token, and a `--desk-*` declaration is the one place its literal
lives. Night's text colours measured on its panels: all 4.5:1 or more on the ground and the slate; on the lit
slate, mist (4.44) and copper (4.36) fall just short, which is the identity as drawn. A device's `salt-time` key in
localStorage is left behind and read by nothing. The record below is history.

## 05 Oct 2026: the time of day (version 2, step 1), retired 09 Oct 2026

His approval of the version 2 design: four themes that follow the viewer's clock, six hours each. Dawn
from 04:00 (cool slate, rose-gold accent), Day from 10:00 (the one light theme: salt paper and deep copper
ink, for the market in full sun), Dusk from 16:00 (warm brown, apricot brass), Night from 22:00 (the
identity as it was). The design system made the six colours roles (`Code\salt-ds`, `src/styles.css`): a
theme re-points obsidian, slate, salt, mist, brass and the materials, and every recipe follows. The pill's
ink (`--salt-ink-on-accent`) and the QR's field and ink never follow a theme.

**How the desk carries it.** `src/salt-time.js` is a fourth generated block, `DESIGN time`, a `<script>` in
`<head>` after the viewport meta, so `data-time` is set before the first paint (`designsync --pull`,
`--sync`, `--check`, as for the others). It arms one timer to the next boundary and cross-fades the change
for 1.2 seconds; the rail's foot carries the picker (Auto, Dawn, Dusk, Night), the choice kept on the device.
The build's `theme-color` starts at obsidian (it was the violet retired at v472) and the script sets it
to the theme's ground.

**The desk's own colours read the tokens.** Every identity colour the desk's older layers and
`design/desk.css` wrote as a literal is now its token: a tint as `color-mix(in srgb, var(--salt-brass) 7%,
transparent)`, which is the same pixel at Night, and the ink on a filled control as
`var(--salt-ink-on-accent)`. Measured: `tools/renderdiff.mjs` with the new `SALT_TIME=night` and
`RENDER_HIDE=".railtheme"` read 34 of 34 shots the same as the build before; Dawn and Dusk differ on every
shot, which proves the instrument saw a theme.

**Day was held back** (`<html data-time-day="off">`, which salt-time.js reads: Dawn stands in by the clock
and when Day is held) until 09 Oct 2026. 06 Oct 2026: the white and black tints and the light text hexes in the desk's own CSS
are tokens (a white tint is `color-mix(in srgb, var(--salt-salt) N%, transparent)`, a black one the same on
`--salt-ink-on-accent`, which is dark in every theme; `#e4e9ec` is `--ice`, `#e08a72` a mix of ember into salt);
the suite fails if one returns, the print block excepted. Night measured the same by `renderdiff` (34 of 34).
09 Oct 2026: the system's own `.salt-deskbar` reads `--salt-deskbar-sheen`, `-fill` and `-solid` (Night's values on
`:root`, paper restated for Day, in `Code\salt-ds`), so its ink title sits on paper in Day; Night, Dawn and Dusk
measured the same by `renderdiff` (34 of 34 each).

**Day shows** (09 Oct 2026, his word: the attribute is gone). Measured first in a browser, every part at 1280 and 375
wide: 2,828 text elements fell under 4.5:1 in Day against 197 at Night, nearly all from five roles. The Day palette in
`Code\salt-ds` was darkened along each hue until every colour read as text holds 4.5:1 on the ground, the slate and the
lit slate (copper toward red-brown, `#95511e`, so it stays apart from brass); the suite measures that off
`design/salt-ds.css`. The rest went to 182, mostly chips on their own tint (4.0 to 4.4:1) and rows dimmed on purpose,
which read as low at Night too. Three fixes in the desk: the theme picker sits three to a row (five words no longer fit
on one, and each keeps 44px); a book not in view on the product switch is read at full strength in Day (faded, it fell
to about 1.9:1); the gold chip and the names editor's fields read tokens (paper text on gold, a black field). The
heavier black-tint shadows stay: his call, they read as daylight. In Auto, Day still yields to Dawn on a device set
to dark (`salt-time.js`).

**The charts and the map read the theme** (06 Oct 2026). `tcol(role, alpha)` in the master reads a token off `<html>`
when a chart or the map is drawn, and `chartTheme()` reads Chart.js's own text, border and tooltip colours the same way
on every call; `salt-time` (the event salt-time.js dispatches on `<html>`) draws the part showing again, for the parts
that carry a chart or the map. The identity's hexes are the tokens, so Night is the pixel it was (the chart configs of
43 charts and the map's attributes compared with the build before: the same). The grid and the map's own steps are the
desk's tokens in `design/desk.css` (`--desk-chart-grid`, `--desk-map-0`, `-1`, `-edge`, `-name`, `-state`, `-void`,
`-core`), Night as it was, Dawn and Dusk moved with the theme, Day mixed over paper; they are to be promoted into
`Code\salt-ds` and pulled. A product's hue stays `PRODUCTS.accent` and does not move.

## The brand

The identity (obsidian, slate, brass, copper, salt and mist; Newsreader for display, Geist Mono
for figures since 18 Oct 2026; the crystal mark) is the private artifact "Business Identity",
https://claude.ai/code/artifact/211f8bec-2114-4c51-aaae-48d035119ef2. The finished assets live in
`Code\salt-ds\brand\` (`node brand/export_brand_assets.cjs`). Their DuitNow QR is the live
merchant code, whose record now lives in the pay store, `Code\qr-command\data\accounts.json` (the
old pay site was retired on 08 Sep 2026): regenerate it from the payload if the account changes,
draw it as rectangles, and decode the final PNG before it ships. Unit
figures only, never a mass symbol, in every asset.

## What is proposed, and not in v472

- **Retire the older material layers.** Done, v474 to v476, in three folds: the page-level
  colour system, then the v108 frost and v213 material (one accident found and retired on
  purpose: a note casting a pane's shadow), then the v281 colour rules and the rail's old active
  tab. Each read the same on every shot of `tools/renderdiff.mjs`. What remains is the base
  layer's per-component colour declarations, overridden and listed rather than taken.
- **Legibility.** Done at v477: a point up on every figure and label, a point and more leading
  on prose, tracking eased, running prose one step lighter; the phone board given three-pixel
  gutters so it fits its card, the stamp chip held at 10.5px so the page stays 375 wide.
- **Embed the brand fonts.** See above; the owner's call.
- **The Approve part on the `ApproveCard` recipe.** The draft cards already lead with cost and
  margin; the recipe gives them the identity's shape. One part, one fold.
- **A `DeskRail` rendered from `VIEWS`.** The rail is hand-written markup; the design system
  now has the component that describes it. Not worth a React runtime on the desk; worth
  keeping the two in the same shape.
