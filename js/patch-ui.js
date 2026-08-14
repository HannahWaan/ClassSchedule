/* ============================================================
   PATCH-UI.JS — nạp SAU js/patch-v6.js (và sau patch-v7 nếu có)
   1) Khu "Đề xuất từ Calendar" thu gọn được, chỉ hiện 5 dòng
   2) Toast thay cho vài thông báo
   3) Chọn cỡ chữ / mật độ ở tab Hồ sơ
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    if (typeof csEsc === 'function') return csEsc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- 1. Toast ---------- */
  window.csToast = function (msg, type) {
    var w = $('cs-toast-wrap');
    if (!w) {
      w = document.createElement('div');
      w.id = 'cs-toast-wrap'; w.className = 'cs-toast-wrap';
      document.body.appendChild(w);
    }
    var t = document.createElement('div');
    t.className = 'cs-toast ' + (type || '');
    t.textContent = msg;
    w.appendChild(t);
    setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, 2600);
  };

  /* ---------- 2. Cỡ chữ / mật độ ---------- */
  var SIZES = { compact: '15px', normal: '17px', large: '19px' };
  function density() { var d = localStorage.getItem('cs-density'); return SIZES[d] ? d : 'normal'; }
  function applyDensity() { document.documentElement.style.fontSize = SIZES[density()]; }
  window.csSetDensity = function (k) {
    if (!SIZES[k]) return;
    localStorage.setItem('cs-density', k);
    applyDensity();
    Array.prototype.forEach.call(document.querySelectorAll('[data-density]'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-density') === k);
    });
  };
  applyDensity();

  function injectUICard() {
    var page = $('page-profile');
    if (!page || $('cs-ui-card')) return;
    var card = document.createElement('div');
    card.className = 'profile-card';
    card.id = 'cs-ui-card';
    var cur = density();
    var opts = [['compact', 'Gọn'], ['normal', 'Vừa'], ['large', 'Lớn']];
    card.innerHTML =
      '<div class="settings-group-title">🎨 Giao diện</div>' +
      '<p class="danger-desc">Cỡ chữ và mật độ hiển thị của toàn bộ app.</p>' +
      '<div class="toggle-row">' + opts.map(function (o) {
        return '<button type="button" class="toggle' + (cur === o[0] ? ' active' : '') +
          '" data-density="' + o[0] + '" onclick="csSetDensity(\'' + o[0] + '\')">' + o[1] + '</button>';
      }).join('') + '</div>';
    page.insertBefore(card, $('cs-source-card') || $('cs-backup-card') ||
      page.querySelector('.danger-section') || null);
  }

  /* ---------- 3. Đề xuất từ Calendar: thu gọn ---------- */
  var MAX_ROWS = 5, showAll = false;
  function isOpen() { return localStorage.getItem('cs-inbox-open') === '1'; }

  window.csToggleInbox = function () {
    localStorage.setItem('cs-inbox-open', isOpen() ? '0' : '1');
    showAll = false;
    window.csRenderInbox();
  };
  window.csInboxMore = function () { showAll = !showAll; window.csRenderInbox(); };

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

    var open = isOpen();
    var html = '<button type="button" class="cs-bar" onclick="csToggleInbox()">' +
      '<span>🆕 Đề xuất từ Calendar</span>' +
      '<span class="cs-badge">' + list.length + '</span>' +
      '<span class="cs-chev">' + (open ? '▲ Ẩn' : '▼ Xem') + '</span></button>';

    if (open) {
      var rows = showAll ? list : list.slice(0, MAX_ROWS);
      html += '<div class="cs-inbox-list"><div class="cs-hint">Tên có buổi trong ' +
        csRecentDays() + ' ngày qua nhưng chưa có trong danh sách học viên.</div>' +
        rows.map(function (c) {
          var d = new Date(c.last).toLocaleDateString('vi-VN',
            { day: '2-digit', month: '2-digit', year: '2-digit' });
          var k = encodeKey(c.name);
          return '<div class="cs-row"><div class="cs-row-main"><b>' + esc(c.name) + '</b>' +
            '<span>' + c.count + ' buổi · gần nhất ' + d + '</span></div><div class="cs-row-act">' +
            '<button class="btn btn-primary btn-sm" onclick="csInboxAdd(\'' + k + '\')">➕ Thêm</button>' +
            '<button class="btn btn-outline btn-sm" onclick="csInboxMerge(\'' + k + '\')">🔗 Gộp</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="csInboxIgnore(\'' + k + '\')">🚫 Bỏ</button>' +
            '</div></div>';
        }).join('') +
        (list.length > MAX_ROWS
          ? '<button type="button" class="cs-more" onclick="csInboxMore()">' +
            (showAll ? 'Thu gọn' : 'Xem thêm ' + (list.length - MAX_ROWS) + ' tên') + '</button>'
          : '') +
        '</div>';
    }
    box.innerHTML = html;
  };

  /* Bỏ qua / Thêm xong thì báo bằng toast */
  var _ig = window.csInboxIgnore;
  if (_ig) window.csInboxIgnore = function (enc) {
    var n = decodeKey(enc);
    var r = _ig.apply(this, arguments);
    if (typeof csIsIgnored === 'function' && csIsIgnored(n)) csToast('Đã bỏ qua "' + n + '"');
    return r;
  };
  var _add = window.csInboxAdd;
  if (_add) window.csInboxAdd = function (enc) {
    var r = _add.apply(this, arguments);
    csToast('Đã thêm "' + decodeKey(enc) + '" vào danh sách', 'ok');
    return r;
  };

  /* ---------- 4. Hook tab ---------- */
  var _switch = window.switchTab;
  window.switchTab = function (tab) {
    var r = _switch ? _switch.apply(this, arguments) : undefined;
    if (tab === 'profile') injectUICard();
    if (tab === 'students') { try { window.csRenderInbox(); } catch (e) {} }
    return r;
  };

  function init() {
    injectUICard();
    try { window.csRenderInbox(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  console.log('✅ patch-ui loaded · inbox ' + (isOpen() ? 'mở' : 'thu gọn') + ' · cỡ chữ ' + density());
})();
