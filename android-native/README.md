# Bragi for Android

Bragi is a native Kotlin, Jetpack Compose and Media3 music player for Android 8.0 and later. It works offline as a standalone player, reading and playing music stored on the phone without a server or internet connection. It can also connect to a Bragi server. Server playback supports Google Cast when the receiver can reach the server.

## Build and install

From the repository root on Windows:

```powershell
.\scripts\build-android-native.ps1
.\scripts\build-android-native.ps1 -Check
.\scripts\build-android-native.ps1 -Install
```

The output is `android-native/bragi.apk`. Each build replaces that file. `-Check` runs JVM tests and Android lint as well as building the APK; `-DeviceTests` adds device integration tests. Use `-Device <adb-serial>` when installing to a specific device. Device tests replace the app's saved queue.

The build needs JDK 17+, Android SDK platform 36 and Android build tools. The script can use `JAVA_HOME` and `ANDROID_HOME` or the `-JdkPath` and `-SdkPath` arguments. Gradle downloads the pinned dependencies.

The optimized APK currently uses the local Android debug signing key. Keep the same key for future builds if you want them to update an installed copy; an APK signed with another key cannot update it. Configure a private, stable release signing key before treating this as a production distribution. Do not commit a signing key or password.

## Releases

The release workflow publishes the checked-in `android-native/bragi.apk` when that file changes on `master`. Build the APK and include it in the commit with the corresponding source changes. The workflow creates the next `android-v1.N` release. It does not build or sign the APK itself.

The app ID remains `org.bragi.nativeapp` so existing native installations retain their data. It is separate from the former Android wrapper, so users of that app need to install and set up the native app separately.

## Development

`app/src/main/java/org/bragi/nativeapp/library` handles local and server libraries; `playback` owns the Media3 service and Cast integration; `ui` contains the Compose screens. Tests are in `app/src/test` and `app/src/androidTest`.

The test server can be started with `scripts/dev.ps1`. Server statistics require the corresponding server update and enabled listening history. Phone-stored tracks cannot currently be sent to Cast receivers.
