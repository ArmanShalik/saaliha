/* ============================================================
   ExamTrack — Application Logic
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
const State = {
  entries: [],           // all mark entries
  activeTab: 'dashboard',
  activeFormSubject: null,
  charts: {},            // Chart.js instances keyed by canvas id
  syncing: false,
  filterSubject: 'ALL',
  filterPaper: 'ALL',
  filterExam: 'ALL',
};

// ── Storage helpers ───────────────────────────────────────────
const Store = {
  key: 'examtrack_entries',
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  save(entries) {
    try { localStorage.setItem(this.key, JSON.stringify(entries)); } catch {}
  }
};

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  State.entries = Store.load();

  // Pre-set form subject from config defaults
  if (CONFIG.SUBJECTS.length > 0) {
    State.activeFormSubject = CONFIG.SUBJECTS[0].id;
  }

  renderAll();
  setupListeners();
  syncFromSheets();   // background sync – no blocking
});

// ── Event Listeners ───────────────────────────────────────────
function setupListeners() {
  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Sync button
  document.getElementById('syncBtn').addEventListener('click', () => syncFromSheets(true));

  // Add entry button
  document.getElementById('addBtn').addEventListener('click', openModal);

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalBackdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Subject tabs inside form
  document.querySelectorAll('.subj-tab').forEach(btn => {
    btn.addEventListener('click', () => selectFormSubject(btn.dataset.subject));
  });

  // Paper select → auto fill total & type
  document.getElementById('fPaper').addEventListener('change', onPaperChange);

  // Live preview
  document.getElementById('fMarks').addEventListener('input', updatePreview);
  document.getElementById('fTotal').addEventListener('input', updatePreview);

  // Form submit
  document.getElementById('entryForm').addEventListener('submit', handleSubmit);

  // History filters
  ['histSubject', 'histPaper', 'histExam'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderHistory);
  });

  // Escape key closes modal
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

// ── Tab navigation ────────────────────────────────────────────
function switchTab(tab) {
  State.activeTab = tab;
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
  if (tab === 'analytics') setTimeout(renderAnalytics, 60);
}

// ── Render all ────────────────────────────────────────────────
function renderAll() {
  populateStudentName();
  renderDashboard();
  renderHistory();
}

function populateStudentName() {
  const el = document.getElementById('studentName');
  if (el) el.textContent = CONFIG.STUDENT_NAME || 'Student';
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  renderStatsStrip();
  CONFIG.SUBJECTS.forEach(s => renderSubjectCard(s));
  renderRecentTable();
}

function renderStatsStrip() {
  const total   = State.entries.length;
  const allPcts = State.entries.map(e => e.percentage).filter(Number.isFinite);
  const avg     = allPcts.length ? (allPcts.reduce((a,b)=>a+b,0)/allPcts.length) : null;

  // Best subject
  let bestSubj = '—';
  let bestPct  = -1;
  CONFIG.SUBJECTS.forEach(s => {
    const avg = subjectAvg(s.id);
    if (avg !== null && avg > bestPct) { bestPct = avg; bestSubj = s.name; }
  });

  // Pending sync (unsaved to sheets)
  const unsynced = State.entries.filter(e => !e.synced).length;

  setElText('statTotal',   total);
  setElText('statAvg',     avg !== null ? avg.toFixed(1)+'%' : '—');
  setElText('statBest',    bestSubj);
  setElText('statPending', unsynced);
}

function renderSubjectCard(subj) {
  const cardId = 'card-' + subj.id.toLowerCase();
  const card   = document.getElementById(cardId);
  if (!card) return;

  const entries = State.entries.filter(e => e.subject === subj.id);
  const avg     = subjectAvg(subj.id);
  const grade   = avg !== null ? getGrade(avg) : '—';

  card.style.setProperty('--s-color', subj.color);
  card.style.setProperty('--s-light', subj.colorLight);

  setElText(cardId + '-count',  entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies'));
  setElHTML(cardId + '-avg',    avg !== null
    ? `<span class="avg-num">${avg.toFixed(1)}</span><span class="avg-unit">%</span><br><span class="avg-grade">${grade}</span>`
    : `<span class="avg-num" style="color:var(--text-faint)">—</span>`
  );

  // Paper bars
  const barsEl = document.getElementById(cardId + '-bars');
  if (barsEl) {
    barsEl.innerHTML = subj.papers.map(p => {
      const papEntries = entries.filter(e => e.paper === p.id);
      const pAvg = papEntries.length
        ? papEntries.reduce((a,e)=>a+e.percentage,0)/papEntries.length
        : null;
      const pct = pAvg !== null ? pAvg.toFixed(0) : '—';
      const fill = pAvg !== null ? pAvg : 0;
      return `
        <div class="paper-bar-row">
          <span class="paper-bar-label">${p.id}</span>
          <div class="paper-bar-track">
            <div class="paper-bar-fill" style="width:${fill}%;background:${subj.color}"></div>
          </div>
          <span class="paper-bar-pct">${pct !== '—' ? pct+'%' : '—'}</span>
        </div>`;
    }).join('');
  }

  // Mini sparkline chart
  renderMiniChart(subj, cardId + '-chart');
}

function renderMiniChart(subj, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Last 8 entries for this subject
  const entries = State.entries
    .filter(e => e.subject === subj.id)
    .sort((a,b) => new Date(a.date) - new Date(b.date))
    .slice(-8);

  const labels = entries.map(e => e.paper);
  const data   = entries.map(e => e.percentage);

  // Destroy existing
  if (State.charts[canvasId]) { State.charts[canvasId].destroy(); }

  if (!entries.length) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    return;
  }

  State.charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: subj.color,
        backgroundColor: subj.color + '20',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: subj.color,
        fill: true,
        tension: .4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ctx.parsed.y.toFixed(1) + '%' },
        backgroundColor: '#0F1729', titleFont: { family: 'Montserrat', size: 11 },
        bodyFont: { family: 'JetBrains Mono', size: 12 }
      }},
      scales: {
        x: { display: false },
        y: { display: false, min: 0, max: 100 }
      }
    }
  });
}

function renderRecentTable() {
  const tbody = document.getElementById('recentTbody');
  const recent = [...State.entries]
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8);

  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="8">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <h3>No entries yet</h3>
        <p>Click "Add Entry" to record your first exam result.</p>
      </div></td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(e => entryRow(e)).join('');
}

function entryRow(e) {
  const subj    = CONFIG.SUBJECTS.find(s => s.id === e.subject);
  const paper   = subj?.papers.find(p => p.id === e.paper);
  const g       = getGrade(e.percentage);
  const gStyle  = gradeStyle(g);
  const cls     = e.subject.toLowerCase().slice(0,4);
  return `
    <tr>
      <td><span class="subject-badge ${cls}"><span class="dot"></span>${subj?.name || e.subject}</span></td>
      <td class="marks-mono">${paper?.name || e.paper}</td>
      <td>${e.examType}</td>
      <td class="date-mono">${formatDate(e.date)}</td>
      <td class="marks-mono">${e.marks} / ${e.total}</td>
      <td class="pct-cell" style="color:${subj?.color}">${e.percentage.toFixed(1)}%</td>
      <td><span class="grade-chip" style="background:${gStyle.bg};color:${gStyle.color}">${g}</span></td>
      <td>
        <button class="delete-btn" onclick="deleteEntry('${e.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </td>
    </tr>`;
}

// ── History Tab ───────────────────────────────────────────────
function renderHistory() {
  const sub   = document.getElementById('histSubject')?.value || 'ALL';
  const paper = document.getElementById('histPaper')?.value   || 'ALL';
  const exam  = document.getElementById('histExam')?.value    || 'ALL';

  let entries = [...State.entries].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (sub   !== 'ALL') entries = entries.filter(e => e.subject  === sub);
  if (paper !== 'ALL') entries = entries.filter(e => e.paper    === paper);
  if (exam  !== 'ALL') entries = entries.filter(e => e.examType === exam);

  const tbody = document.getElementById('histTbody');
  if (!entries.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
      <h3>No entries match these filters.</h3></div></td></tr>`;
    return;
  }
  tbody.innerHTML = entries.map(e => entryRow(e)).join('');

  setElText('histCount', entries.length + ' result' + (entries.length!==1?'s':''));
}

// ── Analytics Tab ─────────────────────────────────────────────
function renderAnalytics() {
  renderProgressChart();
  renderSubjectCompareChart();
  CONFIG.SUBJECTS.forEach(s => renderSubjectDetailChart(s));
}

function renderProgressChart() {
  const canvas = document.getElementById('progressChart');
  if (!canvas) return;
  if (State.charts['progressChart']) State.charts['progressChart'].destroy();

  // Collect all dates sorted
  const allEntries = [...State.entries].sort((a,b)=>new Date(a.date)-new Date(b.date));
  if (!allEntries.length) return;

  const labels   = [...new Set(allEntries.map(e=>e.date))].sort();
  const datasets = CONFIG.SUBJECTS.map(s => ({
    label: s.name,
    data: labels.map(d => {
      const dayEntries = allEntries.filter(e=>e.subject===s.id && e.date===d);
      return dayEntries.length ? dayEntries.reduce((a,e)=>a+e.percentage,0)/dayEntries.length : null;
    }),
    borderColor: s.color,
    backgroundColor: s.color+'18',
    borderWidth: 2.5,
    pointRadius: 4,
    pointBackgroundColor: s.color,
    spanGaps: true,
    tension: .4,
    fill: false
  }));

  State.charts['progressChart'] = new Chart(canvas, {
    type: 'line',
    data: { labels: labels.map(d=>formatDate(d)), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Montserrat', size: 11, weight: '600' }, boxWidth: 12, padding: 16 }}},
      scales: {
        y: { min:0, max:100, grid:{ color:'rgba(15,23,42,.05)' }, ticks:{ font:{family:'JetBrains Mono',size:11}, callback:v=>v+'%' }},
        x: { grid:{ display:false }, ticks:{ font:{family:'Montserrat',size:10,weight:'600'}, maxRotation:30 }}
      }
    }
  });
}

function renderSubjectCompareChart() {
  const canvas = document.getElementById('compareChart');
  if (!canvas) return;
  if (State.charts['compareChart']) State.charts['compareChart'].destroy();

  const labels = CONFIG.SUBJECTS.map(s=>s.name);
  const avgs   = CONFIG.SUBJECTS.map(s=>{
    const avg = subjectAvg(s.id);
    return avg !== null ? parseFloat(avg.toFixed(1)) : 0;
  });
  const colors  = CONFIG.SUBJECTS.map(s=>s.color);
  const bgs     = CONFIG.SUBJECTS.map(s=>s.color+'30');

  State.charts['compareChart'] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Average %', data: avgs, backgroundColor: bgs, borderColor: colors, borderWidth: 2, borderRadius: 8 }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ display:false } },
      scales: {
        y: { min:0, max:100, grid:{ color:'rgba(15,23,42,.05)' }, ticks:{ font:{family:'JetBrains Mono',size:11}, callback:v=>v+'%' }},
        x: { grid:{ display:false }, ticks:{ font:{family:'Montserrat',size:12,weight:'700'} }}
      }
    }
  });
}

function renderSubjectDetailChart(subj) {
  const canvasId = 'detail-'+subj.id.toLowerCase();
  const canvas   = document.getElementById(canvasId);
  if (!canvas) return;
  if (State.charts[canvasId]) State.charts[canvasId].destroy();

  const entries = State.entries.filter(e=>e.subject===subj.id)
    .sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-10);
  if (!entries.length) return;

  State.charts[canvasId] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: entries.map(e=>e.paper+' '+formatDate(e.date)),
      datasets:[{
        data: entries.map(e=>e.percentage),
        backgroundColor: entries.map(e=>e.percentage>=75?subj.color+'80':e.percentage>=55?subj.color+'40':subj.color+'20'),
        borderColor: subj.color,
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{label:c=>c.parsed.y.toFixed(1)+'%'} }},
      scales:{
        y:{min:0,max:100,grid:{color:'rgba(15,23,42,.05)'},ticks:{font:{family:'JetBrains Mono',size:10},callback:v=>v+'%'}},
        x:{grid:{display:false},ticks:{font:{family:'Montserrat',size:9},maxRotation:45}}
      }
    }
  });
}

// ── Modal / Form ──────────────────────────────────────────────
function openModal() {
  document.getElementById('modalBackdrop').classList.add('open');
  selectFormSubject(State.activeFormSubject || CONFIG.SUBJECTS[0]?.id);
  resetForm();
  document.getElementById('fDate').valueAsDate = new Date();
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}

function selectFormSubject(id) {
  State.activeFormSubject = id;
  document.querySelectorAll('.subj-tab').forEach(b => {
    const isActive = b.dataset.subject === id;
    b.classList.toggle('active', isActive);
    const subj = CONFIG.SUBJECTS.find(s=>s.id===id);
    if (isActive && subj) {
      b.className = `subj-tab active ${subj.code.toLowerCase()}`;
    } else {
      b.className = 'subj-tab';
    }
  });
  populatePaperSelect(id);
  updatePreview();
}

function populatePaperSelect(subjectId) {
  const subj   = CONFIG.SUBJECTS.find(s=>s.id===subjectId);
  const select = document.getElementById('fPaper');
  if (!subj || !select) return;
  select.innerHTML = subj.papers.map(p=>`<option value="${p.id}">${p.name} — ${p.type}</option>`).join('');
  onPaperChange();
}

function onPaperChange() {
  const subj   = CONFIG.SUBJECTS.find(s=>s.id===State.activeFormSubject);
  const papId  = document.getElementById('fPaper')?.value;
  const paper  = subj?.papers.find(p=>p.id===papId);
  if (paper) {
    const totalInput = document.getElementById('fTotal');
    if (totalInput && !totalInput.dataset.userEdited) {
      totalInput.value = paper.defaultTotal;
    }
  }
  updatePreview();
}

function updatePreview() {
  const marks = parseFloat(document.getElementById('fMarks')?.value);
  const total = parseFloat(document.getElementById('fTotal')?.value);
  const preview = document.getElementById('previewBar');
  if (!preview) return;

  if (!isNaN(marks) && !isNaN(total) && total > 0 && marks >= 0 && marks <= total) {
    const pct   = (marks/total)*100;
    const g     = getGrade(pct);
    const style = gradeStyle(g);
    preview.style.display = 'flex';
    setElText('previewPct', pct.toFixed(1)+'%');
    const gradeEl = document.getElementById('previewGrade');
    if (gradeEl) {
      gradeEl.textContent = g;
      gradeEl.style.background = style.bg;
      gradeEl.style.color = style.color;
    }
    const fillEl = document.getElementById('previewFill');
    if (fillEl) {
      fillEl.style.width   = pct+'%';
      fillEl.style.background = style.color;
    }
  } else {
    preview.style.display = 'none';
  }
}

function resetForm() {
  document.getElementById('entryForm').reset();
  document.getElementById('previewBar').style.display = 'none';
  document.querySelectorAll('[data-user-edited]').forEach(el=>delete el.dataset.userEdited);
  populatePaperSelect(State.activeFormSubject);
}

// Mark total as user-edited so auto-fill won't override
document.addEventListener('DOMContentLoaded', () => {
  const totalInput = document.getElementById('fTotal');
  if (totalInput) totalInput.addEventListener('input', () => { totalInput.dataset.userEdited = '1'; });
});

// ── Form Submit ───────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  const subjectId = State.activeFormSubject;
  const paper     = document.getElementById('fPaper').value;
  const examType  = document.getElementById('fExamType').value;
  const date      = document.getElementById('fDate').value;
  const marks     = parseFloat(document.getElementById('fMarks').value);
  const total     = parseFloat(document.getElementById('fTotal').value);
  const notes     = document.getElementById('fNotes').value.trim();

  // Validate
  if (!subjectId || !paper || !examType || !date) { notify('Please fill all required fields.','error'); return; }
  if (isNaN(marks) || isNaN(total) || total <= 0)  { notify('Enter valid marks and total.','error'); return; }
  if (marks < 0 || marks > total)                  { notify('Marks cannot exceed total.','error'); return; }

  const subj     = CONFIG.SUBJECTS.find(s=>s.id===subjectId);
  const paperObj = subj?.papers.find(p=>p.id===paper);
  const pct      = parseFloat(((marks/total)*100).toFixed(2));

  const entry = {
    id:        'local-' + Date.now(),
    subject:   subjectId,
    paper:     paper,
    paperType: paperObj?.type || '',
    examType,
    date,
    marks,
    total,
    percentage: pct,
    notes,
    timestamp:  new Date().toISOString(),
    synced:     false
  };

  // Optimistic local save
  State.entries.push(entry);
  Store.save(State.entries);
  renderAll();
  closeModal();
  notify(`Entry saved — ${pct.toFixed(1)}% (${getGrade(pct)})`, 'success');

  // Background sync to Google Sheets
  await submitToSheets(entry);
});

// ── Google Sheets Sync ────────────────────────────────────────
async function submitToSheets(entry) {
  if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') return;

  try {
    const res = await fetch(CONFIG.SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', ...entry })
    });
    // Mark as synced
    const idx = State.entries.findIndex(e=>e.id===entry.id);
    if (idx !== -1) { State.entries[idx].synced = true; Store.save(State.entries); }
    renderStatsStrip();
  } catch (err) {
    console.warn('Sheets sync failed:', err.message);
    notify('Saved locally — Sheets sync pending.', 'info');
  }
}

async function syncFromSheets(manual = false) {
  if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') return;
  if (State.syncing) return;
  State.syncing = true;
  const btn = document.getElementById('syncBtn');
  if (btn) btn.classList.add('syncing');

  try {
    const res  = await fetch(CONFIG.SCRIPT_URL + '?t=' + Date.now());
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length) {
      // Merge sheet data (remote takes precedence for synced entries)
      const remoteIds = new Set(json.data.map(r=>r['Entry ID']));
      const local     = State.entries.filter(e => !e.synced && !remoteIds.has(e.id));
      const remote    = json.data.map(r => ({
        id:         r['Entry ID'],
        subject:    r['Subject'],
        paper:      r['Paper'],
        paperType:  r['Paper Type'],
        examType:   r['Exam Type'],
        date:       r['Date'],
        marks:      Number(r['Marks Obtained']),
        total:      Number(r['Total Marks']),
        percentage: Number(r['Percentage']),
        notes:      r['Notes'] || '',
        timestamp:  r['Timestamp'],
        synced:     true
      }));
      State.entries = [...remote, ...local];
      Store.save(State.entries);
      renderAll();
      if (manual) notify('Synced from Google Sheets.', 'success');
    }
  } catch (err) {
    if (manual) notify('Sync failed — check your Script URL.', 'error');
  } finally {
    State.syncing = false;
    if (btn) btn.classList.remove('syncing');
  }
}

// ── Delete Entry ──────────────────────────────────────────────
function deleteEntry(id) {
  if (!confirm('Delete this entry? This cannot be undone locally.')) return;
  State.entries = State.entries.filter(e=>e.id!==id);
  Store.save(State.entries);
  renderAll();
  notify('Entry removed.', 'info');
}

// ── Utilities ─────────────────────────────────────────────────
function subjectAvg(subjectId) {
  const entries = State.entries.filter(e=>e.subject===subjectId);
  if (!entries.length) return null;
  return entries.reduce((a,e)=>a+e.percentage, 0) / entries.length;
}

function getGrade(pct) {
  for (const g of CONFIG.GRADES) { if (pct >= g.min) return g.label; }
  return 'F';
}

function gradeStyle(label) {
  return CONFIG.GRADES.find(g=>g.label===label) || { color:'#6B7280', bg:'#F3F4F6' };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' });
  } catch { return dateStr; }
}

function setElText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setElHTML(id, val) { const el = document.getElementById(id); if (el) el.innerHTML  = val; }

// ── Notifications ─────────────────────────────────────────────
function notify(msg, type='info') {
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };
  const wrap = document.getElementById('notifWrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `notif ${type}`;
  el.innerHTML = `${icons[type]||''}<span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 3500);
}
