/* ============================================================
   PATCH-V4.JS  —  ClassSchedule
   (1) Chuẩn hoá tên học viên: fix lỗi tên dài bị tách thành 2 HV
   (2) Thống kê mới: index 1 lần, lọc ngày/tuần/tháng/quý/năm/tuỳ chọn
   (3) Xoá buổi học (kể cả quá khứ) -> tự tính lại thống kê & học phí
   NẠP SAU js/app.js
   ============================================================ */

/* ---------- 0. Tiện ích tên ---------- */
var CS_HISTORY_MONTHS = 24; // lấy dữ liệu Calendar 24 tháng về trước

function csNormalizeName(s) {
  return String(s == null ? '' : s)
    .replace(/\u00A0/g, ' ')        // khoảng trắng đặc biệt
    .replace(/[\r\n\t]+/g, ' ')     // XUỐNG DÒNG -> khoảng trắng (fix chính)
    .replace(/[\u2013\u2014]/g, '-')// – — -> -
    .replace(/\s*-\s*/g, ' - ')     // chuẩn hoá quanh dấu gạch
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFC');              // dấu tiếng Việt
}
function csKey(s) { return csNormalizeName(s).toLowerCase(); }
function csEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function csP2(n) { return (n < 10 ? '0' : '') + n; }
function csYMD(d) { return d.getFullYear() + '-' + csP2(d.getMonth() + 1) + '-' + csP2(d.getDate()); }
function csYM(d) { return d.getFullYear() + '-' + csP2(d.getMonth() + 1); }
function csISOWeek(d) {
  var t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() + 4 - (t.getDay() || 7));
  var y0 = new Date(t.getFullYear(), 0, 1);
  return t.getFullYear() + '-W' + csP2(Math.ceil(((t - y0) / 86400000 + 1) / 7));
}
function csVND(n) { return (typeof formatVND === 'function') ? formatVND(n) : (n || 0) + 'đ'; }

/* Sổ đăng ký học viên: key -> học viên (kèm alias) */
function csRegistry() {
  var manual = (typeof getStudentData === 'function') ? getStudentData() : [];
  var byKey = {};
  manual.forEach(function (s) {
    var k = csKey(s.name); if (!k) return;
    byKey[k] = Object.assign({}, s, { key: k, name: csNormalizeName(s.name) });
  });
  manual.forEach(function (s) {
    var st = byKey[csKey(s.name)]; if (!st) return;
    var al = s.aliases || [];
    if (typeof al === 'string') al = al.split(/[;,]/);
    al.forEach(function (a) { var ak = csKey(a); if (ak && !byKey[ak]) byKey[ak] = st; });
  });
  return byKey;
}

/* ---------- 1. Blacklist học viên đã xoá: lưu theo key ---------- */
window.getDeletedStudents = function () {
  var raw = []; try { raw = JSON.parse(localStorage.getItem('cs-deleted-students') || '[]'); } catch (e) {}
  return raw.map(csKey);
};
window.addDeletedStudent = function (n) {
  var k = csKey(n), l = getDeletedStudents();
  if (l.indexOf(k) === -1) l.push(k);
  localStorage.setItem('cs-deleted-students', JSON.stringify(l));
};
window.isStudentDeleted = function (n) { return getDeletedStudents().indexOf(csKey(n)) !== -1; };

/* ---------- 2. Đọc Calendar: cửa sổ rộng + phân trang ---------- */
window.parseGCalEvent = function (ev) {
  var start = (ev.start && (ev.start.dateTime || ev.start.date)) || '';
  var end = (ev.end && (ev.end.dateTime || ev.end.date)) || '';
  var title = csNormalizeName(ev.summary || '');
  var note = ev.description || '';
  var duration = (start && end) ? Math.round((new Date(end) - new Date(start)) / 60000) : 0;
  var fee = 0;
  var m1 = note.match(/(?:fee|học phí|hoc phi|gia)[:\s]*(\d+)/i);
  if (m1) { fee = parseInt(m1[1], 10); if (fee < 1000) fee *= 1000; }
  if (!fee) { var m2 = note.match(/(\d+)k/i); if (m2) fee = parseInt(m2[1], 10) * 1000; }
  return {
    id: ev.id, name: title, date: start, dateEnd: end,
    student: title, studentKey: csKey(title),
    fee: fee, duration: duration,
    status: (end && new Date(end) < new Date()) ? 'Done' : 'Not started',
    type: /group|nhóm|nhom/i.test(title) ? 'group' : 'individual',
    color: ev.colorId || 'default', note: note, location: ev.location || '',
    source: 'gcal', recurringEventId: ev.recurringEventId || null
  };
};

window.fetchGCalEvents = async function (forceRefresh) {
  if (!forceRefresh && _eventsCache.length && Date.now() - _eventsCacheTime < CACHE_TTL) return _eventsCache;
  var token = localStorage.getItem('gcal_token');
  var expiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0', 10);
  if (!token || Date.now() > expiry) { console.warn('Chưa đăng nhập Google'); return _eventsCache; }

  var now = new Date();
  var min = new Date(now.getFullYear(), now.getMonth() - CS_HISTORY_MONTHS, 1).toISOString();
  var max = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString();
  var calId = (typeof GCAL_CAL_ID !== 'undefined') ? GCAL_CAL_ID : 'asstrayca@gmail.com';
  var items = [], pageToken = null, guard = 0, ok = false;

  try {
    do {
      var p = new URLSearchParams({
        timeMin: min, timeMax: max, singleEvents: 'true', orderBy: 'startTime',
        timeZone: 'Asia/Ho_Chi_Minh', maxResults: '2500'
      });
      if (pageToken) p.set('pageToken', pageToken);
      var res = await fetch('https://www.googleapis.com/calendar/v3/calendars/' +
        encodeURIComponent(calId) + '/events?' + p.toString(),
        { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) break;
      var data = await res.json();
      if (data.error) { console.warn('GCal:', data.error.message); break; }
      items = items.concat(data.items || []);
      pageToken = data.nextPageToken || null;
      ok = true; guard++;
    } while (pageToken && guard < 12);
  } catch (e) { console.warn('Fetch error:', e); }

  if (ok) {
    _eventsCache = items.map(parseGCalEvent).filter(function (s) { return s.date && s.student; });
    _eventsCacheTime = Date.now();
    StatsCore.invalidate();
    console.log('Đã tải ' + _eventsCache.length + ' buổi từ Calendar');
  }
  return _eventsCache;
};

/* ---------- 3. Gom buổi học (gắn studentKey chuẩn) ---------- */
window.getAllSessions = function () {
  var reg = csRegistry();
  var gcal = _eventsCache.filter(function (ev) {
    return (typeof isEventHidden !== 'function') || !isEventHidden(ev.id);
  });
  var local = (typeof Store !== 'undefined' ? (Store.sessions || []) : []).map(function (s) {
    var nm = csNormalizeName(s.student_name || s.group_name || '');
    return {
      id: s.id, name: nm, date: s.date + 'T' + (s.start_time || '00:00'),
      dateEnd: s.date + 'T' + (s.end_time || '00:00'),
      student: nm, studentKey: csKey(nm), fee: s.fee || 0,
      duration: (typeof timeDiffMinutes === 'function') ? timeDiffMinutes(s.start_time, s.end_time) : 0,
      status: s.done ? 'Done' : 'Not started', type: s.type || 'individual',
      color: s.color || 'c1', note: s.note || '', source: 'local'
    };
  });
  var all = gcal.concat(local);
  all.forEach(function (s) {
    s.student = csNormalizeName(s.student || s.name);
    var k0 = csKey(s.student);
    s.studentKey = (reg[k0] && reg[k0].key) || k0;           // alias -> tên chuẩn
    if ((!s.fee || s.fee === 0) && reg[s.studentKey]) s.fee = reg[s.studentKey].fee || 0;
  });
  var map = new Map();
  all.forEach(function (s) { map.set(s.id, s); });
  return Array.from(map.values());
};

/* ---------- 4. STATS CORE: index 1 lần, truy vấn nhanh ---------- */
var StatsCore = (function () {
  var _idx = null;
  function invalidate() { _idx = null; }
  function blank() { return { count: 0, done: 0, minutes: 0, earned: 0, expected: 0 }; }
  function add(b, s) {
    b.count++; b.expected += s._amount;
    if (s._done) { b.done++; b.earned += s._amount; b.minutes += s.duration || 0; }
  }
  function build() {
    var reg = csRegistry();
    var sessions = getAllSessions();
    sessions.forEach(function (s) {
      s._d = new Date(s.date); s._ts = s._d.getTime(); s._done = (s.status === 'Done');
    });
    sessions = sessions.filter(function (s) { return !isNaN(s._ts); });
    sessions.sort(function (a, b) { return a._ts - b._ts; });

    // Học viên tính theo THÁNG: chia đều học phí tháng cho số buổi trong tháng đó
    var pm = {};
    sessions.forEach(function (s) { var k = s.studentKey + '|' + csYM(s._d); pm[k] = (pm[k] || 0) + 1; });
    sessions.forEach(function (s) {
      var st = reg[s.studentKey];
      if (st && String(st.feeType || '').indexOf('month') !== -1)
        s._amount = Math.round((st.fee || 0) / (pm[s.studentKey + '|' + csYM(s._d)] || 1));
      else s._amount = (st && st.fee) ? st.fee : (s.fee || 0);
    });

    var bucket = { day: {}, week: {}, month: {}, year: {}, student: {}, group: {} };
    var studentSessions = {};
    sessions.forEach(function (s) {
      var st = reg[s.studentKey];
      var g = (st && st.group) ? st.group : '(Không nhóm)';
      [['day', csYMD(s._d)], ['week', csISOWeek(s._d)], ['month', csYM(s._d)],
       ['year', '' + s._d.getFullYear()], ['student', s.studentKey], ['group', g]]
      .forEach(function (p) {
        var m = bucket[p[0]]; if (!m[p[1]]) m[p[1]] = blank(); add(m[p[1]], s);
      });
      (studentSessions[s.studentKey] || (studentSessions[s.studentKey] = [])).push(s);
    });
    return { sessions: sessions, bucket: bucket, reg: reg, studentSessions: studentSessions };
  }
  function idx() { if (!_idx) _idx = build(); return _idx; }
  function lower(arr, ts) {
    var lo = 0, hi = arr.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (arr[m]._ts < ts) lo = m + 1; else hi = m; }
    return lo;
  }
  function list(from, to) {
    var a = idx().sessions, i = lower(a, +from), out = [];
    for (; i < a.length && a[i]._ts <= +to; i++) out.push(a[i]);
    return out;
  }
  function range(from, to) {
    var a = idx().sessions, i = lower(a, +from), out = blank();
    for (; i < a.length && a[i]._ts <= +to; i++) add(out, a[i]);
    return out;
  }
  function breakdown(from, to, by) {
    var ix = idx(), a = ix.sessions, i = lower(a, +from), map = {};
    for (; i < a.length && a[i]._ts <= +to; i++) {
      var s = a[i], k;
      if (by === 'student') k = s.studentKey;
      else if (by === 'month') k = csYM(s._d);
      else if (by === 'week') k = csISOWeek(s._d);
      else if (by === 'day') k = csYMD(s._d);
      else k = (ix.reg[s.studentKey] && ix.reg[s.studentKey].group) || '(Không nhóm)';
      if (!map[k]) map[k] = blank();
      add(map[k], s);
    }
    return map;
  }
  function bounds() {
    var a = idx().sessions;
    if (!a.length) { var n = new Date(); return { from: n, to: n }; }
    return { from: new Date(a[0]._ts), to: new Date(a[a.length - 1]._ts + 86400000) };
  }
  return { invalidate: invalidate, idx: idx, blank: blank, list: list,
           range: range, breakdown: breakdown, bounds: bounds };
})();

/* ---------- 5. Học viên: gom theo key, không tách theo chuỗi ---------- */
window.getAllStudents = function () {
  var ix = StatsCore.idx(), deleted = getDeletedStudents(), out = {};
  Object.keys(ix.reg).forEach(function (k) {
    var st = ix.reg[k]; if (!out[st.key]) out[st.key] = Object.assign({}, st);
  });
  Object.keys(ix.studentSessions).forEach(function (k) {
    if (out[k] || deleted.indexOf(k) !== -1) return;
    var f = ix.studentSessions[k][0];
    out[k] = { id: 'gcal-' + k, key: k, name: csNormalizeName(f.student || f.name),
      feeType: 'free-session', fee: 0, schedules: [], repeat: 'weekly',
      note: '', completed: false, group: '', source: 'gcal', aliases: [] };
  });
  return Object.keys(out).map(function (k) {
    var st = out[k], b = ix.bucket.student[k] || StatsCore.blank();
    st.sessions = ix.studentSessions[k] || [];
    st.doneSessions = st.sessions.filter(function (s) { return s._done; });
    st.totalMinutes = b.minutes; st.earned = b.earned; st.totalExpected = b.expected;
    st.uncollected = Math.max(0, b.expected - b.earned);
    return st;
  });
};
function csFindStudent(nameOrKey) {
  var k = csKey(nameOrKey);
  return getAllStudents().find(function (s) { return s.key === k || csKey(s.name) === k; });
}

/* ---------- 6. Thẻ học viên: escape + tên dài xuống dòng đẹp ---------- */
window.buildStudentCard = function (st) {
  var L = { 'per-session': 'Theo buổi', 'per-month': 'Theo tháng',
            'free-session': 'Tự do/buổi', 'free-month': 'Tự do/tháng' };
  var ft = String(st.feeType || '');
  var feeDisplay = st.fee > 0 ? csVND(st.fee) + (ft.indexOf('month') !== -1 ? '/tháng' : '/buổi') : 'Chưa set';
  var h = Math.floor(st.totalMinutes / 60), m = st.totalMinutes % 60;
  var key = encodeKey(st.name);
  return '<div class="stu-card' + (st.completed ? ' completed' : '') + '">' +
    '<div class="stu-info">' +
      '<h4 title="' + csEsc(st.name) + '"><strong>' + csEsc(st.name) + '</strong></h4>' +
      '<p>' + (L[ft] || '') + ' · ' + feeDisplay + '</p>' +
      '<p>📚 ' + st.doneSessions.length + '/' + st.sessions.length + ' buổi · ⏱️ ' + h + 'h' + (m > 0 ? m + 'p' : '') + '</p>' +
      '<p>💵 Đã tính: ' + csVND(st.earned) +
        (st.uncollected > 0 ? ' · <span style="color:var(--danger)">Còn lại: ' + csVND(st.uncollected) + '</span>' : '') + '</p>' +
      (st.schedules && st.schedules.length ? '<p class="stu-rate">🗓️ ' + csEsc(formatSchedules(st)) + '</p>' : '') +
      (st.note ? '<p style="font-size:.75rem;color:var(--text3)">📝 ' + csEsc(st.note) + '</p>' : '') +
    '</div>' +
    '<div class="stu-actions">' +
      '<label class="switch"><input type="checkbox" ' + (st.completed ? 'checked' : '') +
        ' onchange="toggleStudentDone(\'' + key + '\',this.checked)"><span class="slider"></span></label>' +
      '<button class="btn btn-ghost btn-sm" onclick="openEditStudent(\'' + key + '\')">✏️</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="showStudentDetail(\'' + key + '\')">👁️</button>' +
      '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteStudent(\'' + key + '\')">🗑️</button>' +
    '</div></div>';
};

window.renderSessionItem = function (s, showDate) {
  var d = new Date(s.date);
  var time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  var day = showDate ? d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ' ' : '';
  var info = [day + time, s.duration ? s.duration + 'p' : '', csVND(s._amount != null ? s._amount : s.fee)].filter(Boolean).join(' · ');
  return '<div class="s-item" onclick="onSessionClick(\'' + s.id + '\')" style="cursor:pointer">' +
    '<div class="s-item-info"><strong>' + (s.status === 'Done' ? '✅' : '🕐') + ' ' +
    csEsc(s.name || s.student) + '</strong><span>' + info + '</span></div>' +
    '<span class="s-item-edit">✏️</span></div>';
};

/* ---------- 7. Sửa/xoá/lưu học viên: so khớp theo key ---------- */
window.toggleStudentDone = function (key, checked) {
  var k = csKey(decodeKey(key)), data = getStudentData();
  var f = data.find(function (s) { return csKey(s.name) === k; });
  if (f) f.completed = checked;
  else data.push({ id: 'manual-' + Date.now(), name: csNormalizeName(decodeKey(key)),
    feeType: 'free-session', fee: 0, schedules: [], repeat: 'weekly',
    note: '', completed: checked, group: '', aliases: [] });
  saveStudentData(data); renderStudents(); updateStats();
};

window.handleStudentDelete = function (mode) {
  if (!_pendingDeleteStudent) return;
  var name = _pendingDeleteStudent, k = csKey(name);
  var modal = document.getElementById('student-delete-modal'); if (modal) modal.hidden = true;
  if (mode === 'cancel') { _pendingDeleteStudent = null; return; }

  saveStudentData(getStudentData().filter(function (s) { return csKey(s.name) !== k; }));

  if (mode === 'gcal') {
    if (typeof deleteEvent === 'function' && isTokenValid()) {
      var done = {};
      getAllSessions().filter(function (s) { return s.studentKey === k && s.source === 'gcal'; })
        .forEach(function (s) {
          var id = s.recurringEventId || s.id;
          if (!done[id]) { done[id] = 1; deleteEvent(id).catch(function () {}); }
        });
      setTimeout(function () { refreshAfterChange(); }, 1200);
    } else { alert('Cần đăng nhập Google trước khi xóa trên Calendar.'); }
  }
  if (mode === 'hide') {
    getAllSessions().filter(function (s) { return s.studentKey === k; })
      .forEach(function (s) { hideEventLocally(s.id); });
  }
  addDeletedStudent(k);
  _pendingDeleteStudent = null;
  StatsCore.invalidate();
  renderStudents(); updateDashboard(); updateStats();
};

/* Ô "tên khác trên Calendar" (alias) để gộp 2 tên về 1 học viên */
function csEnsureAliasField() {
  var nameEl = document.getElementById('sf-name');
  if (!nameEl || document.getElementById('sf-aliases')) return;
  var wrap = nameEl.closest('.field'); if (!wrap) return;
  var div = document.createElement('div');
  div.className = 'field';
  div.innerHTML = '<label>Tên khác trên Calendar (cách nhau bằng <b>;</b>)</label>' +
    '<input type="text" id="sf-aliases" placeholder="VD: FLIC; Fun For Starters">';
  wrap.parentNode.insertBefore(div, wrap.nextSibling);
}
var _csOpenAdd = window.openAddStudentModal;
window.openAddStudentModal = function () {
  csEnsureAliasField(); _csOpenAdd();
  var a = document.getElementById('sf-aliases'); if (a) a.value = '';
};
var _csOpenEdit = window.openEditStudent;
window.openEditStudent = function (key) {
  csEnsureAliasField(); _csOpenEdit(key);
  var st = csFindStudent(decodeKey(key));
  var a = document.getElementById('sf-aliases');
  if (a) a.value = (st && st.aliases) ? [].concat(st.aliases).join('; ') : '';
};

window.saveStudent = function (e) {
  e.preventDefault();
  var editId = document.getElementById('sf-id').value;
  var name = csNormalizeName(document.getElementById('sf-name').value);
  if (!name) return alert('Nhập tên học viên');
  var feeType = document.getElementById('sf-fee-type').value;
  var fee = parseInt(document.getElementById('sf-fee').value, 10) || 0;
  var note = document.getElementById('sf-note').value.trim();
  var repeat = document.getElementById('sf-repeat').value;
  var group = document.getElementById('sf-group').value;
  var aliasEl = document.getElementById('sf-aliases');
  var aliases = aliasEl ? aliasEl.value.split(';').map(csNormalizeName).filter(Boolean) : [];

  var schedules = [];
  document.querySelectorAll('.schedule-row').forEach(function (row) {
    var st = row.querySelector('.sc-start'), en = row.querySelector('.sc-end');
    var days = [];
    row.querySelectorAll('.sc-days input:checked').forEach(function (cb) { days.push(parseInt(cb.value, 10)); });
    if (st && en && st.value && en.value) schedules.push({ start: st.value, end: en.value, days: days });
  });

  var data = getStudentData();
  var obj = { name: name, feeType: feeType, fee: fee, schedules: schedules,
              repeat: repeat, note: note, group: group, aliases: aliases };
  if (editId) {
    var i = data.findIndex(function (s) { return csKey(s.name) === csKey(editId); });
    if (i !== -1) data[i] = Object.assign(data[i], obj);
    else data.push(Object.assign({ id: 'manual-' + Date.now(), completed: false }, obj));
  } else {
    if (data.find(function (s) { return csKey(s.name) === csKey(name); }))
      return alert('Học viên "' + name + '" đã tồn tại');
    data.push(Object.assign({ id: 'manual-' + Date.now(), completed: false }, obj));
  }

  if (group && typeof getGroups === 'function') {
    var gs = getGroups(), g = gs.find(function (x) { return x.name === group; });
    if (g && g.members.indexOf(name) === -1) { g.members.push(name); saveGroups(gs); }
  }
  saveStudentData(data);
  closeStudentModal();

  var chk = document.getElementById('sf-add-gcal');
  if (chk && chk.checked && editId === '') {
    var sd = document.getElementById('sf-start-date'), sc = document.getElementById('sf-count');
    createStudentOnGCal(name, schedules, repeat, sd ? sd.value : '', sc ? parseInt(sc.value, 10) || 0 : 0);
  }
  StatsCore.invalidate();
  renderStudents(); updateDashboard(); updateStats();
};

/* ---------- 8. Dashboard ---------- */
window.updateDashboard = function () {
  var students = getAllStudents();
  var active = students.filter(function (s) { return !s.completed; });
  var now = new Date();
  var mF = new Date(now.getFullYear(), now.getMonth(), 1);
  var mT = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  var dw = now.getDay() || 7;
  var wF = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dw + 1);
  var wT = new Date(wF); wT.setDate(wT.getDate() + 6); wT.setHours(23, 59, 59, 999);
  var m = StatsCore.range(mF, mT), w = StatsCore.range(wF, wT);
  var el = function (id) { return document.getElementById(id); };
  if (el('w-students')) el('w-students').textContent = active.length;
  if (el('w-week')) el('w-week').textContent = w.count;
  if (el('w-salary')) el('w-salary').textContent = csVND(m.earned);
  if (el('w-hours')) el('w-hours').textContent = Math.floor(m.minutes / 60) + 'h';

  var t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var t1 = new Date(t0); t1.setHours(23, 59, 59, 999);
  if (el('today-list')) {
    var td = StatsCore.list(t0, t1);
    el('today-list').innerHTML = td.length ? td.map(function (s) { return renderSessionItem(s, false); }).join('')
      : '<p class="muted">Hôm nay không có buổi dạy.</p>';
  }
  if (el('week-list')) {
    var wk = StatsCore.list(wF, wT);
    el('week-list').innerHTML = wk.length ? wk.map(function (s) { return renderSessionItem(s, true); }).join('')
      : '<p class="muted">Tuần này không có buổi dạy.</p>';
  }
};

/* ---------- 9. THỐNG KÊ: kỳ linh hoạt + so sánh + biểu đồ ---------- */
var csPeriod = { mode: 'month', anchor: new Date(), from: null, to: null };
var _csLastRange = null;

function csRangeOf(p) {
  var a = new Date(p.anchor), from, to, label;
  if (p.mode === 'day') {
    from = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    to = new Date(from); to.setHours(23, 59, 59, 999);
    label = 'Ngày ' + from.toLocaleDateString('vi-VN');
  } else if (p.mode === 'week') {
    var dw = a.getDay() || 7;
    from = new Date(a.getFullYear(), a.getMonth(), a.getDate() - dw + 1);
    to = new Date(from); to.setDate(to.getDate() + 6); to.setHours(23, 59, 59, 999);
    label = 'Tuần ' + from.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) +
            ' – ' + to.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  } else if (p.mode === 'quarter') {
    var q = Math.floor(a.getMonth() / 3);
    from = new Date(a.getFullYear(), q * 3, 1);
    to = new Date(a.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
    label = 'Quý ' + (q + 1) + '/' + a.getFullYear();
  } else if (p.mode === 'year') {
    from = new Date(a.getFullYear(), 0, 1);
    to = new Date(a.getFullYear(), 11, 31, 23, 59, 59, 999);
    label = 'Năm ' + a.getFullYear();
  } else if (p.mode === 'custom') {
    from = p.from ? new Date(p.from + 'T00:00:00') : new Date(1970, 0, 1);
    to = p.to ? new Date(p.to + 'T23:59:59') : new Date(2100, 0, 1);
    label = from.toLocaleDateString('vi-VN') + ' – ' + to.toLocaleDateString('vi-VN');
  } else if (p.mode === 'all') {
    var b = StatsCore.bounds(); from = b.from; to = b.to; label = 'Tất cả';
  } else {
    from = new Date(a.getFullYear(), a.getMonth(), 1);
    to = new Date(a.getFullYear(), a.getMonth() + 1, 0, 23, 59, 59, 999);
    label = 'Tháng ' + (a.getMonth() + 1) + '/' + a.getFullYear();
  }
  return { from: from, to: to, label: label };
}
function csPrevRangeOf(p) {
  if (p.mode === 'all') return null;
  if (p.mode === 'custom') {
    var r = csRangeOf(p), len = r.to - r.from;
    return { from: new Date(+r.from - len - 1), to: new Date(+r.from - 1), label: 'kỳ trước' };
  }
  var q = { mode: p.mode, anchor: new Date(p.anchor) }, a = q.anchor;
  if (p.mode === 'day') a.setDate(a.getDate() - 1);
  else if (p.mode === 'week') a.setDate(a.getDate() - 7);
  else if (p.mode === 'quarter') a.setMonth(a.getMonth() - 3, 1);
  else if (p.mode === 'year') a.setFullYear(a.getFullYear() - 1, 0, 1);
  else a.setMonth(a.getMonth() - 1, 1);
  return csRangeOf(q);
}
function csSetMode(m) { csPeriod.mode = m; updateStats(); }
function csShift(step) {
  var p = csPeriod, a = new Date(p.anchor);
  if (p.mode === 'day') a.setDate(a.getDate() + step);
  else if (p.mode === 'week') a.setDate(a.getDate() + 7 * step);
  else if (p.mode === 'quarter') a.setMonth(a.getMonth() + 3 * step, 1);
  else if (p.mode === 'year') a.setFullYear(a.getFullYear() + step, 0, 1);
  else if (p.mode === 'month') a.setMonth(a.getMonth() + step, 1);
  else return;
  p.anchor = a; updateStats();
}
function csToday() { csPeriod.anchor = new Date(); updateStats(); }
function csApplyCustom() {
  var f = document.getElementById('cs-from'), t = document.getElementById('cs-to');
  if (!f || !t || !f.value || !t.value) return alert('Chọn cả 2 mốc ngày');
  csPeriod.mode = 'custom'; csPeriod.from = f.value; csPeriod.to = t.value; updateStats();
}

function csEnsureStatsUI() {
  var page = document.getElementById('page-stats');
  if (!page || document.getElementById('cs-period-bar')) return;
  var old = document.getElementById('stats-month-bar');
  if (old) { old.innerHTML = ''; old.style.display = 'none'; }

  var bar = document.createElement('div');
  bar.id = 'cs-period-bar'; bar.className = 'cs-period-bar';
  var modes = [['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng'],
               ['quarter', 'Quý'], ['year', 'Năm'], ['all', 'Tất cả']];
  bar.innerHTML =
    '<div class="cs-row">' +
      '<button class="cs-nav" onclick="csShift(-1)">‹</button>' +
      '<span class="cs-plabel" id="cs-period-label">—</span>' +
      '<button class="cs-nav" onclick="csShift(1)">›</button>' +
      '<button class="cs-chip" onclick="csToday()">Hôm nay</button>' +
    '</div>' +
    '<div class="cs-row" id="cs-mode-row">' +
      modes.map(function (m) {
        return '<button class="cs-chip" data-mode="' + m[0] + '" onclick="csSetMode(\'' + m[0] + '\')">' + m[1] + '</button>';
      }).join('') +
    '</div>' +
    '<div class="cs-row"><input type="date" id="cs-from" class="cs-date"><span class="muted">→</span>' +
      '<input type="date" id="cs-to" class="cs-date">' +
      '<button class="cs-chip" onclick="csApplyCustom()">Áp dụng</button></div>' +
    '<div class="cs-compare" id="cs-compare"></div>';
  page.insertBefore(bar, page.firstChild);

  var detailBody = document.getElementById('stats-detail');
  var card = detailBody ? detailBody.closest('.card') : null;
  var chart = document.createElement('div');
  chart.className = 'card';
  chart.innerHTML = '<div class="card-header"><h3>📈 Biểu đồ theo thời gian</h3></div>' +
                    '<div class="card-body" id="cs-chart"></div>';
  if (card) page.insertBefore(chart, card); else page.appendChild(chart);

  var hdr = card ? card.querySelector('.card-header') : null;
  if (hdr && !document.getElementById('cs-group-by')) {
    var sel = document.createElement('select');
    sel.id = 'cs-group-by'; sel.className = 'cs-select';
    sel.innerHTML = '<option value="student">Theo học viên</option>' +
                    '<option value="group">Theo lớp nhóm</option>' +
                    '<option value="month">Theo tháng</option>' +
                    '<option value="week">Theo tuần</option>';
    sel.onchange = csRenderDetail;
    hdr.appendChild(sel);
  }
}

window.buildMonthBar = function () {};
window.setStatsMonth = function (m) {
  if (m === 'null' || m === null) csPeriod.mode = 'all';
  else if (m === 'week') csPeriod.mode = 'week';
  updateStats();
};

window.updateStats = function () {
  var page = document.getElementById('page-stats');
  if (!page || !page.classList.contains('active')) return; // chỉ tính khi đang xem tab
  csEnsureStatsUI();

  var r = csRangeOf(csPeriod);
  _csLastRange = r;
  var cur = StatsCore.range(r.from, r.to);
  var students = getAllStudents();

  var lbl = document.getElementById('cs-period-label');
  if (lbl) lbl.textContent = r.label;
  document.querySelectorAll('#cs-mode-row .cs-chip').forEach(function (b) {
    b.classList.toggle('active', b.dataset.mode === csPeriod.mode);
  });

  var el = function (id) { return document.getElementById(id); };
  if (el('st-revenue')) el('st-revenue').textContent = csVND(cur.expected);
  if (el('st-collected')) el('st-collected').textContent = csVND(cur.earned);
  if (el('st-uncollected')) el('st-uncollected').textContent = csVND(Math.max(0, cur.expected - cur.earned));
  if (el('st-students')) el('st-students').textContent =
    Object.keys(StatsCore.breakdown(r.from, r.to, 'student')).length;
  if (el('st-total')) el('st-total').textContent = cur.count;
  if (el('st-done')) el('st-done').textContent = cur.done;
  if (el('st-hours')) el('st-hours').textContent = Math.floor(cur.minutes / 60) + 'h';
  if (el('st-avg')) el('st-avg').textContent = csVND(cur.done ? Math.round(cur.earned / cur.done) : 0);

  var cmp = document.getElementById('cs-compare');
  if (cmp) {
    var pr = csPrevRangeOf(csPeriod);
    if (!pr) cmp.textContent = '';
    else {
      var prev = StatsCore.range(pr.from, pr.to);
      if (!prev.earned && !cur.earned) cmp.textContent = '';
      else {
        var diff = cur.earned - prev.earned;
        var pct = prev.earned > 0 ? Math.round(diff / prev.earned * 100) : null;
        cmp.innerHTML = 'So với kỳ trước (' + csEsc(pr.label) + '): ' +
          '<b style="color:' + (diff >= 0 ? 'var(--success)' : 'var(--danger)') + '">' +
          (diff >= 0 ? '+' : '−') + csVND(Math.abs(diff)) +
          (pct !== null ? ' (' + (diff >= 0 ? '+' : '') + pct + '%)' : '') + '</b>' +
          ' · ' + prev.done + ' → ' + cur.done + ' buổi';
      }
    }
  }
  csRenderChart(r);
  csRenderDetail();
};

function csRenderChart(r) {
  var el = document.getElementById('cs-chart'); if (!el) return;
  var days = (r.to - r.from) / 86400000;
  var unit = days <= 14 ? 'day' : (days <= 120 ? 'week' : 'month');
  var map = StatsCore.breakdown(r.from, r.to, unit);
  var keys = Object.keys(map).sort();
  if (!keys.length) { el.innerHTML = '<p class="muted">Không có dữ liệu trong kỳ này.</p>'; return; }
  var max = 0; keys.forEach(function (k) { if (map[k].earned > max) max = map[k].earned; });
  el.innerHTML = keys.map(function (k) {
    var v = map[k], pct = max > 0 ? Math.round(v.earned / max * 100) : 0;
    return '<div class="cs-bar-row"><span class="cs-bar-lbl">' + csEsc(csLabelOf(k, unit)) + '</span>' +
      '<span class="cs-bar-track"><span class="cs-bar-fill" style="width:' + pct + '%"></span></span>' +
      '<span class="cs-bar-val">' + csVND(v.earned) + ' · ' + v.done + 'b</span></div>';
  }).join('');
}
function csLabelOf(k, unit) {
  if (unit === 'day') { var p = k.split('-'); return p[2] + '/' + p[1]; }
  if (unit === 'week') { return 'Tuần ' + k.split('-W')[1]; }
  var q = k.split('-'); return 'T' + parseInt(q[1], 10) + '/' + q[0];
}

function csRenderDetail() {
  var box = document.getElementById('stats-detail');
  var r = _csLastRange;
  if (!box || !r) return;
  var by = (document.getElementById('cs-group-by') || {}).value || 'student';
  var map = StatsCore.breakdown(r.from, r.to, by);

  if (by === 'student') {
    var students = getAllStudents(), byK = {};
    students.forEach(function (s) { byK[s.key] = s; });
    var rows = Object.keys(map).map(function (k) { return { k: k, v: map[k], st: byK[k] }; })
      .filter(function (x) {
        if (!x.st) return true;
        if (currentStatsFilter === 'active') return !x.st.completed;
        if (currentStatsFilter === 'completed') return !!x.st.completed;
        return true;
      })
      .sort(function (a, b) { return b.v.earned - a.v.earned; });
    if (!rows.length) { box.innerHTML = '<p class="muted">Không có dữ liệu.</p>'; return; }
    box.innerHTML = rows.map(function (x) {
      var nm = x.st ? x.st.name : x.k;
      var tag = (x.st && x.st.completed) ? '<span class="stu-done-tag">Đã xong</span>' : '';
      var debt = x.v.expected - x.v.earned;
      return '<div class="stats-student-row" onclick="showStudentDetail(\'' + encodeKey(nm) + '\')" style="cursor:pointer">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
            '<span class="stats-student-name">' + csEsc(nm) + '</span>' + tag + '</div>' +
          '<div class="stats-student-info">' + x.v.done + '/' + x.v.count + ' buổi · ' +
            Math.floor(x.v.minutes / 60) + 'h · ' + csVND(x.v.earned) +
            (debt > 0 ? ' · <span style="color:var(--danger)">chờ dạy ' + csVND(debt) + '</span>' : '') +
          '</div></div><span style="color:var(--text3);font-size:.85rem">👁️</span></div>';
    }).join('');
    return;
  }
  var ks = Object.keys(map).sort(function (a, b) {
    return (by === 'group') ? map[b].earned - map[a].earned : a.localeCompare(b);
  });
  if (!ks.length) { box.innerHTML = '<p class="muted">Không có dữ liệu.</p>'; return; }
  box.innerHTML = ks.map(function (k) {
    var v = map[k];
    var nm = (by === 'month') ? csLabelOf(k, 'month') : (by === 'week' ? csLabelOf(k, 'week') : k);
    return '<div class="stats-student-row"><div style="flex:1;min-width:0">' +
      '<span class="stats-student-name">' + csEsc(nm) + '</span>' +
      '<div class="stats-student-info">' + v.done + '/' + v.count + ' buổi · ' +
      Math.floor(v.minutes / 60) + 'h · ' + csVND(v.earned) + '</div></div></div>';
  }).join('');
}

/* Tab Tất cả / Đang học / Đã xong: gắn 1 lần bằng delegation */
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('.stab') : null;
  if (!b) return;
  document.querySelectorAll('.stab').forEach(function (x) { x.classList.remove('active'); });
  b.classList.add('active');
  currentStatsFilter = b.dataset.filter || 'all';
  csRenderDetail();
});

/* ---------- 10. Mọi thay đổi dữ liệu -> tính lại ---------- */
['saveStudentData', 'saveGroups', 'hideEventLocally', 'unhideEvent',
 'addDeletedStudent', 'saveHiddenEvents'].forEach(function (fn) {
  var orig = window[fn];
  if (typeof orig !== 'function') return;
  window[fn] = function () { var r = orig.apply(this, arguments); StatsCore.invalidate(); return r; };
});

window.refreshAfterChange = function () {
  var ifr = document.getElementById('gcal-iframe');
  if (ifr) { var src = ifr.src; ifr.src = ''; setTimeout(function () { ifr.src = src; }, 300); }
  _eventsCacheTime = 0;            // bỏ cache 60s -> đọc lại Calendar ngay
  StatsCore.invalidate();
  setTimeout(function () { loadAllExternalData(true); }, 1200);
};

window.loadAllExternalData = async function (force) {
  try {
    await fetchGCalEvents(force === true);
    StatsCore.invalidate();
    updateDashboard(); updateStats(); renderStudents(); renderGroups();
    syncUI('✅ Synced');
  } catch (e) { console.warn('Load failed:', e); syncUI('⚠️ Offline'); }
};

/* ---------- 11. CSS bổ sung ---------- */
function csInjectCSS() {
  if (document.getElementById('cs-patch-css')) return;
  var s = document.createElement('style');
  s.id = 'cs-patch-css';
  s.textContent =
    '.stu-card h4{white-space:normal;overflow-wrap:anywhere;line-height:1.3;display:-webkit-box;' +
      '-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    '.stats-student-name{overflow-wrap:anywhere}' +
    '.cs-period-bar{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}' +
    '.cs-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.cs-plabel{font-weight:700;min-width:150px;text-align:center}' +
    '.cs-nav,.cs-chip{background:var(--bg2,#222);color:inherit;border:1px solid var(--border,#3a3a3a);' +
      'border-radius:8px;padding:5px 12px;cursor:pointer;font-size:.85rem}' +
    '.cs-chip.active{background:var(--accent,#6c8cff);color:#fff;border-color:transparent}' +
    '.cs-date,.cs-select{background:var(--bg2,#222);color:inherit;border:1px solid var(--border,#3a3a3a);' +
      'border-radius:8px;padding:5px 8px;font-size:.85rem}' +
    '.cs-select{margin-left:auto}' +
    '.cs-compare{font-size:.85rem;color:var(--text3,#999)}' +
    '.cs-bar-row{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:.8rem}' +
    '.cs-bar-lbl{width:74px;flex-shrink:0;color:var(--text3,#999)}' +
    '.cs-bar-track{flex:1;height:10px;background:var(--bg2,#222);border-radius:6px;overflow:hidden}' +
    '.cs-bar-fill{display:block;height:100%;background:var(--accent,#6c8cff);border-radius:6px}' +
    '.cs-bar-val{width:110px;flex-shrink:0;text-align:right}';
  document.head.appendChild(s);
}

function csInit() { csInjectCSS(); csEnsureStatsUI(); csEnsureAliasField(); StatsCore.invalidate(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', csInit);
else csInit();
console.log('✅ patch-v4 loaded');
