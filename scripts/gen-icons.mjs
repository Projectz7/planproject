import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const svgPath = resolve(root, 'public/favicon.svg');
const svg = readFileSync(svgPath);

for (const size of [192, 512]) {
  const out = resolve(root, `public/icons/icon-${size}x${size}.png`);
  mkdirSync(resolve(root, 'public/icons'), { recursive: true });
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`Gerou ${out}`);
}
