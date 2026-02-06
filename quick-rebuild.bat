@echo off
echo Stopping processes...
taskkill /F /IM DictateVoice.exe >nul 2>&1
taskkill /F /IM electron.exe >nul 2>&1

echo Cleaning dist...
if exist dist rmdir /s /q dist

echo Building renderer...
cd src
call npm run build >nul 2>&1
cd ..

echo Packaging...
npx electron-builder --dir --config electron-builder.json

echo.
echo Done! Check dist\win-unpacked\DictateVoice.exe
pause
