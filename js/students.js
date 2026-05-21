function renderStudents() {
  const root = document.getElementById('students-root');
  const countEl = document.getElementById('student-count');
  if (!root) return;
  const all = getAllSessions ? getAllSessions() : [];
  const studentMap = new Map();
  all.forEach(s => {
    if (!s.student) return;
    if (!studentMap.has(s.student)) studentMap.set(s.student, { name: s.student, sessions: [], totalFee: 0, totalMin: 0 });
    const st = studentMap.get(s.student);
    st.sessions.push(s); st.totalFee += s.fee || 0; st.totalMin += s.duration || 0;
  });
  const students = [...studentMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  if (countEl) countEl.textContent = students.length + ' học viên';
  if (students.length === 0) { root.innerHTML = '<p class="muted">Chưa có dữ liệu từ Google Calendar.</p>'; return; }
  root.innerHTML = students.map(st => {
    const done = st.sessions.filter(s => s.status === 'Done').length;
    const upcoming = st.sessions.filter(s => s.status !== 'Done').length;
    const hours = Math.floor(st.totalMin / 60);
    const mins = st.totalMin % 60;
    const fee = Math.round(st.totalFee / 1000) + 'k';
    const safeName = st.name.replace(/'/g, "\\'");
    return '<div class="student-card-auto">' +
      '<div class="student-name">' + st.name + '</div>' +
      '<div class="student-meta">' +
        '<span>📚 ' + st.sessions.length + ' buổi (' + done + ' xong, ' + upcoming + ' sắp tới)</span>' +
        '<span>⏱️ ' + hours + 'h' + (mins > 0 ? mins + 'p' : '') + '</span>' +
        '<span>💰 ' + fee + '</span>' +
      '</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px">' +
        '<button class="btn btn-ghost btn-sm" onclick="showStudentDetail(\'' + safeName + '\')">👁️ Chi tiết</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteStudent(\'' + safeName + '\')">🗑️ Xóa</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function deleteStudent(name) {
  if (!confirm('Xóa học viên "' + name + '"? (Chỉ xóa khỏi danh sách hiển thị)')) return;
  gcalEvents = gcalEvents.filter(s => s.student !== name);
  renderStudents();
  updateDashboard();
  updateStats();
}

function showStudentDetail(name) {
  const all = getAllSessions ? getAllSessions() : [];
  const sessions = all.filter(s => s.student === name);
  const done = sessions.filter(s => s.status === 'Done');
  const upcoming = sessions.filter(s => s.status !== 'Done').sort((a,b) => new Date(a.date) - new Date(b.date));
  const totalFee = done.reduce((sum, s) => sum + (s.fee || 0), 0);
  const totalMin = done.reduce((sum, s) => sum + (s.duration || 0), 0);
  const panel = document.getElementById('rp-body');
  if (!panel) return;
  panel.innerHTML =
    '<h3 style="margin-bottom:12px">' + name + '</h3>' +
    '<div class="student-meta" style="margin-bottom:16px;display:flex;flex-direction:column;gap:4px">' +
      '<span>📚 Tổng: ' + sessions.length + ' buổi (' + done.length + ' xong)</span>' +
      '<span>⏱️ ' + Math.floor(totalMin/60) + 'h' + (totalMin%60 > 0 ? totalMin%60 + 'p' : '') + '</span>' +
      '<span>💰 Đã thu: ' + Math.round(totalFee/1000) + 'k</span>' +
    '</div>' +
    (upcoming.length > 0 ? '<h4 style="margin-bottom:8px;color:var(--accent)">Sắp tới</h4>' +
      upcoming.slice(0,5).map(s => {
        const d = new Date(s.date);
        return '<div class="upcoming-item"><span class="upcoming-time">' + d.toLocaleDateString('vi-VN',{weekday:'short',day:'numeric',month:'numeric'}) + '</span><span class="upcoming-name">' + s.name + '</span></div>';
      }).join('') : '') +
    (done.length > 0 ? '<h4 style="margin:12px 0 8px;color:var(--text3)">Đã hoàn thành</h4>' +
      done.slice(-5).reverse().map(s => {
        const d = new Date(s.date);
        return '<div class="upcoming-item" style="opacity:0.7"><span class="upcoming-time">' + d.toLocaleDateString('vi-VN',{day:'numeric',month:'numeric'}) + '</span><span class="upcoming-name">' + s.name + '</span><span class="upcoming-fee">' + Math.round((s.fee||0)/1000) + 'k</span></div>';
      }).join('') : '');
  openRightPanel();
}
