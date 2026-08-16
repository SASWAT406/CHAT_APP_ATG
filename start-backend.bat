@echo off
title QuickChat - Backend Server
echo ===================================================
echo   Starting QuickChat Real-Time Backend Server
echo ===================================================
cd /d "%~dp0chat-backend"
npm start
pause
