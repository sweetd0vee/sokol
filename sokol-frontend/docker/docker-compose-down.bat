@echo off
setlocal
set "script_dir=%~dp0"
pushd "%script_dir%"
docker compose down %*
set "err=%ERRORLEVEL%"
popd
exit /b %err%
