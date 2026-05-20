var calView = 'week';
var calDate = new Date();

function renderCalendar() {
    var root = document.getElementById('calendar-root');
    if (calView === 'week') renderWeek(root);
    else if (calView === 'month') renderMonth(root);
    else renderDay(root);
    updateCalNav();
}

function renderWeek(root) {
    var ws = getWeekStart(calDate);
    var days = ['T2','T3','T4','T5','T6','T7','CN'];
    var h = '<div class="cal-week"><div class="cal-hdr">Giờ</div>';
    for (var d = 0; d < 7; d++) {
        var dt = new Date(ws); dt.setDate(dt.getDate() + d);
        h += '<div class="cal-hdr' + (isSameDay(dt, new Date()) ? ' today' : '') + '">' + days[d] + '<br>' + dt.getDate() + '/' + (dt.getMonth()+1) + '</div>';
    }
    for (var hr = 6; hr <= 22; hr++) {
        h += '<div class="cal-time">' + hr + ':00</div>';
        for (var d2 = 0; d2 < 7; d2++) {
            var dt2 = new Date(ws); dt2.setDate(dt2.getDate() + d2);
            var ds = fmtISO(dt2);
            var cs = Store.sessions.filter(function(s) { return s.date === ds && parseInt(s.start_time) === hr; });
            h += '<div class="cal-cell" data-date="' + ds + '" data-hour="' + hr + '" onclick="calCellClick(\'' + ds + '\',' + hr + ')">';
            cs.forEach(function(s) {
                var cls = s.session_type === 'group' ? 'cal-ev group-ev' : 'cal-ev';
                h += '<div class="' + cls + '" onclick="event.stopPropagation();showEvent(\'' + s.id + '\')" title="' + s.lesson + '">' + (s.student_name || s.group_name || s.lesson) + '</div>';
            });
            h += '</div>';
        }
    }
    h += '</div>';
    root.innerHTML = h;
}

function renderMonth(root) {
    var y = calDate.getFullYear(), m = calDate.getMonth();
    var first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
    var sd = (first.getDay() + 6) % 7;
    var days = ['T2','T3','T4','T5','T6','T7','CN'];
    var h = '<div class="cal-month">';
    days.forEach(function(d) { h += '<div class="cal-mhdr">' + d + '</div>'; });
    for (var i = 0; i < sd; i++) h += '<div class="cal-mday other"></div>';
    for (var day = 1; day <= last.getDate(); day++) {
        var dt = new Date(y, m, day); var ds = fmtISO(dt);
        var ss = Store.sessions.filter(function(s) { return s.date === ds; });
        var today = isSameDay(dt, new Date());
        h += '<div class="cal-mday' + (today ? ' today' : '') + '" onclick="calDayClick(\'' + ds + '\')"><div class="dn">' + day + '</div>';
        ss.slice(0, 3).forEach(function(s) {
            var cls = s.session_type === 'group' ? 'cal-ev group-ev' : 'cal-ev';
            h += '<div class="' + cls + '" onclick="event.stopPropagation();showEvent(\'' + s.id + '\')">' + s.start_time.slice(0,5) + ' ' + (s.student_name || s.group_name || s.lesson) + '</div>';
        });
        if (ss.length > 3) h += '<div style="font-size:.65rem;color:var(--text3)">+' + (ss.length - 3) + '</div>';
        h += '</div>';
    }
    h += '</div>';
    root.innerHTML = h;
}

function renderDay(root) {
    var ds = fmtISO(calDate);
    var ss = Store.sessions.filter(function(s) { return s.date === ds; }).sort(function(a, b) { return a.start_time.localeCompare(b.start_time); });
    var h = '<div class="cal-day">';
    if (!ss.length) h += '<p class="muted">Không có buổi dạy nào hôm nay.</p><button class="btn btn-primary" style="margin-top:12px" onclick="calCellClick(\'' + ds + '\',9)">➕ Thêm buổi</button>';
    else ss.forEach(function(s) {
        var cls = s.session_type === 'group' ? 'day-item group-item' : 'day-item';
        h += '<div class="' + cls + '" onclick="showEvent(\'' + s.id + '\')"><strong>' + s.lesson + '</strong><span>' + (s.student_name || s.group_name || '') + ' · ' + s.start_time.slice(0,5) + '–' + s.end_time.slice(0,5) + ' · ' + formatMoney(s.fee) + '</span></div>';
    });
    h += '</div>';
    root.innerHTML = h;
}

function updateCalNav() {
    var el = document.getElementById('cal-nav-title');
    if (calView === 'week') { var ws = getWeekStart(calDate); var we = new Date(ws); we.setDate(we.getDate()+6); el.textContent = ws.getDate()+'/'+(ws.getMonth()+1)+' – '+we.getDate()+'/'+(we.getMonth()+1)+'/'+we.getFullYear(); }
    else if (calView === 'month') { el.textContent = 'Tháng ' + (calDate.getMonth()+1) + ' / ' + calDate.getFullYear(); }
    else { el.textContent = fmtDate(fmtISO(calDate)); }
}

function navCal(dir) {
    if (calView === 'week') calDate.setDate(calDate.getDate() + dir * 7);
    else if (calView === 'month') calDate.setMonth(calDate.getMonth() + dir);
    else calDate.setDate(calDate.getDate() + dir);
    renderCalendar();
}

// Notion-style: click cell to quick-add
function calCellClick(date, hour) {
    document.getElementById('q-date').value = date;
    document.getElementById('q-hour').value = hour;
    document.getElementById('q-start').value = String(hour).padStart(2,'0') + ':00';
    document.getElementById('q-end').value = String(hour + 1).padStart(2,'0') + ':00';
    document.getElementById('q-fee').value = '0';
    document.getElementById('q-fee-display').textContent = '0đ';
    populateQuickDropdowns();
    document.getElementById('modal-quick').hidden = false;
}

function calDayClick(date) {
    calDate = new Date(date + 'T00:00:00');
    calView = 'day';
    document.querySelectorAll('.vtab[data-view]').forEach(function(x) { x.classList.remove('active'); });
    var dayBtn = document.querySelector('.vtab[data-view="day"]');
    if (dayBtn) dayBtn.classList.add('active');
    renderCalendar();
}

// Show event detail
function showEvent(id) {
    var s = Store.sessions.find(function(x) { return x.id === id; });
    if (!s) return;
    var el = document.getElementById('event-detail');
    var typeLabel = s.session_type === 'group' ? '👥 Nhóm: ' + (s.group_name || '') : '👤 ' + (s.student_name || '');
    el.innerHTML = '<div class="event-detail-grid">' +
        '<div class="ed-row"><span class="ed-label">Loại</span><span class="ed-value">' + typeLabel + '</span></div>' +
        '<div class="ed-row"><span class="ed-label">Bài giảng</span><span class="ed-value">' + s.lesson + '</span></div>' +
        '<div class="ed-row"><span class="ed-label">Ngày</span><span class="ed-value">' + fmtDate(s.date) + '</span></div>' +
        '<div class="ed-row"><span class="ed-label">Thời gian</span><span class="ed-value">' + s.start_time.slice(0,5) + ' – ' + s.end_time.slice(0,5) + '</span></div>' +
        '<div class="ed-row"><span class="ed-label">Học phí</span><span class="ed-value">' + formatMoney(s.fee) + '</span></div>' +
        (s.note ? '<div class="ed-row"><span class="ed-label">Ghi chú</span><span class="ed-value">' + s.note + '</span></div>' : '') +
        '</div>';
    document.getElementById('event-delete-btn').onclick = function() { deleteSession(id); closeEventModal(); };
    document.getElementById('modal-event').hidden = false;
}
