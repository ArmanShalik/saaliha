"use strict";

/* ── CONFIG ─────────────────────────────────────────────────── */
var STUDENT   = "Ameena Saaliha";
var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxBOCVjqOw7aGmBbGpYPps2f9uJTVoocXWrEX2S7k1w8g57dWj-U7-MraLVA5jSSqzinQ/exec";

var SUBJECTS = [
  { id:"BIO", name:"Biology",   emoji:"🌿", color:"#10B981", color2:"#34D399", light:"#D1FAE5", papers:[
    {id:"P1",name:"Paper I",  type:"MCQ",        total:50},
    {id:"P2",name:"Paper II", type:"Structured", total:100},
    {id:"P3",name:"Paper III",type:"Essay",      total:100}]},
  { id:"PHY", name:"Physics",   emoji:"⚡", color:"#3B82F6", color2:"#60A5FA", light:"#DBEAFE", papers:[
    {id:"P1",name:"Paper I",  type:"MCQ",        total:50},
    {id:"P2",name:"Paper II", type:"Structured", total:100},
    {id:"P3",name:"Paper III",type:"Essay",      total:100}]},
  { id:"CHE", name:"Chemistry", emoji:"🧪", color:"#8B5CF6", color2:"#A78BFA", light:"#EDE9FE", papers:[
    {id:"P1",name:"Paper I",  type:"MCQ",        total:50},
    {id:"P2",name:"Paper II", type:"Structured", total:100},
    {id:"P3",name:"Paper III",type:"Essay",      total:100}]}
];

var GRADES = [
  {label:"A",min:75,color:"#059669",bg:"#D1FAE5"},
  {label:"B",min:65,color:"#2563EB",bg:"#DBEAFE"},
  {label:"C",min:55,color:"#0891B2",bg:"#CFFAFE"},
  {label:"S",min:35,color:"#D97706",bg:"#FEF3C7"},
  {label:"F",min:0, color:"#DC2626",bg:"#FEE2E2"}
];

/* ── MOTIVATIONAL QUOTES ─────────────────────────────────────
   Personalised for Ameena — future doctor                      */
var QUOTES = [
  "Every mark you earn today writes the first page of your story as Dr. Ameena Saaliha.",
  "Medicine chose you before you chose it. These exams are just the proof.",
  "The stethoscope around your future neck starts with the textbook in your hands.",
  "Doctors aren't born in theatres — they're made in study rooms like yours.",
  "One day a patient will be grateful you stayed up late studying this.",
  "You are not just studying Biology — you are learning how life works.",
  "Future Dr. Ameena: every hard question you answer saves a future life.",
  "The gap between where you are and 'Dr.' is filled with exactly this work.",
  "Chemistry, Physics, Biology — the holy trinity of the physician you're becoming.",
  "On the hardest days remember: this is the price of the white coat, and you're paying it.",
  "Your dedication to science today is your patient's miracle tomorrow.",
  "Smart, driven, unstoppable — that's who you already are.",
  "Every A/L result you earn is another brick in the hospital where you'll one day heal people.",
  "Scientists see the world differently. So do doctors. You're becoming both.",
  "Do not be discouraged by a bad result — even the best doctors failed a paper once."
];

/* ── STATE ──────────────────────────────────────────────────── */
var entries = [], activeSubj = "BIO", charts = {};

function loadE(){ try{ entries=JSON.parse(localStorage.getItem("examtrack_final")||"[]"); }catch(e){ entries=[]; } }
function saveE(){ try{ localStorage.setItem("examtrack_final",JSON.stringify(entries)); }catch(e){} }
function grade(p){ for(var i=0;i<GRADES.length;i++) if(p>=GRADES[i].min) return GRADES[i]; return GRADES[GRADES.length-1]; }
function subj(id){ return SUBJECTS.find(function(s){return s.id===id;}); }
function sAvg(id){
  var es=entries.filter(function(e){return e.subject===id;});
  if(!es.length) return null;
  return es.reduce(function(a,e){return a+e.pct;},0)/es.length;
}
function pAvg(sid,pid){
  var tot=0,cnt=0;
  entries.filter(function(e){ return e.subject===sid&&e.papers&&e.papers.some(function(p){return p.id===pid;}); })
    .forEach(function(e){ var p=e.papers.find(function(p){return p.id===pid;}); if(p){tot+=p.pct;cnt++;} });
  return cnt ? tot/cnt : null;
}
function fmtDate(d){
  if(!d) return "—";
  try{ var dt=new Date(d+"T00:00:00"); return dt.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"}); }
  catch(e){ return d; }
}
function el(id){ return document.getElementById(id); }
function dk(k){ if(charts[k]){ charts[k].destroy(); delete charts[k]; } }

/* ── INIT ───────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function(){
  loadE();
  initGreeting();

  // Desktop nav
  document.querySelectorAll(".nl[data-tab]").forEach(function(b){
    b.addEventListener("click", function(){ go(b.dataset.tab); });
  });
  // Mobile nav
  document.querySelectorAll(".bt[data-tab]").forEach(function(b){
    b.addEventListener("click", function(){ go(b.dataset.tab); });
  });

  el("addBtn").addEventListener("click", openM);
  el("fabBtn").addEventListener("click", openM);
  el("syncBtn").addEventListener("click", function(){ syncG(true); });
  el("mobSync").addEventListener("click", function(){ syncG(true); });
  el("mClose").addEventListener("click", closeM);
  el("cancelBtn").addEventListener("click", closeM);
  el("overlay").addEventListener("click", function(e){ if(e.target===el("overlay")) closeM(); });
  document.querySelectorAll(".stab").forEach(function(b){
    b.addEventListener("click", function(){ setSubj(b.dataset.s); });
  });
  el("eForm").addEventListener("submit", function(e){ e.preventDefault(); submit(); });
  el("fSub").addEventListener("change", renderHist);
  el("fPap").addEventListener("change", renderHist);
  el("fTyp").addEventListener("change", renderHist);
  el("viewAllBtn").addEventListener("click", function(){ go("history"); });
  document.addEventListener("keydown", function(e){ if(e.key==="Escape") closeM(); });

  render();
  syncG(false);
});

/* ── GREETING ────────────────────────────────────────────────── */
function initGreeting(){
  var h = new Date().getHours();
  var greets = h<12 ? "Good morning" : h<17 ? "Good afternoon" : "Good evening";
  el("greetTime").textContent = greets + ", " + new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
  el("greetName").textContent = "Ameena";
  el("greetQuote").textContent = "\u201c" + QUOTES[Math.floor(Math.random()*QUOTES.length)] + "\u201d";
  el("dateDisp").textContent = new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  // Rotate mascot bubble messages
  var bubbles = ["Keep going, Dr. Ameena! 🩺","You've got this! 💪","Study hard, heal hearts ❤️","One step closer! ⭐","Future doctor! 🎓","Never give up! 🔬"];
  el("mascotBubble").textContent = bubbles[Math.floor(Math.random()*bubbles.length)];
}

/* ── TAB NAVIGATION ──────────────────────────────────────────── */
function go(tab){
  document.querySelectorAll(".nl[data-tab]").forEach(function(b){ b.classList.toggle("active",b.dataset.tab===tab); });
  document.querySelectorAll(".bt[data-tab]").forEach(function(b){ b.classList.toggle("active",b.dataset.tab===tab); });
  document.querySelectorAll(".panel").forEach(function(p){ p.classList.toggle("active",p.dataset.panel===tab); });
  if(tab==="analytics"){
    /* Double rAF: guarantees panel is painted + laid out before Chart.js measures canvas dimensions */
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ renderAnalytics(); }); });
  }
  if(tab==="history") renderHist();
}

/* ── FULL RENDER ─────────────────────────────────────────────── */
function render(){ renderStats(); renderSubj(); renderRecent(); }

/* ── STATS ───────────────────────────────────────────────────── */
function renderStats(){
  var total = entries.length;
  var pcts  = entries.map(function(e){return e.pct;}).filter(Number.isFinite);
  var avg   = pcts.length ? pcts.reduce(function(a,b){return a+b;},0)/pcts.length : null;
  var unsync= entries.filter(function(e){return !e.synced;}).length;
  var bname="—", bavg=-1;
  SUBJECTS.forEach(function(s){ var a=sAvg(s.id); if(a!==null&&a>bavg){bavg=a;bname=s.name;} });

  el("statsRow").innerHTML = [
    mkStat("Total Results", total, "exams recorded", "#3B82F6", "#DBEAFE",
      '<svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>'),
    mkStat("Overall Average", avg!==null?avg.toFixed(1)+"%":"—", "combined avg", "#10B981","#D1FAE5",
      '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'),
    mkStat("Top Subject", bname, "highest average", "#F59E0B","#FEF3C7",
      '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', true),
    mkStat("Pending Sync", unsync, "not yet in Sheets", "#8B5CF6","#EDE9FE",
      '<svg viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>')
  ].join("");
}
function mkStat(lbl,val,sub,ic,iac,ico,sm){
  return '<div class="sstat" style="--ic:'+ic+';--iac:'+iac+'">'
    +'<div class="sstat-icon">'+ico+'</div>'
    +'<div class="sstat-val"'+(sm?' style="font-size:17px;font-family:var(--fH);font-weight:900;line-height:1.3"':'')+'>'+val+'</div>'
    +'<div class="sstat-lbl">'+lbl+'</div>'
    +'<div class="sstat-sub">'+sub+'</div></div>';
}

/* ── SUBJECT CARDS ───────────────────────────────────────────── */
function renderSubj(){
  el("subjRow").innerHTML = SUBJECTS.map(buildSCard).join("");
  SUBJECTS.forEach(buildMini);
}
function buildSCard(s){
  var es  = entries.filter(function(e){return e.subject===s.id;});
  var avg = sAvg(s.id), g = avg!==null ? grade(avg) : null;
  var avgH = avg!==null
    ? '<div class="sc-avg-n">'+avg.toFixed(1)+'</div><div class="sc-avg-u" style="font-size:12px;color:var(--muted)">%</div><div class="sc-avg-g">Grade '+g.label+'</div>'
    : '<div class="sc-avg-n" style="color:var(--faint)">—</div>';
  var bars = s.papers.map(function(p){
    var pa = pAvg(s.id,p.id);
    return '<div class="sc-bar-row">'
      +'<span class="sc-bar-lbl">'+p.id+'</span>'
      +'<div class="sc-bar-track" style="background:'+s.light+'"><div class="sc-bar-fill" style="width:'+(pa!==null?pa:0)+'%;background:'+s.color+'"></div></div>'
      +'<span class="sc-bar-pct">'+(pa!==null?pa.toFixed(0)+"%":"—")+'</span></div>';
  }).join("");
  return '<div class="scard" style="--sc:'+s.color+';--sc2:'+s.color2+';--sl:'+s.light+'">'
    +'<div class="sc-top">'
    +'<div class="sc-badge"><span>'+s.emoji+'</span>'+s.id+'</div>'
    +'<div class="sc-avg">'+avgH+'</div>'
    +'</div>'
    +'<div class="sc-name">'+s.name+'</div>'
    +'<div class="sc-cnt">'+es.length+' entr'+(es.length===1?'y':'ies')+'</div>'
    +'<div class="sc-bars">'+bars+'</div>'
    +'<div class="sc-minichart"><canvas id="mc'+s.id+'"></canvas></div>'
    +'</div>';
}
function buildMini(s){
  var cid="mc"+s.id, c=el(cid);if(!c)return;dk(cid);
  var es=entries.filter(function(e){return e.subject===s.id;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);}).slice(-8);
  if(!es.length)return;
  charts[cid]=new Chart(c,{type:"line",
    data:{labels:es.map(function(e){return fmtDate(e.date);}),datasets:[{
      data:es.map(function(e){return e.pct;}),
      borderColor:s.color,backgroundColor:s.color+"22",borderWidth:2,
      pointRadius:3,pointBackgroundColor:s.color,fill:true,tension:.4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{x:{display:false},y:{display:false,min:0,max:100}}}});
}

/* ── TABLE ROW ───────────────────────────────────────────────── */
function buildRow(e){
  var s=subj(e.subject), g=grade(e.pct), cls=e.subject.toLowerCase().slice(0,3);
  var chips=(e.papers||[]).map(function(p){return'<span class="pchip">'+p.id+'</span>';}).join("");
  return '<tr>'
    +'<td><span class="subj-badge '+cls+'"><span class="subj-dot"></span>'+(s?s.name:e.subject)+'</span></td>'
    +'<td><div class="pchips">'+chips+'</div></td>'
    +'<td style="font-weight:600">'+e.examType+'</td>'
    +'<td class="datemono">'+fmtDate(e.date)+'</td>'
    +'<td class="mono">'+e.totalMarks+' / '+e.totalOut+'</td>'
    +'<td class="mono" style="color:'+(s?s.color:"inherit")+';font-weight:700">'+e.pct.toFixed(1)+'%</td>'
    +'<td><span class="gchip" style="background:'+g.bg+';color:'+g.color+'">'+g.label+'</span></td>'
    +'<td><button class="tbl-del" onclick="del(\''+e.id+'\')">'
    +'<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
    +'</button></td></tr>';
}

/* ── ENTRY CARD (mobile) ─────────────────────────────────────── */
function buildCard(e){
  var s=subj(e.subject), g=grade(e.pct), cls=e.subject.toLowerCase().slice(0,3);
  var chips=(e.papers||[]).map(function(p){return'<span class="pchip">'+p.id+'</span>';}).join("");
  return '<div class="ecard" style="--ec:'+(s?s.color:"var(--border)")+'">'
    +'<div class="ecard-top"><div>'
    +'<div class="ecard-badges"><span class="subj-badge '+cls+'"><span class="subj-dot"></span>'+(s?s.name:e.subject)+'</span>'+chips+'</div>'
    +'<div class="ecard-title">'+e.examType+'</div>'
    +'<div class="ecard-meta">'+fmtDate(e.date)+'</div>'
    +'</div>'
    +'<div class="ecard-score">'
    +'<div class="ecard-pct" style="color:'+(s?s.color:"var(--text)")+'">'+e.pct.toFixed(1)+'%</div>'
    +'<span class="ecard-grade" style="background:'+g.bg+';color:'+g.color+'">Grade '+g.label+'</span>'
    +'</div></div>'
    +'<div class="ecard-bar"><div class="ecard-fill" style="width:'+e.pct+'%;background:'+(s?s.color:"var(--teal)")+'"></div></div>'
    +'<div class="ecard-foot">'
    +'<span class="ecard-marks">'+e.totalMarks+' / '+e.totalOut+' marks</span>'
    +'<button class="ecard-del" onclick="del(\''+e.id+'\')">'
    +'<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
    +'</button></div></div>';
}

function emptyRow(){ return '<tr><td colspan="8"><div class="empty-state"><svg viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><h3>No results yet</h3><p>Click "Add Result" to record your first exam.</p></div></td></tr>'; }
function emptyCard(){ return '<div class="empty-state"><svg viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg><h3>No results yet</h3><p>Tap + to add your first result.</p></div>'; }

function renderRecent(){
  var r=entries.slice().sort(function(a,b){return new Date(b.ts)-new Date(a.ts);}).slice(0,8);
  el("recentBody").innerHTML = r.length ? r.map(buildRow).join("") : emptyRow();
  el("recentCards").innerHTML = r.length ? r.map(buildCard).join("") : emptyCard();
}
function renderHist(){
  var es=entries.slice().sort(function(a,b){return new Date(b.ts)-new Date(a.ts);});
  var fs=el("fSub").value, fp=el("fPap").value, ft=el("fTyp").value;
  if(fs) es=es.filter(function(e){return e.subject===fs;});
  if(fp) es=es.filter(function(e){return e.papers&&e.papers.some(function(p){return p.id===fp;});});
  if(ft) es=es.filter(function(e){return e.examType===ft;});
  el("histCount").textContent = es.length+" result"+(es.length!==1?"s":"");
  el("histBody").innerHTML  = es.length ? es.map(buildRow).join("") : emptyRow();
  el("histCards").innerHTML = es.length ? es.map(buildCard).join("") : emptyCard();
}

/* ═══════════════════════════════════════════════════
   ANALYTICS — FIXED
   Root cause of blank charts: canvases are inside
   display:none panels when JS first runs, so they
   have 0 width/height. Fix:
   1. chart-box has min-height so canvas has a size.
   2. Double rAF: ensures panel is visible + laid out
      before Chart.js measures canvas dimensions.
   3. Destroy before recreate to avoid duplicate charts.
═══════════════════════════════════════════════════ */
function renderAnalytics(){ buildProg(); buildComp(); SUBJECTS.forEach(buildDet); }

function mkChOpts(legend){
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{
      legend:legend
        ?{position:"bottom",labels:{font:{family:"Nunito",size:10,weight:"700"},boxWidth:12,padding:14}}
        :{display:false},
      tooltip:{callbacks:{label:function(c){return c.parsed.y.toFixed(1)+"%";}},
        backgroundColor:"#0F2744",titleFont:{family:"Nunito",size:11,weight:"700"},bodyFont:{family:"JetBrains Mono",size:12}}
    },
    scales:{
      y:{min:0,max:100,grid:{color:"rgba(15,39,68,.04)"},border:{dash:[4,4]},
        ticks:{font:{family:"JetBrains Mono",size:9},callback:function(v){return v+"%";}}},
      x:{grid:{display:false},
        ticks:{font:{family:"Nunito",size:9,weight:"700"},maxRotation:35}}
    }
  };
}

function buildProg(){
  dk("prog");var c=el("cProg");if(!c)return;
  var dates=Array.from(new Set(entries.map(function(e){return e.date;}))).sort();
  if(!dates.length)return;
  charts["prog"]=new Chart(c,{type:"line",
    data:{labels:dates.map(fmtDate),datasets:SUBJECTS.map(function(s){return{
      label:s.name,
      data:dates.map(function(d){
        var es=entries.filter(function(e){return e.subject===s.id&&e.date===d;});
        return es.length?es.reduce(function(a,e){return a+e.pct;},0)/es.length:null;
      }),
      borderColor:s.color,backgroundColor:s.color+"18",borderWidth:2.5,
      pointRadius:4,pointBackgroundColor:s.color,spanGaps:true,tension:.4,fill:false};})},
    options:mkChOpts(true)});
}
function buildComp(){
  dk("comp");var c=el("cComp");if(!c)return;
  charts["comp"]=new Chart(c,{type:"bar",
    data:{labels:SUBJECTS.map(function(s){return s.name;}),datasets:[{
      data:SUBJECTS.map(function(s){var a=sAvg(s.id);return a!==null?parseFloat(a.toFixed(1)):0;}),
      backgroundColor:SUBJECTS.map(function(s){return s.color+"28";}),
      borderColor:SUBJECTS.map(function(s){return s.color;}),
      borderWidth:2,borderRadius:14,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return c.parsed.y.toFixed(1)+"%";}}}},
      scales:{y:{min:0,max:100,ticks:{font:{family:"JetBrains Mono",size:9},callback:function(v){return v+"%";}}},
              x:{grid:{display:false},ticks:{font:{family:"Nunito",size:11,weight:"700"}}}}}});
}
function buildDet(s){
  var idMap={BIO:"cBio",PHY:"cPhy",CHE:"cChe"};
  dk(s.id);var c=el(idMap[s.id]);if(!c)return;
  var es=entries.filter(function(e){return e.subject===s.id;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);}).slice(-12);
  if(!es.length)return;
  charts[s.id]=new Chart(c,{type:"bar",
    data:{labels:es.map(function(e){return fmtDate(e.date);}),datasets:[{
      data:es.map(function(e){return e.pct;}),
      backgroundColor:es.map(function(e){return e.pct>=75?s.color+"99":e.pct>=55?s.color+"55":s.color+"22";}),
      borderColor:s.color,borderWidth:1.5,borderRadius:8,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return c.parsed.y.toFixed(1)+"%";}}}},
      scales:{y:{min:0,max:100,ticks:{font:{family:"JetBrains Mono",size:9},callback:function(v){return v+"%";}}},
              x:{grid:{display:false},ticks:{font:{family:"Nunito",size:8,weight:"700"},maxRotation:45}}}}});
}

/* ══════════════════════════════════════════════════
   MODAL — Add Entry
══════════════════════════════════════════════════ */
function openM(){
  el("overlay").classList.add("open");
  document.body.style.overflow="hidden";
  el("fDate").valueAsDate=new Date();
  el("eForm").reset();
  el("combPrev").classList.remove("show");
  setSubj("BIO");
}
function closeM(){
  el("overlay").classList.remove("open");
  document.body.style.overflow="";
}

function setSubj(id){
  activeSubj=id;
  document.querySelectorAll(".stab").forEach(function(b){
    b.className="stab";
    if(b.dataset.s===id){ var s=subj(id); if(s) b.className="stab on-"+s.id.toLowerCase().slice(0,3); }
  });
  buildPapers(id);
}

function buildPapers(sid){
  var s=subj(sid); if(!s) return;
  el("papersStack").innerHTML = s.papers.map(function(p){
    return '<div class="prow" id="pr'+p.id+'" style="--prc:'+s.color+';--prl:'+s.light+'">'
      +'<div class="prow-hd" onclick="tgP(\''+p.id+'\')">'
      +'<div class="prow-left">'
      +'<input type="checkbox" class="prow-cb" id="cb'+p.id+'" style="--prc:'+s.color+'" onclick="event.stopPropagation();tgP(\''+p.id+'\')">'
      +'<div class="prow-info"><div class="prow-name">'+p.name+'</div><div class="prow-type">'+p.type+' &bull; max '+p.total+' marks</div></div>'
      +'</div>'
      +'<span class="prow-preview" id="pp'+p.id+'">/ '+p.total+'</span>'
      +'</div>'
      +'<div class="prow-body">'
      +'<div class="marks-row">'
      +'<div class="fg2"><label class="flbl2">Marks Obtained</label>'
      +'<input class="finput" type="number" id="pm'+p.id+'" placeholder="0" min="0" max="'+p.total+'" step="0.5" inputmode="decimal" oninput="onMI(\''+p.id+'\','+p.total+')" style="font-size:16px"></div>'
      +'<div class="marks-sep">/</div>'
      +'<div class="fg2"><label class="flbl2">Total Marks</label>'
      +'<input class="finput" type="number" id="pt'+p.id+'" value="'+p.total+'" min="1" step="1" inputmode="decimal" oninput="onMI(\''+p.id+'\',null)" style="font-size:16px"></div>'
      +'</div>'
      +'<div class="marks-hint">Default total: '+p.total+' marks. Change only if your paper had a different total.</div>'
      +'</div></div>';
  }).join("");
}

function tgP(pid){
  var row=el("pr"+pid), cb=el("cb"+pid); if(!row||!cb) return;
  cb.checked=!cb.checked;
  row.classList.toggle("on",cb.checked);
  if(!cb.checked){ var mi=el("pm"+pid); if(mi)mi.value=""; }
  updComb();
}
function onMI(pid,def){
  var m=parseFloat(el("pm"+pid).value), t=parseFloat(el("pt"+pid).value)||def, pp=el("pp"+pid);
  if(!isNaN(m)&&t>0&&m>=0&&m<=t){
    var pct=(m/t)*100; pp.textContent=m+"/"+t+" = "+pct.toFixed(1)+"%";
    pp.style.color=grade(pct).color;
  } else { pp.textContent="/ "+(t||""); pp.style.color=""; }
  updComb();
}
function updComb(){
  var s=subj(activeSubj); if(!s) return;
  var sm=0, st=0, cnt=0;
  s.papers.forEach(function(p){
    var cb=el("cb"+p.id); if(!cb||!cb.checked) return;
    var m=parseFloat(el("pm"+p.id).value), t=parseFloat(el("pt"+p.id).value)||p.total;
    if(!isNaN(m)&&m>=0&&m<=t){ sm+=m; st+=t; cnt++; }
  });
  var prev=el("combPrev");
  if(!cnt||!st){ prev.classList.remove("show"); return; }
  var pct=(sm/st)*100, g=grade(pct);
  prev.classList.add("show");
  el("combMarks").textContent = sm+" / "+st+" marks";
  el("combPct").textContent   = pct.toFixed(1)+"%";
  el("combFill").style.width  = pct+"%";
  el("combFill").style.background = g.color;
  el("combGrade").textContent = "Grade "+g.label;
  el("combGrade").style.background = g.bg;
  el("combGrade").style.color      = g.color;
}

/* ══════════════════════════════════════════════════
   SUBMIT
   Grade = sum(all paper marks) / sum(all paper totals) × 100
   This is the correct combined percentage, NOT the average
   of individual paper percentages.
══════════════════════════════════════════════════ */
function submit(){
  var exam=el("fExam").value, date=el("fDate").value, notes=el("fNotes").value.trim();
  if(!exam){ notify("Please select an exam type.","err"); return; }
  if(!date){ notify("Please select a date.","err"); return; }

  var s=subj(activeSubj), papers=[];
  for(var i=0;i<s.papers.length;i++){
    var p=s.papers[i], cb=el("cb"+p.id);
    if(!cb||!cb.checked) continue;
    var m=parseFloat(el("pm"+p.id).value), t=parseFloat(el("pt"+p.id).value)||p.total;
    if(isNaN(m)||m<0||m>t){ notify("Invalid marks for "+p.name+".","err"); return; }
    papers.push({id:p.id,name:p.name,type:p.type,marks:m,total:t,pct:parseFloat(((m/t)*100).toFixed(2))});
  }
  if(!papers.length){ notify("Please select at least one paper.","err"); return; }

  var totalMarks = papers.reduce(function(a,p){return a+p.marks;},0);
  var totalOut   = papers.reduce(function(a,p){return a+p.total;},0);
  var pct        = parseFloat(((totalMarks/totalOut)*100).toFixed(2));
  var g          = grade(pct);

  var entry = {
    id:"ET-"+Date.now(), subject:activeSubj, examType:exam, date:date,
    papers:papers, totalMarks:totalMarks, totalOut:totalOut,
    pct:pct, grade:g.label, notes:notes,
    ts:new Date().toISOString(), synced:false
  };

  entries.push(entry);
  saveE(); render(); closeM();
  notify("Saved — "+pct.toFixed(1)+"% (Grade "+g.label+") 🎉","ok");
  push(entry);
}

function del(id){
  if(!confirm("Remove this result? It will only be deleted locally.")) return;
  entries=entries.filter(function(e){return e.id!==id;});
  saveE(); render(); renderHist();
  notify("Entry removed.","info");
}

/* ══════════════════════════════════════════════════
   GOOGLE SHEETS SYNC
   KEY FIX: Content-Type must be "text/plain" with no-cors.
   "application/json" triggers a CORS preflight OPTIONS request
   that Apps Script cannot respond to — the POST body is blocked.
   "text/plain" is a "simple request" — no preflight — body arrives.
   Apps Script reads it via e.postData.contents and JSON.parse().
══════════════════════════════════════════════════ */
async function push(entry){
  if(!SCRIPT_URL||SCRIPT_URL==="YOUR_URL_HERE") return;
  try{
    await fetch(SCRIPT_URL,{
      method:"POST", mode:"no-cors",
      headers:{"Content-Type":"text/plain"},
      body:JSON.stringify({action:"add",...entry})
    });
    var i=entries.findIndex(function(e){return e.id===entry.id;});
    if(i!==-1){entries[i].synced=true;saveE();}
    renderStats();
  }catch(err){ console.warn("Sheets push:",err.message); }
}

async function syncG(manual){
  if(!SCRIPT_URL||SCRIPT_URL==="YOUR_URL_HERE"){
    if(manual) notify("No Script URL configured yet.","info");
    return;
  }
  [el("syncBtn"),el("mobSync")].forEach(function(b){b.classList.add("spin");});
  try{
    var res=await fetch(SCRIPT_URL+"?action=getAll&t="+Date.now());
    if(!res.ok) throw new Error("HTTP "+res.status);
    var json=await res.json();
    if(json.success&&Array.isArray(json.data)&&json.data.length){
      var rids=new Set(json.data.map(function(r){return r.id;}));
      var local=entries.filter(function(e){return !e.synced&&!rids.has(e.id);});
      entries=json.data.concat(local);
      saveE(); render();
      if(manual) notify("Synced — "+json.data.length+" results loaded. ✓","ok");
    }else{
      if(manual) notify("Connected — no remote data yet.","info");
    }
    entries.filter(function(e){return !e.synced;}).forEach(push);
  }catch(err){
    if(manual) notify("Sync failed. Check your Script URL + deployment.","err");
  }finally{
    [el("syncBtn"),el("mobSync")].forEach(function(b){b.classList.remove("spin");});
  }
}

/* ── NOTIFICATIONS ───────────────────────────────────────────── */
var NI={
  ok:'<svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  err:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
};
function notify(msg,type){
  var n=document.createElement("div"); n.className="notif "+type;
  n.innerHTML=(NI[type]||"")+"<span>"+msg+"</span>";
  el("notifs").appendChild(n);
  setTimeout(function(){ n.style.transition="opacity .35s"; n.style.opacity="0"; setTimeout(function(){n.remove();},360); },4500);
}
