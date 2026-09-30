@echo off
setlocal
set "script_dir=%~dp0"
pushd "%script_dir%"
docker compose up --build -d %*
set "err=%ERRORLEVEL%"
popd
exit /b %err%
