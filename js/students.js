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
    const hours = Math.floor(st.totalMin / 60);
    const mins = st.totalMin % 60;
    const safeName = st.name.replace(/'/g, "\\'");
    const customFee = window._studentFees && window._studentFees[st.name] ? window._studentFees[st.name] : '';
    const revenue = customFee ? (done * customFee) : st.totalFee;
    return '<div class="student-card-auto">' +
      '<div class="student-name">' + st.name + '</div>' +
      '<div class="student-meta">' +
        '<span>📚 ' + st.sessions.length + ' buổi (' + done + ' xong)</span>' +
        '<span>⏱️ ' + hours + 'h' + (mins > 0 ? mins + 'p' : '') + '</span>' +
        '<span>💰 Doanh thu: ' + Math.round(revenue / 1000) + 'k</span>' +
      '</div>' +
      '<div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<input type="number" placeholder="Học phí/buổi (VNĐ)" value="' + customFee + '" ' +
          'style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font-size:.8rem;width:160px" ' +
          'onchange="setStudentFee(\'' + safeName + '\', this.value)">' +
        '<button class="btn btn-danger btn-sm" onclick="deleteStudent(\'' + safeName + '\')">🗑️ Xóa</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

window._studentFees = JSON.parse(localStorage.getItem('cs-student-fees') || '{}');

function setStudentFee(name, value) {
  window._studentFees[name] = parseInt(value) || 0;
  localStorage.setItem('cs-student-fees', JSON.stringify(window._studentFees));
  renderStudents();
}

function deleteStudent(name) {
  if (!confirm('Xóa học viên "' + name + '"?')) return;
  gcalEvents = gcalEvents.filter(s => s.student !== name);
  renderStudents();
  updateDashboard();
  updateStats();
}
