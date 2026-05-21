/* ===== GCAL-AUTH.JS - Google Calendar OAuth for create/edit/delete events ===== */

var GCalAuth = (function() {
  var CLIENT_ID = '508450041217-3bc9vrbbusm6iqn2sbgac620dhn3e3dq.apps.googleusercontent.com'; // Replace after creating OAuth client
  var SCOPES = 'https://www.googleapis.com/auth/calendar';
  var tokenClient = null;
  var accessToken = localStorage.getItem('gcal-access-token') || null;

  function init() {
    if (typeof google === 'undefined' || !google.accounts) {
      console.warn('Google Identity Services not loaded');
      return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: function(response) {
        if (response.access_token) {
          accessToken = response.access_token;
          localStorage.setItem('gcal-access-token', accessToken);
          onAuthSuccess();
        }
      }
    });
    // Check if we already have a token
    if (accessToken) {
      verifyToken();
    }
  }

  function requestAccess() {
    if (!tokenClient) { init(); }
    if (tokenClient) tokenClient.requestAccessToken();
  }

  function verifyToken() {
    fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    }).then(function(r) {
      if (r.ok) onAuthSuccess();
      else { accessToken = null; localStorage.removeItem('gcal-access-token'); }
    }).catch(function() { accessToken = null; localStorage.removeItem('gcal-access-token'); });
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

  async function createEvent(title, date, startTime, endTime, description) {
    if (!accessToken) { requestAccess(); return null; }
    var startDT = date + 'T' + startTime + ':00+07:00';
    var endDT = date + 'T' + endTime + ':00+07:00';
    var body = {
      summary: title,
      description: description || '',
      start: { dateTime: startDT, timeZone: 'Asia/Ho_Chi_Minh' },
      end: { dateTime: endDT, timeZone: 'Asia/Ho_Chi_Minh' }
    };
    var res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.status === 401) { accessToken = null; localStorage.removeItem('gcal-access-token'); requestAccess(); return null; }
    var data = await res.json();
    console.log('Event created:', data.id);
    return data;
  }

  async function deleteEvent(eventId) {
    if (!accessToken) return false;
    var res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events/' + eventId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    return res.ok;
  }

  // Init on load
  setTimeout(init, 1500);

  return { init: init, requestAccess: requestAccess, getToken: getToken, isAuthed: isAuthed, createEvent: createEvent, deleteEvent: deleteEvent };
})();

function handleGCalAuth() { GCalAuth.requestAccess(); }
function openAddEventModal() {
  var today = new Date().toISOString().slice(0, 10);
  document.getElementById('ev-date').value = today;
  document.getElementById('ev-title').value = '';
  document.getElementById('ev-note').value = '';
  document.getElementById('ev-start').value = '19:00';
  document.getElementById('ev-end').value = '20:00';
  document.getElementById('modal-event').hidden = false;
}
function closeEventModal() { document.getElementById('modal-event').hidden = true; }

async function createGCalEvent(e) {
  e.preventDefault();
  var title = document.getElementById('ev-title').value.trim();
  var date = document.getElementById('ev-date').value;
  var start = document.getElementById('ev-start').value;
  var end = document.getElementById('ev-end').value;
  var note = document.getElementById('ev-note').value.trim();
  if (!title || !date || !start || !end) return alert('Điền đủ thông tin');
  var result = await GCalAuth.createEvent(title, date, start, end, note);
  if (result && result.id) {
    alert('✅ Đã tạo sự kiện: ' + title);
    closeEventModal();
    // Refresh iframe
    var iframe = document.getElementById('gcal-iframe');
    if (iframe) iframe.src = iframe.src;
    // Reload data
    setTimeout(loadAllExternalData, 2000);
  }
}
