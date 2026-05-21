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




/* ===== GOOGLE CALENDAR + NOTION INTEGRATION ===== */
let gcalEvents = [];
let notionSessions = [];

async function loadAllExternalData() {
  try {
    const [gcal, notion] = await Promise.allSettled([
      GCalSync.fetchEvents(),
      (typeof NotionSync !== 'undefined') ? NotionSync.fetchAll() : Promise.resolve([])
    ]);
    if (gcal.status === 'fulfilled') gcalEvents = gcal.value;
    if (notion.status === 'fulfilled') notionSessions = notion.value;
    updateDashboard();
    updateStats();
    renderStudents();
    renderGroups();
    if (typeof syncUI === 'function') syncUI('Synced');
  } catch (e) {
    console.warn('External data load failed:', e);
    if (typeof syncUI === 'function') syncUI('Offline');
  }
}

function getAllSessions() {
  const localMapped = (Store.sessions || []).map(s => ({
    id: s.id, name: s.student_name || s.group_name || '',
    date: s.date + 'T' + (s.start_time || '00:00'),
    dateEnd: s.date + 'T' + (s.end_time || '00:00'),
    student: s.student_name || '', fee: s.fee || 0,
    duration: (typeof timeDiffMinutes === 'function') ? timeDiffMinutes(s.start_time, s.end_time) : 0,
    status: s.done ? 'Done' : 'Not started', type: s.type || 'individual',
    color: s.color || 'c1', note: s.note || '', source: 'local'
  }));
  const all = [...localMapped, ...gcalEvents, ...notionSessions];
  const map = new Map(); all.forEach(s => map.set(s.id, s));
  return [...map.values()];
}

function updateDashboard() {
  const all = getAllSessions();
  const revenue = GCalSync.calcRevenue(all, 'month');
  const minutes = GCalSync.calcMinutes(all, 'month');
  const hours = Math.floor(minutes / 60);
  const students = GCalSync.uniqueStudents(all).length;
  const weekSessions = GCalSync.countSessions(all, 'week');
  const upcomingList = GCalSync.upcoming(all, 5);

  const el = (id) => document.getElementById(id);
  if (el('w-students')) el('w-students').textContent = students;
  if (el('w-week')) el('w-week').textContent = weekSessions;
  if (el('w-salary')) el('w-salary').textContent = Math.round(revenue / 1000) + 'k';
  if (el('w-hours')) el('w-hours').textContent = hours + 'h';

  if (el('upcoming-list')) {
    if (upcomingList.length === 0) {
      el('upcoming-list').innerHTML = '<p class="muted">Không có buổi dạy sắp tới.</p>';
    } else {
      el('upcoming-list').innerHTML = upcomingList.map(s => {
        const d = new Date(s.date);
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' });
        const fee = Math.round((s.fee || 0) / 1000) + 'k';
        return '<div class="upcoming-item"><span class="upcoming-time">' + date + ' ' + time + '</span><span class="upcoming-name">' + (s.name || s.student) + '</span><span class="upcoming-fee">' + fee + '</span></div>';
      }).join('');
    }
  }
}

function updateStats(period) {
  period = period || document.querySelector('.ptab.active')?.dataset?.period || 'month';
  const all = getAllSessions();
  const filtered = GCalSync.filterByPeriod(all, period);
  const done = filtered.filter(s => s.status === 'Done');
  const revenue = done.reduce((sum, s) => sum + (s.fee || 0), 0);
  const minutes = done.reduce((sum, s) => sum + (s.duration || 0), 0);
  const students = [...new Set(filtered.map(s => s.student).filter(Boolean))].length;
  const avg = done.length > 0 ? Math.round(revenue / done.length / 1000) : 0;

  const el = (id) => document.getElementById(id);
  if (el('st-total')) el('st-total').textContent = filtered.length;
  if (el('st-done')) el('st-done').textContent = done.length;
  if (el('st-students')) el('st-students').textContent = students;
  if (el('st-revenue')) el('st-revenue').textContent = Math.round(revenue / 1000) + 'k';
  if (el('st-hours')) el('st-hours').textContent = Math.floor(minutes / 60) + 'h';
  if (el('st-avg')) el('st-avg').textContent = avg + 'k';

  // Chi tiet theo hoc vien
  if (el('stats-detail')) {
    const studentMap = new Map();
    done.forEach(s => {
      if (!s.student) return;
      if (!studentMap.has(s.student)) studentMap.set(s.student, { count: 0, fee: 0, min: 0 });
      const st = studentMap.get(s.student);
      st.count++; st.fee += s.fee || 0; st.min += s.duration || 0;
    });
    const rows = [...studentMap.entries()].sort((a,b) => b[1].fee - a[1].fee);
    if (rows.length === 0) {
      el('stats-detail').innerHTML = '<p class="muted">Chưa có dữ liệu.</p>';
    } else {
      el('stats-detail').innerHTML = rows.map(([name, d]) =>
        '<div class="stats-student-row"><span class="stats-student-name">' + name + '</span><span class="stats-student-info">' + d.count + ' buổi · ' + Math.round(d.fee/1000) + 'k · ' + Math.floor(d.min/60) + 'h</span></div>'
      ).join('');
    }
  }
}

// Period tabs
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.ptab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      updateStats(this.dataset.period);
    });
  });
});

setTimeout(loadAllExternalData, 800);
setInterval(loadAllExternalData, 120000);
