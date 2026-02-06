@echo off
echo Clearing Windows icon cache...

taskkill /f /im explorer.exe

cd /d %userprofile%\AppData\Local\Microsoft\Windows\Explorer

attrib -h IconCache.db
del IconCache.db

attrib -h iconcache_*.db
del iconcache_*.db

echo Icon cache cleared!
echo Restarting Windows Explorer...

start explorer.exe

echo Done! Icons should refresh now.
pause
