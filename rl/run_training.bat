@echo off
rem Starts (or resumes) the self-play training and keeps it running: if it crashes it restarts in 30 seconds.
rem To stop it cleanly create an empty file named STOP in runs\main\ (or run stop_training.bat).
setlocal
cd /d "%~dp0"
call .venv\Scripts\activate.bat
if exist runs\main\STOP del runs\main\STOP
:loop
python -m eftaios_rl.train --run main
if exist runs\main\STOP goto end
echo Training exited; restarting in 30 seconds ^(Ctrl+C to quit^)...
timeout /t 30 /nobreak >nul
goto loop
:end
echo Training stopped cleanly.
endlocal
