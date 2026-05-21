/* ===== GCAL-AUTH.JS v4 ===== */
var GCAL_CLIENT_ID = '508450041217-3bc9vrbbusm6iqn2sbgac620dhn3e3dq.apps.googleusercontent.com';
var GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar';
var GCAL_CAL_ID = 'asstrayca@gmail.com';
var GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

var tokenClient = null;
var accessToken = localStorage.getItem('gcal_token') || null;
var tokenExpiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0');

/* ---- Hidden events (local only, not deleted from GCal) ---- */
function getHiddenEvents() {
  try { return JSON.parse(localStorage.getItem('cs-hidden-events') || '[]'); } catch(e) { return []; }
}
function saveHiddenEvents(arr) { localStorage.setItem('cs-hidden-events', JSON.stringify(arr)); }
function isEventHidden(eventId) { return getHiddenEvents().indexOf(eventId) !== -1; }
function hideEventLocally(eventId) {
  var hidden = getHiddenEvents();
  if (hidden.indexOf(eventId) === -1) { hidden.push(eventId); saveHiddenEvents(hidden); }
}
function unhideEvent(eventId) {
  var hidden = getHiddenEvents();
  hidden = hidden.filter(function(id) { return id !== eventId; });
  saveHiddenEvents(hidden);
}

/* ---- Token ---- */
function isTokenValid() { return accessToken && Date.now() < tokenExpiry; }

function initTokenClient() {
  if (tokenClient) return;
  if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) return;
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
  var a = document.getElementById('btn-gcal-auth');
  var b = document.getElementById('btn-add-event');
  if (a) a.style.display = 'none';
  if (b) b.style.display = '';
}
function showAuthNeeded() {
  var a = document.getElementById('btn-gcal-auth');
  var b = document.getElementById('btn-add-event');
  if (a) a.style.display = '';
  if (b) b.style.display = 'none';
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
    accessToken = null; tokenExpiry = 0;
    await ensureToken();
    options.headers['Authorization'] = 'Bearer ' + accessToken;
    res = await fetch(url, options);
  }
  return res;
}

/* ---- CRUD ---- */
async function createEvent(summary, start, end, description) {
  var body = { summary: summary, description: description || '', start: {dateTime:start, timeZone:'Asia/Ho_Chi_Minh'}, end: {dateTime:end, timeZone:'Asia/Ho_Chi_Minh'} };
  var res = await gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(GCAL_CAL_ID) + '/events', { method:'POST', body:JSON.stringify(body) });
  return res.json();
}
async function updateEvent(eventId, data) {
  var res = await gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(GCAL_CAL_ID) + '/events/' + eventId, { method:'PATCH', body:JSON.stringify(data) });
  return res.json();
}
async function deleteEvent(eventId) {
  return gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(GCAL_CAL_ID) + '/events/' + eventId, { method:'DELETE' });
}
async function getEvent(eventId) {
  var res = await gcalFetch(GCAL_BASE + '/calendars/' + encodeURIComponent(GCAL_CAL_ID) + '/events/' + eventId);
  if (!res.ok) throw new Error('Event not found: ' + res.status);
  return res.json();
}

/* ---- RECURRING DELETE ---- */
var _pendingDeleteId = null;

async function deleteThisInstance(id) { return deleteEvent(id); }

async function deleteThisAndFollowing(id) {
  var instance = await getEvent(id);
  var parentId = instance.recurringEventId;
  if (!parentId) return deleteEvent(id);
  var parent = await getEvent(parentId);
  var startStr = instance.originalStartTime ? instance.originalStartTime.dateTime : instance.start.dateTime;
  var untilDate = new Date(new Date(startStr).getTime() - 1000);
  var untilStr = untilDate.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  var recurrence = (parent.recurrence || []).map(function(rule) {
    if (rule.indexOf('RRULE:') === 0) return rule.replace(/;UNTIL=[^;]*/i,'').replace(/;COUNT=[^;]*/i,'') + ';UNTIL=' + untilStr;
    return rule;
  });
  return updateEvent(parentId, { recurrence: recurrence });
}

async function deleteAllInstances(id) {
  var instance = await getEvent(id);
  return deleteEvent(instance.recurringEventId || id);
}

/* ---- Delete Modal ---- */
function showRecurringDeleteModal() {
  var m = document.getElementById('recurring-delete-modal');
  if (m) m.hidden = false;
}
function closeRecurringDeleteModal() {
  var m = document.getElementById('recurring-delete-modal');
  if (m) m.hidden = true;
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
    else if (mode === 'hide') hideEventLocally(id);
    refreshAfterChange();
  } catch (e) { alert('Loi khi xoa: ' + (e.message || e)); }
}

/* ---- Single event delete modal ---- */
function showSingleDeleteModal() {
  var m = document.getElementById('single-delete-modal');
  if (m) m.hidden = false;
}
function closeSingleDeleteModal() {
  var m = document.getElementById('single-delete-modal');
  if (m) m.hidden = true;
  _pendingDeleteId = null;
}
async function handleSingleDelete(mode) {
  if (!_pendingDeleteId) return;
  var id = _pendingDeleteId;
  closeSingleDeleteModal();
  try {
    if (mode === 'gcal') { await deleteEvent(id); }
    else if (mode === 'hide') { hideEventLocally(id); }
    refreshAfterChange();
  } catch(e) { alert('Loi khi xoa: ' + (e.message || e)); }
}

/* ---- Event Modal ---- */
var _editingEventId = null;

function openAddEventModal() {
  _editingEventId = null;
  document.getElementById('ev-modal-title').textContent = 'Them buoi day';
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('ev-start').value = '19:00';
  document.getElementById('ev-end').value = '20:00';
  document.getElementById('ev-note').value = '';
  document.getElementById('ev-delete-btn').style.display = 'none';
  document.getElementById('modal-event').hidden = false;
}

async function openEditEventModal(eventId) {
  if (!isTokenValid()) { alert('Vui long dang nhap Google truoc (tab Lich day).'); return; }
  try {
    _editingEventId = eventId;
    var ev = await getEvent(eventId);
    document.getElementById('ev-modal-title').textContent = 'Sua buoi day';
    document.getElementById('ev-title').value = ev.summary || '';
    var start = new Date(ev.start.dateTime || ev.start.date);
    var end = new Date(ev.end.dateTime || ev.end.date);
    document.getElementById('ev-date').value = start.toISOString().slice(0,10);
    document.getElementById('ev-start').value = start.toTimeString().slice(0,5);
    document.getElementById('ev-end').value = end.toTimeString().slice(0,5);
    document.getElementById('ev-note').value = ev.description || '';
    document.getElementById('ev-delete-btn').style.display = '';
    document.getElementById('modal-event').hidden = false;
  } catch(e) {
    console.error('Cannot load event:', e);
    alert('Khong the mo su kien. Vui long thu lai.');
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
  if (!title || !date || !startT || !endT) { alert('Vui long dien du thong tin'); return; }
  var startDT = date + 'T' + startT + ':00';
  var endDT = date + 'T' + endT + ':00';
  try {
    if (_editingEventId) {
      await updateEvent(_editingEventId, { summary:title, start:{dateTime:startDT,timeZone:'Asia/Ho_Chi_Minh'}, end:{dateTime:endDT,timeZone:'Asia/Ho_Chi_Minh'}, description:note });
    } else {
      await createEvent(title, startDT, endDT, note);
    }
    closeEventModal();
    refreshAfterChange();
  } catch(e2) { alert('Loi: ' + (e2.message || e2)); }
}

async function deleteGCalEvent() {
  if (!_editingEventId) return;
  var eventId = _editingEventId;
  closeEventModal();
  try {
    var ev = await getEvent(eventId);
    _pendingDeleteId = eventId;
    if (ev.recurringEventId) {
      showRecurringDeleteModal();
    } else {
      showSingleDeleteModal();
    }
  } catch(e) {
    _pendingDeleteId = eventId;
    showSingleDeleteModal();
  }
}

/* ---- Refresh ---- */
function refreshAfterChange() {
  var iframe = document.getElementById('gcal-iframe');
  if (iframe) { var src = iframe.src; iframe.src = ''; setTimeout(function(){iframe.src=src;}, 300); }
  if (typeof loadAllExternalData === 'function') setTimeout(loadAllExternalData, 1500);
}

/* ---- Session click ---- */
function onSessionClick(eventId) {
  if (!eventId || eventId === 'undefined' || eventId === 'null') return;
  if (!isTokenValid()) { alert('Vui long dang nhap Google truoc (tab Lich day).'); return; }
  openEditEventModal(eventId);
}

/* ---- Auth handler ---- */
function handleGCalAuth() {
  ensureToken().then(function() {
    showAuthReady();
    if (typeof loadAllExternalData === 'function') loadAllExternalData();
  }).catch(function(e) { console.error('Auth failed:', e); });
}

/* ---- Auto-login: wait for GIS to load ---- */
document.addEventListener('DOMContentLoaded', function() {
  function waitForGIS(attempts) {
    if (attempts <= 0) { console.warn('GIS failed to load after 10s'); showAuthNeeded(); return; }
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      initTokenClient();
      if (isTokenValid()) {
        showAuthReady();
        if (typeof loadAllExternalData === 'function') loadAllExternalData();
      } else if (accessToken) {
        ensureToken().then(function() { showAuthReady(); if (typeof loadAllExternalData === 'function') loadAllExternalData(); }).catch(showAuthNeeded);
      } else {
        showAuthNeeded();
      }
    } else {
      setTimeout(function() { waitForGIS(attempts - 1); }, 500);
    }
  }
  waitForGIS(20);
});
