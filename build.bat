@echo off
setlocal

:: Step 1 & 2: Folder Setup
if not exist "dist" mkdir "dist"
xcopy /E /Y "grades-extension\*" "dist\" /Q

:: Step 3: UI Setup
if not exist "dist\sites" mkdir "dist\sites"
xcopy /E /Y "sites\*" "dist\sites\" /Q

:: Step 4 & 5: User Input for Autostart
echo.
echo The node.js backend server allows data communication.
CHOICE /C YN /M "Would you like the node.js server to automatically start?"

IF %ERRORLEVEL% EQU 1 (
    echo Enabling autostart...
    :: Starts the installer minimized and moves on immediately
    start /min "" cmd /c install-autostart.bat
) ELSE (
    echo Skipping autostart. You must start the server manually in the future.
)

:: Step 6: Restarting the Server (Non-blocking)
echo.
echo Restarting the server...
:: Running the stop script minimized so it doesn't pop up over your face
start /min "" cmd /c stop-server.bat

:: Brief pause for the stop-script to finish its task before restarting
timeout /t 2 >nul

:: Step 7: Start Hidden Server
echo Starting server...
wscript.exe "start-server-hidden.vbs"

:: Step 8: Finalize
start "" notepad.exe "instructions.txt"

echo.
echo Build Complete! Load the 'dist' folder into Chrome.
:: Short delay so you can see the completion message before the window closes
timeout /t 3 >nul