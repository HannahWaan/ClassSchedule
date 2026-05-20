var currentSessionType = 'individual', quickSessionType = 'individual';
function setSessionType(t) { currentSessionType=t; document.getElementById('type-individual').classList.toggle('active',t==='individual'); document.getElementById('type-group').classList.toggle('active',t==='group'); document.getElementById('field-student').style.display=t==='individual'?'':'none'; document.getElementById('field-group').style.display=t==='group'?'':'none'; recalcFee(); }
function setQuickType(t) { quickSessionType=t; document.getElementById('q-type-ind').classList.toggle('active',t==='individual'); document.getElementById('q-type-grp').classList.toggle('active',t==='group'); document.getElementById('q-field-student').style.display=t==='individual'?'':'none'; document.getElementById('q-field-group').style.display=t==='group'?'':'none'; recalcQuickFee(); }

function recalcFee() {
    var start=document.getElementById('f-start').value, end=document.getElementById('f-end').value;
    if(!start||!end)return; var mins=timeDiffMinutes(start,end);
    if(mins<=0){document.getElementById('f-fee-display').textContent='0đ';document.getElementById('f-fee-detail').textContent='Thời gian không hợp lệ';document.getElementById('f-fee').value='0';return;}
    var rate=0,rm=60;
    if(currentSessionType==='individual'){var sid=document.getElementById('f-student').value;var stu=Store.students.find(function(s){return s.id===sid;});if(stu){rate=stu.rate||0;rm=stu.rate_minutes||60;}}
    else{var gid=document.getElementById('f-group').value;var grp=Store.groups.find(function(g){return g.id===gid;});if(grp){rate=grp.rate||0;rm=grp.rate_minutes||60;}}
    var fee=calcFee(rate,rm,mins); document.getElementById('f-fee').value=fee; document.getElementById('f-fee-display').textContent=formatMoney(fee); document.getElementById('f-fee-detail').textContent=formatMoney(rate)+'/'+rm+'p × '+mins+' phút';
}
function recalcQuickFee() {
    var start=document.getElementById('q-start').value, end=document.getElementById('q-end').value;
    if(!start||!end)return; var mins=timeDiffMinutes(start,end); if(mins<=0){document.getElementById('q-fee-display').textContent='0đ';document.getElementById('q-fee').value='0';return;}
    var rate=0,rm=60;
    if(quickSessionType==='individual'){var sid=document.getElementById('q-student').value;var stu=Store.students.find(function(s){return s.id===sid;});if(stu){rate=stu.rate||0;rm=stu.rate_minutes||60;}}
    else{var gid=document.getElementById('q-group').value;var grp=Store.groups.find(function(g){return g.id===gid;});if(grp){rate=grp.rate||0;rm=grp.rate_minutes||60;}}
    var fee=calcFee(rate,rm,mins); document.getElementById('q-fee').value=fee; document.getElementById('q-fee-display').textContent=formatMoney(fee);
}

async function saveSession(e) {
    e.preventDefault(); syncUI('🔄 Lưu...');
    var sId=null,sName='',gId=null,gName='';
    if(currentSessionType==='individual'){sId=document.getElementById('f-student').value||null;var f=Store.students.find(function(s){return s.id===sId;});if(f)sName=f.name;}
    else{gId=document.getElementById('f-group').value||null;var f2=Store.groups.find(function(g){return g.id===gId;});if(f2)gName=f2.name;}
    var obj={user_id:CONFIG.USER_ID,session_type:currentSessionType,student_id:sId,student_name:sName,group_id:gId,group_name:gName,lesson:document.getElementById('f-lesson').value,fee:parseInt(document.getElementById('f-fee').value)||0,date:document.getElementById('f-date').value,start_time:document.getElementById('f-start').value,end_time:document.getElementById('f-end').value,location:document.getElementById('f-location').value,repeat_type:document.getElementById('f-repeat').value,reminder:parseInt(document.getElementById('f-reminder').value)||0,note:document.getElementById('f-note').value};
    var r=await db.from('sessions').insert(obj).select();
    if(r.error){alert('❌ '+r.error.message);syncUI('❌ Lỗi');return;}
    Store.sessions.push(r.data[0]); document.getElementById('session-form').reset(); document.getElementById('f-date').valueAsDate=new Date(); document.getElementById('f-fee-display').textContent='0đ'; document.getElementById('f-fee-detail').textContent='Chọn học viên/nhóm và thời gian để tính'; switchTab('schedule'); syncUI('✅ Synced');
}
async function saveQuickSession(e) {
    e.preventDefault(); syncUI('🔄 Lưu...');
    var sId=null,sName='',gId=null,gName='';
    if(quickSessionType==='individual'){sId=document.getElementById('q-student').value||null;var f=Store.students.find(function(s){return s.id===sId;});if(f)sName=f.name;}
    else{gId=document.getElementById('q-group').value||null;var f2=Store.groups.find(function(g){return g.id===gId;});if(f2)gName=f2.name;}
    var obj={user_id:CONFIG.USER_ID,session_type:quickSessionType,student_id:sId,student_name:sName,group_id:gId,group_name:gName,lesson:document.getElementById('q-lesson').value,fee:parseInt(document.getElementById('q-fee').value)||0,date:document.getElementById('q-date').value,start_time:document.getElementById('q-start').value,end_time:document.getElementById('q-end').value,note:''};
    var r=await db.from('sessions').insert(obj).select();
    if(r.error){alert('❌ '+r.error.message);syncUI('❌ Lỗi');return;}
    Store.sessions.push(r.data[0]); document.getElementById('quick-form').reset(); closeQuickModal(); renderCalendar(); syncUI('✅ Synced');
}
async function deleteSession(id) { if(!confirm('Xóa buổi này?'))return; syncUI('🔄...'); await db.from('sessions').delete().eq('id',id); Store.sessions=Store.sessions.filter(function(s){return s.id!==id;}); renderCalendar(); syncUI('✅ Synced'); }
async function nukeData() { syncUI('🔄 Xóa...'); await db.from('sessions').delete().eq('user_id',CONFIG.USER_ID); await db.from('students').delete().eq('user_id',CONFIG.USER_ID); await db.from('groups').delete().eq('user_id',CONFIG.USER_ID); Store.sessions=[];Store.students=[];Store.groups=[]; closeNuke(); renderWelcome();renderStudents();renderGroups();populateDropdown();populateGroupDropdown();renderCalendar(); syncUI('✅ Đã xóa'); }
