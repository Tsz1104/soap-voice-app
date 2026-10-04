@echo off
chcp 65001 > nul
echo ========================================================
echo   音声入力SOAPノート を起動しています...
echo ========================================================

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Pythonが見つかりました。ローカルWebサーバーを起動します...
    echo ブラウザで http://localhost:8000 を開きます。
    start http://localhost:8000
    python -m http.server 8000
) else (
    echo ブラウザで index.html を直接開きます...
    start index.html
)
