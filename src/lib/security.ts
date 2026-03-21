/**
 * Fox Turizm - Güvenlik Yardımcıları
 * Rate limiting, input sanitization, origin kontrolü
 */

// ===== RATE LIMITING =====
// Basit in-memory rate limiter (Vercel serverless için uygun)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limit kontrolü
 * @param identifier - IP veya kullanıcı ID
 * @param maxRequests - Zaman diliminde max istek sayısı
 * @param windowMs - Zaman dilimi (ms) - varsayılan 60 saniye
 * @returns { allowed: boolean, remaining: number }
 */
export function rateLimit(
  identifier: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  // Eski kayıtları temizle (bellek yönetimi)
  if (rateLimitMap.size > 10000) {
    rateLimitMap.forEach((val, key) => {
      if (val.resetTime < now) rateLimitMap.delete(key);
    });
  }

  if (!entry || entry.resetTime < now) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  entry.count += 1;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: maxRequests - entry.count };
}

// ===== INPUT SANITIZATION =====

/**
 * HTML özel karakterlerini escape et (XSS koruması)
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * AI prompt injection koruması
 * Kullanıcı girdisinden tehlikeli prompt injection kalıplarını temizle
 */
export function sanitizeAIInput(input: string): string {
  if (!input || typeof input !== "string") return "";

  let cleaned = input.trim();

  // Max uzunluk sınırı (2000 karakter)
  if (cleaned.length > 2000) {
    cleaned = cleaned.substring(0, 2000);
  }

  // Tehlikeli prompt injection kalıplarını temizle
  const dangerousPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/gi,
    /ignore\s+(all\s+)?above/gi,
    /forget\s+(all\s+)?previous/gi,
    /you\s+are\s+now\s+(?:a|an)\s+/gi,
    /new\s+instructions?:/gi,
    /system\s*:\s*/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
  ];

  for (const pattern of dangerousPatterns) {
    cleaned = cleaned.replace(pattern, "[filtered]");
  }

  return cleaned;
}

/**
 * Genel input validasyonu
 */
export function sanitizeInput(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== "string") return "";
  return input.trim().substring(0, maxLength);
}

// ===== ORIGIN KONTROLÜ =====

/**
 * İstek origin'ini doğrula (CSRF koruması)
 */
export function validateOrigin(
  requestOrigin: string | null,
  requestHost: string | null
): boolean {
  // Development ortamında her zaman izin ver
  if (process.env.NODE_ENV === "development") return true;

  // Origin veya host yoksa reddet
  if (!requestOrigin && !requestHost) return false;

  // Aynı origin kontrolü
  if (requestOrigin) {
    try {
      const url = new URL(requestOrigin);
      if (requestHost && url.host === requestHost) return true;
    } catch {
      return false;
    }
  }

  return true;
}

// ===== API KEY GÜVENLİĞİ =====

/**
 * Ortam değişkenlerinin client'a sızmadığından emin ol
 * NEXT_PUBLIC_ ile başlamayan keyler zaten server-only
 * Bu fonksiyon ek bir güvenlik katmanı
 */
export function validateEnvSecurity(): string[] {
  const warnings: string[] = [];

  const sensitiveKeys = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "SMTP_PASS_YUSUF",
    "SMTP_PASS_BAHAR",
    "SMTP_PASS_ERCAN",
    "SMTP_PASS_DAVUT",
    "CRON_SECRET",
  ];

  for (const key of sensitiveKeys) {
    // NEXT_PUBLIC_ ile başlayan hassas key varsa uyar
    if (process.env[`NEXT_PUBLIC_${key}`]) {
      warnings.push(
        `⚠️ ${key} yanlışlıkla NEXT_PUBLIC_ prefix'iyle tanımlanmış! Client'a sızabilir.`
      );
    }
  }

  return warnings;
}
