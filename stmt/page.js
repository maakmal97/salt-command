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
.gate p.lead{color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.75;margin:0 0 24px}
.lbl{display:block;font-size:var(--salt-text-xs);letter-spacing:.2em;text-transform:uppercase;
  color:var(--salt-copper);font-weight:700;margin:14px 0 6px;font-family:var(--salt-font-mono)}
/* a well is black 28%, decision 4 */
.fld{display:block;width:100%;min-height:var(--salt-tap);padding:13px 16px;
  font-size:16px;letter-spacing:.08em;font-family:var(--salt-font-mono);
  color:var(--salt-text);background:var(--salt-well);border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-sm);outline:none}
.fld::placeholder{color:var(--salt-mist)}
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
`;

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The landing page. `user` is the normalised username to prefill, or "". `nonce` ties the
    inline style and script to the CSP. */
export function landingPage(user, nonce) {
  const u = esc(user || "");
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + '<meta name="referrer" content="no-referrer">'
    + "<title>Statement of account</title>"
    + '<style nonce="' + nonce + '">' + STATEMENT_CSS + PAGE_CSS + "</style></head><body>"
    + '<div id="gate" class="gate">'
    + '<p class="eyebrow">Salt Command</p>'
    + "<h1>Statement of account</h1>"
    + '<p class="lead">Sign in with the username and the password sent to you. Your statement is '
    + "live: every entry from the start to today, updated as soon as an entry is approved, with "
    + "each monthly statement as sent beside it. Your price list for the week and your orders are "
    + "behind the same password. The page locks after three minutes so it is not "
    + "left open on a phone; the same password opens it again as often as you like.</p>"
    + '<form id="f" autocomplete="off">'
    + '<label class="lbl" for="un">Username</label>'
    + '<input class="fld" id="un" type="text" inputmode="text" autocapitalize="none" '
    + 'autocorrect="off" spellcheck="false" placeholder="xxxx-xxxx" aria-label="Username" value="' + u + '">'
    + '<label class="lbl" for="pw">Password</label>'
    + '<input class="fld" id="pw" type="password" inputmode="text" autocapitalize="none" '
    + 'autocorrect="off" spellcheck="false" placeholder="xxxx-xxxx-xxxx-xxxx" aria-label="Password">'
    + '<button class="btn" id="go" type="submit">Open my statements</button>'
    + "</form>"
    + '<p class="msg" id="msg" role="status" aria-live="polite"></p>'
    + "</div>"
    + '<div id="barw" hidden><div class="bar">'
    + "<span>Locks in <b id=\"cd\">3:00</b></span>"
    + '<button type="button" id="lock">Lock now</button>'
    + "</div></div>"
    + '<div id="tabs" class="tabs" role="tablist" hidden>'
    + '<button type="button" data-t="stmt" class="on">Statements</button>'
    + '<button type="button" data-t="prices">Prices</button>'
    + '<button type="button" data-t="order">Order</button>'
    + "</div>"
    + '<div id="pStmt"><div id="mos" class="mos" hidden></div><div id="out"></div></div>'
    + '<div id="pPrices" class="panel" hidden></div>'
    + '<div id="pOrder" class="panel" hidden></div>'
    + '<script nonce="' + nonce + '">'
    + CLIENT_JS.replace(/__WINDOW__/g, String(WINDOW_MS)).replace(/__POLL__/g, String(POLL_MS))
      .replace("__PAY_SITE__", JSON.stringify(PAY_SITE)).replace("__PAY_ACCOUNTS__", JSON.stringify(PAY_ACCOUNTS))
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
  var WINDOW_MS=__WINDOW__, POLL_MS=__POLL__, timer=null, ends=0, bundle=null, at=0, ticket=0, busy=false;
  var PAY_SITE=__PAY_SITE__, PAY=__PAY_ACCOUNTS__;
  var session='', user='', prices=null, orders=[], poll=null, tab='stmt', draft={}, pick={};
  var gate=document.getElementById('gate'), out=document.getElementById('out'),
      msg=document.getElementById('msg'), pw=document.getElementById('pw'),
      un=document.getElementById('un'), go=document.getElementById('go'),
      barw=document.getElementById('barw'), cd=document.getElementById('cd'),
      mos=document.getElementById('mos'), tabs=document.getElementById('tabs'),
      pStmt=document.getElementById('pStmt'), pPrices=document.getElementById('pPrices'),
      pOrder=document.getElementById('pOrder');
  function say(t,cls){ msg.textContent=t||''; msg.className='msg'+(cls?' '+cls:''); }
  var b64d=function(s){ var raw=atob(s), a=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i); return a; };
  /* the same normalisation the Worker applies: case and punctuation are forgiven */
  function norm(s){ s=String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    return s.length===8 ? s.slice(0,4)+'-'+s.slice(4) : ''; }

  /* THE HYPHENS ARE PUT IN FOR HIM (his instruction, 06 Sep 2026). A username is two groups of
     four and a password four; both are read off a message and typed on a phone, and the hyphen is
     the character most often left out or put in the wrong place. So the fields group the symbols
     as they are typed, pasted or autofilled: nothing but the symbols is kept, and a hyphen goes
     after every fourth. The username field always does this. THE PASSWORD FIELD DOES IT ONLY WHILE
     WHAT IS TYPED LOOKS LIKE A STATEMENT PASSWORD, sixteen or fewer symbols of the password's own
     alphabet, because the same field takes the owner's master passphrase: the moment a symbol
     outside that alphabet arrives, or a seventeenth, the grouping stops for good and the field
     keeps exactly what is typed from then on. */
  var ALPHA=/^[23456789abcdefghjkmnpqrstvwxyz]*$/, autoPw=true;
  function grouped(raw){ var out=''; for(var i=0;i<raw.length;i++){ if(i&&i%4===0)out+='-'; out+=raw.charAt(i); } return out; }
  function shapeUser(){ un.value=grouped(un.value.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)); }
  function shapePw(){
    if(!pw.value){ autoPw=true; return; }          /* an emptied field starts again */
    if(!autoPw) return;
    var raw=pw.value.replace(/-/g,'');
    if(raw.length<=16&&ALPHA.test(raw.toLowerCase())){ pw.value=grouped(raw.toLowerCase()); return; }
    autoPw=false; pw.value=raw;
  }
  ['input','change'].forEach(function(ev){ un.addEventListener(ev, shapeUser); pw.addEventListener(ev, shapePw); });
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
    pPrices.textContent=''; pOrder.textContent='';
    tabs.hidden=true; barw.hidden=true; gate.hidden=false;
    showTab('stmt');
    pw.value=''; autoPw=true; say('Locked. Enter the password to open it again.');
    try{ pw.focus(); }catch(e){}
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
    window.scrollTo(0,0);
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
    gate.hidden=true; barw.hidden=false; tabs.hidden=false;
    pickStmt(0);
    ends=Date.now()+WINDOW_MS; tick();
    if(timer)clearInterval(timer);
    timer=setInterval(tick,1000);
  }

  /* ---- PRICES: the week's list, one block per product ---- */
  function drawPrices(){
    pPrices.textContent='';
    var h=el('h2',null,'Your prices'); pPrices.appendChild(h);
    if(!prices||!prices.products||!prices.products.length){
      pPrices.appendChild(el('p','lead','No price list has been written for your account yet. It is written with the next update and changes weekly.'));
      return;
    }
    pPrices.appendChild(el('p','lead','For the week of '+(prices.week&&prices.week.label||'')+'. Collected is what you pay when you pick up; delivered adds one delivery to the order. The list is written from your own history and changes weekly.'));
    prices.products.forEach(function(p){
      var pane=el('div','pane');
      pane.appendChild(el('h3',null,p.name));
      var delivery=p.delivery>0?'Delivery '+rm(p.delivery)+' per order.':'Delivery is not charged.';
      pane.appendChild(el('p','sub2', (p.basis==='yours'
        ? 'Your rate: '+rm(p.rate)+' per '+(p.unit||'unit')+', from your last '+p.orders+' order'+(p.orders===1?'':'s')+'. '
        : 'The board price; your own rate follows your first order. ')+delivery));
      var t=el('table'), th=el('thead'), tr=el('tr');
      [['Size','l'],['Collected',''],['Delivered','']].forEach(function(c){ var x=el('th',c[1]||null,c[0]); tr.appendChild(x); });
      th.appendChild(tr); t.appendChild(th);
      var tb=el('tbody');
      p.sizes.forEach(function(r){
        var row=el('tr');
        row.appendChild(el('td','l',unitsOf(r.q,p.unit)));
        row.appendChild(el('td',null,rm(r.collected)));
        row.appendChild(el('td',null,rm(r.delivered)));
        tb.appendChild(row);
      });
      t.appendChild(tb); pane.appendChild(t); pPrices.appendChild(pane);
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
    var total=draft.mode==='deliver'?r.delivered:r.collected;
    return {p:p, q:r.q, total:total, unit:+(total/r.q).toFixed(2)};
  }
  function drawOrder(){
    var sc=window.scrollY;
    pOrder.textContent='';
    pOrder.appendChild(el('h2',null,'Order'));
    if(!prices||!prices.products||!prices.products.length){
      pOrder.appendChild(el('p','lead','Ordering opens once your price list is written, with the next update.'));
    } else {
      pOrder.appendChild(el('p','lead','Pick a size off your list. The order goes to Salt Command; you will see it acknowledged here, then ready, and payment is offered at that point.'));
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
      form.appendChild(el('div','sub2',qt?(unitsOf(qt.q,P.unit)+' of '+P.name.toLowerCase()+', '+(draft.mode==='deliver'?'delivered':'collected')+', at '+rm(qt.unit)+' per '+(P.unit||'unit')):''));
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
    pane.appendChild(el('div','quote', rm(o.total)));
    pane.appendChild(el('div','sub2', unitsOf(o.qty,unit)+' of '+String(name).toLowerCase()+', '+(o.mode==='deliver'?'to be delivered':'to collect')+', placed '+stamp(o.at)));
    var line='';
    if(o.status==='placed') line='Waiting to be acknowledged. You will see it change here.';
    else if(o.status==='acknowledged') line='Seen, and being prepared. You will be told when it is ready.';
    else if(o.status==='ready') line=(o.mode==='deliver'?'Ready to be delivered.':'Ready to collect.')+(o.method?'':' Choose how you will pay.');
    else if(o.status==='done') line='Handed over and paid. Your statement updates with the next fold.';
    else if(o.status==='declined') line='Salt Command could not take this order. Nothing is owed.';
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
    box.appendChild(el('p','sub2','How will you pay '+rm(o.total)+'?'));
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
    var a=acct(o.account);
    var word={cod:(o.mode==='deliver'?'Pay '+rm(o.total)+' in cash on delivery.':'Pay '+rm(o.total)+' in cash when you collect.'),
      transfer:'Transfer '+rm(o.total)+' by DuitNow Transfer to '+(a?a.name:'the account')+'. The page that opens has the account number behind Copy account number; paste it into your banking app.',
      qr:'Pay '+rm(o.total)+' by scanning the '+(a?a.name:'')+' code. On the page that opens, tap the code to save it as an image, then scan it from your banking app.',
      jompay:'Pay '+rm(o.total)+' by JomPAY. The page that opens has the biller code and the reference behind Copy; enter them in your banking app under JomPAY.',
      tngbiz:'Pay '+rm(o.total)+" by scanning the Touch 'n Go Business code on the page that opens, or save it and scan it from the Touch 'n Go app."}[o.method]||'';
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
    if(!u){ say('Enter your username: two groups of four.','bad'); try{un.focus();}catch(e){} return; }
    if(!pass){ say('Enter the password sent to you.','bad'); try{pw.focus();}catch(e){} return; }
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
  try{ (un.value?pw:un).focus(); }catch(e){}
})();
`;
