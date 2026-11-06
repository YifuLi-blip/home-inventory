import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID',
];

export default defineConfig(({ command, mode }) => {
  // 没有配置时构建照样成功，但线上网站会打不开，所以直接中止。
  if (command === 'build' && mode !== 'fake') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    const missing = REQUIRED_ENV.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`缺少 Firebase 配置，已中止构建：${missing.join(', ')}。请检查 .env.local。`);
    }
  }

  return {
  resolve: {
    // `--mode fake` 用内存数据替换 Firebase，只用于界面测试。
    alias: mode === 'fake'
      ? [{ find: /^\.\/data$/, replacement: fileURLToPath(new URL('./tests/fakeData.ts', import.meta.url)) }]
      : [],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '家里有数',
        short_name: '家里有数',
        description: '家里的东西，心里有数。',
        lang: 'zh-CN',
        start_url: '/',
        display: 'standalone',
        background_color: '#f7f6ef',
        theme_color: '#f7f6ef',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
  };
});
