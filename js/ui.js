function switchTab(tab) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  var page = document.getElementById('page-' + tab);
  if (page) page.classList.add('active');
  document.querySelectorAll('.menu-item').forEach(function(m) { m.classList.remove('active'); });
  var link = document.querySelector('.menu-item[data-tab="' + tab + '"]');
  if (link) link.classList.add('active');
  var titles = { welcome: 'Chào mừng', schedule: 'Lịch dạy', stats: 'Thống kê', students: 'Học viên', groups: 'Nhóm', profile: 'Hồ sơ' };
  var titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[tab] || '';
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');
  if (tab === 'stats' && typeof updateStats === 'function') updateStats();
  if (tab === 'welcome' && typeof renderWelcome === 'function') renderWelcome();
  if (tab === 'students' && typeof renderStudents === 'function') renderStudents();
  if (tab === 'groups' && typeof renderGroups === 'function') renderGroups();
}
function syncUI(t) { var el = document.getElementById('sync-status'); if (el) el.textContent = t; }
function openGroupModal() { if (typeof populateGroupTagInput === 'function') populateGroupTagInput(); document.getElementById('modal-group').hidden = false; }
function closeGroupModal() { document.getElementById('modal-group').hidden = true; }
function openRightPanel() { var rp = document.getElementById('right-panel'); if (rp) rp.classList.remove('hidden'); }
function closeRightPanel() { var rp = document.getElementById('right-panel'); if (rp) rp.classList.add('hidden'); }
function formatMoney(n) { return Math.round(n / 1000) + 'k'; }
function fmtDate(d) { return new Date(d).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' }); }
function durationLabel(mins) { var h = Math.floor(mins / 60); var m = mins % 60; return h + 'h' + (m > 0 ? m + 'p' : ''); }
function timeDiffMinutes(start, end) { if (!start || !end) return 0; var a = start.split(':'), b = end.split(':'); return (parseInt(b[0]) * 60 + parseInt(b[1])) - (parseInt(a[0]) * 60 + parseInt(a[1])); }
