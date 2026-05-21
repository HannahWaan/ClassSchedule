window._studentFees = JSON.parse(localStorage.getItem('cs-student-fees') || '{}');
window._studentRates = JSON.parse(localStorage.getItem('cs-student-rates') || '{}'); // phút/buổi

function getStudentRevenue(name, doneSessions) {
  const fee = window._studentFees[name] || 0;
  const rateMin = window._studentRates[name] || 60;
  if (!fee) return doneSessions.reduce((s, x) => s + (x.fee || 0), 0);
  return doneSessions.reduce((sum, s) => sum + Math.round(fee * (s.duration || rateMin) / rateMin), 0);
}

function renderStudents() {
  const root = document.getElementById('students-root');
  const countEl = document.getElementById('student-count');
  if (!root) return;
  const all = getAllSessions ? getAllSessions() : [];
  const studentMap = new Map();
  all.forEach(s => {
    if (!s.student) return;
    if (!studentMap.has(s.student)) studentMap.set(s.student, { name: s.student, sessions: [], totalMin: 0 });
    const st = studentMap.get(s.student);
    st.sessions.push(s);
    st.totalMin += s.duration || 0;
  });
  const students = [...studentMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (countEl) countEl.textContent = students.length + ' học viên';
  if (students.length === 0) { root.innerHTML = '<p class="muted">Chưa có dữ liệu từ Google Calendar.</p>'; return; }
  root.innerHTML = students.map(st => {
    const done = st.sessions.filter(s => s.status === 'Done');
    const hours = Math.floor(st.totalMin / 60);
    const mins = st.totalMin % 60;
    const safeName = st.name.replace(/'/g, "\\'");
    const fee = window._studentFees[st.name] || 0;
    const rate = window._studentRates[st.name] || 60;
    const revenue = getStudentRevenue(st.name, done);
    return '<div class="student-card-auto">' +
      '<div class="student-name">' + st.name + '</div>' +
      '<div class="student-meta">' +
        '<span>📚 ' + st.sessions.length + ' buổi · ' + done.length + ' xong</span>' +
        '<span>⏱️ ' + hours + 'h' + (mins > 0 ? mins + 'p' : '') + '</span>' +
        '<span>💰 Doanh thu: <strong style="color:var(--success)">' + Math.round(revenue/1000) + 'k</strong></span>' +
      '</div>' +
      '<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<div><label style="font-size:.72rem;color:var(--text3);display:block;margin-bottom:3px">💵 HỌC PHÍ (VNĐ/đơn vị)</label>' +
        '<input type="number" placeholder="VD: 100000" value="' + (fee||'') + '" ' +
          'style="width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:.82rem" ' +
          'onchange="setStudentFee(\'' + safeName + '\', this.value)">' +
        '</div>' +
        '<div><label style="font-size:.72rem;color:var(--text3);display:block;margin-bottom:3px">⏱️ PHÚT/ĐƠN VỊ</label>' +
        '<input type="number" placeholder="VD: 60" value="' + rate + '" ' +
          'style="width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:.82rem" ' +
          'onchange="setStudentRate(\'' + safeName + '\', this.value)">' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:8px;display:flex;gap:8px">' +
        '<button class="btn btn-outline btn-sm" onclick="showStudentDetail(\'' + safeName + '\')">👁️ Chi tiết</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteStudent(\'' + safeName + '\')">🗑️ Xóa</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function setStudentFee(name, value) {
  window._studentFees[name] = parseInt(value) || 0;
  localStorage.setItem('cs-student-fees', JSON.stringify(window._studentFees));
  renderStudents();
}

function setStudentRate(name, value) {
  window._studentRates[name] = parseInt(value) || 60;
  localStorage.setItem('cs-student-rates', JSON.stringify(window._studentRates));
  renderStudents();
}

function deleteStudent(name) {
  if (!confirm('Xóa học viên "' + name + '"?')) return;
  gcalEvents = gcalEvents.filter(s => s.student !== name);
  delete window._studentFees[name];
  delete window._studentRates[name];
  localStorage.setItem('cs-student-fees', JSON.stringify(window._studentFees));
  localStorage.setItem('cs-student-rates', JSON.stringify(window._studentRates));
  renderStudents(); updateDashboard(); updateStats();
}

function showStudentDetail(name) {
  const all = getAllSessions ? getAllSessions() : [];
  const sessions = all.filter(s => s.student === name);
  const done = sessions.filter(s => s.status === 'Done');
  const upcoming = sessions.filter(s => s.status !== 'Done').sort((a,b) => new Date(a.date)-new Date(b.date));
  const totalMin = sessions.reduce((s,x) => s+(x.duration||0), 0);
  const revenue = getStudentRevenue(name, done);
  const fee = window._studentFees[name] || 0;
  const rate = window._studentRates[name] || 60;
  const panel = document.getElementById('rp-body');
  if (!panel) return;
  panel.innerHTML =
    '<h3 style="margin-bottom:4px">' + name + '</h3>' +
    '<p style="color:var(--text3);font-size:.8rem;margin-bottom:16px">' + (fee ? fee.toLocaleString()+'đ / '+rate+'p' : 'Chưa đặt học phí') + '</p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">' +
      '<div style="background:var(--surface);border-radius:10px;padding:12px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--accent)">' + sessions.length + '</div><div style="font-size:.72rem;color:var(--text3)">TỔNG BUỔI</div></div>' +
      '<div style="background:var(--surface);border-radius:10px;padding:12px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--success)">' + Math.round(revenue/1000) + 'k</div><div style="font-size:.72rem;color:var(--text3)">DOANH THU</div></div>' +
      '<div style="background:var(--surface);border-radius:10px;padding:12px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--accent2)">' + done.length + '</div><div style="font-size:.72rem;color:var(--text3)">ĐÃ DẠY</div></div>' +
      '<div style="background:var(--surface);border-radius:10px;padding:12px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--warning)">' + Math.floor(totalMin/60) + 'h</div><div style="font-size:.72rem;color:var(--text3)">TỔNG GIỜ</div></div>' +
    '</div>' +
    (upcoming.length > 0 ? '<h4 style="margin-bottom:8px;color:var(--accent)">📅 Sắp tới</h4>' +
      upcoming.slice(0,5).map(s => {
        const d = new Date(s.date);
        return '<div class="upcoming-item"><span class="upcoming-time">' + d.toLocaleDateString('vi-VN',{weekday:'short',day:'numeric',month:'numeric'}) + '</span><span class="upcoming-name">' + (s.name||name) + '</span></div>';
      }).join('') : '') +
    (done.length > 0 ? '<h4 style="margin:12px 0 8px;color:var(--text3)">✅ Đã hoàn thành</h4>' +
      done.slice(-5).reverse().map(s => {
        const d = new Date(s.date);
        const sesRevenue = fee ? Math.round(fee*(s.duration||rate)/rate/1000) : Math.round((s.fee||0)/1000);
        return '<div class="upcoming-item" style="opacity:.8"><span class="upcoming-time">' + d.toLocaleDateString('vi-VN',{day:'numeric',month:'numeric'}) + '</span><span class="upcoming-name">' + (s.name||name) + '</span><span class="upcoming-fee">' + sesRevenue + 'k</span></div>';
      }).join('') : '');
  openRightPanel();
}
