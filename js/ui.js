function switchTab(tab) {
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('page-' + tab).classList.add('active');
    document.querySelectorAll('.menu-item').forEach(function(m) { m.classList.remove('active'); });
    var link = document.querySelector('.menu-item[data-tab="' + tab + '"]');
    if (link) link.classList.add('active');
    var titles = { welcome: 'Chào mừng', schedule: 'Lịch dạy', 'add-session': 'Thêm buổi', stats: 'Thống kê', students: 'Học viên', profile: 'Hồ sơ' };
    document.getElementById('header-title').textContent = titles[tab] || '';
    document.getElementById('sidebar').classList.remove('open');
    if (tab === 'schedule') renderCalendar();
    if (tab === 'stats') renderStats('week');
    if (tab === 'welcome') renderWelcome();
    if (tab === 'students') renderStudents();
    if (tab === 'add-session') populateDropdown();
}

function syncUI(t) { document.getElementById('sync-status').textContent = t; }
function openModal() { document.getElementById('modal').hidden = false; }
function closeModal() { document.getElementById('modal').hidden = true; }
function confirmNuke() { document.getElementById('modal-nuke').hidden = false; }
function closeNuke() { document.getElementById('modal-nuke').hidden = true; }

function formatMoney(n) { return Number(n).toLocaleString('vi-VN') + 'đ'; }
function fmtISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fmtDate(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function timeDiff(s, e) { var a = s.split(':'), b = e.split(':'); return (parseInt(b[0]) * 60 + parseInt(b[1]) - parseInt(a[0]) * 60 - parseInt(a[1])) / 60; }
function getWeekStart(d) { var r = new Date(d); var day = r.getDay(); r.setDate(r.getDate() - day + (day === 0 ? -6 : 1)); r.setHours(0, 0, 0, 0); return r; }
function isSameDay(a, b) { return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear(); }
