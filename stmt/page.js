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
import { STATEMENT_CSS } from "./statement-css.js";
import { PAY_SITE, PAY_ACCOUNTS } from "./pay.js";
import { OWNER_JS } from "./owner.js";

/* v692: THE THREE-MINUTE LOCK IS GONE (his instruction, 18 Sep 2026). It was a privacy lock for a
   phone left on a table; he asked for a page that stays signed in and a button that leaves. What
   replaced it is Remember me and Log out, which say what they do. */
export const POLL_MS = 10000;

const PAGE_CSS = `
/* hidden wins over every display rule below: the tab strip and the issue strip are flex */
[hidden]{display:none!important}
/* The gate, in the same material as the document behind it. One filled control, the
   brass-to-copper pill, because this is the one thing on the page that produces something;
   decision 5 of the identity. Everything else is a hairline or a word. */
.gate{max-width:440px;margin:10vh auto 0;padding:0 4px}
.gate h1{font-size:var(--salt-text-xl);margin:0 0 8px}
/* the level's mark: small, quiet, and never in the way of the price beside it (16 Sep 2026) */
.mark{margin-left:7px;font-size:0.72em;line-height:1;vertical-align:0.12em;opacity:0.85}
.gate p.lead{color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.75;margin:0 0 24px}
.lbl{display:block;font-size:var(--salt-text-xs);letter-spacing:.2em;text-transform:uppercase;
  color:var(--salt-copper);font-weight:700;margin:14px 0 6px;font-family:var(--salt-font-mono)}
/* a well is black 28%, decision 4 */
.fld{display:block;width:100%;min-height:var(--salt-tap);padding:13px 16px;
  font-size:16px;letter-spacing:.08em;font-family:var(--salt-font-mono);
  color:var(--salt-text);background:var(--salt-well);border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-sm);outline:none}
.fld::placeholder{color:var(--salt-mist)}
/* the username in two boxes and the password in four, one group of four symbols each (16 Sep 2026) */
.seg{display:flex;gap:8px}
.seg .fld{flex:1 1 0;min-width:0;padding:13px 4px;text-align:center;letter-spacing:.12em}
.fld:focus{border-color:var(--salt-brass);box-shadow:0 0 0 3px rgba(197,160,89,.16)}
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
/* on a brass button the mark takes the button's own ink: a brass cube on brass is no cube at all */
.seg button .psym{vertical-align:-0.28em;color:inherit}
.pwith{display:inline-flex;align-items:center;gap:7px}
/* read aloud, never drawn: the shape's word, so a mark in a sentence is not a hole */
.sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
/* v694: the order's own figures, typed in the same well as everything else */
.amt{display:flex;gap:8px;align-items:center;margin-top:10px}
.amt .fld{flex:1 1 0;min-width:0;text-align:right}
.amt .cur{font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);color:var(--salt-mist)}
/* the confirmation, one plain list of what is about to be ordered */
.conf{margin:10px 0 0;padding:0;list-style:none;font-family:var(--salt-font-mono);font-size:var(--salt-text-sm)}
.conf li{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--salt-line)}
.conf li:last-child{border-bottom:0}
.conf .k{color:var(--salt-mist)}
.conf .v{color:var(--salt-text);text-align:right}
.btn{margin-top:18px;width:100%;min-height:var(--salt-tap);padding:13px 16px;
  font-family:var(--salt-font-mono);font-size:var(--salt-text-md);font-weight:700;cursor:pointer;
  letter-spacing:.04em;color:var(--salt-obsidian);background:var(--salt-gradient);border:0;
  border-radius:var(--salt-radius-pill)}
.btn[disabled]{opacity:.5;cursor:default}
.btn.quiet{background:none;color:var(--salt-text);border:1px solid var(--salt-line);font-weight:400}
.btn.lnk{display:block;text-align:center;text-decoration:none;line-height:1.4}
/* KEEP IT ON YOUR PHONE (v693): the quietest block on the door, under everything, and gone the
   moment the page is running as an app. */
.inst{margin-top:26px;padding-top:16px;border-top:1px solid var(--salt-line)}
.inst h2{margin:0 0 8px;font-size:var(--salt-text-xs);letter-spacing:.2em;text-transform:uppercase;
  color:var(--salt-copper);font-family:var(--salt-font-mono);font-weight:700}
.inst ol{margin:0;padding-left:20px;color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.8}
.inst b{color:var(--salt-text);font-weight:600}
/* REMEMBER ME (v692): a checkbox on the door, at the tap size everything else here is */
.rem{display:flex;align-items:center;gap:10px;margin-top:16px;min-height:var(--salt-tap);
  font-size:var(--salt-text-sm);color:var(--salt-text-muted);cursor:pointer}
.rem input{width:18px;height:18px;accent-color:var(--salt-brass);cursor:pointer}
.msg{margin:16px 0 0;font-size:var(--salt-text-sm);line-height:1.6;min-height:1.4em;
  color:var(--salt-text-muted)}
.msg.bad{color:var(--salt-ember)}
.msg.wait{color:var(--salt-text-muted)}
/* a veil is obsidian 86%, decision 4 */
.bar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;
  gap:12px;padding:11px 16px;margin:0 auto 14px;max-width:620px;
  background:var(--salt-veil);border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);
  backdrop-filter:blur(10px);font-size:var(--salt-text-sm);color:var(--salt-text-muted);
  font-family:var(--salt-font-mono)}
.bar b{color:var(--salt-text);font-variant-numeric:tabular-nums}
.bar button{font:inherit;color:var(--salt-brass);background:none;border:0;cursor:pointer;
  padding:0;text-decoration:underline;min-height:auto}
/* THE THREE TABS: statements, prices, order. The same pill vocabulary as the issue strip, one
   step larger because these are destinations rather than dates. */
.tabs{max-width:620px;margin:0 auto 18px;display:flex;gap:8px}
.tabs button{flex:1;min-height:var(--salt-tap);font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);
  letter-spacing:.06em;color:var(--salt-text-muted);background:none;border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-pill);padding:9px 10px;cursor:pointer}
.tabs button.on{color:var(--salt-obsidian);background:var(--salt-brass);border-color:var(--salt-brass);font-weight:700}
.panel{max-width:620px;margin:0 auto}
.panel h2{font-size:var(--salt-text-lg);margin:0 0 4px}
.panel p.lead{color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.7;margin:0 0 18px}
/* THE ISSUES, as a strip of dates. The current one leads; the rest are the record. A pill is
   a word in mono with a hairline, and the chosen one is brass: no filled badge. */
.mos{max-width:620px;margin:0 auto 22px;display:flex;flex-wrap:wrap;gap:8px}
.mos button{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.06em;
  color:var(--salt-text-muted);background:none;border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-pill);padding:7px 12px;cursor:pointer;min-height:auto}
.mos button.on{color:var(--salt-obsidian);background:var(--salt-brass);border-color:var(--salt-brass);
  font-weight:700}
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
.state{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.14em;text-transform:uppercase;font-weight:700}
.state.placed,.state.acknowledged{color:var(--salt-steel)}
.state.ready{color:var(--salt-brass)}
.state.done{color:var(--salt-verdigris)}
.state.declined,.state.cancelled{color:var(--salt-mist)}
.quote{font-family:var(--salt-font-mono);font-size:var(--salt-text-xl);color:var(--salt-text);margin:8px 0 2px;font-variant-numeric:tabular-nums}
.row2{display:flex;gap:8px}
.row2 .fld{flex:1}
.seg{display:flex;gap:8px;margin-top:6px}
.seg button{flex:1;min-height:var(--salt-tap);font-family:var(--salt-font-mono);font-size:var(--salt-text-sm);
  color:var(--salt-text-muted);background:none;border:1px solid var(--salt-line);border-radius:var(--salt-radius-pill);cursor:pointer}
.seg button.on{color:var(--salt-obsidian);background:var(--salt-brass);border-color:var(--salt-brass);font-weight:700}
.pay{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.pay label{display:flex;gap:10px;align-items:center;min-height:var(--salt-tap);padding:0 6px;font-size:var(--salt-text-sm);cursor:pointer}
.pay input{width:18px;height:18px;accent-color:var(--salt-brass)}
.hist{margin:10px 0 0;padding:0;list-style:none;font-size:var(--salt-text-xs);color:var(--salt-text-muted);font-family:var(--salt-font-mono);line-height:1.8}
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
  oil: 'M12 2.4 C12 2.4 19.2 10.6 19.2 15 A7.2 7.2 0 0 1 4.8 15 C4.8 10.6 12 2.4 12 2.4 Z'
};
const RING = 'M12 4.2 A7.8 7.8 0 1 1 11.99 4.2 Z';
/* A CONTROL STILL NEEDS A NAME, and the name is the SHAPE, never the product. A button holding
   only a decorative mark is unusable with a screen reader; an aria-label naming the product would
   put the word back for exactly the readers who cannot see that it was taken away. The shape is
   what is on the screen, so saying it aloud gives away no more than looking does. */
export const PSHAPE = { salt: "Cube", oil: "Droplet", _: "Ring" };
/** The mark for a product, as SVG source. `px` is the drawn size; the stroke stays hairline. */
export function psymSvg(product, px) {
  const d = PSYM[String(product || "").toLowerCase()] || RING;
  return '<svg class="psym" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" aria-hidden="true" focusable="false">'
    + '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

export function boardPage(guest, nonce) {
  const b = (guest && guest.prices) || {};
  const products = Array.isArray(b.products) ? b.products : [];
  const week = (b.week && b.week.label) || "";
  const rm = (n) => "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const body = products.length
    ? products.map((p) => '<div class="pane">'
        + '<h3 class="pmark" aria-label="' + esc(PSHAPE[p.product] || PSHAPE._) + '">' + psymSvg(p.product, 30) + "</h3>"
        + '<p class="sub2">' + esc(p.tierName || "")
          + (p.fellBack ? ", the only price for this product" : "")
          + "</p>"
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
    + '<style nonce="' + nonce + '">' + STATEMENT_CSS + PAGE_CSS + "</style></head><body>"
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
export function landingPage(user, nonce, owner) {
  const u = esc(user || "");
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + '<meta name="referrer" content="no-referrer">'
    /* v693: saved as an app. The name and the icon say what the page is and never whose it is. */
    + '<link rel="manifest" href="/manifest.webmanifest">'
    + '<link rel="apple-touch-icon" href="/icon.png">'
    + '<meta name="theme-color" content="#05080a">'
    + '<meta name="apple-mobile-web-app-capable" content="yes">'
    + '<meta name="mobile-web-app-capable" content="yes">'
    + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
    + '<meta name="apple-mobile-web-app-title" content="Order Salt">'
    + "<title>Order Salt</title>"
    + '<style nonce="' + nonce + '">' + STATEMENT_CSS + PAGE_CSS + "</style></head><body>"
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
        + '<input class="fld" id="rq" type="text" autocapitalize="none" autocorrect="off" '
        + 'spellcheck="false" placeholder="filter" aria-label="Filter accounts">'
        + '<div id="rlist" class="rlist"></div>'
        + "</div>"
        + '<div id="oSend" hidden>'
        + '<button type="button" data-back>' + "← Back" + "</button>"
        + "<h1>Send statement</h1>"
        + '<p class="lead" id="scount"></p>'
        + '<input class="fld" id="sq" type="text" autocapitalize="none" autocorrect="off" '
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
        + '<input class="fld" id="gintro" type="text" maxlength="20" autocapitalize="off" '
        + 'spellcheck="false" placeholder="their username" aria-label="The username of the customer introducing them">'
        + '<label class="lbl" for="glabel">Who it is for</label>'
        + '<input class="fld" id="glabel" type="text" maxlength="60" '
        + 'placeholder="a shop, a name, a note" aria-label="Who the link is for">'
        + '<button class="btn" type="button" id="gmake">Make a link</button>'
        + '<div id="glist"></div>'
        + "</div>"
        + '<p class="msg" id="rmsg" role="status" aria-live="polite"></p></div>'
      : "")
    + '<div id="gate" class="gate"' + (owner ? " hidden" : "") + ">"
    + "<h1>Statement of account</h1>"
    + '<p class="lead">Sign in with the username and password sent to you. '
    + "Tick Remember me and this device stays signed in; Log out ends it.</p>"
    + '<form id="f" autocomplete="off">'
    + '<span class="lbl" id="unl">Username</span>'
    + boxes("un", 2, "text", "Username")
    + '<input type="hidden" id="un" value="' + u + '">'
    + '<span class="lbl" id="pwl">Password</span>'
    + boxes("pw", 4, "password", "Password")
    + '<input type="hidden" id="pw">'
    /* v692: Remember me, and the button says what it does */
    + '<label class="rem" for="rem"><input type="checkbox" id="rem" checked>'
    + "<span>Remember me on this device</span></label>"
    + '<button class="btn" id="go" type="submit">Log in</button>'
    + "</form>"
    + '<p class="msg" id="msg" role="status" aria-live="polite"></p>'
    /* v693: how to keep it as an app, on the door where a first-time reader is, and hidden once
       the page is running as one. Three steps, the two phones, and nothing to tap. */
    + '<div class="inst" id="inst" hidden>'
    + "<h2>Keep it on your phone</h2>"
    + '<p class="sub2">It is saved as <b>Order Salt</b>, and opens straight here.</p>'
    + '<ol><li><b>iPhone:</b> tap Share, then Add to Home Screen, then Add.</li>'
    + "<li><b>Android:</b> tap the three dots, then Install app or Add to Home screen.</li>"
    + "<li>Open it from that icon after this. It signs you in and tells you when an order moves.</li></ol>"
    + "</div>"
    + "</div>"
    + '<div id="barw" hidden><div class="bar">'
    + '<span><b id="whoacct"></b><span id="cd"></span></span>'
    + '<button type="button" id="lock">Log out</button>'
    + "</div></div>"
    + '<div id="tabs" class="tabs" role="tablist" hidden>'
    + '<button type="button" data-t="stmt" class="on">Statements</button>'
    + '<button type="button" data-t="prices">Prices</button>'
    + '<button type="button" data-t="order">Order</button>'
    + "</div>"
    + '<div id="pStmt"><div id="mos" class="mos" hidden></div>'
    + '<div id="mfil" class="mos mfil" hidden></div><p class="mfnote" id="mfnote"></p>'
    + '<div id="out"></div></div>'
    + '<div id="pPrices" class="panel" hidden></div>'
    + '<div id="pOrder" class="panel" hidden></div>'
    + '<script nonce="' + nonce + '">'
    + CLIENT_JS.replace(/__POLL__/g, String(POLL_MS))
      .replace("__PAY_SITE__", JSON.stringify(PAY_SITE)).replace("__PAY_ACCOUNTS__", JSON.stringify(PAY_ACCOUNTS))
      /* v695: the product marks, so the page can draw one wherever it would have written a name */
      .replace("__PSYM__", JSON.stringify(Object.assign({ _: RING }, PSYM)))
      .replace("__PSHAPE__", JSON.stringify(PSHAPE))
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

/* One box per group of four symbols, the hidden field beside them carrying the joined value. */
function boxes(id, n, type, label) {
  let out = '<div class="seg" data-for="' + id + '" role="group" aria-labelledby="' + id + 'l">';
  for (let i = 1; i <= n; i++) {
    out += '<input class="fld" type="' + type + '" inputmode="text" autocapitalize="none" autocorrect="off" '
      + 'spellcheck="false" autocomplete="off" placeholder="xxxx" aria-label="' + label + ', part ' + i + ' of ' + n + '">';
  }
  return out + "</div>";
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
  var PAY_SITE=__PAY_SITE__, PAY=__PAY_ACCOUNTS__;
  var session='', user='', prices=null, orders=[], poll=null, tab='stmt', draft={}, pick={};
  /* null for a customer; {master,accounts} for the owner, on the Access-gated route only */
  var OWNER=__OWNER__;
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
      pOrder=document.getElementById('pOrder');
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

  /* TWO BOXES FOR THE USERNAME AND FOUR FOR THE PASSWORD (his instruction, 16 Sep 2026), one group of
     four symbols in each, as they are sent. A box that fills moves the cursor to the next, the last
     username box to the first password box; Backspace in an empty box steps back and takes the symbol
     before. A paste is spread across the boxes from the one it lands in, or from the first when it is
     the whole username or password; an autofill or a keyboard suggestion that puts more than four in
     one box is spread the same way. Only letters and digits are kept, in lower case, so hyphens, spaces
     and capitals in a pasted value are forgiven as they were. The joined value goes into the hidden #un
     and #pw the form reads, which is also what the owner's roster fills with the master passphrase; the
     master can no longer be typed at this door, and /all opens every account. */
  var SEG=[].slice.call(document.querySelectorAll('.seg input'));
  function idOf(b){ return b.parentNode.getAttribute('data-for'); }
  function boxesOf(id){ return SEG.filter(function(x){ return idOf(x)===id; }); }
  function group(b){ return boxesOf(idOf(b)); }
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
  function sync(b){
    var parts=group(b).map(function(x){ return x.value; });
    document.getElementById(idOf(b)).value=parts.join('')?parts.join('-'):'';
  }
  function toEnd(b){ try{ b.focus(); var n=b.value.length; b.setSelectionRange(n,n); }catch(e){} }
  /* raw is laid into the boxes from bs[i] on, four to a box; the box after the last full one takes the cursor */
  function put(bs, i, raw){
    for(var k=i;k<bs.length;k++) bs[k].value=raw.slice((k-i)*4,(k-i+1)*4);
    sync(bs[0]);
    var last=bs[Math.min(bs.length-1, i+Math.max(0,Math.ceil(raw.length/4)-1))];
    var nx=last.value.length===4&&SEG[SEG.indexOf(last)+1];
    toEnd(nx||last);
  }
  function typed(ev){
    var b=ev.target, bs=group(b), i=bs.indexOf(b), raw=clean(b.value);
    if(raw.length<=4){
      b.value=raw; sync(b);
      if(raw.length===4&&ev.type==='input'){ var nx=SEG[SEG.indexOf(b)+1]; if(nx) toEnd(nx); }
      return;
    }
    if(raw.length>=bs.length*4){ put(bs, 0, raw); return; }
    put(bs, i, raw+bs.slice(i+1).map(function(x){ return x.value; }).join(''));
  }
  SEG.forEach(function(b){
    b.addEventListener('input', typed);
    b.addEventListener('change', typed);
    b.addEventListener('paste', function(ev){
      var cd=ev.clipboardData||window.clipboardData, raw=clean(cd&&cd.getData('text'));
      if(!raw) return;
      ev.preventDefault();
      var bs=group(b);
      put(bs, raw.length>=bs.length*4?0:bs.indexOf(b), raw);
    });
    b.addEventListener('keydown', function(ev){
      if(ev.key!=='Backspace'||b.value) return;
      var pv=SEG[SEG.indexOf(b)-1]; if(!pv) return;
      ev.preventDefault();
      pv.value=pv.value.slice(0,-1); sync(pv); toEnd(pv);
    });
  });
  function firstEmpty(id){
    var bs=boxesOf(id);
    for(var i=0;i<bs.length;i++) if(bs[i].value.length<4) return bs[i];
    return bs[bs.length-1];
  }
  /* a username from the QR arrives in the hidden field; it is shown in its boxes */
  if(clean(un.value)) put(boxesOf('un'), 0, clean(un.value));
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
  function stamp(iso){
    try{ return new Date(iso).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',
      hour:'2-digit',minute:'2-digit',hour12:false}); }catch(e){ return ''; }
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
    return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['decrypt']);
  }
  async function remember(u, ck){
    if(!session) return;
    try{
      var key=crypto.getRandomValues(new Uint8Array(32));
      var wrap=await wrapUnder(key, ck);
      var r=await fetch('/remember', {method:'POST',
        headers:{'content-type':'application/json','X-Stmt-Session':session}, body:JSON.stringify({wrap:wrap})});
      var j=await r.json();
      if(r.ok&&j.ok&&j.token) remSet({t:j.token, k:b64e(key), u:u});
    }catch(e){ /* not remembered; the password still opens it */ }
  }

  function lock(){
    ticket++; busy=false; go.disabled=false;
    if(poll){ clearInterval(poll); poll=null; }
    bundle=null; session=''; prices=null; orders=[]; draft={}; pick={};
    out.textContent=''; mos.textContent=''; mos.hidden=true;
    mfil.textContent=''; mfil.hidden=true; mfPick=null;
    var mfn=document.getElementById('mfnote'); if(mfn) mfn.textContent='';
    pPrices.textContent=''; pOrder.textContent='';
    tabs.hidden=true; barw.hidden=true;
    /* the owner goes back to his list, never to a password field he has no password for */
    if(OWNER){ roster.hidden=false; gate.hidden=true; if(whoacct) whoacct.textContent=''; }
    else gate.hidden=false;
    showTab('stmt');
    pw.value=''; boxesOf('pw').forEach(function(x){ x.value=''; });
    if(cd) cd.textContent='';
    say(OWNER?'Signed out. Tap an account to open it again.':'Signed out. Sign in again when you want it.');
    try{ (OWNER?rq:firstEmpty('pw')).focus(); }catch(e){}
  }
  /* v692: LOGGING OUT IS A DEPARTURE, NOT A TIMER. It drops the session and the remembered wrap on
     the site as well as everything this page holds, so a phone handed on is a phone signed out. */
  async function logOut(){
    var tok=(remGet()||{}).t||null, s=session;
    remClear();
    lock();
    if(s){
      try{ await fetch('/logout', {method:'POST', headers:{'content-type':'application/json','X-Stmt-Session':s},
        body:JSON.stringify({token:tok})}); }catch(e){ /* the page has forgotten it either way */ }
    }
  }
  document.getElementById('lock').addEventListener('click', logOut);

  /* ---- the three tabs ---- */
  function showTab(t){
    tab=t;
    var bs=tabs.querySelectorAll('button');
    for(var i=0;i<bs.length;i++) bs[i].className=(bs[i].getAttribute('data-t')===t?'on':'');
    pStmt.hidden=(t!=='stmt'); pPrices.hidden=(t!=='prices'); pOrder.hidden=(t!=='order');
    window.scrollTo(0,0);
  }
  tabs.addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-t]'); if(b) showTab(b.getAttribute('data-t'));
  });

  function pickStmt(i){
    if(!bundle) return;
    at=i; out.innerHTML=bundle.statements[i].body;
    var bs=mos.querySelectorAll('button');
    for(var k=0;k<bs.length;k++) bs[k].className=(k===i?'on':'');
    drawMonths();
    window.scrollTo(0,0);
  }

  /* ---- THE MONTH FILTER (v690, his instruction of 18 Sep 2026) -------------------------------
     THE STATEMENT IS NOT BOUND TO A MONTH ANY MORE: it carries every order from the start, and
     this filters it. The newest month opens, because that is what a reader has come for, and All
     is one tap away. Each row says which month it belongs to; an undated row belongs to none and
     shows whatever is chosen. What the account stands at is the account's, so the totals under the
     table do not move with the filter, and the line above says so. */
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
    mfPick=months[0];
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
    pickStmt(0);
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
    var soon=(prices&&prices.soon)||[];
    if(!prices||((!prices.products||!prices.products.length)&&!soon.length)){
      pPrices.appendChild(el('p','lead','No price list has been written for your account yet. It is written with the next update and changes weekly.'));
      return;
    }
    pPrices.appendChild(el('p','lead','For the week of '+(prices.week&&prices.week.label||'')+'. The price is for the goods; if you ask for delivery, the charge is added when the order is marked ready and you see it then. The list is written from your own history and changes weekly.'));
    if(prices.since) pPrices.appendChild(el('p','sub2','Buying with us since '+monthOf(prices.since)+'.'));
    prices.products.forEach(function(p){
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
      pane.appendChild(el('p','sub2', p.basis==='yours'
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
  async function api(path, body, method){
    var r=await fetch(path,{method:method||(body?'POST':'GET'), cache:'no-store',
      headers:Object.assign({'X-Stmt-Session':session}, body?{'content-type':'application/json'}:{}),
      body:body?JSON.stringify(body):undefined});
    var j=null; try{ j=await r.json(); }catch(e){}
    return {status:r.status, body:j||{}};
  }
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
    pOrder.textContent='';
    pOrder.appendChild(el('h2',null,'Order'));
    if(!prices||!prices.products||!prices.products.length){
      pOrder.appendChild(el('p','lead',prices&&prices.soon&&prices.soon.length?'Ordering opens once your prices are set.':'Ordering opens once your price list is written, with the next update.'));
    } else {
      pOrder.appendChild(el('p','lead','Pick a size off your list and check it over before you place it. Once it is acknowledged you can pay, and you are told when the goods are on their way.'));
      var form=el('div','pane');
      if(!draft.product) draft.product=prices.products[0].product;
      var P=prices.products.filter(function(x){return x.product===draft.product;})[0]||prices.products[0];
      if(!draft.q||!P.sizes.some(function(x){return String(x.q)===String(draft.q);})) draft.q=P.sizes[0].q;
      if(!draft.mode) draft.mode='collect';
      /* v695: the product was a dropdown, and an option carries text and nothing else, so a mark
         could not go in one. Two products are a segment anyway, which is one tap rather than two. */
      if(prices.products.length>1){
        var pseg=el('div','seg');
        prices.products.forEach(function(x){
          var b=el('button',x.product===draft.product?'on':''); b.type='button';
          b.setAttribute('aria-label',pshape(x.product));
          b.setAttribute('aria-pressed',x.product===draft.product?'true':'false');
          b.appendChild(psym(x.product,22));
          b.addEventListener('click',function(){ draft.product=x.product; draft.q=null; draft.confirm=false; drawOrder(); });
          pseg.appendChild(b);
        });
        form.appendChild(pseg);
      }
      var sq=el('select','fld'); sq.setAttribute('aria-label','Size');
      P.sizes.forEach(function(x){ var o=el('option',null,unitsOf(x.q,P.unit)); o.value=String(x.q); if(String(x.q)===String(draft.q))o.selected=true; sq.appendChild(o); });
      sq.addEventListener('change',function(){ draft.q=sq.value; drawOrder(); });
      form.appendChild(sq);
      var seg=el('div','seg');
      [['collect','I will collect'],['deliver','Deliver to me']].forEach(function(m){
        var b=el('button',draft.mode===m[0]?'on':'',m[1]); b.type='button';
        b.addEventListener('click',function(){ draft.mode=m[0]; drawOrder(); }); seg.appendChild(b);
      });
      form.appendChild(seg);
      /* v694: a delivery says roughly where it is going, in his words a general location. It tells
         him which way to drive and what to charge; it is not an address and is not asked for one. */
      if(draft.mode==='deliver'){
        form.appendChild(el('span','lbl','Where to'));
        var pl=el('input','fld'); pl.type='text'; pl.maxLength=60; pl.value=draft.place||'';
        pl.placeholder='a neighbourhood or a landmark'; pl.setAttribute('aria-label','Roughly where it is going');
        pl.addEventListener('input',function(){ draft.place=pl.value; var b=document.getElementById('oGo'); if(b)b.disabled=!quoteFor()||!!draft.busy||pl.value.trim().length<2; });
        form.appendChild(pl);
        form.appendChild(el('div','sub2','A neighbourhood is enough. The delivery charge is set when the order is acknowledged, and you see it here before you pay.'));
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
        rows.forEach(function(r){ var li=el('li'); li.appendChild(el('span','k',r[0]));
          var v=el('span','v'); if(typeof r[1]==='string') v.textContent=r[1]; else v.appendChild(r[1]);
          li.appendChild(v); ul.appendChild(li); });
        cf.appendChild(ul);
        var ok2=el('button','btn','Place this order'); ok2.type='button'; ok2.disabled=!!draft.busy;
        ok2.addEventListener('click', async function(){
          if(draft.busy) return; draft.busy=true; drawOrder();
          var mine=ticket;
          var r=await api('/orders',{product:P.product,qty:qt.q,mode:draft.mode,unit:qt.unit,total:qt.total,
            place:draft.mode==='deliver'?draft.place.trim():'',week:(prices.week&&prices.week.monday)||''});
          if(mine!==ticket) return;
          draft.busy=false;
          if(r.status===401){ draft.note='Your session has ended. Sign in again to order.'; }
          else if(!r.body.ok){ draft.note=r.body.error||'The order was not placed.'; }
          else { draft.note='Placed. You will see it acknowledged below.'; draft.confirm=false; draft.place=''; await loadOrders(); if(mine!==ticket) return; }
          drawOrder();
        });
        cf.appendChild(ok2);
        var back=el('button','btn quiet','Change it'); back.type='button'; back.disabled=!!draft.busy;
        back.addEventListener('click',function(){ draft.confirm=false; drawOrder(); });
        cf.appendChild(back);
        form.appendChild(cf);
      } else {
        var go2=el('button','btn','Review this order'); go2.type='button'; go2.id='oGo'; go2.disabled=!ready;
        go2.addEventListener('click',function(){ draft.confirm=true; draft.note=''; drawOrder(); });
        form.appendChild(go2);
      }
      if(draft.note) form.appendChild(el('p','msg',draft.note));
      pOrder.appendChild(form);
    }
    /* notifications: a wake on the phone when the order moves, so the page need not stay open */
    var np=el('div','pane');
    np.appendChild(el('h3',null,'Notifications'));
    var canPush=('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
    if(!canPush){
      np.appendChild(el('p','sub2','This browser cannot receive notifications. On an iPhone, add this page to the Home Screen from the Share menu and open it from there; otherwise keep the page open and it checks every ten seconds.'));
    } else if(draft.pushed||Notification.permission==='granted'&&draft.pushDone){
      np.appendChild(el('p','sub2','On. You will be told when your order is acknowledged, ready, or completed.'));
    } else {
      np.appendChild(el('p','sub2','Be told on this phone when your order is acknowledged, ready for collection or delivery, and completed. The banner names no amount and no order; the page does.'));
      var nb=el('button','btn quiet','Notify me on this phone'); nb.type='button';
      nb.addEventListener('click', subscribePush); np.appendChild(nb);
      if(draft.pushNote) np.appendChild(el('p','msg',draft.pushNote));
    }
    pOrder.appendChild(np);
    var h=el('h2',null,'Your orders'); h.style.marginTop='18px'; pOrder.appendChild(h);
    if(!orders.length) pOrder.appendChild(el('p','lead','None yet.'));
    orders.forEach(function(o){ pOrder.appendChild(orderPane(o)); });
    window.scrollTo(0,sc);
  }

  var STATE_WORDS={placed:'Placed', acknowledged:'Acknowledged', ready:'Ready', done:'Completed', declined:'Declined', cancelled:'Withdrawn'};
  /* v694: money and goods are two tracks, so what is still owed and what is still to come are read
     off the order, never off a single word of state. Both figures are the ones the desk holds. */
  function dueOf(o){ return +((o.total+(+o.delivery||0))-(+o.paid||0)).toFixed(2); }
  function heldUnpaid(exceptId){ return orders.some(function(o){ return o.id!==exceptId&&['cancelled','declined'].indexOf(o.status)<0&&(+o.moved||0)>0&&dueOf(o)>0.004; }); }
  function orderPane(o){
    var pane=el('div','pane');
    var P=prices&&prices.products&&prices.products.filter(function(x){return x.product===o.product;})[0];
    var unit=P?P.unit:'unit';
    var due=dueOf(o), moved=+o.moved||0, paid=+o.paid||0, payable=['acknowledged','ready'].indexOf(o.status)>=0;
    pane.appendChild(el('div','state '+o.status, STATE_WORDS[o.status]||o.status));
    pane.appendChild(el('div','quote', rm(o.total+(o.delivery||0))));
    if(o.delivery>0) pane.appendChild(el('div','sub2', rm(o.total)+' for the goods and '+rm(o.delivery)+' delivery'));
    var line2=el('div','sub2');
    line2.appendChild(withMark(o.product,unitsOf(o.qty,unit)+' ',18));
    line2.appendChild(document.createTextNode(', '+(o.mode==='deliver'?'to be delivered':'to collect')
      +(o.place?' to '+o.place:'')+', placed '+stamp(o.at)));
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
    if(payable&&due>0.004) pane.appendChild((o.method&&!(pick[o.id]||{}).again)?payBox(o):payChooser(o));
    /* v694: either side may withdraw at any stage until the goods move (his rule, 18 Sep 2026) */
    if(payable||o.status==='placed'){
      if(moved>0) pane.appendChild(el('p','sub2','The goods are with you, so this can no longer be withdrawn here.'));
      else {
        var wb=el('button','btn quiet','Withdraw this order'); wb.type='button';
        wb.addEventListener('click', async function(){
          if(!confirm(paid>0?'Withdraw this order? The '+rm(paid)+' you paid is refunded.':'Withdraw this order?')) return;
          var mine=ticket; var r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{});
          if(mine!==ticket) return;
          if(!r.body.ok) draft.note=r.body.error||'It could not be withdrawn.';
          await loadOrders(); if(mine!==ticket) return; drawOrder();
        });
        pane.appendChild(wb);
      }
    }
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
    var cur=pick[o.id]||{}, noCod=heldUnpaid(o.id);
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
      var sel=el('select','fld'); sel.setAttribute('aria-label','Account');
      var o0=el('option',null,cur.method==='jompay'?'Choose the biller':'Choose the bank or e-wallet'); o0.value=''; sel.appendChild(o0);
      accountsFor(cur.method).forEach(function(a){ var op=el('option',null,a.name+(a.bank&&a.bank!==a.name?' ('+a.bank+')':'')); op.value=a.key; if(cur.account===a.key)op.selected=true; sel.appendChild(op); });
      sel.addEventListener('change',function(){ pick[o.id].account=sel.value; drawOrder(); });
      box.appendChild(sel);
    }
    if(noCod) box.appendChild(el('p','sub2','Cash on handover is not offered while goods you already hold are unpaid. Settle those first and it comes back.'));
    var ok=cur.method&&(cur.method==='cod'||cur.method==='tngbiz'||cur.account);
    var cb=el('button','btn','Confirm'); cb.type='button'; cb.disabled=!ok;
    cb.addEventListener('click', async function(){
      if(!ok) return; var mine=ticket;
      var r=await api('/orders/'+encodeURIComponent(o.id)+'/method',{method:cur.method,account:cur.account||undefined});
      if(mine!==ticket) return;
      if(!r.body.ok) draft.note=r.body.error||'The choice was not recorded.'; else delete pick[o.id];
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
    var row=el('div','amt');
    row.appendChild(el('span','cur','RM'));
    var inp=el('input','fld'); inp.type='number'; inp.min='0'; inp.step='0.01'; inp.inputMode='decimal';
    inp.value=(cur.amount!==undefined&&cur.amount!==null)?cur.amount:due.toFixed(2);
    inp.setAttribute('aria-label','What you paid, in ringgit');
    inp.addEventListener('input',function(){ pick[o.id]=Object.assign({},pick[o.id],{amount:inp.value}); var b=document.getElementById('pd-'+o.id); if(b)b.disabled=!(parseFloat(inp.value)>0); });
    row.appendChild(inp); box.appendChild(row);
    var pb=el('button','btn',"I have paid"); pb.type='button'; pb.id='pd-'+o.id;
    pb.disabled=!(parseFloat(inp.value)>0);
    pb.addEventListener('click', async function(){
      var amt=parseFloat(inp.value);
      if(!(amt>0)) return;
      pb.disabled=true; var mine=ticket;
      var r=await api('/orders/'+encodeURIComponent(o.id)+'/pay',{amount:+amt.toFixed(2)});
      if(mine!==ticket) return;
      draft.note=r.body&&r.body.ok?'Recorded. It shows on your statement once it is folded into the book.':((r.body&&r.body.error)||'That payment was not recorded.');
      delete pick[o.id];
      await loadOrders(); if(mine!==ticket) return; drawOrder();
    });
    box.appendChild(pb);
    box.appendChild(el('p','sub2','Tell us once it has left your side. '+rm(due)+' is outstanding; a part payment is fine and the rest stays here.'));
    var ch=el('button','btn quiet','Pay another way'); ch.type='button';
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
      var l=el('a','btn lnk','Open '+(a?a.name:'the account')+' in QR Command');
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
    if(r.status===401){ if(poll){clearInterval(poll);poll=null;} draft.note='Your session has ended; lock and sign in again to follow your order.'; return; }
    if(r.body.ok) orders=r.body.orders||[];
  }
  async function refresh(){
    var before=JSON.stringify(orders);
    await loadOrders();
    if(JSON.stringify(orders)!==before) drawOrder();
  }

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
      var reg=await navigator.serviceWorker.register('/sw.js?u='+encodeURIComponent(user));
      var raw=atob(k.key.replace(/-/g,'+').replace(/_/g,'/')), key=new Uint8Array(raw.length);
      for(var i=0;i<raw.length;i++) key[i]=raw.charCodeAt(i);
      var sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:key});
      if(mine!==ticket) return;
      var r=await api('/push/subscribe',{endpoint:sub.endpoint});
      if(mine!==ticket) return;
      if(r.body.ok){ draft.pushed=true; draft.pushDone=true; } else draft.pushNote=r.body.error||'The subscription was not recorded.';
    }catch(e){ draft.pushNote='Notifications could not be set up here: '+((e&&e.message)||e); }
    drawOrder();
  }

  document.getElementById('f').addEventListener('submit', async function(ev){
    ev.preventDefault();
    var u=norm(un.value), pass=pw.value.trim();
    if(!u){ say('Enter your username: two groups of four.','bad'); try{firstEmpty('un').focus();}catch(e){} return; }
    if(!pass){ say('Enter the password sent to you.','bad'); try{firstEmpty('pw').focus();}catch(e){} return; }
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
        headers:{'content-type':'application/json'}, body:JSON.stringify({u:u, password:pass, master:pass})});
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
    if(!b||!b.statements||!b.statements.length){ done(); say('The statement could not be read. Ask for it to be re-issued.','bad'); return; }
    if(body.live){
      try{ var l=JSON.parse(await open(ck, body.live));
        if(stale()) return;
        b.statements.unshift({issued:'now', label:'Now', live:true, at:l.at||body.live.at, body:l.body}); }
      catch(e){ /* the issued statements still open; the live one is simply absent */ }
    }
    prices=null;
    if(body.prices){
      try{ prices=JSON.parse(await open(ck, body.prices)); if(stale()) return; }
      catch(e){ prices=null; /* the statements still open; the list is simply absent */ }
    }
    if(stale()) return;
    done();
    say('');
    user=u; session=body.session||''; orders=[]; draft={}; pick={};
    show(b);
    drawPrices();
    if(session){ await loadOrders(); if(stale()) return; if(poll)clearInterval(poll); poll=setInterval(refresh, POLL_MS); }
    drawOrder();
    /* v692: remembered only on a customer's own sign-in, and only when asked. The owner's route
       opens accounts with the master and must leave nothing behind on his phone. */
    var rem=document.getElementById('rem');
    if(!OWNER && rem && rem.checked) await remember(u, ck);
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
      if(!can||Notification.permission!=='default') return;
      subscribePush();
    }catch(e){ /* a browser that refuses to be asked is not a fault */ }
  }

  /* ---- OPENING A REMEMBERED DEVICE (v692) -----------------------------------------------------
     The token names the record and brings back the wrap; the key beside it in this browser opens
     it. A refusal, a stale token or a record that has gone simply falls through to the door. */
  async function openRemembered(){
    var rec=remGet();
    if(!rec||!rec.t||!rec.k||OWNER) return false;
    var mine=++ticket, stale=function(){ return mine!==ticket; };
    say('Opening...','wait');
    var r, body;
    try{
      r=await fetch('/remember/open', {method:'POST', headers:{'content-type':'application/json'},
        body:JSON.stringify({token:rec.t})});
      body=await r.json();
    }catch(e){ say(''); return false; }
    if(stale()) return false;
    if(!r.ok||!body.ok){ remClear(); say(''); return false; }
    var ck, b;
    try{
      ck=await unwrapUnder(b64d(rec.k), body.wrap);
      b=JSON.parse(await open(ck, body.env));
    }catch(e){ remClear(); say(''); return false; }
    if(stale()) return false;
    if(body.live){
      try{ var l=JSON.parse(await open(ck, body.live));
        b.statements.unshift({issued:'now', label:'Now', live:true, at:l.at||body.live.at, body:l.body}); }
      catch(e){ /* the issued statements still open */ }
    }
    prices=null;
    if(body.prices){ try{ prices=JSON.parse(await open(ck, body.prices)); }catch(e){ prices=null; } }
    if(stale()) return false;
    say('');
    user=body.u; session=body.session||''; orders=[]; draft={}; pick={};
    show(b);
    drawPrices();
    if(session){ await loadOrders(); if(stale()) return true; if(poll)clearInterval(poll); poll=setInterval(refresh, POLL_MS); }
    drawOrder();
    askPush();
    return true;
  }
  /* THE OWNER'S OWN SCRIPT IS SPLICED IN HERE, and only on his route (v687). Everything it
     needs -- say(), el(), stamp(), un, pw, whoacct, busy, OWNER -- is in scope at this point,
     and a customer's page carries none of it: stmt/owner.js. */
  /*__OWNER_JS__*/

  if(!OWNER){
    /* v693: the tutorial is for a page opened in a browser, not one already kept as an app */
    var installed=false;
    try{ installed=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true; }catch(e){}
    var inst=document.getElementById('inst');
    if(inst&&!installed) inst.hidden=false;
    /* the cursor lands at once, and a remembered device opens over the top of it: a reader with no
       memory on this phone must never wait on a request to be able to type */
    try{ (un.value?firstEmpty('pw'):firstEmpty('un')).focus(); }catch(e){}
    openRemembered();
  }
})();
`;
