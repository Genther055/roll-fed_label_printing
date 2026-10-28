@echo off
chcp 65001 > nul
echo ============================================================
echo   ROLL-PRINT CAD — Запуск проекту в інтернет (Online Host)
echo ============================================================
echo.
echo 1. Запуск бекенд-сервера...
start /b python app.py
timeout /t 2 > nul

echo 2. Створення публічного HTTPS тунелю в інтернет...
echo Відкрийте згенероване посилання у будь-якому браузері чи на телефоні:
ssh -o StrictHostKeyChecking=no -R 80:127.0.0.1:8088 nokey@localhost.run
pause
