import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '家里有数 · 家庭库存管理',
  description: '轻松记录家中物品，及时发现需要补货的东西。',
  openGraph: {
    title: '家里有数 · 家庭库存管理',
    description: '家里的东西，心里有数。',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: '家里有数' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '家里有数 · 家庭库存管理',
    description: '家里的东西，心里有数。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
