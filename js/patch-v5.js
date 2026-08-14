/* ============================================================
   PATCH-V5.JS — ClassSchedule
   NẠP SAU js/patch-v4.js
   (1) Thu hẹp quyền Google Calendar
   (2) Sao lưu / phục hồi dữ liệu (JSON) + nhắc sao lưu
   (3) Escape HTML ở lớp nhóm (tên có dấu ' không làm vỡ nút)
   (4) Không đếm 2 lần học phí khi HV thuộc lớp nhóm có phí
   (5) Bỏ đoán học phí sai từ mô tả, bỏ sự kiện cả ngày
   (6) Tự làm mới thông minh: không phá lúc đang gõ / đang mở modal
   (7) Xử lý token hết hạn (401) + báo rõ trạng thái đồng bộ
   ============================================================ */

/* ---------- 1. Quyền Google: chỉ cần sự kiện, không cần toàn bộ lịch ---------- */
try { GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar.events'; } catch (e) {}
window._pendingDeleteStudent = window._pendingDeleteStudent || null;

var esc = window.csEsc || function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

/* ---------- 2. Học phí: HV có phí riêng thì dùng phí riêng, nếu không thì lấy phí nhóm ---------- */
var _csRegBase = window.csRegistry;
window.csRegistry = function () {
  var reg = _csRegBase();
  var groups = (typeof getGroups === 'function') ? getGroups() : [];
  var byMember = {};
  groups.forEach(function (g) {
    (g.members || []).forEach(function (m) {
      var k = csKey(m); if (!byMember[k]) byMember[k] = g;
    });
  });
  Object.keys(reg).forEach(function (k) {
    var st = reg[k];
    var g = byMember[st.key] || byMember[k];
    if (g && g.fee > 0 && !(st.fee > 0)) {
      st.fee = g.fee; st.feeType = 'per-session'; st._feeFromGroup = g.name;
    }
    if (g && !st.group) st.group = g.name;
  });
  return reg;
};

/* ---------- 3. Lớp nhóm: doanh thu lấy từ StatsCore (không cộng trùng) + escape ---------- */
window.renderGroups = function () {
  var root = document.getElementById('groups-root');
  if (!root) return;
  var groups = getGroups();
  if (!groups.length) {
    root.innerHTML = '<p class="muted">Chưa có lớp nhóm. Bấm "Tạo lớp nhóm" để bắt đầu.</p>';
    return;
  }
  var ss = StatsCore.idx().studentSessions;
  root.innerHTML = groups.map(function (g, i) {
    var seen = {}, done = 0, total = 0, earned = 0, mins = 0;
    (g.members || []).forEach(function (m) {
      (ss[csKey(m)] || []).forEach(function (s) {
        if (seen[s.id]) return;            // 1 buổi chỉ tính 1 lần
        seen[s.id] = 1; total++;
        if (s._done) { done++; earned += s._amount || 0; mins += s.duration || 0; }
      });
    });
    return '<div class="group-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">' +
        '<div style="min-width:0">' +
          '<h4>' + esc(g.name) + '</h4>' +
          (g.program ? '<p>📖 ' + esc(g.program) + '</p>' : '') +
          '<p>💰 ' + csVND(g.fee || 0) + '/buổi</p>' +
          '<p>📚 ' + done + '/' + total + ' buổi · ⏱️ ' + Math.floor(mins / 60) + 'h · 💵 ' + csVND(earned) + '</p>' +
          '<div class="group-members">' + (g.members || []).map(function (m) {
            return '<span class="group-member-tag">' + esc(m) + '</span>';
          }).join('') + '</div>' +
          (g.note ? '<p style="font-size:.78rem;color:var(--text3);margin-top:6px">📝 ' + esc(g.note) + '</p>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-shrink:0">' +
          '<button class="btn btn-ghost btn-sm" onclick="openEditGroup(' + i + ')">✏️</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteGroup(' + i + ')">🗑️</button>' +
        '</div>' +
      '</div></div>';
  }).join('');
};

window.renderGroupChips = function () {
  var chips = document.getElementById('gf-chips');
  if (!chips) return;
  chips.innerHTML = (window._groupMembers || []).map(function (n) {
    return '<span class="tag-chip">' + esc(n) +
      ' <button type="button" onclick="removeGroupMember(\'' + encodeKey(n) + '\')">✕</button></span>';
  }).join('');
};

window.setupGroupTagInput = function () {
  var search = document.getElementById('gf-search');
  var dd = document.getElementById('gf-dropdown');
  if (!search || !dd) return;
  search.oninput = function () {
    var names = (typeof getActiveStudentNames === 'function') ? getActiveStudentNames() : [];
    var q = csKey(this.value);
    var f = names.filter(function (n) {
      return csKey(n).indexOf(q) !== -1 && (window._groupMembers || []).indexOf(n) === -1;
    });
    dd.innerHTML = f.map(function (n) {
      return '<div class="tag-option" onclick="addGroupMember(\'' + encodeKey(n) + '\')">' + esc(n) + '</div>';
    }).join('');
    dd.style.display = f.length ? 'block' : 'none';
  };
};

/* ---------- 4. Đọc Calendar: bỏ sự kiện cả ngày, bỏ đoán học phí bừa, xử lý 401 ---------- */
var _csParse4 = window.parseGCalEvent;
window.parseGCalEvent = function (ev) {
  var s = _csParse4(ev);
  s.allDay = !!(ev.start && !ev.start.dateTime && ev.start.date);
  var note = ev.description || '', fee = 0;
  var m = note.match(/(?:fee|học\s*phí|hoc\s*phi|hocphi)\s*[:=]\s*([\d.,]+)\s*(k|nghìn|nghin|ngàn|ngan)?/i);
  if (m) {
    fee = parseInt(String(m[1]).replace(/[.,]/g, ''), 10) || 0;
    if (m[2] || fee < 1000) fee *= 1000;
  }
  s.fee = fee;   // chỉ nhận khi ghi rõ "fee:" / "học phí:"
  return s;
};

var _csLastSyncOK = 0;
function csSyncBadge(ok) {
  if (typeof syncUI !== 'function') return;
  if (ok) {
    _csLastSyncOK = Date.now();
    syncUI('✅ Đồng bộ ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
  } else {
    syncUI(_csLastSyncOK
      ? '⚠️ Mất kết nối · dữ liệu lúc ' + new Date(_csLastSyncOK).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : '⚠️ Chưa đăng nhập Google');
  }
}

window.fetchGCalEvents = async function (force) {
  if (!force && _eventsCache.length && Date.now() - _eventsCacheTime < CACHE_TTL) return _eventsCache;
  if (typeof gcalFetch !== 'function') return _eventsCache;
  if (!isTokenValid() && !localStorage.getItem('gcal_token')) { csSyncBadge(false); return _eventsCache; }

  var now = new Date();
  var months = (typeof CS_HISTORY_MONTHS !== 'undefined') ? CS_HISTORY_MONTHS : 24;
  var min = new Date(now.getFullYear(), now.getMonth() - months, 1).toISOString();
  var max = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString();
  var calId = (typeof GCAL_CAL_ID !== 'undefined') ? GCAL_CAL_ID : 'asstrayca@gmail.com';
  var items = [], token = null, guard = 0, ok = false;

  try {
    do {
      var p = new URLSearchParams({
        timeMin: min, timeMax: max, singleEvents: 'true', orderBy: 'startTime',
        timeZone: 'Asia/Ho_Chi_Minh', maxResults: '2500'
      });
      if (token) p.set('pageToken', token);
      var res = await gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(calId) +
        '/events?' + p.toString(), { method: 'GET' });   // gcalFetch tự xin lại token nếu 401
      if (!res.ok) { console.warn('GCal HTTP ' + res.status); break; }
      var data = await res.json();
      if (data.error) { console.warn('GCal:', data.error.message); break; }
      items = items.concat(data.items || []);
      token = data.nextPageToken || null;
      ok = true; guard++;
    } while (token && guard < 12);
  } catch (e) { console.warn('Fetch error:', e); }

  if (ok) {
    _eventsCache = items.map(parseGCalEvent).filter(function (s) {
      return s.date && s.student && !s.allDay;
    });
    _eventsCacheTime = Date.now();
    StatsCore.invalidate();
    csSyncBadge(true);
    console.log('Đã tải ' + _eventsCache.length + ' buổi');
  } else { csSyncBadge(false); }
  return _eventsCache;
};

/* ---------- 5. Tự làm mới thông minh ---------- */
function csBusy() {
  if (document.hidden) return true;
  var open = document.querySelector('.modal-backdrop:not([hidden])');
  if (open) return true;
  var a = document.activeElement;
  return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

window.loadAllExternalData = async function (force) {
  if (force !== true && csBusy()) return;      // interval 2 phút sẽ bị chặn khi đang gõ
  try {
    await fetchGCalEvents(force === true);
    StatsCore.invalidate();
    updateDashboard(); updateStats(); renderStudents(); renderGroups();
  } catch (e) { console.warn(e); csSyncBadge(false); }
};

document.addEventListener('visibilitychange', function () {
  if (!document.hidden && Date.now() - _eventsCacheTime > 120000) loadAllExternalData(true);
});

/* Giữ nội dung ô tìm kiếm + vị trí cuộn khi vẽ lại danh sách */
var _csRenderStudents = window.renderStudents;
if (typeof _csRenderStudents === 'function') {
  window.renderStudents = function () {
    var box = document.getElementById('stu-search');
    var val = box ? box.value : null;
    var wasFocus = box && document.activeElement === box;
    var pos = box ? box.selectionStart : 0;
    var wrap = document.querySelector('.content-wrap');
    var top = wrap ? wrap.scrollTop : 0;
    var r = _csRenderStudents.apply(this, arguments);
    var nb = document.getElementById('stu-search');
    if (nb && val !== null) {
      nb.value = val;
      if (wasFocus) { nb.focus(); try { nb.setSelectionRange(pos, pos); } catch (e) {} }
    }
    if (wrap) wrap.scrollTop = top;
    return r;
  };
}

/* Gõ tìm kiếm: chờ 250ms mới lọc, đỡ giật */
var _csFilter = window.onStudentFilterChange, _csT = null;
if (typeof _csFilter === 'function') {
  window.onStudentFilterChange = function () {
    var self = this, args = arguments;
    clearTimeout(_csT);
    _csT = setTimeout(function () { _csFilter.apply(self, args); }, 250);
  };
}

/* ---------- 6. SAO LƯU / PHỤC HỒI ---------- */
function csBackupKeys() {
  var out = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && k.indexOf('cs-') === 0 && k !== 'cs-last-export') out.push(k);
  }
  return out;
}

function csExportData() {
  var data = {};
  csBackupKeys().forEach(function (k) { data[k] = localStorage.getItem(k); });
  var payload = {
    app: 'ClassSchedule', version: 1,
    exportedAt: new Date().toISOString(),
    students: (function () { try { return JSON.parse(data['cs-students-v2'] || '[]').length; } catch (e) { return 0; } })(),
    data: data
  };
  var d = new Date();
  var name = 'classschedule-backup-' + d.getFullYear() + '-' +
    csP2(d.getMonth() + 1) + '-' + csP2(d.getDate()) + '.json';
  var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  localStorage.setItem('cs-last-export', String(Date.now()));
  csBackupInfo();
}

function csImportData(file) {
  var fr = new FileReader();
  fr.onload = function () {
    var obj;
    try { obj = JSON.parse(fr.result); } catch (e) { return alert('File không đọc được.'); }
    if (!obj || !obj.data || typeof obj.data !== 'object') return alert('File sao lưu không hợp lệ.');
    var n = Object.keys(obj.data).length;
    if (!confirm('Phục hồi ' + n + ' mục dữ liệu từ bản sao lưu ngày ' +
      (obj.exportedAt ? new Date(obj.exportedAt).toLocaleString('vi-VN') : '?') +
      '?\n\nDữ liệu hiện tại trên máy này sẽ bị GHI ĐÈ.')) return;
    csBackupKeys().forEach(function (k) { localStorage.removeItem(k); });
    Object.keys(obj.data).forEach(function (k) {
      if (k.indexOf('cs-') === 0) localStorage.setItem(k, obj.data[k]);
    });
    alert('Đã phục hồi. App sẽ tải lại.');
    location.reload();
  };
  fr.readAsText(file);
}

function csBackupInfo() {
  var el = document.getElementById('cs-backup-info');
  if (!el) return;
  var t = parseInt(localStorage.getItem('cs-last-export') || '0', 10);
  var nStu = 0, nGrp = 0;
  try { nStu = JSON.parse(localStorage.getItem('cs-students-v2') || '[]').length; } catch (e) {}
  try { nGrp = JSON.parse(localStorage.getItem('cs-groups-v2') || '[]').length; } catch (e) {}
  var base = nStu + ' học viên · ' + nGrp + ' lớp nhóm đang lưu trên máy này. ';
  if (!t) {
    el.innerHTML = base + '<b style="color:var(--danger)">Chưa từng sao lưu.</b>';
  } else {
    var days = Math.floor((Date.now() - t) / 86400000);
    el.innerHTML = base + 'Sao lưu gần nhất: ' + new Date(t).toLocaleDateString('vi-VN') +
      (days > 14 ? ' <b style="color:var(--danger)">(' + days + ' ngày trước — nên sao lưu lại)</b>'
                 : ' (' + days + ' ngày trước)');
  }
}

function csRelogin() {
  if (!confirm('Đăng nhập lại Google để cấp quyền mới (hẹp hơn)?')) return;
  localStorage.removeItem('gcal_token');
  localStorage.removeItem('gcal_token_expiry');
  try { accessToken = null; tokenExpiry = 0; tokenClient = null; } catch (e) {}
  if (typeof handleGCalAuth === 'function') handleGCalAuth();
}

function csInjectBackupUI() {
  var page = document.getElementById('page-profile');
  if (!page || document.getElementById('cs-backup-card')) return;
  var card = document.createElement('div');
  card.className = 'profile-card';
  card.id = 'cs-backup-card';
  card.innerHTML =
    '<div class="settings-group-title">💾 Sao lưu dữ liệu</div>' +
    '<p class="danger-desc" id="cs-backup-info"></p>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-primary" onclick="csExportData()">⬇️ Xuất file sao lưu</button>' +
      '<button class="btn btn-outline" onclick="document.getElementById(\'cs-import-file\').click()">⬆️ Phục hồi từ file</button>' +
      '<button class="btn btn-ghost" onclick="csRelogin()">🔑 Đăng nhập lại Google</button>' +
      '<input type="file" id="cs-import-file" accept="application/json,.json" style="display:none" ' +
        'onchange="if(this.files[0])csImportData(this.files[0]);this.value=\'\'">' +
    '</div>' +
    '<p class="danger-desc" style="margin-top:8px">Dữ liệu học viên hiện chỉ nằm trên trình duyệt/máy này. ' +
    'Nên xuất file mỗi tháng và lưu vào Google Drive.</p>';
  var danger = page.querySelector('.danger-section');
  page.insertBefore(card, danger || null);
  csBackupInfo();
}

/* ---------- 7. Khởi động ---------- */
function csV5Init() {
  csInjectBackupUI();
  StatsCore.invalidate();
  if (typeof renderGroups === 'function') { try { renderGroups(); } catch (e) {} }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', csV5Init);
else csV5Init();
console.log('✅ patch-v5 loaded');
