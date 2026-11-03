// 修改 public/favicon.svg 后运行 `node scripts/icons.mjs` 重新生成 PNG 图标。
import sharp from 'sharp';
for (const [file, size] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512]]) {
  await sharp('public/favicon.svg', { density: 300 }).resize(size, size).png().toFile(`public/icons/${file}.png`);
}
