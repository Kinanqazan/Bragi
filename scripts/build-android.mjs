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

// 4. Build Android Release APK
console.log('\n=== Step 3: Compiling Native Android APK with Gradle ===');
execSync('cmd /c gradlew.bat assembleRelease', {
  cwd: androidDir,
  env,
  stdio: 'inherit'
});

const builtApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const targetApk = path.join(androidDir, 'bragi.apk');

if (fs.existsSync(builtApk)) {
  fs.copyFileSync(builtApk, targetApk);
  console.log('\n=============================================');
  console.log('SUCCESS! Native Android APK created:');
  console.log(targetApk);
  console.log('=============================================');
}
