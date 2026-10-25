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
import { MAX_OPEN, OPEN_STATES, WANT_DAYS } from "./orders.js";
import { slotSpan, slotNext, WINDOWS } from "./window.js";
import { openParts } from "./hours.js";
import GEO_ENGINE from "./geo.js";
import { TEST_USERS, TEST_PASS } from "./testfix.js";
import { EN, WORDS, fill, fillHtml, unitsIn } from "./words.js";

/* v692: THE THREE-MINUTE LOCK IS GONE (his instruction, 18 Sep 2026). It was a privacy lock for a
   phone left on a table; he asked for a page that stays signed in and a button that leaves. What
   replaced it is Remember me and Log out, which say what they do. */
export const POLL_MS = 10000;
/* Step 7: the account's thread is read this often while its Sheet is open and the page is showing, and never otherwise
   (his "live enough to the second", met by a fast read rather than a socket) */
export const THREAD_POLL_MS = 2000;
/* THE TEST SURFACE (his answers of 18 Oct 2026): a practice view re-reads every 2 seconds, so a tap in one pane shows in the other at once */
export const TEST_POLL_MS = 2000;

const PAGE_CSS = `
/* hidden wins over every display rule below: the tab strip and the issue strip are flex */
[hidden]{display:none!important}
/* S7 7.5 (his D14 of 24 Sep 2026): the notice is a still card on Home, the system's insight, a line a paragraph */
/* Counter Batch A: the Today card, and the notice in it */
.today{display:flex;flex-direction:column;gap:12px}
/* Home's Today card holds the clock, so the header does not say the time twice there */
.cshell[data-place=home] .chead .cclock{display:none}
.today__head{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:var(--salt-tap);margin:-8px 0 -4px}
.today__clock{margin-left:auto;font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);font-weight:500;font-variant-numeric:tabular-nums;color:var(--salt-mist-bright)}
.today__line{margin:0;font-size:var(--salt-text-md);line-height:1.45;color:var(--salt-salt)}
.today__when{color:var(--salt-brass)}
.today .salt-notice{border-top:1px solid var(--salt-line-faint);padding-top:12px}
.today .salt-notice__head{min-height:20px}
/* The gate, in the same material as the document behind it. One filled control, the
   brass-to-copper pill, because this is the one thing on the page that produces something;
   decision 5 of the identity. Everything else is a hairline or a word. */
.gate{max-width:440px;margin:10vh auto 0;padding:0 4px}
.gate h1{font-size:1.75rem;margin:0 0 8px}
.gate p.lead{color:var(--salt-mist-bright);font-size:.875rem;line-height:1.6;margin:0 0 24px}
/* S3 3.3: the link page, in the system's card, eyebrow, plain ledger and insight; the ring is the app's mark */
.appmark{display:block;margin:0 0 14px}
/* the door's name, the one line over Sign in (11 Oct 2026) */
#gate>.salt-eyebrow{margin:0 0 8px}
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
/* 12 OCT 2026 (PHASE 5): a form's label is the system's Field label (salt-field__label, or the Option legend's label modifier), set beside lbl in the markup; what is left
   here is where it stands */
.adm .lbl{display:block;margin:14px 0 6px}
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
   the platforms that take the colour rather than the scheme: the system's own .salt-field__select option, slate under salt
   ink as on the Desk (18 Oct 2026; this page had set the well, black at 28%, which a native list draws near-black), so every
   select carries salt-field__select. The chevron is drawn out of two
   gradients because appearance:none took the system's away and left nothing to say it opens. */
select.fld{letter-spacing:0;appearance:none;-webkit-appearance:none;color-scheme:dark;cursor:pointer;
  padding-right:42px;background-repeat:no-repeat;background-size:6px 6px,6px 6px;
  background-image:linear-gradient(45deg,transparent 50%,var(--salt-brass) 50%),linear-gradient(135deg,var(--salt-brass) 50%,transparent 50%);
  background-position:calc(100% - 22px) calc(50% - 2px),calc(100% - 17px) calc(50% - 2px)}
/* v695: a product is a mark. Brass, hairline, and it sits on the baseline of whatever it is beside. */
.psym{display:inline-block;vertical-align:-0.22em;color:var(--salt-brass)}
/* F8: his letter in every mark, the mono face at its middle weight, whatever the heading around it says */
.psym .plet{font-family:var(--salt-font-mono);font-weight:500;letter-spacing:0}
h3.pmark,.pmark{margin:0 0 4px;line-height:1}
/* F4: the light is a coloured border round the mark; the three colours are the system's own tokens (yellow is --salt-amber, the warning; brass is the mark's own colour and the focus ring) */
.pmark.sup{display:inline-block;padding:5px;border:3px solid var(--sup);border-radius:8px}
/* 22 Oct 2026 (his word, the outline alone was missed): the light in words is the system's status, in the light's own token */
.salt-status.supst{--salt-status-tone:var(--sup)}
.hsup{min-height:44px;align-items:center}
.hsup .pmark.sup{margin:0}
.sup-green{--sup:var(--salt-verdigris)}
.sup-yellow{--sup:var(--salt-amber)}
.sup-red{--sup:var(--salt-ember)}
.pwith{display:inline-flex;align-items:center;gap:7px}
/* HIS NOTE OF 28 SEP 2026: IN A CARD THE MARK IS A BUTTON, ITS CAPTION UNDER IT. The pressed ghost's edge and glass, the mark at
   28px, the caption in the mono face: the size in words, "2.5 units" (12 Oct 2026, his word: the mark stands alone, so no shape word
   is drawn, here or beside any mark; the reader is told the shape in .sr). The statement's lines take it too. */
.mtile{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;flex:0 0 auto;
  min-width:64px;padding:10px 10px 8px;border:1px solid var(--salt-edge-field);border-radius:var(--salt-radius-sm);
  background:var(--salt-glass);color:var(--salt-brass);line-height:1;vertical-align:middle}
.mtile .psym,.mstack .psym{display:block}
.mq{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);font-weight:500;font-variant-numeric:tabular-nums;
  color:var(--salt-text);white-space:nowrap;line-height:1.2}
.mhero{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.salt-inbox-row>.mtile{align-self:center}
.mlab{display:inline-flex;align-items:center;gap:12px}
.mstack{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px}
.htile{justify-content:center}
.salt-lines__row--cancelled .mq{color:var(--salt-prose);text-decoration:line-through;text-decoration-thickness:1px}
.tot .mtiles{display:inline-flex;flex-wrap:wrap;gap:8px;vertical-align:middle;margin-left:6px}
.owed .mtiles{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.owed .mq{font-size:var(--salt-text-xl);color:var(--salt-verdigris)}
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
/* New order stands where the order form's pane stood, and keeps the pane's gap to what follows it */
#oNew{margin-bottom:14px}
.ototal{flex:1 1 0;min-width:0}
.ototal .salt-kpi__value{margin-top:0}
.ototal .sub2{display:block;margin-top:2px}
.osheet .salt-sheet__foot .msg{flex:1 1 100%;margin:0}
/* 11 Oct 2026: a yes or no in a Sheet. The look is the system's; here is where its pieces sit: the answers run the width, the danger
   one first and in the alarm (the system's danger ghost), the ghost that keeps below it */
/* at the limit it lies over the order sheet, so its scrim covers that sheet and its body is above the scrim (the system's own Sheet is 70 and 71) */
#ynScrim{z-index:72}
.ynsheet{z-index:73}
.ynsheet .salt-sheet__title{flex:1 1 auto}
.ynsheet .salt-sheet__close{margin-left:auto}
.ynsheet .salt-sheet__body > * + *{margin-top:14px}
.ynsheet .salt-sheet__foot{flex-direction:column;align-items:stretch}
.ynsheet .salt-sheet__foot .salt-ghost{width:100%}
.thsheet .salt-sheet__foot{display:block}
.thsheet .salt-sheet__foot .msg{margin:8px 0 0}
.thempty{margin:0}
.szrow{display:block;width:100%;min-height:52px;padding-left:0;padding-right:0;background:none;border-style:none none solid;
  font:inherit;color:inherit;text-align:left;cursor:pointer}
.szrow:last-child{border-bottom-style:none}
.szrow:focus-visible{outline:2px solid var(--salt-brass);outline-offset:2px}
.ochev{flex:0 0 auto;color:var(--salt-prose)}
.osent{text-align:center}
.otick{display:block;margin:4px auto 10px;color:var(--salt-verdigris)}
.olim{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;margin-top:6px}
.olim .salt-ghost{flex:0 0 auto}
/* the one filled control is the system's .salt-pill and the quiet ones its .salt-ghost (22 Sep 2026);
   this page decides only that they run the width of the form */
.btn{margin-top:18px;width:100%}
/* a pay link is a .salt-ghost too (24 Sep 2026); a long account name wraps, and its lines centre */
.btn.lnk{text-align:center;line-height:1.4}
/* Optional install guide under This device; its steps draw the browser's own marks. */
.keeppage{margin:20px 0 0;padding:0}
/* the guide is a part of the compact This device card, so its heading is the card's own third level and not a page's first (11 Oct 2026) */
.keeppage h3{margin:0 0 10px;font-family:var(--salt-font-display);font-size:var(--salt-text-lg);font-weight:500;line-height:1.2}
.keeppage .kline{margin:14px 0 0}
.keeppage b{color:var(--salt-text);font-weight:500}
.keepsteps{margin:14px 0;padding-left:22px;line-height:2.1}
.keepsteps .glyph,.keeppage .glyph{vertical-align:-0.3em;margin:0 3px}
/* THE BELL (Step 1b), at the head of every view of the saved app: marked, with its call beside it, until notifications
   are on; both 44px taps */
.chead{display:flow-root}
.cbell{float:right;display:flex;align-items:center;gap:8px;margin:0 0 6px 10px}
.cbell__orb{position:relative}
.cbell__dot{position:absolute;top:8px;right:8px;width:8px;height:8px;border-radius:50%;background:var(--salt-brass);display:none}
.cbell--off .cbell__dot{display:block}
.cbell--off .cbell__orb{border-color:var(--salt-brass)}
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
/* Phase 3b: a refusal's Details, the server's own words under the plain sentence, to copy */
.adm .rdet{margin:8px 0 0}
/* Phase 4c: a Details control opens a list of names and values (an id, a moment, a row's figures); a long value wraps and stays at the right */
.adm .rdet .salt-ledger{margin:8px 0 0}
.adm .rdet .salt-ledger__value{white-space:normal;overflow-wrap:anywhere;text-align:right}
.adm .rraw{margin:8px 0 0;font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-text-muted);overflow-wrap:anywhere;user-select:all}
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
/* 04 OCT 2026: HIS VIEW LINE SHARES ITS ROW WITH BACK TO ACCOUNTS. On a phone the line took the row's width, so the
   button fell to a second row and the line sat a pixel under the veil's top edge; the line now wraps beside the button,
   centred on its 44px, and a lapse still takes the next row */
.vbar>span{flex:1 1 0;min-width:0;padding:10px 0;line-height:1.5}
.vbar b{white-space:nowrap}
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
.chead h1{margin:0;font-size:1.75rem;line-height:1.15}
/* 14 Oct 2026 (his review): A LIVE CLOCK, Kuala Lumpur time, on the Counter's header (digits only: every word shown is the table's) */
.cclock{margin:0 0 4px;font-variant-numeric:tabular-nums}
.cclock:empty{display:none}
.cwho{margin:6px 0 0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
/* 21 Oct 2026, his word: THE HEADER IS THE BAR, on every place, in the Desk's glass: the time, the place and whose account on the left, what
   waits on them (cBarChips) and the bell beside; under 820px of bar what waits takes its own row, as the Desk's does */
.cbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:0;align-items:center;top:calc(env(safe-area-inset-top) + 8px)}
.cbar>.cclock,.cbar>h1,.cbar>.cwho{grid-column:1}
.cbar>h1{font-size:1.375rem}
.cbar>.cbell{grid-column:3;grid-row:1/span 3;float:none;margin:0 0 0 12px}
.cbar>.salt-deskbar__live{grid-column:1/-1;grid-row:4}
.cbar>.salt-deskbar__live:not(:has(.salt-deskbar__chip)){display:none}
@container salt-deskbar (min-width:820px){.cbar>.salt-deskbar__live{grid-column:2;grid-row:1/span 3;margin-left:14px}}
/* a username is a credential, so the rail's capitals never reach it */
.home{max-width:620px;margin:0 auto}
.home .hcol>div{margin:0 0 24px}
.home .hcol>:empty{display:none}
.hfill{width:100%;margin-top:14px}
.hlab{display:flex;justify-content:space-between;gap:12px;margin:0 0 10px}
.home .salt-inbox-row{margin:0 0 8px}
/* 28 SEP 2026 (his instruction, with pay terms V2's C2): ON A PHONE THE SCREEN'S MARGINS ARE EQUAL AND THE PAGE USES ALL
   OF IT. The body kept the statement's 44px above, 20px beside and 60px below, and the shell 24px over the App bar
   besides, so a page began under a saved app's status bar and ended 84px above the bar. Under 1080px: 16px on every side,
   each safe area added, the App bar cleared by the same 16px, and Home's sections one gap apart with nothing after the last,
   a list's last row included (its 8px stood inside Coming up, so the gap after it read 32px). The rows' resets are
   shorthands, as the rules they undo are. */
@media (max-width:1079.98px){
  body{padding:calc(16px + env(safe-area-inset-top,0px)) calc(16px + env(safe-area-inset-right,0px)) calc(16px + env(safe-area-inset-bottom,0px)) calc(16px + env(safe-area-inset-left,0px))}
  /* 12 OCT 2026 (HIS IPHONE): IN THE SAVED APP A FIXED BAR STANDS AT THE FOOT OF THE DOCUMENT WHEN THE DOCUMENT IS SHORTER THAN THE SCREEN. Measured on his phone,
     393x852, each page at its top: Orders (long) had the bar on the screen's foot, Record (one short card) 20pt above it and Needs you ("Nothing here.") 55pt above it,
     the page ground showing under it; Safari never did. So the document is the whole screen tall at least in the saved app: the head script marks the root data-app and
     sets --app-h to the screen's height (the viewport units are not trusted there, none being known to reach the screen's foot), and the body's min-height is that.
     The body's box is border-box, so its padding adds no scroll. Only the saved app, and under 1080px, where the bar shows. */
  html[data-app] body{min-height:100vh;min-height:var(--app-h,100vh)}
  .cshell{padding-bottom:var(--salt-bar-h)}
  .gate{padding:0}
  .home .hcol{display:flex;flex-direction:column;gap:24px}
  .home .hcol>div{margin:0}
  .home .hcol+.hcol{margin-top:24px}
  .home .salt-inbox-row:last-child,.olist .salt-inbox-row:last-child{margin:0}
  .olist>:last-child{margin-bottom:0}
}
/* S7 7.2: FROM 1080PX THE BAR IS THE RAIL, beside the page (the recipe's own switch), and each place takes two columns:
   Home its money and what needs them beside what is coming, Account the statement beside This device (S7 7.3's .acct,
   below), Prices a book a column; Orders keeps stage 5's list beside the open order. A sheet is the recipe's drawer on
   the right. */
@media (min-width:1080px){
  .cshell{display:flex;gap:28px;align-items:flex-start;max-width:1240px;margin:0 auto;padding-bottom:48px}
  .cmain{flex:1 1 auto;min-width:0}
  .cmain .bar,.chead,.home,.cmain .panel{max-width:none}
  .chead .cclock{display:none}
  /* Counter Batch A: the rail says whose account it is, so the header does not say it twice */
  .chead [data-whoas]{display:none}
  .crtitle{display:block;margin:0 12px 16px;font-size:1.375rem;line-height:1;letter-spacing:0.04em;white-space:nowrap}
  .crbrand{flex-direction:column;align-items:flex-start;gap:2px}
  .crbrand .mono{font-size:var(--salt-text-sm);color:var(--salt-salt);text-transform:none;letter-spacing:0}
  .home{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
  .pgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 20px;align-items:start}
}
.panel{max-width:620px;margin:0 auto}
.panel h2,.panel h1.gh{font-size:var(--salt-text-lg);margin:0 0 4px}
.panel p.lead{color:var(--salt-mist-bright);font-size:.875rem;line-height:1.6;margin:0 0 18px}
/* Counter Batch B: the basket's + beside each size, its minus and its count once tallied, and the pane's line of what is in it */
.szwrap{display:flex;align-items:center;gap:8px}
.szwrap>.szrow{flex:1 1 auto;min-width:0}
.szadd{display:flex;align-items:center;gap:6px;flex:0 0 auto}
.szadd .salt-orb{width:var(--salt-tap);height:var(--salt-tap);min-width:var(--salt-tap);min-height:var(--salt-tap);display:inline-flex;align-items:center;justify-content:center}
.szadd .salt-orb:disabled{opacity:.45;cursor:not-allowed}
.bkn{min-width:1.5em;text-align:center;font-family:var(--salt-font-mono);font-variant-numeric:tabular-nums;color:var(--salt-copper)}
.bkline[hidden]{display:none}
.bkline{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:10px}
.bkline__t{font-size:var(--salt-text-md);color:var(--salt-salt)}
.bkrm{margin-top:6px}
/* the bar: the pay foot's pattern under 1080px, sticking above the App bar on the bar's own slate; from 1080px, where the bar is the rail,
   a card that sticks to the foot of the list's column */
.bkbar[hidden]{display:none}
.bkbar{z-index:10;position:sticky;margin-top:24px;bottom:calc(var(--salt-bar-h) + env(safe-area-inset-bottom,0px) - 1px);
  display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0 13px;background:var(--salt-slate);border-top:1px solid var(--salt-line)}
.bkbar .salt-kpi{flex:1 1 8.5rem;padding:9px 14px 8px 18px}
.bkbar .salt-pill{flex:1 1 auto;padding-left:18px;padding-right:18px;min-height:var(--salt-tap)}
@media (min-width:1080px){
  .bkbar{bottom:0;padding:12px 16px;border:1px solid var(--salt-line);border-radius:var(--salt-radius-lg)}
}
/* Counter Batch B: the way on Prices, its words and Change on one line while they fit */
.pway[hidden]{display:none}
.pway{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:-6px 0 18px}
.pway__t{font-size:var(--salt-text-md);color:var(--salt-salt)}
/* THE ISSUES, as a strip of dates. The current one leads; the rest are the record. A pill is
   a word in mono with a hairline, and the chosen one is brass: no filled badge. S7 polish: now only Rewards' months,
   inside its card, so it starts at the card's edge: centred, it stood 170px in from everything else from 1080px */
.mos{max-width:620px;margin:0 0 22px}
.mos .salt-tabs__pill{min-height:var(--salt-tap);min-width:var(--salt-tap)}
/* THE MONTH FILTER (v690): the same pill vocabulary as the issue strip, a step quieter, because it
   sits inside a statement rather than choosing between statements. The note under it says what the
   filter does and does not do, so a reader never takes a month's rows for the whole account. */
.mfil{margin-bottom:10px}
.mfnote{max-width:620px;margin:0 auto 18px;font-size:var(--salt-text-xs);color:var(--salt-text-muted);
  font-family:var(--salt-font-mono);letter-spacing:.04em;line-height:1.6}
.mfnote:empty{display:none}
/* S7 7.3: ACCOUNT. The month filter is the system's tab strip, every pill a 44px tap, placed on the list it filters;
   no earlier statement follows it (14 Oct 2026). 11 Oct 2026 (Phase 7d part 2, his yes): THE DEVICE COMES FIRST. Messages, then the
   compact This device card, then the statement under a gap of its own (28px, a gap and never a margin, so a part that is not drawn
   leaves none); from 1080px This device stands beside, as it did */
.acct{max-width:620px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
#aThread:empty{display:none}
#aGlance:empty{display:none}
.aglance .salt-glance__value{overflow-wrap:anywhere}
.mfil .salt-tabs__pill{min-height:var(--salt-tap);min-width:var(--salt-tap)}

.devcard{margin:0}
.devcard .salt-ledger{margin-top:6px}
.devcard .salt-ledger__row:last-child{border-bottom:0}
.devcard .salt-ledger__label{flex:1 1 auto}
.devcard .salt-ledger__flag .glyph{vertical-align:-0.3em;margin:0 3px}
.devout{width:100%;margin-top:14px}
.ospots{display:flex;flex-direction:column;gap:var(--salt-space-2)}
.ospot{display:flex;align-items:stretch;gap:var(--salt-space-2)}
.ospot .salt-option{flex:1 1 auto;min-width:0}
.ospot__edit{flex:0 0 auto;min-width:var(--salt-tap);min-height:var(--salt-tap)}
.ospot__add{align-self:flex-start;min-height:var(--salt-tap)}
.spsave{flex-direction:row;align-items:flex-start;gap:12px;min-height:var(--salt-tap)}
.spsave input{width:22px;height:22px;margin:11px 0 0;flex:0 0 auto;accent-color:var(--salt-brass)}
.spsave__t{display:flex;flex-direction:column;gap:2px}
.spremove{min-height:var(--salt-tap);margin-top:var(--salt-space-2)}
.ahelp{margin:0}
.ahelp__q{border-top:1px solid var(--salt-line-faint)}
.ahelp__q:first-of-type{margin-top:6px}
.ahelp__sum{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:var(--salt-tap);cursor:pointer;list-style:none}
.ahelp__sum::-webkit-details-marker{display:none}
.ahelp__sum .glyph{flex:0 0 auto;color:var(--salt-prose);transition:transform .2s}
.ahelp__q[open] .ahelp__sum .glyph{transform:rotate(90deg)}
.ahelp__a{margin:0 0 14px;color:var(--salt-prose)}
@media (prefers-reduced-motion:reduce){.ahelp__sum .glyph{transition:none}}
@media (min-width:1080px){
  .acct{max-width:1060px;display:grid;grid-template-columns:minmax(0,620px) minmax(300px,1fr);column-gap:40px;row-gap:28px;align-items:start}
  /* Counter Batch A: the glance runs across both columns, This device beside Messages and the statement under it */
  #aGlance{grid-column:1 / -1}
  #aThread,.acct__main{grid-column:1}
  .devcard{grid-column:2;grid-row:2 / span 2}
  .ahelp{grid-column:2}
}
/* S6 6.2: To pay now, Home's first answer since S7 7.1, its parts on the plain Ledger list */
.payhead[hidden]{display:none}
.payhead .btn{margin-top:12px}
.payhead .salt-insight{margin:12px 0 0}
.salt-ledger--plain .salt-ledger__value{white-space:nowrap}
/* V2 (28 Sep 2026): To pay now is an invoice, a line a thing due, on the plain Ledger list; on the pay sheet each line's goods,
   delivery and what is paid stand beneath it, then the totals and the Total */
.inv{margin-top:12px}
.inv .invd{margin-top:6px;padding-left:22px}
.inv .invd .salt-ledger__line,.inv .invt .salt-ledger__line{padding:2px 0}
.inv .invd .salt-ledger__label,.inv .invd .salt-ledger__value{font-size:var(--salt-text-sm);color:var(--salt-prose)}
.inv .invt .salt-ledger__label,.inv .invt .salt-ledger__value{font-size:var(--salt-text-sm)}
.inv .invt .salt-ledger__flag{margin:0 0 4px}
.inv .invtot{border-top:1px solid var(--salt-line-strong);border-bottom:0}
.inv .invtot .salt-ledger__label{color:var(--salt-text);font-weight:500}
.inv .invtot .salt-ledger__value{color:var(--salt-brass);font-weight:500}
/* S6 6.4: the pay sheet. The look is the recipes' (Sheet, KPI tile, Ghost, Option, Field, Ledger, Pill); this lays them out */
.payseg{display:flex;gap:8px;margin-top:12px}
.payseg .salt-ghost{flex:1 1 0;min-width:0}
.payhow,.payinto,.payref{margin-top:18px}
.payref .salt-ledger__value{display:inline-flex;align-items:center;gap:10px;flex-wrap:nowrap}
/* Phase 7b: the account number in fours, mono and tabular so the groups line up, on one line with its Copy (the label gives way and
   wraps); his banks stand over the figure with the page's own gap; What this pays is the Plan recipe's fold, shut */
.payref .acctno{font-family:var(--salt-font-mono);font-variant-numeric:tabular-nums;white-space:nowrap}
.payinto+.salt-kpi{margin-top:18px}
.paywhat{margin:14px 0 0}
.paywhat>summary .salt-plan__title{grid-column:1 / -1}
.paywhat .inv{margin-top:0}
.paywhat .salt-ledger__row:last-child{border-bottom:0}
.paycap{margin:0;flex-basis:100%;font-size:var(--salt-text-sm);line-height:1.5;color:var(--salt-prose)}
#payFoot .salt-pill{flex:1 1 auto}
/* S6 6.5: the one question on return, centred as the mockup draws it. S6 fix (rule 6): its heading is the Sheet's title
   recipe, and the mockup's ring round the mark waits for a recipe in salt-ds, never restated here */
.paycheck{text-align:center;padding-top:6px}
.paycheck h3{margin:14px 0 4px}
.paycheck .glyph{color:var(--salt-steel)}
.payagain{width:100%;margin-top:16px}
.paysaid{flex-basis:100%;margin:0}
.payslip{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-top:16px}
.payslip p{flex-basis:100%;margin:0}
.slipthumb{border-radius:6px;border:1px solid var(--salt-line)}
.payhead .msg{margin:10px 0 0}
/* PHASE 7A (his yes of 11 Oct 2026): HOME LEADS WITH THE ONE ACTION. To pay now's tile and its one filled Pay stand in a foot that
   sticks above the App bar, the way the order sheet's foot holds its one action: last in Home, so it stays down the whole way,
   on the bar's own slate so what scrolls under it is covered, its bottom edge the bar's height plus the safe area clear of the
   screen (less the bar's own 1px edge, which it slides under, so no sliver of the page shows between them). The bar is fixed,
   4rem (--salt-bar-h) above the safe area, so the pill is never under it. The tile and the pill share a row while the figure
   fits, and the pill takes a row of its own, the width of the foot, when it does not. The Plan recipe's fold carries the lines
   past the third. The look is the recipes' (KPI tile, Pill, Plan); this lays them out. */
.payfoot[hidden]{display:none}
.payfoot{position:sticky;bottom:calc(var(--salt-bar-h) + env(safe-area-inset-bottom,0px) - 1px);z-index:10;margin-top:24px;
  display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 0 13px;background:var(--salt-slate);border-top:1px solid var(--salt-line)}
.payfoot .salt-kpi{flex:1 1 8.5rem;padding:9px 14px 8px 18px}
.payfoot .salt-kpi__value{margin-top:2px}
.payfoot .salt-pill{flex:1 1 auto;padding-left:18px;padding-right:18px}
/* from 1080px the bar is the rail, so there is nothing to clear: the foot heads the first column in the flow, above the notice
   (the second column spans both rows beside it), where a column that runs long can never push it below the fold */
/* Counter Batch A: their latest open order. Under 1080px a pill sticking above the App bar and the pay foot (--hfoot, the foot's own height,
   set by the script); from 1080px a banner in the first column under To pay now. One element, so never both */
#hLive:empty{display:none}
.hlive{position:sticky;bottom:calc(var(--salt-bar-h) + env(safe-area-inset-bottom,0px) + var(--hfoot,0px) + 8px);z-index:11;
  display:flex;align-items:center;gap:4px;margin:16px 0 0;padding:0 4px 0 0;border-radius:999px}
.hlive__go{flex:1 1 auto;display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0;min-height:var(--salt-tap);padding:0 14px;
  border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;justify-content:center}
.hlive__h{display:none}
.hlive__row{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}
.hlive__when{font-size:var(--salt-text-sm);color:var(--salt-mist-bright)}
.hlive__point{font-size:var(--salt-text-sm);color:var(--salt-salt)}
.hreward{display:flex;flex-direction:column;gap:12px;width:100%;text-align:left;color:inherit;font:inherit}
.hreward__top{display:flex;align-items:center;gap:12px}
.hreward__left{font-size:var(--salt-text-md);line-height:1.45}
.hreward .salt-meter__track{display:block}
.hreward__see{font-size:var(--salt-text-sm);color:var(--salt-brass)}
.hyear{display:flex;flex-direction:column;gap:16px}
.hyear__top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.hyear__n{font-family:var(--salt-font-display);font-size:var(--salt-text-xl)}
.hyear__units{display:flex;flex-wrap:wrap;gap:12px}
.hyear__bars{display:flex;align-items:flex-end;gap:6px;height:88px}
.hyear__col{flex:1 1 0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;height:100%}
.hyear__bar{width:100%;max-width:22px;min-height:2px;height:calc(var(--h,0) * 0.64px);border-radius:3px 3px 0 0;background:var(--salt-brass)}
.hyear__mon{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);color:var(--salt-mist-bright)}
@media (min-width:1080px){
  .home{grid-template-rows:auto auto 1fr;row-gap:0}
  .home>.hcol{grid-column:1;grid-row:3}
  .home>.hcol+.hcol{grid-column:2;grid-row:1 / span 3}
  .payfoot{position:static;grid-column:1;grid-row:1;margin:0 0 28px}
  .hlive{position:static;grid-column:1;grid-row:2;margin:0 0 28px;padding:6px 8px 6px 4px;border-radius:var(--salt-radius-lg)}
  .hlive__go{padding:10px 14px}
  .hlive__h{display:block}
}
.invmore{margin:8px 0 0}
.invmore>summary .salt-plan__title{grid-column:1 / -1}
.invmore .inv{margin-top:0}
.invmore .salt-ledger__row:last-child{border-bottom:0}
/* THE DOCUMENT KEEPS THE GEOMETRY IT WAS PROOFED IN. What is injected is the INSIDE of the
   statement's own .w wrapper, so without this the page rendered the tables full-bleed to the
   window while the lock bar and the issue strip stayed pinned at 620px above them: on a laptop
   the osh the customer opens and the osh he was sent were different documents. */
#out{max-width:620px;margin:0 auto}
/* a pane is the system's glass card (12 Oct 2026, Phase 5: salt-glass-card beside pane in the markup); here is its padding and its gap */
.pane{padding:16px 18px;margin:0 0 14px}
.pane h3,.pane .pmark{font-size:var(--salt-text-md);margin:0 0 2px;font-family:var(--salt-font-mono);letter-spacing:.04em}
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
/* S7-R3 of the review: what stood above the orders (the lead, New order or the limit, the Pay page) is the
   head of the list's column, so from 1080px the open order stands level with it at the top of the place */
.otop{margin:0 0 18px}
.olab{margin:18px 0 8px}
.olist .olab:first-child{margin-top:4px}
.olist .salt-inbox-row{margin:0 0 8px}
.olater{width:100%;margin-top:10px}
/* Counter Batch A (18 Oct 2026): the order card, the phone's filter row and the desk's two columns */
.ocard{display:flex;flex-direction:column;gap:12px;width:100%;margin:0 0 12px;padding:20px;text-align:left;font:inherit}
.ocard[aria-current]{border-color:var(--salt-brass)}
.ocard__top{display:flex;justify-content:space-between;align-items:center;gap:12px}
.ocard__when{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);color:var(--salt-mist-bright);white-space:nowrap}
.ocard__main{display:flex;align-items:center;gap:12px;min-height:var(--salt-tap)}
.ocard__main .mtile{flex:none}
.ocard__what{flex:1;min-width:0;font-size:var(--salt-text-sm);color:var(--salt-prose)}
.ocard__what.odue{color:var(--salt-ember)}
.ocard__total{font-family:var(--salt-font-mono);font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
.ocard--ended .ocard__total{color:var(--salt-mist-bright)}
.otabs{margin:0 0 16px}
.oempty{margin:0 0 12px}
.oempty .salt-ghost{min-height:var(--salt-tap)}
.ocols{display:grid;grid-template-columns:minmax(0,1fr);gap:8px 24px;align-items:start}
@media (min-width:860px){.olist{container-type:inline-size}}
@container (min-width:620px){.ocols{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ocol{min-width:0}
.ocol__head{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:var(--salt-tap)}
.ocol__head .olab{margin:0;display:inline-flex;align-items:center;gap:8px}
.ocol__n{color:var(--salt-mist-bright)}
.ocol__pay{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:0.12em;text-transform:uppercase;color:var(--salt-ember);white-space:nowrap}
.oback{margin:0 0 12px}
.adm .ohead{margin:0 0 16px;gap:18px;padding:20px}
.adm .ohead h3{margin:0;font-family:var(--salt-font-display);font-size:var(--salt-text-xl);letter-spacing:0;line-height:1.15}
.adm .ohead .sub2{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.adm .ohead .oband__what{flex:1;min-width:0;font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);color:var(--salt-mist-bright)}
.adm .osettled{color:var(--salt-verdigris)}
.odue{color:var(--salt-ember)}
/* the part of an order their reward paid: a line of its own under the part it belongs to (coverTo) */
.pcover{display:block;margin-top:2px}
.oact{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:16px}
.oact .salt-pill,.oact>.salt-ghost{width:100%;margin:0;min-height:var(--salt-tap)}
/* Counter Batch B: Order again, a Pill and today's figure on the order's screen, a ghost under the card in the list */
.oagain{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:16px}
.oagain .salt-pill{min-height:var(--salt-tap)}
.oagain p{margin:0}
.oagainrow{display:flex;flex-direction:column;gap:8px}
.oagainrow__go{align-self:flex-start;min-height:var(--salt-tap)}
.oact>.msg{grid-column:1/-1}
/* Counter Batch A: the band, the marked steps, Details */
.oband{margin:0 0 16px}
.oband__state{margin:0;font-family:var(--salt-font-display);font-size:1.75rem;font-weight:400;line-height:1.1;letter-spacing:0}
.oband .salt-band__foot .mtile{flex:none}
.oband__what{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.oband__what .sub2{margin:0}
.oband__point{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);color:var(--salt-mist-bright)}
.salt-steps--marks{margin:0 0 16px;--salt-steps-n:5}
.salt-steps--marks .salt-steps__name,.salt-steps--marks .salt-steps__time{white-space:nowrap}
.odet{margin-top:18px}
.odet__sum{display:flex;align-items:center;min-height:var(--salt-tap);cursor:pointer;list-style:none}
.odet__sum::-webkit-details-marker{display:none}
.omsgs{margin-top:22px}
.omsgs .olab{display:flex;justify-content:space-between;margin:0 0 10px}
.omsgs .salt-bubble__text{white-space:pre-wrap}
.osay{margin-top:var(--salt-space-3)}
.ohist,.ofoot{margin-top:18px}
/* F10: the stars, each a 44px target; a rating given is five marks, the given ones filled */
.orate h4{margin:18px 0 6px}
.rstars{display:flex;gap:4px;flex-wrap:wrap}
.rstars .rstar{min-width:var(--salt-tap);min-height:var(--salt-tap);padding:0;display:inline-flex;align-items:center;justify-content:center}
.rgave{display:flex;align-items:center;gap:2px;margin:18px 0 0}
.rgave .rtx{margin-left:8px}
.ohist ul{margin:0;padding:0;list-style:none}
.ofoot .salt-ghost{width:100%}
/* 12 OCT 2026 (PHASE 7d, his yes of 11 Oct 2026, item 9): THE LIST STANDS BESIDE THE OPEN ORDER FROM 860px, as Orders do on his page, and not from the rail's 1080px. Below 860px the open order is the
   whole tab. Between 860px and 1079px the App bar still stands fixed along the foot, so the order's own height gives up the bar's and its foot stays above it (it was 40px under it at 1024x768
   on his page), and the place takes the page's width where the other places keep their 620px column: Orders alone, which the shell marks on itself (data-place) */
@media (max-width:859.98px){#pOrder.o-open>:not(.oplace){display:none}.oplace.o-open>.olistcol{display:none}.oplace.o-open{margin-top:0}}
@media (min-width:860px){
  .oplace{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:28px;align-items:start}
  /* with no order to open beside it, the list takes the width (18 Oct 2026: the right column stood empty) */
  .oplace.oplace--one{grid-template-columns:minmax(0,1fr)}
  .oback{display:none}
  /* the open order stands still while the list scrolls beside it, its thread in reach inside it */
  .oscreen{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow-y:auto}
}
@media (min-width:860px) and (max-width:1079.98px){
  .oscreen{max-height:calc(100vh - 48px - var(--salt-bar-h) - env(safe-area-inset-bottom,0px))}
  #pOrder,.cshell[data-place=order] .chead{max-width:none}
}
/* 12 OCT 2026 (PHASE 7d, his yes of 11 Oct 2026, item 9): SHEETS ON A TABLET. The system's Sheet is a bottom sheet to 1079px and its 460px drawer from 1080px, so on a tablet
   a sheet ran edge to edge (a 1000px window drew a 1000px sheet). Here it is a centred 560px dialog from 768px to 859px and the same 460px drawer from 860px, the width the lists
   and panes turn on. Only placement is written (position, inset, width, how it arrives); colour, type, corners and surface stay the system's. The rules name .salt-sheet:not(.adm):
   the sheets of his page carry .adm and take the placement written for them further down. CANDIDATE FOR salt-ds: a dialog variant between 768 and 859px and the drawer's
   breakpoint at 860px, which would take this block out of the page. */
@media (min-width:768px) and (max-width:859.98px){
  .salt-sheet:not(.adm){top:50%;right:auto;bottom:auto;left:50%;width:min(560px,calc(100% - 32px));max-height:calc(100% - 64px);transform:translate(-50%,-50%);animation-name:salt-sheet-fade}
  .salt-sheet:not(.adm) .salt-sheet__grab{display:none}
}
@media (min-width:860px) and (max-width:1079.98px){
  .salt-sheet:not(.adm){top:0;left:auto;width:min(460px,100%);max-height:none;animation-name:salt-sheet-slide}
  .salt-sheet:not(.adm) .salt-sheet__grab{display:none}
  .salt-sheet:not(.adm) .salt-sheet__head{padding-top:var(--salt-space-5)}
}

@media print{.bar,.mos,.salt-appbar,.salt-rail{display:none}}
/* 11 OCT 2026: EVERY RULE FROM HERE TO THE GUEST LINK IS THE OWNER PAGE'S, AND SITS UNDER .adm, THE ROOT OF HIS PAGE (#roster).
   This stylesheet is the customer's and a guest board's too, so a rule of his with no .adm in front of it is a rule the customer's
   page is handed and the suite refuses it (the Counter's own stylesheet check). What stays outside .adm is what his page shares
   with the customer's: the system's recipes, the rail's name and place, the ring, the guest link's card, and the bar over an
   account he views as them, which stands in the customer's shell and not in his roster. */
.adm .rnone{color:var(--salt-text-muted);font-size:var(--salt-text-sm);margin:14px 0 0}
.adm .amain h1{margin-top:0}
/* FIVE PLACES (his decision of 11 Oct 2026): Needs you, Orders, Customers, Record, Shop. A place is a head (the eyebrow, its name,
   a line), its parts as the system's tab strip, and a body whose sections the parts show and hide. The body is a column, so a section
   a part has hidden leaves no gap behind it. */
.adm .aplace{min-width:0}
.adm #oOrders,.adm #oRecord{max-width:760px}
.adm .aparts{margin:0 0 20px}
.adm .aparts.salt-segment{max-width:30rem}
.adm .aparts .salt-tabs__pill{min-height:var(--salt-tap);min-width:var(--salt-tap)}
/* 18 OCT 2026 (clarity, part 3): Orders' stages are the first strip, the rest a smaller one beneath it; an order's card leads with its answer and folds the rest */
/* 25 Oct 2026 (canvas Salt Admin Orders): the parts are Needs you's text tab row (.nktab), two rows; the stages two across on a phone, the rest three */
.adm .oparts{padding:0;gap:0}
.adm .oparts .aparts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;margin:0;width:100%}
.adm .oparts--minor{margin:0 0 16px}
.adm .oparts--minor .aparts{grid-template-columns:repeat(3,minmax(0,1fr));gap:0 8px}
@media (min-width:860px){.adm .oparts .aparts,.adm .oparts--minor .aparts{grid-template-columns:repeat(6,minmax(0,1fr));gap:0 12px}}
.adm .ordend{display:flex;margin-top:16px}
.adm .ordlead{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}
.adm .ordlead:empty{display:none}
.adm .ordlead>.maker-field,.adm .ordlead>.salt-options{flex:1 1 100%}
/* 20 Oct 2026: a placed order's three moves in one row */
.adm .ordrow3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;flex:1 1 100%}
.adm .ordrow3>button{width:100%;min-height:44px;padding-left:8px;padding-right:8px;white-space:nowrap}
.adm .ordfold--rowed>summary{display:none}
.adm .ordfold>summary .salt-plan__title{grid-column:1 / -1}
.adm .ordfold__body>*+*{margin-top:12px}
.adm .abody{display:flex;flex-direction:column;gap:28px}
.adm .aplace input{max-width:100%}
.adm .maker-card{margin:14px 0}
.adm .maker-card:not(.salt-approve){padding:16px}
.adm .maker-card:not(.salt-approve)>*+*{margin-top:12px}
.adm .maker-say{margin-bottom:0;font-size:var(--salt-text-sm);line-height:1.6;color:var(--salt-text-muted);scroll-margin:24px 0 112px}
/* 13 Oct 2026 (stress): an answer drawn under the control that asked (Save, Make a link, Refresh) is scrolled to clear of the bar, as a card's own line is */
.adm .osaid{scroll-margin:24px 0 112px}
.adm .maker-card>.maker-say:empty{margin-top:0}
/* 12 OCT 2026 (PHASE 2c): a row to approve is the Approve recipe, whose own padding, gap and surface stand; the page adds only what its own column needs (no gap under an
   empty answer line) and the shut queue fold's body */
.adm .salt-approve>.maker-say:empty{display:none}
.adm #makerQueue .salt-plan__body>*+*{margin-top:12px}
.adm #makerQueue .salt-plan__body .maker-card{margin:12px 0 0}
/* 12 OCT 2026 (PHASE 2a): THE STAGE FOOT. The moves of the card's stage stand together at its foot, the filled one first and the quiet ones beside it, with
   the card's answer line under them; a foot with moves stays along the card's foot as it scrolls (the page's, clear of the App bar, or the card's own from 860px).
   The right gutter is the + orb's, which stands over the page at the corner. */
.adm .maker-foot{display:flex;flex-direction:column;gap:8px}
.adm .maker-foot.has{position:sticky;z-index:10;bottom:calc(var(--salt-bar-h) + env(safe-area-inset-bottom,0px) - 1px);margin:16px -4px -4px;padding:12px 76px 8px 4px;background:var(--salt-slate);border-top:1px solid var(--salt-line)}
.adm .maker-foot__acts{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.adm .maker-foot__acts:empty{display:none}
.adm .maker-foot__acts .btn{margin-top:0;width:auto;flex:1 1 11rem}
.adm .maker-foot .maker-say{margin:0}
@media (min-width:860px){.adm #makerReview .maker-foot.has{bottom:0}}
@media (min-width:1080px){.adm #makerReview .maker-foot.has{padding-right:4px}}
.adm .maker-queue-action{min-width:var(--salt-tap);min-height:var(--salt-tap)}
.adm .maker-fields{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:end}
/* 22 Oct 2026 (canvas Needs you): the Agree inputs two by two, Goods and Delivery, then When and Other across both */
.adm .maker-fields.oagree{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:end}
.adm .oagree>.maker-field{min-width:0}
.adm .oagree>.oagree__wide{grid-column:1/-1}
.adm .oagree>[hidden]{display:none}
.adm .oagree .salt-field__input{width:100%;min-width:0;box-sizing:border-box}
.adm .oagree>.salt-insight{margin:0}
.adm .ordrow3--two{grid-template-columns:repeat(2,minmax(0,1fr))}
.adm .maker-field{display:flex;flex:1 1 180px;flex-direction:column;min-width:150px}
.adm .maker-field .lbl{margin-top:0}
/* 12 OCT 2026 (PHASE 4a): the few, fixed choices of a form are the system's Option tiles (stmt/owner.js, makerTiles), a fieldset whose legend is the field's label.
   The recipe sets the tile, its 44px and its chosen edge; the page only gives the group the row to itself in a row of fields. */
.adm .maker-tiles{flex:1 1 100%;min-width:0}
.adm .maker-marks{grid-template-columns:repeat(auto-fill,minmax(88px,1fr))}
.adm .maker-marks .salt-option__face{justify-content:center}
.adm .maker-sizes{flex:1 1 100%;min-width:0}
.adm .maker-sizes .salt-options__grid{grid-template-columns:repeat(auto-fill,minmax(88px,1fr))}
.adm .maker-cover{display:flex;align-items:center;gap:10px;min-height:44px}
.adm .maker-cover input{width:44px;height:44px;min-width:44px;min-height:44px;accent-color:var(--salt-brass)}
.adm .maker-cover-row{display:flex;align-items:center;gap:10px}
.adm .maker-cover-row .maker-cover{flex:1 1 auto}
.adm .maker-cover-row button{flex:none;min-width:var(--salt-tap);min-height:var(--salt-tap)}
.adm .maker-drift-actions{display:flex;flex-wrap:wrap;gap:8px}
.adm .maker-drift-actions button{min-width:var(--salt-tap);min-height:var(--salt-tap)}
.adm .maker-pct-preview{margin-top:8px;min-width:0}
/* 16 OCT 2026: THE MINI LEDGER'S TABLES are the system's table in its scrolling wrap, so nine columns scroll inside their box on a phone and the page never does; a figure stands right, a word left. */
.adm #oLedger{display:flex;flex-direction:column;gap:24px}
.adm #oLedger .lead{margin:0}
.adm .ledgrp h2{margin:0 0 8px}
.adm .ledgrp .salt-table-wrap{min-width:0}
.adm .ledgrp .salt-table th,.adm .ledgrp .salt-table td{white-space:nowrap}
.adm .ledgrp .salt-table td.l,.adm .ledgrp .salt-table th.l{text-align:left}
.adm .ledgrp small{display:block;color:var(--salt-mist)}
.adm .ledgrp .rnone{margin:0}
/* 20 OCT 2026 (his word, canvas V63): THE WEEK CHART. A row a day, 44px, the name, a 00 to 24 track and the times; the open span a brass bar,
   a span past midnight's tail hatched at the start of the next day's row. A tapped day opens below its row on slate: Opens and Closes, then
   its quick buttons, every one 44px. */
.adm .maker-week{display:flex;flex-direction:column;gap:2px;margin:8px 0}
.adm .maker-week-scale,.adm .maker-day{display:grid;grid-template-columns:40px minmax(0,1fr) 136px;align-items:center;gap:12px;padding:0 8px}
.adm .maker-week-scale>span:nth-child(2){display:flex;justify-content:space-between;font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-mist-bright)}
.adm .maker-day{min-height:44px;width:100%;border:0;border-radius:var(--salt-radius-md);background:none;color:var(--salt-salt);font:inherit;text-align:left;cursor:pointer}
.adm .maker-day[aria-expanded=true]{background:var(--salt-glass)}
.adm .maker-track{position:relative;display:block;height:10px;border-radius:4px;background:var(--salt-well)}
.adm .maker-bar,.adm .maker-tail{position:absolute;top:0;bottom:0;border-radius:4px}
.adm .maker-bar{background:var(--salt-brass)}
.adm .maker-tail{background:repeating-linear-gradient(135deg,var(--salt-brass) 0 4px,transparent 4px 7px)}
.adm .maker-day-times{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adm .maker-day-times.off{color:var(--salt-mist-bright)}
.adm .maker-day-times sup,.adm .maker-plus1{color:var(--salt-brass);font-family:var(--salt-font-mono)}
.adm .maker-dayedit{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:var(--salt-radius-md);background:var(--salt-slate);border:1px solid var(--salt-line)}
.adm .maker-dayedit-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.adm .maker-dayedit-times{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:end;gap:12px}
.adm .maker-dayedit-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.adm .maker-dayedit-pick{display:flex;align-items:center;gap:8px}
.adm .maker-dayedit select{min-height:44px;width:100%;min-width:0}
.adm .maker-dayedit-acts{display:flex;flex-wrap:wrap;gap:8px}
.adm .maker-dayedit-acts button{min-height:44px;min-width:44px}
.adm .maker-dayedit-times>button{min-height:44px;min-width:44px}
.adm .maker-copy{display:flex;flex-wrap:wrap;gap:8px}
.adm .maker-copy button{min-height:44px;min-width:44px}
.adm .maker-dates{margin-top:16px}
.adm .maker-dayedit-acts input[type=date]{min-height:44px;min-width:0}
.adm .maker-facts{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm)}
.adm .maker-row{white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--salt-text-sm)}
.adm #makerBulletinCurrent{overflow-wrap:anywhere}
.adm .maker-slip{display:block;max-width:100%;height:auto}
/* 12 OCT 2026 (PHASE 2b): THE CLAIM CARD. A waiting claim is a row of the system's Inbox row and the one opened is its card under it. Its slip is a thumbnail
   that is itself the control (44px at least both ways), enlarged in place by a tap and shrunk by the next */
.adm #makerClaims{display:flex;flex-direction:column;gap:8px}
.adm #makerClaims .salt-inbox-row__title{gap:6px}
.adm #makerClaims .rnone{margin:0}
.adm .maker-slipbox{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
/* 20 Oct 2026: the delivery address on his order card, sealed or open */
.adm .adspot{padding:20px 24px;margin:12px 0 0;display:flex;flex-direction:column;gap:12px}
.adm .adspot>*,.adm .adspot__open>*{margin:0}
.adm .adspot__top{display:flex;justify-content:space-between;align-items:center;gap:12px}
.adm .adspot__open{display:flex;flex-direction:column;gap:12px}
.adm .adspot__acts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.adm .adspot__maps svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.6}
.adm .adspot__note:empty{display:none}
.adm .maker-slipbox>*{margin:0}
.adm .maker-slip-open{display:block;min-width:var(--salt-tap);min-height:var(--salt-tap);max-width:100%;padding:0;background:var(--salt-well);border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);overflow:hidden;line-height:0;cursor:zoom-in}
.adm .maker-slip-open .maker-slip{max-height:120px;width:auto}
.adm .maker-slipbox.open .maker-slip-open{width:100%;cursor:zoom-out}
.adm .maker-slipbox.open .maker-slip-open .maker-slip{max-height:none;width:100%}
/* 12 OCT 2026 (PHASE 4b): THE ONE UNLOCK. A place that needs it says Locked in the page's small line with the one Unlock beside it (44px, the ghost's own); a name put beside
   a code is quieter than the code and wraps under it when the row is narrow */
.adm .maker-lock{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.adm .maker-lock .msg{margin:0;min-height:0}
.adm .maker-name{margin-left:8px;font-weight:400;color:var(--salt-text-muted)}
/* S9 9.7: an ended admin sign-in leaves nothing on the page but the way back in (the class is set on the body by his script alone) */
body.ended>*:not(#aEnded){display:none}
/* S9 9.2: HIS OWN PAGE'S SHELL. The App bar and the Desk rail are the system's, and which one shows is the
   system's switch at 1080px; this page decides the column, the room kept clear above the bar, and where the
   open account stands: beside the list on a desk, in its place on a phone, with a way back. */
.gate.adm{max-width:600px;margin-top:32px;padding-bottom:calc(var(--salt-bar-h) + 32px + env(safe-area-inset-bottom))}
.adm .amain .salt-eyebrow{margin:0 0 6px}
.adm .aring{display:flex;width:36px;height:36px;align-items:center;justify-content:center;color:var(--salt-brass);
  border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);background:var(--salt-well)}
.adm .aring svg{width:22px;height:22px}
/* 18 Oct 2026: no rail of his carries a brand; the name stands in the Desk bar, the ring and the name, the clock under it */
.adm .abartext{display:flex;flex-direction:column;gap:6px;min-width:0;overflow:hidden}
/* 22 Oct 2026 (canvas Needs you, his words "a status with colour at the top end", "more vibrant glowing"): THE HOURS ARE A GLOWING STATUS CHIP at the
   bar's top right, a 44px button to Shop hours: verdigris Open, ember Closed, brass Paused (an override for now). Its dot breathes, and stands still
   under reduced motion. The bar is 12px all round, and under 820px what waits takes its row inside that padding. */
.adm .abar{padding:12px}
.adm .abar .salt-deskbar__brand{flex-wrap:nowrap;min-width:0}
.adm .abar .salt-deskbar__name{white-space:nowrap}
@container salt-deskbar (max-width:820px){.adm .abar .salt-deskbar__live{margin:0;padding:12px 0 0}}
.adm .ashop{--salt-status-tone:var(--salt-verdigris);flex:none;align-self:flex-start;margin:0 0 0 auto;display:inline-flex;align-items:center;min-height:var(--salt-tap);padding:0 12px;white-space:nowrap;cursor:pointer;
  background:color-mix(in srgb,var(--salt-status-tone) 16%,transparent);box-shadow:0 0 14px color-mix(in srgb,var(--salt-status-tone) 50%,transparent),inset 0 0 8px color-mix(in srgb,var(--salt-status-tone) 22%,transparent)}
.adm .ashop[hidden]{display:none}
.adm .ashop--closed{--salt-status-tone:var(--salt-ember)}
.adm .ashop--paused{--salt-status-tone:var(--salt-brass)}
.adm .ashop svg{fill:currentColor;filter:drop-shadow(0 0 4px var(--salt-status-tone));animation:ashopglow 2.4s ease-in-out infinite}
@keyframes ashopglow{50%{opacity:.45}}
@media (prefers-reduced-motion:reduce){.adm .ashop svg{animation:none}}
.salt-rail__tab .salt-appbar__place{color:inherit}
.adm #mFoot:empty{display:none}
.adm .afind{display:flex;flex-direction:column;gap:12px;margin:0 0 16px}
.adm .afil{display:flex;flex-wrap:wrap;gap:8px}
.adm .alist{display:flex;flex-direction:column;gap:8px}
.adm .alist .salt-inbox-row__title{gap:6px}
.adm .achips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
@media (min-width:1080px){
  .gate.adm{max-width:1180px;margin-top:0;display:grid;grid-template-columns:auto minmax(0,1fr);gap:20px;align-items:start;padding-bottom:48px}
  .adm .abar{grid-column:1/-1;margin-bottom:0}
  .adm .amain{flex:1 1 auto;min-width:0}
  .adm #oShop{max-width:760px}
}
@media (min-width:1440px){.gate.adm{max-width:1376px}.adm .nsplit{grid-template-columns:minmax(0,1fr) 420px}}
@media (max-width:1079.98px){
  /* the phone frame (28 Sep 2026): his shell starts at the body's 16px and clears the App bar by the same 16px; here,
     after the shell's own rule, or that rule would win */
  .gate.adm{margin-top:0;padding-bottom:var(--salt-bar-h)}
}
/* 12 OCT 2026 (PHASE 6, his decision 9 of 11 Oct): NEEDS YOU AND CUSTOMERS ARE A LIST AND A DETAIL FROM 860px, as Orders and Record are. The account a card is about
   (Needs you) or a row opened (Customers) stands in #nopen / #aopen beside the list, sticky and scrolling inside itself; nothing opens by itself, so until a tap the
   column says Choose a card to see it in full (.panenone, drawn only beside the list, and never beside an account that is open). Below 860px an account opened takes the list's place
   (Customers) or is not drawn (Needs you, whose Open then goes to Customers) */
.adm .panenone{display:none;margin:0}
/* 22 Oct 2026 (canvas Needs you): the open card beside the list is one glass, starting level with the first card (under the group's heading), 360px wide
   and 420px from 1440px, where the shell widens to 1376px as the canvas draws it */
.adm .npane{display:flex;flex-direction:column;gap:12px}
.adm .npane__title{margin:0;font-size:1.375rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adm .npane__what{display:flex;align-items:center;gap:8px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adm .npane__why{margin:0}
.adm .npane__body:empty{display:none}
.adm .npane__go{display:flex;gap:10px}
.adm .npane__go .nbtn{flex:1 1 0;min-width:0;height:48px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adm .npane-x:empty{display:none}
@media (max-width:859.98px){
  .adm #oAccts.open .afind,.adm #oAccts.open .alist,.adm #oAccts.open #scount{display:none}
  .adm #nopen{display:none}
}
@media (min-width:860px){
  .adm #oLinks,.adm #oCards{max-width:600px}
  .adm .nsplit,.adm .asplit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,440px);gap:20px;align-items:start}
  .adm #nopen,.adm #aopen{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow-y:auto}
  .adm #aopen .aback{display:none}
  .adm .nsplit{grid-template-columns:minmax(0,1fr) 360px}
  .adm #nopen{margin-top:calc(0.75rem * 1.4 + 10px);padding:20px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}
  .adm #nopen[hidden]{display:none}
  .adm .panenone{display:block}
  .adm #nopen:not([hidden])~.panenone,.adm #aopen:not([hidden])~.panenone{display:none}
}
/* 11 OCT 2026 (PHASE 1c, his decision 9): ORDERS ARE A LIST AND A DETAIL. A row an order (the system's Inbox row) in #makerOrderList, the order's
   card in #makerReview. From 860px they stand side by side, the card sticky and scrolling inside itself; below it the card takes the list's place
   and has its way back. From 860px up to the rail's 1080 the page widens for Orders alone, the other places keeping their 600px column. */
.adm .ordlist{display:flex;flex-direction:column;gap:8px}
.adm .ordlist .salt-inbox-row__title{gap:6px}
.adm .ordlist .rnone{margin:0}
.adm .ordlist>.salt-ghost{align-self:flex-start;margin-top:8px}
/* 21 Oct 2026 (canvas V39, his answer (a)): FROM 1080PX AN OPEN ORDER TAKES THE LIST'S PLACE, as on a phone, and fills the page; the rail's
   Orders closes it. This reverses his split of 11 Oct 2026 at that width: the list and the card stand side by side from 860 to 1080 only.
   From 1180 the card lays out in columns, two, then three from 1440 (decision, record, insight), filled by ordLayout in stmt/owner.js. */
@media (max-width:859.98px),(min-width:1080px){
  .adm #oSplit.open .ordlist,.adm #oSplit:not(.open) #makerReview,.adm #oSplit.open #makerReviewStatus{display:none}
}
@media (min-width:860px){
  .adm #oOrders{max-width:none}
  .adm #makerReview .aback{display:none}
}
@media (min-width:860px) and (max-width:1079.98px){
  .adm .ordgrid{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:20px;align-items:start}
  .adm #makerReview{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow-y:auto}
}
.adm .ordcols{display:grid;gap:20px;align-items:start}
.adm .ordcols--2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.adm .ordcols--3{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr) minmax(0,0.9fr)}
.adm .ordcol{display:flex;flex-direction:column;gap:12px;min-width:0}
/* in a column the row of three is Agree on its own line over Change terms and Decline, and three columns across, the band's goods total stands under the units */
.adm .ordcol .ordrow3{grid-template-columns:repeat(2,minmax(0,1fr))}
.adm .ordcol .ordrow3>:first-child{grid-column:1/-1}
.adm .ordcols--3 .ogoods{flex-wrap:wrap}
.adm .ordcols--3 .ogoods__sum{flex:1 1 100%;align-items:flex-start}
@media (min-width:860px) and (max-width:1079.98px){
  /* the App bar stays fixed along the foot until 1080px, so the sticky card's foot is kept above it (it was 40px under it at 1024x768) */
  .adm #makerReview{max-height:calc(100vh - 48px - var(--salt-bar-h) - env(safe-area-inset-bottom,0px))}
  .adm #nopen,.adm #aopen{max-height:calc(100vh - 48px - var(--salt-bar-h) - env(safe-area-inset-bottom,0px))}
  .gate.adm{max-width:none}
  .adm .amain>#oShop,.adm .amain>#unsentBar{max-width:600px;margin-left:auto;margin-right:auto}
}
/* 12 OCT 2026 (PHASE 6, his decision 9 of 11 Oct): A PORTRAIT TABLET, 768 to 859px, is the phone frame tidied. The column is 620px, centred (the shell's own auto margins), and a form's
   short fields (a number, a date or a time, which makerField marks .maker-field--short: units, price, date, delivery, cash) lie two up, everything else in the form across both
   columns. Needs you cards and order rows are not forms and keep one column: a card is read, not scanned. */
@media (min-width:768px) and (max-width:859.98px){
  .gate.adm{max-width:620px}
  .adm #unsentBar{max-width:none}
  .adm .maker-input{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px}
  .adm .maker-input>*{grid-column:1/-1}
  .adm .maker-input>.maker-field--short{grid-column:auto}
}
/* 12 OCT 2026 (PHASE 4a, his decision 3 of 11 Oct): RECORD'S FORM OPEN IS A PANE, as Orders' card is. The menu (and a retained input) is the column
   #makerFormGrid keeps in .reclist, the form open stands in .recpane beside it from 860px, sticky and scrolling inside itself; below it the form takes
   the menu's place and has its way back, and the pane's invitation is not drawn. From 860px up to the rail's 1080 the page widens for Record's forms
   as it does for Orders, the rows to approve keeping their 600px column. */
.adm .recgrid{display:block}
.adm .recpane>.rnone{margin:0}
@media (max-width:859.98px){
  .adm .recgrid.open .reclist,.adm .recnone{display:none}
}
@media (min-width:860px){
  .adm #oRecord{max-width:none}
  .adm #oOrders>.abody>#oApprove{max-width:600px}
  .adm .recgrid{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:20px;align-items:start}
  .adm .recgrid.open .recnone{display:none}
  .adm .recpane{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow-y:auto}
  .adm #makerFormBack{display:none}
}
@media (min-width:860px) and (max-width:1079.98px){
  .adm .recpane{max-height:calc(100vh - 48px - var(--salt-bar-h) - env(safe-area-inset-bottom,0px))}
}
/* 12 OCT 2026 (PHASE 6, his decision 9 of 11 Oct): FROM 1080px THE PAGE USES THE LAPTOP'S WIDTH. Shop is one column of 760px (it was 600), the rows to approve lie two up (the
   queue's fold, under them, keeps the whole width), and Messages stands the thread beside the thread list, sticky and scrolling inside itself, as Customers stands an account
   beside its list. Nothing opens by itself: the column beside the threads is empty until a tap. */
@media (min-width:1080px){
  .adm #oOrders>.abody>#oApprove{max-width:none}
  .adm #makerDrafts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
  .adm #makerDrafts>.maker-card{margin:0}
  .adm #makerDrafts>.rnone{grid-column:1/-1}
  .adm #makerDrafts>.aphead,.adm #makerDrafts>.apdone{grid-column:1/-1}
  .adm .chatgrid{display:grid;grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:0 20px;align-items:start}
  .adm .chatgrid>h2,.adm .chatgrid>#makerChatStatus{grid-column:1/-1}
  .adm #makerChatList{display:flex;flex-direction:column;gap:8px}
  .adm #makerChatOpen{position:sticky;top:24px;max-height:calc(100vh - 48px);overflow-y:auto}
}
/* 11 OCT 2026 (PHASE 1c, his decision 9): THE + ORB AND RECORD'S MENU. One raised orb stands over the page, above the App bar on a phone and in
   the corner from 1080px, below the bar and the sheets (z-index 40 against 50 and 70); the room kept under the last section on a phone is the
   orb's and its gap, so nothing is covered. Record's forms are rows of the system's Inbox row, one list a part. */
.adm #oAdd{position:fixed;right:16px;bottom:calc(var(--salt-bar-h) + 16px + env(safe-area-inset-bottom,0px));z-index:40}
@media (max-width:1079.98px){.adm .amain{padding-bottom:72px}}
/* 21 Oct 2026 (P10): from 1080px the + is the rail's own button under his places, and no orb floats over the page */
@media (min-width:1080px){.adm #oAdd{display:none}}
.adm .arailadd{margin-top:8px;padding-top:8px;border-top:1px solid var(--salt-line)}
.adm .formlist{display:flex;flex-direction:column;gap:8px}
.adm .formrow .salt-inbox-row__title{gap:6px}
/* 14 OCT 2026 (Record): a form row is the tap, no Open word; a row to approve opens its detail by a tap on the card, its head the control; its figures stand on one grid so they align down the cards; an offset is a row of a code, its figure and one Add */
.adm .formrow{min-height:44px}
.adm .apphead{min-height:44px;align-items:center}
.adm .aplink{min-height:44px;background:none;border:0;padding:0 4px;text-decoration:underline;color:var(--salt-brass)}
.adm .apverb{margin:0}
.adm .apnow{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.adm .apnow th,.adm .apnow td{text-align:right;padding:4px 0 4px 12px;font-weight:400}
.adm .apnow th:first-child{text-align:left;padding-left:0;color:var(--salt-text-muted)}
.adm .apnow thead th{color:var(--salt-text-muted);font-size:var(--salt-text-sm)}
.adm .apnow .apchg strong{font-weight:500;color:var(--salt-text)}
.adm .apflag{white-space:normal}
.adm .apbang{font-weight:500}
.adm .apfigs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:12px}
.adm .apcard .rdet--row{margin:0}
.adm .maker-offers__head{margin:16px 0 4px}
.adm .maker-offers{display:flex;flex-direction:column}
.adm .maker-offer{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:4px 12px;padding:8px 0;border-top:1px solid var(--salt-line)}
.adm .maker-offer__what{display:flex;flex-direction:column;gap:2px;min-width:0}
.adm .maker-offer__code{font-family:var(--salt-font-mono);font-weight:500;color:var(--salt-salt)}
.adm .maker-offer__fig{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);font-variant-numeric:tabular-nums}
.adm .maker-offer>.salt-ghost[hidden]{display:none}
/* 11 OCT 2026 (PHASE 1b): NEEDS YOU IS THE SYSTEM'S ACTION RECIPE, ranked Now, Soon, Watch. The recipe sets the card, its kind word and its
   colour (--salt-sev); this page decides only the title's parts, the actions beside each other, the gaps between cards, and the line a
   tap is answered on, which sits on the card it answers */
.adm #mHome .salt-eyebrow{margin:0 0 6px}
.adm .nlist{display:flex;flex-direction:column;gap:12px;margin:0 0 24px}
.adm .nlist .glink{margin:0}
.adm .ngroup{display:flex;flex-direction:column;gap:10px}
.adm #mHome .nlist .nsev{margin:0;line-height:1.4}
/* 22 Oct 2026 (canvas Needs you): the kinds' tab row, the Nav bar's link laid out as equal 48px tabs, the count in brass beside the word */
.adm .nkinds{margin:0 0 16px;padding:0;gap:0}
.adm .nkinds .nchips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 16px}
@media (min-width:860px){.adm .nkinds .nchips{grid-template-columns:repeat(6,minmax(0,1fr))}}
.adm .nktab{display:flex;align-items:center;justify-content:center;gap:8px;min-width:0;min-height:48px;margin:0;padding:0 12px;background:none;border:0;border-bottom:2px solid transparent;border-radius:10px 10px 0 0;cursor:pointer;white-space:nowrap;overflow:hidden}
.adm .nktab__n{color:var(--salt-brass)}
.adm .nktab:hover:not(:disabled),.adm .nktab:focus-visible{background:var(--salt-glass-hover);color:var(--salt-salt)}
.adm .nktab[aria-selected="true"]{border-bottom-color:var(--salt-brass);background:var(--salt-glass)}
.adm .nktab:disabled{opacity:.5;cursor:default}
/* 22 Oct 2026 (canvas Needs you, his "some of these cards are using unnecessary space"): THE GLANCE IS SINGLE-LINE KPI TILES, the label at the left and the
   figure at the right, no note, the value with no top margin so the row centres: Ready and To approve side by side, Receivables under them with the
   meter of what is paid of what is agreed between its label and its figure; from 860px one row of three, 56px tall. The Insight leads them. */
.adm .nlead{margin:0 0 12px}
.adm .nglance{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0 0 16px}
.adm .nglance[hidden]{display:none}
/* the tile is the system's one-line KPI tile (salt-kpi--line, 1.14.0); the page sets only that it is a link and where Receivables and its meter stand */
.adm .nkpi{box-sizing:border-box;text-decoration:none;color:inherit}
.adm .nkpi:hover,.adm .nkpi:focus-visible{border-color:var(--salt-line-strong)}
.adm .nkpi--owed{grid-column:1/-1;gap:16px}
.adm .nkpi .salt-meter{flex:1 1 auto;min-width:40px}
.adm .nkpi .salt-meter__track{display:block}
@media (min-width:860px){
  .adm .nglance{grid-template-columns:1fr 1fr 2.4fr;gap:12px}
  .adm .nkpi--owed{grid-column:auto}
}
/* 22 Oct 2026: the multi-tick Approve: a card's choice lights its edge, Reject in ember; the bar sticks above the app bar */
.adm .aphead{display:flex;align-items:center;justify-content:space-between;gap:12px}
.adm .aphead .salt-ghost,.adm .apticks button,.adm .apbar button,.adm .apmore{min-height:44px}
.adm .apticks{display:flex;gap:8px}.adm .apticks button{flex:1 1 0;padding:0 12px}
.adm .ap--a{border-color:var(--salt-verdigris)}.adm .ap--r{border-color:var(--salt-ember)}
.adm .apreject--on{color:var(--salt-ember);border-color:var(--salt-ember)}
.adm .aprefused{padding:12px;border-radius:12px;background:var(--salt-slate);border:1px solid var(--salt-ember);display:flex;flex-direction:column;gap:4px}
.adm .aprefused p{margin:0}
.adm .apdone{padding:16px;display:flex;flex-direction:column;gap:6px;border:1px solid var(--salt-verdigris)}
.adm .apdone__head{color:var(--salt-verdigris)}
.adm .apsheet--a{color:var(--salt-verdigris)}.adm .apsheet--r{color:var(--salt-ember)}
.adm .apbar{position:sticky;bottom:92px;z-index:5;margin-top:16px;padding:10px 12px;display:flex;align-items:center;gap:10px;border:1px solid var(--salt-line-strong)}
.adm .apbar[hidden]{display:none}
.adm .apbar__line{flex:1 1 auto;min-width:0}
@media (min-width:1080px){.adm .apbar{bottom:16px}}
/* 22 Oct 2026 (canvas Needs you): STOCK BY BOOK UNDER THE CARDS. On a phone one row a book on one glass: its typed tag and its light, Cover at the right;
   the meter of what is agreed of the shelf, ember once promised past it; Next lot alone on its line. From 860px a plain table on one glass, the columns
   in proportion and no sideways scroll. Nothing wraps. */
.adm .nstock{display:flex;flex-direction:column;gap:8px;margin:0 0 16px}
.adm .nstock[hidden]{display:none}
.adm .nstock__head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.adm .nstock__head .salt-eyebrow{margin:0}
.adm .nstock__list{padding:0 16px}
.adm .nstock__row{display:flex;flex-direction:column;gap:8px;padding:14px 0;min-width:0}
.adm .nstock__row+.nstock__row{border-top:1px solid var(--salt-line-faint)}
.adm .nstock__top{display:flex;align-items:center;justify-content:space-between;gap:12px;white-space:nowrap}
.adm .nstock__who{display:inline-flex;align-items:center;gap:8px;min-width:0}
.adm .nstock__cover,.adm .nstock__lot{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-mist-bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adm .nstock__cover b,.adm .nstock__lot b{color:var(--salt-salt);font-weight:500}
.adm .nstock .salt-meter__line{white-space:nowrap}
.adm .nstock .salt-meter__track{display:block}
.adm .nstock__table{display:none;padding:4px 6px;overflow:hidden}
.adm .nfree--neg{color:var(--salt-ember)}
@media (min-width:860px){.adm .nstock__list{display:none}.adm .nstock__table{display:block}}
.adm .nfail{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:0 0 12px}
.adm .nfail[hidden]{display:none}
.adm .nfail__what{margin:0;flex:1 1 12em}
.adm .need .salt-action__title{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px}
.adm .need .need-what{font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.adm .need .salt-action__body>*+*{margin-top:8px}
.adm .need .salt-action__go{display:flex;flex-wrap:wrap;gap:8px}
/* 22 OCT 2026 (canvas Needs you): THE CARD IS ONE SHAPE ON FIXED COLUMNS, the kind and age over the title in the first, the one pill in the second, the figure
   in the last, every card one height; nothing wraps, a long title ends in an ellipsis. A card that asks once, or runs a turn, grows and stands its row under the body. */
.adm .ncard{grid-template-columns:minmax(0,1fr) 72px 88px;gap:6px 8px;padding:12px;align-items:center;box-sizing:border-box;height:76px}
.adm .ncard>.nkind{grid-column:1;grid-row:1;padding-top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.adm .ncard>.salt-action__body{grid-column:1;grid-row:2;min-width:0}
.adm .ncard>.salt-action__go{grid-column:2;grid-row:1/3;display:flex;align-items:center;margin:0}
.adm .ncard>.salt-action__money.nfig{grid-column:3;grid-row:1/3;display:flex;align-items:center;justify-content:flex-end;width:auto;height:48px;padding:0;line-height:1;white-space:nowrap;overflow:hidden}
.adm .ncard .salt-action__title{flex-wrap:nowrap;gap:8px;min-width:0}
.adm .ncard .need-tap{flex-wrap:nowrap;min-height:0}
.adm .ncard .need-who{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.adm .ncard .need-who--code{font-family:var(--salt-font-mono)}
.adm .ncard .ntag{flex:none}
.adm .nage--late{color:var(--salt-ember)}
.adm .ncard .nbtn{box-sizing:border-box;width:72px;min-width:72px;max-width:72px;height:48px;min-height:48px;padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adm .ncard.need--grow,.adm .ncard:has(.nnote:not(:empty)){height:auto}
.adm .ncard.need--grow>.salt-action__go{grid-column:1/-1;grid-row:3;flex-wrap:wrap}
@media (min-width:860px){
  .adm .ncard{grid-template-columns:minmax(0,1fr) 120px 116px;gap:4px 12px;padding:13px 16px;height:80px}
  .adm .ncard .nbtn{width:120px;min-width:120px;max-width:120px;padding:0 8px}
}
/* 14 OCT 2026: THE CARD IS THE TAP. The title is the one button, stretched over the card; the card's own actions sit above it. The age is the money column, a fixed width,
   right-aligned and level with the kind word on every card; Soon and Watch fold behind a 44px heading. */
.adm .ncard{position:relative}
.adm .need .need-tap{all:unset;box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;width:100%;min-height:var(--salt-tap);cursor:pointer;font:inherit;color:inherit}
.adm .need .need-tap::after{content:"";position:absolute;inset:0}
.adm .need .need-tap:focus-visible{outline:none}
.adm .need .need-tap:focus-visible::after{outline:2px solid var(--salt-brass);outline-offset:2px;border-radius:inherit}
.adm .ncard:hover{background:var(--salt-glass-hover)}
.adm .need .salt-action__go{position:relative;z-index:1}
.adm .ncard[aria-current="true"]{box-shadow:inset 2px 0 0 var(--salt-brass)}
.adm .need .salt-action__money{width:4.5rem;justify-self:end;padding-top:0}
@media (max-width:860px){.adm .need .salt-action__kind{grid-column:1 / 2}}
.adm .nfold{display:flex;flex-direction:column;gap:12px}
.adm .nfold>summary.nsev{display:flex;align-items:center;min-height:var(--salt-tap);margin:0;cursor:pointer;list-style:none}
.adm .nfold>summary.nsev::-webkit-details-marker{display:none}
.adm .nfold>summary.nsev::before{content:"+";display:inline-block;width:1.2em}
.adm .nfold[open]>summary.nsev::before{content:"-"}
.adm .nfold>summary.nsev:focus-visible{outline:2px solid var(--salt-brass);outline-offset:2px}
/* 14 OCT 2026: ORDERS ARE ROWS OF ONE GRID: the mark in a fixed column, the code and at most one pill over what it is, the age over the figure in a fixed column on the
   right, every row the same height. The system's Inbox row keeps its class; the grid is this page's own container class. */
.adm .ordrow{display:grid;grid-template-columns:84px minmax(0,1fr) 88px;align-items:center;gap:0 12px;min-height:76px}
.adm .ordrow>.mtile{width:84px;padding-left:6px;padding-right:6px;box-sizing:border-box;align-self:center}
.adm .ordrow .salt-inbox-row__main{flex:none}
.adm .ordrow .salt-inbox-row__title{flex-wrap:nowrap}
.adm .ordrow .salt-inbox-row__what{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.adm .ordrow .salt-inbox-row__side{margin:0;align-items:flex-end;justify-content:center;text-align:right;gap:4px}
.adm .ordrow .salt-inbox-row__action{margin-top:0;font-variant-numeric:tabular-nums}
/* 14 Oct 2026: the live clock beside his page's name */
.adm .clk{font-variant-numeric:tabular-nums}
.adm .clk:not(:empty)::before{content:"\\00b7";margin:0 8px}
/* 19 Oct 2026, his word: THE BAR SAYS WHERE THINGS STAND, as the Desk's line does: a dot and Live or Offline, then Open or Closed off /hours, then the clock; a gap after the dot, as on the Desk */
.adm .abarlive{display:inline-flex;align-items:center;gap:6px;margin-right:12px}
.adm .abarlive i{width:6px;height:6px;border-radius:50%;background:currentColor;flex:0 0 auto}
.adm .abarlive.on{color:var(--salt-verdigris)}
.adm .abarlive.off{color:var(--salt-brass)}
/* 22 Oct 2026 (canvas Needs you): the quiet line keeps Live and the clock on a phone too */
@media (max-width:560px){.adm .abarlive{margin-right:8px}.adm .clk:not(:empty)::before{margin:0 6px}}
/* 12 OCT 2026 (PHASE 4c): THE UNSENT-ENTRY BANNER is the same recipe at Soon, over every place, in the column the places keep */
.adm #unsentBar{max-width:600px;margin:0 0 16px}
@media (min-width:861px){.adm .need--act .salt-action__go{grid-column:2 / -1}}
.adm .nnote{margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.adm .nnote:empty{display:none}
/* 20 Oct 2026: the order's band in four lines (the action, the goods, the way and moment, the minutes waited), the placed card's copper edge */
.adm .ohead--placed{box-shadow:inset 3px 0 0 var(--salt-copper)}
.adm .ogoods{display:flex;align-items:center;gap:14px}
.adm .ogoods__tile{width:52px;height:52px;flex:none;border-radius:14px;background:var(--salt-slate);border:1px solid var(--salt-line);display:flex;align-items:center;justify-content:center}
.adm .ogoods__what{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.adm .ohead .ogoods__what h3{font-size:1.75rem;line-height:1.05}
.adm .ogoods__who{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-mist-bright)}
.adm .ogoods__sum{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.adm .ogoods__total{font-family:var(--salt-font-mono);font-size:1.75rem;line-height:1.05;white-space:nowrap}
.adm .ogoods__label{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:0.1em;text-transform:uppercase;color:var(--salt-mist-bright)}
.adm .obandrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;padding-top:14px;border-top:1px solid var(--salt-line);font-size:var(--salt-text-sm);color:var(--salt-prose)}
.adm .oway,.adm .omoment{display:inline-flex;align-items:center;gap:8px}
.adm .omoment{font-family:var(--salt-font-mono)}
.adm .oband__icon{width:16px;height:16px;flex:none;fill:none;stroke:var(--salt-brass);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.adm .oway--link{min-height:44px;color:var(--salt-brass);text-decoration:underline;text-underline-offset:3px}
.adm .oclock__track{display:block}
.adm .obagain{display:inline-flex;align-items:center;gap:8px}
.adm .ordsteps{--salt-steps-n:5;padding:20px 12px}
/* 20 Oct 2026, P5: a sheet's orders in one group card, and the band's link to it */
.adm .ordsheet{padding:16px;display:flex;flex-direction:column;gap:10px;margin:0 0 12px}
.adm .ordsheet__head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.adm .ordsheet__age,.adm .ordsheet__sum{font-family:var(--salt-font-mono)}
.adm .ordsheet__line{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:0 4px}
.adm .ordsheet>.ordrow+.ordsheet__line{padding-top:8px;border-top:1px solid var(--salt-line)}
.adm .osheetlink{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:44px;margin:0;padding:6px 0 0;border:0;border-top:1px solid var(--salt-line);background:none;color:var(--salt-brass);font:inherit;font-family:var(--salt-font-mono);cursor:pointer}
/* 20 Oct 2026: the Bill, its figures in one right column */
.adm .obill{margin:16px 0 4px}
.adm .ordmoney .salt-ledger__label{flex:1;min-width:0}
.adm .ordmoney .salt-ledger__value{flex:none;min-width:6.5em;text-align:right;align-self:flex-start}
.adm .ordsteps .salt-steps__name,.adm .ordsteps .salt-steps__time{white-space:nowrap}
.adm .need-clock--late .oclock__min{color:var(--salt-ember)}
.adm .need-clock{margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.adm #makerConfirm{margin:16px 0 0}
.adm .cfig{margin:0;display:flex;align-items:baseline;gap:8px;font-family:var(--salt-font-mono)}
.adm .cfig b{font-size:2.25rem;font-weight:500;line-height:1}
.adm .nnote.bad{color:var(--salt-ember)}
/* THE ASSOCIATES REPORT CARD (v691): three figures across, then what they have earned in units
   with a bar for the part-unit. The bar is the only chart on this site and it is a rule and a
   fill, because a percentage of a unit is a proportion and nothing more. */
.adm .acard{padding:14px 16px;margin:12px 0 0}
.adm .acard.off{opacity:.55}
/* V5 (his answer of 29 Sep 2026): a locked account still sees Home and Rewards, greyed out and not to be tapped */
.lockd{opacity:.45;pointer-events:none;user-select:none}
.adm .acard .agrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.adm .acard .acell{min-width:0}
.adm .pbar{height:6px;margin:10px 0 6px;border:1px solid var(--salt-line);border-radius:999px;overflow:hidden;
  background:var(--salt-well)}
.adm .pbar i{display:block;height:100%;background:var(--salt-gradient)}
.adm #oCards h2{margin:22px 0 0;font-size:var(--salt-text-md)}
/* v696: the five stand above anything minted against a customer, each under its own line */
.adm .ghead{margin:18px 0 6px}
.adm .ghead:first-child{margin-top:4px}
/* THE TEST ACCOUNT (v689): its own small block under the items, quiet, because it is a thing he
   makes and unmakes rather than a place he goes. */
.adm .mtest{margin-top:18px;padding-top:14px;border-top:1px solid var(--salt-line)}
.adm .mtest p.lead{margin:0 0 10px;color:var(--salt-mist-bright);font-size:.875rem;line-height:1.6}
.adm .mtest .btn{margin-top:0}
/* S9 9.3: AN ACCOUNT, as a row opens it (the plan's f13): the code large and the username under it, the chips, the one
   filled Send a sign-in link across the column with its answer under it, the other ways two by two with theirs, the
   Sent tick, then how they got in. The two quiet ways that must not be tapped by accident are the system's danger ghost.
   S7 polish: its own name, .oacct. The customer's Account is .acct (S7 7.3), and this block's single column, coming
   after it, took that Account's two columns from 1080px when the stages were merged */
.adm .oacct{display:flex;flex-direction:column;gap:12px}
.adm .oacct .ahead h2{margin:0;font-size:var(--salt-text-2xl);line-height:1.15;overflow-wrap:anywhere}
.adm .oacct .ahead .un{display:block;margin-top:4px;font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);
  letter-spacing:.06em;color:var(--salt-text-muted)}
.adm .oacct .achips{margin:0}
.adm .oacct .atot{margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.adm .oacct .apill{width:100%;margin-top:4px}
.adm .agrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.adm .agrid .salt-ghost{width:100%;text-align:center}
.adm .anote{margin:0;font-size:var(--salt-text-sm);color:var(--salt-text-muted)}
.adm .anote:empty{display:none}
.adm .anote.bad{color:var(--salt-ember)}
/* 12 OCT 2026 (PHASE 2a): the tick's input is the tap, 44px both ways (his rule 6: a tap target is 44px, measured on the control, not on its label),
   laid unseen over the 18px box drawn beside it, which shows the state: a ring, filled with a mark when ticked. 13 OCT 2026 (stress): for every tick of his page (atick),
   not the account card's alone (For a friend, on Order for them, measured 102 by 19) */
.adm .atick{position:relative;display:flex;align-items:center;gap:0;align-self:flex-start;width:fit-content;min-height:var(--salt-tap);min-width:var(--salt-tap);padding-right:8px;
  font-size:var(--salt-text-sm);color:var(--salt-text-muted);cursor:pointer}
.adm .atick input{position:absolute;left:0;top:0;width:var(--salt-tap);height:var(--salt-tap);margin:0;opacity:0;cursor:pointer}
.adm .atick .tickbox{flex:none;box-sizing:border-box;width:18px;height:18px;margin:13px;border:2px solid var(--salt-text-muted);border-radius:4px}
.adm .atick input:checked+.tickbox{background:var(--salt-verdigris);border-color:var(--salt-verdigris)}
.adm .atick input:checked+.tickbox::after{content:"";display:block;width:4px;height:8px;margin:0 0 0 4px;border:solid var(--salt-ink-on-accent);border-width:0 2px 2px 0;transform:rotate(45deg)}
.adm .atick input:focus-visible+.tickbox{outline:2px solid var(--salt-brass);outline-offset:2px}
.adm .atick input:disabled+.tickbox{border-style:dashed}
.adm .atick input:disabled{cursor:not-allowed}
.adm .astory{display:flex;flex-direction:column;gap:6px;margin-top:8px}
/* S9 9.4: the phones and computers under their own head, the count at its end */
.adm .astory .dhead{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:14px}
.adm .astory .dcount{color:var(--salt-text-muted);letter-spacing:0}
/* the way back is a quiet line, not a second filled control: the page has one of those and it is
   the one that opens an account */
.adm .amain button[data-back]{display:inline-flex;align-items:center;min-height:var(--salt-tap);margin:0;padding:0;
  background:none;border:0;color:var(--salt-brass);cursor:pointer;text-align:left;
  font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.14em;text-transform:uppercase}
/* A GUEST LINK, as a card: who it is for leads, then the tier, then what it has done. The address
   is selectable text rather than a live link, because the thing he does with it is copy it. */
/* #glist as well: the door's rule for a glass card inside .gate (margin 0 0 4px) is more specific than .glink alone */
.glink,.adm #glist .glink{padding:14px 16px;margin:12px 0 0}
.glink.off{opacity:.5}
.glink h4{margin:0;font-size:var(--salt-text-md);font-weight:500}
.glink .gt{margin:0 0 6px}
.glink .gu{display:block;width:100%;margin:10px 0 0;padding:9px 11px;font-family:var(--salt-font-mono);
  font-size:var(--salt-text-xs);color:var(--salt-brass);background:var(--salt-well);
  border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);word-break:break-all}
.glink .gs{margin:8px 0 0;font-size:var(--salt-text-xs);color:var(--salt-text-muted);
  font-family:var(--salt-font-mono);letter-spacing:.04em}
.glink img{display:block;margin:12px auto 0;border-radius:var(--salt-radius-sm);width:180px;height:180px}
/* 14 OCT 2026 (the layout rework): a guest link is one row (summary), the address, QR and moves under it once opened; accounts are rows with one state; an associate's
   code has room beside its marks and its figures stand in a ledger; a customer's loans stand on their card as rows of figures */
.adm #glist .glink{padding:0;margin:8px 0 0}
.adm #glist .glink>*:not(summary){margin-left:16px;margin-right:16px}
.adm #glist .glink>.grow,.adm #glist .glink>.msg{margin-bottom:14px}
.adm #glist .glink>.gu{margin-top:0}
.adm #glist .glink>.gwho{margin-top:0;margin-bottom:0;font-size:var(--salt-text-sm);font-weight:400;color:var(--salt-text-muted)}
.adm #glist .glink img{width:150px;height:150px}
.adm .gsum{display:flex;flex-direction:column;justify-content:center;gap:2px;min-height:var(--salt-tap);padding:8px 16px;cursor:pointer;list-style:none}
.adm .gsum::-webkit-details-marker{display:none}
.adm .gsum::after{content:"";position:absolute;right:16px;width:7px;height:7px;border:solid var(--salt-text-muted);border-width:0 2px 2px 0;transform:rotate(45deg);top:20px}
.adm #glist .glink{position:relative}
.adm #glist .glink[open]>.gsum::after{transform:rotate(-135deg);top:24px}
.adm .gsum .gtop{display:flex;align-items:center;gap:8px;padding-right:20px}
.adm .gsum .gt{margin:0}
.adm .gsum .gs{margin:0;font-size:var(--salt-text-xs);color:var(--salt-text-muted);font-family:var(--salt-font-mono);letter-spacing:.04em}
.adm #glist .grow{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.adm #glist select{margin-top:12px}
.adm .alist .arow .salt-inbox-row__title{display:flex;align-items:center;gap:8px}
.adm .alist .arow .acode{font-family:var(--salt-font-mono);font-weight:500}
.adm .alist .arow .astate{margin-left:auto;text-align:right}
.adm .alist .arow .salt-inbox-row__what{overflow-wrap:anywhere}
.adm .acard .srow{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}
.adm .acard .srow .un{color:var(--salt-text-muted);font-size:var(--salt-text-sm)}
.adm .acard .aled{margin-top:8px}
.adm .acard .aled .salt-ledger__line{padding:4px 0}
.adm .acard .acell{display:flex;flex-direction:column;justify-content:space-between;gap:4px}
.adm .acard .aled .salt-ledger__value{text-align:right;white-space:nowrap}
.adm .abooks{display:flex;flex-direction:column;gap:8px}
.adm .abooks .salt-eyebrow{margin:6px 0 0}
.adm .aloans{display:flex;flex-direction:column}
.adm .aloan{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--salt-line)}
.adm .aloan:last-child{border-bottom:0}
.adm .aloan__txt{min-width:0}
.adm .aloan__what{margin:0;font-size:var(--salt-text-sm)}
.adm .aloan__fig{display:flex;gap:16px;margin-top:4px;font-size:var(--salt-text-sm)}
.adm .aloan__k{color:var(--salt-text-muted);margin-right:6px}
.adm .aloan__v{font-family:var(--salt-font-mono)}
.adm .aloan .salt-ghost{flex:none}
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
.adm .grow{display:flex;gap:8px;margin-top:12px}
.adm .grow .salt-ghost{flex:1}
/* 11 Oct 2026: THE LOOK, Night or Tide, chosen on each device. The sheet's two tiles are the system's Option face as a tap, each with a
   swatch of ITS OWN ground and accent, so a tile reads true under the other theme: these are the system's four swatch tokens (--salt-swatch-*, its
   obsidian and brass at Night and at Tide, the same under either theme and held equal to them by its contrast check), so this page writes no colour.
   The setting under Account is two of the system's ghosts, 44px both ways. */
.look-tile{flex-direction:column;align-items:stretch;gap:var(--salt-space-3);min-height:128px}
.look-swatch{display:block;height:56px;border-radius:var(--salt-radius-sm);border:1px solid var(--salt-edge-field)}
.look-swatch--night{background:radial-gradient(circle 14px at 70% 50%,var(--salt-swatch-night-accent) 0 13px,transparent 14px),var(--salt-swatch-night-ground)}
.look-swatch--tide{background:radial-gradient(circle 14px at 70% 50%,var(--salt-swatch-tide-accent) 0 13px,transparent 14px),var(--salt-swatch-tide-ground)}
.look-note{margin:var(--salt-space-3) 0 0;font-size:var(--salt-text-sm);color:var(--salt-prose)}
.lookset{width:min(100%,15rem)}
.adm #vaultState{align-self:center;font-size:var(--salt-text-sm);color:var(--salt-prose)}
.adm.vaultsheet .salt-sheet__body > * + *{margin-top:14px}
.adm.vaultsheet .salt-sheet__foot{flex-direction:column;align-items:stretch}
.adm.vaultsheet .salt-sheet__foot .btn,.adm.vaultsheet .salt-sheet__foot .salt-ghost{width:100%}
/* 12 OCT 2026 (PHASE 6, his decision 9 of 11 Oct): SHEETS ON A TABLET. The system's Sheet is a bottom sheet to 1079px and its 460px drawer from 1080px; on his page
   a sheet is a centred 560px dialog from 768px to 859px and the same 460px drawer from 860px (a landscape iPad). Only placement is written here (position, inset, width,
   how it arrives), and the colour, type, corners and surface stay the system's (the dialog keeps the bottom sheet's rounded top and square foot). The sheets of this page carry .adm beside
   .asheet (its Sheets are appended to the body, outside #roster), and the customer's carry neither. CANDIDATE FOR salt-ds: a dialog variant between 768 and 859px and
   the drawer's breakpoint at 860px, which would take this whole block out of the page. */
@media (min-width:768px) and (max-width:859.98px){
  .adm.asheet{top:50%;right:auto;bottom:auto;left:50%;width:min(560px,calc(100% - 32px));max-height:calc(100% - 64px);transform:translate(-50%,-50%);animation-name:salt-sheet-fade}
  .adm.asheet .salt-sheet__grab{display:none}
}
@media (min-width:860px) and (max-width:1079.98px){
  .adm.asheet{top:0;left:auto;width:min(460px,100%);max-height:none;animation-name:salt-sheet-slide}
  .adm.asheet .salt-sheet__grab{display:none}
  .adm.asheet .salt-sheet__head{padding-top:var(--salt-space-5)}
}
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
  oil: 'M12 2.6 C12 2.6 20 8.6 20 13.4 A8 8 0 0 1 4 13.4 C4 8.6 12 2.6 12 2.6 Z',
  /* v779, his choice of 22 Sep 2026. A rhombus for the one and a seamed capsule for the other,
     drawn in the same hairline stroke as the cube and the droplet. The capsule carries its seam
     for the reason the cube carries its three inner edges: without it a stadium is a shape and
     with it it is a thing. Neither is literal, and neither is a word.
     HIS REDRAW OF 28 SEP 2026 (F8): EVERY MARK FILLS THE SAME SQUARE, 2.6 to 21.4 about the centre (12, 12), so the
     row reads as one set and a letter sits alike in each: the rhombus made square, the droplet rounder, the capsule
     turned to the diagonal (a level one is twice as wide as it is tall), the ring larger; the cube as it was. The
     capsule's ends are written a hair under half their chord, which a browser scales up to it, so each is an exact
     semicircle through its rounded ends and the capsule meets the square's sides. */
  candy: 'M12 2.6 L21.4 12 L12 21.4 L2.6 12 Z',
  rice: 'M12.84 19.64 L19.64 12.84 A5.99 5.99 0 0 0 11.16 4.36 L4.36 11.16 A5.99 5.99 0 0 0 12.84 19.64 Z M7.76 7.76 L16.24 16.24'
};
const RING = 'M12 3.4 A8.6 8.6 0 1 1 11.99 3.4 Z';
/* A CONTROL STILL NEEDS A NAME, and the name is the SHAPE, never the product. A button holding
   only a decorative mark is unusable with a screen reader; an aria-label naming the product would
   put the word back for exactly the readers who cannot see that it was taken away. The shape is
   what is on the screen, so saying it aloud gives away no more than looking does. */
export const PSHAPE = { salt: "Cube", oil: "Droplet", candy: "Lozenge", rice: "Capsule", _: "Ring" };
/* ---- F8, HIS ANSWERS OF 28 SEP 2026 ("everywhere", then "Yes everywhere", the statement and the guest board included):
   A LETTER OF HIS IN EVERY BOOK'S MARK, WHEREVER IT IS DRAWN ----
   None is its product's initial, in English, and together they spell no product word: a letter names nothing
   and the mark is still the thing. psymSvg and the page's psym draw it always (v913's `lettered` switch is retired), and no
   mark is drawn under 20 px, where the letter, a third of the mark, would be too small to read. The spare book and any
   product with no letter keep the Ring, bare, and the aria stays the shape. */
export const PLET = { salt: "I", oil: "G", candy: "E", rice: "V" };
/* EVERY LETTER THE SAME SIZE ON THE SAME LINE (his redraw of 28 Sep 2026): the mono face (.plet) at size 8 in the 24
   grid, its capitals centred on the mark's centre, so the baseline sits half a capital (0.73 of the size) below 12. */
const PLET_AT = { y: 14.92, s: 8 };
/* THE MARK GIVES ITS LETTER ROOM where a line would cross it: the cube's three inner edges stop at radius 5 from its
   centre, and the capsule's seam gives way. Every other mark is drawn as it is everywhere. His drawing, approved. */
const PLET_ROOM = {
  salt: "M12 2.6 L20.6 7.3 L20.6 16.7 L12 21.4 L3.4 16.7 L3.4 7.3 Z M16.39 9.6 L20.6 7.3 M7.61 9.6 L3.4 7.3 M12 17 L12 21.4",
  rice: "M12.84 19.64 L19.64 12.84 A5.99 5.99 0 0 0 11.16 4.36 L4.36 11.16 A5.99 5.99 0 0 0 12.84 19.64 Z"
};
/* one letter's drawing, its letter and place beside it, for the page's script; null for a product with none */
const pletOf = (k) => (Object.hasOwn(PLET, k) && Object.hasOwn(PSYM, k)
  ? { l: PLET[k], d: Object.hasOwn(PLET_ROOM, k) ? PLET_ROOM[k] : PSYM[k], y: PLET_AT.y, s: PLET_AT.s } : null);
/* THE SHORT MONTHS, NAMED ONCE (24 Sep 2026). Node and every browser write "Sept" for September in en-GB, and
   the house writes Sep: the page, his page, the statement and the price list all read the month from here. */
export const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/* S4 4.9, 24 SEP 2026: ONE DELIVERY SENTENCE, wherever the charge is explained (the plan's words, his "all recommended"):
   Prices, the check before Place, and a guest's board. It replaces three wordings, one of which ("quoted when you order")
   was never true: the charge is set when he confirms the order, and only then. */
export const DELIVERY = EN["deliv"];
/** The mark for a product, as SVG source, his letter in it (F8). `px` is the drawn size, 20 and over; the stroke stays
 *  hairline. The page's psym is its twin. */
export function psymSvg(product, px) {
  const k = String(product || "").toLowerCase(), L = pletOf(k);
  const d = L ? L.d : PSYM[k] || RING;
  return '<svg class="psym" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false">'
    + '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>'
    + (L ? '<text class="plet" x="12" y="' + L.y + '" font-size="' + L.s + '" text-anchor="middle" fill="currentColor">' + L.l + "</text>" : "")
    + "</svg>";
}
/** IN A CARD THE MARK IS A BUTTON WITH ITS CAPTION UNDER IT (his note of 28 Sep 2026): the size in words, "2.5 units", drawn, and
 *  a reader told the shape and the size once (`.sr`). No shape word is drawn (his word of 12 Oct 2026: the mark stands alone).
 *  The statement's lines are cards too; the page's mtile is its twin. */
export function mtileSvg(product, said, px) {
  return '<span class="mtile"><span class="sr">' + esc(PSHAPE[String(product || "").toLowerCase()] || PSHAPE._) + " " + esc(said)
    + "</span>" + psymSvg(product, px || 28) + '<span class="mq" aria-hidden="true">' + esc(said) + "</span></span>";
}

/** A size in words, units above one and unit at one (S4). The one copy: a guest's board calls it here, and the page's own
 *  script is served its source, so the two cannot drift apart. */
export function unitsOf(q, u) { return unitsIn(EN["unit.one"], EN["unit.many"], q, u); }

/* ---- THE MARKS A SCREEN DRAWS BESIDE ITS WORDS (S3, 24 Sep 2026) ------------------------------------
   The app's ring, the three things inside it, and the phone's own controls (the menu's dots, Share, Add to
   Home Screen, Paste, an install mark), drawn inline in the product marks' own hairline manner and never
   loaded, so a phone set to another language still matches the picture. */
/* THE APP'S OWN RING is not the spare book's: the mark on the door, the link page, One step to finish and the rail keeps
   the proportion of the home-screen icon (tools/stmt-icon.mjs), and his redraw of 28 Sep 2026 grew the book's Ring alone */
const APP_RING = 'M12 4.2 A7.8 7.8 0 1 1 11.99 4.2 Z';
const GLYPH = {
  ring: APP_RING,
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
  /* Step 1b: the bell in the saved app's header */
  bell: "M12 4.2 A5.4 5.4 0 0 1 17.4 9.6 V13.8 L19.2 17 H4.8 L6.6 13.8 V9.6 A5.4 5.4 0 0 1 12 4.2 Z M10 19.2 A2 2 0 0 0 14 19.2",
  star: "M12 3.6 L14.5 9 L20.3 9.6 L15.9 13.5 L17.2 19.3 L12 16.3 L6.8 19.3 L8.1 13.5 L3.7 9.6 L9.5 9 Z",
  /* Counter Batch C: a Help row's chevron, turned down while it is open */
  next: "M9 5.5 L15.5 12 L9 18.5",
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

/* S3 3.10: OPTIONAL HOME SCREEN INSTALL. A browser session can be used as-is. In Account > This device,
   the optional install guide carries an iPhone's sign-in across to the app's separate storage. */
function keepPage() {
  return '<section id="keepCard" class="keeppage" aria-labelledby="keepHead" hidden>'
    + wt("h3", 'id="keepHead"', "keep.h")
    + wt("p", 'class="lead" id="keepLead"', "keep.lead")
    + '<div id="keepIos" hidden><ol class="keepsteps">'
    + "<li>" + wt("span", "", "keep.s1", 22) + "</li>"
    + "<li>" + wt("span", "", "keep.s2", 22) + "</li>"
    + "<li>" + wt("span", "", "keep.s3", 22) + "</li></ol>"
    + '<div class="salt-code">' + wt("label", 'class="salt-code__label" for="keepCode"', "keep.code")
    + '<input class="fld salt-field__input salt-field__input--code" id="keepCode" type="text" readonly value="" aria-describedby="keepHint">'
    + wt("span", 'class="salt-code__hint" id="keepHint"', "keep.small") + "</div>"
    + wt("button", 'class="btn salt-pill salt-pill--md" id="keepCopy" type="button" disabled', "code.copy")
    + '<p class="msg" id="keepMsg" role="status" aria-live="polite"></p></div>'
    /* S3 3.12: the browser's own Install where it offers one; else that browser's own marks, drawn */
    + wt("button", 'class="btn salt-pill salt-pill--md" id="keepInstall" type="button" hidden', "keep.install")
    + wt("p", 'class="kline" id="keepSam" hidden', "keep.sam", 22)
    + wt("p", 'class="kline" id="keepDesk" hidden', "keep.desk", 22)
    /* S3 fix: an Android browser that offers no install, or whose offer was turned down, is shown its own menu's mark */
    + wt("p", 'class="kline" id="keepDroid" hidden', "keep.droid", 22)
    + "</section>";
}
/* S7 7.3: THIS DEVICE, in Account, ONE CARD: its notifications (drawDevice, where the bell's plain tap lands), the Look, signing
   out of this one, the customer's one Log out (#lock), then the account's phones and computers with Sign in another device and
   Sign out other devices in #devSlot (S9 9.9, drawDev) and the optional Home Screen install guide. 11 Oct 2026 (Phase 7d part 2):
   the card sits above the statement, so what a device is asked for is first and Sign out is within a thumb of the top; every
   control keeps its id, request and behaviour. Sign out is a tap and a tap again (the page's script, lockEl). */
/* COUNTER BATCH C (20 Oct 2026, item 17): HELP under Account, after This device, four questions each a native details row on
   the order's own fold pattern, its summary 44px with the chevron, closed until tapped; the answers as he approved them. On every
   customer's Account, the test accounts' included; never on Salt Admin's Account.
   21 Oct 2026 (Salt Admin A to C, P8): owner true draws the same four, read only, on Salt Admin's Shop > Hours, so he reads what the
   customer is told beside the hours that answer it; the words are the same keys, nothing there edits them. */
function helpCard(owner) {
  const row = (k) => '<details class="ahelp__q"><summary class="ahelp__sum"' + (owner ? ' data-act="shop.help.' + k + '"' : "") + ">" + wt("span", 'class="ahelp__t"', "help." + k) + glyphSvg("next", 18) + "</summary>"
    + wt("p", 'class="ahelp__a"', "help." + k + "A") + "</details>";
  const head = owner ? '<h2 id="mHelpH">Help</h2><p class="lead">What a customer reads under Account, Help. Read only.</p>'
    : wt("h2", 'class="salt-eyebrow salt-eyebrow--copper" id="helpH"', "help.h");
  return '<section id="' + (owner ? "mHelp" : "aHelp") + '" class="ahelp' + (owner ? "" : " salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm")
    + '" aria-labelledby="' + (owner ? "mHelpH" : "helpH") + '"' + (owner ? ' data-in="shop.hours"' : "") + ">"
    + head + ["pay", "deliv", "coll", "change"].map(row).join("") + "</section>";
}
function thisDevice() {
  return '<section id="thisDevice" class="devcard salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm" aria-labelledby="devH" hidden>'
    + wt("h2", 'class="salt-eyebrow salt-eyebrow--copper" id="devH"', "dev.h")
    + '<div id="devRows" class="salt-ledger salt-ledger--plain"></div>'
    + lookRow()
    + wt("button", 'type="button" class="salt-ghost devout" id="lock" aria-live="polite"', "dev.out")
    + '<div id="devSlot"></div>' + keepPage()
    + "</section>";
}
/* 11 Oct 2026, HIS WORD: THE LOOK. Under Account, in This device, a customer changes Night or Tide for this device: two ghosts, the
   held one aria-pressed, applied at once with no reload. The page opens Tide until a device chooses (LOOK_HEAD). */
function lookRow(owner) {
  /* 11 Oct 2026: Salt Admin draws the same row in Shop, This device, and its controls carry the acts the owner's page names every
     control by (docs/STATEMENTS.md); the customer's row is drawn as it was, with none */
  const act = (a) => (owner ? ' data-act="' + a + '"' : "");
  return '<div id="lookRow" class="salt-ledger salt-ledger--plain"><div class="salt-ledger__row"><div class="salt-ledger__line">'
    + wt("span", 'class="salt-ledger__label" id="lookH"', "look.h")
    + '<span class="salt-ledger__value lookset salt-segment" role="group" aria-labelledby="lookH">'
    + wt("button", 'type="button" class="salt-segment__opt salt-segment__opt--active" data-look="night" aria-pressed="true"' + act("look.night"), "look.night")
    + wt("button", 'type="button" class="salt-segment__opt" data-look="tide" aria-pressed="false" disabled' + act("look.tide"), "look.tide")
    + "</span></div></div></div>";
}
/* 12 Oct 2026 (PHASE 4b, his decision 3 of 11 Oct): THE ONE UNLOCK of Salt Admin, owner only. Shop > This device holds its state and its Unlock or Lock; the Sheet is
   the one field (stmt/owner.js, makerVaultUnlock), opened from here and from every place that says Locked. The field is never in a form and never remembered. */
function vaultRow() {
  return '<div id="vaultRow" class="salt-ledger salt-ledger--plain"><div class="salt-ledger__row"><div class="salt-ledger__line">'
    + '<span class="salt-ledger__label" id="vaultH">Names and places</span>'
    + '<span class="salt-ledger__value lookset" role="group" aria-labelledby="vaultH"><span id="vaultState" role="status">Locked</span>'
    + '<button type="button" class="salt-ghost" id="vaultOn" data-act="vault.unlock">Unlock</button>'
    + '<button type="button" class="salt-ghost" id="vaultOff" data-act="vault.lock" hidden>Lock</button></span></div></div>'
    + '<span class="salt-ledger__flag">One password opens names, places and slips. Seen on this phone only; they lock again when the page is hidden.</span></div>';
}
/* 19 Oct 2026 (docs/plan-notifications.html section 3): SALT ADMIN'S OWN NOTIFICATIONS, owner only, Shop > This device. A tap turns them on (the
   browser's question is asked from that tap alone) and a second control turns them off; the state is what this phone holds. Never on the test surface. */
function alertRow() {
  return '<div id="alertRow" class="salt-ledger salt-ledger--plain"><div class="salt-ledger__row"><div class="salt-ledger__line">'
    + '<span class="salt-ledger__label" id="alertH">Notifications</span>'
    + '<span class="salt-ledger__value lookset" role="group" aria-labelledby="alertH"><span id="alertState" role="status">Off</span>'
    + '<button type="button" class="salt-ghost" id="alertOn" data-act="alerts.on">Turn on</button>'
    + '<button type="button" class="salt-ghost" id="alertOff" data-act="alerts.off" hidden>Turn off</button></span></div></div>'
    + '<span class="salt-ledger__flag" id="alertNote">Salt Admin rings this phone for what waits on your decision. Asked only when you tap.</span></div>';
}
function vaultSheet() {
  return '<div id="vaultScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="vaultSheet" class="salt-sheet adm asheet vaultsheet" role="dialog" aria-modal="true" aria-labelledby="vaultT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head"><h2 class="salt-sheet__title" id="vaultT">Unlock names and places</h2>'
    + '<button type="button" class="salt-orb salt-sheet__close" id="vaultX" data-act="vault.close"' + wl("x.close") + ">" + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body"><p class="lead">One password opens names, places and slips. They are seen on this phone only, and lock again when the page is hidden.</p>'
    + '<label class="maker-field"><span class="lbl salt-field__label">Password for names and places</span>'
    + '<input class="fld salt-field__input" id="vaultPass" type="password" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" data-act="vault.passphrase"></label>'
    + '<p class="msg" id="vaultSay" role="status" aria-live="polite"></p></div>'
    + '<div class="salt-sheet__foot"><button type="button" class="btn salt-pill salt-pill--md" id="vaultGo" data-act="vault.open">Unlock</button>'
    + '<button type="button" class="salt-ghost" id="vaultKeep" data-act="vault.cancel">Not now</button></div></div>';
}
/* The choice Sheet, over a signed-in page on a device that has chosen nothing: the system's Sheet, its two tiles the Option face as a
   tap, each with a swatch of its own ground and accent, and one line saying where to change it. The script opens it (lookAsk). */
function lookSheet(owner) {
  const act = (a) => (owner ? ' data-act="' + a + '"' : "");
  const tile = (k) => '<div class="salt-option"><button type="button" class="salt-option__face salt-option__face--tap look-tile" data-look="' + k + '"' + act("look.sheet-" + k) + ">"
    + '<span class="look-swatch look-swatch--' + k + '" aria-hidden="true"></span><span class="salt-option__text">'
    + wt("span", 'class="salt-option__label"', "look." + k) + "</span></button></div>";
  return '<div id="lookScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="lookSheet" class="salt-sheet' + (owner ? " adm asheet" : "") + '" role="dialog" aria-modal="true" aria-labelledby="lookT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head">' + wt("h2", 'class="salt-sheet__title" id="lookT"', "look.sheetH")
    + '<button type="button" class="salt-orb salt-sheet__close" id="lookX"' + act("look.sheet-close") + wl("x.close") + ">" + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body"><div class="salt-options__grid salt-options__grid--2">' + tile("night") + tile("tide") + "</div>"
    + (owner ? '<p class="look-note">You can change this later under Shop, in This device.</p>' : wt("p", 'class="look-note"', "look.note")) + "</div></div>";
}
/* Step 1b (his Q3, his sentences 3.1 and 3.3): THE BELL, in the saved app's header on every view. Until notifications
   are on it is marked and its call sits beside it; a tap on either asks (the ask is still a tap: iOS requires one).
   Once on, the call goes and the bell stays, plain, opening This device's notifications row */
function bellBox() {
  return '<div id="bellBox" class="cbell" hidden>'
    + wt("button", 'type="button" class="salt-pill salt-pill--sm" id="bellCall"', "bell.call")
    + '<button type="button" class="salt-orb cbell__orb" id="bell"' + wl("bell.off") + ">" + glyphSvg("bell", 22)
    + '<span class="cbell__dot" aria-hidden="true"></span></button></div>';
}
/* refused on this phone: its own Settings steps, and the bell to tap again once they are on */
function bellSheet() {
  return '<div id="bellScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="bellSheet" class="salt-sheet" role="dialog" aria-modal="true" aria-labelledby="bellT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head">' + wt("h2", 'class="salt-sheet__title" id="bellT"', "bell.h")
    + '<button type="button" class="salt-orb salt-sheet__close" id="bellX"' + wl("x.close") + ">" + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body">' + wt("p", "", "bell.lead")
    + wt("p", 'id="bellIos" hidden', "bell.ios") + wt("p", 'id="bellDroid" hidden', "bell.droid") + wt("p", 'id="bellDesk" hidden', "bell.desk") + "</div>"
    + '<div class="salt-sheet__foot">' + wt("button", 'class="btn salt-pill salt-pill--md" id="bellDone" type="button"', "bell.done") + "</div>"
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
/* Step 7: THE ACCOUNT'S THREAD, in a Sheet of its own: the lines as a log, the composer at its foot */
function threadSheet() {
  return '<div id="thScrim" class="salt-sheet-scrim" hidden></div>'
    + '<div id="thSheet" class="salt-sheet thsheet" role="dialog" aria-modal="true" aria-labelledby="thT" tabindex="-1" hidden>'
    + '<div class="salt-sheet__grab"></div>'
    + '<div class="salt-sheet__head">' + wt("h2", 'class="salt-sheet__title" id="thT"', "th.title")
    + '<button type="button" class="salt-orb salt-sheet__close" id="thX"' + wl("x.close") + ">" + glyphSvg("close", 20) + "</button></div>"
    + '<div class="salt-sheet__body" id="thBody"><div class="salt-thread"><div class="salt-thread__lines" id="thLog" role="log"' + wl("th.aria") + "></div></div></div>"
    + '<div class="salt-sheet__foot"><form class="salt-composer" id="thForm">'
    + '<input class="salt-field__input salt-composer__field" id="thIn" type="text" maxlength="200" autocomplete="off" enterkeyhint="send"'
    + ' placeholder="' + esc(EN["th.ph"]) + '" data-wp="th.ph"' + wl("th.ph") + ">"
    + wt("button", 'class="salt-ghost salt-ghost--lit salt-composer__send" type="submit"', "msg.send") + "</form>"
    + '<p class="msg" id="thSaid" role="status" hidden></p></div>'
    + "</div>";
}
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
  return '<div id="codeBox" class="gate" hidden>'
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
  return '<div id="link" class="gate" hidden>'
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
  const rm = (n) => "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });   /* C5 */
  const body = products.length
    ? products.map((p) => '<div class="pane salt-glass-card salt-glass-card--radius-md">'
        + '<h2 class="pmark" aria-label="' + esc(PSHAPE[String(p.product || "").toLowerCase()] || PSHAPE._) + '">' + psymSvg(p.product, 30) + "</h2>"
        + '<div class="tblw"><table><thead><tr><th class="l">' + wd("board.size") + "</th><th>" + wd("board.price") + "</th></tr></thead><tbody>"
        + p.sizes.map((r) => "<tr><td class=\"l\">" + esc(unitsOf(r.q, p.unit))
            + "</td><td>" + esc(rm(r.price)) + "</td></tr>").join("")
        + "</tbody></table></div></div>").join("")
    : '<p class="lead">' + wd("board.none") + "</p>";
  /* C21 (29 Sep 2026): a guest page opens on its h1, and each board's mark is an h2 under it */
  return guestPage('<h1 class="gh">' + wd("board.h") + "</h1>"
    + (products.length ? '<p class="lead">' + (week ? fillHtml(EN["board.week"], { w: esc(week) }, "en") + " " : "")
      + wd("board.goods") + " " + wd("deliv") + " "
      + wd("board.ask") + "</p>" : "")
    + body
    /* S8 8.2: A STRANGER IS TOLD WHAT TO DO NEXT, in words and with no brand. The board is all they
       have, and it named no way to order. */
    + '<p class="lead">' + wd("board.next") + "</p>", nonce, esc(EN["board.h"]));
}
/* S8 8.2: EVERY SHUT LINK ANSWERS THIS, WORD FOR WORD. Unknown, malformed, withdrawn, declined and
   waiting ids all get it, in the board's own look, so the door tells a stranger nothing about which
   it was and never leaves them on a bare "Not found". Its tab says so too, one title for every kind. */
export function shutPage(nonce) { return onePage("shut", nonce); }
/* 12 Oct 2026 (Phase 7d part 4, his yes of 11 Oct): A PAGE THAT SAYS ONE THING stands on the frame the door has, the app's ring over a heading and a line:
   the shut link and the site's own 404. Neither says anything but its key's words (nf.* for the 404), so a path or a query never reaches it. */
function onePage(k, nonce) {
  return guestPage('<span class="appmark">' + glyphSvg("ring", 40) + "</span>" + '<h1 class="gh">' + wd(k + ".h") + "</h1>"
    + '<p class="lead">' + wd(k + ".p") + "</p>", nonce, esc(EN[k + ".title"]));
}
export function notFoundPage(nonce) { return onePage("nf", nonce); }
/* S13 13.1, HIS DECISION D12 OF 24 SEP 2026: EVERY PAGE OF THE COUNTER IS KEPT OUT OF THE TRANSLATOR. On a phone set
   to another language, Chrome offers to translate a page, and accepting sends what is on it, an opened statement
   included, to a translation service. translate="no" on the root and Google's notranslate say no for every page:
   the customer's, a guest board, a shut link and Salt Admin. */
/* 11 OCT 2026, HIS WORD: TWO THEMES, NIGHT AND TIDE, ON EVERY SURFACE, KEPT ON EACH DEVICE, TIDE UNTIL ONE IS CHOSEN. Night is
   the design system's :root and Tide its :root[data-theme="tide"], both carried in the page's stylesheet (tools/stmt-style.mjs).
   Every page opens Tide: data-theme="tide" is on the root as served and the browser bar starts at Tide's ground. A page that
   runs script then reads localStorage salt-look before its stylesheet and first paint (LOOK_HEAD, a nonce'd script at the top of
   the head, every read in a try), and a page that cannot run one (a guest board, the shut page) stays Tide, since no device's
   choice can be read there. The two grounds are the system's obsidian at each theme; the suite holds them equal to it. */
const GROUND = { night: "#05080a", tide: "#03141a" };
export const LOOK_HEAD = "function saltLook(t){var m=document.querySelector('meta[name=\"theme-color\"]');"
  + "document.documentElement.setAttribute('data-theme',t);if(m)m.setAttribute('content',t==='night'?'" + GROUND.night + "':'" + GROUND.tide + "');return t;}"
  + "(function(){saltLook('night');})();"   /* 19 Oct 2026, his word: Tide is off for now, every device opens Night; the store and Tide's tokens are kept */
  /* the iPhone's saved app marks the root before first paint (navigator.standalone is that app's alone; Android's installed pages have a viewport the screen is not) and
     gives it the screen's height, the longer side of the screen upright and the shorter lying down; --app-h feeds the body's min-height under 1080px */
  + "(function(){try{if(navigator.standalone===true){var r=document.documentElement,f=function(){var a=Math.max(screen.width,screen.height),b=Math.min(screen.width,screen.height);"
  + "r.style.setProperty('--app-h',(window.innerWidth>window.innerHeight?b:a)+'px');};r.setAttribute('data-app','1');f();window.addEventListener('resize',f);}}catch(e){}})();";
/* 18 Oct 2026: THE LIGHT, the system's Aurora as the Desk draws it (tools/stmt-style.mjs carries the recipe), the first thing in the body of the Counter and Salt Admin. Not on guestPage (the guest board, the shut page and the 404): their source names no brand, and every salt- class would be one */
const AURORA = '<div class="salt-aurora salt-aurora--page salt-aurora--fixed" aria-hidden="true"><div class="salt-aurora__blob salt-aurora__blob--copper"></div>'
  + '<div class="salt-aurora__blob salt-aurora__blob--brass"></div></div>';
export const DOC_OPEN = '<!DOCTYPE html>\n<html lang="en" translate="no" data-theme="night"><head><meta charset="utf-8">'
  + '<meta name="google" content="notranslate">'
  + '<meta name="theme-color" content="' + GROUND.night + '">';
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
/* COUNTER BATCH A (his decisions of 18 Oct 2026, reversing S7 7.5's still card of his D14): THE TODAY CARD at the head of Home. The time in
   Kuala Lumpur, whether the Counter is open and until when or when it opens (off /hours, once signed in), and his notice, one line at a time,
   the next every six seconds, with Pause. Under reduced motion every line stands and nothing turns. Nothing in it is a live region: a line
   that changes is never read out unasked. Drawn at first paint with the notice's lines; the open or closed line waits for /hours. */
function noticeCard(b) {
  const lines = (b && Array.isArray(b.lines)) ? b.lines : [];
  return '<section id="today" class="today salt-glass-card salt-glass-card--radius-lg salt-glass-card--pad-sm"' + wl("today.aria") + ">"
    + '<div class="today__head"><span id="todayOpen" class="today__open" hidden></span><span class="today__clock" data-clock></span></div>'
    + '<p id="todayLine" class="today__line" hidden></p>'
    + '<div id="bull" class="salt-notice hnote"' + (lines.length ? "" : " hidden") + ">"
    + '<div class="salt-notice__head">' + wt("span", 'class="salt-eyebrow salt-eyebrow--copper"', "bull.h")
    + '<span class="salt-notice__tools"><span class="salt-notice__dots" aria-hidden="true"></span>'
    + '<button type="button" class="salt-notice__pause" aria-pressed="false" hidden' + wl("bull.pause") + ">" + "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" focusable=\"false\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><path d=\"M9 6 V18 M15 6 V18\"></path></svg>" + "</button></span></div>"
    + '<div class="salt-notice__lines">' + lines.map((l, i) => '<p class="salt-notice__line' + (i ? "" : " salt-notice__line--on") + '">' + esc(l) + "</p>").join("") + "</div></div>"
    + "</section>";
}
/* S9 9.2: SALT ADMIN'S PLACES AND ITS FILTERS. The icons are drawn here, stroked like the product marks,
   and loaded from nowhere; the key is the ring with a keyhole its home-screen icon carries (9.7). */
/* 11 OCT 2026, HIS DECISION: FIVE PLACES, Needs you, Orders, Customers, Record and Shop. "Maker" is retired on screen. A place but Needs you has
   its parts, each [the id its address and its sections carry, its word], drawn as the system's tab strip; the first opens with the place. */
const ADMIN_PLACES = [["needs", "Needs you"], ["orders", "Orders"], ["customers", "Customers"], ["record", "Record"], ["shop", "Shop"]];
/* THE TEST SURFACE (his answers of 18 Oct 2026): Salt Admin on the practice accounts draws four places, Needs you, Orders, Payments and
   Chat; the last two open a part (the third field), and Record, Shop, the account list, the links, Approve, Group and Ledger are not drawn */
const TEST_PLACES = [["needs", "Needs you"], ["orders", "Orders"], ["orders", "Payments", "payments"], ["customers", "Chat", "messages"]];
const TEST_PARTS = { orders: ["placed", "confirmed", "ready", "paid", "done", "ended", "payments"], customers: ["messages"] };
/* a place's rail button: data-p names the part a test place opens */
const placeBtn = (cls, inner) => ([m, w, p]) => '<button type="button" class="' + cls + ' place" data-m="' + m + '"' + (p ? ' data-p="' + p + '"' : "")
  + ' data-act="nav.' + (p || m) + '">' + inner(m, w, p) + "</button>";
const ADMIN_PARTS = {
  orders: [["placed", "Placed"], ["confirmed", "Agreed"], ["ready", "Ready"], ["paid", "Out or paid"], ["done", "Done"], ["ended", "Ended"], ["approve", "Approve"], ["payments", "Payments"], ["group", "Group"], ["ledger", "Ledger"]],
  customers: [["accounts", "Accounts"], ["messages", "Messages"], ["links", "Links"], ["associates", "Associates"]],
  record: [["entry", "Entry"], ["customers", "Customers"], ["pricing", "Pricing"]],
  shop: [["hours", "Hours"], ["notice", "Notice"], ["practice", "Practice"], ["device", "This device"]]
};
/* a place's parts strip: every part is a control with an act of its own, part.<place>.<part> (docs/STATEMENTS.md) */
/* 20 Oct 2026 (Counter Batch C, item 21): a place whose parts fit a phone's slider draws them as one, measured in Chromium at 358px:
   Record's three. Customers' and Shop's four (Associates, This device) and the six kinds of Needs you do not fit equal columns there,
   and Orders' second strip shares its choice with the stages, so it can stand with none chosen; those stay a strip of pills. */
const ADMIN_SLIDERS = ["record"];
const adminStrip = (p, list, cls, label, seg = !cls && ADMIN_SLIDERS.includes(p)) => '<div class="' + (seg ? "salt-segment" : "salt-tabs") + ' aparts' + cls + '" role="tablist" aria-label="' + label + '" data-place="' + p + '">'
  + list.map(([k, w]) => '<button type="button" class="' + (seg ? "salt-segment__opt" : "salt-tabs__pill") + '" role="tab" data-part="' + k + '" data-act="part.' + p + "." + k
    + '" aria-selected="' + (k === ADMIN_PARTS[p][0][0] ? "true" : "false") + '">' + w + "</button>").join("") + "</div>";
/* 18 Oct 2026 (Salt Admin clarity, part 3): Orders draws its parts as two strips of one list. The six stages come first, in the order an order moves (a tab strip
   with each stage's count, since the Steps recipe is a drawing and not a row of controls); Approve, Payments, Group and Ledger stand apart beneath, smaller. Every part keeps
   its id, its act and its address, and PARTS is both strips together (stmt/owner.js), so only the drawing is split. */
const ADMIN_ORDER_STAGES = ["placed", "confirmed", "ready", "paid", "done", "ended"];
/* 25 Oct 2026 (canvas Salt Admin Orders, his yes to Asks A to C): THE PARTS ARE TWO TEXT TAB ROWS ON THE NAV RECIPE, as Needs you's kinds: the six
   stages in the words of the order's steps (Placed, Agreed, Ready, Out or paid, Done, Ended), each with the count of its orders waiting on him, then
   Payments, Group and Ledger under a hairline. Approve leaves the rows, reached by the bar's Approve; its tab stays, hidden, so its part and its
   address (#orders/approve) are as they were. Two stages across on a phone and three of the rest, six across from 860px. */
const ordTab = (k, w, hide) => '<button type="button" role="tab" class="salt-nav__link nktab' + (k === "placed" ? " salt-nav__link--active" : "") + '" data-part="' + k
  + '" data-act="part.orders.' + k + '" aria-selected="' + (k === "placed" ? "true" : "false") + '"' + (hide ? " hidden" : "") + ">" + w + '<span class="nktab__n"></span></button>';
const ordTabs = (list, cls, label) => '<nav class="salt-nav oparts ' + cls + '" aria-label="' + label + '"><div class="salt-nav__links aparts" role="tablist" aria-label="' + label
  + '" data-place="orders">' + list.map(([k, w]) => ordTab(k, w, k === "approve")).join("") + "</div></nav>";
const adminParts = (p, test) => test && !TEST_PARTS[p] ? ""
  : p === "orders"
  ? ordTabs(ADMIN_PARTS[p].filter(([k]) => ADMIN_ORDER_STAGES.includes(k)), "oparts--stages", "Order stages")
    + ordTabs(ADMIN_PARTS[p].filter(([k]) => !ADMIN_ORDER_STAGES.includes(k) && (!test || TEST_PARTS[p].includes(k))), "oparts--minor", "Other orders")
  : adminStrip(p, ADMIN_PARTS[p].filter(([k]) => !test || TEST_PARTS[p].includes(k)), "", ADMIN_PLACES.filter((x) => x[0] === p)[0][1]);
/* PHASE 1b: Needs you's kind chips. They filter the one list and read nothing; each is a control with an act of its own, need.kind.<kind> */
const ADMIN_KINDS = [["all", "All"], ["orders", "Orders"], ["payments", "Payments"], ["messages", "Messages"], ["rows", "Rows"], ["accounts", "Accounts"]];
const ADMIN_FILTERS = [["all", "All"], ["unsent", "Not sent"], ["unopened", "Not opened"], ["owes", "They owe"], ["locked", "Locked out"], ["none", "No account yet"]];
const ADMIN_ICONS = {
  needs: '<path d="M3.8 13 L6.5 5 H17.5 L20.2 13 V19.5 H3.8 Z M3.8 13 H8.6 L9.9 15.6 H14.1 L15.4 13 H20.2"/>',
  orders: '<path d="M5 4.5 H19 V19.5 H5 Z M8 8 H16 M8 11.5 H16 M8 15 H13"/>',
  customers: '<circle cx="9" cy="8.6" r="3.2"/><path d="M3.4 19.6 C4.2 16.4 6.4 14.8 9 14.8 C11.6 14.8 13.8 16.4 14.6 19.6 M15.2 5.6 A3 3 0 0 1 15.4 11.6 M17.4 14.9 C19 15.6 20.1 17.2 20.6 19.6"/>',
  record: '<path d="M4.6 19.4 L5.4 15.4 L15.4 5.4 A1.6 1.6 0 0 1 17.7 5.4 L18.6 6.3 A1.6 1.6 0 0 1 18.6 8.6 L8.6 18.6 Z M13.4 7.4 L16.6 10.6"/>',
  shop: '<path d="M4 9.6 L5.6 4.6 H18.4 L20 9.6 M4 9.6 A2.67 2.67 0 0 0 9.33 9.6 A2.67 2.67 0 0 0 14.67 9.6 A2.67 2.67 0 0 0 20 9.6 M5.6 12.4 V19.4 H18.4 V12.4 M10 19.4 V15 H14 V19.4"/>',
  add: '<path d="M12 5.5 V18.5 M5.5 12 H18.5"/>',
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
/* COUNTER BATCH A (his decisions of 18 Oct 2026): FROM 1080PX THE APP'S NAME STANDS OVER THE RAIL, the one brand on the page, and the rail's
   brand slot says whose account it is: Signed in as, then the username (never a roster code), which the header then leaves to the rail. The
   Desk bar that stood across the top from 18 Oct 2026 went with it, and came back on 21 Oct 2026 (his word) as the header itself, the place
   and what waits on them (cBar); the name stays over the rail. */
function placesRail() {
  return '<nav class="salt-rail salt-appbar__rail" aria-label="Salt Counter">'
    + '<p class="salt-title crtitle" aria-hidden="true">Salt Counter</p>'
    + '<div class="salt-rail__brand crbrand" data-wholine>' + wt("span", 'class="salt-eyebrow salt-eyebrow--mist"', "who.rail") + '<span class="mono" data-whorail></span></div>'
    + '<div class="salt-rail__group">' + PLACES.map(([t, w]) => '<button type="button" class="salt-rail__tab salt-rail__tab--solo"' + placeAttrs(t, true) + ">"
      + '<span class="salt-appbar__place"><span class="salt-appbar__icon">' + aico(t) + "</span>" + wt("span", "", "place." + t) + "</span>"
      + '<span class="salt-rail__count" data-n="' + t + '"></span></button>').join("") + "</div></nav>";
}
function placesBar() {
  /* C22 (29 Sep 2026): the bar is Places, so two landmarks never share one name */
  return '<nav class="salt-appbar"' + wl("place.bar") + '>' + PLACES.map(([t, w]) => '<button type="button" class="salt-appbar__item"' + placeAttrs(t) + ">"
    + '<span class="salt-appbar__icon">' + aico(t) + "</span>" + wt("span", 'class="salt-appbar__label"', "place." + t)
    + '<span class="salt-appbar__count" data-n="' + t + '"></span></button>').join("") + "</nav>";
}
/* THE TEST SURFACE (his answers of 18 Oct 2026). `test` is null on every real page, which is then the page it always was; under /all/test
   it is {base, u}: the page's every request goes under the base, its storage under salt-test:, and it registers no service worker, manifest,
   push or passkey (TEST_SHIM, spliced into the script's own scope, so every fetch, localStorage, sessionStorage and navigator in it is the
   shim's). The customer view signs in on its own as `u` with the published test password. */
export function landingPage(user, nonce, owner, bulletin, test) {
  const u = esc(user || "");
  return DOC_OPEN
    + '<script nonce="' + nonce + '">' + LOOK_HEAD + "</script>"
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
    + (test ? "" : owner ? '<link rel="manifest" href="/all/manifest.webmanifest" crossorigin="use-credentials">'
      : '<link rel="manifest" href="/manifest.webmanifest">')
    + '<link rel="icon" type="image/png" sizes="128x128" href="' + (owner ? "/icon-key-tab.png" : "/icon-tab.png") + '">'   /* 24 Oct 2026: the browser tab had no icon link; and his word, on a clear ground, so the tab carries the ring and not the home screen's black tile */
    + '<link rel="apple-touch-icon" href="' + (owner ? "/icon-key.png" : "/icon.png") + '">'
    + '<meta name="apple-mobile-web-app-capable" content="yes">'
    + '<meta name="mobile-web-app-capable" content="yes">'
    + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
    /* his page is Salt Admin, as its manifest says; the customer's is Salt Counter */
    + '<meta name="apple-mobile-web-app-title" content="' + (owner ? "Salt Admin" : "Salt Counter") + '">'
    + "<title>" + (owner ? "Salt Admin" : "Salt Counter") + "</title>"
    + '<style nonce="' + nonce + '">' + FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES + PAGE_CSS + "</style></head><body>" + AURORA
    + (owner
      ? '<div id="roster" class="gate adm">'
        /* 20 Oct 2026 (canvas V32): the bar heads the whole shell, the rail and the column under it, so from 1080px it spans both */
        + '<header class="salt-deskbar abar"><div class="salt-deskbar__brand"><span class="aring">' + aico("key") + '</span>'
        + '<div class="abartext"><div class="salt-deskbar__name">Salt Admin</div><div class="salt-deskbar__meta"><span class="abarlive" id="aBarLive"></span><span class="clk" data-clock></span></div></div>'
        /* 22 Oct 2026 (canvas Needs you): the hours are a glowing status chip at the bar's top right, a 44px button to Shop hours (barDraw in stmt/owner.js) */
        + '<button type="button" class="salt-status ashop" id="aBarHours" data-act="bar.hours" hidden></button></div>'
        /* 21 Oct 2026, his word: the bar was bare. What waits, as the Desk's bar: each a chip to its place, Approve brass with its rows (barLive in
           stmt/owner.js). 22 Oct 2026, his comment: no where-you-are on Salt Admin, "not required"; the rail and the App bar say it */
        + '<div class="salt-deskbar__live"><div class="salt-deskbar__chips" id="aBarChips" role="group" aria-label="Waiting"></div></div></header>'
        /* S9 9.2: HIS PLACES, the phone's App bar and, from 1080px, the Desk rail the bar gives way to (the
           system's own switch): Needs you, Orders, Customers, Record and Shop (his decision of 11 Oct 2026). A count beside a
           place is what waits there. */
        + '<nav class="salt-rail salt-appbar__rail" aria-label="Salt Admin">'
        + '<div class="salt-rail__group">' + (test ? TEST_PLACES : ADMIN_PLACES).map(placeBtn("salt-rail__tab salt-rail__tab--solo", (m, w, p) =>
          '<span class="salt-appbar__place"><span class="salt-appbar__icon">' + aico(p === "messages" ? "customers" : m) + "</span><span>" + w + "</span></span>"
          + (p ? "" : '<span class="salt-rail__count" data-count="' + m + '"></span>'))).join("") + "</div>"
        /* 21 Oct 2026 (P10): the + as a rail button, which the orb gives way to from 1080px; none on the test surface */
        + (test ? "" : '<div class="salt-rail__group arailadd"><button type="button" class="salt-rail__tab salt-rail__tab--solo" id="oAddRail" data-act="rail.add">'
          + '<span class="salt-appbar__place"><span class="salt-appbar__icon">' + aico("add") + "</span><span>New entry</span></span></button></div>")
        + '<div class="salt-rail__foot" id="mFoot"></div></nav>'
        + '<div class="amain">'
        /* 18 OCT 2026, HIS WORD: THE DESK'S SHELL. The system's Desk bar heads every place, as it heads the Desk: the ring and the name, the clock
           under it. It took the rail's brand and the eyebrow each place repeated ("Salt Admin" and the clock). */
        /* 12 OCT 2026 (PHASE 4c): THE UNSENT-ENTRY BANNER, over every place and shown by the owner's script only while an entry sent from this phone waits unconfirmed on it */
        + '<div id="unsentBar" hidden></div>'
        /* 11 OCT 2026: WHAT IS ON SCREEN IS DECIDED BY data-in, which names the places and the parts an element shows in
           ("orders" is every part of Orders, "orders.group" that part alone). The owner's script hides the rest (stmt/owner.js, go),
           so a section is moved between parts by changing its words here and nothing else. An element with none shows with its place. */
        /* S9 9.1: his home is Needs you, one card a thing with its action on it (stmt/owner.js) */
        + '<div id="mHome" data-in="needs">'
        /* plan 1 (15 Oct 2026): a read that failed leads the page, with a Retry (stmt/owner.js drawFail) */
        + '<div id="nFail" class="salt-action salt-action--now nfail" role="alert" hidden></div>'
        /* 20 Oct 2026 (canvas V65, his word: every page starts the same way): no title is drawn on any place; the rail's lit tab or the App bar
           names it, and the heading stays for a reader */
        + '<h1 class="sr">Needs you</h1>'
        /* 22 Oct 2026 (canvas Needs you): the lead is one Insight, what waits on his tap in money and the books that need stock (stmt/owner.js drawLead) */
        + '<p class="salt-insight salt-insight--copper nlead" id="nCount">Reading what needs you.</p>'
        /* the glance: Ready, To approve and Receivables, single-line KPI tiles read off the orders the page holds (stmt/owner.js drawGlance) */
        + '<section id="nGlance" class="nglance" aria-label="At a glance" hidden></section>'
        /* 22 Oct 2026 (canvas Needs you, his "something else that is not just pill styles"): the kinds are a text tab row on the system's Nav bar, the count
           beside each word, the chosen one on glass with a brass underline, an empty one dimmed; three across on a phone, six wide. Jump to is gone */
        + '<nav class="salt-nav nkinds" aria-label="Show"><div class="salt-nav__links nchips" role="tablist">' + ADMIN_KINDS.map(([k, w], i) => '<button type="button" class="salt-nav__link nktab'
          + (i ? "" : " salt-nav__link--active") + '" role="tab" data-chip="' + k + '" data-act="need.kind.' + k + '" aria-selected="' + (i ? "false" : "true") + '">' + w
          + '<span class="nktab__n"></span></button>').join("") + "</div></nav>"
        /* S9 fix: from 860px the list stands beside the account a card is about, as Accounts does (Phase 6) */
        + '<div class="nsplit"><div>'
        + '<div id="nlist" class="nlist"></div>'
        + '</div><div id="nopen" class="salt-glass-card salt-glass-card--radius-lg" aria-label="The open card" hidden></div><p class="rnone panenone">Choose a card to see it in full.</p></div>'
        /* 22 Oct 2026 (his word, the restock light made plain; canvas Needs you): every book's light and figures, under the cards (stmt/owner.js drawStockBooks) */
        + '<section id="nStock" class="nstock" aria-label="Stock by book" hidden></section>'
        + "</div>"
        /* ORDERS: the Counter's orders by stage, the payments customers say they sent, and the group orders. The stages filter one list
           (#makerOrderList, a row an order); a row opens that order's card in #makerReview, beside the list from 860px and in its place
           below it (PHASE 1c). Order for them, opened from an account, stands at the head of the place. */
        + '<div id="oOrders" class="aplace" data-in="orders" hidden>'
        + '<h1 class="sr">Orders</h1>'
        + adminParts("orders", test)
        + '<div class="abody">'
        + '<section id="makerFor" hidden aria-label="Order for a customer"></section>'
        + '<section id="oSplit" data-in="orders.placed orders.confirmed orders.ready orders.paid orders.done orders.ended" aria-label="Orders">'
        + '<p class="salt-insight salt-insight--copper olead" id="makerReviewStatus">Reading.</p>'
        + '<div class="ordgrid"><div id="makerOrderList" class="ordlist"></div><div id="makerReview" class="ordopen"></div></div></section>'
        + '<section id="oApprove" data-in="orders.approve" aria-label="Rows to approve">'
        + '<p class="lead" id="makerDraftStatus">Reading.</p>'
        + '<div id="makerDrafts"></div>'
        /* 22 Oct 2026: the multi-tick Approve's bar, drawn by stmt/owner.js apBarDraw once a card is chosen */
        + '<div id="apBar" class="apbar salt-glass-card salt-glass-card--radius-lg" hidden></div>'
        /* 12 Oct 2026 (Phase 2c): the queue is the system's Plan fold, SHUT, titled and counted (the count is the entries the server holds, drawn with them) and opened by a tap */
        + '<details id="makerQueue" class="salt-plan"><summary data-act="record.queue-toggle"><span class="salt-plan__id" id="makerQueueCount">0</span><span class="salt-plan__title" id="makerQueueTitle">sent, waiting for the drafter</span></summary>'
        + '<div class="salt-plan__body">'
        + '<div id="makerQueueReview" aria-live="polite"></div></div></details></section>'
        + '<section data-in="orders.payments" aria-labelledby="makerClaimsTitle"><h2 id="makerClaimsTitle">Payments they say they sent</h2><div id="makerClaims" aria-live="polite"></div></section>'
        + '<section data-in="orders.group" aria-labelledby="makerPoolsTitle"><h2 id="makerPoolsTitle">Group orders</h2>'
        + '<p class="lead">Customers join a bulk order. When you close it, each order comes to you to agree.</p>'
        + '<div id="makerPools" aria-live="polite"></div></section>'
        /* 16 Oct 2026: THE MINI LEDGER, three tables of the folded book in this order: Open orders, Pending orders and the latest twenty. Every other part of Orders
           is shut while it shows (stmt/owner.js, loadLedger). */
        + '<div id="oLedger" data-in="orders.ledger"><p class="lead" id="ledgerStatus" role="status">Reading.</p><section class="ledgrp" id="led-tie" aria-label="Order and book"></section>'
        + [["open", "Open orders"], ["pending", "Pending orders"], ["recent", "Latest 20 orders"]].map(([k, w]) => '<section class="ledgrp" aria-labelledby="led-' + k + '-h"><h2 id="led-' + k + '-h">' + w
          + '</h2><div class="salt-table-wrap" id="led-' + k + '" tabindex="0" role="region" aria-labelledby="led-' + k + '-h"></div></section>').join("") + "</div>"
        + "</div></div>"
        /* CUSTOMERS: the people. Accounts is S9 9.2's list, one list for what Send and Review were: found by a word, narrowed by a
           filter, and a row opens the account beside the list from 860px, in its place below it on a phone. */
        + '<div id="oCustomers" class="aplace" data-in="customers" hidden>'
        + '<h1 class="sr">Customers</h1>'
        + '<p class="lead">The people on the site: their accounts, their messages, guest links and associates.</p>'
        + adminParts("customers", test)
        + '<div class="abody">'
        + '<div id="oAccts" data-in="customers.accounts">'
        + '<p class="lead" id="scount"></p>'
        + '<div class="afind">'
        + '<input class="fld salt-field__input salt-field__input--mono" id="rq" type="search" autocapitalize="none" autocorrect="off" '
        + 'spellcheck="false" placeholder="A code or a username" aria-label="Find an account" data-act="acct.find">'
        + '<div class="afil" id="afil" role="group" aria-label="Show only">' + ADMIN_FILTERS.map(([f, w], k) =>
          '<button type="button" class="salt-ghost" data-f="' + f + '" data-act="acct.filter-' + f + '" aria-pressed="' + (k ? "false" : "true") + '">' + w + "</button>").join("") + "</div>"
        + "</div>"
        + '<div class="asplit"><div id="rlist" class="alist"></div><div id="aopen" hidden></div><p class="rnone panenone">Choose a card to see it in full.</p></div>'
        + "</div>"
        + '<section class="chatgrid" data-in="customers.messages" aria-labelledby="makerChatTitle"><h2 id="makerChatTitle">Messages</h2>'
        + '<p id="makerChatStatus" class="msg" role="status" aria-live="polite"></p>'
        + '<div id="makerChatList"></div><div id="makerChatOpen" hidden></div></section>'
        + '<div id="oLinks" data-in="customers.links">'
        + "<h2>Guest links</h2>"
        + '<p class="lead">A guest link opens the Set Price list, the same for everybody. Name the customer whose friend it is, as your own note.</p>'
        + '<label class="lbl salt-field__label" for="gintro">Whose friend?</label>'
        + '<input class="fld salt-field__input" id="gintro" type="text" maxlength="20" autocapitalize="off" '
        + 'spellcheck="false" placeholder="their username" aria-label="The username of the customer whose friend this is" data-act="link.introducer">'
        + '<label class="lbl salt-field__label" for="glabel">A note for you</label>'
        + '<input class="fld salt-field__input" id="glabel" type="text" maxlength="60" '
        + 'placeholder="a shop, a name, a note" aria-label="A note for you" data-act="link.label">'
        + '<button class="btn salt-pill salt-pill--md" type="button" id="gmake" data-act="link.make">Make a link</button>'
        /* 13 Oct 2026 (stress): the answer to Make a link stands under it, where it went to the page's one line at the foot of Customers */
        + '<p class="msg osaid" id="gmsg" role="status" aria-live="polite"></p>'
        + '<div id="glist"></div>'
        + "</div>"
        + '<div id="oCards" data-in="customers.associates">'
        + "<h2>Associates report card</h2>"
        + '<p class="lead" id="ccount"></p>'
        + '<div id="clist"></div>'
        + "</div>"
        + "</div></div>"
        /* RECORD: his own entries, the forms, which the Desk checks and holds for review before they change the book. The Desk's rows waiting for
           him and the entries the server holds are Approve, under Orders (17 Oct 2026, as the Desk's Order book took it). */
        + '<div id="oRecord" class="aplace" data-in="record" hidden>'
        + '<h1 class="sr">Record</h1>'
        + '<p class="lead">Your own entries. Each waits for your approval under Orders &gt; Approve.</p>'
        + adminParts("record", test)
        + '<div class="abody">'
        + '<section id="makerInputs" data-in="record.entry record.customers record.pricing" aria-label="Record"></section>'
        + "</div></div>"
        /* SHOP: the counter itself. The practice accounts are the two he opens to try the customer's page. */
        + '<div id="oShop" class="aplace" data-in="shop" hidden>'
        + '<h1 class="sr">Shop</h1>'
        + '<p class="lead">The counter itself: its hours, the notice, the practice accounts and how this device looks.</p>'
        + adminParts("shop", test)
        + '<div class="abody">'
        + '<section data-in="shop.hours" aria-labelledby="makerHoursTitle"><h2 id="makerHoursTitle">Shop hours</h2>'
        + '<p class="lead" id="makerHoursStatus">Reading.</p>'
        + '<div id="makerSchedule"></div><p id="makerHoursMessage" class="msg" role="status" aria-live="polite"></p><div id="makerConfirm"></div></section>'
        + '<section data-in="shop.hours" aria-labelledby="makerPointsTitle"><h2 id="makerPointsTitle">Collection points</h2>'
        + '<p class="lead" id="makerPointsStatus">Reading.</p>'
        + '<div id="makerPoints"></div><p id="makerPointsMessage" class="msg" role="status" aria-live="polite"></p></section>'
        /* 21 Oct 2026 (P8): the customer's Help, read only, under the hours and the points it speaks of */
        + helpCard(true)
        + '<section data-in="shop.notice" aria-labelledby="makerBulletinTitle"><h2 id="makerBulletinTitle">Notice</h2>'
        + '<p class="lead">A line at the top of every customer account. Setting it also sends them a notification.</p>'
        + '<div id="makerBulletin"></div><p id="makerBulletinStatus" class="msg" role="status" aria-live="polite"></p></section>'
        + '<div id="mTest" class="mtest" data-in="shop.practice"></div>'
        /* 11 Oct 2026, his word: Salt Admin has its own Night or Tide, chosen on this device (the Counter origin's localStorage salt-look,
           shared with the Counter's pages on this device and apart from the Desk's), the same row the customer has under Account > This device. The first-open Sheet is below, beside #aEnded. */
        + '<section id="oLook" data-in="shop.device" aria-labelledby="oLookTitle"><h2 id="oLookTitle">This device</h2>'
        + '<p class="lead">Night or Tide for Salt Admin on this device. Kept on this device; the Desk keeps its own.</p>'
        + lookRow(true) + vaultRow() + (test ? "" : alertRow()) + "</section>"
        + "</div></div>"
        + '<p class="msg" id="rmsg" role="status" aria-live="polite"></p></div>'
        + '<nav class="salt-appbar" aria-label="Salt Admin">' + (test ? TEST_PLACES : ADMIN_PLACES).map(placeBtn("salt-appbar__item", (m, w, p) =>
          '<span class="salt-appbar__icon">' + aico(p === "messages" ? "customers" : m) + '</span><span class="salt-appbar__label">' + w + "</span>"
          + (p ? "" : '<span class="salt-appbar__count" data-count="' + m + '"></span>'))).join("") + "</nav>"
        /* PHASE 1c: one + orb, on every place but Record, opens Record's menu of entries (it is shown and hidden by the owner's script); none on the test surface */
        + (test ? "" : '<button type="button" class="salt-orb salt-orb--raised" id="oAdd" data-act="nav.add" aria-label="Record an entry">' + aico("add") + "</button>")
        + "</div>"
        /* S9 9.7, his D13: what his page becomes when the Access session behind it has ended */
        + '<div id="aEnded" class="gate" hidden><h1>Your sign-in has ended</h1>'
        + '<p class="lead">Sign in again to carry on.</p>'
        + '<a class="salt-pill salt-pill--md btn" href="/all" data-act="ended.sign-in">Sign in again</a></div>'
        /* the first-open choice Sheet, a child of the body like #aEnded: when the Access session has ended the page gives way to #aEnded
           alone (body.ended), and the owner's script takes this down first (stmt/owner.js, ended) */
        + lookSheet(true) + vaultSheet()
      : "")
    + '<div id="gate" class="gate"' + (owner ? " hidden" : "") + ">"
    /* 11 Oct 2026 (Phase 7d part 2, his yes): THE DOOR NAMES THE APP, in its ring and its one name, above Sign in; his own page is Salt Admin and carries none */
    + (owner ? "" : '<span class="appmark">' + glyphSvg("ring", 40) + "</span>" + wt("p", 'class="salt-eyebrow salt-eyebrow--copper"', "door.app"))
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
    /* Step 6 (his decisions of 29 Sep 2026): a passkey saved on the account opens it; drawn where the browser has passkeys */
    + (owner ? "" : wt("button", 'class="btn salt-ghost" id="pkGo" type="button" hidden', "door.pk"))
    + wt("p", 'class="salt-insight"', "door.help")
    + "</div></div>"
    + (owner ? "" : linkScreen() + codeScreen() + signedOutSheet() + replaceAsk() + bellSheet() + paySheet() + devSheet() + threadSheet() + lookSheet())
    /* S7 7.1 (his D11 of 24 Sep 2026): THE PLACES. Home opens first, and the places sit on the system's App bar under
       the thumb on a phone and on its rail beside the page from 1080px, the recipe's own switch. The bar of lines
       and the header live inside the shell, so what is hidden while signed out is hidden in one place. */
    + '<div id="tabs" class="cshell" hidden>' + placesRail() + '<div class="cmain">'
    + '<div id="barw" hidden><div class="bar' + (owner ? " vbar" : "") + '">'
    /* S9 9.5: on his page an account is viewed, never signed into, so the bar says whose it is and that it is
       read only, and its one control takes him back to that account on Accounts. A customer's Log out is This
       device's, on Account (S7 7.1), so their bar holds nothing until it has a lapse to say */
    + (owner ? '<span><b id="whoacct"></b><span id="cd"></span><span id="vas">Viewing as <b id="vasU"></b>, read only</span></span>'
      + '<button type="button" id="lock" data-act="view.back">Back to accounts</button>' : "")
    /* S1 1.5: a lapsed session says so where the reader is, with the one way back: a second row of the bar */
    + '<div id="lapse" class="lapse" role="alert" hidden><span id="lapseT"></span>' + wt("button", 'type="button" id="lapseGo"', "link.go") + "</div>"
    + "</div></div>"
    /* the header names the place and whose account it is, so every customer knows their username; Step 1b: the bell
       sits in it, on every view of the saved app */
    + '<header class="chead' + (owner ? "" : " salt-deskbar cbar") + '">' + (owner ? "" : bellBox()) + '<p class="salt-eyebrow cclock" data-clock></p>' + wt("h1", 'id="placeT"', "place.home")
    + '<p class="cwho" data-wholine>' + whoAs() + '<span id="cstay"></span></p>'
    /* 21 Oct 2026, his word: the Counter's header is the bar again, on every place: where they are, then what waits on them (cBar) */
    + (owner ? "" : '<div class="salt-deskbar__live"><div class="salt-deskbar__chips" id="cBarChips" role="group"' + wl("place.bar") + '></div></div>') + '</header>'
    /* HOME: what they owe, what needs them and what they order again; the notice first (S7 7.5). What they owe is
       stage 6's To pay now (S6 6.2), its one filled Pay opening the pay sheet. Two columns from 1080px (S7 7.2) */
    + '<div id="pHome" class="home"><div class="hcol">' + noticeCard(bulletin)
    + '<div id="payHead" class="payhead" hidden></div><div id="hNeeds"></div><div id="hRate"></div><div id="hThread"></div><div id="hSupply"></div><div id="hStart"></div></div>'
    + '<div class="hcol"><div id="hPool"></div><div id="hComing"></div><div id="hAgain"></div><div id="hReward"></div><div id="hYear"></div></div>'
    /* Counter Batch A: their latest open order, a pill over the App bar and the pay foot on a phone and a banner under To pay now from
       1080px: one element, so the two are never both shown */
    + '<div id="hLive"></div>'
    /* PHASE 7A: the foot holding To pay now and its Pay, last in Home so it stays above the bar the whole way down (drawPayHead) */
    + '<div id="homeFoot" class="payfoot" hidden></div></div>'
    /* S7 7.3: ACCOUNT, what drawAccount(el) puts in a place. 11 Oct 2026 (Phase 7d part 2): Messages, then This device, then the
       statement (its one month filter placed beside the list it filters and nothing after it) under a gap of its
       own; This device stands beside them from 1080px */
    + '<div id="pStmt" hidden><div id="acct" class="acct"><div id="aGlance"></div><div id="aThread"></div>'
    + (owner ? "" : thisDevice() + helpCard())
    + '<div class="acct__main">'
    + '<div id="mfil" class="salt-tabs mfil" role="group"' + wl("acct.months") + ' hidden></div><p class="mfnote" id="mfnote" role="status"></p>'
    + '<div id="out"></div>'
    + '</div>'
    + "</div></div>"
    + '<div id="pPrices" class="panel" hidden></div>'
    + '<div id="pOrder" class="panel" hidden></div>'
    /* v706: the associate's own card, Rewards since S7 7.1. Its place is hidden for everybody else */
    + '<div id="pCard" class="panel" hidden></div>'
    + "</div>" + placesBar() + "</div>"
    + '<script nonce="' + nonce + '">'
    + CLIENT_JS.replace(/__POLL__/g, String(test ? TEST_POLL_MS : POLL_MS)).replace(/__THPOLL__/g, String(THREAD_POLL_MS))
      /* Speed Wave 2 L2: the live socket is the real site's; the test surface keeps its two-second poll and opens none */
      .replace(/__LIVE__/g, test ? "false" : "true")
      /* the notice as the page was served, so the card is drawn with no request; the poll reads it again. A function
         replacement, as every splice carrying typed words: a $' or $` in the notice was read as a pattern and pasted the
         page into the script, which then did not run (S7-R2 of the stage 7 review) */
      .replace("__BULL__", () => JSON.stringify({ lines: (bulletin && bulletin.lines) || [] }).replace(/</g, "\\u003c"))
      .replace("__PAY_SITE__", JSON.stringify(PAY_SITE)).replace("__PAY_ACCOUNTS__", JSON.stringify(PAY_ACCOUNTS))
      /* v695: the product marks, so the page can draw one wherever it would have written a name */
      .replace("__PSYM__", JSON.stringify(Object.assign({ _: RING }, PSYM)))
      .replace("__PSHAPE__", JSON.stringify(PSHAPE))
      /* F8: each letter with its drawing, only for a product that has one */
      .replace("__PLET__", () => JSON.stringify(Object.fromEntries(Object.keys(PLET).map((k) => [k, pletOf(k)]).filter((e) => e[1]))))
      /* S13 13.3: every word by key, both tables, and the functions that fill them, the page's own; the marks for a
         sentence the script words again. By function, so a $ in a word is kept as typed; "<" escaped, as the notice is */
      .replace("__WORDS__", () => JSON.stringify(WORDS).replace(/</g, "\\u003c"))
      .replace("/*__FILL__*/", () => [fill, fillHtml, unitsIn, glyphOf].map(String).join("\n"))
      .replace("__GLS__", () => JSON.stringify(GLYPH))
      /* S6 6.4: the pay sheet's three marks, and the one link into the pay page, its source carried as it is */
      .replace("__GLYPH__", JSON.stringify({ bank: GLYPH.bank, qr: GLYPH.qr, copy: GLYPH.copy, cash: GLYPH.cash, star: GLYPH.star }))
      .replace("/*__PAYHREF__*/", () => payHref.toString())
      /* 10 Oct 2026: a delivery's time window, the Worker's own rule carried as it is (stmt/window.js), so the sheet offers
         exactly the windows the Worker takes */
      .replace("/*__WINDOW__*/", () => [slotSpan, slotNext, openParts].map(String).join("\n")).replace("__WINDOWS__", JSON.stringify(WINDOWS))
      /* S4 4.6: the open-order limit the Worker refuses at, so the page can say it before the form */
      .replace("__MAX_OPEN__", String(MAX_OPEN)).replace("__WANT_DAYS__", String(WANT_DAYS)).replace("__OPEN_STATES__", JSON.stringify(OPEN_STATES)).replace("__TEST_USERS__", JSON.stringify(TEST_USERS))
      /* S7 7.1: the places, so the script names them as the markup does */
      .replace("__PLACES__", JSON.stringify(PLACES))
      /* "<" is escaped because this one carries the master passphrase, and a "</script>" inside a
         string literal ends the block wherever it appears: the browser closes the tag first and
         reads the rest of the passphrase as page text. A function replacement, so a $ in it is kept as typed. */
      .replace("__OWNER__", () => JSON.stringify(owner || null).replace(/</g, "\\u003c"))
      /* v687: the owner's script travels only on his route. A function replacement, so nothing in
         it is read as a $ pattern. */
      /* 20 Oct 2026: and with it the one distance (stmt/geo.js, engine/geo.mjs), carried as it is, so no customer's page carries it (Fable) */
      .replace("/*__OWNER_JS__*/", () => (owner ? String(GEO_ENGINE.haversineKm) + "\n" + OWNER_JS : ""))
      /* the test surface: the shim at the head of the script's scope, the door that signs itself in, and Salt Admin's practice mode;
         on a real page each marker is taken out, leaving the script it always was */
      .replace("/*__TS__*/", () => (test ? TEST_SHIM.replace("__TCFG__", JSON.stringify({ base: String(test.base || ""), owner: !!owner, u: test.u || "", pw: TEST_PASS })) : ""))
      .replace("/*__TS_DOOR__*/", () => (test ? TEST_DOOR : ""))
      .replace("/*__TESTING__*/false", () => (test ? "true" : "false"))
    + "</script>"
    + "</body></html>";
}

/* THE TEST SURFACE'S SHIM (his answers of 18 Oct 2026), spliced at the head of the script's scope on a page under /all/test alone. Its
   names shadow the browser's for everything in the script: fetch puts a request under the base (Salt Admin's /all/maker/ under
   /all/test/maker/), refuses any other /all road or a full address, and after a write that went through tells the other pane on the
   channel salt-test, which re-reads at once; localStorage and sessionStorage keep their keys under salt-test:, so a sign-in here never
   clears a real phone's memory (the look is read through from the real key when this pane has none of its own); navigator has no
   service worker and no credentials, so no worker, push or passkey is ever registered. No backtick and no lone backslash: it is
   spliced into the page's script as it is. */
const TEST_SHIM = `
  var TCFG=__TCFG__;
  var TS=(function(){
    var real=window.fetch.bind(window), P='salt-test:', hooks=[], ch=null;
    try{ ch=new BroadcastChannel('salt-test'); ch.onmessage=function(){ hooks.forEach(function(f){ try{ f(); }catch(e){} }); }; }catch(e){ ch=null; }
    function under(p){
      if(typeof p!=='string'||p.charAt(0)!=='/'||p.charAt(1)==='/') return null;
      if(p.indexOf('/all/maker/')===0) return TCFG.owner?'/all/test/maker/'+p.slice(11):null;
      if(TCFG.owner||p==='/all'||p.indexOf('/all/')===0) return null;
      return TCFG.base+p;
    }
    async function tfetch(p, o){
      /* this phone's own things (devices, a remembered phone, passkeys, push, hand-overs, slips) are answered here, never sent */
      if(!TCFG.owner&&typeof p==='string'&&/^[/](devices|remember|passkey|push|handover|slip|open-link)([/]|$)/.test(p))
        return new Response(JSON.stringify({ok:false, error:'Not on the test surface.'}), {status:404, headers:{'content-type':'application/json'}});
      var to=under(p);
      if(to==null) throw new TypeError('Not on the test surface.');
      var r=await real(to, o), m=String((o&&o.method)||'GET').toUpperCase();
      if(r.ok&&m!=='GET'&&ch){ try{ ch.postMessage({at:Date.now()}); }catch(e){} }
      return r;
    }
    function store(name){
      var s=null; try{ s=window[name]; }catch(e){ s=null; }
      function keys(){ var out=[]; for(var i=0;i<s.length;i++){ var k=s.key(i); if(k&&k.indexOf(P)===0) out.push(k.slice(P.length)); } return out; }
      var api={
        getItem:function(k){ var v=s.getItem(P+k); if(v==null&&k==='salt-look') v=s.getItem(k); return v; },
        setItem:function(k,v){ s.setItem(P+k,String(v)); },
        removeItem:function(k){ s.removeItem(P+k); },
        key:function(i){ var a=keys(); return i<a.length?a[i]:null; },
        clear:function(){ keys().forEach(function(k){ s.removeItem(P+k); }); }
      };
      return new Proxy(api,{
        ownKeys:function(){ return keys(); },
        getOwnPropertyDescriptor:function(t,k){ return keys().indexOf(k)>=0?{value:api.getItem(k),enumerable:true,configurable:true,writable:true}:undefined; },
        get:function(t,k){ if(k==='length') return keys().length; if(Object.prototype.hasOwnProperty.call(api,k)) return api[k]; return typeof k==='string'?api.getItem(k):undefined; }
      });
    }
    var nav=new Proxy(window.navigator,{
      has:function(t,k){ return k==='serviceWorker'||k==='credentials'?false:(k in t); },
      get:function(t,k){ if(k==='serviceWorker'||k==='credentials') return undefined; var v=t[k]; return typeof v==='function'?v.bind(t):v; }
    });
    return {fetch:tfetch, local:store('localStorage'), session:store('sessionStorage'), nav:nav, on:function(f){ hooks.push(f); }};
  })();
  var fetch=TS.fetch, localStorage=TS.local, sessionStorage=TS.session, navigator=TS.nav;
  TS.on(function(){
    if(OWNER){ loadMaker(true); loadMakerClaims(true); loadMakerThreads(true); }
    else if(session) refresh();
  });
`;
/* the customer view on the test surface: the door is filled with the account the shell names and the published test password, and sent;
   the remembered phone, the link, the hand-over and the saved app's code never run */
const TEST_DOOR = `
    gate.hidden=false;
    var remBox=document.getElementById('rem'); if(remBox) remBox.checked=false;
    if(TCFG.u){ un.value=TCFG.u; pw.value=TCFG.pw; document.getElementById('f').dispatchEvent(new Event('submit',{cancelable:true})); }
    return;
`;

/* Kept as one string rather than a file so the whole page is a single Worker response with a
   single nonce, and so nothing about a statement is ever a fetchable asset. */
const CLIENT_JS = `
(function(){/*__TS__*/
  /* THE TICKET INVALIDATES A FLOW THAT IS NO LONGER WANTED (04 Sep 2026 audit). A submit takes
     about a second in PBKDF2, and go.disabled does not stop the Enter key submitting a form at
     all, so a reader who pressed Enter twice had two flows in the air. Measured: he taps Lock now,
     the page locks, and three seconds later the second response lands and puts the whole statement
     back on screen with the countdown restarted, on a phone he has put down. The same thing
     happened through the natural three-minute expiry. Every await below is followed by a ticket
     check, and lock() bumps the ticket, so anything still in flight lands on nothing. */
  var POLL_MS=__POLL__, bundle=null, at=0, ticket=0, busy=false;
  /* THE NOTICE (20 Sep 2026): drawn from what the page was served with, read again every sixth poll. Counter Batch A (his decision of
     18 Oct 2026): one line at a time, the next every BULL_MS, a dot a line and Pause to hold it; under reduced motion every line stands
     and neither the dots, Pause nor a timer is drawn. The card is never a live region. */
  var BULL=__BULL__, bullN=0, BULL_MS=6000, bullAt=0, bullHeld=false, bullTimer=null;
  function bullStill(){ try{ return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; } }
  function bullShow(){
    var box=document.getElementById('bull'); if(!box) return;
    [].forEach.call(box.querySelectorAll('.salt-notice__line'),function(p,i){ p.classList.toggle('salt-notice__line--on',i===bullAt); });
    [].forEach.call(box.querySelectorAll('.salt-notice__dot'),function(d,i){ d.classList.toggle('salt-notice__dot--on',i===bullAt); });
  }
  function bullTurn(){ var n=(BULL.lines||[]).length; if(bullHeld||n<2) return; bullAt=(bullAt+1)%n; bullShow(); }
  function bullDraw(b){
    BULL=b||{lines:[]};
    var box=document.getElementById('bull'); if(!box) return;
    var lines=BULL.lines||[], still=bullStill(), turns=lines.length>1&&!still;
    box.hidden=!lines.length;
    var ls=box.querySelector('.salt-notice__lines'), dots=box.querySelector('.salt-notice__dots'), pz=box.querySelector('.salt-notice__pause');
    ls.textContent=''; dots.textContent='';
    if(bullAt>=lines.length) bullAt=0;
    lines.forEach(function(l,i){
      var p=document.createElement('p'); p.className='salt-notice__line'; p.textContent=l; ls.appendChild(p);
      if(turns){ var d=document.createElement('span'); d.className='salt-notice__dot'; dots.appendChild(d); }
    });
    dots.hidden=!turns; pz.hidden=!turns;
    bullShow();
    if(bullTimer){ clearInterval(bullTimer); bullTimer=null; }
    if(turns) bullTimer=setInterval(bullTurn,BULL_MS);
  }
  (function(){
    var bx=document.getElementById('bull'), pz=bx&&bx.querySelector('.salt-notice__pause'); if(!pz) return;
    pz.addEventListener('click',function(){
      bullHeld=!bullHeld; pz.setAttribute('aria-pressed',bullHeld?'true':'false');
      pz.setAttribute('aria-label',tw(bullHeld?'bull.play':'bull.pause')); pz.setAttribute('data-wl',bullHeld?'bull.play':'bull.pause');
    });
  })();
  /* the open or closed line, off /hours: Open until the next change, or Closed and when it opens; nothing while the hours are not read */
  function hhmm(iso){ try{ var k=klBits(iso); return k.hour+':'+k.minute; }catch(e){ return ''; } }
  function sameDay(iso){ try{ var a=klBits(iso), b=klBits(new Date().toISOString()); return a.day===b.day&&a.month===b.month&&a.year===b.year; }catch(e){ return false; } }
  function todayDraw(){
    var chip=document.getElementById('todayOpen'), line=document.getElementById('todayLine'); if(!chip||!line) return;
    var h=counterHours, known=!!h&&!hoursError&&typeof h.open==='boolean';
    chip.hidden=!known; line.hidden=!known;
    if(!known){ chip.textContent=''; line.textContent=''; return; }
    chip.className='today__open salt-status salt-status--'+(h.open?'verdigris':'mist'); chip.textContent=tw(h.open?'today.open':'today.closed');
    line.textContent='';
    var at=h.open?h.nextChange:h.nextOpen, lead=el('span','today__when');
    if(at) lead.textContent=h.open?tw(sameDay(at)?'today.until':'today.untilOn',{t:hhmm(at), d:stamp(at)}):tw(sameDay(at)?'today.opens':'today.opensOn',{t:hhmm(at), d:stamp(at)});
    if(lead.textContent){ line.appendChild(lead); line.appendChild(document.createTextNode(' ')); }
    line.appendChild(document.createTextNode(tw(h.open?'today.openB':'today.closedB')));
  }
  /* the test account asks on its session, and is answered the fixture's notice while none of his is set (stmt/testfix.js) */
  var TESTS=__TEST_USERS__;
  async function bullRead(){
    try{
      var r=await fetch('/bulletin',{cache:'no-store',headers:TESTS.indexOf(user)>=0&&session?{'X-Stmt-Session':session}:{}}); var j=await r.json();
      if(!j||!j.ok) return;
      if(JSON.stringify(j.lines||[])!==JSON.stringify(BULL.lines||[])) bullDraw({lines:j.lines||[]});
    }catch(e){}
  }
  window.bullDraw=bullDraw; window.bullRead=bullRead;   /* reachable from outside the closure, which is how the suite drives them */
  bullDraw(BULL);
  var PAY_SITE=__PAY_SITE__, PAY=__PAY_ACCOUNTS__;
  var session='', user='', prices=null, orders=[], pools=[], poll=null, tab='home', draft={}, counterHours=null, hoursError=false;
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
  /* 14 Oct 2026 (his review): every [data-clock] shows the time in Kuala Lumpur, digits only; painted on the
     minute and again whenever the page comes back into view, since a phone sleeps its timers */
  (function(){
    function clockPaint(){
      var p={};
      try{ new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
        .formatToParts(new Date()).forEach(function(x){ p[x.type]=x.value; }); }catch(e){ return; }
      var t=p.hour+':'+p.minute;
      [].forEach.call(document.querySelectorAll('[data-clock]'),function(n){ n.textContent=t; });
      if(window.barDraw) window.barDraw();
    }
    function clockTick(){ clockPaint(); setTimeout(clockTick,60000-Date.now()%60000+50); }
    clockTick();
    document.addEventListener('visibilitychange',function(){ if(!document.hidden) clockPaint(); });
  })();
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
     element and keeps its key and slots on it (data-w); the markup's keyed
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
  /* a refusal stands alone beside its control, so it is said as a sentence: the Worker's words are a clause, lower case
     with no stop, in either language (MY12 of the stage 13 review) */
  function sentence(t){ t=String(t||''); if(!t) return t; t=t.charAt(0).toUpperCase()+t.slice(1); return /[.!?]$/.test(t)?t:t+'.'; }
  /* C16 (29 Sep 2026): the Worker's English stands only for a refusal it coded (S13), never for a body with no code: a
     fault's own words ("no KV") are not a customer's. His page keeps them. */
  function wErr(b,fb,s){ var c=b&&b.code; return sentence(c&&has('en','e.'+c)?tw('e.'+c,b.vars):b&&b.said?tw(b.said):(b&&b.error&&(c||OWNER)?b.error:'')||(fb?tw(fb,s):'')); }
  /* and a 5xx is the site being busy, whatever its body says, unless it carries a refusal this table words */
  function busyOr(status,j){ return status>=500&&!(j&&j.code&&has('en','e.'+j.code))?{ok:false, said:'x.busy', busy:true}:j; }
  /* a date or a size in a sentence, said in the sentence's language */
  function Dd(f,x){ return function(L){ return f(x,L); }; }
  function Uq(q,u){ return function(L){ return unitsOf(q,u,L); }; }
  function Wk(k){ return function(L){ return wordIn(L,k); }; }
  /* a note kept to be shown later (draft.pushNote) is kept unworded, so it is said in the language of the place it shows in */
  function noteSaid(x){ return typeof x==='function'?x(LANG):(x||''); }
  /* the device's word, drawn into the markup as served */
  [].forEach.call(document.querySelectorAll('.dev'), function(x){ x.textContent=devIn(LANG); });
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
     next order is still the check.
     28 SEP 2026, HIS INSTRUCTION: ANY AMOUNT past its term holds, and the term is three days from the day the goods
     were collected or delivered (the publish's due); D9's RM 100 line is retired. */
  var hold=false, hidePrices=false, locked=false;
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
  var PSYM=__PSYM__, PSHAPE=__PSHAPE__, PLET=__PLET__;
  /* S13: a mark's name is the table's, by its shape (shape.<Shape>), so a screen reader says it in the reader's language */
  function pshape(product){ var n=PSHAPE[String(product||'').toLowerCase()]||PSHAPE._; return wordIn(LANG,'shape.'+n)||n; }
  /* F8: his letter in every book's mark, wherever it is drawn (psymSvg's twin); the aria stays the shape */
  function psym(product,px){
    var NS='http://www.w3.org/2000/svg', k=String(product||'').toLowerCase();
    var L=Object.prototype.hasOwnProperty.call(PLET,k)?PLET[k]:null;
    var svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('width',px); svg.setAttribute('height',px);
    svg.setAttribute('class','psym'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');
    var d=document.createElementNS(NS,'path');
    d.setAttribute('d',L?L.d:(PSYM[k]||PSYM._));
    d.setAttribute('fill','none'); d.setAttribute('stroke','currentColor'); d.setAttribute('stroke-width','1.4');
    d.setAttribute('stroke-linejoin','round'); d.setAttribute('stroke-linecap','round');
    svg.appendChild(d);
    if(L){
      var t=document.createElementNS(NS,'text');
      t.setAttribute('class','plet'); t.setAttribute('x','12'); t.setAttribute('y',String(L.y)); t.setAttribute('font-size',String(L.s));
      t.setAttribute('text-anchor','middle'); t.setAttribute('fill','currentColor'); t.textContent=L.l;
      svg.appendChild(t);
    }
    return svg;
  }
  /* a size and its mark, as one phrase: "2.5 unit" then the cube; outside a card alone (his note of 28 Sep 2026) */
  function withMark(product,text,px){
    var w=el('span','pwith'); w.appendChild(document.createTextNode(text));
    w.appendChild(psym(product,px||20));
    w.appendChild(el('span','sr',pshape(product)));
    return w;
  }
  /* a book's heading: its mark alone, named by the shape (and by its light, where it has one); no shape word is drawn (his word of 12 Oct 2026) */
  function pmarkHead(tag,product){
    var h=el(tag,'pmark'); h.setAttribute('aria-label',pshape(product)); h.appendChild(psym(product,28));
    return h;
  }
  /* a mark leading a note: the lines of a sheet that several products share; a reader is told the shape and nothing but the mark is drawn */
  function markLead(product,px){
    var f=document.createDocumentFragment(); f.appendChild(psym(product,px)); f.appendChild(el('span','sr',pshape(product))); f.appendChild(document.createTextNode(' '));
    return f;
  }
  /* IN A CARD THE MARK IS A BUTTON AND ITS CAPTION SITS UNDER IT, the size in words ("2.5 units"); a reader hears the shape and the size
     once (mtileSvg's twin). The shape word is never drawn (his word of 12 Oct 2026). */
  function mtile(product,q,u,px){
    var w=el('span','mtile'), words=unitsOf(q,u); w.appendChild(el('span','sr',pshape(product)+' '+words));
    w.appendChild(psym(product,px||28));
    var f=el('span','mq',words); f.setAttribute('aria-hidden','true'); w.appendChild(f);
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
      if(/^0+1?$/.test(got)||!ALPHA.test(got)){ raw=got; break; }
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
     and its one answer. The test accounts' zeros, the second's one and the third's two, are their own (v689; 0000-0002 on 19 Oct 2026). */
  function unfit(v, n, what){
    var raw=clean(v);
    return raw.length===n&&!/^0+[0-2]?$/.test(raw)&&ALPHA.test(raw)?tw(what==='username'?'door.unfitUn':'door.unfitPw'):'';
  }

  function el(tag,cls,text){ var e=document.createElement(tag); if(cls)e.className=cls; if(text!=null)e.textContent=text; return e; }
  /* 20 Oct 2026 (Counter Batch C, item 21): a choice of two to six is the system's slider, .salt-segment. Its columns (--n, the options
     shown) and its thumb (--i, the one chosen) are set here, since the page's style-src refuses a style attribute; the chosen option is
     the one marked aria-selected or aria-pressed, and carries the recipe's active class. Every handler that moves a choice calls it. */
  function segSync(g){
    if(!g) return;
    var b=[].filter.call(g.children,function(x){ return x.tagName==='BUTTON'&&!x.hidden; }), at=0;
    b.forEach(function(x,k){ var on=x.getAttribute('aria-selected')==='true'||x.getAttribute('aria-pressed')==='true'; x.classList.toggle('salt-segment__opt--active',on); if(on) at=k; });
    g.style.setProperty('--n',String(b.length||1)); g.style.setProperty('--i',String(at));
  }
  /* 28 Sep 2026: NO DRAW ASKS WHETHER THE PAGE IS STILL THERE. A page that has gone runs no script, and jsdom from 30.1.0 keeps
     a closed window's document, so the guard S9 and the S7 merge put on every late draw could never fire (docs/WORKING.md 3) */
  /* C5 (29 Sep 2026): ONE MONEY FORM ON THE COUNTER, RM and two places, as the statement's lines print it */
  function rm(n){ return 'RM '+Number(n||0).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}); }
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
    try{ var p=klBits(iso); return dmyOf(p,L)+', '+p.hour+':'+p.minute; }catch(e){ return ''; }
  }
  /* C17 (29 Sep 2026): EVERY DATE ON THE COUNTER IS DD Mon YYYY, the time in 24 hours after it where there is one, and a
     weekday only in front of a due date (dayName). Five shapes before it, none with a year. */
  function dmyOf(p,L){ return ('0'+p.day).slice(-2)+' '+mon3(L)[+p.month-1]+' '+p.year; }

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
  /* ---- A PASSKEY (Step 6, his decisions of 29 Sep 2026; the Worker's half is stmt/passkey.js) ---------------------------
     Signed in, This device saves a passkey in whatever keeps theirs, and the door's Open with a passkey signs them in with
     it. The content key is sealed under two halves: the share the Worker hands back once the passkey's signature checks,
     and either 32 bytes this browser keeps or the secret the passkey returns where its store gives one, which opens it on
     every device the passkey reaches. With neither on this device, the door asks for the password once and files this
     device's wrap after it (pkWait). Log out keeps the passkey (his decision); Remove, Sign out everywhere and his own
     Sign out end it. A challenge is fetched before the tap wherever it can be, so the tap calls the passkey at once. */
  var PK='salt-stmt-passkey', PKOK=!!(window.PublicKeyCredential&&navigator.credentials&&navigator.credentials.create&&window.crypto&&crypto.subtle);
  var PKSALT=null, pkCh=null, pkNew=null, pkWait=null;
  function pkGet(){ try{ var s=localStorage.getItem(PK); return s?JSON.parse(s):null; }catch(e){ return null; } }
  function pkSet(v){ try{ localStorage.setItem(PK, JSON.stringify(v)); }catch(e){ /* this device keeps nothing, and the password still opens it */ } }
  function pkClear(){ try{ localStorage.removeItem(PK); }catch(e){} }
  function pkMine(){ var r=pkGet(); return r&&r.u===user&&r.c?r:null; }
  function b64ue(buf){ return b64e(buf).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/=+$/,''); }
  function b64ud(t){ var s=String(t||'').replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return b64d(s); }
  if(PKOK){ try{ crypto.subtle.digest('SHA-256', new TextEncoder().encode('salt-counter passkey prf v1')).then(function(d){ PKSALT=new Uint8Array(d); }, function(){}); }catch(e){ PKOK=false; } }
  function pkFresh(x){ return !!x&&Date.now()-x.at<240000; }
  async function pkKek(half, share){
    var a=new Uint8Array(half), b=b64ud(share), ikm=new Uint8Array(a.length+b.length); ikm.set(a,0); ikm.set(b,a.length);
    var base=await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'HKDF', hash:'SHA-256', salt:new Uint8Array(0), info:new TextEncoder().encode('salt-counter passkey v1')},
      base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }
  async function pkSeal(half, share, ck){
    var k=await pkKek(half, share), iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=await crypto.subtle.encrypt({name:'AES-GCM', iv:iv}, k, await crypto.subtle.exportKey('raw', ck));
    return {v:3, iv:b64e(iv), ct:b64e(ct)};
  }
  async function pkUnseal(half, share, w){
    var k=await pkKek(half, share), raw=await crypto.subtle.decrypt({name:'AES-GCM', iv:b64d(w.iv)}, k, b64d(w.ct));
    return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, true, ['decrypt']);
  }
  function pkSecret(cred){ try{ var x=cred.getClientExtensionResults(); return x&&x.prf&&x.prf.results&&x.prf.results.first?new Uint8Array(x.prf.results.first):null; }catch(e){ return null; } }
  function pkSigned(cred, extra){
    var r=cred.response;
    return Object.assign({id:cred.id, clientData:b64ue(r.clientDataJSON), authData:b64ue(r.authenticatorData), sig:b64ue(r.signature)}, extra||{});
  }
  function pkAsk(ch, ids){
    return navigator.credentials.get({publicKey:{challenge:b64ud(ch), userVerification:'required', timeout:60000,
      allowCredentials:(ids||[]).map(function(i){ return {type:'public-key', id:b64ud(i)}; }), extensions:{prf:{eval:{first:PKSALT}}}}});
  }
  /* the door's challenge, fetched while the door is on screen */
  async function pkPrime(){
    if(!PKOK||OWNER||session||pkFresh(pkCh)) return pkCh;
    try{
      var r=await fetch('/passkey/challenge',{method:'POST', cache:'no-store', headers:{'content-type':'application/json'}, body:'{}'});
      var j=await r.json();
      if(r.ok&&j.ok&&j.challenge) pkCh={c:j.challenge, at:Date.now()};
    }catch(e){ /* the tap fetches one */ }
    return pkCh;
  }
  /* This device's challenge, with the share a new passkey keeps and the passkeys the account already has */
  async function pkPrep(){
    if(!PKOK||!session||OWNER||view) return null;
    if(pkFresh(pkNew)&&pkNew.u===user) return pkNew;
    var u0=user, x=await api('/passkey/new', {});
    if(!x.body.ok||u0!==user) return null;
    pkNew={u:u0, at:Date.now(), c:x.body.challenge, share:x.body.share, user:x.body.user, has:x.body.has||[]};
    return pkNew;
  }
  var pkGo=document.getElementById('pkGo');
  if(pkGo&&PKOK&&!OWNER){ pkGo.hidden=false; pkGo.addEventListener('click', pkDoor); }
  /* a second tap while the first waits for the passkey does nothing: it would take the ticket from the first, which then
     drops the passkey the customer completes, and the browser refuses a second prompt while one is open */
  var pkBusy=false;
  async function pkDoor(){
    if(busy||pkBusy) return;
    pkBusy=true;
    try{ await pkOpen(); } finally{ pkBusy=false; }
  }
  async function pkOpen(){
    var ch=pkFresh(pkCh)?pkCh:await pkPrime(); pkCh=null;
    if(!ch||!PKSALT){ say(tw('x.notSent'),'bad'); return; }
    var mine=++ticket, stale=function(){ return mine!==ticket; }, rec=pkGet(), cred;
    try{ cred=await pkAsk(ch.c, []); }catch(e){ if(!stale()) say(''); pkPrime(); return; }
    if(stale()) return;
    say(tw('x.opening'),'wait');
    var sec=pkSecret(cred), r, body;
    try{
      r=await fetch('/passkey/open',{method:'POST', cache:'no-store', headers:{'content-type':'application/json'},
        body:JSON.stringify(pkSigned(cred,{challenge:ch.c, t:rec&&rec.c===cred.id?rec.t||null:null, prf:!!sec}))});
      body=await r.json();
    }catch(e){ if(!stale()) say(tw('x.notSent'),'bad'); pkPrime(); return; }
    if(stale()) return;
    if(!r.ok||!body||!body.ok){ say(wErr(body,'x.notSent'),'bad'); pkPrime(); return; }
    /* nothing on this device yet: the password once, and this device's wrap is filed after it */
    if(body.once){
      pkWait={id:cred.id, u:body.u, share:body.share, sec:sec};
      un.value=body.u; pw.value=''; say(tw('door.pkOnce'),'wait'); try{ pw.focus(); }catch(e){}
      pkPrime(); return;
    }
    var ck=null, b;
    if(sec&&body.prfWrap){ try{ ck=await pkUnseal(sec, body.share, body.prfWrap); }catch(e){ ck=null; } }
    if(!ck&&body.wrap&&rec&&rec.k){ try{ ck=await pkUnseal(b64d(rec.k), body.share, body.wrap); }catch(e){ ck=null; } }
    try{ if(!ck) throw 0; b=JSON.parse(await open(ck, body.env)); }
    catch(e){ if(!stale()) say(tw('e.pkNot'),'bad'); pkPrime(); return; }
    if(stale()) return;
    var x=await openBeside(body, ck, b);
    if(stale()) return;
    enter(body.u, body, b, x, ck, false);
    /* the first device whose passkey gives a secret files the passkey's roaming wrap */
    if(sec&&!body.prfWrap){ pkSeal(sec, body.share, ck).then(function(w){ return api('/passkey/wrap',{id:cred.id, prfWrap:w}); }).catch(function(){}); }
    if(!(await follow(stale))) return;
    askPush();
  }
  /* after the password once: this device's wrap under the passkey the door just checked */
  async function pkAttach(u, ck){
    var w=pkWait; pkWait=null;
    if(!w||w.u!==u||!session||!ck) return;
    try{
      var half=crypto.getRandomValues(new Uint8Array(32)), body={id:w.id, wrap:await pkSeal(half, w.share, ck)};
      if(w.sec) body.prfWrap=await pkSeal(w.sec, w.share, ck);
      var x=await api('/passkey/wrap', body);
      if(x.body.ok&&x.body.t){ pkSet({u:u, c:w.id, t:x.body.t, k:b64e(half)}); devSaid={t:tw('dev.pkLinked'),bad:false}; drawDev(); }
    }catch(e){ /* the passkey still opens every device it reached; this one asks for the password once again */ }
  }
  /* This device: save a passkey, or use the one the account has on this device too */
  async function pkSave(btn, reuse){
    var n=await pkPrep(); pkNew=null;
    if(!n||!PKSALT||!curCk){ devSaid={t:tw('dev.pkNotSaved'),bad:true}; drawDev(); return; }
    btn.disabled=true; btn.textContent=tw('dev.pkWaiting');
    var cred, half=crypto.getRandomValues(new Uint8Array(32));
    try{
      if(reuse){
        cred=await pkAsk(n.c, n.has);
        var sec=pkSecret(cred), x=await api('/passkey/link', pkSigned(cred,{challenge:n.c}));
        if(!x.body.ok) throw x.body;
        var body={id:cred.id, wrap:await pkSeal(half, x.body.share, curCk)};
        if(sec&&!x.body.roams) body.prfWrap=await pkSeal(sec, x.body.share, curCk);
        var y=await api('/passkey/wrap', body);
        if(!y.body.ok||!y.body.t) throw y.body;
        pkSet({u:user, c:cred.id, t:y.body.t, k:b64e(half)});
        devSaid={t:tw('dev.pkLinked'),bad:false};
      }else{
        cred=await navigator.credentials.create({publicKey:{rp:{name:tw('pk.rp')}, user:{id:b64ud(n.user), name:user, displayName:user},
          challenge:b64ud(n.c), pubKeyCredParams:[{type:'public-key', alg:-7},{type:'public-key', alg:-8},{type:'public-key', alg:-257}],
          authenticatorSelection:{residentKey:'required', requireResidentKey:true, userVerification:'required'}, attestation:'none', timeout:60000,
          extensions:{prf:{eval:{first:PKSALT}}}}});
        var r=cred.response, spki=r.getPublicKey?r.getPublicKey():null, ad=r.getAuthenticatorData?r.getAuthenticatorData():null;
        if(!spki||!ad) throw 0;
        var sec2=pkSecret(cred), sb={challenge:n.c, id:cred.id, clientData:b64ue(r.clientDataJSON), authData:b64ue(ad), spki:b64e(spki),
          alg:r.getPublicKeyAlgorithm?r.getPublicKeyAlgorithm():null, wrap:await pkSeal(half, n.share, curCk)};
        if(sec2) sb.prfWrap=await pkSeal(sec2, n.share, curCk);
        var z=await api('/passkey/save', sb);
        if(!z.body.ok||!z.body.t) throw z.body;
        pkSet({u:user, c:cred.id, t:z.body.t, k:b64e(half)});
        devSaid={t:tw('dev.pkSaved'),bad:false};
      }
    }catch(e){ devSaid={t:e&&(e.code||e.said)?wErr(e,'dev.pkNotSaved'):tw('dev.pkNotSaved'),bad:true}; }
    drawDev();
  }
  /* This device's passkey removed from the account; the store keeps its copy, which then opens nothing */
  async function pkRemove(){
    var m=pkMine(); if(!m) return;
    var x=await api('/passkey/remove',{id:m.c});
    if(x.body.ok){ pkClear(); devSaid={t:tw('dev.pkRemoved'),bad:false}; }
    else devSaid={t:wErr(x.body,'x.notSent'),bad:true};
    drawDev();
  }
  /* ---- OPTIONAL INSTALL GUIDE (S3 3.10) -----------------------------------------------------------------------
     Browser access is the default. The guide lives under This device and keeps the one-use hand-over for iPhone
     installs whose Home Screen app has separate storage. */
  var keepCardEl=document.getElementById('keepCard'), keepCode=document.getElementById('keepCode'),
      keepCopy=document.getElementById('keepCopy'), keepMsg=document.getElementById('keepMsg');
  var keepTok='', keepN=0, keepMinted=[], keepMinting=false;   /* S3 fix: every key this page minted, for Log out to burn */
  /* S3 3.12: WHERE THE BROWSER OFFERS AN INSTALL, ONE BUTTON TAKES IT (beforeinstallprompt; the app it installs
     shares this browser's storage, so it opens signed in). Where it does not, Samsung Internet's own steps are drawn,
     and a computer's Chrome or Edge is pointed at the install mark in its address bar; nothing says phone there. A
     browser that can keep no app (Firefox on a computer, an app's own browser, any that offers no install) is told
     which browsers can. */
  var bip=null, keepDone=false;   /* Installed from this browser, which remains usable after the install. */
  var SAMSUNG=/SamsungBrowser/.test(UA), ANDROID=/Android/.test(UA), DESKTOP=!IOS&&!/Mobi|Android/.test(UA), CHROMIUM=/Chrome[/]|Chromium|Edg[/]/.test(UA);
  function keepOffer(){ return !!session&&!OWNER&&!view&&!STANDALONE; }
  function keepMode(){
    if(!keepOffer()) return '';
    if(INAPP) return 'none';
    return IOS?'ios':keepDone?'done':bip?'install':SAMSUNG?'samsung':(DESKTOP&&CHROMIUM)?'desk':ANDROID?'droid':'none';
  }
  function drawKeep(){
    if(!keepCardEl) return;
    var mode=keepMode();
    keepCardEl.hidden=!mode;
    if(!mode) return;
    var k=mode==='ios'?'':mode==='none'?'None':mode==='done'?'Done':'App';
    setW(document.getElementById('keepHead'),'keep.h'+k);
    setW(document.getElementById('keepLead'),'keep.lead'+k);
    document.getElementById('keepIos').hidden=mode!=='ios';
    document.getElementById('keepInstall').hidden=mode!=='install';
    document.getElementById('keepSam').hidden=mode!=='samsung';
    document.getElementById('keepDesk').hidden=mode!=='desk';
    document.getElementById('keepDroid').hidden=mode!=='droid';
    if(mode==='ios'&&!keepTok&&!keepMinting) mintKeep();
  }
  window.addEventListener('beforeinstallprompt', function(ev){ ev.preventDefault(); bip=ev; drawKeep(); drawDevice(); });
  window.addEventListener('appinstalled', function(){ bip=null; keepDone=true; drawKeep(); drawDevice(); });
  function ksay(t,cls){ keepMsg.textContent=t||''; keepMsg.className='msg'+(cls?' '+cls:''); }
  async function mintKeep(){
    if(!curCk) return;
    var n=++keepN;
    keepMinting=true;
    keepCopy.disabled=true; keepCode.value=''; ksay(tw('keep.making'),'wait');
    try{
      var tok=b64e(crypto.getRandomValues(new Uint8Array(24))).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/=+$/,'');
      var wrap=await wrapUnder(new TextEncoder().encode(tok), curCk);
      var r=await api('/handover',{token:tok, wrap:wrap});
      if(n!==keepN||keepCardEl.hidden) return;
      if(r.status===503){ ksay(tw('keep.off'),'bad'); return; }
      if(!r.body.ok||!r.body.code){ ksay(r.status===401?wErr(r.body):tw('code.notMade'),'bad'); return; }
      keepTok=r.body.token||tok; keepMinted=keepMinted.concat(keepTok).slice(-10);
      keepCode.value=String(r.body.code).toUpperCase().replace('-',' ');
      keepCopy.disabled=false; ksay('');
    }catch(e){ if(n===keepN) ksay(tw('code.notMade'),'bad'); }
    finally{ if(n===keepN) keepMinting=false; }
  }
  /* signing out forgets the code drawn (a copy already made still works in the app for its fifteen minutes) */
  function keepReset(){
    if(!keepCardEl) return;
    keepN++; keepMinting=false; keepTok=''; keepCode.value=''; keepCopy.disabled=true; ksay('');
    keepCardEl.hidden=true;
  }
  /* the browser's own question, asked inside the tap; it can be asked once, so the event is spent here */
  function keepInstallGo(){
    if(!bip) return;
    var e=bip; bip=null;
    try{ e.prompt(); }catch(x){ drawKeep(); drawDevice(); return; }
    Promise.resolve(e.userChoice).then(function(c){ if(c&&c.outcome==='accepted') keepDone=true; drawKeep(); drawDevice(); }, function(){ drawKeep(); drawDevice(); });
  }
  if(keepCardEl){
    document.getElementById('keepInstall').addEventListener('click', keepInstallGo);
    keepCopy.addEventListener('click', function(){
      if(!keepTok) return;
      /* the tap's first act, before anything that waits: Safari allows a copy only inside the tap itself */
      var done=null;
      try{ done=navigator.clipboard.writeText(keepTok); }catch(e){ done=Promise.reject(e); }
      try{ history.replaceState(history.state,'','/app#'+keepTok); }catch(e){}
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
  function devDay(iso,L){ try{ var p=klBits(iso), q=klBits(new Date().toISOString()); return p.day===q.day&&p.month===q.month&&p.year===q.year?p.hour+':'+p.minute:dmyOf(p,L); }catch(e){ return ''; } }
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
      var pm=pkMine(), x=await fetch('/devices',{method:'POST', cache:'no-store', headers:{'content-type':'application/json','X-Stmt-Session':session},
        body:JSON.stringify({token:tok, passkey:pm?pm.c:null})});
      var j=null; try{ j=await x.json(); }catch(e){ j=null; }
      r={status:x.status, body:j||{ok:false}};
    }catch(e){ /* not sent: the card says so */ }
    if(n!==devN||!session) return;
    /* the list is drawn afresh: a control in it that holds focus (Sign in another device, as its Sheet closes) is given it again */
    var held=document.activeElement&&devSlot.contains(document.activeElement)?document.activeElement.getAttribute('data-back')||'':'';
    devSlot.textContent='';
    var list=el('div','salt-ledger salt-ledger--plain');
    var devs=(r.body&&r.body.devices)||[], others=devs.filter(function(d){ return !d.here; }).length;
    devs.forEach(function(d){
      list.appendChild(devLine(devName(d.label)||tw('dev.aDevice'), d.here?chipEl('verdigris',tw('dev.thisOne')):null,
        d.passkey?tw('dev.pkKept',{a:Dd(devDay,d.at), b:Dd(devDay,d.last)}):d.kept?tw('dev.kept',{a:Dd(devDay,d.at), b:Dd(devDay,d.last)}):tw('dev.visit',{a:Dd(devDay,d.at)})));
    });
    if(!r.body.ok) list.appendChild(devLine(tw('dev.yours'), null, r.status===401?tw('dev.signinSee'):tw('dev.unread')));
    devSlot.appendChild(list);
    var acts=el('div','dacts'), note=el('p','dnote'+(devSaid.bad?' bad':''),devSaid.t); note.setAttribute('role','status');
    var another=devQuiet(tw('dev.another')); another.setAttribute('data-back','dev:another'); another.addEventListener('click', function(){ openDevSheet(another); });
    acts.appendChild(another);
    if(others){
      var so=devQuiet(tw('dev.outOthers')), armed=null;
      so.addEventListener('click', async function(){
        if(!armed){ so.textContent=tw('dev.outAgain'); armed=setTimeout(function(){ armed=null; so.textContent=tw('dev.outOthers'); }, 4000); return; }
        clearTimeout(armed); armed=null; so.disabled=true; so.textContent=tw('dev.outGoing');
        var s2=null; try{ s2=await phoneSub(); }catch(e){}
        var rr=remGet(), pm2=pkMine(), x=await api('/devices/signout',{token:rr&&rr.u===user?rr.t||null:null, passkey:pm2?pm2.c:null, endpoint:s2?s2.endpoint:null});
        devSaid=x.body.ok?{t:x.body.devices?tw(x.body.devices===1?'dev.outOne':'dev.outMany',{n:x.body.devices}):tw('dev.outNone'),bad:false}
          :{t:wErr(x.body,'x.notSent'),bad:true};
        drawDev();
      });
      acts.appendChild(so);
    }
    /* Step 6: this device's passkey, removed on a second tap; or one saved, or the account's used here too */
    if(PKOK){
      var pmine=pkMine();
      if(pmine){
        var pr=devQuiet(tw('dev.pkRemove')), parmed=null;
        pr.addEventListener('click', function(){
          if(!parmed){ pr.textContent=tw('dev.pkAgain'); parmed=setTimeout(function(){ parmed=null; pr.textContent=tw('dev.pkRemove'); }, 4000); return; }
          clearTimeout(parmed); parmed=null; pr.disabled=true; pkRemove();
        });
        acts.appendChild(pr);
      }else{
        var pn=await pkPrep();
        if(n!==devN||!session) return;
        var has=!!pn&&pn.has.length>0;
        if(has){ var pu=devQuiet(tw('dev.pkUse')); pu.addEventListener('click', function(){ pkSave(pu, true); }); acts.appendChild(pu); }
        var ps=devQuiet(tw(has?'dev.pkNew':'dev.pkSave')); ps.addEventListener('click', function(){ pkSave(ps, false); }); acts.appendChild(ps);
      }
    }
    devSlot.appendChild(acts); devSlot.appendChild(note);
    if(held&&(!document.activeElement||document.activeElement===document.body)) focusBack(null,backFind(held));
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
      if(n!==devM||devSheetEl.hidden) return;
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
    devFrom=from; devScrim.hidden=false; devSheetEl.hidden=false; behind(); bkOpen('dev',closeDevSheet);
    try{ devSheetEl.focus(); }catch(e){}
    mintDev();
  }
  function closeDevSheet(){
    if(!devSheetEl||devSheetEl.hidden) return;
    devSheetEl.hidden=true; devScrim.hidden=true; behind(); bkDrop('dev'); devM++; devHo=''; devCode.value=''; devCopy.disabled=true; dsay('');
    focusBack(devFrom,backFind('dev:another'));
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
    try{ if(location.hash) history.replaceState(history.state,'','/app'); }catch(e){}
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
    liveStop();   /* Speed Wave 2 L2: Log out closes the socket */
    thClose(); thPut(null); thOut=[]; thSig=''; thWhy='';
    bundle=null; session=''; view=false; prices=null; orders=[]; pools=[]; claims=[]; ordersFailed=false; draft={}; seenMem=null; assoc=false; card=null; cardMonth=null; myLinks=null; myMax=0; myNote='';
    hold=false; hidePrices=false; locked=false; payDue=null; liveAt='';
    parkMonths(); out.textContent=''; at=0; devNote=''; drawDevice();
    mfil.textContent=''; mfil.hidden=true; mfPick=null; mfnote.textContent='';
    pPrices.textContent=''; pOrder.textContent=''; drawHome();
    tabs.hidden=true; barw.hidden=true; lapse.hidden=true; if(linkBox) linkBox.hidden=true;
    curCk=null; closeSignedOut(true); if(opening) opening.hidden=true;
    keepReset(); closePay(true); if(codeBox) codeBox.hidden=true;
    closeDevSheet(); lookShut(); ynShut(true); devN++; if(devSlot) devSlot.textContent='';
    pkNew=null; if(!OWNER) pkPrime();   /* Step 6: the door is on screen again */
    /* S3 fix: a key the Keep Sheet wrote into the address leaves it with the account */
    try{ if(location.hash) history.replaceState(history.state,'',location.pathname); }catch(e){}
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
  /* 11 Oct 2026 (Phase 7d part 2, his yes): SIGN OUT IS A TAP AND A TAP AGAIN, on the one control and never the browser's confirm. The
     first tap arms it and says so in its own words; a second inside LOCK_MS signs out exactly as it did (logOut); left alone the
     arm lets go by itself and the words come back. His own way back to his list, which shares the id on his page, is a plain tap. */
  var LOCK_MS=4000, lockEl=document.getElementById('lock'), lockArm=null;
  function lockRest(){ if(lockArm){ clearTimeout(lockArm); lockArm=null; } if(!OWNER) setW(lockEl,'dev.out'); }
  lockEl.addEventListener('click', function(){
    if(OWNER){ logOut(); return; }
    if(lockArm){ lockRest(); logOut(); return; }
    setW(lockEl,'dev.outAsk'); lockArm=setTimeout(lockRest, LOCK_MS);
  });
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
  /* what a lapse lets go besides the page's own: his script adds the one unlock's lock (stmt/owner.js), a customer's page adds nothing */
  var lapseHooks=[];
  function lapsed(){
    lapseHooks.forEach(function(f){ f(); });
    /* S4 fix: the order sheet lies over the bar, so a lapse closes it; Continue is then in reach, and the sheet will
       not open again until it is tapped (sheetOpen). What was chosen and typed in it stays in draft, and the same account
       let in again opens it again at the form (enter), so an order they were writing is kept, as S3 3.5 keeps it */
    if(osh&&!view&&(draft.step==='form'||draft.step==='check'||draft.step==='ask')) draft.sheetBack=true;
    ynShut(true);   /* 11 Oct 2026: a question open when the session lapses goes with it, never left over the door */
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
    outScrim.hidden=false; outSheet.hidden=false; behind(); bkOpen('out',closeSignedOut);
    try{ pw.focus(); }catch(e){}
  }
  /* quiet (=== true) when the page is leaving it, a sign-in done or a log out: focus has nowhere to go back to. Otherwise back to the bar's Sign in, whichever way it closed */
  function closeSignedOut(quiet){
    if(!outSheet||outSheet.hidden) return;
    outSheet.hidden=true; outScrim.hidden=true; behind(); bkDrop('out');
    /* S3 fix: back where it came from, and the code screen too if the Sheet took it */
    gate.insertBefore(doorBox, doorNext); doorBox.hidden=false;
    if(codeHome&&outSheet.contains(codeBox)){ codeHome.p.insertBefore(codeBox, codeHome.n); codeBox.hidden=true; }
    if(quiet!==true) focusBack(null,function(){ return document.getElementById('lapseGo'); });
  }
  if(outSheet){
    document.getElementById('outX').addEventListener('click', function(){ closeSignedOut(); });
    outScrim.addEventListener('click', function(){ closeSignedOut(); });
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
  /* 11 Oct 2026: on his page the address is his own (#orders, #record, ...), so a customer's place is never read off it, and the
     account he opens to view always opens on Home */
  var wantPlace=OWNER?'':placeOf(location.hash);
  function placeShow(t,tapped){
    if(!PANEL[t]||placeBtns(t)[0].hidden) t='home';
    sheetClose();
    tab=t; tabs.setAttribute('data-place',t);
    [].forEach.call(tabs.querySelectorAll('button[data-t]'),function(b){ if(b.getAttribute('data-t')===t) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    Object.keys(PANEL).forEach(function(k){ PANEL[k].hidden=k!==t; });
    placeTitle();
    if(tapped&&(!location.hash||placeOf(location.hash))){
      var p=PLACES.filter(function(x){ return x[0]===t; })[0];
      try{ history.replaceState(history.state,'',location.pathname+location.search+'#'+p[2]); }catch(e){}
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
  /* C15 and C14 (29 Sep 2026): WHAT COULD NOT BE READ SAYS SO, with Try again, and is never drawn as an empty or an older
     account. The live document held for (bad), and orders whose read failed (ordersFailed, kept as they last stood). */
  var ordersFailed=false;
  /* PHASE 7D4 (his yes of 11 Oct 2026): A READ THAT FAILS AFTER ONE THAT WORKED SAYS WHEN THE PAGE LAST READ, and leads Home in place of the
     figure it can no longer vouch for: "Not updated since 10:42" in Kuala Lumpur, 24 hours, and the day as DD Mon once it is not today. The
     orders' read keeps the time (every ten seconds and on a return), so being offline and a read the site refused both come to it; the next
     good read clears the line and brings the figure and its Pay back. A page that has not yet read once has nothing to date, and says what
     it said before (unreadNode). */
  var readAt=0;
  function staleNow(){ return !!session&&!view&&!OWNER&&ordersFailed&&readAt>0; }
  function readSince(){
    var then=klBits(new Date(readAt).toISOString()), now=klBits(new Date().toISOString());
    return then.day===now.day&&then.month===now.month&&then.year===now.year?then.hour+':'+then.minute:then.day+' '+mon3()[+then.month-1];
  }
  function staleNode(){
    var box=el('div','panel unread'); box.setAttribute('data-stale','');
    var p=el('p','lead',tw('read.since',{t:readSince()})); p.setAttribute('role','status'); box.appendChild(p);
    return box;
  }
  function liveBad(){ var s=bundle&&bundle.statements.filter(function(x){ return x.live&&x.bad; })[0]; return s?s.bad:''; }
  function unreadNode(key,go){
    var box=el('div','panel unread'); box.setAttribute('data-unread',key);
    var p=el('p','lead',tw(key)); p.setAttribute('role','status'); box.appendChild(p);
    if(go&&session&&!view&&!OWNER){
      var b=el('button','btn salt-ghost',tw('door.again')); b.type='button';
      b.addEventListener('click',async function(){ b.disabled=true; try{ await go(); }finally{ b.disabled=false; } });
      box.appendChild(b);
    }
    return box;
  }
  async function retryAccount(){ await reread(); if(liveBad()) pickStmt(0); drawPayHead(); }
  async function retryOrders(){ await oReread(); }

  /* ---- ACCOUNT (S7 7.3, the plan's section 4, his "all recommended" of 24 Sep 2026) -------------------------------
     The statement as stacked lines, ONE month filter with All first, and This device. No earlier statement is drawn (14 Oct 2026).
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
      mfil.hidden=true; mfnote.textContent='';
      return;
    }
    /* C15: never an older document in its place */
    if(s.bad){
      out.textContent=''; out.appendChild(unreadNode(s.bad,s.bad==='acct.unread'?retryAccount:null));
      mfil.hidden=true; mfnote.textContent='';
      return;
    }
    out.innerHTML=s.body;
    drawMonths();
    window.scrollTo(0,0);
  }

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
    /* C9: a list the month leaves empty goes with its heading, Refunds with nothing of that month under it */
    var ls=out.querySelectorAll('.salt-lines');
    for(var j=0;j<ls.length;j++){
      var rs=ls[j].querySelectorAll('.salt-lines__row'), any=false;
      for(var q=0;q<rs.length;q++) if(rs[q].style.display!=='none') any=true;
      var gone=rs.length>0&&!any, hd=ls[j].previousElementSibling;
      ls[j].style.display=gone?'none':'';
      if(hd&&hd.tagName==='H3') hd.style.display=gone?'none':'';
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
    /* above the heading of a list that has one (C9: an account whose first dated rows are its refunds) */
    if(list&&list.previousElementSibling&&list.previousElementSibling.tagName==='H3') list=list.previousElementSibling;
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
  /* ---- THE BELL (Step 1b, his Q3 of 28 Sep 2026; his sentences 3.1 and 3.3) ------------------------------------------
     On every view of the saved app, in the header. While notifications are not on (not granted, no subscription filed, or
     turned off on This device) it is marked and its call sits beside it, until they are on, as he asked; a tap on either
     asks, from the tap, so the ask is still a tap (iOS requires one; the v693 revert stands). Refused on this phone, the
     tap opens that phone's Settings steps. Once on, the call goes and the bell stays, plain, opening This device. A phone
     that cannot receive them shows no bell: This device says why. It replaces Sent's "A buzz when it is confirmed?" and
     the Order tab's Notify me, the bell covering both. */
  var bellBoxEl=document.getElementById('bellBox'), bellEl=document.getElementById('bell'), bellCall=document.getElementById('bellCall'),
      bellSheetEl=document.getElementById('bellSheet'), bellScrim=document.getElementById('bellScrim'), bellBusy=false;
  function pushOn(){ return !!draft.pushed||(pushCan()&&Notification.permission==='granted'&&!!draft.pushDone&&!pushOff()); }
  function drawBell(){
    if(!bellBoxEl) return;
    bellBoxEl.hidden=!(STANDALONE&&!!session&&!view&&!OWNER&&pushCan());
    if(bellBoxEl.hidden) return;
    var on=pushOn(), k=on?'bell.on':'bell.off';
    bellBoxEl.classList.toggle('cbell--off',!on);
    bellCall.hidden=on; bellCall.disabled=bellBusy;
    bellEl.setAttribute('data-wl',k); bellEl.setAttribute('aria-label',tw(k));
  }
  async function bellTap(){
    if(pushOn()){ placeShow('stmt',true); try{ document.getElementById('devRows').scrollIntoView(); }catch(e){} return; }
    if(Notification.permission==='denied'){ openBell(); return; }
    if(bellBusy) return;
    bellBusy=true; drawBell();
    await subscribePush();
    bellBusy=false; drawDevice();
  }
  function openBell(){
    if(!bellSheetEl) return;
    document.getElementById('bellIos').hidden=!IOS;
    document.getElementById('bellDroid').hidden=IOS||!ANDROID;
    document.getElementById('bellDesk').hidden=IOS||ANDROID;
    bellScrim.hidden=false; bellSheetEl.hidden=false; behind(); bkOpen('bell',closeBell);
    try{ bellSheetEl.focus(); }catch(e){}
  }
  function closeBell(){
    if(!bellSheetEl||bellSheetEl.hidden) return;
    bellSheetEl.hidden=true; bellScrim.hidden=true; behind(); bkDrop('bell');
    focusBack(bellEl);
  }
  if(bellBoxEl){
    bellEl.addEventListener('click', bellTap);
    bellCall.addEventListener('click', bellTap);
    document.getElementById('bellX').addEventListener('click', closeBell);
    document.getElementById('bellDone').addEventListener('click', closeBell);
    bellScrim.addEventListener('click', closeBell);
    document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeBell(); });
  }
  function devBtn(t,go){ var b=el('button','salt-ghost',t); b.type='button'; b.disabled=devBusy===ticket; b.addEventListener('click',go); return b; }
  function drawDevice(){
    drawBell();
    if(!devEl) return;
    devEl.hidden=!session||view||OWNER;
    if(devEl.hidden) return;
    devRows.textContent='';
    var on=!!draft.pushed||(pushCan()&&Notification.permission==='granted'&&!!draft.pushDone), said=devNote||noteSaid(draft.pushNote);
    if(!pushCan()) devRows.appendChild(devRow(tw('push.h'),tw(IOS&&!STANDALONE?'push.devIos':'push.devNo')));
    else if(on) devRows.appendChild(devRow(tw('push.h'),said||tw('push.devOn'),devBtn(tw('push.off'),devPushOff)));
    else devRows.appendChild(devRow(tw('push.h'),said||tw('push.devOff'),devBtn(tw('push.on'),devPushOn)));
    /* Saving the app is optional; the install guide sits with this device's settings. */
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

  /* ---- THE LOOK (11 Oct 2026, his word: Night or Tide, kept on each device, Tide until one is chosen) ---------------------
     The head script set data-theme before the first paint. lookSet is the change: saltLook writes the attribute and the browser
     bar's colour, the choice is kept in localStorage salt-look, and the setting under Account is marked; nothing reloads. The
     first time a signed-in page opens on a device that has kept nothing, a Sheet asks (lookAsk, from enter): choosing keeps it and
     closes the Sheet, and closing it any other way keeps Tide and stores nothing, so the next open asks again. A store that cannot
     be read is never asked, because the answer could not be kept. His page asks once when it opens, on the same terms (stmt/owner.js
     calls lookAsk with own set; landingPage draws its Sheet and its row in Shop > This device, and its choice is kept in the Counter
     origin's store, shared with the customer's pages on that device), and a read-only view of an account on it asks nothing. A test account's sealed bundle says look:'asked', so it
     asks at every sign-in and the Sheet can be tried again whatever the device holds. Every read and write of the store is guarded. */
  var LOOK_KEY='salt-look', lookAsked=false, lookBack=null,
      lookSheetEl=document.getElementById('lookSheet'), lookScrim=document.getElementById('lookScrim'), lookRow=document.getElementById('lookRow');
  function lookNow(){ return document.documentElement.getAttribute('data-theme')==='night'?'night':'tide'; }
  function lookStore(){ try{ var v=localStorage.getItem(LOOK_KEY); return v==='night'||v==='tide'?v:''; }catch(e){ return null; } }   /* '' nothing chosen, null unreadable */
  function lookMark(){
    if(!lookRow) return;
    [].forEach.call(lookRow.querySelectorAll('[data-look]'),function(b){ b.setAttribute('aria-pressed',String(b.getAttribute('data-look')===lookNow())); });
    segSync(lookRow.querySelector('.lookset'));
  }
  function lookSet(t){
    if(t!=='night') return;   /* 19 Oct 2026, his word: Tide is off for now, every device opens Night; the store and Tide's tokens are kept */
    if(typeof saltLook==='function') saltLook(t); else document.documentElement.setAttribute('data-theme',t);
    try{ localStorage.setItem(LOOK_KEY,t); }catch(e){ /* for this visit only */ }
    lookMark();
  }
  function lookShut(){
    if(!lookSheetEl||lookSheetEl.hidden) return;
    lookSheetEl.hidden=true; lookScrim.hidden=true; behind(); bkDrop('look');
    focusBack(lookBack);
  }
  function lookAsk(b, own){
    return;   /* 19 Oct 2026, his word: Tide is off for now, every device opens Night; the store and Tide's tokens are kept */
    if((OWNER&&!own)||view||lookAsked||!lookSheetEl) return;
    var kept=lookStore();
    if(kept===null||(kept!==''&&!(b&&b.look==='asked'))) return;
    lookAsked=true; lookBack=document.activeElement; bkOpen('look',lookShut);
    lookScrim.hidden=false; lookSheetEl.hidden=false; behind();
    try{ lookSheetEl.focus(); }catch(e){}
  }
  if(lookRow) lookRow.addEventListener('click',function(ev){ var t=ev.target.closest('[data-look]'); if(t) lookSet(t.getAttribute('data-look')); });
  if(lookSheetEl){
    lookSheetEl.addEventListener('click',function(ev){ var t=ev.target.closest('[data-look]'); if(t){ lookSet(t.getAttribute('data-look')); lookShut(); } });
    document.getElementById('lookX').addEventListener('click',lookShut);
    lookScrim.addEventListener('click',lookShut);
    document.addEventListener('keydown',function(ev){ if(ev.key==='Escape') lookShut(); });
    /* Tab stays inside the Sheet: the last control wraps to the first, and Shift+Tab from the first to the last */
    lookSheetEl.addEventListener('keydown',function(ev){
      if(ev.key!=='Tab') return;
      var f=[].slice.call(lookSheetEl.querySelectorAll('button')), i=f.indexOf(document.activeElement);
      if(ev.shiftKey&&i<=0){ ev.preventDefault(); f[f.length-1].focus(); }
      else if(!ev.shiftKey&&i===f.length-1){ ev.preventDefault(); f[0].focus(); }
    });
  }
  lookMark();

  /* the statements a customer has: the first opens, the rest are at the foot */
  function show(b){
    bundle=b;
    gate.hidden=true; if(roster) roster.hidden=true;
    barw.hidden=false; tabs.hidden=false; drawKeep(); drawBell();
    /* S7 7.1: whose account this is, in the header and at the foot of the rail; on his read-only view the bar says it */
    [].forEach.call(tabs.querySelectorAll('[data-whoas]'),function(x){ setW(x,'who.as',{u:'<span class="mono" data-who>'+esch(user)+'</span>'}); });
    [].forEach.call(tabs.querySelectorAll('[data-whorail]'),function(x){ x.textContent=user; });
    [].forEach.call(tabs.querySelectorAll('[data-wholine]'),function(x){ x.hidden=view; });
    /* v706: Rewards (the card, until S7) is an associate's alone, and nobody else is shown the place at all. It waited on
       a sealed card as well, so an associate the publish had not yet written one for had no way to
       their links (v709 gates those on the mark, not the card); since 24 Sep 2026 the mark alone opens
       it, and a panel with no card says when it comes and still carries the links. */
    placeHide('card',!assoc);
    drawRewards(pCard);
    var lv=b.statements.filter(function(s){ return s.live; })[0];
    /* C15: a live document that would not open leaves the gate where it last stood */
    if(!(lv&&lv.bad)){ payDue=lv&&lv.pay&&lv.pay.now?lv.pay:null; liveAt=lv&&lv.at||''; }
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
      var pane=el('div','pane salt-glass-card salt-glass-card--radius-md');
      var h3=pmarkHead('h3',p.product);
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
        var strip=el('div','salt-tabs mos mfil');
        months.concat(['']).forEach(function(m){
          var b=el('button','salt-tabs__pill'+(m===pick?' salt-tabs__pill--active':'')); b.type='button'; b.setAttribute('aria-pressed',m===pick?'true':'false');
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
  function linkDay(iso,L){ try{ return dmyOf(klBits(iso),L); }catch(e){ return ''; } }
  function linkLine(r){
    if(r.state==='waiting') return tw('lnk.lineWaiting');
    if(r.state==='declined') return tw('lnk.lineDeclined');
    if(r.state==='withdrawn') return tw('lnk.lineWithdrawn');
    return r.opens?tw('lnk.opened'+(r.opens===1?'1':'N')+(r.last?'Last':''),{n:r.opens, d:Dd(linkDay,r.last)}):tw('lnk.notOpened');
  }
  function drawMyLinks(into){
    var box=el('div','pane rlinks salt-glass-card salt-glass-card--radius-md');
    var head=el('div','rlhead'); head.appendChild(el('h3',null,tw('lnk.h')));
    var live=(myLinks||[]).filter(function(r){ return r.state!=='withdrawn'; }).length;
    if(myLinks&&myMax) head.appendChild(el('span','rlcount',tw('lnk.count',{n:live, m:myMax})));
    box.appendChild(head);
    if(myLinks===null){ box.appendChild(el('p','sub2',tw('lnk.reading'))); into.appendChild(box); if(!view) loadMyLinks(); return; }
    if(!myLinks.length) box.appendChild(el('p','sub2',tw('lnk.none')));
    myLinks.forEach(function(r){
      var row=el('div','glink salt-glass-card salt-glass-card--radius-md');
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
        wd.setAttribute('data-yn','link:'+r.id);
        wd.addEventListener('click', function(){
          /* 11 Oct 2026: asked in a Sheet that says what the link is, not by the browser's confirm; a yes sends what it always sent */
          ynOpen({title:tw('yn.linkH'), opener:wd, again:ynFind('link:'+r.id), go:tw('yn.linkGo'), keep:tw('yn.keepLink'),
            body:[ynLinkRow(r), el('p',null,tw('yn.linkLost'))],
            yes:async function(){
              var mine=ticket; var rv=await api('/my/refs/'+encodeURIComponent(r.id)+'/revoke',{});
              /* any failure is said, as Make a link says it: a link that stays live while nothing says so looks withdrawn */
              if(mine!==ticket) return; myNote=rv.body.ok?'':wErr(rv.body,'lnk.notWithdrawn'); await loadMyLinks();
            }});
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
        myNote=r.body.ok?'':wErr(r.body,'lnk.notMade');
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
    return h<12?'home.morning':h<14?'home.noon':h<18?'home.afternoon':'home.evening';
  }
  /* S4 4.8: a moment as the Prices stamp says it, "24 Sep 2026, 11:59", in Kuala Lumpur (C17: no weekday, the year kept) */
  function pricesAt(iso,L){
    try{ var p=klBits(iso); return dmyOf(p,L)+', '+p.hour+':'+p.minute; }
    catch(e){ return ''; }
  }
  function monthOf(d,L){
    var m=/^(\\d{4})-(\\d{2})/.exec(String(d||'')); if(!m) return '';
    return monthsIn(L)[+m[2]-1]+' '+m[1];
  }
  /* F4: THE LIGHT, a coloured border round the book's mark, its words in the heading's name and, on yellow or red with a day
     set, "More by DD Mon" under it. Sealed with the list, so it is as fresh as the last publish; nothing refuses an order. */
  function dmShort(s,L){ var m=/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(s||'')); return m?m[3]+' '+mon3(L)[+m[2]-1]:''; }
  function supLit(p){ var s=p&&p.supply; return s&&(s.light==='green'||s.light==='yellow'||s.light==='red')?s:null; }
  function supWord(l){ return el('span','salt-status supst sup-'+l,tw('sup.'+l)); }
  /* 22 Oct 2026 (his word, the outline alone was missed): the light's word stands under the mark too, the status in the light's colour */
  function supplyMark(h,pane,p){
    var s=supLit(p); if(!s) return;
    h.className+=' sup sup-'+s.light;
    h.setAttribute('aria-label',pshape(p.product)+', '+tw('sup.'+s.light));
    var ln=pane.appendChild(el('p','supline')); ln.setAttribute('aria-hidden','true'); ln.appendChild(supWord(s.light));   /* the heading says it once */
    if(s.light!=='green'&&dmShort(s.by,'en')) pane.appendChild(el('p','sub2',tw('sup.by',{d:Dd(dmShort,s.by)})));
  }
  function drawPrices(){
    pPrices.textContent='';
    /* V5: from pay.hide after the handover the prices are hidden until the overdue amount is paid */
    if(hidePrices){ pPrices.appendChild(el('p','lead',tw('pr.hidden',{rm:rm(odLeft())}))); return; }
    var soon=((prices&&prices.soon)||[]).concat(((prices&&prices.products)||[]).filter(function(x){ return !(x.sizes&&x.sizes.length); }));
    if(!prices||((!prices.products||!prices.products.length)&&!soon.length)){
      pPrices.appendChild(el('p','lead',tw('pr.none')));
      return;
    }
    /* S4 4.8: THE STAMP SAYS WHEN THE LIST WAS WRITTEN, "Prices as at Thu 24 Sep, 11:59" in Kuala Lumpur, where "for the week
       of" stayed on an open page for good; a list sealed before it carried a time keeps its week. Every size is a tap. */
    var tapTo=!view&&!hold;
    bsRows=[]; bsPanes=[]; supPanes={};
    pPrices.appendChild(el('p','lead',tw((prices.at&&pricesAt(prices.at)?'pr.asAt':'pr.week')+(tapTo?'Tap':''),
      {d:Dd(pricesAt,prices.at), w:prices.week&&prices.week.label||''})));
    pPrices.appendChild(el('p','lead',tw('pr.goods',{deliv:Wk('deliv')})));
    var pw=el('div','pway'); pw.id='pWay'; pPrices.appendChild(pw); wayDraw();
    if(tapTo){ var bl=el('p','salt-insight salt-insight--copper',limitLine()); bl.id='bkLim'; bl.hidden=true; pPrices.appendChild(bl); }
    if(prices.since) pPrices.appendChild(el('p','sub2',tw('pr.since',{m:Dd(monthOf,prices.since)})));
    /* S7 7.2: the books stand in a grid, two across from 1080px */
    var grid=el('div','pgrid'); pPrices.appendChild(grid);
    sold().forEach(function(p){
      var pane=el('div','pane salt-glass-card salt-glass-card--radius-md');
      /* C21: a board's mark is an h2 under the place's h1, never an h3 with nothing between */
      var h3=pmarkHead('h2',p.product);
      /* S4 4.10, D11 (his "all recommended" of 24 Sep 2026): THE LEVEL LEAVES PRICES. v659 drew a symbol and a colour
         for it beside each product, never named; a customer now sees no level at all, in words or in a mark. The name
         still travels inside the sealed list, and nothing here reads it. 27 Sep 2026: a pane is its mark and its sizes. */
      pane.appendChild(h3); supplyMark(h3,pane,p); supPanes[p.product]=pane;
      /* S4 4.8: a size is a row of the plain ledger, and each row is one tap that opens the order sheet at that size */
      var L=el('div','salt-ledger salt-ledger--plain');
      p.sizes.forEach(function(r){
        var row=el(tapTo?'button':'div','salt-ledger__row szrow'), line=el('span','salt-ledger__line');
        line.appendChild(el('span','salt-ledger__label',unitsOf(r.q,p.unit)));
        var v=el('span','salt-ledger__value',rm(r.price)); line.appendChild(v); row.appendChild(line);
        if(tapTo){ row.type='button'; row.setAttribute('data-q',String(r.q)); v.appendChild(oGlyph('next','ochev'));
          row.addEventListener('click',function(){ sheetOpen(p.product,r.q,row); }); }
        /* COUNTER BATCH B: the size's + beside its row, never inside it */
        if(tapTo){ var sw=el('div','szwrap'); sw.appendChild(row); sw.appendChild(bsAdd(p,r.q)); L.appendChild(sw); }
        else L.appendChild(row);
      });
      pane.appendChild(L);
      if(tapTo){ var bkl=el('div','bkline'); bkl.hidden=true; pane.appendChild(bkl); bsPanes.push({P:p, node:bkl}); }
      grid.appendChild(pane);
    });
    /* his instruction of 15 Sep 2026: a product with no tier set is not priced, and says so */
    soon.forEach(function(p){
      var pane=el('div','pane salt-glass-card salt-glass-card--radius-md');
      var sh=pmarkHead('h2',p.product); pane.appendChild(sh);
      pane.appendChild(el('p','sub2',tw('pr.soon')));
      grid.appendChild(pane);
    });
    bsPatch();
  }

  /* COUNTER BATCH B: THE WAY ON PRICES, "Delivering to {place}" or "Collecting", with Change opening the sheet at How it reaches you. Patched
     in place (a sheet closed, the orders read again), never by drawing the list again. None with no way yet, and no Change where nothing is
     ordered from here (his read-only view, the overdue gate) */
  function wayDraw(){
    var pw=document.getElementById('pWay'); if(!pw) return;
    var w=wayNow(), tapTo=!view&&!hold;
    pw.textContent=''; pw.hidden=!w; if(!w) return;
    var pl=w.place.trim();
    pw.appendChild(el('span','pway__t',w.mode==='deliver'?(pl?tw('pr.wayDeliv',{p:pl}):tw('pr.wayDelivNone')):tw('pr.wayColl')));
    if(!tapTo) return;
    var ch=el('button','salt-ghost pway__go',tw('pr.wayChange')); ch.type='button'; ch.id='pWayGo';
    ch.addEventListener('click',function(){ sheetOpen(null,null,ch);
      var m=osh&&osh.box.querySelector('[data-k^="mode:"][aria-pressed="true"]'); if(m) try{ m.focus({preventScroll:true}); }catch(e){} });
    pw.appendChild(ch);
  }
  /* COUNTER BATCH B (his answers of 18 Oct 2026): THE BASKET. A + beside each size adds it to what they will order of that mark, and taps
     on one mark SUM into one line, priced at the summed amount's own figure off the list: two taps on 5 units are 10 units at the 10-unit
     figure, never twice the 5. It is page memory alone (draft.bk, product to amount; draft.bkTaps, the taps a size, kept only while they add
     up to the line), lost on a reload and at sign-out. A + greys where the sum has no price (past the grid, off a board) and, with five
     orders open, every + greys and the limit is said: a basket is one sheet and counts once. Minus never refuses. A tap patches the controls,
     the line and the bar where they stand, so focus stays. The page prices nothing: every figure is priceAt over the sealed list. */
  var bsRows=[], bsPanes=[], supPanes={};
  function bsOf(p){ var b=draft.bk||{}; return Object.prototype.hasOwnProperty.call(b,p)?+b[p]:0; }
  function bsTapsOf(p){ var t=(draft.bkTaps||{})[p]||{}, s=0, k=Object.keys(t); k.forEach(function(q){ s+=(+q)*t[q]; }); return k.length&&Math.abs(s-bsOf(p))<1e-6?t:null; }
  function bsSet(p,amt){ draft.bk=draft.bk||{}; if(amt>1e-9) draft.bk[p]=String(+amt.toFixed(6)); else { delete draft.bk[p]; if(draft.bkTaps) delete draft.bkTaps[p]; } }
  function bsDrop(p){ bsSet(p,0); }
  function bsOn(){ return !view&&!hold&&!hidePrices; }
  function bsCanAdd(P,q){ return bsOn()&&openN()<OMAX&&priceAt(P,+(bsOf(P.product)+(+q)).toFixed(6))!=null; }
  function bsAdd(P,q){
    var box=el('span','szadd'), w=pshape(P.product)+' '+unitsOf(q,P.unit);
    var plus=el('button','salt-orb szplus'); plus.type='button'; plus.setAttribute('data-add',String(q));
    plus.appendChild(oGlyph('plus')); plus.appendChild(el('span','sr',tw('bk.add',{w:w})));
    plus.addEventListener('click',function(){ if(!bsCanAdd(P,q)) return;
      var t=bsTapsOf(P.product)||{}; t[q]=(t[q]||0)+1;
      bsSet(P.product,bsOf(P.product)+(+q)); (draft.bkTaps=draft.bkTaps||{})[P.product]=t; bsPatch(); });
    box.appendChild(plus);
    bsRows.push({P:P, q:q, box:box, plus:plus, w:w});
    return box;
  }
  /* the controls a size, the line a pane and the limit, patched in place */
  function bsPatch(){
    var lim=document.getElementById('bkLim'); if(lim) lim.hidden=!(bsOn()&&openN()>=OMAX);
    bsRows.forEach(function(R){
      R.plus.disabled=!bsCanAdd(R.P,R.q);
      var t=bsTapsOf(R.P.product), n=t&&t[R.q]||0, mi=R.box.querySelector('.szless'), nb=R.box.querySelector('.bkn');
      if(n>0){
        if(!nb){ nb=el('span','bkn'); nb.setAttribute('aria-hidden','true'); R.box.insertBefore(nb,R.plus); }
        nb.textContent=String(n);
        if(!mi){ mi=el('button','salt-orb szless'); mi.type='button'; mi.setAttribute('data-less',String(R.q)); mi.appendChild(oGlyph('minus')); mi.appendChild(el('span','sr'));
          mi.addEventListener('click',function(){ var tt=bsTapsOf(R.P.product);
            if(!tt||!tt[R.q]){ bsDrop(R.P.product); }
            else { tt[R.q]--; if(!tt[R.q]) delete tt[R.q]; bsSet(R.P.product,bsOf(R.P.product)-(+R.q)); if(draft.bkTaps&&draft.bkTaps[R.P.product]) draft.bkTaps[R.P.product]=tt; }
            bsPatch(); });
          R.box.insertBefore(mi,nb); }
        mi.querySelector('.sr').textContent=tw('bk.less',{w:R.w, n:n});
      } else { if(mi){ var had=mi===document.activeElement; mi.remove(); if(had) try{ R.plus.focus({preventScroll:true}); }catch(e){} } if(nb) nb.remove(); }
    });
    bsPanes.forEach(function(B){
      var p=B.P.product, a=bsOf(p), t=bsTapsOf(p), N=B.node; N.textContent=''; N.hidden=!(a>0)||!bsOn(); if(N.hidden) return;
      var parts=t?Object.keys(t).sort(function(x,y){ return +y-(+x); }).reduce(function(s,q){ for(var i=0;i<t[q];i++) s.push(String(+q)); return s; },[]):[];
      N.appendChild(el('span','bkline__t',parts.length>1?tw('bk.inTaps',{q:unitsOf(a,B.P.unit), t:parts.join(' + ')}):tw('bk.in',{q:unitsOf(a,B.P.unit)})));
      if(priceAt(B.P,a)==null){ var g=gridOf(B.P); N.appendChild(el('span','salt-field__hint',g&&a>g.max?tw('bk.over',{m:g.max}):g?tw('e.offStep',{s:g.step, n:g.min}):tw('bk.noPrice'))); }
      var rb=el('button','salt-ghost bkline__out',tw('bk.remove')); rb.type='button'; rb.setAttribute('data-bkout','');
      rb.appendChild(el('span','sr',' '+pshape(p)));
      rb.addEventListener('click',function(){ bsDrop(p); bsPatch(); var f=bsRows.filter(function(R){ return R.P.product===p; })[0]; if(f) try{ f.plus.focus({preventScroll:true}); }catch(e){} });
      N.appendChild(rb);
    });
    bsBarDraw();
  }
  /* THE BAR: how many lines, the goods at the list's figures added as the sheet's foot adds them, delivery left to his confirmation, and
     Review. Under 1080px a foot sticking above the App bar (the pay foot's pattern), from 1080px a card at the foot of the list's column.
     Review is grey while a line has no price; it copies the priced lines into the sheet and opens its check */
  function bsLines(){ var out=[]; sold().forEach(function(P){ var a=bsOf(P.product); if(a>0) out.push({P:P, a:a, t:priceAt(P,a)}); }); return out; }
  function bsBarDraw(){
    var bar=document.getElementById('bkBar');
    if(!bar){ if(!pPrices.querySelector('.pgrid')) return; bar=el('div','bkbar'); bar.id='bkBar'; pPrices.appendChild(bar); }
    var ls=bsOn()?bsLines():[], fo=document.activeElement, had=!!fo&&bar.contains(fo);
    bar.textContent=''; bar.hidden=!ls.length; if(!ls.length) return;
    var sum=0, open=ls.some(function(x){ return x.t==null; }); ls.forEach(function(x){ if(x.t!=null) sum+=x.t; });
    var w=wayNow();
    bar.appendChild(kpiTile('brass',tw(ls.length===1?'bk.lines1':'bk.linesN',{n:ls.length}),rm(+sum.toFixed(2)),tw(w&&w.mode==='deliver'?'sh.plusDeliv':'sh.toCollect')));
    var go=el('button','salt-pill salt-pill--md',tw('sh.review')); go.type='button'; go.id='bkGo'; go.disabled=open;
    go.addEventListener('click',function(){ bsReview(go); });
    bar.appendChild(go);
    if(had) try{ go.focus({preventScroll:true}); }catch(e){}
  }
  function bsReview(go){
    var ls=bsLines(); if(!ls.length||ls.some(function(x){ return x.t==null; })||view||hold||!lapse.hidden) return;
    draft.pick={}; ls.forEach(function(x){ draft.pick[x.P.product]=String(x.a); });
    draft.src='basket'; draft.sheetKeep=''; draft.amend=''; draft.pool='';
    sheetOpen(null,null,go);
    if(osh&&draft.step==='form'&&!formWhy()) reviewSheet();
  }
  /* the sheet opened from the basket writes what changes in it back, so the two never differ; a tally that no longer adds up is dropped */
  function bsFromPick(){
    if(draft.src!=='basket') return;
    var nb={}; Object.keys(draft.pick||{}).forEach(function(k){ nb[k]=String(draft.pick[k]); });
    Object.keys(draft.bk||{}).forEach(function(k){ if(!(k in nb)) bsDrop(k); });
    Object.keys(nb).forEach(function(k){ bsSet(k,+nb[k]); });
    bsPatch();
  }
  /* ---- ORDER: the form, then every order and where it stands ---- */
  /* S1 1.4, 24 SEP 2026: A DROPPED REQUEST ANSWERS LIKE A REFUSAL, IN WORDS. It threw, so Place stayed
     busy and Send stayed grey for good; now every caller clears its busy state and shows this beside the
     control it came from. */
  /* 24 Sep 2026: what can be ordered is a product with a priced size. The list sends none without one now, and an
     older sealed list still can: its first size was read unguarded, and the throw blanked the whole tab. */
  function sold(){ return ((prices&&prices.products)||[]).filter(function(x){ return x.sizes&&x.sizes.length; }); }
  /* 05 Oct 2026: ANY AMOUNT AT ITS AUTOMATIC PRICE. A product's grid (from min in steps to max, a price a point, sealed with
     the list) prices any amount on it; a board size off the grid reads its own row. The page calculates nothing: every
     figure is read off the list, and past the grid's max there is no price, only Negotiate. */
  function gridOf(P){ var g=P&&P.grid; return g&&g.step>0&&g.p&&g.p.length?g:null; }
  function gridIx(g,q){ var i=Math.round((+q-g.min)/g.step); return i>=0&&i<g.p.length&&Math.abs(g.min+i*g.step-(+q))<1e-6?i:-1; }
  function priceAt(P,q){ if(!P||q==null||!(+q>0)) return null;
    var g=gridOf(P), i=g?gridIx(g,q):-1; if(i>=0&&typeof g.p[i]==='number') return g.p[i];
    var z=(P.sizes||[]).filter(function(x){ return String(x.q)===String(q); })[0]; return z?z.price:null; }
  var ASK_CAP=1000;   /* the Worker's own limit on a size (checkPlacement) */
  /* past the max a size is still a whole number of steps from min (the Worker's onStep with past), so Negotiate never takes an off-step size */
  function overMax(P,q){ var g=gridOf(P), k=g?(+q-g.min)/g.step:0; return !!g&&+q>g.max+1e-9&&+q<=ASK_CAP&&Math.abs(k-Math.round(k))<1e-6; }
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
    return {status:r.status, body:busyOr(r.status,j)||{}};
  }
  /* one id a review and one a payment, sent with the tap, so a retry of that tap is recorded once */
  function mintRid(){ var a=crypto.getRandomValues(new Uint8Array(16)), s=''; for(var i=0;i<a.length;i++) s+=(a[i]<16?'0':'')+a[i].toString(16); return s; }
  /* S10 10.4: AND ONE FOR EVERY OTHER MOVE, a withdrawal, a line and a rail. An id stays with the move it was
     minted for (the same line, the same rail), so a retry of that tap is the same event and is recorded once;
     it is dropped when the move is recorded, and anything else is a new move with a new id. */
  var rids={};
  function ridFor(key,what){ var r=rids[key]; if(!r||r.what!==what){ r=rids[key]={id:mintRid(),what:what}; } return r.id; }
  function ridDone(key){ delete rids[key]; }
  /* V4b (his point 5 of 28 Sep 2026): the sheet takes every product on their list, a size of each they want; draft.pick
     is product to size, and these are its lines in the list's order, each priced off the list */
  function quotes(){
    var out=[];
    ((prices&&prices.products)||[]).forEach(function(p){
      var q=draft.pick&&Object.prototype.hasOwnProperty.call(draft.pick,p.product)?draft.pick[p.product]:null;
      if(q==null||!p.sizes) return;
      var t=priceAt(p,q);
      if(t!=null) out.push({p:p, q:+q, total:t, unit:+(t/q).toFixed(2)});
      else if(overMax(p,q)) out.push({p:p, q:+q, total:0, unit:0, over:true});   /* past the grid: Negotiate alone */
    });
    return out;
  }
  function picked(){ return !!draft.pick&&Object.keys(draft.pick).length>0; }
  /* V5b2 (his answers of 29 Sep 2026): LIKELY PAID IN ADVANCE, the page's forecast of what the desk decides at Accept
     (src/orders.js advanceOf): what they owe at once, the sealed To pay now and Coming up with their agreed orders not
     yet on it, and the sheet's lines at their goods, over the ceiling sealed with the list. One verdict a sheet. It is a
     forecast: nothing is sent at Place, and the desk's verdict is the order's. */
  function ceilingRM(){ return prices&&typeof prices.ceiling==='number'?prices.ceiling:null; }
  /* an agreed order is on the statement once a sealed part is its row: to pay now by its day, side and whole (as nowOf
     matches), coming up by its day, side and product. Accepted and not yet published, it is counted from the order */
  function onStatement(o){
    var P=payDue||{}, w=+((+o.total||0)+(+o.delivery||0)).toFixed(2), f=!!o.forFriend;
    if(!o.rowOn) return false;
    return ((P.now&&P.now.parts)||[]).some(function(p){ return p.date===o.rowOn&&!!p.resale===f&&Math.abs((+p.whole||0)-w)<0.005; })
      ||((P.coming&&P.coming.parts)||[]).some(function(p){ return p.date===o.rowOn&&!!p.resale===f&&p.product===o.product; });
  }
  function owedAll(){
    var P=payDue||{}, t=(P.now?+P.now.rm||0:0)+(P.coming?+P.coming.rm||0:0);
    orders.forEach(function(o){ if((o.status==='acknowledged'||o.status==='ready')&&!onStatement(o)) t+=Math.max(0,(+o.total||0)+(+o.delivery||0)-(+o.paid||0)); });
    return +t.toFixed(2);
  }
  function advanceLikely(goods){ var c=ceilingRM(); if(c==null||!goods.length) return false;
    return owedAll()+goods.reduce(function(a,x){ return a+(+x||0); },0)>c+0.004; }
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
  var OMAX=__MAX_OPEN__, OPEN_ST=__OPEN_STATES__, WANT_DAYS=__WANT_DAYS__;
  function oLive(){ return orders.filter(function(o){ return OPEN_ST.indexOf(o.status)>=0; }); }
  /* V4b: a sheet counts once, as the Worker counts it (stmt/orders.js, openCount) */
  function openN(){ var k={}; oLive().forEach(function(o){ k[o.sheet||o.id]=1; }); return Object.keys(k).length; }
  var GLYPH={plus:'M8 3 V13 M3 8 H13', minus:'M3 8 H13', close:'M4 4 L12 12 M12 4 L4 12', back:'M10 3.5 L5.5 8 L10 12.5', next:'M6 3.5 L10.5 8 L6 12.5', tick:'M3 8.5 L6.5 12 L13 4.5'};
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
  /* COUNTER BATCH B (his answers of 18 Oct 2026): THE WAY AND THE PLACE THE NEXT SHEET OPENS ON, one read for the sheet and the line on
     Prices, so the two never differ: what was chosen in a sheet on this page, else the newest order's. It writes nothing; with no order
     and nothing chosen there is no way yet, and Prices draws no line */
  function wayNow(){
    var L=oLatest(function(){ return true; });
    if(draft.mode==null&&!L) return null;
    var mode=draft.mode!=null?draft.mode:L&&L.mode==='deliver'?'deliver':'collect', W=draft.place!=null?null:oLatest(function(o){ return !!o.place; });
    return {mode:mode==='deliver'?'deliver':'collect', place:draft.place!=null?String(draft.place):W?String(W.place):''};
  }
  function oSoldHas(p,q){ var P=sold().filter(function(x){ return x.product===p; })[0];
    return !!P&&(q==null||priceAt(P,q)!=null); }
  /* a size the sheet may hold: priced, or past the grid's max for a price to be asked */
  function oCanPick(p,q){ var P=sold().filter(function(x){ return x.product===p; })[0]; return oSoldHas(p,q)||!!P&&overMax(P,q); }
  function sheetOpen(product,q,opener,amend,pool,againOf){
    if(view||hold||!sold().length||!lapse.hidden) return;
    draft.amend=amend?amend.id:'';
    draft.pool=pool||'';   /* a group order is joined from the same sheet: collected, one size, its own request */
    /* 20 Oct 2026: the order this is placed again from, for its line of that product; never an amendment's or a group order's */
    draft.againOf=amend||pool?'':againOf&&againOf.id?againOf.id:''; draft.againProd=draft.againOf?againOf.product:'';
    if(amend){
      draft.mode=amend.mode; draft.place=amend.place||''; draft.placeWas=draft.place;
      draft.forFriend=!!amend.forFriend; draft.say=''; draft.noteOpen=false;
      draft.wantBy=wantOk(amend.wantBy)?amend.wantBy:'';
      draft.when=draft.wantBy?'day':'soon'; draft.sheetKeep='';
      draft.slot=amend.slot||'';
    } else if(draft.slot==null) draft.slot='';
    /* 10 Oct 2026: the exact spot is asked afresh on every sheet and kept nowhere; an amendment keeps the order's own */
    draft.pin=null; draft.pinMsg=''; draft.pinLinkOpen=false; draft.pinBusy=false; draft.pinKept=!!(amend&&amend.pinned);
    draft.spot=null; draft.spotEdit=null;   /* Counter Batch C: no spot picked on opening (his answer 4) */
    draft.ownSlot=amend&&amend.slot&&amend.slotSpan?{slot:amend.slot, span:amend.slotSpan}:null;
    var U=oUsual();
    if(product&&oSoldHas(product,q)){ draft.pick={}; draft.pick[product]=String(q); }
    else {
      /* V4b: what was picked last time stays while the list still sells it; a sheet with nothing on it opens, as before,
         on the product they order most at their usual size, else its first size, else the list's first */
      var K=draft.pick||{}; draft.pick={};
      Object.keys(K).forEach(function(k){ if(oCanPick(k,K[k])) draft.pick[k]=K[k]; });
      if(!picked()){ var S0=sold(), P0=(U&&S0.filter(function(x){ return x.product===U.product; })[0])||S0[0];
        draft.pick[P0.product]=String(U&&U.product===P0.product&&oSoldHas(U.product,U.q)?U.q:P0.sizes[0].q); }
    }
    /* the way and the place are the last order's, and the hint says so while the place is still that one */
    var WN=wayNow();
    if(draft.mode==null) draft.mode=WN?WN.mode:'collect';
    if(draft.place==null){ draft.place=WN?WN.place:''; draft.placeWas=draft.place; }
    draft.step=!amend&&openN()>=OMAX?'limit':'form'; draft.snote=''; draft.check=null;
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
      behind();
      bkOpen('o',sheetDismiss);
      try{ box.focus({preventScroll:true}); }catch(e){}
    }
    sheetDraw();
  }
  /* V4b: A LINE PLACED IS AN ORDER, so leaving a check that has one takes its product off what is picked: reopened, or
     changed, the sheet never offers it again. Changed, the rest go on under the same sheet id; closed, they start afresh. */
  function dropPlaced(keep){
    /* Change twice keeps the sheet it was already keeping; Close lets it go */
    var c=draft.check; if(!keep) draft.sheetKeep='';
    if(!c||!c.lines) return;
    var any=false;
    c.lines.forEach(function(l){ if(l.placed){ any=true; if(draft.pick) delete draft.pick[l.product]; if(draft.src==='basket') bsDrop(l.product); } });
    if(any&&keep) draft.sheetKeep=c.sheet||'';
    /* the line they typed went with the first order placed */
    if(any) draft.say='';
  }
  function sheetClose(){
    if(!osh) return;
    dropPlaced(false);
    var s=osh; osh=null; draft.step=''; draft.check=null; draft.amend=''; draft.pool=''; draft.src='';
    s.wrap.parentNode.removeChild(s.wrap);
    behind();
    bkDrop('o');
    wayDraw(); bsPatch();
    focusBack(s.opener);
  }
  /* the customer's own ways out (the scrim, Close, Escape) wait while Place is on its way: closed then, the answer had
     nowhere to be drawn, an order landed unsaid or a refusal was dropped, and the same order could be placed again */
  function sheetDismiss(){ if(draft.busy) return false; sheetClose(); }
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
  /* ---- THE PAGE BEHIND A SHEET CANNOT BE REACHED (11 Oct 2026, Phase 7d part 2, Fable's note on #133) ------------------------
     While any Sheet is open, everything else at the root of the body is inert, so a screen reader or a Tab cannot walk the page
     under a modal; the Sheet's own scrim and body stay live. It is read off the DOM every time (a dialog that is aria-modal and
     not hidden is open) and never held as a flag, so no way of closing a Sheet can leave the page shut. Every open calls it, and
     every close calls it before focus goes back, so the control that opened the Sheet can take it; a lapse and a log out reach it
     through the closes they already make (lapsed, lock). A yes or no over the order sheet shuts that sheet too. What it
     shuts it marks (data-behind), so another use of inert is left alone. His page draws Sheets of its own and is left as it was. */
  function behind(){
    if(OWNER) return;
    var open=[].filter.call(document.querySelectorAll('[role=dialog][aria-modal=true]'),function(d){ return !d.hidden; }), keep=[];
    var ask=document.getElementById('ynSheet');
    (ask&&!ask.hidden?[ask]:open).forEach(function(d){
      if(d.parentNode!==document.body){ keep.push(d.parentNode); return; }   /* a built Sheet: its wrapper, scrim and all */
      keep.push(d);
      var s=d.previousElementSibling; if(s&&s.classList.contains('salt-sheet-scrim')) keep.push(s);   /* a drawn Sheet: itself and its scrim */
    });
    [].forEach.call(document.body.children,function(c){
      if(c.tagName==='SCRIPT'||c.tagName==='STYLE') return;
      if(open.length&&keep.indexOf(c)<0){ c.setAttribute('inert',''); c.setAttribute('data-behind',''); }
      else if(c.hasAttribute('data-behind')){ c.removeAttribute('inert'); c.removeAttribute('data-behind'); }
    });
  }
  /* ---- ONE ROAD BACK TO THE CONTROL THAT OPENED A SHEET (13 Oct 2026, the stress run: focus fell to the page after Close, Escape or the scrim) ----------
     Every Sheet's close ends here, after behind() has let the page go: focus returns to the control that opened it, or, if a redraw replaced that
     control, to the one that again finds afresh (backFind: a control that stands for a Sheet's opener carries data-back). With neither it is left alone. */
  function focusBack(from,again){
    var b=from; if(!(b&&b.isConnected)&&again) b=again();
    try{ if(b&&b.focus) b.focus({preventScroll:true}); }catch(e){}
  }
  function backFind(key){ return function(){ return [].filter.call(document.querySelectorAll('[data-back]'),function(x){ return x.getAttribute('data-back')===key; })[0]||null; }; }
  /* ---- BACK CLOSES THE TOP SHEET (13 Oct 2026, his yes) ---------------------------------------------------------------------
     Opening a Sheet pushes one history entry at the address the page is at, marked in its state ({sheet:n}, n the depth), so Back (a phone's
     button, a browser's swipe) takes the entry and closes the top Sheet only, through that Sheet's own close (bkOpen's second argument): the
     draft stays, the focus goes back to the opener (focusBack). A close that refuses (the order sheet while Place is on its way) is refused
     for Back too, and the entry is put back. A Sheet that comes down by its own controls hands its entry back (bkDrop): one move back in
     the history for all that are owed, made once the current work is done, so a lapse that shuts several goes back once and a Sheet opened
     straight after a close takes the entry over. An entry left behind (a reload, a Forward onto it) is stepped off at once. NOTHING IS
     PUSHED while the address carries a key or a token: a sign-in link (/s/<token>), a hand-over key (/app#<key>, /app#qr.<key>, /app#code),
     or anything the page reads off its address but a place, #thread or an order (#o=<id>); that Sheet closes by its own controls alone.
     The owner's page pushes none of this. */
  var bkStack=[], bkOwe=0, bkTick=false;
  function bkClean(){
    var p=location.pathname||'', h=location.hash||'';
    return (p==='/'||p==='/app')&&(!h||!!placeOf(h)||h==='#thread'||!!orderIn(h));
  }
  function bkAt(n){ for(var i=bkStack.length-1;i>=0;i--) if(bkStack[i].n===n&&!bkStack[i].dead) return i; return -1; }
  function bkGo(){
    if(bkTick||!bkOwe) return;
    bkTick=true;
    Promise.resolve().then(function(){ bkTick=false; var k=bkOwe; bkOwe=0; if(k) try{ history.go(-k); }catch(e){} });
  }
  function bkTrim(){ while(bkStack.length&&bkStack[bkStack.length-1].dead){ bkStack.pop(); bkOwe++; } bkGo(); }
  function bkOpen(n,shut){
    if(OWNER) return;
    var i=bkAt(n); if(i>=0){ bkStack[i].shut=shut; return; }
    if(bkOwe>0) bkOwe--;
    else if(bkClean()){ try{ history.pushState({sheet:bkStack.length+1},''); }catch(e){ return; } }
    else return;
    bkStack.push({n:n,shut:shut});
  }
  function bkDrop(n){ var i=bkAt(n); if(i<0) return; bkStack[i].dead=true; bkTrim(); }
  if(!OWNER){
    try{ var bs=history.state; if(bs&&typeof bs.sheet==='number') history.replaceState(null,''); }catch(e){}
    window.addEventListener('popstate',function(){
      var s=history.state, d=s&&typeof s.sheet==='number'?s.sheet:0;
      if(d>bkStack.length){ bkOwe+=d-bkStack.length; bkGo(); return; }
      while(bkStack.length>d){
        var r=bkStack.pop();
        if(r.dead) continue;
        if(r.shut()===false){ bkStack.push(r); for(var i=d+1;i<=bkStack.length;i++) try{ history.pushState({sheet:i},''); }catch(e){} return; }
      }
      bkTrim();
    });
  }
  /* ---- A YES OR NO IS A SHEET (11 Oct 2026, Phase 7d part 1, his decision 4: no native confirm on this page) ----------------
     Cancel this order, the same step at the order limit, and Withdraw a link each ask in the system's Sheet over the page, which
     restates what goes: the order by its mark, its size, its word and its figure, the link by its day, its state and what it has
     done. One danger action sends the request the old confirm sent, the same body and the same id; the ghost keeps. The Sheet closes
     on the ghost, the close control, the scrim and Escape, and focus goes back to the control that opened it (found again by its
     data-yn if a redraw replaced it); Tab stays inside. A lapse or a log out takes it down (ynShut, in lapsed and lock), so it is
     never left over the door. Built from the page's own nodes at the root of the body, last, so it lies over the order sheet. */
  var yn=null;
  /* the owner script, where it is spliced in, sets this to mark each Sheet this opens as its own page's (stmt/owner.js); the customer's page leaves it null */
  var sheetOwn=null;
  /* the controls of the sheet in the order Tab visits them: its buttons, and a field or a tile (a group of tiles is one stop, the one picked or the first) */
  function ynTabs(box){
    return [].filter.call(box.querySelectorAll('button,input,select,textarea'),function(x){
      if(x.disabled||x.type==='hidden') return false;
      if(x.type==='radio'&&x.name){
        var g=[].filter.call(box.querySelectorAll('input[type=radio]'),function(r){ return r.name===x.name; });
        return x===(g.filter(function(r){ return r.checked; })[0]||g[0]);
      }
      return true;
    });
  }
  function ynKeys(ev){
    if(!yn) return;
    if(ev.key==='Escape'){ ev.preventDefault(); ev.stopPropagation(); ynShut(); return; }
    if(ev.key!=='Tab') return;
    var f=ynTabs(yn.box), i=f.indexOf(document.activeElement);
    if(!f.length) return;
    if(i<0&&!yn.box.contains(document.activeElement)&&document.activeElement!==yn.box){ ev.preventDefault(); f[ev.shiftKey?f.length-1:0].focus(); }
    else if(ev.shiftKey&&i<=0){ ev.preventDefault(); f[f.length-1].focus(); }
    else if(!ev.shiftKey&&i===f.length-1){ ev.preventDefault(); f[0].focus(); }
  }
  /* shut it; quiet when the page is leaving it (a lapse, a log out) and focus has nowhere to go back to */
  function ynShut(quiet){
    if(!yn) return;
    var q=yn; yn=null;
    bkDrop('yn');
    if(q.shut) q.shut();   /* 12 Oct 2026: told it has come down, whichever way, the action's too, which runs just after: a caller awaiting the answer reads the action first (ownerAsk) */
    document.removeEventListener('keydown',ynKeys,true);
    if(q.wrap.parentNode) q.wrap.parentNode.removeChild(q.wrap);
    behind();
    if(quiet) return;
    focusBack(q.opener,q.again);
  }
  /* q: title, body (nodes), go and keep (the two answers' words), yes (what the danger action does), opener (the control to give
     focus back to), again (finds it afresh if a redraw took it away) and shut (told when the Sheet comes down, however) */
  function ynOpen(q){
    ynShut(true);
    var wrap=el('div'); wrap.id='ynWrap';
    var scrim=el('div','salt-sheet-scrim'); scrim.id='ynScrim'; scrim.setAttribute('aria-hidden','true'); scrim.addEventListener('click',function(){ ynShut(); });
    var box=el('div','salt-sheet ynsheet'); box.id='ynSheet'; if(sheetOwn) sheetOwn(box); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    box.setAttribute('aria-labelledby','ynT'); box.tabIndex=-1;
    var grab=el('div','salt-sheet__grab'); grab.setAttribute('aria-hidden','true');
    var head=el('div','salt-sheet__head'), body=el('div','salt-sheet__body'), foot=el('div','salt-sheet__foot');
    var h=el('h2','salt-sheet__title',q.title); h.id='ynT'; head.appendChild(h);
    var x=el('button','salt-orb salt-sheet__close'); x.type='button'; x.id='ynX'; x.setAttribute('aria-label',tw('x.close'));
    x.appendChild(oGlyph('close')); x.addEventListener('click',function(){ ynShut(); }); head.appendChild(x);
    q.body.forEach(function(n){ body.appendChild(n); });
    var go=el('button','salt-ghost salt-ghost--danger',q.go); go.type='button'; go.id='ynGo';
    go.addEventListener('click',function(){ if(!yn||yn.wrap!==wrap) return; ynShut(); q.yes(); });
    var keep=el('button','salt-ghost',q.keep); keep.type='button'; keep.id='ynKeep'; keep.addEventListener('click',function(){ ynShut(); });
    foot.appendChild(go); foot.appendChild(keep);
    box.appendChild(grab); box.appendChild(head); box.appendChild(body); box.appendChild(foot);
    wrap.appendChild(scrim); wrap.appendChild(box); document.body.appendChild(wrap);
    yn={wrap:wrap, box:box, opener:q.opener||document.activeElement, again:q.again||null};
    yn.shut=q.shut||null;
    bkOpen('yn',function(){ ynShut(); });
    behind();
    document.addEventListener('keydown',ynKeys,true);
    try{ box.focus({preventScroll:true}); }catch(e){}
  }
  /* the control with this data-yn, found afresh after a redraw */
  function ynFind(key){ return function(){ return [].filter.call(document.querySelectorAll('[data-yn]'),function(x){ return x.getAttribute('data-yn')===key; })[0]||null; }; }
  /* the order as the limit list draws it: its mark with the size under it, its word, its figure and the day it was placed */
  function ynOrderRow(o){
    var L=el('div','salt-ledger salt-ledger--plain'), r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label mlab');
    lab.appendChild(mtile(o.product,o.qty,oUnit(o))); lab.appendChild(el('span',null,stateWord(o)));
    l.appendChild(lab); l.appendChild(el('span','salt-ledger__value',rm((+o.total||0)+(+o.delivery||0)))); r.appendChild(l);
    r.appendChild(el('span','salt-ledger__flag',tw('sh.placed',{t:Dd(stamp,o.at)})));
    L.appendChild(r); return L;
  }
  /* the link by what it is: the day it was made, its state, and what it has done; its address is never repeated */
  function ynLinkRow(r){
    var L=el('div','salt-ledger salt-ledger--plain'), row=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), st=LINK_STATE[r.state]||LINK_STATE.open;
    l.appendChild(el('span','salt-ledger__label',r.made?tw('lnk.made',{d:Dd(oDay,r.made)}):tw('lnk.yours')));
    l.appendChild(el('span','salt-ledger__value',tw(st[0]))); row.appendChild(l);
    row.appendChild(el('span','salt-ledger__flag',linkLine(r)));
    L.appendChild(row); return L;
  }
  /* Cancel this order: the order, what is lost and what becomes of the money; send is the call the old confirm let through */
  function ynCancel(o,opener,key,send){
    var paid=+o.paid||0;
    ynOpen({title:tw('yn.orderH'), opener:opener, again:ynFind(key), go:tw('ord.cancel'), keep:tw('yn.keepOrder'), yes:send,
      body:[ynOrderRow(o), el('p',null,tw('yn.orderLost')), el('p',null,paid>0?tw('yn.orderPaid',{rm:rm(paid)}):tw('yn.orderNone'))]});
  }
  /* one draw for every step; the control that had focus gets it back, found by its data-k */
  function sheetDraw(){
    if(!osh) return;
    var fo=document.activeElement, inside=!!fo&&osh.box.contains(fo), fk=inside?fo.getAttribute('data-k'):null;
    osh.head.textContent=''; osh.body.textContent=''; osh.foot.textContent='';
    if(draft.step==='limit'&&openN()<OMAX) draft.step='form';
    if(draft.step==='check') drawCheck(); else if(draft.step==='ask') drawAsk(); else if(draft.step==='sent') drawSent(); else if(draft.step==='limit') drawLimit(); else if(draft.step==='spot'&&draft.spotEdit) drawSpot(); else drawForm();
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
    if(!quotes().length) return tw('sh.whySize');
    if(draft.pool) return '';
    if(draft.mode==='deliver'&&!draft.amend&&!draft.spot&&spotsRead()) return tw('sp.why');
    if(draft.mode==='deliver'&&String(draft.place||'').trim().length<2&&!draft.pin&&!draft.pinKept) return tw('sh.whyWhere');
    if(draft.mode!=='deliver'&&draft.when==='day'&&!wantOk(draft.wantBy)) return tw('sh.whyWhen',{n:WANT_DAYS});
    return '';
  }
  /* FUTURE-DATED ORDERS (29 Sep 2026): the day they want it by, tomorrow to WANT_DAYS days on in Kuala Lumpur, the
     Worker's wantByFault the check behind it; left for as soon as it can come, nothing is sent */
  function klPlus(n){ var d=new Date(todayKL()+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
  function wantOk(v){ return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(String(v||''))&&v>=klPlus(1)&&v<=klPlus(WANT_DAYS); }
  /* 10 Oct 2026: A DELIVERY'S TIME WINDOW, as soon as it can or one of six four-hour windows, each its next occurrence inside
     the Counter's hours (the Worker's slotNext and slotSpan, carried below); a window partly inside says the part inside */
  /*__WINDOW__*/
  var WINS=__WINDOWS__;
  function winCfg(){ return !hoursError&&counterHours&&counterHours.config||null; }
  function winOpen(){ var now=Date.now(), out=[];
    WINS.forEach(function(w){ var n=slotNext(w,winCfg(),now); if(n) out.push(n); });
    out.sort(function(x,y){ return x.slot<y.slot?-1:x.slot>y.slot?1:0; }); return out; }
  function winHm(w){ return (w<10?'0':'')+w+':00'; }
  function winDay(slot){ return String(slot||'').slice(0,10); }
  function winPart(span,i){ return String(span||'').split('-')[i]||''; }
  /* 10 Oct 2026: A DELIVERY'S EXACT SPOT. Read once on this phone (Use my location) or out of a Google Maps or Waze link they
     paste, read here; a short Google link, which only a redirect opens, is kept as the link for the desk to open. Sealed at
     Place to our key, as a slip is but under its own info (pinSeal), so the site holds ciphertext alone and only our vault
     opens it. Kept nowhere on the phone */
  function pinPt(a,b){ return typeof a==='number'&&typeof b==='number'&&isFinite(a)&&isFinite(b)&&a>=-90&&a<=90&&b>=-180&&b<=180&&!(a===0&&b===0); }
  function pinHash(h){ var B='0123456789bcdefghjkmnpqrstuvwxyz', la=[-90,90], lo=[-180,180], even=true;
    for(var i=0;i<h.length;i++){ var c=B.indexOf(h.charAt(i)); if(c<0) return null;
      for(var k=4;k>=0;k--){ var r=even?lo:la, mid=(r[0]+r[1])/2; if((c>>k)&1) r[0]=mid; else r[1]=mid; even=!even; } }
    var a=+((la[0]+la[1])/2).toFixed(6), b=+((lo[0]+lo[1])/2).toFixed(6); return pinPt(a,b)?{lat:a, lng:b, src:'link'}:null; }
  function pinRead(v){
    var s=String(v||'').trim(), m=/^https:[/][/]([a-z0-9.-]+)([/?][^ ]*)?$/i.exec(s);
    if(!m||s.length>600) return null;
    var host=m[1].toLowerCase(), path=m[2]||'', num='(-?[0-9]{1,3}[.][0-9]+)', x;
    function pt(a,b){ a=+a; b=+b; return pinPt(a,b)?{lat:a, lng:b, src:'link'}:null; }
    if(/(^|[.])google[.][a-z.]+$/.test(host)&&/^[/]maps/.test(path)){
      x=new RegExp('!3d'+num+'!4d'+num).exec(path); if(x) return pt(x[1],x[2]);
      x=new RegExp('[?&](q|query|ll|destination|center)=(loc:)?'+num+'(,|%2C)[+]?'+num).exec(path); if(x) return pt(x[3],x[5]);
      x=new RegExp('@'+num+','+num).exec(path); if(x) return pt(x[1],x[2]);
      return null;
    }
    if(host==='maps.app.goo.gl'&&path.length>2||host==='goo.gl'&&/^[/]maps[/]./.test(path)) return {link:'https://'+host+path, src:'link'};
    if(/(^|[.])waze[.]com$/.test(host)){
      x=new RegExp('[?&]ll='+num+'(,|%2C)'+num).exec(path); if(x) return pt(x[1],x[3]);
      x=new RegExp('[?&]to=ll[.]'+num+'(,|%2C)'+num).exec(path); if(x) return pt(x[1],x[3]);
      x=/^[/]ul[/]h([0-9b-hjkmnp-z]{5,12})/.exec(path); if(x) return pinHash(x[1]);
    }
    return null;
  }
  function pinHere(){
    var g=null; try{ g=navigator.geolocation; }catch(e){}
    if(!g||typeof g.getCurrentPosition!=='function'){ draft.pinMsg=tw('sh.pinNo'); sheetDraw(); return; }
    draft.pinBusy=true; draft.pinMsg=tw('sh.pinWait'); sheetDraw();
    var done=false;
    function end(p){ if(done) return; done=true; draft.pinBusy=false;
      if(p){ draft.pin=p; draft.pinMsg=''; } else draft.pinMsg=tw('sh.pinNo');
      if(osh) sheetDraw(); }
    setTimeout(function(){ end(null); },20000);
    try{ g.getCurrentPosition(function(pos){ var c=pos&&pos.coords, a=c?+c.latitude:NaN, b=c?+c.longitude:NaN;
        end(pinPt(a,b)?{lat:a, lng:b, acc:Math.round(+c.accuracy||0), src:'gps'}:null); },
      function(){ end(null); },{enableHighAccuracy:true, maximumAge:0, timeout:15000}); }catch(e){ end(null); }
  }
  function pinField(){
    var f=el('div','salt-field opin');
    f.appendChild(el('span','salt-field__label',tw('sh.pinT')));
    if(draft.pin){
      f.appendChild(el('span','salt-field__hint',tw(draft.pin.link?'sh.pinOkLink':'sh.pinOk')));
      var off=el('button','salt-ghost',tw('sh.pinOff')); off.type='button'; off.id='oPinOff'; off.setAttribute('data-k','pinoff');
      off.addEventListener('click',function(){ draft.pin=null; draft.pinMsg=''; draft.pinLinkOpen=false; sheetDraw(); });
      f.appendChild(off); return f;
    }
    var row=el('div','salt-options__grid salt-options__grid--2');
    var here=el('button','salt-ghost',tw('sh.pinHere')); here.type='button'; here.id='oPinHere'; here.setAttribute('data-k','pinhere'); here.disabled=!!draft.pinBusy;
    here.addEventListener('click',pinHere); row.appendChild(here);
    var lk=el('button','salt-ghost',tw('sh.pinLink')); lk.type='button'; lk.id='oPinLink'; lk.setAttribute('data-k','pinlink');
    lk.addEventListener('click',function(){ draft.pinLinkOpen=true; draft.pinMsg=''; sheetDraw(); var x=document.getElementById('oPinUrl'); if(x) try{ x.focus(); }catch(e){} });
    row.appendChild(lk); f.appendChild(row);
    if(draft.pinLinkOpen){
      var li=el('input','salt-field__input'); li.id='oPinUrl'; li.type='url'; li.autocomplete='off'; li.placeholder=tw('sh.pinLinkPh'); li.setAttribute('data-k','pinurl');
      li.setAttribute('aria-label',tw('sh.pinLink'));
      li.addEventListener('input',function(){ var p=pinRead(li.value); if(p){ draft.pin=p; draft.pinMsg=''; sheetDraw(); } });
      li.addEventListener('change',function(){ var p=pinRead(li.value); if(p){ draft.pin=p; draft.pinMsg=''; } else if(String(li.value||'').trim()) draft.pinMsg=tw('sh.pinBad'); sheetDraw(); });
      f.appendChild(li);
    }
    f.appendChild(el('span','salt-field__hint',draft.pinMsg||tw('sh.pinHint')));
    return f;
  }
  /* COUNTER BATCH C (20 Oct 2026, item 18; his answers 3, 4, 12 and 13): SAVED SPOTS, kept on this phone only, at most three an
     account, under salt-spots:<username>. A spot is its name, its area words, a floor or unit and, if they shared one, its exact
     point. The sheet opens with none picked and Review waits for one; picking one fills the area words and the seal's point. Log
     out keeps them; only Remove drops one, with no confirm. Save on this phone off makes a spot for this order alone, stored
     nowhere. A store that throws leaves the sheet as it was before them: the area field and the exact spot. */
  var SPOT_MAX=3, SPOT_NAMES=['sp.shop','sp.store','sp.warehouse'];
  function spotKey(){ return 'salt-spots:'+user; }
  function spotPt(p){ return !!p&&typeof p==='object'&&(p.src==='gps'||p.src==='link')&&(pinPt(p.lat,p.lng)||typeof p.link==='string'); }
  function spotOk(s){ return !!s&&typeof s.id==='string'&&typeof s.label==='string'&&s.label.trim().length>0&&typeof s.place==='string'&&s.place.trim().length>=2; }
  function spotsRead(){
    try{ var v=JSON.parse(localStorage.getItem(spotKey())||'[]');
      return (Array.isArray(v)?v:[]).filter(spotOk).slice(0,SPOT_MAX).map(function(s){ return {id:s.id, label:spotCut(s.label,24), place:spotCut(s.place,60), unit:spotCut(s.unit,40), pt:spotPt(s.pt)?s.pt:null}; }); }
    catch(e){ return null; }
  }
  function spotsWrite(L){ try{ localStorage.setItem(spotKey(),JSON.stringify(L.slice(0,SPOT_MAX))); return true; }catch(e){ return false; } }
  function spotCut(s,n){ return String(s||'').split(' ').filter(function(x){ return !!x; }).join(' ').slice(0,n).trim(); }
  var DOT=' '+String.fromCharCode(183)+' ';
  function spotDetail(s){ return [s.place,s.unit].concat(s.pt?[tw('sp.exact')]:[]).filter(function(x){ return !!x; }).join(DOT); }
  function spotPick(s){ draft.spot={id:s.id, label:s.label, place:s.place, unit:s.unit||'', pt:s.pt||null, once:!!s.once}; draft.place=s.place; draft.pin=s.pt||null; }
  function spotOpen(s){
    draft.spotEdit={id:s?s.id:'', label:s?s.label:'', place:s?s.place:'', unit:s?s.unit:'', save:!(s&&s.once), once:!!(s&&s.once)};
    draft.pin=s&&s.pt||null; draft.pinMsg=''; draft.pinLinkOpen=false; draft.step='spot'; sheetDraw();
  }
  function spotList(L){
    var fs=el('fieldset','salt-options ospots'); fs.appendChild(el('legend','salt-options__legend',tw('sh.whereTo')));
    var cur=draft.spot&&draft.spot.id, rows=L.slice();
    if(draft.spot&&draft.spot.once) rows.push(draft.spot);
    rows.forEach(function(s,i){
      var row=el('div','ospot'), lab=el('label','salt-option'), r=el('input','salt-option__input');
      r.type='radio'; r.name='ospot'; r.value=s.id; r.checked=cur===s.id; r.setAttribute('data-k','spot:'+i);
      r.addEventListener('change',function(){ spotPick(s); sheetDraw(); });
      var face=el('span','salt-option__face salt-option__face--tap'), tx=el('span','salt-option__text');
      tx.appendChild(el('span','salt-option__label',s.label)); tx.appendChild(el('span','salt-option__detail',s.once?spotDetail(s)+DOT+tw('sp.once'):spotDetail(s)));
      face.appendChild(tx); lab.appendChild(r); lab.appendChild(face); row.appendChild(lab);
      var ed=el('button','salt-ghost ospot__edit',tw('sp.edit')); ed.type='button'; ed.setAttribute('aria-label',tw('sp.editOf',{n:s.label})); ed.setAttribute('data-k','spotedit:'+i);
      ed.addEventListener('click',function(){ spotOpen(s); }); row.appendChild(ed); fs.appendChild(row);
    });
    if(L.length<SPOT_MAX){ var add=el('button','salt-ghost ospot__add',tw('sp.add')); add.type='button'; add.id='spAdd'; add.setAttribute('data-k','spotadd');
      add.addEventListener('click',function(){ spotOpen(null); }); fs.appendChild(add); }
    else { var full=el('p','salt-field__hint',tw('sp.full')); full.id='spFull'; fs.appendChild(full); }
    return fs;
  }
  function spotWhy(E){ return !spotCut(E.label,24)?tw('sp.whyName'):spotCut(E.place,60).length<2?tw('sh.whyWhere'):''; }
  function drawSpot(){
    var E=draft.spotEdit, B=osh.body;
    sheetHead(tw(E.id?'sp.editH':'sp.addH'),function(){ draft.step='form'; draft.pin=draft.spot?draft.spot.pt:null; draft.spotEdit=null; sheetDraw(); });
    var nf=el('div','salt-field'), nl=el('label','salt-field__label',tw('sp.name')); nl.htmlFor='spName';
    var ng=el('div','salt-options__grid salt-options__grid--3');
    var ni=el('input','salt-field__input'); ni.id='spName'; ni.type='text'; ni.maxLength=24; ni.value=E.label; ni.autocomplete='off'; ni.placeholder=tw('sp.namePh'); ni.setAttribute('data-k','spname');
    SPOT_NAMES.forEach(function(k,i){ var b=el('button','salt-ghost',tw(k)); b.type='button'; b.setAttribute('data-k','spn:'+i); b.setAttribute('aria-pressed',E.label===tw(k)?'true':'false');
      b.addEventListener('click',function(){ E.label=tw(k); sheetDraw(); }); ng.appendChild(b); });
    ni.addEventListener('input',function(){ E.label=ni.value; spotFoot(); });
    nf.appendChild(nl); nf.appendChild(ng); nf.appendChild(ni); B.appendChild(nf);
    var uf=el('div','salt-field'), ul=el('label','salt-field__label',tw('sp.unit')); ul.htmlFor='spUnit';
    var ui=el('input','salt-field__input'); ui.id='spUnit'; ui.type='text'; ui.maxLength=40; ui.value=E.unit; ui.autocomplete='off'; ui.placeholder=tw('sp.unitPh'); ui.setAttribute('data-k','spunit');
    ui.addEventListener('input',function(){ E.unit=ui.value; });
    uf.appendChild(ul); uf.appendChild(ui); B.appendChild(uf);
    var wf=el('div','salt-field'), wl=el('label','salt-field__label',tw('sp.area')); wl.htmlFor='oWhere';
    var wi=el('input','salt-field__input'); wi.id='oWhere'; wi.type='text'; wi.maxLength=60; wi.value=E.place; wi.autocomplete='off'; wi.placeholder=tw('sh.wherePh'); wi.setAttribute('data-k','where');
    wi.addEventListener('input',function(){ E.place=wi.value; spotFoot(); });
    wf.appendChild(wl); wf.appendChild(wi); wf.appendChild(el('span','salt-field__hint',tw('sh.where'))); B.appendChild(wf);
    slipKeyLoad(); if(SLIPKEY) B.appendChild(pinField());
    if(!E.id||E.once){ var sv=el('label','salt-field spsave'), cb=el('input'); cb.type='checkbox'; cb.id='spSave'; cb.checked=!!E.save; cb.setAttribute('data-k','spsave');
      cb.addEventListener('change',function(){ E.save=cb.checked; });
      var st=el('span','spsave__t'); st.appendChild(el('span','salt-field__label',tw('sp.save'))); st.appendChild(el('span','salt-field__hint',tw('sp.saveHint')));
      sv.appendChild(cb); sv.appendChild(st); B.appendChild(sv); }
    if(E.id&&!E.once){ var rm=el('button','salt-ghost spremove',tw('sp.remove')); rm.type='button'; rm.id='spRemove'; rm.setAttribute('data-k','spremove');
      rm.addEventListener('click',function(){ var L=spotsRead()||[]; spotsWrite(L.filter(function(s){ return s.id!==E.id; }));
        if(draft.spot&&draft.spot.id===E.id){ draft.spot=null; draft.place=''; }
        draft.pin=draft.spot?draft.spot.pt:null; draft.spotEdit=null; draft.step='form'; sheetDraw(); });
      B.appendChild(rm); }
    spotFoot();
  }
  function spotFoot(){
    var E=draft.spotEdit, F=osh.foot; F.textContent='';
    var why=spotWhy(E), t=el('div','ototal'); t.appendChild(el('span','sub2',why||tw('sh.where'))); F.appendChild(t);
    var go=el('button','salt-pill salt-pill--md',tw('sp.use')); go.type='button'; go.id='spUse'; go.disabled=!!why; go.setAttribute('data-k','spuse');
    go.addEventListener('click',function(){
      if(spotWhy(E)) return;
      var s={id:E.id||mintRid(), label:spotCut(E.label,24), place:spotCut(E.place,60), unit:spotCut(E.unit,40), pt:draft.pin&&spotPt(draft.pin)?draft.pin:null};
      var kept=false;
      if(E.save){ var L=spotsRead()||[], at=-1; L.forEach(function(x,i){ if(x.id===s.id) at=i; });
        if(at>=0) L[at]=s; else if(L.length<SPOT_MAX) L.push(s);
        kept=(at>=0||L.indexOf(s)>=0)&&spotsWrite(L); }
      if(!kept) s.once=true;
      spotPick(s); draft.spotEdit=null; draft.step='form'; sheetDraw(); });
    F.appendChild(go); F.hidden=false;
  }
  /* Counter Batch C (20 Oct 2026): what is sealed for a delivery. The exact point as read, with the picked spot's name and its
     floor or unit beside it; a unit with no point is sealed on its own (src 'unit'); a spot with neither seals nothing. Both were
     cut at the spot's step (spotFoot), one-off spots too, so a long unit is never refused after the sheet said yes. The name and the unit never leave the phone unsealed. */
  function pinOf(){
    var s=draft.spot, label=s&&s.label||'', unit=s&&s.unit||'', p=null;
    if(draft.pin){ p=Object.assign({},draft.pin); if(label) p.label=label; if(unit) p.unit=unit; }
    else if(unit){ p={unit:unit, src:'unit'}; if(label) p.label=label; }
    return p;
  }
  function pinSeal(p){ return slipSeal(SLIPKEY,new TextEncoder().encode(JSON.stringify(Object.assign({v:1, at:new Date().toISOString()},p))),'salt-pin v1'); }
  function whereHint(){
    return tw(draft.placeWas&&String(draft.place||'').trim()===draft.placeWas?'sh.whereSame':'sh.where');
  }
  function drawForm(){
    sheetHead(tw(draft.pool?'hp.h':draft.amend?'ord.amend':'sh.new'));
    var S=sold(), B=osh.body, ff=!!(assoc&&draft.forFriend);
    if(draft.amend){ var original=oFind(draft.amend); S=S.filter(function(p){ return original&&p.product===original.product; }); }
    /* a list that came back with nothing priced (a 409, then Change) leaves nothing to pick: the Order tab's own line */
    if(!S.length){ B.appendChild(el('p','lead',noOrderLine())); return; }
    /* V4b: a size no longer on the list leaves the sheet; with one product on the list a size is always chosen, as before */
    if(!draft.pick) draft.pick={};
    Object.keys(draft.pick).forEach(function(k){ if(!oCanPick(k,draft.pick[k])) delete draft.pick[k]; });
    if(S.length===1&&!picked()) draft.pick[S[0].product]=String(S[0].sizes[0].q);
    /* S4 4.7: AN ASSOCIATE IS ASKED WHO IT IS FOR, FIRST (v702's tick, which was the last field and easy to pass). Nothing is
       chosen for them: Review waits for the answer, and every order asks again. Nobody else is asked. */
    if(assoc) B.appendChild(oChoice(tw('sh.whoFor'),[['me',tw('sh.me')],['friend',tw('sh.friend')]],draft.forFriend==null?'':(draft.forFriend?'friend':'me'),'for',
      function(v){ draft.forFriend=(v==='friend'); sheetDraw(); }));
    /* a group order asks nothing more: its size and its way are fixed, and Review follows the answer an associate gives */
    if(draft.pool){ formFoot(); return; }
    /* V4b (his point 5 of 28 Sep 2026): EVERY PRODUCT ON THEIR LIST, EACH WITH ITS SIZES, a size of each they want. A
       product is its mark in the legend (v695: named by its shape); a chosen size tapped again comes off the sheet */
    if(S.length>1) B.appendChild(el('p','sub2',tw('sh.multi')));
    var U=oUsual();
    S.forEach(function(P,i){
      var fs=el('fieldset','salt-options'), lg=el('legend','salt-options__legend'), cur=draft.pick[P.product];
      lg.appendChild(withMark(P.product,'',22)); fs.appendChild(lg);
      var grid=el('div','salt-options__grid salt-options__grid--2');
      P.sizes.forEach(function(x){
        var lab=el('label','salt-option'), r=el('input','salt-option__input'), on=cur!=null&&String(x.q)===String(cur);
        /* by position: a product's word never reaches the page, an attribute included */
        r.type='radio'; r.name=i?'osize'+i:'osize'; r.value=String(x.q); r.checked=on;
        r.setAttribute('data-k',(i?'size'+i:'size')+':'+x.q);
        r.addEventListener('change',function(){ draft.pick[P.product]=String(x.q); sheetDraw(); });
        /* a tap on the size already chosen takes the line off; one product on the list always keeps its size */
        r.addEventListener('click',function(){ if(on&&S.length>1){ delete draft.pick[P.product]; sheetDraw(); } });
        var face=el('span','salt-option__face'), tx=el('span','salt-option__text'), lb=el('span','salt-option__label',unitsOf(x.q,P.unit));
        if(U&&U.product===P.product&&String(U.q)===String(x.q)) lb.appendChild(el('span','salt-status salt-status--brass',tw('sh.usual')));
        tx.appendChild(lb); tx.appendChild(el('span','salt-option__figure',rm(x.price)));
        face.appendChild(tx); lab.appendChild(r); lab.appendChild(face); grid.appendChild(lab);
      });
      fs.appendChild(grid);
      if(gridOf(P)&&!draft.amend) fs.appendChild(anyField(P,i,cur));
      B.appendChild(fs);
    });
    /* V5b2: the sheet picked so far, one verdict, said once under the sizes */
    var qsNow=quotes(); if(advanceLikely(qsNow.map(function(x){ return x.total; }))){ var lk=el('p','salt-insight',tw('sh.prepay',{c:rm(ceilingRM())})); lk.id='advLikely'; B.appendChild(lk); }
    B.appendChild(oChoice(tw('sh.reach'),[['collect',tw('sh.collect')],['deliver',tw('sh.deliver')]],draft.mode,'mode',
      function(v){ draft.mode=v; sheetDraw(); }));
    /* v694: a delivery says roughly where it is going, in his words a general location; never an address */
    var SL=draft.mode==='deliver'&&!draft.pool&&!draft.amend?spotsRead():null;
    if(SL){ slipKeyLoad(); B.appendChild(spotList(SL)); }   /* a saved spot's point or unit is sealed at Place, so the key is asked for here too */
    else if(draft.mode==='deliver'){
      var wf=el('div','salt-field'), wl=el('label','salt-field__label',tw('sh.whereTo')); wl.htmlFor='oWhere';
      var wi=el('input','salt-field__input'); wi.id='oWhere'; wi.type='text'; wi.maxLength=60; wi.value=draft.place||''; wi.autocomplete='off';
      wi.placeholder=tw('sh.wherePh'); wi.setAttribute('data-k','where');
      var wh=el('span','salt-field__hint',whereHint());
      wi.addEventListener('input',function(){ draft.place=wi.value; wh.textContent=whereHint(); formFoot(); });
      wf.appendChild(wl); wf.appendChild(wi); wf.appendChild(wh); B.appendChild(wf);
      /* 10 Oct 2026: AND THE EXACT SPOT, if they want to share it, offered once our key is filed (F13's slip key) */
      if(!draft.pool){ slipKeyLoad();
        if(draft.amend&&draft.pinKept) B.appendChild(el('p','salt-field__hint',tw('sh.pinKept')));
        else if(!draft.amend&&SLIPKEY) B.appendChild(pinField()); }
    }
    /* 10 Oct 2026: A DELIVERY asks for a time: as soon as it can, or one of the windows open now, each its next occurrence;
       a window no longer open (the clock moved, or the hours) leaves the choice at as soon as it can */
    if(draft.mode==='deliver'){
      var WO=winOpen(), opts=[['',tw('sh.soon')]], own=draft.amend&&draft.ownSlot;
      /* an amendment keeps the order's own window while it is still to end, begun or not */
      if(own&&!WO.some(function(n){ return n.slot===own.slot; })
        &&Date.parse(winDay(own.slot)+'T00:00:00Z')+(+own.slot.slice(11,13)-4)*3600000>Date.now()) WO.unshift(own);
      if(draft.slot&&!WO.some(function(n){ return n.slot===draft.slot; })) draft.slot='';
      WO.forEach(function(n){ var w=+n.slot.slice(11,13); opts.push([n.slot,tw('sh.winAt',{d:ymdDay(winDay(n.slot)), a:winHm(w), b:winHm(w+4)})]); });
      B.appendChild(oChoice(tw('sh.when'),opts,draft.slot||'','win',function(v){ draft.slot=v; sheetDraw(); }));
      var cho=WO.filter(function(n){ return n.slot===draft.slot; })[0];
      B.appendChild(el('p','salt-field__hint',cho?tw('sh.winSpan',{a:winPart(cho.span,0), b:winPart(cho.span,1), d:ymdDay(winDay(cho.slot))}):tw('sh.winHint')));
    } else
    /* 29 Sep 2026: when they want it, as soon as it can come unless they pick a day */
    B.appendChild(oChoice(tw('sh.when'),[['soon',tw('sh.soon')],['day',tw('sh.onDay')]],draft.when==='day'?'day':'soon','when',
      function(v){ draft.when=v; sheetDraw(); }));
    if(draft.mode!=='deliver'&&draft.when==='day'){
      var df=el('div','salt-field'), dl=el('label','salt-field__label',tw('sh.wantBy')); dl.htmlFor='oWant';
      var di=el('input','salt-field__input'); di.id='oWant'; di.type='date'; di.min=klPlus(1); di.max=klPlus(WANT_DAYS); di.value=draft.wantBy||'';
      di.setAttribute('data-k','want');
      di.addEventListener('input',function(){ draft.wantBy=di.value; formFoot(); });
      di.addEventListener('change',function(){ draft.wantBy=di.value; formFoot(); });
      df.appendChild(dl); df.appendChild(di); df.appendChild(el('span','salt-field__hint',tw('sh.wantHint',{n:WANT_DAYS}))); B.appendChild(df);
    }
    /* v751: a line with it, never required; it opens the order's thread. Folded until it is wanted */
    if(!draft.amend&&(draft.noteOpen||String(draft.say||'').trim())){
      var nf=el('div','salt-field'), nl=el('label','salt-field__label',tw('sh.note')); nl.htmlFor='oSay';
      var ni=el('input','salt-field__input'); ni.id='oSay'; ni.type='text'; ni.maxLength=140; ni.value=draft.say||''; ni.autocomplete='off';
      ni.placeholder=tw('sh.notePh'); ni.setAttribute('data-k','say');
      ni.addEventListener('input',function(){ draft.say=ni.value; });
      nf.appendChild(nl); nf.appendChild(ni); B.appendChild(nf);
    } else if(!draft.amend) {
      var an=el('button','salt-ghost ofull',tw('sh.addNote')); an.type='button'; an.id='oAddNote'; an.setAttribute('data-k','addnote');
      an.addEventListener('click',function(){ draft.noteOpen=true; sheetDraw(); var f=document.getElementById('oSay'); if(f) try{ f.focus(); }catch(e){} });
      B.appendChild(an);
    }
    formFoot();
  }
  /* ANY AMOUNT (05 Oct 2026): typed in units, read off the grid as it is typed, its figure and its rate said under it */
  function anyHint(P,v){ var g=gridOf(P), q=+v, t=v===''?null:priceAt(P,q);
    if(v===''||!(q>0)) return tw('sh.anyHint',{n:g.min, s:g.step, m:g.max});
    if(t!=null) return tw('sh.anyAt',{rm:rm(t), u:rm(+(t/q).toFixed(2))});
    if(overMax(P,q)) return tw('sh.anyOver',{m:g.max});
    if(q>ASK_CAP) return tw('sh.anyCap',{n:ASK_CAP});
    return tw('e.offStep',{s:g.step, n:g.min}); }
  function anyField(P,i,cur){
    var onB=cur!=null&&(P.sizes||[]).some(function(x){ return String(x.q)===String(cur); }), g=gridOf(P);
    var af=el('div','salt-field oany'), al=el('label','salt-field__label',tw('sh.any')); al.htmlFor='oAny'+i;
    var ai=el('input','salt-field__input salt-field__input--mono'); ai.id='oAny'+i; ai.type='number'; ai.inputMode='decimal';
    ai.min=String(g.min); ai.step=String(g.step); ai.autocomplete='off'; ai.setAttribute('data-k','any:'+i);
    ai.value=cur!=null&&!onB?String(cur):'';
    var ah=el('span','salt-field__hint',anyHint(P,ai.value));
    ai.addEventListener('input',function(){ var v=String(ai.value||'').trim(), q=+v;
      if(v!==''&&q>0&&(priceAt(P,q)!=null||overMax(P,q))) draft.pick[P.product]=String(+q.toFixed(6));
      else if(draft.pick[P.product]!=null&&!(P.sizes||[]).some(function(x){ return String(x.q)===String(draft.pick[P.product]); })) delete draft.pick[P.product];
      ah.textContent=anyHint(P,v); formFoot(); });
    ai.addEventListener('change',function(){ sheetDraw(); });
    af.appendChild(al); af.appendChild(ai); af.appendChild(ah); return af;
  }
  /* the foot alone, so typing a place never redraws the field under the thumb */
  function formFoot(){
    bsFromPick();
    var F=osh.foot; F.textContent='';
    var qs=quotes(), why=formWhy(), t=el('div','ototal'), sum=0;
    qs.forEach(function(x){ sum+=x.total; });
    t.appendChild(el('b','salt-kpi__value',qs.length?rm(+sum.toFixed(2)):''));
    t.appendChild(el('span','sub2',why||tw(draft.mode==='deliver'?'sh.plusDeliv':'sh.toCollect')));
    F.appendChild(t);
    var go=el('button','salt-pill salt-pill--md',tw('sh.review')); go.type='button'; go.id='oGo'; go.disabled=!!why; go.setAttribute('data-k','review');
    go.addEventListener('click',reviewSheet);
    F.appendChild(go); F.hidden=false;
  }
  /* REVIEW FREEZES THE ORDER. The check draws from this copy and Place sends this copy, so what is placed is what
     was shown; the request id is minted with it, and a retry of Place is the same order under the same id */
  function reviewSheet(){
    var qs=quotes(); if(!qs.length||formWhy()) return;
    var ff=!!(assoc&&draft.forFriend);
    /* V4b: a line a product, each its own request id; two or more share the sheet's id, which Place sends with each */
    draft.check={lines:qs.map(function(qt){ return {product:qt.p.product, unit:qt.p.unit||'unit', q:qt.q, total:qt.total, rate:qt.unit, rid:mintRid(), over:!!qt.over,
        /* S4 4.4: the price as shown, for a moved list to be told against; placed, the order Place made of it */
        shown:qt.total, was:null, gone:false, placed:''}; }),
      amend:draft.amend||'', sheet:draft.pool?'':draft.sheetKeep||(qs.length>1?mintRid():''), mode:draft.pool?'collect':draft.mode,
      place:draft.mode==='deliver'&&!draft.pool?String(draft.place||'').trim():'', say:draft.pool?'':String(draft.say||'').trim(), forFriend:ff,
      pool:draft.pool||'', againOf:draft.amend||draft.pool?'':draft.againOf||'', againProd:draft.againProd||'',
      wantBy:draft.mode!=='deliver'&&draft.when==='day'&&wantOk(draft.wantBy)&&!draft.pool?draft.wantBy:'',
      /* 10 Oct 2026: a delivery's window, with the span it was offered at, for the check to say */
      slot:draft.mode==='deliver'&&!draft.pool?draft.slot||'':'', span:'',
      /* the exact spot as read, sealed at Place; an amendment's is the order's own, kept by the Worker */
      pin:draft.mode==='deliver'&&!draft.pool&&!draft.amend?pinOf():null, pinKept:draft.mode==='deliver'&&!!draft.amend&&!!draft.pinKept, pinSealed:null,
      /* S4 4.4: the stamp of the list these prices were read from */
      digest:(prices&&prices.digest)||''};
    /* from the list the form drew: the open windows, and an amendment's own window kept while it is still to end */
    if(draft.check.slot){ var cs=winOpen().concat(draft.amend&&draft.ownSlot?[draft.ownSlot]:[]).filter(function(n){ return n.slot===draft.check.slot; })[0]; draft.check.span=cs?cs.span:''; }
    draft.step='check'; draft.snote=''; sheetDraw();
  }
  function sheetSum(c){ var t=0; c.lines.forEach(function(l){ t+=l.total; }); return +t.toFixed(2); }
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
    c.digest=fresh.digest||'';
    /* V4b: each line still to place is read again; a line Place already has is the order it made, and is left alone */
    var moved=false, gone=false;
    c.lines.filter(function(l){ return !l.placed; }).forEach(function(l){
      var P=(fresh.products||[]).filter(function(x){ return x.product===l.product&&x.sizes&&x.sizes.length; })[0];
      var zt=P?priceAt(P,l.q):null;
      if(l.over&&P&&overMax(P,l.q)){ l.gone=false; l.was=null; return; }
      if(zt==null){ l.gone=true; l.was=null; gone=true; return; }
      l.gone=false; l.over=false;
      if(Math.abs(zt-l.total)>0.004){ l.total=zt; l.rate=+(zt/l.q).toFixed(2); l.rid=mintRid(); moved=true; }
      l.was=Math.abs(l.total-l.shown)>0.004?l.shown:null;
    });
    if(!moved&&!gone) draft.snote=c.lines.length===1?tw('sh.stillAt',{rm:rm(c.lines[0].total)}):tw('sh.stillAtAll',{rm:rm(sheetSum(c))});
  }
  /* S4 4.6: FIVE OPEN ORDERS ARE SAID BEFORE THE FORM, not after it. The Worker refuses a sixth (MAX_OPEN in
     stmt/orders.js, carried here), and the refusal used to come after the form was filled and checked. With five open the
     sheet opens on the limit instead, naming the open orders, each with Cancel where the goods have not moved, and moves on
     to the form of its own accord once one is cancelled or finishes. */
  /* 11 Oct 2026: the limit is said in words, off the code's own MAX_OPEN ("Five open orders is the most"); past ten there is no word */
  function numWord(n){ return has('en','num.'+n)?tw('num.'+n):String(n); }
  function limitLine(){ return tw('sh.limit',{n:numWord(OMAX)}); }
  function drawLimit(){
    sheetHead(tw('sh.new'));
    var B=osh.body, open=oLive();
    var say=el('p','salt-insight salt-insight--copper',limitLine()); say.setAttribute('role','status'); B.appendChild(say);
    var L=el('div','salt-ledger salt-ledger--plain');
    open.forEach(function(o){
      var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label mlab');
      /* the order as a card: its mark a button, its caption under it (his notes of 28 Sep and 11 Oct 2026) */
      lab.appendChild(mtile(o.product,o.qty,oUnit(o)));
      /* the order's own word, stage 5's (stateWord, over oWord), as its row under Your orders says it; goods handed over in
         part keep an order open at ready, so they read as the banner's part word, never Ready over "part of it is with you" */
      var mv=+o.moved||0, part=mv>0&&!movedAll(o), dl=o.mode==='deliver';
      lab.appendChild(el('span',null,part?tw(dl?'st.partDelivered':'st.partCollected'):stateWord(o)));
      l.appendChild(lab); l.appendChild(el('span','salt-ledger__value',rm(o.total+(+o.delivery||0)))); r.appendChild(l);
      if(!(+o.moved>0)){
        var row=el('div','olim'); row.appendChild(el('span','salt-ledger__flag',tw('sh.placed',{t:Dd(stamp,o.at)})));
        var cb=el('button','salt-ghost',tw('ord.cancel')); cb.type='button'; cb.setAttribute('data-k','cancel:'+o.id); cb.setAttribute('data-yn','limit:'+o.id);
        cb.addEventListener('click',function(){ limitCancel(o,cb); }); row.appendChild(cb); r.appendChild(row);
      } else r.appendChild(el('span','salt-ledger__flag',tw(!part?'sh.withYou'
        :(+o.paid||0)<(+o.total||0)+(+o.delivery||0)-0.004?'sh.partOwed':'sh.part')));
      if(draft.limTap&&draft.limTap.id===o.id) r.appendChild(statusLine(draft.limTap.t));
      L.appendChild(r);
    });
    B.appendChild(L);
  }
  /* 11 Oct 2026: each Cancel here asks in a Sheet over the list, restating that order; its yes is the request it always sent */
  function limitCancel(o,cb){
    ynCancel(oFind(o.id)||o, cb, 'limit:'+o.id, async function(){
      var mine=ticket, r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{rid:ridFor(o.id+':cancel','')});
      if(mine!==ticket) return;
      if(r.body.ok) ridDone(o.id+':cancel');
      draft.limTap=r.body.ok?null:{id:o.id, t:wErr(r.body,'ord.notCancelled')};
      await loadOrders(); if(mine!==ticket) return;
      drawOrder(); sheetDraw();
    });
  }
  /* a group order's Join: the sheet opens on the pool's own product and size; one who is asked who it is for (an associate) answers
     that first, anyone else is at the check at once, where Join sends it */
  function poolOpen(p,opener){
    if(!oSoldHas(p.product,p.q)) return;
    draft.mode='collect'; draft.place=''; draft.say=''; draft.noteOpen=false; draft.when='soon'; draft.wantBy='';
    if(assoc) draft.forFriend=null;
    sheetOpen(p.product,p.q,opener,null,p.id);
    if(osh&&draft.step==='form'&&!formWhy()) reviewSheet();
  }
  function toForm(){ dropPlaced(true); draft.step='form'; draft.check=null; draft.snote=''; sheetDraw(); }
  function drawCheck(){
    var c=draft.check, B=osh.body, one=c.lines.length===1, a=c.lines[0];
    /* V5b2: one forecast for the sheet, every line still on the list counted at its goods */
    var lk=advanceLikely(c.lines.filter(function(l){ return !l.gone; }).map(function(l){ return l.total; }));
    sheetHead(tw(c.pool?'hp.h':c.amend?'ord.amendReview':'sh.check'),c.pool&&!assoc?sheetDismiss:toForm);
    if(c.amend) B.appendChild(el('p','salt-insight',tw('ord.amendAsk')));
    if(c.pool) B.appendChild(el('p','salt-insight',tw('hp.ask',{q:unitsOf(a.q,a.unit)})));
    if(c.amend&&(hoursError||counterHours&&!counterHours.open))
      B.appendChild(el('p','salt-insight',tw(hoursError?'hours.unavailable':'hours.closed')));
    /* HIS NOTE OF 28 SEP 2026: what is ordered leads the check as a card, the mark a button and its caption under it, in
       place of a What line that set the mark beside its size; V4b: a card a line */
    var H=el('div','mhero'); c.lines.forEach(function(l){ H.appendChild(mtile(l.product,l.q,l.unit)); }); B.appendChild(H);
    var L=el('div','salt-ledger salt-ledger--plain');
    function row(k,v,flag){ var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label'), val=el('span','salt-ledger__value');
      if(typeof k==='string') lab.textContent=k; else lab.appendChild(k);
      l.appendChild(lab); if(typeof v==='string') val.textContent=v; else val.appendChild(v);
      l.appendChild(val); r.appendChild(l); if(flag) r.appendChild(el('span','salt-ledger__flag',flag)); L.appendChild(r); }
    if(assoc) row(tw('sh.for'),tw(c.forFriend?'sh.friend':'sh.me'));
    if(one) row(tw('sh.price'),a.over?tw('sh.askOnly'):rm(a.total),a.over?'':tw('sh.perUnit',{rm:rm(a.rate)}));
    else {
      /* V4b: each line its size and mark, its price, and whether it is paid in advance or already sent; then the total */
      var rmOk=draft.src==='basket'&&!c.amend&&!c.pool&&!draft.busy&&!c.lines.some(function(l){ return l.placed; });
      c.lines.forEach(function(l){ row(withMark(l.product,unitsOf(l.q,l.unit)+' ',20),rm(l.total),l.placed?tw('sh.lineSent'):lk?tw('sh.inAdvance'):'');
        if(rmOk){ var rb=el('button','salt-ghost bkrm',tw('bk.remove')); rb.type='button'; rb.setAttribute('data-k','rm:'+c.lines.indexOf(l));
          rb.appendChild(el('span','sr',' '+pshape(l.product)+' '+unitsOf(l.q,l.unit)));
          rb.addEventListener('click',function(){ if(draft.busy||c.lines.some(function(x){ return x.placed; })) return;
            if(draft.pick) delete draft.pick[l.product]; bsDrop(l.product); bsPatch();
            if(picked()&&!formWhy()) reviewSheet(); else toForm(); });
          L.lastChild.appendChild(rb); } });
      row(tw('sh.total'),rm(sheetSum(c)));
    }
    row(tw('sh.how'),c.mode==='deliver'?tw('sh.deliveredTo',{p:c.place}):tw('sh.youCollect'));
    if(c.mode==='deliver'&&(c.pin||c.pinKept)) row(tw(c.pin&&c.pin.src==='unit'?'od.sealed':'sh.pinRow'),tw('sh.pinShared'));
    if(c.mode==='deliver') row(tw('sh.delivery'),tw('sh.setOnConfirm'));
    if(!c.pool&&c.mode==='deliver') row(tw('sh.winRow'),c.slot&&c.span?tw('sh.winCheck',{d:ymdDay(winDay(c.slot)), a:winPart(c.span,0), b:winPart(c.span,1)}):tw('sh.soon'));
    else if(!c.pool) row(tw('sh.wantBy'),c.wantBy?ymdDay(c.wantBy):tw('sh.soon'));
    if(one&&lk) row(tw('sh.pay'),tw('sh.inAdvance'));
    if(c.say) row(tw('sh.note'),c.say);
    B.appendChild(L);
    /* S4 4.4: a list re-struck since it was opened is said here, before anything is placed, and Place names the new figure;
       V4b: a line at a time, its mark leading when there are several */
    c.lines.forEach(function(l){
      if(l.was!=null){ var mv=el('p','salt-insight salt-insight--copper'); mv.setAttribute('role','status');
        setW(mv,one?'sh.moved':'sh.movedLine',{now:esch(rm(l.total)), was:esch(rm(l.was))}); if(!one) mv.insertBefore(markLead(l.product,20),mv.firstChild); B.appendChild(mv); }
      if(l.gone){ var gn=el('p','salt-insight salt-insight--copper',tw(one?'sh.gone':'sh.goneLine'));
        gn.setAttribute('role','status'); if(!one) gn.insertBefore(markLead(l.product,20),gn.firstChild); B.appendChild(gn); }
    });
    /* V5b2: a sheet likely paid in advance is checked beside what that means, and that the desk confirms it */
    if(lk&&c.lines.some(function(l){ return !l.placed; })) B.appendChild(el('p','salt-insight',tw('sh.prepayP')));
    /* S4 4.9: a delivery is checked beside the one sentence that says how its charge is set */
    if(c.mode==='deliver') B.appendChild(el('p','salt-insight',tw('deliv')));
    /* NEGOTIATE (05 Oct 2026): one line, for themselves, asks for a price instead of placing at the list's. The check holds
       nothing to type into, so the figure of their own, optional, is its own step (drawAsk) */
    var canAsk=one&&!c.amend&&!c.pool&&!c.forFriend&&!a.placed&&!c.sheet;
    if(c.lines.some(function(l){ return l.over; })&&!canAsk) B.appendChild(el('p','salt-insight salt-insight--copper',tw('sh.askOne')));
    var F=osh.foot, was=c.lines.some(function(l){ return l.was!=null; }), gone=c.lines.some(function(l){ return l.gone; });
    var bk=el('button','salt-ghost',tw('sh.change')); bk.type='button'; bk.id='oBack'; bk.disabled=!!draft.busy; bk.setAttribute('data-k','change');
    bk.addEventListener('click',c.pool&&!assoc?sheetDismiss:toForm); F.appendChild(bk);
    var pl=el('button','salt-pill salt-pill--md',c.pool?tw('hp.join'):c.amend?tw('ord.amendConfirm'):was?tw('sh.placeAt',{rm:rm(sheetSum(c))}):tw('sh.place')); pl.type='button'; pl.id='oPlace';
    var over=c.lines.some(function(l){ return l.over; });
    pl.disabled=!!draft.busy||gone||!!c.shut||over; pl.setAttribute('data-k','place');
    pl.addEventListener('click',function(){ oPlaceIt(false); }); if(!over) F.appendChild(pl);
    if(canAsk){ var ng=el('button',over?'salt-pill salt-pill--md':'salt-ghost',tw('sh.ask')); ng.type='button'; ng.id='oAskGo';
      ng.disabled=!!draft.busy||gone||!!c.shut; ng.setAttribute('data-k','askgo');
      ng.addEventListener('click',function(){ draft.step='ask'; draft.snote=''; sheetDraw(); }); F.appendChild(ng); }
    /* the answer is drawn beside Place, which is what was tapped */
    if(draft.snote) F.appendChild(statusLine(draft.snote));
  }
  /* NEGOTIATE's own step: what they ask a price for, a figure of their own if they want one (a number, nothing else), and
     Send; Change goes back to the check */
  function toCheck(){ draft.step='check'; draft.snote=''; sheetDraw(); }
  function drawAsk(){
    var c=draft.check, B=osh.body, a=c&&c.lines[0];
    if(!a){ toForm(); return; }
    sheetHead(tw('sh.askT'),toCheck);
    var H=el('div','mhero'); H.appendChild(mtile(a.product,a.q,a.unit)); B.appendChild(H);
    B.appendChild(el('p','salt-insight',tw('sh.askHint')));
    var kf=el('div','salt-field'), kl=el('label','salt-field__label',tw('sh.askFig')); kl.htmlFor='oAsk';
    var ki=el('input','salt-field__input salt-field__input--mono'); ki.id='oAsk'; ki.type='number'; ki.inputMode='decimal'; ki.min='0'; ki.step='0.01';
    ki.value=c.propose||''; ki.autocomplete='off'; ki.setAttribute('data-k','ask');
    ki.addEventListener('input',function(){ c.propose=ki.value; });
    kf.appendChild(kl); kf.appendChild(ki); B.appendChild(kf);
    var F=osh.foot, bk=el('button','salt-ghost',tw('sh.change')); bk.type='button'; bk.id='oAskBack'; bk.disabled=!!draft.busy; bk.setAttribute('data-k','askback');
    bk.addEventListener('click',toCheck); F.appendChild(bk);
    var go=el('button','salt-pill salt-pill--md',tw('sh.askSend')); go.type='button'; go.id='oAskSend'; go.disabled=!!draft.busy; go.setAttribute('data-k','asksend');
    go.addEventListener('click',function(){ oPlaceIt(true); }); F.appendChild(go);
    if(draft.snote) F.appendChild(statusLine(draft.snote));
  }
  /* V4b: PLACE SENDS ONE ORDER A LINE, in order, each under its own request id and the sheet's; a line placed stays placed,
     so a Place tapped again after a refusal sends only the lines still to go, and a retry of a line that landed is answered
     with its order. The line they typed rides with the first. */
  async function oPlaceIt(ask){
    var c=draft.check; if(!c||draft.busy) return;
    if(ask!==true) ask=false;
    var fig=ask&&String(c.propose||'').trim()!==''?+c.propose:null;
    if(ask&&fig!=null&&!(fig>0)){ draft.snote=tw('e.askFigure'); sheetDraw(); return; }
    if(!ask&&c.lines.some(function(l){ return l.over; })) return;
    draft.busy=true; draft.snote=''; sheetDraw();
    var mine=ticket, week=(prices&&prices.week&&prices.week.monday)||'';
    /* 10 Oct 2026: the exact spot sealed once, here, before anything leaves; a retry sends the same sealed copy */
    if(c.pin&&!c.pinSealed){
      try{ c.pinSealed=SLIPKEY?await pinSeal(c.pin):null; }catch(e){ c.pinSealed=null; }
      if(mine!==ticket) return;
      if(!c.pinSealed){ draft.busy=false; draft.snote=tw('e.pinBad'); sheetDraw(); return; }
    }
    var todo=c.lines.filter(function(l){ return !l.placed; });
    for(var i=0;i<todo.length;i++){
      var l=todo[i], body={product:l.product,qty:l.q,mode:c.mode,unit:l.rate,total:l.total,place:c.place,
        forFriend:!!(assoc&&c.forFriend),note:l===c.lines[0]?c.say:'',rid:l.rid,week:week,digest:c.digest};
      if(c.sheet) body.sheet=c.sheet;
      if(c.againOf&&l.product===c.againProd) body.againOf=c.againOf;
      if(c.wantBy) body.wantBy=c.wantBy;
      if(c.slot) body.slot=c.slot;
      if(c.pinSealed) body.pin=c.pinSealed;
      /* Negotiate: its own request id, so an ask is never answered with a placing of the same line, or the other way */
      if(ask){ body.ask=true; if(!l.askRid) l.askRid=mintRid(); body.rid=l.askRid; if(fig!=null) body.propose=+fig.toFixed(2); }
      if(c.amend){ delete body.note; delete body.sheet; delete body.total; delete body.unit; }
      /* a group order is joined, not placed: its size is the pool's, it is collected, and the Worker makes the one order */
      if(c.pool) body={q:l.q,total:l.total,unit:l.rate,digest:c.digest,rid:l.rid,forFriend:!!(assoc&&c.forFriend)};
      var r=await api(c.pool?'/pools/'+encodeURIComponent(c.pool)+'/join':c.amend?'/orders/'+encodeURIComponent(c.amend)+'/amend':'/orders',body);
      if(mine!==ticket) return;
      if(r.status===409&&(r.body.code==='pricesMoved'||r.body.error==='prices moved')){ draft.busy=false; await pricesMoved(r.body.prices); if(mine!==ticket) return; sheetDraw(); return; }
      /* a retry the Worker already has on this sheet (its request id not yet read back on the kv road) is placed */
      if(!r.body.ok&&r.body.code==='sheetTwice'){ l.placed='placed'; continue; }
      if(!r.body.ok){
        draft.busy=false;
        draft.snote=wErr(r.body,'sh.notPlaced');
        /* a pool that closed, or one they are in already, is read again so Home says so */
        if(c.pool&&r.status===409){ await loadOrders(); if(mine!==ticket) return; drawHome(); }
        /* S4 4.6: a refusal that the open orders explain (placed from another phone meanwhile) turns to the limit itself */
        if(r.status===400){ await loadOrders(); if(mine!==ticket) return; drawOrder();
          if(!c.amend&&openN()>=OMAX&&!c.lines.some(function(x){ return x.placed; })){ draft.step='limit'; draft.check=null; draft.snote=''; } }
        sheetDraw(); return;
      }
      l.placed=(r.body.order&&r.body.order.id)||'placed';
    }
    draft.busy=false;
    /* COUNTER BATCH B (his answer 3 of 18 Oct 2026): A SIZE PLACED IS FORGOTTEN, by what is picked on every road and by the basket when the
       sheet came from it, before the check that names them is let go, so nothing placed is offered or placed again */
    c.lines.forEach(function(l){ if(l.placed){ if(draft.pick) delete draft.pick[l.product]; if(draft.src==='basket') bsDrop(l.product); } });
    bsPatch();
    /* S4 4.5: Sent answers in the sheet; the Order tab behind it is drawn again with the order in it */
    draft.againOf=''; draft.againProd='';
    draft.asked=!!ask; draft.sent=c.lines[0].placed==='placed'?'':c.lines[0].placed; draft.sheetKeep=''; draft.step='sent'; draft.check=null; draft.say=''; draft.noteOpen=false; draft.pushNote=''; draft.forFriend=null; draft.when=''; draft.wantBy='';
    sheetDraw();
    await loadOrders(); if(mine!==ticket) return;
    drawOrder();
    if(c.pool) drawHome();
  }
  /* S4 4.5: SENT. See the order closes the sheet on the order itself. Step 1b: its notifications question retired, the
     bell asking instead */
  function drawSent(){
    sheetHead(null);
    var B=osh.body, top=el('div','osent');
    top.appendChild(oGlyph('tick','otick',40));
    var h=el('h2','salt-sheet__title',tw('sh.sent')); h.id='oshT'; top.appendChild(h);
    top.appendChild(el('p',null,tw(draft.asked?'sh.askedP':'sh.sentP')));
    B.appendChild(top);
    /* Step 1b: Sent's ask retired; the bell in the saved app's header asks, on every view, until notifications are on */
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
  function formSig(){ return JSON.stringify([hold,odLeft(),view,assoc,prices,openN()>=OMAX,stageNow()]); }
  function drawOrder(){
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
      var dueBox=el('div','pane salt-glass-card salt-glass-card--radius-md'), od=odNow(), left=odLeft();
      dueBox.appendChild(kpiTile('ember',tw('pay.overdue'),rm(left),odNote(od)));
      dueBox.appendChild(el('p','lead',tw('pay.hold',{rm:rm(left)})));
      if(od.parts.length>1){
        var L=el('div','salt-ledger salt-ledger--plain');
        od.parts.forEach(function(x){ L.appendChild(coverTo(lrowN(partSpan(x),rm(x.rm),dueWords(x),'odue'),x)); });
        dueBox.appendChild(L);
      }
      /* S6 6.4: one Pay, opening the pay sheet, where there were thirteen links naming the pay page */
      if(!view){
        var hp=el('button','btn salt-pill salt-pill--md',tw('pay.payRm',{rm:rm(left)})); hp.type='button';
        hp.setAttribute('data-back','pay:od');
        hp.addEventListener('click',function(){ openPay({kind:'acct', fig:left, label:'pay.overdue', note:function(){ return odNote(od); }},hp,'pay:od'); });
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
      top.appendChild(el('p','lead',tw('ord.lead')));
      var full=openN()>=OMAX;
      if(full){ var lim=el('p','salt-insight salt-insight--copper',limitLine()); lim.id='oLimit'; top.appendChild(lim); }
      else {
        if(hoursError||counterHours&&!counterHours.open){
          top.appendChild(el('p','salt-insight',tw(hoursError?'hours.unavailable':'hours.closed')));
        }
        var nb=el('button','btn salt-pill salt-pill--md',tw('sh.new')); nb.type='button'; nb.id='oNew';
        nb.addEventListener('click',function(){ sheetOpen(null,null,nb); });
        top.appendChild(nb);
      }
      if(osh&&draft.step==='limit') sheetDraw();
    }
    /* Step 1b: notifications are the bell's, in the header of every view of the saved app; this pane retired */
    pOrder.appendChild(oPlace());
    if(keep){ var kbox=[].filter.call(pOrder.querySelectorAll('input[data-say]'),function(x){ return x.getAttribute('data-say')===keep; })[0];
      if(kbox){ try{ kbox.focus({preventScroll:true}); kbox.setSelectionRange(sel[0],sel[1]); }catch(e){} } }
    window.scrollTo(0,sc);
    drawHome();
    openWanted();
    thWanted();
  }

  /* S5 5.3 (D11, his answer of 24 Sep 2026): WHERE AN ORDER IS, IN THE CUSTOMER'S WORDS. The record's states are the
     desk's; they read Placed, Confirmed, Ready to collect or to deliver, Collected or Delivered once the goods are all
     with them, Complete, Declined, and Cancelled by you or by us, read off who cancelled it. Never Acknowledged,
     Withdrawn or handed over. The tone follows the word: steel and dashed while it waits on us, brass ready,
     verdigris confirmed or moved, mist closed. */
  function oWord(st,o,by){
    var d=o.mode==='deliver';
    var k={placed:'st.placed', acknowledged:'st.acknowledged', ready:d?'st.readyDeliver':'st.readyCollect', done:'st.done', declined:'st.declined',
      cancelled:by==='desk'?'st.cancelledUs':'st.cancelledYou'}[st];
    return k?tw(k):st;
  }
  /* S11 11.7: the event that ended an order, whose note is his reason for a decline or a cancellation of his */
  function endOf(o){ var h=(o.history||[]).filter(function(x){ return x&&x.status===o.status&&!/^point moved to /.test(String(x.note||'')); }); return h.length?h[h.length-1]:null; }
  function stateWord(o){
    if(oPayable(o)&&movedAll(o)) return tw(o.mode==='deliver'?'st.delivered':'st.collected');
    var e=endOf(o);
    return oWord(o.status,o,e?e.by:'');
  }
  /* COUNTER BATCH A (his decision of 18 Oct 2026): A GLYPH BEFORE EVERY STATE WORD. A dot while it is still being agreed, a tick once
     agreed or ready, a double tick once the goods are with them or it is complete, a cross once it ended; the word is unchanged and
     the glyph aria-hidden, so the chip reads the same aloud. The dot is filled, the rest drawn as strokes in the chip's tone. */
  var CHIP_GLYPH={dot:'M8 5.5 A2.5 2.5 0 1 1 7.99 5.5 Z', tick:'M3 8.5 L6.5 12 L13 4.5', ticks:'M1 8.5 L4.5 12 L10.5 4.5 M7.5 11.5 L8 12 L15 4.5', cross:'M4 4 L12 12 M12 4 L4 12'};
  function chipGlyph(k){
    var NS='http://www.w3.org/2000/svg', s=document.createElementNS(NS,'svg'), d=document.createElementNS(NS,'path');
    s.setAttribute('viewBox','0 0 16 16'); s.setAttribute('class','salt-status__glyph'); s.setAttribute('data-g',k);
    s.setAttribute('aria-hidden','true'); s.setAttribute('focusable','false');
    d.setAttribute('d',CHIP_GLYPH[k]); if(k==='dot') d.setAttribute('fill','currentColor');
    s.appendChild(d); return s;
  }
  function stateGlyph(o){
    var s=o.status;
    return s==='placed'?'dot':(s==='declined'||s==='cancelled')?'cross':(s==='done'||(oPayable(o)&&movedAll(o)))?'ticks':'tick';
  }
  function stateChip(o,cls){
    var s=o.status, tone=s==='placed'?'steel salt-status--dashed':s==='ready'&&!movedAll(o)?'brass':(s==='acknowledged'||s==='done'||oPayable(o))?'verdigris':'mist';
    var c=el('span',(cls?cls+' ':'')+'salt-status salt-status--'+tone);
    c.appendChild(chipGlyph(stateGlyph(o))); c.appendChild(document.createTextNode(stateWord(o)));
    return c;
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
    /* plan 4: a step we recorded by mistake, taken back */
    if((m=/^payment of ([0-9.]+) taken back$/.exec(n))) return tw('hist.undonePay',{rm:rm(+m[1])});
    if((m=/^([0-9.]+) unit taken back$/.exec(n))) return tw('hist.undoneMove',{a:Uq(+m[1],oUnit(o))});
    /* S11 11.8 and 11.9: cash he took at the handover, and a short order closed at what was handed over */
    if((m=/^paid ([0-9.]+) in cash$/.exec(n))) return tw('hist.cash',{rm:rm(+m[1])});
    if((m=/^closed at ([0-9.]+) unit of the ([0-9.]+) ordered$/.exec(n))) return tw('hist.closed',{a:Uq(+m[1],oUnit(o)), b:m[2]});
    if((m=/^amended to ([0-9.]+) unit, ([0-9.]+) goods, ([0-9.]+) delivery$/.exec(n))) return tw('hist.amended',{a:Uq(+m[1],oUnit(o)), g:rm(+m[2]), d:rm(+m[3])});
    if((m=/^([0-9.]+) unit (delivered|collected)$/.exec(n))) return tw('hist.'+m[2],{a:Uq(+m[1],oUnit(o))});
    if((m=/^price (asked|offered|confirm|taken|passed|withdrawn)(, order cancelled)?$/.exec(n))) return tw('hist.price.'+m[1]+(m[2]?'Cx':''));
    /* Counter Batch A: his Change point, a line of its own, never a second Ready */
    if((m=/^point moved to ([A-Z][0-9]{1,2})$/.exec(n))) return tw('hist.pointMoved',{p:m[1]});
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
  function oDay(iso,L){ try{ return dmyOf(klBits(iso),L); }catch(e){ return ''; } }
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
    /* the order as a card: its mark a button, its caption under it, and its state beside (his notes of 28 Sep and 11 Oct 2026) */
    b.appendChild(mtile(o.product,o.qty,oUnit(o)));
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title');
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
  /* COUNTER BATCH A (his decisions of 18 Oct 2026): AN ORDER IS A CARD, the whole card one control. Its day and time with its state on top,
     then the mark and size, what it waits on (to pay in ember) or how it ended, and the figure; its name says all of it in one sentence. */
  function oCardWhy(o){
    var w=oWhy(o); if(w) return w;
    var owed=o.total+(+o.delivery||0), paid=+o.paid||0;
    if(paid>0.004&&paid>=owed-0.004) return tw('why.paidFull');
    if(paid<=0.004&&(o.status==='declined'||o.status==='cancelled')) return tw('why.nothingPaid');
    return '';
  }
  function oCard(o,shown){
    var b=el('button','orow ocard salt-glass-card salt-glass-card--radius-lg salt-glass-card--link'+(oClosed(o)?' ocard--ended':'')); b.type='button'; b.setAttribute('data-row',o.id);
    if(o.id===shown) b.setAttribute('aria-current','true');
    var top=el('span','ocard__top'); top.appendChild(el('span','ocard__when',stamp(o.at))); top.appendChild(stateChip(o)); b.appendChild(top);
    var main=el('span','ocard__main'), why=oCardWhy(o);
    main.appendChild(mtile(o.product,o.qty,oUnit(o),32));
    main.appendChild(el('span','ocard__what'+(oOwes(o)?' odue':''),why));
    main.appendChild(el('span','ocard__total',rm(o.total+(+o.delivery||0))));
    b.appendChild(main);
    b.setAttribute('aria-label',tw(why?'ord.cardAriaWhy':'ord.cardAria',{d:oDay(o.at), a:Uq(o.qty,oUnit(o)), s:stateWord(o), w:why}));
    b.addEventListener('click',function(){ oOpen(o.id); });
    return b;
  }
  /* the four ways to look at them on a phone; from 860px Open and Done stand as two columns and there is no filter row */
  var OTABS=[['all','ord.tab.all'],['open','ord.tab.open'],['pay','ord.tab.pay'],['done','ord.tab.done']];
  function oOf(k){ return k==='open'?orders.filter(function(o){ return !oClosed(o); }):k==='pay'?orders.filter(oOwes):k==='done'?orders.filter(oClosed):orders.slice(); }
  function oTabs(){
    var cur=draft.oTab||'all', row=el('div','salt-segment otabs'); row.setAttribute('role','tablist'); row.setAttribute('aria-label',tw('ord.tabs'));
    OTABS.forEach(function(t){
      var b=el('button','salt-segment__opt',tw(t[1])); b.type='button'; b.setAttribute('role','tab');
      b.setAttribute('data-otab',t[0]); b.setAttribute('aria-selected',t[0]===cur?'true':'false');
      b.appendChild(el('span','salt-segment__count',String(oOf(t[0]).length)));
      b.addEventListener('click',function(){ draft.oTab=t[0]; oDraw(); var n=pOrder.querySelector('[data-otab="'+t[0]+'"]'); if(n) try{ n.focus({preventScroll:true}); }catch(e){} });
      row.appendChild(b);
    });
    segSync(row);
    return row;
  }
  /* an empty view: its mark, a heading, one sentence and the one way on */
  function oEmpty(k){
    var box=el('div','oempty salt-empty'), mk=el('span','salt-empty__mark'); mk.setAttribute('aria-hidden','true');
    var NS='http://www.w3.org/2000/svg', s=document.createElementNS(NS,'svg'), d=document.createElementNS(NS,'path');
    s.setAttribute('viewBox','0 0 24 24'); d.setAttribute('d','M6.5 3.5 H17.5 V20.5 L15.3 19.2 L13.1 20.5 L10.9 19.2 L8.7 20.5 L6.5 19.2 Z M9.5 8 H14.5 M9.5 11.5 H14.5 M9.5 15 H12.5');
    s.appendChild(d); mk.appendChild(s); box.appendChild(mk);
    box.appendChild(el('h3','salt-empty__title',tw('ord.empty.'+k+'.t'))); box.appendChild(el('p','salt-empty__text',tw('ord.empty.'+k+'.b')));
    var go=null;
    if(k==='none'){ var nb=(oTopEl&&oTopEl.querySelector('#oNew'))||document.getElementById('oNew'); if(nb){ go=el('button','salt-ghost salt-ghost--lit',tw('ord.empty.none.go')); go.addEventListener('click',function(){ sheetOpen(null,null,go); }); } }
    else{ var to=k==='done'?'open':'all'; go=el('button','salt-ghost salt-ghost--lit',tw('ord.empty.'+k+'.go')); go.addEventListener('click',function(){ draft.oTab=to; oDraw(); }); }
    if(go){ go.type='button'; go.setAttribute('data-oempty',k); box.appendChild(go); }
    return box;
  }
  function oFold(box,past,shown){
    var eb=el('button','salt-ghost olater',tw(past.length===1?'ord.earlier1':'ord.earlierN',{n:past.length})); eb.type='button';
    eb.setAttribute('aria-expanded',draft.oEarlier?'true':'false');
    eb.addEventListener('click',function(){ draft.oEarlier=!draft.oEarlier; oDraw(); });
    box.appendChild(eb);
    if(draft.oEarlier) past.forEach(function(o){ box.appendChild(oItem(o,shown)); });
  }
  function oList(shown){
    var box=el('div','olist'); box.setAttribute('data-olist','');
    if(ordersFailed) box.appendChild(unreadNode('ord.unread',retryOrders));
    if(!orders.length){ if(!ordersFailed) box.appendChild(oEmpty('none')); return box; }
    var B=oBuckets();
    if(oWide()){
      /* from 860px: Open and Done, two columns where the list has the room and one under the other beside an open order */
      var cols=el('div','ocols'), open=B.needs.concat(B.open), pay=orders.filter(oOwes).reduce(function(s,o){ return s+oToPay(o); },0);
      [['open',open],['done',B.past]].forEach(function(c){
        var col=el('section','ocol ocol--'+c[0]); col.setAttribute('aria-label',tw('ord.col.'+c[0]));
        var hd=el('div','ocol__head'), h=el('h3','salt-eyebrow salt-eyebrow--copper olab',tw('ord.tab.'+c[0]));
        h.appendChild(el('span','ocol__n',String(c[1].length))); hd.appendChild(h);
        if(c[0]==='open'&&pay>0.004) hd.appendChild(el('span','ocol__pay',tw('ord.col.toPay',{rm:rm(pay)})));
        col.appendChild(hd);
        if(!c[1].length) col.appendChild(oEmpty(c[0]));
        else if(c[0]==='done'&&c[1].length>12){ c[1].slice(0,12).forEach(function(o){ col.appendChild(oItem(o,shown)); }); oFold(col,c[1].slice(12),shown); }
        else c[1].forEach(function(o){ col.appendChild(oItem(o,shown)); });
        cols.appendChild(col);
      });
      box.appendChild(cols);
      return box;
    }
    box.appendChild(oTabs());
    var k=draft.oTab||'all';
    if(k==='all'){
      function sec(t,list){ box.appendChild(el('h3','salt-eyebrow salt-eyebrow--copper olab',t)); list.forEach(function(o){ box.appendChild(oItem(o,shown)); }); }
      if(B.needs.length) sec(tw('x.needs'),B.needs);
      if(B.open.length) sec(tw('ord.open'),B.open);
      if(B.past.length) oFold(box,B.past,shown);
      return box;
    }
    var list=oOf(k);
    if(!list.length) box.appendChild(oEmpty(k)); else list.forEach(function(o){ box.appendChild(oItem(o,shown)); });
    return box;
  }
  /* S5 5.6 (f12w): FROM 860PX THE LIST STANDS BESIDE AN OPEN ORDER (Phase 7d: it was 1080px, the rail's, and is the width the style turns on).
     Counter Batch A (18 Oct 2026): an order stands there once it is tapped, never by itself, so a desk opens on the Open and Done
     columns; an order marked oAuto (none is now) went when the width dropped below 860px. */
  function oWide(){ try{ return !!(window.matchMedia&&window.matchMedia('(min-width: 860px)').matches); }catch(e){ return false; } }
  function oShownId(){
    if(draft.oOpen&&!oFind(draft.oOpen)) draft.oOpen='';
    /* Counter Batch A (18 Oct 2026): nothing opens by itself any more, so a desk opens on the Open and Done columns and an order
       stands beside them once it is tapped */
    return draft.oOpen||'';
  }
  try{
    var oMq=window.matchMedia&&window.matchMedia('(min-width: 860px)');
    if(oMq&&oMq.addEventListener) oMq.addEventListener('change',function(){
      if(!oWide()&&draft.oAuto){ draft.oOpen=''; draft.oAuto=false; }
      if(document.getElementById('oArea')) oDraw();
    });
  }catch(e){ /* a browser that cannot say keeps the phone's one column */ }
  /* ---- S5 5.2 (24 Sep 2026): AN ORDER'S OWN SCREEN. The goods on their own track (Placed, Confirmed, Ready, then
     Collected or Delivered), so Paid can never run ahead of Delivered; the money on its own lines; ONE next action,
     the filled Pay while something is due and nothing filled when nothing is; the thread; what happened, folded;
     and Cancel at the foot while the goods have not moved. Built in named parts, each rebuilt on its own. ---- */
  function movedAll(o){ var m=+o.moved||0; return m>0&&m>=(+o.qty||0)-0.0004; }
  /* COUNTER BATCH B (his answers of 18 Oct 2026): ORDER AGAIN, ONE RULE for the order's screen, its row and Home's tiles: an order handed
     over in full whose size is still on their list, never a withdrawn, declined or group order, and nothing where nothing is ordered
     from here (his read-only view, the overdue gate) */
  function oAgainOk(o){
    return !!o&&!view&&!hold&&!hidePrices&&movedAll(o)&&o.status!=='cancelled'&&o.status!=='declined'&&!o.pool&&oSoldHas(o.product,o.qty);
  }
  function oAgainOf(o){ return {product:o.product, q:o.qty, mode:o.mode==='deliver'?'deliver':'collect', place:o.mode==='deliver'?String(o.place||''):'', forFriend:!!o.forFriend, id:o.id}; }
  /* on the order's screen: one Pill, and today's figure off the list, never what it came to then */
  function oAgain(o){
    var w=el('div','oagain'); if(!oAgainOk(o)) return w;
    var P=sold().filter(function(x){ return x.product===o.product; })[0], a=oAgainOf(o);
    var b=el('button','salt-pill salt-pill--md',tw('oa.again')); b.type='button'; b.setAttribute('data-again',o.id);
    b.addEventListener('click',function(){ againOpen(a,b); });
    w.appendChild(b);
    w.appendChild(el('p','sub2',tw(a.mode==='deliver'?'oa.againD':'oa.againC',{rm:rm(priceAt(P,o.qty))})));
    return w;
  }
  /* in the list: the card and, beside it and never inside it, a ghost; the pair is one child of the list, its shape w:<id> */
  function oItem(o,shown){
    var c=oCard(o,shown); if(!oAgainOk(o)) return c;
    var w=el('div','oagainrow'); w.setAttribute('data-wrap',o.id); w.appendChild(c);
    var g=el('button','salt-ghost oagainrow__go',tw('oa.again')); g.type='button'; g.setAttribute('data-again',o.id);
    g.setAttribute('aria-label',tw('oa.againAria',{d:oDay(o.at)}));
    g.addEventListener('click',function(){ againOpen(oAgainOf(o),g); });
    w.appendChild(g); return w;
  }
  function firstAt(o,st){ var h=(o.history||[]).filter(function(x){ return x.status===st; })[0]; return h?h.at:''; }
  function ymdDay(s,L){ var m=/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(s||'')); return m?dmyOf({day:m[3],month:m[2],year:m[1]},L):''; }
  /* what the last tap on this order said, beside the control it came from; where the answer took the control away
     (paid in full, cancelled), under the order's state, which is where the change shows */
  function oTap(o){
    var tap=(draft.tap&&draft.tap.id===o.id)?draft.tap:null, k=tap&&tap.k;
    if(k==='pay'&&!oOwes(o) || k==='withdraw'&&!((oPayable(o)||o.status==='placed')&&!(+o.moved>0))) k='state';
    return {k:k, t:tap?tap.t:''};
  }
  /* COUNTER BATCH A (his decisions of 18 Oct 2026): AN ORDER'S SHORT REFERENCE, seven symbols of the site's 30 (no 0, 1, I, L, O or U), four
     then three, derived from its id and never the id: the same on the card he works the order from, so a reference they quote finds it, and never a
     roster code's shape (that is two letters and a digit, then two or three letters) */
  var REF_ALPHA='23456789ABCDEFGHJKMNPQRSTVWXYZ';
  function refHash(s){ var h=2166136261; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }
  function orderRef(id){
    var a=refHash(String(id||'')), b=refHash(String(id||'')+'#'), out='';
    for(var i=0;i<4;i++){ out+=REF_ALPHA.charAt(a%30); a=Math.floor(a/30); }
    out+='-';
    for(var j=0;j<3;j++){ out+=REF_ALPHA.charAt(b%30); b=Math.floor(b/30); }
    return out;
  }
  /* THE PIN to a collection point: their maps app at the point's place, named by its code alone. Apple Maps on an iPhone, iPad or Mac, the
     geo: link Android hands to its maps app, Google Maps anywhere else; a plain navigation, so nothing is loaded from elsewhere */
  function pointHref(code,lat,lng){
    var ua=(navigator&&navigator.userAgent)||'', q='Point%20'+code, ll=lat+','+lng;
    if(/iPhone|iPad|iPod|Macintosh/.test(ua)) return 'https://maps.apple.com/?ll='+ll+'&q='+q;
    if(/Android/.test(ua)) return 'geo:'+ll+'?q='+ll+'('+q+')';
    return 'https://www.google.com/maps/search/?api=1&query='+ll;
  }
  function pinSvg(){
    var NS='http://www.w3.org/2000/svg', s=document.createElementNS(NS,'svg'), d=document.createElementNS(NS,'path');
    s.setAttribute('viewBox','0 0 24 24'); s.setAttribute('aria-hidden','true'); s.setAttribute('focusable','false');
    d.setAttribute('d','M12 21 C12 21 5 14.6 5 9.6 A7 7 0 0 1 19 9.6 C19 14.6 12 21 12 21 Z M12 7.2 A2.4 2.4 0 1 0 12 12 A2.4 2.4 0 1 0 12 7.2');
    s.appendChild(d); return s;
  }
  function pinLink(o){
    var a=el('a','salt-pin opin'); a.href=pointHref(o.point,o.pointAt.lat,o.pointAt.lng);
    if(/^https:/.test(a.getAttribute('href'))){ a.target='_blank'; a.rel='noopener'; }
    a.setAttribute('aria-label',tw('pt.pin',{c:o.point})); a.appendChild(pinSvg());
    return a;
  }
  /* THE BAND, the order's head: its reference, its state as the heading, then what it is and how it goes, and, while it waits at one of
     his points, the point and its pin */
  function oHead(o){
    var h=el('div','oband salt-band'), top=el('div','salt-band__head');
    top.appendChild(el('span','salt-eyebrow salt-eyebrow--copper',tw('oh.order')));
    var ref=el('span','salt-band__ref oref',orderRef(o.id)); ref.setAttribute('data-ref',''); top.appendChild(ref);
    h.appendChild(top);
    h.appendChild(el('h3','state oband__state',stateWord(o)));
    var foot=el('div','salt-band__foot'), col=el('span','oband__what');
    foot.appendChild(mtile(o.product,o.qty,oUnit(o)));
    col.appendChild(el('span','sub2',tw('oh.'+(o.mode==='deliver'?(o.place?'deliverTo':'deliver'):'collect')+(o.forFriend?'F':''),
      {t:Dd(stamp,o.at), p:o.place||''})));
    var waits=o.point&&o.status==='ready'&&o.mode==='collect'&&!movedAll(o);
    if(waits) col.appendChild(el('span','oband__point',tw('pt.at',{c:o.point})));
    foot.appendChild(col);
    if(waits&&o.pointAt&&isFinite(o.pointAt.lat)&&isFinite(o.pointAt.lng)) foot.appendChild(pinLink(o));
    h.appendChild(foot);
    return h;
  }
  /* GOODS ONLY: a declined or cancelled order has no track to show. Counter Batch A: each step a drawn mark (a receipt, a tick, a box, then
     a bag or a van), the moment it happened under its name, and Next on the step to come */
  var STEP_GLYPH={paid:'M12 3.5 A8.5 8.5 0 1 0 12 20.5 A8.5 8.5 0 1 0 12 3.5 M14.6 9 C14 8.2 13.1 7.8 12 7.8 C10.5 7.8 9.4 8.6 9.4 9.8 C9.4 12.6 14.6 11.4 14.6 14.2 C14.6 15.4 13.5 16.2 12 16.2 C10.9 16.2 10 15.8 9.4 15 M12 6.4 V7.8 M12 16.2 V17.6',
    placed:'M6.5 3.5 H17.5 V20.5 L15.3 19.2 L13.1 20.5 L10.9 19.2 L8.7 20.5 L6.5 19.2 Z M9.5 8 H14.5 M9.5 11.5 H14.5 M9.5 15 H12.5',
    confirmed:'M12 3.5 A8.5 8.5 0 1 0 12 20.5 A8.5 8.5 0 1 0 12 3.5 M8 12.3 L11 15.2 L16.2 9.2', ready:'M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z M4 8 L12 12 L20 8 M12 12 V20',
    collected:'M6 8 H18 L17 20 H7 Z M9 8 V6.5 A3 3 0 0 1 15 6.5 V8',
    delivered:'M2.5 7 H14 V16 H2.5 Z M14 10 H18 L21.5 13.2 V16 H14 M6.5 19 A1.8 1.8 0 1 0 6.5 15.4 A1.8 1.8 0 1 0 6.5 19 M17.5 19 A1.8 1.8 0 1 0 17.5 15.4 A1.8 1.8 0 1 0 17.5 19'};
  function stepRm(v){ var n=Math.round((+v||0)*100)/100; return n%1?n.toFixed(2):String(n); }
  function stepWhen(iso){
    if(!iso) return '';
    try{ var k=klBits(iso), n=klBits(new Date().toISOString()); return k.day===n.day&&k.month===n.month&&k.year===n.year?k.hour+':'+k.minute:dmyOf(k); }catch(e){ return ''; }
  }
  function oSteps(o){
    var w=el('div');
    if(o.status==='declined'||o.status==='cancelled') return w;
    var d=o.mode==='deliver', keys=['placed','confirmed','ready',d?'delivered':'collected'];
    var names=[tw('st.placed'),tw('st.acknowledged'),tw('st.ready'),tw(d?'st.delivered':'st.collected')];
    var cur=o.status==='done'?4:movedAll(o)?3:(o.status==='ready'||(+o.moved||0)>0)?2:o.status==='acknowledged'?1:0;
    var at=[o.at,firstAt(o,'acknowledged'),firstAt(o,'ready'),''];
    var ol=el('ol','salt-steps salt-steps--marks'); ol.setAttribute('aria-label',tw('oh.steps'));
    names.forEach(function(n,i){
      var li=el('li','salt-steps__step'+(i<cur?' salt-steps__step--done':i===cur?' salt-steps__step--now':i===cur+1?' salt-steps__step--next':''));
      if(i===cur) li.setAttribute('aria-current','step');
      var mk=el('span','salt-steps__mark'), NS='http://www.w3.org/2000/svg', s=document.createElementNS(NS,'svg'), p=document.createElementNS(NS,'path');
      mk.setAttribute('aria-hidden','true'); s.setAttribute('viewBox','0 0 24 24'); p.setAttribute('d',STEP_GLYPH[keys[i]]); s.appendChild(p); mk.appendChild(s);
      li.appendChild(mk); li.appendChild(el('span','salt-steps__name',n));
      var when=i<=cur?(i===3?(o.movedOn?ymdDay(o.movedOn):''):stepWhen(at[i])):i===cur+1?tw('oh.next'):'';
      if(when) li.appendChild(el('span','salt-steps__time',when));
      ol.appendChild(li);
    });
    /* 20 Oct 2026 (his answer): PAID, the fourth step, before the goods' last: done once nothing is owed, which may come before the goods go
       on an order paid first; part paid, how much of what, "RM 40/70" */
    var due=(+o.total||0)+(+o.delivery||0), paid=+o.paid||0, settled=['acknowledged','ready','done'].indexOf(o.status)>=0&&due>0&&paid>=due-0.004;
    var pays=(o.payments||[]).filter(function(x){ return x&&(!x.claim||x.claim==='received')&&x.at; }), pli=el('li','salt-steps__step'+(settled?' salt-steps__step--done':''));
    var pmk=el('span','salt-steps__mark'), NS2='http://www.w3.org/2000/svg', ps=document.createElementNS(NS2,'svg'), pp=document.createElementNS(NS2,'path');
    pmk.setAttribute('aria-hidden','true'); ps.setAttribute('viewBox','0 0 24 24'); pp.setAttribute('d',STEP_GLYPH.paid); ps.appendChild(pp); pmk.appendChild(ps);
    pli.appendChild(pmk); pli.appendChild(el('span','salt-steps__name',tw('st.paid'))); pli.setAttribute('data-step','paid');
    var ptime=settled?stepWhen(pays.length?pays[pays.length-1].at:''):paid>0.004&&due>0?'RM '+stepRm(paid)+'/'+stepRm(due):'';
    if(ptime) pli.appendChild(el('span','salt-steps__time',ptime));
    ol.insertBefore(pli,ol.lastChild);
    w.appendChild(ol); return w;
  }
  /* where it stands and when, in one sentence, off the record's own moments. S11 11.7: an order he ended says so
     with his reason; S11 11.9: one he closed at what was handed over says the size it was and the size it is. */
  /* COUNTER BATCH C (20 Oct 2026, item 19): a placed order waiting on his Accept says how long he usually takes, off /hours: open with
     ten or more measured, the figure and its count; closed, when it opens and no figure; anything else (under ten, the hours not read,
     an ask or an offer on it) today's line. The figure is site-wide, measured by the Counter (stmt/confirm.js), never this order's. */
  function confirmDur(m){
    var h=Math.floor(m/60), r=m%60, a=h===0?'':h===1?tw('ow.hour'):tw('ow.hours',{n:h});
    return a&&r?a+' '+tw('ow.mins',{n:r}):a||tw('ow.mins',{n:r});
  }
  function confirmLine(o,put,p){
    var H=!hoursError&&counterHours&&typeof counterHours.open==='boolean'?counterHours:null, c=H&&H.confirm;
    if(!H||o.price){ put('ow.placed'); return; }
    if(!H.open){ put('ow.shut');
      if(H.nextOpen){ p.appendChild(document.createTextNode(' ')); put('ow.opens',{t:esch(hhmm(H.nextOpen)), d:function(L){ return esch(oDay(H.nextOpen,L)); }}); }
      return; }
    if(c&&c.n>=10&&c.n<=30&&c.mins>=15){ put('ow.within',{d:esch(confirmDur(c.mins))}); p.appendChild(document.createTextNode(' ')); put('ow.measured',{n:c.n}); return; }
    put('ow.placed');
  }
  function oWhen(o){
    /* S13: each a whole sentence from the table, its day in bold, his reason a slot */
    var w=el('div'), p=el('p','salt-insight'), d=o.mode==='deliver', mv=+o.moved||0, paid=+o.paid||0, s=o.status, e=endOf(o),
        /* Step 1b: his reason is a sentence, the banner's body too; one filed before, with no stop, is given one */
        why=e&&e.note?esch(/[.!?]$/.test(e.note.trim())?e.note.trim():e.note.trim()+'.'):'', back=tw(paid>0?'ow.refunded':'ow.nothingOwed',{rm:rm(paid)}),
        went=function(x){ return function(L){ return esch(x(L)||wordIn(L,'ow.dayWent')); }; }, sz=function(q){ return function(L){ return esch(unitsOf(q,oUnit(o),L)); }; };
    function put(k,sl){ p.appendChild(setW(el('span'),k,sl)); }
    if(s==='placed') confirmLine(o,put,p);
    else if(s==='done') put('ow.done');
    else if(s==='declined'){ put(why?'ow.declinedWhy':'ow.declined',{why:why}); p.appendChild(document.createTextNode(' '+back)); }
    else if(s==='cancelled'&&e&&e.by==='desk'){ put(why?'ow.cancelUsWhy':'ow.cancelUs',{why:why}); p.appendChild(document.createTextNode(' '+back)); }
    else if(s==='cancelled') put(paid>0?'ow.cancelledPaid':'ow.cancelled',{rm:rm(paid)});
    else if(movedAll(o)) put(d?'ow.deliveredOn':'ow.collectedOn',{d:went(function(L){ return ymdDay(o.movedOn,L); })});
    else if(mv>0) put(d?'ow.partDeliveredOn':'ow.partCollectedOn',{a:sz(mv), b:sz(o.qty), d:went(function(L){ return ymdDay(o.movedOn,L); })});
    else if(s==='ready') put(d?'ow.readyDeliver':'ow.readyCollect',{d:Dd(oDay,firstAt(o,'ready'))});
    else put('ow.confirmed',{d:Dd(oDay,firstAt(o,'acknowledged'))});
    /* 10 Oct 2026 (his Q4): his Accept reminds them to pay now, in words only; every term stands */
    if(s==='acknowledged'&&!(mv>0)&&(+o.total||0)+(+o.delivery||0)-paid-oClaimed(o)>0.004){ p.appendChild(document.createTextNode(' ')); put(o.prepay?'ow.payNow':'ow.payNowCredit');
    }
    /* 20 Oct 2026: an order that takes them over to their next reward says so while it is still to pay, goods out or not, with no figure */
    if(o.rwd==='cross'&&(s==='acknowledged'||s==='ready')&&(+o.total||0)+(+o.delivery||0)-paid-oClaimed(o)>0.004){ p.appendChild(document.createTextNode(' ')); put('ow.rwdCross'); }
    /* 29 Sep 2026: the day they asked for, while it is still to come to them */
    if(o.wantBy&&!(mv>0)&&OPEN_ST.indexOf(s)>=0){ p.appendChild(document.createTextNode(' ')); put('ow.wantBy',{d:function(L){ return esch(ymdDay(o.wantBy,L)); }}); }
    /* 10 Oct 2026: the time asked for, while the goods are still to go */
    if(o.slot&&o.slotSpan&&!(mv>0)&&OPEN_ST.indexOf(s)>=0){ p.appendChild(document.createTextNode(' '));
      put('ow.window',{a:esch(winPart(o.slotSpan,0)), b:esch(winPart(o.slotSpan,1)), d:function(L){ return esch(ymdDay(winDay(o.slot),L)); }}); }
    if(o.pinned&&o.mode==='deliver'&&!(mv>0)&&OPEN_ST.indexOf(s)>=0){ p.appendChild(document.createTextNode(' ')); put('ow.pinned'); }
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
  /* S13: which of seven, the order's screen saying it as pw.<k> and Home's Coming up as hc.still<k> */
  function payWhenKey(o){
    var mv=+o.moved||0, ar=o.mode==='deliver'?'Arrives':'Collect';
    if(mv>0&&movedAll(o)) return 'WithYou';
    /* V2 (28 Sep 2026, his instruction): an order at Ready is due at once, cash on handover included (his C1) */
    if(o.status==='ready') return 'DueNow';
    if(mv>0) return 'Part';
    /* V3: an order over the cap is paid before it is handed over, never at the handover */
    if(o.prepay) return 'Prepay';
    /* S6 6.8: cash chosen for the handover is paid then, never now */
    return (o.method==='cod'?'Cash':'Now')+ar;
  }
  function payWhen(o){ return tw('pw.'+payWhenKey(o)); }
  /* THE MONEY ON ITS OWN LINES: the goods, the delivery, what is paid, what they have sent and is waiting, and what
     is still to pay, with when it may be paid */
  /* F13: a claim waiting with a slip says so, and once its SLIP_DAYS are over, that it is no longer kept */
  function oSlipWord(o){
    var s=(o.payments||[]).filter(function(x){ return x&&x.claim==='waiting'&&x.slip; });
    if(!s.length) return 'om.waiting';
    return s.some(function(x){ return Date.now()-Date.parse(x.at)<SLIP_DAYS*864e5; })?'om.waitingSlip':'om.waitingSlipGone';
  }
  function oMoney(o){
    var L=el('div','salt-ledger salt-ledger--plain'), paid=+o.paid||0, claimed=oClaimed(o), d=o.mode==='deliver', where=o.place?tw('om.to',{p:o.place}):'';
    /* S11 11.9: a short order closed at what was handed over is billed for that, and its Goods line says so */
    /* Step 2: a price we set on this order when we acknowledged it, with what they placed it at beside it */
    L.appendChild(lrow(tw('om.goods'),rm(o.total),o.closed&&o.closed.qty?tw('om.handed',{a:Uq(o.qty,oUnit(o)), b:o.closed.qty})
      :typeof o.asked==='number'&&Math.abs(o.asked-(+o.total||0))>0.004?tw('om.placedAt',{rm:rm(o.asked)}):''));
    if(d) L.appendChild(o.status==='placed'?lrow(tw('sh.delivery'),'',o.place?tw('om.setToP',{p:o.place}):tw('om.set')):lrow(tw('sh.delivery'),rm(o.delivery||0),where));
    /* 20 Oct 2026: the reward unit that comes with this order: its mark, one unit, no charge, and no amount */
    if(o.rwd==='given'){ var rwr=lrow(tw('om.rwd'),tw('om.rwdFree')), rwl=rwr.querySelector('.salt-ledger__label'); rwl.insertBefore(markLead(o.product,16),rwl.firstChild); rwr.classList.add('orwd'); L.appendChild(rwr); }
    /* Counter Batch A: each payment we have, with its way and its day, where they add up to what is paid; else one line */
    var conf=(o.payments||[]).filter(function(x){ return x&&(!x.claim||x.claim==='received')&&+x.amount>0; }),
        csum=conf.reduce(function(s,x){ return s+(+x.amount); },0);
    if(paid>0&&conf.length&&Math.abs(csum-paid)<0.005) conf.forEach(function(x){
      var r=lrow(tw('om.paid'),rm(+x.amount)), lab=r.querySelector('.salt-ledger__label');
      lab.appendChild(el('span','salt-ledger__sub',x.method?tw('om.byOn',{m:function(L){ return methodWord(x.method,x.account,L); }, d:Dd(oDay,x.at)}):tw('om.on',{d:Dd(oDay,x.at)})));
      L.appendChild(r);
    });
    else if(paid>0) L.appendChild(lrow(tw('om.paid'),rm(paid)));
    if(claimed>0) L.appendChild(lrow(tw('om.sentByYou'),rm(claimed),tw(oSlipWord(o))));
    var ac=oPayable(o)?oAcct(o):0;
    if(ac>0.004) L.appendChild(lrow(tw('om.sentAcct'),rm(ac),tw(acctWaiting()>0.004?'om.waiting':'om.received')));
    /* S6 6.5: a payment he could not find, while the order is still to pay */
    if(oPayable(o)) oLost(o).forEach(function(x){ L.appendChild(lrow(tw('om.notFound'),rm(x.amount),tw('om.checkBank'),'odue')); });
    if(oPayable(o)){
      var tp=oToPay(o);
      var still=tp>0.004
        ?lrow(tw('pay.still'),rm(tp),payWhen(o),'odue')
        :lrow(tw('pay.still'),rm(0),tw(claimed>0||ac>0.004&&acctWaiting()>0.004?'om.sentWaiting':'om.paidFull'));
      if(tp>0.004) still.classList.add('salt-ledger__row--due');
      L.appendChild(still);
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
      pb.setAttribute('data-back','pay:'+o.id);
      pb.addEventListener('click',function(){ openPay(orderCtx(o.id),pb,'pay:'+o.id); });
      a.appendChild(pb);
    }
    /* Counter Batch A: Message beside Pay on every order, every stage, Done included: it takes them to the composer */
    if(!view){
      var mb=el('button','salt-ghost omsg',tw('oa.msg')); mb.type='button'; mb.setAttribute('data-msg',o.id);
      mb.addEventListener('click',function(){ var s=pOrder.querySelector('.oscreen[data-order="'+o.id+'"] input[data-say]'); if(s){ try{ s.scrollIntoView({block:'center'}); }catch(e){} try{ s.focus({preventScroll:true}); }catch(e){} } });
      a.appendChild(mb);
    }
    if(tp.k==='pay'&&tp.t) a.appendChild(statusLine(tp.t));
    return a;
  }
  /* DETAILS, folded: when it was ordered, the way, the window or the point, and the reference; no note. Kept open across a poll */
  function oDetails(o){
    var w=el('div');
    var f=el('details','odet salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm'), s=el('summary','odet__sum');
    s.appendChild(el('span','salt-eyebrow salt-eyebrow--copper',tw('od.h'))); f.appendChild(s);
    if((draft.oDet||{})[o.id]) f.open=true;
    f.addEventListener('toggle',function(){ (draft.oDet=draft.oDet||{})[o.id]=f.open; });
    var L=el('div','salt-ledger salt-ledger--plain');
    L.appendChild(lrow(tw('od.at'),stamp(o.at)));
    L.appendChild(lrow(tw('od.way'),tw(o.mode==='deliver'?'od.deliver':'od.collect')));
    if(o.slot&&o.slotSpan) L.appendChild(lrow(tw('od.window'),tw('od.windowAt',{d:function(L){ return ymdDay(winDay(o.slot),L); }, a:winPart(o.slotSpan,0), b:winPart(o.slotSpan,1)})));
    if(o.pinned&&o.mode==='deliver') L.appendChild(lrow(tw('od.sealed'),tw('od.sealedV')));
    if(o.point) L.appendChild(lrow(tw('od.point'),tw(movedAll(o)||o.status==='done'?'pt.atDone':'pt.code',{c:o.point})));
    var rr=lrow(tw('od.ref'),orderRef(o.id)); L.appendChild(rr);
    f.appendChild(L); w.appendChild(f);
    return w;
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
    was.replaceWith(oPartOf(k,o));
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
    if(o.replacement||o.replaces){
      var replacement=el('a','salt-ghost',tw(o.replacement?'ord.replaced':'ord.replaces'));
      replacement.href='#o='+encodeURIComponent(o.replacement||o.replaces); w.appendChild(replacement);
    }
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
      if(oOfferOpen(o)){ f.appendChild(el('p','sub2',tw('e.offerOpen'))); return f; }
      if(o.status==='placed'&&!hold&&!(o.price&&o.price.state==='taken')){
        var amend=el('button','salt-ghost',tw('ord.amend')); amend.type='button';
        amend.addEventListener('click',function(){
          if(!oSoldHas(o.product,o.qty)){ tapSaid(o,'amend',tw('ord.amendMissing')); oDraw(); return; }
          sheetOpen(o.product,o.qty,amend,o);
        });
        f.appendChild(amend);
      }
      var wb=el('button','salt-ghost salt-ghost--danger',tw('ord.cancel')); wb.type='button'; wb.setAttribute('data-yn','cancel:'+o.id);
      wb.addEventListener('click', function(){
        /* 11 Oct 2026: asked in a Sheet that restates the order, not by the browser's confirm; its yes is the request it always sent */
        ynCancel(oFind(o.id)||o, wb, 'cancel:'+o.id, async function(){
          var mine=ticket; var r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{rid:ridFor(o.id+':cancel','')});
          if(mine!==ticket) return;
          if(r.body.ok) ridDone(o.id+':cancel');
          tapSaid(o,'withdraw',r.body.ok?'':wErr(r.body,'ord.notCancelled'));
          await loadOrders(); if(mine!==ticket) return; oDraw();
        });
      });
      f.appendChild(wb);
      if((tp.k==='withdraw'||tp.k==='amend')&&tp.t) f.appendChild(statusLine(tp.t));
    }
    return f;
  }
  /* ---- F10: HOW WAS YOUR ORDER. Five stars, once every unit is with them, asked two days after the last handover by a
     banner and by a card on Home (for a phone with no banners), and answered on the order or on the card alike. The
     card asks while the handover is under two weeks old, as the banner does; the order asks for good. A rating stands:
     it is said as five marks, never asked again. His read-only view shows a rating and asks nothing. ---- */
  function rateOpen(o){ return movedAll(o)&&!o.rating&&o.status!=='declined'&&o.status!=='cancelled'; }
  function dayMinus(n){ var p=klBits(new Date().toISOString()); return new Date(Date.UTC(+p.year,+p.month-1,+p.day)-n*864e5).toISOString().slice(0,10); }
  function rateDue(o){ var d=String(o.movedOn||''); return !view&&rateOpen(o)&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)&&d<=dayMinus(2); }
  function rateHome(o){ return rateDue(o)&&String(o.movedOn)>dayMinus(14); }
  function starMark(on){ var s=glyph('star',24); if(on) s.firstChild.setAttribute('fill','currentColor'); return s; }
  function rateGave(n){ var p=el('p','rgave'); for(var i=1;i<=5;i++) p.appendChild(starMark(i<=n)); p.appendChild(el('span','rtx',tw('rt.gave',{n:n}))); return p; }
  function rateStrip(o){
    var g=el('div','rstars'); g.setAttribute('role','group'); g.setAttribute('aria-label',tw('rt.ask'));
    for(var i=1;i<=5;i++) (function(n){
      var b=el('button','salt-ghost rstar'); b.type='button'; b.setAttribute('aria-label',tw('rt.star',{n:n})); b.setAttribute('data-star',String(n));
      b.disabled=draft.rating===o.id; b.appendChild(starMark(false));
      b.addEventListener('click',function(){ rateSend(o,n); });
      g.appendChild(b);
    })(i);
    return g;
  }
  /* A DOUBLE TAP RATES ONCE. When the answer is in, the rated card leaves Home and the next order's card slides under the
     finger, so the gesture's second tap would land on it and give an order a rating nobody chose, and a rating is never
     changed. The stars stand still for a second after an answer that took the card away (rated, or rated already). */
  async function rateSend(o,n){
    if(view||draft.rating||Date.now()<(draft.rateHold||0)) return;
    var key=o.id+':rate', mine=ticket;
    draft.rating=o.id;
    var r=await api('/orders/'+encodeURIComponent(o.id)+'/rate',{stars:n, rid:ridFor(key,String(n))});
    draft.rating=''; if(r.body&&(r.body.ok||r.body.code==='rated')) draft.rateHold=Date.now()+1000;
    if(mine!==ticket) return;
    /* a refusal is said under the stars; a rating that stands (rated already, on a retry) draws its marks instead */
    var b=r.body||{};
    if(b.ok) ridDone(key);
    tapSaid(o,'rate',b.ok?'':wErr(b,'rt.notSent'));
    if(!b.ok) rateDraw(o.id,n);   /* a refusal is said where the stars stand, before the re-read */
    await oReread(); if(mine!==ticket) return;
    rateDraw(o.id,n); oSync([o.id]); drawHome();
  }
  /* The rate part drawn again, and the focus kept. oSync leaves a part that holds the focus, and the star just tapped is
     inside this one: its answer or its refusal showed nothing until the focus went. The focus goes back to the star that
     was tapped, or to the marks once it is rated. */
  function rateDraw(id,n){
    var at=function(){ return pOrder.querySelector('.oscreen[data-order="'+id+'"] [data-part="rate"]'); }, s=at(), had=!!s&&s.contains(document.activeElement);
    oPart(id,'rate');
    if(!had) return;
    s=at();
    var f=s&&(s.querySelector('[data-star="'+n+'"]')||s.querySelector('.rgave'));
    if(f){ if(f.tagName!=='BUTTON') f.setAttribute('tabindex','-1'); try{ f.focus({preventScroll:true}); }catch(e){} }
  }
  function oRate(o){
    var w=el('div','orate');
    if(o.rating&&+o.rating.stars>=1){ w.appendChild(rateGave(+o.rating.stars)); return w; }
    if(!rateDue(o)) return w;
    w.appendChild(el('h4',null,tw('rt.ask')));
    w.appendChild(rateStrip(o));
    var tp=oTap(o); if(tp.k==='rate'&&tp.t) w.appendChild(statusLine(tp.t));
    return w;
  }
  /* NEGOTIATE (05 Oct 2026): a price they asked for, and our offer: the goods alone and the rate, open until a moment, Accept
     or No thanks. Delivery stays its own line, told at the acknowledgement as on any order. The page prices nothing. */
  function oOfferOpen(o){ var p=o.price; return !!p&&p.state==='offered'&&o.status==='placed'&&!!p.until&&new Date().toISOString()<=String(p.until); }
  function oPrice(o){
    var w=el('div','oprice'), p=o.price; if(!p||o.status!=='placed') return w;
    var lapsed=p.state==='offered'&&!oOfferOpen(o), tp=oTap(o);
    /* VERSION 2 (10 Oct 2026): HIS ACCEPT FOR THEIR YES, the whole order as he would agree it: the goods beside what they placed
       it at, his delivery charge and the window. Yes takes it; No thanks withdraws the order, at no cost */
    if(p.from==='accept'){
      if(p.state==='offered'&&!lapsed){
        w.appendChild(el('p','salt-insight',tw('np.cAsk')));
        var same=Math.abs((+p.total||0)-(+o.total||0))<0.005;
        w.appendChild(kpiTile('brass',tw('np.cGoods'),rm(p.total),same?tw('np.cSame'):tw('np.cWas',{rm:rm(o.total)})));
        if(o.mode==='deliver') w.appendChild(el('p','sub2',tw('np.cDeliv',{rm:rm(+p.delivery||0)})));
        if(p.slot&&p.slotSpan){ var wl=el('p','sub2'); setW(wl,'np.cWin',{a:esch(winPart(p.slotSpan,0)), b:esch(winPart(p.slotSpan,1)), d:function(L){ return esch(ymdDay(winDay(p.slot),L)); }}); w.appendChild(wl); }
        w.appendChild(el('p','sub2',tw('np.until',{t:Dd(stamp,p.until)})));
        if(!view){
          var cy=el('button','salt-pill salt-pill--md',tw('np.cYes')); cy.type='button'; cy.disabled=draft.offerBusy===o.id;
          cy.addEventListener('click',function(){ offerAnswer(o,'take'); });
          var cn=el('button','salt-ghost',tw('np.cNo')); cn.type='button'; cn.disabled=draft.offerBusy===o.id;
          cn.addEventListener('click',function(){ offerAnswer(o,'pass'); });
          var cr=el('div','oact'); cr.appendChild(cy); cr.appendChild(cn); w.appendChild(cr);
        }
      }
      else w.appendChild(el('p','sub2',tw(lapsed?'np.cLapsed':p.state==='withdrawn'?'np.cWithdrawn':'np.cTaken')));
      if(tp.k==='price'&&tp.t) w.appendChild(statusLine(tp.t));
      return w;
    }
    if(p.state==='asked') w.appendChild(el('p','salt-insight',tw('np.asked')));
    else if(p.state==='offered'&&!lapsed){
      w.appendChild(kpiTile('brass',tw('np.offer'),rm(p.total),tw('np.unit',{rm:rm(+(p.total/(+o.qty||1)).toFixed(2))})));
      w.appendChild(el('p','sub2',tw('np.until',{t:Dd(stamp,p.until)})+' '+tw(o.mode==='deliver'?'np.deliv':'np.collect')));
      if(!view){
        var ok=el('button','salt-pill salt-pill--md',tw('np.accept')); ok.type='button'; ok.disabled=draft.offerBusy===o.id;
        ok.addEventListener('click',function(){ offerAnswer(o,'take'); });
        var no=el('button','salt-ghost',tw('np.pass')); no.type='button'; no.disabled=draft.offerBusy===o.id;
        no.addEventListener('click',function(){ offerAnswer(o,'pass'); });
        var r=el('div','oact'); r.appendChild(ok); r.appendChild(no); w.appendChild(r);
      }
    }
    else w.appendChild(el('p','sub2',tw(lapsed?'np.lapsed':p.state==='passed'?'np.passed':p.state==='withdrawn'?'np.withdrawn':'np.taken')));
    if(tp.k==='price'&&tp.t) w.appendChild(statusLine(tp.t));
    return w;
  }
  async function offerAnswer(o,how){
    if(view||draft.offerBusy) return;
    var key=o.id+':'+how, mine=ticket; draft.offerBusy=o.id; oPart(o.id,'price');
    var r=await api('/orders/'+encodeURIComponent(o.id)+'/'+how,{rid:ridFor(key,'')});
    draft.offerBusy='';
    if(mine!==ticket) return;
    var b=r.body||{}; if(b.ok) ridDone(key);
    tapSaid(o,'price',b.ok?'':wErr(b,'np.notSent'));
    await loadOrders(); if(mine!==ticket) return; oDraw();
  }
  var OPARTS={head:oHead, steps:oSteps, when:oWhen, money:oMoney, price:oPrice, act:oAct, again:oAgain, rate:oRate, thread:oThread, say:oSay, details:oDetails, hist:oHist, foot:oFoot};
  /* one part drawn: its name, hidden when empty, and the parts in the slice saying the reader's language inside a screen
     that says English (S13-L1) */
  function oPartOf(k,o){ var n=OPARTS[k](o); n.setAttribute('data-part',k); n.hidden=!n.childNodes.length; return n; }
  function oScreen(o){
    var s=el('section','oscreen salt-glass-card salt-glass-card--radius-md salt-glass-card--pad-sm'); s.setAttribute('data-order',o.id);
    s.setAttribute('aria-label',tw('oh.aria',{a:Uq(o.qty,oUnit(o)), d:Dd(oDay,o.at)}));
    var back=el('button','salt-ghost salt-ghost--tight oback',tw('ord.yours')); back.type='button';
    back.addEventListener('click',function(){ var id=draft.oOpen; draft.oOpen=''; oDraw(); scrollClear(pOrder.querySelector('[data-row="'+id+'"]')); });
    s.appendChild(back);
    Object.keys(OPARTS).forEach(function(k){ s.appendChild(oPartOf(k,o)); });
    return s;
  }
  /* on a phone the open order is the whole tab, with the way back at its head */
  function oPlace(){
    var id=oShownId(), o=oFind(id), open=!!(draft.oOpen&&o), place=el('div','oplace'+(open?' o-open':'')+(o?'':' oplace--one'));
    place.id='oArea';
    pOrder.classList.toggle('o-open',open);
    /* New is read against what this device had seen when the order was opened, and stays until it is left; the
       list is drawn after the open order is seen, so its row does not call a reply on screen waiting */
    if(draft.oShown!==id){ draft.oShown=id; draft.oSince={}; }
    draft.oStale='';
    if(o&&!(id in draft.oSince)) draft.oSince[id]=seenMark(o);
    if(o) seeIt(o);
    var col=el('div','olistcol'); if(oTopEl) col.appendChild(oTopEl);
    col.appendChild(el('h2',null,tw('ord.yours'))); col.appendChild(oList(id));
    place.appendChild(col);
    if(o) place.appendChild(oScreen(o));
    return place;
  }
  function oDraw(){ var was=document.getElementById('oArea'); if(was) was.replaceWith(oPlace()); }
  /* S5 5.5: the orders that changed, patched where they stand. The list keeps every row that did not change; a row
     that did is drawn again and keeps the focus, holding nothing typed. The open order keeps any part holding the
     focus, and draft.oStale has the next poll draw it once the focus has left; a part that reads the same is left
     as it is, which is always the composer. Only an order opened or gone draws the place again. */
  function oShape(list){ return [].map.call(list.children,function(x){ var w=x.getAttribute('data-wrap'); return w?'w:'+w:x.getAttribute('data-row')||x.textContent; }).join('|'); }
  /* the order's own node in a list, the pair where Order again stands beside the card; and the control in it that had focus, found again */
  function oNode(box,id){ var r=box.querySelector('[data-row="'+id+'"]'); return r&&r.parentNode&&r.parentNode.getAttribute&&r.parentNode.getAttribute('data-wrap')===id?r.parentNode:r; }
  function oRefocus(box,id,again){ var f=box.querySelector((again?'[data-again="':'button[data-row="')+id+'"]'); if(f) try{ f.focus({preventScroll:true}); }catch(e){} }
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
        var n=oPartOf(k,o);
        if(n.outerHTML===p.outerHTML) return;
        if(p.contains(ae)) draft.oStale=sid; else p.replaceWith(n);
      });
    }
    var was=place.querySelector('[data-olist]'), nl=oList(shown);
    if(was&&oShape(was)!==oShape(nl)){
      var inn=ae&&was.contains(ae), fa=inn?ae.getAttribute('data-again'):null, fr=inn?fa||ae.getAttribute('data-row'):null;
      was.replaceWith(nl);
      if(fr) oRefocus(nl,fr,!!fa);
    } else if(was) ids.forEach(function(id){
      var r=oNode(was,id), n=oNode(nl,id);
      if(!r||!n||r.outerHTML===n.outerHTML) return;
      var had=r.contains(ae), ag=had&&ae.hasAttribute('data-again'); r.replaceWith(n);
      if(had) oRefocus(n.parentNode||nl,id,ag);
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
  function dayName(s,L){ var t=ymdAt(s); if(t==null) return ''; var d=new Date(t); return day3(L)[d.getUTCDay()]+' '+dmyOf({day:d.getUTCDate(),month:d.getUTCMonth()+1,year:d.getUTCFullYear()},L); }
  function todayKL(){ var p=klBits(new Date().toISOString()); return p.year+'-'+('0'+p.month).slice(-2)+'-'+p.day; }
  function daysTo(s){ var t=ymdAt(s), n=ymdAt(todayKL()); return t==null||n==null?null:Math.round((t-n)/864e5); }
  /* 28 Sep 2026 (his instruction): a part is overdue from the day its goods went (since) and due is the last day it
     can be paid with ordering kept open. "Pay by Thu 1 Oct, in 3 days, to keep ordering.", and once the publish has
     sealed it late, "Overdue by 5 days." counted from that handover; of the first of several parts, "Pay the first by
     ..." or "The first is overdue by ...". A part past its day that the publish has not yet sealed late reads Today. */
  function dueWords(p,first){
    var n=p&&p.due?daysTo(p.due):null;
    if(n==null) return '';
    var from=p.since||p.gotOn||p.date, k=first?'first':'';
    if(lateNow(p)&&from) return tw('due.'+k+'Late',{n:Math.max(0,-(daysTo(from)||0))});
    return tw('due.'+k+(n<=0?'Today':n===1?'Tomorrow':'InN'),{d:Dd(dayName,p.due), n:n});
  }
  function unitFor(pr){ var P=prices&&prices.products&&prices.products.filter(function(x){ return x.product===pr; })[0]; return P?P.unit:'unit'; }
  /* "The rest of [cube] 2.5 units you received Wed 16 Sep": the rest where part of the order is paid; a part not yet
     received says when it was ordered. A part to come is Coming up's own row (partRow, S7 polish) */
  /* S13: the mark as a slot, so the sentence round it is one of the table's; {mark} is the symbol with its shape's name */
  function markHtml(pr,px){ var w=el('span'); w.appendChild(psym(pr,px)); w.appendChild(el('span','sr',pshape(pr))); return w.innerHTML; }
  function partSpan(p){
    var k=(+p.whole>+p.rm+0.004?'part.rest':'part.')+(p.gotOn?'Got':p.date?'Ordered':'Bare')+(p.resale?'F':'');
    return setW(el('span'),k,{mark:markHtml(p.product,20), u:function(L){ return esch(unitsOf(p.qty,unitFor(p.product),L)); },
      d:function(L){ return ymdDay(p.since||p.gotOn||p.date,L); }});
  }
  function lrowN(node,value,flag,cls){ var r=lrow('',value,flag,cls); r.querySelector('.salt-ledger__label').appendChild(node); return r; }
  /* 27 Sep 2026 (his approval, "Reward cover on statements"), AMENDED THE SAME DAY (DROP THE RINGGIT): A NOTE, WITH NO
     AMOUNT, that part of an order was paid from the reward, under the part it belongs to, keyed so a switch of language
     words it again. Only where the publish sealed a flag (payDue's cover, on one part only). The part's own figure is
     still what is owed, the cover already paid; a reward unit is valued at cost, so a ringgit figure here would give a
     customer salt's own cost per unit. The statement's order line carries the same note, with no amount either. */
  function coverTo(x,p){ if(x&&p&&p.cover) x.appendChild(setW(el('span','sub2 pcover'),'part.cover')); return x; }
  function kpiTile(tone,label,value,note){
    var k=el('div','salt-kpi salt-kpi--'+tone);
    k.appendChild(el('span','salt-kpi__label',label)); k.appendChild(el('span','salt-kpi__value',value));
    /* a note is a node or plain words: the offer tiles (Negotiate and his Accept for their yes) pass words */
    if(note){ var n=el('span','salt-kpi__note'); n.appendChild(typeof note==='string'?document.createTextNode(note):note); k.appendChild(n); }
    return k;
  }
  /* S6 6.7: the overdue figure, the line, and whether a claim waiting on him has lifted it. The owner's view holds too. */
  /* 28 Sep 2026 (his instruction): LATE ON THIS PHONE'S CLOCK AS WELL. The publish seals late, but only
     the Actions chain publishes, hourly at best and not at all on a red run, so a part whose last day has passed on this
     phone's Kuala Lumpur day is late here whether or not the publish has caught up. It only ever adds: a sealed late
     stands whatever the clock says, so a phone's date set back lifts nothing. What is overdue is the parts late now. */
  function lateNow(p){ return !!p&&(!!p.late||(!!p.due&&(daysTo(p.due)||0)<0)); }
  function odNow(){
    var ps=payDue&&payDue.now&&payDue.now.parts?payDue.now.parts.filter(lateNow):((payDue&&payDue.overdue&&payDue.overdue.parts)||[]);
    return {rm:+ps.reduce(function(t,x){ return t+(+x.rm||0); },0).toFixed(2), parts:ps};
  }
  function odRm(){ return odNow().rm; }
  /* S6 fix: WHAT IS STILL OVERDUE, less the money he has received since the statement was written that reaches it: a claim
     against the account, which the oldest parts, the overdue ones, take first, and an order's own claim on an overdue part
     (nowOf). His Received used to bring the hold back until the next publish, asking again for what he had just confirmed.
     A claim still waiting lifts the hold whatever its figure (his D9). */
  function odLeft(){ var od=odRm(); if(!(od>0.004)) return 0;
    var got=nowOf().filter(function(x){ return lateNow(x.p); }).reduce(function(t,x){ return t+x.back; },0);
    return Math.max(0,+(od-got).toFixed(2)); }
  /* S7 7.1: the places keep their names over the line; Home leads with what to pay, and Orders is the payment page */
  function setHold(){ hold=odLeft()>0.004&&!(sentWaiting()>0.004); var st=stageNow(), was=hidePrices; hidePrices=st>=2; locked=st>=3;
    if(was!==hidePrices&&(hidePrices||prices)) drawPrices();
    if(assoc&&rewardsEl) grey(rewardsEl,locked); }
  /* greyed out and out of reach: seen, never tapped or tabbed into */
  function grey(n,on){ n.classList.toggle('lockd',!!on); if(on) n.setAttribute('inert',''); else n.removeAttribute('inert'); }
  /* V5 (his answers of 29 Sep 2026): THE ACCOUNT CLOSES IN STAGES, counted from the handover of the oldest part still
     overdue: past the term no new order (the hold), from pay.hide the prices are hidden, and from pay.lock the account is
     only for paying. A claim waiting on him lifts every stage, as it lifts the hold (D9). 0 open, 1 held, 2 prices
     hidden, 3 locked. */
  /* the late parts still unpaid once what he received since the publish is taken off, oldest first (Fable's review): a part
     paid since is never what locks the account or dates its warning */
  function odOpen(){ return nowOf().filter(function(x){ return x.p&&lateNow(x.p)&&x.back<(+x.p.rm||0)-0.004; }).map(function(x){ return x.p; }); }
  function odDays(){ var n=-1; odOpen().forEach(function(p){ var f=p.since||p.gotOn||p.date; if(f){ var d=-(daysTo(f)||0); if(d>n) n=d; } }); return n; }
  function stageNow(){ if(!hold) return 0; var d=odDays(), P=payDue||{};
    return P.lock!=null&&d>=P.lock?3:P.hide!=null&&d>=P.hide?2:1; }
  function isoPlus(s,n){ var t=ymdAt(s); return t==null?null:new Date(t+n*864e5).toISOString().slice(0,10); }
  /* what they lose next and when, under To pay now while the hold stands */
  function stageNote(){
    var st=stageNow(), P=payDue||{}, f=null;
    if(!st) return '';
    odOpen().forEach(function(p){ var x=p.since||p.gotOn||p.date; if(x&&(!f||x<f)) f=x; });
    if(st===3) return tw('st.locked',{rm:rm(odLeft())});
    if(st===2) return P.lock!=null?tw('st.lock',{d:Dd(dayName,isoPlus(f,P.lock))}):'';
    return P.hide!=null?tw('st.prices',{d:Dd(dayName,isoPlus(f,P.hide)), l:Dd(dayName,isoPlus(f,P.lock!=null?P.lock:P.hide))}):'';
  }
  function odNote(od){
    var n=el('span'), ps=od.parts||[];
    if(ps.length===1){ n.appendChild(partSpan(ps[0])); n.appendChild(document.createTextNode('. '+dueWords(ps[0]))); coverTo(n,ps[0]); }
    else n.appendChild(document.createTextNode(tw(payDue&&payDue.term===1?'pay.odManyDay':'pay.odMany',{n:ps.length, t:payDue&&payDue.term})+' '+dueWords(ps[0],true)));
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
  /* ---- V2 (28 Sep 2026, his points 1 and 6): AN ORDER AT READY IS DUE AT ONCE, AND TO PAY NOW IS AN INVOICE. A line for
     each order at Ready still owing, read off the order itself (all that is left on it: its goods and delivery less what
     is paid), so it is due the moment he taps Ready rather than at the next publish; a line for each part the publish
     sealed that no order at Ready accounts for. The lines run in the order the desk books money sent against the account
     (claimAlloc, the orders at Ready named): the rows with goods out, oldest first, then the orders at Ready with nothing
     handed over, oldest first; that money is spread over them in that order, each to what is left on it, so each line's
     Less sent is what the desk will book there. An order at Ready whose row is not on the book yet (no rowOn) takes none
     of it, as the desk's allocation cannot reach it either. The hold still reads the sealed parts alone (back): due is
     not overdue, and an order at Ready unpaid holds nothing. ---- */
  function readyDue(o){ return !!o&&o.status==='ready'&&dueOf(o)>0.004; }
  function nowOf(){
    var out=((payDue&&payDue.now&&payDue.now.parts)||[]).map(function(p){ return {p:p, o:null, fig:+p.rm||0, own:0, acct:0}; });
    orders.forEach(function(o){
      if(!o.rowOn||['cancelled','declined'].indexOf(o.status)>=0) return;
      var w=+((+o.total||0)+(+o.delivery||0)).toFixed(2);
      for(var i=0;i<out.length;i++){ var p=out[i].p;
        if(!out[i].o&&p.date===o.rowOn&&Math.abs((+p.whole||0)-w)<0.005&&!!p.resale===!!o.forFriend){ out[i].o=o; break; } }
    });
    orders.forEach(function(o){ if(readyDue(o)&&!out.some(function(x){ return x.o===o; })) out.push({p:null, o:o, fig:0, own:0, acct:0}); });
    out.forEach(function(x,i){ var o=x.o; x.i=i;
      if(readyDue(o)){ x.fig=dueOf(o); x.own=Math.min(x.fig,oClaimed(o)); }
      else if(o) x.own=Math.min(x.fig,+(oClaimed(o)+sumOf(oSince(o))).toFixed(2));
    });
    function grp(x){ return !x.p&&!((+x.o.moved||0)>0)?1:0; }
    function day(x){ return String((x.p?x.p.date:x.o.rowOn)||'9999'); }
    out.sort(function(a,b){ return grp(a)-grp(b)||day(a).localeCompare(day(b))||a.i-b.i; });
    var left=+(acctWaiting()+sumOf(acctSince())).toFixed(2);
    out.forEach(function(x){ if(!x.p&&!x.o.rowOn) return;
      var t=+Math.max(0,Math.min(left,x.fig-x.own)).toFixed(2); x.acct=t; left=+(left-t).toFixed(2); });
    /* what reaches a sealed part, for the hold: money on an order at Ready goes to its handed part first */
    out.forEach(function(x){ x.back=!x.p?0:readyDue(x.o)?Math.min(+x.p.rm||0,+(oClaimed(x.o)+sumOf(oSince(x.o))+x.acct).toFixed(2)):+(x.own+x.acct).toFixed(2); });
    return out;
  }
  function oAcct(o){ var x=nowOf().filter(function(y){ return y.o===o; })[0]; return x?x.acct:0; }
  function invTotal(lines){ return Math.max(0,+lines.reduce(function(t,x){ return t+x.fig-x.own-x.acct; },0).toFixed(2)); }
  function acctToPay(){ return invTotal(nowOf()); }
  function sentWaiting(){ return +(acctWaiting()+orders.reduce(function(n,o){ return n+(['cancelled','declined'].indexOf(o.status)>=0?0:oClaimed(o)); },0)).toFixed(2); }
  /* the lines under To pay now: what waits on him, and his answers since the statement was written, or in the last fortnight.
     V2: the invoice's Less sent carries what reaches its lines, so the first two are said only where it does not carry all of it */
  function claimLines(lines){
    var out=[], sw=sentWaiting(), rc=acctSince(), inv=(lines||[]).reduce(function(t,x){ return t+x.own+x.acct; },0);
    if(inv+0.004<+(sw+sumOf(rc)).toFixed(2)){
      if(sw>0.004) out.push(tw('cl.waiting',{rm:rm(sw)}));
      rc.forEach(function(c){ out.push(tw('cl.received',{rm:rm(c.amount), d:Dd(oDay,c.answered)})); });
    }
    /* S6 fix: likewise only while nothing was sent since and To pay now still asks for something */
    claims.filter(function(c){ return c&&c.state==='notfound'&&Date.now()-Date.parse(c.answered||c.at)<14*864e5&&acctToPay()>0.004
      &&!claims.some(function(y){ return y&&String(y.at)>String(c.answered||c.at); }); })
      .forEach(function(c){ out.push(tw('cl.notFound',{rm:rm(c.amount), d:Dd(oDay,c.at)})); });
    return out;
  }
  /* A LINE OF THE INVOICE: what it is and what it adds up from. An order at Ready reads the order: its size, its goods,
     delivery and what is paid. A part reads what the publish sealed (V2): the units handed over at the rate, their goods
     and delivery, and what is paid on the row, adding up to its figure; one sealed before V2 has its figure alone. */
  function invOf(x){
    var o=x.o, p=x.p;
    if(readyDue(o)){ var q=o.closed&&+o.closed.qty>0?+o.closed.qty:(+o.qty||0);
      return {product:o.product, q:q, rate:q>0?+((+o.total||0)/q).toFixed(2):0, friend:!!o.forFriend, goods:+o.total||0, deliv:+o.delivery||0, less:+o.paid||0, split:true}; }
    var sp=typeof p.goods==='number';
    return {product:p.product, q:sp?(+p.got||0):(+p.qty||0), rate:+p.rate||0, friend:!!p.resale,
      goods:sp?+p.goods:(+p.rm||0), deliv:sp?(+p.deliv||0):0, less:sp?(+p.less||0):0, split:sp};
  }
  function isoDay(iso){ if(!iso) return ''; try{ var p=klBits(iso); return p.year+'-'+('0'+p.month).slice(-2)+'-'+p.day; }catch(e){ return ''; } }
  /* when a line is due: in a word or three on Home ("Due now", "Pay by Tue 29 Sep", "Overdue by 5 days"), and whole on the
     pay sheet, after when the goods went or the order was made ready. An order at Ready is due now unless its handed part is
     already late, which is overdue as it was. */
  function dueShort(p){
    var n=p&&p.due?daysTo(p.due):null; if(n==null) return '';
    var from=p.since||p.gotOn||p.date;
    if(lateNow(p)&&from) return tw('dueS.Late',{n:Math.max(0,-(daysTo(from)||0))});
    return n<=0?tw('dueS.Today'):tw('dueS.By',{d:Dd(dayName,p.due)});
  }
  function invWhen(x,full){
    var o=x.o, p=x.p, now=readyDue(o)&&!(p&&lateNow(p));
    if(!full) return now?tw('dueS.Now'):dueShort(p);
    var rd=readyDue(o)?(movedAll(o)?o.movedOn:isoDay(firstAt(o,'ready'))):'', got=p&&(p.since||p.gotOn),
        at=rd?tw(movedAll(o)?'inv.gotOn':'inv.readySince',{d:Dd(ymdDay,rd)}):got?tw('inv.gotOn',{d:Dd(ymdDay,got)}):'',
        due=now?tw('due.Now'):dueWords(p);
    return at&&due?at+' '+due:at||due;
  }
  function ledLine(k,v){ var l=el('div','salt-ledger__line'); l.appendChild(el('span','salt-ledger__label',k)); l.appendChild(el('span','salt-ledger__value',v)); return l; }
  /* the lines past the third, folded on Home under "N more" (the system's Plan recipe, a native details). Opened or shut stays
     as they left it across a poll, which redraws the head only where it reads differently, an open one's attribute included */
  var HOME_LINES=3, invMoreOpen=false;
  function invMore(rest){
    var d=el('details','salt-plan invmore'), sm=el('summary'), b=el('div','salt-plan__body');
    d.id='invMore'; d.open=invMoreOpen;
    d.addEventListener('toggle',function(){ invMoreOpen=d.open; });
    sm.appendChild(el('span','salt-plan__title',tw('inv.more',{n:rest.children.length})));
    b.appendChild(rest); d.appendChild(sm); d.appendChild(b);
    return d;
  }
  /* Home draws each line in one row, its figure and when (his "less words, but maximum impact"), then Less sent where
     something was sent, the figure above being the Total; the pay sheet draws the line whole with what it adds up from
     beneath it, then Goods, Delivery, Less paid, Less sent and the Total. A nil figure is left out, and a line of goods
     alone draws nothing beneath it. */
  function invNode(lines,full){
    var L=el('div','salt-ledger salt-ledger--plain inv'), T={goods:0,deliv:0,less:0,sent:0}, split=true,
        rest=el('div','salt-ledger salt-ledger--plain inv invrest'),
        wait=lines.some(function(x){ return x.o&&oClaimed(x.o)>0.004&&x.own>0.004; })||(acctWaiting()>0.004&&lines.some(function(x){ return x.acct>0.004; }));
    lines.forEach(function(x,i){
      var d=invOf(x), mk=markHtml(d.product,20), u=function(Lg){ return esch(unitsOf(d.q,unitFor(d.product),Lg)); },
          lab=full&&d.split&&d.rate>0?setW(el('span'),d.friend?'inv.lineF':'inv.line',{mark:mk, u:u, rate:esch(rm(d.rate))})
            :setW(el('span'),d.friend?'part.BareF':'part.Bare',{mark:mk, u:u});
      var r=lrowN(lab,rm(x.fig),invWhen(x,full),x.p&&lateNow(x.p)?'odue':'');
      if(full){
        var det=[[tw('om.goods'),d.goods],[tw('sh.delivery'),d.deliv],[tw('inv.lessPaid'),d.less]].filter(function(q,i){ return i===0||q[1]>0.004; });
        if(d.split&&det.length>1){ var dd=el('div','invd'); det.forEach(function(q){ dd.appendChild(ledLine(q[0],rm(q[1]))); }); r.appendChild(dd); }
      }
      /* his approval of 27 Sep 2026: the part their reward paid says so, with no amount, on Home and on the sheet */
      coverTo(r,x.p);
      /* PHASE 7A (his yes of 11 Oct 2026): HOME SHOWS THREE LINES and the rest stand behind "N more"; the sheet shows all of them */
      (!full&&i>=HOME_LINES?rest:L).appendChild(r);
      T.goods+=d.goods; T.deliv+=d.deliv; T.less+=d.less; T.sent+=x.own+x.acct; split=split&&d.split;
    });
    var sent=+T.sent.toFixed(2);
    if(!full){
      invMoreOpen=invMoreOpen&&!!rest.firstChild;
      if(rest.firstChild) L.appendChild(invMore(rest));
      if(sent>0.004) L.appendChild(lrow(tw('inv.lessSent'),rm(sent),wait?tw('om.waiting'):''));
      return L;
    }
    var tr=el('div','salt-ledger__row invt');
    function tl(k,v,f){ tr.appendChild(ledLine(k,rm(v))); if(f) tr.appendChild(el('span','salt-ledger__flag',f)); }
    if(split){ tl(tw('om.goods'),T.goods); if(T.deliv>0.004) tl(tw('sh.delivery'),T.deliv); if(T.less>0.004) tl(tw('inv.lessPaid'),T.less); }
    if(sent>0.004) tl(tw('inv.lessSent'),sent,tw(wait?'om.waiting':'om.received'));
    if(tr.firstChild) L.appendChild(tr);
    var tt=lrow(tw('inv.total'),rm(invTotal(lines))); tt.className+=' invtot'; L.appendChild(tt);
    return L;
  }
  /* S7 7.1: TO PAY NOW IS HOME'S FIRST ANSWER, so it answers even when it is nothing: a new account says there is nothing
     on it yet, and an account owing nothing now says so, with no Pay. Over the line (setHold) it says, in the payment
     page's own words, to pay the overdue amount first; the payment page itself is Orders'. Built afresh and put on the
     page only where it reads differently, so a poll never takes a tap's focus from its Pay. V2: the figure is the
     invoice's Total, its lines beneath it and the one Pay for it; each line says its own day, so the note under the
     figure and the Overdue list under it went. */
  function payHeadNode(){
    var box=el('div','payhead'); box.id='payHead';
    var lines=nowOf(), tot=invTotal(lines), said=bundle?claimLines(lines):[], fr=fresh();
    var bad=liveBad(), old=staleNow();
    box.hidden=!bundle||!(old||bad||fr||payDue||lines.length||said.length);
    if(box.hidden) return box;
    /* 7D4: the figures are as of the last read, so the line stands where they would, and the foot below goes with them */
    if(old){ box.appendChild(staleNode()); return box; }
    /* C15: an account that could not be read leads with that, never with nothing to pay */
    if(bad) box.appendChild(unreadNode(bad,bad==='acct.unread'?retryAccount:null));
    if(lines.length){
      /* PHASE 7A: with something to pay, the tile and the one Pay stand in the foot above the bar (payFootNode), so the
         pill is never under it; the head keeps the lines and what is said about them */
      if(!payFootOn(lines,tot)) box.appendChild(kpiTile(tot>0.004?'ember':'verdigris',tw('pay.now'),rm(tot)));
      box.appendChild(invNode(lines,false));
      if(hold) box.appendChild(el('p','salt-insight salt-insight--copper',tw('pay.hold',{rm:rm(odLeft())})));
      /* V5c (his answer of 29 Sep 2026): what paying late costs, in few words, while something is to pay */
      var lk=lateKeep(); if(lk&&tot>0.004){ var kp=el('p','sub2',lk); kp.id='lateKeep'; box.appendChild(kp); }
      var sn=stageNote(); if(sn){ var sp=el('p','salt-insight salt-insight--copper'); sp.id='stageNote'; sp.textContent=sn; box.appendChild(sp); }
    }
    else if(fr) box.appendChild(kpiTile('verdigris',tw('pay.toPay'),rm(0),el('span',null,tw('acct.nothing'))));
    /* C18: nothing to pay is said once, never over RM 0 */
    else if(payDue&&!bad) box.appendChild(el('p','lead pnil',tw('pay.nothing')));
    said.forEach(function(t){ box.appendChild(statusLine(t)); });
    return box;
  }
  /* V5c: the terms of paying late, off the sealed term, lock and window; nothing where the statement predates them */
  function lateKeep(){ var P=payDue; if(!P||typeof P.term!=='number') return ''; return tw(P.term===1?'late.keepDay':'late.keep',{t:P.term}); }
  function lateFull(){ var P=payDue; if(!P||typeof P.term!=='number'||typeof P.lock!=='number'||typeof P.window!=='number') return '';
    return tw('late.full',{s:P.term+1, l:P.lock, w:P.window}); }
  /* PHASE 7A (his yes of 11 Oct 2026): HOME LEADS WITH THE ONE ACTION. Something to pay now, and not his read-only view of an
     account (no Pay there), puts To pay now's tile and its one filled Pay in a sticky foot above the App bar, so the pill is never
     under it and never below the fold. S6 6.4: the pill opens the pay sheet on what is to pay now, the one road for Home's Pay.
     With nothing to pay now no foot is drawn: the tile stays in the head, as it was. */
  function payFootOn(lines,tot){ return !view&&tot>0.004&&lines.length>0; }
  function payFootNode(){
    var f=el('div','payfoot'); f.id='homeFoot';
    var lines=nowOf(), tot=invTotal(lines);
    f.hidden=!bundle||staleNow()||!payFootOn(lines,tot);
    if(f.hidden) return f;
    f.appendChild(kpiTile('ember',tw('pay.now'),rm(tot)));
    var pb=el('button','salt-pill salt-pill--md',tw('pay.payRm',{rm:rm(tot)})); pb.type='button'; pb.id='payNow';
    pb.setAttribute('data-back','pay:now');
    pb.addEventListener('click',function(){ openPay(acctCtx(),pb,'pay:now'); });
    f.appendChild(pb);
    return f;
  }
  function drawPayHead(){
    [['payHead',payHeadNode],['homeFoot',payFootNode]].forEach(function(p){
      var was=document.getElementById(p[0]), n=p[1](); if(was&&was.outerHTML!==n.outerHTML) was.replaceWith(n); });
    cBar();
    footSet(); glanceDraw();
  }
  /* Counter Batch A: the live pill sticks above the pay foot, so the foot's height is the pill's offset; again on a resize */
  function footSet(){ var f=document.getElementById('homeFoot'), h=document.getElementById('pHome'); if(f&&h) h.style.setProperty('--hfoot',(f.hidden?0:Math.ceil(f.offsetHeight||0))+'px'); }
  window.addEventListener('resize',footSet);
  /* S6 6.2: WHAT IS COMING UP BEYOND THE ORDERS. Home's Coming up lists the site's orders agreed and not handed over; a
     part the publish sealed that no order of theirs accounts for (a row he entered on the desk) stands under them, with
     its due day and never a Pay. An order is its part when the part is on the day its row is (rowOn), of its mark and
     size, and on the friend's bucket or not. */
  function ackDayOf(x){ var h=(x.history||[]).filter(function(e){ return e&&e.status==='acknowledged'&&e.by==='desk'&&!e.note; });
    if(!h.length) return ''; var p=klBits(h[h.length-1].at); return p.year+'-'+('0'+p.month).slice(-2)+'-'+p.day; }
  function redatedFrom(x,p){ return !!x.wantBy&&(+x.moved||0)>0&&!!x.rowOn&&p.date<x.rowOn&&p.date===ackDayOf(x)
    &&String(x.movedOn||'')>=String(liveAt||'').slice(0,10); }
  function comingParts(){
    var used={};
    return ((payDue&&payDue.coming&&payDue.coming.parts)||[]).filter(function(p){
      var o=orders.filter(function(x){ return !used[x.id]&&x.rowOn&&(x.rowOn===p.date||redatedFrom(x,p))&&['cancelled','declined'].indexOf(x.status)<0
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
     through payHref at that account, rail and figure; the Counter never names that page.
     PHASE 7B (his yes of 11 Oct 2026): HIS BANKS COME FIRST, then the figure, All or Part, and What this pays folded away, then the
     way. With a bank chosen and Transfer, the sheet shows that bank's account number in fours with Copy (digits only) above the
     reference. THE NUMBER COMES FROM THE COUNTER'S KV KEY paynum (GET /pay/accounts), written from his laptop by paysync --numbers,
     NEVER FROM GIT: the repo is public, and stmt/pay.js holds names and rails only. With the number, I have paid goes straight to
     Did you send and Open the payment page stays a ghost link; with none (or Scan a code) the filled pill is the link as before and
     I am back moves to Did you send, so the question no longer waits on the page losing and regaining focus (blur and focus stay as
     the fallback). The figure is fixed as the sheet opens, so a poll landing while they pay cannot move it. */
  var paySh=document.getElementById('paySheet'), payScr=document.getElementById('payScrim'), PS=null;
  var PAYNUM={}, payNumAsked=false, payNumAt=0;
  /* asked as a sheet opens, on their own session (his read-only view has none and asks nothing), one ask at a time and again only
     once the last answer is a minute old (PAY_FRESH_MS); an answer that did not come lets the next open ask again. The number
     shows only when it is 10 to 15 digits, whatever the Worker sent. WITH IT, down (17 Oct 2026): which accounts QR Command has
     under maintenance now, read live off its own state; each is laid on PAY's flag, so payHref, and with it payInto, never offers or links
     one, a bank chosen before the answer included. No down leaves the flags as they were. */
  function payNumLoad(){
    if(payNumAsked||view||!session||Date.now()-payNumAt<PAY_FRESH_MS) return;
    payNumAsked=true;
    api('/pay/accounts').then(function(r){
      payNumAsked=false;
      var a=r.body&&r.body.ok&&r.body.accounts, dn=r.body&&r.body.ok&&r.body.down;
      if(!a||typeof a!=='object') return;
      PAYNUM=a; payNumAt=Date.now();
      if(dn&&typeof dn==='object') PAY.forEach(function(x){ if(typeof dn[x.key]==='boolean') x.maintenance=dn[x.key]; });
      if(PS&&PS.step==='pay') drawPay();
    });
  }
  var PAY_FRESH_MS=60000;
  function numOf(key){
    var x=PAYNUM[key], n=x&&typeof x.number==='string'?x.number:'';
    return /^[0-9]{10,15}$/.test(n)?n:'';
  }
  function groupFours(n){ var o=[]; for(var i=0;i<n.length;i+=4) o.push(n.slice(i,i+4)); return o.join(' '); }
  var GL=__GLYPH__;
  function glyph(name,px){ var s=psym('_',px); s.setAttribute('class','psym glyph'); s.firstChild.setAttribute('d',GL[name]); return s; }
  /*__PAYHREF__*/
  function payInto(rail,amt){ return PAY.filter(function(a){ return !!payHref(a.key,rail,amt,user); }); }
  /* label: a key, worded as the sheet draws */
  /* V2: the invoice is fixed as the sheet opens, as its figure is, so a poll landing while they pay moves neither */
  function acctCtx(){ var L=nowOf(); return {kind:'acct', fig:invTotal(L), label:'pay.now', lines:L, note:function(){ return null; }}; }
  function orderCtx(id){
    var o=oFind(id);
    return {kind:'order', id:id, fig:o?oToPay(o):0, label:'pay.still', note:function(){
      return setW(el('span'),movedAll(o)?'pn.orderedWithYou':'pn.ordered',{mark:markHtml(o.product,20),
        u:function(L){ return esch(unitsOf(o.qty,oUnit(o),L)); }, d:Dd(oDay,o.at)}); }};
  }
  /* from: the Pay that opened it, and key: its data-back, to find it again if a redraw replaces it while the sheet is open (focusBack) */
  function openPay(ctx,from,key){
    if(!paySh||view||!(ctx.fig>0.004)) return;
    /* S6 fix: Transfer is the way chosen as it opens, as the mockup draws it; the way is not the account, and no account is */
    PS={ctx:ctx, part:false, amt:'', rail:'transfer', acct:'', said:'', step:'pay', away:null, busy:false, what:false, from:from||null, back:key||''};
    bkOpen('pay',closePay);
    payNumLoad();
    payScr.hidden=false; paySh.hidden=false; behind(); drawPay();
    try{ paySh.focus(); }catch(e){}
  }
  /* quiet (=== true) when the page is leaving it (a lock, another account): focus has nowhere to go back to */
  function closePay(quiet){
    if(!paySh||paySh.hidden) return;
    var ps=PS; paySh.hidden=true; payScr.hidden=true; behind(); PS=null; payqDrop(); bkDrop('pay');
    if(quiet!==true&&ps) focusBack(ps.from,ps.back?backFind(ps.back):null);
  }
  /* ---- F13 (29 Sep 2026): A SLIP, SEALED ON THIS PHONE. On Did you send, a picture of the payment may go with the claim,
     one a claim: re-encoded here to 1,600 px JPEG under SLIP_BYTES, then sealed to the public half of his slip key
     (GET /slip/key) before it leaves, so only ciphertext reaches the site (rule 2) and only his vault opens it. The
     protocol is the laptop's slipSeal (tools/seed-vault.mjs) and the desk's slipOpen. This page cannot open it again:
     the claim says Slip sent, and no longer kept after its SLIP_DAYS. No key filed, no slip is offered. ---- */
  var SLIPKEY, SLIP_PX=1600, SLIP_BYTES=1500000, SLIP_DAYS=30;
  function slipKeyLoad(){
    if(SLIPKEY!==undefined||view) return;
    SLIPKEY=null;   /* asked once a visit */
    api('/slip/key').then(function(r){ var k=r.body&&r.body.ok&&r.body.key; if(!k) return; SLIPKEY=k; if(PS&&PS.step==='check') drawPay(); if(osh&&(draft.step==='form'||draft.step==='spot')) sheetDraw(); });
  }
  async function slipSeal(pub,bytes,info){
    var S=crypto.subtle, E={name:'ECDH',namedCurve:'P-256'}, iv=crypto.getRandomValues(new Uint8Array(12));
    var eph=await S.generateKey(E,false,['deriveBits']);
    var pk=await S.importKey('jwk',{kty:pub.kty,crv:pub.crv,x:pub.x,y:pub.y},E,false,[]);
    var hk=await S.importKey('raw',await S.deriveBits({name:'ECDH',public:pk},eph.privateKey,256),'HKDF',false,['deriveKey']);
    var key=await S.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(0),info:new TextEncoder().encode(info||'salt-slip v1')},hk,{name:'AES-GCM',length:256},false,['encrypt']);
    return {v:1, epk:b64e(await S.exportKey('raw',eph.publicKey)), iv:b64e(iv), ct:b64e(await S.encrypt({name:'AES-GCM',iv:iv},key,bytes))};
  }
  function slipRead(f,how){ return new Promise(function(ok,no){ var rd=new FileReader(); rd.onload=function(){ ok(rd.result); }; rd.onerror=no; rd[how](f); }); }
  function slipImage(url){ return new Promise(function(ok,no){ var im=new Image(); im.onload=function(){ ok(im); }; im.onerror=no; im.src=url; }); }
  function slipJpeg(c,q){ return new Promise(function(ok){ c.toBlob(ok,'image/jpeg',q); }); }
  async function slipPick(file){
    var ps=PS; if(!ps||!SLIPKEY||ps.slipBusy) return;
    if(!file||file.type&&String(file.type).indexOf('image/')!==0){ ps.slipSaid=tw('pay.slipNotPic'); drawPay(); return; }
    ps.slip=null; ps.slipBusy=true; ps.slipSaid=''; drawPay();
    var got=null, said='';
    try{
      var im=await slipImage(await slipRead(file,'readAsDataURL')), w=im.naturalWidth||im.width, h=im.naturalHeight||im.height,
          k=Math.min(1,SLIP_PX/Math.max(w,h,1)), c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(w*k)); c.height=Math.max(1,Math.round(h*k));
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      var b=null, qs=[0.8,0.6,0.45];
      for(var i=0;i<qs.length&&!(b&&b.size<=SLIP_BYTES);i++) b=await slipJpeg(c,qs[i]);
      if(!b) said=tw('pay.slipNotPic');
      else if(b.size>SLIP_BYTES) said=tw('pay.slipBig');
      else {
        var t=document.createElement('canvas'), tk=Math.min(1,88/Math.max(c.width,c.height));
        t.width=Math.max(1,Math.round(c.width*tk)); t.height=Math.max(1,Math.round(c.height*tk)); t.className='slipthumb'; t.setAttribute('aria-hidden','true');
        t.getContext('2d').drawImage(c,0,0,t.width,t.height);
        got={sealed:await slipSeal(SLIPKEY,new Uint8Array(await slipRead(b,'readAsArrayBuffer'))), thumb:t};
      }
    }catch(e){ got=null; said=tw('pay.slipNotPic'); }
    if(PS!==ps) return;
    ps.slipBusy=false; ps.slip=got; ps.slipSaid=said; drawPay();
  }
  /* the slip's place on Did you send: Attach a slip, or the picture attached and Remove */
  function slipBlock(){
    var box=el('div','payslip');
    if(PS.slip){
      box.appendChild(PS.slip.thumb);
      box.appendChild(el('span','sub2',tw('pay.slipReady')));
      var drop=el('button','salt-ghost',tw('pay.slipDrop')); drop.type='button';
      drop.addEventListener('click',function(){ PS.slip=null; PS.slipSaid=''; drawPay(); });
      box.appendChild(drop);
    } else {
      var inp=el('input'); inp.type='file'; inp.accept='image/*'; inp.hidden=true; inp.id='paySlipFile';
      inp.addEventListener('change',function(){ slipPick(inp.files&&inp.files[0]); });
      var add=el('button','salt-ghost',tw(PS.slipBusy?'pay.slipWork':'pay.slipAdd')); add.type='button'; add.id='paySlip'; add.disabled=!!PS.slipBusy;
      add.addEventListener('click',function(){ inp.click(); });
      box.appendChild(inp); box.appendChild(add);
      box.appendChild(el('p','sub2',tw('pay.slipWhy')));
    }
    if(PS.slipSaid) box.appendChild(statusLine(PS.slipSaid));
    return box;
  }
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
     they will pay; the cash itself is his to record when he takes it, so the customer never declares it. V3: never on an
     order paid in advance, whose reason is said first, since paying at the door is not paying in advance. */
  function cashWay(){
    var o=oFind(PS.ctx.id), d=o&&o.mode==='deliver', pre=!!(o&&o.prepay), no=pre||heldUnpaid();
    return {v:'cod', label:d?'pay.cashArrives':'pay.cashCollect', g:'cash', off:no,
      detail:pre?'pay.cashPrepay':no?'pay.cashOff':'pay.cashOn'};
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
    /* 13 Oct 2026 (stress): the sheet is drawn afresh, so a radio chosen by the arrow keys, which holds focus as it redraws, is given it again (name and value) */
    var held=document.activeElement&&document.activeElement.type==='radio'&&body.contains(document.activeElement)?document.activeElement.name+'|'+document.activeElement.value:'';
    body.textContent=''; payTitle();
    if(c.kind==='order'&&PS.rail==='cod'&&readyDue(oFind(c.id))) PS.rail='transfer';
    var cash=PS.rail==='cod';
    /* PHASE 7B: HIS BANKS FIRST, as the system's Option tiles, one tap each, none chosen; then the figure beside them */
    if(PS.rail&&!cash){
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
    body.appendChild(kpiTile('ember',tw(c.label),rm(c.fig),c.note()));
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
    /* What this pays: the invoice's lines in the system's Plan recipe, shut, and as they left it across a redraw */
    if(c.lines){
      var wd=el('details','salt-plan paywhat'), ws=el('summary'), wb=el('div','salt-plan__body');
      wd.id='payWhat'; wd.open=!!PS.what;
      wd.addEventListener('toggle',function(){ if(PS) PS.what=wd.open; });
      ws.appendChild(el('span','salt-plan__title',tw('pay.what')));
      wb.appendChild(invNode(c.lines,true)); wd.appendChild(ws); wd.appendChild(wb); body.appendChild(wd);
    }
    /* V5c: the pay sheet says in full what paying late can cost */
    var lf=lateFull(); if(lf){ var lp=el('p','sub2',lf); lp.id='lateFull'; body.appendChild(lp); }
    var fs=el('fieldset','salt-options payhow'), g=el('div','salt-options__grid');
    fs.appendChild(el('legend','salt-options__legend',tw('pay.how')));
    /* V2 (his C1): an order at Ready is due now, so its sheet offers no cash way, cash on handover chosen or not */
    HOW.concat(c.kind==='order'&&!readyDue(oFind(c.id))?[cashWay()]:[]).forEach(function(w){
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
    /* the reference, and above it, with a bank chosen and Transfer, that bank's account number in fours; Copy puts digits alone
       on the clipboard. The bank's name is the account's own from the rails (PAY), the one a banking app lists. */
    var L=el('div','salt-ledger salt-ledger--plain payref'), said=statusLine(PS.said), ac=acct(PS.acct), num=PS.rail==='transfer'&&ac?numOf(PS.acct):'';
    said.hidden=!PS.said;
    /* away: copying the account number is leaving for their banking app (18 Oct 2026, a customer back from paying did not
       know where to go on): it marks the visit as the payment page's link does, so coming back, or a reload while away,
       turns the sheet to Did you send and the slip */
    function copyBtn(text,labelKey,away){
      var b=el('button','salt-ghost'); b.type='button'; b.setAttribute('aria-label',tw(labelKey)); b.appendChild(glyph('copy',18));
      b.addEventListener('click',async function(){
        if(away&&PS&&payAmt()) payAway(payAmt());
        var t; try{ await navigator.clipboard.writeText(text); t=tw('pay.copied'); }catch(e){ t=tw('pay.copyFail'); }
        if(!PS) return; PS.said=t; said.textContent=t; said.hidden=false;
      });
      return b;
    }
    if(num){
      var nr=lrow(tw('pay.acctNo'),groupFours(num),ac.bank||ac.name); nr.id='payAcctNo';
      var nv=nr.querySelector('.salt-ledger__value'); nv.className+=' acctno'; nv.appendChild(copyBtn(num,'pay.acctCopy',true)); L.appendChild(nr);
    }
    var rr=lrow(tw('pay.ref'),user,tw('pay.refHint')); rr.querySelector('.salt-ledger__value').appendChild(copyBtn(user,'pay.refCopy'));
    L.appendChild(rr); if(!cash){ body.appendChild(L); body.appendChild(said); }
    drawPayFoot();
    if(held){
      var again=[].filter.call(body.querySelectorAll('input[type=radio]'),function(x){ return x.name+'|'+x.value===held&&!x.disabled; })[0];
      try{ if(again) again.focus({preventScroll:true}); }catch(e){}
    }
  }
  /* they have paid, or have been to the pay page and are back: the one question, with the figure, the way and the bank as they stand */
  function payAway(a){ PS.away={amt:a, rail:PS.rail, acct:PS.acct, gone:false}; payqPut(); }
  function payAsk(a){ payAway(a); PS.step='check'; PS.said=''; drawPay(); }
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
    /* PHASE 7B: THE PILL LIGHTS AS SOON AS A BANK IS CHOSEN. With its number on the sheet, I have paid goes straight to the question
       and Open the payment page stays a ghost link; with none, and on Scan a code, the filled pill is the link as before and I am
       back, a ghost, moves to the question without waiting on the page losing and regaining focus. */
    var num=href&&PS.rail==='transfer'?numOf(PS.acct):'';
    foot.appendChild(el('p','paycap',num?tw('pay.capNum'):href?tw(qr?'pay.opensCode':'pay.opensAcct')
      :!a?tw('pay.sayHowMuch',{rm:rm(PS.ctx.fig)}):tw(!PS.rail?'pay.chooseHow':'pay.chooseAcct')));
    var go;
    if(num){
      var op=el('a','salt-ghost',tw('pay.openPage')); op.id='payOpen'; op.href=href; op.target='_blank'; op.rel='noopener';
      op.addEventListener('click',function(){ payAway(a); });
      foot.appendChild(op);
      go=el('button','salt-pill salt-pill--md',tw('pay.iPaid')); go.type='button';
      go.addEventListener('click',function(){ payAsk(a); });
    } else if(href){
      var bk=el('button','salt-ghost',tw('pay.back')); bk.type='button'; bk.id='payReturn';
      bk.addEventListener('click',function(){ payAsk(a); });
      foot.appendChild(bk);
      go=el('a','salt-pill salt-pill--md',word); go.href=href; go.target='_blank'; go.rel='noopener';
      go.addEventListener('click',function(){ payAway(a); });
    }
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
    PS={ctx:ctx, part:false, amt:'', rail:w.rail, acct:w.acct, said:'', step:'check', away:{amt:w.amt, rail:w.rail, acct:w.acct, gone:false}, busy:false,
      from:null, back:q.kind==='order'?'pay:'+q.id:'pay:now'};
    bkOpen('pay',closePay);
    payScr.hidden=false; paySh.hidden=false; behind(); drawPay();
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
    /* F13: a slip, where his key is filed */
    slipKeyLoad();
    if(SLIPKEY) body.appendChild(slipBlock());
    var again=el('a','salt-ghost payagain',tw(qr?'pay.againCode':'pay.againAcct'));
    again.href=payHref(w.acct,w.rail,w.amt,user); again.target='_blank'; again.rel='noopener';
    again.addEventListener('click',function(){ if(PS&&PS.away) PS.away.gone=false; });
    body.appendChild(again);
    var no=el('button','salt-ghost',tw('pay.notYet')); no.type='button';
    no.addEventListener('click',function(){ PS.step='pay'; PS.away=null; PS.said=''; payqDrop(); drawPay(); });
    var yes=el('button','salt-pill salt-pill--md',tw('pay.yes',{rm:rm(w.amt)})); yes.type='button'; yes.id='paySent'; yes.disabled=!!(PS.busy||PS.slipBusy);
    yes.addEventListener('click',claimSend);
    foot.appendChild(no); foot.appendChild(yes);
    if(PS.said){ var l=statusLine(PS.said); l.className+=' paysaid'; foot.appendChild(l); }
  }
  /* the claim: on the order, or on the account for To pay now (rows he entered on the desk as well). The id stays with
     the figure, the way and the account it was minted for, so a retry is recorded once. Its answer is beside Yes. */
  async function claimSend(){
    if(!PS||PS.busy) return;
    var ps=PS, c=ps.ctx, w=ps.away, fig=w.amt.toFixed(2), key=(c.kind==='order'?c.id:'account')+':claim', mine=ticket;
    var sl=ps.slip&&ps.slip.sealed, body={amount:+fig, method:w.rail, account:w.acct, rid:ridFor(key,fig+' '+w.rail+' '+w.acct)};
    if(sl) body.slip=sl;   /* F13: sealed on this phone; the site files the ciphertext and the claim names it */
    ps.busy=true; ps.said=''; drawPay();
    var r=await api(c.kind==='order'?'/orders/'+encodeURIComponent(c.id)+'/pay':'/account/claim', body);
    if(mine!==ticket||PS!==ps) return;
    ps.busy=false;
    if(!(r.body&&r.body.ok)){ ps.said=wErr(r.body,'pay.notRecorded'); drawPay(); return; }
    ridDone(key); closePay();
    if(c.kind==='order'){ var o=oFind(c.id); if(o) tapSaid(o,'pay',tw(sl?'pay.claimedSlip':'pay.claimed')); }
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
    /* V5 (his answer of 29 Sep 2026): a locked account still sees Home, greyed out; only To pay now is live */
    var parts={hNeeds:homeNeeds(), hRate:homeRate(), hThread:homeThread(), hSupply:homeSupply(), hStart:homeStart(), hPool:homePool(), hComing:homeComing(), hAgain:homeAgain(),
      hReward:homeReward(), hYear:homeYear(), hLive:homeLive()};
    Object.keys(parts).forEach(function(id){ var was=document.getElementById(id), n=parts[id]; n.id=id; grey(n,locked); if(was.outerHTML!==n.outerHTML) was.replaceWith(n); });
    thDraw();
    wayDraw();
    bsPatch();
    drawPayHead();
    placeCounts();
    placeTitle();
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
    if(ordersFailed) box.appendChild(unreadNode('ord.unread',retryOrders));
    if(!list.length) return box;
    box.appendChild(hHead(tw('x.needs'),list.length));
    list.forEach(function(o){
      var m=(o.msgs||[]).filter(function(x){ return x.by==='desk'; }).pop(), t=m?String(m.text||''):'';
      box.appendChild(homeRow(o,replyWaiting(o)?tw('hn.reply',{t:t.length>120?t.slice(0,117)+'...':t})
        :withYouOwing(o)?tw('hn.owing',{rm:rm(oToPay(o))}):tw('hn.ready',{d:Dd(oDay,firstAt(o,'ready'))})));
    });
    return box;
  }
  /* F10: an order to rate, from two days after its last handover for two weeks, each with its stars under it */
  function homeRate(){
    var box=el('div'), list=orders.filter(rateHome);
    if(!list.length) return box;
    box.appendChild(hHead(tw('rt.ask'),list.length>1?list.length:0));
    list.forEach(function(o){
      box.appendChild(homeRow(o,tw('rt.row',{d:ymdDay(o.movedOn)})));
      box.appendChild(rateStrip(o));
      var tp=oTap(o); if(tp.k==='rate'&&tp.t) box.appendChild(statusLine(tp.t));
    });
    return box;
  }
  /* A GROUP ORDER (the pool): one row each, between Needs you and Coming up. Its mark and size, how many units are in of its target,
     and the day it closes; Join is its one action while it is open, they are not in and their list sells the size; a row they are
     in opens their order. A pool he has closed reads Closed, their order acknowledged next. Nothing wakes a phone to say one is open. */
  function homePool(){
    var box=el('div'); if(!session||view||!pools.length) return box;
    box.appendChild(hHead(tw('hp.h'),pools.length>1?pools.length:0));
    pools.forEach(function(p){
      var inn=!!p.joined, shut=p.state!=='open', sold1=oSoldHas(p.product,p.q);
      var r=el(inn?'button':'div','salt-inbox-row hpool'); if(inn) r.type='button';
      r.setAttribute('data-pool',p.id);
      r.appendChild(mtile(p.product,p.q,unitFor(p.product)));
      var main=el('span','salt-inbox-row__main');
      main.appendChild(el('span','salt-inbox-row__what',shut?tw('hp.closed'):inn?tw('hp.joined',{q:unitsOf(p.q,unitFor(p.product))}):tw('hp.in',{n:p.unitsIn,t:unitsOf(p.target,unitFor(p.product))})));
      if(inn&&!shut) main.appendChild(el('span','salt-inbox-row__what',tw('hp.in',{n:p.unitsIn,t:unitsOf(p.target,unitFor(p.product))})));
      if(p.closesOn&&!shut) main.appendChild(el('span','salt-inbox-row__what',tw('hp.closes',{d:Dd(ymdDay,p.closesOn)})));
      r.appendChild(main);
      if(inn) r.addEventListener('click',function(){ if(oFind(p.joined)) oOpen(p.joined); else placeShow('order'); });
      else if(!shut&&sold1){
        var side=el('span','salt-inbox-row__side'), j=el('button','salt-pill salt-pill--md',tw('hp.join')); j.type='button'; j.setAttribute('data-pool-join',p.id);
        j.addEventListener('click',function(){ poolOpen(p,j); });
        side.appendChild(j); r.appendChild(side);
      }
      box.appendChild(r);
    });
    return box;
  }
  function homeComing(){
    /* V2: an order at Ready still owing is a line of To pay now, so it leaves Coming up */
    var box=el('div'), list=orders.filter(function(o){ return OPEN_ST.indexOf(o.status)>=0&&!movedAll(o)&&!replyWaiting(o)&&!toCollect(o)&&!readyDue(o); }), more=comingParts();
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
    /* the part as a card: its mark a button and its caption under it, its due day beside (his notes of 28 Sep and 11 Oct 2026) */
    b.appendChild(mtile(p.product,p.qty,unitFor(p.product)));
    var main=el('span','salt-inbox-row__main');
    main.appendChild(el('span','salt-inbox-row__what',tw(p.resale?'hc.dueOnReceiptF':'hc.dueOnReceipt')));
    coverTo(main,p);
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
      if(!oAgainOk(o)) return;
      var way=o.mode==='deliver'?'deliver':'collect', where=way==='deliver'?String(o.place||''):'', k=[o.product,o.qty,way,where,!!o.forFriend].join('|');
      if(seen[k]) return; seen[k]=1;
      out.push({product:o.product, q:o.qty, mode:way, place:where, forFriend:!!o.forFriend, id:o.id});
    });
    return out;
  }
  function againOpen(a,tile){
    draft.mode=a.mode; draft.place=a.place; draft.placeWas=a.place; draft.say=''; draft.noteOpen=false;
    /* nothing of an earlier sheet rides into this one: its day, its window, its sheet id */
    draft.when='soon'; draft.wantBy=''; draft.slot=''; draft.sheetKeep='';
    if(assoc) draft.forFriend=a.forFriend;
    sheetOpen(a.product,a.q,tile,null,null,a);
    if(osh&&draft.step==='form'&&!formWhy()) reviewSheet();
  }
  /* COUNTER BATCH B (his answers of 18 Oct 2026): A NEW ORDER FROM HOME BY HOW IT REACHES THEM. Two tiles, I will collect and Deliver to me,
     each opening the sheet with that way chosen (at the limit, the limit step, as every sheet does). Nothing is drawn where nothing can be
     ordered from here: his read-only view, the overdue gate, a list with nothing priced */
  function homeStart(){
    var box=el('div'); if(!bundle||view||hold||!sold().length) return box;
    box.appendChild(hHead(tw('sh.new')));
    var g=el('div','salt-options__grid salt-options__grid--2'), w=wayNow();
    [['collect','sh.collect','hs.coll'],['deliver','sh.deliver',w&&w.place.trim()?'hs.delivLast':'hs.delivNew']].forEach(function(x){
      var b=el('button','salt-option__face salt-option__face--tap hstart'), t=el('span','salt-option__text'); b.type='button'; b.setAttribute('data-start',x[0]);
      t.appendChild(el('span','salt-option__label',tw(x[1]))); t.appendChild(el('span','salt-option__detail',tw(x[2]))); b.appendChild(t);
      b.addEventListener('click',function(){ draft.mode=x[0]; sheetOpen(null,null,b); });
      g.appendChild(b);
    });
    box.appendChild(g); return box;
  }
  /* 22 OCT 2026 (his word, the restock light made plain): AVAILABILITY, one row a book on their list, its mark in the light's border and
     the light in words (Available, Limited, Out of stock), More by DD Mon under a yellow or red with his day; no figure. A row opens Prices at
     that book. Sealed with the list, so it is as fresh as the last publish, and nothing here refuses an order. */
  function homeSupply(){
    var box=el('div'), list=sold().filter(supLit); if(!bundle||!list.length) return box;
    box.appendChild(hHead(tw('av.h')));
    list.forEach(function(p){
      var s=supLit(p), b=el('button','salt-inbox-row hsup'); b.type='button';
      var m=el('span','pmark sup sup-'+s.light); m.appendChild(psym(p.product,28)); m.appendChild(el('span','sr',pshape(p.product))); b.appendChild(m);
      var main=el('span','salt-inbox-row__main'); main.appendChild(supWord(s.light));
      if(s.light!=='green'&&dmShort(s.by,'en')) main.appendChild(el('span','salt-inbox-row__what',tw('sup.by',{d:Dd(dmShort,s.by)})));
      b.appendChild(main);
      b.addEventListener('click',function(){ placeShow('prices',true); var pn=supPanes[p.product]; if(pn&&pn.scrollIntoView) pn.scrollIntoView({block:'start'}); });
      box.appendChild(b);
    });
    return box;
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
      var P=sold().filter(function(x){ return x.product===a.product; })[0], z={price:priceAt(P,a.q)};
      var b=el('button','salt-option__face salt-option__face--tap htile'), t=el('span','salt-option__text mstack'), l=el('span','salt-option__label mstack');
      /* nothing of the book in an attribute: the tap reads the tile from its own closure (S7R-2 of the stage 7 review) */
      b.type='button';
      /* HIS NOTE OF 28 SEP 2026: the tile is the button, the mark on it and its caption under it, the size in words ("1 unit", no shape
         word drawn, 12 Oct 2026); a reader hears the shape and the size in words, once */
      /* C19 (29 Sep 2026): the size under the mark says its unit, and the price is a figure in the mono face */
      var fq=el('span','mq',unitsOf(a.q,P.unit)); fq.setAttribute('aria-hidden','true');
      l.appendChild(el('span','sr',pshape(a.product)+' '+unitsOf(a.q,P.unit))); l.appendChild(psym(a.product,28)); l.appendChild(fq);
      t.appendChild(l);
      t.appendChild(el('span','salt-option__detail'+(a.start?' mono':''),a.start?rm(z.price):tw('ha.'+(a.mode==='deliver'?'deliv':'coll')+(a.forFriend?'F':''),{rm:rm(z.price), p:a.place})));
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
  /* COUNTER BATCH A (his decisions of 18 Oct 2026): THEIR LATEST OPEN ORDER, its state, the moment it last moved, and while it waits at one
     of his points the point and its pin. Under 1080px a pill that sticks above the App bar and above the pay foot, which sets --hfoot to
     its own height (drawPayHead); from 1080px a banner under To pay now. A tap opens the order; the pin is its own link beside it. */
  function lastMoved(o){ var h=o.history||[]; return h.length&&h[h.length-1].at?h[h.length-1].at:o.at; }
  function homeLive(){
    var box=el('div'); if(!session||view||!orders.length) return box;
    var o=orders.filter(function(x){ return !oClosed(x); }).sort(function(a,b){ return String(b.at).localeCompare(String(a.at)); })[0];
    if(!o) return box;
    box.className='hlive salt-glass-card salt-glass-card--radius-lg'; box.setAttribute('data-live',o.id);
    var go=el('button','hlive__go'); go.type='button';
    go.appendChild(el('span','salt-eyebrow salt-eyebrow--copper hlive__h',tw('hl.h')));
    var row=el('span','hlive__row');
    row.appendChild(stateChip(o,'hlive__state'));
    row.appendChild(el('span','hlive__when mono',stepWhen(lastMoved(o))));
    var waits=o.point&&o.status==='ready'&&o.mode==='collect'&&!movedAll(o);
    if(waits) row.appendChild(el('span','hlive__point',tw('pt.at',{c:o.point})));
    go.appendChild(row);
    go.addEventListener('click',function(){ oOpen(o.id); });
    box.appendChild(go);
    if(waits&&o.pointAt&&isFinite(o.pointAt.lat)&&isFinite(o.pointAt.lng)) box.appendChild(pinLink(o));
    return box;
  }
  /* THE NEAREST REWARD, an associate's alone, across the books that carry one: its mark, the meter to the next unit and what is theirs to
     take, in the card's own words. Never a level; never the units to go, which is a margin figure the card does not carry. A tap is Rewards. */
  function homeReward(){
    var box=el('div'); if(view||!card||!Array.isArray(card.products)) return box;
    /* 21 Oct 2026: a customer's card carries the share of their next loyalty unit, and nothing else; it opens nothing */
    if(!assoc){
      var lp=card.products.filter(function(p){ return p.loyal&&typeof p.loyal.next==='number'; })[0];
      if(!lp) return box;
      var lpc=Math.max(0,Math.min(100,Math.round(lp.loyal.next*100)));
      box.appendChild(hHead(tw('hr.hLoyal')));
      var lc=el('div','hreward hloyal salt-glass-card salt-glass-card--radius-lg salt-glass-card--pad-sm');
      var lt=el('span','hreward__top'); lt.appendChild(el('span','sr',pshape(lp.product))); lt.appendChild(psym(lp.product,28));
      lt.appendChild(el('span','hreward__left',tw('rew.nextAria',{p:lpc}))); lc.appendChild(lt);
      var lm=el('span','salt-meter rmeter'), ll=el('span','salt-meter__line');
      ll.appendChild(el('span',null,tw('rew.next'))); ll.appendChild(el('b',null,lpc+'%'));
      var lr=el('span','salt-meter__track'); lr.appendChild(el('span','salt-meter__fill'));
      lm.style.setProperty('--salt-fill',String(lpc)); lm.appendChild(ll); lm.appendChild(lr); lc.appendChild(lm);
      box.appendChild(lc);
      return box;
    }
    var list=card.products.filter(function(p){ return p.reward&&p.reward.next!=null; }).sort(function(a,b){ return b.reward.next-a.reward.next; }), p=list[0];
    if(!p) return box;
    var rw=p.reward, pc=Math.round(rw.next*100);
    box.appendChild(hHead(tw('hr.h')));
    var b=el('button','hreward salt-glass-card salt-glass-card--radius-lg salt-glass-card--pad-sm salt-glass-card--link'); b.type='button';
    var top=el('span','hreward__top'), sr=el('span','sr',pshape(p.product)); top.appendChild(sr); top.appendChild(psym(p.product,28));
    top.appendChild(el('span','hreward__left',tw(rw.left>0?(rw.held?'rew.held':'rew.ask'):'rew.nextAria',{left:Uq(rw.left,p.unit), p:pc})));
    b.appendChild(top);
    var mtr=el('span','salt-meter rmeter'), ln=el('span','salt-meter__line');
    ln.appendChild(el('span',null,tw('rew.next'))); ln.appendChild(el('b',null,pc+'%'));
    var tr=el('span','salt-meter__track'); tr.appendChild(el('span','salt-meter__fill'));
    mtr.style.setProperty('--salt-fill',String(pc)); mtr.appendChild(ln); mtr.appendChild(tr);
    b.appendChild(mtr);
    b.appendChild(el('span','hreward__see',tw('hr.see')));
    b.addEventListener('click',function(){ placeShow('card',true); });
    box.appendChild(b);
    return box;
  }
  /* THIS YEAR, off the live statement's own lines: the orders this year in Kuala Lumpur and the units of each mark, a cancelled line not
     counted (as the statement's foot counts), and a bar for each month from January to this one. The book's marks are told apart by their
     drawing, and two books' units are never summed. */
  function yearMark(svg){
    var d=svg&&svg.querySelector('path'), t=svg&&svg.querySelector('text'), key=(d?d.getAttribute('d'):'')+'|'+(t?t.textContent:''), hit='_';
    Object.keys(PSYM).forEach(function(k){ if(k==='_'||hit!=='_') return; var s=psym(k,24), sd=s.querySelector('path'), st=s.querySelector('text');
      if((sd?sd.getAttribute('d'):'')+'|'+(st?st.textContent:'')===key) hit=k; });
    return hit;
  }
  function yearRows(){
    var lv=bundle&&bundle.statements.filter(function(s){ return s.live&&!s.bad&&s.body; })[0]; if(!lv) return null;
    var tp=document.createElement('template'); tp.innerHTML=lv.body;
    var y=String(klBits(new Date().toISOString()).year), out=[];
    [].forEach.call(tp.content.querySelectorAll('.salt-lines__row[data-m]'),function(r){
      var m=r.getAttribute('data-m')||'', mq=r.querySelector('.salt-lines__what .mtile .mq');
      if(m.slice(0,4)!==y||!mq||r.classList.contains('salt-lines__row--cancelled')) return;
      out.push({m:m, p:yearMark(r.querySelector('.salt-lines__what .mtile svg')), q:parseFloat(String(mq.textContent).replace(/,/g,''))||0});
    });
    return out;
  }
  function homeYear(){
    var box=el('div'); if(!bundle||view) return box;
    var rows=yearRows(); if(!rows||!rows.length) return box;
    box.appendChild(hHead(tw('hy.h')));
    var c=el('div','hyear salt-glass-card salt-glass-card--radius-lg salt-glass-card--pad-sm'), top=el('div','hyear__top');
    top.appendChild(el('span','hyear__n',tw(rows.length===1?'hy.order1':'hy.orderN',{n:rows.length})));
    var by={}, ps=[]; rows.forEach(function(r){ if(!(r.p in by)){ by[r.p]=0; ps.push(r.p); } by[r.p]+=r.q; });
    var ts=el('span','hyear__units'); ps.forEach(function(p){ ts.appendChild(mtile(p,+by[p].toFixed(2),'unit',24)); }); top.appendChild(ts);
    c.appendChild(top);
    var now=+klBits(new Date().toISOString()).month, y=String(klBits(new Date().toISOString()).year), n=[], max=0, said=[], ms=mon3();
    for(var i=1;i<=now;i++){ var k=y+'-'+('0'+i).slice(-2), v=rows.filter(function(r){ return r.m===k; }).length; n.push(v); if(v>max) max=v; said.push(ms[i-1]+' '+v); }
    var bars=el('div','hyear__bars'); bars.setAttribute('role','img'); bars.setAttribute('aria-label',tw('hy.bars',{list:said.join(', ')}));
    n.forEach(function(v,i){ var col=el('span','hyear__col'), bar=el('span','hyear__bar'); bar.style.setProperty('--h',String(max?Math.round(v/max*100):0));
      bar.setAttribute('data-n',String(v)); col.appendChild(bar); col.appendChild(el('span','hyear__mon',ms[i].charAt(0))); bars.appendChild(col); });
    c.appendChild(bars);
    box.appendChild(c);
    return box;
  }
  /* a count beside a place is what waits there: the orders that need them. data-n: data-count is the owner's own */
  function placeCounts(){
    var n=orders.filter(oNeeds).length;
    [].forEach.call(tabs.querySelectorAll('[data-n]'),function(c){ c.textContent=c.getAttribute('data-n')==='order'&&n?String(n):''; });
    cBar();
  }
  /* 21 OCT 2026, HIS WORD: THE BAR SAYS WHAT WAITS ON THEM, on every place: To pay now and its figure, the orders that need them (the
     rail's own count) and their messages when ours is unread; each a chip to where it is. Only what waits is drawn. Written only when it differs. */
  function cBar(){
    var box=document.getElementById('cBarChips'); if(!box||OWNER) return;
    var lines=bundle?nowOf():[], tot=invTotal(lines), n=orders.filter(oNeeds).length, th=thWaiting(), parts=[];
    if(tot>0.004) parts.push(['pay','now',tw('pay.now'),rm(tot)]);
    if(n) parts.push(['order','wait',tw('place.order'),String(n)]);
    if(th) parts.push(['thread','wait',tw('th.title'),'']);
    var key=JSON.stringify(parts); if(box.getAttribute('data-k')===key) return;
    box.setAttribute('data-k',key); box.textContent='';
    parts.forEach(function(x){
      var b=el('button','salt-deskbar__chip salt-deskbar__chip--'+x[1]); b.type='button'; b.setAttribute('data-act','bar.'+x[0]); b.setAttribute('data-go',x[0]);
      b.appendChild(document.createTextNode(x[2])); if(x[3]){ b.appendChild(document.createTextNode(' ')); b.appendChild(el('span','salt-deskbar__n',x[3])); }
      b.addEventListener('click',function(){ if(x[0]==='thread') thOpen(b); else placeShow(x[0]==='pay'?'home':'order',true); });
      box.appendChild(b);
    });
  }
  async function loadOrders(){
    if(!session) return;
    var mine=ticket;
    var r=await api('/orders');
    if(mine!==ticket) return;
    if(r.status===401) return;   /* api() has said so in the bar */
    /* C14: a read that failed keeps the list as it last stood and says so; it is never an empty list */
    if(r.body.ok){ orders=r.body.orders||[]; claims=Array.isArray(r.body.claims)?r.body.claims:[]; ordersFailed=false; readAt=Date.now(); if('thread' in r.body&&!thTimer) thPut(r.body.thread); }
    else ordersFailed=true;
    /* a group order is read with the orders; a read that fails keeps the list as it stood, and says nothing: the card is an extra */
    var pr=await api('/pools');
    if(mine!==ticket) return;
    if(pr.body&&pr.body.ok&&Array.isArray(pr.body.pools)) pools=pr.body.pools;
  }
  /* S5 5.5 (24 Sep 2026): A RE-READ PATCHES WHAT CHANGED AND NOTHING ELSE. It drew the whole tab again, the order
     form and every order with it, so a poll bringing any change to any order took the box being typed in and the
     caret with it (v827 put the words back; the element was still new). Now the orders are compared one by one,
     and only the rows and the parts of the open order that changed are drawn again. A return to the page and a lapse
     reopened (S3 3.5) come this way too; only an account that now draws the form above differently draws the tab. */
  async function oReread(){
    var before={}, mine=ticket, was=JSON.stringify([claims,orders.map(oClaimed)]), thWas=JSON.stringify(thread), failedWas=ordersFailed, poolsWas=JSON.stringify(pools); orders.forEach(function(o){ before[o.id]=JSON.stringify(o); });
    await loadOrders();
    if(mine!==ticket) return;
    if(JSON.stringify(pools)!==poolsWas) drawHome();   /* a group order filled, joined or closed: Home says so on the poll */
    /* C14: the line and its Try again come and go with the list, and what the read brought may lift or set the hold */
    if(ordersFailed!==failedWas){ setHold(); drawOrder(); if(osh&&draft.step==='limit') sheetDraw(); return; }
    /* V5: a stage reached on the phone's clock (a page left open across midnight in Kuala Lumpur) reads as a change too */
    if(JSON.stringify([claims,orders.map(oClaimed)])!==was||formSig()!==drawnSig){ setHold(); drawPayHead(); }
    if(document.getElementById('oArea')&&formSig()!==drawnSig){ drawOrder(); return; }
    var changed=orders.filter(function(o){ return before[o.id]!==JSON.stringify(o); }).map(function(o){ return o.id; }),
        gone=Object.keys(before).some(function(id){ return !oFind(id); });
    if(draft.oStale&&changed.indexOf(draft.oStale)<0) changed.push(draft.oStale);
    if(changed.length||gone){ oSync(changed); drawHome(); if(osh&&draft.step==='limit') sheetDraw(); }
    else if(JSON.stringify(thread)!==thWas) thAfter();   /* Step 7: a line on the thread, with no order moved */
  }
  async function loadCounterHours(){
    if(!session) return;
    var before=JSON.stringify([counterHours,hoursError]);
    try{
      var response=await fetch('/hours',{cache:'no-store',redirect:'manual'});
      if(response.type==='opaqueredirect'||!response.ok) throw new Error(tw('hours.unavailable'));
      var result=await response.json();
      if(!result||typeof result.open!=='boolean') throw new Error(tw('hours.unavailable'));
      counterHours=result; hoursError=false;
    }catch(error){ hoursError=true; }
    if(before!==JSON.stringify([counterHours,hoursError])) todayDraw();
    if(before!==JSON.stringify([counterHours,hoursError])&&tab==='order'&&!view) drawOrder();
    /* 10 Oct 2026: a sheet opened before the hours arrived offers the windows they leave, now they are here */
    if(before!==JSON.stringify([counterHours,hoursError])&&osh&&draft.step==='form') sheetDraw();
  }
  async function refresh(){
    if(document.hidden) return;   /* a hidden page reads nothing, the bulletin included; its return re-reads (reread) */
    await oReread(); await loadCounterHours();
    await stampRead();   /* R1: a statement or price list published since the page opened */
    if(++bullN%6===0) await bullRead();   /* the bulletin, once a minute on an open page */
  }
  /* ---- R1 (his plan of 19 Oct 2026): AN OPEN PAGE FOLLOWS A PUBLISH. The poll reads GET /account/stamp, which answers only the moments
     and the verdict that tell the account moved (no figure, no ciphertext, no name). When that differs from the stamp the page opened
     with, and only when the page is idle, it re-opens the sealed documents as a return does (reread), keeping the place and the scroll.
     A Sheet open, a field focused or a line half typed holds it: stampWas stays, so the next poll asks again. The unchanged stamp
     reads nothing more. The stamp a body gives is the one the Worker's route gives, so the two are compared like for like. */
  var stampWas='', stampBusy=false;
  function stampOf(o){
    o=o||{};
    return JSON.stringify([o.liveStatus||'', o.live&&o.live.at||'', o.live&&o.live.buildId||'', o.prices&&o.prices.at||'', o.prices&&o.prices.digest||'',
      o.card&&o.card.at||'', o.issued||'']);
  }
  function idleNow(){
    if([].some.call(document.querySelectorAll('[role=dialog][aria-modal=true]'),function(d){ return !d.hidden; })) return false;
    var f=document.activeElement;
    /* a field the door left focused when it was hidden holds nothing: a browser blurs it, and jsdom does not */
    if(f&&(/^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)||f.isContentEditable)&&!f.closest('[hidden]')) return false;
    return ![].some.call(document.querySelectorAll('textarea,input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit])'),
      function(x){ return !!x.value&&!x.closest('[hidden]'); });
  }
  async function stampRead(){
    if(OWNER||!session||!curCk||!stampWas||rereading||stampBusy) return;
    stampBusy=true;
    try{
      var mine=ticket, r=await api('/account/stamp');
      if(mine!==ticket||!r.body||!r.body.ok) return;
      if(stampOf(r.body)===stampWas||!idleNow()) return;
      await reread();
    }catch(e){ /* the next poll asks again */ }
    finally{ stampBusy=false; }
  }

  /* ---- Step 7 (his Q5 of 28 Sep 2026): THE ACCOUNT'S THREAD. One an account, beside the order threads: Home's card and a
     row on Account open it in a Sheet, so the places stay five. It comes with the orders on the page's poll, and is read
     every THREAD_POLL_MS while the Sheet is open and the page is showing, never while hidden. Their lines go as a line on an
     order goes: Sending, Sent, or Not sent with Tap to try again under the line's own id, and a refusal puts the words
     back in the box; his stand left, New until this device has shown them. Every line is text, never markup. His
     read-only view has no thread: he answers from his Chat. ---- */
  var TH_MS=__THPOLL__, thread={at:null,msgs:[]}, thOut=[], thTimer=null, thFrom=null, thFromId='hThread', thN=0, thWhy='', thSig='';
  var thSheetEl=document.getElementById('thSheet'), thScrim=document.getElementById('thScrim'), thLog=document.getElementById('thLog'),
      thBody=document.getElementById('thBody'), thForm=document.getElementById('thForm'), thIn=document.getElementById('thIn'), thSaid=document.getElementById('thSaid');
  function thPut(t){ thread=t&&Array.isArray(t.msgs)?{at:t.at||null,msgs:t.msgs}:{at:null,msgs:[]}; }
  function thHis(){ var m=thread.msgs.filter(function(x){ return x.by==='desk'; }); return m.length?String(m[m.length-1].at||''):''; }
  /* the seen mark is this account's on this phone: an order's id is its own, but every account has a thread */
  function thKey(){ return 'thread:'+user; }
  function thWaiting(){ var l=thHis(); return !view&&!!session&&!!l&&l>(seenGet().o[thKey()]||''); }
  function thSeen(){ var l=thHis(); if(!l||view) return; var s=seenGet(); if((s.o[thKey()]||'')>=l) return; s.o[thKey()]=l; seenPut(s); }
  function thSame(w){ return thread.msgs.filter(function(m){ return m.by==='customer'&&oWords(m.text)===w; }).length; }
  function thLanded(){ for(var i=thOut.length-1;i>=0;i--) if(thSame(thOut[i].w)>thOut[i].n) thOut.splice(i,1); return thOut; }
  /* the row that opens it, on Home under its heading and on Account: the last line, theirs or ours, and New on a reply */
  function thRow(){
    var b=el('button','salt-inbox-row throw'); b.type='button';
    var main=el('span','salt-inbox-row__main'), l=thread.msgs[thread.msgs.length-1], t=el('span','salt-inbox-row__title',tw('th.row'));
    if(thWaiting()){ t.appendChild(document.createTextNode(' ')); t.appendChild(chipEl('verdigris',tw('msg.new'))); }
    main.appendChild(t);
    var x=l?String(l.text||''):'', cut=x.length>120?x.slice(0,117)+'...':x;
    main.appendChild(el('span','salt-inbox-row__what',!l?tw('th.start'):l.by==='desk'?tw('hn.reply',{t:cut}):tw('th.you',{t:cut})));
    b.appendChild(main);
    if(l){ var side=el('span','salt-inbox-row__side'); side.appendChild(el('span','salt-inbox-row__age',oDay(l.at))); b.appendChild(side); }
    b.addEventListener('click',function(){ thOpen(b); });
    return b;
  }
  function homeThread(){ var box=el('div'); if(!session||view) return box; box.appendChild(hHead(tw('th.h'))); box.appendChild(thRow()); return box; }
  /* Home's card and Account's row alone, as drawHome draws them, for a change to the thread and nothing else */
  function thHome(){ var was=document.getElementById('hThread'); if(was){ var n=homeThread(); n.id='hThread'; grey(n,locked); if(was.outerHTML!==n.outerHTML) was.replaceWith(n); } thDraw(); cBar(); }
  /* COUNTER BATCH A (his decision of 18 Oct 2026): THE GLANCE at the head of Account. To pay now, the same figure Home's tile shows, with when
     it is due and a link to the order it is for; the thread, with a reply waiting said; the statement, up to date as at its moment. Nothing in it
     names a code: the account is theirs by its username alone. Drawn with Home and with To pay now, replaced only when it reads differently. */
  function glanceItem(href,cls,label,value,note,go){
    var a=el(href?'a':'div','salt-glance__item'+(cls?' '+cls:''));
    if(href){ a.href=href; a.addEventListener('click',function(ev){ ev.preventDefault(); go(a); }); }
    a.appendChild(el('span','salt-glance__label',label)); a.appendChild(el('span','salt-glance__value',value));
    if(note) a.appendChild(el('span','salt-glance__note',note));
    return a;
  }
  function acctGlance(){
    var box=el('div'); if(!session||view||!bundle) return box;
    box.className='salt-glance aglance';
    if(!staleNow()&&!liveBad()){
      var L=nowOf(), tot=invTotal(L), due=tot>0.004, first=L.filter(function(x){ return x.o; })[0];
      var it=glanceItem(due&&first?'#o='+encodeURIComponent(first.o.id):'',due?'salt-glance__item--due':'',tw('pay.now'),rm(tot),
        due?invWhen(first||L[0],false):tw('pay.nothing'),function(){ oOpen(first.o.id); });
      it.setAttribute('data-glance','owed'); box.appendChild(it);
    }
    var n=thread.msgs.length, th=glanceItem('#thread','',tw('th.row'),thWaiting()?tw('gl.reply'):n?tw(n===1?'gl.line1':'gl.lineN',{n:n}):tw('gl.noLine'),'',function(a){ thOpen(a); });
    th.setAttribute('data-glance','thread'); box.appendChild(th);
    var bad=liveBad(), lv=bundle.statements.filter(function(s){ return s.live; })[0];
    if(lv||bad){
      var st=glanceItem(bad?'':'#account','',tw('gl.stmt'),tw(bad?'gl.unread':'gl.upToDate'),!bad&&liveAt?tw('gl.asAt',{d:Dd(stamp,liveAt)}):'',
        function(){ var o=document.getElementById('out'); if(o) try{ o.scrollIntoView({block:'start'}); }catch(e){} });
      st.setAttribute('data-glance','stmt'); box.appendChild(st);
    }
    return box;
  }
  function glanceDraw(){ var a=document.getElementById('aGlance'); if(!a) return; var n=acctGlance(); n.id='aGlance'; if(a.outerHTML!==n.outerHTML) a.replaceWith(n); }
  /* Account's row, drawn with Home: replaced only when it reads differently, so a tap is never lost to a redraw */
  function thDraw(){
    glanceDraw();
    var a=document.getElementById('aThread'); if(!a) return;
    var n=el('div'); n.id='aThread'; if(session&&!view) n.appendChild(thRow());
    if(a.outerHTML!==n.outerHTML) a.replaceWith(n);
  }
  function thEnd(){ if(thBody) thBody.scrollTop=thBody.scrollHeight; }
  /* the lines, drawn again only when they read differently; a reader at the foot is kept at the foot */
  function thLines(force){
    if(!thLog) return;
    var out=thLanded(), since=draft.thSince, sig=JSON.stringify([thread.msgs,out.map(function(x){ return [x.t,x.state,x.why]; }),thWhy,since]);
    if(!force&&sig===thSig) return;
    thSig=sig;
    var foot=!thBody||thBody.scrollHeight-thBody.scrollTop-thBody.clientHeight<48;
    thLog.textContent='';
    if(!thread.msgs.length&&!out.length) thLog.appendChild(el('p','salt-bubble__meta thempty',tw('th.empty')));
    thread.msgs.forEach(function(m){
      var his=m.by==='desk';
      thLog.appendChild(bubble(his?'theirs':'mine',m.text||'',tw(his?'msg.reply':'msg.you',{t:Dd(stamp,m.at)}),his?'':'sent',his&&typeof since==='string'&&String(m.at)>since));
    });
    out.forEach(function(x){
      var b=bubble('mine',x.t,tw('msg.you',{t:Dd(stamp,x.at)}),x.state,false);
      if(x.state==='failed'){
        if(x.why){ var y=el('p','salt-bubble__meta',x.why); y.setAttribute('role','status'); b.appendChild(y); }
        var r=el('button','salt-ghost salt-ghost--lit salt-bubble__retry',tw('msg.retry')); r.type='button';
        r.addEventListener('click',function(){ thSend(x); });
        b.appendChild(r);
      }
      thLog.appendChild(b);
    });
    if(thWhy){ var w=el('p','salt-bubble__meta',thWhy); w.setAttribute('role','status'); thLog.appendChild(w); }
    if(force||foot) thEnd();
  }
  function thSay(t){ if(thSaid){ thSaid.textContent=t||''; thSaid.hidden=!t; } }
  function thOpen(from){
    if(!thSheetEl||!session||view) return;
    thFrom=from||null; thFromId=from&&from.closest&&from.closest('#aThread')?'aThread':from&&from.closest&&from.closest('#aGlance')?'aGlance':'hThread'; draft.thSince=seenGet().o[thKey()]||'';
    bkOpen('th',thClose);
    thScrim.hidden=false; thSheetEl.hidden=false; behind();
    try{ thSheetEl.focus(); }catch(e){}
    if(draft.thDraft&&!thIn.value) thIn.value=draft.thDraft;
    thLines(true); thSeen(); thHome();
    if(thTimer) clearInterval(thTimer);
    thTimer=setInterval(thRead,TH_MS);
    thRead();
  }
  function thClose(){
    if(thTimer){ clearInterval(thTimer); thTimer=null; }
    if(!thSheetEl||thSheetEl.hidden) return;
    thSheetEl.hidden=true; thScrim.hidden=true; behind(); bkDrop('th'); thSay('');
    focusBack(thFrom,function(){ return (document.getElementById(thFromId)||document).querySelector('.throw, [data-glance="thread"]'); });
  }
  /* read only while the Sheet is open and the page is showing; a read that a later one overtook is let go */
  async function thRead(){
    if(document.hidden||!session||!thSheetEl||thSheetEl.hidden) return;
    var mine=ticket, n=++thN, r=await api('/thread');
    if(mine!==ticket||n!==thN) return;
    var was=JSON.stringify([thread,thWhy]);
    if(r.body&&r.body.ok){ thPut(r.body.thread); thWhy=''; } else if(r.status!==401) thWhy=tw('th.unread');
    if(JSON.stringify([thread,thWhy])!==was) thAfter();
  }
  function thAfter(){ thLines(); if(thSheetEl&&!thSheetEl.hidden) thSeen(); thHome(); }
  async function thSend(x){
    var mine=ticket; x.state='sending'; x.why=''; thLines(); thEnd();
    thN++;   /* a read already on its way holds the thread from before this line */
    var r=await api('/thread',{text:x.t,rid:x.rid});
    if(mine!==ticket) return;
    if(r.body&&r.body.ok){ thPut(r.body.thread); var i=thOut.indexOf(x); if(i>=0) thOut.splice(i,1); thAfter(); thEnd(); return; }
    var why=r.body&&r.body.lost?tw('x.checkConn'):wErr(r.body,'msg.notSent');
    /* refused, it will be refused again (their twenty today, a lapsed session): the words go back in the box */
    if(r.status&&r.status<500){ var j=thOut.indexOf(x); if(j>=0) thOut.splice(j,1); thIn.value=thIn.value?x.t+' '+thIn.value:x.t; draft.thDraft=thIn.value; thSay(why); thLines(); return; }
    x.state='failed'; x.why=why; thLines();
  }
  if(thSheetEl){
    document.getElementById('thX').addEventListener('click', thClose);
    thScrim.addEventListener('click', thClose);
    document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') thClose(); });
    thIn.addEventListener('input', function(){ draft.thDraft=thIn.value; });
    thForm.addEventListener('submit', function(ev){
      ev.preventDefault();
      var t=String(thIn.value||'').trim(); if(!t) return;
      thSay('');
      var w=oWords(t), x={t:t, w:w, n:thSame(w)+thOut.filter(function(y){ return y.w===w; }).length, at:new Date().toISOString(), state:'sending', rid:mintRid(), why:''};
      thOut.push(x); thIn.value=''; draft.thDraft='';
      thSend(x);
    });
  }
  /* a banner of his line on the thread opens it (#thread), once they are in */
  var wantThread=location.hash==='#thread';
  function thWanted(){
    if(!wantThread||view||!session||!lapse.hidden) return;
    wantThread=false;
    try{ if(location.hash==='#thread') history.replaceState(history.state,'',location.pathname+location.search); }catch(e){}
    if(thSheetEl&&thSheetEl.hidden) thOpen(null); else thRead();
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
    try{ if(location.hash) history.replaceState(history.state,'',location.pathname+location.search); }catch(e){}
    if(!oFind(id)) return;
    oOpen(id);
  }
  try{
    if(!OWNER&&'serviceWorker' in navigator&&navigator.serviceWorker.addEventListener)
      navigator.serviceWorker.addEventListener('message', async function(ev){
        var d=ev&&ev.data;
        if(!d||d.salt!=='news') return;
        wantOrder=orderIn('#o='+(d.order||''));
        if(d.thread===true) wantThread=true;   /* Step 7: his line on the thread opens the thread */
        if(!session) return;   /* at the door: it opens once they are in */
        var mine=ticket;
        await oReread();
        if(mine!==ticket) return;
        openWanted();
        thWanted();
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
    }catch(e){ if(stale())return; done(); say(tw('door.offline'),'bad'); return; }
    /* C16: an answer that came back is not No connection, whatever its body */
    try{ body=await r.json(); }catch(e){ body=null; }
    /* a body that will not read is the site busy on a 5xx or a 2xx; any other status keeps the door's own words */
    body=busyOr(r.status,body)||(r.status>=500||r.ok?{ok:false, said:'x.busy'}:{ok:false});
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
    /* used, so it goes: a phone that lapses later opens the signed-out Sheet with the username, never the password */
    pw.value=''; showPw(false);
    enter(u, body, b, x, ck, !!(outSheet&&!outSheet.hidden));
    if(!(await follow(stale))) return;
    if(keep) await remember(u, ck);
    await pkAttach(u, ck);   /* Step 6: the password once, after Open with a passkey found nothing on this device */
    askPush();
  });

  /* ---- ON THE WAY IN, NOTHING IS ASKED (S4, 24 SEP 2026; v693 asked here) ----------------------
     Asked on the way in, a phone that answered never saw the question again, and a remembered phone was asked on load
     with nothing tapped. Step 1b: the ask is the bell's, from a tap, on every view of the saved app until notifications
     are on. What stays here is the phone already on, filed again below. The owner's route never asks: those are not
     his phones. */
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
    if(keep){ if(!poll) poll=setInterval(refresh, POLL_MS); liveStart(); return true; }
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
    stampWas=stampOf(body);   /* R1: what this open was made from, which the poll's stamp is compared with */
    /* C15 (29 Sep 2026): THE ACCOUNT IS THE LIVE DOCUMENT OR NOTHING. A live document that would not open was swallowed,
       and Account drew the sealed 01 Sep issue as the account, old balance and all, while the overdue lead and the hold
       went quiet. Now it is a place held for it (bad), drawn as could-not-be-read with Try again, and show() keeps the
       pay gate on its last known state. An account with issues and no live document at all is read the same way; one
       with neither is a new account, which pickStmt says so. */
    var l=null;
    if(body.live&&(body.liveStatus==='current'||body.liveStatus==='fixture')){
      try{
        l=JSON.parse(await open(ck, body.live));
        if(body.liveStatus==='current'&&(!body.live.buildId||l.buildId!==body.live.buildId)) l=null;
      }catch(e){ l=null; }
    }
    if(l) b.statements.unshift({issued:'now', label:tw('acct.now'), live:true, at:l.at||body.live.at, body:l.body, owed:l.owed, pay:l.pay||null});
    /* A current live document needs both the Worker's revision check and its matching sealed stamp.
       Test fixtures are separate from real accounts and keep their own invented document. */
    else if(body.liveStatus==='updating') b.statements.unshift({issued:'now', label:tw('acct.now'), live:true, bad:'acct.updating'});
    else if(body.liveStatus==='unavailable') b.statements.unshift({issued:'now', label:tw('acct.now'), live:true, bad:'acct.unavailable'});
    else if(body.live||b.statements.length) b.statements.unshift({issued:'now', label:tw('acct.now'), live:true, bad:body.live?'acct.unread':'acct.later'});
    /* C13 (his yes of 29 Sep 2026, option a): the sealed issues are off the Counter; they stay on disk. 14 Oct 2026 (his review):
       off his View as them too, so no page draws an earlier statement. 15 Oct 2026: the publish no longer seals one into a record,
       so this only cuts a record not yet republished */
    b.statements=b.statements.slice(0,1).filter(function(s){ return s.live; });
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
    if(!same){ liveStop(); orders=[]; pools=[]; claims=[]; draft={}; closePay(true); payDue=null; liveAt=''; ordersFailed=false; readAt=0; thClose(); thPut(null); thOut=[]; thSig=''; thWhy=''; }
    view=!!(OWNER&&body.byMaster);
    if(linkBox) linkBox.hidden=true;
    if(opening) opening.hidden=true;
    lapse.hidden=true; closeSignedOut(true);
    show(b);
    drawPrices();
    drawKeep();
    drawDev();
    /* HOME OPENS FIRST (S7 7.1), over the line too, where it leads with what to pay; an address naming a place opens
       that place once. The same account let in again stays where it was, the order sheet open over it included,
       unless that place has gone (Rewards, for an account no longer an associate) */
    if(!same){ var w=wantPlace; wantPlace=''; placeShow(w||'home'); }
    else if(placeBtns(t)[0].hidden) placeShow(t);
    lookAsk(b);   /* 11 Oct 2026: a device that has chosen no look is asked, once a visit */
    if(same){
      if(mf&&mfil.querySelector('button[data-mf="'+mf+'"]')){ mfPick=mf; applyMonths(); }
      window.scrollTo(0,sy);
      if(draft.sheetBack){ draft.sheetBack=false; sheetOpen(); }
    }
  }
  async function follow(stale){
    if(session){ await loadOrders(); await loadCounterHours(); if(stale()) return false; if(poll)clearInterval(poll); poll=setInterval(refresh, POLL_MS); liveStart(); if(TESTS.indexOf(user)>=0) bullRead(); }
    else if(view){ await loadView(user); if(stale()) return false; }   /* stmt/owner.js: his route alone carries it */
    setHold(); drawOrder(); drawPayHead();   /* S6 6.5 and 6.7: the claims come with the orders, and may lift the hold */
    payNumLoad();   /* Phase 7b: the numbers the pay sheet shows, ready before it opens; asked on a session alone */
    if(session) payqBack();   /* S6 fix: a question the last open left unanswered */
    return true;
  }

  /* ---- SPEED WAVE 2 L2 (21 Oct 2026): THE LIVE SOCKET. An open page holds one WebSocket to the order book, which tells it WHAT KIND of thing
     moved (an order, a claim, a pool, the thread) and its id, never a figure or a word; the page reads what it always read. The customer's
     proof is the handshake itself: the subprotocols are "stmt" and the session, so no token sits in an address or a message. While the socket
     is up the polls fall to a minute and stay as the net; on its loss they return to ten seconds and two, and the socket reconnects after 1, 2,
     4 ... 30 seconds. Three attempts in a row that never reach hello stop until the page is shown again. A ping every 45 seconds must be
     answered within 5 or the socket is let go and made again. The owner's page opens its own through the same function. ---- */
  var LIVE_ON=__LIVE__, LIVE_NET_MS=60000, LIVE_PING_MS=45000, LIVE_PONG_MS=5000;
  function liveSocket(cfg){
    var ws=null, hello=false, fails=0, wait=1000, retryT=null, pingT=null, pongT=null, shut=false;
    function addr(){ return (location.protocol==='https:'?'wss://':'ws://')+location.host+cfg.path; }
    function stopBeat(){ if(pingT){ clearInterval(pingT); pingT=null; } if(pongT){ clearTimeout(pongT); pongT=null; } }
    function beat(){
      stopBeat();
      pingT=setInterval(probe,LIVE_PING_MS);
    }
    function probe(){
      var s=ws; if(!s||s.readyState!==1) return;
      try{ s.send('ping'); }catch(e){ return; }
      if(pongT) clearTimeout(pongT);
      pongT=setTimeout(function(){ pongT=null; try{ s.close(); }catch(e){} lost(s); },LIVE_PONG_MS);
    }
    function lost(s){
      if(ws!==s) return;
      ws=null; stopBeat();
      var was=hello; hello=false;
      if(was) cfg.down(); else fails++;
      if(shut||fails>=3) return;
      retryT=setTimeout(function(){ retryT=null; connect(); },wait); wait=Math.min(wait*2,30000);
    }
    function connect(){
      if(shut||ws||typeof WebSocket!=='function') return;
      var s;
      try{ s=cfg.protos?new WebSocket(addr(),cfg.protos()):new WebSocket(addr()); }catch(e){ fails++; return; }
      ws=s; hello=false;
      s.onmessage=function(ev){
        if(ws!==s) return;
        if(ev.data==='pong'){ if(pongT){ clearTimeout(pongT); pongT=null; } return; }
        var m=null; try{ m=JSON.parse(ev.data); }catch(e){ return; }
        if(!m||typeof m.k!=='string') return;
        if(m.k==='hello'){ if(hello) return; hello=true; fails=0; wait=1000; beat(); cfg.up(); return; }
        if(hello) cfg.event(m);
      };
      s.onclose=function(){ lost(s); };
      s.onerror=function(){};
    }
    /* a socket an iPhone left half open while the page was away is asked at once on the return (Fable's re-check of L2), not at the next ping */
    function wake(){
      if(shut) return;
      if(ws){ if(hello) probe(); return; }
      fails=0; wait=1000;
      if(retryT){ clearTimeout(retryT); retryT=null; }
      connect();
    }
    function shown(){ if(!document.hidden) wake(); }
    document.addEventListener('visibilitychange',shown);
    window.addEventListener('pageshow',wake);
    connect();
    return { wake:wake, close:function(){
      shut=true; if(retryT){ clearTimeout(retryT); retryT=null; } stopBeat();
      document.removeEventListener('visibilitychange',shown); window.removeEventListener('pageshow',wake);
      var s=ws, was=hello; ws=null; hello=false;
      if(s){ try{ s.close(); }catch(e){} }
      if(was) cfg.down();
    } };
  }
  var live=null, liveT=null, liveBusy=false, liveAgain=false, liveHad=false, POLL_BASE=POLL_MS, TH_BASE=TH_MS;
  function pollSet(){ if(poll){ clearInterval(poll); poll=setInterval(refresh, POLL_MS); } }
  function thSet(){ if(thTimer){ clearInterval(thTimer); thTimer=setInterval(thRead,TH_MS); } }
  /* one re-read a burst of events, never two at once: what arrives while one is out runs again after it */
  function liveRead(){ if(liveT) return; liveT=setTimeout(function(){ liveT=null; liveRun(); },250); }
  async function liveRun(){
    if(liveBusy){ liveAgain=true; return; }
    liveBusy=true;
    try{ await refresh(); }catch(e){ /* the next event or the poll reads again */ }
    liveBusy=false;
    if(liveAgain){ liveAgain=false; liveRead(); }
  }
  function liveStart(){
    if(!LIVE_ON||OWNER||!session) return;
    if(live){ live.wake(); return; }
    live=liveSocket({ path:'/live', protos:function(){ return ['stmt',session]; },
      up:function(){ POLL_MS=LIVE_NET_MS; TH_MS=LIVE_NET_MS; pollSet(); thSet(); if(liveHad) liveRead(); liveHad=true; },
      down:function(){ POLL_MS=POLL_BASE; TH_MS=TH_BASE; pollSet(); thSet(); },
      event:function(m){
        if(m.k==='thread'&&thSheetEl&&!thSheetEl.hidden){ thRead(); return; }
        if(m.k==='order'||m.k==='claim'||m.k==='pool'||m.k==='thread') liveRead();
      } });
  }
  function liveStop(){
    if(liveT){ clearTimeout(liveT); liveT=null; }
    liveAgain=false; liveHad=false;
    if(live){ var l=live; live=null; l.close(); }
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
    try{ history.replaceState(history.state,'','/'); }catch(e){}
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
      try{ history.replaceState(history.state,'','/'); }catch(e){}
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

  if(!OWNER){/*__TS_DOOR__*/
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
      if(APP&&!kept&&(IOS||key||qm||cm)) showCode((!!qm||cm)&&!STANDALONE); else { gate.hidden=false; pkPrime(); }
      if(APP&&qm&&INAPP&&!STANDALONE) csay(tw('code.inapp'),'bad');
      if(key&&!kept) await openHandover({token:key});
    })();
  }
})();
`;
