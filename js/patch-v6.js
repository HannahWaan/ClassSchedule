/* ============================================================
   PATCH-V6.JS — ClassSchedule
   NẠP SAU js/patch-v5.js
   Lịch = nguồn BUỔI HỌC. Danh sách HỌC VIÊN do bạn quyết định.
   - Tên chỉ có buổi học cũ (quá N ngày) và chưa đăng ký -> bỏ qua
   - Tên mới xuất hiện -> vào khu "Đề xuất từ Calendar" để bạn chọn
   - Có danh sách "đã bỏ qua" để phục hồi khi cần
   - Công cụ dọn học viên không còn dạy
   ============================================================ */

var CS_RECENT_DAYS_DEFAULT = 60;

function csRecentDays() {
  var v = parseInt(localStorage.getItem('cs-recent-days') || '', 10);
  return (v > 0 && v < 4000) ? v : CS_RECENT_DAYS_DEFAULT;
}
function csSetRecentDays(v) {
  v = parseInt(v, 10);
  if (!(v > 0)) return;
  localStorage.setItem('cs-recent-days', String(v));
  StatsCore.invalidate();
  loadAllExternalData(true);
}
function csRecentCutoff() { return Date.now() - csRecentDays() * 86400000; }

/* ---------- Danh sách tên đã bỏ qua ---------- */
function csIgnored() {
  try { return (JSON.parse(localStorage.getItem('cs-ignored-students') || '[]') || []).map(csKey); }
  catch (e) { return []; }
}
function csSaveIgnored(a) {
  localStorage.setItem('cs-ignored-students', JSON.stringify(a));
  StatsCore.invalidate();
}
function csIsIgnored(n) { return csIgnored().indexOf(csKey(n)) !== -1; }
function csIgnore(n) {
  var a = csIgnored(), k = csKey(n);
  if (a.indexOf(k) === -1) a.push(k);
  csSaveIgnored(a);
}
function csUnignore(n) {
  csSaveIgnored(csIgnored().filter(function (k) { return k !== csKey(n); }));
}

/* Tên đã đăng ký (thêm tay) */
function csRegisteredKeys() {
  var out = {};
  Object.keys(csRegistry()).forEach(function (k) { out[k] = 1; });
  return out;
}

/* ---------- Lọc buổi học: đây là chỗ chặn lớp cũ ---------- */
var _csAllSessions5 = window.getAllSessions;
window.getAllSessions = function () {
  var all = _csAllSessions5();
  var reg = csRegisteredKeys();
  var ign = {}; csIgnored().forEach(function (k) { ign[k] = 1; });
  var cut = csRecentCutoff();
  return all.filter(function (s) {
    var k = s.studentKey;
    if (ign[k]) return false;              // đã bỏ qua -> loại hẳn
    if (reg[k]) return true;               // đã đăng ký -> giữ toàn bộ lịch sử
    var t = new Date(s.date).getTime();    // chưa đăng ký -> chỉ giữ nếu gần đây
    return !isNaN(t) && t >= cut;
  });
};

/* ---------- Khu "Đề xuất từ Calendar" ---------- */
function csCandidates() {
  var reg = csRegisteredKeys();
  var ign = {}; csIgnored().forEach(function (k) { ign[k] = 1; });
  var cut = csRecentCutoff(), map = {};
  (_eventsCache || []).forEach(function (ev) {
    var k = ev.studentKey || csKey(ev.student);
    if (!k || reg[k] || ign[k]) return;
    var t = new Date(ev.date).getTime();
    if (isNaN(t) || t < cut) return;
    if (!map[k]) map[k] = { key: k, name: ev.student, count: 0, last: 0 };
    map[k].count++;
    if (t > map[k].last) map[k].last = t;
  });
  return Object.keys(map).map(function (k) { return map[k]; })
    .sort(function (a, b) { return b.last - a.last; });
}

function csRenderInbox() {
  var page = document.getElementById('page-students');
  if (!page) return;
  var box = document.getElementById('cs-inbox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'cs-inbox';
    box.className = 'card';
    box.style.marginBottom = '14px';
    var root = document.getElementById('students-root');
    page.insertBefore(box, root || null);
  }
  var list = csCandidates();
  if (!list.length) { box.style.display = 'none'; return; }
  box.style.display = '';
  box.innerHTML =
    '<div class="card-header"><h3>🆕 Đề xuất từ Calendar (' + list.length + ')</h3>' +
      '<span class="muted" style="font-size:.78rem">Tên có buổi trong ' + csRecentDays() + ' ngày qua, chưa nằm trong danh sách</span></div>' +
    '<div class="card-body">' + list.map(function (c) {
      var d = new Date(c.last).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
      var k = encodeKey(c.name);
      return '<div class="s-item" style="align-items:center">' +
        '<div class="s-item-info" style="min-width:0">' +
          '<strong>' + csEsc(c.name) + '</strong>' +
          '<span>' + c.count + ' buổi · gần nhất ' + d + '</span></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0">' +
          '<button class="btn btn-primary btn-sm" onclick="csInboxAdd(\'' + k + '\')">➕ Thêm</button>' +
          '<button class="btn btn-outline btn-sm" onclick="csInboxMerge(\'' + k + '\')">🔗 Gộp</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="csInboxIgnore(\'' + k + '\')">🚫 Bỏ qua</button>' +
        '</div></div>';
    }).join('') + '</div>';
}

function csInboxAdd(enc) {
  var name = csNormalizeName(decodeKey(enc));
  var data = getStudentData();
  if (!data.find(function (s) { return csKey(s.name) === csKey(name); })) {
    data.push({ id: 'manual-' + Date.now(), name: name, feeType: 'free-session', fee: 0,
      schedules: [], repeat: 'weekly', note: '', completed: false, group: '', aliases: [] });
    saveStudentData(data);
  }
  StatsCore.invalidate();
  renderStudents(); updateDashboard(); updateStats();
  if (typeof openEditStudent === 'function') openEditStudent(enc);   // mở luôn để set học phí
}

function csInboxIgnore(enc) {
  var name = decodeKey(enc);
  if (!confirm('Bỏ qua "' + name + '"?\n\nTên này sẽ không hiện trong app và không tính vào thống kê.\nSự kiện trên Google Calendar KHÔNG bị xóa.')) return;
  csIgnore(name);
  renderStudents(); updateDashboard(); updateStats();
}

function csInboxMerge(enc) {
  var name = csNormalizeName(decodeKey(enc));
  var list = getAllStudents().filter(function (s) { return csKey(s.name) !== csKey(name); });
  if (!list.length) return alert('Chưa có học viên nào để gộp vào.');
  var msg = 'Gộp "' + name + '" vào học viên nào?\n\n' +
    list.map(function (s, i) { return (i + 1) + '. ' + s.name; }).join('\n') + '\n\nNhập số:';
  var pick = prompt(msg);
  var i = parseInt(pick, 10) - 1;
  if (!(i >= 0 && i < list.length)) return;
  var target = list[i];
  var data = getStudentData();
  var row = data.find(function (s) { return csKey(s.name) === csKey(target.name); });
  if (!row) return alert('Học viên đích chưa được lưu, hãy sửa và Lưu học viên đó trước.');
  var al = row.aliases || [];
  if (typeof al === 'string') al = al.split(/[;,]/);
  al = al.map(csNormalizeName).filter(Boolean);
  if (al.indexOf(name) === -1) al.push(name);
  row.aliases = al;
  saveStudentData(data);
  StatsCore.invalidate();
  renderStudents(); updateDashboard(); updateStats();
  alert('Đã gộp "' + name + '" vào "' + target.name + '".');
}

/* ---------- Vẽ lại inbox mỗi lần render danh sách ---------- */
var _csRenderStudents6 = window.renderStudents;
window.renderStudents = function () {
  var r = _csRenderStudents6.apply(this, arguments);
  try { csRenderInbox(); } catch (e) { console.warn(e); }
  return r;
};

/* ---------- Xóa học viên: bỏ qua luôn để không mọc lại ---------- */
var _csDelete5 = window.handleStudentDelete;
window.handleStudentDelete = function (mode) {
  var name = _pendingDeleteStudent;
  var r = _csDelete5.apply(this, arguments);
  if (name && mode !== 'cancel') { csIgnore(name); renderStudents(); updateStats(); }
  return r;
};

/* ---------- Công cụ: dọn học viên không còn dạy ---------- */
function csCleanupOld() {
  var ss = StatsCore.idx().studentSessions, cut = csRecentCutoff();
  var stale = getAllStudents().filter(function (st) {
    if (st.completed) return false;
    var arr = ss[st.key] || [];
    var last = 0;
    arr.forEach(function (s) { if (s._ts > last) last = s._ts; });
    return last < cut;
  });
  if (!stale.length) return alert('Không có học viên nào vắng buổi quá ' + csRecentDays() + ' ngày. 👍');
  if (!confirm(stale.length + ' học viên không có buổi nào trong ' + csRecentDays() + ' ngày qua:\n\n' +
    stale.map(function (s) { return '· ' + s.name; }).join('\n') +
    '\n\nĐánh dấu "Đã xong" cho tất cả?\n(Dữ liệu và thống kê cũ vẫn được giữ.)')) return;
  var data = getStudentData();
  stale.forEach(function (st) {
    var row = data.find(function (s) { return csKey(s.name) === st.key; });
    if (row) row.completed = true;
    else data.push({ id: 'manual-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: st.name, feeType: st.feeType || 'free-session', fee: st.fee || 0, schedules: [],
      repeat: 'weekly', note: '', completed: true, group: st.group || '', aliases: st.aliases || [] });
  });
  saveStudentData(data);
  StatsCore.invalidate();
  renderStudents(); updateDashboard(); updateStats();
}

/* ---------- Cài đặt ở tab Hồ sơ ---------- */
function csRenderIgnoredList() {
  var el = document.getElementById('cs-ignored-list');
  if (!el) return;
  var a = csIgnored();
  if (!a.length) { el.innerHTML = '<span class="muted">Chưa bỏ qua tên nào.</span>'; return; }
  el.innerHTML = a.map(function (k) {
    return '<span class="tag-chip">' + csEsc(k) +
      ' <button type="button" onclick="csRestoreIgnored(\'' + encodeKey(k) + '\')">↩</button></span>';
  }).join('');
}
function csRestoreIgnored(enc) {
  csUnignore(decodeKey(enc));
  csRenderIgnoredList();
  renderStudents(); updateDashboard(); updateStats();
}

function csInjectSourceUI() {
  var page = document.getElementById('page-profile');
  if (!page || document.getElementById('cs-source-card')) return;
  var card = document.createElement('div');
  card.className = 'profile-card';
  card.id = 'cs-source-card';
  card.innerHTML =
    '<div class="settings-group-title">📅 Nguồn dữ liệu từ Calendar</div>' +
    '<p class="danger-desc">Buổi học vẫn lấy 24 tháng để thống kê. Nhưng một tên <b>chưa có trong danh sách</b> ' +
      'chỉ được coi là học viên nếu có buổi trong khoảng ngày dưới đây — nhờ vậy lớp cũ nhiều năm trước không bị lôi vào.</p>' +
    '<div class="field" style="max-width:260px"><label>Coi là "đang dạy" nếu có buổi trong (ngày)</label>' +
      '<input type="number" id="cs-recent-days" min="7" max="3650" value="' + csRecentDays() + '">' +
      '<button class="btn btn-outline btn-sm" style="margin-top:6px" ' +
        'onclick="csSetRecentDays(document.getElementById(\'cs-recent-days\').value)">Lưu</button></div>' +
    '<div style="margin-top:10px"><button class="btn btn-outline" onclick="csCleanupOld()">🧹 Dọn học viên không còn dạy</button></div>' +
    '<div class="settings-group-title" style="margin-top:16px">🚫 Tên đã bỏ qua</div>' +
    '<div id="cs-ignored-list" style="display:flex;gap:6px;flex-wrap:wrap"></div>';
  var backup = document.getElementById('cs-backup-card');
  page.insertBefore(card, backup || page.querySelector('.danger-section') || null);
  csRenderIgnoredList();
}

var _csSwitchTab = window.switchTab;
window.switchTab = function (tab) {
  var r = _csSwitchTab.apply(this, arguments);
  if (tab === 'profile') { csInjectSourceUI(); csRenderIgnoredList(); if (typeof csBackupInfo === 'function') csBackupInfo(); }
  if (tab === 'students') { try { csRenderInbox(); } catch (e) {} }
  return r;
};

function csV6Init() {
  csInjectSourceUI();
  StatsCore.invalidate();
  try { csRenderInbox(); } catch (e) {}
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', csV6Init);
else csV6Init();
console.log('✅ patch-v6 loaded · cửa sổ đang dạy: ' + csRecentDays() + ' ngày');
