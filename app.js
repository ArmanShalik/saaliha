"use strict";

/* ══════════════════════════════════════════════
   EXAMTRACK — app.js
   All fixes applied:
   1. Checkbox double-toggle bug fixed (tgP / syncP split)
   2. Unselect bug fixed (same root cause)
   3. Overall avg = last 3 entries only
   4. Editable max marks per paper
   5. Exam type drives paper availability
      MCQ        → P1 only (auto-checked, locked)
      Essay      → P2 and/or P3 (student chooses)
      Full Paper → P1, P2, P3 (student chooses)
   6. Paper / Exam Name field added
══════════════════════════════════════════════ */

/* ── CONFIG ─────────────────────────────────── */
var STUDENT    = "Ameena Saaliha";
var SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxBOCVjqOw7aGmBbGpYPps2f9uJTVoocXWrEX2S7k1w8g57dWj-U7-MraLVA5jSSqzinQ/exec";

var SUBJECTS = [
  { id:"BIO", name:"Biology",   emoji:"🌿",
    color:"#10B981", color2:"#34D399", light:"#D1FAE5",
    papers:[
      { id:"P1", name:"Paper I",   type:"MCQ",        defaultTotal:50  },
      { id:"P2", name:"Paper II",  type:"Structured", defaultTotal:100 },
      { id:"P3", name:"Paper III", type:"Essay",      defaultTotal:100 }
    ]
  },
  { id:"PHY", name:"Physics",   emoji:"⚡",
    color:"#3B82F6", color2:"#60A5FA", light:"#DBEAFE",
    papers:[
      { id:"P1", name:"Paper I",   type:"MCQ",        defaultTotal:50  },
      { id:"P2", name:"Paper II",  type:"Structured", defaultTotal:100 },
      { id:"P3", name:"Paper III", type:"Essay",      defaultTotal:100 }
    ]
  },
  { id:"CHE", name:"Chemistry", emoji:"🧪",
    color:"#8B5CF6", color2:"#A78BFA", light:"#EDE9FE",
    papers:[
      { id:"P1", name:"Paper I",   type:"MCQ",        defaultTotal:50  },
      { id:"P2", name:"Paper II",  type:"Structured", defaultTotal:100 },
      { id:"P3", name:"Paper III", type:"Essay",      defaultTotal:100 }
    ]
  }
];

var GRADES = [
  { label:"A", min:75, color:"#059669", bg:"#D1FAE5" },
  { label:"B", min:65, color:"#2563EB", bg:"#DBEAFE" },
  { label:"C", min:55, color:"#0891B2", bg:"#CFFAFE" },
  { label:"S", min:35, color:"#D97706", bg:"#FEF3C7" },
  { label:"F", min:0,  color:"#DC2626", bg:"#FEE2E2" }
];

/* Exam type → which papers are available
   locked: paper auto-checked and cannot be unchecked */
var EXAM_PAPER_RULES = {
  "MCQ":        { available:["P1"],         locked:["P1"] },
  "Essay":      { available:["P2","P3"],    locked:[]     },
  "Full Paper": { available:["P1","P2","P3"],locked:[]    }
};

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

/* ── STATE ──────────────────────────────────── */
var entries    = [];
var activeSubj = "BIO";
var charts     = {};

/* ── STORAGE ────────────────────────────────── */
function loadE() {
  try { entries = JSON.parse(localStorage.getItem("examtrack_final") || "[]"); }
  catch(e) { entries = []; }
}
function saveE() {
  try { localStorage.setItem("examtrack_final", JSON.stringify(entries)); }
  catch(e) {}
}

/* ── HELPERS ────────────────────────────────── */
function grade(p) {
  for (var i = 0; i < GRADES.length; i++) if (p >= GRADES[i].min) return GRADES[i];
  return GRADES[GRADES.length - 1];
}
function getSubj(id) { return SUBJECTS.find(function(s) { return s.id === id; }); }

/* Average for a subject across ALL entries */
function sAvg(id) {
  var es = entries.filter(function(e) { return e.subject === id; });
  if (!es.length) return null;
  return es.reduce(function(a, e) { return a + e.pct; }, 0) / es.length;
}

/* Average for a specific paper within a subject */
function pAvg(sid, pid) {
  var tot = 0, cnt = 0;
  entries
    .filter(function(e) {
      return e.subject === sid && e.papers &&
             e.papers.some(function(p) { return p.id === pid; });
    })
    .forEach(function(e) {
      var p = e.papers.find(function(p) { return p.id === pid; });
      if (p) { tot += p.pct; cnt++; }
    });
  return cnt ? tot / cnt : null;
}

/* Average of the LAST 3 entries (any subject), sorted by date desc */
function recentAvg() {
  if (!entries.length) return null;
  var sorted = entries.slice()
    .sort(function(a, b) { return new Date(b.ts) - new Date(a.ts); })
    .slice(0, 3);
  return sorted.reduce(function(a, e) { return a + e.pct; }, 0) / sorted.length;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    var dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"2-digit" });
  } catch(e) { return d; }
}
function el(id) { return document.getElementById(id); }
function dk(k)  { if (charts[k]) { charts[k].destroy(); delete charts[k]; } }

/* ── INIT ───────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function() {
  loadE();
  initGreeting();

  /* Desktop nav tabs */
  document.querySelectorAll(".nl[data-tab]").forEach(function(b) {
    b.addEventListener("click", function() { go(b.dataset.tab); });
  });
  /* Mobile bottom nav */
  document.querySelectorAll(".bt[data-tab]").forEach(function(b) {
    b.addEventListener("click", function() { go(b.dataset.tab); });
  });

  el("addBtn").addEventListener("click", openM);
  el("fabBtn").addEventListener("click", openM);
  el("syncBtn").addEventListener("click", function() { syncG(true); });
  el("mobSync").addEventListener("click", function() { syncG(true); });
  el("mClose").addEventListener("click", closeM);
  el("cancelBtn").addEventListener("click", closeM);
  el("overlay").addEventListener("click", function(e) {
    if (e.target === el("overlay")) closeM();
  });
  document.querySelectorAll(".stab").forEach(function(b) {
    b.addEventListener("click", function() { setSubj(b.dataset.s); });
  });
  el("eForm").addEventListener("submit", function(e) { e.preventDefault(); submit(); });

  /* Exam type change drives paper availability */
  el("fExam").addEventListener("change", onExamTypeChange);

  el("fSub").addEventListener("change", renderHist);
  el("fPap").addEventListener("change", renderHist);
  el("fTyp").addEventListener("change", renderHist);
  el("viewAllBtn").addEventListener("click", function() { go("history"); });
  document.addEventListener("keydown", function(e) { if (e.key === "Escape") closeM(); });

  render();
  syncG(false);
});

/* ── GREETING ────────────────────────────────── */
function initGreeting() {
  var h = new Date().getHours();
  var g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  el("greetTime").textContent = g + ", " +
    new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" });
  el("greetName").textContent = "Ameena";
  el("greetQuote").textContent =
    "\u201c" + QUOTES[Math.floor(Math.random() * QUOTES.length)] + "\u201d";
  el("dateDisp").textContent =
    new Date().toLocaleDateString("en-GB", { day:"numeric", month:"long", year:"numeric" });
  var bubbles = [
    "Keep going, Dr. Ameena! 🩺",
    "You've got this! 💪",
    "Study hard, heal hearts ❤️",
    "One step closer! ⭐",
    "Future doctor! 🎓",
    "Never give up! 🔬"
  ];
  el("mascotBubble").textContent = bubbles[Math.floor(Math.random() * bubbles.length)];
}

/* ── TAB NAVIGATION ──────────────────────────── */
function go(tab) {
  document.querySelectorAll(".nl[data-tab]").forEach(function(b) {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".bt[data-tab]").forEach(function(b) {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll(".panel").forEach(function(p) {
    p.classList.toggle("active", p.dataset.panel === tab);
  });
  if (tab === "analytics") {
    /* Double rAF: panel must be visible + painted before Chart.js measures canvas */
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { renderAnalytics(); });
    });
  }
  if (tab === "history") renderHist();
}

/* ── RENDER ──────────────────────────────────── */
function render() { renderStats(); renderSubj(); renderRecent(); }

/* ── STATS (fix 3: recent 3 papers avg) ─────── */
function renderStats() {
  var total   = entries.length;
  var recAvg  = recentAvg();   /* last 3 entries */
  var unsync  = entries.filter(function(e) { return !e.synced; }).length;
  var bname   = "—", bavg = -1;
  SUBJECTS.forEach(function(s) {
    var a = sAvg(s.id);
    if (a !== null && a > bavg) { bavg = a; bname = s.name; }
  });

  var ICO1 = '<svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>';
  var ICO2 = '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
  var ICO3 = '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  var ICO4 = '<svg viewBox="0 0 24 24"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';

  el("statsRow").innerHTML = [
    mkStat("Total Results",   total,   "exams recorded",       "#3B82F6","#DBEAFE", ICO1),
    mkStat("Recent Average",
      recAvg !== null ? recAvg.toFixed(1)+"%" : "—",
      "last 3 papers",      "#10B981","#D1FAE5", ICO2),
    mkStat("Top Subject",     bname,   "highest average",      "#F59E0B","#FEF3C7", ICO3, true),
    mkStat("Pending Sync",    unsync,  "not yet in Sheets",    "#8B5CF6","#EDE9FE", ICO4)
  ].join("");
}
function mkStat(lbl, val, sub, ic, iac, ico, sm) {
  return '<div class="sstat" style="--ic:' + ic + ';--iac:' + iac + '">'
    + '<div class="sstat-icon">' + ico + '</div>'
    + '<div class="sstat-val"'
    + (sm ? ' style="font-size:16px;font-family:var(--fH);font-weight:900;line-height:1.3"' : '')
    + '>' + val + '</div>'
    + '<div class="sstat-lbl">' + lbl + '</div>'
    + '<div class="sstat-sub">' + sub + '</div></div>';
}

/* ── SUBJECT CARDS ───────────────────────────── */
function renderSubj() {
  el("subjRow").innerHTML = SUBJECTS.map(buildSCard).join("");
  SUBJECTS.forEach(buildMini);
}
function buildSCard(s) {
  var es  = entries.filter(function(e) { return e.subject === s.id; });
  var avg = sAvg(s.id);
  var g   = avg !== null ? grade(avg) : null;
  var avgH = avg !== null
    ? '<div class="sc-avg-n">' + avg.toFixed(1) + '</div>'
      + '<div class="sc-avg-u" style="font-size:12px;color:var(--muted)">%</div>'
      + '<div class="sc-avg-g">Grade ' + g.label + '</div>'
    : '<div class="sc-avg-n" style="color:var(--faint)">—</div>';

  var bars = s.papers.map(function(p) {
    var pa = pAvg(s.id, p.id);
    return '<div class="sc-bar-row">'
      + '<span class="sc-bar-lbl">' + p.id + '</span>'
      + '<div class="sc-bar-track" style="background:' + s.light + '">'
      + '<div class="sc-bar-fill" style="width:' + (pa !== null ? pa : 0)
      + '%;background:' + s.color + '"></div></div>'
      + '<span class="sc-bar-pct">' + (pa !== null ? pa.toFixed(0) + "%" : "—") + '</span>'
      + '</div>';
  }).join("");

  return '<div class="scard" style="--sc:' + s.color + ';--sc2:' + s.color2 + ';--sl:' + s.light + '">'
    + '<div class="sc-top">'
    + '<div class="sc-badge"><span>' + s.emoji + '</span>' + s.id + '</div>'
    + '<div class="sc-avg">' + avgH + '</div>'
    + '</div>'
    + '<div class="sc-name">' + s.name + '</div>'
    + '<div class="sc-cnt">' + es.length + ' entr' + (es.length === 1 ? 'y' : 'ies') + '</div>'
    + '<div class="sc-bars">' + bars + '</div>'
    + '<div class="sc-minichart"><canvas id="mc' + s.id + '"></canvas></div>'
    + '</div>';
}
function buildMini(s) {
  var cid = "mc" + s.id, c = el(cid);
  if (!c) return;
  dk(cid);
  var es = entries
    .filter(function(e) { return e.subject === s.id; })
    .sort(function(a, b) { return new Date(a.date) - new Date(b.date); })
    .slice(-8);
  if (!es.length) return;
  charts[cid] = new Chart(c, {
    type: "line",
    data: {
      labels: es.map(function(e) { return fmtDate(e.date); }),
      datasets: [{
        data: es.map(function(e) { return e.pct; }),
        borderColor: s.color, backgroundColor: s.color + "22",
        borderWidth: 2, pointRadius: 3, pointBackgroundColor: s.color,
        fill: true, tension: .4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } }
    }
  });
}

/* ── TABLE ROW ───────────────────────────────── */
function buildRow(e) {
  var s   = getSubj(e.subject);
  var g   = grade(e.pct);
  var cls = e.subject.toLowerCase().slice(0, 3);
  var chips = (e.papers || []).map(function(p) {
    return '<span class="pchip">' + p.id + '</span>';
  }).join("");
  var nameHtml = e.paperName
    ? '<div style="font-size:11.5px;color:var(--muted);font-weight:600;margin-top:2px">' + e.paperName + '</div>'
    : "";
  return '<tr>'
    + '<td><span class="subj-badge ' + cls + '"><span class="subj-dot"></span>'
    + (s ? s.name : e.subject) + '</span></td>'
    + '<td><div class="pchips">' + chips + '</div></td>'
    + '<td><div style="font-weight:700">' + e.examType + '</div>' + nameHtml + '</td>'
    + '<td class="datemono">' + fmtDate(e.date) + '</td>'
    + '<td class="mono">' + e.totalMarks + ' / ' + e.totalOut + '</td>'
    + '<td class="mono" style="color:' + (s ? s.color : "inherit") + ';font-weight:700">'
    + e.pct.toFixed(1) + '%</td>'
    + '<td><span class="gchip" style="background:' + g.bg + ';color:' + g.color + '">'
    + g.label + '</span></td>'
    + '<td><button class="tbl-del" onclick="delE(\'' + e.id + '\')">'
    + '<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862'
    + 'a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
    + '</button></td></tr>';
}

/* ── MOBILE ENTRY CARD ───────────────────────── */
function buildCard(e) {
  var s   = getSubj(e.subject);
  var g   = grade(e.pct);
  var cls = e.subject.toLowerCase().slice(0, 3);
  var chips = (e.papers || []).map(function(p) {
    return '<span class="pchip">' + p.id + '</span>';
  }).join("");
  return '<div class="ecard" style="--ec:' + (s ? s.color : "var(--border)") + '">'
    + '<div class="ecard-top"><div>'
    + '<div class="ecard-badges">'
    + '<span class="subj-badge ' + cls + '"><span class="subj-dot"></span>'
    + (s ? s.name : e.subject) + '</span>' + chips + '</div>'
    + '<div class="ecard-title">' + e.examType
    + (e.paperName ? ' &mdash; ' + e.paperName : '') + '</div>'
    + '<div class="ecard-meta">' + fmtDate(e.date) + '</div>'
    + '</div>'
    + '<div class="ecard-score">'
    + '<div class="ecard-pct" style="color:' + (s ? s.color : "var(--text)") + '">'
    + e.pct.toFixed(1) + '%</div>'
    + '<span class="ecard-grade" style="background:' + g.bg + ';color:' + g.color + '">'
    + 'Grade ' + g.label + '</span>'
    + '</div></div>'
    + '<div class="ecard-bar"><div class="ecard-fill" style="width:' + e.pct + '%;background:'
    + (s ? s.color : "var(--teal)") + '"></div></div>'
    + '<div class="ecard-foot">'
    + '<span class="ecard-marks">' + e.totalMarks + ' / ' + e.totalOut + ' marks</span>'
    + '<button class="ecard-del" onclick="delE(\'' + e.id + '\')">'
    + '<svg viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862'
    + 'a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
    + '</button></div></div>';
}

function emptyRow() {
  return '<tr><td colspan="8"><div class="empty-state">'
    + '<svg viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586'
    + 'a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>'
    + '<h3>No results yet</h3><p>Click "Add Result" to record your first exam.</p>'
    + '</div></td></tr>';
}
function emptyCard() {
  return '<div class="empty-state">'
    + '<svg viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586'
    + 'a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>'
    + '<h3>No results yet</h3><p>Tap + to add your first result.</p></div>';
}

function renderRecent() {
  var r = entries.slice()
    .sort(function(a, b) { return new Date(b.ts) - new Date(a.ts); })
    .slice(0, 8);
  el("recentBody").innerHTML  = r.length ? r.map(buildRow).join("") : emptyRow();
  el("recentCards").innerHTML = r.length ? r.map(buildCard).join("") : emptyCard();
}
function renderHist() {
  var es = entries.slice().sort(function(a, b) { return new Date(b.ts) - new Date(a.ts); });
  var fs = el("fSub").value, fp = el("fPap").value, ft = el("fTyp").value;
  if (fs) es = es.filter(function(e) { return e.subject === fs; });
  if (fp) es = es.filter(function(e) {
    return e.papers && e.papers.some(function(p) { return p.id === fp; });
  });
  if (ft) es = es.filter(function(e) { return e.examType === ft; });
  el("histCount").textContent = es.length + " result" + (es.length !== 1 ? "s" : "");
  el("histBody").innerHTML  = es.length ? es.map(buildRow).join("") : emptyRow();
  el("histCards").innerHTML = es.length ? es.map(buildCard).join("") : emptyCard();
}

/* ══════════════════════════════════════════════
   ANALYTICS
   Double rAF + min-height containers fix canvas
   rendering on hidden panels.
══════════════════════════════════════════════ */
function renderAnalytics() { buildProg(); buildComp(); SUBJECTS.forEach(buildDet); }

function mkChOpts(legend) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: legend
        ? { position:"bottom", labels:{ font:{ family:"Nunito",size:10,weight:"700" }, boxWidth:12, padding:14 } }
        : { display: false },
      tooltip: {
        callbacks: { label: function(c) { return c.parsed.y.toFixed(1) + "%"; } },
        backgroundColor: "#0F2744",
        titleFont: { family:"Nunito", size:11, weight:"700" },
        bodyFont:  { family:"JetBrains Mono", size:12 }
      }
    },
    scales: {
      y: { min:0, max:100, grid:{ color:"rgba(15,39,68,.04)" }, border:{ dash:[4,4] },
           ticks:{ font:{ family:"JetBrains Mono", size:9 }, callback:function(v){ return v+"%"; } } },
      x: { grid:{ display:false },
           ticks:{ font:{ family:"Nunito", size:9, weight:"700" }, maxRotation:35 } }
    }
  };
}
function buildProg() {
  dk("prog"); var c = el("cProg"); if (!c) return;
  var dates = Array.from(new Set(entries.map(function(e) { return e.date; }))).sort();
  if (!dates.length) return;
  charts["prog"] = new Chart(c, {
    type: "line",
    data: {
      labels: dates.map(fmtDate),
      datasets: SUBJECTS.map(function(s) {
        return {
          label: s.name,
          data: dates.map(function(d) {
            var es = entries.filter(function(e) { return e.subject === s.id && e.date === d; });
            return es.length ? es.reduce(function(a, e) { return a + e.pct; }, 0) / es.length : null;
          }),
          borderColor: s.color, backgroundColor: s.color + "18",
          borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: s.color,
          spanGaps: true, tension: .4, fill: false
        };
      })
    },
    options: mkChOpts(true)
  });
}
function buildComp() {
  dk("comp"); var c = el("cComp"); if (!c) return;
  charts["comp"] = new Chart(c, {
    type: "bar",
    data: {
      labels: SUBJECTS.map(function(s) { return s.name; }),
      datasets: [{
        data: SUBJECTS.map(function(s) {
          var a = sAvg(s.id); return a !== null ? parseFloat(a.toFixed(1)) : 0;
        }),
        backgroundColor: SUBJECTS.map(function(s) { return s.color + "28"; }),
        borderColor:     SUBJECTS.map(function(s) { return s.color; }),
        borderWidth: 2, borderRadius: 14, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(c) { return c.parsed.y.toFixed(1) + "%"; } } }
      },
      scales: {
        y: { min:0, max:100, ticks:{ font:{ family:"JetBrains Mono",size:9 }, callback:function(v){ return v+"%"; } } },
        x: { grid:{ display:false }, ticks:{ font:{ family:"Nunito",size:11,weight:"700" } } }
      }
    }
  });
}
function buildDet(s) {
  var idMap = { BIO:"cBio", PHY:"cPhy", CHE:"cChe" };
  dk(s.id); var c = el(idMap[s.id]); if (!c) return;
  var es = entries
    .filter(function(e) { return e.subject === s.id; })
    .sort(function(a, b) { return new Date(a.date) - new Date(b.date); })
    .slice(-12);
  if (!es.length) return;
  charts[s.id] = new Chart(c, {
    type: "bar",
    data: {
      labels: es.map(function(e) { return fmtDate(e.date); }),
      datasets: [{
        data: es.map(function(e) { return e.pct; }),
        backgroundColor: es.map(function(e) {
          return e.pct >= 75 ? s.color + "99" : e.pct >= 55 ? s.color + "55" : s.color + "22";
        }),
        borderColor: s.color, borderWidth: 1.5, borderRadius: 8, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function(c) { return c.parsed.y.toFixed(1) + "%"; } } }
      },
      scales: {
        y: { min:0, max:100, ticks:{ font:{ family:"JetBrains Mono",size:9 }, callback:function(v){ return v+"%"; } } },
        x: { grid:{ display:false }, ticks:{ font:{ family:"Nunito",size:8,weight:"700" }, maxRotation:45 } }
      }
    }
  });
}

/* ══════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════ */
function openM() {
  el("overlay").classList.add("open");
  document.body.style.overflow = "hidden";
  el("fDate").valueAsDate = new Date();
  el("eForm").reset();
  el("combPrev").classList.remove("show");
  el("papersStack").innerHTML = "";
  el("papersHint").textContent = "Select exam type first to see available papers.";
  el("papersHint").style.display = "block";
  setSubj("BIO");
}
function closeM() {
  el("overlay").classList.remove("open");
  document.body.style.overflow = "";
}
function setSubj(id) {
  activeSubj = id;
  document.querySelectorAll(".stab").forEach(function(b) {
    b.className = "stab";
    if (b.dataset.s === id) {
      var s = getSubj(id);
      if (s) b.className = "stab on-" + s.id.toLowerCase().slice(0, 3);
    }
  });
  /* Rebuild papers for current exam type + new subject */
  var examType = el("fExam").value;
  if (examType) buildPapers(id, examType);
  else {
    el("papersStack").innerHTML = "";
    el("papersHint").textContent = "Select exam type first to see available papers.";
    el("papersHint").style.display = "block";
    el("combPrev").classList.remove("show");
  }
}

/* ── FIX 5: Exam type change rebuilds paper list ── */
function onExamTypeChange() {
  var examType = el("fExam").value;
  if (!examType) {
    el("papersStack").innerHTML = "";
    el("papersHint").textContent = "Select exam type first to see available papers.";
    el("papersHint").style.display = "block";
    el("combPrev").classList.remove("show");
    return;
  }
  buildPapers(activeSubj, examType);
}

/* ── FIX 4 + 5: Build paper rows based on exam type ── */
function buildPapers(sid, examType) {
  var s = getSubj(sid); if (!s) return;
  var rules = EXAM_PAPER_RULES[examType];
  if (!rules) return;

  el("papersHint").style.display = "none";
  el("combPrev").classList.remove("show");

  /* Filter subject's papers to only those allowed by exam type */
  var availPapers = s.papers.filter(function(p) {
    return rules.available.indexOf(p.id) !== -1;
  });

  el("papersStack").innerHTML = availPapers.map(function(p) {
    var isLocked = rules.locked.indexOf(p.id) !== -1;
    return buildPaperRow(p, s, isLocked);
  }).join("");

  /* Auto-check + open locked papers (e.g. P1 for MCQ) */
  rules.locked.forEach(function(pid) {
    var cb  = el("cb" + pid);
    var row = el("pr" + pid);
    if (cb && row) { cb.checked = true; row.classList.add("on"); }
  });

  updComb();
}

function buildPaperRow(p, s, isLocked) {
  /* FIX 1 & 2: Checkbox click and div click are now handled separately.
     - Div click  → calls tgP(pid)  which manually toggles cb.checked then syncP()
     - CB  click  → calls syncP(pid) after browser has already toggled cb.checked
       stopPropagation prevents the div click from firing too (prevents double-toggle)
  */
  var lockAttr = isLocked ? " disabled" : "";
  var hintText = "Default: " + p.defaultTotal + " marks. You can change this if the paper total was different.";
  return '<div class="prow' + (isLocked ? " locked" : "") + '" id="pr' + p.id + '"'
    + ' style="--prc:' + s.color + ';--prl:' + s.light + '">'

    /* Header row — clicking anywhere on it toggles (unless locked) */
    + '<div class="prow-hd"'
    + (isLocked ? '' : ' onclick="tgP(\'' + p.id + '\')"') + '>'
    + '<div class="prow-left">'
    /* Checkbox: stopProp so div click doesn't double-fire; syncP reads checkbox state */
    + '<input type="checkbox" class="prow-cb" id="cb' + p.id + '"'
    + lockAttr
    + (isLocked ? ' checked' : '')
    + ' onclick="event.stopPropagation();syncP(\'' + p.id + '\')"'
    + ' style="--prc:' + s.color + '">'
    + '<div class="prow-info">'
    + '<div class="prow-name">' + p.name + '</div>'
    + '<div class="prow-type">' + p.type
    + (isLocked ? ' &bull; <span style="color:var(--teal);font-weight:700">included automatically</span>' : '')
    + '</div>'
    + '</div></div>'
    + '<span class="prow-preview" id="pp' + p.id + '">/ ' + p.defaultTotal + '</span>'
    + '</div>'

    /* Expandable body with marks inputs */
    + '<div class="prow-body">'
    + '<div class="marks-row">'
    + '<div class="fg2"><label class="flbl2">Marks Obtained</label>'
    + '<input class="finput" type="number" id="pm' + p.id + '"'
    + ' placeholder="e.g. 38" min="0" step="0.5" inputmode="decimal"'
    + ' oninput="onMI(\'' + p.id + '\')" style="font-size:16px"></div>'
    + '<div class="marks-sep">/</div>'
    + '<div class="fg2"><label class="flbl2">Max Marks</label>'
    /* FIX 4: total is editable, no hardcoded max — student can change it */
    + '<input class="finput" type="number" id="pt' + p.id + '"'
    + ' value="' + p.defaultTotal + '" min="1" step="1" inputmode="decimal"'
    + ' oninput="onMI(\'' + p.id + '\')" style="font-size:16px"></div>'
    + '</div>'
    + '<div class="marks-hint">' + hintText + '</div>'
    + '</div></div>';
}

/* ── FIX 1 & 2: Checkbox toggle — two separate functions ──
   tgP  → called by clicking the header DIV (not the checkbox)
           manually flips cb.checked, then calls syncP
   syncP → called by clicking the CHECKBOX directly
           reads checkbox's current state (browser already toggled it)
           and syncs the UI to match                                    */
function tgP(pid) {
  var cb  = el("cb" + pid);
  var row = el("pr" + pid);
  if (!cb || !row || cb.disabled) return;
  cb.checked = !cb.checked;   /* manual toggle since div click doesn't auto-toggle checkbox */
  syncP(pid);
}
function syncP(pid) {
  var cb  = el("cb" + pid);
  var row = el("pr" + pid);
  if (!cb || !row) return;
  row.classList.toggle("on", cb.checked);
  if (!cb.checked) {
    var mi = el("pm" + pid);
    if (mi) mi.value = "";
    var pp = el("pp" + pid);
    if (pp) { pp.textContent = "/ " + (el("pt" + pid) ? el("pt" + pid).value : ""); pp.style.color = ""; }
  }
  updComb();
}

/* ── FIX 4: onMI reads the editable total field ── */
function onMI(pid) {
  var mEl = el("pm" + pid);
  var tEl = el("pt" + pid);
  var pp  = el("pp" + pid);
  if (!mEl || !tEl || !pp) return;
  var m = parseFloat(mEl.value);
  var t = parseFloat(tEl.value);
  if (!isNaN(m) && !isNaN(t) && t > 0 && m >= 0 && m <= t) {
    var pct = (m / t) * 100;
    pp.textContent = m + "/" + t + " = " + pct.toFixed(1) + "%";
    pp.style.color = grade(pct).color;
  } else {
    pp.textContent = "/ " + (isNaN(t) ? "" : t);
    pp.style.color = "";
  }
  updComb();
}

function updComb() {
  var s = getSubj(activeSubj); if (!s) return;
  var sm = 0, st = 0, cnt = 0;
  s.papers.forEach(function(p) {
    var cb = el("cb" + p.id);
    if (!cb || !cb.checked) return;
    var m = parseFloat(el("pm" + p.id) ? el("pm" + p.id).value : "");
    var t = parseFloat(el("pt" + p.id) ? el("pt" + p.id).value : "") || p.defaultTotal;
    if (!isNaN(m) && !isNaN(t) && t > 0 && m >= 0 && m <= t) { sm += m; st += t; cnt++; }
  });
  var prev = el("combPrev");
  if (!cnt || !st) { prev.classList.remove("show"); return; }
  var pct = (sm / st) * 100, g = grade(pct);
  prev.classList.add("show");
  el("combMarks").textContent         = sm + " / " + st + " marks";
  el("combPct").textContent           = pct.toFixed(1) + "%";
  el("combFill").style.width          = pct + "%";
  el("combFill").style.background     = g.color;
  el("combGrade").textContent         = "Grade " + g.label;
  el("combGrade").style.background    = g.bg;
  el("combGrade").style.color         = g.color;
}

/* ══════════════════════════════════════════════
   SUBMIT
   Combined % = sum(marks) / sum(totals) × 100
   Uses the EDITABLE total from each paper row.
══════════════════════════════════════════════ */
function submit() {
  var exam      = el("fExam").value;
  var date      = el("fDate").value;
  var paperName = (el("fPaperName").value || "").trim();
  var notes     = (el("fNotes").value || "").trim();

  if (!exam) { notify("Please select an exam type.", "err"); return; }
  if (!date) { notify("Please select a date.", "err"); return; }

  var s = getSubj(activeSubj), papers = [];
  for (var i = 0; i < s.papers.length; i++) {
    var p  = s.papers[i];
    var cb = el("cb" + p.id);
    if (!cb || !cb.checked) continue;
    var m = parseFloat(el("pm" + p.id).value);
    var t = parseFloat(el("pt" + p.id).value) || p.defaultTotal;
    if (isNaN(m) || m < 0 || m > t) {
      notify("Invalid marks for " + p.name + ".", "err"); return;
    }
    papers.push({
      id:    p.id,
      name:  p.name,
      type:  p.type,
      marks: m,
      total: t,
      pct:   parseFloat(((m / t) * 100).toFixed(2))
    });
  }
  if (!papers.length) { notify("Please select at least one paper.", "err"); return; }

  var totalMarks = papers.reduce(function(a, p) { return a + p.marks; }, 0);
  var totalOut   = papers.reduce(function(a, p) { return a + p.total; }, 0);
  var pct        = parseFloat(((totalMarks / totalOut) * 100).toFixed(2));
  var g          = grade(pct);

  var entry = {
    id:         "ET-" + Date.now(),
    subject:    activeSubj,
    examType:   exam,
    paperName:  paperName,
    date:       date,
    papers:     papers,
    totalMarks: totalMarks,
    totalOut:   totalOut,
    pct:        pct,
    grade:      g.label,
    notes:      notes,
    ts:         new Date().toISOString(),
    synced:     false
  };

  entries.push(entry);
  saveE(); render(); closeM();
  notify("Saved — " + pct.toFixed(1) + "% (Grade " + g.label + ") 🎉", "ok");
  push(entry);
}

function delE(id) {
  if (!confirm("Remove this result? It will only be deleted locally.")) return;
  entries = entries.filter(function(e) { return e.id !== id; });
  saveE(); render(); renderHist();
  notify("Entry removed.", "info");
}

/* ══════════════════════════════════════════════
   GOOGLE SHEETS SYNC
   Content-Type: text/plain avoids CORS preflight
   with no-cors mode. Apps Script receives body via
   e.postData.contents and parses with JSON.parse().
══════════════════════════════════════════════ */
async function push(entry) {
  if (!SCRIPT_URL || SCRIPT_URL === "YOUR_URL_HERE") return;
  try {
    await fetch(SCRIPT_URL, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "add", ...entry })
    });
    var i = entries.findIndex(function(e) { return e.id === entry.id; });
    if (i !== -1) { entries[i].synced = true; saveE(); }
    renderStats();
  } catch(err) { console.warn("Sheets push:", err.message); }
}

async function syncG(manual) {
  if (!SCRIPT_URL || SCRIPT_URL === "YOUR_URL_HERE") {
    if (manual) notify("No Script URL configured yet.", "info");
    return;
  }
  [el("syncBtn"), el("mobSync")].forEach(function(b) { b.classList.add("spin"); });
  try {
    var res  = await fetch(SCRIPT_URL + "?action=getAll&t=" + Date.now());
    if (!res.ok) throw new Error("HTTP " + res.status);
    var json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length) {
      var rids  = new Set(json.data.map(function(r) { return r.id; }));
      var local = entries.filter(function(e) { return !e.synced && !rids.has(e.id); });
      entries = json.data.concat(local);
      saveE(); render();
      if (manual) notify("Synced — " + json.data.length + " results loaded. ✓", "ok");
    } else {
      if (manual) notify("Connected — no remote entries yet.", "info");
    }
    entries.filter(function(e) { return !e.synced; }).forEach(push);
  } catch(err) {
    if (manual) notify("Sync failed. Check your Script URL + deployment.", "err");
  } finally {
    [el("syncBtn"), el("mobSync")].forEach(function(b) { b.classList.remove("spin"); });
  }
}

/* ── NOTIFICATIONS ───────────────────────────── */
var NI = {
  ok:   '<svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  err:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
};
function notify(msg, type) {
  var n = document.createElement("div");
  n.className = "notif " + type;
  n.innerHTML = (NI[type] || "") + "<span>" + msg + "</span>";
  el("notifs").appendChild(n);
  setTimeout(function() {
    n.style.transition = "opacity .35s";
    n.style.opacity = "0";
    setTimeout(function() { n.remove(); }, 360);
  }, 4500);
}
