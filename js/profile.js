async function saveProfile() {
    var name = document.getElementById('p-name').value || 'Giáo viên';
    Store.profile.full_name = name;
    syncUI('🔄 Lưu...');
    await db.from('profiles').upsert({ id: CONFIG.USER_ID, full_name: name, theme: Store.profile.theme, font: Store.profile.font });
    document.getElementById('welcome-name').textContent = name;
    syncUI('✅ Synced');
}

async function setTheme(t) {
    document.body.setAttribute('data-theme', t);
    document.getElementById('t-light').classList.toggle('active', t === 'light');
    document.getElementById('t-dark').classList.toggle('active', t === 'dark');
    if (Store.profile.theme !== t) {
        Store.profile.theme = t;
        await db.from('profiles').upsert({ id: CONFIG.USER_ID, full_name: Store.profile.full_name, theme: t, font: Store.profile.font });
    }
}

async function setFont(f) {
    document.body.style.fontFamily = f;
    if (Store.profile.font !== f) {
        Store.profile.font = f;
        await db.from('profiles').upsert({ id: CONFIG.USER_ID, full_name: Store.profile.full_name, theme: Store.profile.theme, font: f });
    }
}
