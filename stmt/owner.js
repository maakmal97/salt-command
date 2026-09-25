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
     says. D15 (24 Sep 2026): the fold binds a spare account at Add ID and this run's publish opens it,
     so a row reads this only when no spare was free, and the laptop's next update makes it. The level
     is the stranger's, named by the book through the sheet, never here; S9 fix: the sheet is the one
     source, so Needs you, a row and a card say the same level the moment the sheet lands, whether or not
     the links have. */
  var stranger=null;
  function waitLine(){ return 'Made at the next laptop update.'+(stranger?' Until then, show the '+stranger+' link.':''); }
  function flagLine(a){
    if(!a.t||!a.flag) return waitLine();
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
      sheet={}; sheetAt=j.at||null; sheetRows=j.accounts||[]; sheetIssue=j.issue||null; deskWait=j.desk||null; stranger=j.stranger||null;
      sheetRows.forEach(function(a){ sheet[a.username]=a; });
      drawRoster(); drawTest(); drawNeeds(); drawNeedOpen(true);
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
  /* v710's one-time link, minted for one account on keyFor: only the token's hash and the wrap reach the Worker,
     which answers with the finished words. The card's Sign-in link, Needs you and Send them in turn all make it here. */
  async function mintLink(a){
    var k=await keyFor(a);
    var j=await refs('/all/signin/'+encodeURIComponent(a.username), {token:k.token, wrap:k.wrap});
    k=null;
    return j;
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
  /* ---- AN ACCOUNT (S9 9.3, the plan's f13) ----------------------------------------------------------
     What a row opens: its code and username, the chips, ONE filled Send a sign-in link with its answer under it, and
     beside it the other ways, Show a code in person, View as them, Copy password and Sign out everywhere; then how
     they got in. THE LINK IS MADE AS THE ACCOUNT OPENS (the plan's must-not-ship list: never a key derivation and a
     fetch inside the share's tap), so the tap shares and does nothing before it. It is kept by username with Needs
     you's (madeLink), so a redraw, or the same account's card on Needs you, never makes a second; a share that goes
     through ticks the account sent, and a link shared or copied from any card is dropped and a fresh one made
     (retire). A username with no account makes nothing and posts nothing, and every control says why it is off. The password is opened on its own tap, straight to the
     clipboard, never into the page. */
  var story={};
  /* the link moved: every Send a sign-in link drawn for that account is painted from madeLink, including one a redraw
     put in the place of the button that asked (a sheet read lands while the link is being made), and Needs you with it */
  /* S9 fix: a link that could not be made leaves the pill on, as Try again, whose tap makes it again and shares nothing */
  function paintPill(b){
    var m=madeLink[b.getAttribute('data-pill')]||{}, again=!m.j&&!m.busy&&!!m.fail;
    b.disabled=b.getAttribute('data-none')==='1'||(!m.j&&!again);
    b.textContent=m.busy?'Making the link...':again?'Try again':'Send a sign-in link';
    if(b.note){ b.note.textContent=m.note||''; b.note.className='anote'+(m.bad?' bad':''); }
  }
  function paintPills(u){ [].slice.call(document.querySelectorAll('[data-pill]')).forEach(function(b){ if(b.getAttribute('data-pill')===u) paintPill(b); }); }
  function linkMoved(u){ if(!docLive()) return; paintPills(u); if(!mHome.hidden) drawNeeds(); }
  function makeLink(a){
    var u=a.username, m=madeLink[u]||(madeLink[u]={});
    if(m.j||m.busy||a.account===false) return;
    if(m.fail){ m.fail=false; m.bad=false; m.note=''; }
    m.busy=true;
    mintLink(a).then(function(j){ m.j=j; m.busy=false; linkMoved(u); },
      function(e){ m.busy=false; m.fail=m.bad=true; m.note='Could not make a link: '+e.message; linkMoved(u); });
  }
  function sendPill(a, note, onSent){
    var u=a.username, b=el('button','salt-pill salt-pill--md apill','Send a sign-in link'); b.type='button';
    b.setAttribute('data-pill', u); b.note=note;
    if(a.account===false){ b.setAttribute('data-none','1'); b.title='No account behind this username yet'; }
    paintPill(b); makeLink(a);
    b.addEventListener('click', function(){
      var m=madeLink[u];
      if(!m||!m.j){ if(m&&m.fail&&!m.busy){ makeLink(a); linkMoved(u); } return; }
      var msg=m.j.msg, p;
      /* the tap's first act, before anything that waits: the share sheet, or with none the clipboard */
      try{ p=navigator.share?navigator.share({text:msg}).then(function(){ return 'sent'; })
        :navigator.clipboard.writeText(msg).then(function(){ return 'copied'; }); }
      catch(e){ p=Promise.reject(e); }
      p.then(async function(how){
        if(how==='copied'){ retire(a, 'Copied. Paste it into a message to them, then tick Sent.'); linkMoved(u); return; }
        var said=madeLink[u]={note:'Sent. It signs them in once; the next tap sends a new one.'};
        markOut(u, m.j); linkMoved(u);
        try{ var r=await refs('/all/sent/'+u, {issue:sheetIssue, sent:true}); a.sent=r.sent; countSent(); drawRoster(); onSent(); }
        catch(e){ said.note='Sent, but the tick did not save: '+e.message; said.bad=true; }
        makeLink(a); linkMoved(u);
      }, function(){ m.note=navigator.share?'Not shared. Tap Send a sign-in link again.':'Not copied: this browser refused the clipboard.'; m.bad=true; linkMoved(u); });
    });
    return b;
  }
  /* HOW THEY GOT IN (/all/account/<u>): each way in, newest first, with its moment and the kind of device it was used
     on, as the browser described itself then, never an address; a password refused at an address stands above them */
  /* S9 fix: a code his counter showed is scanned; a customer's own is copied across; key, before the two were told apart */
  var HOWW={link:'Sign-in link', qr:'Code, scanned', copy:'Code, copied across', key:'Code', code:'Code, typed', password:'Password'};
  function lineRow(label, value, flag){
    var r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), v=el('span','salt-ledger__value');
    l.appendChild(el('span','salt-ledger__label',label));
    if(value) v.appendChild(value);
    l.appendChild(v); r.appendChild(l);
    if(flag) r.appendChild(el('span','salt-ledger__flag',flag));
    return r;
  }
  function onWhat(where){ return where?' on '+String(where).replace(/^A /,'a '):''; }
  function drawStory(box, a){
    var s=story[a.username];
    box.textContent='';
    box.appendChild(el('h3','salt-eyebrow salt-eyebrow--copper','How they got in'));
    var list=el('div','salt-ledger salt-ledger--plain'), L=a.locked;
    if(L) list.appendChild(lineRow('Password', chip('alarm','Refused'),
      'Ten wrong '+(L.from>1?'from each of '+L.from+' addresses':'from one address')+(L.until?', shut there till '+hm(L.until):'')+'.'));
    var log=(s&&s.log)||[];
    log.forEach(function(x){
      list.appendChild(lineRow(HOWW[x.how]||'Signed in', x.how==='password'?null:chip('verdigris','Used'), dayMon(x.at)+', '+hm(x.at)+onWhat(x.where)));
    });
    if(!s) list.appendChild(lineRow('Reading how they got in.', null, ''));
    else if(s.err) list.appendChild(lineRow('Not read', null, s.err));
    else if(!log.length) list.appendChild(a.seen&&a.seen.opens
      ?lineRow('Last opened', null, dayMon(a.seen.last)+(howOf(a.seen)?', '+howOf(a.seen):'')+'. Earlier ways in were not kept.')
      :lineRow('Not opened yet', null, a.sent?'Sent '+dayMon(a.sent)+'.':''));
    box.appendChild(list);
    /* S9 9.4: PHONES AND COMPUTERS, off the account's own pointers: each device named as its browser described itself when
       it signed in, when it came and when it was last used, whether it is kept signed in, and a Sign out of its own */
    var devs=(s&&s.devices)||[], dh=el('h3','salt-eyebrow salt-eyebrow--copper dhead','Phones and computers');
    if(devs.length) dh.appendChild(el('span','dcount',String(devs.length)));
    box.appendChild(dh);
    var dl=el('div','salt-ledger salt-ledger--plain');
    devs.forEach(function(d){
      var so=ghost('Sign out');
      so.addEventListener('click', function(){ endOne(a, d, so); });
      dl.appendChild(lineRow(d.label||'A device named before this list began', so, d.kept
        ?'Kept signed in since '+dayMon(d.at)+', last used '+when(d.last)+'.'
        :'Signed in '+when(d.at)+' for this visit, not kept.'));
    });
    if(s&&!s.err&&!devs.length) dl.appendChild(lineRow('None signed in', null, 'A sign-in link or a code signs them in.'));
    box.appendChild(dl);
  }
  async function endOne(a, d, b){
    b.disabled=true; b.textContent='Signing out...';
    try{ await refs('/all/signout', {u:a.username, id:d.id}); loadStory(a); }
    catch(e){ b.textContent='Not signed out'; b.title=e.message; b.disabled=false; }
  }
  /* what Sign out everywhere ended, in words */
  function endedLine(j){
    var n=function(x, one, many){ return x+' '+(x===1?one:many); }, parts=[];
    if(j.devices) parts.push(n(j.devices,'device','devices'));
    if(j.links) parts.push(n(j.links,'link or code not yet used','links and codes not yet used'));
    if(j.phones) parts.push('alerts on '+n(j.phones,'phone','phones'));
    return parts.length?'Signed out: '+andList(parts)+'.':'Nothing was signed in.';
  }
  /* a link named by its token's hash, as the site files it */
  async function tokHash(j){
    var t=j?String(j.url||'').split('/s/')[1]||'':'';
    if(!t) return '';
    var h=new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
    return [].map.call(h, function(x){ return (x<16?'0':'')+x.toString(16); }).join('');
  }
  /* the link his own page made as the account opened, which Sign out everywhere spares */
  function linkId(u){ var m=madeLink[u]; return tokHash(m&&m.j); }
  /* S9 fix: A LINK THAT HAS LEFT THE PAGE IS MARKED SO ON THE SITE (POST /all/out), so Sign out everywhere counts it among
     those not yet used and never spares it; one made as an account opened and never sent is burnt with them, uncounted.
     Best effort: a mark that does not land costs the count, never the burning. */
  function markOut(u, j){ tokHash(j).then(function(id){ return id?refs('/all/out', {u:u, id:id}):null; }).catch(function(){}); }
  async function loadStory(a){
    var u=a.username, j=null, err='';
    try{ j=await refs('/all/account/'+encodeURIComponent(u)); }catch(e){ err=e.message; }
    if(!docLive()) return;
    story[u]=j?{log:j.log||[], devices:j.devices||[]}:{err:err};
    [].slice.call(document.querySelectorAll('[data-story]')).forEach(function(b){ if(b.getAttribute('data-story')===u) drawStory(b, a); });
  }
  function acctCard(a){
    var u=a.username, none=a.account===false, why='No account behind this username yet';
    var c=el('section','oacct scard'); c.setAttribute('data-acct', u);
    var h=el('div','ahead srow');
    h.appendChild(el('h2',null,a.test?'Test account':(a.code||u)));
    h.appendChild(el('span','un',u));
    c.appendChild(h);
    var cs=el('div','achips');
    function chips(){ cs.textContent=''; if(sheet) chipsOf(a).forEach(function(x){ cs.appendChild(x); }); }
    chips(); c.appendChild(cs);
    if(a.test) c.appendChild(el('p','atot','Counts nowhere; nothing on the book is behind it.'));
    else if(none) c.appendChild(el('p','atot',waitLine()));
    else if(a.tot) c.appendChild(el('p','atot',a.tot));
    var box=document.createElement('input');
    var pn=el('p','anote'); pn.setAttribute('role','status');
    c.appendChild(sendPill(a, pn, function(){ box.checked=!!a.sent; chips(); }));
    c.appendChild(pn);
    var grid=el('div','agrid'), gn=el('p','anote'); gn.setAttribute('role','status');
    var hob=ghost('Show a code, in person'), open=ghost('View as them'), pwb=ghost('Copy password'), sob=ghost('Sign out everywhere');
    pwb.classList.add('salt-ghost--danger'); sob.classList.add('salt-ghost--danger');
    [hob, open, pwb, sob].forEach(function(b){ if(none){ b.disabled=true; b.title=why; } grid.appendChild(b); });
    if(!none&&!a.pwMaster){ pwb.disabled=true; pwb.title='Not sealed yet: run tools/stmt-seal.mjs on the laptop'; }
    hob.addEventListener('click', function(){ if(!none) showHandover(a, hob); });
    /* S9 9.5: View as them, their own page, read only */
    open.addEventListener('click', function(){ openAcct(a); });
    pwb.addEventListener('click', async function(){
      if(none||!a.pwMaster) return;
      pwb.disabled=true; pwb.textContent='Opening...';
      try{
        var pw=await unseal(OWNER.master, a.pwMaster);
        await navigator.clipboard.writeText(pw);
        pw=null;
        pwb.textContent='Password copied';
      }catch(e){ pwb.textContent='Could not open it'; }
      setTimeout(function(){ pwb.textContent='Copy password'; pwb.disabled=false; }, 2200);
    });
    /* SIGN OUT EVERYWHERE, on a second tap within four seconds: a forwarded link or a lost phone stays signed in while
       it is used, so this ends every device, link, code and alert on the account (S9 9.4), sparing the link this page
       made as the account opened and has not sent, and says what it ended; a new link or a code signs them back in */
    var soArmed=null;
    sob.addEventListener('click', async function(){
      if(none) return;
      if(!soArmed){ sob.textContent='Tap again to sign them out'; soArmed=setTimeout(function(){ soArmed=null; sob.textContent='Sign out everywhere'; }, 4000); return; }
      clearTimeout(soArmed); soArmed=null; sob.disabled=true; sob.textContent='Signing out...';
      try{ var j=await refs('/all/signout', {u:u, keep:await linkId(u)}); gn.textContent=endedLine(j); gn.className='anote'; }
      catch(e){ gn.textContent='Could not sign out: '+e.message; gn.className='anote bad'; }
      sob.textContent='Sign out everywhere'; sob.disabled=false;
      loadStory(a);
    });
    c.appendChild(grid); c.appendChild(gn);
    var tick=el('label','tick');
    box.type='checkbox'; box.checked=!!a.sent; box.disabled=none;
    box.addEventListener('change', async function(){
      var want=box.checked;
      try{
        var j=await refs('/all/sent/'+u, {issue:sheetIssue, sent:want});
        a.sent=j.sent; chips(); say(''); countSent(); drawRoster(); drawNeeds();
      }catch(e){ box.checked=!want; say(e.message,'bad'); }
    });
    tick.appendChild(box); tick.appendChild(el('span',null,'Sent'));
    c.appendChild(tick);
    var st=el('div','astory'); st.setAttribute('data-story', u);
    if(!none){ c.appendChild(st); drawStory(st, a); loadStory(a); }
    return c;
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
    if(sheet&&sheet[a.username]&&sheet[a.username].account===false){ say(waitLine(),'bad'); return; }
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
    claims=(j&&Array.isArray(j.claims))?j.claims:[];   /* S6 6.6: their account's claims, as their page reads them */
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
  /* HOW AN OPEN CAME: the road markSeen recorded. Stage 3's hand-over records qr (his counter's code, scanned), copy (a
     customer's own, copied across) and code (typed), and key where it was one word for the first two; a road this
     page does not know says no road, and only an open with none at all, from before v827 when the password was the
     one road recorded, was by password. */
  var HOW={password:'by password', link:'by link', remembered:'on a remembered phone', qr:'by a scanned code', copy:'by a copied code', key:'by a code', code:'by a typed code'};
  function howOf(s){ return s.how?HOW[s.how]||'':HOW.password; }
  function chip(tone, t){ return el('span','salt-status salt-status--'+tone, t); }
  function chipsOf(a){
    if(a.test) return [chip('mist','Test, counts nowhere')];
    if(a.account===false) return [chip('alarm','No account')];
    var out=[];
    if(a.locked) out.push(chip('alarm','Refused at '+(a.locked.from>1?a.locked.from+' addresses':'1 address')+(a.locked.until?' till '+hm(a.locked.until):'')));
    if(a.flag&&a.flag!=='clear') out.push(chip({owes:'ember', goods:'steel', refund:'brass', pend:'copper'}[a.flag]||'mist', flagLine(a)));
    out.push(a.seen&&a.seen.opens?chip('mist','Opened '+dayMon(a.seen.last)+(howOf(a.seen)?' '+howOf(a.seen):'')):chip('steel','Not opened'));
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
    /* a code with no account says, on its row, when it is made and which link to show until then (D15) */
    main.appendChild(el('span','salt-inbox-row__what', a.username+(a.account===false?', '+waitLine():a.tot?', '+a.tot:'')));
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
    acctPane(aopen, a);
    try{ window.scrollTo(0,0); }catch(e){}
  }
  /* an account as it opens (S9 9.3) */
  function acctPane(box, a){ box.appendChild(acctCard(a)); }
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
  function codeByUser(u){ var a=OWNER.accounts.filter(function(x){ return x.username===u; })[0]; return (a&&a.code)||u||'An associate'; }
  function hm(iso){ try{ var p=klBits(iso); return p.hour+':'+p.minute; }catch(e){ return ''; } }
  function dayMon(iso){ try{ var p=klBits(iso); return +p.day+' '+MON3[+p.month-1]; }catch(e){ return ''; } }
  /* a moment today is its time, any other its day */
  function when(iso){ var t=dayMon(iso); return t===dayMon(new Date().toISOString())?hm(iso):t; }
  function andList(xs){ return xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1]; }
  function ghost(t, lit){ var b=el('button','salt-ghost'+(lit?' salt-ghost--lit':''),t); b.type='button'; return b; }
  function needCard(key, party, entry, reason, u){
    var c=el('article','salt-approve need'); c.setAttribute('data-need', key);
    var h=el('div','salt-approve__head');
    /* S9 fix: a card about an account opens it, beside the list from 1080px and on Accounts on a phone */
    var p=el(u?'button':'span','salt-approve__party',party);
    if(u){ p.type='button'; p.setAttribute('aria-label','Open '+party); c.setAttribute('data-u', u); p.addEventListener('click', function(){ openNeed(u); }); }
    h.appendChild(p); h.appendChild(el('span','salt-approve__entry',entry));
    c.appendChild(h);
    if(reason) c.appendChild(el('p','salt-approve__reason',reason));
    return c;
  }
  function noteOf(c){ var m=el('p','nnote'); m.setAttribute('role','status'); c.appendChild(m); return m; }
  /* S9 fix: FROM 1080PX NEEDS YOU STANDS BESIDE AN ACCOUNT (the plan's f13w), as Accounts does: the one he opened
     from a card, else the first card's about an account. The pane is drawn again only when its account changes or
     the sheet is read again, so a redraw of the list never takes a tap in flight off the open card. */
  var nopen=document.getElementById('nopen'), nOpen=null;
  function wide(){ return !!(window.matchMedia&&window.matchMedia('(min-width:1080px)').matches); }
  function openNeed(u){
    if(!wide()){ panel('accounts'); openCard(u); return; }
    nOpen=u; drawNeedOpen(true);
  }
  function drawNeedOpen(force){
    if(!nOpen&&wide()){ var first=nlist.querySelector('[data-u]'); nOpen=first?first.getAttribute('data-u'):null; }
    var a=nOpen&&sheet&&sheet[nOpen];
    [].slice.call(nlist.querySelectorAll('[data-u]')).forEach(function(c){
      if(c.getAttribute('data-u')===nOpen) c.setAttribute('aria-current','true'); else c.removeAttribute('aria-current'); });
    if(!force&&nopen.getAttribute('data-u')===(a?nOpen:'')) return;
    mHome.classList.toggle('open', !!a); nopen.hidden=!a; nopen.textContent=''; nopen.setAttribute('data-u', a?nOpen:'');
    if(a) acctPane(nopen, a);
  }
  /* the stranger's standing link is what an ID with no account is shown */
  function strangerLink(){
    return links.filter(function(r){ return r.standing&&r.level===stranger&&!r.revoked; })[0]||null;
  }
  /* A LINK SIGNS THEM IN IN TWO TAPS: the first makes it, the second shares it, so the share sheet never
     waits on a key derivation and a round trip inside one tap (the plan's must-not-ship list).
     S9 fix: WHAT A CARD HAS MADE OUTLIVES A REDRAW. Needs you is drawn afresh on every move, tick and read, and
     the made link and the open Silver link lived in the card, so a redraw put the button back to Send a sign-in
     link (the next tap minting a second) and took the code off the screen. They are kept here by username. */
  var madeLink={}, silverOpen={};
  /* S9 fix: A LINK THAT HAS LEFT THE PAGE IS NEVER THE ONE KEPT. Sign out everywhere spares the link this page holds
     (linkId), so a link shared or copied, from any card, is dropped here, and a fresh one made wherever a Send a
     sign-in link is drawn for the account; a forwarded link is then ended with the rest. */
  function retire(a, note){
    var u=a.username, was=madeLink[u]; madeLink[u]={note:note};
    if(was&&was.j) markOut(u, was.j);
    if([].some.call(document.querySelectorAll('[data-pill]'), function(b){ return b.getAttribute('data-pill')===u; })) makeLink(a);
  }
  function linkButton(a, note){
    var u=a.username, b=ghost('', true);
    function paint(){
      var m=madeLink[u]||{};
      b.disabled=!!m.busy; b.textContent=m.busy?'Making it...':m.j?'Share the link':'Send a sign-in link'; note.textContent=m.note||'';
    }
    /* answered on this button, or on the one a redraw put in its place */
    function after(){ if(!docLive()) return; paintPills(u); if(b.isConnected) paint(); else drawNeeds(); }
    paint();
    b.addEventListener('click', async function(){
      var m=madeLink[u]||(madeLink[u]={});
      if(m.busy) return;
      if(!m.j){
        m.busy=true; m.note=''; paint();
        try{ m.j=await mintLink(a); m.note='Made. It signs '+(a.code||a.username)+' in once.'; }
        catch(e){ m.note='Could not make one: '+e.message; }
        m.busy=false; after(); return;
      }
      try{
        if(navigator.share){ await navigator.share({text:m.j.msg}); retire(a, 'Sent.'); }
        else { await navigator.clipboard.writeText(m.j.msg); retire(a, 'Copied. Paste it into a message to them.'); }
      }catch(e){ m.note='Not shared. Tap Share the link again.'; }
      after();
    });
    return b;
  }
  function linkNeed(r){
    var who=codeByUser(r.by);
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
  /* S9 fix: WHAT THE BRAKE KNOWS, NOT A LOCKED-OUT CUSTOMER. It refuses the address the misses came from, and
     that may be anybody holding the username, so the card says an address is refused and offers the link that
     lets the customer in if it was them, never that they are shut out. */
  function lockNeed(a){
    var L=a.locked, s=a.seen, at=L.from>1?L.from+' addresses':'one address';
    var c=needCard('k:'+a.username, a.code||a.username, 'refused at '+at,
      'Ten wrong passwords '+(L.from>1?'each ':'')+'from '+at+', refused there'+(L.until?' until '+hm(L.until):'')+'.'
      +' If it was them, a sign-in link lets them in.'
      +(s&&s.opens?' Last got in'+(howOf(s)?' '+howOf(s):'')+', '+dayMon(s.last)+'.':' Has never got in.'), a.username);
    var row=el('div','salt-approve__actions');
    c.appendChild(row);
    row.appendChild(linkButton(a, noteOf(c)));
    /* and Show a code, in person, stage 3's hand-over (showHandover), for a customer at his counter */
    var sc=ghost('Show a code'); sc.addEventListener('click', function(){ showHandover(a, sc); }); row.appendChild(sc);
    return c;
  }
  function bareNeed(a){
    var lv=stranger||"stranger's";
    var c=needCard('n:'+a.username, a.code||a.username, 'no account yet', waitLine(), a.username);
    var row=el('div','salt-approve__actions'), sh=ghost('Show the '+lv+' link', true), off=ghost('Send, after the update');
    off.disabled=true; off.title='No account behind this username yet';
    row.appendChild(sh); row.appendChild(off); c.appendChild(row);
    var note=noteOf(c);
    function openSilver(){
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
    sh.addEventListener('click', openSilver);
    if(silverOpen[a.username]) openSilver();
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
        if(navigator.share){ await navigator.share({text:t.j.msg}); markOut(a.username, t.j); }
        else { await navigator.clipboard.writeText(t.j.msg); markOut(a.username, t.j); t.copied=true; t.busy=false; t.why='Paste it into a message to them, then tap Sent it.'; drawNeeds(); return; }
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
    /* S9 9.8 fix: the desk's own Waiting on you count, as fresh as the desk's last read, so it says when that was.
       S9 fix: and in the past tense, saying so, once an order has moved since that reading */
    var dAt=deskWait&&deskWait.at?' as at '+when(deskWait.at):'';
    document.getElementById('nDeskT').textContent=deskWait&&deskWait.moved
      ?(dn?dn+(dn===1?' thing':' things')+' waited on the desk':'Nothing waited on the desk')+dAt+', and an order has moved since.'
      :(dn?dn+(dn===1?' thing waits':' things wait')+' on the desk':'Nothing waits on the desk')+(dAt?','+dAt:'')+'.';
    nCount.textContent=(!sheet||!linksRead)?'Reading what needs you.'
      :(n?n+(n===1?' thing':' things'):'Nothing needs you')+', as at '+hm(new Date().toISOString())+'.';
    drawNeedOpen(false);
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
