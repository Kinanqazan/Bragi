# Usage: .\scripts\deploy-apk.ps1 [-Build] [-Debug]
param(
    [switch]$Build,
    [switch]$Debug
)

$ErrorActionPreference = "Stop"

if ($Build) {
    $modeText = if ($Debug) { "Debug" } else { "Production" }
    Write-Host "Building $modeText Android APK..." -ForegroundColor Cyan
    if ($Debug) {
        node scripts/build-android.mjs --debug
    } else {
        node scripts/build-android.mjs
    }
}

$apkPath = Join-Path $PSScriptRoot "..\android\bragi.apk"
if (-not (Test-Path $apkPath)) {
    Write-Error "APK not found at $apkPath. Please run with -Build flag."
}

# Look for adb in common SDK locations or bubblewrap
$adb = "adb"
$bubblewrapAdb = "$HOME\.bubblewrap\android_sdk\platform-tools\adb.exe"
if (Test-Path $bubblewrapAdb) {
    $adb = $bubblewrapAdb
}

Write-Host "Checking for connected Android devices..." -ForegroundColor Cyan
$deviceLines = & $adb devices | Where-Object { $_ -match "\bdevice\b" -and $_ -notmatch "List of devices" }
if (-not $deviceLines) {
    Write-Warning "No connected Android devices found via ADB."
    Write-Host "`nTo connect your phone for 1-click deployment:"
    Write-Host "1. Enable 'Developer Options' and 'USB Debugging' on your phone."
    Write-Host "2. Connect phone via USB (or use 'Wireless Debugging' on Android 11+)."
    Write-Host "3. Run: $adb connect <phone-ip>:<port> if using wireless."
    exit 1
}

$firstDevice = ($deviceLines[0].Trim() -split "\s+")[0]
Write-Host "Targeting device: $firstDevice" -ForegroundColor Cyan

Write-Host "Installing APK to connected device..." -ForegroundColor Green
& $adb -s $firstDevice install -r $apkPath

Write-Host "Launching Bragi on device..." -ForegroundColor Green
& $adb -s $firstDevice shell am start -n "org.bragi.app/.MainActivity"

Write-Host "`nDeployment complete! Bragi is running on your phone." -ForegroundColor Green
