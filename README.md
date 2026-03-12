# GradesWPInfCampus

GradesWPInfCampus is a local Infinite Campus wallpaper setup built from three parts:
- a local Node.js backend in `grades-server.js`,
- an unpacked Chromium extension in `grades-extension/`,
- a Lively Wallpaper web wallpaper in `sites/wallpaper/`.

## Fast Setup

Run the installer:

```powershell
.\setup.bat
```

The installer can:
- install Node.js LTS,
- install Lively Wallpaper with `winget`,
- prepare the `dist` folder,
- start the backend server,
- configure Windows startup,
- try to set the wallpaper in Lively automatically,
- open a visual setup guide for the final manual steps.

## Manual Setup

### 1. Start the backend

```powershell
npm install
node grades-server.js
```

The backend uses:
- `http://localhost:3001`
- `ws://localhost:3002`

### 2. Load the extension

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on Developer Mode.
3. Click Load unpacked.
4. Select the `grades-extension` folder.

### 3. Add the wallpaper to Lively

1. Install Lively Wallpaper.
2. Add `sites/wallpaper/wallpaper.html` as a wallpaper.
3. If automatic import worked, just make sure it is active.

### 4. Sign in

The extension handles authentication. If grades are empty, sign in to Infinite Campus in the same browser and refresh.

## Included Helpers

- `setup.bat` and `setup.ps1`: guided installer.
- `setup-guide.html`: visual step-by-step guide.
- `install-autostart.bat`: add hidden server launch to Windows startup.
- `uninstall-autostart.bat`: remove startup entry.
- `start-server-hidden.vbs`: launch backend without a console window.
- `stop-server.bat`: stop the backend.

## Notes

- The browser extension still must be loaded manually because Chromium blocks silent unpacked extension installs.
- Lively can usually be automated through `lively.exe setwp --file <path>` and the installer attempts that.
- If automation fails, open `setup-guide.html` and follow the images.
