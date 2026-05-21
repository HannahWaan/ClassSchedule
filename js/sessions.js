var currentSessionType='individual';
function setSessionType(t){currentSessionType=t;document.getElementById('type-individual').classList.toggle('active',t==='individual');document.getElementById('type-group').classList.toggle('active',t==='group');document.getElementById('field-student').style.display=t==='individual'?'':'none';document.getElementById('field-group').style.display=t==='group'?'':'none';recalcFee();}

function recalcFee(){
    var start=document.getElementById('f-start').value,end=document.getElementById('f-end').value;
    if(!start||!end)return;var mins=timeDiffMinutes(start,end);
    if(mins<=0){document.getElementById('f-fee-display').textContent='0k';document.getElementById('f-fee-detail').textContent='Thời gian không hợp lệ';document.getElementById('f-fee').value='0';return;}
    var rate=0,rm=60;
    if(currentSessionType==='individual'){var sid=document.getElementById('f-student').value;var stu=Store.students.find(function(s){return s.id===sid;});if(stu){rate=stu.rate||0;rm=stu.rate_minutes||60;}}
    else{var gid=document.getElementById('f-group').value;var grp=Store.groups.find(function(g){return g.id===gid;});if(grp){rate=grp.rate||0;rm=grp.rate_minutes||60;}}
    var fee=calcFee(rate,rm,mins);
    document.getElementById('f-fee').value=fee;
    document.getElementById('f-fee-display').textContent=formatMoney(fee);
    document.getElementById('f-fee-detail').textContent=formatMoney(rate)+'/'+rm+'p × '+mins+' phút';
}

async function saveSession(e){
    e.preventDefault();syncUI('🔄 Lưu...');
    var sId=null,sName='',gId=null,gName='';
    if(currentSessionType==='individual'){sId=document.getElementById('f-student').value||null;var f=Store.students.find(function(s){return s.id===sId;});if(f)sName=f.name;}
    else{gId=document.getElementById('f-group').value||null;var f2=Store.groups.find(function(g){return g.id===gId;});if(f2)gName=f2.name;}
    // Get repeat config
    var repeatType=document.getElementById('f-repeat').value;
    var repeatInterval=1,repeatUnit='week',repeatDays='',repeatEnd='',repeatAfter=0;
    if(repeatType==='custom'){
        repeatInterval=parseInt(document.getElementById('f-repeat-interval').value)||1;
        repeatUnit=document.getElementById('f-repeat-unit').value;
        var checks=document.querySelectorAll('#repeat-days-row input:checked');
        repeatDays=Array.from(checks).map(function(c){return c.value;}).join(',');
        var endType=document.querySelector('input[name="repeat-end"]:checked');
        if(endType){
            if(endType.value==='date')repeatEnd=document.getElementById('f-repeat-end-date').value||'';
            else if(endType.value==='after')repeatAfter=parseInt(document.getElementById('f-repeat-after').value)||0;
        }
    }
    var fee=parseInt(document.getElementById('f-fee').value)||0;
    var obj={user_id:CONFIG.USER_ID,session_type:currentSessionType,student_id:sId,student_name:sName,group_id:gId,group_name:gName,lesson:document.getElementById('f-lesson').value,fee:fee,date:document.getElementById('f-date').value,start_time:document.getElementById('f-start').value,end_time:document.getElementById('f-end').value,color:document.getElementById('f-color').value||'c1',location:document.getElementById('f-location').value,repeat_type:repeatType,repeat_days:repeatDays,repeat_end:repeatEnd,reminder:parseInt(document.getElementById('f-reminder').value)||0,note:document.getElementById('f-note').value};
    var r=await db.from('sessions').insert(obj).select();
    if(r.error){alert('❌ '+r.error.message);syncUI('❌ Lỗi');return;}
    Store.sessions.push(r.data[0]);document.getElementById('session-form').reset();document.getElementById('f-date').valueAsDate=new Date();document.getElementById('f-fee-display').textContent='0k';document.getElementById('f-fee-detail').textContent='Chọn học viên/nhóm và thời gian';document.getElementById('repeat-options').style.display='none';pickFormColor('c1');switchTab('schedule');syncUI('✅ Synced');
}

// EDIT SESSION with scope
async function saveEditSession(e){
    e.preventDefault();
    openScopeModal(async function(scope){
        syncUI('🔄 Cập nhật...');
        var id=document.getElementById('e-id').value;
        var updates={lesson:document.getElementById('e-lesson').value,date:document.getElementById('e-date').value,start_time:document.getElementById('e-start').value,end_time:document.getElementById('e-end').value,location:document.getElementById('e-location').value,color:document.getElementById('e-color').value,repeat_type:document.getElementById('e-repeat').value,fee:parseInt(document.getElementById('e-fee').value)||0,note:document.getElementById('e-note').value};
        var r=await db.from('sessions').update(updates).eq('id',id).select();
        if(r.error){alert('❌ '+r.error.message);syncUI('❌ Lỗi');return;}
        var idx=Store.sessions.findIndex(function(x){return x.id===id;});
        if(idx>=0&&r.data&&r.data[0])Store.sessions[idx]=r.data[0];
        closeEditModal();renderCalendar();syncUI('✅ Synced');
    });
}

async function duplicateSession(id){
    var s=Store.sessions.find(function(x){return x.id===id;});if(!s)return;syncUI('🔄...');
    var obj={user_id:s.user_id,session_type:s.session_type,student_id:s.student_id,student_name:s.student_name,group_id:s.group_id,group_name:s.group_name,lesson:s.lesson+' (copy)',fee:s.fee,date:s.date,start_time:s.start_time,end_time:s.end_time,color:s.color||'c1',location:s.location||'',repeat_type:'none',reminder:s.reminder||0,note:s.note||''};
    var r=await db.from('sessions').insert(obj).select();
    if(r.error){alert('❌ '+r.error.message);syncUI('❌');return;}
    Store.sessions.push(r.data[0]);renderCalendar();syncUI('✅ Synced');
}

async function deleteSession(id){if(!confirm('Xóa buổi này?'))return;syncUI('🔄...');await db.from('sessions').delete().eq('id',id);Store.sessions=Store.sessions.filter(function(s){return s.id!==id;});renderCalendar();syncUI('✅ Synced');}
async function nukeData(){syncUI('🔄 Xóa...');await db.from('sessions').delete().eq('user_id',CONFIG.USER_ID);await db.from('students').delete().eq('user_id',CONFIG.USER_ID);await db.from('groups').delete().eq('user_id',CONFIG.USER_ID);Store.sessions=[];Store.students=[];Store.groups=[];closeNuke();renderWelcome();renderStudents();renderGroups();populateDropdown();populateGroupDropdown();renderCalendar();syncUI('✅ Đã xóa');}
