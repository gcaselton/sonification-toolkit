const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let backendProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
  });

  win.loadURL('http://localhost:8000'); // OR loadFile('dist/index.html') if serving static only
}

app.whenReady().then(() => {
  // Start FastAPI backend
  backendProcess = spawn(path.join(__dirname, 'backend', 'main.exe'), [], {
    detached: true,
    stdio: 'ignore'
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  if (backendProcess) backendProcess.kill();
});
