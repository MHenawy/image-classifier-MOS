@echo off
echo ==========================================
echo    VisionAI Image Scraper Setup ^& Run
echo ==========================================

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH. Please install Python to use this scraper.
    pause
    exit /b
)

:: Install icrawler if it isn't already installed
echo Checking dependencies...
pip show icrawler >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing required library 'icrawler'...
    pip install icrawler
)

:: Run the server
echo.
echo Launching VisionAI Backend Server...
python server.py

echo.
pause
