@echo off
rem The only file to double-click. It prepares everything on the first run, then shows a menu.
setlocal
cd /d "%~dp0"
title EFTAIOS network trainer
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3.12 or newer from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^), then double-click this file again.
  pause
  exit /b 1
)
if not exist .venv\Scripts\python.exe (
  echo First run: preparing the Python environment ^(a minute^)...
  python -m venv .venv
  if errorlevel 1 ( echo Could not create the Python environment. & pause & exit /b 1 )
  .venv\Scripts\python.exe -m pip install --upgrade pip numpy
)
.venv\Scripts\python.exe nnctl.py %*
echo.
pause
