@echo off
title QuickChat - Build Desktop Release
echo ===================================================
echo   Building QuickChat Standalone Windows Release
echo ===================================================
cd /d "%~dp0chat-client"
node build-app.js
pause
