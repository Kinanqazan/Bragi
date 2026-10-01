@echo off
setlocal
cd /d "%~dp0.."
title Bargi Android APK Builder

echo Bargi Android APK Builder
echo.
echo This creates an APK file on this computer. It does not install it on your phone.
echo.
echo   1. Production APK (recommended)
echo   2. Debug APK (for live development)
echo.
set /p "BUILD_CHOICE=Choose 1 or 2, then press Enter [1]: "

if "%BUILD_CHOICE%"=="" set "BUILD_CHOICE=1"
if "%BUILD_CHOICE%"=="1" goto production
if "%BUILD_CHOICE%"=="2" goto debug

echo.
echo Please enter 1 or 2.
pause
exit /b 1

:production
set "BUILD_ARGS="
set "APK_NAME=bragi.apk"
goto build

:debug
set "BUILD_ARGS=--debug"
set "APK_NAME=bragi-dev.apk"

:build
echo.
echo Building %APK_NAME%... This can take a few minutes.
echo.
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found. Install Node.js, then run this file again.
    pause
    exit /b 1
)

node scripts\build-android.mjs %BUILD_ARGS%
set "BUILD_EXIT=%ERRORLEVEL%"
echo.
if not "%BUILD_EXIT%"=="0" (
    echo Build failed. The error above should show what needs attention.
    pause
    exit /b %BUILD_EXIT%
)

echo Finished. Your APK is at:
echo %CD%\android\%APK_NAME%
echo.
pause
exit /b 0
