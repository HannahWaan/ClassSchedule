/* ===== GCAL-AUTH.JS - OAuth + CRUD + Recurring Delete (v2 fixed) ===== */
const GCAL_CLIENT_ID = '50845041217-3bc9vrbbusm6iqn2sbgac620dhn3e3dq.apps.googleusercontent.com';
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar';
const GCAL_CAL_ID = 'asstrayca@gmail.com';
const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

let tokenClient = null;
let accessToken = localStorage.getItem('gcal_token') || null;
let tokenExpiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0');

/* ---- Token management ---- */
function isTokenValid() { return accessToken && Date.now() < tokenExpiry; }

function initTokenClient() {
  if (tokenClient) return;
  if (!window.google?.accounts?.oauth2) { console.warn('GIS not loaded'); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID,
    scope: GCAL_SCOPES,
    callback: (resp) => {
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
  return new Promise((resolve, reject) => {
    if (isTokenValid()) return resolve();
    initTokenClient();
    if (!tokenClient) return reject(new Error('GIS not ready'));
    window._gcalAuthResolve = resolve;
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function gcalFetch(url, options = {}) {
  await ensureToken();
  options.headers = { ...(options.headers||{}), 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' };
  let res = await fetch(url, options);
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
  const body = { summary, description: description||'', start:{dateTime:start,timeZone:'Asia/Ho_Chi_Minh'}, end:{dateTime:end,timeZone:'Asia/Ho_Chi_Minh'} };
  const res = await gcalFetch(GCAL_BASE+'/calendars/'+encodeURIComponent(GCAL_CAL_ID)+'/events', {method:'POST',body:JSON.stringify(body)});
  return res.json();
}

async function updateEvent(eventId, data) {
  const res = await gcalFetch(GCAL_BASE+'/calendars/'+encodeURIComponent(GCAL_CAL_ID)+'/events/'+eventId, {method:'PATCH',body:JSON.stringify(data)});
  return res.json();
}

async function deleteEvent(eventId) {
  return gcalFetch(GCAL_BASE+'/calendars/'+encodeURIComponent(GCAL_CAL_ID)+'/events/'+eventId, {method:'DELETE'});
}

async function getEvent(eventId) {
  const res = await gcalFetch(GCAL_BASE+'/calendars/'+encodeURIComponent(GCAL_CAL_ID)+'/events/'+eventId);
  if (!res.ok) throw new Error('Event not found: ' + res.status);
  return res.json();
}

/* ---- RECURRING DELETE ---- */
let _pendingDeleteId = null;

async function deleteThisInstance(instanceId) {
  return deleteEvent(instanceId);
}

async function deleteThisAndFollowing(instanceId) {
  const instance = await getEvent(instanceId);
  const parentId = instance.recurringEventId;
  if (!parentId) return deleteEvent(instanceId);

  const parent = await getEvent(parentId);
  const instanceStart = new Date(instance.originalStartTime?.dateTime || instance.start?.dateTime);
  const untilDate = new Date(instanceStart.getTime() - 1000);
  // Format: YYYYMMDDTHHMMSSZ
  const untilStr = untilDate.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');

  let recurrence = parent.recurrence || [];
  recurrence = recurrence.map(rule => {
    if (rule.startsWith('RRULE:')) {
      let parts = rule.replace(/;UNTIL=[^;]*/i,'').replace(/;COUNT=[^;]*/i,'');
      return parts + ';UNTIL=' + untilStr;
    }
    return rule;
  });
  return updateEvent(parentId, { recurrence });
}

async function deleteAllInstances(instanceId) {
  const instance = await getEvent(instanceId);
  const parentId = instance.recurringEventId || instanceId;
  return deleteEvent(parentId);
}

/* ---- Delete UI ---- */
function showRecurringDeleteModal() {
  document.getElementById('recurring-delete-modal').hidden = false;
}

function closeRecurringDeleteModal() {
  document.getElementById('recurring-delete-modal').hidden = true;
  _pendingDeleteId = null;
}

async function handleRecurringDelete(mode) {
  if (!_pendingDeleteId) return;
  const id = _pendingDeleteId;
  closeRecurringDeleteModal();
  try {
    switch (mode) {
      case 'this': await deleteThisInstance(id); break;
      case 'this-and-following': await deleteThisAndFollowing(id); break;
      case 'all': await deleteAllInstances(id); break;
    }
    refreshAfterChange();
  } catch (e) {
    alert('Lỗi khi xóa: ' + (e.message||e));
  }
}

/* ---- Event Modal (Add/Edit) ---- */
let _editingEventId = null;

function openAddEventModal() {
  _editingEventId = null;
  document.getElementById('ev-modal-title').textContent = 'Thêm buổi dạy';
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('ev-start').value = '19:00';
  document.getElementById('ev-end').value = '20:00';
  document.getElementById('ev-note').value = '';
  document.getElementById('ev-delete-btn').style.display = 'none';
  document.getElementById('modal-event').hidden = false;
}

async function openEditEventModal(eventId) {
  if (!isTokenValid()) { console.warn('Not authed'); return; }
  try {
    _editingEventId = eventId;
    const ev = await getEvent(eventId);
    document.getElementById('ev-modal-title').textContent = 'Sửa buổi dạy';
    document.getElementById('ev-title').value = ev.summary || '';
    const start = new Date(ev.start?.dateTime || ev.start?.date);
    const end = new Date(ev.end?.dateTime || ev.end?.date);
    document.getElementById('ev-date').value = start.toISOString().slice(0,10);
    document.getElementById('ev-start').value = start.toTimeString().slice(0,5);
    document.getElementById('ev-end').value = end.toTimeString().slice(0,5);
    document.getElementById('ev-note').value = ev.description || '';
    document.getElementById('ev-delete-btn').style.display = '';
    document.getElementById('modal-event').hidden = false;
  } catch(e) {
    console.error('Cannot load event:', e);
    alert('Không thể mở sự kiện. Hãy đăng nhập Google trước.');
  }
}

function closeEventModal() {
  document.getElementById('modal-event').hidden = true;
  _editingEventId = null;
}

async function saveGCalEvent(e) {
  if (e) e.preventDefault();
  const title = document.getElementById('ev-title').value.trim();
  const date = document.getElementById('ev-date').value;
  const startT = document.getElementById('ev-start').value;
  const endT = document.getElementById('ev-end').value;
  const note = document.getElementById('ev-note').value.trim();
  if (!title || !date || !startT || !endT) return alert('Vui lòng điền đủ thông tin');

  const startDT = date + 'T' + startT + ':00';
  const endDT = date + 'T' + endT + ':00';

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
  } catch(e) {
    alert('Lỗi: ' + (e.message||e));
  }
}

async function deleteGCalEvent() {
  if (!_editingEventId) return;
  const eventId = _editingEventId;
  closeEventModal();

  // Check if recurring
  try {
    const ev = await getEvent(eventId);
    if (ev.recurringEventId) {
      _pendingDeleteId = eventId;
      showRecurringDeleteModal();
    } else {
      if (confirm('Xóa buổi dạy này?')) {
        await deleteEvent(eventId);
        refreshAfterChange();
      }
    }
  } catch(e) {
    // Fallback: just delete
    if (confirm('Xóa buổi dạy này?')) {
      await deleteEvent(eventId);
      refreshAfterChange();
    }
  }
}

/* ---- Refresh ---- */
function refreshAfterChange() {
  const iframe = document.getElementById('gcal-iframe');
  if (iframe) { var src = iframe.src; iframe.src = ''; setTimeout(()=>{iframe.src=src;},200); }
  if (window.loadAllExternalData) setTimeout(loadAllExternalData, 1500);
}

/* ---- Click session ---- */
function onSessionClick(eventId) {
  if (!eventId || eventId === 'undefined' || eventId === 'null') return;
  if (!isTokenValid()) { alert('Vui lòng đăng nhập Google trước (tab Lịch dạy).'); return; }
  openEditEventModal(eventId);
}

/* ---- Auth handler ---- */
function handleGCalAuth() {
  ensureToken().then(() => { showAuthReady(); }).catch(e => { console.error(e); });
}

/* ---- Auto-login ---- */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
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
