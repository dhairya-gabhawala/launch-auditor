const { app, BrowserWindow, dialog, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const PORT = 4545;

let serverInstance = null;
let mainWindow = null;
let aboutWindow = null;

const isDev = !app.isPackaged;
const appRoot = isDev ? path.resolve(__dirname, '..') : app.getAppPath();
const dataRoot = isDev ? appRoot : app.getPath('userData');

function ensureDataDir() {
  fs.mkdirSync(dataRoot, { recursive: true });
}

function ensureConfig() {
  const configPath = path.join(dataRoot, 'config.json');
  if (fs.existsSync(configPath)) {
    return;
  }

  const templatePath = path.join(appRoot, 'config.template.json');
  let contents = '{"sites": {}}\n';

  if (fs.existsSync(templatePath)) {
    contents = fs.readFileSync(templatePath, 'utf8');
    if (!contents.endsWith('\n')) {
      contents += '\n';
    }
  }

  fs.writeFileSync(configPath, contents);
}

function startServer() {
  ensureDataDir();
  ensureConfig();

  process.env.PORT = String(PORT);
  process.env.LAUNCH_AUDITOR_APP_ROOT = appRoot;
  process.env.LAUNCH_AUDITOR_DATA_DIR = dataRoot;

  const { startServer: startServerFn } = require(path.join(appRoot, 'src', 'server'));
  return startServerFn(PORT).then(server => {
    serverInstance = server;
    serverInstance.on('close', () => {
      if (app.isQuitting) {
        return;
      }
      dialog.showErrorBox('Launch Auditor stopped', 'The local server exited unexpectedly.');
      app.quit();
    });
    return server;
  });
}

function stopServer() {
  if (!serverInstance) {
    return;
  }

  serverInstance.close();
  serverInstance = null;
}

function getLogoSvg() {
  try {
    const svgPath = path.join(appRoot, 'public', 'favicon.svg');
    return fs.readFileSync(svgPath, 'utf8');
  } catch (err) {
    return '';
  }
}

function createAboutWindow() {
  if (aboutWindow) {
    aboutWindow.focus();
    return;
  }

  const version = app.getVersion();
  const name = app.getName();
  const logo = getLogoSvg();

  aboutWindow = new BrowserWindow({
    width: 420,
    height: 320,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: `About ${name}`,
    parent: mainWindow || undefined,
    modal: false,
    show: false,
    icon: path.join(appRoot, 'public', 'favicon.svg'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
    <title>About ${name}</title>
  </head>
  <body style="margin:0;font-family:-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;background:#f8fafc;color:#0f172a;">
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;">
      <div style="width:72px;height:72px;margin-bottom:16px;">${logo}</div>
      <div style="font-size:20px;font-weight:600;margin-bottom:4px;">${name}</div>
      <div style="font-size:13px;color:#475569;">Version ${version}</div>
      <div style="margin-top:16px;font-size:12px;color:#64748b;">Local audit reports for Adobe Launch/Tags.</div>
    </div>
  </body>
  </html>`;

  aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  aboutWindow.once('ready-to-show', () => aboutWindow.show());
  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });
}

function buildMenu() {
  const name = app.getName();
  const template = [
    {
      label: name,
      submenu: [
        { label: `About ${name}`, click: createAboutWindow },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggledevtools' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    icon: path.join(appRoot, 'public', 'favicon.svg'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(`http://localhost:${PORT}/`);
}

app.on('before-quit', () => {
  app.isQuitting = true;
  stopServer();
});

app.whenReady().then(async () => {
  ipcMain.on('open-about', () => {
    createAboutWindow();
  });
  buildMenu();
  try {
    await startServer();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Launch Auditor failed to start', error.message || String(error));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
