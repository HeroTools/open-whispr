@echo off
echo Starting OpenWhispr...
call npm start
if %errorlevel% neq 0 (
    echo.
    echo An error occurred. Press any key to exit.
    pause
)
