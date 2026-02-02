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
    optimizePackageImports: ['@supabase/supabase-js', '@supabase/ssr'],
  },
  
  // Production optimizasyonları
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Poweredby header'ı kaldır (güvenlik)
  poweredByHeader: false,
  
  // Strict mode
  reactStrictMode: true,
  
  // SWC minification (daha hızlı build)
  swcMinify: true,
};

module.exports = nextConfig;
