/* ===== STUDENTS.JS - Full student management ===== */

function getStudentData() {
  try { return JSON.parse(localStorage.getItem('cs-students-v2') || '[]'); } catch(e) { return []; }
}
function saveStudentData(arr) {
  localStorage.setItem('cs-students-v2', JSON.stringify(arr));
}

/* Merge: manual students + GCal auto-detected */
function getAllStudents() {
  var manual = getStudentData();
  var gcalEvents = (typeof GCalSync !== 'undefined') ? GCalSync.getCache() : [];
  var overrides = {};
  manual.forEach(function(s) { overrides[s.name] = s; });

  // Auto-detect from GCal
  var gcalNames = new Set();
  gcalEvents.forEach(function(ev) {
    if (ev.student && ev.student.trim()) gcalNames.add(ev.student.trim());
  });

  // Merge: manual first, then add GCal-only
  var result = manual.map(function(s) { return Object.assign({}, s); });
  gcalNames.forEach(function(name) {
    if (!overrides[name]) {
      result.push({
        id: 'gcal-' + name,
        name: name,
        feeType: 'free-session',
        fee: 0,
        schedules: [],
        repeat: 'weekly',
        repeatDays: [],
        note: '',
        completed: false,
        source: 'gcal'
      });
    }
  });

  // Attach session data
  var allSessions = (typeof getAllSessions === 'function') ? getAllSessions() : [];
  result.forEach(function(st) {
    st.sessions = allSessions.filter(function(s) { return s.student === st.name; });
    st.doneSessions = st.sessions.filter(function(s) { return s.status === 'Done'; });
    st.totalMinutes = st.doneSessions.reduce(function(sum, s) { return sum + (s.duration || 0); }, 0);
    // Calc earned based on fee type
    if (st.feeType === 'per-session' || st.feeType === 'free-session') {
      st.earned = st.doneSessions.length * (st.fee || 0);
    } else {
      // per-month / free-month: count distinct months with Done sessions
      var months = new Set();
      st.doneSessions.forEach(function(s) {
        var d = new Date(s.date);
        months.add(d.getFullYear() + '-' + d.getMonth());
      });
      st.earned = months.size * (st.fee || 0);
    }
    st.totalExpected = calcExpectedFee(st);
    st.uncollected = Math.max(0, st.totalExpected - st.earned);
  });

  return result;
}

function calcExpectedFee(st) {
  if (st.feeType === 'per-session' || st.feeType === 'free-session') {
    return st.sessions.length * (st.fee || 0);
  } else {
    var months = new Set();
    st.sessions.forEach(function(s) {
      var d = new Date(s.date);
      months.add(d.getFullYear() + '-' + d.getMonth());
    });
    return months.size * (st.fee || 0);
  }
}

function renderStudents() {
  var root = document.getElementById('students-root');
  var countEl = document.getElementById('student-count');
  if (!root) return;

  var students = getAllStudents();
  var active = students.filter(function(s) { return !s.completed; });
  var completed = students.filter(function(s) { return s.completed; });

  if (countEl) countEl.textContent = active.length + ' đang học' + (completed.length > 0 ? ' · ' + completed.length + ' đã xong' : '');

  if (students.length === 0) {
    root.innerHTML = '<p class="muted">Chưa có học viên. Thêm thủ công hoặc tạo sự kiện trên Google Calendar.</p>';
    return;
  }

  var html = '';
  active.forEach(function(st) { html += buildStudentCard(st); });

  if (completed.length > 0) {
    html += '<div class="completed-section"><h4 class="completed-header" onclick="toggleCompleted()">✅ Đã hoàn thành (' + completed.length + ') <span id="completed-arrow">▸</span></h4><div id="completed-list" style="display:none">';
    completed.forEach(function(st) { html += buildStudentCard(st); });
    html += '</div></div>';
  }

  root.innerHTML = html;
}

function buildStudentCard(st) {
  var feeTypeLabels = {'per-session':'Theo buổi','per-month':'Theo tháng','free-session':'Tự do/buổi','free-month':'Tự do/tháng'};
  var feeLabel = feeTypeLabels[st.feeType] || 'Chưa set';
  var feeDisplay = st.fee > 0 ? formatVND(st.fee) + (st.feeType.includes('month') ? '/tháng' : '/buổi') : 'Chưa set phí';
  var hours = Math.floor(st.totalMinutes / 60);
  var mins = st.totalMinutes % 60;
  var opacity = st.completed ? 'opacity:0.55;' : '';
  var key = encodeKey(st.name);

  return '<div class="stu-card' + (st.completed ? ' completed' : '') + '" style="' + opacity + '">' +
    '<div class="stu-info">' +
      '<h4>' + st.name + '</h4>' +
      '<p>📋 ' + feeLabel + ' · ' + feeDisplay + '</p>' +
      '<p>📚 ' + st.sessions.length + ' buổi (' + st.doneSessions.length + ' đã dạy)</p>' +
      '<p>⏱️ ' + hours + 'h' + (mins > 0 ? mins + 'p' : '') + ' · 💰 Đã thu: ' + formatVND(st.earned) + '</p>' +
      (st.uncollected > 0 ? '<p class="stu-rate" style="color:var(--danger)">⚠️ Chưa thu: ' + formatVND(st.uncollected) + '</p>' : '') +
      (st.note ? '<p style="font-size:.78rem;color:var(--text3);margin-top:2px">📝 ' + st.note + '</p>' : '') +
      (st.schedules && st.schedules.length > 0 ? '<p style="font-size:.78rem;color:var(--accent2);margin-top:2px">🗓️ ' + formatSchedules(st) + '</p>' : '') +
    '</div>' +
    '<div class="stu-actions">' +
      '<label class="switch"><input type="checkbox" ' + (st.completed ? 'checked' : '') + ' onchange="toggleStudentDone(\'' + key + '\',this.checked)"><span class="slider"></span></label>' +
      '<button class="btn btn-ghost btn-sm" onclick="openEditStudent(\'' + key + '\')">✏️</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="showStudentDetail(\'' + key + '\')">👁️</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="deleteStudent(\'' + key + '\')">🗑️</button>' +
    '</div></div>';
}

function formatSchedules(st) {
  var dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
  var parts = [];
  if (st.schedules) {
    st.schedules.forEach(function(sc) {
      parts.push(sc.start + '-' + sc.end);
    });
  }
  if (st.repeatDays && st.repeatDays.length > 0) {
    var days = st.repeatDays.map(function(d) { return dayNames[d]; });
    parts.push(days.join(', '));
  }
  var repeatLabels = {'weekly':'mỗi tuần','daily':'mỗi ngày','biweekly':'2 tuần/lần','monthly':'1 tháng/lần'};
  if (st.repeat && repeatLabels[st.repeat]) parts.push(repeatLabels[st.repeat]);
  return parts.join(' · ');
}

function formatVND(n) {
  if (!n || n === 0) return '0đ';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0','') + 'tr';
  if (n >= 1000) return Math.round(n / 1000) + 'k';
  return n + 'đ';
}

function encodeKey(name) { return encodeURIComponent(name); }
function decodeKey(key) { return decodeURIComponent(key); }

function toggleCompleted() {
  var list = document.getElementById('completed-list');
  var arrow = document.getElementById('completed-arrow');
  if (!list) return;
  var show = list.style.display === 'none';
  list.style.display = show ? 'block' : 'none';
  if (arrow) arrow.textContent = show ? '▾' : '▸';
}

function toggleStudentDone(key, checked) {
  var name = decodeKey(key);
  var data = getStudentData();
  var found = data.find(function(s) { return s.name === name; });
  if (found) {
    found.completed = checked;
  } else {
    data.push({ id: 'manual-' + Date.now(), name: name, feeType: 'free-session', fee: 0, schedules: [], repeat: 'weekly', repeatDays: [], note: '', completed: checked });
  }
  saveStudentData(data);
  renderStudents();
}

/* MODAL: Add student */
function openAddStudentModal() {
  document.getElementById('student-modal-title').textContent = 'Thêm học viên';
  document.getElementById('sf-id').value = '';
  document.getElementById('sf-name').value = '';
  document.getElementById('sf-name').disabled = false;
  document.getElementById('sf-fee-type').value = 'per-session';
  document.getElementById('sf-fee').value = '';
  document.getElementById('sf-note').value = '';
  document.getElementById('sf-repeat').value = 'weekly';
  document.querySelectorAll('#sf-repeat-days input').forEach(function(cb) { cb.checked = false; });
  document.getElementById('sf-schedules-list').innerHTML = '';
  addScheduleRow();
  onFeeTypeChange();
  document.getElementById('modal-student').hidden = false;
}

function openEditStudent(key) {
  var name = decodeKey(key);
  var students = getAllStudents();
  var st = students.find(function(s) { return s.name === name; });
  if (!st) return openAddStudentModal();

  document.getElementById('student-modal-title').textContent = 'Sửa học viên';
  document.getElementById('sf-id').value = name;
  document.getElementById('sf-name').value = st.name;
  document.getElementById('sf-name').disabled = false;
  document.getElementById('sf-fee-type').value = st.feeType || 'free-session';
  document.getElementById('sf-fee').value = st.fee || '';
  document.getElementById('sf-note').value = st.note || '';
  document.getElementById('sf-repeat').value = st.repeat || 'weekly';

  document.querySelectorAll('#sf-repeat-days input').forEach(function(cb) {
    cb.checked = (st.repeatDays || []).indexOf(parseInt(cb.value)) !== -1;
  });

  var schedList = document.getElementById('sf-schedules-list');
  schedList.innerHTML = '';
  if (st.schedules && st.schedules.length > 0) {
    st.schedules.forEach(function(sc) { addScheduleRow(sc.start, sc.end, sc.days); });
  } else {
    addScheduleRow();
  }

  onFeeTypeChange();
  document.getElementById('modal-student').hidden = false;
}

function closeStudentModal() { document.getElementById('modal-student').hidden = true; }

function addScheduleRow(startVal, endVal, daysVal) {
  var container = document.getElementById('sf-schedules-list');
  var row = document.createElement('div');
  row.className = 'schedule-row';
  var dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
  var dayChecks = '';
  for (var i = 1; i <= 6; i++) {
    var checked = (daysVal && daysVal.indexOf(i) !== -1) ? 'checked' : '';
    dayChecks += '<label class="day-chip-sm"><input type="checkbox" value="' + i + '" ' + checked + '><span>' + dayNames[i] + '</span></label>';
  }
  var sunChecked = (daysVal && daysVal.indexOf(0) !== -1) ? 'checked' : '';
  dayChecks += '<label class="day-chip-sm"><input type="checkbox" value="0" ' + sunChecked + '><span>CN</span></label>';

  row.innerHTML = '<div class="field-row">' +
    '<div class="field"><label>Bắt đầu</label><input type="time" class="sc-start" value="' + (startVal || '19:00') + '"></div>' +
    '<div class="field"><label>Kết thúc</label><input type="time" class="sc-end" value="' + (endVal || '20:00') + '"></div>' +
    '</div>' +
    '<div class="sc-days">' + dayChecks + '</div>' +
    '<button type="button" class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()" style="align-self:flex-end;color:var(--danger)">✕ Xóa</button>';
  container.appendChild(row);
}

function onFeeTypeChange() {
  var type = document.getElementById('sf-fee-type').value;
  var schedSection = document.getElementById('sf-schedule-section');
  var feeLabel = document.getElementById('sf-fee-label');
  if (type === 'per-session' || type === 'per-month') {
    schedSection.style.display = 'block';
  } else {
    schedSection.style.display = 'none';
  }
  if (type.includes('month')) {
    feeLabel.textContent = 'Học phí / tháng (VNĐ)';
  } else {
    feeLabel.textContent = 'Học phí / buổi (VNĐ)';
  }
}

function saveStudent(e) {
  e.preventDefault();
  var editId = document.getElementById('sf-id').value;
  var name = document.getElementById('sf-name').value.trim();
  if (!name) return alert('Nhập tên học viên');

  var feeType = document.getElementById('sf-fee-type').value;
  var fee = parseInt(document.getElementById('sf-fee').value) || 0;
  var note = document.getElementById('sf-note').value.trim();
  var repeat = document.getElementById('sf-repeat').value;

  var repeatDays = [];
  document.querySelectorAll('#sf-repeat-days input:checked').forEach(function(cb) {
    repeatDays.push(parseInt(cb.value));
  });

  var schedules = [];
  document.querySelectorAll('.schedule-row').forEach(function(row) {
    var start = row.querySelector('.sc-start')?.value || '';
    var end = row.querySelector('.sc-end')?.value || '';
    var days = [];
    row.querySelectorAll('.sc-days input:checked').forEach(function(cb) { days.push(parseInt(cb.value)); });
    if (start && end) schedules.push({ start: start, end: end, days: days });
  });

  var data = getStudentData();
  if (editId) {
    var idx = data.findIndex(function(s) { return s.name === editId; });
    if (idx !== -1) {
      data[idx].name = name;
      data[idx].feeType = feeType;
      data[idx].fee = fee;
      data[idx].schedules = schedules;
      data[idx].repeat = repeat;
      data[idx].repeatDays = repeatDays;
      data[idx].note = note;
    } else {
      data.push({ id: 'manual-' + Date.now(), name: name, feeType: feeType, fee: fee, schedules: schedules, repeat: repeat, repeatDays: repeatDays, note: note, completed: false });
    }
  } else {
    if (data.find(function(s) { return s.name === name; })) return alert('Học viên "' + name + '" đã tồn tại');
    data.push({ id: 'manual-' + Date.now(), name: name, feeType: feeType, fee: fee, schedules: schedules, repeat: repeat, repeatDays: repeatDays, note: note, completed: false });
  }

  saveStudentData(data);
  closeStudentModal();
  renderStudents();
  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof updateStats === 'function') updateStats();
}

function deleteStudent(key) {
  var name = decodeKey(key);
  if (!confirm('Xóa học viên "' + name + '"?')) return;
  var data = getStudentData();
  data = data.filter(function(s) { return s.name !== name; });
  saveStudentData(data);
  renderStudents();
}

function showStudentDetail(key) {
  var name = decodeKey(key);
  var students = getAllStudents();
  var st = students.find(function(s) { return s.name === name; });
  if (!st) return;

  var feeTypeLabels = {'per-session':'Theo buổi','per-month':'Theo tháng','free-session':'Tự do/buổi','free-month':'Tự do/tháng'};
  var hours = Math.floor(st.totalMinutes / 60);
  var mins = st.totalMinutes % 60;
  var upcoming = st.sessions.filter(function(s) { return s.status !== 'Done'; }).sort(function(a,b) { return new Date(a.date) - new Date(b.date); });
  var done = st.doneSessions.sort(function(a,b) { return new Date(b.date) - new Date(a.date); });

  var html = '<h3 style="margin-bottom:12px">' + st.name + '</h3>';
  html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;font-size:.85rem">';
  html += '<span>📋 ' + (feeTypeLabels[st.feeType] || '') + '</span>';
  html += '<span>💰 Học phí: ' + (st.fee > 0 ? formatVND(st.fee) : 'Chưa set') + '</span>';
  html += '<span>📚 Tổng: ' + st.sessions.length + ' buổi (' + st.doneSessions.length + ' đã dạy)</span>';
  html += '<span>⏱️ ' + hours + 'h' + (mins > 0 ? mins + 'p' : '') + '</span>';
  html += '<span>💵 Đã thu: ' + formatVND(st.earned) + '</span>';
  if (st.uncollected > 0) html += '<span style="color:var(--danger)">⚠️ Chưa thu: ' + formatVND(st.uncollected) + '</span>';
  if (st.note) html += '<span>📝 ' + st.note + '</span>';
  if (st.schedules && st.schedules.length > 0) html += '<span>🗓️ ' + formatSchedules(st) + '</span>';
  html += '</div>';

  if (upcoming.length > 0) {
    html += '<h4 style="color:var(--accent);margin-bottom:8px">Sắp tới</h4>';
    upcoming.slice(0, 8).forEach(function(s) {
      var d = new Date(s.date);
      html += '<div class="s-item"><div class="s-item-info"><strong>' + s.name + '</strong><span>' + d.toLocaleDateString('vi-VN',{weekday:'short',day:'numeric',month:'numeric'}) + ' · ' + d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) + '</span></div></div>';
    });
  }

  if (done.length > 0) {
    html += '<h4 style="color:var(--text3);margin:16px 0 8px">Lịch sử</h4>';
    done.slice(0, 10).forEach(function(s) {
      var d = new Date(s.date);
      html += '<div class="s-item" style="opacity:0.7;border-left-color:var(--success)"><div class="s-item-info"><strong>' + s.name + '</strong><span>' + d.toLocaleDateString('vi-VN',{day:'numeric',month:'numeric'}) + ' · ' + formatVND(s.fee || 0) + ' · ' + (s.duration || 0) + 'p</span></div></div>';
    });
  }

  document.getElementById('rp-body').innerHTML = html;
  openRightPanel();
}

function getActiveStudentNames() {
  var students = getAllStudents();
  return students.filter(function(s) { return !s.completed; }).map(function(s) { return s.name; });
}
