/* Monthly statements of account, one per customer.
 *
 * WHY THIS DRIVES THE DESK RATHER THAN REIMPLEMENTING IT
 * The statement's rules live in salt_command.html: what a customer may see, what must
 * never travel, how a reconciliation is built. Rewriting any of that here would create
 * a second source of truth that drifts the first time either is touched. So this loads
 * the desk headlessly and calls its OWN stmtRows / stmtRefunds / stmtDoc. If the tab
 * changes, these files change with it and nothing has to be kept in step by hand.
 *
 *   node make_statements.js <deskHtml> <outDir> [YYYY-MM-DD issue date]
 *
 * Requires jsdom on the machine running it. It writes one file per customer who has
 * anything to show, named by code so the folder sorts alphabetically.
 */
const fs=require('fs'), path=require('path');
const jsdomPath=process.env.JSDOM_PATH||'jsdom';
const {JSDOM,VirtualConsole}=require(jsdomPath);

const desk=process.argv[2], outDir=process.argv[3];
const issue=process.argv[4]||new Date().toISOString().slice(0,10);
if(!desk||!outDir){console.error('usage: node make_statements.js <deskHtml> <outDir> [issueDate]');process.exit(2);}

const vc=new VirtualConsole(); const errs=[];
vc.on('jsdomError',e=>{if(!/scrollTo|Not implemented|getContext/.test(e.message))errs.push(e.message);});
/* THE SAME STUBS tools/payload.mjs INSTALLS, and for the same reason: jsdom is not a
   browser and the desk is written for one. matchMedia is the one that bit. The desk
   started asking for it when the rail learned about portrait, and with no stub the whole
   run died on "window.matchMedia is not a function" before a single statement was written.
   Nothing here changes what a statement SAYS: these are the browser's furniture, not the
   desk's rules, and the rules are still read from the desk itself below. */
const dom=new JSDOM(fs.readFileSync(desk,'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,url:'http://localhost/',virtualConsole:vc,
   beforeParse(w){
     const store=new Map();
     const stub={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),
       removeItem:k=>store.delete(k),clear:()=>store.clear(),
       key:i=>[...store.keys()][i]??null,get length(){return store.size;}};
     Object.defineProperty(w,'localStorage',{value:stub,configurable:true});
     Object.defineProperty(w,'sessionStorage',{value:stub,configurable:true});
     /* A statement is a document, never a fetch: the desk must not reach the network to
        write one, and if it tries, that is a fault worth failing on rather than hiding. */
     w.fetch=()=>Promise.reject(new Error('no network while writing a statement'));
     w.matchMedia=w.matchMedia||(()=>({matches:false,media:'',onchange:null,
       addListener(){},removeListener(){},addEventListener(){},removeEventListener(){},
       dispatchEvent(){return false;}}));
     w.scrollTo=()=>{};
     w.HTMLCanvasElement.prototype.getContext=()=>null;   // no chart belongs on a statement
   }});

setTimeout(()=>{
  const w=dom.window;
  if(errs.length){console.error('desk did not load cleanly:',errs.join('|'));process.exit(1);}
  fs.mkdirSync(outDir,{recursive:true});
  const parties=JSON.parse(w.eval('JSON.stringify([...new Set(sales.map(s=>s.customer))].sort())'));
  const issued=new Date(issue+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  let made=0, skipped=[], sheets=[];
  for(const p of parties){
    /* EVERYTHING to date, not just the month: a customer's statement is more use as a
       complete position than as a slice, and it removes the brought-forward problem
       entirely. The month is what the folder records, not what the statement covers. */
    const o={from:null,to:issue,completed:true,open:true,pending:true,
             dates:true,useName:false,brand:'Obsidian Salt',issued:issued};
    const res=w.eval(`(function(){
      const o=${JSON.stringify(o)};
      const rows=stmtRows(${JSON.stringify(p)},o);
      o.refunds=stmtRefunds(${JSON.stringify(p)},o);
      o.recon=stmtRecon(${JSON.stringify(p)},rows).filter(R=>rows.some(x=>x.date===R.order.date));
      if(!rows.length&&!o.refunds.length)return JSON.stringify({skip:true});
      /* the index needs the same totals the statement foots to, so they are taken
         from the same rows rather than recomputed from the ledger */
      /* the index must agree with each statement's own footer: a cancelled order is
         not an order for counting purposes, so it is out of n as well as out of the money */
      const t={n:rows.filter(r=>!r.cancelled).length,qty:0,total:0,paid:0,owed:0,toGet:0,pend:0,cx:0};
      rows.forEach(r=>{if(r.cancelled){t.cx++;return;}
                       t.qty+=r.qty;t.total+=r.total;t.paid+=r.gift?0:(r.paidCash+r.inKind);
                       t.owed+=r.owed;
                       t.toGet+=(r.toGet>0&&!r.pendingOrder)?r.toGet:0;
                       t.pend+=r.pendingOrder?r.total:0;});
      return JSON.stringify({html:stmtDoc(${JSON.stringify(p)},rows,o),n:rows.length,t:t});
    })()`);
    const r=JSON.parse(res);
    if(r.skip){skipped.push(p);continue;}
    const file=path.join(outDir,'statement_'+p.replace(/[^A-Za-z0-9._-]+/g,'-')+'_'+issue+'.html');
    fs.writeFileSync(file,r.html);
    console.log('  '+p.padEnd(14)+r.n+' order'+(r.n===1?'':'s'));
    made++;
    sheets.push({who:p,html:r.html,t:r.t});
  }

  /* ---- THE REVIEW SHEET, for him and not for a customer --------------------
     Twenty-four files is too many to open one by one before sending, so this
     stitches every statement into one page behind an index that says which ones
     need a second look. It carries NOTHING a statement does not: it is the same
     markup inlined, so anything safe to send is safe to review and there is no
     second version of the truth to keep in step. The prefix keeps it first in an
     alphabetical listing, where it belongs. */
  if(sheets.length){
    const esc=x=>String(x==null?'':x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const m2=v=>Number(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
    const n2=v=>Number(v).toLocaleString('en-MY',{maximumFractionDigits:2});
    /* one shared stylesheet, lifted from the first statement so the two can never
       diverge: if the statement is restyled the review sheet follows automatically */
    const css=(sheets[0].html.match(/<style>([\s\S]*?)<\/style>/)||[,''])[1];
    const bodyOf=h=>{const m=h.match(/<body>([\s\S]*?)<\/body>/);return m?m[1]:'';};
    /* PENDING IS ITS OWN STATE, not a quiet 'clear'. An agreed order nobody has acted
       on is the one line most likely to need chasing, so the index says so rather than
       letting it sit among the finished accounts looking settled. */
    const flag=t=>t.owed>0.009?'owes':(t.toGet>0.009?'goods':(t.pend>0.009?'pend':'clear'));
    const rowsIdx=sheets.map(x=>{
      const f=flag(x.t);
      return '<tr class="f-'+f+'"><td class="l"><a href="#s-'+esc(x.who)+'">'+esc(x.who)+'</a></td>'
        +'<td>'+x.t.n+'</td><td>'+n2(x.t.qty)+'</td><td>'+m2(x.t.total)+'</td><td>'+m2(x.t.paid)+'</td>'
        +'<td class="r">'+(x.t.owed>0.009?'<b class="owe">'+m2(x.t.owed)+'</b>':'&mdash;')+'</td>'
        +'<td class="r">'+(x.t.toGet>0.009?'<b class="gd">'+n2(x.t.toGet)+' unit</b>':'&mdash;')+'</td>'
        +'<td class="r">'+(x.t.pend>0.009?'<b class="pd">'+m2(x.t.pend)+'</b>':'&mdash;')+'</td></tr>';
    }).join('');
    const owe=sheets.filter(x=>x.t.owed>0.009), gds=sheets.filter(x=>x.t.toGet>0.009);
    const pnd=sheets.filter(x=>x.t.pend>0.009);
    const sumT=k=>sheets.reduce((a,x)=>a+x.t[k],0);
    const review='<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
      +'<meta name="viewport" content="width=device-width,initial-scale=1">'
      +'<title>Statements to review \u00b7 '+esc(issue)+'</title><style>'+css
      +'\n.rv{max-width:900px;margin:0 auto 40px}'
      +'.rvh{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#ffc75a;font-weight:700;margin:0 0 8px}'
      +'.rvt{margin:0 0 6px;font-size:32px;font-weight:900;letter-spacing:-.015em}'
      +'.rvs{color:#6b7688;font-size:13px;margin:0 0 26px}'
      +'.idx{width:100%;border-collapse:collapse;margin-bottom:14px}'
      +'.idx th{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6b7688;font-weight:700;'
      +'padding:0 10px 9px;text-align:right;border-bottom:1px solid #2a3140}.idx th.l{text-align:left}'
      +'.idx td{padding:10px;border-bottom:1px solid rgba(42,49,64,.5);text-align:right;'
      +'font-variant-numeric:tabular-nums;font-size:13.5px}.idx td.l{text-align:left}.idx td.r{text-align:right}'
      +'.idx a{color:#7fd7e8;text-decoration:none;font-weight:700}.idx a:hover{text-decoration:underline}'
      +'.idx tr.f-owes{background:rgba(255,199,90,.05)}.idx tr.f-goods{background:rgba(127,215,232,.05)}'
      +'.idx tr.f-pend{background:rgba(200,182,255,.05)}'
      +'b.owe{color:#ffc75a}b.gd{color:#7fd7e8}b.pd{color:#c8b6ff}'
      +'.cut{margin:0;border:0;border-top:1px dashed #2a3140;padding:0}'
      +'.slab{max-width:900px;margin:34px auto 6px;font-size:11px;letter-spacing:.24em;'
      +'text-transform:uppercase;color:#6b7688;font-weight:700}'
      +'@media print{.rv,.slab{color:#111}.idx a{color:#0b5f70}.sheet{page-break-after:always}}'
      +'</style></head><body>'
      +'<div class="rv"><p class="rvh">For review, not for sending</p>'
      +'<h1 class="rvt">'+sheets.length+' statements</h1>'
      +'<p class="rvs">Issued '+esc(issued)+'. Every statement below is exactly the file that would go to that '
      +'customer, stitched together so they can be read in one pass. '
      +(owe.length?'<b>'+owe.length+'</b> carr'+(owe.length===1?'ies':'y')+' an outstanding balance':'None carries a balance')
      +(gds.length?', and <b>'+gds.length+'</b> '+(gds.length===1?'is':'are')+' owed goods':'')
      +'.'
      +(pnd.length?' <b>'+pnd.length+'</b> hold'+(pnd.length===1?'s':'')+' an order agreed but not yet '
        +'collected or paid, which is money to chase rather than money owed.':'')
      +'</p>'
      +'<table class="idx"><thead><tr><th class="l">Account</th><th>Orders</th><th>Quantity</th>'
      +'<th>Ordered</th><th>Paid</th><th class="r">Outstanding</th><th class="r">Owed goods</th>'
      +'<th class="r">Not actioned</th></tr></thead>'
      +'<tbody>'+rowsIdx+'</tbody>'
      +'<tfoot><tr><td class="l"><b>All</b></td><td>'+sumT('n')+'</td><td>'+n2(sumT('qty'))+'</td>'
      +'<td>'+m2(sumT('total'))+'</td><td>'+m2(sumT('paid'))+'</td>'
      +'<td class="r"><b class="owe">'+m2(sumT('owed'))+'</b></td>'
      +'<td class="r"><b class="gd">'+n2(sumT('toGet'))+' unit</b></td>'
      +'<td class="r"><b class="pd">'+m2(sumT('pend'))+'</b></td></tr></tfoot></table></div>'
      +sheets.map(x=>'<p class="slab" id="s-'+esc(x.who)+'">'+esc(x.who)+'</p><hr class="cut">'
                    +'<div class="sheet">'+bodyOf(x.html)+'</div>').join('')
      +'</body></html>';
    const rf=path.join(outDir,'_review_'+issue+'.html');
    fs.writeFileSync(rf,review);
    console.log('review sheet: '+rf);
  }

  console.log('\nwrote '+made+' statement'+(made===1?'':'s')+' to '+outDir);
  if(skipped.length)console.log('nothing to show for: '+skipped.join(', '));
  process.exit(0);
},9000);
