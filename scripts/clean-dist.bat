@echo off
cd /d "%~dp0.."
echo Cleaning dist folder...

taskkill /F /IM DictateVoice.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1

timeout /t 1 /nobreak >nul

if exist "dist" (
    echo Removing dist folder...
    rmdir /s /q "dist" 2>nul

    rem If rmdir fails, try alternative method
    if exist "dist" (
        echo Using alternative cleanup method...
        rd /s /q "\\?\%CD%\dist" 2>nul
    )

    rem Wait a bit
    timeout /t 1 /nobreak >nul
)

echo Creating fresh dist folder...
mkdir dist

echo Done!
