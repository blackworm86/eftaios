@echo off
rem Writes the current network as JSON (rl\export\eftaios-net-main.json) for the app.
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python -m eftaios_rl.export_js --run main
