/* ============================================================
   PATCH-V8.JS — Thời lượng buổi học
   NẠP CUỐI (sau patch-v6 / patch-v7 / patch-ui)
   - Mỗi học viên / lớp nhóm có thời lượng riêng: 40p, 1h, 1h30...
   - Tự điền giờ kết thúc khi thêm buổi dạy
   - Hiện đơn giá theo giờ trên thẻ học viên
   - Cảnh báo buổi lệch thời lượng thường lệ
   ============================================================ */
(function () {
  'use strict';

  var MAP_KEY = 'cs-durations-v1';
  var DEF_KEY = 'cs-default-duration';
  var PRESETS = [30, 40, 45, 50, 60, 75, 90, 120];

  function $(id) { return document.getElementById(id); }
  function k(s) { return (typeof csKey === 'function') ? csKey(s) : String(s || '').trim().toLowerCase(); }
  function vnd(n) { return (typeof csVND === 'function') ? csVND(n) : ((n || 0) + 'đ'); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 1. Lưu trữ ---------- */
  function readMap() {
    try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeMap(m) {
    localStorage.setItem(MAP_KEY, JSON.stringify(m));
    if (typeof StatsCore !== 'undefined' && StatsCore.invalidate) StatsCore.invalidate();
  }

  window.csDefaultDuration = function () {
    var v = parseInt(localStorage.getItem(DEF_KEY) || '', 10);
    return (v > 0 && v <= 600) ? v : 60;
  };
  window.csSetDefaultDuration = function (v) {
    v = parseInt(v, 10);
    if (!(v > 0 && v <= 600)) return;
    localStorage.setItem(DEF_KEY, String(v));
    refreshAll();
    if (typeof csToast === 'function') csToast('Mặc định: ' + csFmtDur(v));
  };

  window.csFmtDur = function (m) {
    m = parseInt(m, 10) || 0;
    if (m < 60) return m + 'p';
    var h = Math.floor(m / 60), r = m % 60;
    return h + 'h' + (r ? r + 'p' : '');
  };
  window.csPerHour = function (fee, mins) {
    fee = parseInt(fee, 10) || 0; mins = parseInt(mins, 10) || 0;
    if (!fee || !mins) return 0;
    return Math.round(fee * 60 / mins / 1000) * 1000;
  };

  window.csSetDuration = function (name, mins, isGroup) {
    var key = (isGroup ? 'g:' : '') + k(name);
    if (!k(name)) return;
    mins = parseInt(mins, 10);
    var m = readMap();
    if (mins > 0 && mins <= 600) m[key] = mins; else delete m[key];
    writeMap(m);
  };
  window.csClearDuration = function (encKey, isGroup) {
    var name = (typeof decodeKey === 'function') ? decodeKey(encKey) : encKey;
    var m = readMap();
    delete m[(isGroup ? 'g:' : '') + k(name)];
    writeMap(m);
    refreshAll();
  };

  window.csGroupDuration = function (gName) {
    var m = readMap(), key = 'g:' + k(gName);
    return (m[key] > 0) ? m[key] : csDefaultDuration();
  };

  /* Thứ tự ưu tiên: học viên -> lớp nhóm của HV -> mặc định */
  window.csDurationFor = function (name) {
    var m = readMap(), key = k(name);
    if (m[key] > 0) return m[key];
    if (m['g:' + key] > 0) return m['g:' + key];
    var reg = (typeof csRegistry === 'function') ? csRegistry() : {};
    var st = reg[key];
    if (st && st.group && m['g:' + k(st.group)] > 0) return m['g:' + k(st.group)];
    return csDefaultDuration();
  };
  window.csIsDurationSet = function (name) {
    var m = readMap(), key = k(name);
    if (m[key] > 0 || m['g:' + key] > 0) return true;
    var reg = (typeof csRegistry === 'function') ? csRegistry() : {};
    var st = reg[key];
    return !!(st && st.group && m['g:' + k(st.group)] > 0);
  };

  function refreshAll() {
    try { if (typeof renderStudents === 'function') renderStudents(); } catch (e) {}
    try { if (typeof renderGroups === 'function') renderGroups(); } catch (e) {}
    try { if (typeof updateDashboard === 'function') updateDashboard(); } catch (e) {}
    try { renderDurList(); } catch (e) {}
  }

  /* ---------- 2. Ô nhập trong modal ---------- */
  function durFieldHTML(id) {
    var opts = PRESETS.map(function (p) {
      return '<option value="' + p + '">' + csFmtDur(p) + '</option>';
    }).join('') + '<option value="custom">Khác…</option>';
    return '<div class="field cs-dur-field">' +
      '<label>Thời lượng mỗi buổi</label>' +
      '<div class="cs-dur-row">' +
        '<select id="' + id + '-sel" onchange="csDurSelChange(\'' + id + '\')">' + opts + '</select>' +
        '<input type="number" id="' + id + '" min="5" max="600" step="5" placeholder="phút" ' +
          'style="display:none;max-width:110px" oninput="csDurHint(\'' + id + '\')">' +
        '<span class="cs-dur-hint" id="' + id + '-hint"></span>' +
      '</div></div>';
  }

  window.csDurSelChange = function (id) {
    var sel = $(id + '-sel'), inp = $(id);
    if (!sel || !inp) return;
    if (sel.value === 'custom') { inp.style.display = ''; inp.focus(); }
    else { inp.style.display = 'none'; inp.value = sel.value; }
    csDurHint(id);
  };

  window.csDurHint = function (id) {
    var hint = $(id + '-hint');
    if (!hint) return;
    var mins = getDurUI(id);
    var feeEl = (id === 'sf-duration') ? $('sf-fee') : $('gf-fee');
    var fee = parseInt(feeEl && feeEl.value, 10) || 0;
    var tEl = $('sf-fee-type');
    var monthly = (id === 'sf-duration') && tEl && /month/.test(tEl.value);
    hint.textContent = (fee > 0 && !monthly) ? '≈ ' + vnd(csPerHour(fee, mins)) + '/giờ' : '';
  };

  function setDurUI(id, mins) {
    mins = parseInt(mins, 10) || csDefaultDuration();
    var sel = $(id + '-sel'), inp = $(id);
    if (!sel || !inp) return;
    inp.value = mins;
    if (PRESETS.indexOf(mins) !== -1) { sel.value = String(mins); inp.style.display = 'none'; }
    else { sel.value = 'custom'; inp.style.display = ''; }
    csDurHint(id);
  }
  function getDurUI(id) {
    var inp = $(id), v = parseInt(inp && inp.value, 10);
    return (v > 0 && v <= 600) ? v : csDefaultDuration();
  }

  function injectField(formId, inputId, anchorId, before) {
    if ($(inputId)) return;
    var form = $(formId); if (!form) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = durFieldHTML(inputId);
    var node = wrap.firstChild;
    var anchorInput = $(anchorId);
    var anchor = anchorInput ? anchorInput.parentNode : null;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(node, before ? anchor : anchor.nextSibling);
    } else {
      form.insertBefore(node, form.querySelector('.form-actions'));
    }
    if (anchorInput) anchorInput.addEventListener('input', function () { csDurHint(inputId); });
    var t = $('sf-fee-type');
    if (t && inputId === 'sf-duration') t.addEventListener('change', function () { csDurHint(inputId); });
  }
  function injectStudentField() { injectField('student-form', 'sf-duration', 'sf-fee', false); }
  function injectGroupField() { injectField('group-form', 'gf-duration', 'gf-fee', false); }

  /* ---------- 3. Gắn vào các hàm mở / lưu ---------- */
  function after(name, fn) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      try { fn.apply(this, arguments); } catch (e) { console.warn('patch-v8:' + name, e); }
      return r;
    };
  }

  after('openAddStudentModal', function () {
    injectStudentField(); setDurUI('sf-duration', csDefaultDuration());
  });
  after('openEditStudent', function () {
    injectStudentField();
    var n = $('sf-name') ? $('sf-name').value : '';
    setDurUI('sf-duration', csDurationFor(n));
  });
  after('openGroupModal', function () {
    injectGroupField(); setDurUI('gf-duration', csDefaultDuration());
  });
  after('openEditGroup', function () {
    injectGroupField();
    var n = $('gf-name') ? $('gf-name').value : '';
    setDurUI('gf-duration', csGroupDuration(n));
  });

  var _saveStudent = window.saveStudent;
  if (typeof _saveStudent === 'function') {
    window.saveStudent = function () {
      var nm = $('sf-name') ? $('sf-name').value : '';
      var mins = $('sf-duration') ? getDurUI('sf-duration') : 0;
      var r = _saveStudent.apply(this, arguments);
      if (nm && mins) { csSetDuration(nm, mins, false); refreshAll(); }
      return r;
    };
  }
  var _saveGroup = window.saveGroup;
  if (typeof _saveGroup === 'function') {
    window.saveGroup = function () {
      var nm = $('gf-name') ? $('gf-name').value : '';
      var mins = $('gf-duration') ? getDurUI('gf-duration') : 0;
      var r = _saveGroup.apply(this, arguments);
      if (nm && mins) { csSetDuration(nm, mins, true); refreshAll(); }
      return r;
    };
  }

  /* ---------- 4. Tự điền giờ kết thúc ở modal buổi dạy ---------- */
  window.csApplyDuration = function (force) {
    var idEl = $('ev-id');
    if (!force && idEl && idEl.value) return;      // đang sửa buổi cũ -> không tự đổi
    var t = $('ev-title'), s = $('ev-start'), e = $('ev-end');
    if (!t || !s || !e || !s.value) return;
    var mins = csDurationFor(t.value || '');
    var p = String(s.value).split(':');
    var d = new Date(2000, 0, 1, parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0);
    d.setMinutes(d.getMinutes() + mins);
    e.value = p2(d.getHours()) + ':' + p2(d.getMinutes());
    var hint = $('cs-ev-hint');
    if (hint) hint.textContent = '⏱ ' + csFmtDur(mins) +
      (csIsDurationSet(t.value) ? '' : ' (mặc định)');
  };

  function hookEventModal() {
    var t = $('ev-title'), s = $('ev-start'), e = $('ev-end');
    if (!t || !s || !e || t.getAttribute('data-cs-dur')) return;
    t.setAttribute('data-cs-dur', '1');

    var row = e.parentNode;
    if (row && !$('cs-ev-hint')) {
      var box = document.createElement('div');
      box.className = 'cs-ev-durbar';
      box.innerHTML = '<span class="cs-dur-hint" id="cs-ev-hint"></span>' +
        '<button type="button" class="btn btn-outline btn-sm" onclick="csApplyDuration(true)">⏱ Áp thời lượng</button>';
      row.appendChild(box);
    }
    var timer = null;
    t.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { csApplyDuration(false); }, 300);
    });
    s.addEventListener('change', function () { csApplyDuration(false); });
  }
  after('openAddEventModal', function () { hookEventModal(); csApplyDuration(false); });
  after('openEditEventModal', function () { hookEventModal(); });
  after('onSessionClick', function () { hookEventModal(); });

  /* ---------- 5. Thẻ học viên: thời lượng + đ/giờ ---------- */
  var _card = window.buildStudentCard;
  if (typeof _card === 'function') {
    window.buildStudentCard = function (st) {
      var html = _card.apply(this, arguments);
      try {
        var mins = csDurationFor(st.name);
        var monthly = String(st.feeType || '').indexOf('month') !== -1;
        var ph = monthly ? 0 : csPerHour(st.fee || 0, mins);
        var line = '<p class="cs-dur-line">⏳ ' + csFmtDur(mins) + '/buổi' +
          (csIsDurationSet(st.name) ? '' : ' <span class="muted">(mặc định)</span>') +
          (ph ? ' · ' + vnd(ph) + '/giờ' : '') + '</p>';
        var marker = '<div class="stu-actions';
        if (html.indexOf(marker) !== -1) html = html.replace(marker, line + marker);
      } catch (e) {}
      return html;
    };
  }

  /* ---------- 6. Thẻ lớp nhóm ---------- */
  var _rg = window.renderGroups;
  if (typeof _rg === 'function') {
    window.renderGroups = function () {
      var r = _rg.apply(this, arguments);
      try {
        var gs = (typeof getGroups === 'function') ? getGroups() : [];
        var cards = document.querySelectorAll('#groups-root .group-card');
        Array.prototype.forEach.call(cards, function (c, i) {
          var g = gs[i]; if (!g || c.querySelector('.cs-dur-line')) return;
          var mins = csGroupDuration(g.name);
          var ph = csPerHour(g.fee || 0, mins);
          var p = document.createElement('p');
          p.className = 'cs-dur-line';
          p.textContent = '⏳ ' + csFmtDur(mins) + '/buổi' + (ph ? ' · ' + vnd(ph) + '/giờ' : '');
          var h = c.querySelector('h4');
          if (h && h.parentNode) h.parentNode.insertBefore(p, h.nextSibling);
        });
      } catch (e) {}
      return r;
    };
  }

  /* ---------- 7. Cảnh báo buổi lệch thời lượng ---------- */
  var _rsi = window.renderSessionItem;
  if (typeof _rsi === 'function') {
    window.renderSessionItem = function (s) {
      var html = _rsi.apply(this, arguments);
      try {
        var exp = csDurationFor(s.student || s.name), act = s.duration || 0;
        if (act && exp && Math.abs(act - exp) >= 10 && csIsDurationSet(s.student || s.name)) {
          var w = '<span class="cs-warn" title="Lịch ghi ' + act + ' phút, thường là ' +
            csFmtDur(exp) + '">⚠️</span>';
          var m = '<span class="s-item-edit';
          if (html.indexOf(m) !== -1) html = html.replace(m, w + '<span class="s-item-edit');
        }
      } catch (e) {}
      return html;
    };
  }

  /* ---------- 8. Tab Hồ sơ: mặc định + danh sách đã đặt riêng ---------- */
  function renderDurList() {
    var box = $('cs-dur-list'); if (!box) return;
    var m = readMap(), keys = Object.keys(m);
    if (!keys.length) { box.innerHTML = '<p class="cs-dur-hint">Chưa có ai đặt riêng.</p>'; return; }
    var reg = (typeof csRegistry === 'function') ? csRegistry() : {};
    var gs = (typeof getGroups === 'function') ? getGroups() : [];
    box.innerHTML = keys.sort().map(function (key) {
      var isG = key.indexOf('g:') === 0, bare = isG ? key.slice(2) : key, label = bare;
      if (isG) { gs.forEach(function (g) { if (k(g.name) === bare) label = g.name; }); }
      else if (reg[bare]) { label = reg[bare].name; }
      var enc = (typeof encodeKey === 'function') ? encodeKey(label) : label;
      return '<div class="cs-dur-item"><span>' + (isG ? '👥 ' : '') + esc(label) +
        ' · <b>' + csFmtDur(m[key]) + '</b></span>' +
        '<button class="btn btn-ghost btn-sm" title="Về mặc định" ' +
        'onclick="csClearDuration(\'' + enc + '\',' + (isG ? 'true' : 'false') + ')">↩︎</button></div>';
    }).join('');
  }

  function injectProfileCard() {
    var page = $('page-profile'); if (!page || $('cs-dur-card')) return;
    var cur = csDefaultDuration();
    var opts = PRESETS.map(function (p) {
      return '<option value="' + p + '"' + (p === cur ? ' selected' : '') + '>' + csFmtDur(p) + '</option>';
    }).join('');
    var card = document.createElement('div');
    card.className = 'profile-card'; card.id = 'cs-dur-card';
    card.innerHTML = '<div class="settings-group-title">⏱️ Thời lượng buổi học</div>' +
      '<p class="danger-desc">Dùng khi học viên hoặc lớp chưa đặt riêng. ' +
      'Đặt riêng ở ô "Thời lượng mỗi buổi" trong form sửa học viên / lớp nhóm.</p>' +
      '<div class="field" style="max-width:200px"><label>Mặc định</label>' +
      '<select id="cs-def-dur" onchange="csSetDefaultDuration(this.value)">' + opts + '</select></div>' +
      '<div class="settings-group-title" style="margin-top:14px">Đã đặt riêng</div>' +
      '<div id="cs-dur-list" class="cs-dur-list"></div>';
    page.insertBefore(card, $('cs-ui-card') || $('cs-source-card') || $('cs-backup-card') || null);
    renderDurList();
  }

  /* ---------- 9. CSS ---------- */
  function injectCSS() {
    if ($('cs-dur-css')) return;
    var s = document.createElement('style');
    s.id = 'cs-dur-css';
    s.textContent =
      '.cs-dur-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '.cs-dur-hint{font-size:.74rem;color:var(--text3)}' +
      '.cs-dur-line{font-size:.76rem;color:var(--text2);margin:2px 0 0}' +
      '.cs-warn{margin-right:22px;font-size:.8rem}' +
      '.cs-ev-durbar{display:flex;align-items:center;gap:10px;margin-top:6px;flex-basis:100%}' +
      '.cs-dur-list{display:flex;flex-direction:column;gap:4px;max-height:190px;overflow:auto}' +
      '.cs-dur-item{display:flex;align-items:center;justify-content:space-between;gap:8px;' +
        'font-size:.78rem;padding:4px 8px;background:var(--bg3);border-radius:var(--radius-xs)}';
    document.head.appendChild(s);
  }

  var _switch = window.switchTab;
  window.switchTab = function (tab) {
    var r = _switch ? _switch.apply(this, arguments) : undefined;
    if (tab === 'profile') { injectProfileCard(); renderDurList(); }
    return r;
  };

  function init() {
    injectCSS(); injectProfileCard();
    try { if (typeof renderStudents === 'function') renderStudents(); } catch (e) {}
    try { if (typeof renderGroups === 'function') renderGroups(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  console.log('✅ patch-v8 loaded · mặc định ' + csFmtDur(csDefaultDuration()));
})();
