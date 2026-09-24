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
/* the level's mark: small, quiet, and never in the way of the price beside it (16 Sep 2026) */
.mark{margin-left:7px;font-size:0.72em;line-height:1;vertical-align:0.12em;opacity:0.85}
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
.gate .salt-insight{margin:22px 0 0}
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
/* on a button the mark takes the button's own ink, brass on the chosen one and muted on the rest */
.seg button .psym{vertical-align:-0.28em;color:inherit}
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
.keepsteps .glyph{vertical-align:-0.3em;margin:0 3px}
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
/* THE DOCUMENT KEEPS THE GEOMETRY IT WAS PROOFED IN. What is injected is the INSIDE of the
   statement's own .w wrapper, so without this the page rendered the tables full-bleed to the
   window while the lock bar and the issue strip stayed pinned at 620px above them: on a laptop
   the sheet the customer opens and the sheet he was sent were different documents. */
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
.seg button{flex:1;min-height:var(--salt-tap);font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);
  color:var(--salt-text-muted);background:none;border:1px solid var(--salt-line);border-radius:var(--salt-radius-pill);cursor:pointer}
.seg button.on{color:var(--salt-brass);border-color:var(--salt-brass);font-weight:700}
.pay{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.pay label{display:flex;gap:10px;align-items:center;min-height:var(--salt-tap);padding:0 6px;font-size:var(--salt-text-sm);cursor:pointer}
.pay input[type=radio]{width:18px;height:18px;accent-color:var(--salt-brass)}
.hist{margin:10px 0 0;padding:0;list-style:none;font-size:var(--salt-text-xs);color:var(--salt-text-muted);font-family:var(--salt-font-mono);line-height:1.8}
/* v751: the thread on an order. Theirs sits left and his right, which is the one convention every
   reader of a phone already knows, so no label has to say whose line it is. */
.thread{margin:12px 0 0;padding:0;list-style:none}
.thread li{margin:0 0 7px;max-width:82%;padding:7px 10px;border-radius:10px;font-size:var(--salt-text-sm);line-height:1.5}
.thread li.me{margin-left:auto;background:var(--salt-well);border:1px solid var(--salt-line)}
.thread li.them{margin-right:auto;background:var(--salt-glass);border:1px solid var(--salt-brass)}
.thread .when{display:block;font-size:var(--salt-text-xs);color:var(--salt-text-muted);font-family:var(--salt-font-mono);margin-bottom:2px}
.thread .said{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.sayw{display:flex;gap:7px;align-items:center;margin-top:10px}
.sayw .fld{flex:1 1 auto;margin:0}

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
/* THE MASTER ACCOUNT (v687). Its items are the roster's own rows, so the page has one shape; an
   account's row wraps to two lines, the code and username on the first and where it stands on the
   second, because the flag is the thing he is reading the list for. The five words take the
   colours the desk gives the same states: owed in ember, goods in steel, a refund in brass. */
.rlist button[data-m]{flex-wrap:wrap}
.rlist button[data-m] span{flex:1 0 100%;margin-top:4px;color:var(--salt-text-muted)}
#rlist button{flex-wrap:wrap}
#rlist button .fl{flex:1 0 100%;margin-top:5px;letter-spacing:.04em}
#rlist button .op{flex:1 0 100%;color:var(--salt-text-muted)}
#rlist button .f-owes{color:var(--salt-ember)}
#rlist button .f-goods{color:var(--salt-steel)}
#rlist button .f-refund{color:var(--salt-brass)}
#rlist button .f-pend{color:var(--salt-copper)}
#rlist button .f-clear,#rlist button .f-none{color:var(--salt-mist)}
#mHome h1,#oReview h1,#oLinks h1{margin-top:0}
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
/** The mark for a product, as SVG source. `px` is the drawn size; the stroke stays hairline. */
export function psymSvg(product, px) {
  const d = PSYM[String(product || "").toLowerCase()] || RING;
  return '<svg class="psym" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false">'
    + '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

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
    + '<button class="btn salt-ghost salt-ghost--lit" id="keepGo" type="button">Show me how</button></div>';
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
    + '<span class="sub2">At the foot of Safari. On an older iPhone, just the second mark.</span></li>'
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
        + p.sizes.map((r) => "<tr><td class=\"l\">" + esc(r.q) + " " + esc(p.unit || "unit")
            + "</td><td>" + esc(rm(r.price)) + "</td></tr>").join("")
        + "</tbody></table></div></div>").join("")
    : '<p class="lead">No price list has been written yet.</p>';
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + '<meta name="referrer" content="no-referrer">'
    + "<title>Price list</title>"
    + '<style nonce="' + nonce + '">' + FONT_FACE_CSS + STATEMENT_CSS + SITE_RECIPES + PAGE_CSS + "</style></head><body>"
    + '<div class="panel">'
    + "<h2>Price list</h2>"
    + '<p class="lead">' + (week ? "For the week of " + esc(week) + ". " : "")
    + "The price is for the goods. Delivery is charged separately and quoted when you order. "
    + "Ask about any size that is not listed.</p>"
    + body
    + "</div></body></html>";
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
export function landingPage(user, nonce, owner, bulletin) {
  const u = esc(user || "");
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
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
    + '<link rel="apple-touch-icon" href="/icon.png">'
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
      ? '<div id="roster" class="gate">'
        /* v687: the master account opens on what it can do, not on a list. An item is added here
           only once it works, so nothing on this page is a promise. */
        + '<div id="mHome">'
        + "<h1>Master account</h1>"
        + '<p class="lead" id="mCount">' + owner.accounts.filter((a) => !a.test).length + " accounts on the site.</p>"
        + '<div class="rlist" id="mItems">'
        + '<button type="button" data-m="send">Send statement'
        + "<span>one card an account: the message, the code and the password</span></button>"
        + '<button type="button" data-m="review">Review statement'
        + "<span>where every account stands, and when it was last opened</span></button>"
        + '<button type="button" data-m="cards">Associates report card'
        + "<span>what each has brought you, and what they have earned</span></button>"
        + '<button type="button" data-m="links">Links'
        + "<span>guest price lists, made and withdrawn</span></button>"
        + "</div>"
        + '<div id="mTest" class="mtest"></div>'
        + "</div>"
        + '<div id="oReview" hidden>'
        + '<button type="button" data-back>' + "← Back" + "</button>"
        + "<h1>Review statement</h1>"
        + '<p class="lead">Tap an account to open it exactly as its own page.</p>'
        + '<input class="fld salt-field__input salt-field__input--mono" id="rq" type="text" autocapitalize="none" autocorrect="off" '
        + 'spellcheck="false" placeholder="filter" aria-label="Filter accounts">'
        + '<div id="rlist" class="rlist"></div>'
        + "</div>"
        + '<div id="oSend" hidden>'
        + '<button type="button" data-back>' + "← Back" + "</button>"
        + "<h1>Send statement</h1>"
        + '<p class="lead" id="scount"></p>'
        + '<input class="fld salt-field__input salt-field__input--mono" id="sq" type="text" autocapitalize="none" autocorrect="off" '
        + 'spellcheck="false" placeholder="filter" aria-label="Filter accounts">'
        + '<div id="slist"></div>'
        + "</div>"
        + '<div id="oCards" hidden>'
        + '<button type="button" data-back>' + "← Back" + "</button>"
        + "<h1>Associates report card</h1>"
        + '<p class="lead" id="ccount"></p>'
        + '<div id="clist"></div>'
        + "</div>"
        + '<div id="oLinks" hidden>'
        + '<button type="button" data-back>' + "← Back" + "</button>"
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
        + '<p class="msg" id="rmsg" role="status" aria-live="polite"></p></div>'
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
    + '<p class="msg" id="msg" role="status" aria-live="polite"></p></div>'
    /* S3 3.11: a code from another device, or from Salt Admin at the counter */
    + (owner ? "" : '<button class="btn salt-ghost" id="toCode" type="button">I have a sign-in code</button>')
    + '<p class="salt-insight">Lost your password or your link? Ask us for a <b>new sign-in link</b>. It works straight away.</p>'
    + "</div>"
    + (owner ? "" : linkScreen() + codeScreen() + signedOutSheet() + replaceAsk() + keepSheet())
    + '<div id="barw" hidden><div class="bar">'
    + '<span><b id="whoacct"></b><span id="cd"></span></span>'
    + '<button type="button" id="lock">Log out</button>'
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
    + '<div id="mos" class="mos" hidden></div>'
    + '<div id="mfil" class="mos mfil" hidden></div><p class="mfnote" id="mfnote"></p>'
    + '<div id="out"></div></div>'
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
  var DEV=/Mobi|Android|iPhone|iPad|iPod/.test(UA)||IOS?'phone':'computer';
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
      mos=document.getElementById('mos'), mfil=document.getElementById('mfil'),
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
  /* a username or a password in the form it was sent in, or '' when the text holds none */
  function shaped(t, n){
    var low=String(t||'').toLowerCase(), m=(n===8?UN_IN:PW_IN).exec(low);
    var raw=m?m.slice(1).join(''):clean(low);
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
  function unitsOf(q,u){ return q+' '+(u||'unit'); }

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
        /* S3 3.8: what this phone remembered before is gone from it, so its wrap goes from the site as well */
        if(was&&was.t&&was.t!==j.token) fetch('/logout',{method:'POST', headers:{'content-type':'application/json'},
          body:JSON.stringify({token:was.t})}).catch(function(){});
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
  var keepTok='', keepExp=0;
  function drawKeep(){
    if(!keepCardEl) return;
    keepCardEl.hidden=!(IOS&&!INAPP&&!STANDALONE&&!OWNER&&!view&&!!session);
  }
  function ksay(t,cls){ keepMsg.textContent=t||''; keepMsg.className='msg'+(cls?' '+cls:''); }
  async function mintKeep(){
    keepCopy.disabled=true; keepCode.value=''; ksay('Making your code...','wait');
    try{
      var tok=b64e(crypto.getRandomValues(new Uint8Array(24))).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/=+$/,'');
      var wrap=await wrapUnder(new TextEncoder().encode(tok), curCk);
      var r=await api('/handover',{token:tok, wrap:wrap});
      if(keepSheetEl.hidden) return;
      if(r.status===503){ ksay('Saving it as an app is not switched on yet. Ask us, and sign in inside the new app meanwhile.','bad'); return; }
      if(!r.body.ok||!r.body.code){ ksay(r.status===401?r.body.error:'The code could not be made just now. Close this and open it again.','bad'); return; }
      keepTok=r.body.token||tok; keepExp=Date.parse(r.body.exp)||(Date.now()+15*60000);
      keepCode.value=String(r.body.code).toUpperCase().replace('-',' ');
      keepCopy.disabled=false; ksay('');
    }catch(e){ ksay('The code could not be made just now. Close this and open it again.','bad'); }
  }
  function openKeep(){
    if(!keepSheetEl||!curCk) return;
    keepScrim.hidden=false; keepSheetEl.hidden=false;
    try{ keepSheetEl.focus(); }catch(e){}
    if(!keepTok||Date.now()>keepExp-60000) mintKeep();
  }
  function closeKeep(){ if(!keepSheetEl||keepSheetEl.hidden) return; keepSheetEl.hidden=true; keepScrim.hidden=true; try{ document.getElementById('keepGo').focus(); }catch(e){} }
  if(keepSheetEl){
    document.getElementById('keepGo').addEventListener('click', openKeep);
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
  var TOK_RE=/^[A-Za-z0-9_-]{20,64}$/;
  function csay(t,cls){ if(codeMsg){ codeMsg.textContent=t||''; codeMsg.className='msg'+(cls?' '+cls:''); } }
  function showCode(fromDoor){
    if(!codeBox) return;
    gate.hidden=true; if(opening) opening.hidden=true; codeBox.hidden=false;
    /* the words fit the road: the saved iPhone app is told the true way to get a code; a browser is not told about Safari */
    var ios=IOS&&!fromDoor;
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
    var x=await unseal(body, ck, b);
    if(stale()) return false;
    try{ if(location.hash) history.replaceState(null,'','/app'); }catch(e){}
    var keep=await askReplace(document.getElementById('codePaste'), body.u);   /* S3 3.8 */
    if(stale()) return false;
    csay(''); codeBox.hidden=true; codeIn.value='';
    enter(body.u, body, b, x, ck);
    if(!(await follow(stale))) return true;
    if(keep) await remember(body.u, ck);
    askPush();
    return true;
  }
  /* a code as the site takes it, xxxx-xxxx, or '' */
  function codeOf(t){ var raw=clean(t); return raw.length===8?raw.slice(0,4)+'-'+raw.slice(4):''; }
  if(codeBox){
    document.getElementById('toCode').addEventListener('click', function(){ showCode(true); try{ codeIn.focus(); }catch(e){} });
    document.getElementById('codeDoor').addEventListener('click', function(){ codeBox.hidden=true; gate.hidden=false; try{ (un.value?pw:un).focus(); }catch(e){} });
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
      csay('There is no code on the clipboard. Copy it in Safari, or type it below.','bad');
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
    bundle=null; session=''; view=false; prices=null; orders=[]; draft={}; pick={}; assoc=false; card=null; cardMonth=null; myLinks=null; myMax=0; myNote='';
    owedNow=0; hold=false; tPrices.hidden=false; tOrder.textContent='Order';
    out.textContent=''; mos.textContent=''; mos.hidden=true;
    mfil.textContent=''; mfil.hidden=true; mfPick=null;
    var mfn=document.getElementById('mfnote'); if(mfn) mfn.textContent='';
    pPrices.textContent=''; pOrder.textContent='';
    tabs.hidden=true; barw.hidden=true; lapse.hidden=true; if(linkBox) linkBox.hidden=true;
    curCk=null; closeSignedOut(); if(opening) opening.hidden=true;
    closeKeep(); keepTok=''; keepExp=0; if(keepCardEl) keepCardEl.hidden=true; if(codeBox) codeBox.hidden=true;
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
    var tok=(remGet()||{}).t||null, s=session, ep=null;
    remClear();
    lock();
    /* S1 1.42: this phone's alerts go too, here and on the site, and the site is told even when the session
       has lapsed, so the remembered wrap does not outlive the Log out */
    if(!OWNER){ try{ var sub=await phoneSub(); if(sub){ ep=sub.endpoint; await sub.unsubscribe(); } }catch(e){} }
    if(s||tok||ep){
      try{ await fetch('/logout', {method:'POST', headers:{'content-type':'application/json','X-Stmt-Session':s},
        body:JSON.stringify({token:tok, endpoint:ep})}); }catch(e){ /* the page has forgotten it either way */ }
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
  function reopen(){
    if(OWNER) return Promise.resolve(false);
    if(!reopening) reopening=openRemembered(true).then(function(v){ reopening=null; return v; }, function(){ reopening=null; return false; });
    return reopening;
  }
  function lapsed(){
    if(poll){ clearInterval(poll); poll=null; }
    if(!lapse.hidden) return;
    var kept=!!remGet();
    document.getElementById('lapseT').textContent=kept?'This '+DEV+' could not sign you back in just now.':'You were signed out on this '+DEV+'.';
    document.getElementById('lapseGo').textContent=kept?'Try again':'Sign in';
    lapse.hidden=false;
    if(!kept) openSignedOut();
  }
  function openSignedOut(){
    if(OWNER||!outSheet||!outSheet.hidden) return;
    document.getElementById('outForm').appendChild(doorBox);
    if(user) un.value=user;
    say('');
    outScrim.hidden=false; outSheet.hidden=false;
    try{ pw.focus(); }catch(e){}
  }
  function closeSignedOut(){
    if(!outSheet||outSheet.hidden) return;
    outSheet.hidden=true; outScrim.hidden=true;
    gate.insertBefore(doorBox, gate.querySelector('.salt-insight'));
  }
  if(outSheet){
    document.getElementById('outX').addEventListener('click', function(){ closeSignedOut(); try{ document.getElementById('lapseGo').focus(); }catch(e){} });
    outScrim.addEventListener('click', closeSignedOut);
    document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeSignedOut(); });
  }
  document.getElementById('lapseGo').addEventListener('click', async function(){
    if(OWNER) return;
    if(!remGet()){ openSignedOut(); return; }
    /* the line stays until the phone is back in: enter() takes it away; a refusal forgets the phone, so it is redrawn */
    if(!(await reopen())){ lapse.hidden=true; lapsed(); return; }
    await loadOrders(); drawOrder();
  });

  /* ---- the tabs: three for everyone, a fourth for an associate ---- */
  function showTab(t){
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

  function pickStmt(i){
    if(!bundle) return;
    at=i;
    /* AN ACCOUNT WITH NO ROWS HAS NO STATEMENT AT ALL (tools/stmt-account.mjs mints it so): it says so,
       and Prices and Order are still drawn after it. Reading a body that is not there threw here, and
       the page stopped on a blank tab. */
    var s=bundle.statements[i];
    if(!s){
      out.textContent=''; var e=el('div','panel'); e.appendChild(el('p','lead','Nothing on your account yet. Your orders will show here.')); out.appendChild(e);
      mfil.hidden=true; var mfn=document.getElementById('mfnote'); if(mfn) mfn.textContent='';
      return;
    }
    out.innerHTML=s.body;
    var bs=mos.querySelectorAll('button');
    for(var k=0;k<bs.length;k++) bs[k].className=(k===i?'on':'');
    drawMonths();
    window.scrollTo(0,0);
  }

  /* ---- THE MONTH FILTER (v690, his instruction of 18 Sep 2026) -------------------------------
     THE STATEMENT IS NOT BOUND TO A MONTH ANY MORE: it carries every order from the start, and
     this filters it. Each row says which month it belongs to; an undated row belongs to none and
     shows whatever is chosen. What the account stands at is the account's, so the totals under the
     table do not move with the filter, and the line above says so.
     v769, HIS INSTRUCTION OF 21 SEP 2026: IT OPENS ON THE WHOLE ACCOUNT. v690 opened on the newest
     month, because a monthly statement was what a reader had come for. There are no monthly
     statements any more, just one live document that keeps up with the orders, so opening on a month
     hid the rest of somebody's own account behind a tap they had no reason to take. A month is still
     one tap, for a reader who wants to look at one. */
  var mfPick=null;
  function monthLabel(m){
    var y=m.slice(0,4), mm=+m.slice(5,7);
    return ['January','February','March','April','May','June','July','August','September','October','November','December'][mm-1]+' '+y;
  }
  function applyMonths(){
    var rows=out.querySelectorAll('tbody tr[data-m]');
    for(var i=0;i<rows.length;i++){
      var m=rows[i].getAttribute('data-m');
      rows[i].style.display=(!mfPick||m===mfPick)?'':'none';
    }
    var bs=mfil.querySelectorAll('button');
    for(var k=0;k<bs.length;k++) bs[k].className=(bs[k].getAttribute('data-mf')===(mfPick||'')?'on':'');
    var note=document.getElementById('mfnote');
    if(note) note.textContent=mfPick
      ? 'Showing '+monthLabel(mfPick)+'. What the account stands at, below, is the whole account.'
      : 'Showing every order from the start.';
  }
  function drawMonths(){
    mfil.textContent='';
    var rows=out.querySelectorAll('tbody tr[data-m]'), seen={}, months=[];
    for(var i=0;i<rows.length;i++){
      var m=rows[i].getAttribute('data-m');
      if(m&&!seen[m]){ seen[m]=1; months.push(m); }
    }
    months.sort().reverse();
    if(months.length<2){ mfil.hidden=true; mfPick=null; applyMonths(); return; }
    mfPick=null;   /* v769: the whole account, and a month is one tap */
    months.forEach(function(m){
      var b=document.createElement('button'); b.type='button'; b.setAttribute('data-mf',m);
      b.textContent=monthLabel(m);
      b.addEventListener('click', function(){ mfPick=m; applyMonths(); });
      mfil.appendChild(b);
    });
    var all=document.createElement('button'); all.type='button'; all.setAttribute('data-mf','');
    all.textContent='All';
    all.addEventListener('click', function(){ mfPick=null; applyMonths(); });
    mfil.appendChild(all);
    mfil.hidden=false;
    applyMonths();
  }

  /* THE STRIP: the live document first, as "Now" with the minute it was written, then every
     issue by its date, newest first. One statement shows at a time. */
  function show(b){
    bundle=b; mos.textContent='';
    if(b.statements.length>1){
      var firstIssue=true;
      for(var i=0;i<b.statements.length;i++){
        var s=b.statements[i], bt=document.createElement('button'); bt.type='button';
        bt.textContent=s.label||s.issued;
        var sm=document.createElement('small');
        if(s.live){ sm.textContent='live, '+stamp(s.at); }
        else if(firstIssue){ sm.textContent='latest issue'; firstIssue=false; }
        if(sm.textContent) bt.appendChild(sm);
        (function(j){ bt.addEventListener('click', function(){ pickStmt(j); }); })(i);
        mos.appendChild(bt);
      }
      mos.hidden=false;
    }
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
          +(rw.held?'. Held for now.':'.')));
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
  function monthOf(d){
    var m=/^(\\d{4})-(\\d{2})/.exec(String(d||'')); if(!m) return '';
    return MONTHS[+m[2]-1]+' '+m[1];
  }
  /* the mark for each level, symbol then colour; all six shapes come from one Unicode block so they
     render the same everywhere, and none of them is a count */
  var MARK={ 'Ambassador':['\\u25C7','#2b2f33'], 'Titanium':['\\u25CF','#6e7b85'], 'Platinum':['\\u25C6','#9aa7b0'],
             'Gold':['\\u25B2','#c08a3e'], 'Silver':['\\u25A0','#8c97a0'], 'Bronze':['\\u25CB','#b06a3b'] };
  function drawPrices(){
    pPrices.textContent='';
    var h=el('h2',null,'Your prices'); pPrices.appendChild(h);
    var g=el('p','lead',hail()); g.style.marginTop='0'; pPrices.appendChild(g);
    var soon=((prices&&prices.soon)||[]).concat(((prices&&prices.products)||[]).filter(function(x){ return !(x.sizes&&x.sizes.length); }));
    if(!prices||((!prices.products||!prices.products.length)&&!soon.length)){
      pPrices.appendChild(el('p','lead','No price list has been written for your account yet. It is written with the next update and changes weekly.'));
      return;
    }
    pPrices.appendChild(el('p','lead','For the week of '+(prices.week&&prices.week.label||'')+'. The price is for the goods; if you ask for delivery, the charge is set when your order is acknowledged, and you see it then. The list is written from your own history and changes weekly.'));
    if(prices.since) pPrices.appendChild(el('p','sub2','Buying with us since '+monthOf(prices.since)+'.'));
    sold().forEach(function(p){
      var pane=el('div','pane');
      var h3=el('h3','pmark'); h3.setAttribute('aria-label',pshape(p.product)); h3.appendChild(psym(p.product,28));
      /* ============ HIS INSTRUCTION, 16 SEP 2026: THE LABEL IS A VERY SUBTLE MARK ============
         A symbol and a colour for each level, beside the product it belongs to, because a customer
         holds a level per product. THE LEVEL IS NEVER NAMED HERE, which is the whole of "subtle":
         the mark is theirs to recognise, not a rank to read off, and the shapes deliberately do not
         count up or down so two customers comparing pages cannot order themselves by it. The name
         travels in the sealed list, as it has since v651, and stays out of the page's text and out
         of the mark's own label. */
      var mk=MARK[p.tier];
      if(mk){
        var m=el('span','mark');
        m.textContent=mk[0];
        m.style.color=mk[1];
        m.setAttribute('aria-hidden','true');
        h3.appendChild(m);
      }
      pane.appendChild(h3);
      pane.appendChild(el('p','sub2', p.basis==='board' ? 'The same price for everybody. '
        : p.basis==='yours'
        ? 'Your rate: '+rm(p.rate)+' per '+(p.unit||'unit')+', from your last '+p.orders+' order'+(p.orders===1?'':'s')+'. '
        : 'Your own rate follows your first order. '));
      var t=el('table'), th=el('thead'), tr=el('tr');
      [['Size','l'],['Price','']].forEach(function(c){ var x=el('th',c[1]||null,c[0]); tr.appendChild(x); });
      th.appendChild(tr); t.appendChild(th);
      var tb=el('tbody');
      p.sizes.forEach(function(r){
        var row=el('tr');
        row.appendChild(el('td','l',unitsOf(r.q,p.unit)));
        row.appendChild(el('td',null,rm(r.price)));
        tb.appendChild(row);
      });
      t.appendChild(tb); pane.appendChild(t); pPrices.appendChild(pane);
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
    if(r.status===401&&session){ lapsed(); return {status:401, body:{ok:false, error:remGet()?NOT_SENT:LAPSED}}; }
    var j=null; try{ j=await r.json(); }catch(e){}
    return {status:r.status, body:j||{}};
  }
  /* one id a review and one a payment, sent with the tap, so a retry of that tap is recorded once */
  function mintRid(){ var a=crypto.getRandomValues(new Uint8Array(16)), s=''; for(var i=0;i<a.length;i++) s+=(a[i]<16?'0':'')+a[i].toString(16); return s; }
  function quoteFor(){
    var p=prices&&prices.products&&prices.products.filter(function(x){return x.product===draft.product;})[0];
    if(!p) return null;
    var r=p.sizes.filter(function(x){return String(x.q)===String(draft.q);})[0];
    if(!r) return null;
    var total=r.price;
    return {p:p, q:r.q, total:total, unit:+(total/r.q).toFixed(2)};
  }
  function drawOrder(){
    var sc=window.scrollY;
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
      pOrder.appendChild(el('p','lead',prices&&(prices.soon&&prices.soon.length||prices.products&&prices.products.length)?'Ordering opens once your prices are set.':'Ordering opens once your price list is written, with the next update.'));
    } else {
      pOrder.appendChild(el('p','lead','Pick a size off your list and check it over before you place it. Once it is acknowledged you can pay, and you are told when the goods are on their way.'));
      var form=el('div','pane');
      var S=sold();
      if(!draft.product) draft.product=S[0].product;
      var P=S.filter(function(x){return x.product===draft.product;})[0]||S[0];
      draft.product=P.product;
      if(!draft.q||!P.sizes.some(function(x){return String(x.q)===String(draft.q);})) draft.q=P.sizes[0].q;
      if(!draft.mode) draft.mode='collect';
      /* v695: the product was a dropdown, and an option carries text and nothing else, so a mark
         could not go in one. Two products are a segment anyway, which is one tap rather than two. */
      if(S.length>1){
        var pseg=el('div','seg');
        S.forEach(function(x){
          var b=el('button',x.product===draft.product?'on':''); b.type='button';
          b.setAttribute('aria-label',pshape(x.product));
          b.setAttribute('aria-pressed',x.product===draft.product?'true':'false');
          b.appendChild(psym(x.product,22));
          b.addEventListener('click',function(){ draft.product=x.product; draft.q=null; draft.confirm=false; drawOrder(); });
          pseg.appendChild(b);
        });
        form.appendChild(pseg);
      }
      var sq=el('select','fld salt-field__input salt-field__input--mono'); sq.setAttribute('aria-label','Size');
      P.sizes.forEach(function(x){ var o=el('option',null,unitsOf(x.q,P.unit)); o.value=String(x.q); if(String(x.q)===String(draft.q))o.selected=true; sq.appendChild(o); });
      sq.addEventListener('change',function(){ draft.q=sq.value; drawOrder(); });
      form.appendChild(sq);
      var seg=el('div','seg');
      [['collect','I will collect'],['deliver','Deliver to me']].forEach(function(m){
        var b=el('button',draft.mode===m[0]?'on':'',m[1]); b.type='button';
        b.addEventListener('click',function(){ draft.mode=m[0]; drawOrder(); }); seg.appendChild(b);
      });
      form.appendChild(seg);
      /* 24 Sep 2026: WHILE CHECK THIS OVER IS OPEN, THE PLACE AND THE LINE ARE WHAT IT SHOWS. Typing in either drew
         nothing, so the list said one place and Place sent another (v694: the first tap shows what is about to be
         ordered). They are read-only until Change it; the size and the mode redraw the list, so they stay live. */
      var locked=!!draft.confirm&&!!quoteFor()&&(draft.mode!=='deliver'||String(draft.place||'').trim().length>=2);
      /* v694: a delivery says roughly where it is going, in his words a general location. It tells
         him which way to drive and what to charge; it is not an address and is not asked for one. */
      if(draft.mode==='deliver'){
        form.appendChild(el('span','lbl','Where to'));
        var pl=el('input','fld salt-field__input'); pl.type='text'; pl.maxLength=60; pl.value=draft.place||'';
        pl.placeholder='a neighbourhood or a landmark'; pl.setAttribute('aria-label','Roughly where it is going'); pl.readOnly=locked;
        pl.addEventListener('input',function(){ draft.place=pl.value; var b=document.getElementById('oGo'); if(b)b.disabled=!quoteFor()||!!draft.busy||pl.value.trim().length<2; });
        form.appendChild(pl);
        form.appendChild(el('div','sub2','A neighbourhood is enough. The delivery charge is set when the order is acknowledged, and you see it here before you pay.'));
      }
      /* v751: ANYTHING THEY WANT TO SAY WITH IT, on any order and never required. It opens the
         order's thread rather than sitting in a field of its own, so there is one place to read. */
      form.appendChild(el('span','lbl','Anything to add'));
      var sy=el('input','fld salt-field__input'); sy.type='text'; sy.maxLength=140; sy.value=draft.say||'';
      sy.placeholder='optional, a line about this order'; sy.setAttribute('aria-label','Anything to add about this order'); sy.readOnly=locked;
      sy.addEventListener('input',function(){ draft.say=sy.value; });
      form.appendChild(sy);
      /* v702, HIS INSTRUCTION OF 18 SEP 2026: an associate's own order and one placed for somebody
         else are no longer told apart by what they buy, so they tick it. "On behalf of a friend",
         his words, and the words he replaced an earlier phrasing with. Nobody else sees the tick. */
      if(assoc){
        var fl=el('label','rem'); var fb=el('input'); fb.type='checkbox'; fb.id='ofriend'; fb.checked=!!draft.forFriend;
        fb.addEventListener('change',function(){ draft.forFriend=fb.checked; draft.confirm=false; drawOrder(); });
        fl.appendChild(fb); fl.appendChild(el('span',null,'On behalf of a friend'));
        form.appendChild(fl);
      }
      var qt=quoteFor();
      form.appendChild(el('div','quote',qt?rm(qt.total):''));
      if(qt){
        var sub=el('div','sub2');
        sub.appendChild(withMark(P.product,unitsOf(qt.q,P.unit)+' ',18));
        sub.appendChild(document.createTextNode(' at '+rm(qt.unit)+' per '+(P.unit||'unit')
          +(draft.mode==='deliver'?'; delivery is added when the order is acknowledged':', to collect')));
        form.appendChild(sub);
      } else form.appendChild(el('div','sub2',''));
      var ready=!!qt&&!draft.busy&&(draft.mode!=='deliver'||String(draft.place||'').trim().length>=2);
      /* 24 Sep 2026: THE REQUEST ID IS FOR THIS ORDER. The size and the mode stay live while Check this over is open,
         and the Worker answers any repeat of an id with the order first stored under it, so a changed order takes a
         new id, as a changed payment figure does; a retry of the same one keeps it. */
      var what=qt?[P.product,qt.q,draft.mode,qt.total].join('|'):'';
      /* v694: NOTHING IS PLACED ON ONE TAP (his instruction, 18 Sep 2026). The first tap shows what
         is about to be ordered, in words, and the second places it. Going back keeps the choices. */
      if(draft.confirm&&ready){
        var cf=el('div','pane'); cf.style.marginTop='14px';
        cf.appendChild(el('h3',null,'Check this over'));
        var ul=el('ul','conf');
        var rows=[['What',withMark(P.product,unitsOf(qt.q,P.unit)+' ',18)],
                  ['How',draft.mode==='deliver'?'Delivered to you':'You collect it'],
                  ['Rate',rm(qt.unit)+' per '+(P.unit||'unit')],
                  ['Goods',rm(qt.total)]];
        if(draft.mode==='deliver'){ rows.splice(2,0,['Where',draft.place.trim()]); rows.push(['Delivery','set when it is acknowledged']); }
        if(assoc) rows.splice(1,0,['For',draft.forFriend?'A friend':'Yourself']);
        if(String(draft.say||'').trim()) rows.push(['You said',String(draft.say).trim()]);
        rows.forEach(function(r){ var li=el('li'); li.appendChild(el('span','k',r[0]));
          var v=el('span','v'); if(typeof r[1]==='string') v.textContent=r[1]; else v.appendChild(r[1]);
          li.appendChild(v); ul.appendChild(li); });
        cf.appendChild(ul);
        var ok2=el('button','btn salt-pill salt-pill--md','Place this order'); ok2.type='button'; ok2.disabled=!!draft.busy;
        ok2.addEventListener('click', async function(){
          if(draft.busy) return; draft.busy=true;
          if(draft.ridFor!==what){ draft.rid=mintRid(); draft.ridFor=what; }
          drawOrder();
          var mine=ticket;
          var r=await api('/orders',{product:P.product,qty:qt.q,mode:draft.mode,unit:qt.unit,total:qt.total,
            place:draft.mode==='deliver'?draft.place.trim():'',forFriend:!!(assoc&&draft.forFriend),
            note:String(draft.say||'').trim(), rid:draft.rid,
            week:(prices.week&&prices.week.monday)||''});
          if(mine!==ticket) return;
          draft.busy=false;
          if(!r.body.ok){ draft.note=r.body.error||'The order was not placed.'; }
          else { draft.note='Placed. You will see it acknowledged below.'; draft.confirm=false; draft.place=''; draft.say=''; await loadOrders(); if(mine!==ticket) return; }
          drawOrder();
        });
        cf.appendChild(ok2);
        var back=el('button','btn quiet salt-ghost','Change it'); back.type='button'; back.disabled=!!draft.busy;
        back.addEventListener('click',function(){ draft.confirm=false; drawOrder(); });
        cf.appendChild(back);
        form.appendChild(cf);
      } else {
        var go2=el('button','btn salt-pill salt-pill--md','Review this order'); go2.type='button'; go2.id='oGo'; go2.disabled=!ready;
        go2.addEventListener('click',function(){ draft.confirm=true; draft.note=''; draft.rid=mintRid(); draft.ridFor=what; drawOrder(); });
        form.appendChild(go2);
      }
      if(draft.note) form.appendChild(el('p','msg',draft.note));
      pOrder.appendChild(form);
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
    var h=el('h2',null,'Your orders'); h.style.marginTop='18px'; pOrder.appendChild(h);
    if(!orders.length) pOrder.appendChild(el('p','lead','None yet.'));
    orders.forEach(function(o){ pOrder.appendChild(orderPane(o)); });
    if(keep){ var kbox=[].filter.call(pOrder.querySelectorAll('input[data-say]'),function(x){ return x.getAttribute('data-say')===keep; })[0];
      if(kbox){ try{ kbox.focus({preventScroll:true}); kbox.setSelectionRange(sel[0],sel[1]); }catch(e){} } }
    window.scrollTo(0,sc);
    openWanted();
  }

  /* the chip's tone by state: pending is steel, ready is brass, done is verdigris, anything closed is mist */
  var STATE_TONE={placed:'steel',acknowledged:'steel',ready:'brass',done:'verdigris'};
  var STATE_WORDS={placed:'Placed', acknowledged:'Acknowledged', ready:'Ready', done:'Completed', declined:'Declined', cancelled:'Withdrawn'};
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
  function orderPane(o){
    var pane=el('div','pane');
    pane.setAttribute('data-order',o.id);
    var P=prices&&prices.products&&prices.products.filter(function(x){return x.product===o.product;})[0];
    var unit=P?P.unit:'unit';
    var due=dueOf(o), moved=+o.moved||0, paid=+o.paid||0, payable=['acknowledged','ready'].indexOf(o.status)>=0;
    var tap=(draft.tap&&draft.tap.id===o.id)?draft.tap:null, tk=tap&&tap.k;
    if(tk==='pay'&&!(payable&&due>0.004) || tk==='withdraw'&&!((payable||o.status==='placed')&&!(moved>0))) tk='state';
    pane.appendChild(el('div','state salt-status salt-status--'+(STATE_TONE[o.status]||'mist'), STATE_WORDS[o.status]||o.status));
    pane.appendChild(el('div','quote', rm(o.total+(o.delivery||0))));
    if(o.delivery>0) pane.appendChild(el('div','sub2', rm(o.total)+' for the goods and '+rm(o.delivery)+' delivery'));
    var line2=el('div','sub2');
    line2.appendChild(withMark(o.product,unitsOf(o.qty,unit)+' ',18));
    line2.appendChild(document.createTextNode(', '+(o.mode==='deliver'?'to be delivered':'to collect')
      +(o.place?' to '+o.place:'')+(o.forFriend?', on behalf of a friend':'')+', placed '+stamp(o.at)));
    pane.appendChild(line2);
    var line='';
    if(o.status==='placed') line='Waiting to be acknowledged. You will see it change here.';
    else if(payable) line=(o.status==='ready'?(o.mode==='deliver'?'Ready to be delivered. ':'Ready to collect. '):'Acknowledged, and being prepared. ')
      +(paid>0?(due>0.004?rm(paid)+' of '+rm(o.total+(o.delivery||0))+' paid, '+rm(due)+' to go.':'Paid in full.'):'Nothing paid yet.')
      +(moved>0?(moved<o.qty-0.004?' '+unitsOf(moved,unit)+' of '+unitsOf(o.qty,unit)+' handed over.':' Handed over in full.'):'');
    else if(o.status==='done') line='Your order is now complete. Thank you for your loyalty.';
    else if(o.status==='declined') line='This order could not be taken. Nothing is owed.';
    else if(o.status==='cancelled') line=paid>0?'Withdrawn. The '+rm(paid)+' you paid is refunded.':'Withdrawn before anything moved. Nothing is owed.';
    pane.appendChild(el('p','sub2',line));
    if(tk==='state') pane.appendChild(statusLine(tap.t));
    if(!view&&payable&&due>0.004) pane.appendChild((o.method&&!(pick[o.id]||{}).again)?payBox(o):payChooser(o));
    if(tk==='pay') pane.appendChild(statusLine(tap.t));
    /* v694: either side may withdraw at any stage until the goods move (his rule, 18 Sep 2026) */
    if(!view&&(payable||o.status==='placed')){
      if(moved>0) pane.appendChild(el('p','sub2','The goods are with you, so this can no longer be withdrawn here.'));
      else {
        var wb=el('button','btn quiet salt-ghost','Withdraw this order'); wb.type='button';
        wb.addEventListener('click', async function(){
          if(!confirm(paid>0?'Withdraw this order? The '+rm(paid)+' you paid is refunded.':'Withdraw this order?')) return;
          var mine=ticket; var r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{});
          if(mine!==ticket) return;
          tapSaid(o,'withdraw',r.body.ok?'':(r.body.error||'It could not be withdrawn.'));
          await loadOrders(); if(mine!==ticket) return; drawOrder();
        });
        pane.appendChild(wb);
        if(tk==='withdraw') pane.appendChild(statusLine(tap.t));
      }
    }
    /* v751: THE THREAD, oldest first, theirs and his. It sits above the history because it is the
       part a reader came back for; the history is the record underneath it. */
    var msgs=(o.msgs||[]);
    if(msgs.length){
      var th=el('ul','thread');
      msgs.forEach(function(m){
        var li=el('li',m.by==='desk'?'them':'me');
        li.appendChild(el('span','when',(m.by==='desk'?'Reply, ':'You, ')+stamp(m.at)));
        li.appendChild(el('p','said',m.text||''));
        th.appendChild(li); });
      pane.appendChild(th);
    }
    /* ON ANY ORDER, AT ANY STAGE: a question about a withdrawn order is still about that order.
       His read-only view writes nothing; he answers on the desk. */
    var sayw=el('div','sayw');
    var si=el('input','fld salt-field__input'); si.type='text'; si.maxLength=200;
    si.placeholder=msgs.length?'Add to this':'Ask about this order';
    si.setAttribute('aria-label','Write about this order');
    si.setAttribute('data-say',o.id); si.value=(draft.says||{})[o.id]||'';
    si.addEventListener('input',function(){ (draft.says=draft.says||{})[o.id]=si.value; });
    var sg=el('button','btn quiet salt-ghost','Send'); sg.type='button';
    sg.addEventListener('click', async function(){
      var t=String(si.value||'').trim();
      if(!t||sg.disabled) return;
      sg.disabled=true; var mine=ticket;
      var r=await api('/orders/'+o.id+'/say',{text:t});
      if(mine!==ticket) return;
      sg.disabled=false;
      if(!r.body.ok) tapSaid(o,'say',r.body.error||'It was not sent.');
      else { tapSaid(o,'say',''); if(draft.says) delete draft.says[o.id]; await loadOrders(); if(mine!==ticket) return; }
      drawOrder();
    });
    sayw.appendChild(si); sayw.appendChild(sg);
    if(!view) pane.appendChild(sayw);
    if(tk==='say') pane.appendChild(statusLine(tap.t));
    var hist=el('ul','hist');
    (o.history||[]).forEach(function(h){ var li=el('li',null,stamp(h.at)+'  '+(STATE_WORDS[h.status]||h.status)+(h.method?', paying by '+methodWord(h.method,h.account):'')+(h.note?': '+h.note:'')); hist.appendChild(li); });
    pane.appendChild(hist);
    return pane;
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
      var r=await api('/orders/'+encodeURIComponent(o.id)+'/method',{method:cur.method,account:cur.account||undefined});
      if(mine!==ticket) return;
      if(!r.body.ok) tapSaid(o,'pay',r.body.error||'The choice was not recorded.'); else { tapSaid(o,'pay',''); delete pick[o.id]; }
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
  async function refresh(){
    var before=JSON.stringify(orders);
    await loadOrders();
    if(JSON.stringify(orders)!==before) drawOrder();
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
    var id=wantOrder, pane=[].filter.call(pOrder.querySelectorAll('[data-order]'),function(x){ return x.getAttribute('data-order')===id; })[0];
    wantOrder='';
    try{ if(location.hash) history.replaceState(null,'',location.pathname+location.search); }catch(e){}
    if(!pane) return;
    showTab('order');
    /* clear of the sticky bar, which would otherwise sit over the order's state */
    var bw=document.getElementById('barw');
    try{ pane.style.scrollMarginTop=Math.ceil((bw&&!bw.hidden?bw.getBoundingClientRect().bottom:0)+12)+'px'; pane.scrollIntoView({block:'start'}); }catch(e){}
  }
  try{
    if(!OWNER&&'serviceWorker' in navigator&&navigator.serviceWorker.addEventListener)
      navigator.serviceWorker.addEventListener('message', async function(ev){
        var d=ev&&ev.data;
        if(!d||d.salt!=='news') return;
        wantOrder=orderIn('#o='+(d.order||''));
        if(!session) return;   /* at the door: it opens once they are in */
        var mine=ticket;
        await loadOrders();
        if(mine!==ticket) return;
        drawOrder();
      });
  }catch(e){ /* a browser that will not listen still opens the page */ }

  async function subscribePush(){
    var mine=ticket;
    try{
      var k=await (await fetch('/push/key',{cache:'no-store'})).json();
      if(!k.key||!k.configured){ draft.pushNote='Notifications are not switched on for this site yet.'; drawOrder(); return; }
      /* v693: THE ASK COMES FIRST. Registering a service worker before it meant a browser that
         refuses the registration never got as far as the question, and since every login now asks,
         that silence would be the ordinary case rather than the odd one. Nothing is installed on a
         phone whose reader says no. */
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
      if(r.body.ok){ draft.pushed=true; draft.pushDone=true; } else draft.pushNote=r.body.error||'The subscription was not recorded.';
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
    busy=true; go.disabled=true; say('Checking...','wait');
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
    var x=await unseal(body, ck, b);
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

  /* ---- ASKED ON EVERY LOGIN (v693, his instruction of 18 Sep 2026) ----------------------------
     The button in the order tab stays, for a reader who said no and changed their mind; this asks
     on the way in, which is when the answer is worth having. A browser that has already been
     answered is not asked again: permission is 'granted' or 'denied' by then, and only 'default'
     can raise the dialog at all. The owner's route never asks: those are not his phones. */
  function askPush(){
    if(OWNER||!session) return;
    try{
      var can=('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
      if(!can) return;
      /* S1 1.43, 24 SEP 2026: a phone already subscribed says On, where the pane read this page's own memory,
         which every sign-in empties. ON IS WHAT THE SITE HOLDS: with the answer already yes this subscribes again,
         which asks nothing and hands back the phone's own subscription, and names it to the site, so a phone that
         logged out is woken again and a record the site lost is put back; On is said only once the site has it. */
      if(Notification.permission==='default'||Notification.permission==='granted') subscribePush();
    }catch(e){ /* a browser that refuses to be asked is not a fault */ }
  }

  /* ---- OPENING A REMEMBERED DEVICE (v692) -----------------------------------------------------
     The token names the record and brings back the wrap; the key beside it in this browser opens
     it. A refusal, a stale token or a record that has gone simply falls through to the door. */
  var KEPT='Your account could not be opened just now. This phone is still remembered: try again in a moment.';
  async function openRemembered(keep){
    var rec=remGet();
    if(!rec||!rec.t||!rec.k||OWNER) return false;
    /* S3 3.5: reopening a lapse runs under the flow that met it, so it takes no ticket of its own and says nothing */
    var mine=keep?ticket:++ticket, stale=function(){ return mine!==ticket; };
    if(!keep) say('Opening...','wait');
    var r, body;
    try{
      r=await fetch('/remember/open', {method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({token:rec.t})});
      body=await r.json();
    }catch(e){ if(!stale()&&!keep) say(KEPT,'bad'); return false; }
    if(stale()) return false;
    /* S1 1.41, 24 SEP 2026: ONLY THE DOOR'S REFUSAL FORGETS THIS PHONE. A server fault forgot it too, so one
       bad minute on the site signed every returning phone out for good; that, and a dropped connection,
       now keep it and say so. */
    if(r.status===401){ remClear(); if(!keep) say(''); return false; }
    if(!r.ok||!body.ok){ if(!keep) say(KEPT,'bad'); return false; }
    var ck, b;
    try{
      ck=await unwrapUnder(b64d(rec.k), body.wrap);
      b=JSON.parse(await open(ck, body.env));
    }catch(e){ remClear(); if(!keep) say(''); return false; }
    if(stale()) return false;
    var x=await unseal(body, ck, b);
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
      var x=await unseal(r.body, ck, b);
      if(mine!==ticket) return;
      enter(user, {session:session}, b, x, ck, true);
      await loadOrders();
      if(mine!==ticket) return;
      drawOrder();
    }catch(e){ /* what is on screen stays, and the next return tries again */ }
    finally{ rereading=false; }
  }
  document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='visible') reread(); });
  window.addEventListener('pageshow', function(ev){ if(ev&&ev.persisted) reread(); });
  /* ---- ONE WAY IN (S3 3.3, 24 Sep 2026) ----------------------------------------------------------
     The password, a remembered phone and the link all hand back the same record: these open it with the
     content key and put the account on screen, so the roads cannot drift apart. unseal opens what sits
     beside the statement, enter draws the account, and follow starts its orders. */
  async function unseal(body, ck, b){
    var x={assoc:body.assoc===true, card:null, prices:null};
    if(body.live){
      try{ var l=JSON.parse(await open(ck, body.live));
        b.statements.unshift({issued:'now', label:'Now', live:true, at:l.at||body.live.at, body:l.body, owed:l.owed}); }
      catch(e){ /* the issued statements still open; the live one is simply absent */ }
    }
    if(body.card){ try{ x.card=JSON.parse(await open(ck, body.card)); }catch(e){ /* the statement still opens; the card is simply absent */ } }
    if(body.prices){ try{ x.prices=JSON.parse(await open(ck, body.prices)); }catch(e){ /* the statements still open; the list is simply absent */ } }
    return x;
  }
  function enter(u, body, b, x, ck, keep){
    say('');
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
        body:JSON.stringify({token:tok, peek:true})});
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
      var x=await unseal(body, ck, b);
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
      /* S3 3.5: a remembered phone draws "Opening your account" while it opens, so nobody starts typing into a door
         that is about to vanish; the door comes back only if it does not open */
      if(remGet()&&opening){ gate.hidden=true; opening.hidden=false; }
      var inNow=await openRemembered();
      if(inNow||session) return;
      if(opening) opening.hidden=true;
      /* S3 3.11: the saved app. A key in the address is the one Safari's Keep it on your Home Screen wrote there, and
         only the saved app itself spends it, never a Safari tab reloaded at that address */
      var carried=APP&&STANDALONE&&TOK_RE.test(hk);
      if(APP&&(IOS||carried)) showCode(false); else gate.hidden=false;
      if(carried) await openHandover({token:hk});
    })();
  }
})();
`;
