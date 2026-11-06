import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './styles.css';

// 有新版本时自动刷新。PWA 从后台回到前台时不会重新加载，所以在这里主动检查。
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update();
    });
  },
});

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
