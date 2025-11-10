/**
 * SECURITY HEADERS MIDDLEWARE
 * HTTP güvenlik header'ları ekler
 * OWASP Top 10 güvenlik standartlarına uygun
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Güvenlik header'larını ekleyen middleware
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // X-Frame-Options: Clickjacking saldırılarına karşı koruma
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options: MIME type sniffing'i engelle
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-XSS-Protection: XSS saldırılarına karşı tarayıcı koruması
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Strict-Transport-Security: HTTPS zorunlu kıl (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Content-Security-Policy: XSS ve data injection saldırılarına karşı koruma
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React Native için gerekli
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://firebasestorage.googleapis.com https://*.afad.gov.tr https://earthquake.usgs.gov",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // Referrer-Policy: Referrer bilgisini kontrol et
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy: Tarayıcı özelliklerine erişimi kontrol et
  res.setHeader('Permissions-Policy', [
    'geolocation=(self)',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=(self)'
  ].join(', '));
  
  // X-Permitted-Cross-Domain-Policies: Adobe ürünleri için cross-domain policy
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Cache-Control: Hassas veri önbellekleme kontrolü
  if (req.path.includes('/api/iap') || req.path.includes('/push')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
}

/**
 * CORS güvenlik ayarları
 */
export const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // İzin verilen origin'ler
    const allowedOrigins = [
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,  // Local development
      /^https:\/\/.*\.render\.com$/,                    // Render.com
      /^https:\/\/.*\.afetnet\.app$/,                   // Production domain
      /^https:\/\/.*\.expo\.dev$/,                      // Expo development
    ];
    
    // Origin yoksa (mobile app) veya izin veriliyorsa
    if (!origin || allowedOrigins.some(regex => regex.test(origin))) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Org-Secret'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

/**
 * Request body size limiter
 */
export const bodyLimitMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Body size kontrolü (express.json() ile birlikte kullan)
  const contentLength = req.headers['content-length'];
  
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (size > maxSize) {
      console.warn(`⚠️ Request body too large: ${size} bytes from ${req.ip}`);
      return res.status(413).json({
        success: false,
        error: 'Request body too large',
        maxSize: '10MB',
      });
    }
  }
  
  next();
};

/**
 * IP whitelist/blacklist middleware
 */
export function ipFilterMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || req.connection.remoteAddress || '';
  
  // Blacklisted IP'ler (DDoS, abuse vb.)
  const blacklist: string[] = [
    // Buraya kötü niyetli IP'ler eklenebilir
  ];
  
  if (blacklist.includes(clientIP)) {
    console.warn(`🚫 Blocked IP: ${clientIP}`);
    return res.status(403).json({
      success: false,
      error: 'Access denied',
    });
  }
  
  next();
}

/**
 * Request ID middleware (tracking için)
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Suspicious activity detection
 */
export function suspiciousActivityMiddleware(req: Request, res: Response, next: NextFunction) {
  const clientIP = req.ip || '';
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path;
  
  // Şüpheli pattern'ler
  const suspiciousPatterns = [
    /\.\./,                    // Path traversal
    /<script/i,                // XSS attempt
    /union.*select/i,          // SQL injection
    /exec\(/i,                 // Command injection
    /eval\(/i,                 // Code injection
    /base64_decode/i,          // Obfuscation
    /\bor\b.*=.*\bor\b/i,     // SQL injection
    /\/etc\/passwd/,           // File access attempt
    /\/proc\//,                // System info access
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(path) || 
    pattern.test(JSON.stringify(req.query)) || 
    pattern.test(JSON.stringify(req.body))
  );
  
  if (isSuspicious) {
    console.error(`🚨 SUSPICIOUS ACTIVITY DETECTED:`, {
      ip: clientIP,
      path,
      userAgent,
      query: req.query,
      timestamp: new Date().toISOString(),
    });
    
    // Sentry'ye gönder veya log'la
    // TODO: Implement alert system
    
    return res.status(400).json({
      success: false,
      error: 'Invalid request',
    });
  }
  
  next();
}

