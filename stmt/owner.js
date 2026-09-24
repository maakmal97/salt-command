/* stmt/owner.js: THE MASTER ACCOUNT'S OWN SCRIPT (v687, his instruction of 18 Sep 2026).
 *
 * WHY IT IS A FILE OF ITS OWN. All of this used to sit inside CLIENT_JS, which is one string
 * served on the customer's door as well as on /all. Only the markup was gated, so every customer
 * was handed the roster code, the guest-link calls and the word "master", and anything added to
 * the master account would have travelled with them. It is now spliced into the page at
 * /*__OWNER_JS__*\/ and only when the route is the owner's, so a customer's page carries none of
 * it and the suite proves that.
 *
 * It is written as the rest of the page is: no imports, no build step, ES5 in a template literal
 * (so every backslash is doubled), and it runs inside CLIENT_JS's own function, which is where
 * say(), el(), stamp(), un, pw, whoacct, busy and OWNER live.
 *
 * WHAT IT DRAWS. A master account opens on its items, not on a list: Review statement, then the
 * links. Review reads /all/sheet, which is the publish's account list merged with the opens this
 * Worker has recorded all along, so each account shows where it stands, in one word, and when it
 * was last opened. A tap still opens the account the customer's own way, through the form. */

export const OWNER_JS = `
  var mHome=document.getElementById('mHome'),
      oReview=document.getElementById('oReview'), oLinks=document.getElementById('oLinks'),
      oSend=document.getElementById('oSend'), oCards=document.getElementById('oCards'),
      sheet=null, sheetAt=null, sheetRows=[], sheetIssue=null, cards=null;
  function panel(which){
    mHome.hidden=!!which;
    oReview.hidden=(which!=='review');
    oLinks.hidden=(which!=='links');
    oSend.hidden=(which!=='send');
    oCards.hidden=(which!=='cards');
    say('');
    if(which==='links'&&!links.length) loadLinks();
    if(which==='review'){ drawRoster(); if(!sheet) loadSheet(); try{ rq.focus(); }catch(e){} }
    if(which==='send'){ if(!sheet) loadSheet(); else drawSend(); }
    if(which==='cards'){ if(!cards) loadCards(); else drawCards(); }
    try{ window.scrollTo(0,0); }catch(e){}
  }
  /* ---- REVIEW STATEMENT --------------------------------------------------------------------
     The list is the roster, so a code with no account behind its username is still on it and
     says so. Everything else comes from /all/sheet. */
  var FLAGW={owes:'Owes',goods:'Owes goods',refund:'Refund due',pend:'Agreed, not actioned',clear:'Clear'};
  /* 23 SEP 2026: THE ACCOUNT IS ONE LIVE DOCUMENT (v769), so there is no issue for an account to be
     missing from. A row with no totals is a username with nothing behind it, and that is what it
     says, with the one command that mends it. */
  var NOACCT='No account yet, so they cannot sign in. Mint it on the laptop: node tools/stmt-account.mjs --mint';
  function flagLine(a){
    if(!a.t||!a.flag) return NOACCT;
    var t=a.t;
    if(a.flag==='owes') return FLAGW.owes+' '+rm(t.owed);
    if(a.flag==='goods') return FLAGW.goods+' '+unitsOf(Math.round(t.toGet*100)/100);
    if(a.flag==='refund') return FLAGW.refund+' '+rm(t.refund);
    if(a.flag==='pend') return FLAGW.pend+' '+rm(t.pend);
    return FLAGW.clear;
  }
  function openedLine(a){
    if(!a.seen||!a.seen.opens) return 'Not opened';
    return 'Opened '+stampDay(a.seen.last)+(a.seen.opens>1?' \\u00b7 '+a.seen.opens+' times':'');
  }
  async function loadSheet(){
    try{
      var j=await refs('/all/sheet');
      sheet={}; sheetAt=j.at||null; sheetRows=j.accounts||[]; sheetIssue=j.issue||null;
      sheetRows.forEach(function(a){ sheet[a.username]=a; });
      drawRoster(); drawSend(); drawTest();
      var n=document.getElementById('mCount');
      /* the count is of accounts on the book: the test account is not one (v689) */
      if(n) n.textContent=sheetRows.filter(function(a){ return !a.test; }).length+' accounts on the site.';
    }catch(e){ say(e.message,'bad'); }
  }
  /* ---- SEND STATEMENT (v688) ---------------------------------------------------------------
     One card per account, the same three things the laptop's send sheet puts together: the link
     and username as one message, the QR, and the password on its own. THE PASSWORD IS DECRYPTED
     HERE AND NOWHERE ELSE: it is sealed under the master, which this page holds and the Worker
     never sees opened, and it goes straight from the decryption to the clipboard without being
     written into the page. */
  async function unseal(pass, e){
    var base=await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64d(e.salt),iterations:150000,hash:'SHA-256'},
      base, {name:'AES-GCM',length:256}, false, ['decrypt']);
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(e.iv)}, key, b64d(e.ct));
    return new TextDecoder().decode(pt);
  }
  function qrCanvas(rows){
    var n=rows.length, box=4, pad=4, size=(n+pad*2)*box;
    var c=document.createElement('canvas'); c.width=size; c.height=size;
    c.style.width='104px'; c.style.height='104px';
    var x=c.getContext('2d');
    if(x){ x.fillStyle='#f2f4f5'; x.fillRect(0,0,size,size); x.fillStyle='#05080a';
      for(var r=0;r<n;r++) for(var k=0;k<n;k++) if(rows[r][k]==='1') x.fillRect((k+pad)*box,(r+pad)*box,box,box); }
    return c;
  }
  /* THE ACCOUNT'S KEY, WRAPPED UNDER A FRESH ONE, for a link or a hand-over: opened HERE under the master and
     wrapped under a key minted here, so the Worker sees a wrap and a key and never the account's own key.
     CHARACTER CLASSES, NOT ESCAPES: this file is spliced into a template literal, where a backslash before
     + or / is eaten and /+/ is not a regular expression at all. */
  async function keyFor(a){
    var o=await (await fetch('/open', {method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({u:a.username, password:OWNER.master, master:OWNER.master})})).json();
    if(!o.ok||!o.wrapMaster) throw new Error('that account did not open under the master');
    var ck=await unwrap(OWNER.master, o.wrapMaster);
    var raw=crypto.getRandomValues(new Uint8Array(24));
    var tok=btoa(String.fromCharCode.apply(null, raw)).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/[=]+$/,'');
    return {token:tok, wrap:await wrapUnder(new TextEncoder().encode(tok), ck)};
  }
  /* ---- SHOW A CODE, IN PERSON (S3 3.13, his decision D2 of 24 Sep 2026) -------------------------------
     A customer at his counter signs in on their own phone without a message: a QR their camera opens, signed
     in, and eight symbols to type where Salt Counter asks for one (the saved iPhone app keeps its own storage,
     so a camera's browser does not sign it in). MINTED AS THE SHEET OPENS and only shown: nothing here copies
     or shares, so no clipboard or share sheet ever waits on the derivation and the fetch. One use, fifteen
     minutes; closing the sheet does not spend it. The recipes are the system's: Sheet, Orb, QR panel and Code
     field. */
  var hoSheet=null;
  function closeHo(){
    if(!hoSheet) return;
    var from=hoSheet.from;
    hoSheet.scrim.remove(); hoSheet.box.remove(); hoSheet=null;
    try{ if(from) from.focus(); }catch(e){}
  }
  function svgEl(tag, attrs){
    var e=document.createElementNS('http://www.w3.org/2000/svg', tag);
    for(var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  /* rectangles, one a run of dark modules, as engine/qr.mjs's qrRectSvg draws them: a stroked path does not scan */
  function qrRects(rows){
    var n=rows.length, q=4, span=n+q*2;
    var svg=svgEl('svg', {viewBox:'0 0 '+span+' '+span, role:'img', 'aria-label':'A code their camera opens, signed in'});
    var g=svgEl('g', {}); g.style.fill='var(--salt-slate)';
    for(var r=0;r<n;r++){
      for(var c=0;c<n;){
        if(rows[r][c]!=='1'){ c++; continue; }
        var w=1; while(c+w<n&&rows[r][c+w]==='1') w++;
        g.appendChild(svgEl('rect', {x:c+q, y:r+q, width:w, height:1}));
        c+=w;
      }
    }
    svg.appendChild(g);
    return svg;
  }
  async function showHandover(a, from){
    closeHo();
    var scrim=el('div','salt-sheet-scrim'); scrim.setAttribute('aria-hidden','true');
    var box=el('div','salt-sheet ho'); box.setAttribute('role','dialog'); box.setAttribute('aria-modal','true');
    box.setAttribute('aria-labelledby','hoT'); box.tabIndex=-1;
    box.appendChild(el('div','salt-sheet__grab'));
    var head=el('div','salt-sheet__head'), title=el('h2','salt-sheet__title','Sign in on their phone'); title.id='hoT';
    var x=el('button','salt-orb salt-sheet__close'); x.type='button'; x.setAttribute('aria-label','Close');
    var xg=svgEl('svg', {width:16, height:16, viewBox:'0 0 16 16', fill:'none', stroke:'currentColor', 'stroke-width':'1.5', 'stroke-linecap':'round', 'aria-hidden':'true'});
    xg.appendChild(svgEl('path', {d:'M3.5 3.5l9 9M12.5 3.5l-9 9'})); x.appendChild(xg);
    head.appendChild(title); head.appendChild(x); box.appendChild(head);
    var body=el('div','salt-sheet__body'); box.appendChild(body);
    body.appendChild(el('p','ho-for','For '+a.username+'.'));
    var wait=el('p','ho-wait','Making a code...'); body.appendChild(wait);
    document.body.appendChild(scrim); document.body.appendChild(box);
    var me=hoSheet={scrim:scrim, box:box, from:from};
    scrim.addEventListener('click', closeHo); x.addEventListener('click', closeHo);
    box.addEventListener('keydown', function(e){ if(e.key==='Escape'){ e.stopPropagation(); closeHo(); } });
    try{ box.focus(); }catch(e){}
    try{
      var k=await keyFor(a);
      var j=await refs('/all/handover', {u:a.username, token:k.token, wrap:k.wrap});
      k=null;
      if(hoSheet!==me) return;
      wait.remove();
      /* the panel's width is the component's own prop, and its place in the sheet is this page's: set from the
         script, which the page's style policy allows where a style attribute is refused */
      var qr=el('div','salt-qr'); qr.style.width='min(280px, 100%)'; qr.style.margin='4px auto 20px';
      var qc=el('div','salt-qr__code'); qc.appendChild(qrRects(j.qr||[])); qr.appendChild(qc);
      var qm=el('div','salt-qr__meta'); qm.appendChild(el('span','salt-qr__caption','Their camera opens it, signed in')); qr.appendChild(qm);
      body.appendChild(qr);
      var p=klBits(j.exp);
      var cf=el('div','salt-field salt-code');
      var lab=el('label','salt-code__label','Or type this code where Salt Counter asks for one'); lab.htmlFor='hoC';
      var inp=el('input','salt-field__input salt-field__input--code'); inp.id='hoC'; inp.readOnly=true;
      inp.setAttribute('autocomplete','off'); inp.setAttribute('spellcheck','false');
      inp.value=String(j.code||'').replace('-',' ');
      cf.appendChild(lab); cf.appendChild(inp);
      cf.appendChild(el('p','salt-code__hint','Works once, until '+p.hour+':'+p.minute+'.'));
      body.appendChild(cf);
    }catch(e){
      if(hoSheet!==me) return;
      wait.className='salt-code__error'; wait.textContent='Could not make a code: '+e.message;
    }
  }
  function sendCard(a){
    var card=el('div','scard'+(a.sent?' done':''));
    var head=el('div','srow');
    head.appendChild(el('b',null,a.test?'Test account':(a.code||a.username)));
    head.appendChild(el('span','un',a.username));
    card.appendChild(head);
    card.appendChild(el('p','tot',a.test?'Counts nowhere; nothing on the book is behind it.':(a.account===false?NOACCT:a.tot)));
    card.appendChild(el('p','op',openedLine(a)+(a.sent?' \\u00b7 sent '+stampDay(a.sent):'')));
    /* 24 SEP 2026: A USERNAME WITH NO ACCOUNT BEHIND IT has nothing to share, copy or open: the
       message would say "Your account is ready to use" over an account that is not there, and Open
       could only be refused. All four go off together, each saying why; the card's line says how to mend it.
       UX9: and it draws no code, which opens the address Share would have sent, under a caption offering
       the Sign-in link that is off */
    var noAcct=a.account===false, why='No account behind this username yet';
    if(!noAcct){
      var qw=el('div','qrw'); qw.appendChild(qrCanvas(a.qr||[]));
      qw.appendChild(el('p','qrn','The code opens their page with the username filled in. Sign-in link sends one that opens it outright, once.'));
      card.appendChild(qw);
    }
    var row=el('div','grow');
    var share=el('button',null,'Share'); share.type='button';
    if(noAcct){ share.disabled=true; share.title=why; }
    share.addEventListener('click', async function(){
      try{
        if(navigator.share) await navigator.share({text:a.msg});
        else { await navigator.clipboard.writeText(a.msg); share.textContent='Message copied'; }
      }catch(e){ /* a share the reader dismissed is not a fault */ }
      setTimeout(function(){ share.textContent='Share'; }, 1600);
    });
    var copy=el('button',null,'Copy message'); copy.type='button';
    if(noAcct){ copy.disabled=true; copy.title=why; }
    /* 24 SEP 2026: THE WRITE IS AWAITED. writeText answers with a promise, so a refusal never reached
       the catch and the button said Copied over an empty clipboard. */
    copy.addEventListener('click', async function(){
      try{ await navigator.clipboard.writeText(a.msg); copy.textContent='Copied'; }catch(e){ copy.textContent='Copy failed'; }
      setTimeout(function(){ copy.textContent='Copy message'; }, 1600);
    });
    var pwb=el('button','pw','Copy password'); pwb.type='button';
    if(!a.pwMaster){ pwb.disabled=true; pwb.title='Not sealed yet: run tools/stmt-seal.mjs on the laptop'; }
    else pwb.addEventListener('click', async function(){
      pwb.disabled=true; pwb.textContent='Opening...';
      try{
        var pw=await unseal(OWNER.master, a.pwMaster);
        await navigator.clipboard.writeText(pw);
        pw=null;
        pwb.textContent='Password copied';
      }catch(e){ pwb.textContent='Could not open it'; }
      setTimeout(function(){ pwb.textContent='Copy password'; pwb.disabled=false; }, 2200);
    });
    /* v710: A LINK THAT SIGNS THEM IN, so no message carries a password at all (his instruction of
       18 Sep 2026). The content key is opened HERE, under the master, wrapped under a token minted
       here, and only the token's hash and that wrap reach the Worker; the finished words come back
       from the one copy of them. MINTED ON A TAP, never on a draw: drawing the panel would write a
       record per account on every page load and burn links nobody sent. */
    var slb=el('button','pw','Sign-in link'); slb.type='button';
    /* no record means nothing to open under the master, so the link could only fail (23 Sep 2026) */
    if(noAcct){ slb.disabled=true; slb.title=why; }
    slb.addEventListener('click', async function(){
      if(a.account===false || (!a.pwMaster && !a.username)) return;
      slb.disabled=true; slb.textContent='Making it...';
      var made=false;
      try{
        var k=await keyFor(a);
        var j=await refs('/all/signin/'+encodeURIComponent(a.username), {token:k.token, wrap:k.wrap});
        k=null; made=true;
        /* 24 SEP 2026: ONCE IT IS MADE, A FAILURE IS NOT "COULD NOT MAKE ONE". A share sheet he closed
           rejects too, and the link was already minted; it goes to the clipboard instead, and the
           button says which of the three happened. */
        var sent=false;
        if(navigator.share){ try{ await navigator.share({text:j.msg}); sent=true; }catch(e){ sent=false; } }
        if(sent) slb.textContent='Link sent';
        else { await navigator.clipboard.writeText(j.msg); slb.textContent='Link made and copied'; }
      }catch(e){ slb.textContent=made?'Link made, not copied':'Could not make one'; }
      setTimeout(function(){ slb.textContent='Sign-in link'; slb.disabled=false; }, 2200);
    });
    var hob=el('button',null,'Show a code'); hob.type='button';
    if(noAcct){ hob.disabled=true; hob.title=why; }
    hob.addEventListener('click', function(){ if(a.account!==false) showHandover(a, hob); });
    /* S3 FIX, 24 SEP 2026: SIGN OUT EVERYWHERE (fold 9.4's server half). A forwarded link or a lost phone stays signed
       in while it is used, so this ends every phone and session on the account; a second tap within four seconds says
       yes, and a new link or a code then signs them back in */
    var sob=el('button',null,'Sign out everywhere'); sob.type='button';
    if(noAcct){ sob.disabled=true; sob.title=why; }
    var soArmed=null;
    sob.addEventListener('click', async function(){
      if(a.account===false) return;
      if(!soArmed){ sob.textContent='Tap again to sign them out'; soArmed=setTimeout(function(){ soArmed=null; sob.textContent='Sign out everywhere'; }, 4000); return; }
      clearTimeout(soArmed); soArmed=null; sob.disabled=true; sob.textContent='Signing out...';
      try{ var j=await refs('/all/signout', {u:a.username}); sob.textContent=j.ended?'Signed out everywhere':'Nothing was signed in'; }
      catch(e){ sob.textContent='Could not sign out'; }
      setTimeout(function(){ sob.textContent='Sign out everywhere'; sob.disabled=false; }, 2200);
    });
    var open=el('button',null,'Open account'); open.type='button';
    if(noAcct){ open.disabled=true; open.title=why; }
    open.addEventListener('click', function(){ openAcct(a); });
    row.appendChild(share); row.appendChild(copy); row.appendChild(slb); row.appendChild(hob); row.appendChild(pwb); row.appendChild(sob); row.appendChild(open);
    card.appendChild(row);
    var tick=el('label','tick');
    var box=document.createElement('input'); box.type='checkbox'; box.checked=!!a.sent;
    box.addEventListener('change', async function(){
      var want=box.checked;
      try{
        var j=await refs('/all/sent/'+a.username, {issue:sheetIssue, sent:want});
        a.sent=j.sent; card.className='scard'+(a.sent?' done':''); say(''); countSent();
      }catch(e){ box.checked=!want; say(e.message,'bad'); }
    });
    tick.appendChild(box); tick.appendChild(el('span',null,'Sent'));
    card.appendChild(tick);
    return card;
  }
  /* the test account is not part of a send, so it is out of both halves of the count (v689). A tick
     recounts as well as a draw (24 Sep 2026): the header sat on its first figure while he ticked. */
  function countSent(){
    var real=sheetRows.filter(function(a){ return !a.test; });
    var done=real.filter(function(a){ return a.sent; }).length;
    var head=document.getElementById('scount');
    if(head) head.textContent=done+' of '+real.length+' sent';
  }
  function drawSend(){
    var wrap=document.getElementById('slist'); if(!wrap) return;
    wrap.textContent='';
    var q=((document.getElementById('sq')||{}).value||'').toLowerCase().replace(/\\s+/g,'');
    var hits=sheetRows.filter(function(a){
      if(!q) return true;
      return ((a.code||'')+' '+a.username).toLowerCase().replace(/\\s+/g,'').indexOf(q)>=0;
    });
    countSent();
    if(!hits.length){ wrap.appendChild(el('p','rnone','Nothing matches that.')); return; }
    hits.forEach(function(a){ wrap.appendChild(sendCard(a)); });
  }
  /* ---- THE ROSTER (10 Sep 2026) ------------------------------------------------------------
     A tap fills the customer's own form with his username and the master, and submits it. Nothing
     below the door knows the difference: the Worker answers byMaster, the page unwraps wrapMaster,
     and the statement, the prices and the lock are the customer's own. */
  function openAcct(a){
    if(!OWNER) return;
    if(sheet&&sheet[a.username]&&sheet[a.username].account===false){ say(NOACCT,'bad'); return; }
    if(!OWNER.master){ say('No master passphrase is set on this Worker, so nothing can be opened. Set STMT_MASTER.','bad'); return; }
    if(busy) return;
    un.value=a.username; pw.value=OWNER.master;
    if(whoacct) whoacct.textContent=(a.code||a.username)+' \\u00b7 ';
    var f=document.getElementById('f');
    if(f.requestSubmit) f.requestSubmit();
    else f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  }
  /* 24 SEP 2026 (M22): AN ACCOUNT HE OPENS IS READ ONLY, and it draws what their own page draws. It
     has no session, the owner does not order, so the orders and an associate's own links come from
     /all/orders/<u>, behind the prefix's one Access check. The page calls this when view is set. */
  async function loadView(u){
    var mine=ticket;
    var r=await api('/all/orders/'+encodeURIComponent(u));
    if(mine!==ticket) return;
    orders=(r.body&&r.body.ok&&r.body.orders)||[];
    myLinks=(r.body&&r.body.ok&&r.body.refs)||[]; myMax=(r.body&&r.body.max)||0;
    if(!r.body||!r.body.ok) say('Their orders could not be read: '+((r.body&&r.body.error)||'try again'),'bad');
    if(!tCard.hidden) drawCard();
  }
  function drawRoster(){
    if(!OWNER) return;
    var q=(rq.value||'').toLowerCase().replace(/\\s+/g,'');
    rlist.textContent='';
    var hits=OWNER.accounts.filter(function(a){
      if(!q) return true;
      return ((a.code||'')+' '+a.username).toLowerCase().replace(/\\s+/g,'').indexOf(q)>=0;
    });
    if(!hits.length){ rlist.appendChild(el('p','rnone','Nothing matches that.')); return; }
    hits.forEach(function(a){
      var s=(sheet&&sheet[a.username])||a;
      var b=el('button',null,a.test?'Test account':(a.code||a.username)); b.type='button';
      /* no account, nothing to open: the row says so and does not take a tap (24 Sep 2026) */
      if(sheet&&s.account===false){ b.disabled=true; b.title='No account behind this username yet'; }
      if(a.code) b.appendChild(el('span',null,a.username));
      if(a.test) b.appendChild(el('span','fl f-none','Counts nowhere; open it to try the page.'));
      else if(sheet){
        b.appendChild(el('span','fl f-'+(s.flag||'none'),flagLine(s)));
        b.appendChild(el('span','op',openedLine(s)));
      }
      b.addEventListener('click', function(){ openAcct(a); });
      rlist.appendChild(b);
    });
  }
  /* ---- THE GUEST LINKS, on the same gated route -------------------------------------------
     Minted, listed and revoked over /all/refs; the Worker draws the QR and returns it as a data
     URI, so nothing here encodes anything and the page loads no library to do it. */
  var links=[];
  /* UX8: the answer to the last move, drawn on the card it moved, since the card changes group and the page's
     own line sits at its foot */
  var moved=null;
  function stampDay(iso){
    /* the page's klBits and MON3, so a day here is written exactly as the customer's page writes one */
    try{ var p=klBits(iso); return p.day+' '+MON3[+p.month-1]+' '+p.year; }catch(e){ return ''; }
  }
  /* v696, his instruction of 18 Sep 2026: ONE LINK PER TIER. They stand at the top, in the ladder's
     own order, each named by its level; anything minted against a customer sits below them under its
     own heading. HOW MANY IS THE BOOK'S (24 Sep 2026): the count is read off the tier list the route
     sends, never written here, because "the five" outlived the fifth tier by a day. */
  function drawLinks(){
    var glist=document.getElementById('glist');
    glist.textContent='';
    if(!links.length){ glist.appendChild(el('p','rnone','No links yet.')); return; }
    /* the guest tiers are the list less Ambassador, the floor, which is never a guest's */
    var want=tiers.slice(1);
    var made=want.filter(function(t){ return links.some(function(r){ return r.standing&&r.level===t; }); }).length;
    /* waiting means he still has to act on it: not declined (D13), and not withdrawn either */
    var isWaiting=function(r){ return !r.standing&&r.approved===false&&r.declined!==true&&!r.revoked; };
    /* UX8, 24 Sep 2026: AN ASSOCIATE'S LINK STAYS THEIRS once he has decided on it. Approved or declined, it went
       under "made against a customer" as "Tier 2, (no label)", with nothing to say who minted it */
    var isAssoc=function(r){ return !r.standing&&!!r.by&&r.by!=='standing'; };
    var standing=links.filter(function(r){return r.standing;}),
        waiting=links.filter(isWaiting),
        assoc=links.filter(function(r){return isAssoc(r)&&!isWaiting(r);}),
        older=links.filter(function(r){return !r.standing&&!isWaiting(r)&&!isAssoc(r);});
    /* v709: WHAT IS WAITING ON HIM COMES FIRST. An associate's link is shut until he approves it,
       so the one group he has to act on is the one at the top. */
    var seq=[], heads={};
    if(waiting.length){ heads[seq.length]='Waiting on you'; seq=seq.concat(waiting); }
    if(standing.length){ heads[seq.length]=want.length?'One for each of the '+want.length+' tiers':'One for each tier'; seq=seq.concat(standing); }
    if(assoc.length){ heads[seq.length]='Made by associates'; seq=seq.concat(assoc); }
    if(older.length){ heads[seq.length]='Older links, made against a customer'; seq=seq.concat(older); }
    seq.forEach(function(r,i){
      if(heads[i]) glist.appendChild(el('p','ghead',heads[i]));
      var card=el('div','glink'+(r.revoked?' off':'')); card.setAttribute('data-link',r.id);
      var declined=r.declined===true, pending=r.approved===false&&!declined;
      /* a standing link whose level the book no longer names (Bronze, 23 Sep 2026) is kept because it
         was handed out, and it opens the board a stranger sees, never the level it still carries */
      var retired=r.standing&&want.length&&want.indexOf(r.level)<0;
      card.appendChild(el('p','gt',(r.standing?r.level:(declined?'Not approved':(r.level?r.level:(pending?'Waiting on you':(isAssoc(r)?'Follows the associate':'Tier '+r.tier)))))+(r.revoked?' \\u00b7 withdrawn':'')));
      card.appendChild(el('h4',null,retired?'Kept because it was handed out. It opens the board a stranger sees'
        :r.standing?'Hand this one to a stranger you would quote '+r.level
        :declined?('Minted by '+(r.by||'an associate')+', and not approved, so it stays shut')
        :(pending?('Minted by '+(r.by||'an associate')+', and shut until you approve it')
        :isAssoc(r)?('Minted by '+r.by)
        :(r.label||'(no label)'))));
      card.appendChild(el('code','gu',r.url));
      card.appendChild(el('p','gs', r.opens
        ? 'opened '+r.opens+' time'+(r.opens===1?'':'s')+', last '+stampDay(r.last)
        : 'never opened \\u00b7 made '+stampDay(r.made)));
      var img=document.createElement('img');
      img.src=r.qr; img.alt='QR to the guest price list for '+(r.label||r.id); img.width=180; img.height=180;
      card.appendChild(img);
      var row=el('div','grow');
      var copy=el('button',null,'Copy link'); copy.type='button';
      copy.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); copy.textContent='Copied'; }
        catch(e){ copy.textContent='Copy failed'; }
        setTimeout(function(){ copy.textContent='Copy link'; }, 1500);
      });
      var rev=el('button',null,r.revoked?'Restore':'Withdraw'); rev.type='button';
      rev.addEventListener('click', function(){ moveLink(r, r.revoked?'restore':'revoke'); });
      row.appendChild(copy); row.appendChild(rev);
      /* v709: his word on one an associate minted, and the tier he may change on it. A tier he
         does not set leaves it following the associate, which is what "if need be" means. */
      if(!r.standing&&r.by){
        if(r.approved===false&&!r.revoked){
          /* a declined link keeps Approve, which is how a decline is taken back, and loses Decline;
             a withdrawn one has neither, Restore being the way back */
          var ap=el('button',null,'Approve'); ap.type='button';
          ap.addEventListener('click', function(){ moveLink(r,'approve'); });
          row.appendChild(ap);
          if(!declined){
            var de=el('button',null,'Decline'); de.type='button';
            de.addEventListener('click', function(){ moveLink(r,'decline'); });
            row.appendChild(de);
          }
        }
        if(tiers.length){
          var sel=el('select','fld'); sel.setAttribute('aria-label','The tier this link quotes');
          var o0=el('option',null,'Follows the associate'); o0.value=''; if(!r.level)o0.selected=true; sel.appendChild(o0);
          /* Ambassador is the floor and never a guest's, so the picker starts at the first of five */
          tiers.slice(1,6).forEach(function(t){ var o=el('option',null,t); o.value=t; if(r.level===t)o.selected=true; sel.appendChild(o); });
          sel.addEventListener('change', function(){ setLevel(r, sel.value); });
          card.appendChild(sel);
        }
      }
      card.appendChild(row);
      if(moved&&moved.id===r.id){ var mv=el('p','msg',moved.t); mv.setAttribute('role','status'); card.appendChild(mv); }
      glist.appendChild(card);
    });
    if(want.length&&made<want.length) glist.appendChild(el('p','rnone','Only '+made+' of the '+want.length+' are made. Publish the statements and open this again.'));
  }
  async function refs(path, body){
    var o = body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}
                 : {};
    var r = await fetch(path, o);
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok||!j.ok) throw new Error(j.error||'that did not work');
    return j;
  }
  var tiers=[];
  async function loadLinks(){
    moved=null;
    try{ var j=await refs('/all/refs'); links=j.refs||[]; tiers=j.tiers||[]; drawLinks(); say(''); }
    catch(e){ say(e.message,'bad'); }
  }
  async function setLevel(r, level){
    try{
      var j=await refs('/all/refs/'+r.id+'/level', {level: level||null});
      for(var i=0;i<links.length;i++) if(links[i].id===j.ref.id) links[i]=j.ref;
      drawLinks(); say(level?('That link now quotes '+level+'.'):'That link follows the associate again.');
    }catch(e){ say(e.message,'bad'); }
  }
  async function moveLink(r, how){
    try{
      /* THE BODY IS WHAT MAKES IT A POST (24 Sep 2026): refs() sends a GET when it is given none,
         and every move on a link is a POST-only route, so Approve, Decline, Withdraw and Restore all
         came back 405 and nothing moved. */
      var j=await refs('/all/refs/'+r.id+'/'+how, {});
      for(var i=0;i<links.length;i++) if(links[i].id===j.ref.id) links[i]=j.ref;
      /* UX8: the tap is answered in one line on the card, read off the link as the site now holds it, and the
         card is brought into view in the group it has moved to */
      var opens=!j.ref.revoked&&j.ref.approved!==false;
      moved={id:j.ref.id, t:({approve:'Approved.',decline:'Declined.',revoke:'Withdrawn.',restore:'Restored.'}[how]||'Done.')
        +(opens?' It opens now.':' It stays shut.')};
      drawLinks(); say('');
      var mc=document.querySelector('[data-link="'+j.ref.id+'"]');
      if(mc&&mc.scrollIntoView) mc.scrollIntoView({block:'center'});
    }catch(e){ say(e.message,'bad'); }
  }
  document.getElementById('gmake').addEventListener('click', async function(){
    var b=this, intro=document.getElementById('gintro').value,
        label=document.getElementById('glabel').value;
    if(!String(intro||'').trim()){ say('Name the customer introducing them.','bad'); return; }
    b.disabled=true; say('Making it...','wait');
    try{
      var j=await refs('/all/refs', {introducer:intro, label:label});
      links.unshift(j.ref); drawLinks();
      document.getElementById('glabel').value='';
      document.getElementById('gintro').value='';
      say('Made. The QR opens it.');
    }catch(e){ say(e.message,'bad'); }
    b.disabled=false;
  });
  /* ---- THE ASSOCIATES REPORT CARD (v691) ------------------------------------------------------
     One card an associate, per book: what they bought, what they sold for him, what they brought
     in, their share and their stars, and the reward in UNITS with a bar for how far through the
     next one they are. No margin is in the snapshot, so none can be drawn here. */
  async function loadCards(){
    try{ cards=await refs('/all/assoc'); drawCards(); }
    catch(e){ say(e.message,'bad'); }
  }
  function bar(frac){
    var w=el('div','pbar'), f=document.createElement('i');
    f.style.width=Math.round((frac||0)*100)+'%';
    w.appendChild(f); return w;
  }
  function cardOf(r){
    var c=el('div','acard'+(r.departed?' off':''));
    var head=el('div','srow');
    head.appendChild(el('b',null,r.id));
    var marks=[];
    if(r.founder) marks.push('founder');
    if(r.rank) marks.push('#'+r.rank);
    if(r.departed) marks.push('departed');
    if(r.stars) marks.push(new Array(r.stars+1).join('\\u2605'));
    head.appendChild(el('span','un',marks.join(' \\u00b7 ')));
    c.appendChild(head);
    var g=el('div','agrid');
    [['Bought from you',rm(r.bought)],['Sold for you',rm(r.soldFor)],['Brought you',rm(r.introduced)]].forEach(function(p){
      var cell=el('div','acell'); cell.appendChild(el('span','l',p[0])); cell.appendChild(el('b',null,p[1])); g.appendChild(cell);
    });
    c.appendChild(g);
    var line=[];
    if(r.onward) line.push(r.onward+' onward sale'+(r.onward===1?'':'s'));
    if(r.referred) line.push(r.referred+' introduced');
    if(r.share) line.push(r.share+'% of all revenue');
    if(line.length) c.appendChild(el('p','op',line.join(' \\u00b7 ')));
    if(r.reward){
      var w=r.reward;
      c.appendChild(el('p','tot','Reward: '+w.earned+' earned, '+w.taken+' taken, '+(Math.round(w.left*100)/100)+' left'
        +(w.held?', held while departed':'')));
      if(w.next!=null){ c.appendChild(bar(w.next)); c.appendChild(el('p','op',Math.round(w.next*100)+'% of the way to the next unit')); }
    } else c.appendChild(el('p','tot','No reward on this book.'));
    return c;
  }
  function drawCards(){
    var wrap=document.getElementById('clist'); if(!wrap) return;
    wrap.textContent='';
    var head=document.getElementById('ccount');
    if(!cards||!cards.products||!cards.products.length){
      if(head) head.textContent='';
      wrap.appendChild(el('p','rnone','No report card has been published yet. The next deploy writes one.'));
      return;
    }
    if(head) head.textContent='As at '+(cards.at?stampDay(cards.at):'the last publish')+'.';
    cards.products.forEach(function(p){
      wrap.appendChild(el('h2',null,p.name||p.product));
      if(!p.rows.length){ wrap.appendChild(el('p','rnone','Nobody on this book yet.')); return; }
      p.rows.forEach(function(r){ wrap.appendChild(cardOf(r)); });
    });
  }
  /* ---- THE TEST ACCOUNT (v689) --------------------------------------------------------------
     One tap makes it, one tap takes it away with everything it wrote. It is his own, so the item
     says what it is for and names the two things he types. */
  function drawTest(){
    var box=document.getElementById('mTest'); if(!box) return;
    var on=sheetRows.some(function(a){ return a.test; });
    box.textContent='';
    box.appendChild(el('p','lead', on
      ? 'A test account is live: username 0000-0000, password 0000-0000-0000-0000. It is on no list that counts and orders nothing onto the book.'
      : 'No test account. One tap makes an account you can open anywhere, that counts nowhere.'));
    var b=el('button','btn quiet salt-ghost', on?'Delete the test account':'Make a test account'); b.type='button';
    b.addEventListener('click', async function(){
      b.disabled=true; say(on?'Deleting...':'Making...','wait');
      try{
        await refs('/all/test', {make:!on});
        sheet=null; await loadSheet();
        say(on?'Gone, with everything it wrote.':'Made. Username 0000-0000, password 0000-0000-0000-0000.');
      }catch(e){ say(e.message,'bad'); }
      b.disabled=false; drawTest();
    });
    box.appendChild(b);
  }
  mHome.addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-m]'); if(!b) return;
    panel(b.getAttribute('data-m'));
  });
  [].slice.call(document.querySelectorAll('button[data-back]')).forEach(function(b){
    b.addEventListener('click', function(){ panel(null); });
  });
  rq.addEventListener('input', drawRoster);
  var sq=document.getElementById('sq'); if(sq) sq.addEventListener('input', drawSend);
  panel(null);
  /* the home itself needs the account list, for the count and for whether a test account is live */
  loadSheet();
`;
