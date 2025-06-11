const { app, BrowserWindow } = require('electron');
const { initDatabase } = require('../database/db');
const remoteMain = require('@electron/remote/main'); 
const path = require('path');

remoteMain.initialize();

app.whenReady().then(() => {
  initDatabase();
});

require('../backend/turbine');
require('../backend/pdfPorocilo');


function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'assets', 'icon.icns'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  remoteMain.enable(win.webContents);
  win.loadFile('src/public/index.html');
if (!app.isPackaged) {
  win.webContents.openDevTools();
}
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