function renderStats(period) {
    var now = new Date(); var filtered = [];
    if (period === 'week') { var ws = getWeekStart(now); var we = new Date(ws); we.setDate(we.getDate()+7); filtered = Store.sessions.filter(function(s){var d=new Date(s.date);return d>=ws&&d<we;}); }
    else { filtered = Store.sessions.filter(function(s){var d=new Date(s.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}); }
    var names = [...new Set(filtered.map(function(s){return s.student_name||s.group_name||s.student_id;}))];
    var revenue = filtered.reduce(function(a,s){return a+(Number(s.fee)||0);},0);
    document.getElementById('s-sessions').textContent = filtered.length;
    document.getElementById('s-students').textContent = names.length;
    document.getElementById('s-revenue').textContent = formatMoney(revenue);
    var el = document.getElementById('stats-list');
    if (!filtered.length) { el.innerHTML = '<p class="muted">Chưa có dữ liệu.</p>'; return; }
    el.innerHTML = filtered.map(function(s){ return '<div class="s-item"><div class="s-item-info"><strong>'+s.lesson+'</strong><span>'+(s.student_name||s.group_name||'')+' · '+fmtDate(s.date)+' · '+formatMoney(s.fee)+'</span></div></div>'; }).join('');
}
