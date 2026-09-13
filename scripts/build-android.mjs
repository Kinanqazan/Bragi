import { execSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

const configPath = path.join(os.homedir(), '.bubblewrap', 'config.json');
let jdkPath = 'C:\\Users\\kinan\\.bubblewrap\\jdk\\jdk-17.0.11+9';
let androidSdkPath = 'C:\\Users\\kinan\\.bubblewrap\\android_sdk';

if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.jdkPath) jdkPath = config.jdkPath;
    if (config.androidSdkPath) androidSdkPath = config.androidSdkPath;
  } catch (ignored) {}
}

const env = {
  ...process.env,
  JAVA_HOME: jdkPath,
  ANDROID_HOME: androidSdkPath,
  PATH: `${path.join(jdkPath, 'bin')}${path.delimiter}${path.join(androidSdkPath, 'build-tools', '36.1.0')}${path.delimiter}${process.env.PATH}`,
};

const rootDir = path.resolve('.');
const uiDir = path.join(rootDir, 'ui');
const androidDir = path.join(rootDir, 'android');
const assetsDir = path.join(androidDir, 'app', 'src', 'main', 'assets');

// 1. Build web UI for standalone offline embedding
console.log('=== Step 1: Building Standalone Web UI Bundle ===');
execSync('npm run build:standalone', {
  cwd: uiDir,
  env: process.env,
  stdio: 'inherit'
});

// 2. Sync built files to Android assets
console.log('\n=== Step 2: Packaging Web Assets into Android App ===');
const uiBuildDir = path.join(uiDir, 'build');
if (fs.existsSync(assetsDir)) {
  fs.rmSync(assetsDir, { recursive: true, force: true });
}
fs.mkdirSync(assetsDir, { recursive: true });
fs.cpSync(uiBuildDir, assetsDir, { recursive: true });
console.log(`Copied ${fs.readdirSync(assetsDir).length} top-level asset entries into ${assetsDir}`);

// 3. Ensure local.properties
fs.writeFileSync(
  path.join(androidDir, 'local.properties'),
  `sdk.dir=${androidSdkPath.replace(/\\/g, '\\\\')}\n`
);

// 4. Build Android APK (Release by default, or Debug if --debug passed)
const isDebug = process.argv.includes('--debug');
const gradleTask = isDebug ? 'assembleDebug' : 'assembleRelease';
const apkFolder = isDebug ? 'debug' : 'release';
const apkFileName = isDebug ? 'app-debug.apk' : 'app-release.apk';

console.log(`\n=== Step 3: Compiling Native Android APK (${isDebug ? 'DEBUG' : 'PRODUCTION RELEASE'}) with Gradle ===`);
execSync(`cmd /c gradlew.bat ${gradleTask}`, {
  cwd: androidDir,
  env,
  stdio: 'inherit'
});

const builtApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', apkFolder, apkFileName);
const distinctApkName = isDebug ? 'bragi-dev.apk' : 'bragi.apk';
const targetApk = path.join(androidDir, distinctApkName);

if (fs.existsSync(builtApk)) {
  fs.copyFileSync(builtApk, targetApk);
  if (isDebug) {
    // Also copy to bragi.apk so deploy script finds it if needed
    fs.copyFileSync(builtApk, path.join(androidDir, 'bragi.apk'));
  }
  console.log('\n=============================================');
  console.log(`SUCCESS! ${isDebug ? 'Debug (Bragi Dev)' : 'Production (Bragi)'} Android APK created:`);
  console.log(targetApk);
  console.log('=============================================');
}
