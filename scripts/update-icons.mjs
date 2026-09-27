import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const rootDir = path.resolve('.');
// Keep a transparent source outside ui/public. Public WebP files are icon
// outputs and therefore have an opaque background after generation.
const markSource = path.join(rootDir, 'scripts', 'assets', 'bragi-mark-source.webp');
const ffmpeg = path.join(
  rootDir,
  'tmp',
  'ffmpeg',
  'ffmpeg-9.0.1-essentials_build',
  'bin',
  'ffmpeg.exe',
);
const blue = '0x3B82F6';

if (!fs.existsSync(markSource)) throw new Error(`Transparent logo source not found: ${markSource}`);
if (!fs.existsSync(ffmpeg)) throw new Error(`FFmpeg not found: ${ffmpeg}`);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bragi-icon-generation-'));
const masterPng = path.join(workDir, 'app-icon.png');

function runFfmpeg(args) {
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit',
    windowsHide: true,
  });
}

function renderPng(relativeOutput, width, height = width) {
  const output = path.join(rootDir, relativeOutput);
  const side = Math.min(width, height);
  const filter =
    width === height
      ? `scale=${width}:${height}:flags=lanczos`
      : `scale=${side}:${side}:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${blue}`;

  runFfmpeg([
    '-i',
    masterPng,
    '-vf',
    filter,
    '-frames:v',
    '1',
    output,
  ]);
}

try {
  const recolorAndCenterMark =
    `[0:v]format=rgba,` +
    'colorchannelmixer=rr=0:rg=0:rb=0:ra=1:gr=0:gg=0:gb=0:ga=1:br=0:bg=0:bb=0:ba=1,' +
    'scale=400:400:flags=lanczos[mark];' +
    `color=c=${blue}:s=512x512:r=25:d=1[background];` +
    '[background][mark]overlay=(W-w)/2:(H-h)/2:shortest=1,format=rgba,' +
    "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip(255*(112.5-sqrt(pow(max(abs(X-255.5)-144,0),2)+pow(max(abs(Y-255.5)-144,0),2))),0,255)'[icon]";
  runFfmpeg([
    '-i',
    markSource,
    '-filter_complex',
    recolorAndCenterMark,
    '-map',
    '[icon]',
    '-frames:v',
    '1',
    masterPng,
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
    renderPng(path.join('android', 'app', 'src', 'main', 'res', density, 'ic_launcher.png'), size);
    renderPng(
      path.join('android', 'app', 'src', 'main', 'res', density, 'ic_launcher_round.png'),
      size,
    );
  }

  renderPng(path.join('android', 'store_icon.png'), 512);
  renderPng(path.join('ui', 'public', 'android-chrome-192x192.png'), 192);
  renderPng(path.join('ui', 'public', 'android-chrome-512x512.png'), 512);
  renderPng(path.join('ui', 'public', 'apple-touch-icon.png'), 180);
  for (const size of [60, 76, 120, 152, 180]) {
    renderPng(path.join('ui', 'public', `apple-touch-icon-${size}x${size}.png`), size);
  }
  renderPng(path.join('ui', 'public', 'favicon-16x16.png'), 16);
  renderPng(path.join('ui', 'public', 'favicon-32x32.png'), 32);
  for (const size of [70, 144, 150, 310]) {
    renderPng(path.join('ui', 'public', `mstile-${size}x${size}.png`), size);
  }
  renderPng(path.join('ui', 'public', 'mstile-310x150.png'), 310, 150);

  runFfmpeg([
    '-i',
    masterPng,
    '-vf',
    'format=rgba,scale=256:256:flags=lanczos',
    '-frames:v',
    '1',
    '-c:v',
    'png',
    '-f',
    'ico',
    path.join(rootDir, 'ui', 'public', 'favicon.ico'),
  ]);

  for (const filename of ['bragi.webp', 'bragi_new.webp']) {
    runFfmpeg([
      '-i',
      masterPng,
      '-frames:v',
      '1',
      '-c:v',
      'libwebp',
      '-quality',
      '95',
      path.join(rootDir, 'ui', 'public', filename),
    ]);
  }

  console.log('Generated browser, PWA, Windows, Apple, Android, and store icons.');
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}
