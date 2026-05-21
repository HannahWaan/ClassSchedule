/* ===== GROUPS.JS - Lớp nhóm ===== */

function getGroups() {
  try { return JSON.parse(localStorage.getItem('cs-groups-v2') || '[]'); } catch(e) { return []; }
}
function saveGroups(groups) {
  localStorage.setItem('cs-groups-v2', JSON.stringify(groups));
}

function renderGroups() {
  var root = document.getElementById('groups-root');
  if (!root) return;
  var groups = getGroups();

  if (groups.length === 0) {
    root.innerHTML = '<p class="muted">Chưa có lớp nhóm. Bấm "Tạo lớp nhóm" để bắt đầu.</p>';
    return;
  }

  var allSessions = (typeof getAllSessions === 'function') ? getAllSessions() : [];

  root.innerHTML = groups.map(function(g, i) {
    var memberSessions = allSessions.filter(function(s) { return g.members.indexOf(s.student) !== -1; });
    var doneSessions = memberSessions.filter(function(s) { return s.status === 'Done'; });
    var totalFee = doneSessions.length * (g.fee || 0);

    return '<div class="group-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div>' +
          '<h4>' + g.name + '</h4>' +
          (g.program ? '<p>📖 ' + g.program + '</p>' : '') +
          '<p>💰 ' + formatVND(g.fee || 0) + '/buổi</p>' +
          '<p>📚 ' + doneSessions.length + ' buổi đã dạy · 💵 ' + formatVND(totalFee) + '</p>' +
          '<div class="group-members">' + g.members.map(function(m) { return '<span class="group-member-tag">' + m + '</span>'; }).join('') + '</div>' +
          (g.note ? '<p style="font-size:.78rem;color:var(--text3);margin-top:6px">📝 ' + g.note + '</p>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px">' +
          '<button class="btn btn-ghost btn-sm" onclick="openEditGroup(' + i + ')">✏️</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="deleteGroup(' + i + ')">🗑️</button>' +
        '</div>' +
      '</div></div>';
  }).join('');
}

function openGroupModal() {
  document.getElementById('group-modal-title').textContent = 'Tạo lớp nhóm';
  document.getElementById('gf-id').value = '';
  document.getElementById('gf-name').value = '';
  document.getElementById('gf-fee').value = '';
  document.getElementById('gf-program').value = '';
  document.getElementById('gf-note').value = '';
  window._groupMembers = [];
  renderGroupChips();
  setupGroupTagInput();
  document.getElementById('modal-group').hidden = false;
}

function openEditGroup(i) {
  var groups = getGroups();
  var g = groups[i];
  if (!g) return;
  document.getElementById('group-modal-title').textContent = 'Sửa lớp nhóm';
  document.getElementById('gf-id').value = String(i);
  document.getElementById('gf-name').value = g.name;
  document.getElementById('gf-fee').value = g.fee || '';
  document.getElementById('gf-program').value = g.program || '';
  document.getElementById('gf-note').value = g.note || '';
  window._groupMembers = g.members ? g.members.slice() : [];
  renderGroupChips();
  setupGroupTagInput();
  document.getElementById('modal-group').hidden = false;
}

function closeGroupModal() { document.getElementById('modal-group').hidden = true; }

function setupGroupTagInput() {
  var search = document.getElementById('gf-search');
  var dropdown = document.getElementById('gf-dropdown');
  if (!search || !dropdown) return;

  search.oninput = function() {
    var names = (typeof getActiveStudentNames === 'function') ? getActiveStudentNames() : [];
    var q = this.value.toLowerCase();
    var filtered = names.filter(function(n) {
      return n.toLowerCase().indexOf(q) !== -1 && (window._groupMembers || []).indexOf(n) === -1;
    });
    dropdown.innerHTML = filtered.map(function(n) {
      return '<div class="tag-option" onclick="addGroupMember(\'' + encodeKey(n) + '\')">' + n + '</div>';
    }).join('');
    dropdown.style.display = filtered.length ? 'block' : 'none';
  };
}

function addGroupMember(key) {
  var name = decodeKey(key);
  if (!window._groupMembers) window._groupMembers = [];
  if (window._groupMembers.indexOf(name) !== -1) return;
  window._groupMembers.push(name);
  renderGroupChips();
  document.getElementById('gf-search').value = '';
  document.getElementById('gf-dropdown').style.display = 'none';
}

function removeGroupMember(key) {
  var name = decodeKey(key);
  window._groupMembers = (window._groupMembers || []).filter(function(n) { return n !== name; });
  renderGroupChips();
}

function renderGroupChips() {
  var chips = document.getElementById('gf-chips');
  if (!chips) return;
  chips.innerHTML = (window._groupMembers || []).map(function(n) {
    return '<span class="tag-chip">' + n + ' <button type="button" onclick="removeGroupMember(\'' + encodeKey(n) + '\')">✕</button></span>';
  }).join('');
}

function saveGroup(e) {
  e.preventDefault();
  var editIdx = document.getElementById('gf-id').value;
  var name = document.getElementById('gf-name').value.trim();
  var fee = parseInt(document.getElementById('gf-fee').value) || 0;
  var program = document.getElementById('gf-program').value.trim();
  var note = document.getElementById('gf-note').value.trim();
  var members = window._groupMembers || [];

  if (!name) return alert('Nhập tên lớp nhóm');
  if (members.length === 0) return alert('Chọn ít nhất 1 thành viên');

  var groups = getGroups();
  var obj = { name: name, fee: fee, program: program, note: note, members: members };

  if (editIdx !== '') {
    groups[parseInt(editIdx)] = obj;
  } else {
    groups.push(obj);
  }

  saveGroups(groups);
  closeGroupModal();
  renderGroups();
}

function deleteGroup(i) {
  if (!confirm('Xóa lớp nhóm này?')) return;
  var groups = getGroups();
  groups.splice(i, 1);
  saveGroups(groups);
  renderGroups();
}
