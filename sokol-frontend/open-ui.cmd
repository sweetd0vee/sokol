@echo off
REM Opens the local Vite UI via IPv4. Do not use http://localhost — on this
REM machine WSL steals ::1 and Chrome times out with ERR_CONNECTION_TIMED_OUT.
start "" "http://127.0.0.1:5182/"
