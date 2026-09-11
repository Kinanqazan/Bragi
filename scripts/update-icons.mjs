import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const rootDir = path.resolve('.');
const ffmpeg = path.join(rootDir, 'tmp', 'ffmpeg', 'ffmpeg-9.0.1-essentials_build', 'bin', 'ffmpeg.exe');
const source = path.join(rootDir, 'ui', 'public', 'bragi.webp');

const densities = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

console.log('Generating Android mipmap icons from vibrant blue bragi.webp...');

for (const [dir, size] of Object.entries(densities)) {
  const dirPath = path.join(rootDir, 'android', 'app', 'src', 'main', 'res', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const out = path.join(dirPath, 'ic_launcher.png');
  const roundOut = path.join(dirPath, 'ic_launcher_round.png');
  execSync(`"${ffmpeg}" -y -i "${source}" -vf scale=${size}:${size} "${out}"`, { stdio: 'inherit' });
  execSync(`"${ffmpeg}" -y -i "${source}" -vf scale=${size}:${size} "${roundOut}"`, { stdio: 'inherit' });
  console.log(`Generated ${dir} (${size}x${size})`);
}

// Also update web icons
console.log('Updating web icons...');
execSync(`"${ffmpeg}" -y -i "${source}" -vf scale=192:192 "${path.join(rootDir, 'ui', 'public', 'android-chrome-192x192.png')}"`, { stdio: 'inherit' });
execSync(`"${ffmpeg}" -y -i "${source}" -vf scale=512:512 "${path.join(rootDir, 'ui', 'public', 'android-chrome-512x512.png')}"`, { stdio: 'inherit' });
execSync(`"${ffmpeg}" -y -i "${source}" -vf scale=180:180 "${path.join(rootDir, 'ui', 'public', 'apple-touch-icon.png')}"`, { stdio: 'inherit' });

console.log('\nSUCCESS! All Android and web icons updated to vibrant electric blue!');
