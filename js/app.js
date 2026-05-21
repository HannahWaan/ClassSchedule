/* ===== APP.JS - OAuth only, no API key ===== */

/* ---- Utility: filterByPeriod (moved from GCalSync) ---- */
function filterByPeriod(sessions, period) {
  var now = new Date(), start, end;
  switch (period) {
    case 'today': start = new Date(now.getFullYear(),now.getMonth(),now.getDate()); end = new Date(start.getTime()+86400000); break;
    case 'week': var day=now.getDay()||7; start=new Date(now); start.setDate(now.getDate()-day+1); start.setHours(0,0,0,0); end=new Date(start.getTime()+7*86400000); break;
    case 'month': start=new Date(now.getFullYear(),now.getMonth(),1); end=new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59); break;
    case 'year': start=new Date(now.getFullYear(),0,1); end=new Date(now.getFullYear(),11,31,23,59,59); break;
    default: return sessions;
  }
  return sessions.filter(function(s){var d=new Date(s.date);return d>=start&&d<=end;});
}

/* ---- Fetch events via OAuth ---- */
var _eventsCache = [];
var _eventsCacheTime = 0;
var CACHE_TTL = 60000;

async function fetchGCalEvents(forceRefresh) {
  if (!forceRefresh && _eventsCache.length && Date.now() - _eventsCacheTime < CACHE_TTL) return _eventsCache;

  var token = localStorage.getItem('gcal_token');
  var expiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0');
  if (!token || Date.now() > expiry) {
    console.warn('No valid OAuth token for fetching events');
    return _eventsCache;
  }

  var now = new Date();
  var min = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  var max = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

  var params = new URLSearchParams({
    timeMin: min, timeMax: max,
    singleEvents: 'true', orderBy: 'startTime',
    timeZone: 'Asia/Ho_Chi_Minh', maxResults: '2500'
  });
  var url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent('asstrayca@gmail.com') + '/events?' + params.toString();

  try {
    var res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.status === 401) { console.warn('Token expired during fetch'); return _eventsCache; }
    var data = await res.json();
    if (data.error) { console.warn('GCal error:', data.error.message); return _eventsCache; }
    _eventsCache = (data.items || []).map(parseGCalEvent);
    _eventsCacheTime = Date.now();
    console.log('OAuth fetch: ' + _eventsCache.length + ' events');
    return _eventsCache;
  } catch(e) { console.warn('Fetch error:', e); return _eventsCache; }
}

function parseGCalEvent(ev) {
  var start = ev.start?.dateTime || ev.start?.date || '';
  var end = ev.end?.dateTime || ev.end?.date || '';
  var title = ev.summary || '';
  var note = ev.description || '';
  var duration = 0;
  if (start && end) duration = Math.round((new Date(end) - new Date(start)) / 60000);
  var student = '', type = 'individual', fee = 0;
  if (/group|nhóm|nhom/i.test(title)) type = 'group';
  
  student = title;
  var feeMatch = note.match(/(?:fee|học phí|hoc phi|gia)[:\s]*(\d+)/i);
  if (feeMatch) { fee = parseInt(feeMatch[1]); if (fee < 1000) fee *= 1000; }
  if (!fee) { var kMatch = note.match(/(\d+)k/i); if (kMatch) fee = parseInt(kMatch[1]) * 1000; }
  return {
    id: ev.id, name: title, date: start, dateEnd: end, student: student, fee: fee, duration: duration,
    status: new Date(end) < new Date() ? 'Done' : 'Not started',
    type: type, color: ev.colorId||'default', note: note, location: ev.location||'', source:'gcal',
    recurringEventId: ev.recurringEventId || null
  };
}

/* ---- GCalSync compatibility layer (so students.js still works) ---- */
var GCalSync = {
  fetchEvents: fetchGCalEvents,
  getCache: function() { return _eventsCache; },
  filterByPeriod: filterByPeriod,
  calcRevenue: function(s,p){return filterByPeriod(s,p).filter(function(x){return x.status==='Done'}).reduce(function(sum,x){return sum+(x.fee||0)},0);},
  calcMinutes: function(s,p){return filterByPeriod(s,p).filter(function(x){return x.status==='Done'}).reduce(function(sum,x){return sum+(x.duration||0)},0);},
  countSessions: function(s,p){return filterByPeriod(s,p).length;},
  countDone: function(s,p){return filterByPeriod(s,p).filter(function(x){return x.status==='Done'}).length;},
  uniqueStudents: function(s){var set=new Set();s.forEach(function(x){if(x.student)set.add(x.student)});return Array.from(set);},
  upcoming: function(s,limit){var now=new Date();return s.filter(function(x){return new Date(x.date)>=now}).sort(function(a,b){return new Date(a.date)-new Date(b.date)}).slice(0,limit||5);}
};

/* ---- Render Welcome ---- */
function renderWelcome() {
  var el = function(id){return document.getElementById(id)};
  if (el('welcome-name')) el('welcome-name').textContent = Store.profile.full_name || 'Giáo viên';
  if (el('profile-display-name')) el('profile-display-name').textContent = Store.profile.full_name || 'Giáo viên';
}

/* ---- DOMContentLoaded ---- */
document.addEventListener('DOMContentLoaded', async function() {
  syncUI('🔄 Loading...');
  await Store.load();
  setTheme(Store.profile.theme || 'dark');
  setFont(Store.profile.font || "'Be Vietnam Pro',sans-serif");
  var fontEl = document.getElementById('p-font');
  if (fontEl) fontEl.value = Store.profile.font || "'Be Vietnam Pro',sans-serif";
  var nameEl = document.getElementById('p-name');
  if (nameEl) nameEl.value = Store.profile.full_name || '';
  renderWelcome();
  closeRightPanel();
  syncUI('✅ Synced');

  document.querySelectorAll('.menu-item').forEach(function(m) {
    m.addEventListener('click', function(e) { e.preventDefault(); switchTab(m.dataset.tab); });
  });
  var hamburger = document.getElementById('hamburger');
  if (hamburger) hamburger.addEventListener('click', function() { document.getElementById('sidebar').classList.toggle('open'); });
});

/* ---- Profile ---- */
async function saveName(n) {
  n = n || 'Giáo viên'; Store.profile.full_name = n; syncUI('🔄...');
  await db.from('profiles').upsert({id:CONFIG.USER_ID, full_name:n, theme:Store.profile.theme, font:Store.profile.font});
  renderWelcome(); syncUI('✅');
}
async function setTheme(t) {
  document.body.setAttribute('data-theme', t);
  document.querySelectorAll('.theme-toggle .btn').forEach(function(b){b.classList.remove('active')});
  if(t==='light'){var b=document.querySelector('.theme-toggle .btn:first-child');if(b)b.classList.add('active');}
  else{var b2=document.querySelector('.theme-toggle .btn:last-child');if(b2)b2.classList.add('active');}
  if(Store.profile.theme!==t){Store.profile.theme=t;await db.from('profiles').upsert({id:CONFIG.USER_ID,full_name:Store.profile.full_name,theme:t,font:Store.profile.font});}
}
async function setFont(f) {
  document.body.style.fontFamily=f;
  if(Store.profile.font!==f){Store.profile.font=f;await db.from('profiles').upsert({id:CONFIG.USER_ID,full_name:Store.profile.full_name,theme:Store.profile.theme,font:f});}
}
function confirmNuke(){document.getElementById('modal-nuke').hidden=false}
function closeNuke(){document.getElementById('modal-nuke').hidden=true}
async function nukeData(){
  syncUI('🔄...');localStorage.removeItem('cs-students-v2');localStorage.removeItem('cs-groups-v2');
  closeNuke();renderWelcome();updateDashboard();renderStudents();renderGroups();syncUI('✅ Deleted');
}

/* ---- Load external data ---- */
async function loadAllExternalData() {
  try {
    await fetchGCalEvents();
    updateDashboard(); updateStats(); renderStudents(); renderGroups(); syncUI('✅ Synced');
  } catch(e) { console.warn('Load failed:', e); syncUI('⚠️ Offline'); }
}

function getAllSessions() {
  var gcal = _eventsCache.filter(function(ev) { return !isEventHidden(ev.id); });
  var local = (Store.sessions||[]).map(function(s) {
    return {id:s.id, name:s.student_name||s.group_name||'', date:s.date+'T'+(s.start_time||'00:00'),
      dateEnd:s.date+'T'+(s.end_time||'00:00'), student:s.student_name||'', fee:s.fee||0,
      duration:timeDiffMinutes(s.start_time,s.end_time), status:s.done?'Done':'Not started',
      type:s.type||'individual', color:s.color||'c1', note:s.note||'', source:'local'};
  });
  var all = gcal.concat(local);
  var studentData = (typeof getStudentData === 'function') ? getStudentData() : [];
  var feeMap = {}; studentData.forEach(function(s){if(s.fee) feeMap[s.name]=s;});
  all.forEach(function(s){if(s.student && feeMap[s.student] && (!s.fee||s.fee===0)) s.fee = feeMap[s.student].fee||0;});
  var map = new Map(); all.forEach(function(s){map.set(s.id,s);}); return Array.from(map.values());
}

/* ---- Dashboard ---- */
function toggleWeekList() {
  var list = document.getElementById('week-list');
  var btn = document.getElementById('week-toggle');
  if (!list) return;
  var show = list.style.display === 'none';
  list.style.display = show ? 'block' : 'none';
  if (btn) btn.textContent = show ? '▴ Thu gọn' : '▾ Mở rộng';
}

function renderSessionItem(s, showDate) {
  var d = new Date(s.date);
  var time = d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
  var day = showDate ? d.toLocaleDateString('vi-VN',{weekday:'short',day:'numeric',month:'numeric'}) + ' ' : '';
  var icon = s.status === 'Done' ? '✅' : '🕐';
  var dur = s.duration ? s.duration + 'p' : '';
  var fee = formatVND(s.fee || 0);
  var info = [day + time, dur, fee].filter(Boolean).join(' · ');
  return '<div class="s-item" onclick="onSessionClick(\'' + s.id + '\')" style="cursor:pointer"><div class="s-item-info"><strong>' + icon + ' ' + (s.name || s.student) + '</strong><span>' + info + '</span></div><span class="s-item-edit">✏️</span></div>';
}

function updateDashboard() {
  var all = getAllSessions();
  var students = (typeof getAllStudents === 'function') ? getAllStudents() : [];
  var activeStudents = students.filter(function(s){return !s.completed;});

  var monthSessions = filterByPeriod(all,'month');
  var doneMonth = monthSessions.filter(function(s){return s.status==='Done';});
  var totalRevenue = 0;
  activeStudents.forEach(function(st){
    var stDone = doneMonth.filter(function(s){return s.student===st.name;});
    if(st.feeType==='per-session'||st.feeType==='free-session') totalRevenue += stDone.length * (st.fee||0);
    else { var m=new Set(); stDone.forEach(function(s){var d2=new Date(s.date);m.add(d2.getMonth())}); totalRevenue += m.size*(st.fee||0); }
  });

  var totalMinutes = doneMonth.reduce(function(sum,s){return sum+(s.duration||0);},0);
  var weekSessions = filterByPeriod(all,'week').length;

  var el = function(id){return document.getElementById(id)};
  if(el('w-students')) el('w-students').textContent = activeStudents.length;
  if(el('w-week')) el('w-week').textContent = weekSessions;
  if(el('w-salary')) el('w-salary').textContent = formatVND(totalRevenue);
  if(el('w-hours')) el('w-hours').textContent = Math.floor(totalMinutes/60)+'h';

  // Today
  var todaySessions = filterByPeriod(all,'today').sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  if(el('today-list')){
    if(todaySessions.length===0) el('today-list').innerHTML='<p class="muted">Hôm nay không có buổi dạy.</p>';
    else el('today-list').innerHTML = todaySessions.map(function(s){ return renderSessionItem(s, false); }).join('');
  }

  // Week
  var weekList = filterByPeriod(all,'week').sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  if(el('week-list')){
    if(weekList.length===0) el('week-list').innerHTML='<p class="muted">Tuần này không có buổi dạy.</p>';
    else el('week-list').innerHTML = weekList.map(function(s){ return renderSessionItem(s, true); }).join('');
  }
}

/* ---- Stats ---- */
var currentStatsMonth = null;
var currentStatsFilter = 'all';

function buildMonthBar() {
  var bar = document.getElementById('stats-month-bar');
  if (!bar) return;
  var START_YEAR = 2026, START_MONTH = 4; // T5/2026 = index 4
  var now = new Date();
  var tabs = [
    {label:'Tất cả', value:'null'},
    {label:'Tuần này', value:'week'}
  ];
  var y = START_YEAR, m = START_MONTH;
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
    var val = y + '-' + String(m+1).padStart(2,'0');
    tabs.push({label:'T'+(m+1)+'/'+y, value:val});
    m++; if(m>11){m=0;y++;}
  }
  bar.innerHTML = tabs.map(function(item) {
    var isActive = (String(currentStatsMonth) === item.value || (currentStatsMonth === null && item.value === 'null'));
    return '<button class="ptab' + (isActive?' active':'') + '" onclick="setStatsMonth(\'' + item.value + '\')">' + item.label + '</button>';
  }).join('');
}

function setStatsMonth(m) {
  currentStatsMonth = (m === 'null') ? null : m;
  buildMonthBar();
  updateStats();
}

function getFilteredSessions(all) {
  if (!currentStatsMonth) return all;
  if (currentStatsMonth === 'week') return filterByPeriod(all, 'week');
  var parts = currentStatsMonth.split('-');
  var yr = parseInt(parts[0]), mo = parseInt(parts[1]) - 1;
  var start = new Date(yr, mo, 1), end = new Date(yr, mo+1, 0, 23, 59, 59);
  return all.filter(function(s) { var d = new Date(s.date); return d >= start && d <= end; });
}

function updateStats() {
  buildMonthBar();
  var all = getAllSessions();
  var students = (typeof getAllStudents === 'function') ? getAllStudents() : [];
  var filtered = getFilteredSessions(all);

  var done = filtered.filter(function(s){return s.status==='Done';});
  var totalExpected = 0, totalEarned = 0;

  students.forEach(function(st) {
    var stSessions = filtered.filter(function(s){return s.student===st.name;});
    var stDone = stSessions.filter(function(s){return s.status==='Done';});
    var earned, expected;
    if(st.feeType==='per-session'||st.feeType==='free-session') {
      earned = stDone.length * (st.fee||0);
      expected = stSessions.length * (st.fee||0);
    } else {
      var dm=new Set(), am=new Set();
      stDone.forEach(function(s){var d2=new Date(s.date);dm.add(d2.getFullYear()+'-'+d2.getMonth())});
      stSessions.forEach(function(s){var d2=new Date(s.date);am.add(d2.getFullYear()+'-'+d2.getMonth())});
      earned = dm.size * (st.fee||0);
      expected = am.size * (st.fee||0);
    }
    totalEarned += earned;
    totalExpected += expected;
  });

  var uncollected = Math.max(0, totalExpected - totalEarned);
  var minutes = done.reduce(function(sum,s){return sum+(s.duration||0)},0);
  var activeCount = students.filter(function(s){return !s.completed;}).length;
  var avg = done.length > 0 ? Math.round(totalEarned / done.length) : 0;

  var el = function(id){return document.getElementById(id)};
  if(el('st-revenue')) el('st-revenue').textContent = formatVND(totalExpected);
  if(el('st-collected')) el('st-collected').textContent = formatVND(totalEarned);
  if(el('st-uncollected')) el('st-uncollected').textContent = formatVND(uncollected);
  if(el('st-students')) el('st-students').textContent = activeCount;
  if(el('st-total')) el('st-total').textContent = filtered.length;
  if(el('st-done')) el('st-done').textContent = done.length;
  if(el('st-hours')) el('st-hours').textContent = Math.floor(minutes/60) + 'h';
  if(el('st-avg')) el('st-avg').textContent = formatVND(avg);

  renderStatsDetail(filtered, students);

  document.querySelectorAll('.stab').forEach(function(btn) {
    btn.onclick = function() {
      document.querySelectorAll('.stab').forEach(function(b){b.classList.remove('active')});
      this.classList.add('active');
      currentStatsFilter = this.dataset.filter;
      renderStatsDetail(filtered, students);
    };
  });
}

function renderStatsDetail(filtered, students) {
  var detail = document.getElementById('stats-detail');
  if (!detail) return;

  var list = students;
  if (currentStatsFilter === 'active') list = list.filter(function(s){return !s.completed;});
  else if (currentStatsFilter === 'completed') list = list.filter(function(s){return s.completed;});

  if (list.length === 0) { detail.innerHTML = '<p class="muted">Không có dữ liệu.</p>'; return; }

  var rows = list.map(function(st) {
    var stSessions = filtered.filter(function(s){return s.student===st.name;});
    var stDone = stSessions.filter(function(s){return s.status==='Done';});
    var earned;
    if(st.feeType==='per-session'||st.feeType==='free-session') earned = stDone.length*(st.fee||0);
    else { var ms=new Set();stDone.forEach(function(s){var d2=new Date(s.date);ms.add(d2.getFullYear()+'-'+d2.getMonth())});earned=ms.size*(st.fee||0); }
    var mins = stDone.reduce(function(sum,s){return sum+(s.duration||0)},0);
    var expected;
    if(st.feeType==='per-session'||st.feeType==='free-session') expected = stSessions.length*(st.fee||0);
    else { var am=new Set();stSessions.forEach(function(s){var d2=new Date(s.date);am.add(d2.getFullYear()+'-'+d2.getMonth())});expected=am.size*(st.fee||0); }
    var uncollected2 = Math.max(0, expected - earned);
    return { st:st, stSessions:stSessions, stDone:stDone, earned:earned, expected:expected, uncollected:uncollected2, mins:mins };
  }).sort(function(a,b){ return b.earned - a.earned; });

  detail.innerHTML = rows.map(function(r) {
    var st = r.st;
    var statusTag = st.completed ? '<span class="stu-done-tag">Đã xong</span>' : '';
    var feeInfo = st.fee > 0 ? ' · ' + formatVND(st.fee) + (st.feeType.includes('month')?'/th':'/b') : '';
    var uncollectedTag = r.uncollected > 0 ? ' · <span style="color:var(--danger)">nợ ' + formatVND(r.uncollected) + '</span>' : '';
    var hours = Math.floor(r.mins/60);

    return '<div class="stats-student-row" onclick="showStudentDetail(\'' + encodeKey(st.name) + '\')" style="cursor:pointer">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span class="stats-student-name">' + st.name + '</span>' + statusTag + '</div>' +
        '<div class="stats-student-info">' + r.stDone.length + '/' + r.stSessions.length + ' buổi · ' + hours + 'h · Thu: ' + formatVND(r.earned) + feeInfo + uncollectedTag + '</div>' +
      '</div>' +
      '<span style="color:var(--text3);font-size:.85rem">👁️</span>' +
    '</div>';
  }).join('');
}

/* ---- INIT ---- */
setTimeout(loadAllExternalData, 800);
setInterval(loadAllExternalData, 120000);
