var db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
var Store = {
    sessions: [],
    students: [],
    profile: { full_name: 'Hannah', theme: 'dark', font: "'Inter',sans-serif" },
    async load() {
        var r1 = await db.from('sessions').select('*').eq('user_id', CONFIG.USER_ID).order('date');
        var r2 = await db.from('students').select('*').eq('user_id', CONFIG.USER_ID).order('created_at');
        var r3 = await db.from('profiles').select('*').eq('id', CONFIG.USER_ID).single();
        this.sessions = r1.data || [];
        this.students = r2.data || [];
        if (r3.data) this.profile = r3.data;
    }
};
