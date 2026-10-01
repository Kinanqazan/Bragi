import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = path.resolve('.');
const htmlPath = path.join(rootDir, 'ui', 'index.html');
const ffmpeg = path.join(
  rootDir,
  'tmp',
  'ffmpeg',
  'ffmpeg-9.0.1-essentials_build',
  'bin',
  'ffmpeg.exe',
);

const html = fs.readFileSync(htmlPath, 'utf8');
const firstIconLink = [...html.matchAll(/<link\b[^>]*\brel="icon"[^>]*>/gi)][0]?.[0];
const type = firstIconLink?.match(/\btype="([^"]+)"/i)?.[1];
const href = firstIconLink?.match(/\bhref="([^"]+)"/i)?.[1];

if (type !== 'image/png' || !href?.includes('favicon-32x32.png')) {
  throw new Error(`Browser tab does not select the transparent PNG favicon first: ${firstIconLink}`);
}

const faviconPath = path.join(
  rootDir,
  'ui',
  'public',
  decodeURIComponent(href.split('?')[0].replace(/^\//, '')),
);
if (!fs.existsSync(faviconPath)) throw new Error(`Favicon file is missing: ${faviconPath}`);
if (!fs.existsSync(ffmpeg)) throw new Error(`FFmpeg not found: ${ffmpeg}`);

function rgbaAt(x, y) {
  return [...execFileSync(
    ffmpeg,
    [
      '-v',
      'error',
      '-i',
      faviconPath,
      '-vf',
      `crop=2:2:${x}:${y}`,
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      'pipe:1',
    ],
    { windowsHide: true },
  )];
}

if (rgbaAt(16, 0)[3] > 16) {
  throw new Error('Favicon top-center pixel is opaque; the browser-tab logo still has a background.');
}
const logoPixel = rgbaAt(16, 8);
if (logoPixel[3] === 0) {
  throw new Error('Favicon foreground is transparent; the browser-tab logo is missing.');
}
if (logoPixel[1] < 150) {
  throw new Error(`Favicon green is too dim (${logoPixel[0]}, ${logoPixel[1]}, ${logoPixel[2]}).`);
}

console.log('Browser favicon selects a brighter-green owl PNG with a transparent background.');
