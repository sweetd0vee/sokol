# Запуск API в dev-режиме (из каталога sokol-backend, venv активирован).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".secrets\sokol.env")) {
    Write-Host "Создайте .secrets\sokol.env из .secrets\sokol.env.example" -ForegroundColor Yellow
    exit 1
}

# Важно: один процесс на порт. Если 8801 занят старым uvicorn — остановите его.
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8802
