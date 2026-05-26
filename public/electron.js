const { app, BrowserWindow } = require('electron');
const path = require('path');

app.on('ready', () => {
  const win = new BrowserWindow({ width: 1280, height: 800, webPreferences: { preload: path.join(__dirname, 'preload.js') } });
  win.loadFile(path.join(__dirname, '../dist/index.html'));
});