function renderGroups() {
    var el = document.getElementById('groups-root');
    if (!Store.groups.length) { el.innerHTML = '<p class="muted">Chưa có nhóm nào.</p>'; return; }
    el.innerHTML = Store.groups.map(function(g) {
        var members = Store.students.filter(function(s) { return s.group_id === g.id; });
        return '<div class="group-card"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h4>👥 ' + g.name + '</h4><p>📚 ' + (g.program || '—') + ' · 💰 ' + formatMoney(g.rate) + ' / ' + (g.rate_minutes || 60) + ' phút (nhóm)</p>' + (g.note ? '<p>📝 ' + g.note + '</p>' : '') + '<div class="group-members">' + members.map(function(m) { return '<span class="group-member-tag">' + m.name + '</span>'; }).join('') + '</div></div><button class="btn btn-danger btn-sm" onclick="deleteGroup(\'' + g.id + '\')">🗑</button></div></div>';
    }).join('');
}

async function saveGroup(e) {
    e.preventDefault(); syncUI('🔄 Lưu...');
    var obj = {
        user_id: CONFIG.USER_ID,
        name: document.getElementById('g-name').value,
        program: document.getElementById('g-program').value,
        rate: parseInt(document.getElementById('g-rate').value) || 0,
        rate_minutes: parseInt(document.getElementById('g-rate-minutes').value) || 60,
        note: document.getElementById('g-note').value
    };
    var r = await db.from('groups').insert(obj).select();
    if (r.error) { alert('❌ ' + r.error.message); syncUI('❌ Lỗi'); return; }
    var newGroup = r.data[0];
    Store.groups.push(newGroup);

    // Assign checked students to this group
    var checks = document.querySelectorAll('#g-members-list input[type="checkbox"]:checked');
    for (var i = 0; i < checks.length; i++) {
        var sid = checks[i].value;
        await db.from('students').update({ group_id: newGroup.id }).eq('id', sid);
        var stu = Store.students.find(function(s) { return s.id === sid; });
        if (stu) stu.group_id = newGroup.id;
    }

    document.getElementById('group-form').reset();
    closeGroupModal();
    renderGroups(); populateGroupDropdown();
    syncUI('✅ Synced');
}

async function deleteGroup(id) {
    if (!confirm('Xóa nhóm này?')) return;
    syncUI('🔄 Xóa...');
    // Unassign students
    await db.from('students').update({ group_id: null }).eq('group_id', id);
    Store.students.forEach(function(s) { if (s.group_id === id) s.group_id = null; });
    await db.from('groups').delete().eq('id', id);
    Store.groups = Store.groups.filter(function(g) { return g.id !== id; });
    renderGroups(); populateGroupDropdown();
    syncUI('✅ Synced');
}
