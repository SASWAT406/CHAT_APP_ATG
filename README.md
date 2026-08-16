# 💬 QuickChat - WhatsApp Desktop Real-Time Chat App

A modern, standalone WhatsApp-style desktop chat application built with **Electron**, **Socket.io**, **Node.js/Express**, and **MongoDB Atlas** (with auto-fallback).

![QuickChat Banner](chat-client/assets/icon.svg)

---

## ✨ Features

- **WhatsApp Dark UI**: Signature emerald green accent, dark palette, message bubble tails, double blue ticks, date badges, and wallpaper pattern.
- **Real-Time Rooms & Channels**: Pre-configured `# General Lounge`, `# Tech Talk`, `# Gaming Hub`, and instant custom channel creation.
- **Media & File Attachments**: Share images with built-in lightbox preview and files with download actions.
- **Typing Indicators & Active Presence**: Live "*User is typing...*" indicators and active user presence tracking.
- **Web Audio Sound Effects**: Clean synthesized WhatsApp-style audio chimes for sent and received messages (zero external audio file dependencies).
- **Desktop System Notifications**: Native OS notification popups when messages arrive in the background.
- **Multi-Server Connection Switcher**: Connect to local dev server or live cloud server (Render/Railway) on the fly.
- **Standalone Windows Installer**: Ready-to-distribute NSIS installer (`.exe`) generated with `electron-builder`.

---

## 🚀 Quick Start (Local Development)

### 1. Start the Backend Server:
Double click **`start-backend.bat`** or run:
```bash
cd chat-backend
npm start
```
The server will start on `http://localhost:5000`.

### 2. Start the Desktop App:
Double click **`start-client.bat`** or run:
```bash
cd chat-client
npm start
```

---

## 📦 Build Standalone Installer for Distribution

To generate the `.exe` installer for distributing to anyone:

Double click **`build-installer.bat`** or run:
```bash
cd chat-client
npm run dist
```
The standalone installer will be output to:
`chat-client/dist/QuickChat Setup 1.0.0.exe`

See [DISTRIBUTION_GUIDE.md](DISTRIBUTION_GUIDE.md) for full cloud deployment and GitHub Releases publishing instructions!
