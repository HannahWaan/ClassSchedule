async function saveSession(e) {
    e.preventDefault();
    syncUI('🔄 Lưu...');
    var studentId = document.getElementById('f-student').value;
    var studentName = '';
    if (studentId) {
        var found = Store.students.find(function(s) { return s.id === studentId; });
        if (found) studentName = found.name;
    }
    var obj = {
        user_id: CONFIG.USER_ID,
        student_id: studentId || null,
        student_name: studentName,
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
    switchTab('schedule');
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
    Store.sessions = [];
    Store.students = [];
    closeNuke();
    renderWelcome();
    renderStudents();
    populateDropdown();
    renderCalendar();
    syncUI('✅ Đã xóa hết');
}
