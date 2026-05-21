/* ===== STUDENTS - Auto from Google Calendar + editable ===== */

// Local overrides (ten, hoc phi, da xong)
function getStudentOverrides() {
  try { return JSON.parse(localStorage.getItem('cs-student-overrides') || '{}'); } catch(e) { return {}; }
}
function saveStudentOverrides(data) {
  localStorage.setItem('cs-student-overrides', JSON.stringify(data));
}

function renderStudents() {
  const root = document.getElementById('students-root');
  const countEl = document.getElementById('student-count');
  if (!root) return;

  const all = (typeof getAllSessions === 'function') ? getAllSessions() : [];
  const overrides = getStudentOverrides();

  // Gom theo ten hoc vien (ten goc tu GCal)
  const studentMap = new Map();
  all.forEach(s => {
    if (!s.student) return;
    const key = s.student;
    if (!studentMap.has(key)) {
      studentMap.set(key, { originalName: key, sessions: [], totalFee: 0, totalMin: 0 });
    }
    const st = studentMap.get(key);
    st.sessions.push(s);
    st.totalFee += s.fee || 0;
    st.totalMin += s.duration || 0;
  });

  let students = [...studentMap.values()].sort((a, b) => a.originalName.localeCompare(b.originalName));

  // Apply overrides
  students = students.map(st => {
    const ov = overrides[st.originalName] || {};
    return {
      ...st,
      displayName: ov.name || st.originalName,
      fee: ov.fee || 0,
      completed: ov.completed || false
    };
  });

  // Chia: active va completed
  const active = students.filter(s => !s.completed);
  const completed = students.filter(s => s.completed);

  if (countEl) countEl.textContent = active.length + ' học viên' + (completed.length > 0 ? ' · ' + completed.length + ' đã xong' : '');

  if (students.length === 0) {
    root.innerHTML = '<p class="muted">Chưa có dữ liệu từ Google Calendar.</p>';
    return;
  }

  let html = '';

  // Active students
  html += active.map(st => renderStudentCard(st, false)).join('');

  // Completed (collapsed)
  if (completed.length > 0) {
    html += '<div class="completed-section"><h4 class="completed-header" onclick="toggleCompleted()">✅ Đã hoàn thành (' + completed.length + ') <span id="completed-arrow">▸</span></h4><div id="completed-list" style="display:none">';
    html += completed.map(st => renderStudentCard(st, true)).join('');
    html += '</div></div>';
  }

  root.innerHTML = html;
}

function renderStudentCard(st, isCompleted) {
  const done = st.sessions.filter(s => s.status === 'Done').length;
  const upcoming = st.sessions.filter(s => s.status !== 'Done').length;
  const hours = Math.floor(st.totalMin / 60);
  const mins = st.totalMin % 60;
  const feeDisplay = st.fee > 0 ? Math.round(st.fee / 1000) + 'k/buổi' : 'Chưa set';
  const earnedDisplay = Math.round(st.totalFee / 1000) + 'k';
  const opacity = isCompleted ? 'opacity:0.6;' : '';
  const key = st.originalName.replace(/'/g, "\\'");

  return '<div class="student-card-auto" style="' + opacity + '">' +
    '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<div class="student-name">' + st.displayName + '</div>' +
      '<label class="switch"><input type="checkbox" ' + (isCompleted ? 'checked' : '') + ' onchange="toggleStudentCompleted(\'' + key + '\', this.checked)"><span class="slider"></span></label>' +
    '</div>' +
    '<div class="student-meta">' +
      '<span>📚 ' + st.sessions.length + ' buổi (' + done + ' xong, ' + upcoming + ' sắp tới)</span>' +
      '<span>⏱️ ' + hours + 'h' + (mins > 0 ? mins + 'p' : '') + '</span>' +
      '<span>💰 ' + feeDisplay + ' · Đã thu: ' + earnedDisplay + '</span>' +
    '</div>' +
    '<div style="margin-top:10px;display:flex;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" onclick="editStudent(\'' + key + '\')">✏️ Sửa</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="showStudentDetail(\'' + key + '\')">👁️ Chi tiết</button>' +
    '</div></div>';
}

function toggleCompleted() {
  const list = document.getElementById('completed-list');
  const arrow = document.getElementById('completed-arrow');
  if (!list) return;
  if (list.style.display === 'none') {
    list.style.display = 'block';
    if (arrow) arrow.textContent = '▾';
  } else {
    list.style.display = 'none';
    if (arrow) arrow.textContent = '▸';
  }
}

function toggleStudentCompleted(originalName, checked) {
  const overrides = getStudentOverrides();
  if (!overrides[originalName]) overrides[originalName] = {};
  overrides[originalName].completed = checked;
  saveStudentOverrides(overrides);
  renderStudents();
}

function editStudent(originalName) {
  const overrides = getStudentOverrides();
  const ov = overrides[originalName] || {};
  const currentName = ov.name || originalName;
  const currentFee = ov.fee || 0;

  const newName = prompt('Tên hiển thị:', currentName);
  if (newName === null) return;
  const newFee = prompt('Học phí / buổi (VNĐ):', currentFee);
  if (newFee === null) return;

  if (!overrides[originalName]) overrides[originalName] = {};
  overrides[originalName].name = newName.trim() || originalName;
  overrides[originalName].fee = parseInt(newFee) || 0;
  saveStudentOverrides(overrides);
  renderStudents();
}

function showStudentDetail(originalName) {
  const all = (typeof getAllSessions === 'function') ? getAllSessions() : [];
  const sessions = all.filter(s => s.student === originalName);
  const overrides = getStudentOverrides();
  const ov = overrides[originalName] || {};
  const displayName = ov.name || originalName;
  const fee = ov.fee || 0;

  const done = sessions.filter(s => s.status === 'Done');
  const upcoming = sessions.filter(s => s.status !== 'Done').sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalFee = done.reduce((sum, s) => sum + (s.fee || 0), 0);
  const totalMin = done.reduce((sum, s) => sum + (s.duration || 0), 0);

  const panel = document.getElementById('rp-body');
  if (!panel) return;

  panel.innerHTML = '<h3 style="margin-bottom:4px">' + displayName + '</h3>' +
    '<p class="muted" style="margin-bottom:16px">' + originalName + '</p>' +
    '<div class="student-meta" style="margin-bottom:16px">' +
      '<span>📚 Tổng: ' + sessions.length + ' buổi (' + done.length + ' xong)</span>' +
      '<span>⏱️ ' + Math.floor(totalMin / 60) + 'h' + (totalMin % 60 > 0 ? totalMin % 60 + 'p' : '') + '</span>' +
      '<span>💰 Học phí: ' + (fee > 0 ? Math.round(fee / 1000) + 'k/buổi' : 'Chưa set') + '</span>' +
      '<span>💰 Đã thu: ' + Math.round(totalFee / 1000) + 'k</span>' +
    '</div>' +
    (upcoming.length > 0 ? '<h4 style="margin-bottom:8px;color:var(--accent)">Sắp tới</h4>' + upcoming.slice(0, 5).map(s => {
      const d = new Date(s.date);
      return '<div class="upcoming-item"><span class="upcoming-time">' + d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric' }) + '</span><span class="upcoming-name">' + s.name + '</span></div>';
    }).join('') : '') +
    (done.length > 0 ? '<h4 style="margin:12px 0 8px;color:var(--text-muted)">Lịch sử</h4>' + done.slice(-5).reverse().map(s => {
      const d = new Date(s.date);
      return '<div class="upcoming-item" style="opacity:0.7"><span class="upcoming-time">' + d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }) + '</span><span class="upcoming-name">' + s.name + '</span><span class="upcoming-fee">' + Math.round((s.fee || 0) / 1000) + 'k</span></div>';
    }).join('') : '');

  openRightPanel();
}

// Lay danh sach hoc vien active (cho group tag input)
function getActiveStudentNames() {
  const all = (typeof getAllSessions === 'function') ? getAllSessions() : [];
  const overrides = getStudentOverrides();
  const names = [...new Set(all.map(s => s.student).filter(Boolean))];
  return names.filter(n => !(overrides[n]?.completed));
}
