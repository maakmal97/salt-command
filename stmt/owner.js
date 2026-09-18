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
  var MPANELS=['review','links'], mHome=document.getElementById('mHome'),
      oReview=document.getElementById('oReview'), oLinks=document.getElementById('oLinks'),
      mBack=null, sheet=null, sheetAt=null;
  function panel(which){
    mHome.hidden=!!which;
    oReview.hidden=(which!=='review');
    oLinks.hidden=(which!=='links');
    say('');
    if(which==='links'&&!links.length) loadLinks();
    if(which==='review'){ drawRoster(); if(!sheet) loadSheet(); try{ rq.focus(); }catch(e){} }
    try{ window.scrollTo(0,0); }catch(e){}
  }
  /* ---- REVIEW STATEMENT --------------------------------------------------------------------
     The list is the roster, so an account with no statement this issue is still on it and says
     so. Everything else comes from /all/sheet. */
  var FLAGW={owes:'Owes',goods:'Owes goods',refund:'Refund due',pend:'Agreed, not actioned',clear:'Clear'};
  function flagLine(a){
    if(!a.t||!a.flag) return 'No statement in this issue.';
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
      sheet={}; sheetAt=j.at||null;
      (j.accounts||[]).forEach(function(a){ sheet[a.username]=a; });
      drawRoster();
    }catch(e){ say(e.message,'bad'); }
  }
  /* ---- THE ROSTER (10 Sep 2026) ------------------------------------------------------------
     A tap fills the customer's own form with his username and the master, and submits it. Nothing
     below the door knows the difference: the Worker answers byMaster, the page unwraps wrapMaster,
     and the statement, the prices and the lock are the customer's own. */
  function openAcct(a){
    if(!OWNER) return;
    if(!OWNER.master){ say('No master passphrase is set on this Worker, so nothing can be opened. Set STMT_MASTER.','bad'); return; }
    if(busy) return;
    un.value=a.username; pw.value=OWNER.master;
    if(whoacct) whoacct.textContent=(a.code||a.username)+' \\u00b7 ';
    var f=document.getElementById('f');
    if(f.requestSubmit) f.requestSubmit();
    else f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
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
      var b=el('button',null,a.code||a.username); b.type='button';
      if(a.code) b.appendChild(el('span',null,a.username));
      if(sheet){
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
  function stampDay(iso){
    try{ return new Date(iso).toLocaleDateString('en-GB',{timeZone:'Asia/Kuala_Lumpur',
      day:'2-digit',month:'short',year:'numeric'}); }catch(e){ return ''; }
  }
  function drawLinks(){
    var glist=document.getElementById('glist');
    glist.textContent='';
    if(!links.length){ glist.appendChild(el('p','rnone','No links yet.')); return; }
    links.forEach(function(r){
      var card=el('div','glink'+(r.revoked?' off':''));
      card.appendChild(el('p','gt','Tier '+r.tier+(r.revoked?' \\u00b7 withdrawn':'')));
      card.appendChild(el('h4',null,r.label||'(no label)'));
      card.appendChild(el('code','gu',r.url));
      card.appendChild(el('p','gs', r.opens
        ? 'opened '+r.opens+' time'+(r.opens===1?'':'s')+', last '+stampDay(r.last)
        : 'never opened \\u00b7 made '+stampDay(r.made)));
      var img=document.createElement('img');
      img.src=r.qr; img.alt='QR to the guest price list for '+(r.label||r.id); img.width=180; img.height=180;
      card.appendChild(img);
      var row=el('div','grow');
      var copy=el('button',null,'Copy link'); copy.type='button';
      copy.addEventListener('click', function(){
        try{ navigator.clipboard.writeText(r.url); copy.textContent='Copied'; }
        catch(e){ copy.textContent='Copy failed'; }
        setTimeout(function(){ copy.textContent='Copy link'; }, 1500);
      });
      var rev=el('button',null,r.revoked?'Restore':'Withdraw'); rev.type='button';
      rev.addEventListener('click', function(){ moveLink(r, r.revoked?'restore':'revoke'); });
      row.appendChild(copy); row.appendChild(rev); card.appendChild(row);
      glist.appendChild(card);
    });
  }
  async function refs(path, body){
    var o = body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)}
                 : {};
    var r = await fetch(path, o);
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok||!j.ok) throw new Error(j.error||'that did not work');
    return j;
  }
  async function loadLinks(){
    try{ links=(await refs('/all/refs')).refs||[]; drawLinks(); say(''); }
    catch(e){ say(e.message,'bad'); }
  }
  async function moveLink(r, how){
    try{
      var j=await refs('/all/refs/'+r.id+'/'+how);
      for(var i=0;i<links.length;i++) if(links[i].id===j.ref.id) links[i]=j.ref;
      drawLinks(); say('');
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
  mHome.addEventListener('click', function(ev){
    var b=ev.target.closest('button[data-m]'); if(!b) return;
    panel(b.getAttribute('data-m'));
  });
  [].slice.call(document.querySelectorAll('button[data-back]')).forEach(function(b){
    b.addEventListener('click', function(){ panel(null); });
  });
  rq.addEventListener('input', drawRoster);
  panel(null);
`;
