const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const clientDir = __dirname;
const stagingDir = path.join(clientDir, '.staging-app');
const resourcesDir = path.join(clientDir, 'dist', 'win-unpacked', 'resources');
const asarOutput = path.join(resourcesDir, 'app.asar');
const zipOutput = path.join(clientDir, 'dist', 'QuickChat-v1.0.0-Windows.zip');
const rootZipOutput = path.join(path.dirname(clientDir), 'QuickChat-v1.0.0-Windows.zip');

console.log('🚀 Building QuickChat Standalone Desktop Package...');

// 1. Prepare staging directory
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// Copy app files
const filesToCopy = ['main.js', 'index.html', 'styles.css', 'app.js', 'package.json', 'gmailService.js'];
filesToCopy.forEach(file => {
  const src = path.join(clientDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(stagingDir, file));
  }
});

// Copy assets
const assetsSrc = path.join(clientDir, 'assets');
const assetsDest = path.join(stagingDir, 'assets');
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
}

// Copy node_modules (socket.io-client)
const nmSrc = path.join(clientDir, 'node_modules', 'socket.io-client');
const nmDest = path.join(stagingDir, 'node_modules', 'socket.io-client');
if (fs.existsSync(nmSrc)) {
  fs.mkdirSync(path.dirname(nmDest), { recursive: true });
  fs.cpSync(nmSrc, nmDest, { recursive: true });
}

console.log('📦 Packing app.asar...');
execSync(`npx -y @electron/asar pack "${stagingDir}" "${asarOutput}"`, { stdio: 'inherit', cwd: clientDir });

// Clean up staging
fs.rmSync(stagingDir, { recursive: true, force: true });

console.log('🗜️ Compressing distribution ZIP package...');
const distZipTemp = path.join(clientDir, '.temp-zip-build');
if (fs.existsSync(distZipTemp)) {
  fs.rmSync(distZipTemp, { recursive: true, force: true });
}
fs.mkdirSync(distZipTemp, { recursive: true });

const winUnpacked = path.join(clientDir, 'dist', 'win-unpacked');
fs.cpSync(winUnpacked, distZipTemp, { recursive: true });

if (fs.existsSync(zipOutput)) fs.unlinkSync(zipOutput);
if (fs.existsSync(rootZipOutput)) fs.unlinkSync(rootZipOutput);

execSync(`powershell -Command "Compress-Archive -Path '${distZipTemp}\\*' -DestinationPath '${zipOutput}' -Force"`, { stdio: 'inherit' });
fs.copyFileSync(zipOutput, rootZipOutput);

fs.rmSync(distZipTemp, { recursive: true, force: true });

console.log('\n=============================================================');
console.log('🎉 STANDALONE RELEASE PACKAGE BUILT SUCCESSFULLY!');
console.log(`📁 Executable: dist/win-unpacked/QuickChat.exe`);
console.log(`📦 Release Zip: dist/QuickChat-v1.0.0-Windows.zip`);
console.log(`📦 Root Zip: QuickChat-v1.0.0-Windows.zip`);
console.log('=============================================================\n');
