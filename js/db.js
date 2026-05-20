var db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    global: { headers: { 'apikey': CONFIG.SUPABASE_KEY, 'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY } }
});

var Store = {
    sessions: [],
    students: [],
    groups: [],
    profile: { full_name: 'Hannah', theme: 'dark', font: "'Be Vietnam Pro',sans-serif" },
    async load() {
        try {
            var r1 = await db.from('sessions').select('*').eq('user_id', CONFIG.USER_ID).order('date', { ascending: true });
            var r2 = await db.from('students').select('*').eq('user_id', CONFIG.USER_ID).order('created_at', { ascending: true });
            var r3 = await db.from('profiles').select('*').eq('id', CONFIG.USER_ID).single();
            var r4 = await db.from('groups').select('*').eq('user_id', CONFIG.USER_ID).order('created_at', { ascending: true });
            this.sessions = r1.data || [];
            this.students = r2.data || [];
            if (r3.data) this.profile = r3.data;
            this.groups = r4.data || [];
            console.log('✅ Loaded:', this.sessions.length, 'sessions,', this.students.length, 'students,', this.groups.length, 'groups');
        } catch (e) { console.error('❌ Store.load error:', e); }
    }
};
