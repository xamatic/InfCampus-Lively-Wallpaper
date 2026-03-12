@echo off
title Grades Server - Install to Startup
echo ============================================
echo   Grades Server - Auto-Start Installer
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_NAME=GradesServer.lnk"
set "VBS_FILE=%SCRIPT_DIR%start-server-hidden.vbs"

echo Installing Grades Server to Windows Startup...
echo.

:: Create a shortcut using PowerShell
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_FOLDER%\%SHORTCUT_NAME%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_FILE%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'Grades Server Auto-Start'; $s.Save()"

if exist "%STARTUP_FOLDER%\%SHORTCUT_NAME%" (
    echo [SUCCESS] Grades Server has been added to Windows Startup!
    echo.
    echo Location: %STARTUP_FOLDER%\%SHORTCUT_NAME%
    echo.
    echo The server will now start automatically when you log in.
    echo It runs in the background with no visible window.
) else (
    echo [ERROR] Failed to create startup shortcut.
    echo Please try running this script as Administrator.
)

echo.
echo ============================================
echo.
pause
