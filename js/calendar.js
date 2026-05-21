var calView='week',calDate=new Date();
var dragSession=null,dragType=null,dragStartY=0,dragOrigTop=0,dragOrigH=0,dragEl=null;
var ctxSessionId=null;

function renderCalendar(){var root=document.getElementById('calendar-root');if(calView==='week')renderWeek(root);else if(calView==='month')renderMonth(root);else renderDay(root);updateCalNav();renderMiniCal();}

function renderWeek(root){
    var ws=getWeekStart(calDate);var days=['T2','T3','T4','T5','T6','T7','CN'];var startHour=6,endHour=22;
    var h='<div class="cal-week"><div class="cal-hdr"></div>';
    for(var d=0;d<7;d++){var dt=new Date(ws);dt.setDate(dt.getDate()+d);h+='<div class="cal-hdr'+(isSameDay(dt,new Date())?' today':'')+'">'+days[d]+'<br>'+dt.getDate()+'/'+(dt.getMonth()+1)+'</div>';}
    for(var hr=startHour;hr<=endHour;hr++){
        h+='<div class="cal-time">'+hr+':00</div>';
        for(var d2=0;d2<7;d2++){
            var dt2=new Date(ws);dt2.setDate(dt2.getDate()+d2);var ds=fmtISO(dt2);
            var cs=Store.sessions.filter(function(s){return s.date===ds&&parseInt(s.start_time)===hr;});
            h+='<div class="cal-cell" data-date="'+ds+'" data-hour="'+hr+'" onclick="calCellClick(\''+ds+'\','+hr+')">';
            cs.forEach(function(s){
                var durMins=timeDiffMinutes(s.start_time,s.end_time);
                var heightPx=Math.max(20,Math.round((durMins/60)*48)-2);
                var startMin=parseInt(s.start_time.split(':')[1]);
                var topOffset=Math.round((startMin/60)*48);
                var color=Store.getColor(s);
                h+='<div class="cal-ev '+color+'" data-id="'+s.id+'" style="height:'+heightPx+'px;top:'+topOffset+'px" onmousedown="evMouseDown(event,\''+s.id+'\')" oncontextmenu="evContext(event,\''+s.id+'\')" onclick="event.stopPropagation();showEventPanel(\''+s.id+'\')">';
                h+='<div class="ev-time">'+s.start_time.slice(0,5)+'</div>';
                h+=(s.student_name||s.group_name||s.lesson);
                h+='<div class="ev-resize" onmousedown="evResizeDown(event,\''+s.id+'\')"></div>';
                h+='</div>';
            });
            h+='</div>';
        }
    }
    h+='</div>';root.innerHTML=h;
}

function renderMonth(root){
    var y=calDate.getFullYear(),m=calDate.getMonth();var first=new Date(y,m,1),last=new Date(y,m+1,0);var sd=(first.getDay()+6)%7;var days=['T2','T3','T4','T5','T6','T7','CN'];
    var h='<div class="cal-month">';days.forEach(function(d){h+='<div class="cal-mhdr">'+d+'</div>';});
    for(var i=0;i<sd;i++)h+='<div class="cal-mday other"></div>';
    for(var day=1;day<=last.getDate();day++){
        var dt=new Date(y,m,day);var ds=fmtISO(dt);var ss=Store.sessions.filter(function(s){return s.date===ds;});var today=isSameDay(dt,new Date());
        h+='<div class="cal-mday'+(today?' today':'')+'" onclick="calDayClick(\''+ds+'\')"><div class="dn">'+day+'</div>';
        ss.slice(0,3).forEach(function(s){var color=Store.getColor(s);h+='<div class="cal-ev '+color+'" oncontextmenu="evContext(event,\''+s.id+'\')" onclick="event.stopPropagation();showEventPanel(\''+s.id+'\')">'+s.start_time.slice(0,5)+' '+(s.student_name||s.group_name||s.lesson)+'</div>';});
        if(ss.length>3)h+='<div style="font-size:.6rem;color:var(--text3)">+'+(ss.length-3)+'</div>';h+='</div>';
    }
    h+='</div>';root.innerHTML=h;
}

function renderDay(root){
    var ds=fmtISO(calDate);var ss=Store.sessions.filter(function(s){return s.date===ds;}).sort(function(a,b){return a.start_time.localeCompare(b.start_time);});
    var h='<div class="cal-day">';
    if(!ss.length)h+='<p class="muted">Không có buổi dạy nào.</p><button class="btn btn-primary" style="margin-top:10px" onclick="calCellClick(\''+ds+'\',9)">➕ Thêm buổi</button>';
    else ss.forEach(function(s){var color=Store.getColor(s);h+='<div class="day-item '+color+'" oncontextmenu="evContext(event,\''+s.id+'\')" onclick="showEventPanel(\''+s.id+'\')"><strong>'+(s.student_name||s.group_name||'')+' – '+s.lesson+'</strong><span>'+s.start_time.slice(0,5)+'–'+s.end_time.slice(0,5)+' · '+formatMoney(s.fee)+'</span></div>';});
    h+='</div>';root.innerHTML=h;
}

function updateCalNav(){var el=document.getElementById('cal-nav-title');if(calView==='week'){var ws=getWeekStart(calDate);el.textContent='Tháng '+(ws.getMonth()+1)+' '+ws.getFullYear();}else if(calView==='month'){el.textContent='Tháng '+(calDate.getMonth()+1)+' / '+calDate.getFullYear();}else{el.textContent=fmtDateLong(fmtISO(calDate));}}
function navCal(dir){if(calView==='week')calDate.setDate(calDate.getDate()+dir*7);else if(calView==='month')calDate.setMonth(calDate.getMonth()+dir);else calDate.setDate(calDate.getDate()+dir);renderCalendar();}

// CLICK CELL → switch to add-session tab with prefilled date/time
function calCellClick(date,hour){
    switchTab('add-session');
    document.getElementById('f-date').value=date;
    document.getElementById('f-start').value=String(hour).padStart(2,'0')+':00';
    document.getElementById('f-end').value=String(hour+1).padStart(2,'0')+':00';
    recalcFee();
}
function calDayClick(date){calDate=new Date(date+'T00:00:00');calView='day';document.querySelectorAll('.vtab[data-view]').forEach(function(x){x.classList.remove('active');});var btn=document.querySelector('.vtab[data-view="day"]');if(btn)btn.classList.add('active');renderCalendar();}

// RIGHT PANEL - EVENT
function showEventPanel(id){
    var s=Store.sessions.find(function(x){return x.id===id;});if(!s)return;
    var mins=timeDiffMinutes(s.start_time,s.end_time);var color=Store.getColor(s);
    var colorVar='var(--ev-'+color.replace('c','color')+')';
    var typeLabel=s.session_type==='group'?'👥 Nhóm':'👤 Cá nhân';
    var who=s.session_type==='group'?s.group_name:s.student_name;
    var repeatLabels={none:'Không lặp',daily:'Hàng ngày',weekly:'Mỗi tuần',biweekly:'Mỗi 2 tuần',monthly:'Mỗi tháng',custom:'Tuỳ chỉnh'};
    var repeatLabel=repeatLabels[s.repeat_type]||'Không lặp';
    var reminderLabel=s.reminder?s.reminder+' phút trước':'Không';

    var html='<div class="rp-event-color" style="background:'+colorVar+';height:6px;border-radius:3px;margin-bottom:16px"></div>';
    html+='<div class="rp-event-name">'+s.lesson+'</div>';
    html+='<div class="rp-section">';
    html+='<div class="rp-row"><span class="rp-row-icon">🕐</span><div class="rp-row-content"><div class="rp-value">'+s.start_time.slice(0,5)+' → '+s.end_time.slice(0,5)+'</div><div class="rp-label">'+durationLabel(mins)+' · GMT+7</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">📅</span><div class="rp-row-content"><div class="rp-value">'+fmtDateLong(s.date)+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">🔁</span><div class="rp-row-content"><div class="rp-value">'+repeatLabel+'</div></div></div>';
    html+='</div>';
    html+='<div class="rp-section">';
    html+='<div class="rp-row clickable" onclick="'+(s.session_type==='group'&&s.group_id?'showGroupPanel(\''+s.group_id+'\')':s.student_id?'showStudentPanel(\''+s.student_id+'\')':'')+'">';
    html+='<span class="rp-row-icon">'+(s.session_type==='group'?'👥':'👤')+'</span><div class="rp-row-content"><div class="rp-label">'+typeLabel+'</div><div class="rp-value">'+(who||'—')+' →</div></div></div>';
    if(s.location)html+='<div class="rp-row"><span class="rp-row-icon">📍</span><div class="rp-row-content"><div class="rp-value">'+s.location+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">💰</span><div class="rp-row-content"><div class="rp-value">'+formatMoney(s.fee)+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">🔔</span><div class="rp-row-content"><div class="rp-value">'+reminderLabel+'</div></div></div>';
    if(s.note)html+='<div class="rp-row"><span class="rp-row-icon">📝</span><div class="rp-row-content"><div class="rp-value">'+s.note+'</div></div></div>';
    html+='</div>';
    // Color picker
    html+='<div class="rp-color-picker">';['c1','c2','c3','c4','c5'].forEach(function(c){html+='<span class="cpick'+(color===c?' active':'')+'" data-color="'+c+'" onclick="panelColor(\''+id+'\',\''+c+'\')"></span>';});
    html+='</div>';
    // Actions
    html+='<div class="rp-actions"><button class="btn btn-primary btn-sm" onclick="openEditModal(\''+id+'\')">✏️ Sửa</button><button class="btn btn-outline btn-sm" onclick="duplicateSession(\''+id+'\')">📋 Nhân bản</button><button class="btn btn-danger btn-sm" onclick="deleteSessionFromPanel(\''+id+'\')">🗑️ Xóa</button></div>';

    document.getElementById('rp-body').innerHTML=html;openRightPanel();
}

// RIGHT PANEL - STUDENT
function showStudentPanel(id){
    var s=Store.students.find(function(x){return x.id===id;});if(!s)return;
    var grp=Store.groups.find(function(g){return g.id===s.group_id;});
    var sessions=Store.sessions.filter(function(x){return x.student_id===id;});
    var html='<div class="rp-event-color" style="background:var(--accent);height:6px;border-radius:3px;margin-bottom:16px"></div>';
    html+='<div class="rp-event-name">👤 '+s.name+'</div>';
    html+='<div class="rp-section">';
    html+='<div class="rp-row"><span class="rp-row-icon">📚</span><div class="rp-row-content"><div class="rp-label">Chương trình</div><div class="rp-value">'+(s.program||'—')+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">🎯</span><div class="rp-row-content"><div class="rp-label">Level</div><div class="rp-value">'+(s.level||'—')+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">💰</span><div class="rp-row-content"><div class="rp-label">Học phí</div><div class="rp-value">'+(s.rate?formatMoney(s.rate)+'/'+s.rate_minutes+'p':'Chưa đặt')+'</div></div></div>';
    if(grp)html+='<div class="rp-row"><span class="rp-row-icon">👥</span><div class="rp-row-content"><div class="rp-label">Nhóm</div><div class="rp-value">'+grp.name+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">📊</span><div class="rp-row-content"><div class="rp-label">Tổng buổi</div><div class="rp-value">'+sessions.length+' buổi</div></div></div>';
    if(s.review)html+='<div class="rp-row"><span class="rp-row-icon">💬</span><div class="rp-row-content"><div class="rp-label">Nhận xét</div><div class="rp-value">'+s.review+'</div></div></div>';
    if(s.note)html+='<div class="rp-row"><span class="rp-row-icon">📝</span><div class="rp-row-content"><div class="rp-label">Ghi chú</div><div class="rp-value">'+s.note+'</div></div></div>';
    html+='</div>';
    html+='<div class="rp-actions"><button class="btn btn-primary btn-sm" onclick="openEditStudentModal(\''+id+'\')">✏️ Sửa</button><button class="btn btn-outline btn-sm" onclick="openAssignModal(\''+id+'\')">👥 Nhóm</button><button class="btn btn-danger btn-sm" onclick="deleteStudent(\''+id+'\');closeRightPanel()">🗑️ Xóa</button></div>';
    document.getElementById('rp-body').innerHTML=html;openRightPanel();
}

// RIGHT PANEL - GROUP
function showGroupPanel(id){
    var g=Store.groups.find(function(x){return x.id===id;});if(!g)return;
    var members=Store.students.filter(function(s){return s.group_id===id;});
    var sessions=Store.sessions.filter(function(x){return x.group_id===id;});
    var html='<div class="rp-event-color" style="background:var(--ev-color2);height:6px;border-radius:3px;margin-bottom:16px"></div>';
    html+='<div class="rp-event-name">👥 '+g.name+'</div>';
    html+='<div class="rp-section">';
    html+='<div class="rp-row"><span class="rp-row-icon">📚</span><div class="rp-row-content"><div class="rp-label">Chương trình</div><div class="rp-value">'+(g.program||'—')+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">💰</span><div class="rp-row-content"><div class="rp-label">Học phí nhóm</div><div class="rp-value">'+(g.rate?formatMoney(g.rate)+'/'+g.rate_minutes+'p':'Chưa đặt')+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">👥</span><div class="rp-row-content"><div class="rp-label">Thành viên ('+members.length+')</div><div class="rp-value">'+members.map(function(m){return m.name;}).join(', ')+'</div></div></div>';
    html+='<div class="rp-row"><span class="rp-row-icon">📊</span><div class="rp-row-content"><div class="rp-label">Tổng buổi</div><div class="rp-value">'+sessions.length+' buổi</div></div></div>';
    if(g.note)html+='<div class="rp-row"><span class="rp-row-icon">📝</span><div class="rp-row-content"><div class="rp-label">Ghi chú</div><div class="rp-value">'+g.note+'</div></div></div>';
    html+='</div>';
    html+='<div class="rp-actions"><button class="btn btn-primary btn-sm" onclick="openEditGroupModal(\''+id+'\')">✏️ Sửa</button><button class="btn btn-danger btn-sm" onclick="deleteGroup(\''+id+'\');closeRightPanel()">🗑️ Xóa</button></div>';
    document.getElementById('rp-body').innerHTML=html;openRightPanel();
}

async function panelColor(id,c){await db.from('sessions').update({color:c}).eq('id',id);var s=Store.sessions.find(function(x){return x.id===id;});if(s)s.color=c;renderCalendar();showEventPanel(id);}
function deleteSessionFromPanel(id){deleteSession(id);closeRightPanel();}

// CONTEXT MENU
function evContext(e,id){e.preventDefault();e.stopPropagation();ctxSessionId=id;var menu=document.getElementById('ctx-menu');menu.style.display='block';menu.style.left=Math.min(e.clientX,window.innerWidth-200)+'px';menu.style.top=Math.min(e.clientY,window.innerHeight-220)+'px';}
function hideCtx(){document.getElementById('ctx-menu').style.display='none';ctxSessionId=null;}
function ctxEdit(){if(ctxSessionId)openEditModal(ctxSessionId);hideCtx();}
async function ctxColor(c){if(!ctxSessionId)return;await db.from('sessions').update({color:c}).eq('id',ctxSessionId);var s=Store.sessions.find(function(x){return x.id===ctxSessionId;});if(s)s.color=c;renderCalendar();hideCtx();}
function ctxDuplicate(){if(ctxSessionId)duplicateSession(ctxSessionId);hideCtx();}
function ctxDelete(){if(ctxSessionId)deleteSession(ctxSessionId);hideCtx();}

// DRAG & DROP
function evMouseDown(e,id){if(e.button!==0)return;if(e.target.classList.contains('ev-resize'))return;e.stopPropagation();dragSession=id;dragType='move';dragStartY=e.clientY;dragEl=e.currentTarget;dragOrigTop=parseInt(dragEl.style.top)||0;dragEl.classList.add('dragging');document.addEventListener('mousemove',evMouseMove);document.addEventListener('mouseup',evMouseUp);}
function evResizeDown(e,id){e.stopPropagation();e.preventDefault();dragSession=id;dragType='resize';dragStartY=e.clientY;dragEl=e.currentTarget.parentElement;dragOrigH=parseInt(dragEl.style.height)||48;dragEl.classList.add('dragging');document.addEventListener('mousemove',evMouseMove);document.addEventListener('mouseup',evMouseUp);}
function evMouseMove(e){if(!dragEl)return;var dy=e.clientY-dragStartY;if(dragType==='move')dragEl.style.top=(dragOrigTop+dy)+'px';else if(dragType==='resize')dragEl.style.height=Math.max(20,dragOrigH+dy)+'px';}
async function evMouseUp(e){
    document.removeEventListener('mousemove',evMouseMove);document.removeEventListener('mouseup',evMouseUp);
    if(!dragEl||!dragSession){dragEl=null;dragSession=null;return;}dragEl.classList.remove('dragging');
    var s=Store.sessions.find(function(x){return x.id===dragSession;});if(!s){dragEl=null;dragSession=null;renderCalendar();return;}
    var dy=e.clientY-dragStartY;var dMins=Math.round(dy/48*60);dMins=Math.round(dMins/5)*5;
    if(Math.abs(dMins)<5){dragEl=null;dragSession=null;renderCalendar();return;}
    if(dragType==='move'){
        var sMin=parseInt(s.start_time.split(':')[0])*60+parseInt(s.start_time.split(':')[1])+dMins;
        var eMin=parseInt(s.end_time.split(':')[0])*60+parseInt(s.end_time.split(':')[1])+dMins;
        if(sMin<0)sMin=0;if(eMin>1440)eMin=1440;
        s.start_time=String(Math.floor(sMin/60)).padStart(2,'0')+':'+String(sMin%60).padStart(2,'0');
        s.end_time=String(Math.floor(eMin/60)).padStart(2,'0')+':'+String(eMin%60).padStart(2,'0');
        await db.from('sessions').update({start_time:s.start_time,end_time:s.end_time}).eq('id',s.id);
    }else{
        var eMin2=parseInt(s.end_time.split(':')[0])*60+parseInt(s.end_time.split(':')[1])+dMins;
        var startMins=parseInt(s.start_time.split(':')[0])*60+parseInt(s.start_time.split(':')[1]);
        if(eMin2<=startMins)eMin2=startMins+15;if(eMin2>1440)eMin2=1440;
        s.end_time=String(Math.floor(eMin2/60)).padStart(2,'0')+':'+String(eMin2%60).padStart(2,'0');
        var newMins=eMin2-startMins;var rate=0,rm=60;
        if(s.session_type==='group'&&s.group_id){var g=Store.groups.find(function(x){return x.id===s.group_id;});if(g){rate=g.rate||0;rm=g.rate_minutes||60;}}
        else if(s.student_id){var st=Store.students.find(function(x){return x.id===s.student_id;});if(st){rate=st.rate||0;rm=st.rate_minutes||60;}}
        s.fee=calcFee(rate,rm,newMins);
        await db.from('sessions').update({end_time:s.end_time,fee:s.fee}).eq('id',s.id);
    }
    dragEl=null;dragSession=null;dragType=null;renderCalendar();
}

// MINI CAL
var miniCalDate=new Date();
function renderMiniCal(){var el=document.getElementById('mini-cal');var y=miniCalDate.getFullYear(),m=miniCalDate.getMonth();var first=new Date(y,m,1),last=new Date(y,m+1,0);var sd=(first.getDay()+6)%7;var days=['T2','T3','T4','T5','T6','T7','CN'];var eventDates={};Store.sessions.forEach(function(s){eventDates[s.date]=true;});var h='<div class="mini-cal-header"><button onclick="miniCalNav(-1)">‹</button><span>Thg '+(m+1)+' '+y+'</span><button onclick="miniCalNav(1)">›</button></div><div class="mini-cal-grid">';days.forEach(function(d){h+='<div class="mc-hdr">'+d+'</div>';});for(var i=0;i<sd;i++)h+='<div class="mc-day other"></div>';for(var day=1;day<=last.getDate();day++){var dt=new Date(y,m,day);var ds=fmtISO(dt);var cls='mc-day';if(isSameDay(dt,new Date()))cls+=' today';if(eventDates[ds])cls+=' has-event';h+='<div class="'+cls+'" onclick="miniCalClick(\''+ds+'\')">'+day+'</div>';}h+='</div>';el.innerHTML=h;}
function miniCalNav(dir){miniCalDate.setMonth(miniCalDate.getMonth()+dir);renderMiniCal();}
function miniCalClick(ds){calDate=new Date(ds+'T00:00:00');calView='day';document.querySelectorAll('.vtab[data-view]').forEach(function(x){x.classList.remove('active');});var btn=document.querySelector('.vtab[data-view="day"]');if(btn)btn.classList.add('active');renderCalendar();}
