/* ===== GROUPS - Gop hoc vien tu GCal ===== */

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

  const all = (typeof getAllSessions === 'function') ? getAllSessions() : [];

  root.innerHTML = groups.map((g, i) => {
    const memberSessions = all.filter(s => g.members.includes(s.student));
    const doneSessions = memberSessions.filter(s => s.status === 'Done');
    const totalFee = g.feeType === 'group'
      ? doneSessions.length * (g.groupFee || 0)
      : doneSessions.reduce((sum, s) => sum + (s.fee || 0), 0);
    const feeLabel = g.feeType === 'group'
      ? Math.round((g.groupFee || 0) / 1000) + 'k/buổi (cả nhóm)'
      : 'Mỗi người 1 học phí';

    return '<div class="student-card-auto">' +
      '<div class="student-name">' + g.name + ' <span style="font-size:0.8rem;color:var(--text-muted)">(' + g.members.length + ' học viên)</span></div>' +
      '<div class="student-meta">' +
        '<span>👥 ' + g.members.join(', ') + '</span>' +
        (g.program ? '<span>📖 ' + g.program + '</span>' : '') +
        '<span>💰 ' + feeLabel + '</span>' +
        '<span>💵 Đã thu: ' + Math.round(totalFee / 1000) + 'k</span>' +
        '<span>📚 ' + doneSessions.length + ' buổi đã dạy</span>' +
      '</div>' +
      '<div style="margin-top:10px;display:flex;gap:8px">' +
        '<button class="btn btn-ghost btn-sm" onclick="editGroup(' + i + ')">✏️ Sửa</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="deleteGroup(' + i + ')">🗑️ Xóa</button>' +
      '</div></div>';
  }).join('');
}

function populateGroupTagInput() {
  const names = (typeof getActiveStudentNames === 'function') ? getActiveStudentNames() : [];
  const dropdown = document.getElementById('g-dropdown');
  const search = document.getElementById('g-search');
  if (!dropdown || !search) return;

  window._groupTagMembers = window._groupTagMembers || [];

  search.oninput = function() {
    const q = this.value.toLowerCase();
    const filtered = names.filter(n => n.toLowerCase().includes(q) && !window._groupTagMembers.includes(n));
    dropdown.innerHTML = filtered.map(n => '<div class="tag-option" onclick="addGroupMember(\'' + n.replace(/'/g, "\\'") + '\')">' + n + '</div>').join('');
    dropdown.style.display = filtered.length ? 'block' : 'none';
  };
}

function addGroupMember(name) {
  if (!window._groupTagMembers) window._groupTagMembers = [];
  if (window._groupTagMembers.includes(name)) return;
  window._groupTagMembers.push(name);
  renderGroupChips();
  document.getElementById('g-search').value = '';
  document.getElementById('g-dropdown').style.display = 'none';
}

function removeGroupMember(name) {
  window._groupTagMembers = (window._groupTagMembers || []).filter(n => n !== name);
  renderGroupChips();
}

function renderGroupChips() {
  const chips = document.getElementById('g-chips');
  if (!chips) return;
  chips.innerHTML = (window._groupTagMembers || []).map(n => '<span class="tag-chip">' + n + ' <button type="button" onclick="removeGroupMember(\'' + n.replace(/'/g, "\\'") + '\')">✕</button></span>').join('');
}

// Save group form
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('group-form');
  if (form) form.onsubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById('g-name').value.trim();
    const program = document.getElementById('g-program')?.value.trim() || '';
    const note = document.getElementById('g-note')?.value.trim() || '';
    if (!name || !(window._groupTagMembers || []).length) return alert('Nhập tên nhóm và chọn ít nhất 1 học viên');

    // Hoi loai hoc phi
    const feeType = confirm('Nhóm này tính 1 học phí chung?\n\nOK = 1 học phí cả nhóm\nCancel = Mỗi người 1 học phí') ? 'group' : 'individual';
    let groupFee = 0;
    if (feeType === 'group') {
      const input = prompt('Học phí cả nhóm / buổi (VNĐ):', '0');
      groupFee = parseInt(input) || 0;
    }

    const groups = getGroups();
    groups.push({ name, program, note, members: [...window._groupTagMembers], feeType, groupFee });
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
  groups.splice(i, 1);
  saveGroups(groups);
}
