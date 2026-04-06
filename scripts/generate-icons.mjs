// scripts/generate-icons.mjs — Generate all icon assets from SVG sources
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const icons = resolve(root, 'icons');

async function generate() {
  const iconSvg = readFileSync(resolve(icons, 'icon.svg'));
  const maskSvg = readFileSync(resolve(icons, 'icon-maskable.svg'));
  const ogSvg   = readFileSync(resolve(icons, 'og-image.svg'));

  // Standard icon PNGs
  const sizes = [16, 32, 180, 192, 512];
  for (const s of sizes) {
    await sharp(iconSvg, { density: Math.ceil(s / 512 * 72 * 4) })
      .resize(s, s)
      .png()
      .toFile(resolve(icons, `icon-${s}.png`));
    console.log(`  icon-${s}.png`);
  }

  // Maskable PNGs
  for (const s of [192, 512]) {
    await sharp(maskSvg, { density: Math.ceil(s / 512 * 72 * 4) })
      .resize(s, s)
      .png()
      .toFile(resolve(icons, `icon-maskable-${s}.png`));
    console.log(`  icon-maskable-${s}.png`);
  }

  // OG image (1200x630)
  await sharp(ogSvg, { density: 150 })
    .resize(1200, 630)
    .png()
    .toFile(resolve(icons, 'og-image.png'));
  console.log('  og-image.png');

  // Favicon.ico from 16 + 32 PNGs
  const ico = await pngToIco([
    resolve(icons, 'icon-16.png'),
    resolve(icons, 'icon-32.png'),
  ]);
  writeFileSync(resolve(root, 'favicon.ico'), ico);
  console.log('  favicon.ico');

  console.log('\nDone! All icons generated.');
}

generate().catch((err) => { console.error(err); process.exit(1); });
