@echo off
rem One-time setup on Windows: Python environment, PyTorch (GPU if available), tests, a 2-minute smoke run.
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.10 or newer was not found. Install it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^) and run this again.
  exit /b 1
)
if not exist .venv (
  echo Creating the Python environment...
  python -m venv .venv || exit /b 1
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip || exit /b 1
python -m pip install -r requirements.txt || exit /b 1

rem PyTorch: the CUDA build that works on this PC (tries the newest first), the CPU build otherwise
python install_torch.py || exit /b 1
python -c "import torch; print('PyTorch', torch.__version__, '| CUDA available:', torch.cuda.is_available(), '| GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'none')"

echo.
echo Running the rules and conformance tests...
python tests\test_engine.py || (echo TESTS FAILED & exit /b 1)
python tests\test_conformance.py || (echo TESTS FAILED & exit /b 1)
python tests\test_env.py || (echo TESTS FAILED & exit /b 1)

echo.
echo Smoke run of the training ^(a few minutes^)...
python -m eftaios_rl.train --run smoke --smoke || (echo SMOKE RUN FAILED - send runs\smoke\train.log to the developer & exit /b 1)
echo.
echo ALL GOOD. Start the real training with run_training.bat
endlocal
