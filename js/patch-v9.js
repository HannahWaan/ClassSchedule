/* ============================================================
   PATCH-V9.JS — NẠP CUỐI CÙNG (sau patch-v8.js)
   (1) Nút "Xóa toàn bộ" hoạt động + an toàn
   (2) Danh sách học viên KHÔNG tự lấy tên từ Calendar
   (3) Đề xuất: Thêm im lặng / Ẩn / Gộp bằng modal
   (4) Thời lượng: gõ thẳng số phút
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function k(s) { return (typeof csKey === 'function') ? csKey(s) : String(s || '').trim().toLowerCase(); }
  function enc(s) { return (typeof encodeKey === 'function') ? encodeKey(s) : encodeURIComponent(s); }
  function dec(s) { return (typeof decodeKey === 'function') ? decodeKey(s) : decodeURIComponent(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(m, t) { if (typeof csToast === 'function') csToast(m, t); }
  function redraw() {
    if (typeof StatsCore !== 'undefined' && StatsCore.invalidate) StatsCore.invalidate();
    try { renderStudents(); } catch (e) {}
    try { updateDashboard(); } catch (e) {}
    try { updateStats(); } catch (e) {}
  }

  /* ============ 1. DANH SÁCH CHỈ GỒM HV BẠN TỰ THÊM ============ */
  function registeredKeys() {
    var set = {};
    (typeof getStudentData === 'function' ? getStudentData() : []).forEach(function (s) {
      set[k(s.name)] = 1;
      var al = s.aliases || [];
      if (typeof al === 'string') al = al.split(/[;,]/);
      al.forEach(function (a) { if (a) set[k(a)] = 1; });
    });
    return set;
  }
  window.csRegisteredKeys = registeredKeys;

  var _getAll = window.getAllStudents;
  if (typeof _getAll === 'function') {
    window.getAllStudents = function () {
      var list = _getAll.apply(this, arguments) || [];
      var reg = registeredKeys();
      return list.filter(function (s) { return reg[s.key || k(s.name)]; });
    };
  }

  /* ============ 2. DANH SÁCH "ẨN KHỎI ĐỀ XUẤT" ============ */
  var DIS = 'cs-dismissed-suggestions';
  function dismissed() {
    try { return JSON.parse(localStorage.getItem(DIS) || '[]') || []; } catch (e) { return []; }
  }
  function saveDismissed(a) { localStorage.setItem(DIS, JSON.stringify(a)); }
  window.csDismiss = function (name) {
    var a = dismissed(), key = k(name);
    if (a.indexOf(key) === -1) a.push(key);
    saveDismissed(a);
  };
  window.csUndismiss = function (encKey) {
    var key = k(dec(encKey));
    saveDismissed(dismissed().filter(function (x) { return x !== key; }));
    try { csRenderInbox(); } catch (e) {}
    renderHiddenList();
  };

  var _cand = window.csCandidates;
  if (typeof _cand === 'function') {
    window.csCandidates = function () {
      var d = {}; dismissed().forEach(function (x) { d[x] = 1; });
      return (_cand.apply(this, arguments) || []).filter(function (c) { return !d[c.key]; });
    };
  }

  /* ============ 3. THÊM / ẨN / LOẠI HẲN ============ */
  window.csInboxAdd = function (encKey) {
    var name = (typeof csNormalizeName === 'function') ? csNormalizeName(dec(encKey)) : dec(encKey);
    var data = getStudentData();
    if (!data.some(function (s) { return k(s.name) === k(name); })) {
      data.push({
        id: 'manual-' + Date.now(), name: name, feeType: 'per-session', fee: 0,
        schedules: [], repeat: 'weekly', note: '', completed: false, group: '', aliases: []
      });
      saveStudentData(data);
    }
    redraw();
    try { csRenderInbox(); } catch (e) {}
    toast('Đã thêm "' + name + '". Bấm ✏️ để đặt học phí.', 'ok');
  };

  window.csInboxIgnore = function (encKey) {
    var name = dec(encKey);
    csDismiss(name);
    try { csRenderInbox(); } catch (e) {}
    renderHiddenList();
    toast('Đã ẩn "' + name + '" khỏi đề xuất (dữ liệu vẫn còn)');
  };

  window.csInboxDrop = function (encKey) {
    var name = dec(encKey);
    if (!confirm('LOẠI HẲN "' + name + '"?\n\nTên này sẽ không tính vào thống kê nữa.\n' +
      'Sự kiện trên Google Calendar KHÔNG bị xóa.\n\nCó thể phục hồi ở tab Hồ sơ.')) return;
    if (typeof csIgnore === 'function') csIgnore(name);
    redraw();
    try { csRenderInbox(); } catch (e) {}
    toast('Đã loại "' + name + '"');
  };

  /* ============ 4. GỘP BẰNG MODAL ============ */
  var _mergeSrc = '';
  window.csInboxMerge = function (encKey) {
    _mergeSrc = (typeof csNormalizeName === 'function') ? csNormalizeName(dec(encKey)) : dec(encKey);
    var list = getStudentData().filter(function (s) { return k(s.name) !== k(_mergeSrc); });
    if (!list.length) { alert('Chưa có học viên nào trong danh sách để gộp vào.\nHãy bấm "➕ Thêm" cho một tên trước.'); return; }
    var box = $('cs-merge-modal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'cs-merge-modal';
      box.className = 'modal-backdrop';
      box.innerHTML =
        '<div class="modal-box">' +
          '<div class="modal-top"><h3>🔗 Gộp tên</h3>' +
            '<button class="modal-x" onclick="csCloseMerge()">✕</button></div>' +
          '<p class="danger-desc">Gộp <b id="cs-merge-src"></b> vào một học viên đã có. ' +
            'Tên này sẽ thành "tên khác trên Calendar" của người đó.</p>' +
          '<div class="field"><label>Tìm</label>' +
            '<input type="text" id="cs-merge-q" placeholder="Gõ để lọc..." oninput="csMergeFilter()"></div>' +
          '<div id="cs-merge-list" class="cs-merge-list"></div>' +
        '</div>';
      document.body.appendChild(box);
    }
    $('cs-merge-src').textContent = _mergeSrc;
    $('cs-merge-q').value = '';
    box.hidden = false;
    box.style.display = 'flex';
    csMergeFilter();
    setTimeout(function () { $('cs-merge-q').focus(); }, 50);
  };

  window.csCloseMerge = function () {
    var b = $('cs-merge-modal');
    if (b) { b.hidden = true; b.style.display = 'none'; }
  };

  window.csMergeFilter = function () {
    var q = k($('cs-merge-q') ? $('cs-merge-q').value : '');
    var list = getStudentData().filter(function (s) {
      return k(s.name) !== k(_mergeSrc) && (!q || k(s.name).indexOf(q) !== -1);
    });
    var el = $('cs-merge-list');
    if (!el) return;
    el.innerHTML = list.length
      ? list.map(function (s) {
          return '<button type="button" class="cs-merge-item" onclick="csDoMerge(\'' + enc(s.name) + '\')">' +
            esc(s.name) + (s.group ? ' <span class="muted">· ' + esc(s.group) + '</span>' : '') + '</button>';
        }).join('')
      : '<p class="muted">Không có tên nào khớp.</p>';
  };

  window.csDoMerge = function (encTarget) {
    var target = dec(encTarget);
    var data = getStudentData();
    var row = data.filter(function (s) { return k(s.name) === k(target); })[0];
    if (!row) return;
    var al = row.aliases || [];
    if (typeof al === 'string') al = al.split(/[;,]/);
    al = al.map(function (x) {
      return (typeof csNormalizeName === 'function') ? csNormalizeName(x) : String(x).trim();
    }).filter(Boolean);
    if (al.indexOf(_mergeSrc) === -1) al.push(_mergeSrc);
    row.aliases = al;
    saveStudentData(data);
    csCloseMerge();
    redraw();
    try { csRenderInbox(); } catch (e) {}
    toast('Đã gộp "' + _mergeSrc + '" vào "' + target + '"', 'ok');
  };

  /* ============ 5. VẼ LẠI KHU ĐỀ XUẤT (nút Ẩn / Loại) ============ */
  var MAX = 5, showAll = false;
  function inboxOpen() { return localStorage.getItem('cs-inbox-open') === '1'; }
  window.csToggleInbox = function () {
    localStorage.setItem('cs-inbox-open', inboxOpen() ? '0' : '1');
    showAll = false; csRenderInbox();
  };
  window.csInboxMore = function () { showAll = !showAll; csRenderInbox(); };

  window.csRenderInbox = function () {
    var page = $('page-students');
    if (!page || typeof csCandidates !== 'function') return;
    var box = $('cs-inbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'cs-inbox';
      page.insertBefore(box, $('students-root') || page.firstChild);
    }
    var list = [];
    try { list = csCandidates() || []; } catch (e) { return; }
    if (!list.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = '';

    var open = inboxOpen();
    var html = '<button type="button" class="cs-bar" onclick="csToggleInbox()">' +
      '<span>🆕 Tên mới trên Calendar</span><span class="cs-badge">' + list.length + '</span>' +
      '<span class="cs-chev">' + (open ? '▲ Ẩn' : '▼ Xem') + '</span></button>';

    if (open) {
      var rows = showAll ? list : list.slice(0, MAX);
      html += '<div class="cs-inbox-list"><div class="cs-hint">Chưa có trong danh sách học viên. ' +
        'Thêm nếu đang dạy, Ẩn nếu chưa muốn quyết định.</div>' +
        rows.map(function (c) {
          var d = new Date(c.last).toLocaleDateString('vi-VN',
            { day: '2-digit', month: '2-digit', year: '2-digit' });
          var e2 = enc(c.name);
          return '<div class="cs-row"><div class="cs-row-main"><b>' + esc(c.name) + '</b>' +
            '<span>' + c.count + ' buổi · gần nhất ' + d + '</span></div><div class="cs-row-act">' +
            '<button class="btn btn-primary btn-sm" onclick="csInboxAdd(\'' + e2 + '\')">➕ Thêm</button>' +
            '<button class="btn btn-outline btn-sm" onclick="csInboxMerge(\'' + e2 + '\')">🔗 Gộp</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="csInboxIgnore(\'' + e2 + '\')">👁 Ẩn</button>' +
            '<button class="btn btn-ghost btn-sm" title="Loại khỏi thống kê" ' +
              'onclick="csInboxDrop(\'' + e2 + '\')">🚫</button>' +
            '</div></div>';
        }).join('') +
        (list.length > MAX
          ? '<button type="button" class="cs-more" onclick="csInboxMore()">' +
            (showAll ? 'Thu gọn' : 'Xem thêm ' + (list.length - MAX) + ' tên') + '</button>' : '') +
        '</div>';
    }
    box.innerHTML = html;
  };

  /* ============ 6. THỜI LƯỢNG: GÕ SỐ PHÚT ============ */
  function plainDuration(id) {
    var sel = $(id + '-sel'), inp = $(id);
    if (!inp) return;
    if (sel) sel.style.display = 'none';
    inp.style.display = '';
    inp.style.maxWidth = '120px';
    inp.setAttribute('inputmode', 'numeric');
    inp.placeholder = 'VD: 40';
    var row = inp.parentNode;
    if (row && !row.querySelector('.cs-dur-unit')) {
      var u = document.createElement('span');
      u.className = 'cs-dur-unit';
      u.textContent = 'phút';
      row.insertBefore(u, inp.nextSibling);
    }
  }
  ['openAddStudentModal', 'openEditStudent', 'openGroupModal', 'openEditGroup'].forEach(function (fn) {
    var o = window[fn];
    if (typeof o !== 'function') return;
    window[fn] = function () {
      var r = o.apply(this, arguments);
      setTimeout(function () { plainDuration('sf-duration'); plainDuration('gf-duration'); }, 0);
      return r;
    };
  });

  function plainDefaultDuration() {
    var sel = $('cs-def-dur');
    if (!sel || sel.tagName !== 'SELECT') return;
    var inp = document.createElement('input');
    inp.type = 'number'; inp.id = 'cs-def-dur'; inp.min = '5'; inp.max = '600';
    inp.value = (typeof csDefaultDuration === 'function') ? csDefaultDuration() : 60;
    inp.onchange = function () { csSetDefaultDuration(this.value); };
    sel.parentNode.replaceChild(inp, sel);
  }

  /* ============ 7. NÚT XÓA TOÀN BỘ ============ */
  function backupNow() {
    var dump = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key.indexOf('cs-') === 0) dump[key] = localStorage.getItem(key);
    }
    var blob = new Blob([JSON.stringify({ at: new Date().toISOString(), data: dump }, null, 2)],
      { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'classschedule-backup-truoc-khi-xoa-' +
      new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  window.confirmNuke = function () {
    var n = 0;
    for (var i = 0; i < localStorage.length; i++) {
      if (String(localStorage.key(i)).indexOf('cs-') === 0) n++;
    }
    if (!confirm('Sắp XÓA TOÀN BỘ dữ liệu trong app: học viên, lớp nhóm, học phí, ' +
      'thanh toán, thời lượng, cài đặt (' + n + ' mục).\n\n' +
      'Google Calendar KHÔNG bị đụng tới.\n\n' +
      'Bấm OK để tải file sao lưu trước.')) return;
    backupNow();
    var typed = prompt('Đã tải file sao lưu.\n\nGõ chính xác   XOA   rồi bấm OK để xóa:');
    if (String(typed || '').trim().toUpperCase() !== 'XOA') { toast('Đã hủy, không xóa gì cả.'); return; }
    var keys = [];
    for (var j = 0; j < localStorage.length; j++) {
      var key2 = localStorage.key(j);
      if (String(key2).indexOf('cs-') === 0) keys.push(key2);
    }
    keys.forEach(function (key3) { localStorage.removeItem(key3); });
    alert('Đã xóa ' + keys.length + ' mục. Trang sẽ tải lại.');
    location.reload();
  };

  /* ============ 8. HỒ SƠ: DANH SÁCH TÊN ĐANG ẨN ============ */
  function renderHiddenList() {
    var el = $('cs-hidden-sugg');
    if (!el) return;
    var a = dismissed();
    el.innerHTML = a.length
      ? a.map(function (key) {
          return '<span class="tag-chip">' + esc(key) +
            ' <button type="button" title="Hiện lại" onclick="csUndismiss(\'' + enc(key) + '\')">↩</button></span>';
        }).join('')
      : '<span class="muted">Không có tên nào đang ẩn.</span>';
  }
  window.csRenderHiddenList = renderHiddenList;

  function injectHiddenCard() {
    var page = $('page-profile');
    if (!page || $('cs-hidden-card')) return;
    var card = document.createElement('div');
    card.className = 'profile-card';
    card.id = 'cs-hidden-card';
    card.innerHTML = '<div class="settings-group-title">👁 Tên đang ẩn khỏi đề xuất</div>' +
      '<p class="danger-desc">Bấm ↩ để hiện lại trong khu "Tên mới trên Calendar".</p>' +
      '<div id="cs-hidden-sugg" class="tag-wrap"></div>';
    page.appendChild(card);
    renderHiddenList();
  }

  /* ============ 9. CSS + KHỞI ĐỘNG ============ */
  function css() {
    if ($('cs-v9-css')) return;
    var s = document.createElement('style');
    s.id = 'cs-v9-css';
    s.textContent =
      '#cs-merge-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:800;' +
        'display:none;align-items:center;justify-content:center;padding:20px}' +
      '#cs-merge-modal .modal-box{max-width:440px;width:100%;background:var(--surface);' +
        'border:1px solid var(--border);border-radius:var(--radius);padding:20px}' +
      '.cs-merge-list{display:flex;flex-direction:column;gap:4px;max-height:280px;overflow:auto;margin-top:8px}' +
      '.cs-merge-item{text-align:left;padding:9px 12px;background:var(--bg3);border:1px solid var(--border);' +
        'border-radius:var(--radius-xs);color:var(--text);font-size:.82rem;cursor:pointer;font-family:var(--font)}' +
      '.cs-merge-item:hover{border-color:var(--accent);color:var(--accent)}' +
      '.cs-dur-unit{font-size:.78rem;color:var(--text3)}' +
      '.tag-wrap{display:flex;flex-wrap:wrap;gap:6px}';
    document.head.appendChild(s);
  }

  var _switch = window.switchTab;
  window.switchTab = function (tab) {
    var r = _switch ? _switch.apply(this, arguments) : undefined;
    if (tab === 'profile') { injectHiddenCard(); renderHiddenList(); plainDefaultDuration(); }
    if (tab === 'students') { try { csRenderInbox(); } catch (e) {} }
    return r;
  };

  function init() {
    css(); injectHiddenCard(); plainDefaultDuration();
    redraw();
    try { csRenderInbox(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  console.log('✅ patch-v9 loaded');
})();
