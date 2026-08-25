@echo off
echo Installing dependencies...
call npm install

echo Building assets (Tailwind CSS)...
call npm run build

echo Copying assets...
if not exist assets mkdir assets
copy /Y dist\assets\*.css assets\style.css

echo Starting PHP Server at http://localhost:8000
echo Press Ctrl+C to stop.
start http://localhost:8000
php -S localhost:8000
pause
