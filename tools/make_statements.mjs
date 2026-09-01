/* Monthly statements of account, one per customer, built from the book and the engine.
 *
 * WHERE THE STATEMENT RULES LIVE NOW, AND WHY THAT CHANGED (29 Aug 2026)
 * Until v388 they lived in the desk (stmtRows, stmtRecon, stmtRefunds, stmtDoc), and this
 * tool loaded the desk headlessly and called them, so there was one copy. v388 removed the
 * desk's statement panel and all five functions on his instruction, recorded as uncalled;
 * this tool called four of them, and broke. With the desk's copy gone, the one home of the
 * statement rules is THIS FILE: the four functions below are the desk's own text at v387,
 * lifted verbatim, with exactly two substitutions, each marked where it sits:
 *   - txStat and txDates come from engine/position.mjs, the same module the desk runs, so
 *     every figure on a statement is still the desk's own arithmetic and cannot drift;
 *   - the who-line is codes-only, because the desk-era useName option read the laptop's
 *     plaintext directory, which never reaches this repo.
 * What lives here alone is the statement's own law: what a customer may see and how the
 * document reads. Nothing else in the repo states it, so this is one copy, not a second.
 * IF THE DESK EVER REGAINS A STATEMENTS PANEL, inline this file the way tools/engine.mjs
 * inlines the engines, so it goes back to being one copy there too.
 *
 *   node tools/make_statements.mjs <outDir> [YYYY-MM-DD issue date]
 *
 * No dependencies: plain node, no jsdom, no network. It writes one file per customer who
 * has anything to show, named by code so the folder sorts alphabetically, plus the review
 * sheet. SALT_BOOK overrides the book path, which is how the tests run it on copies.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import POSITION_ENGINE from "../engine/position.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BOOK = process.env.SALT_BOOK || resolve(REPO, "ledger", "book.json");
const book = JSON.parse(readFileSync(BOOK, "utf8"));

/* the desk globals the lifted functions read, bound to the same sources the desk binds
   them to: the book's own declarations, and the position engine's own functions */
const sales = book.sales;
const customerRefunds = book.customerRefunds || [];
const { txStat, txDates } = POSITION_ENGINE;
const esc = x => ('' + (x == null ? '' : x)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const codeOf = n => n; /* the desk's codeOf is newIds[n]||n and newIds is {} post-rekey: identity */

/* ============ STATEMENT OF ACCOUNT (v183) ============
   A customer asked for his own record, so the desk can now hand one over. This is the
   only artefact that leaves the desk describing a NAMED party's dealings, and the whole
   design is about what it must NOT contain.

   THE RULE: STRUCTURED FACTS ONLY, NEVER THE SELLER'S PROSE.
   Every note in this ledger is written for him, not for the buyer, and several are about
   his own bookkeeping: "recorded as 9.47 delivered in error", "the RM200 booked as
   received was NEVER PAID", "delivery audit", "account audit". None of that is the
   customer's business, and no filter over free text is safe enough to be trusted with
   it. So the statement is BUILT rather than copied: date, quantity, unit price, total,
   what was paid and when, what was collected and when, what remains. Nothing else.

   NEVER LEAVES THE DESK, at any setting:
     cost, margin, margin %       what the salt cost and what it earned
     shrinkage, replacement cost  the desk's own economics
     tier names, floors, cards    the pricing structure behind the number he paid
     any other party              codes, names, or the fact that they exist
     internal notes and audits    every free-text field on the order
   A test greps a generated statement for each of these before it can be trusted.

   WHAT HE ALREADY KNOWS, and therefore may have: what he ordered, what he agreed to
   pay, what he handed over and when, what he collected and when, and what is still
   between them. A settlement in kind is included because he agreed to it, but stated as
   an amount and a date rather than with the reasoning that sits behind it here. */
function stmtRows(party,o){
  o=o||{};
  const from=o.from?new Date(o.from):null, to=o.to?new Date(o.to):null;
  return sales.filter(s=>s.customer===party).filter(s=>{
    const d=new Date(s.date);
    const st=txStat(s).order;
    /* A PENDING ORDER IGNORES THE DATE WINDOW (v194). It is an open commitment, not an
       event in a period, and it is still open on the day the statement is issued whatever
       date sits on it. Leaving it to the window made inclusion arbitrary: CA5-KER's
       pending order is dated 28 Jul so it appeared, CI4-OKR's is dated 03 Aug so the
       02 Aug cut-off silently dropped it, and two customers in the same position got
       different statements for no reason either of them could see. An order the customer
       agreed to and has not yet acted on belongs on his statement, full stop. */
    if(st!=='Pending'){
      if(from&&d<from)return false;
      if(to&&d>to)return false;
    }
    if(st==='Pending'&&!o.pending)return false;
    if(st==='Completed'&&!o.completed)return false;
    if(st!=='Pending'&&st!=='Completed'&&!o.open)return false;
    return true;
  }).sort((a,b)=>new Date(a.date)-new Date(b.date)).map(s=>{
    const st=txStat(s), d=txDates(s);
    const paidCash=+(s.cash||0), inKind=+(s.settledRM||0);
    const got=+(s.deliveredQty||0), inKindUnits=+(s.settledKg||0);
    const owed=+(s.total-paidCash-inKind).toFixed(2);
    /* a cross-reference is included ONLY when it points at another of HIS OWN orders;
       anything pointing elsewhere is another party's business and is dropped */
    const links=[];
    (s.amend||[]).forEach(a=>{
      (a.refKeys||[]).forEach(k=>{
        const m=/^([^|]+)\|([^|]+)\|/.exec(k||'');
        if(m&&m[1]===party)links.push(m[2]);
      });
    });
    /* A GIFT MUST NOT READ AS A CHARGE (v187). Goodwill salt is booked in-kind at a
       value so it does not fall out of the ledger as shrinkage, but the customer never
       owed that money and showing him an amount he did not pay invites the exact
       question the statement exists to prevent. So it carries nil and says why. */
    /* v432, ROUND TEN: A GIFT IS A ROW THE CUSTOMER PAID NOTHING FOR, and the rebate flag alone
       does not say that. It says the order was settled by redeeming an award, and an award can
       settle PART of an order: three live rows are part cash and part award, s025 at RM 17 against
       RM 107, s053 at RM 90 against RM 180, s068 at RM 160 against RM 240. Reading the flag as "the
       whole row was free" printed each of them as nil and "no charge", and dropped BOTH the charge
       and the customer's own cash out of the footer: RM 527 of charges and RM 267 of money they had
       actually paid, on statements that go to them. CI4-OKR's document said an order he paid RM 90
       for was free.
       AND goodwill IS THE OTHER HALF OF THE SAME RULE. It is a separate flag in the engine's own
       correctable table, the walk drops those rows from revenue, and the editor's hint says
       "excluded from revenue everywhere"; the tool read only rebate, so a goodwill gift with no
       rebate beside it would have been billed at full value. The only goodwill row on the book
       today carries rebate as well, which is what has been hiding it. */
    const gift=(!!s.rebate||!!s.goodwill)&&paidCash<=0.009;
    /* v432: THE ROW CARRIES ITS OWN rid. Nothing on the document prints it, but without it a
       statement row cannot be traced back to the book row it came from, and any check over these
       figures has to match on party, date and quantity: CH4-MLR has two orders on 14 August of one
       unit each, RM 110 and RM 11.50, so that match is ambiguous on this very book and the first
       assertion written over it reported a correct statement as wrong. */
    return {rid:s.rid||null,gift:gift,date:s.date,qty:s.qty,total:gift?0:s.total,
      unit:s.qty>0?+(s.total/s.qty).toFixed(2):0,
      paidCash:paidCash,inKind:inKind,got:got,inKindUnits:inKindUnits,
      /* PENDING COUNTS NOWHERE, on a statement as everywhere else (v189). An order
         agreed with nothing paid and nothing collected is an intention, not a debt, and
         showing its value as OUTSTANDING would tell a customer he owes money for salt he
         has never received. The desk has run on that rule since v111; the statement was
         quietly breaking it, and these go out to people. */
      owed:(st.order==='Pending'||st.order==='Cancelled')?0:(owed>0.009?owed:0),
      pendingOrder:st.order==='Pending',
      /* A CANCELLED ORDER IS NOT A BILL (v193). txStat has returned 'Cancelled' since
         long before statements existed, and stmtRows simply never asked. So CC5-OKR's
         20 Jul order -- agreed at RM90, cancelled the next day with nothing moved either
         way, and carrying the note "counts nowhere" -- came out of the statement builder
         as RM90 outstanding and 1 unit owed. It stays on the page, because he agreed to
         it and remembers it, and a statement that silently drops it invites the question
         it exists to answer. But it counts in nothing. */
      cancelled:st.order==='Cancelled',
      /* v433, ROUND TEN: THE BOOK STORES THIS DATE IN TWO PLACES AND THE TOOL READ ONE. A row
         cancelled through the amendment trail carries a Cancellation step; a row cancelled by a
         Correction carries a top-level cancelledOn and no trail at all. Three of the five cancelled
         rows on the book are the second kind, and two of those carry no order date either, so the
         customer received a struck-through quantity, an amount and the bare word cancelled against
         an order he had no way to identify. The trail wins where both exist, because a folded step
         is the event and the field is the summary of it. */
      cancelledOn:(st.order==='Cancelled'
        ? (((s.amend||[]).filter(a=>a.kind==='Cancellation')[0]||{}).date||s.cancelledOn||null) : null),
      /* AGREED ON IS EXPOSED BECAUSE AN UNDATED PENDING ROW HAS NO OTHER DATE (his ruling,
         1 Sep 2026). It is not a substitute for `date` and must not be used as one: on
         three of its four rows on the book it sits beside `date` and equals it, so it is
         its own fact rather than a fallback. Only the date CELL of an undated row reads
         it, and only because such a row otherwise reaches a customer with no date at all. */
      agreedOn:s.agreedOn||null,
      credit:owed<-0.009?-owed:0,
      /* WHAT HE IS OWED IN SALT, which is the figure a dispute actually turns on.
         deliverable = ordered LESS anything withheld by agreement to settle an earlier
         balance; toGet = deliverable LESS what he has already carried away. */
      deliverable:+(s.qty-inKindUnits).toFixed(4),
      toGet:+(s.qty-got-inKindUnits).toFixed(4),
      paidOn:d.pOn||null,gotOn:d.dOn||null,
      state:gift?'No charge'
            :st.order==='Pending'?'Agreed, nothing moved yet'
            :(owed>0.009?'Balance outstanding'
              :(+(s.qty-got-inKindUnits).toFixed(4)>0.009?'Paid in full'
                :'Settled')),
      links:[...new Set(links)]};
  });
}
/* ============ THE RECONCILIATION (v186) ============
   A statement that states a figure is no use in a dispute; one that SHOWS how the figure
   was reached settles it. When salt has been withheld to clear an earlier money balance,
   the customer cannot check the result without seeing the whole chain: which orders were
   short, by how much, what those shortfalls came to, and the rate at which that money was
   turned into salt.
   So this reconstructs it from the ledger rather than from anyone's memory. The Linked
   step carries refKeys pointing at the orders it settled; each of those is read for what
   was billed and what was actually paid, and the difference is the shortfall. The rate is
   then derived by division rather than quoted, so it cannot disagree with the figures
   above it.
   IT REVEALS THE UNIT RATE, and that is a deliberate reversal of v184. You cannot prove a
   conversion from money into goods without naming the rate used. It appears ONLY inside a
   reconciliation, only for the order that carries the offset, and it is his own rate. */
function stmtRecon(party,rows){
  const out=[];
  sales.filter(s=>s.customer===party&&(s.settledKg||0)>0.0001).forEach(s=>{
    const unitsOff=+s.settledKg;
    const keys=[];
    (s.amend||[]).forEach(a=>{(a.refKeys||[]).forEach(k=>{if(k&&k.indexOf(party+'|')===0)keys.push(k);});});
    const legs=[...new Set(keys)].map(k=>{
      const t=sales.find(x=>x.customer+'|'+x.date+'|'+x.total===k);
      if(!t)return null;
      const billed=+t.total, paidCash=+(t.cash||0);
      return {date:t.date,qty:t.qty,billed:billed,paid:paidCash,short:+(billed-paidCash).toFixed(2)};
    }).filter(Boolean).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const shortTot=+legs.reduce((a,x)=>a+x.short,0).toFixed(2);
    const rate=unitsOff>0?+(shortTot/unitsOff).toFixed(2):0;
    const collected=+(s.deliveredQty||0);
    /* NOT EVERY OFFSET IS AGAINST AN EARLIER ORDER (v192). This walk was written for
       the case where salt was withheld to clear unpaid balances on previous SALES, and
       it assumes those sales exist. CS6-PER's 6.5 unit went against a cash advance,
       which is not in the sales ledger at all, so the walk found no legs and printed a
       table of zeros: "carried forward 0.00", "0.00 at 0.00 a unit is 6.5 unit". That
       is not merely ugly, it is unintelligible, and it was in a file about to be sent.
       So the no-leg case is flagged here and told plainly rather than tabulated. */
    out.push({order:{date:s.date,qty:s.qty,total:s.total,paid:+(s.cash||0)},
      noLegs:legs.length===0,
      legs:legs,shortTot:shortTot,unitsOff:unitsOff,rate:rate,
      deliverable:+(s.qty-unitsOff).toFixed(4),
      collected:collected,
      owed:+(s.qty-unitsOff-collected).toFixed(4),
      payments:(s.amend||[]).filter(a=>+a.cash>0.009).map(a=>({date:a.date,rm:+a.cash}))});
  });
  return out;
}
/* A REFUND IS SOMETHING HE KNOWS ABOUT (v188), and the statement had no line for it.
   If he overpaid and money came back, that is his record as much as any order, and a
   statement that omits it is incomplete in the one direction that favours the seller. */
function stmtRefunds(party,o){
  o=o||{};
  const from=o.from?new Date(o.from):null, to=o.to?new Date(o.to):null;
  return (typeof customerRefunds!=='undefined'?customerRefunds:[])
    .filter(r=>r.party===party)
    .filter(r=>{const d=new Date(r.since);
      if(from&&d<from)return false; if(to&&d>to)return false; return true;})
        /* v454: WHICH KIND OF REFUND. v444 books a cancelled paid order as a payable in this same
       list, so the document has to say which it is printing: the two live rows are overpayments
       and the label was fixed text. The record carries the cancelled row's rid, and the note
       names it; either says cancelled. */
    .map(r=>({date:r.since,amount:+r.amount,paidOn:r.paidOn||null,
      cancelled:!!((r.rid&&sales.some(s=>s.rid===r.rid&&s.cancelled))||/^cancelled order/.test(r.note||''))}));
}
function stmtDoc(party,rows,o){
  /* LESS, AND BETTER LOOKING (v184). The first cut carried a price-per-unit column and a
     running prose commentary on every line: paid this, collected that, settled together
     with the order of such a date. All of it was true and none of it was wanted. A
     customer opening this wants three things -- WHAT he took, WHEN, and HOW MUCH -- and
     every extra column asks him to work out which ones matter.
     The unit price is gone with the rest. It told him nothing he did not know and it
     made his own rate legible in a single portable document, which is the sort of thing
     that ends up beside another buyer's. Totals say what he paid; the arithmetic behind
     them is his to do if he wants it. */
  const e=esc, n2=v=>Number(v).toLocaleString('en-MY',{maximumFractionDigits:2});
  const money=v=>Number(v).toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
  const refundOwed=(o.refunds||[]).filter(r=>!r.paidOn).reduce((a,r)=>a+(+r.amount||0),0);   // v454
  /* AN UNDATED ROW PRINTS AN EMPTY CELL, NOT "Invalid Date" (29 Aug 2026, the one
     behavioural change from the v387 text). The book now carries undated rows (a
     cancelled order with no action date, an agreed order not yet moved), and the v387
     formatter pushed "Invalid Date" onto a document meant for a customer. The state
     column already says what such a row is; the date cell stays quiet. Whether it
     should instead show the row's cancelledOn or agreedOn is his call, not made here. */
  const dLong=d=>{try{const t=new Date(d);if(!d||isNaN(t))return '';return t.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});}catch(x){return d;}};
  /* CODES ONLY, ALWAYS: the one substitution in this lifted block. The desk-era useName
     option read the laptop's plaintext directory, which never reaches this repo (hard
     rule 2), so the path is removed rather than parameterised: a statement built here
     cannot carry a real name because nothing here holds one. */
  const who=codeOf(party);
  const T={qty:0,total:0,paid:0,owed:0};
  T.toGet=0;T.kindUnits=0;T.got=0;T.ordered=0;
  /* a GIFT is not a payment. Its in-kind value exists so the salt does not fall out of
     the ledger as shrinkage; counting it here made Paid exceed the total ordered, which
     is the one arithmetic a reader would certainly catch. */
  T.pendQty=0;T.pendVal=0;T.pendN=0;
  T.cxN=0;T.cxPaid=0;
  rows.forEach(r=>{
    /* a cancelled order contributes NOTHING: not quantity, not value, not the count of
       orders. Anything else makes the footer disagree with the word "cancelled". */
    /* v454: EXCEPT THE MONEY THEY PAID ON IT, which is real and is theirs. Dropping the row whole
       told a customer who had paid RM 450 for an order later cancelled that they had paid RM 450
       less than they had, and said Balance nil beneath a refund still owed to them. Paid is what
       they handed over; the cancelled part is named on its own line, and the refund the engine
       booked at v444 is stated as Owed to you rather than left to the Refunds table alone. */
    if(r.cancelled){T.cxN++;T.cxPaid+=r.gift?0:(r.paidCash+r.inKind);T.paid+=r.gift?0:(r.paidCash+r.inKind);return;}
    if(r.pendingOrder){T.pendQty+=r.qty;T.pendVal+=r.total;T.pendN++;}
    T.qty+=r.qty;T.total+=r.total;T.paid+=r.gift?0:(r.paidCash+r.inKind);T.owed+=r.owed;
    T.toGet+=(r.toGet>0&&!r.pendingOrder)?r.toGet:0;T.kindUnits+=r.gift?0:r.inKindUnits;T.got+=r.got;T.ordered+=r.qty;});
  /* the row label has to agree with the walk printed below it. Where the offset went
     against a separate arrangement rather than an unpaid earlier order, calling it an
     "earlier balance" contradicts the explanation three inches further down the page. */
  const noLegDates=new Set((o.recon||[]).filter(R=>R.noLegs).map(R=>R.order.date));
  const body=rows.map(r=>{
    const due=r.owed>0.009;
    const when=(o.dates&&r.paidOn&&r.paidOn!==r.date)?'<div class="sub2">paid '+e(dLong(r.paidOn))+'</div>':'';
    /* THE DATE CELL OF AN UNDATED ROW CARRIES THE DATE THE ROW DOES HAVE (his ruling,
       1 Sep 2026). Three rows on the book carry no `date`: two cancelled, one agreed and
       not yet actioned. Until 29 Aug that cell printed "Invalid Date" on a document sent
       to a customer; it then printed nothing, which is honest and still leaves CY2-NIL
       reading an order with NO DATE ANYWHERE ON THE ROW, because a pending row's status
       says only "ordered".
       IT IS MARKED, because a bare date in that column reads as the date the order was
       placed and this is not that: it is when the order was cancelled, or when it was
       agreed. The word travels with the date for exactly that reason.
       AND IT IS NOT PRINTED TWICE. A cancelled row already carries its cancellation date
       under the status word, so where the date has moved into the cell the sub-line goes:
       the same date stated twice in one row invites the reader to look for the difference
       between them. A row that HAS a `date` is untouched, sub-line and all. */
    const moved=!r.date?(r.cancelled&&r.cancelledOn?'cancelled '+e(dLong(r.cancelledOn))
                        :(r.pendingOrder&&r.agreedOn?'agreed '+e(dLong(r.agreedOn)):'')):'';
    /* nor is it goods owed: nothing has been paid for, so nothing is being withheld */
    const owedUnits=r.toGet>0.009&&!r.pendingOrder;
    let stat;
    /* "no charge" and not "goodwill": the same flag covers a gift AND a reseller's
       EARNED reward, and calling an earned reward a gift misdescribes it to the one
       person who knows better. The customer knows which of the two his was. */
    if(r.cancelled)stat='<span class="cx">cancelled</span>'
      +((r.cancelledOn&&!moved)?'<div class="owedunits">'+e(dLong(r.cancelledOn))+'</div>':'')
      +((r.paidCash+r.inKind)>0.009?'<div class="owedunits">'+money(r.paidCash+r.inKind)+' paid, see Refunds</div>':'');
    else if(r.gift)stat='<span class="gift">no charge</span>';
    /* AN AGREED ORDER IS NOT A SETTLED ONE (v189). Nothing has been paid and nothing
       collected, so it is neither a debt nor a closed line. It still belongs on the
       statement, because he agreed to it and will be asked for the money in due course,
       but it must read as what it is: outstanding on BOTH sides, owing nothing yet. */
    else if(r.pendingOrder)stat='<span class="pend">ordered</span>'
      +'<div class="owedunits">to be collected and paid</div>';
    else if(due)stat='<span class="due">'+money(r.owed)+' due</span>';
    else if(owedUnits)stat='<span class="ok">paid in full</span><div class="owedunits">'+n2(r.toGet)+' unit still to collect</div>';
    else stat='<span class="ok">settled</span>';
    return '<tr>'
      +'<td class="l dt">'+(r.date?e(dLong(r.date)):(moved?'<span class="nodt">'+moved+'</span>':''))+when+'</td>'
      +'<td class="q'+(r.cancelled?' cxr':'')+'">'+n2(r.qty)+'<span class="u">unit</span>'
        +(r.inKindUnits>0.009?'<div class="sub2">'+n2(r.inKindUnits)+' unit applied '
          +(noLegDates.has(r.date)?'by agreement':'to an earlier balance')+'</div>':'')
        +'</td>'
      +'<td class="amt'+(r.cancelled?' cxr':'')+'">'+(r.gift?'<span class="nilamt">nil</span>':money(r.total))+'</td>'
      +'<td class="r">'+stat+'</td></tr>';
  }).join('');
  return ['<!DOCTYPE html>','<html lang="en"><head><meta charset="utf-8">',
   '<meta name="viewport" content="width=device-width,initial-scale=1">',
   '<meta name="robots" content="noindex,nofollow">',
   '<title>Statement of account</title>','<style>',
   '*{box-sizing:border-box}',
   'body{margin:0;padding:44px 20px 60px;background:#0f1115;color:#eef1f6;',
   'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Lato,Roboto,Helvetica,Arial,sans-serif;',
   'font-size:15px;line-height:1.55;-webkit-text-size-adjust:100%}',
   '.w{max-width:600px;margin:0 auto}',
   '.eyebrow{font-size:11px;letter-spacing:.34em;color:#7fd7e8;font-weight:700;margin:0 0 8px}',
   'h1{margin:0;font-size:30px;font-weight:900;letter-spacing:-.015em;line-height:1.1}',
   '.meta{color:#6b7688;font-size:13px;margin:10px 0 0}',
   '.who{margin:26px 0 4px;font-size:19px;font-weight:700;color:#eef1f6}',
   '.whol{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#6b7688;font-weight:700}',
   '.rule{height:1px;background:#2a3140;margin:26px 0 4px}',
   'table{width:100%;border-collapse:collapse}',
   'th{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#6b7688;font-weight:700;',
   'padding:0 0 10px;text-align:right}th.l{text-align:left}',
   'td{padding:15px 0;border-bottom:1px solid rgba(42,49,64,.55);text-align:right;',
   'font-variant-numeric:tabular-nums;vertical-align:top}',
   'td.l{text-align:left}',
   '.dt{font-size:15px;color:#eef1f6}',
   '.sub2{font-size:12px;color:#6b7688;margin-top:3px}',
   '.nodt{font-size:13px;color:#8a93a3;font-style:italic}',
   '.q{font-size:15px;color:#b9c2d0}.u{font-size:11px;color:#6b7688;margin-left:4px}',
   '.amt{font-size:16px;font-weight:700}',
   '.ok{font-size:12px;color:#5fd6a0;letter-spacing:.02em}',
   '.due{font-size:13px;font-weight:700;color:#ffc75a;white-space:nowrap}',
   '.tot{margin-top:30px}',
   '.tr{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;',
   'font-size:14px;color:#b9c2d0}',
   '.tr span:last-child{font-variant-numeric:tabular-nums;color:#eef1f6}',
   '.tr.big{margin-top:10px;padding-top:16px;border-top:1px solid #2a3140;font-size:19px;font-weight:800}',
   '.tr.big span:last-child{color:#ffc75a}',
   '.tr.big.clear span:last-child{color:#5fd6a0}',
   '.tr.sub{color:#9aa4b6;font-size:13px}',
   '.cxn{color:#7f8a9c;font-weight:600}',
   '.cx{color:#7f8a9c;font-weight:800;font-size:13px;letter-spacing:.02em}',
   '.cxr{text-decoration:line-through;text-decoration-thickness:1px;opacity:.5}',
   '.pend{color:#c8b6ff;font-weight:800;font-size:13px;letter-spacing:.02em}',
   '.owedunits{font-size:12px;color:#7fd7e8;margin-top:4px;font-weight:600;white-space:nowrap}',
   '.gift{font-size:12px;color:#b07cff;letter-spacing:.02em;white-space:nowrap}',
   '.nilamt{color:#6b7688;font-weight:400}',
   '.owed{margin-top:26px;border:1px solid #2a5560;border-radius:12px;padding:20px 22px;',
   'background:linear-gradient(180deg,rgba(18,40,46,.75),rgba(15,26,30,.75))}',
   '.owedl{margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7fd7e8;font-weight:700}',
   '.owedv{margin:6px 0 0;font-size:34px;font-weight:900;color:#7fd7e8;letter-spacing:-.02em;',
   'font-variant-numeric:tabular-nums}',
   '.owedv span{font-size:15px;font-weight:600;margin-left:5px;color:#9fc9d4}',
   '.owedn{margin:12px 0 0;font-size:12px;color:#8fb3bd;line-height:1.6}',
   '.rec{margin-top:26px;border:1px solid #2a3140;border-radius:12px;padding:22px 22px 8px}',
   '.recl{margin:0 0 18px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#7d879a;font-weight:700}',
   '.stp{display:flex;gap:14px;margin-bottom:20px}',
   '.stpn{flex:0 0 22px;height:22px;border-radius:50%;border:1px solid #3a4356;color:#7fd7e8;',
   'font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1}',
   '.stpb{flex:1 1 auto;min-width:0}',
   '.stpt{margin:0;font-size:14px;font-weight:700;color:#eef1f6;line-height:1.45}',
   '.stpd{margin:7px 0 0;font-size:13px;color:#8a93a3;line-height:1.6}',
   'table.mini{width:100%;border-collapse:collapse;margin-top:10px}',
   'table.mini th{font-size:10px;letter-spacing:.14em;padding:0 0 6px;color:#6b7688}',
   'table.mini td{padding:7px 0;font-size:13px;border-bottom:1px solid rgba(42,49,64,.45);color:#b9c2d0}',
   'table.mini tr.tot td{border-bottom:0;border-top:1px solid #2a3140;font-weight:800;color:#eef1f6;padding-top:9px}',
   'table.mini tr.sub td{border-bottom:0;color:#eef1f6;font-weight:700}',
   'table.mini.calc td{font-size:13px}',
   'b.short{color:#ffc75a}',
   '.recn{margin:2px 0 16px;font-size:12px;color:#8a93a3;line-height:1.6;border-top:1px solid rgba(42,49,64,.5);padding-top:14px}',
   '.note{margin-top:34px;font-size:12px;color:#6b7688;line-height:1.65}',
   '@media print{body{background:#fff;color:#111;padding:24px}',
   '.eyebrow{color:#0b5f70}.q{color:#444}.ok{color:#186b45}.due{color:#8a5b00}',
   '.nodt{color:#555}',
   '.tr span:last-child{color:#111}.tr.big span:last-child{color:#8a5b00}',
   '.tr.big.clear span:last-child{color:#186b45}td{border-color:#ddd}.rule{background:#ccc}',
   '.owed{background:#f2f8fa;border-color:#9dc4cf}.owedl,.owedv{color:#0b5f70}',
   '.owedv span,.owedn{color:#3d6d78}.owedunits{color:#0b5f70}.gift{color:#5a3d8a}}',
   '</style></head><body><div class="w">',
   '<p class="eyebrow">'+e(o.brand||'Salt Command')+'</p>',
   '<h1>Statement of account</h1>',
   /* the period line has to survive the reader checking it against the rows. Once a
      pending order can sit outside the window, a statement headed "to 02 Aug" can carry
      a line dated 03 Aug, and saying nothing about that is the sort of small
      contradiction that costs more trust than the figure it hides. */
   '<p class="meta">Issued '+e(o.issued)+
     (o.from||o.to?' &middot; '+e(o.from?dLong(o.from):'from the beginning')+' to '+e(o.to?dLong(o.to):'today')
       +(T.pendN&&rows.some(r=>r.pendingOrder&&o.to&&new Date(r.date)>new Date(o.to))
          ?', plus any order agreed and not yet actioned':''):'')+'</p>',
   '<p class="whol" style="margin:26px 0 0">Account</p>',
   '<div class="who">'+e(who)+'</div>',
   '<div class="rule"></div>',
   rows.length?('<table><thead><tr><th class="l">Date</th><th>Quantity</th><th>Amount</th><th class="r">Status</th></tr></thead>'
     +'<tbody>'+body+'</tbody></table>')
     :'<p class="meta">No orders in this period.</p>',
   ((o.refunds||[]).length?'<p class="whol" style="margin:30px 0 0">Refunds</p>'
     +'<table style="margin-top:10px"><thead><tr><th class="l">Date</th><th class="l">Reason</th><th>Amount</th><th class="r">Status</th></tr></thead><tbody>'
     +o.refunds.map(r=>'<tr><td class="l dt">'+e(dLong(r.date))+'</td>'
       +'<td class="l" style="font-size:13px;color:#b9c2d0">'+(r.cancelled?'Cancelled order, money returned to you':'Overpayment returned to you')+'</td>'
       +'<td class="amt">'+money(r.amount)+'</td>'
       +'<td class="r">'+(r.paidOn?'<span class="ok">paid '+e(dLong(r.paidOn))+'</span>'
                                  :'<span class="due">owed to you</span>')+'</td></tr>').join('')
     +'</tbody></table>':''),
   '<div class="tot">',
   /* the count must match what was actually totalled, or the footer says three orders
      over a figure covering two, which is the first thing a careful reader checks */
   '<div class="tr"><span>'+(rows.length-T.cxN)+' order'+((rows.length-T.cxN)===1?'':'s')
     +', '+n2(T.qty)+' unit'
     +(T.cxN?'<span class="cxn"> &middot; '+T.cxN+' cancelled, not counted</span>':'')
     +'</span><span>'+money(T.total)+'</span></div>',
   '<div class="tr"><span>Paid</span><span>'+money(T.paid)+'</span></div>',
   (T.cxPaid>0.009?'<div class="tr sub"><span>of which on cancelled orders</span><span>'+money(T.cxPaid)+'</span></div>':''),
   /* say plainly which part of the total has not happened yet, so the ordered figure
      and the paid figure can be reconciled without him having to ask why they differ */
   (T.pendN?'<div class="tr sub"><span>of which not yet collected or paid</span><span>'
      +money(T.pendVal)+'</span></div>':''),
   '<div class="tr big'+(T.owed>0.009?'':' clear')+'"><span>'+(T.owed>0.009?'Outstanding':'Balance')+'</span><span>'
     +(T.owed>0.009?money(T.owed):'nil')+'</span></div>',
   (refundOwed>0.009?'<div class="tr big"><span>Owed to you</span><span>'+money(refundOwed)+'</span></div>':''),
   '</div>',
   /* GOODS OWED GET THEIR OWN BLOCK. A statement whose only large figure is money can
      read as though nothing else is outstanding, which is exactly the misreading a
      dispute about undelivered salt would turn on. */
   (T.toGet>0.009?'<div class="owed"><p class="owedl">Still to collect</p>'
     +'<p class="owedv">'+n2(T.toGet)+' <span>unit</span></p></div>':''),
   /* THE WORKINGS, step by step, so nothing has to be taken on trust */
   (o.recon||[]).map(R=>{
     let st=0;
     const step=(t,b)=>'<div class="stp"><div class="stpn">'+(++st)+'</div><div class="stpb">'
       +'<p class="stpt">'+t+'</p>'+(b?'<p class="stpd">'+b+'</p>':'')+'</div></div>';
     const legRows=R.legs.map(l=>'<tr><td class="l">'+e(dLong(l.date))+'</td><td>'+n2(l.qty)+' unit</td>'
       +'<td>'+money(l.billed)+'</td><td>'+money(l.paid)+'</td>'
       +'<td class="r"><b class="short">'+money(l.short)+'</b></td></tr>').join('');
     const pays=R.payments.length?R.payments.map(x=>money(x.rm)+' on '+e(dLong(x.date))).join(', ')
                              :money(R.order.paid);
     /* once the salt has gone out the reconciliation is no longer a claim but a record,
        and titling it "how the 0 unit is arrived at" would be nonsense. It is kept
        either way, because the proof is worth more after a dispute than during one. */
     /* the plain-language version, used when there are no earlier orders to show.
        It states only what he already knows: what he ordered, what he paid, what he
        took and what was held back by agreement. It does not name the arrangement the
        salt went against, because a statement is not the place to restate a private
        settlement, and it invites the question instead. */
     if(R.noLegs){
       const gone=R.unitsOff, took=R.collected;
       return '<div class="rec"><p class="recl">How your '+e(dLong(R.order.date))+' order was settled</p>'
         +step('The order was paid in full.',
               n2(R.order.qty)+' unit at '+money(R.order.total/R.order.qty)+' a unit is '
               +money(R.order.total)+', received as '+pays+'.')
         +step('Part of it was not handed over, by agreement.',
               '<b>'+n2(gone)+' unit</b> of that order was held back and applied to a separate '
               +'arrangement between us, rather than being collected or refunded. No money '
               +'changed hands on it.')
         +step(R.owed>0.009?'So the salt still due to you is what is left.'
                           :'So the balance of the order was collected in full.',
               '<table class="mini calc"><tbody>'
               +'<tr><td class="l">Bought</td><td class="r">'+n2(R.order.qty)+' unit</td></tr>'
               +'<tr><td class="l">Less applied by agreement</td><td class="r">&minus; '+n2(gone)+' unit</td></tr>'
               +'<tr class="sub"><td class="l">Deliverable</td><td class="r">'+n2(R.deliverable)+' unit</td></tr>'
               +'<tr><td class="l">Less already collected</td><td class="r">&minus; '+n2(took)+' unit</td></tr>'
               +'<tr class="tot"><td class="l">'+(R.owed>0.009?'Still to collect':'Collected in full, nothing outstanding')
               +'</td><td class="r">'+n2(R.owed)+' unit</td></tr>'
               +'</tbody></table>')
         +'<p class="recn">If your own record of that arrangement differs from this, say so '
         +'and it will be gone through line by line.</p></div>';
     }
     return '<div class="rec"><p class="recl">'+(R.owed>0.009
        ?'How the '+n2(R.owed)+' unit is arrived at'
        :'How your '+e(dLong(R.order.date))+' order was settled')+'</p>'
       +step('Earlier orders were not paid in full.',
             '<table class="mini"><thead><tr><th class="l">Order</th><th>Quantity</th><th>Billed</th><th>Paid in cash</th><th class="r">Short</th></tr></thead><tbody>'
             +legRows+'<tr class="tot"><td class="l" colspan="4">Carried forward</td><td class="r"><b class="short">'
             +money(R.shortTot)+'</b></td></tr></tbody></table>')
       +step('That '+money(R.shortTot)+' was settled out of your order of '+e(dLong(R.order.date))+', in salt rather than cash.',
             money(R.shortTot)+' at '+money(R.rate)+' a unit is <b>'+n2(R.unitsOff)+' unit</b>, withheld from that order by agreement. No money changed hands and that salt stayed on the shelf.')
       +step('The '+e(dLong(R.order.date))+' order itself is paid in full.',
             n2(R.order.qty)+' unit at '+money(R.order.total/R.order.qty)+' a unit is '+money(R.order.total)+', received as '+pays+'.')
       +step(R.owed>0.009
             ?'So the salt due to you is what you bought, less what settled the balance, less what you have taken.'
             :'So the salt due to you was what you bought, less what settled the balance, less what you had already taken. All of it has since been handed over.',
             '<table class="mini calc"><tbody>'
             +'<tr><td class="l">Bought</td><td class="r">'+n2(R.order.qty)+' unit</td></tr>'
             +'<tr><td class="l">Less applied to the '+money(R.shortTot)+' balance</td><td class="r">&minus; '+n2(R.unitsOff)+' unit</td></tr>'
             +'<tr class="sub"><td class="l">Deliverable</td><td class="r">'+n2(R.deliverable)+' unit</td></tr>'
             +'<tr><td class="l">Less already collected</td><td class="r">&minus; '+n2(R.collected)+' unit</td></tr>'
             +'<tr class="tot"><td class="l">'+(R.owed>0.009?'Still to collect':'Collected in full, nothing outstanding')+'</td><td class="r">'+n2(R.owed)+' unit</td></tr>'
             +'</tbody></table>')
       /* the one contradiction a careful reader would otherwise find, answered before he
          finds it: those orders read as settled above yet show short here */
       +'<p class="recn">'+R.legs.map(l=>e(dLong(l.date))).join(' and ')
       +' show as settled at the top of this statement because that balance was cleared '
       +'here, in salt, rather than in cash. Nothing about them is still owed in money.</p>'
       +'</div>';}).join(''),
   '<p class="note">Amounts in ringgit. This statement covers your own orders only, taken from the seller&rsquo;s records as at the issue date. If anything differs from your own, say so and it will be checked.</p>',
   '</div></body></html>'].join('\n');
}

export { stmtRows, stmtRecon, stmtRefunds, stmtDoc };

/* ---- the run -------------------------------------------------------------------
   Ported from the retired make_statements.cjs: the same options, the same totals, the
   same files and the same review sheet, minus the jsdom drive of a desk that no longer
   carries the functions. */
export function makeStatements(outDir, issue) {
  mkdirSync(outDir, { recursive: true });
  const parties = [...new Set(sales.map(s => s.customer))].sort();
  const issued = new Date(issue + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  let made = 0; const skipped = [], sheets = [];
  for (const p of parties) {
    /* EVERYTHING to date, not just the month: a customer's statement is more use as a
       complete position than as a slice, and it removes the brought-forward problem
       entirely. The month is what the folder records, not what the statement covers. */
    const o = { from: null, to: issue, completed: true, open: true, pending: true,
                dates: true, brand: 'Salt Command', issued: issued };
    const rows = stmtRows(p, o);
    o.refunds = stmtRefunds(p, o);
    /* only reconcile orders that are actually IN this statement, so the date window
       cannot leave a working referring to a line the reader cannot see */
    o.recon = stmtRecon(p, rows).filter(R => rows.some(x => x.date === R.order.date));
    if (!rows.length && !o.refunds.length) { skipped.push(p); continue; }
    /* the index needs the same totals the statement foots to, so they are taken
       from the same rows rather than recomputed from the ledger */
    /* the index must agree with each statement's own footer: a cancelled order is
       not an order for counting purposes, so it is out of n as well as out of the money */
    const t = { n: rows.filter(r => !r.cancelled).length, qty: 0, total: 0, paid: 0, owed: 0, toGet: 0, pend: 0, cx: 0 };
    t.refund = o.refunds.filter(r => !r.paidOn).reduce((a, r) => a + (+r.amount || 0), 0);   // v454: what is owed TO them
    rows.forEach(r => { if (r.cancelled) { t.cx++; t.paid += r.gift ? 0 : (r.paidCash + r.inKind); return; }
                        t.qty += r.qty; t.total += r.total; t.paid += r.gift ? 0 : (r.paidCash + r.inKind);
                        t.owed += r.owed;
                        t.toGet += (r.toGet > 0 && !r.pendingOrder) ? r.toGet : 0;
                        t.pend += r.pendingOrder ? r.total : 0; });
    const html = stmtDoc(p, rows, o);
    const file = join(outDir, 'statement_' + p.replace(/[^A-Za-z0-9._-]+/g, '-') + '_' + issue + '.html');
    writeFileSync(file, html);
    console.log('  ' + p.padEnd(14) + rows.length + ' order' + (rows.length === 1 ? '' : 's'));
    made++;
    sheets.push({ who: p, html: html, t: t });
  }

  /* ---- THE REVIEW SHEET, for him and not for a customer --------------------
     Twenty-four files is too many to open one by one before sending, so this
     stitches every statement into one page behind an index that says which ones
     need a second look. It carries NOTHING a statement does not: it is the same
     markup inlined, so anything safe to send is safe to review and there is no
     second version of the truth to keep in step. The prefix keeps it first in an
     alphabetical listing, where it belongs. */
  if (sheets.length) {
    const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const m2 = v => Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const n2 = v => Number(v).toLocaleString('en-MY', { maximumFractionDigits: 2 });
    /* one shared stylesheet, lifted from the first statement so the two can never
       diverge: if the statement is restyled the review sheet follows automatically */
    const css = (sheets[0].html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];
    const bodyOf = h => { const m = h.match(/<body>([\s\S]*?)<\/body>/); return m ? m[1] : ''; };
    /* PENDING IS ITS OWN STATE, not a quiet 'clear'. An agreed order nobody has acted
       on is the one line most likely to need chasing, so the index says so rather than
       letting it sit among the finished accounts looking settled. */
    const flag = t => t.owed > 0.009 ? 'owes' : (t.toGet > 0.009 ? 'goods' : (t.refund > 0.009 ? 'refund' : (t.pend > 0.009 ? 'pend' : 'clear')));
    const rowsIdx = sheets.map(x => {
      const f = flag(x.t);
      return '<tr class="f-' + f + '"><td class="l"><a href="#s-' + esc(x.who) + '">' + esc(x.who) + '</a></td>'
        + '<td>' + x.t.n + '</td><td>' + n2(x.t.qty) + '</td><td>' + m2(x.t.total) + '</td><td>' + m2(x.t.paid) + '</td>'
        + '<td class="r">' + (x.t.owed > 0.009 ? '<b class="owe">' + m2(x.t.owed) + '</b>' : x.t.refund > 0.009 ? '<b class="rf">' + m2(x.t.refund) + ' to them</b>' : '&mdash;') + '</td>'
        + '<td class="r">' + (x.t.toGet > 0.009 ? '<b class="gd">' + n2(x.t.toGet) + ' unit</b>' : '&mdash;') + '</td>'
        + '<td class="r">' + (x.t.pend > 0.009 ? '<b class="pd">' + m2(x.t.pend) + '</b>' : '&mdash;') + '</td></tr>';
    }).join('');
    const owe = sheets.filter(x => x.t.owed > 0.009), gds = sheets.filter(x => x.t.toGet > 0.009);
    const pnd = sheets.filter(x => x.t.pend > 0.009);
    const sumT = k => sheets.reduce((a, x) => a + x.t[k], 0);
    const review = '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">'
      + '<meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>Statements to review · ' + esc(issue) + '</title><style>' + css
      + '\n.rv{max-width:900px;margin:0 auto 40px}'
      + '.rvh{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#ffc75a;font-weight:700;margin:0 0 8px}'
      + '.rvt{margin:0 0 6px;font-size:32px;font-weight:900;letter-spacing:-.015em}'
      + '.rvs{color:#6b7688;font-size:13px;margin:0 0 26px}'
      + '.idx{width:100%;border-collapse:collapse;margin-bottom:14px}'
      + '.idx th{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6b7688;font-weight:700;'
      + 'padding:0 10px 9px;text-align:right;border-bottom:1px solid #2a3140}.idx th.l{text-align:left}'
      + '.idx td{padding:10px;border-bottom:1px solid rgba(42,49,64,.5);text-align:right;'
      + 'font-variant-numeric:tabular-nums;font-size:13.5px}.idx td.l{text-align:left}.idx td.r{text-align:right}'
      + '.idx a{color:#7fd7e8;text-decoration:none;font-weight:700}.idx a:hover{text-decoration:underline}'
      + '.idx tr.f-owes{background:rgba(255,199,90,.05)}.idx tr.f-goods{background:rgba(127,215,232,.05)}'
      + '.idx tr.f-pend{background:rgba(200,182,255,.05)}.idx tr.f-refund{background:rgba(110,231,168,.05)}b.rf{color:#6ee7a8}'
      + 'b.owe{color:#ffc75a}b.gd{color:#7fd7e8}b.pd{color:#c8b6ff}'
      + '.cut{margin:0;border:0;border-top:1px dashed #2a3140;padding:0}'
      + '.slab{max-width:900px;margin:34px auto 6px;font-size:11px;letter-spacing:.24em;'
      + 'text-transform:uppercase;color:#6b7688;font-weight:700}'
      + '@media print{.rv,.slab{color:#111}.idx a{color:#0b5f70}.sheet{page-break-after:always}}'
      + '</style></head><body>'
      + '<div class="rv"><p class="rvh">For review, not for sending</p>'
      + '<h1 class="rvt">' + sheets.length + ' statements</h1>'
      + '<p class="rvs">Issued ' + esc(issued) + '. Every statement below is exactly the file that would go to that '
      + 'customer, stitched together so they can be read in one pass. '
      + (owe.length ? '<b>' + owe.length + '</b> carr' + (owe.length === 1 ? 'ies' : 'y') + ' an outstanding balance' : 'None carries a balance')
      + (gds.length ? ', and <b>' + gds.length + '</b> ' + (gds.length === 1 ? 'is' : 'are') + ' owed goods' : '')
      + '.'
      + (pnd.length ? ' <b>' + pnd.length + '</b> hold' + (pnd.length === 1 ? 's' : '') + ' an order agreed but not yet '
        + 'collected or paid, which is money to chase rather than money owed.' : '')
      + '</p>'
      + '<table class="idx"><thead><tr><th class="l">Account</th><th>Orders</th><th>Quantity</th>'
      + '<th>Ordered</th><th>Paid</th><th class="r">Outstanding</th><th class="r">Owed goods</th>'
      + '<th class="r">Not actioned</th></tr></thead>'
      + '<tbody>' + rowsIdx + '</tbody>'
      + '<tfoot><tr><td class="l"><b>All</b></td><td>' + sumT('n') + '</td><td>' + n2(sumT('qty')) + '</td>'
      + '<td>' + m2(sumT('total')) + '</td><td>' + m2(sumT('paid')) + '</td>'
      + '<td class="r"><b class="owe">' + m2(sumT('owed')) + '</b></td>'
      + '<td class="r"><b class="gd">' + n2(sumT('toGet')) + ' unit</b></td>'
      + '<td class="r"><b class="pd">' + m2(sumT('pend')) + '</b></td></tr></tfoot></table></div>'
      + sheets.map(x => '<p class="slab" id="s-' + esc(x.who) + '">' + esc(x.who) + '</p><hr class="cut">'
        + '<div class="sheet">' + bodyOf(x.html) + '</div>').join('')
      + '</body></html>';
    const rf = join(outDir, '_review_' + issue + '.html');
    writeFileSync(rf, review);
    console.log('review sheet: ' + rf);
  }

  console.log('\nwrote ' + made + ' statement' + (made === 1 ? '' : 's') + ' to ' + outDir);
  if (skipped.length) console.log('nothing to show for: ' + skipped.join(', '));
  return { made, skipped, sheets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outDir = process.argv[2], issue = process.argv[3] || new Date().toISOString().slice(0, 10);
  if (!outDir || /\.html?$/i.test(outDir)) {
    console.error('usage: node tools/make_statements.mjs <outDir> [YYYY-MM-DD issue date]');
    if (outDir) console.error('the desk is no longer an input: statements build from ledger/book.json and engine/position.mjs (v388 removed the statement functions from the desk).');
    process.exit(2);
  }
  makeStatements(outDir, issue);
}
