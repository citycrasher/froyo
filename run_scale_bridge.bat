@echo off
SETLOCAL
cd /d "%~dp0"

echo ==========================================
echo   Starting MyFroyoland Scale Bridge
echo   Connects Essae DS-852 (COM3) to POS
echo ==========================================

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

:: Check if node_modules exists, if not install bridge dependencies
if not exist node_modules (
    echo.
    echo node_modules not found. Installing bridge dependencies...
    call npm install serialport @serialport/parser-readline express cors
)

echo.
echo Attempting to start bridge on COM3...
echo Keep this window open while using the POS.
echo.

node scale-bridge.js

pause
ENDLOCAL
