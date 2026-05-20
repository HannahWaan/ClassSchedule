// ╔══════════════════════════════════════════════════════════════════╗
// ║  THAY 2 DÒNG NÀY BẰNG THÔNG TIN TỪ SUPABASE DASHBOARD        ║
// ║  (Settings → API → Project URL và anon public key)             ║
// ╚══════════════════════════════════════════════════════════════════╝
const SUPABASE_URL = 'https://lpcfovgphkbauejqtrqo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY2ZvdmdwaGtiYXVlanF0cnFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyOTA3NjksImV4cCI6MjA5NDg2Njc2OX0.7SnBI_kxiqYVHJs71V0rUuMEbSaWC6To2QM8WZD7jEg';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let sessionsCache = [];
let studentsCache = [];
let profileCache = {};
let currentView = 'week';
let viewDate = new Date();

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) { currentUser = session.user; showApp(); }
    else { showAuth(); }

    supabase.auth.onAuthStateChange((event, session) => {
        if (session) { currentUser = session.user; showApp(); }
        else { currentUser = null; showAuth(); }
    });

    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); switchTab(link.dataset.tab); });
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            renderCalendar();
        });
    });

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderStats(btn.dataset.period);
        });
    });

    document.getElementById('cal-prev').addEventListener('click', () => navCalendar(-1));
    document.getElementById('cal-next').addEventListener('click', () => navCalendar(1));
    document.getElementById('cal-today').addEventListener('click', () => { viewDate = new Date(); renderCalendar(); });

    document.getElementById('session-form').addEventListener('submit', saveSession);
    document.getElementById('student-form').addEventListener('submit', saveStudent);

    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
});

// ============ AUTH ============
function showAuth() {
    document.getElementById('auth-screen').hidden = false;
    document.getElementById('app-container').hidden = true;
}
function showApp() {
    document.getElementById('auth-screen').hidden = true;
    document.getElementById('app-container').hidden = false;
    loadAllData();
}
function showAuthTab(tab) {
    document.getElementById('tab-login-btn').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register-btn').classList.toggle('active', tab === 'register');
    document.getElementById('login-form').hidden = (tab !== 'login');
    document.getElementById('register-form').hidden = (tab !== 'register');
    document.getElementById('auth-error').hidden = true;
}
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showAuthError(error.message);
}
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error) showAuthError(error.message);
    else showAuthError('✅ Đăng ký thành công! Kiểm tra email xác nhận hoặc đăng nhập ngay.');
}
async function logout() {
    await supabase.auth.signOut();
    showAuth();
}
function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.hidden = false;
}

// ============ LOAD DATA ============
async function loadAllData() {
    setSyncStatus('🔄 Đang tải...');
    const [sessionsRes, studentsRes, profileRes] = await Promise.all([
        supabase.from('sessions').select('*').eq('user_id', currentUser.id).order('date'),
        supabase.from('students').select('*').eq('user_id', currentUser.id).order('created_at'),
        supabase.from('profiles').select('*').eq('id', currentUser.id).single()
    ]);
    sessionsCache = sessionsRes.data || [];
    studentsCache = studentsRes.data || [];
    profileCache = profileRes.data || {};

    const theme = profileCache.theme || 'light';
    const font = profileCache.font || "'Inter', sans-serif";
    setTheme(theme);
    setFont(font);
    document.getElementById('font-select').value = font;
    document.getElementById('profile-name').value = profileCache.full_name || '';
    document.getElementById('profile-email').textContent = currentUser.email;
    document.getElementById('welcome-name').textContent = profileCache.full_name || 'Giáo viên';
    document.getElementById('form-date').valueAsDate = new Date();

    renderAll();
    setSyncStatus('✅ Đã đồng bộ');
}
function setSyncStatus(text) { document.getElementById('sync-status').textContent = text; }

// ============ RENDER ============
function renderAll() { renderWelcome(); renderStudents(); populateStudentDropdown(); renderCalendar(); }

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const link = document.querySelector('.nav-link[data-tab="' + tab + '"]');
    if (link) link.classList.add('active');
    var titles = { welcome:'Chào mừng', schedule:'Lịch dạy', 'add-session':'Thêm buổi', stats:'Thống kê', students:'Học viên', profile:'Hồ sơ' };
    document.getElementById('topbar-title').textContent = titles[tab] || '';
    if (tab === 'schedule') renderCalendar();
    if (tab === 'stats') renderStats('week');
    if (tab === 'welcome') renderWelcome();
    if (tab === 'students') renderStudents();
    if (tab === 'add-session') populateStudentDropdown();
    document.getElementById('sidebar').classList.remove('open');
}

// ============ WELCOME ============
function renderWelcome() {
    var now = new Date();
    document.getElementById('stat-students').textContent = studentsCache.length;
    var weekStart = getWeekStart(now);
    var weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    var weekSessions = sessionsCache.filter(function(s) { var d = new Date(s.date); return d >= weekStart && d < weekEnd; });
    document.getElementById('stat-week-sessions').textContent = weekSessions.length;
    var totalFee = sessionsCache.reduce(function(sum, s) { return sum + (Number(s.fee) || 0); }, 0);
    document.getElementById('stat-salary').textContent = formatMoney(totalFee);
    var monthSessions = sessionsCache.filter(function(s) { var d = new Date(s.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    var hours = 0;
    monthSessions.forEach(function(s) { if (s.start_time && s.end_time) hours += timeDiffHours(s.start_time, s.end_time); });
    document.getElementById('stat-hours').textContent = hours.toFixed(1) + 'h';

    var upcoming = sessionsCache
        .filter(function(s) { return new Date(s.date + 'T' + s.start_time) >= new Date(now.getTime() - 86400000); })
        .sort(function(a, b) { return (a.date + a.start_time).localeCompare(b.date + b.start_time); })
        .slice(0, 5);
    var container = document.getElementById('upcoming-sessions');
    if (upcoming.length === 0) { container.innerHTML = '<p class="empty-state">Chưa có buổi dạy nào.</p>'; }
    else {
        container.innerHTML = upcoming.map(function(s) {
            return '<div class="session-item"><div class="session-item-info"><strong>' + s.lesson + '</strong><span>' + (s.student_name || 'N/A') + ' · ' + formatDate(s.date) + ' · ' + s.start_time.slice(0,5) + '–' + s.end_time.slice(0,5) + '</span></div></div>';
        }).join('');
    }
    document.getElementById('welcome-name').textContent = profileCache.full_name || 'Giáo viên';
}

// ============ CALENDAR ============
function renderCalendar() {
    var container = document.getElementById('calendar-container');
    if (currentView === 'week') renderWeekView(container);
    else if (currentView === 'month') renderMonthView(container);
    else renderDayView(container);
    updateCalTitle();
}

function renderWeekView(container) {
    var weekStart = getWeekStart(viewDate);
    var days = ['T2','T3','T4','T5','T6','T7','CN'];
    var hours = []; for (var h = 6; h <= 22; h++) hours.push(h);
    var html = '<div class="calendar-week">';
    html += '<div class="cal-header">Giờ</div>';
    for (var d = 0; d < 7; d++) {
        var date = new Date(weekStart); date.setDate(date.getDate() + d);
        var isToday = isSameDay(date, new Date());
        html += '<div class="cal-header" style="' + (isToday ? 'background:#10b981' : '') + '">' + days[d] + '<br>' + date.getDate() + '/' + (date.getMonth()+1) + '</div>';
    }
    hours.forEach(function(h) {
        html += '<div class="cal-time">' + h + ':00</div>';
        for (var d = 0; d < 7; d++) {
            var cellDate = new Date(weekStart); cellDate.setDate(cellDate.getDate() + d);
            var dateStr = formatDateISO(cellDate);
            var cellSessions = sessionsCache.filter(function(s) { return s.date === dateStr && parseInt(s.start_time) === h; });
            html += '<div class="cal-cell">';
            cellSessions.forEach(function(s) { html += '<div class="cal-event" title="' + s.lesson + ' (' + s.start_time.slice(0,5) + '–' + s.end_time.slice(0,5) + ')">' + (s.student_name || s.lesson) + '</div>'; });
            html += '</div>';
        }
    });
    html += '</div>';
    container.innerHTML = html;
}

function renderMonthView(container) {
    var year = viewDate.getFullYear();
    var month = viewDate.getMonth();
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);
    var startDay = (firstDay.getDay() + 6) % 7;
    var days = ['T2','T3','T4','T5','T6','T7','CN'];
    var html = '<div class="calendar-month">';
    days.forEach(function(d) { html += '<div class="month-header">' + d + '</div>'; });
    for (var i = 0; i < startDay; i++) html += '<div class="month-cell other-month"></div>';
    for (var day = 1; day <= lastDay.getDate(); day++) {
        var date = new Date(year, month, day);
        var dateStr = formatDateISO(date);
        var daySessions = sessionsCache.filter(function(s) { return s.date === dateStr; });
        var isToday = isSameDay(date, new Date());
        html += '<div class="month-cell ' + (isToday ? 'today' : '') + '"><div class="day-num">' + day + '</div>';
        daySessions.slice(0,2).forEach(function(s) { html += '<div class="cal-event">' + s.start_time.slice(0,5) + ' ' + (s.student_name || s.lesson) + '</div>'; });
        if (daySessions.length > 2) html += '<div style="font-size:0.7rem;color:var(--text-muted)">+' + (daySessions.length - 2) + '</div>';
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderDayView(container) {
    var dateStr = formatDateISO(viewDate);
    var daySessions = sessionsCache.filter(function(s) { return s.date === dateStr; }).sort(function(a,b) { return a.start_time.localeCompare(b.start_time); });
    var html = '<div class="calendar-day">';
    if (daySessions.length === 0) { html += '<p class="empty-state">Không có buổi dạy nào trong ngày này.</p>'; }
    else {
        daySessions.forEach(function(s) {
            html += '<div class="day-session"><strong>' + s.lesson + '</strong><br><span style="color:var(--text-muted)">' + (s.student_name||'N/A') + ' · ' + s.start_time.slice(0,5) + '–' + s.end_time.slice(0,5) + ' · ' + formatMoney(s.fee) + '</span>' + (s.note ? '<br><em style="font-size:0.8rem">' + s.note + '</em>' : '') + '<br><button class="btn btn-danger btn-sm" style="margin-top:6px" onclick="deleteSession(\'' + s.id + '\')">🗑 Xóa</button></div>';
        });
    }
    html += '</div>';
    container.innerHTML = html;
}

function updateCalTitle() {
    var el = document.getElementById('cal-title');
    if (currentView === 'week') { var ws = getWeekStart(viewDate); var we = new Date(ws); we.setDate(we.getDate()+6); el.textContent = ws.getDate()+'/'+(ws.getMonth()+1)+' – '+we.getDate()+'/'+(we.getMonth()+1)+'/'+we.getFullYear(); }
    else if (currentView === 'month') { var m = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']; el.textContent = m[viewDate.getMonth()] + ' ' + viewDate.getFullYear(); }
    else { el.textContent = formatDate(formatDateISO(viewDate)); }
}

function navCalendar(dir) {
    if (currentView === 'week') viewDate.setDate(viewDate.getDate() + dir * 7);
    else if (currentView === 'month') viewDate.setMonth(viewDate.getMonth() + dir);
    else viewDate.setDate(viewDate.getDate() + dir);
    renderCalendar();
}

// ============ SESSIONS ============
async function saveSession(e) {
    e.preventDefault();
    setSyncStatus('🔄 Đang lưu...');
    var studentSelect = document.getElementById('form-student');
    var { data, error } = await supabase.from('sessions').insert({
        user_id: currentUser.id,
        student_id: studentSelect.value || null,
        student_name: studentSelect.value ? studentSelect.options[studentSelect.selectedIndex].text : '',
        lesson: document.getElementById('form-lesson').value,
        fee: Number(document.getElementById('form-fee').value) || 0,
        date: document.getElementById('form-date').value,
        start_time: document.getElementById('form-start').value,
        end_time: document.getElementById('form-end').value,
        note: document.getElementById('form-note').value
    }).select();
    if (error) { alert('❌ Lỗi: ' + error.message); setSyncStatus('❌ Lỗi'); return; }
    sessionsCache.push(data[0]);
    document.getElementById('session-form').reset();
    document.getElementById('form-date').valueAsDate = new Date();
    alert('✅ Đã lưu buổi dạy!');
    setSyncStatus('✅ Đã đồng bộ');
    switchTab('schedule');
}

async function deleteSession(id) {
    if (!confirm('Bạn có chắc muốn xóa?')) return;
    setSyncStatus('🔄 Đang xóa...');
    var { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) { alert('❌ Lỗi: ' + error.message); return; }
    sessionsCache = sessionsCache.filter(function(s) { return s.id !== id; });
    renderCalendar(); renderWelcome();
    setSyncStatus('✅ Đã đồng bộ');
}

// ============ STUDENTS ============
function renderStudents() {
    var container = document.getElementById('students-list');
    if (studentsCache.length === 0) { container.innerHTML = '<p class="empty-state">Chưa có học viên nào.</p>'; return; }
    container.innerHTML = studentsCache.map(function(s) {
        return '<div class="student-card"><div class="student-info"><h4>' + s.name + '</h4><p>📚 ' + (s.program||'Chưa có') + ' · 🎯 ' + s.level + '</p>' + (s.review ? '<p>💬 ' + s.review + '</p>' : '') + (s.note ? '<p>📝 ' + s.note + '</p>' : '') + '</div><div class="student-actions"><button class="btn btn-danger btn-sm" onclick="deleteStudent(\'' + s.id + '\')">🗑</button></div></div>';
    }).join('');
}

async function saveStudent(e) {
    e.preventDefault();
    setSyncStatus('🔄 Đang lưu...');
    var { data, error } = await supabase.from('students').insert({
        user_id: currentUser.id,
        name: document.getElementById('student-name').value,
        program: document.getElementById('student-program').value,
        level: document.getElementById('student-level').value,
        review: document.getElementById('student-review').value,
        note: document.getElementById('student-note').value
    }).select();
    if (error) { alert('❌ Lỗi: ' + error.message); setSyncStatus('❌ Lỗi'); return; }
    studentsCache.push(data[0]);
    document.getElementById('student-form').reset();
    closeStudentModal();
    renderStudents(); populateStudentDropdown();
    alert('✅ Đã thêm học viên!');
    setSyncStatus('✅ Đã đồng bộ');
}

async function deleteStudent(id) {
    if (!confirm('Xóa học viên này?')) return;
    var { error } = await supabase.from('students').delete().eq('id', id);
    if (error) { alert('❌ Lỗi: ' + error.message); return; }
    studentsCache = studentsCache.filter(function(s) { return s.id !== id; });
    renderStudents(); populateStudentDropdown();
    setSyncStatus('✅ Đã đồng bộ');
}

function populateStudentDropdown() {
    var select = document.getElementById('form-student');
    select.innerHTML = '<option value="">-- Chọn học viên --</option>' + studentsCache.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
}

function openStudentModal() { document.getElementById('student-modal').hidden = false; }
function closeStudentModal() { document.getElementById('student-modal').hidden = true; }

// ============ STATS ============
function renderStats(period) {
    var now = new Date();
    var filtered;
    if (period === 'week') {
        var ws = getWeekStart(now); var we = new Date(ws); we.setDate(we.getDate()+7);
        filtered = sessionsCache.filter(function(s) { var d = new Date(s.date); return d >= ws && d < we; });
    } else {
        filtered = sessionsCache.filter(function(s) { var d = new Date(s.date); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); });
    }
    document.getElementById('stats-total-sessions').textContent = filtered.length;
    document.getElementById('stats-total-students').textContent = studentsCache.length;
    document.getElementById('stats-total-revenue').textContent = formatMoney(filtered.reduce(function(sum,s){return sum+(Number(s.fee)||0);},0));

    var detail = document.getElementById('stats-detail-list');
    if (filtered.length === 0) { detail.innerHTML = '<p class="empty-state">Chưa có dữ liệu.</p>'; }
    else {
        detail.innerHTML = filtered.sort(function(a,b){return (a.date+a.start_time).localeCompare(b.date+b.start_time);}).map(function(s){
            return '<div class="session-item"><div class="session-item-info"><strong>'+s.lesson+'</strong><span>'+(s.student_name||'N/A')+' · '+formatDate(s.date)+' · '+s.start_time.slice(0,5)+'–'+s.end_time.slice(0,5)+' · '+formatMoney(s.fee)+'</span></div></div>';
        }).join('');
    }
}

// ============ EXPORT ============
function exportPDF() {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF();
    var name = profileCache.full_name || 'Giao vien';
    doc.setFontSize(16);
    doc.text('Lich day - ' + name, 14, 20);
    doc.setFontSize(10);
    var y = 35;
    sessionsCache.sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(s,i){
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text((i+1)+'. '+s.date+' | '+s.start_time.slice(0,5)+'-'+s.end_time.slice(0,5)+' | '+(s.student_name||'N/A')+' | '+s.lesson+' | '+s.fee+'d', 14, y);
        y += 8;
    });
    doc.save('lich-day.pdf');
}

function exportExcel() {
    var data = sessionsCache.map(function(s){ return {'Ngay':s.date,'Bat dau':s.start_time,'Ket thuc':s.end_time,'Hoc vien':s.student_name||'','Bai giang':s.lesson,'Hoc phi':s.fee,'Ghi chu':s.note||''}; });
    var ws = XLSX.utils.json_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lich day');
    XLSX.writeFile(wb, 'lich-day.xlsx');
}

function shareSchedule() {
    var name = profileCache.full_name || 'Giao vien';
    var text = '📅 Lịch dạy - ' + name + '\n\n';
    sessionsCache.sort(function(a,b){return a.date.localeCompare(b.date);}).forEach(function(s){
        text += '• ' + formatDate(s.date) + ' ' + s.start_time.slice(0,5) + '-' + s.end_time.slice(0,5) + ': ' + s.lesson + ' (' + (s.student_name||'N/A') + ')\n';
    });
    if (navigator.share) { navigator.share({title:'Lịch dạy',text:text}); }
    else { navigator.clipboard.writeText(text).then(function(){alert('✅ Đã copy lịch vào clipboard!');}); }
}

// ============ PROFILE ============
async function saveProfile() {
    var name = document.getElementById('profile-name').value || 'Giáo viên';
    setSyncStatus('🔄 Đang lưu...');
    var { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', currentUser.id);
    if (error) { alert('❌ Lỗi: ' + error.message); return; }
    profileCache.full_name = name;
    document.getElementById('welcome-name').textContent = name;
    alert('✅ Đã lưu!');
    setSyncStatus('✅ Đã đồng bộ');
}

async function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    document.getElementById('theme-light').classList.toggle('active', theme === 'light');
    document.getElementById('theme-dark').classList.toggle('active', theme === 'dark');
    if (currentUser && profileCache.theme !== theme) {
        profileCache.theme = theme;
        await supabase.from('profiles').update({ theme: theme }).eq('id', currentUser.id);
    }
}

async function setFont(font) {
    document.body.style.fontFamily = font;
    if (currentUser && profileCache.font !== font) {
        profileCache.font = font;
        await supabase.from('profiles').update({ font: font }).eq('id', currentUser.id);
    }
}

// ============ UTILITIES ============
function getWeekStart(date) { var d = new Date(date); var day = d.getDay(); var diff = d.getDate() - day + (day === 0 ? -6 : 1); d.setDate(diff); d.setHours(0,0,0,0); return d; }
function isSameDay(a, b) { return a.getDate()===b.getDate() && a.getMonth()===b.getMonth() && a.getFullYear()===b.getFullYear(); }
function formatDateISO(date) { return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); }
function formatDate(iso) { var p = iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function formatMoney(n) { return Number(n).toLocaleString('vi-VN')+'đ'; }
function timeDiffHours(start, end) { var sp = start.split(':'); var ep = end.split(':'); return (parseInt(ep[0])*60+parseInt(ep[1])-parseInt(sp[0])*60-parseInt(sp[1]))/60; }
