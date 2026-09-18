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

export const WINDOW_MS = 180000;
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
select.fld{letter-spacing:0;appearance:none;-webkit-appearance:none}
.btn{margin-top:18px;width:100%;min-height:var(--salt-tap);padding:13px 16px;
  font-family:var(--salt-font-mono);font-size:var(--salt-text-md);font-weight:700;cursor:pointer;
  letter-spacing:.04em;color:var(--salt-obsidian);background:var(--salt-gradient);border:0;
  border-radius:var(--salt-radius-pill)}
.btn[disabled]{opacity:.5;cursor:default}
.btn.quiet{background:none;color:var(--salt-text);border:1px solid var(--salt-line);font-weight:400}
.btn.lnk{display:block;text-align:center;text-decoration:none;line-height:1.4}
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
export function boardPage(guest, nonce) {
  const b = (guest && guest.prices) || {};
  const products = Array.isArray(b.products) ? b.products : [];
  const week = (b.week && b.week.label) || "";
  const rm = (n) => "RM " + Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const body = products.length
    ? products.map((p) => '<div class="pane">'
        + "<h3>" + esc(p.name) + "</h3>"
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
    + "<title>Statement of account</title>"
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
    + "The page locks after three minutes; the same password opens it again.</p>"
    + '<form id="f" autocomplete="off">'
    + '<span class="lbl" id="unl">Username</span>'
    + boxes("un", 2, "text", "Username")
    + '<input type="hidden" id="un" value="' + u + '">'
    + '<span class="lbl" id="pwl">Password</span>'
    + boxes("pw", 4, "password", "Password")
    + '<input type="hidden" id="pw">'
    + '<button class="btn" id="go" type="submit">Open my statements</button>'
    + "</form>"
    + '<p class="msg" id="msg" role="status" aria-live="polite"></p>'
    + "</div>"
    + '<div id="barw" hidden><div class="bar">'
    + "<span><b id=\"whoacct\"></b>Locks in <b id=\"cd\">3:00</b></span>"
    + '<button type="button" id="lock">Lock now</button>'
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
    + CLIENT_JS.replace(/__WINDOW__/g, String(WINDOW_MS)).replace(/__POLL__/g, String(POLL_MS))
      .replace("__PAY_SITE__", JSON.stringify(PAY_SITE)).replace("__PAY_ACCOUNTS__", JSON.stringify(PAY_ACCOUNTS))
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
  var WINDOW_MS=__WINDOW__, POLL_MS=__POLL__, timer=null, ends=0, bundle=null, at=0, ticket=0, busy=false;
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
    return crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, false, ['decrypt']);
  }
  async function open(ck, blob){
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(blob.iv)}, ck, b64d(blob.ct));
    return new TextDecoder().decode(pt);
  }
  function stamp(iso){
    try{ return new Date(iso).toLocaleString('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'2-digit',month:'short',
      hour:'2-digit',minute:'2-digit',hour12:false}); }catch(e){ return ''; }
  }

  function lock(){
    ticket++; busy=false; go.disabled=false;
    if(timer){ clearInterval(timer); timer=null; }
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
    say(OWNER?'Locked. Tap an account to open it again.':'Locked. Enter the password to open it again.');
    try{ (OWNER?rq:firstEmpty('pw')).focus(); }catch(e){}
  }
  document.getElementById('lock').addEventListener('click', lock);

  function tick(){
    var left=Math.max(0, ends-Date.now());
    var m=Math.floor(left/60000), s=Math.floor(left%60000/1000);
    cd.textContent=m+':'+(s<10?'0':'')+s;
    if(left<=0) lock();
  }

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
    ends=Date.now()+WINDOW_MS; tick();
    if(timer)clearInterval(timer);
    timer=setInterval(tick,1000);
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
      var h3=el('h3',null,p.name);
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
      pane.appendChild(el('h3',null,p.name));
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
      pOrder.appendChild(el('p','lead','Pick a size off your list. You will see the order acknowledged here, then ready, and payment is offered at that point.'));
      var form=el('div','pane');
      if(!draft.product) draft.product=prices.products[0].product;
      var P=prices.products.filter(function(x){return x.product===draft.product;})[0]||prices.products[0];
      if(!draft.q||!P.sizes.some(function(x){return String(x.q)===String(draft.q);})) draft.q=P.sizes[0].q;
      if(!draft.mode) draft.mode='collect';
      var row=el('div','row2');
      var sp=el('select','fld'); sp.setAttribute('aria-label','Product');
      prices.products.forEach(function(x){ var o=el('option',null,x.name); o.value=x.product; if(x.product===draft.product)o.selected=true; sp.appendChild(o); });
      sp.addEventListener('change',function(){ draft.product=sp.value; draft.q=null; drawOrder(); });
      var sq=el('select','fld'); sq.setAttribute('aria-label','Size');
      P.sizes.forEach(function(x){ var o=el('option',null,unitsOf(x.q,P.unit)); o.value=String(x.q); if(String(x.q)===String(draft.q))o.selected=true; sq.appendChild(o); });
      sq.addEventListener('change',function(){ draft.q=sq.value; drawOrder(); });
      row.appendChild(sp); row.appendChild(sq); form.appendChild(row);
      var seg=el('div','seg');
      [['collect','I will collect'],['deliver','Deliver to me']].forEach(function(m){
        var b=el('button',draft.mode===m[0]?'on':'',m[1]); b.type='button';
        b.addEventListener('click',function(){ draft.mode=m[0]; drawOrder(); }); seg.appendChild(b);
      });
      form.appendChild(seg);
      var qt=quoteFor();
      form.appendChild(el('div','quote',qt?rm(qt.total):''));
      form.appendChild(el('div','sub2',qt?(unitsOf(qt.q,P.unit)+' of '+P.name.toLowerCase()+' at '+rm(qt.unit)+' per '+(P.unit||'unit')+(draft.mode==='deliver'?'; delivery is added when the order is marked ready':', to collect')):''));
      var go2=el('button','btn','Place this order'); go2.type='button'; go2.disabled=!qt||!!draft.busy;
      go2.addEventListener('click', async function(){
        if(!qt||draft.busy) return; draft.busy=true; drawOrder();
        var mine=ticket;
        var r=await api('/orders',{product:P.product,qty:qt.q,mode:draft.mode,unit:qt.unit,total:qt.total,week:(prices.week&&prices.week.monday)||''});
        if(mine!==ticket) return;
        draft.busy=false;
        if(r.status===401){ draft.note='Your session has ended. Lock and sign in again to order.'; }
        else if(!r.body.ok){ draft.note=r.body.error||'The order was not placed.'; }
        else { draft.note='Placed. You will see it acknowledged below.'; await loadOrders(); if(mine!==ticket) return; }
        drawOrder();
      });
      form.appendChild(go2);
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
  function orderPane(o){
    var pane=el('div','pane');
    var P=prices&&prices.products&&prices.products.filter(function(x){return x.product===o.product;})[0];
    var unit=P?P.unit:'unit', name=P?P.name:o.product;
    pane.appendChild(el('div','state '+o.status, STATE_WORDS[o.status]||o.status));
    pane.appendChild(el('div','quote', rm(o.total+(o.delivery||0))));
    if(o.delivery>0) pane.appendChild(el('div','sub2', rm(o.total)+' for the goods and '+rm(o.delivery)+' delivery'));
    pane.appendChild(el('div','sub2', unitsOf(o.qty,unit)+' of '+String(name).toLowerCase()+', '+(o.mode==='deliver'?'to be delivered':'to collect')+', placed '+stamp(o.at)));
    var line='';
    if(o.status==='placed') line='Waiting to be acknowledged. You will see it change here.';
    else if(o.status==='acknowledged') line='Seen, and being prepared. You will be told when it is ready.';
    else if(o.status==='ready') line=(o.mode==='deliver'?'Ready to be delivered.':'Ready to collect.')+(o.method?'':' Choose how you will pay.');
    else if(o.status==='done') line='Handed over and paid. Your statement updates with the next fold.';
    else if(o.status==='declined') line='This order could not be taken. Nothing is owed.';
    else if(o.status==='cancelled') line='Withdrawn before anything moved. Nothing is owed.';
    pane.appendChild(el('p','sub2',line));
    if(o.status==='ready') pane.appendChild(o.method?payLink(o):payChooser(o));
    if(o.status==='placed'||o.status==='acknowledged'){
      var wb=el('button','btn quiet','Withdraw this order'); wb.type='button';
      wb.addEventListener('click', async function(){
        if(!confirm('Withdraw this order?')) return;
        var mine=ticket; var r=await api('/orders/'+encodeURIComponent(o.id)+'/cancel',{});
        if(mine!==ticket) return;
        if(!r.body.ok) draft.note=r.body.error||'It could not be withdrawn.';
        await loadOrders(); if(mine!==ticket) return; drawOrder();
      });
      pane.appendChild(wb);
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

  /* THE CHOICE, OFFERED ONLY AT READY. Five rails; three of them name an account off the list
     QR Command carries, and the page shows only those that run that rail. */
  function payChooser(o){
    var box=el('div','pay');
    box.appendChild(el('p','sub2','How will you pay '+rm(o.total+(o.delivery||0))+'?'));
    var cur=pick[o.id]||{};
    var opts=[['cod', o.mode==='deliver'?'Cash on delivery':'Cash when I collect'],
              ['transfer','DuitNow Transfer, to an account number'],
              ['qr','DuitNow QR, a code I save and scan'],
              ['jompay','JomPAY'],
              ['tngbiz',"DuitNow purchase, the Touch 'n Go Business code"]];
    opts.forEach(function(m){
      if(m[0]!=='cod'&&m[0]!=='tngbiz'&&!accountsFor(m[0]).length) return;
      if(m[0]==='tngbiz'&&!(acct('tngbiz')&&acct('tngbiz').qr&&!acct('tngbiz').maintenance)) return;
      var lab=el('label'); var r=el('input'); r.type='radio'; r.name='pm-'+o.id; r.value=m[0]; r.checked=(cur.method===m[0]);
      r.addEventListener('change',function(){ pick[o.id]={method:m[0],account:''}; drawOrder(); });
      lab.appendChild(r); lab.appendChild(el('span',null,m[1])); box.appendChild(lab);
    });
    if(cur.method==='transfer'||cur.method==='qr'||cur.method==='jompay'){
      var sel=el('select','fld'); sel.setAttribute('aria-label','Account');
      var o0=el('option',null,cur.method==='jompay'?'Choose the biller':'Choose the bank or e-wallet'); o0.value=''; sel.appendChild(o0);
      accountsFor(cur.method).forEach(function(a){ var op=el('option',null,a.name+(a.bank&&a.bank!==a.name?' ('+a.bank+')':'')); op.value=a.key; if(cur.account===a.key)op.selected=true; sel.appendChild(op); });
      sel.addEventListener('change',function(){ pick[o.id].account=sel.value; drawOrder(); });
      box.appendChild(sel);
    }
    var ok=cur.method&&(cur.method==='cod'||cur.method==='tngbiz'||cur.account);
    var cb=el('button','btn','Confirm'); cb.type='button'; cb.disabled=!ok;
    cb.addEventListener('click', async function(){
      if(!ok) return; var mine=ticket;
      var r=await api('/orders/'+encodeURIComponent(o.id)+'/method',{method:cur.method,account:cur.account||undefined});
      if(mine!==ticket) return;
      if(!r.body.ok) draft.note=r.body.error||'The choice was not recorded.';
      await loadOrders(); if(mine!==ticket) return; drawOrder();
    });
    box.appendChild(cb);
    return box;
  }
  /* ONE LINK, FOR THE RAIL CHOSEN. Everything that pays lives on that page: the account number
     behind its Copy button, the code to save, the biller and reference. Nothing here repeats it. */
  function payLink(o){
    var box=el('div','pay');
    var a=acct(o.account), due=o.total+(o.delivery||0);
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
      var reg=await navigator.serviceWorker.register('/sw.js?u='+encodeURIComponent(user));
      var perm=await Notification.requestPermission();
      if(perm!=='granted'){ draft.pushNote='Permission was not given, so nothing will be sent.'; drawOrder(); return; }
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
  });
  /* THE OWNER'S OWN SCRIPT IS SPLICED IN HERE, and only on his route (v687). Everything it
     needs -- say(), el(), stamp(), un, pw, whoacct, busy, OWNER -- is in scope at this point,
     and a customer's page carries none of it: stmt/owner.js. */
  /*__OWNER_JS__*/

  if(!OWNER){ try{ (un.value?firstEmpty('pw'):firstEmpty('un')).focus(); }catch(e){} }
})();
`;
