function renderStudents() {
    var el = document.getElementById('students-root');
    if (!Store.students.length) { el.innerHTML = '<p class="muted">Chưa có học viên nào.</p>'; return; }
    el.innerHTML = Store.students.map(function(s) {
        var rateInfo = s.rate ? formatMoney(s.rate) + ' / ' + (s.rate_minutes || 60) + ' phút' : '';
        return '<div class="stu-card"><div class="stu-info"><h4>' + s.name + '</h4><p>📚 ' + (s.program || '—') + ' · 🎯 ' + s.level + '</p>' + (rateInfo ? '<p class="stu-rate">💰 ' + rateInfo + '</p>' : '') + (s.review ? '<p>💬 ' + s.review + '</p>' : '') + (s.note ? '<p>📝 ' + s.note + '</p>' : '') + '</div><button class="btn btn-danger btn-sm" onclick="deleteStudent(\'' + s.id + '\')">🗑</button></div>';
    }).join('');
}

async function saveStudent(e) {
    e.preventDefault(); syncUI('🔄 Lưu...');
    var obj = {
        user_id: CONFIG.USER_ID,
        name: document.getElementById('s-name').value,
        program: document.getElementById('s-program').value,
        rate: parseInt(document.getElementById('s-rate').value) || 0,
        rate_minutes: parseInt(document.getElementById('s-rate-minutes').value) || 60,
        level: document.getElementById('s-level').value,
        review: document.getElementById('s-review').value,
        note: document.getElementById('s-note').value
    };
    var r = await db.from('students').insert(obj).select();
    if (r.error) { alert('❌ ' + r.error.message); syncUI('❌ Lỗi'); return; }
    Store.students.push(r.data[0]);
    document.getElementById('student-form').reset();
    closeStudentModal();
    renderStudents(); populateDropdown();
    syncUI('✅ Synced');
}

async function deleteStudent(id) {
    if (!confirm('Xóa học viên này?')) return;
    syncUI('🔄 Xóa...');
    await db.from('students').delete().eq('id', id);
    Store.students = Store.students.filter(function(s) { return s.id !== id; });
    renderStudents(); populateDropdown();
    syncUI('✅ Synced');
}

function populateDropdown() {
    var sel = document.getElementById('f-student');
    sel.innerHTML = '<option value="">-- Chọn --</option>' + Store.students.map(function(s) { return '<option value="' + s.id + '">' + s.name + (s.rate ? ' (' + formatMoney(s.rate) + '/' + s.rate_minutes + 'p)' : '') + '</option>'; }).join('');
}

function populateGroupDropdown() {
    var sel = document.getElementById('f-group');
    sel.innerHTML = '<option value="">-- Chọn nhóm --</option>' + Store.groups.map(function(g) { return '<option value="' + g.id + '">' + g.name + (g.rate ? ' (' + formatMoney(g.rate) + '/' + g.rate_minutes + 'p)' : '') + '</option>'; }).join('');
}

function populateQuickDropdowns() {
    var sel1 = document.getElementById('q-student');
    sel1.innerHTML = '<option value="">-- Chọn --</option>' + Store.students.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
    var sel2 = document.getElementById('q-group');
    sel2.innerHTML = '<option value="">-- Chọn --</option>' + Store.groups.map(function(g) { return '<option value="' + g.id + '">' + g.name + '</option>'; }).join('');
}

function populateGroupMembers() {
    var el = document.getElementById('g-members-list');
    if (!Store.students.length) { el.innerHTML = '<p class="muted">Thêm học viên trước.</p>'; return; }
    el.innerHTML = Store.students.map(function(s) {
        return '<label><input type="checkbox" value="' + s.id + '"> ' + s.name + '</label>';
    }).join('');
}
