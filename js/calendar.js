var calView = 'week'; var calDate = new Date();

function renderCalendar() {
    var root = document.getElementById('calendar-root');
    if (calView === 'week') renderWeek(root);
    else if (calView === 'month') renderMonth(root);
    else renderDay(root);
    updateCalNav(); renderMiniCal();
}

function renderWeek(root) {
    var ws = getWeekStart(calDate);
    var days = ['T2','T3','T4','T5','T6','T7','CN'];
    var startHour = 6, endHour = 22;
    var h = '<div class="cal-week"><div class="cal-hdr"></div>';
    for (var d = 0; d < 7; d++) {
        var dt = new Date(ws); dt.setDate(dt.getDate()+d);
        h += '<div class="cal-hdr'+(isSameDay(dt,new Date())?' today':'')+'">'+days[d]+'<br>'+dt.getDate()+'/'+(dt.getMonth()+1)+'</div>';
    }
    for (var hr = startHour; hr <= endHour; hr++) {
        h += '<div class="cal-time">'+hr+':00</div>';
        for (var d2 = 0; d2 < 7; d2++) {
            var dt2 = new Date(ws); dt2.setDate(dt2.getDate()+d2);
            var ds = fmtISO(dt2);
            // Find events that START in this hour
            var cs = Store.sessions.filter(function(s) { return s.date === ds && parseInt(s.start_time) === hr; });
            h += '<div class="cal-cell" onclick="calCellClick(\''+ds+'\','+hr+')">';
            cs.forEach(function(s) {
                var durMins = timeDiffMinutes(s.start_time, s.end_time);
                var heightPx = Math.max(20, Math.round((durMins/60)*48) - 2);
                var startMin = parseInt(s.start_time.split(':')[1]);
                var topOffset = Math.round((startMin/60)*48);
                var color = Store.getColor(s);
                h += '<div class="cal-ev '+color+'" style="height:'+heightPx+'px;top:'+topOffset+'px" onclick="event.stopPropagation();showEventPanel(\''+s.id+'\')">';
                h += '<div class="ev-time">'+s.start_time.slice(0,5)+'</div>';
                h += (s.student_name || s.group_name || s.lesson);
                h += '</div>';
            });
            h += '</div>';
        }
    }
    h += '</div>';
    root.innerHTML = h;
}

function renderMonth(root) {
    var y = calDate.getFullYear(), m = calDate.getMonth();
    var first = new Date(y,m,1), last = new Date(y,m+1,0);
    var sd = (first.getDay()+6)%7;
    var days = ['T2','T3','T4','T5','T6','T7','CN'];
    var h = '<div class="cal-month">';
    days.forEach(function(d) { h += '<div class="cal-mhdr">'+d+'</div>'; });
    for (var i = 0; i < sd; i++) h += '<div class="cal-mday other"></div>';
    for (var day = 1; day <= last.getDate(); day++) {
        var dt = new Date(y,m,day); var ds = fmtISO(dt);
        var ss = Store.sessions.filter(function(s) { return s.date === ds; });
        var today = isSameDay(dt, new Date());
        h += '<div class="cal-mday'+(today?' today':'')+'" onclick="calDayClick(\''+ds+'\')"><div class="dn">'+day+'</div>';
        ss.slice(0,3).forEach(function(s) {
            var color = Store.getColor(s);
            h += '<div class="cal-ev '+color+'" onclick="event.stopPropagation();showEventPanel(\''+s.id+'\')">'+s.start_time.slice(0,5)+' '+(s.student_name||s.group_name||s.lesson)+'</div>';
        });
        if (ss.length > 3) h += '<div style="font-size:.6rem;color:var(--text3)">+'+(ss.length-3)+'</div>';
        h += '</div>';
    }
    h += '</div>';
    root.innerHTML = h;
}

function renderDay(root) {
    var ds = fmtISO(calDate);
    var ss = Store.sessions.filter(function(s) { return s.date === ds; }).sort(function(a,b) { return a.start_time.localeCompare(b.start_time); });
    var h = '<div class="cal-day">';
    if (!ss.length) h += '<p class="muted">Không có buổi dạy nào.</p><button class="btn btn-primary" style="margin-top:10px" onclick="calCellClick(\''+ds+'\',9)">➕ Thêm buổi</button>';
    else ss.forEach(function(s) {
        var color = Store.getColor(s);
        h += '<div class="day-item '+color+'" onclick="showEventPanel(\''+s.id+'\')"><strong>'+(s.student_name||s.group_name||'')+' – '+s.lesson+'</strong><span>'+s.start_time.slice(0,5)+'–'+s.end_time.slice(0,5)+' · '+formatMoney(s.fee)+'</span></div>';
    });
    h += '</div>';
    root.innerHTML = h;
}

function updateCalNav() {
    var el = document.getElementById('cal-nav-title');
    if (calView === 'week') { var ws = getWeekStart(calDate); var we = new Date(ws); we.setDate(we.getDate()+6); el.textContent = 'Tháng '+(ws.getMonth()+1)+' '+ws.getFullYear(); }
    else if (calView === 'month') { el.textContent = 'Tháng '+(calDate.getMonth()+1)+' / '+calDate.getFullYear(); }
    else { el.textContent = fmtDateLong(fmtISO(calDate)); }
}
function navCal(dir) {
    if (calView === 'week') calDate.setDate(calDate.getDate()+dir*7);
    else if (calView === 'month') calDate.setMonth(calDate.getMonth()+dir);
    else calDate.setDate(calDate.getDate()+dir);
    renderCalendar();
}
function calCellClick(date, hour) {
    document.getElementById('q-date').value = date;
    document.getElementById('q-hour').value = hour;
    document.getElementById('q-start').value = String(hour).padStart(2,'0')+':00';
    document.getElementById('q-end').value = String(hour+1).padStart(2,'0')+':00';
    document.getElementById('q-fee').value = '0'; document.getElementById('q-fee-display').textContent = '0đ';
    populateQuickDropdowns();
    document.getElementById('modal-quick').hidden = false;
}
function calDayClick(date) {
    calDate = new Date(date+'T00:00:00'); calView = 'day';
    document.querySelectorAll('.vtab[data-view]').forEach(function(x){x.classList.remove('active');});
    var btn = document.querySelector('.vtab[data-view="day"]'); if(btn) btn.classList.add('active');
    renderCalendar();
}

// RIGHT PANEL - Notion style event detail
function showEventPanel(id) {
    var s = Store.sessions.find(function(x) { return x.id === id; });
    if (!s) return;
    var mins = timeDiffMinutes(s.start_time, s.end_time);
    var color = Store.getColor(s);
    var colorVar = 'var(--ev-'+color.replace('c','color')+')';
    var typeLabel = s.session_type === 'group' ? '👥 Nhóm' : '👤 Cá nhân';
    var who = s.session_type === 'group' ? s.group_name : s.student_name;
    var repeatLabel = s.repeat_type === 'weekly' ? 'Mỗi 1 tuần' : s.repeat_type === 'biweekly' ? 'Mỗi 2 tuần' : 'Không lặp';
    var reminderLabel = s.reminder ? s.reminder + ' phút trước' : 'Không';

    var html = '<div class="rp-event-name">' + s.lesson + '</div>';
    html += '<div class="rp-row"><span class="rp-row-icon">🕐</span><div class="rp-row-content"><div class="rp-value">' + s.start_time.slice(0,5) + ' → ' + s.end_time.slice(0,5) + ' <span style="color:var(--text3);font-size:.8rem">(' + durationLabel(mins) + ')</span></div></div></div>';
    html += '<div class="rp-row"><span class="rp-row-icon">📅</span><div class="rp-row-content"><div class="rp-value">' + fmtDateLong(s.date) + '</div></div></div>';
    html += '<div class="rp-row"><span class="rp-row-icon">🌐</span><div class="rp-row-content"><div class="rp-value">GMT+7 Hồ Chí Minh</div></div></div>';
    html += '<div class="rp-row"><span class="rp-row-icon">🔁</span><div class="rp-row-content"><div class="rp-label">Lặp lại</div><div class="rp-value">' + repeatLabel + '</div></div></div>';
    html += '<div class="rp-row"><span class="rp-row-icon">👤</span><div class="rp-row-content"><div class="rp-label">' + typeLabel + '</div><div class="rp-value">' + (who || '—') + '</div></div></div>';
    if (s.location) html += '<div class="rp-row"><span class="rp-row-icon">📍</span><div class="rp-row-content"><div class="rp-label">Địa điểm</div><div class="rp-value">' + s.location + '</div></div></div>';
    html += '<div class="rp-row"><span class="rp-row-icon">💰</span><div class="rp-row-content"><div class="rp-label">Học phí</div><div class="rp-value">' + formatMoney(s.fee) + '</div></div></div>';
    html += '<div class="rp-row"><span class="rp-row-icon">🔔</span><div class="rp-row-content"><div class="rp-label">Lời nhắc</div><div class="rp-value">' + reminderLabel + '</div></div></div>';
    if (s.note) html += '<div class="rp-row"><span class="rp-row-icon">📝</span><div class="rp-row-content"><div class="rp-label">Ghi chú</div><div class="rp-value">' + s.note + '</div></div></div>';
    html += '<div class="rp-status"><span class="rp-color-dot" style="background:' + colorVar + '"></span> ' + (who || s.lesson) + '</div>';
    html += '<div class="rp-actions"><button class="btn btn-danger btn-sm" onclick="deleteSessionFromPanel(\''+s.id+'\')">🗑 Xóa</button><button class="btn btn-ghost btn-sm" onclick="closeRightPanel()">Đóng</button></div>';

    document.getElementById('rp-body').innerHTML = html;
    openRightPanel();
}

function deleteSessionFromPanel(id) {
    deleteSession(id);
    closeRightPanel();
}

// MINI CALENDAR
var miniCalDate = new Date();
function renderMiniCal() {
    var el = document.getElementById('mini-cal');
    var y = miniCalDate.getFullYear(), m = miniCalDate.getMonth();
    var first = new Date(y,m,1), last = new Date(y,m+1,0);
    var sd = (first.getDay()+6)%7;
    var days = ['T2','T3','T4','T5','T6','T7','CN'];
    var eventDates = {};
    Store.sessions.forEach(function(s) { eventDates[s.date] = true; });

    var h = '<div class="mini-cal-header"><button onclick="miniCalNav(-1)">‹</button><span>Thg '+(m+1)+' '+y+'</span><button onclick="miniCalNav(1)">›</button></div>';
    h += '<div class="mini-cal-grid">';
    days.forEach(function(d) { h += '<div class="mc-hdr">'+d+'</div>'; });
    for (var i = 0; i < sd; i++) h += '<div class="mc-day other"></div>';
    for (var day = 1; day <= last.getDate(); day++) {
        var dt = new Date(y,m,day); var ds = fmtISO(dt);
        var cls = 'mc-day';
        if (isSameDay(dt, new Date())) cls += ' today';
        if (eventDates[ds]) cls += ' has-event';
        h += '<div class="'+cls+'" onclick="miniCalClick(\''+ds+'\')">'+day+'</div>';
    }
    h += '</div>';
    el.innerHTML = h;
}
function miniCalNav(dir) { miniCalDate.setMonth(miniCalDate.getMonth()+dir); renderMiniCal(); }
function miniCalClick(ds) { calDate = new Date(ds+'T00:00:00'); calView = 'day'; document.querySelectorAll('.vtab[data-view]').forEach(function(x){x.classList.remove('active');}); var btn=document.querySelector('.vtab[data-view="day"]'); if(btn)btn.classList.add('active'); renderCalendar(); }
