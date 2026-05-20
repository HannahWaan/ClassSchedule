function exportPDF() {
    var doc = new jspdf.jsPDF();
    doc.setFontSize(16);
    doc.text('Lich day - ' + (Store.profile.full_name || 'Giao vien'), 14, 20);
    doc.setFontSize(10);
    var y = 35;
    Store.sessions.forEach(function(s) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(s.date + ' | ' + s.start_time.slice(0, 5) + '-' + s.end_time.slice(0, 5) + ' | ' + s.lesson + ' | ' + (s.student_name || '') + ' | ' + s.fee + 'd', 14, y);
        y += 8;
    });
    doc.save('lich-day.pdf');
}

function exportExcel() {
    var data = Store.sessions.map(function(s) {
        return { Ngay: s.date, BatDau: s.start_time, KetThuc: s.end_time, BaiGiang: s.lesson, HocVien: s.student_name || '', HocPhi: s.fee, GhiChu: s.note || '' };
    });
    var ws = XLSX.utils.json_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LichDay');
    XLSX.writeFile(wb, 'lich-day.xlsx');
}

async function shareSchedule() {
    var text = 'Lich day cua ' + (Store.profile.full_name || 'Giao vien') + ':\n';
    Store.sessions.slice(0, 10).forEach(function(s) {
        text += s.date + ' ' + s.start_time.slice(0, 5) + '-' + s.end_time.slice(0, 5) + ' ' + s.lesson + '\n';
    });
    if (navigator.share) {
        await navigator.share({ title: 'ClassSchedule', text: text });
    } else {
        await navigator.clipboard.writeText(text);
        alert('Đã copy vào clipboard!');
    }
}
