/**
 * ============================================================================
 * Antigravity Desktop Client - Electron Main Process
 * Integrated with GmailService (OAuth 2.0 Loopback & Official Gmail REST API)
 * ============================================================================
 */

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const GmailService = require('./gmailService');

const DEFAULT_CLIENT_ID = '15401024049-dp09ffcq1qop4sb2hauerpmu42bdbgrp.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';

let mainWindow = null;
let gmailService = new GmailService(DEFAULT_CLIENT_ID, DEFAULT_CLIENT_SECRET);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1050,
    height: 750,
    minWidth: 850,
    minHeight: 600,
    backgroundColor: '#111b21',
    title: 'Antigravity',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----------------------------------------------------
// Google OAuth 2.0 Login IPC Handler
// ----------------------------------------------------
ipcMain.handle('google-oauth-login', async (event, args = {}) => {
  const clientId = (args.clientId && args.clientId.trim()) ? args.clientId.trim() : DEFAULT_CLIENT_ID;
  const clientSecret = (args.clientSecret && args.clientSecret.trim()) ? args.clientSecret.trim() : DEFAULT_CLIENT_SECRET;

  gmailService.updateCredentials(clientId, clientSecret);

  return await gmailService.startOAuthFlow((authUrl) => {
    shell.openExternal(authUrl);
  });
});

// ----------------------------------------------------
// Official Gmail API Send Email IPC Handler
// ----------------------------------------------------
ipcMain.handle('gmail-send-email', async (event, { to, subject, body, from, isHtml }) => {
  return await gmailService.sendEmail({ to, subject, body, from, isHtml });
});

// ----------------------------------------------------
// Logout / Clear Tokens IPC Handler
// ----------------------------------------------------
ipcMain.handle('gmail-logout', async () => {
  gmailService.clearTokens();
  return { success: true };
});

// ----------------------------------------------------
// Native OS Mail Client IPC Handler
// ----------------------------------------------------
ipcMain.handle('open-native-mail', async (event, { recipient, subject, body }) => {
  try {
    const encodedSubject = encodeURIComponent(subject || 'Message from Antigravity');
    const encodedBody = encodeURIComponent(body || 'Hey! Join me on Antigravity.');
    const mailtoUrl = `mailto:${recipient || ''}?subject=${encodedSubject}&body=${encodedBody}`;

    await shell.openExternal(mailtoUrl);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
