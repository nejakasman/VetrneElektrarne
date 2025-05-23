const { app, BrowserWindow } = require('electron');
const { initDatabase } = require('../database/db');

app.whenReady().then(() => {
  initDatabase();
});

require('../backend/turbine');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  win.loadFile('src/public/index.html');
  win.webContents.openDevTools();
}


app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
