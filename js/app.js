/* ===== APP.JS ===== */

function renderWelcome() {
  var el = function(id) { return document.getElementById(id); };
  if (el('welcome-name')) el('welcome-name').textContent = Store.profile.full_name || 'Giáo viên';
  if (el('profile-display-name')) el('profile-display-name').textContent = Store.profile.full_name || 'Giáo viên';
}

document.addEventListener('DOMContentLoaded', async function() {
  syncUI('🔄 Loading...');
  await Store.load();
  setTheme(Store.profile.theme || 'dark');
  setFont(Store.profile.font || "'Be Vietnam Pro',sans-serif");
  var fontEl = document.getElementById('p-font');
  if (fontEl) fontEl.value = Store.profile.font || "'Be Vietnam Pro',sans-serif";
  var nameEl = document.getElementById('p-name');
  if (nameEl) nameEl.value = Store.profile.full_name || '';
  renderWelcome();
  closeRightPanel();
  syncUI('✅ Synced');

  document.querySelectorAll('.menu-item').forEach(function(m) {
    m.addEventListener('click', function(e) {
      e.preventDefault();
      switchTab(m.dataset.tab);
    });
  });

  var hamburger = document.getElementById('hamburger');
  if (hamburger) hamburger.addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('open');
  });
});

/* ===== PROFILE ===== */
async function saveName(n) {
  n = n || 'Giáo viên';
  Store.profile.full_name = n;
  syncUI('🔄...');
  await db.from('profiles').upsert({ id: CONFIG.USER_ID, full_name: n, theme: Store.profile.theme, font: Store.profile.font });
  renderWelcome();
  syncUI('✅');
}
async function setTheme(t) {
  document.body.setAttribute('data-theme', t);
  document.querySelectorAll('.theme-toggle .btn').forEach(function(b) { b.classList.remove('active'); });
  if (t === 'light') { var btn = document.querySelector('.theme-toggle .btn:first-child'); if (btn) btn.classList.add('active'); }
  else { var btn = document.querySelector('.theme-toggle .btn:last-child'); if (btn) btn.classList.add('active'); }
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
  localStorage.removeItem('cs-students-v2');
  localStorage.removeItem('cs-groups-v2');
  closeNuke(); renderWelcome(); updateDashboard(); renderStudents(); renderGroups();
  syncUI('✅ Deleted');
}

/* ===== EXTERNAL DATA ===== */
var gcalEvents = [];

async function loadAllExternalData() {
  try {
    gcalEvents = await GCalSync.fetchEvents();
    updateDashboard();
    updateStats();
    renderStudents();
    renderGroups();
    syncUI('✅ Synced');
  } catch (e) {
    console.warn('Load failed:', e);
    syncUI('⚠️ Offline');
  }
}

function getAllSessions() {
  var gcal = (typeof GCalSync !== 'undefined') ? GCalSync.getCache() : [];
  var local = (Store.sessions || []).map(function(s) {
    return {
      id: s.id, name: s.student_name || s.group_name || '',
      date: s.date + 'T' + (s.start_time || '00:00'),
      dateEnd: s.date + 'T' + (s.end_time || '00:00'),
      student: s.student_name || '', fee: s.fee || 0,
      duration: timeDiffMinutes(s.start_time, s.end_time),
      status: s.done ? 'Done' : 'Not started', type: s.type || 'individual',
      color: s.color || 'c1', note: s.note || '', source: 'local'
    };
  });

  var all = gcal.concat(local);

  // Apply student fee overrides
  var studentData = (typeof getStudentData === 'function') ? getStudentData() : [];
  var feeMap = {};
  studentData.forEach(function(s) { if (s.fee) feeMap[s.name] = s; });

  all.forEach(function(s) {
    if (s.student && feeMap[s.student]) {
      var st = feeMap[s.student];
      if (!s.fee || s.fee === 0) {
        s.fee = st.fee || 0;
      }
    }
  });

  // Dedup by id
  var map = new Map();
  all.forEach(function(s) { map.set(s.id, s); });
  return Array.from(map.values());
}

/* ===== DASHBOARD (Welcome) ===== */
function updateDashboard() {
  var all = getAllSessions();
  var students = getAllStudents ? getAllStudents() : [];
  var activeStudents = students.filter(function(s) { return !s.completed; });

  // Revenue this month
  var monthSessions = GCalSync.filterByPeriod(all, 'month');
  var doneSessions = monthSessions.filter(function(s) { return s.status === 'Done'; });

  // Revenue from student fee data
  var totalRevenue = 0;
  activeStudents.forEach(function(st) { totalRevenue += st.earned || 0; });

  var totalMinutes = doneSessions.reduce(function(sum, s) { return sum + (s.duration || 0); }, 0);
  var weekSessions = GCalSync.filterByPeriod(all, 'week').length;

  var el = function(id) { return document.getElementById(id); };
  if (el('w-students')) el('w-students').textContent = activeStudents.length;
  if (el('w-week')) el('w-week').textContent = weekSessions;
  if (el('w-salary')) el('w-salary').textContent = formatVND(totalRevenue);
  if (el('w-hours')) el('w-hours').textContent = Math.floor(totalMinutes / 60) + 'h';

  // Today's sessions
  var todaySessions = GCalSync.filterByPeriod(all, 'today').sort(function(a,b) { return new Date(a.date) - new Date(b.date); });
  if (el('today-list')) {
    if (todaySessions.length === 0) {
      el('today-list').innerHTML = '<p class="muted">Hôm nay không có buổi dạy.</p>';
    } else {
      el('today-list').innerHTML = todaySessions.map(function(s) {
        var d = new Date(s.date);
        var time = d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
        var statusIcon = s.status === 'Done' ? '✅' : '🕐';
        return '<div class="s-item"><div class="s-item-info"><strong>' + statusIcon + ' ' + (s.name || s.student) + '</strong><span>' + time + ' · ' + (s.duration || 0) + 'p · ' + formatVND(s.fee || 0) + '</span></div></div>';
      }).join('');
    }
  }

  // This week's sessions
  var weekList = GCalSync.filterByPeriod(all, 'week').sort(function(a,b) { return new Date(a.date) - new Date(b.date); });
  if (el('week-list')) {
    if (weekList.length === 0) {
      el('week-list').innerHTML = '<p class="muted">Tuần này không có buổi dạy.</p>';
    } else {
      el('week-list').innerHTML = weekList.map(function(s) {
        var d = new Date(s.date);
        var day = d.toLocaleDateString('vi-VN',{weekday:'short',day:'numeric',month:'numeric'});
        var time = d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
        var statusIcon = s.status === 'Done' ? '✅' : '🕐';
        return '<div class="s-item"><div class="s-item-info"><strong>' + statusIcon + ' ' + (s.name || s.student) + '</strong><span>' + day + ' ' + time + ' · ' + formatVND(s.fee || 0) + '</span></div></div>';
      }).join('');
    }
  }
}

/* ===== STATS ===== */
var currentStatsMonth = null; // null = all
var currentStatsFilter = 'all';

function buildMonthBar() {
  var bar = document.getElementById('stats-month-bar');
  if (!bar) return;
  var now = new Date();
  var months = [{label:'Tất cả',value:null}];
  for (var i = 0; i < 6; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({label:'T' + (d.getMonth()+1) + '/' + d.getFullYear(), value: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')});
  }
  bar.innerHTML = months.map(function(m) {
    var active = (m.value === currentStatsMonth) ? ' active' : '';
    var val = m.value === null ? 'null' : m.value;
    return '<button class="ptab' + active + '" onclick="setStatsMonth(' + (m.value === null ? 'null' : "'" + m.value + "'") + ')">' + m.label + '</button>';
  }).join('');
}

function setStatsMonth(m) {
  currentStatsMonth = m === null || m === 'null' ? null : m;
  buildMonthBar();
  updateStats();
}

function updateStats() {
  buildMonthBar();
  var all = getAllSessions();
  var students = (typeof getAllStudents === 'function') ? getAllStudents() : [];

  // Filter by month
  var filtered;
  if (currentStatsMonth) {
    var parts = currentStatsMonth.split('-');
    var yr = parseInt(parts[0]), mo = parseInt(parts[1]) - 1;
    var start = new Date(yr, mo, 1);
    var end = new Date(yr, mo + 1, 0, 23, 59, 59);
    filtered = all.filter(function(s) { var d = new Date(s.date); return d >= start && d <= end; });
  } else {
    filtered = all;
  }

  var done = filtered.filter(function(s) { return s.status === 'Done'; });

  // Revenue calc from student data
  var totalExpected = 0, totalEarned = 0;
  students.forEach(function(st) {
    var stSessions = filtered.filter(function(s) { return s.student === st.name; });
    var stDone = stSessions.filter(function(s) { return s.status === 'Done'; });

    var earned, expected;
    if (st.feeType === 'per-session' || st.feeType === 'free-session') {
      earned = stDone.length * (st.fee || 0);
      expected = stSessions.length * (st.fee || 0);
    } else {
      var doneMonths = new Set(), allMonths = new Set();
      stDone.forEach(function(s) { var d = new Date(s.date); doneMonths.add(d.getFullYear()+'-'+d.getMonth()); });
      stSessions.forEach(function(s) { var d = new Date(s.date); allMonths.add(d.getFullYear()+'-'+d.getMonth()); });
      earned = doneMonths.size * (st.fee || 0);
      expected = allMonths.size * (st.fee || 0);
    }
    totalEarned += earned;
    totalExpected += expected;
  });

  var uncollected = Math.max(0, totalExpected - totalEarned);
  var minutes = done.reduce(function(sum, s) { return sum + (s.duration || 0); }, 0);
  var activeCount = students.filter(function(s) { return !s.completed; }).length;
  var avg = done.length > 0 ? Math.round(totalEarned / done.length) : 0;

  var el = function(id) { return document.getElementById(id); };
  if (el('st-revenue')) el('st-revenue').textContent = formatVND(totalExpected);
  if (el('st-collected')) el('st-collected').textContent = formatVND(totalEarned);
  if (el('st-uncollected')) el('st-uncollected').textContent = formatVND(uncollected);
  if (el('st-students')) el('st-students').textContent = activeCount;
  if (el('st-total')) el('st-total').textContent = filtered.length;
  if (el('st-done')) el('st-done').textContent = done.length;
  if (el('st-hours')) el('st-hours').textContent = Math.floor(minutes / 60) + 'h';
  if (el('st-avg')) el('st-avg').textContent = formatVND(avg);

  // Detail by student
  renderStatsDetail(filtered, students);

  // Setup filter tabs
  document.querySelectorAll('.stab').forEach(function(btn) {
    btn.onclick = function() {
      document.querySelectorAll('.stab').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      currentStatsFilter = this.dataset.filter;
      renderStatsDetail(filtered, students);
    };
  });
}

function renderStatsDetail(filtered, students) {
  var detail = document.getElementById('stats-detail');
  if (!detail) return;

  var list = students;
  if (currentStatsFilter === 'active') list = list.filter(function(s) { return !s.completed; });
  else if (currentStatsFilter === 'completed') list = list.filter(function(s) { return s.completed; });

  if (list.length === 0) {
    detail.innerHTML = '<p class="muted">Không có dữ liệu.</p>';
    return;
  }

  detail.innerHTML = list.map(function(st) {
    var stSessions = filtered.filter(function(s) { return s.student === st.name; });
    var stDone = stSessions.filter(function(s) { return s.status === 'Done'; });
    var earned;
    if (st.feeType === 'per-session' || st.feeType === 'free-session') {
      earned = stDone.length * (st.fee || 0);
    } else {
      var months = new Set();
      stDone.forEach(function(s) { var d = new Date(s.date); months.add(d.getFullYear()+'-'+d.getMonth()); });
      earned = months.size * (st.fee || 0);
    }
    var mins = stDone.reduce(function(sum,s) { return sum + (s.duration||0); },0);
    var statusTag = st.completed ? '<span class="stu-done-tag">Đã xong</span>' : '';

    return '<div class="stats-student-row">' +
      '<div><span class="stats-student-name">' + st.name + '</span> ' + statusTag + '</div>' +
      '<span class="stats-student-info">' + stDone.length + '/' + stSessions.length + ' buổi · ' + formatVND(earned) + ' · ' + Math.floor(mins/60) + 'h</span>' +
    '</div>';
  }).sort(function(a,b) { return 0; }).join('');
}

/* ===== INIT ===== */
setTimeout(loadAllExternalData, 800);
setInterval(loadAllExternalData, 120000);
