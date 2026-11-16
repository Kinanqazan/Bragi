[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$DeviceTests,
    [switch]$Install,
    [switch]$Optimized,
    [string]$Device = '',
    [string]$JdkPath = '',
    [string]$SdkPath = ''
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$nativeRoot = Join-Path $projectRoot 'android-native'
$configPath = Join-Path $env:USERPROFILE '.bubblewrap/config.json'
$toolConfig = if (Test-Path -LiteralPath $configPath) {
    Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
} else { $null }

if (-not $JdkPath) {
    $portableJdk = Get-ChildItem -Path (Join-Path $projectRoot 'tmp/codex-temurin17-x64/*') -Directory -ErrorAction SilentlyContinue |
        Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'bin/javac.exe') } |
        Select-Object -First 1
    $JdkPath = if ($portableJdk) { $portableJdk.FullName } elseif ($env:JAVA_HOME) { $env:JAVA_HOME } else { $toolConfig.jdkPath }
}
if (-not $SdkPath) {
    $SdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { $toolConfig.androidSdkPath }
}
if (-not $JdkPath -or -not (Test-Path -LiteralPath (Join-Path $JdkPath 'bin/javac.exe'))) {
    throw 'A JDK is required. Set JAVA_HOME or pass -JdkPath.'
}
if (-not $SdkPath -or -not (Test-Path -LiteralPath (Join-Path $SdkPath 'platforms/android-36/android.jar'))) {
    throw 'Android SDK platform 36 is required. Set ANDROID_HOME or pass -SdkPath.'
}

$savedEnv = @{}
foreach ($name in @('JAVA_HOME', 'ANDROID_HOME', 'GRADLE_USER_HOME')) {
    $savedEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    $env:JAVA_HOME = $JdkPath
    $env:ANDROID_HOME = $SdkPath
    $env:GRADLE_USER_HOME = Join-Path $projectRoot 'tmp/gradle-user-home'
    # This ignored file contains only a machine-local SDK path.
    $sdkProperty = $SdkPath.Replace('\', '/').Replace(':', '\:')
    Set-Content -LiteralPath (Join-Path $nativeRoot 'local.properties') -Value "sdk.dir=$sdkProperty" -Encoding ASCII
    # Keep -Optimized as a compatible alias; the normal APK is always optimized.
    $assembleTask = 'assembleOptimized'
    $tasks = @(if ($Check) { 'testDebugUnitTest'; 'lintDebug'; $assembleTask } else { $assembleTask })
    if ($DeviceTests) { $tasks += 'connectedDebugAndroidTest' }
    Push-Location $nativeRoot
    try {
        & .\gradlew.bat --no-daemon --console=plain @tasks
        if ($LASTEXITCODE -ne 0) { throw "Native Android build failed (exit $LASTEXITCODE)." }
    } finally { Pop-Location }

    $variant = 'optimized'
    $apkPath = Join-Path $nativeRoot 'bragi.apk'
    Copy-Item -LiteralPath (Join-Path $nativeRoot "app/build/outputs/apk/$variant/app-$variant.apk") -Destination $apkPath
    Write-Host "Bragi APK: $apkPath" -ForegroundColor Green

    if ($Install) {
        $adb = Join-Path $SdkPath 'platform-tools/adb.exe'
        $targets = if ($Device) { @('-s', $Device) } else { @() }
        & $adb @targets install -r $apkPath
        if ($LASTEXITCODE -ne 0) { throw 'ADB installation failed. Check the wireless/USB connection and -Device selection.' }
        & $adb @targets shell am start -n 'org.bragi.nativeapp/.MainActivity'
        if ($LASTEXITCODE -ne 0) { throw 'The APK installed, but ADB could not launch it.' }
    }
} finally {
    foreach ($name in $savedEnv.Keys) {
        [Environment]::SetEnvironmentVariable($name, $savedEnv[$name], 'Process')
    }
}
