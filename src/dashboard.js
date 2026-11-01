// Dashboard logic (ported from the original single-file template).
// Called once with the loaded DATA object.
export function startDashboard(DATA, extras){
extras=extras||{};

'use strict';
const D = DATA;
const idx = cols => { const m={}; cols.forEach((c,i)=>m[c]=i); return m; };
const RI = idx(D.returnCols), AI = idx(D.raCols), PI = idx(D.payCols);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const money = (n,c) => (n<0?'-':'')+'$'+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:c?2:0,maximumFractionDigits:c?2:0});
const num = n => Math.round(n).toLocaleString('en-US');
const pct = (a,b) => b ? (100*a/b).toFixed(0)+'%' : '—';
const svg = (p,s) => `<svg viewBox="0 0 24 24" width="${s||18}" height="${s||18}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  overview:'<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
  offices:'<path d="M4 21V5l8-3v19M12 9h8v12M8 8h.01M8 12h.01M8 16h.01M16 13h.01M16 17h.01"/>',
  collections:'<path d="M3 7h18v12H3zM3 7l3-4h12l3 4M16 13h2"/>',
  risk:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  exports:'<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/>',
  health:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  stripe:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  disb:'<path d="M12 2v20M17 6.5C15.5 5 13.8 4.5 12 4.5c-2.8 0-4.5 1.3-4.5 3.2 0 4.6 9 2.3 9 7 0 2-1.8 3.3-4.5 3.3-2 0-3.8-.7-5-2"/>',
  tap:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  subs:'<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  profit:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'
};

// ---------- settings ----------
let TH = {top:500, mid:100};
try { const t = JSON.parse(localStorage.getItem('tsdc_thresholds')||'null'); if(t&&t.top&&t.mid) TH=t; } catch(e){}
const saveTH = () => { try{ localStorage.setItem('tsdc_thresholds', JSON.stringify(TH)); }catch(e){} };

// ---------- lookups ----------
const OFF = new Map(D.offices.map(o=>[o.id,o]));
const byOid = (rows, k) => { const m=new Map(); rows.forEach(r=>{ const id=r[k]; if(!id) return; if(!m.has(id)) m.set(id,[]); m.get(id).push(r); }); return m; };
const BAL = new Map(); D.balances.forEach(b=>{ if(!b.officeId) return; if(!BAL.has(b.officeId)) BAL.set(b.officeId,[]); BAL.get(b.officeId).push(b); });
const RET = byOid(D.returns, RI.oid), RAL = byOid(D.ra, AI.oid), PAY = byOid(D.payments, PI.oid);

const S = {seg:'all', from:'', to:'', tab:'overview', qs:{}, inactive:false, sort:{}, limit:{}, balType:'all', balStatus:'outstanding', ovTrend:'returns', ovList:'top', dtab:'summary',
  stripe:{source:'Stripe', product:'all', noPay:false, owing:false},
  disb:{ftype:'all', dtype:'all', noRows:false, owing:false},
  tap:{status:'all', price:'all', noRows:false, owing:false},
  subs:{status:'active', cat:'all'}, subView:'monthly'};
let STATS = new Map();
const inRange = d => { if(!d) return !(S.from||S.to); if(S.from && d<S.from) return false; if(S.to && d>S.to) return false; return true; };
const blank = () => ({ret:0,bank:0,non:0,rej:0,types:{},month:{},prep:0,prepPaid:0,sbf:0,sbfPaid:0,trans:0,transPaid:0,
  raF:0,raS:0,actual:0,actualF:0,actualS:0,expected:0,disb:0,offset:0,rPrep:0,rSbf:0,rTrans:0,rRef:0,pays:0,payN:0,payRet:0});
function buildStats(){
  STATS = new Map(); const g = id => { let s=STATS.get(id); if(!s){ s=blank(); STATS.set(id,s);} return s; };
  for(const r of D.returns){
    if(!inRange(r[RI.transmit])) continue;
    const s=g(r[RI.oid]); s.ret++; if(r[RI.isBank]) s.bank++; else s.non++; if(r[RI.ack]==='R') s.rej++;
    const t=r[RI.rtype]||'(blank)'; s.types[t]=(s.types[t]||0)+1;
    const m=(r[RI.transmit]||'').slice(0,7); if(m) s.month[m]=(s.month[m]||0)+1;
    s.prep+=r[RI.prepFee]; s.prepPaid+=r[RI.prepPaid]; s.sbf+=r[RI.sbf]; s.sbfPaid+=r[RI.sbfPaid]; s.trans+=r[RI.trans]; s.transPaid+=r[RI.transPaid];
  }
  for(const r of D.ra){
    if(!inRange(r[AI.date])) continue;
    const s=g(r[AI.oid]);
    if(r[AI.ftype]==='F'){ s.raF++; s.actualF+=r[AI.actual]; } else { s.raS++; s.actualS+=r[AI.actual]; }
    s.actual+=r[AI.actual]; s.expected+=r[AI.expected]; s.disb+=r[AI.disbursed]; s.offset+=r[AI.offset];
    s.rPrep+=r[AI.prepRec]; s.rSbf+=r[AI.sbf]; s.rTrans+=r[AI.trans]; s.rRef+=r[AI.refProd];
  }
  for(const r of D.payments){ if(!r[PI.oid]||!inRange(r[PI.date])) continue; const s=g(r[PI.oid]); s.pays+=r[PI.amount]; s.payN++; s.payRet+=r[PI.returns]||0; }
}
const st = id => STATS.get(id) || blank();
const outstanding = id => (BAL.get(id)||[]).filter(b=>!b.paid && b.amount>0).reduce((a,b)=>a+b.amount,0);
const accessOff = o => !!o.disabled || (BAL.get(o.id)||[]).some(b=>b.disabled && !b.paid && b.amount>0);
const accessChip = o => (accessOff(o)&&outstanding(o.id)>0) ? '<span class="chip dis">Disabled</span>' : '<span class="chip act">Active</span>';
function tier(s){ const n=s.raF; return n>=TH.top ? 'Top' : n>=TH.mid ? 'Mid' : 'Low'; }
function risk(o){ const owed=outstanding(o.id); if(owed<=0) return 'Low'; const t=tier(st(o.id)); return t==='Top' ? 'Low' : t==='Mid' ? 'Medium' : 'High'; }
const riskChip = r => `<span class="chip ${r==='Low'?'low':r==='Medium'?'med':'high'}">${r}</span>`;
const segOK = o => S.seg==='all' || (S.seg==='efin'&&o.type==='EFIN') || (S.seg==='ptin'&&o.type==='PTIN') || (S.seg==='10x'&&o.tags.includes('10X')) || (S.seg==='msb'&&o.tags.includes('MSB'));
const active = o => { const s=st(o.id); return s.ret||s.raF||s.raS||s.payN||outstanding(o.id)>0; };
function haystack(o){
  if(o._h) return o._h;
  const parts=[o.name,o.efin,o.ptin,...(o.viaEfins||[]),o.company,o.billName,o.owner,...(o.ero||[]),...(o.emails||[]),...(o.officeIds||[]).map(x=>x.name),...(o.preparers||[]).map(p=>p.ptin+' '+p.name),...(o.tags||[])];
  (BAL.get(o.id)||[]).forEach(b=>{ parts.push(b.email,b.name); });
  const pe=new Set(); (PAY.get(o.id)||[]).forEach(r=>{ if(r[PI.email]) pe.add(r[PI.email]); }); parts.push(...pe);
  return o._h = parts.join(' ').toLowerCase();
}
const qOK = (o,q) => { if(!q) return true; return q.toLowerCase().split(/\s+/).every(w=>haystack(o).includes(w)); };
const Q = () => (S.qs[S.tab]||'').trim();
const visible = (opts) => { opts=opts||{}; const q=Q(); return D.offices.filter(o=>segOK(o) && qOK(o,q) && (opts.all||S.inactive||q||active(o))); };
const visSet = () => new Set(D.offices.filter(o=>segOK(o)).map(o=>o.id));

// ---------- utilities ----------
function sortRows(key, rows, cols){
  const s=S.sort[key]; if(!s) return rows; const c=cols.find(c=>c.k===s.k); if(!c) return rows;
  const f=c.v||(r=>r[c.k]); const dir=s.d;
  return rows.slice().sort((a,b)=>{ const x=f(a), y=f(b); if(x==null||x==='') return 1; if(y==null||y==='') return -1; return (typeof x==='number'&&typeof y==='number' ? x-y : String(x).localeCompare(String(y),undefined,{numeric:true}))*dir; });
}
function table(key, cols, rows, opt){
  opt=opt||{}; rows=sortRows(key, rows, cols); const lim=S.limit[key]||opt.limit||100; const shown=rows.slice(0,lim);
  const head=cols.map(c=>`<th class="${c.n?'num':''}" data-k="${c.k}" data-tbl="${key}">${esc(c.h)}${S.sort[key]&&S.sort[key].k===c.k?(S.sort[key].d>0?' ▲':' ▼'):''}</th>`).join('');
  const body=shown.map(r=>`<tr class="${opt.click?'click':''}" ${opt.click?`data-row="${esc(opt.click(r))}"`:''}>${cols.map(c=>`<td class="${c.n?'num':''}">${c.f?c.f(r):esc(r[c.k])}</td>`).join('')}</tr>`).join('');
  const more = rows.length>shown.length ? `<div class="empty"><button class="btn ghost sm" data-more="${key}">Show 100 more (${rows.length-shown.length} left)</button></div>` : '';
  return `<div class="tblwrap"><table><thead><tr>${head}</tr></thead><tbody>${body||''}</tbody></table>${rows.length?'':'<div class="empty">Nothing matches the current search and filters.</div>'}${more}</div>`;
}
function barChart(cats, series, colors, opt){
  opt=opt||{}; const W=800,H=250,pl=48,pb=26,pt=8,pr=8; const n=cats.length||1;
  const tot=cats.map((c,i)=>series.reduce((a,s)=>a+(s.v[i]||0),0)); const max=Math.max(1,...tot);
  const bw=(W-pl-pr)/n; let out=`<svg viewBox="0 0 ${W} ${H}" role="img">`;
  for(let g=0;g<=4;g++){ const y=pt+(H-pt-pb)*(1-g/4); out+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="#eceef5"/><text x="${pl-8}" y="${y+4}" font-size="10.5" text-anchor="end" fill="#7a8196">${(opt.fmt||num)(max*g/4)}</text>`; }
  cats.forEach((c,i)=>{ let y=H-pb; series.forEach((s,k)=>{ const v=s.v[i]||0, h=(H-pt-pb)*v/max; y-=h; out+=`<rect x="${pl+i*bw+1.5}" y="${y}" width="${Math.max(1,bw-3)}" height="${h}" rx="2" fill="${colors[k]}"><title>${esc(c)} · ${esc(s.n)}: ${(opt.fmt||num)(v)}</title></rect>`; });
    if(i%Math.ceil(n/12)===0) out+=`<text x="${pl+i*bw+bw/2}" y="${H-8}" font-size="10.5" text-anchor="middle" fill="#7a8196">${esc(opt.lab?opt.lab(c):c)}</text>`; });
  return out+'</svg><div class="legend">'+series.map((s,k)=>`<span><i style="background:${colors[k]}"></i>${esc(s.n)}</span>`).join('')+'</div>';
}
const wk = iso => { if(!iso) return ''; const d=new Date(iso+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)); return d.toISOString().slice(0,10); };
function download(name, blob){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }
function exportSheets(file, sheets){
  const clean = rows => rows.map(r=>r.map(v=>v==null?'':v));
  if(window.XLSX && !window.__noxlsx){
    const wb=XLSX.utils.book_new(); sheets.forEach(s=>XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clean(s.rows)), s.name.slice(0,31)));
    XLSX.writeFile(wb, file+'.xlsx'); return;
  }
  sheets.forEach(s=>{ const csv=clean(s.rows).map(r=>r.map(v=>{ v=String(v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(',')).join('\n'); download(file+(sheets.length>1?' - '+s.name:'')+'.csv', new Blob(['﻿'+csv],{type:'text/csv'})); });
  alert('The Excel library could not load (no internet), so CSV files were downloaded instead. CSV opens in Excel; if a bank needs .xlsx, open the file online once and export again.');
}
const officeLabel = o => o.type==='EFIN' ? `EFIN ${o.efin}` : o.name;
const ptinCount = o => o.type==='EFIN' ? (o.preparers||[]).length : (o.ptins||[]).length;
const idsOf = o => o.efin || ((o.ptins&&o.ptins.length)?o.ptins:[o.ptin]).filter(Boolean).join(', ');
const officeSub = o => o.type==='EFIN' ? [(o.ero||[]).join(' / '), o.billName&&!(o.ero||[]).length?o.billName:''].filter(Boolean).join(' · ') : [ptinCount(o)>1 ? ptinCount(o)+' PTINs' : (o.ptin||''), o.company&&o.company!==o.name?o.company:''].filter(Boolean).join(' · ');
const nameCell = o => `<div class="name"><b>${esc(officeLabel(o))}</b><div class="s">${esc(officeSub(o))}</div></div>`;
const typeChip = o => `<span class="chip ${o.type==='EFIN'?'efin':'ptin'}">${o.type}</span>`;
const oLink = id => { const o=OFF.get(id); return o ? `<a href="#" data-open="${esc(id)}">${esc(officeLabel(o))}</a>` : '<span class="muted">unmatched</span>'; };

// ---------- search bar + quick lookup ----------
function searchBar(ph){ return `<div class="searchrow">${svg(ICON.search,18)}<input id="pq" type="search" autocomplete="off" placeholder="${esc(ph)}" value="${esc(S.qs[S.tab]||'')}"></div>`; }
function lookup(){
  const q=Q(); if(!q) return '';
  const res=D.offices.filter(o=>segOK(o)&&qOK(o,q)).sort((a,b)=>(st(b.id).ret+st(b.id).raF)-(st(a.id).ret+st(a.id).raF));
  if(!res.length) return `<div class="note">No office, EFIN, PTIN or preparer matches “${esc(q)}”.</div>`;
  return `<div class="look">${res.slice(0,10).map(o=>{ const s=st(o.id),ow=outstanding(o.id); return `<div class="r" data-row="${esc(o.id)}">${typeChip(o)}<div class="n"><b>${esc(officeLabel(o))}</b><div>${esc(officeSub(o))}</div></div><div class="m"><b>${num(s.ret)} returns</b>${ow?money(ow,1)+' owed':'no balance'}</div></div>`; }).join('')}</div>${res.length>10?`<div class="hint">Showing 10 of ${res.length}. Refine the search, or use the Offices page for the full list.</div>`:''}`;
}

// ---------- pages ----------
const hero=(l,v,s,cls,extra)=>`<div class="card hero ${cls||''}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s||''}</div>${extra||''}</div>`;
function bodyOverview(){
  const vs=visSet(), offs=D.offices.filter(o=>vs.has(o.id));
  let t=blank(), owed=0, dis=0, act=0, owing=0; const byType={};
  offs.forEach(o=>{ const s=st(o.id); for(const k in t) if(typeof t[k]==='number') t[k]+=s[k]; if(active(o)) act++; const ow=outstanding(o.id); owed+=ow; if(ow>0){owing++; if(accessOff(o)) dis++;} });
  D.balances.forEach(b=>{ if(b.paid||b.amount<=0) return; if(b.officeId&&!vs.has(b.officeId)) return; if(!b.officeId&&S.seg!=='all') return; byType[b.type]=(byType[b.type]||0)+b.amount; });
  const weeks={}, fw={};
  D.returns.forEach(r=>{ if(!vs.has(r[RI.oid])||!inRange(r[RI.transmit])) return; const w=wk(r[RI.transmit]); (weeks[w]=weeks[w]||[0,0])[r[RI.isBank]?0:1]++; });
  D.ra.forEach(r=>{ if(!vs.has(r[AI.oid])||!inRange(r[AI.date])) return; const w=wk(r[AI.date]); fw[w]=(fw[w]||0)+r[AI.actual]; });
  const wc=Object.keys(weeks).sort(), fc=Object.keys(fw).sort();
  const chart = S.ovTrend==='returns'
    ? (wc.length?barChart(wc,[{n:'Bank product',v:wc.map(w=>weeks[w][0])},{n:'Non-bank',v:wc.map(w=>weeks[w][1])}],['#19196d','#c9961a'],{lab:c=>c.slice(5)}):'<div class="empty">No returns in this range</div>')
    : (fc.length?barChart(fc,[{n:'RA funded refunds',v:fc.map(w=>fw[w])}],['#1c4534'],{fmt:v=>v>=1e6?'$'+(v/1e6).toFixed(1)+'M':'$'+(v/1e3).toFixed(0)+'k',lab:c=>c.slice(5)}):'<div class="empty">No RA funding in this range</div>');
  const top=offs.map(o=>({o,s:st(o.id)})).sort((a,b)=>b.s.ret-a.s.ret).slice(0,10);
  const owedRows=offs.map(o=>({o,v:outstanding(o.id)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,10);
  let list='';
  if(S.ovList==='top') list=table('ovTop',[{k:'o',h:'Office',f:r=>nameCell(r.o)},{k:'t',h:'Type',f:r=>typeChip(r.o)},{k:'r',h:'Returns',n:1,f:r=>num(r.s.ret)},{k:'b',h:'Bank',n:1,f:r=>num(r.s.bank)},{k:'f',h:'RA funded',n:1,f:r=>num(r.s.raF)}],top,{limit:10,click:r=>r.o.id});
  else if(S.ovList==='owed') list=table('ovOwe',[{k:'o',h:'Office',f:r=>nameCell(r.o)},{k:'t',h:'Type',f:r=>typeChip(r.o)},{k:'v',h:'Owed',n:1,f:r=>money(r.v,1)},{k:'a',h:'Prep access',f:r=>accessChip(r.o)}],owedRows,{limit:10,click:r=>r.o.id});
  else list=`<div class="rows">${Object.keys(byType).sort((a,b)=>byType[b]-byType[a]).map(k=>`<div><span>${esc(k)}</span><b>${money(byType[k],1)}</b></div>`).join('')||'<div><span>No balances</span><b></b></div>'}</div>`;
  return lookup()+`
  <div class="grid g4">
    ${hero('Total returns',num(t.ret),`${num(t.rej)} rejected by IRS (still counted)`,'',`<div class="split" title="Bank vs non-bank"><i style="width:${t.ret?100*t.bank/t.ret:0}%;background:#19196d"></i><i style="width:${t.ret?100*t.non/t.ret:0}%;background:#c9961a"></i></div>`)}
    ${hero('RA funded refunds',money(t.actual),`${num(t.raF)} returns funded · federal ${money(t.actualF)}`)}
    ${hero('Outstanding balances',money(owed),`${num(owing)} offices owe · ${num(dis)} with prep access off`,owed?'alert':'')}
    ${hero('Active offices',num(act),`${num(offs.length)} in this view`)}
  </div>
  <div class="grid g32" style="margin-top:16px">
    <div class="card"><div class="cardhead"><h3>Activity by week</h3><div class="pills" data-pills="ovTrend"><button data-v="returns" class="${S.ovTrend==='returns'?'on':''}">Returns</button><button data-v="funding" class="${S.ovTrend==='funding'?'on':''}">RA funding</button></div></div><div class="chart">${chart}</div></div>
    <div class="card"><h3>Season snapshot</h3><div class="rows">
      <div><span>Bank-product returns</span><b>${num(t.bank)} · ${pct(t.bank,t.ret)}</b></div>
      <div><span>Non-bank returns</span><b>${num(t.non)} · ${pct(t.non,t.ret)}</b></div>
      <div><span>Prep fees received (RA)</span><b>${money(t.rPrep)}</b></div>
      <div><span>Service bureau fees (RA)</span><b>${money(t.rSbf)}</b></div>
      <div><span>Transmitter fees (RA)</span><b>${money(t.rTrans)}</b></div>
      <div><span>Stripe + AMP payments</span><b>${money(t.pays)}</b></div>
    </div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="cardhead"><h3>Highlights</h3><div class="pills" data-pills="ovList"><button data-v="top" class="${S.ovList==='top'?'on':''}">Top offices</button><button data-v="owed" class="${S.ovList==='owed'?'on':''}">Largest balances</button><button data-v="type" class="${S.ovList==='type'?'on':''}">Owed by type</button></div></div>${list}</div>`;
}

function bodyOffices(){
  const rows=visible();
  const cols=[
    {k:'name',h:'Office',v:o=>officeLabel(o),f:nameCell},
    {k:'type',h:'Type',f:o=>typeChip(o)+o.tags.map(t=>` <span class="chip tag">${esc(t)}</span>`).join('')},
    {k:'np',h:'PTINs',n:1,v:o=>ptinCount(o),f:o=>num(ptinCount(o))},
    {k:'ret',h:'Returns',n:1,v:o=>st(o.id).ret,f:o=>num(st(o.id).ret)},
    {k:'bank',h:'Bank',n:1,v:o=>st(o.id).bank,f:o=>num(st(o.id).bank)},
    {k:'non',h:'Non-bank',n:1,v:o=>st(o.id).non,f:o=>num(st(o.id).non)},
    {k:'raf',h:'RA funded',n:1,v:o=>st(o.id).raF,f:o=>num(st(o.id).raF)},
    {k:'amt',h:'Funded $',n:1,v:o=>st(o.id).actual,f:o=>money(st(o.id).actual)},
    {k:'owed',h:'Owed',n:1,v:o=>outstanding(o.id),f:o=>outstanding(o.id)?money(outstanding(o.id),1):'—'},
    {k:'acc',h:'Prep access',v:o=>outstanding(o.id)&&accessOff(o)?1:0,f:accessChip},
    {k:'risk',h:'Risk',v:o=>({Low:0,Medium:1,High:2})[risk(o)],f:o=>riskChip(risk(o))}
  ];
  if(!S.sort.offices) S.sort.offices={k:'ret',d:-1};
  return `<div class="toolbar"><span class="tcount">${num(rows.length)} offices</span><span class="muted small">Click a row for the full profile</span><span class="spacer"></span><label><input type="checkbox" id="inactive" ${S.inactive?'checked':''}> Include offices with no activity</label><button class="btn ghost sm" data-export="offices">Export list</button></div>`+table('offices',cols,rows,{click:o=>o.id});
}

function balRows(){
  const vs=visSet(); const q=Q().toLowerCase();
  return D.balances.filter(b=>{
    if(b.officeId){ if(!vs.has(b.officeId)) return false; } else if(S.seg!=='all') return false;
    if(S.balType!=='all'){ const isE=(b.officeId||'').startsWith('E:'); if(S.balType==='efin'&&!isE) return false; if(S.balType==='ptin'&&isE) return false; }
    if(S.balStatus==='outstanding'&&(b.paid||b.amount<=0)) return false;
    if(S.balStatus==='disabled'&&!(b.disabled&&!b.paid&&b.amount>0)) return false;
    if(S.balStatus==='paid'&&!b.paid) return false;
    if(q){ const h=(b.name+' '+b.email+' '+b.notes+' '+(b.officeId?haystack(OFF.get(b.officeId)):'')).toLowerCase(); if(!q.split(/\s+/).every(w=>h.includes(w))) return false; }
    return true; });
}
function bodyCollections(){
  const rows=balRows(); const tot=rows.filter(b=>!b.paid).reduce((a,b)=>a+b.amount,0);
  const cols=[
    {k:'office',h:'Office',v:b=>b.officeId?officeLabel(OFF.get(b.officeId)):'zzz',f:b=>b.officeId?nameCell(OFF.get(b.officeId)):'<span class="muted">unmatched</span>'},
    {k:'name',h:'Name on balance',f:b=>`<div class="name"><b>${esc(b.name||'—')}</b><div class="s">${esc(b.email)}${b.ptin?' · '+esc(b.ptin):''}</div></div>`},
    {k:'type',h:'Type',f:b=>`<span class="chip tag">${esc(b.type)}</span>`},
    {k:'amount',h:'Owed',n:1,f:b=>b.paid?`<s class="muted">${money(b.amount,1)}</s>`:money(b.amount,1)},
    {k:'status',h:'Status',v:b=>b.paid?2:b.disabled?1:0,f:b=>(b.paid?'<span class="chip paid">Paid</span> ':'')+(b.disabled&&!b.paid?'<span class="chip dis">Prep access off</span> ':'')+(b.link?`<a class="small" href="${esc(b.link)}" target="_blank" rel="noopener">invoice ↗</a>`:(b.amount>0&&!b.paid?'<span class="chip tag">no invoice link</span>':''))},
    {k:'notes',h:'Notes',f:b=>`<span class="small">${esc(b.notes)}</span>${b.otherPtins&&b.otherPtins.length?`<div class="small muted">Could also be: ${esc(b.otherPtins.join(', '))}</div>`:''}`}
  ];
  if(!S.sort.bal) S.sort.bal={k:'amount',d:-1};
  return `<div class="toolbar">
    <select id="balType"><option value="all">All offices</option><option value="efin"${S.balType==='efin'?' selected':''}>EFIN offices</option><option value="ptin"${S.balType==='ptin'?' selected':''}>PTIN offices</option></select>
    <select id="balStatus"><option value="outstanding">Outstanding</option><option value="disabled"${S.balStatus==='disabled'?' selected':''}>Prep access off</option><option value="paid"${S.balStatus==='paid'?' selected':''}>Marked paid</option><option value="all"${S.balStatus==='all'?' selected':''}>Everything</option></select>
    <span class="tcount">${num(rows.length)} rows · ${money(tot,1)}</span><span class="spacer"></span>
    <button class="btn ghost sm" data-export="collections">Export view</button></div>
  <div class="note">Every amount is money owed <b>to</b> Taxx Savage. “Prep access off” means no tax-preparation access right now. EFIN offices pay through the bank sheet; PTIN offices through prep-fee deduction.</div>`+table('bal',cols,rows,{click:b=>b.officeId||''});
}

// ---------- Stripe payments by office ----------
const prodLabel = p => String(p||'Other').replace(/^Taxx Savage:\s*/,'');
const PRODUCTS = (()=>{ const c={}; D.payments.forEach(r=>{ if(r[PI.source]==='Stripe'){ const p=r[PI.product]||'Other'; c[p]=(c[p]||0)+1; } }); return Object.keys(c).sort((a,b)=>c[b]-c[a]); })();
const zeroS = () => ({n:0,amt:0,fee:0,ret:0,last:'',prod:{}});
function stripeRows(){
  const F=S.stripe, q=Q(), m=new Map(), un={n:0,amt:0,fee:0,ret:0,emails:new Map()};
  for(const r of D.payments){
    if(F.source!=='both' && r[PI.source]!==F.source) continue;
    if(!inRange(r[PI.date])) continue;
    if(F.product!=='all' && (r[PI.product]||'Other')!==F.product) continue;
    const id=r[PI.oid], ret=r[PI.returns]||0;
    if(!id){ un.n++; un.amt+=r[PI.amount]; un.fee+=r[PI.fee]; un.ret+=ret; const e=r[PI.email]||'(no email)'; const u=un.emails.get(e)||{e,n:0,amt:0,ret:0}; u.n++; u.amt+=r[PI.amount]; u.ret+=ret; un.emails.set(e,u); continue; }
    let s=m.get(id); if(!s){ s=zeroS(); m.set(id,s); }
    s.n++; s.amt+=r[PI.amount]; s.fee+=r[PI.fee]; s.ret+=ret; const d=r[PI.date]||''; if(d>s.last) s.last=d;
    const p=prodLabel(r[PI.product]); s.prod[p]=(s.prod[p]||0)+r[PI.amount];
  }
  const rows=D.offices.filter(o=>segOK(o)&&qOK(o,q)&&(F.noPay||m.has(o.id))&&(!F.owing||outstanding(o.id)>0)).map(o=>({o,s:m.get(o.id)||zeroS()}));
  return {rows,un};
}
const STRIPE_COLS = [
  {k:'name',h:'Office',v:r=>officeLabel(r.o),f:r=>nameCell(r.o)},
  {k:'type',h:'Type',f:r=>typeChip(r.o)},
  {k:'pays',h:'Payments',n:1,v:r=>r.s.n,f:r=>num(r.s.n)},
  {k:'ret',h:'Returns paid for',n:1,v:r=>r.s.ret,f:r=>num(r.s.ret)},
  {k:'filed',h:'Returns filed',n:1,v:r=>st(r.o.id).ret,f:r=>num(st(r.o.id).ret)},
  {k:'amt',h:'Amount paid',n:1,v:r=>r.s.amt,f:r=>money(r.s.amt,1)},
  {k:'fee',h:'Fees',n:1,v:r=>r.s.fee,f:r=>money(r.s.fee,1)},
  {k:'net',h:'Net',n:1,v:r=>r.s.amt-r.s.fee,f:r=>money(r.s.amt-r.s.fee,1)},
  {k:'avg',h:'Avg payment',n:1,v:r=>r.s.n?r.s.amt/r.s.n:0,f:r=>r.s.n?money(r.s.amt/r.s.n,1):'—'},
  {k:'last',h:'Last payment',v:r=>r.s.last,f:r=>r.s.last||'—'},
  {k:'top',h:'Main product',f:r=>{ const e=Object.entries(r.s.prod).sort((a,b)=>b[1]-a[1])[0]; return e?`<span class="chip tag">${esc(e[0])}</span>`:'<span class="muted">—</span>'; }}
];
const STRIPE_SORTS=[['amt','Amount paid'],['ret','Returns paid for (Stripe)'],['filed','Returns filed'],['pays','Number of payments'],['net','Net after fees'],['fee','Fees'],['avg','Average payment'],['last','Last payment date'],['name','Office name']];
function bodyStripe(){
  const F=S.stripe; const {rows,un}=stripeRows();
  if(!S.sort.stripe) S.sort.stripe={k:'amt',d:-1};
  const so=S.sort.stripe; const tot=rows.reduce((a,r)=>{ a.n+=r.s.n; a.amt+=r.s.amt; a.fee+=r.s.fee; a.ret+=r.s.ret; if(r.s.n) a.offices++; return a; },{n:0,amt:0,fee:0,ret:0,offices:0});
  const opt=(v,l,cur)=>`<option value="${esc(v)}"${String(cur)===String(v)?' selected':''}>${esc(l)}</option>`;
  const unRows=[...un.emails.values()].sort((a,b)=>b.amt-a.amt);
  return `<div class="grid g4" style="margin-bottom:16px">
    ${hero('Amount paid',money(tot.amt),`${money(tot.amt-tot.fee)} net after ${money(tot.fee)} fees`)}
    ${hero('Payments',num(tot.n),tot.n?`${money(tot.amt/tot.n,1)} average`:'')}
    ${hero('Returns paid for',num(tot.ret),'from the payment descriptions')}
    ${hero('Offices paying',num(tot.offices),`${num(rows.length)} offices in this list`)}
  </div>
  <div class="toolbar">
    <label>Source <select id="stSource">${opt('Stripe','Stripe',F.source)}${opt('AMP/Tap','AMP / Tap charges',F.source)}${opt('both','Both',F.source)}</select></label>
    <label>Product <select id="stProduct">${opt('all','All products',F.product)}${PRODUCTS.map(p=>opt(p,prodLabel(p),F.product)).join('')}</select></label>
    <label>Sort by <select id="stSort">${STRIPE_SORTS.map(x=>opt(x[0],x[1],so.k)).join('')}</select></label>
    <label><select id="stDir">${opt('-1','Highest to lowest',so.d)}${opt('1','Lowest to highest',so.d)}</select></label>
  </div>
  <div class="toolbar">
    <label><input type="checkbox" id="stNoPay" ${F.noPay?'checked':''}> Include offices with no payments</label>
    <label><input type="checkbox" id="stOwing" ${F.owing?'checked':''}> Only offices that owe a balance</label>
    <span class="spacer"></span><span class="muted small">Click an office to see every payment · click a column to re-sort</span>
    <button class="btn ghost sm" data-export="stripe">Export</button>
  </div>`+table('stripe',STRIPE_COLS,rows,{click:r=>r.o.id})
  +(un.n?`<details><summary>${num(un.n)} payments (${money(un.amt,1)}) are not matched to an office</summary><div class="note" style="margin-top:8px">These payer emails are not in the PTIN Client Reference or the EFIN invoice summary, so they cannot be attached to an office. Add the email to the PTIN reference and refresh to match them.</div>${table('stUn',[{k:'e',h:'Payer email'},{k:'n',h:'Payments',n:1,f:r=>num(r.n)},{k:'ret',h:'Returns paid for',n:1,f:r=>num(r.ret)},{k:'amt',h:'Amount paid',n:1,f:r=>money(r.amt,1)}],unRows,{limit:50})}</details>`:'');
}

// ---------- Disbursement report (Refund Advantage) ----------
const zeroD = () => ({n:0,fed:0,state:0,expected:0,actual:0,actF:0,offset:0,adv:0,prior:0,refProd:0,prepRec:0,hp:0,efile:0,sbf:0,trans:0,doc:0,chk:0,rebate:0,disb:0,tap:0,other:0,rnd:0,last:''});
const TAP_PRICES_RA=[59.99,69.99,79.99,99.99];
const feesOf = s => s.refProd+s.prepRec+s.efile+s.sbf+s.trans+s.doc+s.chk;
function addDisb(s,r){
  s.n++; const a=r[AI.actual], d=r[AI.disbursed];
  if(r[AI.ftype]==='F'){ s.fed++; s.actF+=a; } else s.state++;
  s.expected+=r[AI.expected]; s.actual+=a; s.offset+=r[AI.offset]; s.adv+=r[AI.advRepay]; s.prior+=r[AI.priorDebt];
  s.refProd+=r[AI.refProd]; s.prepRec+=r[AI.prepRec]; s.hp+=r[AI.highPrep]; s.efile+=r[AI.efile]; s.sbf+=r[AI.sbf]; s.trans+=r[AI.trans]; s.doc+=r[AI.docPrep]; s.chk+=r[AI.checkFee]; s.rebate+=r[AI.checkRebate]; s.disb+=d;
  const fees=r[AI.refProd]+r[AI.prepRec]+r[AI.efile]+r[AI.sbf]+r[AI.trans]+r[AI.docPrep]+r[AI.checkFee];
  // Expected refund - government offset = actual refund (true on every line). From the actual refund the bank takes the fees,
  // advance repayments and prior-year debt; what is left is the customer disbursement. Any gap is not itemized in the report:
  // gaps that equal a Total Audit Protection price are shown as TAP withheld (inferred), the rest as other deductions.
  const res=a-d-fees-r[AI.advRepay]-r[AI.priorDebt];
  if(Math.abs(res)<=1.01) s.rnd+=res; else if(TAP_PRICES_RA.some(p=>Math.abs(res-p)<0.011)) s.tap+=res; else s.other+=res;
  const dt=r[AI.date]||''; if(dt>s.last) s.last=dt;
}
const DTYPE={DD:'Direct deposit',CK:'Check',CD:'Card',OT:'Other'};
const waterfall = s => { const w=[['Expected refunds',s.expected,'info'],['Government offsets',-s.offset,'info'],['Actual refunds funded',s.actual,'total'],['Refund product fee',-s.refProd],['Tax prep fees received',-s.prepRec],['E-file fees',-s.efile],['Service bureau fees',-s.sbf],['Transmitter fees',-s.trans],['Doc prep fees',-s.doc],['Check fees',-s.chk],['Advance repayments',-s.adv],['Prior-year loan debt',-s.prior],['Total Audit Protection withheld (inferred)',-s.tap],['Other deductions (not itemized)',-s.other]]; if(Math.abs(s.rnd)>=1) w.push(['Rounding differences',-s.rnd]); w.push(['Customer disbursement',s.disb,'total']); return w; };
function waterfallHtml(s){
  return `<div class="rows">${waterfall(s).map(w=>{ const amt=w[1]; const p=(w[2]==='info'||!s.actual)?'':` · ${(100*Math.abs(amt)/s.actual).toFixed(1)}%`; const st=w[2]==='total'?' style="border-top:1px solid var(--line);font-weight:600"':(w[2]==='info'?' class="muted"':''); return `<div${st}><span>${esc(w[0])}</span><b>${amt<0?'−':''}${money(Math.abs(amt),2)}${p}</b></div>`; }).join('')}</div>
  <div class="small muted" style="margin-top:6px">How it adds up: expected refund − government offset = actual refund. From the actual refund the bank takes the fees, advance repayments and prior-year loan debt, and pays the rest to the customer. The report does not itemize every deduction: gaps equal to a Total Audit Protection price ($59.99, $69.99, $79.99, $99.99) are shown as TAP withheld (inferred); other gaps are “not itemized”. Check fee rebate ${money(s.rebate,2)} and high-prep fee ${money(s.hp,2)} are for reference, not extra deductions.</div>`;
}
function disbRows(){
  const F=S.disb, q=Q(), m=new Map(), sbfTo=new Map();
  const ok=r=>(F.ftype==='all'||r[AI.ftype]===F.ftype)&&(F.dtype==='all'||r[AI.dtype]===F.dtype)&&inRange(r[AI.date]);
  for(const r of D.ra){ if(!ok(r)) continue; let s=m.get(r[AI.oid]); if(!s){ s=zeroD(); m.set(r[AI.oid],s); } addDisb(s,r); }
  const rows=D.offices.filter(o=>segOK(o)&&qOK(o,q)&&(F.noRows||m.has(o.id))&&(!F.owing||outstanding(o.id)>0)).map(o=>({o,s:m.get(o.id)||zeroD()}));
  const ids=new Set(rows.map(r=>r.o.id)); const tot=zeroD();
  rows.forEach(r=>{ for(const k in tot) if(typeof tot[k]==='number') tot[k]+=r.s[k]; });
  for(const r of D.ra){ if(!ids.has(r[AI.oid])||!ok(r)) continue; const to=r[AI.sbfTo]||'(none)'; sbfTo.set(to,(sbfTo.get(to)||0)+r[AI.sbf]); }
  return {rows,tot,sbfTo,ok};
}
const DISB_COLS=[
  {k:'name',h:'Office',v:r=>officeLabel(r.o),f:r=>nameCell(r.o)},
  {k:'type',h:'Type',f:r=>typeChip(r.o)},
  {k:'fed',h:'Funded returns',n:1,v:r=>r.s.fed,f:r=>num(r.s.fed)},
  {k:'actual',h:'Actual refunds',n:1,v:r=>r.s.actual,f:r=>money(r.s.actual)},
  {k:'fees',h:'Total fees',n:1,v:r=>feesOf(r.s),f:r=>money(feesOf(r.s))},
  {k:'prepRec',h:'Prep fees',n:1,v:r=>r.s.prepRec,f:r=>money(r.s.prepRec)},
  {k:'sbf',h:'Service bureau',n:1,v:r=>r.s.sbf,f:r=>money(r.s.sbf)},
  {k:'trans',h:'Transmitter',n:1,v:r=>r.s.trans,f:r=>money(r.s.trans)},
  {k:'offset',h:'Gov. offsets',n:1,v:r=>r.s.offset,f:r=>money(r.s.offset)},
  {k:'adv',h:'Advance repaid',n:1,v:r=>r.s.adv,f:r=>money(r.s.adv)},
  {k:'tap',h:'TAP withheld',n:1,v:r=>r.s.tap,f:r=>money(r.s.tap)},
  {k:'other',h:'Other deductions',n:1,v:r=>r.s.other,f:r=>money(r.s.other)},
  {k:'disb',h:'Customer disbursed',n:1,v:r=>r.s.disb,f:r=>money(r.s.disb)},
  {k:'avg',h:'Avg refund',n:1,v:r=>r.s.fed?r.s.actF/r.s.fed:0,f:r=>r.s.fed?money(r.s.actF/r.s.fed):'—'},
  {k:'last',h:'Last funding',v:r=>r.s.last,f:r=>r.s.last||'—'}
];
const DISB_SORTS=[['actual','Actual refunds'],['fed','Funded returns'],['fees','Total fees'],['prepRec','Prep fees'],['sbf','Service bureau fees'],['trans','Transmitter fees'],['offset','Government offsets'],['adv','Advance repayments'],['tap','TAP withheld'],['other','Other deductions'],['disb','Customer disbursed'],['avg','Average refund'],['last','Last funding date'],['name','Office name']];
const optHtml=(v,l,cur)=>`<option value="${esc(v)}"${String(cur)===String(v)?' selected':''}>${esc(l)}</option>`;
function bodyDisb(){
  const F=S.disb; const {rows,tot,sbfTo}=disbRows();
  if(!S.sort.disb) S.sort.disb={k:'actual',d:-1}; const so=S.sort.disb;
  const sbfRows=[...sbfTo.entries()].sort((a,b)=>b[1]-a[1]).map(x=>({e:x[0],v:x[1]}));
  return `<div class="grid g4" style="margin-bottom:16px">
    ${hero('Actual refunds funded',money(tot.actual),`${num(tot.fed)} funded returns · gov. offsets ${money(tot.offset)}`)}
    ${hero('Total fees',money(feesOf(tot)),`${pct(feesOf(tot),tot.actual)} of refunds · prep ${money(tot.prepRec)}`)}
    ${hero('Customer disbursements',money(tot.disb),`${pct(tot.disb,tot.actual)} of refunds`)}
    ${hero('Advances, TAP and other',money(tot.adv+tot.prior+tot.tap+tot.other),`advances ${money(tot.adv)} · TAP ${money(tot.tap)}`)}
  </div>
  <div class="grid g2" style="margin-bottom:16px">
    <div class="card"><h3>Where the refund money goes</h3><div class="sub">All offices in this list</div>${waterfallHtml(tot)}</div>
    <div class="card"><h3>Service bureau fee received by</h3><div class="sub">The EFIN that receives each service bureau fee</div>${table('sbfTo',[{k:'e',h:'Receiving EFIN'},{k:'v',h:'Service bureau fees',n:1,f:r=>money(r.v,2)}],sbfRows,{limit:10})}</div>
  </div>
  <div class="toolbar">
    <label>Funding <select id="dsFtype">${optHtml('all','Federal + state',F.ftype)}${optHtml('F','Federal only',F.ftype)}${optHtml('S','State only',F.ftype)}</select></label>
    <label>Paid out by <select id="dsDtype">${optHtml('all','All methods',F.dtype)}${optHtml('DD','Direct deposit',F.dtype)}${optHtml('CK','Check',F.dtype)}${optHtml('CD','Card',F.dtype)}</select></label>
    <label>Sort by <select id="dsSort">${DISB_SORTS.map(x=>optHtml(x[0],x[1],so.k)).join('')}</select></label>
    <label><select id="dsDir">${optHtml('-1','Highest to lowest',so.d)}${optHtml('1','Lowest to highest',so.d)}</select></label>
  </div>
  <div class="toolbar">
    <label><input type="checkbox" id="dsNone" ${F.noRows?'checked':''}> Include offices with no disbursements</label>
    <label><input type="checkbox" id="dsOwing" ${F.owing?'checked':''}> Only offices that owe a balance</label>
    <span class="spacer"></span><span class="muted small">Click an office for the full breakdown · click a column to re-sort</span>
    <button class="btn ghost sm" data-export="disb">Export</button>
  </div>`+table('disb',DISB_COLS,rows,{click:r=>r.o.id});
}
function disbDetail(o){
  const lines=(RAL.get(o.id)||[]).filter(r=>inRange(r[AI.date]));
  if(!lines.length) return '<div class="empty">No Refund Advantage disbursements for this office in the selected date range.</div>';
  const T=zeroD(), byF={F:zeroD(),S:zeroD()}, byD={}, byP={}, sbfTo={}, wkAmt={}, mon={};
  lines.forEach(r=>{ addDisb(T,r); addDisb(byF[r[AI.ftype]],r); const dt=r[AI.dtype]; addDisb(byD[dt]=byD[dt]||zeroD(),r); const p=r[AI.ptin]||'(no PTIN)'; addDisb(byP[p]=byP[p]||zeroD(),r); const to=r[AI.sbfTo]||'(none)'; sbfTo[to]=(sbfTo[to]||0)+r[AI.sbf]; const w=wk(r[AI.date]); wkAmt[w]=(wkAmt[w]||0)+r[AI.actual]; const mo=(r[AI.date]||'').slice(0,7); mon[mo]=(mon[mo]||0)+r[AI.actual]; });
  const k=(l,v,sub)=>`<div class="k"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub||'&nbsp;'}</div></div>`;
  const names=new Map((o.preparers||[]).map(p=>[p.ptin,p.name]));
  const peaks=Object.keys(wkAmt).sort((a,b)=>wkAmt[b]-wkAmt[a]).slice(0,3);
  const months=Object.keys(mon).sort();
  let h=`<div class="kpis">${k('Funded returns',num(T.fed),num(T.state)+' state lines')}${k('Actual refunds',money(T.actual),'expected '+money(T.expected))}${k('Total fees',money(feesOf(T)),pct(feesOf(T),T.actual)+' of refunds')}${k('Customer disbursed',money(T.disb),pct(T.disb,T.actual)+' of refunds')}${k('Government offsets',money(T.offset),'expected → actual')}${k('Advances, TAP, other',money(T.adv+T.prior+T.tap+T.other),'advances '+money(T.adv)+' · TAP '+money(T.tap))}</div>`;
  h+=`<h4>Where the refund money goes</h4>${waterfallHtml(T)}`;
  h+=`<h4>By funding type</h4>${table('dF'+o.id,[{k:'t',h:'Funding',f:r=>r[0]==='F'?'Federal':'State'},{k:'n',h:'Lines',n:1,v:r=>r[1].n,f:r=>num(r[1].n)},{k:'a',h:'Actual refunds',n:1,v:r=>r[1].actual,f:r=>money(r[1].actual)},{k:'f',h:'Fees',n:1,v:r=>feesOf(r[1]),f:r=>money(feesOf(r[1]))},{k:'d',h:'Disbursed',n:1,v:r=>r[1].disb,f:r=>money(r[1].disb)}],Object.entries(byF).filter(x=>x[1].n),{limit:5})}`;
  h+=`<h4>Paid out by</h4>${table('dD'+o.id,[{k:'t',h:'Method',f:r=>esc(DTYPE[r[0]]||r[0])},{k:'n',h:'Lines',n:1,v:r=>r[1].n,f:r=>num(r[1].n)},{k:'a',h:'Actual refunds',n:1,v:r=>r[1].actual,f:r=>money(r[1].actual)},{k:'d',h:'Disbursed',n:1,v:r=>r[1].disb,f:r=>money(r[1].disb)}],Object.entries(byD),{limit:5})}`;
  h+=`<h4>Service bureau fee received by</h4>${table('dS'+o.id,[{k:'e',h:'Receiving EFIN',f:r=>esc(r[0])},{k:'v',h:'Amount',n:1,v:r=>r[1],f:r=>money(r[1],2)}],Object.entries(sbfTo).sort((a,b)=>b[1]-a[1]),{limit:8})}`;
  if(Object.keys(byP).length>1||(o.ptins&&o.ptins.length>1)) h+=`<h4>By PTIN (${Object.keys(byP).length})</h4>${table('dP'+o.id,[{k:'p',h:'PTIN',v:r=>r[0],f:r=>esc(r[0])},{k:'nm',h:'Preparer',v:r=>names.get(r[0])||'',f:r=>esc(names.get(r[0])||'')},{k:'fed',h:'Funded',n:1,v:r=>r[1].fed,f:r=>num(r[1].fed)},{k:'a',h:'Actual refunds',n:1,v:r=>r[1].actual,f:r=>money(r[1].actual)},{k:'f',h:'Fees',n:1,v:r=>feesOf(r[1]),f:r=>money(feesOf(r[1]))},{k:'d',h:'Disbursed',n:1,v:r=>r[1].disb,f:r=>money(r[1].disb)}],Object.entries(byP).sort((a,b)=>b[1].actual-a[1].actual),{limit:25})}`;
  h+=`<h4>Funded refunds by month</h4><div class="chart">${barChart(months,[{n:'Actual refunds',v:months.map(m=>mon[m])}],['#1c4534'],{fmt:v=>v>=1e6?'$'+(v/1e6).toFixed(1)+'M':'$'+(v/1e3).toFixed(0)+'k'})}</div>`;
  h+=`<div class="kv" style="margin-top:10px"><div>Peak funding weeks</div><div>${peaks.map(w=>`week of ${w}: ${money(wkAmt[w])}`).join('<br>')}</div><div>Last funding</div><div>${esc(T.last||'—')}</div></div>`;
  return h;
}

// ---------- TAP (Total Audit Protection) ----------
const TI = idx(D.tapCols); const TAPBY = byOid(D.tap, TI.oid);
const zeroT = () => ({n:0,charged:0,paid:0,paidN:0,lastPaid:'',ampN:0,ampDue:0,ampPaid:0,prices:{}});
const TAP_PRICES = [...new Set(D.tap.map(r=>r[TI.charged].toFixed(2)))].filter(p=>+p>0).sort((a,b)=>+a-+b);
function tapRows(){
  const F=S.tap, q=Q(), m=new Map(); const g=id=>{ let s=m.get(id); if(!s){ s=zeroT(); m.set(id,s);} return s; };
  for(const r of D.tap){ if(!inRange(r[TI.date])) continue; if(F.price!=='all'&&r[TI.charged].toFixed(2)!==F.price) continue;
    const s=g(r[TI.oid]); s.n++; s.charged+=r[TI.charged]; s.paid+=r[TI.paid]; if(r[TI.paid]>0.005){ s.paidN++; const d=r[TI.paidDate]||''; if(d>s.lastPaid) s.lastPaid=d; } const p=r[TI.charged].toFixed(2); s.prices[p]=(s.prices[p]||0)+1; }
  if(F.price==='all') for(const r of D.payments){ if(r[PI.source]!=='AMP/Tap'||!r[PI.oid]||!inRange(r[PI.date])) continue; const s=g(r[PI.oid]); s.ampN++; s.ampDue+=r[PI.due]||0; s.ampPaid+=r[PI.amount]; }
  let rows=D.offices.filter(o=>segOK(o)&&qOK(o,q)&&(F.noRows||(m.get(o.id)&&(m.get(o.id).n||m.get(o.id).ampN)))&&(!F.owing||outstanding(o.id)>0)).map(o=>({o,s:m.get(o.id)||zeroT()}));
  if(F.status==='unpaid') rows=rows.filter(r=>r.s.charged-r.s.paid>0.005);
  if(F.status==='paid') rows=rows.filter(r=>r.s.n&&r.s.charged-r.s.paid<=0.005);
  const tot=zeroT(); rows.forEach(r=>{ for(const k in tot) if(typeof tot[k]==='number') tot[k]+=r.s[k]; });
  return {rows,tot};
}
const owedT = s => Math.max(0,s.charged-s.paid);
const TAP_COLS=[
  {k:'name',h:'Office',v:r=>officeLabel(r.o),f:r=>nameCell(r.o)},
  {k:'type',h:'Type',f:r=>typeChip(r.o)},
  {k:'n',h:'TAP returns',n:1,v:r=>r.s.n,f:r=>num(r.s.n)},
  {k:'charged',h:'Charged',n:1,v:r=>r.s.charged,f:r=>money(r.s.charged,2)},
  {k:'paid',h:'Collected (paid)',n:1,v:r=>r.s.paid,f:r=>money(r.s.paid,2)},
  {k:'owed',h:'Not collected',n:1,v:r=>owedT(r.s),f:r=>owedT(r.s)>0.005?`<span style="color:var(--bad);font-weight:600">${money(owedT(r.s),2)}</span>`:'—'},
  {k:'rate',h:'Collected %',n:1,v:r=>r.s.charged?r.s.paid/r.s.charged:null,f:r=>r.s.charged?(100*r.s.paid/r.s.charged).toFixed(0)+'%':'—'},
  {k:'paidN',h:'Paid returns',n:1,v:r=>r.s.paidN,f:r=>num(r.s.paidN)},
  {k:'unpaidN',h:'Unpaid returns',n:1,v:r=>r.s.n-r.s.paidN,f:r=>num(r.s.n-r.s.paidN)},
  {k:'last',h:'Last paid',v:r=>r.s.lastPaid,f:r=>r.s.lastPaid||'—'},
  {k:'amp',h:'AMP invoices paid',n:1,v:r=>r.s.ampPaid,f:r=>r.s.ampN?`${money(r.s.ampPaid,2)} <span class="muted small">(${num(r.s.ampN)})</span>`:'—'}
];
const TAP_SORTS=[['charged','Charged'],['paid','Collected (paid)'],['owed','Not collected'],['n','TAP returns'],['rate','Collected %'],['unpaidN','Unpaid returns'],['last','Last paid date'],['amp','AMP invoices paid'],['name','Office name']];
function bodyTap(){
  const F=S.tap; const {rows,tot}=tapRows();
  if(!S.sort.tap) S.sort.tap={k:'charged',d:-1}; const so=S.sort.tap;
  return `<div class="grid g4" style="margin-bottom:16px">
    ${hero('TAP returns',num(tot.n),`${num(tot.paidN)} paid · ${num(tot.n-tot.paidN)} unpaid`)}
    ${hero('Charged',money(tot.charged,2),tot.n?`${money(tot.charged/tot.n,2)} average per return`:'')}
    ${hero('Collected (paid)',money(tot.paid,2),`${pct(tot.paid,tot.charged)} of charged`)}
    ${hero('Not collected',money(owedT(tot),2),`${num(rows.filter(r=>owedT(r.s)>0.005).length)} offices with unpaid TAP`,owedT(tot)>0?'alert':'')}
  </div>
  <div class="note">TAP = Total Audit Protection. <b>Charged</b> is the audit fee on each return in the return files; <b>collected</b> is the audit fee paid amount on those returns. “AMP invoices paid” is from the Tap payment file (AMP Invoicing charges).</div>
  <div class="toolbar">
    <label>Collection <select id="tpStatus">${optHtml('all','All offices',F.status)}${optHtml('unpaid','Has unpaid TAP',F.status)}${optHtml('paid','Fully collected',F.status)}</select></label>
    <label>Price <select id="tpPrice">${optHtml('all','All prices',F.price)}${TAP_PRICES.map(p=>optHtml(p,'$'+p,F.price)).join('')}</select></label>
    <label>Sort by <select id="tpSort">${TAP_SORTS.map(x=>optHtml(x[0],x[1],so.k)).join('')}</select></label>
    <label><select id="tpDir">${optHtml('-1','Highest to lowest',so.d)}${optHtml('1','Lowest to highest',so.d)}</select></label>
  </div>
  <div class="toolbar">
    <label><input type="checkbox" id="tpNone" ${F.noRows?'checked':''}> Include offices with no TAP</label>
    <label><input type="checkbox" id="tpOwing" ${F.owing?'checked':''}> Only offices that owe a balance</label>
    <span class="spacer"></span><span class="muted small">Click an office for its TAP detail · click a column to re-sort</span>
    <button class="btn ghost sm" data-export="tap">Export</button>
  </div>`+table('tap',TAP_COLS,rows,{click:r=>r.o.id});
}
function tapDetail(o){
  const lines=(TAPBY.get(o.id)||[]).filter(r=>inRange(r[TI.date]));
  const amp=(PAY.get(o.id)||[]).filter(r=>r[PI.source]==='AMP/Tap'&&inRange(r[PI.date]));
  if(!lines.length&&!amp.length) return '<div class="empty">No Total Audit Protection on this office’s returns in the selected date range.</div>';
  const T=zeroT(), byPrice={}, mon={}; let ampDue=0, ampPaid=0;
  lines.forEach(r=>{ T.n++; T.charged+=r[TI.charged]; T.paid+=r[TI.paid]; const paid=r[TI.paid]>0.005; if(paid){ T.paidN++; const d=r[TI.paidDate]||''; if(d>T.lastPaid) T.lastPaid=d; }
    const p='$'+r[TI.charged].toFixed(2); const e=(byPrice[p]=byPrice[p]||{n:0,c:0,p:0,pn:0}); e.n++; e.c+=r[TI.charged]; e.p+=r[TI.paid]; if(paid) e.pn++;
    const m=(r[TI.date]||'').slice(0,7); const x=(mon[m]=mon[m]||[0,0]); x[0]+=Math.min(r[TI.paid],r[TI.charged]); x[1]+=Math.max(0,r[TI.charged]-r[TI.paid]); });
  amp.forEach(r=>{ ampDue+=r[PI.due]||0; ampPaid+=r[PI.amount]; });
  const k=(l,v,sub)=>`<div class="k"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub||'&nbsp;'}</div></div>`;
  const months=Object.keys(mon).sort();
  let h=`<div class="kpis">${k('TAP returns',num(T.n),`${num(T.paidN)} paid · ${num(T.n-T.paidN)} unpaid`)}${k('Charged',money(T.charged,2),T.n?money(T.charged/T.n,2)+' average':'')}${k('Collected (paid)',money(T.paid,2),pct(T.paid,T.charged)+' of charged')}${k('Not collected',money(owedT(T),2),'charged − collected')}${k('AMP invoices paid',money(ampPaid,2),num(amp.length)+' charges · due '+money(ampDue,2))}${k('Last paid',esc(T.lastPaid||'—'),'audit fee paid date')}</div>`;
  if(lines.length){
    h+=`<h4>By price</h4>${table('tP'+o.id,[{k:'p',h:'Price',f:r=>esc(r[0])},{k:'n',h:'Returns',n:1,v:r=>r[1].n,f:r=>num(r[1].n)},{k:'c',h:'Charged',n:1,v:r=>r[1].c,f:r=>money(r[1].c,2)},{k:'pp',h:'Collected',n:1,v:r=>r[1].p,f:r=>money(r[1].p,2)},{k:'u',h:'Unpaid returns',n:1,v:r=>r[1].n-r[1].pn,f:r=>num(r[1].n-r[1].pn)}],Object.entries(byPrice),{limit:10})}`;
    h+=`<h4>By month</h4><div class="chart">${barChart(months,[{n:'Collected',v:months.map(m=>mon[m][0])},{n:'Not collected',v:months.map(m=>mon[m][1])}],['#1c4534','#de7451'],{fmt:v=>'$'+Math.round(v).toLocaleString('en-US')})}</div>`;
  }
  if(amp.length) h+=`<h4>AMP invoices (Tap payment file)</h4><div class="kv"><div>Charges</div><div>${num(amp.length)}</div><div>Amount due</div><div>${money(ampDue,2)}</div><div>Amount paid</div><div>${money(ampPaid,2)}</div></div>`;
  return h;
}

// ---------- Subscriptions (company apps and platforms) ----------
// Login pages are the vendors' usual sign-in pages written from memory (not checked online): they are marked "verify".
// A "Login URL" column in the sheet always wins over this list.
const LOGINS=[[/apple tv/i,'https://tv.apple.com/'],[/applecare/i,'https://mysupport.apple.com/'],[/adobe/i,'https://account.adobe.com/'],[/slack/i,'https://slack.com/signin'],[/chatgpt|openai/i,'https://chatgpt.com/'],[/\badt\b/i,'https://www.adt.com/'],[/hubspot/i,'https://app.hubspot.com/login'],[/bubble/i,'https://bubble.io/login'],[/amazon web|\baws\b/i,'https://console.aws.amazon.com/'],[/paychex/i,'https://myapps.paychex.com/'],[/ringcentral/i,'https://login.ringcentral.com/'],[/\bring\b/i,'https://account.ring.com/account/login'],[/zoom/i,'https://zoom.us/signin'],[/notion/i,'https://www.notion.so/login'],[/gohighlevel|highlevel/i,'https://app.gohighlevel.com/'],[/heygen/i,'https://app.heygen.com/login'],[/scribe/i,'https://scribehow.com/signin'],[/canva/i,'https://www.canva.com/login'],[/lastpass/i,'https://lastpass.com/'],[/google workspace|g ?suite/i,'https://admin.google.com/'],[/cloudways/i,'https://platform.cloudways.com/'],[/wp ?engine/i,'https://my.wpengine.com/'],[/synthesia/i,'https://app.synthesia.io/'],[/cloudflare/i,'https://dash.cloudflare.com/login'],[/midjourney/i,'https://www.midjourney.com/account'],[/loom|atlassian/i,'https://www.loom.com/login'],[/mailgun|sinch/i,'https://login.mailgun.com/login/'],[/twilio/i,'https://www.twilio.com/login']];
const loginFor = s => { if(s.login && /^https?:\/\//i.test(s.login)) return {url:s.login,from:'from your sheet'}; const m=LOGINS.find(x=>x[0].test(s.name)); return m?{url:m[1],from:'usual sign-in page, please verify'}:null; };
const localSubs = () => { try{ return JSON.parse(localStorage.getItem('tsdc_subs')||'[]'); }catch(e){ return []; } };
const saveSubs = a => { try{ localStorage.setItem('tsdc_subs',JSON.stringify(a)); }catch(e){} };
const statusKind = s => { const t=String(s||'').toLowerCase(); return !t||t==='active'?'active':/cancel/.test(t)?'cancelled':/inactive|possibl/.test(t)?'maybe':'other'; };
function allSubs(){
  const base=((D.subs&&D.subs.rows)||[]).map((r,i)=>({id:'sheet:'+i,src:'sheet',name:r[0],cat:r[1],status:r[2],cycle:r[3],amount:+r[4]||0,monthly:+r[5]||0,annual:+r[6]||0,last:r[7],renewal:r[8],payment:r[9],account:r[10],notes:r[11],login:r[12]}));
  const loc=localSubs().map((r,i)=>({id:'added:'+i,src:'added',idx:i,name:r.name,cat:r.cat,status:r.status||'Active',cycle:r.cycle,amount:+r.amount||+r.monthly||0,monthly:+r.monthly||0,annual:+r.annual||0,last:'',renewal:r.renewal,payment:'',account:'',notes:r.notes,login:''}));
  // owner decision (Oct 6): subscriptions with no price at all are not shown (AWS, Paychex, iQ, Synthesia, and unpriced cancelled rows)
  return base.concat(loc).filter(s=>s.amount>0||s.monthly>0||s.annual>0).map(s=>{
    s.kind=statusKind(s.status); s.assumed=false;
    // owner decision: an active charge with an unconfirmed cycle (HubSpot) is counted as a monthly charge until confirmed
    if(s.kind==='active'&&!(s.monthly>0)&&s.amount>0&&/unconfirm/i.test(s.cycle||'')){ s.monthly=s.amount; s.annual=s.amount*12; s.assumed=true; }
    s.noPrice=s.kind==='active'&&!(s.monthly>0); s.counted=s.kind==='active'&&s.monthly>0; return s; });
}
function subRows(){
  const q=Q().toLowerCase(), F=S.subs;
  return allSubs().filter(s=>(F.status==='all'||(F.status==='active'?s.kind==='active':F.status==='review'?(s.noPrice||s.assumed||s.kind==='maybe'):true))&&(F.cat==='all'||(s.cat||'Uncategorized')===F.cat)&&(!q||[s.name,s.cat,s.account,s.notes,s.cycle,s.payment,s.status].join(' ').toLowerCase().includes(q)));
}
const statusChip = s => s.kind==='active'?'<span class="chip act">Active</span>':s.kind==='cancelled'?'<span class="chip dis">Cancelled</span>':s.kind==='maybe'?'<span class="chip med">Possibly inactive</span>':`<span class="chip tag">${esc(s.status||'')}</span>`;
function bodySubs(){
  const F=S.subs; const all=allSubs(); const rows=subRows(); const hasSheet=D.subs&&D.subs.file;
  const counted=rows.filter(s=>s.counted);
  const monthly=counted.reduce((a,s)=>a+s.monthly,0), annual=counted.reduce((a,s)=>a+s.annual,0);
  const big=counted.slice().sort((a,b)=>b.monthly-a.monthly)[0];
  const noPrice=all.filter(s=>s.noPrice), maybe=all.filter(s=>s.kind==='maybe'), assumed=all.filter(s=>s.assumed);
  const maybeMonthly=maybe.reduce((a,s)=>a+(s.amount||0),0);
  const cats=[...new Set(all.map(s=>s.cat||'Uncategorized'))].sort();
  const byCat={}; counted.forEach(s=>{ const c=s.cat||'Uncategorized'; (byCat[c]=byCat[c]||{m:0,y:0,n:0}); byCat[c].m+=s.monthly; byCat[c].y+=s.annual; byCat[c].n++; });
  if(!S.sort.subs) S.sort.subs={k:'monthly',d:-1}; const so=S.sort.subs;
  const view=S.subView==='yearly'?'yearly':'monthly';
  const rank=counted.slice().sort((a,b)=>(view==='yearly'?b.annual-a.annual:b.monthly-a.monthly)).slice(0,12);
  const top=rank.length?(view==='yearly'?rank[0].annual:rank[0].monthly):1;
  const bars=rank.map(s=>{ const v=view==='yearly'?s.annual:s.monthly; return `<div class="look" style="margin:0 0 6px"><div class="r" data-row="${esc(s.id)}" style="padding:8px 12px"><div class="n" style="flex:0 0 38%"><b>${esc(s.name)}</b><div>${esc(s.cat||'')}${s.assumed?' · assumed monthly':''}</div></div><div style="flex:1;background:var(--soft);border-radius:6px;height:12px;overflow:hidden"><div style="height:100%;width:${Math.max(2,100*v/top)}%;background:var(--navy)"></div></div><div class="m" style="min-width:96px"><b>${money(v,2)}</b>${view==='yearly'?'a year':'a month'}</div></div></div>`; }).join('');
  const cols=[
    {k:'name',h:'Service',v:s=>s.name,f:s=>`<div class="name"><b>${esc(s.name)}</b><div class="s">${esc((s.notes||'').slice(0,90))}</div></div>`},
    {k:'cat',h:'Category',v:s=>s.cat||'',f:s=>s.cat?`<span class="chip tag">${esc(s.cat)}</span>`:'<span class="muted">—</span>'},
    {k:'status',h:'Status',v:s=>s.kind,f:s=>statusChip(s)+(s.assumed?' <span class="chip med">assumed monthly</span>':s.noPrice?' <span class="chip med">price unknown</span>':'')},
    {k:'cycle',h:'Billed',v:s=>s.cycle||'',f:s=>esc(s.cycle||'')},
    {k:'amount',h:'Per charge',n:1,v:s=>s.amount,f:s=>s.amount?money(s.amount,2):'—'},
    {k:'monthly',h:'Monthly',n:1,v:s=>s.counted?s.monthly:null,f:s=>s.counted?money(s.monthly,2):'—'},
    {k:'annual',h:'Yearly',n:1,v:s=>s.counted?s.annual:null,f:s=>s.counted?money(s.annual,2):'—'},
    {k:'renewal',h:'Next renewal',v:s=>s.renewal||'',f:s=>esc(s.renewal||'')},
    {k:'login',h:'Login',f:s=>{ const l=loginFor(s); return l?`<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.from)}">Open login ↗</a>`:'<span class="muted">—</span>'; }}
  ];
  return `<div class="grid g4" style="margin-bottom:16px">
    ${hero('We pay every month',money(monthly,2),`${num(counted.length)} active subscriptions with a price`)}
    ${hero('We pay every year',money(annual,2),'monthly × 12, or the yearly price listed')}
    ${hero('Largest subscription',big?money(big.monthly,2):'—',big?esc(big.name)+' a month':'')}
    ${hero('Needs confirmation',num(noPrice.length+maybe.length+assumed.length),`${num(noPrice.length)} active with no price · ${num(maybe.length)} possibly inactive · ${num(assumed.length)} assumed`,(noPrice.length+maybe.length+assumed.length)?'alert':'')}
  </div>`
  +(!hasSheet&&!all.length?`<div class="note"><b>Waiting for your subscription sheet.</b> Save it (or a shortcut to it) in the Data Center folder with “Subscriptions” in the file name, then run <i>Refresh Dashboard.cmd</i>. Until then you can add subscriptions below; they are saved in this browser only.</div>`:'')
  +(hasSheet?`<div class="note">Loaded from <b>${esc(D.subs.file)}</b>. Totals count active rows with a known price (${num(counted.length)} of ${num(all.length)} rows). Login links are each vendor’s usual sign-in page and have not been verified; add a “Login URL” column to your sheet to set your own.</div>`:'')
  +`<div class="grid g32" style="margin-bottom:16px">
    <div class="card"><div class="cardhead"><h3>Highest to lowest</h3><div class="pills" data-pills="subView"><button data-v="monthly" class="${view==='monthly'?'on':''}">Monthly</button><button data-v="yearly" class="${view==='yearly'?'on':''}">Yearly</button></div></div>${bars||'<div class="empty">No priced subscriptions in this view.</div>'}</div>
    <div class="card"><h3>By category</h3><div class="sub">Monthly and yearly</div><div class="rows">${Object.keys(byCat).sort((a,b)=>byCat[b].m-byCat[a].m).map(c=>`<div><span>${esc(c)} <span class="muted small">(${byCat[c].n})</span></span><b>${money(byCat[c].m,2)} · ${money(byCat[c].y)}</b></div>`).join('')||'<div><span>None</span><b></b></div>'}</div></div>
  </div>
  <div class="toolbar">
    <label>Show <select id="sbStatus">${optHtml('active','Active only',F.status)}${optHtml('review','Needs attention',F.status)}${optHtml('all','Everything',F.status)}</select></label>
    <label>Category <select id="sbCat">${optHtml('all','All categories',F.cat)}${cats.map(c=>optHtml(c,c,F.cat)).join('')}</select></label>
    <label>Sort by <select id="sbSort">${optHtml('monthly','Monthly cost',so.k)}${optHtml('annual','Yearly cost',so.k)}${optHtml('amount','Per charge',so.k)}${optHtml('renewal','Next renewal',so.k)}${optHtml('name','Service name',so.k)}</select></label>
    <label><select id="sbDir">${optHtml('-1','Highest to lowest',so.d)}${optHtml('1','Lowest to highest',so.d)}</select></label>
    <span class="spacer"></span><span class="muted small">Click a subscription for every detail and its login page</span><button class="btn ghost sm" data-export="subs">Export</button>
  </div>`+table('subs',cols,rows,{limit:200,click:s=>s.id})
  +`<div class="card" style="margin-top:16px"><h3>Add a subscription</h3><div class="sub">Saved in this browser only. Add it to your sheet and refresh to make it permanent.</div>
    <div class="toolbar" style="margin-top:12px">
      <input id="subName" type="text" placeholder="Platform / app" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;min-width:200px">
      <input id="subCat" type="text" placeholder="Category" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;width:150px">
      <input id="subAmt" type="number" step="0.01" min="0" placeholder="Price" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;width:110px">
      <select id="subCycle"><option>Monthly</option><option>Annual</option><option>Quarterly</option><option>Weekly</option></select>
      <input id="subRen" type="date" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit">
      <input id="subNotes" type="text" placeholder="Notes" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;min-width:160px">
      <button class="btn" data-subadd="1">Add</button>
    </div></div>`;
}
function subProfile(id){
  const s=allSubs().find(x=>x.id===id); if(!s) return;
  $('dt').textContent=s.name;
  $('dchips').innerHTML=(s.cat?`<span class="chip tag">${esc(s.cat)}</span>`:'')+statusChip(s)+(s.cycle?`<span class="chip tag">${esc(s.cycle)}</span>`:'')+(s.counted?'<span class="chip efin">counted in totals</span>':'<span class="chip tag">not counted</span>');
  const l=loginFor(s); const k=(a,b,c)=>`<div class="k"><div class="l">${a}</div><div class="v">${b}</div><div class="s">${c||'&nbsp;'}</div></div>`;
  const why=s.counted?(s.assumed?'Counted as a monthly charge because the billing cycle is unconfirmed. Confirm whether it is monthly or yearly.':'Active with a known price, so it is in the monthly and yearly totals.'):s.kind==='cancelled'?'Cancelled, so it is not counted.':s.kind==='maybe'?'Marked possibly inactive, so it is not counted until confirmed.':'No price on the sheet yet, so it is not counted.';
  let h=`<div class="kpis">${k('Monthly',s.monthly>0?money(s.monthly,2):'—',s.assumed?'assumed':'')}${k('Yearly',s.annual>0?money(s.annual,2):'—')}${k('Per charge',s.amount?money(s.amount,2):'—',esc(s.cycle||''))}</div>`;
  h+=`<h4>Details</h4><div class="kv"><div>Service</div><div>${esc(s.name)}</div><div>Category</div><div>${esc(s.cat||'—')}</div><div>Status</div><div>${esc(s.status||'Active')}</div><div>Billing cycle</div><div>${esc(s.cycle||'—')}</div><div>Last charge</div><div>${esc(s.last||'—')}</div><div>Next renewal</div><div>${esc(s.renewal||'—')}</div><div>Payment method</div><div>${esc(s.payment||'—')}</div><div>Account</div><div>${esc(s.account||'—')}</div><div>How counted</div><div>${esc(why)}</div></div>`;
  h+=`<h4>Login</h4>`+(l?`<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none">Open login page ↗</a><div class="small muted" style="margin-top:6px">${esc(l.url)} · ${esc(l.from)}</div>`:'<div class="muted">No login link yet. Add a “Login URL” column to your sheet and refresh.</div>');
  if(s.notes) h+=`<h4>Notes from your sheet</h4><div style="white-space:pre-wrap">${esc(s.notes)}</div>`;
  if(s.src==='added') h+=`<h4>Added in this browser</h4><button class="btn ghost sm" data-subdel="${s.idx}">Remove</button>`;
  $('dtabs').innerHTML='<button data-dtab="details">Details</button>'; $('db').innerHTML=`<section class="dsec" data-d="details">${h}</section>`;
  showDtab('details'); $('drawer').classList.add('open'); $('scrim').classList.add('on'); $('db').scrollTop=0;
}
// ---------- Profit outlook: monthly profit and loss ----------
// Revenue = money in. Direct costs = Stripe fees + AMP charges. Gross profit = revenue - direct costs.
// Operating expenses = payroll + marketing & ads + subscriptions + other expenses (you enter the first, second and fourth by month).
// Adjustments (+ adds, - subtracts) are entered by month. Net income = gross profit - operating expenses + adjustments.
const MONTHS=[...Array(12)].map((_,i)=>`${D.meta.season}-${String(i+1).padStart(2,'0')}`);
const MNAME=['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthlyInputs=()=>{ try{ return JSON.parse(localStorage.getItem('tsdc_monthly')||'{}'); }catch(e){ return {}; } };
const saveMonthly=o=>{ try{ localStorage.setItem('tsdc_monthly',JSON.stringify(o)); }catch(e){} };
const POPT0={inc:{stripe:1,sbf:1,trans:1,tap:1},cost:{subs:1,stripeFees:1,amp:1},growth:10};
function profitOpts(){ let o=null; try{ o=JSON.parse(localStorage.getItem('tsdc_profit')||'null'); }catch(e){} const d=JSON.parse(JSON.stringify(POPT0)); if(o){ if(o.growth!=null) d.growth=+o.growth||0; Object.assign(d.inc,o.inc||{}); Object.assign(d.cost,o.cost||{}); } return d; }
const saveProfitOpts=o=>{ try{ localStorage.setItem('tsdc_profit',JSON.stringify(o)); }catch(e){} };
let _pbase=null, _pmon=null;
function profitBase(){
  if(_pbase) return _pbase; const B={stripe:0,stripeN:0,stripeFees:0,amp:0,sbf:0,trans:0,tap:0,tapCharged:0};
  D.payments.forEach(r=>{ if(r[PI.source]==='Stripe'){ B.stripe+=r[PI.amount]; B.stripeFees+=r[PI.fee]; B.stripeN++; } else if(r[PI.source]==='AMP/Tap') B.amp+=r[PI.amount]; });
  D.ra.forEach(r=>{ B.sbf+=r[AI.sbf]; B.trans+=r[AI.trans]; });
  D.tap.forEach(r=>{ B.tap+=r[TI.paid]; B.tapCharged+=r[TI.charged]; });
  B.subs=allSubs().filter(s=>s.counted).reduce((a,s)=>a+s.annual,0);
  B.owed=D.balances.filter(b=>!b.paid&&b.amount>0).reduce((a,b)=>a+b.amount,0);
  return _pbase=B;
}
function profitMonthlyBase(){
  if(_pmon) return _pmon; const m={}; MONTHS.forEach(k=>m[k]={stripe:0,stripeFees:0,amp:0,sbf:0,trans:0,tap:0});
  const add=(d,f,v)=>{ const k=(d||'').slice(0,7); if(m[k]) m[k][f]+=v; };
  D.payments.forEach(r=>{ if(r[PI.source]==='Stripe'){ add(r[PI.date],'stripe',r[PI.amount]); add(r[PI.date],'stripeFees',r[PI.fee]); } else if(r[PI.source]==='AMP/Tap') add(r[PI.date],'amp',r[PI.amount]); });
  D.ra.forEach(r=>{ add(r[AI.date],'sbf',r[AI.sbf]); add(r[AI.date],'trans',r[AI.trans]); });
  D.tap.forEach(r=>{ if(r[TI.paid]>0) add(r[TI.paidDate]||r[TI.date],'tap',r[TI.paid]); });
  return _pmon=m;
}
function profitModel(growth){
  const o=profitOpts(), B=profitBase(), PM=profitMonthlyBase(), IN=monthlyInputs(), g=1+(growth||0)/100;
  const rows=MONTHS.map((k,i)=>{ const b=PM[k], x=IN[k]||{};
    const rev=((o.inc.stripe?b.stripe:0)+(o.inc.sbf?b.sbf:0)+(o.inc.trans?b.trans:0)+(o.inc.tap?b.tap:0))*g;
    const direct=((o.cost.stripeFees?b.stripeFees:0)+(o.cost.amp?b.amp:0))*g;
    const subs=o.cost.subs?B.subs/12:0, payroll=+x.payroll||0, marketing=+x.marketing||0, other=+x.other||0, adj=+x.adj||0;
    const gross=rev-direct, expenses=payroll+marketing+subs+other, net=gross-expenses+adj;
    return {k,name:MNAME[i],rev,direct,gross,payroll,marketing,subs,other,adj,expenses,net,note:x.note||'',hasData:(b.stripe+b.sbf+b.trans+b.tap)>0,entered:payroll||marketing||other||adj};
  });
  const tot=rows.reduce((a,r)=>{ for(const f of ['rev','direct','gross','payroll','marketing','subs','other','adj','expenses','net']) a[f]+=r[f]; return a; },{rev:0,direct:0,gross:0,payroll:0,marketing:0,subs:0,other:0,adj:0,expenses:0,net:0});
  tot.margin=tot.rev?tot.net/tot.rev:0; tot.entered=tot.payroll+tot.marketing+tot.other;
  const income=[
    {k:'stripe',n:'Stripe payments',v:B.stripe*g,note:`${num(B.stripeN)} payments: non-bank returns, Taxx Collab / Pro, corporate, amended, extensions`},
    {k:'sbf',n:'Service bureau fees (Refund Advantage)',v:B.sbf*g,note:'all five parent EFINs'},
    {k:'trans',n:'Transmitter fees (Refund Advantage)',v:B.trans*g,note:'per-return fee taken from refunds'},
    {k:'tap',n:'Total Audit Protection collected',v:B.tap*g,note:`${money(B.tapCharged)} charged, the rest not yet collected`}
  ].map(x=>({...x,on:!!o.inc[x.k]}));
  const direct=[
    {k:'stripeFees',n:'Stripe processing fees',v:B.stripeFees*g,note:'cost of earning the Stripe money'},
    {k:'amp',n:'AMP charges for TAP',v:B.amp*g,note:'$59.99 per TAP return'}
  ].map(x=>({...x,on:!!o.cost[x.k]}));
  return {o,B,rows,tot,income,direct};
}
function bodyProfit(){
  const M=profitModel(0), o=M.o, B=M.B, T=M.tot, IN=monthlyInputs(); const good=T.net>=0;
  const what=profitModel(o.growth).tot;
  const lineCk=(x,kind,sign)=>`<div style="align-items:flex-start"><span><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-pf="${kind}:${x.k}" ${x.on?'checked':''} style="margin-top:4px"><span><b style="font-weight:600;color:${x.on?'var(--ink)':'var(--muted)'}">${esc(x.n)}</b><div class="muted small">${esc(x.note||'')}</div></span></label></span><b style="${x.on?'':'color:var(--muted);text-decoration:line-through'}">${sign||''}${money(x.v)}</b></div>`;
  const cell=(v,opt)=>{ opt=opt||{}; const neg=v<0; return `<td class="num" style="${opt.bold?'font-weight:600;':''}${opt.color?`color:${opt.color};`:''}">${v===0&&!opt.zero?'<span class="muted">—</span>':(neg?'−':'')+money(Math.abs(v))}</td>`; };
  const pl=M.rows.map(r=>{ const muted=!r.hasData&&!r.entered; return `<tr style="${muted?'opacity:.55':''}"><td><b style="font-weight:600">${r.name}</b>${r.note?`<div class="muted small">${esc(r.note)}</div>`:''}</td>${cell(r.rev)}${cell(r.direct)}${cell(r.gross,{bold:1})}${cell(r.payroll)}${cell(r.marketing)}${cell(r.subs)}${cell(r.other)}${cell(r.adj)}${cell(r.net,{bold:1,zero:1,color:r.net<0?'var(--bad)':(r.hasData||r.entered?'var(--ok)':'')})}</tr>`; }).join('');
  const inp='border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit;width:100%;min-width:90px';
  const grid=MONTHS.map((k,i)=>{ const x=IN[k]||{}; return `<tr><td><b style="font-weight:600">${MNAME[i]}</b></td>${['payroll','marketing','other','adj'].map(f=>`<td><input type="number" step="0.01" data-pm="${k}:${f}" value="${x[f]!=null&&x[f]!==''?esc(x[f]):''}" placeholder="0" style="${inp}"></td>`).join('')}<td><input type="text" data-pm="${k}:note" value="${esc(x.note||'')}" placeholder="Note (optional)" style="${inp};min-width:160px"></td></tr>`; }).join('');
  const scen=[-20,-10,0,10,25,50].map(gr=>{ const m=profitModel(gr).tot; return {gr,rev:m.rev,exp:m.direct+m.expenses,net:m.net}; });
  return `
  ${T.entered===0&&T.adj===0?`<div class="note" style="background:#fff8e1;border-color:#f1dfa0"><b>Payroll, marketing and other costs are not entered yet.</b> Until you fill them in under “Enter your monthly costs”, the net income below is higher than the real number.</div>`:''}
  <div class="grid g4" style="margin-bottom:16px">
    ${hero('Revenue (money in)',money(T.rev),'for the months shown, from the income lines ticked below')}
    ${hero('Gross profit',money(T.gross),`after ${money(T.direct)} of Stripe fees and AMP charges`)}
    ${hero('Operating expenses',money(T.expenses),`payroll ${money(T.payroll)} · marketing ${money(T.marketing)} · subscriptions ${money(T.subs)} · other ${money(T.other)}`)}
    ${hero(good?'Net income (profit)':'Net loss',money(Math.abs(T.net)),`${(100*T.margin).toFixed(0)}% of revenue${T.adj?` · includes ${T.adj>0?'+':'−'}${money(Math.abs(T.adj))} adjustments`:''}`,good?'':'alert')}
  </div>
  <div class="card" style="margin-bottom:16px;border-left:4px solid ${good?'var(--ok)':'var(--bad)'}"><h3>In plain words</h3><div style="margin-top:6px;font-size:15px;line-height:1.6">${good?`So far in ${D.meta.season}, Taxx Savage took in <b>${money(T.rev)}</b>, paid <b>${money(T.direct+T.expenses)}</b> in costs${T.adj?` and made <b>${money(Math.abs(T.adj))}</b> of ${T.adj>0?'added':'subtracted'} adjustments`:''}, and <b>made a profit of ${money(T.net)}</b>. That is about ${money(T.net/Math.max(1,M.rows.filter(r=>r.hasData||r.entered).length))} a month on average.`:`So far in ${D.meta.season}, Taxx Savage took in <b>${money(T.rev)}</b> but paid <b>${money(T.direct+T.expenses)}</b> in costs, a <b>net loss of ${money(-T.net)}</b>.`}</div>
    <div class="small muted" style="margin-top:8px"><b>Terms:</b> Revenue is the money coming in. Direct costs are what it costs to earn it (Stripe fees, AMP charges). Gross profit is revenue minus direct costs. Operating expenses are payroll, marketing and ads, subscriptions and other expenses. Net income is gross profit minus operating expenses, plus or minus your adjustments.</div></div>
  <div class="card" style="margin-bottom:16px"><div class="cardhead"><h3>Month by month</h3><button class="btn ghost sm" data-export="profit">Export</button></div>
    <div class="tblwrap"><table><thead><tr><th>Month</th><th class="num">Revenue</th><th class="num">Direct costs</th><th class="num">Gross profit</th><th class="num">Payroll</th><th class="num">Marketing &amp; ads</th><th class="num">Subscriptions</th><th class="num">Other</th><th class="num">Adjustments</th><th class="num">Net income</th></tr></thead><tbody>${pl}
    <tr style="background:#fafbfd"><td><b>Total</b></td>${cell(T.rev,{bold:1})}${cell(T.direct,{bold:1})}${cell(T.gross,{bold:1})}${cell(T.payroll,{bold:1})}${cell(T.marketing,{bold:1})}${cell(T.subs,{bold:1})}${cell(T.other,{bold:1})}${cell(T.adj,{bold:1})}${cell(T.net,{bold:1,zero:1,color:good?'var(--ok)':'var(--bad)'})}</tr></tbody></table></div></div>
  <div class="card" style="margin-bottom:16px"><h3>Enter your monthly costs</h3><div class="sub">Type what you paid each month, then press Save. Payroll is the total pay for employees (salaries, taxes and benefits you pay). Marketing &amp; ads is what you paid for ads. Other expenses is everything else. An adjustment adds to the net income if it is positive and subtracts if it is negative (for example, -250 for a correction). Saved in this browser.</div>
    <div class="tblwrap" style="margin-top:12px"><table><thead><tr><th>Month</th><th>Payroll (employees)</th><th>Marketing &amp; ads</th><th>Other expenses</th><th>Adjustment (+ / −)</th><th>Note</th></tr></thead><tbody>
      <tr style="background:#f7f8fe"><td><b>Same every month</b></td>${['payroll','marketing','other','adj'].map(f=>`<td><input type="number" step="0.01" data-pmall="${f}" placeholder="amount" style="${inp}"></td>`).join('')}<td><button class="btn ghost sm" data-pmfill="1">Fill every month</button></td></tr>
      ${grid}</tbody></table></div>
    <div class="toolbar" style="margin-top:12px"><button class="btn" data-pmsave="1">Save</button><button class="btn ghost" data-pmclear="1">Clear all entries</button><span class="muted small">Subscriptions come from your tracker: ${money(B.subs)} a year, ${money(B.subs/12)} a month, in every month.</span></div></div>
  <div class="grid g2" style="margin-bottom:16px">
    <div class="card"><h3>Where the money comes from</h3><div class="sub">Untick a line to see the profit without it</div><div class="rows">${M.income.map(x=>lineCk(x,'inc')).join('')}<div style="border-top:1px solid var(--line);font-weight:600"><span>Total revenue</span><b>${money(T.rev)}</b></div></div>
      <h3 style="margin-top:16px">Direct costs</h3><div class="rows">${M.direct.map(x=>lineCk(x,'cost','−')).join('')}</div>
      <div class="rows"><div><span><label style="display:flex;gap:8px;cursor:pointer"><input type="checkbox" data-pf="cost:subs" ${o.cost.subs?'checked':''}><b style="font-weight:600">Subscriptions (apps and platforms)</b></label></span><b>${money(B.subs)}</b></div></div></div>
    <div class="card"><h3>What if the number of returns changes?</h3><div class="sub">Revenue and the Stripe and AMP costs move with the returns; the costs you enter stay the same.</div>
      <div class="toolbar" style="margin:12px 0 4px"><label>Change in returns <input type="number" id="pfGrowth" step="5" value="${o.growth}" style="${inp};width:90px"> %</label></div>
      <div class="rows"><div><span>With ${o.growth>0?'+':''}${o.growth}% returns, revenue</span><b>${money(what.rev)}</b></div><div><span>Net income</span><b style="color:${what.net>=0?'var(--ok)':'var(--bad)'}">${what.net<0?'−':''}${money(Math.abs(what.net))}</b></div></div>
      ${table('pfScen',[{k:'gr',h:'Returns vs now',v:r=>r.gr,f:r=>`${r.gr>0?'+':''}${r.gr}%`},{k:'rev',h:'Revenue',n:1,v:r=>r.rev,f:r=>money(r.rev)},{k:'exp',h:'Costs',n:1,v:r=>r.exp,f:r=>money(r.exp)},{k:'net',h:'Net income',n:1,v:r=>r.net,f:r=>`<b style="color:${r.net>=0?'var(--ok)':'var(--bad)'}">${r.net<0?'−':''}${money(Math.abs(r.net))}</b>`}],scen,{limit:10})}
      <h3 style="margin-top:16px">Money owed to you (not counted)</h3><div class="rows"><div><span>Balances offices owe</span><b>${money(B.owed)}</b></div><div><span>TAP charged but not collected</span><b>${money(Math.max(0,B.tapCharged-B.tap))}</b></div></div></div>
  </div>
  <div class="note"><b>How to read this:</b> it is an estimate from your reports for ${D.meta.season} (season to date), not an accounting statement. Revenue is Stripe payments (by payment date), service bureau and transmitter fees from Refund Advantage (by funding date) and TAP fees collected (by paid date). Prep fees are not counted because they go to the offices. About $960 of TAP money also appears inside Stripe, so ask your accountant before relying on exact figures.</div>`;
}
function bodyRisk(){
  const rows=visible();
  const cols=[
    {k:'o',h:'Office',v:o=>officeLabel(o),f:nameCell},
    {k:'raf',h:'RA funded returns',n:1,v:o=>st(o.id).raF,f:o=>num(st(o.id).raF)},
    {k:'tier',h:'Volume tier',v:o=>st(o.id).raF,f:o=>`<span class="chip tag">${tier(st(o.id))}</span>`},
    {k:'owed',h:'Owed',n:1,v:o=>outstanding(o.id),f:o=>outstanding(o.id)?money(outstanding(o.id),1):'—'},
    {k:'risk',h:'Risk',v:o=>({Low:0,Medium:1,High:2})[risk(o)],f:o=>riskChip(risk(o))},
    {k:'acc',h:'Prep access',v:o=>accessOff(o)&&outstanding(o.id)>0?1:0,f:accessChip},
    {k:'rel',h:'Release',v:o=>outstanding(o.id)>0?1:0,f:o=>outstanding(o.id)>0?'<span class="chip dis">On hold</span>':'<span class="chip act">Can release</span>'}
  ];
  if(!S.sort.risk) S.sort.risk={k:'risk',d:-1};
  return `<div class="card" style="margin-bottom:16px"><div class="cardhead" style="margin-bottom:6px"><h3>Volume tiers</h3></div>
    <div class="toolbar" style="margin-bottom:6px"><label>Top tier from <input type="number" id="thTop" value="${TH.top}" min="1" style="width:84px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit"> RA funded returns</label>
    <label>Mid tier from <input type="number" id="thMid" value="${TH.mid}" min="1" style="width:84px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;font:inherit"></label><span class="muted small">Placeholders · saved in this browser</span></div>
    <div class="small muted">Risk: no balance = Low · balance + Top tier = Low (the bank collects from prep fees) · balance + Mid = Medium · balance + Low tier = High. A release stays on hold while any balance is owed. Onboarding is allowed; prep access stays locked until paid.</div></div>`
    +`<div class="toolbar"><span class="tcount">${num(rows.length)} offices</span></div>`+table('risk',cols,rows,{click:o=>o.id});
}

function bodyExports(){
  const card=(id,t,d)=>`<div class="card"><h3>${t}</h3><div class="sub" style="min-height:58px;margin-top:6px">${d}</div><button class="btn" data-export="${id}" style="margin-top:12px">Download</button></div>`;
  return lookup()+`<div class="note">Exports use the segment and date range at the top of the page. The bank sheet always uses full outstanding balances. Offline, Excel files download as CSV instead.</div>
  <div class="grid g2">
   ${card('bank','Bank sheet (Excel)','EFIN offices that owe money: EFIN, office name, owner name, invoice amount, disbursement % (100), description, paid to, date. Needed before January 1.')}
   ${card('weekly','Weekly collections report','Two tabs, PTIN and EFIN: who owes what and why, return counts, invoice sent, prep access. No company revenue.')}
   ${card('writeoff','Write-off / 1099-C list','Unpaid balances split into under $100 (can be written off) and $100 or more (stay on record). Confirm the rule with the accountant.')}
   ${card('invoice','Non-bank invoice summary','EFIN offices: rate per return, non-bank returns counted from the return file, old paid, billable and invoice total next to your invoice file.')}
   ${card('offices','Office list','Offices in the current view with returns, bank, non-bank, RA funding, balance, tier and risk.')}
   ${card('collections','Balances (Collections view)','Exactly the rows on the Collections page with its current filters.')}
   ${card('disb','Disbursements by office','Every Refund Advantage fee and deduction per office (refunds, fees, offsets, advances, other, customer disbursed) in the order and filters set on the Disbursements page, with a totals row.')}
   ${card('tap','TAP by office','Total Audit Protection charged, collected and not collected per office, plus a second sheet with every TAP return (dates and amounts only).')}
   ${card('profit','Profit outlook','Money coming in, money going out and profit for the year, with the costs you added, as a spreadsheet.')}
   ${card('subs','Subscriptions','The subscription list with monthly and yearly cost and the total.')}
   ${card('stripe','Stripe payments by office','Offices with their payments, returns paid for, fees and net, in the order and filters set on the Stripe Payments page, plus a second sheet with every payment line.')}
  </div>`;
}

function validation(){
  const out=[]; D.offices.filter(o=>o.type==='EFIN'&&o.invoiceTotal!=null).forEach(o=>{
    const rows=(RET.get(o.id)||[]); const non=rows.filter(r=>!r[RI.isBank]).length;
    const billable=non-(o.oldPaid||0); const calc=billable*(o.rate||0);
    out.push({o,non,file:o.invoiceTotal,okT:non===o.invoiceTotal,billable,calc,owed:o.invoiceOwed,okO:Math.abs(calc-o.invoiceOwed)<0.5});
  }); return out;
}
function bodyHealth(){
  const v=validation(); const m=D.meta;
  const efinNoRate=D.offices.filter(o=>o.type==='EFIN'&&o.rate==null).map(o=>({o,non:(RET.get(o.id)||[]).filter(r=>!r[RI.isBank]).length})).filter(x=>x.non>0);
  const multi=D.balances.filter(b=>b.otherPtins&&b.otherPtins.length);
  const zero=D.balances.filter(b=>b.amount<=0).length;
  const unPay=D.payments.filter(p=>!p[PI.oid]); const unPaySum=unPay.reduce((a,p)=>a+p[PI.amount],0);
  const allOk=v.length&&v.every(x=>x.okT&&x.okO);
  return lookup()+`<div class="grid g4">
    ${hero('Return rows',num(m.returnCount),'both return files combined')}
    ${hero('RA funding lines',num(m.raCount),'federal + state')}
    ${hero('Offices',num(D.offices.length),D.offices.filter(o=>o.type==='EFIN').length+' EFIN · '+D.offices.filter(o=>o.type==='PTIN').length+' PTIN')}
    ${hero('Payments matched',pct(D.payments.length-unPay.length,D.payments.length),num(unPay.length)+' unmatched ('+money(unPaySum)+')')}
  </div>
  <div class="sec">Tie-out with your invoice summary ${allOk?'<span class="chip low">all match</span>':''}</div>
  <div class="note">“Total Returns” on your EFIN invoice file should equal the dashboard’s non-bank returns for that EFIN. A match means the dashboard reproduces your numbers.</div>
  ${table('val',[{k:'o',h:'EFIN',f:r=>nameCell(r.o)},{k:'non',h:'Non-bank (dashboard)',n:1,f:r=>num(r.non)},{k:'file',h:'Invoice file',n:1,f:r=>num(r.file)},{k:'okT',h:'',f:r=>r.okT?'<span class="chip low">match</span>':'<span class="chip high">differs</span>'},{k:'rate',h:'Rate',n:1,f:r=>money(r.o.rate,1)},{k:'bill',h:'Billable',n:1,f:r=>num(r.billable)},{k:'calc',h:'Calculated owed',n:1,f:r=>money(r.calc,1)},{k:'owed',h:'Invoice file owed',n:1,f:r=>money(r.owed,1)},{k:'okO',h:'',f:r=>r.okO?'<span class="chip low">match</span>':'<span class="chip high">differs</span>'}],v,{limit:50,click:r=>r.o.id})}
  <div class="sec">Needs review</div>
  <div class="grid g2">
   <div class="card"><h3>EFIN offices with non-bank returns but no rate on file</h3><div class="sub">They could be invoiced but are not on your invoice summary.</div><div style="margin-top:8px">${table('nr',[{k:'o',h:'EFIN',f:r=>nameCell(r.o)},{k:'non',h:'Non-bank returns',n:1,f:r=>num(r.non)}],efinNoRate,{limit:30,click:r=>r.o.id})}</div></div>
   <div class="card"><h3>Balances where one email matches several PTINs</h3><div class="sub">Attached to the best match; other PTINs are listed. Please confirm.</div><div style="margin-top:8px">${table('mp',[{k:'n',h:'Balance',f:b=>`<div class="name"><b>${esc(b.name||b.email)}</b><div class="s">${esc(b.email)}</div></div>`},{k:'a',h:'Owed',n:1,f:b=>money(b.amount,1)},{k:'o',h:'Attached to',f:b=>oLink(b.officeId)},{k:'p',h:'Other PTINs',f:b=>`<span class="small">${esc(b.otherPtins.join(', '))}</span>`}],multi,{limit:30})}</div></div>
  </div>
  <details><summary>How the numbers are built</summary><div class="card small" style="margin-top:8px"><ul style="margin:0;padding-left:18px;line-height:1.7">
    <li><b>Season ${m.season}, tax year ${m.taxYear}.</b> Data built ${esc(m.generated)}. ${num(zero)} balance rows have no amount; ${num(m.badPtin||0)} PTIN field that looked like an SSN was removed.</li>
    <li><b>EFIN offices</b> come from return file 094222. <b>PTIN offices</b> come from 094551 and from Taxx Savage’s own EFINs (${esc(m.ownEfins.join(', '))}), whose returns and RA funding roll up to the preparer’s PTIN.</li>
    <li><b>PTINs are grouped into offices.</b> PTINs filed under the same Office Identifier are one office (for example Jose Rios). A PTIN that appears under two Office Identifiers merges both names into one office. PTINs with no returns group by company name in the PTIN Client Reference. Balances, funding, returns and payments add up on the office.</li>
    <li>A bank-product return is bank code V (Refund Advantage) in the EFIN file and F (EPS) in the PTIN file. Everything else is non-bank. Rejected returns (${num(m.rejected)}) are counted, as in your invoice totals.</li>
    <li>RA funded returns = RA federal lines. Funded refunds and fees sum all RA lines (federal + state). Counts follow the date range at the top.</li>
    <li>Balances link to offices by email and the PTIN Client Reference. Payments (Stripe, AMP/Tap) link by email.</li>
    <li>Sources: ${m.sources.map(esc).join('; ')}.</li>
    <li>No taxpayer names, SSNs, birth dates, addresses, bank or card numbers are stored in this file.</li></ul></div></details>`;
}

const PAGES = {
  overview:{group:'Menu',title:'Overview',desc:'Season at a glance',ph:'Look up an office, EFIN, PTIN or preparer…',body:bodyOverview},
  offices:{group:'Menu',title:'Offices',desc:'Every EFIN and PTIN office. Click a row for the full profile.',ph:'Search by office name, EFIN, PTIN, preparer or email…',body:bodyOffices},
  collections:{group:'Menu',title:'Collections',desc:'Balances owed to Taxx Savage',ph:'Search balances by office, EFIN, PTIN, name or email…',body:bodyCollections},
  stripe:{group:'Payments & funding',title:'Stripe Payments',desc:'Payments received, by office. Filter, then sort by returns, amount or anything else.',ph:'Search by office, EFIN, PTIN, preparer or payer email…',body:bodyStripe},
  disb:{group:'Payments & funding',title:'Disbursements',desc:'Refund Advantage disbursements and every fee, by office. Click an office for the full breakdown.',ph:'Search by office, EFIN, PTIN or preparer…',body:bodyDisb},
  tap:{group:'Payments & funding',title:'TAP',desc:'Total Audit Protection: charged and collected, by office.',ph:'Search by office, EFIN, PTIN or preparer…',body:bodyTap},
  risk:{group:'Control',title:'Risk & Access',desc:'Volume tiers, risk, prep access and release status',ph:'Search by office, EFIN or PTIN…',body:bodyRisk},
  exports:{group:'Control',title:'Reports & Exports',desc:'Excel files for the bank, collections and your accountant',ph:'Look up an office, EFIN or PTIN…',body:bodyExports},
  health:{group:'Control',title:'Data Health',desc:'Checks against your source files',ph:'Look up an office, EFIN or PTIN…',body:bodyHealth},
  profit:{group:'Company',title:'Profit Outlook',desc:'What Taxx Savage can make in a year: money coming in, money going out, and what is left.',ph:'',body:bodyProfit,noControls:true,noSearch:true},
  subs:{group:'Company',title:'Subscriptions',desc:'Every app and platform Taxx Savage pays for, and what it costs each month.',ph:'Search subscriptions by name, category or account…',body:bodySubs,noControls:true}
};
if(extras.pages){ const old=Object.entries(PAGES), out={}; old.forEach(([k,v])=>{ out[k]=v; if(k==='collections') Object.assign(out, extras.pages); }); Object.keys(PAGES).forEach(k=>delete PAGES[k]); Object.assign(PAGES,out); }
if(extras.icons) Object.assign(ICON, extras.icons);
if(extras.startTab && PAGES[extras.startTab]) S.tab=extras.startTab;
const PAGE_TAB = {stripe:'payments',disb:'disb',tap:'tap'};

// ---------- office profile ----------
function profile(id, tab){
  const o=OFF.get(id); if(!o) return; const s=st(id); const owed=outstanding(id); const bals=BAL.get(id)||[]; const pays=(PAY.get(id)||[]).filter(r=>inRange(r[PI.date]));
  $('dt').textContent=officeLabel(o);
  $('dchips').innerHTML=typeChip(o)+o.tags.map(t=>`<span class="chip tag">${esc(t)}</span>`).join('')+accessChip(o)+(owed>0?riskChip(risk(o))+'<span class="chip tag">owes '+money(owed,1)+'</span>':'')+(officeSub(o)?`<span class="small muted">${esc(officeSub(o))}</span>`:'');
  const k=(l,v,sub)=>`<div class="k"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${sub||'&nbsp;'}</div></div>`;
  const wkAmt={}; (RAL.get(id)||[]).forEach(r=>{ if(!inRange(r[AI.date])) return; const w=wk(r[AI.date]); wkAmt[w]=(wkAmt[w]||0)+r[AI.actual]; });
  const peaks=Object.keys(wkAmt).sort((a,b)=>wkAmt[b]-wkAmt[a]).slice(0,3);
  const months=Object.keys(s.month).sort();
  // summary
  let sum=`<div class="kpis">${k('Returns',num(s.ret),`${num(s.rej)} rejected`)}${k('Bank',num(s.bank),pct(s.bank,s.ret))}${k('Non-bank',num(s.non),pct(s.non,s.ret))}${k('RA funded',num(s.raF),`${num(s.raS)} state lines`)}${k('Funded refunds',money(s.actual),'fed '+money(s.actualF))}${k('Owed',money(owed,1),bals.filter(b=>b.disabled&&!b.paid).length?'prep access off':'no hold')}</div>`;
  sum+=`<h4>Details</h4><div class="kv"><div>Type</div><div>${o.type==='EFIN'?'EFIN holder (office)':'PTIN holder (office)'}</div>`;
  if(o.efin) sum+=`<div>EFIN</div><div>${esc(o.efin)}</div>`;
  if(o.type==='PTIN'&&ptinCount(o)>1) sum+=`<div>PTINs (${ptinCount(o)})</div><div>One office. See the Inside tab for each PTIN.</div>`;
  else if(o.ptin) sum+=`<div>PTIN</div><div>${esc(o.ptin)}</div>`;
  if(o.type==='PTIN'&&o.viaEfins&&o.viaEfins.length) sum+=`<div>Files under EFIN</div><div>${esc(o.viaEfins.join(', '))}</div>`;
  if(o.ero&&o.ero.length) sum+=`<div>ERO name</div><div>${esc(o.ero.join(' / '))}</div>`;
  if(o.billName) sum+=`<div>Invoice name</div><div>${esc(o.billName)}${o.owner?` · ${esc(o.owner)}`:''}</div>`;
  if(o.company) sum+=`<div>Company (PTIN list)</div><div>${esc(o.company)}</div>`;
  if(o.emails.length) sum+=`<div>Emails</div><div>${esc(o.emails.join(', '))}</div>`;
  sum+=`</div>`;
  if(o.type==='EFIN' && o.rate!=null){
    const non=(RET.get(id)||[]).filter(r=>!r[RI.isBank]).length, bill=non-(o.oldPaid||0);
    sum+=`<h4>Non-bank invoice</h4><div class="kv"><div>Rate per return</div><div>${money(o.rate,1)}</div><div>Non-bank returns</div><div>${num(non)} <span class="muted">(invoice file ${num(o.invoiceTotal)})</span></div><div>Old paid</div><div>${num(o.oldPaid)}</div><div>Billable</div><div>${num(bill)}</div><div>Invoice total</div><div><b>${money(bill*o.rate,1)}</b> <span class="muted">(invoice file ${money(o.invoiceOwed,1)})</span></div></div>`;
  }
  // inside
  let ins='';
  ins+=o.officeIds.length?`<h4>Office identifiers on returns (${o.officeIds.length})</h4>${table('pOI'+id,[{k:'name',h:'Office identifier'},{k:'returns',h:'Returns',n:1}],o.officeIds,{limit:15})}`:'';
  ins+=o.preparers.length?`<h4>${o.type==='PTIN'?'PTINs in this office':'Preparers'} (${o.preparers.length})</h4>${table('pPr'+id,[{k:'ptin',h:'PTIN'},{k:'name',h:'Preparer'},{k:'returns',h:'Returns',n:1}],o.preparers,{limit:25})}`:'';
  if(!ins) ins='<div class="empty">No office identifiers or preparers on record.</div>';
  // funding
  let fun='';
  if(s.prep||s.sbf||s.trans) fun+=`<h4>Fees in the return file</h4><div class="kv"><div>Prep fee</div><div>${money(s.prep)} <span class="muted">(paid ${money(s.prepPaid)})</span></div><div>Service bureau</div><div>${money(s.sbf)} <span class="muted">(paid ${money(s.sbfPaid)})</span></div><div>Transmission</div><div>${money(s.trans)} <span class="muted">(paid ${money(s.transPaid)})</span></div></div>`;
  if(months.length) fun+=`<h4>Returns by month</h4><div class="chart">${barChart(months,[{n:'Returns',v:months.map(m=>s.month[m])}],['#19196d'])}</div>`;
  if(Object.keys(s.types).length) fun+=`<h4>Return types</h4>${table('pTy'+id,[{k:'t',h:'Type',f:r=>esc(r[0])},{k:'n',h:'Returns',n:1,f:r=>num(r[1])}],Object.entries(s.types).sort((a,b)=>b[1]-a[1]),{limit:20})}`;
  if(!fun) fun='<div class="empty">No funding or return activity in this date range.</div>';
  // balances + payments
  let bp=`<h4>Balances (${bals.length})</h4>`;
  bp+= bals.length ? table('pBal'+id,[{k:'type',h:'Type',f:b=>`<span class="chip tag">${esc(b.type)}</span>`},{k:'name',h:'Name',f:b=>esc(b.name||b.email)},{k:'amount',h:'Owed',n:1,f:b=>b.paid?`<s>${money(b.amount,1)}</s>`:money(b.amount,1)},{k:'st',h:'Status',f:b=>(b.paid?'<span class="chip paid">Paid</span> ':'')+(b.disabled&&!b.paid?'<span class="chip dis">Access off</span> ':'')+(b.link?`<a href="${esc(b.link)}" target="_blank" rel="noopener">invoice ↗</a>`:'')},{k:'notes',h:'Notes',f:b=>`<span class="small">${esc(b.notes)}</span>`}],bals,{limit:20}) : '<div class="muted">No balances.</div>';
  // payments (Stripe and AMP/Tap) matched to this office
  let pay='';
  if(pays.length){
    const byP={}; let tAmt=0,tFee=0,tRet=0;
    pays.forEach(r=>{ const p=prodLabel(r[PI.product])+(r[PI.source]==='Stripe'?'':' ('+r[PI.source]+')'); const e=(byP[p]=byP[p]||[0,0,0]); e[0]++; e[1]+=r[PI.amount]; e[2]+=r[PI.returns]||0; tAmt+=r[PI.amount]; tFee+=r[PI.fee]; tRet+=r[PI.returns]||0; });
    pay+=`<div class="kpis">${k('Payments',num(pays.length),pays.length?money(tAmt/pays.length,1)+' average':'')}${k('Amount paid',money(tAmt,1),'fees '+money(tFee,1))}${k('Returns paid for',num(tRet),'net '+money(tAmt-tFee,1))}</div>`;
    pay+=`<h4>By product</h4>${table('pPay'+id,[{k:'p',h:'Product',f:r=>esc(r[0])},{k:'n',h:'Payments',n:1,v:r=>r[1][0],f:r=>num(r[1][0])},{k:'rt',h:'Returns',n:1,v:r=>r[1][2],f:r=>num(r[1][2])},{k:'a',h:'Amount',n:1,v:r=>r[1][1],f:r=>money(r[1][1],1)}],Object.entries(byP).sort((a,b)=>b[1][1]-a[1][1]),{limit:20})}`;
    const lines=pays.slice().sort((a,b)=>(b[PI.date]||'').localeCompare(a[PI.date]||''));
    pay+=`<h4>Every payment (${pays.length})</h4>${table('pPayL'+id,[{k:'d',h:'Date',v:r=>r[PI.date]||'',f:r=>esc(r[PI.date]||'—')},{k:'s',h:'Source',v:r=>r[PI.source],f:r=>`<span class="chip tag">${esc(r[PI.source])}</span>`},{k:'p',h:'Product',v:r=>prodLabel(r[PI.product]),f:r=>esc(prodLabel(r[PI.product]))},{k:'r',h:'Returns',n:1,v:r=>r[PI.returns]||0,f:r=>num(r[PI.returns]||0)},{k:'a',h:'Amount',n:1,v:r=>r[PI.amount],f:r=>money(r[PI.amount],1)},{k:'f',h:'Fee',n:1,v:r=>r[PI.fee],f:r=>money(r[PI.fee],1)},{k:'e',h:'Payer',v:r=>r[PI.email],f:r=>`<span class="small">${esc(r[PI.email])}</span>`}],lines,{limit:100})}`;
  } else pay='<div class="empty">No payments matched to this office in the selected date range.</div>';
  const secs=[['summary','Summary',sum],['inside','Inside',ins],['returns','Returns',fun],['disb','Disbursements',disbDetail(o)],['tap','TAP',tapDetail(o)],['payments','Payments',pay],['balances','Balances',bp]];
  $('dtabs').innerHTML=secs.map(x=>`<button data-dtab="${x[0]}">${x[1]}</button>`).join('');
  $('db').innerHTML=secs.map(x=>`<section class="dsec" data-d="${x[0]}">${x[2]}</section>`).join('');
  showDtab(secs.some(x=>x[0]===tab)?tab:'summary'); $('drawer').classList.add('open'); $('scrim').classList.add('on'); $('db').scrollTop=0;
}
function showDtab(t){ S.dtab=t; document.querySelectorAll('#dtabs button').forEach(b=>b.classList.toggle('on',b.dataset.dtab===t)); document.querySelectorAll('#db .dsec').forEach(s=>s.classList.toggle('on',s.dataset.d===t)); }
const closeDrawer=()=>{ $('drawer').classList.remove('open'); $('scrim').classList.remove('on'); };

// ---------- exports ----------
function doExport(kind){
  const today=new Date().toISOString().slice(0,10);
  if(kind==='bank'){
    const rows=[['EFIN','Office name','Owner name','Invoice amount','Disbursement %','Description','Paid to','Date']];
    D.offices.filter(o=>o.type==='EFIN').forEach(o=>{ const amt=outstanding(o.id); if(amt>0) rows.push([o.efin,o.billName||(o.ero||[]).join(' / '),o.owner||'',amt,100,'Non-Bank','','']); });
    return exportSheets('Bank sheet '+today,[{name:'Bank sheet',rows}]);
  }
  if(kind==='weekly'){
    const mk=type=>{ const rows=[[type==='PTIN'?'Office / preparer':'EFIN office','EFIN / PTIN','Amount owed','What for','Returns (selected range)','Invoice sent','Prep access','Notes']];
      D.offices.filter(o=>o.type===type&&segOK(o)).forEach(o=>(BAL.get(o.id)||[]).forEach(b=>{ if(b.paid||b.amount<=0) return; rows.push([officeLabel(o)+(officeSub(o)?' ('+officeSub(o)+')':''),idsOf(o),b.amount,b.type,st(o.id).ret,b.link?'Yes':(b.type==='EFIN invoice'?'Not tracked in invoice file':'No'),(b.disabled?'Disabled':'Active'),b.notes||'']); }));
      return rows; };
    return exportSheets('Weekly collections '+today,[{name:'PTIN',rows:mk('PTIN')},{name:'EFIN',rows:mk('EFIN')}]);
  }
  if(kind==='writeoff'){
    const head=['Name','Email','Office','EFIN / PTIN','Type','Amount','Notes'];
    const line=b=>{ const o=b.officeId?OFF.get(b.officeId):null; return [b.name||'',b.email,o?officeLabel(o):'unmatched',o?idsOf(o):'',b.type,b.amount,b.notes||'']; };
    const open=D.balances.filter(b=>!b.paid&&b.amount>0);
    return exportSheets('Write-off list '+today,[{name:'Under $100',rows:[head,...open.filter(b=>b.amount<100).map(line)]},{name:'$100 and over',rows:[head,...open.filter(b=>b.amount>=100).map(line)]}]);
  }
  if(kind==='invoice'){
    const rows=[['EFIN','ERO / office name','Owner','PTIN','Rate per return','Non-bank returns (dashboard)','Old paid','Billable','Invoice total (calculated)','Invoice total (invoice file)']];
    D.offices.filter(o=>o.type==='EFIN'&&o.rate!=null).forEach(o=>{ const non=(RET.get(o.id)||[]).filter(r=>inRange(r[RI.transmit])&&!r[RI.isBank]).length; const bill=non-(o.oldPaid||0); rows.push([o.efin,o.billName||(o.ero||[]).join(' / '),o.owner||'',o.invPtin||'',o.rate,non,o.oldPaid||0,bill,bill*o.rate,o.invoiceOwed]); });
    return exportSheets('Non-bank invoice summary '+today,[{name:'Invoice summary',rows}]);
  }
  if(kind==='offices'){
    const rows=[['Type','EFIN','PTIN','Office','Returns','Bank','Non-bank','RA funded','Funded refunds','Owed','Tier','Risk','Prep access']];
    D.offices.filter(o=>segOK(o)&&(S.inactive||Q()||active(o))&&qOK(o,Q())).forEach(o=>{ const s=st(o.id); rows.push([o.type,o.efin,o.ptin,officeLabel(o)+(officeSub(o)?' ('+officeSub(o)+')':''),s.ret,s.bank,s.non,s.raF,Math.round(s.actual),outstanding(o.id),tier(s),risk(o),accessOff(o)&&outstanding(o.id)>0?'Disabled':'Active']); });
    return exportSheets('Offices '+today,[{name:'Offices',rows}]);
  }
  const cmpRows=(rows,cols,so,fb)=>{ const col=cols.find(c=>c.k===so.k)||cols.find(c=>c.k===fb); const f=col.v||(()=>0); return rows.slice().sort((a,b)=>{ const x=f(a), y=f(b); return (typeof x==='number'&&typeof y==='number' ? x-y : String(x).localeCompare(String(y)))*so.d; }); };
  const r2=n=>Math.round(n*100)/100;
  if(kind==='disb'){
    const {rows,tot}=disbRows(); const sorted=cmpRows(rows,DISB_COLS,S.sort.disb||{k:'actual',d:-1},'actual');
    const line=(label,type,ids,s)=>[label,type,ids,s.fed,s.state,r2(s.expected),r2(s.offset),r2(s.actual),r2(s.refProd),r2(s.prepRec),r2(s.efile),r2(s.sbf),r2(s.trans),r2(s.doc),r2(s.chk),r2(feesOf(s)),r2(s.adv),r2(s.prior),r2(s.tap),r2(s.other),r2(s.disb),s.last||''];
    const out=[['Office','Type','EFIN / PTIN','Funded returns','State lines','Expected refunds','Government offsets','Actual refunds','Refund product fee','Tax prep fees','E-file fees','Service bureau fees','Transmitter fees','Doc prep fees','Check fees','Total fees','Advance repayments','Prior-year loan debt','TAP withheld (inferred)','Other deductions (not itemized)','Customer disbursed','Last funding']];
    sorted.forEach(r=>out.push(line(officeLabel(r.o),r.o.type,idsOf(r.o),r.s))); out.push(line('TOTAL','','',tot));
    return exportSheets('Disbursements by office '+today,[{name:'By office',rows:out},{name:'Where the money goes',rows:[['Item','Amount'],...waterfall(tot).map(w=>[w[0],r2(w[1])])]}]);
  }
  if(kind==='tap'){
    const {rows,tot}=tapRows(); const sorted=cmpRows(rows,TAP_COLS,S.sort.tap||{k:'charged',d:-1},'charged');
    const head=['Office','Type','EFIN / PTIN','TAP returns','Charged','Collected (paid)','Not collected','Collected %','Paid returns','Unpaid returns','Last paid','AMP invoices paid','AMP charges'];
    const out=[head]; sorted.forEach(r=>out.push([officeLabel(r.o),r.o.type,idsOf(r.o),r.s.n,r2(r.s.charged),r2(r.s.paid),r2(owedT(r.s)),r.s.charged?r2(r.s.paid/r.s.charged):'',r.s.paidN,r.s.n-r.s.paidN,r.s.lastPaid,r2(r.s.ampPaid),r.s.ampN]));
    out.push(['TOTAL','','',tot.n,r2(tot.charged),r2(tot.paid),r2(owedT(tot)),tot.charged?r2(tot.paid/tot.charged):'',tot.paidN,tot.n-tot.paidN,'',r2(tot.ampPaid),tot.ampN]);
    const order=new Map(sorted.map((r,i)=>[r.o.id,i])); const body=[]; const F=S.tap;
    D.tap.forEach(r=>{ if(!order.has(r[TI.oid])||!inRange(r[TI.date])) return; if(F.price!=='all'&&r[TI.charged].toFixed(2)!==F.price) return; const o=OFF.get(r[TI.oid]); body.push([order.get(r[TI.oid]),r[TI.date]||'',[officeLabel(o),idsOf(o),r[TI.date],r2(r[TI.charged]),r2(r[TI.paid]),r[TI.paidDate]||'',r2(Math.max(0,r[TI.charged]-r[TI.paid]))]]); });
    const lines=[['Office','EFIN / PTIN','Transmit date','Charged','Paid','Paid date','Not collected']]; body.sort((a,b)=>a[0]-b[0]||String(b[1]).localeCompare(String(a[1]))).forEach(x=>lines.push(x[2]));
    return exportSheets('TAP by office '+today,[{name:'By office',rows:out},{name:'TAP returns',rows:lines}]);
  }
  if(kind==='profit'){
    const M=profitModel(0), T=M.tot; const head=['Month','Revenue','Direct costs (Stripe fees, AMP)','Gross profit','Payroll','Marketing & ads','Subscriptions','Other expenses','Adjustments (+/-)','Net income','Note'];
    const rows=[head]; M.rows.forEach(r=>rows.push([r.name,r2(r.rev),r2(r.direct),r2(r.gross),r2(r.payroll),r2(r.marketing),r2(r.subs),r2(r.other),r2(r.adj),r2(r.net),r.note]));
    rows.push(['TOTAL',r2(T.rev),r2(T.direct),r2(T.gross),r2(T.payroll),r2(T.marketing),r2(T.subs),r2(T.other),r2(T.adj),r2(T.net),'']);
    const sum=[['Item','Amount'],['Revenue (money in)',r2(T.rev)],['Direct costs',r2(T.direct)],['Gross profit',r2(T.gross)],['Payroll',r2(T.payroll)],['Marketing & ads',r2(T.marketing)],['Subscriptions',r2(T.subs)],['Other expenses',r2(T.other)],['Adjustments',r2(T.adj)],[T.net>=0?'NET INCOME (profit)':'NET LOSS',r2(T.net)],['Margin',(100*T.margin).toFixed(1)+'%']];
    return exportSheets('Profit and loss '+today,[{name:'Month by month',rows},{name:'Summary',rows:sum}]);
  }  if(kind==='subs'){
    const rows=subRows(); const so=S.sort.subs||{k:'monthly',d:-1};
    const keyf={monthly:s=>s.counted?s.monthly:-1,annual:s=>s.counted?s.annual:-1,amount:s=>s.amount,renewal:s=>s.renewal||'',name:s=>s.name}[so.k]||(s=>s.monthly);
    const sorted=rows.slice().sort((a,b)=>{ const x=keyf(a), y=keyf(b); return (typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y)))*so.d; });
    const out=[['Service','Category','Status','Billed','Per charge','Monthly','Yearly','Counted in totals','Last charge','Next renewal','Payment method','Account','Login page','Notes']];
    sorted.forEach(s=>{ const l=loginFor(s); out.push([s.name,s.cat||'',s.status||'Active'+(s.assumed?' (assumed monthly)':''),s.cycle||'',r2(s.amount),s.counted?r2(s.monthly):'',s.counted?r2(s.annual):'',s.counted?'Yes':'No',s.last||'',s.renewal||'',s.payment||'',s.account||'',l?l.url:'',s.notes||'']); });
    const c=sorted.filter(s=>s.counted); out.push(['TOTAL (counted)','','','','',r2(c.reduce((a,s)=>a+s.monthly,0)),r2(c.reduce((a,s)=>a+s.annual,0)),'','','','','','','']);
    return exportSheets('Subscriptions '+today,[{name:'Subscriptions',rows:out}]);
  }
  if(kind==='stripe'){
    const {rows}=stripeRows(); const so=S.sort.stripe||{k:'amt',d:-1}, F=S.stripe;
    const col=STRIPE_COLS.find(c=>c.k===so.k)||STRIPE_COLS[5]; const f=col.v||(()=>0);
    const sorted=rows.slice().sort((a,b)=>{ const x=f(a), y=f(b); return (typeof x==='number'&&typeof y==='number' ? x-y : String(x).localeCompare(String(y)))*so.d; });
    const r2=n=>Math.round(n*100)/100;
    const byOffice=[['Office','Type','EFIN / PTIN','Payments','Returns paid for','Returns filed','Amount paid','Fees','Net','Average payment','Last payment','Main product']];
    sorted.forEach(r=>{ const e=Object.entries(r.s.prod).sort((a,b)=>b[1]-a[1])[0]; byOffice.push([officeLabel(r.o),r.o.type,idsOf(r.o),r.s.n,r.s.ret,st(r.o.id).ret,r2(r.s.amt),r2(r.s.fee),r2(r.s.amt-r.s.fee),r.s.n?r2(r.s.amt/r.s.n):0,r.s.last,e?e[0]:'']); });
    const order=new Map(sorted.map((r,i)=>[r.o.id,i])); const lines=[['Office','EFIN / PTIN','Date','Source','Product','Returns','Amount','Fee','Payer email']]; const body=[];
    D.payments.forEach(r=>{ if(!order.has(r[PI.oid])) return; if(F.source!=='both'&&r[PI.source]!==F.source) return; if(!inRange(r[PI.date])) return; if(F.product!=='all'&&(r[PI.product]||'Other')!==F.product) return; const o=OFF.get(r[PI.oid]); body.push([order.get(r[PI.oid]),r[PI.date]||'',[officeLabel(o),idsOf(o),r[PI.date],r[PI.source],prodLabel(r[PI.product]),r[PI.returns]||0,r[PI.amount],r[PI.fee],r[PI.email]]]); });
    body.sort((a,b)=>a[0]-b[0]||b[1].localeCompare(a[1])).forEach(x=>lines.push(x[2]));
    return exportSheets('Stripe payments by office '+today,[{name:'By office',rows:byOffice},{name:'Payments',rows:lines}]);
  }
  if(kind==='collections'){
    const rows=[['Office','EFIN / PTIN','Name','Email','Type','Owed','Paid','Prep access off','Invoice link','Notes','Matched by']];
    balRows().forEach(b=>{ const o=b.officeId?OFF.get(b.officeId):null; rows.push([o?officeLabel(o):'unmatched',o?idsOf(o):'',b.name||'',b.email,b.type,b.amount,b.paid?'Yes':'',b.disabled?'Yes':'',b.link,b.notes||'',b.matchedBy]); });
    return exportSheets('Balances '+today,[{name:'Balances',rows}]);
  }
}

// ---------- render + events ----------
function buildMenu(){
  const counts={offices:D.offices.filter(active).length};
  let last=''; $('menu').innerHTML=Object.keys(PAGES).map(k=>{ const g=PAGES[k].group; const lab=g!==last?`<div class="lbl">${esc(g)}</div>`:''; last=g; return lab+`<button data-t="${k}" class="${S.tab===k?'on':''}">${svg(ICON[k]||ICON.overview)}<span>${PAGES[k].title}</span>${counts[k]?`<span class="count">${counts[k]}</span>`:''}</button>`; }).join('');
}
function renderBody(){ $('pg').innerHTML=PAGES[S.tab].body(); if(PAGES[S.tab].after) PAGES[S.tab].after(); }
function render(){
  buildStats(); buildMenu();
  const m=D.meta, p=PAGES[S.tab];
  $('ptitle').textContent=p.title; $('pdesc').textContent=p.desc+((S.from||S.to)?` · ${S.from||'start'} to ${S.to||'today'}`:'');
  $('sf1').textContent=`Season ${m.season} · Tax year ${m.taxYear}`; $('sf2').textContent='Data built '+m.generated;
  $('tb1').textContent='Data as of '+m.generated;
  $('seg').value=S.seg; document.querySelector('.controls').style.display=p.noControls?'none':'';
  $('main').innerHTML=(p.noSearch?'':searchBar(p.ph))+'<div id="pg"></div>'; renderBody();
}
document.addEventListener('click',e=>{
  const t=e.target;
  const th=t.closest('th[data-k]'); if(th){ const key=th.dataset.tbl, k=th.dataset.k, cur=S.sort[key]; S.sort[key]={k,d:cur&&cur.k===k?-cur.d:(['name','office','o','type'].includes(k)?1:-1)}; renderBody(); return; }
  const more=t.closest('[data-more]'); if(more){ const k=more.dataset.more; S.limit[k]=(S.limit[k]||100)+100; renderBody(); return; }
  const op=t.closest('[data-open]'); if(op){ e.preventDefault(); profile(op.dataset.open, PAGE_TAB[S.tab]||null); return; }
  const row=t.closest('[data-row]'); if(row&&row.dataset.row){ if(S.tab==='subs') subProfile(row.dataset.row); else profile(row.dataset.row, PAGE_TAB[S.tab]||null); return; }
  const sa=t.closest('[data-subadd]'); if(sa){ const nm=$('subName').value.trim(), amt=parseFloat($('subAmt').value); if(!nm||!(amt>=0)){ alert('Enter the platform name and its price.'); return; }
    const cy=$('subCycle').value; const mo=cy==='Annual'?amt/12:cy==='Quarterly'?amt/3:cy==='Weekly'?amt*52/12:amt; const a=localSubs(); a.push({name:nm,cat:$('subCat').value.trim(),monthly:Math.round(mo*100)/100,annual:Math.round(mo*1200)/100,cycle:cy,renewal:$('subRen').value,owner:'',notes:$('subNotes').value.trim()}); saveSubs(a); renderBody(); return; }
  const pmS=t.closest('[data-pmsave]'); if(pmS){ const o={}; document.querySelectorAll('[data-pm]').forEach(i=>{ const [k,f]=i.dataset.pm.split(':'); const v=f==='note'?i.value.trim():i.value; if(v!==''){ (o[k]=o[k]||{})[f]=v; } }); saveMonthly(o); renderBody(); return; }
  const pmF=t.closest('[data-pmfill]'); if(pmF){ document.querySelectorAll('[data-pmall]').forEach(a=>{ if(a.value==='') return; document.querySelectorAll(`[data-pm$=":${a.dataset.pmall}"]`).forEach(i=>{ i.value=a.value; }); }); return; }
  const pmC=t.closest('[data-pmclear]'); if(pmC){ if(confirm('Clear every monthly cost you entered?')){ saveMonthly({}); renderBody(); } return; }  const sd=t.closest('[data-subdel]'); if(sd){ const a=localSubs(); a.splice(+sd.dataset.subdel,1); saveSubs(a); renderBody(); return; }
  const ex=t.closest('[data-export]'); if(ex){ doExport(ex.dataset.export); return; }
  const pill=t.closest('.pills [data-v]'); if(pill){ S[pill.parentElement.dataset.pills]=pill.dataset.v; renderBody(); return; }
  const tb=t.closest('#menu button'); if(tb){ S.tab=tb.dataset.t; $('side').classList.remove('open'); render(); window.scrollTo(0,0); return; }
  const dt=t.closest('[data-dtab]'); if(dt){ showDtab(dt.dataset.dtab); return; }
  if(t.id==='dx'||t.id==='scrim'){ closeDrawer(); $('side').classList.remove('open'); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeDrawer(); });
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset&&t.dataset.pf){ const [kind,key]=t.dataset.pf.split(':'); const o=profitOpts(); o[kind][key]=t.checked?1:0; saveProfitOpts(o); renderBody(); }
  else if(t.id==='pfGrowth'){ const o=profitOpts(); o.growth=Math.max(-90,Math.min(300,+t.value||0)); saveProfitOpts(o); renderBody(); }
  else if(t.id==='pfTax'){ const o=profitOpts(); o.tax=Math.max(0,Math.min(60,+t.value||0)); saveProfitOpts(o); renderBody(); }
  else if(t.id==='balType'){S.balType=t.value;renderBody();} else if(t.id==='balStatus'){S.balStatus=t.value;renderBody();}
  else if(t.id==='inactive'){S.inactive=t.checked;renderBody();}
  else if(t.id==='stSource'){S.stripe.source=t.value;renderBody();}
  else if(t.id==='stProduct'){S.stripe.product=t.value;renderBody();}
  else if(t.id==='stSort'){ S.sort.stripe={k:t.value,d:t.value==='name'?1:((S.sort.stripe||{d:-1}).d)}; renderBody(); }
  else if(t.id==='stDir'){ S.sort.stripe={k:(S.sort.stripe||{k:'amt'}).k,d:+t.value}; renderBody(); }
  else if(t.id==='sbStatus'){S.subs.status=t.value;renderBody();}
  else if(t.id==='sbCat'){S.subs.cat=t.value;renderBody();}
  else if(t.id==='sbSort'){ S.sort.subs={k:t.value,d:t.value==='name'||t.value==='renewal'?1:((S.sort.subs||{d:-1}).d)}; renderBody(); }
  else if(t.id==='sbDir'){ S.sort.subs={k:(S.sort.subs||{k:'monthly'}).k,d:+t.value}; renderBody(); }
  else if(t.id==='dsFtype'){S.disb.ftype=t.value;renderBody();}
  else if(t.id==='dsDtype'){S.disb.dtype=t.value;renderBody();}
  else if(t.id==='dsSort'){ S.sort.disb={k:t.value,d:t.value==='name'?1:((S.sort.disb||{d:-1}).d)}; renderBody(); }
  else if(t.id==='dsDir'){ S.sort.disb={k:(S.sort.disb||{k:'actual'}).k,d:+t.value}; renderBody(); }
  else if(t.id==='dsNone'){S.disb.noRows=t.checked;renderBody();}
  else if(t.id==='dsOwing'){S.disb.owing=t.checked;renderBody();}
  else if(t.id==='tpStatus'){S.tap.status=t.value;renderBody();}
  else if(t.id==='tpPrice'){S.tap.price=t.value;renderBody();}
  else if(t.id==='tpSort'){ S.sort.tap={k:t.value,d:t.value==='name'?1:((S.sort.tap||{d:-1}).d)}; renderBody(); }
  else if(t.id==='tpDir'){ S.sort.tap={k:(S.sort.tap||{k:'charged'}).k,d:+t.value}; renderBody(); }
  else if(t.id==='tpNone'){S.tap.noRows=t.checked;renderBody();}
  else if(t.id==='tpOwing'){S.tap.owing=t.checked;renderBody();}
  else if(t.id==='stNoPay'){S.stripe.noPay=t.checked;renderBody();}
  else if(t.id==='stOwing'){S.stripe.owing=t.checked;renderBody();}
  else if(t.id==='thTop'||t.id==='thMid'){ const a=+$('thTop').value, b=+$('thMid').value; if(a>0&&b>0){ TH={top:Math.max(a,b),mid:Math.min(a,b)}; saveTH(); renderBody(); } }
  else if(t.id==='seg'){ S.seg=t.value; renderBody(); }
});
let qt; document.addEventListener('input',e=>{ if(e.target.id!=='pq') return; const v=e.target.value; clearTimeout(qt); qt=setTimeout(()=>{ S.qs[S.tab]=v; renderBody(); },160); });
$('from').addEventListener('change',e=>{S.from=e.target.value;render();}); $('to').addEventListener('change',e=>{S.to=e.target.value;render();});
$('reset').addEventListener('click',()=>{S.from=S.to='';$('from').value=$('to').value='';render();});
$('burger').addEventListener('click',()=>{ $('side').classList.toggle('open'); });
render();

}
