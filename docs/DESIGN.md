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

## Fonts, and why the desk shows Georgia

The CSP is self-only and the build fails on any external load, so the desk cannot ask Google
for Fraunces or JetBrains Mono. The design system's font import moved out of `styles.css` into
`fonts.css` so the vendored stylesheet carries none, and the pull refuses one that does. The
fallbacks (Georgia, Consolas or Cascadia Mono) keep the split between figure and sentence,
which is the whole point of the type system. Embedding subsetted brand fonts as data URIs is
possible (about 200 KB on a 1.6 MB page) and is the owner's call: it needs the fonts fetched
once, which is a network step.

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
