/* ===== GROUPS - Gop hoc vien tu GCal ===== */

// Groups luu local (localStorage vi don gian)
function getGroups() {
  try { return JSON.parse(localStorage.getItem('cs-groups') || '[]'); } catch(e) { return []; }
}
function saveGroups(groups) {
  localStorage.setItem('cs-groups', JSON.stringify(groups));
}

function renderGroups() {
  const root = document.getElementById('groups-root');
  if (!root) return;
  const groups = getGroups();

  if (groups.length === 0) {
    root.innerHTML = '<p class="muted">Chưa có nhóm nào. Bấm "Tạo nhóm" để gộp học viên.</p>';
    return;
  }

  const all = getAllSessions ? getAllSessions() : [];

  root.innerHTML = groups.map((g, i) => {
    // Tinh thong ke cho nhom
    const memberSessions = all.filter(s => g.members.includes(s.student));
    const totalFee = memberSessions.filter(s => s.status === 'Done').reduce((sum, s) => sum + (s.fee||0), 0);
    return '<div class="student-card-auto">' +
      '<div class="student-name">' + g.name + ' <span style="font-size:0.8rem;color:var(--text-muted)">(' + g.members.length + ' học viên)</span></div>' +
      '<div class="student-meta">' +
        '<span>👥 ' + g.members.join(', ') + '</span>' +
        (g.program ? '<span>📖 ' + g.program + '</span>' : '') +
        '<span>💰 ' + Math.round(totalFee/1000) + 'k (đã thu)</span>' +
      '</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px">' +
        '<button class="btn btn-ghost btn-sm" onclick="showGroupDetail(' + i + ')">👁️</button>' + '<button class="btn btn-ghost btn-sm" onclick="editGroup(' + i + ')">✏️</button>' +
        '<button class="btn btn-ghost" onclick="deleteGroup(' + i + ')">🗑️</button>' +
      '</div></div>';
  }).join('');
}

function openGroupModal() {
  document.getElementById('modal-group').hidden = false;
  populateGroupTagInput();
}
function closeGroupModal() { document.getElementById('modal-group').hidden = true; }

function populateGroupTagInput() {
  // Lay danh sach hoc vien tu GCal
  const all = getAllSessions ? getAllSessions() : [];
  const names = [...new Set(all.map(s => s.student).filter(Boolean))].sort();
  const dropdown = document.getElementById('g-dropdown');
  const search = document.getElementById('g-search');
  if (!dropdown || !search) return;

  window._groupTagMembers = [];

  search.oninput = function() {
    const q = this.value.toLowerCase();
    const filtered = names.filter(n => n.toLowerCase().includes(q) && !window._groupTagMembers.includes(n));
    dropdown.innerHTML = filtered.map(n => '<div class="tag-option" onclick="addGroupMember(\'' + n.replace(/'/g,"\\'") + '\')">' + n + '</div>').join('');
    dropdown.style.display = filtered.length ? 'block' : 'none';
  };
}

function addGroupMember(name) {
  if (window._groupTagMembers.includes(name)) return;
  window._groupTagMembers.push(name);
  renderGroupChips();
  document.getElementById('g-search').value = '';
  document.getElementById('g-dropdown').style.display = 'none';
}

function removeGroupMember(name) {
  window._groupTagMembers = window._groupTagMembers.filter(n => n !== name);
  renderGroupChips();
}

function renderGroupChips() {
  const chips = document.getElementById('g-chips');
  if (!chips) return;
  chips.innerHTML = window._groupTagMembers.map(n => '<span class="tag-chip">' + n + ' <button type="button" onclick="removeGroupMember(\'' + n.replace(/'/g,"\\'") + '\')">✕</button></span>').join('');
}

// Save group
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('group-form');
  if (form) form.onsubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById('g-name').value.trim();
    const program = document.getElementById('g-program')?.value.trim() || '';
    const note = document.getElementById('g-note')?.value.trim() || '';
    if (!name || !window._groupTagMembers.length) return alert('Nhập tên nhóm và chọn ít nhất 1 học viên');
    const groups = getGroups();
    groups.push({ name, program, note, members: [...window._groupTagMembers] });
    saveGroups(groups);
    closeGroupModal();
    renderGroups();
    form.reset();
    window._groupTagMembers = [];
    renderGroupChips();
  };
});

function deleteGroup(i) {
  if (!confirm('Xóa nhóm này?')) return;
  const groups = getGroups();
  groups.splice(i, 1);
  saveGroups(groups);
  renderGroups();
}

function editGroup(i) {
  const groups = getGroups();
  const g = groups[i];
  if (!g) return;
  document.getElementById('g-name').value = g.name;
  if (document.getElementById('g-program')) document.getElementById('g-program').value = g.program || '';
  if (document.getElementById('g-note')) document.getElementById('g-note').value = g.note || '';
  window._groupTagMembers = [...g.members];
  renderGroupChips();
  openGroupModal();
  // Xoa nhom cu khi save lai
  groups.splice(i, 1);
  saveGroups(groups);
}

function showGroupDetail(i) {
  const groups = getGroups();
  const g = groups[i];
  if (!g) return;
  const all = getAllSessions ? getAllSessions() : [];
  const memberSessions = all.filter(s => g.members.includes(s.student));
  const done = memberSessions.filter(s => s.status === 'Done');
  const totalFee = done.reduce((sum, s) => sum + (s.fee || 0), 0);
  const totalMin = done.reduce((sum, s) => sum + (s.duration || 0), 0);
  const panel = document.getElementById('rp-body');
  if (!panel) return;
  panel.innerHTML =
    '<h3 style="margin-bottom:12px">' + g.name + '</h3>' +
    (g.program ? '<p style="color:var(--accent2);margin-bottom:12px">📖 ' + g.program + '</p>' : '') +
    '<div class="student-meta" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">' +
      '<span>👥 ' + g.members.length + ' học viên</span>' +
      '<span>📚 ' + done.length + ' buổi đã dạy</span>' +
      '<span>⏱️ ' + Math.floor(totalMin/60) + 'h</span>' +
      '<span>💰 ' + Math.round(totalFee/1000) + 'k</span>' +
    '</div>' +
    '<h4 style="margin-bottom:8px;color:var(--accent)">Thành viên</h4>' +
    g.members.map(m => '<div class="upcoming-item"><span class="upcoming-name">' + m + '</span></div>').join('') +
    (g.note ? '<p style="margin-top:12px;color:var(--text3);font-size:.85rem">📝 ' + g.note + '</p>' : '');
  openRightPanel();
}
