const NotionSync = (() => {
  const PROXY_URL = 'https://notion-proxy-five-cyan.vercel.app/api/notion';
  let _cache = [];
  let _lastFetch = 0;
  const CACHE_TTL = 60000;

  async function fetchAll(forceRefresh) {
    if (!forceRefresh && _cache.length && Date.now() - _lastFetch < CACHE_TTL) return _cache;
    let all = [], hasMore = true, cursor = null;
    while (hasMore) {
      const body = { page_size: 100, sorts: [{ property: 'Date', direction: 'ascending' }] };
      if (cursor) body.start_cursor = cursor;
      try {
        const r = await fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const d = await r.json();
        if (d.results) all = all.concat(d.results);
        hasMore = d.has_more || false;
        cursor = d.next_cursor || null;
      } catch (e) { console.warn('NotionSync:', e.message); hasMore = false; }
    }
    _cache = all.map(parsePage);
    _lastFetch = Date.now();
    console.log('Notion: ' + _cache.length + ' sessions loaded');
    return _cache;
  }

  async function fetchRange(startDate, endDate) {
    try {
      const r = await fetch(PROXY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_size: 100, filter: { and: [{ property: 'Date', date: { on_or_after: startDate } }, { property: 'Date', date: { on_or_before: endDate } }] }, sorts: [{ property: 'Date', direction: 'ascending' }] })
      });
      const d = await r.json();
      return (d.results || []).map(parsePage);
    } catch (e) { console.warn('NotionSync range:', e.message); return []; }
  }

  function parsePage(page) {
    const p = page.properties || {};
    const name = p.Name?.title?.[0]?.plain_text || '';
    const dateStart = p.Date?.date?.start || '';
    const dateEnd = p.Date?.date?.end || '';
    const student = p.Student?.select?.name || '';
    const fee = p.Fee?.number || 0;
    const duration = p.Duration?.number || 0;
    const status = p.Status?.status?.name || 'Not started';
    const type = (p.Type?.select?.name || 'individual').toLowerCase();
    const color = (p.Color?.select?.name || 'default').toLowerCase();
    const note = p.Note?.rich_text?.[0]?.plain_text || '';
    let calcDur = duration;
    if (!calcDur && dateStart && dateEnd) calcDur = Math.round((new Date(dateEnd) - new Date(dateStart)) / 60000);
    return { id: page.id, name, date: dateStart, dateEnd, student, fee, duration: calcDur, status, type, color, note, source: 'notion' };
  }

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
  const upcoming = (s, limit) => { const now = new Date(); return s.filter(x => new Date(x.date) >= now && x.status !== 'Done').sort((a,b) => new Date(a.date) - new Date(b.date)).slice(0, limit || 5); };

  return { fetchAll, fetchRange, filterByPeriod, calcRevenue, calcMinutes, countSessions, countDone, uniqueStudents, upcoming, getCache: () => _cache };
})();
