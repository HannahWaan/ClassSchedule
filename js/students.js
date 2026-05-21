function renderStudents(){
    var el=document.getElementById('students-root');
    if(!Store.students.length){el.innerHTML='<p class="muted">Chưa có học viên nào.</p>';return;}
    el.innerHTML=Store.students.map(function(s){
        var ri=s.rate?formatMoney(s.rate)+'/'+s.rate_minutes+'p':'';
        var grp=Store.groups.find(function(g){return g.id===s.group_id;});
        var grpTag=grp?'<span class="stu-group-tag">👥 '+grp.name+'</span>':'';
        return '<div class="stu-card" onclick="showStudentPanel(\''+s.id+'\')"><div class="stu-info"><h4>'+s.name+'</h4><p>📚 '+(s.program||'—')+' · 🎯 '+s.level+'</p>'+(ri?'<p class="stu-rate">💰 '+ri+'</p>':'')+(s.review?'<p>💬 '+s.review+'</p>':'')+grpTag+'</div><div class="stu-actions" onclick="event.stopPropagation()"><button class="btn btn-primary btn-sm" onclick="openEditStudentModal(\''+s.id+'\')">✏️</button><button class="btn btn-outline btn-sm" onclick="openAssignModal(\''+s.id+'\')">👥</button><button class="btn btn-danger btn-sm" onclick="deleteStudent(\''+s.id+'\')">🗑</button></div></div>';
    }).join('');
}

async function saveStudent(e){e.preventDefault();syncUI('🔄 Lưu...');var obj={user_id:CONFIG.USER_ID,name:document.getElementById('s-name').value,program:document.getElementById('s-program').value,rate:parseInt(document.getElementById('s-rate').value)||0,rate_minutes:parseInt(document.getElementById('s-rate-minutes').value)||60,level:document.getElementById('s-level').value,review:document.getElementById('s-review').value,note:document.getElementById('s-note').value};var r=await db.from('students').insert(obj).select();if(r.error){alert('❌ '+r.error.message);syncUI('❌');return;}Store.students.push(r.data[0]);Store.buildColorMap();document.getElementById('student-form').reset();closeStudentModal();renderStudents();populateDropdown();syncUI('✅ Synced');}

async function saveEditStudent(e){
    e.preventDefault();
    openScopeModal(async function(scope){
        syncUI('🔄...');var id=document.getElementById('es-id').value;
        var updates={name:document.getElementById('es-name').value,program:document.getElementById('es-program').value,rate:parseInt(document.getElementById('es-rate').value)||0,rate_minutes:parseInt(document.getElementById('es-rate-minutes').value)||60,level:document.getElementById('es-level').value,review:document.getElementById('es-review').value,note:document.getElementById('es-note').value};
        var r=await db.from('students').update(updates).eq('id',id).select();
        if(r.error){alert('❌ '+r.error.message);syncUI('❌');return;}
        var idx=Store.students.findIndex(function(x){return x.id===id;});
        if(idx>=0&&r.data&&r.data[0])Store.students[idx]=r.data[0];
        closeEditStudentModal();renderStudents();populateDropdown();syncUI('✅ Synced');
    });
}

async function deleteStudent(id){if(!confirm('Xóa?'))return;syncUI('🔄...');await db.from('students').delete().eq('id',id);Store.students=Store.students.filter(function(s){return s.id!==id;});Store.buildColorMap();renderStudents();populateDropdown();syncUI('✅ Synced');}
async function confirmAssign(){var sel=document.getElementById('assign-group-select');var gid=sel.value||null;var sid=sel.dataset.studentId;syncUI('🔄...');await db.from('students').update({group_id:gid}).eq('id',sid);var stu=Store.students.find(function(s){return s.id===sid;});if(stu)stu.group_id=gid;closeAssignModal();renderStudents();renderGroups();syncUI('✅ Synced');}
function populateDropdown(){var sel=document.getElementById('f-student');sel.innerHTML='<option value="">-- Chọn --</option>'+Store.students.map(function(s){return'<option value="'+s.id+'">'+s.name+(s.rate?' ('+formatMoney(s.rate)+'/'+s.rate_minutes+'p)':'')+'</option>';}).join('');}
function populateGroupDropdown(){var sel=document.getElementById('f-group');sel.innerHTML='<option value="">-- Chọn nhóm --</option>'+Store.groups.map(function(g){return'<option value="'+g.id+'">'+g.name+(g.rate?' ('+formatMoney(g.rate)+'/'+g.rate_minutes+'p)':'')+'</option>';}).join('');}
