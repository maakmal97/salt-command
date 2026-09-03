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
 * THREE MINUTES, NOT TEN, and the lock is a privacy lock rather than an access control. Once
 * the page has been open the reader can screenshot it, and once the envelope has been fetched
 * a copy exists. What the timer prevents is the ordinary thing: a phone put down on a table
 * with an account still on it. The password opens it again as often as he likes.
 */
/* The GENERATED stylesheet, not tools/stmt-style.mjs. That module reads design/salt-ds.css
   with node:fs, and a Worker has no filesystem. `node tools/stmt-style.mjs --sync` writes
   this file and CI runs --check, so there is still one source. */
import { STATEMENT_CSS } from "./statement-css.js";

export const WINDOW_MS = 180000;

const PAGE_CSS = `
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
.btn{margin-top:18px;width:100%;min-height:var(--salt-tap);padding:13px 16px;
  font-family:var(--salt-font-mono);font-size:var(--salt-text-md);font-weight:700;cursor:pointer;
  letter-spacing:.04em;color:var(--salt-obsidian);background:var(--salt-gradient);border:0;
  border-radius:var(--salt-radius-pill)}
.btn[disabled]{opacity:.5;cursor:default}
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
/* THE ISSUES, as a strip of dates. The current one leads; the rest are the record. A pill is
   a word in mono with a hairline, and the chosen one is brass: no filled badge. */
.mos{max-width:620px;margin:0 auto 22px;display:flex;flex-wrap:wrap;gap:8px}
.mos button{font-family:var(--salt-font-mono);font-size:var(--salt-text-xs);letter-spacing:.06em;
  color:var(--salt-text-muted);background:none;border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-pill);padding:7px 12px;cursor:pointer;min-height:auto}
.mos button.on{color:var(--salt-obsidian);background:var(--salt-brass);border-color:var(--salt-brass);
  font-weight:700}
.mos button small{margin-left:6px;font-weight:400;letter-spacing:.02em;text-transform:uppercase}
@media print{.bar,.mos{display:none}}
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
    + '<p class="lead">Sign in with the username and the password sent to you. Your statements '
    + "then stay on screen for three minutes and lock themselves, so they are not left open on "
    + "a phone. The same password opens them again as often as you like.</p>"
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
    + '<div id="mos" class="mos" hidden></div>'
    + '<div id="out"></div>'
    + '<script nonce="' + nonce + '">' + CLIENT_JS.replace(/__WINDOW__/g, String(WINDOW_MS)) + "</script>"
    + "</body></html>";
}

/* Kept as one string rather than a file so the whole page is a single Worker response with a
   single nonce, and so nothing about a statement is ever a fetchable asset. */
const CLIENT_JS = `
(function(){
  var WINDOW_MS=__WINDOW__, timer=null, ends=0, bundle=null, at=0;
  var gate=document.getElementById('gate'), out=document.getElementById('out'),
      msg=document.getElementById('msg'), pw=document.getElementById('pw'),
      un=document.getElementById('un'), go=document.getElementById('go'),
      barw=document.getElementById('barw'), cd=document.getElementById('cd'),
      mos=document.getElementById('mos');
  function say(t,cls){ msg.textContent=t||''; msg.className='msg'+(cls?' '+cls:''); }
  var b64d=function(s){ var raw=atob(s), a=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i); return a; };
  /* the same normalisation the Worker applies: case and punctuation are forgiven */
  function norm(s){ s=String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    return s.length===8 ? s.slice(0,4)+'-'+s.slice(4) : ''; }

  /* The same derivation the vault uses, and the same the generator encrypted with:
     PBKDF2-SHA256 x150000, AES-GCM-256. A mismatch anywhere here is indistinguishable
     from a wrong password, which is why the round trip is tested rather than eyeballed. */
  async function decrypt(pass, env){
    var base=await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(env.salt),iterations:150000,hash:'SHA-256'},
      base, {name:'AES-GCM',length:256}, false, ['decrypt']);
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(env.iv)}, key, b64d(env.ct));
    return new TextDecoder().decode(pt);
  }

  function lock(){
    if(timer){ clearInterval(timer); timer=null; }
    bundle=null; out.textContent=''; mos.textContent=''; mos.hidden=true;
    barw.hidden=true; gate.hidden=false;
    pw.value=''; say('Locked. Enter the password to open it again.');
    try{ pw.focus(); }catch(e){}
  }
  document.getElementById('lock').addEventListener('click', lock);

  function tick(){
    var left=Math.max(0, ends-Date.now());
    var m=Math.floor(left/60000), s=Math.floor(left%60000/1000);
    cd.textContent=m+':'+(s<10?'0':'')+s;
    if(left<=0) lock();
  }

  function pick(i){
    if(!bundle) return;
    at=i; out.innerHTML=bundle.statements[i].body;
    var bs=mos.querySelectorAll('button');
    for(var k=0;k<bs.length;k++) bs[k].className=(k===i?'on':'');
    window.scrollTo(0,0);
  }

  function show(b){
    bundle=b; mos.textContent='';
    if(b.statements.length>1){
      for(var i=0;i<b.statements.length;i++){
        var bt=document.createElement('button'); bt.type='button';
        bt.textContent=b.statements[i].label||b.statements[i].issued;
        if(i===0){ var sm=document.createElement('small'); sm.textContent='latest'; bt.appendChild(sm); }
        (function(j){ bt.addEventListener('click', function(){ pick(j); }); })(i);
        mos.appendChild(bt);
      }
      mos.hidden=false;
    }
    gate.hidden=true; barw.hidden=false;
    pick(0);
    ends=Date.now()+WINDOW_MS; tick();
    if(timer)clearInterval(timer);
    timer=setInterval(tick,1000);
  }

  document.getElementById('f').addEventListener('submit', async function(ev){
    ev.preventDefault();
    var u=norm(un.value), pass=pw.value.trim();
    if(!u){ say('Enter your username: two groups of four.','bad'); try{un.focus();}catch(e){} return; }
    if(!pass){ say('Enter the password sent to you.','bad'); try{pw.focus();}catch(e){} return; }
    un.value=u;
    go.disabled=true; say('Checking...','wait');
    var r, body;
    try{
      r=await fetch('/open', {method:'POST',
        headers:{'content-type':'application/json'}, body:JSON.stringify({u:u, password:pass})});
      body=await r.json();
    }catch(e){ go.disabled=false; say('No connection. Try again in a moment.','bad'); return; }
    go.disabled=false;
    if(!r.ok||!body.ok){
      if(r.status===429) say(body.error||'Too many attempts. Try again later.','bad');
      else say(body.error||'That username and password were not accepted.','bad');
      return;
    }
    say('Opening...','wait');
    var text, b;
    try{ text=await decrypt(pass, body.env); }
    catch(e){ say('That password did not open the statement.','bad'); return; }
    try{ b=JSON.parse(text); }catch(e){ b=null; }
    if(!b||!b.statements||!b.statements.length){ b={statements:[{issued:'',label:'',body:text}]}; }
    say('');
    show(b);
  });
  try{ (un.value?pw:un).focus(); }catch(e){}
})();
`;
