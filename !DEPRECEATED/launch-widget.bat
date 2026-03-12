@echo off
echo Starting Chrome with CORS disabled for grades widget...
echo.
echo WARNING: This browser session has reduced security.
echo Only use it for the grades widget, then close it.
echo.

:: Kill any existing Chrome instances using this profile
taskkill /F /IM chrome.exe 2>nul

:: Start Chrome with web security disabled
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
    --disable-web-security ^
    --disable-gpu ^
    --user-data-dir="%TEMP%\ChromeGradesWidget" ^
    --app="http://127.0.0.1:5500/test.html"

echo Chrome launched. If it didn't open, check if Chrome is installed at the default location.
pause
