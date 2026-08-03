@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if errorlevel 1 (
    echo Python ne naiden.
    echo Ustanovite Python s https://www.python.org/downloads/ i otmette Add Python to PATH.
    pause
    exit /b 1
)

if not exist "venv\Scripts\python.exe" (
    echo Sozdayu virtualnoe okruzhenie...
    py -m venv venv
    if errorlevel 1 (
        echo Ne udalos sozdat virtualnoe okruzhenie.
        pause
        exit /b 1
    )
)

echo Ustanavlivayu zavisimosti...
"venv\Scripts\python.exe" -m pip install --upgrade pip
"venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo Ne udalos ustanovit zavisimosti.
    pause
    exit /b 1
)

echo Zapusk SOKOL...
"venv\Scripts\python.exe" -m streamlit run app.py --server.address 127.0.0.1 --server.port 8502 --browser.gatherUsageStats false

pause
