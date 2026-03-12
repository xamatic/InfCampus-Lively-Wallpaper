@echo off
title Grades Server - Stop
echo Stopping Grades Server...

taskkill /F /IM node.exe /FI "WINDOWTITLE eq *grades-server*" 2>nul
taskkill /F /IM node.exe 2>nul

echo.
echo Server stopped.
timeout /t 2 >nul
