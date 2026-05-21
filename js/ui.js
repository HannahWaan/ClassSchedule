function switchTab(tab){document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});document.getElementById('page-'+tab).classList.add('active');document.querySelectorAll('.menu-item').forEach(function(m){m.classList.remove('active');});var link=document.querySelector('.menu-item[data-tab="'+tab+'"]');if(link)link.classList.add('active');var titles={welcome:'Chào mừng',schedule:'Lịch dạy','add-session':'Thêm buổi',stats:'Thống kê',students:'Học viên',groups:'Nhóm',profile:'Hồ sơ'};document.getElementById('topbar-title').textContent=titles[tab]||'';document.getElementById('sidebar').classList.remove('open');if(tab==='stats')renderStats('week');if(tab==='welcome')renderWelcome();if(tab==='students')renderStudents();if(tab==='groups')renderGroups();if(tab==='add-session'){populateDropdown();populateGroupDropdown();}}
function syncUI(t){document.getElementById('sync-status').textContent=t;}
function openStudentModal(){document.getElementById('modal-student').hidden=false;}
function closeStudentModal(){document.getElementById('modal-student').hidden=true;}
function openGroupModal(){initTagInput();document.getElementById('modal-group').hidden=false;}
function closeGroupModal(){document.getElementById('modal-group').hidden=true;}
function confirmNuke(){document.getElementById('modal-nuke').hidden=false;}
function closeNuke(){document.getElementById('modal-nuke').hidden=true;}
function openEditModal(id){
    var s=Store.sessions.find(function(x){return x.id===id;});if(!s)return;
    document.getElementById('e-id').value=s.id;
    document.getElementById('e-lesson').value=s.lesson||'';
    document.getElementById('e-date').value=s.date;
    document.getElementById('e-start').value=s.start_time;
    document.getElementById('e-end').value=s.end_time;
    document.getElementById('e-location').value=s.location||'';
    document.getElementById('e-fee').value=s.fee||0;
    document.getElementById('e-note').value=s.note||'';
    document.getElementById('e-repeat').value=s.repeat_type||'none';
    document.getElementById('e-color').value=s.color||Store.getColor(s);
    pickEditColor(s.color||Store.getColor(s));
    document.getElementById('modal-edit').hidden=false;
}
function closeEditModal(){document.getElementById('modal-edit').hidden=true;}
function openEditStudentModal(id){
    var s=Store.students.find(function(x){return x.id===id;});if(!s)return;
    document.getElementById('es-id').value=s.id;
    document.getElementById('es-name').value=s.name||'';
    document.getElementById('es-program').value=s.program||'';
    document.getElementById('es-rate').value=s.rate||0;
    document.getElementById('es-rate-minutes').value=s.rate_minutes||60;
    document.getElementById('es-level').value=s.level||'Beginner';
    document.getElementById('es-review').value=s.review||'';
    document.getElementById('es-note').value=s.note||'';
    document.getElementById('modal-edit-student').hidden=false;
}
function closeEditStudentModal(){document.getElementById('modal-edit-student').hidden=true;}
function openEditGroupModal(id){
    var g=Store.groups.find(function(x){return x.id===id;});if(!g)return;
    document.getElementById('eg-id').value=g.id;
    document.getElementById('eg-name').value=g.name||'';
    document.getElementById('eg-program').value=g.program||'';
    document.getElementById('eg-rate').value=g.rate||0;
    document.getElementById('eg-rate-minutes').value=g.rate_minutes||60;
    document.getElementById('eg-note').value=g.note||'';
    document.getElementById('modal-edit-group').hidden=false;
}
function closeEditGroupModal(){document.getElementById('modal-edit-group').hidden=true;}
function openAssignModal(studentId){var s=Store.students.find(function(x){return x.id===studentId;});if(!s)return;document.getElementById('assign-name').textContent='Gán nhóm cho: '+s.name;var sel=document.getElementById('assign-group-select');sel.innerHTML='<option value="">-- Không thuộc nhóm --</option>'+Store.groups.map(function(g){return'<option value="'+g.id+'"'+(s.group_id===g.id?' selected':'')+'>'+g.name+'</option>';}).join('');sel.dataset.studentId=studentId;document.getElementById('modal-assign').hidden=false;}
function closeAssignModal(){document.getElementById('modal-assign').hidden=true;}

// SCOPE CONFIRM MODAL
var pendingEditScope=null;
function openScopeModal(cb){pendingEditScope=cb;document.getElementById('modal-scope').hidden=false;}
function closeScopeModal(){document.getElementById('modal-scope').hidden=true;pendingEditScope=null;}
function scopeChoice(choice){if(pendingEditScope)pendingEditScope(choice);closeScopeModal();}

function openRightPanel(){var p=document.getElementById('right-panel');p.classList.remove('hidden');p.classList.add('open');}
function closeRightPanel(){var p=document.getElementById('right-panel');p.classList.add('hidden');p.classList.remove('open');}

// FORMAT: 300000 → "300k", 1500000 → "1,500k"
function formatMoney(n){
    var num=Number(n);if(!num)return '0k';
    var k=num/1000;
    if(k===Math.floor(k))return Math.floor(k).toLocaleString('vi-VN')+'k';
    return k.toLocaleString('vi-VN',{maximumFractionDigits:1})+'k';
}
function fmtISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDate(iso){var p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function fmtDateLong(iso){var d=new Date(iso+'T00:00:00');var days=['CN','T2','T3','T4','T5','T6','T7'];return days[d.getDay()]+', '+d.getDate()+' Thg'+(d.getMonth()+1)+' '+d.getFullYear();}
function timeDiff(s,e){var a=s.split(':'),b=e.split(':');return(parseInt(b[0])*60+parseInt(b[1])-parseInt(a[0])*60-parseInt(a[1]))/60;}
function timeDiffMinutes(s,e){var a=s.split(':'),b=e.split(':');return parseInt(b[0])*60+parseInt(b[1])-parseInt(a[0])*60-parseInt(a[1]);}
function getWeekStart(d){var r=new Date(d);var day=r.getDay();r.setDate(r.getDate()-day+(day===0?-6:1));r.setHours(0,0,0,0);return r;}
function isSameDay(a,b){return a.getDate()===b.getDate()&&a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();}
function calcFee(rate,rm,mins){if(!rate||!rm||!mins)return 0;return Math.round((rate/rm)*mins);}
function durationLabel(mins){if(mins<60)return mins+' phút';var h=Math.floor(mins/60);var m=mins%60;return h+' giờ'+(m?' '+m+' phút':'');}
function toggleRepeatOptions(){var v=document.getElementById('f-repeat').value;document.getElementById('repeat-options').style.display=(v==='custom')?'':'none';}
function pickFormColor(c){document.getElementById('f-color').value=c;document.querySelectorAll('#f-color-picker .cpick').forEach(function(b){b.classList.toggle('active',b.dataset.color===c);});}
function pickEditColor(c){document.getElementById('e-color').value=c;document.querySelectorAll('#e-color-picker .cpick').forEach(function(b){b.classList.toggle('active',b.dataset.color===c);});}
