function renderWelcome(){
    var now=new Date();document.getElementById('w-students').textContent=Store.students.length;
    var ws=getWeekStart(now);var we=new Date(ws);we.setDate(we.getDate()+7);
    var wk=Store.sessions.filter(function(s){var d=new Date(s.date);return d>=ws&&d<we;});
    document.getElementById('w-week').textContent=wk.length;
    document.getElementById('w-salary').textContent=formatMoney(Store.sessions.reduce(function(a,s){return a+(Number(s.fee)||0);},0));
    var mo=Store.sessions.filter(function(s){var d=new Date(s.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
    var hrs=0;mo.forEach(function(s){if(s.start_time&&s.end_time)hrs+=timeDiff(s.start_time,s.end_time);});
    document.getElementById('w-hours').textContent=hrs.toFixed(1)+'h';
    var up=Store.sessions.filter(function(s){return new Date(s.date+'T'+s.start_time)>=new Date(now.getTime()-86400000);}).sort(function(a,b){return(a.date+a.start_time).localeCompare(b.date+b.start_time);}).slice(0,5);
    var el=document.getElementById('upcoming-list');
    if(!up.length)el.innerHTML='<p class="muted">Chưa có buổi dạy nào.</p>';
    else el.innerHTML=up.map(function(s){var icon=s.session_type==='group'?'👥':'👤';return'<div class="s-item"><div class="s-item-info"><strong>'+icon+' '+s.lesson+'</strong><span>'+(s.student_name||s.group_name||'')+' · '+fmtDate(s.date)+' · '+s.start_time.slice(0,5)+'–'+s.end_time.slice(0,5)+'</span></div></div>';}).join('');
    document.getElementById('welcome-name').textContent=Store.profile.full_name||'Giáo viên';
    document.getElementById('profile-display-name').textContent=Store.profile.full_name||'Giáo viên';
}
document.addEventListener('DOMContentLoaded',async function(){
    syncUI('🔄 Loading...');await Store.load();
    setTheme(Store.profile.theme||'dark');setFont(Store.profile.font||"'Be Vietnam Pro',sans-serif");
    document.getElementById('p-font').value=Store.profile.font||"'Be Vietnam Pro',sans-serif";
    document.getElementById('p-name').value=Store.profile.full_name||'';
    document.getElementById('f-date').valueAsDate=new Date();
    renderWelcome();renderStudents();renderGroups();populateDropdown();populateGroupDropdown();renderCalendar();
    closeRightPanel();syncUI('✅ Synced');

    document.querySelectorAll('.menu-item').forEach(function(m){m.addEventListener('click',function(e){e.preventDefault();switchTab(m.dataset.tab);});});
    document.querySelectorAll('.vtab[data-view]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.vtab[data-view]').forEach(function(x){x.classList.remove('active');});b.classList.add('active');calView=b.dataset.view;renderCalendar();});});
    document.querySelectorAll('.vtab[data-period]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('.vtab[data-period]').forEach(function(x){x.classList.remove('active');});b.classList.add('active');renderStats(b.dataset.period);});});
    document.getElementById('nav-prev').addEventListener('click',function(){navCal(-1);});
    document.getElementById('nav-next').addEventListener('click',function(){navCal(1);});
    document.getElementById('nav-today').addEventListener('click',function(){calDate=new Date();renderCalendar();});

    document.getElementById('session-form').addEventListener('submit',saveSession);
    document.getElementById('student-form').addEventListener('submit',saveStudent);
    document.getElementById('group-form').addEventListener('submit',saveGroup);
    document.getElementById('edit-form').addEventListener('submit',saveEditSession);
    document.getElementById('edit-student-form').addEventListener('submit',saveEditStudent);
    document.getElementById('edit-group-form').addEventListener('submit',saveEditGroup);

    ['f-start','f-end','f-student','f-group'].forEach(function(id){var el=document.getElementById(id);if(el)el.addEventListener('change',recalcFee);});
    document.getElementById('g-search').addEventListener('input',handleTagSearch);
    document.getElementById('hamburger').addEventListener('click',function(){document.getElementById('sidebar').classList.toggle('open');});
    document.querySelector('.page-wrap').addEventListener('click',function(){document.getElementById('sidebar').classList.remove('open');});
    document.addEventListener('click',function(){hideCtx();});
});


/* ===== NOTION DATA INTEGRATION ===== */
let notionSessions = [];

async function loadNotionData() {
  try {
    notionSessions = await NotionSync.fetchAll();
    updateDashboardWithNotion();
    if (typeof syncUI === 'function') syncUI('Notion synced');
  } catch (e) {
    console.warn('Notion load failed:', e);
    if (typeof syncUI === 'function') syncUI('Notion offline');
  }
}

function getMergedSessions() {
  const localMapped = (Store.sessions || []).map(s => ({
    id: s.id, name: s.student_name || s.group_name || '',
    date: s.date + 'T' + (s.start_time || '00:00'),
    dateEnd: s.date + 'T' + (s.end_time || '00:00'),
    student: s.student_name || '', fee: s.fee || 0,
    duration: (typeof timeDiffMinutes === 'function') ? timeDiffMinutes(s.start_time, s.end_time) : 0,
    status: s.done ? 'Done' : 'Not started',
    type: s.type || 'individual', color: s.color || 'c1',
    note: s.note || '', source: 'local'
  }));
  const all = [...localMapped, ...notionSessions];
  const map = new Map();
  all.forEach(s => map.set(s.id, s));
  return [...map.values()];
}

function updateDashboardWithNotion() {
  const all = getMergedSessions();
  const revenue = NotionSync.calcRevenue(all, 'month');
  const minutes = NotionSync.calcMinutes(all, 'month');
  const hours = Math.floor(minutes / 60);
  const students = NotionSync.uniqueStudents(all).length;
  const weekSessions = NotionSync.countSessions(all, 'week');
  const upcomingList = NotionSync.upcoming(all, 5);

  // Cap nhat cac element co san trong welcome page
  const el = (id) => document.getElementById(id);
  if (el('w-students')) el('w-students').textContent = students;
  if (el('w-week')) el('w-week').textContent = weekSessions;
  if (el('w-salary')) el('w-salary').textContent = (revenue / 1000) + 'k';
  if (el('w-hours')) el('w-hours').textContent = hours + 'h';

  // Cap nhat upcoming list
  if (el('upcoming-list')) {
    if (upcomingList.length === 0) {
      el('upcoming-list').innerHTML = '<p class="muted">Khong co buoi day sap toi.</p>';
    } else {
      el('upcoming-list').innerHTML = upcomingList.map(s => {
        const d = new Date(s.date);
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
        const fee = (s.fee / 1000) + 'k';
        return '<div class="upcoming-item"><span class="upcoming-time">' + date + ' ' + time + '</span><span class="upcoming-name">' + (s.name || s.student) + '</span><span class="upcoming-fee">' + fee + '</span></div>';
      }).join('');
    }
  }
}

// Load Notion data sau khi app khoi dong
setTimeout(loadNotionData, 1000);
// Auto refresh moi 2 phut
setInterval(function() { loadNotionData(); }, 120000);
