/* ===== STUDENTS.JS v3 – search/filter + fixed delete ===== */

var addDeletedStudent(name);
  _pendingDeleteStudent = null;
var _studentFilters = { search: '', group: '', day: '', feeType: '' };

/* Blacklist: deleted students */
function getDeletedStudents(){try{return JSON.parse(localStorage.getItem("cs-deleted-students")||"[]")}catch(e){return []}}
function addDeletedStudent(n){var l=getDeletedStudents();if(l.indexOf(n)===-1){l.push(n);localStorage.setItem("cs-deleted-students",JSON.stringify(l))}}
function isStudentDeleted(n){return getDeletedStudents().indexOf(n)!==-1}

function getStudentData() {
  try { return JSON.parse(localStorage.getItem('cs-students-v2') || '[]'); } catch(e) { return []; }
}
function saveStudentData(arr) { localStorage.setItem('cs-students-v2', JSON.stringify(arr)); }

function getAllStudents() {
  var manual = getStudentData();
  var gcalEvents = (typeof GCalSync !== 'undefined') ? GCalSync.getCache() : [];
  var manualNames = {};
  manual.forEach(function(s) { manualNames[s.name] = true; });

  var gcalNames = new Set();
  gcalEvents.forEach(function(ev) { if (ev.student && ev.student.trim()) gcalNames.add(ev.student.trim()); });

  var result = manual.map(function(s) { return Object.assign({}, s); });
  gcalNames.forEach(function(name) {
    if (!manualNames[name] && !isStudentDeleted(name)) {
      result.push({ id:'gcal-'+name, name:name, feeType:'free-session', fee:0, schedules:[], repeat:'weekly', note:'', completed:false, group:'', source:'gcal' });
    }
  });

  var allSessions = (typeof getAllSessions === 'function') ? getAllSessions() : [];
  result.forEach(function(st) {
    st.sessions = allSessions.filter(function(s) { return s.student === st.name; });
    st.doneSessions = st.sessions.filter(function(s) { return s.status === 'Done'; });
    st.totalMinutes = st.doneSessions.reduce(function(sum,s) { return sum + (s.duration||0); }, 0);
    if (st.feeType === 'per-session' || st.feeType === 'free-session') {
      st.earned = st.doneSessions.length * (st.fee || 0);
      st.totalExpected = st.sessions.length * (st.fee || 0);
    } else {
      var doneM = new Set(), allM = new Set();
      st.doneSessions.forEach(function(s) { var d=new Date(s.date); doneM.add(d.getFullYear()+'-'+d.getMonth()); });
      st.sessions.forEach(function(s) { var d=new Date(s.date); allM.add(d.getFullYear()+'-'+d.getMonth()); });
      st.earned = doneM.size * (st.fee || 0);
      st.totalExpected = allM.size * (st.fee || 0);
    }
    st.uncollected = Math.max(0, st.totalExpected - st.earned);
  });
  return result;
}

/* ===== FILTER TOOLBAR ===== */
function buildStudentToolbar() {
  var groups = (typeof getGroups === 'function') ? getGroups() : [];
  var dayNames = ['CN','T2','T3','T4','T5','T6','T7'];

  var html = '<div class="stu-filter-bar">';
  // Search
  html += '<div class="stu-search-wrap"><input type="text" id="stu-search" class="stu-search" placeholder="Tìm học viên..." oninput="onStudentFilterChange()"></div>';
  // Group filter
  html += '<select id="stu-filter-group" class="stu-filter-select" onchange="onStudentFilterChange()">';
  html += '<option value="">Tất cả nhóm</option>';
  html += '<option value="__none__">Không có nhóm</option>';
  groups.forEach(function(g) { html += '<option value="' + g.name + '">' + g.name + '</option>'; });
  html += '</select>';
  // Day filter
  html += '<select id="stu-filter-day" class="stu-filter-select" onchange="onStudentFilterChange()">';
  html += '<option value="">Tất cả thứ</option>';
  for (var i = 1; i <= 6; i++) { html += '<option value="' + i + '">' + dayNames[i] + '</option>'; }
  html += '<option value="0">CN</option>';
  html += '</select>';
  // Fee type filter
  html += '<select id="stu-filter-fee" class="stu-filter-select" onchange="onStudentFilterChange()">';
  html += '<option value="">Tất cả hình thức</option>';
  html += '<option value="per-session">Theo buổi</option>';
  html += '<option value="per-month">Theo tháng</option>';
  html += '<option value="free-session">Tự do/buổi</option>';
  html += '<option value="free-month">Tự do/tháng</option>';
  html += '</select>';
  html += '</div>';
  return html;
}

function onStudentFilterChange() {
  var searchEl = document.getElementById('stu-search');
  var groupEl = document.getElementById('stu-filter-group');
  var dayEl = document.getElementById('stu-filter-day');
  var feeEl = document.getElementById('stu-filter-fee');
  _studentFilters.search = searchEl ? searchEl.value.toLowerCase().trim() : '';
  _studentFilters.group = groupEl ? groupEl.value : '';
  _studentFilters.day = dayEl ? dayEl.value : '';
  _studentFilters.feeType = feeEl ? feeEl.value : '';
  renderStudentList();
}

function applyStudentFilters(students) {
  var f = _studentFilters;
  return students.filter(function(st) {
    // Search by name
    if (f.search && st.name.toLowerCase().indexOf(f.search) === -1) return false;
    // Filter by group
    if (f.group === '__none__' && st.group) return false;
    if (f.group && f.group !== '__none__' && st.group !== f.group) return false;
    // Filter by day
    if (f.day !== '') {
      var dayNum = parseInt(f.day);
      var hasDay = false;
      if (st.schedules && st.schedules.length > 0) {
        st.schedules.forEach(function(sc) {
          if (sc.days && sc.days.indexOf(dayNum) !== -1) hasDay = true;
        });
      }
      if (!hasDay) return false;
    }
    // Filter by fee type
    if (f.feeType && st.feeType !== f.feeType) return false;
    return true;
  });
}

/* ===== RENDER ===== */
function renderStudents() {
  var root = document.getElementById('students-root');
  var countEl = document.getElementById('student-count');
  if (!root) return;

  var students = getAllStudents();
  var active = students.filter(function(s) { return !s.completed; });
  var completed = students.filter(function(s) { return s.completed; });

  if (countEl) countEl.textContent = active.length + ' đang học' + (completed.length > 0 ? ' · ' + completed.length + ' đã xong' : '');

  // Build toolbar + list container
  var html = buildStudentToolbar();
  html += '<div id="stu-list-container"></div>';
  root.innerHTML = html;

  // Restore filter values
  var searchEl = document.getElementById('stu-search');
  var groupEl = document.getElementById('stu-filter-group');
  var dayEl = document.getElementById('stu-filter-day');
  var feeEl = document.getElementById('stu-filter-fee');
  if (searchEl) searchEl.value = _studentFilters.search;
  if (groupEl) groupEl.value = _studentFilters.group;
  if (dayEl) dayEl.value = _studentFilters.day;
  if (feeEl) feeEl.value = _studentFilters.feeType;

  renderStudentList();
}

function renderStudentList() {
  var container = document.getElementById('stu-list-container');
  if (!container) return;

  var students = getAllStudents();
  var groups = (typeof getGroups === 'function') ? getGroups() : [];
  var active = students.filter(function(s) { return !s.completed; });
  var completed = students.filter(function(s) { return s.completed; });

  // Apply filters
  active = applyStudentFilters(active);
  completed = applyStudentFilters(completed);

  if (active.length === 0 && completed.length === 0) {
    container.innerHTML = '<p class="muted" style="margin-top:12px">Không tìm thấy học viên.</p>';
    return;
  }

  // Separate: grouped vs ungrouped
  var grouped = {}, ungrouped = [];
  active.forEach(function(st) {
    if (st.group) {
      if (!grouped[st.group]) grouped[st.group] = [];
      grouped[st.group].push(st);
    } else { ungrouped.push(st); }
  });

  var html = '';

  // Render grouped
  Object.keys(grouped).forEach(function(gName) {
    var members = grouped[gName];
    var g = groups.find(function(gr) { return gr.name === gName; });
    var gFee = g ? formatVND(g.fee || 0) + '/buổi' : '';
    html += '<div class="group-collapse-card">';
    html += '<div class="group-collapse-header" onclick="toggleGroupCollapse(this)">';
    html += '<span>👥 ' + gName + ' <span class="muted">(' + members.length + ' HV' + (gFee ? ' · ' + gFee : '') + ')</span></span>';
    html += '<span class="group-collapse-arrow">▸</span></div>';
    html += '<div class="group-collapse-body" style="display:none"><div class="stu-grid">';
    members.forEach(function(st) { html += buildStudentCard(st); });
    html += '</div></div></div>';
  });

  // Render ungrouped
  if (ungrouped.length > 0) {
    html += '<div class="stu-grid">';
    ungrouped.forEach(function(st) { html += buildStudentCard(st); });
    html += '</div>';
  }

  // Completed
  if (completed.length > 0) {
    html += '<div class="completed-section"><h4 class="completed-header" onclick="toggleCompleted()">✅ Đã hoàn thành (' + completed.length + ') <span id="completed-arrow">▸</span></h4><div id="completed-list" style="display:none">';
    completed.forEach(function(st) { html += buildStudentCard(st); });
    html += '</div></div>';
  }

  container.innerHTML = html;
}

function buildStudentCard(st) {
  var feeLabels = {'per-session':'Theo buổi','per-month':'Theo tháng','free-session':'Tự do/buổi','free-month':'Tự do/tháng'};
  var feeDisplay = st.fee > 0 ? formatVND(st.fee) + (st.feeType.includes('month') ? '/tháng' : '/buổi') : 'Chưa set';
  var hours = Math.floor(st.totalMinutes / 60);
  var mins = st.totalMinutes % 60;
  var key = encodeKey(st.name);

  return '<div class="stu-card' + (st.completed ? ' completed' : '') + '">' +
    '<div class="stu-info">' +
      '<h4><strong>' + st.name + '</strong></h4>' +
      '<p>' + (feeLabels[st.feeType]||'') + ' · ' + feeDisplay + '</p>' +
      '<p>📚 ' + st.doneSessions.length + '/' + st.sessions.length + ' buổi · ⏱️ ' + hours + 'h' + (mins > 0 ? mins + 'p' : '') + '</p>' +
      '<p>💵 Đã thu: ' + formatVND(st.earned) + (st.uncollected > 0 ? ' · <span style="color:var(--danger)">Nợ: ' + formatVND(st.uncollected) + '</span>' : '') + '</p>' +
      (st.schedules && st.schedules.length > 0 ? '<p class="stu-rate">🗓️ ' + formatSchedules(st) + '</p>' : '') +
      (st.note ? '<p style="font-size:.75rem;color:var(--text3)">📝 ' + st.note + '</p>' : '') +
    '</div>' +
    '<div class="stu-actions">' +
      '<label class="switch"><input type="checkbox" ' + (st.completed ? 'checked' : '') + ' onchange="toggleStudentDone(\'' + key + '\',this.checked)"><span class="slider"></span></label>' +
      '<button class="btn btn-ghost btn-sm" onclick="openEditStudent(\'' + key + '\')">✏️</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="showStudentDetail(\'' + key + '\')">👁️</button>' +
      '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteStudent(\'' + key + '\')">🗑️</button>' +
    '</div></div>';
}

function formatSchedules(st) {
  var dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
  var repeatLabels = {'weekly':'mỗi tuần','daily':'mỗi ngày','biweekly':'2 tuần/lần','monthly':'1 tháng/lần','none':''};
  var parts = [];
  if (st.schedules) {
    st.schedules.forEach(function(sc) {
      var days = (sc.days||[]).map(function(d) { return dayNames[d]; }).join(',');
      parts.push(sc.start + '-' + sc.end + (days ? ' (' + days + ')' : ''));
    });
  }
  if (st.repeat && repeatLabels[st.repeat]) parts.push(repeatLabels[st.repeat]);
  return parts.join(' · ');
}

function formatVND(n) {
  if (!n || n === 0) return '0đ';
  if (n >= 1000000) return (n/1000000).toFixed(1).replace('.0','') + 'tr';
  if (n >= 1000) return Math.round(n/1000) + 'k';
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

function toggleGroupCollapse(el) {
  var body = el.nextElementSibling;
  var arrow = el.querySelector('.group-collapse-arrow');
  if (!body) return;
  var show = body.style.display === 'none';
  body.style.display = show ? 'block' : 'none';
  if (arrow) arrow.textContent = show ? '▾' : '▸';
}

function toggleStudentDone(key, checked) {
  var name = decodeKey(key);
  var data = getStudentData();
  var found = data.find(function(s) { return s.name === name; });
  if (found) { found.completed = checked; }
  else { data.push({id:'manual-'+Date.now(), name:name, feeType:'free-session', fee:0, schedules:[], repeat:'weekly', note:'', completed:checked, group:''}); }
  saveStudentData(data);
  renderStudents();
}

/* ===== DELETE STUDENT ===== */
function deleteStudent(key) {
  var name = decodeKey(key);
  _pendingDeleteStudent = name;
  var modal = document.getElementById('student-delete-modal');
  var nameEl = document.getElementById('sdm-name');
  if (nameEl) nameEl.textContent = name;
  if (modal) modal.hidden = false;
}

function handleStudentDelete(mode) {
  if (!_pendingDeleteStudent) return;
  var name = _pendingDeleteStudent;
  var modal = document.getElementById('student-delete-modal');
  if (modal) modal.hidden = true;

  if (mode === 'cancel') { addDeletedStudent(name);
  _pendingDeleteStudent = null; return; }

  // Remove from local data
  var data = getStudentData();
  data = data.filter(function(s) { return s.name !== name; });
  saveStudentData(data);

  // mode=gcal: also delete GCal events
  if (mode === 'gcal') {
    if (typeof deleteEvent === 'function' && typeof isTokenValid === 'function' && isTokenValid()) {
      var sessions = (typeof getAllSessions === 'function') ? getAllSessions() : [];
      sessions = sessions.filter(function(s) { return s.student === name && s.source === 'gcal'; });
      var deleted = {};
      sessions.forEach(function(s) {
        var delId = s.recurringEventId || s.id;
        if (!deleted[delId]) { deleted[delId] = true; deleteEvent(delId).catch(function(){}); }
      });
      setTimeout(function() { if (typeof refreshAfterChange === 'function') refreshAfterChange(); }, 1200);
    } else {
      alert('Cần đăng nhập Google trước khi xóa trên Calendar.');
    }
  }

  // mode=hide: hide events locally
  if (mode === 'hide') {
    if (typeof hideEventLocally === 'function') {
      var sessions2 = (typeof getAllSessions === 'function') ? getAllSessions() : [];
      sessions2 = sessions2.filter(function(s) { return s.student === name; });
      sessions2.forEach(function(s) { hideEventLocally(s.id); });
    }
  }

  addDeletedStudent(name);
  _pendingDeleteStudent = null;
  renderStudents();
  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof updateStats === 'function') updateStats();
}

/* ===== MODAL ===== */
function openAddStudentModal() {
  document.getElementById('student-modal-title').textContent = 'Thêm học viên';
  document.getElementById('sf-id').value = '';
  document.getElementById('sf-name').value = '';
  document.getElementById('sf-name').disabled = false;
  document.getElementById('sf-fee-type').value = 'per-session';
  document.getElementById('sf-fee').value = '';
  document.getElementById('sf-note').value = '';
  document.getElementById('sf-repeat').value = 'weekly';
  document.getElementById('sf-schedules-list').innerHTML = '';
  addScheduleRow();
  populateGroupSelect('');
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

  var schedList = document.getElementById('sf-schedules-list');
  schedList.innerHTML = '';
  if (st.schedules && st.schedules.length > 0) {
    st.schedules.forEach(function(sc) { addScheduleRow(sc.start, sc.end, sc.days); });
  } else { addScheduleRow(); }

  populateGroupSelect(st.group || '');
  onFeeTypeChange();
  document.getElementById('modal-student').hidden = false;
}

function closeStudentModal() { document.getElementById('modal-student').hidden = true; }

function populateGroupSelect(currentGroup) {
  var select = document.getElementById('sf-group');
  if (!select) return;
  var groups = (typeof getGroups === 'function') ? getGroups() : [];
  var html = '<option value="">-- Không thuộc lớp nhóm --</option>';
  groups.forEach(function(g) {
    var sel = (g.name === currentGroup) ? ' selected' : '';
    html += '<option value="' + g.name + '"' + sel + '>' + g.name + '</option>';
  });
  select.innerHTML = html;
}

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

  row.innerHTML = '<div class="schedule-row-inner">' +
    '<div class="field-row"><div class="field"><label>Bắt đầu</label><input type="time" class="sc-start" value="' + (startVal||'19:00') + '"></div>' +
    '<div class="field"><label>Kết thúc</label><input type="time" class="sc-end" value="' + (endVal||'20:00') + '"></div></div>' +
    '<div class="sc-days">' + dayChecks + '</div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm sc-remove" onclick="this.closest(\'.schedule-row\').remove()">✕</button>';
  container.appendChild(row);
}

function onFeeTypeChange() {
  var type = document.getElementById('sf-fee-type').value;
  var schedSection = document.getElementById('sf-schedule-section');
  var feeLabel = document.getElementById('sf-fee-label');
  if (schedSection) schedSection.style.display = (type === 'per-session' || type === 'per-month') ? 'block' : 'none';
  if (feeLabel) feeLabel.textContent = type.includes('month') ? 'Học phí / tháng (VNĐ)' : 'Học phí / buổi (VNĐ)';
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
  var group = document.getElementById('sf-group').value;

  var schedules = [];
  document.querySelectorAll('.schedule-row').forEach(function(row) {
    var start = row.querySelector('.sc-start') ? row.querySelector('.sc-start').value : '';
    var end = row.querySelector('.sc-end') ? row.querySelector('.sc-end').value : '';
    var days = [];
    row.querySelectorAll('.sc-days input:checked').forEach(function(cb) { days.push(parseInt(cb.value)); });
    if (start && end) schedules.push({ start:start, end:end, days:days });
  });

  var data = getStudentData();
  if (editId) {
    var idx = data.findIndex(function(s) { return s.name === editId; });
    if (idx !== -1) {
      data[idx] = Object.assign(data[idx], { name:name, feeType:feeType, fee:fee, schedules:schedules, repeat:repeat, note:note, group:group });
    } else {
      data.push({id:'manual-'+Date.now(), name:name, feeType:feeType, fee:fee, schedules:schedules, repeat:repeat, note:note, completed:false, group:group});
    }
  } else {
    if (data.find(function(s) { return s.name === name; })) return alert('Học viên "'+name+'" đã tồn tại');
    data.push({id:'manual-'+Date.now(), name:name, feeType:feeType, fee:fee, schedules:schedules, repeat:repeat, note:note, completed:false, group:group});
  }

  // Also add to group if selected
  if (group && typeof getGroups === 'function' && typeof saveGroups === 'function') {
    var groups = getGroups();
    var g = groups.find(function(gr) { return gr.name === group; });
    if (g && g.members.indexOf(name) === -1) {
      g.members.push(name);
      saveGroups(groups);
    }
  }

  saveStudentData(data);
  closeStudentModal();

  // Ask to create on Google Calendar
  var addToGcal = document.getElementById('sf-add-gcal');
  if (addToGcal && addToGcal.checked && editId === '') {
    createStudentOnGCal(name, schedules, repeat);
  }

  renderStudents();
  if (typeof updateDashboard === 'function') updateDashboard();
  if (typeof updateStats === 'function') updateStats();
}

function createStudentOnGCal(name, schedules, repeat) {
  if (typeof createEvent !== 'function' || typeof isTokenValid !== 'function') {
    alert('Can dang nhap Google truoc khi tao su kien.');
    return;
  }
  if (typeof isTokenValid === 'function' && isTokenValid() === false) {
    alert('Can dang nhap Google truoc khi tao su kien.');
    return;
  }

  var rruleMap = {
    'weekly': 'RRULE:FREQ=WEEKLY',
    'daily': 'RRULE:FREQ=DAILY',
    'biweekly': 'RRULE:FREQ=WEEKLY;INTERVAL=2',
    'monthly': 'RRULE:FREQ=MONTHLY'
  };

  schedules.forEach(function(sc) {
    if (!sc.days || sc.days.length === 0) return;
    var dayMap = ['SU','MO','TU','WE','TH','FR','SA'];
    var byDay = sc.days.map(function(d) { return dayMap[d]; }).join(',');

    // Find next occurrence of first day
    var today = new Date();
    var targetDay = sc.days[0];
    var diff = (targetDay - today.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    var startDate = new Date(today);
    startDate.setDate(today.getDate() + diff);

    var dateStr = startDate.toISOString().split('T')[0];
    var startDT = dateStr + 'T' + sc.start + ':00';
    var endDT = dateStr + 'T' + sc.end + ':00';

    var recurrence = [];
    if (repeat && repeat !== 'none' && rruleMap[repeat]) {
      recurrence.push(rruleMap[repeat] + ';BYDAY=' + byDay);
    }

    var eventBody = {
      summary: name,
      start: { dateTime: startDT, timeZone: 'Asia/Ho_Chi_Minh' },
      end: { dateTime: endDT, timeZone: 'Asia/Ho_Chi_Minh' }
    };
    if (recurrence.length > 0) eventBody.recurrence = recurrence;

    createEvent(eventBody).then(function() {
      console.log('Created GCal event for: ' + name);
      if (typeof refreshAfterChange === 'function') refreshAfterChange();
    }).catch(function(e) { console.warn('Failed to create GCal event:', e); });
  });
}

/* ===== DETAIL PANEL ===== */
function showStudentDetail(key) {
  var name = decodeKey(key);
  var students = getAllStudents();
  var st = students.find(function(s) { return s.name === name; });
  if (!st) return;
  var feeLabels = {'per-session':'Theo buổi','per-month':'Theo tháng','free-session':'Tự do/buổi','free-month':'Tự do/tháng'};
  var hours = Math.floor(st.totalMinutes / 60);
  var upcoming = st.sessions.filter(function(s) { return s.status !== 'Done'; }).sort(function(a,b) { return new Date(a.date)-new Date(b.date); });
  var done = st.doneSessions.sort(function(a,b) { return new Date(b.date)-new Date(a.date); });

  var html = '<h3>' + st.name + '</h3>';
  html += '<div style="margin:12px 0;font-size:.82rem;display:flex;flex-direction:column;gap:4px">';
  html += '<span>📋 ' + (feeLabels[st.feeType]||'') + '</span>';
  html += '<span>💰 ' + (st.fee > 0 ? formatVND(st.fee) : 'Chưa set') + '</span>';
  html += '<span>📚 ' + st.doneSessions.length + '/' + st.sessions.length + ' buổi</span>';
  html += '<span>⏱️ ' + hours + 'h</span>';
  html += '<span>💵 Đã thu: ' + formatVND(st.earned) + '</span>';
  if (st.uncollected > 0) html += '<span style="color:var(--danger)">⚠️ Chưa thu: ' + formatVND(st.uncollected) + '</span>';
  if (st.group) html += '<span>👥 Nhóm: ' + st.group + '</span>';
  if (st.note) html += '<span>📝 ' + st.note + '</span>';
  if (st.schedules && st.schedules.length) html += '<span>🗓️ ' + formatSchedules(st) + '</span>';
  html += '</div>';

  if (upcoming.length > 0) {
    html += '<h4 style="margin:12px 0 6px;font-size:.82rem;color:var(--accent)">Sắp tới</h4>';
    upcoming.slice(0,8).forEach(function(s) {
      var d = new Date(s.date);
      html += '<div class="s-item"><div class="s-item-info"><strong>' + s.name + '</strong><span>' + d.toLocaleDateString('vi-VN',{weekday:'short',day:'numeric',month:'numeric'}) + ' ' + d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) + '</span></div></div>';
    });
  }
  if (done.length > 0) {
    html += '<h4 style="margin:12px 0 6px;font-size:.82rem;color:var(--text3)">Lịch sử</h4>';
    done.slice(0,10).forEach(function(s) {
      var d = new Date(s.date);
      html += '<div class="s-item" style="opacity:0.6;border-left-color:var(--success)"><div class="s-item-info"><strong>' + s.name + '</strong><span>' + d.toLocaleDateString('vi-VN',{day:'numeric',month:'numeric'}) + ' · ' + formatVND(s.fee||0) + '</span></div></div>';
    });
  }

  document.getElementById('rp-body').innerHTML = html;
  if (typeof openRightPanel === 'function') openRightPanel();
}

function getActiveStudentNames() {
  var students = getAllStudents();
  return students.filter(function(s) { return !s.completed; }).map(function(s) { return s.name; });
}
