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

const androidDir = path.resolve('android');

// Ensure local.properties
fs.writeFileSync(
  path.join(androidDir, 'local.properties'),
  `sdk.dir=${androidSdkPath.replace(/\\/g, '\\\\')}\n`
);

console.log('Building Bragi native Android APK...');
execSync('cmd /c gradlew.bat assembleRelease', {
  cwd: androidDir,
  env,
  stdio: 'inherit'
});

const builtApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const targetApk = path.join(androidDir, 'app-release-signed.apk');

if (fs.existsSync(builtApk)) {
  fs.copyFileSync(builtApk, targetApk);
  console.log('\nSUCCESS! Native Android APK created:');
  console.log(targetApk);
}
