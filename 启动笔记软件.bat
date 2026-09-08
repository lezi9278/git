@echo off
cd /d "%~dp0"
start "notes-app" /min node server.mjs 4173
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173"
