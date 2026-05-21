/* ===== GCAL-AUTH.JS - Google Calendar OAuth: create/edit/delete/move ===== */

var GCalAuth = (function() {
  var CLIENT_ID = '508450041217-3bc9vrbbusm6iqn2sbgac620dhn3e3dq.apps.googleusercontent.com';
  var SCOPES = 'https://www.googleapis.com/auth/calendar';
  var tokenClient = null;
  var accessToken = localStorage.getItem('gcal-access-token') || null;

  function init() {
    if (typeof google === 'undefined' || !google.accounts) { console.warn('GIS not loaded'); return; }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPES,
      callback: function(response) {
        if (response.access_token) { accessToken = response.access_token; localStorage.setItem('gcal-access-token', accessToken); onAuthSuccess(); }
      }
    });
    if (accessToken) verifyToken();
  }

  function requestAccess() { if (!tokenClient) init(); if (tokenClient) tokenClient.requestAccessToken(); }

  function verifyToken() {
    fetch('https://www.googleapis.com/calendar/v3/calendars/primary', { headers: { 'Authorization': 'Bearer ' + accessToken } })
    .then(function(r) { if (r.ok) onAuthSuccess(); else { accessToken = null; localStorage.removeItem('gcal-access-token'); } })
    .catch(function() { accessToken = null; localStorage.removeItem('gcal-access-token'); });
  }

  function onAuthSuccess() {
    var authBtn = document.getElementById('btn-gcal-auth');
    var addBtn = document.getElementById('btn-add-event');
    if (authBtn) authBtn.style.display = 'none';
    if (addBtn) addBtn.style.display = 'inline-flex';
    console.log('GCal OAuth: authenticated');
  }

  function getToken() { return accessToken; }
  function isAuthed() { return !!accessToken; }

  async function apiCall(url, method, body) {
    if (!accessToken) { requestAccess(); return null; }
    var opts = { method: method, headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    if (res.status === 401) { accessToken = null; localStorage.removeItem('gcal-access-token'); requestAccess(); return null; }
    if (res.status === 204) return { success: true }; // DELETE returns 204
    return await res.json();
  }

  async function createEvent(title, date, startTime, endTime, description) {
    var body = {
      summary: title, description: description || '',
      start: { dateTime: date + 'T' + startTime + ':00', timeZone: 'Asia/Ho_Chi_Minh' },
      end: { dateTime: date + 'T' + endTime + ':00', timeZone: 'Asia/Ho_Chi_Minh' }
    };
    return await apiCall('https://www.googleapis.com/calendar/v3/calendars/primary/events', 'POST', body);
  }

  async function updateEvent(eventId, title, date, startTime, endTime, description) {
    var body = {
      summary: title, description: description || '',
      start: { dateTime: date + 'T' + startTime + ':00', timeZone: 'Asia/Ho_Chi_Minh' },
      end: { dateTime: date + 'T' + endTime + ':00', timeZone: 'Asia/Ho_Chi_Minh' }
    };
    return await apiCall('https://www.googleapis.com/calendar/v3/calendars/primary/events/' + eventId, 'PATCH', body);
  }

  async function deleteEvent(eventId) {
    return await apiCall('https://www.googleapis.com/calendar/v3/calendars/primary/events/' + eventId, 'DELETE', null);
  }

  async function getEvent(eventId) {
    return await apiCall('https://www.googleapis.com/calendar/v3/calendars/primary/events/' + eventId, 'GET', null);
  }

  setTimeout(init, 1500);
  return { init: init, requestAccess: requestAccess, getToken: getToken, isAuthed: isAuthed, createEvent: createEvent, updateEvent: updateEvent, deleteEvent: deleteEvent, getEvent: getEvent };
})();

/* ===== UI Functions ===== */
function handleGCalAuth() { GCalAuth.requestAccess(); }

function openAddEventModal() {
  document.getElementById('ev-modal-title').textContent = 'Thêm buổi dạy';
  document.getElementById('ev-id').value = '';
  document.getElementById('ev-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-note').value = '';
  document.getElementById('ev-start').value = '19:00';
  document.getElementById('ev-end').value = '20:00';
  document.getElementById('ev-delete-btn').style.display = 'none';
  document.getElementById('modal-event').hidden = false;
}

function openEditEventModal(eventId, title, date, startTime, endTime, note) {
  if (!GCalAuth.isAuthed()) { GCalAuth.requestAccess(); return; }
  document.getElementById('ev-modal-title').textContent = 'Sửa buổi dạy';
  document.getElementById('ev-id').value = eventId;
  document.getElementById('ev-title').value = title || '';
  document.getElementById('ev-date').value = date || '';
  document.getElementById('ev-start').value = startTime || '19:00';
  document.getElementById('ev-end').value = endTime || '20:00';
  document.getElementById('ev-note').value = note || '';
  document.getElementById('ev-delete-btn').style.display = 'inline-flex';
  document.getElementById('modal-event').hidden = false;
}

function closeEventModal() { document.getElementById('modal-event').hidden = true; }

async function saveGCalEvent(e) {
  e.preventDefault();
  var eventId = document.getElementById('ev-id').value;
  var title = document.getElementById('ev-title').value.trim();
  var date = document.getElementById('ev-date').value;
  var start = document.getElementById('ev-start').value;
  var end = document.getElementById('ev-end').value;
  var note = document.getElementById('ev-note').value.trim();
  if (!title || !date || !start || !end) return alert('Điền đủ thông tin');

  var result;
  if (eventId) {
    result = await GCalAuth.updateEvent(eventId, title, date, start, end, note);
    if (result) alert('✅ Đã cập nhật: ' + title);
  } else {
    result = await GCalAuth.createEvent(title, date, start, end, note);
    if (result && result.id) alert('✅ Đã tạo: ' + title);
  }

  if (result) {
    closeEventModal();
    refreshAfterChange();
  }
}

async function deleteGCalEvent() {
  var eventId = document.getElementById('ev-id').value;
  if (!eventId) return;
  if (!confirm('Xóa buổi dạy này khỏi Google Calendar?')) return;
  var result = await GCalAuth.deleteEvent(eventId);
  if (result) {
    alert('🗑️ Đã xóa');
    closeEventModal();
    refreshAfterChange();
  }
}

function refreshAfterChange() {
  // Reload iframe
  var iframe = document.getElementById('gcal-iframe');
  if (iframe) iframe.src = iframe.src;
  // Reload data after short delay
  setTimeout(function() {
    if (typeof GCalSync !== 'undefined') GCalSync.fetchEvents(null, null, true);
    setTimeout(function() {
      if (typeof loadAllExternalData === 'function') loadAllExternalData();
    }, 2000);
  }, 1500);
}

/* Click on session item to edit */
function onSessionClick(eventId) {
  if (!GCalAuth.isAuthed()) { GCalAuth.requestAccess(); return; }
  var all = (typeof getAllSessions === 'function') ? getAllSessions() : [];
  var session = all.find(function(s) { return s.id === eventId; });
  if (!session) return;

  var d = new Date(session.date);
  var dateStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  var startTime = d.toTimeString().slice(0,5);
  var endD = session.dateEnd ? new Date(session.dateEnd) : null;
  var endTime = endD ? endD.toTimeString().slice(0,5) : '20:00';

  openEditEventModal(eventId, session.name, dateStr, startTime, endTime, session.note || '');
}
