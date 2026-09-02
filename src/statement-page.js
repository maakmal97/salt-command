/* src/statement-page.js: WHAT A CUSTOMER SEES WHEN HE SCANS THE CODE.
 *
 * ONE PAGE, SERVED BY THE WORKER, NOT A STATIC ASSET. If the statement pages were files under
 * public/ they would be served by the asset store, which has no idea what a password is: the
 * ciphertext would be fetchable by anyone who guessed the filename and the ten-minute lock
 * would be decoration. Everything about a statement therefore goes through a Worker route.
 *
 * THE DECRYPTION HAPPENS HERE, IN THE BROWSER, AND THE PASSWORD NEVER LEAVES IT except as a
 * verifier check. The Worker returns {v,salt,iv,ct} and cannot read it: it holds no key, only
 * a hash it uses to decide whether to hand the envelope over at all. So a mistake in the route
 * leaks ciphertext, which is nothing, rather than a customer's account.
 *
 * THE TEN MINUTES ARE A PRIVACY LOCK, NOT AN ACCESS CONTROL, and the copy says so rather than
 * implying a guarantee the web cannot make. Once the page has been open the reader can
 * screenshot it, and once the envelope has been fetched a copy exists. What the timer actually
 * prevents is the ordinary thing: a phone put down on a table with an account still on it.
 */
/* The GENERATED stylesheet, not tools/stmt-style.mjs. That module reads design/salt-ds.css
   with node:fs, and importing it here pulled node:fs, node:path and node:url into the
   Worker bundle: the Cloudflare build failed on it, and had it bundled, readFileSync would
   have thrown on every /s/ request. `node tools/stmt-style.mjs --sync` writes this file and
   CI runs --check, so there is still one source. */
import { STATEMENT_CSS } from "./statement-css.js";

const PAGE_CSS = `
/* The gate, in the same material as the document behind it. One filled control, the
   brass-to-copper pill, because this is the one thing on the page that produces something;
   decision 5 of the identity. Everything else is a hairline or a word. */
.gate{max-width:440px;margin:12vh auto 0;padding:0 4px}
.gate h1{font-size:var(--salt-text-xl);margin:0 0 8px}
.gate .acct{font-family:var(--salt-font-mono);font-size:var(--salt-text-md);
  color:var(--salt-brass);letter-spacing:.1em;margin:0 0 22px}
.gate p.lead{color:var(--salt-text-muted);font-size:var(--salt-text-sm);line-height:1.75;margin:0 0 24px}
/* a well is black 28%, decision 4 */
.fld{display:block;width:100%;min-height:var(--salt-tap);padding:13px 16px;
  font-size:16px;letter-spacing:.08em;font-family:var(--salt-font-mono);
  color:var(--salt-text);background:var(--salt-well);border:1px solid var(--salt-line);
  border-radius:var(--salt-radius-sm);outline:none}
.fld::placeholder{color:var(--salt-mist)}
.fld:focus{border-color:var(--salt-brass);box-shadow:0 0 0 3px rgba(197,160,89,.16)}
.btn{margin-top:12px;width:100%;min-height:var(--salt-tap);padding:13px 16px;
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
  gap:12px;padding:11px 16px;margin:0 auto 20px;max-width:620px;
  background:var(--salt-veil);border:1px solid var(--salt-line);border-radius:var(--salt-radius-sm);
  backdrop-filter:blur(10px);font-size:var(--salt-text-sm);color:var(--salt-text-muted);
  font-family:var(--salt-font-mono)}
.bar b{color:var(--salt-text);font-variant-numeric:tabular-nums}
.bar button{font:inherit;color:var(--salt-brass);background:none;border:0;cursor:pointer;
  padding:0;text-decoration:underline;min-height:auto}
@media print{.bar{display:none}}
`;

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** The unlock page for one account code. `nonce` ties the inline style and script to the CSP. */
export function statementPage(code, nonce) {
  const c = esc(code);
  return '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + '<meta name="referrer" content="no-referrer">'
    + "<title>Statement of account</title>"
    + '<style nonce="' + nonce + '">' + STATEMENT_CSS + PAGE_CSS + "</style></head><body>"
    + '<div id="gate" class="gate">'
    + '<p class="eyebrow">Salt Command</p>'
    + "<h1>Statement of account</h1>"
    + '<p class="acct">' + c + "</p>"
    + '<p class="lead">Enter the password sent to you. The statement then stays on screen for '
    + "ten minutes and locks itself, so it is not left open on a phone. You can enter the "
    + "password again as often as you like.</p>"
    + '<form id="f" autocomplete="off">'
    + '<input class="fld" id="pw" type="password" inputmode="text" autocapitalize="none" '
    + 'autocorrect="off" spellcheck="false" placeholder="xxxx-xxxx-xxxx-xxxx" aria-label="Password">'
    + '<button class="btn" id="go" type="submit">Open my statement</button>'
    + "</form>"
    + '<p class="msg" id="msg" role="status" aria-live="polite"></p>'
    + "</div>"
    + '<div id="barw" hidden><div class="bar">'
    + "<span>Locks in <b id=\"cd\">10:00</b></span>"
    + '<button type="button" id="lock">Lock now</button>'
    + "</div></div>"
    + '<div id="out"></div>'
    + '<script nonce="' + nonce + '">' + CLIENT_JS.replace(/__CODE__/g, JSON.stringify(String(code))) + "</script>"
    + "</body></html>";
}

/* Kept as one string rather than a file so the whole page is a single Worker response with a
   single nonce, and so nothing about a statement is ever a fetchable asset. */
const CLIENT_JS = `
(function(){
  var CODE=__CODE__, WINDOW_MS=600000, timer=null, ends=0;
  var gate=document.getElementById('gate'), out=document.getElementById('out'),
      msg=document.getElementById('msg'), pw=document.getElementById('pw'),
      go=document.getElementById('go'), barw=document.getElementById('barw'),
      cd=document.getElementById('cd');
  function say(t,cls){ msg.textContent=t||''; msg.className='msg'+(cls?' '+cls:''); }
  var b64d=function(s){ var raw=atob(s), a=new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++)a[i]=raw.charCodeAt(i); return a; };

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
    out.textContent=''; barw.hidden=true; gate.hidden=false;
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

  function show(html){
    out.innerHTML=html;
    gate.hidden=true; barw.hidden=false;
    ends=Date.now()+WINDOW_MS; tick();
    if(timer)clearInterval(timer);
    timer=setInterval(tick,1000);
    window.scrollTo(0,0);
  }

  document.getElementById('f').addEventListener('submit', async function(ev){
    ev.preventDefault();
    var pass=pw.value.trim();
    if(!pass){ say('Enter the password sent to you.','bad'); return; }
    go.disabled=true; say('Checking...','wait');
    var r, body;
    try{
      r=await fetch('/s/'+encodeURIComponent(CODE), {method:'POST',
        headers:{'content-type':'application/json'}, body:JSON.stringify({password:pass})});
      body=await r.json();
    }catch(e){ go.disabled=false; say('No connection. Try again in a moment.','bad'); return; }
    go.disabled=false;
    if(!r.ok||!body.ok){
      if(r.status===429) say(body.error||'Too many attempts. Try again later.','bad');
      else if(r.status===404) say('No statement is published for this account yet.','bad');
      else say(body.error||'That password was not accepted.','bad');
      return;
    }
    say('Opening...','wait');
    var html;
    try{ html=await decrypt(pass, body.env); }
    catch(e){ say('That password did not open the statement.','bad'); return; }
    say('');
    show(html);
  });
  try{ pw.focus(); }catch(e){}
})();
`;
