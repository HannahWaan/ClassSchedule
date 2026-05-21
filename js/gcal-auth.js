/* ===== GCAL-AUTH.JS - OAuth + CRUD + Recurring Delete ===== */
const GCAL_CLIENT_ID = '508450041217-3bc9vrbbusm6iqn2sbgac620dhn3e3dq.apps.googleusercontent.com';
const GCAL_SCOPES = 'https://www.googleapis.com/auth/calendar';
const GCAL_CAL_ID = 'asstrayca@gmail.com';
const GCAL_BASE = 'https://www.googleapis.com/calendar/v3';

let tokenClient, accessToken = localStorage.getItem('gcal_token') || null;
let tokenExpiry = parseInt(localStorage.getItem('gcal_token_expiry') || '0');

/* ---- Token management ---- */
function isTokenValid() { return accessToken && Date.now() < tokenExpiry; }

function initTokenClient() {
  if (!google?.accounts?.oauth2) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GCAL_CLIENT_ID,
    scope: GCAL_SCOPES,
    callback: (resp) => {
      if (resp.access_token) {
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + (resp.expires_in || 3600) * 1000;
        localStorage.setItem('gcal_token', accessToken);
        localStorage.setItem('gcal_token_expiry', tokenExpiry.toString());
        document.getElementById('gcal-auth-btn')?.classList.add('hidden');
        document.getElementById('gcal-add-btn')?.classList.remove('hidden');
        if (window._gcalAuthCallback) { window._gcalAuthCallback(); window._gcalAuthCallback = null; }
      }
    }
  });
}

function ensureToken() {
  return new Promise((resolve, reject) => {
    if (isTokenValid()) return resolve();
    if (!tokenClient) { initTokenClient(); }
    window._gcalAuthCallback = resolve;
    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

async function gcalFetch(url, options = {}) {
  await ensureToken();
  options.headers = { ...options.headers, 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' };
  let res = await fetch(url, options);
  if (res.status === 401) {
    localStorage.removeItem('gcal_token');
    accessToken = null;
    await ensureToken();
    options.headers['Authorization'] = 'Bearer ' + accessToken;
    res = await fetch(url, options);
  }
  return res;
}

/* ---- CRUD ---- */
async function createEvent(summary, start, end, description = '') {
  const body = { summary, start: { dateTime: start, timeZone: 'Asia/Ho_Chi_Minh' }, end: { dateTime: end, timeZone: 'Asia/Ho_Chi_Minh' }, description };
  const res = await gcalFetch(`${GCAL_BASE}/calendars/${encodeURIComponent(GCAL_CAL_ID)}/events`, { method: 'POST', body: JSON.stringify(body) });
  return res.json();
}

async function updateEvent(eventId, data) {
  const res = await gcalFetch(`${GCAL_BASE}/calendars/${encodeURIComponent(GCAL_CAL_ID)}/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) });
  return res.json();
}

async function deleteEvent(eventId) {
  return gcalFetch(`${GCAL_BASE}/calendars/${encodeURIComponent(GCAL_CAL_ID)}/events/${eventId}`, { method: 'DELETE' });
}

async function getEvent(eventId) {
  const res = await gcalFetch(`${GCAL_BASE}/calendars/${encodeURIComponent(GCAL_CAL_ID)}/events/${eventId}`);
  return res.json();
}

/* ---- Recurring event delete helpers ---- */

// Delete only this single instance
async function deleteThisInstance(instanceId) {
  return deleteEvent(instanceId);
}

// Delete this instance and all following: trim the parent RRULE
async function deleteThisAndFollowing(instanceId) {
  const instance = await getEvent(instanceId);
  const parentId = instance.recurringEventId;
  if (!parentId) return deleteEvent(instanceId); // fallback: not recurring

  // Get parent event
  const parent = await getEvent(parentId);
  
  // Calculate UNTIL = 1 second before this instance's original start
  const instanceStart = new Date(instance.originalStartTime?.dateTime || instance.start?.dateTime);
  const untilDate = new Date(instanceStart.getTime() - 1000);
  const untilStr = untilDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z');
  
  // Update parent recurrence with UNTIL
  let recurrence = parent.recurrence || [];
  recurrence = recurrence.map(rule => {
    if (rule.startsWith('RRULE:')) {
      // Remove existing UNTIL or COUNT
      let parts = rule.replace(/;UNTIL=[^;]*/i, '').replace(/;COUNT=[^;]*/i, '');
      return parts + ';UNTIL=' + untilStr;
    }
    return rule;
  });
  
  return updateEvent(parentId, { recurrence });
}

// Delete ALL instances of the recurring series
async function deleteAllInstances(instanceId) {
  const instance = await getEvent(instanceId);
  const parentId = instance.recurringEventId || instanceId;
  return deleteEvent(parentId);
}

/* ---- UI: Delete modal for recurring events ---- */
let _pendingDeleteId = null;

async function openDeleteModal(eventId) {
  _pendingDeleteId = eventId;
  
  // Check if this event is part of a recurring series
  try {
    const ev = await getEvent(eventId);
    if (ev.recurringEventId) {
      // Show recurring delete options
      document.getElementById('recurring-delete-modal').classList.add('active');
    } else {
      // Single event: delete directly
      if (confirm('Xóa buổi dạy này?')) {
        await deleteEvent(eventId);
        refreshAfterChange();
      }
    }
  } catch (e) {
    console.error('Error checking event:', e);
    if (confirm('Xóa buổi dạy này?')) {
      await deleteEvent(eventId);
      refreshAfterChange();
    }
  }
}

function closeRecurringDeleteModal() {
  document.getElementById('recurring-delete-modal').classList.remove('active');
  _pendingDeleteId = null;
}

async function handleRecurringDelete(mode) {
  if (!_pendingDeleteId) return;
  const id = _pendingDeleteId;
  closeRecurringDeleteModal();
  
  try {
    switch (mode) {
      case 'this':
        await deleteThisInstance(id);
        break;
      case 'this-and-following':
        await deleteThisAndFollowing(id);
        break;
      case 'all':
        await deleteAllInstances(id);
        break;
    }
    refreshAfterChange();
  } catch (e) {
    alert('Lỗi khi xóa: ' + e.message);
  }
}

/* ---- Event modal (Add / Edit) ---- */
let _editingEventId = null;

function openAddEventModal() {
  _editingEventId = null;
  document.getElementById('ev-modal-title').textContent = 'Thêm buổi dạy';
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ev-start').value = '08:00';
  document.getElementById('ev-end').value = '09:00';
  document.getElementById('ev-note').value = '';
  document.getElementById('ev-delete-btn').classList.add('hidden');
  document.getElementById('event-modal').classList.add('active');
}

async function openEditEventModal(eventId) {
  _editingEventId = eventId;
  const ev = await getEvent(eventId);
  document.getElementById('ev-modal-title').textContent = 'Sửa buổi dạy';
  document.getElementById('ev-title').value = ev.summary || '';
  const start = new Date(ev.start?.dateTime || ev.start?.date);
  const end = new Date(ev.end?.dateTime || ev.end?.date);
  document.getElementById('ev-date').value = start.toISOString().slice(0, 10);
  document.getElementById('ev-start').value = start.toTimeString().slice(0, 5);
  document.getElementById('ev-end').value = end.toTimeString().slice(0, 5);
  document.getElementById('ev-note').value = ev.description || '';
  document.getElementById('ev-delete-btn').classList.remove('hidden');
  document.getElementById('event-modal').classList.add('active');
}

function closeEventModal() {
  document.getElementById('event-modal').classList.remove('active');
  _editingEventId = null;
}

async function saveGCalEvent() {
  const title = document.getElementById('ev-title').value.trim();
  const date = document.getElementById('ev-date').value;
  const startT = document.getElementById('ev-start').value;
  const endT = document.getElementById('ev-end').value;
  const note = document.getElementById('ev-note').value.trim();
  if (!title || !date || !startT || !endT) return alert('Vui lòng điền đủ thông tin');
  
  const startDT = `${date}T${startT}:00`;
  const endDT = `${date}T${endT}:00`;
  
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
}

async function deleteGCalEvent() {
  if (!_editingEventId) return;
  closeEventModal();
  await openDeleteModal(_editingEventId);
}

/* ---- Refresh ---- */
function refreshAfterChange() {
  // Reload iframe
  const iframe = document.querySelector('#page-schedule iframe');
  if (iframe) iframe.src = iframe.src;
  // Re-sync data
  if (window.loadAllExternalData) setTimeout(loadAllExternalData, 1500);
}

/* ---- Session click handler ---- */
function onSessionClick(eventId) {
  if (eventId && eventId !== 'undefined') openEditEventModal(eventId);
}

/* ---- Auth button handler ---- */
function handleGCalAuth() {
  ensureToken().then(() => {
    document.getElementById('gcal-auth-btn')?.classList.add('hidden');
    document.getElementById('gcal-add-btn')?.classList.remove('hidden');
  });
}

/* ---- Auto-login on page load ---- */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initTokenClient();
    if (accessToken && Date.now() < tokenExpiry) {
      document.getElementById('gcal-auth-btn')?.classList.add('hidden');
      document.getElementById('gcal-add-btn')?.classList.remove('hidden');
    } else if (accessToken) {
      // Token expired but existed before: try silent refresh
      ensureToken().then(() => {
        document.getElementById('gcal-auth-btn')?.classList.add('hidden');
        document.getElementById('gcal-add-btn')?.classList.remove('hidden');
      }).catch(() => {});
    }
  }, 1000);
});
