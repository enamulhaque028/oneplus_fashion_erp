@echo off
cd /d "%~dp0"
set "APP=%~dp0OnePlusFashion_ERP.html"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --new-window "%APP%" & exit /b
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --new-window "%APP%" & exit /b
if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" start "" "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" "%APP%" & exit /b
start "" "%APP%"
