const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'ClassSchedule',
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  });

  // index.html is copied into app/ folder during build
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
