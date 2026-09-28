@echo off
rem Runs every automated check on Windows: unit tests, then the end-to-end
rem workflow twice (do the work, then reopen and check the save).
rem Set GODOT to the *console* Godot exe, e.g.
rem   set GODOT=C:\Godot\Godot_v4.7.2-stable_win64_console.exe
setlocal
cd /d "%~dp0"
if "%GODOT%"=="" set GODOT=godot
"%GODOT%" --headless --path . --import >nul 2>&1
"%GODOT%" --headless --path . -s tests/run_tests.gd
if errorlevel 1 exit /b 1
set E2E=%TEMP%\agent_ecosystem_e2e_%RANDOM%
mkdir "%E2E%"
"%GODOT%" --headless --path . -- --save-dir="%E2E%" --scenario=e2e
if errorlevel 1 exit /b 1
"%GODOT%" --headless --path . -- --save-dir="%E2E%" --scenario=e2e-reopen
if errorlevel 1 exit /b 1
rmdir /s /q "%E2E%"
echo All checks passed.
