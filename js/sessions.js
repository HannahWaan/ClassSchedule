var currentSessionType = 'individual';
var quickSessionType = 'individual';

function setSessionType(type) {
    currentSessionType = type;
    document.getElementById('type-individual').classList.toggle('active', type === 'individual');
    document.getElementById('type-group').classList.toggle('active', type === 'group');
    document.getElementById('field-student').style.display = type === 'individual' ? '' : 'none';
    document.getElementById('field-group').style.display = type === 'group' ? '' : 'none';
    recalcFee();
}

function setQuickType(type) {
    quickSessionType = type;
    document.getElementById('q-type-ind').classList.toggle('active', type === 'individual');
    document.getElementById('q-type-grp').classList.toggle('active', type === 'group');
    document.getElementById('q-field-student').style.display = type === 'individual' ? '' : 'none';
    document.getElementById('q-field-group').style.display = type === 'group' ? '' : 'none';
    recalcQuickFee();
}

function recalcFee() {
    var start = document.getElementById('f-start').value;
    var end = document.getElementById('f-end').value;
    if (!start || !end) return;
    var mins = timeDiffMinutes(start, end);
    if (mins <= 0) { document.getElementById('f-fee-display').textContent = '0đ'; document.getElementById('f-fee-detail').textContent = 'Thời gian không hợp lệ'; document.getElementById('f-fee').value = '0'; return; }

    var rate = 0, rateMins = 60;
    if (currentSessionType === 'individual') {
        var sid = document.getElementById('f-student').value;
        var stu = Store.students.find(function(s) { return s.id === sid; });
        if (stu) { rate = stu.rate || 0; rateMins = stu.rate_minutes || 60; }
    } else {
        var gid = document.getElementById('f-group').value;
        var grp = Store.groups.find(function(g) { return g.id === gid; });
        if (grp) { rate = grp.rate || 0; rateMins = grp.rate_minutes || 60; }
    }
    var fee = calcFee(rate, rateMins, mins);
    document.getElementById('f-fee').value = fee;
    document.getElementById('f-fee-display').textContent = formatMoney(fee);
    document.getElementById('f-fee-detail').textContent = formatMoney(rate) + '/' + rateMins + 'p × ' + mins + ' phút = ' + formatMoney(fee);
}

function recalcQuickFee() {
    var start = document.getElementById('q-start').value;
    var end = document.getElementById('q-end').value;
    if (!start || !end) return;
    var mins = timeDiffMinutes(start, end);
    if (mins <= 0) { document.getElementById('q-fee-display').textContent = '0đ'; document.getElementById('q-fee').value = '0'; return; }
    var rate = 0, rateMins = 60;
    if (quickSessionType === 'individual') {
        var sid = document.getElementById('q-student').value;
        var stu = Store.students.find(function(s) { return s.id === sid; });
        if (stu) { rate = stu.rate || 0; rateMins = stu.rate_minutes || 60; }
    } else {
        var gid = document.getElementById('q-group').value;
        var grp = Store.groups.find(function(g) { return g.id === gid; });
        if (grp) { rate = grp.rate || 0; rateMins = grp.rate_minutes || 60; }
    }
    var fee = calcFee(rate, rateMins, mins);
    document.getElementById('q-fee').value = fee;
    document.getElementById('q-fee-display').textContent = formatMoney(fee);
}

async function saveSession(e) {
    e.preventDefault(); syncUI('🔄 Lưu...');
    var studentId = null, studentName = '', groupId = null, groupName = '';
    if (currentSessionType === 'individual') {
        studentId = document.getElementById('f-student').value || null;
        var found = Store.students.find(function(s) { return s.id === studentId; });
        if (found) studentName = found.name;
    } else {
        groupId = document.getElementById('f-group').value || null;
        var found2 = Store.groups.find(function(g) { return g.id === groupId; });
        if (found2) groupName = found2.name;
    }
    var obj = {
        user_id: CONFIG.USER_ID, session_type: currentSessionType,
        student_id: studentId, student_name: studentName,
        group_id: groupId, group_name: groupName,
        lesson: document.getElementById('f-lesson').value,
        fee: parseInt(document.getElementById('f-fee').value) || 0,
        date: document.getElementById('f-date').value,
        start_time: document.getElementById('f-start').value,
        end_time: document.getElementById('f-end').value,
        note: document.getElementById('f-note').value
    };
    var r = await db.from('sessions').insert(obj).select();
    if (r.error) { alert('❌ ' + r.error.message); syncUI('❌ Lỗi'); return; }
    Store.sessions.push(r.data[0]);
    document.getElementById('session-form').reset();
    document.getElementById('f-date').valueAsDate = new Date();
    document.getElementById('f-fee-display').textContent = '0đ';
    document.getElementById('f-fee-detail').textContent = 'Chọn học viên/nhóm và thời gian để tính';
    switchTab('schedule');
    syncUI('✅ Synced');
}

async function saveQuickSession(e) {
    e.preventDefault(); syncUI('🔄 Lưu...');
    var studentId = null, studentName = '', groupId = null, groupName = '';
    if (quickSessionType === 'individual') {
        studentId = document.getElementById('q-student').value || null;
        var found = Store.students.find(function(s) { return s.id === studentId; });
        if (found) studentName = found.name;
    } else {
        groupId = document.getElementById('q-group').value || null;
        var found2 = Store.groups.find(function(g) { return g.id === groupId; });
        if (found2) groupName = found2.name;
    }
    var obj = {
        user_id: CONFIG.USER_ID, session_type: quickSessionType,
        student_id: studentId, student_name: studentName,
        group_id: groupId, group_name: groupName,
        lesson: document.getElementById('q-lesson').value,
        fee: parseInt(document.getElementById('q-fee').value) || 0,
        date: document.getElementById('q-date').value,
        start_time: document.getElementById('q-start').value,
        end_time: document.getElementById('q-end').value,
        note: ''
    };
    var r = await db.from('sessions').insert(obj).select();
    if (r.error) { alert('❌ ' + r.error.message); syncUI('❌ Lỗi'); return; }
    Store.sessions.push(r.data[0]);
    document.getElementById('quick-form').reset();
    closeQuickModal();
    renderCalendar();
    syncUI('✅ Synced');
}

async function deleteSession(id) {
    if (!confirm('Xóa buổi dạy này?')) return;
    syncUI('🔄 Xóa...');
    await db.from('sessions').delete().eq('id', id);
    Store.sessions = Store.sessions.filter(function(s) { return s.id !== id; });
    renderCalendar();
    syncUI('✅ Synced');
}

async function nukeData() {
    syncUI('🔄 Xóa tất cả...');
    await db.from('sessions').delete().eq('user_id', CONFIG.USER_ID);
    await db.from('students').delete().eq('user_id', CONFIG.USER_ID);
    await db.from('groups').delete().eq('user_id', CONFIG.USER_ID);
    Store.sessions = []; Store.students = []; Store.groups = [];
    closeNuke();
    renderWelcome(); renderStudents(); renderGroups(); populateDropdown(); populateGroupDropdown(); renderCalendar();
    syncUI('✅ Đã xóa hết');
}
