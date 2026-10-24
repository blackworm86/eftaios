@echo off
rem Shows the last lines of the training log and the evaluation table.
cd /d "%~dp0"
echo ---- last log lines ----
powershell -NoProfile -Command "if (Test-Path runs\main\train.log) { Get-Content runs\main\train.log -Tail 12 } else { 'no log yet' }"
echo.
echo ---- evaluation history: iteration, Human team win %%, rule-based Humans %%, Alien team win %%, rule-based Aliens %% ----
powershell -NoProfile -Command "if (Test-Path runs\main\eval.csv) { Get-Content runs\main\eval.csv -Tail 15 } else { 'no evaluation yet' }"
