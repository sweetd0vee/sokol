@echo off
setlocal
set "script_dir=%~dp0"
set "frontend_root=%script_dir%.."
for %%I in ("%frontend_root%") do set "frontend_root=%%~fI"
if "%VITE_API_URL%"=="" set "VITE_API_URL=http://localhost:8800"
docker build -t sber/sokol-fe:master -f "%frontend_root%\docker\Dockerfile" --build-arg "VITE_API_URL=%VITE_API_URL%" "%frontend_root%"
if errorlevel 1 exit /b 1
endlocal
