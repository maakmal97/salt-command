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
 * WHAT IT DRAWS. Four places (S9): Needs you, a card for each thing waiting on him with its action on
 * it; Accounts, one list for what Send and Review were, read off /all/sheet, the publish's account
 * list merged with the opens this Worker records, a row opening the account's card; Links; and More.
 * View as them opens the account the customer's own way, through the form. */

export const OWNER_JS = `
  var mHome=document.getElementById('mHome'), oAccts=document.getElementById('oAccts'),
      oLinks=document.getElementById('oLinks'), oMore=document.getElementById('oMore'),
      oCards=document.getElementById('oCards'), aopen=document.getElementById('aopen'),
      sheet=null, sheetAt=null, sheetRows=[], sheetIssue=null, cards=null, deskWait=null;
  /* S9 9.2: FOUR PLACES, Needs you (null), Accounts, Links and More; the report card is a page of More */
  var PLACE={accounts:'accounts', links:'links', more:'more', cards:'more'};
  function panel(which){
    if(which==='needs') which=null;
    mHome.hidden=!!which;
    oAccts.hidden=(which!=='accounts');
    oLinks.hidden=(which!=='links');
    oMore.hidden=(which!=='more');
    oCards.hidden=(which!=='cards');
    var here=which?PLACE[which]:'needs';
    [].slice.call(document.querySelectorAll('.place[data-m]')).forEach(function(b){
      if(b.getAttribute('data-m')===here) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    say('');
    if(which==='links'){ if(!linksRead) loadLinks(); else drawLinks(); }
    if(!which) drawNeeds();
    if(which==='accounts'){ drawRoster(); if(!sheet) loadSheet(); }
    if(which==='cards'){ if(!cards) loadCards(); else drawCards(); }
    try{ window.scrollTo(0,0); }catch(e){}
  }
  /* ---- WHERE AN ACCOUNT STANDS ---------------------------------------------------------------
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
      sheet={}; sheetAt=j.at||null; sheetRows=j.accounts||[]; sheetIssue=j.issue||null; deskWait=j.desk||null;
      sheetRows.forEach(function(a){ sheet[a.username]=a; });
      drawRoster(); drawTest(); drawNeeds();
      if(aOpen) openCard(aOpen);
      var n=document.getElementById('mCount'), real=sheetRows.filter(function(a){ return !a.test; }).length;
      /* the count is of accounts on the book: the test account is not one (v689) */
      if(n) n.textContent=real+' accounts on the site.';
      document.getElementById('mFoot').textContent=real+' accounts, as at '+hm(new Date().toISOString());
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
  /* v710's one-time link, minted for one account: the content key is opened HERE under the master and wrapped
     under a token minted here, and only the token's hash and that wrap reach the Worker, which answers with the
     finished words. CHARACTER CLASSES, NOT ESCAPES: this file is spliced into a template literal, where a
     backslash before + or / is eaten and /+/ is not a regular expression at all. */
  async function mintLink(a){
    var o=await (await fetch('/open', {method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({u:a.username, password:OWNER.master, master:OWNER.master})})).json();
    if(!o.ok||!o.wrapMaster) throw new Error('that account did not open under the master');
    var ck=await unwrap(OWNER.master, o.wrapMaster);
    var raw=crypto.getRandomValues(new Uint8Array(24));
    var tok=btoa(String.fromCharCode.apply(null, raw)).replace(/[+]/g,'-').replace(/[/]/g,'_').replace(/[=]+$/,'');
    var wrap=await wrapUnder(new TextEncoder().encode(tok), ck);
    return refs('/all/signin/'+encodeURIComponent(a.username), {token:tok, wrap:wrap});
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
        var j=await mintLink(a);
        made=true;
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
    /* S9 9.5: View as them, their own page, read only */
    var open=el('button',null,'View as them'); open.type='button';
    if(noAcct){ open.disabled=true; open.title=why; }
    open.addEventListener('click', function(){ openAcct(a); });
    row.appendChild(share); row.appendChild(copy); row.appendChild(slb); row.appendChild(pwb); row.appendChild(open);
    card.appendChild(row);
    var tick=el('label','tick');
    var box=document.createElement('input'); box.type='checkbox'; box.checked=!!a.sent;
    box.addEventListener('change', async function(){
      var want=box.checked;
      try{
        var j=await refs('/all/sent/'+a.username, {issue:sheetIssue, sent:want});
        a.sent=j.sent; card.className='scard'+(a.sent?' done':''); say(''); countSent(); drawRoster(); drawNeeds();
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
    document.getElementById('vasU').textContent=a.username;
    var f=document.getElementById('f');
    if(f.requestSubmit) f.requestSubmit();
    else f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  }
  /* S9 9.5: BACK TO ACCOUNTS. The bar's one control on his page runs the page's own Log out first, which puts
     his page back (lock); this then shows Accounts, where the account he was viewing is still open. */
  document.getElementById('lock').addEventListener('click', function(){ panel('accounts'); });
  /* 24 SEP 2026 (M22): AN ACCOUNT HE OPENS IS READ ONLY, and it draws what their own page draws. It
     has no session, the owner does not order, so the orders and an associate's own links come from
     /all/orders/<u>, behind the prefix's one Access check. The page calls this when view is set. */
  async function loadView(u){
    var mine=ticket, j=null;
    /* through refs, so a lapsed Access session reads as one (S9 9.7) */
    try{ j=await refs('/all/orders/'+encodeURIComponent(u)); }
    catch(e){ if(mine===ticket) say('Their orders could not be read: '+e.message,'bad'); }
    if(mine!==ticket) return;
    orders=(j&&j.orders)||[]; myLinks=(j&&j.refs)||[]; myMax=(j&&j.max)||0;
    if(!tCard.hidden) drawCard();
  }
  /* ---- ACCOUNTS (S9 9.2) -----------------------------------------------------------------------
     One list for what Send and Review were: the system's Inbox row an account, its code and chips for where it
     stands and how it has been reached, found by a word and narrowed by a filter. A row opens the account's
     card, beside the list from 1080px and in its place on a phone with a way back; the card is Send's. */
  var aFilter='all', aOpen=null;
  var FILTER={
    all:function(){ return true; },
    unsent:function(a){ return a.account!==false&&!a.test&&!a.sent; },
    unopened:function(a){ return a.account!==false&&!a.test&&!(a.seen&&a.seen.opens); },
    owes:function(a){ return a.flag==='owes'||a.flag==='goods'; },
    locked:function(a){ return !!a.locked; },
    none:function(a){ return a.account===false; }
  };
  var HOWW={password:'by password', link:'by link', remembered:'on a remembered phone'};
  function chip(tone, t){ return el('span','salt-status salt-status--'+tone, t); }
  function chipsOf(a){
    if(a.test) return [chip('mist','Test, counts nowhere')];
    if(a.account===false) return [chip('alarm','No account')];
    var out=[];
    if(a.locked) out.push(chip('alarm','Locked'+(a.locked.until?' till '+hm(a.locked.until):'')));
    if(a.flag&&a.flag!=='clear') out.push(chip({owes:'ember', goods:'steel', refund:'brass', pend:'copper'}[a.flag]||'mist', flagLine(a)));
    out.push(a.seen&&a.seen.opens?chip('mist','Opened '+dayMon(a.seen.last)+(HOWW[a.seen.how]?' '+HOWW[a.seen.how]:'')):chip('steel','Not opened'));
    if(a.alerts) out.push(chip('verdigris','Alerts on'));
    if(a.sent) out.push(chip('verdigris','Sent '+dayMon(a.sent)));
    return out;
  }
  function rowOf(a){
    var b=el('button','salt-inbox-row'); b.type='button'; b.setAttribute('data-u', a.username);
    if(aOpen===a.username) b.setAttribute('aria-current','true');
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title');
    t.appendChild(el('span',null,a.test?'Test account':(a.code||a.username)));
    if(sheet) chipsOf(a).forEach(function(c){ t.appendChild(c); });
    main.appendChild(t);
    main.appendChild(el('span','salt-inbox-row__what', a.username+(a.tot?', '+a.tot:'')));
    b.appendChild(main);
    var side=el('span','salt-inbox-row__side'); side.appendChild(el('span','salt-inbox-row__action','Open'));
    b.appendChild(side);
    b.addEventListener('click', function(){ openCard(a.username); });
    return b;
  }
  function drawRoster(){
    if(!OWNER) return;
    var q=(rq.value||'').toLowerCase().replace(/\\s+/g,''), f=FILTER[aFilter]||FILTER.all;
    rlist.textContent='';
    var hits=(sheet?sheetRows:OWNER.accounts).filter(function(a){
      return f(a)&&(!q||((a.code||'')+' '+a.username).toLowerCase().replace(/\\s+/g,'').indexOf(q)>=0);
    });
    countSent();
    if(!hits.length){ rlist.appendChild(el('p','rnone','Nothing matches that.')); return; }
    hits.forEach(function(a){ rlist.appendChild(rowOf(a)); });
  }
  function filterBy(f){
    aFilter=FILTER[f]?f:'all';
    [].slice.call(document.querySelectorAll('#afil button[data-f]')).forEach(function(x){
      x.setAttribute('aria-pressed', x.getAttribute('data-f')===aFilter?'true':'false'); });
    drawRoster();
  }
  /* the open account: its chips, then Send's card, and on a phone the way back to the list above it */
  function openCard(u){
    var a=u&&((sheet&&sheet[u])||OWNER.accounts.filter(function(x){ return x.username===u; })[0]);
    aOpen=a?u:null;
    oAccts.classList.toggle('open', !!a);
    aopen.hidden=!a; aopen.textContent='';
    [].slice.call(rlist.querySelectorAll('[data-u]')).forEach(function(r){
      if(r.getAttribute('data-u')===aOpen) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
    if(!a) return;
    var back=el('button','aback','← Accounts'); back.type='button'; back.setAttribute('data-back','accounts');
    aopen.appendChild(back);
    if(sheet){ var cs=el('div','achips'); chipsOf(a).forEach(function(c){ cs.appendChild(c); }); aopen.appendChild(cs); }
    aopen.appendChild(sendCard(a));
    try{ window.scrollTo(0,0); }catch(e){}
  }
  function setCount(m, n){ [].slice.call(document.querySelectorAll('[data-count="'+m+'"]')).forEach(function(c){ c.textContent=n?String(n):''; }); }
  /* ---- THE GUEST LINKS, on the same gated route -------------------------------------------
     Minted, listed and revoked over /all/refs; the Worker draws the QR and returns it as a data
     URI, so nothing here encodes anything and the page loads no library to do it. */
  var links=[];
  /* UX8: the answer to the last move, drawn on the card it moved, since the card changes group and the page's
     own line sits at its foot */
  var moved=null;
  /* S9 fix: AND A TAP THAT FAILS, or a tier pinned, is answered on the card it was tapped on as well, in Needs you
     and in Links, where the page's own line sat under every card, off a phone's screen. The link keeps its buttons. */
  var linkSaid=null;
  function saidOn(r, node){ if(linkSaid&&linkSaid.id===r.id){ node.textContent=linkSaid.t; node.className+=linkSaid.bad?' bad':''; } }
  /* waiting means he still has to act on it: not declined (D13), and not withdrawn either */
  function waitingLink(r){ return !r.standing&&r.approved===false&&r.declined!==true&&!r.revoked; }
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
    var isWaiting=waitingLink;
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
      if(linkSaid&&linkSaid.id===r.id){ var ls=el('p','msg'); ls.setAttribute('role','status'); saidOn(r, ls); card.appendChild(ls); }
      glist.appendChild(card);
    });
    if(want.length&&made<want.length) glist.appendChild(el('p','rnone','Only '+made+' of the '+want.length+' are made. Publish the statements and open this again.'));
  }
  /* S9 9.7, HIS D13: WHEN ACCESS LAPSES, SAY SO. A request under /all after the Access session has ended is
     sent to the Access login, a redirect a fetch cannot follow, and every tap read "Failed to fetch". Asked not
     to follow it, the fetch answers an opaque redirect, and that or the Worker's own 401 is the sign-in ending:
     the page gives way to Sign in again, which loads /all and so the Access login. A fetch that throws is the
     connection, and says so. */
  var ENDED='Your admin sign-in has ended.';
  function ended(){ document.getElementById('aEnded').hidden=false; document.body.classList.add('ended'); }
  async function refs(path, body){
    var o = body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}
                 : {};
    o.redirect='manual';
    var r;
    try{ r = await fetch(path, o); }catch(e){ throw new Error('Not sent. Check the connection and try again.'); }
    if(r.type==='opaqueredirect'||r.status===401){ ended(); throw new Error(ENDED); }
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok||!j.ok) throw new Error(j.error||'that did not work');
    return j;
  }
  var tiers=[];
  async function loadLinks(){
    moved=null;
    try{ var j=await refs('/all/refs'); links=j.refs||[]; tiers=j.tiers||[]; linksRead=true; drawLinks(); drawNeeds(); say(''); }
    catch(e){ say(e.message,'bad'); }
  }
  async function setLevel(r, level){
    linkSaid=null;
    try{
      var j=await refs('/all/refs/'+r.id+'/level', {level: level||null});
      for(var i=0;i<links.length;i++) if(links[i].id===j.ref.id) links[i]=j.ref;
      linkSaid={id:r.id, t:level?('That link now quotes '+level+'.'):'That link follows the associate again.'};
    }catch(e){ linkSaid={id:r.id, t:e.message, bad:true}; }
    drawLinks(); drawNeeds(); say('');
  }
  async function moveLink(r, how){
    linkSaid=null;
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
      drawLinks(); drawNeeds(); say('');
      var mc=document.querySelector('[data-link="'+j.ref.id+'"]');
      if(mc&&mc.scrollIntoView&&!oLinks.hidden) mc.scrollIntoView({block:'center'});
    }catch(e){ linkSaid={id:r.id, t:e.message, bad:true}; drawLinks(); drawNeeds(); say(''); }
  }
  /* ---- NEEDS YOU (S9 9.1, the plan's section 5) -------------------------------------------------
     His home: one card a thing that waits on him, each with the one action it needs, in the system's Approve
     card. A link an associate made (Approve, the tier it quotes, Decline); an account whose customer is locked
     out (why, and Send a sign-in link); an ID with no account yet (the stranger's link until the laptop makes
     one, Send switched off); and the accounts nobody has been sent. Read off /all/sheet and /all/refs, the two
     reads the page makes anyway. A tap is answered on its own card. */
  var nlist=document.getElementById('nlist'), nCount=document.getElementById('nCount'), linksRead=false;
  function codeOf(u){ var a=OWNER.accounts.filter(function(x){ return x.username===u; })[0]; return (a&&a.code)||u||'An associate'; }
  function hm(iso){ try{ var p=klBits(iso); return p.hour+':'+p.minute; }catch(e){ return ''; } }
  function dayMon(iso){ try{ var p=klBits(iso); return +p.day+' '+MON3[+p.month-1]; }catch(e){ return ''; } }
  /* a moment today is its time, any other its day */
  function when(iso){ var t=dayMon(iso); return t===dayMon(new Date().toISOString())?hm(iso):t; }
  function andList(xs){ return xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1]; }
  var HOW={password:'password', link:'link', remembered:'a remembered phone'};
  function ghost(t, lit){ var b=el('button','salt-ghost'+(lit?' salt-ghost--lit':''),t); b.type='button'; return b; }
  function needCard(key, party, entry, reason){
    var c=el('article','salt-approve need'); c.setAttribute('data-need', key);
    var h=el('div','salt-approve__head');
    h.appendChild(el('span','salt-approve__party',party)); h.appendChild(el('span','salt-approve__entry',entry));
    c.appendChild(h);
    if(reason) c.appendChild(el('p','salt-approve__reason',reason));
    return c;
  }
  function noteOf(c){ var m=el('p','nnote'); m.setAttribute('role','status'); c.appendChild(m); return m; }
  /* the stranger's level is the ladder's last, and its standing link is what an ID with no account is shown */
  function lastLevel(){ return tiers.length>1?tiers[tiers.length-1]:''; }
  function strangerLink(){
    var s=lastLevel();
    return links.filter(function(r){ return r.standing&&r.level===s&&!r.revoked; })[0]||null;
  }
  /* A LINK SIGNS THEM IN IN TWO TAPS: the first makes it, the second shares it, so the share sheet never
     waits on a key derivation and a round trip inside one tap (the plan's must-not-ship list).
     S9 fix: WHAT A CARD HAS MADE OUTLIVES A REDRAW. Needs you is drawn afresh on every move, tick and read, and
     the made link and the open Silver link lived in the card, so a redraw put the button back to Send a sign-in
     link (the next tap minting a second) and took the code off the screen. They are kept here by username. */
  var madeLink={}, silverOpen={};
  function linkButton(a, note){
    var u=a.username, b=ghost('', true);
    function show(){
      var m=madeLink[u]||{};
      b.disabled=!!m.busy; b.textContent=m.busy?'Making it...':m.j?'Share the link':'Send a sign-in link'; note.textContent=m.note||'';
    }
    /* answered on this button, or on the one a redraw put in its place */
    function after(){ if(b.isConnected) show(); else drawNeeds(); }
    show();
    b.addEventListener('click', async function(){
      var m=madeLink[u]||(madeLink[u]={});
      if(m.busy) return;
      if(!m.j){
        m.busy=true; m.note=''; show();
        try{ m.j=await mintLink(a); m.note='Made. It signs '+(a.code||a.username)+' in once.'; }
        catch(e){ m.note='Could not make one: '+e.message; }
        m.busy=false; after(); return;
      }
      try{
        if(navigator.share){ await navigator.share({text:m.j.msg}); m.note='Sent.'; }
        else { await navigator.clipboard.writeText(m.j.msg); m.note='Copied. Paste it into a message to them.'; }
      }catch(e){ m.note='Not shared. Tap Share the link again.'; }
      after();
    });
    return b;
  }
  function linkNeed(r){
    var who=codeOf(r.by);
    var c=needCard('l:'+r.id, who, 'guest link, made '+when(r.made), 'A link for a friend. It opens nothing until you approve it.');
    if(moved&&moved.id===r.id){ noteOf(c).textContent=moved.t; return c; }
    if(tiers.length){
      var f=el('div','salt-field'), lab=el('label','salt-field__label','Their friend is quoted'), sel=el('select','fld salt-field__input');
      sel.id='npin'+r.id; lab.htmlFor=sel.id;
      var o0=el('option',null,'Follows '+who); o0.value=''; if(!r.level)o0.selected=true; sel.appendChild(o0);
      /* Ambassador is the floor and never a guest's */
      tiers.slice(1).forEach(function(t){ var o=el('option',null,t); o.value=t; if(r.level===t)o.selected=true; sel.appendChild(o); });
      sel.addEventListener('change', function(){ setLevel(r, sel.value); });
      f.appendChild(lab); f.appendChild(sel); c.appendChild(f);
    }
    var row=el('div','salt-approve__actions'), ap=ghost('Approve', true), de=ghost('Decline');
    ap.addEventListener('click', function(){ moveLink(r,'approve'); });
    de.addEventListener('click', function(){ moveLink(r,'decline'); });
    row.appendChild(ap); row.appendChild(de); c.appendChild(row);
    saidOn(r, noteOf(c));
    return c;
  }
  function lockNeed(a){
    var L=a.locked, s=a.seen;
    var c=needCard('k:'+a.username, a.code||a.username, 'locked out',
      'Ten wrong passwords from '+(L.from>1?L.from+' addresses':'one address')+'.'
      +(L.until?' Opens again at '+hm(L.until)+'.':'')
      +(s&&s.opens?' Last got in by '+(HOW[s.how]||'password')+', '+dayMon(s.last)+'.':' Has never got in.'));
    var row=el('div','salt-approve__actions');
    c.appendChild(row);
    row.appendChild(linkButton(a, noteOf(c)));
    /* Show a code, in person, is stage 3's (showHandover): the card takes it the moment it is on the page */
    if(typeof showHandover==='function'){ var sc=ghost('Show a code'); sc.addEventListener('click', function(){ showHandover(a, sc); }); row.appendChild(sc); }
    return c;
  }
  function bareNeed(a){
    var lv=lastLevel()||"stranger's";
    var c=needCard('n:'+a.username, a.code||a.username, 'no account yet',
      'Made at the next laptop update. Until then, show the '+lv+' link.');
    var row=el('div','salt-approve__actions'), sh=ghost('Show the '+lv+' link', true), off=ghost('Send, after the update');
    off.disabled=true; off.title='No account behind this username yet';
    row.appendChild(sh); row.appendChild(off); c.appendChild(row);
    var note=noteOf(c);
    function open(){
      var r=strangerLink();
      if(!r){ note.textContent='The '+lv+' link is not made yet. Open Links once, then try again.'; return; }
      silverOpen[a.username]=true;
      var box=el('div','glink'), img=document.createElement('img'), cp=ghost('Copy link');
      box.appendChild(el('code','gu',r.url));
      img.src=r.qr; img.alt='QR to the '+lv+' guest price list'; img.width=180; img.height=180; box.appendChild(img);
      cp.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); note.textContent='Copied.'; }catch(e){ note.textContent='Copy failed.'; }
      });
      box.appendChild(cp);
      c.insertBefore(box, row); sh.disabled=true;
    }
    sh.addEventListener('click', open);
    if(silverOpen[a.username]) open();
    return c;
  }
  function sendNeed(rows){
    var codes=rows.map(function(a){ return a.code||a.username; }), first=rows.map(function(a){ return a.issued||''; }).sort()[0];
    var named=codes.length>6?codes.slice(0,5).concat([(codes.length-5)+' more']):codes;
    var c=needCard('s', rows.length+' to send', first?'ready since '+dayMon(first):'',
      andList(named)+(rows.length===1?' has an account':' have accounts')+' and no sign-in yet.');
    var row=el('div','salt-approve__actions'), go=ghost('Send them in turn', true);
    go.addEventListener('click', function(){ turn={rows:rows.slice(), i:0, sent:[], j:null, why:''}; turnStep(); });
    row.appendChild(go); c.appendChild(row);
    return c;
  }
  /* ---- SEND THEM IN TURN (S9 9.6) --------------------------------------------------------------
     One account at a time, in the card's own order: its sign-in link is made as its turn opens, Share is a tap
     of its own (so the share sheet never waits on the making), and once shared the account is ticked sent, the
     site's tick both his devices read, before the next turn opens. Skip leaves one unticked. The run is state
     the card is drawn from, so a redraw of Needs you in the middle of it loses nothing. */
  var turn=null;
  /* S9 fix: a note carried from the turn before (a share whose tick did not save) is drawn on the next turn's
     card; it was cleared here before anything drew it */
  function turnStep(note){
    var t=turn; if(!t) return;
    t.j=null; t.copied=false; t.why=note||'';
    drawNeeds();
    if(t.i>=t.rows.length) return;
    var at=t.i;
    mintLink(t.rows[at]).then(function(j){ if(turn===t&&t.i===at){ t.j=j; drawNeeds(); } },
      function(e){ if(turn===t&&t.i===at){ t.why=(t.why?t.why+' ':'')+'Could not make their link: '+e.message; drawNeeds(); } });
  }
  /* S9 fix: ONE SHARE AT A TIME. The tick is awaited after the share, and a second tap in that window shared the
     same link again and stepped twice, so the next account was never shared or ticked and the end said all were
     sent. Share and Skip wait while one is in flight, and the end counts the accounts ticked, not the taps. */
  /* S9 fix: WITH NO SHARE SHEET, SHARE COPIES AND TICKS NOTHING. A copied message is not a sent one, so the tick
     both his devices read waits for his own Sent it, once he has pasted it. */
  async function turnShare(){
    var t=turn, a=t&&t.rows[t.i];
    if(!a||!t.j||t.busy) return;
    t.busy=true; drawNeeds();
    if(!t.copied){
      try{
        if(navigator.share) await navigator.share({text:t.j.msg});
        else { await navigator.clipboard.writeText(t.j.msg); t.copied=true; t.busy=false; t.why='Paste it into a message to them, then tap Sent it.'; drawNeeds(); return; }
      }catch(e){ t.busy=false; t.why='Not shared. Tap Share again, or Skip.'; drawNeeds(); return; }
    }
    var note='';
    try{ var r=await refs('/all/sent/'+a.username, {issue:sheetIssue, sent:true}); a.sent=r.sent; t.sent.push(a.username); }
    catch(e){ note=(a.code||a.username)+' was shared, but the tick did not save: '+e.message; }
    t.busy=false; t.i++; countSent(); drawRoster(); turnStep(note);
  }
  function turnCard(){
    var t=turn, n=t.rows.length, fin=t.i>=n, a=t.rows[t.i];
    var did=t.rows.filter(function(x){ return t.sent.indexOf(x.username)>=0; }).length;
    var c=needCard('s', fin?'All done':(t.i+1)+' of '+n, did+' of '+n+' sent',
      fin?(did===n?'Each has their link, and each is ticked sent.':'The ones not ticked are still on Accounts, under Not sent.')
        :(a.code||a.username)+(t.copied?': their message is copied.':t.j?': their link is made. Share it and it is ticked sent.':': making their link.'));
    var ticks=el('div','achips');
    t.rows.forEach(function(x, k){ var did=t.sent.indexOf(x.username)>=0;
      ticks.appendChild(chip(did?'verdigris':(k===t.i?'brass':'mist'), (x.code||x.username)+(did?', sent':''))); });
    c.appendChild(ticks);
    var row=el('div','salt-approve__actions');
    if(fin){ var dn=ghost('Done', true); dn.addEventListener('click', function(){ turn=null; drawNeeds(); }); row.appendChild(dn); }
    else {
      var sh=el('button','salt-pill salt-pill--md',t.copied?'Sent it':'Share'); sh.type='button'; sh.disabled=!t.j||!!t.busy; sh.addEventListener('click', turnShare);
      var sk=ghost('Skip'); sk.disabled=!!t.busy; sk.addEventListener('click', function(){ if(turn.busy) return; turn.i++; turnStep(); });
      row.appendChild(sh); row.appendChild(sk);
    }
    c.appendChild(row);
    noteOf(c).textContent=t.why;
    return c;
  }
  function drawNeeds(){
    if(!nlist) return;
    nlist.textContent='';
    var real=sheetRows.filter(function(a){ return !a.test; }), n=0;
    var add=function(c, counts){ nlist.appendChild(c); if(counts) n++; };
    /* a link he has just moved stays where he tapped it, saying what happened, and is no longer counted */
    links.filter(function(r){ return waitingLink(r)||(moved&&moved.id===r.id&&!r.standing&&r.by); })
      .forEach(function(r){ add(linkNeed(r), waitingLink(r)&&!(moved&&moved.id===r.id)); });
    real.filter(function(a){ return a.account&&a.locked; }).forEach(function(a){ add(lockNeed(a), true); });
    real.filter(function(a){ return a.account===false; }).forEach(function(a){ add(bareNeed(a), true); });
    var fresh=real.filter(function(a){ return a.account&&!a.sent&&!(a.seen&&a.seen.opens); });
    if(turn||fresh.length) add(turn?turnCard():sendNeed(fresh), fresh.length>0);
    setCount('needs', n); setCount('links', links.filter(waitingLink).length);
    /* S9 9.8: what waits on the desk, as the desk last told the site; a count, with no link and no name */
    var dw=document.getElementById('nDesk'), dn=deskWait?deskWait.n:0;
    dw.hidden=!deskWait;
    document.getElementById('nDeskT').textContent=dn?dn+(dn===1?' thing waits':' things wait')+' on the desk.':'Nothing waits on the desk.';
    nCount.textContent=(!sheet||!linksRead)?'Reading what needs you.'
      :(n?n+(n===1?' thing':' things'):'Nothing needs you')+', as at '+hm(new Date().toISOString())+'.';
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
  /* a place, an item on More, or a way back: one listener for the whole of his page */
  roster.addEventListener('click', function(ev){
    var bk=ev.target.closest('button[data-back]');
    if(bk){ if(bk.getAttribute('data-back')==='accounts') openCard(null); else panel(bk.getAttribute('data-back')||null); return; }
    var b=ev.target.closest('button[data-m]'); if(b) panel(b.getAttribute('data-m'));
  });
  document.getElementById('afil').addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-f]'); if(b) filterBy(b.getAttribute('data-f'));
  });
  rq.addEventListener('input', drawRoster);
  panel(null);
  /* the home itself needs the account list and the links: Needs you is read off both (S9 9.1) */
  loadSheet(); loadLinks();
`;
