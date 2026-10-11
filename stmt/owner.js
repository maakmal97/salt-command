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
 * WHAT IT DRAWS. Five places (his decision of 11 Oct 2026): Needs you, a card for each thing waiting on him with its
 * action on it; Orders, the Counter's orders by stage, the payments customers say they sent and the group orders;
 * Customers, the accounts (one list, read off /all/sheet, the publish's account list merged with the opens this
 * Worker records, a row opening the account's card), their messages, guest links and the associates' report card;
 * Record, the Desk's rows waiting for him and his own entries; and Shop, the hours, the notice, the practice
 * accounts and This device, whose Look is Night or Tide for this page. View as them opens the account the customer's own way,
 * through the form. */

import { MAKER_GEO_JS } from "./maker-geo.js";

export const OWNER_JS = `
  var makerGeo=${MAKER_GEO_JS};
  var mHome=document.getElementById('mHome'), oAccts=document.getElementById('oAccts'),
      oLinks=document.getElementById('oLinks'), aopen=document.getElementById('aopen'),
      sheet=null, sheetAt=null, sheetRows=[], sheetIssue=null, cards=null, deskWait=null, sheetBusy=false;
  /* 11 Oct 2026: EVERY CONTROL CARRIES A STABLE data-act, "<place>.<thing>", named by what the control does and never by its words, so a
     later change of label, class or layout leaves whatever finds a control by its act where it was (docs/STATEMENTS.md). A control drawn
     once for each item of a list also carries the item's id as data-key. Where a helper makes the control, its label may be
     [words, act, key]: the words it shows and the act it is found by sit side by side. */
  function actOn(e, name, key){
    if(name) e.setAttribute('data-act', name);
    if(name&&key!=null&&key!=='') e.setAttribute('data-key', String(key));
    return e;
  }
  function labOf(x){ return Array.isArray(x)?x:[x]; }
  /* ---- THE FIVE PLACES (his decision of 11 Oct 2026) ------------------------------------------------------
     Needs you, Orders, Customers, Record and Shop. A place but Needs you has parts, a strip of the system's tabs; the markup
     (stmt/page.js) says which place and part each section shows in, in data-in, and this decides what is on screen, what each read
     brings in, and the address. The place is read on entering it, a part on entering the part, and what neither shows is never read:
     entering Shop reads no order and entering Orders reads no form. Nothing changes below the screen: every route, request body, id
     and retained send is as it was. Re-entering a place reads again, as it always did. */
  var placeNow='needs', partNow='', PARTS={}, fOpen=null;
  [].forEach.call(document.querySelectorAll('.aparts'), function(strip){
    PARTS[strip.getAttribute('data-place')]=[].map.call(strip.querySelectorAll('[data-part]'), function(b){ return b.getAttribute('data-part'); });
  });
  /* what a place reads when it is entered, and what a part reads when it is entered. The stages of Orders are one list that its
     place reads once, so moving between them is a filter and never a second read. */
  var PLACE_READ={
    needs:function(){ drawNeeds(); readNeeds(); },
    orders:function(){ loadMaker(); loadMakerClaims(); },
    record:function(){ loadMakerInputs(); }
  };
  var PART_READ={
    'orders.group':function(){ loadMakerPools(); },
    'customers.accounts':function(){ drawRoster(); if(!sheet&&!sheetBusy) loadSheet(); },
    'customers.messages':function(){ loadMakerThreads(false); },
    'customers.links':function(){ if(linksRead) drawLinks(); else if(!linksBusy) loadLinks(); },
    'customers.associates':function(){ if(!cards) loadCards(); else drawCards(); },
    'record.approve':function(){ loadMaker(); },
    'shop.hours':function(){ loadMakerHours(); },
    'shop.notice':function(){ loadMakerBulletin(); },
    'shop.practice':function(){ if(sheet) drawTest(); else if(!sheetBusy) loadSheet(); }
  };
  /* every element that names where it shows is shown there and hidden elsewhere: a card, a form, a section or a whole place. Record's
     forms are shown one at a time (fOpen, a form's slug): a form only while it is the one open, the menu and a retained input only
     while none is, and the way back only while one is. */
  function sweep(){
    [].forEach.call(roster.querySelectorAll('[data-in]'), function(n){
      n.hidden=!n.getAttribute('data-in').split(' ').some(function(t){ return t===placeNow||t===placeNow+'.'+partNow; });
    });
    [].forEach.call(roster.querySelectorAll('[data-form],[data-formmenu],[data-formback]'), function(n){
      var here=!n.hasAttribute('data-in')||!n.hidden;
      if(n.hasAttribute('data-form')) n.hidden=!here||n.getAttribute('data-form')!==fOpen;
      else if(n.hasAttribute('data-formmenu')) n.hidden=!here||!!fOpen;
      else n.hidden=!here||!fOpen;
    });
  }
  function inClaims(){ return placeNow==='orders'&&partNow==='waiting'; }
  function inChat(){ return placeNow==='customers'&&partNow==='messages'; }
  function addrFor(place, part){ var p=PARTS[place]; return '#'+place+(part&&p&&part!==p[0]?'/'+part:''); }
  /* THE ADDRESSES. A place and a part have one each, #orders and #orders/ready; the old ones stay as addresses, each to where its
     section went: #maker is Orders, #more is Shop, #accounts and #links are those parts of Customers, #cards the associates' report card. */
  var ADDR={needs:['needs',''], orders:['orders',''], customers:['customers',''], record:['record',''], shop:['shop',''],
    maker:['orders',''], more:['shop',''], accounts:['customers','accounts'], links:['customers','links'], cards:['customers','associates']};
  function addrOf(h){
    var t=String(h||'').replace(/^#/,'').split('/'), k=t[0];
    if(!Object.prototype.hasOwnProperty.call(ADDR,k)) return null;
    var a=ADDR[k], part=t[1]||a[1];
    return {place:a[0], part:(PARTS[a[0]]||[]).indexOf(part)>=0?part:''};
  }
  /* o.fresh reads the place again (a tap on its item, as entering Maker always read it); o.push writes the address, so Back and
     Forward move between places */
  function showPlace(place, part, o){
    o=o||{};
    if(place!=='needs'&&!PARTS[place]) place='needs';
    var parts=PARTS[place]||[];
    if(!parts.length) part=''; else if(parts.indexOf(part)<0) part=parts[0];
    var fresh=!!o.fresh||place!==placeNow, moved2=place!==placeNow||part!==partNow;
    if(placeNow==='needs'&&place!=='needs') needSaid={};
    placeNow=place; partNow=part;
    /* the order whose card is open is closed by leaving the place or the part (Phase 1c) */
    if(moved2&&ordOpened){ ordOpened=null; drawOrderPane(); }
    /* so is the form open on Record: leaving the part or the place closes it; the + orb is not shown on Record, where the parts are one tap away */
    if(moved2) fOpen=null;
    var add=document.getElementById('oAdd'); if(add) add.hidden=placeNow==='record';
    if(!inChat()) stopMakerChat();
    /* the picture is let go when Waiting on you is left, the unlocked key only when Orders is left, as the old Maker page kept it */
    if(!inClaims()) makerSlipClose();
    if(placeNow!=='orders') makerSlipLock();
    [].forEach.call(document.querySelectorAll('.place[data-m]'), function(b){
      if(b.getAttribute('data-m')===placeNow) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); });
    [].forEach.call(document.querySelectorAll('.aparts button[data-part]'), function(b){
      b.setAttribute('aria-selected', b.parentNode.getAttribute('data-place')===placeNow&&b.getAttribute('data-part')===partNow?'true':'false'); });
    sweep();
    say('');
    if(fresh&&PLACE_READ[placeNow]) PLACE_READ[placeNow]();
    if(PART_READ[placeNow+'.'+partNow]) PART_READ[placeNow+'.'+partNow]();
    if(o.push){ var to=addrFor(placeNow, partNow); if(location.hash!==to){ try{ history.pushState(null,'',to); }catch(e){} } }
    if(fresh){ try{ window.scrollTo(0,0); }catch(e){} }
    needsWatch();
  }
  /* Back, Forward and an address typed in: the place the address names, and nothing written back. Not while an account is viewed
     as them, which has the page's own bar and no places. */
  function fromAddress(){
    if(view) return;
    var a=location.hash?addrOf(location.hash):{place:'needs', part:''};
    if(!a) return;
    var part=a.part||(PARTS[a.place]||[])[0]||'';
    if(a.place===placeNow&&part===partNow) return;
    showPlace(a.place, part);
  }
  window.addEventListener('popstate', fromAddress);
  window.addEventListener('hashchange', fromAddress);
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
  async function loadSheet(quiet){
    sheetBusy=true;
    try{
      var j=await refs('/all/sheet');
      nGot('sheet');
      if(!changed('sheet',[j.accounts,j.desk,j.stranger,j.issue])&&quiet===true) return;
      sheet={}; sheetAt=j.at||null; sheetRows=j.accounts||[]; sheetIssue=j.issue||null; deskWait=j.desk||null; stranger=j.stranger||null;
      sheetRows.forEach(function(a){ sheet[a.username]=a; });
      drawRoster(); drawTest(); drawNeeds(); drawNeedOpen(true);
      if(aOpen) openCard(aOpen);
      /* the count is of accounts on the book: the test account is not one (v689) */
      var real=sheetRows.filter(function(a){ return !a.test; }).length;
      document.getElementById('mFoot').textContent=real+' accounts, as at '+hm(new Date().toISOString());
    }catch(e){ nGot('sheet', e); if(quiet!==true) say(e.message,'bad'); }
    finally{ sheetBusy=false; }
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
    var x=el('button','salt-orb salt-sheet__close'); x.type='button'; x.setAttribute('aria-label','Close'); actOn(x,'code.close');
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
      var inp=el('input','salt-field__input salt-field__input--code'); inp.id='hoC'; inp.readOnly=true; actOn(inp,'code.value');
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
     they got in. LOOKING MAKES NO LINK (his decision 7 of 11 Oct 2026): a card drawn, on Accounts or beside Needs you, sends
     nothing that writes. THE FIRST TAP MAKES IT and the second shares it, so the share sheet never waits on a key
     derivation and a fetch (the plan's must-not-ship list): the share is the second tap's first act. It is kept by
     username with Needs you's (madeLink), so a redraw, or the same account's card on Needs you, keeps the one made and
     never makes a second; a share that goes through ticks the account sent, and a link shared or copied from any card
     is dropped (retire), the next tap making a fresh one. A username with no account makes nothing and posts nothing,
     and every control says why it is off. The password is opened on its own tap, straight to the clipboard, never into
     the page. */
  var story={};
  /* the link moved: every Send a sign-in link drawn for that account is painted from madeLink, including one a redraw
     put in the place of the button that asked (a sheet read lands while the link is being made), and Needs you with it */
  /* his decision 7 of 11 Oct 2026: Send a sign-in link makes the link, Share the link shares it, and a link that could
     not be made says Try again, whose tap makes it again and shares nothing */
  function paintPill(b){
    var m=madeLink[b.getAttribute('data-pill')]||{}, again=!m.j&&!m.busy&&!!m.fail;
    b.disabled=b.getAttribute('data-none')==='1'||!!m.busy;
    b.textContent=m.busy?'Making the link...':m.j?'Share the link':again?'Try again':'Send a sign-in link';
    if(b.note){ b.note.textContent=m.note||''; b.note.className='anote'+(m.bad?' bad':''); }
  }
  function paintPills(u){ [].slice.call(document.querySelectorAll('[data-pill]')).forEach(function(b){ if(b.getAttribute('data-pill')===u) paintPill(b); }); }
  function linkMoved(u){ paintPills(u); if(!mHome.hidden) drawNeeds(); }
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
    b.setAttribute('data-pill', u); b.note=note; actOn(b,'acct.signin-link');
    if(a.account===false){ b.setAttribute('data-none','1'); b.title='No account behind this username yet'; }
    paintPill(b);
    b.addEventListener('click', function(){
      var m=madeLink[u]||{};
      if(m.busy||a.account===false) return;
      /* the first tap makes it and shares nothing; a failed make is tried again by the next */
      if(!m.j){ makeLink(a); linkMoved(u); return; }
      var msg=m.j.msg, p;
      /* the tap's first act, before anything that waits: the share sheet, or with none the clipboard */
      try{ p=navigator.share?navigator.share({text:msg}).then(function(){ return 'sent'; })
        :navigator.clipboard.writeText(msg).then(function(){ return 'copied'; }); }
      catch(e){ p=Promise.reject(e); }
      p.then(async function(how){
        if(how==='copied'){ retire(a, 'Copied. Paste it into a message to them, then tick Sent.'); linkMoved(u); return; }
        var said=madeLink[u]={note:'Sent. It signs them in once; the next tap makes a new one.'};
        markOut(u, m.j); linkMoved(u);
        try{ var r=await refs('/all/sent/'+u, {issue:sheetIssue, sent:true}); a.sent=r.sent; countSent(); drawRoster(); onSent(); }
        catch(e){ said.note='Sent, but the tick did not save: '+e.message; said.bad=true; }
        linkMoved(u);
      }, function(){ m.note=navigator.share?'Not shared. Tap Share the link again.':'Not copied: this browser refused the clipboard.'; m.bad=true; linkMoved(u); });
    });
    return b;
  }
  /* HOW THEY GOT IN (/all/account/<u>): each way in, newest first, with its moment and the kind of device it was used
     on, as the browser described itself then, never an address; a password refused at an address stands above them */
  /* S9 fix: a code his counter showed is scanned; a customer's own is copied across; key, before the two were told apart */
  var HOWW={link:'Sign-in link', qr:'Code, scanned', copy:'Code, copied across', key:'Code', code:'Code, typed', password:'Password', passkey:'Passkey'};
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
      list.appendChild(lineRow(HOWW[x.how]||'Signed in', x.how==='password'||x.how==='passkey'?null:chip('verdigris','Used'), dayMon(x.at)+', '+hm(x.at)+onWhat(x.where)));
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
      var so=ghost(['Sign out','acct.device-signout',d.id]);
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
    story[u]=j?{log:j.log||[], devices:j.devices||[]}:{err:err};
    [].slice.call(document.querySelectorAll('[data-story]')).forEach(function(b){ if(b.getAttribute('data-story')===u) drawStory(b, a); });
  }
  function acctCard(a){
    var u=a.username, none=a.account===false, why='No account behind this username yet';
    var c=el('section','oacct scard'); c.setAttribute('data-acct', u);
    var h=el('div','ahead srow');
    h.appendChild(el('h2',null,a.test?testName(a):(a.code||u)));
    h.appendChild(el('span','un',u));
    c.appendChild(h);
    var cs=el('div','achips');
    function chips(){ cs.textContent=''; if(sheet) chipsOf(a).forEach(function(x){ cs.appendChild(x); }); }
    chips(); c.appendChild(cs);
    if(a.test) c.appendChild(el('p','atot','Counts nowhere; nothing on the book is behind it.'));
    else if(none) c.appendChild(el('p','atot',waitLine()));
    else if(a.tot) c.appendChild(el('p','atot',a.tot));
    var box=actOn(document.createElement('input'),'acct.sent');
    var pn=el('p','anote'); pn.setAttribute('role','status');
    c.appendChild(sendPill(a, pn, function(){ box.checked=!!a.sent; chips(); }));
    c.appendChild(pn);
    var grid=el('div','agrid'), gn=el('p','anote'); gn.setAttribute('role','status');
    var hob=ghost(['Show a code, in person','acct.show-code']), open=ghost(['View as them','acct.view-as']), pwb=ghost(['Copy password','acct.password']), sob=ghost(['Sign out everywhere','acct.signout-all']), orderFor=ghost(['Order for them','acct.order-for']);
    pwb.classList.add('salt-ghost--danger'); sob.classList.add('salt-ghost--danger');
    [hob, open, orderFor, pwb, sob].forEach(function(b){ if(none){ b.disabled=true; b.title=why; } grid.appendChild(b); });
    if(!none&&!a.pwMaster){ pwb.disabled=true; pwb.title='Not sealed yet: run tools/stmt-seal.mjs on the laptop'; }
    hob.addEventListener('click', function(){ if(!none) showHandover(a, hob); });
    /* S9 9.5: View as them, their own page, read only */
    open.addEventListener('click', function(){ openAcct(a); });
    orderFor.addEventListener('click', function(){ makerForAccount(a); });
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
    /* 12 Oct 2026 (Phase 2a): the input is the 44px target, laid unseen over the box drawn beside it, so the control measures what the label did */
    tick.appendChild(box); tick.appendChild(el('span','tickbox')); tick.appendChild(el('span',null,'Sent'));
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
  document.getElementById('lock').addEventListener('click', function(){ showPlace('customers','accounts',{fresh:true,push:true}); });
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
  var HOW_IN={password:'by password', link:'by link', remembered:'on a remembered phone', qr:'by a scanned code', copy:'by a copied code', key:'by a code', code:'by a typed code', passkey:'with a passkey'};
  function howOf(s){ return s.how?HOW_IN[s.how]||'':HOW_IN.password; }
  /* the two test accounts, told apart by the state each stands in (his answer of 29 Sep 2026) */
  function testName(a){ return a.state==='locked'?'Test account, locked':'Test account, open'; }
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
    var b=el('button','salt-inbox-row'); b.type='button'; b.setAttribute('data-u', a.username); actOn(b,'acct.open',a.username);
    if(aOpen===a.username) b.setAttribute('aria-current','true');
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title');
    t.appendChild(el('span',null,a.test?testName(a):(a.code||a.username)));
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
    makerSlipLock();
    var a=u&&((sheet&&sheet[u])||OWNER.accounts.filter(function(x){ return x.username===u; })[0]);
    aOpen=a?u:null;
    oAccts.classList.toggle('open', !!a);
    aopen.hidden=!a; aopen.textContent='';
    [].slice.call(rlist.querySelectorAll('[data-u]')).forEach(function(r){
      if(r.getAttribute('data-u')===aOpen) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
    if(!a) return;
    var back=el('button','aback','← Accounts'); back.type='button'; back.setAttribute('data-back','accounts'); actOn(back,'acct.back');
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
      var copy=el('button',null,'Copy link'); copy.type='button'; actOn(copy,'link.copy');
      copy.addEventListener('click', async function(){
        try{ await navigator.clipboard.writeText(r.url); copy.textContent='Copied'; }
        catch(e){ copy.textContent='Copy failed'; }
        setTimeout(function(){ copy.textContent='Copy link'; }, 1500);
      });
      var rev=el('button',null,r.revoked?'Restore':'Withdraw'); rev.type='button'; rev.setAttribute('data-move',''); actOn(rev,r.revoked?'link.restore':'link.withdraw');
      rev.addEventListener('click', function(){ moveLink(r, r.revoked?'restore':'revoke'); });
      row.appendChild(copy); row.appendChild(rev);
      /* v709: his word on one an associate minted, and the tier he may change on it. A tier he
         does not set leaves it following the associate, which is what "if need be" means. */
      if(!r.standing&&r.by){
        if(r.approved===false&&!r.revoked){
          /* a declined link keeps Approve, which is how a decline is taken back, and loses Decline;
             a withdrawn one has neither, Restore being the way back */
          var ap=el('button',null,'Approve'); ap.type='button'; ap.setAttribute('data-move',''); actOn(ap,'link.approve');
          ap.addEventListener('click', function(){ moveLink(r,'approve'); });
          row.appendChild(ap);
          if(!declined){
            var de=el('button',null,'Decline'); de.type='button'; de.setAttribute('data-move',''); actOn(de,'link.decline');
            de.addEventListener('click', function(){ moveLink(r,'decline'); });
            row.appendChild(de);
          }
        }
        if(tiers.length){
          var sel=el('select','fld'); sel.setAttribute('aria-label','The tier this link quotes'); actOn(sel,'link.tier');
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
  function ended(){
    lookShut();   /* 11 Oct 2026: the look Sheet gives way; the lapse is what he must see */
    document.getElementById('aEnded').hidden=false; document.body.classList.add('ended');
    /* the 30-second read ends with the sign-in: every poll after a lapse would send seven requests to the login and fail each */
    if(needsTimer){ clearInterval(needsTimer); needsTimer=null; }
  }
  async function refs(path, body){
    var o = body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}
                 : {};
    o.redirect='manual';
    var r;
    try{ r = await fetch(path, o); }catch(e){ throw new Error('Not sent. Check the connection and try again.'); }
    if(r.type==='opaqueredirect'||r.status===401){ ended(); throw new Error(ENDED); }
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok||!j.ok){ var failure=new Error(j.error||'that did not work'); failure.detail=j; failure.status=r.status; throw failure; }
    return j;
  }
  var makerData=null, makerQuotes={}, makerPv={}, makerFee={}, makerWin={}, makerHours=null, makerBusy=false;
  /* PHASE 1b: a part he has begun on is left alone by a poll. Opening a field or tapping a button inside the order cards or the claims marks it
     (in the capture phase, so a redraw its own tap makes clears the mark afterwards); the redraw of that part clears it. */
  var dirty={makerReview:false, makerClaims:false};
  ['makerReview','makerClaims'].forEach(function(id){
    var r=document.getElementById(id);
    if(r) ['input','change','click'].forEach(function(t){
      r.addEventListener(t, function(ev){ if(ev.target.closest&&ev.target.closest('button,input,select,textarea,label')) dirty[id]=true; }, true);
    });
  });
  /* 10 Oct 2026, version 2: today and the seven days after it, Kuala Lumpur, and a day's six windows whose start is ahead, as the
     Desk's ordWinDays and ordWinOn */
  var MW_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function mwPad(n){ return (n<10?'0':'')+n; }
  function mwDayLabel(d){ return (+d.slice(8))+' '+MW_MON[+d.slice(5,7)-1]; }
  function makerWinOn(day,now){
    return [0,4,8,12,16,20].map(function(w){ return [day+'T'+mwPad(w),mwPad(w)+':00 to '+mwPad(w+4)+':00',Date.parse(day+'T00:00:00Z')+(w-8)*3600000]; })
      .filter(function(x){ return x[2]>now; });
  }
  function makerWinDays(now){
    var out=[]; for(var i=0;i<8;i++){ var d=new Date(now+8*3600000+i*86400000).toISOString().slice(0,10); if(makerWinOn(d,now).length) out.push(d); }
    return out;
  }
  /* what needs their yes, the Worker's needsYes: goods above what they placed it at, or a window other than theirs */
  function makerNeedsYes(order,total,slot){ return (total>(+order.total||0)+0.004)||(!!slot&&!!order.slot&&slot!==order.slot); }
  /* his Accept sent for their yes, open or said yes to: the order waits on them, or on its row */
  function makerAccHeld(order){ var p=order&&order.price; return !!p&&p.from==='accept'&&(p.state==='taken'||(p.state==='offered'&&!!p.offer&&new Date().toISOString()<=String(p.offer.until))); }
  var makerClaims=[], makerClaimRequests={}, makerSlipPrivate=null, makerSlipGeneration=0, makerSlipUrls=[];
  function makerSlipClose(){
    makerSlipGeneration++;
    makerSlipUrls.forEach(function(url){ URL.revokeObjectURL(url); }); makerSlipUrls=[];
    document.querySelectorAll('[data-maker-slip]').forEach(function(node){ node.remove(); });
  }
  function makerSlipLock(){ makerSlipClose(); makerSlipPrivate=null; }
  document.addEventListener('visibilitychange',function(){ if(document.hidden) makerSlipLock(); });
  function makerClaimButton(parent,label,action,primary){
    var L=labOf(label), button=actOn(el('button',primary?'btn salt-pill salt-pill--md':'salt-ghost',L[0]),L[1],L[2]);
    button.type='button'; button.onclick=function(){ return action(button); }; parent.appendChild(button); return button;
  }
  /* PHASE 1b: Needs you reads the claims too (placeNow is then needs and nothing is drawn here). A poll leaves a claim card he has begun on
     (a field open, a preview shown, a slip open) alone, and one that finds the same answer draws nothing. */
  var claimsReading=false;
  async function loadMakerClaims(quiet){
    var root=document.getElementById('makerClaims'), show=placeNow==='orders', poll=quiet===true, apply=false;
    if(!root||(!show&&!(poll&&placeNow==='needs'))) return;
    if(poll&&(claimsReading||(show&&(dirty.makerClaims||makerSlipUrls.length)))) return;
    claimsReading=true;
    if(show&&!poll){ makerSlipClose(); root.textContent='Reading account claims…'; }
    try{
      var result=await refs('/all/maker/claims'); makerClaims=result.claims||[]; nGot('claims');
      if(!changed('claims', makerClaims)&&poll) return;
      apply=true;
      if(!show||!root.isConnected||placeNow!=='orders') return;
      dirty.makerClaims=false; root.textContent='';
      var waiting=makerClaims.filter(function(c){ return c.state==='waiting'; });
      if(!waiting.length) root.appendChild(el('p','rnone','No account claims waiting.'));
      waiting.forEach(function(claim){
        var card=makerCard(root), preview=null; card.setAttribute('data-key',claim.u+':'+claim.id);
        card.appendChild(el('h3',null,claim.u+' · '+rm(claim.amount)));
        card.appendChild(el('p','maker-facts',claim.id+(claim.test?' · Test, counts nowhere':'')));
        var note=el('div','maker-quote'); card.appendChild(note);
        var route='/all/maker/claims/'+claim.u+'/'+claim.id;
        var receipt=makerClaimButton(card,['Received','claim.received'],function(button){ return decideMakerClaim(false,false,button); },true);
        var covered=makerClaimButton(card,['Received, on the book already','claim.received-booked'],function(button){ return decideMakerClaim(true,false,button); },false);
        receipt.disabled=true; covered.disabled=true;
        makerClaimButton(card,['Preview rows','claim.preview'],async function(button){
          button.disabled=true;
          try{
            preview=await refs(route+'/preview',{}); note.textContent='';
            (preview.rows||[]).forEach(function(row){
              note.appendChild(el('p','maker-row',(row.date||'undated')+' · '+rm(row.rm)+' of '+rm(row.owed)+' · '+(row.rid||row.key)));
              (row.flags||[]).forEach(function(flag){ note.appendChild(el('p','salt-insight',typeof flag==='string'?flag:JSON.stringify(flag))); });
            });
            note.appendChild(el('p','salt-insight',preview.booked?'Already booked. Received tells the customer again without booking.':
              preview.left>0.004?rm(preview.left)+' exceeds the rows. Do not book it again if already recorded.':'These rows are answered together.'));
            receipt.disabled=preview.left>0.004; covered.disabled=!(preview.left>0.004);
          }catch(error){ note.textContent=error.message; }
          button.disabled=false;
        },false);
        makerClaimButton(card,['Not found','claim.not-found'],function(button){ return decideMakerClaim(false,true,button); },false);
        async function decideMakerClaim(onBook,notFound,button){
          if(!notFound&&!preview) return;
          var key=claim.u+':'+claim.id, pending=makerClaimRequests[key];
          var body=notFound?{amount:claim.amount}:{hash:preview.hash};
          if(onBook) body.covered=true;
          var action=notFound?'notfound':'received', intended=JSON.stringify({action:action,body:body});
          if(pending&&pending.intended!==intended){ note.textContent='Read the retained decision before choosing another answer.'; return; }
          if(!pending){
            if(!window.confirm(notFound?'Record this claim as Not found?':'Confirm the amount and rows shown?')) return;
            pending={intended:intended,action:action,body:Object.assign({rid:crypto.randomUUID()},body),busy:false};
            makerClaimRequests[key]=pending;
          }
          if(pending.busy) return; pending.busy=true; button.disabled=true;
          try{
            await refs(route+'/'+pending.action,pending.body); delete makerClaimRequests[key]; await loadMakerClaims(); await loadMaker();
          }catch(error){ note.textContent='Confirmation not received. Retry this same answer: '+error.message; }
          pending.busy=false; button.disabled=false;
        }
        if(claim.slip) makerSlipControl(card,claim.u,claim.slip);
      });
    }catch(error){ nGot('claims', error); apply=true; if(show&&!poll) root.textContent=error.message; }
    finally{ claimsReading=false; if(apply) drawNeeds(); }
  }
  function makerSlipControl(parent,u,id){
    var pass=makerField(parent,['Vault passphrase','claim.passphrase'],'password',''), note=el('p','msg'); parent.appendChild(note);
    pass.autocomplete='off';
    makerClaimButton(parent,['View slip','claim.view-slip'],async function(button){
      var generation=++makerSlipGeneration, secret=pass.value; pass.value=''; button.disabled=true;
      try{
        if(!makerSlipPrivate){
          if(!secret) throw new Error('Unlock the slip key with the vault passphrase.');
          var envelope=await refs('/all/maker/vault/key');
          if(generation!==makerSlipGeneration) return;
          if(!envelope.vault) throw new Error('No slip key is filed.');
          var jwk=await makerVaultOpen(secret,envelope.vault); secret='';
          var imported=await crypto.subtle.importKey('jwk',{kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y,d:jwk.d},
            {name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);
          if(generation!==makerSlipGeneration) return;
          makerSlipPrivate=imported;
        }
        var privateKey=makerSlipPrivate, sealed=(await refs('/all/maker/slips/'+u+'/'+id)).slip;
        if(generation!==makerSlipGeneration) return;
        if(!sealed||sealed.v!==1) throw new Error('The sealed slip is malformed.');
        var epk=await crypto.subtle.importKey('raw',makerFrom64(sealed.epk),{name:'ECDH',namedCurve:'P-256'},false,[]);
        var bits=await crypto.subtle.deriveBits({name:'ECDH',public:epk},privateKey,256);
        var hk=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
        var key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(0),info:new TextEncoder().encode('salt-slip v1')},
          hk,{name:'AES-GCM',length:256},false,['decrypt']);
        var bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:makerFrom64(sealed.iv)},key,makerFrom64(sealed.ct));
        if(generation!==makerSlipGeneration||!parent.isConnected||!inClaims()||document.hidden) return;
        var url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
        if(generation!==makerSlipGeneration){ URL.revokeObjectURL(url); return; }
        makerSlipUrls.push(url);
        var image=el('img','maker-slip'); image.src=url; image.alt='Payment slip'; image.setAttribute('data-maker-slip','');
        parent.appendChild(image); note.textContent='Opened on this device only.';
      }catch(error){ if(generation===makerSlipGeneration) note.textContent='Slip could not be opened: '+error.message; }
      finally{ secret=''; button.disabled=false; }
    },false);
    makerClaimButton(parent,['Close and lock slip','claim.lock-slip'],function(){ makerSlipLock(); pass.value=''; note.textContent='Slip locked.'; },false);
  }
  var makerThreads=[], makerThreadUser=null, makerThreadTimer=null, makerThreadsReading=false, makerChatDrafts={};
  function stopMakerChat(){
    if(makerThreadTimer!==null) clearInterval(makerThreadTimer);
    makerThreadTimer=null;
  }
  function startMakerChat(){
    stopMakerChat();
    if(!makerThreadUser||!inChat()||document.hidden) return;
    makerThreadTimer=setInterval(function(){
      if(!makerThreadUser||!inChat()||document.hidden){ stopMakerChat(); return; }
      loadMakerThreads(true);
    },2000);
  }
  document.addEventListener('visibilitychange',function(){
    if(document.hidden) stopMakerChat();
    else if(makerThreadUser&&inChat()){ loadMakerThreads(true); startMakerChat(); }
  });
  function makerThreadAsked(thread){
    var lines=thread.msgs||[], last=lines[lines.length-1];
    return !!(last&&last.by==='customer'&&thread.quiet!==last.at);
  }
  async function loadMakerThreads(quiet){
    if(makerThreadsReading) return;
    makerThreadsReading=true;
    var status=document.getElementById('makerChatStatus'), apply=false;
    try{
      var result=await refs('/all/maker/threads');
      makerThreads=result.threads||[]; nGot('threads');
      if(!changed('threads', makerThreads)&&quiet===true) return;
      apply=true;
      var list=document.getElementById('makerChatList'); list.textContent='';
      makerThreads.forEach(function(thread){
        var button=el('button','salt-ghost',thread.u+(thread.test?' · Test account':'')+(makerThreadAsked(thread)?' · Asked':' · Chat'));
        button.type='button';button.setAttribute('data-thread',thread.u);actOn(button,'chat.open',thread.u);
        button.onclick=function(){ openMakerThread(thread.u); };list.appendChild(button);
      });
      status.textContent=makerThreads.length?makerThreads.filter(function(thread){return !thread.test&&makerThreadAsked(thread);}).length+' waiting for a reply.':'No account conversations.';
      if(makerThreadUser) drawMakerThreadLines();
    }catch(error){ nGot('threads', error); apply=true; status.textContent=error.message; }
    finally{ makerThreadsReading=false; if(apply) drawNeeds(); }
  }
  function drawMakerThreadLines(){
    var root=document.getElementById('makerChatLines');
    if(!root) return;
    root.textContent='';
    var thread=makerThreads.filter(function(value){ return value.u===makerThreadUser; })[0];
    (thread&&thread.msgs||[]).forEach(function(line){
      root.appendChild(el('p','maker-facts',(line.by==='desk'?'You':'Customer')+' · '+stampDay(line.at)));
      root.appendChild(el('p','maker-row',line.text));
    });
  }
  function openMakerThread(user){
    makerThreadUser=user;
    var root=document.getElementById('makerChatOpen');root.hidden=false;root.textContent='';
    root.setAttribute('data-key',user);root.appendChild(el('h3','',user));
    var lines=el('div','');lines.id='makerChatLines';root.appendChild(lines);
    var draft=makerChatDrafts[user], savedPrefix='saltMakerChat:'+user+':';
    if(!draft){
      draft=makerChatDrafts[user]={text:'',pending:null,saved:null};
      try{
        var keys=Object.keys(localStorage).filter(function(key){return key.indexOf(savedPrefix)===0;}).sort();
        if(keys.length){
          draft.savedKey=keys[0];
          var raw=localStorage.getItem(draft.savedKey);
          draft.saved=JSON.parse(raw);
          if(draft.saved.v!==1||draft.saved.u!==user||!draft.saved.envelope||typeof draft.saved.rid!=='string')
            throw new Error('The retained reply needs review or explicit cancellation.');
        }
      }catch(error){draft.storageError=error.message;}
    }
    var label=el('label','maker-field');label.appendChild(el('span','lbl','Reply'));
    var text=el('textarea','fld salt-field__input');text.maxLength=200;text.value=draft.text;
    text.setAttribute('data-thread-reply',user);actOn(text,'chat.reply');text.oninput=function(){draft.text=text.value;};
    label.appendChild(text);root.appendChild(label);
    var status=el('p','msg');status.setAttribute('role','status');root.appendChild(status);
    var send=el('button','btn salt-pill salt-pill--md','Send reply'),
      quiet=el('button','salt-ghost','No reply needed'),cancel=el('button','salt-ghost','Cancel reply retry'),
      restore=el('button','salt-ghost','Open retained reply'),close=el('button','salt-ghost','Close chat');
    [send,quiet,restore,cancel,close].forEach(function(button){button.type='button';root.appendChild(button);});
    actOn(send,'chat.send');actOn(quiet,'chat.no-reply');actOn(restore,'chat.open-retained');actOn(cancel,'chat.cancel-retry');actOn(close,'chat.close');
    function makerChatState(){
      var busy=!!draft.busy;
      status.textContent=draft.note||(busy?'Sending reply...':'');
      var unopened=!!draft.storageError||!!(draft.saved&&!draft.pending);
      if(!draft.pending&&!unopened) text.value=draft.text;
      text.disabled=busy||!!draft.pending||unopened;send.disabled=busy||unopened||(draft.pending&&draft.pending.noReply===true);
      quiet.disabled=busy||unopened||(draft.pending&&draft.pending.message!==undefined);
      restore.hidden=!draft.saved||!!draft.pending;restore.disabled=busy||!!draft.storageError;
      cancel.hidden=!draft.pending&&!draft.saved&&!draft.storageError;cancel.disabled=busy;
      send.textContent=draft.pending&&draft.pending.message!==undefined?'Retry reply':'Send reply';
      quiet.textContent=draft.pending&&draft.pending.noReply?'Retry No reply needed':'No reply needed';
    }
    draft.redraw=makerChatState;
    async function makerChatSubmit(noReply){
      if(draft.busy||draft.storageError||(draft.saved&&!draft.pending)) return;
      if(!draft.pending){
        if(!noReply&&!text.value.trim()){status.textContent='Write a reply first.';return;}
        draft.pending=noReply?{noReply:true,rid:mintRid()}:{message:text.value,rid:mintRid()};
      }
      draft.note='';draft.busy=true;makerChatState();
      try{
        if(!draft.saved){
          if(!OWNER.master) throw new Error('Reopen Salt Account before retaining a reply.');
          var envelope=await makerVaultSeal(OWNER.master,{u:user,body:draft.pending});
          var retained={v:1,u:user,rid:draft.pending.rid,at:new Date().toISOString(),envelope:envelope};
          draft.savedKey=savedPrefix+draft.pending.rid;
          localStorage.setItem(draft.savedKey,JSON.stringify(retained));draft.saved=retained;
        }
        var result=await refs('/all/maker/threads/'+user,draft.pending);
        localStorage.removeItem(draft.savedKey);draft.saved=null;
        if(draft.pending.message!==undefined){draft.text='';text.value='';}
        draft.pending=null;draft.note=noReply?'No reply needed recorded.':'Reply sent.'+makerPushResult(result.push);
        await loadMakerThreads(true);
      }catch(error){draft.note=makerCommunicationError(error)+' The original reply is kept for retry.';}
      finally{draft.busy=false;draft.redraw();}
    }
    send.onclick=function(){makerChatSubmit(false);};quiet.onclick=function(){makerChatSubmit(true);};
    restore.onclick=async function(){
      if(draft.busy) return;
      draft.busy=true;makerChatState();
      try{
        if(!OWNER.master) throw new Error('Reopen Salt Account to open the retained reply.');
        var opened=await makerVaultOpen(OWNER.master,draft.saved.envelope);
        if(opened.u!==user) throw new Error('The retained reply belongs to another account. It was not sent.');
        var body=opened.body;
        if(body.rid!==draft.saved.rid||Object.keys(body).some(function(key){return ['rid','message','noReply'].indexOf(key)<0;})
          ||!(/^[A-Za-z0-9_-]{16,64}$/).test(body.rid)
          ||!(body.noReply===true&&body.message===undefined||body.noReply===undefined&&typeof body.message==='string'&&body.message.trim()&&body.message.length<=200))
          throw new Error('The retained reply is malformed. It remains saved until explicitly cancelled.');
        draft.pending=body;draft.text=body.message||'';text.value=draft.text;
        draft.note='Original reply opened. Retry sends the same request; cancellation removes only this device retry.';
      }catch(error){draft.note=error.message;}
      finally{draft.busy=false;draft.redraw();}
    };
    cancel.onclick=function(){
      if(confirm('Cancel this retry? A reply already sent is not removed.')){
        try{localStorage.removeItem(draft.savedKey);draft.pending=null;draft.saved=null;delete draft.storageError;draft.note='This device retry was cancelled.';makerChatState();}
        catch(error){status.textContent='Retry not cancelled: '+error.message;}
      }
    };
    close.onclick=function(){makerThreadUser=null;root.hidden=true;stopMakerChat();};
    if(draft.storageError) draft.note=draft.storageError;
    else if(draft.saved&&!draft.pending) draft.note='A retained reply is encrypted on this device. Open it before retry or cancel it explicitly.';
    makerChatState();drawMakerThreadLines();startMakerChat();
  }
  /* A GROUP ORDER (the pool): open one, see who is in by units, and Close. Close closes it, tells each joiner once and sends
     each joined order for acknowledgement; one the Desk would not accept is listed under the pool with its reason, and Close
     again retries those alone. Reaching the target closes nothing: only this does. */
  async function loadMakerPools(){
    var root=document.getElementById('makerPools'); if(!root||placeNow!=='orders') return;
    var result;
    try{ result=await refs('/all/maker/pools'); }catch(error){ root.textContent=error.message; return; }
    if(!root.isConnected||placeNow!=='orders') return;
    root.textContent='';
    var note=el('p','msg',''); note.setAttribute('role','status');
    function field(label,type,attrs){
      var L=labOf(label), l=el('label','maker-field'); l.appendChild(el('span','lbl',L[0]));
      var i=actOn(el('input','fld salt-field__input'),L[1],L[2]); i.type=type; Object.keys(attrs||{}).forEach(function(k){ i.setAttribute(k,attrs[k]); });
      l.appendChild(i); root.appendChild(l); return i;
    }
    var product=field(['Product','pool.product'],'text',{maxlength:'20',autocomplete:'off'}), size=field(['Size each, in units','pool.size'],'number',{min:'0',step:'any'}),
        target=field(['Target, in units','pool.target'],'number',{min:'0',step:'any'}), closes=field(['Closes on, optional','pool.closes-on'],'date',{});
    var open=el('button','btn salt-pill salt-pill--md','Open group order'); open.type='button'; actOn(open,'pool.open');
    open.onclick=async function(){
      open.disabled=true;
      try{
        var body={product:product.value.trim().toLowerCase(),q:Number(size.value),target:Number(target.value)};
        if(closes.value) body.closesOn=closes.value;
        await refs('/all/maker/pools',body); await loadMakerPools();
      }catch(error){ note.textContent=error.message; open.disabled=false; }
    };
    root.appendChild(open); root.appendChild(note);
    (result.pools||[]).forEach(function(p){
      var card=el('article','salt-glass-card maker-card');
      card.setAttribute('data-key',p.id);
      card.appendChild(el('p','maker-row',p.product+' '+p.q+' each, '+p.unitsIn+' of '+p.target+' units in, '+(p.joins||[]).length+' joined'
        +(p.closesOn?', closes '+p.closesOn:'')+', '+p.state));
      (p.closeLeft||[]).forEach(function(x){ card.appendChild(el('p','maker-row','Not acknowledged: '+x.id+' ('+x.why+')')); });
      if(p.state==='open'||(p.closeLeft||[]).length){
        var close=el('button','salt-ghost',p.state==='open'?'Close':'Close again'); close.type='button'; actOn(close,'pool.close',p.id);
        close.onclick=async function(){
          if(p.state==='open'&&!confirm('Close this group order and send each joined order for acknowledgement? Every joiner is told once.')) return;
          close.disabled=true;
          try{
            var r=await refs('/all/maker/pools/'+encodeURIComponent(p.id)+'/close',{});
            await loadMakerPools();
            var again=document.getElementById('makerPools'); if(again){ var m=el('p','msg',r.accepted.length+' sent for acknowledgement'+(r.left.length?', '+r.left.length+' left':'')+'.'); m.setAttribute('role','status'); again.insertBefore(m,again.firstChild); }
          }catch(error){ note.textContent=error.message; close.disabled=false; }
        };
        card.appendChild(close);
      }
      root.appendChild(card);
    });
  }
  async function loadMakerBulletin(){
    var root=document.getElementById('makerBulletin'), status=document.getElementById('makerBulletinStatus');
    if(!root) return;
    var text=root.querySelector('textarea');
    if(!text){
      var label=el('label','maker-field');label.appendChild(el('span','lbl','Notice, one line per sentence'));
      text=actOn(el('textarea','fld salt-field__input'),'notice.text');text.rows=4;label.appendChild(text);root.appendChild(label);
      var current=el('div','');current.id='makerBulletinCurrent';root.appendChild(current);
      var retained=el('div','');retained.hidden=true;root.appendChild(retained);
      var set=el('button','btn salt-pill salt-pill--md','Set notice'), clear=el('button','salt-ghost','Clear notice'),
        refresh=el('button','salt-ghost','Read current notice'), busy=false, needsRead=false, intended=null;
      [set,clear,refresh].forEach(function(button){button.type='button';root.appendChild(button);});
      actOn(set,'notice.set');actOn(clear,'notice.clear');actOn(refresh,'notice.read');
      function state(){set.disabled=busy||needsRead;clear.disabled=busy||needsRead;refresh.disabled=busy;text.disabled=busy;}
      root.addEventListener('maker-notice-read',function(event){
        needsRead=false;
        if(intended){
          var normalized=function(lines){return lines.map(function(line){return line.replace(/[\\s]+/g,' ').trim();});};
          var matches=JSON.stringify(normalized(event.detail.lines||[]))===JSON.stringify(normalized(intended.lines));
          status.textContent=(matches?'Current notice matches the retained request.':'Current notice differs from the retained request.')
            +' Intended text is kept. This read sends no notification; the previous notification outcome is unknown.';
        }
        state();
      });
      async function submit(lines){
        if(busy||needsRead) return;
        if(!confirm(lines.length?'Set this notice and notify every customer?':'Clear the notice? No notification is sent.')) return;
        intended={lines:lines.slice()};
        busy=true;state();
        try{
          var result=await refs('/all/maker/bulletin',{lines:lines,confirmed:true});
          current.textContent=(result.lines||[]).join(' · ')||'No notice.'; makerNotice=result.lines||[];
          intended=null;retained.hidden=true;
          /* 11 Oct 2026: a notice set empties its box, so a second tap has nothing to send, and the same one set again says so */
          if(lines.length&&!result.unchanged) text.value='';
          status.textContent=lines.length?(result.unchanged?'That notice is already up. No phone was woken.':'Notice set.'+makerPushResult(result.push)):'Notice cleared. No notification sent.';
        }catch(error){
          needsRead=true;status.textContent=error.message+' Read the current notice before another change; the result may already be recorded.';
          retained.hidden=false;retained.textContent='';
          retained.appendChild(el('h3','','Retained request'));
          retained.appendChild(el('p','maker-row',intended.lines.length?intended.lines.join(String.fromCharCode(10)):'Clear notice'));
        }finally{busy=false;state();}
      }
      set.onclick=function(){
        var lines=text.value.split(String.fromCharCode(10)).map(function(line){return line.trim();}).filter(Boolean);
        if(!lines.length){status.textContent='Write a notice first, or use Clear notice.';return;}
        submit(lines);
      };
      clear.onclick=function(){submit([]);};
      refresh.onclick=async function(){
        if(busy)return;busy=true;state();
        try{await read();}catch(error){status.textContent=error.message;}finally{busy=false;state();}
      };
    }
    async function read(){
      var result=await refs('/all/maker/bulletin'); makerNotice=result.lines||[];
      document.getElementById('makerBulletinCurrent').textContent=(result.lines||[]).join(' · ')||'No notice.';
      status.textContent='Current notice read. Changes notify customers only after Set.';
      root.dispatchEvent(new CustomEvent('maker-notice-read',{detail:result}));
    }
    try{await read();}catch(error){status.textContent=error.message;}
  }
  function makerPushResult(push){
    if(!push) return ' Notification outcome not returned.';
    if(!push.ok) return ' Notification not confirmed: '+(push.error||'read the account before retrying.');
    if(push.failed) return ' '+push.failed+' notifications were not sent.';
    return push.sent?' Notifications accepted by the delivery service.':' No subscribed devices.';
  }
  function makerCommunicationError(error){
    return error.message.indexOf('Not sent.')===0
      ?'Confirmation not received. Check the connection; the result may already be recorded.':error.message;
  }
  function makerReading(parent, reading, key){
    if(reading.cost!=null){
      var cost=typeof reading.cost==='object'?reading.cost.total:reading.cost;
      parent.appendChild(el('p','maker-facts','Cost RM '+Number(cost).toFixed(2)));
    }
    if(reading.margin) parent.appendChild(el('p','maker-facts','Margin RM '+Number(reading.margin.rm).toFixed(2)+' · '+reading.margin.pct+'%'));
    if(reading.reasoning) parent.appendChild(el('p','salt-insight',reading.reasoning));
    (reading.flags||[]).forEach(function(flag){ parent.appendChild(el('p','salt-insight',String(flag))); });
    if(reading.row){
      var detail=el('details',''), summary=actOn(el('summary','salt-ghost','Proposed row'),'row.proposed',key);
      detail.appendChild(summary); detail.appendChild(el('pre','maker-row',JSON.stringify(reading.row,null,2))); parent.appendChild(detail);
    }
  }
  /* the placed-order preview's own native comparison, mirroring ordPvBlock on the Desk: their card today, margin,
     floor and their usual, read off the preview the server drafted (src/orders.js previewAck), never raw row JSON */
  function makerPlacedReading(parent, result){
    var note=function(text){ return el('span',null,text); };
    var tiles=el('div','maker-fields'), card=typeof result.card==='number'?result.card:null,
        floor=result.floor&&typeof result.floor.rm==='number'?result.floor.rm:null,
        margin=result.margin&&typeof result.margin.rm==='number'?result.margin:null,
        usual=result.usual&&typeof result.usual.rate==='number'?result.usual.rate:null,
        quote=typeof result.quote==='number'?result.quote:null;
    /* every figure is the server's; the browser only words a comparison, it computes none */
    if(card==null) tiles.appendChild(kpiTile('mist','Their card today','-',note(result.cardNote||'no card for this size')));
    else tiles.appendChild(kpiTile(quote==null||quote>=card?'steel':'copper','Their card today',rm(card),
      note('the quote is '+(quote==null?'not read':rm(quote))+(result.cardNote?' · '+result.cardNote:''))));
    if(margin==null) tiles.appendChild(kpiTile('mist','Margin','-',note('no cost on this book')));
    else tiles.appendChild(kpiTile(margin.rm>0.004?'verdigris':'ember','Margin',rm(margin.rm),note((result.cost&&typeof result.cost.total==='number'?'on '+rm(result.cost.total)+' cost · ':'')+margin.pct+'%')));
    if(floor==null) tiles.appendChild(kpiTile('mist','Floor','-',note('no floor for this size')));
    else tiles.appendChild(kpiTile(quote!=null&&quote>=floor-0.004?'verdigris':'ember','Floor',rm(floor),
      note(quote!=null&&quote>=floor-0.004?'the quote clears it':'the quote is under it')));
    if(usual==null) tiles.appendChild(kpiTile('mist','Their usual','-',note('no priced order yet')));
    else tiles.appendChild(kpiTile('steel','Their usual',rm(usual),note('a unit')));
    parent.appendChild(tiles);
    var flags=result.flags||[];
    parent.appendChild(el('p','salt-insight',flags.length?('The drafter flags '+(flags.length===1?'one thing':flags.length+' things')+':'):'The drafter raises no flag.'));
    flags.forEach(function(flag){ parent.appendChild(el('p','salt-insight',String(flag))); });
    if(result.owedWith!=null&&result.ceiling!=null)
      parent.appendChild(el('p','salt-insight',(result.prepay?'In advance':'On credit')+': '+(result.late&&typeof result.late.run==='number'&&typeof result.late.need==='number'?'paid late before, '+result.late.run+' of '+result.late.need+' on time since; ':'')+rm(result.owedWith)+' owed with this order, '
        +(result.owedWith>result.ceiling+0.004?'over':'within')+' '+rm(result.ceiling)+'.'
        +(result.prepay?' They are asked to pay before it is handed over.':'')));
  }
  function makerButton(parent, label, action, primary, onSuccess){
    var L=labOf(label), b=actOn(el('button',primary?'btn salt-pill salt-pill--md':'salt-ghost',L[0]),L[1],L[2]);
    var busy=false, pending=null, cancel=el('button','salt-ghost','Cancel retained input');
    cancel.type='button';cancel.hidden=true;if(L[1]) actOn(cancel,L[1]+'.cancel-retained',L[2]);
    cancel.onclick=function(){
      if(pending&&confirm('Cancel this retained request on this device? A server-committed input is not withdrawn.')){
        makerClear(pending.path);pending=null;cancel.hidden=true;
      }
    };
    var message=function(){
      var section=parent.closest('.maker-input');
      return parent.querySelector(':scope > [role="status"]')
        ||section&&section.querySelector(':scope > [role="status"]')||parent.querySelector('[role="status"]');
    };
    var changed=function(){if(!pending||!makerSaved(pending.path))pending=null;};
    parent.addEventListener('input',changed); parent.addEventListener('change',changed);
    var send=function(path,body,intent){
      if(!pending) pending={path:path,body:JSON.parse(JSON.stringify(body))};
      if(pending.path!==path) return Promise.reject(new Error('Finish the pending input before starting another.'));
      if(path.indexOf('/all/maker/inputs/')===0){
        var saved=makerSaved(path);
        if(saved&&JSON.stringify(saved.body)!==JSON.stringify(pending.body)){
          var metadata=function(value){var copy=Object.assign({},value);['at','vault','addrVault','pair'].forEach(function(key){delete copy[key];});return JSON.stringify(copy);};
          if(!intent||!saved.body.pair||metadata(saved.body)!==metadata(pending.body))
            return Promise.reject(new Error('A retained request needs Retry, Review or explicit Cancel before another input.'));
        }
        if(intent){pending.base=intent.base;pending.desired=intent.desired;}
        makerSave(pending);
        cancel.hidden=false;
      }
      return refs(pending.path,pending.body).then(function(result){
        if(!result||result.ok!==true)throw new Error('The input completion was not confirmed. Its request is kept.');
        makerClear(pending.path);pending=null;cancel.hidden=true;if(onSuccess)onSuccess();return result;
      },function(error){
        /* a refusal that leaves nothing to retry (no proposal to accept) clears the retained request and its Cancel */
        /* a gift the Desk already holds queued is refused before anything is recorded: nothing to retry, so the form is free again */
        if(error.status===409&&error.detail&&error.detail.queuedTwin&&path==='/all/maker/inputs/gift'){makerClear(path);pending=null;cancel.hidden=true;}
        if(error.status===400&&(path==='/all/maker/inputs/tier-accept-all'||path==='/all/maker/inputs/hush')){makerClear(path);pending=null;cancel.hidden=true;}
        if(error.status===400&&path==='/all/maker/inputs/house-sizes'){makerClear(path);pending=null;cancel.hidden=true;}
        /* a loan the Desk already holds queued is refused before anything is recorded: nothing to retry, so the form is free again */
        if(error.status===409&&error.detail&&error.detail.queuedTwin&&path==='/all/maker/inputs/loan'){makerClear(path);pending=null;cancel.hidden=true;}
        if(error.detail&&(error.detail.twin||error.detail.code==='vaultConflict')){
          cancel.onclick=function(){if(confirm('Cancel this retained request on this device? A server-committed input is not withdrawn.')){makerClear(path);pending=null;cancel.hidden=true;}};
          if(error.detail.twin){makerClear(path);cancel.hidden=true;}
          pending=null;
        }
        throw error;
      });
    };
    b.type='button'; b.addEventListener('click',async function(){
      if(busy)return;
      busy=true;b.disabled=true;
      var controls=Array.from(parent.querySelectorAll('input,select,textarea,button')).filter(function(control){return control!==b;});
      var disabled=controls.map(function(control){return control.disabled;});
      controls.forEach(function(control){control.disabled=true;});
      try{
        if(pending){
          await send(pending.path,pending.body);
          var status=message();
          if(status)status.textContent='Sent for review.';
          await loadMaker();
        }else await action(send);
      }catch(error){
        var failure=message();
        if(failure)failure.textContent=error.message;
        else throw error;
      }
      finally{
        controls.forEach(function(control,index){control.disabled=disabled[index];});
        busy=false;b.disabled=false;
      }
    }); parent.appendChild(b);parent.appendChild(cancel);return b;
  }
      function makerSaved(path){
        var text=localStorage.getItem('saltMakerPending:'+path);
        if(!text)return null;
        var saved=JSON.parse(text);
        if(!makerGeo.pendingOk(saved))throw new Error('The retained request is invalid. Explicitly cancel it before another input.');
        return saved;
      }
      function makerSave(record){
        if(!makerGeo.pendingOk(record))throw new Error('The retry record contains unsupported metadata. Nothing was sent.');
        localStorage.setItem('saltMakerPending:'+record.path,JSON.stringify(record));
      }
      function makerClear(path){localStorage.removeItem('saltMakerPending:'+path);}
      function makerRecovery(parent){
        var keys=Object.keys(localStorage).filter(function(key){return key.indexOf('saltMakerPending:')===0;});
        keys.forEach(function(key){
          var path=key.slice('saltMakerPending:'.length),saved;
          var section=makerForm(retainedPart(path));section.setAttribute('data-key',path.split('/').pop());section.setAttribute('data-formmenu','');section.appendChild(el('h3',null,'Retained input'));
          var status=makerStatus(section),pass=makerField(section,['Vault passphrase','record.retained.passphrase'],'password','');
          parent.appendChild(section);
          try{saved=makerSaved(path);status.textContent=path.split('/').pop()+' · retained on this device. Retry is unchanged; Review starts a new request.';}
          catch(error){status.textContent=error.message;}
          var run=async function(review){
            try{
              if(!saved)throw new Error('Only explicit cancellation is available for an invalid request.');
              if(saved.body.pair||saved.body.vault||saved.body.addrVault){
                if(!pass.value)throw new Error('Unlock the retained ciphertext before retry or review.');
                await makerVaultOpen(pass.value,saved.body.pair?saved.body.pair.names:saved.body.vault||saved.body.addrVault);
                if(review){
                  if(!saved.body.pair)throw new Error('Legacy vault retries can only be sent unchanged or explicitly cancelled.');
                  var prepared=await makerPairPrepare(pass.value,function(){},saved);
                  saved={path:saved.path,body:Object.assign({},saved.body,{at:new Date().toISOString(),
                    pair:{expectedRevision:prepared.revision,names:prepared.names,places:prepared.places}}),
                    base:prepared.base,desired:prepared.desired};
                  if(saved.body.vault)saved.body.vault=prepared.names;
                  if(saved.body.addrVault)saved.body.addrVault=prepared.places;
                  makerSave(saved);
                }
              }else if(review)throw new Error('This immutable input can only be retried unchanged or explicitly cancelled.');
              pass.value='';
              var answer=await refs(saved.path,saved.body);
              if(!answer||answer.ok!==true)throw new Error('The input completion was not confirmed.');
              makerClear(saved.path);section.remove();await loadMaker();
            }catch(error){pass.value='';status.textContent=error.message;}
          };
          ['Retry unchanged','Review latest','Cancel retained input'].forEach(function(label,index){
            var button=actOn(el('button','salt-ghost',label),['record.retained.retry','record.retained.review','record.retained.cancel'][index]);button.type='button';
            button.onclick=async function(){
              if(index===2){
                if(confirm('Cancel this retained request on this device? An input already committed on the server is not withdrawn.')){
                  makerClear(path);section.remove();
                }
                return;
              }
              var controls=section.querySelectorAll('button');controls.forEach(function(control){control.disabled=true;});
              try{await run(index===1);}finally{controls.forEach(function(control){control.disabled=false;});}
            };section.appendChild(button);
          });
        });
      }
  /* 11 Oct 2026: a Record form is a section that shows in one part of Record, Entry, Customers or Pricing (data-in); a retained input
     shows in the part its route belongs to */
  function makerForm(part){ var section=el('section','maker-input'); section.setAttribute('data-in','record.'+part); return section; }
  function retainedPart(path){
    var k=path.split('/').pop();
    return ['add-id','amend-id','appoint-existing','place'].indexOf(k)>=0?'customers':['house-sizes','hush','tier-set','tier-accept-all'].indexOf(k)>=0?'pricing':'entry';
  }
  function makerField(parent, label, type, value, step){
    var L=labOf(label), wrap=el('label','maker-field'), title=el('span','lbl',L[0]), input=actOn(el('input','fld salt-field__input'),L[1],L[2]);
    input.type=type; input.value=value==null?'':String(value);
    if(type==='number'){ input.step=step||'0.01'; input.min='0'; input.inputMode='decimal'; }
    wrap.appendChild(title); wrap.appendChild(input); parent.appendChild(wrap); return input;
  }
  function makerBytes64(bytes){
    var text=''; for(var i=0;i<bytes.length;i++) text+=String.fromCharCode(bytes[i]);
    return btoa(text);
  }
  function makerFrom64(value){
    var text=atob(value), bytes=new Uint8Array(text.length);
    for(var i=0;i<text.length;i++) bytes[i]=text.charCodeAt(i);
    return bytes;
  }
  async function makerVaultOpen(pass, envelope){
    if(!envelope) return {};
    var base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
    var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:makerFrom64(envelope.salt),
      iterations:envelope.it||150000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    var plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:makerFrom64(envelope.iv)},key,makerFrom64(envelope.ct));
    var value=JSON.parse(new TextDecoder().decode(plain));
    if(!value||typeof value!=='object'||Array.isArray(value)) throw new Error('The encrypted vault is not a code map.');
    return value;
  }
  async function makerPairPrepare(pass,edit,previous){
    var namesRead=await refs('/all/maker/vault'), pair=null, names,places;
    if(namesRead.revision)pair=await refs('/all/maker/vault/pair');
    var placesRead=pair?{vault:pair.places}:await refs('/all/maker/vault/addr');
    names=await makerVaultOpen(pass,pair?pair.names:namesRead.vault);
    places=await makerVaultOpen(pass,placesRead.vault);
    var base=previous?{names:await makerVaultOpen(pass,previous.base.names),places:await makerVaultOpen(pass,previous.base.places)}
      :{names:JSON.parse(JSON.stringify(names)),places:JSON.parse(JSON.stringify(places))};
    var desired=previous?{names:await makerVaultOpen(pass,previous.desired.names),places:await makerVaultOpen(pass,previous.desired.places)}
      :{names:JSON.parse(JSON.stringify(names)),places:JSON.parse(JSON.stringify(places))};
    if(!previous)edit(desired);
    var nextNames=makerGeo.merge(base.names,desired.names,names),nextPlaces=makerGeo.merge(base.places,desired.places,places);
    var conflicts=Array.from(new Set(nextNames.conflicts.concat(nextPlaces.conflicts)));
    if(conflicts.length){
      if(!confirm('The vault changed for '+conflicts.join(', ')+'. Apply your retained edit over those changed entries? Cancel keeps this draft.'))
        throw new Error('Conflict not applied. Your form is kept; review it before sending.');
      nextNames=makerGeo.merge(base.names,desired.names,names,conflicts);
      nextPlaces=makerGeo.merge(base.places,desired.places,places,conflicts);
    }
    var sealed=await Promise.all([makerVaultSeal(pass,nextNames.map),makerVaultSeal(pass,nextPlaces.map),
      makerVaultSeal(pass,base.names),makerVaultSeal(pass,base.places),makerVaultSeal(pass,desired.names),makerVaultSeal(pass,desired.places)]);
    return {base:{names:sealed[2],places:sealed[3]},desired:{names:sealed[4],places:sealed[5]},revision:pair&&pair.revision,names:sealed[0],
      places:pair&&pair.places===null&&!Object.keys(nextPlaces.map).length?null:sealed[1],placeMap:nextPlaces.map};
  }
  function makerPairBody(body,prepared){
    if(prepared.revision)body.pair={expectedRevision:prepared.revision,names:prepared.names,places:prepared.places};
    return body;
  }
  async function makerVaultSeal(pass, value){
    var salt=crypto.getRandomValues(new Uint8Array(16)), iv=crypto.getRandomValues(new Uint8Array(12));
    var base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
    var key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:150000,hash:'SHA-256'},
      base,{name:'AES-GCM',length:256},false,['encrypt']);
    var cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(JSON.stringify(value)));
    return {v:1,salt:makerBytes64(salt),iv:makerBytes64(iv),ct:makerBytes64(new Uint8Array(cipher))};
  }
  function makerRekeyMap(map,from,to){
    return makerGeo.rekey(map,from,to);
  }
  function makerDerivedCode(name, locality, kind, roster, except, parent){
    var n=String(name||'').trim(), local=String(locality||'').split(',')[0].trim();
    if(!n) return null;
    local=local||'TBC';
    var bits=local.split(/\\s+/), suffix=(bits.length>1?bits.map(function(x){return x.charAt(0);}).join(''):local.slice(0,3)).toUpperCase();
    if(kind==='downstream'){
      if(!parent) return null;
      var siblings=roster.filter(function(code){return code.indexOf(parent+'-')===0&&/-\\d+-/.test(code.slice(parent.length));});
      return parent+'-'+(siblings.length+1)+'-'+suffix;
    }
    var base=(kind==='supplier'?'S':'C')+n.charAt(0).toUpperCase()+n.length+'-'+suffix;
    var free=function(code){return code===except||roster.indexOf(code)<0;};
    if(free(base)) return base;
    var head=base.slice(0,2), tail=base.slice(2), more=n.slice(1).replace(/[^A-Za-z]/g,'').toUpperCase();
    for(var i=1;i<=more.length;i++){var next=head+more.slice(0,i)+tail;if(free(next)) return next;}
    for(i=2;;i++) if(free(base+i)) return base+i;
  }
  function makerStatus(parent){
    var status=el('p','msg'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    parent.appendChild(status); return status;
  }
  var makerPlaceListId=0;
  function makerLocalityField(parent, act){
    var input=makerField(parent,['Locality (device only)',act],'text','');
    var list=el('datalist'), key='makerPlaces'+(++makerPlaceListId);
    list.id=key;input.setAttribute('list',key);
    makerGeo.picks().forEach(function(point,label){
      var option=el('option');option.value=label;list.appendChild(option);
    });
    parent.appendChild(list);return input;
  }
  async function makerLocalityPoint(value){
    var picked=makerGeo.picks().get(value);
    var result=picked?{point:picked}:await makerGeo.find(value);
    if(!result.point)throw new Error(result.how==='ambiguous'
      ?'That locality names more than one place. Choose its district from the list.'
      :'That locality is not on the official list. Place it on Desk first.');
    return result.point.map(function(number){return Math.round(number*100)/100;});
  }
  async function makerFiledLink(value){
    if(!value.trim())return null;
    var reading=makerGeo.link(value);
    if(reading&&reading.short){
      var expanded=await refs('/all/maker/geo/expand',{url:reading.short});
      var full=makerGeo.link(expanded.location);
      if(!full||full.short)throw new Error('The short link did not lead to a map. Paste the full link.');
      reading=Object.assign({},full,{addr:reading.addr||full.addr});
    }
    if(!reading||reading.lat==null&&!reading.addr)
      throw new Error('Paste a Maps or Waze link carrying a point or address, or clear the field.');
    return {addr:reading.addr||null,lat:reading.lat,lng:reading.lng,src:reading.src,at:new Date().toISOString()};
  }
  async function makerOtherInputs(parent,catalog,refreshTradeCatalog){
    makerGeo.configure(catalog.placed);
    var today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kuala_Lumpur'});
    var idCanStart=function(kind){return kind==='customer'||kind==='reseller'||kind==='referral';};
    var parties=(catalog.parties||[]).filter(function(code){return !code.endsWith('-R');});
    var books=catalog.products||[];
    var addSelect=function(root,label,items){
      var L=labOf(label), wrap=el('label','maker-field'), title=el('span','lbl',L[0]), select=actOn(el('select','fld salt-field__input'),L[1],L[2]);
      items.forEach(function(item){var option=el('option',null,item.label);option.value=item.value;select.appendChild(option);});
      wrap.appendChild(title);wrap.appendChild(select);root.appendChild(wrap);return select;
    };
    /* a row already booked with the same party, amount and date is asked about, as a trade is: he says it is a separate one, or nothing is sent */
    var makerSecond=async function(send,path,body,what){
      try{return await send(path,body);}
      catch(error){
        var twin=error.detail&&error.detail.twin&&error.detail.twin.second;
        if(!twin||!window.confirm('A matching '+what+' is already booked. Record this as a separate '+what+'?'))throw error;
        return send(path,Object.assign({},body,{at:new Date().toISOString(),second:twin}));
      }
    };
    var partyItems=parties.map(function(code){return {value:code,label:code};});
    var productItems=books.map(function(item){return {value:item.product,label:pshape(item.product)};});
    var loan=makerForm('entry');loan.appendChild(el('h3',null,'Borrow or lend'));
    loan.appendChild(el('p','msg','Cash and in-kind loans use the ledger’s loan rows. Notes are disabled here: free text could disclose names or places.'));
    parent.appendChild(loan);
    var loanForm=addSelect(loan,['Form','record.loan.form'],[{value:'salt',label:'In kind'},{value:'cash',label:'Cash'}]);
    var loanDirection=addSelect(loan,['Direction','record.loan.direction'],[{value:'in',label:'Borrow'},{value:'out',label:'Lend'}]);
    var loanParty=addSelect(loan,['Party','record.loan.party'],partyItems), loanProduct=addSelect(loan,['Book','record.loan.book'],productItems);
    var loanDate=makerField(loan,['Date','record.loan.date'],'date',today), loanAmount=makerField(loan,['Units or RM','record.loan.amount'],'number','1');
    var loanStatus=makerStatus(loan);
    makerButton(loan,['Send loan for review','record.loan.send'],async function(send){
      if(!loanStatus) return;
      loanStatus.textContent='Sending to the Desk…';
      var body={at:new Date().toISOString(),form:loanForm.value,direction:loanDirection.value,
        code:loanParty.value,date:loanDate.value,amount:Number(loanAmount.value)};
      if(loanForm.value==='salt') body.product=loanProduct.value;
      try{await makerSecond(send,'/all/maker/inputs/loan',body,'loan');loanStatus.textContent='Sent for review. It changes the loan book only when approved and folded.';loadMaker();}
      catch(error){loanStatus.textContent=error.message;}
    },true);
    var gift=makerForm('entry');gift.appendChild(el('h3',null,'Gift'));
    gift.appendChild(el('p','msg','The Desk costs this from the inventory and books goodwill, not a reward redemption. No note field is sent.'));
    parent.appendChild(gift);
    var giftParty=addSelect(gift,['Party','record.gift.party'],partyItems), giftProduct=addSelect(gift,['Book','record.gift.book'],productItems);
    var giftDate=makerField(gift,['Date','record.gift.date'],'date',today), giftQty=makerField(gift,['Units','record.gift.units'],'number','1');
    var giftHandover=addSelect(gift,['Handover','record.gift.handover'],[{value:'',label:'Not stated'},{value:'collected',label:'Collected'},{value:'delivered',label:'Delivered'}]);
    var giftStatus=makerStatus(gift);
    makerButton(gift,['Send gift for review','record.gift.send'],async function(send){
      var body={at:new Date().toISOString(),product:giftProduct.value,code:giftParty.value,date:giftDate.value,
        qty:Number(giftQty.value),movedUnits:Number(giftQty.value),handover:giftHandover.value||null};
      giftStatus.textContent='Sending to the Desk…';
      try{await makerSecond(send,'/all/maker/inputs/gift',body,'gift');giftStatus.textContent='Sent for review. It changes nothing until approved and folded.';loadMaker();}
      catch(error){giftStatus.textContent=error.message;}
    },true);
    var repay=makerForm('entry');repay.appendChild(el('h3',null,'Repayment'));
    repay.appendChild(el('p','msg','Choose an open loan. The Desk checks the remaining amount and whether it is due in units or RM.'));
    parent.appendChild(repay);
    var loanItems=(catalog.loans||[]).map(function(item){return {value:item.rid,label:item.party+' · '+item.rid+' · '+item.remaining+' '+(item.form==='cash'?'RM':'unit')};});
    var repayLoan=addSelect(repay,['Open loan','record.repay.loan'],loanItems), repayDate=makerField(repay,['Date','record.repay.date'],'date',today),
      repayAmount=makerField(repay,['Amount','record.repay.amount'],'number','1'), repayStatus=makerStatus(repay);
    makerButton(repay,['Send repayment for review','record.repay.send'],async function(send){
      repayStatus.textContent='Sending to the Desk…';
      try{await send('/all/maker/inputs/repay',{at:new Date().toISOString(),loan:repayLoan.value,
        date:repayDate.value,amount:Number(repayAmount.value)});
        repayStatus.textContent='Sent for review. It settles only when approved and folded.';loadMaker();}
      catch(error){repayStatus.textContent=error.message;}
    },true);
    var redeem=makerForm('entry');redeem.appendChild(el('h3',null,'Reward redemption'));
    redeem.appendChild(el('p','msg','The Desk derives the balance. An outstanding advance is offset first; otherwise the reward is redeemed in kind.'));
    parent.appendChild(redeem);
    var redeemDate=makerField(redeem,['Date','record.redeem.date'],'date',today), redeemStatus=makerStatus(redeem),
      redeemList=el('div','maker-rewards');
    redeem.appendChild(redeemList);
    function drawMakerRewards(rewards){
      redeemList.textContent='';
      if(!rewards.length)redeemList.appendChild(el('p','msg','No reward is held.'));
      rewards.forEach(function(offer){
        var row=el('div','maker-reward');row.setAttribute('data-reward-holder',offer.code);
        row.appendChild(el('p','maker-facts',offer.code+' · '+offer.held+' unit held'
          +(offer.departed?' while departed':offer.free<offer.held?' · '+offer.free+' unit available after reservations':'')));
        if(offer.action){
          var status=makerStatus(row);
          makerButton(row,[offer.action+' '+(offer.action==='Redeem'&&!offer.associate?'1 unit':'reward')+' for '+offer.code,'record.redeem.send'],async function(send){
            status.textContent='Checking the reward on the Desk…';
            try{
              await send('/all/maker/inputs/redeem',{at:new Date().toISOString(),code:offer.code,date:redeemDate.value});
              redeemStatus.textContent='Sent for review. It settles only when approved and folded.';
              var read=await refs('/all/maker/inputs');drawMakerRewards(read.catalog.rewards||[]);loadMaker();
            }catch(error){status.textContent=error.message;}
          },true);
        }
        redeemList.appendChild(row);
      });
    }
    drawMakerRewards(catalog.rewards||[]);
    makerButton(redeem,['Read reward offers','record.redeem.read'],async function(){
      try{var read=await refs('/all/maker/inputs');drawMakerRewards(read.catalog.rewards||[]);redeemStatus.textContent='Reward offers read.';}
      catch(error){redeemStatus.textContent=error.message;}
    },false);
    var offsets=makerForm('entry');offsets.appendChild(el('h3',null,'Automatic offsets'));
    offsets.appendChild(el('p','msg','What the Desk offers an associate holding a reward and an unpaid advance: one unit against the oldest order. A departed holder is never offered. Each tap waits for approval.'));
    parent.appendChild(offsets);
    var offerDate=makerField(offsets,['Date','record.offset.date'],'date',today), offerStatus=makerStatus(offsets),
      offerList=el('div','maker-offers');
    offsets.appendChild(offerList);
    var offerLoad=async function(){
      offerStatus.textContent='Reading offers from the Desk…';
      try{
        var read=await refs('/all/maker/offsets');
        offerList.textContent='';
        offerStatus.textContent=read.offers.length?read.offers.length+' offered.':'No offset is offered.';
        read.offers.forEach(function(offer){
          var row=el('div','maker-offer'); row.setAttribute('data-key',offer.rid);
          row.appendChild(el('p','maker-facts',offer.code+' · '+offer.units+' unit · RM '+offer.rm.toFixed(2)+' against the '+(offer.saleDate||'undated')+' order '+offer.rid));
          makerButton(row,['Send offset for review','record.offset.send'],async function(send){
            offerStatus.textContent='Sending to the Desk…';
            try{
              await send('/all/maker/inputs/offset',{at:new Date().toISOString(),code:offer.code,rid:offer.rid,date:offerDate.value});
              await offerLoad();
              offerStatus.textContent='Sent for review. It settles in kind only when approved and folded.';
              loadMaker();
            }catch(error){offerStatus.textContent=error.message;}
          },true);
          offerList.appendChild(row);
        });
      }catch(error){offerStatus.textContent=error.message;}
    };
    offerLoad();
    var editor=makerForm('entry');editor.appendChild(el('h3',null,'Amend a ledger row'));
    editor.appendChild(el('p','msg','Correction restates typed fields, the order code included, on any row that is not cancelled (a cancelled row is revived below); a defaulted row takes a Correction only. Fulfilment records cash or units; Cancellation withdraws an open row with no goods moved. A purchase lot also takes Payment (cash), Receipt (units) and Default (nothing arrived). Notes, settlement prose and reviving a cancelled row stay on Desk. Linked/Rewarded are unavailable here and refused by the cloud drafter.'));
    parent.appendChild(editor);
    var rows=catalog.rows||[], rowItems=rows.map(function(row){return {value:row.rid,
      label:row.rid+' · '+row.party+' · '+pshape(row.product)+' · '+(row.date||'Undated')+' · '+row.qty+' unit · RM '+row.total+(row.defaulted?' · Defaulted':'')};});
    var editRow=addSelect(editor,['Ledger row','record.amend.row'],rowItems),
      editKind=addSelect(editor,['Amendment','record.amend.kind'],[{value:'Correction',label:'Correction'},
        {value:'Fulfilment',label:'Fulfilment'},{value:'Cancellation',label:'Cancellation'}]),
      editDate=makerField(editor,['Recorded on','record.amend.date'],'date',today);
    var movement=el('div','maker-fields');editor.appendChild(movement);
    var editCash=makerField(movement,['RM moved','record.amend.cash'],'number','0'), editUnits=makerField(movement,['Units moved','record.amend.units'],'number','0');
    var patch=el('div','maker-fields');editor.appendChild(patch);
    var definitions=catalog.correctionFields||[];
    var editField=addSelect(patch,['Field','record.amend.field'],definitions.map(function(item){return {value:item.field,label:item.field};}));
    var valueBox=el('div','maker-fields');patch.appendChild(valueBox);
    var editValue=null, changes={}, patchList=el('p','msg');patch.appendChild(patchList);
    var editStatus=makerStatus(editor);
    var cancelPreview=el('div','maker-cancellation');cancelPreview.setAttribute('aria-live','polite');editor.appendChild(cancelPreview);
    var drawValue=function(){
      valueBox.replaceChildren();
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition)return;
      var choices=definition.kind==='boolean'?[{value:'true',label:'True'},{value:'false',label:'False'}]
        :definition.kind==='code'?partyItems
          :definition.kind==='product'?productItems
            :definition.kind==='stream'?[{value:'R2',label:'R2'},{value:'R3',label:'R3'}]
              :definition.kind==='handover'?[{value:'delivered',label:'Delivered'},{value:'collected',label:'Collected'}]:null;
      if(choices)editValue=addSelect(valueBox,['Set to','record.amend.value'],choices);
      else editValue=makerField(valueBox,['Set to','record.amend.value'],definition.kind==='date'?'date':definition.kind==='text'?'text':'number','');
    };
    editField.addEventListener('change',drawValue);drawValue();
    makerButton(patch,['Add field change','record.amend.add-change'],function(){
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition||!editValue)return;
      if(!editValue.value.trim())throw new Error('Choose a value. Use Clear field to remove an optional value.');
      changes[definition.field]=definition.kind==='number'?Number(editValue.value)
        :definition.kind==='boolean'?editValue.value==='true':definition.kind==='text'?editValue.value.trim():editValue.value;
      patchList.textContent=Object.keys(changes).join(', ')+' ready to send.';
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    });
    makerButton(patch,['Clear field','record.amend.clear-field'],function(){
      var definition=definitions.find(function(item){return item.field===editField.value;});
      if(!definition||definition.required)throw new Error('This field is required; set a replacement value.');
      changes[definition.field]=null;patchList.textContent=Object.keys(changes).join(', ')+' ready to send.';
      editor.dispatchEvent(new Event('input',{bubbles:true}));
    });
    editRow.addEventListener('change',function(){changes={};patchList.textContent='';});
    var kindsFor=function(){
      var row=rows.find(function(item){return item.rid===editRow.value;}), kept=editKind.value;
      var names=row&&row.defaulted?['Correction']:row&&row.direction==='BUY'?['Correction','Fulfilment','Cancellation','Payment','Receipt','Default']:['Correction','Fulfilment','Cancellation'];
      editKind.replaceChildren();
      names.forEach(function(name){var option=el('option',null,name);option.value=name;editKind.appendChild(option);});
      editKind.value=names.indexOf(kept)>=0?kept:'Correction';
    };
    var drawKind=function(){var k=editKind.value;
      movement.style.display=(k==='Fulfilment'||k==='Payment'||k==='Receipt')?'':'none';
      editCash.disabled=k==='Cancellation';editUnits.disabled=k==='Cancellation';
      editCash.parentNode.style.display=k==='Receipt'?'none':'';editUnits.parentNode.style.display=k==='Payment'?'none':'';
      patch.style.display=k==='Correction'?'':'none';
      cancelPreview.replaceChildren();cancelPreview.hidden=k!=='Cancellation';
      if(k==='Cancellation'){
        var row=rows.find(function(item){return item.rid===editRow.value;}), reading=row&&row.cancellation;
        if(!reading){cancelPreview.appendChild(el('p','msg','Cancellation preview unavailable: the row is not open or goods have moved. Read the ledger again.'));return;}
        cancelPreview.appendChild(el('p','maker-facts','After · '+reading.pay+' · '+reading.deliv+' · '+reading.order));
        var refund=reading.refundRM;
        cancelPreview.appendChild(el('p','msg','The row is marked cancelled outright'
          +(refund!=null?', and RM '+refund+' already paid becomes a refund payable back to '+row.party:'')
          +'. Cash and units are not used here: what is owed back is what was paid.'));
      }};
    editKind.addEventListener('change',drawKind);editRow.addEventListener('change',function(){kindsFor();drawKind();});kindsFor();drawKind();
    var editorButton=makerButton(editor,['Send amendment for review','record.amend.send'],async function(send){
      var body={at:new Date().toISOString(),rid:editRow.value,kind:editKind.value,date:editDate.value};
      if(body.kind==='Correction')body.fields=Object.assign({},changes);
      if(body.kind==='Fulfilment'){body.cash=Number(editCash.value);body.movedUnits=Number(editUnits.value);}
      if(body.kind==='Payment')body.cash=Number(editCash.value);
      if(body.kind==='Receipt')body.movedUnits=Number(editUnits.value);
      editStatus.textContent='Checking the ledger row…';
      await send('/all/maker/inputs/ledger-amend',body);
      changes={};patchList.textContent='';editStatus.textContent='Sent for review. The row changes only after approval and the fold.';
      await loadMaker();
    },true);
    editorButton.disabled=!rows.length;
    if(!rows.length)editStatus.textContent='No ledger row is available.';
    var revive=makerForm('entry');revive.appendChild(el('h3',null,'Revive a cancelled row'));
    revive.appendChild(el('p','msg','Puts a cancelled order back on the book: cancelled off and its date cleared, as one Correction for approval. Only a row with nothing paid and nothing moved is offered; a paid cancel is a refund, closed by hand.'));
    parent.appendChild(revive);
    var revivable=(catalog.revivable||[]).filter(function(row){return !(row.paid>0.009)&&!(row.movedUnits>0.009);});
    var reviveRow=addSelect(revive,['Cancelled row','record.revive.row'],revivable.map(function(row){return {value:row.rid,
      label:row.rid+' · '+row.party+' · '+pshape(row.product)+' · '+(row.date||'Undated')+' · '+row.qty+' unit · RM '+row.total+(row.cancelledOn?' · Cancelled '+row.cancelledOn:'')};}));
    var reviveDate=makerField(revive,['Recorded on','record.revive.date'],'date',today), reviveStatus=makerStatus(revive);
    var reviveButton=makerButton(revive,['Send revival for review','record.revive.send'],async function(send){
      reviveStatus.textContent='Checking the ledger row…';
      await send('/all/maker/inputs/ledger-amend',{at:new Date().toISOString(),rid:reviveRow.value,kind:'Correction',date:reviveDate.value,
        fields:{cancelled:false,cancelledOn:null}});
      reviveStatus.textContent='Sent for review. The order is back on the book only after approval and the fold.';
      await loadMaker();
    },true);
    reviveButton.disabled=!revivable.length;
    if(!revivable.length)reviveStatus.textContent='No cancelled row can be revived.';
    var id=makerForm('customers');id.appendChild(el('h3',null,'Add ID'));
    id.appendChild(el('p','msg','Name and locality stay in this device until encrypted. Only the derived code, role and sealed envelope leave it. A name/place note is never sent.'));
    parent.appendChild(id);
    var idKind=addSelect(id,['Role','record.add-id.role'],[{value:'customer',label:'Customer'},{value:'supplier',label:'Supplier'},
      {value:'reseller',label:'Reseller'},{value:'referral',label:'Referral'},
      {value:'downstream',label:'Downstream buyer'},{value:'bucket',label:'Resale account'}]);
    var idParentItems=(catalog.associates||[]).map(function(item){return {value:item.code,label:item.code};});
    var idParent=addSelect(id,['Parent / associate','record.add-id.parent'],idParentItems);
    var idName=makerField(id,['Name (device only)','record.add-id.name'],'text',''), idPlace=makerLocalityField(id,'record.add-id.place');
    idPlace.closest('label').appendChild(el('span','msg','Optional. Blank gives TBC until the locality is confirmed.'));
    var idPass=makerField(id,['Vault passphrase','record.add-id.passphrase'],'password','');
    var idLink=makerField(id,['Maps / Waze link (device only)','record.add-id.link'],'text','');
    var tierBooks=books.filter(function(item){return item.tiered;});
    var tierNames=catalog.tierNames||[], idTiers=tierBooks.map(function(item){
      var sel=addSelect(id,['Starting tier, '+pshape(item.product),'record.add-id.tier',item.product],[{value:'',label:'Not set'}]
        .concat(tierNames.map(function(name){return {value:name,label:name};})));
      sel.value=tierNames.length?tierNames[tierNames.length-1]:'';
      return {product:item.product,select:sel};
    });
    var driftBooks=books.filter(function(item){return item.drift;});
    var idDrifts=driftBooks.map(function(item){
      var product=pshape(item.product), presets=item.driftPresets||[];
      var select=addSelect(id,['Starting drift, '+product,'record.add-id.drift',item.product],[{value:'',label:product+': automatic'}]
        .concat(presets.map(function(preset){return {value:String(preset.value),
          label:product+': '+preset.name+', '+(preset.value>0?'+':'')+Number(preset.value).toFixed(2)};}))
        .concat([{value:'typed',label:product+': typed'}]));
      var typed=makerField(id,['Typed starting drift, '+product,'record.add-id.drift-value',item.product],'number','',0.05);
      typed.min='-1';typed.max='1';typed.step='0.05';typed.placeholder='-1 to 1';typed.closest('label').hidden=true;
      select.addEventListener('change',function(){typed.closest('label').hidden=select.value!=='typed';});
      return {product:item.product,select:select,typed:typed};
    });
    var idStatus=makerStatus(id), idBusy=false;
    idKind.addEventListener('change',function(){
      var bucket=idKind.value==='bucket', needsParent=bucket||idKind.value==='downstream';
      idName.disabled=bucket;idPlace.disabled=bucket;idPass.disabled=bucket;idLink.disabled=bucket;
      idParent.disabled=!needsParent;
      var canStart=idCanStart(idKind.value);
      idTiers.forEach(function(item){item.select.disabled=!canStart;});
      idDrifts.forEach(function(item){item.select.disabled=!canStart;item.typed.disabled=!canStart;});
    });
    idKind.dispatchEvent(new Event('change'));
    var idDraft=null;
    id.addEventListener('input',function(event){if(event.target!==idPass)idDraft=null;});
    id.addEventListener('change',function(event){if(event.target!==idPass)idDraft=null;});
    makerButton(id,['Encrypt and send Add ID','record.add-id.send'],async function(send){
      if(idBusy)return;idBusy=true;idStatus.textContent='Preparing the device-side vault…';
      var kind=idKind.value, parentCode=(kind==='bucket'||kind==='downstream')?idParent.value:null;
      var tiers={};
      if(idCanStart(kind)){
        idTiers.forEach(function(item){if(item.select.value)tiers[item.product]=item.select.value;});
        for(var driftIndex=0;driftIndex<idDrifts.length;driftIndex++){
          var driftItem=idDrifts[driftIndex], choice=driftItem.select.value, driftValue;
          if(choice==='typed'){
            var raw=driftItem.typed.value.trim();driftValue=Number(raw);
            if(!raw||!Number.isFinite(driftValue)||driftValue< -1||driftValue>1){
              idStatus.textContent='Enter a drift from -1 to +1.';idBusy=false;return;
            }
          }else if(choice!=='')driftValue=Number(choice);
          else continue;
          tiers[driftItem.product]=driftValue;
        }
      }
      if(!Object.keys(tiers).length)tiers=null;
      var name=idName.value.trim(), locality=idPlace.value.trim(), code;
      if(kind==='bucket') code=parentCode?parentCode+'-R':null;
      else code=makerDerivedCode(name,locality,kind,catalog.parties||[],null,parentCode);
      if(!code){idStatus.textContent='Enter a name, or choose the parent for a resale account.';idBusy=false;return;}
      var envelope=null,addrEnvelope=null,geo=null;
      try{
        if(kind!=='bucket'){
          var pass=idPass.value;
          if(!pass) throw new Error('Enter the vault passphrase on this device.');
          if(locality)geo=await makerLocalityPoint(locality);
          var filed=await makerFiledLink(idLink.value);
          idDraft=await makerPairPrepare(pass,function(maps){
            if(Object.hasOwn(maps.names,code))throw new Error('That code is already filed in the vault. Keep this form and review its identity.');
            maps.names[code]=name+' ('+(locality||'to be confirmed')+')';if(filed)maps.places[code]=filed;
          },idDraft);
          envelope=idDraft.names;if(filed)addrEnvelope=idDraft.places;delete idDraft.placeMap;
          idPass.value='';pass='';
        }
        var idBody={at:new Date().toISOString(),code:code,kind:kind,
          parent:parentCode,tiers:tiers,vault:envelope};
         if(geo)idBody.geo=geo;
        if(addrEnvelope)idBody.addrVault=addrEnvelope;
        if(idDraft)makerPairBody(idBody,idDraft);
        await send('/all/maker/inputs/add-id',idBody,idDraft);
        idDraft=null;
        idName.value='';idPlace.value='';idLink.value='';
        try{
          await refreshTradeCatalog();
          idStatus.textContent='Encrypted envelope filed; '+code+' is queued for review and is now selectable.';
        }catch(refreshError){
          idStatus.textContent=code+' was filed for review, but the trade choices could not be refreshed: '+refreshError.message;
        }
        loadMaker();
      }catch(error){idPass.value='';idStatus.textContent=error.message;}
      idBusy=false;
    },true);
    var appointment=makerForm('customers');appointment.appendChild(el('h3',null,'Appoint existing customer'));
    appointment.appendChild(el('p','msg','The existing ID, name and place stay as filed. The appointment changes no customer identity and waits for approval and folding.'));
    parent.appendChild(appointment);
    var appointmentCustomers=(catalog.appointmentCustomers||[]).filter(function(code){return typeof code==='string';});
    var appointmentCustomerItems=[{value:'',label:appointmentCustomers.length?'Choose an existing customer':catalog.appointmentNotice?'Appointments unavailable':'No eligible customer'}]
      .concat(appointmentCustomers.map(function(code){return {value:code,label:code};}));
    var appointmentCustomer=addSelect(appointment,['Existing customer','record.appoint.customer'],appointmentCustomerItems);
    var appointmentKinds=(catalog.appointmentKinds||[]).map(function(item){
      return {value:item.kind,label:item.kind.charAt(0).toUpperCase()+item.kind.slice(1)+' · '+item.stream};
    });
    var appointmentRoleItems=[{value:'',label:'Choose an appointment role'}].concat(appointmentKinds);
    var appointmentRole=addSelect(appointment,['Appointment role','record.appoint.role'],appointmentRoleItems);
    var appointmentStatus=makerStatus(appointment);
    makerButton(appointment,['Send appointment for review','record.appoint.send'],async function(send){
      var code=appointmentCustomer.value, kind=appointmentRole.value;
      if(!code||!kind){appointmentStatus.textContent='Choose an existing customer and appointment role.';return;}
      await send('/all/maker/inputs/appoint-existing',{at:new Date().toISOString(),code:code,kind:kind});
      var option=[].filter.call(appointmentCustomer.options,function(item){return item.value===code;})[0];
      if(option)option.remove();
      appointmentCustomer.value='';
      appointmentStatus.textContent='Sent for review. The existing identity is unchanged until the appointment is approved and folded.';
      loadMaker();
    },true);
    var amend=makerForm('customers');amend.appendChild(el('h3',null,'Amend ID'));
    amend.appendChild(el('p','msg','Names and filed addresses are re-keyed and encrypted here. Choose the locality; an optional map link replaces the encrypted address. Only codes and the rounded locality point are queued.'));
    parent.appendChild(amend);
    var amendParty=addSelect(amend,['Party','record.amend-id.party'],partyItems), amendName=makerField(amend,['Name (device only)','record.amend-id.name'],'text',''),
      amendPlace=makerLocalityField(amend,'record.amend-id.place'), amendPass=makerField(amend,['Vault passphrase','record.amend-id.passphrase'],'password',''),
      amendStatus=makerStatus(amend), amendBusy=false;
    var amendLink=makerField(amend,['Maps / Waze link (device only)','record.amend-id.link'],'text','');
    var amendDraft=null;
    amend.addEventListener('input',function(event){if(event.target!==amendPass)amendDraft=null;});
    amend.addEventListener('change',function(event){if(event.target!==amendPass)amendDraft=null;});
    makerButton(amend,['Encrypt and send Amend ID','record.amend-id.send'],async function(send){
      if(amendBusy)return;amendBusy=true;amendStatus.textContent='Preparing the device-side vault…';
      var from=amendParty.value, kind=from.charAt(0)==='S'?'supplier':'customer';
      var name=amendName.value.trim(), locality=amendPlace.value.trim(), to=makerDerivedCode(name,locality,kind,catalog.parties||[],from);
      if(!to||!locality){amendStatus.textContent='Enter a name and locality first.';amendBusy=false;return;}
      try{
        var pass=amendPass.value;if(!pass) throw new Error('Enter the vault passphrase on this device.');
        var geo=await makerLocalityPoint(locality), filed=await makerFiledLink(amendLink.value);
        amendDraft=await makerPairPrepare(pass,function(maps){
          maps.names=makerRekeyMap(maps.names,from,to);maps.places=makerRekeyMap(maps.places,from,to);
          maps.names[to]=name+' ('+locality+')';if(filed)maps.places[to]=filed;
        },amendDraft);
        delete amendDraft.placeMap;
        amendPass.value='';pass='';
        var result=await send('/all/maker/inputs/amend-id',makerPairBody({at:new Date().toISOString(),from:from,to:to,geo:geo,
          vault:amendDraft.names,addrVault:amendDraft.places||undefined},amendDraft),amendDraft);
        amendDraft=null;
        amendName.value='';amendPlace.value='';amendLink.value='';
        amendStatus.textContent=result.vaultOnly?'Encrypted vault updated; the code stays '+from+'.'
          :'Encrypted vault filed; re-key '+from+' to '+to+' is queued for Desk review.';
        loadMaker();
      }catch(error){amendPass.value='';amendStatus.textContent=error.message;}
      amendBusy=false;
    },true);
    var placement=makerForm('customers');placement.appendChild(el('h3',null,'Map placement'));
    placement.appendChild(el('p','msg','Keep the filed point, or choose a locality and paste a new map link. Exact points and addresses stay encrypted; the queue receives only the rounded point and code.'));
    parent.appendChild(placement);
    var placeParty=addSelect(placement,['Party with a filed point','record.place.party'],partyItems),
      placePass=makerField(placement,['Vault passphrase','record.place.passphrase'],'password',''), placeStatus=makerStatus(placement), placeBusy=false;
    var placeLocality=makerLocalityField(placement,'record.place.locality'), placeLink=makerField(placement,['New Maps / Waze link (device only)','record.place.link'],'text','');
    var placeDraft=null;
    placement.addEventListener('input',function(event){if(event.target!==placePass)placeDraft=null;});
    placement.addEventListener('change',function(event){if(event.target!==placePass)placeDraft=null;});
    makerButton(placement,['Queue map placement','record.place.send'],async function(send){
      if(placeBusy)return;placeBusy=true;placeStatus.textContent='Opening the encrypted places vault on this device…';
      try{
        var pass=placePass.value;if(!pass) throw new Error('Enter the vault passphrase on this device.');
        var filed=await makerFiledLink(placeLink.value), coords, envelope;
        placeDraft=await makerPairPrepare(pass,function(maps){if(filed)maps.places[placeParty.value]=filed;},placeDraft);
        var places=placeDraft.placeMap;
        if(filed){
          coords=await makerLocalityPoint(placeLocality.value.trim());
          envelope=placeDraft.places;
        }else if(placeLocality.value.trim())coords=await makerLocalityPoint(placeLocality.value.trim());
        else{
          var point=places[placeParty.value];
          if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))
            throw new Error('That party has no point in the encrypted places vault. Choose a locality first.');
          coords=[Math.round(point.lat*100)/100,Math.round(point.lng*100)/100];
        }
        delete placeDraft.placeMap;
        placePass.value='';pass='';
        var body={at:new Date().toISOString(),places:{[placeParty.value]:coords}};
        if(envelope)body.addrVault=envelope;
        makerPairBody(body,placeDraft);
        await send('/all/maker/inputs/place',body,placeDraft);
        placeDraft=null;
        placeLocality.value='';placeLink.value='';
        placeStatus.textContent='Approximate point queued for Desk review. The address remains encrypted.';
        loadMaker();
      }catch(error){placePass.value='';placeStatus.textContent=error.message;}
      placeBusy=false;
    },true);
  }
  function makerCard(parent,key){
    var card=el('article','salt-glass-card maker-card');
    if(key) card.setAttribute('data-maker-card',key);
    parent.appendChild(card); return card;
  }
  /* 11 Oct 2026: a card's answer lands in its own foot, beside its buttons, and #makerReviewStatus keeps the list's own words
     (the read, the count). The card is found by its key when the answer comes, since a redraw replaces it; a card that has gone
     (the order left the open list, the row was decided) hands its answer to the list's line, so it is never lost. A foot below
     the screen (a tall card, a tap near its head) is scrolled to, clear of the bottom bar, so the answer is seen. */
  function makerFoot(card,key){
    var say=el('p','maker-say'); say.setAttribute('role','status'); say.setAttribute('aria-live','polite');
    say.setAttribute('data-maker-say',key); card.appendChild(say); return say;
  }
  /* 12 Oct 2026 (Phase 2a): THE STAGE FOOT. The moves of the card's stage stand together at its foot, the filled one first (Accept, Accept again, Ready,
     Record handover) and the quiet ones beside it (Decline, Cancel order, Offer again, Withdraw the offer), and the card's answer line under them.
     Cash held for the order shuts every control of the card (makerCashControls), the foot's too. The class has marks a foot with moves, or one whose
     Accept is still being read, which stands along the card's foot as it scrolls. */
  function makerCardFoot(card,acts,key,cashed,pending){
    var foot=el('div','maker-foot'); foot.appendChild(acts); card.appendChild(foot); makerFoot(foot,key);
    if(acts.children.length||pending) foot.classList.add('has');
    if(cashed&&(makerCashHeld[key]||makerCashStorageError)) [].forEach.call(acts.querySelectorAll('button,input,select'),function(n){ n.disabled=true; });
  }
  /* the last answer a card was given, kept by its key: Needs you reads a Desk row's, which its own card is gone to hear */
  var makerSaid={};
  function makerSay(key,text){
    makerSaid[key]=text;
    var line=null, list=document.getElementById(String(key).indexOf('draft:')===0?'makerDraftStatus':'makerReviewStatus');
    [].forEach.call(document.querySelectorAll('#makerReview [data-maker-say], #makerDrafts [data-maker-say]'),function(node){ if(node.getAttribute('data-maker-say')===key) line=node; });
    if(line){ line.textContent=text; if(line.scrollIntoView) line.scrollIntoView({block:'nearest'}); }
    else if(list) list.textContent=text;
  }
  function makerAction(path, body, message, key){
    if(makerBusy) return Promise.resolve();
    makerBusy=true;
    return refs(path,body).then(function(result){
      makerBusy=false;
      return loadMaker().then(function(){
        makerSay(key,result.differs?'The row differs from the preview and waits for review.'
          :result.waiting?'The row is being drafted; acknowledgement is still waiting.'
          :result.preapproval&&result.preapproval.says?result.preapproval.says:message||'Saved.');
        return true;
      });
    },function(error){
      makerBusy=false;
      makerSay(key,error.message);
      return false;
    });
  }
  /* one request id per move until it lands, so a retry after a lost answer is the same request */
  var makerRids={};
  function makerMove(order,body,message){
    var key=order.id+JSON.stringify(body), rid=makerRids[key]||(makerRids[key]=mintRid());
    return makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/'+(body.claim?'notfound':'move'),
      Object.assign({rid:rid},body),message,order.id).then(function(done){ if(done) delete makerRids[key]; });
  }
  /* a handover, a close, cash, a Received or a move offered again, under one request id until it lands, as a move is */
  function makerTap(order,action,body,message){
    var key=order.id+action+JSON.stringify(body), rid=makerRids[key]||(makerRids[key]=mintRid());
    return makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/'+action,
      Object.assign({rid:rid},body),message,order.id).then(function(done){ if(done) delete makerRids[key]; });
  }
  var MAKER_CASH_MS=10000, makerCashHeld={}, makerCashSaid={};
  var MAKER_CASH_PREFIX='saltMakerCash:', makerCashStorageError='';
  function makerCashSave(id,held){
    var key=MAKER_CASH_PREFIX+id, old=localStorage.getItem(key);
    if(old&&JSON.parse(old).body!==held.body)throw new Error('Another cash request is retained for this order. Reload to recover it; nothing new was sent.');
    localStorage.setItem(key,JSON.stringify({v:1,id:id,body:held.body,beforePaid:held.beforePaid,confirmed:!!held.confirmed}));
  }
  function makerCashRestore(){
    try{
      Object.keys(localStorage).filter(function(key){return key.indexOf(MAKER_CASH_PREFIX)===0;}).forEach(function(key){
        var saved=JSON.parse(localStorage.getItem(key)), body=JSON.parse(saved.body), id=key.slice(MAKER_CASH_PREFIX.length);
        if(saved.v!==1||saved.id!==id||typeof saved.confirmed!=='boolean'||!Number.isFinite(saved.beforePaid)||saved.beforePaid<0
          ||!(/^[0-9a-f]{32}$/).test(body.rid)||!Number.isFinite(body.amount)||body.amount<=0.004
          ||Object.keys(body).sort().join(',')!=='amount,rid')throw new Error('Retained cash is unreadable. No new cash can be sent until it is recovered.');
        if(!makerCashHeld[id]){
          makerCashHeld[id]={amount:body.amount,body:saved.body,beforePaid:saved.beforePaid,confirmed:saved.confirmed,sent:true,busy:false};
          makerCashSaid[id]=saved.confirmed?'Recorded, refresh pending.':'Confirmation not received. Retry the same cash amount.';
        }
      });
      makerCashStorageError='';
    }catch(error){makerCashStorageError=error.message;}
  }
  function makerCashReconcile(data){
    Object.keys(makerCashHeld).forEach(function(id){
      var held=makerCashHeld[id], order=(data.orders||[]).filter(function(o){return o.id===id;})[0];
      if(held.confirmed&&order&&Number(order.paid||0)+0.004>=held.beforePaid+held.amount){
        localStorage.removeItem(MAKER_CASH_PREFIX+id);delete makerCashHeld[id];
        makerCashSaid[id]='Recorded: '+rm(held.amount)+' in cash. '+rm(Math.max(0,Number(order.total||0)+Number(order.delivery||0)-Number(order.paid||0)))+' still owed.';
      }
    });
  }
  function makerCashLeft(id){
    var held=makerCashHeld[id];
    return held?Math.max(0,Math.ceil((held.until-Date.now())/1000)):0;
  }
  function makerCashHold(order,amount){
    makerCashRestore();
    if(makerCashStorageError){drawMaker();return;}
    if(makerCashHeld[order.id]) return;
    var due=Number(order.total||0)+Number(order.delivery||0)-Number(order.paid||0);
    if(!Number.isFinite(amount)||amount<=0.004||amount>due+0.004){
      makerCashSaid[order.id]='That is not a figure above RM 0 and up to the '+rm(due)+' owed. Nothing was sent.';drawMaker();return;
    }
    var held={amount:amount,beforePaid:Number(order.paid||0),until:Date.now()+MAKER_CASH_MS,sent:false,busy:false};
    makerCashHeld[order.id]=held;delete makerCashSaid[order.id];
    held.timer=setTimeout(function(){ makerCashGo(order.id); },MAKER_CASH_MS);
    held.tick=setInterval(function(){
      var node=document.querySelector('[data-maker-cash-left="'+order.id+'"]');
      if(node)node.textContent=String(makerCashLeft(order.id));
    },1000);
    drawMaker();
  }
  function makerCashUndo(id){
    var held=makerCashHeld[id];if(!held||held.sent)return;
    clearTimeout(held.timer);clearInterval(held.tick);delete makerCashHeld[id];
    makerCashSaid[id]='Undone: nothing was sent, and the order is as it was.';drawMaker();
  }
  async function makerCashGo(id){
    var held=makerCashHeld[id];if(!held||held.busy||held.confirmed)return;
    held.busy=true;held.sent=true;
    clearTimeout(held.timer);clearInterval(held.tick);
    /* After transport starts, every retry carries these exact bytes, never the edited field. */
    if(!held.body)held.body=JSON.stringify({rid:mintRid(),amount:held.amount});
    makerCashSaid[id]='Sending.';drawMaker();
    try{
      makerCashSave(id,held);
      var response=await fetch('/all/maker/orders/'+encodeURIComponent(id)+'/cash',{
        method:'POST',headers:{'content-type':'application/json'},body:held.body,redirect:'manual',keepalive:true
      });
      if(response.type==='opaqueredirect'||response.status===401){ended();throw new Error(ENDED);}
      var result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.error||'Cash confirmation was refused.');
      held.confirmed=true;
      makerCashSaid[id]='Recorded, refresh pending.';
      makerCashSave(id,held);
      await loadMaker();
    }catch(error){
      makerCashSaid[id]=(held.confirmed?'Recorded, refresh pending. ':'Confirmation not received. Retry the same cash amount: ')+error.message;
    }finally{held.busy=false;drawMaker();}
  }
  function makerCashFlush(){
    return Promise.all(Object.keys(makerCashHeld).filter(function(id){return !makerCashHeld[id].sent;}).map(makerCashGo));
  }
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')makerCashFlush();});
  window.addEventListener('pagehide',function(){makerCashFlush();});
  function makerCashControls(card,order){
    var held=makerCashHeld[order.id], note=el('p','salt-insight');
    note.setAttribute('role','status');note.setAttribute('data-maker-cash-status',order.id);
    if(held){
      card.querySelectorAll('button,input,select').forEach(function(node){node.disabled=true;});
      if(!held.sent){
        note.appendChild(document.createTextNode('Cash received, '+rm(held.amount)+': it goes in '));
        var left=el('span',null,String(makerCashLeft(order.id)));left.setAttribute('data-maker-cash-left',order.id);
        note.appendChild(left);note.appendChild(document.createTextNode(' s. Undo sends nothing.'));
        makerClaimButton(card,['Undo','order.cash-undo'],function(){makerCashUndo(order.id);},true).setAttribute('data-maker-cash-undo','');
      }else{
        note.textContent=makerCashSaid[order.id]||'Sending.';
        var retry=makerClaimButton(card,[held.confirmed?'Refresh cash':'Retry cash','order.cash-retry'],function(){
          return held.confirmed?loadMaker():makerCashGo(order.id);
        },true);
        retry.disabled=held.busy;retry.setAttribute('data-maker-cash-retry','');
      }
    }else if(makerCashStorageError){
      card.querySelectorAll('button,input,select').forEach(function(node){node.disabled=true;});
      note.textContent=makerCashStorageError;
    }else{
      var cash=makerField(card,['Cash received (RM)','order.cash-amount'],'number','');
      makerButton(card,['Record cash','order.cash'],function(){makerCashHold(order,Number(cash.value));},false);
      note.textContent=makerCashSaid[order.id]||'';
    }
    card.appendChild(note);
  }
  /* a stage he rejected under Approve, offered again by the Desk's own againOrder */
  var MAKER_AGAIN={pay:'payment',cash:'cash',move:'handover',cancel:'cancellation',amend:'amendment'};
  function makerAgain(card,order,acts){
    (order.again||[]).filter(function(stage){ return MAKER_AGAIN[stage]; }).forEach(function(stage){
      var offer=makerButton(acts,['Offer the '+MAKER_AGAIN[stage]+' again','order.again-'+stage],function(){
        makerAsk(order,offer,'again-'+stage,{title:'Offer the '+MAKER_AGAIN[stage]+' again?', plain:true, go:'Offer it again', keep:'Not now',
          say:['The '+MAKER_AGAIN[stage]+' you rejected goes back to the Desk as it was, to be approved again.'],
          yes:function(){ makerTap(order,'again',{stage:stage},'The '+MAKER_AGAIN[stage]+' is offered again to the Desk.'); }});
      },false);
      offer.setAttribute('data-again',stage); makerAskTag(order,offer,'again-'+stage);
    });
  }
  /* a pending row he rejected on an agreed order is offered again by Accept against a fresh preview, at the charge and
     goods the order already carries (the customer was told them), as the Desk's own Accept again: nothing priced is sent */
  function makerAgainAck(order){ return ['acknowledged','ready','done'].indexOf(order.status)>=0&&(order.again||[]).indexOf('ack')>=0; }
  function makerAcceptAgain(card,order,acts){
    var route='/all/maker/orders/'+encodeURIComponent(order.id), key=order.id+':again', sig=JSON.stringify(order), turn=0;
    var said=el('p','salt-insight'), figs=el('div','maker-quote');
    said.setAttribute('role','status'); card.appendChild(said); card.appendChild(figs);
    /* 12 Oct 2026 (his decision 6 of 11 Oct): its figures read themselves when the order is opened, as a placed order's do, and Preview Accept again is retired */
    function againShow(result){
      said.className='salt-insight'; said.textContent='Figures read. Check the row before accepting it again.';
      figs.textContent=''; makerReading(figs,result,'preview');
      var old=card.querySelector('[data-accept-again]'); if(old) old.remove();
      var again=makerButton(acts,['Accept again','order.accept-again'],function(){
        makerAction(route+'/accept',{hash:result.hash},'Order sent to the Desk for acknowledgement again.',order.id);
      },true);
      again.setAttribute('data-accept-again',''); acts.insertBefore(again,acts.firstChild);
    }
    function againRead(){
      var mine=++turn, old=card.querySelector('[data-accept-again]'); if(old) old.remove();
      said.className='salt-insight'; said.textContent='Reading the figures.'; figs.textContent='';
      var pv=makerPv[key]; if(!pv) pv=makerPv[key]={p:refs(route+'/preview',{})};
      pv.p.then(function(result){
        if(makerPv[key]===pv) delete makerPv[key];
        if(mine!==turn||!card.isConnected) return;
        makerQuotes[key]={sig:sig,result:result}; againShow(result);
      }).catch(function(error){
        if(makerPv[key]===pv) delete makerPv[key];
        if(mine!==turn||!card.isConnected) return;
        said.className='msg'; said.textContent=error.message;
        makerButton(figs,['Read the figures again','order.reread'],againRead,false);
      });
    }
    return function(){ var held=makerQuotes[key]; if(held&&held.sig===sig) againShow(held.result); else againRead(); };
  }
  /* his quick replies, six at most, kept on this device under the Desk's own key; each is checked when it is sent */
  var MAKER_QUICK='saltQuickReplies';
  function makerQuick(){ try{ var a=JSON.parse(localStorage.getItem(MAKER_QUICK)||'[]'); return Array.isArray(a)?a.filter(function(x){ return typeof x==='string'&&x; }).slice(0,6):[]; }catch(e){ return []; } }
  function makerQuickKeep(text){
    var t=String(text||'').trim().replace(/[ ]+/g,' ').slice(0,200), cur=makerQuick();
    if(!t) return 'Type the line first, then keep it.';
    try{
      if(cur.indexOf(t)>=0){ localStorage.setItem(MAKER_QUICK,JSON.stringify(cur.filter(function(x){ return x!==t; }))); return 'Forgotten: it is no longer a quick reply.'; }
      localStorage.setItem(MAKER_QUICK,JSON.stringify([t].concat(cur).slice(0,6))); return 'Kept as a quick reply on this device.';
    }catch(e){ return 'This browser would not keep it.'; }
  }
  /* the Desk's reasons for Decline and Cancel; delivery only on an order to be delivered */
  var MAKER_WHY=[['stock','We do not have enough in hand this week.'],['place','We cannot deliver there.'],['price','Our prices have changed.']];
  /* 12 Oct 2026 (Phase 2a, his decision 4 of 11 Oct): A YES OR NO ON THE ORDER CARD IS THE PAGE'S SHEET, never a native confirm. makerAsk opens
     ynOpen, the Sheet the customer's Cancel and Withdraw use, over the page: it restates the order by its mark, its code, its size and its figure,
     says what follows, and has one action that sends what the old confirm let through, with the ghost, the close control, the scrim and Escape
     sending nothing and focus going back to the control that asked (found again by its data-yn if a redraw replaced it). The request, its body
     and its request id are the caller's, untouched. q: title, say (lines), extra (nodes), go, keep, plain (not a danger action), yes. */
  function makerAskRow(order){
    var L=el('div','salt-ledger salt-ledger--plain'), r=el('div','salt-ledger__row'), l=el('div','salt-ledger__line'), lab=el('span','salt-ledger__label mlab');
    lab.appendChild(mtile(order.product,order.qty)); lab.appendChild(el('span',null,codeByUser(order.u)));
    l.appendChild(lab); l.appendChild(el('span','salt-ledger__value',rm(Number(order.total||0)+Number(order.delivery||0)))); r.appendChild(l);
    r.appendChild(el('span','salt-ledger__flag',unitsOf(order.qty)+', '+String((ORD_STAGE[order.status]||['',order.status])[1]).toLowerCase()));
    L.appendChild(r); return L;
  }
  /* the control that asks carries its data-yn from the moment it is drawn, so a card redrawn while its sheet is open still has the control to give focus back to */
  function makerAskKey(order,kind){ return 'order:'+order.id+':'+kind; }
  function makerAskTag(order,btn,kind){ btn.setAttribute('data-yn',makerAskKey(order,kind)); return btn; }
  function makerAsk(order,opener,kind,q){
    ynOpen({title:q.title, opener:opener, again:ynFind(makerAskKey(order,kind)), go:q.go, keep:q.keep, yes:q.yes,
      body:[makerAskRow(order)].concat(q.say.map(function(s){ return el('p',null,s); })).concat(q.extra||[])});
    var go=document.getElementById('ynGo');
    actOn(go,'order.ask-go',order.id); actOn(document.getElementById('ynKeep'),'order.ask-keep',order.id); actOn(document.getElementById('ynX'),'order.ask-close',order.id);
    if(q.plain) go.classList.remove('salt-ghost--danger');
  }
  /* the reason a Decline or a Cancel gives the customer, optional: the Desk's lines as the system's Option tiles (the place line only on an order to be
     delivered) and a field for his own words; a tile fills the field, typing clears the pick. note() is what rides with the request. */
  function makerWhy(order){
    var set=el('fieldset','salt-options'), grid=el('div','salt-options__grid'), wrap=el('label','salt-field'), field=el('input','salt-field__input');
    set.appendChild(el('legend','salt-options__legend','Reason to give the customer, if any'));
    MAKER_WHY.filter(function(w){ return w[0]!=='place'||order.mode==='deliver'; }).forEach(function(w){
      var label=el('label','salt-option'), radio=el('input','salt-option__input'), face=el('span','salt-option__face');
      radio.type='radio'; radio.name='makerWhy-'+order.id; radio.value=w[0]; actOn(radio,'order.reason-'+w[0],order.id);
      radio.addEventListener('change',function(){ field.value=w[1]; });
      face.appendChild(el('span','salt-option__label',w[1])); label.appendChild(radio); label.appendChild(face); grid.appendChild(label);
    });
    set.appendChild(grid);
    field.type='text'; actOn(field,'order.reason',order.id);
    field.addEventListener('input',function(){ [].forEach.call(grid.querySelectorAll('input'),function(r){ r.checked=false; }); });
    wrap.appendChild(el('span','salt-field__label','Or in your own words')); wrap.appendChild(field);
    return {nodes:[set,wrap], note:function(){ var v=field.value.trim(); return v?{note:v}:{}; }};
  }
  /* replyOnly is a closed order: only his answer to their question, and no Decline, Cancel or reason */
  function makerOrderMoves(card,order,replyOnly,acts){
    var said=makerField(card,['Reply to the customer','order.reply-text'],'text','');
    makerQuick().forEach(function(line,i){
      makerButton(card,[line,'order.quick-reply',i],function(){ said.value=line; keepWord(); },false).setAttribute('data-quick','');
    });
    var keep=makerButton(card,['Keep as a quick reply','order.quick-keep'],function(){
      makerSay(order.id,makerQuickKeep(said.value));
      keepWord();
    },false);
    keep.setAttribute('data-keep','');
    function keepWord(){ var t=said.value.trim().replace(/[ ]+/g,' '); keep.textContent=t&&makerQuick().indexOf(t)>=0?'Forget this quick reply':'Keep as a quick reply'; }
    said.addEventListener('input',keepWord);
    makerButton(card,['Send reply','order.reply'],function(){
      if(!said.value.trim()) return;
      makerMove(order,{message:said.value.trim()},'Reply sent.');
    },false);
    makerButton(card,['No reply needed','order.no-reply'],function(){ makerMove(order,{noReply:true},'No reply needed recorded.'); },false);
    /* his decision 4 of 11 Oct 2026: a Decline or a Cancel asks on the page's Sheet, and the reason is asked there, on tiles */
    if(order.status==='placed'){
      var dec=makerButton(acts,['Decline','order.decline'],function(){
        var why=makerWhy(order);
        makerAsk(order,dec,'decline',{title:'Decline this order?', go:'Decline order', keep:'Keep the order', extra:why.nodes,
          say:['It is declined and goes no further. The customer is told, with your reason if you give one.'],
          yes:function(){ makerMove(order,Object.assign({status:'declined'},why.note()),'Order declined.'); }});
      },false);
      makerAskTag(order,dec,'decline');
    }else if((order.status==='acknowledged'||order.status==='ready')&&!order.closed&&!(+order.claimed>0)&&!(+order.moved>0)){
      var can=makerButton(acts,['Cancel order','order.cancel'],function(){
        var why=makerWhy(order);
        makerAsk(order,can,'cancel',{title:'Cancel this order?', go:'Cancel order', keep:'Keep the order', extra:why.nodes,
          say:[+order.paid>0?'RM '+(+order.paid).toFixed(2)+' is paid on it, so a refund to the customer opens for you to return.':'Nothing is paid on it.'],
          yes:function(){ makerMove(order,Object.assign({status:'cancelled'},why.note()),'Order cancelled.'); }});
      },false);
      makerAskTag(order,can,'cancel');
    }
  }
  /* PHASE 1c (11 Oct 2026): RECORD'S FORMS ARE A MENU. Entry, Customers and Pricing each list their forms by name, a row of the system's
     Inbox row for each, and a row opens that form alone with a way back. The forms are the sections they were, moved and never drawn
     again: what is typed in one, its retained send and its request ids are kept by closing it, as by opening another. A retained input
     stays on the menu, above the rows. */
  function formSlug(name){ return String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function recordMenu(box,note){
    fOpen=null;
    var back=el('button','aback','← Entry'); back.type='button'; back.id='makerFormBack'; back.setAttribute('data-back','form'); back.setAttribute('data-formback','');
    back.setAttribute('data-in','record.entry record.customers record.pricing'); actOn(back,'record.form-back');
    box.insertBefore(back,note.nextSibling);
    var menu=el('div','formmenu'), lists={}, anchor=back;
    menu.id='makerMenu'; menu.setAttribute('data-formmenu','');
    ['entry','customers','pricing'].forEach(function(part){
      var list=el('div','formlist'); list.setAttribute('data-in','record.'+part); lists[part]=list; menu.appendChild(list);
    });
    [].slice.call(box.children).forEach(function(n){ if(n.hasAttribute('data-formmenu')) anchor=n; });
    box.insertBefore(menu,anchor.nextSibling);
    [].slice.call(box.querySelectorAll('section.maker-input')).forEach(function(form){
      if(form.hasAttribute('data-formmenu')) return;
      var name=form.querySelector('h3').textContent, slug=formSlug(name), part=form.getAttribute('data-in').replace('record.','');
      form.setAttribute('data-form',slug);
      var row=el('button','salt-inbox-row formrow'), main=el('span','salt-inbox-row__main'), title=el('span','salt-inbox-row__title'), side=el('span','salt-inbox-row__side');
      row.type='button'; actOn(row,'record.form',slug);
      title.appendChild(el('span',null,name)); main.appendChild(title); side.appendChild(el('span','salt-inbox-row__action','Open'));
      row.appendChild(main); row.appendChild(side);
      row.addEventListener('click', function(){ openForm(slug); });
      lists[part].appendChild(row);
    });
  }
  function openForm(slug){
    if(!document.querySelector('#makerInputs [data-form="'+slug+'"]')) return;
    fOpen=slug; sweep();
    try{
      var back=document.getElementById('makerFormBack'), tab=document.querySelector('.aparts[data-place="record"] [data-part="'+partNow+'"]');
      back.textContent='← '+(tab?tab.textContent:'Back'); back.focus(); window.scrollTo(0,0);
    }catch(x){}
  }
  function closeForm(){
    var was=fOpen; fOpen=null; sweep();
    try{ var row=was&&document.querySelector('#makerMenu [data-act="record.form"][data-key="'+was+'"]'); if(row&&row.focus) row.focus(); }catch(x){}
  }
  async function loadMakerInputs(){
    var box=document.getElementById('makerInputs'); if(!box||box.childElementCount>1) return;
    var note=el('p','msg','Reading available books…'); note.setAttribute('role','status'); box.appendChild(note);
    try{
      var context=await refs('/all/maker/inputs');
      makerRecovery(box);
      if(!Array.isArray(context.products)||!context.products.length) throw new Error('No active book is available.');
      note.textContent='Inputs are checked by the Desk and wait for review before they change the book.';
      var countFrom=box.children.length;
      var label=el('label','maker-field','Book'), product=actOn(el('select','fld salt-field__input'),'record.count.book');
      context.products.forEach(function(code){ var option=el('option',null,pshape(code)); option.value=code; product.appendChild(option); });
      label.appendChild(product); box.appendChild(label);
      var date=makerField(box,['Counted on','record.count.date'],'date',''), qty=makerField(box,['Stock count: units','record.count.units'],'number','', '0.01');
      var pending=false, at=null, signature='', answer=el('p','msg'); answer.setAttribute('role','status'); box.appendChild(answer);
      var button=makerButton(box,['Record count','record.count.send'],async function(send){
        if(pending) return;
        var body={product:product.value,date:date.value,qty:qty.value===''?null:Number(qty.value)};
        var now=JSON.stringify(body); if(now!==signature){ signature=now; at=new Date().toISOString(); }
        body.at=at; pending=true; button.disabled=true; answer.textContent='Recording…';
        try{ await send('/all/maker/inputs/stock-count',body); answer.textContent='Recorded. Review its row under Order review.'; loadMaker(); }
        catch(error){ answer.textContent=error.message; }
        pending=false; button.disabled=false;
      },true,function(){ at=null; signature=''; });
      /* the count's controls, moved into a form of their own so that Entry's menu can name it (Phase 1c) */
      var countForm=makerForm('entry'); countForm.appendChild(el('h3',null,'Stock count'));
      [].slice.call(box.children,countFrom).forEach(function(n){ countForm.appendChild(n); });
      box.appendChild(countForm);
      var catalog=context.catalog||{}, tradeSection=makerForm('entry');
      tradeSection.appendChild(el('h3',null,'Sale or purchase'));
      tradeSection.appendChild(el('p','msg','Goods and carriage stay separate. Notes are disabled here: this route cannot safely prove arbitrary prose contains no names or places.'));
      box.appendChild(tradeSection);
      var direction=actOn(el('select','fld salt-field__input'),'record.trade.direction');
      [['sale','Sale'],['purchase','Purchase']].forEach(function(item){
        var option=el('option',null,item[1]); option.value=item[0]; direction.appendChild(option);
      });
      var directionLabel=el('label','maker-field','Entry');
      directionLabel.appendChild(direction); tradeSection.appendChild(directionLabel);
      var tradeProduct=actOn(el('select','fld salt-field__input'),'record.trade.book'), tradeParty=actOn(el('select','fld salt-field__input'),'record.trade.party');
      var productLabel=el('label','maker-field','Book'), partyLabel=el('label','maker-field','Party');
      productLabel.appendChild(tradeProduct); partyLabel.appendChild(tradeParty);
      tradeSection.appendChild(productLabel); tradeSection.appendChild(partyLabel);
      var tradeDate=makerField(tradeSection,['Date','record.trade.date'],'date',''), tradeQty=makerField(tradeSection,['Units','record.trade.units'],'number','1','0.01');
      var tradeTotal=makerField(tradeSection,['Goods total (RM)','record.trade.total'],'number','','0.01');
      var tradeCash=makerField(tradeSection,['Cash recorded (RM)','record.trade.cash'],'number','0','0.01');
      var tradeMoved=makerField(tradeSection,['Units moved','record.trade.moved'],'number','0','0.01');
      var handover=actOn(el('select','fld salt-field__input'),'record.trade.handover');
      [['','Not stated'],['collected','Collected'],['delivered','Delivered']].forEach(function(item){
        var option=el('option',null,item[1]); option.value=item[0]; handover.appendChild(option);
      });
      var handoverLabel=el('label','maker-field','Handover'); handoverLabel.appendChild(handover); tradeSection.appendChild(handoverLabel);
      var carriage=makerField(tradeSection,['Delivery (RM)','record.trade.delivery'],'number','0','0.01');
      var attribution=el('div','maker-trade-attribution'), tradeStream=actOn(el('select','fld salt-field__input'),'record.trade.stream');
      [['','No associate'],['R2','R2 resell'],['R3','R3 refer']].forEach(function(item){
        var option=el('option',null,item[1]); option.value=item[0]; tradeStream.appendChild(option);
      });
      var streamLabel=el('label','maker-field','Stream'); streamLabel.appendChild(tradeStream); attribution.appendChild(streamLabel);
      var tradeAssoc=actOn(el('select','fld salt-field__input'),'record.trade.associate'), tradeDown=actOn(el('select','fld salt-field__input'),'record.trade.end-customer');
      var assocLabel=el('label','maker-field','Associate'), downLabel=el('label','maker-field','End customer');
      assocLabel.appendChild(tradeAssoc); downLabel.appendChild(tradeDown);
      attribution.appendChild(assocLabel); attribution.appendChild(downLabel);
      var attributionNote=el('p','msg'); attribution.appendChild(attributionNote); tradeSection.appendChild(attribution);
      function fillAttribution(){
        var isSale=direction.value==='sale', stream=isSale?tradeStream.value:'', r2=stream==='R2', kept=tradeAssoc.value;
        attribution.hidden=!isSale; assocLabel.hidden=!stream; downLabel.hidden=!r2;
        partyLabel.hidden=r2;
        partyLabel.firstChild.textContent=stream==='R3'?'Buyer (referred)':'Party';
        tradeAssoc.textContent='';
        var none=el('option',null,'Choose an associate'); none.value=''; tradeAssoc.appendChild(none);
        (catalog.associates||[]).filter(function(item){return !r2||item.resaleReady;}).forEach(function(item){
          var option=el('option',null,item.code); option.value=item.code; tradeAssoc.appendChild(option);
        });
        if(Array.from(tradeAssoc.options).some(function(option){return option.value===kept;}))tradeAssoc.value=kept;
        attributionNote.textContent=r2
          ?'R2: every book goes to the associate’s -R resale account, whether or not the end customer is named.'
          :stream==='R3'?'R3: every book goes to the buyer; only the first row credits the introduction to the associate.':'';
      }
      var unnamed=el('option',null,'Not named'); unnamed.value=''; tradeDown.appendChild(unnamed);
      (catalog.parties||[]).filter(function(code){return !/[-]R$/.test(code);}).forEach(function(code){
        var option=el('option',null,code); option.value=code; tradeDown.appendChild(option);
      });
      tradeStream.addEventListener('change',fillAttribution);
      var coverChoices=[];
      function coverChoice(root,bookControl,unitsControl,goodsControl,acts){
        /* 11 Oct 2026: a read never collapses a box it has shown (a tap on Send after typing blurs the field, the change
           re-reads, and a box that hid moved Send up before the finger lifted: no click). Only an answer of no cover hides it;
           a failed read keeps it, dead, with its note and a Read cover again beside it. */
        var row=el('div','maker-cover-row'), wrap=el('label','maker-cover'), check=actOn(el('input'),acts[0]), words=el('span'),
          retry=actOn(el('button','salt-ghost','Read cover again'),acts[1]), note=el('p','msg'), revision=0;
        check.type='checkbox';check.setAttribute('data-reward-cover','');check.disabled=true;retry.type='button';retry.hidden=true;
        wrap.hidden=true;wrap.appendChild(check);wrap.appendChild(words);row.appendChild(wrap);row.appendChild(retry);
        root.appendChild(row);root.appendChild(note);
        async function readCoverChoice(){
          var ticket=++revision;check.checked=false;check.disabled=true;retry.hidden=true;note.textContent='';
          if(direction.value!=='sale'||tradeStream.value==='R2'||goodsControl.value===''||!(Number(unitsControl.value)>0)){wrap.hidden=true;return;}
          if(wrap.hidden)note.textContent='Reading reward cover…';else words.textContent='Checking cover…';
          try{
            var result=await refs('/all/maker/trade-cover',{product:bookControl.value,party:tradeParty.value,
              qty:Number(unitsControl.value),total:Number(goodsControl.value),stream:tradeStream.value||null});
            if(ticket!==revision||!root.isConnected)return;
            note.textContent='';
            if(result.cover){
              words.textContent='Cover RM '+result.cover.rm.toFixed(2)+' with '+result.cover.units+' unit reward'
                +' · '+result.cover.free+' unit available · own quote RM '+result.cover.ask.toFixed(2);
              check.disabled=false;wrap.hidden=false;
            }else wrap.hidden=true;
          }catch(error){
            if(ticket===revision){words.textContent='Cover not read';wrap.hidden=false;retry.hidden=false;note.textContent=error.message;}
          }
        }
        retry.addEventListener('click',readCoverChoice);
        var choice={check:check,read:readCoverChoice};coverChoices.push(choice);
        [bookControl,unitsControl,goodsControl,tradeParty,tradeStream,direction].forEach(function(control){
          control.addEventListener('input',readCoverChoice);control.addEventListener('change',readCoverChoice);
        });
        return choice;
      }
      var firstCover=coverChoice(tradeSection,tradeProduct,tradeQty,tradeTotal,['record.trade.cover','record.trade.cover-retry']);
      var extraBooks=el('div','maker-extra-books'), extraTrades=[], extraSeq=0;
      tradeSection.appendChild(extraBooks);
      var tripNote=el('p','msg','Extra books share the party, date and handover. Each has its own goods, cash and units moved. Delivery sits on the first row alone; with a delivery, Approve takes the trip in one tap.');
      tradeSection.appendChild(tripNote);
      function extraChoices(select){
        var kept=select.value; select.textContent='';
        (catalog.products||[]).filter(function(item){
          return item.product!==tradeProduct.value&&(direction.value==='sale'?item.saleReady:item.purchaseReady);
        }).forEach(function(item){
          var option=el('option',null,pshape(item.product)); option.value=item.product; select.appendChild(option);
        });
        if(Array.from(select.options).some(function(option){return option.value===kept;})) select.value=kept;
      }
      makerButton(tradeSection,['Add another book','record.trade.add-book'],function(){
        var row=el('section','maker-extra-trade'); row.setAttribute('data-key','extra'+(++extraSeq)); row.appendChild(el('h4',null,'Extra book'));
        var label=el('label','maker-field','Book'), select=actOn(el('select','fld salt-field__input'),'record.trade.extra-book');
        label.appendChild(select); row.appendChild(label); extraChoices(select);
        var extra={row:row,product:select,qty:makerField(row,['Units','record.trade.extra-units'],'number','1','0.01'),
          total:makerField(row,['Goods total (RM)','record.trade.extra-total'],'number','','0.01'),
          cash:makerField(row,['Cash recorded (RM)','record.trade.extra-cash'],'number','0','0.01'),
          movedUnits:makerField(row,['Units moved','record.trade.extra-moved'],'number','0','0.01')};
        extraTrades.push(extra); extraBooks.appendChild(row);
        extra.cover=coverChoice(row,select,extra.qty,extra.total,['record.trade.extra-cover','record.trade.extra-cover-retry']);
        makerButton(row,['Remove book','record.trade.remove-book'],function(){
          extraTrades.splice(extraTrades.indexOf(extra),1);coverChoices.splice(coverChoices.indexOf(extra.cover),1);row.remove();
        },false);
      },false);
      var tradeAnswer=el('p','msg'); tradeAnswer.setAttribute('role','status'); tradeSection.appendChild(tradeAnswer);
      var tradePending=false, tradeAt=null, tradeSignature='';
      function fillTradeChoices(){
        var isSale=direction.value==='sale';
        var keptProduct=tradeProduct.value, keptParty=tradeParty.value;
        tradeProduct.textContent='';
        (catalog.products||[]).filter(function(item){ return isSale?item.saleReady:item.purchaseReady; }).forEach(function(item){
          var option=el('option',null,pshape(item.product)); option.value=item.product; tradeProduct.appendChild(option);
        });
        if(Array.from(tradeProduct.options).some(function(option){return option.value===keptProduct;}))tradeProduct.value=keptProduct;
        tradeParty.textContent='';
        (catalog.parties||[]).forEach(function(code){
          var option=el('option',null,code); option.value=code; tradeParty.appendChild(option);
        });
        if(Array.from(tradeParty.options).some(function(option){return option.value===keptParty;}))tradeParty.value=keptParty;
        carriage.parentNode.querySelector('.lbl').textContent=isSale?'Delivery (RM)':'Freight (RM)';
        extraTrades.forEach(function(extra){extraChoices(extra.product);});
        fillAttribution();
        coverChoices.forEach(function(choice){choice.read();});
      }
      async function refreshMakerTradeCatalog(){
        var refreshed=await refs('/all/maker/inputs');
        if(!refreshed.catalog||!Array.isArray(refreshed.catalog.parties))
          throw new Error('The Desk returned no confirmed-party catalog.');
        catalog=refreshed.catalog;
        fillTradeChoices();
      }
      direction.addEventListener('change',fillTradeChoices);
      tradeProduct.addEventListener('change',function(){
        extraTrades.forEach(function(extra){extraChoices(extra.product);});
        coverChoices.forEach(function(choice){choice.read();});
      });
      fillTradeChoices();
      async function submitTrade(confirmedTwin,send){
        if(tradePending) return;
        var isSale=direction.value==='sale';
        var body={product:tradeProduct.value,party:tradeParty.value,date:tradeDate.value,
          qty:tradeQty.value===''?null:Number(tradeQty.value),total:tradeTotal.value===''?null:Number(tradeTotal.value),
          cash:tradeCash.value===''?null:Number(tradeCash.value),movedUnits:tradeMoved.value===''?null:Number(tradeMoved.value),
          handover:handover.value||null};
        body[isSale?'delivery':'freight']=carriage.value===''?null:Number(carriage.value);
        if(isSale&&firstCover.check.checked)body.cover=true;
        if(isSale&&tradeStream.value){
          if(!tradeAssoc.value){tradeAnswer.textContent='Choose an associate first.';return;}
          body.assoc=tradeAssoc.value; body.stream=tradeStream.value;
          if(body.stream==='R2'){body.party=body.assoc;body.downstream=tradeDown.value||null;}
        }
        if(extraTrades.length) body.extras=extraTrades.map(function(extra){
          var input={product:extra.product.value,qty:extra.qty.value===''?null:Number(extra.qty.value),
            total:extra.total.value===''?null:Number(extra.total.value),cash:extra.cash.value===''?null:Number(extra.cash.value),
            movedUnits:extra.movedUnits.value===''?null:Number(extra.movedUnits.value)};
          if(isSale&&extra.cover.check.checked)input.cover=true;
          return input;
        });
        if(confirmedTwin) Object.keys(confirmedTwin).forEach(function(index){
          if(Number(index)===0)body.second=confirmedTwin[index];
          else if(body.extras&&body.extras[Number(index)-1])body.extras[Number(index)-1].second=confirmedTwin[index];
        });
        var check=JSON.stringify(body);
        if(check!==tradeSignature){ tradeSignature=check; tradeAt=new Date().toISOString(); }
        body.at=tradeAt;
        tradePending=true; tradeAnswer.textContent='Sending to the Desk…';
        try{
          var result=await send('/all/maker/inputs/'+direction.value,body);
          tradeAnswer.textContent=result.status==='pending'
            ?'Sent for review. It changes nothing until approved and folded.'
            :'Recorded for review.';
          loadMaker();
        }catch(error){
          tradeAnswer.textContent=error.message;
          var twin=error.detail&&error.detail.twin&&error.detail.twin.second;
          var index=error.detail&&error.detail.twin&&error.detail.twin.index||0;
          if(twin&&!(confirmedTwin&&confirmedTwin[index])&&window.confirm('A matching row is already booked. Record this as a separate order?')){
            var confirmations=Object.assign({},confirmedTwin||{}); confirmations[index]=twin;
            tradeSignature=''; tradePending=false; await submitTrade(confirmations,send); return;
          }
        }
        tradePending=false;
      }
      makerButton(tradeSection,['Send trade for review','record.trade.send'],function(send){ return submitTrade(null,send); },true,function(){
        tradeAt=null;tradeSignature='';coverChoices.forEach(function(choice){choice.read();});
      });
      var tierSection=makerForm('pricing');
      tierSection.appendChild(el('h3',null,'Customer tier'));
      tierSection.appendChild(el('p','msg','Tiered books only. Set a held level or clear it; proposals do not move held tiers.'));
      tradeSection.parentNode.insertBefore(tierSection,tradeSection.nextSibling);
      var tierCodes=catalog.tierCustomers||[], tierBooks=(catalog.products||[]).filter(function(item){ return item.tiered; });
      if(!tierCodes.length||!tierBooks.length||!(catalog.tierNames||[]).length){
        tierSection.appendChild(el('p','msg','No tiered customer input is available.'));
      }else{
        var tierCode=actOn(el('select','fld salt-field__input'),'record.tier.customer'), tierProduct=actOn(el('select','fld salt-field__input'),'record.tier.book'), tierValue=actOn(el('select','fld salt-field__input'),'record.tier.level');
        tierCodes.forEach(function(code){ var option=el('option',null,code); option.value=code; tierCode.appendChild(option); });
        tierBooks.forEach(function(item){ var option=el('option',null,pshape(item.product)); option.value=item.product; tierProduct.appendChild(option); });
        [['','Clear held tier']].concat((catalog.tierNames||[]).map(function(name){ return [name,name]; }),[['__bands','Small, mid and big bands']]).forEach(function(item){
          var option=el('option',null,item[1]); option.value=item[0]; tierValue.appendChild(option);
        });
        [['Customer',tierCode],['Book',tierProduct],['Held level',tierValue]].forEach(function(item){
          var wrap=el('label','maker-field',item[0]); wrap.appendChild(item[1]); tierSection.appendChild(wrap);
        });
        var bandBox=el('div','maker-bands'), bandSel={};
        bandBox.hidden=true;
        [['small','Small sizes'],['mid','Mid sizes'],['big','Big sizes']].forEach(function(item){
          var s=actOn(el('select','fld salt-field__input'),'record.tier.band-'+item[0]); s.setAttribute('aria-label',item[1]+' tier');
          (catalog.tierNames||[]).forEach(function(name){ var option=el('option',null,name); option.value=name; s.appendChild(option); });
          bandSel[item[0]]=s; var wrap=el('label','maker-field',item[1]); wrap.appendChild(s); bandBox.appendChild(wrap);
        });
        tierSection.appendChild(bandBox);
        var tierState=el('p','msg'), useProposal=actOn(el('button','salt-ghost','Use the proposal'),'record.tier.use-proposal'), useOffer=actOn(el('button','salt-ghost','Use the late-payer offer'),'record.tier.use-offer');
        useProposal.type='button'; useOffer.type='button';
        tierSection.appendChild(tierState); tierSection.appendChild(useProposal); tierSection.appendChild(useOffer);
        function tierPut(level){
          if(level&&typeof level==='object'){ tierValue.value='__bands'; ['small','mid','big'].forEach(function(k){ if(level[k]) bandSel[k].value=level[k]; }); }
          else tierValue.value=level||'';
          bandBox.hidden=tierValue.value!=='__bands';
        }
        function tierCardOf(){
          return (catalog.tierCards||[]).filter(function(c){ return c.code===tierCode.value&&c.product===tierProduct.value; })[0]||null;
        }
        function tierSay(level){
          return typeof level==='string'?level:['small','mid','big'].map(function(k){ return k+' '+level[k]; }).join(', ');
        }
        function tierRefresh(){
          var c=tierCardOf(), lines=[];
          if(c&&c.held) lines.push('Held: '+tierSay(c.held)+'.');
          else if(c&&c.proposed) lines.push('Proposed: '+tierSay(c.proposed)+'. Nothing is held yet.');
          else lines.push('No level is held or proposed.');
          if(c&&c.late) lines.push('Late payer: offered '+c.late.level+(c.late.why?', '+c.late.why:'')+'.');
          tierState.textContent=lines.join(' ');
          useProposal.hidden=!(c&&(c.proposed||c.held)); useOffer.hidden=!(c&&c.late);
        }
        tierValue.addEventListener('change',function(){ bandBox.hidden=tierValue.value!=='__bands'; });
        tierCode.addEventListener('change',tierRefresh); tierProduct.addEventListener('change',tierRefresh);
        useProposal.onclick=function(){ var c=tierCardOf(); if(c) tierPut(c.proposed||c.held); };
        useOffer.onclick=function(){ var c=tierCardOf(); if(c&&c.late) tierPut(c.late.level); };
        tierRefresh();
        var tierAnswer=el('p','msg'); tierAnswer.setAttribute('role','status'); tierSection.appendChild(tierAnswer);
        var tierPending=false, tierAt=null, tierSignature='';
        makerButton(tierSection,['Send tier for review','record.tier.send'],async function(send){
          if(tierPending) return;
          var level=tierValue.value==='__bands'?{small:bandSel.small.value,mid:bandSel.mid.value,big:bandSel.big.value}:(tierValue.value||null);
          var body={code:tierCode.value,product:tierProduct.value,tier:level};
          var check=JSON.stringify(body); if(check!==tierSignature){ tierSignature=check; tierAt=new Date().toISOString(); }
          body.at=tierAt; tierPending=true;
          try{ await send('/all/maker/inputs/tier-set',body); tierAnswer.textContent='Sent for review. The held tier changes only when folded.'; loadMaker(); }
          catch(error){ tierAnswer.textContent=error.message; }
          tierPending=false;
        },true,function(){ tierAt=null; tierSignature=''; });
        /* A1: the Desk's Accept all. The Desk reads its own proposals; held tiers and tiers already waiting are left alone.
           Each new Accept is its own request; a retry is the button's retained request, which keeps the id it was sent under. */
        var allAnswer=el('p','msg'); allAnswer.setAttribute('role','status'); tierSection.appendChild(allAnswer);
        var allPending=false;
        makerButton(tierSection,['Accept tier proposals','record.tier.accept-all'],async function(send){
          if(allPending) return;
          allPending=true;
          try{ await send('/all/maker/inputs/tier-accept-all',{at:new Date().toISOString()});
            allAnswer.textContent='Proposals sent for review. Held tiers were not moved.'; loadMaker(); }
          catch(error){ allAnswer.textContent=error.message; }
          allPending=false;
        },false);
      }
      var driftSection=makerForm('pricing');
      driftSection.appendChild(el('h3',null,'Customer drift'));
      driftSection.appendChild(el('p','msg','Salt only. Zero is a held override; Clear returns the customer to automatic drift from the record.'));
      tradeSection.parentNode.insertBefore(driftSection,tierSection.nextSibling);
      var driftCodes=catalog.driftCustomers||[], driftBooks=(catalog.products||[]).filter(function(item){ return item.drift; });
      if(!driftCodes.length||!driftBooks.length){
        driftSection.appendChild(el('p','msg','No drift customer input is available.'));
      }else{
        var driftCode=actOn(el('select','fld salt-field__input'),'record.drift.customer'), driftProduct=actOn(el('select','fld salt-field__input'),'record.drift.book');
        driftCodes.forEach(function(code){ var option=el('option',null,code); option.value=code; driftCode.appendChild(option); });
        driftBooks.forEach(function(item){ var option=el('option',null,pshape(item.product)); option.value=item.product; driftProduct.appendChild(option); });
        [['Customer',driftCode],['Book',driftProduct]].forEach(function(item){
          var wrap=el('label','maker-field',item[0]); wrap.appendChild(item[1]); driftSection.appendChild(wrap);
        });
        var driftValue=makerField(driftSection,['Drift from -1 to +1','record.drift.value'],'number','','0.05');
        driftValue.min='-1'; driftValue.max='1';
        var driftState=el('p','msg'); driftSection.appendChild(driftState);
        var driftAnswer=el('p','msg'); driftAnswer.setAttribute('role','status'); driftSection.appendChild(driftAnswer);
        var driftPending=false, driftAt=null, driftSignature='';
        function driftReceiptComplete(){ driftAt=null; driftSignature=''; }
        function driftCardOf(){
          return (catalog.driftCards||[]).filter(function(card){ return card.code===driftCode.value&&card.product===driftProduct.value; })[0]||null;
        }
        function driftFormat(value){ return (value>=0?'+':'')+Number(value).toFixed(2); }
        function driftRefresh(){
          var card=driftCardOf();
          if(card&&card.held) driftState.textContent='Held override: '+driftFormat(card.value)+'.';
          else if(card&&typeof card.current==='number') driftState.textContent='Automatic from the record: '+driftFormat(card.current)+'.';
          else driftState.textContent='Automatic from the record. No current drift is available in this snapshot.';
          clearDrift.hidden=!(card&&card.held);
        }
        driftCode.addEventListener('change',driftRefresh); driftProduct.addEventListener('change',driftRefresh);
        var driftActions=el('div','maker-drift-actions'); driftSection.appendChild(driftActions);
        makerButton(driftActions,['Set drift for review','record.drift.set'],async function(send){
          if(driftPending) return;
          var raw=driftValue.value.trim(), value=Number(raw);
          if(!raw||!Number.isFinite(value)||value < -1||value > 1){
            driftAnswer.textContent='Enter a drift from -1 to +1.';
            return;
          }
          value=Number(value.toFixed(2));
          var body={code:driftCode.value,product:driftProduct.value,tier:value};
          var check=JSON.stringify(body); if(check!==driftSignature){ driftSignature=check; driftAt=new Date().toISOString(); }
          body.at=driftAt; driftPending=true;
          try{ await send('/all/maker/inputs/tier-set',body); driftAnswer.textContent='Sent for review. The held drift changes only when folded.'; loadMaker(); }
          catch(error){ driftAnswer.textContent=error.message; }
          driftPending=false;
        },true,driftReceiptComplete);
        var clearDrift=makerButton(driftActions,['Clear held drift','record.drift.clear'],async function(send){
          if(driftPending) return;
          var body={code:driftCode.value,product:driftProduct.value,tier:null};
          var check=JSON.stringify(body); if(check!==driftSignature){ driftSignature=check; driftAt=new Date().toISOString(); }
          body.at=driftAt; driftPending=true;
          try{ await send('/all/maker/inputs/tier-set',body); driftAnswer.textContent='Clear sent for review. Automatic drift returns when folded.'; loadMaker(); }
          catch(error){ driftAnswer.textContent=error.message; }
          driftPending=false;
        },false,driftReceiptComplete);
        driftRefresh();
      }
      /* A6: the Desk's Make it the house board. Which sizes the board prints, never a price: the ask is the ladder's. */
      var houseSection=makerForm('pricing');
      houseSection.appendChild(el('h3',null,'Printed board sizes'));
      houseSection.appendChild(el('p','msg','Tick the sizes the board prints. This sets no price: the ladder sets the ask at every size.'));
      var houseBooks=(catalog.products||[]).filter(function(item){ return catalog.houseBoards&&catalog.houseBoards[item.product]&&catalog.houseBoards[item.product].sizes.length>1; });
      if(!houseBooks.length){
        houseSection.appendChild(el('p','msg','No board has sizes to choose between.'));
      }else{
        var houseProduct=actOn(el('select','fld salt-field__input'),'record.house.book'), houseBoxes=el('div','maker-field');
        houseBooks.forEach(function(item){ var option=el('option',null,pshape(item.product)); option.value=item.product; houseProduct.appendChild(option); });
        var houseWrap=el('label','maker-field','Book'); houseWrap.appendChild(houseProduct); houseSection.appendChild(houseWrap);
        houseSection.appendChild(houseBoxes);
        var houseTicks=[];
        function fillHouse(){
          var board=catalog.houseBoards[houseProduct.value]; houseBoxes.textContent=''; houseTicks=[];
          board.sizes.forEach(function(size){
            var label=el('label','maker-field'), tick=actOn(el('input'),'record.house.size',size); tick.type='checkbox';
            tick.checked=board.hidden.every(function(h){ return Math.abs(h-size)>=0.009; }); tick.value=String(size);
            label.appendChild(tick); label.appendChild(el('span','lbl',' '+size+' unit')); houseBoxes.appendChild(label); houseTicks.push(tick);
          });
        }
        houseProduct.addEventListener('change',fillHouse); fillHouse();
        var houseAnswer=el('p','msg'); houseAnswer.setAttribute('role','status'); houseSection.appendChild(houseAnswer);
        var housePending=false, houseAt=null, houseSignature='';
        makerButton(houseSection,['Send board sizes for review','record.house.send'],async function(send){
          if(housePending) return;
          var body={product:houseProduct.value,hide:houseTicks.filter(function(t){ return !t.checked; }).map(function(t){ return Number(t.value); })};
          var check=JSON.stringify(body); if(check!==houseSignature){ houseSignature=check; houseAt=new Date().toISOString(); }
          body.at=houseAt; housePending=true;
          try{ await send('/all/maker/inputs/house-sizes',body); houseAnswer.textContent='Sent for review. The board prints these sizes once folded; no price moves.'; loadMaker(); }
          catch(error){ houseAnswer.textContent=error.message; }
          housePending=false;
        },true,function(){ houseAt=null; houseSignature=''; });
      }
      box.appendChild(houseSection);
      /* A5: the Desk's Whiteboard hush. The tips are the ones the Desk is showing; a hush moves no figure. */
      var tipSection=makerForm('pricing');
      tipSection.appendChild(el('h3',null,'Tips'));
      tipSection.appendChild(el('p','msg','Hush a tip the Desk is showing. A snooze brings it back by itself on the day.'));
      tierSection.parentNode.insertBefore(tipSection,tierSection.nextSibling);
      var tips=catalog.tips||[];
      if(!tips.length){
        tipSection.appendChild(el('p','msg','The Desk is showing no tip to hush.'));
      }else{
        var tipId=actOn(el('select','fld salt-field__input'),'record.tip.tip'), tipFor=actOn(el('select','fld salt-field__input'),'record.tip.for');
        tips.forEach(function(tip){ var option=el('option',null,tip.id+' | '+tip.title+(tip.hush===null?' | dismissed':tip.hush?' | snoozed to '+tip.hush:'')); option.value=tip.id; tipId.appendChild(option); });
        [['7','Snooze 7 days'],['30','Snooze 30 days'],['','Dismiss']].forEach(function(item){ var option=el('option',null,item[1]); option.value=item[0]; tipFor.appendChild(option); });
        [['Tip',tipId],['Hush for',tipFor]].forEach(function(item){ var wrap=el('label','maker-field',item[0]); wrap.appendChild(item[1]); tipSection.appendChild(wrap); });
        var tipAnswer=el('p','msg'); tipAnswer.setAttribute('role','status'); tipSection.appendChild(tipAnswer);
        var tipPending=false, tipAt=null, tipSignature='';
        makerButton(tipSection,['Hush tip','record.tip.send'],async function(send){
          if(tipPending) return;
          var check=tipId.value+'|'+tipFor.value; if(check!==tipSignature){ tipSignature=check; tipAt=new Date().toISOString(); }
          var until=tipFor.value===''?null:new Date(Date.parse(tipAt)+8*3600000+Number(tipFor.value)*86400000).toISOString().slice(0,10);
          tipPending=true;
          try{ await send('/all/maker/inputs/hush',{at:tipAt,id:tipId.value,until:until}); tipAnswer.textContent='Hushed. The Desk hides it when it next reads the hushes: on load, or on opening Whiteboard.'; loadMaker(); }
          catch(error){ tipAnswer.textContent=error.message; }
          tipPending=false;
        },true,function(){ tipAt=null; tipSignature=''; });
      }
      makerOtherInputs(box,catalog,refreshMakerTradeCatalog);
      recordMenu(box,note);
    }catch(error){ note.textContent=error.message; note.dataset.retry='true';
      makerButton(box,['Try again','record.retry'],function(){ while(box.children.length>1) box.lastChild.remove(); loadMakerInputs(); }); }
    finally{ sweep(); }
  }
  async function makerForAccount(account){
    showPlace('orders','waiting',{fresh:true,push:true});
    var box=document.getElementById('makerFor'); box.hidden=false; box.textContent='';
    box.appendChild(el('h2',null,'Order for '+account.username));
    var note=el('p','msg','Opening their price list…'); note.setAttribute('role','status'); box.appendChild(note);
    if(!OWNER.master){ note.textContent='The master passphrase is not configured, so their list cannot be opened.'; return; }
    try{
      var response=await fetch('/open',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({u:account.username,password:OWNER.master,master:OWNER.master})});
      var result=await response.json();
      if(!response.ok||!result.ok||!result.byMaster||!result.wrapMaster||!result.prices)
        throw new Error('Their current price list could not be opened.');
      var key=await unwrap(OWNER.master,result.wrapMaster), list=await openList(key,result.prices); key=null;
      if(!box.isConnected||box.hidden) return;
      var choices=[];
      (list.products||[]).forEach(function(product){ (product.sizes||[]).forEach(function(size){
        choices.push({product:product.product,qty:size.q,total:size.price});
      }); });
      if(!choices.length) throw new Error('No priced size is on their list.');
      note.textContent='One order, on their current list. Acknowledgement is still checked against the Desk row.';
      var label=el('label','maker-field','Size and price'), pick=actOn(el('select','fld salt-field__input'),'orderfor.size');
      choices.forEach(function(choice,index){ var option=el('option',null,pshape(choice.product)+' '+unitsOf(choice.qty)+' · '+rm(choice.total));
        option.value=String(index); pick.appendChild(option); }); label.appendChild(pick); box.appendChild(label);
      var modeLabel=el('label','maker-field','Collected or delivered'), mode=actOn(el('select','fld salt-field__input'),'orderfor.mode');
      [['collect','Collected'],['deliver','Delivered']].forEach(function(item){ var option=el('option',null,item[1]); option.value=item[0]; mode.appendChild(option); });
      modeLabel.appendChild(mode); box.appendChild(modeLabel);
      var place=makerField(box,['Delivery locality','orderfor.place'],'text',''), want=makerField(box,['Wanted by (optional)','orderfor.want'],'date','');
      var friendLabel=el('label','tick'), friend=actOn(el('input'),'orderfor.friend'); friend.type='checkbox';
      friendLabel.appendChild(friend); friendLabel.appendChild(document.createTextNode('For a friend')); friendLabel.hidden=!result.assoc; box.appendChild(friendLabel);
      var answer=el('p','msg'); answer.setAttribute('role','status'); box.appendChild(answer);
      var sent=false, pending=false, button=makerButton(box,['Place for them','orderfor.place-order'],async function(){
        if(pending||sent) return;
        var choice=choices[Number(pick.value)];
        var body={product:choice.product,qty:choice.qty,total:choice.total,unit:+(choice.total/choice.qty).toFixed(2),
          mode:mode.value,place:mode.value==='deliver'?place.value:'',forFriend:!!(result.assoc&&friend.checked),
          week:list.week&&list.week.monday||'',digest:list.digest||'',wantBy:want.value};
        body.rid=ridFor('maker:'+account.username,JSON.stringify(body));
        pending=true; button.disabled=true; answer.textContent='Placing…';
        try{
          var placed=await refs('/all/maker/customers/'+account.username+'/orders',body);
          sent=true; answer.textContent='Placed. Waiting for acknowledgement.'; loadMaker();
        }catch(error){ answer.textContent=error.message; }
        pending=false; button.disabled=sent;
      },true);
    }catch(error){ note.textContent=error.message; }
  }
  /* PHASE 1b: Needs you and Orders read this too. A poll (quiet true; a button hands this its own argument, never true) starts no read while
     one is out, nor on Orders while he has a field open, a tap in flight or cash held, and a poll that finds the same answer draws nothing.
     The newest read wins, so a slow one never draws over a fresher. */
  var reviewReading=false, makerGen=0;
  async function loadMaker(quiet){
    if(placeNow!=='orders'&&placeNow!=='record'&&placeNow!=='needs') return;
    var poll=quiet===true;
    if(poll&&(reviewReading||(placeNow!=='needs'&&(makerBusy||dirty.makerReview||Object.keys(makerCashHeld).length)))) return;
    var gen=++makerGen, apply=false, status=document.getElementById('makerReviewStatus'), rows=document.getElementById('makerDraftStatus');
    reviewReading=true;
    if(!poll){
      if(status) status.textContent='Reading orders…';
      if(rows) rows.textContent='Reading rows…';
    }
    try{
      makerCashRestore();
      var reading=await refs('/all/maker/review');
      if(gen!==makerGen) return;
      nGot('review');
      if(!changed('review', reading)&&poll) return;
      apply=true;
      makerCashReconcile(reading);makerData=reading;
      drawMaker();
    }catch(error){
      if(gen!==makerGen) return;
      nGot('review', error); apply=true;
      if(!poll){ drawMaker();if(status) status.textContent=error.message; if(rows) rows.textContent=error.message; }
    }finally{ if(gen===makerGen){ reviewReading=false; if(apply) drawNeeds(); } }
  }
  /* 11 Oct 2026: THE PARTS OF ORDERS an order shows in. Waiting on you holds what only he can move (a placed order, a payment they say
     they sent, a stage he rejected under Approve); Agreed and Ready hold the stage the order stands at, so an order can show in two. A closed
     order is in Closed, and a practice order that is closed in none; one with a stage he rejected, or a question of theirs he has not
     answered (the Worker's awaitingAnswer), is in Waiting on you as well. */
  function orderAsked(order){
    var m=(order&&order.msgs)||[], last=m[m.length-1];
    return !!(last&&last.by==='customer'&&!(order.quiet&&String(order.quiet)>=String(last.at)));
  }
  function orderPartsOf(order){
    var t=[], again=!!(order.again&&order.again.length);
    if(ordOpen(order)){
      if(order.status==='placed'||(order.payments||[]).some(function(p){ return p.claim==='waiting'; })||again||orderAsked(order)) t.push('orders.waiting');
      if(order.status==='acknowledged') t.push('orders.agreed');
      if(order.status==='ready') t.push('orders.ready');
    }else if(!order.test){
      if(again||orderAsked(order)) t.push('orders.waiting');
      t.push('orders.closed');
    }
    return t.join(' ');
  }
  /* PHASE 1c (11 Oct 2026): ORDERS ARE A LIST AND A DETAIL. #makerOrderList holds a row for each order of the part showing, the system's
     Inbox row: who by code, the mark and its units, the stage and what is asked of him, the figure and the age. A row opens that order's
     card in #makerReview, today's card with every control, request and guard as it was, drawn for the order opened and no other. From 860px
     the list stands beside the card; below it the card takes the list's place, with a way back. A row has no preview: that read is the
     card's. Leaving the place or the part closes the card. */
  var ordOpened=null, ordEntries={}, makerOpenOrders=[];
  var ORD_STAGE={placed:['copper','Placed'], acknowledged:['brass','Agreed'], ready:['verdigris','Ready'], done:['mist','Done'], declined:['mist','Declined'], cancelled:['mist','Cancelled']};
  function ordInPart(e){ return e.parts.split(' ').indexOf('orders.'+partNow)>=0; }
  function orderRow(e){
    var o=e.order, b=el('button','salt-inbox-row ordrow'); b.type='button'; b.setAttribute('data-in',e.parts); b.setAttribute('data-order',e.id); actOn(b,'order.open',e.id);
    if(ordOpened===e.id) b.setAttribute('aria-current','true');
    var main=el('span','salt-inbox-row__main'), t=el('span','salt-inbox-row__title'), side=el('span','salt-inbox-row__side');
    if(o){
      var st=ORD_STAGE[o.status]||['mist',String(o.status||'')];
      b.appendChild(mtile(o.product,o.qty));
      t.appendChild(el('span',null,codeByUser(o.u)));
      t.appendChild(chip(st[0],st[1]));
      if(o.test) t.appendChild(chip('mist','Practice'));
      if(orderAsked(o)) t.appendChild(chip('copper','Asked'));
      if(ordPays(o).length) t.appendChild(chip('ember','Says sent'));
      if(o.again&&o.again.length) t.appendChild(chip('brass','Offer again'));
      main.appendChild(el('span','salt-inbox-row__what',[unitsOf(o.qty), o.mode==='deliver'?'deliver':o.mode==='collect'?'collect':''].filter(Boolean).join(', ')));
      side.appendChild(el('span','salt-inbox-row__age',ageOf(o.at)));
      side.appendChild(el('span','salt-inbox-row__action',rm(Number(o.total||0)+Number(o.delivery||0))));
    }else t.appendChild(el('span',null,e.id));
    if(makerCashHeld[e.id]) t.appendChild(chip('brass','Cash held'));
    main.insertBefore(t,main.firstChild); b.appendChild(main); b.appendChild(side);
    b.addEventListener('click', function(){ openOrder(e.id); });
    return b;
  }
  function markOrderRows(){
    [].forEach.call(document.querySelectorAll('#makerOrderList [data-order]'), function(r){
      if(r.getAttribute('data-order')===ordOpened) r.setAttribute('aria-current','true'); else r.removeAttribute('aria-current'); });
  }
  /* the card of the order opened, drawn from the read that stands; it closes when its order has left the part showing (the answer to a tap
     that moved it is then on the list's line, as a card that had gone always left it) */
  function drawOrderPane(){
    var root=document.getElementById('makerReview'), split=document.getElementById('oSplit');
    if(!root) return;
    root.textContent=''; dirty.makerReview=false;
    var e=ordOpened&&placeNow==='orders'&&ordEntries[ordOpened];
    if(e&&!ordInPart(e)) e=null;
    if(!e) ordOpened=null;
    if(split) split.classList.toggle('open', !!e);
    markOrderRows();
    if(!e){ root.appendChild(el('p','rnone','Choose an order to see it here.')); return; }
    var back=el('button','aback','← Orders'); back.type='button'; back.setAttribute('data-back','orders'); back.setAttribute('data-in',e.parts); actOn(back,'order.back');
    root.appendChild(back);
    if(e.order&&ordOpen(e.order)) orderCard(root,e.order); else orderPlainCard(root,e);
  }
  function openOrder(id){
    var e=ordEntries[id];
    if(!e||placeNow!=='orders'||!ordInPart(e)) return;
    /* an order opened reads its figures afresh: the card draws from no earlier quote */
    [id,id+':again'].forEach(function(k){ delete makerQuotes[k]; delete makerPv[k]; });
    ordOpened=id; drawOrderPane(); sweep();
    /* below 860px the card takes the list's place and has its way back showing, so he is taken to the top of it; from 860px the list is the
       page's scroll and the card stands beside it, sticky, so a tap on a low row leaves the page where it is and only brings the card into view */
    try{
      var back=document.querySelector('#makerReview [data-back="orders"]'), card=document.getElementById('makerReview');
      if(back&&back.focus) back.focus();
      if(back&&window.getComputedStyle(back).display!=='none') window.scrollTo(0,0);
      else if(card&&card.scrollIntoView) card.scrollIntoView({block:'nearest'});
    }catch(x){}
  }
  function closeOrder(){
    var was=ordOpened; ordOpened=null; drawOrderPane(); sweep();
    try{ var row=was&&document.querySelector('#makerOrderList [data-order="'+was+'"]'); if(row&&row.focus) row.focus(); }catch(x){}
  }
  /* a Desk row that rides a trip with others: the trip's id, and every pending row of it. A claim's row or an order's has none. */
  function tripOf(draft){
    var entry=draft.entry||{};
    return !entry.orderId&&!entry.claim&&!(entry.fulfil&&entry.fulfil.claim)&&draft.row&&draft.row.trip;
  }
  function tripRows(draft){
    var trip=tripOf(draft);
    return trip?(makerData.drafts||[]).filter(function(item){ return item.status==='pending'&&item.collection==='sales'&&tripOf(item)===trip; }):[];
  }
  /* THE ONE APPROVE of a Desk row, Record > Approve's button and Needs you's pill alike: the same question, the same request, the same
     answer line. It resolves true when the row was approved, false when it was not, and nothing when it was not asked (he declined, or a
     tap is already out). */
  function approveDraft(draft){
    if(!window.confirm(tripRows(draft).length?'Approve every proposed row of this trip shown here?':'Approve the proposed row shown here?')) return Promise.resolve();
    return makerAction('/all/maker/drafts/'+encodeURIComponent(draft.id)+'/approve',{},'Row approved.','draft:'+draft.id);
  }
  function drawMaker(){
    var root=document.getElementById('makerReview'), list=document.getElementById('makerOrderList'), status=document.getElementById('makerReviewStatus');
    var queueRoot=document.getElementById('makerQueueReview'), draftRoot=document.getElementById('makerDrafts')||root, draftStatus=document.getElementById('makerDraftStatus');
    if(!root||!list) return;
    if(!makerData){
      if(!Object.keys(makerCashHeld).length&&!makerCashStorageError)return;
      makerData={orders:[],drafts:[]};
    }
    if(draftRoot!==root) draftRoot.textContent='';
    var open=(makerData.orders||[]).filter(ordOpen);
    var pendingRows=(makerData.drafts||[]).filter(function(d){ return d.status==='pending'; });
    makerOpenOrders=open;
    if(status) status.textContent=open.length+' open orders';
    if(draftStatus) draftStatus.textContent=pendingRows.length+' Desk rows waiting';
    /* a row for each order of a part, a closed one (fifty at most) as well; an order whose cash is held stays in Waiting on you with its
       Undo, whatever else it is, and a held cash with no order on the read is a row of its own */
    var held=Object.keys(makerCashHeld), entries=[], known={}, settled=0, closedAll=0;
    (makerData.orders||[]).forEach(function(o){
      known[o.id]=true;
      var parts=orderPartsOf(o);
      if(held.indexOf(o.id)>=0&&parts.indexOf('orders.waiting')<0) parts=(parts+' orders.waiting').trim();
      if(!parts) return;
      if(parts.split(' ').indexOf('orders.closed')>=0) closedAll++;
      if(parts==='orders.closed'&&++settled>50) return;
      entries.push({id:o.id, order:o, parts:parts});
    });
    held.filter(function(id){ return !known[id]; }).forEach(function(id){ entries.push({id:id, order:null, parts:'orders.waiting'}); });
    ordEntries={}; entries.forEach(function(e){ ordEntries[e.id]=e; });
    list.textContent='';
    entries.forEach(function(e){ list.appendChild(orderRow(e)); });
    /* what Closed lists is a closed order with nothing else asked of him (fifty at most) and one that is also Waiting on you, which is never
       dropped; the note counts what the list shows against every closed order */
    var closedShown=entries.filter(function(e){ return e.parts.split(' ').indexOf('orders.closed')>=0; }).length;
    if(closedShown<closedAll){ var more=el('p','rnone',closedShown+' of '+closedAll+' closed orders are shown.'); more.setAttribute('data-in','orders.closed'); list.appendChild(more); }
    /* a part with nothing in it says so, so an empty part is never read as a fault */
    [['waiting',open.length?'Nothing waits on you.':'No open Counter orders.'],['agreed','No agreed orders.'],['ready','No orders ready.'],['closed','No closed orders.']].forEach(function(p){
      if(entries.some(function(e){ return e.parts.split(' ').indexOf('orders.'+p[0])>=0; })) return;
      var none=el('p','rnone',p[1]); none.setAttribute('data-in','orders.'+p[0]); list.appendChild(none);
    });
    makerButton(list,['Refresh','maker.refresh'],loadMaker,false);
    drawOrderPane();
    drawDeskRows(draftRoot,queueRoot,pendingRows);
    sweep();
  }
  /* the card of an open order: every control it had, on the order opened alone */
  function orderCard(root,order){
    var open=makerOpenOrders;
    {
      var card=makerCard(root,order.id), head=el('h3','',order.id), acts=el('div','maker-foot__acts'), cashed=false; card.appendChild(head); card.setAttribute('data-in',orderPartsOf(order));
      var ownerLine=el('p','lead',(order.u||'')+' · '+(order.product||'')+' · '+order.qty+' units · '+order.status);
      card.appendChild(ownerLine);
      card.appendChild(el('p','maker-facts','RM '+Number(order.total||0).toFixed(2)+(order.delivery?' · delivery RM '+Number(order.delivery).toFixed(2):'')));
      /* 10 Oct 2026: the delivery time they asked for, the part of its window inside the hours, while goods are still to go */
      if(order.mode==='deliver'&&order.slot&&order.slotSpan&&!((+order.moved||0)>=(+order.qty||0)-0.004))
        card.appendChild(el('p','maker-facts','Delivery wanted between '+String(order.slotSpan).replace('-',' and ')+' on '+String(order.slot).slice(0,10)));
      /* 10 Oct 2026: their exact spot is sealed to his key: the Desk opens it, this page only says it was shared */
      if(order.mode==='deliver'&&order.pin) card.appendChild(el('p','maker-facts','Location shared, sealed: the Desk opens it for the fee.'));
      var againAck=makerAgainAck(order), quoteStart=null;
      if(order.status==='placed'&&makerAccHeld(order)){
        var ap=order.price, apf=ap.offer||{};
        card.appendChild(el('p','maker-facts',(ap.state==='taken'?'They said yes to ':'Sent for their yes: ')+'goods '+rm(apf.total)
          +(order.mode==='deliver'?', delivery '+rm(apf.delivery||0):'')+(apf.slot&&apf.slotSpan?', between '+String(apf.slotSpan).replace('-',' and ')+' on '+mwDayLabel(String(apf.slot).slice(0,10)):'')
          +(ap.state==='taken'?'. Its row is drafted at it.':', open until '+String(apf.until).slice(0,16).replace('T',' ')+' UTC.')));
        if(ap.state!=='taken') makerButton(acts,['Withdraw the offer','order.withdraw-offer'],function(){ makerTap(order,'withdraw',{},'Offer withdrawn. The order stands as they placed it.'); },false).setAttribute('data-withdraw','');
      }else if(order.status==='placed'){
        var quote=makerQuotes[order.id]||(makerPv[order.id]&&makerPv[order.id].payload)||{}, form=el('div','maker-fields');
        var total=makerField(form,['Order total (RM)','order.total'],'number',quote.total==null?order.total:quote.total);
        card.appendChild(form);
        /* a sheet of several placed orders asks for the delivery charge once, on its first order (the Desk's ordPvDelivery):
           the others hide the chips and send nought */
        var group=open.filter(function(o){ return order.sheet&&o.u===order.u&&o.sheet===order.sheet; }).sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); });
        var follower=group.length>1&&group.every(function(o){ return o.status==='placed'; })&&group[0].id!==order.id;
        var deliver=order.mode==='deliver'&&!follower;
        var chip=makerFee[order.id]||(makerFee[order.id]={value:'',other:''});
        var otherField=null, previewTurn=0, sig=JSON.stringify(order);
        /* 12 Oct 2026 (his decision 6 of 11 Oct): THE CARD READS ITS OWN PREVIEW, once, when its order is opened, and again when an input is
           changed; the Preview button is retired. A row of the list reads nothing (only the opened order draws a card), so the Desk is asked
           once for an order he opens. A redraw of the card (a read that changed, a tap) keeps the quote it has, or waits on the one in
           flight, and never asks again for the same figures. */
        var qsay=el('p','salt-insight'), qfigs=el('div','maker-quote');
        qsay.setAttribute('role','status');
        function makerPlacedSay(text,bad){
          qsay.className=bad?'msg':'salt-insight'; qsay.textContent=text; qfigs.textContent='';
          var accept=card.querySelector('[data-accept]'); if(accept) accept.remove();
        }
        /* any failed or in-flight preview, and any changed input, clears the usable quote/hash and takes Accept away:
           none of it is usable until a fresh exact-input preview succeeds (immediate safety requirement) */
        function makerPlacedInvalidate(){
          previewTurn++;
          delete makerQuotes[order.id]; delete makerPv[order.id];
          var chosen=makerPlacedDelivery()!=null;
          makerPlacedSay(chosen?'The figures are read again when you finish.':'Choose the delivery charge, and the figures read themselves.');
          /* 12 Oct 2026: an edit put back to what it was fires no change, so the read it waits for would never come: the card offers it, and nothing is left
             waiting on an event that may not happen (Accept stays away until the figures are read) */
          if(chosen) makerButton(qfigs,['Read the figures again','order.reread'],makerPlacedRead,false);
        }
        /* what the figures stand on: the goods total, the charge, and the window, which decides whether Accept goes to them for their yes */
        function makerPlacedWin(){ return order.mode==='deliver'?((follower?(makerWin[group[0].id]||{}).value:win.value)||''):''; }
        function makerPlacedKey(){
          var d=makerPlacedDelivery();
          return d==null?'':JSON.stringify([{total:Number(total.value),delivery:d},makerPlacedWin()]);
        }
        function makerPlacedShow(q){
          qsay.className='salt-insight'; qsay.textContent='Figures read. Check the row before accepting.';
          qfigs.textContent=''; makerPlacedReading(qfigs,q.result);
          var old=card.querySelector('[data-accept]'); if(old) old.remove();
          /* a sheet's lines take its first order's window, as they take its one delivery charge */
          var wv=makerPlacedWin(), yes=makerNeedsYes(order,q.total,wv);
          var accept=makerButton(acts,[(yes?'Send for their yes at ':'Accept order at ')+rm(q.result.quote)+', delivery '+rm(q.result.delivery),yes?'order.send-yes':'order.accept'],function(){
            var s=makerQuotes[order.id]; if(!s||!s.hash) return;
            /* version 2: a raise or another window goes to them as an offer, for their yes; never on a sheet, which the Desk refuses */
            if(yes){ var ob={total:s.total,delivery:s.delivery,hash:s.offerHash}; if(order.mode==='deliver'&&wv) ob.slot=wv;
              makerTap(order,'offer',ob,'Sent to them for their yes.'); return; }
            var body={total:s.total,delivery:s.delivery,hash:s.hash};
            if(order.mode==='deliver'&&!order.slot&&!order.wantBy&&wv) body.slot=wv;
            makerAction('/all/maker/orders/'+encodeURIComponent(order.id)+'/accept',body,'Order sent to the Desk for acknowledgement.',order.id);
          },true); accept.setAttribute('data-accept',''); acts.insertBefore(accept,acts.firstChild);
        }
        function makerPlacedRead(){
          var delivery=makerPlacedDelivery();
          if(delivery==null){ previewTurn++; makerPlacedSay('Choose the delivery charge, and the figures read themselves.'); return; }
          var payload={total:Number(total.value),delivery:delivery}, key=makerPlacedKey(), turn=++previewTurn;
          /* an in-flight preview is not yet usable: clear any existing quote/Accept at once, not only on success */
          delete makerQuotes[order.id];
          makerPlacedSay('Reading the figures.');
          var pv=makerPv[order.id];
          if(!pv||pv.key!==key) pv=makerPv[order.id]={key:key,payload:payload,p:refs('/all/maker/orders/'+encodeURIComponent(order.id)+'/preview',payload)};
          pv.p.then(function(result){
            if(makerPv[order.id]===pv) delete makerPv[order.id];
            if(turn!==previewTurn||!card.isConnected) return;
            makerQuotes[order.id]={total:payload.total,delivery:payload.delivery,hash:result.hash,offerHash:result.offerHash,result:result,key:key,sig:sig};
            makerPlacedShow(makerQuotes[order.id]);
          }).catch(function(error){
            if(makerPv[order.id]===pv) delete makerPv[order.id];
            if(turn!==previewTurn||!card.isConnected) return;
            delete makerQuotes[order.id];
            makerPlacedSay(error.message,true);
            makerButton(qfigs,['Read the figures again','order.reread'],makerPlacedRead,false);
          });
        }
        total.addEventListener('input',makerPlacedInvalidate);
        total.addEventListener('change',makerPlacedRead);
        quoteStart=function(){
          var held=makerQuotes[order.id];
          if(held&&held.sig===sig&&held.key===makerPlacedKey()) makerPlacedShow(held); else makerPlacedRead();
        };
        if(deliver){
          /* S11 11.3 on the Counter: the delivery charge is chosen where the order is agreed, RM 0, 10, 15 or his own
             figure, and NONE is chosen until he chooses, so a delivery is never agreed at a charge nobody set */
          var fieldset=el('fieldset','salt-options'), grid=el('div','salt-options__grid salt-options__grid--2');
          fieldset.appendChild(el('legend','salt-options__legend','Delivery charge'));
          [['0','RM 0'],['10','RM 10'],['15','RM 15'],['other','Other']].forEach(function(opt){
            var label=el('label','salt-option'), radio=el('input','salt-option__input'),
                face=el('span','salt-option__face'), text=el('span','salt-option__label',opt[1]);
            radio.type='radio'; radio.name='makerFee-'+order.id; radio.value=opt[0]; radio.checked=chip.value===opt[0]; actOn(radio,'order.fee-'+opt[0]);
            radio.addEventListener('change',function(){
              chip.value=opt[0];
              if(otherField) otherField.closest('label').hidden=opt[0]!=='other';
              makerPlacedInvalidate(); makerPlacedRead();
            });
            face.appendChild(text); label.appendChild(radio); label.appendChild(face); grid.appendChild(label);
          });
          fieldset.appendChild(grid);
          otherField=makerField(fieldset,['Other, RM','order.fee-other-amount'],'number',chip.other);
          otherField.closest('label').hidden=chip.value!=='other';
          otherField.addEventListener('input',function(){ chip.other=otherField.value; makerPlacedInvalidate(); });
          otherField.addEventListener('change',makerPlacedRead);
          card.appendChild(fieldset);
        }
        /* 10 Oct 2026 (his Q3): a delivery that asked for no time may be answered with a window, sent with Accept; theirs stands */
        var win=makerWin[order.id]||(makerWin[order.id]={value:'',day:''});
        if(deliver&&!order.wantBy){
          var now=Date.now(), days=makerWinDays(now), theirs=order.slot?String(order.slot).slice(0,10):'';
          if(days.indexOf(win.day)<0) win.day=days.indexOf(theirs)>=0?theirs:(days[0]||'');
          var wset=el('fieldset','salt-options'), wgrid=el('div','salt-options__grid salt-options__grid--2');
          wset.appendChild(el('legend','salt-options__legend','Delivery time'));
          var dl=el('label','salt-field'), ds=el('select','salt-field__input');
          dl.appendChild(el('span','salt-field__label','Day')); ds.setAttribute('data-winday',''); actOn(ds,'order.window-day');
          days.forEach(function(d){ var op=el('option','',mwDayLabel(d)); op.value=d; op.selected=d===win.day; ds.appendChild(op); });
          dl.appendChild(ds); wset.appendChild(dl);
          var own=order.slot&&order.slotSpan?'Theirs, '+String(order.slotSpan).replace('-',' to ')+' on '+mwDayLabel(theirs):'As soon as it can';
          function makerWinDraw(){
            wgrid.textContent='';
            [['',own]].concat(makerWinOn(win.day,Date.now()).filter(function(x){ return x[0]!==order.slot; })).forEach(function(opt){
              var label=el('label','salt-option'), radio=el('input','salt-option__input'),
                  face=el('span','salt-option__face'), text=el('span','salt-option__label',opt[1]);
              radio.type='radio'; radio.name='makerWin-'+order.id; radio.value=opt[0]; radio.checked=win.value===opt[0]; actOn(radio,opt[0]===''?'order.window-own':'order.window-'+opt[0].slice(11));
              /* a window decides whether Accept goes to them for their yes, so a change reads the figures again */
              radio.addEventListener('change',function(){ win.value=opt[0]; makerPlacedInvalidate(); makerPlacedRead(); });
              face.appendChild(text); label.appendChild(radio); label.appendChild(face); wgrid.appendChild(label);
            });
          }
          ds.addEventListener('change',function(){ win.day=ds.value; makerWinDraw(); });
          makerWinDraw();
          wset.appendChild(wgrid);
          wset.appendChild(el('p','salt-insight',order.slot?'Their window stands. Another goes to them for their yes before it is agreed.'
            :'They asked for it as soon as it can. A window you choose goes with Accept and needs no yes of theirs.'));
          card.appendChild(wset);
        }
        function makerPlacedDelivery(){
          if(!deliver) return 0;
          if(chip.value==='other'){ var v=Number(otherField.value); return otherField.value!==''&&v>=0?v:null; }
          if(chip.value==='0'||chip.value==='10'||chip.value==='15') return Number(chip.value);
          return null;
        }
        card.appendChild(qsay); card.appendChild(qfigs);
      }else if(againAck){
        quoteStart=makerAcceptAgain(card,order,acts);
      }else if(order.status==='acknowledged'){
        /* Ready says how the goods go, as the Desk's card does; the order book records the mode at Ready */
        [['collect','Ready to collect'],['deliver','Ready to deliver']].forEach(function(m){
          makerButton(acts,[m[1],'order.ready-'+m[0]],function(){
            makerMove(order,{status:'ready',mode:m[0]},'Order marked '+m[1].toLowerCase()+'.');
          },(order.mode||'collect')===m[0]).setAttribute('data-mode',m[0]);
        });
      }else if(order.status==='ready'){
        var qty=makerField(card,['Units handed over','order.handed-units'],'number',order.qty);
        makerButton(acts,['Record handover','order.handed'],function(){
          makerTap(order,'handed',{qty:Number(qty.value)},'Handover sent to the Desk.');
        },true);
        /* a close at what was handed over: the order ends at these units, its total restated by the Desk */
        if(!order.test){
          var closeBtn=makerButton(card,['Close at these units','order.close'],function(){
            var n=Number(qty.value);
            if(!(n>0&&n<Number(order.qty))){ makerSay(order.id,'A close is above 0 and under the '+order.qty+' units ordered.'); return; }
            makerAsk(order,closeBtn,'close',{title:'Close this order at '+n+' of '+order.qty+' units?', plain:true, go:'Close the order', keep:'Not yet',
              say:['The order ends at '+n+' units, and the Desk restates its total.'],
              yes:function(){ makerTap(order,'handed',{qty:n,close:true},'Close sent to the Desk.'); }});
          },false);
          closeBtn.setAttribute('data-close',''); makerAskTag(order,closeBtn,'close');
        }
      }
      if(!againAck&&(order.status==='acknowledged'||order.status==='ready')){
        (order.payments||[]).filter(function(payment){ return payment.claim==='waiting'; }).forEach(function(payment){
          /* a claim above what the order still owes is money he recorded another way: the Desk's Received, on the book already */
          var onBook=Number(payment.amount)>Number(order.total||0)+Number(order.delivery||0)-Number(order.paid||0)+0.004;
          makerButton(card,[onBook?'Received, on the book already '+rm(payment.amount):'Receive claimed '+rm(payment.amount),'order.claim-received',payment.at],function(){
            makerTap(order,'received',onBook?{amount:payment.amount,claim:payment.at,covered:true}:{amount:payment.amount,claim:payment.at},
              onBook?'Received, on the book already: nothing more is booked.':'Claim confirmation sent to the Desk.');
          },false);
          makerButton(card,['Not found '+rm(payment.amount),'order.claim-not-found',payment.at],function(){
            makerMove(order,{claim:payment.at,amount:payment.amount},'Claim answered Not found.');
          },false);
        });
        var received=makerField(card,['Other payment received (RM)','order.received-amount'],'number','');
        makerButton(card,['Confirm received','order.received'],function(){
          makerTap(order,'received',{amount:Number(received.value)},'Payment confirmation sent to the Desk.');
        },false);
      }
      /* his decision of 06 Oct 2026: the size, the goods' price and the delivery charge stay amendable after Accept, one Correction for approval */
      if(!againAck&&(order.status==='acknowledged'||order.status==='ready')){
        var aq=makerField(card,['Amend units','order.amend-units'],'number',order.qty), at=makerField(card,['Amend goods price (RM)','order.amend-total'],'number',order.total), ad=makerField(card,['Amend delivery (RM)','order.amend-delivery'],'number',order.delivery||0);
        [aq,at,ad].forEach(function(f){ f.setAttribute('data-amend-field',''); });
        makerButton(card,['Amend order','order.amend'],function(){
          var body={}, q=Number(aq.value), t=Number(at.value), d=Number(ad.value);
          if(q!==Number(order.qty)) body.qty=q;
          if(t!==Number(order.total)) body.total=t;
          if(d!==Number(order.delivery||0)) body.delivery=d;
          if(body.qty!==undefined&&body.total===undefined) body.total=t;
          if(!Object.keys(body).length){ makerSay(order.id,'Change a figure first.'); return; }
          makerTap(order,'restate',body,'Amendment sent to the Desk for approval.');
        },false).setAttribute('data-amend','');
      }
      makerAgain(card,order,acts);
      makerOrderMoves(card,order,false,acts);
      if(order.status==='ready'&&!againAck){ makerCashControls(card,order); cashed=true; }
      makerCardFoot(card,acts,order.id,cashed,!!quoteStart);
      if(quoteStart) quoteStart();
      return card;
    }
  }
  /* the card of an order that is not open: one with a stage he rejected keeps its card until that stage is offered again or left; a closed
     order has its figures, and a question of theirs he has not answered its reply; cash held for it keeps its Undo (or its Retry) */
  function orderPlainCard(root,e){
    var order=e.order, again=null, acts=el('div','maker-foot__acts'), cashed=false, card=makerCard(root,e.id); card.setAttribute('data-in',e.parts); card.appendChild(el('h3','',e.id));
    if(order){
      card.appendChild(el('p','lead',(order.u||'')+' · '+(order.product||'')+' · '+order.qty+' units · '+order.status));
      card.appendChild(el('p','maker-facts','RM '+Number(order.total||0).toFixed(2)+(order.delivery?' · delivery RM '+Number(order.delivery).toFixed(2):'')));
      if(makerAgainAck(order)) again=makerAcceptAgain(card,order,acts);
      makerAgain(card,order,acts);
      if(orderAsked(order)) makerOrderMoves(card,order,true);
    }else card.setAttribute('data-key',e.id);
    if(makerCashHeld[e.id]){ makerCashControls(card,order||{id:e.id}); cashed=true; }
    makerCardFoot(card,acts,e.id,cashed,!!again);
    if(again) again();
    return card;
  }
  /* the Desk's rows waiting for him and the entries the server holds, on Record > Approve */
  function drawDeskRows(draftRoot,queueRoot,pendingRows){
    pendingRows.forEach(function(draft){
      var card=makerCard(draftRoot,'draft:'+draft.id), entry=draft.entry||{};
      card.appendChild(el('h3','',draft.id||'Desk row'));
      card.appendChild(el('p','lead',(entry.type||'Entry')+' · '+(entry.party||'no code')+' · '+(entry.date||entry.payload&&entry.payload.date||'')));
      card.appendChild(el('p','maker-facts',(draft.product||'')+' · '+(draft.qty==null?'':draft.qty+' units')+' · RM '+Number(draft.total||0).toFixed(2)));
      makerReading(card,draft,draft.id);
      var trip=tripOf(draft), siblings=tripRows(draft);
      if(siblings.length){
        card.appendChild(el('p','salt-insight','Trip '+trip+' · '+siblings.length+' rows waiting. This tap decides every row of the trip.'));
        siblings.filter(function(item){return item.id!==draft.id;}).forEach(function(item){
          card.appendChild(el('p','maker-facts',(item.product||'salt')+' · '+item.qty+' units · RM '+Number(item.total||0).toFixed(2)));
          makerReading(card,item,item.id);
        });
      }
      var claim=entry.claim||entry.fulfil&&entry.fulfil.claim;
      if(claim) card.appendChild(el('p','salt-insight','A customer claim is answered through Received on its order, not by approving its row.'));
      var approve=makerButton(card,[siblings.length?'Approve trip':'Approve row','draft.approve'],function(){ approveDraft(draft); },true);
      approve.disabled=!!claim;
      makerButton(card,[siblings.length?'Reject trip':'Reject row','draft.reject'],function(){
        if(!window.confirm(siblings.length?'Reject every row of this trip?':'Reject this Desk row?')) return;
        makerAction('/all/maker/drafts/'+encodeURIComponent(draft.id)+'/reject',{},'Row rejected.','draft:'+draft.id);
      },false);
      makerFoot(card,'draft:'+draft.id);
    });
    (makerData.refused||[]).forEach(function(refused){
      var card=makerCard(draftRoot); card.appendChild(el('h3','','Refused entry'));
      card.appendChild(el('p','salt-insight',refused.why||'This entry was refused by the drafter.'));
    });
    if(!pendingRows.length&&!(makerData.refused||[]).length) draftRoot.appendChild(el('p','rnone','No Desk rows waiting.'));
    if(queueRoot){
      queueRoot.textContent='';
      var held=makerData.queue||[];
      if(!held.length) queueRoot.appendChild(el('p','rnone','No server-held device entries or cloud refusals.'));
      held.forEach(function(entry){
        var card=makerCard(queueRoot), title=entry.state==='refused'?'Refused server entry':'Server-held device entry'; card.setAttribute('data-key',entry.id);
        card.appendChild(el('h4','',title));
        card.appendChild(el('p','maker-facts',entry.id+(entry.date?' · '+entry.date:'')+' · '+entry.state));
        if(entry.device) card.appendChild(el('p','maker-facts','Device '+entry.device));
        if(entry.refusalSource||entry.seenAt)
          card.appendChild(el('p','maker-facts','Refusal source '+(entry.refusalSource||'unknown')
            +(entry.seenAt?' · seen '+entry.seenAt:'')));
        if(entry.why) card.appendChild(el('p','salt-insight',entry.why));
        if(entry.unavailable) card.appendChild(el('p','msg',entry.unavailable));
        if(entry.canWithdraw||entry.canRetry){
          var note=el('p','msg'); note.setAttribute('role','status'); card.appendChild(note);
          var action=makerClaimButton(card,[entry.canRetry?'Finish server withdrawal':'Withdraw server-held entry','queue.withdraw'],function(button){
            if(entry.canWithdraw&&!window.confirm('Withdraw this uploaded entry from the Desk server queue? This does not withdraw an unsent device entry.')) return;
            button.disabled=true;
            refs('/all/maker/queue/'+encodeURIComponent(entry.id)+'/withdraw',{fingerprint:entry.fingerprint})
              .then(function(result){
                var confirmed=result&&result.ok===true&&result.withdrawn===entry.id
                  && (result.state==='withdrawn'&&result.confirmedAbsent===undefined
                    || result.state==='rejected'&&result.confirmedAbsent===true)
                  && (result.again===undefined||result.again===true);
                if(!confirmed) throw new Error('The server did not return a matching withdrawal receipt. Refresh and retry.');
                return loadMaker().then(function(){
                  var current=document.getElementById('makerDraftStatus');
                  if(current) current.textContent=result.state==='rejected'
                    ?'Desk rejection confirmed; server-held entry is gone.'
                    :'Server-held entry withdrawal confirmed.';
                });
              }).catch(function(error){ note.textContent=error.message; button.disabled=false; });
          },false);
          action.classList.add('maker-queue-action');
        }
      });
    }
  }
  function klInputValue(iso){
    if(!iso) return '';
    var d=new Date(iso);
    return new Date(d.getTime()+8*60*60*1000).toISOString().slice(0,16);
  }
  async function loadMakerHours(){
    if(placeNow!=='shop') return;
    try{ makerHours=await refs('/all/maker/hours'); drawMakerHours(); }
    catch(error){ var s=document.getElementById('makerHoursStatus'); if(s) s.textContent=error.message; }
  }
  function drawMakerHours(){
    var root=document.getElementById('makerSchedule'), status=document.getElementById('makerHoursStatus');
    if(!root||!makerHours) return;
    root.textContent='';
    var state=makerHours.status||{};
    status.textContent=(state.open?'Open now':'Closed now. Orders can still be placed; acknowledgement may be delayed.')
      +(state.source==='default'?' · No weekly schedule set.':'');
    var names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var days=(makerHours.config&&makerHours.config.schedule&&makerHours.config.schedule.days)||[];
    var schedule=el('div','maker-hours');
    names.forEach(function(name,i){
      var row=el('div','maker-day'), enabled=actOn(el('input',''),'hours.day-open',name); enabled.type='checkbox'; enabled.checked=!!days[i];
      enabled.setAttribute('aria-label',name+' is open');
      row.appendChild(enabled); row.appendChild(el('span','maker-day-name',name));
      var open=actOn(el('input','fld salt-field__input'),'hours.day-from',name); open.type='time'; open.value=days[i]?days[i].open:'09:00'; open.disabled=!enabled.checked;
      var close=actOn(el('input','fld salt-field__input'),'hours.day-to',name); close.type='time'; close.value=days[i]?days[i].close:'17:00'; close.disabled=!enabled.checked;
      enabled.addEventListener('change',function(){ open.disabled=!enabled.checked; close.disabled=!enabled.checked; });
      row.appendChild(open); row.appendChild(close); row._hours={enabled:enabled,open:open,close:close}; schedule.appendChild(row);
    });
    root.appendChild(schedule);
    makerButton(root,['Save weekly hours','hours.save'],function(){
      var result={days:[]};
      [].forEach.call(schedule.children,function(row){ var d=row._hours; result.days.push(d.enabled.checked?{open:d.open.value,close:d.close.value}:null); });
      return refs('/all/maker/hours',{schedule:result}).then(function(value){ makerHours=value; drawMakerHours(); document.getElementById('makerHoursMessage').textContent='Weekly hours saved.'; })
        .catch(function(error){ document.getElementById('makerHoursMessage').textContent=error.message; });
    },true);
    var override=el('div','maker-fields'), kind=actOn(el('select','fld salt-field__input'),'hours.override-state');
    [['false','Closed'],['true','Open']].forEach(function(x){ var option=el('option','',x[1]); option.value=x[0]; kind.appendChild(option); });
    var until=makerField(override,['Override until (Kuala Lumpur)','hours.override-until'],'datetime-local',klInputValue(makerHours.config&&makerHours.config.manual&&makerHours.config.manual.until));
    override.insertBefore(kind,override.firstChild); root.appendChild(override);
    makerButton(root,['Set temporary override','hours.override-set'],function(){
      var when=Date.parse(until.value+'+08:00');
      if(!Number.isFinite(when)){ document.getElementById('makerHoursMessage').textContent='Choose an end time.'; return; }
      return refs('/all/maker/hours',{manual:{open:kind.value==='true',until:new Date(when).toISOString()}})
        .then(function(value){ makerHours=value; drawMakerHours(); document.getElementById('makerHoursMessage').textContent='Temporary hours saved.'; })
        .catch(function(error){ document.getElementById('makerHoursMessage').textContent=error.message; });
    },false);
    makerButton(root,['Clear temporary override','hours.override-clear'],function(){
      return refs('/all/maker/hours',{clearManual:true}).then(function(value){ makerHours=value; drawMakerHours(); document.getElementById('makerHoursMessage').textContent='Temporary override cleared.'; })
        .catch(function(error){ document.getElementById('makerHoursMessage').textContent=error.message; });
    },false);
  }
  var tiers=[];
  async function loadLinks(quiet){
    var poll=quiet===true;
    if(!poll) moved=null;
    linksBusy=true;
    try{
      var j=await refs('/all/refs'); nGot('links');
      var diff=changed('links',[j.refs,j.tiers]);
      links=j.refs||[]; tiers=j.tiers||[]; linksRead=true;
      if(diff||!poll){ drawLinks(); drawNeeds(); if(!poll) say(''); }
    }
    catch(e){ nGot('links', e); if(!poll) say(e.message,'bad'); }
    finally{ linksBusy=false; }
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
  /* 11 Oct 2026: A MOVE ON A LINK IS SENT ONCE. While it is out the card's move buttons are off, on Needs you and on Links,
     and a second tap, on a button a redraw put in their place, sends nothing. */
  var moving={};
  function moveLock(id, on){
    [].forEach.call(document.querySelectorAll('[data-link="'+id+'"] button[data-move], [data-need="l:'+id+'"] button[data-move]'), function(b){ b.disabled=on; });
  }
  async function moveLink(r, how){
    if(moving[r.id]) return;
    moving[r.id]=true; moveLock(r.id, true);
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
    finally{ delete moving[r.id]; moveLock(r.id, false); }
  }
  /* ---- NEEDS YOU, THE INBOX (S9 9.1, and Phase 1b of 11 Oct 2026) ------------------------------------
     His home: every thing that waits on him, one card each on the system's Action recipe (salt-action, coloured by --salt-sev), ranked
     Now, Soon, Watch and oldest first in each. NOW is a customer waiting: an order placed, a payment they say they sent (on an order or
     against the account), a message asked, an account whose address is refused. SOON is his own work: a Desk row to approve, an entry
     that did not get through, a stage he rejected, a guest link, an ID with no account, accounts nobody has been sent. WATCH is the
     Desk's own count, an override in force and a notice set. A practice item is drawn after the real ones, labelled, and counted nowhere.
     A card is its kind word, who (the code), what, its age, one Open that goes to the detail, and, only where the page already has that
     exact action as one tap, one filled pill that calls the same function with the same guards. NOTHING HERE BOOKS MONEY: Agree, Yes
     received and Cash stay on their cards in Orders, which Open reaches. Read off what the places read anyway (/all/sheet, /all/refs, the
     review, the claims, the threads, the hours and the notice). A tap is answered on its own card. */
  var SEVS=[['now','Now'],['soon','Soon'],['watch','Watch']], SEVC={now:'copper',soon:'brass',watch:'mist'}, NEED_MS=30000;
  var NEED_SRC=[['sheet','accounts'],['links','links'],['review','orders and rows'],['claims','payments'],['threads','messages'],['hours','hours'],['notice','the notice']];
  var nlist=document.getElementById('nlist'), nCount=document.getElementById('nCount'), linksRead=false, linksBusy=false;
  var nKind='all', needSaid={}, nSrc={}, nSeen={}, needN=0, needsAt=0, needsReading=false, needsTimer=null, makerNotice=null, shopReading=false;
  /* each source says it was read, or why it was not, so a read that failed is never taken for an empty inbox */
  function nGot(name, err){ nSrc[name]=err?String(err.message||err):'ok'; }
  /* a read that finds what it found last time draws nothing: each keeps its last answer */
  function changed(name, value){ var s=JSON.stringify(value), was=nSeen[name]!==s; nSeen[name]=s; return was; }
  function codeByUser(u){ var a=OWNER.accounts.filter(function(x){ return x.username===u; })[0]; return (a&&a.code)||u||'An associate'; }
  function hm(iso){ try{ var p=klBits(iso); return p.hour+':'+p.minute; }catch(e){ return ''; } }
  /* C17 (29 Sep 2026): his page's dates are the Counter's one form, DD Mon YYYY */
  function dayMon(iso){ try{ return dmyOf(klBits(iso),'en'); }catch(e){ return ''; } }
  /* a moment today is its time, any other its day */
  function when(iso){ var t=dayMon(iso); return t===dayMon(new Date().toISOString())?hm(iso):t; }
  function andList(xs){ return xs.length<2?xs.join(''):xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1]; }
  function ghost(t, lit){ var L=labOf(t), b=actOn(el('button','salt-ghost'+(lit?' salt-ghost--lit':''),L[0]),L[1],L[2]); b.type='button'; return b; }
  function pill(t){ var L=labOf(t), b=actOn(el('button','salt-pill salt-pill--md',L[0]),L[1],L[2]); b.type='button'; return b; }
  /* an age in the hours a customer has waited: minutes under the first, days from the third */
  function ageOf(iso){
    var t=Date.parse(iso); if(!(t>0)) return '';
    var m=Math.max(0,Math.floor((Date.now()-t)/60000));
    return m<60?m+' min':m<2880?Math.floor(m/60)+' h':Math.floor(m/1440)+' d';
  }
  /* an id that is a moment (a Desk row's is) is its age; any other id is not */
  function isoAt(s){ return /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(String(s||''))?String(s):''; }
  function cut(s){ s=String(s||'').replace(/[ ]+/g,' ').trim(); return s.length>70?s.slice(0,69)+'…':s; }
  function goPlace(place, part){ return function(){ showPlace(place, part, {fresh:true, push:true}); }; }
  /* a card before it is drawn: where it ranks (sev, then age), the chip it answers to (kind), and how it is built. n is the order it was found
     in, which settles a tie. counts false is a card on screen that no longer waits on him. */
  function item(sev, kind, word, key, at, o, tweak){
    return {sev:sev, kind:kind, key:key, at:at||'', practice:!!o.practice, counts:o.counts!==false, n:needN++, make:function(){
      var c=needCard(Object.assign({sev:sev, kind:kind, word:word, key:key, at:at||''}, o));
      if(tweak) tweak(c);
      return c;
    }};
  }
  /* the Action recipe's own parts: the kind word, the body (who and what, then why), the age in the money's place, the way there. A card
     about an account carries data-u, which the pane beside the list is drawn from. c._add puts an action before Open. */
  function needCard(o){
    var c=el('article','salt-action salt-action--'+o.sev+' need'), body=el('div','salt-action__body'), title=el('div','salt-action__title'),
      go=el('div','salt-action__go'), op=null;
    c.setAttribute('data-need', o.key); c.setAttribute('data-kind', o.kind); c.setAttribute('data-sev', o.sev);
    if(o.u) c.setAttribute('data-u', o.u);
    if(o.practice) c.setAttribute('data-practice','');
    c.appendChild(el('span','salt-action__kind',o.word));
    title.appendChild(el('span','need-who',o.who));
    if(o.practice) title.appendChild(chip('mist','Practice'));
    if(o.what) title.appendChild(el('span','need-what',o.what));
    body.appendChild(title);
    if(o.why) body.appendChild(el('p','salt-action__why',o.why));
    c.appendChild(body);
    c.appendChild(el('span','salt-action__money salt-action__money--nil',ageOf(o.at)));
    if(o.open){ op=ghost(['Open','need.open',o.key]); op.addEventListener('click', o.open); go.appendChild(op); }
    c.appendChild(go);
    /* a card with an action of its own sets its ways on a row under the body, so a wide button never squeezes what it says */
    c._body=body; c._add=function(b){ c.classList.add('need--act'); go.insertBefore(b, op); };
    return c;
  }
  function noteOf(c){ var m=el('p','nnote'); m.setAttribute('role','status'); c._body.appendChild(m); return m; }
  /* S9 fix: FROM 1080PX NEEDS YOU STANDS BESIDE AN ACCOUNT (the plan's f13w), as Accounts does: the one he opened
     from a card, else the first card's about an account. The pane is drawn again only when its account changes or
     the sheet is read again, so a redraw of the list never takes a tap in flight off the open card. */
  var nopen=document.getElementById('nopen'), nOpen=null;
  function wide(){ return !!(window.matchMedia&&window.matchMedia('(min-width:1080px)').matches); }
  function openNeed(u){
    if(!wide()){ showPlace('customers','accounts',{fresh:true,push:true}); openCard(u); return; }
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
     (linkId), so a link shared or copied, from any card, is dropped here and the next tap makes a fresh one (his decision 7
     of 11 Oct 2026: nothing is made unasked, so retire makes none); a forwarded link is then ended with the rest. */
  function retire(a, note){
    var u=a.username, was=madeLink[u]; madeLink[u]={note:note};
    if(was&&was.j) markOut(u, was.j);
  }
  function linkButton(a, note){
    var u=a.username, b=pill(['','need.signin-link']);
    function paint(){
      var m=madeLink[u]||{};
      b.disabled=!!m.busy; b.textContent=m.busy?'Making it...':m.j?'Share the link':'Send a sign-in link'; note.textContent=m.note||'';
    }
    /* answered on this button, or on the one a redraw put in its place */
    function after(){ paintPills(u); if(b.isConnected) paint(); else drawNeeds(); }
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
    var who=codeByUser(r.by), done=moved&&moved.id===r.id;
    return item('soon','accounts','Link','l:'+r.id, r.made, {who:who, what:'guest link, made '+when(r.made),
      why:'A link for a friend. It opens nothing until you approve it.', open:goPlace('customers','links'), counts:waitingLink(r)&&!done}, function(c){
      if(done){ noteOf(c).textContent=moved.t; return; }
      if(tiers.length){
        var f=el('div','salt-field'), lab=el('label','salt-field__label','Their friend is quoted'), sel=el('select','fld salt-field__input');
        sel.id='npin'+r.id; lab.htmlFor=sel.id; actOn(sel,'need.link-tier');
        var o0=el('option',null,'Follows '+who); o0.value=''; if(!r.level)o0.selected=true; sel.appendChild(o0);
        /* Ambassador is the floor and never a guest's */
        tiers.slice(1).forEach(function(t){ var o=el('option',null,t); o.value=t; if(r.level===t)o.selected=true; sel.appendChild(o); });
        sel.addEventListener('change', function(){ setLevel(r, sel.value); });
        f.appendChild(lab); f.appendChild(sel); c._body.appendChild(f);
      }
      var ap=pill(['Approve','need.link-approve']), de=ghost(['Decline','need.link-decline']);
      ap.setAttribute('data-move',''); de.setAttribute('data-move','');
      ap.addEventListener('click', function(){ moveLink(r,'approve'); });
      de.addEventListener('click', function(){ moveLink(r,'decline'); });
      c._add(ap); c._add(de);
      saidOn(r, noteOf(c));
    });
  }
  /* S9 fix: WHAT THE BRAKE KNOWS, NOT A LOCKED-OUT CUSTOMER. It refuses the address the misses came from, and
     that may be anybody holding the username, so the card says an address is refused and offers the link that
     lets the customer in if it was them, never that they are shut out. The brake holds fifteen minutes from its last miss (the Worker's
     FAIL_TTL), so its age is read back from the moment it lets go. */
  function lockNeed(a){
    var L=a.locked, s=a.seen, at=L.from>1?L.from+' addresses':'one address', held=Date.parse(L.until);
    return item('now','accounts','Locked','k:'+a.username, held>0?new Date(held-900000).toISOString():'', {who:a.code||a.username, u:a.username, what:'refused at '+at,
      why:'Ten wrong passwords '+(L.from>1?'each ':'')+'from '+at+', refused there'+(L.until?' until '+hm(L.until):'')+'.'
        +' If it was them, a sign-in link lets them in.'
        +(s&&s.opens?' Last got in'+(howOf(s)?' '+howOf(s):'')+', '+dayMon(s.last)+'.':' Has never got in.'),
      open:function(){ openNeed(a.username); }}, function(c){
      c._add(linkButton(a, noteOf(c)));
      /* and Show a code, in person, stage 3's hand-over (showHandover), for a customer at his counter */
      var sc=ghost(['Show a code','need.show-code']); sc.addEventListener('click', function(){ showHandover(a, sc); }); c._add(sc);
    });
  }
  function bareNeed(a){
    var lv=stranger||"stranger's";
    return item('soon','accounts','Account','n:'+a.username, '', {who:a.code||a.username, u:a.username, what:'no account yet', why:waitLine(),
      open:function(){ openNeed(a.username); }}, function(c){
      var sh=pill(['Show the '+lv+' link','need.show-link']), off=ghost(['Send, after the update','need.send-later']);
      off.disabled=true; off.title='No account behind this username yet';
      c._add(sh); c._add(off);
      var note=noteOf(c);
      function openSilver(){
        var r=strangerLink();
        if(!r){ note.textContent='The '+lv+' link is not made yet. Open Links once, then try again.'; return; }
        silverOpen[a.username]=true;
        var box=el('div','glink'), img=document.createElement('img'), cp=ghost(['Copy link','need.copy-link']);
        box.appendChild(el('code','gu',r.url));
        img.src=r.qr; img.alt='QR to the '+lv+' guest price list'; img.width=180; img.height=180; box.appendChild(img);
        cp.addEventListener('click', async function(){
          try{ await navigator.clipboard.writeText(r.url); note.textContent='Copied.'; }catch(e){ note.textContent='Copy failed.'; }
        });
        box.appendChild(cp);
        c._body.insertBefore(box, note); sh.disabled=true;
      }
      sh.addEventListener('click', openSilver);
      if(silverOpen[a.username]) openSilver();
    });
  }
  function sendAt(rows){ return rows.map(function(a){ return a.issued||''; }).filter(Boolean).sort()[0]||''; }
  function sendNeed(rows){
    var codes=rows.map(function(a){ return a.code||a.username; }), first=sendAt(rows);
    var named=codes.length>6?codes.slice(0,5).concat([(codes.length-5)+' more']):codes;
    return item('soon','accounts','Account','s', first, {who:rows.length+' to send', what:first?'ready since '+dayMon(first):'',
      why:andList(named)+(rows.length===1?' has an account':' have accounts')+' and no sign-in yet.', open:function(){ showPlace('customers','accounts',{fresh:true,push:true}); filterBy('unsent'); }}, function(c){
      var go=pill(['Send them in turn','need.send-turn']);
      go.addEventListener('click', function(){ turn={rows:rows.slice(), i:0, sent:[], j:null, why:''}; turnStep(); });
      c._add(go);
    });
  }
  /* ---- THE CARDS OF ORDERS, PAYMENTS, MESSAGES AND ROWS (Phase 1b). Each is what the place it opens shows, found in what that place
     read, so a card and the place it opens never disagree: ordWaits is the Orders part Waiting on you. ---- */
  function ordOpen(o){ return ['placed','acknowledged','ready'].indexOf(o.status)>=0; }
  function ordPays(o){ return ordOpen(o)?(o.payments||[]).filter(function(p){ return p.claim==='waiting'; }):[]; }
  function ordWaits(o){ return orderPartsOf(o).indexOf('orders.waiting')>=0; }
  /* an order's Open goes to Orders > Waiting on you with that order's card open (Phase 1c) */
  function orderOpener(id){ return function(){ showPlace('orders','waiting',{fresh:true, push:true}); openOrder(id); }; }
  function orderWhat(o){ return (o.product||'')+', '+unitsOf(o.qty)+', '+rm(o.total); }
  function waitingClaims(){ return makerClaims.filter(function(c){ return c.state==='waiting'; }); }
  function pendingRows(){ return (makerData&&makerData.drafts||[]).filter(function(d){ return d.status==='pending'; }); }
  /* a Desk row to approve: the same tap, the same question and the same request as Approve row on Record > Approve (approveDraft). A row
     that is a customer's claim is answered through Received on its order, so it has no pill. The answer stays on the card, which is drawn
     from the live row, and outlives it once the row is decided. */
  function rowNeed(d){
    var e=d.entry||{}, claim=e.claim||(e.fulfil&&e.fulfil.claim), sibs=tripRows(d), said=needSaid['d:'+d.id];
    return item('soon','rows','Row','d:'+d.id, isoAt(d.id), {who:e.party||'no code',
      what:[e.type, d.product, d.qty==null?'':unitsOf(d.qty), rm(d.total)].filter(Boolean).join(', '),
      why:claim?'A customer claim is answered through Received on its order, not by approving its row.'
        :sibs.length?'Trip '+tripOf(d)+', '+sibs.length+(sibs.length===1?' row':' rows')+' waiting. One tap decides every row of the trip.':'',
      open:goPlace('record','approve')}, function(c){
      if(!claim){
        var ap=pill([sibs.length?'Approve trip':'Approve row','need.approve-row']);
        ap.disabled=!!makerBusy;
        ap.addEventListener('click', function(){
          ap.disabled=true;
          approveDraft(d).then(function(ok){
            if(ok!==undefined) needSaid['d:'+d.id]={t:makerSaid['draft:'+d.id]||(ok?'Row approved.':'Not approved.'), bad:!ok, who:e.party||'no code'};
            drawNeeds();
          });
        });
        c._add(ap);
      }
      if(said) { var n=noteOf(c); n.textContent=said.t; if(said.bad) n.className+=' bad'; }
    });
  }
  /* a row he has just approved stays where he tapped it, saying what happened, and no longer waits on him */
  function decidedNeed(k, said){
    return item('soon','rows','Row',k, '', {who:said.who, what:'', why:said.t, counts:false, open:goPlace('record','approve')});
  }
  function entryNeed(r, key){
    return item('soon','rows','Entry',key, isoAt(r.at||r.seenAt||r.id), {who:r.party||'Desk', what:'did not get through',
      why:r.why||'This entry was refused by the drafter.', open:goPlace('record','approve')});
  }
  function threadNeed(t){
    var last=t.msgs[t.msgs.length-1];
    return item('now','messages','Message','m:'+t.u, last.at, {who:codeByUser(t.u), what:cut(last.text), practice:!!t.test,
      open:function(){ showPlace('customers','messages',{fresh:true, push:true}); openMakerThread(t.u); }});
  }
  /* the Watch cards: the Desk's own count as it last told this site, an override in force, a notice set */
  function deskNeed(){
    var dn=deskWait.n||0, dAt=deskWait.at?' as at '+when(deskWait.at):'';
    /* S9 9.8 fix: the desk's own Waiting on you count, as fresh as the desk's last read, so it says when that was.
       S9 fix: and in the past tense, saying so, once an order has moved since */
    return item('watch','watch','Desk','w:desk', '', {who:'Desk', why:deskWait.moved
      ?(dn?dn+(dn===1?' thing':' things')+' waited on the desk':'Nothing waited on the desk')+dAt+', and an order has moved since.'
      :(dn?dn+(dn===1?' thing waits':' things wait')+' on the desk':'Nothing waits on the desk')+(dAt?','+dAt:'')+'.'});
  }
  function hoursNeed(m){
    var wd=day3('en')[new Date(Date.parse(m.until)+28800000).getUTCDay()];
    return item('watch','watch','Hours','w:hours', '', {who:'Shop', what:(m.open?'Open':'Closed')+' until '+wd+' '+hm(m.until),
      why:'A temporary override is in force.', open:goPlace('shop','hours')});
  }
  function noticeNeed(lines){
    return item('watch','watch','Notice','w:notice', '', {who:'Shop', what:cut(lines.join(' · ')), why:'A notice is up for every customer.', open:goPlace('shop','notice')});
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
  function turnCard(counts){
    var t=turn, n=t.rows.length, fin=t.i>=n, a=t.rows[t.i];
    var did=t.rows.filter(function(x){ return t.sent.indexOf(x.username)>=0; }).length;
    return item('soon','accounts','Account','s', sendAt(t.rows), {who:fin?'All done':(t.i+1)+' of '+n, what:did+' of '+n+' sent', counts:counts,
      why:fin?(did===n?'Each has their link, and each is ticked sent.':'The ones not ticked are still on Accounts, under Not sent.')
        :(a.code||a.username)+(t.copied?': their message is copied.':t.j?': their link is made. Share it and it is ticked sent.':': making their link.'),
      open:function(){ showPlace('customers','accounts',{fresh:true,push:true}); filterBy('unsent'); }}, function(c){
      var ticks=el('div','achips');
      t.rows.forEach(function(x, k){ var did=t.sent.indexOf(x.username)>=0;
        ticks.appendChild(chip(did?'verdigris':(k===t.i?'brass':'mist'), (x.code||x.username)+(did?', sent':''))); });
      c._body.appendChild(ticks);
      if(fin){ var dn=ghost(['Done','need.turn-done'], true); dn.addEventListener('click', function(){ turn=null; drawNeeds(); }); c._add(dn); }
      else {
        var sh=pill(['','need.turn-share']); sh.textContent=t.copied?'Sent it':'Share'; sh.disabled=!t.j||!!t.busy; sh.addEventListener('click', turnShare);
        var sk=ghost(['Skip','need.turn-skip']); sk.disabled=!!t.busy; sk.addEventListener('click', function(){ if(turn.busy) return; turn.i++; turnStep(); });
        c._add(sh); c._add(sk);
      }
      noteOf(c).textContent=t.why;
    });
  }
  /* every card there is, ranked: Now before Soon before Watch, a real one before a practice one, the oldest first, those with no age last */
  function needItems(){
    var L=[], real=sheetRows.filter(function(a){ return !a.test; }), orders=makerData&&makerData.orders||[];
    needN=0;
    orders.filter(ordWaits).forEach(function(o){
      var who=codeByUser(o.u), t=!!o.test, to=orderOpener(o.id), pays=ordPays(o);
      if(o.status==='placed') L.push(item('now','orders','Order','o:'+o.id, o.at, {who:who, what:orderWhat(o), practice:t, open:to}));
      /* a question of theirs on the order that he has not answered (the Worker's awaitingAnswer), as an account's thread is Now when asked */
      if(orderAsked(o)){
        var last=o.msgs[o.msgs.length-1];
        L.push(item('now','messages','Message','om:'+o.id, last.at, {who:who, what:cut(last.text), why:'On order '+o.id+'.', practice:t, open:to}));
      }
      if(pays.length){
        var sum=pays.reduce(function(s,p){ return s+(+p.amount||0); },0), first=pays.map(function(p){ return p.at||''; }).filter(Boolean).sort()[0]||'';
        L.push(item('now','payments','Payment','p:'+o.id, first, {who:who, what:'says they sent '+rm(sum)+', order '+o.id, practice:t, open:to}));
      }
      if(o.again&&o.again.length) L.push(item('soon','orders','Order','a:'+o.id, o.at, {who:who, what:orderWhat(o),
        why:'A move you rejected waits to be offered again.', practice:t, open:to}));
    });
    waitingClaims().forEach(function(c){
      L.push(item('now','payments','Payment','c:'+c.u+':'+c.id, c.at, {who:codeByUser(c.u), what:'says they sent '+rm(c.amount)+', against the account',
        practice:!!c.test, open:goPlace('orders','waiting')}));
    });
    makerThreads.filter(makerThreadAsked).forEach(function(t){ L.push(threadNeed(t)); });
    real.filter(function(a){ return a.account&&a.locked; }).forEach(function(a){ L.push(lockNeed(a)); });
    var rows=pendingRows();
    rows.forEach(function(d){ L.push(rowNeed(d)); });
    Object.keys(needSaid).filter(function(k){ return !rows.some(function(d){ return 'd:'+d.id===k; }); }).forEach(function(k){ L.push(decidedNeed(k, needSaid[k])); });
    (makerData&&makerData.refused||[]).forEach(function(r, i){ L.push(entryNeed(r, 'x:'+i)); });
    (makerData&&makerData.queue||[]).filter(function(e){ return e.state==='refused'; }).forEach(function(e){ L.push(entryNeed(e, 'q:'+e.id)); });
    /* a link he has just moved stays where he tapped it, saying what happened, and is no longer counted */
    links.filter(function(r){ return waitingLink(r)||(moved&&moved.id===r.id&&!r.standing&&r.by); }).forEach(function(r){ L.push(linkNeed(r)); });
    real.filter(function(a){ return a.account===false; }).forEach(function(a){ L.push(bareNeed(a)); });
    var fresh=real.filter(function(a){ return a.account&&!a.sent&&!(a.seen&&a.seen.opens); });
    if(turn||fresh.length) L.push(turn?turnCard(fresh.length>0):sendNeed(fresh));
    if(deskWait) L.push(deskNeed());
    var manual=makerHours&&makerHours.status&&makerHours.status.source==='manual'&&makerHours.config&&makerHours.config.manual;
    if(manual) L.push(hoursNeed(manual));
    if(makerNotice&&makerNotice.length) L.push(noticeNeed(makerNotice));
    /* within a severity (drawNeeds heads them Now, Soon, Watch): real before practice, then the oldest, then as built */
    return L.sort(function(a, b){
      var d=(a.practice?1:0)-(b.practice?1:0);
      if(d) return d;
      var ta=Date.parse(a.at), tb=Date.parse(b.at);
      if(isFinite(ta)!==isFinite(tb)) return isFinite(ta)?-1:1;
      return (isFinite(ta)&&ta!==tb)?ta-tb:a.n-b.n;
    });
  }
  /* the count on each item of the bars: what waits on him there, a practice item never counted. Shop has none. */
  function drawCounts(items){
    setCount('needs', items.filter(function(i){ return i.sev==='now'&&!i.practice; }).length);
    setCount('orders', (makerData&&makerData.orders||[]).filter(function(o){ return !o.test&&ordWaits(o); }).length+waitingClaims().filter(function(c){ return !c.test; }).length);
    setCount('customers', makerThreads.filter(function(t){ return !t.test&&makerThreadAsked(t); }).length+links.filter(waitingLink).length);
    setCount('record', pendingRows().length);
  }
  function needsReady(){ return NEED_SRC.every(function(s){ return nSrc[s[0]]; }); }
  /* the line under the title: Now and Soon as counted, as at the time of drawing, and what could not be read, so a failed read is never
     taken for nothing waiting */
  function drawLead(items){
    if(!needsReady()){ nCount.textContent='Reading what needs you.'; return; }
    var now=0, soon=0;
    items.forEach(function(i){ if(i.practice||!i.counts) return; if(i.sev==='now') now++; else if(i.sev==='soon') soon++; });
    var bad=NEED_SRC.filter(function(s){ return nSrc[s[0]]!=='ok'; }).map(function(s){ return s[1]; });
    nCount.textContent=(now||soon?[now?now+' now':'', soon?soon+' soon':''].filter(Boolean).join(', '):'Nothing needs you')
      +', as at '+hm(new Date().toISOString())+'.'+(bad.length?' Not read: '+andList(bad)+'.':'');
  }
  function drawNeeds(){
    if(!nlist) return;
    var items=needItems(), shown=items.filter(function(i){ return nKind==='all'||i.kind===nKind; });
    drawCounts(items); drawLead(items);
    nlist.textContent='';
    if(!shown.length&&needsReady()) nlist.appendChild(el('p','rnone',nKind==='all'?'Nothing needs you.':'Nothing here.'));
    SEVS.forEach(function(s){
      var group=shown.filter(function(i){ return i.sev===s[0]; });
      if(!group.length) return;
      var h=el('p','salt-eyebrow salt-eyebrow--'+SEVC[s[0]]+' nsev', s[1]); h.setAttribute('data-sev', s[0]);
      nlist.appendChild(h);
      group.forEach(function(i){ nlist.appendChild(i.make()); });
    });
    drawNeedOpen(false);
  }
  function redrawLead(){ drawLead(needItems()); }
  /* ---- READING WHAT NEEDS YOU, on entering it and every 30 seconds while it is showing. Everything it shows is read from the sources the
     other places read, each guarding its own read: none starts while another of its kind is out, and a poll that finds the same answer
     draws nothing. The sheet and the links are read again only after the page has read them once (it does at opening). ---- */
  function readNeeds(force){
    if(needsReading) return;
    if(!force&&needsAt&&Date.now()-needsAt<NEED_MS) return;
    needsReading=true;
    var jobs=[loadMaker(true), loadMakerClaims(true), loadMakerThreads(true), readShop()];
    if(sheet&&!sheetBusy) jobs.push(loadSheet(true));
    if(linksRead&&!linksBusy) jobs.push(loadLinks(true));
    Promise.all(jobs).then(function(){ needsAt=Date.now(); }, function(){}).then(function(){ needsReading=false; redrawLead(); });
  }
  /* what Watch shows: the hours with an override in force, and the notice */
  async function readShop(){
    if(shopReading) return;
    shopReading=true;
    var apply=false;
    try{ var h=await refs('/all/maker/hours'); nGot('hours'); if(changed('hours', h)){ makerHours=h; apply=true; } }
    catch(error){ nGot('hours', error); apply=true; }
    try{ var b=await refs('/all/maker/bulletin'); nGot('notice'); if(changed('notice', b.lines||[])){ makerNotice=b.lines||[]; apply=true; } }
    catch(error){ nGot('notice', error); apply=true; }
    shopReading=false;
    if(apply) drawNeeds();
  }
  /* THE POLL runs only while Needs you or Orders is showing and the page is visible, and stops the moment either stops. */
  function needsWatch(){
    var on=!document.hidden&&!document.body.classList.contains('ended')&&(placeNow==='needs'||placeNow==='orders');
    if(on&&needsTimer===null) needsTimer=setInterval(tickPlace, NEED_MS);
    else if(!on&&needsTimer!==null){ clearInterval(needsTimer); needsTimer=null; }
  }
  function tickPlace(){
    if(document.hidden||(placeNow!=='needs'&&placeNow!=='orders')){ needsWatch(); return; }
    /* viewing an account as them hides this page (stmt/page.js): nothing is read for a page nobody is looking at, and the read goes on when he is back */
    if(roster.hidden) return;
    if(placeNow==='needs') readNeeds(true);
    else { loadMaker(true); loadMakerClaims(true); }
  }
  document.addEventListener('visibilitychange', function(){ needsWatch(); if(!document.hidden&&needsTimer!==null) tickPlace(); });
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
     next one they are. No margin is in the snapshot, so none can be drawn here.
     F9 REVISED (his answers of 28 Sep 2026): every book's progress, and the reward only where the
     snapshot carries one, a tiered book; any other book draws the progress alone, no reward line. */
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
    }
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
     says what it is for and names the two things he types.
     FOLD 2.7: ITS KEY AND WRAPS ARE MADE HERE, at the 150,000 rounds every account's wraps take, because
     the Worker's runtime refuses PBKDF2 above 100,000 (stmt/worker.js makeTest). The page's own wrapUnder
     does the wrapping, so these open under the same unwrap a customer's page runs; the master stays here. */
  async function testKeys(u){
    var raw=crypto.getRandomValues(new Uint8Array(32));
    var ck=await crypto.subtle.importKey('raw', raw, {name:'AES-GCM'}, true, ['encrypt','decrypt']);
    var body={make:true, u:u, key:b64e(raw), wrap:await wrapUnder(new TextEncoder().encode('0000-0000-0000-0000'), ck)};
    if(OWNER.master) body.wrapMaster=await wrapUnder(new TextEncoder().encode(OWNER.master), ck);
    return body;
  }
  /* TWO TEST ACCOUNTS (his answer of 29 Sep 2026: a second account, not a switch), made and taken away together: one open,
     where a claim of theirs waits so it can order, and one locked, only for paying. The same zeros open both. */
  var TEST_LINE='Password 0000-0000-0000-0000 for both. Username 0000-0000 is a customer who can order; 0000-0001 is locked, only for paying.';
  function drawTest(){
    var box=document.getElementById('mTest'); if(!box) return;
    /* a pair made by halves (a tap cut off between its two sends) keeps Make, for the one missing (Fable's review) */
    var have=sheetRows.filter(function(a){ return a.test; }).map(function(a){ return a.username; });
    var need=['0000-0000','0000-0001'].filter(function(u){ return have.indexOf(u)<0; }), on=!need.length;
    box.textContent='';
    box.appendChild(el('p','lead', on
      ? 'Two test accounts are live. '+TEST_LINE+' They are on no list that counts, and nothing they do is booked.'
      : have.length ? 'Only test account '+have[0]+' is live. One tap makes the other.'
      : 'No test accounts. One tap makes two you can open anywhere, that count nowhere: one that can order, one locked.'));
    var b=el('button','btn quiet salt-ghost', on?'Delete the test accounts':'Make the test accounts'); b.type='button'; actOn(b,'more.test-accounts');
    b.addEventListener('click', async function(){
      b.disabled=true; say(on?'Deleting...':'Making...','wait');
      try{
        if(on) await refs('/all/test',{make:false});
        else for(var i=0;i<need.length;i++) await refs('/all/test',await testKeys(need[i]));
        sheet=null; await loadSheet();
        say(on?'Gone, with everything they wrote.':'Made. '+TEST_LINE+' Their examples appear after the next publish.');
      }catch(e){ say(e.message,'bad'); }
      b.disabled=false; drawTest();
    });
    box.appendChild(b);
  }
  /* a place, an item on More, or a way back: one listener for the whole of his page */
  roster.addEventListener('click', function(ev){
    var bk=ev.target.closest('button[data-back]');
    if(bk){ var way=bk.getAttribute('data-back'); if(way==='accounts') openCard(null); else if(way==='orders') closeOrder(); else if(way==='form') closeForm(); return; }
    var b=ev.target.closest('button[data-m]'); if(b){ showPlace(b.getAttribute('data-m'),'',{fresh:true,push:true}); return; }
    var k=ev.target.closest('button[data-chip]');
    if(k){ nKind=k.getAttribute('data-chip'); [].forEach.call(document.querySelectorAll('.nchips button'), function(x){ x.setAttribute('aria-selected', x===k?'true':'false'); }); drawNeeds(); return; }
    var t=ev.target.closest('button[data-part]'); if(t) showPlace(t.parentNode.getAttribute('data-place'), t.getAttribute('data-part'), {push:true});
  });
  /* the + orb opens Record's menu of entries */
  var oAdd=document.getElementById('oAdd');
  if(oAdd) oAdd.addEventListener('click', function(){ showPlace('record','entry',{fresh:true,push:true}); });
  document.getElementById('afil').addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-f]'); if(b) filterBy(b.getAttribute('data-f'));
  });
  rq.addEventListener('input', drawRoster);
  showPlace('needs','',{fresh:true});
  /* the home itself needs the account list and the links: Needs you is read off both (S9 9.1) */
  loadSheet(); loadLinks();
  /* an address he opened the page on (#orders, #customers/links, the old #maker): the place it names, over the home */
  if(location.hash){
    var first=addrOf(location.hash);
    if(first){
      showPlace(first.place, first.part, {fresh:true});
      try{ history.replaceState(null,'',addrFor(placeNow, partNow)); }catch(e){}
    }
  }
  /* 11 Oct 2026, HIS WORD: SALT ACCOUNT HAS ITS OWN NIGHT OR TIDE, per device. The head script has set the stored theme (Tide until one is
     chosen); the choice Sheet is the customer's (stmt/page.js, lookAsk), asked once when this page opens on a device that holds none, and
     Shop > This device holds the switch. The rest of the look (kept in localStorage salt-look on this origin, applied at once, no
     reload) is the page's own and is shared. An Access lapse, which ended() reads on a request's answer, takes the Sheet down. */
  lookAsk(null, true);
`;
