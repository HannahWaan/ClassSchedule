function renderWelcome() {
    var now = new Date();
    document.getElementById('w-students').textContent = Store.students.length;
    var ws = getWeekStart(now);
    var we = new Date(ws); we.setDate(we.getDate() + 7);
    var wk = Store.sessions.filter(function(s) { var d = new Date(s.date); return d >= ws && d < we; });
    document.getElementById('w-week').textContent = wk.length;
    document.getElementById('w-salary').textContent = formatMoney(Store.sessions.reduce(function(a, s) { return a + (Number(s.fee) || 0); }, 0));
    var mo = Store.sessions.filter(function(s) { var d = new Date(s.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    var hrs = 0;
    mo.forEach(function(s) { if (s.start_time && s.end_time) hrs += timeDiff(s.start_time, s.end_time); });
    document.getElementById('w-hours').textContent = hrs.toFixed(1) + 'h';

    var up = Store.sessions.filter(function(s) { return new Date(s.date + 'T' + s.start_time) >= new Date(now.getTime() - 86400000); })
        .sort(function(a, b) { return (a.date + a.start_time).localeCompare(b.date + b.start_time); }).slice(0, 5);
    var el = document.getElementById('upcoming-list');
    if (!up.length) el.innerHTML = '<p class="muted">Chưa có buổi dạy nào.</p>';
    else el.innerHTML = up.map(function(s) {
        return '<div class="s-item"><div class="s-item-info"><strong>' + s.lesson + '</strong><span>' + (s.student_name || '') + ' · ' + fmtDate(s.date) + ' · ' + s.start_time.slice(0, 5) + '–' + s.end_time.slice(0, 5) + '</span></div></div>';
    }).join('');
    document.getElementById('welcome-name').textContent = Store.profile.full_name || 'Giáo viên';
}

document.addEventListener('DOMContentLoaded', async function() {
    syncUI('🔄 Loading...');
    await Store.load();
    setTheme(Store.profile.theme || 'dark');
    setFont(Store.profile.font || "'Be Vietnam Pro',sans-serif");
    document.getElementById('p-font').value = Store.profile.font || "'Be Vietnam Pro',sans-serif";
    document.getElementById('p-name').value = Store.profile.full_name || '';
    document.getElementById('f-date').valueAsDate = new Date();
    renderWelcome();
    renderStudents();
    populateDropdown();
    renderCalendar();
    syncUI('✅ Synced');

    // Navigation
    document.querySelectorAll('.menu-item').forEach(function(m) {
        m.addEventListener('click', function(e) { e.preventDefault(); switchTab(m.dataset.tab); });
    });

    // Calendar view tabs
    document.querySelectorAll('.vtab[data-view]').forEach(function(b) {
        b.addEventListener('click', function() {
            document.querySelectorAll('.vtab[data-view]').forEach(function(x) { x.classList.remove('active'); });
            b.classList.add('active');
            calView = b.dataset.view;
            renderCalendar();
        });
    });

    // Stats period tabs
    document.querySelectorAll('.vtab[data-period]').forEach(function(b) {
        b.addEventListener('click', function() {
            document.querySelectorAll('.vtab[data-period]').forEach(function(x) { x.classList.remove('active'); });
            b.classList.add('active');
            renderStats(b.dataset.period);
        });
    });

    // Calendar nav
    document.getElementById('nav-prev').addEventListener('click', function() { navCal(-1); });
    document.getElementById('nav-next').addEventListener('click', function() { navCal(1); });
    document.getElementById('nav-today').addEventListener('click', function() { calDate = new Date(); renderCalendar(); });

    // Forms
    document.getElementById('session-form').addEventListener('submit', saveSession);
    document.getElementById('student-form').addEventListener('submit', saveStudent);

    // Hamburger
    document.getElementById('hamburger').addEventListener('click', function() {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Close sidebar on outside click (mobile)
    document.querySelector('.main').addEventListener('click', function() {
        document.getElementById('sidebar').classList.remove('open');
    });
});
