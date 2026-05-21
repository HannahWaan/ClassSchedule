/* ===== GCAL-AUTH.JS v3 - Fixed ===== */
const GCAL_CLIENT_ID = '508450041217-3bc9vrbbusm6iqn2sbgac620dhn3e3dq.apps.googleusercontent.com';
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar';
const GCAL_CAL_ID = 'asstrayca@gmail.com';
const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

let tokenClient = null;
let accessToken = localStorage.getItem('gcal_token') || null;
let tokenExpiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0');

function isTokenValid() { return accessToken && Date.now() < tokenExpiry; }

function initTokenClient() {
  if (tokenClient) return;
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
    console.warn('Google Identity Services not loaded yet');
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID,
    scope: GCAL_SCOPES,
    callback: function(resp) {
      if (resp.error) { console.error('OAuth error:', resp); return; }
      if (resp.access_token) {
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
        localStorage.setItem('gcal_token', accessToken);
        localStorage.setItem('gcal_token_expiry', tokenExpiry.toString());
        showAuthReady();
        if (window._gcalAuthResolve) { window._gcalAuthResolve(); window._gcalAuthResolve = null; }
      }
    }
  });
}

function showAuthReady() {
  var authBtn = document.getElementById('btn-gcal-auth');
  var addBtn = document.getElementById('btn-add-event');
  if (authBtn) authBtn.style.display = 'none';
  if (addBtn) addBtn.style.display = '';
}

function showAuthNeeded() {
  var authBtn = document.getElementById('btn-gcal-auth');
  var addBtn = document.getElementById('btn-add-event');
  if (authBtn) authBtn.style.display = '';
  if (addBtn) addBtn.style.display = 'none';
}

function ensureToken() {
  return new Promise(function(resolve, reject) {
    if (isTokenValid()) return resolve();
    initTokenClient();
    if (!tokenClient) return reject(new Error('GIS not ready'));
    window._gcalAuthResolve = resolve;
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function gcalFetch(url, options) {
  if (!options) options = {};
  await ensureToken();
  if (!options.headers) options.headers = {};
  options.headers['Authorization'] = 'Bearer ' + accessToken;
  options.headers['Content-Type'] = 'application/json';
  var res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem('gcal_token');
    accessToken = null;
    tokenExpiry = 0;
    await ensureToken();
    options.headers['Authorization'] = 'Bearer ' + accessToken;
    res = await fetch(url, options);
  }
  return res;
}

/* ---- CRUD ---- */
async function createEvent(summary, start, end, description) {
  var body = {
    summary: summary,
    description: description || '',
    start: { dateTime: start, timeZone: 'Asia/Ho_Chi_Minh' },
    end: { dateTime: end, timeZone: 'Asia/Ho_Chi_Minh' }
  };
  var res = await gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(GCAL_CAL_ID) + '/events', {
    method: 'POST', body: JSON.stringify(body)
  });
  return res.json();
}

async function updateEvent(eventId, data) {
  var res = await gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(GCAL_CAL_ID) + '/events/' + eventId, {
    method: 'PATCH', body: JSON.stringify(data)
  });
  return res.json();
}

async function deleteEvent(eventId) {
  return gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(GCAL_CAL_ID) + '/events/' + eventId, {
    method: 'DELETE'
  });
}

async function getEvent(eventId) {
  var res = await gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(GCAL_CAL_ID) + '/events/' + eventId);
  if (!res.ok) throw new Error('Event not found: ' + res.status);
  return res.json();
}

/* ---- RECURRING DELETE ---- */
var _pendingDeleteId = null;

async function deleteThisInstance(instanceId) {
  return deleteEvent(instanceId);
}

async function deleteThisAndFollowing(instanceId) {
  var instance = await getEvent(instanceId);
  var parentId = instance.recurringEventId;
  if (!parentId) return deleteEvent(instanceId);
  var parent = await getEvent(parentId);
  var startStr = instance.originalStartTime ? instance.originalStartTime.dateTime : instance.start.dateTime;
  var instanceStart = new Date(startStr);
  var untilDate = new Date(instanceStart.getTime() - 1000);
  var untilStr = untilDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  var recurrence = parent.recurrence || [];
  recurrence = recurrence.map(function(rule) {
    if (rule.indexOf('RRULE:') === 0) {
      var parts = rule.replace(/;UNTIL=[^;]*/i, '').replace(/;COUNT=[^;]*/i, '');
      return parts + ';UNTIL=' + untilStr;
    }
    return rule;
  });
  return updateEvent(parentId, { recurrence: recurrence });
}

async function deleteAllInstances(instanceId) {
  var instance = await getEvent(instanceId);
  var parentId = instance.recurringEventId || instanceId;
  return deleteEvent(parentId);
}

/* ---- Delete Modal UI ---- */
function showRecurringDeleteModal() {
  var modal = document.getElementById('recurring-delete-modal');
  if (modal) modal.hidden = false;
}

function closeRecurringDeleteModal() {
  var modal = document.getElementById('recurring-delete-modal');
  if (modal) modal.hidden = true;
  _pendingDeleteId = null;
}

async function handleRecurringDelete(mode) {
  if (!_pendingDeleteId) return;
  var id = _pendingDeleteId;
  closeRecurringDeleteModal();
  try {
    if (mode === 'this') await deleteThisInstance(id);
    else if (mode === 'this-and-following') await deleteThisAndFollowing(id);
    else if (mode === 'all') await deleteAllInstances(id);
    refreshAfterChange();
  } catch (e) {
    alert('Lỗi khi xóa: ' + (e.message || e));
  }
}

/* ---- Event Modal ---- */
var _editingEventId = null;

function openAddEventModal() {
  _editingEventId = null;
  document.getElementById('ev-modal-title').textContent = 'Thêm buổi dạy';
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ev-start').value = '19:00';
  document.getElementById('ev-end').value = '20:00';
  document.getElementById('ev-note').value = '';
  document.getElementById('ev-delete-btn').style.display = 'none';
  document.getElementById('modal-event').hidden = false;
}

async function openEditEventModal(eventId) {
  if (!isTokenValid()) {
    alert('Vui lòng đăng nhập Google trước (tab Lịch dạy).');
    return;
  }
  try {
    _editingEventId = eventId;
    var ev = await getEvent(eventId);
    document.getElementById('ev-modal-title').textContent = 'Sửa buổi dạy';
    document.getElementById('ev-title').value = ev.summary || '';
    var start = new Date(ev.start.dateTime || ev.start.date);
    var end = new Date(ev.end.dateTime || ev.end.date);
    document.getElementById('ev-date').value = start.toISOString().slice(0, 10);
    document.getElementById('ev-start').value = start.toTimeString().slice(0, 5);
    document.getElementById('ev-end').value = end.toTimeString().slice(0, 5);
    document.getElementById('ev-note').value = ev.description || '';
    document.getElementById('ev-delete-btn').style.display = '';
    document.getElementById('modal-event').hidden = false;
  } catch (e) {
    console.error('Cannot load event:', e);
    alert('Không thể mở sự kiện. Vui lòng thử lại.');
  }
}

function closeEventModal() {
  document.getElementById('modal-event').hidden = true;
  _editingEventId = null;
}

async function saveGCalEvent(e) {
  if (e) e.preventDefault();
  var title = document.getElementById('ev-title').value.trim();
  var date = document.getElementById('ev-date').value;
  var startT = document.getElementById('ev-start').value;
  var endT = document.getElementById('ev-end').value;
  var note = document.getElementById('ev-note').value.trim();
  if (!title || !date || !startT || !endT) { alert('Vui lòng điền đủ thông tin'); return; }

  var startDT = date + 'T' + startT + ':00';
  var endDT = date + 'T' + endT + ':00';

  try {
    if (_editingEventId) {
      await updateEvent(_editingEventId, {
        summary: title,
        start: { dateTime: startDT, timeZone: 'Asia/Ho_Chi_Minh' },
        end: { dateTime: endDT, timeZone: 'Asia/Ho_Chi_Minh' },
        description: note
      });
    } else {
      await createEvent(title, startDT, endDT, note);
    }
    closeEventModal();
    refreshAfterChange();
  } catch (e2) {
    alert('Lỗi: ' + (e2.message || e2));
  }
}

async function deleteGCalEvent() {
  if (!_editingEventId) return;
  var eventId = _editingEventId;
  closeEventModal();
  try {
    var ev = await getEvent(eventId);
    if (ev.recurringEventId) {
      _pendingDeleteId = eventId;
      showRecurringDeleteModal();
    } else {
      if (confirm('Xóa buổi dạy này?')) {
        await deleteEvent(eventId);
        refreshAfterChange();
      }
    }
  } catch (e) {
    if (confirm('Xóa buổi dạy này?')) {
      await deleteEvent(eventId);
      refreshAfterChange();
    }
  }
}

/* ---- Refresh ---- */
function refreshAfterChange() {
  var iframe = document.getElementById('gcal-iframe');
  if (iframe) {
    var src = iframe.src;
    iframe.src = '';
    setTimeout(function() { iframe.src = src; }, 300);
  }
  if (typeof loadAllExternalData === 'function') setTimeout(loadAllExternalData, 1500);
}

/* ---- Session click ---- */
function onSessionClick(eventId) {
  if (!eventId || eventId === 'undefined' || eventId === 'null') return;
  if (!isTokenValid()) {
    alert('Vui lòng đăng nhập Google trước (tab Lịch dạy).');
    return;
  }
  openEditEventModal(eventId);
}

/* ---- Auth handler ---- */
function handleGCalAuth() {
  ensureToken().then(function() {
    showAuthReady();
    if (typeof loadAllExternalData === 'function') loadAllExternalData();
  }).catch(function(e) { console.error('Auth failed:', e); });
}

/* ---- Auto-login on page load ---- */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    initTokenClient();
    if (isTokenValid()) {
      showAuthReady();
    } else if (accessToken) {
      ensureToken().then(showAuthReady).catch(showAuthNeeded);
    } else {
      showAuthNeeded();
    }
  }, 1200);
});
