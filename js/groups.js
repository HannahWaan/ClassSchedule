var tagMembers=[];
function initTagInput(){tagMembers=[];document.getElementById('g-chips').innerHTML='';document.getElementById('g-search').value='';document.getElementById('g-dropdown').classList.remove('open');}
function handleTagSearch(){var q=document.getElementById('g-search').value.toLowerCase();var dd=document.getElementById('g-dropdown');if(!q){dd.classList.remove('open');return;}var results=Store.students.filter(function(s){return s.name.toLowerCase().includes(q)&&tagMembers.indexOf(s.id)===-1;});if(!results.length){dd.classList.remove('open');return;}dd.innerHTML=results.map(function(s){return'<div class="tag-option" onclick="addTagMember(\''+s.id+'\')"><span>'+s.name+'</span><span class="to-prog">'+(s.program||'')+'</span></div>';}).join('');dd.classList.add('open');}
function addTagMember(id){if(tagMembers.indexOf(id)>=0)return;tagMembers.push(id);var s=Store.students.find(function(x){return x.id===id;});if(!s)return;document.getElementById('g-chips').innerHTML+=('<div class="tag-chip" data-id="'+id+'">'+s.name+' <span class="tag-chip-x" onclick="removeTagMember(\''+id+'\')">✕</span></div>');document.getElementById('g-search').value='';document.getElementById('g-dropdown').classList.remove('open');}
function removeTagMember(id){tagMembers=tagMembers.filter(function(x){return x!==id;});var chip=document.querySelector('.tag-chip[data-id="'+id+'"]');if(chip)chip.remove();}

async function saveGroup(e){e.preventDefault();syncUI('🔄 Lưu...');var obj={user_id:CONFIG.USER_ID,name:document.getElementById('g-name').value,program:document.getElementById('g-program').value,rate:parseInt(document.getElementById('g-rate').value)||0,rate_minutes:parseInt(document.getElementById('g-rate-minutes').value)||60,note:document.getElementById('g-note').value};var r=await db.from('groups').insert(obj).select();if(r.error){alert('❌ '+r.error.message);syncUI('❌');return;}var grp=r.data[0];Store.groups.push(grp);Store.buildColorMap();for(var i=0;i<tagMembers.length;i++){await db.from('students').update({group_id:grp.id}).eq('id',tagMembers[i]);var stu=Store.students.find(function(x){return x.id===tagMembers[i];});if(stu)stu.group_id=grp.id;}document.getElementById('group-form').reset();initTagInput();closeGroupModal();renderGroups();renderStudents();populateGroupDropdown();syncUI('✅ Synced');}

async function saveEditGroup(e){
    e.preventDefault();
    openScopeModal(async function(scope){
        syncUI('🔄...');var id=document.getElementById('eg-id').value;
        var updates={name:document.getElementById('eg-name').value,program:document.getElementById('eg-program').value,rate:parseInt(document.getElementById('eg-rate').value)||0,rate_minutes:parseInt(document.getElementById('eg-rate-minutes').value)||60,note:document.getElementById('eg-note').value};
        var r=await db.from('groups').update(updates).eq('id',id).select();
        if(r.error){alert('❌ '+r.error.message);syncUI('❌');return;}
        var idx=Store.groups.findIndex(function(x){return x.id===id;});
        if(idx>=0&&r.data&&r.data[0])Store.groups[idx]=r.data[0];
        closeEditGroupModal();renderGroups();populateGroupDropdown();syncUI('✅ Synced');
    });
}

async function deleteGroup(id){if(!confirm('Xóa nhóm?'))return;syncUI('🔄...');await db.from('groups').delete().eq('id',id);Store.groups=Store.groups.filter(function(g){return g.id!==id;});Store.students.forEach(function(s){if(s.group_id===id)s.group_id=null;});Store.buildColorMap();renderGroups();renderStudents();populateGroupDropdown();syncUI('✅ Synced');}

function renderGroups(){
    var el=document.getElementById('groups-root');
    if(!Store.groups.length){el.innerHTML='<p class="muted">Chưa có nhóm nào.</p>';return;}
    el.innerHTML=Store.groups.map(function(g){
        var members=Store.students.filter(function(s){return s.group_id===g.id;});
        var ri=g.rate?formatMoney(g.rate)+'/'+g.rate_minutes+'p':'';
        return '<div class="group-card" onclick="showGroupPanel(\''+g.id+'\')"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h4>'+g.name+'</h4><p>📚 '+(g.program||'—')+'</p>'+(ri?'<p style="color:var(--success);font-size:.82rem;font-weight:600">💰 '+ri+'</p>':'')+'<div class="group-members">'+members.map(function(m){return'<span class="group-member-tag">'+m.name+'</span>';}).join('')+'</div></div><div onclick="event.stopPropagation()" style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" onclick="openEditGroupModal(\''+g.id+'\')">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteGroup(\''+g.id+'\')">🗑</button></div></div></div>';
    }).join('');
}
