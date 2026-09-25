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
import { PAY_SITE, PAY_ACCOUNTS, payHref } from "./pay.js";
import { OWNER_JS } from "./owner.js";
import { MAX_OPEN, OPEN_STATES } from "./orders.js";
import { EN, WORDS, fill, fillHtml, unitsIn } from "./words.js";

/* v692: THE THREE-MINUTE LOCK IS GONE (his instruction, 18 Sep 2026). It was a privacy lock for a
   phone left on a table; he asked for a page that stays signed in and a button that leaves. What
   replaced it is Remember me and Log out, which say what they do. */
export const POLL_MS = 10000;

const PAGE_CSS = `
/* hidden wins over every display rule below: the tab strip and the issue strip are flex */
[hidden]{display:none!important}
/* S7 7.5 (his D14 of 24 Sep 2026): the notice is a still card on Home, the system's insight, a line a paragraph */
.hnote p{margin:0}
.hnote p+p{margin-top:6px}
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
/* KEEP IT ON YOUR HOME SCREEN (v693; S3 3.10): This device's first row (S9 fix), once signed in, in a browser that is
   not already the app, and a card of its own leading a new account's Home (S7); its steps sit in a Sheet and draw the
   phone's own marks */
.keepcard .kline{margin:0}
.keepcard b{color:var(--salt-text);font-weight:600}
.home .keepcard .salt-ledger__row{border-bottom:0}
.keepsteps{margin:14px 0;padding-left:22px;line-height:2.1}
.keepsteps .glyph,.keepcard .glyph{vertical-align:-0.3em;margin:0 3px}
.keepsteps .sub2{display:block;line-height:1.5;margin:0 0 6px}
/* S9 9.9: in This device (S7 7.3, below), its phones and computers with this one marked, and the two quiet ways, each
   answered on the line under them */
.devcard .dacts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.devcard .dnote{margin:8px 0 0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.devcard .dnote:empty{display:none}
.devcard .dnote.bad{color:var(--salt-ember)}
#devQr{width:min(240px,100%);margin:4px auto 20px}
#devQrImg{display:block;width:100%;height:auto}
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
  gap:12px;margin:0 auto;max-width:620px;font-size:var(--salt-text-sm);color:var(--salt-text-muted);
  font-family:var(--salt-font-mono)}
/* S7 7.1: the veil is drawn by what the bar holds, his view line or a lapse, so a customer's bar, whose Log out is This
   device's now, takes no room until it has something to say */
.vbar,.lapse{padding:0 16px;margin-bottom:14px;background:var(--salt-veil);border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-sm);backdrop-filter:blur(10px)}
.vbar .lapse{padding:0;margin:0;background:none;border:0;backdrop-filter:none}
.bar b{color:var(--salt-text);font-variant-numeric:tabular-nums}
.lapse{flex-basis:100%;display:flex;justify-content:space-between;align-items:center;gap:12px}
.lapse[hidden]{display:none}
/* UX4, 24 Sep 2026: Log out and Continue are taps like any other, 44px both ways (they were 55 and 62 by 21,
   and Continue is the one way back after a lapse); the bar gives up its own padding, so it is no taller */
.bar button{font:inherit;color:var(--salt-brass);background:none;border:0;cursor:pointer;
  padding:0;text-decoration:underline;min-height:var(--salt-tap);min-width:var(--salt-tap);
  display:inline-flex;align-items:center;justify-content:center;flex:none}
/* S7 7.1 (his D11 of 24 Sep 2026): THE PLACES, which were three tabs and a fourth. The system's App bar at the foot of a
   phone and its rail from 1080px draw them, and the recipe decides which shows; this page keeps the bar's height clear
   at the foot, names the place in the header and lays Home out. */
.cshell{padding-bottom:calc(var(--salt-bar-h) + 24px + env(safe-area-inset-bottom))}
.chead{max-width:620px;margin:0 auto 18px}
.chead h1{margin:0;font-size:var(--salt-text-2xl);line-height:1.15}
.cwho{margin:6px 0 0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
/* a username is a credential, so the rail's capitals never reach it */
.cfoot .mono{text-transform:none;letter-spacing:.02em}
.home{max-width:620px;margin:0 auto}
.home .hcol>div{margin:0 0 24px}
.home .hcol>:empty{display:none}
.hfill{width:100%;margin-top:14px}
.hlab{display:flex;justify-content:space-between;gap:12px;margin:0 0 10px}
.home .salt-inbox-row{margin:0 0 8px}
/* S7 7.2: FROM 1080PX THE BAR IS THE RAIL, beside the page (the recipe's own switch), and each place takes two columns:
   Home its money and what needs them beside what is coming, Account the statement beside This device (S7 7.3's .acct,
   below), Prices a book a column; Orders keeps stage 5's list beside the open order. A sheet is the recipe's drawer on
   the right. */
@media (min-width:1080px){
  .cshell{display:flex;gap:28px;align-items:flex-start;max-width:1240px;margin:0 auto;padding-bottom:48px}
  .cmain{flex:1 1 auto;min-width:0}
  .cmain .bar,.chead,.home,.cmain .panel{max-width:none}
  .home{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
  .pgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 20px;align-items:start}
  /* S7-R3 of the review: the Notifications pane is Account's This device on a desk, where it stands beside the statement;
     in the list's column it pushed the orders down */
  #oPush{display:none}
}
.panel{max-width:620px;margin:0 auto}
.panel h2{font-size:var(--salt-text-lg);margin:0 0 4px}
.panel p.lead{color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.7;margin:0 0 18px}
/* THE ISSUES, as a strip of dates. The current one leads; the rest are the record. A pill is
   a word in mono with a hairline, and the chosen one is brass: no filled badge. S7 polish: now only Rewards' months,
   inside its card, so it starts at the card's edge: centred, it stood 170px in from everything else from 1080px */
.mos{max-width:620px;margin:0 0 22px;display:flex;flex-wrap:wrap;gap:8px}
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
.mfil .salt-tabs__pill,.lang .salt-tabs__pill{min-height:var(--salt-tap);min-width:var(--salt-tap)}
/* S13 13.4: the language switch is the same tab strip: at the head of the door, the welcome and one step to finish, and
   under its label in This device; not inside the signed-out Sheet, which carries the door's form alone */
.gate>.lang{justify-content:flex-end;margin:0 0 18px}
#outForm .lang{display:none}
.devcard .lang{margin:8px 0 2px}
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
/* S6 6.2: To pay now, Home's first answer since S7 7.1, its parts on the plain Ledger list */
.payhead[hidden]{display:none}
.payhead .btn{margin-top:12px}
.payhead .salt-insight{margin:12px 0 0}
.salt-ledger--plain .salt-ledger__value{white-space:nowrap}
/* S6 6.4: the pay sheet. The look is the recipes' (Sheet, KPI tile, Ghost, Option, Field, Ledger, Pill); this lays them out */
.payseg{display:flex;gap:8px;margin-top:12px}
.payseg .salt-ghost{flex:1 1 0;min-width:0}
.payhow,.payinto,.payref{margin-top:18px}
.payref .salt-ledger__value{display:inline-flex;align-items:center;gap:10px}
.paycap{margin:0;flex-basis:100%;font-size:var(--salt-text-sm);line-height:1.5;color:var(--salt-prose)}
#payFoot .salt-pill{flex:1 1 auto}
/* S6 6.5: the one question on return, centred as the mockup draws it. S6 fix (rule 6): its heading is the Sheet's title
   recipe, and the mockup's ring round the mark waits for a recipe in salt-ds, never restated here */
.paycheck{text-align:center;padding-top:6px}
.paycheck h3{margin:14px 0 4px}
.paycheck .glyph{color:var(--salt-steel)}
.payagain{width:100%;margin-top:16px}
.paysaid{flex-basis:100%;margin:0}
.payhead .msg{margin:10px 0 0}
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
/* S7 polish: two columns read left to right stand apart, as the live statement's do (UX10): at 320 the card's date ran
   into the next column ("2026-09-Through"). Only these, so a row that fits a 390 phone on one line still does */
.pane td.l+td.l,.pane th.l+th.l{padding-left:10px}
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
/* S7-R3 of the review: what stood above the orders (the lead, New order or the limit, Notifications, the Pay page) is the
   head of the list's column, so from 1080px the open order stands level with it at the top of the place */
.otop{margin:0 0 18px}
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
  .oplace{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:28px;align-items:start}
  .oback{display:none}
  /* the open order stands still while the list scrolls beside it, its thread in reach inside it */
  .oscreen{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow-y:auto}
}

@media print{.bar,.mos,.salt-appbar,.salt-rail{display:none}}
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
/* S9 9.3: AN ACCOUNT, as a row opens it (the plan's f13): the code large and the username under it, the chips, the one
   filled Send a sign-in link across the column with its answer under it, the other ways two by two with theirs, the
   Sent tick, then how they got in. The two quiet ways that must not be tapped by accident are the system's danger ghost.
   S7 polish: its own name, .oacct. The customer's Account is .acct (S7 7.3), and this block's single column, coming
   after it, took that Account's two columns from 1080px when the stages were merged */
.oacct{display:flex;flex-direction:column;gap:12px}
.oacct .ahead h2{margin:0;font-size:var(--salt-text-2xl);line-height:1.15;overflow-wrap:anywhere}
.oacct .ahead .un{display:block;margin-top:4px;font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);
  letter-spacing:.06em;color:var(--salt-text-muted)}
.oacct .achips{margin:0}
.oacct .atot{margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.oacct .apill{width:100%;margin-top:4px}
.agrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.agrid .salt-ghost{width:100%;text-align:center}
.anote{margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.anote:empty{display:none}
.anote.bad{color:var(--salt-ember)}
.oacct .tick{display:flex;align-items:center;gap:8px;align-self:flex-start;min-height:var(--salt-tap);min-width:var(--salt-tap);
  font-size:var(--salt-text-sm);color:var(--salt-text-muted);cursor:pointer}
.oacct .tick input{width:18px;height:18px;accent-color:var(--salt-verdigris)}
.astory{display:flex;flex-direction:column;gap:6px;margin-top:8px}
/* S9 9.4: the phones and computers under their own head, the count at its end */
.astory .dhead{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:14px}
.astory .dcount{color:var(--salt-text-muted);letter-spacing:0}
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
/* S8 8.1: an associate's own links, in Rewards: when it was made, its state in a word (the system's chip), what it
   has done, and the system's ghosts; the Meter is the reward's bar */
.rlhead{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.rlcount{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.08em;color:var(--salt-text-muted)}
.rlinks .gtop{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px 12px}
.rlinks .gh{margin:0;font-family:var(--salt-font-mono);font-size:var(--salt-text-md);color:var(--salt-text)}
.rlinks .gs{font-family:var(--salt-font-display);font-size:var(--salt-text-sm);letter-spacing:0;line-height:1.5}
.racts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.racts .salt-ghost{flex:1 1 auto}
.rlinks .msg:empty{display:none}
.rlinks .rlnext{margin:16px 0 10px}
.rmeter{margin:10px 0 14px}
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
export const DELIVERY = EN["deliv"];
/** The mark for a product, as SVG source. `px` is the drawn size; the stroke stays hairline. */
export function psymSvg(product, px) {
  const d = PSYM[String(product || "").toLowerCase()] || RING;
  return '<svg class="psym" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false">'
    + '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

/** A size in words, units above one and unit at one (S4). The one copy: a guest's board calls it here, and the page's own
 *  script is served its source, so the two cannot drift apart. */
export function unitsOf(q, u) { return unitsIn(EN["unit.one"], EN["unit.many"], q, u); }

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
  bank: "M3.8 9.4 L12 4.6 L20.2 9.4 Z M5.8 10.6 V16.8 M9.9 10.6 V16.8 M14.1 10.6 V16.8 M18.2 10.6 V16.8 M3.8 19.4 H20.2",
  qr: "M4.2 4.2 H10 V10 H4.2 Z M14 4.2 H19.8 V10 H14 Z M4.2 14 H10 V19.8 H4.2 Z M14 14 H16.4 V16.4 H14 Z M17.6 17.6 H19.8 V19.8 H17.6 Z M14 17.6 V19.8 M17.6 14 H19.8",
  cash: "M3.6 7 H20.4 V17 H3.6 Z M12 9.6 A2.4 2.4 0 1 1 12 14.4 A2.4 2.4 0 1 1 12 9.6 Z M6.4 12 H7.4 M16.6 12 H17.6",
  copy: "M10.6 8.6 H17.4 A2 2 0 0 1 19.4 10.6 V17.4 A2 2 0 0 1 17.4 19.4 H10.6 A2 2 0 0 1 8.6 17.4 V10.6 A2 2 0 0 1 10.6 8.6 Z M15.4 8.6 V6.6 A2 2 0 0 0 13.4 4.6 H6.6 A2 2 0 0 0 4.6 6.6 V13.4 A2 2 0 0 0 6.6 15.4 H8.6",
  vdots: "M10.6 6.5 A1.4 1.4 0 1 0 13.4 6.5 A1.4 1.4 0 1 0 10.6 6.5 Z M10.6 12 A1.4 1.4 0 1 0 13.4 12 A1.4 1.4 0 1 0 10.6 12 Z M10.6 17.5 A1.4 1.4 0 1 0 13.4 17.5 A1.4 1.4 0 1 0 10.6 17.5 Z",
};
const FILLED = { dots: true, vdots: true };
/* S13 13.3: the mark as markup from the marks it is given, so the page's script draws a mark in a sentence it re-words
   exactly as this does (its source is served to it) */
function glyphOf(marks, filled, name, px) {
  var paint = filled[name] ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.4"';
  return '<svg class="psym glyph" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false">'
    + '<path d="' + marks[name] + '" ' + paint + ' stroke-linejoin="round" stroke-linecap="round"/></svg>';
}
export function glyphSvg(name, px) { return glyphOf(GLYPH, FILLED, name, px); }

/* ---- S13 13.3 (his D12 of 24 Sep 2026): THE WORDS OF THE MARKUP ARE THE TABLE'S (stmt/words.js) ---------------------
   Each keyed element carries its key (data-w, and data-gs for the size of a mark in it; data-wl an aria-label, data-wp a
   placeholder, data-wa an alt), so the script words it again in the reader's language. The page is served in English,
   and a {dev} is the phone's word until the script says which device it is. */
function slotsAt(px) {
  const s = { dev: '<span class="dev">phone</span>' };
  for (const n of Object.keys(GLYPH)) s[n] = glyphSvg(n, px);
  return s;
}
const wd = (k, px) => fillHtml(EN[k], slotsAt(px || 22), "en");
/* an element whose words are a key's: <tag attrs data-w="k">words</tag> */
const wt = (tag, attrs, k, px) => "<" + tag + (attrs ? " " + attrs : "") + ' data-w="' + k + '"' + (px ? ' data-gs="' + px + '"' : "") + ">" + wd(k, px) + "</" + tag + ">";
const wl = (k) => ' aria-label="' + esc(EN[k]) + '" data-wl="' + k + '"';
/* whose account it is: the username is a slot, filled by the script (data-who) */
const whoAs = () => '<span data-whoas data-w="who.as">' + fillHtml(EN["who.as"], Object.assign(slotsAt(22), { u: '<span class="mono" data-who></span>' }), "en") + "</span>";
/* S13 13.4 (his D12): ENGLISH OR BAHASA MELAYU, each named in its own words and its own language, the system's tab strip;
   the script presses the pill of the language in use and keeps a tap's choice on this phone */
function langSwitch() {
  return '<div class="salt-tabs lang" role="group"' + wl("lang.h") + ">" + ["en", "ms"].map((L) => wt("button",
    'type="button" class="salt-tabs__pill' + (L === "en" ? " salt-tabs__pill--active" : "") + '" data-l="' + L + '" lang="' + L + '" aria-pressed="' + (L === "en") + '"',
    "lang." + L)).join("") + "</div>";
}

/* S3 3.5: A REMEMBERED PHONE DRAWS THIS, NOT THE DOOR, while it opens; and when a session lapses with nothing
   remembered, a Sheet says so over whatever they were doing, and the door's own form moves into it. */
function signedOutSheet() {
  return '<div id="opening" class="gate" hidden><span class="appmark">' + glyphSvg("ring", 40) + "</span>"
    + wt("p", 'class="lead" role="status"', "open.lead") + "</div>"
    + '<div id="outScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="outSheet" class="salt-sheet" role="dialog" aria-modal="true" aria-labelledby="outT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head">' + wt("h2", 'class="salt-sheet__title" id="outT"', "out.h")
    + '<button type="button" class="salt-orb salt-sheet__close" id="outX"' + wl("x.close") + ">" + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body">' + wt("p", "", "out.p") + '<div id="outForm"></div></div>'
    + "</div>";
}

/* S3 3.8: ONE PHONE, ONE REMEMBERED ACCOUNT. Signing in as another account over a remembered one asks first,
   beside the control that was tapped, which moves here when asked. */
function replaceAsk() {
  return '<div id="askRep" class="ask" role="group" aria-labelledby="askRepT" hidden>'
    + '<p class="lead" id="askRepT"></p>'
    + wt("button", 'class="btn salt-pill salt-pill--md" id="askYes" type="button"', "rep.yes")
    + '<button class="btn salt-ghost" id="askNo" type="button"></button></div>';
}

/* S3 3.10: KEEP IT ON YOUR HOME SCREEN. An iPhone's Home Screen app keeps its own storage, so what Safari
   remembers never reaches it: the Sheet says so in one line and carries the sign-in across with a code. The code
   and its key are minted as the Sheet opens, so Copy is a tap of its own (the judges' must-not-ship list), and
   the steps draw the phone's own marks. Nothing here says a link signs the saved app in.
   S9 fix: SAVING AS AN APP IS THIS DEVICE'S FIRST ROW (the plan's 9.9), where it was a card of its own at the head of
   the statement: the Plain ledger's row, its way in the value and its words under it. */
function keepCard() {
  return '<div id="keepCard" class="keepcard salt-ledger salt-ledger--plain" hidden><div class="salt-ledger__row">'
    + '<div class="salt-ledger__line">' + wt("span", 'class="salt-ledger__label" id="keepHead"', "keep.h")
    + '<span class="salt-ledger__value">'
    + wt("button", 'class="btn salt-ghost salt-ghost--lit" id="keepGo" type="button"', "keep.go")
    + wt("button", 'class="btn salt-ghost salt-ghost--lit" id="keepInstall" type="button" hidden', "keep.install") + "</span></div>"
    + '<div class="salt-ledger__flag">' + wt("p", 'class="kline" id="keepLine"', "keep.line")
    /* S3 3.12: the browser's own Install where it offers one; else that browser's own marks, drawn */
    + wt("p", 'class="kline" id="keepSam" hidden', "keep.sam", 22)
    + wt("p", 'class="kline" id="keepDesk" hidden', "keep.desk", 22)
    /* S3 fix: an Android browser that offers no install, or whose offer was turned down, is shown its own menu's mark */
    + wt("p", 'class="kline" id="keepDroid" hidden', "keep.droid", 22) + "</div></div></div>";
}
/* S7 7.3: THIS DEVICE, in Account, ONE CARD: saving it as an app first (the keep card, S9 fix, which homeKeep moves to
   lead a new account's Home instead), its notifications (drawDevice), the account's phones and computers with Sign in
   another device and Sign out other devices in #devSlot (S9 9.9, drawDev), and signing out of this one, the
   customer's one Log out (#lock, S7 7.1: it left the bar) */
function thisDevice() {
  return '<section id="thisDevice" class="devcard salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm" aria-labelledby="devH" hidden>'
    + wt("h2", 'class="salt-eyebrow salt-eyebrow--copper" id="devH"', "dev.h")
    + '<div id="devRows" class="salt-ledger salt-ledger--plain"></div>'
    /* S13 13.4: the language, under its label, the door's own switch */
    + '<div class="salt-ledger salt-ledger--plain"><div class="salt-ledger__row"><div class="salt-ledger__line">'
    + wt("span", 'class="salt-ledger__label"', "lang.h") + '</div><div class="salt-ledger__flag">' + langSwitch() + "</div></div></div>"
    + '<div id="devSlot"></div>'
    + wt("button", 'type="button" class="salt-ghost devout" id="lock"', "dev.out")
    + "</section>";
}
function keepSheet() {
  return '<div id="keepScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="keepSheet" class="salt-sheet" role="dialog" aria-modal="true" aria-labelledby="keepT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head">' + wt("h2", 'class="salt-sheet__title" id="keepT"', "keep.h")
    + '<button type="button" class="salt-orb salt-sheet__close" id="keepX"' + wl("x.close") + ">" + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body">'
    + wt("p", "", "keep.why")
    + '<ol class="keepsteps">'
    + "<li>" + wt("span", "", "keep.s1", 22)
    + wt("span", 'class="sub2" id="keepWhere"', "keep.where") + "</li>"
    + "<li>" + wt("span", "", "keep.s2", 22) + "</li>"
    + "<li>" + wt("span", "", "keep.s3", 22) + "</li></ol>"
    + '<div class="salt-code">' + wt("label", 'class="salt-code__label" for="keepCode"', "keep.code")
    + '<input class="fld salt-field__input salt-field__input--code" id="keepCode" type="text" readonly value="" aria-describedby="keepHint">'
    + wt("span", 'class="salt-code__hint" id="keepHint"', "code.once") + "</div>"
    + '<p class="msg" id="keepMsg" role="status" aria-live="polite"></p></div>'
    + '<div class="salt-sheet__foot">' + wt("button", 'class="btn salt-pill salt-pill--md" id="keepCopy" type="button"', "code.copy") + "</div>"
    + "</div>";
}

/* S6 6.4: THE PAY SHEET (his D8 as amended). One Sheet for every Pay; the script fills its body and its foot. */
function paySheet() {
  return '<div id="payScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="paySheet" class="salt-sheet" role="dialog" aria-modal="true" aria-labelledby="payT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head">' + wt("h2", 'class="salt-sheet__title" id="payT"', "pay.h")
    + '<button type="button" class="salt-orb salt-sheet__close" id="payX"' + wl("x.close") + ">" + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body" id="payBody"></div><div class="salt-sheet__foot" id="payFoot"></div></div>';
}
/* S9 9.9, HIS D2: the Sheet that signs in another device from This device, its code minted as it opens so Copy is a tap
   of its own, and a QR that opens Salt Counter on the other device's camera, where the code is typed. The QR carries the
   address alone: a key in an address signs a browser tab in only when his counter minted it (S3), so an address one
   customer sends another never signs the other in. */
function devSheet() {
  return '<div id="devScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="devSheet" class="salt-sheet" role="dialog" aria-modal="true" aria-labelledby="devT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head">' + wt("h2", 'class="salt-sheet__title" id="devT"', "dev.another")
    + '<button type="button" class="salt-orb salt-sheet__close" id="devX"' + wl("x.close") + ">" + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body">'
    + wt("p", "", "dev.scan")
    + '<div class="salt-qr" id="devQr" hidden><div class="salt-qr__code"><img id="devQrImg" alt="' + esc(EN["dev.qrAlt"]) + '" data-wa="dev.qrAlt" width="180" height="180"></div>'
    + '<div class="salt-qr__meta">' + wt("span", 'class="salt-qr__caption"', "dev.qrCap") + "</div></div>"
    + '<div class="salt-code">' + wt("label", 'class="salt-code__label" for="devCode"', "dev.code")
    + '<input class="fld salt-field__input salt-field__input--code" id="devCode" type="text" readonly value="" aria-describedby="devHint">'
    + wt("span", 'class="salt-code__hint" id="devHint"', "code.once") + "</div>"
    + '<p class="msg" id="devMsg" role="status" aria-live="polite"></p></div>'
    + '<div class="salt-sheet__foot">' + wt("button", 'class="btn salt-pill salt-pill--md" id="devCopy" type="button" disabled', "code.copy") + "</div>"
    + "</div>";
}

/* S3 3.11: ONE STEP TO FINISH. The saved app starts at /app with storage of its own: a key carried by Paste, or the
   eight symbols typed, brings the sign-in across, and the help says the true way to get one. */
function codeScreen() {
  return '<div id="codeBox" class="gate" hidden>' + langSwitch()
    + '<span class="appmark">' + glyphSvg("ring", 40) + "</span>"
    + wt("h1", 'id="codeH"', "code.h")
    + wt("p", 'class="lead" id="codeLead"', "code.lead")
    + wt("button", 'class="btn salt-pill salt-pill--md" id="codePaste" type="button"', "code.paste", 20)
    + '<div class="salt-code">' + wt("label", 'class="salt-code__label" for="codeIn"', "code.or")
    + '<input class="fld salt-field__input salt-field__input--code" id="codeIn" type="text" placeholder="XXXX XXXX" '
    + 'autocomplete="one-time-code" autocapitalize="characters" autocorrect="off" spellcheck="false" aria-describedby="codeHint">'
    + wt("span", 'class="salt-code__hint" id="codeHint"', "code.hint") + "</div>"
    + '<p class="msg" id="codeMsg" role="status" aria-live="polite"></p>'
    + wt("button", 'class="btn salt-ghost" id="codeDoor" type="button"', "code.door")
    + wt("p", 'class="salt-insight" id="codeHelp"', "code.help")
    + "</div>";
}

/* S3 3.3: THE LINK PAGE. A link opens here and spends nothing until Continue: it says which account it opens
   and what is inside, and an app's own browser is sent to Safari or Chrome first. */
function linkScreen() {
  const row = (g, k) => '<div class="salt-ledger__row"><div class="salt-ledger__line"><span class="salt-ledger__label">'
    + glyphSvg(g, 20) + wt("span", "", k) + "</span></div></div>";
  return '<div id="link" class="gate" hidden>' + langSwitch()
    + '<span class="appmark">' + glyphSvg("ring", 40) + "</span>"
    + wt("h1", "", "link.h")
    + wt("p", 'class="lead" id="linkLead"', "link.lead")
    + '<div class="salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm">'
    + wt("p", 'class="salt-eyebrow salt-eyebrow--copper"', "link.inside")
    + '<div class="salt-ledger salt-ledger--plain">'
    + row("home", "link.r1") + row("prices", "link.r2") + row("orders", "link.r3")
    + "</div></div>"
    /* an app's own browser keeps nothing once it closes: the phone's own menu mark, and where to go */
    + '<p class="salt-insight" id="linkInapp" hidden>'
    + wt("span", 'id="inappIos"', "link.inappIos", 20)
    + wt("span", 'id="inappDroid" hidden', "link.inappDroid", 20) + "</p>"
    + wt("button", 'class="btn salt-ghost" id="linkCopy" type="button" hidden', "link.copy")
    + wt("button", 'class="btn salt-pill salt-pill--md" id="linkGo" type="button"', "link.go")
    + '<p class="msg" id="linkMsg" role="status" aria-live="polite"></p>'
    + wt("p", 'class="sub2 center" id="linkOnce"', "link.once")
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
        + (p.fellBack ? '<p class="sub2">' + wd("board.only") + "</p>" : "")
        + '<div class="tblw"><table><thead><tr><th class="l">' + wd("board.size") + "</th><th>" + wd("board.price") + "</th></tr></thead><tbody>"
        + p.sizes.map((r) => "<tr><td class=\"l\">" + esc(unitsOf(r.q, p.unit))
            + "</td><td>" + esc(rm(r.price)) + "</td></tr>").join("")
        + "</tbody></table></div></div>").join("")
    : '<p class="lead">' + wd("board.none") + "</p>";
  return guestPage("<h2>" + wd("board.h") + "</h2>"
    + '<p class="lead">' + (week ? fillHtml(EN["board.week"], { w: esc(week) }, "en") + " " : "")
    + wd("board.goods") + " " + wd("deliv") + " "
    + wd("board.ask") + "</p>"
    + body
    /* S8 8.2: A STRANGER IS TOLD WHAT TO DO NEXT, in words and with no brand. The board is all they
       have, and it named no way to order. */
    + '<p class="lead">' + wd("board.next") + "</p>", nonce, esc(EN["board.h"]));
}
/* S8 8.2: EVERY SHUT LINK ANSWERS THIS, WORD FOR WORD. Unknown, malformed, withdrawn, declined and
   waiting ids all get it, in the board's own look, so the door tells a stranger nothing about which
   it was and never leaves them on a bare "Not found". Its tab says so too, one title for every kind. */
export function shutPage(nonce) {
  return guestPage("<h2>" + wd("shut.h") + "</h2>"
    + '<p class="lead">' + wd("shut.p") + "</p>", nonce, esc(EN["shut.title"]));
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
/* THE NOTICE (20 Sep 2026; S7 7.5, his D14 of 24 Sep 2026): a still card at the head of Home, every line standing, drawn at
   first paint and hidden until there is a line to show. It was a band across the top of every page, running as one
   track or changing a line every four seconds; the mode it was set in is no longer read. */
function noticeCard(b) {
  const lines = (b && Array.isArray(b.lines)) ? b.lines : [];
  return '<div id="bull" class="salt-insight hnote"' + (lines.length ? "" : " hidden") + ">" + lines.map((l) => "<p>" + esc(l) + "</p>").join("") + "</div>";
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
  + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ADMIN_ICONS[n] || PLACE_ICONS[n]) + "</svg>";
/* S7 7.1 (his D11 of 24 Sep 2026): THE CUSTOMER'S PLACES, in the order the bar draws them. Each is [the id its panel and
   its buttons carry, its word, its address]: Home opens first, and Rewards is an associate's alone. The ids are the
   tabs' own (stmt, order, card), so every road that named a tab still names its place. */
export const PLACES = [["home", EN["place.home"], "home"], ["prices", EN["place.prices"], "prices"], ["order", EN["place.order"], "orders"],
  ["stmt", EN["place.stmt"], "account"], ["card", EN["place.card"], "rewards"]];
const PLACE_ICONS = {
  home: '<path d="M4 11.2 L12 4.6 L20 11.2 M6.2 9.4 V19.4 H10 V14.4 H14 V19.4 H17.8 V9.4"/>',
  prices: '<path d="M12.6 3.8 H19.4 A0.8 0.8 0 0 1 20.2 4.6 V11.4 L11.4 20.2 L3.8 12.6 Z"/><circle cx="16.2" cy="7.8" r="1.4"/>',
  order: '<path d="M6 3.8 H18 V20.2 L15.6 18.8 L13.2 20.2 L10.8 18.8 L8.4 20.2 L6 18.8 Z M9 8.4 H15 M9 11.8 H15 M9 15.2 H12.6"/>',
  stmt: '<circle cx="12" cy="8.4" r="3.6"/><path d="M4.8 20 C5.6 16.2 8.4 14.2 12 14.2 C15.6 14.2 18.4 16.2 19.2 20"/>',
  card: '<circle cx="12" cy="9.2" r="5.2"/><path d="M9 13.6 L7.6 20.2 L12 18 L16.4 20.2 L15 13.6"/>'
};
/* a place as a button, on the rail or on the bar; both carry data-t, and Rewards starts hidden. The rail's keeps the tab's
   old id (tPrices, tOrder, tCard), so what found a tab by its id finds its place */
const placeAttrs = (t, id) => (id ? ' id="t' + t.charAt(0).toUpperCase() + t.slice(1) + '"' : "") + ' data-t="' + t + '"' + (t === "home" ? ' aria-current="page"' : "") + (t === "card" ? " hidden" : "");
function placesRail() {
  return '<nav class="salt-rail salt-appbar__rail" aria-label="Salt Counter">'
    + '<div class="salt-rail__brand"><span class="aring">' + glyphSvg("ring", 22) + '</span><b class="salt-title">Salt Counter</b></div>'
    + '<div class="salt-rail__group">' + PLACES.map(([t, w]) => '<button type="button" class="salt-rail__tab salt-rail__tab--solo"' + placeAttrs(t, true) + ">"
      + '<span class="salt-appbar__place"><span class="salt-appbar__icon">' + aico(t) + "</span>" + wt("span", "", "place." + t) + "</span>"
      + '<span class="salt-rail__count" data-n="' + t + '"></span></button>').join("") + "</div>"
    + '<p class="salt-rail__foot cfoot" data-wholine>' + whoAs() + "</p></nav>";
}
function placesBar() {
  return '<nav class="salt-appbar" aria-label="Salt Counter">' + PLACES.map(([t, w]) => '<button type="button" class="salt-appbar__item"' + placeAttrs(t) + ">"
    + '<span class="salt-appbar__icon">' + aico(t) + "</span>" + wt("span", 'class="salt-appbar__label"', "place." + t)
    + '<span class="salt-appbar__count" data-n="' + t + '"></span></button>').join("") + "</nav>";
}
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
    + '<div id="gate" class="gate"' + (owner ? " hidden" : "") + ">" + (owner ? "" : langSwitch())
    + wt("h1", "", "door.h")
    + wt("p", 'class="lead"', "door.lead")
    /* S3 3.7, HIS D3 OF 24 SEP 2026: ONE FIELD FOR EACH SECRET, named as a password manager reads them, so one can
       fill the door; the six boxes of 16 Sep could not be filled by anything but fingers */
    + '<div id="doorBox"><form id="f" novalidate>'
    + '<div class="salt-field">' + wt("label", 'class="salt-field__label" for="un"', "door.un")
    + '<input class="fld salt-field__input salt-field__input--mono" id="un" name="username" type="text" value="' + u + '" '
    + 'autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="unHint">'
    + wt("span", 'class="salt-field__hint" id="unHint"', "door.unHint") + "</div>"
    + '<div class="salt-field">' + wt("label", 'class="salt-field__label" for="pw"', "door.pw")
    + '<div class="pwrow"><input class="fld salt-field__input salt-field__input--mono" id="pw" name="password" type="password" '
    + 'autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" aria-describedby="pwHint">'
    + wt("button", 'class="salt-ghost" id="pwShow" type="button" aria-pressed="false" aria-controls="pw"', "door.show") + "</div>"
    + wt("span", 'class="salt-field__hint" id="pwHint"', "door.pwHint") + "</div>"
    /* v692: remembering, in the words the link uses (S3 3.7) */
    + '<label class="rem" for="rem"><input type="checkbox" id="rem" checked>'
    + wt("span", "", "door.rem") + "</label>"
    + wt("button", 'class="btn salt-pill salt-pill--md" id="go" type="submit"', "door.go")
    + "</form>"
    + '<p class="msg" id="msg" role="status" aria-live="polite"></p>'
    /* S3 fix: a remembered phone the site could not open just now tries again from here, which a saved app with no
       reload needs */
    + (owner ? "" : wt("button", 'class="btn salt-ghost" id="remAgain" type="button" hidden', "door.again"))
    /* S3 3.11: a code from another device, or from Salt Admin at the counter. S3 fix: both inside the form's box, so
       the signed-out Sheet carries them with it */
    + (owner ? "" : wt("button", 'class="btn salt-ghost" id="toCode" type="button"', "door.toCode"))
    + wt("p", 'class="salt-insight"', "door.help")
    + "</div></div>"
    + (owner ? "" : linkScreen() + codeScreen() + signedOutSheet() + replaceAsk() + keepSheet() + paySheet() + devSheet())
    /* S7 7.1 (his D11 of 24 Sep 2026): THE PLACES. Home opens first, and the places sit on the system's App bar under
       the thumb on a phone and on its rail beside the page from 1080px, the recipe's own switch. The bar of lines
       and the header live inside the shell, so what is hidden while signed out is hidden in one place. */
    + '<div id="tabs" class="cshell" hidden>' + placesRail() + '<div class="cmain">'
    + '<div id="barw" hidden><div class="bar' + (owner ? " vbar" : "") + '">'
    /* S9 9.5: on his page an account is viewed, never signed into, so the bar says whose it is and that it is
       read only, and its one control takes him back to that account on Accounts. A customer's Log out is This
       device's, on Account (S7 7.1), so their bar holds nothing until it has a lapse to say */
    + (owner ? '<span><b id="whoacct"></b><span id="cd"></span><span id="vas">Viewing as <b id="vasU"></b>, read only</span></span>'
      + '<button type="button" id="lock">Back to accounts</button>' : "")
    /* S1 1.5: a lapsed session says so where the reader is, with the one way back: a second row of the bar */
    + '<div id="lapse" class="lapse" role="alert" hidden><span id="lapseT"></span>' + wt("button", 'type="button" id="lapseGo"', "link.go") + "</div>"
    + "</div></div>"
    /* the header names the place and whose account it is, so every customer knows their username */
    + '<header class="chead">' + wt("h1", 'id="placeT"', "place.home")
    + '<p class="cwho" data-wholine>' + whoAs() + '<span id="cstay"></span></p></header>'
    /* HOME: what they owe, what needs them and what they order again; the notice first (S7 7.5), then the keep card,
       which leads only a new account's Home and is otherwise This device's first row (homeKeep). What they owe is
       stage 6's To pay now (S6 6.2), its one filled Pay opening the pay sheet. Two columns from 1080px (S7 7.2) */
    + '<div id="pHome" class="home"><div class="hcol">' + noticeCard(bulletin) + (owner ? "" : keepCard())
    + '<div id="payHead" class="payhead" hidden></div><div id="hNeeds"></div></div>'
    + '<div class="hcol"><div id="hComing"></div><div id="hAgain"></div></div></div>'
    /* S7 7.3: ACCOUNT, what drawAccount(el) puts in a place: the statement with its one month filter (placed
       beside the list it filters), the earlier statements at its foot, and This device beside it from 1080px */
    + '<div id="pStmt" hidden><div id="acct" class="acct"><div class="acct__main">'
    + '<div id="stmtBack" class="stmtback" hidden><p id="stmtBackT"></p>'
    + wt("button", 'type="button" class="salt-ghost" id="stmtBackGo"', "acct.back") + "</div>"
    + '<div id="mfil" class="salt-tabs mfil" role="group"' + wl("acct.months") + ' hidden></div><p class="mfnote" id="mfnote" role="status"></p>'
    + '<div id="out"></div>'
    + '<div id="stmtFoot" class="stmtfoot" hidden></div></div>'
    + (owner ? "" : thisDevice())
    + "</div></div>"
    + '<div id="pPrices" class="panel" hidden></div>'
    + '<div id="pOrder" class="panel" hidden></div>'
    /* v706: the associate's own card, Rewards since S7 7.1. Its place is hidden for everybody else */
    + '<div id="pCard" class="panel" hidden></div>'
    + "</div>" + placesBar() + "</div>"
    + '<script nonce="' + nonce + '">'
    + CLIENT_JS.replace(/__POLL__/g, String(POLL_MS))
      /* the notice as the page was served, so the card is drawn with no request; the poll reads it again. A function
         replacement, as every splice carrying typed words: a $' or $` in the notice was read as a pattern and pasted the
         page into the script, which then did not run (S7-R2 of the stage 7 review) */
      .replace("__BULL__", () => JSON.stringify({ lines: (bulletin && bulletin.lines) || [] }).replace(/</g, "\\u003c"))
      .replace("__PAY_SITE__", JSON.stringify(PAY_SITE)).replace("__PAY_ACCOUNTS__", JSON.stringify(PAY_ACCOUNTS))
      /* v695: the product marks, so the page can draw one wherever it would have written a name */
      .replace("__PSYM__", JSON.stringify(Object.assign({ _: RING }, PSYM)))
      .replace("__PSHAPE__", JSON.stringify(PSHAPE))
      /* S13 13.3: every word by key, both tables, and the functions that fill them, the page's own; the marks for a
         sentence the script words again. By function, so a $ in a word is kept as typed; "<" escaped, as the notice is */
      .replace("__WORDS__", () => JSON.stringify(WORDS).replace(/</g, "\\u003c"))
      .replace("/*__FILL__*/", () => [fill, fillHtml, unitsIn, glyphOf].map(String).join("\n"))
      .replace("__GLS__", () => JSON.stringify(GLYPH))
      /* S6 6.4: the pay sheet's three marks, and the one link into the pay page, its source carried as it is */
      .replace("__GLYPH__", JSON.stringify({ bank: GLYPH.bank, qr: GLYPH.qr, copy: GLYPH.copy, cash: GLYPH.cash }))
      .replace("/*__PAYHREF__*/", () => payHref.toString())
      /* S4 4.6: the open-order limit the Worker refuses at, so the page can say it before the form */
      .replace("__MAX_OPEN__", String(MAX_OPEN)).replace("__OPEN_STATES__", JSON.stringify(OPEN_STATES))
      /* S7 7.1: the places, so the script names them as the markup does */
      .replace("__PLACES__", JSON.stringify(PLACES))
      /* "<" is escaped because this one carries the master passphrase, and a "</script>" inside a
         string literal ends the block wherever it appears: the browser closes the tag first and
         reads the rest of the passphrase as page text. A function replacement, so a $ in it is kept as typed. */
      .replace("__OWNER__", () => JSON.stringify(owner || null).replace(/</g, "\\u003c"))
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
  /* THE NOTICE (20 Sep 2026): drawn from what the page was served with, read again every sixth poll. S7 7.5, his D14:
     a still card on Home, every line standing, so nothing runs, changes or is told again to a screen reader */
  var BULL=__BULL__, bullN=0;
  function bullDraw(b){
    BULL=b||{lines:[]};
    var box=document.getElementById('bull'); if(!box) return;
    var lines=BULL.lines||[]; box.hidden=!lines.length; box.textContent='';
    lines.forEach(function(l){ var p=document.createElement('p'); p.textContent=l; box.appendChild(p); });
  }
  async function bullRead(){
    try{
      var r=await fetch('/bulletin',{cache:'no-store'}); var j=await r.json();
      if(!j||!j.ok) return;
      if(JSON.stringify(j.lines||[])!==JSON.stringify(BULL.lines||[])) bullDraw({lines:j.lines||[]});
    }catch(e){}
  }
  window.bullDraw=bullDraw; window.bullRead=bullRead;   /* reachable from outside the closure, which is how the suite drives them */
  bullDraw(BULL);
  var PAY_SITE=__PAY_SITE__, PAY=__PAY_ACCOUNTS__;
  var session='', user='', prices=null, orders=[], poll=null, tab='home', draft={};
  /* S6 6.5: the account's own claims, money said to be sent on To pay now rather than on an order (GET /orders) */
  var claims=[];
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
  /* ---- S13 13.3 (his D12 of 24 Sep 2026): EVERY WORD BY KEY, from one table a language (stmt/words.js) ----------------
     tw(k,s) is a key's words with its slots filled, twh(k,s) the same as markup, and a key the reader's language lacks is
     English's, never the key's name. A slot may be a function of the language its words were found in, so a date or a
     size inside a sentence is in the sentence's language, and one standing alone in the reader's. setW(x,k,s) words an
     element and keeps its key and slots on it (data-w), which is how rewd() words the page again; the markup's keyed
     elements are the server's. A refusal is worded from its code (wErr), the Worker's English standing for one unknown. */
  var WORDS=__WORDS__, LANG='en';
  /*__FILL__*/
  function has(L,k){ return !!WORDS[L]&&Object.prototype.hasOwnProperty.call(WORDS[L],k); }
  function wordIn(L,k){ return has(L,k)?WORDS[L][k]:has('en',k)?WORDS.en[k]:''; }
  function lgOf(k){ return has(LANG,k)?LANG:'en'; }
  function word(k){ return wordIn(LANG,k); }
  function devIn(L){ return DEV==='iPad'?'iPad':wordIn(L,'dev.'+DEV); }
  function tw(k,s){ return fill(word(k), Object.assign({dev:devIn}, s), lgOf(k)); }
  var GLS=__GLS__, GLF={dots:true, vdots:true};
  function esch(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function twh(k,s,px){
    var o={dev:function(L){ return '<span class="dev">'+esch(devIn(L))+'</span>'; }};
    Object.keys(GLS).forEach(function(n){ o[n]=glyphOf(GLS,GLF,n,px||22); });
    return fillHtml(word(k), Object.assign(o,s), lgOf(k));
  }
  function setW(x,k,s){
    if(!x) return x;
    x.setAttribute('data-w',k); x._ws=s||null;
    var h=twh(k,s,+x.getAttribute('data-gs')||22); if(x.innerHTML!==h) x.innerHTML=h;
    return x;
  }
  function rewd(){
    [].forEach.call(document.querySelectorAll('[data-w]'),function(x){ setW(x,x.getAttribute('data-w'),x._ws); });
    [].forEach.call(document.querySelectorAll('[data-wl]'),function(x){ x.setAttribute('aria-label',tw(x.getAttribute('data-wl'))); });
    [].forEach.call(document.querySelectorAll('[data-wp]'),function(x){ x.setAttribute('placeholder',tw(x.getAttribute('data-wp'))); });
    [].forEach.call(document.querySelectorAll('[data-wa]'),function(x){ x.setAttribute('alt',tw(x.getAttribute('data-wa'))); });
  }
  /* a refusal stands alone beside its control, so it is said as a sentence: the Worker's words are a clause, lower case
     with no stop, in either language (MY12 of the stage 13 review) */
  function sentence(t){ t=String(t||''); if(!t) return t; t=t.charAt(0).toUpperCase()+t.slice(1); return /[.!?]$/.test(t)?t:t+'.'; }
  function wErr(b,fb,s){ var c=b&&b.code; return sentence(c&&has('en','e.'+c)?tw('e.'+c,b.vars):b&&b.said?tw(b.said):(b&&b.error)||(fb?tw(fb,s):'')); }
  /* a date or a size in a sentence, said in the sentence's language */
  function Dd(f,x){ return function(L){ return f(x,L); }; }
  function Uq(q,u){ return function(L){ return unitsOf(q,u,L); }; }
  function Wk(k){ return function(L){ return wordIn(L,k); }; }
  /* a note kept to be shown later (draft.pushNote) is kept unworded, so it is said in the language of the place it shows in */
  function noteSaid(x){ return typeof x==='function'?x(LANG):(x||''); }
  /* ---- S13 13.4 (his D12 of 24 Sep 2026): THE FIRST MALAY SLICE FOLLOWS THE PHONE, WITH A SWITCH ----------------------
     The reader's language is the one chosen on this phone (the switch on the door and in This device, kept as salt-lang),
     else the first of the phone's languages the Counter speaks (ms, ms-MY, ms-BN or zsm; en), else English. The Malay
     table is a slice (stmt/words.js), a key it lacks being English's, and what lies outside the slice is drawn in English
     whatever was chosen (inEn), so a word it shares with the slice, a state, a size or a date, reads English there too.
     html lang follows and translate="no" stays; the choice is left in this browser's Cache as /lang, where the service
     worker reads it to word a banner (stmt/sw.js). His own page is English. */
  var LANG_KEY='salt-lang', READER='en';
  function langOk(L){ return Object.prototype.hasOwnProperty.call(WORDS,L); }
  function langKept(){ try{ var v=localStorage.getItem(LANG_KEY); return langOk(v)?v:''; }catch(e){ return ''; } }
  function langOfPhone(){
    var l=[].concat(navigator.languages||[],navigator.language||[]);
    for(var i=0;i<l.length;i++){ var p=String(l[i]||'').toLowerCase().split(/[-_]/)[0]; if(p==='ms'||p==='zsm') return 'ms'; if(p==='en') return 'en'; }
    return 'en';
  }
  function inEn(f){ return function(){ var was=LANG; LANG='en'; try{ return f.apply(this,arguments); }finally{ LANG=was; } }; }
  /* a note a tap leaves to be drawn in a part outside the slice (the order sheet, the order's cancel, the limit, Rewards' links)
     is worded in English as it is made, since the tap runs after inEn has handed the reader's language back */
  var twE=inEn(tw), wErrE=inEn(wErr);
  function langSet(L){
    READER=LANG=!OWNER&&langOk(L)?L:'en';
    document.documentElement.lang=READER;
    [].forEach.call(document.querySelectorAll('[data-l]'),function(b){ var on=b.getAttribute('data-l')===READER;
      b.classList.toggle('salt-tabs__pill--active',on); b.setAttribute('aria-pressed',on?'true':'false'); });
    try{ if(!OWNER&&window.caches) caches.open('lang').then(function(c){ return c.put('/lang',new Response(READER)); }).catch(function(){}); }
    catch(e){ /* the banner stays in English */ }
  }
  langSet(langKept()||langOfPhone());
  /* the markup is served in English: in Malay it is worded again, device words and all; in English only the device's word */
  if(READER!=='en') rewd();
  else [].forEach.call(document.querySelectorAll('.dev'), function(x){ x.textContent=devIn(LANG); });
  /* a tap on a switch: kept on this phone (or for this visit, where storage throws), the page worded again, and what is
     drawn from the account drawn again */
  document.addEventListener('click',function(ev){
    var b=ev.target&&ev.target.closest?ev.target.closest('[data-l]'):null; if(!b||OWNER) return;
    var L=b.getAttribute('data-l');
    try{ localStorage.setItem(LANG_KEY,L); }catch(e){ /* this visit only */ }
    if(L===READER) return;
    langSet(L); rewd();
    if(session){ drawOrder(); drawDevice(); drawDev(); placeTitle(); }
  });
  /* OUTSIDE THE FIRST SLICE, ENGLISH: Prices, the statement and its months, Rewards, the order sheet, the Orders list, and an
     order's head, steps, where it stands, history and cancel (OPARTS); the lines Orders leads with are said through twE */
  drawPrices=inEn(drawPrices); pickStmt=inEn(pickStmt); drawFoot=inEn(drawFoot); drawMonths=inEn(drawMonths); applyMonths=inEn(applyMonths);
  drawCard=inEn(drawCard); drawMyLinks=inEn(drawMyLinks); sheetDraw=inEn(sheetDraw); noOrderLine=inEn(noOrderLine); limitLine=inEn(limitLine);
  oList=inEn(oList); oHead=inEn(oHead); oSteps=inEn(oSteps); oWhen=inEn(oWhen); oHist=inEn(oHist); oFoot=inEn(oFoot);
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
      pHome=document.getElementById('pHome');
  /* S7 7.1: THE PLACES. Each is a button on the rail and one on the App bar, both carrying data-t; tCard is the rail's
     Rewards, whose hidden says whether this account has the place (stmt/owner.js reads it) */
  var PLACES=__PLACES__, PANEL={home:pHome, prices:pPrices, order:pOrder, stmt:pStmt, card:pCard};
  function placeBtns(t){ return document.querySelectorAll('button[data-t="'+t+'"]'); }
  function placeHide(t,on){ [].forEach.call(placeBtns(t),function(b){ b.hidden=on; }); }
  var tCard=placeBtns('card')[0];
  /* ---- OVER THE LINE, THE ACCOUNT IS A PAYMENT PAGE (his instruction of 23 Sep 2026) ------------
     "If someone owes more than RM100, their account will only lead them to a payment page, which
     states: please pay the overdue amount before making another order." What they owe is sealed
     inside their own live statement (tools/make_statements.mjs), the same figure its footer reads,
     so nothing about the book is in the store in the clear to decide it with. Over the line, the
     account leads with what to pay, the order form is not offered, and the statement stays one tap away,
     because a figure to pay is only fair beside the orders it is made of. It lifts on its own: the
     next publish after the payment is recorded writes a smaller figure.
     S6 6.7, HIS D9 OF 24 SEP 2026: THE LINE COUNTS ONLY WHAT IS PAST ITS TERM, the sealed pay.overdue, never
     what is owed (a delivery made yesterday is owed, not overdue). The page shows each part with the day it
     fell due, Prices stays readable, and a claim waiting on him reopens ordering: his acknowledgement of the
     next order is still the check. */
  var HOLD_RM=100, hold=false;
  /* S6: what the live statement seals beside owed (tools/make_statements.mjs payDue): to pay now, overdue and
     coming up, each part with its dates. Read, never priced here. */
  var payDue=null, liveAt='';
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
  /* S13: a mark's name is the table's, by its shape (shape.<Shape>), so a screen reader says it in the reader's language */
  function pshape(product){ var n=PSHAPE[String(product||'').toLowerCase()]||PSHAPE._; return wordIn(LANG,'shape.'+n)||n; }
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
  function showPw(on){ pw.type=on?'text':'password'; pwShow.setAttribute('aria-pressed',on?'true':'false'); setW(pwShow,on?'door.hide':'door.show'); }
  pwShow.addEventListener('click', function(){ showPw(pw.type==='password'); try{ pw.focus(); }catch(e){} });
  /* what this phone can say about a value before it is sent: that one of the right length holds a symbol the
     alphabet never uses, which is a typing slip and never a fact about an account. Anything else goes to the site
     and its one answer. The test account's zeros are its own (v689). */
  function unfit(v, n, what){
    var raw=clean(v);
    return raw.length===n&&!/^0+$/.test(raw)&&ALPHA.test(raw)?tw(what==='username'?'door.unfitUn':'door.unfitPw'):'';
  }

  function el(tag,cls,text){ var e=document.createElement(tag); if(cls)e.className=cls; if(text!=null)e.textContent=text; return e; }
  /* S9: whether the page is still there, for work that lands after a wait (a closed window has no document). S7 merge:
     drawOrder, drawHome and drawDevice ask it too, since every flow that waits ends in one of them (a sign-in's
     notifications filed, a claim, a cash choice, a re-read), and one landing on a page that has gone threw */
  function docLive(){ try{ return !!document&&!!document.body; }catch(e){ return false; } }
  function rm(n){ return 'RM '+Number(n||0).toLocaleString('en-MY',{minimumFractionDigits:0,maximumFractionDigits:2}); }
  /* D11 (S4, 24 Sep 2026): units above one, unit at one and under; S13: in the language asked, the reader's by default */
  function unitsOf(q,u,L){ L=L||LANG; return unitsIn(wordIn(L,'unit.one'),wordIn(L,'unit.many'),q,u); }

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
  /* a moment in Kuala Lumpur, in parts: the month is read off the table's mon3, never off en-GB's own short month. S13: each
     in the language asked, the reader's by default */
  function mon3(L){ return wordIn(L||LANG,'mon3').split(' '); }
  function day3(L){ return wordIn(L||LANG,'day3').split(' '); }
  function monthsIn(L){ return wordIn(L||LANG,'months').split(' '); }
  /* the owner's script's, spliced after this on his route alone, which stays English */
  var MON3=mon3('en');
  function klBits(iso){
    var p={};
    new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'numeric',year:'numeric',
      hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).forEach(function(x){ p[x.type]=x.value; });
    return p;
  }
  function stamp(iso,L){
    try{ var p=klBits(iso); return p.day+' '+mon3(L)[+p.month-1]+', '+p.hour+':'+p.minute; }catch(e){ return ''; }
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
        drawDev();   /* S9 9.9: this device is kept signed in now, and its card says so */
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
    homeKeep();
    if(!mode) return;
    setW(document.getElementById('keepHead'),IOS||DEV==='phone'?'keep.h':'keep.hApp');
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
    keepCopy.disabled=true; keepCode.value=''; ksay(tw('keep.making'),'wait');
    try{
      var tok=b64e(crypto.getRandomValues(new Uint8Array(24))).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/=+$/,'');
      var wrap=await wrapUnder(new TextEncoder().encode(tok), curCk);
      var r=await api('/handover',{token:tok, wrap:wrap});
      if(n!==keepN||keepSheetEl.hidden) return;
      if(r.status===503){ ksay(tw('keep.off'),'bad'); return; }
      if(!r.body.ok||!r.body.code){ ksay(r.status===401?wErr(r.body):tw('code.notMade'),'bad'); return; }
      keepTok=r.body.token||tok; keepMinted=keepMinted.concat(keepTok).slice(-10);
      keepCode.value=String(r.body.code).toUpperCase().replace('-',' ');
      keepCopy.disabled=false; ksay('');
    }catch(e){ if(n===keepN) ksay(tw('code.notMade'),'bad'); }
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
      Promise.resolve(done).then(function(){ ksay(tw('keep.copied')); },
        function(){ ksay(tw('keep.copyFail'),'bad'); });
    });
  }

  /* ---- THIS DEVICE'S OTHER DEVICES (S9 9.9, his D2), drawn into #devSlot of Account's This device (S7 7.3) ----------
     The account's phones and computers (POST /devices on the session, this phone's own remembered token saying which is
     this one), named in the site's words and never an address; Sign out other devices, on a second tap, sparing this one
     and its alerts; and Sign in another device, whose Sheet mints the hand-over (POST /handover) as it opens, so Copy the
     code is a tap of its own. Every answer is on the line under the controls. Notifications are drawDevice's row, above.
     His read-only view has none of it: those are not his devices. */
  var devSlot=document.getElementById('devSlot'), devN=0, devSaid={t:'',bad:false};
  var devSheetEl=document.getElementById('devSheet'), devScrim=document.getElementById('devScrim'), devCode=document.getElementById('devCode'),
      devCopy=document.getElementById('devCopy'), devMsg=document.getElementById('devMsg'), devQr=document.getElementById('devQr'), devHo='', devM=0;
  /* a device's line: its name, This one beside it, and how it is signed in under it (devRow is drawDevice's) */
  function devLine(label, value, flag){
    var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), v=el('span','salt-ledger__value');
    l.appendChild(el('span','salt-ledger__label',label));
    if(value) v.appendChild(value);
    l.appendChild(v); r.appendChild(l);
    if(flag) r.appendChild(el('span','salt-ledger__flag',flag));
    return r;
  }
  function devDay(iso,L){ try{ var p=klBits(iso), q=klBits(new Date().toISOString()); return p.day===q.day&&p.month===q.month?p.hour+':'+p.minute:+p.day+' '+mon3(L)[+p.month-1]; }catch(e){ return ''; } }
  /* S13 13.4: a device as the site filed it ("Android phone, Chrome", deviceOf), its kind in the reader's words; a maker's
     and a browser's own names (iPhone, Mac, Chrome) are names, and a name this does not know is shown as filed */
  function devName(l){
    var s=String(l||''), m=/^(Android|Windows|Linux) (phone|tablet|computer)(, .+)?$/.exec(s), a=/^A (phone|computer)(, .+)?$/.exec(s);
    return m?tw('dname.'+m[2],{os:m[1]})+(m[3]||''):a?tw(a[1]==='phone'?'dname.aPhone':'dname.aComputer')+(a[2]||''):s;
  }
  function devQuiet(t){ var b=el('button','btn salt-ghost',t); b.type='button'; return b; }
  async function drawDev(){
    if(!devSlot) return;
    if(!session||view||OWNER){ devN++; devSlot.textContent=''; return; }
    var n=++devN, rec=remGet(), tok=rec&&rec.u===user?rec.t||null:null, r={status:0, body:{ok:false, error:tw('x.notSent')}};
    /* a read in the background, so a lapse it meets is left to the next thing they tap, which reopens the session (api) */
    try{
      var x=await fetch('/devices',{method:'POST', cache:'no-store', headers:{'content-type':'application/json','X-Stmt-Session':session}, body:JSON.stringify({token:tok})});
      var j=null; try{ j=await x.json(); }catch(e){ j=null; }
      r={status:x.status, body:j||{ok:false}};
    }catch(e){ /* not sent: the card says so */ }
    if(n!==devN||!session||!docLive()) return;
    devSlot.textContent='';
    var list=el('div','salt-ledger salt-ledger--plain');
    var devs=(r.body&&r.body.devices)||[], others=devs.filter(function(d){ return !d.here; }).length;
    devs.forEach(function(d){
      list.appendChild(devLine(devName(d.label)||tw('dev.aDevice'), d.here?chipEl('verdigris',tw('dev.thisOne')):null,
        d.kept?tw('dev.kept',{a:Dd(devDay,d.at), b:Dd(devDay,d.last)}):tw('dev.visit',{a:Dd(devDay,d.at)})));
    });
    if(!r.body.ok) list.appendChild(devLine(tw('dev.yours'), null, r.status===401?tw('dev.signinSee'):tw('dev.unread')));
    devSlot.appendChild(list);
    var acts=el('div','dacts'), note=el('p','dnote'+(devSaid.bad?' bad':''),devSaid.t); note.setAttribute('role','status');
    var another=devQuiet(tw('dev.another')); another.addEventListener('click', function(){ openDevSheet(another); });
    acts.appendChild(another);
    if(others){
      var so=devQuiet(tw('dev.outOthers')), armed=null;
      so.addEventListener('click', async function(){
        if(!armed){ so.textContent=tw('dev.outAgain'); armed=setTimeout(function(){ armed=null; so.textContent=tw('dev.outOthers'); }, 4000); return; }
        clearTimeout(armed); armed=null; so.disabled=true; so.textContent=tw('dev.outGoing');
        var s2=null; try{ s2=await phoneSub(); }catch(e){}
        var rr=remGet(), x=await api('/devices/signout',{token:rr&&rr.u===user?rr.t||null:null, endpoint:s2?s2.endpoint:null});
        devSaid=x.body.ok?{t:x.body.devices?tw(x.body.devices===1?'dev.outOne':'dev.outMany',{n:x.body.devices}):tw('dev.outNone'),bad:false}
          :{t:wErr(x.body,'x.notSent'),bad:true};
        drawDev();
      });
      acts.appendChild(so);
    }
    devSlot.appendChild(acts); devSlot.appendChild(note);
    devSaid={t:'',bad:false};
  }
  function chipEl(tone, t){ return el('span','salt-status salt-status--'+tone,t); }
  function dsay(t,cls){ devMsg.textContent=t||''; devMsg.className='msg'+(cls?' '+cls:''); }
  async function mintDev(){
    var n=++devM;
    devCopy.disabled=true; devCode.value=''; devQr.hidden=true; devHo=''; dsay(tw('dev.making'),'wait');
    try{
      var tok=b64e(crypto.getRandomValues(new Uint8Array(24))).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/=+$/,'');
      var wrap=await wrapUnder(new TextEncoder().encode(tok), curCk);
      var r=await api('/handover',{token:tok, wrap:wrap});
      if(n!==devM||!docLive()||devSheetEl.hidden) return;
      if(r.status===503){ dsay(tw('dev.off'),'bad'); return; }
      if(!r.body.ok||!r.body.code){ dsay(r.status===401?wErr(r.body):tw('code.notMade'),'bad'); return; }
      keepMinted=keepMinted.concat(r.body.token||tok).slice(-10);
      devHo=String(r.body.code).toUpperCase().replace('-',' ');
      devCode.value=devHo;
      if(r.body.qr){ document.getElementById('devQrImg').src=r.body.qr; devQr.hidden=false; }
      devCopy.disabled=false; dsay('');
    }catch(e){ if(n===devM) dsay(tw('code.notMade'),'bad'); }
  }
  var devFrom=null;
  function openDevSheet(from){
    if(!devSheetEl||!curCk) return;
    devFrom=from; devScrim.hidden=false; devSheetEl.hidden=false;
    try{ devSheetEl.focus(); }catch(e){}
    mintDev();
  }
  function closeDevSheet(){
    if(!devSheetEl||devSheetEl.hidden) return;
    devSheetEl.hidden=true; devScrim.hidden=true; devM++; devHo=''; devCode.value=''; devCopy.disabled=true; dsay('');
    try{ if(devFrom&&devFrom.isConnected) devFrom.focus(); }catch(e){}
    drawDev();   /* S9 fix: the device the code signed in is on the list as the Sheet closes */
  }
  if(devSheetEl){
    document.getElementById('devX').addEventListener('click', closeDevSheet);
    devScrim.addEventListener('click', closeDevSheet);
    document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeDevSheet(); });
    devCopy.addEventListener('click', function(){
      if(!devHo) return;
      /* the tap's first act, before anything that waits: Safari allows a copy only inside the tap itself */
      var done=null;
      try{ done=navigator.clipboard.writeText(devHo); }catch(e){ done=Promise.reject(e); }
      Promise.resolve(done).then(function(){ dsay(tw('dev.copied')); },
        function(){ dsay(tw('dev.copyFail'),'bad'); });
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
    setW(document.getElementById('codeH'),ios?'code.h':'code.hDoor');
    setW(document.getElementById('codeLead'),ios?'code.lead':'code.leadDoor');
    setW(document.getElementById('codeHint'),ios?'code.hint':'code.hintDoor');
    document.getElementById('codeHelp').hidden=!ios;
    csay('');
  }
  async function openHandover(what){
    var mine=++ticket, stale=function(){ return mine!==ticket; };
    var paste=document.getElementById('codePaste');
    busy=true; paste.disabled=true; codeIn.readOnly=true; csay(tw('x.opening'),'wait');
    var r, body;
    var undo=function(){ if(!stale()){ busy=false; paste.disabled=false; codeIn.readOnly=false; } };
    try{
      r=await fetch('/handover/open', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(what)});
      body=await r.json();
    }catch(e){ if(stale()) return false; undo(); csay(tw('code.dropped'),'bad'); return false; }
    if(stale()) return false;
    undo();
    if(!r.ok||!body.ok){
      csay(r.status===429||r.status===503?wErr(body,'x.later'):tw('code.nothing'),'bad');
      if(what.code){ codeIn.setAttribute('aria-invalid','true'); }
      return false;
    }
    var ck, b;
    try{ ck=await unwrapUnder(new TextEncoder().encode(body.token||what.token||''), body.wrap); b=JSON.parse(await open(ck, body.env)); }
    catch(e){ if(!stale()) csay(tw('code.nothing'),'bad'); return false; }
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
      if(ALPHA.test(raw.toLowerCase())){ codeIn.setAttribute('aria-invalid','true'); csay(tw('code.unfit'),'bad'); return; }
      openHandover({code:codeOf(raw)});
    });
    document.getElementById('codePaste').addEventListener('click', async function(){
      var t='';
      try{ t=String(await navigator.clipboard.readText()||'').trim(); }
      catch(e){ csay(tw('code.pasteFail'),'bad'); try{ codeIn.focus(); }catch(e2){} return; }
      if(TOK_RE.test(t)){ openHandover({token:t}); return; }
      var c=codeOf(t);
      if(c&&!ALPHA.test(clean(c))){ codeIn.value=c.toUpperCase().replace('-',' '); openHandover({code:c}); return; }
      /* S3 fix: Safari is named only on the saved iPhone app's screen */
      csay(tw(codeIos?'code.noClip':'code.noClipDoor'),'bad');
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
    setW(t,u?'rep.ask':'rep.askAcct',{was:'<span class="mono">'+esch(was.u)+'</span>', u:'<span class="mono">'+esch(u)+'</span>'});
    setW(no,'rep.keep',{u:'<span class="nocase">'+esch(was.u)+'</span>'});
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
    bundle=null; session=''; view=false; prices=null; orders=[]; claims=[]; draft={}; seenMem=null; assoc=false; card=null; cardMonth=null; myLinks=null; myMax=0; myNote='';
    hold=false; payDue=null; liveAt='';
    parkMonths(); out.textContent=''; at=0; drawFoot(); devNote=''; drawDevice();
    mfil.textContent=''; mfil.hidden=true; mfPick=null; mfnote.textContent='';
    pPrices.textContent=''; pOrder.textContent=''; drawHome();
    tabs.hidden=true; barw.hidden=true; lapse.hidden=true; if(linkBox) linkBox.hidden=true;
    curCk=null; closeSignedOut(); if(opening) opening.hidden=true;
    closeKeep(); closePay(); keepTok=''; if(keepCardEl) keepCardEl.hidden=true; if(codeBox) codeBox.hidden=true;
    closeDevSheet(); devN++; if(devSlot) devSlot.textContent='';
    /* S3 fix: a key the Keep Sheet wrote into the address leaves it with the account */
    try{ if(location.hash) history.replaceState(null,'',location.pathname); }catch(e){}
    var ask=document.getElementById('askRep'); if(ask&&!ask.hidden){ ask.hidden=true; document.getElementById('askNo').click(); }
    /* the owner goes back to his list, never to a password field he has no password for */
    if(OWNER){ roster.hidden=false; gate.hidden=true; if(whoacct) whoacct.textContent=''; }
    else gate.hidden=false;
    placeShow('home');
    pw.value=''; showPw(false);
    if(cd) cd.textContent='';
    say(tw(OWNER?'lock.owner':'lock.out'));
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
    if(!other){ remClear(); try{ localStorage.removeItem(SEEN); }catch(e){} payqDrop(); }
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
    setW(document.getElementById('lapseT'),kept?'lapse.kept':'lapse.out');
    setW(document.getElementById('lapseGo'),kept?'door.again':'door.go');
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

  /* ---- S7 7.1 (his D11 of 24 Sep 2026): THE PLACES. Home, Prices, Orders, Account, and Rewards for an associate.
     One is shown at a time, and its buttons on the bar and the rail carry aria-current, which the recipes draw. A
     place this account does not have (Rewards for a customer, Prices over the line) is Home. Each has an address, so
     a place a reader was in is where the page opens again; only a tap writes it, and only over an address that is
     empty or a place's, never over a key the Keep Sheet wrote there (S3 3.10). ---- */
  function placeOf(h){ var m=/^#([a-z]+)$/.exec(h||''), p=m&&PLACES.filter(function(x){ return x[2]===m[1]; })[0]; return p?p[0]:''; }
  var wantPlace=placeOf(location.hash);
  function placeShow(t,tapped){
    if(!PANEL[t]||placeBtns(t)[0].hidden) t='home';
    sheetClose();
    tab=t;
    [].forEach.call(tabs.querySelectorAll('button[data-t]'),function(b){ if(b.getAttribute('data-t')===t) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    Object.keys(PANEL).forEach(function(k){ PANEL[k].hidden=k!==t; });
    placeTitle();
    if(tapped&&(!location.hash||placeOf(location.hash))){
      var p=PLACES.filter(function(x){ return x[0]===t; })[0];
      try{ history.replaceState(null,'',location.pathname+location.search+'#'+p[2]); }catch(e){}
    }
    window.scrollTo(0,0);
    /* S5: an order drawn open while the place was elsewhere is seen when they turn to the place themselves. Only a tap:
       a road aimed at another order (a row on Home, a banner, See the order, Pay) passes here before drawing it, and
       the order left open would be marked seen without ever being shown */
    if(t==='order'&&tapped){ var o=oFind(draft.oShown||''); if(o){ seeIt(o); oSync([o.id]); } }
  }
  tabs.addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-t]'); if(b) placeShow(b.getAttribute('data-t'),true);
  });
  /* the header names the place; Home greets them for the hour off their own device, or welcomes a new account, and says
     when this phone keeps them signed in */
  function placeTitle(){
    setW(document.getElementById('placeT'),tab==='home'?(fresh()?'home.welcome':hail()):'place.'+tab);
    document.getElementById('cstay').textContent=tab==='home'&&keptMine()?'. '+tw('home.stay'):'';
  }
  /* an account with nothing on it yet: no statement, and no order */
  function fresh(){ return !!bundle&&!bundle.statements.length&&!orders.length; }

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
      out.textContent=''; var e=el('div','panel'); e.appendChild(el('p','lead',tw('acct.nothing'))); out.appendChild(e);
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
    if(!stmtBack.hidden) document.getElementById('stmtBackT').textContent=tw('acct.issued',{d:list[at].label||list[at].issued});
    stmtFoot.hidden=list.length<2;
    if(stmtFoot.hidden) return;
    stmtFoot.appendChild(el('h2','salt-eyebrow salt-eyebrow--copper',tw('acct.earlier')));
    stmtFoot.appendChild(el('p','sub2',tw(s0&&s0.live?'acct.keptLive':'acct.kept')));
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
  function monthLabel(m,L){
    var y=m.slice(0,4), mm=+m.slice(5,7);
    return monthsIn(L)[mm-1]+' '+y;
  }
  function applyMonths(){
    var rows=out.querySelectorAll('[data-m]');
    for(var i=0;i<rows.length;i++){
      var m=rows[i].getAttribute('data-m');
      rows[i].style.display=(!mfPick||m===mfPick)?'':'none';
    }
    var bs=mfil.querySelectorAll('button');
    for(var k=0;k<bs.length;k++){ var on=bs[k].getAttribute('data-mf')===(mfPick||''); bs[k].className='salt-tabs__pill'+(on?' salt-tabs__pill--active':''); bs[k].setAttribute('aria-pressed',on?'true':'false'); }
    mfnote.textContent=mfPick?tw('acct.showing',{m:Dd(monthLabel,mfPick)}):tw('acct.all');
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
      b.textContent=m?mon3()[+m.slice(5,7)-1]+(oneYear?'':' '+m.slice(0,4)):tw('acct.allPill');
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
     What this browser does for the account: saving it as an app (the keep card, its first row), its notifications on
     or off, and signing out of it, each answer written on the row that was tapped. drawDev draws the account's other
     devices into #devSlot (S9 9.9). Not on his read-only view: those are not his phones. OFF IS KEPT ON THIS DEVICE:
     the subscription is dropped here and the site told (POST /push/unsubscribe, S9 9.9; a site it could not tell
     forgets it at the next wake it cannot deliver, stmt/push.js), and the automatic re-filing on the way in (askPush)
     waits for a Turn on. */
  /* devBusy is the ticket of the account a tap is in flight for, so it shuts the buttons for that account alone: a sign-out
     while Turn off was still unsubscribing left them shut for the next account on the page (S7R-5 of the stage 7 review) */
  var devEl=document.getElementById('thisDevice'), devRows=document.getElementById('devRows'), devBusy=-1, devNote='';
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
  function devBtn(t,go){ var b=el('button','salt-ghost',t); b.type='button'; b.disabled=devBusy===ticket; b.addEventListener('click',go); return b; }
  function drawDevice(){
    if(!devEl||!docLive()) return;
    devEl.hidden=!session||view||OWNER;
    if(devEl.hidden) return;
    devRows.textContent='';
    var on=!!draft.pushed||(pushCan()&&Notification.permission==='granted'&&!!draft.pushDone), said=devNote||noteSaid(draft.pushNote);
    if(!pushCan()) devRows.appendChild(devRow(tw('push.h'),tw(IOS&&!STANDALONE?'push.devIos':'push.devNo')));
    else if(on) devRows.appendChild(devRow(tw('push.h'),said||tw('push.devOn'),devBtn(tw('push.off'),devPushOff)));
    else devRows.appendChild(devRow(tw('push.h'),said||tw('push.devOff'),devBtn(tw('push.on'),devPushOn)));
    /* saving it as an app is the keep card, This device's first row (homeKeep); once saved, this says so in its place */
    if(STANDALONE) devRows.appendChild(devRow(tw('dev.saved'),tw('dev.inIt')));
  }
  async function devPushOn(){
    var mine=ticket;
    devBusy=mine; devNote=''; draft.pushNote=''; drawDevice();
    await subscribePush();
    if(devBusy===mine) devBusy=-1;
    drawDevice();
  }
  async function devPushOff(){
    var mine=ticket;
    devBusy=mine; devNote=''; drawDevice();
    var failed=false, ep=null;
    try{ var sub=await phoneSub(); if(sub){ ep=sub.endpoint; await sub.unsubscribe(); } pushOffSet(true); draft.pushed=false; draft.pushDone=false; draft.pushNote=''; }
    catch(e){ failed=true; }
    /* S9 9.9: the site drops this phone's own push record on its session, for the same account only */
    if(!failed&&ep&&mine===ticket&&session){ try{ await api('/push/unsubscribe',{endpoint:ep}); }catch(e){} }
    if(devBusy===mine) devBusy=-1;
    if(mine!==ticket) return;
    if(failed) devNote=tw('push.offFail');
    drawDevice(); drawOrder();
  }

  /* the statements a customer has: the first opens, the rest are at the foot */
  function show(b){
    bundle=b;
    gate.hidden=true; if(roster) roster.hidden=true;
    barw.hidden=false; tabs.hidden=false;
    /* S7 7.1: whose account this is, in the header and at the foot of the rail; on his read-only view the bar says it */
    [].forEach.call(tabs.querySelectorAll('[data-whoas]'),function(x){ setW(x,'who.as',{u:'<span class="mono" data-who>'+esch(user)+'</span>'}); });
    [].forEach.call(tabs.querySelectorAll('[data-wholine]'),function(x){ x.hidden=view; });
    /* v706: Rewards (the card, until S7) is an associate's alone, and nobody else is shown the place at all. It waited on
       a sealed card as well, so an associate the publish had not yet written one for had no way to
       their links (v709 gates those on the mark, not the card); since 24 Sep 2026 the mark alone opens
       it, and a panel with no card says when it comes and still carries the links. */
    placeHide('card',!assoc);
    drawRewards(pCard);
    var lv=b.statements.filter(function(s){ return s.live; })[0];
    payDue=lv&&lv.pay&&lv.pay.now?lv.pay:null; liveAt=lv&&lv.at||'';
    setHold();
    pickStmt(0);
    drawAccount(pStmt);
    drawHome();
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
  /* ---- REWARDS (S8 8.1, the plan's section 4, his "all recommended" of 24 Sep 2026) ---------------------------------
     An associate's place OPENS ON THEIR LINKS, then the reward in units with its bar, then the card by month.
     drawRewards(el) is what a place calls: it draws into el from then on; drawCard redraws wherever that is. */
  var rewardsEl=pCard;
  /* an associate's alone: a place built before anybody signs in reads nothing (the links read needs a session) */
  function drawRewards(el){ if(el) rewardsEl=el; if(assoc) drawCard(); }
  function drawCard(){
    var box=rewardsEl;
    box.textContent='';
    drawMyLinks(box);
    if(!card||!card.products||!card.products.length){ box.appendChild(el('p','lead',tw('rew.later'))); return; }
    box.appendChild(el('h2',null,tw('rew.h')));
    box.appendChild(el('p','lead',tw('rew.lead')));
    card.products.forEach(function(p){
      var pane=el('div','pane');
      var h3=el('h3','pmark'); h3.setAttribute('aria-label',pshape(p.product)); h3.appendChild(psym(p.product,28));
      pane.appendChild(h3);
      /* THE REWARD IN UNITS, AND A BAR TO THE NEXT, first in the pane. No ringgit of margin anywhere near it. The bar is
         the system's Meter, its fill set from this nonce'd script, which the page's style policy allows. */
      if(p.reward){
        var rw=p.reward;
        /* S8 8.3: and how to take it, which the line never said; only where there is some to take. S13: a sentence a case */
        pane.appendChild(el('p','sub2',tw('rew.'+(rw.held?'held':rw.left>0?'ask':'none')+(rw.earned!==rw.left?'P':''),
          {left:Uq(rw.left,p.unit), earned:Uq(rw.earned,p.unit), taken:Uq(rw.taken,p.unit)})));
        if(rw.next!=null){
          var pc=Math.round(rw.next*100), mtr=el('div','salt-meter rmeter'), ln=el('div','salt-meter__line');
          ln.appendChild(el('span',null,tw('rew.next'))); ln.appendChild(el('b',null,pc+'%'));
          var tr=el('div','salt-meter__track'), fill=el('div','salt-meter__fill');
          mtr.style.setProperty('--salt-fill',String(pc));
          tr.appendChild(fill); mtr.appendChild(ln); mtr.appendChild(tr);
          tr.setAttribute('role','img'); tr.setAttribute('aria-label',tw('rew.nextAria',{p:pc}));
          pane.appendChild(mtr);
        }
      }
      var sm=p.summary||{};
      var ul=el('ul','conf');
      [[tw('rew.bought'),rm(sm.bought||0)],
       [tw('rew.sold'),rm(sm.soldFor||0)],
       [tw('rew.onward'),String(sm.onward||0)],
       [tw('rew.brought'),rm(sm.introduced||0)],
       [tw('rew.people'),String(sm.referred||0)]].forEach(function(r){
        var li=el('li'); li.appendChild(el('span','k',r[0])); li.appendChild(el('span','v',r[1])); ul.appendChild(li);
      });
      pane.appendChild(ul);
      /* the lines, with their own month strip */
      var months=cardMonths(p), pick=cardMonth==null?(months[0]||''):cardMonth;
      if(months.length>1){
        var strip=el('div','mos mfil');
        months.concat(['']).forEach(function(m){
          var b=el('button',(m===pick?'on':'')); b.type='button';
          b.textContent=m?monthLabel(m):tw('acct.allPill');
          b.addEventListener('click',function(){ cardMonth=m; drawCard(); });
          strip.appendChild(b);
        });
        pane.appendChild(strip);
      }
      var shown=(p.lines||[]).filter(function(l){ return !pick||(l.date||'').slice(0,7)===pick; });
      if(!shown.length) pane.appendChild(el('p','sub2',tw('rew.noMonth')));
      else {
        var t=el('table'), th=el('thead'), tr=el('tr');
        [[tw('rew.date'),'l'],[tw('rew.what'),'l'],[tw('sh.size'),''],['RM','']].forEach(function(c){ tr.appendChild(el('th',c[1]||null,c[0])); });
        th.appendChild(tr); t.appendChild(th);
        var tb=el('tbody');
        shown.forEach(function(l){
          var row=el('tr');
          row.appendChild(el('td','l',l.date||''));
          row.appendChild(el('td','l',tw(l.kind==='own'?'rew.bought':'rew.through')));
          row.appendChild(el('td',null,unitsOf(l.qty,p.unit)));
          row.appendChild(el('td',null,rm(l.rm)));
          tb.appendChild(row);
        });
        t.appendChild(tb); pane.appendChild(t);
      }
      box.appendChild(pane);
    });
  }

  /* ---- THEIR OWN REFERRAL LINKS (v709, his instruction of 18 Sep 2026) -------------------------
     "If they want to refer to a customer, they will be able to mint their own link, just like how
     I'd choose a customer and generate the link. It will need to be approved by me."
     IT LIVES HERE, in the script every page carries, gated at runtime on the associate mark: the
     owner's script is spliced only on his route and must never travel to a customer, and the
     landing page is served before anybody signs in, so there is nothing to splice per viewer.
     A LEVEL IS NEVER NAMED. What the link quotes is his to set; they are told it is open and no
     more, because the level is never named on a customer's page.
     S8 8.1: EACH LINK SAYS ITS STATE IN A WORD (Waiting, Open, Not approved, Withdrawn), what it has done, and on an
     open one Share and the QR. SHARE IS MINTED BEFORE THE TAP: the address came with the list, so the tap hands it to
     the phone's share sheet as its first act, with no fetch in between (the judges' must-not-ship list); where the
     browser has no share sheet it is Copy link. Make a link says what happens next before it is tapped. */
  /* the box keeps its own note (24 Sep 2026): it drew the order form's, so "Placed..." appeared under
     Your links, and a link that was not made said so under the order form as well */
  var myLinks=null, myMax=0, myNote='';
  var LINK_STATE={open:['lnk.open','verdigris'], waiting:['lnk.waiting','steel salt-status--dashed'], declined:['lnk.declined','mist'], withdrawn:['lnk.withdrawn','mist']};
  var qrShown={};
  function linkDay(iso,L){ try{ var p=klBits(iso); return day3(L)[new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()]+' '+(+p.day)+' '+mon3(L)[+p.month-1]; }catch(e){ return ''; } }
  function linkLine(r){
    if(r.state==='waiting') return tw('lnk.lineWaiting');
    if(r.state==='declined') return tw('lnk.lineDeclined');
    if(r.state==='withdrawn') return tw('lnk.lineWithdrawn');
    return r.opens?tw('lnk.opened'+(r.opens===1?'1':'N')+(r.last?'Last':''),{n:r.opens, d:Dd(linkDay,r.last)}):tw('lnk.notOpened');
  }
  function drawMyLinks(into){
    var box=el('div','pane rlinks');
    var head=el('div','rlhead'); head.appendChild(el('h3',null,tw('lnk.h')));
    var live=(myLinks||[]).filter(function(r){ return r.state!=='withdrawn'; }).length;
    if(myLinks&&myMax) head.appendChild(el('span','rlcount',tw('lnk.count',{n:live, m:myMax})));
    box.appendChild(head);
    if(myLinks===null){ box.appendChild(el('p','sub2',tw('lnk.reading'))); into.appendChild(box); if(!view) loadMyLinks(); return; }
    if(!myLinks.length) box.appendChild(el('p','sub2',tw('lnk.none')));
    myLinks.forEach(function(r){
      var row=el('div','glink');
      var top=el('div','gtop'), st=LINK_STATE[r.state]||LINK_STATE.open;
      top.appendChild(el('p','gh',r.made?tw('lnk.made',{d:Dd(oDay,r.made)}):tw('lnk.yours')));
      /* D13 (24 Sep 2026): a declined link is its own state, never "waiting" */
      top.appendChild(el('span','gstate salt-status salt-status--'+st[1],tw(st[0])));
      row.appendChild(top);
      row.appendChild(el('p','gs',linkLine(r)));
      if(r.state==='open'){
        row.appendChild(el('code','gu',r.url));
        var img=document.createElement('img');
        img.src=r.qr; img.alt=tw('lnk.qrAlt'); img.width=160; img.height=160;
        img.hidden=!qrShown[r.id]; row.appendChild(img);
      }
      var acts=el('div','racts'), said=el('p','msg'); said.setAttribute('role','status');
      if(r.state==='open'){
        if(navigator.share){
          var sh=el('button','salt-ghost',tw('lnk.share')); sh.type='button';
          sh.addEventListener('click', function(){
            /* the tap's first act: the address is already here, so nothing waits between the tap and the sheet */
            var done; try{ done=navigator.share({url:r.url}); }catch(e){ done=Promise.reject(e); }
            Promise.resolve(done).then(function(){ said.textContent=''; },
              function(e){ said.textContent=e&&e.name==='AbortError'?'':tw('lnk.notShared'); });
          });
          acts.appendChild(sh);
        } else {
          var cp=el('button','salt-ghost',tw('lnk.copy')); cp.type='button';
          /* awaited (24 Sep 2026): writeText answers with a promise, so a refusal said Copied */
          cp.addEventListener('click', async function(){
            try{ await navigator.clipboard.writeText(r.url); cp.textContent=tw('lnk.copied'); }catch(e){ cp.textContent=tw('lnk.copyFail'); }
            setTimeout(function(){ cp.textContent=tw('lnk.copy'); },1500);
          });
          acts.appendChild(cp);
        }
        var qb=el('button','salt-ghost',tw(qrShown[r.id]?'lnk.qrHide':'lnk.qrShow')); qb.type='button';
        qb.setAttribute('aria-expanded',qrShown[r.id]?'true':'false');
        qb.addEventListener('click', function(){ qrShown[r.id]=!qrShown[r.id]; img.hidden=!qrShown[r.id];
          qb.textContent=tw(qrShown[r.id]?'lnk.qrHide':'lnk.qrShow'); qb.setAttribute('aria-expanded',qrShown[r.id]?'true':'false'); });
        acts.appendChild(qb);
      }
      if(r.state!=='withdrawn'&&!view){
        var wd=el('button','salt-ghost',tw('lnk.withdraw')); wd.type='button';
        wd.addEventListener('click', async function(){
          if(!confirm(tw('lnk.withdrawAsk'))) return;
          var mine=ticket; var rv=await api('/my/refs/'+encodeURIComponent(r.id)+'/revoke',{});
          if(mine!==ticket) return; if(rv.status===0) myNote=wErrE(rv.body,'x.notSent'); await loadMyLinks();
        });
        acts.appendChild(wd);
      }
      if(acts.firstChild) row.appendChild(acts);
      if(r.state==='open') row.appendChild(said);
      box.appendChild(row);
    });
    if(view){ /* his read-only view makes nothing */ }
    else if(live>=myMax) box.appendChild(el('p','sub2',tw('lnk.max',{n:live})));
    else {
      box.appendChild(el('p','sub2 rlnext',tw('lnk.next')));
      var mk=el('button','btn salt-pill salt-pill--md',tw('lnk.make')); mk.type='button';
      mk.addEventListener('click', async function(){
        mk.disabled=true; var mine=ticket;
        var r=await api('/my/refs',{});
        if(mine!==ticket) return;
        myNote=r.body.ok?'':wErrE(r.body,'lnk.notMade');
        await loadMyLinks();
      });
      box.appendChild(mk);
    }
    if(myNote) box.appendChild(el('p','msg',myNote));
    into.appendChild(box);
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
     holds. The hour is theirs, off their own device; the month is the one their first order falls in.
     S7 7.1: the greeting is Home's heading now, and the month stays on Prices. */
  /* S13: the greeting's key */
  function hail(){
    var h=new Date().getHours();
    return h<12?'home.morning':(h<18?'home.afternoon':'home.evening');
  }
  /* S4 4.8: a moment as the Prices stamp says it, "Thu 24 Sep, 11:59", in Kuala Lumpur; the weekday from the date's own parts */
  function pricesAt(iso,L){
    try{ var p=klBits(iso); return day3(L)[new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()]+' '+(+p.day)+' '+mon3(L)[+p.month-1]+', '+p.hour+':'+p.minute; }
    catch(e){ return ''; }
  }
  function monthOf(d,L){
    var m=/^(\\d{4})-(\\d{2})/.exec(String(d||'')); if(!m) return '';
    return monthsIn(L)[+m[2]-1]+' '+m[1];
  }
  function drawPrices(){
    pPrices.textContent='';
    var soon=((prices&&prices.soon)||[]).concat(((prices&&prices.products)||[]).filter(function(x){ return !(x.sizes&&x.sizes.length); }));
    if(!prices||((!prices.products||!prices.products.length)&&!soon.length)){
      pPrices.appendChild(el('p','lead',tw('pr.none')));
      return;
    }
    /* S4 4.8: THE STAMP SAYS WHEN THE LIST WAS WRITTEN, "Prices as at Thu 24 Sep, 11:59" in Kuala Lumpur, where "for the week
       of" stayed on an open page for good; a list sealed before it carried a time keeps its week. Every size is a tap. */
    var tapTo=!view&&!hold;
    pPrices.appendChild(el('p','lead',tw((prices.at&&pricesAt(prices.at)?'pr.asAt':'pr.week')+(tapTo?'Tap':''),
      {d:Dd(pricesAt,prices.at), w:prices.week&&prices.week.label||''})));
    pPrices.appendChild(el('p','lead',tw('pr.goods',{deliv:Wk('deliv')})));
    if(prices.since) pPrices.appendChild(el('p','sub2',tw('pr.since',{m:Dd(monthOf,prices.since)})));
    /* S7 7.2: the books stand in a grid, two across from 1080px */
    var grid=el('div','pgrid'); pPrices.appendChild(grid);
    sold().forEach(function(p){
      var pane=el('div','pane');
      var h3=el('h3','pmark'); h3.setAttribute('aria-label',pshape(p.product)); h3.appendChild(psym(p.product,28));
      /* S4 4.10, D11 (his "all recommended" of 24 Sep 2026): THE LEVEL LEAVES PRICES. v659 drew a symbol and a colour
         for it beside each product, never named; a customer now sees no level at all, in words or in a mark. The name
         still travels inside the sealed list, and nothing here reads it. */
      pane.appendChild(h3);
      pane.appendChild(el('p','sub2', p.basis==='board' ? tw('pr.board')
        : p.basis==='yours' ? tw(p.orders===1?'pr.rate1':'pr.rateN',{rm:rm(p.rate), u:p.unit||'unit', n:p.orders})
        : tw('pr.own')));
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
      pane.appendChild(L); grid.appendChild(pane);
    });
    /* his instruction of 15 Sep 2026: a product with no tier set is not priced, and says so */
    soon.forEach(function(p){
      var pane=el('div','pane');
      var sh=el('h3','pmark'); sh.setAttribute('aria-label',pshape(p.product)); sh.appendChild(psym(p.product,28)); pane.appendChild(sh);
      pane.appendChild(el('p','sub2',tw('pr.soon')));
      grid.appendChild(pane);
    });
  }

  /* ---- ORDER: the form, then every order and where it stands ---- */
  /* S1 1.4, 24 SEP 2026: A DROPPED REQUEST ANSWERS LIKE A REFUSAL, IN WORDS. It threw, so Place stayed
     busy and Send stayed grey for good; now every caller clears its busy state and shows this beside the
     control it came from. */
  /* 24 Sep 2026: what can be ordered is a product with a priced size. The list sends none without one now, and an
     older sealed list still can: its first size was read unguarded, and the throw blanked the whole tab. */
  function sold(){ return ((prices&&prices.products)||[]).filter(function(x){ return x.sizes&&x.sizes.length; }); }
  /* what the page says where nothing can be ordered: a list with nothing priced, or no list at all */
  function noOrderLine(){ return tw(prices&&(prices.soon&&prices.soon.length||prices.products&&prices.products.length)?'ord.opensSet':'ord.opensList'); }
  async function api(path, body, method){
    var send=function(){ return fetch(path,{method:method||(body?'POST':'GET'), cache:'no-store',
        headers:Object.assign({'X-Stmt-Session':session}, body?{'content-type':'application/json'}:{}),
        body:body?JSON.stringify(body):undefined}); };
    var r;
    try{ r=await send(); }catch(e){ return {status:0, body:{ok:false, said:'x.notSent', lost:true}}; }
    /* S3 3.5: a lapse reopens from the remembered phone and the request goes again, once */
    if(r.status===401&&session&&await reopen()){
      try{ r=await send(); }catch(e){ return {status:0, body:{ok:false, said:'x.notSent', lost:true}}; }
    }
    /* UX5, 24 Sep 2026: ONE LAPSE, ONE VOICE. The Sheet and the bar say it; beside the tapped control each
       caller says whatever the answer's error is, which is a pointer to them */
    if(r.status===401&&session){ lapsed(); return {status:401, body:keptMine()?{ok:false, said:'x.notSent', lost:true}:{ok:false, said:'lapse.notSent'}}; }
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
  var OMAX=__MAX_OPEN__, OPEN_ST=__OPEN_STATES__;
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
    if(back){ var b=el('button','salt-orb'); b.type='button'; b.setAttribute('aria-label',tw('sh.change')); b.setAttribute('data-k','back'); b.disabled=!!draft.busy;
      b.appendChild(oGlyph('back')); b.addEventListener('click',back); osh.head.appendChild(b); }
    if(title!=null){ var h=el('h2','salt-sheet__title',title); h.id='oshT'; osh.head.appendChild(h); }
    var x=el('button','salt-orb salt-sheet__close'); x.type='button'; x.setAttribute('aria-label',tw('x.close')); x.setAttribute('data-k','close'); x.disabled=!!draft.busy;
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
    if(assoc&&draft.forFriend==null) return tw('sh.whyFor');
    if(!quoteFor()) return tw('sh.whySize');
    if(draft.mode==='deliver'&&String(draft.place||'').trim().length<2) return tw('sh.whyWhere');
    return '';
  }
  function whereHint(){
    return tw(draft.placeWas&&String(draft.place||'').trim()===draft.placeWas?'sh.whereSame':'sh.where');
  }
  function drawForm(){
    sheetHead(tw('sh.new'));
    var S=sold(), P=S.filter(function(x){ return x.product===draft.product; })[0]||S[0], B=osh.body;
    /* a list that came back with nothing priced (a 409, then Change) leaves nothing to pick: the Order tab's own line */
    if(!P){ B.appendChild(el('p','lead',noOrderLine())); return; }
    draft.product=P.product;
    if(!P.sizes.some(function(x){ return String(x.q)===String(draft.q); })) draft.q=String(P.sizes[0].q);
    /* S4 4.7: AN ASSOCIATE IS ASKED WHO IT IS FOR, FIRST (v702's tick, which was the last field and easy to pass). Nothing is
       chosen for them: Review waits for the answer, and every order asks again. Nobody else is asked. */
    if(assoc) B.appendChild(oChoice(tw('sh.whoFor'),[['me',tw('sh.me')],['friend',tw('sh.friend')]],draft.forFriend==null?'':(draft.forFriend?'friend':'me'),'for',
      function(v){ draft.forFriend=(v==='friend'); sheetDraw(); }));
    /* v695: a product is a mark named by its shape; with one on the list the tiles say which by their legend */
    if(S.length>1) B.appendChild(oChoice('',S.map(function(x){ return [x.product,psym(x.product,24),pshape(x.product)]; }),draft.product,'prod',
      function(v){ draft.product=v; draft.q=null; var U=oUsual(); if(U&&U.product===v&&oSoldHas(v,U.q)) draft.q=String(U.q); sheetDraw(); }));
    var fs=el('fieldset','salt-options');
    if(S.length>1) fs.setAttribute('aria-label',tw('sh.size'));
    else { var lg=el('legend','salt-options__legend'); lg.appendChild(withMark(P.product,'',22)); fs.appendChild(lg); }
    var grid=el('div','salt-options__grid salt-options__grid--2'), U=oUsual();
    P.sizes.forEach(function(x){
      var lab=el('label','salt-option'), r=el('input','salt-option__input');
      r.type='radio'; r.name='osize'; r.value=String(x.q); r.checked=String(x.q)===String(draft.q); r.setAttribute('data-k','size:'+x.q);
      r.addEventListener('change',function(){ draft.q=String(x.q); sheetDraw(); });
      var face=el('span','salt-option__face'), tx=el('span','salt-option__text'), lb=el('span','salt-option__label',unitsOf(x.q,P.unit));
      if(U&&U.product===P.product&&String(U.q)===String(x.q)) lb.appendChild(el('span','salt-status salt-status--brass',tw('sh.usual')));
      tx.appendChild(lb); tx.appendChild(el('span','salt-option__figure',rm(x.price)));
      face.appendChild(tx); lab.appendChild(r); lab.appendChild(face); grid.appendChild(lab);
    });
    fs.appendChild(grid); B.appendChild(fs);
    B.appendChild(oChoice(tw('sh.reach'),[['collect',tw('sh.collect')],['deliver',tw('sh.deliver')]],draft.mode,'mode',
      function(v){ draft.mode=v; sheetDraw(); }));
    /* v694: a delivery says roughly where it is going, in his words a general location; never an address */
    if(draft.mode==='deliver'){
      var wf=el('div','salt-field'), wl=el('label','salt-field__label',tw('sh.whereTo')); wl.htmlFor='oWhere';
      var wi=el('input','salt-field__input'); wi.id='oWhere'; wi.type='text'; wi.maxLength=60; wi.value=draft.place||''; wi.autocomplete='off';
      wi.placeholder=tw('sh.wherePh'); wi.setAttribute('data-k','where');
      var wh=el('span','salt-field__hint',whereHint());
      wi.addEventListener('input',function(){ draft.place=wi.value; wh.textContent=whereHint(); formFoot(); });
      wf.appendChild(wl); wf.appendChild(wi); wf.appendChild(wh); B.appendChild(wf);
    }
    /* v751: a line with it, never required; it opens the order's thread. Folded until it is wanted */
    if(draft.noteOpen||String(draft.say||'').trim()){
      var nf=el('div','salt-field'), nl=el('label','salt-field__label',tw('sh.note')); nl.htmlFor='oSay';
      var ni=el('input','salt-field__input'); ni.id='oSay'; ni.type='text'; ni.maxLength=140; ni.value=draft.say||''; ni.autocomplete='off';
      ni.placeholder=tw('sh.notePh'); ni.setAttribute('data-k','say');
      ni.addEventListener('input',function(){ draft.say=ni.value; });
      nf.appendChild(nl); nf.appendChild(ni); B.appendChild(nf);
    } else {
      var an=el('button','salt-ghost ofull',tw('sh.addNote')); an.type='button'; an.id='oAddNote'; an.setAttribute('data-k','addnote');
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
    t.appendChild(el('span','sub2',why||tw(draft.mode==='deliver'?'sh.plusDeliv':'sh.toCollect')));
    F.appendChild(t);
    var go=el('button','salt-pill salt-pill--md',tw('sh.review')); go.type='button'; go.id='oGo'; go.disabled=!!why; go.setAttribute('data-k','review');
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
    else draft.snote=twE('sh.stillAt',{rm:rm(c.total)});
    c.was=Math.abs(c.total-c.shown)>0.004?c.shown:null;
  }
  /* S4 4.6: FIVE OPEN ORDERS ARE SAID BEFORE THE FORM, not after it. The Worker refuses a sixth (MAX_OPEN in
     stmt/orders.js, carried here), and the refusal used to come after the form was filled and checked. With five open the
     sheet opens on the limit instead, naming the open orders, each with Cancel where the goods have not moved, and moves on
     to the form of its own accord once one is cancelled or finishes. */
  function limitLine(n){ return tw('sh.limit',{n:n}); }
  function drawLimit(){
    sheetHead(tw('sh.new'));
    var B=osh.body, open=oLive();
    var say=el('p','salt-insight salt-insight--copper',limitLine(open.length)); say.setAttribute('role','status'); B.appendChild(say);
    var L=el('div','salt-ledger salt-ledger--plain');
    open.forEach(function(o){
      var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label');
      lab.appendChild(withMark(o.product,unitsOf(o.qty,oUnit(o))+' ',16));
      /* the order's own word, stage 5's (stateWord, over oWord), as its row under Your orders says it; goods handed over in
         part keep an order open at ready, so they read as the banner's part word, never Ready over "part of it is with you" */
      var mv=+o.moved||0, part=mv>0&&!movedAll(o), dl=o.mode==='deliver';
      lab.appendChild(document.createTextNode(', '+(part?tw(dl?'st.partDelivered':'st.partCollected'):stateWord(o))));
      l.appendChild(lab); l.appendChild(el('span','salt-ledger__value',rm(o.total+(+o.delivery||0)))); r.appendChild(l);
      if(!(+o.moved>0)){
        var row=el('div','olim'); row.appendChild(el('span','salt-ledger__flag',tw('sh.placed',{t:Dd(stamp,o.at)})));
        var cb=el('button','salt-ghost',tw('ord.cancel')); cb.type='button'; cb.setAttribute('data-k','cancel:'+o.id);
        cb.addEventListener('click',function(){ limitCancel(o); }); row.appendChild(cb); r.appendChild(row);
      } else r.appendChild(el('span','salt-ledger__flag',tw(!part?'sh.withYou'
        :(+o.paid||0)<(+o.total||0)+(+o.delivery||0)-0.004?'sh.partOwed':'sh.part')));
      if(draft.limTap&&draft.limTap.id===o.id) r.appendChild(statusLine(draft.limTap.t));
      L.appendChild(r);
    });
    B.appendChild(L);
  }
  async function limitCancel(o){
    var paid=+o.paid||0;
    if(!confirm(paid>0?tw('ord.cancelAskPaid',{rm:rm(paid)}):tw('ord.cancelAsk'))) return;
    var mine=ticket, r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{rid:ridFor(o.id+':cancel','')});
    if(mine!==ticket) return;
    if(r.body.ok) ridDone(o.id+':cancel');
    draft.limTap=r.body.ok?null:{id:o.id, t:wErrE(r.body,'ord.notCancelled')};
    await loadOrders(); if(mine!==ticket) return;
    drawOrder(); sheetDraw();
  }
  function toForm(){ draft.step='form'; draft.check=null; draft.snote=''; sheetDraw(); }
  function drawCheck(){
    var c=draft.check, B=osh.body;
    sheetHead(tw('sh.check'),toForm);
    var L=el('div','salt-ledger salt-ledger--plain');
    function row(k,v){ var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), val=el('span','salt-ledger__value');
      l.appendChild(el('span','salt-ledger__label',k)); if(typeof v==='string') val.textContent=v; else val.appendChild(v);
      l.appendChild(val); r.appendChild(l); L.appendChild(r); }
    if(assoc) row(tw('sh.for'),tw(c.forFriend?'sh.friend':'sh.me'));
    row(tw('rew.what'),withMark(c.product,unitsOf(c.q,c.unit)+' ',16));
    row(tw('sh.price'),rm(c.total));
    row(tw('sh.how'),c.mode==='deliver'?tw('sh.deliveredTo',{p:c.place}):tw('sh.youCollect'));
    if(c.mode==='deliver') row(tw('sh.delivery'),tw('sh.setOnConfirm'));
    if(c.say) row(tw('sh.note'),c.say);
    B.appendChild(L);
    /* S4 4.4: a list re-struck since it was opened is said here, before anything is placed, and Place names the new figure */
    if(c.was!=null){ var mv=el('p','salt-insight salt-insight--copper'); mv.setAttribute('role','status');
      setW(mv,'sh.moved',{now:esch(rm(c.total)), was:esch(rm(c.was))}); B.appendChild(mv); }
    if(c.gone){ var gn=el('p','salt-insight salt-insight--copper',tw('sh.gone'));
      gn.setAttribute('role','status'); B.appendChild(gn); }
    /* S4 4.9: a delivery is checked beside the one sentence that says how its charge is set */
    if(c.mode==='deliver') B.appendChild(el('p','salt-insight',tw('deliv')));
    var F=osh.foot;
    var bk=el('button','salt-ghost',tw('sh.change')); bk.type='button'; bk.id='oBack'; bk.disabled=!!draft.busy; bk.setAttribute('data-k','change');
    bk.addEventListener('click',toForm); F.appendChild(bk);
    var pl=el('button','salt-pill salt-pill--md',c.was!=null?tw('sh.placeAt',{rm:rm(c.total)}):tw('sh.place')); pl.type='button'; pl.id='oPlace';
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
    if(r.status===409&&(r.body.code==='pricesMoved'||r.body.error==='prices moved')){ await pricesMoved(r.body.prices); if(mine!==ticket) return; sheetDraw(); return; }
    if(!r.body.ok){
      draft.snote=wErrE(r.body,'sh.notPlaced');
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
    var h=el('h2','salt-sheet__title',tw('sh.sent')); h.id='oshT'; top.appendChild(h);
    top.appendChild(el('p',null,tw('sh.sentP')));
    B.appendChild(top);
    var can=('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
    var on=!!draft.pushed||(can&&Notification.permission==='granted'&&!!draft.pushDone);
    if(on){ if(draft.buzzAsked) B.appendChild(statusLine(tw('sh.buzzOn'))); }
    else if(!draft.buzzNo&&!(can&&Notification.permission==='denied')){
      var bx=el('div','salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm obuzz');
      bx.appendChild(el('p','salt-eyebrow salt-eyebrow--brass',tw('sh.buzzQ')));
      if(!can) bx.appendChild(el('p',null,tw('sh.buzzNo')));
      else {
        bx.appendChild(el('p',null,tw('sh.buzzOnly')));
        var yes=el('button','salt-pill salt-pill--md',tw('sh.buzzYes')); yes.type='button'; yes.id='oBuzz'; yes.setAttribute('data-k','buzz');
        yes.disabled=!!draft.buzzBusy;
        yes.addEventListener('click',async function(){
          if(draft.buzzBusy) return;
          draft.buzzBusy=true; draft.buzzAsked=true; draft.pushNote=''; sheetDraw();
          await subscribePush(); draft.buzzBusy=false; sheetDraw();
        });
        var no=el('button','salt-ghost',tw('sh.buzzNot')); no.type='button'; no.setAttribute('data-k','nobuzz');
        no.addEventListener('click',function(){ draft.buzzNo=true; sheetDraw(); });
        bx.appendChild(yes); bx.appendChild(no);
        if(draft.pushNote) bx.appendChild(statusLine(noteSaid(draft.pushNote)));
      }
      B.appendChild(bx);
    }
    var see=el('button','salt-ghost ofull',tw('sh.see')); see.type='button'; see.id='oSee'; see.setAttribute('data-k','see');
    /* stage 5's own screen for it; an order the list has not brought back yet opens on the next draw that has it */
    see.addEventListener('click',function(){ var id=draft.sent; sheetClose(); placeShow('order');
      if(id&&oFind(id)) oOpen(id); else { wantOrder=id||''; drawOrder(); } });
    B.appendChild(see);
  }
  /* what the tab above the orders is drawn off: the Pay page, or New order and the limit in its place. A re-read of the
     account (a return to the page, a lapse reopened, S3 3.5) that changes it, or an order opening or closing across the
     limit, draws the tab again; otherwise the orders are patched (S5 5.5). The order sheet is never drawn by either:
     it lives at the root of the body, and only the limit step, which holds nothing typed, follows the orders */
  var drawnSig='';
  function formSig(){ return JSON.stringify([hold,odLeft(),view,assoc,prices,oLive().length>=OMAX]); }
  function drawOrder(){
    if(!docLive()) return;
    var sc=window.scrollY;
    drawnSig=formSig();
    /* 24 Sep 2026: a redraw (a poll, another order's tap) rebuilt the thread box empty and took the caret away
       mid-sentence; the line is kept per order in draft.says, and the box that had the caret gets it back */
    var fo=document.activeElement, keep=fo&&fo.getAttribute&&pOrder.contains(fo)?fo.getAttribute('data-say'):null,
        sel=keep?[fo.selectionStart,fo.selectionEnd]:null;
    pOrder.textContent='';
    /* S7-R3 of the review: all of this is the head of the list's column (oPlace puts it there), so on a desk the open
       order beside it starts at the top of the place, its money, Pay and messages in view */
    var top=el('div','otop'); top.id='oTop'; oTopEl=top;
    /* S7 7.1: the header names the place, Orders; over the line the page below it still says what it is */
    if(hold) top.appendChild(el('h2',null,tw('ord.due')));
    if(view) top.appendChild(el('p','lead',tw('ord.view')));
    if(hold){
      /* S6 6.7: what is past its term, each part with the day it fell due, and one Pay for it */
      var dueBox=el('div','pane'), od=payDue.overdue, left=odLeft();
      dueBox.appendChild(kpiTile('ember',tw('pay.overdue'),rm(left),odNote(od)));
      dueBox.appendChild(el('p','lead',tw('pay.hold',{rm:rm(left)})));
      if(od.parts.length>1){
        var L=el('div','salt-ledger salt-ledger--plain');
        od.parts.forEach(function(x){ L.appendChild(lrowN(partSpan(x),rm(x.rm),dueWords(x.due),'odue')); });
        dueBox.appendChild(L);
      }
      /* S6 6.4: one Pay, opening the pay sheet, where there were thirteen links naming the pay page */
      if(!view){
        var hp=el('button','btn salt-pill salt-pill--md',tw('pay.payRm',{rm:rm(left)})); hp.type='button';
        hp.addEventListener('click',function(){ openPay({kind:'acct', fig:left, label:'pay.overdue', note:function(){ return odNote(od); }}); });
        dueBox.appendChild(hp);
      }
      dueBox.appendChild(el('p','sub2',tw('ord.holdP')));
      var sv=el('button','btn quiet salt-ghost',tw('ord.seeStmt')); sv.type='button';
      sv.addEventListener('click',function(){ placeShow('stmt'); });
      dueBox.appendChild(sv);
      /* 24 Sep 2026: the note was drawn in the order form alone, which this page never shows */
      if(draft.note) dueBox.appendChild(statusLine(draft.note));
      top.appendChild(dueBox);
    } else if(view){
      /* no order form on his read-only view */
    } else if(!sold().length){
      top.appendChild(el('p','lead',noOrderLine()));
    } else {
      /* S4 4.3: the form is a sheet now, laid over the page from here */
      top.appendChild(el('p','lead',twE('ord.lead')));
      var full=oLive().length>=OMAX;
      if(full){ var lim=el('p','salt-insight salt-insight--copper',limitLine(oLive().length)); lim.id='oLimit'; top.appendChild(lim); }
      else {
        var nb=el('button','btn salt-pill salt-pill--md',twE('sh.new')); nb.type='button'; nb.id='oNew';
        nb.addEventListener('click',function(){ sheetOpen(null,null,nb); });
        top.appendChild(nb);
      }
      if(osh&&draft.step==='limit') sheetDraw();
    }
    /* notifications: a wake on the phone when the order moves, so the page need not stay open.
       Not on his read-only view: those are not his phones. */
    var np=el('div','pane'); np.id='oPush';
    np.appendChild(el('h3',null,twE('push.h')));
    var canPush=('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
    if(!canPush){
      np.appendChild(el('p','sub2',twE('push.no')));
    } else if(draft.pushed||Notification.permission==='granted'&&draft.pushDone){
      np.appendChild(el('p','sub2',twE('push.onAll')));
    } else {
      np.appendChild(el('p','sub2',twE('push.ask')));
      /* S7 7.2: nothing says phone on a computer */
      var nb=el('button','btn quiet salt-ghost',twE('push.notify')); nb.type='button';
      nb.addEventListener('click', subscribePush); np.appendChild(nb);
      if(draft.pushNote) np.appendChild(el('p','msg',inEn(noteSaid)(draft.pushNote)));
    }
    if(!view) top.appendChild(np);
    pOrder.appendChild(oPlace());
    if(keep){ var kbox=[].filter.call(pOrder.querySelectorAll('input[data-say]'),function(x){ return x.getAttribute('data-say')===keep; })[0];
      if(kbox){ try{ kbox.focus({preventScroll:true}); kbox.setSelectionRange(sel[0],sel[1]); }catch(e){} } }
    window.scrollTo(0,sc);
    drawHome();
    openWanted();
  }

  /* S5 5.3 (D11, his answer of 24 Sep 2026): WHERE AN ORDER IS, IN THE CUSTOMER'S WORDS. The record's states are the
     desk's; they read Sent, Confirmed, Ready to collect or to deliver, Collected or Delivered once the goods are all
     with them, Complete, Not taken, and Cancelled by you or by us, read off who cancelled it. Never Acknowledged,
     Withdrawn or handed over. The tone follows the word: steel and dashed while it waits on us, brass ready,
     verdigris confirmed or moved, mist closed. */
  function oWord(st,o,by){
    var d=o.mode==='deliver';
    var k={placed:'st.placed', acknowledged:'st.acknowledged', ready:d?'st.readyDeliver':'st.readyCollect', done:'st.done', declined:'st.declined',
      cancelled:by==='desk'?'st.cancelledUs':'st.cancelledYou'}[st];
    return k?tw(k):st;
  }
  /* S11 11.7: the event that ended an order, whose note is his reason for a decline or a cancellation of his */
  function endOf(o){ var h=(o.history||[]).filter(function(x){ return x&&x.status===o.status; }); return h.length?h[h.length-1]:null; }
  function stateWord(o){
    if(oPayable(o)&&movedAll(o)) return tw(o.mode==='deliver'?'st.delivered':'st.collected');
    var e=endOf(o);
    return oWord(o.status,o,e?e.by:'');
  }
  function stateChip(o,cls){
    var s=o.status, tone=s==='placed'?'steel salt-status--dashed':s==='ready'&&!movedAll(o)?'brass':(s==='acknowledged'||s==='done'||oPayable(o))?'verdigris':'mist';
    return el('span',(cls?cls+' ':'')+'salt-status salt-status--'+tone,stateWord(o));
  }
  /* what happened, a step a line, in the same words: the record's notes are the desk's shorthand */
  function histLine(x,o){
    /* S13: a sentence a line, with the way paid ("by ...") a sentence of its own where there is one */
    var n=String(x.note||''), m, by=x.method?'By':'', how={m:function(L){ return methodWord(x.method,x.account,L); }};
    if((m=/^paid ([0-9.]+)$/.exec(n))) return tw('hist.paid'+by,Object.assign({rm:rm(+m[1])},how));
    /* S6 6.5 (D7): what they said they sent is a claim until his answer, which is a line of its own */
    if((m=/^sent ([0-9.]+)$/.exec(n))) return tw('hist.sent'+by,Object.assign({rm:rm(+m[1])},how));
    if((m=/^received ([0-9.]+)$/.exec(n))) return tw('hist.received',{rm:rm(+m[1])});
    if((m=/^not found ([0-9.]+)$/.exec(n))) return tw('hist.notFound',{rm:rm(+m[1])});
    if((m=/^payment of ([0-9.]+) recorded$/.exec(n))) return tw('hist.recorded',{rm:rm(+m[1])});
    /* S11 11.8 and 11.9: cash he took at the handover, and a short order closed at what was handed over */
    if((m=/^paid ([0-9.]+) in cash$/.exec(n))) return tw('hist.cash',{rm:rm(+m[1])});
    if((m=/^closed at ([0-9.]+) unit of the ([0-9.]+) ordered$/.exec(n))) return tw('hist.closed',{a:Uq(+m[1],oUnit(o)), b:m[2]});
    if((m=/^([0-9.]+) unit (delivered|collected)$/.exec(n))) return tw('hist.'+m[2],{a:Uq(+m[1],oUnit(o))});
    if(x.method) return tw('hist.chose'+by,how);
    return n?tw('hist.withNote',{s:oWord(x.status,o,x.by), n:n}):oWord(x.status,o,x.by);
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
  /* S6 6.5: his Not found, each one a payments[] entry that keeps its answer */
  /* S6 fix: only while it is the newest word on what they sent and something is still owed: sent again since, or paid in
     full, it would tell them to pay again for money that has arrived */
  function oLost(o){ var ps=(o.payments||[]).filter(function(x){ return x&&x.claim; });
    return dueOf(o)>0.004?ps.filter(function(x){ return x.claim==='notfound'&&!ps.some(function(y){ return String(y.at)>String(x.answered||x.at); }); }):[]; }
  /* S6 fix: less what they sent against the account that reaches this order's row (nowOf) */
  function oToPay(o){ return Math.max(0,+(dueOf(o)-oClaimed(o)-oAcct(o)).toFixed(2)); }
  function oOwes(o){ return oPayable(o)&&oToPay(o)>0.004; }
  function oDay(iso,L){ try{ var p=klBits(iso); return p.day+' '+mon3(L)[+p.month-1]; }catch(e){ return ''; } }
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
  function seeIt(o){ if(view||!o||pOrder.hidden||draft.oAuto) return; var l=hisLast(o); if(!l) return; var s=seenGet(); if((s.o[o.id]||'')>=l) return; s.o[o.id]=l; seenPut(s); drawHome(); }
  function oNeeds(o){ return oOwes(o)||replyWaiting(o); }
  function oWhy(o){
    var b=[];
    if(oOwes(o)) b.push(tw('why.toPay',{rm:rm(oToPay(o))}));
    if(oClaimed(o)>0) b.push(tw('why.sent',{rm:rm(oClaimed(o))}));
    if(oPayable(o)&&oLost(o).length) b.push(tw('why.lost'));
    if(replyWaiting(o)) b.push(tw('why.reply'));
    if(!b.length&&o.status==='placed') b.push(tw('why.placed'));
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
    if(!orders.length){ box.appendChild(el('p','lead',tw('ord.noneYet'))); return box; }
    var B=oBuckets();
    function sec(t,list){ box.appendChild(el('h3','salt-eyebrow salt-eyebrow--copper olab',t)); list.forEach(function(o){ box.appendChild(oRow(o,shown)); }); }
    if(B.needs.length) sec(tw('x.needs'),B.needs);
    if(B.open.length) sec(tw('ord.open'),B.open);
    if(B.past.length){
      var eb=el('button','salt-ghost olater',tw(B.past.length===1?'ord.earlier1':'ord.earlierN',{n:B.past.length})); eb.type='button';
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
  function ymdDay(s,L){ var m=/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(s||'')); return m?m[3]+' '+mon3(L)[+m[2]-1]:''; }
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
    h.appendChild(el('p','sub2',tw('oh.'+(o.mode==='deliver'?(o.place?'deliverTo':'deliver'):'collect')+(o.forFriend?'F':''),
      {t:Dd(stamp,o.at), p:o.place||''})));
    return h;
  }
  /* GOODS ONLY: a declined or cancelled order has no track to show */
  function oSteps(o){
    var w=el('div');
    if(o.status==='declined'||o.status==='cancelled') return w;
    var names=[tw('st.placed'),tw('st.acknowledged'),tw('st.ready'),tw(o.mode==='deliver'?'st.delivered':'st.collected')];
    var cur=o.status==='done'?4:movedAll(o)?3:(o.status==='ready'||(+o.moved||0)>0)?2:o.status==='acknowledged'?1:0;
    var ol=el('ol','salt-steps'); ol.setAttribute('aria-label',tw('oh.steps'));
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
    /* S13: each a whole sentence from the table, its day in bold, his reason a slot */
    var w=el('div'), p=el('p','salt-insight'), d=o.mode==='deliver', mv=+o.moved||0, paid=+o.paid||0, s=o.status, e=endOf(o),
        why=e&&e.note?esch(e.note):'', back=tw(paid>0?'ow.refunded':'ow.nothingOwed',{rm:rm(paid)}),
        went=function(x){ return function(L){ return esch(x(L)||wordIn(L,'ow.dayWent')); }; }, sz=function(q){ return function(L){ return esch(unitsOf(q,oUnit(o),L)); }; };
    function put(k,sl){ p.appendChild(setW(el('span'),k,sl)); }
    if(s==='placed') put('ow.placed');
    else if(s==='done') put('ow.done');
    else if(s==='declined'){ put(why?'ow.declinedWhy':'ow.declined',{why:why}); p.appendChild(document.createTextNode(' '+back)); }
    else if(s==='cancelled'&&e&&e.by==='desk'){ put(why?'ow.cancelUsWhy':'ow.cancelUs',{why:why}); p.appendChild(document.createTextNode(' '+back)); }
    else if(s==='cancelled') put(paid>0?'ow.cancelledPaid':'ow.cancelled',{rm:rm(paid)});
    else if(movedAll(o)) put(d?'ow.deliveredOn':'ow.collectedOn',{d:went(function(L){ return ymdDay(o.movedOn,L); })});
    else if(mv>0) put(d?'ow.partDeliveredOn':'ow.partCollectedOn',{a:sz(mv), b:sz(o.qty), d:went(function(L){ return ymdDay(o.movedOn,L); })});
    else if(s==='ready') put(d?'ow.readyDeliver':'ow.readyCollect',{d:Dd(oDay,firstAt(o,'ready'))});
    else put('ow.confirmed',{d:Dd(oDay,firstAt(o,'acknowledged'))});
    if(o.closed&&o.closed.qty){ p.appendChild(document.createTextNode(' ')); put('ow.closed',{a:sz(o.qty), b:esch(o.closed.qty), rm:rm(o.total)}); }
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
  /* when what is still to pay may be paid, in one set of words for the order's screen and, inline, Home's Coming up, which
     said "when it arrives" of an order they collect (S7-R2 of the stage 7 review) */
  /* S13: which of six, the order's screen saying it as pw.<k> and Home's Coming up as hc.still<k> */
  function payWhenKey(o){
    var mv=+o.moved||0, ar=o.mode==='deliver'?'Arrives':'Collect';
    if(mv>0) return movedAll(o)?'WithYou':'Part';
    /* S6 6.8: cash chosen for the handover is paid then, never now */
    return (o.method==='cod'?'Cash':'Now')+ar;
  }
  function payWhen(o){ return tw('pw.'+payWhenKey(o)); }
  /* THE MONEY ON ITS OWN LINES: the goods, the delivery, what is paid, what they have sent and is waiting, and what
     is still to pay, with when it may be paid */
  function oMoney(o){
    var L=el('div','salt-ledger salt-ledger--plain'), paid=+o.paid||0, claimed=oClaimed(o), d=o.mode==='deliver', where=o.place?tw('om.to',{p:o.place}):'';
    /* S11 11.9: a short order closed at what was handed over is billed for that, and its Goods line says so */
    L.appendChild(lrow(tw('om.goods'),rm(o.total),o.closed&&o.closed.qty?tw('om.handed',{a:Uq(o.qty,oUnit(o)), b:o.closed.qty}):''));
    if(d) L.appendChild(o.status==='placed'?lrow(tw('sh.delivery'),'',o.place?tw('om.setToP',{p:o.place}):tw('om.set')):lrow(tw('sh.delivery'),rm(o.delivery||0),where));
    if(paid>0) L.appendChild(lrow(tw('om.paid'),rm(paid)));
    if(claimed>0) L.appendChild(lrow(tw('om.sentByYou'),rm(claimed),tw('om.waiting')));
    var ac=oPayable(o)?oAcct(o):0;
    if(ac>0.004) L.appendChild(lrow(tw('om.sentAcct'),rm(ac),tw(acctWaiting()>0.004?'om.waiting':'om.received')));
    /* S6 6.5: a payment he could not find, while the order is still to pay */
    if(oPayable(o)) oLost(o).forEach(function(x){ L.appendChild(lrow(tw('om.notFound'),rm(x.amount),tw('om.checkBank'),'odue')); });
    if(oPayable(o)){
      var tp=oToPay(o);
      L.appendChild(tp>0.004
        ?lrow(tw('pay.still'),rm(tp),payWhen(o),'odue')
        :lrow(tw('pay.still'),rm(0),tw(claimed>0||ac>0.004&&acctWaiting()>0.004?'om.sentWaiting':'om.paidFull')));
    }
    return L;
  }
  /* ONE NEXT ACTION. Pay opens the pay sheet for this order (S6 6.4). On a desk New order (S4 4.3; the form itself is a
     sheet over the page) stands above the open order, and while it does, Pay is the lit ghost: one filled control a
     screen. With the limit said in its place, or the Pay page, nothing else is filled and Pay is. On a phone the open
     order is the whole tab. */
  var oTopEl=null;   /* the head of the list's column, drawn by drawOrder and carried by oPlace into each list it draws */
  function oFormPill(){ return oWide()&&!!oTopEl&&!!oTopEl.querySelector('.salt-pill'); }
  function oAct(o){
    var a=el('div','oact'), tp=oTap(o);
    if(!view&&oOwes(o)){
      var pb=el('button',oFormPill()?'salt-ghost salt-ghost--lit':'salt-pill salt-pill--md',tw('pay.payRm',{rm:rm(oToPay(o))})); pb.type='button';
      pb.addEventListener('click',function(){ openPay(orderCtx(o.id)); });
      a.appendChild(pb);
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
    if(isNew) m.appendChild(el('span','salt-bubble__new',tw('msg.new')));
    if(state) m.appendChild(el('span','salt-bubble__state salt-bubble__state--'+state,tw({sending:'msg.sending',sent:'msg.sent',failed:'msg.failed'}[state])));
    b.appendChild(m);
    return b;
  }
  function oThread(o){
    var w=el('div','omsgs'), msgs=o.msgs||[], out=oLanded(o), n=msgs.length+out.length, since=(draft.oSince||{})[o.id];
    if(view&&!n) return el('div');
    var h=el('h3','salt-eyebrow salt-eyebrow--copper olab'); h.appendChild(el('span',null,tw('msg.h'))); if(n) h.appendChild(el('span',null,String(n)));
    var th=el('div','salt-thread'), ls=el('div','salt-thread__lines');
    ls.setAttribute('role','log'); ls.setAttribute('aria-label',tw('msg.aria'));
    msgs.forEach(function(m){
      var his=m.by==='desk';
      ls.appendChild(bubble(his?'theirs':'mine',m.text||'',tw(his?'msg.reply':'msg.you',{t:Dd(stamp,m.at)}),his?'':'sent',his&&!view&&typeof since==='string'&&String(m.at)>since));
    });
    out.forEach(function(x){
      var b=bubble('mine',x.t,tw('msg.you',{t:Dd(stamp,x.at)}),x.state,false);
      if(x.state==='failed'){
        if(x.why){ var y=el('p','salt-bubble__meta',x.why); y.setAttribute('role','status'); b.appendChild(y); }
        var r=el('button','salt-ghost salt-ghost--lit salt-bubble__retry',tw('msg.retry')); r.type='button';
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
    si.placeholder=tw('msg.ph'); si.setAttribute('aria-label',tw('msg.ph'));
    si.setAttribute('data-say',o.id); si.value=(draft.says||{})[o.id]||'';
    si.addEventListener('input',function(){ (draft.says=draft.says||{})[o.id]=si.value; });
    var sg=el('button','salt-ghost salt-ghost--lit salt-composer__send',tw('msg.send')); sg.type='submit';
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
    tapSaid({id:id},'say',why||tw('msg.notSent'));
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
      /* S13: a line the network lost says only to check the connection (the bubble says Not sent); a refusal is worded from its code */
      var why=r.body&&r.body.lost?tw('x.checkConn'):wErr(r.body,'msg.notSent');
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
    var sm=el('summary'); sm.appendChild(el('span','salt-plan__id',String(h.length))); sm.appendChild(el('span','salt-plan__title',tw('oh.hist')));
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
    if(+o.moved>0) f.appendChild(el('p','sub2',tw('of.moved')));
    /* S6 fix: not while what they sent waits on him, which a cancelled order would leave with nobody to answer it */
    else if(oClaimed(o)>0.004) f.appendChild(el('p','sub2',tw('of.checking',{rm:rm(oClaimed(o))})));
    else {
      var wb=el('button','salt-ghost salt-ghost--danger',tw('ord.cancel')); wb.type='button';
      wb.addEventListener('click', async function(){
        var cur=oFind(o.id)||o, paid=+cur.paid||0;
        if(!confirm(paid>0?tw('ord.cancelAskPaid',{rm:rm(paid)}):tw('ord.cancelAsk'))) return;
        var mine=ticket; var r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{rid:ridFor(o.id+':cancel','')});
        if(mine!==ticket) return;
        if(r.body.ok) ridDone(o.id+':cancel');
        tapSaid(o,'withdraw',r.body.ok?'':wErrE(r.body,'ord.notCancelled'));
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
    s.setAttribute('aria-label',twE('oh.aria',{a:Uq(o.qty,oUnit(o)), d:Dd(oDay,o.at)}));
    var back=el('button','salt-ghost salt-ghost--tight oback',twE('ord.yours')); back.type='button';
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
    var col=el('div','olistcol'); if(oTopEl) col.appendChild(oTopEl);
    col.appendChild(el('h2',null,twE('ord.yours'))); col.appendChild(oList(id));
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
  /* the order already open is brought into view and seen, and its row patched: drawn again, it would lose what is
     being typed in it. A banner's tap comes here too, on an order the desk opened by itself or one left open. */
  function oOpen(id){
    /* S7 7.1: from wherever it was tapped (a row on Home, a banner, Sent), the order opens in its place */
    if(tab!=='order') placeShow('order');
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
  /* ---- S6 6.2 (his D9 of 24 Sep 2026): TO PAY NOW, with its due date and Pay, and what is overdue beneath it, each
     part with its own day: on Home since S7 7.1, where it headed the statement tab, and what is coming up is Home's
     Coming up. The figures are the publish's, sealed with the statement (payDue) and read here, never worked out: the
     site prices nothing. A part is a mark and a size. */
  function ymdAt(s){ var m=/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(s||'')); return m?Date.UTC(+m[1],+m[2]-1,+m[3]):null; }
  function dayName(s,L){ var t=ymdAt(s); if(t==null) return ''; var d=new Date(t); return day3(L)[d.getUTCDay()]+' '+d.getUTCDate()+' '+mon3(L)[d.getUTCMonth()]; }
  function todayKL(){ var p=klBits(new Date().toISOString()); return p.year+'-'+('0'+p.month).slice(-2)+'-'+p.day; }
  function daysTo(s){ var t=ymdAt(s), n=ymdAt(todayKL()); return t==null||n==null?null:Math.round((t-n)/864e5); }
  /* "Due by Sat 26 Sep, in 2 days.", or of the first of several parts, "The first is due by ..." */
  function dueWords(due,first){
    var n=daysTo(due);
    if(n==null) return '';
    return tw('due.'+(first?'first':'')+(n<0?'Late':n===0?'Today':n===1?'Tomorrow':'InN'),{d:Dd(dayName,due), n:n});
  }
  function unitFor(pr){ var P=prices&&prices.products&&prices.products.filter(function(x){ return x.product===pr; })[0]; return P?P.unit:'unit'; }
  /* "The rest of [cube] 2.5 units you received Wed 16 Sep": the rest where part of the order is paid; a part not yet
     received says when it was ordered. A part to come is Coming up's own row (partRow, S7 polish) */
  /* S13: the mark as a slot, so the sentence round it is one of the table's; {mark} is the symbol with its shape's name */
  function markHtml(pr,px){ var w=el('span'); w.appendChild(psym(pr,px)); w.appendChild(el('span','sr',pshape(pr))); return w.innerHTML; }
  function partSpan(p){
    var k=(+p.whole>+p.rm+0.004?'part.rest':'part.')+(p.gotOn?'Got':p.date?'Ordered':'Bare')+(p.resale?'F':'');
    return setW(el('span'),k,{mark:markHtml(p.product,15), u:function(L){ return esch(unitsOf(p.qty,unitFor(p.product),L)); },
      d:function(L){ return dayName(p.gotOn||p.date,L); }});
  }
  function lrowN(node,value,flag,cls){ var r=lrow('',value,flag,cls); r.querySelector('.salt-ledger__label').appendChild(node); return r; }
  function kpiTile(tone,label,value,note){
    var k=el('div','salt-kpi salt-kpi--'+tone);
    k.appendChild(el('span','salt-kpi__label',label)); k.appendChild(el('span','salt-kpi__value',value));
    if(note){ var n=el('span','salt-kpi__note'); n.appendChild(note); k.appendChild(n); }
    return k;
  }
  /* S6 6.7: the overdue figure, the line, and whether a claim waiting on him has lifted it. The owner's view holds too. */
  function odRm(){ return payDue&&payDue.overdue?+payDue.overdue.rm||0:0; }
  /* S6 fix: WHAT IS STILL OVERDUE, less the money he has received since the statement was written that reaches it: a claim
     against the account, which the oldest parts, the overdue ones, take first, and an order's own claim on an overdue part
     (nowOf). His Received used to bring the hold back until the next publish, asking again for what he had just confirmed.
     A claim still waiting lifts the hold whatever its figure (his D9). */
  function odLeft(){ var od=odRm(); if(!(od>0.004)) return 0;
    var got=nowOf().filter(function(x){ return x.p.late; }).reduce(function(t,x){ return t+x.own+x.acct; },0);
    return Math.max(0,+(od-got).toFixed(2)); }
  /* S7 7.1: the places keep their names over the line; Home leads with what to pay, and Orders is the payment page */
  function setHold(){ hold=odLeft()>HOLD_RM+0.004&&!(sentWaiting()>0.004); }
  function odNote(od){
    var n=el('span'), ps=od.parts||[];
    if(ps.length===1){ n.appendChild(partSpan(ps[0])); n.appendChild(document.createTextNode('. '+dueWords(ps[0].due))); }
    else n.appendChild(document.createTextNode(tw('pay.odMany',{n:ps.length})+' '+dueWords(ps.length?ps[0].due:null,true)));
    return n;
  }
  /* what To pay now is for, in one line under its figure */
  function nowNote(now){
    var n=el('span'), ps=now.parts||[];
    if(ps.length===1){ n.appendChild(partSpan(ps[0])); n.appendChild(document.createTextNode('. '+dueWords(ps[0].due))); }
    else n.appendChild(document.createTextNode(tw('pay.nowMany',{n:ps.length})+' '+dueWords(now.due,true)));
    return n;
  }
  /* ---- S6 6.5 (his D7): A CLAIM IS NEVER PAID UNTIL HE SAYS SO. What they said they sent on To pay now (the account's
     claims) and on an order (claimed) reads "sent, waiting for us to confirm" until his Received or Not found, each
     shown when it comes. To pay now is the sealed figure; Pay asks only for what no claim waits on, and for nothing he
     has received since the statement was written, so money already sent is not asked for twice. */
  function sumOf(list){ return +list.reduce(function(n,c){ return n+(+c.amount||0); },0).toFixed(2); }
  function acctWaiting(){ return sumOf(claims.filter(function(c){ return c&&c.state==='waiting'; })); }
  function acctSince(){ return claims.filter(function(c){ return c&&c.state==='received'&&String(c.answered||'')>liveAt; }); }
  /* ---- S6 fix: THE SAME MONEY IS NEVER ASKED FOR TWICE, from To pay now and from an order. A part of To pay now is a row
     on the book as it stood at publish, and an order's row is one of them once its goods have gone: the part whose day is
     the one its key names (rowOn) and whose whole figure, goods and delivery, is the order's, on the friend's bucket or not.
     To pay now nets what was sent on such an order, waiting or received since the statement was written; the order nets
     what was sent against the account that reaches its row, walking the parts in the order they are sealed, oldest first,
     which is the order the desk's allocation takes them in (claimAlloc). ---- */
  function oSince(o){ return (o.payments||[]).filter(function(x){ return x&&x.claim==='received'&&String(x.answered||'')>liveAt; }); }
  function nowOf(){
    var out=((payDue&&payDue.now&&payDue.now.parts)||[]).map(function(p){ return {p:p, o:null, own:0, acct:0}; });
    orders.forEach(function(o){
      if(!o.rowOn||['cancelled','declined'].indexOf(o.status)>=0) return;
      var w=+((+o.total||0)+(+o.delivery||0)).toFixed(2);
      for(var i=0;i<out.length;i++){ var p=out[i].p;
        if(!out[i].o&&p.date===o.rowOn&&Math.abs((+p.whole||0)-w)<0.005&&!!p.resale===!!o.forFriend){
          out[i].o=o; out[i].own=Math.min(+p.rm||0,+(oClaimed(o)+sumOf(oSince(o))).toFixed(2)); break; } }
    });
    var left=+(acctWaiting()+sumOf(acctSince())).toFixed(2);
    out.forEach(function(x){ var t=+Math.max(0,Math.min(left,(+x.p.rm||0)-x.own)).toFixed(2); x.acct=t; left=+(left-t).toFixed(2); });
    return out;
  }
  function oAcct(o){ var x=nowOf().filter(function(y){ return y.o===o; })[0]; return x?x.acct:0; }
  function acctToPay(){ var n=payDue&&payDue.now; if(!n) return 0;
    var own=nowOf().reduce(function(t,x){ return t+x.own; },0);
    return Math.max(0,+(n.rm-acctWaiting()-sumOf(acctSince())-own).toFixed(2)); }
  function sentWaiting(){ return +(acctWaiting()+orders.reduce(function(n,o){ return n+(['cancelled','declined'].indexOf(o.status)>=0?0:oClaimed(o)); },0)).toFixed(2); }
  /* the lines under To pay now: what waits on him, and his answers since the statement was written, or in the last fortnight */
  function claimLines(){
    var out=[], sw=sentWaiting();
    if(sw>0.004) out.push(tw('cl.waiting',{rm:rm(sw)}));
    acctSince().forEach(function(c){ out.push(tw('cl.received',{rm:rm(c.amount), d:Dd(oDay,c.answered)})); });
    /* S6 fix: likewise only while nothing was sent since and To pay now still asks for something */
    claims.filter(function(c){ return c&&c.state==='notfound'&&Date.now()-Date.parse(c.answered||c.at)<14*864e5&&acctToPay()>0.004
      &&!claims.some(function(y){ return y&&String(y.at)>String(c.answered||c.at); }); })
      .forEach(function(c){ out.push(tw('cl.notFound',{rm:rm(c.amount), d:Dd(oDay,c.at)})); });
    return out;
  }
  /* S7 7.1: TO PAY NOW IS HOME'S FIRST ANSWER, so it answers even when it is nothing: a new account says there is nothing
     on it yet, and an account owing nothing now says so, with no Pay. Over the line (setHold) it says, in the payment
     page's own words, to pay the overdue amount first; the payment page itself is Orders'. Built afresh and put on the
     page only where it reads differently, so a poll never takes a tap's focus from its Pay. */
  function payHeadNode(){
    var box=el('div','payhead'); box.id='payHead';
    var P=payDue||{}, now=P.now||{rm:0,parts:[]}, od=P.overdue||{rm:0,parts:[]}, said=bundle?claimLines():[], fr=fresh();
    box.hidden=!bundle||!(fr||payDue||said.length);
    if(box.hidden) return box;
    if(now.rm>0.004){
      box.appendChild(kpiTile('ember',tw('pay.now'),rm(now.rm),nowNote(now)));
      if(hold) box.appendChild(el('p','salt-insight salt-insight--copper',tw('pay.hold',{rm:rm(odLeft())})));
      var left=acctToPay();
      if(!view&&left>0.004){
        /* S6 6.4: it opens the pay sheet on what is to pay now, the one road for Home's Pay */
        var pb=el('button','btn salt-pill salt-pill--md',tw('pay.payRm',{rm:rm(left)})); pb.type='button'; pb.id='payNow';
        pb.addEventListener('click',function(){ openPay(acctCtx()); });
        box.appendChild(pb);
      }
    }
    else if(fr) box.appendChild(kpiTile('verdigris',tw('pay.toPay'),rm(0),el('span',null,tw('acct.nothing'))));
    else if(payDue) box.appendChild(kpiTile('verdigris',tw('pay.now'),rm(0),el('span',null,tw('pay.nothing'))));
    said.forEach(function(t){ box.appendChild(statusLine(t)); });
    /* each overdue part with the day it fell due; one part says so in the line above */
    if(now.rm>0.004&&od.rm>0.004&&(now.parts||[]).length>1){
      box.appendChild(el('h3','salt-eyebrow salt-eyebrow--copper olab',tw('pay.overdue')));
      var L=el('div','salt-ledger salt-ledger--plain');
      od.parts.forEach(function(p){ L.appendChild(lrowN(partSpan(p),rm(p.rm),dueWords(p.due),'odue')); });
      box.appendChild(L);
    }
    return box;
  }
  function drawPayHead(){ if(!docLive()) return; var was=document.getElementById('payHead'), n=payHeadNode(); if(was&&was.outerHTML!==n.outerHTML) was.replaceWith(n); }
  /* S6 6.2: WHAT IS COMING UP BEYOND THE ORDERS. Home's Coming up lists the site's orders agreed and not handed over; a
     part the publish sealed that no order of theirs accounts for (a row he entered on the desk) stands under them, with
     its due day and never a Pay. An order is its part when the part is on the day its row is (rowOn), of its mark and
     size, and on the friend's bucket or not. */
  function comingParts(){
    var used={};
    return ((payDue&&payDue.coming&&payDue.coming.parts)||[]).filter(function(p){
      var o=orders.filter(function(x){ return !used[x.id]&&x.rowOn&&x.rowOn===p.date&&['cancelled','declined'].indexOf(x.status)<0
        &&(x.product||'salt')===(p.product||'salt')&&Math.abs((+x.qty||0)-(+p.qty||0))<1e-9&&!!x.forFriend===!!p.resale; })[0];
      if(o){ used[o.id]=1; return false; }
      return true;
    });
  }

  /* the rails' own names, never translated; cash is words, the table's */
  var METHOD_WORDS={transfer:'DuitNow Transfer', qr:'DuitNow QR', jompay:'JomPAY', tngbiz:"Touch 'n Go Business"};
  function acct(key){ return PAY.filter(function(a){return a.key===key;})[0]; }
  function methodWord(m,a,L){ var x=acct(a), w=m==='cod'?wordIn(L||LANG,'pay.cod'):(METHOD_WORDS[m]||m);
    return x&&m!=='tngbiz'?fill(wordIn(L||LANG,'pay.mTo'),{m:w, a:x.name}):w; }
  /* ---- S6 6.4: THE PAY SHEET (his D8 as he amended it, 24 Sep 2026) ------------------------------------------------
     Every Pay opens it: To pay now's, an order's, the held page's. The figure and what it is for, All or Part of it,
     then the two ways, Transfer or Scan a code, as the system's Option tiles. NO ACCOUNT IS CHOSEN FOR THEM: they
     choose which of his accounts to pay into, from the accounts payHref will link, so a suspended one is never
     offered. Their username is the reference, with Copy. Show the account number, or Show the code, opens the pay page
     through payHref at that account, rail and figure; the Counter never carries a number and never names that page.
     The figure is fixed as the sheet opens, so a poll landing while they pay cannot move it. */
  var paySh=document.getElementById('paySheet'), payScr=document.getElementById('payScrim'), PS=null;
  var GL=__GLYPH__;
  function glyph(name,px){ var s=psym('_',px); s.setAttribute('class','psym glyph'); s.firstChild.setAttribute('d',GL[name]); return s; }
  /*__PAYHREF__*/
  function payInto(rail,amt){ return PAY.filter(function(a){ return !!payHref(a.key,rail,amt,user); }); }
  /* label: a key, worded as the sheet draws */
  function acctCtx(){ var n=payDue&&payDue.now; return {kind:'acct', fig:acctToPay(), label:'pay.now', note:function(){ return nowNote(n); }}; }
  function orderCtx(id){
    var o=oFind(id);
    return {kind:'order', id:id, fig:o?oToPay(o):0, label:'pay.still', note:function(){
      return setW(el('span'),movedAll(o)?'pn.orderedWithYou':'pn.ordered',{mark:markHtml(o.product,15),
        u:function(L){ return esch(unitsOf(o.qty,oUnit(o),L)); }, d:Dd(oDay,o.at)}); }};
  }
  function openPay(ctx){
    if(!paySh||view||!(ctx.fig>0.004)) return;
    /* S6 fix: Transfer is the way chosen as it opens, as the mockup draws it; the way is not the account, and no account is */
    PS={ctx:ctx, part:false, amt:'', rail:'transfer', acct:'', said:'', step:'pay', away:null, busy:false};
    payScr.hidden=false; paySh.hidden=false; drawPay();
    try{ paySh.focus(); }catch(e){}
  }
  function closePay(){ if(!paySh||paySh.hidden) return; paySh.hidden=true; payScr.hidden=true; PS=null; payqDrop(); }
  if(paySh){
    document.getElementById('payX').addEventListener('click',closePay);
    payScr.addEventListener('click',closePay);
    document.addEventListener('keydown',function(ev){ if(ev.key==='Escape') closePay(); });
  }
  /* the figure being paid: all of it, or the part typed, never above all of it */
  function payAmt(){ if(!PS.part) return PS.ctx.fig; var v=parseFloat(PS.amt); return v>0&&v<=PS.ctx.fig+0.004?+v.toFixed(2):0; }
  function payTitle(){ document.getElementById('payT').textContent=tw('pay.payRm',{rm:rm(payAmt()||PS.ctx.fig)}); }
  var HOW=[{v:'transfer', label:'pay.transfer', g:'bank'}, {v:'qr', label:'pay.scan', g:'qr', detail:'pay.scanDetail'}];
  /* ---- S6 6.8: CASH WHEN IT ARRIVES, OFFERED ONLY WHERE THE RULE ALLOWS, AND SAYING WHY WHEN NOT. A third way on an
     order's sheet, never on To pay now's, whose goods they already have. Withheld while goods they hold are unpaid, this
     order's own included (v694): the tile stays, dashed, with the reason in place of its line. Choosing it tells him how
     they will pay; the cash itself is his to record when he takes it, so the customer never declares it. */
  function cashWay(){
    var o=oFind(PS.ctx.id), d=o&&o.mode==='deliver', no=heldUnpaid();
    return {v:'cod', label:d?'pay.cashArrives':'pay.cashCollect', g:'cash', off:no,
      detail:no?'pay.cashOff':'pay.cashOn'};
  }
  function cashWord(){ var o=oFind(PS.ctx.id); return tw(o&&o.mode==='deliver'?'pay.cashGoArrives':'pay.cashGoCollect'); }
  async function cashSend(){
    if(!PS||PS.busy) return;
    var ps=PS, id=ps.ctx.id, mine=ticket;
    ps.busy=true; ps.said=''; drawPayFoot();
    var r=await api('/orders/'+encodeURIComponent(id)+'/method',{method:'cod', rid:ridFor(id+':method','cod')});
    if(mine!==ticket||PS!==ps) return;
    ps.busy=false;
    if(!(r.body&&r.body.ok)){ ps.said=wErr(r.body,'pay.notChosen'); drawPayFoot(); return; }
    ridDone(id+':method'); closePay();
    var o=oFind(id); if(o) tapSaid(o,'pay',tw(o.mode==='deliver'?'pay.cashSaidArrives':'pay.cashSaidCollect'));
    await loadOrders(); if(mine!==ticket) return;
    setHold(); drawOrder(); drawPayHead();
  }
  function drawPay(){
    if(PS.step==='check'){ drawPayCheck(); return; }
    var body=document.getElementById('payBody'), c=PS.ctx;
    body.textContent=''; payTitle();
    body.appendChild(kpiTile('ember',tw(c.label),rm(c.fig),c.note()));
    var cash=PS.rail==='cod';
    var seg=el('div','payseg');
    [[false,tw('pay.all',{rm:rm(c.fig)})],[true,tw('pay.part')]].forEach(function(x){
      var b=el('button','salt-ghost',x[1]); b.type='button'; b.setAttribute('aria-pressed',PS.part===x[0]?'true':'false');
      b.addEventListener('click',function(){ PS.part=x[0]; drawPay(); var f=document.getElementById('payAmt'); if(f) try{ f.focus(); }catch(e){} });
      seg.appendChild(b);
    });
    if(!cash) body.appendChild(seg);
    if(PS.part&&!cash){
      var row=el('div','payamt'); row.appendChild(el('span','cur','RM'));
      var inp=el('input','fld salt-field__input salt-field__input--mono'); inp.id='payAmt'; inp.type='number'; inp.min='0'; inp.step='0.01'; inp.inputMode='decimal';
      inp.value=PS.amt; inp.setAttribute('aria-label',tw('pay.amtAria'));
      inp.addEventListener('input',function(){ PS.amt=inp.value; payTitle(); drawPayFoot(); });
      row.appendChild(inp); body.appendChild(row);
      body.appendChild(el('p','sub2',tw('pay.upTo',{rm:rm(c.fig)})));
    }
    var fs=el('fieldset','salt-options payhow'), g=el('div','salt-options__grid');
    fs.appendChild(el('legend','salt-options__legend',tw('pay.how')));
    HOW.concat(c.kind==='order'?[cashWay()]:[]).forEach(function(w){
      var lab=el('label','salt-option'), r=el('input','salt-option__input'), face=el('span','salt-option__face'),
          ld=el('span','salt-option__lead'), tx=el('span','salt-option__text'), a=w.v==='transfer'&&PS.rail==='transfer'&&acct(PS.acct);
      r.type='radio'; r.name='payHow'; r.value=w.v; r.checked=PS.rail===w.v; r.disabled=!!w.off;
      r.addEventListener('change',function(){ PS.rail=w.v; if(!payInto(w.v,payAmt()||c.fig).some(function(x){ return x.key===PS.acct; })) PS.acct=''; drawPay(); });
      ld.appendChild(glyph(w.g,22)); face.appendChild(ld);
      tx.appendChild(el('span','salt-option__label',tw(w.label)));
      tx.appendChild(el('span','salt-option__detail',w.detail?tw(w.detail):a?tw('pay.fromApp',{a:a.name}):tw('pay.fromAppAny')));
      face.appendChild(tx); lab.appendChild(r); lab.appendChild(face); g.appendChild(lab);
    });
    fs.appendChild(g); body.appendChild(fs);
    if(PS.rail&&!cash){
      /* S6 fix: his accounts as the system's Option tiles, one tap each where a select took two or three, and none chosen */
      var fi=el('fieldset','salt-options payinto'), gi=el('div','salt-options__grid salt-options__grid--2');
      fi.id='payInto'; fi.appendChild(el('legend','salt-options__legend',tw('pay.into')));
      payInto(PS.rail,payAmt()||c.fig).forEach(function(a){
        var lab=el('label','salt-option'), r=el('input','salt-option__input'), face=el('span','salt-option__face'), tx=el('span','salt-option__text');
        r.type='radio'; r.name='payInto'; r.value=a.key; r.checked=PS.acct===a.key;
        r.addEventListener('change',function(){ PS.acct=a.key; drawPay(); });
        tx.appendChild(el('span','salt-option__label',a.name)); face.appendChild(tx); lab.appendChild(r); lab.appendChild(face); gi.appendChild(lab);
      });
      fi.appendChild(gi); body.appendChild(fi);
    }
    var L=el('div','salt-ledger salt-ledger--plain payref'), rr=lrow(tw('pay.ref'),user,tw('pay.refHint')),
        cp=el('button','salt-ghost'); cp.type='button'; cp.setAttribute('aria-label',tw('pay.refCopy')); cp.appendChild(glyph('copy',18));
    var said=statusLine(PS.said); said.hidden=!PS.said;
    cp.addEventListener('click',async function(){
      var t; try{ await navigator.clipboard.writeText(user); t=tw('pay.copied'); }catch(e){ t=tw('pay.copyFail'); }
      if(!PS) return; PS.said=t; said.textContent=t; said.hidden=false;
    });
    rr.querySelector('.salt-ledger__value').appendChild(cp);
    L.appendChild(rr); if(!cash){ body.appendChild(L); body.appendChild(said); }
    drawPayFoot();
  }
  /* the one filled control, and above it what it opens or what is still to choose */
  function drawPayFoot(){
    var foot=document.getElementById('payFoot'), a=payAmt(), qr=PS.rail==='qr', word=tw(qr?'pay.showCode':'pay.showAcct'),
        href=PS.rail&&PS.acct&&a?payHref(PS.acct,PS.rail,a,user):'';
    foot.textContent='';
    if(PS.rail==='cod'){
      foot.appendChild(el('p','paycap',tw('pay.cashCap')));
      var cb=el('button','salt-pill salt-pill--md',cashWord()); cb.type='button'; cb.id='payGo'; cb.disabled=!!PS.busy;
      cb.addEventListener('click',cashSend); foot.appendChild(cb);
      if(PS.said){ var l=statusLine(PS.said); l.className+=' paysaid'; foot.appendChild(l); }
      return;
    }
    foot.appendChild(el('p','paycap',href?tw(qr?'pay.opensCode':'pay.opensAcct')
      :!a?tw('pay.sayHowMuch',{rm:rm(PS.ctx.fig)}):tw(!PS.rail?'pay.chooseHow':'pay.chooseAcct')));
    var go;
    if(href){ go=el('a','salt-pill salt-pill--md',word); go.href=href; go.target='_blank'; go.rel='noopener';
      go.addEventListener('click',function(){ PS.away={amt:a, rail:PS.rail, acct:PS.acct, gone:false}; payqPut(); }); }
    else { go=el('button','salt-pill salt-pill--md',word); go.type='button'; go.disabled=true; }
    go.id='payGo'; foot.appendChild(go);
  }
  /* ---- S6 6.5 (his D7): ON RETURN THE SHEET ASKS ONCE. Leaving for the pay page (the page hidden, or the window left)
     and coming back turns the sheet to one question, never a tap beside the account number: Not yet goes back and asks
     nothing more until the pay page is opened again; Yes records a CLAIM, which stays "sent, waiting" until he answers. */
  /* S6 fix: THE QUESTION OUTLIVES A RELOAD. A saved app is often reloaded or evicted while they are in their bank's app,
     and the question lived in memory alone, so they came back to Pay with nothing asked. What Show opened is kept on this
     device for two hours (the way, his account, the figure and the order it was for, with a short mark of the account,
     never the username), and the next open asks it, if something is still to pay there. Yes, Not yet and closing the
     sheet clear it; so does Log out. His read-only view keeps nothing. */
  var PAYQ='salt-stmt-payq';
  function payqWho(u){ var h=2166136261; for(var i=0;i<u.length;i++){ h^=u.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h.toString(36); }
  function payqPut(){ if(view||!PS||!PS.away) return;
    try{ localStorage.setItem(PAYQ,JSON.stringify({who:payqWho(user), at:Date.now(), kind:PS.ctx.kind, id:PS.ctx.id||null,
      away:{amt:PS.away.amt, rail:PS.away.rail, acct:PS.away.acct}})); }catch(e){ /* this visit only */ } }
  function payqDrop(){ try{ localStorage.removeItem(PAYQ); }catch(e){} }
  function payqBack(){
    if(view||PS||!paySh) return;
    var q=null; try{ q=JSON.parse(localStorage.getItem(PAYQ)||'null'); }catch(e){ q=null; }
    if(!q) return;
    var w=q.away||{}, ctx=q.kind==='order'?(oFind(q.id)?orderCtx(q.id):null):acctCtx();
    if(q.who!==payqWho(user)||!(Date.now()-q.at<2*3600e3)||!ctx||!(ctx.fig>0.004)||!(w.amt>0)||!acct(w.acct)){ payqDrop(); return; }
    PS={ctx:ctx, part:false, amt:'', rail:w.rail, acct:w.acct, said:'', step:'check', away:{amt:w.amt, rail:w.rail, acct:w.acct, gone:false}, busy:false};
    payScr.hidden=false; paySh.hidden=false; drawPay();
    try{ paySh.focus(); }catch(e){}
  }
  function payGone(){ if(PS&&PS.away) PS.away.gone=true; }
  function payBack(){ if(PS&&PS.away&&PS.away.gone&&PS.step==='pay'){ PS.step='check'; PS.said=''; drawPay(); } }
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden') payGone(); else payBack(); });
  window.addEventListener('blur',payGone); window.addEventListener('focus',payBack);
  function drawPayCheck(){
    var body=document.getElementById('payBody'), foot=document.getElementById('payFoot'), w=PS.away, a=acct(w.acct), qr=w.rail==='qr';
    body.textContent=''; foot.textContent='';
    document.getElementById('payT').textContent=tw('pay.payRm',{rm:rm(w.amt)});
    var box=el('div','paycheck'); box.appendChild(glyph(qr?'qr':'bank',30));
    box.appendChild(el('h3','salt-sheet__title',tw('pay.did',{rm:rm(w.amt)})));
    box.appendChild(el('p','sub2',tw(qr?'pay.byScan':'pay.byTransfer',{a:a.name, u:user})));
    body.appendChild(box);
    body.appendChild(setW(el('p','salt-insight'),'pay.tell'));
    var again=el('a','salt-ghost payagain',tw(qr?'pay.againCode':'pay.againAcct'));
    again.href=payHref(w.acct,w.rail,w.amt,user); again.target='_blank'; again.rel='noopener';
    again.addEventListener('click',function(){ if(PS&&PS.away) PS.away.gone=false; });
    body.appendChild(again);
    var no=el('button','salt-ghost',tw('pay.notYet')); no.type='button';
    no.addEventListener('click',function(){ PS.step='pay'; PS.away=null; PS.said=''; payqDrop(); drawPay(); });
    var yes=el('button','salt-pill salt-pill--md',tw('pay.yes',{rm:rm(w.amt)})); yes.type='button'; yes.id='paySent'; yes.disabled=!!PS.busy;
    yes.addEventListener('click',claimSend);
    foot.appendChild(no); foot.appendChild(yes);
    if(PS.said){ var l=statusLine(PS.said); l.className+=' paysaid'; foot.appendChild(l); }
  }
  /* the claim: on the order, or on the account for To pay now (rows he entered on the desk as well). The id stays with
     the figure, the way and the account it was minted for, so a retry is recorded once. Its answer is beside Yes. */
  async function claimSend(){
    if(!PS||PS.busy) return;
    var ps=PS, c=ps.ctx, w=ps.away, fig=w.amt.toFixed(2), key=(c.kind==='order'?c.id:'account')+':claim', mine=ticket;
    var body={amount:+fig, method:w.rail, account:w.acct, rid:ridFor(key,fig+' '+w.rail+' '+w.acct)};
    ps.busy=true; ps.said=''; drawPay();
    var r=await api(c.kind==='order'?'/orders/'+encodeURIComponent(c.id)+'/pay':'/account/claim', body);
    if(mine!==ticket||PS!==ps) return;
    ps.busy=false;
    if(!(r.body&&r.body.ok)){ ps.said=wErr(r.body,'pay.notRecorded'); drawPay(); return; }
    ridDone(key); closePay();
    if(c.kind==='order'){ var o=oFind(c.id); if(o) tapSaid(o,'pay',tw('pay.claimed')); }
    await loadOrders(); if(mine!==ticket) return;
    setHold(); drawOrder(); drawPayHead();
  }

  /* ==== S7 7.1 (his D11 of 24 Sep 2026): HOME, THE PLACE THAT OPENS FIRST ====================================
     Three questions: what do I owe, what needs me, and what do I order again. TO PAY NOW is stage 6's (drawPayHead):
     the sealed figure with its due date and the one filled Pay, which opens the pay sheet (over the line, the overdue
     amount first, in the words the payment page says);
     NEEDS YOU is an order with a reply not yet shown on this device, goods ready to collect, or goods all with them and
     not yet paid for, which the sealed figure takes in only at the next publish (S7-R6); COMING UP is an order
     agreed and not yet handed over, with what is still to pay, now or when it arrives, then any part the publish sealed
     that no order accounts for (comingParts). A new account says there is
     nothing on it yet, and Prices and ordering work from here. Each part is drawn afresh and put on the page only
     where it reads differently, so a poll moves nothing that has not changed. A row opens its order in Orders. */
  function drawHome(){
    if(!docLive()) return;
    var parts={hNeeds:homeNeeds(), hComing:homeComing(), hAgain:homeAgain()};
    Object.keys(parts).forEach(function(id){ var was=document.getElementById(id), n=parts[id]; n.id=id; if(was.outerHTML!==n.outerHTML) was.replaceWith(n); });
    drawPayHead();
    homeKeep();
    placeCounts();
    placeTitle();
  }
  /* THE KEEP CARD IS ONE ELEMENT, moved and never copied: it leads a new account's Home, a card of its own as the plan's
     first Home draws it (S7-R5 of the stage 7 review), and is otherwise This device's first row in Account (S9 fix), so a
     small phone's Home answers the three questions first. Moved only when that changes, so a poll never takes a tap's
     focus from it */
  var KEEP_CARD=['salt-glass-card','salt-glass-card--radius-md','salt-glass-card--pad-sm'];
  function homeKeep(){
    var k=keepCardEl, pay=document.getElementById('payHead'), rows=document.getElementById('devRows'); if(!k||!pay||!rows) return;
    var home=fresh();
    if(home){ if(k.nextElementSibling!==pay) pay.parentNode.insertBefore(k,pay); }
    else if(k.nextElementSibling!==rows) rows.parentNode.insertBefore(k,rows);
    KEEP_CARD.forEach(function(c){ k.classList.toggle(c,home); });
  }
  function hHead(t,n){ var h=el('h2','salt-eyebrow salt-eyebrow--copper hlab',t); if(n) h.appendChild(el('span','hn',String(n))); return h; }
  /* the Orders row, with Home's own sentence for why it is here */
  function homeRow(o,what){ var r=oRow(o,''), w=r.querySelector('.salt-inbox-row__what');
    if(!w){ w=el('span','salt-inbox-row__what'); r.querySelector('.salt-inbox-row__main').appendChild(w); }
    w.textContent=what; return r; }
  function toCollect(o){ return o.status==='ready'&&o.mode!=='deliver'&&!movedAll(o); }
  /* handed over in full and still owing: counted on Orders from the handover, so Home says it too (S7-R6 and S7R-4) */
  function withYouOwing(o){ return movedAll(o)&&oOwes(o); }
  function homeNeeds(){
    var box=el('div'), list=orders.filter(function(o){ return replyWaiting(o)||toCollect(o)||withYouOwing(o); });
    if(!list.length) return box;
    box.appendChild(hHead(tw('x.needs'),list.length));
    list.forEach(function(o){
      var m=(o.msgs||[]).filter(function(x){ return x.by==='desk'; }).pop(), t=m?String(m.text||''):'';
      box.appendChild(homeRow(o,replyWaiting(o)?tw('hn.reply',{t:t.length>120?t.slice(0,117)+'...':t})
        :withYouOwing(o)?tw('hn.owing',{rm:rm(oToPay(o))}):tw('hn.ready',{d:Dd(oDay,firstAt(o,'ready'))})));
    });
    return box;
  }
  function homeComing(){
    var box=el('div'), list=orders.filter(function(o){ return OPEN_ST.indexOf(o.status)>=0&&!movedAll(o)&&!replyWaiting(o)&&!toCollect(o); }), more=comingParts();
    if(!list.length&&!more.length) return box;
    box.appendChild(hHead(tw('hc.h')));
    list.forEach(function(o){
      var c=oClaimed(o), t=o.status==='placed'?tw('hc.placed'):oToPay(o)>0.004?tw('hc.still'+payWhenKey(o),{rm:rm(oToPay(o))}):tw('hc.paid');
      box.appendChild(homeRow(o,t+(c>0?'. '+tw('hc.sent',{rm:rm(c)}):'')));
    });
    more.forEach(function(p){ box.appendChild(partRow(p)); });
    return box;
  }
  /* S7 polish: ONE LIST, ONE ROW. A part no order of theirs accounts for (a row he entered on the desk) is a row of the
     same Coming up, the system's Inbox row as every order above it is: its mark and size, then (S6 fix) its due day and
     never an offer to pay now, which Home has no control for; the day and the figure at the side. There is no order to
     open, so a tap opens Account, whose statement carries the row. It was stage 6's plain Ledger line under the orders. */
  function partRow(p){
    var b=el('button','salt-inbox-row hpart'); b.type='button';
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title');
    t.appendChild(withMark(p.product,unitsOf(p.qty,unitFor(p.product)),18));
    main.appendChild(t);
    main.appendChild(el('span','salt-inbox-row__what',tw(p.resale?'hc.dueOnReceiptF':'hc.dueOnReceipt')));
    b.appendChild(main);
    var side=el('span','salt-inbox-row__side');
    side.appendChild(el('span','salt-inbox-row__age',p.date?oDay(p.date):''));
    side.appendChild(el('span','salt-inbox-row__action',rm(p.rm)));
    b.appendChild(side);
    b.addEventListener('click',function(){ placeShow('stmt',true); });
    return b;
  }
  /* S7 7.4: ORDER AGAIN. A tile for each thing they have ordered (a size, a way and a place), newest first, while that size
     is still on their list, at TODAY'S price, read off the list: a tap opens the check with the same size, way and place,
     so the second tap places it. The note is not carried: it was about that order. A declined or cancelled order is not
     offered again. A new account, or one whose orders are all off the list, is offered the list's first sizes, which open
     the sheet at that size. Nothing is offered over the line or on his read-only view. */
  function againList(){
    var seen={}, out=[];
    orders.slice().sort(function(a,b){ return String(b.at).localeCompare(String(a.at)); }).forEach(function(o){
      if(o.status==='declined'||o.status==='cancelled'||!oSoldHas(o.product,o.qty)) return;
      var way=o.mode==='deliver'?'deliver':'collect', where=way==='deliver'?String(o.place||''):'', k=[o.product,o.qty,way,where,!!o.forFriend].join('|');
      if(seen[k]) return; seen[k]=1;
      out.push({product:o.product, q:o.qty, mode:way, place:where, forFriend:!!o.forFriend});
    });
    return out;
  }
  function againOpen(a,tile){
    draft.mode=a.mode; draft.place=a.place; draft.placeWas=a.place; draft.say=''; draft.noteOpen=false;
    if(assoc) draft.forFriend=a.forFriend;
    sheetOpen(a.product,a.q,tile);
    if(osh&&draft.step==='form'&&!formWhy()) reviewSheet();
  }
  function homeAgain(){
    var box=el('div'); if(!bundle||view||hold||!sold().length) return box;
    var list=againList(), start=!list.length;
    if(start) sold().forEach(function(P){ P.sizes.slice(0,2).forEach(function(z){ list.push({product:P.product, q:z.q, start:true}); }); });
    box.appendChild(hHead(tw(!start?'ha.again':fresh()?'ha.first':'ha.start')));
    /* S7 7.4: the system's Option grid, two across, and its face as a tap (salt-option__face--tap): the tile opens the
       check, so nothing here is a radio, and no rule of the page's own restates the recipe (S7-R3 of the review) */
    var g=el('div','salt-options__grid salt-options__grid--2');
    list.slice(0,4).forEach(function(a){
      var P=sold().filter(function(x){ return x.product===a.product; })[0], z=P.sizes.filter(function(x){ return String(x.q)===String(a.q); })[0];
      var b=el('button','salt-option__face salt-option__face--tap htile'), t=el('span','salt-option__text'), l=el('span','salt-option__label');
      /* nothing of the book in an attribute: the tap reads the tile from its own closure (S7R-2 of the stage 7 review) */
      b.type='button';
      l.appendChild(psym(a.product,18)); l.appendChild(document.createTextNode(unitsOf(a.q,P.unit))); l.appendChild(el('span','sr',pshape(a.product)));
      t.appendChild(l);
      t.appendChild(el('span','salt-option__detail',a.start?rm(z.price):tw('ha.'+(a.mode==='deliver'?'deliv':'coll')+(a.forFriend?'F':''),{rm:rm(z.price), p:a.place})));
      b.appendChild(t);
      b.addEventListener('click',function(){ if(a.start) sheetOpen(a.product,a.q,b); else againOpen(a,b); });
      g.appendChild(b);
    });
    box.appendChild(g);
    /* a new account's one filled control, under the sizes it can start from: the whole list (S7-R5, as the plan's first
       Home has it; it stood above them, under To pay) */
    if(fresh()){ var sp=el('button','salt-pill salt-pill--md hfill',tw('ha.all')); sp.type='button'; sp.id='hPrices';
      sp.addEventListener('click',function(){ placeShow('prices',true); }); box.appendChild(sp); }
    return box;
  }
  /* a count beside a place is what waits there: the orders that need them. data-n: data-count is the owner's own */
  function placeCounts(){
    var n=orders.filter(oNeeds).length;
    [].forEach.call(tabs.querySelectorAll('[data-n]'),function(c){ c.textContent=c.getAttribute('data-n')==='order'&&n?String(n):''; });
  }
  async function loadOrders(){
    if(!session) return;
    var mine=ticket;
    var r=await api('/orders');
    if(mine!==ticket) return;
    if(r.status===401) return;   /* api() has said so in the bar */
    if(r.body.ok){ orders=r.body.orders||[]; claims=Array.isArray(r.body.claims)?r.body.claims:[]; }
  }
  /* S5 5.5 (24 Sep 2026): A RE-READ PATCHES WHAT CHANGED AND NOTHING ELSE. It drew the whole tab again, the order
     form and every order with it, so a poll bringing any change to any order took the box being typed in and the
     caret with it (v827 put the words back; the element was still new). Now the orders are compared one by one,
     and only the rows and the parts of the open order that changed are drawn again. A return to the page and a lapse
     reopened (S3 3.5) come this way too; only an account that now draws the form above differently draws the tab. */
  async function oReread(){
    var before={}, mine=ticket, was=JSON.stringify([claims,orders.map(oClaimed)]); orders.forEach(function(o){ before[o.id]=JSON.stringify(o); });
    await loadOrders();
    if(mine!==ticket) return;
    if(JSON.stringify([claims,orders.map(oClaimed)])!==was){ setHold(); drawPayHead(); }
    if(document.getElementById('oArea')&&formSig()!==drawnSig){ drawOrder(); return; }
    var changed=orders.filter(function(o){ return before[o.id]!==JSON.stringify(o); }).map(function(o){ return o.id; }),
        gone=Object.keys(before).some(function(id){ return !oFind(id); });
    if(draft.oStale&&changed.indexOf(draft.oStale)<0) changed.push(draft.oStale);
    if(changed.length||gone){ oSync(changed); drawHome(); if(osh&&draft.step==='limit') sheetDraw(); }
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
    draft.pushNote='';   /* S9 fix: a refusal from before is not this try's */
    try{
      var k=await (await fetch('/push/key',{cache:'no-store'})).json();
      if(!k.key||!k.configured){ draft.pushNote=Wk('push.siteOff'); drawOrder(); return; }
      /* v693: THE ASK COMES FIRST. Registering a service worker before it meant a browser that
         refuses the registration never got as far as the question, which only a tap puts (S4), so
         that silence would waste the one tap. Nothing is installed on a phone whose reader says no. */
      var perm=await Notification.requestPermission();
      if(perm!=='granted'){ draft.pushNote=Wk('push.denied'); drawOrder(); return; }
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
      if(r.body.ok){ draft.pushed=true; draft.pushDone=true; pushOffSet(false); } else { var rb=r.body; draft.pushNote=function(){ return wErr(rb,'push.notRecorded'); }; }
    }catch(e){ draft.pushNote=Wk('push.fail'); }
    drawOrder();
  }

  document.getElementById('f').addEventListener('submit', async function(ev){
    ev.preventDefault();
    var u=norm(un.value), pass=OWNER?pw.value.trim():canonPass(pw.value);
    var bad=function(f,t){ say(t,'bad'); f.setAttribute('aria-invalid','true'); f.classList.add('salt-field__input--error'); try{ f.focus(); }catch(e){} };
    if(!OWNER&&unfit(un.value,8,'username')){ bad(un,unfit(un.value,8,'username')); return; }
    if(!u){ bad(un,tw('door.needUn')); return; }
    if(!pass){ bad(pw,tw('door.needPw')); return; }
    if(!OWNER&&unfit(pass,16,'password')){ bad(pw,unfit(pass,16,'password')); return; }
    un.value=u;
    var mine=++ticket;
    var stale=function(){ return mine!==ticket; };
    var done=function(){ if(!stale()){ busy=false; go.disabled=false; } };
    busy=true; go.disabled=true; again(false); say(tw('door.checking'),'wait');
    var r, body;
    /* the one field carries either secret: the Worker says which it matched, and the page
       unwraps with the matching wrap. A customer never knows there is a second one. */
    try{
      r=await fetch('/open', {method:'POST',
        headers:{'content-type':'application/json'}, body:JSON.stringify(OWNER?{u:u, password:pass, master:pass}:{u:u, password:pass})});
      body=await r.json();
    }catch(e){ if(stale())return; done(); say(tw('door.offline'),'bad'); return; }
    if(stale()) return;
    if(!r.ok||!body.ok){
      done();
      /* S13: the Worker's refusal worded from its code, its English standing for a code this page does not know */
      say(wErr(body,r.status===429?'door.tooMany':'e.refused'),'bad');
      return;
    }
    say(tw('x.opening'),'wait');
    var w=body.byMaster?body.wrapMaster:body.wrap;
    if(!w){
      done();
      say(tw(body.byMaster?'door.noMaster':'door.noKey'),'bad');
      return;
    }
    var ck, b;
    try{ ck=await unwrap(pass, w); b=JSON.parse(await open(ck, body.env)); }
    catch(e){ if(stale())return; done(); say(tw('door.noOpen'),'bad'); return; }
    if(stale()) return;
    /* an empty bundle is a new account, not a fault: pickStmt says so */
    if(!b||!b.statements){ done(); say(tw('door.noRead'),'bad'); return; }
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
  var remAgain=document.getElementById('remAgain');
  function again(on){ if(remAgain) remAgain.hidden=!on; }
  async function openRemembered(keep){
    var rec=remGet();
    if(!rec||!rec.t||!rec.k||OWNER) return false;
    if(!keep) again(false);
    /* S3 3.5: reopening a lapse runs under the flow that met it, so it takes no ticket of its own and says nothing */
    var mine=keep?ticket:++ticket, stale=function(){ return mine!==ticket; };
    if(!keep) say(tw('x.opening'),'wait');
    var r, body;
    try{
      r=await fetch('/remember/open', {method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({token:rec.t})});
      body=await r.json();
    }catch(e){ if(!stale()&&!keep){ say(tw('door.kept'),'bad'); again(true); } return false; }
    if(stale()) return false;
    /* S1 1.41, 24 SEP 2026: ONLY THE DOOR'S REFUSAL FORGETS THIS PHONE. A server fault forgot it too, so one
       bad minute on the site signed every returning phone out for good; that, and a dropped connection,
       now keep it and say so. */
    if(r.status===401){ remClear(); if(!keep) say(''); return false; }
    if(!r.ok||!body.ok){ if(!keep){ say(tw('door.kept'),'bad'); again(true); } return false; }
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
        b.statements.unshift({issued:'now', label:tw('acct.now'), live:true, at:l.at||body.live.at, body:l.body, owed:l.owed, pay:l.pay||null}); }
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
    if(!same){ orders=[]; claims=[]; draft={}; closePay(); }
    view=!!(OWNER&&body.byMaster);
    if(linkBox) linkBox.hidden=true;
    if(opening) opening.hidden=true;
    lapse.hidden=true; closeSignedOut();
    show(b);
    drawPrices();
    drawKeep();
    drawDev();
    /* HOME OPENS FIRST (S7 7.1), over the line too, where it leads with what to pay; an address naming a place opens
       that place once. The same account let in again stays where it was, the order sheet open over it included,
       unless that place has gone (Rewards, for an account no longer an associate) */
    if(!same){ var w=wantPlace; wantPlace=''; placeShow(w||'home'); }
    else if(placeBtns(t)[0].hidden) placeShow(t);
    if(same){
      if(mf&&mfil.querySelector('button[data-mf="'+mf+'"]')){ mfPick=mf; applyMonths(); }
      window.scrollTo(0,sy);
      if(draft.sheetBack){ draft.sheetBack=false; sheetOpen(); }
    }
  }
  async function follow(stale){
    if(session){ await loadOrders(); if(stale()) return false; if(poll)clearInterval(poll); poll=setInterval(refresh, POLL_MS); }
    else if(view){ await loadView(user); if(stale()) return false; }   /* stmt/owner.js: his route alone carries it */
    setHold(); drawOrder(); drawPayHead();   /* S6 6.5 and 6.7: the claims come with the orders, and may lift the hold */
    if(session) payqBack();   /* S6 fix: a question the last open left unanswered */
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
    say(tw('link.spent'),'bad');
  }
  async function showLink(){
    var tok=signinToken();
    if(!tok||OWNER||!linkBox) return false;
    gate.hidden=true; linkBox.hidden=false;
    if(INAPP){
      document.getElementById('linkInapp').hidden=false;
      document.getElementById('inappIos').hidden=!IOS; document.getElementById('inappDroid').hidden=IOS;
      document.getElementById('linkCopy').hidden=false;
      linkGo.className='btn salt-ghost'; setW(linkGo,'link.goHere');
    }
    linkGo.disabled=true; lsay(tw('link.checking'),'wait');
    var r=null, body=null;
    try{
      r=await fetch('/open-link', {method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({token:tok, peek:true, nonce:linkNonce()})});
      body=await r.json();
    }catch(e){ /* the question was lost, not the link: Continue still asks the real one */ }
    if(r&&r.status===401){ linkSpent(); return false; }
    if(r&&r.ok&&body&&body.ok&&body.u){
      setW(document.getElementById('linkLead'),'link.leadU',{u:'<span class="mono">'+esch(body.u)+'</span>'});
    }
    linkGo.disabled=false; lsay('');
    return true;
  }
  if(linkBox){
    document.getElementById('linkCopy').addEventListener('click', async function(){
      try{ await navigator.clipboard.writeText(location.href); lsay(tw('link.copied')); }
      catch(e){ lsay(tw('link.copyFail'),'bad'); }
    });
    linkGo.addEventListener('click', async function(){
      var tok=signinToken();
      if(!tok||busy) return;
      var mine=++ticket, stale=function(){ return mine!==ticket; };
      busy=true; linkGo.disabled=true; lsay(tw('x.opening'),'wait');
      var r, body;
      try{
        r=await fetch('/open-link', {method:'POST', headers:{'content-type':'application/json'},
          body:JSON.stringify({token:tok, nonce:linkNonce()})});
        body=await r.json();
      }catch(e){ if(stale()) return; busy=false; linkGo.disabled=false; lsay(tw('link.lost'),'bad'); return; }
      if(stale()) return;
      busy=false;
      if(r.status===401){ lsay(''); linkSpent(); return; }
      if(!r.ok||!body.ok){ linkGo.disabled=false; lsay(tw('link.lost'),'bad'); return; }
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
      var kept=!!remGet(), cm=hk==='code';   /* S9 fix: This device's QR (/app#code) opens on the code, in a browser's words */
      if(APP&&!kept&&(IOS||key||qm||cm)) showCode((!!qm||cm)&&!STANDALONE); else gate.hidden=false;
      if(APP&&qm&&INAPP&&!STANDALONE) csay(tw('code.inapp'),'bad');
      if(key&&!kept) await openHandover({token:key});
    })();
  }
})();
`;
