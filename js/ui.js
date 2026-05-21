function switchTab(tab){document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});document.getElementById('page-'+tab).classList.add('active');document.querySelectorAll('.menu-item').forEach(function(m){m.classList.remove('active');});var link=document.querySelector('.menu-item[data-tab="'+tab+'"]');if(link)link.classList.add('active');var titles={welcome:'Chào mừng',schedule:'Lịch dạy','add-session':'Thêm buổi',stats:'Thống kê',students:'Học viên',groups:'Nhóm',profile:'Hồ sơ'};document.getElementById('header-title').textContent=titles[tab]||'';document.getElementById('sidebar').classList.remove('open');if(tab==='schedule')renderCalendar();if(tab==='stats')renderStats('week');if(tab==='welcome')renderWelcome();if(tab==='students')renderStudents();if(tab==='groups')renderGroups();if(tab==='add-session'){populateDropdown();populateGroupDropdown();}}
function syncUI(t){document.getElementById('sync-status').textContent=t;}
function openStudentModal(){document.getElementById('modal-student').hidden=false;}
function closeStudentModal(){document.getElementById('modal-student').hidden=true;}
function openGroupModal(){initTagInput();document.getElementById('modal-group').hidden=false;}
function closeGroupModal(){document.getElementById('modal-group').hidden=true;}
function confirmNuke(){document.getElementById('modal-nuke').hidden=false;}
function closeNuke(){document.getElementById('modal-nuke').hidden=true;}
function closeQuickModal(){document.getElementById('modal-quick').hidden=true;}
function openAssignModal(studentId){var s=Store.students.find(function(x){return x.id===studentId;});if(!s)return;document.getElementById('assign-name').textContent='Gán nhóm cho: '+s.name;var sel=document.getElementById('assign-group-select');sel.innerHTML='<option value="">-- Không thuộc nhóm --</option>'+Store.groups.map(function(g){return'<option value="'+g.id+'"'+(s.group_id===g.id?' selected':'')+'>'+g.name+'</option>';}).join('');sel.dataset.studentId=studentId;document.getElementById('modal-assign').hidden=false;}
function closeAssignModal(){document.getElementById('modal-assign').hidden=true;}

function openRightPanel(){var p=document.getElementById('right-panel');p.classList.remove('hidden');p.classList.add('open');}
function closeRightPanel(){var p=document.getElementById('right-panel');p.classList.add('hidden');p.classList.remove('open');}

function formatMoney(n){return Number(n).toLocaleString('vi-VN')+'đ';}
function fmtISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fmtDate(iso){var p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
function fmtDateLong(iso){var d=new Date(iso+'T00:00:00');var days=['CN','T2','T3','T4','T5','T6','T7'];return days[d.getDay()]+', '+d.getDate()+' Thg'+(d.getMonth()+1)+' '+d.getFullYear();}
function timeDiff(s,e){var a=s.split(':'),b=e.split(':');return(parseInt(b[0])*60+parseInt(b[1])-parseInt(a[0])*60-parseInt(a[1]))/60;}
function timeDiffMinutes(s,e){var a=s.split(':'),b=e.split(':');return parseInt(b[0])*60+parseInt(b[1])-parseInt(a[0])*60-parseInt(a[1]);}
function getWeekStart(d){var r=new Date(d);var day=r.getDay();r.setDate(r.getDate()-day+(day===0?-6:1));r.setHours(0,0,0,0);return r;}
function isSameDay(a,b){return a.getDate()===b.getDate()&&a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();}
function calcFee(rate,rm,mins){if(!rate||!rm||!mins)return 0;return Math.round((rate/rm)*mins);}
function durationLabel(mins){if(mins<60)return mins+' phút';var h=Math.floor(mins/60);var m=mins%60;return h+' giờ'+(m?' '+m+' phút':'');}
