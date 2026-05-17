// ================================================================
//  AMEENA'S MARK TRACKER — script.js
//  Per-subject save · Session persistence · Live calc
// ================================================================

// !! REPLACE WITH YOUR GOOGLE APPS SCRIPT WEB APP URL !!
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1KXYIflhk-Q2sPZUSTjUNhLhxE4sdb2Vwav5RvOdBksU6QHLFUBvaFpjflABAVwoNmA/exec';

const SESSION_KEY  = 'marktracker_session';
const HISTORY_KEY  = 'marktracker_history';

const SUBJECTS = ['biology', 'physics', 'chemistry'];
const PREFIX   = { biology: 'bio', physics: 'phy', chemistry: 'chem' };

// ================================================================
//  HELPERS
// ================================================================
function getNum(id) {
  const v = document.getElementById(id)?.value?.trim();
  return (v !== '' && v !== undefined) ? parseFloat(v) : null;
}

function pct(mark, max) {
  if (mark === null || max === null || max === 0) return null;
  return (mark / max) * 100;
}

function gradeOf(p) {
  if (p === null) return '';
  if (p >= 75) return 'A';
  if (p >= 65) return 'B';
  if (p >= 55) return 'C';
  if (p >= 35) return 'S';
  return 'F';
}

function colOf(p) {
  if (p === null) return '';
  if (p >= 75) return 'var(--bio)';
  if (p >= 65) return 'var(--phy)';
  if (p >= 55) return 'var(--warning)';
  if (p >= 35) return 'var(--chem)';
  return 'var(--danger)';
}

// ================================================================
//  SESSION MANAGEMENT
// ================================================================
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; }
  catch { return null; }
}

function saveSession(sess) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
}

function setSession() {
  const name = document.getElementById('examName').value.trim();
  const term = document.getElementById('examTerm').value.trim();

  if (!name || !term) {
    alert('Please fill in both the Exam Name and Term before setting the session.');
    return;
  }

  // Check if session already exists (different exam name) → ask to confirm
  const existing = getSession();
  if (existing && (existing.examName !== name || existing.term !== term)) {
    const ok = confirm(
      `Replace current session?\n\nCurrent: "${existing.examName} — ${existing.term}"\nNew: "${name} — ${term}"\n\nNote: switching session does NOT delete Google Sheets data.`
    );
    if (!ok) return;
  }

  const sess = {
    examName: name,
    term: term,
    subjects: existing && existing.examName === name && existing.term === term
      ? existing.subjects
      : { biology: null, physics: null, chemistry: null },
  };

  saveSession(sess);
  applySession(sess);
}

function applySession(sess) {
  if (!sess) return;

  // Fill exam fields
  document.getElementById('examName').value = sess.examName;
  document.getElementById('examTerm').value = sess.term;

  // Update session pill
  const dot  = document.getElementById('sessionDot');
  const text = document.getElementById('sessionPillText');
  dot.classList.add('active');
  text.textContent = sess.examName;

  // Activate subject cards
  SUBJECTS.forEach(sub => {
    const card = document.getElementById(`card_${sub}`);
    const badge = document.getElementById(`saved_${sub}`);
    const btn   = document.getElementById(`btn_${sub}`);
    const pill  = document.getElementById(`spill_${sub}_status`);

    card.classList.add('active');
    btn.disabled = false;

    if (sess.subjects[sub]) {
      card.classList.add('saved');
      badge.classList.remove('hidden');
      pill.textContent = '✓';
      pill.classList.add('done');
    } else {
      card.classList.remove('saved');
      badge.classList.add('hidden');
      pill.textContent = '○';
      pill.classList.remove('done');
    }
  });
}

// ================================================================
//  LIVE CALCULATION (per subject)
// ================================================================
function liveCalc(sub) {
  const pre = PREFIX[sub];
  let total = 0, max = 0, hasData = false;

  [1, 2, 3].forEach(p => {
    const mark = getNum(`${pre}_p${p}`);
    const mx   = getNum(`${pre}_p${p}max`);
    const chip = document.getElementById(`${pre}_p${p}pct`);

    if (mark !== null) { total += mark; hasData = true; }
    if (mx   !== null)   max   += mx;

    if (chip) {
      const pp = pct(mark, mx);
      chip.textContent  = pp !== null ? pp.toFixed(0) + '%' : '';
      chip.style.color  = colOf(pp);
    }
  });

  const totalEl = document.getElementById(`${pre}_total`);
  const barEl   = document.getElementById(`${pre}_bar`);
  const gradeEl = document.getElementById(`${pre}_grade`);

  if (hasData && max > 0) {
    const p = (total / max) * 100;
    totalEl.textContent = total.toFixed(1) + '/' + max;
    barEl.style.width   = Math.min(p, 100) + '%';
    gradeEl.textContent = gradeOf(p);
    gradeEl.style.color = colOf(p);
  } else {
    totalEl.textContent = '—';
    barEl.style.width   = '0%';
    gradeEl.textContent = '';
  }
}

// ================================================================
//  SAVE A SINGLE SUBJECT
// ================================================================
async function saveSubject(sub) {
  const sess = getSession();
  if (!sess) { alert('Please set an exam session first.'); return; }

  const pre    = PREFIX[sub];
  const btn    = document.getElementById(`btn_${sub}`);
  const btnTxt = document.getElementById(`btn_${sub}_text`);
  const statEl = document.getElementById(`status_${sub}`);

  // Collect marks
  const data = {
    p1:    getNum(`${pre}_p1`),    p1max: getNum(`${pre}_p1max`),
    p2:    getNum(`${pre}_p2`),    p2max: getNum(`${pre}_p2max`),
    p3:    getNum(`${pre}_p3`),    p3max: getNum(`${pre}_p3max`),
    p1att: getNum(`${pre}_p1att`) ?? 0,
    p2att: getNum(`${pre}_p2att`) ?? 0,
    p3att: getNum(`${pre}_p3att`) ?? 0,
    date:  document.getElementById(`date_${sub}`)?.value || '',
  };

  // Validate
  if (data.p1 === null && data.p2 === null && data.p3 === null) {
    showSubjectStatus(sub, 'Enter at least one mark before saving.', 'error');
    return;
  }
  if (!data.date) {
    showSubjectStatus(sub, 'Please select the date of this paper.', 'error');
    return;
  }

  // Loading state
  btn.disabled    = true;
  btnTxt.textContent = '⏳ Saving…';
  statEl.className   = 'subject-status hidden';

  const payload = {
    action:   'saveSubject',
    examName: sess.examName,
    term:     sess.term,
    subject:  sub,
    ...data,
  };

  try {
    await fetch(APPS_SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload),
      mode:    'no-cors',
    });

    // Mark as saved in session
    sess.subjects[sub] = { savedAt: new Date().toISOString(), date: data.date };
    saveSession(sess);
    applySession(sess);

    // Save to local history
    saveToHistory(sess.examName, sess.term, sub, data);

    const subLabel = sub.charAt(0).toUpperCase() + sub.slice(1);
    showSubjectStatus(sub, `✓ ${subLabel} saved! WhatsApp notification sent.`, 'success');
    renderHistory();

  } catch (err) {
    showSubjectStatus(sub, `❌ Could not connect. Check APPS_SCRIPT_URL in script.js. (${err.message})`, 'error');
  } finally {
    btn.disabled       = false;
    btnTxt.textContent = `Save ${sub.charAt(0).toUpperCase() + sub.slice(1)}`;
  }
}

function showSubjectStatus(sub, msg, type) {
  const el = document.getElementById(`status_${sub}`);
  el.textContent = msg;
  el.className   = `subject-status ${type}`;
}

// ================================================================
//  LOCAL HISTORY
// ================================================================
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function saveToHistory(examName, term, sub, data) {
  const h = getHistory();
  const pre = PREFIX[sub];
  let total = 0, max = 0;
  [1,2,3].forEach(p => {
    if (data[`p${p}`] !== null) total += data[`p${p}`];
    if (data[`p${p}max`] !== null) max += data[`p${p}max`];
  });
  const pp = max > 0 ? (total / max) * 100 : null;

  h.push({ date: data.date, examName, term, subject: sub, total, max, pct: pp ? parseFloat(pp.toFixed(1)) : null });
  if (h.length > 30) h.shift();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
}

function renderHistory() {
  const h    = getHistory();
  const card = document.getElementById('historyCard');
  const list = document.getElementById('historyList');

  if (!h.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';

  const recent = [...h].reverse().slice(0, 9);
  const subIcons = { biology: '🌿', physics: '⚡', chemistry: '🌸' };

  list.innerHTML = recent.map(r => `
    <div class="history-item">
      <span class="hi-date">${r.date || '—'}</span>
      <span class="hi-name">${r.examName}</span>
      <span class="hi-sub">${subIcons[r.subject] || ''} ${r.subject.slice(0,4)}</span>
      <span class="hi-pct" style="color:${colOf(r.pct)}">${r.pct !== null ? r.pct + '%' : '—'}</span>
    </div>
  `).join('');
}

// ================================================================
//  INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Default today for all subject dates
  const today = new Date().toISOString().split('T')[0];
  SUBJECTS.forEach(sub => {
    const el = document.getElementById(`date_${sub}`);
    if (el && !el.value) el.value = today;
  });

  // Restore session if one exists
  const sess = getSession();
  if (sess) applySession(sess);

  renderHistory();
});
