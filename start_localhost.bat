@echo off
title Zoe Pharmacy - Localhost Launcher
echo ========================================================
echo   Starting Zoe Pharmacy & General Merchandise (Localhost)
echo ========================================================
echo.

:: 1. Start PHP Backend API on Port 8000
echo [1/2] Starting PHP Backend API on http://127.0.0.1:8000 ...
start "Zoe Pharmacy - PHP Backend" cmd /k "php -S 127.0.0.1:8000"

:: 2. Start Vite Frontend on Port 5199
echo [2/2] Starting Vite Frontend on http://localhost:5199 ...
start "Zoe Pharmacy - Vite Frontend" cmd /k "npm run dev"

echo.
echo ========================================================
echo   System is launching!
echo   Opening browser in 3 seconds...
echo ========================================================
timeout /t 3 /nobreak >nul
start http://localhost:5199

echo.
echo All services are running in background console windows.
echo To stop them, simply close the opened console windows.
pause
