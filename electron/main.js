const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

// Remove default menu for cleaner look
Menu.setApplicationMenu(null);

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'ClassSchedule',
    icon: path.join(__dirname, '..', 'favicon.svg'),
    backgroundColor: '#09090b',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    frame: true,
    titleBarStyle: 'default',
    show: false
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));

  // Show window when ready (avoid white flash)
  win.once('ready-to-show', () => {
    win.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
