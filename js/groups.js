var selectedMembers = [];

function initTagInput(){
    selectedMembers = [];
    document.getElementById('g-chips').innerHTML = '';
    document.getElementById('g-search').value = '';
    document.getElementById('g-dropdown').classList.remove('open');
    var search = document.getElementById('g-search');
    search.removeEventListener('input', handleTagSearch);
    search.addEventListener('input', handleTagSearch);
    search.removeEventListener('focus', handleTagFocus);
    search.addEventListener('focus', handleTagFocus);
    document.addEventListener('click', function(e){
        if(!document.getElementById('g-tag-wrap').contains(e.target)){
            document.getElementById('g-dropdown').classList.remove('open');
        }
    });
}

function handleTagFocus(){ showTagDropdown(document.getElementById('g-search').value); }
function handleTagSearch(e){ showTagDropdown(e.target.value); }

function showTagDropdown(query){
    var dd = document.getElementById('g-dropdown');
    var q = query.toLowerCase().trim();
    var available = Store.students.filter(function(s){
        return selectedMembers.indexOf(s.id) === -1 && (q === '' || s.name.toLowerCase().indexOf(q) !== -1);
    });
    if(!available.length){ dd.innerHTML='<div class="tag-option" style="color:var(--text3)">Không tìm thấy</div>'; dd.classList.add('open'); return; }
    dd.innerHTML = available.map(function(s){
        return '<div class="tag-option" onclick="addTagMember(\''+s.id+'\')"><span>'+s.name+'</span><span class="to-prog">'+(s.program||'')+'</span></div>';
    }).join('');
    dd.classList.add('open');
}

function addTagMember(id){
    if(selectedMembers.indexOf(id)!==-1) return;
    selectedMembers.push(id);
    renderChips();
    document.getElementById('g-search').value='';
    document.getElementById('g-dropdown').classList.remove('open');
}

function removeTagMember(id){
    selectedMembers = selectedMembers.filter(function(x){return x!==id;});
    renderChips();
}

function renderChips(){
    var el=document.getElementById('g-chips');
    el.innerHTML = selectedMembers.map(function(id){
        var s=Store.students.find(function(x){return x.id===id;});
        if(!s) return '';
        return '<span class="tag-chip">'+s.name+'<span class="tag-chip-x" onclick="removeTagMember(\''+id+'\')">✕</span></span>';
    }).join('');
}

function renderGroups(){
    var el=document.getElementById('groups-root');
    if(!Store.groups.length){el.innerHTML='<p class="muted">Chưa có nhóm nào.</p>';return;}
    el.innerHTML=Store.groups.map(function(g){
        var members=Store.students.filter(function(s){return s.group_id===g.id;});
        return '<div class="group-card"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div><h4>👥 '+g.name+'</h4><p>📚 '+(g.program||'—')+' · 💰 '+formatMoney(g.rate)+'/'+g.rate_minutes+'p (nhóm)</p>'+(g.note?'<p>📝 '+g.note+'</p>':'')+'<div class="group-members">'+members.map(function(m){return'<span class="group-member-tag">'+m.name+'</span>';}).join('')+(members.length===0?'<span class="muted">Chưa có thành viên</span>':'')+'</div></div><button class="btn btn-danger btn-sm" onclick="deleteGroup(\''+g.id+'\')">🗑</button></div></div>';
    }).join('');
}

async function saveGroup(e){
    e.preventDefault();syncUI('🔄 Lưu...');
    var obj={user_id:CONFIG.USER_ID,name:document.getElementById('g-name').value,program:document.getElementById('g-program').value,rate:parseInt(document.getElementById('g-rate').value)||0,rate_minutes:parseInt(document.getElementById('g-rate-minutes').value)||60,note:document.getElementById('g-note').value};
    var r=await db.from('groups').insert(obj).select();
    if(r.error){alert('❌ '+r.error.message);syncUI('❌');return;}
    var ng=r.data[0];Store.groups.push(ng);Store.buildColorMap();
    for(var i=0;i<selectedMembers.length;i++){
        var sid=selectedMembers[i];
        await db.from('students').update({group_id:ng.id}).eq('id',sid);
        var stu=Store.students.find(function(s){return s.id===sid;});
        if(stu)stu.group_id=ng.id;
    }
    selectedMembers=[];
    document.getElementById('group-form').reset();
    document.getElementById('g-chips').innerHTML='';
    closeGroupModal();renderGroups();populateGroupDropdown();renderStudents();syncUI('✅ Synced');
}

async function deleteGroup(id){if(!confirm('Xóa nhóm?'))return;syncUI('🔄...');await db.from('students').update({group_id:null}).eq('group_id',id);Store.students.forEach(function(s){if(s.group_id===id)s.group_id=null;});await db.from('groups').delete().eq('id',id);Store.groups=Store.groups.filter(function(g){return g.id!==id;});Store.buildColorMap();renderGroups();populateGroupDropdown();renderStudents();syncUI('✅ Synced');}
