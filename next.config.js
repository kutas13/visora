/** @type {import('next').NextConfig} */
const nextConfig = {
  // Görsel optimizasyonu
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24, // 24 saat cache
  },
  
  // Performans optimizasyonları
  experimental: {
    optimizePackageImports: [
      '@supabase/supabase-js',
      '@supabase/ssr',
      'recharts',
      'jszip',
      'nodemailer',
    ],
  },
  
  // Production optimizasyonları
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Poweredby header'ı kaldır (güvenlik)
  poweredByHeader: false,
  
  // Strict mode
  reactStrictMode: true,

  // ===== GÜVENLİK HEADER'LARI =====
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // XSS koruması
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Clickjacking koruması - siteyi iframe içine almayı engelle
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // MIME type sniffing koruması
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer bilgisini sınırla
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // DNS prefetch güvenliği
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // HTTPS zorunlu (production'da)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // İzinler politikası - gereksiz tarayıcı özelliklerini kapat
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  
  // Webpack: pdfjs-dist ve mediapipe uyumluluğu
  webpack: (config) => {
    // pdfjs-dist Node.js canvas modülünü devre dışı bırak (browser ortamında gereksiz)
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

module.exports = nextConfig;
