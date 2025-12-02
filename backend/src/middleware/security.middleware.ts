import { Request, Response, NextFunction } from "express";
import helmet from "helmet";

/**
 * Content Security Policy configuration
 * Restricts sources for scripts, styles, and other resources
 */
export const contentSecurityPolicy = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // Monaco editor may need inline styles
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
    fontSrc: ["'self'", "data:"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
  },
});

/**
 * Comprehensive helmet configuration for security headers
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Strict Transport Security - force HTTPS in production
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // Prevent clickjacking
  frameguard: {
    action: "deny",
  },
  // Prevent MIME type sniffing
  noSniff: true,
  // XSS Protection (legacy but still useful)
  xssFilter: true,
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // Referrer Policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin",
  },
  // Permissions Policy (formerly Feature Policy)
  permittedCrossDomainPolicies: {
    permittedPolicies: "none",
  },
});

/**
 * CORS configuration for production
 * Restricts cross-origin requests to allowed origins
 */
export const getCorsOptions = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [process.env.FRONTEND_URL || "http://localhost:3000"];

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    maxAge: 86400, // 24 hours
  };
};

/**
 * Input sanitization middleware
 * Removes potentially dangerous characters and patterns
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj !== null && typeof obj === "object") {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitize a string by removing dangerous patterns
 */
function sanitizeString(str: string): string {
  if (typeof str !== "string") {
    return str;
  }

  // Remove null bytes
  str = str.replace(/\0/g, "");

  // Remove control characters except newlines and tabs
  str = str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Limit string length to prevent DoS
  const MAX_STRING_LENGTH = 10000;
  if (str.length > MAX_STRING_LENGTH) {
    str = str.substring(0, MAX_STRING_LENGTH);
  }

  return str;
}

/**
 * SQL injection prevention helper
 * Validates that input doesn't contain SQL injection patterns
 */
export const validateNoSQLInjection = (input: string): boolean => {
  const sqlInjectionPatterns = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi, /(--|\;|\/\*|\*\/)/g, /(\bOR\b.*=.*)/gi, /(\bAND\b.*=.*)/gi, /('|"|\`)/g];

  return !sqlInjectionPatterns.some((pattern) => pattern.test(input));
};

/**
 * XSS prevention helper
 * Escapes HTML special characters
 */
export const escapeHtml = (str: string): string => {
  const htmlEscapeMap: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return str.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char]);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validate username format
 * Alphanumeric, underscores, hyphens only
 */
export const isValidUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

/**
 * Validate code input
 * Ensures code doesn't exceed limits and doesn't contain dangerous patterns
 */
export const validateCode = (code: string, language: string): { valid: boolean; error?: string } => {
  // Check length
  const MAX_CODE_LENGTH = 5000;
  if (code.length > MAX_CODE_LENGTH) {
    return { valid: false, error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters` };
  }

  // Check for null bytes
  if (code.includes("\0")) {
    return { valid: false, error: "Code contains invalid null bytes" };
  }

  // Language-specific validation
  if (language === "javascript" || language === "typescript") {
    // Check for dangerous Node.js patterns
    const dangerousPatterns = [/require\s*\(\s*['"]child_process['"]\s*\)/, /require\s*\(\s*['"]fs['"]\s*\)/, /require\s*\(\s*['"]net['"]\s*\)/, /require\s*\(\s*['"]http['"]\s*\)/, /process\.exit/, /process\.kill/];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return { valid: false, error: "Code contains potentially dangerous operations" };
      }
    }
  }

  if (language === "python") {
    // Check for dangerous Python patterns
    const dangerousPatterns = [/import\s+os/, /import\s+subprocess/, /import\s+socket/, /import\s+sys/, /__import__/, /eval\s*\(/, /exec\s*\(/];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return { valid: false, error: "Code contains potentially dangerous operations" };
      }
    }
  }

  return { valid: true };
};

/**
 * Rate limit error response
 */
export const rateLimitErrorResponse = (req: Request, res: Response) => {
  res.status(429).json({
    error: "Too many requests",
    message: "You have exceeded the rate limit. Please try again later.",
    retryAfter: 60,
  });
};
