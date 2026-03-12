$ErrorActionPreference = 'Stop'

$script:ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:DistRoot = Join-Path $script:ProjectRoot 'dist'
$script:WallpaperFile = Join-Path $script:ProjectRoot 'sites\wallpaper\wallpaper.html'
$script:GuideFile = Join-Path $script:ProjectRoot 'setup-guide.html'
$script:ExtensionFolder = Join-Path $script:ProjectRoot 'grades-extension'
$script:StartupFolder = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$script:StartupShortcut = Join-Path $script:StartupFolder 'GradesServer.lnk'

function Write-Section($text) {
    Write-Host ''
    Write-Host "=== $text ===" -ForegroundColor Cyan
}

function Ask-YesNo($prompt, $default = $true) {
    $suffix = if ($default) { '[Y/n]' } else { '[y/N]' }
    while ($true) {
        $answer = Read-Host "$prompt $suffix"
        if ([string]::IsNullOrWhiteSpace($answer)) {
            return $default
        }

        switch ($answer.Trim().ToLowerInvariant()) {
            'y' { return $true }
            'yes' { return $true }
            'n' { return $false }
            'no' { return $false }
        }
    }
}

function Test-CommandExists($name) {
    return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Add-NodeToPathIfNeeded {
    $nodeDir = 'C:\Program Files\nodejs'
    if ((Test-Path (Join-Path $nodeDir 'node.exe')) -and -not (($env:Path -split ';') -contains $nodeDir)) {
        $env:Path += ';' + $nodeDir
    }
}

function Install-WingetPackage($id, $label) {
    Write-Host "Installing $label..."
    & winget install --id $id --exact --accept-package-agreements --accept-source-agreements | Out-Host
}

function Ensure-Node {
    if (Test-CommandExists 'node') {
        Write-Host "Node.js detected: $(node --version)"
        return $true
    }

    if (-not (Ask-YesNo 'Node.js is not installed. Install Node.js LTS now?' $true)) {
        Write-Warning 'Node.js is required to run the local server.'
        return $false
    }

    Install-WingetPackage 'OpenJS.NodeJS.LTS' 'Node.js LTS'
    Add-NodeToPathIfNeeded

    if (Test-CommandExists 'node') {
        Write-Host "Node.js installed: $(node --version)"
        return $true
    }

    Write-Warning 'Node.js was installed, but this shell could not see it yet. Re-run setup if server start fails.'
    return (Test-Path 'C:\Program Files\nodejs\node.exe')
}

function Find-LivelyExecutable {
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Lively Wallpaper\Lively.exe'),
        (Join-Path $env:LOCALAPPDATA 'Lively Wallpaper\Lively.exe'),
        (Join-Path $env:ProgramFiles 'Lively Wallpaper\Lively.exe'),
        (Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\lively.exe')
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    $commandMatches = @(Get-Command 'lively.exe' -ErrorAction SilentlyContinue)
    foreach ($match in $commandMatches) {
        $source = $match.Source
        if ($source -is [array]) {
            foreach ($nestedSource in $source) {
                if ($nestedSource -and (Test-Path $nestedSource)) {
                    return $nestedSource
                }
            }
        }

        if ($source -and (Test-Path $source)) {
            return $source
        }
    }

    return $null
}

function Ensure-Lively {
    $livelyExe = Find-LivelyExecutable
    if ($livelyExe) {
        Write-Host "Lively detected: $livelyExe"
        return $livelyExe
    }

    if (-not (Ask-YesNo 'Lively Wallpaper is not installed. Install it now with winget?' $true)) {
        return $null
    }

    Install-WingetPackage 'rocksdanister.LivelyWallpaper' 'Lively Wallpaper'
    Start-Sleep -Seconds 2
    return (Find-LivelyExecutable)
}

function Sync-Dist {
    Write-Section 'Preparing dist folder'
    if (-not (Test-Path $script:DistRoot)) {
        New-Item -ItemType Directory -Path $script:DistRoot | Out-Null
    }

    Copy-Item -Path (Join-Path $script:ProjectRoot 'grades-extension\*') -Destination $script:DistRoot -Recurse -Force

    $distSites = Join-Path $script:DistRoot 'sites'
    if (-not (Test-Path $distSites)) {
        New-Item -ItemType Directory -Path $distSites | Out-Null
    }

    Copy-Item -Path (Join-Path $script:ProjectRoot 'sites\*') -Destination $distSites -Recurse -Force
    Write-Host 'dist folder is up to date.'
}

function Ensure-NpmInstall {
    if (-not (Test-CommandExists 'npm')) {
        Add-NodeToPathIfNeeded
    }

    if (-not (Test-CommandExists 'npm')) {
        Write-Warning 'npm is not available in this shell. Skipping npm install.'
        return
    }

    Write-Section 'Checking npm packages'
    Push-Location $script:ProjectRoot
    try {
        & npm install | Out-Host
    } finally {
        Pop-Location
    }
}

function Find-BrowserExecutable {
    $browserCandidates = @(
        @{ Path = (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'); Url = 'chrome://extensions/' },
        @{ Path = (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'); Url = 'chrome://extensions/' },
        @{ Path = (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'); Url = 'edge://extensions/' },
        @{ Path = (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'); Url = 'edge://extensions/' }
    )

    foreach ($browser in $browserCandidates) {
        if ($browser.Path -and (Test-Path $browser.Path)) {
            return $browser
        }
    }

    return $null
}

function Install-AutostartShortcut {
    $ws = New-Object -ComObject WScript.Shell
    $shortcut = $ws.CreateShortcut($script:StartupShortcut)
    $shortcut.TargetPath = 'wscript.exe'
    $shortcut.Arguments = '"' + (Join-Path $script:ProjectRoot 'start-server-hidden.vbs') + '"'
    $shortcut.WorkingDirectory = $script:ProjectRoot
    $shortcut.Description = 'Grades Server Auto-Start'
    $shortcut.Save()
}

function Remove-AutostartShortcut {
    if (Test-Path $script:StartupShortcut) {
        Remove-Item $script:StartupShortcut -Force
    }
}

function Start-ServerHidden {
    Write-Section 'Starting local server'
    Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + (Join-Path $script:ProjectRoot 'start-server-hidden.vbs') + '"') -WorkingDirectory $script:ProjectRoot | Out-Null
    Start-Sleep -Seconds 2
}

function Try-ApplyLivelyWallpaper($livelyExe) {
    if (-not $livelyExe) {
        Write-Warning 'Lively was not found. Skipping automatic wallpaper import.'
        return $false
    }

    if (-not (Test-Path $script:WallpaperFile)) {
        Write-Warning 'Wallpaper file was not found.'
        return $false
    }

    Write-Section 'Trying to import wallpaper into Lively'
    try {
        Start-Process -FilePath $livelyExe -ArgumentList @('--showApp', 'false') -WindowStyle Hidden | Out-Null
        Start-Sleep -Seconds 2
        Start-Process -FilePath $livelyExe -ArgumentList @('setwp', '--file', $script:WallpaperFile) -WindowStyle Hidden | Out-Null
        Write-Host 'Sent wallpaper import/set command to Lively.'
        return $true
    } catch {
        Write-Warning "Automatic Lively import failed: $($_.Exception.Message)"
        return $false
    }
}

function Open-SetupGuide {
    if (Test-Path $script:GuideFile) {
        Start-Process $script:GuideFile | Out-Null
    }
}

function Open-ExtensionFolder {
    if (Test-Path $script:ExtensionFolder) {
        Start-Process explorer.exe $script:ExtensionFolder | Out-Null
    }
}

function Open-BrowserHelp {
    $browser = Find-BrowserExecutable
    if ($browser) {
        Start-Process -FilePath $browser.Path -ArgumentList $browser.Url | Out-Null
        return
    }

    Write-Warning 'Could not find Chrome or Edge automatically. Open your browser and go to its extensions page manually.'
}

Clear-Host
Write-Host 'GradesWPInfCampus Setup Wizard' -ForegroundColor Green
Write-Host 'This installer prepares the local server, Lively Wallpaper, and the extension files.'

$hasNode = Ensure-Node
if (-not $hasNode) {
    Write-Warning 'Setup cannot continue without Node.js.'
    exit 1
}

Add-NodeToPathIfNeeded
Ensure-NpmInstall
Sync-Dist

$livelyExe = Ensure-Lively

if (Ask-YesNo 'Install server auto-start on Windows login?' $true) {
    Install-AutostartShortcut
    Write-Host 'Auto-start enabled.'
} elseif (Ask-YesNo 'Remove existing server auto-start if present?' $false) {
    Remove-AutostartShortcut
    Write-Host 'Auto-start removed.'
}

if (Ask-YesNo 'Start the local grades server now?' $true) {
    Start-ServerHidden
}

$appliedWallpaper = $false
if (Ask-YesNo 'Try to add and set the wallpaper in Lively automatically?' $true) {
    $appliedWallpaper = Try-ApplyLivelyWallpaper $livelyExe
}

if (Ask-YesNo 'Open the visual setup guide now?' $true) {
    Open-SetupGuide
}

if (Ask-YesNo 'Open the extension folder for Load unpacked?' $true) {
    Open-ExtensionFolder
}

if (Ask-YesNo 'Open the browser extensions page now?' $true) {
    Open-BrowserHelp
}

Write-Section 'Setup complete'
Write-Host 'Manual step still required: load the unpacked browser extension from the grades-extension folder.'
if ($appliedWallpaper) {
    Write-Host 'Lively wallpaper command was sent successfully.'
} else {
    Write-Host 'If Lively did not set the wallpaper, use setup-guide.html for the manual steps.'
}
Write-Host 'You can re-run setup anytime with setup.bat.'
Read-Host 'Press Enter to close'