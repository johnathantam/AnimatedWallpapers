// main.js

const { app, BrowserWindow } = require('electron');
const ENGINE = require('bindings')('engine');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 800,
    minHeight: 450,
    icon: "./icons/papier-icon.ico",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true, // enable node processes in web workers
      contextIsolation: false // separate context btw internal logic and website in webContents (make 'require' work)
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    ENGINE.hideBackground();
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});