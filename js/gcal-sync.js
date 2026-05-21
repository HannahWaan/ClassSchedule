const GCalSync = (() => {
  const API_KEY = 'AIzaSyBAfnz-ndBySXzKNAQh3tbW-uClFBF766c';
  const CALENDAR_ID = 'asstrayca@gmail.com';
  const TIMEZONE = 'Asia/Ho_Chi_Minh';

  let _cache = [];
  let _lastFetch = 0;
  const CACHE_TTL = 60000;

  async function fetchEvents(timeMin, timeMax, forceRefresh) {
    if (!forceRefresh && _cache.length && Date.now() - _lastFetch < CACHE_TTL) return _cache;
    const now = new Date();
    const min = timeMin || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const max = timeMax || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();
    const params = new URLSearchParams({
      key: API_KEY, timeMin: min, timeMax: max,
      singleEvents: 'true', orderBy: 'startTime',
      timeZone: TIMEZONE, maxResults: '250'
    });
    const url = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(CALENDAR_ID) + '/events?' + params.toString();
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { console.warn('GCal API error:', data.error.message); return _cache; }
      _cache = (data.items || []).map(parseEvent);
      _lastFetch = Date.now();
      console.log('GCal: ' + _cache.length + ' events loaded');
      return _cache;
    } catch (e) { console.warn('GCal fetch error:', e.message); return _cache; }
  }

  function parseEvent(ev) {
    const start = ev.start?.dateTime || ev.start?.date || '';
    const end = ev.end?.dateTime || ev.end?.date || '';
    const title = ev.summary || '';
    const note = ev.description || '';
    const color = ev.colorId || 'default';
    let duration = 0;
    if (start && end) duration = Math.round((new Date(end) - new Date(start)) / 60000);
    let student = '', type = 'individual', fee = 0;
    if (title.toLowerCase().includes('group') || title.toLowerCase().includes('nhóm') || title.toLowerCase().includes('nhom')) type = 'group';
    const parts = title.split(' - ');
    if (parts.length >= 2) { student = parts.slice(1).join(' - ').trim(); } else { student = title; }
    const feeMatch = note.match(/(?:fee|học phí|hoc phi|gia)[:\s]*(\d+)/i);
    if (feeMatch) { fee = parseInt(feeMatch[1]); if (fee < 1000) fee = fee * 1000; }
    const feeMatchK = note.match(/(\d+)k/i);
    if (!fee && feeMatchK) fee = parseInt(feeMatchK[1]) * 1000;
    return { id: ev.id, name: title, date: start, dateEnd: end, student, fee, duration, status: isPast(end) ? 'Done' : 'Not started', type, color, note, location: ev.location || '', source: 'gcal' };
  }

  function isPast(dateStr) { return new Date(dateStr) < new Date(); }

  function filterByPeriod(sessions, period) {
    const now = new Date(); let start, end;
    switch (period) {
      case 'today': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); end = new Date(start.getTime() + 86400000); break;
      case 'week': { const day = now.getDay() || 7; start = new Date(now); start.setDate(now.getDate() - day + 1); start.setHours(0,0,0,0); end = new Date(start.getTime() + 7*86400000); break; }
      case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59); break;
      case 'year': start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear(), 11, 31, 23,59,59); break;
      default: return sessions;
    }
    return sessions.filter(s => { const d = new Date(s.date); return d >= start && d <= end; });
  }

  const calcRevenue = (s, p) => filterByPeriod(s, p).filter(x => x.status === 'Done').reduce((sum, x) => sum + (x.fee || 0), 0);
  const calcMinutes = (s, p) => filterByPeriod(s, p).filter(x => x.status === 'Done').reduce((sum, x) => sum + (x.duration || 0), 0);
  const countSessions = (s, p) => filterByPeriod(s, p).length;
  const countDone = (s, p) => filterByPeriod(s, p).filter(x => x.status === 'Done').length;
  const uniqueStudents = (s) => [...new Set(s.map(x => x.student).filter(Boolean))];
  const upcoming = (s, limit) => { const now = new Date(); return s.filter(x => new Date(x.date) >= now).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, limit || 5); };

  return { fetchEvents, filterByPeriod, calcRevenue, calcMinutes, countSessions, countDone, uniqueStudents, upcoming, getCache: () => _cache };
})();
