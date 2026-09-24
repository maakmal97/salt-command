/* stmt/page.js: THE ONE PAGE A CUSTOMER SEES.
 *
 * ONE LANDING PAGE FOR EVERY ACCOUNT, not one address per customer. The QR on a statement opens
 * this page with the username already filled in; the password comes by another channel. A
 * customer who types the address by hand fills in both. Nothing about which account is being
 * opened is in the URL path, so there is no per-account address to pass around or to walk.
 *
 * THE DECRYPTION HAPPENS HERE, IN THE BROWSER, AND THE PASSWORD NEVER LEAVES IT except as a
 * verifier check. The Worker returns {v,salt,iv,ct} and cannot read it: it holds no key, only a
 * hash it uses to decide whether to hand the envelope over at all. So a mistake in the route
 * leaks ciphertext, which is nothing, rather than a customer's account.
 *
 * WHAT IS INSIDE THE ENVELOPE IS EVERY STATEMENT THE CUSTOMER HAS EVER HAD, newest first, as one
 * JSON bundle. His instruction of 03 Sep 2026: one live password a month, and it opens this
 * month and every month before it. The page draws a strip of issue dates and shows one at a time.
 *
 * THREE THINGS BEHIND THE ONE PASSWORD (his instruction, 06 Sep 2026): the statements, a price
 * list, and an order. The price list is a second sealed document beside the live statement, opened
 * with the same content key and written by the same deploy (tools/pricelist.mjs says how it is
 * priced). The order goes to the site's own store on a session the Worker minted with the
 * password (stmt/orders.js says how it moves), and the page follows it: every ten seconds while
 * the page is open, and by a push to the phone when it is not. Payment is offered only once the
 * owner has said the order is ready, and the page then hands over ONE link, into QR Command, for
 * the rail the customer chose.
 *
 * THREE MINUTES, NOT TEN, and the lock is a privacy lock rather than an access control. Once
 * the page has been open the reader can screenshot it, and once the envelope has been fetched
 * a copy exists. What the timer prevents is the ordinary thing: a phone put down on a table
 * with an account still on it. The password opens it again as often as he likes. The lock also
 * forgets the session, so nothing can be ordered from a page that has locked.
 */
/* The GENERATED stylesheet, not tools/stmt-style.mjs. That module reads design/salt-ds.css
   with node:fs, and a Worker has no filesystem. `node tools/stmt-style.mjs --sync` writes
   this file and CI runs --check, so there is still one source. */
import { STATEMENT_CSS, SITE_RECIPES, FONT_FACE_CSS } from "./statement-css.js";
import { PAY_SITE, PAY_ACCOUNTS } from "./pay.js";
import { OWNER_JS } from "./owner.js";
import { MAX_OPEN, OPEN_STATES } from "./orders.js";

/* v692: THE THREE-MINUTE LOCK IS GONE (his instruction, 18 Sep 2026). It was a privacy lock for a
   phone left on a table; he asked for a page that stays signed in and a button that leaves. What
   replaced it is Remember me and Log out, which say what they do. */
export const POLL_MS = 10000;

const PAGE_CSS = `
/* hidden wins over every display rule below: the tab strip and the issue strip are flex */
[hidden]{display:none!important}
/* the bulletin, his notice board across the top (20 Sep 2026): a marquee when running, a line at a time when changing */
.bull{max-width:620px;margin:12px auto 0;padding:9px 14px;border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);
  background:var(--salt-well);font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-text);overflow:hidden;white-space:nowrap}
.bull[data-mode=run] .track{display:inline-block;padding-left:100%;animation:bullrun 24s linear infinite}
@keyframes bullrun{to{transform:translateX(-100%)}}
.bull[data-mode=change] .track{white-space:normal}
@media (prefers-reduced-motion:reduce){.bull[data-mode=run] .track{animation:none;padding-left:0;white-space:normal}}
/* The gate, in the same material as the document behind it. One filled control, the
   brass-to-copper pill, because this is the one thing on the page that produces something;
   decision 5 of the identity. Everything else is a hairline or a word. */
.gate{max-width:440px;margin:10vh auto 0;padding:0 4px}
.gate h1{font-size:var(--salt-text-xl);margin:0 0 8px}
.gate p.lead{color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.75;margin:0 0 24px}
/* S3 3.3: the link page, in the system's card, eyebrow, plain ledger and insight; the ring is the app's mark */
.appmark{display:block;margin:0 0 14px}
.gate .salt-glass-card{margin:0 0 4px}
.gate .salt-ledger__label{display:flex;align-items:center;gap:10px}
.gate .salt-ledger__row:last-child{border-bottom:0}
.gate .salt-insight .glyph{vertical-align:-0.3em}
.center{text-align:center}
/* S3 3.11: the code screen, the system's Code field under the one filled Paste */
#codeBox .salt-code{margin-top:22px;display:flex;flex-direction:column;gap:8px}
#codePaste .glyph{margin-right:8px;color:inherit}
#toCode,#codeDoor{margin-top:14px}
/* S3 3.8: the question sits where the tapped control was */
.ask .lead{margin:18px 0 0}
.ask .nocase{text-transform:none}
/* a username or a code inside a sentence is a figure, and figures are mono (decision 3) */
.mono{font-family:var(--salt-font-mono);color:var(--salt-text)}
.lbl{display:block;font-size:var(--salt-text-xs);letter-spacing:.2em;text-transform:uppercase;
  color:var(--salt-copper);font-weight:700;margin:14px 0 6px;font-family:var(--salt-font-mono)}
/* a well is black 28%, decision 4 */
/* the field is the system's .salt-field__input (22 Sep 2026): a well, 16px so a phone never zooms,
   44px tall; a code or a figure takes --mono and a sentence stays in the display face */
.fld{display:block}
/* S3 3.7: the door's two fields, the password beside its Show */
#doorBox .salt-field{margin-top:14px}
.pwrow{display:flex;gap:8px;align-items:stretch}
.pwrow .fld{flex:1 1 auto;min-width:0}
.pwrow .salt-ghost{flex:none}
.gate .salt-insight,#doorBox .salt-insight{margin:22px 0 0}
/* S3 fix: the code screen, carried into the signed-out Sheet, under the Sheet's own title */
#outForm #codeBox{margin:0}
#outForm .appmark{display:none}
/* v694: THE OPEN LIST IS DRAWN BY THE SYSTEM, NOT BY THIS PAGE. With no colour scheme declared it
   draws a white list of black words under a dark field, which is the colour he called bizarre.
   color-scheme tells the system the page is dark and the list follows it; option is named too, for
   the platforms that take the colour rather than the scheme. The chevron is drawn out of two
   gradients because appearance:none took the system's away and left nothing to say it opens. */
select.fld{letter-spacing:0;appearance:none;-webkit-appearance:none;color-scheme:dark;cursor:pointer;
  padding-right:42px;background-repeat:no-repeat;background-size:6px 6px,6px 6px;
  background-image:linear-gradient(45deg,transparent 50%,var(--salt-brass) 50%),linear-gradient(135deg,var(--salt-brass) 50%,transparent 50%);
  background-position:calc(100% - 22px) calc(50% - 2px),calc(100% - 17px) calc(50% - 2px)}
select.fld option{background:var(--salt-well);color:var(--salt-text)}
/* v695: a product is a mark. Brass, hairline, and it sits on the baseline of whatever it is beside. */
.psym{display:inline-block;vertical-align:-0.22em;color:var(--salt-brass)}
h3.pmark{margin:0 0 4px;line-height:1}
.pwith{display:inline-flex;align-items:center;gap:7px}
/* read aloud, never drawn: the shape's word, so a mark in a sentence is not a hole */
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
/* v694: the order's own figures, typed in the same well as everything else. payamt, not amt (24 Sep 2026):
   the statement's own Amount cells are td.amt, and a bare .amt laid every one of them out as a flex row */
.payamt{display:flex;gap:8px;align-items:center;margin-top:10px}
.payamt .fld{flex:1 1 0;min-width:0;text-align:right}
.payamt .cur{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-mist)}
/* the confirmation, one plain list of what is about to be ordered */
.conf{margin:10px 0 0;padding:0;list-style:none;font-family:var(--salt-font-mono);font-size:var(--salt-text-sm)}
.conf li{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--salt-line)}
.conf li:last-child{border-bottom:0}
.conf .k{color:var(--salt-mist)}
.conf .v{color:var(--salt-text);text-align:right}
/* S4, 24 SEP 2026: ORDERING, IN TODAY'S PLACES (stage 4 of the Counter's redesign). The look is the system's: the
   Sheet, Option tiles, pressed ghosts, the plain ledger, the insight and the glass card. What is here is where those
   pieces sit inside the osh; no colour of its own. */
.osheet .salt-sheet__title{flex:1 1 auto}
.osheet .salt-sheet__close{margin-left:auto}
.osheet .salt-sheet__body > * + *{margin-top:18px}
.osheet .salt-options__grid .salt-ghost,.osheet .ofull{width:100%}
/* a mark on a pressed ghost takes the ghost's own ink, so the chosen product reads as chosen (v695's rule for a mark on a
   control, which the segment it replaced carried) */
.osheet .salt-ghost .psym{color:inherit}
/* New order stands where the order form's pane stood, so it keeps the pane's gap to the Notifications card under it */
#oNew{margin-bottom:14px}
.ototal{flex:1 1 0;min-width:0}
.ototal .salt-kpi__value{margin-top:0}
.ototal .sub2{display:block;margin-top:2px}
.osheet .salt-sheet__foot .msg{flex:1 1 100%;margin:0}
.szrow{display:block;width:100%;min-height:52px;padding-left:0;padding-right:0;background:none;border-style:none none solid;
  font:inherit;color:inherit;text-align:left;cursor:pointer}
.szrow:last-child{border-bottom-style:none}
.szrow:focus-visible{outline:2px solid var(--salt-brass);outline-offset:2px}
.ochev{flex:0 0 auto;color:var(--salt-prose)}
.osent{text-align:center}
.otick{display:block;margin:4px auto 10px;color:var(--salt-verdigris)}
.obuzz > * + *{margin-top:10px}
.obuzz .salt-pill,.obuzz .salt-ghost{width:100%}
.olim{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;margin-top:6px}
.olim .salt-ghost{flex:0 0 auto}
/* the one filled control is the system's .salt-pill and the quiet ones its .salt-ghost (22 Sep 2026);
   this page decides only that they run the width of the form */
.btn{margin-top:18px;width:100%}
/* a pay link is a .salt-ghost too (24 Sep 2026); a long account name wraps, and its lines centre */
.btn.lnk{text-align:center;line-height:1.4}
/* KEEP IT ON YOUR HOME SCREEN (v693; S3 3.10): a card on the account, once signed in, in a browser that is not
   already the app; its steps sit in a Sheet and draw the phone's own marks */
.keepcard{max-width:620px;margin:0 auto 18px}
.keepcard .kline{margin:6px 0 10px;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.keepcard b{color:var(--salt-text);font-weight:600}
.keepsteps{margin:14px 0;padding-left:22px;line-height:2.1}
.keepsteps .glyph,.keepcard .glyph{vertical-align:-0.3em;margin:0 3px}
.keepsteps .sub2{display:block;line-height:1.5;margin:0 0 6px}
/* REMEMBER ME (v692): a checkbox on the door, at the tap size everything else here is */
.rem{display:flex;align-items:center;gap:10px;margin-top:16px;min-height:var(--salt-tap);
  font-size:var(--salt-text-sm);color:var(--salt-text-muted);cursor:pointer}
.rem input{width:18px;height:18px;accent-color:var(--salt-brass);cursor:pointer}
.msg{margin:16px 0 0;font-size:var(--salt-text-sm);line-height:1.6;min-height:1.4em;
  color:var(--salt-text-muted)}
.msg.bad{color:var(--salt-ember)}
.msg.wait{color:var(--salt-text-muted)}
/* a veil is obsidian 86%, decision 4 */
/* S1 1.32: THE WRAPPER STICKS, NOT THE BAR. #barw is exactly the bar's height, so a sticky bar inside it
   had nowhere to stick and scrolled away with Log out; the wrapper sticks to the page and carries both lines.
   UX2: IT STICKS UNDER THE STATUS BAR. The page draws under it (viewport-fit=cover, black-translucent), so at
   top:0 a saved iPhone app held Log out behind the clock, as the desk's bar was until v392 */
#barw{position:sticky;top:env(safe-area-inset-top,0px);z-index:5}
.bar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;
  gap:12px;padding:0 16px;margin:0 auto 14px;max-width:620px;
  background:var(--salt-veil);border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);
  backdrop-filter:blur(10px);font-size:var(--salt-text-sm);color:var(--salt-text-muted);
  font-family:var(--salt-font-mono)}
.bar b{color:var(--salt-text);font-variant-numeric:tabular-nums}
.lapse{flex-basis:100%;display:flex;justify-content:space-between;align-items:center;gap:12px}
.lapse[hidden]{display:none}
/* UX4, 24 Sep 2026: Log out and Continue are taps like any other, 44px both ways (they were 55 and 62 by 21,
   and Continue is the one way back after a lapse); the bar gives up its own padding, so it is no taller */
.bar button{font:inherit;color:var(--salt-brass);background:none;border:0;cursor:pointer;
  padding:0;text-decoration:underline;min-height:var(--salt-tap);min-width:var(--salt-tap);
  display:inline-flex;align-items:center;justify-content:center;flex:none}
/* THE THREE TABS: statements, prices, order. The same pill vocabulary as the issue strip, one
   step larger because these are destinations rather than dates. The strip is the system's .salt-tabs
   (24 Sep 2026), which wraps: an associate's four tabs need 363 to 387px and ran off a 360 screen. */
.tabs{max-width:620px;margin:0 auto 18px}
/* the tabs are the system's .salt-tabs__pill (22 Sep 2026): the open one is read off aria-selected and
   set in glass with a hairline, not a filled badge, which decision 5 reserves for the one button */
.tabs button{flex:1;min-height:var(--salt-tap)}
.panel{max-width:620px;margin:0 auto}
.panel h2{font-size:var(--salt-text-lg);margin:0 0 4px}
.panel p.lead{color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.7;margin:0 0 18px}
/* THE ISSUES, as a strip of dates. The current one leads; the rest are the record. A pill is
   a word in mono with a hairline, and the chosen one is brass: no filled badge. */
.mos{max-width:620px;margin:0 auto 22px;display:flex;flex-wrap:wrap;gap:8px}
.mos button{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.06em;
  color:var(--salt-text-muted);background:none;border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-pill);padding:7px 14px;cursor:pointer;
  /* v706: min-height was auto, so every month pill and every issue pill has been 29px tall since
     v690, on a strip whose whole purpose is to be tapped on a phone. His bar is 44px in BOTH
     dimensions, measured; swept across the class rather than fixed on the one new strip. */
  min-height:var(--salt-tap);display:inline-flex;align-items:center}
/* 24 Sep 2026: the chosen pill is what this comment always said, brass on a brass hairline; it was filled */
.mos button.on{color:var(--salt-brass);border-color:var(--salt-brass);font-weight:700}
.mos button small{margin-left:6px;font-weight:400;letter-spacing:.02em;text-transform:uppercase}
/* THE MONTH FILTER (v690): the same pill vocabulary as the issue strip, a step quieter, because it
   sits inside a statement rather than choosing between statements. The note under it says what the
   filter does and does not do, so a reader never takes a month's rows for the whole account. */
.mfil{margin-bottom:10px}
.mfnote{max-width:620px;margin:0 auto 18px;font-size:var(--salt-text-xs);color:var(--salt-text-muted);
  font-family:var(--salt-font-mono);letter-spacing:.04em;line-height:1.6}
.mfnote:empty{display:none}
/* S7 7.3: ACCOUNT. The month filter is the system's tab strip, every pill a 44px tap, placed on the list it filters;
   the earlier statements close the statement; This device follows it, and stands beside it from 1080px */
.acct{max-width:620px;margin:0 auto}
.mfil .salt-tabs__pill{min-height:var(--salt-tap);min-width:var(--salt-tap)}
.stmtback{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:0 0 18px}
.stmtback p{flex:1 1 220px;margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.stmtfoot{margin:30px 0 0;padding-top:18px;border-top:1px solid var(--salt-line)}
.stmtfoot .sub2{margin:6px 0 12px}
.stmtissues{display:flex;flex-wrap:wrap;gap:8px}
.devcard{margin:30px 0 0}
.devcard .salt-ledger{margin-top:6px}
.devcard .salt-ledger__row:last-child{border-bottom:0}
.devcard .salt-ledger__label{flex:1 1 auto}
.devcard .salt-ledger__flag .glyph{vertical-align:-0.3em;margin:0 3px}
.devout{width:100%;margin-top:14px}
@media (min-width:1080px){
  .acct{max-width:1060px;display:grid;grid-template-columns:minmax(0,620px) minmax(300px,1fr);column-gap:40px;align-items:start}
  .devcard{margin:0}
}
/* THE DOCUMENT KEEPS THE GEOMETRY IT WAS PROOFED IN. What is injected is the INSIDE of the
   statement's own .w wrapper, so without this the page rendered the tables full-bleed to the
   window while the lock bar and the issue strip stayed pinned at 620px above them: on a laptop
   the osh the customer opens and the osh he was sent were different documents. */
#out{max-width:620px;margin:0 auto}
/* a pane is white 3% with a brass hairline */
.pane{border:1px solid var(--salt-line);border-radius:var(--salt-radius-md);background:var(--salt-glass);
  padding:16px 18px;margin:0 0 14px}
.pane h3{font-size:var(--salt-text-md);margin:0 0 2px;font-family:var(--salt-font-mono);letter-spacing:.04em}
.pane .sub2{margin:0 0 10px}
.pane table{min-width:0}
.pane td,.pane th{padding:9px 0}
/* an order's state is the system's .salt-status (22 Sep 2026): a mono word in its colour with a hairline */
.quote{font-family:var(--salt-font-mono);font-size:var(--salt-text-xl);color:var(--salt-text);margin:8px 0 2px;font-variant-numeric:tabular-nums}
.row2{display:flex;gap:8px}
.row2 .fld{flex:1}
.seg{display:flex;gap:8px;margin-top:6px}
.pay{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.pay label{display:flex;gap:10px;align-items:center;min-height:var(--salt-tap);padding:0 6px;font-size:var(--salt-text-sm);cursor:pointer}
.pay input[type=radio]{width:18px;height:18px;accent-color:var(--salt-brass)}
/* S5, 24 SEP 2026: THE ORDERS PLACE. Needs you, then Open, then the earlier orders folded and not drawn. A row
   is the system's Inbox row and opens the order's own screen: the goods on Steps, the money on the plain Ledger
   list, one filled Pay, the thread on Bubble and thread, what happened on Plan, folded. The look is the
   recipes'; this block lays them out and nothing else. On a phone the open order is the whole tab; from 1080px
   the list stands beside it with its messages in view, wider than the reading column. */
.oplace{margin-top:18px}
.olab{margin:18px 0 8px}
.olist .olab:first-child{margin-top:4px}
.olist .salt-inbox-row{margin:0 0 8px}
.olater{width:100%;margin-top:10px}
.oback{margin:0 0 12px}
.ohead{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin:0 0 16px}
.ohead h3{margin:0;font-family:var(--salt-font-display);font-size:var(--salt-text-xl);letter-spacing:0}
.ohead .state{margin-left:auto}
.ohead .sub2{flex-basis:100%;margin:0}
.odue{color:var(--salt-ember)}
.oact .salt-pill,.oact>.salt-ghost{width:100%;margin-top:16px}
.omsgs{margin-top:22px}
.omsgs .olab{display:flex;justify-content:space-between;margin:0 0 10px}
.omsgs .salt-bubble__text{white-space:pre-wrap}
.osay{margin-top:var(--salt-space-3)}
.ohist,.ofoot{margin-top:18px}
.ohist ul{margin:0;padding:0;list-style:none}
.ofoot .salt-ghost{width:100%}
@media (max-width:1079px){#pOrder.o-open>:not(.oplace){display:none}.oplace.o-open>.olistcol{display:none}.oplace.o-open{margin-top:0}}
@media (min-width:1080px){
  .oplace{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:28px;align-items:start;
    width:min(1120px,100vw - 64px);margin-left:calc((100% - min(1120px,100vw - 64px))/2)}
  .oback{display:none}
  /* the open order stands under the bar while the list scrolls beside it, its thread in reach inside it */
  .oscreen{position:sticky;top:84px;max-height:calc(100vh - 100px);overflow-y:auto}
}

@media print{.bar,.mos,.tabs{display:none}}
/* THE OWNER'S ROSTER, in the gate's own geometry so the door looks like the door. One row per
   account: the code leads because that is what he knows an account by, and the username follows
   in mist because that is what is printed on the paper. A row is a tap target at the full 44px. */
.rlist{margin-top:14px;max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch}
.rlist button{display:flex;width:100%;gap:12px;align-items:baseline;justify-content:space-between;
  min-height:var(--salt-tap);padding:11px 14px;margin:0 0 6px;cursor:pointer;text-align:left;
  font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-text);
  background:var(--salt-glass);border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm)}
.rlist button:hover{border-color:var(--salt-brass)}
.rlist button span{color:var(--salt-mist);font-size:var(--salt-text-xs);letter-spacing:.06em}
.rnone{color:var(--salt-text-muted);font-size:var(--salt-text-sm);margin:14px 0 0}
/* THE MASTER ACCOUNT (v687). An item on More wraps to two lines, its name and what it is for. */
.rlist button[data-m]{flex-wrap:wrap}
.rlist button[data-m] span{flex:1 0 100%;margin-top:4px;color:var(--salt-text-muted)}
#mHome h1,#oAccts h1,#oLinks h1,#oMore h1{margin-top:0}
/* S9 9.7: an ended admin sign-in leaves nothing on the page but the way back in */
body.ended>*:not(#aEnded){display:none}
/* S9 9.2: HIS OWN PAGE'S SHELL. The App bar and the Desk rail are the system's, and which one shows is the
   system's switch at 1080px; this page decides the column, the room kept clear above the bar, and where the
   open account stands: beside the list on a desk, in its place on a phone, with a way back. */
.gate.adm{max-width:600px;margin-top:32px;padding-bottom:calc(var(--salt-bar-h) + 32px + env(safe-area-inset-bottom))}
.adm .salt-eyebrow{margin:0 0 6px}
.aring{display:flex;width:36px;height:36px;align-items:center;justify-content:center;color:var(--salt-brass);
  border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);background:var(--salt-well)}
.aring svg{width:22px;height:22px}
.salt-rail__tab .salt-appbar__place{color:inherit}
#mFoot:empty{display:none}
.afind{display:flex;flex-direction:column;gap:12px;margin:0 0 16px}
.afil{display:flex;flex-wrap:wrap;gap:8px}
.alist{display:flex;flex-direction:column;gap:8px}
.alist .salt-inbox-row__title{gap:6px}
#aopen .scard{margin:0}
.achips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
@media (min-width:1080px){
  .gate.adm{max-width:1180px;margin-top:24px;display:flex;gap:28px;align-items:flex-start;padding-bottom:48px}
  .adm .amain{flex:1 1 auto;min-width:0}
  #mHome,#oLinks,#oMore,#oCards{max-width:600px}
  #oAccts.open .asplit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,440px);gap:20px;align-items:start}
  #aopen{position:sticky;top:24px}
  #aopen .aback{display:none}
  /* S9 fix: Needs you beside the account a card is about (the plan's f13w) */
  #mHome.open{max-width:none}
  #mHome.open .nsplit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,440px);gap:20px;align-items:start}
  #nopen{position:sticky;top:24px}
}
@media (max-width:1079.98px){
  #oAccts.open .afind,#oAccts.open .alist,#oAccts.open #scount{display:none}
  #nopen{display:none}
}
/* a card's party opens its account: a quiet link at the full tap, its hit area kept off the card's rhythm */
button.salt-approve__party{display:inline-flex;align-items:center;min-height:var(--salt-tap);min-width:var(--salt-tap);
  margin:-12px 0;padding:0;background:none;border:0;cursor:pointer;text-align:left;text-decoration:underline;text-underline-offset:3px}
/* S9 9.1: NEEDS YOU, the system's Approve card a thing; this page decides only the gaps between them and
   the line a tap is answered on, which sits on the card it answers */
#mHome .salt-eyebrow{margin:0 0 6px}
.nlist{display:flex;flex-direction:column;gap:12px;margin:0 0 24px}
.nlist .glink{margin:0}
.nnote{margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.nnote:empty{display:none}
.nnote.bad{color:var(--salt-ember)}
.nwait{display:flex;align-items:center;gap:8px;margin:-8px 0 24px;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.nwait svg{width:16px;height:16px;flex:0 0 auto;color:var(--salt-brass)}
/* THE ASSOCIATES REPORT CARD (v691): three figures across, then what they have earned in units
   with a bar for the part-unit. The bar is the only chart on this site and it is a rule and a
   fill, because a percentage of a unit is a proportion and nothing more. */
.acard{border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);background:var(--salt-glass);
  padding:14px 16px;margin:12px 0 0}
.acard.off{opacity:.55}
.acard .agrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.acard .acell{min-width:0}
.acard .acell .l{display:block;font-size:var(--salt-text-xs);letter-spacing:.12em;text-transform:uppercase;
  color:var(--salt-copper);font-family:var(--salt-font-mono)}
.acard .acell b{display:block;margin-top:3px;font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);
  color:var(--salt-text);font-variant-numeric:tabular-nums}
.pbar{height:6px;margin:10px 0 6px;border:1px solid var(--salt-line);border-radius:999px;overflow:hidden;
  background:var(--salt-well)}
.pbar i{display:block;height:100%;background:var(--salt-gradient)}
#oCards h2{margin:22px 0 0;font-size:var(--salt-text-md)}
/* v696: the five stand above anything minted against a customer, each under its own line */
.ghead{margin:18px 0 6px;font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);
  letter-spacing:.18em;text-transform:uppercase;color:var(--salt-copper);font-weight:700}
.ghead:first-child{margin-top:4px}
/* THE TEST ACCOUNT (v689): its own small block under the items, quiet, because it is a thing he
   makes and unmakes rather than a place he goes. */
.mtest{margin-top:18px;padding-top:14px;border-top:1px solid var(--salt-line)}
.mtest p.lead{margin:0 0 10px;color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.7}
.mtest .btn{margin-top:0}
/* SEND STATEMENT (v688): a card an account, in the same material as a guest link's card. The
   password's button is the ember one, because it is the one thing on the page that must not be
   tapped by accident, and a card that has gone out fades rather than leaving the list. */
.scard{border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);background:var(--salt-glass);
  padding:14px 16px;margin:12px 0 0}
.scard.done{opacity:.55}
.scard .srow{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
  font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-text)}
.scard .srow .un{color:var(--salt-brass);letter-spacing:.08em;font-size:var(--salt-text-xs)}
.scard .tot,.scard .op{margin:6px 0 0;font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);
  color:var(--salt-text-muted);letter-spacing:.04em}
.scard .qrw{display:flex;gap:12px;align-items:center;margin:12px 0 0}
.scard .qrw canvas{border-radius:var(--salt-radius-sm);flex:0 0 auto;image-rendering:pixelated}
.scard .qrn{margin:0;font-size:var(--salt-text-xs);color:var(--salt-text-muted);line-height:1.6}
.scard .grow{flex-wrap:wrap}
.scard .grow button{flex:1 0 46%}
.scard .grow button.pw{border-color:rgba(212,105,76,.45);color:var(--salt-ember)}
.scard .grow button[disabled]{opacity:.45;cursor:default}
.scard .tick{display:flex;align-items:center;gap:8px;margin-top:12px;min-height:var(--salt-tap);
  font-size:var(--salt-text-sm);color:var(--salt-text-muted);cursor:pointer}
.scard .tick input{width:18px;height:18px;accent-color:var(--salt-verdigris)}
/* the way back is a quiet line, not a second filled control: the page has one of those and it is
   the one that opens an account */
button[data-back]{display:inline-flex;align-items:center;min-height:var(--salt-tap);margin:0;padding:0;
  background:none;border:0;color:var(--salt-brass);cursor:pointer;text-align:left;
  font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.14em;text-transform:uppercase}
/* A GUEST LINK, as a card: who it is for leads, then the tier, then what it has done. The address
   is selectable text rather than a live link, because the thing he does with it is copy it. */
.glink{border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);background:var(--salt-glass);
  padding:14px 16px;margin:12px 0 0}
.glink.off{opacity:.5}
.glink h4{margin:0;font-size:var(--salt-text-md);font-weight:600}
.glink .gt{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.14em;
  text-transform:uppercase;color:var(--salt-copper);font-weight:700;margin:0 0 6px}
.glink .gu{display:block;width:100%;margin:10px 0 0;padding:9px 11px;font-family:var(--salt-font-mono);
  font-size:var(--salt-text-xs);color:var(--salt-brass);background:var(--salt-well);
  border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);word-break:break-all}
.glink .gs{margin:8px 0 0;font-size:var(--salt-text-xs);color:var(--salt-text-muted);
  font-family:var(--salt-font-mono);letter-spacing:.04em}
.glink img{display:block;margin:12px auto 0;border-radius:var(--salt-radius-sm);width:180px;height:180px}
.grow{display:flex;gap:8px;margin-top:12px}
.grow button{flex:1;min-height:var(--salt-tap);font-family:var(--salt-font-mono);
  font-size:var(--salt-text-xs);letter-spacing:.06em;color:var(--salt-text);background:none;
  border:1px solid var(--salt-line);border-radius:var(--salt-radius-pill);cursor:pointer}
`;

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* THE GUEST BOARD (his instruction, 10 Sep 2026). A referral link opens this and nothing else: one
   tier's board prices, no statement, no order, no account, no sign-in. It is a page of numbers he
   would otherwise print, so it is SERVER-RENDERED AND CARRIES NO SCRIPT AT ALL -- its CSP forbids
   script outright rather than allowing a nonce, which is the strongest thing that can be said about
   a page and is free here because there is nothing for a script to do.

   A ONE-TIER PRODUCT SAYS SO. Oil has no Tier 1, so a Tier 1 link shows oil at its only price; the
   line says that rather than leaving him to wonder whether the guest was quoted a discount. */
/* ---- THE PRODUCT IS A MARK, NOT A WORD (v695, his instruction of 18 Sep 2026) ---------------
 * "The products are only written as a symbol, the golden cube outline as salt and another one,
 * golden water droplet outline as well for oil." So nothing customer-facing names a product: a
 * cube outline for the one and a droplet outline for the other, both in brass, both drawn here
 * and nothing loaded. It is the same rule as the tier's mark (v659): the customer holds the
 * thing, and the page shows the thing rather than saying what it is called.
 *
 * A PRODUCT WITH NO MARK GETS THE RING, not a blank: a third product added to the book without a
 * symbol would otherwise draw nothing at all, which reads as a fault rather than as an omission. */
export const PSYM = {
  salt: 'M12 2.6 L20.6 7.3 L20.6 16.7 L12 21.4 L3.4 16.7 L3.4 7.3 Z M12 12 L20.6 7.3 M12 12 L3.4 7.3 M12 12 L12 21.4',
  oil: 'M12 2.4 C12 2.4 19.2 10.6 19.2 15 A7.2 7.2 0 0 1 4.8 15 C4.8 10.6 12 2.4 12 2.4 Z',
  /* v779, his choice of 22 Sep 2026. A rhombus for the one and a seamed stadium for the other,
     drawn in the same hairline stroke as the cube and the droplet. The capsule carries its seam
     for the reason the cube carries its three inner edges: without it a stadium is a shape and
     with it it is a thing. Neither is literal, and neither is a word. */
  candy: 'M12 2.8 L20.4 12 L12 21.2 L3.6 12 Z',
  rice: 'M8.2 8.2 L15.8 8.2 A3.8 3.8 0 0 1 15.8 15.8 L8.2 15.8 A3.8 3.8 0 0 1 8.2 8.2 Z M12 8.2 L12 15.8'
};
const RING = 'M12 4.2 A7.8 7.8 0 1 1 11.99 4.2 Z';
/* A CONTROL STILL NEEDS A NAME, and the name is the SHAPE, never the product. A button holding
   only a decorative mark is unusable with a screen reader; an aria-label naming the product would
   put the word back for exactly the readers who cannot see that it was taken away. The shape is
   what is on the screen, so saying it aloud gives away no more than looking does. */
export const PSHAPE = { salt: "Cube", oil: "Droplet", candy: "Lozenge", rice: "Capsule", _: "Ring" };
/* THE SHORT MONTHS, NAMED ONCE (24 Sep 2026). Node and every browser write "Sept" for September in en-GB, and
   the house writes Sep: the page, his page, the statement and the price list all read the month from here. */
export const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/* S4 4.9, 24 SEP 2026: ONE DELIVERY SENTENCE, wherever the charge is explained (the plan's words, his "all recommended"):
   Prices, the check before Place, and a guest's board. It replaces three wordings, one of which ("quoted when you order")
   was never true: the charge is set when he confirms the order, and only then. */
export const DELIVERY = "Delivery is charged by area. We tell you the charge when we confirm, before you pay, and you can cancel then at no cost.";
/** The mark for a product, as SVG source. `px` is the drawn size; the stroke stays hairline. */
export function psymSvg(product, px) {
  const d = PSYM[String(product || "").toLowerCase()] || RING;
  return '<svg class="psym" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false">'
    + '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

/** A size in words, units above one and unit at one (S4). The one copy: a guest's board calls it here, and the page's own
 *  script is served its source, so the two cannot drift apart. */
export function unitsOf(q, u) { u = u || "unit"; return q + " " + (+q > 1 && u.slice(-1) !== "s" ? u + "s" : u); }

/* ---- THE MARKS A SCREEN DRAWS BESIDE ITS WORDS (S3, 24 Sep 2026) ------------------------------------
   The app's ring, the three things inside it, and the phone's own controls (the menu's dots, Share, Add to
   Home Screen, Paste, an install mark), drawn inline in the product marks' own hairline manner and never
   loaded, so a phone set to another language still matches the picture. */
const GLYPH = {
  ring: RING,
  home: "M4 10.6 L12 4 L20 10.6 V20 H14.6 V14.4 H9.4 V20 H4 Z",
  prices: "M3.8 12.6 V4.3 H12.1 L20.2 12.4 L12.4 20.2 Z M9.7 8.6 A1.5 1.5 0 1 1 6.7 8.6 A1.5 1.5 0 1 1 9.7 8.6 Z",
  orders: "M6.5 3.5 H17.5 V20.5 L15.3 19.2 L13.1 20.5 L10.9 19.2 L8.7 20.5 L6.5 19.2 Z M9.5 8 H14.5 M9.5 11.5 H14.5 M9.5 15 H12.5",
  dots: "M5.1 12 A1.4 1.4 0 1 0 7.9 12 A1.4 1.4 0 1 0 5.1 12 Z M10.6 12 A1.4 1.4 0 1 0 13.4 12 A1.4 1.4 0 1 0 10.6 12 Z M16.1 12 A1.4 1.4 0 1 0 18.9 12 A1.4 1.4 0 1 0 16.1 12 Z",
  close: "M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5",
  share: "M12 3.6 V14.4 M8.3 7.2 L12 3.6 L15.7 7.2 M8.6 10.4 H6.6 V20.4 H17.4 V10.4 H15.4",
  addsq: "M8.2 4.6 H15.8 A3.6 3.6 0 0 1 19.4 8.2 V15.8 A3.6 3.6 0 0 1 15.8 19.4 H8.2 A3.6 3.6 0 0 1 4.6 15.8 V8.2 A3.6 3.6 0 0 1 8.2 4.6 Z M12 8.4 V15.6 M8.4 12 H15.6",
  install: "M12 4 V14.6 M8 10.8 L12 14.8 L16 10.8 M5 16.6 V19.6 H19 V16.6",
  menu: "M4.5 7 H19.5 M4.5 12 H19.5 M4.5 17 H19.5",
  paste: "M7.6 4.8 H16.4 A2 2 0 0 1 18.4 6.8 V18.4 A2 2 0 0 1 16.4 20.4 H7.6 A2 2 0 0 1 5.6 18.4 V6.8 A2 2 0 0 1 7.6 4.8 Z M9.2 4.8 V3.4 H14.8 V4.8 M9 10.2 H15 M9 13.6 H15 M9 17 H12.6",
  vdots: "M10.6 6.5 A1.4 1.4 0 1 0 13.4 6.5 A1.4 1.4 0 1 0 10.6 6.5 Z M10.6 12 A1.4 1.4 0 1 0 13.4 12 A1.4 1.4 0 1 0 10.6 12 Z M10.6 17.5 A1.4 1.4 0 1 0 13.4 17.5 A1.4 1.4 0 1 0 10.6 17.5 Z",
};
const FILLED = { dots: true, vdots: true };
export function glyphSvg(name, px) {
  const fill = FILLED[name] ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.4"';
  return '<svg class="psym glyph" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false">'
    + '<path d="' + GLYPH[name] + '" ' + fill + ' stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

/* S3 3.5: A REMEMBERED PHONE DRAWS THIS, NOT THE DOOR, while it opens; and when a session lapses with nothing
   remembered, a Sheet says so over whatever they were doing, and the door's own form moves into it. */
function signedOutSheet() {
  return '<div id="opening" class="gate" hidden><span class="appmark">' + glyphSvg("ring", 40) + "</span>"
    + '<p class="lead" role="status">Opening your account...</p></div>'
    + '<div id="outScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="outSheet" class="salt-sheet" role="dialog" aria-modal="true" aria-labelledby="outT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head"><h2 class="salt-sheet__title" id="outT">You were signed out on this <span class="dev">phone</span></h2>'
    + '<button type="button" class="salt-orb salt-sheet__close" id="outX" aria-label="Close">' + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body"><p>Sign in again to carry on. What you were doing is kept.</p><div id="outForm"></div></div>'
    + "</div>";
}

/* S3 3.8: ONE PHONE, ONE REMEMBERED ACCOUNT. Signing in as another account over a remembered one asks first,
   beside the control that was tapped, which moves here when asked. */
function replaceAsk() {
  return '<div id="askRep" class="ask" role="group" aria-labelledby="askRepT" hidden>'
    + '<p class="lead" id="askRepT"></p>'
    + '<button class="btn salt-pill salt-pill--md" id="askYes" type="button">Replace</button>'
    + '<button class="btn salt-ghost" id="askNo" type="button"></button></div>';
}

/* S3 3.10: KEEP IT ON YOUR HOME SCREEN. An iPhone's Home Screen app keeps its own storage, so what Safari
   remembers never reaches it: the Sheet says so in one line and carries the sign-in across with a code. The code
   and its key are minted as the Sheet opens, so Copy is a tap of its own (the judges' must-not-ship list), and
   the steps draw the phone's own marks. Nothing here says a link signs the saved app in. */
function keepCard() {
  return '<div id="keepCard" class="keepcard salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm" hidden>'
    + '<p class="salt-eyebrow salt-eyebrow--brass" id="keepHead">Keep it on your Home Screen</p>'
    + '<p class="kline" id="keepLine">One tap to open, and it stays signed in. It is saved as <b>Salt Counter</b>.</p>'
    /* S3 3.12: the browser's own Install where it offers one; else that browser's own marks, drawn */
    + '<p class="kline" id="keepSam" hidden>Tap ' + glyphSvg("menu", 22) + " then Add page to, then Home screen.</p>"
    + '<p class="kline" id="keepDesk" hidden>Look for the install mark ' + glyphSvg("install", 22) + " at the end of the address bar.</p>"
    /* S3 fix: an Android browser that offers no install, or whose offer was turned down, is shown its own menu's mark */
    + '<p class="kline" id="keepDroid" hidden>Tap ' + glyphSvg("vdots", 22) + " then Install app or Add to Home screen.</p>"
    + '<button class="btn salt-ghost salt-ghost--lit" id="keepGo" type="button">Show me how</button>'
    + '<button class="btn salt-ghost salt-ghost--lit" id="keepInstall" type="button" hidden>Install Salt Counter</button></div>';
}
/* S7 7.3: THIS DEVICE, in Account: its notifications and saving it as an app (rows drawn by drawDevice), a slot for
   the account's other devices (stage 9: sign in another device, sign out the others), and signing out of this one */
function thisDevice() {
  return '<section id="thisDevice" class="devcard salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm" aria-labelledby="devT" hidden>'
    + '<h2 class="salt-eyebrow salt-eyebrow--copper" id="devT">This device</h2>'
    + '<div id="devRows" class="salt-ledger salt-ledger--plain"></div>'
    + '<div id="devSlot"></div>'
    + '<button type="button" class="salt-ghost devout" id="devOut">Sign out of this <span class="dev">phone</span></button>'
    + "</section>";
}
function keepSheet() {
  return '<div id="keepScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="keepSheet" class="salt-sheet" role="dialog" aria-modal="true" aria-labelledby="keepT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head"><h2 class="salt-sheet__title" id="keepT">Keep it on your Home Screen</h2>'
    + '<button type="button" class="salt-orb salt-sheet__close" id="keepX" aria-label="Close">' + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body">'
    + "<p>On iPhone the Home Screen app starts signed out, so it asks once for this code. Copy it now, and paste it there.</p>"
    + '<ol class="keepsteps">'
    + "<li>Tap " + glyphSvg("dots", 22) + " then " + glyphSvg("share", 22)
    + '<span class="sub2" id="keepWhere">At the foot of Safari. On an older iPhone, just the second mark.</span></li>'
    + "<li>Tap " + glyphSvg("addsq", 22) + " then Add</li>"
    + "<li>Open the new icon and tap " + glyphSvg("paste", 22) + " Paste the code</li></ol>"
    + '<div class="salt-code"><label class="salt-code__label" for="keepCode">Your code</label>'
    + '<input class="fld salt-field__input salt-field__input--code" id="keepCode" type="text" readonly value="" aria-describedby="keepHint">'
    + '<span class="salt-code__hint" id="keepHint">Works once, for 15 minutes.</span></div>'
    + '<p class="msg" id="keepMsg" role="status" aria-live="polite"></p></div>'
    + '<div class="salt-sheet__foot"><button class="btn salt-pill salt-pill--md" id="keepCopy" type="button">Copy the code</button></div>'
    + "</div>";
}

/* S3 3.11: ONE STEP TO FINISH. The saved app starts at /app with storage of its own: a key carried by Paste, or the
   eight symbols typed, brings the sign-in across, and the help says the true way to get one. */
function codeScreen() {
  return '<div id="codeBox" class="gate" hidden>'
    + '<span class="appmark">' + glyphSvg("ring", 40) + "</span>"
    + '<h1 id="codeH">One step to finish</h1>'
    + '<p class="lead" id="codeLead">Bring your sign-in across from Safari. You do this once on this <span class="dev">phone</span>.</p>'
    + '<button class="btn salt-pill salt-pill--md" id="codePaste" type="button">' + glyphSvg("paste", 20) + " Paste the code</button>"
    + '<div class="salt-code"><label class="salt-code__label" for="codeIn">Or type it</label>'
    + '<input class="fld salt-field__input salt-field__input--code" id="codeIn" type="text" placeholder="XXXX XXXX" '
    + 'autocomplete="one-time-code" autocapitalize="characters" autocorrect="off" spellcheck="false" aria-describedby="codeHint">'
    + '<span class="salt-code__hint" id="codeHint">Eight letters and numbers, as Safari showed them.</span></div>'
    + '<p class="msg" id="codeMsg" role="status" aria-live="polite"></p>'
    + '<button class="btn salt-ghost" id="codeDoor" type="button">Sign in with username and password</button>'
    + '<p class="salt-insight" id="codeHelp">No code? Open your sign-in link in <b>Safari</b>, tap Keep it on your Home Screen, '
    + "and copy the code shown there.</p>"
    + "</div>";
}

/* S3 3.3: THE LINK PAGE. A link opens here and spends nothing until Continue: it says which account it opens
   and what is inside, and an app's own browser is sent to Safari or Chrome first. */
function linkScreen() {
  const row = (g, t) => '<div class="salt-ledger__row"><div class="salt-ledger__line"><span class="salt-ledger__label">'
    + glyphSvg(g, 20) + t + "</span></div></div>";
  return '<div id="link" class="gate" hidden>'
    + '<span class="appmark">' + glyphSvg("ring", 40) + "</span>"
    + "<h1>Your Salt Counter</h1>"
    + '<p class="lead" id="linkLead">This link opens your account on this <span class="dev">phone</span> and keeps it signed in.</p>'
    + '<div class="salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm">'
    + '<p class="salt-eyebrow salt-eyebrow--copper">Inside</p>'
    + '<div class="salt-ledger salt-ledger--plain">'
    + row("home", "What you owe, and paying it") + row("prices", "Your prices, and ordering") + row("orders", "Each order, and its messages")
    + "</div></div>"
    /* an app's own browser keeps nothing once it closes: the phone's own menu mark, and where to go */
    + '<p class="salt-insight" id="linkInapp" hidden>'
    + '<span id="inappIos">This app keeps nothing once you close it. Tap ' + glyphSvg("dots", 20)
    + " and choose to open this page in <b>Safari</b>, then tap Continue there.</span>"
    + '<span id="inappDroid" hidden>This app keeps nothing once you close it. Tap ' + glyphSvg("vdots", 20)
    + " and choose to open this page in <b>Chrome</b>, then tap Continue there.</span></p>"
    + '<button class="btn salt-ghost" id="linkCopy" type="button" hidden>Copy the link</button>'
    + '<button class="btn salt-pill salt-pill--md" id="linkGo" type="button">Continue</button>'
    + '<p class="msg" id="linkMsg" role="status" aria-live="polite"></p>'
    + '<p class="sub2 center" id="linkOnce">The link works once. Not your <span class="dev">phone</span>? Close this page and nothing is used.</p>'
    + "</div>";
}

export function boardPage(guest, nonce) {
  const b = (guest && guest.prices) || {};
  const products = Array.isArray(b.products) ? b.products : [];
  const week = (b.week && b.week.label) || "";
  const rm = (n) => "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const body = products.length
    ? products.map((p) => '<div class="pane">'
        + '<h3 class="pmark" aria-label="' + esc(PSHAPE[String(p.product || "").toLowerCase()] || PSHAPE._) + '">' + psymSvg(p.product, 30) + "</h3>"
        /* v787: a level is never named on a pane, on any book (his instruction, 22 Sep 2026). The board
           carries no name since v787, and this line draws none, so a name that reaches it is not drawn either. */
        + (p.fellBack ? '<p class="sub2">The only price for this product</p>' : "")
        + '<div class="tblw"><table><thead><tr><th class="l">Size</th><th>Price</th></tr></thead><tbody>'
        + p.sizes.map((r) => "<tr><td class=\"l\">" + esc(unitsOf(r.q, p.unit))
            + "</td><td>" + esc(rm(r.price)) + "</td></tr>").join("")
        + "</tbody></table></div></div>").join("")
    : '<p class="lead">No price list has been written yet.</p>';
  return guestPage("<h2>Price list</h2>"
    + '<p class="lead">' + (week ? "For the week of " + esc(week) + ". " : "")
    + "The price is for the goods. " + DELIVERY + " "
    + "Ask about any size that is not listed.</p>"
    + body
    /* S8 8.2: A STRANGER IS TOLD WHAT TO DO NEXT, in words and with no brand. The board is all they
       have, and it named no way to order. */
    + '<p class="lead">To order, reply to the person who sent you this link.</p>', nonce, "Price list");
}
/* S8 8.2: EVERY SHUT LINK ANSWERS THIS, WORD FOR WORD. Unknown, malformed, withdrawn, declined and
   waiting ids all get it, in the board's own look, so the door tells a stranger nothing about which
   it was and never leaves them on a bare "Not found". Its tab says so too, one title for every kind. */
export function shutPage(nonce) {
  return guestPage("<h2>This link is not open</h2>"
    + '<p class="lead">Ask the person who sent it to you.</p>', nonce, "Link not open");
}
/* S13 13.1, HIS DECISION D12 OF 24 SEP 2026: EVERY PAGE OF THE COUNTER IS KEPT OUT OF THE TRANSLATOR. On a phone set
   to Malay or Chinese, Chrome offers to translate a page, and accepting sends what is on it, an opened statement
   included, to a translation service. translate="no" on the root and Google's notranslate say no for every page:
   the customer's, a guest board, a shut link and Salt Admin. */
const DOC_OPEN = '<!DOCTYPE html>\n<html lang="en" translate="no"><head><meta charset="utf-8">'
  + '<meta name="google" content="notranslate">';
function guestPage(inner, nonce, title) {
  return DOC_OPEN
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + '<meta name="referrer" content="no-referrer">'
    + "<title>" + title + "</title>"
    + '<style nonce="' + nonce + '">' + FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES + PAGE_CSS + "</style></head><body>"
    + '<div class="panel">' + inner + "</div></body></html>";
}

/** The landing page. `user` is the normalised username to prefill, or "". `nonce` ties the
    inline style and script to the CSP.

    `owner`, when given, is {master, accounts:[{code,username}]} and turns the same page into the
    owner's own: the roster stands where the gate does, and a tap fills the username and the master
    into the form the customer uses and submits it. His instruction of 10 Sep 2026, and the reason
    it is this rather than a second page is that everything past the door -- the issue strip, the
    statement, the prices, the lock -- is then the customer's own code, opened the customer's own
    way. Only the door changes. The route that serves this is behind Cloudflare Access and verifies
    the token itself; see stmt/access.js. */
/* the bulletin band (20 Sep 2026): the first thing in the body, above the door and the bar alike, and
   hidden until there is a line to show; running joins the lines as one track, changing starts on the first */
function bulletinBand(b) {
  const lines = (b && Array.isArray(b.lines)) ? b.lines : [];
  const mode = (b && b.mode === "change") ? "change" : "run";
  return '<div id="bull" class="bull" data-mode="' + mode + '"' + (lines.length ? "" : " hidden") + ' role="status" aria-live="polite">'
    + '<div class="track" id="bullTrack">' + esc(mode === "run" ? lines.join("  ·  ") : (lines[0] || "")) + "</div>"
    /* 24 Sep 2026: what a screen reader is told while the lines change, once, instead of a new line every four seconds */
    + '<span class="sr" id="bullSr"></span></div>';
}
/* S9 9.2: SALT ADMIN'S PLACES AND ITS FILTERS. The icons are drawn here, stroked like the product marks,
   and loaded from nowhere; the key is the ring with a keyhole its home-screen icon carries (9.7). */
const ADMIN_PLACES = [["needs", "Needs you"], ["accounts", "Accounts"], ["links", "Links"], ["more", "More"]];
const ADMIN_FILTERS = [["all", "All"], ["unsent", "Not sent"], ["unopened", "Not opened"], ["owes", "Owes"], ["locked", "Refused"], ["none", "No account"]];
const ADMIN_ICONS = {
  needs: '<path d="M3.8 13 L6.5 5 H17.5 L20.2 13 V19.5 H3.8 Z M3.8 13 H8.6 L9.9 15.6 H14.1 L15.4 13 H20.2"/>',
  accounts: '<circle cx="9" cy="8.6" r="3.2"/><path d="M3.4 19.6 C4.2 16.4 6.4 14.8 9 14.8 C11.6 14.8 13.8 16.4 14.6 19.6 M15.2 5.6 A3 3 0 0 1 15.4 11.6 M17.4 14.9 C19 15.6 20.1 17.2 20.6 19.6"/>',
  links: '<path d="M10.2 13.8 L13.8 10.2 M8.6 11.4 L6.7 13.3 A3.3 3.3 0 0 0 11.4 18 L13.3 16.1 M10.7 7.9 L12.6 6 A3.3 3.3 0 0 1 17.3 10.7 L15.4 12.6"/>',
  more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  desk: '<rect x="3.4" y="5" width="17.2" height="11.6" rx="1.6"/><path d="M9 19.6 H15 M12 16.6 V19.6"/>',
  key: '<circle cx="12" cy="12" r="7.4"/><circle cx="12" cy="10.6" r="1.7"/><path d="M11.3 12.1 L10.8 15.2 H13.2 L12.7 12.1"/>'
};
const aico = (n) => '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" '
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ADMIN_ICONS[n] + "</svg>";
export function landingPage(user, nonce, owner, bulletin) {
  const u = esc(user || "");
  return DOC_OPEN
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + '<meta name="referrer" content="no-referrer">'
    /* v693: saved as an app. The name and the icon say what the page is and never whose it is. */
    /* 19 SEP 2026, HIS INSTRUCTION: he wants the admin page reachable from the phone's home screen.
       A standalone app has NO ADDRESS BAR, so from inside Salt Counter there is no way to reach /all
       at all. `start_url` resolves against the MANIFEST'S own url, so the customer manifest served at
       the root opens at the root however he saved it: saving from /all would have given him the
       customer door under another name. His own page therefore links its own manifest, which lives
       behind Access with the rest of the prefix and opens where he saved it from. */
    /* 24 SEP 2026: A MANIFEST IS FETCHED WITHOUT COOKIES unless the link asks for them, so behind
       Access his own came back refused and the phone saved a page with no name. use-credentials on
       his route alone; the customer's manifest is public and its link is left as it was. */
    + (owner ? '<link rel="manifest" href="/all/manifest.webmanifest" crossorigin="use-credentials">'
      : '<link rel="manifest" href="/manifest.webmanifest">')
    + '<link rel="apple-touch-icon" href="' + (owner ? "/icon-key.png" : "/icon.png") + '">'
    + '<meta name="theme-color" content="#05080a">'
    + '<meta name="apple-mobile-web-app-capable" content="yes">'
    + '<meta name="mobile-web-app-capable" content="yes">'
    + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
    /* his page is Salt Admin, as its manifest says; the customer's is Salt Counter */
    + '<meta name="apple-mobile-web-app-title" content="' + (owner ? "Salt Admin" : "Salt Counter") + '">'
    + "<title>" + (owner ? "Salt Admin" : "Salt Counter") + "</title>"
    + '<style nonce="' + nonce + '">' + FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES + PAGE_CSS + "</style></head><body>"
    + bulletinBand(bulletin)
    + (owner
      ? '<div id="roster" class="gate adm">'
        /* S9 9.2: HIS PLACES, the phone's App bar and, from 1080px, the Desk rail the bar gives way to (the
           system's own switch): Needs you, Accounts, Links, More. A count beside a place is what waits there. */
        + '<nav class="salt-rail salt-appbar__rail" aria-label="Salt Admin">'
        + '<div class="salt-rail__brand"><span class="aring">' + aico("key") + '</span><b class="salt-title">Salt Admin</b></div>'
        + '<div class="salt-rail__group">' + ADMIN_PLACES.map(([m, w]) => '<button type="button" class="salt-rail__tab salt-rail__tab--solo place" data-m="' + m + '">'
          + '<span class="salt-appbar__place"><span class="salt-appbar__icon">' + aico(m) + "</span><span>" + w + "</span></span>"
          + '<span class="salt-rail__count" data-count="' + m + '"></span></button>').join("") + "</div>"
        + '<div class="salt-rail__foot" id="mFoot"></div></nav>'
        + '<div class="amain">'
        /* S9 9.1: his home is Needs you, one card a thing with its action on it (stmt/owner.js) */
        + '<div id="mHome">'
        + '<p class="salt-eyebrow salt-eyebrow--copper">Salt Admin</p>'
        + "<h1>Needs you</h1>"
        + '<p class="lead" id="nCount">Reading what needs you.</p>'
        /* S9 fix: from 1080px the list stands beside the account a card is about, as Accounts does */
        + '<div class="nsplit"><div>'
        + '<div id="nlist" class="nlist"></div>'
        /* S9 9.8: what waits on the desk, as the desk last told this site: a count, no link and no name */
        + '<p class="nwait" id="nDesk" hidden>' + aico("desk") + '<span id="nDeskT"></span></p>'
        + '</div><div id="nopen" hidden></div></div>'
        + "</div>"
        /* S9 9.2: ACCOUNTS, one list for what Send and Review were: found by a word, narrowed by a filter, and a
           row opens the account beside the list from 1080px, in its place below it on a phone */
        + '<div id="oAccts" hidden>'
        + '<p class="salt-eyebrow salt-eyebrow--copper">Salt Admin</p>'
        + "<h1>Accounts</h1>"
        + '<p class="lead" id="scount"></p>'
        + '<div class="afind">'
        + '<input class="fld salt-field__input salt-field__input--mono" id="rq" type="search" autocapitalize="none" autocorrect="off" '
        + 'spellcheck="false" placeholder="A code or a username" aria-label="Find an account">'
        + '<div class="afil" id="afil" role="group" aria-label="Show only">' + ADMIN_FILTERS.map(([f, w], k) =>
          '<button type="button" class="salt-ghost" data-f="' + f + '" aria-pressed="' + (k ? "false" : "true") + '">' + w + "</button>").join("") + "</div>"
        + "</div>"
        + '<div class="asplit"><div id="rlist" class="alist"></div><div id="aopen" hidden></div></div>'
        + "</div>"
        + '<div id="oLinks" hidden>'
        + "<h1>Guest links</h1>"
        + '<p class="lead">A link shows one board and nothing else: no statement, no '
        + "order, no account. The id in the link is what opens it, so it is the key.</p>"
        + '<p class="lead">Name the customer introducing them and the prices follow that customer: '
        + "two levels above theirs where there is room, and never past the board every stranger sees. "
        + "Move that customer up and every link they gave out moves with them.</p>"
        + '<label class="lbl" for="gintro">Who is introducing them</label>'
        + '<input class="fld salt-field__input" id="gintro" type="text" maxlength="20" autocapitalize="off" '
        + 'spellcheck="false" placeholder="their username" aria-label="The username of the customer introducing them">'
        + '<label class="lbl" for="glabel">Who it is for</label>'
        + '<input class="fld salt-field__input" id="glabel" type="text" maxlength="60" '
        + 'placeholder="a shop, a name, a note" aria-label="Who the link is for">'
        + '<button class="btn salt-pill salt-pill--md" type="button" id="gmake">Make a link</button>'
        + '<div id="glist"></div>'
        + "</div>"
        + '<div id="oMore" hidden>'
        + '<p class="salt-eyebrow salt-eyebrow--copper">Salt Admin</p>'
        + "<h1>More</h1>"
        + '<p class="lead" id="mCount">' + owner.accounts.filter((a) => !a.test).length + " accounts on the site.</p>"
        + '<div class="rlist" id="mItems">'
        + '<button type="button" data-m="cards">Associates report card'
        + "<span>what each has brought you, and what they have earned</span></button>"
        + "</div>"
        + '<div id="mTest" class="mtest"></div>'
        + "</div>"
        + '<div id="oCards" hidden>'
        + '<button type="button" data-back="more">' + "← More" + "</button>"
        + "<h1>Associates report card</h1>"
        + '<p class="lead" id="ccount"></p>'
        + '<div id="clist"></div>'
        + "</div>"
        + '<p class="msg" id="rmsg" role="status" aria-live="polite"></p></div>'
        + '<nav class="salt-appbar" aria-label="Salt Admin">' + ADMIN_PLACES.map(([m, w]) => '<button type="button" class="salt-appbar__item place" data-m="' + m + '">'
          + '<span class="salt-appbar__icon">' + aico(m) + '</span><span class="salt-appbar__label">' + w + "</span>"
          + '<span class="salt-appbar__count" data-count="' + m + '"></span></button>').join("") + "</nav>"
        + "</div>"
        /* S9 9.7, his D13: what his page becomes when the Access session behind it has ended */
        + '<div id="aEnded" class="gate" hidden><h1>Your admin sign-in has ended</h1>'
        + '<p class="lead">Sign in again to carry on.</p>'
        + '<a class="salt-pill salt-pill--md btn" href="/all">Sign in again</a></div>'
      : "")
    + '<div id="gate" class="gate"' + (owner ? " hidden" : "") + ">"
    + "<h1>Sign in</h1>"
    + '<p class="lead">With the username and password we sent you.</p>'
    /* S3 3.7, HIS D3 OF 24 SEP 2026: ONE FIELD FOR EACH SECRET, named as a password manager reads them, so one can
       fill the door; the six boxes of 16 Sep could not be filled by anything but fingers */
    + '<div id="doorBox"><form id="f" novalidate>'
    + '<div class="salt-field"><label class="salt-field__label" for="un">Username</label>'
    + '<input class="fld salt-field__input salt-field__input--mono" id="un" name="username" type="text" value="' + u + '" '
    + 'autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="unHint">'
    + '<span class="salt-field__hint" id="unHint">Two groups of four, like abcd-efgh.</span></div>'
    + '<div class="salt-field"><label class="salt-field__label" for="pw">Password</label>'
    + '<div class="pwrow"><input class="fld salt-field__input salt-field__input--mono" id="pw" name="password" type="password" '
    + 'autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="pwHint">'
    + '<button class="salt-ghost" id="pwShow" type="button" aria-pressed="false" aria-controls="pw">Show</button></div>'
    + '<span class="salt-field__hint" id="pwHint">Pasting the whole message works: we keep only the password.</span></div>'
    /* v692: remembering, in the words the link uses (S3 3.7) */
    + '<label class="rem" for="rem"><input type="checkbox" id="rem" checked>'
    + '<span>Keep me signed in on this <span class="dev">phone</span></span></label>'
    + '<button class="btn salt-pill salt-pill--md" id="go" type="submit">Sign in</button>'
    + "</form>"
    + '<p class="msg" id="msg" role="status" aria-live="polite"></p>'
    /* S3 fix: a remembered phone the site could not open just now tries again from here, which a saved app with no
       reload needs */
    + (owner ? "" : '<button class="btn salt-ghost" id="remAgain" type="button" hidden>Try again</button>')
    /* S3 3.11: a code from another device, or from Salt Admin at the counter. S3 fix: both inside the form's box, so
       the signed-out Sheet carries them with it */
    + (owner ? "" : '<button class="btn salt-ghost" id="toCode" type="button">I have a sign-in code</button>')
    + '<p class="salt-insight">Lost your password or your link? Ask us for a <b>new sign-in link</b>. It works straight away.</p>'
    + "</div></div>"
    + (owner ? "" : linkScreen() + codeScreen() + signedOutSheet() + replaceAsk() + keepSheet())
    + '<div id="barw" hidden><div class="bar">'
    /* S9 9.5: on his page an account is viewed, never signed into, so the bar says whose it is and that it is
       read only, and its one control takes him back to that account on Accounts */
    + '<span><b id="whoacct"></b><span id="cd"></span>' + (owner ? '<span id="vas">Viewing as <b id="vasU"></b>, read only</span>' : "") + "</span>"
    + '<button type="button" id="lock">' + (owner ? "Back to accounts" : "Log out") + "</button>"
    /* S1 1.5: a lapsed session says so where the reader is, with the one way back: a second row of the bar */
    + '<div id="lapse" class="lapse" role="alert" hidden><span id="lapseT"></span><button type="button" id="lapseGo">Continue</button></div>'
    + "</div></div>"
    + '<div id="tabs" class="tabs salt-tabs" role="tablist" hidden>'
    + '<button type="button" class="salt-tabs__pill on" role="tab" aria-selected="true" data-t="stmt">Statements</button>'
    + '<button type="button" class="salt-tabs__pill" role="tab" aria-selected="false" data-t="prices" id="tPrices">Prices</button>'
    + '<button type="button" class="salt-tabs__pill" role="tab" aria-selected="false" data-t="order" id="tOrder">Order</button>'
    /* v706: the associate's own card. Hidden for everybody else, and shown only once the record
       that opened actually carries one, so the tab can never lead to an empty panel. */
    + '<button type="button" class="salt-tabs__pill" role="tab" aria-selected="false" data-t="card" id="tCard" hidden>Card</button>'
    + "</div>"
    + '<div id="pStmt">' + (owner ? "" : keepCard())
    /* S7 7.3: ACCOUNT, what drawAccount(el) puts in a place: the statement with its one month filter (placed
       beside the list it filters), the earlier statements at its foot, and This device beside it from 1080px */
    + '<div id="acct" class="acct"><div class="acct__main">'
    + '<div id="stmtBack" class="stmtback" hidden><p id="stmtBackT"></p>'
    + '<button type="button" class="salt-ghost" id="stmtBackGo">Back to your statement</button></div>'
    + '<div id="mfil" class="salt-tabs mfil" role="group" aria-label="Show one month" hidden></div><p class="mfnote" id="mfnote" role="status"></p>'
    + '<div id="out"></div>'
    + '<div id="stmtFoot" class="stmtfoot" hidden></div></div>'
    + (owner ? "" : thisDevice())
    + "</div></div>"
    + '<div id="pPrices" class="panel" hidden></div>'
    + '<div id="pOrder" class="panel" hidden></div>'
    + '<div id="pCard" class="panel" hidden></div>'
    + '<script nonce="' + nonce + '">'
    + CLIENT_JS.replace(/__POLL__/g, String(POLL_MS))
      /* the bulletin as the page was served, so the band is drawn with no request; the poll reads it again */
      .replace("__BULL__", JSON.stringify(bulletin || { lines: [], mode: "run" }).replace(/</g, "\\u003c"))
      .replace("__PAY_SITE__", JSON.stringify(PAY_SITE)).replace("__PAY_ACCOUNTS__", JSON.stringify(PAY_ACCOUNTS))
      /* v695: the product marks, so the page can draw one wherever it would have written a name */
      .replace("__PSYM__", JSON.stringify(Object.assign({ _: RING }, PSYM)))
      .replace("__PSHAPE__", JSON.stringify(PSHAPE)).replace("__MON3__", JSON.stringify(MON3))
      /* S4 4.6: the open-order limit the Worker refuses at, so the page can say it before the form */
      .replace("__MAX_OPEN__", String(MAX_OPEN)).replace("__OPEN_STATES__", JSON.stringify(OPEN_STATES))
      .replace("__DELIVERY__", () => JSON.stringify(DELIVERY))
      /* S4: the size in words, the same function a guest's board calls */
      .replace("/*__UNITS_OF__*/", () => String(unitsOf))
      /* "<" is escaped because this one carries the master passphrase, and a "</script>" inside a
         string literal ends the block wherever it appears: the browser closes the tag first and
         reads the rest of the passphrase as page text. */
      .replace("__OWNER__", JSON.stringify(owner || null).replace(/</g, "\\u003c"))
      /* v687: the owner's script travels only on his route. A function replacement, so nothing in
         it is read as a $ pattern. */
      .replace("/*__OWNER_JS__*/", () => (owner ? OWNER_JS : ""))
    + "</script>"
    + "</body></html>";
}

/* Kept as one string rather than a file so the whole page is a single Worker response with a
   single nonce, and so nothing about a statement is ever a fetchable asset. */
const CLIENT_JS = `
(function(){
  /* THE TICKET INVALIDATES A FLOW THAT IS NO LONGER WANTED (04 Sep 2026 audit). A submit takes
     about a second in PBKDF2, and go.disabled does not stop the Enter key submitting a form at
     all, so a reader who pressed Enter twice had two flows in the air. Measured: he taps Lock now,
     the page locks, and three seconds later the second response lands and puts the whole statement
     back on screen with the countdown restarted, on a phone he has put down. The same thing
     happened through the natural three-minute expiry. Every await below is followed by a ticket
     check, and lock() bumps the ticket, so anything still in flight lands on nothing. */
  var POLL_MS=__POLL__, bundle=null, at=0, ticket=0, busy=false;
  /* the bulletin (20 Sep 2026): drawn from what the page was served with, read again every sixth poll */
  var BULL=__BULL__, bullI=0, bullTimer=null, bullN=0;
  function bullDraw(b){
    BULL=b||{lines:[],mode:'run'};
    var box=document.getElementById('bull'), tr=document.getElementById('bullTrack'), sr=document.getElementById('bullSr'); if(!box||!tr||!sr) return;
    var lines=BULL.lines||[]; box.hidden=!lines.length; box.setAttribute('data-mode',BULL.mode==='change'?'change':'run');
    if(bullTimer){ clearInterval(bullTimer); bullTimer=null; }
    tr.removeAttribute('aria-hidden'); sr.textContent='';
    if(!lines.length){ tr.textContent=''; return; }
    if(BULL.mode==='change'){
      /* 24 Sep 2026: UNDER REDUCED MOTION THE LINES STAND STILL, all of them at once, as running does. And while they
         change, the changing line is hidden from the live region and every line is told to it once, so a screen
         reader is not read a new line every four seconds. */
      var still=lines.length<2||stillMotion();
      bullI=0; tr.textContent=still?lines.join('  ·  '):lines[0];
      if(!still){
        tr.setAttribute('aria-hidden','true'); sr.textContent=lines.join('  ·  ');
        bullTimer=setInterval(function(){ bullI=(bullI+1)%lines.length; tr.textContent=lines[bullI]; }, 4000);
      }
    } else {
      var t=lines.join('  ·  '); tr.textContent=t;
      tr.style.animationDuration=Math.max(12, Math.round(t.length/6))+'s';
    }
  }
  function stillMotion(){ try{ return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; } }
  async function bullRead(){
    try{
      var r=await fetch('/bulletin',{cache:'no-store'}); var j=await r.json();
      if(!j||!j.ok) return;
      var same=JSON.stringify(j.lines||[])===JSON.stringify(BULL.lines||[]) && (j.mode||'run')===(BULL.mode||'run');
      if(!same) bullDraw({lines:j.lines||[], mode:j.mode||'run'});
    }catch(e){}
  }
  window.bullDraw=bullDraw; window.bullRead=bullRead;   /* reachable from outside the closure, which is how the suite drives them */
  bullDraw(BULL);
  var PAY_SITE=__PAY_SITE__, PAY=__PAY_ACCOUNTS__;
  var session='', user='', prices=null, orders=[], poll=null, tab='stmt', draft={}, pick={};
  /* S3 3.5: the content key the account was opened with, so a return re-reads it without asking for anything */
  var curCk=null;
  /* v706: the associate's own card, opened from their record like the price list */
  /* cardMonth: null opens on the newest month, '' is All (24 Sep 2026: '' was both, so All showed the newest) */
  var card=null, cardMonth=null;
  /* v702: whether this account may order on behalf of a friend. It draws one tick and nothing
     else; where a row books is the desk's decision, and it checks it against its own roster. */
  var assoc=false;
  /* null for a customer; {master,accounts} for the owner, on the Access-gated route only */
  var OWNER=__OWNER__;
  /* S3: the device, read once. The words say phone on a phone and computer on anything else (nothing says phone
     on a laptop), in the markup's .dev words and in every line the script writes. */
  var UA=navigator.userAgent||'';
  var IOS=/iPhone|iPad|iPod/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  /* S3 fix: an iPad is called one, and its Safari's Share is not at the foot, so the Sheet's position line is left off */
  var IPAD=/iPad/.test(UA)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  var DEV=IPAD?'iPad':/Mobi|Android|iPhone|iPod/.test(UA)||IOS?'phone':'computer';
  /* already kept as an app: nothing teaches how to keep it (v693) */
  var STANDALONE=false;
  try{ STANDALONE=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true; }catch(e){}
  [].forEach.call(document.querySelectorAll('.dev'), function(x){ x.textContent=DEV; });
  /* 24 Sep 2026 (M22): an account he opened under the master is READ ONLY. It has no session, so its
     orders and links come from his own gated route, and nothing on it places, pays, sends or withdraws. */
  var view=false;
  var roster=document.getElementById('roster'), rq=document.getElementById('rq'),
      rlist=document.getElementById('rlist'), rmsg=document.getElementById('rmsg'),
      whoacct=document.getElementById('whoacct');
  var gate=document.getElementById('gate'), out=document.getElementById('out'),
      msg=document.getElementById('msg'), pw=document.getElementById('pw'),
      un=document.getElementById('un'), go=document.getElementById('go'),
      barw=document.getElementById('barw'), cd=document.getElementById('cd'),
      acctEl=document.getElementById('acct'), mfil=document.getElementById('mfil'), mfnote=document.getElementById('mfnote'),
      stmtFoot=document.getElementById('stmtFoot'), stmtBack=document.getElementById('stmtBack'),
      tabs=document.getElementById('tabs'),
      pStmt=document.getElementById('pStmt'), pPrices=document.getElementById('pPrices'),
      pOrder=document.getElementById('pOrder'), pCard=document.getElementById('pCard'),
      tCard=document.getElementById('tCard'),
      tPrices=document.getElementById('tPrices'), tOrder=document.getElementById('tOrder');
  /* ---- OVER THE LINE, THE ACCOUNT IS A PAYMENT PAGE (his instruction of 23 Sep 2026) ------------
     "If someone owes more than RM100, their account will only lead them to a payment page, which
     states: please pay the overdue amount before making another order." What they owe is sealed
     inside their own live statement (tools/make_statements.mjs), the same figure its footer reads,
     so nothing about the book is in the store in the clear to decide it with. Over the line, the
     account opens on Pay, the order form and the price list are not offered, and the statement
     stays one tap away, because a figure to pay is only fair beside the orders it is made of. It
     lifts on its own: the next publish after the payment is recorded writes a smaller figure. */
  var HOLD_RM=100, owedNow=0, hold=false;
  /* THE MESSAGE GOES WHERE THE READER IS LOOKING. #msg lives inside the gate, so on the owner's
     route, where the gate is hidden behind the roster, every "Checking..." and every refusal was
     written into a hidden element. Both are written; only one is on screen. */
  function say(t,cls){
    var m=(OWNER&&rmsg)?rmsg:msg;
    m.textContent=t||''; m.className='msg'+(cls?' '+cls:'');
  }
  var b64d=function(s){ var raw=atob(s), a=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i); return a; };
  /* the same normalisation the Worker applies: case and punctuation are forgiven */
  function norm(s){ s=String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    return s.length===8 ? s.slice(0,4)+'-'+s.slice(4) : ''; }

  /* ---- THE DOOR: ONE FIELD FOR EACH SECRET (S3 3.7, his D3 of 24 Sep 2026) --------------------------------
     A password manager fills them by their names; Show unmasks the password; a paste keeps only what the field
     takes, so pasting the whole message into the password keeps the password and nothing else; and a symbol the
     alphabet never uses is caught on this phone before anything is sent, which says nothing about any account.
     Every refusal from the site is still its one answer. The owner's roster fills the same two fields with the
     master; only his page sends it as one, so the master still cannot be typed at a customer's door. */
  function clean(t){ return String(t||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
  /* v695: A PRODUCT IS A MARK, NOT A WORD (his instruction, 18 Sep 2026). Drawn, never written,
     and never labelled either: naming it in aria would put the word back for half the readers. */
  var PSYM=__PSYM__, PSHAPE=__PSHAPE__;
  function pshape(product){ return PSHAPE[String(product||'').toLowerCase()]||PSHAPE._; }
  function psym(product,px){
    var NS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('width',px); svg.setAttribute('height',px);
    svg.setAttribute('class','psym'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');
    var d=document.createElementNS(NS,'path');
    d.setAttribute('d',PSYM[String(product||'').toLowerCase()]||PSYM._);
    d.setAttribute('fill','none'); d.setAttribute('stroke','currentColor'); d.setAttribute('stroke-width','1.4');
    d.setAttribute('stroke-linejoin','round'); d.setAttribute('stroke-linecap','round');
    svg.appendChild(d); return svg;
  }
  /* a size and its mark, as one phrase: "2.5 unit" then the cube */
  function withMark(product,text,px){
    var w=el('span','pwith'); w.appendChild(document.createTextNode(text));
    w.appendChild(psym(product,px||18));
    var sr=el('span','sr',pshape(product)); w.appendChild(sr);
    return w;
  }
  var ALPHA=/[^23456789abcdefghjkmnpqrstvwxyz]/;
  var UN_IN=/(?:^|[^a-z0-9_-])([a-z0-9]{4})[- ]([a-z0-9]{4})(?![a-z0-9_-])/;
  var PW_IN=/(?:^|[^a-z0-9_-])([a-z0-9]{4})[- ]([a-z0-9]{4})[- ]([a-z0-9]{4})[- ]([a-z0-9]{4})(?![a-z0-9_-])/;
  /* a username or a password in the form it was sent in, or '' when the text holds none. S3 fix: the first group of
     the right shape that the alphabet allows, so words of four letters in a message ("Your Salt") are passed over */
  function shaped(t, n){
    var low=String(t||'').toLowerCase(), re=new RegExp((n===8?UN_IN:PW_IN).source,'g'), m, first='', raw='';
    while((m=re.exec(low))){
      var got=m.slice(1).join('');
      if(!first) first=got;
      if(/^0+$/.test(got)||!ALPHA.test(got)){ raw=got; break; }
      re.lastIndex=m.index+1;
    }
    raw=raw||first||clean(low);
    return raw.length===n?raw.match(/.{4}/g).join('-'):'';
  }
  function canonPass(t){ return shaped(t,16)||String(t||'').trim(); }
  [[un,8],[pw,16]].forEach(function(f){
    f[0].addEventListener('paste', function(ev){
      if(OWNER) return;
      var cd=ev.clipboardData||window.clipboardData, got=shaped(cd&&cd.getData('text'), f[1]);
      if(!got) return;
      ev.preventDefault();
      f[0].value=got; f[0].removeAttribute('aria-invalid'); f[0].classList.remove('salt-field__input--error');
      if(f[0]===un) try{ pw.focus(); }catch(e){}
    });
    f[0].addEventListener('input', function(){ f[0].removeAttribute('aria-invalid'); f[0].classList.remove('salt-field__input--error'); });
  });
  var pwShow=document.getElementById('pwShow');
  function showPw(on){ pw.type=on?'text':'password'; pwShow.setAttribute('aria-pressed',on?'true':'false'); pwShow.textContent=on?'Hide':'Show'; }
  pwShow.addEventListener('click', function(){ showPw(pw.type==='password'); try{ pw.focus(); }catch(e){} });
  /* what this phone can say about a value before it is sent: that one of the right length holds a symbol the
     alphabet never uses, which is a typing slip and never a fact about an account. Anything else goes to the site
     and its one answer. The test account's zeros are its own (v689). */
  function unfit(v, n, what){
    var raw=clean(v);
    return raw.length===n&&!/^0+$/.test(raw)&&ALPHA.test(raw)?'A '+what+' never uses 0, 1, i, l, o or u. Check the symbols you typed.':'';
  }

  function el(tag,cls,text){ var e=document.createElement(tag); if(cls)e.className=cls; if(text!=null)e.textContent=text; return e; }
  function rm(n){ return 'RM '+Number(n||0).toLocaleString('en-MY',{minimumFractionDigits:0,maximumFractionDigits:2}); }
  /* D11 (S4, 24 Sep 2026): units above one, unit at one and under */
  /*__UNITS_OF__*/

  /* THE PASSWORD UNWRAPS A KEY, AND THE KEY OPENS EVERYTHING. The same derivation the vault
     uses, PBKDF2-SHA256 x150000 into AES-GCM-256, but over the wrap rather than the content:
     the content key comes out of the wrap, and the monthly bundle, the live document and the
     price list are all sealed under it. The master passphrase holds a second wrap of the same
     key. A mismatch anywhere here is indistinguishable from a wrong password, which is why the
     round trip is tested rather than eyeballed. */
  async function unwrap(pass, w){
    var base=await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    var kek=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(w.salt),iterations:150000,hash:'SHA-256'},
      base, {name:'AES-GCM',length:256}, false, ['decrypt']);
    var raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(w.iv)}, kek, b64d(w.ct));
    /* v692: extractable, because Remember me wraps this key under the device's own key. It is no
       weaker: a script that can reach this key can already decrypt everything it opens. */
    return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, true, ['decrypt']);
  }
  async function open(ck, blob){
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(blob.iv)}, ck, b64d(blob.ct));
    return new TextDecoder().decode(pt);
  }
  /* S4 4.4: THE PRICE LIST KEEPS THE KEY THAT OPENED IT, unenumerable, so a Place answered "prices moved" can open the
     list that came back with it in the same breath; it goes with the list, so signing out forgets both */
  async function openList(ck, blob){
    var l=JSON.parse(await open(ck, blob));
    if(l&&typeof l==='object') Object.defineProperty(l,'_k',{value:ck});
    return l;
  }
  /* a moment in Kuala Lumpur, in parts: the month is read off MON3, never off en-GB's own short month */
  var MON3=__MON3__;
  function klBits(iso){
    var p={};
    new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'numeric',year:'numeric',
      hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).forEach(function(x){ p[x.type]=x.value; });
    return p;
  }
  function stamp(iso){
    try{ var p=klBits(iso); return p.day+' '+MON3[+p.month-1]+', '+p.hour+':'+p.minute; }catch(e){ return ''; }
  }

  /* ---- REMEMBER ME (v692) --------------------------------------------------------------------
     The device key lives in this browser and the wrap of the content key lives on the site: one
     without the other opens nothing, and the password is kept nowhere. Every read and write is
     guarded, because a private window throws on the first touch of localStorage. */
  var REM='salt-stmt-remember';
  function remGet(){ try{ var s=localStorage.getItem(REM); return s?JSON.parse(s):null; }catch(e){ return null; } }
  function remSet(v){ try{ localStorage.setItem(REM, JSON.stringify(v)); }catch(e){ /* nothing is remembered, and the page still works */ } }
  function remClear(){ try{ localStorage.removeItem(REM); }catch(e){} }
  function b64e(buf){ var a=new Uint8Array(buf), s=''; for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]); return btoa(s); }
  async function wrapUnder(keyBytes, ck){
    var raw=await crypto.subtle.exportKey('raw', ck);
    var salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
    var base=await crypto.subtle.importKey('raw', keyBytes, 'PBKDF2', false, ['deriveKey']);
    var kek=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:150000,hash:'SHA-256'},
      base, {name:'AES-GCM',length:256}, false, ['encrypt']);
    var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv}, kek, raw);
    return {v:2, salt:b64e(salt), iv:b64e(iv), ct:b64e(ct)};
  }
  async function unwrapUnder(keyBytes, w){
    var base=await crypto.subtle.importKey('raw', keyBytes, 'PBKDF2', false, ['deriveKey']);
    var kek=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(w.salt),iterations:150000,hash:'SHA-256'},
      base, {name:'AES-GCM',length:256}, false, ['decrypt']);
    var raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(w.iv)}, kek, b64d(w.ct));
    /* S3 3.4: extractable, as the password's is, because the link and the code remember the phone by wrapping
       this key under the device's own */
    return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, true, ['decrypt']);
  }
  async function remember(u, ck){
    if(!session) return;
    try{
      var key=crypto.getRandomValues(new Uint8Array(32));
      var wrap=await wrapUnder(key, ck);
      var r=await fetch('/remember', {method:'POST',
        headers:{'content-type':'application/json','X-Stmt-Session':session}, body:JSON.stringify({wrap:wrap})});
      var j=await r.json();
      if(r.ok&&j.ok&&j.token){
        var was=remGet();
        remSet({t:j.token, k:b64e(key), u:u});
        /* S3 3.8: what this phone remembered before is gone from it, so its wrap goes from the site as well; S3 fix: and,
           for another account, this phone's alerts for it, or a phone handed over kept waking for the account it replaced */
        if(was&&was.t&&was.t!==j.token){
          var ep=null;
          if(was.u!==u){ try{ var sub=await phoneSub(); ep=sub?sub.endpoint:null; }catch(e){} }
          fetch('/logout',{method:'POST', headers:{'content-type':'application/json'},
            body:JSON.stringify({token:was.t, endpoint:ep})}).catch(function(){});
        }
      }
    }catch(e){ /* not remembered; the password still opens it */ }
  }
  /* ---- KEEP IT ON YOUR HOME SCREEN (S3 3.10, his D2) ------------------------------------------------------
     A signed-in iPhone mints a one-use key and its eight-symbol code as the Sheet opens (POST /handover, the
     content key wrapped under the key), so the Copy tap copies and does nothing else: no derivation and no fetch
     sits between the tap and the clipboard. The same tap rewrites the address to /app#<key>, so a saved app that
     keeps the address signs itself in; one that does not takes the key by Paste, or the code typed. */
  var keepCardEl=document.getElementById('keepCard'), keepSheetEl=document.getElementById('keepSheet'),
      keepScrim=document.getElementById('keepScrim'), keepCode=document.getElementById('keepCode'),
      keepCopy=document.getElementById('keepCopy'), keepMsg=document.getElementById('keepMsg');
  var keepTok='', keepN=0, keepMinted=[];   /* S3 fix: every key this page minted, for Log out to burn */
  /* S3 3.12: WHERE THE BROWSER OFFERS AN INSTALL, ONE BUTTON TAKES IT (beforeinstallprompt; the app it installs
     shares this browser's storage, so it opens signed in). Where it does not, Samsung Internet's own steps are drawn,
     and a computer's Chrome or Edge is pointed at the install mark in its address bar; nothing says phone there. */
  var bip=null;
  var SAMSUNG=/SamsungBrowser/.test(UA), ANDROID=/Android/.test(UA), DESKTOP=!IOS&&!/Mobi|Android/.test(UA), CHROMIUM=/Chrome[/]|Chromium|Edg[/]/.test(UA);
  function keepMode(){
    if(INAPP||STANDALONE||OWNER||view||!session) return '';
    return IOS?'ios':bip?'install':SAMSUNG?'samsung':(DESKTOP&&CHROMIUM)?'desk':ANDROID?'droid':'';
  }
  function drawKeep(){
    if(!keepCardEl) return;
    var mode=keepMode();
    keepCardEl.hidden=!mode;
    if(!mode) return;
    document.getElementById('keepHead').textContent=IOS||DEV==='phone'?'Keep it on your Home Screen':'Keep it as an app';
    document.getElementById('keepWhere').hidden=IPAD;
    document.getElementById('keepGo').hidden=mode!=='ios';
    document.getElementById('keepInstall').hidden=mode!=='install';
    document.getElementById('keepSam').hidden=mode!=='samsung';
    document.getElementById('keepDesk').hidden=mode!=='desk';
    document.getElementById('keepDroid').hidden=mode!=='droid';
  }
  window.addEventListener('beforeinstallprompt', function(ev){ ev.preventDefault(); bip=ev; drawKeep(); drawDevice(); });
  window.addEventListener('appinstalled', function(){ bip=null; if(keepCardEl) keepCardEl.hidden=true; drawDevice(); });
  function ksay(t,cls){ keepMsg.textContent=t||''; keepMsg.className='msg'+(cls?' '+cls:''); }
  async function mintKeep(){
    var n=++keepN;
    keepCopy.disabled=true; keepCode.value=''; ksay('Making your code...','wait');
    try{
      var tok=b64e(crypto.getRandomValues(new Uint8Array(24))).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/=+$/,'');
      var wrap=await wrapUnder(new TextEncoder().encode(tok), curCk);
      var r=await api('/handover',{token:tok, wrap:wrap});
      if(n!==keepN||keepSheetEl.hidden) return;
      if(r.status===503){ ksay('Saving it as an app is not switched on yet. Ask us, and sign in inside the new app meanwhile.','bad'); return; }
      if(!r.body.ok||!r.body.code){ ksay(r.status===401?r.body.error:'The code could not be made just now. Close this and open it again.','bad'); return; }
      keepTok=r.body.token||tok; keepMinted=keepMinted.concat(keepTok).slice(-10);
      keepCode.value=String(r.body.code).toUpperCase().replace('-',' ');
      keepCopy.disabled=false; ksay('');
    }catch(e){ if(n===keepN) ksay('The code could not be made just now. Close this and open it again.','bad'); }
  }
  /* S3 fix, 24 Sep 2026: EVERY OPENING MINTS AFRESH. A code the saved app had already spent was shown and copied again
     for up to fourteen minutes, while the app said to make a new one; closing forgets it here (a copy already made
     still works in the app for its fifteen minutes) */
  var keepFrom=null;   /* S7: the control that opened it, the card's or This device's, takes the focus back */
  function openKeep(from){
    if(!keepSheetEl||!curCk) return;
    keepFrom=from&&from.nodeType===1?from:null;
    keepScrim.hidden=false; keepSheetEl.hidden=false;
    try{ keepSheetEl.focus(); }catch(e){}
    mintKeep();
  }
  function closeKeep(){
    if(!keepSheetEl||keepSheetEl.hidden) return;
    keepSheetEl.hidden=true; keepScrim.hidden=true; keepN++;
    keepTok=''; keepCode.value=''; keepCopy.disabled=true; ksay('');
    try{ (keepFrom||document.getElementById('keepGo')).focus(); }catch(e){}
  }
  /* the browser's own question, asked inside the tap; it can be asked once, so the event is spent here */
  function keepInstallGo(){
    if(!bip) return;
    var e=bip; bip=null;
    try{ e.prompt(); }catch(x){ drawKeep(); drawDevice(); return; }
    Promise.resolve(e.userChoice).then(function(c){ if(c&&c.outcome==='accepted') keepCardEl.hidden=true; else drawKeep(); drawDevice(); }, function(){ drawKeep(); drawDevice(); });
  }
  if(keepSheetEl){
    document.getElementById('keepGo').addEventListener('click', function(){ openKeep(); });
    document.getElementById('keepInstall').addEventListener('click', keepInstallGo);
    document.getElementById('keepX').addEventListener('click', closeKeep);
    keepScrim.addEventListener('click', closeKeep);
    document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeKeep(); });
    keepCopy.addEventListener('click', function(){
      if(!keepTok) return;
      /* the tap's first act, before anything that waits: Safari allows a copy only inside the tap itself */
      var done=null;
      try{ done=navigator.clipboard.writeText(keepTok); }catch(e){ done=Promise.reject(e); }
      try{ history.replaceState(null,'','/app#'+keepTok); }catch(e){}
      Promise.resolve(done).then(function(){ ksay('Copied. Now tap the marks above, then open the new icon and paste.'); },
        function(){ ksay('Copy failed. Type the code in the new app instead.','bad'); });
    });
  }

  /* ---- ONE STEP TO FINISH: THE SAVED APP TAKES THE SIGN-IN ACROSS (S3 3.11, his D2) -------------------------
     /app is where the saved app starts, with storage of its own. A remembered phone opens as ever; otherwise the key
     Safari copied comes by Paste (or in the address, where iOS kept it), or the eight symbols are typed, and
     POST /handover/open answers what a sign-in link answers, the content key wrapped under the key. On success the
     app is remembered, with the same split key as everywhere else, so this is done once. */
  var APP=location.pathname==='/app';
  var codeBox=document.getElementById('codeBox'), codeIn=document.getElementById('codeIn'), codeMsg=document.getElementById('codeMsg');
  var TOK_RE=/^[A-Za-z0-9_-]{20,64}$/, codeIos=false;
  function csay(t,cls){ if(codeMsg){ codeMsg.textContent=t||''; codeMsg.className='msg'+(cls?' '+cls:''); } }
  function showCode(fromDoor){
    if(!codeBox) return;
    gate.hidden=true; if(opening) opening.hidden=true; codeBox.hidden=false;
    /* the words fit the road: the saved iPhone app is told the true way to get a code; a browser is not told about Safari */
    var ios=codeIos=IOS&&!fromDoor;
    document.getElementById('codeH').textContent=ios?'One step to finish':'Sign in with a code';
    document.getElementById('codeLead').textContent=ios?'Bring your sign-in across from Safari. You do this once on this '+DEV+'.'
      :'Type the eight letters and numbers you were given. A code works once.';
    document.getElementById('codeHint').textContent=ios?'Eight letters and numbers, as Safari showed them.':'Eight letters and numbers, in two groups of four.';
    document.getElementById('codeHelp').hidden=!ios;
    csay('');
  }
  async function openHandover(what){
    var mine=++ticket, stale=function(){ return mine!==ticket; };
    var paste=document.getElementById('codePaste');
    busy=true; paste.disabled=true; codeIn.readOnly=true; csay('Opening...','wait');
    var r, body;
    var undo=function(){ if(!stale()){ busy=false; paste.disabled=false; codeIn.readOnly=false; } };
    try{
      r=await fetch('/handover/open', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(what)});
      body=await r.json();
    }catch(e){ if(stale()) return false; undo(); csay('Not opened: the connection dropped. Try again; if the code is then refused, make a new one.','bad'); return false; }
    if(stale()) return false;
    undo();
    if(!r.ok||!body.ok){
      csay(r.status===429||r.status===503?(body.error||'Try again later.')
        :'That code did not open anything. A code works once, for 15 minutes: make a new one and try again.','bad');
      if(what.code){ codeIn.setAttribute('aria-invalid','true'); }
      return false;
    }
    var ck, b;
    try{ ck=await unwrapUnder(new TextEncoder().encode(body.token||what.token||''), body.wrap); b=JSON.parse(await open(ck, body.env)); }
    catch(e){ if(!stale()) csay('That code did not open anything. A code works once, for 15 minutes: make a new one and try again.','bad'); return false; }
    if(stale()) return false;
    var x=await openBeside(body, ck, b);
    if(stale()) return false;
    try{ if(location.hash) history.replaceState(null,'','/app'); }catch(e){}
    var keep=await askReplace(document.getElementById('codePaste'), body.u);   /* S3 3.8 */
    if(stale()) return false;
    csay(''); codeBox.hidden=true; codeIn.value='';
    enter(body.u, body, b, x, ck, true);
    if(!(await follow(stale))) return true;
    if(keep) await remember(body.u, ck);
    askPush();
    return true;
  }
  /* a code as the site takes it, xxxx-xxxx, or '' */
  function codeOf(t){ var raw=clean(t); return raw.length===8?raw.slice(0,4)+'-'+raw.slice(4):''; }
  /* an app's own browser keeps nothing once it closes: a key in its address is not spent there */
  var INAPP_KEY='This app keeps nothing once you close it. Open this page in Safari or Chrome to sign in.';
  if(codeBox){
    /* S3 fix: in the signed-out Sheet the code screen takes the form's place there, and the draft is kept */
    document.getElementById('toCode').addEventListener('click', function(){
      if(outSheet&&!outSheet.hidden){ codeHome=codeHome||{p:codeBox.parentNode, n:codeBox.nextSibling}; document.getElementById('outForm').appendChild(codeBox); doorBox.hidden=true; }
      showCode(true); try{ codeIn.focus(); }catch(e){}
    });
    document.getElementById('codeDoor').addEventListener('click', function(){
      codeBox.hidden=true;
      if(outSheet&&outSheet.contains(codeBox)) doorBox.hidden=false; else gate.hidden=false;
      try{ (un.value?pw:un).focus(); }catch(e){}
    });
    codeIn.addEventListener('input', function(){
      var v=codeIn.value.trim();
      codeIn.removeAttribute('aria-invalid');
      /* a key pasted into the field is a key, and goes as one */
      if(TOK_RE.test(v)){ codeIn.value=''; openHandover({token:v}); return; }
      var raw=clean(v).slice(0,8).toUpperCase();
      codeIn.value=raw.length>4?raw.slice(0,4)+' '+raw.slice(4):raw;
      if(raw.length<8) { csay(''); return; }
      if(ALPHA.test(raw.toLowerCase())){ codeIn.setAttribute('aria-invalid','true'); csay('A code never uses 0, 1, I, L, O or U. Check the symbols you typed.','bad'); return; }
      openHandover({code:codeOf(raw)});
    });
    document.getElementById('codePaste').addEventListener('click', async function(){
      var t='';
      try{ t=String(await navigator.clipboard.readText()||'').trim(); }
      catch(e){ csay('Paste did not work here. Type the code below instead.','bad'); try{ codeIn.focus(); }catch(e2){} return; }
      if(TOK_RE.test(t)){ openHandover({token:t}); return; }
      var c=codeOf(t);
      if(c&&!ALPHA.test(clean(c))){ codeIn.value=c.toUpperCase().replace('-',' '); openHandover({code:c}); return; }
      /* S3 fix: Safari is named only on the saved iPhone app's screen */
      csay(codeIos?'There is no code on the clipboard. Copy it in Safari, or type it below.':'There is no code on the clipboard. Type it below.','bad');
    });
  }

  /* ---- REPLACE ANOTHER ACCOUNT ON THIS PHONE? (S3 3.8) ------------------------------------------------
     Keeping a second account would overwrite the one this phone remembers, so it is asked, beside the control
     that was tapped, before anything is kept: Replace keeps the new one and forgets the old; Keep leaves the old
     one remembered and opens the new one for this visit only. Nothing is asked when nothing else is kept. */
  function askReplace(anchor, u){
    var was=remGet();
    if(OWNER||!was||!was.u||was.u===u) return Promise.resolve(true);
    var box=document.getElementById('askRep'), yes=document.getElementById('askYes'), no=document.getElementById('askNo'),
        t=document.getElementById('askRepT');
    t.textContent='';
    t.appendChild(document.createTextNode('Replace ')); t.appendChild(el('span','mono',was.u));
    t.appendChild(document.createTextNode(' on this '+DEV+'? It will open '));
    t.appendChild(u?el('span','mono',u):document.createTextNode('this account'));
    t.appendChild(document.createTextNode(' instead.'));
    no.textContent='Keep '; no.appendChild(el('span','nocase',was.u));
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    anchor.hidden=true; box.hidden=false;
    try{ yes.focus(); }catch(e){}
    return new Promise(function(done){
      var pick=function(v){ return function(){ yes.onclick=null; no.onclick=null; box.hidden=true; anchor.hidden=false; done(v); }; };
      yes.onclick=pick(true); no.onclick=pick(false);
    });
  }

  function lock(){
    ticket++; busy=false; go.disabled=false;
    if(poll){ clearInterval(poll); poll=null; }
    bundle=null; session=''; view=false; prices=null; orders=[]; draft={}; pick={}; seenMem=null; assoc=false; card=null; cardMonth=null; myLinks=null; myMax=0; myNote='';
    owedNow=0; hold=false; tPrices.hidden=false; tOrder.textContent='Order';
    parkMonths(); out.textContent=''; at=0; drawFoot(); devNote=''; drawDevice();
    mfil.textContent=''; mfil.hidden=true; mfPick=null; mfnote.textContent='';
    pPrices.textContent=''; pOrder.textContent='';
    tabs.hidden=true; barw.hidden=true; lapse.hidden=true; if(linkBox) linkBox.hidden=true;
    curCk=null; closeSignedOut(); if(opening) opening.hidden=true;
    closeKeep(); keepTok=''; if(keepCardEl) keepCardEl.hidden=true; if(codeBox) codeBox.hidden=true;
    /* S3 fix: a key the Keep Sheet wrote into the address leaves it with the account */
    try{ if(location.hash) history.replaceState(null,'',location.pathname); }catch(e){}
    var ask=document.getElementById('askRep'); if(ask&&!ask.hidden){ ask.hidden=true; document.getElementById('askNo').click(); }
    /* the owner goes back to his list, never to a password field he has no password for */
    if(OWNER){ roster.hidden=false; gate.hidden=true; if(whoacct) whoacct.textContent=''; }
    else gate.hidden=false;
    showTab('stmt');
    pw.value=''; showPw(false);
    if(cd) cd.textContent='';
    say(OWNER?'Signed out. Tap an account to open it again.':'Signed out. Sign in again when you want it.');
    try{ (OWNER?rq:pw).focus(); }catch(e){}
  }
  /* v692: LOGGING OUT IS A DEPARTURE, NOT A TIMER. It drops the session and the remembered wrap on
     the site as well as everything this page holds, so a phone handed on is a phone signed out. */
  async function logOut(){
    /* S3 fix, 24 Sep 2026: an account open for a visit over one this phone keeps (Keep at the Replace question) signs
       out alone: the kept account stays remembered here and on the site, and so do its alerts on this phone, and so
       does the record of what this phone has seen (S5), which is the kept account's as well */
    var rec=remGet(), other=!!rec&&rec.u!==user, tok=!other&&rec?rec.t||null:null, s=session, ep=null, ho=keepMinted;
    keepMinted=[];
    if(!other){ remClear(); try{ localStorage.removeItem(SEEN); }catch(e){} }
    lock();
    /* S1 1.42: this phone's alerts go too, here and on the site, and the site is told even when the session
       has lapsed, so the remembered wrap does not outlive the Log out */
    if(!OWNER){ try{ var sub=await phoneSub(); if(sub){ ep=sub.endpoint; if(!other) await sub.unsubscribe(); } }catch(e){} }
    if(s||tok||ep||ho.length){
      try{ await fetch('/logout', {method:'POST', headers:{'content-type':'application/json','X-Stmt-Session':s},
        body:JSON.stringify({token:tok, endpoint:ep, handover:ho})}); }catch(e){ /* the page has forgotten it either way */ }
    }
  }
  /* this phone's push subscription, or null; asking never registers anything */
  async function phoneSub(){
    if(!('serviceWorker' in navigator)||!navigator.serviceWorker.getRegistration) return null;
    var reg=await navigator.serviceWorker.getRegistration();
    return reg&&reg.pushManager?await reg.pushManager.getSubscription():null;
  }
  document.getElementById('lock').addEventListener('click', logOut);

  /* S1 1.5, 24 SEP 2026: A LAPSED SESSION SAYS SO AT ONCE, IN VIEW, where the fifteen minutes had run out in
     silence. S3 3.5, HIS D1 OF 24 SEP 2026: IT REOPENS ITSELF FROM THE REMEMBERED PHONE. api() asks the phone's own
     memory for a fresh session, once, and repeats the request, so nobody is stranded on a page that looks alive.
     Only with nothing remembered does a Sheet say "You were signed out on this phone" over what they were doing,
     carrying the door's own form, and a sign-in there keeps the draft. The bar keeps a line with the way back,
     for a Sheet that was closed, or a site that could not be reached to reopen. */
  var lapse=document.getElementById('lapse'), opening=document.getElementById('opening'),
      outSheet=document.getElementById('outSheet'), outScrim=document.getElementById('outScrim'),
      doorBox=document.getElementById('doorBox');
  var LAPSED='Not sent: you were signed out on this '+DEV+'. Sign in to carry on.';
  var reopening=null;
  /* S3 fix, 24 Sep 2026: THE PHONE REOPENS ONLY THE ACCOUNT ON SCREEN. It remembers one account, and another can be
     open for a visit (Keep at the Replace question, or the door with the tick off): a lapse there reopened the
     remembered one, drew it in silence and sent the waiting request again on its session, an order included. */
  function keptMine(){ var r=remGet(); return !!r&&!!user&&r.u===user; }
  function reopen(){
    if(OWNER||!keptMine()) return Promise.resolve(false);
    if(!reopening) reopening=openRemembered(true).then(function(v){ reopening=null; return v; }, function(){ reopening=null; return false; });
    return reopening;
  }
  function lapsed(){
    /* S4 fix: the order sheet lies over the bar, so a lapse closes it; Continue is then in reach, and the sheet will
       not open again until it is tapped (sheetOpen). What was chosen and typed in it stays in draft, and the same account
       let in again opens it again at the form (enter), so an order they were writing is kept, as S3 3.5 keeps it */
    if(osh&&!view&&(draft.step==='form'||draft.step==='check')) draft.sheetBack=true;
    sheetClose();
    if(poll){ clearInterval(poll); poll=null; }
    if(!lapse.hidden) return;
    var kept=keptMine();
    document.getElementById('lapseT').textContent=kept?'This '+DEV+' could not sign you back in just now.':'You were signed out on this '+DEV+'.';
    document.getElementById('lapseGo').textContent=kept?'Try again':'Sign in';
    lapse.hidden=false;
    if(!kept) openSignedOut();
  }
  var doorNext=null, codeHome=null;
  function openSignedOut(){
    if(OWNER||!outSheet||!outSheet.hidden) return;
    doorNext=doorBox.nextSibling;
    document.getElementById('outForm').appendChild(doorBox);
    if(user) un.value=user;
    say('');
    outScrim.hidden=false; outSheet.hidden=false;
    try{ pw.focus(); }catch(e){}
  }
  function closeSignedOut(){
    if(!outSheet||outSheet.hidden) return;
    outSheet.hidden=true; outScrim.hidden=true;
    /* S3 fix: back where it came from, and the code screen too if the Sheet took it */
    gate.insertBefore(doorBox, doorNext); doorBox.hidden=false;
    if(codeHome&&outSheet.contains(codeBox)){ codeHome.p.insertBefore(codeBox, codeHome.n); codeBox.hidden=true; }
  }
  if(outSheet){
    document.getElementById('outX').addEventListener('click', function(){ closeSignedOut(); try{ document.getElementById('lapseGo').focus(); }catch(e){} });
    outScrim.addEventListener('click', closeSignedOut);
    document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeSignedOut(); });
  }
  document.getElementById('lapseGo').addEventListener('click', async function(){
    if(OWNER) return;
    if(!keptMine()){ openSignedOut(); return; }
    /* the line stays until the phone is back in: enter() takes it away; a refusal forgets the phone, so it is redrawn */
    if(!(await reopen())){ lapse.hidden=true; lapsed(); return; }
    await oReread();
  });

  /* ---- the tabs: three for everyone, a fourth for an associate ---- */
  function showTab(t){
    sheetClose();
    tab=t;
    var bs=tabs.querySelectorAll('button');
    for(var i=0;i<bs.length;i++){ var on=bs[i].getAttribute('data-t')===t; bs[i].className='salt-tabs__pill'+(on?' on':''); bs[i].setAttribute('aria-selected',on?'true':'false'); }
    pStmt.hidden=(t!=='stmt'); pPrices.hidden=(t!=='prices'); pOrder.hidden=(t!=='order');
    pCard.hidden=(t!=='card');
    window.scrollTo(0,0);
  }
  tabs.addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-t]'); if(b) showTab(b.getAttribute('data-t'));
  });

  /* ---- ACCOUNT (S7 7.3, the plan's section 4, his "all recommended" of 24 Sep 2026) -------------------------------
     The statement as stacked lines, ONE month filter with All first, the earlier statements at its foot, and This device.
     drawAccount(el) is what a place calls: it moves the Account's parts into el (moved, never copied, so every id stays
     one element) and draws what the page holds. The statement itself is drawn by pickStmt, on every open and re-read. */
  function drawAccount(el){
    if(el&&acctEl&&acctEl.parentNode!==el) el.appendChild(acctEl);
    if(bundle&&!out.firstChild) pickStmt(at);
    drawDevice();
  }
  /* the filter and its note sit beside the list they filter, inside the document once it is drawn: parked back
     above it before the document is replaced, so replacing it never takes them with it */
  function parkMonths(){ if(acctEl&&mfil.parentNode!==out.parentNode){ out.parentNode.insertBefore(mfil,out); out.parentNode.insertBefore(mfnote,out); } }
  function pickStmt(i){
    if(!bundle) return;
    at=i;
    parkMonths();
    /* AN ACCOUNT WITH NO ROWS HAS NO STATEMENT AT ALL (tools/stmt-account.mjs mints it so): it says so,
       and Prices and Order are still drawn after it. Reading a body that is not there threw here, and
       the page stopped on a blank tab. */
    var s=bundle.statements[i];
    if(!s){
      out.textContent=''; var e=el('div','panel'); e.appendChild(el('p','lead','Nothing on your account yet. Your orders will show here.')); out.appendChild(e);
      mfil.hidden=true; mfnote.textContent=''; drawFoot();
      return;
    }
    out.innerHTML=s.body;
    drawMonths();
    drawFoot();
    window.scrollTo(0,0);
  }
  /* EARLIER STATEMENTS AT THE FOOT (S7 7.3). The first statement is the account as it stands, the live document where
     there is one; every issue after it is kept as it was sent, and opens in its place with the way back above it. It
     is never called the latest issue: there are no monthly statements, just one live document (v769, v772). */
  function drawFoot(){
    stmtFoot.textContent='';
    var list=bundle?bundle.statements:[], s0=list[0];
    stmtBack.hidden=!(at>0&&list[at]);
    if(!stmtBack.hidden) document.getElementById('stmtBackT').textContent='The statement issued '+(list[at].label||list[at].issued)+', kept as it was sent.';
    stmtFoot.hidden=list.length<2;
    if(stmtFoot.hidden) return;
    stmtFoot.appendChild(el('h2','salt-eyebrow salt-eyebrow--copper','Earlier statements'));
    stmtFoot.appendChild(el('p','sub2',s0&&s0.live?'Kept as they were sent. Your statement above keeps up with every order.':'Kept as they were sent.'));
    var g=el('div','stmtissues');
    list.forEach(function(s,j){
      if(!j) return;
      var b=el('button','salt-ghost',s.label||s.issued); b.type='button'; b.setAttribute('aria-pressed',j===at?'true':'false');
      b.addEventListener('click', function(){ pickStmt(j); });
      g.appendChild(b);
    });
    stmtFoot.appendChild(g);
  }
  document.getElementById('stmtBackGo').addEventListener('click', function(){ pickStmt(0); });

  /* ---- THE MONTH FILTER (v690, his instruction of 18 Sep 2026) -------------------------------
     THE STATEMENT IS NOT BOUND TO A MONTH ANY MORE: it carries every order from the start, and
     this filters it. Each row says which month it belongs to; an undated row belongs to none and
     shows whatever is chosen. What the account stands at is the account's, so the totals under the
     list do not move with the filter, and the line above says so.
     v769, HIS INSTRUCTION OF 21 SEP 2026: IT OPENS ON THE WHOLE ACCOUNT, and since S7 7.3 All is the first pill,
     then the months newest first, a short month where they share a year. A row is a table row in an issue and a
     Statement line in the live document; either carries data-m. */
  var mfPick=null;
  function monthLabel(m){
    var y=m.slice(0,4), mm=+m.slice(5,7);
    return ['January','February','March','April','May','June','July','August','September','October','November','December'][mm-1]+' '+y;
  }
  function applyMonths(){
    var rows=out.querySelectorAll('[data-m]');
    for(var i=0;i<rows.length;i++){
      var m=rows[i].getAttribute('data-m');
      rows[i].style.display=(!mfPick||m===mfPick)?'':'none';
    }
    var bs=mfil.querySelectorAll('button');
    for(var k=0;k<bs.length;k++){ var on=bs[k].getAttribute('data-mf')===(mfPick||''); bs[k].className='salt-tabs__pill'+(on?' salt-tabs__pill--active':''); bs[k].setAttribute('aria-pressed',on?'true':'false'); }
    mfnote.textContent=mfPick
      ? 'Showing '+monthLabel(mfPick)+'. What the account stands at, below, is the whole account.'
      : 'Showing every order from the start.';
  }
  function drawMonths(){
    mfil.textContent='';
    var rows=out.querySelectorAll('[data-m]'), seen={}, months=[], years={};
    for(var i=0;i<rows.length;i++){
      var m=rows[i].getAttribute('data-m');
      if(m&&!seen[m]){ seen[m]=1; months.push(m); years[m.slice(0,4)]=1; }
    }
    months.sort().reverse();
    mfPick=null;   /* v769: the whole account, and a month is one tap */
    if(months.length<2){ mfil.hidden=true; mfnote.textContent=''; return; }
    var oneYear=Object.keys(years).length<2;
    [''].concat(months).forEach(function(m){
      var b=document.createElement('button'); b.type='button'; b.setAttribute('data-mf',m);
      b.textContent=m?MON3[+m.slice(5,7)-1]+(oneYear?'':' '+m.slice(0,4)):'All';
      if(m) b.setAttribute('aria-label',monthLabel(m));
      b.addEventListener('click', function(){ mfPick=m||null; applyMonths(); });
      mfil.appendChild(b);
    });
    /* beside the list it filters, not above the document's heading */
    var first=out.querySelector('[data-m]'), list=first&&first.closest('.salt-lines, .tblw, table');
    if(list&&list.parentNode){ list.parentNode.insertBefore(mfil,list); list.parentNode.insertBefore(mfnote,list); }
    mfil.hidden=false;
    applyMonths();
  }

  /* ---- THIS DEVICE (S7 7.3) -------------------------------------------------------------------------------------
     What this browser does for the account: its notifications on or off, saving it as an app, and signing out of it,
     each answer written on the row that was tapped. Stage 9 draws the account's other devices into #devSlot. Not on
     his read-only view: those are not his phones. OFF IS KEPT ON THIS DEVICE: the subscription is dropped here, the
     site forgets it at the next wake it cannot deliver (stmt/push.js), and the automatic re-filing on the way in
     (askPush) waits for a Turn on. */
  var devEl=document.getElementById('thisDevice'), devRows=document.getElementById('devRows'), devBusy=false, devNote='';
  var PUSH_OFF='salt-push-off';
  function pushOff(){ try{ return localStorage.getItem(PUSH_OFF)==='1'; }catch(e){ return false; } }
  function pushOffSet(on){ try{ if(on) localStorage.setItem(PUSH_OFF,'1'); else localStorage.removeItem(PUSH_OFF); }catch(e){ /* for this visit only */ } }
  function pushCan(){ return ('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window); }
  function devRow(label,flag,btn){
    var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line');
    l.appendChild(el('span','salt-ledger__label',label));
    if(btn){ var v=el('span','salt-ledger__value'); v.appendChild(btn); l.appendChild(v); }
    r.appendChild(l);
    var f=el('span','salt-ledger__flag'); if(typeof flag==='string') f.textContent=flag; else f.appendChild(flag);
    f.setAttribute('role','status'); r.appendChild(f);
    return r;
  }
  function devBtn(t,go){ var b=el('button','salt-ghost',t); b.type='button'; b.disabled=devBusy; b.addEventListener('click',go); return b; }
  function drawDevice(){
    if(!devEl) return;
    devEl.hidden=!session||view||OWNER;
    if(devEl.hidden) return;
    devRows.textContent='';
    var on=!!draft.pushed||(pushCan()&&Notification.permission==='granted'&&!!draft.pushDone), said=devNote||draft.pushNote||'';
    if(!pushCan()) devRows.appendChild(devRow('Notifications',IOS&&!STANDALONE
      ?'Not in this browser. On an iPhone they come to the app saved on your Home Screen.':'This browser cannot receive them.'));
    else if(on) devRows.appendChild(devRow('Notifications',said||'On. You will be told when your order changes, when there is a reply, and at 10:00 and 18:00 when a payment is due.',devBtn('Turn off',devPushOff)));
    else devRows.appendChild(devRow('Notifications',said||'Off. Nothing is sent to this '+DEV+'.',devBtn('Turn on',devPushOn)));
    var mode=keepMode(), steps=document.getElementById({samsung:'keepSam',desk:'keepDesk',droid:'keepDroid'}[mode]||'-');
    if(STANDALONE) devRows.appendChild(devRow('Saved as an app','You are in it now.'));
    else if(mode==='ios'||mode==='install') devRows.appendChild(devRow('Save as an app','One tap to open, and it stays signed in.',
      mode==='ios'?devBtn('Show me how',function(ev){ openKeep(ev.currentTarget); }):devBtn('Install',keepInstallGo)));
    else if(steps){ var sp=el('span'); [].forEach.call(steps.childNodes,function(n){ sp.appendChild(n.cloneNode(true)); }); devRows.appendChild(devRow('Save as an app',sp)); }
  }
  async function devPushOn(){
    devBusy=true; devNote=''; draft.pushNote=''; drawDevice();
    await subscribePush();
    devBusy=false; drawDevice();
  }
  async function devPushOff(){
    var mine=ticket;
    devBusy=true; devNote=''; drawDevice();
    try{ var sub=await phoneSub(); if(sub) await sub.unsubscribe(); pushOffSet(true); draft.pushed=false; draft.pushDone=false; draft.pushNote=''; }
    catch(e){ devNote='They could not be turned off just now. Try again.'; }
    if(mine!==ticket) return;
    devBusy=false; drawDevice(); drawOrder();
  }
  if(devEl) document.getElementById('devOut').addEventListener('click', logOut);

  /* the statements a customer has: the first opens, the rest are at the foot */
  function show(b){
    bundle=b;
    gate.hidden=true; if(roster) roster.hidden=true;
    barw.hidden=false; tabs.hidden=false;
    /* v706: the fourth tab is an associate's alone, and nobody else is shown one at all. It waited on
       a sealed card as well, so an associate the publish had not yet written one for had no way to
       their links (v709 gates those on the mark, not the card); since 24 Sep 2026 the mark alone opens
       it, and a panel with no card says when it comes and still carries the links. */
    tCard.hidden=!assoc;
    if(!tCard.hidden) drawCard();
    var lv=b.statements.filter(function(s){ return s.live; })[0];
    owedNow=lv&&isFinite(+lv.owed)?+lv.owed:0;
    hold=owedNow>HOLD_RM+0.004;
    tPrices.hidden=hold; tOrder.textContent=hold?'Pay':'Order';
    pickStmt(0);
    drawAccount(pStmt);
    if(hold) showTab('order');
  }

  /* ---- THEIR OWN CARD (v706, his instruction of 18 Sep 2026) ----------------------------------
     "Associates see their own live report card, by month, from the start." It is sealed onto their
     own record beside the statement and the price list, so it opens with their password and nobody
     else's. What it does NOT carry is stated in tools/book.mjs: no share of his revenue, no stars,
     no rank, no margin. The reward's distance to the next unit is a SHARE of one unit and is drawn
     as a bar, his instruction, because the unit itself is a margin figure.
     THE MONTHS WORK AS THE STATEMENT'S DO (v690): every line from the start, the newest month
     open, All one tap away, and the position below does not move with the filter. */
  function cardMonths(p){
    var seen={}, ms=[];
    (p.lines||[]).forEach(function(l){ var m=(l.date||'').slice(0,7); if(m&&!seen[m]){ seen[m]=1; ms.push(m); } });
    return ms.sort().reverse();
  }
  function drawCard(){
    pCard.textContent='';
    if(!card||!card.products||!card.products.length){ pCard.appendChild(el('p','lead','Your card is written with the next update.')); drawMyLinks(); return; }
    pCard.appendChild(el('h2',null,'Your card'));
    pCard.appendChild(el('p','lead','What you have bought, what has gone out through you, and where your reward stands. Every month from the start; the newest opens.'));
    card.products.forEach(function(p){
      var pane=el('div','pane');
      var h3=el('h3','pmark'); h3.setAttribute('aria-label',pshape(p.product)); h3.appendChild(psym(p.product,28));
      pane.appendChild(h3);
      var sm=p.summary||{};
      var ul=el('ul','conf');
      [['You bought',rm(sm.bought||0)],
       ['Sold through you',rm(sm.soldFor||0)],
       ['Onward sales',String(sm.onward||0)],
       ['Brought in',rm(sm.introduced||0)],
       ['People you introduced',String(sm.referred||0)]].forEach(function(r){
        var li=el('li'); li.appendChild(el('span','k',r[0])); li.appendChild(el('span','v',r[1])); ul.appendChild(li);
      });
      pane.appendChild(ul);
      /* THE REWARD IN UNITS, AND A BAR TO THE NEXT. No ringgit of margin anywhere near it. */
      if(p.reward){
        var rw=p.reward;
        pane.appendChild(el('p','sub2','Reward: '+unitsOf(rw.left,p.unit)+' to take'
          +(rw.earned!==rw.left?' ('+unitsOf(rw.earned,p.unit)+' earned, '+unitsOf(rw.taken,p.unit)+' taken)':'')
          +(rw.held?'. Held for now.':'.')
          /* S8 8.3: and how to take it, which the line never said; only where there is some to take */
          +(!rw.held&&rw.left>0?' Ask on any order to take it.':'')));
        if(rw.next!=null){
          /* the fill is an <i>, which is what .pbar's own rule paints; a <span> drew an empty rule */
          var bar=el('div','pbar'); var fill=el('i'); fill.style.width=Math.round(rw.next*100)+'%';
          bar.appendChild(fill); pane.appendChild(bar);
          pane.appendChild(el('p','sub2',Math.round(rw.next*100)+'% of the way to your next unit.'));
        }
      }
      /* the lines, with their own month strip */
      var months=cardMonths(p), pick=cardMonth==null?(months[0]||''):cardMonth;
      if(months.length>1){
        var strip=el('div','mos mfil');
        months.concat(['']).forEach(function(m){
          var b=el('button',(m===pick?'on':'')); b.type='button';
          b.textContent=m?monthLabel(m):'All';
          b.addEventListener('click',function(){ cardMonth=m; drawCard(); });
          strip.appendChild(b);
        });
        pane.appendChild(strip);
      }
      var shown=(p.lines||[]).filter(function(l){ return !pick||(l.date||'').slice(0,7)===pick; });
      if(!shown.length) pane.appendChild(el('p','sub2','Nothing in that month.'));
      else {
        var t=el('table'), th=el('thead'), tr=el('tr');
        [['Date','l'],['What','l'],['Size',''],['RM','']].forEach(function(c){ tr.appendChild(el('th',c[1]||null,c[0])); });
        th.appendChild(tr); t.appendChild(th);
        var tb=el('tbody');
        shown.forEach(function(l){
          var row=el('tr');
          row.appendChild(el('td','l',l.date||''));
          row.appendChild(el('td','l',l.kind==='own'?'You bought':'Through you'));
          row.appendChild(el('td',null,unitsOf(l.qty,p.unit)));
          row.appendChild(el('td',null,rm(l.rm)));
          tb.appendChild(row);
        });
        t.appendChild(tb); pane.appendChild(t);
      }
      pCard.appendChild(pane);
    });
    drawMyLinks();
  }

  /* ---- THEIR OWN REFERRAL LINKS (v709, his instruction of 18 Sep 2026) -------------------------
     "If they want to refer to a customer, they will be able to mint their own link, just like how
     I'd choose a customer and generate the link. It will need to be approved by me."
     IT LIVES HERE, in the script every page carries, gated at runtime on the associate mark: the
     owner's script is spliced only on his route and must never travel to a customer, and the
     landing page is served before anybody signs in, so there is nothing to splice per viewer.
     A LEVEL IS NEVER NAMED. What the link quotes is his to set; they are told it is open and no
     more, because the level is never named on a customer's page. */
  /* the box keeps its own note (24 Sep 2026): it drew the order form's, so "Placed..." appeared under
     Your links, and a link that was not made said so under the order form as well */
  var myLinks=null, myMax=0, myNote='';
  function drawMyLinks(){
    var box=el('div','pane');
    box.appendChild(el('h3',null,'Your links'));
    box.appendChild(el('p','sub2','Make a link for somebody you want to bring in. It opens a price list and nothing else, and it stays shut until it is approved.'));
    if(myLinks===null){ box.appendChild(el('p','sub2','Reading your links.')); pCard.appendChild(box); if(!view) loadMyLinks(); return; }
    if(!myLinks.length) box.appendChild(el('p','sub2','None yet.'));
    myLinks.forEach(function(r){
      var row=el('div','glink'+(r.state==='withdrawn'||r.state==='declined'?' off':''));
      /* D13 (24 Sep 2026): a declined link is its own state, never "waiting" */
      row.appendChild(el('p','gt', r.state==='waiting'?'Waiting to be approved':(r.state==='declined'?'Not approved':(r.state==='withdrawn'?'Withdrawn':'Open'))));
      /* S1 1.39: words, not a dash (an em-dash reached the page); a withdrawn or declined link says so above and needs no line here */
      if(r.state!=='withdrawn'&&r.state!=='declined') row.appendChild(el('code','gu', r.state==='open'?r.url:'No address yet'));
      row.appendChild(el('p','gs', r.opens
        ? 'opened '+r.opens+' time'+(r.opens===1?'':'s')
        : (r.state==='open'?'never opened yet':'nothing can open it')));
      if(r.state==='open'){
        var img=document.createElement('img');
        img.src=r.qr; img.alt='A code that opens the price list you are sharing'; img.width=160; img.height=160;
        row.appendChild(img);
      }
      var acts=el('div','grow');
      if(r.state==='open'){
        var cp=el('button',null,'Copy link'); cp.type='button';
        /* awaited (24 Sep 2026): writeText answers with a promise, so a refusal said Copied */
        cp.addEventListener('click', async function(){
          try{ await navigator.clipboard.writeText(r.url); cp.textContent='Copied'; }catch(e){ cp.textContent='Copy failed'; }
          setTimeout(function(){ cp.textContent='Copy link'; },1500);
        });
        acts.appendChild(cp);
      }
      if(r.state!=='withdrawn'&&!view){
        var wd=el('button',null,'Withdraw'); wd.type='button';
        wd.addEventListener('click', async function(){
          if(!confirm('Withdraw this link? Whoever holds it will not be able to open it.')) return;
          var mine=ticket; var rv=await api('/my/refs/'+encodeURIComponent(r.id)+'/revoke',{});
          if(mine!==ticket) return; if(rv.status===0) myNote=rv.body.error; await loadMyLinks();
        });
        acts.appendChild(wd);
      }
      row.appendChild(acts);
      box.appendChild(row);
    });
    var live=myLinks.filter(function(r){ return r.state!=='withdrawn'; }).length;
    if(view){ /* his read-only view makes nothing */ }
    else if(live>=myMax) box.appendChild(el('p','sub2','You have '+live+' links. Withdraw one to make another.'));
    else {
      var mk=el('button','btn salt-pill salt-pill--md','Make a link'); mk.type='button';
      mk.addEventListener('click', async function(){
        mk.disabled=true; var mine=ticket;
        var r=await api('/my/refs',{});
        if(mine!==ticket) return;
        myNote=r.body.ok?'':(r.body.error||'That link was not made.');
        await loadMyLinks();
      });
      box.appendChild(mk);
    }
    if(myNote) box.appendChild(el('p','msg',myNote));
    pCard.appendChild(box);
  }
  async function loadMyLinks(){
    var mine=ticket;
    var r=await api('/my/refs');
    if(mine!==ticket) return;
    /* a dropped read keeps the list already drawn and redraws it, which gives back a button a tap disabled */
    if(r.status===0){ if(myLinks!==null) drawCard(); return; }
    myLinks=(r.body&&r.body.refs)||[]; myMax=(r.body&&r.body.max)||0;
    drawCard();
  }

  /* ---- PRICES: the week's list, one block per product ---- */
  /* HIS INSTRUCTION, 16 SEP 2026: GREETED AS PERSONALLY AS POSSIBLE. As personally as this site can,
     which is the honest limit: no name of any customer exists anywhere it can reach, by the rule that
     keeps plaintext names off the cloud, so the greeting is built from what their own sealed record
     holds. The hour is theirs, off their own device; the month is the one their first order falls in. */
  function hail(){
    var h=new Date().getHours();
    return h<12?'Good morning.':(h<18?'Good afternoon.':'Good evening.');
  }
  var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  /* S4 4.8: a moment as the Prices stamp says it, "Thu 24 Sep, 11:59", in Kuala Lumpur; the weekday from the date's own parts */
  var DAY3=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function pricesAt(iso){
    try{ var p=klBits(iso); return DAY3[new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()]+' '+(+p.day)+' '+MON3[+p.month-1]+', '+p.hour+':'+p.minute; }
    catch(e){ return ''; }
  }
  function monthOf(d){
    var m=/^(\\d{4})-(\\d{2})/.exec(String(d||'')); if(!m) return '';
    return MONTHS[+m[2]-1]+' '+m[1];
  }
  function drawPrices(){
    pPrices.textContent='';
    var h=el('h2',null,'Your prices'); pPrices.appendChild(h);
    var g=el('p','lead',hail()); g.style.marginTop='0'; pPrices.appendChild(g);
    var soon=((prices&&prices.soon)||[]).concat(((prices&&prices.products)||[]).filter(function(x){ return !(x.sizes&&x.sizes.length); }));
    if(!prices||((!prices.products||!prices.products.length)&&!soon.length)){
      pPrices.appendChild(el('p','lead','No price list has been written for your account yet. It is written with the next update and changes weekly.'));
      return;
    }
    /* S4 4.8: THE STAMP SAYS WHEN THE LIST WAS WRITTEN, "Prices as at Thu 24 Sep, 11:59" in Kuala Lumpur, where "for the week
       of" stayed on an open page for good; a list sealed before it carried a time keeps its week. Every size is a tap. */
    var tapTo=!view&&!hold;
    pPrices.appendChild(el('p','lead',(prices.at&&pricesAt(prices.at)?'Prices as at '+pricesAt(prices.at)+'.':'For the week of '+(prices.week&&prices.week.label||'')+'.')
      +(tapTo?' Tap a size to order it.':'')));
    pPrices.appendChild(el('p','lead','The price is for the goods. '+DELIVERY+' The list is written from your own history and changes weekly.'));
    if(prices.since) pPrices.appendChild(el('p','sub2','Buying with us since '+monthOf(prices.since)+'.'));
    sold().forEach(function(p){
      var pane=el('div','pane');
      var h3=el('h3','pmark'); h3.setAttribute('aria-label',pshape(p.product)); h3.appendChild(psym(p.product,28));
      /* S4 4.10, D11 (his "all recommended" of 24 Sep 2026): THE LEVEL LEAVES PRICES. v659 drew a symbol and a colour
         for it beside each product, never named; a customer now sees no level at all, in words or in a mark. The name
         still travels inside the sealed list, and nothing here reads it. */
      pane.appendChild(h3);
      pane.appendChild(el('p','sub2', p.basis==='board' ? 'The same price for everybody. '
        : p.basis==='yours'
        ? 'Your rate: '+rm(p.rate)+' per '+(p.unit||'unit')+', from your last '+p.orders+' order'+(p.orders===1?'':'s')+'. '
        : 'Your own rate follows your first order. '));
      /* S4 4.8: a size is a row of the plain ledger, and each row is one tap that opens the order sheet at that size */
      var L=el('div','salt-ledger salt-ledger--plain');
      p.sizes.forEach(function(r){
        var row=el(tapTo?'button':'div','salt-ledger__row szrow'), line=el('span','salt-ledger__line');
        line.appendChild(el('span','salt-ledger__label',unitsOf(r.q,p.unit)));
        var v=el('span','salt-ledger__value',rm(r.price)); line.appendChild(v); row.appendChild(line);
        if(tapTo){ row.type='button'; row.setAttribute('data-q',String(r.q)); v.appendChild(oGlyph('next','ochev'));
          row.addEventListener('click',function(){ sheetOpen(p.product,r.q,row); }); }
        L.appendChild(row);
      });
      pane.appendChild(L); pPrices.appendChild(pane);
    });
    /* his instruction of 15 Sep 2026: a product with no tier set is not priced, and says so */
    soon.forEach(function(p){
      var pane=el('div','pane');
      var sh=el('h3','pmark'); sh.setAttribute('aria-label',pshape(p.product)); sh.appendChild(psym(p.product,28)); pane.appendChild(sh);
      pane.appendChild(el('p','sub2','Price coming soon.'));
      pPrices.appendChild(pane);
    });
  }

  /* ---- ORDER: the form, then every order and where it stands ---- */
  /* S1 1.4, 24 SEP 2026: A DROPPED REQUEST ANSWERS LIKE A REFUSAL, IN WORDS. It threw, so Place stayed
     busy and Send stayed grey for good; now every caller clears its busy state and shows this beside the
     control it came from. */
  var NOT_SENT='Not sent. Check your connection and try again.';
  /* 24 Sep 2026: what can be ordered is a product with a priced size. The list sends none without one now, and an
     older sealed list still can: its first size was read unguarded, and the throw blanked the whole tab. */
  function sold(){ return ((prices&&prices.products)||[]).filter(function(x){ return x.sizes&&x.sizes.length; }); }
  /* what the page says where nothing can be ordered: a list with nothing priced, or no list at all */
  function noOrderLine(){ return prices&&(prices.soon&&prices.soon.length||prices.products&&prices.products.length)?'Ordering opens once your prices are set.':'Ordering opens once your price list is written, with the next update.'; }
  async function api(path, body, method){
    var send=function(){ return fetch(path,{method:method||(body?'POST':'GET'), cache:'no-store',
        headers:Object.assign({'X-Stmt-Session':session}, body?{'content-type':'application/json'}:{}),
        body:body?JSON.stringify(body):undefined}); };
    var r;
    try{ r=await send(); }catch(e){ return {status:0, body:{ok:false, error:NOT_SENT}}; }
    /* S3 3.5: a lapse reopens from the remembered phone and the request goes again, once */
    if(r.status===401&&session&&await reopen()){
      try{ r=await send(); }catch(e){ return {status:0, body:{ok:false, error:NOT_SENT}}; }
    }
    /* UX5, 24 Sep 2026: ONE LAPSE, ONE VOICE. The Sheet and the bar say it; beside the tapped control each
       caller says whatever the answer's error is, which is a pointer to them */
    if(r.status===401&&session){ lapsed(); return {status:401, body:{ok:false, error:keptMine()?NOT_SENT:LAPSED}}; }
    var j=null; try{ j=await r.json(); }catch(e){}
    return {status:r.status, body:j||{}};
  }
  /* one id a review and one a payment, sent with the tap, so a retry of that tap is recorded once */
  function mintRid(){ var a=crypto.getRandomValues(new Uint8Array(16)), s=''; for(var i=0;i<a.length;i++) s+=(a[i]<16?'0':'')+a[i].toString(16); return s; }
  /* S10 10.4: AND ONE FOR EVERY OTHER MOVE, a withdrawal, a line and a rail. An id stays with the move it was
     minted for (the same line, the same rail), so a retry of that tap is the same event and is recorded once;
     it is dropped when the move is recorded, and anything else is a new move with a new id. */
  var rids={};
  function ridFor(key,what){ var r=rids[key]; if(!r||r.what!==what){ r=rids[key]={id:mintRid(),what:what}; } return r.id; }
  function ridDone(key){ delete rids[key]; }
  function quoteFor(){
    var p=prices&&prices.products&&prices.products.filter(function(x){return x.product===draft.product;})[0];
    if(!p) return null;
    var r=p.sizes.filter(function(x){return String(x.q)===String(draft.q);})[0];
    if(!r) return null;
    var total=r.price;
    return {p:p, q:r.q, total:total, unit:+(total/r.q).toFixed(2)};
  }
  /* ==== THE ORDER IS A SHEET (S4 4.3, 24 SEP 2026; the Counter's redesign, his "all recommended" of that day) ====
     The order form was a pane at the head of the Order tab, filled field by field and reviewed in a second pane under
     it. It is a task laid over the page now, the system's Sheet: the product as its mark, the sizes as Option tiles
     carrying their prices with the size they order most tagged your usual, the way and the place as last time, a line
     folded away until it is wanted, and the total with Review in the foot, in reach of the thumb. Review turns the
     sheet into the check, which draws what will be sent from one frozen copy, so nothing on it can differ from what
     Place sends. Built from the page's own nodes at the root of the body, because a fixed element inside a glass card
     is held by the card's blur; Escape, the scrim and the close control all close it, except while Place is on its way,
     and focus goes back to what opened it. */
  /* the open sheet, or null. Not "sheet": the owner's script, spliced into this closure on his route, keeps its account list under that name */
  var osh=null;
  var OMAX=__MAX_OPEN__, OPEN_ST=__OPEN_STATES__, DELIVERY=__DELIVERY__;
  function oLive(){ return orders.filter(function(o){ return OPEN_ST.indexOf(o.status)>=0; }); }
  var GLYPH={close:'M4 4 L12 12 M12 4 L4 12', back:'M10 3.5 L5.5 8 L10 12.5', next:'M6 3.5 L10.5 8 L6 12.5', tick:'M3 8.5 L6.5 12 L13 4.5'};
  function oGlyph(k,cls,px){
    var NS='http://www.w3.org/2000/svg', s=document.createElementNS(NS,'svg');
    s.setAttribute('viewBox','0 0 16 16'); s.setAttribute('width',px||16); s.setAttribute('height',px||16);
    s.setAttribute('aria-hidden','true'); s.setAttribute('focusable','false'); if(cls) s.setAttribute('class',cls);
    var d=document.createElementNS(NS,'path'); d.setAttribute('d',GLYPH[k]); d.setAttribute('fill','none'); d.setAttribute('stroke','currentColor');
    d.setAttribute('stroke-width','1.5'); d.setAttribute('stroke-linecap','round'); d.setAttribute('stroke-linejoin','round');
    s.appendChild(d); return s;
  }
  /* the size they order most, read off their own orders on this page; the later order breaks a tie */
  function oUsual(){
    var n={}, best=null;
    orders.slice().sort(function(a,b){ return String(a.at).localeCompare(String(b.at)); }).forEach(function(o){
      var k=o.product+'|'+o.qty; n[k]=(n[k]||0)+1; if(!best||n[k]>=n[best]) best=k;
    });
    if(!best) return null;
    var i=best.indexOf('|'); return {product:best.slice(0,i), q:best.slice(i+1)};
  }
  function oLatest(pick){ var l=null; orders.forEach(function(o){ if(pick(o)&&(!l||String(o.at)>String(l.at))) l=o; }); return l; }
  function oSoldHas(p,q){ var P=sold().filter(function(x){ return x.product===p; })[0];
    return !!P&&(q==null||P.sizes.some(function(s){ return String(s.q)===String(q); })); }
  function sheetOpen(product,q,opener){
    if(view||hold||!sold().length||!lapse.hidden) return;
    var U=oUsual();
    if(product&&oSoldHas(product,q)){ draft.product=product; draft.q=String(q); }
    else if(!draft.product&&U&&oSoldHas(U.product,U.q)){ draft.product=U.product; draft.q=String(U.q); }
    /* the way and the place are the last order's, and the hint says so while the place is still that one */
    if(draft.mode==null){ var L=oLatest(function(){ return true; }); draft.mode=L&&L.mode==='deliver'?'deliver':'collect'; }
    if(draft.place==null){ var W=oLatest(function(o){ return !!o.place; }); draft.place=W?W.place:''; draft.placeWas=draft.place; }
    draft.step=oLive().length>=OMAX?'limit':'form'; draft.snote=''; draft.check=null;
    if(!osh){
      var wrap=el('div'); wrap.id='osheet';
      var scrim=el('div','salt-sheet-scrim'); scrim.setAttribute('aria-hidden','true'); scrim.addEventListener('click',sheetDismiss);
      var box=el('div','salt-sheet osheet'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
      box.setAttribute('aria-labelledby','oshT'); box.tabIndex=-1;
      var grab=el('div','salt-sheet__grab'); grab.setAttribute('aria-hidden','true');
      var head=el('div','salt-sheet__head'), body=el('div','salt-sheet__body'), foot=el('div','salt-sheet__foot');
      box.appendChild(grab); box.appendChild(head); box.appendChild(body); box.appendChild(foot);
      box.addEventListener('keydown',sheetKeys);
      wrap.appendChild(scrim); wrap.appendChild(box); document.body.appendChild(wrap);
      osh={wrap:wrap, box:box, head:head, body:body, foot:foot, opener:opener||document.activeElement};
      try{ box.focus({preventScroll:true}); }catch(e){}
    }
    sheetDraw();
  }
  function sheetClose(){
    if(!osh) return;
    var s=osh; osh=null; draft.step=''; draft.check=null;
    s.wrap.parentNode.removeChild(s.wrap);
    try{ if(s.opener&&s.opener.isConnected) s.opener.focus({preventScroll:true}); }catch(e){}
  }
  /* the customer's own ways out (the scrim, Close, Escape) wait while Place is on its way: closed then, the answer had
     nowhere to be drawn, an order landed unsaid or a refusal was dropped, and the same order could be placed again */
  function sheetDismiss(){ if(!draft.busy) sheetClose(); }
  /* the sheet keeps focus while it is open: Escape closes it, and Tab wraps at its own first and last controls */
  function sheetKeys(ev){
    if(ev.key==='Escape'){ ev.stopPropagation(); sheetDismiss(); return; }
    if(ev.key!=='Tab'||!osh) return;
    var all=[].filter.call(osh.box.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href]'),function(x){
      if(x.type==='radio'&&x.name){ var g=[].filter.call(osh.box.querySelectorAll('input[type=radio]'),function(r){ return r.name===x.name; });
        if(x!==(g.filter(function(r){ return r.checked; })[0]||g[0])) return false; }
      return x.getClientRects().length>0; });
    if(!all.length) return;
    var at=document.activeElement;
    if(ev.shiftKey&&(at===all[0]||at===osh.box)){ ev.preventDefault(); all[all.length-1].focus(); }
    else if(!ev.shiftKey&&at===all[all.length-1]){ ev.preventDefault(); all[0].focus(); }
  }
  /* one draw for every step; the control that had focus gets it back, found by its data-k */
  function sheetDraw(){
    if(!osh) return;
    var fo=document.activeElement, inside=!!fo&&osh.box.contains(fo), fk=inside?fo.getAttribute('data-k'):null;
    osh.head.textContent=''; osh.body.textContent=''; osh.foot.textContent='';
    if(draft.step==='limit'&&oLive().length<OMAX) draft.step='form';
    if(draft.step==='check') drawCheck(); else if(draft.step==='sent') drawSent(); else if(draft.step==='limit') drawLimit(); else drawForm();
    osh.foot.hidden=!osh.foot.firstChild;
    if(fk){ var back=[].filter.call(osh.box.querySelectorAll('[data-k]'),function(x){ return x.getAttribute('data-k')===fk; })[0];
      if(back) try{ back.focus({preventScroll:true}); }catch(e){} }
    /* a redraw that took the focused control away (Place, once it is answered) leaves focus on the sheet itself, never on
       the page behind it, so Escape and Tab still reach the sheet */
    if(inside&&!osh.box.contains(document.activeElement)) try{ osh.box.focus({preventScroll:true}); }catch(e){}
  }
  function sheetHead(title,back){
    if(back){ var b=el('button','salt-orb'); b.type='button'; b.setAttribute('aria-label','Change'); b.setAttribute('data-k','back'); b.disabled=!!draft.busy;
      b.appendChild(oGlyph('back')); b.addEventListener('click',back); osh.head.appendChild(b); }
    if(title!=null){ var h=el('h2','salt-sheet__title',title); h.id='oshT'; osh.head.appendChild(h); }
    var x=el('button','salt-orb salt-sheet__close'); x.type='button'; x.setAttribute('aria-label','Close'); x.setAttribute('data-k','close'); x.disabled=!!draft.busy;
    x.appendChild(oGlyph('close')); x.addEventListener('click',sheetDismiss); osh.head.appendChild(x);
  }
  /* a question answered by pressed ghosts: the system's Option group holds them, and the chosen one is pressed, never filled */
  function oChoice(legend,opts,cur,key,pick){
    var fs=el('fieldset','salt-options');
    if(legend) fs.appendChild(el('legend','salt-options__legend',legend));
    var g=el('div','salt-options__grid salt-options__grid--2');
    /* data-k by position: a product's word never reaches the page, an attribute included */
    opts.forEach(function(o,i){
      var b=el('button','salt-ghost'); b.type='button'; b.setAttribute('data-k',key+':'+i); b.setAttribute('aria-pressed',o[0]===cur?'true':'false');
      if(typeof o[1]==='string') b.textContent=o[1]; else { b.appendChild(o[1]); b.setAttribute('aria-label',o[2]); }
      b.addEventListener('click',function(){ pick(o[0]); });
      g.appendChild(b);
    });
    fs.appendChild(g); return fs;
  }
  function formWhy(){
    if(assoc&&draft.forFriend==null) return 'Say who it is for.';
    if(!quoteFor()) return 'Pick a size.';
    if(draft.mode==='deliver'&&String(draft.place||'').trim().length<2) return 'Say roughly where it is going.';
    return '';
  }
  function whereHint(){
    return (draft.placeWas&&String(draft.place||'').trim()===draft.placeWas?'Same as last time. ':'')+'An area, not an address.';
  }
  function drawForm(){
    sheetHead('New order');
    var S=sold(), P=S.filter(function(x){ return x.product===draft.product; })[0]||S[0], B=osh.body;
    /* a list that came back with nothing priced (a 409, then Change) leaves nothing to pick: the Order tab's own line */
    if(!P){ B.appendChild(el('p','lead',noOrderLine())); return; }
    draft.product=P.product;
    if(!P.sizes.some(function(x){ return String(x.q)===String(draft.q); })) draft.q=String(P.sizes[0].q);
    /* S4 4.7: AN ASSOCIATE IS ASKED WHO IT IS FOR, FIRST (v702's tick, which was the last field and easy to pass). Nothing is
       chosen for them: Review waits for the answer, and every order asks again. Nobody else is asked. */
    if(assoc) B.appendChild(oChoice('Who is it for?',[['me','Me'],['friend','A friend']],draft.forFriend==null?'':(draft.forFriend?'friend':'me'),'for',
      function(v){ draft.forFriend=(v==='friend'); sheetDraw(); }));
    /* v695: a product is a mark named by its shape; with one on the list the tiles say which by their legend */
    if(S.length>1) B.appendChild(oChoice('',S.map(function(x){ return [x.product,psym(x.product,24),pshape(x.product)]; }),draft.product,'prod',
      function(v){ draft.product=v; draft.q=null; var U=oUsual(); if(U&&U.product===v&&oSoldHas(v,U.q)) draft.q=String(U.q); sheetDraw(); }));
    var fs=el('fieldset','salt-options');
    if(S.length>1) fs.setAttribute('aria-label','Size');
    else { var lg=el('legend','salt-options__legend'); lg.appendChild(withMark(P.product,'',22)); fs.appendChild(lg); }
    var grid=el('div','salt-options__grid salt-options__grid--2'), U=oUsual();
    P.sizes.forEach(function(x){
      var lab=el('label','salt-option'), r=el('input','salt-option__input');
      r.type='radio'; r.name='osize'; r.value=String(x.q); r.checked=String(x.q)===String(draft.q); r.setAttribute('data-k','size:'+x.q);
      r.addEventListener('change',function(){ draft.q=String(x.q); sheetDraw(); });
      var face=el('span','salt-option__face'), tx=el('span','salt-option__text'), lb=el('span','salt-option__label',unitsOf(x.q,P.unit));
      if(U&&U.product===P.product&&String(U.q)===String(x.q)) lb.appendChild(el('span','salt-status salt-status--brass','your usual'));
      tx.appendChild(lb); tx.appendChild(el('span','salt-option__figure',rm(x.price)));
      face.appendChild(tx); lab.appendChild(r); lab.appendChild(face); grid.appendChild(lab);
    });
    fs.appendChild(grid); B.appendChild(fs);
    B.appendChild(oChoice('How it reaches you',[['collect','I will collect'],['deliver','Deliver to me']],draft.mode,'mode',
      function(v){ draft.mode=v; sheetDraw(); }));
    /* v694: a delivery says roughly where it is going, in his words a general location; never an address */
    if(draft.mode==='deliver'){
      var wf=el('div','salt-field'), wl=el('label','salt-field__label','Where to'); wl.htmlFor='oWhere';
      var wi=el('input','salt-field__input'); wi.id='oWhere'; wi.type='text'; wi.maxLength=60; wi.value=draft.place||''; wi.autocomplete='off';
      wi.placeholder='a neighbourhood or a landmark'; wi.setAttribute('data-k','where');
      var wh=el('span','salt-field__hint',whereHint());
      wi.addEventListener('input',function(){ draft.place=wi.value; wh.textContent=whereHint(); formFoot(); });
      wf.appendChild(wl); wf.appendChild(wi); wf.appendChild(wh); B.appendChild(wf);
    }
    /* v751: a line with it, never required; it opens the order's thread. Folded until it is wanted */
    if(draft.noteOpen||String(draft.say||'').trim()){
      var nf=el('div','salt-field'), nl=el('label','salt-field__label','Note'); nl.htmlFor='oSay';
      var ni=el('input','salt-field__input'); ni.id='oSay'; ni.type='text'; ni.maxLength=140; ni.value=draft.say||''; ni.autocomplete='off';
      ni.placeholder='optional, a line about this order'; ni.setAttribute('data-k','say');
      ni.addEventListener('input',function(){ draft.say=ni.value; });
      nf.appendChild(nl); nf.appendChild(ni); B.appendChild(nf);
    } else {
      var an=el('button','salt-ghost ofull','Add a note'); an.type='button'; an.id='oAddNote'; an.setAttribute('data-k','addnote');
      an.addEventListener('click',function(){ draft.noteOpen=true; sheetDraw(); var f=document.getElementById('oSay'); if(f) try{ f.focus(); }catch(e){} });
      B.appendChild(an);
    }
    formFoot();
  }
  /* the foot alone, so typing a place never redraws the field under the thumb */
  function formFoot(){
    var F=osh.foot; F.textContent='';
    var qt=quoteFor(), why=formWhy(), t=el('div','ototal');
    t.appendChild(el('b','salt-kpi__value',qt?rm(qt.total):''));
    t.appendChild(el('span','sub2',why||(draft.mode==='deliver'?'and delivery, set when we confirm':'to collect')));
    F.appendChild(t);
    var go=el('button','salt-pill salt-pill--md','Review'); go.type='button'; go.id='oGo'; go.disabled=!!why; go.setAttribute('data-k','review');
    go.addEventListener('click',reviewSheet);
    F.appendChild(go); F.hidden=false;
  }
  /* REVIEW FREEZES THE ORDER. The check draws from this copy and Place sends this copy, so what is placed is what
     was shown; the request id is minted with it, and a retry of Place is the same order under the same id */
  function reviewSheet(){
    var qt=quoteFor(); if(!qt||formWhy()) return;
    draft.check={product:qt.p.product, unit:qt.p.unit||'unit', q:qt.q, mode:draft.mode,
      place:draft.mode==='deliver'?String(draft.place||'').trim():'', say:String(draft.say||'').trim(),
      forFriend:!!(assoc&&draft.forFriend), total:qt.total, rate:qt.unit, rid:mintRid(),
      /* S4 4.4: the stamp of the list this price was read from, and the price as shown, for a moved list to be told against */
      digest:(prices&&prices.digest)||'', shown:qt.total, was:null, gone:false};
    draft.step='check'; draft.snote=''; sheetDraw();
  }
  /* S4 4.4: THE LIST MOVED BETWEEN REVIEW AND PLACE. The Worker compares the stamp Place carried with the account's own
     and, where they differ, answers 409 with the list as it stands, sealed; it is opened here with the key the page
     already holds. The check then shows this size at the new figure beside the one they were shown, and Place becomes
     Place at that figure, one tap; nothing is placed until it is tapped. The page compares nothing and prices nothing:
     it reads the figure off the list. A price that did not move for this size keeps the check as it was, with the new
     stamp. A new figure is a different order, so it takes a new request id. */
  async function pricesMoved(envl){
    var c=draft.check, k=prices&&prices._k, fresh=null;
    try{ fresh=(k&&envl)?await openList(k,envl):null; }catch(e){ fresh=null; }
    if(!c) return;
    /* the list as the account holds it now, or none where it holds none (or none this key opens), which is what a
       sign-in would show; with nothing left to order, the check says so and Place is held, where "open your prices
       again" reopened the same list and met the same refusal */
    prices=fresh; drawPrices(); drawOrder();
    if(!sold().length){ c.shut=true; draft.snote=noOrderLine(); return; }
    var P=(fresh.products||[]).filter(function(x){ return x.product===c.product&&x.sizes&&x.sizes.length; })[0];
    var z=P&&P.sizes.filter(function(x){ return String(x.q)===String(c.q); })[0];
    c.digest=fresh.digest||'';
    if(!z){ c.gone=true; c.was=null; return; }
    if(Math.abs(z.price-c.total)>0.004){ c.total=z.price; c.rate=+(z.price/z.q).toFixed(2); c.rid=mintRid(); }
    else draft.snote='Your prices were updated just now. This size is still '+rm(c.total)+'.';
    c.was=Math.abs(c.total-c.shown)>0.004?c.shown:null;
  }
  /* S4 4.6: FIVE OPEN ORDERS ARE SAID BEFORE THE FORM, not after it. The Worker refuses a sixth (MAX_OPEN in
     stmt/orders.js, carried here), and the refusal used to come after the form was filled and checked. With five open the
     sheet opens on the limit instead, naming the open orders, each with Cancel where the goods have not moved, and moves on
     to the form of its own accord once one is cancelled or finishes. */
  function limitLine(n){ return 'You have '+n+' orders open, the most at one time. Cancel one, or wait for one to finish, and you can order again.'; }
  function drawLimit(){
    sheetHead('New order');
    var B=osh.body, open=oLive();
    var say=el('p','salt-insight salt-insight--copper',limitLine(open.length)); say.setAttribute('role','status'); B.appendChild(say);
    var L=el('div','salt-ledger salt-ledger--plain');
    open.forEach(function(o){
      var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label');
      lab.appendChild(withMark(o.product,unitsOf(o.qty,oUnit(o))+' ',16));
      /* the order's own word, stage 5's (stateWord, over oWord), as its row under Your orders says it; goods handed over in
         part keep an order open at ready, so they read as the banner's part word, never Ready over "part of it is with you" */
      var mv=+o.moved||0, part=mv>0&&!movedAll(o), dl=o.mode==='deliver';
      lab.appendChild(document.createTextNode(', '+(part?(dl?'Part delivered':'Part collected'):stateWord(o))));
      l.appendChild(lab); l.appendChild(el('span','salt-ledger__value',rm(o.total+(+o.delivery||0)))); r.appendChild(l);
      if(!(+o.moved>0)){
        var row=el('div','olim'); row.appendChild(el('span','salt-ledger__flag','Placed '+stamp(o.at)));
        var cb=el('button','salt-ghost','Cancel this order'); cb.type='button'; cb.setAttribute('data-k','cancel:'+o.id);
        cb.addEventListener('click',function(){ limitCancel(o); }); row.appendChild(cb); r.appendChild(row);
      } else r.appendChild(el('span','salt-ledger__flag',part?'Part of it is with you, so this one finishes once the rest is with you'
        +((+o.paid||0)<(+o.total||0)+(+o.delivery||0)-0.004?' and it is paid.':'.'):'The goods are with you, so this one finishes when it is paid.'));
      if(draft.limTap&&draft.limTap.id===o.id) r.appendChild(statusLine(draft.limTap.t));
      L.appendChild(r);
    });
    B.appendChild(L);
  }
  async function limitCancel(o){
    var paid=+o.paid||0;
    if(!confirm(paid>0?'Cancel this order? The '+rm(paid)+' you paid is refunded.':'Cancel this order?')) return;
    var mine=ticket, r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{rid:ridFor(o.id+':cancel','')});
    if(mine!==ticket) return;
    if(r.body.ok) ridDone(o.id+':cancel');
    draft.limTap=r.body.ok?null:{id:o.id, t:r.body.error||'It could not be cancelled.'};
    await loadOrders(); if(mine!==ticket) return;
    drawOrder(); sheetDraw();
  }
  function toForm(){ draft.step='form'; draft.check=null; draft.snote=''; sheetDraw(); }
  function drawCheck(){
    var c=draft.check, B=osh.body;
    sheetHead('Check your order',toForm);
    var L=el('div','salt-ledger salt-ledger--plain');
    function row(k,v){ var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), val=el('span','salt-ledger__value');
      l.appendChild(el('span','salt-ledger__label',k)); if(typeof v==='string') val.textContent=v; else val.appendChild(v);
      l.appendChild(val); r.appendChild(l); L.appendChild(r); }
    if(assoc) row('For',c.forFriend?'A friend':'Me');
    row('What',withMark(c.product,unitsOf(c.q,c.unit)+' ',16));
    row('Price',rm(c.total));
    row('How',c.mode==='deliver'?'Delivered to '+c.place:'You collect it');
    if(c.mode==='deliver') row('Delivery','Set when we confirm');
    if(c.say) row('Note',c.say);
    B.appendChild(L);
    /* S4 4.4: a list re-struck since it was opened is said here, before anything is placed, and Place names the new figure */
    if(c.was!=null){ var mv=el('p','salt-insight salt-insight--copper'); mv.setAttribute('role','status');
      mv.appendChild(document.createTextNode('This size is now ')); mv.appendChild(el('b',null,rm(c.total)));
      mv.appendChild(document.createTextNode(' (was '+rm(c.was)+'). Place at '+rm(c.total)+'?')); B.appendChild(mv); }
    if(c.gone){ var gn=el('p','salt-insight salt-insight--copper','This size is no longer on your list. Change it to pick another.');
      gn.setAttribute('role','status'); B.appendChild(gn); }
    /* S4 4.9: a delivery is checked beside the one sentence that says how its charge is set */
    if(c.mode==='deliver') B.appendChild(el('p','salt-insight',DELIVERY));
    var F=osh.foot;
    var bk=el('button','salt-ghost','Change'); bk.type='button'; bk.id='oBack'; bk.disabled=!!draft.busy; bk.setAttribute('data-k','change');
    bk.addEventListener('click',toForm); F.appendChild(bk);
    var pl=el('button','salt-pill salt-pill--md',c.was!=null?'Place at '+rm(c.total):'Place order'); pl.type='button'; pl.id='oPlace';
    pl.disabled=!!draft.busy||!!c.gone||!!c.shut; pl.setAttribute('data-k','place');
    pl.addEventListener('click',oPlaceIt); F.appendChild(pl);
    /* the answer is drawn beside Place, which is what was tapped */
    if(draft.snote) F.appendChild(statusLine(draft.snote));
  }
  async function oPlaceIt(){
    var c=draft.check; if(!c||draft.busy) return;
    draft.busy=true; draft.snote=''; sheetDraw();
    var mine=ticket;
    var r=await api('/orders',{product:c.product,qty:c.q,mode:c.mode,unit:c.rate,total:c.total,place:c.place,
      forFriend:!!(assoc&&c.forFriend),note:c.say,rid:c.rid,week:(prices&&prices.week&&prices.week.monday)||'',digest:c.digest});
    if(mine!==ticket) return;
    draft.busy=false;
    if(r.status===409&&r.body.error==='prices moved'){ await pricesMoved(r.body.prices); if(mine!==ticket) return; sheetDraw(); return; }
    if(!r.body.ok){
      draft.snote=r.body.error||'The order was not placed.';
      /* S4 4.6: a refusal that the open orders explain (placed from another phone meanwhile) turns to the limit itself */
      if(r.status===400){ await loadOrders(); if(mine!==ticket) return; drawOrder();
        if(oLive().length>=OMAX){ draft.step='limit'; draft.check=null; draft.snote=''; } }
      sheetDraw(); return;
    }
    /* S4 4.5: Sent answers in the sheet; the Order tab behind it is drawn again with the order in it */
    var o=r.body.order;
    draft.sent=(o&&o.id)||''; draft.step='sent'; draft.check=null; draft.say=''; draft.noteOpen=false; draft.pushNote=''; draft.buzzNo=false; draft.forFriend=null;
    sheetDraw();
    await loadOrders(); if(mine!==ticket) return;
    drawOrder();
  }
  /* S4 4.5: SENT, AND THE ONE QUESTION WORTH ASKING THEN. An order placed is the moment a buzz means something (it says
     when the order is confirmed), so the question is asked here and put only by a tap: nothing is asked as the sheet
     draws. A phone that is already on is not asked; a browser that cannot be woken is told how to become one that can.
     See the order closes the sheet on the order itself. */
  function drawSent(){
    sheetHead(null);
    var B=osh.body, top=el('div','osent');
    top.appendChild(oGlyph('tick','otick',40));
    var h=el('h2','salt-sheet__title','Order sent'); h.id='oshT'; top.appendChild(h);
    top.appendChild(el('p',null,'It is under Your orders now. We confirm it there, and you pay once it is confirmed.'));
    B.appendChild(top);
    var can=('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
    var on=!!draft.pushed||(can&&Notification.permission==='granted'&&!!draft.pushDone);
    if(on){ if(draft.buzzAsked) B.appendChild(statusLine('On. This phone is told when it is confirmed.')); }
    else if(!draft.buzzNo&&!(can&&Notification.permission==='denied')){
      var bx=el('div','salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm obuzz');
      bx.appendChild(el('p','salt-eyebrow salt-eyebrow--brass','A buzz when it is confirmed?'));
      if(!can) bx.appendChild(el('p',null,'This browser cannot give notifications. On an iPhone, add this page to the Home Screen from the Share menu and open it from there.'));
      else {
        bx.appendChild(el('p',null,'Only for your orders and your payments.'));
        var yes=el('button','salt-pill salt-pill--md','Turn on notifications'); yes.type='button'; yes.id='oBuzz'; yes.setAttribute('data-k','buzz');
        yes.disabled=!!draft.buzzBusy;
        yes.addEventListener('click',async function(){
          if(draft.buzzBusy) return;
          draft.buzzBusy=true; draft.buzzAsked=true; draft.pushNote=''; sheetDraw();
          await subscribePush(); draft.buzzBusy=false; sheetDraw();
        });
        var no=el('button','salt-ghost','Not now'); no.type='button'; no.setAttribute('data-k','nobuzz');
        no.addEventListener('click',function(){ draft.buzzNo=true; sheetDraw(); });
        bx.appendChild(yes); bx.appendChild(no);
        if(draft.pushNote) bx.appendChild(statusLine(draft.pushNote));
      }
      B.appendChild(bx);
    }
    var see=el('button','salt-ghost ofull','See the order'); see.type='button'; see.id='oSee'; see.setAttribute('data-k','see');
    /* stage 5's own screen for it; an order the list has not brought back yet opens on the next draw that has it */
    see.addEventListener('click',function(){ var id=draft.sent; sheetClose(); showTab('order');
      if(id&&oFind(id)) oOpen(id); else { wantOrder=id||''; drawOrder(); } });
    B.appendChild(see);
  }
  /* what the tab above the orders is drawn off: the Pay page, or New order and the limit in its place. A re-read of the
     account (a return to the page, a lapse reopened, S3 3.5) that changes it, or an order opening or closing across the
     limit, draws the tab again; otherwise the orders are patched (S5 5.5). The order sheet is never drawn by either:
     it lives at the root of the body, and only the limit step, which holds nothing typed, follows the orders */
  var drawnSig='';
  function formSig(){ return JSON.stringify([hold,owedNow,view,assoc,prices,oLive().length>=OMAX]); }
  function drawOrder(){
    var sc=window.scrollY;
    drawnSig=formSig();
    /* 24 Sep 2026: a redraw (a poll, another order's tap) rebuilt the thread box empty and took the caret away
       mid-sentence; the line is kept per order in draft.says, and the box that had the caret gets it back */
    var fo=document.activeElement, keep=fo&&fo.getAttribute&&pOrder.contains(fo)?fo.getAttribute('data-say'):null,
        sel=keep?[fo.selectionStart,fo.selectionEnd]:null;
    pOrder.textContent='';
    pOrder.appendChild(el('h2',null,hold?'Payment due':'Order'));
    if(view) pOrder.appendChild(el('p','lead','Read only: their orders as their own page shows them. Nothing here is placed, paid or sent.'));
    if(hold){
      var dueBox=el('div','pane');
      dueBox.appendChild(el('div','quote',rm(owedNow)));
      dueBox.appendChild(el('p','lead','Please pay the overdue amount of '+rm(owedNow)+' before placing another order.'));
      dueBox.appendChild(el('p','sub2','Ordering opens again here once the payment is recorded on your account. Each order the amount is made of is on your statement.'));
      var ways=PAY.filter(function(a){ return !a.maintenance&&(a.qr||a.transfer); });
      if(ways.length){
        dueBox.appendChild(el('span','lbl','Ways to pay'));
        ways.forEach(function(a){
          var l=el('a','btn lnk salt-ghost','Open '+a.name+' in QR Command');
          l.href=PAY_SITE+'/#'+encodeURIComponent(a.key); l.target='_blank'; l.rel='noopener';
          dueBox.appendChild(l);
        });
      }
      dueBox.appendChild(el('p','sub2','Once it has left your side, say so on any of your orders below, or tell us directly, so it can be recorded.'));
      var sv=el('button','btn quiet salt-ghost','See your statement'); sv.type='button';
      sv.addEventListener('click',function(){ showTab('stmt'); });
      dueBox.appendChild(sv);
      /* 24 Sep 2026: the note was drawn in the order form alone, which this page never shows */
      if(draft.note) dueBox.appendChild(statusLine(draft.note));
      pOrder.appendChild(dueBox);
    } else if(view){
      /* no order form on his read-only view */
    } else if(!sold().length){
      pOrder.appendChild(el('p','lead',noOrderLine()));
    } else {
      /* S4 4.3: the form is a sheet now, laid over the page from here */
      pOrder.appendChild(el('p','lead','Pick a size and check it over before you place it. Once we confirm it you can pay, and you are told when the goods are on their way.'));
      var full=oLive().length>=OMAX;
      if(full){ var lim=el('p','salt-insight salt-insight--copper',limitLine(oLive().length)); lim.id='oLimit'; pOrder.appendChild(lim); }
      else {
        var nb=el('button','btn salt-pill salt-pill--md','New order'); nb.type='button'; nb.id='oNew';
        nb.addEventListener('click',function(){ sheetOpen(null,null,nb); });
        pOrder.appendChild(nb);
      }
      if(osh&&draft.step==='limit') sheetDraw();
    }
    /* notifications: a wake on the phone when the order moves, so the page need not stay open.
       Not on his read-only view: those are not his phones. */
    var np=el('div','pane');
    np.appendChild(el('h3',null,'Notifications'));
    var canPush=('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
    if(!canPush){
      np.appendChild(el('p','sub2','This browser cannot receive notifications. On an iPhone, add this page to the Home Screen from the Share menu and open it from there; otherwise keep the page open and it checks every ten seconds.'));
    } else if(draft.pushed||Notification.permission==='granted'&&draft.pushDone){
      np.appendChild(el('p','sub2','On. You will be told when your order changes, when there is a reply, and at 10:00 and 18:00 when a payment is due.'));
    } else {
      np.appendChild(el('p','sub2','Be told on this phone when your order changes, when there is a reply, and at 10:00 and 18:00 when a payment is due. The banner says only what kind of news it is, never an amount or which order, and a tap opens the order.'));
      var nb=el('button','btn quiet salt-ghost','Notify me on this phone'); nb.type='button';
      nb.addEventListener('click', subscribePush); np.appendChild(nb);
      if(draft.pushNote) np.appendChild(el('p','msg',draft.pushNote));
    }
    if(!view) pOrder.appendChild(np);
    pOrder.appendChild(oPlace());
    if(keep){ var kbox=[].filter.call(pOrder.querySelectorAll('input[data-say]'),function(x){ return x.getAttribute('data-say')===keep; })[0];
      if(kbox){ try{ kbox.focus({preventScroll:true}); kbox.setSelectionRange(sel[0],sel[1]); }catch(e){} } }
    window.scrollTo(0,sc);
    openWanted();
  }

  /* S5 5.3 (D11, his answer of 24 Sep 2026): WHERE AN ORDER IS, IN THE CUSTOMER'S WORDS. The record's states are the
     desk's; they read Sent, Confirmed, Ready to collect or to deliver, Collected or Delivered once the goods are all
     with them, Complete, Not taken, and Cancelled by you or by us, read off who cancelled it. Never Acknowledged,
     Withdrawn or handed over. The tone follows the word: steel and dashed while it waits on us, brass ready,
     verdigris confirmed or moved, mist closed. */
  function oWord(st,o,by){
    var d=o.mode==='deliver';
    return {placed:'Sent', acknowledged:'Confirmed', ready:d?'Ready to deliver':'Ready to collect', done:'Complete', declined:'Not taken',
      cancelled:by==='desk'?'Cancelled by us':'Cancelled by you'}[st]||st;
  }
  /* S11 11.7: the event that ended an order, whose note is his reason for a decline or a cancellation of his */
  function endOf(o){ var h=(o.history||[]).filter(function(x){ return x&&x.status===o.status; }); return h.length?h[h.length-1]:null; }
  function stateWord(o){
    if(oPayable(o)&&movedAll(o)) return o.mode==='deliver'?'Delivered':'Collected';
    var e=endOf(o);
    return oWord(o.status,o,e?e.by:'');
  }
  function stateChip(o,cls){
    var s=o.status, tone=s==='placed'?'steel salt-status--dashed':s==='ready'&&!movedAll(o)?'brass':(s==='acknowledged'||s==='done'||oPayable(o))?'verdigris':'mist';
    return el('span',(cls?cls+' ':'')+'salt-status salt-status--'+tone,stateWord(o));
  }
  /* what happened, a step a line, in the same words: the record's notes are the desk's shorthand */
  function histLine(x,o){
    var n=String(x.note||''), m, how=x.method?' by '+methodWord(x.method,x.account):'';
    if((m=/^paid ([0-9.]+)$/.exec(n))) return 'You paid '+rm(+m[1])+how;
    if((m=/^payment of ([0-9.]+) recorded$/.exec(n))) return 'We recorded a payment of '+rm(+m[1]);
    /* S11 11.8 and 11.9: cash he took at the handover, and a short order closed at what was handed over */
    if((m=/^paid ([0-9.]+) in cash$/.exec(n))) return 'We received '+rm(+m[1])+' in cash';
    if((m=/^closed at ([0-9.]+) unit of the ([0-9.]+) ordered$/.exec(n))) return 'Closed at '+unitsOf(+m[1],oUnit(o))+' of the '+m[2]+' ordered';
    if((m=/^([0-9.]+) unit (delivered|collected)$/.exec(n))) return unitsOf(+m[1],oUnit(o))+' '+m[2];
    if(x.method) return 'You chose to pay'+how;
    return oWord(x.status,o,x.by)+(n?': '+n:'');
  }
  /* v694: money and goods are two tracks, so what is still owed and what is still to come are read
     off the order, never off a single word of state. Both figures are the ones the desk holds. */
  function dueOf(o){ return +((o.total+(+o.delivery||0))-(+o.paid||0)).toFixed(2); }
  /* an advance as the engine reads it: the share of the goods handed over above the share paid */
  function aheadOnGoods(o){ var owed=o.total+(+o.delivery||0), pf=owed>0?(+o.paid||0)/owed:0, mf=o.qty>0?(+o.moved||0)/o.qty:0; return mf>pf+1e-9&&dueOf(o)>0.004; }
  function heldUnpaid(){ return orders.some(function(o){ return ['cancelled','declined'].indexOf(o.status)<0&&aheadOnGoods(o); }); }
  /* THE ANSWER TO A TAP ON AN ORDER IS DRAWN BESIDE WHAT WAS TAPPED (24 Sep 2026). Every answer went
     to the form's one note, which the payment page over RM 100 never draws, so I have paid, Confirm,
     Withdraw and Send answered nothing there, and on the order page the answer sat above the form, a
     screen away. It lives in draft, so signing out and signing in forget it as they forget the rest.
     k names the control; where the answer took the control away (paid in full, withdrawn), the line
     goes under the order's state, which is where the change shows. */
  function statusLine(t){ var p=el('p','msg',t); p.setAttribute('role','status'); return p; }
  function tapSaid(o,k,t){ draft.tap=t?{id:o.id,k:k,t:t}:null; }
  /* ---- S5 5.1 (24 Sep 2026): THE ORDERS, AS ROWS. What needs them first (something to pay, a reply not yet
     read), then what is open, then the earlier orders under one fold that draws nothing until it is opened: a
     customer with sixty orders had sixty panes built on every poll. A row is one tap onto that order. ---- */
  function oFind(id){ return orders.filter(function(o){ return o.id===id; })[0]||null; }
  function oUnit(o){ var P=prices&&prices.products&&prices.products.filter(function(x){ return x.product===o.product; })[0]; return P?P.unit:'unit'; }
  function oClosed(o){ return ['done','declined','cancelled'].indexOf(o.status)>=0; }
  function oPayable(o){ return ['acknowledged','ready'].indexOf(o.status)>=0; }
  /* STAGE 6 PLUGS IN HERE: claimed is what they have said they sent above what he has confirmed, a field the
     order does not carry yet. Until it does it reads nothing, and what is still to pay is what is owed. */
  function oClaimed(o){ var c=+o.claimed; return c>0?c:0; }
  function oToPay(o){ return Math.max(0,+(dueOf(o)-oClaimed(o)).toFixed(2)); }
  function oOwes(o){ return oPayable(o)&&oToPay(o)>0.004; }
  function oDay(iso){ try{ var p=klBits(iso); return p.day+' '+MON3[+p.month-1]; }catch(e){ return ''; } }
  /* A REPLY WAITS until this device has shown it: the moment of his last line seen, per order, kept here and
     nowhere else, because there are no read receipts. The store's first moment stands for everything a closed
     order said before this device ever looked, or the first open after this shipped put every old thank-you
     under Needs you. Order ids only, never the username; where the browser keeps nothing, it lasts the visit. Log out
     takes it with the rest, so the next account on this phone starts its own; an account open for a visit over one
     the phone keeps (S3) leaves it, being the kept account's too.
     HIS READ-ONLY VIEW READS NOTHING AS NEW AND WRITES NOTHING HERE: what their phone has shown is not on his, and
     his route leaves nothing behind on his phone. */
  var SEEN='salt-stmt-seen', seenMem=null;
  function seenGet(){
    var s=null; try{ s=JSON.parse(localStorage.getItem(SEEN)||'null'); }catch(e){ s=null; }
    if(s&&typeof s.t==='string'&&s.o&&typeof s.o==='object') return s;
    if(!seenMem){ seenMem={t:new Date().toISOString(),o:{}}; if(!OWNER) seenPut(seenMem); }
    return seenMem;
  }
  function seenPut(s){ seenMem=s; try{ localStorage.setItem(SEEN,JSON.stringify(s)); }catch(e){ /* kept for this visit only */ } }
  function hisLast(o){ var m=(o.msgs||[]).filter(function(x){ return x.by==='desk'; }); return m.length?String(m[m.length-1].at||''):''; }
  function seenMark(o){ var s=seenGet(); return s.o[o.id]||(oClosed(o)?s.t:''); }
  function replyWaiting(o){ var l=hisLast(o); return !view&&!!l&&l>seenMark(o); }
  /* shown means drawn open on a tab that is showing, by a tap on its row or a banner; his read-only view marks
     nothing. An order a desk opened by itself is not shown in this sense: the order form stands above it, so its
     thread can be a screen below the fold, and a tap on its row marks it. */
  function seeIt(o){ if(view||!o||pOrder.hidden||draft.oAuto) return; var l=hisLast(o); if(!l) return; var s=seenGet(); if((s.o[o.id]||'')>=l) return; s.o[o.id]=l; seenPut(s); }
  function oNeeds(o){ return oOwes(o)||replyWaiting(o); }
  function oWhy(o){
    var b=[];
    if(oOwes(o)) b.push(rm(oToPay(o))+' to pay');
    if(replyWaiting(o)) b.push('a reply for you');
    if(!b.length&&o.status==='placed') b.push('waiting to be confirmed');
    var t=b.join(', '); return t&&t.charAt(0).toUpperCase()+t.slice(1);
  }
  /* one line: the mark and the size with the state, why it is here, then the day and the figure */
  function oRow(o,shown){
    var b=el('button','salt-inbox-row orow'); b.type='button'; b.setAttribute('data-row',o.id);
    if(o.id===shown) b.setAttribute('aria-current','true');
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title');
    t.appendChild(withMark(o.product,unitsOf(o.qty,oUnit(o)),18));
    t.appendChild(stateChip(o));
    main.appendChild(t);
    var why=oWhy(o); if(why) main.appendChild(el('span','salt-inbox-row__what',why));
    b.appendChild(main);
    var side=el('span','salt-inbox-row__side');
    side.appendChild(el('span','salt-inbox-row__age',oDay(o.at)));
    side.appendChild(el('span','salt-inbox-row__action',rm(o.total+(+o.delivery||0))));
    b.appendChild(side);
    b.addEventListener('click',function(){ oOpen(o.id); });
    return b;
  }
  function oBuckets(){ var n=[],p=[],e=[]; orders.forEach(function(o){ (oNeeds(o)?n:oClosed(o)?e:p).push(o); }); return {needs:n,open:p,past:e}; }
  function oList(shown){
    var box=el('div','olist'); box.setAttribute('data-olist','');
    if(!orders.length){ box.appendChild(el('p','lead','None yet.')); return box; }
    var B=oBuckets();
    function sec(t,list){ box.appendChild(el('h3','salt-eyebrow salt-eyebrow--copper olab',t)); list.forEach(function(o){ box.appendChild(oRow(o,shown)); }); }
    if(B.needs.length) sec('Needs you',B.needs);
    if(B.open.length) sec('Open',B.open);
    if(B.past.length){
      var eb=el('button','salt-ghost olater',B.past.length+' earlier order'+(B.past.length===1?'':'s')); eb.type='button';
      eb.setAttribute('aria-expanded',draft.oEarlier?'true':'false');
      eb.addEventListener('click',function(){ draft.oEarlier=!draft.oEarlier; oDraw(); });
      box.appendChild(eb);
      if(draft.oEarlier) B.past.forEach(function(o){ box.appendChild(oRow(o,shown)); });
    }
    return box;
  }
  /* S5 5.6 (f12w): FROM 1080PX THE LIST STANDS BESIDE AN OPEN ORDER, so one is always open there: what needs them
     first, else the newest. It is then the one open, so it stays put while the list moves under a poll. An order
     opened this way is marked oAuto, and goes when the width drops below 1080px: on a phone nothing is open until
     it is tapped. */
  function oWide(){ try{ return !!(window.matchMedia&&window.matchMedia('(min-width: 1080px)').matches); }catch(e){ return false; } }
  function oShownId(){
    if(draft.oOpen&&!oFind(draft.oOpen)) draft.oOpen='';
    if(!draft.oOpen&&orders.length&&oWide()){ var B=oBuckets(); draft.oOpen=(B.needs[0]||B.open[0]||B.past[0]).id; draft.oAuto=true; }
    return draft.oOpen||'';
  }
  try{
    var oMq=window.matchMedia&&window.matchMedia('(min-width: 1080px)');
    if(oMq&&oMq.addEventListener) oMq.addEventListener('change',function(){
      if(!oWide()&&draft.oAuto){ draft.oOpen=''; draft.oAuto=false; }
      if(document.getElementById('oArea')) oDraw();
    });
  }catch(e){ /* a browser that cannot say keeps the phone's one column */ }
  /* ---- S5 5.2 (24 Sep 2026): AN ORDER'S OWN SCREEN. The goods on their own track (Sent, Confirmed, Ready, then
     Collected or Delivered), so Paid can never run ahead of Delivered; the money on its own lines; ONE next action,
     the filled Pay while something is due and nothing filled when nothing is; the thread; what happened, folded;
     and Cancel at the foot while the goods have not moved. Built in named parts, each rebuilt on its own. ---- */
  function movedAll(o){ var m=+o.moved||0; return m>0&&m>=(+o.qty||0)-0.0004; }
  function firstAt(o,st){ var h=(o.history||[]).filter(function(x){ return x.status===st; })[0]; return h?h.at:''; }
  function ymdDay(s){ var m=/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(s||'')); return m?m[3]+' '+MON3[+m[2]-1]:''; }
  /* what the last tap on this order said, beside the control it came from; where the answer took the control away
     (paid in full, cancelled), under the order's state, which is where the change shows */
  function oTap(o){
    var tap=(draft.tap&&draft.tap.id===o.id)?draft.tap:null, k=tap&&tap.k;
    if(k==='pay'&&!oOwes(o) || k==='withdraw'&&!((oPayable(o)||o.status==='placed')&&!(+o.moved>0))) k='state';
    return {k:k, t:tap?tap.t:''};
  }
  function oHead(o){
    var h=el('div','ohead'), t=el('h3');
    t.appendChild(psym(o.product,26)); t.appendChild(document.createTextNode(' '+unitsOf(o.qty,oUnit(o)))); t.appendChild(el('span','sr',pshape(o.product)));
    h.appendChild(t);
    h.appendChild(stateChip(o,'state'));
    h.appendChild(el('p','sub2','Ordered '+stamp(o.at)+(o.mode==='deliver'?', to be delivered'+(o.place?' to '+o.place:''):', to collect')
      +(o.forFriend?', on behalf of a friend':'')));
    return h;
  }
  /* GOODS ONLY: a declined or cancelled order has no track to show */
  function oSteps(o){
    var w=el('div');
    if(o.status==='declined'||o.status==='cancelled') return w;
    var names=['Sent','Confirmed','Ready',o.mode==='deliver'?'Delivered':'Collected'];
    var cur=o.status==='done'?4:movedAll(o)?3:(o.status==='ready'||(+o.moved||0)>0)?2:o.status==='acknowledged'?1:0;
    var ol=el('ol','salt-steps'); ol.setAttribute('aria-label','Where the goods are');
    names.forEach(function(n,i){
      var li=el('li','salt-steps__step'+(i<cur?' salt-steps__step--done':i===cur?' salt-steps__step--now':''),n);
      if(i===cur) li.setAttribute('aria-current','step');
      ol.appendChild(li);
    });
    w.appendChild(ol); return w;
  }
  /* where it stands and when, in one sentence, off the record's own moments. S11 11.7: an order he ended says so
     with his reason; S11 11.9: one he closed at what was handed over says the size it was and the size it is. */
  function oWhen(o){
    var w=el('div'), p=el('p','salt-insight'), d=o.mode==='deliver', mv=+o.moved||0, paid=+o.paid||0, s=o.status, e=endOf(o),
        why=e&&e.note?': '+e.note:'', back=paid>0?'The '+rm(paid)+' you paid is refunded.':'Nothing is owed.';
    function put(a,b,c){ p.appendChild(document.createTextNode(a)); if(b){ p.appendChild(el('b',null,b)); p.appendChild(document.createTextNode(c||'')); } }
    if(s==='placed') put('Waiting to be confirmed. You will see it change here.');
    else if(s==='done') put('Your order is now complete. Thank you for your loyalty.');
    else if(s==='declined') put('Not taken'+why+'. '+back);
    else if(s==='cancelled'&&e&&e.by==='desk') put('Cancelled by us'+why+'. '+back);
    else if(s==='cancelled') put(paid>0?'Cancelled. The '+rm(paid)+' you paid is refunded.':'Cancelled before anything moved. Nothing is owed.');
    else if(movedAll(o)) put(d?'Delivered on ':'Collected on ',ymdDay(o.movedOn)||'the day it went','.');
    else if(mv>0) put(unitsOf(mv,oUnit(o))+' of '+unitsOf(o.qty,oUnit(o))+(d?' delivered on ':' collected on '),ymdDay(o.movedOn)||'the day it went','.');
    else if(s==='ready') put(d?'Ready to deliver, since ':'Ready to collect, since ',oDay(firstAt(o,'ready')),'.');
    else put('Confirmed on ',oDay(firstAt(o,'acknowledged')),', and being prepared.');
    if(o.closed&&o.closed.qty) put(' Closed at '+unitsOf(o.qty,oUnit(o))+' of the '+o.closed.qty+' ordered, '+rm(o.total)+' for the goods.');
    w.appendChild(p);
    var tp=oTap(o); if(tp.k==='state'&&tp.t) w.appendChild(statusLine(tp.t));
    return w;
  }
  function lrow(label,value,flag,cls){
    var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line');
    l.appendChild(el('span','salt-ledger__label',label)); l.appendChild(el('span','salt-ledger__value'+(cls?' '+cls:''),value));
    r.appendChild(l); if(flag) r.appendChild(el('span','salt-ledger__flag',flag));
    return r;
  }
  /* THE MONEY ON ITS OWN LINES: the goods, the delivery, what is paid, what they have sent and is waiting, and what
     is still to pay, with when it may be paid */
  function oMoney(o){
    var L=el('div','salt-ledger salt-ledger--plain'), paid=+o.paid||0, claimed=oClaimed(o), d=o.mode==='deliver', where=o.place?'To '+o.place:'';
    /* S11 11.9: a short order closed at what was handed over is billed for that, and its Goods line says so */
    L.appendChild(lrow('Goods',rm(o.total),o.closed&&o.closed.qty?unitsOf(o.qty,oUnit(o))+' handed over of the '+o.closed.qty+' ordered':''));
    if(d) L.appendChild(o.status==='placed'?lrow('Delivery','',(where?where+'. ':'')+'Set when we confirm the order'):lrow('Delivery',rm(o.delivery||0),where));
    if(paid>0) L.appendChild(lrow('Paid',rm(paid)));
    if(claimed>0) L.appendChild(lrow('Sent by you',rm(claimed),'Waiting for us to confirm it arrived'));
    if(oPayable(o)){
      var tp=oToPay(o), mv=+o.moved||0;
      L.appendChild(tp>0.004
        ?lrow('Still to pay',rm(tp),mv>0?(movedAll(o)?'The goods are with you':'Part of the goods is with you'):(d?'Now, or when it arrives':'Now, or when you collect'),'odue')
        :lrow('Still to pay',rm(0),'Paid in full'));
    }
    return L;
  }
  /* ONE NEXT ACTION. Pay opens the ways to pay in its place, and theirs is then the one filled control. On a desk New
     order (S4 4.3; the form itself is a sheet over the page) stands above the open order, and while it does, Pay is the
     lit ghost: one filled control a screen. With the limit said in its place, or the Pay page, nothing else is filled and
     Pay is. On a phone the open order is the whole tab. */
  function oFormPill(){ return oWide()&&[].some.call(pOrder.querySelectorAll('.salt-pill'),function(p){ return !p.closest('.oplace'); }); }
  function oAct(o){
    var a=el('div','oact'), tp=oTap(o);
    if(!view&&oOwes(o)){
      if((draft.oPay||{})[o.id]) a.appendChild((o.method&&!(pick[o.id]||{}).again)?payBox(o):payChooser(o));
      else {
        var pb=el('button',oFormPill()?'salt-ghost salt-ghost--lit':'salt-pill salt-pill--md','Pay '+rm(oToPay(o))); pb.type='button';
        pb.addEventListener('click',function(){ (draft.oPay=draft.oPay||{})[o.id]=true; oDraw(); });
        a.appendChild(pb);
      }
    }
    if(tp.k==='pay'&&tp.t) a.appendChild(statusLine(tp.t));
    return a;
  }
  /* ---- S5 5.4 (24 Sep 2026): THE MESSAGES, on the system's Bubble and thread. Their lines stand right with where
     each one is: Sending, Sent (stored, never read: there are no read receipts), or, lost on the way, Not sent with
     Tap to try again, which carries the line's own id, so a line that did arrive is not recorded twice. His stand left, marked New
     until this device has shown them. The composer is a form, so Return sends; the line typed is kept per order
     until it goes, and the box is emptied the moment it does, the line then living in its bubble. ---- */
  function oOut(id){ var q=(draft.oOut=draft.oOut||{}); return q[id]||(q[id]=[]); }
  /* A LINE STORED WHOSE ANSWER WAS LOST stood twice, Sent from the thread and Not sent from here. An out line also
     goes once the thread holds more of their lines in its words than it did when it was sent (n), so a line said
     twice on purpose is still two. The words are compared as the site keeps them, spaces run together. */
  function oWords(s){ return String(s||'').split(' ').filter(Boolean).join(' ').slice(0,200); }
  function oSame(o,w){ return (o.msgs||[]).filter(function(m){ return m.by==='customer'&&oWords(m.text)===w; }).length; }
  function oLanded(o){ var q=oOut(o.id); for(var i=q.length-1;i>=0;i--) if(oSame(o,q[i].w)>q[i].n) q.splice(i,1); return q; }
  function oPut(v){ for(var i=0;i<orders.length;i++) if(orders[i].id===v.id){ orders[i]=v; return; } }
  function bubble(side,text,meta,state,isNew){
    var b=el('div','salt-bubble salt-bubble--'+side+(state==='failed'?' salt-bubble--failed':''));
    b.appendChild(el('p','salt-bubble__text',text));
    var m=el('p','salt-bubble__meta'); m.appendChild(el('span',null,meta));
    if(isNew) m.appendChild(el('span','salt-bubble__new','New'));
    if(state) m.appendChild(el('span','salt-bubble__state salt-bubble__state--'+state,{sending:'Sending',sent:'Sent',failed:'Not sent'}[state]));
    b.appendChild(m);
    return b;
  }
  function oThread(o){
    var w=el('div','omsgs'), msgs=o.msgs||[], out=oLanded(o), n=msgs.length+out.length, since=(draft.oSince||{})[o.id];
    if(view&&!n) return el('div');
    var h=el('h3','salt-eyebrow salt-eyebrow--copper olab'); h.appendChild(el('span',null,'Messages')); if(n) h.appendChild(el('span',null,String(n)));
    var th=el('div','salt-thread'), ls=el('div','salt-thread__lines');
    ls.setAttribute('role','log'); ls.setAttribute('aria-label','Messages on this order');
    msgs.forEach(function(m){
      var his=m.by==='desk';
      ls.appendChild(bubble(his?'theirs':'mine',m.text||'',(his?'Reply, ':'You, ')+stamp(m.at),his?'':'sent',his&&!view&&typeof since==='string'&&String(m.at)>since));
    });
    out.forEach(function(x){
      var b=bubble('mine',x.t,'You, '+stamp(x.at),x.state,false);
      if(x.state==='failed'){
        if(x.why){ var y=el('p','salt-bubble__meta',x.why); y.setAttribute('role','status'); b.appendChild(y); }
        var r=el('button','salt-ghost salt-ghost--lit salt-bubble__retry','Tap to try again'); r.type='button';
        r.addEventListener('click',function(){ oSend(o.id,x); });
        b.appendChild(r);
      }
      ls.appendChild(b);
    });
    th.appendChild(ls); w.appendChild(h); w.appendChild(th);
    return w;
  }
  /* his read-only view writes nothing; he answers on the desk */
  function oSay(o){
    var w=el('div','osay');
    if(view) return w;
    var f=el('form','salt-composer'), si=el('input','salt-field__input salt-composer__field');
    si.type='text'; si.maxLength=200; si.autocomplete='off'; si.setAttribute('enterkeyhint','send');
    si.placeholder='Write about this order'; si.setAttribute('aria-label','Write about this order');
    si.setAttribute('data-say',o.id); si.value=(draft.says||{})[o.id]||'';
    si.addEventListener('input',function(){ (draft.says=draft.says||{})[o.id]=si.value; });
    var sg=el('button','salt-ghost salt-ghost--lit salt-composer__send','Send'); sg.type='submit';
    f.appendChild(si); f.appendChild(sg);
    var tp=oTap(o), said=statusLine(tp.k==='say'?tp.t:''); said.setAttribute('data-said',''); said.hidden=!said.textContent;
    f.addEventListener('submit',function(ev){
      ev.preventDefault();
      var t=String(si.value||'').trim();
      if(!t) return;
      if(oTap(o).k==='say') tapSaid(o,'say','');
      said.textContent=''; said.hidden=true;
      var wd=oWords(t), q=oOut(o.id);
      var x={t:t, w:wd, n:oSame(oFind(o.id)||o,wd)+q.filter(function(y){ return y.w===wd; }).length, at:new Date().toISOString(), state:'sending', rid:mintRid(), why:''};
      q.push(x);
      si.value=''; if(draft.says) delete draft.says[o.id];
      oSend(o.id,x);
    });
    w.appendChild(f); w.appendChild(said);
    return w;
  }
  /* REFUSED, IT WILL BE REFUSED AGAIN (their twenty lines, a lapsed session): the words go back in the box, ahead of
     anything typed since, and the reason stands under it. Only a line the network lost is offered again. */
  function oRefused(id,x,why){
    var q=oOut(id), i=q.indexOf(x); if(i>=0) q.splice(i,1);
    var says=(draft.says=draft.says||{}); says[id]=says[id]?x.t+' '+says[id]:x.t;
    tapSaid({id:id},'say',why||'It was not sent.');
    var s=pOrder.querySelector('.oscreen[data-order="'+id+'"]'), inp=s&&s.querySelector('input[data-say]'), st=s&&s.querySelector('[data-said]');
    if(inp) inp.value=says[id];
    if(st){ st.textContent=draft.tap.t; st.hidden=false; }
    oPart(id,'thread');
  }
  /* one part of the open screen drawn again, and nothing else on it */
  function oPart(id,k){
    var s=pOrder.querySelector('.oscreen[data-order="'+id+'"]'), o=oFind(id); if(!s||!o) return;
    var was=[].filter.call(s.children,function(c){ return c.getAttribute('data-part')===k; })[0]; if(!was) return;
    var n=OPARTS[k](o); n.setAttribute('data-part',k); n.hidden=!n.childNodes.length; was.replaceWith(n);
  }
  async function oSend(id,x){
    var mine=ticket; x.state='sending'; x.why=''; oPart(id,'thread');
    var r=await api('/orders/'+encodeURIComponent(id)+'/say',{text:x.t,rid:x.rid});
    if(mine!==ticket) return;
    if(r.body&&r.body.ok){
      if(r.body.order&&r.body.order.id===id) oPut(r.body.order); else { await loadOrders(); if(mine!==ticket) return; }
      var q=oOut(id), i=q.indexOf(x); if(i>=0) q.splice(i,1);
      oPart(id,'thread');
    } else {
      var e=String((r.body&&r.body.error)||'').replace(/^Not sent[.] */,''), why=e&&e.charAt(0).toUpperCase()+e.slice(1);
      if(r.status&&r.status<500){ oRefused(id,x,why); return; }
      x.state='failed'; x.why=why; oPart(id,'thread');
    }
  }
  /* WHAT HAPPENED, STEP BY STEP, folded: the record, under the thread a reader came back for */
  function oHist(o){
    var w=el('div','ohist'), h=o.history||[];
    if(!h.length) return w;
    var dt=el('details','salt-plan'); dt.open=!!(draft.oHist||{})[o.id];
    dt.addEventListener('toggle',function(){ (draft.oHist=draft.oHist||{})[o.id]=dt.open; });
    var sm=el('summary'); sm.appendChild(el('span','salt-plan__id',String(h.length))); sm.appendChild(el('span','salt-plan__title','What happened, step by step'));
    dt.appendChild(sm);
    var b=el('div','salt-plan__body'), ul=el('ul');
    h.forEach(function(x){ ul.appendChild(el('li',null,stamp(x.at)+'  '+histLine(x,o))); });
    b.appendChild(ul); dt.appendChild(b); w.appendChild(dt);
    return w;
  }
  /* v694: either side may cancel at any stage until the goods move (his rule, 18 Sep 2026) */
  function oFoot(o){
    var f=el('div','ofoot'), tp=oTap(o);
    if(view||!(oPayable(o)||o.status==='placed')) return f;
    if(+o.moved>0) f.appendChild(el('p','sub2','The goods are with you, so this can no longer be cancelled here.'));
    else {
      var wb=el('button','salt-ghost salt-ghost--danger','Cancel this order'); wb.type='button';
      wb.addEventListener('click', async function(){
        var cur=oFind(o.id)||o, paid=+cur.paid||0;
        if(!confirm(paid>0?'Cancel this order? The '+rm(paid)+' you paid is refunded.':'Cancel this order?')) return;
        var mine=ticket; var r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{rid:ridFor(o.id+':cancel','')});
        if(mine!==ticket) return;
        if(r.body.ok) ridDone(o.id+':cancel');
        tapSaid(o,'withdraw',r.body.ok?'':(r.body.error||'It could not be cancelled.'));
        await loadOrders(); if(mine!==ticket) return; oDraw();
      });
      f.appendChild(wb);
      if(tp.k==='withdraw'&&tp.t) f.appendChild(statusLine(tp.t));
    }
    return f;
  }
  var OPARTS={head:oHead, steps:oSteps, when:oWhen, money:oMoney, act:oAct, thread:oThread, say:oSay, hist:oHist, foot:oFoot};
  function oScreen(o){
    var s=el('section','oscreen salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm'); s.setAttribute('data-order',o.id);
    s.setAttribute('aria-label','Your order of '+unitsOf(o.qty,oUnit(o))+', '+oDay(o.at));
    var back=el('button','salt-ghost salt-ghost--tight oback','Your orders'); back.type='button';
    back.addEventListener('click',function(){ var id=draft.oOpen; draft.oOpen=''; oDraw(); scrollClear(pOrder.querySelector('[data-row="'+id+'"]')); });
    s.appendChild(back);
    Object.keys(OPARTS).forEach(function(k){ var p=OPARTS[k](o); p.setAttribute('data-part',k); p.hidden=!p.childNodes.length; s.appendChild(p); });
    return s;
  }
  /* on a phone the open order is the whole tab, with the way back at its head */
  function oPlace(){
    var id=oShownId(), o=oFind(id), open=!!(draft.oOpen&&o), place=el('div','oplace'+(open?' o-open':''));
    place.id='oArea';
    pOrder.classList.toggle('o-open',open);
    /* New is read against what this device had seen when the order was opened, and stays until it is left; the
       list is drawn after the open order is seen, so its row does not call a reply on screen waiting */
    if(draft.oShown!==id){ draft.oShown=id; draft.oSince={}; }
    draft.oStale='';
    if(o&&!(id in draft.oSince)) draft.oSince[id]=seenMark(o);
    if(o) seeIt(o);
    var col=el('div','olistcol'); col.appendChild(el('h2',null,'Your orders')); col.appendChild(oList(id));
    place.appendChild(col);
    if(o) place.appendChild(oScreen(o));
    return place;
  }
  function oDraw(){ var was=document.getElementById('oArea'); if(was) was.replaceWith(oPlace()); }
  /* S5 5.5: the orders that changed, patched where they stand. The list keeps every row that did not change; a row
     that did is drawn again and keeps the focus, holding nothing typed. The open order keeps any part holding the
     focus, and draft.oStale has the next poll draw it once the focus has left; a part that reads the same is left
     as it is, which is always the composer. Only an order opened or gone draws the place again. */
  function oShape(list){ return [].map.call(list.children,function(x){ return x.getAttribute('data-row')||x.textContent; }).join('|'); }
  function oSync(ids){
    var place=document.getElementById('oArea'); if(!place) return;
    var shown=oShownId(), scr=place.querySelector('.oscreen'), sid=scr?scr.getAttribute('data-order'):'';
    if(sid!==shown){ oDraw(); return; }
    var ae=document.activeElement;
    if(scr&&ids.indexOf(sid)>=0){
      var o=oFind(sid);
      seeIt(o);
      draft.oStale='';
      Object.keys(OPARTS).forEach(function(k){
        var p=[].filter.call(scr.children,function(c){ return c.getAttribute('data-part')===k; })[0];
        if(!p) return;
        var n=OPARTS[k](o); n.setAttribute('data-part',k); n.hidden=!n.childNodes.length;
        if(n.outerHTML===p.outerHTML) return;
        if(p.contains(ae)) draft.oStale=sid; else p.replaceWith(n);
      });
    }
    var was=place.querySelector('[data-olist]'), nl=oList(shown);
    if(was&&oShape(was)!==oShape(nl)){
      var fr=ae&&was.contains(ae)?ae.getAttribute('data-row'):null;
      was.replaceWith(nl);
      var fb=fr&&nl.querySelector('[data-row="'+fr+'"]'); if(fb) try{ fb.focus({preventScroll:true}); }catch(e){}
    } else if(was) ids.forEach(function(id){
      var r=was.querySelector('[data-row="'+id+'"]'), n=nl.querySelector('[data-row="'+id+'"]');
      if(!r||!n||r.outerHTML===n.outerHTML) return;
      var had=r.contains(ae); r.replaceWith(n);
      if(had) try{ n.focus({preventScroll:true}); }catch(e){}
    });
  }
  /* an order drawn open while the tab was elsewhere is seen when the tab is turned to */
  tabs.addEventListener('click',function(){ var o=tab==='order'&&oFind(draft.oShown||''); if(o){ seeIt(o); oSync([o.id]); } });
  /* the order already open is brought into view and seen, and its row patched: drawn again, it would lose what is
     being typed in it. A banner's tap comes here too, on an order the desk opened by itself or one left open. */
  function oOpen(id){
    draft.oAuto=false;
    if(draft.oOpen!==id||!pOrder.querySelector('.oscreen[data-order="'+id+'"]')){ draft.oOpen=id; oDraw(); }
    else { seeIt(oFind(id)); oSync([id]); }
    scrollClear(pOrder.querySelector('.oscreen'));
  }
  /* clear of the sticky bar, which would otherwise sit over what was opened */
  function scrollClear(n){
    if(!n) return; var bw=document.getElementById('barw');
    try{ n.style.scrollMarginTop=Math.ceil((bw&&!bw.hidden?bw.getBoundingClientRect().bottom:0)+12)+'px'; n.scrollIntoView({block:'start'}); }catch(e){}
  }
  var METHOD_WORDS={cod:'cash on handover', transfer:'DuitNow Transfer', qr:'DuitNow QR', jompay:'JomPAY', tngbiz:"Touch 'n Go Business"};
  function acct(key){ return PAY.filter(function(a){return a.key===key;})[0]; }
  function methodWord(m,a){ var x=acct(a); return (METHOD_WORDS[m]||m)+(x&&m!=='tngbiz'?' to '+x.name:''); }
  function accountsFor(m){ return PAY.filter(function(a){ return !a.maintenance&&a[m]; }); }

  /* THE CHOICE, OFFERED FROM THE ACKNOWLEDGEMENT (v694; it was at ready). Five rails; three of them
     name an account off the list QR Command carries, and the page shows only those that run that
     rail. CASH ON HANDOVER IS WITHHELD from anyone already holding goods they have not paid for
     (his instruction, 18 Sep 2026): settling that at the door is how one advance becomes two. */
  function payChooser(o){
    var box=el('div','pay');
    box.appendChild(el('p','sub2','How will you pay '+rm(dueOf(o))+'?'));
    var cur=pick[o.id]||{}, noCod=heldUnpaid();
    var opts=[['cod', o.mode==='deliver'?'Cash on delivery':'Cash when I collect'],
              ['transfer','DuitNow Transfer, to an account number'],
              ['qr','DuitNow QR, a code I save and scan'],
              ['jompay','JomPAY'],
              ['tngbiz',"DuitNow purchase, the Touch 'n Go Business code"]];
    opts.forEach(function(m){
      if(m[0]==='cod'&&noCod) return;
      if(m[0]!=='cod'&&m[0]!=='tngbiz'&&!accountsFor(m[0]).length) return;
      if(m[0]==='tngbiz'&&!(acct('tngbiz')&&acct('tngbiz').qr&&!acct('tngbiz').maintenance)) return;
      var lab=el('label'); var r=el('input'); r.type='radio'; r.name='pm-'+o.id; r.value=m[0]; r.checked=(cur.method===m[0]);
      r.addEventListener('change',function(){ pick[o.id]={method:m[0],account:'',again:cur.again}; drawOrder(); });
      lab.appendChild(r); lab.appendChild(el('span',null,m[1])); box.appendChild(lab);
    });
    if(cur.method==='transfer'||cur.method==='qr'||cur.method==='jompay'){
      var sel=el('select','fld salt-field__input salt-field__input--mono'); sel.setAttribute('aria-label','Account');
      var o0=el('option',null,cur.method==='jompay'?'Choose the biller':'Choose the bank or e-wallet'); o0.value=''; sel.appendChild(o0);
      accountsFor(cur.method).forEach(function(a){ var op=el('option',null,a.name+(a.bank&&a.bank!==a.name?' ('+a.bank+')':'')); op.value=a.key; if(cur.account===a.key)op.selected=true; sel.appendChild(op); });
      sel.addEventListener('change',function(){ pick[o.id].account=sel.value; drawOrder(); });
      box.appendChild(sel);
    }
    if(noCod) box.appendChild(el('p','sub2','Cash on handover is not offered while goods you already hold are unpaid. Settle those first and it comes back.'));
    var ok=cur.method&&(cur.method==='cod'||cur.method==='tngbiz'||cur.account);
    var cb=el('button','btn salt-pill salt-pill--md','Confirm'); cb.type='button'; cb.disabled=!ok;
    cb.addEventListener('click', async function(){
      if(!ok) return; var mine=ticket;
      var r=await api('/orders/'+encodeURIComponent(o.id)+'/method',{method:cur.method,account:cur.account||undefined,rid:ridFor(o.id+':method',cur.method+' '+(cur.account||''))});
      if(mine!==ticket) return;
      if(!r.body.ok) tapSaid(o,'pay',r.body.error||'The choice was not recorded.'); else { ridDone(o.id+':method'); tapSaid(o,'pay',''); delete pick[o.id]; }
      await loadOrders(); if(mine!==ticket) return; drawOrder();
    });
    box.appendChild(cb);
    return box;
  }
  /* ONE LINK, FOR THE RAIL CHOSEN, AND THEN WHAT WAS PAID. Everything that pays lives on that page:
     the account number behind its Copy button, the code to save, the biller and reference. Nothing
     here repeats it. THE FIGURE IS THEIRS (his instruction, 18 Sep 2026): the site takes no money
     and no rail tells it anything, so the customer types what they paid and the desk reads it
     against the fold. It accumulates, so a part payment is a part payment. */
  function payBox(o){
    var box=payLink(o), due=dueOf(o), cur=pick[o.id]||{};
    var row=el('div','payamt');
    row.appendChild(el('span','cur','RM'));
    var inp=el('input','fld salt-field__input salt-field__input--mono'); inp.type='number'; inp.min='0'; inp.step='0.01'; inp.inputMode='decimal';
    inp.value=(cur.amount!==undefined&&cur.amount!==null)?cur.amount:due.toFixed(2);
    inp.setAttribute('aria-label','What you paid, in ringgit');
    inp.addEventListener('input',function(){ pick[o.id]=Object.assign({},pick[o.id],{amount:inp.value}); var b=document.getElementById('pd-'+o.id); if(b)b.disabled=!(parseFloat(inp.value)>0); });
    row.appendChild(inp); box.appendChild(row);
    var pb=el('button','btn salt-pill salt-pill--md',"I have paid"); pb.type='button'; pb.id='pd-'+o.id;
    pb.disabled=!(parseFloat(inp.value)>0);
    pb.addEventListener('click', async function(){
      var amt=parseFloat(inp.value);
      if(!(amt>0)) return;
      /* the id stays with the figure it was minted for: a retry of this payment carries it, a
         different figure is a different payment, and it is dropped once one is recorded */
      var fig=amt.toFixed(2), was=pick[o.id]||{};
      pick[o.id]=Object.assign({},was,{amount:inp.value},was.rid&&was.ridFor===fig?{}:{rid:mintRid(),ridFor:fig});
      pb.disabled=true; var mine=ticket;
      var r=await api('/orders/'+encodeURIComponent(o.id)+'/pay',{amount:+fig,rid:pick[o.id].rid});
      if(mine!==ticket) return;
      var took=!!(r.body&&r.body.ok);
      tapSaid(o,'pay',took?'Recorded. It shows on your statement once it is folded into the book.':((r.body&&r.body.error)||'That payment was not recorded.'));
      if(took) delete pick[o.id];
      await loadOrders(); if(mine!==ticket) return; drawOrder();
    });
    box.appendChild(pb);
    box.appendChild(el('p','sub2','Tell us once it has left your side. '+rm(due)+' is outstanding; a part payment is fine and the rest stays here.'));
    var ch=el('button','btn quiet salt-ghost','Pay another way'); ch.type='button';
    ch.addEventListener('click',function(){ pick[o.id]={again:true}; drawOrder(); });
    box.appendChild(ch);
    return box;
  }
  function payLink(o){
    var box=el('div','pay');
    var a=acct(o.account), due=dueOf(o);
    var word={cod:(o.mode==='deliver'?'Pay '+rm(due)+' in cash on delivery.':'Pay '+rm(due)+' in cash when you collect.'),
      transfer:'Transfer '+rm(due)+' by DuitNow Transfer to '+(a?a.name:'the account')+'. The page that opens has the account number behind Copy account number; paste it into your banking app.',
      qr:'Pay '+rm(due)+' by scanning the '+(a?a.name:'')+' code. On the page that opens, tap the code to save it as an image, then scan it from your banking app.',
      jompay:'Pay '+rm(due)+' by JomPAY. The page that opens has the biller code and the reference behind Copy; enter them in your banking app under JomPAY.',
      tngbiz:'Pay '+rm(due)+" by scanning the Touch 'n Go Business code on the page that opens, or save it and scan it from the Touch 'n Go app."}[o.method]||'';
    box.appendChild(el('p','sub2','Paying by '+methodWord(o.method,o.account)+'. '+word));
    if(o.method!=='cod'&&o.account){
      var l=el('a','btn lnk salt-ghost','Open '+(a?a.name:'the account')+' in QR Command');
      l.href=PAY_SITE+'/#'+encodeURIComponent(o.account); l.target='_blank'; l.rel='noopener';
      box.appendChild(l);
    }
    return box;
  }

  async function loadOrders(){
    if(!session) return;
    var mine=ticket;
    var r=await api('/orders');
    if(mine!==ticket) return;
    if(r.status===401) return;   /* api() has said so in the bar */
    if(r.body.ok) orders=r.body.orders||[];
  }
  /* S5 5.5 (24 Sep 2026): A RE-READ PATCHES WHAT CHANGED AND NOTHING ELSE. It drew the whole tab again, the order
     form and every order with it, so a poll bringing any change to any order took the box being typed in and the
     caret with it (v827 put the words back; the element was still new). Now the orders are compared one by one,
     and only the rows and the parts of the open order that changed are drawn again. A return to the page and a lapse
     reopened (S3 3.5) come this way too; only an account that now draws the form above differently draws the tab. */
  async function oReread(){
    var before={}, mine=ticket; orders.forEach(function(o){ before[o.id]=JSON.stringify(o); });
    await loadOrders();
    if(mine!==ticket) return;
    if(document.getElementById('oArea')&&formSig()!==drawnSig){ drawOrder(); return; }
    var changed=orders.filter(function(o){ return before[o.id]!==JSON.stringify(o); }).map(function(o){ return o.id; }),
        gone=Object.keys(before).some(function(id){ return !oFind(id); });
    if(draft.oStale&&changed.indexOf(draft.oStale)<0) changed.push(draft.oStale);
    if(changed.length||gone){ oSync(changed); if(osh&&draft.step==='limit') sheetDraw(); }
  }
  async function refresh(){
    await oReread();
    if(++bullN%6===0) await bullRead();   /* the bulletin, once a minute on an open page */
  }

  /* S12 12.2: A BANNER'S TAP OPENS ITS ORDER. The service worker opens the Counter at #o=<id>, or tells a
     page already open, which re-reads first: focusing it alone showed whatever it drew last. The order opens
     on the next draw that has it, which for a closed page is the one after signing in; one that is not
     among their orders is let go. Never on his read-only view. */
  function orderIn(h){ var m=/^#o=([0-9]{14}-[a-z0-9]{1,8})$/.exec(h||''); return m?m[1]:''; }
  var wantOrder=orderIn(location.hash);
  function openWanted(){
    /* a lapsed session keeps the order for the sign-in after Continue: a banner comes hours after the fifteen
       minutes, and spending it on the list drawn last showed the order stale, then lost it at the door */
    if(!wantOrder||view||!session||!lapse.hidden) return;
    var id=wantOrder;
    wantOrder='';
    try{ if(location.hash) history.replaceState(null,'',location.pathname+location.search); }catch(e){}
    if(!oFind(id)) return;
    showTab('order');
    oOpen(id);
  }
  try{
    if(!OWNER&&'serviceWorker' in navigator&&navigator.serviceWorker.addEventListener)
      navigator.serviceWorker.addEventListener('message', async function(ev){
        var d=ev&&ev.data;
        if(!d||d.salt!=='news') return;
        wantOrder=orderIn('#o='+(d.order||''));
        if(!session) return;   /* at the door: it opens once they are in */
        var mine=ticket;
        await oReread();
        if(mine!==ticket) return;
        openWanted();
      });
  }catch(e){ /* a browser that will not listen still opens the page */ }

  async function subscribePush(){
    var mine=ticket;
    try{
      var k=await (await fetch('/push/key',{cache:'no-store'})).json();
      if(!k.key||!k.configured){ draft.pushNote='Notifications are not switched on for this site yet.'; drawOrder(); return; }
      /* v693: THE ASK COMES FIRST. Registering a service worker before it meant a browser that
         refuses the registration never got as far as the question, which only a tap puts (S4), so
         that silence would waste the one tap. Nothing is installed on a phone whose reader says no. */
      var perm=await Notification.requestPermission();
      if(perm!=='granted'){ draft.pushNote='Permission was not given, so nothing will be sent.'; drawOrder(); return; }
      await navigator.serviceWorker.register('/sw.js?u='+encodeURIComponent(user));
      /* S1 1.9, 24 SEP 2026: a registration is not yet an active worker, and Chromium refuses to subscribe
         until there is one ("no active Service Worker"); ready resolves once there is */
      var reg=await navigator.serviceWorker.ready;
      if(mine!==ticket) return;
      var raw=atob(k.key.replace(/-/g,'+').replace(/_/g,'/')), key=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++) key[i]=raw.charCodeAt(i);
      var sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:key});
      if(mine!==ticket) return;
      /* S12 12.1: and its two keys, so a wake can say what kind of news it is in words only this phone can read */
      var j=sub.toJSON?sub.toJSON():null;
      var r=await api('/push/subscribe',{endpoint:sub.endpoint, keys:j&&j.keys?{p256dh:j.keys.p256dh, auth:j.keys.auth}:null});
      if(mine!==ticket) return;
      if(r.body.ok){ draft.pushed=true; draft.pushDone=true; pushOffSet(false); } else draft.pushNote=r.body.error||'The subscription was not recorded.';
    }catch(e){ draft.pushNote='Notifications could not be switched on here. Try again later.'; }
    drawOrder();
  }

  document.getElementById('f').addEventListener('submit', async function(ev){
    ev.preventDefault();
    var u=norm(un.value), pass=OWNER?pw.value.trim():canonPass(pw.value);
    var bad=function(f,t){ say(t,'bad'); f.setAttribute('aria-invalid','true'); f.classList.add('salt-field__input--error'); try{ f.focus(); }catch(e){} };
    if(!OWNER&&unfit(un.value,8,'username')){ bad(un,unfit(un.value,8,'username')); return; }
    if(!u){ bad(un,'Enter your username: two groups of four.'); return; }
    if(!pass){ bad(pw,'Enter the password sent to you.'); return; }
    if(!OWNER&&unfit(pass,16,'password')){ bad(pw,unfit(pass,16,'password')); return; }
    un.value=u;
    var mine=++ticket;
    var stale=function(){ return mine!==ticket; };
    var done=function(){ if(!stale()){ busy=false; go.disabled=false; } };
    busy=true; go.disabled=true; again(false); say('Checking...','wait');
    var r, body;
    /* the one field carries either secret: the Worker says which it matched, and the page
       unwraps with the matching wrap. A customer never knows there is a second one. */
    try{
      r=await fetch('/open', {method:'POST',
        headers:{'content-type':'application/json'}, body:JSON.stringify(OWNER?{u:u, password:pass, master:pass}:{u:u, password:pass})});
      body=await r.json();
    }catch(e){ if(stale())return; done(); say('No connection. Try again in a moment.','bad'); return; }
    if(stale()) return;
    if(!r.ok||!body.ok){
      done();
      if(r.status===429) say(body.error||'Too many attempts. Try again later.','bad');
      else say(body.error||'That username and password were not accepted.','bad');
      return;
    }
    say('Opening...','wait');
    var w=body.byMaster?body.wrapMaster:body.wrap;
    if(!w){
      done();
      say(body.byMaster?'This account was issued without the master key. Open it with the customer\\'s own password.'
        :'This account has no key to open it with. Ask for it to be re-issued.','bad');
      return;
    }
    var ck, b;
    try{ ck=await unwrap(pass, w); b=JSON.parse(await open(ck, body.env)); }
    catch(e){ if(stale())return; done(); say('That password did not open the statement.','bad'); return; }
    if(stale()) return;
    /* an empty bundle is a new account, not a fault: pickStmt says so */
    if(!b||!b.statements){ done(); say('The statement could not be read. Ask for it to be re-issued.','bad'); return; }
    var x=await openBeside(body, ck, b);
    if(stale()) return;
    /* v692: remembered only on a customer's own sign-in, and only when asked. The owner's route
       opens accounts with the master and must leave nothing behind on his phone. S3 3.8: over another
       remembered account, only when that is said yes to. */
    var rem=document.getElementById('rem');
    var keep=!OWNER&&!!rem&&rem.checked&&(await askReplace(go, u));
    if(stale()) return;
    done();
    enter(u, body, b, x, ck, !!(outSheet&&!outSheet.hidden));
    if(!(await follow(stale))) return;
    if(keep) await remember(u, ck);
    askPush();
  });

  /* ---- ON THE WAY IN, NOTHING IS ASKED (S4, 24 SEP 2026; v693 asked here) ----------------------
     The plan he answered "all recommended" asks at the first order, from a tap: Sent's "A buzz when it is
     confirmed?", and the Order tab's Notify me. Asked on the way in, a phone that answered never saw that
     question, and a remembered phone was asked on load with nothing tapped. What stays is the phone already
     on, filed again below. The owner's route never asks: those are not his phones. */
  function askPush(){
    if(OWNER||!session) return;
    try{
      var can=('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
      if(!can) return;
      /* S1 1.43, 24 SEP 2026: a phone already subscribed says On, where the pane read this page's own memory,
         which every sign-in empties. ON IS WHAT THE SITE HOLDS: with the answer already yes this subscribes again,
         which asks nothing and hands back the phone's own subscription, and names it to the site, so a phone that
         logged out is woken again and a record the site lost is put back; On is said only once the site has it. */
      /* S7 7.3: unless this device was turned off in Account, which a Turn on undoes */
      if(Notification.permission==='granted'&&!pushOff()) subscribePush().then(drawDevice);
    }catch(e){ /* a browser that refuses to be asked is not a fault */ }
  }

  /* ---- OPENING A REMEMBERED DEVICE (v692) -----------------------------------------------------
     The token names the record and brings back the wrap; the key beside it in this browser opens
     it. A refusal, a stale token or a record that has gone simply falls through to the door. */
  var KEPT='Your account could not be opened just now. This '+DEV+' is still remembered: try again in a moment.';
  var remAgain=document.getElementById('remAgain');
  function again(on){ if(remAgain) remAgain.hidden=!on; }
  async function openRemembered(keep){
    var rec=remGet();
    if(!rec||!rec.t||!rec.k||OWNER) return false;
    if(!keep) again(false);
    /* S3 3.5: reopening a lapse runs under the flow that met it, so it takes no ticket of its own and says nothing */
    var mine=keep?ticket:++ticket, stale=function(){ return mine!==ticket; };
    if(!keep) say('Opening...','wait');
    var r, body;
    try{
      r=await fetch('/remember/open', {method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({token:rec.t})});
      body=await r.json();
    }catch(e){ if(!stale()&&!keep){ say(KEPT,'bad'); again(true); } return false; }
    if(stale()) return false;
    /* S1 1.41, 24 SEP 2026: ONLY THE DOOR'S REFUSAL FORGETS THIS PHONE. A server fault forgot it too, so one
       bad minute on the site signed every returning phone out for good; that, and a dropped connection,
       now keep it and say so. */
    if(r.status===401){ remClear(); if(!keep) say(''); return false; }
    if(!r.ok||!body.ok){ if(!keep){ say(KEPT,'bad'); again(true); } return false; }
    var ck, b;
    try{
      ck=await unwrapUnder(b64d(rec.k), body.wrap);
      b=JSON.parse(await open(ck, body.env));
    }catch(e){ remClear(); if(!keep) say(''); return false; }
    if(stale()) return false;
    var x=await openBeside(body, ck, b);
    if(stale()) return false;
    enter(body.u, body, b, x, ck, keep);
    /* a reopen hands the session back to the request that met the lapse, which repeats itself; the poll resumes */
    if(keep){ if(!poll) poll=setInterval(refresh, POLL_MS); return true; }
    if(!(await follow(stale))) return true;
    askPush();
    return true;
  }

  /* ---- THE PAGE RE-READS ON EVERY RETURN (S3 3.5) ------------------------------------------------------
     A saved app has no reload, so coming back to the page (shown again, or restored from the back-forward cache)
     reads the sealed documents and the orders afresh on the session, with the key it was opened with, keeping
     what the customer was doing. A session that lapsed meanwhile reopens itself on the way, in api(). */
  var rereading=false;
  async function reread(){
    if(OWNER||!session||!curCk||rereading) return;
    rereading=true;
    try{
      var mine=ticket, ck=curCk;
      var r=await api('/account');
      if(mine!==ticket||!r.body.ok||!r.body.env) return;
      var b=JSON.parse(await open(ck, r.body.env));
      var x=await openBeside(r.body, ck, b);
      if(mine!==ticket) return;
      enter(user, {session:session}, b, x, ck, true);
      /* S5 5.5: patched, so the order open and a line half typed in it survive the return */
      await oReread();
    }catch(e){ /* what is on screen stays, and the next return tries again */ }
    finally{ rereading=false; }
  }
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible') reread(); });
  window.addEventListener('pageshow', function(ev){ if(ev&&ev.persisted) reread(); });
  if(remAgain) remAgain.addEventListener('click', async function(){
    if(busy) return;
    again(false); say('');
    if(opening){ gate.hidden=true; opening.hidden=false; }
    if((await openRemembered())||session) return;
    if(opening) opening.hidden=true;
    gate.hidden=false;
  });
  /* ---- ONE WAY IN (S3 3.3, 24 Sep 2026) ----------------------------------------------------------
     The password, a remembered phone and the link all hand back the same record: these open it with the
     content key and put the account on screen, so the roads cannot drift apart. openBeside opens what sits
     beside the statement, enter draws the account, and follow starts its orders. */
  /* not "unseal": stmt/owner.js declares that name, and spliced in after this, its declaration would win here */
  async function openBeside(body, ck, b){
    var x={assoc:body.assoc===true, card:null, prices:null};
    if(body.live){
      try{ var l=JSON.parse(await open(ck, body.live));
        b.statements.unshift({issued:'now', label:'Now', live:true, at:l.at||body.live.at, body:l.body, owed:l.owed}); }
      catch(e){ /* the issued statements still open; the live one is simply absent */ }
    }
    if(body.card){ try{ x.card=JSON.parse(await open(ck, body.card)); }catch(e){ /* the statement still opens; the card is simply absent */ } }
    if(body.prices){ try{ x.prices=await openList(ck, body.prices); }catch(e){ /* the statements still open; the list is simply absent */ } }
    return x;
  }
  function enter(u, body, b, x, ck, keep){
    say(''); again(false);
    /* S3 3.5: the same account let in again (a lapse reopened, a sign-in on the Sheet, a return re-read) keeps
       the draft, the tab, the month and the place on the page */
    var same=!!keep&&u===user&&!!bundle, t=tab, sy=window.scrollY||0, mf=mfPick;
    prices=x.prices; assoc=x.assoc; card=x.card; curCk=ck||null;
    user=u; session=body.session||'';
    if(!same){ orders=[]; draft={}; pick={}; }
    view=!!(OWNER&&body.byMaster);
    if(linkBox) linkBox.hidden=true;
    if(opening) opening.hidden=true;
    lapse.hidden=true; closeSignedOut();
    show(b);
    drawPrices();
    drawKeep();
    if(same){
      if(t!==tab&&!(hold&&t==='prices')&&!(t==='card'&&tCard.hidden)) showTab(t);
      if(mf&&mfil.querySelector('button[data-mf="'+mf+'"]')){ mfPick=mf; applyMonths(); }
      window.scrollTo(0,sy);
      if(draft.sheetBack){ draft.sheetBack=false; sheetOpen(); }
    }
  }
  async function follow(stale){
    if(session){ await loadOrders(); if(stale()) return false; if(poll)clearInterval(poll); poll=setInterval(refresh, POLL_MS); }
    else if(view){ await loadView(user); if(stale()) return false; }   /* stmt/owner.js: his route alone carries it */
    drawOrder();
    return true;
  }

  /* ---- THE ONE-TIME LINK (v710; S3 3.3 and 3.4, 24 Sep 2026) -------------------------------------------
     "When sharing the link, QR to the user, the site pre-fills their username and password." The password
     never goes in a message, so the LINK signs them in: the token is in this page's own address, and the
     content key comes back wrapped UNDER it.
     NOTHING IS SPENT UNTIL CONTINUE. The page first asks which account the link opens, which spends nothing,
     so a preview or an app's own browser that runs the page cannot use it up. Continue posts the token with
     this page's own nonce; the Worker burns it and keeps the answer two minutes for that nonce alone, so a
     dropped connection is tried again from here rather than losing the link.
     AN APP'S OWN BROWSER (WhatsApp, Instagram, Facebook, Line, WeChat) keeps nothing once it closes, so it is
     sent to Safari or Chrome with that phone's menu mark before anything is spent; Continue stays, quieter.
     S3 3.4, HIS D1: THE LINK KEEPS THE PHONE SIGNED IN, with the same split key as Keep me signed in: a device key
     in this browser and the content key wrapped under it on the site, neither opening anything alone. */
  var linkBox=document.getElementById('link'), linkGo=document.getElementById('linkGo'),
      linkMsg=document.getElementById('linkMsg');
  var INAPP=/WhatsApp|Instagram|FBAN|FBAV|FB_IAB|FBIOS|FB4A|Line[/]|MicroMessenger/.test(UA);
  var LOST='Not opened: the answer did not arrive. Tap Continue again. For two minutes this page can still open it.';
  var SPENT='That link has been used already, or it has expired. Sign in with your username and password, or ask us for a new sign-in link.';
  function lsay(t,cls){ if(linkMsg){ linkMsg.textContent=t||''; linkMsg.className='msg'+(cls?' '+cls:''); } }
  function signinToken(){
    /* [/] rather than an escaped slash: this script lives in a template literal, where a
       backslash before a slash is eaten and the regex would end at the first one. */
    var m=/^[/]s[/]([A-Za-z0-9_-]{20,64})$/.exec(location.pathname||'');
    return m?m[1]:null;
  }
  /* one a tab, kept for a reload of the same tab; minted afresh where the storage will not hold it */
  var nonceMem='';
  function linkNonce(){
    var n='';
    try{ n=sessionStorage.getItem('salt-link-nonce')||''; }catch(e){}
    if(!/^[A-Za-z0-9_-]{16,64}$/.test(n)) n=nonceMem||b64e(crypto.getRandomValues(new Uint8Array(18))).replace(/[+]/g,'-').replace(/[/]/g,'_');
    nonceMem=n;
    try{ sessionStorage.setItem('salt-link-nonce', n); }catch(e){}
    return n;
  }
  function linkSpent(){
    try{ history.replaceState(null,'','/'); }catch(e){}
    linkBox.hidden=true; gate.hidden=false;
    say(SPENT,'bad');
  }
  async function showLink(){
    var tok=signinToken();
    if(!tok||OWNER||!linkBox) return false;
    gate.hidden=true; linkBox.hidden=false;
    if(INAPP){
      document.getElementById('linkInapp').hidden=false;
      document.getElementById('inappIos').hidden=!IOS; document.getElementById('inappDroid').hidden=IOS;
      document.getElementById('linkCopy').hidden=false;
      linkGo.className='btn salt-ghost'; linkGo.textContent='Continue here instead';
    }
    linkGo.disabled=true; lsay('Checking the link...','wait');
    var r=null, body=null;
    try{
      r=await fetch('/open-link', {method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({token:tok, peek:true, nonce:linkNonce()})});
      body=await r.json();
    }catch(e){ /* the question was lost, not the link: Continue still asks the real one */ }
    if(r&&r.status===401){ linkSpent(); return false; }
    if(r&&r.ok&&body&&body.ok&&body.u){
      var lead=document.getElementById('linkLead'), who=el('span','mono',body.u);
      lead.textContent='This link opens account '; lead.appendChild(who); lead.appendChild(document.createTextNode(' on this '+DEV+' and keeps it signed in.'));
    }
    linkGo.disabled=false; lsay('');
    return true;
  }
  if(linkBox){
    document.getElementById('linkCopy').addEventListener('click', async function(){
      try{ await navigator.clipboard.writeText(location.href); lsay('Copied. Paste it into Safari or Chrome.'); }
      catch(e){ lsay('Copy failed. Press and hold the address instead.','bad'); }
    });
    linkGo.addEventListener('click', async function(){
      var tok=signinToken();
      if(!tok||busy) return;
      var mine=++ticket, stale=function(){ return mine!==ticket; };
      busy=true; linkGo.disabled=true; lsay('Opening...','wait');
      var r, body;
      try{
        r=await fetch('/open-link', {method:'POST', headers:{'content-type':'application/json'},
          body:JSON.stringify({token:tok, nonce:linkNonce()})});
        body=await r.json();
      }catch(e){ if(stale()) return; busy=false; linkGo.disabled=false; lsay(LOST,'bad'); return; }
      if(stale()) return;
      busy=false;
      if(r.status===401){ lsay(''); linkSpent(); return; }
      if(!r.ok||!body.ok){ linkGo.disabled=false; lsay(LOST,'bad'); return; }
      /* spent, and the answer is in hand: this address is never presented again */
      try{ history.replaceState(null,'','/'); }catch(e){}
      var ck, b;
      try{ ck=await unwrapUnder(new TextEncoder().encode(tok), body.wrap); b=JSON.parse(await open(ck, body.env)); }
      catch(e){ if(!stale()){ lsay(''); linkSpent(); } return; }
      if(stale()) return;
      var x=await openBeside(body, ck, b);
      if(stale()) return;
      lsay('');
      var keep=await askReplace(linkGo, body.u);   /* S3 3.8 */
      if(stale()) return;
      enter(body.u, body, b, x, ck);
      if(!(await follow(stale))) return;
      /* S3 3.4 (his D1): the link keeps this phone signed in, with the same split key the door's tick makes */
      if(keep) await remember(body.u, ck);
      askPush();
    });
  }
  /* THE OWNER'S OWN SCRIPT IS SPLICED IN HERE, and only on his route (v687). Everything it
     needs -- say(), el(), stamp(), un, pw, whoacct, busy, OWNER -- is in scope at this point,
     and a customer's page carries none of it: stmt/owner.js. */
  /*__OWNER_JS__*/

  if(!OWNER){
    /* the cursor lands at once, and a remembered device opens over the top of it: a reader with no
       memory on this phone must never wait on a request to be able to type */
    try{ (un.value?pw:un).focus(); }catch(e){}
    /* v710: a one-time link first, a remembered device second. A reader arriving on a link came to
       use it, and if it is spent the remembered device is still there behind it. S3 3.3: the link is a
       page of its own now, spent on Continue, so the page waits there. */
    var hk=(location.hash||'').slice(1);   /* read before anything waits: a page closed meanwhile has no address */
    (async function(){
      if(await showLink()) return;
      /* S3 3.11: the saved app. A key in the address is the one Safari's Keep it on your Home Screen wrote there, and
         only the saved app spends it. S3 FIX, 24 SEP 2026: A BROWSER TAB SPENDS ONLY HIS COUNTER'S QR, /app#qr.<key>,
         which the customer's camera opens (3.13), and the Worker opens it for a tab only if his own page minted it,
         so an address one customer sends another never signs the other in; an app's own browser spends nothing */
      var qm=/^qr[.]([A-Za-z0-9_-]{20,64})$/.exec(hk);
      var key=!APP?'':STANDALONE?(qm?qm[1]:TOK_RE.test(hk)?hk:''):(qm&&!INAPP?qm[1]:'');
      /* S3 fix: his QR in a tab comes before this phone's memory, as a link does, and Replace asks over another account;
         the saved app's own start address may keep a spent key, so there its memory still comes first */
      if(key&&!STANDALONE){ showCode(true); await openHandover({token:key, tab:true}); return; }
      /* S3 3.5: a remembered phone draws "Opening your account" while it opens, so nobody starts typing into a door
         that is about to vanish; the door comes back only if it does not open */
      if(remGet()&&opening){ gate.hidden=true; opening.hidden=false; }
      var inNow=await openRemembered();
      if(inNow||session) return;
      if(opening) opening.hidden=true;
      /* S3 fix: a phone still remembered, which the site could not open just now, says so on the door with Try again,
         never on the saved app's code screen, which would send a customer still signed in to Safari for a code */
      var kept=!!remGet();
      if(APP&&!kept&&(IOS||key||qm)) showCode(!!qm&&!STANDALONE); else gate.hidden=false;
      if(APP&&qm&&INAPP&&!STANDALONE) csay(INAPP_KEY,'bad');
      if(key&&!kept) await openHandover({token:key});
    })();
  }
})();
`;
