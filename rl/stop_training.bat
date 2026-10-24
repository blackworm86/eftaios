@echo off
rem Asks the training to finish its current iteration and stop (it can be resumed with run_training.bat).
cd /d "%~dp0"
if not exist runs\main mkdir runs\main
type nul > runs\main\STOP
echo Stop requested. The window running run_training.bat will close after the current iteration.
