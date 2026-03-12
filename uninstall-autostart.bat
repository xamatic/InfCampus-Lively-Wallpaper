@echo off
title Grades Server - Uninstall from Startup
echo ============================================
echo   Grades Server - Auto-Start Uninstaller
echo ============================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_NAME=GradesServer.lnk"

echo Removing Grades Server from Windows Startup...
echo.

if exist "%STARTUP_FOLDER%\%SHORTCUT_NAME%" (
    del "%STARTUP_FOLDER%\%SHORTCUT_NAME%"
    echo [SUCCESS] Grades Server has been removed from Windows Startup!
) else (
    echo [INFO] Grades Server was not found in Windows Startup.
)

echo.
echo ============================================
echo.
pause
