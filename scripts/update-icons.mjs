import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const rootDir = path.resolve('.');
const iconSource = path.join(rootDir, 'ui', 'public', 'new icon.webp');
const dynamicLogoMask = path.join(rootDir, 'ui', 'public', 'bragi-logo-mask.png');
const ffmpeg = path.join(
  rootDir,
  'tmp',
  'ffmpeg',
  'ffmpeg-9.0.1-essentials_build',
  'bin',
  'ffmpeg.exe',
);
const brandBackground = '#5B805F';
const faviconColor = '#66B76D';
const androidLauncherOnly = process.argv.includes('--android-launcher-only');

if (!fs.existsSync(iconSource)) throw new Error(`New app icon not found: ${iconSource}`);
if (!fs.existsSync(ffmpeg)) throw new Error(`FFmpeg not found: ${ffmpeg}`);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bragi-icon-generation-'));
const masterPng = path.join(workDir, 'app-icon.png');
const androidLauncherMasterPng = path.join(workDir, 'android-launcher-icon.png');
const faviconMasterPng = path.join(workDir, 'browser-tab-icon.png');
const faviconIcoTemp = path.join(workDir, 'favicon.ico');

function runFfmpeg(args) {
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit',
    windowsHide: true,
  });
}

function renderPng(relativeOutput, width, height = width, source = masterPng) {
  const output = path.join(rootDir, relativeOutput);
  const side = Math.min(width, height);
  const filter =
    width === height
      ? `scale=${width}:${height}:flags=lanczos`
      : `scale=${side}:${side}:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${brandBackground}`;

  runFfmpeg([
    '-i',
    source,
    '-vf',
    filter,
    '-frames:v',
    '1',
    output,
  ]);
}

try {
  const roundedIconFilter =
    'scale=512:512:flags=lanczos,format=rgba,geq=' +
    "r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':" +
    "a='clip(255*(112.5-sqrt(pow(max(abs(X-255.5)-144,0),2)+pow(max(abs(Y-255.5)-144,0),2))),0,255)'";
  runFfmpeg([
    '-i',
    iconSource,
    '-vf',
    roundedIconFilter,
    '-frames:v',
    '1',
    masterPng,
  ]);

  const themeableMaskFilter =
    "format=gray,lut=y='clip((val-130)*3.2,0,255)',format=rgba," +
    "geq=r='255':g='255':b='255':a='r(X,Y)'";
  runFfmpeg([
    '-i',
    iconSource,
    '-vf',
    themeableMaskFilter,
    '-frames:v',
    '1',
    dynamicLogoMask,
  ]);

  const androidLauncherFilter =
    '[0:v]format=rgba[background];' +
    '[1:v]scale=390:390:flags=lanczos,format=rgba[foreground];' +
    '[background][foreground]overlay=(W-w)/2:(H-h)/2:shortest=1,format=rgba,geq=' +
    "r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':" +
    "a='clip(255*(112.5-sqrt(pow(max(abs(X-255.5)-144,0),2)+pow(max(abs(Y-255.5)-144,0),2))),0,255)'[icon]";
  runFfmpeg([
    '-f',
    'lavfi',
    '-i',
    `color=c=${brandBackground}:s=512x512:r=1:d=1`,
    '-i',
    dynamicLogoMask,
    '-filter_complex',
    androidLauncherFilter,
    '-map',
    '[icon]',
    '-frames:v',
    '1',
    androidLauncherMasterPng,
  ]);

  const faviconFilter =
    '[0:v]alphaextract,scale=512:512:flags=lanczos[alpha];' +
    `color=c=${faviconColor}:s=512x512:r=1:d=1,format=rgba[foreground];` +
    '[foreground][alpha]alphamerge[icon]';
  runFfmpeg([
    '-i',
    dynamicLogoMask,
    '-filter_complex',
    faviconFilter,
    '-map',
    '[icon]',
    '-frames:v',
    '1',
    faviconMasterPng,
  ]);

  for (const [density, size] of Object.entries({
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
  })) {
    const dir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res', density);
    fs.mkdirSync(dir, { recursive: true });
    renderPng(
      path.join('android', 'app', 'src', 'main', 'res', density, 'ic_launcher.png'),
      size,
      size,
      androidLauncherMasterPng,
    );
    renderPng(
      path.join('android', 'app', 'src', 'main', 'res', density, 'ic_launcher_round.png'),
      size,
      size,
      androidLauncherMasterPng,
    );
  }

  if (!androidLauncherOnly) {
  renderPng(path.join('android', 'store_icon.png'), 512);
  renderPng(path.join('ui', 'public', 'android-chrome-192x192.png'), 192);
  renderPng(path.join('ui', 'public', 'android-chrome-512x512.png'), 512);
  renderPng(path.join('ui', 'public', 'apple-touch-icon.png'), 180);
  for (const size of [60, 76, 120, 152, 180]) {
    renderPng(path.join('ui', 'public', `apple-touch-icon-${size}x${size}.png`), size);
  }
  renderPng(path.join('ui', 'public', 'favicon-16x16.png'), 16, 16, faviconMasterPng);
  renderPng(path.join('ui', 'public', 'favicon-32x32.png'), 32, 32, faviconMasterPng);
  for (const size of [70, 144, 150, 310]) {
    renderPng(path.join('ui', 'public', `mstile-${size}x${size}.png`), size);
  }
  renderPng(path.join('ui', 'public', 'mstile-310x150.png'), 310, 150);

  runFfmpeg([
    '-i',
    faviconMasterPng,
    '-vf',
    'format=rgba,scale=256:256:flags=lanczos',
    '-frames:v',
    '1',
    '-c:v',
    'png',
    '-f',
    'ico',
    faviconIcoTemp,
  ]);
  fs.copyFileSync(faviconIcoTemp, path.join(rootDir, 'ui', 'public', 'favicon.ico'));

  // These standalone logo files are used by external dashboards and service
  // catalogs, where the green mark needs to sit directly on the page. Keep
  // the green-background app icon in the Android/PWA assets above.
  for (const filename of ['bragi.webp', 'bragi_new.webp']) {
    runFfmpeg([
      '-i',
      faviconMasterPng,
      '-frames:v',
      '1',
      '-c:v',
      'libwebp',
      '-quality',
      '95',
      path.join(rootDir, 'ui', 'public', filename),
    ]);
  }

  const faviconData = fs.readFileSync(faviconMasterPng).toString('base64');
  fs.writeFileSync(
    path.join(rootDir, 'ui', 'public', 'favicon.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
      '<image href="data:image/png;base64,' + faviconData + '" width="512" height="512" /></svg>\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'ui', 'public', 'safari-pinned-tab.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">' +
      '<image href="/bragi-logo-mask.png" width="1024" height="1024" /></svg>\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(rootDir, 'ui', 'public', 'browserconfig.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n' +
      '<browserconfig><msapplication><tile>' +
      '<square150x150logo src="/mstile-150x150.png"/>' +
      '<TileColor>' + brandBackground + '</TileColor>' +
      '</tile></msapplication></browserconfig>\n',
    'utf8',
  );

  }

  console.log(
    androidLauncherOnly
      ? `Generated Android launcher icons from ${iconSource}.`
      : `Generated browser, PWA, Windows, Apple, Android, and store icons from ${iconSource}.`,
  );
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
