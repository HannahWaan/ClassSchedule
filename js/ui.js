/* ===== UI.JS ===== */
function switchTab(tab) {
  document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active')});
  var page=document.getElementById('page-'+tab); if(page) page.classList.add('active');
  document.querySelectorAll('.menu-item').forEach(function(m){m.classList.remove('active')});
  var link=document.querySelector('.menu-item[data-tab="'+tab+'"]'); if(link)link.classList.add('active');
  var titles={welcome:'Trang chủ',schedule:'Lịch dạy',stats:'Thống kê',students:'Học viên',groups:'Lớp nhóm',profile:'Hồ sơ'};
  var titleEl=document.getElementById('topbar-title'); if(titleEl)titleEl.textContent=titles[tab]||'';
  var sidebar=document.getElementById('sidebar'); if(sidebar)sidebar.classList.remove('open');
  if(tab==='stats'&&typeof updateStats==='function') updateStats();
  if(tab==='welcome'){if(typeof renderWelcome==='function')renderWelcome();if(typeof updateDashboard==='function')updateDashboard();}
  if(tab==='students'&&typeof renderStudents==='function') renderStudents();
  if(tab==='groups'&&typeof renderGroups==='function') renderGroups();
}
function syncUI(t){var el=document.getElementById('sync-status');if(el)el.textContent=t;}
function openRightPanel(){var rp=document.getElementById('right-panel');if(rp){rp.classList.remove('hidden');rp.classList.add('open');}}
function closeRightPanel(){var rp=document.getElementById('right-panel');if(rp){rp.classList.add('hidden');rp.classList.remove('open');}}
function timeDiffMinutes(start,end){if(!start||!end)return 0;var a=start.split(':'),b=end.split(':');return(parseInt(b[0])*60+parseInt(b[1]))-(parseInt(a[0])*60+parseInt(a[1]));}
