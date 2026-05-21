/* ===== APP.JS - Main initialization ===== */

function renderWelcome() {
  const el = (id) => document.getElementById(id);
  if (el('welcome-name')) el('welcome-name').textContent = Store.profile.full_name || 'Giáo viên';
  if (el('profile-display-name')) el('profile-display-name').textContent = Store.profile.full_name || 'Giáo viên';
}

document.addEventListener('DOMContentLoaded', async function() {
  syncUI('🔄 Loading...');
  await Store.load();

  // Theme & Font
  setTheme(Store.profile.theme || 'dark');
  setFont(Store.profile.font || "'Be Vietnam Pro',sans-serif");
  const fontEl = document.getElementById('p-font');
  if (fontEl) fontEl.value = Store.profile.font || "'Be Vietnam Pro',sans-serif";
  const nameEl = document.getElementById('p-name');
  if (nameEl) nameEl.value = Store.profile.full_name || '';

  renderWelcome();
  closeRightPanel();
  syncUI('✅ Synced');

  // Menu navigation
  document.querySelectorAll('.menu-item').forEach(function(m) {
    m.addEventListener('click', function(e) {
      e.preventDefault();
      switchTab(m.dataset.tab);
    });
  });

  // Hamburger
  const hamburger = document.getElementById('hamburger');
  if (hamburger) hamburger.addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('open');
  });
});

/* ===== PROFILE FUNCTIONS ===== */
async function saveName(n) {
  n = n || 'Giáo viên';
  Store.profile.full_name = n;
  syncUI('🔄...');
  await db.from('profiles').upsert({ id: CONFIG.USER_ID, full_name: n, theme: Store.profile.theme, font: Store.profile.font });
  const el = (id) => document.getElementById(id);
  if (el('welcome-name')) el('welcome-name').textContent = n;
  if (el('profile-display-name')) el('profile-display-name').textContent = n;
  syncUI('✅ Synced');
}

async function setTheme(t) {
  document.body.setAttribute('data-theme', t);
  // Update buttons in profile page
  document.querySelectorAll('.theme-toggle .btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  if (t === 'light') {
    document.querySelector('.theme-toggle .btn:first-child')?.classList.add('active');
  } else {
    document.querySelector('.theme-toggle .btn:last-child')?.classList.add('active');
  }
  if (Store.profile.theme !== t) {
    Store.profile.theme = t;
    await db.from('profiles').upsert({ id: CONFIG.USER_ID, full_name: Store.profile.full_name, theme: t, font: Store.profile.font });
  }
}

async function setFont(f) {
  document.body.style.fontFamily = f;
  if (Store.profile.font !== f) {
    Store.profile.font = f;
    await db.from('profiles').upsert({ id: CONFIG.USER_ID, full_name: Store.profile.full_name, theme: Store.profile.theme, font: f });
  }
}

function confirmNuke() { document.getElementById('modal-nuke').hidden = false; }
function closeNuke() { document.getElementById('modal-nuke').hidden = true; }

async function nukeData() {
  syncUI('🔄...');
  await db.from('sessions').delete().eq('user_id', CONFIG.USER_ID);
  await db.from('students').delete().eq('user_id', CONFIG.USER_ID);
  await db.from('groups').delete().eq('user_id', CONFIG.USER_ID);
  localStorage.removeItem('cs-groups');
  Store.sessions = []; Store.students = []; Store.groups = [];
  closeNuke();
  renderWelcome();
  updateDashboard();
  renderStudents();
  renderGroups();
  syncUI('✅ Deleted');
}

/* ===== GOOGLE CALENDAR + NOTION INTEGRATION ===== */
let gcalEvents = [];

async function loadAllExternalData() {
  try {
    const [gcal] = await Promise.allSettled([
      GCalSync.fetchEvents(),
    ]);
    if (gcal.status === 'fulfilled') gcalEvents = gcal.value;
    updateDashboard();
    updateStats();
    renderStudents();
    renderGroups();
    if (typeof syncUI === 'function') syncUI('✅ Synced');
  } catch (e) {
    console.warn('External data load failed:', e);
    if (typeof syncUI === 'function') syncUI('⚠️ Offline');
  }
}

function getAllSessions() {
  const localMapped = (Store.sessions || []).map(s => ({
    id: s.id, name: s.student_name || s.group_name || '',
    date: s.date + 'T' + (s.start_time || '00:00'),
    dateEnd: s.date + 'T' + (s.end_time || '00:00'),
    student: s.student_name || '', fee: s.fee || 0,
    duration: (typeof timeDiffMinutes === 'function') ? timeDiffMinutes(s.start_time, s.end_time) : 0,
    status: s.done ? 'Done' : 'Not started', type: s.type || 'individual',
    color: s.color || 'c1', note: s.note || '', source: 'local'
  }));
  const map = new Map(); all.forEach(s => map.set(s.id, s));
  return [...map.values()];
}

function updateDashboard() {
  const all = getAllSessions();
  const revenue = GCalSync.calcRevenue(all, 'month');
  const minutes = GCalSync.calcMinutes(all, 'month');
  const hours = Math.floor(minutes / 60);
  const students = GCalSync.uniqueStudents(all).length;
  const weekSessions = GCalSync.countSessions(all, 'week');
  const upcomingList = GCalSync.upcoming(all, 5);

  const el = (id) => document.getElementById(id);
  if (el('w-students')) el('w-students').textContent = students;
  if (el('w-week')) el('w-week').textContent = weekSessions;
  if (el('w-salary')) el('w-salary').textContent = Math.round(revenue / 1000) + 'k';
  if (el('w-hours')) el('w-hours').textContent = hours + 'h';

  if (el('upcoming-list')) {
    if (upcomingList.length === 0) {
      el('upcoming-list').innerHTML = '<p class="muted">Không có buổi dạy sắp tới.</p>';
    } else {
      el('upcoming-list').innerHTML = upcomingList.map(s => {
        const d = new Date(s.date);
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
        const fee = Math.round((s.fee || 0) / 1000) + 'k';
        return '<div class="upcoming-item"><span class="upcoming-time">' + date + ' ' + time + '</span><span class="upcoming-name">' + (s.name || s.student) + '</span><span class="upcoming-fee">' + fee + '</span></div>';
      }).join('');
    }
  }
}

function updateStats(period) {
  period = period || document.querySelector('.ptab.active')?.dataset?.period || 'month';
  const all = getAllSessions();
  const filtered = GCalSync.filterByPeriod(all, period);
  const done = filtered.filter(s => s.status === 'Done');
  const revenue = done.reduce((sum, s) => sum + (s.fee || 0), 0);
  const minutes = done.reduce((sum, s) => sum + (s.duration || 0), 0);
  const students = [...new Set(filtered.map(s => s.student).filter(Boolean))].length;
  const avg = done.length > 0 ? Math.round(revenue / done.length / 1000) : 0;

  const el = (id) => document.getElementById(id);
  if (el('st-total')) el('st-total').textContent = filtered.length;
  if (el('st-done')) el('st-done').textContent = done.length;
  if (el('st-students')) el('st-students').textContent = students;
  if (el('st-revenue')) el('st-revenue').textContent = Math.round(revenue / 1000) + 'k';
  if (el('st-hours')) el('st-hours').textContent = Math.floor(minutes / 60) + 'h';
  if (el('st-avg')) el('st-avg').textContent = avg + 'k';

  if (el('stats-detail')) {
    const studentMap = new Map();
    done.forEach(s => {
      if (!s.student) return;
      if (!studentMap.has(s.student)) studentMap.set(s.student, { count: 0, fee: 0, min: 0 });
      const st = studentMap.get(s.student);
      st.count++; st.fee += s.fee || 0; st.min += s.duration || 0;
    });
    const rows = [...studentMap.entries()].sort((a, b) => b[1].fee - a[1].fee);
    if (rows.length === 0) {
      el('stats-detail').innerHTML = '<p class="muted">Chưa có dữ liệu.</p>';
    } else {
      el('stats-detail').innerHTML = rows.map(([name, d]) =>
        '<div class="stats-student-row"><span class="stats-student-name">' + name + '</span><span class="stats-student-info">' + d.count + ' buổi · ' + Math.round(d.fee / 1000) + 'k · ' + Math.floor(d.min / 60) + 'h</span></div>'
      ).join('');
    }
  }
}

// Period tabs
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.ptab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      updateStats(this.dataset.period);
    });
  });
});

// Load external data
setTimeout(loadAllExternalData, 800);
setInterval(loadAllExternalData, 120000);
